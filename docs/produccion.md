# Producción: Supabase Cloud + Vercel + Sentry

Guía para montar producción la primera vez y mantenerla. Sigue los pasos en orden: cada uno usa datos del anterior.

Necesitas cuentas en [Supabase](https://supabase.com), [Vercel](https://vercel.com) y [Sentry](https://sentry.io) (las tres con plan gratis; entra con GitHub), Docker Desktop en marcha y el repo al día en `main`.

Valores que irás apuntando (en un gestor de contraseñas, **nunca** en el repo):

| Dato                                                    | Dónde sale                          |
| ------------------------------------------------------- | ----------------------------------- |
| Contraseña de la BD                                     | Paso 1 (la eliges tú)               |
| `<ref>` del proyecto (p. ej. `abcdefghijklmnop`)        | Paso 1, en la URL del panel         |
| Clave publicable (`sb_publishable_…`) y secreta (`sb_secret_…`) | Supabase → Project Settings → API Keys |
| `<dominio>` de la web (p. ej. `trivia-ajolote.vercel.app`) | Paso 5                           |

---

## 1. Crear el proyecto de Supabase

1. [Panel de Supabase](https://supabase.com/dashboard) → **New project**.
2. **Region:** una de la UE (Frankfurt o París: datos en la UE y poca latencia desde España).
3. **Database password:** genera una larga y guárdala.
4. Plan **Free**. Al terminar, el `<ref>` es la parte de la URL del panel `…/project/<ref>`.

## 2. Subir la base de datos

Desde la raíz del repo:

```sh
pnpm exec supabase login                          # abre el navegador para autorizar la CLI
pnpm exec supabase link --project-ref <ref>       # pide la contraseña de la BD
pnpm exec supabase db push                        # lista las migraciones pendientes y pide confirmar
```

`db push` aplica todas las migraciones de `supabase/migrations` (tablas, RLS, RPC, categorías, avatares, `pg_cron`…). **No** carga el seed: las preguntas de `supabase/seed/questions.json` son públicas (están en el repo) y no deben jugarse en producción. A partir de aquí, las migraciones nuevas se aplican solas (paso 7).

Comprueba en el panel → **Advisors → Security Advisor** que no hay avisos rojos.

## 3. Login (Supabase Auth + Google)

En el panel de Supabase → **Authentication**:

1. **Sign In / Providers → Email:** desactívalo (solo login social).
2. **Sign In / Providers → Google:** actívalo. Copia la _Callback URL_ que muestra (`https://<ref>.supabase.co/auth/v1/callback`).
3. En [Google Cloud Console](https://console.cloud.google.com/) → el proyecto `trivia-ajolote` → _Google Auth Platform → Clients_: edita el cliente web (o crea uno solo para producción) y añade:
   - Authorized JavaScript origins: `https://<dominio>`
   - Authorized redirect URIs: la _Callback URL_ del punto 2.
4. Pega _Client ID_ y _Client secret_ en el proveedor Google de Supabase y guarda.
5. **URL Configuration:** _Site URL_ `https://<dominio>` y en _Redirect URLs_ `https://<dominio>/auth/callback`.

Mientras la app de Google esté en modo **Testing**, solo entran los emails de _Audience → Test users_ (hasta 100). Para la beta cerrada puedes añadir ahí a los probadores, o pulsar **Publish app** (con los scopes básicos no hace falta verificación de Google).

Si aún no tienes `<dominio>`, haz primero el paso 5 y vuelve aquí.

## 4. Avisos push

1. `pnpm push:keys` → claves VAPID nuevas para producción (no reutilices las de local).
2. Crea `supabase/functions/.env.production` (no se sube: `.gitignore` ignora `.env.*`) con el mismo formato que `supabase/functions/.env.example`: las dos claves, `VAPID_SUBJECT=mailto:<tu email>` y un `PUSH_WEBHOOK_SECRET` aleatorio largo.
3. Súbelos y despliega la función:

   ```sh
   pnpm exec supabase secrets set --env-file supabase/functions/.env.production
   pnpm exec supabase functions deploy push
   ```

4. Panel → **SQL Editor**, guarda en el Vault la URL de la función y el mismo secreto:

   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/push', 'push_function_url');
   select vault.create_secret('<PUSH_WEBHOOK_SECRET>', 'push_webhook_secret');
   ```

La clave pública VAPID se usa también en Vercel (paso 5).

## 5. Vercel (la web)

1. [Vercel](https://vercel.com/new) → **Add New → Project** → importa el repo de GitHub.
2. **Root Directory:** `apps/web` (Vercel detecta Next.js y pnpm).
3. **Environment Variables** (marca solo _Production_, para que ningún despliegue de prueba use la BD real):

   | Variable                               | Valor                                                   |
   | -------------------------------------- | ------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | `https://<ref>.supabase.co`                             |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la clave publicable (`sb_publishable_…`)                |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`         | la `VAPID_PUBLIC_KEY` del paso 4                        |
   | `ENABLE_EXPERIMENTAL_COREPACK`         | `1` (usa la versión de pnpm del `package.json`)         |
   | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*`   | del paso 6; puedes añadirlas después y volver a desplegar |

   La clave **secreta** de Supabase no va nunca a Vercel.

4. **Deploy.** Al terminar, tu `<dominio>` es `<proyecto>.vercel.app` (o uno propio en _Settings → Domains_).
5. _Settings → Build and Deployment → Node.js Version:_ **24.x**.
6. Vuelve al paso 3 si dejaste el dominio pendiente, y prueba a entrar con Google.

Cada push a `main` despliega la web automáticamente.

## 6. Sentry (errores)

1. En [sentry.io](https://sentry.io), al crear la organización elige **Data Storage Location: European Union**.
2. **Create project → Next.js.** Copia el **DSN** → Vercel: `NEXT_PUBLIC_SENTRY_DSN`.
3. Proyecto → **Settings → Security & Privacy:** activa _Prevent Storing of IP Addresses_ y deja _Data Scrubber_ activado.
4. Para ver los errores con el código legible (source maps): _Settings → Auth Tokens → Organization tokens_ → crea uno → Vercel: `SENTRY_AUTH_TOKEN`, y además `SENTRY_ORG` y `SENTRY_PROJECT` (los nombres cortos de la organización y del proyecto, como salen en la URL).
5. Redespliega en Vercel. Sentry te avisa por email de cada error nuevo.

La web solo envía errores: sin trazas de rendimiento, sin grabación de sesión, sin cookies y sin datos personales. Sin DSN no envía nada (por eso en local no hace falta). Los errores de la BD y de la Edge Function se ven en el panel de Supabase → **Logs**.

## 7. Despliegue automático de la BD

El job `deploy-supabase` del CI aplica las migraciones nuevas y redespliega la función `push` en cada push a `main`, después de pasar lint, tests y build. Para activarlo, en GitHub → repo → **Settings → Secrets and variables → Actions**:

- **Secrets:** `SUPABASE_ACCESS_TOKEN` ([crea uno aquí](https://supabase.com/dashboard/account/tokens)) y `SUPABASE_DB_PASSWORD`.
- **Variables:** `SUPABASE_PROJECT_ID` = `<ref>`.

Sin la variable, el job se salta. Vercel despliega la web en paralelo, así que durante uno o dos minutos la web nueva puede convivir con la BD anterior: haz migraciones que añadan (columnas, funciones nuevas) antes de quitar lo viejo en una migración posterior.

## 8. Después del primer despliegue

1. **Tu cuenta de administrador:** entra en la web, completa el onboarding y en el SQL Editor:

   ```sql
   insert into public.admins (user_id) select id from public.profiles where username = 'tu_usuario';
   ```

2. **Preguntas:** desde ahora el contenido vive en producción (la BD local se queda con el seed). Para que los procesos de preguntas y sus tareas programadas trabajen contra producción, añade en `.claude/settings.local.json` (local, ignorado por git; si ya tiene contenido, añade solo la clave `env`):

   ```json
   {
     "env": {
       "SUPABASE_URL": "https://<ref>.supabase.co",
       "SUPABASE_SECRET_KEY": "sb_secret_…"
     }
   }
   ```

   Con eso, `pnpm questions …` y los skills `/questions-*` usan producción en cualquier sesión de Claude Code en esta carpeta. Para la BD local: `pnpm questions <comando> --local`. La clave secreta salta todas las protecciones: no la compartas ni la pegues en ningún otro sitio.

3. **Textos legales:** responsable y email reales en `apps/web/src/features/legal/legal.ts` (pendiente de la tarea 5).
4. **Móvil:** instala la PWA en un Android y un iPhone reales y comprueba los avisos push (pendiente de la tarea 2).

## Copias de seguridad

El plan Free no da copias descargables. `pnpm db:backup` guarda una copia completa (roles, esquema y datos, incluidas las cuentas) en `.backups/<fecha>/` y borra las de más de 30 días (lo promete la política de privacidad). Necesita Docker en marcha y la cadena de conexión: panel → **Connect** → _Session pooler_ (la directa solo funciona con IPv6), con tu contraseña en lugar de `[YOUR-PASSWORD]`.

```powershell
$env:SUPABASE_DB_URL = 'postgresql://postgres.<ref>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres'
pnpm db:backup
```

Si la contraseña tiene símbolos, escríbelos codificados para URL (`@` → `%40`, `#` → `%23`…). Hazla al menos una vez por semana (puedes programarla con el Programador de tareas de Windows). Las copias llevan datos personales y sesiones: no las subas a ningún sitio ni las compartas.

Para restaurar en un proyecto vacío (con `psql` instalado), en este orden:

```sh
psql "<cadena de conexión>" -f roles.sql -f schema.sql -c "set session_replication_role = replica" -f data.sql
```

Después, vuelve a crear los secretos del Vault (paso 4) y a desplegar la función.

## Retención D1/D7

Se calcula con la actividad de juego que ya guardamos (sin terceros ni cookies). Panel → **SQL Editor**:

```sql
select * from public.retention_stats();      -- últimos 30 días de altas; retention_stats(90) para más
```

Por día de alta (hora de Madrid): `signups`, y cuántos jugaron 1 día después (`d1`, `d1_pct`) y 7 días después (`d7`, `d7_pct`). Vacío mientras ese día aún no ha terminado. "Jugar" es responder alguna pregunta en el modo rápido o en un duelo.

## Límites de los planes gratis

- **Supabase Free:** 500 MB de BD, 50.000 usuarios activos al mes, 5 GB de tráfico. El proyecto **se pausa tras 7 días sin actividad** (se reactiva desde el panel). Antes del lanzamiento público conviene el plan Pro (copias diarias y sin pausas).
- **Vercel Hobby:** solo uso no comercial. Antes de monetizar hay que pasar a Pro.
- **Sentry Developer:** 5.000 errores al mes, un usuario.
