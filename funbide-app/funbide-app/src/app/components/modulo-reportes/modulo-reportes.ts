import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';

type RangoTiempo = 'hoy' | 'semana' | 'mes';

interface ReporteKpi {
  label: string;
  value: string;
  hint: string;
  icon: string;
  tone: 'blue' | 'green' | 'amber' | 'purple' | 'teal' | 'rose';
}

interface SerieGrafica {
  label: string;
  value: number;
  color: string;
}

interface TablaFila {
  label: string;
  value: string;
  meta?: string;
}

@Component({
  selector: 'app-modulo-reportes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modulo-reportes.html',
  styleUrls: ['./modulo-reportes.css']
})
export class ModuloReportesComponent implements OnInit {
  @Input() usuarioNombre = '';
  @Input() usuarioRol = '';
  @Output() back = new EventEmitter<void>();

  rango: RangoTiempo = 'mes';
  loading = true;
  error = '';
  currentDate = new Date();

  kpis: ReporteKpi[] = [];
  barraEstados: SerieGrafica[] = [];
  barraAreas: SerieGrafica[] = [];
  barraServicios: SerieGrafica[] = [];
  tablaActividades: TablaFila[] = [];
  tablaTopAreas: TablaFila[] = [];

  constructor(private supabase: SupabaseService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    void this.cargarReportes();
  }

  volver() {
    this.back.emit();
  }

  async cambiarRango(rango: RangoTiempo) {
    if (this.rango === rango) return;
    this.rango = rango;
    await this.cargarReportes();
  }

  async cargarReportes() {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    try {
      const client = this.supabase.getClient();
      const [turnosRes, cobrosRes, medRes, labRes, pacientesRes, farmaciaRes] = await Promise.all([
        this.queryRango('turnos', client, this.rango),
        this.queryRango('cobros', client, this.rango),
        this.queryRango('expedientes_medicos', client, this.rango),
        this.queryRango('expedientes_laboratorio', client, this.rango),
        client.from('pacientes').select('id', { count: 'exact', head: true }),
        client.from('productos_farmacia').select('id', { count: 'exact', head: true })
      ]);

      const turnos = turnosRes.data ?? [];
      const cobros = cobrosRes.data ?? [];
      const expedientesMedicos = medRes.data ?? [];
      const expedientesLab = labRes.data ?? [];

      const totales = {
        turnos: turnosRes.count ?? turnos.length,
        cobros: cobrosRes.count ?? cobros.length,
        medicos: medRes.count ?? expedientesMedicos.length,
        laboratorio: labRes.count ?? expedientesLab.length,
        pacientes: pacientesRes.count ?? 0,
        farmacia: farmaciaRes.count ?? 0
      };

      this.kpis = [
        { label: 'Turnos', value: this.formatoNumero(totales.turnos), hint: `${this.rangoLabel()} registrados`, icon: 'fa-ticket-alt', tone: 'blue' },
        { label: 'Cobros', value: this.formatoNumero(totales.cobros), hint: 'Movimientos de caja', icon: 'fa-cash-register', tone: 'green' },
        { label: 'Exp. médicos', value: this.formatoNumero(totales.medicos), hint: 'Atenciones clínicas', icon: 'fa-user-md', tone: 'purple' },
        { label: 'Exp. laboratorio', value: this.formatoNumero(totales.laboratorio), hint: 'Procesos de laboratorio', icon: 'fa-microscope', tone: 'teal' },
        { label: 'Pacientes', value: this.formatoNumero(totales.pacientes), hint: 'Registro global', icon: 'fa-users', tone: 'amber' },
        { label: 'Productos farmacia', value: this.formatoNumero(totales.farmacia), hint: 'Catálogo activo', icon: 'fa-pills', tone: 'rose' }
      ];

      this.barraEstados = this.agruparPor(turnos, 'estado', [
        ['espera', 'En espera', '#f59e0b'],
        ['llamando', 'Llamando', '#38bdf8'],
        ['atendiendo', 'Atendiendo', '#8b5cf6'],
        ['finalizado', 'Finalizados', '#22c55e'],
        ['cancelado', 'Cancelados', '#ef4444']
      ]);

      this.barraAreas = this.agruparPor(turnos, 'categoria', [
        ['Consulta', 'Consulta', '#1d3973'],
        ['Consulta Médica', 'Consulta médica', '#2563eb'],
        ['Farmacia', 'Farmacia', '#8b5cf6'],
        ['Imagen', 'Imagen', '#f97316'],
        ['Laboratorio', 'Laboratorio', '#10b981'],
        ['Dental', 'Odontología', '#14b8a6']
      ], 6);

      this.barraServicios = this.agruparPor(turnos, 'servicio_nombre', [], 6);

      this.tablaActividades = this.crearTablaActividades(turnos, cobros, expedientesMedicos, expedientesLab);
      this.tablaTopAreas = this.crearTopAreas(turnos);
    } catch (e) {
      console.error('Error cargando reportes', e);
      this.error = 'No se pudieron cargar los reportes.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private async queryRango(tabla: string, client: ReturnType<SupabaseService['getClient']>, rango: RangoTiempo) {
    const { desde, hasta } = this.getRangoFechas(rango);
    return client
      .from(tabla)
      .select('*', { count: 'exact' })
      .gte('created_at', desde)
      .lte('created_at', hasta)
      .order('created_at', { ascending: false });
  }

  private getRangoFechas(rango: RangoTiempo) {
    const hoy = new Date();
    const fin = new Date(hoy);
    const inicio = new Date(hoy);
    if (rango === 'hoy') {
      inicio.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
    } else if (rango === 'semana') {
      inicio.setDate(inicio.getDate() - 7);
    } else {
      inicio.setDate(inicio.getDate() - 30);
    }
    return { desde: inicio.toISOString(), hasta: fin.toISOString() };
  }

  private rangoLabel() {
    if (this.rango === 'hoy') return 'Hoy';
    if (this.rango === 'semana') return 'Últimos 7 días';
    return 'Últimos 30 días';
  }

  private formatoNumero(value: number) {
    return new Intl.NumberFormat('es-DO').format(value);
  }

  private agruparPor(
    filas: Array<Record<string, any>>,
    campo: string,
    prioridades: Array<[string, string, string]>,
    limite = 8
  ): SerieGrafica[] {
    const mapa = new Map<string, number>();
    for (const fila of filas) {
      const clave = String(fila[campo] ?? 'Sin dato').trim() || 'Sin dato';
      mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
    }

    const ordenadas = prioridades.length
      ? prioridades.map(([clave, label, color]) => ({
        label,
        value: mapa.get(clave) ?? 0,
        color
      }))
      : Array.from(mapa.entries()).map(([label, value], index) => ({
        label,
        value,
        color: ['#1d3973', '#2563eb', '#8b5cf6', '#14b8a6', '#f97316', '#22c55e', '#eab308', '#ef4444'][index % 8]
      }));

    return ordenadas
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limite);
  }

