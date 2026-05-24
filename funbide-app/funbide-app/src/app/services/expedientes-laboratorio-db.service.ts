import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ExpedienteLaboratorioDb {
  id: string;
  turno_id: string;
  cobro_id?: string | null;
  paciente_nombre: string;
  paciente_cedula: string;
  paciente_edad?: number | null;
  paciente_telefono?: string | null;
  servicio_nombre: string;
  servicio_id?: string | null;
  area_destino: string;
  motivo?: string | null;
  observaciones?: string | null;
  resultado_general?: string | null;
  conclusion?: string | null;
  correo_envio?: string | null;
  whatsapp_envio?: string | null;
  estado: 'pendiente' | 'en_proceso' | 'completado' | 'enviado' | 'cerrado';
  enviado_por?: string | null;
  completado_por?: string | null;
  fecha_enviado?: string | null;
  fecha_completado?: string | null;
  archivo_pdf_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ResultadoLaboratorioDb {
  id: string;
  expediente_id: string;
  analisis: string;
  valor?: string | null;
  unidad?: string | null;
  rango_referencia?: string | null;
  observacion?: string | null;
  orden: number;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExpedientesLaboratorioDbService {
  constructor(private supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async listarPendientes() {
    const { data, error } = await this.client
      .from('expedientes_laboratorio')
      .select('*')
      .in('estado', ['pendiente', 'en_proceso'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as ExpedienteLaboratorioDb[];
  }

  async buscarPorTurnoId(turnoId: string) {
    const { data, error } = await this.client
      .from('expedientes_laboratorio')
      .select('*')
      .eq('turno_id', turnoId)
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as ExpedienteLaboratorioDb | null;
  }

  async crearExpediente(payload: Omit<ExpedienteLaboratorioDb, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.client
      .from('expedientes_laboratorio')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as ExpedienteLaboratorioDb;
  }

  async actualizarExpediente(
    id: string,
    cambios: Partial<Omit<ExpedienteLaboratorioDb, 'id' | 'created_at' | 'updated_at'>>
  ) {
    const { data, error } = await this.client
      .from('expedientes_laboratorio')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ExpedienteLaboratorioDb;
  }

  async listarResultados(expedienteId: string) {
    const { data, error } = await this.client
      .from('resultados_laboratorio')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('orden', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ResultadoLaboratorioDb[];
  }

  async agregarResultado(payload: Omit<ResultadoLaboratorioDb, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.client
      .from('resultados_laboratorio')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as ResultadoLaboratorioDb;
  }

  async listarArchivos(expedienteId: string) {
    const { data, error } = await this.client
      .from('archivos_laboratorio')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }
}
