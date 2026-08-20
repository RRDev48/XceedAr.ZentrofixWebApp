import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { AuthService } from '../auth/auth.service';
import { Payment, PaymentFormValue } from '../../models';

interface PaymentRow {
  id: string;
  repair_order_id: string;
  amount: number;
  method: string;
  is_deposit: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    repairOrderId: row.repair_order_id,
    amount: Number(row.amount),
    method: row.method as Payment['method'],
    isDeposit: row.is_deposit,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly auth: AuthService,
  ) {}

  async listByOrder(repairOrderId: string): Promise<Payment[]> {
    const { data, error } = await this.supabase.client
      .from('payments')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data as PaymentRow[]).map(mapPayment);
  }

  async register(repairOrderId: string, value: PaymentFormValue): Promise<Payment> {
    const { data, error } = await this.supabase.client
      .from('payments')
      .insert({
        repair_order_id: repairOrderId,
        amount: value.amount,
        method: value.method,
        is_deposit: value.isDeposit,
        note: value.note?.trim() || null,
        created_by: this.auth.session()?.user.id ?? null,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapPayment(data as PaymentRow);
  }
}
