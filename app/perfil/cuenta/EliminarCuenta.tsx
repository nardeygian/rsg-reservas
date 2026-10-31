"use client";

import { useState, useTransition } from "react";
import { eliminarMiCuenta, type ResumenEliminacion } from "@/lib/cuentas/acciones";

const PALABRA = "ELIMINAR";

// "Eliminar mi cuenta" (App Store 5.1.1(v) y Google Play): borra la cuenta
// de verdad, con sus reservas. Pide escribir la palabra para no hacerlo por
// accidente.
export function EliminarCuenta({ resumen }: { resumen: ResumenEliminacion }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, start] = useTransition();
  const confirmado = texto.trim().toUpperCase() === PALABRA;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-4 text-[13px] font-medium" style={{ color: "var(--color-muted)" }}>Eliminar cuenta</h2>
      <div className="card overflow-hidden">
        {!abierto ? (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="w-full min-h-[52px] text-[15px] font-medium"
            style={{ color: "var(--color-down)" }}
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <div className="p-4 flex flex-col gap-3">
            <p className="text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>¿Eliminar tu cuenta para siempre?</p>
            <ul className="text-[13px] list-disc pl-5 flex flex-col gap-1" style={{ color: "var(--color-muted)" }}>
              <li>Se borran tu cuenta, tus roles, tus avisos y los dispositivos con notificaciones.</li>
              {resumen.reservas > 0 && (
                <li style={{ color: "var(--color-down)" }}>
                  También se borran {resumen.reservas === 1 ? "la reserva" : `las ${resumen.reservas} reservas`} a tu nombre
                  {resumen.reservas_futuras > 0 ? ` (${resumen.reservas_futuras} ${resumen.reservas_futuras === 1 ? "es próxima" : "son próximas"}: el espacio quedará libre)` : ""}.
                </li>
              )}
              {resumen.ministerios_que_lidera > 0 && (
                <li>{resumen.ministerios_que_lidera === 1 ? "El ministerio que lideras queda" : "Los ministerios que lideras quedan"} sin líder hasta que un administrador asigne otro.</li>
              )}
              <li>Tu correo y tu teléfono salen de tu registro de servidor. Tu nombre y tu historia de servicio quedan para la iglesia, sin cuenta.</li>
              <li>Si entraste con Apple, revocamos el permiso que le diste al portal.</li>
              <li>No se puede deshacer.</li>
            </ul>
            <label className="block">
              <span className="field-label">Escribe {PALABRA} para confirmar</span>
              <input
                className="input mt-2"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                aria-describedby={error ? "eliminar-error" : undefined}
              />
            </label>
            {error && (
              <p
                id="eliminar-error"
                role="alert"
                className="text-sm rounded-[var(--radius-control)] px-4 py-3"
                style={{ background: "var(--color-down-soft)", color: "var(--color-critical)" }}
              >
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => { setAbierto(false); setTexto(""); setError(null); }} disabled={pendiente}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary flex-1 disabled:opacity-45"
                style={{ background: "var(--color-down)", color: "#fff" }}
                disabled={!confirmado || pendiente}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await eliminarMiCuenta();
                    if (r.ok) window.location.assign("/login");
                    else setError(r.error);
                  })
                }
              >
                {pendiente ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
