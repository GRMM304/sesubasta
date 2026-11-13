/* ===== SeSubasta · núcleo de la aplicación: utilidades, API, router, formularios, analítica ===== */
'use strict';
const FILE_MODE=location.protocol==='file:';
const $=(s,root=document)=>root.querySelector(s),$$=(s,root=document)=>[...root.querySelectorAll(s)];

/* ---------- HTML seguro: toda interpolación se escapa salvo que se marque explícitamente ---------- */
class Safe{constructor(v){this.v=v}toString(){return this.v}}
const raw=v=>new Safe(String(v??''));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toHtml=v=>v==null||v===false?'':v instanceof Safe?v.v:Array.isArray(v)?v.map(toHtml).join(''):esc(v);
function h(strings,...vals){let out=strings[0];for(let i=0;i<vals.length;i++)out+=toHtml(vals[i])+strings[i+1];return new Safe(out)}
const slug=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
/* Markdown reducido para el blog y textos legales: títulos, párrafos, listas, negrita y enlaces seguros. */
function md(text){const inline=t=>esc(t).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g,(m,label,url)=>`<a href="${url}"${url.startsWith('http')?' rel="noopener" target="_blank"':''}>${label}</a>`);
 return raw(String(text||'').split(/\n{2,}/).map(b=>{b=b.trim();if(!b)return '';if(b.startsWith('### '))return `<h3 id="${slug(b.slice(4))}">${inline(b.slice(4))}</h3>`;if(b.startsWith('## ')){const [first,...rest]=b.split('\n');const t=first.slice(3);return `<h2 id="${slug(t)}">${inline(t)}</h2>`+(rest.length?`<p>${inline(rest.join('\n')).replace(/\n/g,'<br>')}</p>`:'')}if(b.startsWith('> '))return `<blockquote>${inline(b.split('\n').map(l=>l.replace(/^> ?/,'')).join(' '))}</blockquote>`;if(b.split('\n').every(l=>/^\d+\. /.test(l)))return '<ol>'+b.split('\n').map(l=>`<li>${inline(l.replace(/^\d+\. /,''))}</li>`).join('')+'</ol>';if(/^- /m.test(b)&&b.split('\n').every(l=>l.startsWith('- ')))return '<ul>'+b.split('\n').map(l=>`<li>${inline(l.slice(2))}</li>`).join('')+'</ul>';return `<p>${inline(b).replace(/\n/g,'<br>')}</p>`}).join(''))}
/* Índice: un ítem por subtítulo (##), sin la numeración inicial ("1. ") para que quede corto. */
const headings=text=>String(text||'').split(/\n{2,}/).filter(b=>b.trim().startsWith('## ')).map(b=>{const t=b.trim().split('\n')[0].slice(3);return {text:t.replace(/^\d+\.\s*/,''),id:slug(t)}});

