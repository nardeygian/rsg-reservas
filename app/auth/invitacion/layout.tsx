import { ThemeToggle } from "@/app/_components/ThemeToggle";

// Misma presentación que login y registro: la invitación se abre sin sesión.
export default function InvitacionLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="brand-arc fixed inset-0 overflow-y-auto">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="min-h-full flex flex-col items-center justify-center px-5 py-14">
        <span aria-hidden className="brand-mark" style={{ width: 64, color: "var(--color-accent)" }} />
        <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.025em] text-center" style={{ color: "var(--color-ink)" }}>
          Panel Resurgencia
        </h1>
        <p className="mt-1.5 text-[15px] text-center" style={{ color: "var(--color-muted)" }}>
          Invitación a servir
        </p>
        <div className="glass liquid w-full max-w-sm mt-8 rounded-[var(--radius-sheet)] p-6">
          {children}
        </div>
      </div>
    </main>
  );
}
