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
| WhatsApp de prueba (tareas e invitaciones) | `http://127.0.0.1:8080/dev/whatsapp` |
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

## Publicar en Cloudflare (sitio de pruebas para el equipo)

El mismo código corre en Cloudflare Workers, en el plan gratuito, con un link fijo `https://sesubasta-remates.<tu-subdominio>.workers.dev`.

| Pieza | Qué hace |
|---|---|
| Worker (`cloudflare/worker.mjs`) | Pide la contraseña de acceso y sirve los archivos estáticos de `dist/` |
| Durable Object `SeSubastaApp` | Es la autoridad: guarda datos y archivos en su SQLite, serializa los montos, mantiene la conexión en vivo por WebSocket y programa con alarmas los cierres, avisos y envíos |
| `servidor/aplicacion.cjs` | Lógica HTTP compartida con el servidor local; las reglas son idénticas en ambos |

**Pasos:**

1. Crea una cuenta gratuita en cloudflare.com.
2. Conecta este computador a tu cuenta con `npx wrangler login`. Se abre el navegador para autorizar.
3. Define la contraseña de acceso del equipo con `npm run cf:clave` y escríbela cuando te la pida.
4. Publica con `npm run cf:deploy`. Al terminar muestra el link.

Para actualizar el sitio después de un cambio, vuelve a ejecutar `npm run cf:deploy`. Los datos de prueba se conservan entre publicaciones.

**Opcional:** correo real (`npx wrangler secret put RESEND_API_KEY` y `MAIL_FROM`) y WhatsApp automático (`WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`).

**Probar antes de publicar:** escribe `SITE_PASSWORD=algo` en un archivo `.dev.vars` y ejecuta `npm run cf:dev`. El sitio queda en `http://127.0.0.1:8787` con el mismo motor de Cloudflare.

**Contraseña de acceso:** mientras exista, todo el sitio (incluidos `/dev/correos` y `/admin-login`) pide esa contraseña y nadie lo indexa. Después, cada persona entra con su cuenta de prueba.

**Límites del plan gratuito** (sobran para un equipo de pruebas): 100.000 solicitudes diarias al Worker y al Durable Object, 5 GB de almacenamiento y 100.000 filas escritas al día.

El servidor local también acepta `SITE_PASSWORD`, por ejemplo para compartirlo con un túnel.

## Equipo interno y tareas

**Crear usuarios del equipo.** El Administrador general los crea en Gestión → Usuarios y roles, indicando:

- nombre, correo, WhatsApp, cargo, área y notas internas;
- uno o más roles: Administrador general, Legal, Colaborador, Operador de remates o Editor de contenido.

La persona recibe por correo y por WhatsApp un enlace para activar su cuenta y crear su contraseña; vence en 72 horas. El Administrador también puede copiar el enlace, enviarlo con el botón de WhatsApp, reenviar la invitación y editar los datos.

**Correo y WhatsApp obligatorios.** Cada integrante tiene correo y WhatsApp registrados. Si a alguien le falta el WhatsApp, el panel lo lleva a **Mi perfil** antes de dejarlo continuar. En Mi perfil cada persona actualiza su WhatsApp, elige si recibe las tareas por correo, por WhatsApp o por ambos, y cambia su contraseña.

**Tareas** (Gestión → Tareas, o el botón "Asignar tarea" en fichas, expedientes, monitor de subastas, solicitudes y usuarios):

- Cualquier integrante asigna una tarea a una o varias personas, con prioridad, fecha de vencimiento y, si quiere, un vínculo a la ficha o subasta.
- El aviso sale por correo y por WhatsApp.
- El responsable la marca "en curso" o "hecha", y quien la asignó recibe el aviso.
- Hay comentarios con aviso, recordatorios manuales (máximo 3 por hora) y recordatorios automáticos 24 horas antes y al vencer.
- La lista "Asignadas a mí" tiene un contador en el menú. El Administrador general ve todas las tareas; el resto solo las que creó o le asignaron.

**Cómo sale el WhatsApp:**

1. **Botón "WhatsApp a …"** (funciona hoy). Abre WhatsApp en tu teléfono o computador con el mensaje ya escrito; solo pulsas enviar. No requiere contratar nada.
2. **Envío automático** con la API oficial de WhatsApp Business (Meta). Se activa iniciando el servidor con estas variables:

