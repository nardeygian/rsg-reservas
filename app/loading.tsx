export default function HomeLoading() {
  return (
    <main className="min-h-dvh flex flex-col">
      <div className="flex-1 px-4 pt-5 pb-4 max-w-md mx-auto w-full flex flex-col gap-3">
        {/* Green hero card */}
        <div className="rounded-[var(--radius-card)] h-[116px] animate-pulse" style={{ background: "var(--color-accent-soft)" }} />

        {/* Two-column row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-card)] h-[88px] animate-pulse" style={{ background: "var(--color-surface)" }} />
          <div className="rounded-[var(--radius-card)] h-[88px] animate-pulse" style={{ background: "var(--color-surface)" }} />
        </div>

        <div className="rounded-[var(--radius-card)] h-[96px] animate-pulse" style={{ background: "var(--color-surface)" }} />
        <div className="rounded-[var(--radius-card)] h-[96px] animate-pulse" style={{ background: "var(--color-surface)" }} />
      </div>
    </main>
  );
}
