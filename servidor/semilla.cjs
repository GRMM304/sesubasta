/* Synthetic, clearly labelled demo data. Nothing here represents real inventory, people or transactions. */
const {hashPassword,referenceCode}=require('./seguridad.cjs');
const {seed:seedAuctions}=require('../fuentes/auction-core.js');
const {demoPlan,applyPlan}=require('./demo.cjs');

const COMMUNES={
 'Ñuñoa':{region:'Región Metropolitana',lat:-33.4569,lng:-70.5975},'Providencia':{region:'Región Metropolitana',lat:-33.4314,lng:-70.6093},
 'Santiago Centro':{region:'Región Metropolitana',lat:-33.4378,lng:-70.6505},'Santiago':{region:'Región Metropolitana',lat:-33.4489,lng:-70.6693},
 'La Reina':{region:'Región Metropolitana',lat:-33.45,lng:-70.54},'Peñalolén':{region:'Región Metropolitana',lat:-33.485,lng:-70.53},
 'Las Condes':{region:'Región Metropolitana',lat:-33.411,lng:-70.57},'Colina':{region:'Región Metropolitana',lat:-33.2,lng:-70.675},
 'Quinta Normal':{region:'Región Metropolitana',lat:-33.43,lng:-70.7},'Lo Barnechea':{region:'Región Metropolitana',lat:-33.35,lng:-70.517},
 'La Florida':{region:'Región Metropolitana',lat:-33.522,lng:-70.598},'Macul':{region:'Región Metropolitana',lat:-33.49,lng:-70.6},
 'Pucón':{region:'Región de La Araucanía',lat:-39.282,lng:-71.954},'Concón':{region:'Región de Valparaíso',lat:-32.93,lng:-71.52},
 'Olmué':{region:'Región de Valparaíso',lat:-33.0,lng:-71.19},'Viña del Mar':{region:'Región de Valparaíso',lat:-33.0245,lng:-71.5518}
};
const slugify=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);

