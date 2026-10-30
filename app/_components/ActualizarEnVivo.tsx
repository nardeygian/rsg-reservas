"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { suscribirConSesion } from "@/lib/supabase/realtime";

export type Escucha = { tabla: string; filtro?: string };

// Mantiene una pantalla al día sin recargar: cuando cambia algo en esas
// tablas (Supabase Realtime), vuelve a pedir la página al servidor, que lee
// otra vez con la sesión del usuario (RLS decide). El evento solo avisa;
// no se usa lo que trae.
export function ActualizarEnVivo({ canal, escuchas }: { canal: string; escuchas: Escucha[] }) {
  const router = useRouter();
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firma = JSON.stringify(escuchas);

  useEffect(() => {
    const lista = JSON.parse(firma) as Escucha[];
    if (!lista.length) return;
    const sb = createClient();
    const refrescar = () => {
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => router.refresh(), 300);
    };
    // Con el token del usuario: si el canal entra como anon, Realtime
    // rechaza los filtros y no llega nada (ver lib/supabase/realtime.ts).
    const cerrar = suscribirConSesion(sb, (c) => {
      let ch = c.channel(`en-vivo-${canal}`);
      for (const e of lista) {
        ch = ch.on("postgres_changes", { event: "*", schema: "public", table: e.tabla, ...(e.filtro ? { filter: e.filtro } : {}) }, refrescar);
      }
      return ch;
    });
    // Al volver a la pestaña (celular bloqueado, otra app), ponerse al día.
    const alVolver = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      if (espera.current) clearTimeout(espera.current);
      document.removeEventListener("visibilitychange", alVolver);
      cerrar();
    };
  }, [canal, firma, router]);

  return null;
}