  private crearTablaActividades(
    turnos: Array<Record<string, any>>,
    cobros: Array<Record<string, any>>,
    expedientesMedicos: Array<Record<string, any>>,
    expedientesLab: Array<Record<string, any>>
  ): TablaFila[] {
    const filas: TablaFila[] = [
      { label: 'Turnos creados', value: this.formatoNumero(turnos.length), meta: 'Base operativa del sistema' },
      { label: 'Cobros realizados', value: this.formatoNumero(cobros.filter(c => c['estado'] === 'pagado').length), meta: 'Pagos confirmados' },
      { label: 'Expedientes médicos en proceso', value: this.formatoNumero(expedientesMedicos.filter(e => e['estado'] === 'en_proceso').length), meta: 'Atenciones activas' },
      { label: 'Expedientes médicos completados', value: this.formatoNumero(expedientesMedicos.filter(e => e['estado'] === 'completado').length), meta: 'Historias cerradas' },
      { label: 'Laboratorio completado', value: this.formatoNumero(expedientesLab.filter(e => e['estado'] === 'completado').length), meta: 'Resultados listos' },
      { label: 'Laboratorio en proceso', value: this.formatoNumero(expedientesLab.filter(e => e['estado'] === 'en_proceso').length), meta: 'Muestras por procesar' }
    ];

    return filas;
  }

  private crearTopAreas(turnos: Array<Record<string, any>>): TablaFila[] {
    const conteo = new Map<string, number>();
    for (const turno of turnos) {
      const area = String(turno['servicio_nombre'] ?? turno['categoria'] ?? 'Sin dato').trim() || 'Sin dato';
      conteo.set(area, (conteo.get(area) ?? 0) + 1);
    }

    return Array.from(conteo.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({
        label,
        value: this.formatoNumero(value),
        meta: 'Actividad registrada'
      }));
  }

  barraWidth(value: number, max: number) {
    if (!max) return '0%';
    return `${Math.max(8, Math.round((value / max) * 100))}%`;
  }

  maxSerie(series: SerieGrafica[]): number {
    return series.length ? Math.max(...series.map(item => item.value), 1) : 1;
  }
}
