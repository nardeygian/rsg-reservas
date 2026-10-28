"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type EnlaceServir = { href: string; texto: string };

// Pestañas de Servir. En el celular se desplazan de lado si no caben.
export function ServirNav({ enlaces }: { enlaces: EnlaceServir[] }) {
  const pathname = usePathname();
  // La pantalla en vivo y la letra son de pantalla completa: sin pestañas.
  if (/^\/servir\/[0-9a-f-]{36}\/vivo/i.test(pathname) || /\/letra$/.test(pathname)) return null;
  if (enlaces.length < 2) return null;
  return (
    <div className="px-4 pt-4 max-w-md md:max-w-[1180px] md:px-[clamp(12px,3vw,40px)] mx-auto w-full overflow-x-auto [scrollbar-width:none]">
      <nav className="segmented w-max" aria-label="Servir">
        {enlaces.map((e) => (
          <Link key={e.href} href={e.href} prefetch className="segmented-link whitespace-nowrap"
            aria-current={pathname.startsWith(e.href) ? "page" : undefined}>
            {e.texto}
          </Link>
        ))}
      </nav>
    </div>
  );
}
