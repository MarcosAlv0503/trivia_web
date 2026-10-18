# Procesos de preguntas: cómo ejecutarlos y cómo modificarlos

Esta guía explica cómo se crean, traducen y revisan las preguntas del juego de forma automática con Claude Code, sin la API de pago. También explica qué tocar para cambiar su comportamiento en el futuro.

---

## 1. Qué hay y cómo encaja

Hay tres procesos. Cada uno es un _skill_ de Claude Code (un archivo de instrucciones que se lanza con `/nombre`):

| Proceso | Comando | Qué hace |
| --- | --- | --- |
| Generar | `/questions-generate` | Crea preguntas nuevas **en español** y las importa como **borrador**. Las de actualidad las busca en la web. |
| Revisar | `/questions-review` | Aprueba, corrige o rechaza preguntas. Si duda, pide una segunda revisión independiente; si la duda persiste, la deja para una persona. |
| Traducir | `/questions-translate` | Traduce al inglés las preguntas **aprobadas** que aún no existen en inglés. |

Cada proceso se reparte el trabajo así:

- **Claude** decide: escribe, juzga y traduce, siguiendo las instrucciones del skill.
- **`scripts/questions.mts`** hace la parte mecánica: lee y escribe la base de datos. Se usa con `pnpm questions <comando>`.
- **La base de datos** valida todo lo que entra: formato, respuestas repetidas, categorías existentes…

### Vida de una pregunta

```text
generar ──► borrador ──► revisar ──┬──► aprobada ──► traducir ──► aprobada en es + en
                                   ├──► rechazada
                                   └──► duda ──► 2.ª revisión ──┬──► aprobada / rechazada
                                                                └──► borrador con "needs_human" (la revisa una persona)
```

- Solo se juegan las preguntas **aprobadas y sin caducar**.
- Las de **actualidad** caducan a los 90 días, salvo que se indique otra fecha. La revisión las renueva o las rechaza antes de que caduquen.
- Una pregunta solo se muestra a quien juega en un idioma en el que existe. En un duelo, tiene que existir en los idiomas de los dos jugadores.
- La revisión vuelve a mirar las preguntas aprobadas:
  - cuando sus estadísticas de juego son raras (una incorrecta se elige más que la correcta, o el porcentaje de acierto no cuadra con la dificultad);
  - cuando una de actualidad está a punto de caducar;
  - y en una muestra periódica.

### Archivos

| Archivo | Para qué |
| --- | --- |
| `.claude/skills/questions-generate/SKILL.md` | Pasos del proceso de generación |
| `.claude/skills/questions-review/SKILL.md` | Pasos del proceso de revisión |
| `.claude/skills/questions-translate/SKILL.md` | Pasos del proceso de traducción |
| `.claude/skills/questions-generate/criteria.md` | **Criterios de calidad comunes a los tres procesos** |
| `scripts/questions.mts` | Comandos `pnpm questions …` y umbrales de revisión |
| `scripts/lib/supabase-admin.mts` | Conexión a Supabase con la clave secreta |
| `supabase/migrations/20261018150834_question_pipeline.sql`, `…151706_question_untranslatable.sql` y `…173937_question_reports_and_admin.sql` | Funciones de la BD: `import_questions`, `export_questions`, `review_questions`, `mark_untranslatable`, `is_playable`, reportes y panel |
| `.content/` | Archivos de trabajo de cada ejecución. **Ignorada por git.** |

> ⚠️ **El repositorio es público.** Las preguntas llevan sus respuestas, así que **nunca** se suben al repo: los procesos escriben en la base de datos, y sus archivos temporales van a `.content/`. El único contenido en el repo es el seed de desarrollo (`supabase/seed/questions.json`).

---

## 2. Requisitos (una sola vez)

