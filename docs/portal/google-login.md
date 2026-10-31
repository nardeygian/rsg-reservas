# Entrar con Google: configuración

Lo hace Gian en los paneles de Google Cloud y de Supabase. Ninguna clave va en el código ni en el chat.

El portal ya trae el botón "Continuar con Google". Aparece solo cuando el proveedor está activo en Supabase: la app lo consulta en `/auth/v1/settings`.

## 0. Revisar si ya existe

Producción ya tiene un trigger que copia la foto de Google (`sync_profile_from_oauth`). Eso indica que **Google probablemente ya está activo** en el proyecto `yuhfntejqkgajmacqmix`.

Para confirmarlo: Supabase → **Authentication → Sign In / Providers → Google**.
- **Si está activo:** salta al paso 2 y solo revisa las URL.
- **Si no lo está:** sigue desde el paso 1.

## 1. Google Cloud (cliente OAuth)

En console.cloud.google.com, con la cuenta de la iglesia:

1. **Pantalla de consentimiento** (Google Auth Platform → Branding y Audience):
   - Tipo: *Externo*.
   - Nombre "Portal RSG", correo de soporte y logo.
   - Dominio autorizado: `resurgencia.com`.
   - Permisos: solo `openid`, `email` y `profile`. Al no ser sensibles, Google no pide revisión.
   - Estado: **En producción**. En modo *Prueba* solo entran los correos agregados a mano.
2. **Clients → Crear cliente → Aplicación web**:
   - Orígenes de JavaScript autorizados:
     - `https://rsg-reservas.vercel.app`
     - el dominio definitivo del portal (p. ej. `https://panel.resurgencia.com`)
     - `http://localhost:3000`
   - URI de redirección autorizados:
     - `https://yuhfntejqkgajmacqmix.supabase.co/auth/v1/callback`
     - `http://127.0.0.1:54321/auth/v1/callback` (Supabase local)
3. Copia el **Client ID** y el **Client secret**.

## 2. Supabase (proyecto de producción)

1. **Authentication → Sign In / Providers → Google**: actívalo y pega el Client ID y el secret.
2. **Authentication → URL Configuration**:
   - *Site URL*: el dominio del portal.
   - *Redirect URLs*: agrega
     - `https://rsg-reservas.vercel.app/auth/callback**`
     - el mismo patrón con el dominio definitivo
     - el de los previews de Vercel, si se prueba allí.
3. **Authentication → Settings → Allow manual linking**: actívalo. Sirve para "Vincular Google" en *Tú → Cuenta*.

## 3. Local (para probar con Supabase local)

En `.env` (no se sube al repo):

```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```

En `supabase/config.toml`, `[auth.external.google]` → `enabled = true`. Después, `npm run supabase:stop` y `npm run supabase:start`.

## Ojo al pasar a producción

La migración `20261028170000_c_cuentas_servidor.sql` hace que **toda cuenta nueva creada con Google quede como `servidor`**, no como `leader` (decisión de Gian del 28 oct).

Si hoy hay líderes que se registran con Google, por ejemplo desde el panel PHP que usa el mismo Supabase, desde ese día:
- entrarán como servidor;
- no podrán reservar hasta que un super admin les dé el rol.

Las cuentas que ya existen no cambian.

## Prueba

1. En el login, "Continuar con Google" lleva a Google y vuelve al portal con sesión.
2. Una cuenta nueva sin invitación queda como `servidor` y el Inicio le muestra "Únete a un departamento".
3. Con una invitación de un líder, la cuenta queda unida a su persona.
4. En *Tú → Cuenta*, una cuenta de correo puede vincular Google, y quitarlo si le queda otra forma de entrar.
