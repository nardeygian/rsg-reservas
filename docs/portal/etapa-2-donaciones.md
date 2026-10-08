# Etapa 2: Donaciones

Objetivo: que administración y mentores vean las donaciones en el portal, con los mismos números exactos del panel PHP. Es la etapa más delicada: se trata de dinero y de datos personales.

Lee antes la sección **Donaciones** y la de **Privacidad y permisos** de `01-reglas-que-no-se-rompen.md`.

## 2.1 Datos

```
donaciones      id text pk, fecha timestamptz, monto int, estado, tipo, nombre, email, doc,
                metodo, ref, link, fuente ('webhook' | 'importado' | 'efectivo'), recibido_en
formularios     id, nombre, link, prefijo, categoria
asignaciones    llave text pk (ej. 'c:123', 'e:x@y.com', 'n:nombre'), discipulo_id text null,
                ninguno bool, asignado_por, asignado_en
segmentos       id ('pastores-lideres'), nombre
segmento_miembros  segmento_id, id, nombre
```

- **El cálculo de origen, concepto, donante y discípulo** se hace en el servidor, en una función o vista que replica exactamente `panel_origen`, la agrupación por donante y `panel_cruce_nombre`. Puede ser SQL o TypeScript en el servidor, pero en un solo lugar.
- **RLS, por permisos** (`has_permission`):
  - `donaciones.ver`: todas las donaciones por la vista `donaciones_general`, **sin** `email`, `doc`, `ref` ni `link`.
  - `donaciones.datos_personales`: además, la tabla con esas columnas.
  - `donaciones.discipulado` (alcance): solo por la vista `donaciones_discipulado`, que filtra Módulo Dar y ese discipulado, sin columnas personales.
  - `donaciones.configurar`: escribe formularios, asignaciones y grupos especiales.
  - Sin ninguno de esos permisos: nada, ni la estructura.
- **El efectivo se reemplaza completo** en cada envío de la hoja, igual que hoy: se borran las filas `fuente = efectivo` y se insertan las nuevas, en una transacción.

## 2.2 Prueba de exactitud (antes de cualquier pantalla)

Script `scripts/comparar-donaciones.ts`:

1. Trae `vista_admin` de `exportar.php`, que es lo que calcula PHP.
2. Calcula lo mismo en el portal.
3. Compara **donación por donación**: origen, concepto, llave de donante, discípulo y discipulado.
4. Compara totales por mes, por concepto, por discipulado, discípulos contra el resto, y Pastores & Líderes.

Debe dar **cero diferencias** sobre todo el histórico antes de construir la interfaz. Este script también corre en la tarea diaria durante el periodo en paralelo y avisa si algo no cuadra.

## 2.3 Interfaz

Reconstruir las vistas del panel PHP con el sistema visual:

- **super_admin:**
  - Total del periodo con comparación y gráfico.
  - Por concepto, de dónde viene, en línea y efectivo.
  - Discípulos y resto.
  - Ranking por monto y por frecuencia.
  - Discipulados (se tocan para ver el detalle).
  - Pastores & Líderes.
  - Registro completo con filtros.
  - Configuración: discipulados y discípulos, asignación manual de donantes, formularios, grupos especiales.
- **Mentor:** total de su discipulado, por concepto, sus discípulos. Solo Módulo Dar.
- **Casi en vivo:** cuando llega una donación, aparece sola, con el aviso flotante. Supabase Realtime sobre `donaciones` para super_admin. Para mentores basta con refrescar al volver a la pestaña.

## 2.4 Donaciones nuevas en tiempo real (solo al pasar a producción)

En `resurgencia-web`, rama revisada, en `webhook-wompi.php` después de `panel_registrar`:

```php
try { require_once __DIR__ . '/panel-portal.php'; portal_enviar_donacion($registro); } catch (\Throwable $t) { /* registrar en log, nunca romper */ }
```

- `portal_enviar_donacion` hace un `POST` HTTPS a la API REST de Supabase (`/rest/v1/donaciones`, upsert por `id`) con la clave `service_role`.
  - La clave va en `pago/panel-portal-config.php`, fuera de git.
  - Timeout corto (5 s).
- **Si falla, el webhook sigue igual.** El pago ya quedó guardado en el archivo de siempre, y la importación diaria lo recupera.
- **La hoja de efectivo** se cambia para que además envíe a una ruta del portal (`/api/efectivo`, con la misma llave compartida). O el efectivo se toma de `exportar.php` cada vez que corre la importación. Elige la más simple y propónla.
- **Nada de esto cambia** `crear-pago.php`, el cobro, la firma de integridad ni la escritura en el Google Sheet.

## 2.5 Paso a producción

1. Migraciones a producción, con permiso y con el respaldo del día. Importación completa desde Hostinger.
2. **Periodo en paralelo de 2 a 4 semanas:** el portal en Preview conectado a producción, solo para super_admin, con importación y comparación diarias. Cero diferencias todos los días.
3. Activar el envío desde el webhook (2.4) y verificar con la siguiente donación real que llega a los dos lados.
4. Merge a `main`. Administración empieza a usar el portal y los mentores reciben acceso por su rol.
5. El panel PHP sigue funcionando como respaldo hasta la etapa 4.

## Terminado cuando

- [ ] La comparación da cero diferencias sobre todo el histórico y durante todo el periodo en paralelo.
- [ ] Un Líder de Discipulado, consultando la base directamente con su usuario, no puede obtener correos, cédulas ni donaciones de otros grupos.
- [ ] Un usuario de Servidor Planeación no puede leer ninguna fila de donaciones.
- [ ] Dar y quitar permisos de donaciones desde `/admin/personas` cambia el acceso al instante y queda en el registro.
- [ ] Una donación real por Wompi aparece en el portal en segundos, y en el panel PHP también.
- [ ] Si Supabase no responde, el webhook igual guarda la donación (probado simulando la caída).
