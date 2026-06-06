import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ServicioPrecioDb, ServiciosPreciosDbService } from '../../services/servicios-precios-db.service';

interface ServicioPrecioForm {
  id?: string;
  codigo: string;
  nombre: string;
  area_destino: string;
  categoria: string;
  precio: number;
  precio_subsidiado: number | null;
  precio_contributivo: number | null;
  precio_renacer: number | null;
  aplica_seguro: boolean;
  activo: boolean;
}

const CATALOGO_FIJO: Omit<ServicioPrecioDb, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    codigo: 'MED001',
    nombre: 'CONSULTA MEDICINA GENERAL',
    area_destino: 'Consultas Medicas',
    categoria: 'Consultas Medicas',
    precio: 700,
    precio_subsidiado: 700,
    precio_contributivo: 700,
    precio_renacer: 700,
    aplica_seguro: true,
    activo: true
  },
  {
    codigo: 'MED002',
    nombre: 'CONSULTA MEDICINA FAMILIAR',
    area_destino: 'Consultas Medicas',
    categoria: 'Consultas Medicas',
    precio: 700,
    precio_subsidiado: 700,
    precio_contributivo: 700,
    precio_renacer: 700,
    aplica_seguro: true,
    activo: true
  },
  {
    codigo: 'MED003',
    nombre: 'CONSULTA GINECOBSTETRA',
    area_destino: 'Consultas Medicas',
    categoria: 'Consultas Medicas',
    precio: 700,
    precio_subsidiado: 700,
    precio_contributivo: 700,
    precio_renacer: 700,
    aplica_seguro: true,
    activo: true
  },
  {
    codigo: 'MED004',
    nombre: 'CONSULTA PEDIATRIA',
    area_destino: 'Consultas Medicas',
    categoria: 'Consultas Medicas',
    precio: 700,
    precio_subsidiado: 700,
    precio_contributivo: 700,
    precio_renacer: 700,
    aplica_seguro: true,
    activo: true
  },
  {
    codigo: 'SON001',
    nombre: 'SONOGRAFIA ABDOMINAL',
    area_destino: 'Sonografias',
    categoria: 'Sonografias',
    precio: 600,
    precio_subsidiado: 600,
    precio_contributivo: 600,
    precio_renacer: 600,
    aplica_seguro: true,
    activo: true
  },
  {
    codigo: 'LAB001',
    nombre: 'HEMOGRAMA',
    area_destino: 'Laboratorio',
    categoria: 'Laboratorio',
    precio: 200,
    precio_subsidiado: 200,
    precio_contributivo: 200,
    precio_renacer: 200,
    aplica_seguro: true,
    activo: true
  },
  {
    codigo: 'ODO001',
    nombre: 'CONSULTA ODONTOLOGICA GENERAL',
    area_destino: 'Odontologia',
    categoria: 'Odontologia',
    precio: 600,
    precio_subsidiado: 600,
    precio_contributivo: 600,
    precio_renacer: 600,
    aplica_seguro: true,
    activo: true
  },
  {
    codigo: 'ORT001',
    nombre: 'ORTOPEDIA',
    area_destino: 'Ortopedia',
    categoria: 'Ortopedia',
    precio: 500,
    precio_subsidiado: 500,
    precio_contributivo: 500,
    precio_renacer: 500,
    aplica_seguro: true,
    activo: true
  }
];

@Component({
  selector: 'app-modulo-gestor-precios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modulo-gestor-precios.html',
  styleUrls: ['./modulo-gestor-precios.css']
})
export class ModuloGestorPreciosComponent implements OnInit {
  @Input() usuarioNombre = '';
  @Input() usuarioRol = '';
  @Output() back = new EventEmitter<void>();

