import { Component, computed, inject, signal } from '@angular/core';
import { NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { NavIconComponent, NavIconName } from '../../shared/components/nav-icon/nav-icon.component';

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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NavIconComponent],
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
              <app-nav-icon [name]="item.icon" class="sidebar__icon" />
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
          <button type="button" class="topbar__menu-btn" (click)="mobileMenuOpen.set(true)" aria-label="Abrir menú">
            <span></span><span></span><span></span>
          </button>
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
            <app-nav-icon [name]="item.icon" />
            <small>{{ item.label }}</small>
          </a>
        }
        <button type="button" class="bottom-nav__link bottom-nav__link--more" (click)="mobileMenuOpen.set(true)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
          </svg>
          <small>Más</small>
        </button>
      </nav>
    </div>

    @if (mobileMenuOpen()) {
      <div class="mobile-menu-backdrop" (click)="mobileMenuOpen.set(false)">
        <div class="mobile-menu-panel" (click)="$event.stopPropagation()">
          <div class="mobile-menu-header">
            <div class="brand">
              <img src="assets/branding/isotipo.png" alt="Zentrofix" class="brand__mark" />
              <div>
                <div class="brand__name">Zentrofix</div>
                <div class="brand__sub">Gestión técnica</div>
              </div>
            </div>
            <button type="button" class="mobile-menu-close" (click)="mobileMenuOpen.set(false)" aria-label="Cerrar menú">
              ✕
            </button>
          </div>

          <nav class="mobile-menu-nav">
            @for (item of visibleSidebarItems(); track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="is-active"
                class="mobile-menu-link"
                (click)="mobileMenuOpen.set(false)"
              >
                <app-nav-icon [name]="item.icon" />
                {{ item.label }}
              </a>
            }
          </nav>

          <a routerLink="/ordenes/nueva" class="zf-btn zf-btn--primary mobile-menu-cta" (click)="mobileMenuOpen.set(false)">
            + Nueva orden
          </a>

          <div class="mobile-menu-user">
            <div class="sidebar__user-name">{{ auth.profile()?.fullName ?? auth.session()?.user.email }}</div>
            <button class="zf-btn zf-btn--ghost zf-btn--sm" (click)="logout()" [disabled]="loggingOut()">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    }
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

      .topbar__menu-btn {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
        width: 32px;
        height: 32px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        flex-shrink: 0;
      }

      .topbar__menu-btn span {
        display: block;
        height: 2px;
        border-radius: 1px;
        background: var(--zf-text-secondary);
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

      /* ---------- Mobile menu drawer ---------- */

      .mobile-menu-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(4, 5, 8, 0.72);
        z-index: 200;
        display: flex;
      }

      .mobile-menu-panel {
        width: min(82vw, 320px);
        height: 100%;
        background: var(--zf-surface);
        border-right: 1px solid var(--zf-border-soft);
        padding: 1.25rem 1rem;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        animation: slide-in 0.18s ease-out;
      }

      @keyframes slide-in {
        from {
          transform: translateX(-12px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .mobile-menu-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
      }

      .mobile-menu-close {
        background: none;
        border: none;
        color: var(--zf-text-muted);
        font-size: 1.1rem;
        cursor: pointer;
        padding: 0.25rem;
      }

      .mobile-menu-nav {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        flex: 1;
      }

      .mobile-menu-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.85rem 0.75rem;
        border-radius: var(--zf-radius-sm);
        color: var(--zf-text-secondary);
        text-decoration: none;
        font-size: 0.95rem;
        font-weight: 500;
      }

      .mobile-menu-link svg {
        width: 1.2rem;
        height: 1.2rem;
      }

      .mobile-menu-link.is-active {
        background: var(--zf-blue);
        color: #fff;
      }

      .mobile-menu-cta {
        margin: 1rem 0;
        width: 100%;
      }

      .mobile-menu-user {
        border-top: 1px solid var(--zf-border-soft);
        padding-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      @media (min-width: 900px) {
        .bottom-nav {
          display: none;
        }

        .mobile-menu-backdrop {
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
          width: 1.2rem;
          height: 1.2rem;
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
  protected readonly mobileMenuOpen = signal(false);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.mobileMenuOpen.set(false);
      }
    });
  }

  async logout(): Promise<void> {
    this.loggingOut.set(true);
    await this.auth.signOut();
    this.loggingOut.set(false);
    await this.router.navigate(['/auth/ingresar']);
  }
}
