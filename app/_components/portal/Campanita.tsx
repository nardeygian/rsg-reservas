import Link from "next/link";

// Campanita del Inicio: abre la bandeja de avisos y muestra cuántos faltan
// por leer.
export function Campanita({ sinLeer }: { sinLeer: number }) {
  const etiqueta = sinLeer > 0 ? `Notificaciones, ${sinLeer} sin leer` : "Notificaciones";
  return (
    <Link
      href="/tu/notificaciones"
      prefetch
      aria-label={etiqueta}
      title={etiqueta}
      className="relative inline-flex items-center justify-center flex-none"
      style={{
        width: 44, height: 44, borderRadius: 999,
        border: "1px solid var(--color-line)", background: "var(--color-surface)", color: "var(--color-ink)",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
      </svg>
      {sinLeer > 0 && (
        <span
          className="tabular absolute"
          style={{
            top: -2, right: -2, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999,
            background: "var(--color-accent)", color: "#fff", fontSize: 11, fontWeight: 700,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--color-bg)",
          }}
        >
          {sinLeer > 99 ? "99+" : sinLeer}
        </span>
      )}
    </Link>
  );
}
