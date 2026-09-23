import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RepairOrdersService } from '../../../core/services/repair-orders.service';
import { ProfilesService } from '../../../core/services/profiles.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  PAYMENT_STATUS_LABELS,
  PaymentStatus,
  RepairOrder,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_ORDER,
  RepairStatus,
  Profile,
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
          <p class="zf-subtitle">{{ totalCount() }} órdenes encontradas</p>
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
          <div class="zf-field">
            <label for="technician">Técnico</label>
            <select id="technician" class="zf-select" [(ngModel)]="technicianId" (ngModelChange)="onFilterChange()">
              <option value="todos">Todos</option>
              <option value="sin_asignar">Sin asignar</option>
              @for (technician of technicians(); track technician.id) {
                <option [value]="technician.id">{{ technician.fullName || technician.email }}</option>
              }
            </select>
          </div>
        </div>
        <label class="stale-toggle">
          <input type="checkbox" [(ngModel)]="onlyStale" (ngModelChange)="onFilterChange()" />
          Mostrar solo órdenes estancadas
        </label>
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando órdenes…</div>
      } @else if (pagedOrders().length === 0) {
        <div class="zf-empty zf-card">No se encontraron órdenes con esos filtros.</div>
      } @else {
        <div class="zf-table-wrap desktop-only">
          <table class="zf-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Equipo</th>
                <th>Técnico</th>
                <th>Estado</th>
                <th>Ingreso</th>
                <th>Saldo</th>
                <th>Cambiar estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of pagedOrders(); track o.id) {
                <tr>
                  <td><strong>{{ o.code }}</strong></td>
                  <td>{{ o.customerName }}</td>
                  <td>{{ o.deviceLabel }}</td>
                  <td>
                    @if (canAssign()) {
                      <select class="zf-select zf-select--sm" [value]="o.assignedTechnicianId ?? ''"
                        [disabled]="isUpdating(o.id)" (change)="onTechnicianChange(o, $any($event.target).value)">
                        <option value="">Sin asignar</option>
                        @for (technician of technicians(); track technician.id) {
                          <option [value]="technician.id">{{ technician.fullName || technician.email }}</option>
                        }
                      </select>
                    } @else {
                      {{ o.assignedTechnicianName || 'Sin asignar' }}
                    }
                  </td>
                  <td>
                    <span class="zf-badge">{{ statusLabels[o.status] }}</span>
                    @if (isStale(o)) {
                      <span class="zf-badge zf-badge--warning stale-badge">⏱ {{ daysInStatus(o) }}d</span>
                    }
                  </td>
                  <td>{{ o.receivedAt | date: 'dd/MM/yyyy' }}</td>
                  <td>{{ o.balanceDue | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}</td>
                  <td>
                    <select
                      class="zf-select zf-select--sm"
                      [value]="o.status"
                      [disabled]="isUpdating(o.id)"
                      (change)="onQuickStatusChange(o, $any($event.target).value)"
                    >
                      @for (s of statusOrder; track s) {
                        <option [value]="s">{{ statusLabels[s] }}</option>
                      }
                    </select>
                  </td>
                  <td><a [routerLink]="['/ordenes', o.id]" class="zf-btn zf-btn--ghost zf-btn--sm">Ver</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="card-list mobile-only">
          @for (o of pagedOrders(); track o.id) {
            <a [routerLink]="['/ordenes', o.id]" class="zf-card order-card">
              <div class="order-card__top">
                <strong>{{ o.code }}</strong>
                <span class="zf-badge">{{ statusLabels[o.status] }}</span>
              </div>
              <div class="order-card__meta">{{ o.customerName }} · {{ o.deviceLabel }}</div>
              <div class="order-card__meta">Ingreso: {{ o.receivedAt | date: 'dd/MM/yyyy' }}</div>
              <div class="order-card__meta">Técnico: {{ o.assignedTechnicianName || 'Sin asignar' }}</div>
              @if (isStale(o)) {
                <span class="zf-badge zf-badge--warning stale-badge">⏱ Estancada hace {{ daysInStatus(o) }} días</span>
              }
              <select
                class="zf-select zf-select--sm quick-status-mobile"
                [value]="o.status"
                [disabled]="isUpdating(o.id)"
                (click)="$event.stopPropagation()"
                (change)="onQuickStatusChange(o, $any($event.target).value)"
              >
                @for (s of statusOrder; track s) {
                  <option [value]="s">{{ statusLabels[s] }}</option>
                }
              </select>
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

      .zf-select--sm {
        padding: 0.35rem 0.5rem;
        font-size: 0.8rem;
        max-width: 180px;
      }

      .quick-status-mobile {
        margin-top: 0.6rem;
        width: 100%;
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderListComponent implements OnInit {
  private readonly ordersService = inject(RepairOrdersService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly profilesService = inject(ProfilesService);
  private readonly auth = inject(AuthService);

  protected readonly pageSize = 25;
  protected readonly page = signal(1);
  protected readonly serverTotal = signal(0);

  protected readonly orders = signal<RepairOrder[]>([]);
  protected readonly daysInStatusMap = signal<Map<string, number>>(new Map());
  protected readonly updatingIds = signal<Set<string>>(new Set());
  protected readonly loading = signal(true);
  protected readonly technicians = signal<Profile[]>([]);
  protected readonly canAssign = computed(() => ['admin', 'recepcion'].includes(this.auth.profile()?.role ?? ''));
  protected readonly statusLabels = REPAIR_STATUS_LABELS;
  protected readonly statusOrder = REPAIR_STATUS_ORDER;
  protected readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;
  protected readonly paymentStatuses: PaymentStatus[] = ['sin_pago', 'senia', 'pagado_parcial', 'pagado_total'];

  protected search = '';
  protected status: RepairStatus | 'todos' = 'todos';
  protected paymentStatus: PaymentStatus | 'todos' = 'todos';
  protected brand = '';
  protected technicianId: string | 'todos' | 'sin_asignar' = 'todos';
  protected onlyStale = false;
  private filterTimeout?: ReturnType<typeof setTimeout>;

  // "onlyStale" y "paymentStatus" se calculan en el cliente (no son columnas de la
  // base). Cuando están activos no se puede paginar en el servidor: se trae todo lo
  // que matchea el resto de los filtros y se pagina en memoria sobre el resultado ya
  // filtrado. Sin ellos, "orders" ya es la página pedida al servidor.
  protected readonly filteredOrders = computed(() =>
    this.onlyStale ? this.orders().filter((o) => this.isStale(o)) : this.orders(),
  );

  protected readonly totalCount = computed(() =>
    this.isServerPaged() ? this.serverTotal() : this.filteredOrders().length,
  );

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  protected readonly pagedOrders = computed(() => {
    if (this.isServerPaged()) {
      return this.filteredOrders();
    }
    const from = (this.page() - 1) * this.pageSize;
    return this.filteredOrders().slice(from, from + this.pageSize);
  });

  private static readonly FILTERS_KEY = 'zf-order-filters';

  async ngOnInit(): Promise<void> {
    try {
      this.technicians.set(await this.profilesService.listActiveTechnicians());
    } catch {
      this.toast.error('No se pudieron cargar los técnicos.');
    }
    if (this.route.snapshot.queryParamMap.get('estancadas') === '1') {
      this.onlyStale = true;
    } else {
      this.loadSavedFilters();
    }
    if (this.auth.profile()?.role === 'tecnico') {
      this.technicianId = this.auth.profile()!.id;
    }
    await this.load();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.saveFilters();
    clearTimeout(this.filterTimeout);
    this.filterTimeout = setTimeout(() => this.load(), 300);
  }

  private isServerPaged(): boolean {
    return this.paymentStatus === 'todos' && !this.onlyStale;
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

  private loadSavedFilters(): void {
    try {
      const raw = localStorage.getItem(OrderListComponent.FILTERS_KEY);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw);
      this.search = saved.search ?? '';
      this.status = saved.status ?? 'todos';
      this.paymentStatus = saved.paymentStatus ?? 'todos';
      this.brand = saved.brand ?? '';
      this.technicianId = saved.technicianId ?? 'todos';
      this.onlyStale = Boolean(saved.onlyStale);
    } catch {
      // Filtros guardados corruptos o inaccesibles: se ignoran y se usan los valores por defecto.
    }
  }

  private saveFilters(): void {
    try {
      localStorage.setItem(
        OrderListComponent.FILTERS_KEY,
        JSON.stringify({
          search: this.search,
          status: this.status,
          paymentStatus: this.paymentStatus,
          brand: this.brand,
          technicianId: this.technicianId,
          onlyStale: this.onlyStale,
        }),
      );
    } catch {
      // localStorage no disponible (modo privado, cuota excedida, etc.): se ignora.
    }
  }

  protected isStale(order: RepairOrder): boolean {
    return this.ordersService.isStale(order.status, this.daysInStatusMap().get(order.id) ?? 0);
  }

  protected daysInStatus(order: RepairOrder): number {
    return this.daysInStatusMap().get(order.id) ?? 0;
  }

  protected isUpdating(orderId: string): boolean {
    return this.updatingIds().has(orderId);
  }

  async onQuickStatusChange(order: RepairOrder, newStatus: RepairStatus): Promise<void> {
    if (newStatus === order.status || this.isUpdating(order.id)) {
      return;
    }
    if (newStatus === 'entregado' && order.balanceDue > 0) {
      const confirmed = window.confirm(
        `Esta orden todavía tiene un saldo pendiente de ${new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
        }).format(order.balanceDue)}. ¿Marcar como entregada de todas formas?`,
      );
      if (!confirmed) {
        return;
      }
    }

    this.updatingIds.update((ids) => new Set(ids).add(order.id));
    try {
      const updated = await this.ordersService.changeStatus(order.id, newStatus, null);
      this.orders.update((list) => list.map((o) => (o.id === updated.id ? updated : o)));
      const days = await this.ordersService.getDaysInStatusMap([order.id]);
      this.daysInStatusMap.update((map) => {
        const next = new Map(map);
        next.set(order.id, days.get(order.id) ?? 0);
        return next;
      });
      this.toast.success(`${order.code}: estado actualizado a "${this.statusLabels[updated.status]}".`);
    } catch {
      this.toast.error('No se pudo actualizar el estado.');
    } finally {
      this.updatingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(order.id);
        return next;
      });
    }
  }

  async onTechnicianChange(order: RepairOrder, technicianId: string): Promise<void> {
    if (this.isUpdating(order.id)) return;
    this.updatingIds.update((ids) => new Set(ids).add(order.id));
    try {
      await this.ordersService.assignTechnician(order.id, technicianId || null);
      const technician = this.technicians().find((t) => t.id === technicianId);
      this.orders.update((list) => list.map((o) => o.id === order.id ? {
        ...o, assignedTechnicianId: technicianId || null,
        assignedTechnicianName: technician ? (technician.fullName || technician.email) : null,
      } : o));
      this.toast.success(`${order.code}: técnico actualizado.`);
    } catch {
      this.toast.error('No se pudo asignar el técnico.');
    } finally {
      this.updatingIds.update((ids) => { const next = new Set(ids); next.delete(order.id); return next; });
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      if (this.isServerPaged()) {
        const { orders: results, total } = await this.ordersService.listPage(
          { search: this.search, status: this.status, brand: this.brand, technicianId: this.technicianId },
          this.page(),
          this.pageSize,
        );
        this.orders.set(results);
        this.serverTotal.set(total);
        this.daysInStatusMap.set(await this.ordersService.getDaysInStatusMap(results.map((o) => o.id)));
      } else {
        const results = await this.ordersService.list({
          search: this.search,
          status: this.status,
          paymentStatus: this.paymentStatus,
          brand: this.brand,
          technicianId: this.technicianId,
        });
        this.orders.set(results);
        this.daysInStatusMap.set(await this.ordersService.getDaysInStatusMap(results.map((o) => o.id)));
      }
    } catch {
      this.toast.error('No se pudieron cargar las órdenes.');
    } finally {
      this.loading.set(false);
    }
  }
}
