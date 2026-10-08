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

Una persona puede tener **varios roles**, y algunos llevan **alcance**. Ejemplo: Gian es `super_admin`, `mentor` del discipulado `gian-camila` y `planeacion`. La interfaz muestra la unión de lo que permiten sus roles.

Roles actuales en `profiles.role`: `leader`, `mentor`, `pastor_ministerio`, `pastor_sede`, `admin_casa`, `studio_admin`, `super_admin`. Solicitables en `requested_role`: `lider_departamento`, `mentor`, `pastor_ministerio`, `pastor_sede`, `servidor_planeacion`. La etapa 0 los unifica en una tabla de roles con alcance (ver `etapa-0-bases.md`).

### Qué ve cada rol

| | Reservas | Calendario | Servicio | Donaciones | Mis discípulos |
|---|---|---|---|---|---|
| super_admin | Todo | Todo | Todo, edita | Todo, edita | Todos los discipulados |
| planeacion | Según reglas actuales | Todo, con servidores | Todo, edita | **Nada, nunca** | No |
| mentor (alcance: discipulado) | Según reglas actuales | Eventos | Solo sus discípulos, lectura | Solo Módulo Dar de sus discípulos, sin datos personales | Solo su discipulado |
| pastor_sede | Detalle completo | Todo | Por decidir | Por decidir | Por decidir |
| pastor_ministerio, leader, lider_departamento | Según reglas actuales | Eventos | No | No | No |
| admin_casa | Detalle completo | Eventos | No | No | No |
| studio_admin | Lo del Estudio | Lo del Estudio | No | No | No |

"Por decidir" se pregunta a Gian antes de la etapa correspondiente. Mientras tanto: sin acceso.

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
