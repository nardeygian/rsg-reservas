# Fábrica de plataformas · Paso 1: inventario y plan

Fecha: 31 oct 2026 · Estado: **propuesto, espera aprobación de Gian**. No se cambia código hasta aprobarlo.

Meta: un repositorio plantilla **`plataforma-base`** en GitHub y una skill **`crear-organizacion`** que lo clona, llena la configuración y levanta la plataforma de una iglesia o empresa nueva. RSG pasa a ser la **primera instancia**: su portal debe correr sobre la base con su configuración, sin que nadie note la diferencia.

Revisado sobre la rama `claude/dazzling-cannon-ngvafl` (commit `d964ab2`): 52 migraciones, unas 140 pantallas y archivos de `app/` y `lib/`.

---

## 1. Inventario: qué está fijo de RSG

### 1.1 Identidad y nombres
| Qué | Dónde | Cuántos |
|---|---|---|
| "Panel RSG", "Portal RSG", "Panel Resurgencia", "Iglesia RSG", "Hoy en Resurgencia", "Donaciones RSG", "Discipulados RSG", "Reserva RSG", "Yo en RSG soy" | `app/layout.tsx`, `app/manifest.ts`, `app/page.tsx`, `app/(auth)/layout.tsx`, `app/(auth)/signup/page.tsx`, `app/auth/invitacion/*`, `app/_components/portal/SidebarNav.tsx`, `app/alquilar/page.tsx`, metadatos de `app/tu/*` y `app/perfil/cuenta/*`, `app/donaciones/_components/DonacionesShell.tsx`, `app/discipulos/_components/DiscipulosAdminShell.tsx`, `app/api/feed/[token]/route.ts`, `app/api/bookings/[id]/ics/route.ts` | ~88 apariciones en ~60 archivos |
| `PRODID:-//RSG Reservas//ES` en los calendarios .ics | `lib/ics.ts` | 1 |
| Mensaje de invitación por WhatsApp ("te invito al portal de RSG") | `lib/cuentas/InvitarPersona.tsx` | 1 |
| Título por defecto de los avisos push ("RSG") | `public/sw.js` | 2 |
| Organización "RSG" buscada por nombre | `app/reservas/nueva/actions.ts`, `app/alquilar/actions.ts`, migración de espacios (`order by name = 'RSG'`) | 3 |
| Dominios `rsg-reservas.vercel.app`, `panel.resurgencia.com`, proyecto Supabase `yuhfntejqkgajmacqmix` | `SITE_URL` por defecto en varias acciones, docs, `.mcp.json` | ~8 |

### 1.2 Marca
| Qué | Dónde |
|---|---|
| 74 colores en variables CSS (claro y oscuro), "Forest Green" `#003329`, arena, salvia | `app/globals.css` |
| `theme_color` y `background_color` | `app/manifest.ts`, `app/layout.tsx` (`viewport.themeColor` `#E9E7E2` / `#071A15`) |
| Tipografía Instrument Sans | `app/layout.tsx`, `app/globals.css` |
| Radios 12/22/30, "liquid glass" (filtro SVG de refracción) | `app/globals.css`, `app/layout.tsx` |
| Logo e íconos | `public/brand/rgs-mark.png`, `public/icons/icon-192.png` y `icon-512.png`, `app/icon.png`, `app/apple-icon.png` |
| Monograma de fondo en el Inicio (`brand-mark`, `brand-hero`) | `app/page.tsx`, `app/globals.css` |
| Llave del tema en el navegador `rsg-theme` | `app/layout.tsx` |

### 1.3 Roles
Hay **dos sistemas de permisos** conviviendo:

- **Servir** (Etapa 5) usa `has_permission()` con `role_permissions`: los paquetes por rol son datos, se pueden configurar.
- **Reservas, Donaciones, Aprobaciones, Admin, feeds** usan nombres de rol escritos a mano:
  - en SQL: `current_role_is(array['pastor_sede','admin_casa','super_admin'])` y variantes, en 16 migraciones, con 22 políticas sobre `bookings` y vistas;
  - en la app: comparaciones de texto en unos 30 archivos (`lib/auth.ts` 14, `app/admin/usuarios/*` 57, `app/page.tsx` 10, `app/aprobaciones/*` 12, `app/reservas/*` 12, etc.).

