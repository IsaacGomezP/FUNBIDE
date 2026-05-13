import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { CobrosDbService } from '../../services/cobros-db.service';
import { ExpedientesMedicosDbService, ExpedienteMedicoDb, RecetaMedicaDb } from '../../services/expedientes-medicos-db.service';

interface PacienteMedicoFila {
  id: string;
  turno_id: string;
  codigo_ticket: string;
  paciente_nombre: string;
  paciente_cedula: string;
  paciente_telefono: string | null;
  paciente_correo: string | null;
  servicio_nombre: string;
  area_destino: string;
  estado: 'borrador' | 'en_proceso' | 'completado' | 'enviado' | 'archivado';
  creado_at: string | null;
  expediente?: ExpedienteMedicoDb | null;
  prioridad?: 'normal' | 'urgente' | 'critico';
}

interface ConsultaForm {
  motivo_consulta: string;
  antecedentes: string;
  sintomas_actuales: string;
  signos_vitales: string;
  examen_fisico: string;
  impresion_clinica: string;
  diagnostico: string;
  tratamiento: string;
  indicaciones: string;
  conclusion: string;
  requiere_receta: boolean;
  requiere_orden_estudio: boolean;
  requiere_interconsulta: boolean;
  whatsapp_envio: string;
  notas_rapidas: string;
  alergias: string;
  presion_arterial: string;
  frecuencia_cardiaca: string;
  temperatura: string;
  peso: string;
  saturacion: string;
}

interface FormularioArea {
  area_destino: string;
  titulo: string;
  descripcion: string;
  icon: string;
  color: string;
}

interface MedicamentoForm {
  medicamento: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  instrucciones: string;
}

interface EstadisticasDia {
  total: number;
  completados: number;
  en_proceso: number;
  pendientes: number;
  areas: Record<string, number>;
}

@Component({
  selector: 'app-modulo-medicina',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modulo-medicina.html',
  styleUrls: ['./modulo-medicina.css']
})
export class ModuloMedicinaComponent implements OnInit, OnDestroy {
  @Output() back = new EventEmitter<void>();
  @Input() usuarioNombre = 'Médico';
  @Input() usuarioRol = 'Medicina General';

  isLoading = false;
  isSaving = false;
  vistaActual: 'bandeja' | 'expediente' | 'estadisticas' = 'bandeja';
  currentDate = new Date();
  cedulaBusqueda = '';
  pacienteEncontrado: PacienteMedicoFila | null = null;
  cedulaNoEncontrada = false;
  areaAtencionSeleccionada = 'Medicina General';
  formulariosAtencion = [
    { value: 'Medicina General', label: 'Medicina General', icon: 'fa-stethoscope' },
    { value: 'Pediatría', label: 'Pediatría', icon: 'fa-baby' },
    { value: 'Ginecología', label: 'Ginecología', icon: 'fa-venus' },
    { value: 'Cardiología', label: 'Cardiología', icon: 'fa-heartbeat' },
    { value: 'Psicología', label: 'Psicología', icon: 'fa-brain' },
    { value: 'Odontología', label: 'Odontología', icon: 'fa-tooth' },
    { value: 'Traumatología', label: 'Traumatología', icon: 'fa-bone' }
  ];
  busquedaExpediente = '';
  filtroEstado: string = 'todos';
  filtroArea: string = 'todas';
  expedientes: PacienteMedicoFila[] = [];
  expedienteSeleccionado: PacienteMedicoFila | null = null;
  expedienteActual: ExpedienteMedicoDb | null = null;
  recetas: RecetaMedicaDb[] = [];
  archivos: Array<{ id: string; nombre_archivo: string; url: string; tipo_archivo: string; created_at?: string }> = [];
  toast = '';
  toastType: 'success' | 'warning' | 'danger' | 'info' = 'info';
  tabActiva: 'historia' | 'evaluacion' | 'tratamiento' | 'archivos' = 'historia';

  // Temporizador de consulta
  timerActivo = false;
  timerSegundos = 0;
  timerInterval: any = null;
  timerLabel = '00:00';

  // Estadísticas
  estadisticas: EstadisticasDia = {
    total: 0,
    completados: 0,
    en_proceso: 0,
    pendientes: 0,
    areas: {}
  };

