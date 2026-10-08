# Portal RSG: documento de traspaso

Este documento es el punto de partida para construir el Portal RSG con Claude Code dentro del repositorio de reservas. Resume las decisiones tomadas, lo que ya existe y funciona, las reglas que no se pueden romper y el orden de construcción.

Ubicación sugerida en el repo de reservas: `docs/portal.md`, referenciado desde `CLAUDE.md`.

---

## 1. Qué es

Un solo link donde líderes, pastores, Planeación y administración entran con su cuenta de Google y encuentran todas sus herramientas. Cada persona ve solo lo que le corresponde según sus roles.

Módulos:

| Módulo | Estado hoy | Dónde vive hoy |
|---|---|---|
| Reservas de espacios | Funciona, en uso | Este repo (Next.js en Vercel + Supabase) |
| Donaciones | Funciona, en uso | resurgencia.com/pago/panel/ (PHP en Hostinger) |
| Servicio (servidores) | Funciona, en uso | El mismo panel de Hostinger |
| Calendario RSG | No existe como vista | Los eventos viven en el proyecto "Calendario RSG" de Asana |
| Inicio personalizado | Nuevo | |

## 2. Decisiones tomadas

1. **El portal crece desde la app de reservas.** Ya tiene usuarios, roles, RLS, Slack y calendarios. No se reescribe.
2. **Entrada con Google** (Supabase Auth, proveedor Google). Solo entran correos autorizados por administración. Nadie usa claves compartidas.
3. **Supabase es el único registro de personas y roles.**
4. **Donaciones y servicio se quedan en Hostinger.** El webhook de Wompi, la hoja de efectivo, el token de Asana y los datos no se mueven. Hostinger expone una API para el portal.
5. **El navegador nunca habla con Hostinger.** El servidor del portal (route handlers de Next.js) llama a Hostinger con una firma. Así el secreto compartido nunca sale de Vercel y Hostinger.
6. **El panel actual sigue vivo** hasta que el portal lo reemplace por completo.
7. Link sugerido: `equipo.resurgencia.com` (CNAME a Vercel). Por confirmar.

## 3. Arquitectura

```
Navegador (líder, pastor, Planeación, admin)
        │  sesión de Supabase (Google)
        ▼
Portal: Next.js en Vercel ─────────────► Supabase
  · Inicio, Calendario, Reservas           · personas y roles
  · Servicio y Donaciones (vistas)         · reservas, espacios
        │
        │  llamada servidor a servidor, firmada (HMAC)
        ▼
Hostinger: resurgencia.com/pago/
  · API nueva para el portal (por construir)
  · Donaciones: webhook Wompi + hoja de efectivo
  · Servicio: listados, ausencias, sincronización con Asana
  · Datos en pago/datos/panel/ (JSON/JSONL, fuera de git)
```

## 4. Personas y roles

### Modelo

Revisa primero cómo el repo de reservas ya modela usuarios y roles, y extiéndelo. No dupliques tablas.

Lo que necesitamos representar:

- **Persona:** usuario de Supabase Auth, correo, nombre, activo.
- **Roles de la persona:** varios por persona. Algunos llevan un alcance:

| Rol | Alcance | Ejemplo |
|---|---|---|
| `admin` | | Gian |
| `pastor_sede` | sede | |
| `admin_casa` | | |
| `planeacion` | | Equipo de Planeación |
| `lider_discipulado` | id del discipulado en Hostinger | `gian-camila` |
| `lider_ministerio` | ministerio o departamento | |
| `studio` | | Administrador del Estudio |

Los roles de reservas que ya existen se conservan. Los `id` de los discipulados son los slugs de `pago/datos/panel/ajustes.json` en Hostinger: `francisco-marysol`, `cesar-andrea`, `wilmer-karla`, `gian-camila`, `linda-bello`. Confírmalos con la API antes de usarlos.

