import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ProductoDb {
  id: string;
  nombre: string;
  categoria: string | null;
  laboratorio: string | null;
  precio: number;
  stock: number;
  stock_minimo: number;
  unidad: string;
  codigo_barras: string;
  fecha_vencimiento: string | null;
  imagen_base64: string | null;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class FarmaciaDbService {
  constructor(private supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async listarProductos(): Promise<ProductoDb[]> {
    const { data, error } = await this.client
      .from('productos_farmacia')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async crearProducto(producto: Omit<ProductoDb, 'id' | 'created_at'>) {
    const { data, error } = await this.client
      .from('productos_farmacia')
      .insert(producto)
      .select()
      .single();

    if (error) throw error;
    return data as ProductoDb;
  }

  async actualizarProducto(id: string, cambios: Partial<Omit<ProductoDb, 'id' | 'created_at'>>) {
    const { data, error } = await this.client
      .from('productos_farmacia')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ProductoDb;
  }

  async eliminarProducto(id: string) {
    const { error } = await this.client
      .from('productos_farmacia')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
