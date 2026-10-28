import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { ServirNav, type EnlaceServir } from "./ServirNav";

// Menú común de Servir. Solo decide qué enlaces mostrar; cada página y la
// base (RLS) siguen revisando el permiso real.
export default async function ServirLayout({ children }: { children: ReactNode }) {
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) return children;

  const tiene = async (p: string) => (await db.rpc("has_permission", { p_permission: p })).data === true;
  const [verReuniones, verTodo, plantillas, estadisticas, asignar] = await Promise.all([
    tiene("servir.ver_reuniones"),
    tiene("servir.ver_todo"),
    tiene("servir.plantillas"),
    db.rpc("puede_ver_estadisticas").then((r) => r.data === true),
    tiene("servir.asignar"),
  ]);

  const enlaces: EnlaceServir[] = [
    { href: "/servir/mis-servicios", texto: "Mis servicios" },
    ...(asignar ? [{ href: "/servir/equipo", texto: "Mi equipo" }] : []),
    ...(verReuniones || verTodo ? [{ href: "/servir/reuniones", texto: "Reuniones" }] : []),
    { href: "/servir/canciones", texto: "Canciones" },
    ...(plantillas ? [{ href: "/servir/plantillas", texto: "Plantillas" }] : []),
    ...(estadisticas ? [{ href: "/servir/estadisticas", texto: "Estadísticas" }] : []),
  ];

  return (
    <>
      <ServirNav enlaces={enlaces} />
      {children}
    </>
  );
}