- **Acceso:** administración registra el correo y los roles antes de que la persona entre. Si alguien entra con Google y su correo no está registrado, ve "Pídele acceso a administración" y no ve ningún dato. Hazlo cumplir en la base (RLS o un auth hook), no solo en la interfaz.

### Qué ve cada rol

| | Inicio | Calendario | Reservas | Servicio | Donaciones |
|---|---|---|---|---|---|
| admin | Sí | Todo | Todo | Todo, puede editar | Todo |
| planeacion | Sí | Todo, con servidores | Según spec de reservas | Todo, puede editar | **Nunca, nada** |
| lider_discipulado | Sí | Eventos | Según spec de reservas | Solo sus discípulos, lectura | Solo Módulo Dar de su discipulado |
| pastor_sede | Sí | Todo | Detalle completo (spec) | Por decidir | Por decidir |
| admin_casa | Sí | Eventos | Detalle completo (spec) | No | No |
| lider_ministerio | Sí | Eventos | Según spec de reservas | No | No |
| studio | Sí | Solo lo del Estudio | Lo del Estudio (spec) | No | No |

Una persona con varios roles ve la unión. Ejemplo: Gian es `admin`, `lider_discipulado` (gian-camila) y `planeacion`.

## 5. Reglas que ya existen y no se pueden romper

Todo esto está implementado en Hostinger (`pago/panel-lib.php`, `pago/panel-servicio.php`, `pago/panel/api.php`). El portal **no** recalcula estas reglas: las pide ya resueltas a la API.

### Donaciones

- **Fuentes:** Wompi (webhook en tiempo real), hoja de Google "Diezmos y Ofrendas en Efectivo" (Apps Script envía todo cada vez que cambia) e importaciones manuales.
- **Origen:**
  - Módulo Dar: diezmos y ofrendas del formulario `dar.html` y del efectivo.
  - Formularios: links de pago de ventas o eventos, identificados por link o prefijo de referencia.
  - Otro origen.
- **Conceptos del Módulo Dar:** Diezmo, Diezmo + Ofrenda, Ofrenda, Pro Casa.
- **Una persona = un donante**, aunque done a veces con cédula, a veces solo con correo o con su nombre escrito distinto. Se agrupa por cédula, correo o nombre completo.
- **Cruce con discípulos:** por nombre (nombre de pila más al menos un apellido, parecido ≥ 0,75), o por asignación manual de administración. La asignación manual gana.
- **Un líder solo ve donaciones del Módulo Dar de sus discípulos.** Nunca formularios, nunca otros grupos. Tampoco ve correo, cédula ni referencia.
- **Pastores & Líderes:** grupo especial solo para admin, con 18 personas. Muchas también están en un discipulado. **Nunca se suman dos veces en los totales.** Es una vista, no un grupo de dinero aparte.
- **Discípulos y resto de la congregación:** porcentaje y monto, solo admin.

### Servicio

- **Calendario:** las reuniones vienen del proyecto de Asana "Calendario RSG" (gid `1214245218084418`). Secciones: Entrenamientos, Ministerios, Formación, Comunidad, Eventos, Servolución. Hostinger sincroniza con su propio token. Casi todas las tareas tienen solo fecha (`due_on`), sin hora.
- **Listados:** Planeación sube el PDF de WorshipTools (Planning) de cada reunión. Se lee en el navegador y no se guarda el archivo.
- **Conteo:**
  - Varios roles en una misma reunión cuentan como **un** servicio.
  - Las **Reuniones Centrales del mismo domingo cuentan como una**.
  - **Reuniones de ministerio y Servolución se cuentan por separado**, nunca sumadas en una sola cifra.
  - **Ausente:** estaba asignado y no llegó. Queda registrado, pero no cuenta como servicio.
- **Notas:** una nota por reunión y otra por persona. Las ven solo admin y Planeación.
- **Servidor y discípulo:** el cruce se hace por nombre (admite el nombre de pila abreviado: Zai ~ Zaira) o por corrección manual.
- **Vista "Hoy":** al entrar, Planeación y admin ven en grande las reuniones del día, con su estado y el botón para subir el listado. Los líderes no la ven.

