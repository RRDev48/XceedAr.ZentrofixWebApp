import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfilesService } from '../../core/services/profiles.service';
import { AuthService } from '../../core/auth/auth.service';
import { Profile, UserRole } from '../../models';
import { ToastService } from '../../shared/components/toast/toast.service';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  recepcion: 'Recepción',
  tecnico: 'Técnico',
};

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Usuarios</h1>
          <p class="zf-subtitle">Administrá los roles y el acceso de cada cuenta de tu taller</p>
        </div>
      </div>

      <div class="zf-card info-card">
        Los cambios de rol y de estado (activo/inactivo) se aplican al instante. Los que afectan al rol
        Administrador piden confirmación, y no se puede dejar el taller sin ningún Administrador activo.
      </div>

      <form class="zf-card create-card" (ngSubmit)="createUser()">
        <h2>Dar de alta un usuario</h2>
        <div class="create-grid">
          <div class="zf-field"><label>Nombre completo</label><input class="zf-input" name="fullName" [(ngModel)]="newUser.fullName" required /></div>
          <div class="zf-field"><label>Correo</label><input class="zf-input" name="email" type="email" [(ngModel)]="newUser.email" required /></div>
          <div class="zf-field">
            <label>Contraseña inicial</label>
            <div class="password-row">
              <input
                class="zf-input"
                name="password"
                [type]="showPassword() ? 'text' : 'password'"
                minlength="8"
                [(ngModel)]="newUser.password"
                required
              />
              <button type="button" class="zf-btn zf-btn--ghost zf-btn--sm" (click)="generatePassword()">Generar</button>
              @if (newUser.password) {
                <button type="button" class="zf-btn zf-btn--ghost zf-btn--sm" (click)="copyPassword()">Copiar</button>
              }
            </div>
          </div>
          <div class="zf-field"><label>Rol y accesos</label><select class="zf-select" name="role" [(ngModel)]="newUser.role">
            @for (r of roles; track r) { <option [value]="r">{{ roleLabels[r] }}</option> }
          </select></div>
        </div>
        <button class="zf-btn zf-btn--primary" type="submit" [disabled]="creating()">
          {{ creating() ? 'Creando…' : '+ Crear usuario' }}
        </button>
      </form>

      <div class="zf-card filter-card">
        <input
          class="zf-input"
          type="search"
          placeholder="Buscar por nombre o correo…"
          [(ngModel)]="search"
          [ngModelOptions]="{ standalone: true }"
        />
        <select class="zf-select" [(ngModel)]="roleFilter" [ngModelOptions]="{ standalone: true }">
          <option value="todos">Todos los roles</option>
          @for (r of roles; track r) { <option [value]="r">{{ roleLabels[r] }}</option> }
        </select>
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando usuarios…</div>
      } @else if (filteredProfiles().length === 0) {
        <div class="zf-empty zf-card">No se encontraron usuarios con ese criterio.</div>
      } @else {
        <div class="card-list">
          @for (p of filteredProfiles(); track p.id) {
            <div class="zf-card user-card">
              <div class="user-card__info">
                <div class="user-card__name">{{ p.fullName || p.email }}</div>
                <div class="user-card__email">{{ p.email }}</div>
              </div>
              <div class="user-card__controls">
                <select
                  class="role-select"
                  [class.role-select--admin]="p.role === 'admin'"
                  [class.role-select--recepcion]="p.role === 'recepcion'"
                  [class.role-select--tecnico]="p.role === 'tecnico'"
                  [ngModel]="p.role"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="onRoleChange(p, $event)"
                  [disabled]="p.id === currentUserId || saving() === p.id"
                >
                  @for (r of roles; track r) {
                    <option [value]="r">{{ roleLabels[r] }}</option>
                  }
                </select>
                <label class="toggle">
                  <input
                    type="checkbox"
                    [ngModel]="p.active"
                    [ngModelOptions]="{ standalone: true }"
                    (ngModelChange)="onActiveChange(p, $event)"
                    [disabled]="p.id === currentUserId || saving() === p.id"
                  />
                  Activo
                </label>
                @if (saving() === p.id) {
                  <span class="zf-spinner"></span>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .zf-subtitle {
        color: var(--zf-text-muted);
        margin: 0;
        font-size: 0.9rem;
      }

      .info-card {
        margin-bottom: 1.25rem;
        font-size: 0.85rem;
        color: var(--zf-text-secondary);
      }

      .card-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .create-card { margin-bottom: 1rem; }
      .create-card h2 { margin-top: 0; font-size: 1.05rem; }
      .create-grid { display: grid; grid-template-columns: 1fr; gap: 0 1rem; }
      @media (min-width: 760px) { .create-grid { grid-template-columns: repeat(2, 1fr); } }

      .password-row {
        display: flex;
        gap: 0.4rem;
      }
      .password-row .zf-input {
        flex: 1;
      }

      .filter-card {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        margin-bottom: 1rem;
        padding: 0.75rem;
      }
      @media (min-width: 640px) {
        .filter-card { flex-direction: row; }
        .filter-card .zf-select { width: 220px; }
      }

      .user-card {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 0.85rem;
      }

      .user-card__name {
        font-weight: 700;
        color: var(--zf-text);
      }

      .user-card__email {
        font-size: 0.8rem;
        color: var(--zf-text-muted);
      }

      .user-card__controls {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .role-select {
        border: none;
        border-radius: 999px;
        padding: 0.35rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        min-height: 32px;
      }
      .role-select:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .role-select--admin {
        background: var(--zf-danger-soft);
        color: var(--zf-danger);
      }
      .role-select--recepcion {
        background: var(--zf-blue-soft);
        color: var(--zf-blue);
      }
      .role-select--tecnico {
        background: var(--zf-surface-2);
        color: var(--zf-text-muted);
      }

      .toggle {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.85rem;
        color: var(--zf-text-secondary);
      }
    `,
  ],
})
export class UsersComponent implements OnInit {
  private readonly profilesService = inject(ProfilesService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly profiles = signal<Profile[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly showPassword = signal(false);
  protected newUser: { fullName: string; email: string; password: string; role: UserRole } = {
    fullName: '', email: '', password: '', role: 'tecnico',
  };
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly roles: UserRole[] = ['admin', 'recepcion', 'tecnico'];
  protected readonly currentUserId = this.auth.session()?.user.id ?? null;

  protected search = '';
  protected roleFilter: UserRole | 'todos' = 'todos';

  protected readonly activeAdminCount = computed(
    () => this.profiles().filter((p) => p.role === 'admin' && p.active).length,
  );

  protected readonly filteredProfiles = computed(() => {
    const term = this.search.trim().toLowerCase();
    return this.profiles().filter((p) => {
      if (this.roleFilter !== 'todos' && p.role !== this.roleFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      return p.fullName.toLowerCase().includes(term) || p.email.toLowerCase().includes(term);
    });
  });

  async ngOnInit(): Promise<void> {
    try {
      this.profiles.set(await this.profilesService.list());
    } catch {
      this.toast.error('No se pudieron cargar los usuarios.');
    } finally {
      this.loading.set(false);
    }
  }

  protected generatePassword(): void {
    this.newUser.password = randomPassword();
    this.showPassword.set(true);
  }

  protected async copyPassword(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.newUser.password);
      this.toast.success('Contraseña copiada.');
    } catch {
      this.toast.error('No se pudo copiar; seleccionala manualmente.');
    }
  }

  async onRoleChange(profile: Profile, newRole: UserRole): Promise<void> {
    if (newRole === profile.role) {
      return;
    }
    const stopsBeingActiveAdmin = profile.role === 'admin' && profile.active && newRole !== 'admin';
    if (stopsBeingActiveAdmin && this.activeAdminCount() <= 1) {
      this.toast.error('No podés dejar el taller sin ningún Administrador activo.');
      return;
    }
    if (newRole === 'admin' || profile.role === 'admin') {
      const action = newRole === 'admin' ? 'ascender a Administrador' : 'quitarle el rol de Administrador';
      const confirmed = window.confirm(`¿Seguro que querés ${action} a ${profile.fullName || profile.email}?`);
      if (!confirmed) {
        return;
      }
    }
    await this.applyChange(profile, newRole, profile.active);
  }

  async onActiveChange(profile: Profile, active: boolean): Promise<void> {
    if (active === profile.active) {
      return;
    }
    if (!active) {
      if (profile.role === 'admin' && this.activeAdminCount() <= 1) {
        this.toast.error('No podés desactivar al único Administrador activo del taller.');
        return;
      }
      const confirmed = window.confirm(
        `¿Seguro que querés desactivar a ${profile.fullName || profile.email}? No va a poder ingresar a la app.`,
      );
      if (!confirmed) {
        return;
      }
    }
    await this.applyChange(profile, profile.role, active);
  }

  private async applyChange(profile: Profile, role: UserRole, active: boolean): Promise<void> {
    this.saving.set(profile.id);
    try {
      const updated = await this.profilesService.updateRoleAndActive(profile.id, role, active);
      this.profiles.update((list) => list.map((p) => (p.id === profile.id ? updated : p)));
      this.toast.success(`Usuario ${profile.email} actualizado.`);
    } catch {
      this.toast.error('No se pudo actualizar el usuario.');
    } finally {
      this.saving.set(null);
    }
  }

  async createUser(): Promise<void> {
    if (!this.newUser.fullName.trim() || !this.newUser.email.trim() || this.newUser.password.length < 8) {
      this.toast.error('Completá los datos; la contraseña debe tener al menos 8 caracteres.');
      return;
    }
    this.creating.set(true);
    try {
      await this.profilesService.createUser(this.newUser);
      this.toast.success(`Usuario ${this.newUser.email} creado. Contraseña: ${this.newUser.password}`);
      this.newUser = { fullName: '', email: '', password: '', role: 'tecnico' };
      this.showPassword.set(false);
      this.profiles.set(await this.profilesService.list());
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    } finally {
      this.creating.set(false);
    }
  }
}
