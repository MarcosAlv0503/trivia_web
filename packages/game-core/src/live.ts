// Duelo relámpago (1 contra 1 en vivo). El servidor es autoritativo (supabase/migrations/*_live_duels.sql): elige
// las preguntas, cronometra y puntúa; aquí está lo que el cliente necesita para mostrarlo.

/** Espejo de las constantes de la migración `live_duels`: si cambian allí, cambian aquí. */
export const LIVE = {
  matchMs: 60_000,
  questionMs: 6_000,
  /** Destello tras responder: acierto o fallo y la correcta. */
  revealMs: 700,
  /**
   * Tras cada respuesta, el reloj del jugador se para lo que tarde en llegar la siguiente pregunta (el destello y la
   * petición), como mucho esto: si se va, su reloj sigue corriendo.
   */
  maxPauseMs: 1_000,
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
