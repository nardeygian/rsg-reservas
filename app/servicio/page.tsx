import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { svReadData } from "./actions";
import { ServicioShell } from "./_components/ServicioShell";
import type { SvData } from "./_lib/types";

export default async function ServicioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";

  let canEdit = ["super_admin", "pastor_sede"].includes(role);
  if (!canEdit) {
    const { data: extraRoles } = await supabase
      .from("user_roles").select("role, ministries(name)").eq("user_id", user.id);
    canEdit = (extraRoles ?? []).some(
      (r) => r.role === "lider_departamento" &&
        (r.ministries as { name: string } | null)?.name === "Planeación"
    );
  }

  if (!canEdit && !["pastor_ministerio", "lider_discipulado", "lider_departamento"].includes(role)) {
    redirect("/?error=Sin+acceso+al+módulo+de+Servicio");
  }

  let svData: SvData | null = null;
  let needsMigration = false;
  try {
    svData = await svReadData();
  } catch {
    needsMigration = true;
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
