"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import { aceptarInvitacion } from "@/lib/cuentas/acciones";

export function AceptarInvitacion({ token, cuenta, yaUnida }: { token: string; cuenta: string; yaUnida: boolean }) {
  const [listo, setListo] = useState(yaUnida);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, start] = useTransition();

  if (listo) {
    return (
      <div className="flex flex-col items-center text-center gap-3" role="status">
        <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--color-up-soft)", color: "var(--color-up)" }}>
          <Icon name="check-circle" size={24} />
        </span>
        <p className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>Tu cuenta quedó unida</p>
        <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
          Desde ahora verás tus servicios y te llegarán los avisos de tu equipo.
        </p>
        <Link href="/" className="btn-primary w-full mt-1">Entrar al portal</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-center" style={{ color: "var(--color-muted)" }}>
        Entraste como <strong style={{ color: "var(--color-ink)" }}>{cuenta}</strong>
      </p>
      <button
        type="button"
        className="btn-primary w-full"
        disabled={pendiente}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await aceptarInvitacion(token);
            if (r.ok) setListo(true);
            else setError(r.error);
          })
        }
      >
        {pendiente ? "Uniendo…" : "Aceptar y unir mi cuenta"}
      </button>
      {error && (
        <p
          role="alert"
          className="text-sm rounded-[var(--radius-control)] px-4 py-3"
          style={{ background: "var(--color-down-soft)", color: "var(--color-critical)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
