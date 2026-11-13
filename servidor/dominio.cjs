/* Shared domain helpers: public projections, permissions, notifications, audit and mail. */
const {id}=require('./seguridad.cjs');

const ROLE_LABELS={buyer:'Comprador',seller:'Vendedor',internal_contributor:'Colaborador',legal:'Legal',operator:'Operador de remates',content_editor:'Editor de contenido',general_admin:'Administrador general'};
const INTERNAL_ROLES=['internal_contributor','legal','operator','content_editor','general_admin'];
const has=(user,...roles)=>!!user&&(user.roles.includes('general_admin')||roles.some(r=>user.roles.includes(r)));

const mediaUrl=(key,admin=false)=>{if(!key)return '';if(key.startsWith('demo:'))return `/assets/propiedades/propiedad-${String(key.slice(5)).padStart(2,'0')}.webp`;return admin?`/api/v1/admin/media/${key}`:`/media/${key}`};

/* Fields that may ever be public. Legal notes, private documents and authorship never leave the server.
   The exact address and pin are public only when the team ticks "showExact" (and it passes review like any other change). */
function publicFields(p){return {id:p.id,publicId:p.publicId,slug:p.slug,title:p.title,type:p.type,region:p.region,commune:p.commune,publicLocation:p.publicLocation,...(p.showExact&&p.geo?{exactLocation:true,address:p.exactAddress||'',lat:p.geo.lat,lng:p.geo.lng}:{exactLocation:false,lat:p.lat!=null?Math.round(p.lat*100)/100:null,lng:p.lng!=null?Math.round(p.lng*100)/100:null}),rooms:p.rooms,baths:p.baths,parking:p.parking,area:p.area,plot:p.plot,occupancy:p.occupancy,expenses:p.expenses,description:p.description,connectivity:p.connectivity||'',appreciation:p.appreciation||'',appraisalUF:p.appraisalUF??null,mortgage:p.mortgage===true,
 media:(p.media||[]).filter(m=>m.approved).sort((a,b)=>a.order-b.order).map(m=>({key:m.key,alt:m.alt})),documents:(p.documents||[]).filter(d=>d.visibility==='public').map(d=>({id:d.id,name:d.name,type:d.type,at:d.at})),
 conditions:{opensAt:p.conditions?.opensAt||null,closesAt:p.conditions?.closesAt||null,initialUF:p.conditions?.initialUF||null,incrementUF:p.conditions?.incrementUF||null,guaranteeCLP:p.conditions?.guaranteeCLP||null},seo:p.seo||{},auctionId:p.auctionId,publishedAt:p.publishedAt}}
function livePublic(p){if(p.publicStatus!=='published'||!p.live)return null;const v={...p.live};v.media=v.media.map(m=>({...m,url:mediaUrl(m.key)}));return v}

function audit(db,actor,action,entity,entityId,changes={},requestId=''){db.audit.push({id:id('aud'),actorId:actor||null,action,entity,entityId:String(entityId),changes,at:Date.now(),requestId});if(db.audit.length>5000)db.audit.splice(0,db.audit.length-5000)}
const Mail=require('./correo.cjs');
const Plantillas=require('./plantillas.cjs');
const TYPE_TEMPLATE={bid:'monto_aceptado',outbid:'monto_superado',closing:'cierre_proximo',auction:'subasta_cambio',result:'resultado',incident:'mensaje_equipo',saved:'propiedad_guardada',new_property:'nueva_propiedad',news:'novedad_blog',guarantee:'garantia'};
const TYPE_CATEGORY={bid:'auction',outbid:'auction',result:'auction',incident:'auction',auction:'auction',closing:'auction',guarantee:'account',saved:'saved',new_property:'new',news:'news',security:'account',account:'account',staff:'staff'};
const PREF_FOR={auction:'notifyEmail',saved:'alertsSaved',new:'alertsNew',news:'alertsNews'};
/* Preferencias por categoría. Los mensajes de cuenta y seguridad siempre se envían. */
function wantsEmail(u,category){const k=PREF_FOR[category];if(!k)return true;const prefs=u.prefs||{};if(k==='notifyEmail')return prefs.notifyEmail!==false;if(k==='alertsSaved')return prefs.alertsSaved!==false;return prefs[k]===true}
/* Bandeja de salida: el mensaje se guarda dentro de la misma transacción y se entrega después. */
function mail(db,{to,subject,body,link,cta,category='account',userId=null,template,title,details,code}){const unsubscribeUrl=userId&&PREF_FOR[category]?Mail.abs(`/cancelar-alertas?u=${encodeURIComponent(userId)}&c=${category}&t=${Mail.unsubToken(db,userId,category)}`):'';// El HTML se genera al enviar o al mostrar; así la bandeja ocupa poco espacio.
 db.mail.unshift({id:id('mail'),to,subject,title:title||'',body,link:link||'',cta:cta||'',category,template:template||(category==='staff'?'equipo_aviso':'cuenta'),details:details||null,code:code||'',userId,unsubscribeUrl,status:'queued',tries:0,at:Date.now()});if(db.mail.length>500)db.mail.length=500}
