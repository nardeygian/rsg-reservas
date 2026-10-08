# Etapa 0: Bases

Objetivo: dejar listo el terreno sin que ningún usuario note cambios. Nada de esta etapa cambia lo que la gente ve hoy en reservas.

## 0.1 Entorno paralelo

- Crear la rama `portal` y confirmar que Vercel genera su URL de Preview.
- Si hay cupo en Supabase Free, crear el proyecto `rsg-portal-dev`, aplicar ahí todas las migraciones existentes y apuntar a él las variables **Preview** de Vercel y el `.env.local`. Si no hay cupo, seguir las reglas de `02-construccion-en-paralelo.md`.
- Agregar la URL de Preview a las URLs de retorno de Supabase Auth, para que Google funcione ahí.
- Slack desactivado en desarrollo y Preview: ninguna notificación de prueba debe llegar al canal real.

## 0.2 Roles con alcance

Hoy `profiles.role` guarda un solo rol. Se necesita:

```
user_roles
  user_id     uuid  → auth.users
  role        text  (enum)
  scope_type  text  null   ('discipulado', 'ministerio', 'sede')
  scope_id    text  null   (ej. 'gian-camila')
  created_at, created_by
  único (user_id, role, scope_type, scope_id)
```

- **Roles:** los actuales más `planeacion`. Unifica `leader` y `lider_departamento`, y `servidor_planeacion` con `planeacion`. Propón el mapeo y pregunta antes de decidir.
- **`mentor` lleva alcance `discipulado`.** Un mentor puede tener más de un discipulado.
- **Funciones SQL de apoyo**, `security definer` y estables, para usar en las políticas RLS:
  - `has_role(role)`
  - `has_scope(role, scope_type, scope_id)`
  - `is_super_admin()`
- **Transición:** `profiles.role` se mantiene y se sigue escribiendo mientras reservas lo lea. Se llena `user_roles` desde `profiles.role`. Reservas pasa a leer de `user_roles` en un paso aparte, probado.
- **`/admin/usuarios`:** asignar varios roles con su alcance. El `panel_url` por usuario queda obsoleto: no se borra la columna todavía, solo se deja de usar.
- **Solicitudes de rol** (`requested_role`) siguen funcionando igual. Al aprobar, se escribe en `user_roles`.

## 0.3 Directorio de personas

Es lo que conecta los módulos. Hoy vive en `ajustes.json` y `servicio.json` de Hostinger.

```
discipulados   id text (slug: 'gian-camila'), nombre, lider_texto, activo
discipulos     id text (id del PHP: 'gian-camila-3'), nombre, discipulado_id, user_id null, activo
servidores     id text (sid del PHP), nombre, discipulo_id null, discipulo_manual bool
```

- **Los ids del PHP se conservan tal cual.** Así la importación es repetible y los cruces coinciden.
- **`discipulos.user_id`** permite, a futuro, que un discípulo con cuenta se vea a sí mismo. No se usa todavía.
- **Los mentores se enlazan a su discipulado** por `user_roles` (`mentor`, `discipulado`, id).
- **RLS:** super_admin todo; Planeación lee todo; mentor lee solo los de sus discipulados.

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

- [ ] La rama `portal` tiene su URL de Preview funcionando con login de Google.
- [ ] `user_roles` existe, está lleno desde `profiles.role`, y `/admin/usuarios` asigna varios roles con alcance.
- [ ] Reservas funciona igual que antes en producción.
- [ ] El directorio (discipulados, discípulos, servidores) está importado y cuadra con el panel PHP: mismos totales por discipulado.
- [ ] El sistema visual está aplicado a la portada y a Reservas.
- [ ] El respaldo diario corre, está cifrado, y **la restauración de prueba funcionó**.
- [ ] `portal.resurgencia.com` abre la app y el login funciona ahí.
