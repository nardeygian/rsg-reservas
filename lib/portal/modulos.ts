// Módulos que se pueden ocultar sin borrarlos. Se fijan al construir la app
// (variables NEXT_PUBLIC_), así cada ambiente de Vercel decide.

// El módulo Servicio (/servicio) se retira en la Fase D. Con "1" deja de
// aparecer en el menú, en Inicio y en Comunidad; la ruta sigue existiendo.
export const SERVICIO_OCULTO = process.env.NEXT_PUBLIC_OCULTAR_SERVICIO === "1";
