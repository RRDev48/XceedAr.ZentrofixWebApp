import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Customer, CustomerFormValue, CustomerMatch } from '../../models';

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  whatsapp_phone: string;
  dni: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    whatsappPhone: row.whatsapp_phone,
    dni: row.dni,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

interface CustomerMatchRow {
  id: string;
  first_name: string;
  last_name: string;
  whatsapp_phone: string;
  dni: string | null;
}

function toRow(value: CustomerFormValue) {
  return {
    first_name: value.firstName.trim(),
    last_name: value.lastName.trim(),
    whatsapp_phone: value.whatsappPhone.trim(),
    dni: value.dni?.trim() || null,
    email: value.email?.trim() || null,
    address: value.address?.trim() || null,
    notes: value.notes?.trim() || null,
  };
}

@Injectable({ providedIn: 'root' })
export class CustomersService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async list(search = ''): Promise<Customer[]> {
    let query = this.supabase.client
      .from('customers')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (search.trim()) {
      const term = search.trim();
      query = query.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,whatsapp_phone.ilike.%${term}%,dni.ilike.%${term}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return (data as CustomerRow[]).map(mapCustomer);
  }

  async listPage(search: string, page: number, pageSize: number): Promise<{ customers: Customer[]; total: number }> {
    let query = this.supabase.client
      .from('customers')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (search.trim()) {
      const term = search.trim();
      query = query.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,whatsapp_phone.ilike.%${term}%,dni.ilike.%${term}%`,
      );
    }

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }
    const customers = await this.attachLastOrderDates((data as CustomerRow[]).map(mapCustomer));
    return { customers, total: count ?? 0 };
  }

  /** Igual que list(), pero además trae la fecha de la última orden de cada cliente. Se usa cuando el filtro
   * de "inactivos" está activo y hay que traer todo lo que matchea la búsqueda para filtrar en memoria. */
  async listWithLastOrder(search: string): Promise<Customer[]> {
    return this.attachLastOrderDates(await this.list(search));
  }

  private async attachLastOrderDates(customers: Customer[]): Promise<Customer[]> {
    if (!customers.length) {
      return customers;
    }
    const { data, error } = await this.supabase.client
      .from('customer_last_order')
      .select('customer_id, last_order_at')
      .in('customer_id', customers.map((c) => c.id));
    if (error) {
      throw new Error(error.message);
    }
    const lastOrderByCustomer = new Map(
      ((data ?? []) as { customer_id: string; last_order_at: string }[]).map((row) => [row.customer_id, row.last_order_at]),
    );
    return customers.map((c) => ({ ...c, lastOrderAt: lastOrderByCustomer.get(c.id) ?? null }));
  }

  async getById(id: string): Promise<Customer | null> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapCustomer(data as CustomerRow) : null;
  }

  /** Busca coincidencias por teléfono o DNI para evitar clientes duplicados. */
  async findPossibleDuplicates(phone: string, dni: string | null): Promise<CustomerMatch[]> {
    const conditions: string[] = [];
    if (phone.trim()) {
      conditions.push(`whatsapp_phone.eq.${phone.trim()}`);
    }
    if (dni?.trim()) {
      conditions.push(`dni.eq.${dni.trim()}`);
    }
    if (conditions.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase.client
      .from('customers')
      .select('id, first_name, last_name, whatsapp_phone, dni')
      .is('deleted_at', null)
      .or(conditions.join(','));

    if (error) {
      throw new Error(error.message);
    }
    return ((data ?? []) as CustomerMatchRow[]).map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      whatsappPhone: row.whatsapp_phone,
      dni: row.dni,
    }));
  }

  async create(value: CustomerFormValue): Promise<Customer> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .insert(toRow(value))
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapCustomer(data as CustomerRow);
  }

  async update(id: string, value: CustomerFormValue): Promise<Customer> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .update(toRow(value))
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapCustomer(data as CustomerRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('customers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
  }

  async listDeleted(): Promise<Customer[]> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data as CustomerRow[]).map(mapCustomer);
  }

  async restore(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('customers').update({ deleted_at: null }).eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
  }

  /** Fusiona keepId y removeId en un solo cliente: mueve equipos/órdenes a keepId, completa sus campos
   * vacíos con los de removeId, y da de baja lógica a removeId. */
  async merge(keepId: string, removeId: string): Promise<Customer> {
    const { data, error } = await this.supabase.client.rpc('merge_customers', {
      p_keep_id: keepId,
      p_remove_id: removeId,
    });
    if (error) {
      throw new Error(error.message);
    }
    return mapCustomer(data as CustomerRow);
  }
}
