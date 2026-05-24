# FUNBIDE App

Sistema web desarrollado en Angular para la gestión integral de operaciones clínicas y administrativas, incluyendo generación de turnos, caja, atención médica, laboratorio, farmacia, reportes, supervisión, mantenimiento y pantalla TV de llamados.

La solución está conectada a Supabase como backend principal para autenticación, almacenamiento y consulta de datos operativos.

## Propósito del proyecto

Este sistema fue diseñado para centralizar el flujo de atención de una institución, reduciendo tiempos manuales, mejorando el control de pacientes, asegurando trazabilidad de cobros y permitiendo una operación más ordenada entre las distintas áreas.

## Alcance funcional

El proyecto incluye los siguientes componentes:

- Autenticación y control de acceso por rol.
- Dashboard principal de navegación.
- Módulo de generación de turnos.
- Módulo de caja y cobro.
- Módulo médico.
- Módulo de laboratorio.
- Módulo de farmacia.
- Módulo de reportes.
- Módulo de supervisión.
- Módulo de mantenimiento.
- Pantalla pública de turnos en TV.

## Módulos del sistema

### 1. Autenticación

Permite el inicio de sesión de usuarios y la validación de credenciales, con persistencia de sesión y carga de módulos según el rol asignado.

### 2. Dashboard

Pantalla central desde la cual el usuario accede a los módulos permitidos según su perfil.

### 3. Generación de Turnos

Módulo para registrar pacientes y emitir turnos de atención, organizando la fila de trabajo desde el primer punto de contacto.

### 4. Caja

Gestiona la recepción del turno, el proceso de cobro, la validación de pagos y el envío del paciente al área correspondiente.

### 5. Medicina

Área destinada a la atención clínica, consulta de pacientes y seguimiento del proceso de atención.

### 6. Laboratorio

Módulo orientado al control de análisis clínicos, gestión de resultados y seguimiento operativo de pruebas.

### 7. Farmacia

Permite administrar inventario, productos, existencias y movimientos relacionados con la dispensación de medicamentos.

### 8. Reportes

Espacio para consultar información consolidada, métricas y análisis operativos del sistema.

### 9. Supervisión

Módulo para monitoreo general de la operación, seguimiento del personal y control del flujo de trabajo.

### 10. Mantenimiento

Sección para administración del sistema, usuarios, roles y parámetros internos de operación.

### 11. Pantalla TV

Pantalla pública para mostrar turnos llamados y facilitar la visualización del flujo de atención sin exponer información sensible.

## Roles de usuario

El sistema contempla control de acceso por perfil, permitiendo mostrar únicamente los módulos autorizados para cada usuario.

Roles identificados en el proyecto:

- Administrador
- Cajero
- Farmacia
- Médico
- Medicina General
- Psicología
- Laboratorio
- Reportes
- Supervisión
- Mantenimiento

## Arquitectura tecnológica

- Angular 21
- TypeScript
- RxJS
- Angular Forms
- Supabase
- Font Awesome
- xlsx
- Vitest

## Estructura general del proyecto

```text
funbide-app/
├── angular.json
├── package.json
├── README.md
├── src/
│   ├── main.ts
│   ├── index.html
│   ├── styles.css
│   └── app/
│       ├── app.ts
│       ├── app.html
│       ├── app.css
│       ├── app.config.ts
│       ├── config/
│       ├── services/
│       └── components/
├── public/
│   ├── FUNBIDE LOGO.png
│   └── tv/
└── supabase/
```

## Componentes principales

### Componentes de interfaz

- `login-screen`
- `dashboard`
- `modulo-generarTurno`
- `modulo-caja`
- `modulo-medicina`
- `modulo-laboratorio`
- `modulo-farmacia`
- `modulo-reportes`
- `modulo-supervision`
- `modulo-mantenimiento`
- `tv`

### Servicios de aplicación

- `supabase.service.ts`
- `supabase.ts`
- `auth.service.ts`
- `auth.ts`
- `turnos-db.service.ts`
- `servicios-precios-db.service.ts`
- `cobros-db.service.ts`
- `pacientes-db.service.ts`
- `farmacia-db.service.ts`
- `farmacia-storage.service.ts`
- `expedientes-medicos-db.service.ts`
- `expedientes-laboratorio-db.service.ts`

## Base de datos y persistencia

El proyecto trabaja con Supabase y utiliza tablas y scripts de soporte para la operación del sistema.

### Entidades principales

- `usuarios`
- `turnos`
- `cobros`
- `servicios_precios`
- `productos_farmacia`
- `pacientes`
- `expedientes`

### Scripts incluidos

- `supabase/seed_usuarios.sql`
- `supabase/seed_servicios_precios.sql`
- `supabase/policies_usuarios.sql`
- `supabase/pacientes.sql`
- `supabase/pacientes_alter_add_contacto.sql`
- `supabase/expedientes_laboratorio.sql`
- `supabase/ajuste_tablas_clinicas.sql`

## Flujo operativo general

1. El usuario inicia sesión según su rol.
2. El sistema muestra únicamente los módulos autorizados.
3. Se genera el turno del paciente.
4. El turno aparece en la pantalla TV.
5. Caja llama y procesa el pago.
6. El sistema registra el cobro y la trazabilidad del servicio.
7. El paciente es enviado al área correspondiente.
8. Medicina, laboratorio o farmacia continúan la atención según corresponda.
9. Supervisión y reportes permiten seguimiento de la operación.
10. Mantenimiento administra usuarios, permisos y ajustes internos.

## Control de acceso

La aplicación implementa visibilidad de módulos por perfil, con reglas que limitan el acceso a las funciones según el rol del usuario autenticado.

## Pantalla pública TV

La pantalla TV está orientada a anunciar llamados de turnos de forma clara y visible, apoyando la atención al público sin exponer datos innecesarios.

## Archivos relevantes de entrada

- `src/main.ts`
- `src/index.html`
- `src/styles.css`
- `src/app/app.ts`
- `src/app/app.html`
- `src/app/app.css`
- `src/app/app.config.ts`

## Valor del proyecto

Este sistema representa una solución administrativa y clínica integral que permite:

- orden en la gestión de pacientes
- mejor control de caja
- trazabilidad de cobros
- apoyo a consulta médica
- control de inventario en farmacia
- seguimiento operativo mediante reportes y supervisión
- centralización de procesos en una sola plataforma

## Observación

El proyecto fue estructurado para crecer por módulos, permitiendo incorporar nuevas funcionalidades sin alterar la base principal de operación.
