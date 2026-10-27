export default function ReservasLoading() {
  return (
    <main className="min-h-dvh flex flex-col">
      <div className="flex-1 px-4 pt-5 pb-4 max-w-md mx-auto w-full flex flex-col gap-3">
        {/* View toggle */}
        <div className="rounded-[var(--radius-control)] h-[44px] animate-pulse" style={{ background: "var(--color-surface)" }} />

        {/* Day nav */}
        <div className="rounded-[var(--radius-control)] h-[52px] animate-pulse" style={{ background: "var(--color-surface)" }} />

        {/* Hour label spacer */}
        <div className="h-4" />

        {/* Space rows */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-[var(--radius-control)] h-[58px] animate-pulse" style={{ background: "var(--color-surface)" }} />
        ))}

        {/* Nueva reserva button */}
        <div className="rounded-[var(--radius-control)] h-[48px] mt-auto animate-pulse" style={{ background: "var(--color-accent-soft)" }} />
      </div>
    </main>
  );
}
