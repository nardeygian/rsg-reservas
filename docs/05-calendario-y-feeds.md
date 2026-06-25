# 05 - Calendario y feeds

Tres formas de llevar las reservas a un calendario, cada una con su mecanismo.

## 1. Agregar a calendario personal (.ics de un evento)

Cuando un líder reserva, puede bajar su reserva como un archivo `.ics` o tocar un botón de "agregar a mi calendario". Esto genera un único evento (VEVENT) que su app de calendario importa.

Ruta sugerida: `GET /api/bookings/[id]/ics`

- Devuelve un VCALENDAR con un solo VEVENT.
- Requiere sesión: solo el creador o el staff con permiso pueden descargarlo.
- Es una foto puntual: si la reserva cambia después, el evento en su calendario no se actualiza solo. Para eso está el feed de suscripción.

Ejemplo de contenido:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//RSG Reservas//ES
BEGIN:VEVENT
UID:booking-<id>@rsg
DTSTART:20260624T180000Z
DTEND:20260624T200000Z
SUMMARY:Discipulado - Salón 38
LOCATION:Salón 38
END:VEVENT
END:VCALENDAR
```

## 2. Feed de suscripción (calendario que se actualiza solo)

Este es el feed que pediste para pastores y admin: un calendario al que se suscriben una vez y que se mantiene al día.

Ruta sugerida: `GET /api/feed/[token].ics`

### Por qué token y no login

Las apps de calendario (Apple, Google, Outlook) no saben hacer login ni mandar headers de autenticación cuando consultan un feed. Por eso el feed no puede ir detrás de usuario y contraseña. La forma correcta y segura es protegerlo con un token secreto e imposible de adivinar, propio de cada usuario y revocable.

- El token vive en `profiles.calendar_feed_token`.
- La URL se entrega como `webcal://` para que el sistema operativo ofrezca suscribirse con un toque.
- Si un token se filtra, se regenera y el viejo deja de funcionar al instante. Esto se ofrece como botón de "revocar y regenerar mi enlace" en el perfil.
- Nunca se ponen datos personales en la URL, solo el token opaco.

### Qué incluye el feed según el rol

El feed lee el rol del dueño del token y arma los eventos en consecuencia:

- **Feed de pastor o admin**: incluye detalle en la descripción del evento (requerimientos, estado de pago, notas, banderas de montaje).
- **Feed de líder o general**: incluye solo lo acotado (ministerio o tipo de uso, franja). Las reservas de negocio del Estudio aparecen como "Reserva Studio Prado".

La lógica de qué se revela es exactamente la misma de `03-roles-y-visibilidad.md`. El feed reutiliza la vista `bookings_calendar` para el caso acotado y la tabla completa para el caso de staff.

## 3. Calendario general dentro de la app

La vista que todos ven al entrar. Es interactiva y se actualiza en vivo con Supabase Realtime cuando alguien crea o cambia una reserva.

- Filtro por espacio.
- Vista por día, semana y mes.
- Código de color por espacio o por estado.
- Para líderes, cada evento muestra la info acotada; al tocar, abre el formulario para reservar en una franja libre.

## Seguridad de los endpoints

- Las rutas bajo sesión (crear, editar, descargar `.ics` puntual) validan la sesión de Supabase del lado del servidor.
- La ruta del feed valida el token contra `profiles` y responde 404 si no existe, sin revelar si el token es inválido o simplemente no tiene eventos.
- Ninguna ruta confía en parámetros del cliente para decidir visibilidad. La fuente de verdad es siempre el rol en la base.
