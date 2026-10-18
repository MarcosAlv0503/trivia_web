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
- Preguntas generadas con IA mediante skills de Claude Code de este repo (`/questions-generate`, `/questions-translate`, `/questions-review`), con el plan de suscripción (sin API de pago); la BD admite importación masiva y estado de revisión.
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
- **Fase 3 — Online con amigos (HECHA, probada el 2026-10-17):** amigos (búsqueda, solicitudes, lista); duelo asíncrono contra un amigo; notificaciones in-app de turno.
- **Fase 4 — Lista para la beta cerrada (ACTUAL).** Tareas en orden:
  1. Contenido: preguntas de "actualidad" con caducidad (hecho); procesos automáticos de generación, traducción y revisión periódica (hechos); panel de revisión (solo admin, hecho); botón "reportar pregunta" (hecho). Objetivo ≥1.500 preguntas aprobadas por idioma (pendiente: ejecutar los procesos).
  2. PWA instalable + push web (turno de duelo, plazo a punto de vencer) (hecho; falta probar en un móvil real).
  3. Sesión de estilos y front + sonido y vibración + accesibilidad (icono por categoría además del color, tamaño de texto, teclado).
  4. Moderación de nombres de usuario y límites de peticiones en RPC sensibles (hecho).
  5. Legal/RGPD: privacidad, términos, consentimiento, edad mínima.
  6. Producción: Vercel + Supabase Cloud, copias, monitorización de errores, analítica con consentimiento (retención D1/D7).
  7. Beta cerrada con 20–50 personas.
- **Fase 5 — Hábito y progresión:** XP y niveles con títulos; racha diaria con "regeneración" (recuperarla con un reto extra en 24 h); reto diario compartible (mismas preguntas para todos, resultado en cuadritos de color de categoría); logros; "¿Sabías que…?" y % de acierto global; estadísticas por categoría y modo práctica; modo Aguante (hasta fallar 3); cara a cara con cada amigo.
- **Fase 6 — Competición y comunidad:** ligas semanales (~30 por XP, ascenso/descenso); duelo contra desconocido (emparejamiento asíncrono); reto por enlace; invitar por enlace/código; reacciones predefinidas en duelos (sin chat libre); valorar preguntas; rankings; eventos temáticos.
- **Fase 7 — Economía jugable (sin dinero real):** Monedas con ledger; comodines (en solitario, o en duelo con el mismo cupo para ambos); morfos y accesorios del ajolote; Laguna personal decorable y visitable; tienda de compra directa; recompensa diaria fija o gratuita (nunca con Gemas).
- **Fase 8 — Lanzamiento público y monetización:** app en tiendas (Capacitor o Expo, por decidir) con push nativo; Apple (obligatorio en iOS) y Facebook; Gemas tras la capa de pagos (Stripe / RevenueCat, confirmación por webhook); premium sin anuncios; anuncios con consentimiento, preferiblemente recompensados y opcionales; pase de temporada de compra directa.
- **Fase 9 — Fiesta y tiempo real:** salas en vivo con código (hasta 8); modo TV; tablero clásico con identidad propia; minijuegos (cronología, ¿más o menos?, verdadero/falso relámpago, mapa).
- **Continuo:** más categorías y preguntas; taller de preguntas de usuarios con revisión.
- **No implementar nada de una fase posterior sin que se pida.**

## Estado y pendientes

Actualizar al cerrar cada sesión.

- **Discord:** login desactivado hasta tener credenciales. Para activarlo: credenciales en `supabase/.env` (pasos en el README), `enabled = true` en `supabase/config.toml` y en `apps/web/src/features/auth/providers.ts`.
- **Reglas del modo rápido aprobadas (2026-10-16):** 7 preguntas por jugador × 15 s; acierto 10 puntos, +5 si se responde en menos de 3 s o +2 en menos de la mitad del tiempo (cambiado el 2026-10-16; también en el duelo); categorías mezcladas al azar; dificultad elegible (Fácil/Normal/Difícil); local hasta 6 jugadores alternando por pregunta, con pantalla de pase y mini marcador; revelación 2 s y avance automático; resultados con ranking y revancha.
- **Reglas del duelo aprobadas (2026-10-16):** 3 o 6 rondas (lo elige quien reta; 6 por defecto); máximo 3 duelos activos entre dos jugadores; en cada ronda uno gira la ruleta (categoría al azar, puede repetirse) y ambos responden las mismas 3 preguntas; puntuación del modo rápido; gana quien suma más (a igualdad, empate). Turnos alternos de 48 h (quien no juega a tiempo pierde). Dificultad elegida por quien reta; el duelo empieza al momento y el rival puede rechazarlo antes de responder. Rendirse = derrota; revancha; eliminar amigo cancela los duelos en curso. Sin límite de duelos simultáneos. Amigos: búsqueda por prefijo (≥3 letras, 10 resultados) y solicitudes. Avisos: lista "Tus duelos" en la portada + aviso emergente en vivo.
- **Seed:** 126 preguntas (6 por categoría y dificultad: justo para 6 jugadores). Tras `pnpm db:reset` se recargan solas; tras `pnpm db:start` en una BD nueva, `pnpm db:seed`.
- **Sesión dedicada a estilos y front:** probar más opciones estéticas sobre la base aprobada. Los tokens están en `apps/web/src/app/globals.css` y el muestrario de componentes en `/dev/ui` (solo en desarrollo).
- **Roadmap aprobado (2026-10-17):** beta cerrada antes de la progresión; tablero después del lanzamiento público; comodines solo en solitario o con el mismo cupo en duelo; morfos y Laguna como eje de colección; push web en la Fase 4. Los textos "¿Sabías que…?" se dejan para más adelante.
- **Contenido aprobado (2026-10-18):**
  - Las preguntas de actualidad se mezclan en los modos normales con el distintivo "Actualidad" y caducan a los 90 días.
  - Se aprueban solas tras la revisión automática. Una duda pasa por una segunda revisión independiente y solo si persiste va a revisión humana (`needs_human`).
  - Idiomas: `es` y `en` por ahora.
  - Sin API de pago: los procesos se ejecutan con Claude Code (plan Pro).
