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

La referencia es el **RSG Visual Identity Deck** (concepto *Aprendiendo a volver*; tagline "Orgánica. Funcional. Sin prisa."). El portal debe sentirse moderno, cálido y sereno: papel cálido, verde bosque, degradados suaves como el arco del deck, y cómodo en el celular, que es donde más se usa. No usar el verde menta ni Sora/Public Sans del sistema anterior: hacían que la app se viera genérica.

**Tipografía:** **Instrument Sans** (variable, ejes de peso y ancho) para toda la app: títulos, texto y cifras. Sin fuentes cursivas ni serif en la app; Riccione Serial y Compendium quedan para piezas impresas y redes. Cifras con `font-variant-numeric: tabular-nums` (clase `.tabular`).

**Paleta de marca:** Forest Green `#003329`, Light Green `#BDCDC2`, Soft Blue `#B1CAD2`, Pale Yellow `#E5E5CF`, Choco Brown `#342B21`, Dark Grey `#20231F`, papel `#E9E7E2`.

| Token | Claro | Oscuro |
|---|---|---|
| bg | #E9E7E2 (papel) | #071A15 (bosque profundo) |
| surface | #F6F5F1 | #0F2620 |
| surface-2 | #E1DED6 | #15312A |
| ink | #20231F | #E9E7E2 |
| muted | #55524A | #AFBDB4 |
| faint | #858177 | #7D8F86 |
| line | #D6D2C8 | #20403A |
| accent | #003329 | #BDCDC2 |
| accent-ink | #F6F5F1 | #003329 |
| accent-soft | #D3DED6 | #1B3A32 |
| up | #1F6B4F | #8CC5A6 |
| down | #9A3B2E | #E8A094 |
| gold (pendiente) | #8A7424 sobre #E5E5CF | #E5E5CF sobre #2E2C1D |
| info (tus reservas) | #2E5A66 sobre #D2E0E5 | #B1CAD2 sobre #17323A |

**Degradados** (en `app/globals.css`):
- `.brand-hero`: bloque principal con la cifra grande. Arco verde bosque que se abre hacia azul suave (`--grad-hero`), texto claro y mosaicos translúcidos (`.brand-hero-tile`).
- `.brand-arc`: fondo de pantalla completa con el arco difuminado del deck (login y pantallas de bienvenida).
- Los degradados son para los momentos importantes. El resto de la interfaz va en colores planos.

**Monograma:** `public/brand/rgs-mark.png` es una máscara; con la clase `.brand-mark` toma el color de `color`. El ícono de la app (`app/icon.png`, `public/icons/`) es el monograma verde bosque sobre degradado verde claro → azul suave, como en el deck.

**Forma:** radios de 4 a 8 px en controles y 12 px en bloques; líneas finas en vez de cajas cuando sea posible. Etiquetas en mayúsculas espaciadas solo donde aportan (fechas, encabezados de bloque), no encima de cada título.

Textos de la interfaz en español, tono cercano e inclusivo, sin guiones largos.
