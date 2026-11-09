/* Geocodificación de direcciones: un único punto de conexión con el proveedor.
   Para cambiar de proveedor (Google, Mapbox, servicio propio) basta con agregar otra función en PROVIDERS
   y elegirla con GEOCODER_PROVIDER; el formulario y las fichas no cambian.
   Prototipo: Nominatim (OpenStreetMap), una consulta puntual por clic, sin autocompletado.
   Política de uso: https://operations.osmfoundation.org/policies/nominatim/ */
const UA='SeSubasta-RematesDinamicos/1.0 (oficina@grupomm.cl)';

const PROVIDERS={
 async nominatim(address){const url='https://nominatim.openstreetmap.org/search?'+new URLSearchParams({q:address,format:'jsonv2',limit:'1',countrycodes:'cl','accept-language':'es'});
  const r=await fetch(url,{headers:{'User-Agent':UA,Referer:process.env.SITE_URL||'https://sesubasta.cl',accept:'application/json'}});
  if(!r.ok)throw Object.assign(Error('El servicio de mapas no respondió ('+r.status+'). Intenta de nuevo en unos segundos.'),{unavailable:true});
  const [hit]=await r.json();if(!hit)return null;return {lat:Number(hit.lat),lng:Number(hit.lon),label:hit.display_name,provider:'nominatim'}}};

/* Coordenadas razonables para Chile continental e insular (evita guardar resultados absurdos). */
const inChile=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat<=-17&&lat>=-56.5&&lng<=-66&&lng>=-110;
const round=n=>Math.round(n*1e6)/1e6;

async function geocode(address){const provider=PROVIDERS[process.env.GEOCODER_PROVIDER||'nominatim']||PROVIDERS.nominatim;const hit=await provider(address);
 if(!hit||!inChile(hit.lat,hit.lng))return null;return {...hit,lat:round(hit.lat),lng:round(hit.lng),at:Date.now()}}
module.exports={geocode,inChile,round};
