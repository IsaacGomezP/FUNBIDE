import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CobrosDbService } from '../../services/cobros-db.service';
import { ExpedientesMedicosDbService } from '../../services/expedientes-medicos-db.service';
import { PacientesDbService } from '../../services/pacientes-db.service';
import { ServicioPrecioDb, ServiciosPreciosDbService } from '../../services/servicios-precios-db.service';
import { SupabaseService } from '../../services/supabase.service';
import { TurnoDb, TurnosDbService } from '../../services/turnos-db.service';
import { printHtmlInHiddenFrame } from '../../utils/print-html';

type Paso = 1 | 2 | 3;
type FaseCobro = 'facturar' | 'pagar';
type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'senasa' | 'renacer' | 'mixto';
type PlanSeguro = 'subsidiado' | 'contributivo' | 'renacer' | '';
type MetodoPagoLinea = 'efectivo' | 'tarjeta' | 'transferencia';

interface PagoDetalle {
  id: string;
  metodo: MetodoPagoLinea;
  monto: number;
  referencia: string;
}

interface TicketPendiente extends TurnoDb {
  monto: number;
  areaDestino: string;
  servicioPrecioId: string | null;
  servicioPrecioNombre: string | null;
  pacienteNombre: string;
  pacienteCedula: string;
  servicioNombre: string;
}

interface TicketCobro {
  faseCobro: FaseCobro;
  metodoPago: MetodoPago;
  metodoCobroAporte: MetodoPagoLinea;
  servicioCobroId: string | null;
  planSeguro: PlanSeguro;
  requiereAportePaciente: boolean;
  pagosMultiples: boolean;
  montoRecibido: number | null;
  aporteCliente: number | null;
  referenciaPago: string;
  cambio: number;
  seguroNombre: string;
  seguroNumero: string;
  pagos: PagoDetalle[];
}

interface DatosPacienteForm {
  cedula: string;
  nombre: string;
  edad: number | null;
}

interface CuentaPorCobrarDb {
  turno_id: string;
  cobro_id: string;
  codigo_ticket: string;
  paciente_nombre: string;
  paciente_cedula: string;
  servicio_nombre: string;
  servicio_id?: string | null;
  aseguradora: string;
  monto_total: number;
  monto_pagado_paciente: number;
  monto_pendiente: number;
  monto_aporte_cliente?: number;
  estado: 'pendiente' | 'parcial' | 'pagado' | 'anulado';
  fecha_vencimiento?: string | null;
  notas?: string | null;
}

interface Notificacion {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

interface ReciboCobro {
  codigoTicket: string;
  servicioNombre: string;
  montoBase: number;
  montoCoberturaSeguro: number;
  montoDiferenciaCliente: number;
  montoGananciaInterna: number;
  totalInterno: number;
  total: number;
  metodoPago: MetodoPago;
  montoRecibido: number | null;
  aporteCliente: number | null;
  detallePagos: PagoDetalle[];
  cambio: number;
  referenciaPago: string;
  fecha: string;
}

@Component({
  selector: 'app-modulo-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modulo-caja.html',
  styleUrls: ['./modulo-caja.css']
})
export class ModuloCajaComponent implements OnInit, OnDestroy {
  @Output() back = new EventEmitter<void>();
  @Input() usuarioNombre = 'Cajero Principal';

  pasoActual: Paso = 1;
  ticketSeleccionado: TicketPendiente | null = null;
  ticketsPendientes: TicketPendiente[] = [];
  serviciosDisponibles: ServicioPrecioDb[] = [];
  busquedaServicio = '';
  busquedaTicket = '';

  totalPendientes = 0;
  totalPagadosHoy = 0;
  totalIngresosHoy = 0;
  totalIngresosNormalesHoy = 0;
  totalGananciaInternaHoy = 0;
  totalPendienteSenasaHoy = 0;
  totalPendienteRenacerHoy = 0;

  pagoEnProceso = false;
  ultimoCobroTicketCodigo = '';
  notificacion: Notificacion | null = null;
  areaDestinoMensaje = '';
  mensajePacienteCobro: string | null = null;
  reciboUltimoCobro: ReciboCobro | null = null;
  busquedaPacienteEnProceso = false;
  pacienteEncontrado = false;
  datosPaciente: DatosPacienteForm = this.crearDatosPaciente();
  private refrescoCajaId: ReturnType<typeof setInterval> | null = null;
  private refrescandoCaja = false;

  ticketCobro: TicketCobro = this.crearTicketCobro();

  constructor(
    private turnosDbService: TurnosDbService,
    private serviciosPreciosDbService: ServiciosPreciosDbService,
    private cobrosDbService: CobrosDbService,
    private expedientesMedicosDbService: ExpedientesMedicosDbService,
    private pacientesDbService: PacientesDbService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.resetFlujo();
    await this.cargarDatos();
    this.iniciarRefrescoAutomatico();
  }

  ngOnDestroy() {
    if (this.refrescoCajaId) {
      clearInterval(this.refrescoCajaId);
      this.refrescoCajaId = null;
    }
  }

  private crearTicketCobro(): TicketCobro {
    return {
      faseCobro: 'facturar',
      metodoPago: 'efectivo',
      metodoCobroAporte: 'efectivo',
      servicioCobroId: null,
      planSeguro: '',
      requiereAportePaciente: false,
      pagosMultiples: false,
      montoRecibido: null,
      aporteCliente: null,
      referenciaPago: '',
      cambio: 0,
      seguroNombre: '',
      seguroNumero: '',
      pagos: []
    };
  }

  private crearDatosPaciente(): DatosPacienteForm {
    return {
      cedula: '',
      nombre: '',
      edad: null
    };
  }

  private resetFlujo() {
    this.pasoActual = 1;
    this.ticketSeleccionado = null;
    this.ultimoCobroTicketCodigo = '';
    this.busquedaServicio = '';
    this.busquedaTicket = '';
    this.areaDestinoMensaje = '';
    this.mensajePacienteCobro = null;
    this.reciboUltimoCobro = null;
    this.ticketCobro = this.crearTicketCobro();
    this.datosPaciente = this.crearDatosPaciente();
    this.pacienteEncontrado = false;
    this.busquedaPacienteEnProceso = false;
  }

  private async cargarDatos() {
    try {
      this.serviciosDisponibles = await this.serviciosPreciosDbService.listarActivos();
      await this.cargarTicketsPendientes();
      this.totalPagadosHoy = await this.contarCobrosHoy();
      this.totalIngresosNormalesHoy = await this.sumarCobrosNormalesHoy();
      this.totalGananciaInternaHoy = await this.sumarGananciaInternaHoy();
      this.totalPendienteSenasaHoy = await this.sumarPendienteSeguroHoy(['SENASA SUBSIDIADO', 'SENASA CONTRIBUTIVO', 'SENASA']);
      this.totalPendienteRenacerHoy = await this.sumarPendienteSeguroHoy(['ARS RENACER']);
      this.totalIngresosHoy = this.totalIngresosNormalesHoy + this.totalGananciaInternaHoy;
    } catch (error) {
      console.error('Error cargando caja:', error);
      this.mostrarNotificacion('error', 'Error', 'No se pudieron cargar los datos.');
    } finally {
      this.cdr.detectChanges();
    }
  }

  private iniciarRefrescoAutomatico() {
    if (this.refrescoCajaId) {
      clearInterval(this.refrescoCajaId);
    }

    this.refrescoCajaId = setInterval(() => {
      void this.refrescarCajaSilenciosamente();
    }, 5000);
  }

