import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService, User } from '../../services/supabase.service';

type UsuarioForm = {
  id?: number;
  username: string;
  email: string;
  password: string;
  nombre_completo: string;
  rol: string;
  activo: boolean;
};

@Component({
  selector: 'app-modulo-mantenimiento',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modulo-mantenimiento.html',
  styleUrls: ['./modulo-mantenimiento.css']
})
export class ModuloMantenimientoComponent implements OnInit {
  @Input() usuarioNombre = '';
  @Input() usuarioRol = '';
  @Output() back = new EventEmitter<void>();

  loading = true;
  guardando = false;
  toast = '';
  toastType: 'success' | 'danger' | 'info' | 'warning' = 'info';
  usuarios: User[] = [];
  filtro = '';
  modoEdicion = false;

  usuarioForm: UsuarioForm = this.formularioInicial();

  rolesDisponibles = [
    'Administrador',
    'Cajero',
    'Farmacia',
    'Medico',
    'Medicina General',
    'Laboratorio',
    'Reportes',
    'Supervisión'
  ];

  constructor(private supabase: SupabaseService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    void this.cargarUsuarios();
  }

  volver() {
    this.back.emit();
  }

  formularioInicial(): UsuarioForm {
    return {
      username: '',
      email: '',
      password: '',
      nombre_completo: '',
      rol: 'Cajero',
      activo: true
    };
  }

  async cargarUsuarios() {
    this.loading = true;
    this.cdr.detectChanges();
    try {
      const { data, error } = await this.supabase.getClient()
        .from('usuarios')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      this.usuarios = (data ?? []) as User[];
    } catch (error) {
      console.error('Error cargando usuarios', error);
      this.toastMessage('No se pudieron cargar los usuarios.', 'danger');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  get usuariosFiltrados() {
    const texto = this.filtro.trim().toLowerCase();
    if (!texto) return this.usuarios;
    return this.usuarios.filter(u =>
      `${u.username} ${u.email} ${u.nombre_completo} ${u.rol}`.toLowerCase().includes(texto)
    );
  }

  editarUsuario(usuario: User) {
    this.usuarioForm = {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      password: '',
      nombre_completo: usuario.nombre_completo,
      rol: usuario.rol,
      activo: usuario.activo
    };
    this.modoEdicion = true;
  }

  nuevoUsuario() {
    this.usuarioForm = this.formularioInicial();
    this.modoEdicion = false;
  }

  async guardarUsuario() {
    if (!this.usuarioForm.username.trim() || !this.usuarioForm.nombre_completo.trim() || !this.usuarioForm.email.trim() || !this.usuarioForm.rol.trim()) {
      this.toastMessage('Complete los campos obligatorios.', 'warning');
      return;
    }

    if (!this.modoEdicion && !this.usuarioForm.password.trim()) {
      this.toastMessage('Debe asignar una contraseña temporal.', 'warning');
      return;
    }

    this.guardando = true;
    this.cdr.detectChanges();
    try {
      const payload = {
        username: this.usuarioForm.username.trim(),
        email: this.usuarioForm.email.trim(),
        password: this.usuarioForm.password.trim() || undefined,
        nombre_completo: this.usuarioForm.nombre_completo.trim(),
        rol: this.usuarioForm.rol,
        activo: this.usuarioForm.activo,
        created_at: new Date().toISOString()
      };

      const client = this.supabase.getClient();
      if (this.modoEdicion && this.usuarioForm.id) {
        const updatePayload: Record<string, any> = {
          username: payload.username,
          email: payload.email,
          nombre_completo: payload.nombre_completo,
          rol: payload.rol,
          activo: payload.activo
        };
        if (payload.password) updatePayload['password'] = payload.password;

        const { error } = await client.from('usuarios').update(updatePayload).eq('id', this.usuarioForm.id);
        if (error) throw error;
        this.toastMessage('Usuario actualizado correctamente.', 'success');
      } else {
        const { error } = await client.from('usuarios').insert(payload);
        if (error) throw error;
        this.toastMessage('Usuario creado correctamente.', 'success');
      }

      this.nuevoUsuario();
      await this.cargarUsuarios();
    } catch (error) {
      console.error('Error guardando usuario', error);
      this.toastMessage('No se pudo guardar el usuario.', 'danger');
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  async eliminarUsuario(usuario: User) {
    if (!confirm(`¿Eliminar el usuario ${usuario.nombre_completo}?`)) return;
    try {
      const { error } = await this.supabase.getClient().from('usuarios').delete().eq('id', usuario.id);
      if (error) throw error;
      this.toastMessage('Usuario eliminado.', 'success');
      await this.cargarUsuarios();
    } catch (error) {
      console.error('Error eliminando usuario', error);
      this.toastMessage('No se pudo eliminar el usuario.', 'danger');
    }
  }

  private toastMessage(message: string, type: typeof this.toastType) {
    this.toast = message;
    this.toastType = type;
    setTimeout(() => {
      this.toast = '';
      this.cdr.detectChanges();
    }, 2500);
  }
}
