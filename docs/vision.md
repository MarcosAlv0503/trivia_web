# Proyecto: juego de trivia web (nombre provisional: `trivia-ajolote`)

Vamos a construir desde cero un juego de preguntas tipo trivia para web, pensado para monetizarse y para dar el salto a móvil a medio plazo. Lo desarrollamos dos personas en el mismo repositorio de GitHub. Lee todo este documento antes de empezar.

---

## 1. Visión del producto

- **Juego de trivia moderno, colorido y adictivo.** La referencia de experiencia es "Preguntados": ruleta de categorías, animaciones vistosas, feedback inmediato al acertar o fallar y partidas cortas. La identidad visual será **propia**: paleta distinta y nada copiado de otros juegos (ni assets, ni nombres, ni identidad visual). Los nombres "Trivial Pursuit" y "Preguntados" son marcas registradas y no pueden aparecer en el producto. Los modos tendrán nombres propios.
- **Mascota:** un ajolote, con diseño original.
- **Monetización (fases futuras):**
  - Suscripción premium que elimina los anuncios.
  - Microtransacciones para avatares, skins y otros cosméticos.
  - Dos monedas:
    - **Monedas**: se ganan jugando y con rachas, y compran objetos comunes.
    - **Gemas**: casi exclusivamente de pago, para contenido premium y skins llamativas.
  - **No habrá cajas de botín aleatorias de pago.** Todo se compra de forma directa, por la regulación española de loot boxes.
- **Cuenta obligatoria.** Login social con Google, Discord, Apple y Facebook.
- **Modos de juego, tanto en local como online:**
  - **Preguntas rápidas**: rondas cortas con temporizador.
  - **Modo duelo por turnos**: partidas asíncronas que pueden durar días, estilo ruleta de categorías.
  - **Modo tablero clásico**: inspirado en el trivial de mesa clásico.
  - Minijuegos que iremos añadiendo con el tiempo.
- **Juego local:**
  - Al principio se jugará en un solo dispositivo, pasándose el móvil o compartiendo el ordenador por turnos.
  - Los jugadores añadidos son **invitados**: solo tienen nombre y avatar, sin cuenta, y pertenecen a la cuenta del anfitrión.
  - En el futuro habrá un **modo TV**: una pantalla común muestra la partida y cada jugador responde desde su móvil, al estilo Kahoot o Jackbox.
- **Juego online:** contra amigos invitados y, más adelante, contra rivales aleatorios mediante emparejamiento.
- **Multidioma desde el día uno**, tanto la interfaz como las preguntas. Idiomas iniciales: español (por defecto) e inglés.
- **Categorías:**
  - Iniciales: Geografía, Historia, Ciencia y Naturaleza, Arte y Literatura, Entretenimiento, Deportes, y Tecnología.
  - En el futuro habrá más (música, política, videojuegos...) y modos con selección flexible de categorías. Por eso las categorías deben ser **datos en la base de datos**, no un enum en el código.
- **Preguntas generadas con IA**, mediante un proceso automatizado de creación y revisión que queda fuera de este repo por ahora. Más adelante habrá un panel de administración para editarlas a mano. La base de datos debe admitir importación masiva y un estado de revisión.

---

## 2. Cómo quiero que trabajes (obligatorio)

1. **Pregunta ante cualquier duda relevante de diseño, UX o jugabilidad.** Esto incluye reglas, tiempos, puntuaciones, economía, textos visibles, flujo de pantallas y estética. No inventes reglas de juego ni decisiones visuales importantes. Agrupa las preguntas y sé concreto, ofreciendo opciones con tu recomendación.
2. **En decisiones de backend e infraestructura, decide tú.** Elige la opción más lógica, segura y responsable según los objetivos de este documento y las decisiones ya tomadas. Explica la decisión en una o dos líneas en tu resumen. Si es una decisión estructural, añádela a la sección "Decisiones" de `CLAUDE.md`.
3. **Sigue la hoja de ruta y ciñete a la fase actual.**
   - Trabaja solo en las tareas de la fase en curso (sección 6), en orden.
   - Las fases futuras están descritas para que conozcas el rumbo del proyecto, no para que las implementes. No adelantes, prepares ni refactorices nada pensando en ellas.
   - Solo puedes intervenir en algo de una fase futura si es **necesario** para no bloquearla. Por ejemplo, una decisión de modelo de datos que sería muy costosa de cambiar después. En ese caso, limita la intervención a lo imprescindible y explícalo en el resumen.
   - Al terminar una fase, haz un resumen y espera mi confirmación antes de empezar la siguiente.
