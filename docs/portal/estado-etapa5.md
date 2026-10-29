# Estado de la Etapa 5: Servir

Corte: 29 de octubre de 2026. Rama de trabajo: `claude/dazzling-cannon-ngvafl`, que sale de `etapa5/fundacion`. **No hay nada aplicado en el Supabase de producción.**

Plan completo: `etapa-5-servir.md`. Fuente de verdad del esquema: `supabase/migrations/20261028*` y `lib/servir/contratos.ts`.

## Resumen

| Fase | Frente | Estado | Dónde |
|---|---|---|---|
| A | Fundación: esquema, RLS, migración de `servicio_data`, tipos de reunión, `service_units`, contratos | Lista | commit `efe8ba9` |
| B | B1 Planeación | Lista | nardeygian/rsg-reservas#5 |
| B | B2 Canciones | Lista | nardeygian/rsg-reservas#7 |
| B | B3 Equipos y asignaciones | Lista | nardeygian/rsg-reservas#6 |
| B | B4 Notificaciones y recordatorios | Lista (falta el correo de respaldo) | nardeygian/rsg-reservas#4, nardeygian/rsg-reservas#9 |
| B | B5 Cuentas | Lista (Google y Apple sin configurar) | nardeygian/rsg-reservas#8 |
| C | Decisiones de cuentas de Gian (28 oct) | **Lista** | `20261028170000_c_cuentas_servidor.sql` |
| C | C1 En vivo y asistencia | **Lista, sin probar en el navegador** | `20261028180000_c1_vivo.sql`, `app/servir/[id]/vivo` |
| C | C3 Estadísticas | **Lista, sin probar en el navegador** | `20261028190000_c3_estadisticas.sql`, `app/servir/estadisticas` |
| C | C2 Integración | **Lista, menos Comunidad** (ver abajo) | navegación, Inicio, Calendario, Tú, admin |
| C | Espacios de la reunión con montaje y desmonte (29 oct) | **Lista, sin probar en el navegador** | `20261029100000_espacios_reunion.sql` |
| QA | Recorrido completo en el navegador | Pendiente | |
| E | Apps en tiendas | Por empezar | |
| D | Paso a producción y piloto | Por empezar | |

Pruebas de base: **210/210**, aplicando las 45 migraciones desde cero. `npm run typecheck` y `next build` en verde.

## Decisiones de Gian (28 oct) y cómo quedaron

1. **Quien entra con Google o Apple sin invitación es `servidor`**, no `leader`. Lo mismo para quien se registra con una invitación. El registro por correo de hoy (líderes que piden un rol) no cambia. Un `servidor` no puede reservar espacios: la base no lo deja y Reservas no le aparece.
   - El servidor escoge su departamento en `/servir/unirme`. Al líder del departamento le llega un aviso. Él, un pastor de sede o un super admin aprueba en *Mi equipo → Solicitudes*. Al aprobar, la cuenta queda unida a una persona y entra al equipo.
2. **Eliminar mi cuenta borra también sus reservas**, después de preguntar. La pregunta dice cuántas reservas son y cuántas son próximas. El historial de reservas de otros queda, sin su nombre. Si lideraba un ministerio, el ministerio queda sin líder.
3. **Los líderes de departamento también confirman la asistencia** de su gente mientras la asistencia esté abierta. Solo Planeación la cierra.
4. **Umbrales de salud:** "3 es mucho, 1 es poco". Se interpretó así: en los últimos 30 días, 3 servicios o más es *sobrecargado* y 1 o menos es *alejándose* (también se marca *alejándose* quien rechaza la mitad o más de lo que responde). *Inactivo* sigue en 6 semanas sin servir. Gian lo confirmó (29 oct). Los valores viven en la tabla `servir_ajustes`, no en el código: Planeación los cambia en *Estadísticas → Salud del equipo → Ajustar umbrales*.
5. **Fundadores:** hay dos (confirmado el 29 oct). Se asignan en `/admin → Usuarios → Rol primario → Fundador` cuando esto pase a producción.
6. **Servir es un destino nuevo de la navegación.** Con más de 5 destinos (sin contar Tú), Reservas pasa a ser la vista *Espacios* dentro de Calendario.

## Espacios de la reunión (pedido y decisiones de Gian, 29 oct)

Al crear una reunión se pregunta qué espacios de la sede se usan (los mismos de Reservas) y cuánto montaje y desmonte lleva. Por defecto son 2 horas antes y 1 después; se ajustan por reunión y quedan en los tipos de reunión y en las plantillas.

