# Visión y arquitectura

## Qué es

El Portal RSG reúne en una sola app las herramientas de líderes y pastores de Resurgencia (Barranquilla). Hoy están repartidas:

| Herramienta | Hoy | En el portal |
|---|---|---|
| Reservas de espacios | Esta app (Next.js 15 + Supabase, Vercel) | Se queda, con rediseño visual |
| Calendario RSG | No existe como vista. Los eventos viven en el proyecto "Calendario RSG" de Asana | Nuevo |
| Servicio (servidores por reunión) | Panel PHP en resurgencia.com/pago/panel/ | Se reconstruye aquí |
| Donaciones | El mismo panel PHP | Se reconstruye aquí |
| Mis discípulos | No existe | Nuevo: donaciones y servicio de cada discípulo juntos |

**Una sola app, un solo ecosistema.** Al final, todos los datos viven en Supabase y toda la interfaz en esta app.

## Arquitectura final

```
portal.resurgencia.com  (Next.js en Vercel, plan Hobby)
   ├── Reservas · Calendario · Servicio · Donaciones · Mis discípulos · Inicio
   └── Supabase (plan Free)
         · personas, roles con alcance, directorio (discipulados, discípulos, servidores)
         · reservas y espacios
         · reuniones (sync de Asana), listados de servidores
         · donaciones (en línea y efectivo), formularios, asignaciones

resurgencia.com  (Hostinger)  sigue siendo:
   · el sitio público
   · el flujo de Dar: dar.html → crear-pago.php → Wompi → gracias.php
   · el webhook de Wompi (webhook-wompi.php), que además envía cada donación a Supabase
   · el DNS y el correo del dominio

GitHub Actions (repo privado resurgencia/rsg-respaldos), una vez al día:
   · respaldo cifrado de Supabase
   · importación de Hostinger a Supabase (durante la construcción)
   · conciliación de totales
```

## Costos

Todo en planes gratis: Vercel Hobby (pedir donaciones no cuenta como uso comercial según Vercel) y Supabase Free (500 MB, 2 proyectos). Los dos puntos débiles del plan gratis de Supabase se cubren en la etapa 0:

- **Se pausa tras 7 días sin actividad.** La tarea diaria de respaldo lo mantiene activo.
- **No trae copias de seguridad.** Hay un respaldo diario cifrado propio.

Mejora opcional futura: Supabase Pro (25 USD al mes), por respaldos administrados.

## Roles

Una persona puede tener **varios roles**, y algunos llevan **alcance**. Ejemplo: Gian es `super_admin`, `lider_discipulado` del discipulado `gian-camila` y `servidor_planeacion`. La interfaz muestra la unión de lo que permiten sus roles.

| Rol (código) | Nombre en pantalla | Alcance | Antes, en reservas |
|---|---|---|---|
| `lider_departamento` | Líder de Departamento | departamento | `leader`, `lider_departamento` |
| `lider_discipulado` | Líder de Discipulado | discipulado | `mentor` |
| `pastor_sede` | Pastor de Sede | sede | `pastor_sede` |
| `pastor_ministerio` | Pastor de Ministerio | ministerio | `pastor_ministerio` |
| `servidor_planeacion` | Servidor Planeación | | `servidor_planeacion` (solo como solicitud) |
| `admin_casa` | Administrador de casa | | `admin_casa` |
| `studio_admin` | Administrador del Estudio | | `studio_admin` |
| `super_admin` | Administración | | `super_admin` |

"Mentor" deja de usarse como nombre: es siempre Líder de Discipulado. Servidor Planeación son los servidores de RSG que trabajan con Planeación.

### Permisos: los roles son paquetes, el super admin decide

Lo que cada persona ve no depende directamente del rol, sino de sus **permisos**. Cada rol trae un paquete de permisos por defecto, y **el super admin puede dar o quitar cualquier permiso a cualquier persona**, por encima de su rol. Así, por ejemplo, puede darle a un Pastor de Sede la vista de donaciones de un discipulado, o quitarle a alguien el calendario, sin crear roles nuevos.

Catálogo de permisos (algunos llevan alcance):

