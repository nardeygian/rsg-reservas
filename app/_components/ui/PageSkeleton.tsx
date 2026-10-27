// Esqueleto compartido: se muestra al instante al cambiar de sección mientras
// llegan los datos, con la misma forma general de las páginas (título,
// bloque principal y tarjetas).
export function PageSkeleton({ hero = true, rows = 4 }: { hero?: boolean; rows?: number }) {
  return (
    <main className="min-h-dvh" aria-busy="true" aria-label="Cargando">
      <div className="px-4 pt-6 pb-4 max-w-[1180px] mx-auto w-full flex flex-col gap-4">
        <div className="h-8 w-44 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface)" }} />
        <div className="h-9 w-64 rounded-full animate-pulse" style={{ background: "var(--color-surface)" }} />
        {hero && <div className="h-[168px] rounded-[var(--radius-card)] animate-pulse" style={{ background: "var(--grad-hero)", opacity: 0.55 }} />}
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-[72px] rounded-[var(--radius-card)] animate-pulse" style={{ background: "var(--color-surface)" }} />
        ))}
      </div>
    </main>
  );
}
