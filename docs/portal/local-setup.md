# Cómo levantar el entorno local del Portal RSG

Todo el desarrollo del portal se hace en la rama `portal` contra Supabase local.
La app de reservas en producción (rsg-reservas.vercel.app) no se toca mientras se construye.

## Requisitos

- Node.js 20+
- Docker Desktop corriendo
- `npm install` ya corrido en el repo

## Primera vez

### 1. Verificar rama

```bash
git checkout portal
```

### 2. Levantar Supabase local

```bash
npm run supabase:start
```

Tarda ~1 min. Al terminar muestra las URLs y claves locales.
Para ver los valores en cualquier momento:

```bash
node_modules/.bin/supabase status
```

### 3. Configurar .env.local

Copia `.env.local` a `.env.local.production` (para conservar las claves de producción).
Luego actualiza `.env.local` con los valores locales:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
SLACK_BOT_TOKEN=desactivado
SLACK_RESERVAS_CHANNEL_ID=desactivado
```

> Las claves `ANON_KEY` y `SERVICE_ROLE_KEY` de arriba son los valores por defecto
> de Supabase local — no son secretos, están en la documentación pública.
> `SLACK_BOT_TOKEN=desactivado` hace que `lib/slack.ts` retorne sin enviar nada.

### 4. Recrear la base desde cero

```bash
npm run supabase:reset
```

Aplica las 28 migraciones en orden + seed.sql. Úsalo cuando quieras volver
a un estado limpio.

### 5. Arrancar la app

```bash
npm run dev
```

La app queda en http://localhost:3000. Para registrarte, usa cualquier correo
(el servidor de correo local captura todos los emails en http://127.0.0.1:54324).

## Uso cotidiano

| Tarea | Comando |
|---|---|
| Levantar Supabase | `npm run supabase:start` |
| Apagar Supabase | `npm run supabase:stop` |
| Recrear base desde cero | `npm run supabase:reset` |
| Regenerar tipos TypeScript | `npm run supabase:gen-types` |
| Importar datos de Hostinger | `npx tsx scripts/importar-hostinger.ts` |

## Después de una migración nueva

```bash
npm run supabase:reset
npm run supabase:gen-types
```

## Volver a producción (para comparar)

Copia `.env.local.production` a `.env.local` y reinicia `npm run dev`.
**Nunca hagas cambios ni corras migraciones con `.env.local` apuntando a producción**
a menos que Gian lo autorice explícitamente.

## Studio local (Supabase UI)

http://127.0.0.1:54323 — no requiere login. Sirve para revisar tablas y correr SQL.

## Correo local (Inbucket)

http://127.0.0.1:54324 — captura todos los correos enviados por la app en local.
