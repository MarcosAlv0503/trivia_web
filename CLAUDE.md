# CLAUDE.md — trivia-ajolote (nombre provisional)

Referencia permanente para las sesiones de ambos desarrolladores. Si algo de aquí choca con el código, avisa.

## Visión

- Trivia web moderna, colorida y adictiva (referencia de experiencia: ruleta de categorías, animaciones, feedback inmediato, partidas cortas). Identidad visual **propia**: nada copiado (assets, nombres, estética). "Trivial Pursuit" y "Preguntados" son marcas registradas y **no pueden aparecer** en el producto.
- Mascota: ajolote de diseño original.
- Cuenta obligatoria con login social (Google, Discord; Apple y Facebook más adelante).
- Modos (local y online): **Preguntas rápidas** (rondas cortas con temporizador), **Duelo por turnos** (asíncrono, días), **Tablero clásico**, minijuegos futuros.
- Local: un dispositivo por turnos; los jugadores añadidos son **invitados** (solo nombre y avatar) que pertenecen a la cuenta del anfitrión. Futuro: modo TV (pantalla común + móviles como mando).
- Online: amigos y, más adelante, emparejamiento aleatorio.
- Multidioma desde el día uno (UI y preguntas): `es` (por defecto) y `en`.
- Categorías iniciales: Geografía, Historia, Ciencia y Naturaleza, Arte y Literatura, Entretenimiento, Deportes, Tecnología. Son **datos en BD**, nunca un enum en código.
- Preguntas generadas con IA fuera de este repo; la BD admite importación masiva y estado de revisión.
- Monetización futura: premium sin anuncios, cosméticos, dos monedas (Monedas jugando / Gemas de pago). **Sin cajas de botín aleatorias de pago** (regulación española): todo compra directa.

## Reglas de trabajo (obligatorias)

1. **Diseño, UX, jugabilidad, economía, textos visibles, flujo de pantallas y estética → pregunta.** No inventes reglas ni decisiones visuales importantes. Agrupa preguntas, sé concreto, ofrece opciones con recomendación.
2. **Backend e infraestructura → decide tú** (lo más lógico, seguro y responsable). Explícalo en 1–2 líneas en el resumen; si es estructural, añádelo a "Decisiones".
3. **Cíñete a la fase actual**, tareas en orden. No adelantes, prepares ni refactorices pensando en fases futuras, salvo que sea **imprescindible** para no bloquearlas (p. ej. modelo de datos caro de cambiar); en ese caso, mínimo y explicado. Al terminar una fase: resumen y esperar confirmación.
4. **Revisión crítica constante** (errores, seguridad, rendimiento, incoherencias con este documento):
   - Errores dentro de la tarea → corregir y mencionar.
   - Errores fuera de la tarea/fase → no tocar; reportar ubicación y gravedad.
   - Mejoras menores dentro de la tarea (claridad, tipado, nombres, simplificaciones sin cambio de comportamiento) → aplicar.
   - Mejoras importantes (funcionalidades, arquitectura, dependencias, UX, otra fase) → proponer con motivo, coste e impacto, y esperar luz verde.

## Stack

| Área           | Elección                                                                         |
| -------------- | -------------------------------------------------------------------------------- |
| Frontend       | Next.js (App Router) + TypeScript strict + Tailwind CSS + Motion                 |
| Backend        | Supabase: Postgres, Auth, Realtime, Storage, Edge Functions                      |
| i18n           | `next-intl`                                                                      |
| Paquetes       | `pnpm` workspaces (monorepo)                                                     |
| Tests          | Vitest (lógica de juego y lógica crítica de servidor)                            |
| CI             | GitHub Actions: lint, typecheck, test, build en cada PR                          |
| Hosting        | Vercel + Supabase Cloud                                                          |
| Pagos (futuro) | Stripe tras una capa agnóstica del proveedor (para IAP móvil, p. ej. RevenueCat) |
| Móvil (futuro) | Capacitor o Expo reutilizando lógica compartida (por decidir)                    |

Supabase local con la CLI (`supabase start`, requiere Docker). Migraciones versionadas en `supabase/migrations`; tipos TS generados desde la BD.

## Principios de arquitectura

