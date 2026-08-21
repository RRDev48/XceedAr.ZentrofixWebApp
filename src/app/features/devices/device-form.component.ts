import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DevicesService } from '../../core/services/devices.service';
import { CustomersService } from '../../core/services/customers.service';
import { DeviceType, DEVICE_TYPE_LABELS } from '../../models';
import { imeiOrSerialValidator } from '../../shared/validators/custom-validators';
import { firstErrorMessage } from '../../shared/utils/form-errors.util';
import { ToastService } from '../../shared/components/toast/toast.service';
import { CanComponentDeactivate } from '../../core/guards/unsaved-changes.guard';

@Component({
  selector: 'app-device-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="zf-page zf-page--narrow">
      <div class="zf-page-header">
        <h1>{{ isEdit() ? 'Editar equipo' : 'Nuevo equipo' }}</h1>
      </div>

      @if (loadingRecord()) {
        <div class="zf-empty">Cargando…</div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="zf-card">
          <div class="zf-grid-2">
            <div class="zf-field">
              <label for="deviceType">Tipo de dispositivo *</label>
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
              <input id="brand" class="zf-input" formControlName="brand" placeholder="Samsung, Motorola, Apple…" />
              @if (form.controls.brand.invalid && form.controls.brand.touched) {
                <span class="zf-error">{{ firstErrorMessage(form.controls.brand.errors) }}</span>
              }
            </div>
            <div class="zf-field">
              <label for="model">Modelo *</label>
              <input id="model" class="zf-input" formControlName="model" placeholder="Galaxy A54, iPhone 12…" />
              @if (form.controls.model.invalid && form.controls.model.touched) {
                <span class="zf-error">{{ firstErrorMessage(form.controls.model.errors) }}</span>
              }
            </div>
          </div>

          <div class="zf-field">
            <label for="imeiOrSerial">IMEI o número de serie</label>
            <input id="imeiOrSerial" class="zf-input" formControlName="imeiOrSerial" />
            @if (form.controls.imeiOrSerial.invalid && form.controls.imeiOrSerial.touched) {
              <span class="zf-error">{{ firstErrorMessage(form.controls.imeiOrSerial.errors) }}</span>
            }
          </div>

          <div class="zf-field">
            <label for="accessDetail">Contraseña, PIN o patrón de prueba</label>
            <input id="accessDetail" class="zf-input" formControlName="accessDetail" autocomplete="off" />
            <span class="zf-hint">Dato sensible: solo se muestra en la ficha del equipo, nunca en listados.</span>
          </div>

          <div class="zf-field">
            <label for="accessories">Accesorios entregados</label>
            <input id="accessories" class="zf-input" formControlName="accessories" placeholder="Cargador, funda, chip…" />
          </div>

          <div class="zf-field">
            <label for="physicalConditionIn">Estado físico al recibir</label>
            <textarea id="physicalConditionIn" class="zf-textarea" formControlName="physicalConditionIn"></textarea>
          </div>

          <div class="zf-field">
            <label for="notes">Observaciones</label>
            <textarea id="notes" class="zf-textarea" formControlName="notes"></textarea>
          </div>

          <div class="form-actions">
            @if (isEdit()) {
              <button
                type="button"
                class="zf-btn zf-btn--ghost zf-btn--danger form-actions__delete"
                [disabled]="deleting()"
                (click)="deleteDevice()"
              >
                Eliminar equipo
              </button>
            }
            <a [routerLink]="cancelLink" class="zf-btn zf-btn--ghost">Cancelar</a>
            <button type="submit" class="zf-btn zf-btn--primary" [disabled]="saving()">
              @if (saving()) {
                <span class="zf-spinner"></span>
              }
              Guardar equipo
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

      .form-actions__delete {
        margin-right: auto;
      }
    `,
  ],
})
export class DeviceFormComponent implements OnInit, CanComponentDeactivate {
  private readonly fb = inject(FormBuilder);
  private readonly devicesService = inject(DevicesService);
  private readonly customersService = inject(CustomersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly firstErrorMessage = firstErrorMessage;
  protected readonly deviceTypeLabels = DEVICE_TYPE_LABELS;
  protected readonly deviceTypes: DeviceType[] = ['celular', 'tablet', 'notebook', 'consola', 'otro'];
  protected readonly saving = signal(false);
  protected readonly loadingRecord = signal(false);
  protected readonly isEdit = signal(false);
  protected readonly deleting = signal(false);
  protected cancelLink: string[] = ['/clientes'];

  private deviceId: string | null = null;
  private customerId = '';
  private savedSuccessfully = false;

  protected readonly form = this.fb.nonNullable.group({
    deviceType: ['celular' as DeviceType, [Validators.required]],
    brand: ['', [Validators.required, Validators.minLength(2)]],
    model: ['', [Validators.required, Validators.minLength(1)]],
    color: [''],
    imeiOrSerial: ['', [imeiOrSerialValidator()]],
    accessDetail: [''],
    accessories: [''],
    physicalConditionIn: [''],
    notes: [''],
  });

  async ngOnInit(): Promise<void> {
    const editId = this.route.snapshot.paramMap.get('id');
    const newForCustomerId = this.route.snapshot.paramMap.get('customerId');

    if (editId) {
      this.isEdit.set(true);
      this.deviceId = editId;
      this.loadingRecord.set(true);
      try {
        const device = await this.devicesService.getById(editId);
        if (device) {
          this.customerId = device.customerId;
          this.cancelLink = ['/clientes', this.customerId];
          this.form.patchValue({
            deviceType: device.deviceType,
            brand: device.brand,
            model: device.model,
            color: device.color ?? '',
            imeiOrSerial: device.imeiOrSerial ?? '',
            accessDetail: device.accessDetail ?? '',
            accessories: device.accessories ?? '',
            physicalConditionIn: device.physicalConditionIn ?? '',
            notes: device.notes ?? '',
          });
        }
      } finally {
        this.loadingRecord.set(false);
      }
    } else if (newForCustomerId) {
      this.customerId = newForCustomerId;
      this.cancelLink = ['/clientes', this.customerId];
      const customer = await this.customersService.getById(newForCustomerId);
      if (!customer) {
        this.toast.error('No se encontró el cliente indicado.');
        await this.router.navigate(['/clientes']);
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
      customerId: this.customerId,
      deviceType: value.deviceType,
      brand: value.brand,
      model: value.model,
      color: value.color || null,
      imeiOrSerial: value.imeiOrSerial || null,
      accessDetail: value.accessDetail || null,
      accessories: value.accessories || null,
      physicalConditionIn: value.physicalConditionIn || null,
      notes: value.notes || null,
    };

    try {
      const device = this.deviceId
        ? await this.devicesService.update(this.deviceId, payload)
        : await this.devicesService.create(payload);

      this.savedSuccessfully = true;
      this.toast.success(this.deviceId ? 'Equipo actualizado correctamente.' : 'Equipo registrado correctamente.');
      await this.router.navigate(['/clientes', device.customerId]);
    } catch {
      this.toast.error('No se pudo guardar el equipo. Intentá nuevamente.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteDevice(): Promise<void> {
    if (!this.deviceId || this.deleting()) {
      return;
    }
    const confirmed = window.confirm('¿Eliminar este equipo? Vas a poder restaurarlo luego desde Papelera.');
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    try {
      await this.devicesService.remove(this.deviceId);
      this.savedSuccessfully = true;
      this.toast.success('Equipo eliminado.');
      await this.router.navigate(['/clientes', this.customerId]);
    } catch {
      this.toast.error('No se pudo eliminar el equipo.');
    } finally {
      this.deleting.set(false);
    }
  }
}
