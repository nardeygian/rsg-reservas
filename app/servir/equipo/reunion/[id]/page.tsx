import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import type { PosicionRequerida } from "@/lib/servir/contratos";
import { clienteServir } from "../../_lib/supabase";
import { fechaReunion, misEquipos } from "../../_lib/datos";
import { AsignarVista, type AsignadoFila, type PosicionAsignar } from "../../_components/AsignarVista";
import { Avatar, EstadoChip } from "../../_components/ui";

type AsignacionRaw = {
  id: string; person_id: string; position_id: string; ministry_id: string; area_id: string | null;
  status: string; decline_reason: string | null;
  people: { full_name: string } | null;
  positions: { name: string; sort: number } | null;
  ministries: { name: string } | null;
};

export default async function AsignarReunionPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ equipo?: string }>;
}) {
  const db = await clienteServir();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const [{ id }, { equipo: equipoKey }] = await Promise.all([params, searchParams]);
  const equipos = await misEquipos(db);
  if (equipos.length === 0) redirect("/servir/mis-servicios");
  const equipo = equipos.find((e) => e.key === equipoKey) ?? equipos[0];

  const { data: reunion } = await db.from("meetings")
    .select("id, name, meeting_date, starts_at, status, template_id").eq("id", id).maybeSingle();
  if (!reunion) notFound();

  let posQ = db.from("positions").select("id, name, sort").eq("ministry_id", equipo.ministry_id).eq("active", true).order("sort").order("name");
  if (equipo.area_id) posQ = posQ.eq("area_id", equipo.area_id);

  const [asignacionesR, posicionesR, plantillaR] = await Promise.all([
    db.from("assignments")
      .select("id, person_id, position_id, ministry_id, area_id, status, decline_reason, people(full_name), positions(name, sort), ministries(name)")
      .eq("meeting_id", id).neq("status", "cancelada"),
    posQ,
    reunion.template_id
      ? db.from("meeting_templates").select("required_positions").eq("id", reunion.template_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const asignaciones = (asignacionesR.data ?? []) as AsignacionRaw[];

  // Checklists: RLS solo devuelve los de la gente que este líder puede
  // asignar (su departamento o área). No se filtra nada más aquí.
  const { data: items } = asignaciones.length
    ? await db.from("checklist_items").select("assignment_id, done_at").in("assignment_id", asignaciones.map((a) => a.id))
    : { data: [] };
  const progreso = new Map<string, { hechos: number; total: number }>();
  for (const it of items ?? []) {
    const p = progreso.get(it.assignment_id) ?? { hechos: 0, total: 0 };
    p.total++; if (it.done_at) p.hechos++;
    progreso.set(it.assignment_id, p);
  }

  const requeridas = new Map<string, number>();
  for (const r of ((plantillaR.data?.required_positions ?? []) as PosicionRequerida[])) {
    if (r?.position_id) requeridas.set(r.position_id, r.count);
  }

  const fila = (a: AsignacionRaw): AsignadoFila => ({
    id: a.id, person_id: a.person_id, full_name: a.people?.full_name ?? "—", status: a.status,
    decline_reason: a.decline_reason, checklist: progreso.get(a.id) ?? null,
  });
  const orden = { aceptada: 0, pendiente: 1, rechazada: 2 } as Record<string, number>;
  const mias: PosicionAsignar[] = (posicionesR.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    requeridas: requeridas.get(p.id) ?? null,
    asignados: asignaciones.filter((a) => a.position_id === p.id).map(fila).sort((x, y) => (orden[x.status] ?? 9) - (orden[y.status] ?? 9)),
  }));

  // Equipo completo de la reunión, por departamento.
  const porDepto = new Map<string, { nombre: string; filas: AsignacionRaw[] }>();
  for (const a of asignaciones) {
    const g = porDepto.get(a.ministry_id) ?? { nombre: a.ministries?.name ?? "—", filas: [] };
    g.filas.push(a);
    porDepto.set(a.ministry_id, g);
  }
  const deptos = [...porDepto.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
  for (const d of deptos) d.filas.sort((x, y) => (x.positions?.sort ?? 0) - (y.positions?.sort ?? 0) || (x.positions?.name ?? "").localeCompare(y.positions?.name ?? "", "es"));

  const editable = !["cerrada", "cancelada"].includes(reunion.status);

  return (
    <main className="min-h-dvh px-4 pt-6 max-w-[1180px] mx-auto w-full flex flex-col gap-5" style={{ paddingBottom: "calc(var(--nav-space) + 24px)" }}>
      <Link href={`/servir/equipo?equipo=${encodeURIComponent(equipo.key)}&vista=reuniones`} className="btn-ghost self-start -ml-3 px-3 min-h-[40px] text-[14px]">
        <Icon name="chevron-left" /> Reuniones
      </Link>
      <header className="flex flex-col gap-1">
        <p className="eyebrow capitalize">{fechaReunion(reunion.meeting_date, reunion.starts_at)}</p>
        <h1 className="page-title">{reunion.name}</h1>
        <Link href={`/servir/reuniones/${reunion.id}`} className="text-[14px] font-medium self-start" style={{ color: "var(--color-accent)" }}>Ver orden y detalles de la reunión</Link>
        {!editable && <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>Esta reunión está {reunion.status}: ya no se cambian asignaciones.</p>}
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow px-1">Tu parte · {equipo.area_name ?? equipo.ministry_name}</h2>
        <AsignarVista meetingId={reunion.id} reunionNombre={reunion.name} posiciones={mias} editable={editable} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow px-1">Equipo de la reunión</h2>
        {deptos.length === 0 ? (
          <p className="card px-4 py-5 text-sm" style={{ color: "var(--color-muted)" }}>Nadie asignado todavía.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {deptos.map((d) => (
              <div key={d.nombre} className="card px-4 py-3 flex flex-col gap-1">
                <h3 className="text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>{d.nombre}</h3>
                <ul className="flex flex-col">
                  {d.filas.map((a) => (
                    <li key={a.id} className="flex items-center gap-2.5 min-h-[44px]">
                      <Avatar nombre={a.people?.full_name ?? "—"} size={28} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] truncate" style={{ color: "var(--color-ink)" }}>{a.people?.full_name ?? "—"}</span>
                        <span className="block text-[12px] truncate" style={{ color: "var(--color-muted)" }}>{a.positions?.name}</span>
                      </span>
                      <EstadoChip estado={a.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
