/* Mensajes de WhatsApp para el equipo.
   1) Enlace directo (wa.me): siempre disponible; abre WhatsApp en el dispositivo de quien envía con el texto listo.
   2) Envío automático: si se configuran WHATSAPP_TOKEN y WHATSAPP_PHONE_ID (WhatsApp Business Cloud API de Meta),
      el servidor envía una plantilla aprobada (WHATSAPP_TEMPLATE, por defecto "aviso_tarea", idioma es) con el texto
      como parámetro. Sin configuración, los mensajes quedan en la bandeja local /dev/whatsapp. */

/* Normaliza a formato internacional E.164. Acepta móviles chilenos escritos como 9 1234 5678, +56 9 1234 5678, etc. */
function normalizePhone(v){const raw=String(v||'').replace(/[\s().-]/g,'');if(!raw)return null;let d=raw.replace(/^\+/,'');if(/^9\d{8}$/.test(d))d='56'+d;if(/^0?569\d{8}$/.test(d))d=d.replace(/^0/,'');if(!/^\d{8,15}$/.test(d))return null;return '+'+d}
const validWhatsapp=v=>!!normalizePhone(v);
const prettyPhone=e=>{const m=/^\+56(9)(\d{4})(\d{4})$/.exec(e||'');return m?`+56 ${m[1]} ${m[2]} ${m[3]}`:e||''};
const waLink=(phone,text)=>{const n=normalizePhone(phone);return n?`https://wa.me/${n.slice(1)}?text=${encodeURIComponent(text)}`:''};

async function deliver(msg){const token=process.env.WHATSAPP_TOKEN,phoneId=process.env.WHATSAPP_PHONE_ID;if(!token||!phoneId)return {status:'local'};
 const body={messaging_product:'whatsapp',to:msg.to.replace(/^\+/,''),type:'template',template:{name:process.env.WHATSAPP_TEMPLATE||'aviso_tarea',language:{code:process.env.WHATSAPP_LANG||'es'},components:[{type:'body',parameters:[{type:'text',text:msg.text.slice(0,1000)}]}]}};
 const r=await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw Error('WhatsApp respondió '+r.status);return {status:'sent'}}

module.exports={normalizePhone,validWhatsapp,prettyPhone,waLink,deliver};
