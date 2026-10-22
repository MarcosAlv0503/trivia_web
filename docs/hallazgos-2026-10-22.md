# Hallazgos al documentar el proyecto (2026-10-22)

Salieron al leer todo el código para escribir `docs/modulos/` (2026-10-22). No se ha corregido nada. Varios ya estaban en la revisión del 2026-10-16 (`mejoras.md`, sin versionar). Los de gravedad media están resumidos en `CLAUDE.md` > "Estado y pendientes".

## Gravedad media (comprobados uno a uno)

1. **Texto legal inexacto: duelos del rival.** La privacidad dice que, al borrar tu cuenta, "en los duelos ya terminados de otros jugadores, tu lugar queda vacío" (`apps/web/src/features/legal/content/es.ts:53`, igual en `en.ts`). En realidad `duels` y `live_duels` tienen `challenger_id`/`opponent_id` con `on delete cascade` (`friends_and_duels.sql:264-265`, `live_duels.sql:102-103`): el duelo desaparece también para el rival, con sus respuestas, que dejan de contar en sus estadísticas. Hay que cambiar el texto o el modelo de datos (decisión tuya).
2. **Texto legal inexacto: avisos a las 24 h.** La política dice que los avisos "se borran a las 24 horas" (`es.ts:25`). La purga solo ocurre dentro de `notify` (`friends_and_duels.sql:67`) al crear otro aviso para esa misma cuenta: quien no recibe más avisos conserva los viejos indefinidamente.
3. **Push tras cerrar sesión en otros dispositivos.** `signOut()` cierra la sesión en todos los dispositivos (alcance `global` por defecto, `features/auth/actions.ts:28`), pero solo se da de baja el push del dispositivo actual (`sign-out-button.tsx:17`). Los demás siguen recibiendo avisos de la cuenta sin sesión.
4. **El reto diario no cuenta como "Jugando".** `BUSY_PATH` (`features/presence/presence-heartbeat.tsx:10`) solo cubre `/play/quick/<id>`, `/duel/<id>` y `/live/<id>`, y el reto se juega en `/daily`. Quien lo está jugando sale "en línea" y le pueden llegar retos en vivo a mitad de pregunta.
5. **Un tercer idioma rompe el reto diario.** `ensure_daily_challenge` exige exactamente 2 traducciones por categoría y por pregunta (`daily_challenge.sql:71` y `:80`). Con un tercer idioma no se generaría ningún reto (`not_enough_questions`). La guía "Añadir un idioma" de `docs/procesos-de-preguntas.md` no lo menciona, ni tampoco los `check (... in ('es', 'en'))` de `live_duels.challenger_locale`/`opponent_locale` (`live_duels.sql:106-107`).
6. **Responder pasada la medianoche cierra el reto de ayer.** `serve_quick_question` rechaza un reto de un día pasado (`daily_expired`), pero `answer_quick_question` (versión vigente en `question_stats.sql`) no lo comprueba: una pregunta servida a las 23:59:55 se puede responder después de las 00:00, terminar el reto de ayer y dar XP.
7. **La skill `questions-review` puede atascarse en ejecución programada.** Su paso 4 lanza subagentes con la herramienta Agent, pero `allowed-tools` no la incluye (`.claude/skills/questions-review/SKILL.md:6` frente a `:25`).
8. **Sin test del invariante principal en duelos.** Solo `quick_matches.test.sql:94` comprueba que la pregunta servida no incluye la correcta; no hay comprobación equivalente para `serve_duel_question` ni `serve_live_question`.
9. **Sin test del borrado de cuenta.** `delete_own_account` no tiene ningún test pgTAP, ni de la cascada. Una tabla futura con clave a `auth.users` sin cascada rompería el borrado (lo exigen el RGPD y Apple).

## Gravedad baja (de los agentes, sin comprobar uno a uno)

**Base de datos y servidor**

- El reto diario trata la dificultad como preferencia (`daily_challenge.sql:81`): si falta una pregunta de la dificultad que toca, el reparto 2+3+2 se rompe sin avisar.
- `get_quick_match.total` es `player_count * 7` (`xp_and_levels.sql:142`): el reto diario depende de que el 7 de la rápida no cambie.
- Reimportar un `externalId` sin `topical`/`expiresAt` convierte una pregunta de actualidad en permanente (`question_pipeline.sql:54-72`; `scripts/import-questions.mts` envía el JSON tal cual; `questions.mts` sí lo evita).
- Cambiar el número de respuestas de una pregunta que está en una partida en curso desajusta su `answer_order` (`question_pipeline.sql:75-93`, `admin_update_question`, `apply-reviews`).
- `remove_friend` no cierra los relámpagos y `answer_live_invite` no vuelve a comprobar la amistad (`live_duels.sql:357`, `friends_and_duels.sql:207`).
- Si ninguna categoría tiene 3 preguntas disponibles, `spin_duel_round` falla y el plazo acaba dando la derrota; `start_duel` no lo comprueba (`friends_and_duels.sql:438`).
- `remove_friend` no vence antes los plazos (un duelo ya caducado queda `unfriended` en vez de `timeout`); `expire_duels` pone `finished_at` al detectarlo y no avisa al ganador.
- Push: el `endpoint` solo se valida como `https://` y la función hace POST a cualquier URL registrada (SSRF ciego acotado); el secreto del webhook se compara con `!==` (`push_notifications.sql:21`, `functions/push/index.ts:18,31`).
- La casilla de términos solo se comprueba en la server action (`profile/actions.ts:34`); la BD solo exige `terms_version > 0`.
- No hay antifarmeo de XP: una rápida da 10 XP aunque se falle todo. Conviene revisarlo antes de las ligas por XP (Fase 6).
- El límite de 30 reportes al día es propio, no usa `check_rate_limit`, y no tiene test; tampoco hay test del límite de 60 partidas rápidas por hora.
- `retention_stats` ya cuenta el relámpago, pero `docs/produccion.md:173` y su test no.
- `supabase/config.toml:72` apunta a `./seed.sql`, que no existe; `supabase/.env.example` no lista las variables de Apple y Facebook que usa `config.toml`.