/* ---------- formatos en español de Chile ---------- */
const TZ='America/Santiago';
const fmt={
 dateTime:t=>t?new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:TZ}).format(new Date(t)).replace(/\./g,''):'—',
 date:t=>t?new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'long',year:'numeric',timeZone:TZ}).format(new Date(t)):'—',
 short:t=>t?new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:TZ}).format(new Date(t)).replace(/\./g,''):'—',
 dayKey:t=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date(t)),
 monthLabel:t=>new Intl.DateTimeFormat('es-CL',{month:'long',year:'numeric',timeZone:TZ}).format(new Date(t)),
 uf:v=>Number(v).toLocaleString('es-CL',{maximumFractionDigits:2})+' UF',
 clp:v=>'$'+Math.round(v).toLocaleString('es-CL'),
 num:v=>Number(v).toLocaleString('es-CL'),
 rel:t=>{const s=Math.round((Date.now()-t)/1000);if(s<60)return 'hace un momento';if(s<3600)return `hace ${Math.round(s/60)} min`;if(s<86400)return `hace ${Math.round(s/3600)} h`;return fmt.short(t)}
};
const toLocalInput=t=>{if(!t)return '';const d=new Date(t);const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).reduce((m,p)=>(m[p.type]=p.value,m),{});return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`};
/* Interpreta una fecha y hora escrita en hora de Chile, sin depender de la zona del dispositivo. */
function fromLocalInput(v){if(!v)return null;const [d,t]=v.split('T');const [y,mo,da]=d.split('-').map(Number);const [hh,mm]=t.split(':').map(Number);let guess=Date.UTC(y,mo-1,da,hh,mm);for(let i=0;i<2;i++){const shown=toLocalInput(guess);const [sd,st]=shown.split('T');const [sy,smo,sda]=sd.split('-').map(Number);const [sh,sm]=st.split(':').map(Number);guess+=Date.UTC(y,mo-1,da,hh,mm)-Date.UTC(sy,smo-1,sda,sh,sm)}return guess}

/* ---------- estado global ---------- */
const store={get(k,f=null){try{const v=localStorage.getItem(k);return v===null?f:JSON.parse(v)}catch{return f}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},del(k){try{localStorage.removeItem(k)}catch{}}};
const session={get(k,f=null){try{const v=sessionStorage.getItem(k);return v===null?f:JSON.parse(v)}catch{return f}},set(k,v){try{sessionStorage.setItem(k,JSON.stringify(v))}catch{}},del(k){try{sessionStorage.removeItem(k)}catch{}}};
const state={config:null,user:null,staff:null,saved:new Set(),currency:store.get('ss-currency','UF')==='CLP'?'CLP':'UF',unread:0,mode:FILE_MODE?'file':'server'};

/* ---------- montos: la UF es la unidad contractual; CLP es solo equivalencia referencial ---------- */
const ufInfo=()=>state.config?.uf||{available:false};
function money(uf,{force}={}){if(uf==null||!Number.isFinite(Number(uf)))return '—';const cur=force||state.currency;const u=ufInfo();if(cur==='CLP'){if(!u.available)return fmt.uf(uf);return fmt.clp(uf*u.value)}return fmt.uf(uf)}
function moneyNote(){const u=ufInfo();if(state.currency!=='CLP')return h`<p class="money-note">Unidad contractual: UF.</p>`;if(!u.available)return h`<p class="money-note warn">Equivalencia en pesos no disponible: no hay un valor UF vigente. Se muestran los valores originales en UF.</p>`;return h`<p class="money-note">Equivalencia referencial en pesos · UF ${fmt.clp(u.value)} del ${fmt.date(u.date+'T12:00:00')} · Fuente: ${u.source}. La unidad contractual sigue siendo UF.</p>`}

/* ---------- íconos lineales de 24 px ---------- */
const ICONS={bed:'<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-8v6"/><circle cx="6.5" cy="11.5" r="1.8"/>',bath:'<path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2ZM6 12V6.5a2.5 2.5 0 0 1 5 0M7 19l-1 2M17 19l1 2"/>',area:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',bank:'<path d="M3 10h18M12 3l9 5H3l9-5Z"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',building:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>',explore:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5M8 10h6M11 7v6"/>',user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.4-3.3 3.2-5.5 7-5.5s6.6 2.2 7 5.5"/>',bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',close:'<path d="M6 6l12 12M18 6 6 18"/>',share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',file:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',check:'<path d="m5 12 5 5 9-10"/>',alert:'<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',grid:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',map:'<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',chevron:'<path d="m9 6 6 6-6 6"/>',doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',upload:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',logout:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'};
const icon=(n,cls='')=>raw(`<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[n]||''}</svg>`);

/* ---------- API ---------- */
class ApiError extends Error{constructor(status,data){super(data?.message||'No se completó la operación.');this.status=status;this.code=data?.code;this.fields=data?.fields;this.data=data}}
async function api(method,url,body,{timeout=12000}={}){if(FILE_MODE)return LocalApi.call(method,url,body);const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeout);
 try{let r;try{r=await fetch(url,{method,signal:abort.signal,credentials:'same-origin',headers:{'Content-Type':'application/json','X-SeSubasta':'1'},body:body===undefined?undefined:JSON.stringify(body)})}catch(e){throw new ApiError(0,{code:'NETWORK',message:'Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.'})}
  let data=null;try{data=await r.json()}catch{}if(!r.ok)throw new ApiError(r.status,data||{message:'Respuesta no disponible.'});return data}finally{clearTimeout(timer)}}
const GET=u=>api('GET',u),POST=(u,b={})=>api('POST',u,b),PATCH=(u,b={})=>api('PATCH',u,b),DEL=u=>api('DELETE',u);
const readFile=file=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(Error('No se pudo leer el archivo.'));r.readAsDataURL(file)});

/* ---------- router con rutas reales (History API); en modo archivo usa #/ruta ---------- */
const routes=[];
function route(pattern,opts){const keys=[];const re=new RegExp('^'+pattern.replace(/:(\w+)/g,(_,k)=>(keys.push(k),'([^/]+)'))+'/?$');routes.push({pattern,re,keys,...opts})}
const currentUrl=()=>{if(FILE_MODE){const hsh=location.hash.replace(/^#/,'')||'/';return new URL(hsh.startsWith('/')?hsh:'/'+hsh,'http://local')}return new URL(location.href)};
const href=path=>FILE_MODE?'#'+path:path;
function match(path){for(const r of routes){const m=path.match(r.re);if(m){const params={};r.keys.forEach((k,i)=>{try{params[k]=decodeURIComponent(m[i+1])}catch{params[k]=m[i+1]}});return {r,params}}}return null}
let renderToken=0;
function navigate(to,{replace=false,keepScroll=false}={}){if(history.state)history.replaceState({...history.state,scroll:scrollY},'');if(FILE_MODE){const target='#'+to;if(replace)location.replace(target);else location.hash=target;return}const depth=(history.state?.depth||0)+(replace?0:1);history[replace?'replaceState':'pushState']({scroll:0,depth},'',to);render({keepScroll})}
function back(fallback='/'){if(!FILE_MODE&&history.state?.depth>0)history.back();else if(FILE_MODE&&history.length>1)history.back();else navigate(fallback)}
addEventListener('popstate',e=>render({restore:e.state?.scroll}));
if(FILE_MODE)addEventListener('hashchange',()=>render());
const setQuery=(params,{replace=true}={})=>{const u=currentUrl();for(const [k,v] of Object.entries(params)){if(v===''||v==null||v===false)u.searchParams.delete(k);else u.searchParams.set(k,v)}const s=u.pathname+(u.searchParams.toString()?'?'+u.searchParams:'');if(FILE_MODE)history.replaceState(null,'','#'+s);else history[replace?'replaceState':'pushState']({...history.state},'',s)};

/* ---------- avisos, diálogos y foco ---------- */
let toastTimer;function toast(msg,kind='info'){const t=$('#toast');t.textContent=msg;t.className='toast show '+kind;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast',4800)}
function openDialog({title,body,actions='',wide=false,onOpen,label}){const d=document.createElement('dialog');d.className='dialog'+(wide?' wide':'');d.setAttribute('aria-labelledby','dlg-title');const opener=document.activeElement;
 d.innerHTML=toHtml(h`<div class="dialog-head"><h2 id="dlg-title">${title}</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon('close')}</button></div><div class="dialog-body">${body}</div>${actions?h`<div class="dialog-actions">${actions}</div>`:''}`);
 document.body.append(d);d.addEventListener('close',()=>{d.remove();if(opener&&document.contains(opener))opener.focus()});d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-close]'))d.close()});d.showModal();onOpen?.(d);return d}
function confirmDialog({title,text,confirm='Confirmar',danger=false,reason=false,reasonLabel='Motivo',extra=''}){return new Promise(resolve=>{let done=false;const d=openDialog({title,body:h`<p>${text}</p>${extra}${reason?h`<label class="form-field"><span>${reasonLabel}</span><textarea id="dlgReason" required minlength="5" rows="3"></textarea><small class="hint">Queda registrado en la auditoría.</small></label><p class="field-error" id="dlgErr" hidden></p>`:''}`,actions:h`<button class="btn btn-outline" data-close>Cancelar</button><button class="btn ${danger?'btn-danger':'btn-dark'}" id="dlgOk">${confirm}</button>`,onOpen:x=>{$('#dlgOk',x).onclick=()=>{const v=reason?$('#dlgReason',x).value.trim():true;if(reason&&v.length<5){const e=$('#dlgErr',x);e.hidden=false;e.textContent='Indica el motivo (mínimo 5 caracteres).';$('#dlgReason',x).focus();return}done=true;resolve({ok:true,reason:v,dialog:x});x.close()};(reason?$('#dlgReason',x):$('#dlgOk',x)).focus()}});d.addEventListener('close',()=>{if(!done)resolve({ok:false})})})}

/* ---------- formularios: errores por campo, resumen accesible y envío único ---------- */
function formData(form){const out={};for(const el of form.elements){if(!el.name||el.disabled)continue;if(el.type==='checkbox')out[el.name]=el.checked;else if(el.type==='radio'){if(el.checked)out[el.name]=el.value}else if(el.type==='file')continue;else out[el.name]=el.value.trim()}return out}
function clearErrors(form){$$('.field-error[data-for]',form).forEach(e=>e.remove());$$('[aria-invalid]',form).forEach(e=>e.removeAttribute('aria-invalid'));const s=$('.form-summary',form);if(s){s.hidden=true;s.innerHTML=''}}
function showErrors(form,err){clearErrors(form);const fields=err.fields||{};const items=[];for(const [name,msg] of Object.entries(fields)){if(!msg)continue;const el=form.elements[name]||$(`[data-field="${name}"]`,form);if(el&&el.setAttribute){const id='err-'+name;el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby',[el.getAttribute('aria-describedby'),id].filter(Boolean).join(' '));const p=document.createElement('p');p.className='field-error';p.id=id;p.dataset.for=name;p.textContent=msg;(el.closest('.form-field,.form-check')||el).after(p)}items.push(msg)}
 let s=$('.form-summary',form);if(!s){s=document.createElement('div');s.className='form-summary';s.setAttribute('role','alert');s.tabIndex=-1;form.prepend(s)}s.hidden=false;s.innerHTML=toHtml(h`<strong>${err.message||'Revisa el formulario.'}</strong>${items.length>1?h`<ul>${items.map(i=>h`<li>${i}</li>`)}</ul>`:''}`);s.focus()}
async function submitWith(form,fn){if(form.dataset.busy)return;form.dataset.busy='1';const btn=$('[type=submit],button:not([type])',form);const label=btn?.textContent;if(btn){btn.disabled=true;btn.classList.add('loading')}clearErrors(form);
 try{return await fn(formData(form))}catch(e){if(e instanceof ApiError){showErrors(form,e);if(e.status===401&&!form.closest('.auth-panel'))await refreshUser()}else{showErrors(form,{message:e.message})}return null}finally{delete form.dataset.busy;if(btn&&document.contains(btn)){btn.disabled=false;btn.classList.remove('loading');btn.textContent=label}}}
/* Borradores de formulario: el texto escrito sobrevive a re-render, cambios de tamaño y orientación. */
const drafts=new Map(session.get('ss-drafts',[]));
const draftKey=el=>currentUrl().pathname+'|'+(el.form?.dataset.form||'')+'|'+el.name;
function saveDraft(el){if(!el.name||el.type==='password'||el.type==='file'||el.dataset.nodraft!==undefined)return;drafts.set(draftKey(el),el.type==='checkbox'?el.checked:el.value);session.set('ss-drafts',[...drafts].slice(-200))}
function restoreDrafts(root){$$('form[data-form] [name]',root).forEach(el=>{const k=draftKey(el);if(!drafts.has(k)||el.type==='password'||el.type==='file')return;if(el.type==='checkbox')el.checked=drafts.get(k);else if(el.type!=='radio')el.value=drafts.get(k)})}
function clearDraft(formName){for(const k of [...drafts.keys()])if(k.split('|')[1]===formName)drafts.delete(k);session.set('ss-drafts',[...drafts])}
document.addEventListener('input',e=>{if(e.target.closest('form[data-form]'))saveDraft(e.target)});
document.addEventListener('change',e=>{if(e.target.closest('form[data-form]'))saveDraft(e.target)});

/* ---------- acciones declarativas ---------- */
const actions={};const forms={};
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(a&&!e.defaultPrevented&&!a.target&&!a.hasAttribute('download')&&e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey){const raw=a.getAttribute('href');const path=FILE_MODE?(raw.startsWith('#/')?raw.slice(1):null):(raw.startsWith('/')&&!raw.startsWith('//')&&!/^\/(api|media|assets)\//.test(raw)?raw:null);if(path){e.preventDefault();if(a.dataset.replace!==undefined)navigate(path,{replace:true});else navigate(path);return}}
 const t=e.target.closest('[data-action]');if(t&&actions[t.dataset.action]){e.preventDefault();actions[t.dataset.action](t,e)}});
document.addEventListener('submit',e=>{const f=e.target.closest('form[data-form]');if(f&&forms[f.dataset.form]){e.preventDefault();forms[f.dataset.form](f,e)}});

/* ---------- consentimiento de cookies y Google Analytics 4 (Consent Mode v2, carga solo con permiso) ---------- */
const CONSENT_VERSION='2026-10';
const Analytics={id:'',debug:false,loaded:false,consent:null,
 init(cfg){this.id=cfg?.ga?.measurementId||'';this.debug=!!cfg?.ga?.debug||/[?&]ga_debug=1/.test(location.search);window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments)};
  gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});gtag('set','ads_data_redaction',true);
  const c=store.get('ss-consent');if(c&&c.version===CONSENT_VERSION)this.apply(c,false);else this.consent=null},
 apply(c,save=true){this.consent={necessary:true,analytics:!!c.analytics,marketing:!!c.marketing,version:CONSENT_VERSION,at:c.at||Date.now()};if(save)store.set('ss-consent',this.consent);
  gtag('consent','update',{analytics_storage:this.consent.analytics?'granted':'denied',ad_storage:this.consent.marketing?'granted':'denied',ad_user_data:this.consent.marketing?'granted':'denied',ad_personalization:this.consent.marketing?'granted':'denied'});
  if(this.consent.analytics&&this.id&&!this.loaded&&!FILE_MODE){this.loaded=true;const s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(this.id);document.head.append(s);gtag('js',new Date());gtag('config',this.id,{send_page_view:false,debug_mode:this.debug||undefined,allow_google_signals:this.consent.marketing,allow_ad_personalization_signals:this.consent.marketing,cookie_flags:'SameSite=Lax;Secure'})}
  $('#cookieBanner')?.remove()},
 /* Nunca se envían ofertas, correos, teléfonos, nombres, direcciones ni tokens. */
 clean(params={}){const out={};for(const [k,v] of Object.entries(params)){if(/mail|phone|tel|name|nombre|amount|monto|address|direcc|rut|token|password/i.test(k))continue;if(v==null||v==='')continue;const val=typeof v==='string'?v.slice(0,100):v;if(typeof val==='string'&&/@|\d{8,}/.test(val))continue;out[k]=val}return out},
 cleanUrl(u){const url=new URL(u,location.origin);['token','email','correo','volver'].forEach(k=>url.searchParams.delete(k));return url.origin+url.pathname+(url.search||'')},
 event(name,params={}){const p=this.clean(params);if(this.debug)console.info('[GA4]',name,p,this.consent?.analytics?'(enviado)':'(sin consentimiento: no se envía)');if(!this.consent?.analytics||!this.id)return;gtag('event',name,p)},
 page(path,title){if(/^\/(gestion|admin-login|dev|prototipo)/.test(path))return;this.event('page_view',{page_location:this.cleanUrl(FILE_MODE?'/':location.href),page_path:path,page_title:title,language:'es-CL'})}};
function cookieBanner(){if(Analytics.consent||$('#cookieBanner'))return;const b=document.createElement('section');b.id='cookieBanner';b.className='cookie-banner';b.setAttribute('aria-label','Preferencias de cookies');
 b.innerHTML=toHtml(h`<div><strong>Usamos cookies</strong><p>Las necesarias mantienen tu sesión y preferencias. Con tu permiso usamos analítica (Google Analytics 4) para mejorar el sitio, sin enviar ofertas ni datos de contacto. <a href="${href('/cookies')}">Ver política</a></p></div><div class="cookie-actions"><button class="btn btn-outline" data-action="consent" data-value="none">Solo necesarias</button><button class="btn btn-outline" data-action="cookie-settings">Configurar</button><button class="btn btn-primary" data-action="consent" data-value="all">Aceptar todas</button></div>`);document.body.append(b)}
actions.consent=el=>{const all=el.dataset.value==='all';Analytics.apply({analytics:all,marketing:all});toast(all?'Gracias. Activamos la analítica.':'Guardamos solo las cookies necesarias.');Analytics.page(currentUrl().pathname,document.title)};
actions['cookie-settings']=()=>{const c=Analytics.consent||{};const d=openDialog({title:'Preferencias de cookies',body:h`<form id="cookieForm" class="stack"><label class="form-check"><input type="checkbox" checked disabled> <span><strong>Necesarias</strong><br>Sesión, moneda y elección de cookies. Siempre activas.</span></label><label class="form-check"><input type="checkbox" name="analytics" ${c.analytics?'checked':''}> <span><strong>Analítica</strong><br>Google Analytics 4, datos agregados de uso.</span></label><label class="form-check"><input type="checkbox" name="marketing" ${c.marketing?'checked':''}> <span><strong>Marketing</strong><br>Medición de campañas.</span></label></form>`,actions:h`<button class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-dark" id="saveCookies">Guardar preferencias</button>`,onOpen:x=>{$('#saveCookies',x).onclick=()=>{const f=$('#cookieForm',x);Analytics.apply({analytics:f.analytics.checked,marketing:f.marketing.checked});x.close();toast('Preferencias guardadas.')}}})};
