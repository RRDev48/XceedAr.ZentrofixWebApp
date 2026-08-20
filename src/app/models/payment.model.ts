export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'billetera_virtual' | 'otro';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  billetera_virtual: 'Billetera virtual',
  otro: 'Otro',
};

export interface Payment {
  id: string;
  repairOrderId: string;
  amount: number;
  method: PaymentMethod;
  isDeposit: boolean;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface PaymentFormValue {
  amount: number;
  method: PaymentMethod;
  isDeposit: boolean;
  note: string | null;
}

export type CashMovementType = 'ingreso' | 'egreso';

export const CASH_MOVEMENT_LABELS: Record<CashMovementType, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
};

export interface CashMovement {
  id: string;
  movementType: CashMovementType;
  amount: number;
  concept: string;
  repairOrderId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CashMovementFormValue {
  movementType: CashMovementType;
  amount: number;
  concept: string;
}
