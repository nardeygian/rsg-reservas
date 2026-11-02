import type { ReactNode } from "react";
import { Icon, type IconName } from "@/app/_components/ui/Icon";
import type { Semaforo } from "@/lib/servir/contratos";

// Piezas del tablero de estadísticas (frente C3).

export function Cifra({ titulo, valor, detalle }: { titulo: string; valor: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-1 min-w-0">
      <span className="text-[13px] font-medium" style={{ color: "var(--color-muted)" }}>{titulo}</span>
      <span className="text-[26px] font-semibold tabular leading-tight" style={{ color: "var(--color-ink)" }}>{valor}</span>
      {detalle && <span className="text-[12px]" style={{ color: "var(--color-muted)" }}>{detalle}</span>}
    </div>
  );
}

// El semáforo siempre lleva ícono y texto: el color nunca va solo.
export const SEMAFORO: Record<Semaforo, { texto: string; clase: string; icono: IconName; ayuda: string }> = {
  sano:         { texto: "Sano",         clase: "chip-up",    icono: "check-circle", ayuda: "Sirve con regularidad" },
  sobrecargado: { texto: "Sobrecargado", clase: "chip-down",  icono: "clock",        ayuda: "Sirve más de lo recomendado" },
  alejandose:   { texto: "Alejándose",   clase: "chip-gold",  icono: "chevron-down", ayuda: "Sirve poco o rechaza seguido" },
  inactivo:     { texto: "Inactivo",     clase: "chip-muted", icono: "x-circle",     ayuda: "Hace semanas que no sirve" },
};

export function SemaforoChip({ s }: { s: Semaforo }) {
  const v = SEMAFORO[s];
  return (
    <span className={`chip ${v.clase} flex-none inline-flex items-center gap-1`}>
      <Icon name={v.icono} size={12} />
      {v.texto}
    </span>
  );
}

export function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

export function minutos(seg: number | null): string {
  if (seg === null) return "—";
  const m = Math.round(seg / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
