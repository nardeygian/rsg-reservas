# Etapa 5: Servir (reuniones, equipos y servicio en vivo)

> **Estado: aprobado y en construcción.** Fases A, B y C construidas; avance en `estado-etapa5.md`. Respuestas de Gian a las decisiones abiertas al final.

Objetivo: que Planeación arme cada reunión de punta a punta, que pastores y líderes midan cómo están sus reuniones y la salud de sus servidores, y que todo quede listo para publicarse como app en Google Play y App Store. En detalle: que Planeación arme cada reunión de punta a punta, que cada líder asigne a su gente, que cada servidor sepa qué hace, lo acepte y lo cumpla en vivo con su checklist, y que todo quede conectado con Discipulados, el Calendario, Reservas y las estadísticas de Servicio que ya existen. Referencia de producto: Planning de WorshipTools (orden del culto con tiempos, canciones, equipos por rol, aceptar/rechazar con un toque, recordatorios).

Lee antes `00-vision-y-arquitectura.md` (roles y permisos) y `01-reglas-que-no-se-rompen.md` (conteos de Servicio).

---

## 1. Qué hay hoy y qué cambia

| Hoy | Problema | En esta etapa |
|---|---|---|
| Servicio en un solo JSON (`servicio_data`): reuniones de Asana, servidores (solo nombre), listados subidos en PDF | No se puede asignar, notificar ni dar permisos por fila; se pisan escrituras | **Tablas relacionales con RLS.** El JSON se migra y queda como respaldo de solo lectura |
| Servidores y discípulos son registros distintos, unidos por nombre | La misma persona aparece duplicada; un servidor que no es discípulo no tiene dónde vivir | **Directorio único de personas** (`personas`). Un servidor puede ser discípulo o no |
| Departamentos en `ministries`, roles en `user_roles` | No existen áreas dentro de un departamento ni posiciones | **Áreas, equipos y posiciones** |
| La asistencia se carga después, con el PDF del listado | No hay asignación previa ni confirmación | **Asignación → aceptación → checklist en vivo → asistencia confirmada** |
| Notificaciones solo por Slack al staff | Los servidores no reciben nada | **Push (PWA), bandeja en la app y correo**, con envíos masivos por audiencia |

Las estadísticas actuales (Servicio por periodo, por discipulado, Inicio) **siguen dando los mismos números**: se recalculan desde las nuevas tablas con una vista SQL que respeta las reglas de conteo de hoy.

---

## 2. Roles y permisos nuevos

Se extiende el catálogo de `00-vision-y-arquitectura.md`. Todo se cumple con RLS vía `has_permission(permiso, alcance)`.

**Roles nuevos:** `fundador` (ve todo, como pastor de sede), `lider_area` (alcance: un área de un departamento), `servidor` (implícito: toda persona que pertenece a un equipo).

| Permiso | Qué permite | Alcance |
|---|---|---|
| `servir.ver_todo` | Ver todas las reuniones, equipos, asignaciones, asistencia y checklists | |
| `servir.ver_reuniones` | Ver **todas** las reuniones (fecha, orden, canciones y equipo de cada una), aunque no esté asignado | |
| `servir.planear` | Crear reuniones y plantillas, armar el orden, duplicar, publicar | |
| `servir.vivo` | Conducir la sesión en vivo (avanzar el orden, ver el avance de todos) | |
| `servir.asistencia` | Confirmar quién asistió y cerrar la reunión | |
| `servir.asignar` | Asignar servidores a posiciones y gestionar su equipo | departamento o área |
| `canciones.editar` | Crear canciones, subir letras y archivos | |
| `servir.plantillas` | Crear y editar tipos de reunión y sus plantillas | ministerio (o todos) |
| `servir.estadisticas` | Ver el tablero de reuniones y la salud de los servidores | todos, ministerio, departamento, área o discipulado |
| `notificar.enviar` | Enviar notificaciones push | todos, departamento, área o reunión |

