---
name: questions-generate
description: Genera preguntas de trivia nuevas en español y las importa como borrador (la revisión las aprueba). Sin argumentos elige qué hace falta; pensado para ejecutarse programado.
argument-hint: "[categoría|actualidad] [easy|medium|hard] [cantidad]"
disable-model-invocation: true
allowed-tools: Bash(pnpm -s questions *) WebSearch WebFetch Read Edit(./.content/**) Write(./.content/**)
---

Genera preguntas nuevas para el juego siguiendo `.claude/skills/questions-generate/criteria.md` (léelo antes de empezar). Trabaja sin pedir confirmación: es una tarea desatendida.

Argumentos (todos opcionales): `$ARGUMENTS`

1. **Qué generar.**
   - Si se indica una categoría (`geography`, `history`, `science`, `art-literature`, `entertainment`, `sports`, `technology`) o `actualidad`, usa eso. Sin dificultad, reparte entre las tres.
   - Sin argumentos, ejecuta `pnpm -s questions status` y genera lo que indique la línea "Siguiente".
   - Cantidad por defecto: 20.
2. **Contexto para no repetir.** Ejecuta `pnpm -s questions existing <categoría>` para cada categoría que vayas a usar. No repitas ninguna pregunta ni el mismo dato preguntado de otra forma.
3. **Actualidad.** Busca en la web noticias de los últimos ~60 días (varias búsquedas, en español y en inglés, de distintas categorías). Quédate solo con hechos confirmados por al menos dos fuentes fiables. Asígnale a cada pregunta su categoría real y su dificultad.
4. **Escribe** `.content/generated.json`: un array de objetos con este formato (sin `externalId` ni `status`, los pone el script):
   ```json
   {
     "category": "science",
     "difficulty": "medium",
     "source": "ai",
     "topical": false,
     "translations": {
       "es": { "prompt": "¿…?", "correct": "…", "wrong": ["…", "…", "…"] }
     }
   }
   ```
   Solo en español: la traducción es otro proceso. En las de actualidad, `"topical": true` y `"expiresAt"` (ISO 8601) si debe caducar antes de 90 días.
5. **Repasa** cada pregunta contra los criterios antes de importar: una única correcta, incorrectas claramente falsas, dificultad bien puesta, sin duplicados. Corrige o descarta lo que falle.
6. **Importa** con `pnpm -s questions import .content/generated.json`.
7. **Termina** con un resumen de una línea: cuántas preguntas, de qué categorías y dificultades, y cuántas de actualidad.
