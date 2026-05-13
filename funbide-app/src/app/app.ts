import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoginScreenComponent } from './components/login-screen/login-screen';
import { DashboardComponent, ModuleCard } from './components/dashboard/dashboard';
import { ModuloFarmaciaComponent } from './components/modulo-farmacia/modulo-farmacia';
import { ModuloGenerarTurnoComponent } from './components/modulo-generarTurno/modulo-generarTurno';
import { ModuloCajaComponent } from './components/modulo-caja/modulo-caja';
import { ModuloMedicinaComponent } from './components/modulo-medicina/modulo-medicina';
import { ModuloLaboratorioComponent } from './components/modulo-laboratorio/modulo-laboratorio';
import { ModuloReportesComponent } from './components/modulo-reportes/modulo-reportes';
import { ModuloMantenimientoComponent } from './components/modulo-mantenimiento/modulo-mantenimiento';
import { ModuloSupervisionComponent } from './components/modulo-supervision/modulo-supervision';
import { AuthService } from './services/auth.service';

export interface User {
  id: number;
  username: string;
  nombre_completo: string;
  rol: string;
  activo: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LoginScreenComponent,
    DashboardComponent,
    ModuloFarmaciaComponent,
    ModuloGenerarTurnoComponent,
    ModuloCajaComponent,
    ModuloMedicinaComponent,
    ModuloLaboratorioComponent,
    ModuloReportesComponent,
    ModuloMantenimientoComponent,
    ModuloSupervisionComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  isTvRoute = window.location.pathname === '/tv' || window.location.pathname.startsWith('/tv/');
  view: 'login' | 'dashboard' = 'login';
  username = '';
  password = '';
  loginError = '';
  isLoading = false;
  isLoggedIn = false;
  currentUser: User | null = null;
  selectedModule: string | null = null;
  rememberMe = false;
  visibleModules: ModuleCard[] = [];

  readonly tvUrl = '/tv/index.html';
  private readonly sessionKey = 'funbide_session_user';

  private readonly roleModules: Record<string, string> = {
    Cajero: 'caja',
    Farmacia: 'farmacia',
    Medico: 'medicina',
    'Medicina General': 'medicina',
    Medicina: 'medicina',
    Psicologia: 'medicina',
    'Psicología': 'medicina',
    Laboratorio: 'laboratorio',
    Reportes: 'reportes',
    Mantenimiento: 'mantenimiento',
    'Supervisión': 'supervision',
    Supervision: 'supervision',
    Administrador: 'mantenimiento'
  };

