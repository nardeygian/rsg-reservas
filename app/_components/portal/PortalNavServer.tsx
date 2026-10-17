import { headers } from "next/headers";
import { getUserCaps } from "@/lib/auth";
import { SidebarNav } from "./SidebarNav";
import { BottomTabNav } from "./BottomTabNav";

const EXCLUDED = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth", "/alquilar"];

export async function PortalNavServer() {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  if (EXCLUDED.some(p => pathname.startsWith(p))) return null;

  const caps = await getUserCaps();
  if (!caps) return null;

  return (
    <>
      <SidebarNav caps={caps} />
      <BottomTabNav caps={caps} />
    </>
  );
}
