---
name: questions-translate
description: Traduce las preguntas aprobadas que aún no existen en un idioma y las importa. Pensado para ejecutarse programado.
argument-hint: "[idioma=en] [cantidad=30]"
disable-model-invocation: true
allowed-tools: Bash(pnpm -s questions *) Read Edit(./.content/**) Write(./.content/**)
---

Traduce preguntas del juego. Trabaja sin pedir confirmación: es una tarea desatendida. Argumentos: `$ARGUMENTS`. Idioma de destino por defecto `en` (los admitidos son `es` y `en`); cantidad por defecto 30.

1. Ejecuta `pnpm -s questions to-translate <idioma> <cantidad>` y lee el archivo que indica.
2. Para cada pregunta, escribe la traducción al idioma de destino siguiendo `.claude/skills/questions-generate/criteria.md`:
   - Traducción natural, no literal, con el mismo significado y la misma dificultad.
   - **Conserva el orden de `wrong`** (las estadísticas cuentan las respuestas por su posición) y que `correct` siga siendo la correcta.
   - Nombres propios con su forma habitual en ese idioma (p. ej. "Londres" → "London").
   - Si la pregunta solo tiene sentido en el idioma original (juego de palabras, cultura muy local que un jugador de ese idioma no podría saber), **no la traduzcas**: anota su `externalId` como no traducible.
3. Escribe `.content/translated-<idioma>.json`: el mismo array de entrada, pero en cada objeto `translations` lleva **solo** el idioma de destino (el original no se toca), y sin las no traducibles.
4. Escribe `.content/untranslatable-<idioma>.json` con el array de `externalId` no traducibles (puede estar vacío).
5. Importa con `pnpm -s questions import .content/translated-<idioma>.json`. Si hay no traducibles, ejecuta `pnpm -s questions untranslatable <idioma> .content/untranslatable-<idioma>.json`.
6. Termina con un resumen de una línea: traducidas y no traducibles.
