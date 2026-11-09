/* contacto@ y garantias@sesubasta.cl: reenvían cada mensaje (con sus adjuntos, sin modificarlo) a las direcciones del equipo.
   Es solo reenvío: no hay bandeja propia ni envío desde esta dirección.
   Las destinatarias deben estar verificadas en Cloudflare Email Routing. */
const DESTINATARIOS=['jvalenzuela@grupomm.cl','eorrego@grupomm.cl','raguilera@grupomm.cl','frojas@grupomm.cl','ibarboza@grupomm.cl'];
const DIRECCIONES=['contacto@sesubasta.cl','garantias@sesubasta.cl'];

export default{
 async email(message){
  if(!DIRECCIONES.includes(message.to.toLowerCase())){message.setReject('Dirección no disponible.');return}
  const fallidos=[];
  for(const destino of DESTINATARIOS){try{await message.forward(destino)}catch(e){fallidos.push(destino);console.error('No se pudo reenviar a '+destino,e)}}
  // Si no llegó a nadie, se rechaza para que quien escribió reciba el aviso de no entrega.
  if(fallidos.length===DESTINATARIOS.length)message.setReject('No se pudo entregar el mensaje. Intenta más tarde.');
 }};
