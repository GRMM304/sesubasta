/* Ajustes de datos al iniciar, para archivos creados con versiones anteriores del prototipo. */
const D=require('./dominio.cjs');
const T=require('./terminologia.cjs');
const {resetDemo}=require('./demo.cjs');
const {addExtraBlog,applyLongBodies}=require('./blog-extra.cjs');
const DEMO_RESET=2;
const SOCIAL={instagram:'https://www.instagram.com/sesubasta.cl',facebook:'https://www.facebook.com/sesubasta.cl'};
function migrate(d){
 // Cada ficha publicada conserva la versión pública aprobada separada de las ediciones privadas posteriores.
 for(const p of d.properties)if(p.publicStatus==='published'&&!p.live)p.live=D.publicFields(p);
 if(!d.config.social)d.config.social={...SOCIAL};
 // Solo Instagram y Facebook (TikTok y LinkedIn se retiraron). Los enlaces oficiales se fijan una vez.
 if((d.config.socialVersion||0)<3){d.config.social={...SOCIAL};d.config.socialVersion=3}
 // Manual de Marca v2.0: el titular de inicio no termina en punto y usa dos pesos.
 if(d.config.homeTitle==='Subasta en vivo, con información clara.')d.config.homeTitle='Revisa *antes* de decidir|Subastas de propiedades en vivo';
 // Inicio nuevo (nov. 2026): no son subastas en vivo. Solo cambia los textos que nadie editó desde Gestión.
 if(['Revisa *antes* de decidir|Subastas de propiedades en vivo','Revisa *antes* de decidir|Propiedades sin barreras'].includes(d.config.homeTitle))d.config.homeTitle='Propiedades sin barreras|Revisa *antes* de decidir';
 if(d.config.homeLead==='Explora propiedades, revisa sus antecedentes y oferta en vivo hasta el cierre. Sin inscripción por propiedad.')d.config.homeLead='Explora propiedades, revisa sus antecedentes y oferta hasta el cierre. Sin inscripción por propiedad.';
 // Dominio sesubasta.cl autenticado en Brevo (oct. 2026): los correos salen desde contacto@sesubasta.cl.
 if(d.config.mailFromVersion!==2){if(!d.config.mailFrom||/oficina@grupomm\.cl/i.test(d.config.mailFrom))d.config.mailFrom='SeSubasta <contacto@sesubasta.cl>';d.config.mailFromVersion=2}
 d.whatsapp=d.whatsapp||[];d.tasks=d.tasks||[];
 // Garantía de seriedad por remate (oct. 2026). Los datos de la cuenta de destino los completa el Administrador general.
 d.guarantees=d.guarantees||[];if(!d.config.guaranteeBank)d.config.guaranteeBank={holder:'',rut:'',bank:'',accountType:'',number:'',email:'',refundDays:3};
 // Cuenta de destino de las garantías entregada por Dirección (27 oct. 2026). Solo se completa si sigue vacía,
 // para no pisar lo que el Administrador general guarde después desde Configuración.
 if(!d.config.guaranteeBank.holder&&!d.config.guaranteeBank.number){d.config.guaranteeBank={holder:'SOCIEDAD DE INVERSIONES CVD SPA',rut:'77579633-2',bank:'Banco BCI',accountType:'Cuenta corriente',number:'78398573',email:'fnrojas@gmail.com',refundDays:d.config.guaranteeBank.refundDays||3};
  D.audit(d,'system','config.update','config','guaranteeBank',{section:'guarantee',reason:'Cuenta para garantías entregada por Dirección'})}
 // Terminología (oct. 2026): quien participa "oferta" y hace "ofertas", no "montos". Corrige una vez los textos ya guardados;
 // los slugs del blog no cambian para no romper enlaces.
 if((d.config.copyVersion||0)<1){const c=d.config;
  for(const k of Object.keys(c.legal||{}))c.legal[k].body=T.apply(c.legal[k].body);
  c.faqs=(c.faqs||[]).map(f=>({...f,q:T.apply(f.q),a:T.apply(f.a)}));
  if(c.how){c.how.lead=T.apply(c.how.lead);c.how.purpose=T.apply(c.how.purpose);c.how.steps=(c.how.steps||[]).map(s=>Array.isArray(s)?[T.stepTitle(s[0]),T.apply(s[1])]:{...s,title:T.stepTitle(s.title),text:T.apply(s.text)})}
  c.homeLead=T.apply(c.homeLead);
  for(const p of d.posts||[])for(const k of ['title','excerpt','body','metaDescription','seoTitle'])p[k]=T.apply(p[k]);
  c.copyVersion=1}
 // Reinicio de las subastas de prueba: 1 (27 oct. 2026) tarjetas con tasación; 2 (nov. 2026) subastas de a una,
 // horas exactas, títulos con la dirección y crédito hipotecario solo en algunas.
 // Para repetirlo, sube DEMO_RESET y publica.
 if((d.config.demoResetVersion||0)<DEMO_RESET){resetDemo(d);d.config.demoResetVersion=DEMO_RESET}
 // Prueba del flujo de garantía pedida por Dirección (27 oct. 2026): "Casa urbana con jardín y terraza" (SS-0020) exige $5.000.
 if(!d.config.guarantee20){const p=d.properties.find(x=>x.id===20&&x.demo);if(p){p.conditions={...p.conditions,guaranteeCLP:5000};if(p.live)p.live.conditions={...p.live.conditions,guaranteeCLP:5000};D.audit(d,'system','property.update','property',p.id,{guaranteeCLP:5000,reason:'Prueba del flujo de garantía'})}d.config.guarantee20=true}
 // Blog (nov. 2026): 10 artículos generales sobre subastas y 2 categorías nuevas. Solo agrega los que falten.
 if((d.config.blogExtraVersion||0)<1){addExtraBlog(d,require('./semilla.cjs').slugify);d.config.blogExtraVersion=1}
 // 2: textos completos con subtítulos cortos para el índice lateral (solo artículos sin ediciones del equipo).
 if((d.config.blogExtraVersion||0)<2){applyLongBodies(d,require('./semilla.cjs').slugify);d.config.blogExtraVersion=2}
 for(const m of d.mail){delete m.html;delete m.text}
}
module.exports={migrate,SOCIAL};
