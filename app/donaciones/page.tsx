import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { donReadData } from "./actions";
import { svReadData } from "@/app/servicio/actions";
import { DonacionesShell } from "./_components/DonacionesShell";
import { DonacionesRealtime } from "./_components/DonacionesRealtime";
import type { Donacion } from "./_lib/types";
import type { SvGrupo, SvMiembro } from "@/app/servicio/_lib/types";

export default async function DonacionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";

  if (!["super_admin", "pastor_sede"].includes(role)) {
    redirect("/?error=Sin+acceso+al+módulo+de+Donaciones");
  }

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
          <DonacionesShell donaciones={donaciones} grupos={grupos} miembros={miembros} />
        </>
      )}
    </main>
  );
}
