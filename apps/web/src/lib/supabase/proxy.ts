import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Refresca la sesión de Supabase en cada petición y propaga las cookies actualizadas.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // La librería solo envía las cabeceras en la primera escritura; se acumulan por si se recrea la respuesta.
  const cacheHeaders: Record<string, string> = {};
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Evita que una CDN cachee y sirva la sesión de un usuario a otro.
        Object.assign(cacheHeaders, headers);
        for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
      },
    },
  });

  // No ejecutar código entre createServerClient y getClaims(): provoca cierres de sesión aleatorios.
  await supabase.auth.getClaims();

  return response;
}