4. **Analiza constantemente en busca de errores y mejoras.** Mientras trabajas, revisa de forma crítica tanto el código nuevo como el que toques. Busca errores, fallos de seguridad, problemas de rendimiento e incoherencias con este documento o con `CLAUDE.md`. Actúa así:
   - **Errores dentro de la tarea actual:** corrígelos y menciónalos en el resumen.
   - **Errores fuera de la tarea o de la fase actual:** no los toques; repórtalos indicando dónde están y su gravedad.
   - **Mejoras menores dentro de la tarea** (claridad, tipado, nombres, pequeñas simplificaciones que no cambian comportamiento ni diseño): aplícalas directamente.
   - **Mejoras importantes** (nuevas funcionalidades, cambios de arquitectura o de dependencias, cambios que afecten a UX, jugabilidad u otra fase): **coméntamelas antes de implementarlas**, con el motivo, el coste aproximado y el impacto, y espera mi luz verde.

---

## 3. Stack técnico (decidido)

| Área | Elección |
|---|---|
| Frontend | **Next.js (App Router) + TypeScript (strict) + Tailwind CSS + Motion (Framer Motion)** |
| Backend | **Supabase**: Postgres, Auth, Realtime, Storage, Edge Functions |
| i18n | `next-intl` |
| Gestor de paquetes | `pnpm` con workspaces (monorepo) |
| Tests | Vitest, centrado en la lógica de juego y en la lógica crítica de servidor |
| CI | GitHub Actions: lint, typecheck, test y build en cada PR |
| Hosting | Vercel (web) y Supabase Cloud |
| Pagos (futuro) | Stripe en web, mediante una capa agnóstica del proveedor para añadir compras in-app de móvil (p. ej. RevenueCat) |
| Móvil (futuro) | Empaquetar la web (Capacitor) o app con Expo reutilizando la lógica compartida. Se decidirá en su momento |

Desarrollo local de Supabase con la **Supabase CLI** (`supabase start`, requiere Docker). Todas las migraciones van versionadas en `supabase/migrations` y los tipos de TypeScript se generan desde la base de datos.

---

## 4. Principios de arquitectura

- **Servidor autoritativo (anti-trampas):**
  - El cliente **nunca** recibe la respuesta correcta antes de contestar.
  - Las preguntas se sirven sin la marca de respuesta correcta.
  - Respuestas, puntuaciones, resultados de partida, monedas y gemas se validan y calculan en el servidor, con funciones de Postgres/RPC o Edge Functions.
  - El cliente solo muestra.
- **Seguridad en Supabase:**
  - RLS activado en **todas** las tablas, con políticas mínimas.
  - Nunca se expone la `service_role` key en el cliente.
  - Ningún secreto se sube al repo. Se usa `.env.example`.
- **Lógica de juego desacoplada:**
  - Las reglas de cada modo viven en `packages/game-core`, en TypeScript puro, sin React ni Supabase, y testeado.
  - Así se reutilizan en web, móvil y el futuro modo TV, y los modos local y online comparten reglas aunque cambie el "transporte": mismo dispositivo, base de datos o realtime.
- **Preparado para móvil:**
  - Diseño mobile-first.
  - Nada de lógica de negocio acoplada a APIs exclusivas del navegador o a Server Components cuando debería estar en el backend.
  - La web debe poder funcionar como PWA.
- **Economía (futuro):**
  - Saldos de monedas y gemas con un **registro de transacciones** (ledger).
  - Solo el servidor modifica saldos.
  - Las compras con dinero real solo se confirman vía webhook del proveedor de pago.
- **i18n:**
  - Ningún texto visible hardcodeado.
  - Las preguntas y respuestas tienen traducciones por idioma en la base de datos.
  - Si una pregunta no está disponible en el idioma del jugador, no se le muestra.
