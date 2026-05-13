# FUNBIDE App

Aplicación web en Angular para la gestión de turnos, caja, medicina, farmacia y pantalla TV de llamados.

El sistema está organizado por módulos y usa Supabase como backend principal para almacenar y consultar los datos reales.

## Stack Tecnológico

- Angular 21
- TypeScript
- RxJS
- Angular Forms
- Supabase
- Font Awesome
- xlsx
- Vitest

## Estructura de Directorios

```text
funbide-app/
├── angular.json
├── package.json
├── README.md
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.spec.json
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
│       │   └── supabase.config.ts
│       ├── services/
│       │   ├── supabase.service.ts
│       │   ├── supabase.ts
│       │   ├── auth.service.ts
│       │   ├── auth.ts
│       │   ├── turnos-db.service.ts
│       │   ├── servicios-precios-db.service.ts
│       │   ├── cobros-db.service.ts
│       │   ├── pacientes-db.service.ts
│       │   ├── farmacia-db.service.ts
│       │   └── farmacia-storage.service.ts
│       └── components/
│           ├── login-screen/
│           ├── dashboard/
│           ├── modulo-generarTurno/
│           ├── modulo-caja/
│           ├── modulo-medicina/
│           ├── modulo-farmacia/
│           └── tv/
├── public/
│   ├── favicon.ico
│   ├── FUNBIDE LOGO.png
│   └── tv/
│       ├── index.html
│       ├── css/tv.css
│       └── js/tv.js
└── supabase/
    └── seed_servicios_precios.sql
```

## Arquitectura Funcional

### 1. Autenticación

Responsable del inicio de sesión y validación de usuarios.

Archivos:

- `src/app/services/auth.service.ts`
- `src/app/services/auth.ts`
- `src/app/components/login-screen/`

### 2. Dashboard

Pantalla principal de navegación y resumen.

Archivos:

- `src/app/components/dashboard/dashboard.ts`
- `src/app/components/dashboard/dashboard.html`
- `src/app/components/dashboard/dashboard.css`

### 3. Generación de Turnos

Emite el turno inicial del paciente.

Archivos:

- `src/app/components/modulo-generarTurno/modulo-generarTurno.ts`
- `src/app/components/modulo-generarTurno/modulo-generarTurno.html`
- `src/app/components/modulo-generarTurno/modulo-generarTurno.css`

### 4. Módulo de Caja

Gestiona:

- cola de tickets
- llamado a caja
- cobro
- comprobante
- envío al médico
- control de pagos duplicados

Archivos:

- `src/app/components/modulo-caja/modulo-caja.ts`
- `src/app/components/modulo-caja/modulo-caja.html`
- `src/app/components/modulo-caja/modulo-caja.css`

### 5. Módulo Médico

Pantalla de atención médica.

Archivos:

- `src/app/components/modulo-medicina/modulo-medicina.ts`
- `src/app/components/modulo-medicina/modulo-medicina.html`
- `src/app/components/modulo-medicina/modulo-medicina.css`

### 6. Módulo Farmacia

Gestión de productos e inventario.

Archivos:

- `src/app/components/modulo-farmacia/modulo-farmacia.ts`
- `src/app/components/modulo-farmacia/modulo-farmacia.html`
- `src/app/components/modulo-farmacia/modulo-farmacia.css`

### 7. Pantalla TV

Pantalla pública para mostrar turnos llamados.

Archivos:

- `public/tv/index.html`
- `public/tv/css/tv.css`
- `public/tv/js/tv.js`
- `src/app/components/tv/index.html`
- `src/app/components/tv/css/tv.css`
- `src/app/components/tv/js/tv.js`

## Servicios de Datos

### SupabaseService

Archivo:

- `src/app/services/supabase.service.ts`

Responsable de crear y exponer el cliente Supabase.

### TurnosDbService

Archivo:

- `src/app/services/turnos-db.service.ts`

Funciones principales:

- crear turnos
- listar turnos en espera
- listar turnos activos
- actualizar estado del turno

### ServiciosPreciosDbService

Archivo:

- `src/app/services/servicios-precios-db.service.ts`

Funciones principales:

- listar servicios activos
- consultar catálogo de precios y áreas

### CobrosDbService

Archivo:

- `src/app/services/cobros-db.service.ts`

Funciones principales:

- crear cobros
- buscar cobros por turno
- evitar cobros duplicados

### PacientesDbService

Archivo:

- `src/app/services/pacientes-db.service.ts`

Funciones principales:

