-- =====================================================================
-- RSG Reservas — bucket de comprobantes de pago
-- =====================================================================
-- Bucket privado para comprobantes de pago de reservas externas
-- (principalmente el Estudio). Solo staff (pastor_sede / admin_casa /
-- super_admin) puede subir, leer o borrar archivos.
--
-- Path convention: {booking_id}/receipt.{ext}. Un archivo por reserva;
-- al subir uno nuevo se sobrescribe vía upsert.

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

create policy "staff sube comprobantes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and current_role_is(array['pastor_sede','admin_casa','super_admin'])
  );

create policy "staff actualiza comprobantes"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and current_role_is(array['pastor_sede','admin_casa','super_admin'])
  )
  with check (
    bucket_id = 'payment-receipts'
    and current_role_is(array['pastor_sede','admin_casa','super_admin'])
  );

create policy "staff lee comprobantes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and current_role_is(array['pastor_sede','admin_casa','super_admin'])
  );

create policy "staff borra comprobantes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and current_role_is(array['pastor_sede','admin_casa','super_admin'])
  );
