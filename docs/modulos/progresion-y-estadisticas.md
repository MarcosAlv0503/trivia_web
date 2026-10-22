# Progresión y estadísticas

Lo que el jugador acumula jugando: XP que se suma al terminar cada partida, nivel y título derivados de ese total, y estadísticas por categoría calculadas con las respuestas ya guardadas. La XP y las estadísticas se calculan en Postgres (migraciones [`xp_and_levels`](../../supabase/migrations/20261020233725_xp_and_levels.sql), [`quick_xp_halved`](../../supabase/migrations/20261021124431_quick_xp_halved.sql) y [`question_stats`](../../supabase/migrations/20261021152204_question_stats.sql)); el nivel, el título y la marca de "tu fuerte" y "tu punto débil" son TypeScript puro en [`packages/game-core`](../../packages/game-core/src/index.ts); la interfaz está en `apps/web/src/features/progress/` y `features/stats/`. Decisiones aprobadas: [CLAUDE.md](../../CLAUDE.md) ("XP y niveles aprobados" y "Estadísticas aprobadas"). Dependen de [preguntas.md](preguntas.md) (vista `question_answers`) y de las partidas de [modo-rapido.md](modo-rapido.md), [reto-diario.md](reto-diario.md) y [amigos-y-duelo.md](amigos-y-duelo.md).

## Reglas

**XP por partida.** Se suma **una sola vez, al terminar**; una partida a medias no da nada.

| Origen | Cuándo | XP |
| --- | --- | --- |
| Partida rápida (solitario o local) y reto diario | `quick_matches.finished_at` pasa de nulo a fecha | `10 + puntos del anfitrión / 2` (división entera). En local solo cuentan las rondas del asiento 0 (el anfitrión); los invitados no tienen cuenta. El reto diario es una rápida de un jugador, así que da lo mismo |
| Duelo por turnos | `duels.status` pasa de `active` a `finished` (a cada jugador) | Sus puntos de todas las preguntas respondidas + 20 si `end_reason = 'completed'` + 30 si es el ganador o + 10 si empata (`winner_id` nulo y `completed`) |
| Duelo relámpago | no da XP | |
| Modo práctica | no existe (aplazado) | |

Un final de duelo, motivo por motivo (los puntos de las preguntas respondidas se suman siempre):

| `end_reason` | +20 | Ganador (+30) |
| --- | --- | --- |
| `completed` | sí | Quien suma más; en empate, +10 para cada uno |
| `timeout` | no | Quien no incumplió el plazo (`winner_id`) |
| `surrender` | no | Quien no se rinde |
| `declined` | no | Nadie |
| `unfriended` | no | Nadie |

Ejemplo: una rápida en solitario con 15 + 12 puntos (resto fallos) da `10 + 27 / 2` = 10 + 13 = 23 (división entera). El máximo de una rápida en solitario es 62 (7 aciertos de 15 puntos: `10 + 105 / 2`). Los puntos por respuesta (10, 12 o 15 por acierto) están en [modo-rapido.md](modo-rapido.md).

**Nivel.** Pasar del nivel 1 al 2 cuesta 50 XP y cada nivel siguiente un 13 % más (redondeado): `levelCost(n) = round(50 * 1,13^(n-1))`. No hay nivel máximo. El nivel se **deriva** del total: no se guarda.

