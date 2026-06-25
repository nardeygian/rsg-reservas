# RSG Reservas

Plataforma de reservas de espacios para RSG. Permite que líderes, pastores y administradores vean el estado de los salones de la iglesia, hagan reservas y reciban esa información en su calendario personal o como feed de suscripción.

## Qué es

Una aplicación web instalable (PWA) con visibilidad por rol:

- **Líderes**: ven una vista de calendario general, reservan, y reciben info acotada de cada reserva (ministerio o departamento, tipo de uso, franja horaria).
- **Pastores de sede y administrador de casa**: ven todo el detalle (requerimientos de sillas, mesas, hidratación, estado de pago de terceros, notas internas) y reciben un feed de calendario con esa información.
- **Administrador del Estudio (tercero)**: sincroniza tanto las reservas de su negocio como las de RSG. Las de su negocio se muestran solo como "Reserva Studio Prado"; las de RSG muestran departamento o ministerio y banderas relevantes.

## Espacios

| Espacio    | Estado     | Notas |
|------------|------------|-------|
| Auditorio  | Activo     | El más disputado, requiere aprobación |
| Lobby      | Activo     | |
| Salón 38   | Activo     | |
| Salón 45   | Inhabilitado | Alquilado temporalmente a un tercero |
| Estudio    | Externo    | Administrado por un tercero, permite ocupación compartida con bandera de montaje |

## Stack

- **Frontend**: Next.js (App Router) + React + TypeScript + Tailwind, configurado como PWA.
- **Backend**: Supabase (Postgres, Auth, Row Level Security, Realtime, Storage).
- **Notificaciones**: Supabase Edge Functions hacia Mailgun (correo) y/o webhook de ManyChat (WhatsApp).
- **Despliegue**: Vercel para la app Next.js, Supabase en la nube para datos y auth.

## Por qué este stack (y la nota sobre Hostinger)

La meta es que nazca lista para volverse app. La PWA es el puente: hoy vive en la web y se instala desde el celular, mañana se puede envolver como app nativa sin reescribir la base. Por eso el backend vive en Supabase (no en Hostinger compartido, que es territorio PHP/MySQL y no corre Next.js limpio). Si en algún momento queremos una landing pública, esa sí puede vivir en Hostinger, pero la aplicación corre en Vercel + Supabase.

El control de acceso de tu requisito ("que nadie se salte la seguridad") se resuelve con Row Level Security en Postgres: la base decide qué filas ve cada usuario según su rol, así que aunque alguien llame un endpoint directo, no recibe datos que no le tocan.

## Estructura de la documentación

Lee los documentos en orden antes de construir:

1. `docs/01-arquitectura.md` — decisiones técnicas, PWA, despliegue, zona horaria.
2. `docs/02-modelo-de-datos.md` — tablas, relaciones, esquema SQL y prevención de choques.
3. `docs/03-roles-y-visibilidad.md` — matriz de roles, políticas RLS y visibilidad por columna.
4. `docs/04-funcionalidades.md` — ciclo de vida de la reserva, recurrencia, pagos, notificaciones.
5. `docs/05-calendario-y-feeds.md` — agregar a calendario personal y feeds de suscripción seguros.
6. `docs/06-roadmap.md` — fases de construcción, qué entra en el MVP y qué viene después.

`CLAUDE.md` contiene las instrucciones y reglas de oro para desarrollar el proyecto.

## Puesta en marcha

1. **Instalar dependencias.** El CLI de Supabase viene como devDependency:
   ```
   npm install
   ```
2. **Crear el proyecto en Supabase** desde [supabase.com/dashboard](https://supabase.com/dashboard) (nombre, región, contraseña de DB).
3. **Llenar credenciales.** Copia `.env.local.example` a `.env.local` y pega URL y llaves desde Settings → API.
4. **Enlazar el repo al proyecto remoto:**
   ```
   npx supabase link --project-ref <ref-del-proyecto>
   ```
   El `ref` está en la URL del panel: `https://supabase.com/dashboard/project/<ref>`.
5. **Aplicar la migración inicial:**
   ```
   npm run supabase:push
   ```
   Esto corre `supabase/migrations/*.sql` contra el proyecto enlazado.
6. **Cargar semillas.** Pegar el contenido de `supabase/seed.sql` en el SQL editor del panel y ejecutar. (Solo la primera vez. En local, `npm run supabase:reset` aplica el seed automáticamente.)
7. **Generar tipos de TypeScript:**
   ```
   npm run supabase:gen-types
   ```
   Salida en `types/supabase.ts`.

Detalle completo del entorno en `docs/01-arquitectura.md`. Fases del proyecto en `docs/06-roadmap.md`.
