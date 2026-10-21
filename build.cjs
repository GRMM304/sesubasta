const fs=require('fs'),path=require('path');const root=__dirname;let html=fs.readFileSync(path.join(root,'base.html'),'utf8');
// Existing presentation and role workflows are preserved; obsolete initial renders are deferred.
html=html.replace(/<script>([\s\S]*?)<\/script>/g,(tag,body)=>'<script>'+body.replace(/parseRoute\(\);render\(\);/g,'parseRoute();').replace(/render\(\);\s*$/,'')+'</script>');
// The new domain overrides legacy participation, removing its enrollment dependency.
html=html.replace('</body>',()=>'<style>'+fs.readFileSync(path.join(root,'fuentes/live.css'),'utf8')+'</style>\n<script>'+fs.readFileSync(path.join(root,'fuentes/auction-core.js'),'utf8').replace(/<\/script>/g,'<\\/script>')+'</script>\n<script>'+fs.readFileSync(path.join(root,'fuentes/live.js'),'utf8').replace(/<\/script>/g,'<\\/script>')+'</script>\n</body>');
html=html.replace('SeSubasta · Prototipo responsive','SeSubasta · Subastas en vivo');
fs.writeFileSync(path.join(root,'index.html'),html);
