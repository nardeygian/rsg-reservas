"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCalendarEvents } from "@/lib/asana";
import { svNorm } from "./_lib/sv-logic";
import type { SvData, SvFila } from "./_lib/types";

const DEFAULT_DATA: SvData = {
  reuniones: {}, servidores: {}, registros: {}, sync: 0, sync_error: "",
};

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

// servicio_data not in generated types yet (migration pending).
// eslint-disable-next-line
const svTable = (svc: ReturnType<typeof createServiceClient>) => (svc as any).from("servicio_data");

export async function svReadData(): Promise<SvData> {
  const service = createServiceClient();
  const { data } = await svTable(service).select("data").eq("id", "main").maybeSingle();
  return (data?.data as SvData | null) ?? { ...DEFAULT_DATA };
}

async function mutate<T>(fn: (d: SvData) => T): Promise<T> {
  const service = createServiceClient();
  const { data } = await svTable(service).select("data").eq("id", "main").maybeSingle();
  const d: SvData = (data?.data as SvData | null) ?? { ...DEFAULT_DATA };
  const result = fn(d);
  await svTable(service).upsert({ id: "main", data: d, updated_at: new Date().toISOString() });
  revalidatePath("/servicio");
  return result;
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
