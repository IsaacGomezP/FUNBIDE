import { Component, Output, EventEmitter, OnInit, Input, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { FarmaciaStorageService } from '../../services/farmacia-storage.service';
import { FarmaciaDbService } from '../../services/farmacia-db.service';

export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  laboratorio: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  unidad: string;
  imagenBase64?: string;
  codigoBarras: string;
  fechaVencimiento?: string;
  createdAt: Date;
  esDonacion: boolean;
  tipoRegistro: 'venta' | 'donacion' | 'exonerado';
  precioOriginal?: number;
  valorDonacion?: number;
  donante?: string;
  fechaDonacion?: string;
  notaInterna?: string;
}

export interface ToastNotification {
  id: number;
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  progress: number;
  removing: boolean;
}

@Component({
  selector: 'app-modulo-farmacia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modulo-farmacia.html',
  styleUrls: ['./modulo-farmacia.css']
})
export class ModuloFarmaciaComponent implements OnInit, OnDestroy {
  @Output() back = new EventEmitter<void>();
  @Input() usuarioNombre: string = '';
  @Input() usuarioRol: string = '';

  currentDate = new Date();
  viewMode: 'table' | 'grid' = 'table';

  isLoading = true;
  isSaving = false;

  // Notificaciones
  showNotifications = false;
  toasts: ToastNotification[] = [];
  private toastSeq = 0;
  private toastTimers = new Map<number, any>();

  // Búsqueda y filtros
  filtroBusqueda = '';
  filtroCategoria = '';
  filtroTipoProducto: 'todos' | 'venta' | 'donacion' | 'exonerado' = 'todos';
  private searchDebounceTimer: any;

  productos: Producto[] = [];
  productoSeleccionado: Producto | null = null;

  showProductModal = false;
  showPrintModal = false;
  showExonerarModal = false;
  isEditing = false;
  showSaveSuccess = false;
  productoParaExonerar: Producto | null = null;

  nuevoProducto = {
    nombre: '',
    categoria: '',
    laboratorio: '',
    precio: 0,
    stock: 0,
    stockMinimo: 5,
    unidad: 'unidades',
    fechaVencimiento: '',
    imagenBase64: '',
    esDonacion: false,
    tipoRegistro: 'venta' as 'venta' | 'donacion' | 'exonerado',
    donante: '',
    notaInterna: '',
    valorDonacion: 0
  };

  datosExoneracion = {
    cantidad: 0,
    donante: '',
    nota: '',
    fechaDonacion: new Date().toISOString().split('T')[0]
  };

  codigosGenerados: string[] = [];
  cantidadCodigos = 1;
  productoParaCodigos: Producto | null = null;

  imagenPreview: string | null = null;
  imagenFile: File | null = null;

  private stockUpdatesInProgress = new Set<string>();

  constructor(
    private farmaciaStorageService: FarmaciaStorageService,
    private farmaciaDbService: FarmaciaDbService,
    private cdr: ChangeDetectorRef
  ) {}

  categorias = [
    'Analgésicos', 'Antibióticos', 'Antiinflamatorios', 'Antihistamínicos',
    'Antihipertensivos', 'Antidiabéticos', 'Gástricos', 'Vitaminas',
    'Dermatológicos', 'Respiratorios', 'Otros'
  ];

  unidades = ['unidades', 'tabletas', 'cápsulas', 'ml', 'mg', 'g', 'sobres', 'ampollas'];
  
  tiposProducto = [
    { value: 'todos' as const, label: 'Todos los productos', icon: 'fa-boxes', color: 'var(--primary)' },
    { value: 'venta' as const, label: 'Para venta', icon: 'fa-tag', color: '#059669' },
    { value: 'donacion' as const, label: 'Donaciones', icon: 'fa-gift', color: '#7c3aed' },
    { value: 'exonerado' as const, label: 'Exonerados', icon: 'fa-hand-holding-heart', color: '#dc2626' }
  ];

  async ngOnInit() {
    await this.cargarProductosDesdeSupabase();
  }

  ngOnDestroy() {
    this.toastTimers.forEach(timer => {
      clearTimeout(timer.dismiss);
      clearInterval(timer.progress);
    });
    this.toastTimers.clear();
    clearTimeout(this.searchDebounceTimer);
  }

