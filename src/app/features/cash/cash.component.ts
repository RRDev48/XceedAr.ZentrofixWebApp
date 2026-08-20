import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CashService } from '../../core/services/cash.service';
import { RepairOrdersService } from '../../core/services/repair-orders.service';
import { CASH_MOVEMENT_LABELS, CashMovement, CashMovementType } from '../../models';
import { ToastService } from '../../shared/components/toast/toast.service';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-cash',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, CurrencyPipe],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Caja</h1>
          <p class="zf-subtitle">Ingresos, egresos y rentabilidad</p>
        </div>
      </div>

      <div class="zf-card filters-card">
        <div class="zf-grid-2">
          <div class="zf-field">
            <label for="dateFrom">Desde</label>
            <input id="dateFrom" type="date" class="zf-input" [(ngModel)]="dateFrom" (ngModelChange)="load()" />
          </div>
          <div class="zf-field">
            <label for="dateTo">Hasta</label>
            <input id="dateTo" type="date" class="zf-input" [(ngModel)]="dateTo" (ngModelChange)="load()" />
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando…</div>
      } @else {
        <div class="stat-row">
          <div class="zf-card stat">
            <span class="stat__label">Ingresos</span>
            <span class="stat__value">{{ totalIncome() | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}</span>
          </div>
          <div class="zf-card stat">
            <span class="stat__label">Egresos</span>
            <span class="stat__value">{{ totalExpense() | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}</span>
          </div>
          <div class="zf-card stat">
            <span class="stat__label">Resultado neto</span>
            <span class="stat__value" [class.stat__value--danger]="netResult() < 0">
              {{ netResult() | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}
            </span>
          </div>
          <div class="zf-card stat">
            <span class="stat__label">Margen de reparaciones</span>
            <span class="stat__value">{{ repairMargin() | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}</span>
          </div>
        </div>

        <section class="zf-card">
          <h2>Registrar movimiento manual</h2>
          <div class="movement-form">
            <select class="zf-select" [(ngModel)]="newType">
              @for (t of movementTypes; track t) {
                <option [value]="t">{{ movementLabels[t] }}</option>
              }
            </select>
            <input class="zf-input" type="number" min="0.01" step="0.01" [(ngModel)]="newAmount" placeholder="Importe" />
            <input class="zf-input" [(ngModel)]="newConcept" placeholder="Concepto (ej. Compra de insumos)" />
            <button type="button" class="zf-btn zf-btn--primary" [disabled]="registering()" (click)="registerManual()">
              @if (registering()) {
                <span class="zf-spinner"></span>
              }
              Registrar
            </button>
          </div>
          <p class="zf-hint zf-hint--block">
            Los pagos registrados desde una orden generan su ingreso en caja automáticamente. Usá este formulario solo
            para movimientos que no correspondan a una orden (compras, gastos del local, etc.).
          </p>
        </section>

        <section class="zf-card">
          <h2>Movimientos del período</h2>
          @if (movements().length === 0) {
            <div class="zf-empty">No hay movimientos en el rango seleccionado.</div>
          } @else {
            <div class="movement-list">
              @for (m of movements(); track m.id) {
                <div class="movement-item">
                  <span class="zf-badge" [class.zf-badge--danger]="m.movementType === 'egreso'">
                    {{ movementLabels[m.movementType] }}
                  </span>
                  <span class="movement-item__concept">{{ m.concept }}</span>
                  @if (m.repairOrderId) {
                    <a [routerLink]="['/ordenes', m.repairOrderId]" class="movement-item__link">Ver orden</a>
                  }
                  <span class="movement-item__date">{{ m.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                  <span class="movement-item__amount" [class.movement-item__amount--negative]="m.movementType === 'egreso'">
                    {{ m.movementType === 'egreso' ? '−' : '+' }}{{ m.amount | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}
                  </span>
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

      .filters-card {
        margin-bottom: 1rem;
      }

      .stat-row {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
        margin-bottom: 1.25rem;
      }

      @media (min-width: 700px) {
        .stat-row {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      .stat {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 1rem;
      }

      .stat__label {
        font-size: 0.75rem;
        color: var(--zf-text-muted);
        font-weight: 600;
      }

      .stat__value {
        font-family: var(--zf-font-heading);
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--zf-text);
      }

      .stat__value--danger {
        color: var(--zf-danger);
      }

      .zf-card h2 {
        font-size: 1rem;
        margin-bottom: 0.85rem;
      }

      .movement-form {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.6rem;
      }

      @media (min-width: 700px) {
        .movement-form {
          grid-template-columns: 1fr 0.7fr 1.5fr auto;
          align-items: center;
        }
      }

      .movement-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .movement-item {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.6rem;
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 0.65rem 0.85rem;
        font-size: 0.85rem;
      }

      .movement-item__concept {
        color: var(--zf-text);
      }

      .movement-item__link {
        font-size: 0.78rem;
      }

      .movement-item__date {
        color: var(--zf-text-muted);
        margin-left: auto;
        font-size: 0.78rem;
      }

      .movement-item__amount {
        font-weight: 700;
        color: var(--zf-blue);
      }

      .movement-item__amount--negative {
        color: var(--zf-danger);
      }
    `,
  ],
})
export class CashComponent implements OnInit {
  private readonly cashService = inject(CashService);
  private readonly ordersService = inject(RepairOrdersService);
  private readonly toast = inject(ToastService);

  protected readonly movements = signal<CashMovement[]>([]);
  protected readonly loading = signal(true);
  protected readonly registering = signal(false);
  protected readonly repairMargin = signal(0);
  protected readonly movementLabels = CASH_MOVEMENT_LABELS;
  protected readonly movementTypes: CashMovementType[] = ['ingreso', 'egreso'];

  protected dateFrom = todayIso();
  protected dateTo = todayIso();
  protected newType: CashMovementType = 'egreso';
  protected newAmount: number | null = null;
  protected newConcept = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  totalIncome(): number {
    return this.movements()
      .filter((m) => m.movementType === 'ingreso')
      .reduce((sum, m) => sum + m.amount, 0);
  }

  totalExpense(): number {
    return this.movements()
      .filter((m) => m.movementType === 'egreso')
      .reduce((sum, m) => sum + m.amount, 0);
  }

  netResult(): number {
    return this.totalIncome() - this.totalExpense();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const from = `${this.dateFrom}T00:00:00`;
      const to = `${this.dateTo}T23:59:59`;
      const [movements, orders] = await Promise.all([
        this.cashService.listBetween(from, to),
        this.ordersService.list({ dateFrom: from, dateTo: to }),
      ]);
      this.movements.set(movements);
      this.repairMargin.set(orders.reduce((sum, o) => sum + (o.customerPrice - o.internalCost - o.partsCost), 0));
    } catch {
      this.toast.error('No se pudo cargar la información de caja.');
    } finally {
      this.loading.set(false);
    }
  }

  async registerManual(): Promise<void> {
    if (this.registering() || !this.newAmount || this.newAmount <= 0 || !this.newConcept.trim()) {
      this.toast.error('Completá el importe y el concepto.');
      return;
    }
    this.registering.set(true);
    try {
      await this.cashService.registerManual({
        movementType: this.newType,
        amount: this.newAmount,
        concept: this.newConcept,
      });
      this.newAmount = null;
      this.newConcept = '';
      await this.load();
      this.toast.success('Movimiento registrado correctamente.');
    } catch {
      this.toast.error('No se pudo registrar el movimiento.');
    } finally {
      this.registering.set(false);
    }
  }
}
