import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthService } from '../auth/auth.service';
import {
  DEVICE_TYPE_LABELS,
  DeviceType,
  Payment,
  PAYMENT_METHOD_LABELS,
  RepairOrder,
  REPAIR_STATUS_LABELS,
  Warranty,
} from '../../models';

const BLUE: [number, number, number] = [30, 155, 255];
const BLACK: [number, number, number] = [8, 9, 12];
const TEXT: [number, number, number] = [30, 33, 40];
const MUTED: [number, number, number] = [120, 126, 138];
const BORDER: [number, number, number] = [225, 228, 233];
const SECTION_BG: [number, number, number] = [240, 245, 250];

const MARGIN = 16;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const DEFAULT_WORKSHOP_NAME = 'nuestro taller';

const TERMS_TEXT =
  'La reparación realizada cubre exclusivamente la falla diagnosticada y el trabajo detallado en este ' +
  'comprobante. La garantía no cubre daños posteriores por golpes, caídas, rayaduras o impactos de ' +
  'cualquier índole, ni daños por humedad o inmersión en cualquier tipo de líquido.';

interface FieldCell {
  label: string;
  value?: string;
  /** Peso relativo del ancho de columna (por defecto, reparto parejo entre las celdas de la fila). */
  width?: number;
  /** Para celdas gráficas (ej. el tablero de patrón) en vez de texto. Devuelve el alto usado en mm. */
  draw?: (doc: jsPDF, x: number, y: number, width: number) => number;
}

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly auth = inject(AuthService);

  private workshopName(): string {
    return this.auth.profile()?.workshopName || DEFAULT_WORKSHOP_NAME;
  }

  /**
   * Genera la orden de trabajo: el comprobante que se entrega al cliente cuando deja el
   * equipo. Deja constancia de sus datos, el equipo, los accesorios entregados y la
   * contraseña/patrón de desbloqueo — nunca incluye costos, porque todavía no existen en
   * esta instancia de la orden.
   */
  async generateWorkOrder(order: RepairOrder): Promise<Blob> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logo = await this.loadLogoBase64();
    const workshopName = this.workshopName();

    this.drawHeader(doc, order, logo, workshopName, 'Orden de trabajo');

    let y = 36;
    y = this.drawSectionHeader(doc, 1, 'Datos del cliente', y);
    y = this.drawFieldsRow(
      doc,
      [
        { label: 'Nombre', value: order.customerName ?? '-', width: 1.4 },
        { label: 'DNI / CUIT', value: order.customerDni || '-', width: 1 },
      ],
      y,
    );
    y = this.drawFieldsRow(
      doc,
      [
        { label: 'Teléfono / celular', value: order.customerPhone ?? '-' },
        { label: 'Correo electrónico', value: order.customerEmail || '-' },
      ],
      y,
    );
    if (order.customerAddress) {
      y = this.drawFieldsRow(doc, [{ label: 'Dirección completa', value: order.customerAddress }], y);
    }
    y += 3;

    y = this.drawSectionHeader(doc, 2, 'Datos del equipo', y);
    y = this.drawFieldsRow(
      doc,
      [
        { label: 'Tipo de equipo', value: order.deviceType ? DEVICE_TYPE_LABELS[order.deviceType as DeviceType] : '-' },
        { label: 'Marca', value: order.deviceBrand || '-' },
        { label: 'Modelo', value: order.deviceModel || '-' },
      ],
      y,
    );
    y = this.drawFieldsRow(
      doc,
      [
        { label: 'Número de serie / IMEI', value: order.deviceImei || '-', width: 1.6 },
        { label: 'Contraseña / PIN', value: order.deviceAccessCode || '-', width: 1 },
        {
          label: 'Patrón',
          width: 0.8,
          draw: (d, x, cy) => this.drawPatternDots(d, x, cy),
        },
      ],
      y,
    );
    y = this.drawFieldsRow(
      doc,
      [{ label: 'Accesorios recibidos (cargador, funda, cables, etc.)', value: order.deviceAccessories || 'Ninguno declarado' }],
      y,
    );
    y += 3;

    y = this.drawSectionHeader(doc, 3, 'Detalle del servicio', y);
    y = this.drawBoxedText(doc, 'Falla reportada por el cliente / motivo de ingreso', order.reportedFault, y, 3);
    y = this.drawBoxedText(
      doc,
      'Diagnóstico técnico y trabajo a realizar (para uso del técnico)',
      order.technicalDiagnosis || '',
      y,
      3,
    );

    this.drawSignatureLine(doc, y);
    this.drawFooter(doc, order);

    return doc.output('blob');
  }

  /**
   * Genera el comprobante de entrega: se entrega al retirar el equipo. Muestra costos,
   * pagos y garantía. Nunca incluye costo interno ni observaciones internas.
   */
  async generateDeliveryReceipt(order: RepairOrder, payments: Payment[], warranty: Warranty | null): Promise<Blob> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logo = await this.loadLogoBase64();
    const workshopName = this.workshopName();

    this.drawHeader(doc, order, logo, workshopName, 'Comprobante de entrega');

    let y = 36;
    y = this.drawSectionHeader(doc, 1, 'Datos del cliente y equipo', y);
    y = this.drawFieldsRow(
      doc,
      [
        { label: 'Cliente', value: order.customerName ?? '-' },
        { label: 'Equipo', value: order.deviceLabel ?? '-' },
      ],
      y,
    );
    y = this.drawFieldsRow(
      doc,
      [
        { label: 'Teléfono', value: order.customerPhone ?? '-' },
        { label: 'Estado', value: REPAIR_STATUS_LABELS[order.status] },
      ],
      y,
    );
    y = this.drawFieldsRow(
      doc,
      [
        { label: 'Ingreso', value: new Date(order.receivedAt).toLocaleDateString('es-AR') },
        { label: 'IMEI / Serie', value: order.deviceImei || '-' },
      ],
      y,
    );
    y += 3;

    y = this.drawSectionHeader(doc, 2, 'Detalle del servicio', y);
    y = this.drawBoxedText(doc, 'Falla declarada', order.reportedFault, y, 2);
    if (order.technicalDiagnosis) {
      y = this.drawBoxedText(doc, 'Diagnóstico técnico', order.technicalDiagnosis, y, 2);
    }
    y += 2;

    y = this.drawSectionHeader(doc, 3, 'Costos', y);
    y = this.drawCostTable(doc, order, y);

    if (payments.length > 0) {
      y = this.drawPaymentsTable(doc, payments, y);
    }

    if (warranty) {
      y = this.drawWarrantyBox(doc, warranty, y);
    }

    this.drawTermsBox(doc, y);
    this.drawFooter(doc, order);

    return doc.output('blob');
  }

  private async loadLogoBase64(): Promise<string | null> {
    try {
      const response = await fetch('assets/branding/isotipo.png');
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  private drawHeader(doc: jsPDF, order: RepairOrder, logo: string | null, workshopName: string, subtitle: string): void {
    doc.setFillColor(...BLACK);
    doc.rect(0, 0, PAGE_WIDTH, 30, 'F');

    if (logo) {
      doc.addImage(logo, 'PNG', MARGIN, 7, 16, 16);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(workshopName.toUpperCase(), MARGIN + (logo ? 20 : 0), 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 205, 213);
    doc.text(`Gestión técnica · ${subtitle}`, MARGIN + (logo ? 20 : 0), 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BLUE);
    doc.text(order.code, PAGE_WIDTH - MARGIN, 15, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(200, 205, 213);
    doc.text(`Emitido el ${new Date().toLocaleDateString('es-AR')}`, PAGE_WIDTH - MARGIN, 21, { align: 'right' });
  }

  /** Barra con acento de color y título numerado, para separar cada bloque del formulario. */
  private drawSectionHeader(doc: jsPDF, index: number, title: string, startY: number): number {
    const height = 7;
    doc.setFillColor(...SECTION_BG);
    doc.rect(MARGIN, startY, CONTENT_WIDTH, height, 'F');
    doc.setFillColor(...BLUE);
    doc.rect(MARGIN, startY, 1.3, height, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT);
    doc.text(`${index}. ${title.toUpperCase()}`, MARGIN + 4, startY + height / 2 + 1.4);

    return startY + height + 5;
  }

  /** Fila de campos "etiqueta arriba, valor abajo", repartidos en columnas según el peso de cada celda. */
  private drawFieldsRow(doc: jsPDF, cells: FieldCell[], startY: number): number {
    const totalWeight = cells.reduce((sum, c) => sum + (c.width ?? 1), 0);
    let x = MARGIN;
    let maxHeight = 0;

    for (const cell of cells) {
      const width = ((cell.width ?? 1) / totalWeight) * CONTENT_WIDTH;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(cell.label.toUpperCase(), x, startY);

      if (cell.draw) {
        const h = cell.draw(doc, x, startY + 3, width);
        maxHeight = Math.max(maxHeight, h + 3);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...TEXT);
        const lines = doc.splitTextToSize(cell.value || '-', width - 3);
        doc.text(lines, x, startY + 4.5);
        maxHeight = Math.max(maxHeight, 4.5 + lines.length * 4.2);
      }

      x += width;
    }

    return startY + maxHeight + 4;
  }

  /** Tablero de 9 puntos en blanco para marcar a mano un patrón de desbloqueo. */
  private drawPatternDots(doc: jsPDF, x: number, y: number): number {
    const spacing = 3.4;
    doc.setDrawColor(...MUTED);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        doc.circle(x + 1.5 + col * spacing, y + 1.5 + row * spacing, 0.9, 'S');
      }
    }
    return spacing * 2 + 3;
  }

  /** Bloque de texto libre (falla, diagnóstico) dentro de un recuadro, como un campo de formulario en papel. */
  private drawBoxedText(doc: jsPDF, label: string, content: string, startY: number, minLines: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), MARGIN, startY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(content, CONTENT_WIDTH - 6);
    const lineCount = Math.max(lines.length, minLines);
    const boxY = startY + 2.5;
    const boxHeight = lineCount * 4.2 + 5;

    doc.setDrawColor(...BORDER);
    doc.roundedRect(MARGIN, boxY, CONTENT_WIDTH, boxHeight, 1.5, 1.5, 'S');

    doc.setTextColor(...TEXT);
    doc.text(lines, MARGIN + 3, boxY + 5);

    return boxY + boxHeight + 5;
  }

  private drawCostTable(doc: jsPDF, order: RepairOrder, startY: number): number {
    type Cell = string | { content: string; styles?: Record<string, unknown> };
    const rows: Cell[][] = [];

    if (order.discount > 0) {
      rows.push(['Descuento aplicado', `- ${formatCurrency(order.discount)}`]);
    }
    rows.push([
      { content: 'Total', styles: { fontStyle: 'bold' } },
      { content: formatCurrency(order.total), styles: { fontStyle: 'bold' } },
    ]);
    if (order.deposit > 0) {
      rows.push(['Pagado a cuenta', formatCurrency(order.deposit)]);
    }
    if (order.balanceDue > 0) {
      rows.push([
        { content: 'Saldo pendiente', styles: { fontStyle: 'bold' } },
        { content: formatCurrency(order.balanceDue), styles: { fontStyle: 'bold', textColor: [214, 69, 69] } },
      ]);
    }

    autoTable(doc, {
      startY,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Detalle', 'Importe']],
      body: rows as never,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: { top: 2.5, bottom: 2.5, left: 0, right: 0 } },
      headStyles: { fillColor: BLACK, textColor: 255, fontStyle: 'bold', cellPadding: 2.5 },
      columnStyles: { 1: { halign: 'right' } },
    });

    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  private drawPaymentsTable(doc: jsPDF, payments: Payment[], startY: number): number {
    autoTable(doc, {
      startY,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Pagos registrados', 'Método', 'Importe']],
      body: payments.map((p) => [
        new Date(p.createdAt).toLocaleDateString('es-AR'),
        PAYMENT_METHOD_LABELS[p.method],
        formatCurrency(p.amount),
      ]),
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
    });

    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  private drawWarrantyBox(doc: jsPDF, warranty: Warranty, startY: number): number {
    const boxHeight = 20;
    doc.setFillColor(244, 249, 255);
    doc.setDrawColor(...BLUE);
    doc.roundedRect(MARGIN, startY, CONTENT_WIDTH, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BLUE);
    doc.text('GARANTÍA', MARGIN + 4, startY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    const lines = doc.splitTextToSize(warranty.coverageDetails, CONTENT_WIDTH - 8);
    doc.text(lines, MARGIN + 4, startY + 11);

    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `Vigente desde ${formatDate(warranty.startsAt)} hasta ${formatDate(warranty.expiresAt)}`,
      MARGIN + 4,
      startY + boxHeight - 3,
    );

    return startY + boxHeight + 8;
  }

  private drawTermsBox(doc: jsPDF, startY: number): number {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(TERMS_TEXT, CONTENT_WIDTH - 8);
    const boxHeight = lines.length * 3.6 + 11;

    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(MARGIN, startY, CONTENT_WIDTH, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text('TÉRMINOS Y CONDICIONES', MARGIN + 4, startY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(lines, MARGIN + 4, startY + 10.5);

    return startY + boxHeight + 8;
  }

  private drawSignatureLine(doc: jsPDF, startY: number): number {
    const y = startY + 16;
    doc.setDrawColor(...BORDER);
    doc.line(MARGIN, y, MARGIN + 70, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Firma del cliente', MARGIN, y + 4);
    return y + 4;
  }

  private drawFooter(doc: jsPDF, order: RepairOrder): void {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(...BORDER);
      doc.line(MARGIN, 283, PAGE_WIDTH - MARGIN, 283);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(
        `Comprobante digital generado por Gestor Zentrofix — orden ${order.code}. No tiene validez como factura fiscal.`,
        MARGIN,
        288,
      );
      doc.text(`${i} / ${pageCount}`, PAGE_WIDTH - MARGIN, 288, { align: 'right' });
    }
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-AR');
}
