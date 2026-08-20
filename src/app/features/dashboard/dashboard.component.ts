import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardIndicators, DashboardService } from '../../core/services/dashboard.service';
import { RepairOrdersService } from '../../core/services/repair-orders.service';
import { RepairOrder, REPAIR_STATUS_LABELS } from '../../models';
import { ToastService } from '../../shared/components/toast/toast.service';

interface HeroCard {
  label: string;
  icon: string;
  value: () => string;
  routerLink?: string;
  variant: 'hero' | 'alert';
  isAlert?: () => boolean;
}

interface FlowCard {
  label: string;
  icon: string;
  value: () => number;
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
        <div class="hero-row">
          @for (card of heroCards; track card.label) {
            <a
              [routerLink]="card.routerLink ?? null"
              class="hero-card"
              [class.hero-card--gradient]="card.variant === 'hero'"
              [class.hero-card--alert]="card.variant === 'alert' && card.isAlert!()"
              [class.hero-card--quiet]="card.variant === 'alert' && !card.isAlert!()"
            >
              <span class="hero-card__icon">{{ card.icon }}</span>
              <div>
                <div class="hero-card__value">{{ card.value() }}</div>
                <div class="hero-card__label">{{ card.label }}</div>
              </div>
            </a>
          }
        </div>

        <h2 class="flow-title">Flujo de reparaciones</h2>
        <div class="flow-grid">
          @for (card of flowCards; track card.label) {
            <a [routerLink]="card.routerLink ?? null" class="flow-card">
              <span class="flow-card__icon">{{ card.icon }}</span>
              <div class="flow-card__value">{{ card.value() }}</div>
              <div class="flow-card__label">{{ card.label }}</div>
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
                  <span class="recent-item__dot" [class.recent-item__dot--done]="order.status === 'entregado'"></span>
                  <div class="recent-item__main">
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

      /* ---------- Hero row ---------- */

      .hero-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.85rem;
        margin-bottom: 1.75rem;
      }

      @media (min-width: 720px) {
        .hero-row {
          grid-template-columns: 1.4fr 1fr 1fr;
        }
      }

      .hero-card {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        border-radius: var(--zf-radius);
        padding: 1.25rem;
        text-decoration: none;
        background: var(--zf-surface);
        border: 1px solid var(--zf-border-soft);
        box-shadow: var(--zf-shadow);
      }

      .hero-card__icon {
        font-size: 1.8rem;
        line-height: 1;
      }

      .hero-card__value {
        font-family: var(--zf-font-heading);
        font-size: 1.7rem;
        font-weight: 700;
        color: var(--zf-text);
        line-height: 1.15;
      }

      .hero-card__label {
        font-size: 0.8rem;
        color: var(--zf-text-muted);
        font-weight: 600;
        margin-top: 0.15rem;
      }

      .hero-card--gradient {
        background: var(--zf-gradient);
        border-color: transparent;
      }

      .hero-card--gradient .hero-card__value,
      .hero-card--gradient .hero-card__label {
        color: #fff;
      }

      .hero-card--gradient .hero-card__label {
        opacity: 0.85;
      }

      .hero-card--alert {
        border-color: rgba(255, 107, 107, 0.4);
        background: var(--zf-danger-soft);
      }

      .hero-card--alert .hero-card__value {
        color: var(--zf-danger);
      }

      .hero-card--quiet {
        opacity: 0.7;
      }

      /* ---------- Flow grid ---------- */

      .flow-title {
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--zf-text-muted);
        margin: 0 0 0.75rem;
      }

      .flow-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.7rem;
        margin-bottom: 1.75rem;
      }

      @media (min-width: 640px) {
        .flow-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      @media (min-width: 1000px) {
        .flow-grid {
          grid-template-columns: repeat(7, 1fr);
        }
      }

      .flow-card {
        background: var(--zf-surface);
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 0.9rem 0.75rem;
        text-decoration: none;
        text-align: center;
        transition: border-color 0.15s ease, transform 0.05s ease;
      }

      .flow-card:hover {
        border-color: var(--zf-blue);
      }

      .flow-card__icon {
        font-size: 1.15rem;
        display: block;
        margin-bottom: 0.35rem;
      }

      .flow-card__value {
        font-family: var(--zf-font-heading);
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--zf-text);
      }

      .flow-card__label {
        font-size: 0.72rem;
        color: var(--zf-text-muted);
        font-weight: 600;
        margin-top: 0.15rem;
        line-height: 1.25;
      }

      /* ---------- Recent list ---------- */

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
        align-items: center;
        gap: 0.7rem;
        padding: 0.75rem 0.85rem;
        border-radius: var(--zf-radius-sm);
        text-decoration: none;
        color: inherit;
        border: 1px solid var(--zf-border-soft);
      }

      .recent-item:hover {
        background: var(--zf-surface-2);
      }

      .recent-item__dot {
        width: 8px;
        height: 8px;
        min-width: 8px;
        border-radius: 50%;
        background: var(--zf-blue);
      }

      .recent-item__dot--done {
        background: var(--zf-purple);
      }

      .recent-item__main {
        flex: 1;
        min-width: 0;
      }

      .recent-item__code {
        font-weight: 700;
        color: var(--zf-text);
        font-size: 0.9rem;
      }

      .recent-item__meta {
        font-size: 0.8rem;
        color: var(--zf-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .recent-item__right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.3rem;
        flex-shrink: 0;
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

  protected readonly heroCards: HeroCard[] = [
    {
      label: 'Ingresos cobrados',
      icon: '💰',
      value: () => this.formatCurrency(this.indicators()?.incomeCollected ?? 0),
      routerLink: '/caja',
      variant: 'hero',
    },
    {
      label: 'Pendientes de pago',
      icon: '💳',
      value: () => String(this.indicators()?.pendingPayment ?? 0),
      routerLink: '/ordenes',
      variant: 'alert',
      isAlert: () => (this.indicators()?.pendingPayment ?? 0) > 0,
    },
    {
      label: 'Stock crítico',
      icon: '📦',
      value: () => String(this.indicators()?.criticalStock ?? 0),
      routerLink: '/inventario',
      variant: 'alert',
      isAlert: () => (this.indicators()?.criticalStock ?? 0) > 0,
    },
  ];

  protected readonly flowCards: FlowCard[] = [
    {
      label: 'Pendientes de diagnóstico',
      icon: '🔍',
      value: () => this.indicators()?.pendingDiagnosis ?? 0,
      routerLink: '/ordenes',
    },
    {
      label: 'Presupuestos pendientes',
      icon: '📋',
      value: () => this.indicators()?.pendingQuote ?? 0,
      routerLink: '/ordenes',
    },
    { label: 'En reparación', icon: '🔧', value: () => this.indicators()?.inRepair ?? 0, routerLink: '/ordenes' },
    {
      label: 'Esperando repuesto',
      icon: '⏳',
      value: () => this.indicators()?.waitingForPart ?? 0,
      routerLink: '/ordenes',
    },
    {
      label: 'Listos para entregar',
      icon: '✅',
      value: () => this.indicators()?.readyForDelivery ?? 0,
      routerLink: '/ordenes',
    },
    { label: 'Entregados', icon: '📤', value: () => this.indicators()?.delivered ?? 0, routerLink: '/ordenes' },
    {
      label: 'Garantías activas',
      icon: '🛡️',
      value: () => this.indicators()?.activeWarranties ?? 0,
    },
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
