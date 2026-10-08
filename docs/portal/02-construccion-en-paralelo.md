# Construcción en paralelo

La regla: **nada de lo que funciona hoy cambia mientras se construye.** Las reservas en producción y el panel PHP siguen igual hasta que cada módulo nuevo esté listo y probado.

## Dos mundos durante la construcción

| | Producción (no se toca) | Construcción |
|---|---|---|
| Rama | `main` | `portal` |
| URL | rsg-reservas.vercel.app | URL de Preview que Vercel crea para la rama `portal` |
| Supabase | Proyecto actual (ref `yuhfntejqkgajmacqmix`) | Proyecto de desarrollo `rsg-portal-dev`, si hay cupo (ver abajo) |
| Panel PHP | Funciona igual | Solo se lee, por exportación |

### Supabase de desarrollo

- **Si hay cupo** en el plan gratis (2 proyectos por organización): se crea `rsg-portal-dev`. Las variables de entorno **Preview** de Vercel y el `.env.local` apuntan ahí. Las migraciones se prueban ahí primero.
- **Si no hay cupo** (por ejemplo, porque RSG Academy usa el otro): se trabaja sobre el proyecto de producción, pero **solo con migraciones aditivas** y siempre con permiso de Gian. Ninguna pantalla nueva se publica en `main` antes de tiempo.
- **Google en la URL de Preview:** agrega en Supabase (Authentication → URL Configuration) la URL de Preview a las URLs de retorno permitidas.

## Los datos de Hostinger durante la construcción

**Solo se leen.** El panel PHP sigue siendo el que manda hasta el paso a producción de cada módulo.

En `resurgencia-web` se agrega un endpoint **de solo lectura**, `pago/portal/exportar.php`:

- `GET` con firma HMAC-SHA256 en encabezados:
  - `X-Portal-Ts`: segundos unix. Se rechaza si difiere más de 60 s.
  - `X-Portal-Firma`: `hex(HMAC(secreto, ts + "\n" + recurso))`.
- **El secreto** vive en `pago/panel-portal-config.php`. Ese archivo debe agregarse al `.gitignore` y a la lista `exclude` de `.github/workflows/deploy.yml`, y al paso "Revisar que no vayan claves". Si el secreto está vacío, todo se rechaza.
- **Recursos:**
  - `donaciones`: el registro en línea ya fusionado, solo aprobadas.
  - `efectivo`
  - `ajustes`
  - `servicio`
  - `vista_admin`: la salida de la acción `datos` como admin. Sirve para comparar donación por donación lo que calcula PHP contra lo que calcula el portal.
- **No escribe nada** y no toca el webhook, `crear-pago.php` ni el panel.

El importador del portal (script en `scripts/`, corrido por la tarea diaria de GitHub Actions y a mano cuando haga falta) trae esos recursos y hace *upsert* en Supabase por `id`. Se puede correr las veces que sea sin duplicar nada.

## Paso a producción de un módulo

Cada módulo pasa solo cuando cumple su criterio de "terminado" (en el documento de su etapa). Pasos:

1. **Ensayo:** correr en paralelo al menos un ciclo real (un domingo para servicio, dos a cuatro semanas para donaciones), comparando resultados con el panel PHP.
2. **Migraciones a producción:** se aplican al Supabase de producción, con permiso.
3. **Importación final** desde Hostinger.
4. **Unir `portal` en `main`.**
5. **Cambiar quién manda:**
   - Servicio: el panel PHP deja de aceptar cambios de servicio (modo solo lectura, por una bandera en su config) y Planeación pasa al portal.
   - Donaciones: el webhook de Wompi empieza además a enviar cada donación a Supabase (ver etapa 2).
6. **Avisar a los usuarios** de ese módulo.

## Vuelta atrás

- **Servicio:** se reactiva la escritura en el panel PHP. Antes del paso a producción debe existir un script que devuelva a `servicio.json` lo que se haya cargado en el portal en el intermedio.
- **Donaciones:** el panel PHP nunca deja de recibir ni de guardar, así que basta con volver a usarlo.
- **Código:** revertir el merge en `main`.

## El puente de inicio de sesión al panel PHP

Ya existe un borrador (`login_token` en `api.php`, `/api/panel-token` en Next.js) que solo está en el computador de Gian, no en el repo. Con la construcción en paralelo **no hace falta**: mientras tanto el portal enlaza al panel PHP con sus claves actuales.

Si se decide activarlo, debe cumplir antes:

- El rol y el discipulado salen **del token firmado**, no de un `panel_url` guardado.
- Cada token sirve una sola vez.
- Se rechaza todo si el secreto está vacío.
- Llega a `resurgencia-web` en una rama revisada.
