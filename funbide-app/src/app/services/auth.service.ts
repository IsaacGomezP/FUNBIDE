import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface User {
  id: number;
  username: string;
  nombre_completo: string;
  rol: string;
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser: User | null = null;

  constructor(private supabase: SupabaseService) {}

  async login(username: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const { data: users, error } = await this.supabase.getClient()
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .eq('activo', true)
        .limit(1);

      if (error) throw error;

      if (!users || users.length === 0) {
        return { success: false, error: 'Usuario o contraseña incorrectos' };
      }

      const user = users[0];
      this.currentUser = {
        id: user.id,
        username: user.username,
        nombre_completo: user.nombre_completo,
        rol: user.rol,
        activo: user.activo
      };

      return { success: true, user: this.currentUser };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Error de conexión' };
    }
  }

  logout() {
    this.currentUser = null;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  hasRole(role: string): boolean {
    return this.currentUser?.rol === role;
  }
}