- **Bloquea solo al publicar.** En borrador los espacios quedan escogidos, sin reservar.
- **Aprobación:** una reunión de ministerio queda aprobada directo. Servolución y los eventos siguen la política del espacio: el Auditorio pide aprobación y los espacios libres quedan aprobados. Los pastores de sede reciben un aviso de cada reserva.
- **Choques:** un espacio ocupado en la franja (con montaje y desmonte) no se puede escoger. La regla de la base que impide dobles reservas lo garantiza: si alguien reservó mientras tanto, publicar falla y dice qué espacio choca y en qué horario.
- **Sincronización:**
  - Reprogramar la reunión mueve sus reservas.
  - Cambiar el montaje las ajusta.
  - Quitar un espacio lo libera.
  - Cancelar o borrar la reunión libera todo.
  - Volver a publicarla reserva otra vez.
  - Una reserva que un pastor rechazó no se vuelve a pedir sola.
- **Quién cambia espacios, montaje y desmonte:** Planeación, pastor de sede y super admin (y el fundador, que tiene los mismos permisos que un pastor de sede). Un pastor de ministerio edita sus plantillas, pero no estos datos.
- **Reservas** muestra la franja de montaje y desmonte rayada alrededor del bloque, y el detalle dice desde cuándo y hasta cuándo está ocupado.
- **Para Reservas no cambia nada más:** las columnas nuevas de `bookings` aceptan nulos y, vacías, se usan los minutos del espacio como hoy.

## Qué se construyó en la Fase C

- **Cuentas:** rol `servidor`, `team_join_requests` con `solicitar_unirse`, `responder_solicitud` y `cancelar_solicitud`, y eliminar la cuenta junto con sus reservas (`cuenta_resumen_eliminacion`).
- **C1 En vivo:**
  - Base: `iniciar_reunion`, `avanzar_item`, `terminar_reunion`, `asistencia_sugerida`, `confirmar_asistencia` y Realtime en reuniones, orden, asignaciones, checklist y asistencia.
  - Pantalla `/servir/[id]/vivo`: punto actual con temporizador, orden con tiempo real frente al planeado, checklist del servidor (en verde al completarlo), avance del equipo y asistencia prellenada.
- **C3 Estadísticas:**
  - Base: `servir_ajustes`, la vista materializada `salud_servidor_mensual` (pg_cron a la 1:20 a. m. de Bogotá), `salud_servidores`, `estadisticas_reuniones` y `ficha_servidor`. Todo filtrado por el alcance de quien consulta.
  - Pantallas: tablero de reuniones, salud del equipo con semáforo y ficha del servidor.
- **C2 Integración:**
  - Destino Servir con menú propio (Mis servicios, Mi equipo, Reuniones, Canciones, Plantillas, Estadísticas).
  - Inicio: próximo servicio, reuniones de hoy para abrir en vivo y pendientes del equipo.
  - Calendario: el evento muestra su reunión, el orden y el equipo.
  - Tú: enlaces a Avisos y a Cuenta.
  - Mi equipo: botón Invitar para quien no tiene cuenta.
  - `/admin`: roles `servidor`, `fundador`, líder de área y Planeación (Servir).
- **Tipos:** `types/supabase.ts` se generó con todo el esquema y se quitaron los parches de los frentes. `lib/database.types.ts` ahora solo lo reexporta.
- **Arreglo de seguridad:** en Supabase las tablas nuevas reciben por defecto todos los permisos para `authenticated`, así que los `grant update (read_at)` de la Fase A no restringían nada. Un usuario podía editar el texto de sus avisos. Ahora `notifications` y `checklist_items` solo permiten lo que se pensó.

## Pendientes

| Pendiente | Por qué | Quién |
|---|---|---|
| Recorrido completo en el navegador (crear → asignar → aceptar → en vivo → cerrar → estadísticas) en celular y escritorio | En esta sesión no se pudo levantar Supabase local: Docker no bajó las imágenes por límite del registro y no se permitió correr Auth y PostgREST descargados. Lo probado: SQL con pgTAP, typecheck y build | QA, en una máquina con Docker |
| Comunidad (`/servicio`, `/discipulos`) leyendo de las tablas nuevas | Hoy leen el JSON `servicio_data` de producción. Cambiarlas antes de migrar ese JSON a tablas en producción dejaría las pantallas vacías. Va con el paso a producción (Fase D, paso 1) | Fase D |
| Correo de respaldo del `notificador` | Falta escoger el proveedor y su llave | Gian + B4 |
| Push en un navegador real y FCM | Necesita un celular | QA |
| Google y Apple de punta a punta | Gian configura los proveedores (lista en el PR #8) | Gian, luego QA |
| GRANT por defecto que faltaban en la base local de los frentes | En producción Supabase ya los da | Verificar en la Fase D |

## Nota sobre "fundadores" (resuelta)

El plan de la etapa (`etapa-5-servir.md`, sección 2) incluye un rol `fundador` con la misma visibilidad que un pastor de sede. La pregunta era a quién se le da. Si en RSG no hay un grupo así (por ejemplo, porque los pastores principales ya son pastores de sede), el rol simplemente no se usa. Si lo hay, se asigna en `/admin → Usuarios → Rol primario → Fundador`.
