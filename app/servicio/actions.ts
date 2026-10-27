"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCalendarEvents } from "@/lib/asana";
import { svNorm } from "./_lib/sv-logic";
import type { SvData, SvFila, SvGrupo, SvMiembro } from "./_lib/types";
import { svTable, svReadData, normalizeSvData, DEFAULT_DATA } from "./_lib/data";
import { nextUpdatedAt } from "@/app/donaciones/_lib/data";

async function assertAccess(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";

  if (["super_admin", "pastor_sede"].includes(role)) return;

  const { data: extraRoles } = await supabase
    .from("user_roles").select("role, ministries(name)").eq("user_id", user.id);
  const hasPlaneacion = (extraRoles ?? []).some(
    (r) => r.role === "lider_departamento" &&
      (r.ministries as { name: string } | null)?.name === "Planeación"
  );
  if (hasPlaneacion) return;

  throw new Error("Sin acceso al módulo de Servicio");
}

// Igual que donMutate: la escritura solo se aplica si updated_at no cambió
// desde la lectura, para no pisar a otra persona editando al mismo tiempo.
async function mutate<T>(fn: (d: SvData) => T): Promise<T> {
  const service = createServiceClient();
  for (let intento = 0; intento < 6; intento++) {
    const { data } = await svTable(service).select("data, updated_at").eq("id", "main").maybeSingle();
    const d: SvData = normalizeSvData(structuredClone((data?.data as SvData | null) ?? DEFAULT_DATA));
    const result = fn(d);

    let guardado: boolean;
    if (!data) {
      const { error } = await svTable(service).insert({ id: "main", data: d, updated_at: nextUpdatedAt(null) });
      guardado = !error;
    } else {
      const { data: escritas, error } = await svTable(service)
        .update({ data: d, updated_at: nextUpdatedAt(data.updated_at) })
        .eq("id", "main")
        .eq("updated_at", data.updated_at)
        .select("id");
      if (error) throw new Error(`No se pudo guardar Servicio: ${error.message}`);
      guardado = (escritas ?? []).length > 0;
    }
    if (guardado) {
      revalidatePath("/servicio");
      return result;
    }
  }
  throw new Error("Otra persona está guardando cambios en Servicio; intenta de nuevo.");
}

function svCleanName(n: string): string {
  n = n.trim().replace(/\s+/g, " ");
  if (n && (n === n.toUpperCase() || n === n.toLowerCase())) {
    n = n.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase());
    n = n.replace(/\b(De|Del|La|Las|Los|Y)\b/g, x => x.toLowerCase());
    n = n.charAt(0).toUpperCase() + n.slice(1);
  }
  return n.slice(0, 120);
}

export async function svSyncAction(): Promise<{ ok: boolean; reuniones?: number; error?: string }> {
  await assertAccess();
  try {
    const events = await getCalendarEvents();
    const count = await mutate((d) => {
      const vistas: Record<string, boolean> = {};
      for (const e of events) {
        d.reuniones[e.gid] = {
          id: e.gid, nombre: e.name, fecha: e.due_on,
          seccion: e.category ?? "", origen: "asana",
        };
        vistas[e.gid] = true;
      }
      for (const [id, r] of Object.entries(d.reuniones)) {
        if (r.origen === "asana" && !vistas[id]) {
          if (!d.registros[id]?.filas?.length) delete d.reuniones[id];
          else d.reuniones[id].fuera_de_asana = true;
        }
      }
      d.sync = Math.floor(Date.now() / 1000);
      d.sync_error = "";
      return events.length;
    });
    return { ok: true, reuniones: count };
  } catch (e) {
    const msg = (e as Error).message;
    await mutate((d) => { d.sync_error = msg; });
    return { ok: false, error: msg };
  }
}

