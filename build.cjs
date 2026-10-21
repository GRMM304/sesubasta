/* Builds the single responsive index.html from fuentes/. Run with: npm run build */
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,src=p=>fs.readFileSync(path.join(root,p),'utf8');
const {seedData,COMMUNES}=require('./servidor/semilla.cjs');
const D=require('./servidor/dominio.cjs');

/* File-only preview data: the same seed the server uses, projected to public fields only. */
const data=seedData({saveFile(){}});
const rel=u=>u.replace(/^\//,'');
const properties=data.properties.filter(p=>p.publicStatus==='published').map(p=>{const v=D.publicFields(p);v.media=v.media.map(m=>({...m,url:rel(D.mediaUrl(m.key))}));return v});
const cat=id=>data.categories.find(c=>c.id===id);
const posts=data.posts.filter(p=>p.status==='published').map(p=>({id:p.id,slug:p.slug,title:p.title,excerpt:p.excerpt,body:p.body,cover:{url:rel(D.mediaUrl(p.cover.key)),alt:p.cover.alt},category:cat(p.categoryId)&&{name:cat(p.categoryId).name,slug:cat(p.categoryId).slug},tags:[],author:'Equipo editorial',publishedAt:p.publishedAt,updatedAt:p.updatedAt,readMinutes:Math.max(1,Math.round(p.body.split(/\s+/).length/200)),metaDescription:p.excerpt,featured:p.featured}));
const c=data.config;
const seed={builtAt:data.createdAt,properties,posts,categories:data.categories.map(x=>({name:x.name,slug:x.slug,description:x.description,count:posts.filter(p=>p.category?.slug===x.slug).length})),legal:c.legal,subastas:data.subastas,
 config:{ga:{measurementId:'',debug:false},uf:{value:c.ufValue,date:c.ufDate,source:c.ufSource,demo:true,available:true},contact:c.contact,termsVersion:c.termsVersion,how:c.how,faqs:c.faqs,homeTitle:c.homeTitle,homeLead:c.homeLead,featured:c.featured,mode:'file'}};

const css=src('fuentes/estilos.css');
const app=[
 `window.__SEED=${JSON.stringify(seed)};window.__COMMUNES=${JSON.stringify(COMMUNES)};`,
 src('fuentes/auction-core.js'),src('fuentes/catalogo-core.js'),
 ...['nucleo','marco','subasta','publico','cuenta','gestion','equipo','arranque'].map(n=>`/* ---- ${n}.js ---- */\n`+src(`fuentes/app/${n}.js`))
].join('\n').replace(/<\/script/gi,'<\\/script');
/* The server needs home config "featured" too: expose it through /api/v1/config. */
const html=src('fuentes/plantilla.html').replace('/*@@CSS@@*/',()=>css).replace('/*@@APP@@*/',()=>app);
fs.writeFileSync(path.join(root,'index.html'),html);
console.log(`index.html generado: ${(html.length/1024).toFixed(0)} KB`);