| Rol | Paquete por defecto |
|---|---|
| super_admin, pastor_sede, fundador | Todo lo anterior + `notificar.enviar` a **todos** los servidores + `servir.estadisticas` de **todos** |
| servidor_planeacion | `servir.ver_todo`, `servir.planear`, `servir.vivo`, `servir.asistencia`, `canciones.editar`, `servir.plantillas` (todos), `servir.estadisticas` (todos), `notificar.enviar` (reunión) |
| pastor_ministerio | `servir.plantillas` y `servir.estadisticas` de **su ministerio** (ver decisión 8) |
| lider_departamento | `servir.ver_reuniones` (**todas** las reuniones); `servir.asignar`, `notificar.enviar` y `servir.estadisticas` de **su departamento** |
| lider_area | `servir.ver_reuniones` (**todas** las reuniones); `servir.asignar`, `notificar.enviar` y `servir.estadisticas` de **su área** |
| servidor | **Solo las reuniones donde está asignado**: su asignación, aceptar/rechazar, el orden y las letras de esa reunión y su propio checklist. Marcar fechas en que no puede |
| lider_discipulado | Ve el servicio de sus discípulos (como hoy), ahora con asignaciones y asistencia, y `servir.estadisticas` de **su discipulado** (salud de sus discípulos que sirven) |

**Visibilidad de reuniones (regla de RLS):**
- **Servidor:** una reunión solo existe para él si tiene una asignación en ella (pendiente, aceptada o rechazada). No ve reuniones donde no sirve ni el checklist de otros.
- **Servidor líder** (líder de departamento o de área): ve **todas** las reuniones, con su orden, canciones y **el equipo completo** (quién sirve en cada departamento, con su estado), para planear con tiempo y coordinarse con los demás. **Asigna y notifica solo a su gente**, y no ve los checklists de otros departamentos. *(Decidido por Gian.)*
- **Planeación, pastores de sede, fundadores y super admin:** ven todo.

---

## 3. Modelo de datos

Todas las tablas con RLS en la misma migración en que se crean. Fechas en `timestamptz`, mostradas en `America/Bogota`.

> **Nombres reales (Fase A):** este boceto usa nombres en español; en la base quedaron en inglés, como pide CLAUDE.md: `people`, `areas`, `team_members`, `positions`, `person_positions`, `availability_blocks`, `discipleship_groups`, `meeting_types`, `meeting_templates`, `meetings`, `meeting_changes`, `songs`, `run_items`, `assignments`, `checklist_templates`, `checklist_items`, `attendance`, `push_subscriptions`, `broadcasts`, `notifications`, `reminders`, `role_permissions`, `user_permissions`, `permission_log` y la vista `service_units`. La fuente de verdad son las migraciones `supabase/migrations/20261028*` y `lib/servir/contratos.ts`.

**Personas y equipos**
```
personas            id, nombre, telefono, email, profile_id (null si no tiene cuenta),
                    discipulo_id (null), servidor_legacy_id (null), activo
areas               id, ministry_id (departamento), nombre
equipo_miembros     persona_id, ministry_id, area_id (null), es_lider_area bool
posiciones          id, ministry_id, area_id (null), nombre        -- "Guitarra eléctrica", "Luces", "Ujier puerta 1"
persona_posiciones  persona_id, posicion_id                         -- en qué puede servir cada quien
bloqueos            persona_id, desde, hasta, motivo                -- fechas en que no puede servir
```

**Reuniones y orden**
```
reuniones           id, nombre, inicio, fin, tipo_reunion_id, tipo ('ministerio'|'servolucion'|'evento'),
                    seccion, ministry_id, asana_gid (null), booking_id (null),
                    estado ('borrador'|'publicada'|'en_vivo'|'cerrada'|'cancelada'), plantilla_id, item_actual_id,
                    inicio_real, fin_real
reunion_cambios     reunion_id, tipo ('reprogramada'|'cancelada'|'restaurada'), inicio_anterior, inicio_nuevo,
                    motivo, autor, creado_en          -- historial: una reunión puede reprogramarse varias veces
tipos_reunion       id, nombre, ministry_id, conteo ('min'|'serv'), color, dia_habitual, hora_habitual,
                    duracion_min, espacio_habitual_id (null), plantilla_id (por defecto),
                    asana_reglas (jsonb: sección + palabras clave para reconocer eventos de Asana), activo
plantillas          id, tipo_reunion_id, nombre, version, creada_desde_reunion_id (null), creada_por,
                    orden (jsonb: ítems con tipo, título, duración, notas, posición responsable),
                    posiciones_requeridas (jsonb: departamento → posiciones y cantidad),
                    checklist_extra (jsonb), actualizada_en
orden_items         id, reunion_id, posicion, tipo ('cancion'|'predica'|'oracion'|'anuncio'|'encabezado'|'otro'),
                    titulo, duracion_seg, cancion_id (null), tono, notas, responsable_posicion_id (null),
                    inicio_real, fin_real              -- se marcan en vivo: tiempo planeado vs. real
canciones           id, titulo, artista, tono, bpm, letra (texto con secciones [Verso] [Coro]),
                    archivos (Storage: PDF, acordes, multitrack), ccli, etiquetas, ultimo_uso
```

