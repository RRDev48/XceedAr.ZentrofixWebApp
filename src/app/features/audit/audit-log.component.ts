import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuditLogEntry, AuditLogsService } from '../../core/services/audit-logs.service';
import { ToastService } from '../../shared/components/toast/toast.service';

const TABLE_LABELS: Record<string, string> = {
  customers: 'Clientes',
  devices: 'Equipos',
  repair_orders: 'Órdenes',
  payments: 'Pagos',
  cash_movements: 'Caja',
  warranties: 'Garantías',
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Creación',
  UPDATE: 'Modificación',
  DELETE: 'Eliminación',
};

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="zf-page">
      <div class="zf-page-header">
        <div>
          <h1>Actividad reciente</h1>
          <p class="zf-subtitle">Historial de cambios en el sistema</p>
        </div>
      </div>

      <div class="zf-card filters-card">
        <div class="zf-field">
          <label for="tableFilter">Sección</label>
          <select id="tableFilter" class="zf-select" [(ngModel)]="tableFilter" (ngModelChange)="load()">
            <option value="">Todas</option>
            @for (t of tableOptions; track t.value) {
              <option [value]="t.value">{{ t.label }}</option>
            }
          </select>
        </div>
      </div>

      @if (loading()) {
        <div class="zf-empty">Cargando actividad…</div>
      } @else if (entries().length === 0) {
        <div class="zf-empty zf-card">No hay actividad registrada todavía.</div>
      } @else {
        <div class="entry-list">
          @for (e of entries(); track e.id) {
            <div class="zf-card entry-card">
              <div class="entry-card__top">
                <span class="zf-badge">{{ tableLabels[e.tableName] ?? e.tableName }}</span>
                <span class="entry-card__action" [class.entry-card__action--delete]="e.action === 'DELETE'">
                  {{ actionLabels[e.action] ?? e.action }}
                </span>
                <small class="entry-card__date">{{ e.changedAt | date: 'dd/MM/yyyy HH:mm' }}</small>
              </div>
              <div class="entry-card__meta">Por {{ e.changedByName }}</div>
              @if (summarize(e); as summary) {
                @if (summary) {
                  <div class="entry-card__summary">{{ summary }}</div>
                }
              }
            </div>
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

      .filters-card {
        margin-bottom: 1rem;
        max-width: 260px;
      }

      .entry-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .entry-card {
        padding: 0.85rem 1rem;
      }

      .entry-card__top {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .entry-card__action {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--zf-blue);
      }

      .entry-card__action--delete {
        color: var(--zf-danger);
      }

      .entry-card__date {
        margin-left: auto;
        color: var(--zf-text-muted);
      }

      .entry-card__meta {
        font-size: 0.8rem;
        color: var(--zf-text-muted);
        margin-top: 0.35rem;
      }

      .entry-card__summary {
        font-size: 0.82rem;
        color: var(--zf-text-secondary);
        margin-top: 0.35rem;
        word-break: break-word;
      }
    `,
  ],
})
export class AuditLogComponent implements OnInit {
  private readonly auditLogsService = inject(AuditLogsService);
  private readonly toast = inject(ToastService);

  protected readonly entries = signal<AuditLogEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly tableLabels = TABLE_LABELS;
  protected readonly actionLabels = ACTION_LABELS;
  protected readonly tableOptions = Object.entries(TABLE_LABELS).map(([value, label]) => ({ value, label }));

  protected tableFilter = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.entries.set(await this.auditLogsService.listRecent({ tableName: this.tableFilter || undefined }));
    } catch {
      this.toast.error('No se pudo cargar la actividad reciente.');
    } finally {
      this.loading.set(false);
    }
  }

  protected summarize(entry: AuditLogEntry): string | null {
    const data = entry.newData ?? entry.oldData;
    if (!data) {
      return null;
    }
    const code = (data as any).code;
    const firstName = (data as any).first_name;
    const lastName = (data as any).last_name;
    const brand = (data as any).brand;
    const model = (data as any).model;
    const concept = (data as any).concept;
    if (code) return `Orden ${code}`;
    if (firstName || lastName) return `${firstName ?? ''} ${lastName ?? ''}`.trim();
    if (brand || model) return `${brand ?? ''} ${model ?? ''}`.trim();
    if (concept) return concept;
    return null;
  }
}
