"use client";

import { cloneElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement, SVGProps } from "react";
import type { NavCaps } from "@/lib/auth";

type SvgIcon = ReactElement<SVGProps<SVGSVGElement>>;
type Tab = { href: string; label: string; matchExact?: boolean; icon: SvgIcon };

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
    href: "/donaciones",
    label: "Dar",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>
      </svg>
    ),
  },
  {
    href: "/discipulos",
    label: "Grupos",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>
      </svg>
    ),
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
      </svg>
    ),
  },
];

function visibleTabs(caps: NavCaps): Tab[] {
  return ALL_TABS.filter(tab => {
    if (tab.href === "/")            return caps.inicio;
    if (tab.href === "/calendario")  return caps.calendario;
    if (tab.href === "/reservas")    return caps.reservas;
    if (tab.href === "/servicio")    return caps.servicio !== "none";
    if (tab.href === "/donaciones")  return caps.donaciones !== "none";
    if (tab.href === "/discipulos")  return caps.discipulos;
    if (tab.href === "/perfil")      return true;
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
            const compact = tabs.length >= 6;
            return (
              <Link key={tab.href} href={tab.href} prefetch={true} className="flex justify-center min-h-[44px]" aria-current={active ? "page" : undefined}>
                <span className="flex flex-col items-center gap-[2px] py-[6px] font-semibold" style={{ color, fontSize: compact ? 10 : 11 }}>
                  {compact
                    ? cloneElement(tab.icon, { width: "20", height: "20" })
                    : tab.icon}
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
