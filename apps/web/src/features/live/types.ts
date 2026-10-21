import type { Difficulty } from "@trivia/game-core";

// Forma de lo que devuelven las RPC del duelo relámpago (los tipos generados solo dicen `Json`).
// Los tiempos vienen en ms relativos al reloj del servidor.

export type LivePlayer = {
  id: string;
  username: string;
  avatarId: string;
  xp: number;
  score: number;
  answered: number;
  correct: number;
};

export type LiveStatus = "pending" | "active" | "finished" | "declined" | "expired" | "cancelled";

export type LiveDuel = {
  id: string;
  status: LiveStatus;
  difficulty: Difficulty;
  isChallenger: boolean;
  inviteLeftMs: number | null;
  startsInMs: number | null;
  /** Lo que le queda a tu reloj (solo en partida). */
  remainingMs: number | null;
  /** Has terminado (reloj o reserva agotados), aunque el rival siga jugando. */
  done: boolean;
  result: "win" | "loss" | "draw" | null;
  me: LivePlayer;
  opponent: LivePlayer;
};

export type LiveQuestion = {
  position: number;
  timeLimitMs: number;
  elapsedMs: number;
  remainingMs: number;
  category: { id: string; name: string; color: string };
  topical: boolean;
  prompt: string;
  answers: string[];
};

export type LiveAnswerResult = {
  correctIndex: number;
  isCorrect: boolean;
  points: number;
  remainingMs: number;
  done: boolean;
};
