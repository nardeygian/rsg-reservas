export default function ServicioLoading() {
  return (
    <main className="min-h-dvh flex flex-col" style={{ background: "var(--color-bg)" }}>
      <div className="flex-1 px-4 pt-5 pb-4 max-w-md mx-auto w-full flex flex-col gap-4">
        {/* Title */}
        <div className="h-7 w-36 rounded-[8px] animate-pulse" style={{ background: "var(--color-surface)" }} />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[12px] h-[72px] animate-pulse" style={{ background: "var(--color-surface)" }} />
          ))}
        </div>

        {/* Content cards */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-[12px] h-[64px] animate-pulse" style={{ background: "var(--color-surface)" }} />
        ))}
      </div>
    </main>
  );
}