**Asignaciones, checklist y asistencia**
```
asignaciones        id, reunion_id, persona_id, posicion_id, asignado_por,
                    estado ('pendiente'|'aceptada'|'rechazada'|'cancelada'), respondida_en, motivo
checklist_plantilla posicion_id, momento ('antes'|'durante'|'despues'), texto, orden_item_tipo (null)
checklist_items     asignacion_id, momento, texto, hecho_en, hecho_por
asistencia          asignacion_id, estado ('asistio'|'tarde'|'ausente'), confirmado_por, confirmado_en
```

**Notificaciones**
```
push_suscripciones  profile_id, plataforma ('web'|'android'|'ios'), endpoint (web) o token (FCM/APNs),
                    p256dh, auth, dispositivo, version_app, creada_en, ultima_vez
notificaciones      profile_id, tipo, titulo, cuerpo, link, leida_en, envio_id (null)
envios              id, autor, audiencia ('todos'|'departamento'|'area'|'reunion'), alcance_id,
                    titulo, cuerpo, programado_para, enviado_en, total_destinatarios
recordatorios       asignacion_id, tipo, enviar_en, enviado_en      -- los genera la base, los envía el worker
```

**Compatibilidad:** la vista `service_units` reproduce los conteos de hoy (unidad por día de Reunión Central, `min`/`serv`, ausentes no cuentan) sumando lo histórico migrado del JSON y la asistencia nueva.

---

## 3.1 Tipos de reunión y plantillas

Cada ministerio tiene sus **tipos de reunión** (Reunión Central, Semilleros, Mega Jóvenes…). Un tipo guarda lo que se repite: ministerio, si cuenta como ministerio o Servolución, color, día y hora habituales, duración, espacio habitual y su **plantilla por defecto** (orden con tiempos, posiciones requeridas por departamento y checklist extra).

**Tipos iniciales, sacados de las 119 reuniones que ya existen:**

| Tipo | Ministerio / sección | Conteo | Día habitual |
|---|---|---|---|
| Reunión Central | Ministerio RSG | min | domingo |
| Semilleros | Servolución | serv | sábado |
| Lazos de Amor | Servolución | serv | sábado |
| Cursos Formativos | Casa de Formación | min | martes |
| Estudio Bíblico | Casa de Formación | min | jueves |
| Corazón y Visión | Evento RSG | min | miércoles |
| Reunión Semanal | Jóvenes | min | miércoles |
| Mega Jóvenes | Jóvenes / Ministerio RSG | min | sábado |
| Mujeres · Hombres · Mayores con Propósito · Sesiones de Vida | Su ministerio | min | sábado |
| Entrenamiento Roadies | Roadies | min | lunes |
| Bautizos | Evento RSG | min | domingo |
| Evento especial (Navidad, Día de la Madre…) | Evento RSG | min | según el evento |

**Reconocimiento automático:** al sincronizar Asana, cada evento se clasifica en su tipo por sección y palabras clave del nombre (sin importar tildes ni mayúsculas). Así se unifican nombres que hoy aparecen escritos de varias formas ("Mayores Con Proposito", "Mayores con proposito"). Lo que no se reconoce queda como "Sin tipo" para que Planeación lo asigne con un toque, y esa corrección enseña la regla.

**Crear reuniones rápido:**
- **Desde un tipo:** se elige el tipo y la fecha; el resto (hora, duración, espacio, orden, posiciones por departamento) llega prellenado desde su plantilla. Un clic para publicar.
- **En serie:** "todos los domingos de noviembre" crea las reuniones de una vez, cada una con su plantilla.
- **Desde el Calendario:** un evento de Asana ya clasificado muestra "Crear reunión" con su plantilla.
- **Guardar como plantilla:** cualquier reunión ya armada se puede guardar como plantilla (nueva o como nueva versión de la de su tipo). Las reuniones ya creadas no cambian cuando se edita la plantilla.
- **Duplicar:** copiar una reunión anterior (por ejemplo, "como el domingo pasado").

