# Legal y privacidad

Todo lo que el producto debe cumplir y decir sobre datos personales: las páginas de términos y privacidad, la aceptación al crear la cuenta, qué datos guarda cada tabla y cuándo se borran, las cookies, los errores que salen a Sentry, la retención D1/D7 y las copias de seguridad. Código en `apps/web/src/features/legal`, `apps/web/src/app/legal`, `instrumentation*.ts` y `scripts/backup-db.mts`; datos en `profiles` (aceptación), la función `retention_stats` y el esquema de cascadas de todas las migraciones. Los textos no son asesoramiento legal: CLAUDE.md pide que alguien con formación legal los revise antes del lanzamiento público. Decisiones aprobadas el 2026-10-19 y 2026-10-20 en [CLAUDE.md](../../CLAUDE.md) ("Legal aprobado", "Textos legales", "Retención y copias"). Borrado de cuenta (flujo): [perfil.md](perfil.md). Producción y copias: [produccion.md](../produccion.md).

## Reglas

| Concepto | Valor |
| --- | --- |
| Edad mínima | 14 años, o la que exija la ley del país si es mayor (`LEGAL.minAge`). Una única casilla obligatoria en el onboarding (edad, términos y privacidad). No se pide fecha de nacimiento. |
| Versión de los textos | `LEGAL.version = 1`, con fecha `LEGAL.updated = "2026-10-21"`. |
| Responsable y contacto | `LEGAL.controller` y `LEGAL.email` llevan marcadores (`[NOMBRE DEL RESPONSABLE]`, `[EMAIL DE CONTACTO]`). Pendiente antes de la beta. |
| Derechos | Cambiar nombre, avatar e idioma y borrar la cuenta, en el perfil. Acceso, rectificación, limitación, oposición y portabilidad por email, con respuesta en un mes como máximo. |
| Cookies | Solo técnicas (sesión, idioma, tamaño de texto) y preferencias en `localStorage`: sin banner de consentimiento. Llegará con la analítica. |
| Conservación | Mientras exista la cuenta. Al borrarla desaparece todo al momento; las copias de seguridad, como mucho a los 30 días. |
| Avisos dentro de la app | Se purgan a las 24 h (de forma perezosa, ver "Purgas automáticas"). |
| Terceros | Supabase (BD y acceso), Vercel (web), Sentry (errores, región UE) y los servicios push de los navegadores. Google y Discord tratan los datos de acceso por su cuenta. Sin publicidad ni analítica. |

## Cómo funciona

### Páginas legales