## 6. API entre el portal y Hostinger

Por construir en el repo `resurgencia/resurgencia-web`, en `pago/portal/api.php`. Reutiliza las funciones existentes: `sv_vista()`, la lógica de `datos` de `pago/panel/api.php` y las acciones `sv_*`. No dupliques reglas.

### Firma

Cada llamada del servidor del portal lleva:

```
POST https://resurgencia.com/pago/portal/api.php
Content-Type: application/json
X-Portal-Ts:     <segundos unix>
X-Portal-User:   <base64url de JSON>
X-Portal-Firma:  <hex de HMAC-SHA256(secreto, ts + "\n" + X-Portal-User + "\n" + sha256_hex(cuerpo))>
```

`X-Portal-User` contiene:

```json
{ "sub": "<uuid supabase>", "email": "...", "nombre": "...",
  "roles": ["admin", "planeacion", "lider_discipulado"],
  "grupos": ["gian-camila"] }
```

Hostinger:

- Rechaza si la firma no coincide (`hash_equals`) o si el reloj difiere más de 60 s.
- Toma los roles **solo** de ese encabezado firmado. Nunca del cuerpo.
- El secreto vive en Vercel (`HOSTINGER_PORTAL_SECRET`, solo servidor, nunca `NEXT_PUBLIC_`) y en Hostinger en `pago/panel-portal-config.php`. Ese archivo hay que agregarlo al `.gitignore` y a la lista `exclude` de `.github/workflows/deploy.yml` de `resurgencia-web`, igual que los demás `*config.php`.

### Cuerpo

```json
{ "accion": "donaciones", "como": "lider_discipulado", "grupo": "gian-camila", "version": "" }
```

`como` dice con qué rol actúa la persona en esa vista. Hostinger verifica que lo tenga, y para `lider_discipulado` que `grupo` esté en sus `grupos`.

### Acciones

| Acción | Quién | Devuelve |
|---|---|---|
| `donaciones` | admin, lider_discipulado | Lo mismo que hoy `datos` para ese perfil: donaciones, grupos, miembros y, para admin, formularios y segmentos |
| `servicio` | admin, planeacion, lider_discipulado | `sv_vista()` para ese perfil |
| `calendario` | todos | Reuniones de Asana en un rango (`desde`, `hasta`): `id`, `nombre`, `fecha`, `seccion`, `tipo` (`min` o `serv`). Para admin y Planeación también el estado del listado y el número de servidores |
| `mis_servicios` | todos | Reuniones donde sirve o sirvió la persona, cruzando su nombre con los servidores |
| `sv_*` | admin, planeacion | Las mismas acciones de hoy: `sv_sync`, `sv_guardar`, `sv_borrar`, `sv_reunion_crear`, `sv_reunion_quitar`, `sv_servidor_editar`, `sv_servidor_unir`, `sv_servidor_quitar`, `sv_servidor_discipulo` |
| Acciones de configuración de donaciones | admin | Las de hoy: grupos, discípulos, asignaciones, formularios, segmentos |

`version` funciona como hoy: si los datos no cambiaron, responde `{ "sin_cambios": true }`, y el portal lo usa para el refresco casi en vivo (cada 3 s con la pestaña visible).

### Forma de los datos (hoy)

Donación:

```json
{ "id": "...", "f": "2026-10-04T10:12:00-05:00", "m": 50000, "n": "Nombre", "k": "id-donante",
  "t": "Diezmo", "o": "Módulo Dar", "met": "CARD", "di": "id-discipulo", "gid": "gian-camila" }
```

Solo admin recibe además `e` (correo), `doc` (cédula), `ref`, `am` (cómo se asignó: `manual` o `auto`), `llave` y `sg` (grupos especiales).

Reunión, para admin y Planeación:

