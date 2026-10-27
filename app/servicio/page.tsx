import { redirect } from "next/navigation";
import { getUserCaps } from "@/lib/auth";
import { svReadData } from "./_lib/data";
import { ServicioShell } from "./_components/ServicioShell";
import type { SvData } from "./_lib/types";

export default async function ServicioPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const caps = await getUserCaps();
  if (!caps) redirect("/login");
  if (caps.servicio === "none") redirect("/?error=Sin+acceso+al+módulo+de+Servicio");

  const { preview } = await searchParams;
  let canEdit = caps.servicio === "edit";

  // Admin previewing read-only view
  if (preview === "pastor" && canEdit) canEdit = false;

  let svData: SvData | null = null;
  let needsMigration = false;
  try {
    svData = await svReadData();
  } catch {
    needsMigration = true;
  }

  // Pastores de ministerio: filtrar reuniones a su ministerio
  if (svData && caps.ministerioNombre && caps.servicio === "read") {
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const mn = norm(caps.ministerioNombre);
    const filteredReus: SvData["reuniones"] = {};
    for (const [id, r] of Object.entries(svData.reuniones)) {
      if (norm(r.seccion).includes(mn) || norm(r.nombre).includes(mn)) {
        filteredReus[id] = r;
      }
    }
    svData = { ...svData, reuniones: filteredReus };
  }

  return (
    <main className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {needsMigration ? (
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-sm rounded-[12px] px-4 py-4"
            style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)", border: "1px solid var(--color-gold)" }}>
            El módulo de Servicio necesita una migración de base de datos.
            Aplica el archivo <code>supabase/migrations/20261009040000_servicio.sql</code> en el dashboard de Supabase.
          </p>
        </div>
      ) : (
        <ServicioShell svData={svData!} canEdit={canEdit} />
      )}
    </main>
  );
}
