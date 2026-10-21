/* Shared domain helpers: public projections, permissions, notifications, audit and mail. */
const {id}=require('./seguridad.cjs');

const ROLE_LABELS={buyer:'Comprador',seller:'Vendedor',internal_contributor:'Colaborador',legal:'Legal',operator:'Operador de remates',content_editor:'Editor de contenido',general_admin:'Administrador general'};
const INTERNAL_ROLES=['internal_contributor','legal','operator','content_editor','general_admin'];
const has=(user,...roles)=>!!user&&(user.roles.includes('general_admin')||roles.some(r=>user.roles.includes(r)));

const mediaUrl=(key,admin=false)=>{if(!key)return '';if(key.startsWith('demo:'))return `/assets/propiedades/propiedad-${String(key.slice(5)).padStart(2,'0')}.webp`;return admin?`/api/v1/admin/media/${key}`:`/media/${key}`};

/* Fields that may ever be public. Exact address, legal notes, private documents and authorship never leave the server. */
function publicFields(p){return {id:p.id,publicId:p.publicId,slug:p.slug,title:p.title,type:p.type,region:p.region,commune:p.commune,publicLocation:p.publicLocation,lat:p.lat!=null?Math.round(p.lat*100)/100:null,lng:p.lng!=null?Math.round(p.lng*100)/100:null,rooms:p.rooms,baths:p.baths,parking:p.parking,area:p.area,plot:p.plot,occupancy:p.occupancy,expenses:p.expenses,description:p.description,
 media:(p.media||[]).filter(m=>m.approved).sort((a,b)=>a.order-b.order).map(m=>({key:m.key,alt:m.alt})),documents:(p.documents||[]).filter(d=>d.visibility==='public').map(d=>({id:d.id,name:d.name,type:d.type,at:d.at})),
 conditions:{opensAt:p.conditions?.opensAt||null,closesAt:p.conditions?.closesAt||null,initialUF:p.conditions?.initialUF||null,incrementUF:p.conditions?.incrementUF||null},seo:p.seo||{},auctionId:p.auctionId,publishedAt:p.publishedAt}}
function livePublic(p){if(p.publicStatus!=='published'||!p.live)return null;const v={...p.live};v.media=v.media.map(m=>({...m,url:mediaUrl(m.key)}));return v}

function audit(db,actor,action,entity,entityId,changes={},requestId=''){db.audit.push({id:id('aud'),actorId:actor||null,action,entity,entityId:String(entityId),changes,at:Date.now(),requestId});if(db.audit.length>20000)db.audit.splice(0,db.audit.length-20000)}
function mail(db,{to,subject,body,link}){db.mail.unshift({id:id('mail'),to,subject,body,link:link||'',at:Date.now()});if(db.mail.length>500)db.mail.length=500}
/* Outbid alerts are grouped: an unread alert for the same auction is refreshed instead of duplicated. */
function notify(db,userId,{type,title,body,link,group}){const u=db.users.find(x=>x.id===userId);if(!u||u.status==='deleted')return;if(group){const prev=db.notifications.find(n=>n.userId===userId&&n.group===group&&!n.readAt);if(prev){Object.assign(prev,{title,body,link,at:Date.now(),count:(prev.count||1)+1});return}}
 db.notifications.unshift({id:id('ntf'),userId,type,title,body,link,group:group||null,at:Date.now(),readAt:null,channel:'app'});if(db.notifications.length>5000)db.notifications.length=5000;
 if(u.prefs?.notifyEmail!==false||['security','account'].includes(type))mail(db,{to:u.email,subject:title,body,link})}

function publicUser(u){return u&&{id:u.id,email:u.email,name:u.name,phone:u.phone||'',accountType:u.accountType,status:u.status,emailVerified:!!u.emailVerifiedAt,roles:u.roles,roleLabels:u.roles.map(r=>ROLE_LABELS[r]||r),prefs:u.prefs||{},termsVersion:u.termsVersion||null,mfa:!!u.mfa,demoProfile:u.demoProfile||null,deletionRequestedAt:u.deletionRequestedAt||null}}

/* Review blocks: general data and photos (collaborator) and legal block (Legal). Both must be complete to request review. */
function completeness(p){const general=[['Título',p.title],['Tipo',p.type],['Comuna',p.commune],['Descripción',p.description&&p.description.length>=40],['Superficie',p.area>0],['Foto principal',(p.media||[]).length>0],['Textos alternativos',(p.media||[]).every(m=>m.alt&&m.alt.length>=5)],['Condiciones del remate',p.conditions?.initialUF>0&&p.conditions?.incrementUF>0&&p.conditions?.closesAt>p.conditions?.opensAt]];
 const legal=[['Antecedentes legales cargados',(p.documents||[]).some(d=>d.visibility==='private'||d.type==='Antecedente legal')],['Observación legal',!!(p.legalNotes&&p.legalNotes.length>=5)],['Bloque legal marcado como completo',!!p.legalComplete]];
 const missing=[...general,...legal].filter(([,ok])=>!ok).map(([n])=>n);return {general:general.map(([n,ok])=>({name:n,ok:!!ok})),legal:legal.map(([n,ok])=>({name:n,ok:!!ok})),missing,ready:!missing.length}}

module.exports={ROLE_LABELS,INTERNAL_ROLES,has,mediaUrl,publicFields,livePublic,audit,mail,notify,publicUser,completeness};
