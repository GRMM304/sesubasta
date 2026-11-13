const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sesubasta-test-'));process.env.SESUBASTA_DATA=path.join(dir,'datos.json');
const {server,engine,store}=require('./server.cjs');
let base;const aborts=[];
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port});
test.after(async()=>{for(const a of aborts)a.abort();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true})});
/* Minimal cookie-aware client: each instance is one browser. */
function client(){const jar={};return async(method,url,body,{raw=false}={})=>{const r=await fetch(base+url,{method,redirect:'manual',headers:{'Content-Type':'application/json','X-SeSubasta':'1',Cookie:Object.entries(jar).map(([k,v])=>k+'='+v).join('; ')},body:body?JSON.stringify(body):undefined});for(const c of r.headers.getSetCookie?.()||[]){const [kv]=c.split(';');const [k,v]=kv.split('=');if(v)jar[k]=v;else delete jar[k]}if(raw)return r;let data=null;try{data=await r.json()}catch{}return {status:r.status,data}}}
const lastMail=to=>store.data.mail.find(m=>m.to===to);

test('dos sesiones comparten snapshot en vivo; privacidad, concurrencia y continuidad',async()=>{
 const call=async(url,body,token)=>{const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}};
 const a=(await call('/api/demo-session',{profile:'alex'})).data,b=(await call('/api/demo-session',{profile:'camila'})).data;
 const connect=async()=>{const controller=new AbortController();aborts.push(controller);const response=await fetch(base+'/api/events',{signal:controller.signal});const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';return async()=>{for(;;){const i=buffer.indexOf('\n\n');if(i>=0){const block=buffer.slice(0,i);buffer=buffer.slice(i+2);const data=block.split('\n').find(x=>x.startsWith('data: '));if(data)return JSON.parse(data.slice(6));continue}const r=await reader.read();buffer+=decoder.decode(r.value,{stream:true})}}};
 const nextA=await connect(),nextB=await connect();const snap=(await nextA()).auctions.find(x=>x.id===2);await nextB();
 const req={amountMinor:snap.nextMinor,unit:'UF',termsVersion:snap.termsVersion,key:'integration_1',expectedVersion:snap.version};
 const responses=await Promise.all([call('/api/auctions/2/bids',req,a.token),call('/api/auctions/2/bids',{...req,key:'integration_2'},b.token)]);
 assert.equal(responses.filter(x=>x.status===200).length,1);assert.equal(responses.filter(x=>x.status===409).length,1);
 async function accepted(next){for(let i=0;i<8;i++){const s=await next(),x=s.auctions.find(x=>x.id===2);if(x.version===snap.version+1)return x}throw Error('No received event')}
 const [eventA,eventB]=await Promise.all([accepted(nextA),accepted(nextB)]);assert.equal(eventA.currentMinor,eventB.currentMinor);assert.equal(eventA.participants,1);assert(!JSON.stringify(eventA).includes('buyer'));
 const winner=responses[0].status===200?a:b;const second=await call('/api/auctions/2/bids',{...req,amountMinor:eventA.nextMinor,key:'integration_3',expectedVersion:snap.version+1},winner.token);assert.equal(second.status,200);assert.equal(second.data.snapshot.participants,1);
 const own=await call('/api/my-bids',null,winner.token);assert.equal(own.data.bids.filter(x=>x.id===2).length,2);assert.equal((await call('/api/my-bids')).status,401);
 assert.equal((await fetch(base+'/runtime-data/datos.json')).status,404);
 const persisted=JSON.parse(fs.readFileSync(process.env.SESUBASTA_DATA));assert.equal(persisted.subastas.auctions['2'].bids.length,2);assert.equal(engine.snapshot(2).totalBids,2);
 assert(store.data.attempts.some(x=>x.result==='rejected'&&x.code==='AUCTION_CHANGED'),'el intento rechazado queda en la bitácora');
});

