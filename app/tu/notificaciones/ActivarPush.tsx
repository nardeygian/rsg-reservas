"use client";

import { useEffect, useState, useTransition } from "react";
import { quitarDispositivo, registrarDispositivo } from "@/lib/notificaciones/acciones";
import {
  desuscribir, estadoPush, nombreDispositivo, suscribir, suscripcionActual, type EstadoPush,
} from "@/lib/notificaciones/push-cliente";
import { ICONOS, IconoFila, svg } from "./_ui";

const DETALLE: Record<EstadoPush, string> = {
  no_soportado: "Este navegador no recibe notificaciones",
  instalar_ios: "En iPhone: Compartir → Agregar a inicio, y ábrela desde ahí",
  sin_configurar: "Las notificaciones push no están configuradas",
  bloqueado: "Bloqueadas. Actívalas en los ajustes del navegador",
  inactivo: "Recibe avisos aunque no tengas el portal abierto",
  activo: "Activas en este dispositivo",
};

export function ActivarPush() {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    let vivo = true;
    (async () => {
      const e = await estadoPush();
      if (!vivo) return;
      setEstado(e);
      // Si ya estaba activa, se vuelve a registrar: el navegador pudo renovarla
      // o la cuenta de este navegador pudo cambiar.
      if (e === "activo") {
        const sub = await suscripcionActual();
        if (sub) await registrarDispositivo({ platform: "web", ...sub, device: nombreDispositivo() });
      }
    })();
    return () => { vivo = false; };
  }, []);

  function activar() {
    setError(null);
    startTransition(async () => {
      try {
        const sub = await suscribir();
        if (!sub) { setEstado(await estadoPush()); return; }
        const r = await registrarDispositivo({ platform: "web", ...sub, device: nombreDispositivo() });
        if (!r.ok) { setError(r.error); return; }
        setEstado("activo");
      } catch {
        setError("No se pudieron activar. Intenta de nuevo.");
      }
    });
  }

  function desactivar() {
    setError(null);
    startTransition(async () => {
      const endpoint = await desuscribir();
      if (endpoint) await quitarDispositivo(endpoint);
      setEstado("inactivo");
    });
  }

  const activo = estado === "activo";
  const accionable = estado === "inactivo" || activo;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 min-h-[56px]">
        <IconoFila tono={activo ? "up" : estado === "bloqueado" ? "down" : "accent"}>{svg(ICONOS.campana)}</IconoFila>
        <span className="flex-1 min-w-0 py-2.5">
          <span className="block text-[15px] font-medium" style={{ color: "var(--color-ink)" }}>Notificaciones push</span>
          <span className="block text-[13px]" style={{ color: "var(--color-muted)" }}>
            {estado ? DETALLE[estado] : "Revisando…"}
          </span>
        </span>
        {accionable && (
          <button
            type="button"
            role="switch"
            aria-checked={activo}
            aria-label="Notificaciones push en este dispositivo"
            disabled={pendiente}
            onClick={activo ? desactivar : activar}
            className="relative w-[51px] h-[31px] rounded-full flex-none transition-colors disabled:opacity-60"
            style={{ background: activo ? "var(--color-accent)" : "var(--color-line)" }}
          >
            <span
              className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white transition-all"
              style={{ left: activo ? 22 : 2, boxShadow: "0 2px 6px rgba(0,0,0,.18)" }}
            />
          </button>
        )}
      </div>
      {error && <p role="alert" className="px-4 pb-3 text-[13px]" style={{ color: "var(--color-down)" }}>{error}</p>}
    </div>
  );
}
