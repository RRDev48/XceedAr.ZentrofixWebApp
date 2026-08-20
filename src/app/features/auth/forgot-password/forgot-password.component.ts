import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { firstErrorMessage } from '../../../shared/utils/form-errors.util';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card zf-card">
        <h1>Recuperar contraseña</h1>
        <p class="auth-desc">Ingresá tu correo electrónico y te enviaremos un enlace para restablecerla.</p>

        @if (sent()) {
          <div class="auth-success">
            Si el correo está registrado, vas a recibir un enlace para restablecer tu contraseña en unos minutos.
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="zf-field">
              <label for="email">Correo electrónico</label>
              <input id="email" type="email" class="zf-input" formControlName="email" autocomplete="username" />
              @if (form.controls.email.invalid && form.controls.email.touched) {
                <span class="zf-error">{{ firstErrorMessage(form.controls.email.errors) }}</span>
              }
            </div>

            @if (errorMessage()) {
              <div class="auth-alert">{{ errorMessage() }}</div>
            }

            <button type="submit" class="zf-btn zf-btn--primary auth-submit" [disabled]="loading()">
              @if (loading()) {
                <span class="zf-spinner"></span>
              }
              Enviar enlace
            </button>
          </form>
        }

        <a routerLink="/auth/ingresar" class="auth-forgot">Volver a ingresar</a>
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

      .auth-success {
        background: #e6f7ec;
        color: var(--zf-green-dark);
        border-radius: var(--zf-radius-sm);
        padding: 0.85rem;
        font-size: 0.88rem;
      }

      .auth-forgot {
        display: block;
        text-align: center;
        margin-top: 1.25rem;
        font-size: 0.85rem;
        text-decoration: none;
      }
    `,
  ],
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly sent = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly firstErrorMessage = firstErrorMessage;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
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
    const { error } = await this.auth.requestPasswordReset(this.form.getRawValue().email);
    this.loading.set(false);
    if (error) {
      this.errorMessage.set(error);
      return;
    }
    this.sent.set(true);
  }
}
