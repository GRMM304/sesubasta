/* ===== Marco: cabeceras por audiencia, navegación, pie, render de rutas y modo archivo ===== */
const SOCIAL_ICONS={
 facebook:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07"/></svg>',
 instagram:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0m0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8m6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88"/></svg>',};
const ROLE_NAMES={internal_contributor:'Colaborador',legal:'Legal',operator:'Operador',content_editor:'Editor de contenido',general_admin:'Administrador general',buyer:'Comprador'};
const hasRole=(...roles)=>!!state.staff&&(state.staff.roles.includes('general_admin')||roles.some(r=>state.staff.roles.includes(r)));
const STAFF_NAV=[
 {path:'/gestion',label:'Resumen',icon:'grid',roles:[]},
 {path:'/gestion/propiedades',label:'Propiedades',icon:'home',roles:['internal_contributor','legal']},
 {path:'/gestion/revisiones',label:'Revisiones',icon:'check',roles:['internal_contributor','legal']},
 {path:'/gestion/remates',label:'Subastas',icon:'clock',roles:['operator']},
 {path:'/gestion/ofertas',label:'Actividad',icon:'list',roles:['operator']},
 {path:'/gestion/solicitudes',label:'Solicitudes',icon:'file',roles:['operator']},
 {path:'/gestion/blog',label:'Blog',icon:'doc',roles:['content_editor']},
 {path:'/gestion/usuarios',label:'Usuarios y roles',icon:'user',roles:['general_admin']},
 {path:'/gestion/configuracion',label:'Configuración',icon:'filter',roles:['general_admin']},
 {path:'/gestion/auditoria',label:'Auditoría',icon:'shield',roles:['general_admin']}];
const staffNav=()=>STAFF_NAV.filter(n=>!n.roles.length||hasRole(...n.roles));

const PUBLIC_LINKS=[['/','Inicio'],['/remates','Remates'],['/blog','Blog'],['/como-funciona','Cómo funciona'],['/ingresar-inmueble','Ingresa tu inmueble']];
const isActive=(path,link)=>link==='/'?path==='/':path===link||path.startsWith(link+'/');
function chrome(r,path){const area=r.area||'public';document.body.dataset.area=area;document.body.classList.toggle('has-sticky',!!r.sticky);
 const top=$('#topbar'),nav=$('#bottomNav'),foot=$('#footer'),banner=$('#demoBanner');
 banner.innerHTML=toHtml(area==='staff'?h`Entorno local del equipo · datos ficticios · los permisos se validan en el servidor`:FILE_MODE?h`Vista individual sin servidor · sin sincronización entre personas · <a href="${href('/prototipo/pantallas')}">qué requiere el servidor</a>`:'');banner.hidden=area!=='staff'&&!FILE_MODE;
 if(area==='staff'){const u=state.staff;top.innerHTML=toHtml(h`<a class="brand" href="${href('/gestion')}" aria-label="SeSubasta, gestión"><img src="assets/marca/logo-sesubasta-negativo.png" alt="SeSubasta" width="120" height="67"></a><span class="staff-badge">Gestión</span>${u?h`<a class="staff-who" href="${href('/gestion/mi-perfil')}" title="Mi perfil"><strong>${u.name}</strong><small>${u.roles.map(x=>ROLE_NAMES[x]||x).join(' · ')}</small></a><button class="btn btn-outline btn-sm" data-action="staff-logout" aria-label="Cerrar sesión">${icon('logout')}<span>Cerrar sesión</span></button>`:''}`);
  nav.innerHTML=u?toHtml(h`${staffNav().slice(0,4).map(n=>h`<a class="nav-item ${isActive(path,n.path)&&(n.path!=='/gestion'||path==='/gestion')?'active':''}" href="${href(n.path)}" ${isActive(path,n.path)?raw('aria-current="page"'):''}><span class="nav-icon">${icon(n.icon)}${n.path==='/gestion/tareas'&&state.staffTasks?.mine?h`<span class="dot-count">${state.staffTasks.mine}</span>`:''}</span><span>${n.label}</span></a>`)}<button class="nav-item" data-action="staff-menu"><span class="nav-icon">${icon('menu')}</span><span>Más</span></button>`):'';nav.hidden=!u||!!r.focus;nav.setAttribute('aria-label','Navegación del equipo');foot.innerHTML='';foot.hidden=true;return}
 const u=state.user,showBack=r.back!==false&&path!=='/'&&!['/remates','/mi-cuenta/guardadas','/mi-cuenta','/blog'].includes(path);
 top.innerHTML=toHtml(h`${showBack?h`<button class="icon-btn mobile-only" data-action="back" data-fallback="${r.parent||'/'}" aria-label="Volver">${icon('back')}</button>`:''}<a class="brand" href="${href('/')}" aria-label="SeSubasta, inicio de Remates Dinámicos"><img src="assets/marca/logo-sesubasta.png" alt="SeSubasta" width="176" height="68"></a>
  ${r.focus?'':h`<nav class="desktop-links" aria-label="Principal">${PUBLIC_LINKS.map(([p,l])=>h`<a href="${href(p)}" ${isActive(path,p)?raw('aria-current="page"'):''}>${l}</a>`)}</nav>`}
  <div class="head-actions"><div class="currency-switch" role="group" aria-label="Moneda de visualización">${['UF','CLP'].map(c=>h`<button type="button" data-action="currency" data-value="${c}" aria-pressed="${state.currency===c}" class="${state.currency===c?'active':''}">${c}</button>`)}</div>
  ${u?h`<a class="icon-btn" href="${href('/mi-cuenta/notificaciones')}" aria-label="Notificaciones${state.unread?`, ${state.unread} sin leer`:''}">${icon('bell')}${state.unread?h`<span class="dot-count">${state.unread>9?'9+':state.unread}</span>`:''}</a><a class="account-link" href="${href('/mi-cuenta')}">${icon('user')}<span class="desktop-only">${u.name.split(' ')[0]}</span></a>`:h`<a class="btn btn-outline btn-sm desktop-only" href="${href('/ingresar')}">Ingresar</a><a class="btn btn-dark btn-sm desktop-only" href="${href('/registro')}">Crear cuenta</a><a class="icon-btn mobile-only" href="${href('/ingresar')}" aria-label="Ingresar o crear cuenta">${icon('user')}</a>`}
  ${r.focus?'':h`<button class="icon-btn below-desktop" data-action="menu" aria-expanded="false" aria-controls="mobileMenu" aria-label="Más opciones">${icon('menu')}</button>`}</div>`);
 $('#mobileMenu')?.remove();
 const tabs=[['/','Inicio','home'],['/remates','Explorar','explore'],['/mi-cuenta/guardadas','Guardadas','heart'],['/mi-cuenta','Cuenta','user']];
 const activeTab=path==='/'?'/':path.startsWith('/remates')?'/remates':path.startsWith('/mi-cuenta/guardadas')?'/mi-cuenta/guardadas':path.startsWith('/mi-cuenta')||['/ingresar','/registro'].includes(path)?'/mi-cuenta':'';
 nav.innerHTML=toHtml(tabs.map(([p,l,i])=>h`<a class="nav-item ${activeTab===p?'active':''}" href="${href(p)}" ${activeTab===p?raw('aria-current="page"'):''}><span class="nav-icon">${icon(i)}</span><span>${l}</span></a>`));nav.setAttribute('aria-label','Navegación principal');
 nav.hidden=!!(r.focus||r.sticky);
 const c=state.config?.contact||{};
 const so=state.config?.social||{};const NETS=[['instagram','Instagram'],['facebook','Facebook']].filter(([k])=>so[k]);
 foot.hidden=!!r.focus;foot.innerHTML=r.focus?'':toHtml(h`<div class="footer-grid"><div class="footer-brand"><a href="${href('/')}" aria-label="SeSubasta, inicio"><img src="assets/marca/logo-sesubasta-vertical-negativo.png" alt="SeSubasta.cl" width="160" height="150" loading="lazy"></a><p class="footer-product">Remates Dinámicos</p><p>Subastas de propiedades en vivo con cierre fijo y sin inscripción por propiedad.</p>${NETS.length?h`<ul class="social" aria-label="Redes sociales de SeSubasta">${NETS.map(([k,l])=>h`<li><a href="${so[k]}" target="_blank" rel="noopener" aria-label="${l} de SeSubasta (se abre en una pestaña nueva)">${raw(SOCIAL_ICONS[k])}</a></li>`)}</ul>`:''}</div>
  <div><h2>Remates</h2><a href="${href('/remates')}">Explorar remates</a><a href="${href('/como-funciona')}">Cómo funciona</a><a href="${href('/ingresar-inmueble')}">Ingresa tu inmueble</a><a href="${href('/blog')}">Blog</a></div>
  <div><h2>Ayuda</h2><a href="${href('/preguntas-frecuentes')}">Preguntas frecuentes</a><a href="${href('/contacto')}">Contacto</a>${c.email?h`<a href="mailto:${c.email}">${c.email}</a>`:''}</div>
  <div><h2>Legal</h2><a href="${href('/privacidad')}">Privacidad</a><a href="${href('/terminos')}">Términos y bases</a><a href="${href('/cookies')}">Cookies</a><button class="link-btn" data-action="cookie-settings">Preferencias de cookies</button><a href="${href('/eliminacion-de-datos')}">Eliminación de datos</a></div></div>
  <p class="footer-legal">© ${new Date().getFullYear()} SeSubasta.cl · Prototipo con propiedades, imágenes y valores ilustrativos. Sin pagos ni efectos jurídicos.</p>`)}
actions.menu=el=>{const open=el.getAttribute('aria-expanded')==='true';$('#mobileMenu')?.remove();el.setAttribute('aria-expanded',String(!open));if(open)return;const m=document.createElement('nav');m.id='mobileMenu';m.className='mobile-menu';m.setAttribute('aria-label','Menú');m.innerHTML=toHtml(h`${[...PUBLIC_LINKS.slice(2),['/preguntas-frecuentes','Preguntas frecuentes'],['/contacto','Contacto']].map(([p,l])=>h`<a href="${href(p)}">${l}</a>`)}${state.user?'':h`<a href="${href('/registro')}">Crear cuenta</a>`}`);$('#topbar').after(m);m.querySelector('a').focus();m.addEventListener('keydown',e=>{if(e.key==='Escape'){m.remove();el.setAttribute('aria-expanded','false');el.focus()}})};
actions.back=el=>back(el.dataset.fallback||'/');
actions.currency=el=>{state.currency=el.dataset.value;store.set('ss-currency',state.currency);Analytics.event('currency_changed',{currency:state.currency});render({keepScroll:true})};
actions['staff-menu']=()=>{openDialog({title:'Menú del equipo',body:h`<nav class="staff-menu-list">${staffNav().map(n=>h`<a href="${href(n.path)}" data-close>${icon(n.icon)} ${n.label}</a>`)}<a href="${href('/gestion/mi-perfil')}" data-close>${icon('user')} Mi perfil</a><button class="link-btn" data-action="staff-logout" data-close>${icon('logout')} Cerrar sesión</button></nav>`})};

/* ---------- vistas de sistema (SYS-01 a SYS-08) ---------- */
const sysView=(title,text,actionsHtml='',kind='info')=>({title,html:h`<section class="system-state ${kind}"><span class="system-icon">${icon(kind==='error'?'alert':kind==='lock'?'lock':'spark')}</span><h1 tabindex="-1">${title}</h1><p>${text}</p><div class="button-row center">${actionsHtml||h`<a class="btn btn-dark" href="${href('/')}">Ir al inicio</a><a class="btn btn-outline" href="${href('/remates')}">Explorar remates</a>`}</div></section>`});
const notFoundView=()=>sysView('Página no encontrada','La dirección no existe o la publicación ya no está disponible.');
const forbiddenView=()=>sysView('Acceso restringido','Tu cuenta no tiene permiso para ver esta sección. Si crees que es un error, pide acceso al Administrador general.',h`<a class="btn btn-dark" href="${href(state.staff?'/gestion':'/')}">Volver</a>`,'lock');
const offlineView=()=>sysView('Sin conexión','No pudimos comunicarnos con el servidor. Revisa tu conexión; nada se envió de forma automática.',h`<button class="btn btn-dark" data-action="reload">Reintentar</button>`,'error');
const serverRequiredView=title=>sysView(title||'Función disponible con el servidor local',h`Esta pantalla guarda datos en el servidor de prueba. Ejecuta <code>npm start</code> en la carpeta del sitio y abre <strong>http://127.0.0.1:8080</strong>. La vista individual solo permite explorar y probar una subasta local.`,h`<a class="btn btn-dark" href="${href('/remates')}">Explorar remates</a>`,'lock');
actions.reload=()=>render();
const skeleton=()=>h`<div class="page-loading" role="status" aria-label="Cargando"><div class="skel skel-title"></div><div class="skel-grid">${[1,2,3].map(()=>h`<div class="skel skel-card"></div>`)}</div></div>`;

/* ---------- render de rutas ---------- */
let firstRender=true;
async function render({restore,keepScroll}={}){const token=++renderToken;const url=currentUrl();const path=url.pathname.replace(/\/+$/,'')||'/';const query=Object.fromEntries(url.searchParams);
 const m=match(path);const r=m?m.r:{area:'public',view:notFoundView,status:404};const params=m?.params||{};
 if(r.auth==='buyer'&&!state.user){return navigate('/ingresar?volver='+encodeURIComponent(path+url.search),{replace:true})}
 if(r.auth==='staff'&&!state.staff){return navigate('/admin-login?volver='+encodeURIComponent(path+url.search),{replace:true})}
 if(r.guest==='buyer'&&state.user&&!query.volver){return navigate('/mi-cuenta',{replace:true})}
 if(r.auth==='staff'&&state.staff&&!state.staff.whatsapp&&path!=='/gestion/mi-perfil'){toast('Registra tu WhatsApp para continuar.');return navigate('/gestion/mi-perfil',{replace:true})}
 if(r.guest==='staff'&&state.staff){return navigate(query.volver&&query.volver.startsWith('/gestion')?query.volver:'/gestion',{replace:true})}
 const view=r.auth==='staff'&&r.roles&&!hasRole(...r.roles)?forbiddenView:(FILE_MODE&&r.server?()=>serverRequiredView(r.title):r.view);
 chrome(r,path);const main=$('#main');main.setAttribute('aria-busy','true');const slow=setTimeout(()=>{if(token===renderToken)main.innerHTML=toHtml(skeleton())},140);
 let out;try{out=await view({params,query,url,path})}catch(e){out=e instanceof ApiError?(e.status===404?notFoundView():e.status===401?(state.staff&&path.startsWith('/gestion')?(state.staff=null,{redirect:'/admin-login?volver='+encodeURIComponent(path)}):{redirect:'/ingresar?volver='+encodeURIComponent(path)}):e.status===403?forbiddenView():e.status===0?offlineView():e.code==='SERVER_REQUIRED'?serverRequiredView():sysView('No pudimos completar la acción',e.message,'','error')):(console.error(e),sysView('No pudimos cargar esta pantalla','Ocurrió un error inesperado. Intenta nuevamente.',h`<button class="btn btn-dark" data-action="reload">Reintentar</button>`,'error'))}
 clearTimeout(slow);if(token!==renderToken)return;if(out?.redirect)return navigate(out.redirect,{replace:true});
 main.innerHTML=toHtml(out.html);main.removeAttribute('aria-busy');document.title=(out.title?out.title+' · ':'')+(r.area==='staff'?'Gestión SeSubasta':'SeSubasta');
 restoreDrafts(main);try{out.after?.(main)}catch(e){console.error(e)}Live.patch();
 if(restore!=null)requestAnimationFrame(()=>scrollTo(0,restore));else if(!keepScroll){const t=!FILE_MODE&&location.hash.length>1&&document.getElementById(decodeURIComponent(location.hash.slice(1)));t?requestAnimationFrame(()=>t.scrollIntoView()):scrollTo(0,0)}
 if(!firstRender&&!keepScroll){const t=$('h1',main);if(t){t.tabIndex=-1;t.focus({preventScroll:true})}}firstRender=false;
 Analytics.page(path,document.title);if(r.area!=='staff')cookieBanner()}

/* ---------- sesión ---------- */
async function refreshUser(){try{state.user=(await GET('/api/v1/auth/me')).user}catch{state.user=null}if(state.user){try{const [s,n]=await Promise.all([GET('/api/v1/me/saved'),GET('/api/v1/me/notifications')]);state.saved=new Set(s.ids);state.unread=n.unread}catch{}}else{state.saved=new Set();state.unread=0}}
async function refreshStaff(){if(FILE_MODE){state.staff=null;return}try{state.staff=(await GET('/api/v1/admin/auth/me')).user}catch{state.staff=null}}
actions['staff-logout']=async()=>{try{await POST('/api/v1/admin/auth/logout')}catch{}state.staff=null;toast('Sesión del equipo cerrada.');navigate('/admin-login',{replace:true})};

/* ---------- modo archivo: datos de muestra y motor local, sin servidor ---------- */
const LocalApi=(()=>{let seed=null,engine=null,user=null;
 function init(){seed=window.__SEED;const shift=Date.now()-seed.builtAt;const st=session.get('ss-local-auctions');let auctions;if(st&&st.schema===2&&st.seedBuiltAt===seed.builtAt)auctions=st;else{auctions=JSON.parse(JSON.stringify(seed.subastas));for(const a of Object.values(auctions.auctions)){a.start+=shift;a.end+=shift;a.bids.forEach(b=>b.time+=shift)}auctions.seedBuiltAt=seed.builtAt}
  engine=new AuctionCore.Engine(auctions,{persist:s=>session.set('ss-local-auctions',s)});user=session.get('ss-local-user')}
 const SR=()=>{throw new ApiError(503,{code:'SERVER_REQUIRED',message:'Esta función necesita el servidor local (npm start).'})};
 const props=()=>seed.properties.map(p=>({...p,conditions:{...p.conditions,opensAt:engine.state.auctions[p.auctionId]?.start,closesAt:engine.state.auctions[p.auctionId]?.end},auction:p.auctionId&&engine.state.auctions[String(p.auctionId)]?engine.snapshot(p.auctionId):null}));
 const posts=()=>seed.posts;
 async function call(method,url,body){if(!seed)init();const u=new URL(url,'http://local');const p=u.pathname,q=Object.fromEntries(u.searchParams);let m;
  if(method==='GET'&&p==='/api/v1/config')return seed.config;
  if(method==='GET'&&p==='/api/v1/properties')return {...CatalogCore.query(props(),q,seed.config.uf),uf:seed.config.uf,facets:CatalogCore.facets(props())};
  if(method==='GET'&&p==='/api/v1/properties/suggest')return {items:CatalogCore.suggest(props(),q.q)};
  if(method==='GET'&&(m=p.match(/^\/api\/v1\/properties\/([^/]+)$/))){const x=props().find(v=>v.slug===m[1]);if(!x)throw new ApiError(404,{message:'No disponible'});return {property:x,related:props().filter(v=>v.id!==x.id&&v.type===x.type).slice(0,3),uf:seed.config.uf,result:null}}
  if(method==='GET'&&p==='/api/v1/auctions')return {auctions:engine.snapshots(seed.properties.map(x=>String(x.auctionId))),serverNow:Date.now()};
  if(method==='POST'&&(m=p.match(/^\/api\/v1\/auctions\/(\d+)\/bids$/))){if(!user)throw new ApiError(401,{message:'Inicia sesión para ofertar.'});try{const r=engine.submit({...body,id:Number(m[1]),buyer:user.id});return {receipt:r.receipt,snapshot:r.snapshot,duplicate:r.duplicate}}catch(e){throw new ApiError(e.status||409,{code:e.code,message:e.message,snapshot:engine.state.auctions[m[1]]?engine.snapshot(m[1]):null})}}
  if(method==='GET'&&p==='/api/v1/me/offers'){if(!user)throw new ApiError(401,{});return {items:engine.own(user.id).map(o=>{const x=seed.properties.find(v=>v.auctionId===o.id);return {...o,property:x&&{title:x.title,slug:x.slug,publicId:x.publicId}}})}}
  if(method==='GET'&&p==='/api/v1/auth/me')return {user};
  if(method==='POST'&&p==='/api/demo-session'){user={id:body.profile,name:body.profile==='camila'?'Camila Demo':'Alex Demo',email:body.profile+'@comprador.demo.cl',emailVerified:true,roles:['buyer'],accountType:'public',termsVersion:seed.config.termsVersion,prefs:{}};session.set('ss-local-user',user);return {user}}
  if(method==='POST'&&p==='/api/v1/auth/logout'){user=null;session.del('ss-local-user');return {ok:true}}
  if(method==='GET'&&p==='/api/v1/me/saved'){const ids=store.get('ss-local-saved',[]);return {ids,items:props().filter(x=>ids.includes(x.id))}}
  if((m=p.match(/^\/api\/v1\/properties\/(\d+)\/save$/))){if(!user)throw new ApiError(401,{});let ids=store.get('ss-local-saved',[]);ids=method==='DELETE'?ids.filter(x=>x!==Number(m[1])):[...new Set([...ids,Number(m[1])])];store.set('ss-local-saved',ids);return {saved:method!=='DELETE'}}
  if(method==='GET'&&p==='/api/v1/me/notifications')return {items:[],unread:0};
  if(method==='GET'&&p==='/api/v1/blog/posts'){let rows=posts();if(q.category)rows=rows.filter(x=>x.category?.slug===q.category);if(q.q)rows=rows.filter(x=>CatalogCore.fold(x.title).includes(CatalogCore.fold(q.q)));const off=Number(q.offset)||0,lim=Number(q.limit)||9;return {items:rows.slice(off,off+lim),total:rows.length,categories:seed.categories}}
  if(method==='GET'&&(m=p.match(/^\/api\/v1\/blog\/posts\/([^/]+)$/))){const x=posts().find(v=>v.slug===m[1]);if(!x)throw new ApiError(404,{});return {post:x,related:posts().filter(v=>v.id!==x.id).slice(0,3)}}
  if(method==='GET'&&(m=p.match(/^\/api\/v1\/legal\/(\w+)$/)))return seed.legal[m[1]];
  return SR()}
 return {call}})();
