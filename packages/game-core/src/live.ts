// Duelo relámpago (1 contra 1 en vivo). El servidor es autoritativo (supabase/migrations/*_live_duels.sql): elige
// las preguntas, cronometra y puntúa; aquí está lo que el cliente necesita para mostrarlo.

/** Espejo de las constantes de la migración `live_duels`: si cambian allí, cambian aquí. */
export const LIVE = {
  matchMs: 60_000,
  questionMs: 6_000,
  /** Destello tras responder: acierto o fallo y la correcta. */
  revealMs: 700,
  /** Cada respuesta devuelve este tiempo al reloj del jugador: cubre el destello y pedir la siguiente. */
  answerCreditMs: 1_000,
  inviteSeconds: 30,
  countdownMs: 3_000,
  correct: 10,
  fastBonus: 3,
  fastMs: 3_000,
  /** Empate legendario desde estos puntos (cada uno). */
  legendaryDraw: 50,
  /** El reloj se pone rojo y hace tic-tac en los últimos segundos. */
  warningMs: 10_000,
} as const;
