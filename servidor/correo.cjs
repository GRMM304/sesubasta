/* Correos transaccionales y alertas: plantilla con la marca, enlace de baja por categoría y envío.
   Los mensajes se guardan primero en una bandeja de salida (outbox) dentro de la misma transacción
   y luego se envían. Sin proveedor configurado quedan en /dev/correos; con RESEND_API_KEY y MAIL_FROM
   se entregan de verdad mediante la API HTTP de Resend (https://resend.com). */
const crypto=require('node:crypto');
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const CATEGORIES={
 auction:{label:'avisos de tus subastas',why:'participas en esta subasta'},
 saved:{label:'avisos de propiedades guardadas',why:'guardaste esta propiedad'},
 new:{label:'alertas de nuevas propiedades',why:'activaste las alertas de nuevas propiedades'},
 news:{label:'novedades del blog',why:'te suscribiste a las novedades del blog'},
 account:{label:'mensajes de tu cuenta',why:'es un mensaje sobre tu cuenta'},
 staff:{label:'avisos del equipo',why:'eres parte del equipo de SeSubasta'}};

let base=process.env.SITE_URL||'http://127.0.0.1:8080';
const setBase=url=>{if(!process.env.SITE_URL&&url)base=url};
const abs=link=>!link?'':/^https?:/.test(link)?link:base+(link.startsWith('/')?link:'/'+link);

function secret(db){if(!db.meta.mailSecret)db.meta.mailSecret=crypto.randomBytes(32).toString('base64url');return db.meta.mailSecret}
const unsubToken=(db,userId,category)=>crypto.createHmac('sha256',secret(db)).update(userId+':'+category).digest('base64url').slice(0,32);
function verifyUnsub(db,userId,category,token){const ok=unsubToken(db,userId,category);return typeof token==='string'&&token.length===ok.length&&crypto.timingSafeEqual(Buffer.from(token),Buffer.from(ok))}

/* Plantilla genérica anterior (se conserva como respaldo); los correos usan servidor/plantillas.cjs. */
function render({title,body,link,cta,category,unsubscribeUrl}){const c=CATEGORIES[category]||CATEGORIES.account;const url=abs(link);
 const text=`${title}\n\n${body}\n\n${url?(cta||'Ver en SeSubasta')+': '+url+'\n\n':''}— SeSubasta · Remates Dinámicos\nRecibes este correo porque ${c.why}.${unsubscribeUrl?`\nDejar de recibir ${c.label}: ${unsubscribeUrl}`:''}\nPreferencias: ${abs('/mi-cuenta/perfil')}`;
 const html=`<!doctype html><html lang="es"><body style="margin:0;background:#F4F3F9;font-family:Arial,Helvetica,sans-serif;color:#0E013D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3F9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0E013D;padding:18px 24px"><span style="color:#ffffff;font-weight:800;font-size:18px">SeSubasta</span> <span style="color:#C6FF34;font-weight:700;font-size:13px">· Remates Dinámicos</span></td></tr>
<tr><td style="padding:26px 24px 8px"><h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#0E013D">${e(title)}</h1><p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4A4470">${e(body).replace(/\n/g,'<br>')}</p>
${url?`<p style="margin:0 0 22px"><a href="${e(url)}" style="display:inline-block;background:#0E013D;color:#ffffff;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px">${e(cta||'Ver en SeSubasta')}</a></p>`:''}</td></tr>
<tr><td style="padding:16px 24px 22px;border-top:1px solid #E4E1EE;font-size:12px;line-height:1.6;color:#4A4470">Recibes este correo porque ${e(c.why)}.${unsubscribeUrl?` <a href="${e(unsubscribeUrl)}" style="color:#5E17EB">Dejar de recibir ${e(c.label)}</a> ·`:''} <a href="${e(abs('/mi-cuenta/perfil'))}" style="color:#5E17EB">Preferencias</a><br>Prototipo con datos ficticios. Sin efectos jurídicos.</td></tr>
</table></td></tr></table></body></html>`;return {html,text}}

