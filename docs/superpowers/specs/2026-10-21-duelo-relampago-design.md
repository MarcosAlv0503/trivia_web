# Duelo relámpago (1 contra 1 en vivo) y animaciones de final de partida

Fecha: 2026-10-21. Estado: borrador para aprobar.

## Por qué

El duelo por turnos dura días. Falta una forma de jugar contra un amigo **ahora mismo**, en un minuto, con la tensión de
ver al otro sumar puntos. Y los finales de partida son planos: queremos que ganar, perder o empatar se _sientan_, en
todos los modos.

Se hace ya, pausando la Fase 5 (aprobado el 2026-10-21). Al terminar se retoma la Fase 5 por la tarea 2.

## Objetivos

1. **Duelo relámpago / Lightning duel**: 1 contra 1 en vivo entre amigos conectados, 60 s, las mismas preguntas para los
   dos, gana quien más puntos sume.
2. **Reloj analógico** con el tiempo restante.
3. **Cuatro animaciones de final** (Victoria, Derrota, Empate simple, Empate legendario) con su sonido, aplicadas a
   todos los modos con rival.

## Fuera de alcance

- XP en el duelo relámpago (se decide más adelante; no suma nada).
- Invitar a quien no está conectado, rivales desconocidos, más de 2 jugadores, espectadores.
- Historial de duelos relámpago, estadísticas, revancha con un botón (se puede volver a retar desde amigos).
- Push para la invitación (el invitado ya está con la app abierta).

## Reglas del duelo relámpago (decididas por el usuario)

- **Invitación:** solo a amigos **conectados**. Quien reta elige la dificultad (Fácil/Normal/Difícil). El invitado ve un
  aviso con Aceptar/Rechazar; la invitación caduca a los **30 s**. Al aceptar, empiezan los dos a la vez.
- **Preguntas:** se eligen al azar al empezar, siempre de más (ver "Reserva"), y son las mismas y en el mismo orden para
  los dos. Categorías mezcladas. Cada uno avanza a su ritmo: uno puede responder 10 y el otro 15.
- **Tiempo:** 60 s por jugador. Cada pregunta dura como mucho **6 s**.
- **Puntos:** acierto = **10**; acierto en menos de 3 s = **13**. Fallo o tiempo agotado = 0 (sin castigo).
- **Ritmo:** tras responder, destello breve (~0,7 s) con acierto/fallo y la correcta, y pasa sola a la siguiente. **El
  destello no descuenta de los 60 s.**
- **Marcador:** se ve en vivo la puntuación del rival.
- **Abandono:** no hay rendición. Si alguien se va o pierde la conexión, su reloj sigue corriendo y deja de sumar; si
  vuelve a tiempo, sigue jugando. Al acabar los dos relojes, gana quien tenga más puntos; a igualdad, empate.
- **Fin desigual:** quien acaba antes ve "Esperando a {rival}…" con el marcador en vivo hasta que el rival termina, y
  entonces sale la animación.
- **En línea:** interruptor en el perfil "Mostrar cuando estoy en línea", activado por defecto. Apagado, no sales
  conectado ni te pueden retar en vivo, y tampoco ves quién está conectado (reciprocidad).
- **Ocupado:** quien está en otra partida (rápida o turno de duelo) sale como "Jugando" en vez de "En línea" y no se le
  puede retar en vivo.

## Pantallas (decididas por el usuario)

- **Entrada:** botón "Duelo relámpago" en la portada, que abre la lista de amigos conectados; y en cada amigo conectado
  de la lista de amigos, un botón con icono de rayo junto al de duelo. En la lista de amigos se ve un punto de "en
  línea".
- **Reloj:** esfera con borde de pegatina; una aguja da una vuelta en 60 s y el sector recorrido se colorea (rojo en
  los últimos 10 s, con tic-tac). Alrededor, un anillo fino que se vacía en los 6 s de la pregunta. Encima de las
  respuestas, como en el resto de modos; mini marcador Tú / Rival.

## Animaciones de final (decididas por el usuario)

Protagoniza el ajolote (`components/mascot.tsx`, con variantes nuevas). Cada una con sonido propio, sintetizado con
Web Audio como los demás (`features/game/sfx.ts`: marimba, campana, madera; nada "arcade").

