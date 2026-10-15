import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { randomUsername, usernameBaseFromMetadata } from "./username";

// Memoizado por petición: varias llamadas en el mismo render no repiten consultas.
export const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, claims: data?.claims ?? null };
});

export const getOwnProfile = cache(async () => {
  const { supabase, claims } = await getAuthContext();
  if (!claims) return null;
  const { data } = await supabase
    .from("profiles")
    .select("username, avatar_id, locale")
    .eq("id", claims.sub)
    .maybeSingle();
  return data;
});

/** Para páginas que exigen sesión y onboarding completado. */
export async function requireProfile() {
  const { claims } = await getAuthContext();
  if (!claims) redirect("/");
  const profile = await getOwnProfile();
  if (!profile) redirect("/onboarding");
  return profile;
}

export async function getActiveAvatarIds() {
  const { supabase } = await getAuthContext();
  const { data } = await supabase.from("avatars").select("id").order("sort_order");
  return (data ?? []).map((a) => a.id);
}

/** Sugerencia para el onboarding: alias del proveedor si está libre; si no, uno aleatorio. */
export async function suggestUsername() {
  const { supabase, claims } = await getAuthContext();
  const candidates = [
    usernameBaseFromMetadata(claims?.user_metadata),
    randomUsername(),
    randomUsername(),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const { data: available } = await supabase.rpc("is_username_available", { candidate });
    if (available) return candidate;
  }
  return "";
}
