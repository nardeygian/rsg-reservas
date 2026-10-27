"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavCaps } from "@/lib/auth";
import { destinations, TU, type Destination } from "./navItems";

const ICON_W = 46;      // ancho de una pestaña sin texto
const LABEL_PAD = 22;   // aire a los lados del texto cuando la pestaña se abre

export function BottomTabNav({ caps, initials }: { caps: NavCaps; initials: string }) {
  const pathname = usePathname();
  const tabs = destinations(caps);

  // Al tocar, la pestaña se abre de inmediato (sin esperar a que cargue la página).
  const [tapped, setTapped] = useState<{ id: Destination["id"]; from: string } | null>(null);
  const pendingId = tapped && tapped.from === pathname ? tapped.id : null;
  const isActive = (d: Destination) => (pendingId ? pendingId === d.id : d.match(pathname));

  // Ancho real de cada nombre, para que la pestaña crezca justo lo que necesita.
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [labelW, setLabelW] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    for (const [id, el] of Object.entries(labelRefs.current)) if (el) next[id] = el.scrollWidth;
    setLabelW(next);
  }, [tabs.length]);

  const width = (d: Destination, active: boolean) =>
    active ? Math.max(ICON_W, (labelW[d.id] ?? 56) + LABEL_PAD) : ICON_W;

  const item = (d: Destination, content: React.ReactNode) => {
    const active = isActive(d);
    return (
      <Link
        key={d.id}
        href={d.href}
        prefetch={true}
        onClick={() => setTapped({ id: d.id, from: pathname })}
        className="tabbar-item"
        aria-current={active ? "page" : undefined}
        aria-label={d.label}
        data-active={active || undefined}
        style={{ width: width(d, active), color: active ? "var(--color-accent)" : "var(--color-muted)" }}
      >
        {content}
        <span ref={(el) => { labelRefs.current[d.id] = el; }} className="tabbar-label" aria-hidden="true">
          {d.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      <div className="md:hidden shrink-0" style={{ height: "var(--nav-space)" }} aria-hidden="true" />
      <nav aria-label="Módulos" className="md:hidden glass liquid tabbar">
        {tabs.map(d => item(d, <span className="tabbar-icon">{d.icon}</span>))}
        {/* Tu perfil: tu avatar, siempre al final de la barra */}
        {item(
          TU,
          <span className="tabbar-icon">
            <span className="tabbar-avatar">{initials}</span>
          </span>,
        )}
      </nav>
    </>
  );
}
