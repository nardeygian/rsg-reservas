import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/app/_components/ui/Icon";

// Piezas de lista agrupada (mismo estilo que /perfil) para las pantallas
// de Cuenta.

export function Pagina({ titulo, volver, children }: { titulo: string; volver: { href: string; label: string }; children: ReactNode }) {
  return (
    <main className="min-h-dvh px-4 pt-6 pb-[calc(var(--nav-space)+24px)] md:pb-10 max-w-lg mx-auto w-full flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href={volver.href} className="inline-flex items-center gap-1 text-[14px] font-semibold self-start" style={{ color: "var(--color-muted)" }}>
          <Icon name="chevron-left" size={16} />
          {volver.label}
        </Link>
        <h1 className="text-[26px] font-semibold tracking-[-0.025em]" style={{ color: "var(--color-ink)" }}>{titulo}</h1>
      </header>
      {children}
    </main>
  );
}

export function Grupo({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title && <h2 className="px-4 text-[13px] font-medium" style={{ color: "var(--color-muted)" }}>{title}</h2>}
      <div className="card overflow-hidden divide-y">{children}</div>
      {footer && <div className="px-4 text-[12px] leading-relaxed" style={{ color: "var(--color-faint)" }}>{footer}</div>}
    </section>
  );
}

export function Fila({ icon, label, detail, trailing }: { icon?: ReactNode; label: ReactNode; detail?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 min-h-[56px] w-full text-left">
      {icon}
      <span className="flex-1 min-w-0 py-2.5">
        <span className="block text-[15px] font-medium" style={{ color: "var(--color-ink)" }}>{label}</span>
        {detail && <span className="block text-[13px] truncate" style={{ color: "var(--color-muted)" }}>{detail}</span>}
      </span>
      {trailing}
    </div>
  );
}

export function Mensaje({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <p role={error ? "alert" : "status"} className="card px-4 py-3 text-sm" style={{ color: error ? "var(--color-down)" : "var(--color-up)" }}>
      {error ?? ok}
    </p>
  );
}

export function Inicial({ texto }: { texto: string }) {
  return (
    <span
      aria-hidden
      className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-none text-[13px] font-semibold"
      style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
    >
      {texto}
    </span>
  );
}
