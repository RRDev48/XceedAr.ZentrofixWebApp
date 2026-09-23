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
    return { customers: (data as CustomerRow[]).map(mapCustomer), total: count ?? 0 };
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
}
