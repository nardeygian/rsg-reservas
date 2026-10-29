import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { TZ } from "@/lib/datetime";

// Reporte que la base arma al terminar la reunión (meetings.report, ver
// armar_reporte_reunion en 20261029140000_servir_ajustes_en_vivo.sql).
export type Reporte = {
  inicio_planeado: string | null;
  fin_planeado: string | null;
  inicio_real: string | null;
  fin_real: string | null;
  atraso_inicio_min: number | null;
  diferencia_fin_min: number | null;
  puntos: { titulo: string; tipo: string; planeado_min: number; ajustado_min: number; real_min: number | null; quitado: boolean }[];
  cambios: { hora: string; tipo: string; minutos: number | null; punto: string | null; quien: string | null }[];
};

const hora = (iso: string | null) => (iso ? formatInTimeZone(new Date(iso), TZ, "h:mm a", { locale: es }) : "—");

export function textoCambio(tipo: string, minutos: number | null, punto: string | null): string {
  const min = minutos == null ? "" : `${minutos > 0 ? "+" : "−"}${Math.abs(minutos)} min`;
  switch (tipo) {
    case "atraso": return `Atraso ${min}${punto ? ` (en ${punto})` : ""}`;
    case "duracion": return `${punto ?? "Punto"} ${min}`;
    case "quitar": return `Se quitó ${punto ?? "un punto"}`;
    case "devolver": return `Volvió ${punto ?? "un punto"}`;
    default: return tipo;
  }
}

function duracion(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

function diferencia(min: number | null, antes: string, despues: string): string {
  if (min == null) return "—";
  if (min === 0) return "a tiempo";
  return `${duracion(Math.abs(min))} ${min > 0 ? despues : antes}`;
}

export function ReporteReunion({ reporte }: { reporte: Reporte }) {
  return (
    <section className="card p-4 flex flex-col gap-4">
      <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>Reporte de la reunión</h2>

      <dl className="grid grid-cols-2 gap-3 text-[14px]">
        <div>
          <dt style={{ color: "var(--color-muted)" }}>Empezó</dt>
          <dd className="tabular" style={{ color: "var(--color-ink)" }}>
            {hora(reporte.inicio_real)} · {diferencia(reporte.atraso_inicio_min, "antes", "tarde")}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--color-muted)" }}>Terminó</dt>
          <dd className="tabular" style={{ color: "var(--color-ink)" }}>
            {hora(reporte.fin_real)} · {diferencia(reporte.diferencia_fin_min, "antes", "tarde")}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1">
        <h3 className="eyebrow">Orden: planeado, ajustado y real</h3>
        <ul className="flex flex-col">
          {reporte.puntos.map((p, i) => (
            <li key={i} className="flex items-center gap-3 py-1.5 border-b last:border-b-0 text-[14px]" style={{ borderColor: "var(--color-line)" }}>
              <span className="flex-1 min-w-0 truncate" style={{ color: p.quitado ? "var(--color-faint)" : "var(--color-ink)", textDecoration: p.quitado ? "line-through" : undefined }}>
                {p.titulo}
              </span>
              <span className="tabular text-[12px] flex-none" style={{ color: "var(--color-muted)" }}>
                {p.quitado ? "quitado" : `${p.planeado_min}${p.ajustado_min !== p.planeado_min ? ` → ${p.ajustado_min}` : ""} min · ${p.real_min == null ? "no se hizo" : `real ${p.real_min} min`}`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="eyebrow">Cambios en vivo</h3>
        {reporte.cambios.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>Ninguno: la reunión fue como se planeó.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-[14px]">
            {reporte.cambios.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular flex-none w-[64px]" style={{ color: "var(--color-muted)" }}>{hora(c.hora)}</span>
                <span className="flex-1 min-w-0" style={{ color: "var(--color-ink)" }}>
                  {textoCambio(c.tipo, c.minutos, c.punto)}
                  {c.quien && <span style={{ color: "var(--color-muted)" }}> · {c.quien}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
