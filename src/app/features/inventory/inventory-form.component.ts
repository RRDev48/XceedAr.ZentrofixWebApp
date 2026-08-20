import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InventoryService } from '../../core/services/inventory.service';
import { positiveAmountValidator } from '../../shared/validators/custom-validators';
import { firstErrorMessage } from '../../shared/utils/form-errors.util';
import { ToastService } from '../../shared/components/toast/toast.service';
import { CanComponentDeactivate } from '../../core/guards/unsaved-changes.guard';

@Component({
  selector: 'app-inventory-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="zf-page zf-page--narrow">
      <div class="zf-page-header">
        <h1>{{ isEdit() ? 'Editar ítem' : 'Nuevo ítem de inventario' }}</h1>
      </div>

      @if (loadingRecord()) {
        <div class="zf-empty">Cargando…</div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="zf-card">
          <div class="zf-grid-2">
            <div class="zf-field">
              <label for="name">Nombre *</label>
              <input id="name" class="zf-input" formControlName="name" placeholder="Módulo Galaxy A54" />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <span class="zf-error">{{ firstErrorMessage(form.controls.name.errors) }}</span>
              }
            </div>
            <div class="zf-field">
              <label for="sku">SKU / código</label>
              <input id="sku" class="zf-input" formControlName="sku" />
            </div>
          </div>

          <div class="zf-field">
            <label for="description">Descripción</label>
            <textarea id="description" class="zf-textarea" formControlName="description"></textarea>
          </div>

          <div class="zf-grid-2">
            <div class="zf-field">
              <label for="unitCost">Costo unitario</label>
              <input id="unitCost" type="number" min="0" step="0.01" class="zf-input" formControlName="unitCost" />
            </div>
            <div class="zf-field">
              <label for="unitPrice">Precio de venta</label>
              <input id="unitPrice" type="number" min="0" step="0.01" class="zf-input" formControlName="unitPrice" />
            </div>
          </div>

          <div class="zf-grid-2">
            <div class="zf-field">
              <label for="minimumStock">Stock mínimo</label>
              <input id="minimumStock" type="number" min="0" step="1" class="zf-input" formControlName="minimumStock" />
              <span class="zf-hint">Debajo de este valor se marca como stock crítico.</span>
            </div>
            @if (!isEdit()) {
              <div class="zf-field">
                <label for="initialStock">Stock inicial</label>
                <input id="initialStock" type="number" min="0" step="1" class="zf-input" formControlName="initialStock" />
              </div>
            }
          </div>

          <div class="form-actions">
            <a routerLink="/inventario" class="zf-btn zf-btn--ghost">Cancelar</a>
            <button type="submit" class="zf-btn zf-btn--primary" [disabled]="saving()">
              @if (saving()) {
                <span class="zf-spinner"></span>
              }
              Guardar ítem
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .zf-page--narrow {
        max-width: 720px;
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
export class InventoryFormComponent implements OnInit, CanComponentDeactivate {
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly firstErrorMessage = firstErrorMessage;
  protected readonly saving = signal(false);
  protected readonly loadingRecord = signal(false);
  protected readonly isEdit = signal(false);

  private itemId: string | null = null;
  private savedSuccessfully = false;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    sku: [''],
    description: [''],
    unitCost: [0, [positiveAmountValidator()]],
    unitPrice: [0, [positiveAmountValidator()]],
    minimumStock: [0, [positiveAmountValidator()]],
    initialStock: [0, [positiveAmountValidator()]],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.itemId = id;
      this.loadingRecord.set(true);
      try {
        const item = await this.inventoryService.getById(id);
        if (item) {
          this.form.patchValue({
            name: item.name,
            sku: item.sku ?? '',
            description: item.description ?? '',
            unitCost: item.unitCost,
            unitPrice: item.unitPrice,
            minimumStock: item.minimumStock,
          });
        }
      } finally {
        this.loadingRecord.set(false);
      }
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
    const value = this.form.getRawValue();
    const payload = {
      sku: value.sku || null,
      name: value.name,
      description: value.description || null,
      minimumStock: Number(value.minimumStock) || 0,
      unitCost: Number(value.unitCost) || 0,
      unitPrice: Number(value.unitPrice) || 0,
    };

    try {
      const item = this.itemId
        ? await this.inventoryService.update(this.itemId, payload)
        : await this.inventoryService.create(payload, Number(value.initialStock) || 0);

      this.savedSuccessfully = true;
      this.toast.success(this.itemId ? 'Ítem actualizado correctamente.' : 'Ítem creado correctamente.');
      await this.router.navigate(['/inventario', item.id]);
    } catch {
      this.toast.error('No se pudo guardar el ítem.');
    } finally {
      this.saving.set(false);
    }
  }
}