  loading = true;
  guardando = false;
  sincronizando = false;
  toast = '';
  toastType: 'success' | 'warning' | 'danger' | 'info' = 'info';
  filtroTexto = '';
  filtroEstado: 'todos' | 'activos' | 'inactivos' = 'todos';
  filtroCategoria = 'todas';
  modoEdicion = false;
  servicios: ServicioPrecioDb[] = [];
  formulario: ServicioPrecioForm = this.formularioInicial();

  resumen = {
    total: 0,
    activos: 0,
    inactivos: 0,
    conSeguro: 0
  };

  constructor(
    private serviciosDb: ServiciosPreciosDbService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.cargarServicios();
  }

  volver() {
    this.back.emit();
  }

  formularioInicial(): ServicioPrecioForm {
    return {
      codigo: '',
      nombre: '',
      area_destino: '',
      categoria: '',
      precio: 0,
      precio_subsidiado: 0,
      precio_contributivo: 0,
      precio_renacer: 0,
      aplica_seguro: true,
      activo: true
    };
  }

  get serviciosFiltrados(): ServicioPrecioDb[] {
    return this.servicios.filter((servicio) => {
      const texto = this.filtroTexto.trim().toLowerCase();
      const coincideTexto =
        !texto ||
        `${servicio.codigo} ${servicio.nombre} ${servicio.area_destino} ${servicio.categoria} ${servicio.precio} ${servicio.precio_subsidiado ?? ''} ${servicio.precio_contributivo ?? ''} ${servicio.precio_renacer ?? ''}`.toLowerCase().includes(texto);
      const coincideEstado =
        this.filtroEstado === 'todos' ||
        (this.filtroEstado === 'activos' && servicio.activo) ||
        (this.filtroEstado === 'inactivos' && !servicio.activo);
      const coincideCategoria =
        this.filtroCategoria === 'todas' ||
        this.claveNormalizada(servicio.categoria) === this.claveNormalizada(this.filtroCategoria);

      return coincideTexto && coincideEstado && coincideCategoria;
    });
  }

  get categoriasDisponibles(): string[] {
    const categorias = new Set(this.servicios.map((servicio) => this.textoCapitalizado(servicio.categoria)).filter(Boolean));
    return Array.from(categorias).sort((a, b) => a.localeCompare(b, 'es'));
  }

