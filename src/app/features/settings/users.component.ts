import { Component, OnInit, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Usuarios</h1>
          <p class="zf-subtitle">Administrá los roles y el acceso de cada cuenta</p>
        </div>
      </div>

      <div class="zf-card info-card">
        Las cuentas se crean desde el Dashboard de Supabase (Authentication → Users → Add user). Las que se
        autoregistren por otra vía nacen inactivas hasta que las actives acá.
      </div>

      <form class="zf-card create-card" (ngSubmit)="createUser()">
        <h2>Dar de alta un usuario</h2>
        <div class="create-grid">
          <div class="zf-field"><label>Nombre completo</label><input class="zf-input" name="fullName" [(ngModel)]="newUser.fullName" required /></div>
          <div class="zf-field"><label>Correo</label><input class="zf-input" name="email" type="email" [(ngModel)]="newUser.email" required /></div>
          <div class="zf-field"><label>Contraseña inicial</label><input class="zf-input" name="password" type="password" minlength="8" [(ngModel)]="newUser.password" required /></div>
          <div class="zf-field"><label>Rol y accesos</label><select class="zf-select" name="role" [(ngModel)]="newUser.role">
            @for (r of roles; track r) { <option [value]="r">{{ roleLabels[r] }}</option> }
          </select></div>
        </div>
        <button class="zf-btn zf-btn--primary" type="submit" [disabled]="creating()">
          {{ creating() ? 'Creando…' : '+ Crear usuario' }}
        </button>
      </form>

      @if (loading()) {
        <div class="zf-empty">Cargando usuarios…</div>
      } @else {
        <div class="card-list">
          @for (p of profiles(); track p.id) {
            <div class="zf-card user-card">
              <div class="user-card__info">
                <div class="user-card__name">{{ p.fullName || p.email }}</div>
                <div class="user-card__email">{{ p.email }}</div>
              </div>
              <div class="user-card__controls">
                <select class="zf-select zf-select--sm" [(ngModel)]="p.role" [disabled]="p.id === currentUserId">
                  @for (r of roles; track r) {
                    <option [value]="r">{{ roleLabels[r] }}</option>
                  }
                </select>
                <label class="toggle">
                  <input type="checkbox" [(ngModel)]="p.active" [disabled]="p.id === currentUserId" />
                  Activo
                </label>
                <button
                  type="button"
                  class="zf-btn zf-btn--ghost zf-btn--sm"
                  [disabled]="saving() === p.id || p.id === currentUserId"
                  (click)="save(p)"
                >
                  @if (saving() === p.id) {
                    <span class="zf-spinner"></span>
                  }
                  Guardar
                </button>
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

      .zf-select--sm {
        min-height: 38px;
        padding: 0.4rem 0.6rem;
        width: auto;
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
  protected newUser: { fullName: string; email: string; password: string; role: UserRole } = {
    fullName: '', email: '', password: '', role: 'tecnico',
  };
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly roles: UserRole[] = ['admin', 'recepcion', 'tecnico'];
  protected readonly currentUserId = this.auth.session()?.user.id ?? null;

  async ngOnInit(): Promise<void> {
    try {
      this.profiles.set(await this.profilesService.list());
    } catch {
      this.toast.error('No se pudieron cargar los usuarios.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(profile: Profile): Promise<void> {
    this.saving.set(profile.id);
    try {
      await this.profilesService.updateRoleAndActive(profile.id, profile.role, profile.active);
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
      this.toast.success(`Usuario ${this.newUser.email} creado.`);
      this.newUser = { fullName: '', email: '', password: '', role: 'tecnico' };
      this.profiles.set(await this.profilesService.list());
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    } finally {
      this.creating.set(false);
    }
  }
}