Roles propios de RSG:
- **Principales:** `leader`, `mentor`, `pastor_ministerio`, `pastor_sede`, `admin_casa`, `studio_admin`, `super_admin`, `planeacion`, `fundador`, `servidor`.
- **Adicionales:** `lider_departamento`, `lider_area`, `lider_discipulado`, `servidor_planeacion`.
- **Lugares donde están fijos:**
  - el `check` de `profiles.role` y de `user_roles.role`;
  - `promote_user_role`;
  - los nombres visibles, en `app/perfil/page.tsx` y `app/admin/usuarios/page.tsx`;
  - el rol pedido al registrarse, en `app/(auth)/signup/*`.

Reglas atadas a nombres concretos:
- `lib/auth.ts`: Planeación se reconoce como "líder de departamento cuyo departamento se llama **'Planeación'**".
- `computeNavCaps` decide qué destinos ve cada rol, con los nombres escritos en el código.

### 1.4 Estructura (departamentos, ministerios, tipos, espacios)
| Qué | Dónde |
|---|---|
| Departamentos y ministerios: Creativos, Protocolo, Casa de Formación, Roadies, **LMRSG**, Jóvenes, Mayores con Propósito, Sesiones de Vida… | migración `20261008000000_user_roles_and_ministries_seed.sql` |
| 14 tipos de reunión (**Reunión Central**, Semilleros, Lazos de Amor, Mega Jóvenes, Corazón y Visión, Bautizos…) con día, hora, conteo y palabras clave de Asana | migración `20261028060000_servir_tipos_y_conteos.sql` |
| **Regla "Reunión Central cuenta una vez por día"** (busca el texto "reunion central" en el nombre) | vista `service_units` (SQL) y `app/servicio/_lib/sv-logic.ts` |
| "min" / "serv" (Ministerio / **Servolución**) como clases de conteo | `meetings.kind`, `meeting_types.counting`, estadísticas |
| Ministerio de música = **'LMRSG'** buscado por nombre | migración `20261029140000_servir_ajustes_en_vivo.sql` |
| Espacios (Auditorio, Lobby, Salón 38, Salón 45, **Estudio**) y organizaciones (RSG, **Studio Prado**) | `supabase/seed.sql` |
| Espacio `slug = 'estudio'` con reglas propias (admin del Estudio, etiqueta "Reserva externa") | 8 migraciones, `app/reservas/nueva/page.tsx`, `app/api/feed/[token]/route.ts` |
| `use_type` de reservas: reunion_departamento, reunion_ministerio, **consejeria**, **discipulado**, evento, externo, **studio_negocio**, otro | `check` en `bookings`, etiquetas en 5 archivos |
| Conceptos de donación: **Diezmo, Diezmo + Ofrenda, Ofrenda, Pro Casa** | `app/donaciones/_lib/don-logic.ts` |
| Palabras que reconocen posiciones al leer los PDF de servicio (sonido, cámaras, protocolo, ujier…) | `app/servicio/_lib/sv-pdf.ts` |

### 1.5 Vocabulario
La interfaz usa palabras de iglesia en cientos de textos:
- "discípulo/discipulado" (200 apariciones);
- "ministerio" (198);
- "pastor" (174);
- "servidor", "Servir", "reunión", "Planeación", "Servolución".

Una empresa diría "colaborador", "turno", "área", "coordinación". Hoy esos textos están escritos dentro de los componentes.

### 1.6 Región, idioma y moneda
- `America/Bogota` en 26 archivos (`lib/datetime.ts` define `TZ`, pero muchos componentes lo repiten).
- `es-CO` en 30 archivos y `COP` en 10 (`lib/money.ts`, donaciones, alquiler).
- Datos bancarios de RSG (Bancolombia, cuenta, llave, QR) en `lib/payment-info.ts` y `public/qr-pago.jpg`.

