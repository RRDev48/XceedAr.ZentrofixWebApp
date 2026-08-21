import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

export interface CustomerSearchResult {
  id: string;
  name: string;
  phone: string;
}

export interface OrderSearchResult {
  id: string;
  code: string;
  customerName: string;
  deviceLabel: string;
  status: string;
}

export interface GlobalSearchResults {
  customers: CustomerSearchResult[];
  orders: OrderSearchResult[];
}

const RESULT_LIMIT = 6;

@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async search(term: string): Promise<GlobalSearchResults> {
    const query = term.trim();
    if (query.length < 2) {
      return { customers: [], orders: [] };
    }

    const [customersResult, ordersResult] = await Promise.all([
      this.supabase.client
        .from('customers')
        .select('id, first_name, last_name, whatsapp_phone')
        .is('deleted_at', null)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,whatsapp_phone.ilike.%${query}%,dni.ilike.%${query}%`)
        .limit(RESULT_LIMIT),
      this.supabase.client
        .from('repair_orders_list')
        .select('id, code, customer_name, device_brand, device_model, status')
        .is('deleted_at', null)
        .or(
          `code.ilike.%${query}%,customer_name.ilike.%${query}%,device_brand.ilike.%${query}%,device_model.ilike.%${query}%,device_imei.ilike.%${query}%`,
        )
        .limit(RESULT_LIMIT),
    ]);

    if (customersResult.error) {
      throw new Error(customersResult.error.message);
    }
    if (ordersResult.error) {
      throw new Error(ordersResult.error.message);
    }

    return {
      customers: (customersResult.data ?? []).map((c: any) => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        phone: c.whatsapp_phone,
      })),
      orders: (ordersResult.data ?? []).map((o: any) => ({
        id: o.id,
        code: o.code,
        customerName: o.customer_name,
        deviceLabel: `${o.device_brand} ${o.device_model}`.trim(),
        status: o.status,
      })),
    };
  }
}
