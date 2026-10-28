import type { Seccion } from "../_lib/canciones";

function fechaUso(fecha: string, conAno: boolean): string {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", {
    day: "numeric", month: "short", ...(conAno ? { year: "numeric" } : {}), timeZone: "UTC",
  }).replace(".", "");
}

// last_used_on puede ser futura: la canción ya está en una reunión publicada.
export function UltimoUso({ fecha, hoy, corto }: { fecha: string | null; hoy: string; corto?: boolean }) {
  const conAno = !!fecha && fecha.slice(0, 4) !== hoy.slice(0, 4);
  const [texto, color] = !fecha
    ? [corto ? "Sin uso" : "Nunca usada", "var(--color-faint)"]
    : fecha > hoy
      ? [`${corto ? "" : "Programada "}${fechaUso(fecha, conAno)}`, "var(--color-accent)"]
      : fecha === hoy
        ? ["Hoy", "var(--color-accent)"]
        : [`${corto ? "" : "Último uso "}${fechaUso(fecha, conAno)}`, "var(--color-muted)"];
  return (
    <span
      className={`text-[12px] font-semibold tabular flex-none ${corto ? "w-[64px] text-right" : ""}`}
      style={{ color }}
      title={fecha && fecha > hoy ? "Programada en una reunión" : "Último uso en una reunión"}
    >
      {texto}
    </span>
  );
}

// Letra por secciones. `grande` es la vista del servidor en el celular.
export function LetraSecciones({ secciones, tamano = 17 }: { secciones: Seccion[]; tamano?: number }) {
  if (secciones.length === 0) {
    return <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>Esta canción todavía no tiene letra.</p>;
  }
  return (
    <div className="flex flex-col" style={{ gap: Math.round(tamano * 1.3) }}>
      {secciones.map((s, i) => (
        <section key={i} className="flex flex-col gap-1.5">
          {s.nombre && (
            <h3 className="eyebrow" style={{ color: "var(--color-accent)" }}>{s.nombre}</h3>
          )}
          <p style={{ fontSize: tamano, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
            {s.lineas.join("\n")}
          </p>
        </section>
      ))}
    </div>
  );
}
