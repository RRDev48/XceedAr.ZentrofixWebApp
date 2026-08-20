import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { TrackingService, PublicOrderTracking } from '../../core/services/tracking.service';
import { REPAIR_STATUS_LABELS } from '../../models';

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [FormsModule, DatePipe, CurrencyPipe],
  template: `
    <div class="tracking-page">
      <div class="tracking-card zf-card">
        <img src="assets/branding/logo-principal.png" alt="Zentrofix" class="tracking-logo" />
        <h1>Seguimiento de tu reparación</h1>
        <p class="tracking-desc">Ingresá el código de tu orden y tu número de WhatsApp para consultar el estado.</p>

        <div class="zf-field">
          <label for="code">Código de orden</label>
          <input id="code" class="zf-input" [(ngModel)]="code" placeholder="ZF-2026-000123" />
        </div>
        <div class="zf-field">
          <label for="phone">Tu WhatsApp</label>
          <input id="phone" class="zf-input" [(ngModel)]="phone" placeholder="341 5123456" />
        </div>

        <button type="button" class="zf-btn zf-btn--primary tracking-submit" [disabled]="loading()" (click)="search()">
          @if (loading()) {
            <span class="zf-spinner"></span>
          }
          Consultar estado
        </button>

        @if (searched() && !result() && !loading()) {
          <div class="tracking-alert">
            No encontramos una orden con esos datos. Verificá el código y el número ingresados.
          </div>
        }

        @if (result()) {
          <div class="tracking-result">
            <div class="tracking-result__row">
              <span>Hola {{ result()!.customerFirstName }}, tu equipo</span>
              <strong>{{ result()!.deviceBrand }} {{ result()!.deviceModel }}</strong>
            </div>
            <div class="tracking-status">{{ statusLabels[result()!.status] }}</div>
            <div class="tracking-result__row">
              <span>Ingreso:</span>
              <strong>{{ result()!.receivedAt | date: 'dd/MM/yyyy' }}</strong>
            </div>
            @if (result()!.estimatedCompletionDate) {
              <div class="tracking-result__row">
                <span>Fecha estimada:</span>
                <strong>{{ result()!.estimatedCompletionDate | date: 'dd/MM/yyyy' }}</strong>
              </div>
            }
            @if (result()!.balanceDue > 0) {
              <div class="tracking-result__row">
                <span>Saldo pendiente:</span>
                <strong>{{ result()!.balanceDue | currency: 'ARS' : 'symbol-narrow' : '1.0-2' }}</strong>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .tracking-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at 12% 88%, rgba(156, 44, 255, 0.22), transparent 45%),
          radial-gradient(circle at 88% 8%, rgba(30, 155, 255, 0.22), transparent 45%), var(--zf-bg);
        padding: 1.25rem;
      }

      .tracking-card {
        width: 100%;
        max-width: 420px;
        padding: 2rem 1.75rem;
        text-align: center;
      }

      .tracking-logo {
        width: 100%;
        max-width: 200px;
        margin-bottom: 1.25rem;
      }

      .tracking-card h1 {
        font-size: 1.2rem;
        margin-bottom: 0.4rem;
      }

      .tracking-desc {
        color: var(--zf-text-muted);
        font-size: 0.85rem;
        margin-bottom: 1.25rem;
        text-align: left;
      }

      .zf-field {
        text-align: left;
      }

      .tracking-submit {
        width: 100%;
        margin-top: 0.5rem;
      }

      .tracking-alert {
        margin-top: 1.25rem;
        background: var(--zf-danger-soft);
        color: var(--zf-danger);
        border-radius: var(--zf-radius-sm);
        padding: 0.75rem;
        font-size: 0.85rem;
      }

      .tracking-result {
        margin-top: 1.5rem;
        text-align: left;
        background: var(--zf-surface-2);
        border: 1px solid var(--zf-border-soft);
        border-radius: var(--zf-radius-sm);
        padding: 1rem;
      }

      .tracking-status {
        display: inline-flex;
        margin: 0.5rem 0;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        background: var(--zf-blue-soft);
        color: var(--zf-blue);
        font-weight: 600;
        font-size: 0.85rem;
      }

      .tracking-result__row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        font-size: 0.88rem;
        color: var(--zf-text-secondary);
        padding: 0.3rem 0;
      }
    `,
  ],
})
export class TrackingComponent {
  private readonly trackingService = inject(TrackingService);

  protected readonly statusLabels = REPAIR_STATUS_LABELS;
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly result = signal<PublicOrderTracking | null>(null);

  protected code = '';
  protected phone = '';

  async search(): Promise<void> {
    if (this.loading() || !this.code.trim() || !this.phone.trim()) {
      return;
    }
    this.loading.set(true);
    this.searched.set(false);
    try {
      const result = await this.trackingService.track(this.code, this.phone);
      this.result.set(result);
      this.searched.set(true);
    } catch {
      this.result.set(null);
      this.searched.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
