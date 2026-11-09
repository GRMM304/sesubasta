/* Garantía de seriedad por remate (sin billetera).
   La persona transfiere la garantía a la cuenta bancaria de SeSubasta con un código único; el equipo la confirma contra la
   cartola y recién entonces puede ofertar. Al cierre se retiene la del primero y la del segundo (por si las bases permiten
   ofrecerle la adjudicación) y las demás pasan a devolución. SeSubasta nunca mantiene saldos: cada garantía se abona al precio,
   se devuelve a la cuenta del mismo titular o se retiene por incumplimiento con decisión del Administrador general.
   Cada cambio queda en el historial de la garantía y en la auditoría. */
const S=require('./seguridad.cjs');
const D=require('./dominio.cjs');

const STATUS={pending:'Esperando transferencia',reported:'Transferencia informada · en verificación',confirmed:'Confirmada · habilitada para ofertar',rejected:'Transferencia no encontrada',held:'Retenida hasta la adjudicación',applied:'Abonada al precio',refund_pending:'Devolución en curso',refunded:'Devuelta',retained:'Retenida por incumplimiento',cancelled:'Anulada'};
const OPEN=['pending','reported','confirmed','rejected','held','refund_pending'];
const BANKS=['Banco de Chile','Banco Estado','Banco Santander','Banco BCI','Banco Itaú','Scotiabank','Banco BICE','Banco Security','Banco Falabella','Banco Ripley','Banco Consorcio','Banco Internacional','Coopeuch','Tenpo','Mercado Pago','Otro'];
const ACCOUNT_TYPES=['Cuenta corriente','Cuenta vista / RUT','Cuenta de ahorro'];

/* RUT chileno con dígito verificador (módulo 11). Devuelve el RUT normalizado (12345678-5) o null. */
function rut(v){const s=String(v||'').replace(/[.\s]/g,'').toUpperCase();const m=/^(\d{7,8})-?([\dK])$/.exec(s);if(!m)return null;let sum=0,mul=2;for(let i=m[1].length-1;i>=0;i--){sum+=Number(m[1][i])*mul;mul=mul===7?2:mul+1}const r=11-(sum%11);const dv=r===11?'0':r===10?'K':String(r);return dv===m[2]?`${m[1]}-${dv}`:null}
const clp=n=>'$'+Math.round(n).toLocaleString('es-CL');
const mask=n=>{const s=String(n||'');return s.length>4?'•••• '+s.slice(-4):s};

