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
| C | Ajustes del 29 oct: Roles, botones, directorio, servidor sin Reservas, roles generales, ajustes en vivo y agenda sin Asana | **Listo en base y pantallas** (ver abajo) | `20261029120000`, `20261029130000`, `20261029140000` |
| QA | Recorrido completo en el navegador (29 oct) | **Hecho, con arreglos** (ver abajo). Falta push en un celular real y Google/Apple | esta sección |
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

## Ajustes pedidos por Gian después del QA (29 oct)

| Pedido | Cómo quedó |
|---|---|
| "Posiciones" pasa a "Roles" | Todo el texto visible. La tabla sigue siendo `positions` |
| Botones de crear o guardar a la izquierda | Encabezados de página (Nueva reunión, Nueva canción, Nuevo tipo), "+ Rol", "Agregar" del equipo, "+ Asignar" (debajo de cada rol) y "Agregar" en fechas bloqueadas |
| Directorio: solo nombre y departamento | `authenticated` ya no puede leer teléfono, correo ni notas de `people`. `directorio_personas()` da nombre y departamentos; `contacto_personas()` da el contacto solo a la propia persona, Planeación, pastor de sede (y fundador, super admin), el líder de su equipo y el de su discipulado |
| El servidor no ve Reservas | En la base: `spaces` y `bookings_calendar` no le devuelven nada (`es_solo_servidor()`). Ve la agenda de reuniones y el detalle solo donde está asignado |
| La agenda vive en la app, no en Asana | `agenda_reuniones()` alimenta el Calendario y el "Esta semana" del Inicio. Se quitó el enlace manual evento–reserva (los espacios se escogen en la reunión) y el Calendario ya no lee reservas con la llave de servicio. `lib/asana.ts` sigue solo para el módulo viejo `/servicio` (va con la Fase D) |
| Varias asignaciones y roles generales (VIO, Escenario) | Roles sin departamento (`positions.ministry_id` nulo). Los crea, les arma el checklist y los asigna Planeación (*Servir → Roles generales*, o *Mi equipo → Roles generales* si también lidera un equipo). Se le puede asignar a cualquier servidor de cualquier departamento, aunque ya tenga otro rol esa noche; la asistencia lo cuenta una vez |
| Ajustes en vivo | En *En vivo*: atraso con +5/+10/+15 o la cantidad que se quiera; en cada punto, −5/+5, cantidad libre o quitar (con Deshacer, sin "¿seguro?"). Las horas proyectadas de cada punto y el fin se recalculan. Cada cambio queda en "Cambios en vivo", que ven todos, y avisa a los asignados (si hay varios en un minuto, un solo aviso) |
| Quién ajusta | Planeación, pastor de sede, fundador y super admin (`servir.vivo`). Las canciones solo las quita la música: el líder del departamento de música (`servir_ajustes.ministerio_musica_id`, por defecto LMRSG) o quien esté asignado esa noche a un rol de ese departamento que empiece por "Director". El super admin también, como salida de emergencia |
| Reporte automático | Al terminar, `meetings.report` guarda planeado frente a real por punto, atraso al empezar y al terminar, y cada cambio con su hora y quién lo hizo. Se ve en el detalle de la reunión y en En vivo, y les llega un aviso a Planeación y a los pastores de sede |

Pruebas de base: **251/251** (41 nuevas en `supabase/tests/ajustes_servir.test.sql`).

Recorrido en el navegador (29 oct, build de producción): roles generales (crear VIO con checklist, asignarlo a quien ya tiene otro rol, el servidor lo acepta y recibe el checklist), atraso, ajustar, quitar y devolver puntos con las horas recalculadas, la música quita y devuelve canciones (Planeación no puede), el servidor ve la agenda sin espacios y solo el detalle de sus reuniones (las demás dan 404), el directorio con solo nombre y departamento, y el reporte. En celular y escritorio.

Arreglado en el recorrido: cerrar la reunión con "Confirmar y cerrar" la asistencia no generaba el reporte. Ahora lo arma un trigger con cualquier cierre (`20261029150000_servir_reporte_al_cerrar.sql`). Una reunión cerrada ya no muestra horas proyectadas.

Confirmado por Gian (29 oct): el atraso anunciado en vivo alarga el punto que está pasando (antes de empezar corre la hora de inicio), y varios cambios seguidos en menos de un minuto dan un solo aviso.

