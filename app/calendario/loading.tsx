export default function CalendarioLoading() {
  return (
    <main className="min-h-dvh flex flex-col">
      <div className="flex-1 px-4 pt-5 pb-4 max-w-md mx-auto w-full flex flex-col gap-3">
        {/* Header bar */}
        <div className="rounded-[var(--radius-control)] h-[52px] animate-pulse" style={{ background: "var(--color-surface)" }} />

        {/* Event cards */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-[var(--radius-card)] h-[72px] animate-pulse" style={{ background: "var(--color-surface)" }} />
        ))}
      </div>
    </main>
  );
}
