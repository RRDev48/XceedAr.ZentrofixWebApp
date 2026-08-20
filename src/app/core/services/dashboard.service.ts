import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

export interface DashboardIndicators {
  pendingDiagnosis: number;
  pendingQuote: number;
  inRepair: number;
  waitingForPart: number;
  readyForDelivery: number;
  pendingPayment: number;
  delivered: number;
  incomeCollected: number;
  activeWarranties: number;
  criticalStock: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async getIndicators(): Promise<DashboardIndicators> {
    const [
      pendingDiagnosis,
      inDiagnosis,
      pendingQuote,
      inRepair,
      waitingForPart,
      readyForDelivery,
      delivered,
      pendingPaymentRows,
      incomeRows,
      activeWarranties,
      criticalStock,
    ] = await Promise.all([
      this.countByStatus('pendiente_diagnostico'),
      this.countByStatus('en_diagnostico'),
      this.countByStatus('presupuesto_pendiente'),
      this.countByStatus('en_reparacion'),
      this.countByStatus('esperando_repuesto'),
      this.countByStatus('listo_para_entregar'),
      this.countByStatus('entregado'),
      this.supabase.client
        .from('repair_orders_list')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gt('balance_due', 0),
      this.supabase.client.from('repair_orders_list').select('deposit,total,balance_due').is('deleted_at', null),
      this.supabase.client
        .from('warranties')
        .select('id', { count: 'exact', head: true })
        .eq('active', true),
      this.supabase.client
        .from('inventory_items')
        .select('id, stock_quantity, minimum_stock')
        .is('deleted_at', null),
    ]);

    const incomeCollected = (incomeRows.data ?? []).reduce((sum: number, row: any) => {
      const collected = Number(row.total) - Number(row.balance_due);
      return sum + (collected > 0 ? collected : 0);
    }, 0);

    const criticalStockCount = (criticalStock.data ?? []).filter(
      (row: any) => Number(row.stock_quantity) <= Number(row.minimum_stock),
    ).length;

    return {
      pendingDiagnosis: pendingDiagnosis + inDiagnosis,
      pendingQuote,
      inRepair,
      waitingForPart,
      readyForDelivery,
      pendingPayment: pendingPaymentRows.count ?? 0,
      delivered,
      incomeCollected,
      activeWarranties: activeWarranties.count ?? 0,
      criticalStock: criticalStockCount,
    };
  }

  private async countByStatus(status: string): Promise<number> {
    const { count, error } = await this.supabase.client
      .from('repair_orders_list')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('status', status);
    if (error) {
      throw new Error(error.message);
    }
    return count ?? 0;
  }
}
