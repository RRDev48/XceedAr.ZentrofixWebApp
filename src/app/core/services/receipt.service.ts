import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Payment, PAYMENT_METHOD_LABELS, RepairOrder, REPAIR_STATUS_LABELS, Warranty } from '../../models';

const BLUE: [number, number, number] = [30, 155, 255];
const BLACK: [number, number, number] = [8, 9, 12];
const TEXT: [number, number, number] = [30, 33, 40];
const MUTED: [number, number, number] = [120, 126, 138];
const BORDER: [number, number, number] = [225, 228, 233];

const MARGIN = 16;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  /** Genera el comprobante digital de una orden. Nunca incluye costo interno ni observaciones internas. */
  async generate(order: RepairOrder, payments: Payment[], warranty: Warranty | null): Promise<Blob> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logo = await this.loadLogoBase64();

    this.drawHeader(doc, order, logo);

    let y = 42;
    y = this.drawInfoSection(doc, order, y);
    y = this.drawTextBlock(doc, 'Falla declarada', order.reportedFault, y);
    if (order.technicalDiagnosis) {
      y = this.drawTextBlock(doc, 'Diagnóstico técnico', order.technicalDiagnosis, y);
    }

    y = this.drawCostTable(doc, order, y);

    if (payments.length > 0) {
      y = this.drawPaymentsTable(doc, payments, y);
    }

    if (warranty) {
      y = this.drawWarrantyBox(doc, warranty, y);
    }

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

  private drawHeader(doc: jsPDF, order: RepairOrder, logo: string | null): void {
    doc.setFillColor(...BLACK);
    doc.rect(0, 0, PAGE_WIDTH, 30, 'F');

    if (logo) {
      doc.addImage(logo, 'PNG', MARGIN, 7, 16, 16);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('ZENTROFIX', MARGIN + (logo ? 20 : 0), 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 205, 213);
    doc.text('Gestión técnica · Comprobante digital', MARGIN + (logo ? 20 : 0), 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BLUE);
    doc.text(order.code, PAGE_WIDTH - MARGIN, 15, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(200, 205, 213);
    doc.text(`Emitido el ${new Date().toLocaleDateString('es-AR')}`, PAGE_WIDTH - MARGIN, 21, { align: 'right' });
  }

  private drawInfoSection(doc: jsPDF, order: RepairOrder, startY: number): number {
    const colWidth = CONTENT_WIDTH / 2;
    let y = startY;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text('CLIENTE', MARGIN, y);
    doc.text('EQUIPO', MARGIN + colWidth, y);

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text(order.customerName ?? '-', MARGIN, y);
    doc.text(order.deviceLabel ?? '-', MARGIN + colWidth, y);

    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(order.customerPhone ?? '-', MARGIN, y);
    doc.text(`Estado: ${REPAIR_STATUS_LABELS[order.status]}`, MARGIN + colWidth, y);

    y += 5;
    doc.text(`Ingreso: ${new Date(order.receivedAt).toLocaleDateString('es-AR')}`, MARGIN, y);
    if (order.estimatedCompletionDate) {
      doc.text(`Estimada: ${new Date(order.estimatedCompletionDate).toLocaleDateString('es-AR')}`, MARGIN + colWidth, y);
    }

    y += 4;
    doc.setDrawColor(...BORDER);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

    return y + 8;
  }

  private drawTextBlock(doc: jsPDF, title: string, content: string, startY: number): number {
    let y = startY;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(title, MARGIN, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(content, CONTENT_WIDTH);
    doc.text(lines, MARGIN, y);

    return y + lines.length * 4.6 + 5;
  }

  private drawCostTable(doc: jsPDF, order: RepairOrder, startY: number): number {
    const rows: (string | { content: string; styles?: Record<string, unknown> })[][] = [
      ['Repuestos', formatCurrency(order.partsCost)],
      ['Mano de obra', formatCurrency(order.laborCost)],
      ['Descuento', `- ${formatCurrency(order.discount)}`],
      [{ content: 'Total', styles: { fontStyle: 'bold' } }, { content: formatCurrency(order.total), styles: { fontStyle: 'bold' } }],
      ['Pagado a cuenta', formatCurrency(order.deposit)],
      [
        { content: 'Saldo pendiente', styles: { fontStyle: 'bold' } },
        {
          content: formatCurrency(order.balanceDue),
          styles: { fontStyle: 'bold', textColor: order.balanceDue > 0 ? [214, 69, 69] : [22, 128, 62] },
        },
      ],
    ];

    autoTable(doc, {
      startY,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Detalle de costos', 'Importe']],
      body: rows as never,
      theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: { top: 2, bottom: 2, left: 0, right: 0 } },
      headStyles: { fillColor: BLACK, textColor: 255, fontStyle: 'bold', cellPadding: 2.5 },
      columnStyles: { 1: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.row.index === rows.length - 4 || data.row.index === rows.length - 1) {
          data.cell.styles.lineWidth = { top: 0.2, bottom: 0, left: 0, right: 0 };
          data.cell.styles.lineColor = BORDER;
        }
      },
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
