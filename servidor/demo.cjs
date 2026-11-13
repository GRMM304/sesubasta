/* Reinicio de las subastas de demostración: las 20 propiedades de prueba vuelven a su programación de muestra (demoPlan).
   Solo toca lo que es de demostración (propiedades marcadas demo y sus subastas, intentos, resultados y garantías);
   no cambia usuarios, configuración, correo, analítica ni la cuenta de garantías. */
const D=require('./dominio.cjs');
const ROWS=()=>require('../fuentes/propiedades.json');
const HOUR=3600000,DAY=24*HOUR;

/* Subastas de muestra de a una (nov. 2026), con inicio y cierre en horas exactas: 3 cerradas con ofertas,
   1 abierta, 1 suspendida y el resto próximas en días seguidos. */
const OPEN=2,CLOSED=[19,13,17],PAUSED=20,PAUSE_REASON='Revisión de un antecedente informado. Se comunicará la nueva fecha.';
function demoPlan(rows,now=Date.now(),liveMinutes=0){const base=Math.floor(now/HOUR)*HOUR;const openEnd=base+Math.max(1,Math.round((liveMinutes||1440)/60))*HOUR;const plan={};
 const min=id=>Math.round(rows.find(r=>r.id===id).minUF*100);
 plan[OPEN]={start:base-HOUR,end:openEnd,bids:[]};
 CLOSED.forEach((id,k)=>{const end=base-HOUR-k*DAY,start=end-DAY,m=min(id);plan[id]={start,end,bids:[['camila',m,start+2*HOUR],['alex',m+5000,start+6*HOUR],['camila',m+15000,start+11*HOUR]]}});
 plan[PAUSED]={start:openEnd,end:openEnd+DAY,bids:[],paused:PAUSE_REASON};
 rows.map(r=>r.id).filter(id=>!plan[id]).sort((a,b)=>a-b).forEach((id,k)=>{const start=openEnd+(k+1)*DAY;plan[id]={start,end:start+DAY,bids:[]}});
 return plan}
/* Aplica el plan a una subasta: fechas, ofertas registradas y suspensión. */
function applyPlan(a,pl,now=Date.now()){a.start=pl.start;a.end=pl.end;
 for(const [buyer,amountMinor,time] of pl.bids){a.sequence++;a.version++;const b={id:a.id,buyer,amountMinor,unit:'UF',termsVersion:a.termsVersion,receipt:`SS-DEMO-${a.id}-${a.sequence}`,time,sequence:a.sequence};a.bids.push(b);a.keys[buyer+':seed_'+a.sequence]=b;a.currentMinor=amountMinor}
 if(pl.paused){a.status='paused';a.publicReason=pl.paused;a.events.push({type:'suspended',reason:pl.paused,actor:'usr_oper',time:now-30*60000})}
 return a}

