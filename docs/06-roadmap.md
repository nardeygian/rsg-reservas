# 06 - Roadmap

Fases de construcción. No adelantar funcionalidades de fases posteriores hasta cerrar la anterior.

## Fase 0: Cimientos

- Crear proyecto en Supabase.
- Correr el esquema de `02-modelo-de-datos.md`: extensiones, tablas, exclusion constraint, triggers.
- Cargar datos semilla: organizaciones, espacios, ministerios.
- Activar RLS y crear las políticas de `03-roles-y-visibilidad.md`.
- Crear la vista `bookings_calendar`.
- Generar los tipos de TypeScript desde el esquema.

## Fase 1: MVP

El objetivo del MVP es que un líder pueda reservar y que pastores y admin lo vean con detalle.

1. **Auth**: registro, login, sesión con Supabase. Asignación de rol y ministerio.
2. **Calendario general** (lectura) con filtro por espacio y vistas día/semana/mes.
3. **Crear reserva** con detección de choques y flujo de aprobación según la política del espacio.
4. **Vista de detalle para pastor y admin** con requerimientos, notas y estado de pago.
5. **Aprobar y rechazar** reservas.
6. **Agregar a calendario personal** (`.ics` puntual).
7. **Feed de suscripción** con token, en sus dos sabores (staff y acotado).
8. **Notificaciones por Slack**: mensaje en `#reservas-rsg` al crear, aprobar o rechazar, más DM al creador cuando aplique. Configurar Slack bot, captura del `slack_user_id` desde el perfil.

Con esto el sistema ya es usable de punta a punta.

## Fase 2: PWA y comodidad

- Configurar manifest y service worker para que sea instalable.
- Optimizar la experiencia mobile first.
- Reservas recurrentes semanales con excepciones por instancia.
- Adjuntar comprobante de pago en Storage.

## Fase 3: Operación avanzada

- Bitácora visible para administradores.
- Panel de recursos físicos: avisar si en un día se piden más sillas o mesas de las que existen.
- Reportes: uso por espacio, por ministerio, ocupación por franja.
- Gestión de espacios y usuarios desde la interfaz (sin tocar la base a mano).

## Fase 4: App nativa

- Envolver la PWA con Capacitor para iOS y Android.
- Notificaciones push nativas.
- Publicación en las tiendas.

La base de datos y la auth no cambian entre fases. Toda la lógica de negocio vive en Supabase y en las rutas de servidor, no en la UI, justo para que este salto sea limpio.

## Criterio para avanzar de fase

Una fase se cierra cuando todo lo que toca datos sensibles tiene su política RLS probada y no hay forma de ver desde el cliente algo que el rol no debería ver. La seguridad no es una fase aparte: se construye dentro de cada una.
