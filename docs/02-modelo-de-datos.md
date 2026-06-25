# 02 - Modelo de datos

Esquema de Postgres para Supabase. Incluye tablas, relaciones, la prevención de choques y los datos semilla.

## Entidades

- **organizations**: quién es dueño de una reserva (RSG o el negocio del Estudio).
- **spaces**: los salones, con su estado y reglas propias.
- **ministries**: departamentos y ministerios de RSG.
- **profiles**: extiende a los usuarios de Auth con rol, ministerio y token de calendario.
- **bookings**: la reserva en sí, con todo su detalle.
- **booking_audit**: bitácora de cambios.

## Esquema SQL

### Extensiones

```sql
create extension if not exists "btree_gist";
```

`btree_gist` es necesaria para la exclusion constraint que mezcla igualdad de `space_id` con solapamiento de rango.

### organizations

```sql
create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null check (type in ('church','external')),
  created_at timestamptz not null default now()
);
```

### spaces

```sql
create table spaces (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text not null unique,
  capacity                int,
  status                  text not null default 'active'
                            check (status in ('active','disabled','external')),
  managed_by_org_id       uuid references organizations(id),
  booking_policy          text not null default 'self_serve'
                            check (booking_policy in ('self_serve','needs_approval')),
  allows_shared_occupancy boolean not null default false,
  setup_buffer_minutes    int not null default 0,
  teardown_buffer_minutes int not null default 0,
  notes                   text,
  created_at              timestamptz not null default now()
);
```

`status = 'disabled'` cubre el Salón 45. `status = 'external'` y `allows_shared_occupancy = true` cubren el Estudio.

### ministries

```sql
create table ministries (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null check (type in ('departamento','ministerio')),
  lead_user_id  uuid,   -- referencia a profiles, se enlaza después de crear profiles
  created_at    timestamptz not null default now()
);
```

### profiles

```sql
create table profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null,
  role                 text not null default 'leader'
                         check (role in ('leader','pastor_sede','admin_casa','studio_admin','super_admin')),
  ministry_id          uuid references ministries(id),
  calendar_feed_token  uuid not null unique default gen_random_uuid(),
  slack_user_id        text,        -- formato U0123ABCD; nullable; permite DMs de notificación
  created_at           timestamptz not null default now()
);
```

`calendar_feed_token` es el secreto que protege el feed de suscripción. Es revocable: si se filtra, se genera otro y el viejo deja de servir. La columna es `unique` tanto por integridad como para que la búsqueda por token sea un index lookup.

`slack_user_id` se llena cuando el usuario conecta su cuenta de Slack desde su perfil. Si está vacío, las notificaciones por DM se saltan y solo se publica en el canal staff. Ver `04-funcionalidades.md`.

### Enlace de ministries.lead_user_id

Con `profiles` ya creada, completamos la FK que quedó pendiente:

```sql
alter table ministries
  add constraint ministries_lead_user_id_fkey
  foreign key (lead_user_id) references profiles(id);
```

### bookings

```sql
create table bookings (
  id                       uuid primary key default gen_random_uuid(),
  space_id                 uuid not null references spaces(id),
  owner_org_id             uuid not null references organizations(id),
  created_by               uuid not null references profiles(id),
  ministry_id              uuid references ministries(id),
  title                    text,
  use_type                 text not null
                             check (use_type in (
                               'reunion_departamento','reunion_ministerio',
                               'consejeria','discipulado','evento',
                               'externo','studio_negocio','otro')),
  visibility               text not null default 'full'
                             check (visibility in ('full','limited','private_label')),
  starts_at                timestamptz not null,
  ends_at                  timestamptz not null,
  time_range               tstzrange,        -- lo llena el trigger incluyendo buffers del espacio
  status                   text not null default 'requested'
                             check (status in ('requested','approved','rejected','cancelled')),
  shared_occupancy_allowed boolean not null default false,
  montaje_lock             boolean not null default false,
  expected_attendance      int,
  requirements             jsonb not null default '{}'::jsonb,
  payment_status           text not null default 'not_applicable'
                             check (payment_status in ('not_applicable','pending','paid')),
  payment_marked_by        uuid references profiles(id),
  payment_receipt_url      text,
  recurrence_rule          text,             -- RRULE en formato iCal, solo en la plantilla
  is_recurrence_template   boolean not null default false,
  parent_booking_id        uuid references bookings(id) on delete cascade,
  internal_notes           text,             -- solo pastores y administradores
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (ends_at > starts_at)
);
```

Sobre algunos campos:

- **visibility**: `full` reserva normal de RSG con detalle; `limited` muestra solo ministerio y franja; `private_label` es la reserva de negocio del Estudio que afuera solo dice "Reserva Studio Prado".
- **shared_occupancy_allowed**: marca que esta reserva puede convivir con otra en el mismo espacio (caso Estudio).
- **montaje_lock**: hay un montaje previo que no se puede mover, aunque el espacio se pueda usar para reuniones. Se marca al reservar.
- **requirements**: objeto JSON, por ejemplo `{ "sillas": 30, "mesas": 4, "hidratacion": true, "sonido": true, "proyeccion": false, "notas": "" }`.
- **recurrence_rule**, **is_recurrence_template**, **parent_booking_id**: la plantilla vive en una fila con `is_recurrence_template = true` y `recurrence_rule` definido; las instancias son filas hijas con `parent_booking_id` apuntando a la plantilla y `is_recurrence_template = false`. La plantilla nunca entra a la exclusion constraint; las instancias sí. Las excepciones (cancelar una semana, mover una hora) se editan sobre la instancia hija.