  // Sidebar colapsable
  sidebarVisible = true;

  consultaForm: ConsultaForm = this.formularioInicial();
  medicamentoForm: MedicamentoForm = this.medicamentoInicial();

  private readonly formulariosPorArea: Record<string, FormularioArea> = {
    'Medicina General': {
      area_destino: 'Medicina General',
      titulo: 'Medicina General',
      descripcion: 'Valoración integral, signos vitales, diagnóstico y conducta.',
      icon: 'fa-stethoscope',
      color: '#1d3973'
    },
    Pediatría: {
      area_destino: 'Pediatría',
      titulo: 'Pediatría',
      descripcion: 'Historia infantil, síntomas actuales, crecimiento y alerta clínica.',
      icon: 'fa-baby',
      color: '#0891b2'
    },
    Ginecología: {
      area_destino: 'Ginecología',
      titulo: 'Ginecología',
      descripcion: 'Historia gineco-obstétrica, examen y plan de manejo.',
      icon: 'fa-venus',
      color: '#be185d'
    },
    Cardiología: {
      area_destino: 'Cardiología',
      titulo: 'Cardiología',
      descripcion: 'Dolor torácico, disnea, factores de riesgo y estudio clínico.',
      icon: 'fa-heartbeat',
      color: '#dc2626'
    },
    Odontología: {
      area_destino: 'Odontología',
      titulo: 'Odontología',
      descripcion: 'Exploración bucal, dolor dental, hallazgos y tratamiento.',
      icon: 'fa-tooth',
      color: '#0d9488'
    },
    Psicología: {
      area_destino: 'Psicología',
      titulo: 'Psicología',
      descripcion: 'Motivo, estado emocional, riesgo y plan terapéutico.',
      icon: 'fa-brain',
      color: '#7c3aed'
    },
    Traumatología: {
      area_destino: 'Traumatología',
      titulo: 'Traumatología',
      descripcion: 'Trauma, dolor, movilidad, hallazgos osteomusculares y conducta.',
      icon: 'fa-bone',
      color: '#b45309'
    }
  };

  constructor(
    private expedientesDb: ExpedientesMedicosDbService,
    private cobrosDb: CobrosDbService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.cargarBandeja();
    this.actualizarEstadisticas();
  }

  ngOnDestroy() {
    this.detenerTimer();
  }

  private formularioInicial(): ConsultaForm {
    return {
      motivo_consulta: '',
      antecedentes: '',
      sintomas_actuales: '',
      signos_vitales: '',
      examen_fisico: '',
      impresion_clinica: '',
      diagnostico: '',
      tratamiento: '',
      indicaciones: '',
      conclusion: '',
      requiere_receta: false,
      requiere_orden_estudio: false,
      requiere_interconsulta: false,
      whatsapp_envio: '',
      notas_rapidas: '',
      alergias: '',
      presion_arterial: '',
      frecuencia_cardiaca: '',
      temperatura: '',
      peso: '',
      saturacion: ''
    };
  }

  private medicamentoInicial(): MedicamentoForm {
    return { medicamento: '', dosis: '', frecuencia: '', duracion: '', instrucciones: '' };
  }

  get formularioAtencionActual(): FormularioArea {
    return this.formulariosPorArea[this.areaNormalizada(this.areaAtencionSeleccionada) || 'Medicina General']
      ?? this.formulariosPorArea['Medicina General'];
  }

