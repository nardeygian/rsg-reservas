// Verificación en compilación: las acciones de B4 cumplen el contrato.
import type { AccionesNotificaciones } from "@/lib/servir/contratos";
import { enviarMasivo, marcarLeidas, registrarDispositivo } from "./acciones";

export const accionesNotificaciones = {
  registrarDispositivo,
  enviarMasivo,
  marcarLeidas,
} satisfies AccionesNotificaciones;
