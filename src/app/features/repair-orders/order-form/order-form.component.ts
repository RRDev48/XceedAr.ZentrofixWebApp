import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomersService } from '../../../core/services/customers.service';
import { DevicesService } from '../../../core/services/devices.service';
import { RepairOrdersService } from '../../../core/services/repair-orders.service';
import {
  Customer,
  CustomerMatch,
  Device,
  DeviceType,
  DEVICE_TYPE_LABELS,
  RepairOrder,
  RepairPriority,
  REPAIR_PRIORITY_LABELS,
} from '../../../models';
import { argentinePhoneValidator, dniValidator, imeiOrSerialValidator } from '../../../shared/validators/custom-validators';
import { firstErrorMessage } from '../../../shared/utils/form-errors.util';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { CanComponentDeactivate } from '../../../core/guards/unsaved-changes.guard';

type WizardStep = 'cliente' | 'equipo' | 'orden';

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="zf-page zf-page--narrow">
      <div class="zf-page-header">
        <h1>{{ originalOrder() ? 'Nuevo reingreso' : 'Nueva orden de reparación' }}</h1>
      </div>

      @if (originalOrder()) {
        <div class="reingreso-banner">
          Reingreso de la orden <strong>{{ originalOrder()!.code }}</strong> — el cliente y el equipo ya están
          precargados.
        </div>
      }

      <div class="steps">
        <span class="step" [class.is-active]="step() === 'cliente'" [class.is-done]="!!selectedCustomer()">1. Cliente</span>
        <span class="step" [class.is-active]="step() === 'equipo'" [class.is-done]="!!selectedDevice()">2. Equipo</span>
        <span class="step" [class.is-active]="step() === 'orden'">3. Orden</span>
      </div>

      @if (step() === 'cliente') {
        <div class="zf-card">
          <div class="mode-toggle">
            <button
              type="button"
              class="zf-btn zf-btn--sm"
              [class.zf-btn--primary]="customerMode() === 'buscar'"
              [class.zf-btn--ghost]="customerMode() !== 'buscar'"
              (click)="customerMode.set('buscar')"
            >
              Buscar cliente existente
            </button>
            <button
              type="button"
              class="zf-btn zf-btn--sm"
              [class.zf-btn--primary]="customerMode() === 'nuevo'"
              [class.zf-btn--ghost]="customerMode() !== 'nuevo'"
              (click)="customerMode.set('nuevo')"
            >
              Cliente nuevo
            </button>
          </div>

          @if (customerMode() === 'buscar') {
            <div class="zf-field">
              <label for="customerSearch">Buscar por nombre, WhatsApp o DNI</label>
              <input
                id="customerSearch"
                class="zf-input"
                [(ngModel)]="customerSearch"
                [ngModelOptions]="{ standalone: true }"
                (ngModelChange)="onCustomerSearchChange()"
                placeholder="Escribí para buscar…"
              />
            </div>

            @if (customerResults().length > 0) {
              <div class="result-list">
                @for (c of customerResults(); track c.id) {
                  <button type="button" class="result-item" (click)="pickCustomer(c)">
                    <strong>{{ c.firstName }} {{ c.lastName }}</strong>
                    <span>{{ c.whatsappPhone }}</span>
                  </button>
                }
              </div>
            } @else if (customerSearch.trim().length > 1) {
              <p class="zf-hint">No se encontraron clientes. Podés cargarlo como "Cliente nuevo".</p>
            }
          } @else {
            <form [formGroup]="customerForm" (ngSubmit)="createCustomer()" novalidate>
              <div class="zf-grid-2">
                <div class="zf-field">
                  <label for="firstName">Nombre *</label>
                  <input id="firstName" class="zf-input" formControlName="firstName" (blur)="checkDuplicates()" />
                  @if (customerForm.controls.firstName.invalid && customerForm.controls.firstName.touched) {
                    <span class="zf-error">{{ firstErrorMessage(customerForm.controls.firstName.errors) }}</span>
                  }
                </div>
                <div class="zf-field">
                  <label for="lastName">Apellido *</label>
                  <input id="lastName" class="zf-input" formControlName="lastName" (blur)="checkDuplicates()" />
                  @if (customerForm.controls.lastName.invalid && customerForm.controls.lastName.touched) {
                    <span class="zf-error">{{ firstErrorMessage(customerForm.controls.lastName.errors) }}</span>
                  }
                </div>
              </div>
              <div class="zf-grid-2">
                <div class="zf-field">
                  <label for="whatsappPhone">WhatsApp *</label>
                  <input
                    id="whatsappPhone"
                    class="zf-input"
                    formControlName="whatsappPhone"
                    placeholder="341 5123456"
                    (blur)="checkDuplicates()"
                  />
                  @if (customerForm.controls.whatsappPhone.invalid && customerForm.controls.whatsappPhone.touched) {
                    <span class="zf-error">{{ firstErrorMessage(customerForm.controls.whatsappPhone.errors) }}</span>
                  }
                </div>
                <div class="zf-field">
                  <label for="dni">DNI</label>
                  <input id="dni" class="zf-input" formControlName="dni" (blur)="checkDuplicates()" />
                </div>
              </div>

              @if (duplicates().length > 0) {
                <div class="duplicate-warning">
                  ⚠️ Ya existe{{ duplicates().length > 1 ? 'n' : '' }} un cliente con ese teléfono o DNI:
                  @for (d of duplicates(); track d.id) {
                    <button type="button" class="link-btn" (click)="pickCustomer(d)">
                      {{ d.firstName }} {{ d.lastName }}
                    </button>
                  }
                </div>
              }

              <button type="submit" class="zf-btn zf-btn--primary" [disabled]="savingCustomer()">
                @if (savingCustomer()) {
                  <span class="zf-spinner"></span>
                }
                Guardar y continuar
              </button>
            </form>
          }
        </div>
      }

      @if (step() === 'equipo' && selectedCustomer()) {
        <div class="zf-card">
          <p class="selected-line">
            Cliente: <strong>{{ selectedCustomer()!.firstName }} {{ selectedCustomer()!.lastName }}</strong>
            <button type="button" class="link-btn" (click)="step.set('cliente')">cambiar</button>
          </p>

          <div class="mode-toggle">
            <button
              type="button"
              class="zf-btn zf-btn--sm"
              [class.zf-btn--primary]="deviceMode() === 'existente'"
              [class.zf-btn--ghost]="deviceMode() !== 'existente'"
              (click)="deviceMode.set('existente')"
            >
              Equipo existente
            </button>
            <button
              type="button"
              class="zf-btn zf-btn--sm"
              [class.zf-btn--primary]="deviceMode() === 'nuevo'"
              [class.zf-btn--ghost]="deviceMode() !== 'nuevo'"
              (click)="deviceMode.set('nuevo')"
            >
              Equipo nuevo
            </button>
          </div>

          @if (deviceMode() === 'existente') {
            @if (customerDevices().length === 0) {
              <p class="zf-hint">Este cliente no tiene equipos cargados todavía. Usá "Equipo nuevo".</p>
            } @else {
              <div class="result-list">
                @for (d of customerDevices(); track d.id) {
                  <button type="button" class="result-item" (click)="pickDevice(d)">
                    <strong>{{ d.brand }} {{ d.model }}</strong>
                    <span>{{ deviceTypeLabels[d.deviceType] }}</span>
                  </button>
                }
              </div>
            }
          } @else {
            <form [formGroup]="deviceForm" (ngSubmit)="createDevice()" novalidate>
              <div class="zf-grid-2">
                <div class="zf-field">
                  <label for="deviceType">Tipo *</label>
                  <select id="deviceType" class="zf-select" formControlName="deviceType">
                    @for (type of deviceTypes; track type) {
                      <option [value]="type">{{ deviceTypeLabels[type] }}</option>
                    }
                  </select>
                </div>
                <div class="zf-field">
                  <label for="color">Color</label>
                  <input id="color" class="zf-input" formControlName="color" />
                </div>
              </div>
              <div class="zf-grid-2">
                <div class="zf-field">
                  <label for="brand">Marca *</label>
                  <input id="brand" class="zf-input" formControlName="brand" />
                  @if (deviceForm.controls.brand.invalid && deviceForm.controls.brand.touched) {
                    <span class="zf-error">{{ firstErrorMessage(deviceForm.controls.brand.errors) }}</span>
                  }
                </div>
                <div class="zf-field">
                  <label for="model">Modelo *</label>
                  <input id="model" class="zf-input" formControlName="model" />
                  @if (deviceForm.controls.model.invalid && deviceForm.controls.model.touched) {
                    <span class="zf-error">{{ firstErrorMessage(deviceForm.controls.model.errors) }}</span>
                  }
                </div>
              </div>
              <div class="zf-field">
                <label for="imeiOrSerial">IMEI o número de serie</label>
                <input id="imeiOrSerial" class="zf-input" formControlName="imeiOrSerial" />
                @if (deviceForm.controls.imeiOrSerial.invalid && deviceForm.controls.imeiOrSerial.touched) {
                  <span class="zf-error">{{ firstErrorMessage(deviceForm.controls.imeiOrSerial.errors) }}</span>
                }
              </div>
              <div class="zf-field">
                <label for="accessDetail">Contraseña, PIN o patrón de prueba</label>
                <input id="accessDetail" class="zf-input" formControlName="accessDetail" autocomplete="off" />
              </div>
              <div class="zf-field">
                <label for="accessories">Accesorios entregados</label>
                <input id="accessories" class="zf-input" formControlName="accessories" />
              </div>
              <div class="zf-field">
                <label for="physicalConditionIn">Estado físico al recibir</label>
                <textarea id="physicalConditionIn" class="zf-textarea" formControlName="physicalConditionIn"></textarea>
              </div>

              <button type="submit" class="zf-btn zf-btn--primary" [disabled]="savingDevice()">
                @if (savingDevice()) {
                  <span class="zf-spinner"></span>
                }
                Guardar y continuar
              </button>
            </form>
          }
        </div>
      }

      @if (step() === 'orden' && selectedCustomer() && selectedDevice()) {
        <div class="zf-card">
          <p class="selected-line">
            {{ selectedCustomer()!.firstName }} {{ selectedCustomer()!.lastName }} —
            {{ selectedDevice()!.brand }} {{ selectedDevice()!.model }}
            <button type="button" class="link-btn" (click)="step.set('equipo')">cambiar</button>
          </p>

          <form [formGroup]="orderForm" (ngSubmit)="submitOrder()" novalidate>
            <div class="zf-field">
              <label for="reportedFault">Falla declarada por el cliente *</label>
              <textarea id="reportedFault" class="zf-textarea" formControlName="reportedFault"></textarea>
              @if (orderForm.controls.reportedFault.invalid && orderForm.controls.reportedFault.touched) {
                <span class="zf-error">{{ firstErrorMessage(orderForm.controls.reportedFault.errors) }}</span>
              }
            </div>

            <div class="zf-field">
              <label for="receptionNotes">Observaciones de recepción</label>
              <textarea id="receptionNotes" class="zf-textarea" formControlName="receptionNotes"></textarea>
            </div>

            <div class="zf-grid-2">
              <div class="zf-field">
                <label for="priority">Prioridad</label>
                <select id="priority" class="zf-select" formControlName="priority">
                  @for (p of priorities; track p) {
                    <option [value]="p">{{ priorityLabels[p] }}</option>
                  }
                </select>
              </div>
              <div class="zf-field">
                <label for="estimatedCompletionDate">Fecha estimada de finalización</label>
                <input id="estimatedCompletionDate" type="date" class="zf-input" formControlName="estimatedCompletionDate" />
              </div>
            </div>

            <div class="form-actions">
              <a routerLink="/ordenes" class="zf-btn zf-btn--ghost">Cancelar</a>
              <button type="submit" class="zf-btn zf-btn--primary" [disabled]="savingOrder()">
                @if (savingOrder()) {
                  <span class="zf-spinner"></span>
                }
                Crear orden
              </button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .zf-page--narrow {
        max-width: 720px;
      }

      .reingreso-banner {
        background: var(--zf-purple-soft);
        border: 1px solid rgba(156, 44, 255, 0.35);
        color: var(--zf-text-secondary);
        border-radius: var(--zf-radius-sm);
        padding: 0.75rem 0.9rem;
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }

      .steps {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }

      .step {
        font-size: 0.78rem;
        font-weight: 600;
        padding: 0.4rem 0.75rem;
        border-radius: 999px;
        background: var(--zf-surface-2);
        color: var(--zf-text-muted);
      }

      .step.is-active {
        background: var(--zf-blue-soft);
        color: var(--zf-blue);
      }

      .step.is-done {
        background: var(--zf-purple-soft);
        color: #c589ff;
      }

      .mode-toggle {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
      }

      .result-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .result-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        text-align: left;
        border: 1px solid var(--zf-border);
        border-radius: var(--zf-radius-sm);
        padding: 0.75rem;
        background: var(--zf-surface-2);
        color: var(--zf-text);
        cursor: pointer;
        font-size: 0.9rem;
      }

      .result-item:hover {
        background: var(--zf-blue-soft);
        border-color: var(--zf-blue);
      }

      .result-item span {
        color: var(--zf-text-muted);
      }

      .selected-line {
        margin: 0 0 1rem;
        font-size: 0.92rem;
      }

      .link-btn {
        background: none;
        border: none;
        color: var(--zf-blue);
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
        padding: 0;
        margin-left: 0.35rem;
        font-size: 0.85rem;
      }

      .duplicate-warning {
        background: var(--zf-purple-soft);
        color: var(--zf-text-secondary);
        border: 1px solid rgba(156, 44, 255, 0.35);
        border-radius: var(--zf-radius-sm);
        padding: 0.75rem 0.9rem;
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.5rem;
      }
    `,
  ],
})
export class OrderFormComponent implements OnInit, CanComponentDeactivate {
  private readonly fb = inject(FormBuilder);
  private readonly customersService = inject(CustomersService);
  private readonly devicesService = inject(DevicesService);
  private readonly ordersService = inject(RepairOrdersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly firstErrorMessage = firstErrorMessage;
  protected readonly deviceTypeLabels = DEVICE_TYPE_LABELS;
  protected readonly deviceTypes: DeviceType[] = ['celular', 'tablet', 'notebook', 'consola', 'otro'];
  protected readonly priorityLabels = REPAIR_PRIORITY_LABELS;
  protected readonly priorities: RepairPriority[] = ['baja', 'normal', 'alta', 'urgente'];

  protected readonly step = signal<WizardStep>('cliente');
  protected readonly customerMode = signal<'buscar' | 'nuevo'>('buscar');
  protected readonly deviceMode = signal<'existente' | 'nuevo'>('existente');

  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly selectedDevice = signal<Device | null>(null);
  protected readonly customerResults = signal<CustomerMatch[]>([]);
  protected readonly customerDevices = signal<Device[]>([]);
  protected readonly duplicates = signal<CustomerMatch[]>([]);

  protected readonly savingCustomer = signal(false);
  protected readonly savingDevice = signal(false);
  protected readonly savingOrder = signal(false);

  protected customerSearch = '';
  private searchTimeout?: ReturnType<typeof setTimeout>;
  private orderCreated = false;

  protected readonly originalOrder = signal<RepairOrder | null>(null);
  private originalOrderId: string | null = null;

  protected readonly customerForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    whatsappPhone: ['', [Validators.required, argentinePhoneValidator()]],
    dni: ['', [dniValidator()]],
  });

  protected readonly deviceForm = this.fb.nonNullable.group({
    deviceType: ['celular' as DeviceType, [Validators.required]],
    brand: ['', [Validators.required, Validators.minLength(2)]],
    model: ['', [Validators.required]],
    color: [''],
    imeiOrSerial: ['', [imeiOrSerialValidator()]],
    accessDetail: [''],
    accessories: [''],
    physicalConditionIn: [''],
  });

  protected readonly orderForm = this.fb.nonNullable.group({
    reportedFault: ['', [Validators.required, Validators.minLength(4)]],
    receptionNotes: [''],
    priority: ['normal' as RepairPriority, [Validators.required]],
    estimatedCompletionDate: [''],
  });

  async ngOnInit(): Promise<void> {
    const preselectedCustomerId = this.route.snapshot.queryParamMap.get('clienteId');
    if (preselectedCustomerId) {
      const customer = await this.customersService.getById(preselectedCustomerId);
      if (customer) {
        await this.pickCustomer(customer);
      }
      return;
    }

    const originalOrderId = this.route.snapshot.paramMap.get('originalOrderId');
    if (!originalOrderId) {
      return;
    }
    this.originalOrderId = originalOrderId;
    const original = await this.ordersService.getById(originalOrderId);
    if (!original) {
      this.toast.error('No se encontró la orden original del reingreso.');
      return;
    }
    this.originalOrder.set(original);

    const [customer, device] = await Promise.all([
      this.customersService.getById(original.customerId),
      this.devicesService.getById(original.deviceId),
    ]);
    if (customer) {
      await this.pickCustomer(customer);
    }
    if (device) {
      this.pickDevice(device);
    }
    this.orderForm.patchValue({
      receptionNotes: `Reingreso de la orden ${original.code}.`,
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.orderCreated && (!!this.selectedCustomer() || this.customerForm.dirty || this.orderForm.dirty);
  }

  onCustomerSearchChange(): void {
    clearTimeout(this.searchTimeout);
    if (this.customerSearch.trim().length < 2) {
      this.customerResults.set([]);
      return;
    }
    this.searchTimeout = setTimeout(async () => {
      const results = await this.customersService.list(this.customerSearch);
      this.customerResults.set(results);
    }, 250);
  }

  async checkDuplicates(): Promise<void> {
    const { whatsappPhone, dni } = this.customerForm.getRawValue();
    if (!whatsappPhone && !dni) {
      this.duplicates.set([]);
      return;
    }
    try {
      const matches = await this.customersService.findPossibleDuplicates(whatsappPhone, dni || null);
      this.duplicates.set(matches);
    } catch {
      // No bloquea el flujo si falla la verificación.
    }
  }

  async pickCustomer(customer: Customer | CustomerMatch): Promise<void> {
    const full = 'createdAt' in customer ? (customer as Customer) : await this.customersService.getById(customer.id);
    if (!full) {
      return;
    }
    this.selectedCustomer.set(full);
    this.customerDevices.set(await this.devicesService.listByCustomer(full.id));
    this.step.set('equipo');
  }

  async createCustomer(): Promise<void> {
    if (this.savingCustomer()) {
      return;
    }
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }
    this.savingCustomer.set(true);
    try {
      const value = this.customerForm.getRawValue();
      const customer = await this.customersService.create({
        firstName: value.firstName,
        lastName: value.lastName,
        whatsappPhone: value.whatsappPhone,
        dni: value.dni || null,
        email: null,
        address: null,
        notes: null,
      });
      this.toast.success('Cliente creado correctamente.');
      await this.pickCustomer(customer);
    } catch {
      this.toast.error('No se pudo crear el cliente.');
    } finally {
      this.savingCustomer.set(false);
    }
  }

  pickDevice(device: Device): void {
    this.selectedDevice.set(device);
    this.step.set('orden');
  }

  async createDevice(): Promise<void> {
    if (this.savingDevice()) {
      return;
    }
    if (this.deviceForm.invalid || !this.selectedCustomer()) {
      this.deviceForm.markAllAsTouched();
      return;
    }
    this.savingDevice.set(true);
    try {
      const value = this.deviceForm.getRawValue();
      const device = await this.devicesService.create({
        customerId: this.selectedCustomer()!.id,
        deviceType: value.deviceType,
        brand: value.brand,
        model: value.model,
        color: value.color || null,
        imeiOrSerial: value.imeiOrSerial || null,
        accessDetail: value.accessDetail || null,
        accessories: value.accessories || null,
        physicalConditionIn: value.physicalConditionIn || null,
        notes: null,
      });
      this.toast.success('Equipo registrado correctamente.');
      this.pickDevice(device);
    } catch {
      this.toast.error('No se pudo registrar el equipo.');
    } finally {
      this.savingDevice.set(false);
    }
  }

  async submitOrder(): Promise<void> {
    if (this.savingOrder()) {
      return;
    }
    if (this.orderForm.invalid || !this.selectedCustomer() || !this.selectedDevice()) {
      this.orderForm.markAllAsTouched();
      return;
    }
    this.savingOrder.set(true);
    try {
      const value = this.orderForm.getRawValue();
      const order = await this.ordersService.create({
        customerId: this.selectedCustomer()!.id,
        deviceId: this.selectedDevice()!.id,
        reportedFault: value.reportedFault,
        receptionNotes: value.receptionNotes || null,
        priority: value.priority,
        estimatedCompletionDate: value.estimatedCompletionDate || null,
        relatedOrderId: this.originalOrderId,
      });
      this.orderCreated = true;
      this.toast.success(`Orden ${order.code} creada correctamente.`);
      await this.router.navigate(['/ordenes', order.id]);
    } catch {
      this.toast.error('No se pudo crear la orden. Intentá nuevamente.');
    } finally {
      this.savingOrder.set(false);
    }
  }
}