  async buscarPacientePorCedula() {
    const cedula = this.cedulaBusqueda.trim();
    if (!cedula) {
      this.toastMessage('Ingrese una cédula para buscar.', 'warning');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();
    try {
      const expedientes = await this.expedientesDb.buscarPorCedula(cedula);
      const primero = expedientes[0];
      if (!primero) {
        this.pacienteEncontrado = null;
        this.cedulaNoEncontrada = true;
        this.toastMessage('No se encontró un expediente con esa cédula.', 'warning');
        return;
      }

      this.cedulaNoEncontrada = false;
      this.pacienteEncontrado = {
        id: primero.id,
        turno_id: primero.turno_id,
        codigo_ticket: `EXP-${primero.turno_id.slice(0, 6).toUpperCase()}`,
        paciente_nombre: this.areaVisible(primero.paciente_nombre),
        paciente_cedula: this.areaVisible(primero.paciente_cedula),
        paciente_telefono: primero.paciente_telefono ?? null,
        paciente_correo: primero.paciente_correo ?? null,
        servicio_nombre: this.areaVisible(primero.servicio_nombre),
        area_destino: this.areaNormalizada(primero.area_destino) || this.areaAtencionSeleccionada,
        estado: primero.estado,
        creado_at: primero.created_at ?? null,
        expediente: primero,
        prioridad: 'normal'
      };
      this.toastMessage('Paciente encontrado. Ya puede trabajar el expediente.', 'success');
    } catch (error) {
      console.error('Error buscando paciente por cédula', error);
      this.toastMessage('No se pudo buscar el paciente.', 'danger');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  iniciarFlujoDesdeCedula() {
    if (!this.pacienteEncontrado) return;
    this.abrirExpediente(this.pacienteEncontrado);
  }

  normalizarTexto(valor: string | null | undefined): string {
    if (!valor) return '';
    const mapa: Array<[string, string]> = [
      ['Ã¡', 'á'], ['Ã©', 'é'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'], ['Ã±', 'ñ'],
      ['Ã', 'Á'], ['Ã‰', 'É'], ['Ã', 'Í'], ['Ã“', 'Ó'], ['Ãš', 'Ú'], ['Ã‘', 'Ñ'],
      ['Â·', '·'], ['â€“', '–'], ['â€”', '—'], ['â€œ', '“'], ['â€', '”'],
      ['Cirug?a', 'Cirugía'], ['MÃ³dulo', 'Módulo'], ['ClÃ­nico', 'Clínico'],
      ['atenciÃ³n', 'atención'], ['bÃºsqueda', 'búsqueda'], ['Ã¡rea', 'área'],
      ['cÃ©dula', 'cédula'], ['telÃ©fono', 'teléfono'], ['sÃ­ntomas', 'síntomas'],
      ['Examen fÃ­sico', 'Examen físico'], ['ImpresiÃ³n', 'Impresión'],
      ['DiagnÃ³stico', 'Diagnóstico'], ['ConclusiÃ³n', 'Conclusión'],
      ['DuraciÃ³n', 'Duración'], ['aÃºn', 'aún']
    ];

    let texto = valor;
    for (const [malo, bueno] of mapa) {
      texto = texto.split(malo).join(bueno);
    }
    return texto;
  }

  areaNormalizada(area: string | null | undefined): string {
    return this.normalizarTexto(area).trim();
  }

  get formularioAreaActual(): FormularioArea {
    return this.formulariosPorArea[this.areaNormalizada(this.expedienteSeleccionado?.area_destino || this.areaAtencionSeleccionada) || 'Medicina General']
      ?? this.formulariosPorArea['Medicina General'];
  }

  get estadoActualEtiqueta() {
    const e = this.expedienteSeleccionado?.estado;
    if (e === 'completado') return 'Completado';
    if (e === 'en_proceso') return 'En atención';
    return 'Pendiente';
  }

  get estadoActualClase() {
    const e = this.expedienteSeleccionado?.estado;
    if (e === 'completado') return 'done';
    if (e === 'en_proceso') return 'doing';
    return 'waiting';
  }

  get areasDisponibles(): string[] {
    return ['todas', ...Object.keys(this.formulariosPorArea).filter(a =>
      this.expedientes.some(e => this.areaNormalizada(e.area_destino) === a)
    )];
  }

  areaVisible(area: string | null | undefined): string {
    return this.normalizarTexto(area).trim();
  }

  get expedientesFiltrados() {
    const texto = this.busquedaExpediente.trim().toLowerCase();
    return this.expedientes.filter(item => {
      const campo = `${this.areaVisible(item.paciente_nombre)} ${this.areaVisible(item.paciente_cedula)} ${this.areaVisible(item.codigo_ticket)} ${this.areaVisible(item.servicio_nombre)} ${this.areaVisible(item.area_destino)} ${this.areaVisible(item.paciente_telefono)} ${this.areaVisible(item.paciente_correo)}`.toLowerCase();
      const matchTexto = !texto || campo.includes(texto);
      const matchEstado = this.filtroEstado === 'todos' || item.estado === this.filtroEstado;
      const matchArea = this.filtroArea === 'todas' || this.areaNormalizada(item.area_destino) === this.filtroArea;
      return matchTexto && matchEstado && matchArea;
    });
  }

  get timerColor(): string {
    if (this.timerSegundos < 600) return '#16a34a';
    if (this.timerSegundos < 1200) return '#d97706';
    return '#dc2626';
  }

  actualizarEstadisticas() {
    this.estadisticas.total = this.expedientes.length;
    this.estadisticas.completados = this.expedientes.filter(e => e.estado === 'completado').length;
    this.estadisticas.en_proceso = this.expedientes.filter(e => e.estado === 'en_proceso').length;
    this.estadisticas.pendientes = this.expedientes.filter(e => e.estado === 'borrador').length;
    const areas: Record<string, number> = {};
    this.expedientes.forEach(e => {
      const area = this.areaNormalizada(e.area_destino);
      areas[area] = (areas[area] || 0) + 1;
    });
    this.estadisticas.areas = areas;
  }

  iniciarTimer() {
    if (this.timerActivo) {
      this.pausarTimer();
      return;
    }
    this.timerActivo = true;
    this.timerInterval = setInterval(() => {
      this.timerSegundos++;
      const m = Math.floor(this.timerSegundos / 60).toString().padStart(2, '0');
      const s = (this.timerSegundos % 60).toString().padStart(2, '0');
      this.timerLabel = `${m}:${s}`;
      this.cdr.detectChanges();
    }, 1000);
  }

  pausarTimer() {
    this.timerActivo = false;
    clearInterval(this.timerInterval);
  }

  detenerTimer() {
    this.timerActivo = false;
    this.timerSegundos = 0;
    this.timerLabel = '00:00';
    clearInterval(this.timerInterval);
  }

  setTab(tab: 'historia' | 'evaluacion' | 'tratamiento' | 'archivos') {
    this.tabActiva = tab;
  }

  getAreaIcono(area: string): string {
    const clave = this.areaNormalizada(area) || 'Medicina General';
    return this.formulariosPorArea[clave]?.icon ?? 'fa-stethoscope';
  }

  getAreaColor(area: string): string {
    const clave = this.areaNormalizada(area) || 'Medicina General';
    return this.formulariosPorArea[clave]?.color ?? '#1d3973';
  }

  getAreaCount(area: string): number {
    return this.estadisticas.areas[area] ?? 0;
  }

  async cargarBandeja() {
    this.isLoading = true;
    this.cdr.detectChanges();
    try {
      const expedientes = await this.expedientesDb.listarBandejaMedica();
      const cobros = await Promise.all(
        expedientes.map(async (e) => {
          if (!e.cobro_id) return null;
          try { return await this.cobrosDb.buscarPorTurnoId(e.turno_id); }
          catch { return null; }
        })
      );
      this.expedientes = expedientes.map((expediente, index) => {
        const cobro = cobros[index];
        const areaDestino = this.areaNormalizada(expediente.area_destino) || expediente.area_destino;
        return {
          id: expediente.id,
          turno_id: expediente.turno_id,
          codigo_ticket: cobro?.codigo_ticket ?? `MED-${expediente.turno_id.slice(0, 6).toUpperCase()}`,
          paciente_nombre: this.areaVisible(expediente.paciente_nombre),
          paciente_cedula: this.areaVisible(expediente.paciente_cedula),
          paciente_telefono: expediente.paciente_telefono ? this.areaVisible(expediente.paciente_telefono) : null,
          paciente_correo: expediente.paciente_correo ? this.areaVisible(expediente.paciente_correo) : null,
          servicio_nombre: this.areaVisible(expediente.servicio_nombre),
          area_destino: areaDestino,
          estado: expediente.estado,
          creado_at: expediente.created_at ?? null,
          expediente,
          prioridad: 'normal' as 'normal'
        };
      });
      this.actualizarEstadisticas();
    } catch (error) {
      console.error('Error cargando expedientes médicos', error);
      this.toastMessage('No se pudo cargar la bandeja médica.', 'danger');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async abrirExpediente(fila: PacienteMedicoFila) {
    this.expedienteSeleccionado = {
      ...fila,
      paciente_nombre: this.areaVisible(fila.paciente_nombre),
      paciente_cedula: this.areaVisible(fila.paciente_cedula),
      paciente_telefono: fila.paciente_telefono ? this.areaVisible(fila.paciente_telefono) : null,
      paciente_correo: fila.paciente_correo ? this.areaVisible(fila.paciente_correo) : null,
          servicio_nombre: this.areaVisible(fila.servicio_nombre),
      area_destino: this.areaNormalizada(fila.area_destino) || fila.area_destino,
    };
    this.expedienteActual = fila.expediente ?? (await this.expedientesDb.buscarPorTurnoId(fila.turno_id));
    this.consultaForm = {
      motivo_consulta: this.expedienteActual?.motivo_consulta ?? '',
      antecedentes: this.expedienteActual?.antecedentes ?? '',
      sintomas_actuales: '',
      signos_vitales: '',
      examen_fisico: this.expedienteActual?.examen_fisico ?? '',
      impresion_clinica: '',
      diagnostico: this.expedienteActual?.diagnostico ?? '',
      tratamiento: this.expedienteActual?.tratamiento ?? '',
      indicaciones: this.expedienteActual?.indicaciones ?? '',
      conclusion: this.expedienteActual?.conclusion ?? '',
      requiere_receta: this.expedienteActual?.requiere_receta ?? false,
      requiere_orden_estudio: false,
      requiere_interconsulta: false,
      whatsapp_envio: this.expedienteActual?.whatsapp_envio ?? fila.paciente_telefono ?? '',
      notas_rapidas: '',
      alergias: '',
      presion_arterial: '',
      frecuencia_cardiaca: '',
      temperatura: '',
      peso: '',
      saturacion: ''
    };
    this.tabActiva = 'historia';
    this.detenerTimer();
    this.vistaActual = 'expediente';
    await this.cargarAdjuntosYRecetas(this.expedienteActual?.id ?? '');
  }

  async cargarAdjuntosYRecetas(expedienteId: string) {
    if (!expedienteId) { this.recetas = []; this.archivos = []; return; }
    try {
      const [recetas, archivos] = await Promise.all([
        this.expedientesDb.listarRecetas(expedienteId),
        this.expedientesDb.listarArchivos(expedienteId)
      ]);
      this.recetas = recetas;
      this.archivos = archivos as Array<{ id: string; nombre_archivo: string; url: string; tipo_archivo: string; created_at?: string }>;
    } catch {
      this.toastMessage('No se pudieron cargar los archivos del expediente.', 'warning');
    }
  }

  volverALista() {
    this.detenerTimer();
    this.vistaActual = 'bandeja';
    this.expedienteSeleccionado = null;
    this.expedienteActual = null;
    this.recetas = [];
    this.archivos = [];
    this.consultaForm = this.formularioInicial();
    this.medicamentoForm = this.medicamentoInicial();
  }

  async tomarPaciente() {
    if (!this.expedienteSeleccionado) return;
    if (!this.expedienteActual) {
      try {
        this.expedienteActual = await this.expedientesDb.crearExpediente({
          turno_id: this.expedienteSeleccionado.turno_id,
          cobro_id: null,
          paciente_id: null,
          paciente_nombre: this.expedienteSeleccionado.paciente_nombre,
          paciente_cedula: this.expedienteSeleccionado.paciente_cedula,
          paciente_telefono: this.expedienteSeleccionado.paciente_telefono,
          paciente_correo: this.expedienteSeleccionado.paciente_correo,
          servicio_nombre: this.areaVisible(this.expedienteSeleccionado.servicio_nombre),
          area_destino: this.areaVisible(this.expedienteSeleccionado.area_destino),
          motivo_consulta: null,
          antecedentes: null,
          examen_fisico: null,
          diagnostico: null,
          tratamiento: null,
          indicaciones: null,
          conclusion: null,
          requiere_receta: false,
          estado: 'en_proceso',
          medico_nombre: this.usuarioNombre,
          medico_rol: this.usuarioRol,
          fecha_atencion: new Date().toISOString(),
          fecha_cierre: null,
          whatsapp_envio: this.consultaForm.whatsapp_envio || null,
          archivo_pdf_url: null
        });
        this.expedienteSeleccionado.expediente = this.expedienteActual;
      } catch {
        this.toastMessage('No se pudo abrir el expediente.', 'danger');
        return;
      }
    }
    await this.expedientesDb.actualizarExpediente(this.expedienteActual.id, {
      estado: 'en_proceso',
      medico_nombre: this.usuarioNombre,
      medico_rol: this.usuarioRol,
      fecha_atencion: this.expedienteActual.fecha_atencion ?? new Date().toISOString()
    });
    this.iniciarTimer();
    this.toastMessage(`Consulta iniciada — ${this.expedienteSeleccionado.paciente_nombre}`, 'success');
  }

  agregarMedicamento() {
    if (!this.medicamentoForm.medicamento.trim()) {
      this.toastMessage('Ingrese el nombre del medicamento.', 'warning');
      return;
    }
    this.recetas = [
      ...this.recetas,
      {
        id: `tmp-${Date.now()}`,
        expediente_id: this.expedienteActual?.id ?? '',
        medicamento: this.medicamentoForm.medicamento.trim(),
        dosis: this.medicamentoForm.dosis.trim() || null,
        frecuencia: this.medicamentoForm.frecuencia.trim() || null,
        duracion: this.medicamentoForm.duracion.trim() || null,
        instrucciones: this.medicamentoForm.instrucciones.trim() || null,
        orden: this.recetas.length + 1,
        created_at: new Date().toISOString()
      }
    ];
    this.medicamentoForm = this.medicamentoInicial();
    this.toastMessage('Medicamento agregado.', 'success');
  }

  eliminarMedicamento(index: number) {
    this.recetas = this.recetas.filter((_, i) => i !== index);
  }

  async guardarExpediente() {
    if (!this.expedienteActual) { this.toastMessage('Primero abra un expediente.', 'warning'); return; }
    if (!this.consultaForm.diagnostico.trim()) { this.toastMessage('El diagnóstico es obligatorio.', 'warning'); return; }

    this.isSaving = true;
    try {
      const examenFisico = [
        this.consultaForm.sintomas_actuales ? `Síntomas actuales: ${this.consultaForm.sintomas_actuales}` : '',
        this.consultaForm.presion_arterial ? `TA: ${this.consultaForm.presion_arterial}` : '',
        this.consultaForm.frecuencia_cardiaca ? `FC: ${this.consultaForm.frecuencia_cardiaca}` : '',
        this.consultaForm.temperatura ? `Temp: ${this.consultaForm.temperatura}` : '',
        this.consultaForm.peso ? `Peso: ${this.consultaForm.peso}` : '',
        this.consultaForm.saturacion ? `SpO2: ${this.consultaForm.saturacion}` : '',
        this.consultaForm.signos_vitales || '',
        this.consultaForm.examen_fisico || ''
      ].filter(Boolean).join('\n');

      const expediente = await this.expedientesDb.actualizarExpediente(this.expedienteActual.id, {
        motivo_consulta: this.consultaForm.motivo_consulta || null,
        antecedentes: [this.consultaForm.antecedentes, this.consultaForm.alergias ? `Alergias: ${this.consultaForm.alergias}` : ''].filter(Boolean).join('\n') || null,
        examen_fisico: examenFisico || null,
        diagnostico: this.consultaForm.diagnostico || null,
        tratamiento: this.consultaForm.tratamiento || null,
        indicaciones: this.consultaForm.indicaciones || null,
        conclusion: this.consultaForm.conclusion || null,
        requiere_receta: this.consultaForm.requiere_receta,
        estado: 'completado',
        medico_nombre: this.usuarioNombre,
        medico_rol: this.usuarioRol,
        whatsapp_envio: this.consultaForm.whatsapp_envio || null,
        fecha_cierre: new Date().toISOString()
      });
      this.expedienteActual = expediente;
      this.expedienteSeleccionado = { ...this.expedienteSeleccionado!, estado: 'completado', expediente };

      for (const [index, receta] of this.recetas.entries()) {
        if (receta.id.startsWith('tmp-')) {
          await this.expedientesDb.agregarReceta({
            expediente_id: expediente.id,
            medicamento: receta.medicamento,
            dosis: receta.dosis ?? null,
            frecuencia: receta.frecuencia ?? null,
            duracion: receta.duracion ?? null,
            instrucciones: receta.instrucciones ?? null,
            orden: index + 1
          });
        }
      }
      this.detenerTimer();
      await this.cargarAdjuntosYRecetas(expediente.id);
      this.toastMessage('Expediente completado exitosamente.', 'success');
      await this.cargarBandeja();
    } catch {
      this.toastMessage('No se pudo guardar el expediente.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  generarPdf() {
    if (!this.expedienteSeleccionado) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const paciente = this.expedienteSeleccionado;
    const fecha = new Date().toLocaleString('es-DO');
    const recetasHtml = this.recetas.length
      ? this.recetas.map((med, i) => `<tr><td>${i+1}</td><td>${med.medicamento}</td><td>${med.dosis||'-'}</td><td>${med.frecuencia||'-'}</td><td>${med.duracion||'-'}</td><td>${med.instrucciones||'-'}</td></tr>`).join('')
      : '<tr><td colspan="6" class="muted">No se registraron medicamentos.</td></tr>';

    const vitalesHtml = [
      this.consultaForm.presion_arterial ? `<div class="vital"><span>TA</span><strong>${this.consultaForm.presion_arterial}</strong></div>` : '',
      this.consultaForm.frecuencia_cardiaca ? `<div class="vital"><span>FC</span><strong>${this.consultaForm.frecuencia_cardiaca}</strong></div>` : '',
      this.consultaForm.temperatura ? `<div class="vital"><span>Temp</span><strong>${this.consultaForm.temperatura}</strong></div>` : '',
      this.consultaForm.peso ? `<div class="vital"><span>Peso</span><strong>${this.consultaForm.peso}</strong></div>` : '',
      this.consultaForm.saturacion ? `<div class="vital"><span>SpO2</span><strong>${this.consultaForm.saturacion}</strong></div>` : '',
    ].filter(Boolean).join('') || '<span class="muted">No registrados</span>';

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Expediente ${paciente.paciente_nombre}</title>
    <style>@page{size:A4;margin:14mm 12mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#0f1e35;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;line-height:1.5}
    .sheet{width:100%;max-width:190mm;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;margin-bottom:14px;border-bottom:3px solid #1d3973}
    .brand h1{margin:0;font-size:20px;color:#1d3973}.brand p{margin:2px 0;color:#4f6280;font-size:10px}
    .institution{text-align:right;color:#4f6280;font-size:10px}
    .title-bar{background:#1d3973;color:#fff;padding:8px 14px;border-radius:8px;text-align:center;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
    .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
    .meta-box{border:1px solid #dbe5f0;border-radius:8px;padding:8px 10px}
    .label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#6a7f9f;margin-bottom:2px}
    .value{font-size:11px;font-weight:700}
    .vitales{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
    .vital{border:1px solid #dbe5f0;border-radius:8px;padding:6px 10px;text-align:center}
    .vital span{display:block;font-size:9px;color:#6a7f9f;text-transform:uppercase}
    .vital strong{display:block;font-size:13px;color:#1d3973}
    .section{margin-top:10px;border:1px solid #dbe5f0;border-radius:10px;overflow:hidden}
    .section-header{background:#f0f5ff;color:#1d3973;padding:7px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
    .section-body{padding:10px 12px}
    .field-block{border:1px solid #e7eef7;border-radius:8px;padding:7px 10px;min-height:40px;margin-bottom:8px}
    .checks{display:flex;gap:12px;flex-wrap:wrap}
    .check{border:1px solid #dbe5f0;border-radius:99px;padding:4px 10px;font-weight:700;font-size:10px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #dbe5f0;padding:6px 8px;text-align:left}
    th{background:#f7f9fc;font-size:9px;text-transform:uppercase}
    td{font-size:10px}
    .muted{color:#6a7f9f;text-align:center}
    .footer-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
    .signature{border-top:1px solid #9fb3c8;text-align:center;padding-top:8px;margin-top:28px;font-size:10px;color:#4f6280}
    </style></head><body><div class="sheet">
    <div class="header">
      <div class="brand"><h1>FUNBIDE</h1><p>Fundación Bienestar y Desarrollo, INC. — RNC 430090387</p></div>
      <div class="institution"><strong>Expediente Clínico</strong><br/>${this.formularioAreaActual.titulo}<br/>Fecha: ${fecha}</div>
    </div>
    <div class="title-bar">Formulario clínico de atención — ${this.formularioAreaActual.titulo}</div>
    <div class="meta-grid">
      <div class="meta-box"><span class="label">Paciente</span><div class="value">${paciente.paciente_nombre}</div></div>
      <div class="meta-box"><span class="label">Cédula</span><div class="value">${paciente.paciente_cedula}</div></div>
      <div class="meta-box"><span class="label">Ticket</span><div class="value">${paciente.codigo_ticket}</div></div>
      <div class="meta-box"><span class="label">Teléfono</span><div class="value">${paciente.paciente_telefono||'-'}</div></div>
      <div class="meta-box"><span class="label">Correo</span><div class="value">${paciente.paciente_correo||'-'}</div></div>
      <div class="meta-box"><span class="label">Estado</span><div class="value">${this.estadoActualEtiqueta}</div></div>
    </div>
    <div class="section"><div class="section-header">Signos vitales</div><div class="section-body"><div class="vitales">${vitalesHtml}</div></div></div>
    <div class="section"><div class="section-header">Historia clínica</div><div class="section-body">
      <div class="field-block"><span class="label">Motivo de consulta</span><div>${this.consultaForm.motivo_consulta||'-'}</div></div>
      <div class="field-block"><span class="label">Antecedentes / Alergias</span><div>${this.consultaForm.antecedentes||'-'}${this.consultaForm.alergias?' | Alergias: '+this.consultaForm.alergias:''}</div></div>
      <div class="field-block"><span class="label">Síntomas actuales</span><div>${this.consultaForm.sintomas_actuales||'-'}</div></div>
    </div></div>
    <div class="section"><div class="section-header">Evaluación médica</div><div class="section-body">
      <div class="field-block"><span class="label">Examen físico</span><div>${this.consultaForm.examen_fisico||'-'}</div></div>
      <div class="field-block"><span class="label">Impresión clínica</span><div>${this.consultaForm.impresion_clinica||'-'}</div></div>
      <div class="field-block"><span class="label">Diagnóstico</span><div>${this.consultaForm.diagnostico||'-'}</div></div>
    </div></div>
    <div class="section"><div class="section-header">Plan terapéutico</div><div class="section-body">
      <div class="field-block"><span class="label">Tratamiento</span><div>${this.consultaForm.tratamiento||'-'}</div></div>
      <div class="field-block"><span class="label">Indicaciones</span><div>${this.consultaForm.indicaciones||'-'}</div></div>
      <div class="field-block"><span class="label">Conclusión</span><div>${this.consultaForm.conclusion||'-'}</div></div>
      <div class="checks">
        <span class="check">Receta: ${this.consultaForm.requiere_receta?'Sí':'No'}</span>
        <span class="check">Estudios: ${this.consultaForm.requiere_orden_estudio?'Sí':'No'}</span>
        <span class="check">Interconsulta: ${this.consultaForm.requiere_interconsulta?'Sí':'No'}</span>
      </div>
    </div></div>
    <div class="section"><div class="section-header">Receta médica</div><div class="section-body">
      <table><thead><tr><th>#</th><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Duración</th><th>Instrucciones</th></tr></thead>
      <tbody>${recetasHtml}</tbody></table>
    </div></div>
    <div class="footer-grid">
      <div class="section"><div class="section-header">Datos de envío</div><div class="section-body">
        <div class="field-block"><span class="label">WhatsApp</span><div>${this.consultaForm.whatsapp_envio||'-'}</div></div>
      </div></div>
      <div class="section"><div class="section-header">Firma médico</div><div class="section-body">
        <div class="field-block"><span class="label">Médico tratante</span><div>${this.usuarioNombre} — ${this.usuarioRol}</div></div>
        <div class="signature">Firma y sello</div>
      </div></div>
    </div>
    </div><script>window.print();setTimeout(()=>window.close(),500);</script></body></html>`;
    win.document.write(html);
    win.document.close();
  }

  volver() { this.back.emit(); }

  private toastMessage(message: string, type: 'success' | 'warning' | 'danger' | 'info') {
    this.toast = message;
    this.toastType = type;
    window.setTimeout(() => { if (this.toast === message) this.toast = ''; }, 3500);
  }
}
