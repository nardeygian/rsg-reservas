-- =====================================================================
-- Etapa 5 · Servir — archivar reuniones
-- =====================================================================
-- Pedido de Gian (1 nov): archivar (o borrar) varias reuniones a la vez.
-- Archivar no borra nada: la reunión sale de la lista de Reuniones y se ve
-- con el filtro "Archivadas", donde se puede restaurar. Archiva quien edita
-- reuniones (RLS "meetings: editar": servir.planear o servir.vivo).
-- Migración aditiva e idempotente.
-- =====================================================================

alter table public.meetings add column if not exists archived_at timestamptz;
create index if not exists meetings_archivadas_idx on public.meetings (meeting_date) where archived_at is not null;
