import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { NavIconComponent, NavIconName } from '../../shared/components/nav-icon/nav-icon.component';
import { GlobalSearchComponent } from '../../shared/components/global-search/global-search.component';

interface NavItem {
  path: string;
  label: string;
  icon: NavIconName;
  adminOnly?: boolean;
}

const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { path: '/panel', label: 'Panel', icon: 'panel' },
  { path: '/ordenes', label: 'Órdenes', icon: 'ordenes' },
  { path: '/clientes', label: 'Clientes', icon: 'clientes' },
  { path: '/inventario', label: 'Inventario', icon: 'inventario' },
  { path: '/caja', label: 'Caja', icon: 'caja', adminOnly: true },
  { path: '/reportes', label: 'Reportes', icon: 'reportes', adminOnly: true },
  { path: '/actividad', label: 'Actividad', icon: 'actividad', adminOnly: true },
  { path: '/papelera', label: 'Papelera', icon: 'papelera', adminOnly: true },
  { path: '/configuracion/usuarios', label: 'Usuarios', icon: 'usuarios', adminOnly: true },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { path: '/panel', label: 'Panel', icon: 'panel' },
  { path: '/ordenes', label: 'Órdenes', icon: 'ordenes' },
  { path: '/clientes', label: 'Clientes', icon: 'clientes' },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NavIconComponent, GlobalSearchComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__glow"></div>

        <div class="brand">
          <img src="assets/branding/isotipo.png" alt="Zentrofix" class="brand__mark" />
          <div>
            <div class="brand__name">Zentrofix</div>
            <div class="brand__sub">Gestión técnica</div>
          </div>
        </div>

        <button class="sidebar__search" (click)="globalSearch.openSearch()">
          <app-nav-icon name="buscar" />
          Buscar…
          <span class="sidebar__search-kbd">Ctrl K</span>
        </button>

        <nav class="sidebar__nav">
          @for (item of visibleSidebarItems(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="is-active" class="sidebar__link">
              <app-nav-icon [name]="item.icon" class="sidebar__icon" />
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="sidebar__bottom">
          <a routerLink="/ordenes/nueva" class="zf-btn zf-btn--primary sidebar__cta">+ Nueva orden</a>

          <div class="sidebar__user">
            <span class="sidebar__avatar">{{ userInitials() }}</span>
            <div class="sidebar__user-info">
              <div class="sidebar__user-name">{{ auth.profile()?.fullName || auth.session()?.user.email }}</div>
              <div class="sidebar__user-role">{{ auth.profile()?.role === 'admin' ? 'Administrador' : (auth.profile()?.role || '') }}</div>
            </div>
            <button class="sidebar__logout" (click)="logout()" [disabled]="loggingOut()" aria-label="Cerrar sesión" title="Cerrar sesión">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="topbar__brand">
            <img src="assets/branding/isotipo.png" alt="Zentrofix" class="topbar__mark" />
            Zentrofix
          </div>
          <button class="topbar__search-btn" (click)="globalSearch.openSearch()" aria-label="Buscar">
            <app-nav-icon name="buscar" />
          </button>
          <a routerLink="/ordenes/nueva" class="zf-btn zf-btn--primary zf-btn--sm topbar__cta">+ Orden</a>
        </header>

        <main class="content">
          <router-outlet />
        </main>
      </div>

      <nav class="bottom-nav">
        @for (item of bottomNavItems; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="is-active" class="bottom-nav__link">
            <app-nav-icon [name]="item.icon" />
            <small>{{ item.label }}</small>
          </a>
        }
        <a routerLink="/ordenes/nueva" class="bottom-nav__link bottom-nav__link--cta">
          <span>➕</span>
          <small>Nueva</small>
        </a>
      </nav>

      <app-global-search #globalSearch />
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
        gap: 0.75rem;
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
        flex: 1;
      }

      .topbar__mark {
        width: 22px;
        height: 22px;
        object-fit: contain;
      }

      .topbar__search-btn {
        background: none;
        border: none;
        color: var(--zf-text-muted);
        cursor: pointer;
        padding: 0.4rem;
        display: flex;
      }

      .topbar__search-btn svg {
        width: 1.15rem;
        height: 1.15rem;
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
        gap: 0.2rem;
        text-decoration: none;
        color: var(--zf-text-muted);
        background: none;
        border: none;
        cursor: pointer;
        font-family: inherit;
      }

      .bottom-nav__link svg {
        width: 1.2rem;
        height: 1.2rem;
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
          overflow: hidden;
        }

        .sidebar__glow {
          position: absolute;
          top: -80px;
          left: -60px;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(156, 44, 255, 0.28), rgba(30, 155, 255, 0.12) 55%, transparent 72%);
          pointer-events: none;
          z-index: 0;
        }

        .brand,
        .sidebar__nav,
        .sidebar__bottom {
          position: relative;
          z-index: 1;
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

        .sidebar__search {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--zf-border-soft);
          border-radius: var(--zf-radius-sm);
          padding: 0.55rem 0.7rem;
          color: var(--zf-text-muted);
          font-size: 0.85rem;
          font-family: inherit;
          cursor: pointer;
          margin-bottom: 1rem;
        }

        .sidebar__search:hover {
          border-color: var(--zf-blue);
          color: var(--zf-text-secondary);
        }

        .sidebar__search-kbd {
          margin-left: auto;
          font-size: 0.68rem;
          border: 1px solid var(--zf-border-soft);
          border-radius: 4px;
          padding: 0.05rem 0.3rem;
        }

        .sidebar__nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .sidebar__link {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.65rem 0.75rem;
          border-radius: var(--zf-radius-sm);
          color: var(--zf-text-muted);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .sidebar__link:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--zf-text-secondary);
        }

        .sidebar__link.is-active {
          background: var(--zf-gradient);
          color: #fff;
          font-weight: 600;
          box-shadow: 0 4px 18px rgba(30, 155, 255, 0.28);
        }

        .sidebar__icon {
          width: 1.2rem;
          height: 1.2rem;
          flex-shrink: 0;
        }

        .sidebar__bottom {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .sidebar__cta {
          width: 100%;
        }

        .sidebar__user {
          border-top: 1px solid var(--zf-border-soft);
          padding-top: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .sidebar__avatar {
          width: 34px;
          height: 34px;
          min-width: 34px;
          border-radius: 50%;
          background: var(--zf-gradient);
          color: #fff;
          font-family: var(--zf-font-heading);
          font-weight: 700;
          font-size: 0.78rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sidebar__user-info {
          flex: 1;
          min-width: 0;
        }

        .sidebar__user-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--zf-text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sidebar__user-role {
          font-size: 0.72rem;
          color: var(--zf-text-muted);
          text-transform: capitalize;
        }

        .sidebar__logout {
          background: none;
          border: none;
          color: var(--zf-text-muted);
          cursor: pointer;
          padding: 0.4rem;
          border-radius: var(--zf-radius-sm);
          flex-shrink: 0;
          display: flex;
        }

        .sidebar__logout svg {
          width: 1.1rem;
          height: 1.1rem;
        }

        .sidebar__logout:hover:not(:disabled) {
          background: var(--zf-danger-soft);
          color: var(--zf-danger);
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

  protected readonly userInitials = computed(() => {
    const name = this.auth.profile()?.fullName?.trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || parts[0]!.slice(0, 2).toUpperCase();
    }
    const email = this.auth.session()?.user.email ?? '';
    return email.slice(0, 2).toUpperCase() || 'ZF';
  });

  async logout(): Promise<void> {
    this.loggingOut.set(true);
    await this.auth.signOut();
    this.loggingOut.set(false);
    await this.router.navigate(['/auth/ingresar']);
  }
}
