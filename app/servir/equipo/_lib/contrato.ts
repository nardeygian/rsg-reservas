// Comprueba en tiempo de compilación que las acciones cumplen el contrato
// AccionesEquipo de lib/servir/contratos.ts. Si una firma cambia, falla
// `npm run typecheck`.

import type { AccionesEquipo } from "@/lib/servir/contratos";
import {
  asignar,
  cancelarAsignacion,
  guardarBloqueo,
  marcarChecklist,
  responderAsignacion,
  sugerirServidores,
} from "./acciones";

export const accionesEquipo = {
  sugerirServidores,
  asignar,
  cancelarAsignacion,
  responderAsignacion,
  marcarChecklist,
  guardarBloqueo,
} satisfies AccionesEquipo;
