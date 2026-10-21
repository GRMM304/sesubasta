/* Genera index.html y copia solo los archivos públicos a dist/ (lo que Cloudflare sirve como estáticos). */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');
execFileSync(process.execPath,[path.join(root,'build.cjs')],{stdio:'inherit'});
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist);
for(const f of ['index.html','vista-responsive.html'])fs.copyFileSync(path.join(root,f),path.join(dist,f));
fs.cpSync(path.join(root,'assets'),path.join(dist,'assets'),{recursive:true,filter:s=>!s.endsWith('.DS_Store')});
console.log('dist/ listo para Cloudflare');
