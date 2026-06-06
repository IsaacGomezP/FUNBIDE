import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ServicioPrecioDb {
  id: string;
  codigo: string;
  nombre: string;
  area_destino: string;
  categoria: string;
  precio: number;
  precio_subsidiado?: number | null;
  precio_contributivo?: number | null;
  precio_renacer?: number | null;
  monto_ganancia_interna?: number | null;
  requiere_aporte_efectivo?: boolean;
  monto_aporte_efectivo?: number | null;
  aplica_seguro?: boolean;
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

  async listarTodos(): Promise<ServicioPrecioDb[]> {
    const { data, error } = await this.client
      .from('servicios_precios')
      .select('*')
      .order('activo', { ascending: false })
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ServicioPrecioDb[];
  }

  async crear(servicio: Omit<ServicioPrecioDb, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.client
      .from('servicios_precios')
      .insert(servicio)
      .select()
      .single();

    if (error) throw error;
    return data as ServicioPrecioDb;
  }

  async actualizar(id: string, cambios: Partial<Omit<ServicioPrecioDb, 'id' | 'created_at' | 'updated_at'>>) {
    const { data, error } = await this.client
      .from('servicios_precios')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ServicioPrecioDb;
  }

  async sincronizarCatalogo(servicios: Omit<ServicioPrecioDb, 'id' | 'created_at' | 'updated_at'>[]) {
    if (servicios.length === 0) return [];

    const { data, error } = await this.client
      .from('servicios_precios')
      .upsert(servicios, { onConflict: 'codigo' })
      .select();

    if (error) throw error;
    return (data ?? []) as ServicioPrecioDb[];
  }

  async activar(id: string) {
    return this.actualizar(id, { activo: true });
  }

  async inactivar(id: string) {
    return this.actualizar(id, { activo: false });
  }

  async eliminar(id: string) {
    const { error } = await this.client
      .from('servicios_precios')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
