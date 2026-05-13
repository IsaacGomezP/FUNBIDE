import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CobrosDbService } from '../../services/cobros-db.service';
import { ExpedientesLaboratorioDbService, ExpedienteLaboratorioDb, ResultadoLaboratorioDb } from '../../services/expedientes-laboratorio-db.service';

interface FileCard {
  id: string;
  turno_id: string;
  codigo_ticket: string;
  paciente_nombre: string;
  paciente_cedula: string;
  paciente_edad: number | null;
  paciente_telefono: string | null;
  servicio_nombre: string;
  area_destino: string;
  estado: ExpedienteLaboratorioDb['estado'];
  created_at: string | null;
  expediente?: ExpedienteLaboratorioDb | null;
}

interface FileForm {
  motivo: string;
  observaciones: string;
  resultadoGeneral: string;
  conclusion: string;
  correo: string;
  whatsapp: string;
}

interface AnalisisForm {
  analisis: string;
  valor: string;
  unidad: string;
  rango_referencia: string;
  observacion: string;
}

@Component({
  selector: 'app-modulo-laboratorio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modulo-laboratorio.html',
  styleUrls: ['./modulo-laboratorio.css']
})
export class ModuloLaboratorioComponent implements OnInit {
  @Output() back = new EventEmitter<void>();
  @Input() usuarioNombre = 'Laboratorista';
  @Input() usuarioRol = 'Laboratorio';

  vista: 'cola' | 'expediente' = 'cola';
  isLoading = false;
  isSaving = false;
  busqueda = '';
  files: FileCard[] = [];
  fileSeleccionado: FileCard | null = null;
  expedienteActual: ExpedienteLaboratorioDb | null = null;
  resultados: ResultadoLaboratorioDb[] = [];
  archivos: Array<{ id: string; nombre_archivo: string; url: string; tipo_archivo: string; created_at?: string }> = [];
  toast = '';
  toastType: 'success' | 'warning' | 'danger' | 'info' = 'info';

  archivoForm: FileForm = {
    motivo: '',
    observaciones: '',
    resultadoGeneral: '',
    conclusion: '',
    correo: '',
    whatsapp: ''
  };

  analisisForm: AnalisisForm = {
    analisis: '',
    valor: '',
    unidad: '',
    rango_referencia: '',
    observacion: ''
  };

  constructor(
    private expedientesDb: ExpedientesLaboratorioDbService,
    private cobrosDb: CobrosDbService
  ) {}

  async ngOnInit() {
    await this.cargarBandeja();
  }