export async function svGuardarAction(fd: FormData): Promise<void> {
  await assertAccess();
  const rid = String(fd.get("reunion") ?? "").slice(0, 60);
  const filasRaw = JSON.parse(String(fd.get("filas") ?? "[]")) as Array<{
    nombre: string; roles: string[]; ausente: boolean; nota: string;
  }>;
  const nota = String(fd.get("nota") ?? "").slice(0, 600);

  await mutate((d) => {
    if (!d.reuniones[rid]) throw new Error("Reunión no encontrada");
    const porNombre: Record<string, string> = {};
    for (const s of Object.values(d.servidores)) porNombre[svNorm(s.nombre)] = s.id;

    const out: Record<string, SvFila & { _roles: string[] }> = {};
    for (const f of filasRaw) {
      const nombre = svCleanName(f.nombre);
      if (!nombre) continue;
      const k = svNorm(nombre);
      let sid = porNombre[k];
      if (!sid) {
        sid = "s" + Math.random().toString(36).slice(2, 10);
        d.servidores[sid] = { id: sid, nombre };
        porNombre[k] = sid;
      }
      if (!out[sid]) out[sid] = { sid, roles: [], _roles: [] };
      const roles = (f.roles ?? []).map(r => r.trim()).filter(Boolean);
      const merged = new Set([...out[sid]._roles, ...roles]);
      out[sid]._roles = [...merged];
      out[sid].roles = [...merged];
      if (f.ausente) out[sid].aus = true;
      if (f.nota) out[sid].nota = f.nota.slice(0, 200);
    }

    d.registros[rid] = {
      cuando: new Date().toISOString(),
      por: "admin",
      nota,
      filas: Object.values(out).map(({ _roles: _, ...rest }) => rest as SvFila),
    };
  });
}

export async function svBorrarAction(fd: FormData): Promise<void> {
  await assertAccess();
  const rid = String(fd.get("reunion") ?? "").slice(0, 60);
  await mutate((d) => { delete d.registros[rid]; });
}

export async function svReunionCrearAction(fd: FormData): Promise<{ id: string }> {
  await assertAccess();
  const nombre = String(fd.get("nombre") ?? "").trim().slice(0, 120);
  const fecha  = String(fd.get("fecha")  ?? "").slice(0, 10);
  if (!nombre || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Escribe el nombre y la fecha");

  const id = await mutate((d) => {
    const newId = "m" + Math.random().toString(36).slice(2, 10);
    d.reuniones[newId] = { id: newId, nombre, fecha, seccion: "Agregada a mano", origen: "manual" };
    return newId;
  });
  return { id };
}

export async function svReunionQuitarAction(fd: FormData): Promise<void> {
  await assertAccess();
  const rid = String(fd.get("reunion") ?? "").slice(0, 60);
  await mutate((d) => {
    const r = d.reuniones[rid];
    if (r?.origen === "asana" && !r.fuera_de_asana) throw new Error("Esta reunión viene de Asana. Quítala desde Asana.");
    delete d.reuniones[rid];
    delete d.registros[rid];
  });
}

export async function svServidorEditarAction(fd: FormData): Promise<{ unido: boolean }> {
  await assertAccess();
  const sid    = String(fd.get("id")     ?? "").slice(0, 40);
  const nombre = svCleanName(String(fd.get("nombre") ?? ""));
  if (!nombre) throw new Error("Escribe el nombre");

  const unido = await mutate((d) => {
    if (!d.servidores[sid]) throw new Error("Servidor no encontrado");
    const destino = Object.values(d.servidores).find(
      s => s.id !== sid && svNorm(s.nombre) === svNorm(nombre)
    );
    if (!destino) { d.servidores[sid].nombre = nombre; return false; }
    for (const reg of Object.values(d.registros)) {
      for (const f of reg.filas) { if (f.sid === sid) f.sid = destino.id; }
    }
    delete d.servidores[sid];
    return true;
  });
  return { unido };
}

export async function svServidorUnirAction(fd: FormData): Promise<void> {
  await assertAccess();
  const de = String(fd.get("de") ?? "").slice(0, 40);
  const a  = String(fd.get("a")  ?? "").slice(0, 40);
  if (de === a) throw new Error("Elige dos servidores distintos");
  await mutate((d) => {
    if (!d.servidores[de] || !d.servidores[a]) throw new Error("Servidor no encontrado");
    for (const reg of Object.values(d.registros)) {
      for (const f of reg.filas) { if (f.sid === de) f.sid = a; }
    }
    delete d.servidores[de];
  });
}

export async function svServidorQuitarAction(fd: FormData): Promise<void> {
  await assertAccess();
  const sid = String(fd.get("id") ?? "").slice(0, 40);
  await mutate((d) => {
    delete d.servidores[sid];
    for (const reg of Object.values(d.registros)) {
      reg.filas = reg.filas.filter(f => f.sid !== sid);
    }
  });
}

function toSlug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const SEED_GRUPOS: Array<{ id: string; nombre: string; miembros: string[] }> = [
  { id: "francisco-marysol", nombre: "Francisco & Marysol", miembros: ["Zaira Palacios","Yourladys Acosta","Daniel Martinez","Brandon Aricapa","Claudia Galvis","Jiceth Carolay Ruiz","Isaac Pinto","Sheyla De la Hoz","Luisa Oliva","Nestor Peña","Sharon Tapias"] },
  { id: "cesar-andrea",      nombre: "Cesar & Andrea",      miembros: ["Linda Buelvas","Luis Miguel Utria","Mariangel Torrenegra","Aldair Morales","Carlos De Alba"] },
  { id: "wilmer-karla",      nombre: "Wilmer & Karla",      miembros: ["Saileth Sarmiento","Karilim Galeano"] },
  { id: "gian-camila",       nombre: "Gian & Camila",       miembros: ["Itsvan Casares","Karen Tobar","Luis Prieto","Melissa Flores","Susana Leal","Wilmer De los Reyes","Karla Alarcón","Edwin Buelvas","Linda Bello","Ibeth Cortina"] },
  { id: "linda-bello",       nombre: "Linda Bello",         miembros: ["Lellys Laguna","Laura Cuello Polanco"] },
];

export async function svSeedDiscipuladosAction(): Promise<{ count: number }> {
  await assertAccess();
  const count = await mutate((d) => {
    if (!d.grupos) d.grupos = {};
    if (!d.miembros) d.miembros = {};
    if (Object.keys(d.grupos).length > 0) throw new Error("Ya hay discipulados registrados.");
    let total = 0;
    for (const g of SEED_GRUPOS) {
      d.grupos[g.id] = { id: g.id, nombre: g.nombre, lider: g.nombre, lider_user_ids: [] };
      g.miembros.forEach((nombre, i) => {
        const mid = `${g.id}-${i + 1}`;
        d.miembros![mid] = { id: mid, nombre, grupo_id: g.id };
        total++;
      });
    }
    return total;
  });
  return { count };
}

export async function svReadGrupoForUser(): Promise<{ grupo: SvGrupo; miembros: SvMiembro[] } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const data = await svReadData();
  const grupo = Object.values(data.grupos ?? {}).find(g => g.lider_user_ids.includes(user.id));
  if (!grupo) return null;
  const miembros = Object.values(data.miembros ?? {}).filter(m => m.grupo_id === grupo.id);
  return { grupo, miembros };
}