| Permiso | Qué permite | Alcance |
|---|---|---|
| `reservas.usar` | Ver disponibilidad y reservar | |
| `reservas.detalle` | Ver el detalle completo de reservas (requerimientos, pagos de terceros) | |
| `reservas.estudio` | Gestionar las reservas del Estudio | |
| `calendario.ver` | Ver el Calendario RSG | |
| `calendario.servidores` | Ver los equipos de servidores en el calendario | |
| `servicio.ver` | Ver todo el módulo de Servicio | |
| `servicio.editar` | Subir listados, marcar ausencias, corregir servidores | |
| `servicio.discipulado` | Ver el servicio de los discípulos de un discipulado | discipulado |
| `donaciones.ver` | Ver todas las donaciones, sin correo ni cédula | |
| `donaciones.datos_personales` | Ver correo, cédula y referencia de los donantes | |
| `donaciones.configurar` | Discipulados, asignaciones, formularios, grupos especiales | |
| `donaciones.discipulado` | Ver los aportes del Módulo Dar de un discipulado, sin datos personales | discipulado |
| `discipulos.ver` | Ver Mis discípulos (lo que muestra depende de sus otros permisos) | discipulado |
| `admin.personas` | Gestionar personas, roles y permisos | |

### Paquetes por defecto

| Rol | Permisos por defecto |
|---|---|
| super_admin | Todos. No se le pueden quitar. |
| servidor_planeacion | Todo lo de reservas que tenga hoy, `calendario.ver`, `calendario.servidores`, `servicio.ver`, `servicio.editar`. **Ningún permiso de donaciones.** |
| lider_discipulado | `reservas.usar`, `calendario.ver`, y para su discipulado: `servicio.discipulado`, `donaciones.discipulado`, `discipulos.ver` |
| pastor_sede | `reservas.usar`, `reservas.detalle`, `calendario.ver`, `calendario.servidores` |
| pastor_ministerio, lider_departamento | `reservas.usar`, `calendario.ver` |
| admin_casa | `reservas.usar`, `reservas.detalle`, `calendario.ver` |
| studio_admin | `reservas.estudio`, `calendario.ver` (solo lo del Estudio) |

Los paquetes de reservas deben respetar las reglas que reservas ya tiene hoy. Si hay diferencias, manda lo que hace hoy reservas, y se le pregunta a Gian.

### Reglas del sistema de permisos

- **Permisos efectivos** = permisos de sus roles + los que el super admin le dio − los que el super admin le quitó. Una quita gana sobre el rol.
- **Todo cambio queda registrado:** quién, a quién, qué permiso, cuándo. El registro se ve en `/admin/personas`.
- **Los permisos de donaciones piden confirmación** al darlos ("Esta persona va a ver aportes de la congregación"), y `donaciones.datos_personales` aparte, con otra confirmación.
- **No se puede quitar el último super_admin.**
- **Los permisos se cumplen en la base (RLS)**, no solo escondiendo botones. Una función `has_permission(permiso, alcance)` es la que usan todas las políticas.

## Sistema visual

La referencia es el panel PHP de donaciones (`resurgencia-web/pago/panel/index.html`). Todo el portal debe sentirse así: sobrio, verde profundo, tarjetas limpias, cifras grandes, y cómodo en el celular, que es donde más se usa.

Tipografías: **Sora** (títulos y cifras, 500 a 700) y **Public Sans** (texto, 400 a 700).

| Token | Claro | Oscuro |
|---|---|---|
| bg | #F3F5F4 | #0E1311 |
| surface | #FFFFFF | #161D1A |
| surface-2 | #EDF1EF | #1C2521 |
| ink | #131A17 | #E7EEEA |
| muted | #5A6661 | #A1AEA8 |
| faint | #8A9590 | #76837D |
| line | #DCE3DF | #2A3531 |
| accent | #0B6E55 | #43C29C |
| accent-ink | #FFFFFF | #06140F |
| accent-soft | #DDEFE8 | #193A30 |
| up | #0B7A3E | #5AD08A |
| down | #B3261E | #FF8A80 |
| gold | #9A6B00 | #E3B44C |

Radio de tarjetas: 10 px. Números con `font-variant-numeric: tabular-nums`. Patrones a conservar del panel: bloque principal en color acento con la cifra grande, tarjetas plegables, tablas que en el celular se vuelven tarjetas, aviso flotante ("toast") para novedades en vivo y la vista "Hoy" de servicio.

Textos de la interfaz en español, tono cercano e inclusivo, sin guiones largos.