1. **Claude Code con tu cuenta de claude.ai (plan Pro).**
   - Sirve la extensión de VS Code, la app de escritorio o la terminal.
   - Comprueba con `/status` que la sesión usa tu suscripción y no una clave de API.
   - Si la variable de entorno `ANTHROPIC_API_KEY` está definida, Claude Code la usa en lugar de la suscripción y **cobra por tokens**. Bórrala.
2. **Supabase local en marcha:** Docker Desktop abierto y `pnpm db:start`. Con `pnpm questions status` compruebas que el script conecta.
3. Las dependencias instaladas (`pnpm install`): el script usa la CLI de Supabase del proyecto.

Los procesos consumen el **uso de tu plan**, igual que una conversación normal. El consumo se ve en <https://claude.ai/settings/usage>. Si llegas al límite, la ejecución se detiene hasta que se renueva tu ventana de uso. No se pierde nada: lo ya importado queda en la BD.

---

## 3. Ejecutarlos a mano

En el chat de Claude Code, con la carpeta del repo abierta, escribe el comando. Si no aparece al escribir `/`, abre una conversación nueva: los skills se cargan al empezarla.

```text
/questions-generate                          # elige solo qué hace falta (lo dice `pnpm questions status`)
/questions-generate science                  # 20 preguntas de Ciencia, repartidas entre las tres dificultades
/questions-generate history hard 10          # 10 preguntas difíciles de Historia
/questions-generate actualidad 10            # 10 de actualidad (busca noticias en la web)

/questions-review                            # revisa 15
/questions-review 30                         # revisa 30

/questions-translate                         # traduce 30 al inglés
/questions-translate en 50                   # traduce 50 al inglés
```

- **Categorías:** `geography`, `history`, `science`, `art-literature`, `entertainment`, `sports`, `technology`.
- **Dificultades:** `easy` (fácil), `medium` (normal), `hard` (difícil).

**Orden recomendado: generar → revisar → traducir.** Lo generado no se juega hasta que se aprueba, y solo se traduce lo aprobado.

Cada proceso termina con un resumen de una línea (cuántas ha creado, aprobado, traducido…).

### Desde la terminal (opcional)

