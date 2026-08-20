export type CommunicationChannel = 'whatsapp';

export type CommunicationTemplateType =
  | 'confirmacion_recepcion'
  | 'diagnostico_disponible'
  | 'presupuesto_listo'
  | 'recordatorio_aprobacion'
  | 'esperando_repuesto'
  | 'reparacion_en_proceso'
  | 'listo_para_retirar'
  | 'recordatorio_retiro'
  | 'confirmacion_pago'
  | 'comprobante_digital'
  | 'garantia'
  | 'consulta_estado';

export const COMMUNICATION_TEMPLATE_LABELS: Record<CommunicationTemplateType, string> = {
  confirmacion_recepcion: 'Confirmación de recepción',
  diagnostico_disponible: 'Diagnóstico disponible',
  presupuesto_listo: 'Presupuesto listo',
  recordatorio_aprobacion: 'Recordatorio de aprobación',
  esperando_repuesto: 'Esperando repuesto',
  reparacion_en_proceso: 'Reparación en proceso',
  listo_para_retirar: 'Equipo listo para retirar',
  recordatorio_retiro: 'Recordatorio de retiro',
  confirmacion_pago: 'Confirmación de pago',
  comprobante_digital: 'Comprobante digital',
  garantia: 'Garantía',
  consulta_estado: 'Consulta de estado',
};

export type CommunicationStatus = 'preparado' | 'abierto_en_whatsapp';

export interface Communication {
  id: string;
  repairOrderId: string;
  channel: CommunicationChannel;
  templateType: CommunicationTemplateType;
  destinationPhone: string;
  messageText: string;
  statusAtSend: string;
  status: CommunicationStatus;
  createdBy: string | null;
  createdAt: string;
}
