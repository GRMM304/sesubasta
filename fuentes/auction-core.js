/* Shared deterministic auction domain; no enrollment or per-property approval. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AuctionCore=factory()})(typeof globalThis!=='undefined'?globalThis:this,function(){
class AuctionError extends Error{constructor(code,message,status=409){super(message);this.code=code;this.status=status}}
function minorAmount(text){const s=String(text).trim().replace(',','.');if(!/^\d{1,10}(\.\d{1,2})?$/.test(s))throw new AuctionError('AMOUNT_INVALID','Ingresa un monto positivo con hasta dos decimales.',422);const [a,b='']=s.split('.');const n=Number(a)*100+Number((b+'00').slice(0,2));if(!Number.isSafeInteger(n)||n<=0)throw new AuctionError('AMOUNT_INVALID','El monto no es válido.',422);return n}
function seed(rows,at=Date.now()){return {schema:2,auctions:Object.fromEntries(rows.map((p,i)=>{const active=p.condition==='En vivo';const start=active?at-60000:at+(i+1)*3600000;const end=active?at+(p.id===2?15:30)*60000:start+86400000;return [String(p.id),{id:p.id,start,end,status:'scheduled',initialMinor:Math.round(p.minUF*100),currentMinor:Math.round(p.minUF*100),incrementMinor:5000,unit:'UF',termsVersion:'demo-2026-10-v4',version:0,sequence:0,bids:[],keys:{}}]}))}}
class Engine{
 constructor(state,{clock=()=>Date.now(),persist=()=>{}}={}){this.state=state;this.clock=clock;this.persist=persist}
 status(a){const now=this.clock();if(['paused','cancelled'].includes(a.status))return a.status;if(now>=a.end)return 'closed';if(now<a.start)return 'scheduled';return 'open'}
 snapshot(id){const a=this.state.auctions[String(id)];if(!a)throw new AuctionError('NOT_FOUND','La subasta no existe.',404);const count=new Set(a.bids.map(b=>b.buyer)).size;return {id:a.id,start:a.start,end:a.end,status:this.status(a),currentMinor:a.currentMinor,initialMinor:a.initialMinor,incrementMinor:a.incrementMinor,nextMinor:a.bids.length?a.currentMinor+a.incrementMinor:a.initialMinor,unit:a.unit,termsVersion:a.termsVersion,version:a.version,sequence:a.sequence,participants:count,totalBids:a.bids.length,serverNow:this.clock()}}
 snapshots(){return Object.keys(this.state.auctions).map(id=>this.snapshot(id))}
 own(buyer,id){const rows=id?[this.state.auctions[String(id)]].filter(Boolean):Object.values(this.state.auctions);return rows.flatMap(a=>a.bids.filter(b=>b.buyer===buyer).map(b=>({id:a.id,receipt:b.receipt,amountMinor:b.amountMinor,time:b.time,sequence:b.sequence,leading:a.bids.at(-1)?.buyer===buyer&&b.receipt===a.bids.at(-1)?.receipt}))).sort((a,b)=>b.time-a.time)}
 submit({id,buyer,amountMinor,unit,termsVersion,key,expectedVersion}){
  const a=this.state.auctions[String(id)];if(!a)throw new AuctionError('NOT_FOUND','La subasta no existe.',404);
  if(!buyer)throw new AuctionError('AUTH_REQUIRED','Inicia sesión para subastar.',401);
  if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(key))throw new AuctionError('KEY_INVALID','La solicitud necesita una referencia válida.',422);
  const sk=buyer+':'+key,existing=a.keys[sk];
  if(existing){if(existing.amountMinor!==amountMinor||existing.unit!==unit||existing.termsVersion!==termsVersion)throw new AuctionError('KEY_REUSED','La referencia ya se utilizó con otro monto.');return {receipt:{...existing},snapshot:this.snapshot(id),duplicate:true}}
  if(this.status(a)!=='open')throw new AuctionError('AUCTION_NOT_OPEN','La subasta no está abierta.');
  if(termsVersion!==a.termsVersion)throw new AuctionError('TERMS_CHANGED','Las condiciones cambiaron. Revísalas nuevamente.');
  if(unit!==a.unit||!Number.isSafeInteger(amountMinor)||amountMinor<=0||amountMinor>999999999999)throw new AuctionError('AMOUNT_INVALID','Revisa el monto y la unidad.',422);
  if(!Number.isInteger(expectedVersion)||expectedVersion!==a.version)throw new AuctionError('AUCTION_CHANGED','Hay una actualización. Revisa el nuevo mínimo y confirma nuevamente.');
  const next=a.bids.length?a.currentMinor+a.incrementMinor:a.initialMinor;
  if(amountMinor<next)throw new AuctionError('AMOUNT_TOO_LOW','El monto es menor al mínimo vigente.',422);
  const newState=JSON.parse(JSON.stringify(this.state)),n=newState.auctions[String(id)];
  const receipt={id:n.id,buyer,amountMinor,unit,termsVersion,receipt:'SS-DEMO-'+id+'-'+(n.sequence+1),time:this.clock(),sequence:n.sequence+1};
  n.currentMinor=amountMinor;n.version++;n.sequence++;n.bids.push(receipt);n.keys[sk]=receipt;
  // Commit before acknowledging or broadcasting. A failed persistence leaves state intact.
  this.persist(newState);this.state=newState;
  return {receipt:{...receipt},snapshot:this.snapshot(id),duplicate:false}
 }
}
return {Engine,seed,minorAmount,AuctionError};});
