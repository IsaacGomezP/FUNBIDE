import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface PacienteDb {
  id: string;
  cedula: string;
  nombre: string;
  edad: number;
  telefono?: string | null;
  correo?: string | null;
  fechaNacimiento?: string | null;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PacientesDbService {
  constructor(private supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async buscarPorCedula(cedula: string): Promise<PacienteDb | null> {
    const cedulaNormalizada = cedula.trim().replace(/\s+/g, '');

    const { data, error } = await this.client
      .from('pacientes')
      .select('cedula, nombre, edad, telefono, correo, fecha_nacimiento, created_at')
      .eq('cedula', cedulaNormalizada)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: '',
      cedula: data.cedula,
      nombre: data.nombre,
      edad: Number(data.edad),
      telefono: data.telefono ?? null,
      correo: data.correo ?? null,
      fechaNacimiento: data.fecha_nacimiento ?? null,
      created_at: data.created_at
    };
  }

  async guardarPaciente(paciente: Omit<PacienteDb, 'id' | 'created_at' | 'updated_at'>) {
    const payload = {
      cedula: paciente.cedula,
      nombre: paciente.nombre,
      edad: paciente.edad,
      telefono: paciente.telefono ?? null,
      correo: paciente.correo ?? null,
      fecha_nacimiento: paciente.fechaNacimiento ?? null
    };

    const { data, error } = await this.client
      .from('pacientes')
      .upsert(payload, { onConflict: 'cedula' })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      cedula: data.cedula,
      nombre: data.nombre,
      edad: Number(data.edad),
      telefono: data.telefono ?? null,
      correo: data.correo ?? null,
      fechaNacimiento: data.fecha_nacimiento ?? null,
      created_at: data.created_at,
      updated_at: data.updated_at
    } as PacienteDb;
  }
}