**Uso en el resto del portal:** el tipo da el color en el Calendario, agrupa las estadísticas de Servicio (asistencia y cobertura por tipo de reunión) y permite comparar, por ejemplo, cuántos servidores necesita una Reunión Central frente a cuántos llegaron.

---

## 3.2 Estadísticas y salud del servidor

Un tablero para **pastores, Planeación, líderes de departamento y de área, y líderes de discipulado**. Cada quien ve exactamente su alcance (RLS): pastores de sede, fundadores y Planeación ven todo; el pastor de ministerio, su ministerio; el líder de departamento o de área, su gente; el líder de discipulado, sus discípulos que sirven. Filtros: periodo (mes, trimestre, semestre, año), tipo de reunión, ministerio y departamento.

**Reuniones**
- **Realizadas, canceladas y reprogramadas**, por periodo y por tipo, con el motivo de cada cambio y quién lo hizo (de `reunion_cambios`). Una reunión reprogramada cuenta una vez, en la fecha en que por fin se hizo.
- **Cobertura:** posiciones requeridas frente a cubiertas y aceptadas, por departamento. Cuáles quedaron sin cubrir.
- **Respuesta:** tasa de aceptación y tiempo promedio en responder.
- **Asistencia:** asistió, tarde, ausente; asignados que no llegaron.
- **Ejecución en vivo:** checklists completados y duración real frente a la planeada (por reunión y por ítem del orden).

**Salud del servidor** (por persona, y agregada por equipo)
- **Frecuencia:** veces que sirve por mes y tendencia de los últimos 3 meses.
- **Dónde sirve:** en qué tipos de reunión y en qué posiciones.
- **Compromiso:** tasa de aceptación, rechazos, ausencias, tardanzas y checklists completados.
- **Continuidad:** última vez que sirvió y racha de semanas seguidas.
- **Semáforo**, con umbrales que Planeación puede ajustar:
  - **Sano:** sirve con regularidad, dentro de lo esperado.
  - **Sobrecargado:** sirve más de lo recomendado (por ejemplo, más de 4 veces al mes), en riesgo de desgaste.
  - **Alejándose:** baja su frecuencia o rechaza seguido.
  - **Inactivo:** no sirve hace más de N semanas.
- **Ficha del servidor:** historial completo (reuniones, posiciones, respuestas, asistencia), su discipulado, sus fechas bloqueadas y notas del líder. La ve su líder de departamento, su líder de discipulado y quien vea todo.

**Cómo se calcula:** vistas SQL sobre `asignaciones`, `asistencia`, `checklist_items`, `reuniones` y `reunion_cambios`, y una vista materializada `salud_servidor_mensual` que `pg_cron` refresca cada noche. El tablero solo lee, y las mismas cifras alimentan las tarjetas del Inicio y la sección de Comunidad. Los conteos históricos siguen las reglas de `01-reglas-que-no-se-rompen.md`.

---

## 4. Flujos principales

1. **Planeación crea la reunión**: eligiendo el tipo (todo llega prellenado de su plantilla), en serie, desde un evento del Calendario (Asana) ya clasificado, duplicando una anterior o en blanco. Arma el orden (arrastrar y soltar, con duración por ítem y hora calculada), agrega canciones, define las posiciones requeridas por departamento y, si hace falta, reserva el espacio (queda enlazado como hoy con `calendar_links`). Publica.
2. **Los líderes asignan**: cada líder de departamento (o de área) ve las posiciones sin cubrir de su equipo, con sugerencias (quién sabe esa posición, quién no tiene bloqueo ese día, quién sirvió menos últimamente) y asigna.
3. **El servidor acepta**: le llega push + aviso en la app ("Te asignaron Luces el domingo 9:00"). Acepta o rechaza con un toque; si rechaza, el líder recibe aviso para reasignar.
4. **Recordatorios automáticos**: asignación sin responder (a las 48 h), "mañana sirves" (24 h antes) con su checklist de preparación, y "empezamos en 2 horas".
5. **En vivo**: Planeación abre la sesión. Todos ven el orden con el ítem actual y un temporizador; cada servidor ve **su** checklist (antes / durante / después) y marca cada punto. Al terminar todo, su servicio queda en **verde (success)**. Planeación ve un tablero con el avance de cada persona, en tiempo real.
6. **Cierre**: Planeación confirma asistencia (prellenada: quien completó su checklist aparece como "asistió"), marca tardanzas y ausentes, y cierra. Eso alimenta las estadísticas de Servicio, de Discipulados y del Inicio.
7. **Envíos masivos**: pastores de sede, fundadores y super admin escriben a todos los servidores; cada líder solo a su departamento o área; Planeación a los servidores de una reunión. Todo envío queda registrado.

