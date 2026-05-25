alter table if exists public.servicios_precios
  add column if not exists precio_subsidiado numeric(12,2) null,
  add column if not exists precio_contributivo numeric(12,2) null,
  add column if not exists precio_renacer numeric(12,2) null,
  add column if not exists aplica_seguro boolean not null default false;

update public.servicios_precios
set
  precio_subsidiado = coalesce(precio_subsidiado, precio),
  precio_contributivo = coalesce(precio_contributivo, precio),
  precio_renacer = coalesce(precio_renacer, precio)
where precio_subsidiado is null or precio_contributivo is null or precio_renacer is null;

alter table if exists public.cuadres_caja
  add column if not exists total_senasa_subsidiado numeric(12,2) not null default 0,
  add column if not exists total_senasa_contributivo numeric(12,2) not null default 0,
  add column if not exists total_renacer numeric(12,2) not null default 0,
  add column if not exists total_pendiente_renacer numeric(12,2) not null default 0;

create table if not exists public.cuadres_caja (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  total_turnos integer not null default 0,
  total_cobros integer not null default 0,
  total_efectivo numeric(12,2) not null default 0,
  total_tarjeta numeric(12,2) not null default 0,
  total_transferencia numeric(12,2) not null default 0,
  total_senasa numeric(12,2) not null default 0,
  total_senasa_subsidiado numeric(12,2) not null default 0,
  total_senasa_contributivo numeric(12,2) not null default 0,
  total_renacer numeric(12,2) not null default 0,
  total_pendiente_senasa numeric(12,2) not null default 0,
  total_pendiente_renacer numeric(12,2) not null default 0,
  jornada_cerrada boolean not null default false,
  hora_cierre timestamptz null,
  observaciones text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cuadres_caja_fecha on public.cuadres_caja (fecha desc);
