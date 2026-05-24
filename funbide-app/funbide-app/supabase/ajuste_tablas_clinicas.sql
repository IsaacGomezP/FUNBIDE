-- Ajuste de pacientes para generar turnos y reutilizar historial
alter table public.pacientes
  add column if not exists telefono text null,
  add column if not exists correo text null,
  add column if not exists fecha_nacimiento date null;

-- Expedientes médicos
-- Asegura que el estado inicial usado por el servicio exista en la tabla
alter table public.expedientes_medicos
  alter column estado set default 'borrador';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expedientes_medicos_estado_check'
  ) then
    alter table public.expedientes_medicos
      add constraint expedientes_medicos_estado_check
      check (estado in ('borrador', 'en_proceso', 'completado', 'enviado', 'archivado'));
  end if;
exception
  when duplicate_object then null;
end $$;

-- Expedientes de laboratorio
alter table public.expedientes_laboratorio
  alter column estado set default 'pendiente';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expedientes_laboratorio_estado_check'
  ) then
    alter table public.expedientes_laboratorio
      add constraint expedientes_laboratorio_estado_check
      check (estado in ('pendiente', 'en_proceso', 'completado', 'enviado', 'cerrado'));
  end if;
exception
  when duplicate_object then null;
end $$;

-- Resultados y archivos ya coinciden con el servicio:
-- resultados_laboratorio:
-- expediente_id, analisis, valor, unidad, rango_referencia, observacion, orden
-- archivos_laboratorio:
-- expediente_id, tipo_archivo, nombre_archivo, url, mime_type, tamano_bytes, creado_por