export async function svGrupoCrearAction(fd: FormData): Promise<{ id: string }> {
  await assertAccess();
  const nombre = String(fd.get("nombre") ?? "").trim().slice(0, 120);
  const lider  = String(fd.get("lider")  ?? "").trim().slice(0, 120);
  if (!nombre) throw new Error("Escribe el nombre del discipulado");

  const id = await mutate((d) => {
    if (!d.grupos) d.grupos = {};
    const base = toSlug(nombre) || "g";
    let newId = base;
    let n = 1;
    while (d.grupos[newId]) { newId = `${base}-${n++}`; }
    d.grupos[newId] = { id: newId, nombre, lider, lider_user_ids: [] };
    return newId;
  });
  return { id };
}

export async function svGrupoEditarAction(fd: FormData): Promise<void> {
  await assertAccess();
  const id     = String(fd.get("id")     ?? "").slice(0, 80);
  const nombre = String(fd.get("nombre") ?? "").trim().slice(0, 120);
  const lider  = String(fd.get("lider")  ?? "").trim().slice(0, 120);
  if (!nombre) throw new Error("Escribe el nombre del discipulado");

  await mutate((d) => {
    if (!d.grupos) d.grupos = {};
    if (!d.grupos[id]) throw new Error("Discipulado no encontrado");
    d.grupos[id].nombre = nombre;
    d.grupos[id].lider  = lider;
  });
}

export async function svGrupoQuitarAction(fd: FormData): Promise<void> {
  await assertAccess();
  const id = String(fd.get("id") ?? "").slice(0, 80);
  await mutate((d) => {
    if (!d.grupos) d.grupos = {};
    if (!d.miembros) d.miembros = {};
    delete d.grupos[id];
    for (const mid of Object.keys(d.miembros)) {
      if (d.miembros[mid].grupo_id === id) delete d.miembros[mid];
    }
  });
}

