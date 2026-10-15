import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// La cuenta es obligatoria: sin sesión solo son accesibles la portada y el flujo de login.
function isPublicPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/auth/");
}

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);
  if (!isAuthenticated && !isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
