"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Respuesta inmediata en toda la app:
// * Barra fina arriba en cuanto se toca un enlace interno, hasta que llega
//   la pantalla nueva (las pantallas del servidor pueden tardar un poco).
// * Marca el último botón tocado (data-tocado): si queda ocupado
//   (aria-busy), globals.css le pone el indicador de carga solo a ese.
export function RespuestaInmediata() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [cargando, setCargando] = useState(false);

  useEffect(() => { setCargando(false); }, [pathname, search]);

  useEffect(() => {
    let anterior: Element | null = null;
    const alTocar = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const boton = t?.closest("button");
      if (boton) {
        anterior?.removeAttribute("data-tocado");
        boton.setAttribute("data-tocado", "");
        anterior = boton;
      }
      const a = t?.closest("a");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== "_self") return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || a.hasAttribute("download")) return;
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setCargando(true);
    };
    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);

  // Por si la navegación no ocurre (p. ej. otro handler la canceló).
  useEffect(() => {
    if (!cargando) return;
    const t = setTimeout(() => setCargando(false), 10000);
    return () => clearTimeout(t);
  }, [cargando]);

  return <div aria-hidden className="barra-carga" data-activa={cargando || undefined} />;
}
