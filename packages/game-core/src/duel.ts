// Duelo por turnos. El servidor es autoritativo (supabase/migrations/*_friends_and_duels.sql): decide la
// categoría, sirve, puntúa y pasa los turnos; aquí está lo que el cliente necesita para mostrarlo.

/** Espejo de las reglas de la migración: si cambian allí, cambian aquí. */
export const DUEL = {
  roundOptions: [3, 6],
  defaultRounds: 6,
  questionsPerRound: 3,
  turnHours: 48,
  maxActivePerPair: 3,
} as const;

export type DuelRounds = (typeof DUEL.roundOptions)[number];

/** Horas que quedan hasta el plazo del turno, redondeando hacia arriba (0 si ya pasó). */
export function hoursLeft(deadline: Date, now: Date) {
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 3_600_000));
}

/**
 * Ronda que está respondiendo quien tiene el turno: en el turno t primero responde la ronda t−1 (la que giró el
 * rival) y, tras girar, la ronda t.
 */
export function duelPendingRound(turnNumber: number, roundsSpun: number) {
  return roundsSpun >= turnNumber ? turnNumber : turnNumber - 1;
}
