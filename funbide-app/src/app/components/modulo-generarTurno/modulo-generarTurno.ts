import { Component, EventEmitter, Input, Output, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TurnosDbService } from '../../services/turnos-db.service';
import { PacientesDbService } from '../../services/pacientes-db.service';

interface ServicioTurno {
  id: string;
  nombre: string;
  categoria: string;
  prefijo: string;
  icono: string;
  descripcion: string;
}

interface TicketGenerado {
  numero: number;
  prefijo: string;
  codigo: string;
  servicio: string;
  categoria: string;
  pacienteNombre: string;
  pacienteCedula: string;
  pacienteEdad: number;
  pacienteFechaNacimiento: string;
  pacienteTelefono: string;
  pacienteCorreo: string;
  fecha: Date;
}

@Component({
  selector: 'app-modulo-generar-turno',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modulo-generarTurno.html',
  styleUrls: ['./modulo-generarTurno.css']
})
export class ModuloGenerarTurnoComponent {
  @Output() back = new EventEmitter<void>();
  @Input() usuarioNombre = 'Ana Rodríguez';
  @Input() usuarioRol = 'Cajero / Recepción';

  currentDate = new Date();

  pacienteCedula = '';
  pacienteNombre = '';
  pacienteEdad: number | null = null;
  pacienteFechaNacimiento = '';
  pacienteTelefono = '';
  pacienteCorreo = '';
  esPacienteRecurrente = false;
  servicioSeleccionadoId = '';
  ticketGenerado: TicketGenerado | null = null;
  isSavingTurno = false;
  showSuccessPulse = false;
  isSearchingPaciente = false;
  notificationMessage = '';
  notificationType: 'success' | 'info' | 'warning' | 'danger' | '' = '';
  private notificationTimer: any;

  servicios: ServicioTurno[] = [
    { id: 'psicologia', nombre: 'Psicología', categoria: 'Consulta', prefijo: 'PS', icono: 'fa-brain', descripcion: 'Apoyo emocional y evaluación' },
    { id: 'medicina', nombre: 'Medicina General', categoria: 'Consulta', prefijo: 'MG', icono: 'fa-stethoscope', descripcion: 'Consulta médica general' },
    { id: 'sonografia', nombre: 'Sonografía', categoria: 'Imagen', prefijo: 'SO', icono: 'fa-wave-square', descripcion: 'Estudios de imagen' },
    { id: 'laboratorio', nombre: 'Laboratorio', categoria: 'Apoyo', prefijo: 'LA', icono: 'fa-vial', descripcion: 'Toma y análisis de muestras' },
    { id: 'procedimientos', nombre: 'Procedimientos', categoria: 'Apoyo', prefijo: 'PR', icono: 'fa-notes-medical', descripcion: 'Atenciones y procedimientos' },
    { id: 'terapias', nombre: 'Terapias', categoria: 'Rehabilitación', prefijo: 'TE', icono: 'fa-person-walking', descripcion: 'Sesiones terapéuticas' }
  ];

