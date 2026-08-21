import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RepairOrdersService } from '../../../core/services/repair-orders.service';
import {
  PAYMENT_STATUS_LABELS,
  PaymentStatus,
  RepairOrder,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_ORDER,
  RepairStatus,
} from '../../../models';
import { ToastService } from '../../../shared/components/toast/toast.service';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, CurrencyPipe],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Órdenes de reparación</h1>
          <p class="zf-subtitle">{{ orders().length }} órdenes encontradas</p>
        </div>
        <a routerLink="/ordenes/nueva" class="zf-btn zf-btn--primary">+ Nueva orden</a>
      </div>

      <div class="zf-card filters-card">
        <div class="zf-field">
          <label for="search">Buscar</label>
          <input
            id="search"
            class="zf-input"
            [(ngModel)]="search"
            (ngModelChange)="onFilterChange()"
            placeholder="Código, cliente, teléfono, marca, modelo, IMEI…"
          />
        </div>
        <div class="filters-row">
          <div class="zf-field">
            <label for="status">Estado</label>
            <select id="status" class="zf-select" [(ngModel)]="status" (ngModelChange)="onFilterChange()">
              <option value="todos">Todos</option>
              @for (s of statusOrder; track s) {
                <option [value]="s">{{ statusLabels[s] }}</option>
              }
            </select>
          </div>
          <div class="zf-field">
            <label for="paymentStatus">Estado de pago</label>
            <select id="paymentStatus" class="zf-select" [(ngModel)]="paymentStatus" (ngModelChange)="onFilterChange()">
              <option value="todos">Todos</option>
              @for (p of paymentStatuses; track p) {
                <option [value]="p">{{ paymentStatusLabels[p] }}</option>
              }
            </select>
          </div>
          <div class="zf-field">
            <label for="brand">Marca</label>
            <input id="brand" class="zf-input" [(ngModel)]="brand" (ngModelChange)="onFilterChange()" />
          </div>
        </div>
        <label class="stale-toggle">
          <input type="checkbox" [(ngModel)]="onlyStale" (ngModelChange)="onFilterChange()" />
          Mostrar solo órdenes estancadas
        </label>
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando órdenes…</div>
      } @else if (filteredOrders().length === 0) {
        <div class="zf-empty zf-card">No se encontraron órdenes con esos filtros.</div>
      } @else {
        <div class="zf-table-wrap desktop-only">
          <table class="zf-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Equipo</th>
                <th>Estado</th>
                <th>Ingreso</th>
                <th>Saldo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of filteredOrders(); track o.id) {
                <tr>
                  <td><strong>{{ o.code }}</strong></td>
                  <td>{{ o.customerName }}</td>
                  <td>{{ o.deviceLabel }}</td>
                  <td>
                    <span class="zf-badge">{{ statusLabels[o.status] }}</span>
                    @if (isStale(o)) {
                      <span class="zf-badge zf-badge--warning stale-badge">⏱ {{ daysInStatus(o) }}d</span>
                    }
                  </td>
                  <td>{{ o.receivedAt | date: 'dd/MM/yyyy' }}</td>
                  <td>{{ o.balanceDue | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}</td>
                  <td><a [routerLink]="['/ordenes', o.id]" class="zf-btn zf-btn--ghost zf-btn--sm">Ver</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="card-list mobile-only">
          @for (o of filteredOrders(); track o.id) {
            <a [routerLink]="['/ordenes', o.id]" class="zf-card order-card">
              <div class="order-card__top">
                <strong>{{ o.code }}</strong>
                <span class="zf-badge">{{ statusLabels[o.status] }}</span>
              </div>
              <div class="order-card__meta">{{ o.customerName }} · {{ o.deviceLabel }}</div>
              <div class="order-card__meta">Ingreso: {{ o.receivedAt | date: 'dd/MM/yyyy' }}</div>
              @if (isStale(o)) {
                <span class="zf-badge zf-badge--warning stale-badge">⏱ Estancada hace {{ daysInStatus(o) }} días</span>
              }
            </a>
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

      .filters-card {
        margin-bottom: 1rem;
      }

      .filters-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0 1rem;
      }

      .stale-toggle {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.85rem;
        color: var(--zf-text-secondary);
        margin-top: 0.85rem;
        cursor: pointer;
      }

      .stale-badge {
        margin-left: 0.4rem;
      }

      @media (min-width: 640px) {
        .filters-row {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      .desktop-only {
        display: none;
      }

      .card-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .order-card {
        text-decoration: none;
        color: inherit;
        padding: 1rem;
      }

      .order-card__top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.35rem;
      }

      .order-card__meta {
        font-size: 0.82rem;
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
    `,
  ],
})
export class OrderListComponent implements OnInit {
  private readonly ordersService = inject(RepairOrdersService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly orders = signal<RepairOrder[]>([]);
  protected readonly daysInStatusMap = signal<Map<string, number>>(new Map());
  protected readonly loading = signal(true);
  protected readonly statusLabels = REPAIR_STATUS_LABELS;
  protected readonly statusOrder = REPAIR_STATUS_ORDER;
  protected readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;
  protected readonly paymentStatuses: PaymentStatus[] = ['sin_pago', 'senia', 'pagado_parcial', 'pagado_total'];

  protected search = '';
  protected status: RepairStatus | 'todos' = 'todos';
  protected paymentStatus: PaymentStatus | 'todos' = 'todos';
  protected brand = '';
  protected onlyStale = false;
  private filterTimeout?: ReturnType<typeof setTimeout>;

  protected readonly filteredOrders = computed(() =>
    this.onlyStale ? this.orders().filter((o) => this.isStale(o)) : this.orders(),
  );

  async ngOnInit(): Promise<void> {
    this.onlyStale = this.route.snapshot.queryParamMap.get('estancadas') === '1';
    await this.load();
  }

  onFilterChange(): void {
    clearTimeout(this.filterTimeout);
    this.filterTimeout = setTimeout(() => this.load(), 300);
  }

  protected isStale(order: RepairOrder): boolean {
    return this.ordersService.isStale(order.status, this.daysInStatusMap().get(order.id) ?? 0);
  }

  protected daysInStatus(order: RepairOrder): number {
    return this.daysInStatusMap().get(order.id) ?? 0;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const results = await this.ordersService.list({
        search: this.search,
        status: this.status,
        paymentStatus: this.paymentStatus,
        brand: this.brand,
      });
      this.orders.set(results);
      this.daysInStatusMap.set(await this.ordersService.getDaysInStatusMap(results.map((o) => o.id)));
    } catch {
      this.toast.error('No se pudieron cargar las órdenes.');
    } finally {
      this.loading.set(false);
    }
  }
}
