import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { firstErrorMessage } from '../../../shared/utils/form-errors.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card zf-card">
        <div class="auth-brand">
          <img src="assets/branding/logo-principal.png" alt="Zentrofix" class="auth-brand__logo" />
          <p>Gestión técnica</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="zf-field">
            <label for="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              class="zf-input"
              formControlName="email"
              autocomplete="username"
              placeholder="admin@zentrofix.com"
            />
            @if (form.controls.email.invalid && form.controls.email.touched) {
              <span class="zf-error">{{ errorFor('email') }}</span>
            }
          </div>

          <div class="zf-field">
            <label for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              class="zf-input"
              formControlName="password"
              autocomplete="current-password"
              placeholder="••••••••"
            />
            @if (form.controls.password.invalid && form.controls.password.touched) {
              <span class="zf-error">{{ errorFor('password') }}</span>
            }
          </div>

          @if (errorMessage()) {
            <div class="auth-alert">{{ errorMessage() }}</div>
          }

          <button type="submit" class="zf-btn zf-btn--primary auth-submit" [disabled]="loading()">
            @if (loading()) {
              <span class="zf-spinner"></span>
            }
            Ingresar
          </button>
        </form>

        <a routerLink="/auth/recuperar-contrasena" class="auth-forgot">Olvidé mi contraseña</a>
        <a routerLink="/seguimiento" class="auth-tracking">¿Sos cliente? Consultá el estado de tu equipo</a>
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
        background: radial-gradient(circle at 12% 88%, rgba(156, 44, 255, 0.22), transparent 45%),
          radial-gradient(circle at 88% 8%, rgba(30, 155, 255, 0.22), transparent 45%), var(--zf-bg);
        padding: 1.25rem;
      }

      .auth-card {
        width: 100%;
        max-width: 380px;
        padding: 2rem 1.75rem;
      }

      .auth-brand {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.5rem;
        margin-bottom: 1.75rem;
      }

      .auth-brand__logo {
        width: 100%;
        max-width: 220px;
        height: auto;
      }

      .auth-brand p {
        margin: 0;
        font-size: 0.82rem;
        color: var(--zf-text-muted);
      }

      .auth-submit {
        width: 100%;
        margin-top: 0.5rem;
      }

      .auth-alert {
        background: var(--zf-danger-soft);
        color: var(--zf-danger);
        border-radius: var(--zf-radius-sm);
        padding: 0.65rem 0.85rem;
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }

      .auth-forgot {
        display: block;
        text-align: center;
        margin-top: 1.25rem;
        font-size: 0.85rem;
        text-decoration: none;
      }

      .auth-tracking {
        display: block;
        text-align: center;
        margin-top: 0.65rem;
        font-size: 0.8rem;
        color: var(--zf-text-muted);
        text-decoration: none;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  errorFor(control: 'email' | 'password'): string | null {
    return firstErrorMessage(this.form.controls[control].errors);
  }

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
    const { email, password } = this.form.getRawValue();
    const { error } = await this.auth.signIn(email, password);
    this.loading.set(false);

    if (error) {
      this.errorMessage.set(error);
      return;
    }
    await this.router.navigate(['/panel']);
  }
}
