# Estado de la Etapa 5: Servir

Corte: 28 de octubre de 2026. Rama de trabajo: `etapa5/fundacion`. **No hay nada aplicado en el Supabase de producción.**

Plan completo: `etapa-5-servir.md`. Fuente de verdad del esquema: `supabase/migrations/20261028*` y `lib/servir/contratos.ts`.

## Resumen

| Fase | Frente | Estado | PR |
|---|---|---|---|
| A | Fundación: esquema, RLS, migración de `servicio_data`, tipos de reunión, `service_units`, contratos | Lista | — (commit `efe8ba9`) |
| B | B1 Planeación | Lista, unida a `etapa5/fundacion` | nardeygian/rsg-reservas#5 |
| B | B2 Canciones | Lista, unida | nardeygian/rsg-reservas#7 |
| B | B3 Equipos y asignaciones | Lista, unida | nardeygian/rsg-reservas#6 |
| B | B4 Notificaciones | Lista, unida (falta correo de respaldo) | nardeygian/rsg-reservas#4 |
| B | B4 Recordatorios siguen a la reunión | Lista, unida | nardeygian/rsg-reservas#9 |
| B | B5 Cuentas | Lista, unida (Google y Apple sin configurar) | nardeygian/rsg-reservas#8 |
| C | C1 En vivo y asistencia | **Por empezar** — plan abajo | |
| C | C3 Estadísticas | **Por empezar** — plan abajo | |
| C | C2 Integración | **Por empezar** — plan abajo | |
| E | Apps en tiendas | Por empezar | |
| D | Paso a producción y piloto | Por empezar | |

Pruebas de base (`npx supabase test db`): 109/109 en local. `npm run typecheck` en verde.

## Lo que ya existe

- **Migraciones** (solo aditivas, aplicadas en local): permisos, personas y equipos, reuniones, asignaciones, RLS, tipos y conteos, notificaciones, último uso de canciones, cuentas, recordatorios que siguen a la reunión.
- **Pantallas:** `/servir/reuniones`, `/servir/reuniones/nueva`, `/servir/reuniones/[id]`, `/servir/plantillas`, `/servir/canciones`, `/servir/equipo`, `/servir/equipo/reunion/[id]`, `/servir/mis-servicios`, `/tu/notificaciones`, `/tu/notificaciones/enviar`, `/perfil/cuenta`, `/perfil/cuenta/invitar`, `/auth/invitacion/[token]`.
- **Edge Function `notificador`:** web push (VAPID) y FCM, disparada por `pg_cron` cada 5 min.
- **Sin enlaces en la navegación:** a Servir se entra por URL hasta que C2 lo agregue.

## Pendientes que dejó la Fase B

