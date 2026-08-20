import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import {
  PaymentStatus,
  RepairOrder,
  RepairOrderFilters,
  RepairOrderFormValue,
  RepairPriority,
  RepairStatus,
  RepairStatusHistoryEntry,
} from '../../models';

interface RepairOrderListRow {
  id: string;
  code: string;
  customer_id: string;
  device_id: string;
  received_at: string;
  reported_fault: string;
  reception_notes: string | null;
  technical_diagnosis: string | null;
  recommended_work: string | null;
  status: RepairStatus;
  priority: RepairPriority;
  estimated_completion_date: string | null;
  customer_price: number;
  discount: number;
  total: number;
  deposit: number;
  balance_due: number;
  delivered_at: string | null;
  related_order_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  device_type: string;
  device_imei: string | null;
}

function mapRow(row: RepairOrderListRow): RepairOrder {
  return {
    id: row.id,
    code: row.code,
    customerId: row.customer_id,
    deviceId: row.device_id,
    receivedAt: row.received_at,
    reportedFault: row.reported_fault,
    receptionNotes: row.reception_notes,
    technicalDiagnosis: row.technical_diagnosis,
    recommendedWork: row.recommended_work,
    status: row.status,
    priority: row.priority,
    estimatedCompletionDate: row.estimated_completion_date,
    customerPrice: Number(row.customer_price),
    discount: Number(row.discount),
    total: Number(row.total),
    deposit: Number(row.deposit),
    balanceDue: Number(row.balance_due),
    deliveredAt: row.delivered_at,
    relatedOrderId: row.related_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deviceLabel: `${row.device_brand} ${row.device_model}`.trim(),
  };
}

function paymentStatusOf(order: { total: number; deposit: number; balanceDue: number }): PaymentStatus {
  if (order.total <= 0) {
    return 'sin_pago';
  }
  if (order.balanceDue <= 0) {
    return 'pagado_total';
  }
  if (order.deposit > 0) {
    return order.balanceDue < order.total ? 'pagado_parcial' : 'senia';
  }
  return 'sin_pago';
}

@Injectable({ providedIn: 'root' })
export class RepairOrdersService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async list(filters: Partial<RepairOrderFilters> = {}): Promise<RepairOrder[]> {
    let query = this.supabase.client
      .from('repair_orders_list')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'todos') {
      query = query.eq('status', filters.status);
    }
    if (filters.brand?.trim()) {
      query = query.ilike('device_brand', `%${filters.brand.trim()}%`);
    }
    if (filters.dateFrom) {
      query = query.gte('received_at', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('received_at', filters.dateTo);
    }
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      query = query.or(
        `code.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,device_brand.ilike.%${term}%,device_model.ilike.%${term}%,device_imei.ilike.%${term}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    let orders = (data as RepairOrderListRow[]).map(mapRow);

    if (filters.paymentStatus && filters.paymentStatus !== 'todos') {
      orders = orders.filter((o) => paymentStatusOf(o) === filters.paymentStatus);
    }

    return orders;
  }

  async listByCustomer(customerId: string): Promise<RepairOrder[]> {
    const { data, error } = await this.supabase.client
      .from('repair_orders_list')
      .select('*')
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data as RepairOrderListRow[]).map(mapRow);
  }

  /** Órdenes de reingreso creadas a partir de esta orden (garantía / reingreso). */
  async listReingresos(orderId: string): Promise<RepairOrder[]> {
    const { data, error } = await this.supabase.client
      .from('repair_orders_list')
      .select('*')
      .eq('related_order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data as RepairOrderListRow[]).map(mapRow);
  }

  async listRecent(limit = 8): Promise<RepairOrder[]> {
    const { data, error } = await this.supabase.client
      .from('repair_orders_list')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      throw new Error(error.message);
    }
    return (data as RepairOrderListRow[]).map(mapRow);
  }

  async getById(id: string): Promise<RepairOrder | null> {
    const { data, error } = await this.supabase.client
      .from('repair_orders_list')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapRow(data as RepairOrderListRow) : null;
  }

  async create(value: RepairOrderFormValue): Promise<RepairOrder> {
    const { data, error } = await this.supabase.client
      .from('repair_orders')
      .insert({
        customer_id: value.customerId,
        device_id: value.deviceId,
        reported_fault: value.reportedFault.trim(),
        reception_notes: value.receptionNotes?.trim() || null,
        priority: value.priority,
        estimated_completion_date: value.estimatedCompletionDate || null,
        related_order_id: value.relatedOrderId || null,
      })
      .select('id')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    const created = await this.getById(data.id as string);
    if (!created) {
      throw new Error('No se pudo recuperar la orden recién creada.');
    }
    return created;
  }

  async updateDetails(
    id: string,
    value: {
      reportedFault: string;
      receptionNotes: string | null;
      technicalDiagnosis: string | null;
      recommendedWork: string | null;
      priority: RepairPriority;
      estimatedCompletionDate: string | null;
      customerPrice: number;
      discount: number;
      deposit: number;
    },
  ): Promise<RepairOrder> {
    const { error } = await this.supabase.client
      .from('repair_orders')
      .update({
        reported_fault: value.reportedFault.trim(),
        reception_notes: value.receptionNotes?.trim() || null,
        technical_diagnosis: value.technicalDiagnosis?.trim() || null,
        recommended_work: value.recommendedWork?.trim() || null,
        priority: value.priority,
        estimated_completion_date: value.estimatedCompletionDate || null,
        customer_price: value.customerPrice,
        discount: value.discount,
        deposit: value.deposit,
      })
      .eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('No se pudo recuperar la orden actualizada.');
    }
    return updated;
  }

  async changeStatus(orderId: string, newStatus: RepairStatus, note: string | null): Promise<RepairOrder> {
    const { error } = await this.supabase.client.rpc('change_repair_order_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_note: note?.trim() || null,
    });
    if (error) {
      throw new Error(error.message);
    }
    const updated = await this.getById(orderId);
    if (!updated) {
      throw new Error('No se pudo recuperar la orden actualizada.');
    }
    return updated;
  }

  async getStatusHistory(orderId: string): Promise<RepairStatusHistoryEntry[]> {
    const { data, error } = await this.supabase.client
      .from('repair_status_history')
      .select('*')
      .eq('repair_order_id', orderId)
      .order('changed_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row: any) => ({
      id: row.id,
      repairOrderId: row.repair_order_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      changedAt: row.changed_at,
      changedBy: row.changed_by,
      note: row.note,
    }));
  }

  paymentStatusOf(order: RepairOrder): PaymentStatus {
    return paymentStatusOf(order);
  }
}
