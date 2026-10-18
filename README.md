# trivia-ajolote

Juego de trivia web. Monorepo pnpm: `apps/web` (Next.js), `packages/game-core` (reglas de juego en TS puro) y `supabase/` (base de datos, migraciones).

Lee [CLAUDE.md](CLAUDE.md) antes de contribuir (reglas, arquitectura y flujo Git). Especificación completa en [docs/vision.md](docs/vision.md).

## Requisitos

- Node 24 (`.nvmrc`)
- pnpm 12: `npm i -g pnpm` (o `corepack enable` desde una terminal con permisos de administrador)
- Docker Desktop en marcha (para Supabase local)

## Arranque local

```sh
pnpm install
pnpm db:start                         # levanta Supabase en Docker; muestra URL y claves
pnpm db:seed                          # carga las preguntas de ejemplo (es/en)
cp .env.example apps/web/.env.local   # rellena con los valores de `pnpm exec supabase status`
pnpm dev                              # http://localhost:3000
```

Supabase Studio queda en http://127.0.0.1:54323. Para pararlo: `pnpm db:stop`.

Tras reiniciar el equipo: abre Docker Desktop, espera a que arranque y ejecuta `pnpm db:start` antes de `pnpm dev`. Si al iniciar sesión ves `ERR_CONNECTION_REFUSED` en `127.0.0.1:54321`, es que Supabase no está en marcha.

Muestrario de componentes (solo en desarrollo, con sesión iniciada): http://localhost:3000/dev/ui

## Login social en local

Sin credenciales la web arranca, pero los botones de login fallarán. Basta con un juego de credenciales compartido entre los dos (pásalo por un canal privado, nunca por el repo).

1. `cp supabase/.env.example supabase/.env`
2. **Google** — [Google Cloud Console](https://console.cloud.google.com/):
   1. Crea un proyecto (p. ej. `trivia-ajolote`).
   2. _Google Auth Platform → Branding_: nombre de la app y email de soporte. _Audience_: tipo **External**, y añade como _test users_ los emails de los dos desarrolladores (mientras la app esté en modo prueba solo ellos pueden entrar).
   3. _Data access_: deja los scopes por defecto (`openid`, `email`, `profile`).
   4. _Clients → Create client → Web application_:
      - Authorized JavaScript origins: `http://localhost:3000`
      - Authorized redirect URIs: `http://127.0.0.1:54321/auth/v1/callback`
   5. Copia _Client ID_ y _Client secret_ en `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET`.
3. **Discord** — [Developer Portal](https://discord.com/developers/applications):
   1. _New Application_.
   2. _OAuth2 → Redirects_: añade `http://127.0.0.1:54321/auth/v1/callback`.
   3. Copia _Client ID_ y _Client Secret_ (botón _Reset Secret_) en `SUPABASE_AUTH_EXTERNAL_DISCORD_CLIENT_ID` / `_SECRET`.
4. Reinicia Supabase: `pnpm db:stop && pnpm db:start`.
5. Abre la web en **http://localhost:3000** (no `127.0.0.1`: las cookies de sesión dependen del host).

Para producción se añadirá en ambos proveedores la URL de callback de Supabase Cloud (`https://<ref>.supabase.co/auth/v1/callback`).

## Scripts

| Comando                                                     | Qué hace                                        |
| ----------------------------------------------------------- | ----------------------------------------------- |
| `pnpm dev`                                                  | Servidor de desarrollo de la web                |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Lo mismo que ejecuta el CI                      |
| `pnpm format`                                               | Formatea con Prettier                           |
| `pnpm db:reset`                                             | Recrea la BD local aplicando migraciones y seed |
| `pnpm db:seed`                                              | Importa `supabase/seed/questions.json` en local |
| `pnpm db:test`                                              | Tests pgTAP de RLS y RPC (`supabase/tests`)     |
| `pnpm db:types`                                             | Regenera los tipos TS desde la BD local         |

## Migraciones

Créalas siempre con la CLI: `pnpm exec supabase migration new <nombre>`. Nunca edites una migración ya subida a `main`. Tras cambiar el esquema, ejecuta `pnpm db:types` y commitea el resultado.

## Importar preguntas

```sh
node scripts/import-questions.mts preguntas.json --local     # a Supabase local
SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/import-questions.mts preguntas.json   # a otro entorno
```

Formato: un array como el de `supabase/seed/questions.json` (`externalId` único, `category`, `difficulty` `easy|medium|hard`, `status` `draft|approved|rejected`, `source` `ai|manual|user`, opcionalmente `topical` y `expiresAt`, y `translations` con `prompt`, `correct` y `wrong` por idioma). Reimportar un `externalId` lo actualiza: sin `status` conserva el actual, y solo se sustituyen los idiomas incluidos. Se juegan las preguntas `approved` que no han caducado. Las de actualidad caducan a los 90 días si no se indica otra fecha.

## Crear, traducir y revisar preguntas con Claude Code

Guía completa (ejecutar, programar y modificar los procesos): [docs/procesos-de-preguntas.md](docs/procesos-de-preguntas.md).

Tres skills de Claude Code, con el plan de suscripción y sin la API de pago:

```text
/questions-generate [categoría|actualidad] [easy|medium|hard] [cantidad]   # sin argumentos, lo que más falta
/questions-translate [en] [cantidad]
/questions-review [cantidad]
```

- **Generar:** crea preguntas en español y las importa como borrador. Las de actualidad se buscan en la web.
- **Traducir:** traduce las aprobadas que faltan en un idioma, o las marca como no traducibles.
- **Revisar:**
  - aprueba, corrige o rechaza las preguntas;
  - una duda pasa por una segunda revisión independiente, y si persiste queda como `needs_human` para revisarla a mano.

La parte mecánica está en `pnpm questions <comando>` (`status` muestra el recuento y qué falta). Los archivos de trabajo van a `.content/`, ignorada por git porque el repo es público y llevan las respuestas. Por defecto usan Supabase local; con `SUPABASE_URL` y `SUPABASE_SECRET_KEY` en el entorno, otro proyecto.

Para que se ejecuten solos, crea una tarea programada en Claude Code Desktop (Routines → New routine → Local) en esta carpeta, con el skill como instrucción (p. ej. `/questions-generate`). Solo se ejecuta con el ordenador encendido. Antes, pulsa "Run now" una vez y marca "always allow" en los permisos que pida.
