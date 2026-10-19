"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LEGAL } from "@/features/legal/legal";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config";
import { getAuthContext, getOwnProfile } from "./queries";
import { isValidUsername } from "./username";

export type FormState = {
  error?:
    | "usernameInvalid"
    | "usernameTaken"
    | "usernameNotAllowed"
    | "termsRequired"
    | "rateLimited"
    | "generic";
};

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
  const exists = Boolean(await getOwnProfile());
  // Al crear el perfil hay que declarar la edad mínima y aceptar los textos legales (se guarda la versión).
  if (!exists && formData.get("acceptTerms") !== "on") return { error: "termsRequired" };
  const { error } = exists
    ? await supabase.from("profiles").update(values).eq("id", claims.sub)
    : await supabase
        .from("profiles")
        .insert({ id: claims.sub, ...values, terms_version: LEGAL.version });
  if (error) {
    if (error.code === "23505") return { error: "usernameTaken" };
    if (error.hint === "username_not_allowed") return { error: "usernameNotAllowed" };
    return { error: error.hint === "rate_limited" ? "rateLimited" : "generic" };
  }

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
