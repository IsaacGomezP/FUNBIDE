import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase.config';

export interface User {
  id: number;
  username: string;
  email: string;
  nombre_completo: string;
  rol: string;
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log('✅ Supabase conectado');
  }

  getClient() {
    return this.supabase;
  }

  async invokeFunction<T = unknown>(functionName: string, payload: unknown): Promise<{ data: T | null; error: any }> {
    const { data, error } = await this.supabase.functions.invoke<T>(functionName, {
      body: payload as BodyInit,
    });

    return { data: data ?? null, error };
  }

  // Verificar conexión
  async testConnection() {
    try {
      const { data, error } = await this.supabase.from('usuarios').select('count');
      if (error) throw error;
      console.log('✅ Conexión exitosa a Supabase');
      return true;
    } catch (error) {
      console.error('❌ Error de conexión:', error);
      return false;
    }
  }

  // ========== LOGIN CON SUPABASE ==========
  async login(username: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
    console.log('🔵 SUPABASE: Buscando usuario:', username);
    
    try {
      // Buscar usuario por username
      const { data, error } = await this.supabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        console.error('Error en la consulta:', error);
        return { success: false, error: 'Error al conectar con la base de datos' };
      }

      if (!data) {
        console.log('Usuario no encontrado:', username);
        return { success: false, error: 'Usuario no encontrado' };
      }

      console.log('Usuario encontrado en Supabase:', data.username);

      // Verificar contraseña (comparación directa en texto plano)
      if (data.password !== password) {
        console.log('Contraseña incorrecta para usuario:', username);
        return { success: false, error: 'Contraseña incorrecta' };
      }

      if (!data.activo) {
        return { success: false, error: 'Usuario desactivado' };
      }

      // Login exitoso
      const user: User = {
        id: data.id,
        username: data.username,
        email: data.email,
        nombre_completo: data.nombre_completo,
        rol: data.rol,
        activo: data.activo
      };

      console.log('✅ Login exitoso con Supabase:', user.username);
      return { success: true, user };
    } catch (error: any) {
      console.error('Error en login:', error);
      return { success: false, error: error.message || 'Error de conexión' };
    }
  }
}
