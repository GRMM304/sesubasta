/* Artículos generales sobre subastas (nov. 2026). Los usa la semilla y la migración los agrega a los datos existentes
   si su slug no está (no pisa artículos editados desde Gestión). daysAgo fija la fecha de publicación relativa. */
const EXTRA_CATEGORIES=[
 ['Mercado inmobiliario','mercado-inmobiliario','Contexto y tendencias para comprar o vender en subasta.'],
 ['Financiamiento','financiamiento','Crédito hipotecario, garantía de seriedad y costos asociados.']
];
const EXTRA_POSTS=[
 {daysAgo:1,featured:true,title:'Qué es un remate de propiedades y en qué se diferencia de una compraventa tradicional',category:'como-funciona',image:4,excerpt:'Precio, plazos y reglas claras: lo esencial para entender cómo se compra una propiedad en subasta.',body:`Un remate es una forma de venta en la que varias personas compiten con ofertas por una misma propiedad, dentro de un plazo y bajo reglas conocidas de antemano.

## La diferencia principal
En una compraventa tradicional el precio se negocia entre dos partes. En un remate, el precio lo define la competencia: gana la oferta más alta registrada antes del cierre, siempre que cumpla las bases.

## Qué se mantiene igual
- La propiedad debe tener sus antecedentes en orden.
- La transferencia se formaliza ante notaría y se inscribe en el Conservador de Bienes Raíces.
- Puedes financiar la compra con recursos propios o con crédito, según lo que indiquen las bases.

## Por qué puede convenir
Las subastas suelen partir bajo el valor de tasación y concentran la decisión en pocos días. Por eso es clave revisar la ficha y los documentos antes de ofertar.`},
 {daysAgo:3,featured:true,title:'7 errores comunes en tu primera subasta (y cómo evitarlos)',category:'guias-para-compradores',image:12,excerpt:'Desde no leer las bases hasta ofertar por impulso: una lista práctica para participar con calma.',body:`Participar por primera vez genera dudas. Estos son los errores que más se repiten y cómo evitarlos.

## 1. No leer las bases
Las bases indican plazos, garantías, forma de pago y condiciones de entrega. Léelas completas antes de ofertar.

## 2. No definir un tope
Decide tu oferta máxima antes de entrar a la sala y respétala.

## 3. Olvidar los gastos adicionales
Notaría, inscripción, impuestos y eventuales deudas pueden sumar un monto relevante.

## 4. No revisar el estado de ocupación
Una propiedad ocupada puede requerir más tiempo para la entrega.

## 5. Dejar el crédito para después
Si necesitas financiamiento, consigue una preaprobación antes de la subasta.

## 6. Ofertar en el último segundo sin conexión estable
El cierre es fijo. Asegura una buena conexión y no esperes al final.

## 7. No hacer preguntas
Si algo no está claro, consulta al equipo antes de ofertar.`},
 {daysAgo:5,featured:true,title:'Cómo calcular tu oferta máxima antes de entrar a la sala',category:'guias-para-compradores',image:6,excerpt:'Una fórmula simple para definir cuánto ofertar sin dejarte llevar por la competencia.',body:`La mejor decisión se toma antes de que empiece la subasta, no durante.

## Parte de tu presupuesto total
Suma tus recursos disponibles y, si corresponde, el monto de crédito preaprobado.

## Resta los costos asociados
- Gastos de notaría e inscripción.
- Impuestos y contribuciones pendientes, si las hay.
- Reparaciones o habilitación que estimes necesarias.
- Un margen para imprevistos.

## Compara con la tasación
El descuento sobre la tasación es una referencia útil, pero no la única. Revisa también precios de propiedades similares en la misma comuna.

## Fija el número y respétalo
Escribe tu oferta máxima y no la superes durante la subasta. Siempre habrá otras oportunidades.`},
 {daysAgo:7,title:'Comprar en remate con crédito hipotecario: lo que debes saber',category:'financiamiento',image:8,excerpt:'No todas las propiedades admiten crédito. Te explicamos cómo identificarlas y cómo prepararte.',body:`Muchas personas creen que en un remate solo se puede pagar al contado. No siempre es así.

## Revisa la etiqueta "Con crédito"
En SeSubasta, las propiedades que admiten financiamiento hipotecario lo indican en la tarjeta y en la ficha.

## Pide una preaprobación
Antes de ofertar, solicita a tu banco una evaluación. Te dará claridad sobre el monto y los plazos.

## Considera los tiempos
El banco necesitará tasar la propiedad y revisar sus títulos. Confirma que los plazos de pago de las bases sean compatibles.

## Ten un plan B
Si el crédito no se aprueba a tiempo, revisa qué dicen las bases sobre la garantía de seriedad.`},
 {daysAgo:9,title:'Garantía de seriedad: para qué sirve y cuándo se devuelve',category:'financiamiento',image:10,excerpt:'Qué es la garantía que piden algunas subastas, cómo se constituye y qué pasa si no te adjudicas.',body:`Algunas subastas piden una garantía de seriedad para participar. Su objetivo es asegurar que quienes ofertan tienen una intención real de compra.

## Cómo funciona
- La ficha indica si la subasta exige garantía y su monto.
- Se constituye antes del inicio, según las instrucciones de la plataforma.
- El equipo confirma la garantía y habilita tu participación.

## Si no te adjudicas
La garantía se devuelve en el plazo indicado en las bases.

## Si te adjudicas
Normalmente se imputa al precio. Si no cumples las condiciones de pago, podrías perderla según lo que indiquen las bases.`},
 {daysAgo:11,title:'Tasación y precio de remate: cómo leer el descuento',category:'mercado-inmobiliario',image:3,excerpt:'Qué significa el porcentaje bajo tasación y por qué conviene mirarlo junto a otros datos.',body:`El porcentaje bajo tasación compara la oferta vigente (o el precio inicial) con el valor de tasación informado.

## Un dato útil, no el único
Una tasación es una estimación profesional a una fecha determinada. El valor de mercado puede variar según la ubicación, el estado y la demanda.

## Qué mirar además
- Precios de propiedades similares en la misma comuna.
- El estado de conservación y la ocupación informada.
- Los gastos que asumirás al adjudicarte.

## El descuento cambia durante la subasta
A medida que suben las ofertas, el porcentaje bajo tasación disminuye. Por eso la tarjeta lo actualiza en tiempo real.`},
 {daysAgo:13,title:'Gastos adicionales al adjudicarte una propiedad',category:'antecedentes-legales',image:14,excerpt:'Notaría, inscripción, impuestos y deudas: los costos que conviene considerar antes de ofertar.',body:`El precio de adjudicación no es el único costo de comprar una propiedad.

## Gastos frecuentes
- Escritura y gastos notariales.
- Inscripción en el Conservador de Bienes Raíces.
- Contribuciones o gastos comunes pendientes, según lo que indiquen las bases.
- Costos del crédito hipotecario, si lo usas.

## Dónde encontrar la información
Revisa las bases y los documentos públicos de la ficha. Si tienes dudas, consulta al equipo antes de ofertar.

## Un recordatorio
Esta información es general y no reemplaza la asesoría profesional que requiera tu caso.`},
 {daysAgo:15,title:'¿Por qué cada vez más personas compran propiedades en subasta?',category:'mercado-inmobiliario',image:1,excerpt:'Transparencia, precios competitivos y procesos más rápidos: las razones detrás del interés por los remates.',body:`Los remates de propiedades dejaron de ser un mercado reservado para especialistas.

## Información disponible para todos
Hoy es posible revisar fichas, documentos y fechas desde el teléfono, sin intermediarios.

## Precios que parten bajo tasación
El precio inicial suele ubicarse bajo el valor de tasación, lo que abre oportunidades para quienes se preparan.

## Reglas iguales para quienes participan
Todas las ofertas se registran con hora oficial y quedan visibles para quienes compiten.

## Decisiones más rápidas
La subasta concentra la competencia en un plazo definido, en vez de negociaciones que se extienden por meses.`},
 {daysAgo:17,title:'Cómo preparar tu propiedad para venderla en subasta',category:'vender-una-propiedad',image:11,excerpt:'Documentos, fotografías y precio inicial: lo que ayuda a que tu propiedad reciba más ofertas.',body:`Una buena preparación hace que más personas se interesen y oferten con confianza.

## Ordena los antecedentes
Reúne los documentos de la propiedad. El equipo Legal los revisará antes de publicar.

## Muestra la propiedad tal como es
Fotografías claras y una descripción honesta generan confianza y evitan sorpresas.

## Define un precio inicial atractivo
Un precio inicial competitivo atrae a más participantes, y la competencia ayuda a mejorar el resultado.

## Presenta tu propiedad
Completa el formulario de ingreso. Es privado y el equipo te contactará para evaluar el caso.`},
 {daysAgo:19,title:'Propiedades heredadas: vender en subasta cuando hay varios herederos',category:'vender-una-propiedad',image:17,excerpt:'Una subasta puede ordenar la venta y dar un precio transparente para todas las partes.',body:`Cuando una propiedad se hereda entre varias personas, ponerse de acuerdo en el precio no siempre es fácil.

## Un precio definido por la competencia
En una subasta, el precio lo fija la mejor oferta recibida. Todas las partes ven el mismo resultado.

## Antecedentes en orden
Antes de vender suele ser necesario completar la posesión efectiva y regularizar la inscripción. El equipo te orientará sobre lo que falta.

## Un proceso con plazos claros
La subasta tiene fecha de inicio y de cierre, lo que ayuda a planificar la venta.`}
];
module.exports={EXTRA_CATEGORIES,EXTRA_POSTS};
/* Agrega las categorías y artículos que falten (por slug). Devuelve cuántos artículos agregó. */
function addExtraBlog(d,slugify,now=Date.now()){d.categories=d.categories||[];d.posts=d.posts||[];let added=0;
 for(const [name,slug,description] of EXTRA_CATEGORIES)if(!d.categories.some(c=>c.slug===slug))d.categories.push({id:'cat_'+slug,name,slug,description,order:d.categories.length,active:true});
 for(const p of EXTRA_POSTS){const slug=slugify(p.title);if(d.posts.some(x=>x.slug===slug))continue;const cat=d.categories.find(c=>c.slug===p.category);const at=now-p.daysAgo*86400000;
  d.posts.push({id:'post_'+slug.slice(0,40),slug,title:p.title,excerpt:p.excerpt,body:p.body,cover:{key:`demo:${p.image}`,alt:'Fotografía ilustrativa de una propiedad'},categoryId:cat?cat.id:null,tags:[],authorId:'usr_editor',status:'published',seoTitle:'',metaDescription:p.excerpt,canonical:'',noindex:false,publishedAt:at,scheduledAt:null,createdAt:at,updatedAt:at,revisions:[],featured:!!p.featured});added++}
 return added}
module.exports.addExtraBlog=addExtraBlog;
