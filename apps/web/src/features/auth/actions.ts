"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabledProvider } from "./providers";

export async function signInWithProvider(provider: string) {
  // El argumento llega del cliente: validar siempre.
  if (!isEnabledProvider(provider)) redirect("/?error=auth");

  // Next.js ya rechaza server actions cuyo Origin no coincide con el Host,
  // y Supabase solo redirige a URLs de su lista permitida.
  const origin = (await headers()).get("origin");
  if (!origin) redirect("/?error=auth");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) redirect("/?error=auth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
