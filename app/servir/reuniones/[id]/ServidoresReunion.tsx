import Link from "next/link";
import { Icon } from "@/app/_components/ui/Icon";
import type { PosicionRequerida } from "@/lib/servir/contratos";
import { clienteServir } from "../../equipo/_lib/supabase";
import type { Equipo } from "../../equipo/_lib/datos";
import { AsignarVista, type AsignadoFila, type PosicionAsignar } from "../../equipo/_components/AsignarVista";

// Pestaña Servidores de una reunión: Departamento → Área → Rol → asignados,
// solo de los equipos que el usuario puede asignar (misEquipos sigue la
// jerarquía; la base vuelve a exigirla en RLS).

type Posicion = { id: string; name: string; sort: number; ministry_id: string | null; area_id: string | null; grupo: string | null };
type Asignacion = { id: string; person_id: string; position_id: string; status: string; decline_reason: string | null; people: { full_name: string } | null };
type Grupo = { clave: string; titulo: string | null; posiciones: PosicionAsignar[] };
type Bloque = { equipo: Equipo; grupos: Grupo[]; cubiertas: number; total: number };

const ORDEN_ESTADO: Record<string, number> = { aceptada: 0, pendiente: 1, rechazada: 2 };

export async function ServidoresReunion({ meetingId, reunionNombre, templateId, editable, equipos }: {
  meetingId: string; reunionNombre: string; templateId: string | null; editable: boolean;
  equipos: Equipo[];   // misEquipos(), ya calculado por la página
}) {
  const db = await clienteServir();
  if (equipos.length === 0) {
    return <p className="card px-4 py-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>No tienes equipos para asignar en esta reunión.</p>;
  }

  const deptIds = [...new Set(equipos.map((e) => e.ministry_id).filter((m): m is string => !!m))];
  const conGeneral = equipos.some((e) => !e.ministry_id);
  const campos = "id, name, sort, ministry_id, area_id, grupo";
  const [porDepto, generales, areasR, asignR, plantillaR] = await Promise.all([
    deptIds.length ? db.from("positions").select(campos).in("ministry_id", deptIds).eq("active", true).order("sort").order("name") : Promise.resolve({ data: [] }),
    conGeneral ? db.from("positions").select(campos).is("ministry_id", null).eq("active", true).order("grupo").order("sort").order("name") : Promise.resolve({ data: [] }),
    deptIds.length ? db.from("areas").select("id, name").in("ministry_id", deptIds).order("name") : Promise.resolve({ data: [] }),
    db.from("assignments").select("id, person_id, position_id, status, decline_reason, people(full_name)")
      .eq("meeting_id", meetingId).neq("status", "cancelada"),
    templateId ? db.from("meeting_templates").select("required_positions").eq("id", templateId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const posiciones = [...(porDepto.data ?? []), ...(generales.data ?? [])] as Posicion[];
  const areas = new Map(((areasR.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));
  const asignaciones = (asignR.data ?? []) as Asignacion[];

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
  for (const r of ((plantillaR.data?.required_positions ?? []) as PosicionRequerida[])) if (r?.position_id) requeridas.set(r.position_id, r.count);

  const fila = (a: Asignacion): AsignadoFila => ({
    id: a.id, person_id: a.person_id, full_name: a.people?.full_name ?? "—", status: a.status,
    decline_reason: a.decline_reason, checklist: progreso.get(a.id) ?? null,
  });
  const aAsignar = (p: Posicion): PosicionAsignar => ({
    id: p.id, name: p.name, requeridas: requeridas.get(p.id) ?? null,
    asignados: asignaciones.filter((a) => a.position_id === p.id).map(fila)
      .sort((x, y) => (ORDEN_ESTADO[x.status] ?? 9) - (ORDEN_ESTADO[y.status] ?? 9)),
  });

  const bloques: Bloque[] = equipos.map((equipo) => {
    const suyas = posiciones.filter((p) => equipo.ministry_id
      ? p.ministry_id === equipo.ministry_id && (!equipo.area_id || p.area_id === equipo.area_id)
      : p.ministry_id === null);
    // Departamento: primero los roles de todo el departamento, luego cada
    // área. Roles generales: por grupo (VIO, Escenario…).
    const claveDe = (p: Posicion) => equipo.ministry_id ? (p.area_id ?? "") : (p.grupo ?? "");
    const tituloDe = (clave: string) => equipo.ministry_id ? (clave ? areas.get(clave) ?? "Área" : null) : (clave || null);
    const claves = [...new Set(suyas.map(claveDe))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : (tituloDe(a) ?? "").localeCompare(tituloDe(b) ?? "", "es")));
    const grupos = claves.map((clave) => ({ clave, titulo: tituloDe(clave), posiciones: suyas.filter((p) => claveDe(p) === clave).map(aAsignar) }));
    const cubiertas = grupos.flatMap((g) => g.posiciones).filter((p) => p.asignados.some((a) => a.status !== "rechazada")).length;
    return { equipo, grupos, cubiertas, total: suyas.length };
  });

  return (
    <div className="flex flex-col gap-3">
      {bloques.map(({ equipo, grupos, cubiertas, total }) => (
        // Con un solo equipo abre directo; con varios (p. ej. super admin)
        // cada departamento se pliega y muestra su cobertura.
        <details key={equipo.key} open={bloques.length === 1} className="group flex flex-col gap-3">
          <summary className="card px-4 py-3 flex items-center gap-3 cursor-pointer list-none min-h-[56px] [&::-webkit-details-marker]:hidden">
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-semibold truncate" style={{ color: "var(--color-ink)" }}>
                {equipo.ministry_id ? equipo.ministry_name : "Roles generales"}
                {equipo.area_name && <span style={{ color: "var(--color-muted)" }}> · {equipo.area_name}</span>}
              </span>
              <span className="block text-[13px] tabular" style={{ color: cubiertas < total ? "var(--color-gold-text)" : "var(--color-muted)" }}>
                {total === 0 ? "Sin roles" : `${cubiertas} de ${total} roles cubiertos`}
              </span>
            </span>
            <Icon name="chevron-down" size={18} className="flex-none transition-transform group-open:rotate-180" style={{ color: "var(--color-muted)" }} />
          </summary>
          <div className="flex flex-col gap-3 pt-3">
          {grupos.length === 0 ? (
            <AsignarVista meetingId={meetingId} reunionNombre={reunionNombre} posiciones={[]} editable={editable} />
          ) : grupos.map((g) => (
            <div key={g.clave || "base"} className="flex flex-col gap-2">
              {g.titulo && <h3 className="eyebrow px-1">{g.titulo}</h3>}
              <AsignarVista meetingId={meetingId} reunionNombre={reunionNombre} posiciones={g.posiciones} editable={editable} />
            </div>
          ))}
          </div>
        </details>
      ))}
      <p className="text-xs px-1" style={{ color: "var(--color-faint)" }}>
        Solo aparecen quienes tienen el rol marcado en <Link href="/servir/equipo" className="underline">Mi equipo › Miembros</Link>.
      </p>
    </div>
  );
}
