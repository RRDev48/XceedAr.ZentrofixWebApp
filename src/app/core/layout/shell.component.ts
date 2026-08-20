import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { path: '/panel', label: 'Panel', icon: '📊' },
  { path: '/ordenes', label: 'Órdenes', icon: '🛠️' },
  { path: '/clientes', label: 'Clientes', icon: '👤' },
  { path: '/inventario', label: 'Inventario', icon: '📦' },
  { path: '/caja', label: 'Caja', icon: '💳', adminOnly: true },
  { path: '/reportes', label: 'Reportes', icon: '📈', adminOnly: true },
  { path: '/configuracion/usuarios', label: 'Usuarios', icon: '⚙️', adminOnly: true },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { path: '/panel', label: 'Panel', icon: '📊' },
  { path: '/ordenes', label: 'Órdenes', icon: '🛠️' },
  { path: '/clientes', label: 'Clientes', icon: '👤' },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <img src="assets/branding/isotipo.png" alt="Zentrofix" class="brand__mark" />
          <div>
            <div class="brand__name">Zentrofix</div>
            <div class="brand__sub">Gestión técnica</div>
          </div>
        </div>

        <nav class="sidebar__nav">
          @for (item of visibleSidebarItems(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="is-active" class="sidebar__link">
              <span class="sidebar__icon">{{ item.icon }}</span>
              {{ item.label }}
            </a>
          }
        </nav>

        <a routerLink="/ordenes/nueva" class="zf-btn zf-btn--primary sidebar__cta">+ Nueva orden</a>

        <div class="sidebar__user">
          <div class="sidebar__user-name">{{ auth.profile()?.fullName ?? auth.session()?.user.email }}</div>
          <button class="zf-btn zf-btn--ghost zf-btn--sm" (click)="logout()" [disabled]="loggingOut()">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="topbar__brand">
            <img src="assets/branding/isotipo.png" alt="Zentrofix" class="topbar__mark" />
            Zentrofix
          </div>
          <a routerLink="/ordenes/nueva" class="zf-btn zf-btn--primary zf-btn--sm topbar__cta">+ Orden</a>
        </header>

        <main class="content">
          <router-outlet />
        </main>
      </div>

      <nav class="bottom-nav">
        @for (item of bottomNavItems; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="is-active" class="bottom-nav__link">
            <span>{{ item.icon }}</span>
            <small>{{ item.label }}</small>
          </a>
        }
        <a routerLink="/ordenes/nueva" class="bottom-nav__link bottom-nav__link--cta">
          <span>➕</span>
          <small>Nueva</small>
        </a>
      </nav>
    </div>
  `,
  styles: [
    `
      .shell {
        display: flex;
        min-height: 100vh;
      }

      .sidebar {
        display: none;
      }

      .main {
        flex: 1;
        min-width: 0;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.9rem 1.1rem;
        background: var(--zf-surface);
        border-bottom: 1px solid var(--zf-border-soft);
        color: #fff;
        position: sticky;
        top: 0;
        z-index: 20;
      }

      .topbar__brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-family: var(--zf-font-heading);
        font-weight: 700;
        font-size: 1rem;
      }

      .topbar__mark {
        width: 22px;
        height: 22px;
        object-fit: contain;
      }

      .content {
        min-height: calc(100vh - 56px);
      }

      .bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: var(--zf-bottomnav-height);
        background: var(--zf-surface);
        border-top: 1px solid var(--zf-border-soft);
        display: flex;
        z-index: 30;
        box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.4);
      }

      .bottom-nav__link {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.15rem;
        text-decoration: none;
        color: var(--zf-text-muted);
        font-size: 1.05rem;
      }

      .bottom-nav__link small {
        font-size: 0.68rem;
        font-weight: 600;
      }

      .bottom-nav__link.is-active {
        color: var(--zf-blue);
      }

      .bottom-nav__link--cta {
        color: var(--zf-purple);
      }

      @media (min-width: 900px) {
        .bottom-nav {
          display: none;
        }

        .sidebar {
          display: flex;
          flex-direction: column;
          width: var(--zf-sidebar-width);
          background: var(--zf-surface);
          border-right: 1px solid var(--zf-border-soft);
          color: #fff;
          padding: 1.25rem 1rem;
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          margin-bottom: 1.75rem;
          padding: 0 0.35rem;
        }

        .brand__mark {
          width: 36px;
          height: 36px;
          object-fit: contain;
        }

        .brand__name {
          font-family: var(--zf-font-heading);
          font-weight: 700;
          font-size: 1.05rem;
        }

        .brand__sub {
          font-size: 0.72rem;
          color: var(--zf-text-muted);
        }

        .sidebar__nav {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
        }

        .sidebar__link {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.7rem 0.75rem;
          border-radius: var(--zf-radius-sm);
          color: rgba(255, 255, 255, 0.78);
          text-decoration: none;
          font-size: 0.92rem;
          font-weight: 500;
        }

        .sidebar__link:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .sidebar__link.is-active {
          background: var(--zf-blue);
          color: #fff;
        }

        .sidebar__icon {
          font-size: 1.05rem;
        }

        .sidebar__cta {
          margin: 1rem 0.35rem 1.25rem;
        }

        .sidebar__user {
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem 0.35rem 0;
        }

        .sidebar__user-name {
          font-size: 0.85rem;
          opacity: 0.85;
          word-break: break-word;
        }

        .topbar {
          display: none;
        }

        .content {
          min-height: 100vh;
        }
      }
    `,
  ],
})
export class ShellComponent {
  protected readonly bottomNavItems = BOTTOM_NAV_ITEMS;
  protected readonly visibleSidebarItems = computed(() =>
    SIDEBAR_NAV_ITEMS.filter((item) => !item.adminOnly || this.auth.profile()?.role === 'admin'),
  );
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly loggingOut = signal(false);

  async logout(): Promise<void> {
    this.loggingOut.set(true);
    await this.auth.signOut();
    this.loggingOut.set(false);
    await this.router.navigate(['/auth/ingresar']);
  }
}
