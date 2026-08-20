import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RepairOrdersService } from '../../../core/services/repair-orders.service';
import { WhatsappService } from '../../../core/services/whatsapp.service';
import { QuotesService } from '../../../core/services/quotes.service';
import { PaymentsService } from '../../../core/services/payments.service';
import { WarrantiesService } from '../../../core/services/warranties.service';
import { AttachmentsService } from '../../../core/services/attachments.service';
import { ReceiptService } from '../../../core/services/receipt.service';
import {
  Attachment,
  AttachmentCategory,
  ATTACHMENT_CATEGORY_LABELS,
  COMMUNICATION_TEMPLATE_LABELS,
  CommunicationTemplateType,
  Payment,
  PaymentMethod,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  Quote,
  QuoteApprovalStatus,
  QUOTE_APPROVAL_LABELS,
  RepairOrder,
  RepairPriority,
  REPAIR_PRIORITY_LABELS,
  RepairStatus,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_ORDER,
  RepairStatusHistoryEntry,
  Warranty,
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
              <div class="section-header">
                <h2>Presupuestos</h2>
                <a [routerLink]="['/ordenes', order()!.id, 'presupuestos', 'nuevo']" class="zf-btn zf-btn--ghost zf-btn--sm">
                  + Nuevo
                </a>
              </div>

              @if (quotes().length === 0) {
                <p class="zf-hint">Todavía no hay presupuestos cargados para esta orden.</p>
              } @else {
                <div class="quote-list">
                  @for (q of quotes(); track q.id) {
                    <div class="quote-item">
                      <div class="quote-item__top">
                        <span class="quote-item__total">{{ q.total | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</span>
                        <span
                          class="zf-badge"
                          [class.zf-badge--green]="q.approvalStatus === 'aprobado'"
                          [class.zf-badge--danger]="q.approvalStatus === 'rechazado'"
                        >
                          {{ quoteStatusLabels[q.approvalStatus] }}
                        </span>
                      </div>
                      <div class="quote-item__meta">
                        {{ q.items.length }} ítem(s) · creado {{ q.createdAt | date: 'dd/MM/yyyy' }}
                        @if (q.validUntil) {
                          · vigente hasta {{ q.validUntil | date: 'dd/MM/yyyy' }}
                        }
                      </div>

                      <div class="quote-item__actions">
                        <a
                          [routerLink]="['/ordenes', order()!.id, 'presupuestos', q.id, 'editar']"
                          class="zf-btn zf-btn--ghost zf-btn--sm"
                        >
                          Editar
                        </a>
                        @if (!q.sentAt) {
                          <button
                            type="button"
                            class="zf-btn zf-btn--ghost zf-btn--sm"
                            [disabled]="quoteActionBusy() === q.id"
                            (click)="markQuoteSent(q.id)"
                          >
                            Marcar enviado
                          </button>
                        }
                        @if (q.approvalStatus === 'pendiente') {
                          <button
                            type="button"
                            class="zf-btn zf-btn--primary zf-btn--sm"
                            [disabled]="quoteActionBusy() === q.id"
                            (click)="respondQuote(q.id, 'aprobado')"
                          >
                            Registrar aprobación
                          </button>
                          <button
                            type="button"
                            class="zf-btn zf-btn--danger zf-btn--sm"
                            [disabled]="quoteActionBusy() === q.id"
                            (click)="respondQuote(q.id, 'rechazado')"
                          >
                            Registrar rechazo
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
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
                <div class="zf-field">
                  <label for="discount">Descuento</label>
                  <input id="discount" type="number" min="0" step="0.01" class="zf-input" formControlName="discount" />
                </div>

                <div class="totals-row">
                  <span>Total: <strong>{{ order()!.total | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                  <span>Pagado a cuenta: <strong>{{ order()!.deposit | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                  <span>Saldo pendiente: <strong>{{ order()!.balanceDue | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                </div>
                <p class="zf-hint zf-hint--block">
                  El pagado a cuenta se calcula automáticamente a partir de los pagos registrados en la sección
                  "Pagos", más abajo.
                </p>

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

            <section class="zf-card">
              <h2>Pagos</h2>

              @if (payments().length === 0) {
                <p class="zf-hint">Todavía no se registraron pagos para esta orden.</p>
              } @else {
                <div class="payment-list">
                  @for (p of payments(); track p.id) {
                    <div class="payment-item">
                      <span class="payment-item__amount">{{ p.amount | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</span>
                      <span class="zf-badge zf-badge--muted">{{ paymentMethodLabels[p.method] }}</span>
                      @if (p.isDeposit) {
                        <span class="zf-badge">Seña</span>
                      }
                      <span class="payment-item__date">{{ p.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                      @if (p.note) {
                        <span class="payment-item__note">{{ p.note }}</span>
                      }
                    </div>
                  }
                </div>
              }

              <div class="payment-form">
                <input
                  class="zf-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  [(ngModel)]="paymentAmount"
                  [ngModelOptions]="{ standalone: true }"
                  placeholder="Importe"
                />
                <select class="zf-select" [(ngModel)]="paymentMethod" [ngModelOptions]="{ standalone: true }">
                  @for (m of paymentMethods; track m) {
                    <option [value]="m">{{ paymentMethodLabels[m] }}</option>
                  }
                </select>
                <label class="payment-form__checkbox">
                  <input type="checkbox" [(ngModel)]="paymentIsDeposit" [ngModelOptions]="{ standalone: true }" />
                  Es una seña
                </label>
                <button
                  type="button"
                  class="zf-btn zf-btn--primary"
                  [disabled]="registeringPayment()"
                  (click)="registerPayment()"
                >
                  @if (registeringPayment()) {
                    <span class="zf-spinner"></span>
                  }
                  Registrar pago
                </button>
              </div>
            </section>

            <section class="zf-card">
              <h2>Garantía</h2>
              @if (warranty()) {
                <p><strong>Cobertura:</strong> {{ warranty()!.coverageDetails }}</p>
                <p>
                  <strong>Vigencia:</strong> {{ warranty()!.startsAt | date: 'dd/MM/yyyy' }} al
                  {{ warranty()!.expiresAt | date: 'dd/MM/yyyy' }}
                </p>
                <span class="zf-badge" [class.zf-badge--green]="isWarrantyActive()" [class.zf-badge--muted]="!isWarrantyActive()">
                  {{ isWarrantyActive() ? 'Vigente' : 'Vencida' }}
                </span>
              } @else {
                <p class="zf-hint">Esta orden todavía no tiene garantía registrada.</p>
                <div class="warranty-form">
                  <input
                    class="zf-input"
                    [(ngModel)]="warrantyCoverage"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="Cobertura (ej. Repuesto y mano de obra)"
                  />
                  <select class="zf-select" [(ngModel)]="warrantyDays" [ngModelOptions]="{ standalone: true }">
                    <option [ngValue]="30">30 días</option>
                    <option [ngValue]="60">60 días</option>
                    <option [ngValue]="90">90 días</option>
                    <option [ngValue]="180">180 días</option>
                  </select>
                  <button
                    type="button"
                    class="zf-btn zf-btn--primary zf-btn--sm"
                    [disabled]="creatingWarranty()"
                    (click)="createWarranty()"
                  >
                    @if (creatingWarranty()) {
                      <span class="zf-spinner"></span>
                    }
                    Generar garantía
                  </button>
                </div>
              }
            </section>

            <section class="zf-card">
              <div class="section-header">
                <h2>Comprobante y adjuntos</h2>
                <button
                  type="button"
                  class="zf-btn zf-btn--ghost zf-btn--sm"
                  [disabled]="generatingReceipt()"
                  (click)="generateReceipt()"
                >
                  @if (generatingReceipt()) {
                    <span class="zf-spinner"></span>
                  }
                  Generar comprobante PDF
                </button>
              </div>

              <div class="upload-row">
                <select class="zf-select" [(ngModel)]="uploadCategory" [ngModelOptions]="{ standalone: true }">
                  @for (c of attachmentCategories; track c) {
                    <option [value]="c">{{ attachmentCategoryLabels[c] }}</option>
                  }
                </select>
                <input type="file" (change)="onFileSelected($event)" accept="image/*,application/pdf" />
              </div>

              @if (attachments().length === 0) {
                <p class="zf-hint">Todavía no hay archivos adjuntos.</p>
              } @else {
                <div class="attachment-list">
                  @for (a of attachments(); track a.id) {
                    <div class="attachment-item">
                      <span class="attachment-item__name">{{ a.fileName }}</span>
                      <span class="zf-badge zf-badge--muted">{{ a.category ? attachmentCategoryLabels[a.category] : 'Otro' }}</span>
                      <button type="button" class="zf-btn zf-btn--ghost zf-btn--sm" (click)="viewAttachment(a.storagePath)">
                        Ver
                      </button>
                    </div>
                  }
                </div>
              }
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

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.85rem;
      }

      .section-header h2 {
        margin-bottom: 0;
      }

      .quote-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .quote-item {
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 0.85rem;
        background: var(--zf-surface-2);
      }

      .quote-item__top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.3rem;
      }

      .quote-item__total {
        font-weight: 700;
        color: var(--zf-text);
      }

      .quote-item__meta {
        font-size: 0.8rem;
        color: var(--zf-text-muted);
        margin-bottom: 0.6rem;
      }

      .quote-item__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .zf-card p {
        font-size: 0.9rem;
        margin: 0 0 0.5rem;
      }

      .totals-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 1rem;
        justify-content: space-between;
        background: var(--zf-blue-soft);
        border: 1px solid rgba(30, 155, 255, 0.3);
        border-radius: var(--zf-radius-sm);
        padding: 0.75rem 0.9rem;
        font-size: 0.88rem;
        margin-bottom: 0.5rem;
        color: var(--zf-text);
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
        color: var(--zf-text);
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

      .payment-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }

      .payment-item {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 0.6rem 0.8rem;
        font-size: 0.85rem;
      }

      .payment-item__amount {
        font-weight: 700;
        color: var(--zf-text);
      }

      .payment-item__date {
        margin-left: auto;
        color: var(--zf-text-muted);
        font-size: 0.78rem;
      }

      .payment-item__note {
        width: 100%;
        color: var(--zf-text-muted);
      }

      .payment-form {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.5rem;
        align-items: center;
      }

      @media (min-width: 640px) {
        .payment-form {
          grid-template-columns: 1fr 1fr auto auto;
        }
      }

      .payment-form__checkbox {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.85rem;
        color: var(--zf-text-secondary);
        white-space: nowrap;
      }

      .warranty-form {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.5rem;
      }

      @media (min-width: 500px) {
        .warranty-form {
          grid-template-columns: 1fr auto auto;
          align-items: center;
        }
      }

      .upload-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }

      @media (min-width: 500px) {
        .upload-row {
          grid-template-columns: auto 1fr;
          align-items: center;
        }
      }

      .upload-row input[type='file'] {
        font-size: 0.82rem;
        color: var(--zf-text-muted);
      }

      .attachment-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .attachment-item {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 0.6rem 0.8rem;
        font-size: 0.85rem;
      }

      .attachment-item__name {
        color: var(--zf-text);
        word-break: break-all;
      }
    `,
  ],
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ordersService = inject(RepairOrdersService);
  private readonly whatsappService = inject(WhatsappService);
  private readonly quotesService = inject(QuotesService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly warrantiesService = inject(WarrantiesService);
  private readonly attachmentsService = inject(AttachmentsService);
  private readonly receiptService = inject(ReceiptService);
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
  protected readonly quotes = signal<Quote[]>([]);
  protected readonly quoteStatusLabels = QUOTE_APPROVAL_LABELS;
  protected readonly quoteActionBusy = signal<string | null>(null);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  protected readonly paymentMethods: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'billetera_virtual', 'otro'];
  protected readonly registeringPayment = signal(false);
  protected paymentAmount: number | null = null;
  protected paymentMethod: PaymentMethod = 'efectivo';
  protected paymentIsDeposit = false;

  protected readonly warranty = signal<Warranty | null>(null);
  protected readonly creatingWarranty = signal(false);
  protected warrantyCoverage = '';
  protected warrantyDays = 90;

  protected readonly attachments = signal<Attachment[]>([]);
  protected readonly attachmentCategoryLabels = ATTACHMENT_CATEGORY_LABELS;
  protected readonly attachmentCategories: AttachmentCategory[] = [
    'foto_recepcion',
    'foto_diagnostico',
    'comprobante',
    'garantia',
    'otro',
  ];
  protected uploadCategory: AttachmentCategory = 'foto_recepcion';
  protected readonly uploadingFile = signal(false);
  protected readonly generatingReceipt = signal(false);

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
      const [order, history, quotes, payments, warranty, attachments] = await Promise.all([
        this.ordersService.getById(this.orderId),
        this.ordersService.getStatusHistory(this.orderId),
        this.quotesService.listByOrder(this.orderId),
        this.paymentsService.listByOrder(this.orderId),
        this.warrantiesService.getByOrder(this.orderId),
        this.attachmentsService.listByOrder(this.orderId),
      ]);
      this.order.set(order);
      this.history.set(history);
      this.quotes.set(quotes);
      this.payments.set(payments);
      this.warranty.set(warranty);
      this.attachments.set(attachments);
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
        deposit: this.order()!.deposit,
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
    if (this.newStatus === 'entregado' && this.order()!.balanceDue > 0) {
      const confirmed = window.confirm(
        `Esta orden todavía tiene un saldo pendiente de ${new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
        }).format(this.order()!.balanceDue)}. ¿Confirmás marcarla como entregada de todos modos?`,
      );
      if (!confirmed) {
        return;
      }
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

  async registerPayment(): Promise<void> {
    if (this.registeringPayment() || !this.paymentAmount || this.paymentAmount <= 0) {
      this.toast.error('Ingresá un importe válido.');
      return;
    }
    this.registeringPayment.set(true);
    try {
      await this.paymentsService.register(this.orderId, {
        amount: this.paymentAmount,
        method: this.paymentMethod,
        isDeposit: this.paymentIsDeposit,
        note: null,
      });
      this.paymentAmount = null;
      this.paymentIsDeposit = false;
      await this.load();
      this.toast.success('Pago registrado correctamente.');
    } catch {
      this.toast.error('No se pudo registrar el pago.');
    } finally {
      this.registeringPayment.set(false);
    }
  }

  isWarrantyActive(): boolean {
    const w = this.warranty();
    if (!w) {
      return false;
    }
    return w.active && new Date(`${w.expiresAt}T23:59:59`) >= new Date();
  }

  async createWarranty(): Promise<void> {
    if (this.creatingWarranty() || !this.warrantyCoverage.trim()) {
      this.toast.error('Describí la cobertura de la garantía.');
      return;
    }
    this.creatingWarranty.set(true);
    try {
      const warranty = await this.warrantiesService.create(this.orderId, this.warrantyCoverage, this.warrantyDays);
      this.warranty.set(warranty);
      this.toast.success('Garantía generada correctamente.');
    } catch {
      this.toast.error('No se pudo generar la garantía.');
    } finally {
      this.creatingWarranty.set(false);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.uploadingFile.set(true);
    try {
      await this.attachmentsService.upload(this.orderId, file, this.uploadCategory);
      this.attachments.set(await this.attachmentsService.listByOrder(this.orderId));
      this.toast.success('Archivo subido correctamente.');
    } catch {
      this.toast.error('No se pudo subir el archivo.');
    } finally {
      this.uploadingFile.set(false);
      input.value = '';
    }
  }

  async viewAttachment(storagePath: string): Promise<void> {
    try {
      const url = await this.attachmentsService.getSignedUrl(storagePath);
      window.open(url, '_blank', 'noopener');
    } catch {
      this.toast.error('No se pudo abrir el archivo.');
    }
  }

  async generateReceipt(): Promise<void> {
    const order = this.order();
    if (!order || this.generatingReceipt()) {
      return;
    }
    this.generatingReceipt.set(true);
    try {
      const blob = this.receiptService.generate(order, this.payments(), this.warranty());
      const fileName = `Comprobante-${order.code}.pdf`;

      await this.attachmentsService.uploadBlob(this.orderId, blob, fileName, 'comprobante');
      this.attachments.set(await this.attachmentsService.listByOrder(this.orderId));

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      this.toast.success('Comprobante generado y guardado en los adjuntos de la orden.');
    } catch {
      this.toast.error('No se pudo generar el comprobante.');
    } finally {
      this.generatingReceipt.set(false);
    }
  }

  async markQuoteSent(quoteId: string): Promise<void> {
    this.quoteActionBusy.set(quoteId);
    try {
      await this.quotesService.markSent(quoteId);
      await this.load();
      this.toast.success('Presupuesto marcado como enviado.');
    } catch {
      this.toast.error('No se pudo actualizar el presupuesto.');
    } finally {
      this.quoteActionBusy.set(null);
    }
  }

  async respondQuote(quoteId: string, status: QuoteApprovalStatus): Promise<void> {
    const verb = status === 'aprobado' ? 'aprobación' : 'rechazo';
    const respondedVia = window.prompt(
      `¿Cómo respondió el cliente? (ej. WhatsApp, teléfono, presencial) — se va a registrar el ${verb} del presupuesto.`,
      'WhatsApp',
    );
    if (respondedVia === null) {
      return;
    }
    if (!window.confirm(`¿Confirmás registrar el ${verb} de este presupuesto?`)) {
      return;
    }

    this.quoteActionBusy.set(quoteId);
    try {
      await this.quotesService.respond(quoteId, status, respondedVia || 'No especificado');
      await this.load();
      this.toast.success(`Respuesta registrada: ${verb}.`);
    } catch {
      this.toast.error('No se pudo registrar la respuesta del presupuesto.');
    } finally {
      this.quoteActionBusy.set(null);
    }
  }
}
