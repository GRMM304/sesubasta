/* Ajustes de datos al iniciar, para archivos creados con versiones anteriores del prototipo. */
const D=require('./dominio.cjs');
const SOCIAL={instagram:'https://www.instagram.com/sesubasta.cl/',facebook:'https://www.facebook.com/sesubasta.cl',tiktok:'https://www.tiktok.com/@sesubasta.cl',linkedin:'https://www.linkedin.com/company/sesubasta/'};
function migrate(d){
 // Cada ficha publicada conserva la versión pública aprobada separada de las ediciones privadas posteriores.
 for(const p of d.properties)if(p.publicStatus==='published'&&!p.live)p.live=D.publicFields(p);
 if(!d.config.social)d.config.social={...SOCIAL};
 d.whatsapp=d.whatsapp||[];d.tasks=d.tasks||[];
 for(const m of d.mail){delete m.html;delete m.text}
}
module.exports={migrate,SOCIAL};
