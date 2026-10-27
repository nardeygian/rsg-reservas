"use client";

import Link from "next/link";
import { cloneElement } from "react";
import { usePathname } from "next/navigation";
import { destinations, TU } from "./navItems";
import { signOutAction } from "../../perfil/actions";
import type { NavCaps } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  matchExact?: boolean;
  match?: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const ADMIN_ITEM: NavItem = {
  href: "/admin",
  label: "Administración",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
    </svg>
  ),
};

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.match ? item.match(pathname) : item.matchExact ? pathname === item.href : pathname.startsWith(item.href);
  const style = active
    ? { background: "var(--color-accent-soft)", color: "var(--color-accent)" }
    : { color: "var(--color-ink)" };
  return (
    <Link href={item.href} prefetch={true} aria-current={active ? "page" : undefined}>
      <span className="flex items-center gap-[10px] px-[10px] py-[10px] rounded-[var(--radius-control)] w-full text-sm font-medium transition" style={style}>
        {item.icon}
        {item.label}
      </span>
    </Link>
  );
}

export function SidebarNav({ caps }: { caps: NavCaps }) {
  const pathname = usePathname();
  // Los mismos destinos que la barra del celular, con íconos más pequeños.
  const items: NavItem[] = destinations(caps).map(d => ({
    href: d.href,
    label: d.label,
    match: d.match,
    icon: cloneElement(d.icon, { width: 18, height: 18 }),
  }));
  const tu: NavItem = { href: TU.href, label: "Tu perfil", match: (p) => p.startsWith("/perfil"), icon: cloneElement(TU.icon, { width: 18, height: 18 }) };

  return (
    <nav
      aria-label="Módulos"
      className="glass liquid sidebar-glass hidden md:flex flex-col gap-[22px] fixed top-0 left-0 bottom-0 w-[208px] z-50 overflow-y-auto"
      style={{ padding: "22px 14px" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-[10px] px-2">
        <span className="w-9 h-9 rounded-[var(--radius-control)] flex items-center justify-center flex-none" style={{ background: "var(--grad-icon)" }}>
          <span aria-hidden className="brand-mark" style={{ width: 22, color: "#003329" }} />
        </span>
        <div className="flex flex-col">
          <span className="font-semibold text-[15px]" style={{ fontFamily: "var(--font-display)" }}>Portal RSG</span>
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>Resurgencia</span>
        </div>
      </div>

      {/* Módulos */}
      <div className="flex flex-col gap-[2px]">
        {items.map(item => <NavLink key={item.href} item={item} pathname={pathname} />)}
      </div>

      {/* Admin */}
      {caps.admin && (
        <div className="flex flex-col gap-[2px] pt-[14px]" style={{ borderTop: "1px solid var(--color-line)" }}>
          <span className="eyebrow px-[10px] pb-[6px]">Administración</span>
          <NavLink item={ADMIN_ITEM} pathname={pathname} />
        </div>
      )}

      {/* Tu perfil + cerrar sesión */}
      <div className="mt-auto pt-[14px] flex flex-col gap-[2px]" style={{ borderTop: "1px solid var(--color-line)" }}>
        <NavLink item={tu} pathname={pathname} />
        <form action={signOutAction}>
          <button type="submit" className="flex items-center gap-[10px] px-[10px] py-[10px] rounded-[var(--radius-control)] w-full text-sm font-medium transition"
            style={{ color: "var(--color-down)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </form>
      </div>
    </nav>
  );
}
