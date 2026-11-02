import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Donacion } from "./types";
import { donMutate } from "./data";

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

export function vincularEnLista(
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

export async function cargarCandidatos(service: ReturnType<typeof createServiceClient>): Promise<Candidato[]> {
  // eslint-disable-next-line
  const svTable = (service as any).from("servicio_data");
  const { data: svRow } = await svTable.select("data").eq("id", "main").maybeSingle();
  const raw = (svRow?.data?.miembros ?? {}) as Record<string, { nombre: string; grupo_id: string }>;
  return Object.entries(raw).map(([di, m]) => ({ di, gid: m.grupo_id, nombre: m.nombre }));
}


// Vincula las donaciones pendientes y guarda. No llama a revalidatePath, así
// que se puede usar mientras la página se renderiza; las actions lo envuelven.
export async function donVincular(): Promise<{ vinculadas: number; sin_match: number }> {
  const service = createServiceClient();
  const candidatos = await cargarCandidatos(service);

  return donMutate((actuales) => {
    const { donaciones, vinculadas, sin_match } = vincularEnLista(actuales, candidatos);
    return { donaciones: vinculadas > 0 ? donaciones : null, result: { vinculadas, sin_match } };
  });
}