### 1.7 Integraciones
| Integración | Dónde | Qué es |
|---|---|---|
| **Asana** (calendario de la iglesia, clasificación de reuniones) | `lib/asana.ts`, `lib/servir/clasificar.ts`, `lib/servir/agenda.ts`, `app/calendario/page.tsx`, `app/page.tsx`, `app/servicio/*`, `app/servir/reuniones/*` (12 archivos) | Fuente de eventos; otro cliente puede usar Google Calendar o ninguna |
| **Slack** (avisos al staff y DM de reservas) | `lib/slack.ts`, `lib/notifications.ts`, `app/reservas/*`, `app/alquilar/actions.ts`, `app/perfil/*` (7 archivos) | Canal opcional |
| **Wompi** (webhook de donaciones) | `app/api/wompi/route.ts`, `app/donaciones/*`, `lib/supabase/middleware.ts` | Una pasarela entre varias |
| **Panel PHP de Hostinger** y JSON `servicio_data` / `donaciones_data` | `app/servicio/*` (módulo viejo), `app/donaciones/*`, `app/api/efectivo/route.ts`, `app/admin/discipulados`, `lib/auth.ts` (lee el grupo del líder desde el JSON), `lib/servir/clasificar.ts` | **Solo RSG**: se retira en la Fase D |
| Google / Apple (cuentas) | `lib/cuentas/*`, `supabase/config.toml` | Genérico; solo cambian credenciales |
| Push (VAPID, FCM) | `supabase/functions/notificador`, `public/sw.js` | Genérico |

### 1.8 Módulos que hoy existen
| Módulo | Carpeta | ¿Genérico? |
|---|---|---|
| Cuentas, roles, admin | `app/(auth)`, `app/auth`, `app/admin`, `app/perfil`, `lib/cuentas` | Sí |
| Reservas y aprobaciones | `app/reservas`, `app/aprobaciones` | Sí (quitando lo del Estudio como caso especial) |
| Alquiler a externos | `app/alquilar` | Opcional |
| Calendario | `app/calendario` | Sí, con fuente configurable |
| Servir (planeación, equipos, en vivo, estadísticas, canciones) | `app/servir` | Sí; **canciones** es opcional |
| Notificaciones | `app/tu`, `lib/notificaciones`, `supabase/functions` | Sí |
| Discípulos | `app/discipulos` | Opcional (iglesias) |
| Donaciones | `app/donaciones` | Opcional, se generaliza a "Pagos/Donaciones" |
| Servicio (viejo, JSON) | `app/servicio` | **No**: solo RSG, se retira |

---

## 2. Qué va a cada archivo de configuración

Los cinco archivos viven en `config/` del repositorio de cada organización. Un esquema (Zod) los valida al construir; si algo falta o está mal, el build falla con un mensaje claro.

### `config/organizacion.json`: quién es
```json
{
  "id": "rsg",
  "nombre": "Resurgencia",
  "nombreApp": "Panel RSG",
  "nombreCorto": "RSG",
  "tipo": "iglesia",
  "dominio": "panel.resurgencia.com",
  "zonaHoraria": "America/Bogota",
  "idioma": "es-CO",
  "moneda": "COP",
  "contacto": { "correo": "…", "whatsapp": "…" },
  "datosDePago": { "banco": "Bancolombia", "tipoCuenta": "Ahorros", "numero": "…", "titular": "PRO RSG", "llave": "…", "qr": "/qr-pago.jpg" },
  "vocabulario": {
    "persona": "servidor", "personas": "servidores",
    "grupo": "discipulado", "lider_grupo": "líder de discipulado",
    "unidad": "departamento", "subunidad": "área",
    "evento": "reunión", "servir": "Servir",
    "coordinacion": "Planeación"
  }
}
```

### `config/marca.json`: cómo se ve
```json
{
  "logo": "/brand/logo.svg",
  "icono": "/brand/icono.png",
  "tipografia": { "google": "Instrument Sans", "ejes": ["wdth"] },
  "radios": { "control": 12, "tarjeta": 22, "hoja": 30 },
  "efectos": { "vidrio": true },
  "colores": {
    "claro":  { "bg": "#E9E7E2", "ink": "#20231F", "accent": "#003329", "…": "…" },
    "oscuro": { "bg": "#071A15", "ink": "…", "accent": "…" }
  },
  "colorTema": "#003329"
}
```
De aquí salen las variables CSS, el manifest, `theme-color` y los íconos (un script los genera a partir del logo).

### `config/roles.json`: quién ve y hace qué
```json
{
  "principales": [
    { "id": "super_admin", "nombre": "Super admin" },
    { "id": "pastor_sede", "nombre": "Pastor de sede" },
    { "id": "servidor", "nombre": "Servidor", "porDefecto": "google_apple_invitacion" },
    { "id": "leader", "nombre": "Líder", "porDefecto": "registro_correo" }
  ],
  "adicionales": [
    { "id": "lider_departamento", "nombre": "Líder de departamento", "alcance": "unidad" },
    { "id": "lider_area", "nombre": "Líder de área", "alcance": "subunidad" }
  ],
  "permisos": {
    "pastor_sede": ["reservas.aprobar", "reservas.ver_detalle", "servir.ver_todo", "donaciones.ver_todo", "…"],
    "leader": ["reservas.crear"]
  },
  "navegacion": { "pastor_sede": ["inicio", "calendario", "servir", "reservas", "comunidad", "dar"] }
}
```
Se carga en `role_permissions` y en los `check` de roles. La navegación sale de los permisos, no de nombres de rol.

