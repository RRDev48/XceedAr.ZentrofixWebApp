import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomersService } from '../../../core/services/customers.service';
import { CustomerMatch } from '../../../models';
import { argentinePhoneValidator, dniValidator } from '../../../shared/validators/custom-validators';
import { firstErrorMessage } from '../../../shared/utils/form-errors.util';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { CanComponentDeactivate } from '../../../core/guards/unsaved-changes.guard';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="zf-page zf-page--narrow">
      <div class="zf-page-header">
        <h1>{{ isEdit() ? 'Editar cliente' : 'Nuevo cliente' }}</h1>
      </div>

      @if (loadingRecord()) {
        <div class="zf-empty">Cargando…</div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="zf-card">
          <div class="zf-grid-2">
            <div class="zf-field">
              <label for="firstName">Nombre *</label>
              <input id="firstName" class="zf-input" formControlName="firstName" (blur)="checkDuplicates()" />
              @if (form.controls.firstName.invalid && form.controls.firstName.touched) {
                <span class="zf-error">{{ firstErrorMessage(form.controls.firstName.errors) }}</span>
              }
            </div>
            <div class="zf-field">
              <label for="lastName">Apellido *</label>
              <input id="lastName" class="zf-input" formControlName="lastName" (blur)="checkDuplicates()" />
              @if (form.controls.lastName.invalid && form.controls.lastName.touched) {
                <span class="zf-error">{{ firstErrorMessage(form.controls.lastName.errors) }}</span>
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
              @if (form.controls.whatsappPhone.invalid && form.controls.whatsappPhone.touched) {
                <span class="zf-error">{{ firstErrorMessage(form.controls.whatsappPhone.errors) }}</span>
              } @else {
                <span class="zf-hint">Se usará para enviar mensajes por WhatsApp.</span>
              }
            </div>
            <div class="zf-field">
              <label for="dni">DNI</label>
              <input id="dni" class="zf-input" formControlName="dni" (blur)="checkDuplicates()" />
              @if (form.controls.dni.invalid && form.controls.dni.touched) {
                <span class="zf-error">{{ firstErrorMessage(form.controls.dni.errors) }}</span>
              }
            </div>
          </div>

          @if (duplicates().length > 0) {
            <div class="duplicate-warning">
              ⚠️ Ya existe{{ duplicates().length > 1 ? 'n' : '' }} un cliente con ese teléfono o DNI:
              @for (d of duplicates(); track d.id) {
                <a [routerLink]="['/clientes', d.id]">{{ d.firstName }} {{ d.lastName }}</a>
              }
              . Verificá antes de continuar para no duplicar el registro.
            </div>
          }

          <div class="zf-grid-2">
            <div class="zf-field">
              <label for="email">Correo electrónico</label>
              <input id="email" type="email" class="zf-input" formControlName="email" />
              @if (form.controls.email.invalid && form.controls.email.touched) {
                <span class="zf-error">{{ firstErrorMessage(form.controls.email.errors) }}</span>
              }
            </div>
            <div class="zf-field">
              <label for="address">Dirección</label>
              <input id="address" class="zf-input" formControlName="address" />
            </div>
          </div>

          <div class="zf-field">
            <label for="notes">Observaciones</label>
            <textarea id="notes" class="zf-textarea" formControlName="notes"></textarea>
          </div>

          <div class="form-actions">
            <a routerLink="/clientes" class="zf-btn zf-btn--ghost">Cancelar</a>
            <button type="submit" class="zf-btn zf-btn--primary" [disabled]="saving()">
              @if (saving()) {
                <span class="zf-spinner"></span>
              }
              Guardar cliente
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

      .duplicate-warning {
        background: var(--zf-purple-soft);
        color: var(--zf-text-secondary);
        border: 1px solid rgba(156, 44, 255, 0.35);
        border-radius: var(--zf-radius-sm);
        padding: 0.75rem 0.9rem;
        font-size: 0.85rem;
        margin-bottom: 1rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }

      .duplicate-warning a {
        color: var(--zf-blue);
        font-weight: 600;
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
export class CustomerFormComponent implements OnInit, CanComponentDeactivate {
  private readonly fb = inject(FormBuilder);
  private readonly customersService = inject(CustomersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly firstErrorMessage = firstErrorMessage;
  protected readonly saving = signal(false);
  protected readonly loadingRecord = signal(false);
  protected readonly duplicates = signal<CustomerMatch[]>([]);
  protected readonly isEdit = signal(false);

  private customerId: string | null = null;
  private savedSuccessfully = false;

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    whatsappPhone: ['', [Validators.required, argentinePhoneValidator()]],
    dni: ['', [dniValidator()]],
    email: ['', [Validators.email]],
    address: [''],
    notes: [''],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.customerId = id;
      this.loadingRecord.set(true);
      try {
        const customer = await this.customersService.getById(id);
        if (customer) {
          this.form.patchValue({
            firstName: customer.firstName,
            lastName: customer.lastName,
            whatsappPhone: customer.whatsappPhone,
            dni: customer.dni ?? '',
            email: customer.email ?? '',
            address: customer.address ?? '',
            notes: customer.notes ?? '',
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

  async checkDuplicates(): Promise<void> {
    const { whatsappPhone, dni } = this.form.getRawValue();
    if (!whatsappPhone && !dni) {
      this.duplicates.set([]);
      return;
    }
    try {
      const matches = await this.customersService.findPossibleDuplicates(whatsappPhone, dni || null);
      this.duplicates.set(matches.filter((m) => m.id !== this.customerId));
    } catch {
      // La verificación de duplicados es una ayuda, no bloquea el flujo si falla.
    }
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
    try {
      const customer = this.customerId
        ? await this.customersService.update(this.customerId, {
            ...value,
            dni: value.dni || null,
            email: value.email || null,
            address: value.address || null,
            notes: value.notes || null,
          })
        : await this.customersService.create({
            ...value,
            dni: value.dni || null,
            email: value.email || null,
            address: value.address || null,
            notes: value.notes || null,
          });

      this.savedSuccessfully = true;
      this.toast.success(this.customerId ? 'Cliente actualizado correctamente.' : 'Cliente creado correctamente.');
      await this.router.navigate(['/clientes', customer.id]);
    } catch (err) {
      this.toast.error('No se pudo guardar el cliente. Intentá nuevamente.');
    } finally {
      this.saving.set(false);
    }
  }
}