---

## 5. Pantallas

- **Servir** (nuevo destino de navegación, ver decisión 3):
  - *Mis servicios* (servidor): solo las reuniones donde está asignado, con aceptar/rechazar, checklist, orden y letras; fechas en que no puedo.
  - *Reuniones* (líderes, Planeación y quien vea todo): todas las reuniones en lista y calendario. Los líderes las ven en modo lectura y asignan su parte; Planeación además edita el orden. Equipo por departamento con estados (aceptado / pendiente / rechazado / sin cubrir).
  - *Mi equipo* (líderes): miembros, posiciones, bloqueos, asignar por reunión, tasa de aceptación.
  - *Canciones*: biblioteca, letra por secciones, archivos, último uso.
  - *Tipos y plantillas* (Planeación y pastores de ministerio): tipos por ministerio, su plantilla con orden y posiciones, versiones, y la bandeja de eventos de Asana "Sin tipo".
  - *En vivo*: vista de servidor y tablero de Planeación.
- **Inicio**: "Tu próximo servicio" (con aceptar), pendientes por responder; para líderes, posiciones sin cubrir; para Planeación, "Abrir en vivo" el día de la reunión.
- **Calendario**: el evento muestra la reunión, su orden y el equipo.
- **Comunidad**: Discipulados y Servidores leen de las tablas nuevas.
- **Tú**: notificaciones (bandeja), activar notificaciones push en este dispositivo, mis equipos, **eliminar mi cuenta** (exigido por las tiendas).
- **Estadísticas** (pastores, Planeación, líderes): tablero de reuniones, salud del equipo con semáforo y ficha de cada servidor.

Todo con el sistema visual actual (vidrio, radios 12/22/30, Instrument Sans, íconos del set).

---

## 6. Notificaciones: cómo se envían

- **Un solo despachador, varios canales.** `notificador` decide por cada dispositivo registrado en `push_suscripciones` según su `plataforma`:
  - **App nativa (Android e iOS):** Firebase Cloud Messaging (FCM), que en iPhone entrega por APNs. Es el canal principal cuando la app esté en las tiendas.
  - **Web (PWA)** con VAPID, para quien use el navegador. **En iPhone solo funciona si la persona instaló la app web en la pantalla de inicio** (iOS 16.4+).
  Así, lo que se construya ahora para web sirve igual cuando lleguen las apps: solo se suma un canal.
- **Bandeja en la app** siempre (toda notificación queda ahí).
- **Correo** de respaldo para quien no tiene push activo (proveedor transaccional; las llaves van en Vercel/Supabase, nunca en el código).
- **Slack** sigue para el staff como hoy.
- **Programación:** en Vercel Hobby los crons corren solo una vez al día, así que los recordatorios los dispara **`pg_cron` de Supabase cada 5 minutos**, que llama a una **Edge Function** `notificador` que lee `recordatorios` y `envios` pendientes y despacha. WhatsApp queda fuera de esta etapa (tiene costo por mensaje); se puede sumar después en el mismo `notificador`.

---

## 6.1 Lista para Google Play y App Store

La meta es publicar el portal como app en las dos tiendas. **Recomendado: Capacitor**, una sola base para Android e iOS que carga el portal (el mismo código Next.js de hoy) dentro de una app nativa y le suma lo nativo: notificaciones push, enlaces que abren la app, pantalla sin conexión, ícono y pantalla de inicio. Así no se mantienen tres aplicaciones distintas.

