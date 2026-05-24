import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CuadreCajaDbService, CuadreCajaResumen } from '../../services/cuadre-caja-db.service';

@Component({
  selector: 'app-modulo-cuadre',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modulo-cuadre.html',
  styleUrls: ['./modulo-cuadre.css']
})
export class ModuloCuadreComponent implements OnInit, OnDestroy {
  @Input() usuarioNombre = '';
  @Input() usuarioRol = '';
  @Output() back = new EventEmitter<void>();

  loading = true;
  guardando = false;
  resumen: CuadreCajaResumen | null = null;
  observaciones = '';
  toast = '';
  toastType: 'success' | 'warning' | 'danger' | 'info' = 'info';
  horaActual = new Date();
  jornadaCerrada = false;
  private intervalo?: ReturnType<typeof setInterval>;

  constructor(private cuadreDb: CuadreCajaDbService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    void this.cargarResumen();
    this.intervalo = setInterval(() => {
      this.horaActual = new Date();
      void this.verificarCierreAutomatico();
      this.cdr.detectChanges();
    }, 30000);
  }

  ngOnDestroy() {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  volver() {
    this.back.emit();
  }

  get esHoraCierre() {
    const hora = this.horaActual.getHours();
    const minuto = this.horaActual.getMinutes();
    return hora > 21 || (hora === 21 && minuto >= 0);
  }

  get totalIngresos() {
    if (!this.resumen) return 0;
    return this.resumen.total_efectivo + this.resumen.total_tarjeta + this.resumen.total_transferencia + this.resumen.total_senasa;
  }

  async cargarResumen() {
    this.loading = true;
    this.cdr.detectChanges();
    try {
      this.resumen = await this.cuadreDb.obtenerResumenDia(new Date());
      this.jornadaCerrada = this.resumen.jornada_cerrada;
      this.observaciones = this.resumen.observaciones ?? '';
      if (this.esHoraCierre && !this.jornadaCerrada) {
        await this.cerrarJornada('Cierre automático a las 9:00 PM');
      }
    } catch (error) {
      console.error('Error cargando cuadre', error);
      this.toastMessage('No se pudo cargar el cuadre diario.', 'danger');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async cerrarJornada(motivo?: string) {
    if (this.guardando) return;

    this.guardando = true;
    this.cdr.detectChanges();
    try {
      const registro = await this.cuadreDb.cerrarCuadre(new Date(), motivo ?? this.observaciones);
      this.resumen = {
        ...(this.resumen ?? await this.cuadreDb.obtenerResumenDia(new Date())),
        jornada_cerrada: registro.jornada_cerrada,
        hora_cierre: registro.hora_cierre ?? null,
        observaciones: registro.observaciones ?? null
      };
      this.jornadaCerrada = true;
      this.toastMessage('Jornada cerrada correctamente.', 'success');
    } catch (error) {
      console.error('Error cerrando jornada', error);
      this.toastMessage('No se pudo cerrar la jornada.', 'danger');
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  private async verificarCierreAutomatico() {
    if (!this.esHoraCierre || this.jornadaCerrada) return;
    await this.cerrarJornada('Cierre automático a las 9:00 PM');
  }

  private toastMessage(message: string, type: typeof this.toastType) {
    this.toast = message;
    this.toastType = type;
    setTimeout(() => {
      this.toast = '';
      this.cdr.detectChanges();
    }, 3000);
  }
}
