"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Donacion } from "./_lib/types";

async function assertAccess(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["super_admin", "pastor_sede"].includes(profile?.role ?? "")) {
    throw new Error("Sin acceso al módulo de donaciones");
  }
}

// eslint-disable-next-line
const donTable = (svc: ReturnType<typeof createServiceClient>) => (svc as any).from("donaciones_data");

export async function donReadData(): Promise<Donacion[]> {
  const service = createServiceClient();
  const { data } = await donTable(service).select("donaciones").eq("id", "main").maybeSingle();
  return (data?.donaciones as Donacion[] | null) ?? [];
}

// ── Shared matching logic ──────────────────────────────────────────────────

type Candidato = { di: string; gid: string; nombre: string };

function normNombre(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
const SV_PART = new Set(["de", "del", "la", "las", "los", "y", "da", "do"]);
function tokens(s: string): string[] {
  return normNombre(s).split(" ").filter((t) => t.length >= 2 && !SV_PART.has(t));
}
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let p = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++)
      c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[n];
}
function simScore(a: string, b: string): number {
  const mx = Math.max(a.length, b.length);
  return mx ? 1 - lev(a, b) / mx : 0;
}

function findBestMatches(nombre: string, candidatos: Candidato[]): Array<Candidato & { score: number }> {
  const dt = tokens(nombre);
  if (dt.length < 2) return [];
  const hits: Array<Candidato & { score: number }> = [];
  for (const cand of candidatos) {
    const xt = tokens(cand.nombre);
    if (!xt.length) continue;
    let c = 0, s = 0, pri = false;
    for (let i = 0; i < xt.length; i++) {
      const t = xt[i];
      let b = 0;
      for (const d of dt) {
        b = Math.max(b, simScore(t, d));
        if (i === 0 && Math.min(t.length, d.length) >= 3 && (t.startsWith(d) || d.startsWith(t)))
          b = Math.max(b, 0.8);
      }
      if (b >= 0.75) { c++; s += b; if (i === 0) pri = true; }
    }
    if (!pri || c < Math.min(2, xt.length)) continue;
    hits.push({ ...cand, score: c + s / Math.max(1, c) });
  }
  hits.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return hits.filter((h) => { if (seen.has(h.di)) return false; seen.add(h.di); return true; });
}

function vincularEnLista(
  donaciones: Donacion[],
  candidatos: Candidato[],
  soloIds?: Set<string>,
): { donaciones: Donacion[]; vinculadas: number; sin_match: number } {
  const diValidos = new Set(candidatos.map((c) => c.di));
  let vinculadas = 0, sin_match = 0;

  const updated = donaciones.map((d) => {
    if (d.mv || d.ext) return d;
    if (soloIds && !soloIds.has(d.id)) return d;

    const matches = findBestMatches(d.n, candidatos);
    if (matches.length === 0) {
      if (d.di && diValidos.has(d.di)) return d;
      sin_match++;
      return d;
    }

    const primary = matches[0];
    const extras = matches.slice(1).filter((m) => m.gid !== primary.gid);
    const sg: Record<string, string> | undefined =
      extras.length > 0 ? Object.fromEntries(extras.map((m) => [m.gid, m.di])) : undefined;

    const unchanged =
      d.di === primary.di &&
      d.gid === primary.gid &&
      JSON.stringify(d.sg ?? null) === JSON.stringify(sg ?? null);
    if (unchanged) return d;

    vinculadas++;
    const out: Donacion = { ...d, di: primary.di, gid: primary.gid };
    if (sg) out.sg = sg; else delete out.sg;
    return out;
  });

  return { donaciones: updated, vinculadas, sin_match };
}

async function cargarCandidatos(service: ReturnType<typeof createServiceClient>): Promise<Candidato[]> {
  // eslint-disable-next-line
  const svTable = (service as any).from("servicio_data");
  const { data: svRow } = await svTable.select("data").eq("id", "main").maybeSingle();
  const raw = (svRow?.data?.miembros ?? {}) as Record<string, { nombre: string; grupo_id: string }>;
  return Object.entries(raw).map(([di, m]) => ({ di, gid: m.grupo_id, nombre: m.nombre }));
}

// ── Actions ────────────────────────────────────────────────────────────────