**Reglas de las tiendas que condicionan el diseño desde ya:**
- **Apple no acepta un sitio web empaquetado** (guía 4.2, funcionalidad mínima). La app debe sentirse y comportarse como app: push nativo, apertura desde enlaces, modo sin conexión con lo último cargado (Mis servicios, checklist, letras), gestos y navegación propios. El sistema visual actual (barra flotante, hojas, vidrio) ya va en esa dirección.
- **Inicio de sesión (guía 4.8) — decidido por Gian: con Google y con Apple**, en web, Android e iOS, con Supabase Auth. Como se ofrece Google, "Entrar con Apple" es además lo que exige Apple para iPhone. Correo y contraseña se mantienen para quien ya los usa. Consecuencias:
  - **Apple puede ocultar el correo** ("Ocultar mi correo"): llega una dirección de reenvío de Apple. Por eso la cuenta no se une a la persona solo por correo: el servidor entra con el **enlace de invitación** de su líder, y esa cuenta queda unida a su registro en `personas`.
  - **Una persona puede unir Google y Apple a la misma cuenta** desde *Tú* (identidades vinculadas de Supabase), para no duplicarse si cambia de teléfono.
  - **Al eliminar la cuenta**, si entró con Apple, se revoca su autorización con la API de "Entrar con Apple", como pide Apple.
  - **Configuración** (sin claves en el código): proveedor Google (cliente OAuth web, Android e iOS) y proveedor Apple (Services ID, llave privada, dominio verificado) en Supabase, más las URL de retorno de la app.
- **Eliminar cuenta desde la app (guía 5.1.1(v), y Google Play exige lo mismo):** borrar la cuenta y los datos personales, no solo desactivarla. Va en *Tú*.
- **Donaciones (guía 3.2.2):** la app no puede **recibir** donaciones adentro salvo que la iglesia esté aprobada como organización sin ánimo de lucro por Apple. El módulo Dar del portal solo **reporta** (no cobra), así que no aplica; si algún día hay botón "Donar", debe abrir el navegador.
- **Privacidad:** política de privacidad pública, la ficha de "Privacidad de la app" (Apple) y "Seguridad de los datos" (Google), declarando nombre, correo, teléfono, servicio y, para administradores, datos de donaciones.
- **Cuentas de desarrollador:** Apple Developer Program (pago anual) y Google Play Console (pago único), **a nombre de la iglesia como organización** (pide número D-U-N-S). Las cuentas personales nuevas de Google exigen una prueba cerrada con al menos 12 personas durante 14 días antes de publicar; las de organización lo evitan.

**Lo que esta etapa deja listo para las apps (sin construirlas todavía):**
1. `push_suscripciones` con plataforma y token; `notificador` con canales intercambiables (FCM y web push).
2. Enlaces universales (iOS) y App Links (Android): archivos `apple-app-site-association` y `assetlinks.json` en panel.resurgencia.com, para que los enlaces de invitación, recordatorios y recuperación de contraseña abran la app.
3. Botones **"Continuar con Google"** y **"Continuar con Apple"** en el login (web primero), invitaciones que unen la cuenta a la persona, vincular ambas identidades desde *Tú*, y redirecciones de Supabase preparadas para el esquema de la app.
4. "Eliminar mi cuenta" en *Tú*, con borrado real de datos personales.
5. Pantalla sin conexión y caché de lo esencial en el service worker (Mis servicios, checklist del día, letras).
6. Zonas seguras, objetivos táctiles de 44 px, nada que dependa de pasar el mouse.

---

## 7. Fases y trabajo en paralelo

El trabajo se divide en **frentes con dueños de carpetas distintas**, para que varias sesiones (workers) avancen a la vez sin pisarse. Cada frente trabaja en su propia rama/worktree y abre su PR.

### Fase A · Fundación (secuencial, 1 worker) — todo depende de esto
- Migraciones: personas, áreas, equipos, posiciones, reuniones, orden, canciones, asignaciones, checklist, asistencia, notificaciones; RLS y `has_permission` con los permisos nuevos.
- Migración del JSON `servicio_data` a tablas (reuniones, servidores → personas, listados → asistencia histórica) y unión con discípulos (`miembros`).
- Semilla de los tipos de reunión de la tabla 3.1 y clasificación de las 119 reuniones existentes (con reporte de las que queden "Sin tipo").
- Vista `service_units` y prueba de que los números de hoy no cambian.
- **Contratos:** tipos generados (`lib/database.types.ts`), y firmas de las server actions y helpers de cada frente en `lib/servir/contratos.ts`. Desde aquí, cada frente programa contra el contrato.
- Carpetas: `supabase/migrations/**`, `lib/servir/**`, `scripts/migrar-servicio.ts`.

