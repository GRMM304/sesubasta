# Plan de medición · Google Analytics 4

Sitio: remates.sesubasta.cl (Remates Dinámicos). Implementación: `fuentes/app/nucleo.js` (objeto `Analytics`).

## 1. Cómo activarlo

1. En Google Analytics 4, crea (o usa) la propiedad de SeSubasta y un **flujo de datos web** para `https://remates.sesubasta.cl`.
2. Copia el **ID de medición** (formato `G-XXXXXXXXXX`).
3. Entra a `/admin-login` como Administrador general → **Configuración** → **Google Analytics 4**, pega el ID, escribe el motivo y guarda.
4. Para verificar, activa "Modo depuración", abre el sitio con `?ga_debug=1`, acepta las cookies de analítica y revisa **Administrar → DebugView** en GA4. En la consola del navegador también aparece cada evento con el prefijo `[GA4]`.
5. Cuando lo hayas verificado, desactiva el modo depuración.

No hay que tocar código. El ID queda guardado en la configuración del servidor y se entrega al navegador mediante `/api/v1/config`.

## 2. Consentimiento (Consent Mode v2, modo básico)

- Al cargar la página, todo queda denegado por defecto: `analytics_storage`, `ad_storage`, `ad_user_data` y `ad_personalization` en `denied`.
- La etiqueta `gtag.js` **no se descarga** hasta que la persona acepta la analítica en el aviso de cookies. Antes de eso no se envía nada a Google.
- "Solo necesarias" deja todo denegado. "Configurar" permite activar por separado la analítica y el marketing.
- La elección se guarda en el navegador (`ss-consent`, versión `2026-10`). Cambiar la versión vuelve a pedir el consentimiento.
- Google Signals y la personalización de anuncios solo se activan si la persona acepta marketing.
- El área interna (`/gestion`, `/admin-login`) y las herramientas locales (`/dev`, `/prototipo`) no se miden.

## 3. Datos que nunca se envían

Montos de subasta, correos, teléfonos, nombres, RUT, direcciones, tokens y contraseñas. El filtro `Analytics.clean()` descarta:

- los parámetros cuyo nombre contenga `mail`, `phone`, `tel`, `name`, `nombre`, `amount`, `monto`, `address`, `direcc`, `rut`, `token` o `password`;
- los valores que parezcan un correo (contienen `@`) o un número largo (8 dígitos o más).

Las URL se limpian de los parámetros `token`, `email`, `correo` y `volver` antes de enviarse.

## 4. Eventos

| Evento | Cuándo se dispara | Parámetros |
|---|---|---|
| `page_view` | Cada cambio de ruta en el sitio público (se envía manualmente porque es una aplicación de una sola página) | `page_location`, `page_path`, `page_title`, `language` |
| `view_home` | Al cargar el inicio | — |
| `search_submitted` | Al buscar desde el buscador del inicio o del catálogo | `search_term` (comuna, región, tipo o ID) |
| `filters_applied` | Al pulsar "Ver resultados" en los filtros | `filters` (lista de filtros usados) |
| `property_viewed` | Al abrir una ficha | `property_id` (ID público), `property_type`, `commune`, `auction_status` |
| `property_saved` | Al guardar una propiedad | `property_id` |
| `share` | Al compartir una ficha o un artículo | `method` (`native` o `copy`), `content_type` |
| `document_downloaded` | Al abrir un documento público | `document_type`, `property_id` |
| `currency_changed` | Al cambiar entre UF y CLP | `currency` |
| `registration_started` | Al abrir el formulario de registro | — |
| `sign_up` / `registration_completed` | Al crear la cuenta | `method: email` |
| `login` | Al iniciar sesión como comprador | `method: email` |
| `offer_started` | Al pasar al paso de revisión del monto | `property_id`, `property_type` |
| `offer_submitted` | Cuando el servidor acepta o rechaza el monto | `property_id`, `result` (`accepted` o `rejected`), `reason` (código de rechazo) |
| `seller_form_started` | Al completar el primer paso de "Ingresa tu inmueble" | `property_type` |
| `seller_form_submitted` | Al enviar la solicitud de venta | `property_type`, `region` |
| `generate_lead` | Al enviar una consulta de propiedad o el formulario de contacto | `lead_type` (`remate` o `contact`) |
| `blog_article_viewed` | Al abrir un artículo | `article_slug`, `category` |

## 5. Configuración recomendada en GA4

- **Eventos clave (conversiones):** `sign_up`, `offer_submitted` (filtrar por `result = accepted` en informes), `seller_form_submitted` y `generate_lead`.
- **Dimensiones personalizadas (alcance de evento):** `property_id`, `property_type`, `commune`, `auction_status`, `result`, `reason`, `lead_type`, `article_slug`, `category`, `currency`, `filters`.
- **Retención de datos:** 14 meses, según la política de privacidad que apruebe Legal.
- **Filtro de tráfico interno:** define las IP de la oficina como tráfico interno.
- **Exploración sugerida:** embudo `view_home` → `property_viewed` → `offer_started` → `offer_submitted (accepted)`.

## 6. Google Tag Manager (opcional)

Todos los eventos pasan por `window.dataLayer` mediante `gtag()`. Si más adelante se prefiere Google Tag Manager, se puede cargar el contenedor bajo el mismo consentimiento y escuchar estos eventos sin cambiar el sitio.

## 7. Pendientes antes de producción

- Que Legal apruebe el texto definitivo del aviso y de la política de cookies.
- Cargar el ID de medición definitivo de la propiedad de producción.
- Agregar el dominio productivo en el flujo de datos de GA4 y revisar la lista de referencias no deseadas.
