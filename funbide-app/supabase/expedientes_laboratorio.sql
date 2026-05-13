create table if not exists public.expedientes_laboratorio (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  cobro_id uuid null references public.cobros(id) on delete set null,
  paciente_nombre text not null,
  paciente_cedula text not null,
  paciente_edad integer null,
  paciente_telefono text null,
  servicio_nombre text not null,
  servicio_id uuid null references public.servicios_precios(id),
  area_destino text not null default 'Laboratorio',
  motivo text null,
  observaciones text null,
  resultado_general text null,
  conclusion text null,
  correo_envio text null,
  whatsapp_envio text null,
  estado text not null default 'borrador' check (estado in ('borrador', 'en_proceso', 'completado', 'enviado', 'cerrado', 'cancelado')),
  enviado_por text null,
  completado_por text null,
  fecha_enviado timestamptz null,
  fecha_completado timestamptz null,
  archivo_pdf_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resultados_laboratorio (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes_laboratorio(id) on delete cascade,
  analisis text not null,
  valor text null,
  unidad text null,
  rango_referencia text null,
  observacion text null,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.archivos_laboratorio (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes_laboratorio(id) on delete cascade,
  tipo_archivo text not null default 'pdf' check (tipo_archivo in ('pdf', 'imagen', 'csv', 'otro')),
  nombre_archivo text not null,
  url text not null,
  mime_type text null,
  tamano_bytes bigint null,
  creado_por text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_expedientes_laboratorio_turno_id
  on public.expedientes_laboratorio(turno_id);

create index if not exists idx_expedientes_laboratorio_estado
  on public.expedientes_laboratorio(estado);

create index if not exists idx_expedientes_laboratorio_created_at
  on public.expedientes_laboratorio(created_at desc);

create index if not exists idx_resultados_laboratorio_expediente_id
  on public.resultados_laboratorio(expediente_id);

create index if not exists idx_archivos_laboratorio_expediente_id
  on public.archivos_laboratorio(expediente_id);

alter table public.expedientes_laboratorio enable row level security;
alter table public.resultados_laboratorio enable row level security;
alter table public.archivos_laboratorio enable row level security;

grant select, insert, update, delete on public.expedientes_laboratorio to anon;
grant select, insert, update, delete on public.expedientes_laboratorio to authenticated;
grant select, insert, update, delete on public.resultados_laboratorio to anon;
grant select, insert, update, delete on public.resultados_laboratorio to authenticated;
grant select, insert, update, delete on public.archivos_laboratorio to anon;
grant select, insert, update, delete on public.archivos_laboratorio to authenticated;

drop policy if exists "expedientes_laboratorio_select_public" on public.expedientes_laboratorio;
drop policy if exists "expedientes_laboratorio_insert_public" on public.expedientes_laboratorio;
drop policy if exists "expedientes_laboratorio_update_public" on public.expedientes_laboratorio;

create policy "expedientes_laboratorio_select_public"
on public.expedientes_laboratorio
for select
to anon, authenticated
using (true);

create policy "expedientes_laboratorio_insert_public"
on public.expedientes_laboratorio
for insert
to anon, authenticated
with check (true);

create policy "expedientes_laboratorio_update_public"
on public.expedientes_laboratorio
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "resultados_laboratorio_select_public" on public.resultados_laboratorio;
drop policy if exists "resultados_laboratorio_insert_public" on public.resultados_laboratorio;
drop policy if exists "resultados_laboratorio_update_public" on public.resultados_laboratorio;

create policy "resultados_laboratorio_select_public"
on public.resultados_laboratorio
for select
to anon, authenticated
using (true);

create policy "resultados_laboratorio_insert_public"
on public.resultados_laboratorio
for insert
to anon, authenticated
with check (true);

create policy "resultados_laboratorio_update_public"
on public.resultados_laboratorio
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "archivos_laboratorio_select_public" on public.archivos_laboratorio;
drop policy if exists "archivos_laboratorio_insert_public" on public.archivos_laboratorio;
drop policy if exists "archivos_laboratorio_update_public" on public.archivos_laboratorio;

create policy "archivos_laboratorio_select_public"
on public.archivos_laboratorio
for select
to anon, authenticated
using (true);

create policy "archivos_laboratorio_insert_public"
on public.archivos_laboratorio
for insert
to anon, authenticated
with check (true);

create policy "archivos_laboratorio_update_public"
on public.archivos_laboratorio
for update
to anon, authenticated
using (true)
with check (true);
