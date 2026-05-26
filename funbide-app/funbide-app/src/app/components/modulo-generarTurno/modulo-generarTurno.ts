import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TurnosDbService } from '../../services/turnos-db.service';
import { CuadreCajaDbService } from '../../services/cuadre-caja-db.service';
import { printHtmlInHiddenFrame } from '../../utils/print-html';

interface ServicioTurno {
  id: string;
  nombre: string;
  categoria: string;
  prefijo: string;
  icono: string;
  descripcion: string;
  tone: 'blue' | 'sky' | 'navy' | 'teal' | 'amber' | 'violet' | 'green';
}

interface TicketGenerado {
  numero: number;
  prefijo: string;
  codigo: string;
  servicio: string;
  categoria: string;
  fecha: Date;
}

@Component({
  selector: 'app-modulo-generar-turno',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modulo-generarTurno.html',
  styleUrls: ['./modulo-generarTurno.css']
})
export class ModuloGenerarTurnoComponent implements OnInit, OnDestroy {
  @Output() back = new EventEmitter<void>();
  @Input() usuarioNombre = 'Recepcion';
  @Input() usuarioRol = 'Kiosko';
  @ViewChild('serviceRail') serviceRail?: ElementRef<HTMLDivElement>;

  currentDate = new Date();
  currentStep: 'inicio' | 'servicios' = 'inicio';
  servicioSeleccionadoId = '';
  ticketGenerado: TicketGenerado | null = null;
  isSavingTurno = false;
  showSuccessPulse = false;
  notificationMessage = '';
  notificationType: 'success' | 'info' | 'warning' | 'danger' | '' = '';
  jornadaCerrada = false;
  mensajeCierre = '';

  servicios: ServicioTurno[] = [
    { id: 'medicina-general', nombre: 'Medicina General', categoria: 'Consulta', prefijo: 'MG', icono: 'fa-stethoscope', descripcion: 'Atencion medica general', tone: 'blue' },
    { id: 'ginecologia', nombre: 'Ginecologia', categoria: 'Consulta', prefijo: 'GY', icono: 'fa-female', descripcion: 'Atencion ginecologica y obstetrica', tone: 'violet' },
    { id: 'diabetologia', nombre: 'Diabetologia', categoria: 'Consulta', prefijo: 'DB', icono: 'fa-droplet', descripcion: 'Control y seguimiento de diabetes', tone: 'teal' },
    { id: 'odontologia', nombre: 'Odontologia', categoria: 'Consulta', prefijo: 'OD', icono: 'fa-tooth', descripcion: 'Atencion dental y revision oral', tone: 'amber' },
    { id: 'gastroenterologia', nombre: 'Gastro', categoria: 'Consulta', prefijo: 'GA', icono: 'fa-notes-medical', descripcion: 'Consulta digestiva y del sistema gastrointestinal', tone: 'navy' },
    { id: 'cardiologia', nombre: 'Cardiologia', categoria: 'Consulta', prefijo: 'CA', icono: 'fa-heart-pulse', descripcion: 'Control del corazon y presion arterial', tone: 'blue' },
    { id: 'pediatria', nombre: 'Pediatria', categoria: 'Consulta', prefijo: 'PD', icono: 'fa-baby', descripcion: 'Atencion medica para ninos', tone: 'green' },
    { id: 'psicologia', nombre: 'Psicologia', categoria: 'Consulta', prefijo: 'PS', icono: 'fa-brain', descripcion: 'Apoyo emocional y evaluacion', tone: 'sky' },
    { id: 'sonografia', nombre: 'Sonografia', categoria: 'Imagenologia', prefijo: 'SO', icono: 'fa-wave-square', descripcion: 'Estudios de imagen', tone: 'teal' },
    { id: 'laboratorio', nombre: 'Laboratorio', categoria: 'Analisis', prefijo: 'LA', icono: 'fa-vial', descripcion: 'Toma y analisis de muestras', tone: 'green' },
    { id: 'procedimientos', nombre: 'Procedimientos', categoria: 'Apoyo', prefijo: 'PR', icono: 'fa-notes-medical', descripcion: 'Atenciones y procedimientos', tone: 'amber' },
    { id: 'terapias', nombre: 'Terapias', categoria: 'Rehabilitacion', prefijo: 'TE', icono: 'fa-person-walking', descripcion: 'Sesiones terapeuticas', tone: 'navy' }
  ];

  private notificationTimer: ReturnType<typeof setTimeout> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private jornadaTimer: ReturnType<typeof setInterval> | null = null;
  private readonly inactivityTimeoutMs = 25000;

