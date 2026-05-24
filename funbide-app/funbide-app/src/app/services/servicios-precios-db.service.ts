import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ServicioPrecioDb {
  id: string;
  codigo: string;
  nombre: string;
  area_destino: string;
  categoria: string;
  precio: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ServiciosPreciosDbService {
  constructor(private supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async listarActivos(): Promise<ServicioPrecioDb[]> {
    const { data, error } = await this.client
      .from('servicios_precios')
      .select('*')
      .eq('activo', true)
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ServicioPrecioDb[];
  }
}
