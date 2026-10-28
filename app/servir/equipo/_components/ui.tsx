"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "@/app/_components/ui/Icon";

// Piezas compartidas por Mi equipo y Mis servicios (frente B3).

// Hoja inferior en celular; en escritorio, panel centrado.
export function Hoja({ titulo, subtitulo, onClose, children, pie }: {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  children: ReactNode;
  pie?: ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[65]" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="glass glass-strong fixed z-[70] bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[560px] rounded-t-[var(--radius-sheet)] md:rounded-[var(--radius-sheet)] flex flex-col"
        style={{ maxHeight: "88dvh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-none md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--color-line)" }} />
        </div>
        <div className="px-5 pt-2 md:pt-5 pb-3 flex items-start gap-3 flex-none border-b" style={{ borderColor: "var(--color-line)" }}>
          <div className="flex-1 min-w-0">
            {subtitulo && <p className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>{subtitulo}</p>}
            <h2 className="font-semibold text-lg leading-tight mt-0.5" style={{ color: "var(--color-ink)" }}>{titulo}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {pie && <div className="px-5 py-3 border-t flex-none" style={{ borderColor: "var(--color-line)" }}>{pie}</div>}
      </div>
    </>
  );
}

export function Aviso({ texto, tipo = "error", onClose }: { texto: string; tipo?: "error" | "ok"; onClose?: () => void }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className="card px-4 py-3 text-sm flex items-start gap-2"
      style={{ color: tipo === "error" ? "var(--color-down)" : "var(--color-up)" }}
    >
      <Icon name={tipo === "error" ? "x-circle" : "check-circle"} size={18} style={{ marginTop: 1 }} />
      <span className="flex-1">{texto}</span>
      {onClose && <button type="button" onClick={onClose} aria-label="Cerrar aviso"><Icon name="close" size={14} /></button>}
    </p>
  );
}

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "chip-gold" },
  aceptada:  { texto: "Aceptada",  clase: "chip-up" },
  rechazada: { texto: "Rechazada", clase: "chip-down" },
  cancelada: { texto: "Cancelada", clase: "chip-muted" },
};

export function EstadoChip({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { texto: estado, clase: "chip-muted" };
  return <span className={`chip ${e.clase} flex-none`}>{e.texto}</span>;
}

export const MOMENTO_TEXTO: Record<string, string> = { antes: "Antes", durante: "Durante", despues: "Después" };

export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "·";
}

export function Avatar({ nombre, size = 36 }: { nombre: string; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center flex-none font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36, background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
      aria-hidden
    >
      {iniciales(nombre)}
    </span>
  );
}
