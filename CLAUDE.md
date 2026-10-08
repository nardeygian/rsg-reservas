# CLAUDE.md

Instrucciones para desarrollar RSG Reservas. Lee este archivo y los documentos de `docs/` antes de escribir código.

## Propósito

Plataforma de reservas de espacios para la iglesia RSG, con visibilidad por rol. Los líderes reservan y ven info acotada; pastores y administradores ven todo el detalle; el administrador del Estudio sincroniza reservas de su negocio (etiqueta genérica) y de RSG (detalle). El objetivo final es que sea una PWA instalable y, más adelante, una app.

## Stack y convenciones

- Next.js App Router con TypeScript en modo estricto. Server Components por defecto; Client Components solo donde haya interacción.
- Supabase como backend: Postgres, Auth, Row Level Security, Realtime, Storage.
- Tailwind para estilos. Mobile first, porque los líderes reservan desde el celular.
- Cliente de Supabase tipado generado desde el esquema (`supabase gen types typescript`).
- Nombres de tablas y columnas en inglés y en snake_case. **Valores de enums de dominio (`use_type`, `ministries.type`, etc.) en español**, porque reflejan vocabulario que el equipo usa en voz alta. Componentes en PascalCase.

## Reglas de oro (no negociables)

1. **La seguridad vive en la base, no en el cliente.** Toda tabla con datos sensibles tiene RLS activado. Nunca confíes en el frontend para ocultar información: si un rol no debe ver un campo, ese campo no debe salir de la base para ese rol. RLS solo filtra filas — para columnas se revoca SELECT directo sobre `bookings` y todo el acceso pasa por vistas (`bookings_calendar`, `bookings_staff`). Los clientes nunca consultan `bookings` directamente. Ver `docs/03-roles-y-visibilidad.md`.

2. **Nunca permitas dobles reservas.** El solapamiento se previene con una exclusion constraint en Postgres, no con validación en JavaScript. Los buffers de montaje y desmontaje se incluyen en `time_range` vía trigger; las reservas recurrentes se materializan en instancias hijas que sí entran al constraint. La única excepción al constraint es el Estudio cuando la reserva tiene `shared_occupancy_allowed = true`. Ver `docs/02-modelo-de-datos.md`.

3. **Las horas se guardan en UTC y se muestran en `America/Bogota`.** Toda fecha en la base es `timestamptz`. La conversión a hora local ocurre solo en la capa de presentación.

4. **La visibilidad por rol es sagrada.** Una reserva de negocio del Estudio jamás debe filtrar detalle a un líder ni a un pastor. Las notas internas y el estado de pago solo los ven pastores y administradores. Esto se controla con vistas y RLS, no con condicionales sueltos en la UI.

5. **Los feeds de calendario no llevan login, llevan token.** El feed de suscripción se protege con un token secreto y revocable por usuario, no con usuario y contraseña. Ver `docs/05-calendario-y-feeds.md`.

## Orden de construcción

Sigue las fases de `docs/06-roadmap.md`. No adelantes funcionalidades de fases posteriores hasta cerrar el MVP. Resumen del MVP:

1. Esquema de base de datos + RLS + datos semilla.
2. Auth con Supabase (registro, login, roles).
3. Vista de calendario general (lectura).
4. Crear reserva con detección de choques y flujo de aprobación.
5. Vista de detalle para pastores y administradores.
6. Agregar a calendario personal (.ics) y feed de suscripción.

## Cómo trabajar en este repo

- Cada cambio de esquema va como una migración SQL versionada, nunca editando tablas a mano en producción.
- Antes de exponer cualquier dato nuevo, define su política RLS en el mismo cambio.
- Escribe los tipos de TypeScript a partir del esquema, no a mano.
- Si una decisión de visibilidad no está clara, asume lo más restrictivo y déjalo anotado.

Para el Portal RSG (unificar calendario, reservas, servicio y donaciones), lee docs/portal.md.

## Portal RSG

Esta app está creciendo para ser el Portal RSG: Reservas, Calendario RSG, Servicio, Donaciones y Mis discípulos en una sola app.

- El plan y el estado están en `ROADMAP.md`. Léelo al empezar cualquier trabajo del portal.
- Antes de cada etapa lee `docs/portal/00-vision-y-arquitectura.md`, `docs/portal/01-reglas-que-no-se-rompen.md`, `docs/portal/02-construccion-en-paralelo.md` y el documento de la etapa.
- Se construye en paralelo en la rama `portal`. Lo que hoy funciona (reservas en producción y el panel PHP de Hostinger) no se toca hasta el paso a producción de cada módulo.
- Nunca corras migraciones ni cambies datos en el Supabase de producción sin permiso explícito de Gian.
- Propón el plan de cada etapa y espera aprobación antes de escribir código.
- Al cerrar un punto, actualiza la tabla de estado de `ROADMAP.md`.

