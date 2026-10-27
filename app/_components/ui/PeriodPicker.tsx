"use client";

// Selector de periodo compartido por los módulos (Servicio, Grupos, Dar):
// control segmentado de vidrio + etiqueta con flechas.

export type PeriodOption<T extends string> = { id: T; label: string };

export function PeriodPicker<T extends string>({
  options,
  value,
  onChange,
  label,
  onPrev,
  onNext,
  nextDisabled,
}: {
  options: PeriodOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="segmented" role="group" aria-label="Periodo">
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" className="icon-btn" onClick={onPrev} aria-label="Periodo anterior">
          <Chevron dir="left" />
        </button>
        <span className="text-[15px] font-semibold min-w-[118px] text-center tabular" style={{ color: "var(--color-ink)" }}>
          {label}
        </span>
        <button type="button" className="icon-btn" onClick={onNext} disabled={nextDisabled} aria-label="Periodo siguiente">
          <Chevron dir="right" />
        </button>
      </div>
    </div>
  );
}

export function Chevron({ dir }: { dir: "left" | "right" | "down" }) {
  const d = dir === "left" ? "15 18 9 12 15 6" : dir === "right" ? "9 6 15 12 9 18" : "6 9 12 15 18 9";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points={d} />
    </svg>
  );
}
