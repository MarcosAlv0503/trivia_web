# Perfil, avatares e invitados

El perfil es lo que las demás personas ven de una cuenta (nombre de usuario, avatar y nivel) y lo que decide el idioma de las preguntas. Tener una fila en `profiles` equivale a haber completado el onboarding. Este documento cubre la tabla `profiles`, el catálogo `avatars`, la moderación de nombres, los invitados locales (`guests`), el borrado de cuenta y la página `/profile`. El código vive en `apps/web/src/features/profile`, `apps/web/src/app/profile` y `apps/web/src/app/onboarding`, y en las migraciones `profiles`, `guests`, `username_moderation_and_rate_limits`, `username_literal_match` y `legal_acceptance`. Cómo llega la persona al onboarding: [auth-y-onboarding.md](auth-y-onboarding.md). Aceptación de términos y datos personales: [legal-y-privacidad.md](legal-y-privacidad.md). Decisiones en [CLAUDE.md](../../CLAUDE.md): "Perfil = onboarding completado", "Patrón de permisos en tablas" y "Catálogo de avatares en BD".

## Reglas

| Concepto | Valor |
| --- | --- |
| Nombre de usuario | De 3 a 20 caracteres: letras sin tildes (`A-Z`, `a-z`), números y `_`. Único sin distinguir mayúsculas. |
| Cambios de nombre | Hasta 5 por ventana fija de 1 día (acción `change_username`). Cambiar otra cosa del perfil no cuenta. |
| Nombres prohibidos | No puede contener ningún término de `blocked_username_terms`, buscado tal cual y sin distinguir mayúsculas ("badminton" se rechaza por "admin"). No se quitan guiones bajos ni se interpretan números como letras. Los perfiles anteriores a un término no se revisan. |
| Avatar | Uno de los 12 del catálogo activo (`avatars`). En el onboarding viene marcado el primero. |
| Idioma | `es` o `en`; por defecto el de la interfaz en ese momento. Decide el idioma de las preguntas, de los avisos push y de los nombres de categoría de las estadísticas. |
| "Mostrar cuando estoy en línea" | `show_online`, activado por defecto. Su efecto está en [amigos-y-duelo.md](amigos-y-duelo.md). |
| Preferencias del dispositivo | Tamaño de texto, sonido y vibración: no son del perfil, viven en el navegador ([sistema-visual.md](sistema-visual.md)). |
| Invitados | Nombre de 1 a 20 caracteres (admite tildes y ñ), único por anfitrión sin distinguir mayúsculas; avatar del catálogo. Hasta 5 por partida; se recuerdan los 10 usados más recientemente. |
| Borrado de cuenta | Inmediato e irreversible, tras una confirmación. Borra en cascada todo lo de la cuenta (inventario en [legal-y-privacidad.md](legal-y-privacidad.md)). |

## Cómo funciona

### Crear y editar el perfil

[`ProfileForm`](../../apps/web/src/features/profile/profile-form.tsx) sirve para los dos casos (`mode="create"` en `/onboarding`, `mode="edit"` en `/profile`). Los campos llevan validación HTML (`required`, longitud y `pattern`), de modo que el navegador avisa antes de enviar. Con `useActionState`, el botón muestra "Guardando…" mientras dura la acción y el error se pinta con `role="alert"` usando la clave `Profile.errors.<código>`.

