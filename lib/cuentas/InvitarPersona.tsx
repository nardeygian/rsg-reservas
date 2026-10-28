"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import { crearEnlaceInvitacion, invitarPersona } from "./acciones";

// Invitar a una persona de `people` a crear su cuenta. Se puede usar en
// cualquier pantalla de equipos: <InvitarPersona personId nombre email phone />.
// El permiso lo revisa la base (crear_invitacion exige servir.asignar en el
// alcance de la persona).
export function InvitarPersona({
  personId,
  nombre,
  email,
  phone,
}: {
  personId: string;
  nombre: string;
  email?: string | null;
  phone?: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [correo, setCorreo] = useState(email ?? "");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendiente, start] = useTransition();

  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;
  const mensaje = url
    ? `Hola ${primerNombre}, te invito al portal de RSG para ver tus servicios y recibir los avisos del equipo. Entra con este enlace (es solo para ti): ${url}`
    : "";
  const digitos = (phone ?? "").replace(/\D/g, "");
  // Números de Colombia sin indicativo: se agrega el 57.
  const telefonoWa = digitos.length === 10 ? `57${digitos}` : digitos;
  const whatsapp = url ? `https://wa.me/${telefonoWa}?text=${encodeURIComponent(mensaje)}` : "";

  function generar() {
    start(async () => {
      setAviso(null);
      const r = await crearEnlaceInvitacion(personId);
      if (r.ok) { setUrl(r.data.url); setCopiado(false); }
      else setAviso({ tipo: "error", texto: r.error });
    });
  }

  function enviarCorreo(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setAviso(null);
      const r = await invitarPersona(personId, correo);
      if (r.ok) { setUrl(null); setAviso({ tipo: "ok", texto: `Le enviamos la invitación a ${correo.trim()}.` }); }
      else setAviso({ tipo: "error", texto: r.error });
    });
  }

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo copiar. Mantén presionado el enlace para copiarlo." });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {url ? (
        <div className="flex flex-col gap-2">
          <input readOnly value={url} className="input text-[13px]" aria-label={`Enlace de invitación de ${nombre}`} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex gap-2">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-primary flex-1">
              Enviar por WhatsApp
            </a>
            <button type="button" onClick={copiar} className="btn-secondary flex-none" aria-live="polite">
              <Icon name={copiado ? "check" : "copy"} size={16} />
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-[12px]" style={{ color: "var(--color-faint)" }}>
            Vence en 7 días y sirve una sola vez. Si generas otro, este deja de funcionar.
          </p>
        </div>
      ) : (
        <button type="button" onClick={generar} disabled={pendiente} className="btn-primary w-full">
          {pendiente ? "Generando…" : "Crear enlace para WhatsApp"}
        </button>
      )}

      <form onSubmit={enviarCorreo} className="flex gap-2">
        <input
          type="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="correo@ejemplo.com"
          className="input flex-1 min-w-0"
          aria-label={`Correo de ${nombre}`}
          autoComplete="off"
        />
        <button type="submit" disabled={pendiente} className="btn-secondary flex-none">Enviar</button>
      </form>

      {aviso && (
        <p
          role={aviso.tipo === "error" ? "alert" : "status"}
          className="text-sm rounded-[var(--radius-control)] px-4 py-3"
          style={aviso.tipo === "error"
            ? { background: "var(--color-down-soft)", color: "var(--color-critical)" }
            : { background: "var(--color-up-soft)", color: "var(--color-up)" }}
        >
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