/* Minimal valid single-page PDF so demo documents can be downloaded and opened. */
function makePdf(title,lines){const esc=t=>String(t).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[()\\]/g,m=>'\\'+m);
 const text=['BT','/F1 16 Tf','60 780 Td',`(${esc(title)}) Tj`,'/F1 11 Tf',...lines.flatMap(l=>['0 -22 Td',`(${esc(l)}) Tj`]),'ET'].join('\n');
 const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let out='%PDF-1.4\n';const offsets=[];objs.forEach((o,i)=>{offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`});const xref=Buffer.byteLength(out);
 out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(out,'latin1')}

const TERMS_VERSION='demo-2026-10-v4';
const LEGAL={
 privacidad:{title:'Política de privacidad',version:'borrador-2026-10',body:`Texto de demostración pendiente de revisión por asesoría legal. No constituye la política vigente de SeSubasta.

## Qué datos usamos
En este prototipo solo se registran datos ficticios: nombre, correo, teléfono opcional, propiedades guardadas y ofertas de prueba.

## Para qué los usamos
Para identificar la cuenta, mostrar tu actividad propia, enviar avisos de la subasta y responder solicitudes.

## Tus derechos
Puedes pedir acceso, rectificación, exportación o eliminación de tus datos desde Perfil y privacidad o en la página Eliminación de datos.

## Conservación
Los plazos de conservación se definirán antes de operar con datos reales.`},
 terminos:{title:'Términos de uso y bases de demostración',version:TERMS_VERSION,body:`Texto de demostración pendiente de aprobación por Dirección y asesoría legal.

## Mecánica
La subasta es ascendente y continua hasta un cierre fijo en hora de Chile. Cada oferta debe ser igual o mayor al siguiente mínimo calculado por el servidor. No hay extensión automática del cierre.

## Efecto de una oferta aceptada
Una oferta aceptada actualiza la oferta vigente. No equivale a adjudicación: el resultado al cierre es preliminar y requiere confirmación según las bases definitivas.

## Garantía de seriedad
No se exige inscripción por propiedad. Cuando la ficha indica un monto de garantía, para ofertar debes transferirlo a la cuenta de SeSubasta con el código que te entregamos, desde una cuenta a tu nombre, y esperar la confirmación del equipo. Si no quedas entre los dos primeros, la garantía se devuelve a esa misma cuenta dentro de los días hábiles indicados. La del segundo lugar se devuelve al confirmarse la adjudicación. La del adjudicatario se abona al precio, y puede retenerse si no cumple lo establecido en las bases. SeSubasta no mantiene saldos ni cuentas a nombre de los participantes.

## Información de las propiedades
Las propiedades, imágenes y valores de este prototipo son ilustrativos y no representan inventario real.`},
 cookies:{title:'Política de cookies',version:'borrador-2026-10',body:`Texto de demostración.

## Necesarias
Mantienen la sesión, la preferencia de moneda y tu elección de cookies. No se pueden desactivar.

## Analítica
Si las aceptas, usamos Google Analytics 4 para medir visitas y uso del sitio de forma agregada. No enviamos ofertas, correos, teléfonos ni direcciones.

## Marketing
Permiten medir campañas. Están desactivadas salvo que las aceptes.

Puedes cambiar tu elección en cualquier momento desde Preferencias de cookies.`},
 eliminacion:{title:'Eliminación de cuenta y datos',version:'borrador-2026-10',body:`Puedes solicitar la eliminación de tu cuenta desde Mi cuenta › Perfil y privacidad. La solicitud queda registrada y el equipo la gestiona según los plazos que se definan.

Algunos registros, como ofertas aceptadas en una subasta, pueden requerir conservación por trazabilidad; en ese caso se anonimizan los datos personales.

Si no puedes ingresar a tu cuenta, usa el formulario de contacto indicando que se trata de una solicitud de eliminación.`}
};
const FAQS=[
 ['¿Necesito inscribirme en cada remate?','No. Con una cuenta de comprador activa y tu correo verificado puedes ofertar en cualquier propiedad abierta.'],
 ['¿Cómo se define el siguiente mínimo?','Antes de la primera oferta es el precio inicial. Después de cada oferta aceptada es la oferta vigente más el incremento configurado para esa subasta.'],
 ['¿Puedo ofertar varias veces?','Sí. Puedes registrar nuevas ofertas válidas durante toda la ventana abierta, incluso para superar tu propia oferta.'],
 ['¿Qué pasa al llegar la hora de cierre?','El cierre es fijo. Cualquier intento evaluado a esa hora o después se rechaza. No hay extensión automática.'],
 ['¿Tener la mejor oferta significa que gané?','No necesariamente. Al cierre se informa un resultado preliminar; la adjudicación requiere confirmación según las bases.'],
 ['¿Por qué veo los valores en UF y en pesos?','La unidad contractual de cada subasta es la UF. El selector CLP muestra una equivalencia referencial con la tasa y fecha indicadas.'],
 ['¿Quién ve mis ofertas?','Solo tú y el equipo autorizado. El público ve solo la oferta vigente y la cantidad de personas, nunca tu identidad.']
];
const HOW={title:'Cómo funcionan los Remates Dinámicos',lead:'Revisa la propiedad, inicia sesión y oferta directamente hasta el cierre. Sin inscripción por propiedad.',steps:[
 ['Explora y revisa','Consulta la ficha completa, las fechas en hora de Chile, las bases y los documentos públicos autorizados.'],
 ['Inicia sesión','Crea tu cuenta de comprador y verifica tu correo. Una sola cuenta sirve para todas las subastas.'],
 ['Oferta en vivo','Ingresa una oferta igual o mayor al siguiente mínimo, revísala y confírmala. Recibes un folio al instante.'],
 ['Sigue hasta el cierre','Puedes volver a ofertar cuantas veces quieras. Al cierre recibes el resultado preliminar y los próximos pasos.']],
 purpose:'Remates Dinámicos ordena la información de cada propiedad y registra cada oferta con hora oficial del servidor para que la competencia sea transparente.',
 values:['Información revisada antes de publicar','Reglas visibles y versionadas','Privacidad de cada participante','Hora oficial y cierre fijo']};

const BLOG_CATEGORIES=[['Guías para compradores','guias-para-compradores','Cómo revisar una ficha y participar con información.'],['Antecedentes legales','antecedentes-legales','Qué documentos revisar y qué preguntar.'],['Cómo funciona','como-funciona','La mecánica de la subasta continua paso a paso.'],['Vender una propiedad','vender-una-propiedad','Qué esperar al presentar un inmueble.']];
const POSTS=[
 {title:'Antes de una subasta, revisa estas 5 partes de la ficha',category:'guias-para-compradores',image:15,excerpt:'Una fecha de cierre no cuenta toda la historia. Aprende qué información mirar antes de tomar una decisión.',body:`Una ficha clara reúne características, estado informado, fechas, condiciones y documentos autorizados. Léela completa antes de ofertar.

## 1. Fechas en hora de Chile
Revisa el inicio y el cierre. El cierre es fijo: a esa hora el sistema deja de recibir ofertas.

## 2. Oferta vigente y siguiente mínimo
El siguiente mínimo lo calcula el servidor. Si otra persona registra una oferta mientras revisas, tendrás que confirmar de nuevo.

## 3. Ocupación informada
Indica si la propiedad está ocupada, desocupada o por confirmar. Considera ese dato en tu evaluación.

## 4. Documentos públicos
Abre las bases y los documentos autorizados. Si algo no queda claro, usa el botón Consultar.

## 5. Fotografías
Las imágenes ilustran la publicación, pero no reemplazan una visita ni la revisión de antecedentes.`},
 {title:'Qué preguntar sobre los documentos de una propiedad',category:'antecedentes-legales',image:19,excerpt:'Una guía para preparar tus preguntas y ordenar la información disponible.',body:`Los documentos y condiciones pueden variar entre propiedades. Revisa los antecedentes incluidos en cada expediente.

## Preguntas útiles
- ¿Qué documentos revisó el equipo legal y en qué fecha?
- ¿Hay antecedentes pendientes?
- ¿Qué costos asume quien resulte adjudicatario?

## Un recordatorio
La información editorial es general y no reemplaza la revisión profesional que requiera cada caso.`},
 {title:'Fechas de inicio y cierre: cómo leer el calendario',category:'como-funciona',image:2,excerpt:'Entiende dónde consultar el inicio, el cierre programado y los cambios comunicados en una subasta.',body:`La ficha y la sala muestran las fechas en hora de Chile (America/Santiago).

## La cuenta regresiva
El contador se sincroniza con la hora del servidor. Cambiar la hora de tu teléfono o computador no altera el cierre.

## Si se suspende una subasta
Verás el estado Suspendida y el motivo. Mientras dure no se reciben ofertas. Si se reanuda, se informa la nueva hora de cierre.`},
 {title:'Subasta continua: puedes volver a ofertar hasta el cierre',category:'como-funciona',image:7,excerpt:'Cómo funciona la competencia de ofertas en tiempo real y por qué no necesitas inscribirte en cada propiedad.',body:`En Remates Dinámicos una sola cuenta de comprador te permite participar en todas las subastas abiertas.

## Cada oferta recibe un folio
Cuando el servidor acepta tu oferta, recibes un folio con la hora oficial y la secuencia. Ese registro aparece en Mis subastas.

## Superar tu propia oferta
Puedes registrar una nueva oferta aunque vayas primero, siempre que cumpla el siguiente mínimo.

## Si pierdes la conexión
La sala bloquea nuevos envíos hasta reconectar. Si un envío quedó pendiente, reintenta la misma solicitud: nunca se crea un segundo registro.`},
 {title:'Quiero vender: qué pasa cuando presento mi propiedad',category:'vender-una-propiedad',image:9,excerpt:'El formulario crea una solicitud privada. Nada se publica sin revisión.',body:`Presentar una propiedad no la publica. Tu solicitud queda en una bandeja privada del equipo.

## Los pasos
- Recibes un código de solicitud por correo.
- El equipo asigna un responsable y te contacta.
- Si avanza, el equipo prepara la ficha y Legal revisa los antecedentes.
- Solo el Administrador general aprueba la publicación.

No prometemos precio, plazo ni resultado.`}
];

function seedData(store){
 const now=Date.now(),rows=require('../fuentes/propiedades.json');
 const pass=hashPassword('Demo2026!');
 const user=(id,email,name,type,roles,extra={})=>({id,email,emailNorm:email,name,phone:'',accountType:type,status:'active',emailVerifiedAt:now,passHash:pass,roles,mfa:roles.includes('general_admin'),prefs:{marketing:false,notifyEmail:true,alertsSaved:true,alertsNew:false,alertsNews:false,alertRegions:[],alertTypes:[]},termsVersion:type==='public'?TERMS_VERSION:null,createdAt:now,updatedAt:now,demo:true,...extra});
 const users=[
  user('usr_admin','admin@demo.cl','Administración Demo','internal',['general_admin'],{whatsapp:'+56900000001',position:'Administración general',area:'Dirección'}),
  user('usr_legal','legal@demo.cl','Legal Demo','internal',['legal'],{whatsapp:'+56900000002',position:'Abogada de expedientes',area:'Legal'}),
  user('usr_colab','colaborador@demo.cl','Colaborador Demo','internal',['internal_contributor'],{whatsapp:'+56900000003',position:'Ejecutivo de propiedades',area:'Comercial'}),
  user('usr_editor','editor@demo.cl','Editor Demo','internal',['content_editor'],{whatsapp:'+56900000004',position:'Editor de contenidos',area:'Contenido'}),
  user('usr_oper','operador@demo.cl','Operador Demo','internal',['operator'],{whatsapp:'+56900000005',position:'Operador de remates',area:'Operaciones'}),
  user('alex','alex@comprador.demo.cl','Alex Demo','public',['buyer'],{demoProfile:'alex',prefs:{marketing:true,notifyEmail:true,alertsSaved:true,alertsNew:true,alertsNews:true,alertRegions:[],alertTypes:[]}}),
  user('camila','camila@comprador.demo.cl','Camila Demo','public',['buyer'],{demoProfile:'camila'})
 ];
 const byType={};rows.forEach(r=>{(byType[r.type]=byType[r.type]||[]).push(r.image)});
 // En el sitio publicado las subastas en vivo de muestra duran más (DEMO_LIVE_MINUTES) para que el equipo alcance a probar.
 const subastas=seedAuctions(rows,now,{liveMinutes:Number(process.env.DEMO_LIVE_MINUTES)||0});
 const plan=demoPlan(rows,now,Number(process.env.DEMO_LIVE_MINUTES)||0);for(const r of rows)applyPlan(subastas.auctions[r.id],plan[r.id],now);
 const properties=rows.map(r=>{const commune=r.location.split(',')[0].trim();const c=COMMUNES[commune]||{region:r.location.split(',')[1]?.trim()||'',lat:-33.45,lng:-70.66};
  const gallery=[r.image,...byType[r.type].filter(x=>x!==r.image)].slice(0,4);
  const docKey=`bases-${r.id}.pdf`;store.saveFile('publico',docKey,makePdf('Bases de la subasta - documento de demostracion',[`Propiedad ${r.title}`,'Mecanica: subasta ascendente continua con cierre fijo.','Incremento de muestra: 50 UF. Unidad contractual: UF.','Documento ficticio. No tiene validez legal.']));
  const legalKey=`legal-${r.id}.pdf`;store.saveFile('privado',legalKey,makePdf('Antecedente legal privado - demostracion',[`Propiedad ${r.title}`,'Archivo privado: solo Legal y Administrador general.']));
  return {id:r.id,publicId:'SS-'+String(r.id).padStart(4,'0'),slug:r.slug||slugify(`${r.title} ${commune}`)+'-'+r.id,title:r.title,type:r.type,region:c.region,commune,publicLocation:`${commune}, ${c.region}`,exactAddress:'Dirección privada de demostración',lat:c.lat,lng:c.lng,rooms:r.rooms,baths:r.baths,parking:r.parking,area:r.area,plot:r.plot,occupancy:r.occupancy,expenses:null,description:r.description,appraisalUF:r.appraisalUF??null,mortgage:r.mortgage===true,
   media:gallery.map((img,i)=>({key:`demo:${img}`,alt:`Imagen ilustrativa ${i+1} de ${r.type.toLowerCase()} en ${commune}`,order:i,approved:true})),
   documents:[{id:'doc_pub_'+r.id,key:docKey,name:'Bases de la subasta (demostración).pdf',type:'Bases',visibility:'public',uploadedBy:'usr_legal',at:now,mime:'application/pdf'},{id:'doc_priv_'+r.id,key:legalKey,name:'Antecedente legal privado.pdf',type:'Antecedente legal',visibility:'private',uploadedBy:'usr_legal',at:now,mime:'application/pdf'}],
   legalNotes:'Antecedentes de demostración revisados.',legalComplete:true,conditions:{opensAt:subastas.auctions[r.id].start,closesAt:subastas.auctions[r.id].end,initialUF:r.minUF,incrementUF:50},seo:{title:'',description:''},
   reviewStatus:'approved',publicStatus:'published',version:1,submittedVersion:1,publishedVersion:1,history:[{version:1,at:now,by:'usr_admin',action:'published',reason:'Carga inicial de demostración'}],createdBy:'usr_colab',assignedLegal:'usr_legal',auctionId:r.id,createdAt:now,updatedAt:now,publishedAt:now-r.id*3600000,demo:true}});
 // Una subasta próxima exige garantía: Alex ya la tiene confirmada y Camila debe constituirla (flujo de garantía).
 const withGuarantee=properties.find(p=>p.id!==20&&subastas.auctions[p.id]&&subastas.auctions[p.id].start>now);if(withGuarantee)withGuarantee.conditions.guaranteeCLP=5000000;
 // A private draft waiting for the final decision, so the review queue is not empty.
 store.saveFile('privado','legal-21.pdf',makePdf('Antecedente legal privado - demostracion',['Departamento en Vina del Mar','Pendiente de decision del Administrador general.']));
 properties.push({id:21,publicId:'SS-0021',slug:'departamento-con-vista-al-mar-vina-del-mar-21',title:'Departamento con vista al mar',type:'Departamento',region:'Región de Valparaíso',commune:'Viña del Mar',publicLocation:'Viña del Mar, Región de Valparaíso',exactAddress:'Dirección privada de demostración',lat:-33.0245,lng:-71.5518,rooms:3,baths:2,parking:1,area:96,plot:null,occupancy:'Desocupada',expenses:null,description:'Borrador privado de demostración enviado a revisión. No es visible en el sitio público.',media:[{key:'demo:1',alt:'Imagen ilustrativa de departamento en Viña del Mar',order:0,approved:true}],documents:[{id:'doc_priv_21',key:'legal-21.pdf',name:'Antecedente legal privado.pdf',type:'Antecedente legal',visibility:'private',uploadedBy:'usr_legal',at:now,mime:'application/pdf'}],legalNotes:'Antecedentes completos para revisión.',legalComplete:true,conditions:{opensAt:now+2*86400000,closesAt:now+3*86400000,initialUF:4100,incrementUF:50},seo:{title:'',description:''},reviewStatus:'in_review',publicStatus:'not_public',version:2,submittedVersion:2,reviewRequestedAt:now-3600000,publishedVersion:0,history:[{version:1,at:now-86400000,by:'usr_colab',action:'created'},{version:2,at:now-3600000,by:'usr_colab',action:'submitted'}],createdBy:'usr_colab',assignedLegal:'usr_legal',auctionId:null,createdAt:now-86400000,updatedAt:now-3600000,publishedAt:null,demo:true});
 const categories=BLOG_CATEGORIES.map(([name,slug,description],i)=>({id:'cat_'+(i+1),name,slug,description,order:i,active:true}));
 const posts=POSTS.map((p,i)=>({id:'post_'+(i+1),slug:slugify(p.title),title:p.title,excerpt:p.excerpt,body:p.body,cover:{key:`demo:${p.image}`,alt:'Fotografía ilustrativa de una propiedad'},categoryId:categories.find(c=>c.slug===p.category).id,tags:[],authorId:'usr_editor',status:'published',seoTitle:'',metaDescription:p.excerpt,canonical:'',noindex:false,publishedAt:now-(i+1)*86400000*2,scheduledAt:null,createdAt:now-(i+1)*86400000*2,updatedAt:now-(i+1)*86400000,revisions:[],featured:i===0}));
 const guarantees=withGuarantee?[{id:'gar_demo1',code:'GAR-DEMO0001',userId:'alex',propertyId:withGuarantee.id,auctionId:withGuarantee.auctionId,amountCLP:5000000,status:'confirmed',refundAccount:{holder:'Alex Demo',rut:'11111111-1',bank:'Banco Estado',accountType:'Cuenta vista / RUT',number:'11111111'},termsVersion:TERMS_VERSION,createdAt:now-86400000,reportedAt:now-80000000,operation:'DEMO-123',confirmedBy:'usr_oper',confirmedAt:now-3600000,depositRef:'Cartola demo',history:[{from:null,to:'pending',by:'alex',reason:'Solicitud de la persona',at:now-86400000},{from:'pending',to:'reported',by:'alex',reason:'N° de operación DEMO-123',at:now-80000000},{from:'reported',to:'confirmed',by:'usr_oper',reason:'Ingreso verificado · Cartola demo',at:now-3600000}]}]:[];
 return {schema:3,createdAt:now,whatsapp:[],guarantees,tasks:[{id:'task_demo1',code:'T-0001',title:'Revisar fotos de la ficha SS-0021',description:'Confirma que las fotografías sean fieles y que tengan texto alternativo antes de la decisión de publicación.',priority:'alta',dueAt:now+20*3600000,assignees:['usr_colab'],createdBy:'usr_admin',status:'pending',link:{path:'/gestion/propiedades/21?tab=fotos',label:'SS-0021 · Fotografías'},channels:{email:true,whatsapp:true},comments:[],history:[{at:now,by:'usr_admin',action:'created'}],remindersSent:[],createdAt:now,updatedAt:now}],users,sessions:[],tokens:[],properties,subastas,attempts:[],awards:{},leads:[],saved:[{userId:'alex',propertyId:2,at:now},{userId:'alex',propertyId:7,at:now}],notifications:[],mail:[],posts,categories,redirects:[],audit:[],
  config:{guaranteeBank:{holder:'Titular de demostración',rut:'76086428-5',bank:'Banco de demostración',accountType:'Cuenta corriente',number:'00000000',email:'contacto@sesubasta.cl',refundDays:3},ufValue:40000,ufDate:new Date(now).toISOString().slice(0,10),ufSource:'Valor ficticio de demostración (no oficial)',ufIsDemo:true,gaMeasurementId:'',gaDebug:false,social:{instagram:'https://www.instagram.com/sesubasta.cl',facebook:'https://www.facebook.com/sesubasta.cl'},socialVersion:3,contact:{email:'contacto@sesubasta.cl',phone:'',instagram:'@sesubasta.cl',hours:'Lunes a viernes, 9:00 a 18:00'},termsVersion:TERMS_VERSION,demoResetVersion:2,legal:LEGAL,how:HOW,faqs:FAQS.map(([q,a])=>({q,a})),featured:[2,6,10,1,4,7],homeLead:'Explora propiedades, revisa sus antecedentes y oferta hasta el cierre. Sin inscripción por propiedad.',homeTitle:'Propiedades sin barreras|Revisa *antes* de decidir',history:[]},
  meta:{nextPropertyId:22,referenceSeq:0,taskSeq:1}};
}
module.exports={seedData,slugify,makePdf,COMMUNES,TERMS_VERSION,referenceCode};
