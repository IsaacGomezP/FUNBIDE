insert into public.usuarios (id, username, email, password, nombre_completo, rol, activo, created_at) values
(1, 'admin', 'admin@funbide.com', 'coki2810*', 'Administrador del Sistema', 'Administrador', true, now()),
(2, 'juanpg', 'juanpg@funbide.com', 'coki2810*', 'Juan Pérez', 'Cajero', true, now()),
(3, 'drcarlos', 'drcarlos@funbide.com', 'coki2810*', 'Dr. Carlos Fernández', 'Medico', true, now()),
(4, 'ana.farmacia', 'ana.farmacia@funbide.com', 'coki2810*', 'Ana Martínez', 'Farmacia', true, now())
on conflict (id) do update set
  username = excluded.username,
  email = excluded.email,
  password = excluded.password,
  nombre_completo = excluded.nombre_completo,
  rol = excluded.rol,
  activo = excluded.activo,
  created_at = excluded.created_at;

