import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TurnosDbService, TurnoDb } from '../../services/turnos-db.service';

export interface ModuleCard {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

interface DashboardStats {
  loading: boolean;
  pacientesHoy: number;
  atendidosHoy: number;
  enEsperaHoy: number;
  eficienciaHoy: number;
  pacientesAyer: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  @Input() userName = '';
  @Input() userRole = '';
  @Input() modules: ModuleCard[] = [];
  @Output() selectModule = new EventEmitter<string>();
  @Output() logout = new EventEmitter<void>();

  currentDate = new Date();

  stats: DashboardStats = {
    loading: true,
    pacientesHoy: 0,
    atendidosHoy: 0,
    enEsperaHoy: 0,
    eficienciaHoy: 0,
    pacientesAyer: 0
  };

  private daysInSpanish = [
    'Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'
  ];

  private monthsInSpanish = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  constructor(
    private turnosDbService: TurnosDbService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    setTimeout(() => {
      void this.cargarIndicadores();
    }, 0);
  }

  async cargarIndicadores() {
    try {
      const hoy = this.fechaIsoLocal(0);
      const ayer = this.fechaIsoLocal(-1);

      const [turnosHoy, turnosAyer] = await Promise.all([
        this.turnosDbService.listarTurnosDelDia(hoy),
        this.turnosDbService.listarTurnosDelDia(ayer)
      ]);

      this.ngZone.run(() => {
        this.stats.pacientesHoy = turnosHoy.length;
        this.stats.atendidosHoy = turnosHoy.filter((turno) => this.esTurnoAtendido(turno)).length;
        this.stats.enEsperaHoy = turnosHoy.filter((turno) => turno.estado === 'espera').length;
        this.stats.eficienciaHoy = this.stats.pacientesHoy > 0
          ? Math.round((this.stats.atendidosHoy / this.stats.pacientesHoy) * 100)
          : 0;
        this.stats.pacientesAyer = turnosAyer.length;
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('Error cargando indicadores del dashboard:', error);
      this.ngZone.run(() => {
        this.stats.pacientesHoy = 0;
        this.stats.atendidosHoy = 0;
        this.stats.enEsperaHoy = 0;
        this.stats.eficienciaHoy = 0;
        this.stats.pacientesAyer = 0;
        this.cdr.detectChanges();
      });
    } finally {
      this.ngZone.run(() => {
        this.stats.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  private esTurnoAtendido(turno: TurnoDb): boolean {
    return turno.estado === 'atendiendo' || turno.estado === 'finalizado';
  }

  private fechaIsoLocal(deltaDias: number): string {
    const ahora = new Date();
    ahora.setDate(ahora.getDate() + deltaDias);
    const year = ahora.getFullYear();
    const month = String(ahora.getMonth() + 1).padStart(2, '0');
    const day = String(ahora.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos dias';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  getDayName(): string {
    return this.daysInSpanish[this.currentDate.getDay()];
  }

  getFormattedDate(): string {
    const day = this.currentDate.getDate();
    const month = this.monthsInSpanish[this.currentDate.getMonth()];
    const year = this.currentDate.getFullYear();
    return `${day} ${month} ${year}`;
  }

  getVariacionVsAyer(): string {
    if (!this.stats.pacientesAyer) return '0% vs ayer';
    const diff = Math.round(((this.stats.pacientesHoy - this.stats.pacientesAyer) / this.stats.pacientesAyer) * 100);
    return `${diff >= 0 ? '+' : ''}${diff}% vs ayer`;
  }

  getTasaCompletados(): string {
    return `${this.stats.eficienciaHoy}% completados`;
  }

  getVariacionEspera(): string {
    const diferencia = this.stats.pacientesHoy - this.stats.atendidosHoy - this.stats.enEsperaHoy;
    return `${diferencia >= 0 ? '+' : ''}${diferencia} ultima hora`;
  }

  openTVScreen() {
    window.open('/tv', '_blank');
  }

  onSelectModule(moduleId: string) {
    this.selectModule.emit(moduleId);
  }

  onLogout() {
    this.logout.emit();
  }
}
