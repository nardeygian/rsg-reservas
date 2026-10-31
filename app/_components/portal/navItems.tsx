import type { ReactElement, SVGProps } from "react";
import type { NavCaps } from "@/lib/auth";
import { SERVICIO_OCULTO } from "@/lib/portal/modulos";

// Una sola lista de destinos para el menú lateral (escritorio) y la barra
// inferior (celular): mismos nombres, mismo orden, mismos permisos.

type SvgIcon = ReactElement<SVGProps<SVGSVGElement>>;

export type Destination = {
  id: "inicio" | "calendario" | "servir" | "reservas" | "comunidad" | "dar" | "tu";
  href: string;
  label: string;
  /** Rutas que marcan este destino como activo. */
  match: (pathname: string) => boolean;
  icon: SvgIcon;
};

const svg = (children: React.ReactNode): SvgIcon => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

// Más de 5 destinos (sin contar Tú) no caben en la barra del celular: en ese
// caso Reservas pasa a ser la vista "Espacios" dentro de Calendario
// (decisión 3 de la Etapa 5).
const MAX_DESTINOS = 5;

export function destinations(caps: NavCaps): Destination[] {
  const out = todos(caps);
  if (out.length <= MAX_DESTINOS || !caps.calendario) return out;
  const cal = out.find((d) => d.id === "calendario")!;
  cal.match = (p) => p.startsWith("/calendario") || p.startsWith("/reservas");
  return out.filter((d) => d.id !== "reservas");
}

// ¿Reservas vive dentro de Calendario para esta persona?
export function reservasEnCalendario(caps: NavCaps): boolean {
  return caps.reservas && caps.calendario && todos(caps).length > MAX_DESTINOS;
}

function todos(caps: NavCaps): Destination[] {
  const out: Destination[] = [];
  if (caps.inicio) {
    out.push({ id: "inicio", href: "/", label: "Inicio", match: (p) => p === "/", icon: svg(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>) });
  }
  if (caps.calendario) {
    out.push({ id: "calendario", href: "/calendario", label: "Calendario", match: (p) => p.startsWith("/calendario"), icon: svg(<><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>) });
  }
  if (caps.servir) {
    out.push({ id: "servir", href: "/servir", label: "Servir", match: (p) => p.startsWith("/servir"), icon: svg(<><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4.5V3h6v1.5" /><path d="M9 12.5l2 2 4-4.5" /></>) });
  }
  if (caps.reservas) {
    out.push({ id: "reservas", href: "/reservas", label: "Reservas", match: (p) => p.startsWith("/reservas"), icon: svg(<><path d="M4 21V4h11v17" /><path d="M15 8h5v13" /><path d="M11 12h.01" /></>) });
  }
  // Comunidad: Discipulados y Servidores (todos los que sirven), como vistas separadas.
  // Abre en Discipulados cuando la persona tiene acceso.
  const servicio = caps.servicio !== "none" && !SERVICIO_OCULTO;
  if (servicio || caps.discipulos) {
    out.push({
      id: "comunidad",
      href: caps.discipulos ? "/discipulos" : "/servicio",
      label: servicio && caps.discipulos ? "Comunidad" : caps.discipulos ? (SERVICIO_OCULTO ? "Discípulos" : caps.disciGrupoId ? "Mis discípulos" : "Discipulados") : "Servicio",
      match: (p) => p.startsWith("/servicio") || p.startsWith("/discipulos"),
      icon: svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>),
    });
  }
  if (caps.donaciones !== "none") {
    out.push({ id: "dar", href: "/donaciones", label: "Dar", match: (p) => p.startsWith("/donaciones"), icon: svg(<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" />) });
  }
  return out;
}

export const TU: Destination = {
  id: "tu",
  href: "/perfil",
  label: "Tú",
  match: (p) => p.startsWith("/perfil") || p.startsWith("/admin") || p.startsWith("/aprobaciones"),
  icon: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
};