- **Servidor autoritativo:** el cliente nunca recibe la respuesta correcta antes de contestar; las preguntas se sirven sin marca de correcta. Respuestas, puntuaciones, resultados, monedas y gemas se validan/calculan en servidor (RPC de Postgres o Edge Functions). El cliente solo muestra.
- **Seguridad Supabase:** RLS en **todas** las tablas con políticas mínimas. La `service_role` key nunca en el cliente. Ningún secreto en el repo (`.env.example`).
- **Lógica de juego desacoplada:** reglas de cada modo en `packages/game-core`, TS puro (sin React ni Supabase) y con tests. Se reutiliza en web, móvil y modo TV; local y online comparten reglas, cambia solo el transporte.
- **Preparado para móvil:** mobile-first; nada de lógica de negocio atada a APIs exclusivas del navegador ni a Server Components cuando debe estar en el backend; la web debe poder funcionar como PWA.
- **Economía (futuro):** saldos con ledger de transacciones; solo el servidor modifica saldos; compras reales confirmadas solo vía webhook del proveedor.
- **i18n:** ningún texto visible hardcodeado. Preguntas y respuestas con traducciones en BD; si una pregunta no existe en el idioma del jugador, no se muestra.
- **Preguntas:** categoría, dificultad, estado (`draft` | `approved` | `rejected`), origen (`ai` | `manual` | `user`) y traducciones. Script de importación masiva JSON.
- **Privacidad (RGPD):** mínimos datos personales; borrado de cuenta (también lo exige Apple).

## Flujo Git

- **Por ahora trabaja un solo dev en un solo ordenador:** commits directos a `main` (decidido el 2026-10-16). Cuando se incorpore el segundo dev se vuelve a rama por tarea + PR revisada.
- `main` debe seguir pasando lint, typecheck, test y build en cada commit.
- Commits pequeños y frecuentes con Conventional Commits.
- Código organizado por feature (`auth`, `profile`, `questions`, `game/quick`, `game/duel`...).
- Migraciones: siempre con la CLI (timestamp), **nunca** editar una ya mergeada, y avisar en el resumen cuando una tarea incluya migraciones.

## Hoja de ruta

- **Fase 0 — Cimientos (HECHA, mergeada):** monorepo pnpm (`apps/web`, `packages/game-core`, `supabase/`); Next.js + TS strict + Tailwind + Motion + `next-intl` (es/en); Supabase local y cliente `@supabase/ssr`; ESLint, Prettier, Vitest, CI; `.env.example` y `README.md` de arranque; este `CLAUDE.md`.
- **Fase 1 — Cuentas y base visual (HECHA, en `main`):** login Google y Discord (Apple/Facebook preparados); perfil (username único, avatar de set básico, idioma); invitados locales; sistema visual base con ajolote placeholder (**preguntar antes de fijar estética**).
- **Fase 2 — Preguntas y "Preguntas rápidas" (HECHA, en `main`):** modelo de categorías/preguntas/traducciones; RPC segura para servir y validar; seed es/en; script de importación JSON; modo rápido en solitario y local por turnos (temporizador, puntuación, resultados); reglas en `game-core` con tests.
- **Fase 3 — Online con amigos (ACTUAL):** amigos (búsqueda, solicitudes, lista); duelo asíncrono contra un amigo; notificaciones in-app de turno (**preguntar reglas exactas antes**).
- **Futuro (no implementar sin que se pida):** emparejamiento y online en tiempo real, tablero clásico, economía/tienda/cosméticos, Stripe, anuncios con consentimiento, rachas/niveles/logros/rankings, panel admin y pipeline IA, más categorías y modos flexibles, minijuegos, modo TV, app móvil y push.

## Estado y pendientes

Actualizar al cerrar cada sesión.

- **Discord:** login desactivado hasta tener credenciales. Para activarlo: credenciales en `supabase/.env` (pasos en el README), `enabled = true` en `supabase/config.toml` y en `apps/web/src/features/auth/providers.ts`.
- **Reglas del modo rápido aprobadas (2026-10-16):** 7 preguntas por jugador × 15 s; acierto 100 + hasta 50 por rapidez; categorías mezcladas al azar; dificultad elegible (Fácil/Normal/Difícil); local hasta 6 jugadores alternando por pregunta, con pantalla de pase y mini marcador; revelación 2 s y avance automático; resultados con ranking y revancha.
- **Seed:** 126 preguntas (6 por categoría y dificultad: justo para 6 jugadores). Tras `pnpm db:reset` se recargan solas; tras `pnpm db:start` en una BD nueva, `pnpm db:seed`.
- **Sesión dedicada a estilos y front:** probar más opciones estéticas sobre la base aprobada. Los tokens están en `apps/web/src/app/globals.css` y el muestrario de componentes en `/dev/ui` (solo en desarrollo).
- **Colores de categoría aprobados** (ya en la tabla `categories`): Geografía `#2ECC8F`, Historia `#D9964A`, Ciencia y Naturaleza `#2EC4E6`, Arte y Literatura `#9B7BFF`, Entretenimiento `#FF7A45`, Deportes `#F5C431`, Tecnología `#5C7CFA`.

