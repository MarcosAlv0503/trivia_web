"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config";
import { getAuthContext, getOwnProfile } from "./queries";
import { isValidUsername } from "./username";

export type FormState = { error?: "usernameInvalid" | "usernameTaken" | "generic" };

/** Crea el perfil (onboarding) o lo actualiza. La BD vuelve a validarlo todo con CHECKs, RLS y triggers. */
export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim();
  const avatarId = String(formData.get("avatarId") ?? "");
  const locale = String(formData.get("locale") ?? "");
  if (!isValidUsername(username)) return { error: "usernameInvalid" };
  if (!isLocale(locale) || !avatarId) return { error: "generic" };

  const { supabase, claims } = await getAuthContext();
  if (!claims) redirect("/");

  const values = { username, avatar_id: avatarId, locale };
  const { error } = (await getOwnProfile())
    ? await supabase.from("profiles").update(values).eq("id", claims.sub)
    : await supabase.from("profiles").insert({ id: claims.sub, ...values });
  if (error) return { error: error.code === "23505" ? "usernameTaken" : "generic" };

  (await cookies()).set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);
  redirect("/");
}

export async function deleteAccount(): Promise<FormState> {
  const { supabase } = await getAuthContext();
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: "generic" };
  // El usuario ya no existe: basta con borrar la sesión local (cookies).
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
