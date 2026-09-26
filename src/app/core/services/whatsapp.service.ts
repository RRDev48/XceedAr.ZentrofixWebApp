import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { AuthService } from '../auth/auth.service';
import { buildWhatsAppLink } from '../../shared/utils/phone.util';
import {
  Communication,
  CommunicationChannel,
  CommunicationStatus,
  CommunicationTemplateType,
  Quote,
  REPAIR_STATUS_LABELS,
  RepairOrder,
  RepairStatus,
  Warranty,
} from '../../models';

interface CommunicationRow {
  id: string;
  repair_order_id: string;
  channel: CommunicationChannel;
  template_type: CommunicationTemplateType;
  destination_phone: string;
  message_text: string;
  status_at_send: string;
  status: CommunicationStatus;
  created_by: string | null;
  created_at: string;
}

function formatCurrencyAR(value: number): string {
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDateAR(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-AR');
}

/** Evita el doble punto cuando el texto cargado por el técnico ya termina en puntuación. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

const DEFAULT_WORKSHOP_NAME = 'nuestro taller';

/**
 * Cada plantilla arma el mensaje con los datos reales que ya están cargados en la orden
 * (diagnóstico, saldo, fecha estimada, vigencia de garantía) en vez de avisar que la info
 * existe y obligar al cliente a preguntar de vuelta — eso terminaba generando un ida y
 * vuelta que el staff tenía que responder a mano igual.
 */
type TemplateFn = (o: RepairOrder, workshopName: string, warranty?: Warranty | null) => string;

const TEMPLATES: Record<CommunicationTemplateType, TemplateFn> = {
  confirmacion_recepcion: (o, w) => {
    let msg = `Hola, ${o.customerName}. Somos ${w}. Recibimos tu equipo ${o.deviceLabel} bajo la orden ${o.code}.`;
    if (o.estimatedCompletionDate) {
      msg += ` Fecha estimada de entrega: ${formatDateAR(o.estimatedCompletionDate)}.`;
    }
    msg += ' Te avisamos apenas tengamos el diagnóstico. Ante cualquier consulta, respondé este mensaje.';
    return msg;
  },
  diagnostico_disponible: (o) => {
    let msg = `Hola, ${o.customerName}. Ya tenemos el diagnóstico de tu equipo ${o.deviceLabel} (orden ${o.code}).`;
    if (o.technicalDiagnosis) {
      msg += ` Diagnóstico: ${sentence(o.technicalDiagnosis)}`;
    }
    if (o.recommendedWork) {
      msg += ` Trabajo a realizar: ${sentence(o.recommendedWork)}`;
    }
    if (o.total > 0) {
      msg += ` Costo estimado: ${formatCurrencyAR(o.total)}.`;
    }
    msg += ' Contanos si querés que avancemos con la reparación.';
    return msg;
  },
  presupuesto_listo: (o) =>
    `Hola, ${o.customerName}. Tu presupuesto para el equipo ${o.deviceLabel} (orden ${o.code}) ya está listo. Total: $${o.total.toLocaleString('es-AR')}. Quedamos atentos a tu confirmación.`,
  recordatorio_aprobacion: (o) => {
    let msg = `Hola, ${o.customerName}. Te recordamos que tu presupuesto de la orden ${o.code}`;
    if (o.total > 0) {
      msg += ` por ${formatCurrencyAR(o.total)}`;
    }
    msg += ' está pendiente de aprobación. Respondé este mensaje para confirmarlo o si tenés dudas.';
    return msg;
  },
  esperando_repuesto: (o) => {
    let msg = `Hola, ${o.customerName}. Tu equipo ${o.deviceLabel} (orden ${o.code}) está a la espera de un repuesto.`;
    msg += o.estimatedCompletionDate
      ? ` Estimamos tenerlo listo el ${formatDateAR(o.estimatedCompletionDate)}.`
      : ' Te avisamos en cuanto llegue.';
    return msg;
  },
  reparacion_en_proceso: (o) => {
    let msg = `Hola, ${o.customerName}. Tu equipo ${o.deviceLabel} (orden ${o.code}) ya está en reparación.`;
    msg += o.estimatedCompletionDate
      ? ` Estimamos entregarlo el ${formatDateAR(o.estimatedCompletionDate)}.`
      : ' Te mantenemos al tanto.';
    return msg;
  },
  listo_para_retirar: (o, w) => {
    let msg = `Hola, ${o.customerName}. Tu equipo ${o.deviceLabel} (orden ${o.code}) ya está listo para retirar.`;
    if (o.balanceDue > 0) {
      msg += ` Saldo a abonar: ${formatCurrencyAR(o.balanceDue)}.`;
    }
    msg += ` Te esperamos en ${w}.`;
    return msg;
  },
  recordatorio_retiro: (o, w) => {
    let msg = `Hola, ${o.customerName}. Te recordamos que tu equipo ${o.deviceLabel} (orden ${o.code}) está listo para retirar en ${w}.`;
    if (o.balanceDue > 0) {
      msg += ` Saldo a abonar: ${formatCurrencyAR(o.balanceDue)}.`;
    }
    return msg;
  },
  confirmacion_pago: (o, w) => {
    let msg = `Hola, ${o.customerName}. Confirmamos el pago registrado para la orden ${o.code}.`;
    msg += o.balanceDue > 0 ? ` Saldo pendiente: ${formatCurrencyAR(o.balanceDue)}.` : ' Tu cuenta queda saldada.';
    msg += ` ¡Gracias por confiar en ${w}!`;
    return msg;
  },
  comprobante_digital: (o) =>
    `Hola, ${o.customerName}. Te compartimos el comprobante digital correspondiente a la orden ${o.code}.`,
  garantia: (o, w, warranty) => {
    let msg = `Hola, ${o.customerName}. Tu equipo ${o.deviceLabel} (orden ${o.code}) cuenta con garantía de ${w}`;
    msg += warranty ? ` hasta el ${formatDateAR(warranty.expiresAt)}.` : '.';
    msg += ' Ante cualquier inconveniente, escribinos por acá.';
    return msg;
  },
  consulta_estado: (o, w) =>
    `Hola, ${o.customerName}. Somos ${w}. Tu equipo ${o.deviceLabel} se encuentra actualmente en estado: ${REPAIR_STATUS_LABELS[o.status]}. Orden: ${o.code}. Ante cualquier consulta, respondé este mensaje.`,
};

/** Plantilla más relevante según el estado actual, para no arrancar siempre en
 * "Consulta de estado" y que el usuario tenga que buscar la que corresponde. */
const STATUS_SUGGESTED_TEMPLATE: Partial<Record<RepairStatus, CommunicationTemplateType>> = {
  recibido: 'confirmacion_recepcion',
  presupuesto_pendiente: 'diagnostico_disponible',
  presupuesto_aprobado: 'reparacion_en_proceso',
  esperando_repuesto: 'esperando_repuesto',
  en_reparacion: 'reparacion_en_proceso',
  en_pruebas: 'reparacion_en_proceso',
  listo_para_entregar: 'listo_para_retirar',
  garantia_reingreso: 'garantia',
};

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly auth: AuthService,
  ) {}

  private workshopName(): string {
    return this.auth.profile()?.workshopName || DEFAULT_WORKSHOP_NAME;
  }

  buildMessage(order: RepairOrder, templateType: CommunicationTemplateType, warranty?: Warranty | null): string {
    return TEMPLATES[templateType](order, this.workshopName(), warranty);
  }

  /** Plantilla sugerida según el estado actual de la orden (fallback: consulta de estado). */
  suggestedTemplate(status: RepairStatus): CommunicationTemplateType {
    return STATUS_SUGGESTED_TEMPLATE[status] ?? 'consulta_estado';
  }

  /**
   * Mensaje de presupuesto: lista los ítems (sin precio unitario) cuando corresponde, y
   * manda el total directamente. Nunca incluye mano de obra, descuento, recargo ni ningún
   * otro dato de costos o margen: eso es información interna, no para el cliente.
   */
  buildQuoteMessage(order: RepairOrder, quote: Quote): string {
    const itemLines = quote.items
      .filter((i) => !/^Recargo\s*\(/i.test(i.description))
      .map((i) => `• ${i.description}${i.quantity !== 1 ? ` x${i.quantity}` : ''}`)
      .join('\n');

    const blocks: string[] = [
      `Hola, ${order.customerName}. Somos ${this.workshopName()}.`,
      `Tu presupuesto para *${order.deviceLabel}* (orden ${order.code}) ya está listo:`,
    ];
    if (itemLines) {
      blocks.push(itemLines);
    }
    blocks.push(`*Total: ${formatCurrencyAR(quote.total)}*`);
    if (quote.validUntil) {
      blocks.push(`Válido hasta el ${formatDateAR(quote.validUntil)}.`);
    }
    if (quote.customerNotes) {
      blocks.push(quote.customerNotes);
    }
    blocks.push('Ante cualquier consulta o para confirmarlo, respondé este mensaje.');

    return blocks.join('\n\n');
  }

  /**
   * Agrega el enlace de descarga de la orden de trabajo al mensaje de recepción ya armado
   * (respeta lo que el usuario haya editado en el modal): la orden de trabajo se manda junto
   * con el aviso de recepción, no por separado.
   */
  appendWorkOrderLink(message: string, signedUrl: string): string {
    return [message, `Orden de trabajo (guardala como constancia de la recepción): ${signedUrl}`].join('\n\n');
  }

  /** Mensaje con el enlace temporal de descarga del comprobante digital en PDF. */
  buildReceiptMessage(order: RepairOrder, signedUrl: string): string {
    return [
      `Hola, ${order.customerName}. Somos ${this.workshopName()}. Te compartimos el comprobante digital de tu orden ${order.code}.`,
      `Podés verlo o descargarlo acá: ${signedUrl}`,
      'El enlace vence en algunos días. Ante cualquier consulta, respondé este mensaje.',
    ].join('\n');
  }

  buildLink(order: RepairOrder, message: string): string | null {
    return buildWhatsAppLink(order.customerPhone ?? '', message);
  }

  /**
   * Registra que un mensaje fue preparado (y, si se pudo abrir wa.me, que se abrió WhatsApp).
   * Nunca afirma que el mensaje fue efectivamente enviado: eso ocurre fuera del sistema.
   */
  async logPrepared(
    order: RepairOrder,
    templateType: CommunicationTemplateType,
    messageText: string,
    opened: boolean,
  ): Promise<void> {
    const { error } = await this.supabase.client.from('communications').insert({
      repair_order_id: order.id,
      channel: 'whatsapp',
      template_type: templateType,
      destination_phone: order.customerPhone ?? '',
      message_text: messageText,
      status_at_send: order.status,
      status: opened ? 'abierto_en_whatsapp' : 'preparado',
      created_by: this.auth.session()?.user.id ?? null,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  async listByOrder(orderId: string): Promise<Communication[]> {
    const { data, error } = await this.supabase.client
      .from('communications')
      .select('*')
      .eq('repair_order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return ((data ?? []) as CommunicationRow[]).map((row) => ({
      id: row.id,
      repairOrderId: row.repair_order_id,
      channel: row.channel,
      templateType: row.template_type,
      destinationPhone: row.destination_phone,
      messageText: row.message_text,
      statusAtSend: row.status_at_send,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  }
}
