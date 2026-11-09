/* Plantillas transaccionales de SeSubasta · Remates Dinámicos.
   Cada tipo de correo tiene su plantilla con la misma línea gráfica. El contenido de cada envío llega como
   parámetros (asunto, título, párrafos, detalle, botón, enlace, baja). Se publican en Brevo con su sintaxis
   ({{ params.x }}, {% for %}, {% if %}) para que el equipo pueda editarlas allí, y se renderizan aquí mismo
   como alternativa cuando Brevo no está conectado (y para la bandeja /dev/correos). */
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const TEMPLATES={
 verificacion:{name:'Verificación de correo',group:'Cuenta',etiqueta:'Tu cuenta',why:'creaste una cuenta en SeSubasta'},
 recuperar_clave:{name:'Recuperación de contraseña',group:'Cuenta',etiqueta:'Seguridad',why:'se pidió cambiar la contraseña de tu cuenta'},
 clave_cambiada:{name:'Contraseña cambiada',group:'Cuenta',etiqueta:'Seguridad',why:'es un aviso de seguridad de tu cuenta'},
 eliminacion_solicitud:{name:'Solicitud de eliminación de cuenta',group:'Cuenta',etiqueta:'Privacidad',why:'solicitaste eliminar tu cuenta'},
 solicitud_recibida:{name:'Solicitud de venta recibida',group:'Solicitudes',etiqueta:'Vender con SeSubasta',why:'enviaste una propiedad para evaluación'},
 consulta_recibida:{name:'Consulta recibida',group:'Solicitudes',etiqueta:'Consulta',why:'nos escribiste desde el sitio'},
 respuesta_solicitud:{name:'Respuesta del equipo',group:'Solicitudes',etiqueta:'Respuesta',why:'enviaste una solicitud o consulta'},
 monto_aceptado:{name:'Oferta aceptada (comprobante)',group:'Subastas',etiqueta:'Comprobante',why:'registraste una oferta en una subasta'},
 monto_superado:{name:'Tu oferta fue superada',group:'Subastas',etiqueta:'Te superaron',why:'participas en esta subasta'},
 cierre_proximo:{name:'Recordatorio de cierre',group:'Subastas',etiqueta:'Cierre próximo',why:'participas o guardaste esta subasta'},
 subasta_cambio:{name:'Suspensión, reanudación o cancelación',group:'Subastas',etiqueta:'Cambio en la subasta',why:'participas o guardaste esta subasta'},
 resultado:{name:'Resultado y adjudicación',group:'Subastas',etiqueta:'Resultado',why:'participaste en esta subasta'},
 garantia:{name:'Garantía de seriedad',group:'Subastas',etiqueta:'Garantía',why:'constituiste una garantía para ofertar'},
 mensaje_equipo:{name:'Mensaje del equipo sobre un registro',group:'Subastas',etiqueta:'Mensaje del equipo',why:'participas en esta subasta'},
 propiedad_guardada:{name:'Aviso de propiedad guardada',group:'Alertas',etiqueta:'Propiedad guardada',why:'guardaste esta propiedad'},
 nueva_propiedad:{name:'Alerta de nueva propiedad',group:'Alertas',etiqueta:'Nueva propiedad',why:'activaste las alertas de nuevas propiedades'},
 novedad_blog:{name:'Novedad del blog',group:'Alertas',etiqueta:'Blog',why:'te suscribiste a las novedades del blog'},
 codigo_acceso:{name:'Código de acceso del equipo (MFA)',group:'Equipo',etiqueta:'Código de acceso',why:'intentaste ingresar al panel del equipo'},
 equipo_invitacion:{name:'Invitación al equipo',group:'Equipo',etiqueta:'Invitación',why:'te invitaron al equipo de SeSubasta'},
 equipo_recuperar:{name:'Recuperación de acceso del equipo',group:'Equipo',etiqueta:'Seguridad',why:'se pidió restablecer tu acceso al equipo'},
 equipo_aviso:{name:'Aviso interno del equipo',group:'Equipo',etiqueta:'Gestión',why:'eres parte del equipo de SeSubasta'},
 tarea:{name:'Tarea asignada y seguimiento',group:'Equipo',etiqueta:'Tareas',why:'eres responsable o creaste esta tarea'},
 cuenta:{name:'Aviso general de cuenta',group:'Cuenta',etiqueta:'Tu cuenta',why:'es un mensaje sobre tu cuenta'},
 prueba:{name:'Correo de prueba',group:'Sistema',etiqueta:'Prueba',why:'el equipo probó el envío de correos'}};

