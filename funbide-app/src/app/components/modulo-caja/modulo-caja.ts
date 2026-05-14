import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CobrosDbService } from '../../services/cobros-db.service';
import { ExpedientesMedicosDbService } from '../../services/expedientes-medicos-db.service';
import { ServicioPrecioDb, ServiciosPreciosDbService } from '../../services/servicios-precios-db.service';
import { SupabaseService } from '../../services/supabase.service';
import { TurnoDb, TurnosDbService } from '../../services/turnos-db.service';

type Paso = 1 | 2 | 3;
type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'senasa';

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
  metodoPago: MetodoPago;
  servicioCobroId: string | null;
  montoRecibido: number | null;
  referenciaPago: string;
  cambio: number;
  seguroNombre: string;
  seguroNumero: string;
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
  estado: 'pendiente' | 'parcial' | 'pagado' | 'anulado';
  fecha_vencimiento?: string | null;
  notas?: string | null;
}

interface Notificacion {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

interface ReciboCobro {
  codigoTicket: string;
  servicioNombre: string;
  total: number;
  metodoPago: MetodoPago;
  montoRecibido: number | null;
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
export class ModuloCajaComponent implements OnInit {
  @Output() back = new EventEmitter<void>();
  @Input() usuarioNombre = 'Cajero Principal';

  pasoActual: Paso = 1;
  ticketSeleccionado: TicketPendiente | null = null;
  ticketsPendientes: TicketPendiente[] = [];
  serviciosDisponibles: ServicioPrecioDb[] = [];
  busquedaServicio = '';

  totalPendientes = 0;
  totalPagadosHoy = 0;
  totalIngresosHoy = 0;
  totalCuentasSenasa = 0;
  totalIngresosNormalesHoy = 0;
  totalPendienteSenasaHoy = 0;

  pagoEnProceso = false;
  ultimoCobroTicketCodigo = '';
  notificacion: Notificacion | null = null;
  areaDestinoMensaje = '';
  mensajePacienteCobro: string | null = null;
  reciboUltimoCobro: ReciboCobro | null = null;

  ticketCobro: TicketCobro = this.crearTicketCobro();

  constructor(
    private turnosDbService: TurnosDbService,
    private serviciosPreciosDbService: ServiciosPreciosDbService,
    private cobrosDbService: CobrosDbService,
    private expedientesMedicosDbService: ExpedientesMedicosDbService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.resetFlujo();
    await this.cargarDatos();
  }

  private crearTicketCobro(): TicketCobro {
    return {
      metodoPago: 'efectivo',
      servicioCobroId: null,
      montoRecibido: null,
      referenciaPago: '',
      cambio: 0,
      seguroNombre: '',
      seguroNumero: ''
    };
  }

  private resetFlujo() {
    this.pasoActual = 1;
    this.ticketSeleccionado = null;
    this.ultimoCobroTicketCodigo = '';
    this.busquedaServicio = '';
    this.areaDestinoMensaje = '';
    this.mensajePacienteCobro = null;
    this.reciboUltimoCobro = null;
    this.ticketCobro = this.crearTicketCobro();
  }

