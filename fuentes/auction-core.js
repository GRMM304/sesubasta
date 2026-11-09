/* Shared deterministic auction domain; no enrollment or per-property approval.
   Used by the local server (authoritative) and by the file-only individual preview. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AuctionCore=factory()})(typeof globalThis!=='undefined'?globalThis:this,function(){
class AuctionError extends Error{constructor(code,message,status=409){super(message);this.code=code;this.status=status}}
function minorAmount(text){const s=String(text).trim().replace(/\./g,(m,i,str)=>str.indexOf(',')>=0?'':m).replace(',','.');if(!/^\d{1,10}(\.\d{1,2})?$/.test(s))throw new AuctionError('AMOUNT_INVALID','Ingresa una oferta positiva con hasta dos decimales.',422);const [a,b='']=s.split('.');const n=Number(a)*100+Number((b+'00').slice(0,2));if(!Number.isSafeInteger(n)||n<=0)throw new AuctionError('AMOUNT_INVALID','La oferta no es válida.',422);return n}
function auctionFrom(p,i,at,o={}){const active=p.condition==='En vivo';const live=o.liveMinutes?[o.liveMinutes,o.liveMinutes+60]:[15,30];const start=active?at-60000:at+(i+1)*3600000;const end=active?at+(p.id===2?live[0]:live[1])*60000:start+86400000;return {id:p.id,start,end,status:'scheduled',initialMinor:Math.round(p.minUF*100),currentMinor:Math.round(p.minUF*100),incrementMinor:5000,unit:'UF',termsVersion:'demo-2026-10-v4',version:0,sequence:0,bids:[],keys:{},events:[]}}
function seed(rows,at=Date.now(),o={}){return {schema:2,auctions:Object.fromEntries(rows.map((p,i)=>[String(p.id),auctionFrom(p,i,at,o)]))}}
const clone=v=>JSON.parse(JSON.stringify(v));
class Engine{
 constructor(state,{clock=()=>Date.now(),persist=()=>{}}={}){this.state=state;this.clock=clock;this.persist=persist}
 get(id){const a=this.state.auctions[String(id)];if(!a)throw new AuctionError('NOT_FOUND','La subasta no existe.',404);return a}
 status(a){const now=this.clock();if(['paused','cancelled','draft'].includes(a.status))return a.status;if(now>=a.end)return 'closed';if(now<a.start)return 'scheduled';return 'open'}
 snapshot(id){const a=this.get(id);const count=new Set(a.bids.map(b=>b.buyer)).size;return {id:a.id,start:a.start,end:a.end,status:this.status(a),currentMinor:a.currentMinor,initialMinor:a.initialMinor,incrementMinor:a.incrementMinor,nextMinor:a.bids.length?a.currentMinor+a.incrementMinor:a.initialMinor,unit:a.unit,termsVersion:a.termsVersion,version:a.version,sequence:a.sequence,participants:count,totalBids:a.bids.length,pauseReason:a.status==='paused'?a.publicReason||'':'',serverNow:this.clock()}}
 snapshots(ids){return (ids||Object.keys(this.state.auctions)).filter(id=>this.state.auctions[String(id)]&&this.state.auctions[String(id)].status!=='draft').map(id=>this.snapshot(id))}
 own(buyer,id){const rows=id?[this.state.auctions[String(id)]].filter(Boolean):Object.values(this.state.auctions);return rows.flatMap(a=>{const best=a.bids.at(-1);return a.bids.filter(b=>b.buyer===buyer).map(b=>({id:a.id,receipt:b.receipt,amountMinor:b.amountMinor,unit:b.unit,time:b.time,sequence:b.sequence,leading:best?.buyer===buyer&&b.receipt===best?.receipt,status:this.status(a)}))}).sort((a,b)=>b.time-a.time)}
 /* Preliminary result: best valid amount and best amount from a different account. */
 ranking(id){const a=this.get(id);const best=a.bids.at(-1)||null;let runner=null;if(best){for(let i=a.bids.length-2;i>=0;i--){if(a.bids[i].buyer!==best.buyer){runner=a.bids[i];break}}}return {best,runner}}
 submit({id,buyer,amountMinor,unit,termsVersion,key,expectedVersion}){
  const a=this.get(id);
  if(!buyer)throw new AuctionError('AUTH_REQUIRED','Inicia sesión para ofertar.',401);
  if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(key))throw new AuctionError('KEY_INVALID','La solicitud necesita una referencia válida.',422);
  const sk=buyer+':'+key,existing=a.keys[sk];
  if(existing){if(existing.amountMinor!==amountMinor||existing.unit!==unit||existing.termsVersion!==termsVersion)throw new AuctionError('KEY_REUSED','La referencia ya se utilizó con otra oferta.');return {receipt:{...existing},snapshot:this.snapshot(id),duplicate:true}}
  const status=this.status(a);
  if(status==='paused')throw new AuctionError('AUCTION_PAUSED','La subasta está suspendida. No se reciben ofertas por ahora.');
  if(status!=='open')throw new AuctionError('AUCTION_NOT_OPEN','La subasta no está abierta.');
  if(termsVersion!==a.termsVersion)throw new AuctionError('TERMS_CHANGED','Las condiciones cambiaron. Revísalas nuevamente.');
  if(unit!==a.unit||!Number.isSafeInteger(amountMinor)||amountMinor<=0||amountMinor>999999999999)throw new AuctionError('AMOUNT_INVALID','Revisa la oferta y la unidad.',422);
  if(!Number.isInteger(expectedVersion)||expectedVersion!==a.version)throw new AuctionError('AUCTION_CHANGED','Hay una actualización. Revisa el nuevo mínimo y confirma nuevamente.');
  const next=a.bids.length?a.currentMinor+a.incrementMinor:a.initialMinor;
  if(amountMinor<next)throw new AuctionError('AMOUNT_TOO_LOW','La oferta es menor al mínimo vigente.',422);
  const previousLeader=a.bids.at(-1)?.buyer||null;
  const newState=clone(this.state),n=newState.auctions[String(id)];
  const receipt={id:n.id,buyer,amountMinor,unit,termsVersion,receipt:'SS-DEMO-'+id+'-'+(n.sequence+1),time:this.clock(),sequence:n.sequence+1};
  n.currentMinor=amountMinor;n.version++;n.sequence++;n.bids.push(receipt);n.keys[sk]=receipt;
  // Commit before acknowledging or broadcasting. A failed persistence leaves state intact.
  this.persist(newState);this.state=newState;
  return {receipt:{...receipt},snapshot:this.snapshot(id),duplicate:false,previousLeader}
 }
 /* Administrative transitions. Each one is persisted before it takes effect. */
 mutate(id,fn){const newState=clone(this.state),n=newState.auctions[String(id)];if(!n)throw new AuctionError('NOT_FOUND','La subasta no existe.',404);fn(n);n.version++;this.persist(newState);this.state=newState;return this.snapshot(id)}
 create(def){const id=String(def.id);if(this.state.auctions[id])throw new AuctionError('EXISTS','La subasta ya existe.');const newState=clone(this.state);newState.auctions[id]={id:def.id,start:def.start,end:def.end,status:def.status||'scheduled',initialMinor:def.initialMinor,currentMinor:def.initialMinor,incrementMinor:def.incrementMinor,unit:def.unit||'UF',termsVersion:def.termsVersion,version:0,sequence:0,bids:[],keys:{},events:[]};this.persist(newState);this.state=newState;return this.snapshot(id)}
 suspend(id,{reason,actor}){const a=this.get(id);const s=this.status(a);if(s!=='open'&&s!=='scheduled')throw new AuctionError('INVALID_STATE','Solo se puede suspender una subasta próxima o en vivo.');if(!reason||reason.trim().length<5)throw new AuctionError('REASON_REQUIRED','Indica el motivo de la suspensión.',422);return this.mutate(id,n=>{n.status='paused';n.publicReason=reason.trim();n.events.push({type:'suspended',reason:reason.trim(),actor,time:this.clock()})})}
 resume(id,{end,reason,actor}){const a=this.get(id);if(a.status!=='paused')throw new AuctionError('INVALID_STATE','La subasta no está suspendida.');if(!Number.isFinite(end)||end<=this.clock()+60000)throw new AuctionError('END_INVALID','El nuevo cierre debe ser al menos un minuto en el futuro.',422);if(!reason||reason.trim().length<5)throw new AuctionError('REASON_REQUIRED','Indica el motivo de la reanudación.',422);return this.mutate(id,n=>{n.status='scheduled';n.end=end;delete n.publicReason;n.events.push({type:'resumed',reason:reason.trim(),end,actor,time:this.clock()})})}
 cancel(id,{reason,actor}){const a=this.get(id);if(this.status(a)==='closed')throw new AuctionError('INVALID_STATE','Una subasta cerrada no se puede cancelar.');if(!reason||reason.trim().length<5)throw new AuctionError('REASON_REQUIRED','Indica el motivo de la cancelación.',422);return this.mutate(id,n=>{n.status='cancelled';n.publicReason=reason.trim();n.events.push({type:'cancelled',reason:reason.trim(),actor,time:this.clock()})})}
 reschedule(id,{start,end,initialMinor,incrementMinor,termsVersion}){const a=this.get(id);if(a.bids.length)throw new AuctionError('HAS_BIDS','La subasta ya tiene registros; no se pueden cambiar sus reglas.');if(!(end>start))throw new AuctionError('END_INVALID','El cierre debe ser posterior al inicio.',422);return this.mutate(id,n=>{Object.assign(n,{start,end,initialMinor,currentMinor:initialMinor,incrementMinor,termsVersion,status:'scheduled'});n.events.push({type:'scheduled',time:this.clock()})})}
}
return {Engine,seed,minorAmount,AuctionError};});
