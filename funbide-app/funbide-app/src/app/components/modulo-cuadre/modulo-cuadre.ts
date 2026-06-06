import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CuadreCajaDbService, CuadreCajaHistorico, CuadreCajaResumen } from '../../services/cuadre-caja-db.service';
import * as XLSX from 'xlsx';

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
  exportando = false;
  resumen: CuadreCajaResumen | null = null;
  historial: CuadreCajaHistorico[] = [];
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
    return this.resumen.total_ingresos_reales;
  }

  async cargarResumen() {
    this.loading = true;
    this.cdr.detectChanges();
    try {
      const [resumen, historial] = await Promise.all([
        this.cuadreDb.obtenerResumenDia(new Date()),
        this.cuadreDb.listarHistorial(15)
      ]);

      this.resumen = resumen;
      this.historial = historial;
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
      await this.cargarResumen();
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

  async exportarExcel() {
    if (this.exportando) return;

    this.exportando = true;
    this.cdr.detectChanges();
    try {
      const [resumenDia, historial] = await Promise.all([
        this.cuadreDb.obtenerResumenDia(new Date()),
        this.cuadreDb.listarHistorial(1000)
      ]);

      const resumenSheet = [{
        Fecha: resumenDia.fecha,
        Estado: resumenDia.jornada_cerrada ? 'Cerrada' : 'Abierta',
        'Total turnos': resumenDia.total_turnos,
        'Total cobros': resumenDia.total_cobros,
        Efectivo: resumenDia.total_efectivo,
        Tarjeta: resumenDia.total_tarjeta,
        Transferencia: resumenDia.total_transferencia,
        'SENASA subsidiado': resumenDia.total_senasa_subsidiado,
        'SENASA contributivo': resumenDia.total_senasa_contributivo,
        'ARS Renacer': resumenDia.total_renacer,
        'Aporte cliente': resumenDia.total_aporte_cliente,
        'Ganancia interna': resumenDia.total_ganancia_interna,
        'Pendiente SENASA': resumenDia.total_pendiente_senasa,
        'Pendiente Renacer': resumenDia.total_pendiente_renacer,
        'Total ingresos visibles': resumenDia.total_ingresos_visibles,
        'Total ingresos reales': resumenDia.total_ingresos_reales,
        'Turnos en espera': resumenDia.turnos_espera,
        'Turnos llamando': resumenDia.turnos_llamando,
        'Turnos atendiendo': resumenDia.turnos_atendiendo,
        'Turnos finalizados': resumenDia.turnos_finalizados,
        'Hora cierre': resumenDia.hora_cierre ? new Date(resumenDia.hora_cierre).toLocaleString('es-DO') : '',
        Observaciones: resumenDia.observaciones ?? ''
      }];

      const filaHistorial = historial.map((item) => ({
        Fecha: item.fecha,
        Estado: item.estado_texto,
        'Total turnos': item.total_turnos,
        'Total cobros': item.total_cobros,
        Efectivo: item.total_efectivo,
        Tarjeta: item.total_tarjeta,
        Transferencia: item.total_transferencia,
        'SENASA subsidiado': item.total_senasa_subsidiado,
        'SENASA contributivo': item.total_senasa_contributivo,
        'ARS Renacer': item.total_renacer,
        'Aporte cliente': item.total_aporte_cliente,
        'Ganancia interna': item.total_ganancia_interna,
        'Pendiente SENASA': item.total_pendiente_senasa,
        'Pendiente Renacer': item.total_pendiente_renacer,
        'Total ingresos': item.total_ingresos,
        'Hora cierre': item.hora_cierre ? new Date(item.hora_cierre).toLocaleString('es-DO') : '',
        Observaciones: item.observaciones ?? ''
      }));

      const hojaResumen = XLSX.utils.json_to_sheet(resumenSheet);
      const hojaHistorial = XLSX.utils.json_to_sheet(filaHistorial);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');
      XLSX.utils.book_append_sheet(libro, hojaHistorial, 'Historico');

      const nombre = `cuadre-diario-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(libro, nombre, { compression: true });
      this.toastMessage('Histórico exportado a Excel correctamente.', 'success');
    } catch (error) {
      console.error('Error exportando Excel', error);
      this.toastMessage('No se pudo exportar el histórico a Excel.', 'danger');
    } finally {
      this.exportando = false;
      this.cdr.detectChanges();
    }
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
