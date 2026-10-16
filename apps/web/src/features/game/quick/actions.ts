"use server";

import { redirect } from "next/navigation";
import { DIFFICULTIES, QUICK, type Difficulty } from "@trivia/game-core";
import { getAuthContext } from "@/features/profile/queries";

export type StartState = { error?: "notEnoughQuestions" | "nameTaken" | "generic" };

function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

/**
 * Crea una partida (también la revancha). Los invitados llegan como pares guestName/guestAvatar en orden de turno;
 * se guardan con remember_guest y la BD vuelve a validarlo todo.
 */
export async function startQuickMatch(_prev: StartState, formData: FormData): Promise<StartState> {
  const difficulty = String(formData.get("difficulty") ?? "");
  const avatars = formData.getAll("guestAvatar").map(String);
  const guests = formData
    .getAll("guestName")
    .map((name, i) => ({ name: String(name).trim(), avatarId: avatars[i] ?? "" }));

  if (
    !isDifficulty(difficulty) ||
    guests.length > QUICK.maxPlayers - 1 ||
    guests.some((g) => !g.name || [...g.name].length > 20 || !g.avatarId)
  ) {
    return { error: "generic" };
  }
  if (new Set(guests.map((g) => g.name.toLowerCase())).size !== guests.length) {
    return { error: "nameTaken" };
  }

  const { supabase, claims } = await getAuthContext();
  if (!claims) redirect("/");

  const guestIds: string[] = [];
  for (const guest of guests) {
    const { data, error } = await supabase.rpc("remember_guest", {
      guest_name: guest.name,
      guest_avatar_id: guest.avatarId,
    });
    if (error || !data) return { error: "generic" };
    guestIds.push(data.id);
  }

  const { data: matchId, error } = await supabase.rpc("start_quick_match", {
    match_difficulty: difficulty,
    guest_ids: guestIds,
  });
  if (error)
    return { error: error.hint === "not_enough_questions" ? "notEnoughQuestions" : "generic" };
  redirect(`/play/quick/${matchId}`);
}