  constructor(
    private turnosDbService: TurnosDbService,
    private cuadreDbService: CuadreCajaDbService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    void this.verificarJornada().then(() => {
      this.jornadaTimer = setInterval(() => void this.verificarJornada(), 60000);
      if (!this.jornadaCerrada && (this.usuarioRol === 'Kiosko' || this.usuarioRol === 'Caja / Kiosko')) {
        queueMicrotask(() => this.iniciarKiosko());
      }
    });
  }

  get servicioSeleccionado(): ServicioTurno | null {
    return this.servicios.find((servicio) => servicio.id === this.servicioSeleccionadoId) || null;
  }

  desplazarServicios(direccion: -1 | 1) {
    const rail = this.serviceRail?.nativeElement;
    if (!rail) return;

    const ancho = Math.max(rail.clientWidth * 0.8, 340);
    rail.scrollBy({ left: ancho * direccion, behavior: 'smooth' });
  }

  iniciarKiosko() {
    if (this.jornadaCerrada) {
      this.showNotification('warning', 'Jornada cerrada', this.mensajeCierre || 'No es posible generar turnos después del cierre.');
      return;
    }
    this.cancelarReinicio();
    this.cancelarInactividad();
    this.currentStep = 'servicios';
    this.servicioSeleccionadoId = '';
    this.ticketGenerado = null;
    this.showSuccessPulse = false;
    this.notificationMessage = '';
    this.notificationType = '';
    this.cdr.detectChanges();
    this.programarInactividad();
  }

  async seleccionarServicio(servicio: ServicioTurno) {
    if (this.isSavingTurno) return;
    if (this.jornadaCerrada) {
      this.showNotification('warning', 'Jornada cerrada', this.mensajeCierre || 'No se pueden generar nuevos turnos.');
      return;
    }

    this.servicioSeleccionadoId = servicio.id;
    this.cancelarInactividad();
    await this.generarTicket(servicio);
  }

