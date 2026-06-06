alter table if exists public.servicios_precios
  add column if not exists precio_subsidiado numeric(12,2) null,
  add column if not exists precio_contributivo numeric(12,2) null,
  add column if not exists precio_renacer numeric(12,2) null,
  add column if not exists monto_ganancia_interna numeric(12,2) null default 0,
  add column if not exists requiere_aporte_efectivo boolean not null default false,
  add column if not exists monto_aporte_efectivo numeric(12,2) null,
  add column if not exists aplica_seguro boolean not null default false;

update public.servicios_precios
set
  precio_subsidiado = coalesce(precio_subsidiado, precio),
  precio_contributivo = coalesce(precio_contributivo, precio),
  precio_renacer = coalesce(precio_renacer, precio),
  monto_ganancia_interna = coalesce(monto_ganancia_interna, 0),
  requiere_aporte_efectivo = coalesce(requiere_aporte_efectivo, false)
where precio_subsidiado is null or precio_contributivo is null or precio_renacer is null or requiere_aporte_efectivo is null;

alter table if exists public.cobros
  add column if not exists monto_aporte_cliente numeric(12,2) null default 0;
alter table if exists public.cobros
  add column if not exists detalle_pagos jsonb not null default '[]'::jsonb;
alter table if exists public.cobros
  add column if not exists monto_ganancia_interna numeric(12,2) null default 0;

alter table if exists public.cuentas_por_cobrar
  add column if not exists monto_aporte_cliente numeric(12,2) not null default 0;

alter table if exists public.servicios_precios enable row level security;

grant select, insert, update, delete on public.servicios_precios to anon;
grant select, insert, update, delete on public.servicios_precios to authenticated;

drop policy if exists "servicios_precios_select_public" on public.servicios_precios;
drop policy if exists "servicios_precios_insert_public" on public.servicios_precios;
drop policy if exists "servicios_precios_update_public" on public.servicios_precios;
drop policy if exists "servicios_precios_delete_public" on public.servicios_precios;

create policy "servicios_precios_select_public"
on public.servicios_precios
for select
to anon, authenticated
using (true);

create policy "servicios_precios_insert_public"
on public.servicios_precios
for insert
to anon, authenticated
with check (true);

create policy "servicios_precios_update_public"
on public.servicios_precios
for update
to anon, authenticated
using (true)
with check (true);

create policy "servicios_precios_delete_public"
on public.servicios_precios
for delete
to anon, authenticated
using (true);

alter table if exists public.cuadres_caja
  add column if not exists total_senasa_subsidiado numeric(12,2) not null default 0,
  add column if not exists total_senasa_contributivo numeric(12,2) not null default 0,
  add column if not exists total_renacer numeric(12,2) not null default 0,
  add column if not exists total_aporte_cliente numeric(12,2) not null default 0,
  add column if not exists total_ganancia_interna numeric(12,2) not null default 0,
  add column if not exists total_ingresos_visibles numeric(12,2) not null default 0,
  add column if not exists total_ingresos_reales numeric(12,2) not null default 0,
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
  total_aporte_cliente numeric(12,2) not null default 0,
  total_ganancia_interna numeric(12,2) not null default 0,
  total_ingresos_visibles numeric(12,2) not null default 0,
  total_ingresos_reales numeric(12,2) not null default 0,
  total_pendiente_senasa numeric(12,2) not null default 0,
  total_pendiente_renacer numeric(12,2) not null default 0,
  jornada_cerrada boolean not null default false,
  hora_cierre timestamptz null,
  observaciones text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cuadres_caja_fecha on public.cuadres_caja (fecha desc);
