import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { CustomersService } from '../../../core/services/customers.service';
import { Customer } from '../../../models';
import { ToastService } from '../../../shared/components/toast/toast.service';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Clientes</h1>
          <p class="zf-subtitle">{{ customers().length }} clientes registrados</p>
        </div>
        <a routerLink="/clientes/nuevo" class="zf-btn zf-btn--primary">+ Nuevo cliente</a>
      </div>

      <div class="zf-card search-card">
        <input
          class="zf-input"
          type="search"
          placeholder="Buscar por nombre, WhatsApp o DNI…"
          [(ngModel)]="search"
          (ngModelChange)="onSearchChange()"
        />
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando clientes…</div>
      } @else if (customers().length === 0) {
        <div class="zf-empty zf-card">No se encontraron clientes con ese criterio.</div>
      } @else {
        <div class="zf-table-wrap desktop-only">
          <table class="zf-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>WhatsApp</th>
                <th>DNI</th>
                <th>Alta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of customers(); track c.id) {
                <tr>
                  <td>{{ c.firstName }} {{ c.lastName }}</td>
                  <td>{{ c.whatsappPhone }}</td>
                  <td>{{ c.dni || '—' }}</td>
                  <td>{{ c.createdAt | date: 'dd/MM/yyyy' }}</td>
                  <td>
                    <a [routerLink]="['/clientes', c.id]" class="zf-btn zf-btn--ghost zf-btn--sm">Ver</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="card-list mobile-only">
          @for (c of customers(); track c.id) {
            <a [routerLink]="['/clientes', c.id]" class="customer-card zf-card">
              <div class="customer-card__name">{{ c.firstName }} {{ c.lastName }}</div>
              <div class="customer-card__meta">{{ c.whatsappPhone }}</div>
              @if (c.dni) {
                <div class="customer-card__meta">DNI {{ c.dni }}</div>
              }
            </a>
          }
        </div>
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

      .search-card {
        margin-bottom: 1rem;
        padding: 0.75rem;
      }

      .desktop-only {
        display: none;
      }

      .card-list {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }

      .customer-card {
        text-decoration: none;
        color: inherit;
        padding: 1rem;
      }

      .customer-card__name {
        font-weight: 700;
        color: var(--zf-blue-darker);
        margin-bottom: 0.2rem;
      }

      .customer-card__meta {
        font-size: 0.85rem;
        color: var(--zf-text-muted);
      }

      @media (min-width: 900px) {
        .desktop-only {
          display: block;
        }

        .mobile-only {
          display: none;
        }
      }
    `,
  ],
})
export class CustomerListComponent implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly toast = inject(ToastService);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly loading = signal(true);
  protected search = '';
  private searchTimeout?: ReturnType<typeof setTimeout>;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.load(), 300);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const results = await this.customersService.list(this.search);
      this.customers.set(results);
    } catch {
      this.toast.error('No se pudieron cargar los clientes.');
    } finally {
      this.loading.set(false);
    }
  }
}
