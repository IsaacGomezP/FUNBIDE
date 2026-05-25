alter table if exists public.turnos
  add column if not exists fecha_cancelacion timestamptz null,
  add column if not exists motivo_cancelacion text null,
  add column if not exists cancelado_por text null;

create index if not exists idx_turnos_estado_fecha on public.turnos (estado, fecha_creado desc);