Con la CLI de Claude Code instalada (guía oficial: <https://code.claude.com/docs/en/setup>), se puede lanzar un proceso sin abrir el chat:

```sh
claude -p "/questions-review 15" --allowedTools "Bash(pnpm -s questions *),WebSearch,WebFetch,Read,Edit,Write,Agent"
```

Así también puedes programarlo con el Programador de tareas de Windows, en lugar de usar la app de escritorio (apartado 4).

---

## 4. Que se ejecuten solos (tareas programadas)

Se usan las **tareas locales** de la app **Claude Code Desktop**. Se ejecutan en tu ordenador, con acceso a la BD local. Las rutinas en la nube no ven tu BD local; se usarán cuando exista producción (apartado 7).

### Crear cada tarea

1. En la app de escritorio: pestaña **Code** → **Routines** → **New routine** → **Local**.
2. Rellena:
   - **Name:** p. ej. `preguntas-generar`.
   - **Instructions:** el comando, p. ej. `/questions-generate`.
   - **Modelo:** el selector de la instrucción.
     - Opus razona mejor (recomendado para revisar).
     - Sonnet consume menos cuota (suficiente para generar y traducir).
   - **Carpeta:** la del repo (`trivia_web`).
   - **Worktree:** **desactivado.** Una copia aislada del repo no tiene `node_modules`, y el script no podría conectar con Supabase.
   - **Schedule:** ver la tabla de abajo.
3. Pulsa **Run now** una vez y quédate mirando. Cada vez que pida permiso para un comando o herramienta, elige **always allow**. Las siguientes ejecuciones ya no preguntarán. Si no lo haces, una ejecución programada se quedará parada esperando tu permiso.

### Calendario recomendado (ajústalo a tu cuota)

| Tarea | Instrucción | Cuándo |
| --- | --- | --- |
| `preguntas-generar` | `/questions-generate` | Diaria, 10:07 |
| `preguntas-revisar` | `/questions-review` | Diaria, 12:07 |
| `preguntas-traducir` | `/questions-translate` | Diaria, 14:07 |

- Usa minutos que no sean en punto: las tareas programadas en punto pueden arrancar varios minutos tarde.
- Deja tiempo entre tareas, para que la revisión vea lo recién generado y la traducción lo recién aprobado.
- Con 20 preguntas al día, llegar a 1.500 lleva meses. Si te sobra cuota, añade más ejecuciones de generación o sube la cantidad (`/questions-generate 40`). Sube la revisión al mismo ritmo, o se acumularán borradores.

### Cómo se comportan

- Solo se ejecutan con **la app abierta y el ordenador despierto**. Si estaba dormido, al despertar se hace **una** ejecución de recuperación (no una por cada vez perdida).
- Para que el ordenador no se suspenda solo: **Settings → This computer → System → Keep computer awake**. Cerrar la tapa del portátil lo duerme igualmente.
- Cada ejecución aparece en la barra lateral, en **Scheduled**: ahí ves qué ha hecho y respondes permisos pendientes.
- Pausar o reanudar: interruptor **Active / Paused** en el detalle de la tarea.

---

## 5. Comprobar los resultados

```sh
pnpm questions status
```

Muestra, por categoría y dificultad:

- aprobadas, borradores y pendientes de revisión humana;
- cuántas de actualidad están vigentes;
- cuántas aprobadas faltan por traducir;
- y qué conviene generar a continuación.

Para ver las preguntas en sí: **Supabase Studio** local (<http://127.0.0.1:54323>) → Table Editor → `questions` (y `question_translations` para los textos). Las columnas útiles son `status`, `topical`, `expires_at`, `needs_human`, `review_note` y `reviewed_at`.

---

## 6. Revisión humana: el panel `/admin`

Las preguntas que dos revisiones no resolvieron quedan en borrador con `needs_human = true` y el motivo en `review_note`. No se juegan. Se revisan en el **panel de revisión** de la web (`/admin`, enlace al final del perfil), que muestra:

- las pendientes de revisión humana, primero;
- las que tienen **reportes de jugadores** sin resolver, con el motivo y el idioma en que se vieron.

Para cada una: **Aprobar**, **Rechazar** o **Corregir** (cambiar textos y dificultad, y aprobar). Las correcciones pasan las mismas validaciones que la importación. Cualquier veredicto, del panel o de `/questions-review`, cierra los reportes de esa pregunta.

Solo pueden entrar los administradores (README > "Panel de revisión"). Sin panel a mano, el camino antiguo sigue sirviendo: Claude escribe `.content/human.json` con tus veredictos en el formato de la revisión y ejecuta `pnpm questions apply-reviews .content/human.json`.

### Reportes de jugadores

Al ver la respuesta correcta, el jugador puede pulsar **Reportar pregunta** y elegir un motivo: `wrong_answer` (la correcta está mal), `ambiguous` (confusa o con varias válidas), `typo` (errata o mala traducción) u `offensive`. Un reporte por jugador y pregunta, y como mucho 30 al día por cuenta.

Una pregunta reportada **sigue jugándose**: la siguiente ejecución de `/questions-review` la revisa la primera (motivo `reportada: …`). Si la revisión automática duda, pasa a revisión humana como cualquier otra.

---

## 7. Producción (cuando exista)

Por defecto el script usa **Supabase local**. Usa otro proyecto solo si en el entorno donde corre Claude Code están definidas:

```sh
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_SECRET_KEY=<clave secreta>   # nunca en el repo, nunca en el cliente
```

Con ellas definidas, **todo** lo que hagan los procesos va a ese proyecto. Cuando se monte producción (tarea 6 de la Fase 4) se decidirá dónde viven estas variables. Lo previsto es usar rutinas en la nube, con la clave como secreto de la rutina, para no depender de tu ordenador. Este documento se actualizará entonces.

---

## 8. Cómo modificar los procesos

### Dónde está cada cosa

| Quiero cambiar… | Dónde |
| --- | --- |
| Qué hace buena una pregunta (forma, temas vetados, estilo de idioma, definición de cada dificultad, reglas de actualidad) | `.claude/skills/questions-generate/criteria.md` (lo leen los tres procesos) |
| Los pasos de un proceso (qué busca, cómo decide, qué escribe) | El `SKILL.md` de ese proceso |
| La cantidad por defecto de cada ejecución | El texto del `SKILL.md` (20 / 15 / 30) **y**, para revisar y traducir, el valor por defecto en `scripts/questions.mts` (`to-review`, `to-translate`) |
| Qué preguntas aprobadas se vuelven a revisar | `reviewReason()` y las constantes `EXPECTED_HIT_RATE`, `MIN_ANSWERS_FOR_STATS` y `EXPIRY_WARNING_DAYS` en `scripts/questions.mts` |
| La proporción de preguntas de actualidad (10 %) | `TOPICAL_SHARE` en `scripts/questions.mts` |
| Cuándo una duda llega a una persona | Pasos 3 y 4 de `.claude/skills/questions-review/SKILL.md` |
| Los 90 días de caducidad | Ver "Cambiar la caducidad" |
| Añadir un idioma | Ver "Añadir un idioma" |
| Añadir una categoría | Ver "Añadir una categoría" |

Los tres `SKILL.md` empiezan con una cabecera (`---`). Su línea `allowed-tools` lista los comandos y herramientas que el proceso puede usar sin pedir permiso. **Si cambias un skill para que use un comando o herramienta nuevos, añádelo ahí**, o las ejecuciones programadas se pararán a pedir permiso.

### Cambiar los criterios o los pasos

Es texto en lenguaje natural: edítalo directamente. Sé concreto ("como mucho 100 caracteres", "nunca preguntes por…"), porque el proceso lo sigue al pie de la letra. Los criterios de `criteria.md` afectan a los tres procesos a la vez.

### Cambiar la caducidad (90 días)

1. **Base de datos:** el valor por defecto lo pone la función `import_questions` (`interval '90 days'`). Crea una migración nueva con `pnpm exec supabase migration new caducidad_actualidad`. Copia en ella la versión más reciente de `import_questions` (está en `20261018150834_question_pipeline.sql`) como `create or replace function`, cambiando solo el intervalo. **Nunca edites una migración ya subida.**
2. **Textos:** cambia "90 días" en `criteria.md`, en el paso 2 de `questions-review/SKILL.md` ("hoy + 90 días"), en el `README.md` y en `CLAUDE.md`.
3. `pnpm db:test`.

### Añadir un idioma (p. ej. `pt`)

Un idioma nuevo afecta a la web entera: `CLAUDE.md` exige que ningún texto visible quede sin traducir. Pasos:

1. **Migración** (`pnpm exec supabase migration new idioma_pt`). Amplía estas restricciones, que hoy solo admiten `es` y `en`. Para cada una, `drop constraint` y vuelve a crearla con el idioma nuevo:

   | Tabla | Restricción |
   | --- | --- |
   | `profiles` | `profiles_locale_check` |
   | `category_translations` | `category_translations_locale_check` |
   | `question_translations` | `question_translations_locale_check` |
   | `quick_matches` | `quick_matches_locale_check` |
   | `duel_plays` | `duel_plays_locale_check` |
   | `questions` | `questions_untranslatable_check` (columna `untranslatable`) |
   | `question_reports` | `question_reports_locale_check` |

2. **Nombres de las categorías** en el idioma nuevo: en la misma migración, un `insert` en `category_translations` por categoría. Sin ellos, las preguntas de esa categoría no se sirven en ese idioma.
3. **Web:**
   - `apps/web/src/i18n/config.ts`: añade el idioma a `locales` y su nombre a `LOCALE_NAMES` ("Português").
   - Crea `apps/web/messages/pt.json` con **todas** las claves de `en.json`, traducidas.
4. **Script:** `scripts/questions.mts`, en `status()`, añade el idioma a la lista `["es", "en"]` para ver cuántas faltan por traducir.
5. **Skills:**
   - En `questions-translate/SKILL.md`, añade el idioma a la lista de admitidos.
   - En `criteria.md`, añade a la sección "Forma" cómo debe sonar ese idioma (variante, registro).
6. `pnpm db:types`, `pnpm db:test`, `pnpm typecheck` y `pnpm build`.
7. Traduce el contenido existente con `/questions-translate pt`. Hasta que esté traducido, quien juegue en ese idioma no tendrá preguntas suficientes.

### Añadir una categoría

Las categorías son **datos en la BD**, nunca un enum en código. Su nombre y su color son decisiones de diseño, así que confírmalos antes.

1. **Migración:** `insert` en `categories` (id en minúsculas con guiones, color `#RRGGBB` y `sort_order`), y en `category_translations` su nombre en **cada** idioma.
2. **Skills:** añade el id a la lista de categorías de `criteria.md` y a la del paso 1 de `questions-generate/SKILL.md`.
3. Genera sus preguntas: `/questions-generate <id>`.

### Añadir campos a las preguntas

Por ejemplo, el futuro texto "¿Sabías que…?". Hace falta:

1. Una migración con la columna nueva y versiones nuevas de `import_questions` y `export_questions` que la lean y la devuelvan.
2. En `scripts/questions.mts`: el tipo `Question` y la función `importable()`, si el campo debe reimportarse.
3. Los ejemplos JSON de los `SKILL.md` y la regla en `criteria.md`.

### Después de cualquier cambio

1. **Prueba con poco:** `/questions-generate science easy 3`, luego `/questions-review 3`, y comprueba el resultado con `pnpm questions status` o en Studio.
2. Si cambiaste SQL: `pnpm db:test`. Si cambiaste código: `pnpm typecheck`.
3. Commit pequeño (`feat(questions): …` o `fix(questions): …`). Las tareas programadas usan los archivos de la carpeta tal cual están, así que el cambio se aplica en la siguiente ejecución.

---

## 9. Reglas que no hay que romper

- **Nada de preguntas reales en el repo** (es público). Nunca hagas commit de `.content/`.
- **La clave secreta de Supabase nunca va al repo** ni a la web.
- **Lo generado entra siempre como borrador.** `pnpm questions import` borra cualquier `status` del archivo a propósito: no quites esa protección.
- **La traducción conserva el orden de las respuestas incorrectas.** Las estadísticas de revisión cuentan las respuestas por su posición.
- **Nunca se edita una migración ya subida:** los cambios de SQL van siempre en una migración nueva.
- **Sin `ANTHROPIC_API_KEY` en el entorno**, o los procesos se cobrarán por tokens en lugar de usar el plan.

---

## 10. Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| `/questions-…` no aparece | Abre una conversación nueva en la carpeta del repo: los skills se cargan al empezarla. |
| Error al ejecutar `pnpm questions …` (falla `supabase status`) | Supabase local no está en marcha: abre Docker Desktop y ejecuta `pnpm db:start`. |
| Una tarea programada no termina | Está esperando un permiso: ábrela en **Scheduled**, aprueba con **always allow** y no volverá a pedirlo. |
| Una tarea no se ejecutó | El ordenador estaba dormido o la app cerrada (ver apartado 4). Al volver se hace una ejecución de recuperación. |
| La ejecución se corta a medias | Has llegado al límite de uso del plan. Lo ya importado se conserva; baja la cantidad o la frecuencia. |
| `pregunta <id>: …` al importar | Esa pregunta no pasa la validación de la BD (respuestas repetidas, categoría inexistente…). **No se ha importado nada de ese lote.** Corrige el archivo de `.content/` y repite el comando que falló. |
| En el juego: "no hay suficientes preguntas" | Faltan aprobadas de esa dificultad e idioma: `pnpm questions status`, y genera y revisa más. |
