import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Quote, QuoteApprovalStatus, QuoteFormValue, QuoteItem } from '../../models';

interface QuoteRow {
  id: string;
  repair_order_id: string;
  labor_cost: number;
  discount: number;
  total: number;
  valid_until: string | null;
  customer_notes: string | null;
  approval_status: QuoteApprovalStatus;
  sent_at: string | null;
  responded_at: string | null;
  responded_via: string | null;
  responded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface QuoteItemRow {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  inventory_item_id: string | null;
}

function mapQuote(row: QuoteRow, items: QuoteItemRow[]): Quote {
  return {
    id: row.id,
    repairOrderId: row.repair_order_id,
    laborCost: Number(row.labor_cost),
    discount: Number(row.discount),
    total: Number(row.total),
    validUntil: row.valid_until,
    customerNotes: row.customer_notes,
    approvalStatus: row.approval_status,
    sentAt: row.sent_at,
    respondedAt: row.responded_at,
    respondedVia: row.responded_via,
    respondedBy: row.responded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    items: items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: Number(i.quantity),
      unitCost: Number(i.unit_cost),
      unitPrice: Number(i.unit_price),
      inventoryItemId: i.inventory_item_id,
    })),
  };
}

@Injectable({ providedIn: 'root' })
export class QuotesService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listByOrder(repairOrderId: string): Promise<Quote[]> {
    return this.listByOrderFiltered(repairOrderId, false);
  }

  /** Presupuestos eliminados (baja lógica) de una orden, para consultarlos como historial. */
  async listDeletedByOrder(repairOrderId: string): Promise<Quote[]> {
    return this.listByOrderFiltered(repairOrderId, true);
  }

  private async listByOrderFiltered(repairOrderId: string, deleted: boolean): Promise<Quote[]> {
    let query = this.supabase.client.from('quotes').select('*').eq('repair_order_id', repairOrderId);
    query = deleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
    const { data: quotes, error } = await query.order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    const rows = (quotes ?? []) as QuoteRow[];
    if (rows.length === 0) {
      return [];
    }

    const { data: items, error: itemsError } = await this.supabase.client
      .from('quote_items')
      .select('*')
      .in(
        'quote_id',
        rows.map((r) => r.id),
      );
    if (itemsError) {
      throw new Error(itemsError.message);
    }
    const itemsByQuote = new Map<string, QuoteItemRow[]>();
    for (const item of (items ?? []) as QuoteItemRow[]) {
      const list = itemsByQuote.get(item.quote_id) ?? [];
      list.push(item);
      itemsByQuote.set(item.quote_id, list);
    }

    return rows.map((row) => mapQuote(row, itemsByQuote.get(row.id) ?? []));
  }

  /** Baja lógica: no borra el presupuesto, lo saca de la lista activa y lo deja como historial. */
  async remove(quoteId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('quotes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', quoteId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async save(repairOrderId: string, quoteId: string | null, value: QuoteFormValue): Promise<Quote> {
    const { data, error } = await this.supabase.client.rpc('save_quote', {
      p_quote_id: quoteId,
      p_repair_order_id: repairOrderId,
      p_labor_cost: value.laborCost,
      p_discount: value.discount,
      p_valid_until: value.validUntil,
      p_customer_notes: value.customerNotes,
      p_items: value.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitCost: i.unitCost,
        unitPrice: i.unitPrice,
        inventoryItemId: i.inventoryItemId,
      })),
    });
    if (error) {
      throw new Error(error.message);
    }
    const row = data as QuoteRow;
    const { data: items, error: itemsError } = await this.supabase.client
      .from('quote_items')
      .select('*')
      .eq('quote_id', row.id);
    if (itemsError) {
      throw new Error(itemsError.message);
    }
    return mapQuote(row, (items ?? []) as QuoteItemRow[]);
  }

  async markSent(quoteId: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('mark_quote_sent', { p_quote_id: quoteId });
    if (error) {
      throw new Error(error.message);
    }
  }

  async respond(quoteId: string, status: QuoteApprovalStatus, respondedVia: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('respond_quote', {
      p_quote_id: quoteId,
      p_approval_status: status,
      p_responded_via: respondedVia,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
}
