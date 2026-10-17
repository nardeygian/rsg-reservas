import { redirect } from "next/navigation";
import { getUserCaps } from "@/lib/auth";
import { donReadData, donVincularAction } from "./actions";
import { svReadData } from "@/app/servicio/actions";
import { DonacionesShell } from "./_components/DonacionesShell";
import { DonacionesRealtime } from "./_components/DonacionesRealtime";
import type { Donacion } from "./_lib/types";
import type { SvGrupo, SvMiembro } from "@/app/servicio/_lib/types";

export default async function DonacionesPage() {
  const caps = await getUserCaps();
  if (!caps) redirect("/login");
  if (caps.donaciones === "none") redirect("/?error=Sin+acceso+al+módulo+de+Donaciones");
  const readOnly = caps.donaciones === "filtered";

  let donaciones: Donacion[] = [];
  let grupos: SvGrupo[] = [];
  let miembros: SvMiembro[] = [];
  let needsMigration = false;

  try {
    donaciones = await donReadData();
  } catch {
    needsMigration = true;
  }

  if (!needsMigration) {
    try {
      const svData = await svReadData();
      grupos   = Object.values(svData?.grupos   ?? {});
      miembros = Object.values(svData?.miembros ?? {});
    } catch {
      // grupos not available yet — donaciones still works without them
    }

    // Auto-link obvious matches silently (only for full-access users)
    if (!readOnly && donaciones.some(d => !d.di && !d.ext) && miembros.length > 0) {
      const { vinculadas } = await donVincularAction();
      if (vinculadas > 0) donaciones = await donReadData();
    }

    // Filter to group for líderes de discipulado
    if (readOnly) {
      if (!caps.disciGrupoId) {
        // No group assigned yet — show nothing (avoid leaking all data)
        donaciones = [];
        grupos = [];
        miembros = [];
      } else {
        donaciones = donaciones.filter(d =>
          d.gid === caps.disciGrupoId || (d.sg && caps.disciGrupoId! in d.sg)
        );
        // Scope grupos and miembros to only the lider's group so the shell
        // doesn't expose other groups' member names
        grupos = grupos.filter(g => g.id === caps.disciGrupoId);
        miembros = miembros.filter(m => m.grupo_id === caps.disciGrupoId);
      }
    }
  }

  return (
    <main className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {needsMigration ? (
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-sm rounded-[12px] px-4 py-4"
            style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)", border: "1px solid var(--color-gold)" }}>
            El módulo de Donaciones necesita una migración de base de datos.
            Aplica el archivo <code>supabase/migrations/20261010000000_donaciones.sql</code> en el dashboard de Supabase.
          </p>
        </div>
      ) : (
        <>
          <DonacionesRealtime />
          <DonacionesShell donaciones={donaciones} grupos={grupos} miembros={miembros} readOnly={readOnly} />
        </>
      )}
    </main>
  );
}
