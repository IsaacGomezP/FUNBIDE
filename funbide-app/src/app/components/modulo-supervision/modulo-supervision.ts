import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';

interface SupervisorTurno {
  id: string;
  codigo: string;
  paciente_nombre: string;
  servicio_nombre: string;
  estado: string;
  puesto_atencion: string | null;
  fecha_creado: string;
}

interface SupervisorUsuario {
  id: number;
  nombre_completo: string;
  rol: string;
  activo: boolean;
}

@Component({
  selector: 'app-modulo-supervision',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modulo-supervision.html',
  styleUrls: ['./modulo-supervision.css']
})
export class ModuloSupervisionComponent implements OnInit {
  @Input() usuarioNombre = '';
  @Input() usuarioRol = '';
  @Output() back = new EventEmitter<void>();

  loading = true;
  currentDate = new Date();
  turnosActivos: SupervisorTurno[] = [];
  turnosEspera: SupervisorTurno[] = [];
  usuariosActivos: SupervisorUsuario[] = [];
  resumen = { totalTurnos: 0, activos: 0, espera: 0, usuariosActivos: 0 };

  constructor(private supabase: SupabaseService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    void this.cargarSupervision();
  }

  volver() {
    this.back.emit();
  }

  async cargarSupervision() {
    this.loading = true;
    this.cdr.detectChanges();
    try {
      const client = this.supabase.getClient();
      const [activosRes, esperaRes, usuariosRes, totalRes] = await Promise.all([
        client.from('turnos').select('id,codigo,paciente_nombre,servicio_nombre,estado,puesto_atencion,fecha_creado').in('estado', ['llamando', 'atendiendo']).order('fecha_creado', { ascending: false }),
        client.from('turnos').select('id,codigo,paciente_nombre,servicio_nombre,estado,puesto_atencion,fecha_creado').eq('estado', 'espera').order('fecha_creado', { ascending: false }),
        client.from('usuarios').select('id,nombre_completo,rol,activo').eq('activo', true).order('id', { ascending: true }),
        client.from('turnos').select('id', { count: 'exact', head: true })
      ]);

      this.turnosActivos = (activosRes.data ?? []) as SupervisorTurno[];
      this.turnosEspera = (esperaRes.data ?? []) as SupervisorTurno[];
      this.usuariosActivos = (usuariosRes.data ?? []) as SupervisorUsuario[];
      this.resumen = {
        totalTurnos: totalRes.count ?? 0,
        activos: this.turnosActivos.length,
        espera: this.turnosEspera.length,
        usuariosActivos: this.usuariosActivos.length
      };
    } catch (error) {
      console.error('Error cargando supervisión', error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
