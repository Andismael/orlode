"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCompanyForInvoice = loadCompanyForInvoice;
exports.loadOrderForInvoice = loadOrderForInvoice;
exports.renderInvoicePdf = renderInvoicePdf;
/**
 * Invoice PDF generation using pdfkit.
 * Produces a clean, minimal invoice for shop orders.
 */
const pdfkit_1 = __importDefault(require("pdfkit"));
const firebase_config_1 = require("../../config/firebase.config");
function parseDate(v) {
    if (v instanceof Date && !isNaN(v.getTime()))
        return v;
    if (typeof v === 'object' && v != null && '_seconds' in v) {
        const d = new Date(v._seconds * 1000);
        if (!isNaN(d.getTime()))
            return d;
    }
    if (typeof v === 'object' && v != null && 'seconds' in v) {
        const d = new Date(v.seconds * 1000);
        if (!isNaN(d.getTime()))
            return d;
    }
    if (typeof v === 'string') {
        const d = new Date(v);
        if (!isNaN(d.getTime()))
            return d;
    }
    return new Date(); // Fallback to today (always valid)
}
async function loadCompanyForInvoice(companyId) {
    try {
        const doc = await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).get();
        const d = doc.data() ?? {};
        return {
            name: d['name'] || 'Entreprise',
            email: d['email'] || undefined,
            phone: d['phone'] || undefined,
            address: d['address'] || undefined,
            city: d['city'] || undefined,
            country: d['country'] || undefined,
            logoUrl: d['logoUrl'] || undefined,
            website: d['website'] || undefined,
            taxId: d['taxId'] || undefined,
            legalForm: d['legalForm'] || undefined,
        };
    }
    catch {
        return { name: 'Entreprise' };
    }
}
async function fetchLogoBuffer(url) {
    try {
        const res = await fetch(url);
        if (!res.ok)
            return null;
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
    }
    catch {
        return null;
    }
}
async function loadOrderForInvoice(companyId, orderId) {
    try {
        const doc = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/orders`).doc(orderId).get();
        if (!doc.exists)
            return null;
        const d = doc.data() ?? {};
        return {
            id: orderId,
            clientName: d['clientName'] ?? 'Client',
            clientEmail: d['clientEmail'] ?? '',
            clientPhone: d['clientPhone'] ?? '',
            items: d['items'] ?? [],
            subtotal: Number(d['subtotal'] ?? 0),
            currency: d['currency'] ?? 'XOF',
            status: d['status'] ?? 'pending_payment',
            paymentMethod: d['paymentMethod'] ?? null,
            paidAt: d['paidAt'] ?? null,
            createdAt: d['createdAt'] ?? null,
        };
    }
    catch {
        return null;
    }
}
/** Format a number with thousand separators: 62500 → "62 500" (FCFA convention) */
function fmtMoney(n) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
}
/** Render an invoice PDF into a Buffer. */
async function renderInvoicePdf(company, order) {
    const logoBuf = company.logoUrl ? await fetchLogoBuffer(company.logoUrl) : null;
    return new Promise((resolve, reject) => {
        try {
            // Single page constraint with proper margins. autoFirstPage:true + careful y management.
            const doc = new pdfkit_1.default({ size: 'A4', margin: 40, autoFirstPage: true });
            const chunks = [];
            doc.on('data', (c) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            const isPaid = order.status === 'paid' || order.status === 'fulfilled';
            const dateBase = isPaid ? parseDate(order.paidAt ?? order.createdAt) : parseDate(order.createdAt);
            const isQuote = order.docType === 'quote';
            const isCreditNote = order.docType === 'credit_note';
            const docLabel = isQuote ? 'DEVIS' : isCreditNote ? 'AVOIR' : (isPaid ? 'FACTURE' : 'FACTURE');
            // Compute totals — fall back gracefully if not provided
            const itemsTotalHT = order.items.reduce((s, it) => s + (it.unitPrice * it.quantity), 0);
            const totalHT = order.totalHT ?? (order.subtotal && !order.totalTTC ? order.subtotal : itemsTotalHT);
            const taxRate = order.taxRate ?? 0;
            const taxAmount = order.taxAmount ?? Math.round(totalHT * (taxRate / 100));
            const totalTTC = order.totalTTC ?? (order.subtotal ?? totalHT + taxAmount);
            // ── HEADER BAND — violet brand strip (full-width, 80pt tall, tighter than before)
            doc.rect(0, 0, 595, 80).fill('#7c3aed');
            if (logoBuf) {
                try {
                    doc.image(logoBuf, 40, 18, { width: 44, height: 44 });
                }
                catch { /* fallback */ }
            }
            else {
                doc.circle(62, 40, 22).fill('#ffffff');
                doc.fillColor('#7c3aed').fontSize(15).font('Helvetica-Bold');
                doc.text(company.name.slice(0, 2).toUpperCase(), 40, 33, { width: 44, align: 'center' });
            }
            // Company name & contact info (left)
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15);
            doc.text(company.name, 96, 18);
            doc.font('Helvetica').fontSize(7.5);
            let cy = 36;
            if (company.legalForm) {
                doc.text(company.legalForm, 96, cy);
                cy += 10;
            }
            const addr = [company.address, company.city, company.country].filter(Boolean).join(', ');
            if (addr) {
                doc.text(addr, 96, cy, { width: 280 });
                cy += 10;
            }
            const contact = [company.phone, company.email, company.website].filter(Boolean).join('  ·  ');
            if (contact)
                doc.text(contact, 96, cy, { width: 280 });
            // Right block — doc label / number / date
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica');
            doc.text(docLabel, 0, 18, { width: 555, align: 'right' });
            doc.font('Helvetica-Bold').fontSize(18);
            const docNumber = order.number?.trim() || `#${order.id.slice(0, 10)}`;
            doc.text(docNumber.startsWith('#') ? docNumber : `#${docNumber}`, 0, 30, { width: 555, align: 'right' });
            doc.font('Helvetica').fontSize(8);
            const dateLabel = dateBase.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            doc.text(`Date : ${dateLabel}`, 0, 54, { width: 555, align: 'right' });
            if (isQuote && order.validUntil) {
                doc.text(`Valide jusqu'au : ${order.validUntil}`, 0, 64, { width: 555, align: 'right' });
            }
            else if (!isQuote && (order.dueDate || order.paymentTermsDays)) {
                const due = order.dueDate ? parseDate(order.dueDate).toLocaleDateString('fr-FR') : `${order.paymentTermsDays} jours`;
                doc.text(`Échéance : ${due}`, 0, 64, { width: 555, align: 'right' });
            }
            doc.fillColor('#111827');
            // ── CLIENT block (compact)
            const clientBoxY = 100;
            doc.rect(40, clientBoxY, 515, 56).fill('#f5f3ff').stroke();
            doc.fillColor('#7c3aed').fontSize(8).font('Helvetica-Bold').text('FACTURÉ À', 52, clientBoxY + 8);
            doc.fillColor('#111827').fontSize(13).font('Helvetica-Bold').text(order.clientName || 'Client', 52, clientBoxY + 20);
            doc.fontSize(8.5).font('Helvetica').fillColor('#6b7280');
            const clientLine = [order.clientEmail, order.clientPhone].filter(Boolean).join('  ·  ');
            if (clientLine)
                doc.text(clientLine, 52, clientBoxY + 36);
            if (order.clientAddress)
                doc.text(order.clientAddress, 320, clientBoxY + 20, { width: 230 });
            // ── ITEMS TABLE
            const tableY = clientBoxY + 70;
            doc.rect(40, tableY, 515, 22).fill('#1f2937');
            doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
            doc.text('DESCRIPTION', 52, tableY + 7, { width: 270 });
            doc.text('QTÉ', 320, tableY + 7, { width: 40, align: 'right' });
            doc.text('PRIX UNIT.', 364, tableY + 7, { width: 90, align: 'right' });
            doc.text('TOTAL', 460, tableY + 7, { width: 90, align: 'right' });
            let rowY = tableY + 22;
            doc.font('Helvetica').fontSize(9.5);
            let zebra = 0;
            for (const item of order.items) {
                const total = item.unitPrice * item.quantity;
                if (zebra % 2 === 1)
                    doc.rect(40, rowY, 515, 20).fill('#f9fafb');
                doc.fillColor('#111827').text(item.name, 52, rowY + 6, { width: 270 });
                doc.text(String(item.quantity), 320, rowY + 6, { width: 40, align: 'right' });
                doc.text(`${fmtMoney(item.unitPrice)} ${order.currency}`, 364, rowY + 6, { width: 90, align: 'right' });
                doc.text(`${fmtMoney(total)} ${order.currency}`, 460, rowY + 6, { width: 90, align: 'right' });
                rowY += 20;
                zebra++;
            }
            // ── TOTALS BOX (right-aligned, structured)
            let totY = rowY + 12;
            const labelX = 320, valueX = 460, totalsW = 90;
            doc.font('Helvetica').fontSize(9.5).fillColor('#374151');
            doc.text('Sous-total HT', labelX, totY, { width: 130, align: 'right' });
            doc.text(`${fmtMoney(totalHT)} ${order.currency}`, valueX, totY, { width: totalsW, align: 'right' });
            totY += 16;
            if (taxRate > 0) {
                doc.text(`TVA (${taxRate}%)`, labelX, totY, { width: 130, align: 'right' });
                doc.text(`${fmtMoney(taxAmount)} ${order.currency}`, valueX, totY, { width: totalsW, align: 'right' });
                totY += 16;
            }
            // Total TTC line — bold, purple
            doc.moveTo(320, totY + 2).lineTo(550, totY + 2).strokeColor('#7c3aed').lineWidth(1).stroke();
            totY += 8;
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#374151');
            doc.text('TOTAL TTC', labelX, totY, { width: 130, align: 'right' });
            doc.fontSize(15).fillColor('#7c3aed');
            doc.text(`${fmtMoney(totalTTC)} ${order.currency}`, valueX - 30, totY - 3, { width: totalsW + 30, align: 'right' });
            totY += 24;
            // ── PAYMENT INFO (only for invoices, not quotes)
            if (!isQuote && (company.iban || company.mobileMoney || company.bankName)) {
                doc.rect(40, totY, 250, 60).fill('#f9fafb').stroke();
                doc.fillColor('#7c3aed').fontSize(7.5).font('Helvetica-Bold').text('COORDONNÉES BANCAIRES', 52, totY + 8);
                doc.fillColor('#111827').fontSize(8.5).font('Helvetica');
                let payY = totY + 22;
                if (company.bankName) {
                    doc.text(`Banque : ${company.bankName}`, 52, payY, { width: 230 });
                    payY += 11;
                }
                if (company.iban) {
                    doc.text(`IBAN : ${company.iban}`, 52, payY, { width: 230 });
                    payY += 11;
                }
                if (company.swift) {
                    doc.text(`SWIFT/BIC : ${company.swift}`, 52, payY, { width: 230 });
                    payY += 11;
                }
                if (company.mobileMoney) {
                    doc.text(`Mobile Money : ${company.mobileMoney}`, 52, payY, { width: 230 });
                }
            }
            // ── Notes / Status
            const noteY = Math.max(totY + (!isQuote ? 70 : 10), 720);
            const statusNote = isQuote
                ? `Devis valable jusqu'au ${order.validUntil ?? 'date à confirmer'}. Bon pour accord requis avant exécution.`
                : isCreditNote
                    ? 'Avoir émis en compensation — à déduire de votre prochain règlement.'
                    : isPaid
                        ? 'Merci pour votre paiement. Cette facture tient lieu de reçu officiel.'
                        : `Règlement attendu sous ${order.paymentTermsDays ?? 30} jours à réception de cette facture.`;
            doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#6b7280');
            doc.text(statusNote, 40, Math.min(noteY, 740), { width: 515, align: 'center', lineBreak: true });
            if (order.notes && order.notes.trim()) {
                doc.fontSize(8).font('Helvetica').fillColor('#374151');
                doc.text(order.notes, 40, Math.min(noteY + 18, 758), { width: 515, align: 'center', lineBreak: true });
            }
            // ── FOOTER (fixed bottom — no extra pages)
            const footerY = 800;
            doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
            doc.fontSize(6.5).font('Helvetica').fillColor('#9ca3af');
            const legal = [company.name, company.address, company.taxId ? `N° fiscal : ${company.taxId}` : null].filter(Boolean).join(' · ');
            doc.text(legal, 40, footerY + 6, { width: 400, lineBreak: false, ellipsis: true });
            doc.fontSize(6.5).fillColor('#cbd5e1').text('orlode.com', 40, footerY + 6, { width: 515, align: 'right', lineBreak: false });
            // No more pages — explicit end without addPage
            doc.end();
        }
        catch (err) {
            reject(err);
        }
    });
}
//# sourceMappingURL=invoicePdfService.js.map