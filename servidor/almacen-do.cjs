/* Almacenamiento en Cloudflare: SQLite del Durable Object (incluido en el plan gratuito).
   Misma interfaz que servidor/almacen.cjs: data, tx(), enginePersist(), saveFile(), readFile(), moveFile().
   Cada colección se guarda en su propia fila (dividida en partes si es grande) y solo se reescribe lo que cambió.
   Los archivos (fotos y documentos) se guardan como BLOB divididos en partes de 1,5 MB. */
const clone=v=>JSON.parse(JSON.stringify(v));
const PART=700000,FILE_PART=1500000;

class DOStore{
 constructor(storage){this.storage=storage;this.sql=storage.sql;this.cache=new Map();this.data=null;
  this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT NOT NULL, part INTEGER NOT NULL, v TEXT NOT NULL, PRIMARY KEY (k, part))');
  this.sql.exec('CREATE TABLE IF NOT EXISTS files (vis TEXT NOT NULL, k TEXT NOT NULL, part INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (vis, k, part))')}
 load(seedFn){const rows=this.sql.exec('SELECT k, part, v FROM kv ORDER BY k, part').toArray();
  if(rows.length){const parts={};for(const r of rows)(parts[r.k]=parts[r.k]||[]).push(r.v);const data={};for(const [k,list] of Object.entries(parts)){const s=list.join('');this.cache.set(k,s);data[k]=JSON.parse(s)}
   if(data.schema!==3)throw Error('Datos de una versión anterior: reinicia los datos de prueba.');this.data=data}
  else{this.data=seedFn(this);this.write(this.data)}
  return this}
 /* Escritura atómica: todas las colecciones modificadas se guardan en una sola transacción. */
 write(data){const changed=[];for(const [k,v] of Object.entries(data)){const s=JSON.stringify(v);if(this.cache.get(k)!==s)changed.push([k,s])}
  if(!changed.length)return;
  this.storage.transactionSync(()=>{for(const [k,s] of changed){this.sql.exec('DELETE FROM kv WHERE k = ?',k);for(let i=0,n=0;i<s.length||n===0;i+=PART,n++)this.sql.exec('INSERT INTO kv (k, part, v) VALUES (?, ?, ?)',k,n,s.slice(i,i+PART))}});
  for(const [k,s] of changed)this.cache.set(k,s)}
 tx(fn){const {subastas,...rest}=this.data;const draft={...clone(rest),subastas};const result=fn(draft);this.write(draft);this.data=draft;return result}
 enginePersist(){return state=>{const draft={...this.data,subastas:state};this.write(draft);this.data=draft}}
 saveFile(vis,key,buffer){if(!/^[\w.-]+$/.test(key))throw Error('Clave de archivo no válida.');const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  this.storage.transactionSync(()=>{this.sql.exec('DELETE FROM files WHERE vis = ? AND k = ?',vis,key);for(let i=0,n=0;i<bytes.length||n===0;i+=FILE_PART,n++)this.sql.exec('INSERT INTO files (vis, k, part, data) VALUES (?, ?, ?, ?)',vis,key,n,bytes.subarray(i,i+FILE_PART))});return key}
 readFile(vis,key){if(!/^[\w.-]+$/.test(key))return null;const rows=this.sql.exec('SELECT data FROM files WHERE vis = ? AND k = ? ORDER BY part',vis,key).toArray();if(!rows.length)return null;const chunks=rows.map(r=>new Uint8Array(r.data));const out=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let o=0;for(const c of chunks){out.set(c,o);o+=c.length}return out}
 moveFile(from,to,key){this.sql.exec('UPDATE files SET vis = ? WHERE vis = ? AND k = ?',to,from,key)}
}
module.exports={DOStore};
