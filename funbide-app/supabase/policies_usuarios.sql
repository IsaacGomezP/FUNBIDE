alter table if exists public.usuarios enable row level security;

drop policy if exists "usuarios_select_authenticated" on public.usuarios;
create policy "usuarios_select_authenticated"
on public.usuarios
for select
to anon, authenticated
using (true);

drop policy if exists "usuarios_insert_authenticated" on public.usuarios;
create policy "usuarios_insert_authenticated"
on public.usuarios
for insert
to anon, authenticated
with check (true);

drop policy if exists "usuarios_update_authenticated" on public.usuarios;
create policy "usuarios_update_authenticated"
on public.usuarios
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "usuarios_delete_authenticated" on public.usuarios;
create policy "usuarios_delete_authenticated"
on public.usuarios
for delete
to anon, authenticated
using (true);