[`saveProfile`](../../apps/web/src/features/profile/actions.ts#L21-L48) (server action):

1. Recorta el nombre y lo valida con `isValidUsername` (`usernameInvalid`). Comprueba que el idioma sea `es` o `en` y que haya avatar (`generic`).
2. Exige sesión (`getAuthContext`; sin ella, redirige a `/`) y averigua si el perfil ya existe (`getOwnProfile`).
3. Al crear, exige la casilla `acceptTerms` (`termsRequired`) y envía `terms_version: LEGAL.version`. Al editar no toca los términos.
4. `insert` o `update` en `profiles` con el cliente de la propia cuenta: RLS, `grant` por columnas, CHECK y triggers lo vuelven a validar.
5. Traduce el error de la BD y, si va bien, fija la cookie `NEXT_LOCALE` con el idioma elegido y redirige a `/` (también al editar).

| Código (`FormState.error`) | Cuándo |
| --- | --- |
| `usernameInvalid` | El nombre recortado no cumple `USERNAME_PATTERN`. |
| `termsRequired` | Crear el perfil sin marcar la casilla. |
| `usernameTaken` | La BD devuelve `23505` (índice único del nombre; también ocurriría con la clave primaria). |
| `usernameNotAllowed` | Hint `username_not_allowed` del trigger `check_username`. |
| `rateLimited` | Hint `rate_limited`: sexto cambio de nombre en la ventana. |
| `generic` | Idioma o avatar ausentes, y cualquier otro error (avatar retirado, fallo de red...). |

### Sugerencia de nombre en el onboarding

[`suggestUsername()`](../../apps/web/src/features/profile/queries.ts#L40-L53) prueba, por orden, tres candidatos: el alias público del proveedor (`preferred_username` o `user_name` de `claims.user_metadata`; se normaliza quitando tildes y caracteres no permitidos, se recorta a 20 y solo vale con 3 o más) y dos nombres `ajolote` más 4 dígitos al azar ([`username.ts`](../../apps/web/src/features/profile/username.ts)). Cada candidato se comprueba con la RPC `is_username_available`; devuelve el primero libre o una cadena vacía. No se usan nunca el nombre real ni el email (RGPD). Con Google, que normalmente no entrega alias, suele salir `ajolote` más 4 dígitos.

### Elegir avatar

[`AvatarPicker`](../../apps/web/src/features/profile/avatar-picker.tsx) es una rejilla de radios navegable con teclado (4 columnas, 6 desde `sm`; etiqueta accesible "Avatar N"). Recibe los ids activos de `getActiveAvatarIds()` (lectura directa de `avatars` ordenada por `sort_order`). [`Avatar`](../../apps/web/src/features/profile/avatar.tsx) dibuja el SVG a partir del id: 6 paletas, solas o con gafas, lazo o gorra; un id desconocido cae al avatar `axolotl-pink`. Los 12 ids de la web coinciden con los de la migración. El mismo selector se reutiliza para los invitados.

Para añadir un avatar: fila nueva en `avatars` (migración) y entrada en el mapa `AVATARS` de `avatar.tsx`. Para retirar uno: `is_active = false`; deja de poder elegirse, pero los perfiles que lo tienen lo conservan.

### Invitados locales

1. [`/play/quick`](../../apps/web/src/app/play/quick/page.tsx) lee los invitados de la cuenta (`from("guests")`, por `last_used_at` descendente) y los ofrece como "recientes".
2. [`SetupForm`](../../apps/web/src/features/game/quick/setup-form.tsx) permite añadir hasta 5 (`QUICK.maxPlayers - 1`). La "X" de cada fila quita al invitado **de esa partida**, no de los recordados.
3. [`startQuickMatch`](../../apps/web/src/features/game/quick/actions.ts#L17-L55) valida (nombre de 1 a 20 caracteres, sin repetidos sin distinguir mayúsculas) y llama a `remember_guest` por cada invitado; con los ids resultantes llama a `start_quick_match`, que comprueba que son de la cuenta y copia nombre y avatar a `quick_match_players`.

Cómo se usan en la partida: [modo-rapido.md](modo-rapido.md).

### Borrar la cuenta

[`DeleteAccount`](../../apps/web/src/features/profile/delete-account.tsx) pide confirmación en dos pasos (botón "Borrar mi cuenta", aviso y "Sí, borrar definitivamente" o "Cancelar"). La server action [`deleteAccount`](../../apps/web/src/features/profile/actions.ts#L50-L57) llama a la RPC `delete_own_account`, que elimina la fila de `auth.users` y de ahí cae todo lo demás por cascada. Después cierra la sesión local (`signOut({ scope: "local" })`, porque la cuenta ya no existe) y redirige a `/`. Si la RPC falla, muestra el error genérico. No pide volver a iniciar sesión ni espera: es inmediato.

### Página `/profile`

[`app/profile/page.tsx`](../../apps/web/src/app/profile/page.tsx) exige perfil (`requireProfile`) y monta, en este orden:

| Sección | Qué es | Módulo |
| --- | --- | --- |
| Volver y título | `BackLink` a `/` | Este |
| `LevelCard` | Nivel, título y barra de XP (`profiles.xp`) | [progresion-y-estadisticas.md](progresion-y-estadisticas.md) |
| `CategoryStats` | Respondidas y % por categoría (RPC `category_stats`) | [progresion-y-estadisticas.md](progresion-y-estadisticas.md) |
| `ProfileForm` (edición) | Nombre, avatar e idioma | Este |
| `DevicePreferences` | Tamaño de texto, sonido y vibración de este dispositivo | [sistema-visual.md](sistema-visual.md) |
| `PushToggle` | Avisos push de este dispositivo | [avisos-pwa-y-push.md](avisos-pwa-y-push.md) |
| `OnlineToggle` | Interruptor `show_online` (actualiza `profiles` desde el navegador) | [amigos-y-duelo.md](amigos-y-duelo.md) |
| `DeleteAccount` | Borrado de cuenta | Este |
| `LegalLinks` | Términos y privacidad | [legal-y-privacidad.md](legal-y-privacidad.md) |
| Enlace "Panel de revisión de preguntas" | Solo si la RPC `is_admin` devuelve `true` | [contenido-y-admin.md](contenido-y-admin.md) |

El cierre de sesión no está aquí sino en la portada ([auth-y-onboarding.md](auth-y-onboarding.md#cierre-de-sesión)).

## Base de datos

### `profiles`

Una fila por cuenta con el onboarding completado. Definida en [`profiles.sql`](../../supabase/migrations/20261015231640_profiles.sql#L38-L46); `terms_version` y `terms_accepted_at` los añade [`legal_acceptance`](../../supabase/migrations/20261019180736_legal_acceptance.sql#L3-L12), `xp` [`xp_and_levels`](../../supabase/migrations/20261020233725_xp_and_levels.sql#L8) y `show_online` [`live_duels`](../../supabase/migrations/20261021141452_live_duels.sql#L22-L23). Coincide con [`database.types.ts`](../../apps/web/src/lib/supabase/database.types.ts#L544).

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` | Clave primaria y clave foránea a `auth.users(id)` con `on delete cascade`. Es el `sub` del JWT. |
| `username` | `text not null` | CHECK `^[A-Za-z0-9_]{3,20}$`. Índice único `profiles_username_lower_key` sobre `lower(username)`. Trigger `profiles_check_username`. |
| `avatar_id` | `text not null` | Clave foránea a `avatars(id)` (sin cascada). Trigger `profiles_check_avatar_is_active`. |
| `locale` | `text not null` | CHECK: `es` o `en`. |
| `created_at` | `timestamptz not null default now()` | No editable. Define la cohorte de `retention_stats`. |
| `updated_at` | `timestamptz not null default now()` | Lo pone el trigger `profiles_set_updated_at` en cada `update`. |
| `terms_version` | `smallint not null` | CHECK `> 0`. Sin valor por defecto: hay que enviarla al crear. No se puede editar después. |
| `terms_accepted_at` | `timestamptz not null default now()` | La pone la BD: sin permiso de `insert` ni de `update`. |
| `xp` | `integer not null default 0` | CHECK `>= 0`. No editable por el cliente: la suman las funciones de fin de partida ([progresion-y-estadisticas.md](progresion-y-estadisticas.md)). |
| `show_online` | `boolean not null default true` | El cliente puede actualizarla, pero no fijarla al crear (toma el valor por defecto). |

- **Permisos** (patrón en [base-de-datos.md](base-de-datos.md#cómo-está-montada-la-seguridad)): `revoke all` a `anon` y `authenticated`; después `grant select` (toda la tabla), `grant insert (id, username, avatar_id, locale, terms_version)` y `grant update (username, avatar_id, locale, show_online)`. No hay permiso de `delete`: la fila solo desaparece por cascada al borrar la cuenta.
- **RLS**: tres políticas, todas `id = auth.uid()`: lectura, creación y edición de la fila propia. Una cuenta no puede leer el perfil de otra; lo que ven los demás sale de RPC `security definer` (`search_players`, `list_friends`, `list_duels`...).
- **Quién escribe**: la web con el cliente de la cuenta (`saveProfile` crea y edita; `OnlineToggle` cambia `show_online`) y funciones internas (`xp`). Ningún RPC propio crea perfiles.
- **Triggers**: `profiles_set_updated_at` (before update), `profiles_check_avatar_is_active` (before insert o update de `avatar_id`) y `profiles_check_username` (before insert o update de `username`).
- **Realtime y pg_cron**: no aplican.

### `avatars`

Catálogo de avatares como datos (el dibujo vive en la web, por id). [`profiles.sql`](../../supabase/migrations/20261015231640_profiles.sql#L6-L36).

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `text` | Clave primaria. CHECK `^[a-z0-9-]{1,40}$`. Ids estables. |
| `sort_order` | `integer not null default 0` | Orden en el selector. |
| `is_active` | `boolean not null default true` | `false` = retirado: no se puede elegir. |
| `created_at` | `timestamptz not null default now()` | |

Permisos: `grant select` para `authenticated`, con una política que solo deja ver los activos. Las altas son por migración (los 12 del set básico van en la propia migración porque también hacen falta en producción): `axolotl-pink`, `-gold`, `-mint`, `-sky`, `-lilac`, `-coral` y `axolotl-pink-glasses`, `-gold-bow`, `-mint-cap`, `-sky-glasses`, `-lilac-bow`, `-coral-cap`.

### `guests`

Invitados locales: gente sin cuenta (nombre y avatar) que pertenece al anfitrión; solo se guardan para recordarlos. [`guests.sql`](../../supabase/migrations/20261015232505_guests.sql#L4-L15).

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` | Clave primaria, `gen_random_uuid()`. |
| `owner_id` | `uuid not null` | Por defecto `auth.uid()`. Clave foránea a `auth.users` con `on delete cascade`. |
| `name` | `text not null` | CHECK `name = btrim(name)` y entre 1 y 20 caracteres. Admite tildes y ñ. |
| `avatar_id` | `text not null` | Clave foránea a `avatars(id)`. |
| `last_used_at` | `timestamptz not null default now()` | Ordena los "recientes" y decide cuáles se conservan. |
| `created_at` | `timestamptz not null default now()` | |

Índices: único `guests_owner_name_key (owner_id, lower(name))` e `guests_owner_last_used_idx (owner_id, last_used_at desc)`. Permisos: `grant select, delete` para `authenticated` con políticas "de los propios" (`owner_id = auth.uid()`). Sin permisos de `insert` ni de `update`: las altas pasan por `remember_guest`. Hoy ninguna pantalla usa el `delete`.

### `blocked_username_terms`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `term` | `text` | Clave primaria. CHECK `^[a-z]{3,30}$`: solo minúsculas sin tildes. |

Lista inicial en [`username_moderation_and_rate_limits.sql`](../../supabase/migrations/20261018175651_username_moderation_and_rate_limits.sql#L75-L92): suplantación del equipo (admin, soporte, staff, oficial y similares) e insultos, odio y contenido sexual en español e inglés. RLS activada, sin políticas y con `revoke all`: solo la leen las funciones. Para ampliarla: `insert into public.blocked_username_terms (term) values ('...');` (README, "Moderación y límites"). Para localizar perfiles existentes que ahora no pasarían: `select username from public.profiles where not public.is_username_allowed(username);` en Studio (la función no tiene `execute` para los clientes).

### Funciones y triggers

| Función | Argumentos | Devuelve | Quién la llama | Qué hace |
| --- | --- | --- | --- | --- |
| `is_username_available` | `candidate text` | `boolean` | `suggestUsername()` (servidor, con la sesión de la cuenta) | Aplica el límite `username_check` (30 por minuto). Devuelve `true` si `is_username_allowed` y no hay otro perfil con ese nombre sin distinguir mayúsculas (el propio no cuenta). `volatile`, `security definer`, `execute` solo para `authenticated`. Error: hint `rate_limited` (`P0001`). |
| `is_username_allowed` | `candidate text` | `boolean` | Internas: `check_username` e `is_username_available` | `true` si `lower(candidate)` no contiene ningún término de `blocked_username_terms` (`like '%término%'`, comparación literal). Sin `execute` para los clientes. |
| `check_username` | trigger | trigger | `profiles_check_username` | En `update`, si el nombre no cambia, no hace nada; si cambia, aplica `change_username` (5 por día). Después rechaza los nombres no permitidos: `check_violation` con hint `username_not_allowed`. Sin `execute` para los clientes. |
| `check_avatar_is_active` | trigger | trigger | `profiles_check_avatar_is_active` | En `insert`, o al cambiar `avatar_id`, exige un avatar activo: si no, `check_violation` (`avatar % no disponible`, sin hint). |
| `set_updated_at` | trigger | trigger | `profiles_set_updated_at` (y `questions_set_updated_at`) | Pone `updated_at = now()`. |
| `remember_guest` | `guest_name text`, `guest_avatar_id text` | `public.guests` (la fila) | `startQuickMatch` (servidor) | Exige sesión (`insufficient_privilege`: `no autenticado`) y avatar activo (`check_violation`). Inserta el invitado o, si ya existe uno con ese nombre sin distinguir mayúsculas, actualiza nombre, avatar y `last_used_at` (con `clock_timestamp()`). Después borra los que no estén entre los 10 más recientes de esa cuenta. `execute` solo para `authenticated`. |
| `delete_own_account` | ninguno | `void` | `deleteAccount` (servidor) | Exige sesión (`insufficient_privilege`: `no autenticado`) y ejecuta `delete from auth.users where id = auth.uid()`. `execute` solo para `authenticated`. |

Versiones vigentes: `is_username_available`, en [`username_moderation_and_rate_limits.sql`](../../supabase/migrations/20261018175651_username_moderation_and_rate_limits.sql#L135-L149) (la de `profiles.sql` era `stable` y sin límite); `is_username_allowed`, en [`username_literal_match.sql`](../../supabase/migrations/20261019132233_username_literal_match.sql#L4-L15) (la primera versión normalizaba el nombre). `check_username` y `rate_limit_trigger`/`check_rate_limit` ([base-de-datos.md](base-de-datos.md#límites-de-peticiones)) salen de la misma migración de moderación. El resto, en [`profiles.sql`](../../supabase/migrations/20261015231640_profiles.sql#L75-L142) y [`guests.sql`](../../supabase/migrations/20261015232505_guests.sql#L34-L69). La puerta `current_player_id()` está en [auth-y-onboarding.md](auth-y-onboarding.md#base-de-datos).

## Código

- [`features/profile/actions.ts`](../../apps/web/src/features/profile/actions.ts): `saveProfile`, `deleteAccount` y el tipo `FormState`.
- [`features/profile/queries.ts`](../../apps/web/src/features/profile/queries.ts): `getAuthContext`, `getOwnProfile` (campos `username, avatar_id, locale, xp, show_online`), `requireProfile`, `getActiveAvatarIds` y `suggestUsername`.
- [`features/profile/username.ts`](../../apps/web/src/features/profile/username.ts): `USERNAME_PATTERN` (debe coincidir con el CHECK de la BD), `isValidUsername`, `usernameBaseFromMetadata` y `randomUsername`.
- [`features/profile/profile-form.tsx`](../../apps/web/src/features/profile/profile-form.tsx): formulario de creación y edición.
- [`features/profile/avatar-picker.tsx`](../../apps/web/src/features/profile/avatar-picker.tsx) y [`avatar.tsx`](../../apps/web/src/features/profile/avatar.tsx): selector y dibujo de los avatares.
- [`features/profile/delete-account.tsx`](../../apps/web/src/features/profile/delete-account.tsx): borrado de cuenta.
- [`app/profile/page.tsx`](../../apps/web/src/app/profile/page.tsx) y [`app/onboarding/page.tsx`](../../apps/web/src/app/onboarding/page.tsx): las dos pantallas.
- [`features/presence/online-toggle.tsx`](../../apps/web/src/features/presence/online-toggle.tsx): `show_online`.
- [`features/game/quick/actions.ts`](../../apps/web/src/features/game/quick/actions.ts) y [`setup-form.tsx`](../../apps/web/src/features/game/quick/setup-form.tsx): alta de invitados al empezar una partida.
- Textos: `Profile`, `Account` y `Presence` en [`messages/es.json`](../../apps/web/messages/es.json) y [`en.json`](../../apps/web/messages/en.json).

## Tests

- Vitest [`username.test.ts`](../../apps/web/src/features/profile/username.test.ts): `isValidUsername` (acepta `abc`, `Ana_99` y 20 caracteres; rechaza 2 o 21 caracteres, `niño`, espacios, guion medio y vacío), `usernameBaseFromMetadata` (limpia `José.Pérez` a `JosePerez`, recorta a 20, ignora `full_name` y `email`, devuelve `null` si queda demasiado corto) y `randomUsername` (`ajolote0000` a `ajolote9999`, siempre válido).
- pgTAP [`profiles_guests.test.sql`](../../supabase/tests/profiles_guests.test.sql) (13): `anon` no lee perfiles; una cuenta no ve ni edita el perfil de otra ni crea uno con otro id; los 12 avatares activos son visibles; unicidad sin distinguir mayúsculas; no se crea un perfil sin `terms_version` (`23502`); `terms_accepted_at` y `created_at` no son escribibles (`42501`); los invitados no se insertan directamente, cada cuenta ve solo los suyos y se conservan los 10 más recientes.
- pgTAP [`moderation_rate_limits.test.sql`](../../supabase/tests/moderation_rate_limits.test.sql) (13): nombres permitidos y prohibidos (literal, sin distinguir mayúsculas, "badminton" rechazado, números que imitan letras admitidos), alta y cambio de nombre prohibido, `is_username_available` evita los prohibidos, 5 cambios de nombre por día y el sexto se rechaza, cambiar el avatar no cuenta, 30 búsquedas por minuto.
- pgTAP de otros módulos que tocan el perfil: [`xp.test.sql`](../../supabase/tests/xp.test.sql#L92) comprueba que el cliente no puede cambiar su `xp` (`42501`) y [`live_duels.test.sql`](../../supabase/tests/live_duels.test.sql#L73) usa `show_online` para probar la reciprocidad de la presencia.
- Sin test: `delete_own_account` y la cascada, `check_avatar_is_active` (avatar retirado), el permiso de `update` sobre `show_online` y el rechazo de `remember_guest` con avatar retirado.

## Detalles a tener en cuenta

- **El nombre se copia en otros sitios.** `quick_match_players.name` (al empezar la partida) y `notifications.actor_name` (al crear el aviso) guardan una copia: cambiar el nombre de usuario no actualiza partidas ni avisos ya creados. Los listados de amigos, duelos y búsqueda leen el nombre actual de `profiles`.
- **La ventana de 5 cambios no es "por día natural".** Es una ventana fija de 1 día desde el primer cambio de la ventana. Como la excepción deshace la transacción, los intentos rechazados (nombre prohibido, ya cogido) no consumen cupo.
- **La moderación solo actúa al crear el perfil o cambiar el nombre.** La lista es corta y por subcadena literal: puede bloquear algún nombre inocente (el propio código lo marca como atajo). El comentario de la migración de moderación (líneas 70-71) describe la normalización antigua; la comparación vigente es la de `username_literal_match`.
- **Los nombres de invitado no se moderan** (no pasan por `blocked_username_terms`) ni siguen la regla de caracteres de `username`: son locales y solo los ve el anfitrión.
- **Los invitados solo se quitan por reemplazo o al borrar la cuenta.** El `grant delete` existe pero ninguna pantalla lo usa. Quitar a un invitado de una partida no lo olvida, y borrarlo de `guests` no borra su nombre de `quick_match_players` en partidas pasadas.
- **Un invitado con avatar retirado no se puede reutilizar.** `startQuickMatch` llama siempre a `remember_guest` y esta rechaza avatares inactivos, así que la partida falla con el error genérico hasta elegir otro avatar.
- **`23505` es ambiguo.** `saveProfile` lo traduce siempre a "nombre cogido", aunque la causa sea la clave primaria (p. ej. `getOwnProfile` falló y el perfil ya existía).
- **El formulario pierde lo escrito tras un error.** La acción no devuelve los valores enviados y React 19 restablece los campos a sus valores iniciales.
- **No hay comprobación de disponibilidad en vivo.** `is_username_available` solo se usa para sugerir el nombre en el onboarding; en el envío decide el índice único.
- **Avatar retirado en un perfil existente.** El perfil lo conserva y el trigger solo comprueba al insertar o al cambiar `avatar_id`; pero el selector no lo ofrece, así que para guardar el formulario hay que elegir otro.
- **Borrado de cuenta.** No lo prueba ningún test. El navegador conserva su suscripción push (la fila de `push_subscriptions` sí cae en cascada), y las cookies de idioma y tamaño de texto y el `localStorage` siguen en el dispositivo. Otros dispositivos con sesión conservan su JWT hasta 1 h, pero ya no existe el perfil ni se puede crear uno nuevo (la clave foránea a `auth.users` falla). Ver también la cascada sobre los duelos del rival en [legal-y-privacidad.md](legal-y-privacidad.md).
- **Los SVG de avatar repiten el `id` del `clipPath`** (`avatar-circle`) en cada instancia; hoy es inocuo porque todos son idénticos, pero es un `id` duplicado en la página.
- **`xp` y los `grant`.** Al añadir una columna a `profiles` que el cliente no deba tocar, basta con no incluirla en los `grant`; si sí debe poder editarla, hay que añadirla explícitamente (como se hizo con `show_online`).
