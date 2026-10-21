/* Manejo HTTP compartido (API Fetch estándar: Request → Response).
   Lo usan el servidor local de Node (server.cjs) y Cloudflare Workers (cloudflare/worker.mjs),
   así ambos aplican exactamente las mismas reglas. */
const S=require('./seguridad.cjs');
const Mail=require('./correo.cjs');
const {HttpError}=require('./api.cjs');

const TYPES={html:'text/html; charset=utf-8',png:'image/png',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',svg:'image/svg+xml',ttf:'font/ttf',ico:'image/x-icon',pdf:'application/pdf',txt:'text/plain; charset=utf-8',xml:'application/xml; charset=utf-8',json:'application/json; charset=utf-8'};
const typeOf=name=>TYPES[String(name).split('.').pop().toLowerCase()]||'application/octet-stream';
const SECURITY={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://www.google-analytics.com https://www.googletagmanager.com https://unpkg.com; connect-src 'self' ws: wss: https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com; font-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"};

function respond(status,body,headers={},cookies=[]){const h=new Headers({...SECURITY,...headers});for(const c of cookies)h.append('Set-Cookie',c);return new Response(body,{status,headers:h})}
const json=(status,data,cookies=[])=>respond(status,JSON.stringify(data),{'Content-Type':TYPES.json,'Cache-Control':'no-store'},cookies);
function fileResponse(bytes,{mime,name,inline=true,cache='no-cache',noindex=false},cookies=[]){const h={'Content-Type':mime||'application/octet-stream','Cache-Control':cache};if(name)h['Content-Disposition']=`${inline?'inline':'attachment'}; filename="${encodeURIComponent(name)}"`;if(noindex)h['X-Robots-Tag']='noindex, nofollow';return respond(200,bytes,h,cookies)}

function createApp({store,api,seo,getTemplate,getAsset,siteUrl}){
 async function handle(request,{ip='local'}={}){const requestId=crypto.randomUUID();let url;try{url=new URL(request.url)}catch{return json(400,{code:'BAD_REQUEST',message:'Dirección no válida.'})}
  let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{return json(400,{code:'BAD_REQUEST',message:'Dirección no válida.'})}
  const proto=request.headers.get('x-forwarded-proto')||url.protocol.replace(':','');const base=siteUrl||`${proto}://${url.host}`;Mail.setBase(base);
  const method=request.method,cookies=[];
  const ctx={req:{headers:Object.fromEntries([...request.headers].map(([k,v])=>[k.toLowerCase(),v]))},method,path:pathname,query:Object.fromEntries(url.searchParams),cookies:S.parseCookies(request.headers.get('cookie')),ip,secure:proto==='https',origin:base,requestId,setCookie:c=>cookies.push(c),
   readBody:async max=>{const declared=Number(request.headers.get('content-length')||0);if(declared>max)throw new HttpError(413,'TOO_LARGE','La solicitud es demasiado grande.');const text=await request.text();if(text.length>max)throw new HttpError(413,'TOO_LARGE','La solicitud es demasiado grande.');if(!text)return {};try{const v=JSON.parse(text);if(!v||typeof v!=='object'||Array.isArray(v))throw 0;return v}catch{throw new HttpError(400,'VALIDATION_ERROR','Solicitud no válida.')}}};
  try{
   if(pathname.startsWith('/api/')){
    // Escrituras solo desde el mismo sitio; la cabecera propia obliga a una verificación previa que otros orígenes no superan.
    if(['POST','PATCH','DELETE'].includes(method)){const origin=request.headers.get('origin');if(origin&&origin!==base&&origin!==url.origin)return json(403,{code:'ORIGIN_DENIED',message:'Origen no permitido.'});if(!request.headers.get('x-sesubasta')&&!/^Bearer /.test(request.headers.get('authorization')||'')&&!/^\/api\/(demo-session|auctions\/\d+\/bids)$/.test(pathname))return json(403,{code:'CSRF',message:'Solicitud no permitida.'})}
    if(pathname==='/api/health')return json(200,{mode:'local-demo',serverNow:Date.now()});
    const out=await api.handle(ctx);
    if(!out)return json(404,{code:'NOT_FOUND',message:'Ruta no disponible.'},cookies);
    if(out.raw){const f=out.result.file;const bytes=store.readFile(f.visibility,f.key);if(!bytes)return json(404,{code:'NOT_FOUND',message:'Archivo no disponible.'},cookies);return fileResponse(bytes,{mime:f.mime,name:f.name,inline:f.inline||f.mime==='application/pdf',cache:'private, no-store',noindex:true},cookies)}
    return json(200,out.result,cookies)}
   if(method!=='GET'&&method!=='HEAD')return json(405,{code:'METHOD',message:'Método no permitido.'});
   if(pathname==='/robots.txt')return respond(200,seo.robots(base),{'Content-Type':TYPES.txt});
   if(pathname==='/sitemap.xml')return respond(200,seo.sitemap(base),{'Content-Type':TYPES.xml,'Cache-Control':'no-cache'});
   if(pathname==='/favicon.ico'){const r=await getAsset('/assets/marca/favicon-sesubasta.png');return r||json(404,{code:'NOT_FOUND',message:'No encontrado.'})}
   // Los archivos subidos solo son públicos cuando el registro que los usa es público.
   const m=pathname.match(/^\/media\/([\w.-]+)$/);
   if(m){const key=m[1];const d=store.data;const ok=d.properties.some(p=>p.publicStatus==='published'&&p.live?.media.some(x=>x.key===key))||d.posts.some(p=>p.status==='published'&&p.publishedAt<=Date.now()&&p.cover?.key===key);const bytes=ok&&store.readFile('publico',key);if(!bytes)return json(404,{code:'NOT_FOUND',message:'Archivo no disponible.'});return fileResponse(bytes,{mime:typeOf(key),cache:'public, max-age=3600'})}
   if(pathname.startsWith('/assets/')||pathname==='/vista-responsive.html'){if(pathname.includes('..'))return json(403,{code:'FORBIDDEN',message:'Acceso denegado.'});const r=await getAsset(pathname);return r||json(404,{code:'NOT_FOUND',message:'Archivo no encontrado.'})}
   if(/\.[a-z0-9]+$/i.test(pathname)&&pathname!=='/index.html')return json(404,{code:'NOT_FOUND',message:'Archivo no disponible.'});
   // Rutas de la aplicación: un solo HTML para todos los anchos, con metadatos y contenido rastreable generados aquí.
   const route=pathname==='/index.html'?'/':pathname.replace(/\/+$/,'')||'/';
   const p=seo.page(route,base);
   if(p.status===301)return respond(301,null,{Location:p.location});
   const html=(await getTemplate()).replace(/<title>[\s\S]*?<\/title>\s*<meta name="description"[^>]*>/,seo.head(p)).replace('<!--SSR-->',p.html?`<div class="ssr-content">${p.html}</div>`:'');
   const headers={'Content-Type':TYPES.html,'Cache-Control':'no-cache'};if(p.robots.startsWith('noindex'))headers['X-Robots-Tag']=p.robots.replace(',',', ');
   return respond(p.status,method==='HEAD'?null:html,headers);
  }catch(e){const status=e.status||500;const body={code:e.code||'INTERNAL_ERROR',message:e.status?e.message:'No se confirmó la operación. Reintenta con la misma referencia.',requestId,...(e.extra||{})};if(!e.status)console.error(requestId,e);return json(status,body,cookies)}}
 return {handle}}
module.exports={createApp,respond,json,typeOf,SECURITY};