  async cargarServicios() {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      this.servicios = await this.serviciosDb.listarTodos();
      this.actualizarResumen();
    } catch (error) {
      console.error('Error cargando servicios', error);
      this.toastMessage('No se pudieron cargar los servicios.', 'danger');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  actualizarResumen() {
    this.resumen = {
      total: this.servicios.length,
      activos: this.servicios.filter((servicio) => servicio.activo).length,
      inactivos: this.servicios.filter((servicio) => !servicio.activo).length,
      conSeguro: this.servicios.filter((servicio) => !!servicio.aplica_seguro).length
    };
  }

  limpiarFiltros() {
    this.filtroTexto = '';
    this.filtroEstado = 'todos';
    this.filtroCategoria = 'todas';
  }

  nuevoServicio() {
    this.formulario = this.formularioInicial();
    this.modoEdicion = false;
  }

  editarServicio(servicio: ServicioPrecioDb) {
    this.formulario = {
      id: servicio.id,
      codigo: servicio.codigo,
      nombre: servicio.nombre,
      area_destino: servicio.area_destino,
      categoria: servicio.categoria,
      precio: Number(servicio.precio ?? 0),
      precio_subsidiado: servicio.precio_subsidiado ?? servicio.precio ?? 0,
      precio_contributivo: servicio.precio_contributivo ?? servicio.precio ?? 0,
      precio_renacer: servicio.precio_renacer ?? servicio.precio ?? 0,
      aplica_seguro: !!servicio.aplica_seguro,
      activo: servicio.activo
    };
    this.modoEdicion = true;
  }

  async guardarServicio() {
    if (!this.formulario.id) {
      this.toastMessage('Seleccione un servicio del catalogo para editar.', 'warning');
      return;
    }

    if (Number.isNaN(Number(this.formulario.precio)) || Number(this.formulario.precio) < 0) {
      this.toastMessage('El precio base no es valido.', 'warning');
      return;
    }

    this.guardando = true;
    this.cdr.detectChanges();

    try {
      const payload = {
        precio: Number(this.formulario.precio),
        precio_subsidiado: this.formulario.aplica_seguro ? this.normalizarMonto(this.formulario.precio_subsidiado) : null,
        precio_contributivo: this.formulario.aplica_seguro ? this.normalizarMonto(this.formulario.precio_contributivo) : null,
        precio_renacer: this.formulario.aplica_seguro ? this.normalizarMonto(this.formulario.precio_renacer) : null,
        aplica_seguro: this.formulario.aplica_seguro,
        activo: this.formulario.activo
      };

      await this.serviciosDb.actualizar(this.formulario.id, payload);
      this.toastMessage('Servicio actualizado correctamente.', 'success');
      this.nuevoServicio();
      await this.cargarServicios();
    } catch (error) {
      console.error('Error guardando servicio', error);
      this.toastMessage('No se pudo guardar el servicio.', 'danger');
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  async restaurarCatalogoFijo() {
    this.sincronizando = true;
    this.cdr.detectChanges();

    try {
      const catalogoActualizado = await this.serviciosDb.sincronizarCatalogo(CATALOGO_FIJO);
      const codigosFijos = new Set(CATALOGO_FIJO.map((servicio) => servicio.codigo));
      const catalogoCompleto = await this.serviciosDb.listarTodos();
      const extras = catalogoCompleto.filter((servicio) => !codigosFijos.has(servicio.codigo) && servicio.activo);

      await Promise.all(extras.map((servicio) => this.serviciosDb.actualizar(servicio.id, { activo: false })));

      this.toastMessage(
        `Catalogo fijo cargado correctamente. ${catalogoActualizado.length} servicios sincronizados y ${extras.length} servicios extra desactivados.`,
        'success'
      );
      await this.cargarServicios();
    } catch (error) {
      console.error('Error sincronizando catalogo fijo', error);
      this.toastMessage('No se pudo restaurar el catalogo fijo.', 'danger');
    } finally {
      this.sincronizando = false;
      this.cdr.detectChanges();
    }
  }

  async cambiarEstadoServicio(servicio: ServicioPrecioDb) {
    try {
      await this.serviciosDb.actualizar(servicio.id, { activo: !servicio.activo });
      this.toastMessage(`Servicio ${servicio.activo ? 'inactivado' : 'activado'} correctamente.`, 'success');
      await this.cargarServicios();
    } catch (error) {
      console.error('Error cambiando estado del servicio', error);
      this.toastMessage('No se pudo cambiar el estado del servicio.', 'danger');
    }
  }

  async eliminarServicio(servicio: ServicioPrecioDb) {
    if (!confirm(`Eliminar definitivamente el servicio ${servicio.nombre}?`)) return;

    try {
      await this.serviciosDb.eliminar(servicio.id);
      this.toastMessage('Servicio eliminado.', 'success');
      this.nuevoServicio();
      await this.cargarServicios();
    } catch (error) {
      console.error('Error eliminando servicio', error);
      this.toastMessage('No se pudo eliminar el servicio.', 'danger');
    }
  }

  private textoCapitalizado(valor: string): string {
    return this.textoCelda(valor)
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private textoCelda(valor: any): string {
    return String(valor ?? '').trim();
  }

  private claveNormalizada(valor: string) {
    return valor
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toLowerCase();
  }

  private normalizarMonto(valor: number | null | undefined): number | null {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
      return null;
    }

    return Number(valor);
  }

  private toastMessage(message: string, type: typeof this.toastType) {
    this.toast = message;
    this.toastType = type;

    setTimeout(() => {
      this.toast = '';
      this.cdr.detectChanges();
    }, 2600);
  }
}
