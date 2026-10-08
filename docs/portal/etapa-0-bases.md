# Etapa 0: Bases

Objetivo: dejar listo el terreno sin que ningún usuario note cambios. Nada de esta etapa cambia lo que la gente ve hoy en reservas.

## 0.1 Entorno paralelo

- Crear la rama `portal`.
- Instalar y configurar Supabase local (`supabase init` si hace falta, `supabase start`). Traer el esquema actual de producción como migración base (`supabase db pull`, solo lectura, con permiso) para que local y producción partan iguales.
- `.env.local` apuntando a Supabase local mientras se construye. Guardar las claves de producción aparte, sin usarlas por defecto.
- Slack desactivado en local: ninguna notificación de prueba debe llegar al canal real.
- Dejar en `docs/portal/` una guía corta de cómo levantar todo en local.

## 0.2 Roles, permisos y alcance

Hoy `profiles.role` guarda un solo rol. Se necesita el modelo de permisos de `00-vision-y-arquitectura.md`:

```
user_roles         user_id, role, scope_type null, scope_id null, created_at, created_by
role_permissions   role, permission                       (los paquetes por defecto, como datos)
user_permissions   user_id, permission, scope_type null, scope_id null,
                   effect ('grant' | 'deny'), created_at, created_by
permission_log     id, actor_id, target_user_id, action, permission, scope, created_at
```

- **Roles:** los de la tabla de `00-vision-y-arquitectura.md`, ya definidos por Gian. Mapeo desde `profiles.role`: `leader` → `lider_departamento`, `mentor` → `lider_discipulado`, los demás igual.
- **Alcance:** `lider_discipulado` lleva `discipulado`, y una persona puede liderar más de uno. Los permisos con alcance que vienen de un rol heredan el alcance de ese rol.
- **`requested_role`** usa los mismos códigos nuevos.
- **Funciones SQL** `security definer` y estables, para las políticas RLS: `has_permission(permission, scope_type default null, scope_id default null)`, `permission_scopes(permission)` (los alcances donde la persona lo tiene) e `is_super_admin()`.
- **Transición:** `profiles.role` se mantiene y se sigue escribiendo mientras reservas lo lea. Se llena `user_roles` desde `profiles.role`. Reservas pasa a usar permisos en un paso aparte, probado, sin cambiar lo que cada persona puede hacer hoy.
- **`/admin/personas`** (reemplaza a `/admin/usuarios`):
  - Lista de personas con sus roles.
  - Ficha de cada persona: roles con alcance, y sus permisos efectivos agrupados por módulo, con interruptores para dar o quitar, mostrando de dónde viene cada uno ("por su rol" o "dado a mano").
  - Confirmación al dar permisos de donaciones.
  - Registro de cambios.
- **El `panel_url` por usuario queda obsoleto:** no se borra la columna todavía, solo se deja de usar.

## 0.3 Directorio de personas

Es lo que conecta los módulos. Hoy vive en `ajustes.json` y `servicio.json` de Hostinger.

```
discipulados   id text (slug: 'gian-camila'), nombre, lider_texto, activo
discipulos     id text (id del PHP: 'gian-camila-3'), nombre, discipulado_id, user_id null, activo
servidores     id text (sid del PHP), nombre, discipulo_id null, discipulo_manual bool
```

- **Los ids del PHP se conservan tal cual.** Así la importación es repetible y los cruces coinciden.
- **`discipulos.user_id`** permite, a futuro, que un discípulo con cuenta se vea a sí mismo. No se usa todavía.
- **Los líderes de discipulado se enlazan a su discipulado** por `user_roles` (`lider_discipulado`, `discipulado`, id).
- **RLS:** super_admin todo; servidor_planeacion lee todo; lider_discipulado lee solo los de sus discipulados.

## 0.4 Exportación desde Hostinger e importador

- **En `resurgencia-web`** (rama propia, revisada): `pago/portal/exportar.php` según `02-construccion-en-paralelo.md`, más el archivo de config fuera de git.
- **En este repo:** `scripts/importar-hostinger.ts`, que trae `ajustes` y `servicio` y hace upsert en el directorio. Las donaciones se agregan en la etapa 2.

## 0.5 Sistema visual

- Llevar los tokens de `00-vision-y-arquitectura.md` (claro y oscuro) a la configuración de estilos de la app, más las tipografías Sora y Public Sans.
- Crear los componentes base, mirando el panel PHP como referencia:
  - Tarjeta con encabezado plegable.
  - Bloque principal en color acento con cifra grande.
  - Mosaicos de cifras.
  - Tabla que en el celular se vuelve tarjetas.
  - Etiquetas.
  - Aviso flotante.
  - Selector de periodo (mes, trimestre, semestre, año, con flechas).
- Aplicar el sistema a la portada y a Reservas, **sin cambiar su lógica**. Esto sí se puede pasar a producción al terminar, como un cambio visual.

## 0.6 Respaldos diarios

En el repo privado **`resurgencia/rsg-respaldos`**, un workflow de GitHub Actions programado (todos los días, madrugada de Bogotá) y lanzable a mano:

1. **Respaldo de Supabase de producción:**
   - `pg_dump` con la cadena del **session pooler**. La conexión directa de Supabase es solo IPv6 y los runners de GitHub no la alcanzan.
   - El cliente `pg_dump` debe coincidir con la versión mayor de Postgres del proyecto.
2. **Respaldo de Hostinger:** los recursos de `exportar.php` (donaciones, efectivo, ajustes, servicio).
3. **Cifrado con `age`:**
   - El workflow solo conoce la **clave pública**, como secret.
   - La clave privada la guarda Gian fuera de todo sistema (gestor de contraseñas o impresa).
4. **Guardar** en `respaldos/AAAA/MM/DD/` y hacer commit.
5. **Mantener activo Supabase:** el respaldo ya cuenta como actividad.
6. **Si algo falla**, el workflow falla. GitHub avisa por correo.

Secrets del workflow:
- `SUPABASE_DB_URL` (session pooler, usuario con permiso de lectura)
- `AGE_PUBLIC_KEY`
- `HOSTINGER_EXPORT_URL`
- `PORTAL_EXPORT_SECRET`

Incluye `RESTAURAR.md` en ese repo con los pasos para descifrar y restaurar.

**Prueba obligatoria:** restaurar un respaldo en un proyecto vacío y comprobar que las reservas están completas. Sin esta prueba la etapa no se cierra.

## 0.7 Dominio

- Agregar `portal.resurgencia.com` al proyecto en Vercel, con un CNAME en el DNS de resurgencia.com (Hostinger).
- Actualizar en Supabase la Site URL y las URLs de retorno, y en Google Cloud los orígenes autorizados si aplica.
- `rsg-reservas.vercel.app` sigue funcionando.

## Terminado cuando

- [ ] Supabase local levanta con el esquema de producción y la app corre contra él en `localhost`.
- [ ] `user_roles` existe, está lleno desde `profiles.role`, y `/admin/usuarios` asigna varios roles con alcance.
- [ ] Reservas funciona igual que antes en producción.
- [ ] El directorio (discipulados, discípulos, servidores) está importado y cuadra con el panel PHP: mismos totales por discipulado.
- [ ] El sistema visual está aplicado a la portada y a Reservas.
- [ ] El respaldo diario corre, está cifrado, y **la restauración de prueba funcionó**.
- [ ] `portal.resurgencia.com` abre la app y el login funciona ahí.
