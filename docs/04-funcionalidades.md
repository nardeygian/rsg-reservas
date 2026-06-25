# 04 - Funcionalidades

## Ciclo de vida de una reserva

```
requested  -->  approved
   |   \
   |    -->  rejected
   |
   -->  cancelled
```

| Estado | Quién lo provoca | Qué pasa |
|--------|------------------|----------|
| `requested` | Líder o studio_admin al crear | Queda solicitada. Si el espacio es `self_serve`, puede pasar directo a `approved`. |
| `approved` | Pastor o admin, o automático en espacios self_serve | Ocupa la franja y bloquea choques. |
| `rejected` | Pastor o admin | No ocupa franja. Se notifica al creador con motivo. |
| `cancelled` | Creador o staff | Libera la franja. |

Política por espacio (definida en `spaces.booking_policy`):

- **Auditorio y Salón 45**: `needs_approval`. La reserva entra como `requested` y espera visto bueno.
- **Lobby y Salón 38**: `self_serve`. Si no hay choque, se aprueba sola.
- **Estudio**: `needs_approval`, gestionado por el `studio_admin`.

## Crear una reserva (flujo)

1. El usuario elige espacio, fecha y franja.
2. La app valida choques contra reservas activas. La validación real es la exclusion constraint de la base; la del frontend es solo para dar aviso temprano.
3. El usuario completa tipo de uso y, si aplica, requerimientos y asistencia esperada.
4. Si el espacio es el Estudio y hay un montaje previo que no se puede mover, se marca `montaje_lock` y, si la reserva nueva puede convivir, `shared_occupancy_allowed`.
5. Si es una reserva para un tercero con pago, se marca `payment_status = 'pending'`.
6. Se guarda. Según la política del espacio queda `requested` o `approved`.
7. Se notifica a pastores de sede y admin de casa.

## Reservas recurrentes

Muchos usos de la iglesia se repiten: discipulado semanal, reunión de ministerio, consejería fija.

- La **plantilla** se guarda como una fila con `is_recurrence_template = true`, `recurrence_rule` en formato RRULE de iCal (por ejemplo `FREQ=WEEKLY;BYDAY=TU`) y `starts_at` / `ends_at` definiendo la franja del primer evento. La plantilla no entra al exclusion constraint.
- Al crear la plantilla, el server expande la regla y **materializa cada instancia como una fila hija** con `parent_booking_id` apuntando a la plantilla y `is_recurrence_template = false`. La detección de choques opera sobre instancias, así cubre toda la serie.
- Una instancia se edita o se cancela individualmente (cambiar la hora de la próxima semana, saltar un feriado). Tocar la plantilla no afecta a las instancias ya materializadas; para extender la serie se crean nuevas hijas.

Para el MVP basta con recurrencia semanal simple y la opción de cancelar una instancia. Ventana sugerida: materializar 26 semanas hacia adelante y regenerar con un cron mensual. Patrones más complejos (excepciones BYSETPOS, frecuencias mensuales) quedan para una fase posterior.

## Montaje y buffers

El caso que describiste del Estudio se generaliza a cualquier espacio. Una reserva puede necesitar tiempo de montaje antes y de desmontaje después.

- `spaces.setup_buffer_minutes` y `teardown_buffer_minutes` definen el buffer por defecto del espacio.
- Un trigger sobre `bookings` calcula `time_range` incluyendo esos buffers antes de cada INSERT o UPDATE, así que la exclusion constraint los aplica sin que el cliente tenga que sumarlos.
- `montaje_lock` en una reserva avisa que hay un armado que no se puede mover, aunque el espacio se preste para reuniones encima.

## Requerimientos

Se guardan en el campo `requirements` (JSON) y solo los ven pastores y administradores. Campos sugeridos:

- sillas (número)
- mesas (número)
- hidratación (sí/no)
- sonido (sí/no)
- proyección (sí/no)
- notas (texto libre)

Nota para una fase futura: las sillas y mesas son recursos físicos finitos y compartidos entre salones. Dejar el campo estructurado ahora permite, más adelante, avisar si en un mismo día se piden más sillas de las que existen.

## Pagos de terceros

Para Salón 45 y alquileres del Estudio:

- `payment_status`: `not_applicable`, `pending` o `paid`.
- Solo `admin_casa` y `super_admin` marcan como pagado, y queda registrado en `payment_marked_by`.
- Se puede adjuntar comprobante en `payment_receipt_url` usando Supabase Storage.

## Notificaciones

Las notificaciones viven en Edge Functions de Supabase. El disparador es un **Database Webhook** configurado desde el panel de Supabase sobre INSERT y UPDATE de `bookings`, que hace POST a la Edge Function correspondiente. La Edge Function publica en Slack usando un bot token (`chat.postMessage`).

| Evento | A quién | Canal |
|--------|---------|-------|
| Nueva reserva | Pastores de sede y admin de casa | Mensaje en `#reservas-rsg` |
| Reserva aprobada o rechazada | Creador + staff | DM al creador por Slack (si `profiles.slack_user_id` está mapeado) + eco en `#reservas-rsg` |
| Reserva marcada con montaje o pago pendiente | Admin de casa | Mensaje en `#reservas-rsg` con mention |

Para que los DMs funcionen, cada `profile` debe tener su `slack_user_id` (formato `U0123ABCD`, no el handle). Si está vacío, el evento solo aparece en el canal — el creador no recibe DM. La app ofrece en el perfil un botón "Conectar Slack" que captura el ID y lo guarda. Quien no lo conecte sigue funcionando, simplemente no recibe DMs.

Preferimos Database Webhooks antes que llamar la Edge Function desde la Server Action: así cualquier cambio en `bookings` notifica, incluso el que entre por consola SQL o por un futuro panel admin.

## Vista de pastor y admin

Además del calendario general, los pastores y el admin tienen un panel con:

- Reservas pendientes de aprobación.
- Reservas con pago pendiente.
- Detalle completo de cada reserva: requerimientos, notas internas, banderas.
- Acceso a su feed de calendario con detalle (ver `05-calendario-y-feeds.md`).

## Bitácora

Cada acción relevante (crear, aprobar, rechazar, cancelar, marcar pago) deja registro en `booking_audit`. Útil para rendición de cuentas en la organización.
