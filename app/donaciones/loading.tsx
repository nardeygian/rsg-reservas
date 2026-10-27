export default function DonacionesLoading() {
  return (
    <main className="min-h-dvh flex flex-col">
      <div className="flex-1 px-4 pt-5 pb-4 max-w-md mx-auto w-full flex flex-col gap-4">
        {/* Title */}
        <div className="h-7 w-40 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface)" }} />

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-card)] h-[80px] animate-pulse" style={{ background: "var(--color-surface)" }} />
          <div className="rounded-[var(--radius-card)] h-[80px] animate-pulse" style={{ background: "var(--color-surface)" }} />
        </div>

        {/* Chart */}
        <div className="rounded-[var(--radius-card)] h-[240px] animate-pulse" style={{ background: "var(--color-surface)" }} />

        {/* List rows */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[var(--radius-card)] h-[56px] animate-pulse" style={{ background: "var(--color-surface)" }} />
        ))}
      </div>
    </main>
  );
}