### Fase B · Frentes en paralelo (5 workers)
| Frente | Entrega | Carpetas que le pertenecen |
|---|---|---|
| **B1 Planeación** | Tipos de reunión y plantillas (con versiones), crear desde tipo, en serie, duplicar, guardar como plantilla; orden con duraciones; publicar; enlace con Calendario y Reservas | `app/servir/reuniones/**`, `app/servir/plantillas/**` |
| **B2 Canciones** | Biblioteca, letras por secciones, archivos en Storage (bucket con RLS), vista de letra para el servidor | `app/servir/canciones/**` |
| **B3 Equipos y asignaciones** | Mi equipo (líder de depto y de área), posiciones, bloqueos, asignar con sugerencias, Mis servicios con aceptar/rechazar | `app/servir/equipo/**`, `app/servir/mis-servicios/**` |
| **B4 Notificaciones** | Suscripción push en el service worker, bandeja, envíos masivos por audiencia, `notificador` + `pg_cron`, correo de respaldo | `lib/notificaciones/**`, `public/sw.js`, `supabase/functions/notificador/**`, `app/tu/notificaciones/**` |
| **B5 Cuentas** | "Continuar con Google" y "Continuar con Apple" (web), invitaciones del líder que unen la cuenta a la persona, vincular identidades, "Eliminar mi cuenta" con revocación de Apple | `app/(auth)/**`, `app/auth/**`, `app/perfil/cuenta/**`, `lib/cuentas/**` |

### Fase C · En vivo, estadísticas e integración (3 workers)
| Frente | Entrega | Carpetas |
|---|---|---|
| **C1 En vivo y asistencia** | Sesión en vivo con Realtime, checklist por servidor, tablero de Planeación, tiempos reales del orden, cierre y confirmación de asistencia | `app/servir/[id]/vivo/**` |
| **C3 Estadísticas** | Tablero de reuniones (realizadas, canceladas, reprogramadas, cobertura, respuesta), salud del servidor con semáforo, ficha del servidor, vista materializada nocturna | `app/servir/estadisticas/**`, `supabase/migrations/*estadisticas*` |
| **C2 Integración** | Destino "Servir" en la navegación, tarjetas del Inicio, Calendario con equipo, Comunidad leyendo de las tablas nuevas, permisos en `/admin` | `app/_components/portal/**`, `app/page.tsx`, `app/calendario/**`, `app/servicio/**`, `app/discipulos/**`, `lib/auth.ts` |

### Transversal · QA (1 worker, desde la Fase A)
- Pruebas de RLS por rol con usuarios de prueba: que cada rol vea y haga exactamente lo que dice (un líder de área no ve otra área, un servidor no ve checklists ajenos, etc.).
- Recorridos completos en el navegador (crear → asignar → aceptar → en vivo → cerrar) en celular y escritorio.

**Reglas para trabajar en paralelo:** nadie toca carpetas de otro frente; los archivos compartidos (`globals.css`, navegación, `lib/auth.ts`) solo los toca C2; cualquier cambio de esquema después de la Fase A pasa por el contrato y se avisa a los demás frentes.

### Fase E · Apps en tiendas (puede arrancar en paralelo desde la Fase B)
| Frente | Entrega | Carpetas |
|---|---|---|
| **E1 App nativa** | Proyecto Capacitor (Android e iOS), íconos y pantallas de inicio, push nativo con FCM/APNs registrando en `push_suscripciones`, enlaces universales, inicio de sesión dentro de la app, "Entrar con Apple", modo sin conexión | `mobile/**`, `public/.well-known/**` |
| **E2 Tiendas** | Cuentas de organización, política de privacidad, fichas de privacidad, capturas, prueba interna (TestFlight y prueba cerrada de Google Play) | `docs/apps/**` |

### Fase D · Paso a producción
1. Migraciones a producción **con permiso de Gian** y respaldo del día. Migración del histórico.
2. **Piloto** con un departamento (sugerido: LMRSG o Creativos) durante 2 domingos, en paralelo al listado en PDF.
3. Comparar conteos: deben coincidir con el método actual.
4. Abrir a todos los departamentos; el listado en PDF queda como respaldo y después se retira.

---

## 8. Decisiones abiertas (respuesta de Gian)

