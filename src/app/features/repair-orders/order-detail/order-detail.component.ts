import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RepairOrdersService } from '../../../core/services/repair-orders.service';
import { WhatsappService } from '../../../core/services/whatsapp.service';
import {
  COMMUNICATION_TEMPLATE_LABELS,
  CommunicationTemplateType,
  PAYMENT_STATUS_LABELS,
  RepairOrder,
  RepairPriority,
  REPAIR_PRIORITY_LABELS,
  RepairStatus,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_ORDER,
  RepairStatusHistoryEntry,
} from '../../../models';
import { positiveAmountValidator } from '../../../shared/validators/custom-validators';
import { firstErrorMessage } from '../../../shared/utils/form-errors.util';
import { ToastService } from '../../../shared/components/toast/toast.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, FormsModule, DatePipe, CurrencyPipe],
  template: `
    <div class="zf-page">
      @if (loading()) {
        <div class="zf-empty">Cargando orden…</div>
      } @else if (!order()) {
        <div class="zf-empty zf-card">No se encontró la orden solicitada.</div>
      } @else {
        <div class="zf-page-header">
          <div>
            <h1>{{ order()!.code }}</h1>
            <p class="zf-subtitle">
              <a [routerLink]="['/clientes', order()!.customerId]">{{ order()!.customerName }}</a>
              · {{ order()!.deviceLabel }}
            </p>
          </div>
          <div class="badges">
            <span class="zf-badge">{{ statusLabels[order()!.status] }}</span>
            <span class="zf-badge zf-badge--muted">{{ priorityLabels[order()!.priority] }}</span>
            <span class="zf-badge" [class.zf-badge--green]="paymentStatus() === 'pagado_total'">
              {{ paymentStatusLabels[paymentStatus()] }}
            </span>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-col">
            <section class="zf-card">
              <h2>Recepción</h2>
              <p><strong>Ingreso:</strong> {{ order()!.receivedAt | date: 'dd/MM/yyyy HH:mm' }}</p>
              <p><strong>Falla declarada:</strong> {{ order()!.reportedFault }}</p>
              @if (order()!.receptionNotes) {
                <p><strong>Observaciones de recepción:</strong> {{ order()!.receptionNotes }}</p>
              }
              @if (order()!.estimatedCompletionDate) {
                <p><strong>Fecha estimada:</strong> {{ order()!.estimatedCompletionDate | date: 'dd/MM/yyyy' }}</p>
              }
            </section>

            <section class="zf-card">
              <h2>Diagnóstico, costos y pagos</h2>
              <form [formGroup]="detailsForm" (ngSubmit)="saveDetails()" novalidate>
                <div class="zf-field">
                  <label for="technicalDiagnosis">Diagnóstico técnico</label>
                  <textarea id="technicalDiagnosis" class="zf-textarea" formControlName="technicalDiagnosis"></textarea>
                </div>
                <div class="zf-field">
                  <label for="recommendedWork">Trabajo recomendado</label>
                  <textarea id="recommendedWork" class="zf-textarea" formControlName="recommendedWork"></textarea>
                </div>

                <div class="zf-grid-2">
                  <div class="zf-field">
                    <label for="partsCost">Costo de repuestos</label>
                    <input id="partsCost" type="number" min="0" step="0.01" class="zf-input" formControlName="partsCost" />
                  </div>
                  <div class="zf-field">
                    <label for="laborCost">Mano de obra</label>
                    <input id="laborCost" type="number" min="0" step="0.01" class="zf-input" formControlName="laborCost" />
                  </div>
                </div>
                <div class="zf-grid-2">
                  <div class="zf-field">
                    <label for="internalCost">Costo interno (uso interno)</label>
                    <input id="internalCost" type="number" min="0" step="0.01" class="zf-input" formControlName="internalCost" />
                    <span class="zf-hint">Nunca se muestra ni se envía al cliente.</span>
                  </div>
                  <div class="zf-field">
                    <label for="customerPrice">Precio al cliente</label>
                    <input id="customerPrice" type="number" min="0" step="0.01" class="zf-input" formControlName="customerPrice" />
                  </div>
                </div>
                <div class="zf-grid-2">
                  <div class="zf-field">
                    <label for="discount">Descuento</label>
                    <input id="discount" type="number" min="0" step="0.01" class="zf-input" formControlName="discount" />
                  </div>
                  <div class="zf-field">
                    <label for="deposit">Seña</label>
                    <input id="deposit" type="number" min="0" step="0.01" class="zf-input" formControlName="deposit" />
                  </div>
                </div>

                <div class="totals-row">
                  <span>Total: <strong>{{ order()!.total | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                  <span>Saldo pendiente: <strong>{{ order()!.balanceDue | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                </div>

                <div class="zf-field">
                  <label for="internalNotes">Observaciones internas</label>
                  <textarea id="internalNotes" class="zf-textarea" formControlName="internalNotes"></textarea>
                  <span class="zf-hint">Uso interno: nunca se incluye en los mensajes al cliente.</span>
                </div>

                <button type="submit" class="zf-btn zf-btn--primary" [disabled]="savingDetails()">
                  @if (savingDetails()) {
                    <span class="zf-spinner"></span>
                  }
                  Guardar cambios
                </button>
              </form>
            </section>
          </div>

          <div class="detail-col">
            <section class="zf-card">
              <h2>Cambiar estado</h2>
              <div class="zf-field">
                <label for="newStatus">Nuevo estado</label>
                <select id="newStatus" class="zf-select" [(ngModel)]="newStatus" [ngModelOptions]="{ standalone: true }">
                  @for (s of statusOrder; track s) {
                    <option [value]="s">{{ statusLabels[s] }}</option>
                  }
                </select>
              </div>
              <div class="zf-field">
                <label for="statusNote">Nota (opcional)</label>
                <textarea
                  id="statusNote"
                  class="zf-textarea"
                  [(ngModel)]="statusNote"
                  [ngModelOptions]="{ standalone: true }"
                ></textarea>
              </div>
              <button
                type="button"
                class="zf-btn zf-btn--primary"
                [disabled]="changingStatus() || newStatus === order()!.status"
                (click)="changeStatus()"
              >
                @if (changingStatus()) {
                  <span class="zf-spinner"></span>
                }
                Actualizar estado
              </button>

              @if (history().length > 0) {
                <div class="history-list">
                  @for (h of history(); track h.id) {
                    <div class="history-item">
                      <div class="history-item__status">{{ statusLabels[h.toStatus] }}</div>
                      <div class="history-item__date">{{ h.changedAt | date: 'dd/MM/yyyy HH:mm' }}</div>
                      @if (h.note) {
                        <div class="history-item__note">{{ h.note }}</div>
                      }
                    </div>
                  }
                </div>
              }
            </section>

            <section class="zf-card">
              <h2>WhatsApp</h2>
              <div class="zf-field">
                <label for="template">Plantilla</label>
                <select
                  id="template"
                  class="zf-select"
                  [(ngModel)]="selectedTemplate"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="regenerateMessage()"
                >
                  @for (t of templateTypes; track t) {
                    <option [value]="t">{{ templateLabels[t] }}</option>
                  }
                </select>
              </div>
              <div class="zf-field">
                <label for="messagePreview">Mensaje (podés editarlo antes de abrir WhatsApp)</label>
                <textarea
                  id="messagePreview"
                  class="zf-textarea"
                  rows="5"
                  [(ngModel)]="messageText"
                  [ngModelOptions]="{ standalone: true }"
                ></textarea>
              </div>
              @if (!whatsappLink()) {
                <p class="zf-error">El teléfono del cliente no es válido para WhatsApp. Revisá el dato en la ficha del cliente.</p>
              } @else {
                <a
                  [href]="whatsappLink()!"
                  target="_blank"
                  rel="noopener"
                  class="zf-btn zf-btn--whatsapp"
                  (click)="onWhatsAppOpen()"
                >
                  Abrir WhatsApp
                </a>
              }
              <p class="zf-hint zf-hint--block">
                El sistema solo registra que el mensaje fue preparado y que se abrió WhatsApp: el envío real lo hacés vos
                desde el WhatsApp oficial de Zentrofix.
              </p>
            </section>
          </div>
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

      .zf-subtitle a {
        color: var(--zf-blue);
        text-decoration: none;
        font-weight: 600;
      }

      .badges {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.25rem;
      }

      @media (min-width: 1000px) {
        .detail-grid {
          grid-template-columns: 1.3fr 1fr;
          align-items: start;
        }
      }

      .detail-col {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .zf-card h2 {
        font-size: 1rem;
        margin-bottom: 0.85rem;
      }

      .zf-card p {
        font-size: 0.9rem;
        margin: 0 0 0.5rem;
      }

      .totals-row {
        display: flex;
        justify-content: space-between;
        background: var(--zf-blue-light);
        border-radius: var(--zf-radius-sm);
        padding: 0.75rem 0.9rem;
        font-size: 0.88rem;
        margin-bottom: 1rem;
        color: var(--zf-blue-darker);
      }

      .history-list {
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        border-top: 1px solid var(--zf-border);
        padding-top: 0.85rem;
      }

      .history-item {
        font-size: 0.85rem;
      }

      .history-item__status {
        font-weight: 700;
        color: var(--zf-blue-darker);
      }

      .history-item__date {
        color: var(--zf-text-muted);
        font-size: 0.78rem;
      }

      .history-item__note {
        color: var(--zf-text-muted);
        margin-top: 0.15rem;
      }

      .zf-hint--block {
        display: block;
        margin-top: 0.75rem;
      }
    `,
  ],
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ordersService = inject(RepairOrdersService);
  private readonly whatsappService = inject(WhatsappService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly firstErrorMessage = firstErrorMessage;
  protected readonly statusLabels = REPAIR_STATUS_LABELS;
  protected readonly statusOrder = REPAIR_STATUS_ORDER;
  protected readonly priorityLabels = REPAIR_PRIORITY_LABELS;
  protected readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;
  protected readonly templateLabels = COMMUNICATION_TEMPLATE_LABELS;
  protected readonly templateTypes = Object.keys(COMMUNICATION_TEMPLATE_LABELS) as CommunicationTemplateType[];

  protected readonly order = signal<RepairOrder | null>(null);
  protected readonly history = signal<RepairStatusHistoryEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly savingDetails = signal(false);
  protected readonly changingStatus = signal(false);
  protected readonly paymentStatus = signal<'sin_pago' | 'senia' | 'pagado_parcial' | 'pagado_total'>('sin_pago');

  protected newStatus: RepairStatus = 'recibido';
  protected statusNote = '';
  protected selectedTemplate: CommunicationTemplateType = 'consulta_estado';
  protected messageText = '';
  private orderId = '';

  protected readonly detailsForm = this.fb.nonNullable.group({
    technicalDiagnosis: [''],
    recommendedWork: [''],
    partsCost: [0, [positiveAmountValidator()]],
    laborCost: [0, [positiveAmountValidator()]],
    internalCost: [0, [positiveAmountValidator()]],
    customerPrice: [0, [positiveAmountValidator()]],
    discount: [0, [positiveAmountValidator()]],
    deposit: [0, [positiveAmountValidator()]],
    internalNotes: [''],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.orderId = id;
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [order, history] = await Promise.all([
        this.ordersService.getById(this.orderId),
        this.ordersService.getStatusHistory(this.orderId),
      ]);
      this.order.set(order);
      this.history.set(history);
      if (order) {
        this.newStatus = order.status;
        this.paymentStatus.set(this.ordersService.paymentStatusOf(order));
        this.detailsForm.patchValue({
          technicalDiagnosis: order.technicalDiagnosis ?? '',
          recommendedWork: order.recommendedWork ?? '',
          partsCost: order.partsCost,
          laborCost: order.laborCost,
          internalCost: order.internalCost,
          customerPrice: order.customerPrice,
          discount: order.discount,
          deposit: order.deposit,
          internalNotes: order.internalNotes ?? '',
        });
        this.regenerateMessage();
      }
    } catch {
      this.toast.error('No se pudo cargar la orden.');
    } finally {
      this.loading.set(false);
    }
  }

  regenerateMessage(): void {
    const order = this.order();
    if (!order) {
      return;
    }
    this.messageText = this.whatsappService.buildMessage(order, this.selectedTemplate);
  }

  whatsappLink(): string | null {
    const order = this.order();
    if (!order) {
      return null;
    }
    return this.whatsappService.buildLink(order, this.messageText);
  }

  async onWhatsAppOpen(): Promise<void> {
    const order = this.order();
    if (!order) {
      return;
    }
    try {
      await this.whatsappService.logPrepared(order, this.selectedTemplate, this.messageText, true);
      this.toast.success('Se abrió WhatsApp con el mensaje preparado.');
    } catch {
      this.toast.error('El mensaje se abrió en WhatsApp, pero no se pudo registrar en el sistema.');
    }
  }

  async saveDetails(): Promise<void> {
    if (this.savingDetails() || this.detailsForm.invalid || !this.order()) {
      this.detailsForm.markAllAsTouched();
      return;
    }
    this.savingDetails.set(true);
    try {
      const value = this.detailsForm.getRawValue();
      const updated = await this.ordersService.updateDetails(this.orderId, {
        reportedFault: this.order()!.reportedFault,
        receptionNotes: this.order()!.receptionNotes,
        technicalDiagnosis: value.technicalDiagnosis || null,
        recommendedWork: value.recommendedWork || null,
        priority: this.order()!.priority,
        estimatedCompletionDate: this.order()!.estimatedCompletionDate,
        partsCost: Number(value.partsCost) || 0,
        laborCost: Number(value.laborCost) || 0,
        internalCost: Number(value.internalCost) || 0,
        customerPrice: Number(value.customerPrice) || 0,
        discount: Number(value.discount) || 0,
        deposit: Number(value.deposit) || 0,
        internalNotes: value.internalNotes || null,
      });
      this.order.set(updated);
      this.paymentStatus.set(this.ordersService.paymentStatusOf(updated));
      this.toast.success('Cambios guardados correctamente.');
    } catch {
      this.toast.error('No se pudieron guardar los cambios.');
    } finally {
      this.savingDetails.set(false);
    }
  }

  async changeStatus(): Promise<void> {
    if (this.changingStatus() || !this.order()) {
      return;
    }
    this.changingStatus.set(true);
    try {
      const updated = await this.ordersService.changeStatus(this.orderId, this.newStatus, this.statusNote || null);
      this.order.set(updated);
      this.history.set(await this.ordersService.getStatusHistory(this.orderId));
      this.statusNote = '';
      this.toast.success(`Estado actualizado a "${this.statusLabels[updated.status]}".`);
    } catch {
      this.toast.error('No se pudo actualizar el estado.');
    } finally {
      this.changingStatus.set(false);
    }
  }
}
