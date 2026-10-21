import type { XpGained } from "@/features/progress/xp-gain";

// Forma de lo que devuelve get_daily (los tipos generados solo dicen `Json`).

/** Una pregunta del reto como cuadrito: su categoría y si se acertó (null = aún sin responder). */
export type DailyRound = {
  categoryId: string;
  name: string;
  color: string;
  correct: boolean | null;
};

export type DailyResult = { score: number; correct: number; rounds: DailyRound[] };

export type Daily = {
  number: number;
  /** Partida del jugador hoy; `null` si aún no ha empezado. */
  match: (DailyResult & { id: string; finished: boolean; xp: XpGained | null }) | null;
  /** Amigos que ya lo han terminado, por puntos (vacío hasta que el jugador lo termina). */
  friends: (DailyResult & { id: string; username: string; avatarId: string; xp: number })[];
};
