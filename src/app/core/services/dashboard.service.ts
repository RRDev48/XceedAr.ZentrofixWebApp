import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { RepairOrdersService } from './repair-orders.service';
import { WarrantiesService } from './warranties.service';
import { CashService } from './cash.service';

interface IncomeRow {
  deposit: number;
  total: number;
  balance_due: number;
}

interface StockRow {
  id: string;
  stock_quantity: number;
  minimum_stock: number;
}

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
  staleOrders: number;
  expiringWarranties: number;
  incomeThisMonth: number;
  incomeLastMonth: number;
  ordersThisMonth: number;
  ordersLastMonth: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly ordersService = inject(RepairOrdersService);
  private readonly warrantiesService = inject(WarrantiesService);
  private readonly cashService = inject(CashService);

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
      staleOrders,
      expiringWarranties,
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
      this.ordersService.listStale(),
      this.warrantiesService.listExpiringSoon(15),
    ]);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [movements, ordersThisMonth, ordersLastMonth] = await Promise.all([
      this.cashService.listBetween(lastMonthStart.toISOString(), now.toISOString()),
      this.countOrdersBetween(thisMonthStart.toISOString(), now.toISOString()),
      this.countOrdersBetween(lastMonthStart.toISOString(), thisMonthStart.toISOString()),
    ]);

    const incomeThisMonth = movements
      .filter((m) => m.movementType === 'ingreso' && new Date(m.createdAt) >= thisMonthStart)
      .reduce((sum, m) => sum + m.amount, 0);
    const incomeLastMonth = movements
      .filter(
        (m) =>
          m.movementType === 'ingreso' && new Date(m.createdAt) >= lastMonthStart && new Date(m.createdAt) < thisMonthStart,
      )
      .reduce((sum, m) => sum + m.amount, 0);

    const incomeCollected = ((incomeRows.data ?? []) as IncomeRow[]).reduce((sum, row) => {
      const collected = Number(row.total) - Number(row.balance_due);
      return sum + (collected > 0 ? collected : 0);
    }, 0);

    const criticalStockCount = ((criticalStock.data ?? []) as StockRow[]).filter(
      (row) => Number(row.stock_quantity) <= Number(row.minimum_stock),
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
      staleOrders: staleOrders.length,
      expiringWarranties: expiringWarranties.length,
      incomeThisMonth,
      incomeLastMonth,
      ordersThisMonth,
      ordersLastMonth,
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

  private async countOrdersBetween(fromIso: string, toIso: string): Promise<number> {
    const { count, error } = await this.supabase.client
      .from('repair_orders_list')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('received_at', fromIso)
      .lt('received_at', toIso);
    if (error) {
      throw new Error(error.message);
    }
    return count ?? 0;
  }
}
