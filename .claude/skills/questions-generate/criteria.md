# Criterios de calidad de las preguntas

Los usan los tres procesos (`questions-generate`, `questions-translate`, `questions-review`). Una pregunta solo es válida si cumple todo.

## Forma

- Exactamente 4 respuestas: 1 correcta y 3 incorrectas. En el JSON, `correct` es la correcta y `wrong` las otras tres.
- Enunciado claro y breve: idealmente ≤ 120 caracteres (máximo 300). Respuestas ≤ 40 caracteres (máximo 120).
- Español de España neutro, con `¿?`, tildes y mayúsculas correctas. En inglés, inglés internacional neutro.
- Las 4 respuestas son del mismo tipo y formato (todas años, todas ciudades, longitud parecida). Nada de "todas las anteriores", chistes ni respuestas absurdas.
- El enunciado no delata la respuesta. Evita las negativas ("¿cuál NO…?").

## Contenido

- **Una única respuesta correcta, indiscutible y verificable.** Las incorrectas son plausibles pero claramente falsas; ninguna puede defenderse como correcta.
- Hechos estables en el tiempo. En las preguntas que no son de actualidad, nada de "actualmente", récords que se baten o cargos que cambian.
- Encaja en su categoría: `geography`, `history`, `science` (ciencia y naturaleza), `art-literature`, `entertainment`, `sports`, `technology`.
- Respetuosa y apta para todos los públicos. **Fuera:** tragedias y muertes recientes, delitos, política partidista, religión polémica, contenido sexual, menores, bulos de salud y estereotipos.
- Nunca menciones "Trivial Pursuit" ni "Preguntados".

## Dificultad

- `easy`: la acertaría la mayoría de adultos (≈70 % o más). Cultura general básica.
- `medium`: para quien sigue el tema o tiene buena cultura general (≈40–70 %).
- `hard`: para aficionados del tema (≈15–40 %). Difícil, pero no un dato oscuro que nadie podría saber.

## Actualidad (`"topical": true`)

- Trata algo de los últimos ~60 días del que se habla en España o en el mundo: deportes, tecnología, ciencia, cultura, entretenimiento…
- **Confirmado por al menos dos fuentes fiables** encontradas con búsqueda web, nunca de memoria (el modelo no conoce lo reciente).
- Debe seguir siendo cierta hasta que caduque. Nada de resultados aún abiertos, rumores ni cifras que cambian cada semana.
- `expiresAt`: 90 días desde hoy por defecto. Ponla antes si el dato dejará de ser noticia antes.
- Sigue valiendo todo lo anterior, incluida la lista de temas fuera.
