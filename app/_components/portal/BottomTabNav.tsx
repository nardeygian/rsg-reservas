"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavCaps } from "@/lib/auth";

type Tab = { href: string; label: string; matchExact?: boolean; icon: React.ReactNode };

const ALL_TABS: Tab[] = [
  {
    href: "/",
    label: "Inicio",
    matchExact: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>
      </svg>
    ),
  },
  {
    href: "/calendario",
    label: "Calendario",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>
      </svg>
    ),
  },
  {
    href: "/reservas",
    label: "Reservas",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 21V4h11v17"/><path d="M15 8h5v13"/><path d="M11 12h.01"/>
      </svg>
    ),
  },
  {
    href: "/servicio",
    label: "Servicio",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 11l3-3a2 2 0 0 1 3 0l1 1"/><path d="M3 13l4-4 6 6a2 2 0 0 1-3 3l-1-1"/><path d="M14 9l3-3 4 4-5 5"/>
      </svg>
    ),
  },
  {
    href: "/perfil",
    label: "Más",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
      </svg>
    ),
  },
];

function visibleTabs(caps: NavCaps): Tab[] {
  return ALL_TABS.filter(tab => {
    if (tab.href === "/")           return caps.inicio;
    if (tab.href === "/calendario") return caps.calendario;
    if (tab.href === "/reservas")   return caps.reservas;
    if (tab.href === "/servicio")   return caps.servicio !== "none";
    if (tab.href === "/perfil")     return true; // always
    return false;
  });
}

export function BottomTabNav({ caps }: { caps: NavCaps }) {
  const pathname = usePathname();
  const tabs = visibleTabs(caps);

  function isActive(tab: Tab) {
    return tab.matchExact ? pathname === tab.href : pathname.startsWith(tab.href);
  }

  return (
    <>
      <div className="md:hidden h-[72px] shrink-0" aria-hidden="true" />
      <nav
        aria-label="Módulos"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-line)" }}
      >
        <div
          className="grid max-w-lg mx-auto"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
        >
          {tabs.map(tab => {
            const active = isActive(tab);
            const color = active ? "var(--color-accent)" : "var(--color-faint)";
            return (
              <Link key={tab.href} href={tab.href} prefetch={true} className="flex justify-center min-h-[44px]" aria-current={active ? "page" : undefined}>
                <span className="flex flex-col items-center gap-[3px] py-[6px] text-[11px] font-semibold" style={{ color }}>
                  {tab.icon}
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
