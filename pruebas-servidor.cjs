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

test('registro, verificación obligatoria para subastar y separación de audiencias',async()=>{const c=client();
 const bad=await c('POST','/api/v1/auth/register',{name:'X',email:'no',password:'corta',password2:'otra'});assert.equal(bad.status,422);assert(bad.data.fields.email&&bad.data.fields.password&&bad.data.fields.acceptTerms);
 const r=await c('POST','/api/v1/auth/register',{name:'Persona Prueba',email:'Persona@Ejemplo.cl',password:'ClaveSegura123',password2:'ClaveSegura123',acceptTerms:true,roles:['general_admin']});assert.equal(r.status,200);assert.deepEqual(r.data.user.roles,['buyer']);assert.equal(r.data.user.emailVerified,false);
 assert.equal((await c('POST','/api/v1/auth/register',{name:'Otra',email:'persona@ejemplo.cl',password:'ClaveSegura123',password2:'ClaveSegura123',acceptTerms:true})).status,409);
 const s=engine.snapshot(6);const blocked=await c('POST','/api/v1/auctions/6/bids',{amountMinor:s.nextMinor,unit:'UF',termsVersion:s.termsVersion,key:'unverified_1',expectedVersion:s.version});assert.equal(blocked.status,403);assert.equal(blocked.data.code,'EMAIL_NOT_VERIFIED');
 const token=new URL(lastMail('Persona@Ejemplo.cl').link).searchParams.get('token');assert.equal((await c('POST','/api/v1/auth/verify-email',{token})).status,200);assert.equal((await c('POST','/api/v1/auth/verify-email',{token})).data.code,'TOKEN_USED');
 const ok=await c('POST','/api/v1/auctions/6/bids',{amountMinor:s.nextMinor,unit:'UF',termsVersion:s.termsVersion,key:'verified_1',expectedVersion:s.version});assert.equal(ok.status,200);
 assert.equal((await c('GET','/api/v1/admin/summary')).status,401,'la sesión pública no abre el panel interno');
 const staff=client();const staffOnPublic=await staff('POST','/api/v1/auth/login',{email:'colaborador@demo.cl',password:'Demo2026!'});assert.equal(staffOnPublic.status,401);assert.equal(staffOnPublic.data.message,'El correo o la contraseña no son correctos.');
});

test('MFA del administrador, permisos por rol y publicación solo por Administrador general',async()=>{const colab=client(),admin=client(),legal=client(),editor=client();
 assert.equal((await colab('POST','/api/v1/admin/auth/login',{email:'colaborador@demo.cl',password:'Demo2026!'})).status,200);
 const step=await admin('POST','/api/v1/admin/auth/login',{email:'admin@demo.cl',password:'Demo2026!'});assert.equal(step.data.mfaRequired,true);assert.equal((await admin('GET','/api/v1/admin/summary')).status,401);
 assert.equal((await admin('POST','/api/v1/admin/auth/mfa/verify',{code:'000000'})).status,401);const code=lastMail('admin@demo.cl').body.match(/\d{6}/)[0];assert.equal((await admin('POST','/api/v1/admin/auth/mfa/verify',{code})).status,200);
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

test('suspensión con motivo bloquea montos; SEO y rutas privadas con noindex',async()=>{const oper=client();await oper('POST','/api/v1/admin/auth/login',{email:'operador@demo.cl',password:'Demo2026!'});
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
