import type { Difficulty } from "@trivia/game-core";
import type { createClient } from "@/lib/supabase/client";

export type LiveInviteError =
  | "notFriends"
  | "friendOffline"
  | "friendBusy"
  | "liveInProgress"
  | "notEnoughQuestions"
  | "rateLimited"
  | "generic";

const ERRORS: Record<string, LiveInviteError> = {
  not_friends: "notFriends",
  friend_offline: "friendOffline",
  friend_busy: "friendBusy",
  live_in_progress: "liveInProgress",
  not_enough_questions: "notEnoughQuestions",
  rate_limited: "rateLimited",
};

/** Reta en vivo a un amigo conectado. Devuelve el id del duelo o el motivo del error. */
export async function inviteLive(
  supabase: ReturnType<typeof createClient>,
  friendId: string,
  difficulty: Difficulty,
): Promise<{ id: string } | { error: LiveInviteError }> {
  const { data, error } = await supabase.rpc("invite_live_duel", {
    friend: friendId,
    match_difficulty: difficulty,
  });
  if (error || !data) return { error: ERRORS[error?.hint ?? ""] ?? "generic" };
  return { id: data };
}
