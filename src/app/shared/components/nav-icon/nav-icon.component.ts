import { Component, input } from '@angular/core';

export type NavIconName =
  | 'panel'
  | 'ordenes'
  | 'clientes'
  | 'inventario'
  | 'caja'
  | 'reportes'
  | 'usuarios'
  | 'buscar'
  | 'actividad';

/** Set de íconos outline minimalista (acorde a la identidad Zentrofix) para la navegación. */
@Component({
  selector: 'app-nav-icon',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="nav-icon"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('panel') {
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
        }
        @case ('ordenes') {
          <rect x="4" y="3.5" width="16" height="18" rx="2" />
          <path d="M9 3.5h6v1.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V3.5Z" fill="currentColor" stroke="none" />
          <line x1="8" y1="11.5" x2="16" y2="11.5" />
          <line x1="8" y1="15.5" x2="13" y2="15.5" />
        }
        @case ('clientes') {
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M15.3 13.1A4.5 4.5 0 0 1 21 17.5" />
        }
        @case ('inventario') {
          <path d="M3 8l9-5 9 5-9 5-9-5Z" />
          <path d="M3 8v9l9 5 9-5V8" />
          <path d="M12 13v9" />
        }
        @case ('caja') {
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10.5h18" />
          <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
        }
        @case ('reportes') {
          <line x1="4" y1="20" x2="4" y2="12" />
          <line x1="10" y1="20" x2="10" y2="6" />
          <line x1="16" y1="20" x2="16" y2="14" />
          <line x1="20" y1="20" x2="20" y2="9" />
        }
        @case ('usuarios') {
          <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
          <path d="M9 12.3l2 2 4-4" />
        }
        @case ('buscar') {
          <circle cx="10.5" cy="10.5" r="6.5" />
          <line x1="20" y1="20" x2="15.3" y2="15.3" />
        }
        @case ('actividad') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.2 2" />
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .nav-icon {
        width: 1.15em;
        height: 1.15em;
      }
    `,
  ],
})
export class NavIconComponent {
  readonly name = input.required<NavIconName>();
}
