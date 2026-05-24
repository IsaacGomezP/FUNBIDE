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
  total_pendiente_senasa: number;
  jornada_cerrada: boolean;
  hora_cierre?: string | null;
  observaciones?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CuadreCajaResumen {
  fecha: string;
  total_turnos: number;
  total_cobros: number;
  total_efectivo: number;
  total_tarjeta: number;
  total_transferencia: number;
  total_senasa: number;
  total_pendiente_senasa: number;
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
        .select('monto_servicio,metodo_pago')
        .gte('created_at', inicio)
        .lt('created_at', fin),
      this.client
        .from('cuentas_por_cobrar')
        .select('monto_pendiente,estado')
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

    const efectivo = cobros.filter(item => item.metodo_pago === 'efectivo');
    const tarjeta = cobros.filter(item => item.metodo_pago === 'tarjeta');
    const transferencia = cobros.filter(item => item.metodo_pago === 'transferencia');
    const senasa = cobros.filter(item => item.metodo_pago === 'senasa');

    return {
      fecha: fechaClave,
      total_turnos: turnos.length,
      total_cobros: cobros.length,
      total_efectivo: this.sumarMonto(efectivo, 'monto_servicio'),
      total_tarjeta: this.sumarMonto(tarjeta, 'monto_servicio'),
      total_transferencia: this.sumarMonto(transferencia, 'monto_servicio'),
      total_senasa: this.sumarMonto(senasa, 'monto_servicio'),
      total_pendiente_senasa: this.sumarMonto(pendientes, 'monto_pendiente'),
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
      total_pendiente_senasa: resumen.total_pendiente_senasa,
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
}
