import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SaludServidor } from "@/lib/servir/contratos";
import { fechaCorta } from "@/app/servir/reuniones/_lib/fechas";
import { Encabezado, Pagina } from "@/app/servir/reuniones/_components/ui";
import { Cifra, SemaforoChip, pct } from "../../_components/ui";

export const metadata = { title: "Ficha del servidor · Servir" };

type Ficha = {
  persona: { id: string; full_name: string; notes: string | null; discipulado: string | null; tiene_cuenta: boolean };
  equipos: { departamento: string; area: string | null }[];
  posiciones: string[];
  bloqueos: { desde: string; hasta: string; motivo: string | null }[];
  historial: {
    meeting_id: string; fecha: string; reunion: string; tipo: string | null; estado_reunion: string;
    posiciones: string[] | null; respuesta: string | null; motivo_rechazo: string | null;
    asistencia: string | null; roles_listado: string[] | null; checklist_hechos: number; checklist_total: number;
  }[];
};

const MES = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" });

const ASIS: Record<string, { t: string; c: string }> = {
  asistio: { t: "Asistió", c: "chip-up" },
  tarde: { t: "Tarde", c: "chip-gold" },
  ausente: { t: "Ausente", c: "chip-down" },
};

// La ficha la ve la persona, su líder de departamento o área, su líder de
// discipulado y quien ve todo (ficha_servidor devuelve null a los demás).
export default async function FichaServidorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const [{ data }, { data: salud }, { data: meses }] = await Promise.all([
    db.rpc("ficha_servidor", { p_person_id: id }),
    db.rpc("salud_servidores"),
    db.rpc("salud_mensual", { p_person_id: id, p_meses: 6 }),
  ]);
  const ficha = data as Ficha | null;
  if (!ficha?.persona) notFound();
  const s = ((salud ?? []) as SaludServidor[]).find((x) => x.person_id === id);
  // La vista materializada sale con columnas que admiten null en los tipos.
  const m = (meses ?? []).map((x) => ({
    mes: x.mes ?? "", servicios: x.servicios ?? 0, aceptadas: x.aceptadas ?? 0, rechazadas: x.rechazadas ?? 0,
    ausencias: x.ausencias ?? 0, tardes: x.tardes ?? 0, checklist_hechos: x.checklist_hechos ?? 0, checklist_total: x.checklist_total ?? 0,
  }));
  const tot = (k: "aceptadas" | "rechazadas" | "ausencias" | "tardes" | "checklist_hechos" | "checklist_total" | "servicios") => m.reduce((a, x) => a + x[k], 0);
  const max = Math.max(1, ...m.map((x) => x.servicios));

  return (
    <Pagina>
      <Encabezado
        titulo={ficha.persona.full_name}
        subtitulo={[ficha.equipos.map((e) => e.area ? `${e.departamento} · ${e.area}` : e.departamento).join(", ") || "Sin equipo",
          ficha.persona.discipulado ? `Discipulado ${ficha.persona.discipulado}` : null].filter(Boolean).join(" · ")}
        volver={{ href: "/servir/estadisticas?vista=salud", label: "Salud del equipo" }}
      >
        {s && <SemaforoChip s={s.semaforo} />}
      </Encabezado>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Cifra titulo="Servicios (6 meses)" valor={tot("servicios")} detalle={s ? `${s.servicios_ventana} en la ventana actual` : undefined} />
        <Cifra titulo="Aceptación" valor={pct(tot("aceptadas"), tot("aceptadas") + tot("rechazadas"))} detalle={`${tot("rechazadas")} rechazos`} />
        <Cifra titulo="Ausencias" valor={tot("ausencias")} detalle={`${tot("tardes")} llegadas tarde`} />
        <Cifra titulo="Checklists" valor={pct(tot("checklist_hechos"), tot("checklist_total"))}
          detalle={s?.ultima_fecha ? `Última vez: ${fechaCorta(s.ultima_fecha)}` : "Sin servicios"} />
      </div>

      {m.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="eyebrow px-1">Servicios por mes</h2>
          <div className="card px-4 pt-4 pb-3">
            <div className="flex items-end gap-2 h-28" role="img" aria-label={`Servicios por mes: ${m.map((x) => `${MES(x.mes)} ${x.servicios}`).join(", ")}`}>
              {m.map((x) => (
                <div key={x.mes} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${MES(x.mes)}: ${x.servicios} servicios`}>
                  <span className="text-[12px] tabular" style={{ color: "var(--color-ink)" }}>{x.servicios}</span>
                  <div className="w-full max-w-[32px] rounded-t-[4px]" style={{ height: `${(x.servicios / max) * 70}%`, minHeight: x.servicios ? 4 : 0, background: "var(--color-accent)" }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1 border-t" style={{ borderColor: "var(--color-line)" }}>
              {m.map((x) => <span key={x.mes} className="flex-1 text-center text-[11px] capitalize" style={{ color: "var(--color-muted)" }}>{MES(x.mes)}</span>)}
            </div>
          </div>
        </section>
      )}

      {(ficha.posiciones.length > 0 || ficha.bloqueos.length > 0 || ficha.persona.notes) && (
        <section className="card p-4 flex flex-col gap-2 text-[14px]" style={{ color: "var(--color-ink)" }}>
          {ficha.posiciones.length > 0 && <p><span style={{ color: "var(--color-muted)" }}>Posiciones: </span>{ficha.posiciones.join(", ")}</p>}
          {ficha.bloqueos.length > 0 && (
            <p><span style={{ color: "var(--color-muted)" }}>No puede: </span>
              {ficha.bloqueos.map((b) => `${b.desde === b.hasta ? fechaCorta(b.desde) : `${fechaCorta(b.desde)} – ${fechaCorta(b.hasta)}`}${b.motivo ? ` (${b.motivo})` : ""}`).join(", ")}
            </p>
          )}
          {ficha.persona.notes && <p><span style={{ color: "var(--color-muted)" }}>Notas: </span>{ficha.persona.notes}</p>}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow px-1">Historial</h2>
        {ficha.historial.length === 0 ? (
          <p className="card px-4 py-5 text-[14px]" style={{ color: "var(--color-muted)" }}>Todavía no hay servicios registrados.</p>
        ) : (
          <ul className="card overflow-hidden">
            {ficha.historial.map((h) => (
              <li key={h.meeting_id} className="border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
                <Link href={`/servir/reuniones/${h.meeting_id}`} className="px-4 py-3 flex items-center gap-3 min-h-[56px] card-hover">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium truncate" style={{ color: "var(--color-ink)" }}>{h.reunion}</span>
                    <span className="block text-[12px] truncate" style={{ color: "var(--color-muted)" }}>
                      {fechaCorta(h.fecha)}
                      {(h.posiciones ?? h.roles_listado ?? []).length ? ` · ${(h.posiciones ?? h.roles_listado ?? []).join(", ")}` : ""}
                      {h.respuesta === "rechazada" ? ` · Rechazó${h.motivo_rechazo ? `: ${h.motivo_rechazo}` : ""}` : ""}
                      {h.respuesta === "pendiente" ? " · Sin responder" : ""}
                      {h.checklist_total > 0 ? ` · checklist ${h.checklist_hechos}/${h.checklist_total}` : ""}
                    </span>
                  </span>
                  {h.asistencia && <span className={`chip ${ASIS[h.asistencia]?.c ?? "chip-muted"} flex-none`}>{ASIS[h.asistencia]?.t ?? h.asistencia}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Pagina>
  );
}
