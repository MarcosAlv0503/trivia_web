# Duelo relámpago: plan de implementación

> Ejecución: en esta misma sesión, tarea por tarea (lo pidió el usuario). Pasos con casillas (`- [ ]`).

**Objetivo:** duelo 1 contra 1 en vivo de 60 s entre amigos conectados, reloj analógico y cuatro animaciones de
final con sonido en todos los modos con rival.

**Arquitectura:** igual que el modo rápido y el duelo: tablas sin acceso para el cliente y RPC `security definer`
que cronometran y puntúan (`clock_timestamp()`). Realtime solo para el marcador y el estado (`live_duels` con RLS de
lectura); en las pantallas de espera se consulta `get_live_duel` cada 1,5 s, que además cierra la partida de forma
perezosa. Las reglas del cliente (constantes y qué animación toca) van en `game-core`.

**Diseño:** `docs/superpowers/specs/2026-10-21-duelo-relampago-design.md`.

## Restricciones globales

- 60 s por jugador; 6 s por pregunta; acierto 10, en menos de 3 s 13; fallo o tiempo agotado 0.
- Destello de 0,7 s; cada respuesta suma 1 s al reloj del jugador (el destello no descuenta).
- Invitación: caduca a los 30 s; cuenta atrás de 3 s al aceptar; un solo duelo relámpago pendiente o activo por
  persona; reserva de 60 preguntas, mínimo 20 en los idiomas de los dos.
- "En línea" = visto hace menos de 45 s; latido cada 20 s; `busy` en `/play/quick/[id]`, `/duel/[id]`, `/live/[id]`.
- Empate legendario: ≥ 50 en vivo; ≥ 5 × preguntas por jugador en el resto.
- Sin XP en el duelo relámpago. Sin emojis: iconos SVG propios. Todo texto en `messages/es.json` y `en.json`.

## Puntos de revisión

1. El jugador recarga la página a mitad: recupera la pregunta abierta con el tiempo ya gastado (`serve` idempotente).
2. Responder después de agotar el reloj del jugador: se rechaza o cuenta 0, nunca suma.
3. Dos invitaciones cruzadas a la vez: la segunda falla con `friend_busy`.
4. El invitado acepta una invitación caducada o cancelada: error `invite_unavailable`, sin partida.
5. Un jugador desaparece: la partida termina sola como mucho a los 60 s + 1 s por respuesta + margen.

---

### Tarea 1: reglas en `game-core`

**Archivos:** crear `packages/game-core/src/live.ts`, `live.test.ts`, `outcome.ts`, `outcome.test.ts`; exportar en
`index.ts`.

- `LIVE = { matchMs: 60000, questionMs: 6000, revealMs: 700, answerCreditMs: 1000, inviteSeconds: 30,
  countdownMs: 3000, correct: 10, fastBonus: 3, fastMs: 3000, legendaryDraw: 50 }`.
- `OutcomeKind = "victory" | "defeat" | "draw" | "legendaryDraw"`.
- `legendaryThreshold(questionsPerPlayer) = 5 × questionsPerPlayer`.
- `headToHeadOutcome(result: "win" | "loss" | "draw", myScore, legendaryFrom): OutcomeKind`.
- `localOutcome(players, legendaryFrom)`: `null` con un jugador; si no, `{ kind, winners }`.
- Tests: victoria y derrota según el resultado (aunque sea por rendición); empate a 50 legendario y a 49 simple;
  local en solitario `null`, un ganador, dos empatados en cabeza.

### Tarea 2: migración `live_duels` + pgTAP

**Archivos:** `supabase/migrations/<ts>_live_duels.sql`, `supabase/tests/live_duels.test.sql`, tipos regenerados.

- `presence` (user_id, last_seen_at, busy), `profiles.show_online` (editable), `presence_of(viewer, target)`.
- `touch_presence(is_busy)`, `list_friends` con `presence`.
- `live_duels`, `live_duel_questions`, `live_duel_answers`; `notifications.kind` admite `live_invite`.
- RPC: `invite_live_duel`, `cancel_live_duel`, `answer_live_invite`, `get_live_duel`, `serve_live_question`,
  `answer_live_question`; `settle_live_duels(uid)` interno (caduca y cierra).
- `retention_stats` cuenta también las respuestas en vivo.
- Tests: presencia y reciprocidad; invitación (no amigo, desconectado, ocupado, segunda invitación); caducidad;
  aceptar; servir antes de empezar; puntos 13/10/0; reloj agotado; fin y ganador; RLS de lectura.

### Tarea 3: presencia en la web

- `features/presence/presence-heartbeat.tsx` en el layout; interruptor `show_online` en el perfil; línea en la
  política de privacidad (es/en).

### Tarea 4: invitar y aceptar

- Amigos: punto de estado y botón de rayo con dificultad; página `/live` con los amigos conectados (enlace en la
  portada); aviso `live_invite` con Aceptar/Rechazar en `NotificationToasts`.

### Tarea 5: partida en vivo

- `components/analog-clock.tsx`; `features/live/live-game.tsx` (espera, cuenta atrás, preguntas, "Esperando a…",
  resultados); `app/live/[duelId]/page.tsx`. `useQuestionTimer` con opción de no hacer tic-tac.

### Tarea 6: animaciones de final y sonidos

- Variantes de `Mascot` (`party`, `tired`, `bored`, `knight`); `features/game/match-outcome.tsx`; sonidos `victory`,
  `defeat`, `draw`, `legendary` en `sfx.ts`; en vivo, duelo (una vez por dispositivo) y rápida local; XP después de
  la animación; muestrario en `/dev/ui`.

### Tarea 7: documentación y verificación

- `CLAUDE.md` (hoja de ruta, reglas aprobadas, decisiones); `pnpm lint`, `typecheck`, `test`, `build`, `db:test`.
