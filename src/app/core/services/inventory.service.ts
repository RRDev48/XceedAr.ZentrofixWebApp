import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { AuthService } from '../auth/auth.service';
import { InventoryItem, InventoryItemFormValue, InventoryMovement, InventoryMovementType } from '../../models';

interface InventoryItemRow {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  stock_quantity: number;
  minimum_stock: number;
  unit_cost: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    stockQuantity: Number(row.stock_quantity),
    minimumStock: Number(row.minimum_stock),
    unitCost: Number(row.unit_cost),
    unitPrice: Number(row.unit_price),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly auth: AuthService,
  ) {}

  async list(search = ''): Promise<InventoryItem[]> {
    let query = this.supabase.client
      .from('inventory_items')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (search.trim()) {
      const term = search.trim();
      query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return (data as InventoryItemRow[]).map(mapItem);
  }

  async getById(id: string): Promise<InventoryItem | null> {
    const { data, error } = await this.supabase.client.from('inventory_items').select('*').eq('id', id).maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapItem(data as InventoryItemRow) : null;
  }

  async create(value: InventoryItemFormValue, initialStock: number): Promise<InventoryItem> {
    const { data, error } = await this.supabase.client
      .from('inventory_items')
      .insert({
        sku: value.sku?.trim() || null,
        name: value.name.trim(),
        description: value.description?.trim() || null,
        minimum_stock: value.minimumStock,
        unit_cost: value.unitCost,
        unit_price: value.unitPrice,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    const item = mapItem(data as InventoryItemRow);

    if (initialStock > 0) {
      await this.registerMovement(item.id, 'ingreso', initialStock, 'Stock inicial');
      return (await this.getById(item.id)) ?? item;
    }
    return item;
  }

  async update(id: string, value: InventoryItemFormValue): Promise<InventoryItem> {
    const { data, error } = await this.supabase.client
      .from('inventory_items')
      .update({
        sku: value.sku?.trim() || null,
        name: value.name.trim(),
        description: value.description?.trim() || null,
        minimum_stock: value.minimumStock,
        unit_cost: value.unitCost,
        unit_price: value.unitPrice,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapItem(data as InventoryItemRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('inventory_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
  }

  async listDeleted(): Promise<InventoryItem[]> {
    const { data, error } = await this.supabase.client
      .from('inventory_items')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data as InventoryItemRow[]).map(mapItem);
  }

  async restore(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('inventory_items').update({ deleted_at: null }).eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
  }

  async listMovements(itemId: string): Promise<InventoryMovement[]> {
    const { data, error } = await this.supabase.client
      .from('inventory_movements')
      .select('*')
      .eq('inventory_item_id', itemId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row: any) => ({
      id: row.id,
      inventoryItemId: row.inventory_item_id,
      repairOrderId: row.repair_order_id,
      movementType: row.movement_type,
      quantity: Number(row.quantity),
      note: row.note,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  }

  async registerMovement(
    itemId: string,
    movementType: InventoryMovementType,
    quantity: number,
    note: string | null,
    repairOrderId: string | null = null,
  ): Promise<void> {
    const { error } = await this.supabase.client.from('inventory_movements').insert({
      inventory_item_id: itemId,
      repair_order_id: repairOrderId,
      movement_type: movementType,
      quantity,
      note: note?.trim() || null,
      created_by: this.auth.session()?.user.id ?? null,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
}