| Pendiente | Origen | Quién lo cierra |
|---|---|---|
| Enlaces a Servir, `/tu/notificaciones` y `/perfil/cuenta` en la navegación y en Tú | B1, B4, B5 | C2 |
| Unificar tipos: `types/supabase.ts` no trae las tablas de Servir; B1 y B3 usan un cast a `lib/database.types.ts` | B1 | C2 |
| Botón "Invitar" en la ficha de Mi equipo con `lib/cuentas/InvitarPersona.tsx` | B5 → B3 | C2 (toque menor en `app/servir/equipo`) |
| Correo de respaldo del `notificador` | B4 | Después de la Fase C (necesita proveedor y llave) |
| Push recibido en un navegador real; FCM sin probar | B4 | QA, con Gian en un celular |
| Recorrido de toques (hojas, botones) en celular y escritorio de Equipo y Mis servicios | B3 | QA |
| Google y Apple de punta a punta | B5 | Gian configura (lista en el PR #8), luego QA |
| En la base local faltaban GRANT por defecto (`current_role_is`, `profiles`, `ministries`, `user_roles`…). Se dieron solo en local; en producción Supabase ya los da | B2, B3 | Verificar en el paso a producción |

## Decisiones para Gian

1. **Rol por defecto** de quien entra con Google o Apple sin invitación: hoy queda como `leader` (igual que el registro por correo). ¿Debe ser otro rol, o ninguno hasta que alguien lo apruebe? *Recomendado: sin rol de líder hasta aprobación.*
2. **Eliminar cuenta con reservas:** hoy se bloquea si la persona tiene reservas, aparece en su historial o lidera un ministerio, y se le pide escribir a un administrador. ¿Está bien así?
3. **Asistencia (decisión 4 del plan):** ¿los líderes de departamento confirman la asistencia de su gente, o solo Planeación? *Recomendado: solo Planeación al principio.*
4. **Umbrales de salud (decisión 9):** ¿se arranca con más de 4 servicios al mes = sobrecargado, la mitad de su promedio de 3 meses = alejándose, 6 semanas sin servir = inactivo?
5. **Fundadores (decisión 5):** ¿quiénes reciben el rol `fundador`?
6. **Navegación (decisión 3):** ¿destino nuevo "Servir", con Reservas como vista dentro de Calendario para quien tiene todos los destinos?

## Propuesta: Fase C (espera aprobación)

Orden sugerido en una sola sesión: **C2a (tipos) → C1 → C3 → C2b (integración)**. C1 y C3 no comparten carpetas y pueden ir en paralelo si se abren dos sesiones.

### C2a · Unificar tipos (pequeño, primero)
- Regenerar `types/supabase.ts` desde la base local con todas las tablas de Servir y quitar los casts de `app/servir/reuniones/_lib/db.ts` y `app/servir/equipo/_lib/supabase.ts`.
- Sin cambios de esquema.

### C1 · En vivo y asistencia — `app/servir/[id]/vivo/**`
**Migración** `2026102817xxxx_c1_vivo.sql` (aditiva):
- Funciones `iniciar_reunion`, `avanzar_item`, `terminar_reunion` (requieren `servir.vivo`): pasan `meetings.status` a `en_vivo`/`cerrada`, marcan `started_at`/`ended_at` reales y `run_items` con inicio y fin reales, y mueven el ítem actual.
- Función `confirmar_asistencia` (requiere `servir.asistencia`): una fila por persona en `attendance`, prellenada con "asistió" para quien completó su checklist.
- Agregar `meetings`, `run_items`, `checklist_items` y `assignments` a la publicación `supabase_realtime`. RLS sigue decidiendo qué le llega a cada uno.
- Pruebas: que un servidor no pueda avanzar el orden ni ver checklists ajenos por Realtime, y que la asistencia confirmada cambie `service_units` con las reglas de conteo de hoy.

**Pantallas:**
- Vista del servidor: orden con el ítem actual y un temporizador, su checklist (antes, durante, después), y su servicio en verde al completarlo.
- Tablero de Planeación: avance de cada persona en tiempo real y botones para avanzar, terminar y cerrar.
- Cierre: lista de asistencia prellenada (asistió, tarde, ausente) y botón para confirmar y cerrar.

### C3 · Estadísticas — `app/servir/estadisticas/**`
**Migración** `2026102818xxxx_c3_estadisticas.sql` (aditiva):
- Vistas `security_invoker` sobre `meetings`, `meeting_changes`, `assignments`, `attendance` y `checklist_items`: reuniones realizadas, canceladas y reprogramadas; cobertura; tasa y tiempo de respuesta; asistencia; duración real frente a la planeada.
- Vista materializada `salud_servidor_mensual`, refrescada cada noche por `pg_cron`. Como una vista materializada no tiene RLS, se lee solo por una función `security definer` que filtra con `can_see_person_stats`. Se le revoca SELECT directo.
- Tabla `servir_ajustes` para los umbrales del semáforo, editable solo por Planeación.
- Pruebas: que cada rol vea solo su alcance (líder de área solo su área, líder de discipulado solo sus discípulos).

**Pantallas:** tablero de reuniones con filtros (periodo, tipo, ministerio, departamento), salud del equipo con semáforo y ficha del servidor.

### C2b · Integración — archivos compartidos
- Destino Servir en la navegación (`app/_components/portal/**`) según la decisión 6.
- Inicio: tarjetas "Tu próximo servicio", pendientes por responder, posiciones sin cubrir (líderes) y "Abrir en vivo" (Planeación).
- Calendario: el evento muestra su reunión, el orden y el equipo.
- Comunidad (`app/servicio/**`, `app/discipulos/**`) lee de las tablas nuevas, con los mismos números de hoy.
- Permisos de Servir en `/admin`.
- Enlaces a `/tu/notificaciones` y `/perfil/cuenta`, y botón Invitar en Mi equipo.

### Fuera de la Fase C
- Correo de respaldo (necesita elegir proveedor), Fase E (Capacitor y tiendas) y Fase D (producción y piloto con permiso de Gian).
