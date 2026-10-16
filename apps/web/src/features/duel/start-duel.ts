import type { Difficulty } from "@trivia/game-core";
import type { createClient } from "@/lib/supabase/client";

export type StartDuelError = "notFriends" | "generic";

/** Crea un duelo (también la revancha). Devuelve su id o el motivo del error. */
export async function startDuel(
  supabase: ReturnType<typeof createClient>,
  opponentId: string,
  difficulty: Difficulty,
): Promise<{ id: string } | { error: StartDuelError }> {
  const { data, error } = await supabase.rpc("start_duel", {
    opponent: opponentId,
    duel_difficulty: difficulty,
  });
  if (error || !data) return { error: error?.hint === "not_friends" ? "notFriends" : "generic" };
  return { id: data };
}
