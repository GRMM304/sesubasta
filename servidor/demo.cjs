/* Reinicio de las subastas de demostración (oct. 2026): las 20 propiedades de prueba vuelven a estar en vivo.
   Solo toca lo que es de demostración (propiedades marcadas demo y sus subastas, intentos, resultados y garantías);
   no cambia usuarios, configuración, correo, analítica ni la cuenta de garantías. */
const D=require('./dominio.cjs');
const ROWS=()=>require('../fuentes/propiedades.json');
const HOUR=3600000;

function resetDemo(d,now=Date.now()){
 const rows=new Map(ROWS().map(r=>[r.id,r]));const ids=new Set();
 d.properties.filter(p=>p.demo&&p.auctionId&&rows.has(p.id)).forEach((p,i)=>{const r=rows.get(p.id);const aid=String(p.auctionId);ids.add(aid);
  // Cierres escalonados entre ~1 y ~3 días para que siempre haya subastas en vivo que probar.
  const start=now-60000,end=now+(28+i*2)*HOUR+(p.id===2?-HOUR:0);
  const a={id:p.auctionId,start,end,status:'scheduled',initialMinor:Math.round(r.minUF*100),currentMinor:Math.round(r.minUF*100),incrementMinor:5000,unit:'UF',termsVersion:d.config.termsVersion,version:0,sequence:0,bids:[],keys:{},events:[]};
  // La ficha destacada del mockup llega con 3 ofertas registradas (3.800, 3.850 y 3.900 UF).
  if(p.id===2)[['camila',380000,50],['alex',385000,30],['camila',390000,10]].forEach(([buyer,amountMinor,ago])=>{a.sequence++;a.version++;const b={id:a.id,buyer,amountMinor,unit:'UF',termsVersion:a.termsVersion,receipt:`SS-DEMO-${a.id}-${a.sequence}`,time:now-ago*60000,sequence:a.sequence};a.bids.push(b);a.keys[buyer+':seed_'+a.sequence]=b;a.currentMinor=amountMinor});
  d.subastas.auctions[aid]=a;
  Object.assign(p,{title:r.title,appraisalUF:r.appraisalUF??null,mortgage:r.mortgage===true,conditions:{...p.conditions,opensAt:start,closesAt:end,initialUF:r.minUF,incrementUF:50},reviewStatus:'approved',publicStatus:'published',updatedAt:now});
  p.live=D.publicFields(p)});
 d.attempts=d.attempts.filter(x=>!ids.has(String(x.auctionId)));
 for(const aid of ids)delete d.awards[aid];
 // Garantías de prueba: se descartan las de estas subastas y se vuelve a dejar la confirmada de Alex (flujo de garantía).
 d.guarantees=(d.guarantees||[]).filter(g=>!ids.has(String(g.auctionId)));
 const withGuarantee=d.properties.find(p=>p.demo&&ids.has(String(p.auctionId))&&p.conditions.guaranteeCLP);
 if(withGuarantee&&d.users.some(u=>u.id==='alex'))d.guarantees.push({id:'gar_demo1',code:'GAR-DEMO0001',userId:'alex',propertyId:withGuarantee.id,auctionId:withGuarantee.auctionId,amountCLP:withGuarantee.conditions.guaranteeCLP,status:'confirmed',refundAccount:{holder:'Alex Demo',rut:'11111111-1',bank:'Banco Estado',accountType:'Cuenta vista / RUT',number:'11111111'},termsVersion:d.config.termsVersion,createdAt:now,reportedAt:now,operation:'DEMO-123',confirmedBy:'usr_oper',confirmedAt:now,depositRef:'Cartola demo',history:[{from:'reported',to:'confirmed',by:'usr_oper',reason:'Ingreso verificado · Cartola demo',at:now}]});
 D.audit(d,'system','demo.reset','auction','demo',{auctions:ids.size,reason:'Subastas de prueba disponibles otra vez'});
 return ids.size}
module.exports={resetDemo};
