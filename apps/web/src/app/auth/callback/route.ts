import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

// Destino del flujo OAuth (PKCE): intercambia el código por una sesión.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // El idioma del perfil manda sobre el del navegador (la cookie evita consultar la BD en cada petición).
      const { data: profile } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile) {
        (await cookies()).set(LOCALE_COOKIE, profile.locale, LOCALE_COOKIE_OPTIONS);
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.redirect(new URL("/?error=auth", request.url));
}
