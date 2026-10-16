import type { Difficulty, DuelRounds } from "@trivia/game-core";
import type { createClient } from "@/lib/supabase/client";

export type StartDuelError = "notFriends" | "tooManyDuels" | "generic";

/** Crea un duelo (también la revancha). Devuelve su id o el motivo del error. */
export async function startDuel(
  supabase: ReturnType<typeof createClient>,
  opponentId: string,
  difficulty: Difficulty,
  rounds: DuelRounds,
): Promise<{ id: string } | { error: StartDuelError }> {
  const { data, error } = await supabase.rpc("start_duel", {
    opponent: opponentId,
    duel_difficulty: difficulty,
    duel_round_count: rounds,
  });
  if (error || !data) {
    const hint = error?.hint;
    return {
      error:
        hint === "not_friends"
          ? "notFriends"
          : hint === "too_many_duels"
            ? "tooManyDuels"
            : "generic",
    };
  }
  return { id: data };
}