export async function svMiembroAgregarAction(fd: FormData): Promise<{ count: number }> {
  await assertAccess();
  const grupoId = String(fd.get("grupo_id") ?? "").slice(0, 80);
  const nombres = String(fd.get("nombres")  ?? "");

  const count = await mutate((d) => {
    if (!d.grupos) d.grupos = {};
    if (!d.miembros) d.miembros = {};
    if (!d.grupos[grupoId]) throw new Error("Discipulado no encontrado");

    const existentes = new Set(Object.values(d.miembros).map(m => svNorm(m.nombre)));
    let added = 0;
    for (const raw of nombres.split("\n")) {
      const nombre = raw.trim().slice(0, 120);
      if (!nombre) continue;
      if (existentes.has(svNorm(nombre))) continue;
      const mid = "di" + Math.random().toString(36).slice(2, 10);
      d.miembros[mid] = { id: mid, nombre, grupo_id: grupoId };
      existentes.add(svNorm(nombre));
      added++;
    }
    return added;
  });
  return { count };
}

export async function svMiembroQuitarAction(fd: FormData): Promise<void> {
  await assertAccess();
  const id = String(fd.get("id") ?? "").slice(0, 40);
  await mutate((d) => {
    if (!d.miembros) d.miembros = {};
    if (d.miembros[id]) d.miembros[id].grupo_id = "";
  });
}

// ── Acciones para líderes de discipulado (sin requerir super_admin) ──────────

async function assertLiderDeGrupo(grupoId: string): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: extraRoles } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id);
  const isLider = (extraRoles ?? []).some((r) => r.role === "lider_discipulado");
  if (!isLider) throw new Error("Sin acceso: no eres líder de discipulado");

  const data = await svReadData();
  const grupo = data.grupos?.[grupoId];
  if (!grupo || !grupo.lider_user_ids.includes(user.id)) {
    throw new Error("Sin acceso: no eres líder de este grupo");
  }
  return user.id;
}

export async function svMiembroAgregarLiderAction(fd: FormData): Promise<{ count: number }> {
  const grupoId = String(fd.get("grupo_id") ?? "").slice(0, 80);
  await assertLiderDeGrupo(grupoId);
  const nombres = String(fd.get("nombres") ?? "");

  const count = await mutate((d) => {
    if (!d.grupos) d.grupos = {};
    if (!d.miembros) d.miembros = {};
    if (!d.grupos[grupoId]) throw new Error("Discipulado no encontrado");

    const existentes = new Set(Object.values(d.miembros).map((m) => svNorm(m.nombre)));
    let added = 0;
    for (const raw of nombres.split("\n")) {
      const nombre = raw.trim().slice(0, 120);
      if (!nombre) continue;
      if (existentes.has(svNorm(nombre))) continue;
      const mid = "di" + Math.random().toString(36).slice(2, 10);
      d.miembros[mid] = { id: mid, nombre, grupo_id: grupoId };
      existentes.add(svNorm(nombre));
      added++;
    }
    return added;
  });
  return { count };
}

export async function svMiembroQuitarLiderAction(fd: FormData): Promise<void> {
  const grupoId = String(fd.get("grupo_id") ?? "").slice(0, 80);
  const miembroId = String(fd.get("id") ?? "").slice(0, 40);
  await assertLiderDeGrupo(grupoId);

  await mutate((d) => {
    if (!d.miembros) d.miembros = {};
    // Only remove from group if the miembro actually belongs to this group
    if (d.miembros[miembroId]?.grupo_id === grupoId) {
      d.miembros[miembroId].grupo_id = "";
    }
  });
}

export async function svLiderAsignarAction(fd: FormData): Promise<void> {
  await assertAccess();
  const grupoId = String(fd.get("grupo_id") ?? "").slice(0, 80);
  const userId  = String(fd.get("user_id")  ?? "").trim().slice(0, 40);
  await mutate((d) => {
    if (!d.grupos) d.grupos = {};
    if (!d.grupos[grupoId]) throw new Error("Discipulado no encontrado");
    if (!userId) {
      d.grupos[grupoId].lider_user_ids = [];
    } else if (!d.grupos[grupoId].lider_user_ids.includes(userId)) {
      d.grupos[grupoId].lider_user_ids.push(userId);
    }
  });
}