function install({route,db,store,engine,buyer,staff,fail,str,limit,auctionProperty,broadcast}){
 const amountFor=p=>Number(p?.live?.conditions?.guaranteeCLP)||0;
 const bank=()=>db().config.guaranteeBank||{};
 const find=id=>{const g=(db().guarantees||[]).find(x=>x.id===id);if(!g)fail(404,'NOT_FOUND','Garantía no encontrada.');return g};
 const forBuyer=(g,withAccount=false)=>{const p=auctionProperty(g.auctionId);return {id:g.id,code:g.code,auctionId:g.auctionId,amountCLP:g.amountCLP,status:g.status,statusLabel:STATUS[g.status],createdAt:g.createdAt,reportedAt:g.reportedAt||null,confirmedAt:g.confirmedAt||null,refundedAt:g.refundedAt||null,refundRef:g.refundRef||'',note:g.publicNote||'',
  refundAccount:{...g.refundAccount,number:withAccount?g.refundAccount.number:mask(g.refundAccount.number)},property:p?{title:p.title,slug:p.slug,publicId:p.publicId}:null}};
 const userName=id=>db().users.find(u=>u.id===id)?.name||'—';
 const forStaff=g=>({...forBuyer(g,true),user:(()=>{const u=db().users.find(x=>x.id===g.userId);return u?{id:u.id,name:u.name,email:u.email,phone:u.phone||''}:null})(),operation:g.operation||'',history:g.history.map(h=>({...h,byName:h.by?userName(h.by):'Sistema'})),confirmedByName:g.confirmedBy?userName(g.confirmedBy):''});
 /* Cambio de estado único: historial, auditoría y aviso a la persona en la misma transacción.
    Los avisos sobre dinero van como mensajes de cuenta: se envían siempre, aunque la persona se dé de baja de las alertas. */
 function move(d,g,to,{by=null,reason='',requestId='',notice,publicNote}={}){const from=g.status;g.status=to;g.updatedAt=Date.now();if(publicNote!==undefined)g.publicNote=publicNote;g.history.push({from,to,by,reason,at:Date.now()});D.audit(d,by,'guarantee.'+to,'guarantee',g.code,{from,to,reason,auctionId:g.auctionId},requestId);
  if(notice){const p=auctionProperty(g.auctionId);D.notify(d,g.userId,{type:'guarantee',category:'account',template:'garantia',cta:notice.cta||'Ver mis garantías',title:`${notice.title} · ${p?.title||'Garantía '+g.code}`,heading:notice.title,body:notice.body,link:notice.link||'/mi-cuenta/garantias',details:[{etiqueta:'Código',valor:g.code},{etiqueta:'Monto',valor:clp(g.amountCLP)},{etiqueta:'Propiedad',valor:p?.title||''},{etiqueta:'Estado',valor:STATUS[to]}]})}}

 /* ---------- comprador ---------- */
 route('GET','/api/v1/me/guarantees',ctx=>{const u=buyer(ctx);return {items:(db().guarantees||[]).filter(g=>g.userId===u.id).map(g=>forBuyer(g)),bank:bank()}});
 route('GET','/api/v1/me/guarantees/auction/:id',(ctx,{id})=>{const u=buyer(ctx);const p=auctionProperty(id);const g=(db().guarantees||[]).find(x=>x.userId===u.id&&x.auctionId===Number(id)&&OPEN.concat('applied','refunded','retained').includes(x.status)&&x.status!=='cancelled');
  return {required:amountFor(p)>0,amountCLP:amountFor(p),guarantee:g?forBuyer(g):null,bank:bank(),banks:BANKS,accountTypes:ACCOUNT_TYPES}});
 route('POST','/api/v1/auctions/:id/guarantee',(ctx,{id})=>{const u=buyer(ctx);limit(ctx,'gar:'+u.id,6,3600000);const p=auctionProperty(id);
  if(!p||p.publicStatus!=='published'||p.auctionId!==Number(id))fail(404,'NOT_FOUND','La subasta no existe.');const amount=amountFor(p);if(!amount)fail(409,'NOT_REQUIRED','Esta subasta no exige garantía.');
  if(u.status!=='active')fail(403,'ACCOUNT_INACTIVE','Tu cuenta no está activa.');if(!u.emailVerifiedAt)fail(403,'EMAIL_NOT_VERIFIED','Verifica tu correo antes de constituir la garantía.');
  const s=engine.status(engine.get(id));if(['closed','cancelled'].includes(s))fail(409,'AUCTION_NOT_OPEN','La subasta ya no recibe garantías.');
  if((db().guarantees||[]).some(g=>g.userId===u.id&&g.auctionId===Number(id)&&OPEN.includes(g.status)))fail(409,'EXISTS','Ya tienes una garantía para esta subasta.');
  const b=ctx.body,errors={};const holder=str(b.holder,120),r=rut(b.rut),bankName=str(b.bank,60),type=str(b.accountType,40),number=str(b.number,30).replace(/[\s.-]/g,'');
  if(holder.length<5)errors.holder='Ingresa el nombre completo del titular.';if(!r)errors.rut='Ingresa un RUT válido, por ejemplo 12.345.678-5.';if(!BANKS.includes(bankName))errors.bank='Selecciona el banco.';if(!ACCOUNT_TYPES.includes(type))errors.accountType='Selecciona el tipo de cuenta.';if(!/^\d{4,20}$/.test(number))errors.number='Ingresa solo los números de la cuenta.';
  if(b.ownAccount!==true)errors.ownAccount='La cuenta de devolución debe estar a tu nombre.';if(b.acceptBases!==true)errors.acceptBases='Acepta las condiciones de la garantía.';
  if(Object.keys(errors).length)fail(422,'VALIDATION_ERROR','Revisa los campos marcados.',{fields:errors});
  let g;store.tx(d=>{d.guarantees=d.guarantees||[];g={id:S.id('gar'),code:S.referenceCode('GAR'),userId:u.id,propertyId:p.id,auctionId:Number(id),amountCLP:amount,status:'pending',refundAccount:{holder,rut:r,bank:bankName,accountType:type,number},termsVersion:d.config.termsVersion,createdAt:Date.now(),history:[{from:null,to:'pending',by:u.id,reason:'Solicitud de la persona',at:Date.now()}]};d.guarantees.unshift(g);D.audit(d,u.id,'guarantee.create','guarantee',g.code,{auctionId:g.auctionId,amountCLP:amount},ctx.requestId);
   const k=d.config.guaranteeBank||{};D.notify(d,u.id,{type:'guarantee',category:'account',template:'garantia',cta:'Ver instrucciones',title:`Instrucciones para tu garantía · ${p.title}`,heading:'Transfiere tu garantía',body:`Transfiere exactamente ${clp(amount)} desde una cuenta a tu nombre e incluye el código ${g.code} en el comentario de la transferencia.\nCuando la hayas hecho, avísanos desde Mi cuenta → Garantías. El equipo la confirma y te habilita para ofertar.`,link:'/mi-cuenta/garantias',details:[{etiqueta:'Código para el comentario',valor:g.code},{etiqueta:'Monto',valor:clp(amount)},{etiqueta:'Banco',valor:k.bank||'Te lo enviará el equipo'},{etiqueta:'Tipo y número',valor:k.number?`${k.accountType||''} ${k.number}`.trim():'—'},{etiqueta:'Titular',valor:k.holder?`${k.holder} · RUT ${k.rut||''}`:'—'}]})});
  return {guarantee:forBuyer(g),bank:bank()}});
 route('POST','/api/v1/me/guarantees/:id/report',(ctx,{id})=>{const u=buyer(ctx);const g=find(id);if(g.userId!==u.id)fail(404,'NOT_FOUND','Garantía no encontrada.');if(!['pending','rejected'].includes(g.status))fail(409,'INVALID_STATE','Esta garantía ya fue informada.');const op=str(ctx.body.operation,60);
  store.tx(d=>{const x=d.guarantees.find(v=>v.id===g.id);x.operation=op;x.reportedAt=Date.now();move(d,x,'reported',{by:u.id,reason:op?'N° de operación '+op:'Transferencia informada',requestId:ctx.requestId});const p=auctionProperty(x.auctionId);
   D.notifyStaff(d,['operator'],{title:`Garantía por verificar ${x.code} · ${clp(x.amountCLP)}`,body:`${u.name} informó la transferencia de la garantía para "${p?.title||''}". Revisa la cartola y confírmala o recházala.`,link:'/gestion/garantias?status=reported',details:[{etiqueta:'Código',valor:x.code},{etiqueta:'Monto',valor:clp(x.amountCLP)},{etiqueta:'N° de operación',valor:op||'—'}]})});return {guarantee:forBuyer(find(id))}});
 route('POST','/api/v1/me/guarantees/:id/cancel',(ctx,{id})=>{const u=buyer(ctx);const g=find(id);if(g.userId!==u.id)fail(404,'NOT_FOUND','Garantía no encontrada.');if(g.status!=='pending')fail(409,'INVALID_STATE','Solo puedes anular una garantía que aún no transfieres. Si ya transferiste, escríbenos.');
  store.tx(d=>move(d,d.guarantees.find(v=>v.id===g.id),'cancelled',{by:u.id,reason:'Anulada por la persona',requestId:ctx.requestId}));return {guarantee:forBuyer(find(id))}});

 /* ---------- equipo ---------- */
 route('GET','/api/v1/admin/guarantees',ctx=>{staff(ctx,'operator');let rows=db().guarantees||[];const counts=Object.fromEntries(Object.keys(STATUS).map(k=>[k,rows.filter(g=>g.status===k).length]));if(ctx.query.status)rows=rows.filter(g=>g.status===ctx.query.status);if(ctx.query.auction)rows=rows.filter(g=>g.auctionId===Number(ctx.query.auction));
  const q=str(ctx.query.q,80).toLowerCase();let out=rows.map(forStaff);if(q)out=out.filter(g=>(g.code+' '+(g.user?.name||'')+' '+(g.user?.email||'')+' '+g.refundAccount.rut+' '+(g.property?.title||'')).toLowerCase().includes(q));
  return {items:out.slice(0,300),counts,labels:STATUS,bank:bank()}});
 /* Acciones del equipo. La devolución la registra una persona distinta de quien confirmó el ingreso (doble control),
    y retener una garantía por incumplimiento es decisión exclusiva del Administrador general. */
 const ACTIONS={confirm:{from:['pending','reported','rejected'],to:'confirmed'},reject:{from:['reported'],to:'rejected'},refund:{from:['refund_pending'],to:'refunded'},release:{from:['held','confirmed'],to:'refund_pending'},retain:{from:['held'],to:'retained'},void:{from:['pending','reported','rejected','refund_pending'],to:'cancelled'}};
 route('POST','/api/v1/admin/guarantees/:id/:action',(ctx,{id,action})=>{const u=staff(ctx,'operator');const A=ACTIONS[action];if(!A)fail(404,'NOT_FOUND','Acción no disponible.');const g=find(id);if(!A.from.includes(g.status))fail(409,'INVALID_STATE',`No se puede pasar de "${STATUS[g.status]}" a "${STATUS[A.to]}".`);
  const reason=str(ctx.body.reason,500),ref=str(ctx.body.reference,80);
  if(action==='retain'&&!D.has(u))fail(403,'FORBIDDEN','Solo el Administrador general decide retener una garantía.');
  if(['reject','release','retain','void'].includes(action)&&reason.length<5)fail(422,'REASON_REQUIRED','Indica el motivo.',{fields:{reason:'Indica el motivo.'}});
  if(['confirm','refund'].includes(action)&&ref.length<4)fail(422,'REFERENCE_REQUIRED','Indica la referencia bancaria.',{fields:{reference:action==='confirm'?'Indica el N° de operación o la fecha y glosa de la cartola.':'Indica el N° de operación de la transferencia de devolución.'}});
  if(action==='refund'&&g.confirmedBy===u.id)fail(409,'FOUR_EYES','La devolución la registra una persona distinta de quien confirmó el ingreso.');
  if(action==='confirm'&&ctx.body.matches!==true)fail(422,'CHECK_REQUIRED','Confirma que el monto y el titular coinciden con la cartola.',{fields:{matches:'Revisa monto, código y titular antes de confirmar.'}});
  store.tx(d=>{const x=d.guarantees.find(v=>v.id===g.id);const p=auctionProperty(x.auctionId);const room=`/remates/${p?.slug||''}/ofertar`;
   if(action==='confirm'){x.confirmedBy=u.id;x.confirmedAt=Date.now();x.depositRef=ref;move(d,x,'confirmed',{by:u.id,reason:'Ingreso verificado · '+ref,requestId:ctx.requestId,publicNote:'',notice:{title:'Garantía confirmada',body:`Recibimos tu garantía. Ya puedes ofertar en "${p?.title||''}" hasta el cierre.`,link:room,cta:'Ir a la sala'}})}
   if(action==='reject')move(d,x,'rejected',{by:u.id,reason,requestId:ctx.requestId,publicNote:reason,notice:{title:'No encontramos tu transferencia',body:`No pudimos verificar la transferencia de tu garantía. Motivo: ${reason}\nRevisa el monto, la cuenta de destino y que el comentario incluya el código ${x.code}, y vuelve a informarla.`}});
   if(action==='refund'){x.refundedBy=u.id;x.refundedAt=Date.now();x.refundRef=ref;move(d,x,'refunded',{by:u.id,reason:'Devolución transferida · '+ref,requestId:ctx.requestId,notice:{title:'Devolvimos tu garantía',body:`Transferimos ${clp(x.amountCLP)} a tu cuenta ${x.refundAccount.bank} ${mask(x.refundAccount.number)}. N° de operación: ${ref}. Según tu banco, puede tardar hasta 1 día hábil en verse reflejado.`}})}
   if(action==='release')move(d,x,'refund_pending',{by:u.id,reason,requestId:ctx.requestId,notice:{title:'Liberamos tu garantía',body:`Tu garantía quedó liberada y la devolveremos a tu cuenta ${x.refundAccount.bank} ${mask(x.refundAccount.number)}.`}});
   if(action==='retain')move(d,x,'retained',{by:u.id,reason,requestId:ctx.requestId,publicNote:reason,notice:{title:'Garantía retenida',body:`Según las bases del remate, tu garantía quedó retenida. Motivo: ${reason}\nSi tienes dudas, responde este correo o escríbenos desde Contacto.`}});
   if(action==='void')move(d,x,'cancelled',{by:u.id,reason,requestId:ctx.requestId,publicNote:reason})});
  return {guarantee:forStaff(find(id))}});

 /* ---------- reglas automáticas ---------- */
 const confirmedFor=(userId,auctionId)=>(db().guarantees||[]).some(g=>g.userId===userId&&g.auctionId===Number(auctionId)&&g.status==='confirmed');
 /* Requisito para ofertar: solo si la versión publicada de la ficha define un monto de garantía. */
 function requireFor(u,auctionId){const p=auctionProperty(auctionId);if(amountFor(p)>0&&!confirmedFor(u.id,auctionId))fail(403,'GUARANTEE_REQUIRED','Para ofertar en esta propiedad necesitas una garantía confirmada.')}
 /* Al cierre: primero y segundo quedan retenidos; el resto pasa a devolución. Las no transferidas se anulan. */
 function onClose(d,aid,ranking){const keep=new Set([ranking.best?.buyer,ranking.runner?.buyer].filter(Boolean));for(const g of (d.guarantees||[]).filter(x=>x.auctionId===Number(aid))){
  if(g.status==='pending')move(d,g,'cancelled',{reason:'La subasta cerró sin transferencia'});
  else if(g.status==='confirmed'&&keep.has(g.userId))move(d,g,'held',{reason:g.userId===ranking.best?.buyer?'Primer lugar al cierre':'Segundo lugar al cierre',notice:{title:'Tu garantía queda retenida por ahora',body:g.userId===ranking.best?.buyer?'Tu oferta fue la más alta al cierre. La garantía se mantiene hasta confirmar la adjudicación y luego se abona al precio.':'Quedaste en segundo lugar. Según las bases, mantenemos tu garantía hasta confirmar la adjudicación; después la devolvemos.'}});
  else if(['confirmed','reported','rejected'].includes(g.status))move(d,g,'refund_pending',{reason:g.status==='confirmed'?'No quedó entre los dos primeros':'Cierre con transferencia sin confirmar: verificar si llegó',notice:g.status==='confirmed'?{title:'Devolveremos tu garantía',body:`La subasta cerró y tu oferta no fue la más alta. Devolveremos ${clp(g.amountCLP)} a tu cuenta ${g.refundAccount.bank} ${mask(g.refundAccount.number)} dentro de ${d.config.guaranteeBank?.refundDays||3} días hábiles.`}:undefined})}
  const n=(d.guarantees||[]).filter(x=>x.auctionId===Number(aid)&&x.status==='refund_pending').length;if(n)D.notifyStaff(d,['operator'],{title:`${n} garantía(s) por devolver · subasta ${aid}`,body:'La subasta cerró. Transfiere las devoluciones a la cuenta registrada por cada persona y registra el N° de operación.',link:'/gestion/garantias?status=refund_pending'})}
 /* Adjudicación confirmada: la garantía del adjudicatario se abona al precio y la otra retenida se libera. */
 function onAward(d,aid,w){if(w.status!=='confirmed')return;const winner=w.current==='runner'?w.runnerBuyer:w.bestBuyer;for(const g of (d.guarantees||[]).filter(x=>x.auctionId===Number(aid)&&x.status==='held')){
  if(g.userId===winner)move(d,g,'applied',{reason:'Adjudicación confirmada',notice:{title:'Tu garantía se abonó al precio',body:'La adjudicación fue confirmada. El monto de tu garantía se descuenta del precio; el equipo te contactará con los próximos pasos.'}});
  else move(d,g,'refund_pending',{reason:'Adjudicación confirmada a otra persona',notice:{title:'Devolveremos tu garantía',body:`La adjudicación se confirmó. Devolveremos ${clp(g.amountCLP)} a tu cuenta ${g.refundAccount.bank} ${mask(g.refundAccount.number)}.`}})}}
 /* Subasta cancelada: todo lo recibido se devuelve. */
 function onCancel(d,aid){for(const g of (d.guarantees||[]).filter(x=>x.auctionId===Number(aid))){if(g.status==='pending')move(d,g,'cancelled',{reason:'Subasta cancelada'});else if(['confirmed','held','reported','rejected'].includes(g.status))move(d,g,'refund_pending',{reason:'Subasta cancelada',notice:g.status==='rejected'?undefined:{title:'Devolveremos tu garantía',body:`La subasta fue cancelada. Devolveremos ${clp(g.amountCLP)} a tu cuenta ${g.refundAccount.bank} ${mask(g.refundAccount.number)}.`}})}}
 return {requireFor,onClose,onAward,onCancel}}

module.exports={install,rut,STATUS,BANKS,ACCOUNT_TYPES};