  private async refrescarCajaSilenciosamente() {
    if (this.refrescandoCaja || this.pagoEnProceso) return;

    this.refrescandoCaja = true;
    try {
      await this.cargarTicketsPendientes();
      this.totalPagadosHoy = await this.contarCobrosHoy();
      this.totalIngresosNormalesHoy = await this.sumarCobrosNormalesHoy();
      this.totalGananciaInternaHoy = await this.sumarGananciaInternaHoy();
      this.totalPendienteSenasaHoy = await this.sumarPendienteSeguroHoy(['SENASA SUBSIDIADO', 'SENASA CONTRIBUTIVO', 'SENASA']);
      this.totalPendienteRenacerHoy = await this.sumarPendienteSeguroHoy(['ARS RENACER']);
      this.totalIngresosHoy = this.totalIngresosNormalesHoy + this.totalGananciaInternaHoy;
    } catch (error) {
      console.error('Error refrescando caja:', error);
    } finally {
      this.refrescandoCaja = false;
      this.cdr.detectChanges();
    }
  }

  private async contarCobrosHoy(): Promise<number> {
    const { inicio, fin } = this.obtenerRangoDia();
    const { count, error } = await this.supabaseService
      .getClient()
      .from('cobros')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', inicio)
      .lt('created_at', fin);

    if (error) throw error;
    return count ?? 0;
  }

  private async sumarCobrosNormalesHoy(): Promise<number> {
    const { inicio, fin } = this.obtenerRangoDia();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('cobros')
      .select('monto_servicio, metodo_pago, monto_aporte_cliente, detalle_pagos')
      .gte('created_at', inicio)
      .lt('created_at', fin);

    if (error) throw error;
    return (data ?? []).reduce((acc: number, row: { monto_servicio: number; metodo_pago: MetodoPago; monto_aporte_cliente?: number | null; detalle_pagos?: PagoDetalle[] | string | null }) => {
      const detalles = Array.isArray(row.detalle_pagos)
        ? row.detalle_pagos
        : typeof row.detalle_pagos === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(row.detalle_pagos);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()
          : [];

      if (detalles.length > 0) {
        return acc + detalles.reduce((sum, detalle) => sum + Number(detalle.monto ?? 0), 0);
      }

      const esSeguro = row.metodo_pago === 'senasa' || row.metodo_pago === 'renacer';
      const monto = esSeguro ? Number(row.monto_aporte_cliente ?? 0) : Number(row.monto_servicio ?? 0);
      return acc + monto;
    }, 0);
  }

  private async sumarGananciaInternaHoy(): Promise<number> {
    const { inicio, fin } = this.obtenerRangoDia();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('cobros')
      .select('monto_ganancia_interna')
      .gte('created_at', inicio)
      .lt('created_at', fin);

    if (error) throw error;

    return (data ?? []).reduce((acc: number, row: { monto_ganancia_interna?: number | null }) => {
      return acc + Number(row.monto_ganancia_interna ?? 0);
    }, 0);
  }

  private async sumarPendienteSeguroHoy(aseguradoras: string[]): Promise<number> {
    const { inicio, fin } = this.obtenerRangoDia();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('cuentas_por_cobrar')
      .select('monto_pendiente, aseguradora')
      .eq('estado', 'pendiente')
      .gte('created_at', inicio)
      .lt('created_at', fin);

    if (error) throw error;
    return (data ?? [])
      .filter((row: { aseguradora?: string | null }) => this.esSeguroIncluido(row.aseguradora, aseguradoras))
      .reduce((acc: number, row: { monto_pendiente: number }) => acc + Number(row.monto_pendiente ?? 0), 0);
  }

  private obtenerRangoDia() {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1).toISOString();
    return { inicio, fin };
  }

  private async cargarTicketsPendientes() {
    const turnos = await this.turnosDbService.listarTurnosEspera();
    this.ticketsPendientes = turnos.map((turno) => this.mapTurnoToTicket(turno));
    this.totalPendientes = this.ticketsPendientes.length;

    if (this.ticketSeleccionado) {
      const actualizado = this.ticketsPendientes.find((item) => item.id === this.ticketSeleccionado?.id);
      if (actualizado) {
        this.ticketSeleccionado = actualizado;
        this.ticketCobro.servicioCobroId = actualizado.servicioPrecioId;
      }
    }
  }

  private mapTurnoToTicket(turno: TurnoDb): TicketPendiente {
    const servicio = this.serviciosDisponibles.find((item) => item.id === turno.servicio_id || item.codigo === turno.servicio_id);
    const aporteEfectivo = servicio?.requiere_aporte_efectivo ? Number(servicio.monto_aporte_efectivo ?? 0) : 0;

    return {
      ...turno,
      monto: Number(servicio?.precio ?? 0) + aporteEfectivo,
      areaDestino: servicio?.area_destino ?? turno.categoria,
      servicioPrecioId: servicio?.id ?? null,
      servicioPrecioNombre: servicio?.nombre ?? turno.servicio_nombre,
      pacienteNombre: turno.paciente_nombre,
      pacienteCedula: turno.paciente_cedula,
      servicioNombre: turno.servicio_nombre
    };
  }

  private clasificarSeguroServicio(servicio: ServicioPrecioDb): { metodo: Exclude<MetodoPago, 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'>; planSeguro: Exclude<PlanSeguro, ''>; etiqueta: string } | null {
    if (!servicio.aplica_seguro) return null;

    const texto = `${servicio.codigo} ${servicio.nombre} ${servicio.categoria} ${servicio.area_destino}`.toUpperCase();

    if (texto.includes('RENACER')) {
      return { metodo: 'renacer', planSeguro: 'renacer', etiqueta: 'ARS RENACER' };
    }

    if (texto.includes('CONTRIBUTIVO')) {
      return { metodo: 'senasa', planSeguro: 'contributivo', etiqueta: 'SENASA CONTRIBUTIVO' };
    }

    if (texto.includes('SUBSIDIADO')) {
      return { metodo: 'senasa', planSeguro: 'subsidiado', etiqueta: 'SENASA SUBSIDIADO' };
    }

    if (servicio.precio_contributivo !== null && servicio.precio_contributivo !== undefined) {
      return { metodo: 'senasa', planSeguro: 'contributivo', etiqueta: 'SENASA CONTRIBUTIVO' };
    }

    if (servicio.precio_subsidiado !== null && servicio.precio_subsidiado !== undefined) {
      return { metodo: 'senasa', planSeguro: 'subsidiado', etiqueta: 'SENASA SUBSIDIADO' };
    }

    if (servicio.precio_renacer !== null && servicio.precio_renacer !== undefined) {
      return { metodo: 'renacer', planSeguro: 'renacer', etiqueta: 'ARS RENACER' };
    }

    return null;
  }

  private normalizarTexto(valor: string | null | undefined): string {
    return (valor ?? '').toString().trim();
  }

  private esSeguroIncluido(aseguradora: string | null | undefined, objetivos: string[]): boolean {
    const valor = this.normalizarTexto(aseguradora).toUpperCase();
    if (!valor) return false;

    return objetivos.some((objetivo) => {
      const comparacion = objetivo.toUpperCase();
      if (comparacion === 'SENASA') {
        return valor.includes('SENASA');
      }
      return valor === comparacion;
    });
  }

  private esDatoPacientePendiente(ticket: TicketPendiente): boolean {
    const nombre = this.normalizarTexto(ticket.pacienteNombre).toUpperCase();
    const cedula = this.normalizarTexto(ticket.pacienteCedula).toUpperCase();
    return !nombre || nombre === 'CLIENTE' || nombre === 'SIN REGISTRAR' || cedula === 'KIOSKO' || cedula === 'PENDIENTE' || !cedula;
  }

