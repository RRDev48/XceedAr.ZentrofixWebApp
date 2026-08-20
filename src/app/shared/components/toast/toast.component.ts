import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="toast-stack">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.kind" (click)="toastService.dismiss(toast.id)">
          {{ toast.message }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        top: 1rem;
        right: 1rem;
        left: 1rem;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-end;
        pointer-events: none;
      }

      @media (min-width: 640px) {
        .toast-stack {
          left: auto;
          width: 22rem;
        }
      }

      .toast {
        pointer-events: auto;
        width: 100%;
        padding: 0.85rem 1rem;
        border-radius: 0.75rem;
        color: #fff;
        font-size: 0.9rem;
        font-weight: 500;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
        cursor: pointer;
        animation: toast-in 0.18s ease-out;
      }

      .toast--success {
        background: #16a34a;
      }

      .toast--error {
        background: #dc2626;
      }

      .toast--info {
        background: #0f3d63;
      }

      @keyframes toast-in {
        from {
          transform: translateY(-8px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);
}