- `/legal/terms` y `/legal/privacy` ([`app/legal/terms/page.tsx`](../../apps/web/src/app/legal/terms/page.tsx), [`privacy/page.tsx`](../../apps/web/src/app/legal/privacy/page.tsx)) son públicas: el proxy deja pasar `/legal/*` sin sesión para poder leerlas antes de aceptar ([auth-y-onboarding.md](auth-y-onboarding.md)). Cada una llama a `LegalPage` con su `kind` y saca el título de la pestaña de `legalMetadata`.
- [`LegalPage`](../../apps/web/src/features/legal/legal-page.tsx#L21-L51) es un Server Component: elige el idioma con `getLocale()` (cookie o `Accept-Language`, no el del perfil), pinta título, botón de volver a `/`, "Última actualización" (`LEGAL.updated`, a las 12:00 UTC) y las secciones.
- El contenido de cada idioma está en [`content/es.ts`](../../apps/web/src/features/legal/content/es.ts) y [`content/en.ts`](../../apps/web/src/features/legal/content/en.ts), que exportan `privacy` y `terms` de tipo `LegalDocument`: `{ title, sections: [{ heading, body }] }`, donde cada elemento de `body` es un párrafo (string) o una lista (array de strings). Interpolan `controller`, `email` y `minAge` de `LEGAL`.
- **Por qué no están en `messages/*.json`:** el proveedor de next-intl del layout envía los mensajes del idioma a todas las páginas, y estos textos son largos. Al ser módulos TS, solo los carga la página legal.
- Enlaces: `LegalLinks` en la portada sin sesión y en `/profile`; y los de la casilla del onboarding (pestaña nueva).

Secciones actuales (los dos idiomas tienen las mismas):

| Documento | Secciones |
| --- | --- |
| Privacidad | Quién es el responsable; Qué datos tratamos; Para qué y con qué base legal; Quién más puede verlos; Cuánto tiempo los guardamos; Tus derechos; Edad mínima; Cookies y almacenamiento en tu dispositivo; Cambios en esta política. |
| Términos | Qué es Trivia Ajolote; Tu cuenta; Normas de juego limpio; Las preguntas; Propiedad intelectual; Responsabilidad; Fin del servicio; Cambios y ley aplicable. |

### Aceptación al crear la cuenta

1. En el onboarding ([auth-y-onboarding.md](auth-y-onboarding.md#onboarding)), [`ProfileForm`](../../apps/web/src/features/profile/profile-form.tsx#L67-L91) muestra la casilla `acceptTerms` (`required`) con el mensaje `Legal.accept`: "Tengo {age} años o más y acepto los Términos de uso y la Política de privacidad", con `age = LEGAL.minAge` y los dos enlaces en pestaña nueva. Solo existe al crear.
2. [`saveProfile`](../../apps/web/src/features/profile/actions.ts#L34) rechaza el envío sin la casilla (`termsRequired`) y, si la hay, inserta el perfil con `terms_version = LEGAL.version`.
3. La BD pone `terms_accepted_at = now()`: no se concede su escritura, así que no se puede falsear ni editar desde el cliente. Juntas son la prueba de qué versión se aceptó y cuándo.
4. Editar el perfil después no toca ninguna de las dos columnas.

### Cambiar los textos

1. Editar `content/es.ts` y `content/en.ts` a la vez (el tipo solo obliga a exportar lo mismo; que tengan las mismas secciones depende de quien edita).
2. Si el cambio es relevante: subir `LEGAL.version` y `LEGAL.updated` en [`legal.ts`](../../apps/web/src/features/legal/legal.ts). Las cuentas nuevas guardarán la versión nueva.
3. Las cuentas existentes conservan su `terms_version`: volver a pedir la aceptación todavía no está hecho (haría falta una pantalla y una RPC o un `grant` nuevos, porque la columna no es editable desde el cliente).
4. Antes de la beta: sustituir `controller` y `email` (CLAUDE.md, "Estado y pendientes"). Hoy los marcadores salen tal cual en las dos páginas.
5. Si se añade una tabla con datos personales o un tercero, actualizar el inventario de este documento y la sección "Qué datos tratamos" del texto.

### Derechos de acceso y portabilidad

No hay exportación automática. Se atienden por email y a mano: localizar la cuenta (`profiles.username`, o el email en `auth.users`) y consultar en Studio las tablas del inventario filtrando por su `id`. Rectificar nombre, avatar e idioma y borrar la cuenta se hace en el perfil.

## Base de datos

### Aceptación de términos

Son dos columnas de `profiles` ([`legal_acceptance.sql`](../../supabase/migrations/20261019180736_legal_acceptance.sql#L3-L12); el resto de la tabla está en [perfil.md](perfil.md#profiles)):

| Columna | Tipo | Notas |
| --- | --- | --- |
| `terms_version` | `smallint not null` | CHECK `> 0`. Sin valor por defecto (al migrar se quitó): crear un perfil exige enviarla. `grant insert`, sin `update`. Los perfiles de desarrollo previos quedaron con 1. |
| `terms_accepted_at` | `timestamptz not null default now()` | Sin `grant` de `insert` ni `update`. |

### Retención D1/D7: `retention_stats`

Mide cuántas cuentas vuelven a jugar, sin terceros ni cookies, con la actividad de juego que ya se guarda. "Activo" un día = haber respondido alguna pregunta en la partida rápida (incluye el reto diario, que es una partida rápida), el duelo por turnos o el duelo relámpago. Los días son en hora de Madrid.

| Función | Argumentos | Devuelve | Quién la llama | Qué hace |
| --- | --- | --- | --- | --- |
| `retention_stats` | `days integer default 30` | tabla `(signup_day date, signups bigint, d1 bigint, d1_pct numeric, d7 bigint, d7_pct numeric)` | Nadie en el código; el equipo la ejecuta en Studio (SQL Editor) | Por día de alta de los últimos `days` días: cuántas cuentas se dieron de alta y cuántas respondieron algo exactamente 1 y 7 días después. `d1` y `d7` son `null` mientras ese día no ha terminado; los porcentajes van redondeados a 1 decimal. Mira la actividad de los últimos `days + 8` días. `language sql`, `stable`, sin `security definer`; `execute` solo para `service_role`. `anon` y `authenticated` reciben `42501`. |

Versión vigente en [`live_duels.sql`](../../supabase/migrations/20261021141452_live_duels.sql#L601-L661) (añade `live_duel_answers` a la actividad); la primera, en [`retention_stats.sql`](../../supabase/migrations/20261019234434_retention_stats.sql#L6-L65). Uso en [produccion.md](../produccion.md#retención-d1d7). La salida es agregada: no identifica a nadie.

### Inventario de datos personales

Qué guarda cada tabla sobre una persona y qué pasa al borrar la cuenta. Todas las claves a `auth.users` son `on delete cascade`, salvo las que se indican. Los permisos de cada tabla están en su módulo y en [base-de-datos.md](base-de-datos.md#cómo-está-montada-la-seguridad).

| Tabla (definición) | Dato personal | Cuándo se borra |
| --- | --- | --- |
| `auth.users` y el resto del esquema `auth` (Supabase) | Email, identificador del proveedor y los metadatos que devuelva (nombre, alias, foto), sesiones y refresh tokens. | `delete_own_account` borra la fila de `auth.users`; Supabase gestiona ese esquema (no está en nuestras migraciones) y sus propias cascadas. Comprobar en una prueba real que la cuenta desaparece de Authentication, Users. |
| `profiles` ([`profiles.sql`](../../supabase/migrations/20261015231640_profiles.sql#L38)) | Nombre de usuario, avatar, idioma, XP, `show_online`, versión y fecha de aceptación, fechas de alta y edición. | Cascada por `id`. |
| `guests` ([`guests.sql`](../../supabase/migrations/20261015232505_guests.sql#L4)) | Nombre y avatar de invitados (datos de terceras personas). | Cascada por `owner_id`. Se conservan solo los 10 más recientes. |
| `quick_matches`, `quick_match_players`, `quick_match_rounds` ([`quick_matches.sql`](../../supabase/migrations/20261016143214_quick_matches.sql#L7-L42)) | Partidas del anfitrión: idioma, dificultad, fechas, `daily_day`; en `quick_match_players`, copia del nombre de usuario del anfitrión y del nombre de cada invitado, con su avatar; en `quick_match_rounds`, respuesta elegida, acierto, puntos y tiempos. | Cascada por `owner_id` y de ahí a jugadores y rondas. Borrar un invitado de `guests` o cambiar de nombre no toca estas copias. |
| `friendships` ([`friends_and_duels.sql`](../../supabase/migrations/20261016165743_friends_and_duels.sql#L75)) | Quién pidió amistad a quién, estado y fechas. | Cascada por cualquiera de los dos extremos: desaparece también de la lista del otro. |
| `duels`, `duel_rounds`, `duel_plays` ([L262-L309](../../supabase/migrations/20261016165743_friends_and_duels.sql#L262)) | Participantes, dificultad, estado, ganador, rondas y, por jugador, respuestas, puntos, tiempos e idioma. | Cascada si la cuenta es retadora o rival (`challenger_id`, `opponent_id`, `player_id`): **el duelo entero desaparece también para el otro jugador**, activo o terminado. `winner_id` es `on delete set null`, pero no llega a aplicarse (la misma fila ya se borra por las otras claves). |
| `live_duels`, `live_duel_questions`, `live_duel_answers` ([`live_duels.sql`](../../supabase/migrations/20261021141452_live_duels.sql#L100-L152)) | Igual que los duelos por turnos, para el relámpago. | Igual: cascada, y el duelo desaparece para el rival. |
| `xp_events` ([`xp_and_levels.sql`](../../supabase/migrations/20261020233725_xp_and_levels.sql#L11-L24)) | XP ganada por partida y total acumulado. | Cascada por `player_id`. Las del rival se conservan con `duel_id` a `null` cuando el duelo desaparece. |
| `notifications` ([L28](../../supabase/migrations/20261016165743_friends_and_duels.sql#L28-L40)) | `user_id`, tipo, `duel_id`, fecha y `actor_name`: el nombre de usuario **de la otra persona**, copiado. | Cascada por `user_id`. Los avisos de otros que llevan tu nombre en `actor_name` no se borran con tu cuenta: los purga `notify()` a las 24 h, pero solo al crear otro aviso para ese jugador. |
| `push_subscriptions` ([`push_notifications.sql`](../../supabase/migrations/20261018174952_push_notifications.sql#L19-L26)) | `endpoint` del navegador, claves `p256dh` y `auth`. Identifica un dispositivo. | Cascada por `user_id`; al cerrar sesión se borra la de ese dispositivo; la función `push` borra las que el navegador anula (404 o 410); como mucho 10 por cuenta. |
| `presence` ([`live_duels.sql`](../../supabase/migrations/20261021141452_live_duels.sql#L12-L17)) | Última vez visto y si está en una partida. Una fila por cuenta, que se sobrescribe. | Cascada. |
| `question_reports` ([`question_reports_and_admin.sql`](../../supabase/migrations/20261018173937_question_reports_and_admin.sql#L6-L16)) | Pregunta, `reporter_id`, idioma, motivo y fechas. | Cascada por `reporter_id`. El panel (`admin_review_queue`, agrupado con su número) y la exportación (`export_questions`) solo ven motivo e idioma, no quién reportó. |
| `rate_limits` ([`username_moderation_and_rate_limits.sql`](../../supabase/migrations/20261018175651_username_moderation_and_rate_limits.sql#L7-L13)) | Contadores por cuenta y acción. Una fila por cuenta y acción, que se sobrescribe. | Cascada. |
| `admins` ([L184](../../supabase/migrations/20261018173937_question_reports_and_admin.sql#L184-L188)) | Si la cuenta es administradora. | Cascada. |

Sin datos de personas: `avatars`, `categories`, `category_translations`, `questions`, `question_translations`, `blocked_username_terms` y `daily_challenges`. La vista `question_answers` solo recombina las respuestas anteriores y nadie del cliente la puede leer.

Fuera de la BD, en el dispositivo y en terceros: ver "Cookies y almacenamiento", "Terceros, errores y registros" y "Copias de seguridad".

### Qué ven las demás personas

| Dato | Quién lo ve | Por dónde |
| --- | --- | --- |
| Nombre de usuario, avatar y nivel (`xp`) | Cualquiera que te busque por prefijo (3 o más letras, 10 resultados, 30 búsquedas por minuto), tus amigos y tus rivales | `search_players`, `list_friends`, `list_duels`, `get_duel`, `get_live_duel` |
| "En línea" o "Jugando" | Solo tus amigos, y solo si ambos tenéis `show_online` activado | `list_friends` (`presence_of`) |
| Resultado del reto diario | Tus amigos, cuando ambos habéis terminado el reto de ese día | `get_daily` |
| Tu nombre en un aviso | Quien lo recibe (y, en el push, el servicio push del navegador) | `notifications.actor_name` |

El perfil en sí (`profiles`) solo lo lee su dueño; lo anterior sale de RPC `security definer`. Detalle en [amigos-y-duelo.md](amigos-y-duelo.md).

### Borrado en cascada

`delete_own_account` borra la fila de `auth.users` y las claves foráneas hacen el resto: `profiles`, `guests`, partidas rápidas, amistades, duelos (de los dos tipos), XP, avisos, suscripciones push, presencia, reportes, contadores y la marca de administrador. Efectos sobre otras personas:

- Sus listas de amigos pierden la amistad.
- Sus duelos con la cuenta borrada desaparecen, también los terminados. Como las estadísticas por categoría y el % de acierto global de cada pregunta se calculan al vuelo con las respuestas guardadas, esas respuestas dejan de contar. Su XP no cambia (`profiles.xp` es un total guardado y sus `xp_events` se conservan).
- Los avisos que ya tenían con tu nombre siguen hasta su purga.

### Purgas automáticas

| Qué | Cómo | Cuándo |
| --- | --- | --- |
| `notifications` | `notify()` borra los avisos de ese jugador de más de 1 día antes de insertar uno nuevo ([L60-L70](../../supabase/migrations/20261016165743_friends_and_duels.sql#L60-L70)). No hay tarea programada. | Solo cuando le llega otro aviso. |
| `push_subscriptions` | `save_push_subscription` deja las 10 más recientes por cuenta; `delete_push_subscription` al cerrar sesión o desactivar; la función `push` borra las anuladas (404 o 410). | Al guardar, al darse de baja o al enviar. |
| `guests` | `remember_guest` conserva los 10 usados más recientemente. | Al empezar una partida local con invitados. |
| `.backups/` | `pnpm db:backup` borra las copias de más de 30 días. | Solo cuando se ejecuta el script. |

La única tarea de `pg_cron` es `warn-duel-deadlines` (crea avisos de plazo; no purga nada). Las partidas, duelos, respuestas y reportes no caducan: duran lo que la cuenta.

## Cookies y almacenamiento del navegador

| Nombre | Lo crea | Para qué | Duración y atributos |
| --- | --- | --- | --- |
| `sb-<proyecto>-auth-token` (puede dividirse en trozos) | `@supabase/ssr` (proxy, server actions y callback) | Sesión iniciada | 400 días, `SameSite=Lax`, sin `HttpOnly` (valores por defecto de la librería) |
| `sb-<proyecto>-auth-token-code-verifier` | `@supabase/ssr` | Verificador PKCE durante el login | Se borra al terminar el intercambio del código |
| `NEXT_LOCALE` | Web ([`i18n/config.ts`](../../apps/web/src/i18n/config.ts)) | Idioma de la interfaz | 1 año, `path=/`, `SameSite=Lax` |
| `TEXT_SIZE` | Navegador ([`preferences.ts`](../../apps/web/src/features/preferences/preferences.ts)) | Tamaño de texto | 1 año, `path=/`, `SameSite=Lax` |
| `localStorage` `pref:sound` y `pref:vibration` | Navegador | Sonido y vibración | Hasta que se borre el almacenamiento |
| `localStorage` `trivia:outcome-seen:<clave>` | [`useOutcomeOnce`](../../apps/web/src/features/game/match-outcome.tsx#L245-L277) | No repetir la animación de final de una partida | Hasta que se borre el almacenamiento |

Aparte: el service worker `/sw.js` (sin caché) y, solo si la persona activa los avisos, la suscripción push del navegador. Las fuentes se descargan al compilar y se sirven desde nuestro dominio: no hay peticiones a Google Fonts. Ninguna es publicitaria ni de analítica, por eso no hay banner.

## Terceros, errores y registros

- **Sentry (errores).** [`instrumentation.ts`](../../apps/web/src/instrumentation.ts) (servidor: `Sentry.init({ dsn })` y `onRequestError`), [`instrumentation-client.ts`](../../apps/web/src/instrumentation-client.ts) (navegador: `Sentry.init({ dsn })`) y [`global-error.tsx`](../../apps/web/src/app/global-error.tsx) (errores de renderizado) envían solo errores. Solo se pasa el `dsn`: no hay `tracesSampleRate` (sin trazas), ni Session Replay, y `sendDefaultPii` queda en su valor por defecto (`false`). Sin `NEXT_PUBLIC_SENTRY_DSN` no se envía nada (local).
- **Túnel.** [`next.config.ts`](../../apps/web/next.config.ts) usa `tunnelRoute: "/lagoon"`: los errores salen por nuestro dominio y el navegador no habla con Sentry; el proxy excluye esa ruta para recibir también los errores de quien no ha iniciado sesión. `telemetry: false`; los source maps se suben solo con `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` y `SENTRY_PROJECT`.
- **Ajustes que no están en el repo.** Región UE, "Prevent Storing of IP Addresses" y "Data Scrubber" se fijan en el panel de Sentry ([produccion.md](../produccion.md), sección 6).
- **Supabase y Vercel** guardan sus propios registros técnicos (pueden incluir la IP). Los errores de la BD y de la Edge Function se ven en Supabase, Logs: no pasan por Sentry.
- **Servicios push** (Google, Apple o Mozilla, según el navegador): reciben el `endpoint` y un mensaje cifrado con tipo de aviso, nombre del rival, id del duelo e idioma, con caducidad de 24 h ([`supabase/functions/push/index.ts`](../../supabase/functions/push/index.ts)).
- **Google y Discord** entregan al iniciar sesión identificador, email y lo que tengan de nombre, alias y foto. Nuestro código solo lee el alias (`preferred_username` o `user_name`) para sugerir el nombre de usuario; el email y el nombre real no se leen en ningún sitio.

## Copias de seguridad

[`scripts/backup-db.mts`](../../scripts/backup-db.mts) (`pnpm db:backup`, o `pnpm db:backup --local` para la BD local):

- Necesita Docker en marcha y, para producción, `SUPABASE_DB_URL` en el entorno (cadena del _Session pooler_; sin ella y sin `--local` falla).
- Guarda `roles.sql`, `schema.sql` y `data.sql` en `.backups/<fecha>/` con `supabase db dump`. Llevan datos personales, cuentas y sesiones: `.backups/` está en `.gitignore` y no se sube ni comparte.
- Cada ejecución borra las carpetas de `.backups/` con más de 30 días (`KEEP_DAYS = 30`, por fecha de modificación), salvo la recién creada. Es lo que promete la política ("las copias de seguridad se borran como máximo a los 30 días").
- Es manual (se recomienda al menos una vez por semana) y el plan Free no da copias descargables. Al pasar a Pro, las copias automáticas de Supabase tendrán su propia retención: habrá que comprobar que encaja con la promesa de 30 días.
- Restauración y avisos en [produccion.md](../produccion.md#copias-de-seguridad).

## Código

- [`features/legal/legal.ts`](../../apps/web/src/features/legal/legal.ts): `LEGAL` (versión, fecha, edad mínima, responsable, email) y el tipo `LegalDocument`.
- [`features/legal/legal-page.tsx`](../../apps/web/src/features/legal/legal-page.tsx): `LegalPage` y `legalMetadata`.
- [`features/legal/content/es.ts`](../../apps/web/src/features/legal/content/es.ts) y [`en.ts`](../../apps/web/src/features/legal/content/en.ts): los textos.
- [`features/legal/legal-links.tsx`](../../apps/web/src/features/legal/legal-links.tsx): enlaces a las dos páginas.
- [`app/legal/terms/page.tsx`](../../apps/web/src/app/legal/terms/page.tsx) y [`app/legal/privacy/page.tsx`](../../apps/web/src/app/legal/privacy/page.tsx): las rutas.
- [`features/profile/profile-form.tsx`](../../apps/web/src/features/profile/profile-form.tsx) y [`actions.ts`](../../apps/web/src/features/profile/actions.ts): casilla de aceptación y `terms_version`.
- [`proxy.ts`](../../apps/web/src/proxy.ts): `/legal/*` público.
- [`instrumentation.ts`](../../apps/web/src/instrumentation.ts), [`instrumentation-client.ts`](../../apps/web/src/instrumentation-client.ts), [`app/global-error.tsx`](../../apps/web/src/app/global-error.tsx) y [`next.config.ts`](../../apps/web/next.config.ts): Sentry.
- [`features/preferences/preferences.ts`](../../apps/web/src/features/preferences/preferences.ts): cookie `TEXT_SIZE` y `localStorage` de sonido y vibración.
- [`scripts/backup-db.mts`](../../scripts/backup-db.mts): copia de seguridad.
- Textos: `Legal` en [`messages/es.json`](../../apps/web/messages/es.json) y [`en.json`](../../apps/web/messages/en.json).

## Tests

- pgTAP [`profiles_guests.test.sql`](../../supabase/tests/profiles_guests.test.sql): no se crea un perfil sin `terms_version` (`23502`) y `terms_accepted_at` no se puede enviar (`42501`).
- pgTAP [`retention_stats.test.sql`](../../supabase/tests/retention_stats.test.sql) (5): D1 por partida rápida y D7 por duelo de una cohorte, D1 vacío mientras el día no ha terminado, filtro por `days`, y que ni `authenticated` ni `anon` pueden ejecutarla. No cubre las respuestas del duelo relámpago.
- Sin test: las páginas legales, que `es.ts` y `en.ts` tengan las mismas secciones, el rechazo sin casilla en `saveProfile`, el borrado en cascada, la purga de avisos a las 24 h y `backup-db.mts`.

## Detalles a tener en cuenta

Lo que los textos afirman frente a lo que hace el código:

| Afirmación del texto | Dónde se cumple | Estado |
| --- | --- | --- |
| "Solo usamos el alias para sugerirte un nombre de usuario" | `usernameBaseFromMetadata`; nada lee el email ni el nombre real | Se cumple |
| "Al borrarla se eliminan al momento tu perfil y todos tus datos de juego" | `delete_own_account` y las cascadas | Se cumple |
| "En los duelos ya terminados de otros jugadores, tu lugar queda vacío" | Las claves de `duels` y `live_duels` borran el duelo entero | **No coincide**: el duelo desaparece también para el rival |
| "Los avisos dentro de la app se borran a las 24 horas" | `notify()` | Parcial: la purga solo ocurre al llegar otro aviso a ese jugador |
| "Las copias de seguridad se borran como máximo a los 30 días" | `backup-db.mts` | Solo se evalúa al ejecutar el script |
| "Solo lo ven tus amigos" (conexión) y se puede ocultar | `presence_of`, `list_friends`, `show_online` | Se cumple |
| "Otros jugadores ven tu nombre de usuario, avatar y nivel" | `search_players`, `list_friends`, `get_duel`... | Se cumple |
| "Almacenamiento local: recuerda si has desactivado los sonidos o la vibración" | `preferences.ts` | Incompleto: falta `trivia:outcome-seen:*` |
| "Si el cambio es importante... te pediremos que la aceptes de nuevo" | Sin implementar | Pendiente |
| "Sentry, en servidores de la UE" | Ajuste de la organización en Sentry | No verificable desde el repo |
| "Si sabemos que alguien más joven tiene una cuenta, la borraremos" y "te responderemos en un mes" | Procesos manuales | Manual |

Otras cosas a tener en cuenta:

- **Nada impide publicar con los marcadores.** No hay comprobación en el CI ni en el build de que `LEGAL.controller` y `LEGAL.email` estén rellenos.
- **La casilla es un control de la web, no de la BD.** La BD solo exige una `terms_version` mayor que 0: quien llame a la API de Supabase directamente puede crear su perfil sin pasar por la casilla ni enviar la versión vigente. Vale como prueba de aceptación en el flujo normal, no como control de edad (que además es una declaración).
- **Borrar la cuenta de una persona cambia datos de otras** (duelos y estadísticas del rival). Es el comportamiento actual y el comentario de `xp_events` ya lo prevé; si se quisiera otra cosa (cerrar los duelos activos con aviso, anonimizar al borrado...), es una decisión de producto que además obligaría a cambiar el texto de privacidad.
- **Los nombres de otras personas viven en copias** (`notifications.actor_name`, `quick_match_players.name`): cualquier cambio futuro de borrado o anonimización tiene que contarlas.
- **Cualquier tabla nueva con una cuenta debe llevar `references auth.users (id) on delete cascade`** y entrar en el inventario: con una clave sin cascada, `delete_own_account` fallaría; sin clave, dejaría datos huérfanos.
- **El esquema `auth` es de Supabase.** Qué conserva tras borrar un usuario (registros de auditoría, por ejemplo) no se puede ver desde las migraciones: conviene comprobarlo antes de la beta.
- **Retención en la documentación de producción.** [produccion.md](../produccion.md#retención-d1d7) dice que "jugar" es responder en el modo rápido o en un duelo y no menciona el relámpago, que `retention_stats` ya cuenta.
