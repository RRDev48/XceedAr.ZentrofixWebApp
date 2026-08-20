import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { firstErrorMessage } from '../../../shared/utils/form-errors.util';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-card zf-card">
        <h1>Restablecer contraseña</h1>
        <p class="auth-desc">Ingresá tu nueva contraseña para la cuenta de Zentrofix.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="zf-field">
            <label for="password">Nueva contraseña</label>
            <input id="password" type="password" class="zf-input" formControlName="password" autocomplete="new-password" />
            @if (form.controls.password.invalid && form.controls.password.touched) {
              <span class="zf-error">{{ firstErrorMessage(form.controls.password.errors) }}</span>
            }
          </div>

          @if (errorMessage()) {
            <div class="auth-alert">{{ errorMessage() }}</div>
          }

          <button type="submit" class="zf-btn zf-btn--primary auth-submit" [disabled]="loading()">
            @if (loading()) {
              <span class="zf-spinner"></span>
            }
            Guardar contraseña
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .auth-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(160deg, var(--zf-blue-darker), var(--zf-blue-dark) 55%, var(--zf-blue));
        padding: 1.25rem;
      }

      .auth-card {
        width: 100%;
        max-width: 380px;
        padding: 2rem 1.75rem;
      }

      .auth-desc {
        color: var(--zf-text-muted);
        font-size: 0.88rem;
        margin-bottom: 1.25rem;
      }

      .auth-submit {
        width: 100%;
        margin-top: 0.5rem;
      }

      .auth-alert {
        background: #fdeaea;
        color: var(--zf-danger);
        border-radius: var(--zf-radius-sm);
        padding: 0.65rem 0.85rem;
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }
    `,
  ],
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly firstErrorMessage = firstErrorMessage;

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    const { error } = await this.auth.updatePassword(this.form.getRawValue().password);
    this.loading.set(false);
    if (error) {
      this.errorMessage.set(error);
      return;
    }
    await this.router.navigate(['/panel']);
  }
}
