import { headers } from "next/headers";
import { getSessionProfile, getUserCaps } from "@/lib/auth";
import { SidebarNav } from "./SidebarNav";
import { BottomTabNav } from "./BottomTabNav";

const EXCLUDED = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth", "/alquilar"];

export async function PortalNavServer() {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  if (EXCLUDED.some(p => pathname.startsWith(p))) return null;

  const [caps, session] = await Promise.all([getUserCaps(), getSessionProfile()]);
  if (!caps) return null;

  // Iniciales para el avatar de "Tú" en la barra inferior.
  const parts = (session?.profile?.full_name ?? session?.email ?? "").trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "·";

  return (
    <>
      <SidebarNav caps={caps} />
      <BottomTabNav caps={caps} initials={initials} />
    </>
  );
}