**Web**

- `rate_limited` sale como error genérico al retar, pedir amistad o empezar una rápida, y como "No hay jugadores con ese nombre" en la búsqueda (`duel/start-duel.ts:18`, `friends/friends-view.tsx:34`, `game/quick/actions.ts:52-53`). Solo el relámpago lo traduce.
- `startDaily` lanza un `Error` si falla la RPC y sale la página de error global (`daily/actions.ts:11`).
- "Revancha" aparece también en duelos cancelados y falla si os habéis quitado de amigos (`duel/duel-game.tsx:415`).
- Las partidas rápidas abandonadas quedan abiertas y no se pueden retomar desde la interfaz.
- Un invitado puede llamarse igual que el anfitrión (`game/quick/setup-form.tsx:31-33`).
- La imagen del reto se genera en cada visita a los resultados, se comparta o no (`daily/share-button.tsx:19-32`).
- En el relámpago no se pueden reportar preguntas.
- El panel `/admin` muestra el id de la categoría sin traducir (`admin/review-queue.tsx:91-92`).
- `getOwnProfile` ignora los errores: un fallo de red manda a `/onboarding` a quien ya tiene perfil (`profile/queries.ts:16-21`).
- No hay `not-found.tsx` ni `error.tsx`: el 404 de `/admin` sale en inglés y sin el tema; `global-error.tsx` no pone `lang` (decisión de diseño).
- En `/onboarding`, `touch_presence` falla cada 20 s y se ignora (`presence-heartbeat.tsx:22`).
- Idioma: la interfaz usa la cookie `NEXT_LOCALE` y las partidas `profiles.locale`; entre dispositivos pueden divergir.
- El aviso de invitación en vivo calcula su vida con el reloj del cliente frente a `created_at` del servidor (`notification-toasts.tsx:47`).
- `id` del `clipPath` repetido en cada avatar (`profile/avatar.tsx:60`); colores copiados a mano en `match-outcome.tsx:14`, `pwa/brand-icon.tsx:6` y `daily/daily-image.tsx:7`; `sfx.ts:84` crea el `AudioContext` al importar.
- Nada comprueba que `en.json` tenga las mismas claves que `es.json` (hoy 296 en cada uno).
- El `matcher` del proxy excluye cualquier ruta acabada en extensión de imagen (`proxy.ts:21`); hoy no hay ninguna.
- La política no menciona el `localStorage` `trivia:outcome-seen:*` (`es.ts:76`).

**Herramientas y CI**

- `scripts/` no pasa por lint, typecheck ni tests.
- El CI no comprueba que `database.types.ts` esté al día con las migraciones.
- No hay test de paridad entre las constantes de `game-core` y SQL; `LIVE.questionMs`, `maxPauseMs`, `countdownMs`, `correct`, `fastBonus`, `fastMs` y `DUEL.turnHours` no se usan en ningún sitio.
- `questions.mts`: `reviewReason` ignora `reviewed_at`, así que una aprobada con estadísticas raras vuelve a salir en cada `to-review` (`:137-153`); `to-translate` propone preguntas de actualidad ya caducadas (`:121-135`); `status` no enseña categorías nuevas vacías (`:73-109`).
- `import-questions.mts` solo acepta `--local` como segundo argumento.
- `backup-db.mts` pasa la contraseña como argumento de proceso (visible mientras corre), y el borrado a los 30 días solo ocurre al hacer otra copia.

**CLAUDE.md y documentación desfasados**

- CLAUDE.md (Fase 4, tarea 6) dice que falta crear los proyectos, pero el Supabase de producción ya existe y recibe las migraciones del CI.
- La decisión "Denegación por defecto" dice que sin sesión solo se accede a `/` y `/auth/*`; también a `/legal/*`.
- CLAUDE.md y `packages/game-core/src/quick.ts:4` dicen que las reglas del modo rápido viven en la migración `quick_matches`; hoy están repartidas en varias migraciones posteriores.
- CLAUDE.md cita `live_clock_pause` como función; es la migración (la función es `live_clock_end`).
- README: falta el límite de 30 invitaciones en vivo por hora (`README.md:133`) y varios scripts en su tabla (`README.md:53`).
- El diseño del relámpago sitúa la presencia en `profiles.last_seen_at`/`busy` (es la tabla `presence`) y el plan habla de `answerCreditMs` (ahora `maxPauseMs`).
