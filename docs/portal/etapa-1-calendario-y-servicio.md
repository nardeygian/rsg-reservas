# Etapa 1: Calendario RSG y Servicio

Objetivo: que Planeación trabaje desde el portal y que todos tengan un calendario de la iglesia. Va antes que donaciones porque no toca dinero y se usa cada semana.

Lee antes la sección **Servicio** de `01-reglas-que-no-se-rompen.md`.

## 1.1 Datos

```
reuniones        id text (gid de Asana, o 'm' + aleatorio si es manual), nombre, fecha date,
                 hora time null, seccion, origen ('asana' | 'manual'), fuera_de_asana bool,
                 actualizado_en
registros        reunion_id (pk), cargado_en, cargado_por (user_id), nota text
registro_filas   reunion_id, servidor_id, roles text[], ausente bool, nota text
asana_sync       una fila: ultimo_sync, ultimo_error
```

- **Vistas SQL de conteo** que implementan las reglas: unidad (Reunión Central del mismo día = una), tipo (`min` o `serv`), y ausentes que no cuentan. El portal no recalcula esto en el cliente.
- **RLS, por permisos** (`has_permission`):
  - `servicio.editar`: lee y escribe todo.
  - `servicio.ver`: lee todo, incluidas notas.
  - `servicio.discipulado` (alcance): lee solo las filas de servidores enlazados a discípulos de ese discipulado, sin notas.
  - `calendario.ver`: lee `reuniones`. `calendario.servidores`: además, los equipos.

## 1.2 Sincronización con Asana

- Una **Edge Function** de Supabase `asana-sync` replica `sv_sincronizar_asana()` del PHP: paginación, sección, `due_on` o `due_at` en hora de Bogotá, y la regla de `fuera_de_asana`. Si la tarea trae hora (`due_at`), se guarda en `hora`.
- El token de Asana va como **secret de Supabase**. Es el mismo que usa Hostinger, o uno nuevo de la misma cuenta.
- **Frecuencia:** `pg_cron` llama la función cada 15 minutos, y hay un botón "Actualizar calendario" para super_admin y Planeación. En Vercel Hobby las tareas programadas solo corren una vez al día, por eso esto vive en Supabase.
- Durante la construcción, Hostinger sigue con su propia sincronización. Las dos solo leen de Asana, así que no se estorban.

## 1.3 Importación de lo histórico

Se extiende `scripts/importar-hostinger.ts` con `servicio`: reuniones, servidores y registros, conservando ids. Se puede correr las veces que sea.

## 1.4 Calendario RSG

- **Vistas:** mes, semana y lista ("agenda"). En el celular, la lista es la principal.
- **Fuentes, en una sola vista:**
  - Reuniones de Asana, con color por sección.
  - Reservas de espacios de Supabase, según los permisos de reservas.
- **Al tocar un evento:** nombre, fecha, sección, espacio reservado si lo hay, y, para super_admin y Planeación, el equipo de servidores con su estado.
- **Filtros:** por sección, solo mis reservas, Servolución aparte.
- Reservar un espacio para una reunión desde el evento queda para después, como mejora.

## 1.5 Módulo de Servicio

Reconstruir lo que hoy hace el panel PHP, con el sistema visual de la etapa 0. Para super_admin y Planeación:

1. **Hoy:** reglas en `01-reglas-que-no-se-rompen.md`.
2. **Resumen del periodo:** servicios de ministerio, servicios de Servolución, personas que sirvieron, ausencias. Ministerio y Servolución siempre por separado.
3. **Reuniones y actividades:**
   - Filtro Todas, Ministerio o Servolución.
   - Botón "Subir listado (PDF)" en cada fila.
   - Agregar una reunión a mano.
4. **Editor de listado:**
   - PDF (con el lector portado), pegar lista o agregar persona.
   - Filas como tarjetas, con Asistió o Ausente.
   - Nota por persona y nota de la reunión.
   - Sugerencia de nombres parecidos.
   - Botón Guardar fijo abajo en el celular.
5. **Servicio por discipulado:** se toca un discipulado y se ven sus discípulos. Al tocar un discípulo se despliega el detalle de sus reuniones.
6. **Servidores:** búsqueda y edición de nombre. Además: unir dos servidores que son la misma persona, quitar un servidor, y corregir a mano a qué discípulo corresponde.

Para el mentor: "Servicio de mis discípulos", con la misma lista desplegable, solo lectura y sin notas.

## 1.6 Paso a producción

1. Script de vuelta atrás listo: exportar del portal al formato de `servicio.json`.
2. Migraciones a producción, con permiso y con el respaldo del día. Importación desde Hostinger.
3. **Ensayo de un domingo:** Planeación carga el listado en el panel PHP como siempre, y además en el portal de Preview conectado a producción. Los conteos por persona, por discipulado y del periodo deben coincidir.
4. Importación final y merge a `main`.
5. **En `resurgencia-web`** (rama revisada): bandera `servicio_solo_lectura` en la config del panel PHP. Con ella, las acciones `sv_*` de escritura responden "El servicio ahora se maneja en el portal" con el link. La lectura sigue funcionando.
6. Avisar a Planeación y a los mentores.

## Terminado cuando

- [ ] La sincronización de Asana corre sola cada 15 minutos y con el botón.
- [ ] El calendario muestra reuniones y reservas, y funciona bien en el celular.
- [ ] Planeación puede hacer en el portal todo lo que hace hoy en el panel PHP.
- [ ] Los conteos del ensayo coinciden exactamente con el panel PHP.
- [ ] Cada permiso hace exactamente lo que dice, probado con consultas directas a la base con usuarios de prueba de cada rol.
- [ ] Un Líder de Discipulado solo ve a sus discípulos, y si el super admin le da `servicio.ver`, ve todo (y al quitárselo, deja de ver).
- [ ] Hay script de vuelta atrás probado.
