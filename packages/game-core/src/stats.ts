/** Respuestas mínimas en una categoría para destacarla como la mejor o la peor. */
export const HIGHLIGHT_MIN_ANSWERED = 10;

export type CategoryStat = { id: string; answered: number; correct: number };

/**
 * Categoría con mejor y con peor % de acierto ("Tu fuerte" / "Tu punto débil"). Solo entran las que tienen al menos
 * HIGHLIGHT_MIN_ANSWERED respuestas y hacen falta dos; si la mejor o la peor empata con otra, no se marca.
 */
export function categoryHighlights(stats: CategoryStat[]): { best?: string; worst?: string } {
  const rated = stats
    .filter((s) => s.answered >= HIGHLIGHT_MIN_ANSWERED)
    .map((s) => ({ id: s.id, rate: s.correct / s.answered }));
  if (rated.length < 2) return {};
  const rates = rated.map((r) => r.rate);
  return { best: unique(rated, Math.max(...rates)), worst: unique(rated, Math.min(...rates)) };
}

/** La única categoría con ese %, o undefined si lo comparten varias. */
function unique(rated: { id: string; rate: number }[], rate: number) {
  const matches = rated.filter((r) => r.rate === rate);
  return matches.length === 1 ? matches[0]?.id : undefined;
}
