/* Contraseña de acceso para el sitio de pruebas (variable SITE_PASSWORD).
   Protege TODO el sitio, incluidas las herramientas /dev, y evita que buscadores lo indexen.
   Sin SITE_PASSWORD no hace nada (uso local). */
const crypto=require('node:crypto');
const {respond,json}=require('./aplicacion.cjs');
const COOKIE='ss_gate';
const token=pw=>crypto.createHmac('sha256',String(pw)).update('sesubasta-acceso-v1').digest('base64url');
const cookieOf=req=>{const m=/(?:^|;\s*)ss_gate=([^;]+)/.exec(req.headers.get('cookie')||'');return m?m[1]:''};
const safeEq=(a,b)=>a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const page=(error='',next='/')=>`<!doctype html><html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Acceso al sitio de pruebas · SeSubasta</title><link rel="icon" href="/assets/marca/favicon-sesubasta.png">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0E013D;font-family:Montserrat,Arial,sans-serif;color:#0E013D;padding:16px}main{background:#fff;border-radius:20px;padding:32px 28px;max-width:420px;width:100%}img{width:150px;margin-bottom:18px}h1{font-size:22px;margin:0 0 8px}p{color:#4A4470;font-size:15px;line-height:1.5}label{display:block;font-weight:700;margin:18px 0 6px}input{width:100%;box-sizing:border-box;min-height:48px;border:1.5px solid #CFCAE0;border-radius:12px;padding:10px 12px;font-size:16px}button{margin-top:16px;width:100%;min-height:48px;border:0;border-radius:12px;background:#C6FF34;color:#0E013D;font-weight:800;font-size:15px;cursor:pointer}.err{color:#B42323;font-weight:600;margin-top:10px}</style></head>
<body><main><img src="/assets/marca/logo-sesubasta.png" alt="SeSubasta"><h1>Sitio de pruebas del equipo</h1><p>Prototipo de Remates Dinámicos con datos ficticios. Ingresa la contraseña que te compartió el equipo.</p><form method="post" action="/__acceso"><input type="hidden" name="next" value="${String(next).replace(/[^\w/?=&%.-]/g,'')}"><label for="pw">Contraseña de acceso</label><input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>${error?`<p class="err" role="alert">${error}</p>`:''}<button>Entrar</button></form></main></body></html>`;
const tries=new Map();

/* Devuelve una Response si la solicitud debe detenerse aquí; null si puede continuar. */
async function gate(request,password,{ip='local'}={}){if(!password)return null;const url=new URL(request.url);const expected=token(password);
 if(url.pathname==='/robots.txt')return respond(200,'User-agent: *\nDisallow: /\n',{'Content-Type':'text/plain; charset=utf-8'});
 if(url.pathname.startsWith('/assets/marca/'))return null;
 if(url.pathname==='/__acceso'&&request.method==='POST'){const list=(tries.get(ip)||[]).filter(t=>Date.now()-t<600000);if(list.length>=10)return respond(429,page('Demasiados intentos. Espera unos minutos.'),{'Content-Type':'text/html; charset=utf-8'});
  const form=new URLSearchParams(await request.text());const next=(form.get('next')||'/').startsWith('/')?form.get('next'):'/';
  if(safeEq(token(form.get('password')||''),expected)){tries.delete(ip);const secure=url.protocol==='https:'?'; Secure':'';return respond(303,null,{Location:next||'/','Set-Cookie':`${COOKIE}=${expected}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30*86400}${secure}`})}
  list.push(Date.now());tries.set(ip,list);return respond(401,page('La contraseña no es correcta.',next),{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, nofollow'})}
 const got=cookieOf(request);if(got&&safeEq(got,expected))return null;
 if(url.pathname.startsWith('/api/'))return json(401,{code:'SITE_LOCKED',message:'Ingresa la contraseña del sitio de pruebas.'});
 return respond(401,page('',url.pathname+url.search),{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, nofollow','Cache-Control':'no-store'})}
/* Mientras haya contraseña, ninguna respuesta se indexa. */
function noindex(response,password){if(!password)return response;const r=new Response(response.body,response);r.headers.set('X-Robots-Tag','noindex, nofollow');return r}
module.exports={gate,noindex};
