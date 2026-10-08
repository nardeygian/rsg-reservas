"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  matchExact?: boolean;
};

const MAIN_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Inicio",
    matchExact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>
      </svg>
    ),
  },
  {
    href: "/calendario",
    label: "Calendario",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>
      </svg>
    ),
  },
  {
    href: "/reservas",
    label: "Reservas",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 21V4h11v17"/><path d="M15 8h5v13"/><path d="M11 12h.01"/>
      </svg>
    ),
  },
  {
    href: null,
    label: "Servicio",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 11l3-3a2 2 0 0 1 3 0l1 1"/><path d="M3 13l4-4 6 6a2 2 0 0 1-3 3l-1-1"/><path d="M14 9l3-3 4 4-5 5"/>
      </svg>
    ),
  },
  {
    href: null,
    label: "Mis discípulos",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>
      </svg>
    ),
  },
  {
    href: null,
    label: "Donaciones",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>
      </svg>
    ),
  },
];

const ADMIN_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Administración",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
      </svg>
    ),
  },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.href
    ? item.matchExact
      ? pathname === item.href
      : pathname.startsWith(item.href)
    : false;
  const disabled = !item.href;

  const style = active
    ? { background: "var(--color-accent-soft)", color: "var(--color-accent)" }
    : disabled
      ? { color: "var(--color-line)", cursor: "default" }
      : { color: "var(--color-ink)" };

  const inner = (
    <span
      className="flex items-center gap-[10px] px-[10px] py-[10px] rounded-[8px] w-full text-sm font-medium transition"
      style={style}
    >
      {item.icon}
      {item.label}
    </span>
  );

  if (!item.href) {
    return <span aria-disabled="true">{inner}</span>;
  }

  return (
    <Link href={item.href} aria-current={active ? "page" : undefined}>
      {inner}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Módulos"
      className="hidden md:flex flex-col gap-[22px] fixed top-0 left-0 bottom-0 w-[220px] z-50 overflow-y-auto"
      style={{
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-line)",
        padding: "22px 14px",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-[10px] px-2">
        <div
          className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[13px] font-bold flex-none"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-accent-ink)",
            fontFamily: "var(--font-display)",
          }}
        >
          RSG
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-[15px]" style={{ fontFamily: "var(--font-display)" }}>
            Portal RSG
          </span>
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            Resurgencia
          </span>
        </div>
      </div>

      {/* Módulos */}
      <div className="flex flex-col gap-[2px]">
        {MAIN_ITEMS.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} />
        ))}
      </div>

      {/* Sección admin */}
      <div
        className="flex flex-col gap-[2px] pt-[14px]"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <span className="eyebrow px-[10px] pb-[6px]">Administración</span>
        {ADMIN_ITEMS.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