/* Envío real opcional. Nunca se reintenta un mensaje ya entregado; los fallidos se reintentan hasta 3 veces. */
/* Proveedor de envío: Brevo (BREVO_API_KEY) o Resend (RESEND_API_KEY), con remitente MAIL_FROM = "Nombre <correo>". */
/* El remitente se elige en Gestión → Configuración (config.mailFrom); MAIL_FROM del entorno queda como alternativa. */
let configuredFrom='';const setFrom=v=>{configuredFrom=v||''};const fromValue=()=>configuredFrom||process.env.MAIL_FROM||'';
const keyProvider=()=>process.env.BREVO_API_KEY?'brevo':process.env.RESEND_API_KEY?'resend':null;
const provider=()=>fromValue()&&keyProvider();
function parseFrom(v){const m=/^\s*(.*?)\s*<([^>]+)>\s*$/.exec(v||'');return m?{name:m[1]||'SeSubasta',email:m[2]}:{name:'SeSubasta',email:String(v||'').trim()}}
async function deliver(msg){const p=provider();if(!p)return {status:'local'};
 if(p==='brevo'){const from=parseFrom(fromValue());const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':process.env.BREVO_API_KEY,'Content-Type':'application/json',accept:'application/json'},body:JSON.stringify({sender:from,to:[{email:msg.to}],subject:msg.subject,...(msg.templateId&&msg.params?{templateId:Number(msg.templateId),params:msg.params}:{htmlContent:msg.html,textContent:msg.text}),headers:{'X-Mailin-custom':'mail_id:'+msg.id,...(msg.unsubscribeUrl?{'List-Unsubscribe':`<${msg.unsubscribeUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}:{})},tags:[msg.category||'cuenta',...(msg.template?['sesubasta-'+msg.template]:[])]})});if(!r.ok)throw Error('Brevo respondió '+r.status+': '+(await r.text()).slice(0,200));return {status:'sent'}}
 const key=process.env.RESEND_API_KEY,from=fromValue();
 const headers={Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':msg.id};
 const payload={from,to:[msg.to],subject:msg.subject,html:msg.html,text:msg.text,...(msg.unsubscribeUrl?{headers:{'List-Unsubscribe':`<${msg.unsubscribeUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}:{})};
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers,body:JSON.stringify(payload)});if(!r.ok)throw Error('Proveedor de correo respondió '+r.status);return {status:'sent'}}

/* Estado de la cuenta de Brevo conectada: titular y remitentes verificados (sin exponer la clave). */
async function brevoStatus(){const key=process.env.BREVO_API_KEY;if(!key)return {connected:false};const h={'api-key':key,accept:'application/json'};
 const [acc,snd]=await Promise.all([fetch('https://api.brevo.com/v3/account',{headers:h}),fetch('https://api.brevo.com/v3/senders',{headers:h})]);
 if(!acc.ok)return {connected:false,error:'Brevo rechazó la clave ('+acc.status+'). Revisa que esté bien copiada y activa.'};
 const a=await acc.json(),s=snd.ok?await snd.json():{senders:[]};return {connected:true,account:a.email,company:a.companyName||'',senders:(s.senders||[]).map(x=>({name:x.name,email:x.email,active:!!x.active}))}}
/* Publica (crea o actualiza) las plantillas en Brevo. Reconoce por nombre las que ya existen para no duplicarlas. */
async function syncBrevoTemplates(list,known={}){const key=process.env.BREVO_API_KEY;const h={'api-key':key,'Content-Type':'application/json',accept:'application/json'};const sender=parseFrom(fromValue());
 const r=await fetch('https://api.brevo.com/v3/smtp/templates?limit=1000&offset=0',{headers:h});if(!r.ok)throw Error('Brevo respondió '+r.status+' al listar plantillas.');const existing=new Map(((await r.json()).templates||[]).map(t=>[t.name,t.id]));
 const out={};for(const t of list){const body=JSON.stringify({templateName:t.templateName,subject:t.subject,htmlContent:t.htmlContent,sender:{name:sender.name,email:sender.email},tag:t.tag,isActive:true});const id=known[t.key]?.id&&[...existing.values()].includes(known[t.key].id)?known[t.key].id:existing.get(t.templateName);
  const res=id?await fetch('https://api.brevo.com/v3/smtp/templates/'+id,{method:'PUT',headers:h,body}):await fetch('https://api.brevo.com/v3/smtp/templates',{method:'POST',headers:h,body});
  if(!res.ok)throw Error(`Brevo respondió ${res.status} con la plantilla "${t.templateName}": `+(await res.text()).slice(0,160));out[t.key]={id:id||(await res.json()).id,at:Date.now()}}
 return out}
module.exports={syncBrevoTemplates,setFrom,fromValue,keyProvider,brevoStatus,provider,CATEGORIES,render,deliver,unsubToken,verifyUnsub,setBase,abs};
