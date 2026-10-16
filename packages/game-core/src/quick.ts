// Modo "Preguntas rápidas". El servidor es autoritativo (sirve, cronometra y puntúa en
// supabase/migrations/*_quick_matches.sql); aquí está lo que el cliente necesita para conducir la partida.

/** Espejo de las constantes de la migración `quick_matches`: si cambian allí, cambian aquí. */
export const QUICK = {
  maxPlayers: 6,
  questionsPerPlayer: 7,
  secondsPerQuestion: 15,
} as const;

/** Espejo de la función SQL `answer_points` (compartida por el modo rápido y el duelo). */
export const SCORING = {
  correct: 10,
  veryFastBonus: 5,
  fastBonus: 2,
} as const;

/** Nivel de rapidez de un acierto según sus puntos; `null` si no fue acierto. */
export function speedTier(points: number) {
  if (points >= SCORING.correct + SCORING.veryFastBonus) return "veryFast";
  if (points >= SCORING.correct + SCORING.fastBonus) return "fast";
  if (points >= SCORING.correct) return "normal";
  return null;
}

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Turnos alternos: la posición global `position` la juega este asiento (0 = anfitrión). */
export function seatOf(position: number, playerCount: number) {
  return position % playerCount;
}

/** Ronda (1..7) a la que pertenece la posición global. */
export function roundOf(position: number, playerCount: number) {
  return Math.floor(position / playerCount) + 1;
}

/** Fase que sigue a la revelación de una respuesta. En local, cada turno empieza pasando el dispositivo. */
export function phaseAfterReveal(finished: boolean, playerCount: number) {
  if (finished) return "results";
  return playerCount > 1 ? "handoff" : "question";
}

/** Clasificación con empates (1, 1, 3...): manda la puntuación; a igualdad de puntos, comparten puesto. */
export function rankPlayers<P extends { score: number }>(players: readonly P[]) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return sorted.map((player) => ({
    ...player,
    place: sorted.findIndex((other) => other.score === player.score) + 1,
  }));
}
