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
| `pnpm db:types`                                             | Regenera los tipos TS desde la BD local         |

## Migraciones

Créalas siempre con la CLI: `pnpm exec supabase migration new <nombre>`. Nunca edites una migración ya mergeada. Tras cambiar el esquema, ejecuta `pnpm db:types` y commitea el resultado.