  async cargarBandeja() {
    this.isLoading = true;
    try {
      const expedientes = await this.expedientesDb.listarPendientes();
      const mapped: FileCard[] = [];

      for (const expediente of expedientes) {
        const cobro = expediente.cobro_id ? await this.cobrosDb.buscarPorTurnoId(expediente.turno_id) : null;
        mapped.push({
          id: expediente.id,
          turno_id: expediente.turno_id,
          codigo_ticket: cobro?.codigo_ticket ?? `LAB-${expediente.turno_id.slice(0, 6).toUpperCase()}`,
          paciente_nombre: expediente.paciente_nombre,
          paciente_cedula: expediente.paciente_cedula,
          paciente_edad: expediente.paciente_edad ?? null,
          paciente_telefono: expediente.paciente_telefono ?? null,
          servicio_nombre: expediente.servicio_nombre,
          area_destino: expediente.area_destino,
          estado: expediente.estado,
          created_at: expediente.created_at ?? null,
          expediente
        });
      }

      this.files = mapped;
    } catch (error) {
      console.error('Error cargando laboratorio', error);
      this.toastMessage('No se pudo cargar la bandeja.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  filtrarCola() {
    const q = this.busqueda.trim().toLowerCase();
    if (!q) return this.files;
    return this.files.filter((item) =>
      `${item.codigo_ticket} ${item.paciente_nombre} ${item.paciente_cedula} ${item.servicio_nombre} ${item.area_destino}`.toLowerCase().includes(q)
    );
  }

  abrirArchivo(item: FileCard) {
    this.fileSeleccionado = item;
    this.expedienteActual = item.expediente ?? null;
    this.archivoForm = {
      motivo: item.expediente?.motivo ?? '',
      observaciones: item.expediente?.observaciones ?? '',
      resultadoGeneral: item.expediente?.resultado_general ?? '',
      conclusion: item.expediente?.conclusion ?? '',
      correo: item.expediente?.correo_envio ?? '',
      whatsapp: item.expediente?.whatsapp_envio ?? ''
    };
    this.vista = 'expediente';
    this.resultados = [];
    this.archivos = [];

    if (this.expedienteActual) {
      void this.cargarDetalle(this.expedienteActual.id);
    }
  }

  async cargarDetalle(expedienteId: string) {
    try {
      const [resultados, archivos] = await Promise.all([
        this.expedientesDb.listarResultados(expedienteId),
        this.expedientesDb.listarArchivos(expedienteId)
      ]);
      this.resultados = resultados;
      this.archivos = archivos as Array<{ id: string; nombre_archivo: string; url: string; tipo_archivo: string; created_at?: string }>;
    } catch (error) {
      console.error('Error cargando detalle laboratorio', error);
      this.toastMessage('No se pudo cargar el expediente.', 'warning');
    }
  }

  volverACola() {
    this.vista = 'cola';
    this.fileSeleccionado = null;
    this.expedienteActual = null;
    this.resultados = [];
    this.archivos = [];
    this.analisisForm = {
      analisis: '',
      valor: '',
      unidad: '',
      rango_referencia: '',
      observacion: ''
    };
  }

  async atenderArchivo() {
    if (!this.fileSeleccionado) return;

    if (!this.expedienteActual) {
      try {
        this.expedienteActual = await this.expedientesDb.crearExpediente({
          turno_id: this.fileSeleccionado.turno_id,
          cobro_id: null,
          paciente_nombre: this.fileSeleccionado.paciente_nombre,
          paciente_cedula: this.fileSeleccionado.paciente_cedula,
          paciente_edad: this.fileSeleccionado.paciente_edad,
          paciente_telefono: this.fileSeleccionado.paciente_telefono,
          servicio_nombre: this.fileSeleccionado.servicio_nombre,
          servicio_id: null,
          area_destino: this.fileSeleccionado.area_destino,
          motivo: this.archivoForm.motivo || null,
          observaciones: this.archivoForm.observaciones || null,
          resultado_general: null,
          conclusion: null,
          correo_envio: this.archivoForm.correo || null,
          whatsapp_envio: this.archivoForm.whatsapp || null,
          estado: 'en_proceso',
          enviado_por: this.usuarioNombre,
          completado_por: null,
          fecha_enviado: new Date().toISOString(),
          fecha_completado: null,
          archivo_pdf_url: null
        });
        this.fileSeleccionado.expediente = this.expedienteActual;
      } catch (error) {
        console.error('Error creando expediente laboratorio', error);
        this.toastMessage('No se pudo abrir el expediente.', 'danger');
        return;
      }
    }

    this.toastMessage(`Archivo de ${this.fileSeleccionado.paciente_nombre} listo para análisis.`, 'success');
  }

  agregarResultado() {
    if (!this.analisisForm.analisis.trim()) {
      this.toastMessage('Ingrese el nombre del análisis.', 'warning');
      return;
    }

    this.resultados = [
      ...this.resultados,
      {
        id: `tmp-${Date.now()}`,
        expediente_id: this.expedienteActual?.id ?? '',
        analisis: this.analisisForm.analisis.trim(),
        valor: this.analisisForm.valor.trim() || null,
        unidad: this.analisisForm.unidad.trim() || null,
        rango_referencia: this.analisisForm.rango_referencia.trim() || null,
        observacion: this.analisisForm.observacion.trim() || null,
        orden: this.resultados.length + 1,
        created_at: new Date().toISOString()
      }
    ];

    this.analisisForm = {
      analisis: '',
      valor: '',
      unidad: '',
      rango_referencia: '',
      observacion: ''
    };
  }

  eliminarResultado(index: number) {
    this.resultados = this.resultados.filter((_, current) => current !== index);
  }

  async completarAnalisis() {
    if (!this.expedienteActual) {
      this.toastMessage('Abra un expediente primero.', 'warning');
      return;
    }

    this.isSaving = true;
    try {
      const expediente = await this.expedientesDb.actualizarExpediente(this.expedienteActual.id, {
        motivo: this.archivoForm.motivo || null,
        observaciones: this.archivoForm.observaciones || null,
        resultado_general: this.archivoForm.resultadoGeneral || null,
        conclusion: this.archivoForm.conclusion || null,
        correo_envio: this.archivoForm.correo || null,
        whatsapp_envio: this.archivoForm.whatsapp || null,
        estado: 'completado',
        completado_por: this.usuarioNombre,
        fecha_completado: new Date().toISOString()
      });
      this.expedienteActual = expediente;

      for (const [index, resultado] of this.resultados.entries()) {
        if (resultado.id.startsWith('tmp-')) {
          await this.expedientesDb.agregarResultado({
            expediente_id: expediente.id,
            analisis: resultado.analisis,
            valor: resultado.valor ?? null,
            unidad: resultado.unidad ?? null,
            rango_referencia: resultado.rango_referencia ?? null,
            observacion: resultado.observacion ?? null,
            orden: index + 1
          });
        }
      }

      this.toastMessage('Análisis completado y listo para envío.', 'success');
      await this.cargarDetalle(expediente.id);
      await this.cargarBandeja();
    } catch (error) {
      console.error('Error completando análisis', error);
      this.toastMessage('No se pudo completar el análisis.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  enviarResultados() {
    if (!this.expedienteActual) {
      this.toastMessage('Abra y complete un expediente antes de enviar.', 'warning');
      return;
    }

    const destino = this.archivoForm.correo || this.fileSeleccionado?.paciente_telefono || this.archivoForm.whatsapp;
    if (!destino) {
      this.toastMessage('Agregue correo o WhatsApp para el envío.', 'warning');
      return;
    }

    void this.expedientesDb.actualizarExpediente(this.expedienteActual.id, {
      correo_envio: this.archivoForm.correo || null,
      whatsapp_envio: this.archivoForm.whatsapp || null,
      estado: 'enviado'
    }).then(() => {
      this.toastMessage('Resultados preparados para envío.', 'success');
    }).catch((error) => {
      console.error('Error enviando resultados', error);
      this.toastMessage('No se pudieron enviar los resultados.', 'danger');
    });
  }

  imprimirPDF() {
    if (!this.fileSeleccionado) {
      this.toastMessage('Seleccione un expediente primero.', 'warning');
      return;
    }

    const win = window.open('', '_blank');
    if (!win) return;

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Resultados ${this.fileSeleccionado.codigo_ticket}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:24px;color:#10213a;background:#f6f9fc}
            .sheet{max-width:900px;margin:0 auto;background:#fff;border:1px solid #dbe5f0;border-radius:20px;padding:24px}
            .head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
            h1{margin:0;font-size:26px}
            .meta{color:#6a7f9f}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th,td{border-bottom:1px solid #e5ecf5;padding:10px;text-align:left;font-size:13px}
            .block{margin-top:16px}
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="head">
              <div>
                <h1>FUNBIDE | Laboratorio Clínico</h1>
                <div class="meta">${this.fileSeleccionado.codigo_ticket} - ${this.fileSeleccionado.paciente_nombre}</div>
              </div>
              <div class="meta">${new Date().toLocaleString('es-DO')}</div>
            </div>
            <div class="block"><strong>Paciente:</strong> ${this.fileSeleccionado.paciente_nombre}</div>
            <div class="block"><strong>Cédula:</strong> ${this.fileSeleccionado.paciente_cedula}</div>
            <table>
              <thead><tr><th>Análisis</th><th>Valor</th><th>Unidad</th><th>Rango</th><th>Obs.</th></tr></thead>
              <tbody>
                ${this.resultados.map(r => `<tr><td>${r.analisis}</td><td>${r.valor || '-'}</td><td>${r.unidad || '-'}</td><td>${r.rango_referencia || '-'}</td><td>${r.observacion || '-'}</td></tr>`).join('')}
              </tbody>
            </table>
            <div class="block"><strong>Conclusión:</strong> ${this.archivoForm.conclusion || '-'}</div>
          </div>
          <script>window.print();setTimeout(()=>window.close(),400);</script>
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
  }

  volver() {
    this.back.emit();
  }

  private toastMessage(message: string, type: 'success' | 'warning' | 'danger' | 'info') {
    this.toast = message;
    this.toastType = type;
    window.setTimeout(() => {
      if (this.toast === message) {
        this.toast = '';
      }
    }, 3200);
  }
}
