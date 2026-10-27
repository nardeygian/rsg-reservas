import { ThemeToggle } from "../_components/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="brand-arc fixed inset-0 overflow-y-auto">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="min-h-full flex flex-col items-center justify-center px-5 py-14">
        <span
          aria-hidden
          className="brand-mark"
          style={{ width: 64, color: "var(--color-accent)" }}
        />
        <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.025em] text-center" style={{ color: "var(--color-ink)" }}>
          Panel Resurgencia
        </h1>
        <p className="mt-1.5 text-[15px] text-center" style={{ color: "var(--color-muted)" }}>
          Reservas, servicio y donaciones en un solo lugar
        </p>
        <div className="glass liquid w-full max-w-sm mt-8 rounded-[var(--radius-sheet)] p-6">
          {children}
        </div>
        <p className="mt-10 text-[11px] font-medium tracking-[0.2em] uppercase" style={{ color: "var(--color-muted)" }}>
          Orgánica · Funcional · Sin prisa
        </p>
      </div>
    </main>
  );
}