  private async cargarDatos() {
    try {
      this.serviciosDisponibles = await this.serviciosPreciosDbService.listarActivos();
      await this.cargarTicketsPendientes();
      this.totalPagadosHoy = await this.contarCobrosHoy();
      this.totalIngresosNormalesHoy = await this.sumarCobrosNormalesHoy();
      this.totalCuentasSenasa = await this.contarCuentasSenasaHoy();
      this.totalPendienteSenasaHoy = await this.sumarPendienteSenasaHoy();
      this.totalIngresosHoy = this.totalIngresosNormalesHoy;
    } catch (error) {
      console.error('Error cargando caja:', error);
      this.mostrarNotificacion('error', 'Error', 'No se pudieron cargar los datos.');
    } finally {
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
      .select('monto_servicio, metodo_pago')
      .gte('created_at', inicio)
      .lt('created_at', fin)
      .neq('metodo_pago', 'senasa');

    if (error) throw error;
    return (data ?? []).reduce((acc: number, row: { monto_servicio: number }) => acc + Number(row.monto_servicio ?? 0), 0);
  }

  private async sumarPendienteSenasaHoy(): Promise<number> {
    const { inicio, fin } = this.obtenerRangoDia();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('cuentas_por_cobrar')
      .select('monto_pendiente')
      .eq('aseguradora', 'SENASA')
      .eq('estado', 'pendiente')
      .gte('created_at', inicio)
      .lt('created_at', fin);

    if (error) throw error;
    return (data ?? []).reduce((acc: number, row: { monto_pendiente: number }) => acc + Number(row.monto_pendiente ?? 0), 0);
  }

  private async contarCuentasSenasaHoy(): Promise<number> {
    const { inicio, fin } = this.obtenerRangoDia();
    const { count, error } = await this.supabaseService
      .getClient()
      .from('cuentas_por_cobrar')
      .select('id', { count: 'exact', head: true })
      .eq('aseguradora', 'SENASA')
      .gte('created_at', inicio)
      .lt('created_at', fin);

    if (error) throw error;
    return count ?? 0;
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

    return {
      ...turno,
      monto: servicio?.precio ?? 0,
      areaDestino: servicio?.area_destino ?? turno.categoria,
      servicioPrecioId: servicio?.id ?? null,
      servicioPrecioNombre: servicio?.nombre ?? turno.servicio_nombre,
      pacienteNombre: turno.paciente_nombre,
      pacienteCedula: turno.paciente_cedula,
      servicioNombre: turno.servicio_nombre
    };
  }

  private async crearCuentaSenasa(cuenta: CuentaPorCobrarDb) {
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

  get totalCobroActual(): number {
    const servicio = this.serviciosDisponibles.find((item) => item.id === this.ticketCobro.servicioCobroId);
    return servicio?.precio ?? this.ticketSeleccionado?.monto ?? 0;
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
    this.pasoActual = 2;
    this.notificacion = null;
    this.cdr.detectChanges();
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
    this.calcularCambio();
    const servicio = this.serviciosDisponibles.find((item) => item.id === this.ticketCobro.servicioCobroId);
    if (servicio) {
      this.areaDestinoMensaje = servicio.area_destino;
    }
    this.cdr.detectChanges();
  }

  onBusquedaServicioChange() {
    this.cdr.detectChanges();
  }

  calcularCambio() {
    const montoRecibido = this.ticketCobro.montoRecibido ?? 0;
    this.ticketCobro.cambio = Math.max(montoRecibido - this.totalCobroActual, 0);
  }

  async procesarCobro() {
    if (!this.ticketSeleccionado) {
      this.mostrarNotificacion('error', 'Seleccione un ticket', 'Debe elegir un ticket pendiente.');
      return;
    }

    const total = this.totalCobroActual;
    if (!total || total <= 0) {
      this.mostrarNotificacion('error', 'Servicio requerido', 'Debe seleccionar un servicio con precio.');
      return;
    }

    if (this.ticketCobro.metodoPago === 'efectivo' && (!this.ticketCobro.montoRecibido || this.ticketCobro.montoRecibido < total)) {
      this.mostrarNotificacion('error', 'Monto insuficiente', 'El efectivo ingresado es menor al total.');
      return;
    }

    if (this.ticketCobro.metodoPago === 'transferencia' && !this.ticketCobro.referenciaPago.trim()) {
      this.mostrarNotificacion('error', 'Referencia requerida', 'Ingrese la referencia de la transferencia.');
      return;
    }

    if (this.ticketCobro.metodoPago === 'senasa' && !this.ticketCobro.seguroNumero.trim()) {
      this.mostrarNotificacion('error', 'Seguro requerido', 'Ingrese el nÃºmero de afiliaciÃ³n del seguro.');
      return;
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
      const areaDestino = servicio?.area_destino || this.ticketSeleccionado.areaDestino || 'Ãrea correspondiente';

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
        metodo_pago: this.ticketCobro.metodoPago,
        monto_recibido: this.ticketCobro.metodoPago === 'efectivo' ? this.ticketCobro.montoRecibido : null,
        cambio: this.ticketCobro.metodoPago === 'efectivo' ? this.ticketCobro.cambio : null,
        referencia_pago: this.ticketCobro.referenciaPago || null,
        seguro_nombre: this.ticketCobro.metodoPago === 'senasa' ? (this.ticketCobro.seguroNombre || 'SENASA') : null,
        seguro_numero: this.ticketCobro.metodoPago === 'senasa' ? this.ticketCobro.seguroNumero : null,
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

      if (this.ticketCobro.metodoPago === 'senasa') {
        await this.crearCuentaSenasa({
          turno_id: this.ticketSeleccionado.id,
          cobro_id: cobro.id,
          codigo_ticket: this.ticketSeleccionado.codigo,
          paciente_nombre: this.ticketSeleccionado.pacienteNombre,
          paciente_cedula: this.ticketSeleccionado.pacienteCedula,
          servicio_nombre: servicio?.nombre ?? this.ticketSeleccionado.servicioNombre,
          servicio_id: servicio?.id ?? this.ticketCobro.servicioCobroId,
          aseguradora: this.ticketCobro.seguroNombre?.trim() || 'SENASA',
          monto_total: total,
          monto_pagado_paciente: 0,
          monto_pendiente: total,
          estado: 'pendiente',
          fecha_vencimiento: null,
          notas: 'Cuenta por cobrar generada desde caja por cobertura SENASA'
        });
      } else {
        this.totalIngresosNormalesHoy += total;
      }

      this.totalIngresosHoy = this.totalIngresosNormalesHoy;
      this.totalPendienteSenasaHoy = this.ticketCobro.metodoPago === 'senasa'
        ? this.totalPendienteSenasaHoy + total
        : this.totalPendienteSenasaHoy;

      this.totalPagadosHoy += 1;
      this.ultimoCobroTicketCodigo = this.ticketSeleccionado.codigo;
      this.reciboUltimoCobro = {
        codigoTicket: this.ticketSeleccionado.codigo,
        servicioNombre: servicio?.nombre ?? this.ticketSeleccionado.servicioNombre,
        total,
        metodoPago: this.ticketCobro.metodoPago,
        montoRecibido: this.ticketCobro.metodoPago === 'efectivo' ? this.ticketCobro.montoRecibido : null,
        cambio: this.ticketCobro.metodoPago === 'efectivo' ? this.ticketCobro.cambio : 0,
        referenciaPago: this.ticketCobro.referenciaPago,
        fecha: new Date().toISOString()
      };

      const textoPago =
        this.ticketCobro.metodoPago === 'senasa'
          ? `Turno ${this.ticketSeleccionado.codigo} registrado con SENASA. Queda pendiente por cobrar a la aseguradora.`
          : `Turno ${this.ticketSeleccionado.codigo} pagado. DirÃ­jase a ${areaDestino} para continuar con su atenciÃ³n.`;

      this.mostrarNotificacion('success', 'Pago exitoso', textoPago);

      this.mensajePacienteCobro =
        this.ticketCobro.metodoPago === 'senasa'
          ? `PAGO COMPLETADO\n\nTurno: ${this.ticketSeleccionado.codigo}\nMonto: RD$ ${total.toFixed(
              2
            )}\n\nSENASA: cuenta registrada como pendiente de cobro a la aseguradora.`
          : `PAGO COMPLETADO\n\nTurno: ${this.ticketSeleccionado.codigo}\nMonto: RD$ ${total.toFixed(
              2
            )}\n\nINDICACIÃ“N PARA EL PACIENTE:\nDirÃ­jase a ${areaDestino} para continuar con su atenciÃ³n.`;

      this.pasoActual = 3;
      this.imprimirComprobante();
      this.ticketSeleccionado = null;
      this.ticketCobro = this.crearTicketCobro();
      await this.cargarTicketsPendientes();
    } catch (error) {
      console.error('Error procesando cobro:', error);
      this.mostrarNotificacion('error', 'Error', 'No se pudo completar el cobro.');
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
            <div class="line"><span>Precio servicio</span><strong>RD$ ${recibo.total.toFixed(2)}</strong></div>
            ${recibo.metodoPago === 'efectivo' ? `<div class="line"><span>Recibido</span><strong>RD$ ${(recibo.montoRecibido ?? 0).toFixed(2)}</strong></div><div class="line"><span>Cambio</span><strong>RD$ ${recibo.cambio.toFixed(2)}</strong></div>` : ''}
            ${recibo.metodoPago === 'transferencia' ? `<div class="line"><span>Referencia</span><strong>${recibo.referenciaPago || '-'}</strong></div>` : ''}
            <div class="total">PAGADO</div>
            <div class="footer">Gracias por preferir FUNBIDE.</div>
          </div>
          <script>window.print();setTimeout(()=>window.close(),400);</script>
        </body>
      </html>
    `;

    const ventana = window.open('', '_blank');
    if (ventana) {
      ventana.document.write(html);
      ventana.document.close();
    }
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

  mostrarNotificacion(type: 'success' | 'error' | 'info', title: string, message: string) {
    this.notificacion = { type, title, message };
    this.cdr.detectChanges();

    setTimeout(() => {
      this.notificacion = null;
      this.cdr.detectChanges();
    }, 4000);
  }
}

