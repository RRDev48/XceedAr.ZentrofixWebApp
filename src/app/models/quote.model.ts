export type QuoteApprovalStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'vencido';

export const QUOTE_APPROVAL_LABELS: Record<QuoteApprovalStatus, string> = {
  pendiente: 'Pendiente de respuesta',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  vencido: 'Vencido',
};

export interface QuoteItem {
  id: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  repairOrderId: string;
  laborCost: number;
  discount: number;
  total: number;
  validUntil: string | null;
  customerNotes: string | null;
  approvalStatus: QuoteApprovalStatus;
  sentAt: string | null;
  respondedAt: string | null;
  respondedVia: string | null;
  respondedBy: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
}

export interface QuoteFormValue {
  laborCost: number;
  discount: number;
  validUntil: string | null;
  customerNotes: string | null;
  items: QuoteItem[];
}
