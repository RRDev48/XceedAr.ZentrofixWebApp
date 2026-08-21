import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CustomersService } from '../../core/services/customers.service';
import { DevicesService } from '../../core/services/devices.service';
import { InventoryService } from '../../core/services/inventory.service';
import { Customer, Device, InventoryItem } from '../../models';
import { ToastService } from '../../shared/components/toast/toast.service';

type TrashTab = 'clientes' | 'equipos' | 'inventario';

@Component({
  selector: 'app-trash',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Papelera</h1>
          <p class="zf-subtitle">Clientes, equipos e ítems de inventario eliminados</p>
        </div>
      </div>

      <div class="tabs">
        @for (t of tabs; track t.value) {
          <button
            type="button"
            class="tab"
            [class.tab--active]="activeTab() === t.value"
            (click)="activeTab.set(t.value)"
          >
            {{ t.label }}
          </button>
        }
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando…</div>
      } @else if (activeTab() === 'clientes') {
        @if (deletedCustomers().length === 0) {
          <div class="zf-empty zf-card">No hay clientes eliminados.</div>
        } @else {
          <div class="entry-list">
            @for (c of deletedCustomers(); track c.id) {
              <div class="zf-card entry-card">
                <div>
                  <strong>{{ c.firstName }} {{ c.lastName }}</strong>
                  <div class="entry-card__meta">{{ c.whatsappPhone }} · eliminado {{ c.deletedAt | date: 'dd/MM/yyyy' }}</div>
                </div>
                <button type="button" class="zf-btn zf-btn--primary zf-btn--sm" [disabled]="restoringId() === c.id" (click)="restoreCustomer(c)">
                  Restaurar
                </button>
              </div>
            }
          </div>
        }
      } @else if (activeTab() === 'equipos') {
        @if (deletedDevices().length === 0) {
          <div class="zf-empty zf-card">No hay equipos eliminados.</div>
        } @else {
          <div class="entry-list">
            @for (d of deletedDevices(); track d.id) {
              <div class="zf-card entry-card">
                <div>
                  <strong>{{ d.brand }} {{ d.model }}</strong>
                  <div class="entry-card__meta">{{ d.imeiOrSerial || 'sin IMEI/serie' }} · eliminado {{ d.deletedAt | date: 'dd/MM/yyyy' }}</div>
                </div>
                <button type="button" class="zf-btn zf-btn--primary zf-btn--sm" [disabled]="restoringId() === d.id" (click)="restoreDevice(d)">
                  Restaurar
                </button>
              </div>
            }
          </div>
        }
      } @else {
        @if (deletedItems().length === 0) {
          <div class="zf-empty zf-card">No hay ítems de inventario eliminados.</div>
        } @else {
          <div class="entry-list">
            @for (i of deletedItems(); track i.id) {
              <div class="zf-card entry-card">
                <div>
                  <strong>{{ i.name }}</strong>
                  <div class="entry-card__meta">{{ i.sku || 'sin SKU' }} · eliminado {{ i.deletedAt | date: 'dd/MM/yyyy' }}</div>
                </div>
                <button type="button" class="zf-btn zf-btn--primary zf-btn--sm" [disabled]="restoringId() === i.id" (click)="restoreItem(i)">
                  Restaurar
                </button>
              </div>
            }
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

      .tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.1rem;
        border-bottom: 1px solid var(--zf-border-soft);
      }

      .tab {
        background: none;
        border: none;
        color: var(--zf-text-muted);
        font-size: 0.88rem;
        font-weight: 600;
        padding: 0.6rem 0.2rem;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        font-family: inherit;
      }

      .tab--active {
        color: var(--zf-blue);
        border-bottom-color: var(--zf-blue);
      }

      .entry-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .entry-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.85rem 1rem;
      }

      .entry-card__meta {
        font-size: 0.8rem;
        color: var(--zf-text-muted);
        margin-top: 0.15rem;
      }
    `,
  ],
})
export class TrashComponent implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly devicesService = inject(DevicesService);
  private readonly inventoryService = inject(InventoryService);
  private readonly toast = inject(ToastService);

  protected readonly tabs: Array<{ value: TrashTab; label: string }> = [
    { value: 'clientes', label: 'Clientes' },
    { value: 'equipos', label: 'Equipos' },
    { value: 'inventario', label: 'Inventario' },
  ];

  protected readonly activeTab = signal<TrashTab>('clientes');
  protected readonly loading = signal(true);
  protected readonly deletedCustomers = signal<Customer[]>([]);
  protected readonly deletedDevices = signal<Device[]>([]);
  protected readonly deletedItems = signal<InventoryItem[]>([]);
  protected readonly restoringId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [customers, devices, items] = await Promise.all([
        this.customersService.listDeleted(),
        this.devicesService.listDeleted(),
        this.inventoryService.listDeleted(),
      ]);
      this.deletedCustomers.set(customers);
      this.deletedDevices.set(devices);
      this.deletedItems.set(items);
    } catch {
      this.toast.error('No se pudo cargar la papelera.');
    } finally {
      this.loading.set(false);
    }
  }

  async restoreCustomer(customer: Customer): Promise<void> {
    if (this.restoringId()) return;
    this.restoringId.set(customer.id);
    try {
      await this.customersService.restore(customer.id);
      this.deletedCustomers.update((list) => list.filter((c) => c.id !== customer.id));
      this.toast.success('Cliente restaurado.');
    } catch {
      this.toast.error('No se pudo restaurar el cliente.');
    } finally {
      this.restoringId.set(null);
    }
  }

  async restoreDevice(device: Device): Promise<void> {
    if (this.restoringId()) return;
    this.restoringId.set(device.id);
    try {
      await this.devicesService.restore(device.id);
      this.deletedDevices.update((list) => list.filter((d) => d.id !== device.id));
      this.toast.success('Equipo restaurado.');
    } catch {
      this.toast.error('No se pudo restaurar el equipo.');
    } finally {
      this.restoringId.set(null);
    }
  }

  async restoreItem(item: InventoryItem): Promise<void> {
    if (this.restoringId()) return;
    this.restoringId.set(item.id);
    try {
      await this.inventoryService.restore(item.id);
      this.deletedItems.update((list) => list.filter((i) => i.id !== item.id));
      this.toast.success('Ítem restaurado.');
    } catch {
      this.toast.error('No se pudo restaurar el ítem.');
    } finally {
      this.restoringId.set(null);
    }
  }
}