  constructor(
    private turnosDbService: TurnosDbService,
    private pacientesDbService: PacientesDbService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  get servicioSeleccionado(): ServicioTurno | null {
    return this.servicios.find((servicio) => servicio.id === this.servicioSeleccionadoId) || null;
  }

  async onCedulaBlur() {
    const cedula = this.pacienteCedula.trim().replace(/\s+/g, '');
    if (!cedula) return;

    this.isSearchingPaciente = true;
    this.cdr.detectChanges();

    try {
      const paciente = await this.pacientesDbService.buscarPorCedula(cedula);
      this.ngZone.run(() => {
        if (paciente) {
          this.pacienteNombre = paciente.nombre || this.pacienteNombre;
          this.pacienteEdad = paciente.edad ?? this.pacienteEdad;
          this.pacienteFechaNacimiento = paciente.fechaNacimiento || '';
          this.pacienteTelefono = paciente.telefono || this.pacienteTelefono;
          this.pacienteCorreo = paciente.correo || this.pacienteCorreo;
          this.esPacienteRecurrente = true;
          this.showNotification('info', 'Paciente recurrente', 'Se cargó la edad desde el historial y no es necesario pedir la fecha de nacimiento.');
        } else {
          this.pacienteEdad = null;
          this.pacienteFechaNacimiento = '';
          this.pacienteTelefono = '';
          this.pacienteCorreo = '';
          this.esPacienteRecurrente = false;
          this.showNotification('warning', 'Paciente nuevo', 'Completa la fecha de nacimiento para calcular la edad.');
        }
        this.isSearchingPaciente = false;
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('Error buscando paciente:', error);
      this.ngZone.run(() => {
        this.showNotification('danger', 'Error de búsqueda', 'No se pudo consultar la base de datos de pacientes.');
        this.isSearchingPaciente = false;
        this.cdr.detectChanges();
      });
    }
  }

  async generarTicket() {
    if (!this.pacienteCedula.trim()) {
      this.showNotification('warning', 'Campo requerido', 'Ingrese la cédula del paciente');
      return;
    }
    if (!this.pacienteNombre.trim()) {
      this.showNotification('warning', 'Campo requerido', 'Ingrese el nombre del paciente');
      return;
    }
    if (!this.pacienteTelefono.trim() && !this.pacienteCorreo.trim()) {
      this.showNotification('warning', 'Contacto requerido', 'Ingrese al menos un teléfono o un correo');
      return;
    }
    if (!this.esPacienteRecurrente && !this.pacienteFechaNacimiento) {
      this.showNotification('warning', 'Campo requerido', 'Ingrese la fecha de nacimiento del paciente');
      return;
    }
    if (!this.servicioSeleccionado) {
      this.showNotification('warning', 'Campo requerido', 'Seleccione un servicio');
      return;
    }

    const servicio = this.servicioSeleccionado;

    this.ngZone.run(() => {
      this.isSavingTurno = true;
      this.showNotification('info', 'Procesando', 'Generando turno, espere un momento...');
      this.cdr.detectChanges();
    });

    try {
      await this.delay(100);

      const siguienteNumero = await this.turnosDbService.obtenerUltimoNumero(servicio.prefijo);
      let edadCalculada: number | null = this.pacienteEdad;

      if (!this.esPacienteRecurrente) {
        edadCalculada = this.calcularEdadDesdeNacimiento(this.pacienteFechaNacimiento);
        if (edadCalculada === null) {
          this.showNotification('warning', 'Fecha inválida', 'Verifique la fecha de nacimiento ingresada');
          this.isSavingTurno = false;
          return;
        }
      }

      const nuevoTicket: TicketGenerado = {
        numero: siguienteNumero,
        prefijo: servicio.prefijo,
        codigo: `${servicio.prefijo}-${String(siguienteNumero).padStart(3, '0')}`,
        servicio: servicio.nombre,
        categoria: servicio.categoria,
        pacienteNombre: this.pacienteNombre.trim(),
        pacienteCedula: this.pacienteCedula.trim(),
        pacienteEdad: edadCalculada!,
        pacienteFechaNacimiento: this.pacienteFechaNacimiento,
        pacienteTelefono: this.pacienteTelefono.trim(),
        pacienteCorreo: this.pacienteCorreo.trim(),
        fecha: new Date()
      };

      await this.pacientesDbService.guardarPaciente({
        cedula: nuevoTicket.pacienteCedula,
        nombre: nuevoTicket.pacienteNombre,
        edad: nuevoTicket.pacienteEdad,
        telefono: nuevoTicket.pacienteTelefono || null,
        correo: nuevoTicket.pacienteCorreo || null,
        fechaNacimiento: nuevoTicket.pacienteFechaNacimiento || null
      });

      await this.turnosDbService.crearTurno({
        codigo: nuevoTicket.codigo,
        prefijo: nuevoTicket.prefijo,
        numero: nuevoTicket.numero,
        servicio_id: servicio.id,
        servicio_nombre: servicio.nombre,
        categoria: servicio.categoria,
        paciente_cedula: nuevoTicket.pacienteCedula,
        paciente_nombre: nuevoTicket.pacienteNombre,
        paciente_edad: nuevoTicket.pacienteEdad,
        paciente_fecha_nacimiento: nuevoTicket.pacienteFechaNacimiento || null,
        estado: 'espera',
        puesto_atencion: null
      });

      this.ngZone.run(() => {
        this.ticketGenerado = nuevoTicket;
        this.isSavingTurno = false;
        this.showNotification('success', 'Turno creado', `El ticket ${nuevoTicket.codigo} ya quedó registrado en la pantalla TV.`);
        this.showSuccessPulse = true;
        this.cdr.detectChanges();
      });

      setTimeout(() => {
        this.ngZone.run(() => {
          this.imprimirTicket();
        });
      }, 500);

      setTimeout(() => {
        this.ngZone.run(() => {
          this.showSuccessPulse = false;
          this.cdr.detectChanges();
        });
      }, 1400);
    } catch (error) {
      console.error('Error creando turno:', error);
      this.ngZone.run(() => {
        this.isSavingTurno = false;
        this.showNotification('danger', 'Error al generar', 'No se pudo registrar el turno. Intente nuevamente.');
        this.cdr.detectChanges();
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  limpiarFormulario() {
    this.ngZone.run(() => {
      this.pacienteCedula = '';
      this.pacienteNombre = '';
      this.pacienteEdad = null;
      this.pacienteFechaNacimiento = '';
      this.pacienteTelefono = '';
      this.pacienteCorreo = '';
      this.esPacienteRecurrente = false;
      this.servicioSeleccionadoId = '';
      this.ticketGenerado = null;
      this.cdr.detectChanges();
    });
  }

  calcularEdadDesdeNacimiento(fechaNacimiento: string): number | null {
    const nacimiento = new Date(fechaNacimiento);
    if (Number.isNaN(nacimiento.getTime())) return null;

    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }

    return edad >= 0 ? edad : null;
  }

  imprimirTicket() {
    if (!this.ticketGenerado) return;

    this.showNotification('info', 'Impresión', 'Se abrirá el cuadro de impresión para que elijas la impresora.');

    setTimeout(() => {
      const win = window.open('', '_blank');
      if (!win) return;

      const t = this.ticketGenerado!;
      win.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>Ticket ${t.codigo}</title>
            <style>
              *{margin:0;padding:0;box-sizing:border-box}
              @page{size:58mm auto;margin:0}
              body{font-family:Arial,sans-serif;padding:0;background:#fff}
              .ticket{width:58mm;max-width:58mm;margin:0 auto;text-align:center;padding:4mm 3mm}
              .brand{font-size:16px;font-weight:800;letter-spacing:1px;color:#000;margin-bottom:8px}
              .code{font-size:28px;font-weight:800;color:#000;line-height:1;margin:4px 0 10px}
              .name{font-size:12px;font-weight:700;color:#000;margin-bottom:6px;word-break:break-word}
              .service{font-size:11px;color:#222;margin-bottom:10px;word-break:break-word}
              .message{font-size:10px;font-weight:700;color:#000;border-top:1px solid #000;border-bottom:1px solid #000;padding:6px 0;margin-top:8px}
              .small{font-size:8px;color:#666;margin-top:8px}
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="brand">FUNBIDE</div>
              <div class="code">${t.codigo}</div>
              <div class="name">${t.pacienteNombre}</div>
              <div class="service">${t.servicio}</div>
              ${t.pacienteFechaNacimiento ? `<div class="small">Nac: ${t.pacienteFechaNacimiento}</div>` : ''}
              <div class="small">Edad: ${t.pacienteEdad} años</div>
              ${t.pacienteTelefono ? `<div class="small">Tel: ${t.pacienteTelefono}</div>` : ''}
              ${t.pacienteCorreo ? `<div class="small">Correo: ${t.pacienteCorreo}</div>` : ''}
              <div class="message">Por favor espere</div>
              <div class="small">${new Date().toLocaleString()}</div>
            </div>
            <script>window.print();setTimeout(()=>window.close(),500);<\/script>
          </body>
        </html>
      `);
      win.document.close();
    }, 300);
  }

  showNotification(type: 'success' | 'info' | 'warning' | 'danger', title: string, message: string) {
    this.ngZone.run(() => {
      this.notificationType = type;
      this.notificationMessage = `${title}: ${message}`;
      this.cdr.detectChanges();

      clearTimeout(this.notificationTimer);
      this.notificationTimer = setTimeout(() => {
        this.ngZone.run(() => {
          this.notificationMessage = '';
          this.notificationType = '';
          this.cdr.detectChanges();
        });
      }, 3500);
    });
  }

  volver() {
    this.back.emit();
  }
}
