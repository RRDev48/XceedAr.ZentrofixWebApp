import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { CustomersService } from '../../../core/services/customers.service';
import { DevicesService } from '../../../core/services/devices.service';
import { RepairOrdersService } from '../../../core/services/repair-orders.service';
import { Customer, Device, DEVICE_TYPE_LABELS, RepairOrder, REPAIR_STATUS_LABELS } from '../../../models';
import { ToastService } from '../../../shared/components/toast/toast.service';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe],
  template: `
    <div class="zf-page">
      @if (loading()) {
        <div class="zf-empty">Cargando cliente…</div>
      } @else if (!customer()) {
        <div class="zf-empty zf-card">No se encontró el cliente solicitado.</div>
      } @else {
        <div class="zf-page-header">
          <div>
            <h1>{{ customer()!.firstName }} {{ customer()!.lastName }}</h1>
            <p class="zf-subtitle">Cliente desde {{ customer()!.createdAt | date: 'dd/MM/yyyy' }}</p>
          </div>
          <div class="header-actions">
            <a [routerLink]="['/clientes', customer()!.id, 'editar']" class="zf-btn zf-btn--ghost">Editar</a>
            <button
              type="button"
              class="zf-btn zf-btn--ghost zf-btn--danger"
              [disabled]="deleting()"
              (click)="deleteCustomer()"
            >
              Eliminar
            </button>
          </div>
        </div>

        <div class="lifetime-stats">
          <div class="lifetime-stat">
            <div class="lifetime-stat__value">{{ totalRepairs() }}</div>
            <div class="lifetime-stat__label">Reparaciones</div>
          </div>
          <div class="lifetime-stat">
            <div class="lifetime-stat__value">{{ totalSpent() | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}</div>
            <div class="lifetime-stat__label">Total gastado</div>
          </div>
        </div>

        <div class="zf-card info-card">
          <div class="info-row"><strong>WhatsApp:</strong> {{ customer()!.whatsappPhone }}</div>
          @if (customer()!.dni) {
            <div class="info-row"><strong>DNI:</strong> {{ customer()!.dni }}</div>
          }
          @if (customer()!.email) {
            <div class="info-row"><strong>Correo:</strong> {{ customer()!.email }}</div>
          }
          @if (customer()!.address) {
            <div class="info-row"><strong>Dirección:</strong> {{ customer()!.address }}</div>
          }
          @if (customer()!.notes) {
            <div class="info-row"><strong>Observaciones:</strong> {{ customer()!.notes }}</div>
          }
        </div>

        <div class="section-header">
          <h2>Equipos</h2>
          <a [routerLink]="['/clientes', customer()!.id, 'equipos', 'nuevo']" class="zf-btn zf-btn--primary zf-btn--sm">
            + Equipo
          </a>
        </div>

        @if (devices().length === 0) {
          <div class="zf-empty zf-card">Este cliente todavía no tiene equipos registrados.</div>
        } @else {
          <div class="card-list">
            @for (d of devices(); track d.id) {
              <a [routerLink]="['/equipos', d.id, 'editar']" class="zf-card device-card">
                <div class="device-card__title">{{ d.brand }} {{ d.model }}</div>
                <div class="device-card__meta">{{ deviceTypeLabels[d.deviceType] }} · {{ d.color || 'sin color' }}</div>
                @if (d.imeiOrSerial) {
                  <div class="device-card__meta">IMEI/Serie: {{ d.imeiOrSerial }}</div>
                }
              </a>
            }
          </div>
        }

        <div class="section-header">
          <h2>Historial de reparaciones</h2>
        </div>

        @if (orders().length === 0) {
          <div class="zf-empty zf-card">Este cliente todavía no tiene órdenes de reparación.</div>
        } @else {
          <div class="card-list">
            @for (o of orders(); track o.id) {
              <a [routerLink]="['/ordenes', o.id]" class="zf-card order-card">
                <div>
                  <div class="order-card__code">{{ o.code }}</div>
                  <div class="order-card__meta">{{ o.deviceLabel }}</div>
                </div>
                <span class="zf-badge">{{ statusLabels[o.status] }}</span>
              </a>
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

      .header-actions {
        display: flex;
        gap: 0.5rem;
      }

      .lifetime-stats {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
      }

      .lifetime-stat {
        flex: 1;
        background: var(--zf-surface);
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 0.85rem 1rem;
        box-shadow: var(--zf-shadow);
      }

      .lifetime-stat__value {
        font-family: var(--zf-font-heading);
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--zf-text);
      }

      .lifetime-stat__label {
        font-size: 0.78rem;
        color: var(--zf-text-muted);
        font-weight: 600;
        margin-top: 0.15rem;
      }

      .info-card {
        margin-bottom: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .info-row {
        font-size: 0.92rem;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 1.5rem 0 0.75rem;
      }

      .section-header h2 {
        margin: 0;
        font-size: 1.05rem;
      }

      .card-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .device-card,
      .order-card {
        text-decoration: none;
        color: inherit;
        padding: 1rem;
      }

      .order-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .device-card__title,
      .order-card__code {
        font-weight: 700;
        color: var(--zf-text);
      }

      .device-card__meta,
      .order-card__meta {
        font-size: 0.82rem;
        color: var(--zf-text-muted);
      }
    `,
  ],
})
export class CustomerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customersService = inject(CustomersService);
  private readonly devicesService = inject(DevicesService);
  private readonly ordersService = inject(RepairOrdersService);
  private readonly toast = inject(ToastService);

  protected readonly customer = signal<Customer | null>(null);
  protected readonly devices = signal<Device[]>([]);
  protected readonly orders = signal<RepairOrder[]>([]);
  protected readonly loading = signal(true);
  protected readonly deleting = signal(false);
  protected readonly deviceTypeLabels = DEVICE_TYPE_LABELS;
  protected readonly statusLabels = REPAIR_STATUS_LABELS;

  protected readonly totalRepairs = computed(() => this.orders().length);
  protected readonly totalSpent = computed(() =>
    this.orders().reduce((sum, o) => sum + Math.max(0, o.total - o.balanceDue), 0),
  );

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    try {
      const [customer, devices, orders] = await Promise.all([
        this.customersService.getById(id),
        this.devicesService.listByCustomer(id),
        this.ordersService.listByCustomer(id),
      ]);
      this.customer.set(customer);
      this.devices.set(devices);
      this.orders.set(orders);
    } catch {
      this.toast.error('No se pudo cargar la información del cliente.');
    } finally {
      this.loading.set(false);
    }
  }

  async deleteCustomer(): Promise<void> {
    const customer = this.customer();
    if (!customer || this.deleting()) {
      return;
    }
    const confirmed = window.confirm(
      `¿Eliminar a ${customer.firstName} ${customer.lastName}? Vas a poder restaurarlo luego desde Papelera.`,
    );
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    try {
      await this.customersService.remove(customer.id);
      this.toast.success('Cliente eliminado.');
      await this.router.navigate(['/clientes']);
    } catch {
      this.toast.error('No se pudo eliminar el cliente.');
    } finally {
      this.deleting.set(false);
    }
  }
}
