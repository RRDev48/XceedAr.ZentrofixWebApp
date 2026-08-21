import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { RepairPriority, RepairStatus } from '../../models';

export interface PublicOrderTracking {
  code: string;
  status: RepairStatus;
  priority: RepairPriority;
  receivedAt: string;
  estimatedCompletionDate: string | null;
  deliveredAt: string | null;
  deviceBrand: string;
  deviceModel: string;
  total: number;
  balanceDue: number;
  customerFirstName: string;
  hasFeedback: boolean;
}

@Injectable({ providedIn: 'root' })
export class TrackingService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async track(code: string, phone: string): Promise<PublicOrderTracking | null> {
    const { data, error } = await this.supabase.client.rpc('public_track_order', {
      p_code: code,
      p_phone: phone,
    });
    if (error) {
      throw new Error(error.message);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return null;
    }
    return {
      code: row.code,
      status: row.status,
      priority: row.priority,
      receivedAt: row.received_at,
      estimatedCompletionDate: row.estimated_completion_date,
      deliveredAt: row.delivered_at,
      deviceBrand: row.device_brand,
      deviceModel: row.device_model,
      total: Number(row.total),
      balanceDue: Number(row.balance_due),
      customerFirstName: row.customer_first_name,
      hasFeedback: Boolean(row.has_feedback),
    };
  }

  /** Devuelve true si se guardó la calificación (código + teléfono válidos y orden entregada). */
  async submitFeedback(code: string, phone: string, rating: number, comment: string | null): Promise<boolean> {
    const { data, error } = await this.supabase.client.rpc('submit_order_feedback', {
      p_code: code,
      p_phone: phone,
      p_rating: rating,
      p_comment: comment?.trim() || null,
    });
    if (error) {
      throw new Error(error.message);
    }
    return Boolean(data);
  }
}