  private cargarPacienteDesdeTicket(ticket: TicketPendiente) {
    if (this.esDatoPacientePendiente(ticket)) {
      this.datosPaciente = this.crearDatosPaciente();
      this.pacienteEncontrado = false;
      return;
    }

    this.datosPaciente = {
      cedula: ticket.pacienteCedula ?? '',
      nombre: ticket.pacienteNombre ?? '',
      edad: ticket.paciente_edad ?? null
    };
    this.pacienteEncontrado = true;
  }

  private async crearCuentaSeguro(cuenta: CuentaPorCobrarDb) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('cuentas_por_cobrar')
      .insert(cuenta)
      .select()
      .single();

    if (error) throw error;
    return data as CuentaPorCobrarDb;
  }

  get serviciosParaCobro(): ServicioPrecioDb[] {
    const texto = this.busquedaServicio.trim().toLowerCase();
    if (!texto) return this.serviciosDisponibles;

    return this.serviciosDisponibles.filter((item) => {
      const campo = `${item.codigo} ${item.nombre} ${item.categoria} ${item.area_destino}`.toLowerCase();
      return campo.includes(texto);
    });
  }

  get ticketsPendientesFiltrados(): TicketPendiente[] {
    const texto = this.busquedaTicket.trim().toLowerCase();
    if (!texto) return this.ticketsPendientes;

    return this.ticketsPendientes.filter((ticket) => {
      const campo = `${ticket.codigo} ${ticket.pacienteNombre} ${ticket.pacienteCedula} ${ticket.servicioNombre} ${ticket.areaDestino} ${ticket.categoria}`.toLowerCase();
      return campo.includes(texto);
    });
  }

  get totalCobroActual(): number {
    const servicio = this.servicioSeleccionadoCobro;
    if (!servicio) return this.ticketSeleccionado?.monto ?? 0;

    const aporteEfectivo = servicio.requiere_aporte_efectivo ? Number(servicio.monto_aporte_efectivo ?? 0) : 0;
    return Number(servicio.precio ?? this.ticketSeleccionado?.monto ?? 0) + aporteEfectivo;
  }

  get montoBaseServicio(): number {
    return this.totalCobroActual;
  }

  get gananciaInternaServicio(): number {
    const servicio = this.servicioSeleccionadoCobro;
    if (!servicio?.aplica_seguro) return 0;
    return Math.max(Number(servicio.monto_ganancia_interna ?? 0), 0);
  }

  get montoTotalInternoServicio(): number {
    return this.montoBaseServicio + this.gananciaInternaServicio;
  }

  get montoCoberturaSeguro(): number {
    const servicio = this.servicioSeleccionadoCobro;
    if (!servicio || !servicio.aplica_seguro) return 0;

    if (this.ticketCobro.metodoPago === 'renacer') {
      return Number(servicio.precio_renacer ?? 0);
    }

    if (this.ticketCobro.planSeguro === 'subsidiado') {
      return Number(servicio.precio_subsidiado ?? 0);
    }

    if (this.ticketCobro.planSeguro === 'contributivo') {
      return Number(servicio.precio_contributivo ?? 0);
    }

    return Number(servicio.precio_subsidiado ?? servicio.precio_contributivo ?? servicio.precio_renacer ?? 0);
  }

  get montoDiferenciaPaciente(): number {
    return Math.max(this.montoBaseServicio - this.montoCoberturaSeguro, 0);
  }

  get servicioSeleccionadoCobro(): ServicioPrecioDb | null {
    return this.serviciosDisponibles.find((item) => item.id === this.ticketCobro.servicioCobroId) ?? null;
  }

  get servicioSeguroAutomaticoSeleccionado(): boolean {
    const servicio = this.servicioSeleccionadoCobro;
    return !!servicio && !!this.clasificarSeguroServicio(servicio);
  }

  get etiquetaSeguroAutomaticoSeleccionado(): string {
    const servicio = this.servicioSeleccionadoCobro;
    const clasificacion = servicio ? this.clasificarSeguroServicio(servicio) : null;
    return clasificacion?.etiqueta ?? '';
  }

  get servicioPermiteSenasaSeleccionado(): boolean {
    const servicio = this.servicioSeleccionadoCobro;
    if (!servicio?.aplica_seguro) return false;
    return (
      servicio.precio_subsidiado !== null && servicio.precio_subsidiado !== undefined
    ) || (
      servicio.precio_contributivo !== null && servicio.precio_contributivo !== undefined
    );
  }

  get servicioPermiteSenasaSubsidiadoSeleccionado(): boolean {
    const servicio = this.servicioSeleccionadoCobro;
    return !!servicio?.aplica_seguro && servicio.precio_subsidiado !== null && servicio.precio_subsidiado !== undefined;
  }

  get servicioPermiteSenasaContributivoSeleccionado(): boolean {
    const servicio = this.servicioSeleccionadoCobro;
    return !!servicio?.aplica_seguro && servicio.precio_contributivo !== null && servicio.precio_contributivo !== undefined;
  }

  get servicioPermiteRenacerSeleccionado(): boolean {
    const servicio = this.servicioSeleccionadoCobro;
    if (!servicio?.aplica_seguro) return false;
    return servicio.precio_renacer !== null && servicio.precio_renacer !== undefined;
  }

  get servicioPermiteSeguroSeleccionado(): boolean {
    return this.servicioPermiteSenasaSeleccionado || this.servicioPermiteRenacerSeleccionado;
  }

  get precioSeguroDisponible(): number {
    const servicio = this.servicioSeleccionadoCobro;
    if (!servicio || !servicio.aplica_seguro) return 0;
    if (this.ticketCobro.metodoPago === 'renacer') {
      return Number(servicio.precio_renacer ?? servicio.precio);
    }
    if (this.ticketCobro.planSeguro === 'subsidiado') {
      return Number(servicio.precio_subsidiado ?? servicio.precio);
    }
    if (this.ticketCobro.planSeguro === 'contributivo') {
      return Number(servicio.precio_contributivo ?? servicio.precio);
    }
    return Number(servicio.precio_subsidiado ?? servicio.precio_contributivo ?? servicio.precio_renacer ?? servicio.precio ?? 0);
  }

  get aporteClienteSeguro(): number {
    return Number(this.ticketCobro.aporteCliente ?? 0);
  }

  get saldoSeguroPendiente(): number {
    return Math.max(this.montoBaseServicio - this.aporteClienteSeguro, 0);
  }

  get montoObjetivoPagoCliente(): number {
    if (this.servicioSeguroAutomaticoSeleccionado || this.ticketCobro.metodoPago === 'senasa' || this.ticketCobro.metodoPago === 'renacer') {
      if (!this.ticketCobro.requiereAportePaciente) return 0;
      return Math.max(Number(this.ticketCobro.aporteCliente ?? this.montoDiferenciaPaciente), 0);
    }

    return this.montoBaseServicio;
  }

  get totalPagosCliente(): number {
    return this.ticketCobro.pagos.reduce((acc, pago) => acc + Number(pago.monto ?? 0), 0);
  }

  get saldoPagosCliente(): number {
    return Math.max(this.montoObjetivoPagoCliente - this.totalPagosCliente, 0);
  }

  get saldoPagosClienteFirmado(): number {
    return Number((this.totalPagosCliente - this.montoObjetivoPagoCliente).toFixed(2));
  }

  get pagosRequeridos(): boolean {
    return this.montoObjetivoPagoCliente > 0;
  }

  get puedeCobrarActual(): boolean {
    if (!this.ticketSeleccionado || this.montoBaseServicio <= 0) {
      return false;
    }

    if (this.servicioSeguroAutomaticoSeleccionado || this.ticketCobro.metodoPago === 'senasa' || this.ticketCobro.metodoPago === 'renacer') {
      return Boolean(this.ticketCobro.seguroNumero.trim()) && Boolean(this.nombreAseguradoraSeleccionada);
    }

    if (this.ticketCobro.pagosMultiples) {
      return this.pagoDivididoValido();
    }

    return Number(this.ticketCobro.montoRecibido ?? 0) > 0;
  }

  get nombreAseguradoraSeleccionada(): string {
    if (this.ticketCobro.metodoPago === 'renacer') {
      return 'ARS RENACER';
    }
    switch (this.ticketCobro.planSeguro) {
      case 'subsidiado':
        return 'SENASA SUBSIDIADO';
      case 'contributivo':
        return 'SENASA CONTRIBUTIVO';
      default:
        return '';
    }
  }

  seleccionarSenasaSubsidiado() {
    this.ticketCobro.metodoPago = 'senasa';
    this.ticketCobro.planSeguro = 'subsidiado';
    this.onServicioCobroChange();
  }

  seleccionarSenasaContributivo() {
    this.ticketCobro.metodoPago = 'senasa';
    this.ticketCobro.planSeguro = 'contributivo';
    this.onServicioCobroChange();
  }

  toggleSenasaSubsidiado() {
    const activo = this.ticketCobro.metodoPago === 'senasa' && this.ticketCobro.planSeguro === 'subsidiado';
    if (activo) {
      this.resetCoberturaSeleccionada();
      return;
    }
    this.seleccionarSenasaSubsidiado();
  }

  toggleSenasaContributivo() {
    const activo = this.ticketCobro.metodoPago === 'senasa' && this.ticketCobro.planSeguro === 'contributivo';
    if (activo) {
      this.resetCoberturaSeleccionada();
      return;
    }
    this.seleccionarSenasaContributivo();
  }

  toggleRenacer() {
    const activo = this.ticketCobro.metodoPago === 'renacer';
    if (activo) {
      this.resetCoberturaSeleccionada();
      return;
    }
    this.ticketCobro.metodoPago = 'renacer';
    this.ticketCobro.planSeguro = 'renacer';
    this.onServicioCobroChange();
  }

  quitarCoberturaSeleccionada() {
    this.resetCoberturaSeleccionada();
  }

  private resetCoberturaSeleccionada() {
    this.ticketCobro.metodoPago = 'efectivo';
    this.ticketCobro.planSeguro = '';
    this.ticketCobro.seguroNombre = '';
    this.ticketCobro.seguroNumero = '';
    this.ticketCobro.metodoCobroAporte = 'efectivo';
    this.ticketCobro.requiereAportePaciente = false;
    this.ticketCobro.aporteCliente = null;
    this.ticketCobro.montoRecibido = this.montoBaseServicio > 0 ? this.montoBaseServicio : null;
    this.ticketCobro.pagosMultiples = false;
    this.ticketCobro.pagos = [];
    this.ticketCobro.cambio = 0;
    this.ticketCobro.faseCobro = 'facturar';
    this.calcularCambio();
    this.cdr.detectChanges();
  }

  seleccionarMetodoPagoSimple(metodo: MetodoPagoLinea) {
    this.ticketCobro.metodoPago = metodo;
    this.ticketCobro.planSeguro = '';
    this.ticketCobro.seguroNombre = '';
    this.ticketCobro.seguroNumero = '';
    this.ticketCobro.metodoCobroAporte = metodo;
    this.ticketCobro.requiereAportePaciente = false;
    this.ticketCobro.aporteCliente = null;
    this.ticketCobro.montoRecibido = this.montoBaseServicio > 0 ? this.montoBaseServicio : null;
    this.ticketCobro.pagosMultiples = false;
    this.ticketCobro.pagos = [];
    this.ticketCobro.cambio = 0;
    this.ticketCobro.faseCobro = 'pagar';
    this.calcularCambio();
    this.cdr.detectChanges();
  }

  togglePagosMultiples() {
    this.ticketCobro.pagosMultiples = !this.ticketCobro.pagosMultiples;
    if (this.ticketCobro.pagosMultiples) {
      this.ticketCobro.pagos = [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          metodo: 'efectivo',
          monto: 0,
          referencia: ''
        }
      ];
      this.ticketCobro.montoRecibido = null;
    } else {
      this.ticketCobro.pagos = [];
      this.ticketCobro.montoRecibido = this.montoBaseServicio > 0 ? this.montoBaseServicio : null;
    }
    this.ticketCobro.cambio = 0;
    this.calcularCambio();
    this.cdr.detectChanges();
  }

  seleccionarMetodoCobroAporte(metodo: MetodoPagoLinea) {
    this.ticketCobro.metodoCobroAporte = metodo;
    this.cdr.detectChanges();
  }

  cambiarMetodoPagoLinea(pagoId: string, metodo: MetodoPagoLinea) {
    const pago = this.ticketCobro.pagos.find((item) => item.id === pagoId);
    if (!pago) return;
    pago.metodo = metodo;
    this.cdr.detectChanges();
  }

  pagoDivididoValido(): boolean {
    return this.ticketCobro.pagos.length > 0 && Math.abs(this.totalPagosCliente - this.montoObjetivoPagoCliente) <= 0.01;
  }

  continuarAPago() {
    const servicio = this.servicioSeleccionadoCobro;
    if (!servicio) {
      this.mostrarNotificacion('warning', 'Servicio requerido', 'Seleccione un servicio antes de continuar al pago.');
      return;
    }

    if ((this.ticketCobro.metodoPago === 'senasa' || this.ticketCobro.metodoPago === 'renacer') && !this.ticketCobro.seguroNumero.trim()) {
      this.mostrarNotificacion('warning', 'Seguro requerido', 'Ingrese el número de afiliación antes de pagar.');
      return;
    }

    if ((this.ticketCobro.metodoPago === 'senasa' || this.ticketCobro.metodoPago === 'renacer') && !this.nombreAseguradoraSeleccionada) {
      this.mostrarNotificacion('warning', 'Cobertura requerida', 'Seleccione la cobertura del seguro antes de pagar.');
      return;
    }

    if (this.ticketCobro.metodoPago === 'senasa' && !this.servicioPermiteSenasaSeleccionado) {
      this.mostrarNotificacion('warning', 'Seguro no disponible', 'Este servicio no aplica cobertura SENASA.');
      return;
    }

    if (this.ticketCobro.metodoPago === 'renacer' && !this.servicioPermiteRenacerSeleccionado) {
      this.mostrarNotificacion('warning', 'Seguro no disponible', 'Este servicio no aplica cobertura ARS Renacer.');
      return;
    }

    this.ticketCobro.faseCobro = 'pagar';
    if (this.servicioSeguroAutomaticoSeleccionado || this.ticketCobro.metodoPago === 'senasa' || this.ticketCobro.metodoPago === 'renacer') {
      this.ticketCobro.aporteCliente = Math.max(Number(this.ticketCobro.aporteCliente ?? this.montoDiferenciaPaciente), 0);
      this.ticketCobro.montoRecibido = this.ticketCobro.aporteCliente;
    } else {
      if (this.ticketCobro.pagosMultiples) {
        this.ticketCobro.montoRecibido = this.totalPagosCliente;
      } else {
        this.ticketCobro.montoRecibido = Math.max(Number(this.ticketCobro.montoRecibido ?? this.montoBaseServicio), 0);
      }
    }
    this.calcularCambio();
    this.cdr.detectChanges();
  }

  volverAFacturar() {
    this.ticketCobro.faseCobro = 'facturar';
    this.cdr.detectChanges();
  }

  volver() {
    if (this.pagoEnProceso) {
      this.mostrarNotificacion('error', 'Espera', 'Termina el proceso actual antes de salir.');
      return;
    }
    this.back.emit();
  }

  seleccionarTicket(ticket: TicketPendiente) {
    if (this.pagoEnProceso) return;

    this.ticketSeleccionado = ticket;
    this.ticketCobro = this.crearTicketCobro();
    this.ticketCobro.servicioCobroId = ticket.servicioPrecioId;
    this.busquedaServicio = '';
    this.cargarPacienteDesdeTicket(ticket);
    this.onServicioCobroChange();
    if (!this.servicioSeleccionadoCobro?.aplica_seguro) {
      this.agregarPago('efectivo');
    }
    this.ticketCobro.faseCobro = 'facturar';
    this.pasoActual = 2;
    this.notificacion = null;
    this.cdr.detectChanges();
  }

  async buscarPacientePorCedula() {
    const cedula = this.datosPaciente.cedula.trim();
    if (!cedula) {
      this.pacienteEncontrado = false;
      return;
    }

    this.busquedaPacienteEnProceso = true;
    try {
      const paciente = await this.pacientesDbService.buscarPorCedula(cedula);
      if (paciente) {
        this.datosPaciente = {
          cedula: paciente.cedula,
          nombre: paciente.nombre,
          edad: paciente.edad
        };
        this.pacienteEncontrado = true;
        this.mostrarNotificacion('info', 'Paciente encontrado', 'La ficha fue cargada desde el historial.');
      } else {
        this.pacienteEncontrado = false;
        this.mostrarNotificacion('info', 'Paciente no registrado', 'Puede completar los datos manualmente.');
      }
    } catch (error) {
      console.error('Error buscando paciente:', error);
      this.pacienteEncontrado = false;
      this.mostrarNotificacion('error', 'Error', 'No se pudo buscar el paciente.');
    } finally {
      this.busquedaPacienteEnProceso = false;
      this.cdr.detectChanges();
    }
  }

  private validarDatosPaciente(): string | null {
    if (!this.ticketSeleccionado) return 'Debe seleccionar un ticket.';
    if (!this.datosPaciente.cedula.trim()) return 'Ingrese la cédula o ID del paciente.';
    if (!this.datosPaciente.nombre.trim()) return 'Ingrese el nombre completo del paciente.';
    if (!this.datosPaciente.edad || this.datosPaciente.edad <= 0) return 'Ingrese una edad válida.';
    return null;
  }

  async guardarDatosPacienteYContinuar() {
    const error = this.validarDatosPaciente();
    if (error) {
      this.mostrarNotificacion('warning', 'Datos requeridos', error);
      return;
    }

    if (!this.ticketSeleccionado) {
      this.mostrarNotificacion('error', 'Error', 'Debe seleccionar un ticket.');
      return;
    }

    try {
      const paciente = await this.pacientesDbService.guardarPaciente({
        cedula: this.datosPaciente.cedula.trim(),
        nombre: this.datosPaciente.nombre.trim(),
        edad: Number(this.datosPaciente.edad),
        telefono: null,
        correo: null,
        fechaNacimiento: null
      });

      const ticketActualizado = await this.turnosDbService.actualizarTurno(this.ticketSeleccionado.id, {
        paciente_cedula: paciente.cedula,
        paciente_nombre: paciente.nombre,
        paciente_edad: paciente.edad,
        fecha_llamado: this.ticketSeleccionado.fecha_llamado ?? new Date().toISOString()
      });

      this.ticketSeleccionado = {
        ...this.ticketSeleccionado,
        ...ticketActualizado,
        pacienteCedula: paciente.cedula,
        pacienteNombre: paciente.nombre,
        paciente_edad: paciente.edad
      };

      this.mostrarNotificacion('success', 'Datos guardados', 'La ficha del paciente fue registrada. Continúe con el cobro.');
      await this.iniciarAtencion();
    } catch (error) {
      console.error('Error guardando datos del paciente:', error);
      this.mostrarNotificacion('error', 'Error', 'No se pudieron guardar los datos del paciente.');
    }
  }

  async llamarTicket(ticket: TicketPendiente) {
    if (this.pagoEnProceso) return;

    try {
      await this.turnosDbService.actualizarTurnoEstado(ticket.id, {
        estado: 'llamando',
        puesto_atencion: 'Caja',
        fecha_llamado: new Date().toISOString()
      });

      ticket.estado = 'llamando';
      this.mostrarNotificacion('info', 'Ticket llamado', `El turno ${ticket.codigo} fue enviado a caja.`);
      this.seleccionarTicket(ticket);
      await this.cargarTicketsPendientes();
    } catch (error) {
      console.error('Error llamando ticket:', error);
      this.mostrarNotificacion('error', 'Error', 'No se pudo llamar el ticket.');
    }
  }

  async cancelarTurnoPorAusencia() {
    if (!this.ticketSeleccionado) {
      this.mostrarNotificacion('error', 'Error', 'Debe seleccionar un ticket.');
      return;
    }

    if (this.ticketSeleccionado.estado !== 'atendiendo') {
      this.mostrarNotificacion('warning', 'No permitido', 'Solo puede cancelar un turno cuando está en atención.');
      return;
    }

    const confirmar = confirm(
      `Confirme que el paciente del turno ${this.ticketSeleccionado.codigo} no se presentó y desea cancelar el turno.`
    );

    if (!confirmar) return;

    try {
      await this.turnosDbService.cancelarTurno(this.ticketSeleccionado.id, {
        puesto_atencion: this.ticketSeleccionado.areaDestino || 'Caja',
        fecha_cancelacion: new Date().toISOString(),
        motivo_cancelacion: 'Paciente ausente en atención',
        cancelado_por: this.usuarioNombre
      });

      this.mostrarNotificacion(
        'warning',
        'Turno cancelado',
        `El turno ${this.ticketSeleccionado.codigo} fue cancelado por ausencia del paciente.`
      );

      this.resetFlujo();
      await this.cargarTicketsPendientes();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error cancelando turno:', error);
      this.mostrarNotificacion('error', 'Error', 'No se pudo cancelar el turno.');
    }
  }

  async iniciarAtencion() {
    if (!this.ticketSeleccionado) {
      this.mostrarNotificacion('error', 'Error', 'Debe seleccionar un ticket.');
      return;
    }

    try {
      await this.turnosDbService.actualizarTurnoEstado(this.ticketSeleccionado.id, {
        estado: 'atendiendo',
        fecha_atencion: new Date().toISOString()
      });

      this.ticketSeleccionado.estado = 'atendiendo';
      this.mostrarNotificacion(
        'success',
        'AtenciÃ³n iniciada',
        `El paciente del turno ${this.ticketSeleccionado.codigo} estÃ¡ siendo atendido. Proceda con el cobro.`
      );
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error iniciando atenciÃ³n:', error);
      this.mostrarNotificacion('error', 'Error', 'No se pudo iniciar la atenciÃ³n.');
    }
  }

  onServicioCobroChange() {
    const servicio = this.servicioSeleccionadoCobro;
    const clasificacionSeguro = servicio ? this.clasificarSeguroServicio(servicio) : null;
    const requiereSeguro = this.servicioSeguroAutomaticoSeleccionado || this.ticketCobro.metodoPago === 'senasa' || this.ticketCobro.metodoPago === 'renacer';
    const diferenciaPaciente = this.montoDiferenciaPaciente;

    if (clasificacionSeguro) {
      this.ticketCobro.metodoPago = clasificacionSeguro.metodo;
      this.ticketCobro.planSeguro = clasificacionSeguro.planSeguro;
      this.ticketCobro.seguroNombre = clasificacionSeguro.etiqueta;
      this.ticketCobro.aporteCliente = Math.max(Number(this.ticketCobro.aporteCliente ?? diferenciaPaciente), 0);
      this.ticketCobro.requiereAportePaciente = true;
      this.ticketCobro.montoRecibido = this.ticketCobro.aporteCliente;
    } else if (servicio && requiereSeguro) {
      const permiteSenasa = this.ticketCobro.metodoPago === 'senasa' && this.servicioPermiteSenasaSeleccionado;
      const permiteRenacer = this.ticketCobro.metodoPago === 'renacer' && this.servicioPermiteRenacerSeleccionado;
      if (!servicio.aplica_seguro || (!permiteSenasa && !permiteRenacer)) {
        this.ticketCobro.metodoPago = 'efectivo';
        this.ticketCobro.planSeguro = '';
        this.mostrarNotificacion('warning', 'Seguro no disponible', 'Este servicio no aplica la cobertura seleccionada. Se ajustó el método de pago a efectivo.');
      }
    }

    if (this.ticketCobro.metodoPago === 'senasa' && servicio?.aplica_seguro) {
      if (!this.ticketCobro.planSeguro) {
        if (servicio.precio_subsidiado !== null && servicio.precio_subsidiado !== undefined) {
          this.ticketCobro.planSeguro = 'subsidiado';
        } else if (servicio.precio_contributivo !== null && servicio.precio_contributivo !== undefined) {
          this.ticketCobro.planSeguro = 'contributivo';
        } else {
          this.ticketCobro.planSeguro = 'subsidiado';
        }
      }
    } else if (this.ticketCobro.metodoPago === 'renacer' && servicio?.aplica_seguro) {
      this.ticketCobro.planSeguro = 'renacer';
    } else if (this.ticketCobro.metodoPago !== 'senasa') {
      this.ticketCobro.planSeguro = '';
    }

    if ((requiereSeguro || clasificacionSeguro) && servicio?.aplica_seguro) {
      this.ticketCobro.seguroNombre = this.etiquetaSeguroAutomaticoSeleccionado || this.nombreAseguradoraSeleccionada || this.ticketCobro.seguroNombre || (this.ticketCobro.metodoPago === 'renacer' ? 'ARS RENACER' : 'SENASA');
      this.ticketCobro.aporteCliente = Math.max(Number(this.ticketCobro.aporteCliente ?? diferenciaPaciente), 0);
      this.ticketCobro.requiereAportePaciente = true;
      this.ticketCobro.montoRecibido = this.ticketCobro.aporteCliente;
    } else {
      this.ticketCobro.seguroNombre = '';
      this.ticketCobro.aporteCliente = null;
      this.ticketCobro.requiereAportePaciente = false;
      this.ticketCobro.montoRecibido = this.montoBaseServicio > 0 ? this.montoBaseServicio : null;
    }

    this.ticketCobro.faseCobro = 'facturar';
    this.calcularCambio();
    if (servicio) {
      this.areaDestinoMensaje = servicio.area_destino;
    }
    this.cdr.detectChanges();
  }

  onBusquedaServicioChange() {
    this.cdr.detectChanges();
  }

  onCambioAportePaciente() {
    const aporte = Math.min(Math.max(Number(this.ticketCobro.aporteCliente ?? 0), 0), this.montoBaseServicio);
    this.ticketCobro.aporteCliente = aporte;
    this.ticketCobro.requiereAportePaciente = aporte > 0;
    this.ticketCobro.montoRecibido = aporte;
    this.ticketCobro.cambio = 0;
    this.calcularCambio();
    this.cdr.detectChanges();
  }

  agregarPago(metodo: MetodoPagoLinea = 'efectivo') {
    this.ticketCobro.pagos.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      metodo,
      monto: 0,
      referencia: ''
    });
    this.cdr.detectChanges();
  }

  quitarPago(id: string) {
    this.ticketCobro.pagos = this.ticketCobro.pagos.filter((pago) => pago.id !== id);
    this.cdr.detectChanges();
  }

  limpiarPagos() {
    this.ticketCobro.pagos = [];
    this.cdr.detectChanges();
  }

  private normalizarPagosDetalle(): PagoDetalle[] {
    return this.ticketCobro.pagos
      .map((pago) => ({
        ...pago,
        monto: Number(pago.monto ?? 0)
      }))
      .filter((pago) => pago.monto > 0);
  }

  private tipoCobroRegistrado(): MetodoPago {
    return this.ticketCobro.metodoPago === 'senasa' || this.ticketCobro.metodoPago === 'renacer'
      ? this.ticketCobro.metodoPago
      : this.ticketCobro.metodoPago;
  }

  calcularCambio() {
    const esSeguro = this.ticketCobro.metodoPago === 'senasa' || this.ticketCobro.metodoPago === 'renacer';
    if (esSeguro) {
      this.ticketCobro.cambio = 0;
      return;
    }

    if (this.ticketCobro.pagosMultiples) {
      this.ticketCobro.cambio = 0;
      return;
    }

    const montoRecibido = Number(this.ticketCobro.montoRecibido ?? 0);
    this.ticketCobro.cambio = Math.max(montoRecibido - this.montoBaseServicio, 0);
  }

  async procesarCobro() {
    if (!this.ticketSeleccionado) {
      this.mostrarNotificacion('error', 'Seleccione un ticket', 'Debe elegir un ticket pendiente.');
      return;
    }

    const total = this.montoBaseServicio;
    const gananciaInterna = this.gananciaInternaServicio;
    const totalInterno = this.montoTotalInternoServicio;
    if (!total || total <= 0) {
      this.mostrarNotificacion('error', 'Servicio requerido', 'Debe seleccionar un servicio con precio.');
      return;
    }

    const esSeguro = this.servicioSeguroAutomaticoSeleccionado || this.ticketCobro.metodoPago === 'senasa' || this.ticketCobro.metodoPago === 'renacer';

    if (!this.servicioSeguroAutomaticoSeleccionado && this.ticketCobro.metodoPago === 'senasa' && !this.servicioPermiteSenasaSeleccionado) {
      this.mostrarNotificacion('error', 'Seguro no disponible', 'El servicio seleccionado no aplica cobertura SENASA.');
      return;
    }

    if (!this.servicioSeguroAutomaticoSeleccionado && this.ticketCobro.metodoPago === 'renacer' && !this.servicioPermiteRenacerSeleccionado) {
      this.mostrarNotificacion('error', 'Seguro no disponible', 'El servicio seleccionado no aplica cobertura ARS Renacer.');
      return;
    }

    if (esSeguro && !this.ticketCobro.seguroNumero.trim()) {
      this.mostrarNotificacion('error', 'Seguro requerido', 'Ingrese el número de afiliación del seguro.');
      return;
    }

    if (esSeguro && !this.nombreAseguradoraSeleccionada) {
      this.mostrarNotificacion('error', 'Cobertura requerida', 'Seleccione una cobertura de seguro.');
      return;
    }

    const aporteEsperado = this.montoDiferenciaPaciente;
    const aporteCliente = esSeguro ? Math.max(Number(this.ticketCobro.aporteCliente ?? aporteEsperado), 0) : 0;
    const pagosDetalleNormal = this.normalizarPagosDetalle();
    const totalPagadoNormal = pagosDetalleNormal.reduce((acc, pago) => acc + Number(pago.monto ?? 0), 0);
    const montoRecibido = esSeguro
      ? aporteCliente
      : this.ticketCobro.pagosMultiples
        ? totalPagadoNormal
        : Math.max(Number(this.ticketCobro.montoRecibido ?? 0), 0);
    const cambio = esSeguro || this.ticketCobro.pagosMultiples ? 0 : Math.max(montoRecibido - total, 0);

    if (esSeguro && Math.abs(aporteCliente - aporteEsperado) > 0.01) {
      this.mostrarNotificacion('error', 'Aporte inválido', 'El aporte debe coincidir con la diferencia del seguro.');
      return;
    }

    if (!esSeguro && this.ticketCobro.pagosMultiples) {
      if (pagosDetalleNormal.length === 0) {
        this.mostrarNotificacion('error', 'Pago requerido', 'Agregue al menos una forma de pago.');
        return;
      }

      if (Math.abs(totalPagadoNormal - total) > 0.01) {
        this.mostrarNotificacion('error', 'Pago incompleto', 'La suma de los pagos debe ser igual al total de la factura.');
        return;
      }
    }

    if (!esSeguro && !this.ticketCobro.pagosMultiples) {
      if (montoRecibido <= 0) {
        this.mostrarNotificacion('error', 'Pago requerido', 'Ingrese el monto recibido para completar el cobro.');
        return;
      }

      if (montoRecibido + 0.01 < total) {
        this.mostrarNotificacion('error', 'Pago incompleto', 'El monto recibido debe cubrir el total de la factura.');
        return;
      }
    }

    this.pagoEnProceso = true;
    this.cdr.detectChanges();

    try {
      const cobroExistente = await this.cobrosDbService.buscarPorTurnoId(this.ticketSeleccionado.id);
      if (cobroExistente) {
        this.mostrarNotificacion('info', 'Ya cobrado', 'Este ticket ya tiene un cobro registrado.');
        return;
      }

      const servicio = this.serviciosDisponibles.find((item) => item.id === this.ticketCobro.servicioCobroId);
      const areaDestino = servicio?.area_destino || this.ticketSeleccionado.areaDestino || 'Área correspondiente';
      const referenciaPago = this.ticketCobro.referenciaPago.trim();
      const metodoRegistrado = esSeguro
        ? (this.ticketCobro.metodoCobroAporte as MetodoPago)
        : this.ticketCobro.pagosMultiples
          ? 'mixto'
          : this.tipoCobroRegistrado();
      const detallePago: PagoDetalle[] = esSeguro
        ? [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              metodo: this.ticketCobro.metodoCobroAporte,
              monto: aporteCliente,
              referencia: referenciaPago
            }
          ]
        : this.ticketCobro.pagosMultiples
          ? pagosDetalleNormal.map((pago) => ({
              ...pago,
              referencia: pago.referencia.trim()
            }))
          : [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                metodo: this.ticketCobro.metodoPago as MetodoPagoLinea,
                monto: montoRecibido,
                referencia: referenciaPago
              }
            ];

      await this.turnosDbService.actualizarTurnoEstado(this.ticketSeleccionado.id, {
        estado: 'finalizado',
        puesto_atencion: areaDestino,
        fecha_atencion: new Date().toISOString()
      });

      const cobro = await this.cobrosDbService.crearCobro({
        turno_id: this.ticketSeleccionado.id,
        codigo_ticket: this.ticketSeleccionado.codigo,
        paciente_nombre: this.ticketSeleccionado.pacienteNombre,
        paciente_cedula: this.ticketSeleccionado.pacienteCedula,
        servicio_nombre: servicio?.nombre ?? this.ticketSeleccionado.servicioNombre,
        servicio_id: servicio?.id ?? this.ticketCobro.servicioCobroId,
        monto_servicio: total,
        monto_ganancia_interna: gananciaInterna,
        monto_total_interno: totalInterno,
        metodo_pago: metodoRegistrado,
        monto_recibido: montoRecibido,
        cambio,
        referencia_pago: referenciaPago || null,
        monto_aporte_cliente: esSeguro ? aporteCliente : null,
        seguro_nombre: esSeguro ? (this.ticketCobro.seguroNombre || this.etiquetaSeguroAutomaticoSeleccionado || this.nombreAseguradoraSeleccionada) : null,
        seguro_numero: esSeguro ? this.ticketCobro.seguroNumero : null,
        detalle_pagos: detallePago,
        area_destino: areaDestino,
        estado: 'pagado',
        cajero: this.usuarioNombre
      });

      await this.expedientesMedicosDbService.crearExpediente({
        turno_id: this.ticketSeleccionado.id,
        cobro_id: cobro.id,
        paciente_id: null,
        paciente_nombre: this.ticketSeleccionado.pacienteNombre,
        paciente_cedula: this.ticketSeleccionado.pacienteCedula,
        paciente_telefono: null,
        paciente_correo: null,
        servicio_nombre: servicio?.nombre ?? this.ticketSeleccionado.servicioNombre,
        area_destino: areaDestino,
        motivo_consulta: null,
        antecedentes: null,
        examen_fisico: null,
        diagnostico: null,
        tratamiento: null,
        indicaciones: null,
        conclusion: null,
        requiere_receta: false,
        estado: 'borrador',
        medico_nombre: null,
        medico_rol: null,
        fecha_atencion: new Date().toISOString(),
        fecha_cierre: null,
        correo_envio: null,
        whatsapp_envio: null,
        archivo_pdf_url: null
      });

      if (esSeguro) {
        await this.crearCuentaSeguro({
          turno_id: this.ticketSeleccionado.id,
          cobro_id: cobro.id,
          codigo_ticket: this.ticketSeleccionado.codigo,
          paciente_nombre: this.ticketSeleccionado.pacienteNombre,
          paciente_cedula: this.ticketSeleccionado.pacienteCedula,
          servicio_nombre: servicio?.nombre ?? this.ticketSeleccionado.servicioNombre,
          servicio_id: servicio?.id ?? this.ticketCobro.servicioCobroId,
          aseguradora: this.ticketCobro.seguroNombre?.trim() || this.nombreAseguradoraSeleccionada || 'SENASA',
          monto_total: total,
          monto_pagado_paciente: aporteCliente,
          monto_aporte_cliente: aporteCliente,
          monto_pendiente: Math.max(total - aporteCliente, 0),
          estado: 'pendiente',
          fecha_vencimiento: null,
          notas: `Cuenta por cobrar generada desde caja por cobertura ${this.ticketCobro.seguroNombre?.trim() || 'seguro'}`
        });
      }

      this.totalIngresosNormalesHoy += montoRecibido;
      this.totalGananciaInternaHoy += gananciaInterna;
      this.totalIngresosHoy = this.totalIngresosNormalesHoy + this.totalGananciaInternaHoy;
      if (this.ticketCobro.metodoPago === 'senasa' || this.servicioSeguroAutomaticoSeleccionado) {
        this.totalPendienteSenasaHoy += Math.max(total - aporteCliente, 0);
      } else if (this.ticketCobro.metodoPago === 'renacer' || (this.servicioSeguroAutomaticoSeleccionado && this.etiquetaSeguroAutomaticoSeleccionado === 'ARS RENACER')) {
        this.totalPendienteRenacerHoy += Math.max(total - aporteCliente, 0);
      }

      this.totalPagadosHoy += 1;
      this.ultimoCobroTicketCodigo = this.ticketSeleccionado.codigo;
      this.reciboUltimoCobro = {
        codigoTicket: this.ticketSeleccionado.codigo,
        servicioNombre: servicio?.nombre ?? this.ticketSeleccionado.servicioNombre,
        montoBase: total,
        montoCoberturaSeguro: esSeguro ? this.montoCoberturaSeguro : 0,
        montoDiferenciaCliente: esSeguro ? aporteCliente : total,
        montoGananciaInterna: gananciaInterna,
        totalInterno,
        total,
        metodoPago: metodoRegistrado,
        montoRecibido,
        aporteCliente: esSeguro ? aporteCliente : null,
        detallePagos: detallePago,
        cambio,
        referenciaPago,
        fecha: new Date().toISOString()
      };

      const textoPago = esSeguro
        ? `Turno ${this.ticketSeleccionado.codigo} registrado con ${this.nombreAseguradoraSeleccionada}. Se guardó la cobertura y la diferencia del cliente.`
        : this.ticketCobro.pagosMultiples
          ? `Turno ${this.ticketSeleccionado.codigo} cobrado en varias partes. Diríjase a ${areaDestino} para continuar con su atención.`
          : `Turno ${this.ticketSeleccionado.codigo} pagado. Diríjase a ${areaDestino} para continuar con su atención.`;

      this.mostrarNotificacion('success', 'Pago exitoso', textoPago);

      this.mensajePacienteCobro = esSeguro
        ? `PAGO COMPLETADO\n\nTurno: ${this.ticketSeleccionado.codigo}\nMonto total de la factura: RD$ ${total.toFixed(
            2
          )}\nCobertura del seguro: RD$ ${this.montoCoberturaSeguro.toFixed(2)}\nAporte de la fundación: RD$ ${aporteCliente.toFixed(2)}\nSaldo pendiente de seguro: RD$ ${Math.max(total - aporteCliente, 0).toFixed(
            2
          )}\n\n${this.nombreAseguradoraSeleccionada}: cuenta registrada como pendiente de cobro a la aseguradora.`
        : `PAGO COMPLETADO\n\nTurno: ${this.ticketSeleccionado.codigo}\nMonto recibido: RD$ ${montoRecibido.toFixed(
            2
          )}\nCambio: RD$ ${cambio.toFixed(2)}\n\nINDICACIÓN PARA EL PACIENTE:\nDiríjase a ${areaDestino} para continuar con su atención.`;

      this.pasoActual = 3;
      this.imprimirComprobante();
      this.ticketSeleccionado = null;
      this.ticketCobro = this.crearTicketCobro();
      await this.cargarTicketsPendientes();
    } catch (error) {
      console.error('Error procesando cobro:', error);
      const detalle =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : error && typeof error === 'object'
              ? JSON.stringify(error)
              : 'Error desconocido';
      this.mostrarNotificacion('error', 'Error', `No se pudo completar el cobro. ${detalle}`);
    } finally {
      this.pagoEnProceso = false;
      this.cdr.detectChanges();
    }
  }

  imprimirComprobante() {
    const recibo = this.reciboUltimoCobro;
    if (!recibo) {
      this.mostrarNotificacion('error', 'Error', 'No hay información para imprimir.');
      return;
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Comprobante ${recibo.codigoTicket}</title>
          <style>
            *{box-sizing:border-box}
            @page{size:58mm auto;margin:0}
            body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,sans-serif}
            .ticket{width:58mm;max-width:58mm;padding:6mm 4mm 4mm}
            .center{text-align:center}
            .brand{font-size:18px;font-weight:900;letter-spacing:1px}
            .company{font-size:11px;line-height:1.35;margin-top:4px}
            .title{font-size:13px;font-weight:700;margin:10px 0 8px;text-align:center;border-top:1px dashed #111;border-bottom:1px dashed #111;padding:6px 0}
            .line{display:flex;justify-content:space-between;gap:8px;font-size:11px;line-height:1.45;margin:2px 0}
            .line strong{max-width:60%;text-align:right;word-break:break-word}
            .divider{border-top:1px dashed #111;margin:8px 0}
            .total{font-size:14px;font-weight:900;text-align:right;margin-top:4px}
            .footer{font-size:10px;text-align:center;line-height:1.4;margin-top:8px}
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="center">
              <div class="brand">FUNBIDE</div>
              <div class="company">
                RNC: 430090387<br/>
                FUNBIDE20009@hotmail.com
              </div>
            </div>
            <div class="title">RECIBO DE PAGO</div>
            <div class="line"><span>Ticket</span><strong>${recibo.codigoTicket}</strong></div>
            <div class="line"><span>Fecha</span><strong>${new Date(recibo.fecha).toLocaleString('es-DO')}</strong></div>
            <div class="line"><span>Servicio</span><strong>${recibo.servicioNombre}</strong></div>
            <div class="line"><span>Pago</span><strong>${recibo.metodoPago.toUpperCase()}</strong></div>
            <div class="divider"></div>
            <div class="line"><span>Precio servicio</span><strong>RD$ ${recibo.montoBase.toFixed(2)}</strong></div>
            ${recibo.metodoPago === 'senasa' || recibo.metodoPago === 'renacer' ? `<div class="line"><span>Cobertura seguro</span><strong>RD$ ${recibo.montoCoberturaSeguro.toFixed(2)}</strong></div><div class="line"><span>Aporte fundación</span><strong>RD$ ${recibo.montoDiferenciaCliente.toFixed(2)}</strong></div>` : ''}
            ${recibo.aporteCliente !== null && recibo.aporteCliente !== undefined ? `<div class="line"><span>Aporte fundación</span><strong>RD$ ${recibo.aporteCliente.toFixed(2)}</strong></div><div class="line"><span>Saldo seguro</span><strong>RD$ ${(Math.max(recibo.montoBase - recibo.aporteCliente, 0)).toFixed(2)}</strong></div>` : ''}
            ${recibo.metodoPago === 'senasa' || recibo.metodoPago === 'renacer' ? '' : `<div class="line"><span>Recibido</span><strong>RD$ ${(recibo.montoRecibido ?? 0).toFixed(2)}</strong></div><div class="line"><span>Cambio</span><strong>RD$ ${recibo.cambio.toFixed(2)}</strong></div>`}
            <div class="line"><span>Total factura</span><strong>RD$ ${recibo.total.toFixed(2)}</strong></div>
            ${recibo.referenciaPago ? `<div class="line"><span>Referencia</span><strong>${recibo.referenciaPago}</strong></div>` : ''}
            <div class="total">PAGADO</div>
            <div class="footer">Gracias por preferir FUNBIDE.</div>
          </div>
        </body>
      </html>
    `;

    printHtmlInHiddenFrame(html);
  }

  enviarAlArea() {
    if (!this.ultimoCobroTicketCodigo) return;

    const area = this.areaDestinoMensaje || this.ticketSeleccionado?.areaDestino || 'Ã¡rea correspondiente';
    this.mostrarNotificacion('success', 'Paciente enviado', `El turno ${this.ultimoCobroTicketCodigo} fue enviado a ${area}.`);

    this.ultimoCobroTicketCodigo = '';
    this.ticketSeleccionado = null;
    this.areaDestinoMensaje = '';
    this.pasoActual = 1;
    this.mensajePacienteCobro = null;
    this.resetFlujo();
    this.cdr.detectChanges();
  }

  mostrarNotificacion(type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) {
    this.notificacion = { type, title, message };
    this.cdr.detectChanges();

    setTimeout(() => {
      this.notificacion = null;
      this.cdr.detectChanges();
    }, 4000);
  }
}

