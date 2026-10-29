import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import type { EstadoReunion } from "@/lib/servir/contratos";

export const ESTADOS: { value: EstadoReunion; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "publicada", label: "Publicada" },
  { value: "en_vivo", label: "En vivo" },
  { value: "cerrada", label: "Cerrada" },
  { value: "cancelada", label: "Cancelada" },
];

const CHIP_ESTADO: Record<string, string> = {
  borrador: "chip-gold",
  publicada: "chip-accent",
  en_vivo: "chip-up",
  cerrada: "chip-muted",
  cancelada: "chip-down",
};

export function EstadoChip({ status }: { status: string }) {
  const label = ESTADOS.find((e) => e.value === status)?.label ?? status;
  return <span className={`chip ${CHIP_ESTADO[status] ?? "chip-muted"} flex-none`}>{label}</span>;
}

export function PuntoColor({ color, size = 10 }: { color: string | null; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block rounded-full flex-none"
      style={{ width: size, height: size, background: color ?? "var(--color-line-strong)" }}
    />
  );
}

// Contenedor de página: celular angosto, escritorio ancho.
export function Pagina({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh px-4 pt-6 pb-[calc(var(--nav-space)+24px)] md:pb-10 max-w-md md:max-w-[1180px] md:px-[clamp(12px,3vw,40px)] mx-auto w-full flex flex-col gap-5">
      {children}
    </main>
  );
}

export function Encabezado({
  titulo, subtitulo, volver, children,
}: {
  titulo: string; subtitulo?: ReactNode; volver?: { href: string; label: string }; children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {volver && (
        <Link href={volver.href} className="inline-flex items-center gap-1 text-[14px] font-semibold self-start" style={{ color: "var(--color-muted)" }}>
          <Icon name="chevron-left" size={16} />
          {volver.label}
        </Link>
      )}
      <div className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="page-title">{titulo}</h1>
          {subtitulo && <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>{subtitulo}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}

export function SinAcceso({ texto }: { texto: string }) {
  return (
    <div className="card p-6 flex items-start gap-3">
      <Icon name="lock" size={20} style={{ color: "var(--color-muted)" }} />
      <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>{texto}</p>
    </div>
  );
}

// Enlace con forma de botón secundario redondeado (como "Cancelar" en Reservas).
export function BotonEnlace({ href, children, primario }: { href: string; children: ReactNode; primario?: boolean }) {
  return (
    <Link
      href={href}
      prefetch
      className="h-10 px-4 rounded-full text-[14px] font-semibold inline-flex items-center gap-1.5 flex-none"
      style={primario
        ? { background: "var(--color-action-bg)", color: "var(--color-action-fg)" }
        : { background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-ink)", boxShadow: "inset 0 1px 0 var(--glass-border)" }}
    >
      {children}
    </Link>
  );
}
