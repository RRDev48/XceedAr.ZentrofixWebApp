import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { CashService } from '../../core/services/cash.service';
import { RepairOrdersService } from '../../core/services/repair-orders.service';
import { FeedbackEntry, FeedbackStats, OrderFeedbackService } from '../../core/services/order-feedback.service';
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_ORDER, RepairStatus } from '../../models';
import { ToastService } from '../../shared/components/toast/toast.service';

interface MonthRevenue {
  label: string;
  amount: number;
}

interface StatusCount {
  status: RepairStatus;
  count: number;
}

interface BrandCount {
  brand: string;
  count: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Reportes</h1>
          <p class="zf-subtitle">Vista general del negocio</p>
        </div>
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando reportes…</div>
      } @else {
        <section class="zf-card">
          <h2>Ingresos por mes (últimos 6 meses)</h2>
          <div class="bar-chart">
            @for (m of revenueByMonth(); track m.label) {
              <div class="bar-row">
                <span class="bar-row__label">{{ m.label }}</span>
                <div class="bar-row__track">
                  <div class="bar-row__fill" [style.width.%]="barWidth(m.amount, maxRevenue())"></div>
                </div>
                <span class="bar-row__value">{{ m.amount | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}</span>
              </div>
            }
          </div>
        </section>

        <section class="zf-card">
          <h2>Órdenes por estado</h2>
          <div class="status-grid">
            @for (s of statusCounts(); track s.status) {
              @if (s.count > 0) {
                <div class="status-chip">
                  <span class="status-chip__count">{{ s.count }}</span>
                  <span class="status-chip__label">{{ statusLabels[s.status] }}</span>
                </div>
              }
            }
          </div>
        </section>

        <section class="zf-card">
          <h2>Marcas más reparadas</h2>
          @if (topBrands().length === 0) {
            <p class="zf-hint">Todavía no hay suficientes datos.</p>
          } @else {
            <div class="bar-chart">
              @for (b of topBrands(); track b.brand) {
                <div class="bar-row">
                  <span class="bar-row__label">{{ b.brand }}</span>
                  <div class="bar-row__track">
                    <div class="bar-row__fill" [style.width.%]="barWidth(b.count, maxBrandCount())"></div>
                  </div>
                  <span class="bar-row__value">{{ b.count }}</span>
                </div>
              }
            </div>
          }
        </section>

        <section class="zf-card">
          <h2>Satisfacción de clientes</h2>
          @if (feedbackStats().count === 0) {
            <p class="zf-hint">Todavía no hay opiniones de clientes.</p>
          } @else {
            <div class="feedback-summary">
              <span class="feedback-summary__avg">{{ feedbackStats().average | number: '1.1-1' }} ★</span>
              <span class="feedback-summary__count">{{ feedbackStats().count }} opiniones</span>
            </div>
            <div class="feedback-list">
              @for (f of recentFeedback(); track f.id) {
                <div class="feedback-item">
                  <div class="feedback-item__top">
                    <strong>{{ f.orderCode }}</strong>
                    <span class="feedback-item__stars">{{ starsFor(f.rating) }}</span>
                    <small>{{ f.createdAt | date: 'dd/MM/yyyy' }}</small>
                  </div>
                  <div class="feedback-item__meta">{{ f.customerName }}</div>
                  @if (f.comment) {
                    <div class="feedback-item__comment">"{{ f.comment }}"</div>
                  }
                </div>
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

      .zf-card {
        margin-bottom: 1.25rem;
      }

      .zf-card h2 {
        font-size: 1rem;
        margin-bottom: 1rem;
      }

      .bar-chart {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }

      .bar-row {
        display: grid;
        grid-template-columns: 90px 1fr auto;
        align-items: center;
        gap: 0.65rem;
        font-size: 0.85rem;
      }

      .bar-row__label {
        color: var(--zf-text-secondary);
        text-transform: capitalize;
      }

      .bar-row__track {
        height: 10px;
        background: var(--zf-surface-2);
        border-radius: 999px;
        overflow: hidden;
      }

      .bar-row__fill {
        height: 100%;
        background: var(--zf-gradient);
        border-radius: 999px;
      }

      .bar-row__value {
        color: var(--zf-text);
        font-weight: 600;
        min-width: 60px;
        text-align: right;
      }

      .status-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      .status-chip {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: var(--zf-surface-2);
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 0.5rem 0.85rem;
        font-size: 0.82rem;
      }

      .status-chip__count {
        font-weight: 700;
        color: var(--zf-blue);
      }

      .status-chip__label {
        color: var(--zf-text-secondary);
      }

      .feedback-summary {
        display: flex;
        align-items: baseline;
        gap: 0.6rem;
        margin-bottom: 1rem;
      }

      .feedback-summary__avg {
        font-family: var(--zf-font-heading);
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--zf-blue);
      }

      .feedback-summary__count {
        color: var(--zf-text-muted);
        font-size: 0.85rem;
      }

      .feedback-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .feedback-item {
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 0.65rem 0.85rem;
      }

      .feedback-item__top {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
      }

      .feedback-item__stars {
        color: var(--zf-blue);
      }

      .feedback-item__top small {
        margin-left: auto;
        color: var(--zf-text-muted);
      }

      .feedback-item__meta {
        font-size: 0.78rem;
        color: var(--zf-text-muted);
        margin-top: 0.2rem;
      }

      .feedback-item__comment {
        font-size: 0.85rem;
        color: var(--zf-text-secondary);
        margin-top: 0.35rem;
        font-style: italic;
      }
    `,
  ],
})
export class ReportsComponent implements OnInit {
  private readonly cashService = inject(CashService);
  private readonly ordersService = inject(RepairOrdersService);
  private readonly feedbackService = inject(OrderFeedbackService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly revenueByMonth = signal<MonthRevenue[]>([]);
  protected readonly statusCounts = signal<StatusCount[]>([]);
  protected readonly topBrands = signal<BrandCount[]>([]);
  protected readonly feedbackStats = signal<FeedbackStats>({ average: 0, count: 0 });
  protected readonly recentFeedback = signal<FeedbackEntry[]>([]);
  protected readonly statusLabels = REPAIR_STATUS_LABELS;

  async ngOnInit(): Promise<void> {
    try {
      const now = new Date();
      const monthsAgo6 = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [movements, orders, feedbackStats, recentFeedback] = await Promise.all([
        this.cashService.listBetween(monthsAgo6.toISOString(), now.toISOString()),
        this.ordersService.list({}),
        this.feedbackService.getStats(),
        this.feedbackService.listRecent(10),
      ]);
      this.feedbackStats.set(feedbackStats);
      this.recentFeedback.set(recentFeedback);

      const months: MonthRevenue[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
        const amount = movements
          .filter((m) => m.movementType === 'ingreso')
          .filter((m) => {
            const md = new Date(m.createdAt);
            return md.getFullYear() === d.getFullYear() && md.getMonth() === d.getMonth();
          })
          .reduce((sum, m) => sum + m.amount, 0);
        months.push({ label, amount });
      }
      this.revenueByMonth.set(months);

      this.statusCounts.set(
        REPAIR_STATUS_ORDER.map((status) => ({
          status,
          count: orders.filter((o) => o.status === status).length,
        })),
      );

      const brandTally = new Map<string, number>();
      for (const order of orders) {
        const brand = (order.deviceLabel ?? '').split(' ')[0] || 'Otro';
        brandTally.set(brand, (brandTally.get(brand) ?? 0) + 1);
      }
      this.topBrands.set(
        [...brandTally.entries()]
          .map(([brand, count]) => ({ brand, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
      );
    } catch {
      this.toast.error('No se pudieron cargar los reportes.');
    } finally {
      this.loading.set(false);
    }
  }

  maxRevenue(): number {
    return Math.max(1, ...this.revenueByMonth().map((m) => m.amount));
  }

  maxBrandCount(): number {
    return Math.max(1, ...this.topBrands().map((b) => b.count));
  }

  barWidth(value: number, max: number): number {
    return max > 0 ? Math.max(3, (value / max) * 100) : 0;
  }

  starsFor(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }
}
