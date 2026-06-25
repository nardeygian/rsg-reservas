# 01 - Arquitectura

## Decisiones técnicas

### Frontend: Next.js como PWA

Usamos Next.js con App Router. La app se configura como PWA (manifest + service worker) para que sea instalable desde el navegador en celular y escritorio. Esta es la pieza clave que conecta el "hoy vive en web" con el "mañana es app": una sola base de código, instalable ya, y envolvible como app nativa más adelante sin reescribir la lógica.

- Server Components por defecto para todo lo que sea lectura de datos.
- Client Components solo para interacción (formulario de reserva, calendario interactivo, realtime).
- Tailwind para estilos, con enfoque mobile first.

### Backend: Supabase

Supabase nos da en un solo lugar lo que de otro modo construiríamos a mano:

- **Postgres**: base relacional con exclusion constraints para impedir solapamientos.
- **Auth**: registro, login y sesión. Cubre tu requisito de usuario y contraseña.
- **Row Level Security**: control de acceso a nivel de fila. Es la respuesta directa a "que nadie se salte la seguridad". Aunque alguien llame la API directamente, solo recibe las filas que su rol permite.
- **Realtime**: el calendario se actualiza en vivo cuando alguien crea o cambia una reserva.
- **Storage**: para adjuntar comprobantes de pago de terceros.

### Notificaciones

Supabase Edge Functions, disparadas por Database Webhooks sobre INSERT y UPDATE de `bookings`. La única plataforma de notificación es Slack:

- Mensaje en el canal `#reservas-rsg` cada vez que se crea, aprueba, rechaza o se marca pago/montaje. El staff opera desde ahí.
- DM por Slack al creador cuando aprueban o rechazan su reserva, si tiene `profiles.slack_user_id` mapeado.

No usamos correo ni WhatsApp: todo el staff y los líderes ya están en el workspace de Slack de RSG, y mantener Mailgun/ManyChat añadía dos integraciones más que cuidar.

## Zona horaria

Regla única: se guarda en UTC, se muestra en `America/Bogota`.

Todas las columnas de fecha y hora son `timestamptz`. La app convierte a hora local solo al renderizar. Esto evita el clásico desfase de una hora y los errores de reservas que aparecen en el día equivocado.

## Despliegue

| Pieza | Dónde vive |
|-------|------------|
| App Next.js | Vercel |
| Base de datos, Auth, Storage | Supabase (nube) |
| Edge Functions (notificaciones) | Supabase |
| Landing pública opcional | Hostinger |

Nota honesta sobre Hostinger: el hosting compartido no corre Next.js ni Postgres de forma limpia, por eso la aplicación corre en Vercel + Supabase. Si más adelante queremos una página pública de presentación, esa sí puede vivir en Hostinger apuntando a la app.

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # solo en servidor, nunca expuesta al cliente
MAILGUN_API_KEY=                  # para notificaciones por correo
MAILGUN_DOMAIN=
MANYCHAT_WEBHOOK_URL=             # opcional, notificaciones por WhatsApp
```

La `service_role_key` solo se usa en Edge Functions y rutas de servidor. Nunca llega al navegador.

## Camino a app nativa

Cuando llegue el momento, la PWA se puede envolver con Capacitor para generar binarios de iOS y Android reutilizando todo el frontend. La base de datos y la auth no cambian. Por eso conviene mantener toda la lógica de negocio del lado de Supabase y las rutas de servidor, no enterrada en componentes de UI.