```json
{ "id": "gid-asana", "nombre": "[Ministerio RSG] Reunión Central", "fecha": "2026-10-11",
  "seccion": "Ministerios", "origen": "asana", "u": "central|2026-10-11", "tipo": "min",
  "cargada": true, "nota": "", "filas": [ { "sid": "...", "roles": ["Sonido"], "aus": false, "nota": "" } ] }
```

Servicio visto por un líder:

```json
{ "di": "id-discipulo", "f": "2026-10-11", "r": "Reunión Central", "u": "central|2026-10-11",
  "t": "min", "aus": false, "rid": "...", "roles": ["Cámara"] }
```

## 7. Etapas

Cada etapa se puede usar sola antes de pasar a la siguiente.

1. **Personas y entrada con Google.**
   - Proveedor Google en Supabase y lista de correos autorizados.
   - Roles con alcance, extendiendo lo que ya tiene reservas.
   - Pantalla de administración para invitar personas y asignar roles.
   - Migrar los roles actuales de reservas.
2. **Estructura del portal.** Menú según roles, Inicio vacío y Reservas funcionando como hoy dentro del portal.
3. **API en Hostinger** (repo `resurgencia-web`).
   - Firma, acciones `calendario`, `servicio` y `donaciones`.
   - Archivo de config fuera de git.
   - Probar con un script antes de conectar el portal.
4. **Calendario RSG.**
   - Vista mensual, semanal y de lista: eventos de Asana más reservas de Supabase.
   - Al tocar un evento: la reserva del espacio y, para quien puede verlo, el equipo de servidores.
   - Debe funcionar bien en el celular.
5. **Servicio en el portal.** Vistas de Planeación/admin y de líder, incluida la vista "Hoy", la subida del PDF y las ausencias.
6. **Donaciones en el portal.** Vistas de admin y de líder.
7. **Inicio personalizado.** Hoy: reuniones del día, mis reservas, si me toca servir y, para líderes, el resumen de su discipulado.
8. **Apagar las claves compartidas** del panel viejo (`/pago/panel/`) cuando todos usen el portal.

Atajo opcional para las etapas 5 y 6: mientras se portan las vistas, el portal puede abrir el panel actual con inicio de sesión automático. El portal genera un token firmado de un solo uso, y una acción nueva `login_portal` en `pago/panel/api.php` crea la sesión con el rol correcto. Eso deja todo accesible desde un solo link en pocos días.

## 8. Decisiones abiertas

1. ¿`pastor_sede` ve donaciones? ¿Totales o con nombres?
2. ¿`pastor_sede` ve el módulo de servicio?
3. ¿Quién ve los nombres de los servidores en el calendario?
4. Link final: ¿`equipo.resurgencia.com`?
5. Personas sin cuenta de Google: ¿se les pide crear una, o se agrega entrada por enlace al correo?
6. Las dos que ya estaban abiertas en reservas: si los márgenes de montaje y desmontaje bloquean conflictos o son informativos, y qué espacios requieren aprobación.

## 9. Seguridad

- Nunca subir claves al repo. En Vercel van como variables de entorno. En Hostinger, en archivos `*config.php` fuera de git.
- El secreto de la API de Hostinger solo se usa en código de servidor.
- Planeación **nunca** recibe datos de donaciones, ni siquiera vacíos con estructura. Hostinger lo filtra y el portal no lo pide.
- Un líder nunca recibe datos de otro discipulado. Hostinger lo filtra por el `grupo` firmado.
- Cada push a `main` de `resurgencia-web` se publica en vivo en resurgencia.com, incluido el cobro de Wompi. Los cambios en `pago/` van por rama y se revisan antes de unir.

## 10. Para empezar en Claude Code

Abre el repo de reservas en Claude Code y pega:

> Lee `docs/portal.md` completo y el `CLAUDE.md` del repo. Revisa cómo está modelado hoy el acceso (usuarios, roles, RLS) y dime en un resumen corto qué ya sirve para el portal y qué hay que agregar. Después propón el plan detallado de la etapa 1 (personas, roles y entrada con Google) con las migraciones de Supabase que harías. No cambies nada todavía.
