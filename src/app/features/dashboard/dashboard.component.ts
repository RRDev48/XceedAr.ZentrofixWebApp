import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardIndicators, DashboardService } from '../../core/services/dashboard.service';
import { RepairOrdersService } from '../../core/services/repair-orders.service';
import { RepairOrder, REPAIR_STATUS_LABELS } from '../../models';
import { ToastService } from '../../shared/components/toast/toast.service';

interface IndicatorCard {
  label: string;
  value: () => number | string;
  tone: 'blue' | 'green' | 'warning' | 'danger';
  routerLink?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Panel principal</h1>
          <p class="zf-subtitle">Estado general de Zentrofix</p>
        </div>
        <a routerLink="/ordenes/nueva" class="zf-btn zf-btn--primary">+ Nueva orden</a>
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando indicadores…</div>
      } @else {
        <div class="indicator-grid">
          @for (card of cards; track card.label) {
            <a [routerLink]="card.routerLink ?? null" class="indicator-card tone-{{ card.tone }}">
              <div class="indicator-card__value">{{ card.value() }}</div>
              <div class="indicator-card__label">{{ card.label }}</div>
            </a>
          }
        </div>

        <section class="zf-card recent-section">
          <div class="zf-page-header" style="margin-bottom: 0.75rem;">
            <h2 style="margin:0;">Reparaciones recientes</h2>
            <a routerLink="/ordenes" class="zf-btn zf-btn--ghost zf-btn--sm">Ver todas</a>
          </div>

          @if (recentOrders().length === 0) {
            <div class="zf-empty">Todavía no hay órdenes cargadas. Creá la primera desde "+ Nueva orden".</div>
          } @else {
            <div class="recent-list">
              @for (order of recentOrders(); track order.id) {
                <a [routerLink]="['/ordenes', order.id]" class="recent-item">
                  <div>
                    <div class="recent-item__code">{{ order.code }}</div>
                    <div class="recent-item__meta">{{ order.customerName }} · {{ order.deviceLabel }}</div>
                  </div>
                  <div class="recent-item__right">
                    <span class="zf-badge">{{ statusLabels[order.status] }}</span>
                    <small>{{ order.receivedAt | date: 'dd/MM/yyyy' }}</small>
                  </div>
                </a>
              }
            </div>
          }
        </section>
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

      .indicator-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.85rem;
        margin-bottom: 1.5rem;
      }

      @media (min-width: 640px) {
        .indicator-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      @media (min-width: 1000px) {
        .indicator-grid {
          grid-template-columns: repeat(5, 1fr);
        }
      }

      .indicator-card {
        background: var(--zf-surface);
        border: 1px solid var(--zf-border);
        border-radius: var(--zf-radius);
        box-shadow: var(--zf-shadow);
        padding: 1.1rem;
        text-decoration: none;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        border-left: 4px solid var(--zf-blue);
      }

      .indicator-card.tone-green {
        border-left-color: var(--zf-purple);
      }

      .indicator-card.tone-warning {
        border-left-color: var(--zf-purple);
      }

      .indicator-card.tone-danger {
        border-left-color: var(--zf-danger);
      }

      .indicator-card__value {
        font-family: var(--zf-font-heading);
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--zf-text);
      }

      .indicator-card__label {
        font-size: 0.78rem;
        color: var(--zf-text-muted);
        font-weight: 600;
      }

      .recent-section {
        padding: 1rem 1.1rem 1.25rem;
      }

      .recent-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .recent-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 0.6rem;
        border-radius: var(--zf-radius-sm);
        text-decoration: none;
        color: inherit;
        border: 1px solid var(--zf-border);
      }

      .recent-item:hover {
        background: var(--zf-surface-2);
      }

      .recent-item__code {
        font-weight: 700;
        color: var(--zf-text);
        font-size: 0.9rem;
      }

      .recent-item__meta {
        font-size: 0.8rem;
        color: var(--zf-text-muted);
      }

      .recent-item__right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.3rem;
      }

      .recent-item__right small {
        color: var(--zf-text-muted);
        font-size: 0.75rem;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly ordersService = inject(RepairOrdersService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly indicators = signal<DashboardIndicators | null>(null);
  protected readonly recentOrders = signal<RepairOrder[]>([]);
  protected readonly statusLabels = REPAIR_STATUS_LABELS;

  protected readonly cards: IndicatorCard[] = [
    {
      label: 'Pendientes de diagnóstico',
      value: () => this.indicators()?.pendingDiagnosis ?? 0,
      tone: 'blue',
      routerLink: '/ordenes',
    },
    { label: 'Presupuestos pendientes', value: () => this.indicators()?.pendingQuote ?? 0, tone: 'warning', routerLink: '/ordenes' },
    { label: 'En reparación', value: () => this.indicators()?.inRepair ?? 0, tone: 'blue', routerLink: '/ordenes' },
    { label: 'Esperando repuesto', value: () => this.indicators()?.waitingForPart ?? 0, tone: 'warning', routerLink: '/ordenes' },
    { label: 'Listos para entregar', value: () => this.indicators()?.readyForDelivery ?? 0, tone: 'green', routerLink: '/ordenes' },
    { label: 'Pendientes de pago', value: () => this.indicators()?.pendingPayment ?? 0, tone: 'danger', routerLink: '/ordenes' },
    { label: 'Entregados', value: () => this.indicators()?.delivered ?? 0, tone: 'green', routerLink: '/ordenes' },
    {
      label: 'Ingresos cobrados',
      value: () => this.formatCurrency(this.indicators()?.incomeCollected ?? 0),
      tone: 'green',
      routerLink: '/caja',
    },
    { label: 'Garantías activas', value: () => this.indicators()?.activeWarranties ?? 0, tone: 'blue' },
    { label: 'Stock crítico', value: () => this.indicators()?.criticalStock ?? 0, tone: 'danger', routerLink: '/inventario' },
  ];

  async ngOnInit(): Promise<void> {
    try {
      const [indicators, recent] = await Promise.all([
        this.dashboardService.getIndicators(),
        this.ordersService.listRecent(8),
      ]);
      this.indicators.set(indicators);
      this.recentOrders.set(recent);
    } catch (err) {
      this.toast.error('No se pudieron cargar los indicadores del panel.');
    } finally {
      this.loading.set(false);
    }
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
      value,
    );
  }
}
