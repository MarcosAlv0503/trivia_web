# game-core: reglas de juego en TypeScript puro

El paquete `@trivia/game-core` (`packages/game-core`) reúne lo que el cliente necesita para conducir y mostrar una partida sin decidir nada por su cuenta: constantes de cada modo, orden de turnos, clasificación, niveles de XP y títulos, estadísticas por categoría y las reglas de las animaciones de final. Es TypeScript puro, sin React, Supabase ni APIs del navegador, para poder reutilizarlo en web, móvil y modo TV ([CLAUDE.md](../../CLAUDE.md), "Lógica de juego desacoplada").

**No es la autoridad.** El servidor sirve las preguntas, cronometra y puntúa en Postgres ([base-de-datos.md](base-de-datos.md), [arquitectura.md](arquitectura.md)). Aquí viven los espejos de algunas de esas constantes y lo que es solo presentación. La sección "Qué vive aquí y qué solo en SQL" dice cuál es cuál.

## Cómo se consume

- **Código fuente sin compilar.** [package.json](../../packages/game-core/package.json) declara `"type": "module"` y `"exports": { ".": "./src/index.ts" }`. No hay paso de build.
- **Web.** `apps/web/package.json` lo declara como `"@trivia/game-core": "workspace:*"` y [next.config.ts](../../apps/web/next.config.ts#L8) lo transpila con `transpilePackages: ["@trivia/game-core"]` (decisión del 2026-10-15 en CLAUDE.md, "Paquetes @trivia/* sin compilar").
- **Una sola puerta de entrada.** Se importa siempre desde la raíz: `import { QUICK, rankPlayers } from "@trivia/game-core"`. [index.ts](../../packages/game-core/src/index.ts) reexporta `duel`, `live`, `outcome`, `quick`, `progress` y `stats`.
- **Pureza comprobada por el compilador.** [tsconfig.json](../../packages/game-core/tsconfig.json) extiende [tsconfig.base.json](../../tsconfig.base.json) (`strict`, `noUncheckedIndexedAccess`, `lib: ["ES2022"]` sin DOM): usar `window` o `document` no compila. ESLint usa `typescript-eslint` en modo estricto ([eslint.config.mjs](../../packages/game-core/eslint.config.mjs)).
- **Scripts del paquete:** `lint`, `typecheck` (`tsc --noEmit`) y `test` (`vitest run --passWithNoTests`). El CI los ejecuta con los `pnpm lint`, `pnpm typecheck` y `pnpm test` recursivos ([infraestructura-y-ci.md](infraestructura-y-ci.md)).

## Qué vive aquí y qué solo en SQL

Antes de tocar una regla hay que saber a cuál de estos tres grupos pertenece.

### 1. Espejos: existen en TS y en SQL

El cliente los usa para mostrar (textos de la portada, límites del formulario, umbrales de los iconos de rapidez). Si cambia la regla hay que cambiar los dos sitios. En SQL no se edita una migración ya subida: se crea una migración nueva con `create or replace` de **todas** las funciones donde aparece el valor. Cada función vive en la migración que la redefinió por última vez; la tabla enlaza esa versión.

| Constante TS | Valor | Dónde está duplicada en SQL (versión vigente) |
| --- | --- | --- |
| `QUICK.maxPlayers` | 6 | `quick_matches.player_count between 1 and 6` ([L12](../../supabase/migrations/20261016143214_quick_matches.sql#L12)) y `quick_match_players.seat between 0 and 5` ([L22](../../supabase/migrations/20261016143214_quick_matches.sql#L22)); tope de 5 invitados en `start_quick_match` ([question_pipeline](../../supabase/migrations/20261018150834_question_pipeline.sql#L226)) |
| `QUICK.questionsPerPlayer` | 7 | `player_total * 7` en `start_quick_match` ([question_pipeline](../../supabase/migrations/20261018150834_question_pipeline.sql#L234)) y `m.player_count * 7` en `get_quick_match` ([xp_and_levels](../../supabase/migrations/20261020233725_xp_and_levels.sql#L142)). El cliente saca las preguntas por jugador de `total / jugadores`, no de esta constante |
| `QUICK.secondsPerQuestion` | 15 | `'timeLimitMs', 15000` en `serve_quick_question` ([daily_challenge](../../supabase/migrations/20261021155309_daily_challenge.sql#L254)) y `time_limit_ms constant integer := 15000` en `answer_quick_question` ([question_stats](../../supabase/migrations/20261021152204_question_stats.sql#L82)). El duelo por turnos repite el 15000 en `serve_duel_question` ([question_pipeline](../../supabase/migrations/20261018150834_question_pipeline.sql#L383)) y `answer_duel_question` ([question_stats](../../supabase/migrations/20261021152204_question_stats.sql#L144)). El temporizador de la web usa el `timeLimitMs` que manda el servidor; esta constante solo rellena el texto de la portada |
| `SCORING` (10 / 5 / 2) | acierto 10, +5 muy rápido, +2 rápido | `answer_points` ([scoring_10_points](../../supabase/migrations/20261016192719_scoring_10_points.sql#L5)): 15 si `elapsed_ms < 3000`, 12 si `elapsed_ms < time_limit_ms / 2`, 10 si no, 0 si falla. Los umbrales de tiempo (3 s y mitad del tiempo) no están en TS: `speedTier` deduce la rapidez de los puntos |
| Fórmula de turnos (`seatOf`, `roundOf`) | `posición % jugadores` | `r.position % m.player_count` en `get_quick_match` ([xp_and_levels](../../supabase/migrations/20261020233725_xp_and_levels.sql#L159)), `serve_quick_question` ([daily_challenge](../../supabase/migrations/20261021155309_daily_challenge.sql#L253)), el trigger de XP ([quick_xp_halved](../../supabase/migrations/20261021124431_quick_xp_halved.sql#L12)) y la vista `question_answers` ([question_stats](../../supabase/migrations/20261021152204_question_stats.sql#L11)) |
| `DUEL.roundOptions` / `defaultRounds` | `[3, 6]` / 6 | `duels.round_count ... default 6 check (round_count in (3, 6))` ([duel_round_count_and_limit](../../supabase/migrations/20261016191744_duel_round_count_and_limit.sql#L5)) y el parámetro `duel_round_count integer default 6` de `start_duel` (L33) |
| `DUEL.questionsPerRound` | 3 | `duel_plays.slot ... check (slot between 1 and 3)` ([friends_and_duels](../../supabase/migrations/20261016165743_friends_and_duels.sql#L293)) |
| `DUEL.turnHours` | 48 | `interval '48 hours'` en el valor por defecto de `duels.turn_deadline` ([friends_and_duels](../../supabase/migrations/20261016165743_friends_and_duels.sql#L272)) y en `answer_duel_question` ([question_stats](../../supabase/migrations/20261021152204_question_stats.sql#L201)). La web no usa la constante |
| `DUEL.maxActivePerPair` | 3 | `start_duel`: `>= 3` con hint `too_many_duels` ([duel_round_count_and_limit](../../supabase/migrations/20261016191744_duel_round_count_and_limit.sql#L54)) |
| `LIVE` (reloj, pausa, invitación, cuenta atrás, puntos) | ver [live.ts](../../packages/game-core/src/live.ts) | `live_clock_end` (60 s y pausa de 1 s como máximo, [live_clock_pause](../../supabase/migrations/20261021144234_live_clock_pause.sql#L13)); 6000 ms en `serve_live_question` y `answer_live_question` ([live_duels](../../supabase/migrations/20261021141452_live_duels.sql#L501)); 30 s de invitación en `settle_live_duels` (L231); 3 s de cuenta atrás en `answer_live_invite` (L376); `live_points`: 13 si `elapsed_ms < 3000`, si no 10 (L240). Detalle en [duelo-relampago.md](duelo-relampago.md) |

Nada comprueba automáticamente que estos espejos coincidan con SQL: Vitest prueba el TS y pgTAP prueba el SQL por separado.

### 2. Solo en SQL: el cliente nunca lo calcula

- El reloj de cada pregunta (`served_at`), el margen de latencia de 2 s, qué cuenta como acierto y los puntos de cada respuesta ([modo-rapido.md](modo-rapido.md)).
- Qué preguntas se sirven, en qué orden y con qué orden de respuestas. La respuesta correcta no sale del servidor hasta que se contesta ([preguntas.md](preguntas.md)).
- La XP de cada partida (triggers `quick_match_grant_xp` y `duel_grant_xp`) y el total `profiles.xp` ([progresion-y-estadisticas.md](progresion-y-estadisticas.md)).
- El % de acierto global de una pregunta y su umbral de 20 respuestas (`question_hit_rate`).
- Plazos, resultado y rendición del duelo por turnos, caducidad de invitaciones y límites de peticiones ([amigos-y-duelo.md](amigos-y-duelo.md), [base-de-datos.md](base-de-datos.md)).

### 3. Solo en TS: no existe en SQL

- La curva de niveles y los títulos ([progress.ts](../../packages/game-core/src/progress.ts)). SQL solo guarda el total de XP; el nivel se deriva. Cambiar `LEVELS` cambia el nivel de todas las cuentas sin migración.
- Qué animación de final toca y los umbrales del empate legendario ([outcome.ts](../../packages/game-core/src/outcome.ts), `LIVE.legendaryDraw`).
- La clasificación con empates (`rankPlayers`), la fase tras revelar (`phaseAfterReveal`), las horas que quedan de un plazo (`hoursLeft`), la ronda en curso del duelo (`duelPendingRound`) y el umbral de "tu fuerte / tu punto débil" (`HIGHLIGHT_MIN_ANSWERED`).
- Detalles de interfaz del relámpago: `LIVE.revealMs` (destello de 0,7 s) y `LIVE.warningMs` (reloj rojo y tic-tac).

### Si cambias una regla

| Cambio | Qué tocar |
| --- | --- |
| Preguntas por jugador, tiempo o máximo de jugadores del modo rápido | Migración nueva que redefina `start_quick_match`, `get_quick_match`, `serve_quick_question` y `answer_quick_question` (y la tabla si cambia un `check`); `QUICK`; tests de ambos lados. Ojo con el reto diario: `get_quick_match` calcula `total` con el 7 fijo y el reto tiene siempre 7 rondas ([reto-diario.md](reto-diario.md)) |
| Puntos por acierto o rapidez | Migración con `answer_points` (la comparten el modo rápido y el duelo por turnos); `SCORING` y `speedTier`; el relámpago tiene su propio `live_points` y `LIVE.correct/fastBonus/fastMs` |
| XP por partida | Solo SQL: triggers `quick_match_grant_xp` y `duel_grant_xp`. La web enseña lo que devuelve el servidor |
| Curva de niveles o títulos | Solo `LEVELS` y `titleLevel` (y los textos e iconos de título). Sube o baja el nivel de todos |
| Umbral de combate legendario | `LEGENDARY_POINTS_PER_QUESTION` o `LIVE.legendaryDraw` |
| Reglas del duelo por turnos | `DUEL` y las migraciones de `duels` / `start_duel` / `answer_duel_question` |

## Archivos

Todos en [packages/game-core/src](../../packages/game-core/src).

### [quick.ts](../../packages/game-core/src/quick.ts)

Modo "Preguntas rápidas" y piezas que comparten otros modos.

- [`QUICK`](../../packages/game-core/src/quick.ts#L5): `{ maxPlayers: 6, questionsPerPlayer: 7, secondsPerQuestion: 15 }` (`as const`). Espejo de la migración `quick_matches`.
- [`SCORING`](../../packages/game-core/src/quick.ts#L12): `{ correct: 10, veryFastBonus: 5, fastBonus: 2 }`. Espejo de `answer_points`.
- [`speedTier(points: number)`](../../packages/game-core/src/quick.ts#L19): nivel de rapidez de un acierto según sus puntos. Devuelve `"veryFast"` (desde 15), `"fast"` (desde 12), `"normal"` (desde 10) o `null` (no fue acierto). Lo usa `AnswerFeedback` para elegir pegatina, animación y sonido.
- [`DIFFICULTIES`](../../packages/game-core/src/quick.ts#L26) y `type Difficulty`: `"easy" | "medium" | "hard"`. Los comparten todos los modos y el panel de revisión.
- [`seatOf(position, playerCount)`](../../packages/game-core/src/quick.ts#L30): asiento que juega la posición global (`position % playerCount`; 0 = anfitrión).
- [`roundOf(position, playerCount)`](../../packages/game-core/src/quick.ts#L35): ronda (desde 1) de esa posición (`floor(position / playerCount) + 1`).
- [`phaseAfterReveal(finished, playerCount)`](../../packages/game-core/src/quick.ts#L40): fase que sigue a revelar una respuesta. `"results"` si la partida terminó; si no, `"handoff"` con más de un jugador (pantalla de pasar el dispositivo) o `"question"` en solitario.
- [`rankPlayers(players)`](../../packages/game-core/src/quick.ts#L46): devuelve una copia ordenada por `score` descendente con `place` en cada jugador. Los empatados comparten puesto y el siguiente salta (1, 2, 2, 4). El orden entre empatados es el de entrada.

### [duel.ts](../../packages/game-core/src/duel.ts)

Duelo por turnos ([amigos-y-duelo.md](amigos-y-duelo.md)).

- [`DUEL`](../../packages/game-core/src/duel.ts#L5): `{ roundOptions: [3, 6], defaultRounds: 6, questionsPerRound: 3, turnHours: 48, maxActivePerPair: 3 }`. `type DuelRounds` = `3 | 6`.
- [`hoursLeft(deadline: Date, now: Date)`](../../packages/game-core/src/duel.ts#L16): horas hasta el plazo del turno, redondeando hacia arriba; 0 si ya pasó.
- [`duelPendingRound(turnNumber, roundsSpun)`](../../packages/game-core/src/duel.ts#L24): ronda que responde quien tiene el turno. En el turno `t` primero responde la ronda `t - 1` (la que giró el rival) y, tras girar, la `t`: devuelve `t` si ya se han girado al menos `t` rondas, si no `t - 1`.

### [live.ts](../../packages/game-core/src/live.ts)

Duelo relámpago ([duelo-relampago.md](duelo-relampago.md)). Solo la constante [`LIVE`](../../packages/game-core/src/live.ts#L5):

| Campo | Valor | Para qué |
| --- | --- | --- |
| `matchMs` | 60 000 | Reloj de la partida por jugador. Lo usan la portada, el reloj y el estado inicial de `live-game.tsx` |
| `questionMs` | 6 000 | Límite por pregunta. Sin uso en la web: el cliente usa el `timeLimitMs` del servidor |
| `revealMs` | 700 | Destello tras responder; pasado este tiempo `live-game.tsx` pide la siguiente pregunta (o espera al rival si se acabó tu reloj) |
| `maxPauseMs` | 1 000 | Pausa máxima del reloj entre responder y recibir la siguiente pregunta. Sin uso en la web |
| `inviteSeconds` | 30 | Caducidad de la invitación; la usa `notification-toasts.tsx` para la cuenta atrás del aviso |
| `countdownMs` | 3 000 | Cuenta atrás antes de empezar. Sin uso en la web: el cliente cuenta desde el `startsInMs` que devuelve el servidor |
| `correct`, `fastBonus`, `fastMs` | 10, 3, 3 000 | Puntos del relámpago (13 si se responde en menos de 3 s). Sin uso en la web |
| `legendaryDraw` | 50 | Puntos de cada uno desde los que un empate es legendario |
| `warningMs` | 10 000 | El reloj se pone rojo y hace tic-tac en los últimos segundos |

### [outcome.ts](../../packages/game-core/src/outcome.ts)

Qué animación de final toca. Reglas completas en "Animaciones de final" más abajo.

- [`OutcomeKind`](../../packages/game-core/src/outcome.ts#L3): `"victory" | "defeat" | "draw" | "legendaryDraw"`.
- [`legendaryThreshold(questionsPerPlayer)`](../../packages/game-core/src/outcome.ts#L9): `questionsPerPlayer * 5` (la constante `LEGENDARY_POINTS_PER_QUESTION` no se exporta).
- [`headToHeadOutcome(result, myScore, legendaryFrom)`](../../packages/game-core/src/outcome.ts#L17): final de un 1 contra 1 visto por un jugador. `result` es el del servidor (`"win" | "loss" | "draw"`): `win` da `victory`, `loss` da `defeat`, y en `draw` manda `myScore >= legendaryFrom` (`legendaryDraw` o `draw`).
- [`localOutcome(players, legendaryFrom)`](../../packages/game-core/src/outcome.ts#L31): final de una partida local en un dispositivo. Con menos de 2 jugadores devuelve `null`. Si hay un único máximo, `{ kind: "victory", winners }`; si hay varios, `{ kind: "legendaryDraw" | "draw", winners }` según `top >= legendaryFrom`. Nunca devuelve `defeat`.

### [progress.ts](../../packages/game-core/src/progress.ts)

XP, niveles y títulos ([progresion-y-estadisticas.md](progresion-y-estadisticas.md)).

- [`LEVELS`](../../packages/game-core/src/progress.ts#L8): `{ firstLevelXp: 50, growth: 1.13, titleEvery: 5, lastTitleLevel: 50 }`.
- [`levelCost(level)`](../../packages/game-core/src/progress.ts#L16): XP para pasar del nivel `level` al siguiente: `round(50 * 1.13 ^ (level - 1))` (50, 56, 64... y 150 en el nivel 10).
- [`xpForLevel(level)`](../../packages/game-core/src/progress.ts#L21): XP total para llegar a ese nivel (el 1 es gratis): nivel 2 = 50, 5 = 242, 10 = 771, 20 = 3 538, 50 = 153 031.
- [`levelProgress(xp)`](../../packages/game-core/src/progress.ts#L28): `{ level, current, needed }` con el nivel, la XP dentro del nivel y lo que pide el nivel para subir. Sin máximo de nivel.
- [`TitleLevel`](../../packages/game-core/src/progress.ts#L36) y [`titleLevel(level)`](../../packages/game-core/src/progress.ts#L39): nivel con el que se ganó el título vigente (1, 5, 10... 50). Es la clave del texto (`Progress.titles.<n>` en `messages/*.json`) y del icono (`components/title-icon.tsx`). Del 50 en adelante se mantiene el 50.

### [stats.ts](../../packages/game-core/src/stats.ts)

- [`HIGHLIGHT_MIN_ANSWERED`](../../packages/game-core/src/stats.ts#L2) = 10 y `type CategoryStat = { id, answered, correct }`.
- [`categoryHighlights(stats)`](../../packages/game-core/src/stats.ts#L10): `{ best?, worst? }` con el id de la categoría de mejor y peor % de acierto ("Tu fuerte" / "Tu punto débil"). Solo entran las que tienen al menos 10 respuestas y hacen falta dos. Compara fracciones exactas (`correct / answered`), no % redondeados; si el extremo empata con otra categoría, ese extremo queda sin marcar.

## Animaciones de final

Aprobadas el 2026-10-21 ([CLAUDE.md](../../CLAUDE.md), "Animaciones de final aprobadas"). Protagoniza el ajolote, con sonido propio. Las reglas de qué mostrar están en [outcome.ts](../../packages/game-core/src/outcome.ts); el dibujo y la animación, en [match-outcome.tsx](../../apps/web/src/features/game/match-outcome.tsx) (componente `MatchOutcome`).

| `OutcomeKind` | Mascota | Cuándo | Texto (`Outcome` en `messages/*.json`) |
| --- | --- | --- | --- |
| `victory` | `party` | El servidor dice `win`; en local, un único primero | "¡Victoria!" y, en local, el nombre del ganador |
| `defeat` | `tired` | El servidor dice `loss` (también por rendición o plazo vencido) | "Derrota" y "¡Lo diste todo!" |
| `draw` | `bored` | Empate con puntos por debajo del umbral | "Empate" y, en local, los nombres de los empatados en cabeza |
| `legendaryDraw` | `knight` | Empate con puntos iguales o por encima del umbral | "¡¡¡Combate legendario!!!" y "Empate entre dos titanes" |

Umbral del empate legendario (puntos de cada uno):

| Modo | Función | Umbral |
| --- | --- | --- |
| Duelo relámpago | `headToHeadOutcome(result, me.score, LIVE.legendaryDraw)` | 50 |
| Duelo por turnos | `headToHeadOutcome(result, me.score, legendaryThreshold(roundCount * DUEL.questionsPerRound))` | 3 rondas: 45; 6 rondas: 90 |
| Rápida local (2 o más) | `localOutcome(players, legendaryThreshold(preguntasPorJugador))` | 7 preguntas: 35 |
| Rápida en solitario | `localOutcome` devuelve `null`: sin animación, suena "win" | n/a |

Cuándo salen y cuándo no:

- Duelo por turnos ([duel-game.tsx](../../apps/web/src/features/duel/duel-game.tsx#L172)): con el duelo terminado y resultado distinto de `cancelled`. Cubre rendición y plazo vencido; no sale si se rechaza o se cancela (amistad eliminada).
- Duelo relámpago ([live-game.tsx](../../apps/web/src/features/live/live-game.tsx#L257)): al mostrar los resultados, con el `result` de la partida.
- Rápida local ([quick-results.tsx](../../apps/web/src/features/game/quick/quick-results.tsx#L25)): solo victoria con el nombre del ganador, o empate con los empatados en cabeza.
- Reto diario: no tiene animación de final; `DailyResults` solo reproduce el sonido "win" la primera vez ([reto-diario.md](reto-diario.md)).
- Duración: pantalla completa de 3,6 s (`SHOW_MS = 3600`), se salta tocando. Una sola vez por partida y dispositivo: `useOutcomeOnce(clave)` guarda `trivia:outcome-seen:<clave>` en `localStorage` (claves `quick:<id>`, `duel:<id>`, `live:<id>`, `daily:<id>`). Sin almacenamiento disponible se muestra siempre.
- Después de la animación aparecen la XP y la subida de nivel (`afterOutcome`).

## Quién lo usa

| Export | Consumidores principales |
| --- | --- |
| `QUICK`, `DIFFICULTIES`, `Difficulty` | [app/page.tsx](../../apps/web/src/app/page.tsx), [features/game/quick/](../../apps/web/src/features/game/quick), [difficulty-picker.tsx](../../apps/web/src/features/game/difficulty-picker.tsx) |
| `speedTier` | [answer-feedback.tsx](../../apps/web/src/features/game/answer-feedback.tsx) |
| `seatOf`, `roundOf`, `phaseAfterReveal` | [quick-game.tsx](../../apps/web/src/features/game/quick/quick-game.tsx) |
| `rankPlayers`, `localOutcome`, `legendaryThreshold` | [quick-results.tsx](../../apps/web/src/features/game/quick/quick-results.tsx) |
| `DUEL`, `hoursLeft`, `duelPendingRound`, `DuelRounds` | [duel-game.tsx](../../apps/web/src/features/duel/duel-game.tsx), [friends-view.tsx](../../apps/web/src/features/friends/friends-view.tsx), [start-duel.ts](../../apps/web/src/features/duel/start-duel.ts) |
| `LIVE`, `headToHeadOutcome` | [live-game.tsx](../../apps/web/src/features/live/live-game.tsx), [notification-toasts.tsx](../../apps/web/src/features/notifications/notification-toasts.tsx), [app/page.tsx](../../apps/web/src/app/page.tsx) |
| `levelProgress`, `titleLevel`, `TitleLevel` | [features/progress/](../../apps/web/src/features/progress) (`level-card`, `level-badge`, `xp-gain`), [title-icon.tsx](../../apps/web/src/components/title-icon.tsx), [app/page.tsx](../../apps/web/src/app/page.tsx) |
| `categoryHighlights` | [category-stats.tsx](../../apps/web/src/features/stats/category-stats.tsx) |
| `OutcomeKind` | [match-outcome.tsx](../../apps/web/src/features/game/match-outcome.tsx), [/dev/ui](../../apps/web/src/app/dev/ui/showcase.tsx) |

## Tests

Vitest, junto al código. `pnpm test` (o `pnpm --filter @trivia/game-core test`). No necesitan base de datos.

- [quick.test.ts](../../packages/game-core/src/quick.test.ts): alternancia de asientos y ronda con 3 jugadores y en solitario; `phaseAfterReveal` (results / handoff / question); `rankPlayers` con empates (1, 2, 2, 4); `speedTier` para 15, 12, 10 y 0.
- [duel.test.ts](../../packages/game-core/src/duel.test.ts): `hoursLeft` (48 h exactas, redondeo hacia arriba, 0 si el plazo pasó) y `duelPendingRound` (primero la ronda del rival, luego la que gira).
- [outcome.test.ts](../../packages/game-core/src/outcome.test.ts): el resultado del servidor manda aunque los puntos digan otra cosa; el empate es legendario justo desde el umbral; `legendaryThreshold` da 35, 45 y 90 para 7, 9 y 18 preguntas; `localOutcome` (solitario nulo, victoria del primero, empates legendario o simple).
- [progress.test.ts](../../packages/game-core/src/progress.test.ts): costes y umbrales de XP (50, 56, 64, 150; 0, 50, 106, 242, 771, 3 538, 153 031), subida justo en el umbral, coherencia de `levelProgress` con `xpForLevel` hasta el nivel 150 y títulos por tramos de 5 hasta el 50.
- [stats.test.ts](../../packages/game-core/src/stats.test.ts): mejor y peor entre las de 10 o más respuestas; con menos de dos válidas no marca nada; los extremos empatados no se marcan (comparación por fracción).

No hay tests de `DUEL`, `LIVE` ni `QUICK` contra la base de datos.

## Detalles a tener en cuenta

- **Constantes espejo sin uso en la web.** `DUEL.turnHours`, `LIVE.questionMs`, `maxPauseMs`, `countdownMs`, `correct`, `fastBonus` y `fastMs` no se importan en ningún sitio. Documentan el SQL, pero pueden quedarse desfasadas sin que nada lo detecte. `xpForLevel` solo se usa en los tests y `levelCost` dentro del propio paquete.
- **`speedTier` deduce la rapidez de los puntos (15/12/10).** El relámpago puntúa 13 o 10: el 13 cae en el nivel `fast` (desde 12) por cómo están los umbrales. Si cambian `SCORING` o `live_points`, `AnswerFeedback` necesita su propio nivel de rapidez (hay un comentario en [live-game.tsx](../../apps/web/src/features/live/live-game.tsx#L480)).
- **El coste de nivel depende de la coma flotante.** `50 * 1.13` da 56,4999..., así que el nivel 2 cuesta 56 y no 57. Los tests fijan los valores; no cambiar la fórmula (ni `Math.round`) sin revisarlos.
- **`DIFFICULTIES` tiene copias** en `scripts/questions.mts` (Node, sin importar el paquete) y en los `check` de SQL.
- **Formas de las RPC.** Los tipos generados de Supabase devuelven `Json`; las formas de lo que devuelven `get_quick_match`, `serve_quick_question`, `get_daily` y compañía viven en cada feature (`features/game/quick/types.ts`, `features/daily/types.ts`...), no aquí.
- **Modo nuevo.** Las reglas puras van en un archivo nuevo de `src/`, exportado desde `index.ts` y con su test; el servidor sigue siendo quien decide. No importar React, Supabase ni APIs del navegador: no compilaría.