export async function donImportarAction(fd: FormData): Promise<{ importadas: number; repetidas: number; autovinculadas: number; sin_match: number }> {
  await assertAccess();
  const raw = String(fd.get("datos") ?? "");
  let filas: Donacion[];
  try { filas = JSON.parse(raw); } catch { throw new Error("El JSON no es válido"); }
  if (!Array.isArray(filas)) throw new Error("Se esperaba un arreglo de donaciones");

  const service = createServiceClient();
  const { data } = await donTable(service).select("donaciones").eq("id", "main").maybeSingle();
  const actuales: Donacion[] = (data?.donaciones as Donacion[] | null) ?? [];
  const existentes = new Set(actuales.map((d) => d.id));

  const KEEP = new Set(["id","f","m","n","k","t","o","met","di","gid","sg","e","doc","ref"]);
  const limpiar = (r: Record<string, unknown>): Donacion => {
    const out: Record<string, unknown> = {};
    KEEP.forEach(k => { if (r[k] !== undefined) out[k] = r[k]; });
    return out as Donacion;
  };
  const validas = filas.filter((r: Record<string, unknown>) => r.id && (r.m as number) > 0 && r.f && r.n);
  const nuevas  = validas.filter((r: Record<string, unknown>) => !existentes.has(r.id as string)).map(limpiar);
  const repetidas = validas.length - nuevas.length;

  if (nuevas.length === 0) return { importadas: 0, repetidas, autovinculadas: 0, sin_match: 0 };

  // Auto-vincular nuevas donaciones antes de guardar
  const candidatos = await cargarCandidatos(service);
  const nuevasIds = new Set(nuevas.map(d => d.id));
  const merged = [...actuales, ...nuevas].sort((a, b) => b.f.localeCompare(a.f));
  const { donaciones: mergedVinculadas, vinculadas: autovinculadas, sin_match } = vincularEnLista(merged, candidatos, nuevasIds);

  await donTable(service).upsert({ id: "main", donaciones: mergedVinculadas, updated_at: new Date().toISOString() });
  revalidatePath("/donaciones");

  return { importadas: nuevas.length, repetidas, autovinculadas, sin_match };
}

export async function donVincularAction(): Promise<{ vinculadas: number; sin_match: number }> {
  await assertAccess();
  const service = createServiceClient();
  const candidatos = await cargarCandidatos(service);

  const { data: row } = await donTable(service).select("donaciones").eq("id", "main").maybeSingle();
  const actuales: Donacion[] = (row?.donaciones as Donacion[] | null) ?? [];

  const { donaciones: actualizadas, vinculadas, sin_match } = vincularEnLista(actuales, candidatos);

  if (vinculadas > 0) {
    await donTable(service).upsert({ id: "main", donaciones: actualizadas, updated_at: new Date().toISOString() });
    revalidatePath("/donaciones");
  }
  return { vinculadas, sin_match };
}

export async function donVincularManualAction(donId: string, di: string, gid: string): Promise<void> {
  await assertAccess();
  const service = createServiceClient();
  const { data: row } = await donTable(service).select("donaciones").eq("id", "main").maybeSingle();
  const actuales: Donacion[] = (row?.donaciones as Donacion[] | null) ?? [];

  const actualizadas = actuales.map((d): Donacion => {
    if (d.id !== donId) return d;
    const out: Donacion = { ...d, di, gid, mv: true };
    delete out.ext;
    return out;
  });

  await donTable(service).upsert({ id: "main", donaciones: actualizadas, updated_at: new Date().toISOString() });
  revalidatePath("/donaciones");
}

export async function donMarcarExternoAction(donId: string): Promise<void> {
  await assertAccess();
  const service = createServiceClient();
  const { data: row } = await donTable(service).select("donaciones").eq("id", "main").maybeSingle();
  const actuales: Donacion[] = (row?.donaciones as Donacion[] | null) ?? [];

  const actualizadas = actuales.map((d): Donacion => {
    if (d.id !== donId) return d;
    const out: Donacion = { ...d, ext: true };
    delete out.di;
    delete out.gid;
    delete out.sg;
    delete out.mv;
    return out;
  });

  await donTable(service).upsert({ id: "main", donaciones: actualizadas, updated_at: new Date().toISOString() });
  revalidatePath("/donaciones");
}

export async function donBorrarTodoAction(): Promise<void> {
  await assertAccess();
  const service = createServiceClient();
  await donTable(service).upsert({ id: "main", donaciones: [], updated_at: new Date().toISOString() });
  revalidatePath("/donaciones");
}