test('registro, verificación obligatoria para ofertar y separación de audiencias',async()=>{const c=client();
 const bad=await c('POST','/api/v1/auth/register',{name:'X',email:'no',password:'corta',password2:'otra'});assert.equal(bad.status,422);assert(bad.data.fields.email&&bad.data.fields.password&&bad.data.fields.acceptTerms);
 const r=await c('POST','/api/v1/auth/register',{name:'Persona Prueba',email:'Persona@Ejemplo.cl',password:'ClaveSegura123',password2:'ClaveSegura123',acceptTerms:true,roles:['general_admin']});assert.equal(r.status,200);assert.deepEqual(r.data.user.roles,['buyer']);assert.equal(r.data.user.emailVerified,false);
 assert.equal((await c('POST','/api/v1/auth/register',{name:'Otra',email:'persona@ejemplo.cl',password:'ClaveSegura123',password2:'ClaveSegura123',acceptTerms:true})).status,409);
 engine.state.auctions['6'].start=Date.now()-1000; // las subastas de muestra son de a una: se abre la 6 para la prueba
 const s=engine.snapshot(6);const blocked=await c('POST','/api/v1/auctions/6/bids',{amountMinor:s.nextMinor,unit:'UF',termsVersion:s.termsVersion,key:'unverified_1',expectedVersion:s.version});assert.equal(blocked.status,403);assert.equal(blocked.data.code,'EMAIL_NOT_VERIFIED');
 const token=new URL(lastMail('Persona@Ejemplo.cl').link).searchParams.get('token');assert.equal((await c('POST','/api/v1/auth/verify-email',{token})).status,200);assert.equal((await c('POST','/api/v1/auth/verify-email',{token})).data.code,'TOKEN_USED');
 const ok=await c('POST','/api/v1/auctions/6/bids',{amountMinor:s.nextMinor,unit:'UF',termsVersion:s.termsVersion,key:'verified_1',expectedVersion:s.version});assert.equal(ok.status,200);
 assert.equal((await c('GET','/api/v1/admin/summary')).status,401,'la sesión pública no abre el panel interno');
 const staff=client();const staffOnPublic=await staff('POST','/api/v1/auth/login',{email:'colaborador@demo.cl',password:'Demo2026!'});assert.equal(staffOnPublic.status,401);assert.equal(staffOnPublic.data.message,'El correo o la contraseña no son correctos.');
});

