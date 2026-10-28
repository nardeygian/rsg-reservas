import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { TZ } from "@/lib/datetime";
import type { ClienteServir } from "./supabase";

// Lecturas de las pantallas de B3. Todas con la sesión del usuario: lo que
// RLS no deja ver simplemente no llega.

export function hoyBogota(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// "dom 9 nov · 9:00 a. m." — la hora solo si la reunión la tiene.
// Primer y último día del mes de una fecha YYYY-MM-DD.
export function bordesDelMes(fecha: string): [string, string] {
  const [y, m] = fecha.split("-").map(Number);
  const fin = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return [`${y}-${mm}-01`, `${y}-${mm}-${String(fin).padStart(2, "0")}`];
}

export function fechaReunion(meeting_date: string, starts_at: string | null): string {
  const dia = formatInTimeZone(new Date(`${meeting_date}T12:00:00Z`), "UTC", "EEE d MMM", { locale: es });
  if (!starts_at) return dia;
  return `${dia} · ${formatInTimeZone(new Date(starts_at), TZ, "h:mm a", { locale: es })}`;
}

export function fechaCorta(fecha: string): string {
  return formatInTimeZone(new Date(`${fecha}T12:00:00Z`), "UTC", "d MMM", { locale: es });
}

// ── Alcances: en qué equipos puede asignar el usuario ───────────────────

export type Equipo = {
  key: string;               // "d:<ministry_id>" o "a:<area_id>"
  ministry_id: string;
  ministry_name: string;
  area_id: string | null;    // con valor: líder de área (solo esa área)
  area_name: string | null;
};

export async function misEquipos(db: ClienteServir): Promise<Equipo[]> {
  const { data: alcances } = await db.rpc("permission_scopes", { p_permission: "servir.asignar" });
  if (!alcances?.length) return [];

  const global = alcances.some((a) => a.scope_type === null);
  const deptIds = alcances.filter((a) => a.scope_type === "departamento").map((a) => a.scope_id);
  const areaIds = alcances.filter((a) => a.scope_type === "area").map((a) => a.scope_id);

  const [ministerios, areas] = await Promise.all([
    global
      ? db.from("ministries").select("id, name").eq("type", "departamento").order("name")
      : deptIds.length ? db.from("ministries").select("id, name").in("id", deptIds).order("name") : Promise.resolve({ data: [] }),
    areaIds.length ? db.from("areas").select("id, name, ministry_id, ministries(name)").in("id", areaIds).order("name") : Promise.resolve({ data: [] }),
  ]);

  const equipos: Equipo[] = (ministerios.data ?? []).map((m) => ({
    key: `d:${m.id}`, ministry_id: m.id, ministry_name: m.name, area_id: null, area_name: null,
  }));
  const conDepto = new Set(equipos.map((e) => e.ministry_id));
  for (const a of (areas.data ?? []) as { id: string; name: string; ministry_id: string; ministries: { name: string } | null }[]) {
    if (conDepto.has(a.ministry_id)) continue;   // ya lo gestiona entero
    equipos.push({ key: `a:${a.id}`, ministry_id: a.ministry_id, ministry_name: a.ministries?.name ?? "", area_id: a.id, area_name: a.name });
  }
  return equipos;
}

// ── Mi equipo ───────────────────────────────────────────────────────────

export type AreaFila = { id: string; name: string };
export type PuntoChecklist = { id: string; moment: string; text: string; sort: number };
export type PosicionFila = {
  id: string; name: string; description: string | null; area_id: string | null; active: boolean; sort: number;
  checklist: PuntoChecklist[];
};
export type MiembroFila = {
  team_member_id: string;
  person_id: string;
  full_name: string;
  tiene_cuenta: boolean;
  email: string | null;
  phone: string | null;
  area_id: string | null;
  posiciones: string[];              // ids de positions del equipo
  bloqueos: { starts_on: string; ends_on: string; reason: string | null }[];
  servicios_mes: number;
  aceptadas: number;
  rechazadas: number;
};
export type PersonaOpcion = { id: string; full_name: string };

export async function datosEquipo(db: ClienteServir, equipo: Equipo) {
  const hoy = hoyBogota();
  const [mesDesde, mesHasta] = bordesDelMes(hoy);

  let miembrosQ = db.from("team_members").select("id, person_id, area_id, people(full_name, profile_id, active, email, phone)")
    .eq("ministry_id", equipo.ministry_id).eq("active", true);
  if (equipo.area_id) miembrosQ = miembrosQ.eq("area_id", equipo.area_id);
  let posicionesQ = db.from("positions").select("id, name, description, area_id, active, sort")
    .eq("ministry_id", equipo.ministry_id).order("sort").order("name");
  if (equipo.area_id) posicionesQ = posicionesQ.eq("area_id", equipo.area_id);

  const [areasR, posicionesR, miembrosR, personasR] = await Promise.all([
    db.from("areas").select("id, name").eq("ministry_id", equipo.ministry_id).order("name"),
    posicionesQ,
    miembrosQ,
    db.from("people").select("id, full_name").eq("active", true).order("full_name").limit(2000),
  ]);

  const posiciones = posicionesR.data ?? [];
  const posIds = posiciones.map((p) => p.id);
  type MiembroRaw = { id: string; person_id: string; area_id: string | null; people: { full_name: string; profile_id: string | null; active: boolean; email: string | null; phone: string | null } | null };
  const miembrosRaw = ((miembrosR.data ?? []) as MiembroRaw[]).filter((m) => m.people?.active !== false);
  const personIds = [...new Set(miembrosRaw.map((m) => m.person_id))];

  const vacio = Promise.resolve({ data: [] as never[] });
  const [checklistR, sabenR, bloqueosR, unidadesR, respuestasR] = await Promise.all([
    posIds.length ? db.from("checklist_templates").select("id, position_id, moment, text, sort").in("position_id", posIds).order("sort") : vacio,
    posIds.length && personIds.length ? db.from("person_positions").select("person_id, position_id").in("position_id", posIds).in("person_id", personIds) : vacio,
    personIds.length ? db.from("availability_blocks").select("person_id, starts_on, ends_on, reason").in("person_id", personIds).gte("ends_on", hoy).order("starts_on") : vacio,
    personIds.length ? db.from("service_units").select("person_id").in("person_id", personIds).gte("meeting_date", mesDesde).lte("meeting_date", mesHasta) : vacio,
    personIds.length ? db.from("assignments").select("person_id, status").in("person_id", personIds).eq("ministry_id", equipo.ministry_id).in("status", ["aceptada", "rechazada"]) : vacio,
  ]);

  const checklistDe = new Map<string, PuntoChecklist[]>();
  for (const c of (checklistR.data ?? []) as { id: string; position_id: string; moment: string; text: string; sort: number }[]) {
    const l = checklistDe.get(c.position_id) ?? [];
    l.push({ id: c.id, moment: c.moment, text: c.text, sort: c.sort });
    checklistDe.set(c.position_id, l);
  }
  const contar = <T,>(filas: T[], k: (f: T) => string | null) => {
    const m = new Map<string, number>();
    for (const f of filas) { const key = k(f); if (key) m.set(key, (m.get(key) ?? 0) + 1); }
    return m;
  };
  const respuestas = (respuestasR.data ?? []) as { person_id: string; status: string }[];
  const aceptadas = contar(respuestas.filter((r) => r.status === "aceptada"), (r) => r.person_id);
  const rechazadas = contar(respuestas.filter((r) => r.status === "rechazada"), (r) => r.person_id);
  const servicios = contar((unidadesR.data ?? []) as { person_id: string | null }[], (u) => u.person_id);

  const miembros: MiembroFila[] = miembrosRaw.map((m) => ({
    team_member_id: m.id,
    person_id: m.person_id,
    full_name: m.people?.full_name ?? "—",
    tiene_cuenta: !!m.people?.profile_id,
    email: m.people?.email ?? null,
    phone: m.people?.phone ?? null,
    area_id: m.area_id,
    posiciones: ((sabenR.data ?? []) as { person_id: string; position_id: string }[]).filter((s) => s.person_id === m.person_id).map((s) => s.position_id),
    bloqueos: ((bloqueosR.data ?? []) as { person_id: string; starts_on: string; ends_on: string; reason: string | null }[])
      .filter((b) => b.person_id === m.person_id).map(({ starts_on, ends_on, reason }) => ({ starts_on, ends_on, reason })),
    servicios_mes: servicios.get(m.person_id) ?? 0,
    aceptadas: aceptadas.get(m.person_id) ?? 0,
    rechazadas: rechazadas.get(m.person_id) ?? 0,
  })).sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));

  return {
    areas: (areasR.data ?? []) as AreaFila[],
    posiciones: posiciones.map((p) => ({ ...p, checklist: checklistDe.get(p.id) ?? [] })) as PosicionFila[],
    miembros,
    personas: (personasR.data ?? []) as PersonaOpcion[],
  };
}