```
WHATSAPP_TOKEN=xxxx WHATSAPP_PHONE_ID=xxxx WHATSAPP_TEMPLATE=aviso_tarea npm start
```

Meta exige que los mensajes iniciados por la empresa usen una **plantilla aprobada**. Crea en Meta una plantilla llamada `aviso_tarea`, en español, con un parámetro de texto `{{1}}`.

Mientras no esté conectado, los mensajes quedan en `http://127.0.0.1:8080/dev/whatsapp`, cada uno con su botón "Abrir en WhatsApp".

Los números de prueba (+56 9 0000 000X) son ficticios. Cambia el tuyo en Mi perfil para probar con tu teléfono.

## Avisos y alertas por correo

Cada aviso aparece en Notificaciones (la campana) y, según las preferencias de la persona, también llega por correo con el diseño de SeSubasta.

| Para quién | Avisos |
|---|---|
| Quien subasta | Comprobante de cada monto aceptado, "tu monto fue superado" (agrupado para no saturar), "cierra en 1 hora", "cierra en 10 minutos" (indica si vas primero o te superaron), suspensión, reanudación con nueva fecha, cancelación, resultado al cierre y confirmación de la adjudicación |
| Quien guardó una propiedad | Empieza en menos de 1 hora, comenzó la subasta, está por cerrar, y cambios de fechas o condiciones |
| Alertas de nuevas propiedades (opcional) | Una alerta al publicarse cada propiedad, con filtro opcional por región y tipo |
| Novedades del blog (opcional) | Una alerta al publicarse cada artículo |
| Cuenta (siempre) | Verificación de correo, recuperación y cambio de contraseña, solicitud de eliminación |
| Equipo | Nueva solicitud (operador), ficha enviada a revisión (Administrador general), asignación de expediente (Legal), decisión de publicación (creador de la ficha) y resultado por confirmar al cierre (operador) |

- Cada persona elige qué recibir en **Mi cuenta → Perfil y privacidad → Avisos y alertas por correo**.
- Cada correo trae un enlace de **dejar de recibir** que desactiva solo esa categoría, sin iniciar sesión.
- Los correos se guardan primero en una bandeja de salida y luego se entregan.
- Sin proveedor configurado, quedan en `/dev/correos`, donde puedes ver cada uno con su diseño.

**Envío real:** crea una cuenta en Resend (resend.com), verifica el dominio remitente y arranca el servidor con estas variables:

```
RESEND_API_KEY=re_xxxxxxxx MAIL_FROM="SeSubasta <avisos@sesubasta.cl>" SITE_URL=https://remates.sesubasta.cl npm start
```

Si el proveedor falla, el mensaje se reintenta hasta 3 veces. Cada correo incluye la cabecera List-Unsubscribe para la baja con un clic en Gmail y Outlook.

## Logos y redes sociales

- **Pie de página:** logo vertical oficial en negativo (`assets/marca/logo-sesubasta-vertical-negativo.png`), una copia web del archivo "Identidad SeSubasta-10".
- **Cabecera del panel del equipo:** logotipo en negativo (`assets/marca/logo-sesubasta-negativo.png`), a partir de "Identidad SeSubasta-08".
- Los originales no se modificaron.
- Los íconos de Facebook, Instagram, TikTok y LinkedIn enlazan a las direcciones configuradas en Gestión → Configuración → Datos de contacto públicos. Si dejas un campo vacío, su ícono se oculta.

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

Después de editar algo en `fuentes/`, ejecuta `npm run build` para regenerar `index.html`. Para verificar, ejecuta `npm test`: son 14 pruebas del motor, permisos, MFA, publicación, privacidad de documentos, suspensión, SEO, alertas por correo, alta de usuarios y tareas.

## Lo que sigue siendo de demostración

El servidor local reproduce las reglas del requerimiento, pero **no es producción** y no debe publicarse en internet.

- Los datos se guardan en un archivo JSON. En producción irían en Cloudflare D1, R2 y un Durable Object por subasta.
- Los correos se simulan en `/dev/correos`, salvo que configures el proveedor (ver Avisos y alertas por correo).
- La UF es un valor ficticio de $40.000, rotulado como tal.
- Los textos legales y las bases son borradores pendientes de aprobación.
- Las imágenes son ilustrativas.

Producción requiere el despliegue en Cloudflare, un proveedor de correo, el valor UF oficial, los textos aprobados por Legal y el ID de GA4 definitivo.
