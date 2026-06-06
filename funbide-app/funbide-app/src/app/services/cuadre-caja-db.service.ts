import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface CuadreCajaDb {
  id?: string;
  fecha: string;
  total_turnos: number;
  total_cobros: number;
  total_efectivo: number;
  total_tarjeta: number;
  total_transferencia: number;
  total_senasa: number;
  total_senasa_subsidiado: number;
  total_senasa_contributivo: number;
  total_renacer: number;
  total_aporte_cliente: number;
  total_ganancia_interna: number;
  total_ingresos_visibles?: number;
  total_ingresos_reales?: number;
  total_pendiente_senasa: number;
  total_pendiente_renacer: number;
  jornada_cerrada: boolean;
  hora_cierre?: string | null;
  observaciones?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CuadreCajaHistorico extends CuadreCajaDb {
  total_ingresos: number;
  estado_texto: string;
}

export interface CuadreCajaResumen {
  fecha: string;
  total_turnos: number;
  total_cobros: number;
  total_efectivo: number;
  total_tarjeta: number;
  total_transferencia: number;
  total_senasa: number;
  total_senasa_subsidiado: number;
  total_senasa_contributivo: number;
  total_renacer: number;
  total_aporte_cliente: number;
  total_ganancia_interna: number;
  total_ingresos_visibles: number;
  total_ingresos_reales: number;
  total_pendiente_senasa: number;
  total_pendiente_renacer: number;
  jornada_cerrada: boolean;
  hora_cierre: string | null;
  observaciones: string | null;
  turnos_espera: number;
  turnos_llamando: number;
  turnos_atendiendo: number;
  turnos_finalizados: number;
}

@Injectable({
  providedIn: 'root'
})
export class CuadreCajaDbService {
  constructor(private supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  private obtenerRangoDia(fecha = new Date()) {
    const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0, 0);
    const fin = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1, 0, 0, 0, 0);

    return {
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      fechaClave: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
    };
  }

  private sumarMonto<T extends Record<string, any>>(rows: T[], campo: keyof T) {
    return rows.reduce((acc, row) => acc + Number(row[campo] ?? 0), 0);
  }

  private calcularIngresoVisible(rows: Array<Record<string, any>>) {
    return this.sumarMonto(rows, 'monto_servicio' as keyof Record<string, any>);
  }

  private obtenerDetallesPago(row: Record<string, any>): Array<{ metodo?: string; monto?: number }> {
    const detalle = row?.['detalle_pagos'];
    if (Array.isArray(detalle)) return detalle as Array<{ metodo?: string; monto?: number }>;

    if (typeof detalle === 'string') {
      try {
        const parsed = JSON.parse(detalle);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  }

  private obtenerDetalleCobroNormalizado(row: Record<string, any>): Array<{ metodo?: string; monto?: number }> {
    const detalles = this.obtenerDetallesPago(row);
    if (detalles.length > 0) return detalles;

    const metodo = String(row?.['metodo_pago'] ?? '').toLowerCase();
    if (metodo === 'efectivo' || metodo === 'tarjeta' || metodo === 'transferencia') {
      return [{ metodo, monto: Number(row?.['monto_servicio'] ?? 0) }];
    }

    return [];
  }

  private normalizarSeguroNombre(valor: string | null | undefined): string {
    const texto = String(valor ?? '').trim().toUpperCase();
    if (!texto) return '';

    if (texto.includes('RENACER')) return 'ARS RENACER';
    if (texto.includes('SENASA') && texto.includes('CONTRIBUTIVO')) return 'SENASA CONTRIBUTIVO';
    if (texto.includes('SENASA') && texto.includes('SUBSIDIADO')) return 'SENASA SUBSIDIADO';
    if (texto === 'SENASA') return 'SENASA';
    return texto;
  }

  private esSeguroSenasa(valor: string | null | undefined): boolean {
    return this.normalizarSeguroNombre(valor).includes('SENASA');
  }

  private esSeguroRenacer(valor: string | null | undefined): boolean {
    return this.normalizarSeguroNombre(valor) === 'ARS RENACER';
  }

  async obtenerCuadrePorFecha(fecha = new Date()): Promise<CuadreCajaDb | null> {
    const { fechaClave } = this.obtenerRangoDia(fecha);
    const { data, error } = await this.client
      .from('cuadres_caja')
      .select('*')
      .eq('fecha', fechaClave)
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as CuadreCajaDb | null;
  }

  async obtenerResumenDia(fecha = new Date()): Promise<CuadreCajaResumen> {
    const { inicio, fin, fechaClave } = this.obtenerRangoDia(fecha);

    const [turnosRes, cobrosRes, pendientesRes, cuadreRes] = await Promise.all([
      this.client
        .from('turnos')
        .select('id,estado')
        .gte('fecha_creado', inicio)
        .lt('fecha_creado', fin),
      this.client
        .from('cobros')
        .select('monto_servicio,monto_ganancia_interna,metodo_pago,seguro_nombre,monto_aporte_cliente,detalle_pagos')
        .gte('created_at', inicio)
        .lt('created_at', fin),
      this.client
        .from('cuentas_por_cobrar')
        .select('monto_pendiente,estado,aseguradora')
        .gte('created_at', inicio)
        .lt('created_at', fin)
        .eq('estado', 'pendiente'),
      this.client
        .from('cuadres_caja')
        .select('*')
        .eq('fecha', fechaClave)
        .maybeSingle()
    ]);

    if (turnosRes.error) throw turnosRes.error;
    if (cobrosRes.error) throw cobrosRes.error;
    if (pendientesRes.error) throw pendientesRes.error;
    if (cuadreRes.error) throw cuadreRes.error;

    const turnos = turnosRes.data ?? [];
    const cobros = cobrosRes.data ?? [];
    const pendientes = pendientesRes.data ?? [];
    const cuadre = cuadreRes.data ?? null;

    const efectivo = cobros
      .flatMap(item => this.obtenerDetalleCobroNormalizado(item))
      .filter(pago => pago.metodo === 'efectivo');
    const tarjeta = cobros
      .flatMap(item => this.obtenerDetalleCobroNormalizado(item))
      .filter(pago => pago.metodo === 'tarjeta');
    const transferencia = cobros
      .flatMap(item => this.obtenerDetalleCobroNormalizado(item))
      .filter(pago => pago.metodo === 'transferencia');
    const senasaSubsidiado = cobros.filter(item => this.normalizarSeguroNombre(item.seguro_nombre) === 'SENASA SUBSIDIADO');
    const senasaContributivo = cobros.filter(item => this.normalizarSeguroNombre(item.seguro_nombre) === 'SENASA CONTRIBUTIVO');
    const senasa = cobros.filter(item => item.metodo_pago === 'senasa' || this.normalizarSeguroNombre(item.seguro_nombre).includes('SENASA'));
    const renacer = cobros.filter(item => this.esSeguroRenacer(item.seguro_nombre) || item.metodo_pago === 'renacer');
    const aporteCliente = cobros
      .filter(item => item.metodo_pago === 'senasa' || item.metodo_pago === 'renacer')
      .reduce((acc, item) => acc + Number(item.monto_aporte_cliente ?? 0), 0);
    const gananciaInterna = this.sumarMonto(cobros, 'monto_ganancia_interna');
    const ingresosVisibles = this.calcularIngresoVisible(cobros);
    const pendientesSenasa = pendientes.filter(item => this.esSeguroSenasa(item.aseguradora));
    const pendientesRenacer = pendientes.filter(item => this.esSeguroRenacer(item.aseguradora));

    return {
      fecha: fechaClave,
      total_turnos: turnos.length,
      total_cobros: cobros.length,
      total_efectivo: this.sumarMonto(efectivo, 'monto'),
      total_tarjeta: this.sumarMonto(tarjeta, 'monto'),
      total_transferencia: this.sumarMonto(transferencia, 'monto'),
      total_senasa: this.sumarMonto(senasa, 'monto_servicio'),
      total_senasa_subsidiado: this.sumarMonto(senasaSubsidiado, 'monto_servicio'),
      total_senasa_contributivo: this.sumarMonto(senasaContributivo, 'monto_servicio'),
      total_renacer: this.sumarMonto(renacer, 'monto_servicio'),
      total_aporte_cliente: aporteCliente,
      total_ganancia_interna: gananciaInterna,
      total_ingresos_visibles: ingresosVisibles,
      total_ingresos_reales: ingresosVisibles + gananciaInterna,
      total_pendiente_senasa: this.sumarMonto(pendientesSenasa, 'monto_pendiente'),
      total_pendiente_renacer: this.sumarMonto(pendientesRenacer, 'monto_pendiente'),
      jornada_cerrada: !!cuadre?.jornada_cerrada,
      hora_cierre: cuadre?.hora_cierre ?? null,
      observaciones: cuadre?.observaciones ?? null,
      turnos_espera: turnos.filter(item => item.estado === 'espera').length,
      turnos_llamando: turnos.filter(item => item.estado === 'llamando').length,
      turnos_atendiendo: turnos.filter(item => item.estado === 'atendiendo').length,
      turnos_finalizados: turnos.filter(item => item.estado === 'finalizado').length
    };
  }

  async cerrarCuadre(fecha = new Date(), observaciones = ''): Promise<CuadreCajaDb> {
    const resumen = await this.obtenerResumenDia(fecha);
    const horaCierre = new Date().toISOString();
    const payload: CuadreCajaDb = {
      fecha: resumen.fecha,
      total_turnos: resumen.total_turnos,
      total_cobros: resumen.total_cobros,
      total_efectivo: resumen.total_efectivo,
      total_tarjeta: resumen.total_tarjeta,
      total_transferencia: resumen.total_transferencia,
      total_senasa: resumen.total_senasa,
      total_senasa_subsidiado: resumen.total_senasa_subsidiado,
      total_senasa_contributivo: resumen.total_senasa_contributivo,
      total_renacer: resumen.total_renacer,
      total_aporte_cliente: resumen.total_aporte_cliente,
      total_ganancia_interna: resumen.total_ganancia_interna,
      total_ingresos_visibles: resumen.total_ingresos_visibles,
      total_ingresos_reales: resumen.total_ingresos_reales,
      total_pendiente_senasa: resumen.total_pendiente_senasa,
      total_pendiente_renacer: resumen.total_pendiente_renacer,
      jornada_cerrada: true,
      hora_cierre: horaCierre,
      observaciones: observaciones.trim() || 'Cierre automático de jornada'
    };

    const { data, error } = await this.client
      .from('cuadres_caja')
      .upsert(payload, { onConflict: 'fecha' })
      .select()
      .single();

    if (error) throw error;
    return data as CuadreCajaDb;
  }

  async jornadaCerradaHoy(fecha = new Date()): Promise<boolean> {
    const cuadre = await this.obtenerCuadrePorFecha(fecha);
    return !!cuadre?.jornada_cerrada;
  }

  async listarHistorial(limit = 30): Promise<CuadreCajaHistorico[]> {
    const { data, error } = await this.client
      .from('cuadres_caja')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map((item) => ({
      ...item,
      total_ingresos:
        Number(item.total_ingresos_reales ?? 0) ||
        Number(item.total_efectivo ?? 0) +
        Number(item.total_tarjeta ?? 0) +
        Number(item.total_transferencia ?? 0) +
        Number(item.total_senasa ?? 0) +
        Number(item.total_renacer ?? 0) +
        Number(item.total_ganancia_interna ?? 0),
      estado_texto: item.jornada_cerrada ? 'Cerrada' : 'Abierta'
    })) as CuadreCajaHistorico[];
  }
}