- buscar paciente por cédula usando turnos previos

### FarmaciaDbService

Archivo:

- `src/app/services/farmacia-db.service.ts`

Funciones principales:

- listar productos
- crear productos
- actualizar productos
- eliminar productos

## Modelo de Datos

### Tabla `turnos`

Usada para gestionar la cola y el estado del paciente.

Campos observados:

- `id`
- `codigo`
- `prefijo`
- `numero`
- `servicio_id`
- `servicio_nombre`
- `categoria`
- `paciente_cedula`
- `paciente_nombre`
- `paciente_edad`
- `paciente_fecha_nacimiento`
- `estado`
- `puesto_atencion`
- `fecha_creado`
- `fecha_llamado`
- `fecha_atencion`

Estados:

- `espera`
- `llamando`
- `atendiendo`
- `finalizado`
- `cancelado`

### Tabla `cobros`

Usada para registrar el pago del ticket.

Campos observados:

- `id`
- `turno_id`
- `codigo_ticket`
- `paciente_nombre`
- `paciente_cedula`
- `servicio_nombre`
- `servicio_id`
- `monto_servicio`
- `metodo_pago`
- `monto_recibido`
- `cambio`
- `referencia_pago`
- `seguro_nombre`
- `seguro_numero`
- `area_destino`
- `estado`
- `cajero`
- `created_at`
- `updated_at`

Estados:

- `pendiente`
- `pagado`
- `rechazado`

### Tabla `servicios_precios`

Catálogo de servicios y precios.

Campos observados:

- `id`
- `codigo`
- `nombre`
- `area_destino`
- `categoria`
- `precio`
- `activo`
- `created_at`
- `updated_at`

### Tabla `productos_farmacia`

Inventario de farmacia.

Campos observados:

- `id`
- `nombre`
- `categoria`
- `laboratorio`
- `precio`
- `stock`
- `stock_minimo`
- `unidad`
- `codigo_barras`
- `fecha_vencimiento`
- `imagen_base64`
- `created_at`

### Tabla `usuarios`

Usada para autenticación.

Campos observados:

- `id`
- `username`
- `email`
- `nombre_completo`
- `rol`
- `activo`
- `password`

## Tabla Recomendada: `expedientes`

Esta tabla todavía conviene agregarla para cerrar el flujo clínico entre caja y medicina.

Propósito:

- guardar el expediente generado después del cobro
- asignar médico exacto
- pasar la atención al módulo médico
- registrar evolución y estado final

Campos sugeridos:

- `id`
- `turno_id`
- `cobro_id`
- `codigo_ticket`
- `paciente_nombre`
- `paciente_cedula`
- `servicio_nombre`
- `servicio_id`
- `medico_destino`
- `area_destino`
- `observaciones`
- `estado`
- `creado_por`
- `atendido_por`
- `fecha_enviado`
- `fecha_atendido`
- `created_at`
- `updated_at`

Estados sugeridos:

- `pendiente`
- `enviado`
- `atendido`
- `cancelado`

## Flujo de Atención

1. Se genera el turno.
2. El paciente espera en TV.
3. Caja llama el turno.
4. El paciente pasa a caja.
5. Se cobra el servicio real.
6. Se emite comprobante.
7. Se crea el expediente.
8. Caja asigna el médico exacto.
9. El expediente llega al módulo médico.
10. El médico atiende y completa el expediente.
11. El turno deja de mostrarse en TV una vez cobrado.

## Flujo de Visibilidad en TV

La TV debe mostrar únicamente turnos en estado `llamando`.

No debe mostrar:

- `atendiendo`
- `pagado`
- destino real del paciente

Texto recomendado:

- `Turno PS-001. Favor pasar a atención.`

## Archivos de Entrada

- `src/main.ts`
- `src/index.html`
- `src/styles.css`
- `src/app/app.ts`
- `src/app/app.html`
- `src/app/app.css`
- `src/app/app.config.ts`

## Recursos Públicos

- `public/FUNBIDE LOGO.png`
- `public/tv/`
- `public/favicon.ico`

## Seed de Base de Datos

Archivo:

- `supabase/seed_servicios_precios.sql`

Este archivo contiene la carga inicial del catálogo de servicios y precios.

## Notas Finales

- El módulo de caja ya está conectado a datos reales de Supabase.
- El módulo de medicina todavía debe integrarse por completo con expedientes reales.
- La TV ya está pensada para privacidad del paciente.
- La tabla `expedientes` es el siguiente paso lógico para cerrar el flujo clínico.
