# Prototipo del Portal RSG

> **Actualización:** los colores y tipografías de estos prototipos (verde menta, Sora y Public Sans) **ya no aplican**. El sistema visual vigente sigue el RSG Visual Identity Deck: paleta de marca, Instrument Sans y degradados de marca. Ver `../00-vision-y-arquitectura.md`, sección Sistema visual.

Estas pantallas siguen siendo la referencia de **estructura**: qué información va en cada pantalla, jerarquía, componentes y flujos.

Ábrelas en el navegador para verlas. Los datos son de ejemplo.

| Archivo | Pantalla |
|---|---|
| `Main.html` | Inicio en escritorio, persona con varios roles (admin, líder de discipulado y Planeación) |
| `InicioMentor.html` | Inicio en el celular, líder de discipulado |
| `Calendario.html` | Calendario RSG en el celular |
| `Reservas.html` | Reservas de espacios en el celular |
| `Servicio.html` | Servicio, vista Hoy de Planeación |
| `Discipulos.html` | Ficha de un discípulo |
| `Donaciones.html` | Donaciones, vista de administración |

Patrones a convertir en componentes reutilizables: menú lateral (escritorio) y barra inferior de pestañas (celular, cambian según permisos), bloque principal en color acento con cifra grande, filas de acción dentro del bloque, tarjetas con encabezado y enlace, mosaicos de cifras, barras de proporción, chips y etiquetas de estado, franja de semana, línea de ocupación por espacio, aviso flotante.

Los tokens de color están en `../00-vision-y-arquitectura.md` (sección Sistema visual), en claro y oscuro.
