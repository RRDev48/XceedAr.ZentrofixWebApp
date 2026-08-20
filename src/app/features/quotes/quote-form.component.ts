import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { QuotesService } from '../../core/services/quotes.service';
import { RepairOrdersService } from '../../core/services/repair-orders.service';
import { RepairOrder } from '../../models';
import { positiveAmountValidator } from '../../shared/validators/custom-validators';
import { firstErrorMessage } from '../../shared/utils/form-errors.util';
import { ToastService } from '../../shared/components/toast/toast.service';
import { CanComponentDeactivate } from '../../core/guards/unsaved-changes.guard';

@Component({
  selector: 'app-quote-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="zf-page zf-page--narrow">
      <div class="zf-page-header">
        <h1>{{ isEdit() ? 'Editar presupuesto' : 'Nuevo presupuesto' }}</h1>
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando…</div>
      } @else if (order()) {
        <p class="order-ref">
          {{ order()!.code }} — {{ order()!.customerName }} · {{ order()!.deviceLabel }}
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="zf-card">
          <h2>Ítems / repuestos</h2>

          <div class="items-table">
            @for (item of items.controls; track $index) {
              <div class="item-row" [formGroup]="asGroup(item)">
                <input class="zf-input" formControlName="description" placeholder="Descripción" />
                <input class="zf-input" type="number" min="1" step="1" formControlName="quantity" placeholder="Cant." />
                <input class="zf-input" type="number" min="0" step="0.01" formControlName="unitCost" placeholder="Costo unit." />
                <input class="zf-input" type="number" min="0" step="0.01" formControlName="unitPrice" placeholder="Precio unit." />
                <button type="button" class="zf-btn zf-btn--ghost zf-btn--sm" (click)="removeItem($index)">Quitar</button>
              </div>
            }
          </div>

          <button type="button" class="zf-btn zf-btn--ghost zf-btn--sm add-item-btn" (click)="addItem()">
            + Agregar ítem
          </button>

          <div class="zf-grid-2">
            <div class="zf-field">
              <label for="laborCost">Mano de obra</label>
              <input id="laborCost" type="number" min="0" step="0.01" class="zf-input" formControlName="laborCost" />
              @if (form.controls.laborCost.invalid && form.controls.laborCost.touched) {
                <span class="zf-error">{{ firstErrorMessage(form.controls.laborCost.errors) }}</span>
              }
            </div>
            <div class="zf-field">
              <label for="discount">Descuento</label>
              <input id="discount" type="number" min="0" step="0.01" class="zf-input" formControlName="discount" />
            </div>
          </div>

          <div class="zf-field">
            <label for="validUntil">Vigencia (hasta)</label>
            <input id="validUntil" type="date" class="zf-input" formControlName="validUntil" />
          </div>

          <div class="zf-field">
            <label for="customerNotes">Observaciones para el cliente</label>
            <textarea id="customerNotes" class="zf-textarea" formControlName="customerNotes"></textarea>
          </div>

          <div class="total-preview">Total estimado: <strong>{{ totalPreview() | number: '1.0-2' }}</strong></div>

          <div class="form-actions">
            <a [routerLink]="['/ordenes', orderId]" class="zf-btn zf-btn--ghost">Cancelar</a>
            <button type="submit" class="zf-btn zf-btn--primary" [disabled]="saving()">
              @if (saving()) {
                <span class="zf-spinner"></span>
              }
              Guardar presupuesto
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .zf-page--narrow {
        max-width: 780px;
      }

      .order-ref {
        color: var(--zf-text-muted);
        font-size: 0.88rem;
        margin: -0.5rem 0 1rem;
      }

      .zf-card h2 {
        font-size: 1rem;
        margin-bottom: 0.85rem;
      }

      .items-table {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      .item-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.4rem;
      }

      @media (min-width: 720px) {
        .item-row {
          grid-template-columns: 2fr 0.7fr 1fr 1fr auto;
          align-items: center;
        }
      }

      .add-item-btn {
        margin-bottom: 1.25rem;
      }

      .total-preview {
        background: var(--zf-blue-soft);
        border: 1px solid rgba(30, 155, 255, 0.3);
        border-radius: var(--zf-radius-sm);
        padding: 0.75rem 0.9rem;
        font-size: 0.92rem;
        color: var(--zf-text);
        margin-bottom: 1rem;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
    `,
  ],
})
export class QuoteFormComponent implements OnInit, CanComponentDeactivate {
  private readonly fb = inject(FormBuilder);
  private readonly quotesService = inject(QuotesService);
  private readonly ordersService = inject(RepairOrdersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly firstErrorMessage = firstErrorMessage;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly isEdit = signal(false);
  protected readonly order = signal<RepairOrder | null>(null);

  protected orderId = '';
  private quoteId: string | null = null;
  private savedSuccessfully = false;

  protected readonly form = this.fb.nonNullable.group({
    laborCost: [0, [positiveAmountValidator()]],
    discount: [0, [positiveAmountValidator()]],
    validUntil: [''],
    customerNotes: [''],
    items: this.fb.array<ReturnType<typeof this.buildItemGroup>>([]),
  });

  get items(): FormArray {
    return this.form.controls.items;
  }

  asGroup(control: unknown) {
    return control as ReturnType<typeof this.buildItemGroup>;
  }

  private buildItemGroup(item?: { description: string; quantity: number; unitCost: number; unitPrice: number }) {
    return this.fb.nonNullable.group({
      description: [item?.description ?? '', [Validators.required]],
      quantity: [item?.quantity ?? 1, [Validators.required, Validators.min(1)]],
      unitCost: [item?.unitCost ?? 0, [positiveAmountValidator()]],
      unitPrice: [item?.unitPrice ?? 0, [positiveAmountValidator()]],
    });
  }

  addItem(): void {
    this.items.push(this.buildItemGroup());
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  totalPreview(): number {
    const { laborCost, discount, items } = this.form.getRawValue();
    const itemsTotal = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);
    const total = Number(laborCost || 0) + itemsTotal - Number(discount || 0);
    return total > 0 ? total : 0;
  }

  async ngOnInit(): Promise<void> {
    this.orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
    this.quoteId = this.route.snapshot.paramMap.get('quoteId');
    this.isEdit.set(!!this.quoteId);

    this.loading.set(true);
    try {
      this.order.set(await this.ordersService.getById(this.orderId));

      if (this.quoteId) {
        const quotes = await this.quotesService.listByOrder(this.orderId);
        const quote = quotes.find((q) => q.id === this.quoteId);
        if (quote) {
          this.form.patchValue({
            laborCost: quote.laborCost,
            discount: quote.discount,
            validUntil: quote.validUntil ?? '',
            customerNotes: quote.customerNotes ?? '',
          });
          for (const item of quote.items) {
            this.items.push(this.buildItemGroup(item));
          }
        }
      }

      if (this.items.length === 0) {
        this.addItem();
      }
    } finally {
      this.loading.set(false);
    }
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.savedSuccessfully;
  }

  async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      await this.quotesService.save(this.orderId, this.quoteId, {
        laborCost: Number(value.laborCost) || 0,
        discount: Number(value.discount) || 0,
        validUntil: value.validUntil || null,
        customerNotes: value.customerNotes || null,
        items: value.items.map((i) => ({
          id: null,
          description: i.description,
          quantity: Number(i.quantity) || 0,
          unitCost: Number(i.unitCost) || 0,
          unitPrice: Number(i.unitPrice) || 0,
        })),
      });
      this.savedSuccessfully = true;
      this.toast.success('Presupuesto guardado correctamente.');
      await this.router.navigate(['/ordenes', this.orderId]);
    } catch {
      this.toast.error('No se pudo guardar el presupuesto.');
    } finally {
      this.saving.set(false);
    }
  }
}
