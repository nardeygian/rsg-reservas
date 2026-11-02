const BASE = "https://app.asana.com/api/1.0";

export type AsanaEvent = {
  gid: string;
  name: string;
  due_on: string; // "YYYY-MM-DD"
  notes: string;
  category: string | null; // parsed from [Category] prefix in name
};

// Pide una página a Asana. Reintenta una vez si Asana limita (429) o falla
// del lado de ellos (5xx); cualquier otro error se lanza con su detalle.
async function fetchPage(url: string, pat: string): Promise<Response> {
  for (let intento = 0; ; intento++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}` },
      next: { revalidate: 300 },
    });
    if (res.ok) return res;

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && intento === 0) {
      const wait = Math.min(Number(res.headers.get("retry-after")) || 1, 5);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }

    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.errors?.[0]?.message ?? detail;
    } catch {
      // cuerpo vacío o no JSON
    }
    throw new Error(`Asana respondió ${res.status}: ${detail}`);
  }
}

// Sin las variables de Asana (los previews) el calendario se muestra sin sus
// eventos y sin aviso de error.
export function asanaConfigurado(): boolean {
  return !!process.env.ASANA_PAT && !!process.env.ASANA_CALENDAR_PROJECT_GID;
}

// Lanza error si Asana no responde bien: devolver una lista vacía o a medias
// haría que el calendario se vea vacío sin explicación y que la sincronización
// de Servicio tome las reuniones faltantes como borradas en Asana.
export async function getCalendarEvents(): Promise<AsanaEvent[]> {
  const pat = process.env.ASANA_PAT;
  const projectGid = process.env.ASANA_CALENDAR_PROJECT_GID;
  if (!pat || !projectGid) {
    throw new Error("Faltan ASANA_PAT o ASANA_CALENDAR_PROJECT_GID en las variables de entorno");
  }

  const results: AsanaEvent[] = [];
  let url: string | null =
    `${BASE}/projects/${projectGid}/tasks?opt_fields=gid,name,due_on,notes&limit=100`;

  while (url) {
    const res = await fetchPage(url, pat);

    const json: { data: Array<{ gid: string; name: string; due_on: string | null; notes: string }>; next_page: { uri: string } | null } = await res.json();
    for (const task of json.data ?? []) {
      if (!task.name?.trim() || !task.due_on) continue;
      const match = /^\[([^\]]+)\]\s*/.exec(task.name);
      results.push({
        gid: task.gid,
        name: match ? task.name.slice(match[0].length).trim() : task.name.trim(),
        due_on: task.due_on,
        notes: task.notes ?? "",
        category: match ? match[1] : null,
      });
    }

    url = json.next_page?.uri ?? null;
  }

  return results.sort((a, b) => a.due_on.localeCompare(b.due_on));
}
