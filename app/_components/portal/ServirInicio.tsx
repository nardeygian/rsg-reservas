import Link from "next/link";
import { Icon } from "@/app/_components/ui/Icon";
import { createClient } from "@/lib/supabase/server";
import { fechaReunion, hoyBogota, sumarDias } from "@/app/servir/equipo/_lib/datos";

// Tarjetas de Servir en el Inicio: tu próximo servicio (con aceptar),
// pendientes por responder, posiciones sin cubrir para líderes y "Abrir en
// vivo" para Planeación el día de la reunión. Todo con la sesión del
// usuario: lo que RLS no deja ver no aparece.
export async function ServirInicio({ invitarAUnirse }: { invitarAUnirse: boolean }) {
  const db = await createClient();
  const hoy = hoyBogota();
  const tiene = async (p: string) => (await db.rpc("has_permission", { p_permission: p })).data === true;

  const [{ data: personId }, puedeVivo, alcances, solicitudesR] = await Promise.all([
    db.rpc("current_person_id"),
    tiene("servir.vivo"),
    db.rpc("permission_scopes", { p_permission: "servir.asignar" }).then((r) => r.data ?? []),
    db.from("team_join_requests").select("id", { count: "exact", head: true }).eq("status", "pendiente"),
  ]);

  const [misR, hoyR, equipoR] = await Promise.all([
    personId
      ? db.from("assignments")
          .select("id, status, meeting_id, meetings!inner(name, meeting_date, starts_at, status), positions(name)")
          .eq("person_id", personId).in("status", ["pendiente", "aceptada"])
          .gte("meetings.meeting_date", hoy).neq("meetings.status", "cancelada")
          .order("meeting_date", { referencedTable: "meetings" }).limit(20)
      : Promise.resolve({ data: [] }),
    puedeVivo
      ? db.from("meetings").select("id, name, starts_at, status").eq("meeting_date", hoy).in("status", ["publicada", "en_vivo"]).order("starts_at")
      : Promise.resolve({ data: [] }),
    // Líderes: lo que su gente no ha respondido o rechazó en las próximas 2 semanas.
    alcances.length
      ? db.from("assignments")
          .select("id, status, ministry_id, area_id, meetings!inner(meeting_date, status)")
          .in("status", ["pendiente", "rechazada"])
          .gte("meetings.meeting_date", hoy).lte("meetings.meeting_date", sumarDias(hoy, 14))
          .neq("meetings.status", "cancelada")
      : Promise.resolve({ data: [] }),
  ]);

  type Mia = { id: string; status: string; meeting_id: string; meetings: { name: string; meeting_date: string; starts_at: string | null; status: string }; positions: { name: string } | null };
  const mias = ((misR.data ?? []) as unknown as Mia[])
    .sort((a, b) => a.meetings.meeting_date.localeCompare(b.meetings.meeting_date) || (a.meetings.starts_at ?? "").localeCompare(b.meetings.starts_at ?? ""));
  const proxima = mias[0] ?? null;
  const porResponder = mias.filter((a) => a.status === "pendiente").length;

  const global = alcances.some((a) => a.scope_type === null);
  const deps = new Set(alcances.filter((a) => a.scope_type === "departamento").map((a) => a.scope_id));
  const areas = new Set(alcances.filter((a) => a.scope_type === "area").map((a) => a.scope_id));
  const deMiGente = (equipoR.data ?? []).filter((a) => global || deps.has(a.ministry_id) || (a.area_id && areas.has(a.area_id)));
  const sinResponder = deMiGente.filter((a) => a.status === "pendiente").length;
  const rechazadas = deMiGente.filter((a) => a.status === "rechazada").length;
  const solicitudes = solicitudesR.count ?? 0;
  const reunionesHoy = hoyR.data ?? [];

  const unirse = !personId && invitarAUnirse;
  const nada = !proxima && !reunionesHoy.length && !sinResponder && !rechazadas && !solicitudes;
  if (nada && !unirse) return null;

  return (
    <section aria-label="Servir" className="grid gap-3 md:grid-cols-2">
      {unirse && (
        <Link href="/servir/unirme" className="card card-hover px-5 py-4 flex items-center gap-3 min-h-[72px]">
          <span className="flex-1">
            <span className="eyebrow block">Servir</span>
            <span className="block text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>Únete a un departamento</span>
            <span className="block text-[13px]" style={{ color: "var(--color-muted)" }}>Escoge dónde sirves y tu líder te aprueba.</span>
          </span>
          <Icon name="chevron-right" style={{ color: "var(--color-faint)" }} />
        </Link>
      )}

      {proxima && (
        <Link href={proxima.meetings.meeting_date === hoy || proxima.meetings.status === "en_vivo" ? `/servir/${proxima.meeting_id}/vivo` : "/servir/mis-servicios"}
          className="card card-hover px-5 py-4 flex items-center gap-3 min-h-[72px]"
          style={proxima.status === "pendiente" ? { borderColor: "var(--color-gold)" } : undefined}>
          <span className="flex-1 min-w-0">
            <span className="eyebrow block">Tu próximo servicio</span>
            <span className="block text-[16px] font-semibold truncate" style={{ color: "var(--color-ink)" }}>
              {proxima.positions?.name ?? "Servicio"} · {proxima.meetings.name}
            </span>
            <span className="block text-[13px] capitalize" style={{ color: "var(--color-muted)" }}>
              {fechaReunion(proxima.meetings.meeting_date, proxima.meetings.starts_at)}
              {porResponder > 0 ? ` · ${porResponder} por responder` : ""}
            </span>
          </span>
          {proxima.status === "pendiente" ? <span className="chip chip-gold flex-none">Responder</span> : <span className="chip chip-up flex-none">Aceptado</span>}
        </Link>
      )}

      {reunionesHoy.map((r) => (
        <Link key={r.id} href={`/servir/${r.id}/vivo`} className="card card-hover px-5 py-4 flex items-center gap-3 min-h-[72px]"
          style={r.status === "en_vivo" ? { borderColor: "var(--color-up)" } : undefined}>
          <span className="flex-1 min-w-0">
            <span className="eyebrow block">Hoy</span>
            <span className="block text-[16px] font-semibold truncate" style={{ color: "var(--color-ink)" }}>{r.name}</span>
            <span className="block text-[13px]" style={{ color: "var(--color-muted)" }}>{r.status === "en_vivo" ? "En vivo ahora" : "Lista para abrir en vivo"}</span>
          </span>
          <span className={`chip ${r.status === "en_vivo" ? "chip-up" : "chip-accent"} flex-none`}>{r.status === "en_vivo" ? "En vivo" : "Abrir en vivo"}</span>
        </Link>
      ))}

      {(sinResponder > 0 || rechazadas > 0 || solicitudes > 0) && (
        <Link href={solicitudes > 0 ? "/servir/equipo?vista=solicitudes" : "/servir/equipo?vista=reuniones"} className="card card-hover px-5 py-4 flex items-center gap-3 min-h-[72px]">
          <span className="flex-1 min-w-0">
            <span className="eyebrow block">Tu equipo · próximas 2 semanas</span>
            <span className="block text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
              {[
                rechazadas ? `${rechazadas} por reasignar` : null,
                sinResponder ? `${sinResponder} sin responder` : null,
                solicitudes ? `${solicitudes} ${solicitudes === 1 ? "solicitud" : "solicitudes"} para unirse` : null,
              ].filter(Boolean).join(" · ")}
            </span>
          </span>
          <Icon name="chevron-right" style={{ color: "var(--color-faint)" }} />
        </Link>
      )}
    </section>
  );
}
