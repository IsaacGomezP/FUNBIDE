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
  monto_ganancia_interna: number | null;
  requiere_aporte_efectivo: boolean;
  monto_aporte_efectivo: number | null;
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
    monto_ganancia_interna: 0,
    requiere_aporte_efectivo: false,
    monto_aporte_efectivo: null,
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
    monto_ganancia_interna: 0,
    requiere_aporte_efectivo: false,
    monto_aporte_efectivo: null,
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
    monto_ganancia_interna: 0,
    requiere_aporte_efectivo: false,
    monto_aporte_efectivo: null,
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
    monto_ganancia_interna: 0,
    requiere_aporte_efectivo: false,
    monto_aporte_efectivo: null,
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
    monto_ganancia_interna: 0,
    requiere_aporte_efectivo: false,
    monto_aporte_efectivo: null,
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
    monto_ganancia_interna: 0,
    requiere_aporte_efectivo: false,
    monto_aporte_efectivo: null,
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
    monto_ganancia_interna: 0,
    requiere_aporte_efectivo: false,
    monto_aporte_efectivo: null,
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
    monto_ganancia_interna: 0,
    requiere_aporte_efectivo: false,
    monto_aporte_efectivo: null,
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
  conSeguro: 0,
  conAporteEfectivo: 0,
  conGananciaInterna: 0
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
      monto_ganancia_interna: 0,
      requiere_aporte_efectivo: false,
      monto_aporte_efectivo: null,
      aplica_seguro: true,
      activo: true
    };
  }

  get serviciosFiltrados(): ServicioPrecioDb[] {
    return this.servicios.filter((servicio) => {
      const texto = this.filtroTexto.trim().toLowerCase();
      const coincideTexto =
        !texto ||
        `${servicio.codigo} ${servicio.nombre} ${servicio.area_destino} ${servicio.categoria} ${servicio.precio} ${servicio.precio_subsidiado ?? ''} ${servicio.precio_contributivo ?? ''} ${servicio.precio_renacer ?? ''} ${servicio.monto_aporte_efectivo ?? ''} ${servicio.monto_ganancia_interna ?? ''} ${servicio.requiere_aporte_efectivo ? 'aporte' : ''}`.toLowerCase().includes(texto);
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
      conSeguro: this.servicios.filter((servicio) => !!servicio.aplica_seguro).length,
      conAporteEfectivo: this.servicios.filter((servicio) => !!servicio.requiere_aporte_efectivo).length,
      conGananciaInterna: this.servicios.filter((servicio) => Number(servicio.monto_ganancia_interna ?? 0) > 0).length
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
      monto_ganancia_interna: servicio.monto_ganancia_interna ?? 0,
      requiere_aporte_efectivo: !!servicio.requiere_aporte_efectivo,
      monto_aporte_efectivo: servicio.monto_aporte_efectivo ?? null,
      aplica_seguro: !!servicio.aplica_seguro,
      activo: servicio.activo
    };
    this.modoEdicion = true;
  }

  async guardarServicio() {
    const esCreacion = !this.formulario.id;
    const codigoNormalizado = this.formulario.codigo.trim().toUpperCase();
    const servicioExistente = this.servicios.find((servicio) => servicio.codigo.trim().toUpperCase() === codigoNormalizado) ?? null;

    if (esCreacion) {
      if (!this.formulario.codigo.trim() || !this.formulario.nombre.trim()) {
        this.toastMessage('Complete codigo y nombre del servicio.', 'warning');
        return;
      }
    } else if (!this.formulario.id) {
      this.toastMessage('Seleccione un servicio del catalogo para editar.', 'warning');
      return;
    }

    if (Number.isNaN(Number(this.formulario.precio)) || Number(this.formulario.precio) < 0) {
      this.toastMessage('El precio base no es valido.', 'warning');
      return;
    }

    if (Number.isNaN(Number(this.formulario.monto_ganancia_interna ?? 0)) || Number(this.formulario.monto_ganancia_interna ?? 0) < 0) {
      this.toastMessage('La ganancia interna no es valida.', 'warning');
      return;
    }

    if (this.formulario.requiere_aporte_efectivo) {
      const aporteEfectivo = Number(this.formulario.monto_aporte_efectivo ?? 0);
      if (Number.isNaN(aporteEfectivo) || aporteEfectivo <= 0) {
        this.toastMessage('Indique el monto de aporte en efectivo.', 'warning');
        return;
      }
    }

    this.guardando = true;
    this.cdr.detectChanges();

    try {
      const precioBase = Number(this.formulario.precio);
      const aplicaSeguro = !!this.formulario.aplica_seguro;
      const requiereAporteEfectivo = aplicaSeguro && !!this.formulario.requiere_aporte_efectivo;
      const gananciaInterna = aplicaSeguro ? this.normalizarMonto(this.formulario.monto_ganancia_interna) ?? 0 : 0;
      const precioSeguroVisible = aplicaSeguro ? precioBase : null;
      const payloadBase = {
        codigo: codigoNormalizado,
        nombre: this.formulario.nombre.trim().toUpperCase(),
        area_destino: esCreacion ? 'General' : this.formulario.area_destino.trim(),
        categoria: esCreacion ? 'General' : this.formulario.categoria.trim(),
        precio: Number(this.formulario.precio),
        monto_ganancia_interna: gananciaInterna,
        precio_subsidiado: precioSeguroVisible,
        precio_contributivo: precioSeguroVisible,
        precio_renacer: precioSeguroVisible,
        requiere_aporte_efectivo: requiereAporteEfectivo,
        monto_aporte_efectivo: requiereAporteEfectivo
          ? this.normalizarMonto(this.formulario.monto_aporte_efectivo)
          : null,
        aplica_seguro: aplicaSeguro,
        activo: this.formulario.activo
      };

      if (this.formulario.id) {
        await this.serviciosDb.actualizar(this.formulario.id, payloadBase);
        this.toastMessage('Servicio actualizado correctamente.', 'success');
      } else if (servicioExistente) {
        const cambiosDuplicado = {
          nombre: payloadBase.nombre,
          precio: payloadBase.precio,
          monto_ganancia_interna: payloadBase.monto_ganancia_interna,
          aplica_seguro: payloadBase.aplica_seguro,
          requiere_aporte_efectivo: payloadBase.requiere_aporte_efectivo,
          monto_aporte_efectivo: payloadBase.monto_aporte_efectivo,
          precio_subsidiado: payloadBase.precio_subsidiado,
          precio_contributivo: payloadBase.precio_contributivo,
          precio_renacer: payloadBase.precio_renacer,
          activo: payloadBase.activo
        };

        await this.serviciosDb.actualizar(servicioExistente.id, cambiosDuplicado);
        this.toastMessage(
          `El código ${codigoNormalizado} ya existía. Se actualizó ${servicioExistente.nombre.toLowerCase()}.`,
          'success'
        );
      } else {
        await this.serviciosDb.crear({
          ...payloadBase,
          monto_ganancia_interna: gananciaInterna,
          aplica_seguro: aplicaSeguro
        });
        this.toastMessage('Servicio creado correctamente.', 'success');
      }
      this.nuevoServicio();
      await this.cargarServicios();
    } catch (error) {
      console.error('Error guardando servicio', error);
      const codigoError = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
      if (codigoError === '23505') {
        this.toastMessage(`El código ${codigoNormalizado} ya existe. Use otro código o edite ese servicio.`, 'warning');
      } else {
        this.toastMessage('No se pudo guardar el servicio.', 'danger');
      }
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
