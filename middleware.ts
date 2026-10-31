import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Excluye estáticos y endpoints internos de Next. El service worker y el
    // manifiesto tampoco pasan por el login: el navegador no registra un
    // service worker que redirige y la PWA no se instala sin manifiesto.
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
