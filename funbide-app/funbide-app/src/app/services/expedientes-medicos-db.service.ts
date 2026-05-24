import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ExpedienteMedicoDb {
  id: string;
  turno_id: string;
  cobro_id?: string | null;
  paciente_id?: string | null;
  paciente_nombre: string;
  paciente_cedula: string;
  paciente_telefono?: string | null;
  paciente_correo?: string | null;
  servicio_nombre: string;
  area_destino: string;
  motivo_consulta?: string | null;
  antecedentes?: string | null;
  examen_fisico?: string | null;
  diagnostico?: string | null;
  tratamiento?: string | null;
  indicaciones?: string | null;
  conclusion?: string | null;
  requiere_receta: boolean;
  estado: 'borrador' | 'en_proceso' | 'completado' | 'enviado' | 'archivado';
  medico_nombre?: string | null;
  medico_rol?: string | null;
  fecha_atencion?: string | null;
  fecha_cierre?: string | null;
  correo_envio?: string | null;
  whatsapp_envio?: string | null;
  archivo_pdf_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RecetaMedicaDb {
  id: string;
  expediente_id: string;
  medicamento: string;
  dosis?: string | null;
  frecuencia?: string | null;
  duracion?: string | null;
  instrucciones?: string | null;
  orden: number;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExpedientesMedicosDbService {
  constructor(private supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async listarPendientes(areaDestino?: string) {
    let query = this.client
      .from('expedientes_medicos')
      .select('*')
      .in('estado', ['borrador', 'en_proceso'])
      .order('created_at', { ascending: false });

    if (areaDestino) {
      query = query.eq('area_destino', areaDestino);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ExpedienteMedicoDb[];
  }

  async listarBandejaMedica(areaDestino?: string) {
    let query = this.client
      .from('expedientes_medicos')
      .select('*')
      .in('estado', ['borrador', 'en_proceso', 'completado', 'enviado'])
      .order('created_at', { ascending: false });

    if (areaDestino) {
      query = query.eq('area_destino', areaDestino);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ExpedienteMedicoDb[];
  }

  async buscarPorTurnoId(turnoId: string) {
    const { data, error } = await this.client
      .from('expedientes_medicos')
      .select('*')
      .eq('turno_id', turnoId)
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as ExpedienteMedicoDb | null;
  }

  async buscarPorCedula(cedula: string) {
    const { data, error } = await this.client
      .from('expedientes_medicos')
      .select('*')
      .ilike('paciente_cedula', cedula.trim())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as ExpedienteMedicoDb[];
  }

  async crearExpediente(payload: Omit<ExpedienteMedicoDb, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.client
      .from('expedientes_medicos')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as ExpedienteMedicoDb;
  }

  async actualizarExpediente(
    id: string,
    cambios: Partial<Omit<ExpedienteMedicoDb, 'id' | 'created_at' | 'updated_at'>>
  ) {
    const { data, error } = await this.client
      .from('expedientes_medicos')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ExpedienteMedicoDb;
  }

  async listarRecetas(expedienteId: string) {
    const { data, error } = await this.client
      .from('recetas_medicas')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('orden', { ascending: true });

    if (error) throw error;
    return (data ?? []) as RecetaMedicaDb[];
  }

  async agregarReceta(
    payload: Omit<RecetaMedicaDb, 'id' | 'created_at' | 'updated_at'>
  ) {
    const { data, error } = await this.client
      .from('recetas_medicas')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as RecetaMedicaDb;
  }

  async listarArchivos(expedienteId: string) {
    const { data, error } = await this.client
      .from('archivos_expedientes')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }
}