- **Preguntas:** cada pregunta tiene categoría, dificultad, estado (`draft`, `approved`, `rejected`), origen (`ai`, `manual`, `user`) y sus traducciones. Habrá un script de importación masiva (JSON) para alimentar la base de datos desde el proceso de IA.
- **Privacidad (RGPD):** mínimo de datos personales y posibilidad de borrar la cuenta. Esto último también lo exige Apple para publicar en la App Store.

---

## 5. Colaboración en GitHub (somos dos)

- `main` siempre estable. **Nunca** hagas commit ni push directo a `main`.
- Una rama por tarea: `feat/...`, `fix/...`, `chore/...`.
- PRs pequeñas y revisadas por el otro desarrollador.
- Commits pequeños y frecuentes con *Conventional Commits*.
- Al empezar cada sesión, comprueba la rama actual y sincroniza con `main` (`git pull` / rebase) para minimizar conflictos.
- Organiza el código por feature (`auth`, `profile`, `questions`, `game/quick`, `game/duel`...) para que cada uno trabaje en zonas distintas sin pisarse.
- Las migraciones de base de datos son la zona más sensible a conflictos. Créalas siempre con la CLI, con timestamp, nunca edites una migración ya mergeada, y avisa en el resumen cuando una tarea incluya migraciones.

---

## 6. Hoja de ruta

### Fase 0 — Cimientos (EMPEZAMOS AQUÍ)
- Monorepo con pnpm:
  - `apps/web` (Next.js)
  - `packages/game-core`
  - `supabase/`
- Configurar Next.js con TypeScript strict, Tailwind, Motion y `next-intl` (es/en).
- Configurar Supabase local y el cliente con `@supabase/ssr`.
- ESLint, Prettier, Vitest y CI de GitHub Actions.
- `.env.example` y un `README.md` breve con los pasos para que mi compañero levante el proyecto en local.
- Crear `CLAUDE.md` (ver tarea inmediata).

### Fase 1 — Cuentas y base visual
- Login social: Google y Discord primero. Apple y Facebook quedan preparados para cuando tengamos las cuentas de desarrollador.
- Perfil:
  - Nombre de usuario único.
  - Avatar elegido de un set básico.
  - Idioma preferido.
- Gestión de invitados locales (nombre y avatar).
- Sistema visual base: paleta, tipografía y componentes principales (botones, tarjetas de pregunta, ruleta), con la mascota ajolote como placeholder. **Pregúntame antes de fijar la estética.**

### Fase 2 — Preguntas y modo "Preguntas rápidas"
- Modelo de categorías, preguntas y traducciones.
- RPC segura para servir y validar preguntas.
- Seed pequeño de desarrollo en es/en.
- Script de importación JSON.
- Modo rápido **en solitario** y **local por turnos** con invitados: temporizador, puntuación y pantalla de resultados.
- Reglas en `game-core` con tests.

### Fase 3 — Online con amigos
- Sistema de amigos: buscar por nombre de usuario, solicitudes, lista.
- **Modo duelo por turnos asíncrono** contra un amigo, con partidas que duran días.
- Notificaciones dentro de la app cuando es tu turno.
- **Pregúntame las reglas exactas** antes de implementarlo: condiciones de victoria, tiempo máximo por turno, abandono, etc.

### Futuro (no implementar sin que lo pida)
- Emparejamiento con rivales aleatorios y partidas rápidas online en tiempo real.
- Modo tablero clásico.
- Monedas, gemas, tienda, cosméticos y skins.
- Stripe: suscripción sin anuncios y compras sueltas.
- Anuncios con consentimiento de cookies.
- Rachas, niveles, logros y rankings.
- Panel de administración de preguntas y pipeline de generación y revisión con IA.
- Nuevas categorías y modos con categorías flexibles.
- Minijuegos.
- Modo TV con móviles como mando.
- App móvil y notificaciones push.

---

## 7. Tarea inmediata

1. Crea `CLAUDE.md` en la raíz con una versión **condensada** de este documento: visión, reglas de trabajo (sección 2), stack, principios de arquitectura, flujo Git, fase actual y una sección vacía "Decisiones". Es la referencia permanente para las sesiones de ambos desarrolladores.
2. Antes de escribir el resto del código de la Fase 0, muéstrame en pocas líneas la estructura de carpetas y las dependencias que vas a instalar, y hazme las preguntas que necesites. Espera mi confirmación.
3. Ejecuta la Fase 0 en una rama `chore/setup` y termina con un resumen breve.
