import type { Difficulty } from "@trivia/game-core";
import type { XpGained } from "@/features/progress/xp-gain";

// Forma de lo que devuelven las RPC del modo rápido (los tipos generados solo dicen `Json`).

export type QuickPlayer = {
  seat: number;
  name: string;
  avatarId: string;
  score: number;
  correct: number;
};

export type QuickMatch = {
  id: string;
  /** null en el reto diario (dificultades mezcladas). */
  difficulty: Difficulty | null;
  total: number;
  /** Siguiente posición por jugar; `null` si la partida ha terminado. */
  nextPosition: number | null;
  players: QuickPlayer[];
  /** XP del anfitrión en esta partida; `null` hasta terminar. */
  xp: XpGained | null;
};

export type ServedQuestion = {
  position: number;
  seat: number;
  timeLimitMs: number;
  elapsedMs: number;
  category: { id: string; name: string; color: string };
  topical: boolean;
  prompt: string;
  answers: string[];
};

export type AnswerResult = {
  correctIndex: number;
  isCorrect: boolean;
  points: number;
  finished: boolean;
  /** % de jugadores que la aciertan; null si aún tiene pocas respuestas. */
  hitRate: number | null;
};
