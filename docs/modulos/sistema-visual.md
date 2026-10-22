# Sistema visual

Todo lo que da identidad a la interfaz: tokens de color y tipografía, el estilo "pegatina", los componentes compartidos de `apps/web/src/components/`, los iconos SVG propios, la mascota, los finales de partida animados, el sonido y la vibración, las preferencias del dispositivo y la accesibilidad. Los tokens viven en [globals.css](../../apps/web/src/app/globals.css); el muestrario de componentes es [`/dev/ui`](../../apps/web/src/app/dev/ui/showcase.tsx). Las decisiones de estética aprobadas están en [CLAUDE.md](../../CLAUDE.md) ("Estilos y accesibilidad aprobados"); cualquier cambio visual importante se pregunta antes (regla 1).

## Reglas

- **Tema único "Laguna"**, oscuro (`color-scheme: dark`), acento rosa ajolote y estilo "pegatina". Para probar otra estética se cambian los tokens (con las salvedades de "Detalles").
- **Sin emojis ni símbolos Unicode como iconos**: solo SVG propios ([icons.tsx](../../apps/web/src/components/icons.tsx), [category-icon.tsx](../../apps/web/src/components/category-icon.tsx), [title-icon.tsx](../../apps/web/src/components/title-icon.tsx)).
- **Los colores de categoría no son tokens**: vienen con los datos (`categories.color` en BD) y se pasan como props.
- **El color nunca va solo**: cada categoría lleva también su icono.
- **Móvil primero**: una columna (`max-w-md`), la acción principal abajo (zona del pulgar, `mt-auto` y `w-full`), volver con [BackLink](../../apps/web/src/components/back-link.tsx) arriba a la izquierda. No hay estados `hover:`.
- **Los textos visibles no se escriben en los componentes**: salen de `messages/*.json` y los componentes presentacionales los reciben ya traducidos (excepción: `/dev/ui`).

## Tokens (`globals.css`)