Más decisiones de Gian (29 oct):
- **Servidor y reuniones donde no sirve:** en el Calendario ve nombre, fecha y hora, sin "Ver detalle". Donde sirve aparece "Estás asignado" y "Ver detalle". Si abre por URL una reunión que no puede ver, lo lleva al Inicio.
- **Entrar con Apple** sale de la pantalla hasta configurarlo; queda solo Google. El código de Apple sigue (`lib/cuentas/apple.ts`): para activarlo basta con volver a agregarlo en `PROVEEDORES` (`lib/cuentas/proveedores.ts`).

## QA de la Fase C en el navegador (29 oct)

Supabase local (CLI 2.107) con `npm run supabase:reset`, 210/210 pruebas de base, app en `npm run dev`. Usuarios de prueba con `node --env-file=.env.local scripts/semilla-qa-etapa5.ts` (Planeación, pastor de sede, líder de LMRSG, líder del área Voces, líder de discipulado, servidor, y un líder y un servidor de Protocolo para ver el aislamiento). Recorrido en celular (375 px) y escritorio (1280 px). Nada en producción.

### Qué funcionó

- **Crear la reunión** (Planeación, celular): tipo, hora, duración, Auditorio y Lobby con montaje de 2 h y desmonte de 1 h. Muestra "Ocupa 8:00 a. m. – 1:00 p. m." y qué espacios están libres. En borrador no reserva.
- **Publicar y Reservas:** al publicar se crearon las dos reservas aprobadas con `time_range` de 8:00 a 13:00 y el pastor de sede recibió los dos avisos. Reservas pinta el montaje y desmonte rayados. Un líder que intenta reservar el Lobby de 12:30 a 13:30 recibe "Ese horario choca con otra reserva (incluyendo buffers de montaje)".
- **Asignar** (líder de LMRSG): ve solo su equipo, asigna Guitarra, Batería y Voz principal; al servidor le llega "Te asignaron Guitarra eléctrica".
- **Aceptar** (servidor, celular): Inicio muestra el próximo servicio; en Mis servicios acepta y aparece su checklist. No tiene Reservas en la barra.
- **En vivo:** Planeación abre en vivo; punto actual con temporizador, tiempo real frente al planeado (13/10, 3/5, 1/10 min), avance del equipo y checklist del servidor con barra. El servidor no puede avanzar puntos ni cerrar asistencia (`sin_permiso`).
- **Asistencia:** la líder de LMRSG guarda la suya y no ve "Confirmar y cerrar"; Planeación confirma y cierra. Asistencia "prellenada" solo para quien aceptó y completó el checklist, como está definido.
- **Estadísticas:** tablero (1 realizada, asistencia 67 %, checklists 100 %, 17 de 25 min) y salud del equipo con semáforo.
- **Cada rol ve lo suyo** (probado en pantalla y con la sesión de cada usuario contra `salud_servidores`, `estadisticas_reuniones`, `ficha_servidor`, `asistencia_sugerida`, `people`, `assignments` y `attendance`):

| Rol | Salud del equipo | Fichas | Notas |
|---|---|---|---|
| Planeación, pastor de sede | Todos | Todas | Ven y confirman la asistencia de todos |
| Líder de LMRSG | Solo LMRSG | Solo LMRSG | Confirma asistencia mientras está abierta; no cierra |
| Líder del área Voces | Solo Voces | Ninguna fuera de Voces | |
| Líder de discipulado | Solo su discipulado | Solo su discipulado | Las métricas de reuniones se calculan sobre su gente |
| Líder de Protocolo | Solo Protocolo | Solo Protocolo | |
| Servidor | Nada | La suya | Solo se ve a sí mismo en `people`; `/reservas` lo manda a Inicio |

### Lo que falló y se arregló

