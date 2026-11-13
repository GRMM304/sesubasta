/* Shared catalogue rules: search, filters, canonical price comparison in UF, sort and cursor pagination.
   The same function runs on the server and in the file-only preview, so both apply identical rules. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CatalogCore=factory()})(typeof globalThis!=='undefined'?globalThis:this,function(){
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const num=v=>{if(v===''||v==null)return null;const n=Number(v);return Number.isFinite(n)?n:null};
const b64e=s=>typeof Buffer!=='undefined'?Buffer.from(s).toString('base64url'):btoa(s).replace(/=+$/,'');
const b64d=s=>{try{return typeof Buffer!=='undefined'?Buffer.from(s,'base64url').toString():atob(s)}catch{return '0'}};
const RANK={open:0,scheduled:1,paused:2,closed:3,cancelled:4,none:5};
const COMMERCIAL=/local|oficina|bodega|comercial|industrial/i;
const chileDay=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'America/Santiago'});
/* rows: published properties already decorated with an `auction` snapshot (or null). uf: {value, available}. */
function query(rows,q={},uf={available:false}){
 const statusOf=p=>p.auction?p.auction.status:'none';
 const amount=p=>p.auction?p.auction.currentMinor/100:(p.conditions?.initialUF||0);
 // Prices typed in CLP are converted to the canonical unit (UF) before comparing.
 const toUF=v=>q.unit==='CLP'?(uf.available?v/uf.value:null):v;
 let out=rows.slice();const text=fold(q.q).trim();
 if(text)out=out.filter(p=>fold([p.title,p.type,p.commune,p.region,p.publicLocation,p.publicId].join(' ')).includes(text));
 for(const k of ['region','commune','type','occupancy'])if(q[k])out=out.filter(p=>p[k]===q[k]);
 // Residencial o comercial (buscador de inicio) y día de la subasta en hora de Chile.
 if(q.segment==='residencial'||q.segment==='comercial')out=out.filter(p=>COMMERCIAL.test(p.type||'')===(q.segment==='comercial'));
 if(/^\d{4}-\d{2}-\d{2}$/.test(q.date||''))out=out.filter(p=>{const s=p.auction?.start??p.conditions?.opensAt,e=p.auction?.end??p.conditions?.closesAt;return s!=null&&e!=null&&chileDay(s)<=q.date&&q.date<=chileDay(e)});
 if(num(q.rooms))out=out.filter(p=>(p.rooms||0)>=num(q.rooms));if(num(q.baths))out=out.filter(p=>(p.baths||0)>=num(q.baths));if(num(q.area))out=out.filter(p=>(p.area||0)>=num(q.area));
 const min=num(q.min)!=null?toUF(num(q.min)):null,max=num(q.max)!=null?toUF(num(q.max)):null;
 if(min!=null)out=out.filter(p=>amount(p)>=min);if(max!=null)out=out.filter(p=>amount(p)<=max);
 if(q.status)out=out.filter(p=>String(q.status).split(',').includes(statusOf(p)));
 const done=p=>['closed','cancelled'].includes(statusOf(p))?1:0;
 const sorts={relevance:(a,b)=>RANK[statusOf(a)]-RANK[statusOf(b)]||(a.auction?.end||0)-(b.auction?.end||0),recent:(a,b)=>(b.publishedAt||0)-(a.publishedAt||0),price_asc:(a,b)=>amount(a)-amount(b),price_desc:(a,b)=>amount(b)-amount(a),closing:(a,b)=>done(a)-done(b)||(a.auction?.end||9e15)-(b.auction?.end||9e15),start:(a,b)=>done(a)-done(b)||(a.auction?.start||9e15)-(b.auction?.start||9e15)};
 // Por defecto: cierre más próximo, con las cerradas y canceladas al final.
 out.sort(sorts[q.sort]||sorts.closing);
 const limit=Math.min(Math.max(num(q.limit)||12,1),60),offset=Math.max(parseInt(b64d(String(q.cursor||'')),10)||0,0);
 return {items:out.slice(offset,offset+limit),total:out.length,nextCursor:offset+limit<out.length?b64e(String(offset+limit)):null,priceFilterUnavailable:q.unit==='CLP'&&!uf.available&&(num(q.min)!=null||num(q.max)!=null)}}
function facets(rows){const uniq=k=>[...new Set(rows.map(p=>p[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));const communes={};for(const p of rows){(communes[p.region]=communes[p.region]||[]);if(!communes[p.region].includes(p.commune))communes[p.region].push(p.commune)}Object.values(communes).forEach(l=>l.sort((a,b)=>a.localeCompare(b,'es')));return {regions:uniq('region'),communes,types:uniq('type'),occupancy:uniq('occupancy')}}
function suggest(rows,q){const t=fold(q).trim();if(t.length<2)return [];const out=new Map();for(const p of rows){for(const [v,kind] of [[p.commune,'Comuna'],[p.region,'Región'],[p.type,'Tipo'],[p.publicId,'ID']]){if(v&&fold(v).includes(t))out.set(v,{label:v,kind})}}return [...out.values()].slice(0,8)}
return {query,facets,suggest,fold};});