Tailwind v4: `@import "tailwindcss"`, un bloque [`@theme`](../../apps/web/src/app/globals.css#L15) y una utilidad propia. Cada `--color-*` genera clases (`bg-surface`, `text-fg-muted`, `border-sticker`...), `--radius-card` genera `rounded-card` y `--shadow-*` genera `shadow-sticker`.

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-bg` | `#0b2735` | Fondo de la página (con degradado radial desde `surface` arriba). |
| `--color-bg-deep` | `#071b26` | Fondos hundidos: pista de barras, casillas apagadas, fondo de los finales. |
| `--color-surface` | `#133b4f` | Tarjetas. |
| `--color-surface-2` | `#1b4d66` | Botón secundario, respuestas, píldoras sobre tarjetas, avisos. |
| `--color-fg` | `#eaf7f7` | Texto principal. |
| `--color-fg-muted` | `#9cc3c9` | Texto secundario. |
| `--color-ink` | `#2b2140` | Texto oscuro sobre colores vivos (categoría, `play`, `ok`). |
| `--color-accent` | `#ff8fb8` | Rosa ajolote: acción primaria, selección, foco, destellos. |
| `--color-accent-ink` | `#3a0f22` | Texto sobre `accent`. |
| `--color-play` | `#f5c431` | Botón "jugar", XP, insignia de nivel, aguja del reloj. |
| `--color-sticker` | `#01080c` | Borde y sombra de las pegatinas (más oscuro que cualquier fondo). |
| `--color-ok` / `--color-ko` | `#3be07a` / `#ff4d5e` | Acierto / fallo, peligro y últimos segundos. |
| `--radius-card` | `18px` | Tarjetas. |
| `--shadow-sticker` | `0 5px 0 var(--color-sticker)` | Sombra plana de la pegatina. |
| `--shadow-sticker-pressed` | `0 1px 0 var(--color-sticker)` | Pegatina pulsada. |
| `--font-display` | Fredoka, `ui-rounded`, `system-ui` | Titulares y botones (`font-display`). |
| `--font-sans` | Nunito, `ui-rounded`, `system-ui` | Texto (`font-sans`, es la fuente del `body`). |

Las fuentes salen de `next/font/google` ([layout.tsx](../../apps/web/src/app/layout.tsx)); como `--font-*` referencia variables que inyecta `next/font`, va en un `@theme inline` aparte.

Otras piezas de `globals.css`:

- **[`sticker`](../../apps/web/src/app/globals.css#L43)** (`@utility`): `border: 3px solid var(--color-sticker)` y `box-shadow: var(--shadow-sticker)`. Es la firma visual: tarjetas, botones, píldoras, avisos.
- **`timer-drain`** (`@keyframes`): `width` hasta 0 %; lo usa la barra de tiempo de `QuestionCard`.
- **Base:** `body` con degradado radial fijo y `--color-fg`; `h1`-`h3` con `font-display` y `text-wrap: balance`; `:focus-visible` con contorno de 3 px `accent` y separación de 3 px.
- **[Tamaño de texto](../../apps/web/src/app/globals.css#L53):** `html[data-text-size="large"]` pone `font-size: 112.5%` y `xlarge`, `125%`. Como Tailwind va en `rem`, escala toda la interfaz. Los SVG con tamaño en píxeles (avatares, iconos, reloj) no escalan.

Patrones que se repiten: tarjeta `rounded-card bg-surface p-5 sticker`; píldora `rounded-full border-2 border-sticker px-3`; resaltar el elemento activo con `ring-4 ring-accent`; barras `h-3`/`h-4 rounded-full border-2 border-sticker bg-bg-deep`; cifras con `tabular-nums`; sombra de la mascota `drop-shadow-[0_6px_0_var(--color-sticker)]`.

## Componentes compartidos (`src/components/`)

Presentacionales: no deciden nada del juego, solo muestran lo que reciben.

| Componente | Props | Uso |
| --- | --- | --- |
| [`buttonClassName(variant, extra)`](../../apps/web/src/components/button.ts) | `variant`: `primary` (`bg-accent`), `secondary` (`bg-surface-2`), `play` (`bg-play`, grande), `danger` (`bg-ko`); `extra`: clases | Devuelve las clases del botón (pegatina, `active:translate-y-1`, `disabled:opacity-60`). Sirve para `<button>` y `<Link>`; es la forma de pintar cualquier botón. |
| [`BackLink`](../../apps/web/src/components/back-link.tsx) | `href`, `label` (ya traducido) | Botón redondo de 40 px con flecha. Cabecera de cada pantalla secundaria. |
| [`CategoryIcon`](../../apps/web/src/components/category-icon.tsx) | `id`, `size=20`, `className` | Icono por categoría (clave = `categories.id`): `geography` (globo), `history` (reloj de arena), `science` (matraz), `art-literature` (paleta), `entertainment` (claqueta), `sports` (balón), `technology` (chip). Una categoría nueva sin dibujo muestra una interrogación. Trazo en `currentColor`. |
| [`icons.tsx`](../../apps/web/src/components/icons.tsx) | `size`, `className` | De trazo: `ArrowLeftIcon`, `CloseIcon`, `CheckIcon`, `FlagIcon` (reportar), `WhiteFlagIcon` (rendirse), `FriendsIcon`. Rellenos: `StarIcon`, `SparkleIcon`. De color con borde de pegatina (modos): `QuickIcon` (rayo), `DuelIcon` (espadas), `DailyIcon` (calendario), `LiveIcon` (reloj con rayo). |
| [`Mascot`](../../apps/web/src/components/mascot.tsx) | `size=160`, `className`, `variant` | Ajolote provisional. Variantes: `default`, `party` (gorro de fiesta), `tired` (agotado y orgulloso), `bored` (bostezo con "z"), `knight` (casco y espada). |
| [`Wheel`](../../apps/web/src/components/wheel.tsx) | `segments: { id, color }[]`, `target: number \| null`, `onSpinEnd?` | Ruleta de categorías (`conic-gradient` con un icono por sector y puntero arriba). Gira 4 vueltas en 3,2 s hasta el sector `target`; para girar dos veces al mismo sector hay que pasar `null` entre giros. Con movimiento reducido no anima. La usa el duelo por turnos (el servidor decide el sector). |
| [`AnalogClock`](../../apps/web/src/components/analog-clock.tsx) | `remainingMs`, `totalMs`, `questionLeft: number \| null`, `warning`, `label`, `size=132` | Reloj de partida del duelo relámpago: una aguja da la vuelta en `totalMs`, el sector recorrido se colorea (`accent`, o `ko` con `warning`) y un anillo exterior se vacía con el tiempo de la pregunta (`null` = anillo apagado). `role="timer"` con `aria-label`. Transiciones CSS de 250 ms. |
| [`QuestionCard`](../../apps/web/src/components/question-card.tsx) | `category {id,label,color}`, `badge?`, `question`, `answers {id,text}[]`, `timeLeft` (0-1), `timeLimitMs`, `selectedId?`, `correctId?`, `onAnswer`, `timerLabel`, `hideTimer?` | Tarjeta de pregunta: chip de categoría con icono, distintivo opcional ("Actualidad"), barra de tiempo, enunciado y respuestas. Se bloquea al elegir o al llegar `correctId`. Colores: correcta `bg-ok`, fallo elegido `bg-ko` con sacudida, elegida sin revelar `ring-accent`. Teclas `1`-`n` responden. `hideTimer` lo usa el duelo relámpago (tiene su reloj). La barra es una animación CSS continua que se congela al responder. |
| [`TitleIcon`](../../apps/web/src/components/title-icon.tsx) | `level: TitleLevel`, `size=24`, `className` | Icono de cada título de nivel (1, 5, 10... 50): huevo, larva, ajolote, nenúfar, cerebro, birrete, libro, bombilla, corona, medalla, bola de cristal. |

## Piezas visuales dentro de las features

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| `Avatar` | [profile/avatar.tsx](../../apps/web/src/features/profile/avatar.tsx) | 6 paletas por 3 accesorios opcionales (gafas, lazo, gorra) = 12 avatares. Las claves deben coincidir con `public.avatars.id`; un id desconocido dibuja `axolotl-pink`. |
| `AnswerFeedback` | [game/answer-feedback.tsx](../../apps/web/src/features/game/answer-feedback.tsx) | Pegatina tras responder. Según `speedTier(points)`: normal (`ok`), rápido (`play`, 8 destellos), muy rápido (`accent`, sacudida, destello de pantalla y 14 estrellas). Fallo y tiempo agotado: pegatina `ko` que cae como un sello. Muestra "Acierta el X %" si llega `hitRate`. Suena y vibra al pintar (`useLayoutEffect`). |
| `MatchOutcome`, `useOutcomeOnce` | [game/match-outcome.tsx](../../apps/web/src/features/game/match-outcome.tsx) | Finales animados (sección siguiente). |
| `XpGain`, `XpBar`, `LevelCard`, `LevelBadge` | [progress/](../../apps/web/src/features/progress) | "+N XP" con barra animada y pegatina "¡Nivel X!" (con sonido `levelUp` a los 1,3 s); caja de nivel del perfil con `TitleIcon`; insignia `bg-play` junto al nombre (con texto `sr-only` completo). |
| `DailySquares` | [daily/daily-squares.tsx](../../apps/web/src/features/daily/daily-squares.tsx) | Cuadritos del reto: acierto relleno del color de la categoría, fallo apagado con borde de color. |
| `CategoryStats` | [stats/category-stats.tsx](../../apps/web/src/features/stats/category-stats.tsx) | Una fila por categoría con barra en su color; etiquetas "fuerte" y "punto débil". |
| `PresenceDot` | [live/presence-dot.tsx](../../apps/web/src/features/live/presence-dot.tsx) | Punto verde (en línea) o rosa (jugando); desconectado no se pinta. |
| `SegmentedPicker`, `DifficultyPicker` | [game/difficulty-picker.tsx](../../apps/web/src/features/game/difficulty-picker.tsx) | Opciones excluyentes como grupo de radios con aspecto de botones. |
| `ReportQuestion` | [game/report-question.tsx](../../apps/web/src/features/game/report-question.tsx) | Botón "reportar" que abre los cuatro motivos. |
| `NotificationToasts` | [notifications/notification-toasts.tsx](../../apps/web/src/features/notifications/notification-toasts.tsx) | Avisos arriba (máximo 3 a la vez, 6 s cada uno; la invitación en vivo dura lo que le quede de sus 30 s y lleva botones Aceptar y Rechazar). |
| `HomeIntro` | [home/home-intro.tsx](../../apps/web/src/features/home/home-intro.tsx) | Mascota flotando, título con "Ajolote" en `accent` y subtítulo. |

## Mascota

[Mascot](../../apps/web/src/components/mascot.tsx) es un SVG de `viewBox 100`. Sus piezas son funciones que devuelven SVG (no componentes) porque el icono de la app lo dibuja `ImageResponse`, que solo admite elementos SVG. Las variantes `party`, `tired`, `bored` y `knight` usan `var(--color-*)` para algunos trazos: solo `default` (colores fijos) es seguro dentro de `ImageResponse`, y es la única que se usa allí (iconos de la app y [imagen del reto diario](../../apps/web/src/features/daily/daily-image.tsx)). Mascota y avatares son provisionales, a la espera de arte definitivo.

## Finales de partida animados

[`MatchOutcome`](../../apps/web/src/features/game/match-outcome.tsx) pinta a pantalla completa el final de una partida con rival. Cuándo sale cada uno (umbrales, modos) está en [game-core.md](game-core.md); aquí, cómo se ve.

| `kind` | Mascota | Título | Extra |
| --- | --- | --- | --- |
| `victory` | `party`, saltos con meneo | `bg-play` | 48 piezas de confeti con los siete colores de categoría |
| `defeat` | `tired`, respiración agitada | `bg-surface-2` | Subtítulo `Outcome.defeatSub` |
| `draw` | `bored`, balanceo | `bg-surface-2`, cae torcido | Sin subtítulo |
| `legendaryDraw` | `knight`, con el icono de espadas detrás | `bg-accent`, tiembla | 14 destellos y fondo con degradado dorado; subtítulo `Outcome.legendarySub` |

- Props: `kind: OutcomeKind` (de `game-core`), `names?: string[]` (en local, quién gana o quiénes empatan; se une con `Intl.ListFormat` y sustituye al subtítulo) y `onDone`.
- Es un botón que cubre la pantalla (`autoFocus`): tocar, Enter o Espacio lo cierra. Se cierra solo a los 3,6 s (`SHOW_MS`) y suena `playSound(kind)` al montarse. Con movimiento reducido no hay confeti, destellos ni entradas animadas.
- **`useOutcomeOnce(key)`** hace que salga una sola vez por partida y dispositivo: guarda `trivia:outcome-seen:<key>` en `localStorage` (claves `duel:<id>`, `live:<id>`, `quick:<id>` y `daily:<id>`). Devuelve `showing`, `afterOutcome` (se puede enseñar lo que va después, p. ej. la XP) y `dismiss`. Sin `localStorage` (modo privado) se muestra siempre.

## Sonido y vibración

[`sfx.ts`](../../apps/web/src/features/game/sfx.ts) sintetiza todo con Web Audio, sin archivos. Un motor único (`AudioContext` de baja latencia, compresor final, ganancia 0,55 y una reverberación corta hecha con ruido) se crea al cargar el módulo en el navegador y se reanuda con el primer `pointerdown` o `keydown`. Las notas son de marimba (cálida), campana (brillante) y golpes de madera (ruido filtrado).

| Sonido | Cuándo suena |
| --- | --- |
| `correct`, `fast`, `veryFast` | Acierto normal, rápido y muy rápido (`AnswerFeedback`). |
| `wrong`, `timeout` | Fallo y tiempo agotado (`AnswerFeedback`, que además vibra `[60, 40, 60]`). |
| `tick` | Últimos 3 s de cada pregunta (`useQuestionTimer`) y, en el relámpago, cuenta atrás y últimos 10 s. |
| `spin` | Giro de la ruleta del duelo (trinquete que se espacia durante 3,1 s). |
| `win` | Resultados de una partida rápida en solitario (cada vez que se muestran) y del reto diario (solo la primera vez en el dispositivo, con `useOutcomeOnce`). |
| `levelUp` | Subida de nivel (`XpGain`). |
| `victory`, `defeat`, `draw`, `legendaryDraw` | Cada final de `MatchOutcome`. |

`playSound(name)` no hace nada si el sonido está apagado y `vibrate(pattern)` solo actúa si la vibración está activada y el navegador la admite (Android sí, iPhone no). La vibración solo se usa al fallar o agotarse el tiempo.

## Preferencias del dispositivo

[`preferences.ts`](../../apps/web/src/features/preferences/preferences.ts) y [`DevicePreferences`](../../apps/web/src/features/preferences/device-preferences.tsx) (en el perfil, sección "En este dispositivo") guardan lo que no es de la cuenta:

| Preferencia | Dónde se guarda | Efecto |
| --- | --- | --- |
| Tamaño de texto (`normal`, `large`, `xlarge`) | Cookie `TEXT_SIZE` (1 año, `path=/`, `samesite=lax`) | El layout raíz la lee y pone `data-text-size` en `<html>`: el servidor ya pinta el tamaño elegido, sin parpadeo. `setTextSize` actualiza cookie y atributo al instante. |
| Sonidos | `localStorage` `pref:sound` (`on`/`off`) | Activados salvo que se apaguen. |
| Vibración | `localStorage` `pref:vibration` (`on`/`off`) | Activada por defecto; la casilla solo aparece si `"vibrate" in navigator`. |

Los accesos a `localStorage` van en `try/catch` (puede fallar en modo privado) y se leen tras montar.

## Accesibilidad

- **Teclado:** las teclas `1`-`n` responden en `QuestionCard` (escucha `keydown` en `window` mientras no se ha respondido; ignora Ctrl, Meta y Alt). Al revelar la respuesta, el botón "Siguiente" del modo rápido y del duelo por turnos recibe `autoFocus`, así que Enter continúa. Los selectores son grupos de radios navegables (la casilla real es `sr-only` y el foco se ve con `peer-focus-visible:ring`).
- **Tamaño de texto:** tres niveles (arriba).
- **Movimiento reducido:** `useReducedMotion` de Motion en `Wheel`, `QuestionCard`, `AnswerFeedback`, `MatchOutcome`, `XpBar`, `XpGain` y `HomeIntro`. Las animaciones solo CSS (barra de tiempo, transiciones del reloj) no lo respetan.
- **Más que color:** icono de categoría en chips, ruleta, cuadritos y estadísticas; texto `sr-only` en `DailySquares` y `LevelBadge`.
- **ARIA:** `role="progressbar"` con `aria-valuenow` (barra de tiempo, XP, estadísticas), `role="timer"` en el reloj, `aria-live="polite"` en el feedback y la pegatina de nivel, `role="status"` en los avisos, `role="alert"` en los errores, `aria-label` en los botones solo de icono y `aria-hidden` en los SVG decorativos.
- **Foco visible** global (`:focus-visible`) y zoom del navegador sin restringir.

## `/dev/ui`

[showcase.tsx](../../apps/web/src/app/dev/ui/showcase.tsx) enseña los componentes con datos de ejemplo (en español, sin i18n a propósito): botones en sus cuatro variantes y desactivado; `QuestionCard` con reinicio; `Wheel` con botón "Girar" (resultado al azar solo en el muestrario); `AnswerFeedback` en normal, rápido, muy rápido y fallo; `DailySquares` en tres tamaños; `CategoryStats`; `XpGain` (sin subir, sube, título nuevo), `LevelCard`, `LevelBadge` y los 11 `TitleIcon`; `AnalogClock` con deslizador; los finales (victoria, derrota, empate, empate legendario y las variantes en local); y los 12 avatares. Si añades una pieza visual compartida, enséñala aquí. Solo existe en desarrollo y exige sesión ([web.md](web.md)).

## Detalles a tener en cuenta

- **Valores duplicados fuera de `globals.css`.** `ImageResponse` no lee variables CSS, así que hay copias a mano que no cambian solas con los tokens: [`BRAND_BG`](../../apps/web/src/features/pwa/brand-icon.tsx#L6) (`#0b2735`, igual que `--color-bg`), que también usan el manifest y `themeColor`; las [constantes de `daily-image.tsx`](../../apps/web/src/features/daily/daily-image.tsx#L7); los colores de la mascota y los avatares; y los siete colores de categoría del confeti ([`CONFETTI_COLORS`](../../apps/web/src/features/game/match-outcome.tsx#L14)), que repiten los de la tabla `categories`.
- **`showcase.tsx`** repite los colores de categoría y su [comentario inicial](../../apps/web/src/app/dev/ui/showcase.tsx#L21) ("en la Fase 2 vivirán en la tabla de categorías") está desfasado.
- **`avatar.tsx`** declara un [`<clipPath id="avatar-circle">`](../../apps/web/src/features/profile/avatar.tsx#L60) en cada avatar: con varios en pantalla el id se repite (funciona porque son idénticos, pero es HTML inválido).
- **`sfx.ts` crea el `AudioContext` al importarse** ([líneas 84-89](../../apps/web/src/features/game/sfx.ts#L84)), aunque el sonido esté apagado en las preferencias.
- **Sin estados `hover:`** y un solo tema (sin variante clara).
- **`SegmentedPicker`** vive en `features/game` aunque lo usen también amigos y preferencias.