| Animación         | Carácter pedido                         | Propuesta                                                                                                            |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Victoria          | Fiesta, feliz, divertida                | Ajolote saltando con gorro de fiesta, confeti con los colores de categoría, rótulo "¡Victoria!" en pegatina que rebota. Fanfarria ascendente de marimba y campanas. |
| Derrota           | Triste pero orgulloso, exhausto          | Ajolote sudando y jadeando, pero con la cabeza alta. Rótulo "Derrota". Melodía menor descendente que acaba en un acorde mayor cálido. |
| Empate simple     | Simple y aburrida                        | Ajolote bostezando; rótulo "Empate" que cae sin gracia. Dos notas planas de madera.                                  |
| Empate legendario | Épica y caballeresca                     | Ajolote con casco y espada, destellos y las espadas cruzadas del icono de duelo; rótulo "¡¡¡Combate legendario!!!". Fanfarria de campanas con golpe metálico. |

**Cuándo es legendario:** empate con **50 puntos o más cada uno** en el duelo relámpago. En los modos de número de
preguntas fijo se escala por pregunta: **5 puntos × preguntas que responde cada jugador** (media de la mitad
acertadas): modo rápido local 7 × 5 = 35; duelo por turnos de 3 rondas 9 × 5 = 45, de 6 rondas 18 × 5 = 90.

**Dónde sale:**

| Modo / final                                  | Animación                                                        |
| --------------------------------------------- | ---------------------------------------------------------------- |
| Duelo relámpago                               | Victoria / Derrota / Empate (simple o legendario) según el caso  |
| Duelo por turnos terminado                    | Ídem                                                             |
| Duelo por turnos: alguien se rinde o caduca   | Victoria para quien gana, Derrota para quien pierde               |
| Duelo por turnos rechazado                    | Ninguna                                                          |
| Rápida local con 2 o más jugadores            | Solo Victoria, con el nombre del ganador                         |
| Rápida local con empate en el primer puesto   | Empate (simple o legendario) con los nombres empatados           |
| Rápida en solitario                           | Ninguna (se queda la pantalla de resultados actual)              |

## Cómo se construye (decisiones de backend, tomadas por Claude)

Sigue el patrón de los modos existentes: tablas sin permisos para el cliente, todo por RPC `security definer`, el
servidor calcula reloj y puntos. Realtime solo como transporte.

- **Conexión ("en línea"):** columnas `profiles.last_seen_at` y `profiles.busy`, que el cliente actualiza con una RPC
  `touch_presence(busy)` cada 20 s mientras la pestaña está visible y al entrar o salir de una partida (`busy` = está en
  `/play/quick/[id]`, `/duel/[id]` o `/live/[id]`). `profiles.show_online` (por defecto `true`, editable en el
  perfil). `list_friends` devuelve `presence`: `online` | `busy` | `offline` (visto hace menos de 45 s; siempre
  `offline` si cualquiera de los dos tiene `show_online` apagado). Solo lo ven los amigos. Se descarta Realtime Presence: un canal público dejaría ver a cualquiera quién está conectado, y el
  canal privado depende de `realtime.messages` (descartado el 2026-10-16). Es un dato personal nuevo: hay que añadir
  una línea a la política de privacidad.
- **Tabla `live_duels`:** retador, rival, dificultad, estado (`pending` | `active` | `finished` | `declined` |
  `expired` | `cancelled`), `created_at`, `starts_at`, puntos de cada uno. La lista de preguntas va en otra tabla,
  `live_duel_questions` (posición, pregunta, `answer_order`), porque Realtime envía la fila entera y no respeta los
  permisos por columna. Tabla `live_duel_answers` (jugador, posición, `served_at`, `answered_at`, elección, puntos), como `quick_match_rounds`.
- **RPC:** `invite_live_duel(friend, difficulty)` (exige amistad, que el rival esté `online` y no `busy`, y al menos 20
  preguntas compartidas en la reserva; un solo duelo relámpago pendiente o activo por persona; con `check_rate_limit`), `cancel_live_duel`, `answer_live_invite(id, accept)`,
  `get_live_duel`, `serve_live_question`, `answer_live_question`. La invitación caduca de forma perezosa a los 30 s
  (como `expire_duels`).
