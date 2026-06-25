# 03 - Roles y visibilidad

La visibilidad por rol es el corazón del sistema. Se resuelve en dos capas: Row Level Security para las filas y vistas para las columnas.

## Roles

| Rol | Quién es | Qué puede hacer |
|-----|----------|-----------------|
| `leader` | Líderes de ministerio o departamento | Reservar y ver el calendario general con info acotada |
| `pastor_sede` | Pastores de sede | Ver todo el detalle, aprobar y rechazar reservas |
| `admin_casa` | Administrador de casa | Ver todo el detalle, aprobar, gestionar pagos y requerimientos |
| `studio_admin` | Administrador del Estudio (tercero) | Crear y sincronizar reservas del Estudio (negocio y RSG) |
| `super_admin` | Tú o quien administre la plataforma | Gestionar espacios, usuarios y configuración |

## Qué ve cada rol de una reserva

| Campo | leader | pastor_sede / admin_casa | studio_admin |
|-------|:------:|:------------------------:|:------------:|
| Espacio y franja horaria | sí | sí | sí (solo Estudio) |
| Ministerio o departamento | sí | sí | sí, si es de RSG |
| Tipo de uso | sí | sí | sí, si es de RSG |
| Requerimientos (sillas, mesas, hidratación) | no | sí | no |
| Estado de pago de terceros | no | sí | propio |
| Notas internas | no | sí | no |
| Banderas de montaje | resumen | sí | sí |
| Reserva de negocio del Estudio | solo "Reserva Studio Prado" | solo "Reserva Studio Prado" | detalle propio |

Regla clave del Estudio: cuando `owner_org = Studio Prado` y `visibility = private_label`, nadie fuera del `studio_admin` ve más que la etiqueta genérica y la franja ocupada. Cuando el Estudio reserva para RSG, la reserva se comporta como una reserva normal de RSG.

## Capa 1: Row Level Security (filas)

Activar RLS en todas las tablas con datos sensibles:

```sql
alter table profiles enable row level security;
alter table bookings enable row level security;
alter table booking_audit enable row level security;
```

Función auxiliar para leer el rol del usuario actual sin recursión:

```sql
-- security definer hace que la función corra como el owner (postgres en Supabase),
-- que tiene BYPASSRLS, así que la subquery a profiles no recurse las policies de profiles.
create or replace function current_role_is(roles text[])
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = any(roles)
  );
$$ language sql security definer stable;
```

### Políticas de profiles

```sql
create policy "ver mi perfil"
  on profiles for select
  using (id = auth.uid() or current_role_is(array['pastor_sede','admin_casa','super_admin']));

create policy "editar mi perfil"
  on profiles for update
  using (id = auth.uid());
```

### Políticas de bookings

Lectura: solo el staff con detalle (pastor de sede, admin de casa, super_admin) lee `bookings` directamente. El `studio_admin` lo lee solo para reservas del Estudio. Los líderes nunca tocan `bookings`: consultan `bookings_calendar`, que corre como su owner y expone solo columnas seguras.

```sql
create policy "leer detalle staff"
  on bookings for select
  using (
    current_role_is(array['pastor_sede','admin_casa','super_admin'])
    or (
      current_role_is(array['studio_admin'])
      and space_id = (select id from spaces where slug = 'estudio')
    )
  );
```

Inserción: un líder crea reservas a su nombre; el `studio_admin` crea reservas del Estudio.

```sql
create policy "crear reserva propia"
  on bookings for insert
  with check (
    created_by = auth.uid()
    and (
      current_role_is(array['leader','pastor_sede','admin_casa','super_admin'])
      or (current_role_is(array['studio_admin'])
          and space_id = (select id from spaces where slug = 'estudio'))
    )
  );
```

Actualización: el creador edita su reserva mientras está en `requested`; pastores y administradores aprueban, rechazan y gestionan pago.

```sql
create policy "editar mi reserva pendiente"
  on bookings for update
  using (created_by = auth.uid() and status = 'requested');

create policy "gestionar reservas staff"
  on bookings for update
  using (current_role_is(array['pastor_sede','admin_casa','super_admin']));
```

### Política de booking_audit

Solo el staff lee la bitácora. No hay políticas de INSERT/UPDATE/DELETE: las filas las escribe el trigger `bookings_audit` con `security definer`.

```sql
create policy "leer bitácora staff"
  on booking_audit for select
  using (current_role_is(array['pastor_sede','admin_casa','super_admin']));
```

## Capa 2: Vistas y revocación de acceso directo

RLS no filtra columnas. La trampa: si dejamos a `authenticated` con SELECT directo sobre `bookings`, cualquiera con la anon key puede pedir `internal_notes`, `requirements`, `payment_status` o el detalle de las reservas `private_label` del Estudio — la vista solo protege a quien decide consultarla. Para cerrar esa puerta:

```sql
-- 1. Quitar el acceso directo a bookings desde el cliente.
revoke select on bookings from anon, authenticated;

-- 2. Exponer una vista genérica para todos.
create or replace view bookings_calendar
with (security_invoker = false) as  -- corre como su owner; los líderes no tienen SELECT sobre bookings
select
  b.id,
  b.space_id,
  s.name as space_name,
  b.starts_at,
  b.ends_at,
  b.status,
  case
    when b.visibility = 'private_label' then 'Reserva Studio Prado'
    else coalesce(m.name, 'RSG')
  end as display_owner,
  case
    when b.visibility = 'private_label' then null
    else b.use_type
  end as use_type,
  case when b.montaje_lock then true else false end as has_montaje_lock
from bookings b
join spaces s on s.id = b.space_id
left join ministries m on m.id = b.ministry_id
where b.is_recurrence_template = false;

grant select on bookings_calendar to anon, authenticated;

-- 3. Exponer una vista con detalle, pero respetando RLS.
create or replace view bookings_staff
with (security_invoker = true) as
select * from bookings
where is_recurrence_template = false;

grant select on bookings_staff to authenticated;
```

Tres puntos clave:

- **`bookings_calendar` corre como su owner** (security_invoker desactivado). Es seguro porque solo expone columnas no sensibles y aplica el enmascaramiento del Estudio. La consultan todos.
- **`bookings_staff` respeta RLS del usuario** (security_invoker activado). Como solo pastor/admin/super_admin/studio_admin (limitado al Estudio) tienen policy SELECT sobre `bookings`, solo ellos reciben filas; el resto recibe cero. La app no necesita ramas según rol.
- **Realtime queda cubierto**: Supabase Realtime aplica las mismas policies de RLS, así que un líder suscrito a `bookings` no recibirá nada. Las suscripciones del cliente se hacen contra las vistas o un canal de broadcast específico.

En la app, la decisión es trivial: el staff lee `bookings_staff`, todos leen `bookings_calendar` para pintar el calendario general.

## Resumen de la regla mental

- ¿Es una fila que este usuario puede tocar? Lo decide RLS.
- ¿Qué columnas de esa fila puede ver? Lo decide qué vista expone esa columna. La tabla `bookings` no es consultable directamente desde el cliente.
- Si dudas, expón menos. Es más fácil revelar después que recuperar un dato filtrado.