  async generarTicket(servicio: ServicioTurno) {
    if (!servicio) {
      this.showNotification('warning', 'Campo requerido', 'Seleccione un servicio');
      return;
    }
    if (this.jornadaCerrada) {
      this.showNotification('warning', 'Jornada cerrada', this.mensajeCierre || 'No se pueden generar nuevos turnos.');
      return;
    }

    this.isSavingTurno = true;
    this.cancelarInactividad();
    this.showNotification('info', 'Procesando', 'Generando turno, espere un momento...');
    this.cdr.detectChanges();

    try {
      const siguienteNumero = await this.turnosDbService.obtenerUltimoNumero(servicio.prefijo);

      const nuevoTicket: TicketGenerado = {
        numero: siguienteNumero,
        prefijo: servicio.prefijo,
        codigo: `${servicio.prefijo}-${String(siguienteNumero).padStart(3, '0')}`,
        servicio: servicio.nombre,
        categoria: servicio.categoria,
        fecha: new Date()
      };

      await this.turnosDbService.crearTurno({
        codigo: nuevoTicket.codigo,
        prefijo: nuevoTicket.prefijo,
        numero: nuevoTicket.numero,
        servicio_id: servicio.id,
        servicio_nombre: servicio.nombre,
        categoria: servicio.categoria,
        paciente_cedula: 'KIOSKO',
        paciente_nombre: 'Cliente',
        paciente_edad: 0,
        paciente_fecha_nacimiento: null,
        estado: 'espera',
        puesto_atencion: null
      });

      this.ticketGenerado = nuevoTicket;
      this.isSavingTurno = false;
      this.showNotification('success', 'Turno creado', `El ticket ${nuevoTicket.codigo} quedo registrado e ira a impresion.`);
      this.showSuccessPulse = true;
      this.cdr.detectChanges();

      this.imprimirTicket();
      this.programarReinicio();

      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          this.ngZone.run(() => {
            this.showSuccessPulse = false;
            this.cdr.detectChanges();
          });
        }, 1400);
      });
    } catch (error) {
      console.error('Error creando turno:', error);
      this.isSavingTurno = false;
      this.showNotification('danger', 'Error al generar', 'No se pudo registrar el turno. Intente nuevamente.');
      this.cdr.detectChanges();
    }
  }

  limpiarFormulario() {
    this.cancelarReinicio();
    this.cancelarInactividad();
    this.ticketGenerado = null;
    this.servicioSeleccionadoId = '';
    this.currentStep = 'inicio';
    this.showSuccessPulse = false;
    this.notificationMessage = '';
    this.notificationType = '';
    this.cdr.detectChanges();
  }

  imprimirTicket() {
    if (!this.ticketGenerado) return;
    const t = this.ticketGenerado;
    const fechaFormateada = t.fecha.toLocaleString('es-DO', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
    const ticketHtml = `
      <!doctype html>
      <html>
        <head>
          <title>Ticket ${t.codigo}</title>
          <meta charset="utf-8" />
          <style>
            *{margin:0;padding:0;box-sizing:border-box}
            @page{size:58mm auto;margin:0}
            html,body{width:100%;background:#fff;color:#000}
            body{font-family:Arial,sans-serif}
            .ticket{width:58mm;max-width:58mm;margin:0 auto;padding:5mm 3mm;text-align:center}
            .brand{font-size:15px;font-weight:800;letter-spacing:1px;margin-bottom:8px}
            .subtitle{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#444;margin-bottom:8px}
            .code{font-size:30px;font-weight:800;line-height:1;margin:6px 0 10px}
            .service{font-size:12px;font-weight:700;line-height:1.2;margin-bottom:4px}
            .category{font-size:10px;color:#444;margin-bottom:12px}
            .message{font-size:10px;font-weight:700;border-top:1px solid #000;border-bottom:1px solid #000;padding:6px 0;margin:10px 0}
            .small{font-size:8px;color:#555;margin-top:4px}
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="brand">FUNBIDE</div>
            <div class="subtitle">Kiosko de turnos</div>
            <div class="code">${t.codigo}</div>
            <div class="service">${t.servicio}</div>
            <div class="category">${t.categoria}</div>
            <div class="message">Favor esperar su llamado</div>
            <div class="small">${fechaFormateada}</div>
          </div>
        </body>
      </html>
    `;

    printHtmlInHiddenFrame(ticketHtml, {
      onError: () => {
        this.showNotification('warning', 'Impresion no disponible', 'No se pudo preparar el ticket para imprimir.');
      }
    });
  }

  showNotification(type: 'success' | 'info' | 'warning' | 'danger', title: string, message: string) {
    this.notificationType = type;
    this.notificationMessage = `${title}: ${message}`;
    this.cdr.detectChanges();

    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
    }

    this.notificationTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.notificationMessage = '';
        this.notificationType = '';
        this.cdr.detectChanges();
      });
    }, 3500);
  }

  volver() {
    this.back.emit();
  }

  ngOnDestroy() {
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    if (this.resetTimer) clearTimeout(this.resetTimer);
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.jornadaTimer) clearInterval(this.jornadaTimer);
  }

  private programarReinicio() {
    this.cancelarReinicio();
    this.resetTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.limpiarFormulario();
      });
    }, 12000);
  }

  private cancelarReinicio() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  reiniciarInactividad() {
    if (this.currentStep !== 'servicios' || this.ticketGenerado || this.isSavingTurno) return;
    this.programarInactividad();
  }

  private programarInactividad() {
    this.cancelarInactividad();
    this.inactivityTimer = setTimeout(() => {
      this.ngZone.run(() => {
        if (this.currentStep === 'servicios' && !this.ticketGenerado && !this.isSavingTurno && !this.jornadaCerrada) {
          this.limpiarFormulario();
        }
      });
    }, this.inactivityTimeoutMs);
  }

  private cancelarInactividad() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private async verificarJornada() {
    const ahora = new Date();
    const cerradaPorHora = ahora.getHours() >= 21;

    let cerradaEnDb = false;
    try {
      cerradaEnDb = await this.cuadreDbService.jornadaCerradaHoy(ahora);
    } catch (error) {
      console.error('Error verificando cierre de jornada', error);
    }

    if (cerradaPorHora && !cerradaEnDb) {
      try {
        await this.cuadreDbService.cerrarCuadre(ahora, 'Cierre automático registrado desde kiosco a las 9:00 PM');
        cerradaEnDb = true;
      } catch (error) {
        console.error('Error registrando cierre automático', error);
      }
    }

    this.jornadaCerrada = cerradaPorHora || cerradaEnDb;
    this.mensajeCierre = cerradaPorHora
      ? 'La jornada terminó a las 9:00 PM.'
      : 'La jornada fue cerrada por supervisión.';

    if (this.jornadaCerrada) {
      this.currentStep = 'inicio';
      this.servicioSeleccionadoId = '';
      this.ticketGenerado = null;
      this.showSuccessPulse = false;
      this.cancelarReinicio();
      this.cancelarInactividad();
    }

    this.cdr.detectChanges();
  }

}
