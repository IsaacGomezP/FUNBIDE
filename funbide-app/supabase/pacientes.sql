create table public.pacientes (
  id uuid not null default gen_random_uuid (),
  cedula text not null,
  nombre text not null,
  edad integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  telefono text null,
  correo text null,
  fecha_nacimiento date null,
  constraint pacientes_pkey primary key (id),
  constraint pacientes_cedula_key unique (cedula)
) TABLESPACE pg_default;

create index if not exists idx_pacientes_cedula on public.pacientes using btree (cedula) TABLESPACE pg_default;

create index if not exists idx_pacientes_nombre on public.pacientes using btree (nombre) TABLESPACE pg_default;

alter table public.pacientes enable row level security;

grant select, insert, update, delete on public.pacientes to anon;
grant select, insert, update, delete on public.pacientes to authenticated;

drop policy if exists "pacientes_select_public" on public.pacientes;
drop policy if exists "pacientes_insert_public" on public.pacientes;
drop policy if exists "pacientes_update_public" on public.pacientes;

create policy "pacientes_select_public"
on public.pacientes
for select
to anon, authenticated
using (true);

create policy "pacientes_insert_public"
on public.pacientes
for insert
to anon, authenticated
with check (true);

create policy "pacientes_update_public"
on public.pacientes
for update
to anon, authenticated
using (true)
with check (true);
