"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
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
    matchExact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>
      </svg>
    ),
  },
  {
    href: "/reservas",
    label: "Reservas",
    matchExact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 21V4h11v17"/><path d="M15 8h5v13"/><path d="M11 12h.01"/>
      </svg>
    ),
  },
  {
    href: null,
    label: "Servicio",
    matchExact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 11l3-3a2 2 0 0 1 3 0l1 1"/><path d="M3 13l4-4 6 6a2 2 0 0 1-3 3l-1-1"/><path d="M14 9l3-3 4 4-5 5"/>
      </svg>
    ),
  },
  {
    href: "/perfil",
    label: "Más",
    matchExact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
      </svg>
    ),
  },
];

export function BottomTabNav() {
  const pathname = usePathname();

  function isActive(tab: (typeof TABS)[0]): boolean {
    if (!tab.href) return false;
    if (tab.matchExact) return pathname === tab.href;
    return pathname.startsWith(tab.href);
  }

  return (
    <>
      {/* Espaciador para que el contenido no quede tapado */}
      <div className="md:hidden h-[72px] shrink-0" aria-hidden="true" />

      <nav
        aria-label="Módulos"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-line)",
        }}
      >
        <div
          className="grid max-w-lg mx-auto"
          style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))`, paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
        >
          {TABS.map((tab) => {
            const active = isActive(tab);
            const color = active
              ? "var(--color-accent)"
              : tab.href
                ? "var(--color-faint)"
                : "var(--color-line)";

            const inner = (
              <span
                className="flex flex-col items-center gap-[3px] py-[6px] text-[11px] font-semibold"
                style={{ color }}
              >
                {tab.icon}
                {tab.label}
              </span>
            );

            if (!tab.href) {
              return (
                <span key={tab.label} className="flex justify-center" aria-disabled="true">
                  {inner}
                </span>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex justify-center min-h-[44px]"
                aria-current={active ? "page" : undefined}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