/* Colores y tipografía del Manual de Marca v2.0. En correo se usa Arial (el correo no carga Archivo) y el lima solo va sobre azul noche. */
const C={navy:'#0E013D',lime:'#C6FF34',slate:'#4A4470',cloud:'#F4F3F9',line:'#E4E1EE',violet:'#5E17EB'};
const LOGO=(process.env.SITE_URL||'https://sesubasta.cl')+'/assets/marca/logo-sesubasta-negativo.png';
/* Layout único. En modo "brevo" emite la sintaxis de plantillas de Brevo; en modo local, el contenido real. */
function layout(t,{brevo=false,p={}}={}){const v=k=>brevo?`{{ params.${k} }}`:e(p[k]??'');
 const paragraphs=brevo?`{% for parrafo in params.parrafos %}<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.slate}">{{ parrafo }}</p>{% endfor %}`:(p.parrafos||[]).map(x=>`<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.slate}">${e(x)}</p>`).join('');
 const row=(l,val)=>`<tr><td style="padding:9px 12px;border-bottom:1px solid ${C.line};font-size:13px;color:${C.slate}">${l}</td><td style="padding:9px 12px;border-bottom:1px solid ${C.line};font-size:14px;font-weight:700;color:${C.navy};text-align:right">${val}</td></tr>`;
 const details=brevo?`{% if params.detalles %}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${C.cloud};border-radius:12px">{% for d in params.detalles %}${row('{{ d.etiqueta }}','{{ d.valor }}')}{% endfor %}</table>{% endif %}`:(p.detalles&&p.detalles.length?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${C.cloud};border-radius:12px">${p.detalles.map(d=>row(e(d.etiqueta),e(d.valor))).join('')}</table>`:'');
 const code=brevo?`{% if params.codigo %}<p style="margin:6px 0 22px;font-size:32px;letter-spacing:8px;font-weight:800;color:${C.navy};background:${C.cloud};border-radius:12px;padding:14px;text-align:center">{{ params.codigo }}</p>{% endif %}`:(p.codigo?`<p style="margin:6px 0 22px;font-size:32px;letter-spacing:8px;font-weight:800;color:${C.navy};background:${C.cloud};border-radius:12px;padding:14px;text-align:center">${e(p.codigo)}</p>`:'');
 const btn=`<p style="margin:0 0 24px"><a href="${v('enlace')}" style="display:inline-block;background:${C.navy};color:#ffffff;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:10px;font-size:15px">${v('boton')}</a></p>`;
 const cta=brevo?`{% if params.enlace %}${btn}{% endif %}`:(p.enlace?btn:'');
 const unsub=brevo?`{% if params.baja %} <a href="{{ params.baja }}" style="color:${C.violet}">Dejar de recibir estos avisos</a> ·{% endif %}`:(p.baja?` <a href="${e(p.baja)}" style="color:${C.violet}">Dejar de recibir estos avisos</a> ·`:'');
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${v('asunto')}</title></head><body style="margin:0;background:${C.cloud};font-family:Arial,Helvetica,sans-serif;color:${C.navy}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${v('resumen')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cloud};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:${C.navy};padding:18px 26px"><img src="${LOGO}" width="132" alt="SeSubasta.cl" style="display:block;width:132px;height:auto;border:0;color:#ffffff;font-weight:700;font-size:18px"></td></tr>
<tr><td style="padding:28px 26px 6px"><p style="margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${C.violet}">${e(t.etiqueta)}</p><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${C.navy}">${v('titulo')}</h1>${code}${paragraphs}${details}${cta}</td></tr>
<tr><td style="padding:16px 26px 24px;border-top:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.slate}">Recibes este correo porque ${e(t.why)}.${unsub} <a href="${v('preferencias')}" style="color:${C.violet}">Preferencias</a><br>SeSubasta.cl</td></tr>
</table></td></tr></table></body></html>`}

const text=(p)=>[p.titulo,'',p.codigo?`Código: ${p.codigo}`:'',...(p.parrafos||[]),'',...(p.detalles||[]).map(d=>`${d.etiqueta}: ${d.valor}`),'',p.enlace?`${p.boton}: ${p.enlace}`:'','','— SeSubasta.cl',p.baja?`Dejar de recibir estos avisos: ${p.baja}`:'',`Preferencias: ${p.preferencias}`].filter((l,i,a)=>l!==''||a[i-1]!=='').join('\n');
const render=(key,p)=>{const t=TEMPLATES[key]||TEMPLATES.cuenta;return {html:layout(t,{p}),text:text(p),subject:p.asunto}};
const brevoTemplate=key=>{const t=TEMPLATES[key];return {templateName:`SeSubasta · ${t.name}`,subject:'{{ params.asunto }}',htmlContent:layout(t,{brevo:true}),tag:'sesubasta-'+key}};
module.exports={TEMPLATES,render,brevoTemplate};
