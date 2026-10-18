---
name: questions-review
description: Revisa preguntas (nuevas, reportadas por estadísticas, de actualidad a punto de caducar y una muestra de las aprobadas) y las aprueba, corrige o rechaza. Pensado para ejecutarse programado.
argument-hint: "[cantidad=15]"
disable-model-invocation: true
allowed-tools: Bash(pnpm -s questions *) WebSearch WebFetch Read Edit(./.content/**) Write(./.content/**)
---

Revisa preguntas del juego siguiendo `.claude/skills/questions-generate/criteria.md` (léelo antes de empezar). Trabaja sin pedir confirmación: es una tarea desatendida. Argumentos: `$ARGUMENTS` (cantidad, por defecto 15).

Las preguntas se aprueban solas. Una persona solo revisa las dudas muy serias que dos revisiones independientes no resuelven.

1. Ejecuta `pnpm -s questions to-review <cantidad>` y lee `.content/to-review.json`. Cada pregunta trae `reason` (por qué se revisa), sus traducciones y sus estadísticas de juego.
2. **Primera revisión de cada pregunta:**
   - Comprueba con búsqueda web cualquier dato del que no estés completamente seguro. Hazlo **siempre** con las de actualidad y con las que traen motivos de estadísticas.
   - Con motivo de estadísticas, busca la causa: la correcta está mal, una incorrecta también es defendible, la dificultad está mal puesta…
   - Con "caduca pronto", decide si sigue siendo cierta y relevante: renuévala (`expiresAt` = hoy + 90 días) o recházala.
   - Revisa también cada traducción: mismo significado, `correct` correcta y el **mismo orden** de `wrong`.
3. **Veredicto** de cada pregunta:
   - `approve`: cumple los criterios.
   - `approve` con `fixed`: tiene un fallo que se corrige con seguridad (redacción, una incorrecta discutible, dificultad, traducción). Corrige todos los idiomas afectados.
   - `reject`: falsa, ambigua sin arreglo, fuera de los criterios o de actualidad que ya no vale.
   - **duda**: no puedes determinar con seguridad si la respuesta correcta es correcta y única, ni siquiera tras buscar. Un fallo de estilo nunca es duda: se corrige.
4. **Segunda revisión, solo para las dudas.** Lanza un subagente (herramienta Agent) por cada duda. Pásale **solo** la pregunta (enunciado y respuestas) y la ruta de los criterios, nunca tu veredicto ni tus razones, para que sea independiente. Pídele que investigue con búsqueda web y devuelva `approve`, `reject` o `duda` con una frase de motivo.
   - Si resuelve con claridad, aplica su veredicto.
   - Si también duda, el veredicto es `human` y la nota resume las dos dudas.
5. **Escribe** `.content/reviews.json`, un array con un objeto por pregunta:
   ```json
   {
     "externalId": "…",
     "verdict": "approve | reject | human",
     "note": "motivo breve (obligatorio en reject y human)",
     "expiresAt": "solo al renovar una de actualidad (ISO 8601)",
     "fixed": {
       "difficulty": "solo si cambia",
       "translations": { "es": { "prompt": "…", "correct": "…", "wrong": ["…", "…", "…"] } }
     }
   }
   ```
   En `fixed.translations` incluye solo los idiomas que cambian: los demás se conservan.
6. **Aplica** con `pnpm -s questions apply-reviews .content/reviews.json`.
7. **Termina** con un resumen de una línea: aprobadas, corregidas, rechazadas y enviadas a revisión humana.
