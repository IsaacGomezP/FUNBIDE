alter table public.pacientes
add column if not exists telefono text null,
add column if not exists correo text null,
add column if not exists fecha_nacimiento date null;
