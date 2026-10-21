/* Local demo server. Zero dependencies. Do not expose it on a public host: it is a prototype, not production. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Engine}=require('./fuentes/auction-core.js');
const {Store}=require('./servidor/almacen.cjs');
const {seedData}=require('./servidor/semilla.cjs');
const {createApi,HttpError}=require('./servidor/api.cjs');
const {createSeo}=require('./servidor/seo.cjs');
const S=require('./servidor/seguridad.cjs');
const D=require('./servidor/dominio.cjs');
const Mail=require('./servidor/correo.cjs');

const ROOT=__dirname;
const DATA=process.env.SESUBASTA_DATA?path.resolve(process.env.SESUBASTA_DATA):path.join(ROOT,'runtime-data','datos.json');
const store=new Store(DATA).load(seedData);
// Every published record keeps the approved public version separately from later private edits.
store.tx(d=>{for(const p of d.properties)if(p.publicStatus==='published'&&!p.live)p.live=D.publicFields(p)});
const engine=new Engine(store.data.subastas,{persist:store.enginePersist()});
const limiter=new S.RateLimiter();
const clients=new Map();// response -> {auction}
const viewers=aid=>{let n=0;for(const v of clients.values())if(!aid||String(v.auction)===String(aid))n++;return n};
let api;
function snapshotMessage(){return 'event: snapshot\ndata: '+JSON.stringify({auctions:engine.snapshots(store.data.properties.filter(p=>p.publicStatus==='published'&&p.auctionId).map(p=>String(p.auctionId))),serverNow:Date.now()})+'\n\n'}
function broadcast(){const message=snapshotMessage();for(const res of clients.keys()){if(!res.destroyed)res.write(message)}}
api=createApi({store,engine,limiter,broadcast,viewers,local:process.env.SESUBASTA_MODE!=='production'});
const seo=createSeo({store,api});

const TYPES={'.html':'text/html; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.ico':'image/x-icon','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const SECURITY={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://www.google-analytics.com https://www.googletagmanager.com https://unpkg.com; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com; font-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"};
let template=null;const loadTemplate=()=>{if(!template||process.env.SESUBASTA_DEV)template=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');return template};

function send(res,status,body,headers={}){res.writeHead(status,{...SECURITY,...headers});res.end(body)}
function json(res,status,data,extra={}){send(res,status,JSON.stringify(data),{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra})}
function sendFile(res,file,{mime,name,inline=true,cache='no-cache',noindex=false}={}){const headers={'Content-Type':mime||TYPES[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':cache};if(name)headers['Content-Disposition']=`${inline?'inline':'attachment'}; filename="${encodeURIComponent(name)}"`;if(noindex)headers['X-Robots-Tag']='noindex, nofollow';res.writeHead(200,{...SECURITY,...headers});fs.createReadStream(file).pipe(res)}

const server=http.createServer(async(req,res)=>{const requestId=crypto.randomUUID();let url;try{url=new URL(req.url,'http://localhost')}catch{return json(res,400,{code:'BAD_REQUEST',message:'Dirección no válida.'})}
 let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{return json(res,400,{code:'BAD_REQUEST',message:'Dirección no válida.'})}
 const proto=req.headers['x-forwarded-proto']==='https'?'https':'http';const base=process.env.SITE_URL||`${proto}://${req.headers.host}`;Mail.setBase(base);
 const cookies=[];
 const ctx={req,res,method:req.method,path:pathname,query:Object.fromEntries(url.searchParams),cookies:S.parseCookies(req.headers.cookie),ip:req.socket.remoteAddress||'local',secure:proto==='https',origin:base,requestId,setCookie:c=>cookies.push(c),
  readBody:async max=>{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>max)throw new HttpError(413,'TOO_LARGE','La solicitud es demasiado grande.');chunks.push(c)}const text=Buffer.concat(chunks).toString('utf8');if(!text)return {};try{const v=JSON.parse(text);if(!v||typeof v!=='object'||Array.isArray(v))throw 0;return v}catch{throw new HttpError(400,'VALIDATION_ERROR','Solicitud no válida.')}}};
 try{
  if(pathname.startsWith('/api/')){
   // Writes must come from this same site; the custom header forces a CORS preflight that other origins cannot pass.
   if(['POST','PATCH','DELETE'].includes(req.method)){if(req.headers.origin&&req.headers.origin!==base)return json(res,403,{code:'ORIGIN_DENIED',message:'Origen no permitido.'});if(!req.headers['x-sesubasta']&&!/^Bearer /.test(req.headers.authorization||'')&&!/^\/api\/(demo-session|auctions\/\d+\/bids)$/.test(pathname))return json(res,403,{code:'CSRF',message:'Solicitud no permitida.'})}
   if(pathname==='/api/health')return json(res,200,{mode:'local-demo',serverNow:Date.now()});
   if(req.method==='GET'&&(pathname==='/api/events'||pathname==='/api/v1/events')){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});clients.set(res,{auction:url.searchParams.get('auction')});res.write('retry: 2000\n'+snapshotMessage());req.on('close',()=>clients.delete(res));return}
   const out=await api.handle(ctx);
   if(!out)return json(res,404,{code:'NOT_FOUND',message:'Ruta no disponible.'});
   const headers=cookies.length?{'Set-Cookie':cookies}:{};
   if(out.raw){const f=out.result.file;const file=store.filePath(f.visibility,f.key);if(!file)return json(res,404,{code:'NOT_FOUND',message:'Archivo no disponible.'});res.setHeader('Set-Cookie',cookies);return sendFile(res,file,{mime:f.mime,name:f.name,inline:f.inline||f.mime==='application/pdf',cache:'private, no-store',noindex:true})}
   return json(res,200,out.result,headers)}
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{code:'METHOD',message:'Método no permitido.'});
  if(pathname==='/robots.txt')return send(res,200,seo.robots(base),{'Content-Type':TYPES['.txt']});
  if(pathname==='/sitemap.xml')return send(res,200,seo.sitemap(base),{'Content-Type':TYPES['.xml'],'Cache-Control':'no-cache'});
  if(pathname==='/favicon.ico')return sendFile(res,path.join(ROOT,'assets/marca/favicon-sesubasta.png'),{mime:'image/png',cache:'public, max-age=86400'});
  // Uploaded media is public only when the record that uses it is public.
  let m=pathname.match(/^\/media\/([\w.-]+)$/);
  if(m){const key=m[1];const d=store.data;const ok=d.properties.some(p=>p.publicStatus==='published'&&p.live?.media.some(x=>x.key===key))||d.posts.some(p=>p.status==='published'&&p.publishedAt<=Date.now()&&p.cover?.key===key);const file=ok&&store.filePath('publico',key);if(!file)return json(res,404,{code:'NOT_FOUND',message:'Archivo no disponible.'});return sendFile(res,file,{cache:'public, max-age=3600'})}
  if(pathname.startsWith('/assets/')||pathname==='/vista-responsive.html'){const file=path.resolve(ROOT,pathname.slice(1));if(!file.startsWith(path.join(ROOT,'assets')+path.sep)&&pathname!=='/vista-responsive.html')return json(res,403,{code:'FORBIDDEN',message:'Acceso denegado.'});if(!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{code:'NOT_FOUND',message:'Archivo no encontrado.'});return sendFile(res,file,{cache:pathname.startsWith('/assets/')?'public, max-age=3600':'no-cache'})}
  if(path.extname(pathname)&&pathname!=='/index.html')return json(res,404,{code:'NOT_FOUND',message:'Archivo no disponible.'});
  // Application routes: one HTML document for every viewport, with metadata and crawlable content rendered here.
  const route=pathname==='/index.html'?'/':pathname.replace(/\/+$/,'')||'/';
  const p=seo.page(route,base);
  if(p.status===301){res.writeHead(301,{...SECURITY,Location:p.location});return res.end()}
  const html=loadTemplate().replace(/<title>[\s\S]*?<\/title>\s*<meta name="description"[^>]*>/,seo.head(p)).replace('<!--SSR-->',p.html?`<div class="ssr-content">${p.html}</div>`:'');
  const headers={'Content-Type':TYPES['.html'],'Cache-Control':'no-cache'};if(p.robots.startsWith('noindex'))headers['X-Robots-Tag']=p.robots.replace(',',', ');
  return send(res,p.status,req.method==='HEAD'?'':html,headers);
 }catch(e){const status=e.status||500;const body={code:e.code||'INTERNAL_ERROR',message:e.status?e.message:'No se confirmó la operación. Reintenta con la misma referencia.',requestId,...(e.extra||{})};if(!e.status)console.error(requestId,e);if(e.code==='AUCTION_CHANGED'||e.code==='AMOUNT_TOO_LOW')body.code=e.code;return json(res,status,body,cookies.length?{'Set-Cookie':cookies}:{})}});

const timer=setInterval(()=>{try{if(api.tick())broadcast()}catch(e){console.error('tick',e)}broadcast()},1000);timer.unref();
server.on('close',()=>{clearInterval(timer);for(const r of clients.keys())r.end()});
if(require.main===module){const port=Number(process.env.PORT)||8080;server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`SeSubasta · prototipo local: http://127.0.0.1:${server.address().port}\nAcceso interno: http://127.0.0.1:${server.address().port}/admin-login\nCorreos de prueba: http://127.0.0.1:${server.address().port}/dev/correos\nSolo datos ficticios. No publicar este servidor en internet.`))}
module.exports={server,engine,store};
