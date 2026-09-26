import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RepairOrdersService } from '../../../core/services/repair-orders.service';
import { WhatsappService } from '../../../core/services/whatsapp.service';
import { QuotesService } from '../../../core/services/quotes.service';
import { PaymentsService } from '../../../core/services/payments.service';
import { WarrantiesService } from '../../../core/services/warranties.service';
import { AttachmentsService } from '../../../core/services/attachments.service';
import { ReceiptService } from '../../../core/services/receipt.service';
import { ShortLinksService } from '../../../core/services/short-links.service';
import { InventoryService } from '../../../core/services/inventory.service';
import {
  Attachment,
  AttachmentCategory,
  ATTACHMENT_CATEGORY_LABELS,
  Communication,
  COMMUNICATION_TEMPLATE_LABELS,
  CommunicationTemplateType,
  InventoryItem,
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
            @if (canCreateReingreso()) {
              <a [routerLink]="['/ordenes', order()!.id, 'reingreso']" class="zf-btn zf-btn--ghost zf-btn--sm">
                + Crear reingreso
              </a>
            }
            <button type="button" class="zf-btn zf-btn--whatsapp zf-btn--sm" (click)="openWhatsAppModal()">
              Enviar por WhatsApp
            </button>
          </div>
        </div>

        @if (originalOrder() || reingresos().length > 0) {
          <div class="related-banner">
            @if (originalOrder()) {
              <span>
                Esta orden es un reingreso de
                <a [routerLink]="['/ordenes', originalOrder()!.id]">{{ originalOrder()!.code }}</a>.
              </span>
            }
            @if (reingresos().length > 0) {
              <span>
                Tiene {{ reingresos().length }} reingreso(s):
                @for (r of reingresos(); track r.id) {
                  <a [routerLink]="['/ordenes', r.id]">{{ r.code }}</a>
                }
              </span>
            }
          </div>
        }

        <div class="detail-grid">
          <div class="detail-col">
            <section class="zf-card">
              <h2>Recepción</h2>
              <p><strong>Ingreso:</strong> {{ order()!.receivedAt | date: 'dd/MM/yyyy HH:mm' }}</p>
              <p><strong>Falla declarada:</strong> {{ order()!.reportedFault }}</p>
              @if (order()!.receptionNotes) {
                <p><strong>Observaciones de recepción:</strong> {{ order()!.receptionNotes }}</p>
              }
              @if (order()!.deviceAccessories) {
                <p><strong>Accesorios entregados:</strong> {{ order()!.deviceAccessories }}</p>
              }
              @if (order()!.deviceAccessCode) {
                <p><strong>Contraseña / patrón:</strong> {{ order()!.deviceAccessCode }}</p>
              }
            </section>

            <section class="zf-card">
              <h2>Diagnóstico</h2>
              <form [formGroup]="diagnosisForm" (ngSubmit)="saveDiagnosis()" novalidate>
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
                    <label for="estimatedCompletionDate">Fecha estimada de entrega</label>
                    <input id="estimatedCompletionDate" type="date" class="zf-input" formControlName="estimatedCompletionDate" />
                  </div>
                </div>
                <div class="zf-field">
                  <label for="technicalDiagnosis">Diagnóstico técnico</label>
                  <textarea id="technicalDiagnosis" class="zf-textarea" formControlName="technicalDiagnosis"></textarea>
                </div>
                <div class="zf-field">
                  <label for="recommendedWork">Trabajo recomendado</label>
                  <textarea id="recommendedWork" class="zf-textarea" formControlName="recommendedWork"></textarea>
                </div>

                <button type="submit" class="zf-btn zf-btn--primary" [disabled]="savingDetails()">
                  @if (savingDetails()) {
                    <span class="zf-spinner"></span>
                  }
                  Guardar diagnóstico
                </button>
              </form>
            </section>

            @if (canManagePricing()) {
            <section class="zf-card">
              <h2>Presupuesto</h2>

              <div class="tab-switch">
                <button
                  type="button"
                  class="tab-btn"
                  [class.tab-btn--active]="pricingMode() === 'calculadora'"
                  (click)="pricingMode.set('calculadora')"
                >
                  Calculadora por ítems
                </button>
                <button
                  type="button"
                  class="tab-btn"
                  [class.tab-btn--active]="pricingMode() === 'simple'"
                  (click)="pricingMode.set('simple')"
                >
                  Precio simple
                </button>
              </div>

              @if (pricingMode() === 'calculadora') {
                <div class="calc-box">
                  <p class="zf-hint">
                    Cargá el valor de cada repuesto o ítem si corresponde, indicá el porcentaje que le sumás y
                    guardalo: crea un presupuesto formal, visible más abajo.
                  </p>

                  <div class="calc-items">
                    @for (item of calcItems(); track $index) {
                      <div class="calc-item-block">
                        <select
                          class="zf-select zf-select--sm"
                          [ngModel]="item.inventoryItemId"
                          [ngModelOptions]="{ standalone: true }"
                          (ngModelChange)="onCalcItemInventorySelect($index, $event)"
                        >
                          <option [ngValue]="null">— Elegir repuesto del inventario (opcional) —</option>
                          @for (inv of inventoryItems(); track inv.id) {
                            <option [ngValue]="inv.id">
                              {{ inv.name }} · stock {{ inv.stockQuantity }} · {{ inv.unitPrice | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}
                            </option>
                          }
                        </select>
                        <div class="calc-item-row">
                          <input
                            class="zf-input"
                            [(ngModel)]="item.description"
                            [ngModelOptions]="{ standalone: true }"
                            placeholder="Ítem (ej. Módulo de pantalla)"
                          />
                          <input
                            class="zf-input"
                            type="number"
                            min="1"
                            step="1"
                            [(ngModel)]="item.quantity"
                            [ngModelOptions]="{ standalone: true }"
                            placeholder="Cant."
                          />
                          <input
                            class="zf-input"
                            type="number"
                            min="0"
                            step="0.01"
                            [(ngModel)]="item.unitPrice"
                            [ngModelOptions]="{ standalone: true }"
                            placeholder="Precio unit."
                          />
                          <button
                            type="button"
                            class="zf-btn zf-btn--ghost zf-btn--sm"
                            [disabled]="calcItems().length <= 1"
                            (click)="removeCalcItem($index)"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    }
                  </div>

                  <button type="button" class="zf-btn zf-btn--ghost zf-btn--sm calc-add-btn" (click)="addCalcItem()">
                    + Agregar ítem
                  </button>

                  <div class="zf-field calc-percent-field">
                    <label for="calcMarkup">% a sumar (recargo)</label>
                    <input
                      id="calcMarkup"
                      class="zf-input"
                      type="number"
                      min="0"
                      step="1"
                      [(ngModel)]="calcMarkupPercent"
                      [ngModelOptions]="{ standalone: true }"
                    />
                  </div>

                  <div class="calc-summary">
                    <span>Subtotal ítems: <strong>{{ calcSubtotal() | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                    <span>Recargo ({{ calcMarkupPercent || 0 }}%): <strong>{{ calcMarkupAmount() | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                    <span>Total calculado: <strong>{{ calcTotal() | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                  </div>

                  <button
                    type="button"
                    class="zf-btn zf-btn--primary"
                    [disabled]="savingCalcQuote()"
                    (click)="saveAndQuote()"
                  >
                    @if (savingCalcQuote()) {
                      <span class="zf-spinner"></span>
                    }
                    Guardar y presupuestar
                  </button>
                </div>
              }

              @if (pricingMode() === 'simple') {
                <form [formGroup]="pricingForm" (ngSubmit)="savePricing()" novalidate>
                  <p class="zf-hint zf-hint--block" style="margin-top: 0;">
                    Para casos simples que no necesitan un presupuesto formal por ítems.
                  </p>
                  <div class="zf-grid-2">
                    <div class="zf-field">
                      <label for="customerPrice">Precio al cliente</label>
                      <input id="customerPrice" type="number" min="0" step="0.01" class="zf-input" formControlName="customerPrice" />
                    </div>
                    <div class="zf-field">
                      <label for="discount">Descuento</label>
                      <input id="discount" type="number" min="0" step="0.01" class="zf-input" formControlName="discount" />
                    </div>
                  </div>

                  <div class="totals-row">
                    <span>Total: <strong>{{ order()!.total | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                  </div>

                  <button type="submit" class="zf-btn zf-btn--primary" [disabled]="savingPricing()">
                    @if (savingPricing()) {
                      <span class="zf-spinner"></span>
                    }
                    Guardar presupuesto
                  </button>
                </form>
              }

              <div class="subsection">
                <div class="section-header">
                  <h3>Presupuestos formales</h3>
                  <div class="section-header__actions">
                    <button type="button" class="zf-btn zf-btn--ghost zf-btn--sm" (click)="toggleQuoteHistory()">
                      {{ showQuoteHistory() ? 'Ocultar historial' : 'Ver historial' }}
                    </button>
                    <a [routerLink]="['/ordenes', order()!.id, 'presupuestos', 'nuevo']" class="zf-btn zf-btn--ghost zf-btn--sm">
                      + Nuevo
                    </a>
                  </div>
                </div>

                @if (quotes().length === 0) {
                  <p class="zf-hint">Todavía no hay presupuestos por ítems cargados para esta orden.</p>
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
                          @if (q.approvalStatus !== 'aprobado') {
                            <a
                              [routerLink]="['/ordenes', order()!.id, 'presupuestos', q.id, 'editar']"
                              class="zf-btn zf-btn--ghost zf-btn--sm"
                            >
                              Editar
                            </a>
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
                          @if (q.approvalStatus !== 'aprobado') {
                            <button
                              type="button"
                              class="zf-btn zf-btn--danger zf-btn--sm"
                              [disabled]="quoteActionBusy() === q.id"
                              (click)="removeQuote(q)"
                            >
                              Eliminar
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }

                @if (showQuoteHistory()) {
                  <div class="quote-history">
                    <h4>Historial (eliminados)</h4>
                    @if (loadingQuoteHistory()) {
                      <p class="zf-hint">Cargando historial…</p>
                    } @else if (deletedQuotes().length === 0) {
                      <p class="zf-hint">No hay presupuestos eliminados para esta orden.</p>
                    } @else {
                      <div class="quote-list">
                        @for (q of deletedQuotes(); track q.id) {
                          <div class="quote-item quote-item--archived">
                            <div class="quote-item__top">
                              <span class="quote-item__total">{{ q.total | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</span>
                              <span class="zf-badge zf-badge--muted">Eliminado</span>
                            </div>
                            <div class="quote-item__meta">
                              {{ q.items.length }} ítem(s) · creado {{ q.createdAt | date: 'dd/MM/yyyy' }} · eliminado
                              {{ q.deletedAt | date: 'dd/MM/yyyy HH:mm' }}
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </section>
            }

            <section class="zf-card">
              <h2>Pagos</h2>

              <div class="totals-row">
                <span>Total: <strong>{{ order()!.total | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                <span>Pagado a cuenta: <strong>{{ order()!.deposit | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
                <span>Saldo pendiente: <strong>{{ order()!.balanceDue | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong></span>
              </div>

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

              @if (order()!.balanceDue <= 0) {
                <p class="paid-in-full">✓ Esta orden está pagada en su totalidad. No se pueden registrar más pagos.</p>
              } @else {
                <div class="payment-form">
                  <input
                    class="zf-input"
                    type="number"
                    min="0.01"
                    [max]="order()!.balanceDue"
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
              }
            </section>

            @if (order()!.status === 'entregado') {
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
            }

            <section class="zf-card">
              <div class="section-header">
                <h2>Comprobante y adjuntos</h2>
                <div class="section-header__actions">
                  <button
                    type="button"
                    class="zf-btn zf-btn--ghost zf-btn--sm"
                    [disabled]="generatingWorkOrder()"
                    (click)="generateWorkOrder()"
                  >
                    @if (generatingWorkOrder()) {
                      <span class="zf-spinner"></span>
                    }
                    Orden de trabajo
                  </button>
                  <button
                    type="button"
                    class="zf-btn zf-btn--ghost zf-btn--sm"
                    [disabled]="generatingReceipt()"
                    (click)="generateReceipt()"
                  >
                    @if (generatingReceipt()) {
                      <span class="zf-spinner"></span>
                    }
                    Comprobante de entrega
                  </button>
                </div>
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
                      <button
                        type="button"
                        class="zf-btn zf-btn--ghost zf-btn--sm zf-btn--danger"
                        [disabled]="deletingAttachmentId() === a.id"
                        (click)="deleteAttachment(a)"
                      >
                        @if (deletingAttachmentId() === a.id) {
                          <span class="zf-spinner"></span>
                        }
                        Borrar
                      </button>
                    </div>
                  }
                </div>
              }
            </section>

            <section class="zf-card">
              <h2>Historial de WhatsApp</h2>
              @if (communications().length === 0) {
                <p class="zf-hint">Todavía no se envió ningún mensaje por WhatsApp.</p>
              } @else {
                <div class="attachment-list">
                  @for (c of communications(); track c.id) {
                    <div class="attachment-item">
                      <span class="attachment-item__name">{{ communicationTemplateLabels[c.templateType] }}</span>
                      <span class="zf-badge zf-badge--muted">
                        {{ c.status === 'abierto_en_whatsapp' ? 'Abierto en WhatsApp' : 'Preparado' }}
                      </span>
                      <span class="payment-item__date">{{ c.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
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
                <div class="timeline">
                  @for (h of history(); track h.id; let last = $last; let first = $first) {
                    <div class="timeline-item">
                      <div class="timeline-item__rail">
                        <span class="timeline-item__dot" [class.timeline-item__dot--current]="first"></span>
                        @if (!last) {
                          <span class="timeline-item__line"></span>
                        }
                      </div>
                      <div class="timeline-item__content">
                        <div class="history-item__status">{{ statusLabels[h.toStatus] }}</div>
                        <div class="history-item__date">{{ h.changedAt | date: 'dd/MM/yyyy HH:mm' }}</div>
                        @if (h.note) {
                          <div class="history-item__note">{{ h.note }}</div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </section>
          </div>
        </div>

        @if (whatsAppModalOpen()) {
          <div class="modal-backdrop" (click)="closeWhatsAppModal()">
            <div class="modal-card" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h2>Enviar por WhatsApp</h2>
                <button type="button" class="modal-close" (click)="closeWhatsAppModal()">✕</button>
              </div>

              @if (whatsAppModalStep() === 'plantilla') {
                <div class="zf-field">
                  <label for="modalTemplate">Plantilla</label>
                  <select
                    id="modalTemplate"
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
                  <label for="modalMessagePreview">Mensaje (podés editarlo antes de abrir WhatsApp)</label>
                  <textarea
                    id="modalMessagePreview"
                    class="zf-textarea"
                    rows="5"
                    [(ngModel)]="messageText"
                    [ngModelOptions]="{ standalone: true }"
                  ></textarea>
                </div>
                @if (!whatsappLink()) {
                  <p class="zf-error">El teléfono del cliente no es válido para WhatsApp. Revisá el dato en la ficha del cliente.</p>
                } @else if (selectedTemplate === 'confirmacion_recepcion') {
                  <p class="zf-hint zf-hint--block" style="margin-top: 0;">
                    Se va a generar la orden de trabajo en PDF y se va a compartir el enlace de descarga junto con este
                    mensaje.
                  </p>
                  <button
                    type="button"
                    class="zf-btn zf-btn--whatsapp modal-submit"
                    [disabled]="sendingWorkOrder()"
                    (click)="sendWorkOrderWhatsApp()"
                  >
                    @if (sendingWorkOrder()) {
                      <span class="zf-spinner"></span>
                    }
                    Adjuntar orden de trabajo y abrir WhatsApp
                  </button>
                } @else {
                  <a
                    [href]="whatsappLink()!"
                    target="_blank"
                    rel="noopener"
                    class="zf-btn zf-btn--whatsapp modal-submit"
                    (click)="onWhatsAppOpenFromModal()"
                  >
                    Abrir WhatsApp
                  </a>
                }

                @if (canManagePricing() || canSendDeliveryReceipt()) {
                  <div class="modal-alt-actions">
                    <span class="zf-hint">¿Preferís enviar otra cosa?</span>
                    @if (canManagePricing()) {
                      <button type="button" class="link-btn" (click)="selectWhatsAppCategory('presupuesto')">Un presupuesto</button>
                    }
                    @if (canSendDeliveryReceipt()) {
                      <button type="button" class="link-btn" (click)="selectWhatsAppCategory('comprobante')">
                        El comprobante de entrega
                      </button>
                    } @else if (canManagePricing()) {
                      <span class="zf-hint">· El comprobante de entrega estará disponible cuando se cargue el presupuesto.</span>
                    }
                  </div>
                }
              }

              @if (whatsAppModalStep() === 'presupuesto') {
                <button type="button" class="modal-back" (click)="whatsAppModalStep.set('plantilla')">← Volver</button>
                @if (quotes().length === 0) {
                  <p class="zf-hint">Todavía no hay presupuestos formales cargados para esta orden.</p>
                  <a
                    [routerLink]="['/ordenes', order()!.id, 'presupuestos', 'nuevo']"
                    class="zf-btn zf-btn--ghost modal-submit"
                    (click)="closeWhatsAppModal()"
                  >
                    Crear presupuesto
                  </a>
                } @else {
                  <div class="modal-quote-list">
                    @for (q of quotes(); track q.id) {
                      <label class="modal-quote-option">
                        <input
                          type="radio"
                          name="whatsAppQuote"
                          [value]="q.id"
                          [(ngModel)]="whatsAppSelectedQuoteId"
                          [ngModelOptions]="{ standalone: true }"
                        />
                        <span>
                          <strong>{{ q.total | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong>
                          — {{ quoteStatusLabels[q.approvalStatus] }} · {{ q.createdAt | date: 'dd/MM/yyyy' }}
                        </span>
                      </label>
                    }
                  </div>
                  <button
                    type="button"
                    class="zf-btn zf-btn--whatsapp modal-submit"
                    [disabled]="!whatsAppSelectedQuoteId || quoteActionBusy() !== null"
                    (click)="confirmSendQuoteFromModal()"
                  >
                    @if (quoteActionBusy() !== null) {
                      <span class="zf-spinner"></span>
                    }
                    Enviar presupuesto
                  </button>
                }
              }

              @if (whatsAppModalStep() === 'comprobante') {
                <button type="button" class="modal-back" (click)="whatsAppModalStep.set('plantilla')">← Volver</button>
                <p class="zf-hint zf-hint--block" style="margin-top: 0;">
                  Se va a generar el comprobante de entrega en PDF (o actualizar el existente), y compartir el enlace de
                  descarga por WhatsApp.
                </p>
                <button
                  type="button"
                  class="zf-btn zf-btn--whatsapp modal-submit"
                  [disabled]="sendingReceipt()"
                  (click)="confirmSendReceiptFromModal()"
                >
                  @if (sendingReceipt()) {
                    <span class="zf-spinner"></span>
                  }
                  Generar y enviar comprobante
                </button>
              }

            </div>
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

      .zf-subtitle a {
        color: var(--zf-blue);
        text-decoration: none;
        font-weight: 600;
      }

      .badges {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .related-banner {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        background: var(--zf-purple-soft);
        border: 1px solid rgba(156, 44, 255, 0.35);
        border-radius: var(--zf-radius-sm);
        padding: 0.75rem 0.9rem;
        font-size: 0.85rem;
        color: var(--zf-text-secondary);
        margin-bottom: 1.25rem;
      }

      .related-banner a {
        font-weight: 600;
        margin-left: 0.35rem;
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
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 0.85rem;
      }

      .section-header__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
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

      .subsection {
        margin-top: 1.5rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--zf-border-soft);
      }

      .tab-switch {
        display: flex;
        gap: 0.4rem;
        margin-bottom: 1.1rem;
        border-bottom: 1px solid var(--zf-border-soft);
      }

      .tab-btn {
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--zf-text-muted);
        font-weight: 600;
        font-size: 0.88rem;
        padding: 0.6rem 0.25rem;
        cursor: pointer;
        margin-bottom: -1px;
      }

      .tab-btn--active {
        color: var(--zf-blue);
        border-bottom-color: var(--zf-blue);
      }

      .quote-locked-hint {
        display: inline-flex;
        align-items: center;
        font-size: 0.8rem;
      }

      .calc-box {
        background: var(--zf-surface-2);
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 1rem;
        margin-bottom: 1.25rem;
      }

      .calc-box h3 {
        font-size: 0.85rem;
        color: var(--zf-text);
        margin: 0 0 0.3rem;
      }

      .calc-box .zf-hint {
        margin-bottom: 0.85rem;
      }

      .calc-items {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 0.6rem;
      }

      .calc-item-block {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px dashed var(--zf-border-soft);
      }

      .zf-select--sm {
        padding: 0.4rem 0.55rem;
        font-size: 0.82rem;
      }

      .calc-item-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.4rem;
      }

      @media (min-width: 560px) {
        .calc-item-row {
          grid-template-columns: 2fr 0.6fr 1fr auto;
          align-items: center;
        }
      }

      .calc-add-btn {
        margin-bottom: 1rem;
      }

      .calc-percent-field {
        max-width: 200px;
        margin-bottom: 1rem;
      }

      .calc-summary {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.88rem;
        color: var(--zf-text-secondary);
        margin-bottom: 0.85rem;
      }

      .calc-summary strong {
        color: var(--zf-text);
      }

      .calc-save-hint {
        display: inline-block;
        margin-left: 0.6rem;
      }

      .quote-item--archived {
        opacity: 0.7;
      }

      .quote-history {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px dashed var(--zf-border-soft);
      }

      .quote-history h4 {
        font-size: 0.8rem;
        color: var(--zf-text-muted);
        margin: 0 0 0.6rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .subsection h3 {
        font-size: 0.88rem;
        color: var(--zf-text);
        margin: 0;
      }

      .paid-in-full {
        background: var(--zf-purple-soft);
        border: 1px solid rgba(156, 44, 255, 0.35);
        color: var(--zf-text-secondary);
        border-radius: var(--zf-radius-sm);
        padding: 0.75rem 0.9rem;
        font-size: 0.88rem;
        margin: 0;
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

      .timeline {
        margin-top: 1rem;
        border-top: 1px solid var(--zf-border);
        padding-top: 1rem;
      }

      .timeline-item {
        display: flex;
        gap: 0.75rem;
        font-size: 0.85rem;
      }

      .timeline-item__rail {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 12px;
        flex-shrink: 0;
      }

      .timeline-item__dot {
        width: 11px;
        height: 11px;
        min-height: 11px;
        border-radius: 50%;
        background: var(--zf-surface-2);
        border: 2px solid var(--zf-border);
        flex-shrink: 0;
      }

      .timeline-item__dot--current {
        background: var(--zf-gradient);
        border-color: transparent;
      }

      .timeline-item__line {
        width: 2px;
        flex: 1;
        min-height: 1.4rem;
        background: var(--zf-border);
        margin: 2px 0;
      }

      .timeline-item__content {
        padding-bottom: 1.1rem;
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

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(4, 5, 8, 0.72);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        z-index: 100;
        padding: 0;
      }

      @media (min-width: 640px) {
        .modal-backdrop {
          align-items: center;
          padding: 1.5rem;
        }
      }

      .modal-card {
        background: var(--zf-surface);
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius) var(--zf-radius) 0 0;
        padding: 1.5rem;
        width: 100%;
        max-width: 480px;
        max-height: 88vh;
        overflow-y: auto;
      }

      @media (min-width: 640px) {
        .modal-card {
          border-radius: var(--zf-radius);
        }
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .modal-header h2 {
        margin: 0;
        font-size: 1.05rem;
      }

      .modal-close {
        background: none;
        border: none;
        color: var(--zf-text-muted);
        font-size: 1.2rem;
        cursor: pointer;
        line-height: 1;
        padding: 0.25rem;
      }

      .modal-alt-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.35rem;
        margin-top: 0.9rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--zf-border-soft);
      }

      .modal-alt-actions .link-btn {
        background: none;
        border: none;
        color: var(--zf-blue);
        font-weight: 600;
        font-size: 0.82rem;
        cursor: pointer;
        padding: 0;
        text-decoration: underline;
      }

      .modal-back {
        background: none;
        border: none;
        color: var(--zf-blue);
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        padding: 0;
        margin-bottom: 1rem;
      }

      .modal-submit {
        width: 100%;
        margin-top: 0.5rem;
      }

      .modal-quote-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .modal-quote-option {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: var(--zf-surface-2);
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 0.7rem 0.85rem;
        font-size: 0.85rem;
        color: var(--zf-text-secondary);
        cursor: pointer;
      }

      .modal-quote-option strong {
        color: var(--zf-text);
      }

      .modal-footnote {
        margin-top: 1.25rem;
      }
    `,
  ],
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly ordersService = inject(RepairOrdersService);
  private readonly whatsappService = inject(WhatsappService);
  private readonly quotesService = inject(QuotesService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly warrantiesService = inject(WarrantiesService);
  private readonly attachmentsService = inject(AttachmentsService);
  private readonly receiptService = inject(ReceiptService);
  private readonly shortLinksService = inject(ShortLinksService);
  private readonly inventoryService = inject(InventoryService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly canManagePricing = computed(() => ['admin', 'recepcion'].includes(this.auth.profile()?.role ?? ''));
  protected readonly canCreateReingreso = computed(() => {
    const status = this.order()?.status;
    return status === 'entregado' || status === 'cancelado';
  });
  // Antes de tener un total cargado, el comprobante de entrega saldría vacío (sin costo ni
  // diagnóstico) — se oculta la opción hasta ese momento en vez de dejar mandar algo inútil.
  protected readonly canSendDeliveryReceipt = computed(() => (this.order()?.total ?? 0) > 0);
  protected readonly firstErrorMessage = firstErrorMessage;
  protected readonly statusLabels = REPAIR_STATUS_LABELS;
  protected readonly statusOrder = REPAIR_STATUS_ORDER;
  protected readonly priorityLabels = REPAIR_PRIORITY_LABELS;
  protected readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;
  protected readonly templateLabels = COMMUNICATION_TEMPLATE_LABELS;
  // "Presupuesto listo" y "Comprobante digital" tienen su propio flujo dedicado en el modal
  // de WhatsApp (con el detalle real de items/enlace), así que no se listan acá para evitar
  // enviar una versión genérica en su lugar.
  protected readonly templateTypes = (Object.keys(COMMUNICATION_TEMPLATE_LABELS) as CommunicationTemplateType[]).filter(
    (t) => t !== 'presupuesto_listo' && t !== 'comprobante_digital',
  );

  protected readonly order = signal<RepairOrder | null>(null);
  protected readonly originalOrder = signal<RepairOrder | null>(null);
  protected readonly reingresos = signal<RepairOrder[]>([]);
  protected readonly history = signal<RepairStatusHistoryEntry[]>([]);
  protected readonly quotes = signal<Quote[]>([]);
  protected readonly pricingMode = signal<'calculadora' | 'simple'>('calculadora');
  protected readonly deletedQuotes = signal<Quote[]>([]);
  protected readonly showQuoteHistory = signal(false);
  protected readonly loadingQuoteHistory = signal(false);
  protected readonly savingCalcQuote = signal(false);
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
  protected readonly communicationTemplateLabels = COMMUNICATION_TEMPLATE_LABELS;
  protected readonly attachmentCategories: AttachmentCategory[] = [
    'foto_recepcion',
    'foto_diagnostico',
    'orden_trabajo',
    'comprobante',
    'garantia',
    'otro',
  ];
  protected uploadCategory: AttachmentCategory = 'foto_recepcion';
  protected readonly uploadingFile = signal(false);
  protected readonly deletingAttachmentId = signal<string | null>(null);
  protected readonly generatingWorkOrder = signal(false);
  protected readonly generatingReceipt = signal(false);
  protected readonly sendingReceipt = signal(false);
  protected readonly sendingWorkOrder = signal(false);

  protected readonly loading = signal(true);
  protected readonly savingDetails = signal(false);
  protected readonly changingStatus = signal(false);
  protected readonly paymentStatus = signal<'sin_pago' | 'senia' | 'pagado_parcial' | 'pagado_total'>('sin_pago');

  protected newStatus: RepairStatus = 'recibido';
  protected statusNote = '';
  protected selectedTemplate: CommunicationTemplateType = 'consulta_estado';
  protected messageText = '';
  private orderId = '';

  protected readonly whatsAppModalOpen = signal(false);
  protected readonly whatsAppModalStep = signal<'plantilla' | 'presupuesto' | 'comprobante'>('plantilla');
  protected whatsAppSelectedQuoteId: string | null = null;

  protected readonly savingPricing = signal(false);

  protected readonly diagnosisForm = this.fb.nonNullable.group({
    technicalDiagnosis: [''],
    recommendedWork: [''],
    priority: ['normal' as RepairPriority],
    estimatedCompletionDate: [''],
  });
  protected readonly priorities: RepairPriority[] = ['baja', 'normal', 'alta', 'urgente'];

  protected readonly pricingForm = this.fb.nonNullable.group({
    customerPrice: [0, [positiveAmountValidator()]],
    discount: [0, [positiveAmountValidator()]],
  });

  protected readonly inventoryItems = signal<InventoryItem[]>([]);
  protected readonly communications = signal<Communication[]>([]);
  protected readonly calcItems = signal<
    { description: string; quantity: number; unitPrice: number; inventoryItemId: string | null }[]
  >([{ description: '', quantity: 1, unitPrice: 0, inventoryItemId: null }]);
  protected calcMarkupPercent = 0;

  calcSubtotal(): number {
    return this.calcItems().reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  }

  calcMarkupAmount(): number {
    return (this.calcSubtotal() * (Number(this.calcMarkupPercent) || 0)) / 100;
  }

  calcTotal(): number {
    return this.calcSubtotal() + this.calcMarkupAmount();
  }

  addCalcItem(): void {
    this.calcItems.update((items) => [...items, { description: '', quantity: 1, unitPrice: 0, inventoryItemId: null }]);
  }

  removeCalcItem(index: number): void {
    this.calcItems.update((items) => items.filter((_, i) => i !== index));
  }

  onCalcItemInventorySelect(index: number, inventoryItemId: string): void {
    const inventoryItem = this.inventoryItems().find((i) => i.id === inventoryItemId);
    this.calcItems.update((items) =>
      items.map((item, i) =>
        i === index
          ? {
              ...item,
              description: inventoryItem?.name ?? item.description,
              unitPrice: inventoryItem?.unitPrice ?? item.unitPrice,
              inventoryItemId: inventoryItem?.id ?? null,
              quantity: item.quantity > 0 ? item.quantity : 1,
            }
          : item,
      ),
    );
  }

  async saveAndQuote(): Promise<void> {
    if (this.savingCalcQuote()) {
      return;
    }
    const validItems = this.calcItems().filter((i) => i.description.trim() || Number(i.unitPrice) > 0);
    if (validItems.length === 0) {
      this.toast.error('Cargá al menos un ítem con descripción o valor.');
      return;
    }

    const items = validItems.map((i) => ({
      id: null,
      description: i.description.trim() || 'Ítem sin descripción',
      quantity: Number(i.quantity) || 1,
      unitCost: Number(i.unitPrice) || 0,
      unitPrice: Number(i.unitPrice) || 0,
      inventoryItemId: i.inventoryItemId,
    }));
    if (this.calcMarkupAmount() > 0) {
      items.push({
        id: null,
        description: `Recargo (${this.calcMarkupPercent}%)`,
        quantity: 1,
        unitCost: 0,
        unitPrice: Math.round(this.calcMarkupAmount() * 100) / 100,
        inventoryItemId: null,
      });
    }

    this.savingCalcQuote.set(true);
    try {
      await this.quotesService.save(this.orderId, null, {
        laborCost: 0,
        discount: 0,
        validUntil: null,
        customerNotes: null,
        items,
      });
      this.quotes.set(await this.quotesService.listByOrder(this.orderId));
      this.calcItems.set([{ description: '', quantity: 1, unitPrice: 0, inventoryItemId: null }]);
      this.calcMarkupPercent = 0;
      this.toast.success('Presupuesto creado. Lo vas a ver en "Presupuestos formales", más abajo.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar el presupuesto.');
    } finally {
      this.savingCalcQuote.set(false);
    }
  }

  async toggleQuoteHistory(): Promise<void> {
    const next = !this.showQuoteHistory();
    this.showQuoteHistory.set(next);
    if (next && this.deletedQuotes().length === 0) {
      this.loadingQuoteHistory.set(true);
      try {
        this.deletedQuotes.set(await this.quotesService.listDeletedByOrder(this.orderId));
      } catch (error) {
        this.toast.error(error instanceof Error ? error.message : 'No se pudo cargar el historial de presupuestos.');
      } finally {
        this.loadingQuoteHistory.set(false);
      }
    }
  }

  async removeQuote(quote: Quote): Promise<void> {
    if (quote.approvalStatus === 'aprobado') {
      this.toast.error('Este presupuesto ya fue aprobado: no se puede eliminar.');
      return;
    }
    if (!window.confirm('¿Eliminar este presupuesto? Va a dejar de estar activo, pero queda como historial.')) {
      return;
    }
    this.quoteActionBusy.set(quote.id);
    try {
      await this.quotesService.remove(quote.id);
      this.quotes.set(await this.quotesService.listByOrder(this.orderId));
      if (this.showQuoteHistory()) {
        this.deletedQuotes.set(await this.quotesService.listDeletedByOrder(this.orderId));
      }
      this.toast.success('Presupuesto eliminado. Queda disponible en el historial.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el presupuesto.');
    } finally {
      this.quoteActionBusy.set(null);
    }
  }

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
      const [order, history, quotes, payments, warranty, attachments, inventoryItems, communications] = await Promise.all([
        this.ordersService.getById(this.orderId),
        this.ordersService.getStatusHistory(this.orderId),
        this.quotesService.listByOrder(this.orderId),
        this.paymentsService.listByOrder(this.orderId),
        this.warrantiesService.getByOrder(this.orderId),
        this.attachmentsService.listByOrder(this.orderId),
        this.inventoryService.list(),
        this.whatsappService.listByOrder(this.orderId),
      ]);
      this.order.set(order);
      this.history.set(history);
      this.quotes.set(quotes);
      this.payments.set(payments);
      this.warranty.set(warranty);
      this.attachments.set(attachments);
      this.inventoryItems.set(inventoryItems);
      this.communications.set(communications);
      if (order) {
        this.newStatus = order.status;
        this.paymentStatus.set(this.ordersService.paymentStatusOf(order));
        this.diagnosisForm.patchValue({
          technicalDiagnosis: order.technicalDiagnosis ?? '',
          recommendedWork: order.recommendedWork ?? '',
          priority: order.priority,
          estimatedCompletionDate: order.estimatedCompletionDate ?? '',
        });
        this.pricingForm.patchValue({
          customerPrice: order.customerPrice,
          discount: order.discount,
        });
        this.regenerateMessage();

        const [originalOrder, reingresos] = await Promise.all([
          order.relatedOrderId ? this.ordersService.getById(order.relatedOrderId) : Promise.resolve(null),
          this.ordersService.listReingresos(this.orderId),
        ]);
        this.originalOrder.set(originalOrder);
        this.reingresos.set(reingresos);
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo cargar la orden.');
    } finally {
      this.loading.set(false);
    }
  }

  regenerateMessage(): void {
    const order = this.order();
    if (!order) {
      return;
    }
    this.messageText = this.whatsappService.buildMessage(order, this.selectedTemplate, this.warranty());
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
      this.communications.set(await this.whatsappService.listByOrder(this.orderId));
    } catch {
      this.toast.error('El mensaje se abrió en WhatsApp, pero no se pudo registrar en el sistema.');
    }
  }

  openWhatsAppModal(): void {
    const order = this.order();
    if (order) {
      this.selectedTemplate = this.whatsappService.suggestedTemplate(order.status);
      this.regenerateMessage();
    }
    this.whatsAppModalStep.set('plantilla');
    this.whatsAppSelectedQuoteId = null;
    this.whatsAppModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeWhatsAppModal(): void {
    this.whatsAppModalOpen.set(false);
    document.body.style.overflow = '';
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  selectWhatsAppCategory(category: 'presupuesto' | 'comprobante'): void {
    if (category === 'presupuesto' && this.quotes().length === 1) {
      this.whatsAppSelectedQuoteId = this.quotes()[0].id;
    }
    this.whatsAppModalStep.set(category);
  }

  async onWhatsAppOpenFromModal(): Promise<void> {
    await this.onWhatsAppOpen();
    this.closeWhatsAppModal();
  }

  async confirmSendQuoteFromModal(): Promise<void> {
    const quote = this.quotes().find((q) => q.id === this.whatsAppSelectedQuoteId);
    if (!quote) {
      return;
    }
    await this.sendQuoteWhatsApp(quote);
    this.closeWhatsAppModal();
  }

  async confirmSendReceiptFromModal(): Promise<void> {
    await this.sendReceiptWhatsApp();
    this.closeWhatsAppModal();
  }

  async saveDiagnosis(): Promise<void> {
    const order = this.order();
    if (this.savingDetails() || this.diagnosisForm.invalid || !order) {
      this.diagnosisForm.markAllAsTouched();
      return;
    }
    this.savingDetails.set(true);
    try {
      const value = this.diagnosisForm.getRawValue();
      const updated = await this.ordersService.updateDetails(this.orderId, {
        reportedFault: order.reportedFault,
        receptionNotes: order.receptionNotes,
        technicalDiagnosis: value.technicalDiagnosis || null,
        recommendedWork: value.recommendedWork || null,
        priority: value.priority,
        estimatedCompletionDate: value.estimatedCompletionDate || null,
        customerPrice: order.customerPrice,
        discount: order.discount,
        deposit: order.deposit,
      });
      this.order.set(updated);
      this.toast.success('Diagnóstico guardado correctamente.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar el diagnóstico.');
    } finally {
      this.savingDetails.set(false);
    }
  }

  async savePricing(): Promise<void> {
    const order = this.order();
    if (this.savingPricing() || this.pricingForm.invalid || !order) {
      this.pricingForm.markAllAsTouched();
      return;
    }
    this.savingPricing.set(true);
    try {
      const value = this.pricingForm.getRawValue();
      const updated = await this.ordersService.updateDetails(this.orderId, {
        reportedFault: order.reportedFault,
        receptionNotes: order.receptionNotes,
        technicalDiagnosis: order.technicalDiagnosis,
        recommendedWork: order.recommendedWork,
        priority: order.priority,
        estimatedCompletionDate: order.estimatedCompletionDate,
        customerPrice: Number(value.customerPrice) || 0,
        discount: Number(value.discount) || 0,
        deposit: order.deposit,
      });
      this.order.set(updated);
      this.paymentStatus.set(this.ordersService.paymentStatusOf(updated));
      this.toast.success('Presupuesto guardado correctamente.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar el presupuesto.');
    } finally {
      this.savingPricing.set(false);
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
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el estado.');
    } finally {
      this.changingStatus.set(false);
    }
  }

  async registerPayment(): Promise<void> {
    const order = this.order();
    if (this.registeringPayment() || !order || !this.paymentAmount || this.paymentAmount <= 0) {
      this.toast.error('Ingresá un importe válido.');
      return;
    }
    if (order.balanceDue <= 0) {
      this.toast.error('Esta orden ya está pagada en su totalidad.');
      return;
    }
    if (this.paymentAmount > order.balanceDue) {
      this.toast.error(
        `El importe no puede superar el saldo pendiente (${new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
        }).format(order.balanceDue)}).`,
      );
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
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
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
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo generar la garantía.');
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
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo subir el archivo.');
    } finally {
      this.uploadingFile.set(false);
      input.value = '';
    }
  }

  async viewAttachment(storagePath: string): Promise<void> {
    try {
      const url = await this.attachmentsService.getSignedUrl(storagePath);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo abrir el archivo.');
    }
  }

  async deleteAttachment(attachment: Attachment): Promise<void> {
    if (this.deletingAttachmentId()) {
      return;
    }
    if (!window.confirm(`¿Borrar "${attachment.fileName}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    this.deletingAttachmentId.set(attachment.id);
    try {
      await this.attachmentsService.remove(attachment.id, attachment.storagePath);
      this.attachments.set(await this.attachmentsService.listByOrder(this.orderId));
      this.toast.success('Archivo eliminado.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo borrar el archivo.');
    } finally {
      this.deletingAttachmentId.set(null);
    }
  }

  private async buildDeliveryReceipt(order: RepairOrder): Promise<{ blob: Blob; fileName: string }> {
    const blob = await this.receiptService.generateDeliveryReceipt(order, this.payments(), this.warranty());
    return { blob, fileName: `Comprobante-entrega-${order.code}.pdf` };
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async generateWorkOrder(): Promise<void> {
    const order = this.order();
    if (!order || this.generatingWorkOrder()) {
      return;
    }
    this.generatingWorkOrder.set(true);
    try {
      const blob = await this.receiptService.generateWorkOrder(order);
      const fileName = `Orden-de-trabajo-${order.code}.pdf`;

      await this.attachmentsService.upsertForOrder(this.orderId, blob, fileName, 'orden_trabajo');
      this.attachments.set(await this.attachmentsService.listByOrder(this.orderId));

      this.downloadBlob(blob, fileName);
      this.toast.success('Orden de trabajo generada y guardada en los adjuntos de la orden.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo generar la orden de trabajo.');
    } finally {
      this.generatingWorkOrder.set(false);
    }
  }

  /** Adjunta el enlace de la orden de trabajo al mensaje de recepción y abre WhatsApp con los dos juntos. */
  async sendWorkOrderWhatsApp(): Promise<void> {
    const order = this.order();
    if (!order || this.sendingWorkOrder()) {
      return;
    }
    this.sendingWorkOrder.set(true);
    try {
      const blob = await this.receiptService.generateWorkOrder(order);
      const fileName = `Orden-de-trabajo-${order.code}.pdf`;
      const attachment = await this.attachmentsService.upsertForOrder(this.orderId, blob, fileName, 'orden_trabajo');
      this.attachments.set(await this.attachmentsService.listByOrder(this.orderId));

      const expiresInSeconds = 60 * 60 * 24 * 7;
      const signedUrl = await this.attachmentsService.getSignedUrl(attachment.storagePath, expiresInSeconds);
      const shortUrl = await this.shortLinksService.upsertForOrder(
        this.orderId,
        `Orden de trabajo ${order.code}`,
        signedUrl,
        expiresInSeconds,
      );
      const message = this.whatsappService.appendWorkOrderLink(this.messageText, shortUrl);
      const link = this.whatsappService.buildLink(order, message);
      if (!link) {
        this.toast.error('El teléfono del cliente no es válido para WhatsApp.');
        return;
      }

      await this.whatsappService.logPrepared(order, this.selectedTemplate, message, true);
      this.communications.set(await this.whatsappService.listByOrder(this.orderId));
      window.open(link, '_blank', 'noopener');
      this.toast.success('Se generó la orden de trabajo y se abrió WhatsApp con el mensaje y el enlace.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo generar la orden de trabajo.');
    } finally {
      this.sendingWorkOrder.set(false);
    }
  }

  async generateReceipt(): Promise<void> {
    const order = this.order();
    if (!order || this.generatingReceipt()) {
      return;
    }
    this.generatingReceipt.set(true);
    try {
      const { blob, fileName } = await this.buildDeliveryReceipt(order);

      await this.attachmentsService.upsertForOrder(this.orderId, blob, fileName, 'comprobante');
      this.attachments.set(await this.attachmentsService.listByOrder(this.orderId));

      this.downloadBlob(blob, fileName);

      this.toast.success('Comprobante generado y guardado en los adjuntos de la orden.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo generar el comprobante.');
    } finally {
      this.generatingReceipt.set(false);
    }
  }

  async sendReceiptWhatsApp(): Promise<void> {
    const order = this.order();
    if (!order || this.sendingReceipt()) {
      return;
    }
    this.sendingReceipt.set(true);
    try {
      const { blob, fileName } = await this.buildDeliveryReceipt(order);
      const attachment = await this.attachmentsService.upsertForOrder(this.orderId, blob, fileName, 'comprobante');
      this.attachments.set(await this.attachmentsService.listByOrder(this.orderId));

      const expiresInSeconds = 60 * 60 * 24 * 7;
      const signedUrl = await this.attachmentsService.getSignedUrl(attachment.storagePath, expiresInSeconds);
      const shortUrl = await this.shortLinksService.upsertForOrder(
        this.orderId,
        `Comprobante ${order.code}`,
        signedUrl,
        expiresInSeconds,
      );
      const message = this.whatsappService.buildReceiptMessage(order, shortUrl);
      const link = this.whatsappService.buildLink(order, message);
      if (!link) {
        this.toast.error('El teléfono del cliente no es válido para WhatsApp.');
        return;
      }

      await this.whatsappService.logPrepared(order, 'comprobante_digital', message, true);
      this.communications.set(await this.whatsappService.listByOrder(this.orderId));
      window.open(link, '_blank', 'noopener');
      this.toast.success('Se generó el comprobante y se abrió WhatsApp con el enlace de descarga.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo enviar el comprobante por WhatsApp.');
    } finally {
      this.sendingReceipt.set(false);
    }
  }

  async sendQuoteWhatsApp(quote: Quote): Promise<void> {
    const order = this.order();
    if (!order) {
      return;
    }
    const message = this.whatsappService.buildQuoteMessage(order, quote);
    const link = this.whatsappService.buildLink(order, message);
    if (!link) {
      this.toast.error('El teléfono del cliente no es válido para WhatsApp.');
      return;
    }

    this.quoteActionBusy.set(quote.id);
    try {
      if (!quote.sentAt) {
        await this.quotesService.markSent(quote.id);
      }
      await this.whatsappService.logPrepared(order, 'presupuesto_listo', message, true);
      window.open(link, '_blank', 'noopener');
      await this.load();
      this.toast.success('Se abrió WhatsApp con el detalle del presupuesto.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo preparar el envío del presupuesto.');
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
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo registrar la respuesta del presupuesto.');
    } finally {
      this.quoteActionBusy.set(null);
    }
  }
}
