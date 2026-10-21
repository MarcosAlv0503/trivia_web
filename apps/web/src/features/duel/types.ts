import type { Difficulty, DuelRounds } from "@trivia/game-core";
import type { XpGained } from "@/features/progress/xp-gain";

// Forma de lo que devuelven las RPC del duelo (los tipos generados solo dicen `Json`).

export type DuelCategory = { id: string; name: string; color: string };
export type DuelAction = "spin" | "answer" | "wait" | "done";
export type DuelResult = "win" | "loss" | "draw" | "cancelled" | null;
export type DuelEndReason =
  "completed" | "timeout" | "surrender" | "declined" | "unfriended" | null;

export type DuelPlayer = {
  id: string;
  username: string;
  avatarId: string;
  xp: number;
  score: number;
};

export type Duel = {
  id: string;
  difficulty: Difficulty;
  roundCount: DuelRounds;
  status: "active" | "finished";
  endReason: DuelEndReason;
  result: DuelResult;
  turnNumber: number;
  deadline: string;
  nextAction: DuelAction;
  canDecline: boolean;
  /** XP ganada en este duelo; `null` hasta terminar (o si no sumó nada). */
  xpGain: XpGained | null;
  me: DuelPlayer;
  opponent: DuelPlayer;
  rounds: {
    round: number;
    category: DuelCategory;
    myPoints: number | null;
    opponentPoints: number | null;
  }[];
  categories: DuelCategory[];
};

export type DuelSummary = {
  id: string;
  status: "active" | "finished";
  nextAction: DuelAction;
  result: DuelResult;
  endReason: DuelEndReason;
  round: number;
  roundCount: DuelRounds;
  deadline: string;
  opponent: { username: string; avatarId: string; xp: number };
  myScore: number;
  opponentScore: number;
};

export type DuelQuestion = {
  round: number;
  slot: number;
  timeLimitMs: number;
  elapsedMs: number;
  category: DuelCategory;
  topical: boolean;
  prompt: string;
  answers: string[];
};

export type DuelAnswerResult = {
  correctIndex: number;
  isCorrect: boolean;
  points: number;
  turnEnded: boolean;
  finished: boolean;
  /** % de jugadores que la aciertan; null si aún tiene pocas respuestas. */
  hitRate: number | null;
};
