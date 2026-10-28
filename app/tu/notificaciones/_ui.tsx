import type { ReactNode } from "react";

// Piezas compartidas de la bandeja y del envío (estilo de /perfil).

export const svg = (d: ReactNode, size = 17) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

export const ICONOS = {
  campana: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  megafono: <><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  personas: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  rechazo: <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></>,
  atras: <polyline points="15 18 9 12 15 6" />,
  chevron: <polyline points="9 6 15 12 9 18" />,
  check: <polyline points="20 6 9 17 4 12" />,
} as const;

export type Tono = "accent" | "info" | "down" | "up";

export function IconoFila({ children, tono = "accent" }: { children: ReactNode; tono?: Tono }) {
  const bg = { accent: "var(--color-accent-soft)", info: "var(--color-info-soft)", down: "var(--color-down-soft)", up: "var(--color-up-soft, var(--color-accent-soft))" }[tono];
  const fg = { accent: "var(--color-accent)", info: "var(--color-info)", down: "var(--color-down)", up: "var(--color-up)" }[tono];
  return (
    <span className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-none" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

export function Grupo({ titulo, pie, children }: { titulo?: ReactNode; pie?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {titulo && <h2 className="px-4 text-[13px] font-medium" style={{ color: "var(--color-muted)" }}>{titulo}</h2>}
      <div className="card overflow-hidden divide-y">{children}</div>
      {pie && <div className="px-4 text-[12px] leading-relaxed" style={{ color: "var(--color-faint)" }}>{pie}</div>}
    </section>
  );
}

export const ICONO_TIPO: Record<string, { icono: ReactNode; tono: Tono }> = {
  asignacion: { icono: ICONOS.personas, tono: "accent" },
  recordatorio: { icono: ICONOS.reloj, tono: "info" },
  envio: { icono: ICONOS.megafono, tono: "accent" },
  cambio_reunion: { icono: ICONOS.calendario, tono: "info" },
  rechazo: { icono: ICONOS.rechazo, tono: "down" },
};