function resetDemo(d,now=Date.now()){
 const rows=new Map(ROWS().map(r=>[r.id,r]));const ids=new Set();const plan=demoPlan(ROWS(),now,Number(process.env.DEMO_LIVE_MINUTES)||0);
 d.properties.filter(p=>p.demo&&p.auctionId&&rows.has(p.id)).forEach((p,i)=>{const r=rows.get(p.id);const aid=String(p.auctionId);ids.add(aid);
  const pl=plan[p.id]||{start:now+DAY*(30+i),end:now+DAY*(31+i),bids:[]};const {start,end}=pl;
  const a={id:p.auctionId,start,end,status:'scheduled',initialMinor:Math.round(r.minUF*100),currentMinor:Math.round(r.minUF*100),incrementMinor:5000,unit:'UF',termsVersion:d.config.termsVersion,version:0,sequence:0,bids:[],keys:{},events:[]};
  // La ficha destacada del mockup llega con 3 ofertas registradas desde su precio inicial.
  const m2=Math.round(r.minUF*100);if(p.id===2)[['camila',m2,50],['alex',m2+5000,30],['camila',m2+10000,10]].forEach(([buyer,amountMinor,ago])=>{a.sequence++;a.version++;const b={id:a.id,buyer,amountMinor,unit:'UF',termsVersion:a.termsVersion,receipt:`SS-DEMO-${a.id}-${a.sequence}`,time:now-ago*60000,sequence:a.sequence};a.bids.push(b);a.keys[buyer+':seed_'+a.sequence]=b;a.currentMinor=amountMinor});
  applyPlan(a,{...pl,bids:p.id===2?[]:pl.bids},now);
  d.subastas.auctions[aid]=a;
  // Garantía de seriedad de Dirección (nov. 2026): $1.000.000 por propiedad (la de prueba de $5.000 se mantiene).
  if(p.conditions?.guaranteeCLP===5000000)p.conditions.guaranteeCLP=1000000;
  // Documentos públicos de muestra (tasación, GP, bases y condiciones) y los privados que ya tenía.
  p.documents=[...(p.documents||[]).filter(x=>x.visibility!=='public'),...demoDocs(p.id,now)];
  Object.assign(p,{title:r.title,occupancy:r.occupancy,connectivity:r.connectivity||'',appreciation:r.appreciation||'',appraisalUF:r.appraisalUF??null,mortgage:r.mortgage===true,conditions:{...p.conditions,opensAt:start,closesAt:end,initialUF:r.minUF,incrementUF:50},reviewStatus:'approved',publicStatus:'published',updatedAt:now});
  p.live=D.publicFields(p)});
 d.attempts=d.attempts.filter(x=>!ids.has(String(x.auctionId)));
 for(const aid of ids)delete d.awards[aid];
 // Garantías de prueba: se descartan las de estas subastas y se vuelve a dejar la confirmada de Alex (flujo de garantía).
 d.guarantees=(d.guarantees||[]).filter(g=>!ids.has(String(g.auctionId)));
 const withGuarantee=d.properties.find(p=>p.demo&&ids.has(String(p.auctionId))&&p.conditions.guaranteeCLP);
 if(withGuarantee&&d.users.some(u=>u.id==='alex'))d.guarantees.push({id:'gar_demo1',code:'GAR-DEMO0001',userId:'alex',propertyId:withGuarantee.id,auctionId:withGuarantee.auctionId,amountCLP:withGuarantee.conditions.guaranteeCLP,status:'confirmed',refundAccount:{holder:'Alex Demo',rut:'11111111-1',bank:'Banco Estado',accountType:'Cuenta vista / RUT',number:'11111111'},termsVersion:d.config.termsVersion,createdAt:now,reportedAt:now,operation:'DEMO-123',confirmedBy:'usr_oper',confirmedAt:now,depositRef:'Cartola demo',history:[{from:'reported',to:'confirmed',by:'usr_oper',reason:'Ingreso verificado · Cartola demo',at:now}]});
 D.audit(d,'system','demo.reset','auction','demo',{auctions:ids.size,reason:'Subastas de prueba disponibles otra vez'});
 return ids.size}
/* Documentos públicos de muestra (nov. 2026): tasación, certificado de prohibiciones y gravámenes (GP) y bases y condiciones.
   Sus archivos se generan al pedirlos (clave demo-doc:tipo:id), así no ocupan almacenamiento. */
const DEMO_DOCS=[['tasacion','Tasación','Informe de tasación (demostración).pdf'],['gp','Certificado de prohibiciones y gravámenes','Certificado de hipotecas, gravámenes y prohibiciones (demostración).pdf'],['bases','Bases y condiciones','Bases y condiciones de la oportunidad (demostración).pdf']];
function demoDocs(id,now=Date.now()){return DEMO_DOCS.map(([k,type,name])=>({id:`doc_${k}_${id}`,key:`demo-doc:${k}:${id}`,name,type,visibility:'public',uploadedBy:'usr_legal',at:now,mime:'application/pdf'}))}
function demoDocPdf(key){const [,k,id]=String(key).split(':');const r=ROWS().find(x=>String(x.id)===id);const t=DEMO_DOCS.find(x=>x[0]===k);if(!r||!t)return null;const {makePdf}=require('./semilla.cjs');
 const lines={tasacion:[`Propiedad: ${r.title}`,`Valor de tasacion: ${r.appraisalUF} UF`,'Tasacion ilustrativa de demostracion.'],gp:[`Propiedad: ${r.title}`,'Sin hipotecas, gravamenes ni prohibiciones vigentes (demostracion).','Documento ficticio sin validez legal.'],bases:[`Propiedad: ${r.title}`,`Precio inicial: ${r.minUF} UF. Incremento: 50 UF. Unidad contractual: UF.`,'Garantia de seriedad por propiedad. Cierre fijo sin extension automatica.','Si ganas, tienes 48 horas para pagar los gastos operacionales.','Documento ficticio. No tiene validez legal.']}[k];
 return makePdf(`${t[1]} - documento de demostracion`,lines)}
module.exports={resetDemo,demoPlan,applyPlan,demoDocs,demoDocPdf};
