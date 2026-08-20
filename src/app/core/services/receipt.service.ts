import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { Payment, RepairOrder, REPAIR_STATUS_LABELS, Warranty } from '../../models';

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  /** Genera el comprobante digital de una orden. Nunca incluye costo interno ni observaciones internas. */
  generate(order: RepairOrder, payments: Payment[], warranty: Warranty | null): Blob {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const marginX = 18;
    let y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Zentrofix', marginX, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Gestión técnica — Comprobante digital', marginX, (y += 6));

    doc.setDrawColor(160);
    doc.line(marginX, (y += 4), 210 - marginX, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`Orden ${order.code}`, marginX, (y += 10));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-AR')}`, marginX, (y += 6));
    doc.text(`Estado: ${REPAIR_STATUS_LABELS[order.status]}`, marginX, (y += 6));

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente', marginX, (y += 6));
    doc.setFont('helvetica', 'normal');
    doc.text(order.customerName ?? '-', marginX, (y += 6));
    doc.text(order.customerPhone ?? '-', marginX, (y += 6));

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Equipo', marginX, (y += 6));
    doc.setFont('helvetica', 'normal');
    doc.text(order.deviceLabel ?? '-', marginX, (y += 6));

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Falla declarada', marginX, (y += 6));
    doc.setFont('helvetica', 'normal');
    const faultLines = doc.splitTextToSize(order.reportedFault, 210 - marginX * 2);
    doc.text(faultLines, marginX, (y += 6));
    y += faultLines.length * 5;

    if (order.technicalDiagnosis) {
      doc.setFont('helvetica', 'bold');
      doc.text('Diagnóstico', marginX, (y += 6));
      doc.setFont('helvetica', 'normal');
      const diagLines = doc.splitTextToSize(order.technicalDiagnosis, 210 - marginX * 2);
      doc.text(diagLines, marginX, (y += 6));
      y += diagLines.length * 5;
    }

    y += 4;
    doc.setDrawColor(200);
    doc.line(marginX, y, 210 - marginX, y);

    doc.setFont('helvetica', 'bold');
    doc.text('Detalle de costos', marginX, (y += 8));
    doc.setFont('helvetica', 'normal');
    doc.text(`Repuestos: ${formatCurrency(order.partsCost)}`, marginX, (y += 6));
    doc.text(`Mano de obra: ${formatCurrency(order.laborCost)}`, marginX, (y += 6));
    doc.text(`Descuento: ${formatCurrency(order.discount)}`, marginX, (y += 6));
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${formatCurrency(order.total)}`, marginX, (y += 7));
    doc.setFont('helvetica', 'normal');
    doc.text(`Pagado a cuenta: ${formatCurrency(order.deposit)}`, marginX, (y += 6));
    doc.setFont('helvetica', 'bold');
    doc.text(`Saldo pendiente: ${formatCurrency(order.balanceDue)}`, marginX, (y += 7));

    if (payments.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Pagos registrados', marginX, (y += 10));
      doc.setFont('helvetica', 'normal');
      for (const p of payments) {
        doc.text(
          `${new Date(p.createdAt).toLocaleDateString('es-AR')} — ${formatCurrency(p.amount)} (${p.method})`,
          marginX,
          (y += 6),
        );
      }
    }

    if (warranty) {
      y += 4;
      doc.setDrawColor(200);
      doc.line(marginX, y, 210 - marginX, y);
      doc.setFont('helvetica', 'bold');
      doc.text('Garantía', marginX, (y += 8));
      doc.setFont('helvetica', 'normal');
      const warrantyLines = doc.splitTextToSize(warranty.coverageDetails, 210 - marginX * 2);
      doc.text(warrantyLines, marginX, (y += 6));
      y += warrantyLines.length * 5;
      doc.text(
        `Vigente desde ${formatDate(warranty.startsAt)} hasta ${formatDate(warranty.expiresAt)}`,
        marginX,
        (y += 6),
      );
    }

    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      'Comprobante digital generado por Gestor Zentrofix. No tiene validez como factura fiscal.',
      marginX,
      285,
    );

    return doc.output('blob');
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-AR');
}
