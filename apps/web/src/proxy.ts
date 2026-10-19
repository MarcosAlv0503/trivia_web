import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// La cuenta es obligatoria: sin sesión solo son accesibles la portada, el flujo de login y los textos legales.
function isPublicPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/auth/") || pathname.startsWith("/legal/");
}

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);
  if (!isAuthenticated && !isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

// Fuera del proxy (sin sesión): estáticos, y lo que el navegador pide para instalar la PWA y recibir avisos.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico$|manifest\\.webmanifest$|sw\\.js$|icon/|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
