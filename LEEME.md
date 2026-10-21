# SeSubasta · prototipo responsive v4.0

## Qué cambia

Una persona inicia sesión y puede subastar directamente y varias veces hasta la fecha límite, sin inscripción por propiedad. El registro aceptado actualiza el monto vigente y el siguiente mínimo. La pantalla mantiene el formulario disponible, muestra fechas, contador, personas únicas y el estado propio. El favicon oficial se incluye desde el prototipo. No hay extensiones automáticas del cierre.

## Probar dos personas en tiempo real

1. Instalar Node.js 20 o superior, si no está instalado.
2. Abrir una terminal en esta carpeta y ejecutar `node server.cjs` (también `npm start`). No requiere instalar dependencias.
3. Abrir `http://127.0.0.1:8080` en dos pestañas.
4. Abrir el departamento de Providencia, propiedad 2, y pulsar Subastar.
5. Elegir Alex en una pestaña y Camila en la otra. Son perfiles ficticios, sin credenciales personales.
6. Revisar el monto, confirmar y observar el cambio en ambas pestañas. Repetir con un monto válido.

El servidor local sincroniza las sesiones mediante SSE y valida cada envío en el motor compartido. Los datos aceptados se guardan en `runtime-data/auctions.json`; las sesiones son temporales. La propiedad 2 cierra a los 15 minutos del primer inicio; otras activas, a los 30 minutos. Para comenzar una demostración nueva, detener el servidor y retirar solamente ese archivo de datos de prueba; se creará otro al reiniciar. El paquete se entrega sin registros previos.

Este servidor es exclusivamente de demostración local. No publicarlo en Internet: sus perfiles de prueba no son autenticación de producción.

## Abrir solamente el HTML

Abrir `index.html` permite recorrer la interfaz sin servidor. Este modo es individual y no sincroniza personas. El aviso visible distingue ambos modos. Mantener la carpeta assets junto al HTML.

`vista-responsive.html` permite revisar el mismo sitio a diferentes anchos. Escritorio y móvil utilizan un único index y el mismo flujo. No son dos aplicaciones distintas.

## Acceso interno

No existe enlace público al panel del equipo. Con servidor: `http://127.0.0.1:8080/admin-login`. Con archivo: abrir index.html y agregar `#admin-login` a su dirección.

Cuentas ficticias del panel, contraseña común `Demo2026!`:

| Correo | Rol |
|---|---|
| admin@demo.cl | Administrador general |
| legal@demo.cl | Legal |
| colaborador@demo.cl | Colaborador |
| editor@demo.cl | Editor |
| operador@demo.cl | Operador |

El panel interno es un prototipo del flujo y sus permisos en interfaz; no constituye autorización segura en servidor. Legal carga la parte legal; el colaborador prepara la ficha y solicita revisión; solo el administrador general publica. Los archivos legales son una demostración de interacción y metadatos, sin almacenamiento documental de producción.

## Datos y reglas de demostración

Las 20 propiedades, imágenes ilustrativas, usuarios, fechas y montos no representan inventario o transacciones reales. La conversión CLP usa una UF ficticia de $40.000 y se identifica como tal. El monto canónico se registra en centésimas de UF; el incremento de 50 UF es un valor de prueba que debe configurarse según las bases definitivas.

No hay aprobación manual por cada monto ni negociación por contraoferta. Un registro aceptado no equivale a adjudicación jurídica. Las bases, efectos del cierre y proceso de adjudicación requieren configuración y definición final del negocio.

## Desarrollo y verificación

- `npm test`: nueve pruebas del motor y servidor, incluyendo concurrencia, cierre exacto, reintento idempotente, privacidad y dos sesiones SSE.
- `npm run build`: genera index.html a partir de base.html y fuentes. base.html es una fuente intermedia, no el punto de entrada.
- `fuentes/auction-core.js`: reglas compartidas entre servidor y modo individual.
- `fuentes/live.js` y `fuentes/live.css`: interfaz de subasta continua.
- `fuentes/propiedades.json`: inventario ficticio inicial.
- `server.cjs`: servidor HTTP local, sesiones ficticias y persistencia de prueba.

## Alcance pendiente de producción

El documento Word v4.0 es el requerimiento de implementación completo. Este código es un prototipo navegable con un motor local funcional para probar el cambio central; no implementa toda la plataforma de producción. Falta integrar Cloudflare, autenticación y permisos reales en servidor, almacenamiento privado de documentos, notificaciones, operación editorial persistente, auditoría de producción, cotización UF oficial y adjudicación. La propuesta técnica del Word contempla autoridad serial por subasta con Durable Objects, D1 para datos consultables y R2 privado para archivos; no existe todavía conexión desplegada a esos servicios.
