export type InventoryMovementType = 'ingreso' | 'egreso' | 'ajuste' | 'uso_en_orden';

export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  ingreso: 'Ingreso de stock',
  egreso: 'Egreso de stock',
  ajuste: 'Ajuste (suma)',
  uso_en_orden: 'Uso en una orden',
};

export interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  stockQuantity: number;
  minimumStock: number;
  unitCost: number;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface InventoryItemFormValue {
  sku: string | null;
  name: string;
  description: string | null;
  minimumStock: number;
  unitCost: number;
  unitPrice: number;
}

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  repairOrderId: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}