**Títulos.** Uno nuevo cada 5 niveles hasta el 50, que se mantiene después. Cada título tiene su icono SVG propio en [`title-icon.tsx`](../../apps/web/src/components/title-icon.tsx#L208). Los textos están en `messages/*.json` > `Progress.titles` (clave = nivel con el que se gana).

| Nivel | XP total para llegar | es | en | Icono |
| --- | --- | --- | --- | --- |
| 1 | 0 | Huevito | Little egg | Huevo gelatinoso con el embrión |
| 5 | 242 | Larva curiosa | Curious larva | Larva de perfil con un ojo enorme |
| 10 | 771 | Branquias inquietas | Restless gills | Cabeza de ajolote con branquias rosas |
| 15 | 1.745 | Promesa de la laguna | Lagoon prospect | Nenúfar con un brote |
| 20 | 3.538 | Cerebrito | Bright spark | Cerebro rosa con un destello |
| 25 | 6.842 | Sabelotodo | Know-it-all | Birrete con borla |
| 30 | 12.930 | Enciclopedia andante | Walking encyclopedia | Libro abierto con marcapáginas |
| 35 | 24.146 | Mente brillante | Brilliant mind | Bombilla encendida |
| 40 | 44.810 | Leyenda de la laguna | Lagoon legend | Corona sobre una onda de agua |
| 45 | 82.883 | Eminencia | Eminence | Medalla con lazo |
| 50 | 153.031 | Oráculo de la laguna | Lagoon oracle | Bola de cristal con un ajolote |

Costes de ejemplo: niveles 1 a 5 cuestan 50, 56, 64, 72 y 82 XP; el 10, 150; el 20, 510; el 50, 19.944.

**Estadísticas por categoría** (solo las del propio jugador):

- Por cada categoría activa: respondidas, aciertos y % (aciertos redondeados sobre respondidas); "Sin jugar" si no hay respuestas. Arriba, "Respondidas: N" y, si hay alguna, "Aciertos: X %".
- Cuentan todos los modos (también el relámpago y el reto diario), también lo jugado antes de existir la función, y el **tiempo agotado cuenta como fallo**. En la rápida local solo cuentan las respuestas del anfitrión.
- **"Tu fuerte" / "Tu punto débil":** la categoría de mejor y de peor % entre las que tienen **al menos 10 respuestas** (`HIGHLIGHT_MIN_ANSWERED`). Hacen falta dos categorías válidas, y si el mejor o el peor empata con otra (se compara la fracción, no el % redondeado), ese extremo no se marca.

**% de acierto de cada pregunta:** "Acierta el X % de los jugadores" tras responder en la rápida y en el duelo por turnos (no en el relámpago), con al menos 20 respuestas en total. Está en [preguntas.md](preguntas.md).

## Cómo funciona

### Ganar XP

1. El jugador contesta la última pregunta (`answer_quick_question` pone `quick_matches.finished_at`) o el duelo termina por cualquiera de sus finales (`answer_duel_question`, `surrender_duel`, `decline_duel`, `expire_duels`, `remove_friend` ponen `duels.status = 'finished'`).
2. Un trigger `after update` llama a `quick_match_grant_xp()` o `duel_grant_xp()` en la misma transacción. Así cubre todos los finales sin tocar cada RPC.
3. Ambos llaman a `grant_xp(player, amount, quick_match, duel)`:
   1. si `amount <= 0`, no hace nada;
   2. inserta una fila en `xp_events` con `on conflict do nothing` (los `unique` evitan sumar dos veces la misma partida sin abortar la jugada que la termina);
   3. suma `amount` a `profiles.xp` y guarda en `xp_events.total` el total resultante.
4. La pantalla de resultados pide el estado de la partida: `get_quick_match` (`xp`), `get_duel` (`xpGain`) o `get_daily` (`match.xp`), que usan `xp_gain()` y devuelven `{ gained, total }` o `null` si aún no hay fila.
5. [`XpGain`](../../apps/web/src/features/progress/xp-gain.tsx#L18) calcula `levelProgress(total - gained)` y `levelProgress(total)` y anima: "+N XP" a los 0,4 s, la barra a los 0,6 s y, si sube de nivel, la pegatina "¡Nivel X!" a los 1,3 s con el sonido `levelUp` (más el "Nuevo título" 0,4 s después si cambia de título). Si sube, la barra del nivel nuevo se llena desde cero. Respeta `prefers-reduced-motion`.

Dónde aparece:

| Pieza | Dónde |
| --- | --- |
| `XpGain` | Resultados de la rápida ([`quick-results.tsx`](../../apps/web/src/features/game/quick/quick-results.tsx#L91): al momento en solitario; con rival, tras la animación de final), del duelo por turnos ([`duel-game.tsx`](../../apps/web/src/features/duel/duel-game.tsx#L378), igual) y del reto diario ([`daily-results.tsx`](../../apps/web/src/features/daily/daily-results.tsx#L55)) |
| `LevelCard` | Perfil, arriba: icono del título, "Nivel N", título y barra con `current / needed XP` |
| `LevelBadge` ("Nv. N", con texto accesible "Nivel N") | Junto al nombre en amigos y búsqueda, lista y pantalla de duelos, selector de amigos del relámpago y "Tus amigos hoy" del reto diario |
| Texto "Nivel N" | Portada, bajo el nombre del enlace al perfil |

### Estadísticas del perfil

1. [`profile/page.tsx`](../../apps/web/src/app/profile/page.tsx#L21) (servidor) llama a `category_stats()` junto con el resto de consultas.
2. La RPC devuelve las categorías activas en su orden con el nombre en el idioma del perfil.
3. [`CategoryStats`](../../apps/web/src/features/stats/category-stats.tsx#L16) suma los totales y llama a `categoryHighlights()` (game-core) para marcar "Tu fuerte" y "Tu punto débil". Cada fila lleva el icono de la categoría, la barra en su color y el nº de respondidas.

## Base de datos

### `profiles.xp`

Columna `xp integer not null default 0 check (xp >= 0)` ([L8](../../supabase/migrations/20261020233725_xp_and_levels.sql#L8)): copia acumulada del ledger para no sumarlo en cada lista. **No es editable por el cliente**: no está en los `grant insert/update` por columnas de `profiles` (el cliente la lee con su propio `select`, bajo RLS por `auth.uid()`). Otros jugadores la ven solo a través de las RPC de abajo.

### `xp_events`

Ledger: una fila por jugador y partida. [Migración](../../supabase/migrations/20261020233725_xp_and_levels.sql#L11).

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | bigint | PK, `generated always as identity` |
| `player_id` | uuid | FK a `auth.users(id)`, `on delete cascade` |
| `quick_match_id` | uuid | FK a `quick_matches(id)`, `on delete set null` |
| `duel_id` | uuid | FK a `duels(id)`, `on delete set null` (si el rival borra su cuenta y el duelo desaparece, la XP se conserva) |
| `amount` | integer | `> 0` |
| `total` | integer | Total del jugador tras sumar esta fila; la pantalla de resultados anima la barra desde `total - amount` |
| `created_at` | timestamptz | `now()` |

Únicos: `(player_id, quick_match_id)` y `(player_id, duel_id)` (idempotencia). Índice `xp_events_player_idx (player_id)`. Solo lo escribe `grant_xp`. RLS activado, sin políticas, `revoke all` a `anon` y `authenticated`.

### Triggers

| Trigger | Tabla y condición | Función |
| --- | --- | --- |
| `quick_matches_grant_xp` | `after update of finished_at` en `quick_matches`, cuando `old.finished_at is null and new.finished_at is not null` | `quick_match_grant_xp()`: `grant_xp(owner_id, 10 + coalesce(sum(points del asiento 0), 0) / 2, id, null)`. Versión vigente: [`quick_xp_halved.sql`](../../supabase/migrations/20261021124431_quick_xp_halved.sql#L3) (la de `xp_and_levels` daba puntos + 20) |
| `duels_grant_xp` | `after update of status` en `duels`, cuando `old.status = 'active' and new.status = 'finished'` | `duel_grant_xp()`: para cada jugador, `grant_xp(jugador, puntos respondidos + 20 si completed + 30 si ganador o 10 si empate completed, null, duelo)` ([L77](../../supabase/migrations/20261020233725_xp_and_levels.sql#L77)) |

### Funciones

| Función | Argumentos | Devuelve | Quién la llama | Qué hace |
| --- | --- | --- | --- | --- |
| `grant_xp` | `player uuid, amount integer, quick_match uuid, duel uuid` | `void` | Interna (los dos triggers) | Ledger idempotente más `profiles.xp`, ver "Ganar XP". `security definer` |
| `xp_gain` | `player uuid, quick_match uuid, duel uuid` | `jsonb` `{gained, total}` o `null` | Interna (`get_quick_match`, `get_duel`, `get_daily`) | Lo ganado por el jugador en esa partida |
| `category_stats` | ninguno | `jsonb`: `[{id, name, color, answered, correct}]` | Servidor de Next (`/profile`) | Una entrada por categoría activa con nombre en el idioma del perfil, ordenadas por `sort_order, id`; cuenta `question_answers` del jugador sin los turnos de invitados. `security definer`, `stable`. [`question_stats.sql`](../../supabase/migrations/20261021152204_question_stats.sql#L44) |

`question_answers` (vista) y `question_hit_rate` están en [preguntas.md](preguntas.md). Permisos: `grant_xp`, `xp_gain` y las funciones de trigger sin `execute` para el cliente; `category_stats` para `authenticated`.

RPC que devuelven la XP (todas `security definer`). Versiones vigentes: `get_quick_match`, `get_duel`, `list_duels` y `search_players` en [`xp_and_levels.sql`](../../supabase/migrations/20261020233725_xp_and_levels.sql#L132); `list_friends` y `get_live_duel` en [`live_duels.sql`](../../supabase/migrations/20261021141452_live_duels.sql#L59); `get_daily` en [`daily_challenge.sql`](../../supabase/migrations/20261021155309_daily_challenge.sql#L172).

| RPC | Campo |
| --- | --- |
| `get_quick_match` | `xp`: lo ganado por el anfitrión (`null` hasta terminar) |
| `get_duel` | `xpGain` (lo ganado por quien consulta) y `xp` de `me` y `opponent` |
| `list_duels` | `opponent.xp` |
| `list_friends` | `xp` de cada entrada (amigos, entrantes y salientes) |
| `search_players` | `xp` de cada resultado |
| `get_daily` | `match.xp` (lo ganado) y `xp` de cada amigo que lo ha terminado |
| `get_live_duel` | `xp` de cada jugador (vía `live_player_summary`, solo para el nivel) |

## Código

| Archivo | Para qué |
| --- | --- |
| [`packages/game-core/src/progress.ts`](../../packages/game-core/src/progress.ts) | `LEVELS` (L8: 50 XP, x1,13, título cada 5, último título 50), `levelCost`, `xpForLevel`, `levelProgress` (nivel, XP dentro del nivel y XP que pide), `TitleLevel` y `titleLevel` |
| [`packages/game-core/src/stats.ts`](../../packages/game-core/src/stats.ts) | `HIGHLIGHT_MIN_ANSWERED` y `categoryHighlights` |
| [`apps/web/src/features/progress/level-badge.tsx`](../../apps/web/src/features/progress/level-badge.tsx) | Insignia "Nv. N" |
| [`apps/web/src/features/progress/level-card.tsx`](../../apps/web/src/features/progress/level-card.tsx) | Caja del perfil |
| [`apps/web/src/features/progress/xp-bar.tsx`](../../apps/web/src/features/progress/xp-bar.tsx) | Barra de XP (fracciones 0-1, animada con `from`, `role="progressbar"`) |
| [`apps/web/src/features/progress/xp-gain.tsx`](../../apps/web/src/features/progress/xp-gain.tsx) | XP ganada, subida de nivel y título nuevo |
| [`apps/web/src/components/title-icon.tsx`](../../apps/web/src/components/title-icon.tsx) | Un icono SVG por `TitleLevel` |
| [`apps/web/src/features/stats/category-stats.tsx`](../../apps/web/src/features/stats/category-stats.tsx) | Sección "Estadísticas" del perfil |
| [`apps/web/src/features/game/sfx.ts`](../../apps/web/src/features/game/sfx.ts) | Sonido `levelUp` (campana) |
| `apps/web/messages/*.json` | Textos en `Progress` (nivel, XP, títulos) y `Stats` |
| [`apps/web/src/app/dev/ui/showcase.tsx`](../../apps/web/src/app/dev/ui/showcase.tsx) | `/dev/ui` (solo desarrollo): "Estadísticas" y "XP y niveles" con botones para probar subir de nivel y título nuevo |

## Tests

- [`packages/game-core/src/progress.test.ts`](../../packages/game-core/src/progress.test.ts) (Vitest): costes (50, 56, 64, 150), XP de umbral de los niveles 1, 2, 3, 5, 10, 20 y 50 (0, 50, 106, 242, 771, 3.538, 153.031), subida justo al llegar al umbral, `levelProgress` coherente con `xpForLevel` en cada umbral hasta el nivel 150, y títulos (cada 5, tope en el 50).
- [`packages/game-core/src/stats.test.ts`](../../packages/game-core/src/stats.test.ts): mejor y peor entre las de 10 respuestas o más, menos de dos válidas no marca nada, extremos empatados por fracción.
- [`supabase/tests/xp.test.sql`](../../supabase/tests/xp.test.sql) (pgTAP, 14): sin terminar no hay XP; rápida con invitado = 23 (mitad de los puntos del anfitrión + 10); tocar de nuevo la partida no suma; `get_quick_match` devuelve `{gained, total}`; duelo perdido, ganado, por rendición, ganar por rendición y empate; `get_duel` devuelve `xpGain` y la XP del rival; un duelo rechazado sin jugar no apunta nada; el cliente no lee el ledger ni cambia su XP.
- [`supabase/tests/question_stats.test.sql`](../../supabase/tests/question_stats.test.sql) (12): `category_stats` (7 categorías, solo los turnos del anfitrión, tiempo agotado = fallo, relámpago y duelo cuentan, cada uno ve solo lo suyo con nombres en su idioma, el cliente no lee la vista) y `question_hit_rate`.
- [`supabase/tests/daily_challenge.test.sql`](../../supabase/tests/daily_challenge.test.sql): el reto terminado trae XP como una rápida.
- Sin tests de web para estos componentes (se prueban a mano en `/dev/ui`).

## Detalles a tener en cuenta

- **El nivel no está en la BD.** Cambiar `LEVELS` recalibra el nivel de todos sin migración (y sin avisar), pero la regla de **XP** vive solo en los triggers: cambiarla exige una migración nueva con la función completa (como hizo `quick_xp_halved`) y **no recalcula** la XP ya sumada.
- **Dos copias del total:** `profiles.xp` (para listas) y `xp_events.total` (para animar). Solo `grant_xp` las escribe, juntas; no hay nada que las reconcilie si alguien edita una a mano.
- **Un duelo concede a los dos a la vez:** `duel_grant_xp` recorre a ambos jugadores en el mismo trigger, también al perdedor. En `timeout`, `surrender`, `declined` y `unfriended` no hay los +20; si no hay ganador (rechazo o amistad eliminada) solo cuentan los puntos, y en plazo y rendición el ganador suma además los +30. Un duelo rechazado después de que el retador respondiera su primera ronda le da XP por esas preguntas.
- **Mínimo de una rápida: 10 XP** aunque se falle todo (siempre que se termine).
- **Sin XP para invitados, el relámpago ni la práctica.** El reto incompleto (cambia el día sin acabarlo) tampoco da XP porque no llega a `finished_at`.
- **No hay antifarmeo:** la XP no depende de cómo se juegue (una rápida da 10 XP aunque se falle todo), solo del límite de peticiones (60 partidas rápidas por hora y cuenta; 20 duelos por hora). Con las ligas semanales por XP de la Fase 6 habrá que revisarlo.
- **La XP es visible para otros:** `search_players` la devuelve para cualquier nombre que empiece por 3 o más letras, además de amigos y rivales.
- **`category_stats` solo lista categorías activas con nombre en el idioma del perfil.** Las respuestas en categorías inactivas no entran en los totales que muestra la interfaz (la web suma las filas que recibe).
- **Se calcula al vuelo** desde `question_answers` (union de los tres modos) en cada visita al perfil: sin contadores que mantener, pero recorre todo el historial del jugador. Decisión de [CLAUDE.md](../../CLAUDE.md): si crece mucho, pasar a contadores por pregunta. El índice `duel_plays_player_idx` se añadió para esta lectura.
- **Dos umbrales distintos:** 10 respuestas para destacar una categoría (`game-core`) y 20 para mostrar el % de una pregunta (`question_hit_rate`). No están enlazados.
- **Añadir un título** exige ampliar el tipo `TitleLevel`, `LEVELS`, las claves de `Progress.titles` en `es` y `en`, el icono de `title-icon.tsx` y el test de títulos; el icono está indexado por nivel, no por BD.
- **Estilo:** nada de emojis; los iconos son SVG propios (decisión del 2026-10-19).
