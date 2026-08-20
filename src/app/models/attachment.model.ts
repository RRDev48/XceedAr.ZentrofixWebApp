export type AttachmentCategory = 'foto_recepcion' | 'foto_diagnostico' | 'comprobante' | 'garantia' | 'otro';

export const ATTACHMENT_CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  foto_recepcion: 'Foto de recepción',
  foto_diagnostico: 'Foto de diagnóstico',
  comprobante: 'Comprobante digital',
  garantia: 'Garantía',
  otro: 'Otro',
};

export interface Attachment {
  id: string;
  repairOrderId: string | null;
  bucket: string;
  storagePath: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  category: AttachmentCategory | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface Warranty {
  id: string;
  repairOrderId: string;
  coverageDetails: string;
  startsAt: string;
  expiresAt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
