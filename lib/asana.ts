const BASE = "https://app.asana.com/api/1.0";

export type AsanaEvent = {
  gid: string;
  name: string;
  due_on: string; // "YYYY-MM-DD"
  notes: string;
  category: string | null; // parsed from [Category] prefix in name
};

export async function getCalendarEvents(): Promise<AsanaEvent[]> {
  const pat = process.env.ASANA_PAT;
  const projectGid = process.env.ASANA_CALENDAR_PROJECT_GID;
  if (!pat || !projectGid) return [];

  const results: AsanaEvent[] = [];
  let url: string | null =
    `${BASE}/projects/${projectGid}/tasks?opt_fields=gid,name,due_on,notes&limit=100`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) break;

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
