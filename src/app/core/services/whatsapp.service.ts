import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { AuthService } from '../auth/auth.service';
import { buildWhatsAppLink } from '../../shared/utils/phone.util';
import { CommunicationTemplateType, Quote, REPAIR_STATUS_LABELS, RepairOrder } from '../../models';

function formatCurrencyAR(value: number): string {
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDateAR(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-AR');
}

const TEMPLATES: Record<CommunicationTemplateType, (o: RepairOrder) => string> = {
  confirmacion_recepcion: (o) =>
    `Hola, ${o.customerName}. Somos Zentrofix. Recibimos tu equipo ${o.deviceLabel} bajo la orden ${o.code}. Te avisamos apenas tengamos novedades. Ante cualquier consulta, respondé este mensaje.`,
  diagnostico_disponible: (o) =>
    `Hola, ${o.customerName}. Ya tenemos el diagnóstico de tu equipo ${o.deviceLabel} (orden ${o.code}). Te contamos los detalles a la brevedad.`,
  presupuesto_listo: (o) =>
    `Hola, ${o.customerName}. Tu presupuesto para el equipo ${o.deviceLabel} (orden ${o.code}) ya está listo. Total: $${o.total.toLocaleString('es-AR')}. Quedamos atentos a tu confirmación.`,
  recordatorio_aprobacion: (o) =>
    `Hola, ${o.customerName}. Te recordamos que tu presupuesto de la orden ${o.code} está pendiente de aprobación. Cualquier consulta, respondé este mensaje.`,
  esperando_repuesto: (o) =>
    `Hola, ${o.customerName}. Tu equipo ${o.deviceLabel} (orden ${o.code}) está a la espera de un repuesto. Te avisamos en cuanto llegue.`,
  reparacion_en_proceso: (o) =>
    `Hola, ${o.customerName}. Tu equipo ${o.deviceLabel} (orden ${o.code}) ya está en reparación. Te mantenemos al tanto.`,
  listo_para_retirar: (o) =>
    `Hola, ${o.customerName}. Tu equipo ${o.deviceLabel} (orden ${o.code}) ya está listo para retirar. Te esperamos en Zentrofix.`,
  recordatorio_retiro: (o) =>
    `Hola, ${o.customerName}. Te recordamos que tu equipo ${o.deviceLabel} (orden ${o.code}) está listo para retirar en Zentrofix.`,
  confirmacion_pago: (o) =>
    `Hola, ${o.customerName}. Confirmamos el pago registrado para la orden ${o.code}. ¡Gracias por confiar en Zentrofix!`,
  comprobante_digital: (o) =>
    `Hola, ${o.customerName}. Te compartimos el comprobante digital correspondiente a la orden ${o.code}.`,
  garantia: (o) =>
    `Hola, ${o.customerName}. Tu equipo ${o.deviceLabel} (orden ${o.code}) cuenta con garantía de Zentrofix. Ante cualquier inconveniente, escribinos por acá.`,
  consulta_estado: (o) =>
    `Hola, ${o.customerName}. Somos Zentrofix. Tu equipo ${o.deviceLabel} se encuentra actualmente en estado: ${REPAIR_STATUS_LABELS[o.status]}. Orden: ${o.code}. Ante cualquier consulta, respondé este mensaje.`,
};

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly auth: AuthService,
  ) {}

  buildMessage(order: RepairOrder, templateType: CommunicationTemplateType): string {
    return TEMPLATES[templateType](order);
  }

  /**
   * Mensaje de presupuesto con el detalle real (ítems, mano de obra, descuento, total y
   * vigencia), separado en párrafos para que no quede amontonado. Nunca incluye el recargo
   * ni ningún otro dato de margen: eso es información interna, no para el cliente.
   */
  buildQuoteMessage(order: RepairOrder, quote: Quote): string {
    const itemLines = quote.items
      .filter((i) => !/^Recargo\s*\(/i.test(i.description))
      .map((i) => `• ${i.description} x${i.quantity}: ${formatCurrencyAR(i.quantity * i.unitPrice)}`)
      .join('\n');

    const blocks: string[] = [
      `Hola, ${order.customerName}. Somos Zentrofix.`,
      `Tu presupuesto para *${order.deviceLabel}* (orden ${order.code}) ya está listo:`,
    ];
    if (itemLines) {
      blocks.push(itemLines);
    }
    if (quote.laborCost > 0) {
      blocks.push(`Mano de obra: ${formatCurrencyAR(quote.laborCost)}`);
    }
    if (quote.discount > 0) {
      blocks.push(`Descuento: ${formatCurrencyAR(quote.discount)}`);
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

  /** Mensaje con el enlace temporal de descarga del comprobante digital en PDF. */
  buildReceiptMessage(order: RepairOrder, signedUrl: string): string {
    return [
      `Hola, ${order.customerName}. Somos Zentrofix. Te compartimos el comprobante digital de tu orden ${order.code}.`,
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
}
