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
