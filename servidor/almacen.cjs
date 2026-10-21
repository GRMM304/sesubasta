/* Local stand-in for D1 + R2: one JSON document written atomically and a private file folder.
   Every mutation runs inside tx(), is written to disk first and only then replaces the live data. */
const fs=require('node:fs'),path=require('node:path');
const clone=v=>JSON.parse(JSON.stringify(v));

class Store{
 constructor(file){this.file=file;this.dir=path.dirname(file);this.filesDir=path.join(this.dir,'archivos');this.data=null}
 load(seedFn){fs.mkdirSync(path.join(this.filesDir,'publico'),{recursive:true});fs.mkdirSync(path.join(this.filesDir,'privado'),{recursive:true});
  if(fs.existsSync(this.file)){this.data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(this.data.schema!==3)throw Error('El archivo de datos de prueba es de una versión anterior. Detén el servidor, retira la carpeta runtime-data y vuelve a iniciar.')}
  else{this.data=seedFn(this);this.write(this.data)}
  return this}
 write(data){const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify(data));fs.renameSync(temp,this.file)}
 /* The auction engine owns data.subastas; tx() keeps that reference so both stay consistent. */
 tx(fn){const {subastas,...rest}=this.data;const draft={...clone(rest),subastas};const result=fn(draft);this.write(draft);this.data=draft;return result}
 enginePersist(){return state=>{const draft={...this.data,subastas:state};this.write(draft);this.data=draft}}
 saveFile(visibility,key,buffer){const target=path.join(this.filesDir,visibility,key);if(!target.startsWith(path.join(this.filesDir,visibility)+path.sep))throw Error('Ruta de archivo no válida.');fs.writeFileSync(target,buffer);return key}
 filePath(visibility,key){if(!/^[\w.-]+$/.test(key))return null;const target=path.join(this.filesDir,visibility,key);return fs.existsSync(target)?target:null}
 readFile(visibility,key){const p=this.filePath(visibility,key);return p?fs.readFileSync(p):null}
 moveFile(from,to,key){const a=this.filePath(from,key);if(!a)return;fs.renameSync(a,path.join(this.filesDir,to,key))}
}
module.exports={Store,clone};
