import { redirect } from "next/navigation";
import { clienteServir } from "@/app/servir/equipo/_lib/supabase";
import { fechaCorta } from "@/app/servir/equipo/_lib/datos";
import { FormUnirme, type SolicitudPropia } from "./FormUnirme";

// "Únete a un departamento": para quien entró con Google o Apple sin
// invitación (rol servidor) o quiere sumarse a otro equipo. Su líder de
// departamento, un pastor de sede o un super admin aprueba.
export default async function UnirmePage() {
  const db = await clienteServir();
  const { data: claims } = await db.auth.getClaims();
  const uid = claims?.claims.sub;
  if (!uid) redirect("/login?next=/servir/unirme");

  const { data: personId } = await db.rpc("current_person_id");
  const [depsR, solR, equiposR] = await Promise.all([
    db.from("ministries").select("id, name").eq("type", "departamento").order("name"),
    db.from("team_join_requests").select("id, ministry_id, status, message, decision_note, created_at, ministries(name)")
      .eq("profile_id", uid).order("created_at", { ascending: false }).limit(10),
    personId
      ? db.from("team_members").select("ministry_id").eq("person_id", personId).eq("active", true)
      : Promise.resolve({ data: [] as { ministry_id: string }[] }),
  ]);

  const miembroDe = new Set((equiposR.data ?? []).map((t) => t.ministry_id));
  const solicitudes: SolicitudPropia[] = (solR.data ?? [])
    .filter((s) => s.status !== "cancelada")
    .map((s) => ({
      id: s.id,
      ministry_id: s.ministry_id,
      departamento: (s.ministries as { name: string } | null)?.name ?? "",
      status: s.status,
      nota: s.decision_note,
      fecha: fechaCorta(s.created_at.slice(0, 10)),
    }));
  const pendientes = new Set(solicitudes.filter((s) => s.status === "pendiente").map((s) => s.ministry_id));
  const departamentos = (depsR.data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    estado: miembroDe.has(d.id) ? ("miembro" as const) : pendientes.has(d.id) ? ("pendiente" as const) : null,
  }));

  return (
    <main className="min-h-dvh px-4 pt-6 max-w-[640px] mx-auto w-full flex flex-col gap-5" style={{ paddingBottom: "calc(var(--nav-space) + 24px)" }}>
      <header className="flex flex-col gap-1">
        <p className="eyebrow">Servir</p>
        <h1 className="page-title">Únete a un departamento</h1>
        <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
          Escoge dónde sirves. El líder de ese departamento recibe tu solicitud y, cuando la apruebe, podrá asignarte en las reuniones.
        </p>
      </header>
      <FormUnirme departamentos={departamentos} solicitudes={solicitudes} />
    </main>
  );
}
