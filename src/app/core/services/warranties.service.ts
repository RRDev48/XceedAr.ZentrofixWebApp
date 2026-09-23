import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Warranty } from '../../models';

export interface ExpiringWarranty {
  warranty: Warranty;
  orderId: string;
  orderCode: string;
  customerName: string;
  deviceLabel: string;
  daysLeft: number;
}

interface WarrantyRow {
  id: string;
  repair_order_id: string;
  coverage_details: string;
  starts_at: string;
  expires_at: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface OrderSummaryRow {
  id: string;
  code: string;
  customer_name: string;
  device_brand: string;
  device_model: string;
}

function mapWarranty(row: WarrantyRow): Warranty {
  return {
    id: row.id,
    repairOrderId: row.repair_order_id,
    coverageDetails: row.coverage_details,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class WarrantiesService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async getByOrder(repairOrderId: string): Promise<Warranty | null> {
    const { data, error } = await this.supabase.client
      .from('warranties')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapWarranty(data as WarrantyRow) : null;
  }

  async create(repairOrderId: string, coverageDetails: string, durationDays: number): Promise<Warranty> {
    const startsAt = new Date();
    const expiresAt = new Date(startsAt);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const { data, error } = await this.supabase.client
      .from('warranties')
      .insert({
        repair_order_id: repairOrderId,
        coverage_details: coverageDetails,
        starts_at: startsAt.toISOString().slice(0, 10),
        expires_at: expiresAt.toISOString().slice(0, 10),
        active: true,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapWarranty(data as WarrantyRow);
  }

  /** Garantías activas que vencen dentro de los próximos `days` días (incluye vencidas hoy). */
  async listExpiringSoon(days = 15): Promise<ExpiringWarranty[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + days);

    const { data, error } = await this.supabase.client
      .from('warranties')
      .select('*')
      .eq('active', true)
      .gte('expires_at', today.toISOString().slice(0, 10))
      .lte('expires_at', limit.toISOString().slice(0, 10))
      .order('expires_at', { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    const warranties = (data as WarrantyRow[]).map(mapWarranty);
    if (!warranties.length) {
      return [];
    }

    const orderIds = warranties.map((w) => w.repairOrderId);
    const { data: orders, error: ordersError } = await this.supabase.client
      .from('repair_orders_list')
      .select('id, code, customer_name, device_brand, device_model')
      .in('id', orderIds);
    if (ordersError) {
      throw new Error(ordersError.message);
    }
    const orderById = new Map((orders as OrderSummaryRow[] | null ?? []).map((o) => [o.id, o]));
    const now = today.getTime();

    return warranties.map((w) => {
      const order = orderById.get(w.repairOrderId);
      const daysLeft = Math.ceil((new Date(w.expiresAt).getTime() - now) / 86_400_000);
      return {
        warranty: w,
        orderId: w.repairOrderId,
        orderCode: order?.code ?? '—',
        customerName: order?.customer_name ?? '—',
        deviceLabel: order ? `${order.device_brand} ${order.device_model}`.trim() : '—',
        daysLeft,
      };
    });
  }
}
