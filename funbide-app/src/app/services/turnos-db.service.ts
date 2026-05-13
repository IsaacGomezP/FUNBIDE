import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface TurnoDb {
  id: string;
  codigo: string;
  prefijo: string;
  numero: number;
  servicio_id: string;
  servicio_nombre: string;
  categoria: string;
  paciente_cedula: string;
  paciente_nombre: string;
  paciente_edad: number;
  paciente_fecha_nacimiento?: string | null;
  estado: 'espera' | 'llamando' | 'atendiendo' | 'finalizado' | 'cancelado';
  puesto_atencion: string | null;
  fecha_creado: string;
  fecha_llamado: string | null;
  fecha_atencion: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class TurnosDbService {
  constructor(private supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async obtenerUltimoNumero(prefijo: string): Promise<number> {
    const { data, error } = await this.client
      .from('turnos')
      .select('numero')
      .eq('prefijo', prefijo)
      .order('numero', { ascending: false })
      .limit(1);

    if (error) throw error;
    return (data?.[0]?.numero ?? 0) + 1;
  }

  async crearTurno(turno: Omit<TurnoDb, 'id' | 'fecha_creado' | 'fecha_llamado' | 'fecha_atencion'>) {
    const payload = {
      ...turno,
      estado: turno.estado || 'espera'
    };

    const { data, error } = await this.client
      .from('turnos')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as TurnoDb;
  }

  async listarTurnosActivos() {
    const { data, error } = await this.client
      .from('turnos')
      .select('*')
      .in('estado', ['llamando', 'atendiendo'])
      .order('fecha_creado', { ascending: true });

    if (error) throw error;
    return (data ?? []) as TurnoDb[];
  }

  async listarTurnosEspera() {
    const { data, error } = await this.client
      .from('turnos')
      .select('*')
      .eq('estado', 'espera')
      .order('fecha_creado', { ascending: true });

    if (error) throw error;
    return (data ?? []) as TurnoDb[];
  }

  async listarTurnosDelDia(fechaIso: string) {
    const inicio = `${fechaIso}T00:00:00.000Z`;
    const fin = `${fechaIso}T23:59:59.999Z`;

    const { data, error } = await this.client
      .from('turnos')
      .select('*')
      .gte('fecha_creado', inicio)
      .lte('fecha_creado', fin)
      .order('fecha_creado', { ascending: false });

    if (error) throw error;
    return (data ?? []) as TurnoDb[];
  }

  async actualizarTurnoEstado(
    id: string,
    cambios: Partial<Pick<TurnoDb, 'estado' | 'puesto_atencion' | 'fecha_llamado' | 'fecha_atencion'>>
  ) {
    const { data, error } = await this.client
      .from('turnos')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as TurnoDb;
  }
}
