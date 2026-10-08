# Etapa 4: Retiro del panel PHP

Objetivo: que el portal sea el único lugar, y Hostinger quede solo con el sitio público y el flujo de pagos.

## Condiciones para empezar

- Las etapas 1 a 3 están en producción y en uso hace al menos un mes.
- Ningún usuario entra ya al panel PHP. Revisar los accesos en los logs de Hostinger antes de decidir.

## Pasos (en `resurgencia-web`, rama revisada)

1. `pago/panel/index.html` se reemplaza por una página que dice que el panel se movió, con el link a `portal.resurgencia.com`.
2. `pago/panel/api.php` deja de aceptar inicios de sesión. Las claves compartidas de admin, discipulados y Planeación quedan sin efecto.
3. **Se mantienen:**
   - `webhook-wompi.php` y su envío a Supabase.
   - `panel-lib.php`, que es lo que usa el webhook para guardar.
   - El archivo `donaciones.jsonl`, que sigue siendo un respaldo independiente.
   - `exportar.php`, que la tarea diaria sigue usando para respaldar.
4. La sincronización con Asana de Hostinger se desactiva. Supabase ya la hace.

## Opcional, solo si Gian lo decide

Mover el webhook de Wompi a una ruta del portal. Wompi reintenta los eventos que fallan, así que el cambio no pierde pagos, pero requiere guardar en Vercel la llave de eventos de Wompi. Mientras el webhook en PHP funcione bien, no hay necesidad.

## Terminado cuando

- [ ] El panel PHP muestra el aviso de traslado y nadie puede iniciar sesión.
- [ ] Las donaciones siguen llegando al portal y al respaldo.
- [ ] El respaldo diario sigue funcionando.
