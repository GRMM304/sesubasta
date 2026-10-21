/* SeSubasta · Remates Dinámicos en Cloudflare Workers (plan gratuito).
   - El Worker protege el sitio con la contraseña de acceso y sirve los archivos estáticos.
   - Un único Durable Object (SeSubastaApp) es la autoridad: guarda los datos en su SQLite,
     serializa cada monto, mantiene las conexiones en vivo (WebSocket con hibernación) y
     programa con alarmas los cierres, avisos, recordatorios y envíos de correo y WhatsApp. */
import {DurableObject} from 'cloudflare:workers';
import {Buffer} from 'node:buffer';
import process from 'node:process';
import Core from '../fuentes/auction-core.js';
import {DOStore} from '../servidor/almacen-do.cjs';
import {seedData} from '../servidor/semilla.cjs';
import {createApi} from '../servidor/api.cjs';
import {createSeo} from '../servidor/seo.cjs';
import {createApp,respond} from '../servidor/aplicacion.cjs';
import {gate,noindex} from '../servidor/acceso.cjs';
import {migrate} from '../servidor/migracion.cjs';
import S from '../servidor/seguridad.cjs';
globalThis.Buffer??=Buffer;

const ENV_KEYS=['DEMO_LIVE_MINUTES','SITE_URL','RESEND_API_KEY','MAIL_FROM','WHATSAPP_TOKEN','WHATSAPP_PHONE_ID','WHATSAPP_TEMPLATE','WHATSAPP_LANG','SCRYPT_N','SESUBASTA_MODE'];
const ip=request=>request.headers.get('cf-connecting-ip')||'cf';

export class SeSubastaApp extends DurableObject{
 constructor(ctx,env){super(ctx,env);for(const k of ENV_KEYS)if(env[k])process.env[k]=String(env[k]);if(!process.env.SCRYPT_N)process.env.SCRYPT_N='4096';
  this.store=new DOStore(ctx.storage).load(seedData);this.store.tx(migrate);
  this.engine=new Core.Engine(this.store.data.subastas,{persist:this.store.enginePersist()});
  this.api=createApi({store:this.store,engine:this.engine,limiter:new S.RateLimiter(),broadcast:()=>this.broadcast(),viewers:()=>this.ctx.getWebSockets().length,local:env.SESUBASTA_MODE!=='production',realtime:'ws'});
  this.seo=createSeo({store:this.store,api:this.api});
  this.app=createApp({store:this.store,api:this.api,seo:this.seo,siteUrl:env.SITE_URL,getTemplate:()=>this.template(),getAsset:p=>this.asset(p)});
  // Mantiene la conexión viva sin despertar al objeto: el navegador envía "ping" y recibe "pong" automáticamente.
  ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'))}
 async template(){if(!this.html){const r=await this.env.ASSETS.fetch(new Request('https://assets.local/'));this.html=await r.text()}return this.html}
 async asset(p){const r=await this.env.ASSETS.fetch(new Request('https://assets.local'+p));return r.ok?new Response(r.body,r):null}
 snapshot(){return JSON.stringify({auctions:this.engine.snapshots(this.store.data.properties.filter(p=>p.publicStatus==='published'&&p.auctionId).map(p=>String(p.auctionId))),serverNow:Date.now()})}
 broadcast(){const msg=this.snapshot();for(const ws of this.ctx.getWebSockets()){try{ws.send(msg)}catch{}}}
 async schedule(){const next=this.api.nextWake();const fallback=Date.now()+6*3600000;const when=Math.min(next??fallback,fallback);const current=await this.ctx.storage.getAlarm();if(!current||Math.abs(current-when)>500)await this.ctx.storage.setAlarm(when)}
 async fetch(request){const url=new URL(request.url);
  if(url.pathname==='/api/v1/ws'){if(request.headers.get('Upgrade')!=='websocket')return respond(426,'Se requiere WebSocket.');const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);pair[1].send(this.snapshot());return new Response(null,{status:101,webSocket:pair[0]})}
  const response=await this.app.handle(request,{ip:ip(request)});
  // Tras cualquier escritura (o en la primera visita) se envían los mensajes en cola y se reprograma la próxima alarma.
  if(request.method!=='GET'||!this.scheduled){this.scheduled=true;this.ctx.waitUntil(this.afterWrite())}
  return response}
 async afterWrite(){await this.api.flushOutbox().catch(e=>console.error('envíos',e));await this.schedule()}
 async alarm(){try{const changed=this.api.tick();await this.api.flushOutbox();if(changed||this.ctx.getWebSockets().length)this.broadcast()}catch(e){console.error('alarma',e)}await this.schedule()}
 webSocketMessage(ws,message){if(message==='snapshot')ws.send(this.snapshot())}
 webSocketClose(ws,code){try{ws.close(code,'cerrado')}catch{}}
 webSocketError(){}}

export default{
 async fetch(request,env,ctx){const url=new URL(request.url);
  const locked=await gate(request,env.SITE_PASSWORD,{ip:ip(request)});if(locked)return locked;
  if(url.pathname.startsWith('/assets/')||url.pathname==='/vista-responsive.html'){const r=await env.ASSETS.fetch(request);return noindex(r,env.SITE_PASSWORD)}
  // Cambiar DATA_VERSION y volver a publicar reinicia los datos de prueba (crea un almacenamiento nuevo).
  const app=env.APP.get(env.APP.idFromName('sesubasta-'+(env.DATA_VERSION||'1')));
  const response=await app.fetch(request);
  return response.status===101?response:noindex(response,env.SITE_PASSWORD)}};
