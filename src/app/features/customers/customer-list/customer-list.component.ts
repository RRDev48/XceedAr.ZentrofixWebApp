import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { CustomersService } from '../../../core/services/customers.service';
import { Customer } from '../../../models';
import { ToastService } from '../../../shared/components/toast/toast.service';

type InactivityFilter = 'todos' | '30' | '60' | '90' | '180';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Clientes</h1>
          <p class="zf-subtitle">{{ totalCount() }} clientes registrados</p>
        </div>
        <a routerLink="/clientes/nuevo" class="zf-btn zf-btn--primary">+ Nuevo cliente</a>
      </div>

      <div class="zf-card search-card">
        <input
          class="zf-input"
          type="search"
          placeholder="Buscar por nombre, WhatsApp o DNI…"
          [(ngModel)]="search"
          (ngModelChange)="onFilterChange()"
        />
        <select class="zf-select" [(ngModel)]="inactivityFilter" (ngModelChange)="onFilterChange()">
          <option value="todos">Todos</option>
          <option value="30">Inactivos +30 días</option>
          <option value="60">Inactivos +60 días</option>
          <option value="90">Inactivos +90 días</option>
          <option value="180">Inactivos +180 días</option>
        </select>
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando clientes…</div>
      } @else if (pagedCustomers().length === 0) {
        <div class="zf-empty zf-card">No se encontraron clientes con ese criterio.</div>
      } @else {
        <div class="zf-table-wrap desktop-only">
          <table class="zf-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>WhatsApp</th>
                <th>DNI</th>
                <th>Última orden</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of pagedCustomers(); track c.id) {
                <tr>
                  <td>{{ c.firstName }} {{ c.lastName }}</td>
                  <td>{{ c.whatsappPhone }}</td>
                  <td>{{ c.dni || '—' }}</td>
                  <td>{{ c.lastOrderAt ? (c.lastOrderAt | date: 'dd/MM/yyyy') : 'Nunca' }}</td>
                  <td>
                    <a [routerLink]="['/clientes', c.id]" class="zf-btn zf-btn--ghost zf-btn--sm">Ver</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="card-list mobile-only">
          @for (c of pagedCustomers(); track c.id) {
            <a [routerLink]="['/clientes', c.id]" class="customer-card zf-card">
              <div class="customer-card__name">{{ c.firstName }} {{ c.lastName }}</div>
              <div class="customer-card__meta">{{ c.whatsappPhone }}</div>
              @if (c.dni) {
                <div class="customer-card__meta">DNI {{ c.dni }}</div>
              }
              <div class="customer-card__meta">Última orden: {{ c.lastOrderAt ? (c.lastOrderAt | date: 'dd/MM/yyyy') : 'Nunca' }}</div>
            </a>
          }
        </div>

        @if (totalPages() > 1) {
          <div class="pagination">
            <button type="button" class="zf-btn zf-btn--ghost zf-btn--sm" [disabled]="page() <= 1" (click)="prevPage()">
              ← Anterior
            </button>
            <span class="pagination__label">Página {{ page() }} de {{ totalPages() }}</span>
            <button
              type="button"
              class="zf-btn zf-btn--ghost zf-btn--sm"
              [disabled]="page() >= totalPages()"
              (click)="nextPage()"
            >
              Siguiente →
            </button>
          </div>
        }
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

      .search-card {
        margin-bottom: 1rem;
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      @media (min-width: 640px) {
        .search-card {
          flex-direction: row;
        }
        .search-card .zf-select {
          width: 220px;
        }
      }

      .desktop-only {
        display: none;
      }

      .card-list {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }

      .customer-card {
        text-decoration: none;
        color: inherit;
        padding: 1rem;
      }

      .customer-card__name {
        font-weight: 700;
        color: var(--zf-text);
        margin-bottom: 0.2rem;
      }

      .customer-card__meta {
        font-size: 0.85rem;
        color: var(--zf-text-muted);
      }

      @media (min-width: 900px) {
        .desktop-only {
          display: block;
        }

        .mobile-only {
          display: none;
        }
      }

      .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        margin-top: 1rem;
      }

      .pagination__label {
        font-size: 0.85rem;
        color: var(--zf-text-muted);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerListComponent implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly toast = inject(ToastService);

  protected readonly pageSize = 25;
  protected readonly page = signal(1);
  protected readonly serverTotal = signal(0);

  // "inactivityFilter" compara la fecha de la última orden contra una cantidad de
  // días: no es un filtro simple de columna, así que cuando está activo se trae
  // todo lo que matchea la búsqueda y se pagina en memoria. Mismo patrón que
  // "onlyStale" en órdenes y "onlyLowStock" en inventario.
  protected readonly customers = signal<Customer[]>([]);
  protected readonly loading = signal(true);
  protected search = '';
  protected inactivityFilter: InactivityFilter = 'todos';
  private searchTimeout?: ReturnType<typeof setTimeout>;

  protected readonly filteredCustomers = computed(() => {
    if (this.inactivityFilter === 'todos') {
      return this.customers();
    }
    const days = Number(this.inactivityFilter);
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.customers().filter((c) => !c.lastOrderAt || new Date(c.lastOrderAt).getTime() < threshold);
  });

  protected readonly totalCount = computed(() =>
    this.isServerPaged() ? this.serverTotal() : this.filteredCustomers().length,
  );

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  protected readonly pagedCustomers = computed(() => {
    if (this.isServerPaged()) {
      return this.filteredCustomers();
    }
    const from = (this.page() - 1) * this.pageSize;
    return this.filteredCustomers().slice(from, from + this.pageSize);
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  onFilterChange(): void {
    this.page.set(1);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.load(), 300);
  }

  private isServerPaged(): boolean {
    return this.inactivityFilter === 'todos';
  }

  protected nextPage(): void {
    if (this.page() >= this.totalPages()) {
      return;
    }
    this.page.update((p) => p + 1);
    if (this.isServerPaged()) {
      this.load();
    }
  }

  protected prevPage(): void {
    if (this.page() <= 1) {
      return;
    }
    this.page.update((p) => p - 1);
    if (this.isServerPaged()) {
      this.load();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      if (this.isServerPaged()) {
        const { customers, total } = await this.customersService.listPage(this.search, this.page(), this.pageSize);
        this.customers.set(customers);
        this.serverTotal.set(total);
      } else {
        this.customers.set(await this.customersService.listWithLastOrder(this.search));
      }
    } catch {
      this.toast.error('No se pudieron cargar los clientes.');
    } finally {
      this.loading.set(false);
    }
  }
}
