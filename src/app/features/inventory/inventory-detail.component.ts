import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InventoryService } from '../../core/services/inventory.service';
import { INVENTORY_MOVEMENT_LABELS, InventoryItem, InventoryMovement, InventoryMovementType } from '../../models';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-inventory-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, CurrencyPipe],
  template: `
    <div class="zf-page">
      @if (loading()) {
        <div class="zf-empty">Cargando…</div>
      } @else if (!item()) {
        <div class="zf-empty zf-card">No se encontró el ítem solicitado.</div>
      } @else {
        <div class="zf-page-header">
          <div>
            <h1>{{ item()!.name }}</h1>
            <p class="zf-subtitle">{{ item()!.sku || 'sin SKU' }}</p>
          </div>
          <div class="header-actions">
            <a [routerLink]="['/inventario', item()!.id, 'editar']" class="zf-btn zf-btn--ghost">Editar</a>
            <button
              type="button"
              class="zf-btn zf-btn--ghost zf-btn--danger"
              [disabled]="deleting()"
              (click)="deleteItem()"
            >
              Eliminar
            </button>
          </div>
        </div>

        <div class="stat-row">
          <div class="zf-card stat">
            <span class="stat__label">Stock actual</span>
            <span class="stat__value" [class.stat__value--low]="item()!.stockQuantity <= item()!.minimumStock">
              {{ item()!.stockQuantity }}
            </span>
          </div>
          <div class="zf-card stat">
            <span class="stat__label">Stock mínimo</span>
            <span class="stat__value">{{ item()!.minimumStock }}</span>
          </div>
          <div class="zf-card stat">
            <span class="stat__label">Costo unitario</span>
            <span class="stat__value">{{ item()!.unitCost | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}</span>
          </div>
          <div class="zf-card stat">
            <span class="stat__label">Precio de venta</span>
            <span class="stat__value">{{ item()!.unitPrice | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}</span>
          </div>
        </div>

        <section class="zf-card">
          <h2>Registrar movimiento</h2>
          <div class="movement-form">
            <select class="zf-select" [(ngModel)]="movementType">
              @for (t of movementTypes; track t) {
                <option [value]="t">{{ movementLabels[t] }}</option>
              }
            </select>
            <input class="zf-input" type="number" min="1" step="1" [(ngModel)]="movementQuantity" placeholder="Cantidad" />
            <input class="zf-input" [(ngModel)]="movementNote" placeholder="Nota (opcional)" />
            <button type="button" class="zf-btn zf-btn--primary" [disabled]="registering()" (click)="registerMovement()">
              @if (registering()) {
                <span class="zf-spinner"></span>
              }
              Registrar
            </button>
          </div>
        </section>

        <section class="zf-card">
          <h2>Historial de movimientos</h2>
          @if (movements().length === 0) {
            <p class="zf-hint">Todavía no hay movimientos registrados.</p>
          } @else {
            <div class="movement-list">
              @for (m of movements(); track m.id) {
                <div class="movement-item">
                  <span class="movement-item__type">{{ movementLabels[m.movementType] }}</span>
                  <span class="movement-item__qty">{{ m.movementType === 'ingreso' || m.movementType === 'ajuste' ? '+' : '−' }}{{ m.quantity }}</span>
                  <span class="movement-item__date">{{ m.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                  @if (m.note) {
                    <span class="movement-item__note">{{ m.note }}</span>
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

      .header-actions {
        display: flex;
        gap: 0.5rem;
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

      .stat__value--low {
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
          grid-template-columns: 1.2fr 0.7fr 1.5fr auto;
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
        gap: 0.6rem;
        align-items: center;
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 0.65rem 0.85rem;
        font-size: 0.85rem;
      }

      .movement-item__type {
        font-weight: 600;
        color: var(--zf-text);
      }

      .movement-item__qty {
        font-weight: 700;
        color: var(--zf-blue);
      }

      .movement-item__date {
        color: var(--zf-text-muted);
        margin-left: auto;
      }

      .movement-item__note {
        color: var(--zf-text-muted);
        width: 100%;
      }
    `,
  ],
})
export class InventoryDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);
  private readonly toast = inject(ToastService);

  protected readonly item = signal<InventoryItem | null>(null);
  protected readonly movements = signal<InventoryMovement[]>([]);
  protected readonly loading = signal(true);
  protected readonly registering = signal(false);
  protected readonly deleting = signal(false);
  protected readonly movementLabels = INVENTORY_MOVEMENT_LABELS;
  protected readonly movementTypes: InventoryMovementType[] = ['ingreso', 'egreso', 'ajuste'];

  protected movementType: InventoryMovementType = 'ingreso';
  protected movementQuantity: number | null = null;
  protected movementNote = '';

  private itemId = '';

  async ngOnInit(): Promise<void> {
    this.itemId = this.route.snapshot.paramMap.get('id') ?? '';
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [item, movements] = await Promise.all([
        this.inventoryService.getById(this.itemId),
        this.inventoryService.listMovements(this.itemId),
      ]);
      this.item.set(item);
      this.movements.set(movements);
    } catch {
      this.toast.error('No se pudo cargar el ítem.');
    } finally {
      this.loading.set(false);
    }
  }

  async registerMovement(): Promise<void> {
    if (this.registering() || !this.movementQuantity || this.movementQuantity <= 0) {
      this.toast.error('Ingresá una cantidad válida.');
      return;
    }
    this.registering.set(true);
    try {
      await this.inventoryService.registerMovement(this.itemId, this.movementType, this.movementQuantity, this.movementNote);
      this.movementQuantity = null;
      this.movementNote = '';
      await this.load();
      this.toast.success('Movimiento registrado correctamente.');
    } catch {
      this.toast.error('No se pudo registrar el movimiento.');
    } finally {
      this.registering.set(false);
    }
  }

  async deleteItem(): Promise<void> {
    if (this.deleting()) {
      return;
    }
    const confirmed = window.confirm('¿Eliminar este ítem de inventario? Vas a poder restaurarlo luego desde Papelera.');
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    try {
      await this.inventoryService.remove(this.itemId);
      this.toast.success('Ítem eliminado.');
      await this.router.navigate(['/inventario']);
    } catch {
      this.toast.error('No se pudo eliminar el ítem.');
    } finally {
      this.deleting.set(false);
    }
  }
}