### Prevención de dobles reservas

```sql
alter table bookings add constraint bookings_no_overlap
exclude using gist (
  space_id with =,
  time_range with &&
) where (
  status in ('requested','approved')
  and shared_occupancy_allowed = false
  and is_recurrence_template = false
);
```

Esto impide a nivel de base que dos reservas activas se solapen en el mismo espacio. La condición `shared_occupancy_allowed = false` deja pasar la convivencia del Estudio. La exclusión de plantillas evita que una serie recurrente "ocupe" la franja sin haberse materializado: la realidad la marcan las instancias hijas.

Los buffers de montaje y desmontaje **se incluyen en `time_range`** vía trigger (ver más abajo), así que la constraint los aplica sin que el cliente tenga que sumarlos.

### booking_audit

```sql
create table booking_audit (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  actor_id    uuid references profiles(id),
  action      text not null,   -- created, approved, rejected, cancelled, updated, payment_marked
  changes     jsonb,
  created_at  timestamptz not null default now()
);
```

### Triggers

#### updated_at

```sql
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bookings_updated_at
before update on bookings
for each row execute function set_updated_at();
```

#### time_range con buffers

`time_range` no es columna generada porque necesita consultar `spaces` para los buffers. Un trigger lo recalcula en cada INSERT o UPDATE relevante:

```sql
create or replace function set_booking_time_range()
returns trigger as $$
declare
  setup_min int := 0;
  teardown_min int := 0;
begin
  select coalesce(setup_buffer_minutes, 0), coalesce(teardown_buffer_minutes, 0)
    into setup_min, teardown_min
    from spaces where id = new.space_id;
  new.time_range := tstzrange(
    new.starts_at - make_interval(mins => setup_min),
    new.ends_at + make_interval(mins => teardown_min),
    '[)'
  );
  return new;
end;
$$ language plpgsql;

create trigger bookings_time_range
before insert or update of starts_at, ends_at, space_id on bookings
for each row execute function set_booking_time_range();
```

Así los buffers son parte de la verdad que ve la exclusion constraint, no validación de cliente.

#### Auto-creación de profiles al registrarse

Cuando alguien se registra vía Supabase Auth, se inserta su fila en `profiles` con rol `leader` por defecto. El staff asigna el rol real después desde el panel.

```sql
create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'leader'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_auth_user();
```

#### Bitácora automática

Cada INSERT o UPDATE sobre `bookings` deja registro en `booking_audit`. El actor es `auth.uid()`.

```sql
create or replace function log_booking_changes()
returns trigger as $$
declare
  action_label text;
begin
  if tg_op = 'INSERT' then
    action_label := 'created';
  elsif new.status is distinct from old.status then
    action_label := 'status_' || new.status;
  elsif new.payment_status is distinct from old.payment_status then
    action_label := 'payment_' || new.payment_status;
  else
    action_label := 'updated';
  end if;

  insert into booking_audit (booking_id, actor_id, action, changes)
  values (
    new.id,
    auth.uid(),
    action_label,
    case
      when tg_op = 'INSERT' then to_jsonb(new)
      else jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
    end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger bookings_audit
after insert or update on bookings
for each row execute function log_booking_changes();
```

## Datos semilla

```sql
insert into organizations (name, type) values
  ('RSG', 'church'),
  ('Studio Prado', 'external');

insert into spaces (name, slug, status, booking_policy, allows_shared_occupancy)
values
  ('Auditorio', 'auditorio', 'active', 'needs_approval', false),
  ('Lobby', 'lobby', 'active', 'self_serve', false),
  ('Salón 38', 'salon-38', 'active', 'self_serve', false),
  ('Salón 45', 'salon-45', 'disabled', 'needs_approval', false),
  ('Estudio', 'estudio', 'external', 'needs_approval', true);
```

Los ministerios y departamentos se cargan según la estructura real de RSG.

## Borrado físico prohibido

`bookings` no se borra: se cancela con `status = 'cancelled'`. No definimos política de DELETE, así que el motor lo rechaza por RLS. Esto preserva la bitácora y los reportes históricos.

## Vistas para visibilidad por columna

Postgres RLS controla filas, no columnas. Para evitar que un cliente con anon key consulte `bookings` directamente y reciba `internal_notes`, requerimientos o el detalle del Estudio, **se revoca SELECT sobre `bookings` para `anon` y `authenticated`** y todo el acceso pasa por dos vistas: `bookings_calendar` (pública, columnas seguras) y `bookings_staff` (filtrada por RLS para pastores y admin). El detalle está en `03-roles-y-visibilidad.md`.
