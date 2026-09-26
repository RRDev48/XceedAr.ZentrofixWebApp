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
  device_access_code: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer_name: string;
  customer_phone: string;
  customer_dni: string | null;
  customer_email: string | null;
  customer_address: string | null;
  device_brand: string;
  device_model: string;
  device_type: string;
  device_imei: string | null;
  device_accessories: string | null;
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
    deviceAccessCode: row.device_access_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerDni: row.customer_dni,
    customerEmail: row.customer_email,
    customerAddress: row.customer_address,
    deviceLabel: `${row.device_brand} ${row.device_model}`.trim(),
    deviceType: row.device_type,
    deviceBrand: row.device_brand,
    deviceModel: row.device_model,
    deviceImei: row.device_imei,
    deviceAccessories: row.device_accessories,
  };
}

/** Días permitidos en cada estado antes de considerar la orden "estancada". Los estados finales quedan fuera. */
const STALE_THRESHOLD_DAYS: Partial<Record<RepairStatus, number>> = {
  pendiente_diagnostico: 2,
  en_diagnostico: 3,
  presupuesto_pendiente: 3,
  presupuesto_aprobado: 2,
  esperando_repuesto: 10,
  en_reparacion: 5,
  en_pruebas: 2,
  listo_para_entregar: 5,
  garantia_reingreso: 5,
};

export interface StaleOrder extends RepairOrder {
  daysInStatus: number;
}

interface AssignmentRow {
  repair_order_id: string;
  technician_id: string | null;
  profiles: { full_name: string } | null;
}

interface RepairStatusHistoryRow {
  id: string;
  repair_order_id: string;
  from_status: RepairStatus | null;
  to_status: RepairStatus;
  changed_at: string;
  changed_by: string | null;
  note: string | null;
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