| Falla | Causa | Arreglo |
|---|---|---|
| `supabase test db` daba 188 de 210 (permission denied en `spaces`, `bookings`, `ministries`, `current_role_is`) | La CLI nueva ya no expone a `anon`/`authenticated` lo que se crea en `public`. Producción es un proyecto anterior que sí lo hace, y las migraciones viejas cuentan con eso | `api.auto_expose_new_tables = true` en `supabase/config.toml`, solo para local. **Ojo:** la CLI anuncia que quita esa opción el 30 oct; si se actualiza la CLI hace falta una migración que dé los GRANT explícitos (ver Pendientes) |
| **Estadísticas se caía** (`PERIODOS.some is not a function`) | La página, de servidor, importaba una constante de un archivo `"use client"` | `PERIODOS` pasó a `app/servir/estadisticas/_lib/periodos.ts` |
| **En vivo no se actualizaba solo** (ni el punto actual ni los checklists del equipo) | El canal de Realtime se unía antes de que el navegador leyera la sesión, entraba como `anon`, Realtime rechazaba el filtro de `checklist_items` ("invalid column for filter") y se caía toda la suscripción | `lib/supabase/realtime.ts` (`suscribirConSesion`): espera la sesión y le pasa el token a Realtime antes de suscribir. Se usa en En vivo y en la bandeja de avisos, que tenía el mismo problema |
| La asistencia sugerida no aparecía hasta recargar | El componente tomaba las sugerencias solo al montarse | Las filas que no se han tocado se actualizan con lo que llega; lo marcado a mano se respeta |
| Un servidor que escribía `/reservas/nueva` veía el formulario (la base sí bloqueaba el insert) | Solo se escondía el enlace | `/reservas` y `/reservas/nueva` mandan a Inicio si el rol principal es `servidor` |
| Inicio seguía mostrando una reunión ya cerrada como "Tu próximo servicio" y como "2 sin responder" | Las consultas solo excluían canceladas | También excluyen cerradas |
| `/sw.js` y `/manifest.webmanifest` redirigían a `/login` sin sesión: el service worker no se registraba y la PWA no se podía instalar desde el login (pasa igual en `main`) | El middleware de sesión los atrapaba | Se excluyen del matcher del middleware |
| La tarjeta "Tu próximo servicio" se salía de la pantalla a 375 px | Celda de grid sin `minmax(0, 1fr)` con un texto `truncate` | `grid-cols-1` |
| Textos: "1 Por Responder", "Jueves, 29 De Octubre De 2026", "Faltan 1 por marcar" | `capitalize` en toda la frase; plural fijo | Mayúscula solo donde va; "Falta 1" |
| Un error de red de Auth se mostraba como `{}` en el login | Se mostraba el mensaje crudo | Mensaje genérico cuando no trae texto |

### Observaciones (no se cambiaron)

- ~~Directorio de personas con teléfono y correo de todos~~: resuelto (solo nombre y departamento, ver arriba).
- Al terminar la reunión, el último punto muestra su tiempo real solo después de recargar.
- "Terminar reunión" usa el `confirm()` del navegador; funciona, pero no se ve como el resto de la app.
- El filtro de departamentos de Estadísticas le muestra los 8 departamentos a un líder que solo puede ver el suyo (los demás salen vacíos).
- Cobertura dice "1 aceptadas de 0 requeridas" cuando la reunión no tiene posiciones requeridas (sin plantilla); "1 ausentes" en plural.
- En `npm run dev` con la máquina cargada, algunas respuestas tardaron 40–100 s y el botón se quedaba en "Abriendo…". No es del código; conviene repetir el recorrido con `next build && next start` antes del piloto.
- Las Donaciones (producción) se suscriben a Realtime igual que lo hacían En vivo y la bandeja. No se tocó; revisarlo con el paso a producción.

## Pendientes

| Pendiente | Por qué | Quién |
|---|---|---|
| Comunidad (`/discipulos`, Donaciones, Inicio, `/admin`) leyendo de las tablas nuevas, y retirar `/servicio` | Hoy leen el JSON `servicio_data` de producción. Cambiarlas antes de migrar ese JSON a tablas en producción dejaría las pantallas vacías. Gian decidió (29 oct) retirar `/servicio`: es redundante con Servir. Plan en `etapa-5-servir.md`, Fase D, pasos 1 a 3 | Fase D |
| Correo de respaldo del `notificador` | Falta escoger el proveedor y su llave | Gian + B4 |
| Push en un navegador real y FCM | Necesita un celular | QA |
| Google de punta a punta (Apple más adelante) | Gian configura el proveedor (lista en el PR #8). Apple quedó oculto hasta configurarlo | Gian, luego QA |
| GRANT por defecto que faltaban en la base local de los frentes | En producción Supabase ya los da. En local se resolvió con `auto_expose_new_tables = true`, que la CLI quita el 30 oct: al actualizar la CLI, una migración debe dar los GRANT explícitos que las migraciones viejas suponen | Verificar en la Fase D |
| Recorrido repetido con build de producción y push en un celular real | El QA del 29 oct se hizo con `next dev` | QA |

## Nota sobre "fundadores" (resuelta)

El plan de la etapa (`etapa-5-servir.md`, sección 2) incluye un rol `fundador` con la misma visibilidad que un pastor de sede. La pregunta era a quién se le da. Si en RSG no hay un grupo así (por ejemplo, porque los pastores principales ya son pastores de sede), el rol simplemente no se usa. Si lo hay, se asigna en `/admin → Usuarios → Rol primario → Fundador`.
