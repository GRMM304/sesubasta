# SeSubasta · Remates Dinámicos · prototipo funcional v4.1

Una sola aplicación web responsive para remates.sesubasta.cl. Escritorio, tablet y móvil usan el mismo `index.html`, las mismas rutas y los mismos datos. Todas las pantallas del requerimiento v4.0 funcionan con datos de prueba; ninguna es una maqueta.

## Cómo probarlo (recomendado)

1. Instala Node.js 20 o superior.
2. Abre una terminal en esta carpeta y ejecuta `npm start`. No hay que instalar dependencias.
3. Abre `http://127.0.0.1:8080`.

| Qué | Dónde |
|---|---|
| Sitio público | `http://127.0.0.1:8080` |
| Acceso del equipo (sin enlace público) | `http://127.0.0.1:8080/admin-login` |
| Correos de prueba (verificación, recuperación, código MFA, avisos) | `http://127.0.0.1:8080/dev/correos` |
| Mapa de pantallas por ID del requerimiento | `http://127.0.0.1:8080/prototipo/pantallas` |
| Revisión por ancho de pantalla | `http://127.0.0.1:8080/vista-responsive.html` |

Para empezar con datos limpios: detén el servidor, ejecuta `npm run reiniciar-datos` y vuelve a `npm start`. Los datos de prueba se guardan en `runtime-data/`. Las subastas en vivo de muestra cierran 15 y 30 minutos después del primer inicio, por lo que conviene reiniciar los datos antes de cada demostración.

## Cuentas ficticias

Todas usan la contraseña `Demo2026!`.

| Correo | Rol | Notas |
|---|---|---|
| admin@demo.cl | Administrador general | Pide un código de 6 dígitos (MFA) que llega a Correos de prueba |
| legal@demo.cl | Legal | Carga y gestiona antecedentes legales privados |
| colaborador@demo.cl | Colaborador | Crea fichas, sube fotos, solicita revisión |
| editor@demo.cl | Editor de contenido | Blog: escribe, programa y publica |
| operador@demo.cl | Operador de remates | Monitor, suspensión, actividad, solicitudes y adjudicación |
| alex@comprador.demo.cl | Comprador | Correo verificado |
| camila@comprador.demo.cl | Comprador | Correo verificado |

En `/ingresar` también hay botones "Entrar como Alex" y "Entrar como Camila". Para ver la subasta en tiempo real, abre dos ventanas (una normal y otra privada) y entra con una cuenta distinta en cada una.

## Recorridos sugeridos

- **Comprador:** crea una cuenta en `/registro`, abre el enlace de verificación en Correos de prueba, entra a una propiedad "En vivo", pulsa Subastar, revisa y confirma. Recibes un folio y puedes seguir subastando. Revisa Mis subastas, Guardadas, Notificaciones y Perfil (descarga de datos y solicitud de eliminación).
- **Circuito de publicación:**
  1. El colaborador crea una ficha, completa sus datos, sube una foto y define las condiciones.
  2. Legal carga un PDF privado y marca su bloque como completo.
  3. El colaborador solicita revisión.
  4. El Administrador general entra con su código, revisa el expediente, completa la lista de verificación y publica. La subasta queda programada.
- **Operación:** el operador abre el monitor de una subasta, la suspende con motivo (los montos se rechazan de inmediato) y el Administrador la reanuda con una nueva fecha. En la subasta cerrada de La Florida se confirma el resultado preliminar o se registra un incumplimiento.
- **Vender:** completa el formulario de 6 pasos en "Ingresa tu inmueble". La solicitud llega a Solicitudes del equipo y nunca se publica sola.

## Google Analytics 4

Ya está etiquetado. Basta con pegar el ID de medición `G-XXXXXXXXXX` en Gestión → Configuración (Administrador general). La etiqueta solo se carga si la persona acepta las cookies de analítica (Consent Mode v2), y nunca se envían montos ni datos personales. El detalle de eventos y la configuración recomendada están en `docs/plan-de-medicion.md`.

## Abrir solo el HTML (vista individual)

Al abrir `index.html` con doble clic puedes recorrer el inicio, el catálogo, las fichas, el blog y una subasta local con Alex o Camila. Este modo no sincroniza personas. Las pantallas que guardan datos (registro, panel del equipo, formularios) indican que requieren el servidor local.

## Estructura del código

| Ruta | Contenido |
|---|---|
| `server.cjs` | Servidor HTTP local: rutas reales, SEO, archivos, eventos en vivo (SSE) |
| `servidor/api.cjs` | API `/api/v1`; la autorización por rol se valida aquí en cada solicitud |
| `servidor/seo.cjs` | Título, descripción, canonical, Open Graph, datos estructurados, sitemap y robots |
| `servidor/seguridad.cjs` | Contraseñas con scrypt, tokens, cookies HttpOnly, límites de intentos y validación de archivos |
| `servidor/semilla.cjs` | Datos ficticios iniciales |
| `fuentes/auction-core.js` | Motor de subasta compartido: mínimo, cierre fijo, idempotencia, concurrencia, suspensión |
| `fuentes/catalogo-core.js` | Búsqueda, filtros y orden compartidos entre servidor y vista individual |
| `fuentes/app/*.js` | Interfaz: núcleo, marco, subasta, público, cuenta, gestión y arranque |
| `fuentes/estilos.css` | Hoja única responsive según el Manual de Marca |
| `fuentes/plantilla.html` | Plantilla de `index.html` |
| `docs/` | Plan de medición |

Después de editar algo en `fuentes/`, ejecuta `npm run build` para regenerar `index.html`. Para verificar, ejecuta `npm test`: son 12 pruebas del motor, permisos, MFA, publicación, privacidad de documentos, suspensión y SEO.

## Lo que sigue siendo de demostración

El servidor local reproduce las reglas del requerimiento, pero **no es producción** y no debe publicarse en internet.

- Los datos se guardan en un archivo JSON. En producción irían en Cloudflare D1, R2 y un Durable Object por subasta.
- Los correos se simulan en `/dev/correos`.
- La UF es un valor ficticio de $40.000, rotulado como tal.
- Los textos legales y las bases son borradores pendientes de aprobación.
- Las imágenes son ilustrativas.

Producción requiere el despliegue en Cloudflare, un proveedor de correo, el valor UF oficial, los textos aprobados por Legal y el ID de GA4 definitivo.