### `config/estructura.json`: cómo está organizada
```json
{
  "unidades": [ { "nombre": "LMRSG", "tipo": "departamento", "areas": ["Voces", "Banda"], "esMusica": true },
                { "nombre": "Planeación", "tipo": "departamento", "esCoordinacion": true } ],
  "grupos": "desde_admin",
  "espacios": [ { "nombre": "Auditorio", "politica": "aprobacion", "montaje": 120, "desmonte": 60 },
                { "nombre": "Estudio", "gestionadoPor": "Studio Prado", "ocupacionCompartida": true } ],
  "organizacionesExternas": ["Studio Prado"],
  "tiposDeEvento": [ { "nombre": "Reunión Central", "clase": "ministerio", "conteo": "una_por_dia", "dia": 0, "hora": "09:00", "fuentePalabras": ["reunion central"] } ],
  "clasesDeConteo": [ { "id": "min", "nombre": "Ministerio" }, { "id": "serv", "nombre": "Servolución" } ],
  "usosDeReserva": ["reunion_departamento", "reunion_ministerio", "consejeria", "discipulado", "evento", "externo", "otro"],
  "conceptosDeDonacion": ["Diezmo", "Diezmo + Ofrenda", "Ofrenda", "Pro Casa"]
}
```
Se carga como datos semilla. La regla de "una vez por día" pasa a ser una columna de `meeting_types` (`conteo`), no un texto buscado en el nombre.

### `config/modulos.json`: qué se enciende
```json
{
  "reservas":       { "activo": true, "alquilerExterno": true, "espaciosExternos": true },
  "calendario":     { "activo": true, "fuente": "asana" },
  "servir":         { "activo": true, "canciones": true, "enVivo": true, "estadisticas": true },
  "comunidad":      { "activo": true, "discipulados": true },
  "pagos":          { "activo": true, "modo": "donaciones", "pasarela": "wompi" },
  "notificaciones": { "push": true, "correo": false, "slack": true },
  "cuentas":        { "google": true, "apple": false, "invitaciones": true },
  "legado":         { "servicioJson": true, "panelPhp": true }
}
```
Un módulo apagado no aparece en la navegación, sus rutas responden 404 y sus tareas programadas no corren. Sus tablas existen igual, para que encenderlo después no requiera migraciones.

Las **llaves y secretos** no van en estos archivos: siguen en variables de entorno (`.env.example` las lista por módulo).

---

## 3. Decisiones de arquitectura que propongo

1. **Una instancia por organización** (su repositorio, su proyecto de Supabase, su proyecto de Vercel), no una sola app para todos. Datos aislados, cada cliente con su dominio y sus llaves, y el mismo modelo de seguridad que ya probamos. Las mejoras de la base llegan a cada instancia con un `git merge` desde `plataforma-base`; `config/` y `public/brand/` son de la instancia y no chocan.
2. **La configuración se lee en dos lugares**:
   - la app la lee al construir (`lib/config.ts`, validada);
   - la base la recibe como datos semilla generados por un script (`scripts/aplicar-config.ts` → `supabase/seed/organizacion.sql`).

   Las reglas de RLS leen tablas (`role_permissions`, `meeting_types`, `servir_ajustes`), nunca el JSON.
3. **Un solo sistema de permisos.** Reservas, Donaciones, Aprobaciones y Admin pasan de `current_role_is(array[...])` a `has_permission('reservas.aprobar')`, etc. Es el cambio más grande y el que hace configurables los roles. En RSG se hace con una migración que da exactamente los mismos permisos que hoy, con pruebas que lo demuestran.
4. **Vocabulario con un diccionario**: un helper `t("persona")` en vez de textos fijos. Solo para las palabras del dominio, no es una traducción completa a otros idiomas.
5. **Integraciones como adaptadores** con la misma interfaz:
   - calendario externo (`asana` | `google` | `ninguno`);
   - avisos al staff (`slack` | `ninguno`);
   - pasarela (`wompi` | `stripe` | `mercadopago` | `bold` | `ninguna`).