- **Fase 4, hecho el 2026-10-18 sin revisión del usuario (textos y decisiones provisionales, pendientes de confirmar):** motivos de reporte (respuesta mal, confusa/varias válidas, errata/traducción, ofensiva); el reporte pausa el avance automático; una pregunta reportada se sigue jugando hasta su revisión; aviso de plazo con menos de 6 h; avisos solo de duelo (turno y plazo), activables en el perfil; lista inicial de términos prohibidos en nombres; límites de peticiones (README > "Moderación y límites").
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
- **2026-10-16 — Modo rápido autoritativo en Postgres.** `start_quick_match` / `get_quick_match` / `serve_quick_question` / `answer_quick_question`: el reloj (`served_at`) y la puntuación se calculan en SQL, con 2 s de margen por latencia; recargar no reinicia el reloj. Las reglas (7 preguntas por jugador, 15 s) viven en la migración `quick_matches`; la fórmula de puntos, compartida con el duelo, solo en la función `answer_points`. Las preguntas se eligen primero entre las que la cuenta nunca ha visto (servidas) y luego por antigüedad (`quick_match_fresh_questions`).
- **2026-10-18 — Procesos de contenido = skills de Claude Code + `scripts/questions.mts`.** Claude solo decide: genera, traduce y revisa. El script lee y escribe la BD con la clave secreta (`export_questions`, `import_questions`, `review_questions`, `mark_untranslatable`; solo `service_role`). Lo generado entra siempre como borrador. Los archivos de trabajo van a `.content/` (ignorada por git): **el repo es público y no puede contener preguntas de producción**. Jugable = `is_playable` (aprobada y sin caducar). Las estadísticas de revisión cuentan las respuestas por su posición original, así que la traducción conserva el orden de `wrong`.
- **2026-10-16 — Importación de preguntas.** RPC `import_questions` (solo `service_role`, upsert por `externalId`) + `scripts/import-questions.mts` sin dependencias (Node 24 ejecuta TS). El seed de desarrollo usa el mismo camino (`pnpm db:seed`).
- **2026-10-16 — Tests de BD con pgTAP** (`supabase/tests`, `pnpm db:test`), en un job aparte del CI que levanta solo Postgres.
- **2026-10-16 — Amigos y duelos solo vía RPC** (`friends_and_duels`), con el mismo patrón que el modo rápido. El plazo de 48 h se aplica de forma perezosa (`expire_duels`) al consultar o jugar, sin cron. Cada jugada guarda el idioma del jugador al girar y se sirve siempre en ese idioma.
- **2026-10-16 — Avisos in-app con tabla `notifications`** (RLS por usuario) publicada en Realtime; el cliente escucha sus inserciones (`NotificationToasts` en el layout) y reemite el evento de ventana `trivia:notification`. Se purgan a las 24 h: el estado real se consulta siempre con `list_duels` / `list_friends`. Descartado `realtime.messages`: depende del servicio Realtime y el CI solo arranca Postgres.
- **2026-10-18 — Reportes y panel de revisión.** `question_reports` (uno por jugador y pregunta) solo vía RPC; los reportes abiertos priorizan la pregunta en `to-review` y cualquier veredicto los cierra (`review_questions`). Admins en `public.admins`, alta solo por SQL; las RPC `admin_*` reutilizan `review_questions` e `import_questions` (mismas validaciones). `/admin` responde 404 a quien no es admin.
- **2026-10-18 — Push web.** Suscripciones en `push_subscriptions` (por dispositivo, máx. 10 por cuenta, se dan de baja al cerrar sesión). Envío: trigger en `notifications` → `pg_net` → Edge Function `push` (`web-push`, VAPID), con URL y secreto en el Vault; sin ellos no se envía nada. El aviso de plazo lo crea `pg_cron` cada 15 min. El texto lo pone el service worker (`/sw.js`, generado desde `messages/*.json`), sin caché offline.
- **2026-10-18 — Límites de peticiones** con `check_rate_limit` (ventana fija por cuenta y acción, hint `rate_limited`): por trigger en las altas y dentro de las RPC de consulta (que pasan a `volatile`). Nombres prohibidos en `blocked_username_terms`, comprobados por trigger en `profiles`.