// ── Reuniones próximas con la cobertura del equipo ─────────────────────

export type ReunionResumen = {
  id: string; name: string; meeting_date: string; starts_at: string | null; status: string;
  aceptadas: number; pendientes: number; rechazadas: number;
};

export async function reunionesProximas(db: ClienteServir, equipo: Equipo, dias = 60): Promise<ReunionResumen[]> {
  const hoy = hoyBogota();
  const { data: reuniones } = await db.from("meetings").select("id, name, meeting_date, starts_at, status")
    .gte("meeting_date", hoy).lte("meeting_date", sumarDias(hoy, dias)).neq("status", "cancelada")
    .order("meeting_date").order("starts_at", { nullsFirst: true }).limit(60);
  if (!reuniones?.length) return [];

  let q = db.from("assignments").select("meeting_id, status").in("meeting_id", reuniones.map((r) => r.id)).eq("ministry_id", equipo.ministry_id);
  if (equipo.area_id) q = q.eq("area_id", equipo.area_id);
  const { data: asignaciones } = await q;

  return reuniones.map((r) => {
    const mias = (asignaciones ?? []).filter((a) => a.meeting_id === r.id);
    return {
      ...r,
      aceptadas: mias.filter((a) => a.status === "aceptada").length,
      pendientes: mias.filter((a) => a.status === "pendiente").length,
      rechazadas: mias.filter((a) => a.status === "rechazada").length,
    };
  });
}