/* Parámetros de la plantilla transaccional (los mismos se envían a Brevo cuando la plantilla está publicada allí). */
function mailParams(m){const parrafos=String(m.body||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
 return {asunto:m.subject,titulo:m.title||m.subject,resumen:parrafos[0]||'',parrafos,detalles:m.details?.length?m.details:null,codigo:m.code||'',enlace:Mail.abs(m.link),boton:m.cta||'Ver en SeSubasta',baja:m.unsubscribeUrl||'',preferencias:Mail.abs(m.category==='staff'?'/gestion/mi-perfil':'/mi-cuenta/perfil')}}
const renderMail=m=>{const params=mailParams(m);return {...Plantillas.render(m.template||'cuenta',params),params}};
/* Notificación en la app y, según preferencias, por correo. Las alertas con `group` se agrupan mientras no se lean. */
function notify(db,userId,{type,title,body,link,group,category,cta,template,details,heading}){const u=db.users.find(x=>x.id===userId);if(!u||u.status==='deleted'||u.status==='blocked')return;const cat=category||TYPE_CATEGORY[type]||'account';
 if(group){const prev=db.notifications.find(n=>n.userId===userId&&n.group===group&&!n.readAt);if(prev){Object.assign(prev,{title,body,link,at:Date.now(),count:(prev.count||1)+1});return}}
 db.notifications.unshift({id:id('ntf'),userId,type,category:cat,title,body,link,group:group||null,at:Date.now(),readAt:null,channel:'app'});if(db.notifications.length>3000)db.notifications.length=3000;
 if(wantsEmail(u,cat))mail(db,{to:u.email,subject:title,title:heading,body,link,cta,category:cat,userId:u.id,template:template||TYPE_TEMPLATE[type]||'cuenta',details})}
/* Avisos internos al equipo según rol (nuevas solicitudes, revisiones, resultados por confirmar). */
function notifyStaff(db,roles,{title,body,link,details}){db.users.filter(u=>u.accountType==='internal'&&u.status==='active'&&roles.some(r=>u.roles.includes(r)||u.roles.includes('general_admin'))).forEach(u=>mail(db,{to:u.email,subject:title,body,link,cta:'Abrir en gestión',category:'staff',template:'equipo_aviso',details}))}

function publicUser(u){return u&&{id:u.id,email:u.email,name:u.name,phone:u.phone||'',whatsapp:u.whatsapp||'',position:u.position||'',area:u.area||'',staffNotes:u.accountType==='internal'?u.staffNotes||'':undefined,invitedAt:u.invitedAt||null,lastLoginAt:u.lastLoginAt||null,accountType:u.accountType,status:u.status,emailVerified:!!u.emailVerifiedAt,roles:u.roles,roleLabels:u.roles.map(r=>ROLE_LABELS[r]||r),prefs:u.prefs||{},termsVersion:u.termsVersion||null,mfa:!!u.mfa,demoProfile:u.demoProfile||null,deletionRequestedAt:u.deletionRequestedAt||null}}

/* Review blocks: general data and photos (collaborator) and legal block (Legal). Both must be complete to request review. */
function completeness(p){const general=[['Título',p.title],['Tipo',p.type],['Comuna',p.commune],['Descripción',p.description&&p.description.length>=40],['Superficie',p.area>0],['Foto principal',(p.media||[]).length>0],['Textos alternativos',(p.media||[]).every(m=>m.alt&&m.alt.length>=5)],['Condiciones del remate',p.conditions?.initialUF>0&&p.conditions?.incrementUF>0&&p.conditions?.closesAt>p.conditions?.opensAt]];
 const legal=[['Antecedentes legales cargados',(p.documents||[]).some(d=>d.visibility==='private'||d.type==='Antecedente legal')],['Observación legal',!!(p.legalNotes&&p.legalNotes.length>=5)],['Bloque legal marcado como completo',!!p.legalComplete]];
 const missing=[...general,...legal].filter(([,ok])=>!ok).map(([n])=>n);return {general:general.map(([n,ok])=>({name:n,ok:!!ok})),legal:legal.map(([n,ok])=>({name:n,ok:!!ok})),missing,ready:!missing.length}}

module.exports={renderMail,mailParams,TYPE_TEMPLATE,wantsEmail,notifyStaff,TYPE_CATEGORY,ROLE_LABELS,INTERNAL_ROLES,has,mediaUrl,publicFields,livePublic,audit,mail,notify,publicUser,completeness};
