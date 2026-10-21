// Animación de final de partida que toca en cada modo con rival.

export type OutcomeKind = "victory" | "defeat" | "draw" | "legendaryDraw";

/** Puntos por pregunta (media de la mitad acertadas) desde los que un empate es legendario. */
const LEGENDARY_POINTS_PER_QUESTION = 5;

/** Umbral de empate legendario en los modos con un número fijo de preguntas por jugador. */
export function legendaryThreshold(questionsPerPlayer: number) {
  return questionsPerPlayer * LEGENDARY_POINTS_PER_QUESTION;
}

/**
 * Final de un 1 contra 1 visto por un jugador. Manda el resultado del servidor (una rendición o un plazo vencido
 * deciden aunque los puntos digan otra cosa); en el empate, los puntos de cada uno deciden si es legendario.
 */
export function headToHeadOutcome(
  result: "win" | "loss" | "draw",
  myScore: number,
  legendaryFrom: number,
): OutcomeKind {
  if (result === "win") return "victory";
  if (result === "loss") return "defeat";
  return myScore >= legendaryFrom ? "legendaryDraw" : "draw";
}

/**
 * Final de una partida local en un dispositivo: en solitario no hay animación; si no, victoria del primero o empate
 * de quienes comparten el primer puesto.
 */
export function localOutcome<P extends { score: number }>(
  players: readonly P[],
  legendaryFrom: number,
): { kind: Exclude<OutcomeKind, "defeat">; winners: P[] } | null {
  if (players.length < 2) return null;
  const top = Math.max(...players.map((p) => p.score));
  const winners = players.filter((p) => p.score === top);
  if (winners.length === 1) return { kind: "victory", winners };
  return { kind: top >= legendaryFrom ? "legendaryDraw" : "draw", winners };
}