## Decisiones

<!-- Decisiones estructurales de backend/infra: fecha, decisión y motivo en 1–2 líneas. -->

- **2026-10-15 — Idioma sin prefijo en la URL.** Locale por cookie `NEXT_LOCALE` > `Accept-Language` > `es` (`apps/web/src/i18n/request.ts`). Más simple con login obligatorio y para empaquetar como app.
- **2026-10-15 — Paquetes `@trivia/*` sin compilar.** `game-core` exporta su código fuente TS y Next lo transpila (`transpilePackages`). Scope neutro, independiente del nombre final.
- **2026-10-15 — Supabase CLI como devDependency** (`pnpm exec supabase ...`), sin instalación global. Claves nuevas de Supabase: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en cliente; la secret key solo en servidor.
- **2026-10-15 — Sesión refrescada en `src/proxy.ts`** (convención de Next 16, antes `middleware`), aplicando las cabeceras anti-caché que devuelve `@supabase/ssr`.
- **2026-10-15 — Versiones:** Node 24, TypeScript 6.0 (typescript-eslint aún no soporta TS 7) y ESLint 9 (los plugins de `eslint-config-next` aún no soportan ESLint 10). Se mantiene la edad mínima de publicación por defecto de pnpm (protección de cadena de suministro) y `allowBuilds` explícito en `pnpm-workspace.yaml`.
- **2026-10-15 — Finales de línea LF** forzados (`.gitattributes` + Prettier) para evitar diffs fantasma entre Windows y otros sistemas.
- **2026-10-16 — Auth solo social.** Registro por email desactivado en Supabase. Proveedores en `supabase/config.toml` (secretos en `supabase/.env`) y en `apps/web/src/features/auth/providers.ts`; Apple y Facebook ya configurados pero desactivados. Flujo OAuth con PKCE: server action → Supabase → `/auth/callback`.
- **2026-10-16 — Denegación por defecto en `src/proxy.ts`.** Sin sesión solo son accesibles `/` y `/auth/*`; cualquier ruta nueva queda protegida automáticamente.
- **2026-10-16 — Perfil = onboarding completado.** La fila de `profiles` se crea en `/onboarding`; sin ella, las páginas redirigen allí. El idioma del perfil se copia a la cookie `NEXT_LOCALE` al iniciar sesión y al guardar, para no consultar la BD en cada petición.
- **2026-10-16 — Patrón de permisos en tablas.** `revoke all` a `anon`/`authenticated` + `grant` solo de las columnas editables + RLS por `auth.uid()`. Las funciones `security definer` llevan `set search_path = ''` y `execute` solo para `authenticated`.
- **2026-10-16 — Catálogo de avatares en BD** (`public.avatars`, ids estables); el dibujo vive en `features/profile/avatar.tsx` indexado por id. El borrado de cuenta es la RPC `delete_own_account` (cascada desde `auth.users`), sin usar la secret key.
- **2026-10-16 — Sistema visual en tokens.** Colores, fuentes y estilo "pegatina" solo en `globals.css` (`@theme` de Tailwind v4); Fredoka (titulares) y Nunito (texto) vía `next/font`, servidas desde nuestro dominio. Componentes compartidos en `apps/web/src/components/` (presentacionales: no deciden nada del juego). Los colores de categoría vienen con los datos, no de los tokens.
- **2026-10-16 — Preguntas solo vía RPC.** Las tablas de categorías, preguntas y partidas no tienen permisos para el cliente; todo pasa por funciones `security definer`. En `question_translations.answers` la **primera** respuesta es la correcta; cada ronda guarda un `answer_order` barajado y el cliente solo ve el orden mostrado.
- **2026-10-16 — Modo rápido autoritativo en Postgres.** `start_quick_match` / `get_quick_match` / `serve_quick_question` / `answer_quick_question`: el reloj (`served_at`) y la puntuación se calculan en SQL, con 2 s de margen por latencia; recargar no reinicia el reloj. Las reglas (7 preguntas por jugador, 15 s, 100 + hasta 50 de bonus) viven en la migración `quick_matches`. Las preguntas se eligen primero entre las que la cuenta nunca ha visto (servidas) y luego por antigüedad (`quick_match_fresh_questions`).
- **2026-10-16 — Importación de preguntas.** RPC `import_questions` (solo `service_role`, upsert por `externalId`) + `scripts/import-questions.mts` sin dependencias (Node 24 ejecuta TS). El seed de desarrollo usa el mismo camino (`pnpm db:seed`).
- **2026-10-16 — Tests de BD con pgTAP** (`supabase/tests`, `pnpm db:test`), en un job aparte del CI que levanta solo Postgres.
