import type { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;

// La agenda de reuniones de RSG vive en la app (antes venía de Asana).
// Sale de agenda_reuniones(): todo usuario ve las reuniones publicadas con
// nombre, fecha, hora y tipo; las notas solo quien puede ver la reunión.
export type EventoAgenda = {
  gid: string;              // id de la reunión
  name: string;
  due_on: string;           // YYYY-MM-DD
  notes: string;
  category: string | null;  // tipo de reunión
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  asignado: boolean;        // el usuario sirve en ella
  ve_detalle: boolean;      // puede abrir el orden y el equipo
};

export async function leerAgenda(db: Cliente, desde: string, hasta: string): Promise<EventoAgenda[]> {
  const { data, error } = await db.rpc("agenda_reuniones", { p_desde: desde, p_hasta: hasta });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    gid: m.id,
    name: m.name,
    due_on: m.meeting_date,
    notes: m.notes ?? "",
    category: m.type_name,
    starts_at: m.starts_at,
    ends_at: m.ends_at,
    status: m.status,
    asignado: m.asignado,
    ve_detalle: m.ve_detalle,
  }));
}