test('MFA del administrador, permisos por rol y publicación solo por Administrador general',async()=>{const colab=client(),admin=client(),legal=client(),editor=client();
 assert.equal((await colab('POST','/api/v1/admin/auth/login',{email:'colaborador@demo.cl',password:'Demo2026!'})).status,200);
 const step=await admin('POST','/api/v1/admin/auth/login',{email:'admin@demo.cl',password:'Demo2026!'});assert.equal(step.data.mfaRequired,true);assert.equal((await admin('GET','/api/v1/admin/summary')).status,401);
 assert.equal((await admin('POST','/api/v1/admin/auth/mfa/verify',{code:'000000'})).status,401);const code=lastMail('admin@demo.cl').code;assert.equal((await admin('POST','/api/v1/admin/auth/mfa/verify',{code})).status,200);
 await legal('POST','/api/v1/admin/auth/login',{email:'legal@demo.cl',password:'Demo2026!'});await editor('POST','/api/v1/admin/auth/login',{email:'editor@demo.cl',password:'Demo2026!'});
 const created=(await colab('POST','/api/v1/admin/properties',{title:'Casa de prueba integral'})).data.property;
 assert.equal((await colab('PATCH','/api/v1/admin/properties/'+created.id,{legalNotes:'intento'})).status,403,'el colaborador no gestiona el bloque legal');
 const png=Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F80F0000010101005A4D6B0E0000000049454E44AE426082','hex');
 assert.equal((await colab('POST',`/api/v1/admin/properties/${created.id}/documents`,{file:'data:application/pdf;base64,JVBERi0xLjQK',name:'x.pdf'})).status,403,'el colaborador no carga documentos legales');
 await colab('PATCH','/api/v1/admin/properties/'+created.id,{title:'Casa de prueba integral',type:'Casa',commune:'Ñuñoa',area:120,rooms:3,baths:2,description:'Descripción suficientemente larga para pasar la validación de la ficha.',conditions:{opensAt:Date.now()+3600000,closesAt:Date.now()+7200000,initialUF:3000,incrementUF:50}});
 await colab('POST',`/api/v1/admin/properties/${created.id}/media`,{file:'data:image/png;base64,'+png.toString('base64'),alt:'Fachada de la casa de prueba'});
 assert.equal((await colab('POST',`/api/v1/admin/properties/${created.id}/request-review`)).status,422,'sin bloque legal no se puede solicitar revisión');
 const doc=await legal('POST',`/api/v1/admin/properties/${created.id}/documents`,{file:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4\n%prueba\n').toString('base64'),name:'dominio.pdf',type:'Antecedente legal'});assert.equal(doc.status,200);const docId=doc.data.property.documents[0].id;
 assert.equal((await legal('PATCH',`/api/v1/admin/properties/${created.id}/documents/${docId}`,{visibility:'public'})).status,403,'Legal no autoriza documentos públicos');
 await legal('PATCH','/api/v1/admin/properties/'+created.id,{legalNotes:'Antecedentes revisados',legalComplete:true});
 assert.equal((await colab('POST',`/api/v1/admin/properties/${created.id}/request-review`)).status,200);
 assert.equal((await colab('POST',`/api/v1/admin/reviews/${created.id}/decision`,{action:'approve'})).status,403,'el colaborador no publica');
 assert.equal((await legal('POST',`/api/v1/admin/reviews/${created.id}/decision`,{action:'approve'})).status,403,'Legal no publica');
 assert.equal((await editor('POST',`/api/v1/admin/reviews/${created.id}/decision`,{action:'approve'})).status,403,'el editor no publica propiedades');
 const pub=client();assert.equal((await pub('GET','/api/v1/properties/'+created.slug)).status,404,'la ficha en revisión no es pública');
 assert.equal((await admin('POST',`/api/v1/admin/reviews/${created.id}/decision`,{action:'approve',checklist:{titular:true}})).status,422,'la lista de verificación es obligatoria');
 const ok=await admin('POST',`/api/v1/admin/reviews/${created.id}/decision`,{action:'approve',checklist:{titular:true,antecedentes:true,fotos:true,datos:true,reglas:true}});assert.equal(ok.status,200);assert.equal(ok.data.property.publicStatus,'published');
 const slug=ok.data.property.slug;const view=await pub('GET','/api/v1/properties/'+slug);assert.equal(view.status,200);const text=JSON.stringify(view.data);assert(!text.includes('dominio.pdf')&&!text.includes('exactAddress')&&!text.includes('legalNotes'),'nada privado en la API pública');
 assert.equal((await pub('GET','/api/v1/admin/documents/'+docId,null,{raw:true})).status,401,'un visitante no descarga documentos privados');
 assert.equal((await editor('GET','/api/v1/admin/documents/'+docId,null,{raw:true})).status,403);
 assert.equal((await legal('GET','/api/v1/admin/documents/'+docId,null,{raw:true})).status,200);
 const sitemap=await (await fetch(base+'/sitemap.xml')).text();assert(sitemap.includes('/remates/'+slug));assert(!sitemap.includes('admin-login'));
 assert(store.data.audit.some(a=>a.action==='property.review_approve'&&a.actorId==='usr_admin'));
});

test('suspensión con motivo bloquea ofertas; SEO y rutas privadas con noindex',async()=>{const oper=client();await oper('POST','/api/v1/admin/auth/login',{email:'operador@demo.cl',password:'Demo2026!'});
 assert.equal((await oper('POST','/api/v1/admin/auctions/10/suspend',{reason:''})).status,422);
 assert.equal((await oper('POST','/api/v1/admin/auctions/10/suspend',{reason:'Revisión de un antecedente'})).status,200);
 const s=engine.snapshot(10);assert.equal(s.status,'paused');const c=client();await c('POST','/api/v1/auth/login',{email:'alex@comprador.demo.cl',password:'Demo2026!'});
 const r=await c('POST','/api/v1/auctions/10/bids',{amountMinor:s.nextMinor,unit:'UF',termsVersion:s.termsVersion,key:'paused_try_1',expectedVersion:s.version});assert.equal(r.status,409);assert.equal(r.data.code,'AUCTION_PAUSED');
 assert.equal((await oper('POST','/api/v1/admin/auctions/10/cancel',{reason:'Prueba de cancelación'})).status,403,'solo el Administrador general cancela');
 const admin=await fetch(base+'/admin-login');assert.match(admin.headers.get('x-robots-tag'),/noindex/);const html=await admin.text();assert(html.includes('noindex'));assert(!html.includes('Demo2026'),'no hay credenciales visibles en la página');
 const robots=await (await fetch(base+'/robots.txt')).text();assert(robots.includes('Disallow: /gestion'));
 const home=await (await fetch(base+'/')).text();assert(home.includes('application/ld+json')&&home.includes('rel="canonical"'));
 assert.equal((await fetch(base+'/remates/no-existe')).status,404);
});

test('alertas por correo: superación, nueva propiedad, recordatorio de cierre, preferencias y baja con un clic',async()=>{
 const mailsTo=to=>store.data.mail.filter(m=>m.to===to);
 const alex=client(),camila=client();await alex('POST','/api/v1/auth/login',{email:'alex@comprador.demo.cl',password:'Demo2026!'});await camila('POST','/api/v1/auth/login',{email:'camila@comprador.demo.cl',password:'Demo2026!'});
 const bid=async(c,id,key)=>{const s=engine.snapshot(id);return c('POST',`/api/v1/auctions/${id}/bids`,{amountMinor:s.nextMinor,unit:'UF',termsVersion:s.termsVersion,key,expectedVersion:s.version})};
 assert.equal((await bid(alex,2,'alert_a1')).status,200);const before=mailsTo('alex@comprador.demo.cl').length;
 assert.equal((await bid(camila,2,'alert_c1')).status,200);
 const outbid=mailsTo('alex@comprador.demo.cl').find(m=>m.subject==='Tu oferta fue superada');assert(outbid,'Alex recibe el aviso de superación');assert(require('./servidor/dominio.cjs').renderMail(outbid).html.includes('Volver a ofertar')&&outbid.unsubscribeUrl.includes('/cancelar-alertas'));
 assert(mailsTo('camila@comprador.demo.cl').some(m=>m.subject.startsWith('Oferta aceptada')),'Camila recibe su comprobante');
 assert(store.data.mail.every(m=>!/\d+\.\d{2}|amountMinor/.test(m.unsubscribeUrl||'')));
 // Alex tiene activadas las alertas de nuevas propiedades: se le avisa al publicar una ficha nueva.
 const admin=client();await admin('POST','/api/v1/admin/auth/login',{email:'admin@demo.cl',password:'Demo2026!'});const code=store.data.mail.find(m=>m.to==='admin@demo.cl'&&m.subject.includes('código')).code;await admin('POST','/api/v1/admin/auth/mfa/verify',{code});
 const pending=store.data.properties.find(p=>p.id===21);assert.equal(pending.reviewStatus,'in_review');
 const ok=await admin('POST','/api/v1/admin/reviews/21/decision',{action:'approve',checklist:{titular:true,antecedentes:true,fotos:true,datos:true,reglas:true}});assert.equal(ok.status,200);
 assert(mailsTo('alex@comprador.demo.cl').some(m=>m.subject.startsWith('Nueva propiedad en subasta')&&m.category==='new'),'alerta de nueva propiedad');
 assert(!mailsTo('camila@comprador.demo.cl').some(m=>m.subject.startsWith('Nueva propiedad')),'Camila no activó esas alertas');
 // Baja con un clic: el enlace firmado desactiva solo esa categoría.
 const link=new URL(outbid.unsubscribeUrl);const q=Object.fromEntries(link.searchParams);
 assert.equal((await client()('POST','/api/v1/alerts/unsubscribe',{...q,t:'falso'})).status,400);
 assert.equal((await client()('POST','/api/v1/alerts/unsubscribe',q)).status,200);
 const u=store.data.users.find(x=>x.id==='alex');assert.equal(u.prefs.notifyEmail,false);assert.equal(u.prefs.alertsNew,true);
 const n=mailsTo('alex@comprador.demo.cl').length;assert.equal((await bid(alex,2,'alert_a2')).status,200);assert.equal((await bid(camila,2,'alert_c2')).status,200);
 assert.equal(mailsTo('alex@comprador.demo.cl').length,n,'sin correo tras la baja');assert(store.data.notifications.some(x=>x.userId==='alex'&&x.type==='outbid'),'la notificación en la app se mantiene');
 // Recordatorio de cierre a 10 minutos: una sola vez por subasta.
 const a=engine.state.auctions['6'];a.start=Date.now()-60000;a.end=Date.now()+5*60000;store.data.saved.push({userId:'camila',propertyId:6,at:Date.now()});
 const api=require('./servidor/api.cjs');void api;
 await new Promise(r=>setTimeout(r,1300));
 const reminders=mailsTo('camila@comprador.demo.cl').filter(m=>m.subject.startsWith('Cierra en 10 minutos'));assert.equal(reminders.length,1);
 await new Promise(r=>setTimeout(r,1200));assert.equal(mailsTo('camila@comprador.demo.cl').filter(m=>m.subject.startsWith('Cierra en 10 minutos')).length,1,'no se repite');
 assert(store.data.mail.filter(m=>m.status==='local').length>0,'la bandeja de salida entrega localmente');
});

test('alta de usuarios del equipo con WhatsApp y tareas entre roles por correo y WhatsApp',async()=>{
 const admin=client();await admin('POST','/api/v1/admin/auth/login',{email:'admin@demo.cl',password:'Demo2026!'});const code=store.data.mail.find(m=>m.to==='admin@demo.cl'&&m.subject.includes('código')).code;await admin('POST','/api/v1/admin/auth/mfa/verify',{code});
 const bad=await admin('POST','/api/v1/admin/users',{name:'Ana Nueva',email:'ana@sesubasta.cl',whatsapp:'123',position:'',roles:[]});assert.equal(bad.status,422);assert(bad.data.fields.whatsapp&&bad.data.fields.roles&&bad.data.fields.position);
 const ok=await admin('POST','/api/v1/admin/users',{name:'Ana Nueva',email:'ana@sesubasta.cl',whatsapp:'9 8765 4321',position:'Ejecutiva comercial',area:'Comercial',roles:['internal_contributor','operator']});assert.equal(ok.status,200);
 assert.equal(ok.data.user.whatsapp,'+56987654321');assert.deepEqual(ok.data.user.roles,['internal_contributor','operator']);assert.match(ok.data.whatsappLink,/^https:\/\/wa\.me\/56987654321\?text=/);
 assert(store.data.mail.some(m=>m.to==='ana@sesubasta.cl'&&m.subject.includes('Invitación')));assert(store.data.whatsapp.some(m=>m.to==='+56987654321'&&m.kind==='invite'));
 // Una persona del equipo puede tener además su cuenta de comprador con el mismo correo (accesos separados).
 const dual=await admin('POST','/api/v1/admin/users',{name:'Alex Dirección',email:'alex@comprador.demo.cl',whatsapp:'9 1111 2222',position:'Dirección',area:'Dirección',roles:['general_admin']});assert.equal(dual.status,200);
 assert.equal((await client()('POST','/api/v1/auth/login',{email:'alex@comprador.demo.cl',password:'Demo2026!'})).status,200,'su cuenta de comprador sigue funcionando');
 assert.equal((await admin('POST','/api/v1/admin/users',{name:'Alex Dirección',email:'alex@comprador.demo.cl',whatsapp:'9 1111 2222',position:'Dirección',roles:['general_admin']})).status,422,'no se duplica en el equipo');
 const colab=client(),legal=client(),editor=client();await colab('POST','/api/v1/admin/auth/login',{email:'colaborador@demo.cl',password:'Demo2026!'});await legal('POST','/api/v1/admin/auth/login',{email:'legal@demo.cl',password:'Demo2026!'});await editor('POST','/api/v1/admin/auth/login',{email:'editor@demo.cl',password:'Demo2026!'});
 assert.equal((await colab('POST','/api/v1/admin/tasks',{title:'x',assignees:[]})).status,422);
 const t=await colab('POST','/api/v1/admin/tasks',{title:'Cargar certificado de dominio',description:'Ficha SS-0021',assignees:['usr_legal'],priority:'alta',dueAt:Date.now()+3*3600000,link:{path:'/gestion/propiedades/21?tab=legal',label:'SS-0021'}});assert.equal(t.status,200);
 const id=t.data.task.id;assert.deepEqual(t.data.sent.email,['Legal Demo']);assert.deepEqual(t.data.sent.whatsapp,['Legal Demo']);assert.match(t.data.sent.links[0].url,/wa\.me\/56900000002/);
 assert(store.data.whatsapp.some(m=>m.taskId===id&&m.to==='+56900000002'&&m.text.includes('Cargar certificado')));
 assert.equal((await editor('GET','/api/v1/admin/tasks/'+id)).status,404,'quien no participa no ve la tarea');
 assert.equal((await client()('GET','/api/v1/admin/tasks')).status,401);
 assert.equal((await legal('PATCH','/api/v1/admin/tasks/'+id,{status:'cancelled'})).status,403,'el responsable no cancela la tarea de otro');
 const mailsBefore=store.data.mail.filter(m=>m.to==='colaborador@demo.cl').length;
 assert.equal((await legal('POST',`/api/v1/admin/tasks/${id}/comments`,{text:'Lo subo hoy en la tarde'})).status,200);
 assert.equal((await legal('PATCH','/api/v1/admin/tasks/'+id,{status:'done'})).status,200);
 assert(store.data.mail.filter(m=>m.to==='colaborador@demo.cl').length>=mailsBefore+2,'quien asignó recibe comentario y cierre');
 assert(store.data.whatsapp.some(m=>m.to==='+56900000003'&&m.text.includes('hecha')),'aviso de tarea hecha por WhatsApp');
 const mine=await legal('GET','/api/v1/admin/tasks?scope=mine&status=done');assert(mine.data.items.some(x=>x.id===id));
 const prof=await legal('PATCH','/api/v1/admin/me/profile',{name:'Legal Demo',whatsapp:'abc'});assert.equal(prof.status,422);
 await new Promise(r=>setTimeout(r,1200));assert(store.data.whatsapp.filter(m=>m.status==='local').length>0,'la bandeja de WhatsApp procesa los mensajes');
});

test('plantillas transaccionales: una por tipo, sintaxis de Brevo y envío con templateId',async()=>{
 const P=require('./servidor/plantillas.cjs');const D=require('./servidor/dominio.cjs');
 for(const k of Object.keys(P.TEMPLATES)){const t=P.brevoTemplate(k);assert.match(t.htmlContent,/\{\{ params\.titulo \}\}/);assert.match(t.htmlContent,/\{% for parrafo in params\.parrafos %\}/);assert.ok(t.templateName.startsWith('SeSubasta · '))}
 const db={mail:[],meta:{},users:[{id:'u1',email:'a@b.cl',status:'active',prefs:{}}],notifications:[]};
 D.notify(db,'u1',{type:'outbid',title:'Tu oferta fue superada',body:'Hay una oferta mayor.\nPuedes volver.',link:'/remates/x',cta:'Volver'});
 const m=db.mail[0];assert.equal(m.template,'monto_superado');const r=D.renderMail(m);assert.deepEqual(r.params.parrafos,['Hay una oferta mayor.','Puedes volver.']);assert.ok(r.params.baja.includes('/cancelar-alertas'));assert.match(r.html,/Te superaron/);assert.ok(!r.html.includes('{{'));
 D.mail(db,{to:'x@y.cl',subject:'<b>',body:'<script>',template:'codigo_acceso',code:'123456'});const h=D.renderMail(db.mail[0]).html;assert.ok(!h.includes('<script>')&&h.includes('123456'));
 const Mail=require('./servidor/correo.cjs');const prev={...process.env};process.env.BREVO_API_KEY='k';Mail.setFrom('SeSubasta <oficina@grupomm.cl>');let sent;const f=globalThis.fetch;globalThis.fetch=async(u,o)=>{sent=JSON.parse(o.body);return {ok:true}};
 try{await Mail.deliver({...m,...r,templateId:42});assert.equal(sent.templateId,42);assert.equal(sent.params.titulo,'Tu oferta fue superada');assert.equal(sent.htmlContent,undefined);await Mail.deliver({...m,...r});assert.ok(sent.htmlContent.includes('SeSubasta'))}finally{globalThis.fetch=f;process.env=prev;Mail.setFrom('')}});

test('portada "Muy pronto" con acceso del equipo: sin clave no se entra por URL directa',async()=>{
 const {gate}=require('./servidor/acceso.cjs');const req=(p,init)=>new Request('https://sesubasta.cl'+p,init);
 const home=await gate(req('/'),'clave-secreta');assert.equal(home.status,200);const html=await home.text();assert.match(html,/Muy pronto conocerás grandes/);assert.match(html,/instagram\.com\/sesubasta\.cl/);assert.ok(!/tiktok|linkedin|workers\.dev|clave-secreta/i.test(html));
 for(const p of ['/remates','/gestion','/admin-login','/dev/correos'])assert.equal((await gate(req(p),'clave-secreta')).status,401,p);
 assert.equal((await gate(req('/api/v1/config'),'clave-secreta')).status,401);assert.equal(await gate(req('/assets/propiedades/propiedad-16.webp'),'clave-secreta'),null);assert.notEqual(await gate(req('/assets/propiedades/propiedad-01.webp'),'clave-secreta'),null);
 const bad=await gate(req('/__acceso',{method:'POST',body:'password=otra&next=/gestion',headers:{'Content-Type':'application/x-www-form-urlencoded'}}),'clave-secreta',{ip:'t1'});assert.equal(bad.status,401);
 const ok=await gate(req('/__acceso',{method:'POST',body:'password=clave-secreta&next=/gestion',headers:{'Content-Type':'application/x-www-form-urlencoded'}}),'clave-secreta',{ip:'t1'});assert.equal(ok.status,303);const cookie=ok.headers.get('set-cookie').split(';')[0];
 assert.equal(await gate(req('/gestion',{headers:{cookie}}),'clave-secreta'),null);
 assert.deepEqual(Object.keys(store.data.config.social).sort(),['facebook','instagram']);
 // Solo la portada del dominio principal se indexa; workers.dev y el resto quedan fuera de buscadores.
 assert.match(html,/<meta name="robots" content="index,follow/);assert.match(html,/rel="canonical" href="https:\/\/sesubasta\.cl\/"/);assert.equal(home.headers.get('x-robots-tag'),null);
 const dev=await gate(new Request('https://sesubasta-remates.x.workers.dev/'),'clave-secreta');assert.match(await dev.text(),/noindex,nofollow/);assert.equal(dev.headers.get('x-robots-tag'),'noindex, nofollow');
 const robots=await (await gate(req('/robots.txt'),'clave-secreta')).text();assert.match(robots,/Allow: \/\$/);assert.match(robots,/Disallow: \//);assert.match(robots,/Sitemap: https:\/\/sesubasta\.cl\/sitemap\.xml/);
 assert.match(await (await gate(req('/sitemap.xml'),'clave-secreta')).text(),/<loc>https:\/\/sesubasta\.cl\/<\/loc>/);
 const www=await gate(new Request('https://www.sesubasta.cl/remates?x=1'),'clave-secreta');assert.equal(www.status,301);assert.equal(www.headers.get('location'),'https://sesubasta.cl/remates?x=1');
});

test('ubicar en el mapa: geocodifica al pedirlo, guarda coordenadas internas y publica el marcador solo si se autoriza',async()=>{
 const admin=client();await admin('POST','/api/v1/admin/auth/login',{email:'admin@demo.cl',password:'Demo2026!'});await admin('POST','/api/v1/admin/auth/mfa/verify',{code:lastMail('admin@demo.cl').code});
 const f=globalThis.fetch;let calls=0;globalThis.fetch=async(u,o)=>{if(String(u).startsWith('https://nominatim.openstreetmap.org/')){calls++;const q=new URL(u).searchParams.get('q');return new Response(JSON.stringify(q.includes('Inexistente')?[]:[{lat:'-33.4372',lon:'-70.6506',display_name:'Moneda 975, Santiago, Chile'}]),{status:200})}return f(u,o)};
 try{const miss=await admin('POST','/api/v1/admin/properties/1/geocode',{address:'Calle Inexistente 1'});assert.equal(miss.status,404);assert.match(miss.data.message,/No encontramos/);
  await new Promise(r=>setTimeout(r,1150));const hit=await admin('POST','/api/v1/admin/properties/1/geocode',{address:'Moneda 975'});assert.equal(hit.status,200);assert.equal(hit.data.result.lat,-33.4372);assert.equal(calls,2);
  assert.equal(store.data.properties.find(p=>p.id===1).geo,undefined,'buscar no guarda hasta confirmar');
  const saved=await admin('PATCH','/api/v1/admin/properties/1',{exactAddress:'Moneda 975',geo:hit.data.result,showExact:false});assert.equal(saved.status,200);const x=store.data.properties.find(p=>p.id===1);assert.equal(x.geo.lat,-33.4372);
  const D=require('./servidor/dominio.cjs');assert.equal(D.publicFields(x).exactLocation,false);assert.equal(D.publicFields(x).address,undefined);
  await admin('PATCH','/api/v1/admin/properties/1',{showExact:true});const pub=D.publicFields(store.data.properties.find(p=>p.id===1));assert.equal(pub.exactLocation,true);assert.equal(pub.lat,-33.4372);assert.equal(pub.address,'Moneda 975');
  await admin('PATCH','/api/v1/admin/properties/1',{exactAddress:'Otra dirección 123'});assert.equal(store.data.properties.find(p=>p.id===1).geo,null,'si cambia la dirección se descarta la ubicación');
  assert.equal((await admin('PATCH','/api/v1/admin/properties/1',{geo:{lat:48.85,lng:2.35,label:'París'}})).status,200);assert.equal(store.data.properties.find(p=>p.id===1).geo,null,'fuera de Chile no se guarda')}
 finally{globalThis.fetch=f}});

test('garantía por remate: exigida para ofertar, verificación del equipo, doble control y liberación al cierre',async()=>{
 const aid=Object.keys(engine.state.auctions).map(Number).find(id=>![2,6].includes(id)&&['open','scheduled'].includes(engine.status(engine.get(id)))&&!engine.get(id).bids.length&&store.data.properties.some(p=>p.auctionId===id&&p.publicStatus==='published'&&!p.conditions.guaranteeCLP));assert(aid,'hay una subasta libre');engine.state.auctions[String(aid)].start=Date.now()-1000;
 store.tx(d=>{const p=d.properties.find(x=>x.auctionId===aid);p.conditions.guaranteeCLP=1000000;p.live.conditions.guaranteeCLP=1000000});
 const alex=client(),camila=client(),oper=client(),admin=client();
 await alex('POST','/api/v1/auth/login',{email:'alex@comprador.demo.cl',password:'Demo2026!'});await camila('POST','/api/v1/auth/login',{email:'camila@comprador.demo.cl',password:'Demo2026!'});await oper('POST','/api/v1/admin/auth/login',{email:'operador@demo.cl',password:'Demo2026!'});
 await admin('POST','/api/v1/admin/auth/login',{email:'admin@demo.cl',password:'Demo2026!'});await admin('POST','/api/v1/admin/auth/mfa/verify',{code:lastMail('admin@demo.cl').code});
 const bid=(c,key)=>{const s=engine.snapshot(aid);return c('POST',`/api/v1/auctions/${aid}/bids`,{amountMinor:s.nextMinor,unit:'UF',termsVersion:s.termsVersion,key,expectedVersion:s.version,acceptTerms:true})};
 const blocked=await bid(camila,'garantia_c0');assert.equal(blocked.status,403);assert.equal(blocked.data.code,'GUARANTEE_REQUIRED');
 const account={holder:'Camila Demo',bank:'Banco Estado',accountType:'Cuenta vista / RUT',number:'12345678',ownAccount:true,acceptBases:true};
 const bad=await camila('POST',`/api/v1/auctions/${aid}/guarantee`,{...account,rut:'12.345.678-9'});assert.equal(bad.status,422);assert(bad.data.fields.rut);
 const open=async(c,rut)=>(await c('POST',`/api/v1/auctions/${aid}/guarantee`,{...account,rut})).data.guarantee;
 const gc=await open(camila,'12.345.678-5');assert.equal(gc.status,'pending');assert.equal(gc.amountCLP,1000000);assert(gc.refundAccount.number.startsWith('••••'),'la cuenta se muestra enmascarada');
 assert.equal((await camila('POST',`/api/v1/auctions/${aid}/guarantee`,{...account,rut:'12.345.678-5'})).status,409,'una garantía abierta por subasta');
 assert(store.data.mail.some(m=>m.to==='camila@comprador.demo.cl'&&m.template==='garantia'&&m.details.some(x=>x.valor===gc.code)),'instrucciones con el código por correo');
 assert.equal((await camila('POST',`/api/v1/me/guarantees/${gc.id}/report`,{operation:'OP-1'})).data.guarantee.status,'reported');
 assert(store.data.mail.some(m=>m.to==='operador@demo.cl'&&m.subject.includes(gc.code)),'el operador recibe el aviso para verificar');
 assert.equal((await alex('GET','/api/v1/admin/guarantees')).status,401,'un comprador no ve la gestión');
 assert.equal((await oper('POST',`/api/v1/admin/guarantees/${gc.id}/confirm`,{reference:'Cartola 1'})).data.code,'CHECK_REQUIRED');
 assert.equal((await oper('POST',`/api/v1/admin/guarantees/${gc.id}/confirm`,{reference:'Cartola 1',matches:true})).data.guarantee.status,'confirmed');
 const ga=await open(alex,'11.111.111-1');await alex('POST',`/api/v1/me/guarantees/${ga.id}/report`,{});await oper('POST',`/api/v1/admin/guarantees/${ga.id}/confirm`,{reference:'Cartola 2',matches:true});
 {const r=await bid(alex,'garantia_a1');assert.equal(r.status,200,JSON.stringify(r.data))}assert.equal((await bid(camila,'garantia_c1')).status,200);
 assert.equal((await oper('POST',`/api/v1/admin/guarantees/${ga.id}/retain`,{reason:'Prueba de permisos'})).status,409,'no se retiene una garantía confirmada antes del cierre');
 engine.state.auctions[String(aid)].end=Date.now()-1000;for(let i=0;i<40&&!store.data.awards[aid];i++)await new Promise(r=>setTimeout(r,100));assert(store.data.awards[aid],'el cierre calcula el resultado');
 const st=id=>store.data.guarantees.find(g=>g.id===id).status;assert.equal(st(gc.id),'held','primer lugar retenido');assert.equal(st(ga.id),'held','segundo lugar retenido');
 assert.equal((await oper('POST',`/api/v1/auctions/${aid}/award`,{action:'confirm'})).status,404);
 assert.equal((await oper('POST',`/api/v1/admin/auctions/${aid}/award`,{action:'confirm'})).status,200);
 assert.equal(st(gc.id),'applied','la del adjudicatario se abona al precio');assert.equal(st(ga.id),'refund_pending','la del segundo pasa a devolución');
 assert.equal((await oper('POST',`/api/v1/admin/guarantees/${ga.id}/refund`,{reference:'TRF-9'})).data.code,'FOUR_EYES','quien confirmó el ingreso no registra la devolución');
 assert.equal((await admin('POST',`/api/v1/admin/guarantees/${ga.id}/refund`,{reference:'TRF-9'})).data.guarantee.status,'refunded');
 assert(store.data.mail.some(m=>m.to==='alex@comprador.demo.cl'&&m.subject.startsWith('Devolvimos tu garantía')),'aviso de devolución');
 assert(store.data.audit.filter(a=>a.entity==='guarantee'&&a.entityId===ga.code).length>=5,'cada cambio queda en auditoría');
 const mine=(await alex('GET','/api/v1/me/guarantees')).data.items;assert(mine.some(g=>g.id===ga.id&&g.status==='refunded'));assert(!mine.some(g=>g.id===gc.id),'cada persona ve solo sus garantías');
});
