import { Component, ElementRef, HostListener, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GlobalSearchService, GlobalSearchResults } from '../../../core/services/global-search.service';
import { NavIconComponent } from '../nav-icon/nav-icon.component';
import { REPAIR_STATUS_LABELS } from '../../../models';

const EMPTY_RESULTS: GlobalSearchResults = { customers: [], orders: [] };

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [FormsModule, NavIconComponent],
  template: `
    @if (open()) {
      <div class="search-backdrop" (click)="close()">
        <div class="search-panel" (click)="$event.stopPropagation()">
          <div class="search-panel__input">
            <app-nav-icon name="buscar" />
            <input
              #searchInput
              class="search-panel__field"
              type="text"
              placeholder="Buscar cliente, orden, equipo…"
              [(ngModel)]="query"
              (ngModelChange)="onQueryChange()"
            />
            <button class="search-panel__close" (click)="close()" aria-label="Cerrar búsqueda">✕</button>
          </div>

          <div class="search-panel__body">
            @if (query.trim().length < 2) {
              <p class="search-hint">Escribí al menos 2 caracteres para buscar.</p>
            } @else if (loading()) {
              <p class="search-hint">Buscando…</p>
            } @else if (results().customers.length === 0 && results().orders.length === 0) {
              <p class="search-hint">Sin resultados para "{{ query }}".</p>
            } @else {
              @if (results().orders.length > 0) {
                <div class="search-group">
                  <div class="search-group__label">Órdenes</div>
                  @for (o of results().orders; track o.id) {
                    <a class="search-result" (click)="goTo(['/ordenes', o.id])">
                      <strong>{{ o.code }}</strong>
                      <span>{{ o.customerName }} · {{ o.deviceLabel }}</span>
                      <span class="zf-badge">{{ statusLabels[o.status] }}</span>
                    </a>
                  }
                </div>
              }
              @if (results().customers.length > 0) {
                <div class="search-group">
                  <div class="search-group__label">Clientes</div>
                  @for (c of results().customers; track c.id) {
                    <a class="search-result" (click)="goTo(['/clientes', c.id])">
                      <strong>{{ c.name }}</strong>
                      <span>{{ c.phone }}</span>
                    </a>
                  }
                </div>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .search-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(4, 5, 8, 0.72);
        backdrop-filter: blur(2px);
        z-index: 100;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 10vh 1rem 1rem;
      }

      .search-panel {
        width: 100%;
        max-width: 560px;
        background: var(--zf-surface);
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        overflow: hidden;
      }

      .search-panel__input {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.9rem 1rem;
        border-bottom: 1px solid var(--zf-border-soft);
        color: var(--zf-text-muted);
      }

      .search-panel__field {
        flex: 1;
        background: none;
        border: none;
        outline: none;
        color: var(--zf-text);
        font-size: 0.95rem;
        font-family: inherit;
      }

      .search-panel__close {
        background: none;
        border: none;
        color: var(--zf-text-muted);
        cursor: pointer;
        font-size: 0.9rem;
        padding: 0.2rem 0.4rem;
      }

      .search-panel__body {
        max-height: 60vh;
        overflow-y: auto;
        padding: 0.5rem 0;
      }

      .search-hint {
        padding: 1.25rem 1rem;
        color: var(--zf-text-muted);
        font-size: 0.85rem;
        margin: 0;
      }

      .search-group__label {
        padding: 0.5rem 1rem 0.25rem;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--zf-text-muted);
      }

      .search-result {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.6rem 1rem;
        cursor: pointer;
        text-decoration: none;
        color: var(--zf-text);
        font-size: 0.88rem;
      }

      .search-result:hover {
        background: var(--zf-surface-2);
      }

      .search-result span {
        color: var(--zf-text-muted);
        font-size: 0.8rem;
      }
    `,
  ],
})
export class GlobalSearchComponent {
  private readonly searchService = inject(GlobalSearchService);
  private readonly router = inject(Router);

  @ViewChild('searchInput') private readonly searchInput?: ElementRef<HTMLInputElement>;

  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly results = signal<GlobalSearchResults>(EMPTY_RESULTS);
  protected readonly statusLabels = REPAIR_STATUS_LABELS as Record<string, string>;
  protected query = '';

  private queryTimeout?: ReturnType<typeof setTimeout>;

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSearch();
    } else if (event.key === 'Escape' && this.open()) {
      this.close();
    }
  }

  openSearch(): void {
    this.open.set(true);
    setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
  }

  close(): void {
    this.open.set(false);
    this.query = '';
    this.results.set(EMPTY_RESULTS);
  }

  onQueryChange(): void {
    clearTimeout(this.queryTimeout);
    this.queryTimeout = setTimeout(() => this.runSearch(), 250);
  }

  goTo(commands: unknown[]): void {
    this.close();
    this.router.navigate(commands as (string | number)[]);
  }

  private async runSearch(): Promise<void> {
    if (this.query.trim().length < 2) {
      this.results.set(EMPTY_RESULTS);
      return;
    }
    this.loading.set(true);
    try {
      this.results.set(await this.searchService.search(this.query));
    } catch {
      this.results.set(EMPTY_RESULTS);
    } finally {
      this.loading.set(false);
    }
  }
}
