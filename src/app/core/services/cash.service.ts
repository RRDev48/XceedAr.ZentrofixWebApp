import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { AuthService } from '../auth/auth.service';
import { CashMovement, CashMovementFormValue, PaymentMethod } from '../../models';

interface CashMovementRow {
  id: string;
  movement_type: string;
  amount: number;
  concept: string;
  repair_order_id: string | null;
  created_by: string | null;
  created_at: string;
  reverses_id: string | null;
  payment_method: PaymentMethod | null;
}

function mapMovement(row: CashMovementRow): CashMovement {
  return {
    id: row.id,
    movementType: row.movement_type as CashMovement['movementType'],
    amount: Number(row.amount),
    concept: row.concept,
    repairOrderId: row.repair_order_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    reversesId: row.reverses_id,
    paymentMethod: row.payment_method,
  };
}

@Injectable({ providedIn: 'root' })
export class CashService {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly auth: AuthService,
  ) {}

  async listBetween(dateFrom: string, dateTo: string): Promise<CashMovement[]> {
    const { data, error } = await this.supabase.client
      .from('cash_movements')
      .select('*')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data as CashMovementRow[]).map(mapMovement);
  }

  async registerManual(value: CashMovementFormValue): Promise<CashMovement> {
    const { data, error } = await this.supabase.client
      .from('cash_movements')
      .insert({
        movement_type: value.movementType,
        amount: value.amount,
        concept: value.concept.trim(),
        created_by: this.auth.session()?.user.id ?? null,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapMovement(data as CashMovementRow);
  }

  async reverseMovement(movementId: string): Promise<CashMovement> {
    const { data, error } = await this.supabase.client.rpc('reverse_cash_movement', {
      p_movement_id: movementId,
    });
    if (error) {
      throw new Error(error.message);
    }
    return mapMovement(data as CashMovementRow);
  }
}
