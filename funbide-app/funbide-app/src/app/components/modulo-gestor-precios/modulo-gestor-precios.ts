import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
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
  aplica_seguro: boolean;
  activo: boolean;
}

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
  importando = false;
  toast = '';
  toastType: 'success' | 'warning' | 'danger' | 'info' = 'info';
  filtro = '';
  modoEdicion = false;
  archivoNombre = '';
  servicios: ServicioPrecioDb[] = [];
  formulario: ServicioPrecioForm = this.formularioInicial();

  resumen = {
    total: 0,
    activos: 0,
    conSeguro: 0,
    sinSeguro: 0
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
      precio_subsidiado: null,
      precio_contributivo: null,
      aplica_seguro: false,
      activo: true
    };
  }

  get serviciosFiltrados(): ServicioPrecioDb[] {
    const texto = this.filtro.trim().toLowerCase();
    if (!texto) return this.servicios;
    return this.servicios.filter(servicio => {
      const bloque = [
        servicio.codigo,
        servicio.nombre,
        servicio.area_destino,
        servicio.categoria,
        servicio.precio.toString(),
        servicio.precio_subsidiado?.toString() ?? '',
        servicio.precio_contributivo?.toString() ?? ''
      ].join(' ').toLowerCase();
      return bloque.includes(texto);
    });
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
      activos: this.servicios.filter(servicio => servicio.activo).length,
      conSeguro: this.servicios.filter(servicio => !!servicio.aplica_seguro).length,
      sinSeguro: this.servicios.filter(servicio => !servicio.aplica_seguro).length
    };
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
      precio_subsidiado: servicio.precio_subsidiado ?? null,
      precio_contributivo: servicio.precio_contributivo ?? null,
      aplica_seguro: !!servicio.aplica_seguro,
      activo: servicio.activo
    };
    this.modoEdicion = true;
  }

  async guardarServicio() {
    if (!this.formulario.codigo.trim() || !this.formulario.nombre.trim() || !this.formulario.area_destino.trim() || !this.formulario.categoria.trim()) {
      this.toastMessage('Complete los campos obligatorios.', 'warning');
      return;
    }

    if (Number.isNaN(Number(this.formulario.precio)) || Number(this.formulario.precio) < 0) {
      this.toastMessage('El precio base no es válido.', 'warning');
      return;
    }

    this.guardando = true;
    this.cdr.detectChanges();

    try {
      const payload = {
        codigo: this.formulario.codigo.trim().toUpperCase(),
        nombre: this.formulario.nombre.trim().toUpperCase(),
        area_destino: this.formulario.area_destino.trim(),
        categoria: this.formulario.categoria.trim(),
        precio: Number(this.formulario.precio),
        precio_subsidiado: this.formulario.aplica_seguro ? this.normalizarMonto(this.formulario.precio_subsidiado) : null,
        precio_contributivo: this.formulario.aplica_seguro ? this.normalizarMonto(this.formulario.precio_contributivo) : null,
        aplica_seguro: this.formulario.aplica_seguro,
        activo: this.formulario.activo
      };

      if (this.modoEdicion && this.formulario.id) {
        await this.serviciosDb.actualizar(this.formulario.id, payload);
        this.toastMessage('Servicio actualizado correctamente.', 'success');
      } else {
        await this.serviciosDb.crear(payload);
        this.toastMessage('Servicio creado correctamente.', 'success');
      }

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

  async eliminarServicio(servicio: ServicioPrecioDb) {
    if (!confirm(`¿Eliminar el servicio ${servicio.nombre}?`)) return;
    try {
      await this.serviciosDb.eliminar(servicio.id);
      this.toastMessage('Servicio eliminado.', 'success');
      await this.cargarServicios();
    } catch (error) {
      console.error('Error eliminando servicio', error);
      this.toastMessage('No se pudo eliminar el servicio.', 'danger');
    }
  }

  async onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.archivoNombre = file.name;
    this.importando = true;
    this.cdr.detectChanges();

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' }) as any[][];
      const registros = this.mapearFilasExcel(rows);
      let creados = 0;
      let actualizados = 0;

      const existentes = await this.serviciosDb.listarTodos();
      const mapaExistentes = new Map(
        existentes.map(servicio => [this.claveNormalizada(servicio.codigo || servicio.nombre), servicio])
      );

      for (const registro of registros) {
        const key = this.claveNormalizada(registro.codigo || registro.nombre);
        const existente = mapaExistentes.get(key) || existentes.find(item => this.claveNormalizada(item.nombre) === this.claveNormalizada(registro.nombre));

        if (existente) {
          await this.serviciosDb.actualizar(existente.id, registro);
          actualizados++;
        } else {
          await this.serviciosDb.crear(registro);
          creados++;
        }
      }

      this.toastMessage(`Importación completada. ${creados} creados y ${actualizados} actualizados.`, 'success');
      await this.cargarServicios();
    } catch (error) {
      console.error('Error importando Excel', error);
      this.toastMessage('No se pudo importar el archivo Excel.', 'danger');
    } finally {
      this.importando = false;
      if (input) input.value = '';
      this.cdr.detectChanges();
    }
  }

  private mapearFilasExcel(rows: any[][]): Omit<ServicioPrecioDb, 'id' | 'created_at' | 'updated_at'>[] {
    const registros: Omit<ServicioPrecioDb, 'id' | 'created_at' | 'updated_at'>[] = [];
    let secuencia = 0;
    let categoriaActual = '';
    let areaActual = '';

    for (const row of rows) {
      const nombreOriginal = this.textoCelda(row?.[0]);
      if (!nombreOriginal) continue;

      const precioBase = this.parseMonto(row?.[1]);
      const precioSubsidiado = this.parseMonto(row?.[2]);
      const precioContributivo = this.parseMonto(row?.[3]);

      const esEncabezado = precioBase === null && precioSubsidiado === null && precioContributivo === null;
      if (esEncabezado) {
        const titulo = this.tituloCategoria(nombreOriginal);
        categoriaActual = titulo;
        areaActual = titulo;
        continue;
      }

      const nombre = this.tituloServicio(nombreOriginal);
      secuencia += 1;
      const codigo = this.generarCodigo(categoriaActual || areaActual || nombre, secuencia);
      const aplicaSeguro = !this.filaSinSeguro(row) && (precioSubsidiado !== null || precioContributivo !== null);

      registros.push({
        codigo,
        nombre,
        area_destino: areaActual || categoriaActual || 'General',
        categoria: categoriaActual || areaActual || 'General',
        precio: precioBase ?? 0,
        precio_subsidiado: aplicaSeguro ? precioSubsidiado : null,
        precio_contributivo: aplicaSeguro ? precioContributivo : null,
        aplica_seguro: aplicaSeguro,
        activo: true
      });
    }

    return registros;
  }

  private filaSinSeguro(row: any[]): boolean {
    const texto = [row?.[1], row?.[2], row?.[3]].map(value => this.textoCelda(value).toLowerCase()).join(' ');
    return texto.includes('no aplica seguro') || texto.includes('sin seguro');
  }

  private parseMonto(valor: any): number | null {
    const texto = this.textoCelda(valor);
    if (!texto) return null;
    if (/no aplica|sin seguro/i.test(texto)) return null;
    const normalizado = texto.replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '');
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : null;
  }

  private textoCelda(valor: any): string {
    return String(valor ?? '').trim();
  }

  private tituloCategoria(valor: string): string {
    return valor
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private tituloServicio(valor: string): string {
    return valor
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private generarCodigo(base: string, secuencia: number): string {
    const prefijo = base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase() || 'SRV';
    return `${prefijo}${String(secuencia).padStart(3, '0')}`;
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