  private readonly moduleCatalog: ModuleCard[] = [
    { id: 'medicina', name: 'Medicina General', icon: 'fa-stethoscope', description: 'Atención médica, consultas y expedientes clínicos', color: 'linear-gradient(135deg, #1D3973, #2a4a8a)' },
    { id: 'farmacia', name: 'Farmacia', icon: 'fa-capsules', description: 'Control de inventario y dispensación de medicamentos', color: 'linear-gradient(135deg, #9b59b6, #8e44ad)' },
    { id: 'generarTurno', name: 'Generar Turno', icon: 'fa-ticket-alt', description: 'Registro de paciente y emisión de ticket de atención', color: 'linear-gradient(135deg, #3498db, #2980b9)' },
    { id: 'caja', name: 'Caja', icon: 'fa-cash-register', description: 'Recepción de tickets, cobro y envío al área correspondiente', color: 'linear-gradient(135deg, #16a085, #0f766e)' },
    { id: 'laboratorio', name: 'Laboratorio', icon: 'fa-microscope', description: 'Gestión de análisis clínicos y resultados', color: 'linear-gradient(135deg, #e67e22, #d35400)' },
    { id: 'reportes', name: 'Reportes', icon: 'fa-chart-bar', description: 'Estadísticas y análisis de datos', color: 'linear-gradient(135deg, #34495e, #2c3e50)' },
    { id: 'mantenimiento', name: 'Mantenimiento', icon: 'fa-user-shield', description: 'Gestión de usuarios, roles y accesos del sistema', color: 'linear-gradient(135deg, #0f172a, #1e293b)' },
    { id: 'supervision', name: 'Supervisión', icon: 'fa-eye', description: 'Control de turnos, personal activo y operación', color: 'linear-gradient(135deg, #0f766e, #115e59)' }
  ];

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  async signIn() {
    this.isLoading = true;
    this.loginError = '';
    this.cdr.detectChanges();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    if (!this.username.trim() || !this.password.trim()) {
      this.loginError = 'Complete todos los campos';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    const result = await this.authService.login(this.username.trim(), this.password.trim());

    if (result.success && result.user) {
      this.isLoggedIn = true;
      this.view = 'dashboard';
      this.selectedModule = this.getDefaultModuleForRole(result.user.rol);
      this.visibleModules = this.getVisibleModulesForRole(result.user.rol);
      this.currentUser = {
        id: result.user.id,
        username: result.user.username,
        nombre_completo: result.user.nombre_completo,
        rol: result.user.rol,
        activo: result.user.activo
      };
      localStorage.setItem(this.sessionKey, JSON.stringify(this.currentUser));
      this.username = '';
      this.password = '';
    } else {
      this.loginError = result.error || 'Usuario o contraseña incorrectos';
    }

    this.isLoading = false;
    this.cdr.detectChanges();
    this.persistCredentials();
  }

  signOut() {
    this.isLoggedIn = false;
    this.view = 'login';
    this.currentUser = null;
    this.selectedModule = null;
    this.visibleModules = [];
    localStorage.removeItem(this.sessionKey);
  }

  onRememberMeChange(checked: boolean) {
    this.rememberMe = checked;
    this.persistCredentials();
  }

  onSelectModule(moduleId: string) {
    this.selectedModule = moduleId;
  }

  volverAlDashboard() {
    this.selectedModule = null;
  }

  ngOnInit() {
    const savedSession = localStorage.getItem(this.sessionKey);
    if (savedSession) {
      try {
        this.currentUser = JSON.parse(savedSession) as User;
        this.isLoggedIn = true;
        this.view = 'dashboard';
        this.selectedModule = this.getDefaultModuleForRole(this.currentUser.rol);
        this.visibleModules = this.getVisibleModulesForRole(this.currentUser.rol);
      } catch {
        localStorage.removeItem(this.sessionKey);
      }
    }

    const savedRememberMe = localStorage.getItem('funbide_remember_me') === 'true';
    const savedUsername = localStorage.getItem('funbide_username') || '';
    const savedPassword = localStorage.getItem('funbide_password') || '';

    this.rememberMe = savedRememberMe;
    if (savedRememberMe) {
      this.username = savedUsername;
      this.password = savedPassword;
    }
  }

  private persistCredentials() {
    if (this.rememberMe) {
      localStorage.setItem('funbide_remember_me', 'true');
      localStorage.setItem('funbide_username', this.username);
      localStorage.setItem('funbide_password', this.password);
    } else {
      localStorage.removeItem('funbide_remember_me');
      localStorage.removeItem('funbide_username');
      localStorage.removeItem('funbide_password');
    }
  }

  private getDefaultModuleForRole(role: string): string | null {
    return this.roleModules[role] ?? null;
  }

  private getVisibleModulesForRole(role: string): ModuleCard[] {
    if (role === 'Administrador') {
      return this.moduleCatalog;
    }

    const roleSpecific: Record<string, string[]> = {
      Cajero: ['caja', 'generarTurno', 'reportes'],
      Farmacia: ['farmacia', 'reportes'],
      Medico: ['medicina', 'reportes'],
      'Medicina General': ['medicina', 'reportes'],
      Medicina: ['medicina', 'reportes'],
      Psicologia: ['medicina', 'reportes'],
      'Psicología': ['medicina', 'reportes'],
      Laboratorio: ['laboratorio', 'reportes'],
      Mantenimiento: ['mantenimiento', 'reportes'],
      'Supervisión': ['supervision', 'reportes'],
      Supervision: ['supervision', 'reportes']
    };

    const allowed = new Set(roleSpecific[role] ?? ['medicina', 'farmacia', 'generarTurno', 'caja', 'laboratorio', 'reportes']);
    return this.moduleCatalog.filter(module => allowed.has(module.id));
  }
}


