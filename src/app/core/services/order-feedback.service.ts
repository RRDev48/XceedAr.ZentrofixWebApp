import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

export interface FeedbackEntry {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface FeedbackStats {
  average: number;
  count: number;
}

interface FeedbackRow {
  id: string;
  repair_order_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface OrderSummaryRow {
  id: string;
  code: string;
  customer_name: string;
}

@Injectable({ providedIn: 'root' })
export class OrderFeedbackService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listRecent(limit = 20): Promise<FeedbackEntry[]> {
    const { data, error } = await this.supabase.client
      .from('order_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      throw new Error(error.message);
    }
    const rows = (data ?? []) as FeedbackRow[];
    if (!rows.length) {
      return [];
    }

    const orderIds = rows.map((r) => r.repair_order_id);
    const { data: orders, error: ordersError } = await this.supabase.client
      .from('repair_orders_list')
      .select('id, code, customer_name')
      .in('id', orderIds);
    if (ordersError) {
      throw new Error(ordersError.message);
    }
    const orderById = new Map((orders as OrderSummaryRow[] | null ?? []).map((o) => [o.id, o]));

    return rows.map((r) => {
      const order = orderById.get(r.repair_order_id);
      return {
        id: r.id,
        orderId: r.repair_order_id,
        orderCode: order?.code ?? '—',
        customerName: order?.customer_name ?? '—',
        rating: Number(r.rating),
        comment: r.comment,
        createdAt: r.created_at,
      };
    });
  }

  async getStats(): Promise<FeedbackStats> {
    const { data, error } = await this.supabase.client.from('order_feedback').select('rating');
    if (error) {
      throw new Error(error.message);
    }
    const ratings = ((data ?? []) as Pick<FeedbackRow, 'rating'>[]).map((r) => Number(r.rating));
    if (!ratings.length) {
      return { average: 0, count: 0 };
    }
    return {
      average: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
      count: ratings.length,
    };
  }
}
