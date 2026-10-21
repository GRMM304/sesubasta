/* Servidor local de demostración. Sin dependencias. Comparte la lógica HTTP con Cloudflare (servidor/aplicacion.cjs).
   Para exponerlo a otras personas define SITE_PASSWORD; sin ella, úsalo solo en tu computador. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{Readable}=require('node:stream');
const {Engine}=require('./fuentes/auction-core.js');
const {Store}=require('./servidor/almacen.cjs');
const {seedData}=require('./servidor/semilla.cjs');
const {createApi}=require('./servidor/api.cjs');
const {createSeo}=require('./servidor/seo.cjs');
const {createApp,typeOf,respond}=require('./servidor/aplicacion.cjs');
const {gate,noindex}=require('./servidor/acceso.cjs');
const {migrate}=require('./servidor/migracion.cjs');
const S=require('./servidor/seguridad.cjs');

const ROOT=__dirname;
const DATA=process.env.SESUBASTA_DATA?path.resolve(process.env.SESUBASTA_DATA):path.join(ROOT,'runtime-data','datos.json');
const store=new Store(DATA).load(seedData);
store.tx(migrate);
const engine=new Engine(store.data.subastas,{persist:store.enginePersist()});
const clients=new Set();
const viewers=()=>clients.size;
function snapshotMessage(){return 'event: snapshot\ndata: '+JSON.stringify({auctions:engine.snapshots(store.data.properties.filter(p=>p.publicStatus==='published'&&p.auctionId).map(p=>String(p.auctionId))),serverNow:Date.now()})+'\n\n'}
function broadcast(){const message=snapshotMessage();for(const res of clients){if(!res.destroyed)res.write(message)}}
const api=createApi({store,engine,limiter:new S.RateLimiter(),broadcast,viewers,local:process.env.SESUBASTA_MODE!=='production',realtime:'sse'});
const seo=createSeo({store,api});
let template=null;
const app=createApp({store,api,seo,siteUrl:process.env.SITE_URL,
 getTemplate:()=>{if(!template||process.env.SESUBASTA_DEV)template=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');return template},
 getAsset:async p=>{const file=path.resolve(ROOT,p.slice(1));const okDir=file.startsWith(path.join(ROOT,'assets')+path.sep)||file===path.join(ROOT,'vista-responsive.html');if(!okDir||!fs.existsSync(file)||!fs.statSync(file).isFile())return null;return respond(200,fs.readFileSync(file),{'Content-Type':typeOf(file),'Cache-Control':p.startsWith('/assets/')?'public, max-age=3600':'no-cache'})}});

const toRequest=req=>{const hasBody=!['GET','HEAD'].includes(req.method);return new Request(`http://${req.headers.host||'localhost'}${req.url}`,{method:req.method,headers:Object.entries(req.headers).filter(([,v])=>typeof v==='string'),body:hasBody?Readable.toWeb(req):undefined,duplex:hasBody?'half':undefined})};
async function send(res,response){const headers={};response.headers.forEach((v,k)=>{if(k!=='set-cookie')headers[k]=v});const cookies=response.headers.getSetCookie();if(cookies.length)headers['set-cookie']=cookies;res.writeHead(response.status,headers);res.end(response.body?Buffer.from(await response.arrayBuffer()):undefined)}

const server=http.createServer(async(req,res)=>{try{const ip=req.socket.remoteAddress||'local';let request;try{request=toRequest(req)}catch{res.writeHead(400);return res.end()}
 const locked=await gate(request,process.env.SITE_PASSWORD,{ip});if(locked)return send(res,locked);
 const pathname=new URL(request.url).pathname;
 // Tiempo real local por Server-Sent Events. En Cloudflare se usa WebSocket.
 if(req.method==='GET'&&(pathname==='/api/events'||pathname==='/api/v1/events')){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});clients.add(res);res.write('retry: 2000\n'+snapshotMessage());req.on('close',()=>clients.delete(res));return}
 await send(res,noindex(await app.handle(request,{ip}),process.env.SITE_PASSWORD))}catch(e){console.error(e);if(!res.headersSent){res.writeHead(500);res.end()}}});

const timer=setInterval(()=>{try{api.tick()}catch(e){console.error('tick',e)}broadcast()},1000);timer.unref();
server.on('close',()=>{clearInterval(timer);for(const r of clients)r.end()});
if(require.main===module){const port=Number(process.env.PORT)||8080;server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`SeSubasta · prototipo local: http://127.0.0.1:${server.address().port}\nAcceso interno: http://127.0.0.1:${server.address().port}/admin-login\nCorreos de prueba: http://127.0.0.1:${server.address().port}/dev/correos\n${process.env.SITE_PASSWORD?'Protegido con contraseña de acceso (SITE_PASSWORD).':'Solo datos ficticios. Sin SITE_PASSWORD no lo expongas a internet.'}`))}
module.exports={server,engine,store};
