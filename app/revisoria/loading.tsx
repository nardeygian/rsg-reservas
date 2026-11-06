export default function RevisoriaLoading() {
  const bloque = (h: string, key?: number) => (
    <div key={key} className={`rounded-[var(--radius-card)] ${h} animate-pulse`} style={{ background: "var(--color-surface)" }} />
  );
  return (
    <main className="min-h-dvh">
      <div className="px-4 md:px-8 pt-5 pb-28 max-w-6xl mx-auto w-full flex flex-col gap-4">
        <div className="h-8 w-48 rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface)" }} />
        {bloque("h-[120px]")}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1, 2, 3, 4].map((i) => bloque("h-[84px]", i))}</div>
        {bloque("h-[240px]")}
        {[1, 2, 3].map((i) => bloque("h-[56px]", i))}
      </div>
    </main>
  );
}