- **Aviso de invitación:** fila nueva en `notifications` (tipo `live_invite`), que ya llega en vivo. `NotificationToasts`
  la muestra con Aceptar/Rechazar. El trigger de push la ignora.
- **Arranque a la vez:** al aceptar, `starts_at = now() + 3 s`; los dos ven una cuenta atrás 3-2-1 y empiezan a la vez
  por el reloj del servidor.
- **Reloj del servidor:** el tiempo de un jugador es `now() − starts_at` menos las pausas tras cada respuesta dada a
  tiempo: lo que tardó en servirse la siguiente pregunta (el destello y la petición), como mucho 1 s cada una
  (corregido el 2026-10-21 en `live_clock_pause`: con 1 s fijo, quien responde muy rápido casi no gastaba reloj). Se
  le acaba cuando llega a 60 s. Si se desconecta, su reloj sigue corriendo, así que la partida acaba a lo sumo en
  60 s + 1 s por respuesta. Una pregunta
  se cierra a los 6 s o cuando acaba el reloj del jugador, lo que llegue antes, con la misma gracia y margen de
  latencia que el modo rápido. El cliente solo dibuja el reloj y se resincroniza con lo que devuelve cada RPC.
- **Reserva:** 60 preguntas por partida (gastarlas exige responder en menos de 1 s de media); si se acaban, se acaba
  el tiempo de ese jugador. Solo preguntas jugables con traducción en el idioma de **los dos** jugadores, priorizando
  las que ninguno ha visto (como `quick_match_fresh_questions`). Si hay menos de 60 se usan las que haya (el seed tiene
  42 por dificultad); con menos de 20, la invitación se rechaza con el aviso "No hay suficientes preguntas en vuestros
  idiomas para esta dificultad".
- **Puntos:** función SQL propia (10, o 13 en menos de 3 s), separada de `answer_points` (la del modo rápido y el duelo,
  que no cambia).
- **Marcador en vivo y fin:** `live_duels` se publica en Realtime con RLS de lectura para los dos participantes (solo
  columnas sin respuestas: estado, `starts_at`, puntos). La partida pasa a `finished` cuando se acaban los dos relojes;
  lo detecta de forma perezosa cualquier RPC del duelo y el cliente pregunta con `get_live_duel` al acabar su reloj.
- **game-core:** `live.ts` con las constantes (`LIVE`, espejo de la migración) y `outcome.ts` con la decisión de qué
  animación toca (victoria/derrota/empate simple/legendario) para cada modo, con tests. La usan las tres pantallas de
  resultados.
- **Rutas:** `/live/[duelId]`, protegida por el proxy como el resto.
- **Tests:** Vitest para `live.ts` y `outcome.ts`; pgTAP para las RPC (invitación, caducidad, reloj, puntos, fin). El
  CI no arranca Realtime: toda la lógica queda en SQL, que sí se prueba.

## Decisiones de pantalla que propone Claude (revisar)

- La animación de final ocupa toda la pantalla ~3 s (se puede saltar tocando) y después queda la pantalla de resultados
  de cada modo. En el duelo por turnos sale al cargar un duelo terminado, donde hoy suena `win`, pero **solo la primera
  vez** en cada dispositivo (marca por duelo en `localStorage`; si falla, sale otra vez, sin más). Al reabrirlo solo se
  ve el resultado.
- Si además se sube de nivel, primero la animación de final y después la pegatina "¡Nivel X!" de siempre.
- Con "reducir movimiento" del sistema, las animaciones se quedan en una pose fija con el rótulo, sin saltos ni confeti.
- Quien reta, mientras espera, ve una pantalla "Esperando a {nombre}…" con la cuenta atrás de 30 s y "Cancelar".
- Si la invitación caduca o la rechazan, aviso breve y vuelta a la lista de amigos.
- Textos nuevos en `es` y `en` en `messages/*.json`; los rótulos de las animaciones, como en la tabla.

## Lo que queda al constructor

Detalles de la animación (curvas, duración exacta, partículas), notas exactas de los sonidos, dibujo de las variantes
del ajolote dentro del estilo actual, nombres de columnas y funciones, y el tiempo exacto de gracia y margen.