  /**
   * Arma la query base compartida por list() y listPage(). Devuelve null cuando el
   * filtro de técnico ya descarta cualquier resultado posible (evita una query inútil).
   * Se envuelve en { query } porque el builder de supabase-js es "thenable": si se
   * devolviera directo desde una función async, `await` lo ejecutaría de una, antes
   * de poder encadenar .range().
   */
  private async buildListQuery(filters: Partial<RepairOrderFilters>, withCount = false) {
    let query = this.supabase.client
      .from('repair_orders_list')
      .select('*', withCount ? { count: 'exact' } : undefined)
      .is('deleted_at', null)
      .order(filters.sortBy ?? 'created_at', { ascending: filters.sortBy ? (filters.sortAscending ?? false) : false });

    if (filters.status && filters.status !== 'todos') {
      query = query.eq('status', filters.status);
    }
    if (filters.priority && filters.priority !== 'todos') {
      query = query.eq('priority', filters.priority);
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

    if (filters.technicianId && filters.technicianId !== 'todos') {
      if (filters.technicianId === 'sin_asignar') {
        const assignedIds = await this.assignedOrderIds();
        if (assignedIds.length) {
          query = query.not('id', 'in', `(${assignedIds.join(',')})`);
        }
      } else {
        const ids = await this.assignedOrderIds(filters.technicianId);
        if (!ids.length) {
          return null;
        }
        query = query.in('id', ids);
      }
    }

    return { query };
  }

  async list(filters: Partial<RepairOrderFilters> = {}): Promise<RepairOrder[]> {
    const built = await this.buildListQuery(filters);
    if (!built) {
      return [];
    }
    const { data, error } = await built.query;
    if (error) {
      throw new Error(error.message);
    }
    let orders = await this.withAssignments((data as RepairOrderListRow[]).map(mapRow));

    if (filters.paymentStatus && filters.paymentStatus !== 'todos') {
      orders = orders.filter((o) => paymentStatusOf(o) === filters.paymentStatus);
    }

    return orders;
  }

  /**
   * Versión paginada de list(), pensada para el listado principal. No soporta el
   * filtro paymentStatus (se calcula en el cliente a partir de total/saldo, no existe
   * como columna): cuando ese filtro está activo, el llamador debe usar list() y
   * paginar en memoria.
   */
  async listPage(
    filters: Omit<Partial<RepairOrderFilters>, 'paymentStatus'>,
    page: number,
    pageSize: number,
  ): Promise<{ orders: RepairOrder[]; total: number }> {
    const built = await this.buildListQuery(filters, true);
    if (!built) {
      return { orders: [], total: 0 };
    }
    const from = (page - 1) * pageSize;
    const { data, error, count } = await built.query.range(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }
    const orders = await this.withAssignments((data as RepairOrderListRow[]).map(mapRow));
    return { orders, total: count ?? orders.length };
  }

  private async assignedOrderIds(technicianId?: string): Promise<string[]> {
    let query = this.supabase.client.from('repair_order_assignments').select('repair_order_id');
    query = technicianId
      ? query.eq('technician_id', technicianId)
      : query.not('technician_id', 'is', null);
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row: { repair_order_id: string }) => row.repair_order_id);
  }

  /** Órdenes activas (sin estado final) que todavía no tienen técnico asignado. */
  async countUnassignedActive(): Promise<number> {
    const assignedIds = await this.assignedOrderIds();
    let query = this.supabase.client
      .from('repair_orders_list')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('status', 'in', '(entregado,cancelado,sin_reparacion)');
    if (assignedIds.length) {
      query = query.not('id', 'in', `(${assignedIds.join(',')})`);
    }
    const { count, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return count ?? 0;
  }

  private async withAssignments(orders: RepairOrder[]): Promise<RepairOrder[]> {
    if (!orders.length) return orders;
    const { data, error } = await this.supabase.client
      .from('repair_order_assignments')
      .select('repair_order_id, technician_id, profiles!repair_order_assignments_technician_id_workshop_fkey(full_name)')
      .in('repair_order_id', orders.map((o) => o.id));
    if (error) throw new Error(error.message);
    // El cliente de Supabase no tiene tipos generados desde el schema: para un join
    // a-uno vía FK explícita infiere "profiles" como array, aunque en runtime siempre
    // es un objeto. Se pasa por unknown para no pelear con esa forma inferida.
    const byOrder = new Map(
      ((data as unknown as AssignmentRow[]) ?? []).map((a) => [a.repair_order_id, a]),
    );
    return orders.map((order) => {
      const assignment = byOrder.get(order.id);
      return { ...order, assignedTechnicianId: assignment?.technician_id ?? null,
        assignedTechnicianName: assignment?.profiles?.full_name ?? null };
    });
  }

  async assignTechnician(orderId: string, technicianId: string | null): Promise<void> {
    const { error } = await this.supabase.client.rpc('assign_repair_order_technician', {
      p_order_id: orderId, p_technician_id: technicianId,
    });
    if (error) throw new Error(error.message);
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

  /** Órdenes activas con fecha estimada de entrega dentro de los próximos `days` días. */
  async listUpcomingDeliveries(days = 7): Promise<RepairOrder[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + days);

    const { data, error } = await this.supabase.client
      .from('repair_orders_list')
      .select('*')
      .is('deleted_at', null)
      .not('status', 'in', '(entregado,cancelado,sin_reparacion)')
      .gte('estimated_completion_date', today.toISOString().slice(0, 10))
      .lte('estimated_completion_date', limit.toISOString().slice(0, 10))
      .order('estimated_completion_date', { ascending: true });
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
    if (!data) return null;
    return (await this.withAssignments([mapRow(data as RepairOrderListRow)]))[0] ?? null;
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
        device_access_code: value.deviceAccessCode?.trim() || null,
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
    return ((data ?? []) as RepairStatusHistoryRow[]).map((row) => ({
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

  /** Días transcurridos desde el último cambio de estado, para cada orden pedida. */
  async getDaysInStatusMap(orderIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!orderIds.length) {
      return result;
    }
    const { data, error } = await this.supabase.client
      .from('repair_status_history')
      .select('repair_order_id, changed_at')
      .in('repair_order_id', orderIds)
      .order('changed_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    const latestChangeByOrder = new Map<string, string>();
    for (const row of data ?? []) {
      if (!latestChangeByOrder.has(row.repair_order_id)) {
        latestChangeByOrder.set(row.repair_order_id, row.changed_at);
      }
    }
    const now = Date.now();
    for (const [orderId, changedAt] of latestChangeByOrder) {
      result.set(orderId, Math.floor((now - new Date(changedAt).getTime()) / 86_400_000));
    }
    return result;
  }

  isStale(status: RepairStatus, daysInStatus: number): boolean {
    const threshold = STALE_THRESHOLD_DAYS[status];
    return threshold !== undefined && daysInStatus >= threshold;
  }

  /** Órdenes activas que llevan más días de la cuenta en su estado actual. */
  async listStale(): Promise<StaleOrder[]> {
    const activeStatuses = Object.keys(STALE_THRESHOLD_DAYS) as RepairStatus[];
    const { data, error } = await this.supabase.client
      .from('repair_orders_list')
      .select('*')
      .is('deleted_at', null)
      .in('status', activeStatuses);
    if (error) {
      throw new Error(error.message);
    }
    const orders = (data as RepairOrderListRow[]).map(mapRow);
    const daysMap = await this.getDaysInStatusMap(orders.map((o) => o.id));
    return orders
      .map((o) => ({ ...o, daysInStatus: daysMap.get(o.id) ?? 0 }))
      .filter((o) => this.isStale(o.status, o.daysInStatus))
      .sort((a, b) => b.daysInStatus - a.daysInStatus);
  }
}
