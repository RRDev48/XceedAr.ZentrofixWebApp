export type RepairStatus =
  | 'recibido'
  | 'pendiente_diagnostico'
  | 'en_diagnostico'
  | 'presupuesto_pendiente'
  | 'presupuesto_aprobado'
  | 'presupuesto_rechazado'
  | 'esperando_repuesto'
  | 'en_reparacion'
  | 'en_pruebas'
  | 'listo_para_entregar'
  | 'entregado'
  | 'sin_reparacion'
  | 'garantia_reingreso'
  | 'cancelado';

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  recibido: 'Recibido',
  pendiente_diagnostico: 'Pendiente de diagnóstico',
  en_diagnostico: 'En diagnóstico',
  presupuesto_pendiente: 'Presupuesto pendiente de aprobación',
  presupuesto_aprobado: 'Presupuesto aprobado',
  presupuesto_rechazado: 'Presupuesto rechazado',
  esperando_repuesto: 'Esperando repuesto',
  en_reparacion: 'En reparación',
  en_pruebas: 'En pruebas',
  listo_para_entregar: 'Listo para entregar',
  entregado: 'Entregado',
  sin_reparacion: 'Sin reparación',
  garantia_reingreso: 'Garantía o reingreso',
  cancelado: 'Cancelado',
};

export const REPAIR_STATUS_ORDER: RepairStatus[] = [
  'recibido',
  'pendiente_diagnostico',
  'en_diagnostico',
  'presupuesto_pendiente',
  'presupuesto_aprobado',
  'presupuesto_rechazado',
  'esperando_repuesto',
  'en_reparacion',
  'en_pruebas',
  'listo_para_entregar',
  'entregado',
  'sin_reparacion',
  'garantia_reingreso',
  'cancelado',
];

export type RepairPriority = 'baja' | 'normal' | 'alta' | 'urgente';

export const REPAIR_PRIORITY_LABELS: Record<RepairPriority, string> = {
  baja: 'Baja',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

export type PaymentStatus = 'sin_pago' | 'senia' | 'pagado_parcial' | 'pagado_total';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  sin_pago: 'Sin pago',
  senia: 'Con seña',
  pagado_parcial: 'Pago parcial',
  pagado_total: 'Pagado total',
};

export interface RepairOrder {
  id: string;
  code: string;
  customerId: string;
  deviceId: string;
  receivedAt: string;
  reportedFault: string;
  receptionNotes: string | null;
  technicalDiagnosis: string | null;
  recommendedWork: string | null;
  status: RepairStatus;
  priority: RepairPriority;
  estimatedCompletionDate: string | null;
  customerPrice: number;
  discount: number;
  total: number;
  deposit: number;
  balanceDue: number;
  deliveredAt: string | null;
  relatedOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  // Datos combinados para listados (join)
  customerName?: string;
  customerPhone?: string;
  deviceLabel?: string;
}

export interface RepairOrderFormValue {
  customerId: string;
  deviceId: string;
  reportedFault: string;
  receptionNotes: string | null;
  priority: RepairPriority;
  estimatedCompletionDate: string | null;
  relatedOrderId?: string | null;
}

export interface RepairStatusHistoryEntry {
  id: string;
  repairOrderId: string;
  fromStatus: RepairStatus | null;
  toStatus: RepairStatus;
  changedAt: string;
  changedBy: string | null;
  note: string | null;
}

export interface RepairOrderFilters {
  search: string;
  status: RepairStatus | 'todos';
  paymentStatus: PaymentStatus | 'todos';
  brand: string;
  dateFrom: string | null;
  dateTo: string | null;
}
