import { redirect } from "next/navigation";
import { clienteServir } from "../equipo/_lib/supabase";
import { EstructuraVista, type Autorizable, type Depto, type Rol } from "./EstructuraVista";

export const metadata = { title: "Estructura · Servir" };

export default async function EstructuraPage() {
  const db = await clienteServir();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const [{ data: puede }, { data: liderPlaneacion }, { data: planeacionId }] = await Promise.all([
    db.rpc("puede_estructura"),
    db.rpc("es_lider_planeacion"),
    db.rpc("ministerio_que_planea"),
  ]);
  if (puede !== true) redirect("/servir");

  const [deptosR, areasR, rolesR, miembrosR, grantsR] = await Promise.all([
    db.from("ministries").select("id, name, is_planning").eq("type", "departamento").order("name"),
    db.from("areas").select("id, name, ministry_id").order("name"),
    db.from("positions").select("id, name, ministry_id, area_id, grupo, active, sort").order("sort").order("name"),
    // Candidatos a autorizar: los del departamento que planea con cuenta.
    planeacionId
      ? db.from("team_members").select("people(full_name, profile_id)").eq("ministry_id", planeacionId).eq("active", true)
      : Promise.resolve({ data: [] }),
    liderPlaneacion === true
      ? db.from("user_permissions").select("user_id").eq("permission", "servir.asignar_planeacion").eq("effect", "grant")
      : Promise.resolve({ data: [] }),
  ]);

  const areas = (areasR.data ?? []) as { id: string; name: string; ministry_id: string }[];
  const roles = (rolesR.data ?? []) as Rol[];
  const deptos: Depto[] = ((deptosR.data ?? []) as { id: string; name: string; is_planning: boolean }[]).map((d) => ({
    ...d,
    areas: areas.filter((a) => a.ministry_id === d.id).map(({ id, name }) => ({ id, name })),
  }));

  const autorizados = new Set(((grantsR.data ?? []) as { user_id: string }[]).map((g) => g.user_id));
  const candidatos = new Map<string, string>();
  for (const m of (miembrosR.data ?? []) as { people: { full_name: string; profile_id: string | null } | null }[]) {
    if (m.people?.profile_id) candidatos.set(m.people.profile_id, m.people.full_name);
  }
  const personas: Autorizable[] = [...new Set([...candidatos.keys(), ...autorizados])].map((id) => ({
    profile_id: id, full_name: candidatos.get(id) ?? "Cuenta fuera de Planeación", autorizado: autorizados.has(id),
  })).sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));

  return (
    <main className="min-h-dvh px-4 pt-6 max-w-[1180px] mx-auto w-full flex flex-col gap-5" style={{ paddingBottom: "calc(var(--nav-space) + 24px)" }}>
      <header className="flex flex-col gap-1">
        <p className="eyebrow">Servir</p>
        <h1 className="page-title">Estructura</h1>
        <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
          Departamentos, áreas y roles. Cada líder asigna los roles de su departamento o de su área.
        </p>
      </header>
      <EstructuraVista
        deptos={deptos}
        roles={roles}
        planeacionId={planeacionId ?? null}
        autorizables={liderPlaneacion === true ? personas : null}
      />
    </main>
  );
}
