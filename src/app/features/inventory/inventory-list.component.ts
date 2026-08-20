import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { InventoryService } from '../../core/services/inventory.service';
import { InventoryItem } from '../../models';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [FormsModule, RouterLink, CurrencyPipe],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Inventario</h1>
          <p class="zf-subtitle">{{ items().length }} repuestos / insumos registrados</p>
        </div>
        <a routerLink="/inventario/nuevo" class="zf-btn zf-btn--primary">+ Nuevo ítem</a>
      </div>

      <div class="zf-card search-card">
        <input
          class="zf-input"
          type="search"
          placeholder="Buscar por nombre o SKU…"
          [(ngModel)]="search"
          (ngModelChange)="onSearchChange()"
        />
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando inventario…</div>
      } @else if (items().length === 0) {
        <div class="zf-empty zf-card">No se encontraron ítems con ese criterio.</div>
      } @else {
        <div class="card-list">
          @for (item of items(); track item.id) {
            <a [routerLink]="['/inventario', item.id]" class="zf-card item-card">
              <div class="item-card__main">
                <div class="item-card__name">{{ item.name }}</div>
                <div class="item-card__meta">
                  {{ item.sku || 'sin SKU' }} · Costo {{ item.unitCost | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }} ·
                  Precio {{ item.unitPrice | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}
                </div>
              </div>
              <div class="item-card__stock" [class.item-card__stock--low]="item.stockQuantity <= item.minimumStock">
                <strong>{{ item.stockQuantity }}</strong>
                <small>mín. {{ item.minimumStock }}</small>
              </div>
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

      .search-card {
        margin-bottom: 1rem;
        padding: 0.75rem;
      }

      .card-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .item-card {
        text-decoration: none;
        color: inherit;
        padding: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
      }

      .item-card__name {
        font-weight: 700;
        color: var(--zf-text);
      }

      .item-card__meta {
        font-size: 0.8rem;
        color: var(--zf-text-muted);
        margin-top: 0.2rem;
      }

      .item-card__stock {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        color: var(--zf-text);
        font-size: 1.1rem;
      }

      .item-card__stock small {
        font-size: 0.7rem;
        color: var(--zf-text-muted);
      }

      .item-card__stock--low strong {
        color: var(--zf-danger);
      }
    `,
  ],
})
export class InventoryListComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<InventoryItem[]>([]);
  protected readonly loading = signal(true);
  protected search = '';
  private searchTimeout?: ReturnType<typeof setTimeout>;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.load(), 300);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.items.set(await this.inventoryService.list(this.search));
    } catch {
      this.toast.error('No se pudo cargar el inventario.');
    } finally {
      this.loading.set(false);
    }
  }
}