  async cargarProductosDesdeSupabase(mostrarNotificacion: boolean = false) {
    this.isLoading = true;
    this.cdr.detectChanges();

    try {
      const data = await this.farmaciaDbService.listarProductos();
      this.productos = data.map(p => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria || '',
        laboratorio: p.laboratorio || '',
        precio: Number(p.precio),
        stock: Number(p.stock),
        stockMinimo: Number(p.stock_minimo),
        unidad: p.unidad,
        imagenBase64: p.imagen_base64 || '',
        codigoBarras: p.codigo_barras,
        fechaVencimiento: p.fecha_vencimiento || '',
        createdAt: new Date(p.created_at),
        esDonacion: (p as any).es_donacion || false,
        tipoRegistro: ((p as any).tipo_registro || 'venta') as 'venta' | 'donacion' | 'exonerado',
        precioOriginal: (p as any).precio_original ? Number((p as any).precio_original) : undefined,
        valorDonacion: (p as any).valor_donacion ? Number((p as any).valor_donacion) : 0,
        donante: (p as any).donante || '',
        fechaDonacion: (p as any).fecha_donacion || '',
        notaInterna: (p as any).nota_interna || ''
      }));
      this.cdr.detectChanges();

      if (mostrarNotificacion) {
        const donaciones = this.productos.filter(p => p.esDonacion).length;
        if (donaciones > 0) {
          this.pushToast('info', 'Donaciones registradas', `${donaciones} productos donados en inventario`);
        }
      }
    } catch (error) {
      console.error('Error cargando productos:', error);
      this.pushToast('danger', 'Error de conexión', 'No se pudo cargar el inventario');
      this.productos = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  generarCodigoBarrasEAN13(): string {
    const prefix = '750';
    const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const base = prefix + random;
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      const digit = parseInt(base[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return base + checksum;
  }

  getProductosFiltrados(): Producto[] {
    return this.productos.filter(p => {
      const matchCat = !this.filtroCategoria || p.categoria === this.filtroCategoria;
      const q = this.filtroBusqueda.toLowerCase();
      const matchQ = !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.laboratorio || '').toLowerCase().includes(q) ||
        p.codigoBarras.includes(q);
      
      const matchTipo = this.filtroTipoProducto === 'todos' || p.tipoRegistro === this.filtroTipoProducto;
      
      return matchCat && matchQ && matchTipo;
    });
  }

  abrirModalProducto(producto?: Producto) {
    if (producto) {
      this.isEditing = true;
      this.productoSeleccionado = producto;
      this.nuevoProducto = {
        nombre: producto.nombre,
        categoria: producto.categoria,
        laboratorio: producto.laboratorio,
        precio: producto.precio,
        stock: producto.stock,
        stockMinimo: producto.stockMinimo,
        unidad: producto.unidad,
        fechaVencimiento: producto.fechaVencimiento || '',
        imagenBase64: producto.imagenBase64 || '',
        esDonacion: producto.esDonacion,
        tipoRegistro: producto.tipoRegistro,
        donante: producto.donante || '',
        notaInterna: producto.notaInterna || '',
        valorDonacion: producto.valorDonacion || 0
      };
      this.imagenPreview = producto.imagenBase64 || null;
    } else {
      this.isEditing = false;
      this.productoSeleccionado = null;
      this.nuevoProducto = {
        nombre: '', categoria: '', laboratorio: '',
        precio: 0, stock: 0, stockMinimo: 5,
        unidad: 'unidades', fechaVencimiento: '', imagenBase64: '',
        esDonacion: false,
        tipoRegistro: 'venta',
        donante: '',
        notaInterna: '',
        valorDonacion: 0
      };
      this.imagenPreview = null;
      this.imagenFile = null;
    }
    this.showProductModal = true;
  }

  cerrarModalProducto() {
    this.showProductModal = false;
    this.imagenPreview = null;
    this.imagenFile = null;
    this.isSaving = false;
  }

  abrirModalExonerar(producto: Producto) {
    if (producto.stock === 0) {
      this.pushToast('warning', 'Stock agotado', 'No hay unidades disponibles para exonerar');
      return;
    }
    this.productoParaExonerar = producto;
    this.datosExoneracion = {
      cantidad: 1,
      donante: '',
      nota: '',
      fechaDonacion: new Date().toISOString().split('T')[0]
    };
    this.showExonerarModal = true;
  }

  async exonerarProductos() {
    if (!this.productoParaExonerar) return;
    if (this.datosExoneracion.cantidad <= 0) {
      this.pushToast('warning', 'Cantidad inválida', 'Ingrese una cantidad válida para exonerar');
      return;
    }
    if (this.datosExoneracion.cantidad > this.productoParaExonerar.stock) {
      this.pushToast('warning', 'Stock insuficiente', `Solo hay ${this.productoParaExonerar.stock} unidades disponibles`);
      return;
    }
    if (!this.datosExoneracion.donante.trim()) {
      this.pushToast('warning', 'Donante requerido', 'Ingrese el nombre del donante o institución');
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    const snapshotStock = this.productoParaExonerar.stock;
    const nuevoStock = snapshotStock - this.datosExoneracion.cantidad;

    try {
      this.productoParaExonerar.stock = nuevoStock;
      this.cdr.detectChanges();

      const notaActual = this.productoParaExonerar.notaInterna || '';
      const nuevaNota = `${notaActual}${notaActual ? '\n' : ''}[${new Date().toLocaleDateString()}] EXONERACIÓN: ${this.datosExoneracion.cantidad} unidades - Donante: ${this.datosExoneracion.donante} - ${this.datosExoneracion.nota || 'Sin nota'}`;

      await (this.farmaciaDbService as any).actualizarProducto(this.productoParaExonerar.id, {
        stock: nuevoStock,
        tipo_registro: 'exonerado',
        es_donacion: true,
        donante: this.datosExoneracion.donante,
        nota_interna: nuevaNota,
        fecha_donacion: this.datosExoneracion.fechaDonacion,
        precio_original: this.productoParaExonerar.precio,
        valor_donacion: (this.productoParaExonerar.precio * this.datosExoneracion.cantidad)
      });

      const index = this.productos.findIndex(p => p.id === this.productoParaExonerar!.id);
      if (index !== -1) {
        this.productos[index] = {
          ...this.productos[index],
          stock: nuevoStock,
          esDonacion: true,
          tipoRegistro: 'exonerado',
          donante: this.datosExoneracion.donante,
          notaInterna: nuevaNota,
          fechaDonacion: this.datosExoneracion.fechaDonacion,
          precioOriginal: this.productoParaExonerar.precio,
          valorDonacion: this.productoParaExonerar.precio * this.datosExoneracion.cantidad
        };
        this.productos = [...this.productos];
      }

      this.pushToast('success', 'Exoneración registrada', 
        `${this.datosExoneracion.cantidad} unidades de ${this.productoParaExonerar.nombre} exoneradas a ${this.datosExoneracion.donante}`);
      
      this.cerrarModalExonerar();
      
      if (nuevoStock === 0) {
        this.pushToast('info', 'Stock agotado', `${this.productoParaExonerar.nombre} se ha agotado`);
      }

    } catch (error) {
      console.error('Error al exonerar:', error);
      this.productoParaExonerar.stock = snapshotStock;
      this.cdr.detectChanges();
      this.pushToast('danger', 'Error al exonerar', 'No se pudo registrar la exoneración');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  cerrarModalExonerar() {
    this.showExonerarModal = false;
    this.productoParaExonerar = null;
    this.isSaving = false;
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 2 * 1024 * 1024) {
        this.pushToast('warning', 'Imagen grande', 'La imagen no puede superar los 2MB');
        return;
      }
      this.imagenFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagenPreview = e.target?.result as string;
        this.nuevoProducto.imagenBase64 = e.target?.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  async guardarProducto() {
    if (!this.nuevoProducto.nombre.trim()) {
      this.pushToast('warning', 'Campo requerido', 'El nombre del producto es obligatorio');
      return;
    }

    if (this.nuevoProducto.tipoRegistro === 'venta' && this.nuevoProducto.precio <= 0) {
      this.pushToast('warning', 'Precio requerido', 'Los productos de venta deben tener precio');
      return;
    }

    if (this.nuevoProducto.tipoRegistro === 'donacion' && !this.nuevoProducto.donante.trim()) {
      this.pushToast('warning', 'Donante requerido', 'Ingrese el nombre del donante');
      return;
    }

    if (this.isSaving) return;
    this.isSaving = true;
    this.cdr.detectChanges();

    const data = {
      ...this.nuevoProducto,
      precio: this.nuevoProducto.tipoRegistro === 'donacion' ? 0 : Number(this.nuevoProducto.precio),
      stock: Number(this.nuevoProducto.stock),
      stockMinimo: Number(this.nuevoProducto.stockMinimo),
      esDonacion: this.nuevoProducto.tipoRegistro !== 'venta',
      valorDonacion: this.nuevoProducto.tipoRegistro === 'donacion' ? Number(this.nuevoProducto.precio) : 0,
      precioOriginal: this.nuevoProducto.tipoRegistro === 'donacion' ? Number(this.nuevoProducto.precio) : undefined
    };

    try {
      let imagenUrl = '';
      if (this.imagenFile) {
        imagenUrl = await this.farmaciaStorageService.uploadProductImage(
          this.imagenFile,
          this.nuevoProducto.nombre
        );
      } else if (this.nuevoProducto.imagenBase64 && !this.isEditing) {
        imagenUrl = this.nuevoProducto.imagenBase64;
      }

      const payload: any = {
        nombre: data.nombre,
        categoria: data.categoria || '',
        laboratorio: data.laboratorio || '',
        precio: data.precio,
        stock: data.stock,
        stock_minimo: data.stockMinimo,
        unidad: data.unidad,
        imagen_base64: imagenUrl || null,
        codigo_barras: this.productoSeleccionado?.codigoBarras || this.generarCodigoBarrasEAN13(),
        fecha_vencimiento: data.fechaVencimiento || null,
        es_donacion: data.esDonacion,
        tipo_registro: data.tipoRegistro,
        donante: data.donante || null,
        nota_interna: data.notaInterna || null,
        precio_original: data.precioOriginal || null,
        valor_donacion: data.valorDonacion || 0,
        fecha_donacion: data.tipoRegistro === 'donacion' ? new Date().toISOString() : null
      };

      this.cerrarModalProducto();

      if (this.isEditing && this.productoSeleccionado) {
        const actualizado = await (this.farmaciaDbService as any).actualizarProducto(
          this.productoSeleccionado.id,
          payload
        );
        
        const index = this.productos.findIndex(p => p.id === this.productoSeleccionado!.id);
        if (index !== -1) {
          this.productos[index] = {
            ...this.productos[index],
            ...payload,
            precio: Number(payload.precio),
            stock: Number(payload.stock),
            stockMinimo: Number(payload.stock_minimo),
            esDonacion: payload.es_donacion,
            tipoRegistro: payload.tipo_registro,
            donante: payload.donante,
            notaInterna: payload.nota_interna,
            precioOriginal: payload.precio_original ? Number(payload.precio_original) : undefined,
            valorDonacion: payload.valor_donacion ? Number(payload.valor_donacion) : 0,
            fechaDonacion: payload.fecha_donacion
          };
          this.productos = [...this.productos];
        }
        this.pushToast('success', 'Producto actualizado', `${payload.nombre} se actualizó correctamente`);
      } else {
        const creado = await (this.farmaciaDbService as any).crearProducto(payload);
        
        const nuevoProducto: Producto = {
          id: creado.id,
          nombre: creado.nombre,
          categoria: creado.categoria || '',
          laboratorio: creado.laboratorio || '',
          precio: Number(creado.precio),
          stock: Number(creado.stock),
          stockMinimo: Number(creado.stock_minimo),
          unidad: creado.unidad,
          imagenBase64: creado.imagen_base64 || '',
          codigoBarras: creado.codigo_barras,
          fechaVencimiento: creado.fecha_vencimiento || '',
          createdAt: new Date(creado.created_at),
          esDonacion: creado.es_donacion || false,
          tipoRegistro: (creado.tipo_registro || 'venta') as 'venta' | 'donacion' | 'exonerado',
          donante: creado.donante || '',
          notaInterna: creado.nota_interna || '',
          precioOriginal: creado.precio_original ? Number(creado.precio_original) : undefined,
          valorDonacion: creado.valor_donacion ? Number(creado.valor_donacion) : 0,
          fechaDonacion: creado.fecha_donacion || ''
        };
        
        this.productos = [nuevoProducto, ...this.productos];
        
        this.pushToast('success', 
          data.tipoRegistro === 'donacion' ? 'Donación registrada' : 'Producto guardado', 
          `${payload.nombre}${data.tipoRegistro === 'donacion' ? ' (Donación)' : ''} agregado al inventario`);
        
        this.showSaveSuccess = true;
        setTimeout(() => {
          this.showSaveSuccess = false;
          this.cdr.detectChanges();
        }, 1800);
      }
      
      this.limpiarFormulario();

    } catch (error: any) {
      console.error('Error guardando producto:', error);
      this.pushToast('danger', 'Error al guardar', error?.message || 'No se pudo guardar el producto');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  private limpiarFormulario() {
    this.nuevoProducto = {
      nombre: '', categoria: '', laboratorio: '',
      precio: 0, stock: 0, stockMinimo: 5,
      unidad: 'unidades', fechaVencimiento: '', imagenBase64: '',
      esDonacion: false,
      tipoRegistro: 'venta',
      donante: '',
      notaInterna: '',
      valorDonacion: 0
    };
    this.imagenPreview = null;
    this.imagenFile = null;
    this.isSaving = false;
  }

  eliminarProducto(producto: Producto) {
    if (confirm(`¿Está seguro de eliminar "${producto.nombre}"?`)) {
      const snapshot = [...this.productos];
      this.productos = this.productos.filter(p => p.id !== producto.id);
      this.cdr.detectChanges();

      (this.farmaciaDbService as any).eliminarProducto(producto.id)
        .then(() => {
          this.pushToast('success', 'Producto eliminado', `${producto.nombre} fue removido del inventario`);
        })
        .catch((error: any) => {
          console.error('Error eliminando producto:', error);
          this.productos = snapshot;
          this.cdr.detectChanges();
          this.pushToast('danger', 'Error al eliminar', 'No se pudo eliminar el producto');
        });
    }
  }

  actualizarStock(producto: Producto, delta: number) {
    const nuevo = producto.stock + delta;
    if (nuevo < 0) {
      this.pushToast('warning', 'Stock inválido', 'El stock no puede ser negativo');
      return;
    }

    if (this.stockUpdatesInProgress.has(producto.id)) return;
    this.stockUpdatesInProgress.add(producto.id);

    const stockAnterior = producto.stock;
    producto.stock = nuevo;
    this.cdr.detectChanges();

    (this.farmaciaDbService as any).actualizarProducto(producto.id, { stock: nuevo })
      .then(() => {
        const icon = delta > 0 ? '↑' : '↓';
        this.pushToast('success', 'Stock actualizado', `${producto.nombre}: ${icon} ${nuevo} ${producto.unidad}`);
      })
      .catch((error: any) => {
        console.error('Error actualizando stock:', error);
        producto.stock = stockAnterior;
        this.pushToast('danger', 'Error al actualizar', 'No se pudo actualizar el stock');
        this.cdr.detectChanges();
      })
      .finally(() => {
        this.stockUpdatesInProgress.delete(producto.id);
      });
  }

  isStockUpdating(productoId: string): boolean {
    return this.stockUpdatesInProgress.has(productoId);
  }

  pushToast(type: 'success' | 'warning' | 'danger' | 'info', title: string, message: string) {
    const id = ++this.toastSeq;
    const toast: ToastNotification = { id, type, title, message, progress: 100, removing: false };

    if (this.toasts.length >= 4) {
      const oldest = this.toasts[0];
      this.removeToast(oldest.id);
    }

    this.toasts = [...this.toasts, toast];
    this.cdr.detectChanges();

    const duration = 4000;
    const interval = 50;
    const steps = duration / interval;
    let step = 0;

    const progressTimer = setInterval(() => {
      step++;
      const toastRef = this.toasts.find(t => t.id === id);
      if (toastRef) {
        toastRef.progress = Math.max(0, 100 - (step / steps) * 100);
        this.cdr.detectChanges();
      }
      if (step >= steps) clearInterval(progressTimer);
    }, interval);

    const dismissTimer = setTimeout(() => {
      clearInterval(progressTimer);
      this.removeToast(id);
    }, duration);

    this.toastTimers.set(id, { dismiss: dismissTimer, progress: progressTimer });
  }

  removeToast(id: number) {
    const toastRef = this.toasts.find(t => t.id === id);
    if (!toastRef || toastRef.removing) return;

    toastRef.removing = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
      this.cdr.detectChanges();
    }, 300);

    const timers = this.toastTimers.get(id);
    if (timers) {
      clearTimeout(timers.dismiss);
      clearInterval(timers.progress);
      this.toastTimers.delete(id);
    }
  }

  getToastIcon(type: string): string {
    const icons: Record<string, string> = {
      success: 'fa-check-circle',
      warning: 'fa-exclamation-triangle',
      danger: 'fa-times-circle',
      info: 'fa-info-circle'
    };
    return icons[type] || 'fa-info-circle';
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
  }

  getUnreadNotificationsCount(): number {
    return this.getProductosStockCritico().length + this.getStockBajoCount() + this.getProductosProximosAVencer(30).length;
  }

  getAllNotifications(): any[] {
    const notifications: any[] = [];

    this.getProductosStockCritico().forEach(p => {
      notifications.push({
        id: `out-${p.id}`, type: 'danger', icon: 'fa-ban',
        title: 'Producto agotado',
        message: `${p.nombre} — Stock: 0 ${p.unidad}`,
        productId: p.id, action: 'Reabastecer'
      });
    });

    this.getProductosStockBajo().forEach(p => {
      notifications.push({
        id: `low-${p.id}`, type: 'warning', icon: 'fa-exclamation-triangle',
        title: 'Stock bajo',
        message: `${p.nombre} — ${p.stock}/${p.stockMinimo} ${p.unidad}`,
        productId: p.id, action: 'Reabastecer'
      });
    });

    this.getProductosProximosAVencer(30).forEach(p => {
      const daysLeft = this.getDaysUntilExpiry(p.fechaVencimiento!);
      notifications.push({
        id: `exp-${p.id}`, type: 'warning', icon: 'fa-calendar-exclamation',
        title: 'Próximo a vencer',
        message: `${p.nombre} — Vence en ${daysLeft} días`,
        productId: p.id, action: 'Ver detalle'
      });
    });

    return notifications;
  }

  getTotalStock() { return this.productos.reduce((a, p) => a + p.stock, 0); }
  getproductosAgotados() { return this.productos.filter(p => p.stock === 0).length; }
  getStockBajoCount() { return this.productos.filter(p => p.stock > 0 && p.stock <= p.stockMinimo).length; }
  getValorInventario() { return this.productos.reduce((a, p) => a + p.precio * p.stock, 0); }
  getValorDonaciones() { return this.productos.filter(p => p.esDonacion).reduce((a, p) => a + (p.valorDonacion || 0), 0); }

  getProductosProximosAVencer(dias: number = 30): Producto[] {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + dias);
    return this.productos.filter(p => {
      if (!p.fechaVencimiento) return false;
      const vencimiento = new Date(p.fechaVencimiento);
      return vencimiento <= limite && vencimiento >= hoy;
    }).sort((a, b) => new Date(a.fechaVencimiento!).getTime() - new Date(b.fechaVencimiento!).getTime());
  }

  getProductosStockCritico(): Producto[] {
    return this.productos.filter(p => p.stock === 0);
  }

  getProductosStockBajo(): Producto[] {
    return this.productos.filter(p => p.stock > 0 && p.stock <= p.stockMinimo);
  }

  getProductoById(id: string): Producto | undefined {
    return this.productos.find(p => p.id === id);
  }

  abrirModalImprimirCodigos(producto: Producto) {
    this.productoParaCodigos = producto;
    this.cantidadCodigos = 1;
    this.showPrintModal = true;
  }

  cerrarModalImprimir() {
    this.showPrintModal = false;
    this.productoParaCodigos = null;
  }

  getPreviewIndexes(): number[] {
    return Array.from({ length: Math.min(4, this.cantidadCodigos) }, (_, i) => i);
  }

  generarCodigosParaImpresion() {
    if (!this.productoParaCodigos || this.cantidadCodigos < 1) return;
    this.codigosGenerados = Array(this.cantidadCodigos).fill(this.productoParaCodigos.codigoBarras);
    this.imprimirEtiquetas();
  }

  imprimirEtiquetas() {
    const win = window.open('', '_blank');
    if (!win) {
      this.pushToast('warning', 'Ventana bloqueada', 'Permita ventanas emergentes para imprimir');
      return;
    }
    win.document.write(this.generarHTMLCodigos());
    win.document.close();
    win.print();
    this.cerrarModalImprimir();
  }

  generarHTMLCodigos(): string {
    const p = this.productoParaCodigos!;
    let labels = '';
    for (const codigo of this.codigosGenerados) {
      labels += `
        <div class="label">
          <div class="pname">${this.escapeHtml(p.nombre)}</div>
          <div class="barsvg">${this.generarBarcodeSVG(codigo)}</div>
          <div class="bnum">${this.formatBarcode(codigo)}</div>
          <div class="price">RD$ ${p.precio.toFixed(2)}</div>
        </div>`;
    }
    return `<!DOCTYPE html><html><head><title>Etiquetas - FUNBIDE</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;padding:.5cm;background:#fff}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.6cm .4cm}
      .label{width:3.8cm;height:2.5cm;border:1px dashed #ccc;border-radius:4px;padding:5px;text-align:center;background:white;page-break-inside:avoid}
      .pname{font-size:7px;font-weight:700;text-transform:uppercase;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .barsvg{width:100%;height:.9cm;margin:3px 0}
      .bnum{font-size:8px;letter-spacing:.5px}
      .price{font-size:7px;color:#059669;margin-top:2px;font-weight:600}
      @media print{body{margin:0;padding:0}.label{border:none}}
    </style></head><body><div class="grid">${labels}</div></body></html>`;
  }

  generarBarcodeSVG(barcode: string): string {
    let svg = '';
    let x = 0;
    for (let i = 0; i < barcode.length; i++) {
      const w = parseInt(barcode[i]) % 2 === 0 ? 2 : 3;
      svg += `<rect x="${x}" y="0" width="${w}" height="30" fill="black"/>`;
      x += w + .5;
    }
    return `<svg width="100%" height="30" viewBox="0 0 ${x} 30" preserveAspectRatio="none">${svg}</svg>`;
  }

  formatBarcode(barcode: string): string {
    return barcode.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  escapeHtml(t: string): string {
    return t.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
  }

  exportarExcel() {
    const productosData = this.getProductosFiltrados().map((producto, index) => ({
      '#': index + 1,
      'PRODUCTO': producto.nombre.toUpperCase(),
      'CATEGORÍA': producto.categoria || '—',
      'LABORATORIO': producto.laboratorio || '—',
      'CÓDIGO DE BARRAS': producto.codigoBarras,
      'STOCK': producto.stock,
      'UNIDAD': producto.unidad,
      'STOCK MÍNIMO': producto.stockMinimo,
      'TIPO': producto.tipoRegistro === 'venta' ? 'VENTA' : (producto.tipoRegistro === 'donacion' ? 'DONACIÓN' : 'EXONERADO'),
      'DONANTE': producto.donante || '—',
      'PRECIO (RD$)': producto.precio,
      'VALOR DONACIÓN': producto.valorDonacion || 0,
      'VALOR TOTAL (RD$)': producto.precio * producto.stock,
      'VENCIMIENTO': producto.fechaVencimiento || '—',
      'REGISTRO': new Date(producto.createdAt).toLocaleDateString('es-DO')
    }));
    const wb = XLSX.utils.book_new();
    const wsInventario = XLSX.utils.json_to_sheet(productosData);
    XLSX.utils.book_append_sheet(wb, wsInventario, 'Inventario');
    const fechaFormato = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `FUNBIDE_Inventario_${fechaFormato}.xlsx`;
    XLSX.writeFile(wb, fileName);
    this.pushToast('success', 'Exportación completada', fileName);
  }

  exportarReporteStockMinimo() {
    const productosBajos = this.productos.filter(p => p.stock <= p.stockMinimo);
    if (productosBajos.length === 0) {
      this.pushToast('info', 'Sin alertas', 'No hay productos con stock bajo o agotado');
      return;
    }
    const data = productosBajos.map((p, idx) => ({
      '#': idx + 1,
      'PRODUCTO': p.nombre,
      'LABORATORIO': p.laboratorio || '—',
      'STOCK ACTUAL': p.stock,
      'STOCK MÍNIMO': p.stockMinimo,
      'TIPO': p.tipoRegistro,
      'CANTIDAD A PEDIR': Math.max(0, p.stockMinimo * 2 - p.stock),
      'PRECIO APROX': p.precio,
      'TOTAL ESTIMADO': Math.max(0, p.stockMinimo * 2 - p.stock) * p.precio
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Productos a Reabastecer');
    const fileName = `FUNBIDE_Pedido_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    this.pushToast('success', 'Reporte generado', fileName);
  }

  toggleViewMode(mode: 'table' | 'grid') {
    this.viewMode = mode;
  }

  getDaysUntilExpiry(expiryDate: string): number {
    const today = new Date();
    const expiry = new Date(expiryDate);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  volver() {
    this.back.emit();
  }
}