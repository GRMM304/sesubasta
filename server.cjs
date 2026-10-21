/* Local demo only. Zero dependencies. Do not expose on a public host. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Engine,seed}=require('./fuentes/auction-core.js');
const ROOT=__dirname,DATA=process.env.SESUBASTA_DATA||path.join(ROOT,'runtime-data','auctions.json');
const rows=JSON.parse(fs.readFileSync(path.join(ROOT,'fuentes/propiedades.json'),'utf8'));
function persist(state){fs.mkdirSync(path.dirname(DATA),{recursive:true});const temp=DATA+'.tmp';fs.writeFileSync(temp,JSON.stringify(state));fs.renameSync(temp,DATA)}
const state=fs.existsSync(DATA)?JSON.parse(fs.readFileSync(DATA,'utf8')):seed(rows);if(state.schema!==2)throw Error('Archivo de prueba incompatible. Usa una carpeta de datos nueva.');if(!fs.existsSync(DATA))persist(state);
const engine=new Engine(state,{persist}),sessions=new Map(),clients=new Set(),rates=new Map();
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
function all(){return {auctions:engine.snapshots(),serverNow:Date.now()}}
function broadcast(){const message='event: snapshot\ndata: '+JSON.stringify(all())+'\n\n';for(const res of clients){if(!res.destroyed)res.write(message)}}
function session(req){return sessions.get((req.headers.authorization||'').replace(/^Bearer /,''))}
async function body(req){let chunks='',size=0;for await(const c of req){size+=c.length;if(size>12000)throw Object.assign(new Error('Solicitud demasiado grande.'),{status:413});chunks+=c}try{return JSON.parse(chunks||'{}')}catch{throw Object.assign(new Error('Solicitud no válida.'),{status:400})}}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{code:'ORIGIN_DENIED',message:'Origen no permitido.'});
 if(url.pathname==='/api/health')return json(res,200,{mode:'local-demo',serverNow:Date.now()});
 if(req.method==='GET'&&url.pathname==='/api/auctions')return json(res,200,all());
 if(req.method==='GET'&&url.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});clients.add(res);res.write('event: snapshot\ndata: '+JSON.stringify(all())+'\n\n');req.on('close',()=>clients.delete(res));return}
 if(req.method==='POST'&&url.pathname==='/api/demo-session'){const b=await body(req);if(!['alex','camila'].includes(b.profile))return json(res,422,{message:'Elige una cuenta de prueba.'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{id:b.profile,name:b.profile==='alex'?'Alex Demo':'Camila Demo'});return json(res,200,{token,user:sessions.get(token)})}
 if(req.method==='GET'&&url.pathname==='/api/my-bids'){const user=session(req);if(!user)return json(res,401,{message:'Inicia sesión.'});return json(res,200,{bids:engine.own(user.id)})}
 const match=url.pathname.match(/^\/api\/auctions\/(\d+)\/bids$/);
 if(req.method==='POST'&&match){const user=session(req);if(!user)return json(res,401,{code:'AUTH_REQUIRED',message:'Inicia sesión para subastar.'});const b=await body(req);const previous=engine.state.auctions[match[1]]?.keys[user.id+':'+b.key];if(!previous){const attempts=(rates.get(user.id)||[]).filter(t=>Date.now()-t<10000);if(attempts.length>=20)return json(res,429,{code:'RATE_LIMITED',message:'Demasiados intentos. Espera unos segundos.'});attempts.push(Date.now());rates.set(user.id,attempts)}const result=engine.submit({...b,id:Number(match[1]),buyer:user.id});json(res,200,result);if(!result.duplicate)broadcast();return}
 if(url.pathname.startsWith('/api/'))return json(res,404,{message:'Ruta no disponible.'});
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{message:'Método no permitido.'});
 const decoded=decodeURIComponent(url.pathname),name=['/','/index.html'].includes(decoded)?'index.html':decoded.slice(1);
 const allowed=name==='vista-responsive.html'||name==='favicon.ico'||name.startsWith('assets/');
 if(name!=='index.html'&&!allowed){if(!path.extname(name)){res.writeHead(302,{Location:'/index.html'+(name==='admin-login'?'#admin-login':'#home')});return res.end()}return json(res,404,{message:'Archivo no disponible.'})}
 const file=path.resolve(ROOT,name);if(!file.startsWith(ROOT+path.sep))return json(res,403,{message:'Acceso denegado.'});
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{message:'Archivo no encontrado.'});
 const types={'.html':'text/html; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.ico':'image/x-icon'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
 }catch(e){json(res,e.status||503,{code:e.code||'SERVER_ERROR',message:e.status?e.message:'No se confirmó la operación. Reintenta con la misma referencia.'})}});
const timer=setInterval(broadcast,1000);timer.unref();server.on('close',()=>{clearInterval(timer);for(const r of clients)r.end()});
if(require.main===module){const port=Number(process.env.PORT)||8080;server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`SeSubasta demo local: http://127.0.0.1:${server.address().port}\nSin inscripción por propiedad. Usa Alex y Camila en dos pestañas.\nSolo datos ficticios. No publicar este servidor en internet.`))}
module.exports={server,engine};