1. **Cuentas de servidores.** Para push, checklist y aceptar, cada servidor necesita entrar a la app. Recomendado: invitación de su líder (por correo o por enlace que el líder comparte por WhatsApp); al abrirla, la persona entra con Google o Apple y su cuenta queda unida a su registro. Alternativa: enlace personal firmado solo para aceptar/rechazar, sin cuenta.
2. **Fuente de las reuniones.** Recomendado: Asana sigue siendo el calendario de la iglesia y el portal crea la reunión a partir del evento (enlazada por `asana_gid`); las reuniones que no estén en Asana se crean directo en el portal.
3. **Navegación.** Recomendado: nuevo destino **Servir** para servidores y líderes. Para quien tiene todos los destinos (super admin, pastores), Reservas pasa a ser una vista dentro de Calendario ("Eventos | Espacios") para no pasar de 5 íconos. Alternativa: Servir dentro de Comunidad.
4. **Asistencia.** Recomendado: completar el checklist prellena "asistió", pero la confirmación final la hace Planeación. ¿Los líderes de departamento también pueden confirmar la de su gente?
5. **Fundadores.** ¿Quiénes son? Se crea el rol `fundador` con la misma visibilidad que pastor de sede.
6. **Letras.** Se guardan solo para uso interno del equipo (no proyección). Si se usan letras con derechos, conviene registrar el número CCLI de la iglesia.
7. **WhatsApp.** Fuera de esta etapa por costo; ¿lo quieres en una etapa siguiente?
8. **Quién edita las plantillas.** Recomendado: Planeación edita todas y cada pastor de ministerio las de su ministerio. ¿Los líderes de departamento pueden ajustar las posiciones que su departamento aporta a una plantilla?
9. **Umbrales de salud del servidor.** Recomendado para empezar: sobrecargado con más de 4 servicios al mes, alejándose si baja a la mitad frente a su promedio de 3 meses, inactivo tras 6 semanas sin servir. Planeación los ajusta después.
10. **Apps.** Inicio de sesión **decidido: Google y Apple** (además del correo actual). Falta confirmar Capacitor y que las cuentas de desarrollador sean a nombre de la iglesia (organización, con D-U-N-S).

### Respuestas de Gian (28 oct 2026)

- **1 · Cuentas:** quien entra con Google o Apple sin invitación recibe el rol básico `servidor`, escoge su departamento y el líder de departamento, un pastor de sede o un super admin aprueba si se une.
- **3 · Navegación:** Servir va como destino nuevo.
- **4 · Asistencia:** los líderes de departamento también confirman la de su gente; Planeación cierra.
- **5 · Fundadores:** Gian preguntó a qué se refiere; queda abierto (ver `estado-etapa5.md`).
- **9 · Umbrales:** "3 es mucho, 1 es poco". Se configuró así: sobrecargado con 3 o más en 30 días; alejándose con 1 o menos; inactivo tras 6 semanas. Falta que Gian confirme esta lectura.
- **Eliminar cuenta con reservas:** se pregunta y se borran también las reservas a su nombre.

## Terminado cuando

- [ ] Planeación crea una reunión con orden, tiempos y canciones, y la publica.
- [ ] Crear una Reunión Central desde su tipo toma un clic más la fecha, y crear todos los domingos de un mes toma un paso.
- [ ] Las reuniones existentes y los eventos nuevos de Asana quedan clasificados por tipo; lo no reconocido aparece en "Sin tipo".
- [ ] Un líder de departamento y uno de área ven todas las reuniones pero asignan solo a su gente; el servidor acepta o rechaza desde su celular.
- [ ] Un servidor sin asignación en una reunión no la ve, ni por la app ni consultando la base directamente.
- [ ] Llegan los recordatorios a tiempo (push o correo) y quedan en la bandeja.
- [ ] En vivo, cada servidor completa su checklist y Planeación ve el avance en tiempo real.
- [ ] Al cerrar, la asistencia alimenta Servicio, Discipulados e Inicio con los mismos conteos de hoy.
- [ ] Pastores de sede, fundadores y super admin ven todo y pueden notificar a todos; cada líder solo a los suyos.
- [ ] Las pruebas de RLS por rol pasan.
- [ ] Cada rol ve estadísticas solo de su alcance: reuniones realizadas, canceladas y reprogramadas, y la salud de sus servidores con su ficha.
- [ ] Las notificaciones salen por un despachador con canales intercambiables (web push hoy, FCM cuando esté la app), y existe "Eliminar mi cuenta".
- [ ] Se puede entrar con Google y con Apple; una invitación une la cuenta a su persona aunque Apple oculte el correo.