6. **La base no hereda las 52 migraciones de RSG.** `plataforma-base` arranca con un conjunto limpio y consolidado (esquema final, sin pasos intermedios ni datos de RSG). RSG conserva su historial tal cual, porque ya está aplicado en producción.
7. **Lo que es solo de RSG no entra a la base**:
   - el módulo Servicio en JSON;
   - el panel PHP, la exportación de Hostinger y el endpoint de efectivo;
   - la lectura de grupos desde el JSON;
   - el Estudio como caso especial: en la base queda como "espacio gestionado por una organización externa", configurable.

---

## 4. Plan por fases

| Fase | Qué se hace | Dónde | Terminado cuando |
|---|---|---|---|
| **0 · Decisiones** | Gian responde las decisiones abiertas (sección 5) | — | Respuestas escritas aquí |
| **1 · Configuración en RSG** | Esquema y cargador de config; los cinco JSON con los valores actuales de RSG; nombres, marca, zona, moneda y datos de pago salen de la config | `rsg-reservas` | La app se ve y funciona **igual**; build, typecheck y pruebas en verde |
| **2 · Permisos unificados** | Permisos `reservas.*`, `donaciones.*`, `admin.*`; políticas de Reservas y Donaciones con `has_permission`; navegación desde permisos; quitar la regla "departamento que se llama Planeación" | `rsg-reservas` | Pruebas por rol: cada rol ve y hace exactamente lo de hoy |
| **3 · Estructura y vocabulario** | Seed generado desde `estructura.json`; "una vez por día" como columna; ministerio de música por marca, no por nombre; diccionario de vocabulario | `rsg-reservas` | Conteos de Servicio iguales a los de hoy |
| **4 · Adaptadores y módulos** | Calendario, avisos al staff y pasarela como adaptadores; `modulos.json` enciende y apaga módulos | `rsg-reservas` | Con Asana y Slack apagados la app funciona sin errores |
| **5 · `plataforma-base`** | Repo plantilla en GitHub: código genérico, migraciones consolidadas, config de ejemplo ("Organización Ejemplo"), generador de íconos, CI (typecheck, lint, pgTAP, build, recorrido en navegador), guía de actualización | nuevo repo | Una instancia de ejemplo se levanta desde cero en un proyecto de Supabase vacío |
| **6 · Skill `crear-organizacion`** | Entrevista (reusa el brief de `plataforma-de-gestion`), crea el repo desde la plantilla, llena los cinco JSON, genera íconos, crea y migra el proyecto de Supabase, configura Vercel y entrega un preview con usuarios de prueba | skill | Una organización de prueba queda en línea siguiendo la skill de punta a punta |
| **7 · RSG sobre la base** | Tras el paso a producción de la Etapa 5: RSG recibe la base por `merge` y queda como instancia | `rsg-reservas` | Producción sin cambios visibles |

Las fases 1 a 4 se hacen dentro de `rsg-reservas`, con RSG como caso real. Así cada paso se comprueba contra algo que ya funciona y no se rompe nada. Recién con la app limpia de valores fijos se copia a `plataforma-base`.

Ninguna fase toca la base de producción sin permiso. Las migraciones de la fase 2 son las únicas que cambian reglas existentes, y van con pruebas de equivalencia.

---

## 5. Decisiones abiertas

1. **¿Una instancia por organización (recomendado) o una sola app con muchas organizaciones?** La segunda es más barata de operar con muchos clientes pequeños, pero cada tabla necesita `organizacion_id` y todas las reglas de RLS cambian. Recomiendo una por organización y revisar el tema si pasan de unas 20.
2. **¿Dónde viven las cuentas de cada cliente** (GitHub, Supabase, Vercel)? ¿En las tuyas, como agencia, o en las del cliente? Cambia lo que automatiza la skill.
3. **¿Qué entra a la base como módulo opcional?** Propuesta:
   - en la base: reservas, calendario, servir (eventos, equipos, en vivo, estadísticas), notificaciones, cuentas, admin;
   - opcionales: canciones, discipulados, pagos/donaciones, alquiler externo, espacios de terceros.
4. **Idioma**: ¿solo español con vocabulario configurable, o también inglés más adelante?
5. **¿Cuándo empezar la fase 1?** Recomiendo **después** de cerrar el QA de la Fase C y unir el PR #10, para no mezclar cambios.
6. **Nombre del repo plantilla y de la organización de GitHub** donde vivirá (`plataforma-base` en la cuenta de Gian u otra).
