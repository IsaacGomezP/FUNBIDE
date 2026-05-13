import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface CobroDb {
  id: string;
  turno_id: string;
  codigo_ticket: string;
  paciente_nombre: string;
  paciente_cedula: string;
  servicio_nombre: string;
  servicio_id?: string | null;
  monto_servicio: number;
  metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'senasa';
  monto_recibido?: number | null;
  cambio?: number | null;
  referencia_pago?: string | null;
  seguro_nombre?: string | null;
  seguro_numero?: string | null;
  area_destino: string;
  estado: 'pendiente' | 'pagado' | 'rechazado';
  cajero: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CobrosDbService {
  constructor(private supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async crearCobro(cobro: Omit<CobroDb, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.client
      .from('cobros')
      .insert(cobro)
      .select()
      .single();

    if (error) throw error;
    return data as CobroDb;
  }

  async buscarPorTurnoId(turnoId: string): Promise<CobroDb | null> {
    const { data, error } = await this.client
      .from('cobros')
      .select('*')
      .eq('turno_id', turnoId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as CobroDb | null;
  }
}
