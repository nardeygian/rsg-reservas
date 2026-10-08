"use client";

import { usePathname } from "next/navigation";
import { BottomTabNav } from "./BottomTabNav";
import { SidebarNav } from "./SidebarNav";

const EXCLUDED = ["/login", "/registro", "/forgot-password", "/reset-password", "/alquilar"];

export function PortalNav() {
  const pathname = usePathname();
  const hidden = EXCLUDED.some((p) => pathname.startsWith(p));
  if (hidden) return null;
  return (
    <>
      <SidebarNav />
      <BottomTabNav />
    </>
  );
}
