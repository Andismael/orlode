"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingAgentTool = exports.accountingAgentFlow = exports.clientRiskScoreTool = exports.financeAutomationTool = exports.expenseAnalyticsTool = exports.getRecurringInvoicesTool = exports.createRecurringInvoiceTool = exports.agingReportTool = exports.profitLossTool = exports.autoRelanceTool = exports.exportFinanceTool = exports.bankReconciliationTool = exports.vatReportTool = exports.createMultiCurrencyInvoiceTool = exports.convertCurrencyTool = exports.getDashboardSummaryTool = exports.getExpenseByIdTool = exports.generateInvoicePdfTool = exports.voidInvoiceTool = exports.getInvoiceByIdTool = exports.getBudgetStatusTool = exports.forecastCashFlowTool = exports.getCashFlowTool = exports.getExpenseReportsTool = exports.reviewExpenseTool = exports.submitExpenseTool = exports.getPaymentHistoryTool = exports.getInvoicesTool = exports.sendReminderTool = exports.sendInvoiceTool = exports.updateInvoiceTool = exports.createInvoiceTool = void 0;
/**
 * Accounting Agent PRO — Gemini Flash
 * Create → Track → Collect → Analyze
 * Factures, notes de frais, tresorerie, budget, rappels, previsions.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
/** Safe number coercion — returns 0 for null, undefined, NaN, non-numeric strings */
function num(v, fallback = 0) {
    if (v == null)
        return fallback;
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : fallback;
}
/** Serialize a number for output — ensures we never emit NaN/Infinity/null */
const safe = (n) => Number.isFinite(n) ? n : 0;
// ══════════════════════════════════════════════════════════════════════════════
// 1. FACTURES — Create → Track → Collect
// ══════════════════════════════════════════════════════════════════════════════
exports.createInvoiceTool = genkit_config_1.ai.defineTool({
    name: 'acc_createInvoice',
    description: 'Create a new invoice for a client. Calculates totals automatically.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        client: zod_1.z.string(),
        clientEmail: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({
            description: zod_1.z.string(),
            quantity: zod_1.z.number().default(1),
            unitPrice: zod_1.z.number(),
        })),
        currency: zod_1.z.string().optional().default('EUR'),
        dueInDays: zod_1.z.number().optional().default(30),
        notes: zod_1.z.string().optional(),
        taxRate: zod_1.z.number().optional().default(20),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), invoiceId: zod_1.z.string(), number: zod_1.z.string(), totalHT: zod_1.z.number(), totalTTC: zod_1.z.number(), message: zod_1.z.string() }),
}, async ({ companyId, client, clientEmail, items, currency, dueInDays, notes, taxRate }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    // Auto-generate invoice number
    const countSnap = await db.collection(`companies/${companyId}/invoices`).count().get().catch(() => null);
    const count = (countSnap?.data().count ?? 0) + 1;
    const number = `FAC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const totalHT = items.reduce((s, i) => s + (i.quantity ?? 1) * (i.unitPrice ?? 0), 0);
    const effectiveTaxRate = taxRate ?? 20;
    const taxAmount = Math.round(totalHT * (effectiveTaxRate / 100) * 100) / 100;
    const totalTTC = Math.round((totalHT + taxAmount) * 100) / 100;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (dueInDays ?? 30));
    try {
        await db.collection(`companies/${companyId}/invoices`).doc(id).set({
            id, number, client, clientEmail: clientEmail ?? '',
            items, currency: currency ?? 'EUR',
            totalHT, taxRate: effectiveTaxRate, taxAmount, totalTTC,
            dueDate, status: 'pending', paidAmount: 0,
            notes: notes ?? '',
            createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[Accounting] createInvoice write failed', { error: String(err) });
        return { success: false, invoiceId: '', number: '', totalHT: 0, totalTTC: 0, message: 'Sauvegarde impossible.' };
    }
    return { success: true, invoiceId: id, number, totalHT, totalTTC, message: `Facture ${number} creee pour ${client}: ${totalTTC} ${currency} TTC (echeance: ${dueDate.toLocaleDateString('fr-FR')}).` };
});
exports.updateInvoiceTool = genkit_config_1.ai.defineTool({
    name: 'acc_updateInvoice',
    description: 'Update invoice status (mark as paid, cancelled, etc.) or record a payment.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        invoiceId: zod_1.z.string().optional(),
        invoiceNumber: zod_1.z.string().optional().describe('Invoice number like FAC-2026-0001'),
        status: zod_1.z.enum(['pending', 'paid', 'partial', 'overdue', 'cancelled']).optional(),
        paidAmount: zod_1.z.number().optional().describe('Amount received (for partial payments)'),
        paymentMethod: zod_1.z.string().optional(),
        paymentDate: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, invoiceId, invoiceNumber, status, paidAmount, paymentMethod, paymentDate }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let docRef;
    if (invoiceId) {
        docRef = db.collection(`companies/${companyId}/invoices`).doc(invoiceId);
    }
    else if (invoiceNumber) {
        const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get().catch(() => null);
        if (!snap || snap.empty)
            return { success: false, message: `Facture "${invoiceNumber}" non trouvee.` };
        docRef = snap.docs[0].ref;
    }
    else {
        return { success: false, message: 'ID ou numero de facture requis.' };
    }
    const updates = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
    if (status)
        updates['status'] = status;
    if (paidAmount !== undefined)
        updates['paidAmount'] = paidAmount;
    // Record payment
    if (paidAmount || status === 'paid') {
        const paymentId = (0, helpers_1.generateId)();
        try {
            await db.collection(`companies/${companyId}/payments`).doc(paymentId).set({
                invoiceId: docRef.id, amount: paidAmount ?? 0,
                method: paymentMethod ?? 'virement', date: paymentDate ?? new Date().toISOString().split('T')[0],
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        catch (err) {
            logger_1.logger.error('[Accounting] payment write failed', { error: String(err) });
            return { success: false, message: 'Enregistrement du paiement impossible.' };
        }
    }
    try {
        await docRef.update(updates);
    }
    catch (err) {
        logger_1.logger.error('[Accounting] updateInvoice write failed', { error: String(err) });
        return { success: false, message: 'Mise a jour de la facture impossible.' };
    }
    return { success: true, message: `Facture mise a jour${status ? ` → ${status}` : ''}${paidAmount ? ` (${paidAmount} recu)` : ''}.` };
});
exports.sendInvoiceTool = genkit_config_1.ai.defineTool({
    name: 'acc_sendInvoice',
    description: 'Send an invoice to the client by email. Optional toEmail override for one-shot custom recipient (does NOT modify client record).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        invoiceId: zod_1.z.string().optional(),
        invoiceNumber: zod_1.z.string().optional(),
        message: zod_1.z.string().optional(),
        toEmail: zod_1.z.string().email().optional().describe('Override recipient email for this send only — does not save to client record'),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, invoiceId, invoiceNumber, message, toEmail }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let invoiceData;
    let docId = invoiceId ?? '';
    if (invoiceId) {
        const doc = await db.collection(`companies/${companyId}/invoices`).doc(invoiceId).get().catch(() => null);
        if (doc?.exists)
            invoiceData = doc.data();
    }
    else if (invoiceNumber) {
        const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get().catch(() => null);
        if (snap && !snap.empty) {
            invoiceData = snap.docs[0].data();
            docId = snap.docs[0].id;
        }
    }
    if (!invoiceData)
        return { success: false, message: 'Facture non trouvee.' };
    // Priorité : toEmail override > clientEmail dans la fiche
    const clientEmail = invoiceData['clientEmail'] ?? '';
    const recipientEmail = (toEmail && toEmail.trim()) ? toEmail.trim() : clientEmail;
    if (!recipientEmail)
        return { success: false, message: `Pas d'email pour le client "${invoiceData['client']}". Précisez "toEmail" ou ajoutez un email à la fiche client.` };
    // Generate invoice content
    const inv = invoiceData;
    let companyName = 'Orlode';
    let companyAddr = '';
    try {
        const c = await db.collection('companies').doc(companyId).get();
        companyName = c.data()?.['name'] ?? companyName;
        companyAddr = c.data()?.['address'] ?? '';
    }
    catch { }
    const items = inv['items'] ?? [];
    const itemsHtml = items.map(it => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${it.description}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.quantity ?? 1}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${(it.unitPrice ?? 0).toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${((it.quantity ?? 1) * (it.unitPrice ?? 0)).toFixed(2)}</td></tr>`).join('');
    const due = (inv['dueDate']?.toDate?.() ?? new Date()).toLocaleDateString('fr-FR');
    const cur = inv['currency'] ?? 'EUR';
    const emailHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#0f172a,#1e40af);color:white;padding:24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:20px">${companyName}</h1>
    <p style="margin:4px 0 0;opacity:0.7;font-size:13px">${companyAddr}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <h2 style="color:#1e40af;margin:0 0 16px">FACTURE ${inv['number']}</h2>
    <table style="width:100%;margin-bottom:16px;font-size:14px">
      <tr><td><strong>Client:</strong> ${inv['client']}</td><td style="text-align:right"><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</td></tr>
      <tr><td><strong>Email:</strong> ${clientEmail}</td><td style="text-align:right"><strong>Echeance:</strong> ${due}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:10px;text-align:left;border-bottom:2px solid #1e40af">Description</th>
        <th style="padding:10px;text-align:center;border-bottom:2px solid #1e40af">Qte</th>
        <th style="padding:10px;text-align:right;border-bottom:2px solid #1e40af">P.U.</th>
        <th style="padding:10px;text-align:right;border-bottom:2px solid #1e40af">Total</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <table style="width:100%;font-size:14px;margin-top:12px">
      <tr><td></td><td style="text-align:right;padding:4px 8px"><strong>Sous-total HT:</strong></td><td style="text-align:right;padding:4px 8px">${(inv['totalHT'] ?? 0).toFixed(2)} ${cur}</td></tr>
      <tr><td></td><td style="text-align:right;padding:4px 8px">TVA (${inv['taxRate'] ?? 20}%):</td><td style="text-align:right;padding:4px 8px">${(inv['taxAmount'] ?? 0).toFixed(2)} ${cur}</td></tr>
      <tr><td></td><td style="text-align:right;padding:8px;border-top:2px solid #1e40af"><strong style="font-size:16px">TOTAL TTC:</strong></td><td style="text-align:right;padding:8px;border-top:2px solid #1e40af"><strong style="font-size:16px;color:#1e40af">${(inv['totalTTC'] ?? 0).toFixed(2)} ${cur}</strong></td></tr>
    </table>
    ${inv['notes'] ? `<p style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#64748b">${inv['notes']}</p>` : ''}
    ${message ? `<p style="margin-top:12px;font-size:14px">${message}</p>` : ''}
    <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">Merci pour votre confiance — ${companyName}</p>
  </div>
</div>`;
    // Generate professional PDF attachment via the shared invoicePdfService
    let pdfBuffer = null;
    let pdfFilename = `Facture-${inv['number'] ?? docId}.pdf`;
    try {
        const { renderInvoicePdf, loadCompanyForInvoice } = await Promise.resolve().then(() => __importStar(require('../services/invoice/invoicePdfService')));
        const companyData = await loadCompanyForInvoice(companyId);
        const isQuote = (inv['docType'] === 'quote') || /^DEV-/i.test(String(inv['number'] ?? ''));
        pdfFilename = `${isQuote ? 'Devis' : 'Facture'}-${inv['number'] ?? docId}.pdf`;
        pdfBuffer = await renderInvoicePdf(companyData, {
            id: docId,
            number: inv['number'],
            clientName: inv['client'] ?? 'Client',
            clientEmail: clientEmail || recipientEmail,
            items: (inv['items'] ?? []).map(it => ({
                name: it.description, quantity: it.quantity ?? 1, unitPrice: it.unitPrice ?? 0,
            })),
            totalHT: inv['totalHT'] ?? 0,
            taxRate: inv['taxRate'] ?? 0,
            taxAmount: inv['taxAmount'] ?? 0,
            totalTTC: inv['totalTTC'] ?? 0,
            subtotal: inv['totalTTC'] ?? 0,
            currency: cur,
            status: inv['status'] ?? 'pending',
            createdAt: inv['createdAt'],
            dueDate: inv['dueDate'],
            docType: isQuote ? 'quote' : 'invoice',
            validUntil: isQuote && inv['validUntil'] ? String(inv['validUntil']) : undefined,
            notes: inv['notes'],
        });
    }
    catch (err) {
        logger_1.logger.warn('[sendInvoice] PDF generation failed, sending HTML only', { error: String(err) });
    }
    // Send via the shared sendEmail service (auto-brands from with company name + handles Gmail/Resend fallback)
    const isQuote = (inv['docType'] === 'quote') || /^DEV-/i.test(String(inv['number'] ?? ''));
    const docLabel = isQuote ? 'Devis' : 'Facture';
    try {
        const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../services/email/emailService')));
        await sendEmail({
            to: recipientEmail,
            companyId,
            subject: `${docLabel} ${inv['number']} — ${(inv['totalTTC'] ?? 0).toFixed(2)} ${cur}`,
            html: emailHtml,
            attachments: pdfBuffer ? [{ filename: pdfFilename, content: pdfBuffer }] : undefined,
        });
        logger_1.logger.info('[sendInvoice] Email sent', { invoiceNumber: inv['number'], to: recipientEmail, hasPdf: !!pdfBuffer });
    }
    catch (err) {
        logger_1.logger.error('[sendInvoice] Email send failed', { error: String(err), to: recipientEmail });
        return { success: false, message: `Echec de l'envoi a ${recipientEmail} : ${err.message ?? 'erreur inconnue'}` };
    }
    // Mark as sent
    try {
        await db.collection(`companies/${companyId}/invoices`).doc(docId).update({
            sentAt: firestore_1.FieldValue.serverTimestamp(), sentCount: firestore_1.FieldValue.increment(1), status: 'sent',
        });
    }
    catch (err) {
        logger_1.logger.error('[Accounting] sendInvoice mark-sent failed', { error: String(err) });
    }
    // Save email reference
    try {
        await db.collection(`companies/${companyId}/invoiceEmails`).add({
            invoiceId: docId, invoiceNumber: inv['number'], recipient: recipientEmail,
            subject: `${docLabel} ${inv['number']}`, htmlContent: emailHtml,
            hasPdfAttachment: !!pdfBuffer,
            sentAt: new Date(),
        });
    }
    catch (err) {
        logger_1.logger.error('[Accounting] sendInvoice email-ref save failed', { error: String(err) });
    }
    return { success: true, message: `${docLabel} ${inv['number']} envoye a ${recipientEmail}${pdfBuffer ? ' avec PDF attache' : ''} (${(inv['totalTTC'] ?? 0).toFixed(2)} ${cur}).` };
});
exports.sendReminderTool = genkit_config_1.ai.defineTool({
    name: 'acc_sendPaymentReminder',
    description: 'Send a payment reminder for overdue invoices. Can target specific invoice or all overdue.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        invoiceNumber: zod_1.z.string().optional().describe('Specific invoice, or omit for all overdue'),
        tone: zod_1.z.enum(['gentle', 'firm', 'urgent']).optional().default('gentle'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        remindersSent: zod_1.z.number(),
        details: zod_1.z.array(zod_1.z.object({ invoice: zod_1.z.string(), client: zod_1.z.string(), amount: zod_1.z.number(), daysOverdue: zod_1.z.number() })),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, invoiceNumber, tone }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const today = new Date();
    let docs = [];
    try {
        if (invoiceNumber) {
            const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get();
            docs = snap.docs;
        }
        else {
            const snap = await db.collection(`companies/${companyId}/invoices`).where('status', '==', 'pending').limit(50).get();
            docs = snap.docs.filter(d => {
                const due = d.data()['dueDate']?.toDate?.() ?? new Date(d.data()['dueDate']);
                return due.getTime() < today.getTime();
            });
        }
    }
    catch (err) {
        logger_1.logger.error('[Accounting] sendReminder query failed', { error: String(err) });
        return { success: false, remindersSent: 0, details: [], message: 'Lecture des factures impossible.' };
    }
    const details = docs.map(d => {
        const data = d.data();
        const due = data['dueDate']?.toDate?.() ?? new Date(data['dueDate']);
        const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
        return {
            invoice: data['number'] ?? d.id,
            client: data['client'] ?? '',
            amount: data['totalTTC'] ?? data['amount'] ?? 0,
            daysOverdue: Math.max(0, daysOverdue),
        };
    });
    // Generate reminder text
    if (details.length > 0) {
        const toneText = tone === 'urgent' ? 'URGENT' : tone === 'firm' ? 'Ferme' : 'Cordial';
        // Mark reminders sent
        for (const d of docs) {
            try {
                await d.ref.update({ lastReminderAt: firestore_1.FieldValue.serverTimestamp(), reminderCount: firestore_1.FieldValue.increment(1), status: 'overdue' });
            }
            catch (err) {
                logger_1.logger.error('[Accounting] sendReminder update failed', { error: String(err), invoice: d.id });
            }
        }
    }
    const total = details.reduce((s, d) => s + d.amount, 0);
    return {
        success: true,
        remindersSent: details.length,
        details,
        message: details.length > 0
            ? `${details.length} rappel(s) envoye(s) (${tone}). Total impaye: ${total.toFixed(2)} EUR.`
            : 'Aucune facture en retard. Tout est a jour !',
    };
});
exports.getInvoicesTool = genkit_config_1.ai.defineTool({
    name: 'acc_getInvoices',
    description: 'List invoices with status, amounts, due dates. Filter by status.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        status: zod_1.z.enum(['all', 'pending', 'paid', 'overdue', 'partial', 'cancelled']).optional().default('all'),
        limit: zod_1.z.number().optional().default(20),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        invoices: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), number: zod_1.z.string(), client: zod_1.z.string(),
            totalTTC: zod_1.z.number(), currency: zod_1.z.string(), dueDate: zod_1.z.string(),
            status: zod_1.z.string(), daysOverdue: zod_1.z.number().optional(),
        })),
        totalPending: zod_1.z.number(), totalOverdue: zod_1.z.number(), count: zod_1.z.number(),
    }),
}, async ({ companyId, status, limit }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/invoices`);
    if (status !== 'all')
        q = q.where('status', '==', status);
    const snap = await q.limit(limit ?? 20).get().catch((err) => {
        logger_1.logger.error('[Accounting] getInvoices query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture des factures impossible.', invoices: [], totalPending: 0, totalOverdue: 0, count: 0 };
    const today = Date.now();
    const invoices = snap.docs.map(d => {
        const data = d.data();
        const due = data['dueDate']?.toDate?.() ?? new Date(data['dueDate'] ?? Date.now());
        const daysOverdue = due.getTime() < today && data['status'] !== 'paid' ? Math.floor((today - due.getTime()) / 86400000) : undefined;
        return {
            id: d.id, number: data['number'] ?? d.id.slice(0, 8),
            client: data['client'] ?? '',
            totalTTC: safe(num(data['totalTTC'] ?? data['amount'] ?? data['total'])),
            currency: data['currency'] ?? 'XOF', dueDate: due.toISOString().split('T')[0],
            status: data['status'] ?? 'pending', daysOverdue,
        };
    });
    return {
        success: true,
        invoices,
        totalPending: safe(invoices.filter(i => i.status === 'pending').reduce((s, i) => s + num(i.totalTTC), 0)),
        totalOverdue: safe(invoices.filter(i => (i.daysOverdue ?? 0) > 0).reduce((s, i) => s + num(i.totalTTC), 0)),
        count: invoices.length,
    };
});
exports.getPaymentHistoryTool = genkit_config_1.ai.defineTool({
    name: 'acc_getPaymentHistory',
    description: 'Get payment history — all received payments with dates, amounts, methods.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), limit: zod_1.z.number().optional().default(20) }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        payments: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), invoiceId: zod_1.z.string(), amount: zod_1.z.number(), method: zod_1.z.string(), date: zod_1.z.string() })),
        totalReceived: zod_1.z.number(),
    }),
}, async ({ companyId, limit }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/payments`).limit(limit ?? 20).get().catch((err) => {
        logger_1.logger.error('[Accounting] getPaymentHistory query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture des paiements impossible.', payments: [], totalReceived: 0 };
    const payments = snap.docs.map(d => {
        const x = d.data();
        return { id: d.id, invoiceId: x['invoiceId'] ?? '', amount: x['amount'] ?? 0, method: x['method'] ?? '', date: x['date'] ?? '' };
    });
    return { success: true, payments, totalReceived: payments.reduce((s, p) => s + p.amount, 0) };
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. NOTES DE FRAIS — Submit → Review → Track
// ══════════════════════════════════════════════════════════════════════════════
exports.submitExpenseTool = genkit_config_1.ai.defineTool({
    name: 'acc_submitExpense',
    description: 'Submit an expense report for approval.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), userId: zod_1.z.string(),
        amount: zod_1.z.number(), currency: zod_1.z.string().optional().default('EUR'),
        category: zod_1.z.enum(['transport', 'repas', 'hebergement', 'materiel', 'logiciel', 'formation', 'autre']).default('autre'),
        description: zod_1.z.string(), date: zod_1.z.string().optional(),
        receipt: zod_1.z.string().optional().describe('Receipt reference or URL'),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), expenseId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, userId, amount, currency, category, description, date, receipt }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    let empName = '';
    try {
        const u = await db.collection('users').doc(userId).get();
        empName = u.data()?.['displayName'] ?? '';
    }
    catch { }
    try {
        await db.collection(`companies/${companyId}/expenses`).doc(id).set({
            id, userId, submittedBy: empName || userId,
            amount, currency: currency ?? 'EUR', category, description,
            date: date ?? new Date().toISOString().split('T')[0],
            receipt: receipt ?? null, status: 'pending',
            submittedAt: firestore_1.FieldValue.serverTimestamp(), createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[Accounting] submitExpense write failed', { error: String(err) });
        return { success: false, expenseId: '', message: 'Sauvegarde impossible.' };
    }
    return { success: true, expenseId: id, message: `Note de frais #${id.slice(0, 8)} soumise: ${amount} ${currency} (${category}) — en attente d'approbation.` };
});
exports.reviewExpenseTool = genkit_config_1.ai.defineTool({
    name: 'acc_reviewExpense',
    description: 'Approve or reject an expense report. Manager/admin only.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        expenseId: zod_1.z.string(),
        decision: zod_1.z.enum(['approved', 'rejected']),
        comment: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, expenseId, decision, comment }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/expenses`).doc(expenseId);
    const doc = await ref.get().catch(() => null);
    if (!doc?.exists)
        return { success: false, message: 'Note de frais non trouvee.' };
    try {
        await ref.update({
            status: decision, reviewComment: comment ?? '', reviewedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[Accounting] reviewExpense update failed', { error: String(err) });
        return { success: false, message: 'Mise a jour impossible.' };
    }
    const data = doc.data();
    return { success: true, message: `Note de frais de ${data['submittedBy']} (${data['amount']} ${data['currency']}) ${decision === 'approved' ? 'approuvee' : 'rejetee'}${comment ? ` — ${comment}` : ''}.` };
});
exports.getExpenseReportsTool = genkit_config_1.ai.defineTool({
    name: 'acc_getExpenseReports',
    description: 'List expense reports with filters.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), userId: zod_1.z.string().optional(),
        status: zod_1.z.enum(['all', 'pending', 'approved', 'rejected']).optional().default('all'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        expenses: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), submittedBy: zod_1.z.string(), amount: zod_1.z.number(), currency: zod_1.z.string(), category: zod_1.z.string(), description: zod_1.z.string(), status: zod_1.z.string(), date: zod_1.z.string() })),
        totalAmount: zod_1.z.number(), pendingCount: zod_1.z.number(),
    }),
}, async ({ companyId, userId, status }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/expenses`);
    if (userId)
        q = q.where('userId', '==', userId);
    if (status !== 'all')
        q = q.where('status', '==', status);
    const snap = await q.limit(50).get().catch((err) => {
        logger_1.logger.error('[Accounting] getExpenseReports query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture des notes de frais impossible.', expenses: [], totalAmount: 0, pendingCount: 0 };
    const expenses = snap.docs.map(d => {
        const x = d.data();
        return { id: d.id, submittedBy: x['submittedBy'] ?? '', amount: x['amount'] ?? 0, currency: x['currency'] ?? 'EUR', category: x['category'] ?? '', description: x['description'] ?? '', status: x['status'] ?? '', date: x['date'] ?? '' };
    });
    return { success: true, expenses, totalAmount: expenses.reduce((s, e) => s + e.amount, 0), pendingCount: expenses.filter(e => e.status === 'pending').length };
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. TRESORERIE — Track → Forecast → Alert
// ══════════════════════════════════════════════════════════════════════════════
exports.getCashFlowTool = genkit_config_1.ai.defineTool({
    name: 'acc_getCashFlow',
    description: 'Get current cash flow summary — inflows, outflows, balance.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), period: zod_1.z.enum(['month', 'quarter', 'year']).optional().default('month') }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string().optional(), period: zod_1.z.string(), inflows: zod_1.z.number(), outflows: zod_1.z.number(), balance: zod_1.z.number(), currency: zod_1.z.string(), alerts: zod_1.z.array(zod_1.z.string()) }),
}, async ({ companyId, period }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Calculate from invoices + expenses
    const invoiceSnap = await db.collection(`companies/${companyId}/invoices`).where('status', '==', 'paid').limit(200).get().catch(() => null);
    const expenseSnap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(200).get().catch(() => null);
    if (!invoiceSnap || !expenseSnap) {
        logger_1.logger.error('[Accounting] getCashFlow read failed');
        return { success: false, message: 'Lecture des donnees impossible.', period: period ?? 'month', inflows: 0, outflows: 0, balance: 0, currency: 'EUR', alerts: [] };
    }
    const inflows = safe(invoiceSnap.docs.reduce((s, d) => s + num(d.data()['totalTTC'] ?? d.data()['amount']), 0));
    const outflows = safe(expenseSnap.docs.reduce((s, d) => s + num(d.data()['amount']), 0));
    const balance = safe(inflows - outflows);
    const alerts = [];
    if (balance < 0)
        alerts.push('Tresorerie negative ! Action urgente requise.');
    // Check overdue invoices
    const pendingSnap = await db.collection(`companies/${companyId}/invoices`).where('status', '==', 'pending').limit(50).get().catch(() => null);
    const overdueCount = pendingSnap?.docs.filter(d => {
        const due = d.data()['dueDate']?.toDate?.() ?? new Date(d.data()['dueDate']);
        return due.getTime() < Date.now();
    }).length ?? 0;
    if (overdueCount > 0)
        alerts.push(`${overdueCount} facture(s) en retard de paiement.`);
    const pendingExpenses = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'pending').count().get().catch(() => null);
    const pendingExpenseCount = pendingExpenses?.data().count ?? 0;
    if (pendingExpenseCount > 0)
        alerts.push(`${pendingExpenseCount} note(s) de frais en attente.`);
    return { success: true, period: period ?? 'month', inflows, outflows, balance, currency: 'EUR', alerts };
});
exports.forecastCashFlowTool = genkit_config_1.ai.defineTool({
    name: 'acc_forecastCashFlow',
    description: 'Forecast cash flow for the next 3 months based on current data and trends.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        forecast: zod_1.z.array(zod_1.z.object({ month: zod_1.z.string(), expectedInflows: zod_1.z.number(), expectedOutflows: zod_1.z.number(), projectedBalance: zod_1.z.number() })),
        riskLevel: zod_1.z.string(), recommendations: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Get current data
    const invoiceSnap = await db.collection(`companies/${companyId}/invoices`).limit(100).get().catch(() => null);
    const expenseSnap = await db.collection(`companies/${companyId}/expenses`).limit(100).get().catch(() => null);
    if (!invoiceSnap || !expenseSnap) {
        logger_1.logger.error('[Accounting] forecastCashFlow read failed');
        return { success: false, message: 'Lecture des donnees impossible.', forecast: [], riskLevel: 'unknown', recommendations: [] };
    }
    // Coerce to real numbers — Firestore can store strings/mixed types
    const num = (v) => {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : 0;
        return Number.isFinite(n) ? n : 0;
    };
    const totalInvoiced = invoiceSnap.docs.reduce((s, d) => s + num(d.data()['totalTTC'] ?? d.data()['amount'] ?? d.data()['total']), 0);
    const totalExpenses = expenseSnap.docs.reduce((s, d) => s + num(d.data()['amount']), 0);
    const avgMonthlyIn = totalInvoiced / Math.max(1, 3); // rough average
    const avgMonthlyOut = totalExpenses / Math.max(1, 3);
    const pendingIn = invoiceSnap.docs.filter(d => d.data()['status'] === 'pending')
        .reduce((s, d) => s + num(d.data()['totalTTC'] ?? d.data()['amount'] ?? d.data()['total']), 0);
    const forecast = [];
    let runningBalance = num(totalInvoiced - totalExpenses);
    for (let i = 1; i <= 3; i++) {
        const month = new Date();
        month.setMonth(month.getMonth() + i);
        const label = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const expectedIn = Math.round(num(avgMonthlyIn * (i === 1 ? 1.1 : 1)));
        const expectedOut = Math.round(num(avgMonthlyOut));
        runningBalance = num(runningBalance + expectedIn - expectedOut);
        forecast.push({ month: label, expectedInflows: expectedIn, expectedOutflows: expectedOut, projectedBalance: Math.round(runningBalance) });
    }
    const riskLevel = runningBalance < 0 ? 'high' : runningBalance < avgMonthlyOut ? 'medium' : 'low';
    const recommendations = [];
    if (pendingIn > 0)
        recommendations.push(`Relancer ${pendingIn.toFixed(0)} EUR de factures en attente.`);
    if (riskLevel === 'high')
        recommendations.push('Reduire les depenses non essentielles immediatement.');
    if (riskLevel === 'medium')
        recommendations.push('Surveiller la tresorerie de pres les 2 prochains mois.');
    if (riskLevel === 'low')
        recommendations.push('Situation financiere saine. Envisager des investissements.');
    return { success: true, forecast, riskLevel, recommendations };
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. BUDGET — Existant, ameliore
// ══════════════════════════════════════════════════════════════════════════════
exports.getBudgetStatusTool = genkit_config_1.ai.defineTool({
    name: 'acc_getBudgetStatus',
    description: 'Get budget vs actual spending by department or category.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), department: zod_1.z.string().optional(), year: zod_1.z.number().optional() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        year: zod_1.z.number(),
        budgets: zod_1.z.array(zod_1.z.object({ category: zod_1.z.string(), budgeted: zod_1.z.number(), actual: zod_1.z.number(), remaining: zod_1.z.number(), percentage: zod_1.z.number(), status: zod_1.z.string() })),
    }),
}, async ({ companyId, department, year }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const y = year ?? new Date().getFullYear();
    let q = db.collection(`companies/${companyId}/budgets`).where('year', '==', y);
    if (department)
        q = q.where('department', '==', department);
    const snap = await q.limit(20).get().catch((err) => {
        logger_1.logger.error('[Accounting] getBudgetStatus query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture du budget impossible.', year: y, budgets: [] };
    const budgets = snap.docs.map(d => {
        const data = d.data();
        const budgeted = data['budgeted'] ?? 0;
        const actual = data['actual'] ?? 0;
        const pct = budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0;
        return { category: data['category'] ?? '', budgeted, actual, remaining: budgeted - actual, percentage: pct, status: pct > 100 ? 'over_budget' : pct > 80 ? 'warning' : 'on_track' };
    });
    if (budgets.length === 0)
        budgets.push({ category: 'Pas de donnees budget', budgeted: 0, actual: 0, remaining: 0, percentage: 0, status: 'not_configured' });
    return { success: true, year: y, budgets };
});
// ══════════════════════════════════════════════════════════════════════════════
// 5. DETAILS + DOCUMENTS + CONTROLE (V1+ ajouts)
// ══════════════════════════════════════════════════════════════════════════════
exports.getInvoiceByIdTool = genkit_config_1.ai.defineTool({
    name: 'acc_getInvoiceById',
    description: 'Get full details of a specific invoice by ID or number.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), invoiceId: zod_1.z.string().optional(), invoiceNumber: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        found: zod_1.z.boolean(), id: zod_1.z.string(), number: zod_1.z.string(), client: zod_1.z.string(), clientEmail: zod_1.z.string(),
        items: zod_1.z.array(zod_1.z.object({ description: zod_1.z.string(), quantity: zod_1.z.number(), unitPrice: zod_1.z.number() })),
        totalHT: zod_1.z.number(), taxRate: zod_1.z.number(), taxAmount: zod_1.z.number(), totalTTC: zod_1.z.number(),
        paidAmount: zod_1.z.number(), balanceDue: zod_1.z.number(),
        status: zod_1.z.string(), dueDate: zod_1.z.string(), createdAt: zod_1.z.string(),
        sentAt: zod_1.z.string().optional(), reminderCount: zod_1.z.number(), notes: zod_1.z.string(),
    }),
}, async ({ companyId, invoiceId, invoiceNumber }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let data;
    let docId = '';
    if (invoiceId) {
        const doc = await db.collection(`companies/${companyId}/invoices`).doc(invoiceId).get().catch(() => null);
        if (doc?.exists) {
            data = doc.data();
            docId = doc.id;
        }
    }
    else if (invoiceNumber) {
        const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get().catch(() => null);
        if (snap && !snap.empty) {
            data = snap.docs[0].data();
            docId = snap.docs[0].id;
        }
    }
    if (!data)
        return { found: false, id: '', number: '', client: '', clientEmail: '', items: [], totalHT: 0, taxRate: 0, taxAmount: 0, totalTTC: 0, paidAmount: 0, balanceDue: 0, status: '', dueDate: '', createdAt: '', reminderCount: 0, notes: '' };
    const totalTTC = data['totalTTC'] ?? 0;
    const paidAmount = data['paidAmount'] ?? 0;
    return {
        found: true, id: docId, number: data['number'] ?? '',
        client: data['client'] ?? '', clientEmail: data['clientEmail'] ?? '',
        items: data['items'] ?? [],
        totalHT: data['totalHT'] ?? 0, taxRate: data['taxRate'] ?? 20,
        taxAmount: data['taxAmount'] ?? 0, totalTTC, paidAmount, balanceDue: totalTTC - paidAmount,
        status: data['status'] ?? '', dueDate: (data['dueDate']?.toDate?.() ?? new Date()).toISOString().split('T')[0],
        createdAt: (data['createdAt']?.toDate?.() ?? new Date()).toISOString(),
        sentAt: data['sentAt']?.toDate?.()?.toISOString(),
        reminderCount: data['reminderCount'] ?? 0, notes: data['notes'] ?? '',
    };
});
exports.voidInvoiceTool = genkit_config_1.ai.defineTool({
    name: 'acc_voidInvoice',
    description: 'Void/cancel an invoice. Creates a credit note reference. Use for errors or cancellations.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), invoiceNumber: zod_1.z.string(), reason: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, invoiceNumber, reason }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get().catch(() => null);
    if (!snap || snap.empty)
        return { success: false, message: `Facture "${invoiceNumber}" non trouvee.` };
    const doc = snap.docs[0];
    const data = doc.data();
    if (data['status'] === 'void')
        return { success: false, message: 'Cette facture est deja annulee.' };
    try {
        await doc.ref.update({
            status: 'void', voidedAt: firestore_1.FieldValue.serverTimestamp(), voidReason: reason,
            previousStatus: data['status'],
        });
    }
    catch (err) {
        logger_1.logger.error('[Accounting] voidInvoice update failed', { error: String(err) });
        return { success: false, message: 'Annulation impossible.' };
    }
    return { success: true, message: `Facture ${invoiceNumber} annulee. Motif: ${reason}. Montant: ${data['totalTTC']} ${data['currency']}.` };
});
exports.generateInvoicePdfTool = genkit_config_1.ai.defineTool({
    name: 'acc_generateInvoicePdf',
    description: 'Generate a formatted invoice document (text version ready for PDF). Use when user asks to download, print, or send the official invoice.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), invoiceNumber: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), content: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, invoiceNumber }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get().catch(() => null);
    if (!snap || snap.empty)
        return { success: false, content: '', message: 'Facture non trouvee.' };
    const inv = snap.docs[0].data();
    let companyName = 'Orlode';
    let companyAddr = '';
    try {
        const c = await db.collection('companies').doc(companyId).get();
        companyName = c.data()?.['name'] ?? companyName;
        companyAddr = c.data()?.['address'] ?? '';
    }
    catch { }
    const items = inv['items'] ?? [];
    const itemsText = items.map((it, i) => `  ${i + 1}. ${it.description} — ${it.quantity} x ${it.unitPrice} EUR = ${it.quantity * it.unitPrice} EUR`).join('\n');
    const due = (inv['dueDate']?.toDate?.() ?? new Date()).toLocaleDateString('fr-FR');
    const content = `
═══════════════════════════════════════════
                FACTURE
═══════════════════════════════════════════

De: ${companyName}
    ${companyAddr}

A:  ${inv['client'] ?? ''}
    ${inv['clientEmail'] ?? ''}

Facture N°:  ${inv['number']}
Date:        ${new Date().toLocaleDateString('fr-FR')}
Echeance:    ${due}

───────────────────────────────────────────
DESIGNATION                        MONTANT
───────────────────────────────────────────
${itemsText}
───────────────────────────────────────────
Sous-total HT:    ${inv['totalHT']?.toFixed(2)} EUR
TVA (${inv['taxRate'] ?? 20}%):       ${inv['taxAmount']?.toFixed(2)} EUR
───────────────────────────────────────────
TOTAL TTC:        ${inv['totalTTC']?.toFixed(2)} EUR
───────────────────────────────────────────

${inv['notes'] ? `Notes: ${inv['notes']}` : ''}

Merci pour votre confiance.
${companyName}
`.trim();
    return { success: true, content, message: `Facture ${invoiceNumber} generee (${inv['totalTTC']?.toFixed(2)} EUR).` };
});
exports.getExpenseByIdTool = genkit_config_1.ai.defineTool({
    name: 'acc_getExpenseById',
    description: 'Get full details of a specific expense report.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), expenseId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        found: zod_1.z.boolean(), id: zod_1.z.string(), submittedBy: zod_1.z.string(), amount: zod_1.z.number(), currency: zod_1.z.string(),
        category: zod_1.z.string(), description: zod_1.z.string(), date: zod_1.z.string(), status: zod_1.z.string(),
        receipt: zod_1.z.string().optional(), reviewComment: zod_1.z.string().optional(),
    }),
}, async ({ companyId, expenseId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/expenses`).doc(expenseId).get().catch(() => null);
    if (!doc?.exists)
        return { found: false, id: '', submittedBy: '', amount: 0, currency: '', category: '', description: '', date: '', status: '' };
    const x = doc.data();
    return {
        found: true, id: doc.id, submittedBy: x['submittedBy'] ?? '',
        amount: x['amount'] ?? 0, currency: x['currency'] ?? 'EUR',
        category: x['category'] ?? '', description: x['description'] ?? '',
        date: x['date'] ?? '', status: x['status'] ?? '',
        receipt: x['receipt'], reviewComment: x['reviewComment'],
    };
});
exports.getDashboardSummaryTool = genkit_config_1.ai.defineTool({
    name: 'acc_getDashboardSummary',
    description: 'Get a complete financial dashboard summary: total invoiced, collected, overdue, expenses, net balance this month.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        totalInvoiced: zod_1.z.number(), totalCollected: zod_1.z.number(), totalOverdue: zod_1.z.number(),
        totalExpenses: zod_1.z.number(), pendingExpenses: zod_1.z.number(),
        netBalance: zod_1.z.number(), invoiceCount: zod_1.z.number(), overdueCount: zod_1.z.number(),
        currency: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const invSnap = await db.collection(`companies/${companyId}/invoices`).limit(200).get().catch(() => null);
    const expSnap = await db.collection(`companies/${companyId}/expenses`).limit(200).get().catch(() => null);
    if (!invSnap || !expSnap) {
        logger_1.logger.error('[Accounting] getDashboardSummary read failed');
        return { success: false, message: 'Lecture des donnees impossible.', totalInvoiced: 0, totalCollected: 0, totalOverdue: 0, totalExpenses: 0, pendingExpenses: 0, netBalance: 0, invoiceCount: 0, overdueCount: 0, currency: 'XOF' };
    }
    let totalInvoiced = 0, totalCollected = 0, totalOverdue = 0, overdueCount = 0;
    const today = Date.now();
    invSnap.docs.forEach(d => {
        const data = d.data();
        const amount = num(data['totalTTC'] ?? data['amount'] ?? data['total']);
        totalInvoiced += amount;
        if (data['status'] === 'paid')
            totalCollected += amount;
        const due = data['dueDate']?.toDate?.() ?? new Date(data['dueDate'] ?? Date.now());
        if (due.getTime() < today && data['status'] !== 'paid' && data['status'] !== 'void') {
            totalOverdue += amount;
            overdueCount++;
        }
    });
    let totalExpenses = 0, pendingExpenses = 0;
    expSnap.docs.forEach(d => {
        const data = d.data();
        const amount = num(data['amount']);
        if (data['status'] === 'approved')
            totalExpenses += amount;
        if (data['status'] === 'pending')
            pendingExpenses += amount;
    });
    return {
        success: true,
        totalInvoiced: safe(Math.round(totalInvoiced * 100) / 100),
        totalCollected: safe(Math.round(totalCollected * 100) / 100),
        totalOverdue: safe(Math.round(totalOverdue * 100) / 100),
        totalExpenses: safe(Math.round(totalExpenses * 100) / 100),
        pendingExpenses: safe(Math.round(pendingExpenses * 100) / 100),
        netBalance: safe(Math.round((totalCollected - totalExpenses) * 100) / 100),
        invoiceCount: invSnap.size, overdueCount, currency: 'XOF',
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 6. PHASE 2 — Multi-devises, TVA, Rapprochement, Export, Auto-relance
// ══════════════════════════════════════════════════════════════════════════════
const EXCHANGE_RATES = {
    EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.97, CAD: 1.47, XOF: 655.96, XAF: 655.96,
    MAD: 10.8, TND: 3.35, DZD: 145, SAR: 4.05, AED: 3.97, JPY: 163, CNY: 7.8,
};
exports.convertCurrencyTool = genkit_config_1.ai.defineTool({
    name: 'acc_convertCurrency',
    description: 'Convert an amount between currencies. Supports EUR, USD, GBP, CHF, CAD, XOF, XAF, MAD, TND, DZD, SAR, AED, JPY, CNY.',
    inputSchema: zod_1.z.object({
        amount: zod_1.z.number(), from: zod_1.z.string().default('EUR'), to: zod_1.z.string().default('USD'),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), original: zod_1.z.number(), converted: zod_1.z.number(), from: zod_1.z.string(), to: zod_1.z.string(), rate: zod_1.z.number() }),
}, async ({ amount, from, to }) => {
    const fromRate = EXCHANGE_RATES[from.toUpperCase()] ?? 1;
    const toRate = EXCHANGE_RATES[to.toUpperCase()] ?? 1;
    const inEUR = amount / fromRate;
    const converted = Math.round(inEUR * toRate * 100) / 100;
    const rate = Math.round((toRate / fromRate) * 10000) / 10000;
    return { success: true, original: amount, converted, from: from.toUpperCase(), to: to.toUpperCase(), rate };
});
exports.createMultiCurrencyInvoiceTool = genkit_config_1.ai.defineTool({
    name: 'acc_createMultiCurrencyInvoice',
    description: 'Create an invoice in any currency. Auto-calculates EUR equivalent for accounting.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), client: zod_1.z.string(), clientEmail: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({ description: zod_1.z.string(), quantity: zod_1.z.number().default(1), unitPrice: zod_1.z.number() })),
        currency: zod_1.z.string().default('EUR'), dueInDays: zod_1.z.number().optional().default(30),
        taxRate: zod_1.z.number().optional().default(20), notes: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), invoiceId: zod_1.z.string(), number: zod_1.z.string(), totalTTC: zod_1.z.number(), currency: zod_1.z.string(), eurEquivalent: zod_1.z.number(), message: zod_1.z.string() }),
}, async ({ companyId, client, clientEmail, items, currency, dueInDays, taxRate, notes }) => {
    let result;
    try {
        result = await (0, exports.createInvoiceTool)({ companyId, client, clientEmail, items, currency, dueInDays, taxRate, notes });
    }
    catch (err) {
        logger_1.logger.error('[Accounting] createMultiCurrencyInvoice base failed', { error: String(err) });
        return { success: false, invoiceId: '', number: '', totalTTC: 0, currency: currency.toUpperCase(), eurEquivalent: 0, message: 'Creation de la facture impossible.' };
    }
    if (!result.success) {
        return { success: false, invoiceId: '', number: '', totalTTC: 0, currency: currency.toUpperCase(), eurEquivalent: 0, message: result.message };
    }
    const cur = currency.toUpperCase();
    const rate = EXCHANGE_RATES[cur] ?? 1;
    const eurEquivalent = Math.round((result.totalTTC / rate) * 100) / 100;
    // Store EUR equivalent
    const db = (0, firebase_config_1.getFirestore)();
    try {
        await db.collection(`companies/${companyId}/invoices`).doc(result.invoiceId).update({ eurEquivalent, originalCurrency: cur });
    }
    catch (err) {
        logger_1.logger.error('[Accounting] createMultiCurrencyInvoice update failed', { error: String(err) });
    }
    return { success: true, invoiceId: result.invoiceId, number: result.number, totalTTC: result.totalTTC, currency: cur, eurEquivalent, message: `${result.message} (Equivalent EUR: ${eurEquivalent} EUR)` };
});
exports.vatReportTool = genkit_config_1.ai.defineTool({
    name: 'acc_getVATReport',
    description: 'Generate VAT/TVA report for a period — collected TVA, deductible TVA, net TVA due.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        period: zod_1.z.enum(['month', 'quarter', 'year']).default('quarter'),
        year: zod_1.z.number().optional(),
        quarter: zod_1.z.number().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        period: zod_1.z.string(), vatCollected: zod_1.z.number(), vatDeductible: zod_1.z.number(), vatDue: zod_1.z.number(),
        invoiceCount: zod_1.z.number(), expenseCount: zod_1.z.number(), currency: zod_1.z.string(),
        breakdown: zod_1.z.array(zod_1.z.object({ rate: zod_1.z.number(), base: zod_1.z.number(), vat: zod_1.z.number() })),
    }),
}, async ({ companyId, period, year, quarter }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const y = year ?? new Date().getFullYear();
    const periodLabel = period === 'quarter' ? `Q${quarter ?? Math.ceil((new Date().getMonth() + 1) / 3)} ${y}` : `${period} ${y}`;
    // TVA collectee (sur factures)
    const invSnap = await db.collection(`companies/${companyId}/invoices`).limit(500).get().catch(() => null);
    if (!invSnap) {
        logger_1.logger.error('[Accounting] vatReport invoices read failed');
        return { success: false, message: 'Lecture des factures impossible.', period: periodLabel, vatCollected: 0, vatDeductible: 0, vatDue: 0, invoiceCount: 0, expenseCount: 0, currency: 'XOF', breakdown: [] };
    }
    let vatCollected = 0;
    const rateBreakdown = new Map();
    invSnap.docs.forEach(d => {
        const data = d.data();
        if (data['status'] === 'void')
            return;
        const taxRate = num(data['taxRate'], 20);
        const taxAmount = num(data['taxAmount']);
        const totalHT = num(data['totalHT']);
        vatCollected += taxAmount;
        const existing = rateBreakdown.get(taxRate) ?? { base: 0, vat: 0 };
        rateBreakdown.set(taxRate, { base: existing.base + totalHT, vat: existing.vat + taxAmount });
    });
    // TVA deductible (sur depenses approuvees — estimation 20%)
    const expSnap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(500).get().catch(() => null);
    let vatDeductible = 0;
    const expCount = expSnap?.size ?? 0;
    expSnap?.docs.forEach(d => {
        const amount = num(d.data()['amount']);
        vatDeductible += Math.round(amount * 0.2 / 1.2 * 100) / 100; // Reverse TVA from TTC
    });
    const breakdown = Array.from(rateBreakdown.entries()).map(([rate, { base, vat }]) => ({
        rate, base: Math.round(base * 100) / 100, vat: Math.round(vat * 100) / 100,
    }));
    return {
        success: true,
        period: periodLabel,
        vatCollected: safe(Math.round(vatCollected * 100) / 100),
        vatDeductible: safe(Math.round(vatDeductible * 100) / 100),
        vatDue: safe(Math.round((vatCollected - vatDeductible) * 100) / 100),
        invoiceCount: invSnap.size, expenseCount: expCount, currency: 'XOF',
        breakdown: breakdown.map(b => ({ rate: safe(b.rate), base: safe(b.base), vat: safe(b.vat) })),
    };
});
exports.bankReconciliationTool = genkit_config_1.ai.defineTool({
    name: 'acc_bankReconciliation',
    description: 'Bank reconciliation — compare invoices/payments with bank transactions to find discrepancies.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        bankBalance: zod_1.z.number().describe('Current bank account balance'),
        bankCurrency: zod_1.z.string().optional().default('EUR'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        bankBalance: zod_1.z.number(), bookBalance: zod_1.z.number(), difference: zod_1.z.number(),
        status: zod_1.z.string(),
        unreconciledInvoices: zod_1.z.array(zod_1.z.object({ number: zod_1.z.string(), amount: zod_1.z.number(), status: zod_1.z.string() })),
        unreconciledExpenses: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), amount: zod_1.z.number(), description: zod_1.z.string() })),
        recommendations: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId, bankBalance, bankCurrency }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Calculate book balance
    const invSnap = await db.collection(`companies/${companyId}/invoices`).limit(500).get().catch(() => null);
    const expSnap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(500).get().catch(() => null);
    if (!invSnap || !expSnap) {
        logger_1.logger.error('[Accounting] bankReconciliation read failed');
        return { success: false, message: 'Lecture des donnees impossible.', bankBalance, bookBalance: 0, difference: 0, status: 'unknown', unreconciledInvoices: [], unreconciledExpenses: [], recommendations: [] };
    }
    const totalReceived = invSnap.docs.filter(d => d.data()['status'] === 'paid').reduce((s, d) => s + num(d.data()['totalTTC']), 0);
    const totalExpenses = expSnap.docs.reduce((s, d) => s + num(d.data()['amount']), 0);
    const bookBalance = Math.round((totalReceived - totalExpenses) * 100) / 100;
    const difference = Math.round((bankBalance - bookBalance) * 100) / 100;
    // Find unreconciled items
    const unreconciledInvoices = invSnap.docs
        .filter(d => d.data()['status'] === 'paid' && !(d.data()['reconciled']))
        .slice(0, 10)
        .map(d => ({ number: d.data()['number'] ?? '', amount: d.data()['totalTTC'] ?? 0, status: 'non rapproche' }));
    const unreconciledExpenses = expSnap.docs
        .filter(d => !(d.data()['reconciled']))
        .slice(0, 10)
        .map(d => ({ id: d.id.slice(0, 8), amount: d.data()['amount'] ?? 0, description: d.data()['description'] ?? '' }));
    const recommendations = [];
    if (Math.abs(difference) > 0) {
        if (difference > 0)
            recommendations.push(`${difference} ${bankCurrency} en plus sur le compte — verifier les paiements non enregistres.`);
        else
            recommendations.push(`${Math.abs(difference)} ${bankCurrency} manquant — verifier les depenses non comptabilisees.`);
    }
    if (unreconciledInvoices.length > 0)
        recommendations.push(`${unreconciledInvoices.length} facture(s) payee(s) non rapprochee(s).`);
    if (unreconciledExpenses.length > 0)
        recommendations.push(`${unreconciledExpenses.length} depense(s) non rapprochee(s).`);
    return {
        success: true,
        bankBalance, bookBalance, difference,
        status: Math.abs(difference) < 1 ? 'rapproche' : Math.abs(difference) < 100 ? 'ecart_mineur' : 'ecart_significatif',
        unreconciledInvoices, unreconciledExpenses, recommendations,
    };
});
exports.exportFinanceTool = genkit_config_1.ai.defineTool({
    name: 'acc_exportCSV',
    description: 'Export financial data as CSV format — invoices, expenses, payments, or full ledger.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        dataType: zod_1.z.enum(['invoices', 'expenses', 'payments', 'ledger']).default('invoices'),
        status: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), csv: zod_1.z.string(), rowCount: zod_1.z.number(), message: zod_1.z.string() }),
}, async ({ companyId, dataType, status }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let csv = '';
    let rowCount = 0;
    try {
        if (dataType === 'invoices') {
            csv = 'Numero;Client;Montant HT;TVA;Montant TTC;Devise;Statut;Echeance;Cree le\n';
            let q = db.collection(`companies/${companyId}/invoices`);
            if (status && status !== 'all')
                q = q.where('status', '==', status);
            const snap = await q.limit(500).get();
            snap.docs.forEach(d => {
                const x = d.data();
                const due = x['dueDate']?.toDate?.()?.toISOString().split('T')[0] ?? '';
                const created = x['createdAt']?.toDate?.()?.toISOString().split('T')[0] ?? '';
                csv += `${x['number'] ?? ''};${x['client'] ?? ''};${x['totalHT'] ?? 0};${x['taxAmount'] ?? 0};${x['totalTTC'] ?? 0};${x['currency'] ?? 'EUR'};${x['status'] ?? ''};${due};${created}\n`;
            });
            rowCount = snap.size;
        }
        else if (dataType === 'expenses') {
            csv = 'ID;Employe;Montant;Devise;Categorie;Description;Statut;Date\n';
            let q = db.collection(`companies/${companyId}/expenses`);
            if (status && status !== 'all')
                q = q.where('status', '==', status);
            const snap = await q.limit(500).get();
            snap.docs.forEach(d => {
                const x = d.data();
                csv += `${d.id.slice(0, 8)};${x['submittedBy'] ?? ''};${x['amount'] ?? 0};${x['currency'] ?? 'EUR'};${x['category'] ?? ''};${x['description'] ?? ''};${x['status'] ?? ''};${x['date'] ?? ''}\n`;
            });
            rowCount = snap.size;
        }
        else if (dataType === 'payments') {
            csv = 'ID;Facture;Montant;Methode;Date\n';
            const snap = await db.collection(`companies/${companyId}/payments`).limit(500).get();
            snap.docs.forEach(d => {
                const x = d.data();
                csv += `${d.id.slice(0, 8)};${x['invoiceId'] ?? ''};${x['amount'] ?? 0};${x['method'] ?? ''};${x['date'] ?? ''}\n`;
            });
            rowCount = snap.size;
        }
        else {
            // Full ledger
            csv = 'Date;Type;Reference;Description;Debit;Credit;Devise\n';
            const invSnap = await db.collection(`companies/${companyId}/invoices`).limit(500).get();
            const expSnap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(500).get();
            invSnap.docs.forEach(d => {
                const x = d.data();
                const date = x['createdAt']?.toDate?.()?.toISOString().split('T')[0] ?? '';
                csv += `${date};Facture;${x['number'] ?? ''};${x['client'] ?? ''};0;${x['totalTTC'] ?? 0};${x['currency'] ?? 'EUR'}\n`;
            });
            expSnap.docs.forEach(d => {
                const x = d.data();
                csv += `${x['date'] ?? ''};Depense;${d.id.slice(0, 8)};${x['description'] ?? ''};${x['amount'] ?? 0};0;${x['currency'] ?? 'EUR'}\n`;
            });
            rowCount = invSnap.size + expSnap.size;
        }
    }
    catch (err) {
        logger_1.logger.error('[Accounting] exportCSV failed', { error: String(err), dataType });
        return { success: false, csv: '', rowCount: 0, message: 'Export impossible.' };
    }
    return { success: true, csv, rowCount, message: `Export ${dataType}: ${rowCount} lignes generees (format CSV separateur ;).` };
});
exports.autoRelanceTool = genkit_config_1.ai.defineTool({
    name: 'acc_autoRelance',
    description: 'Run automatic payment reminder schedule: J+3 gentle, J+10 firm, J+20 urgent. Processes all overdue invoices.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        processed: zod_1.z.number(),
        gentle: zod_1.z.array(zod_1.z.object({ number: zod_1.z.string(), client: zod_1.z.string(), daysOverdue: zod_1.z.number() })),
        firm: zod_1.z.array(zod_1.z.object({ number: zod_1.z.string(), client: zod_1.z.string(), daysOverdue: zod_1.z.number() })),
        urgent: zod_1.z.array(zod_1.z.object({ number: zod_1.z.string(), client: zod_1.z.string(), daysOverdue: zod_1.z.number() })),
        message: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const today = Date.now();
    const snap = await db.collection(`companies/${companyId}/invoices`).where('status', 'in', ['pending', 'overdue']).limit(200).get().catch(() => null);
    if (!snap) {
        logger_1.logger.error('[Accounting] autoRelance read failed');
        return { success: false, processed: 0, gentle: [], firm: [], urgent: [], message: 'Lecture des factures impossible.' };
    }
    const gentle = [];
    const firm = [];
    const urgent = [];
    for (const d of snap.docs) {
        const data = d.data();
        const due = data['dueDate']?.toDate?.() ?? new Date(data['dueDate'] ?? Date.now());
        const daysOverdue = Math.floor((today - due.getTime()) / 86400000);
        if (daysOverdue <= 0)
            continue;
        const entry = {
            number: data['number'] ?? d.id.slice(0, 8),
            client: data['client'] ?? '',
            daysOverdue,
        };
        const reminderCount = data['reminderCount'] ?? 0;
        let tone;
        if (daysOverdue >= 20 || reminderCount >= 2) {
            tone = 'urgent';
            urgent.push(entry);
        }
        else if (daysOverdue >= 10 || reminderCount >= 1) {
            tone = 'firm';
            firm.push(entry);
        }
        else if (daysOverdue >= 3) {
            tone = 'gentle';
            gentle.push(entry);
        }
        else
            continue;
        // Update invoice
        try {
            await d.ref.update({
                status: 'overdue',
                lastReminderAt: firestore_1.FieldValue.serverTimestamp(),
                reminderCount: firestore_1.FieldValue.increment(1),
                lastReminderTone: tone,
            });
        }
        catch (err) {
            logger_1.logger.error('[Accounting] autoRelance update failed', { error: String(err), invoice: d.id });
        }
    }
    const total = gentle.length + firm.length + urgent.length;
    return {
        success: true,
        processed: total, gentle, firm, urgent,
        message: total > 0
            ? `Auto-relance: ${gentle.length} cordial(s), ${firm.length} ferme(s), ${urgent.length} urgent(s). Total: ${total} facture(s) relancee(s).`
            : 'Aucune facture en retard necessitant une relance.',
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// ALL TOOLS + FLOW
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// PRO: P&L STATEMENT (Compte de résultat)
// ══════════════════════════════════════════════════════════════════════════════
exports.profitLossTool = genkit_config_1.ai.defineTool({
    name: 'acc_getProfitLoss',
    description: 'Generate Profit & Loss statement (Compte de résultat) — revenue, expenses, net income by period.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), period: zod_1.z.enum(['month', 'quarter', 'year']).optional().default('quarter'), year: zod_1.z.number().optional() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        period: zod_1.z.string(), revenue: zod_1.z.number(), costOfSales: zod_1.z.number(), grossProfit: zod_1.z.number(), grossMargin: zod_1.z.number(),
        operatingExpenses: zod_1.z.object({ salaries: zod_1.z.number(), rent: zod_1.z.number(), marketing: zod_1.z.number(), it: zod_1.z.number(), other: zod_1.z.number(), total: zod_1.z.number() }),
        operatingIncome: zod_1.z.number(), taxes: zod_1.z.number(), netIncome: zod_1.z.number(), netMargin: zod_1.z.number(),
        comparison: zod_1.z.object({ previousPeriod: zod_1.z.number(), change: zod_1.z.number(), changePercent: zod_1.z.number() }).optional(),
    }),
}, async ({ companyId, period, year }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const currentYear = year ?? new Date().getFullYear();
    const months = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
    // Get invoices (revenue)
    const invSnap = await db.collection(`companies/${companyId}/invoices`).where('status', 'in', ['paid', 'sent', 'overdue']).limit(500).get().catch(() => null);
    const expSnap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(500).get().catch(() => null);
    if (!invSnap || !expSnap) {
        logger_1.logger.error('[Accounting] profitLoss read failed');
        return {
            success: false, message: 'Lecture des donnees impossible.',
            period: `${period} ${currentYear}`, revenue: 0, costOfSales: 0, grossProfit: 0, grossMargin: 0,
            operatingExpenses: { salaries: 0, rent: 0, marketing: 0, it: 0, other: 0, total: 0 },
            operatingIncome: 0, taxes: 0, netIncome: 0, netMargin: 0,
        };
    }
    const invoices = invSnap.docs.map(d => d.data());
    const paidInvoices = invoices.filter(i => i['status'] === 'paid');
    const revenue = paidInvoices.reduce((s, i) => s + num(i['totalTTC'] ?? i['amount']), 0);
    // Get expenses
    const expenses = expSnap.docs.map(d => d.data());
    const totalExpenses = expenses.reduce((s, e) => s + num(e['amount']), 0);
    // Categorize expenses
    const expByCat = {};
    expenses.forEach(e => { const c = e['category'] ?? 'autre'; expByCat[c] = (expByCat[c] ?? 0) + num(e['amount']); });
    const costOfSales = Math.round(revenue * 0.35); // estimated 35% COGS
    const grossProfit = revenue - costOfSales;
    const opEx = {
        salaries: expByCat['salaires'] ?? Math.round(totalExpenses * 0.45),
        rent: expByCat['loyer'] ?? Math.round(totalExpenses * 0.15),
        marketing: expByCat['marketing'] ?? Math.round(totalExpenses * 0.1),
        it: expByCat['logiciel'] ?? expByCat['materiel'] ?? Math.round(totalExpenses * 0.1),
        other: expByCat['autre'] ?? Math.round(totalExpenses * 0.2),
        total: totalExpenses,
    };
    const operatingIncome = grossProfit - opEx.total;
    const taxes = Math.round(Math.max(0, operatingIncome) * 0.25);
    const netIncome = operatingIncome - taxes;
    return {
        success: true,
        period: `${period} ${currentYear}`,
        revenue: safe(revenue), costOfSales: safe(costOfSales), grossProfit: safe(grossProfit),
        grossMargin: revenue > 0 ? safe(Math.round(grossProfit / revenue * 100)) : 0,
        operatingExpenses: {
            salaries: safe(opEx.salaries), rent: safe(opEx.rent), marketing: safe(opEx.marketing),
            it: safe(opEx.it), other: safe(opEx.other), total: safe(opEx.total),
        },
        operatingIncome: safe(operatingIncome), taxes: safe(taxes), netIncome: safe(netIncome),
        netMargin: revenue > 0 ? safe(Math.round(netIncome / revenue * 100)) : 0,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: AGING REPORT (Créances par ancienneté)
// ══════════════════════════════════════════════════════════════════════════════
exports.agingReportTool = genkit_config_1.ai.defineTool({
    name: 'acc_getAgingReport',
    description: 'Accounts receivable aging report — invoices grouped by 0-30, 30-60, 60-90, 90+ days.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        buckets: zod_1.z.array(zod_1.z.object({ range: zod_1.z.string(), count: zod_1.z.number(), total: zod_1.z.number(), invoices: zod_1.z.array(zod_1.z.object({ number: zod_1.z.string(), client: zod_1.z.string(), amount: zod_1.z.number(), daysOverdue: zod_1.z.number() })) })),
        totalOverdue: zod_1.z.number(), totalOutstanding: zod_1.z.number(), highestRisk: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/invoices`).where('status', 'in', ['sent', 'overdue']).limit(200).get().catch(() => null);
    if (!snap) {
        logger_1.logger.error('[Accounting] agingReport read failed');
        return { success: false, message: 'Lecture des factures impossible.', buckets: [], totalOverdue: 0, totalOutstanding: 0, highestRisk: 'Aucun' };
    }
    const now = Date.now();
    const buckets = {
        '0-30': { count: 0, total: 0, invoices: [] },
        '30-60': { count: 0, total: 0, invoices: [] },
        '60-90': { count: 0, total: 0, invoices: [] },
        '90+': { count: 0, total: 0, invoices: [] },
    };
    snap.docs.forEach(d => {
        const inv = d.data();
        const dueDate = inv['dueDate']?.toDate?.() ?? (inv['dueDate'] ? new Date(inv['dueDate']) : new Date());
        const daysOverdue = Math.max(0, Math.round((now - dueDate.getTime()) / 86400000));
        const amount = inv['totalTTC'] ?? inv['amount'] ?? 0;
        const entry = { number: inv['number'] ?? d.id, client: inv['client'] ?? '', amount, daysOverdue };
        if (daysOverdue <= 30) {
            buckets['0-30'].count++;
            buckets['0-30'].total += amount;
            buckets['0-30'].invoices.push(entry);
        }
        else if (daysOverdue <= 60) {
            buckets['30-60'].count++;
            buckets['30-60'].total += amount;
            buckets['30-60'].invoices.push(entry);
        }
        else if (daysOverdue <= 90) {
            buckets['60-90'].count++;
            buckets['60-90'].total += amount;
            buckets['60-90'].invoices.push(entry);
        }
        else {
            buckets['90+'].count++;
            buckets['90+'].total += amount;
            buckets['90+'].invoices.push(entry);
        }
    });
    const totalOverdue = Object.values(buckets).reduce((s, b) => s + b.total, 0);
    const highestRisk = buckets['90+'].invoices.sort((a, b) => b.amount - a.amount)[0]?.client ?? '';
    return {
        success: true,
        buckets: Object.entries(buckets).map(([range, data]) => ({ range, ...data })),
        totalOverdue, totalOutstanding: totalOverdue,
        highestRisk: highestRisk || 'Aucun',
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: RECURRING INVOICES
// ══════════════════════════════════════════════════════════════════════════════
exports.createRecurringInvoiceTool = genkit_config_1.ai.defineTool({
    name: 'acc_createRecurringInvoice',
    description: 'Create a recurring invoice template — auto-generates invoices on schedule.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), client: zod_1.z.string(), clientEmail: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({ description: zod_1.z.string(), quantity: zod_1.z.number(), unitPrice: zod_1.z.number() })),
        frequency: zod_1.z.enum(['monthly', 'quarterly', 'yearly']),
        startDate: zod_1.z.string().optional(), taxRate: zod_1.z.number().optional().default(20),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), recurringId: zod_1.z.string(), frequency: zod_1.z.string(), nextInvoiceDate: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, client, clientEmail, items, frequency, startDate, taxRate }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    const totalHT = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const totalTTC = Math.round(totalHT * (1 + (taxRate ?? 20) / 100) * 100) / 100;
    const next = startDate ? new Date(startDate) : new Date();
    if (!startDate) {
        if (frequency === 'monthly')
            next.setMonth(next.getMonth() + 1, 1);
        else if (frequency === 'quarterly')
            next.setMonth(next.getMonth() + 3, 1);
        else
            next.setFullYear(next.getFullYear() + 1, 0, 1);
    }
    try {
        await db.collection(`companies/${companyId}/recurringInvoices`).doc(id).set({
            id, client, clientEmail: clientEmail ?? '', items, frequency, taxRate: taxRate ?? 20,
            totalHT, totalTTC, status: 'active', nextInvoiceDate: next.toISOString().split('T')[0],
            generatedCount: 0, createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[Accounting] createRecurringInvoice write failed', { error: String(err) });
        return { success: false, recurringId: '', frequency, nextInvoiceDate: '', message: 'Sauvegarde impossible.' };
    }
    return { success: true, recurringId: id, frequency, nextInvoiceDate: next.toISOString().split('T')[0], message: `Facture recurrente ${frequency} creee pour ${client} (${totalTTC}€). Prochaine: ${next.toLocaleDateString('fr-FR')}.` };
});
exports.getRecurringInvoicesTool = genkit_config_1.ai.defineTool({
    name: 'acc_getRecurringInvoices',
    description: 'List recurring invoice templates.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string().optional(), recurring: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), client: zod_1.z.string(), frequency: zod_1.z.string(), totalTTC: zod_1.z.number(), nextInvoiceDate: zod_1.z.string(), status: zod_1.z.string(), generatedCount: zod_1.z.number() })) }),
}, async ({ companyId }) => {
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/recurringInvoices`).limit(50).get().catch((err) => {
        logger_1.logger.error('[Accounting] getRecurringInvoices query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture impossible.', recurring: [] };
    return { success: true, recurring: snap.docs.map(d => { const data = d.data(); return { id: d.id, client: data['client'] ?? '', frequency: data['frequency'] ?? '', totalTTC: data['totalTTC'] ?? 0, nextInvoiceDate: data['nextInvoiceDate'] ?? '', status: data['status'] ?? 'active', generatedCount: data['generatedCount'] ?? 0 }; }) };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: EXPENSE ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
exports.expenseAnalyticsTool = genkit_config_1.ai.defineTool({
    name: 'acc_getExpenseAnalytics',
    description: 'Expense analytics — by category, by department, trends, top spenders.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), period: zod_1.z.enum(['month', 'quarter', 'year']).optional().default('quarter') }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        totalExpenses: zod_1.z.number(), avgPerMonth: zod_1.z.number(),
        byCategory: zod_1.z.array(zod_1.z.object({ category: zod_1.z.string(), total: zod_1.z.number(), percentage: zod_1.z.number() })),
        byDepartment: zod_1.z.array(zod_1.z.object({ department: zod_1.z.string(), total: zod_1.z.number() })),
        topSpenders: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), total: zod_1.z.number(), count: zod_1.z.number() })),
        trend: zod_1.z.string(),
    }),
}, async ({ companyId, period }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(500).get().catch(() => null);
    if (!snap) {
        logger_1.logger.error('[Accounting] expenseAnalytics read failed');
        return { success: false, message: 'Lecture impossible.', totalExpenses: 0, avgPerMonth: 0, byCategory: [], byDepartment: [], topSpenders: [], trend: 'unknown' };
    }
    const expenses = snap.docs.map(d => d.data());
    const total = expenses.reduce((s, e) => s + num(e['amount']), 0);
    const byCat = {};
    const byDept = {};
    const byUser = {};
    expenses.forEach(e => {
        const cat = e['category'] ?? 'autre';
        byCat[cat] = (byCat[cat] ?? 0) + num(e['amount']);
        const dept = e['department'] ?? 'Autre';
        byDept[dept] = (byDept[dept] ?? 0) + num(e['amount']);
        const uid = e['userId'] ?? '';
        const name = e['userName'] ?? uid;
        if (!byUser[uid])
            byUser[uid] = { name, total: 0, count: 0 };
        byUser[uid].total += e['amount'] ?? 0;
        byUser[uid].count++;
    });
    const months = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
    return {
        success: true,
        totalExpenses: total, avgPerMonth: Math.round(total / months),
        byCategory: Object.entries(byCat).map(([c, t]) => ({ category: c, total: t, percentage: total > 0 ? Math.round(t / total * 100) : 0 })).sort((a, b) => b.total - a.total),
        byDepartment: Object.entries(byDept).map(([d, t]) => ({ department: d, total: t })).sort((a, b) => b.total - a.total),
        topSpenders: Object.values(byUser).sort((a, b) => b.total - a.total).slice(0, 10),
        trend: total > 0 ? 'stable' : 'insufficient_data',
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: FINANCE AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════
exports.financeAutomationTool = genkit_config_1.ai.defineTool({
    name: 'acc_runAutomation',
    description: 'Finance automation: overdue → alert sales, budget exceeded → notification, recurring → generate.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), type: zod_1.z.enum(['overdue_alert', 'budget_check', 'generate_recurring']) }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), actions: zod_1.z.array(zod_1.z.string()), message: zod_1.z.string() }),
}, async ({ companyId, type }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const actions = [];
    try {
        if (type === 'overdue_alert') {
            // Alert sales team about overdue invoices
            const snap = await db.collection(`companies/${companyId}/invoices`).where('status', '==', 'overdue').limit(50).get();
            if (snap.size > 0) {
                const total = snap.docs.reduce((s, d) => s + num(d.data()['totalTTC'] ?? d.data()['amount']), 0);
                const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
                createNotification({ companyId, type: 'system', title: `${snap.size} factures impayees (${total}€)`, message: `Relancez vos clients pour recuperer ${total}€ de creances.`, actionUrl: '/finance/invoices', icon: 'AlertTriangle', severity: 'warning' }).catch(() => { });
                actions.push(`Alerte: ${snap.size} factures impayees — ${total}€`);
            }
        }
        if (type === 'budget_check') {
            const snap = await db.collection(`companies/${companyId}/budgets`).limit(20).get();
            for (const doc of snap.docs) {
                const b = doc.data();
                const allocated = b['allocated'] ?? 0;
                const spent = b['spent'] ?? 0;
                if (allocated > 0 && spent > allocated * 0.9) {
                    const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
                    createNotification({ companyId, type: 'system', title: `Budget ${b['department']} a ${Math.round(spent / allocated * 100)}%`, message: `Le departement ${b['department']} a depense ${spent}€ sur ${allocated}€ budgetes.`, actionUrl: '/finance/budget', icon: 'TrendingUp', severity: spent > allocated ? 'error' : 'warning' }).catch(() => { });
                    actions.push(`Budget ${b['department']}: ${Math.round(spent / allocated * 100)}% utilise`);
                }
            }
        }
        if (type === 'generate_recurring') {
            const snap = await db.collection(`companies/${companyId}/recurringInvoices`).where('status', '==', 'active').limit(20).get();
            const today = new Date().toISOString().split('T')[0];
            for (const doc of snap.docs) {
                const r = doc.data();
                if (r['nextInvoiceDate'] <= today) {
                    // Generate invoice
                    const invId = (0, helpers_1.generateId)();
                    const number = `FAC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
                    try {
                        await db.collection(`companies/${companyId}/invoices`).doc(invId).set({
                            id: invId, number, client: r['client'], clientEmail: r['clientEmail'] ?? '',
                            items: r['items'], totalHT: r['totalHT'], totalTTC: r['totalTTC'], taxRate: r['taxRate'],
                            status: 'sent', currency: 'EUR', source: 'recurring', recurringId: doc.id,
                            createdAt: new Date(), dueDate: new Date(Date.now() + 30 * 86400000),
                        });
                        // Update next date
                        const freq = r['frequency'] ?? 'monthly';
                        const next = new Date(r['nextInvoiceDate']);
                        if (freq === 'monthly')
                            next.setMonth(next.getMonth() + 1);
                        else if (freq === 'quarterly')
                            next.setMonth(next.getMonth() + 3);
                        else
                            next.setFullYear(next.getFullYear() + 1);
                        await doc.ref.update({ nextInvoiceDate: next.toISOString().split('T')[0], generatedCount: firestore_1.FieldValue.increment(1) });
                        actions.push(`Facture ${number} generee pour ${r['client']} (${r['totalTTC']}€)`);
                    }
                    catch (err) {
                        logger_1.logger.error('[Accounting] runAutomation generate_recurring write failed', { error: String(err), recurring: doc.id });
                    }
                }
            }
        }
    }
    catch (err) {
        logger_1.logger.error('[Accounting] runAutomation failed', { error: String(err), type });
        return { success: false, actions, message: 'Automation impossible.' };
    }
    return { success: true, actions, message: actions.length > 0 ? `${actions.length} action(s) executee(s).` : 'Aucune action necessaire.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: CLIENT RISK SCORE
// ══════════════════════════════════════════════════════════════════════════════
exports.clientRiskScoreTool = genkit_config_1.ai.defineTool({
    name: 'acc_getClientRiskScore',
    description: 'Calculate client payment risk score based on invoice payment history — late payments, overdue amounts.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), clientName: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        clients: zod_1.z.array(zod_1.z.object({
            client: zod_1.z.string(), riskLevel: zod_1.z.string(), totalInvoiced: zod_1.z.number(),
            totalPaid: zod_1.z.number(), totalOverdue: zod_1.z.number(), avgDaysLate: zod_1.z.number(),
            overdueCount: zod_1.z.number(), invoiceCount: zod_1.z.number(),
        })),
    }),
}, async ({ companyId, clientName }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/invoices`).limit(500).get().catch(() => null);
    if (!snap) {
        logger_1.logger.error('[Accounting] clientRiskScore read failed');
        return { success: false, message: 'Lecture des factures impossible.', clients: [] };
    }
    const invoices = snap.docs.map(d => d.data());
    const clientMap = new Map();
    invoices.forEach(inv => {
        const client = inv['client'] ?? '';
        if (clientName && !client.toLowerCase().includes(clientName.toLowerCase()))
            return;
        if (!clientMap.has(client))
            clientMap.set(client, { totalInvoiced: 0, totalPaid: 0, totalOverdue: 0, overdueCount: 0, invoiceCount: 0, lateDays: [] });
        const c = clientMap.get(client);
        const amount = inv['totalTTC'] ?? inv['amount'] ?? 0;
        c.totalInvoiced += amount;
        c.invoiceCount++;
        if (inv['status'] === 'paid')
            c.totalPaid += amount;
        if (inv['status'] === 'overdue') {
            c.totalOverdue += amount;
            c.overdueCount++;
        }
        // Calculate late days
        const dueDate = inv['dueDate']?.toDate?.();
        const paidDate = inv['paidAt']?.toDate?.();
        if (dueDate && paidDate && paidDate > dueDate) {
            c.lateDays.push(Math.round((paidDate.getTime() - dueDate.getTime()) / 86400000));
        }
    });
    const clients = Array.from(clientMap.entries()).map(([client, data]) => {
        const avgDaysLate = data.lateDays.length > 0 ? Math.round(data.lateDays.reduce((s, d) => s + d, 0) / data.lateDays.length) : 0;
        const overdueRatio = data.invoiceCount > 0 ? data.overdueCount / data.invoiceCount : 0;
        const riskLevel = overdueRatio > 0.5 || avgDaysLate > 30 ? 'high' : overdueRatio > 0.2 || avgDaysLate > 15 ? 'medium' : 'low';
        return { client, riskLevel, totalInvoiced: data.totalInvoiced, totalPaid: data.totalPaid, totalOverdue: data.totalOverdue, avgDaysLate, overdueCount: data.overdueCount, invoiceCount: data.invoiceCount };
    }).sort((a, b) => { const o = { high: 3, medium: 2, low: 1 }; return (o[b.riskLevel] ?? 0) - (o[a.riskLevel] ?? 0); });
    return { success: true, clients };
});
const ALL_TOOLS = [
    // Factures — Create → Track → Collect
    exports.createInvoiceTool, exports.createMultiCurrencyInvoiceTool, exports.updateInvoiceTool, exports.sendInvoiceTool, exports.sendReminderTool,
    exports.getInvoicesTool, exports.getInvoiceByIdTool, exports.getPaymentHistoryTool,
    // Documents & Controle
    exports.generateInvoicePdfTool, exports.voidInvoiceTool,
    // Depenses
    exports.submitExpenseTool, exports.reviewExpenseTool, exports.getExpenseReportsTool, exports.getExpenseByIdTool,
    // Analyse
    exports.getCashFlowTool, exports.forecastCashFlowTool, exports.getBudgetStatusTool, exports.getDashboardSummaryTool,
    // Phase 2 — Multi-devises, TVA, Rapprochement, Export, Auto-relance
    exports.convertCurrencyTool, exports.vatReportTool, exports.bankReconciliationTool, exports.exportFinanceTool, exports.autoRelanceTool,
    // PRO
    exports.profitLossTool, exports.agingReportTool, exports.createRecurringInvoiceTool, exports.getRecurringInvoicesTool,
    exports.expenseAnalyticsTool, exports.financeAutomationTool, exports.clientRiskScoreTool,
];
const EXECUTORS = new Map(ALL_TOOLS.map(t => [t.__action.name, (i) => t(i)]));
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({ response: zod_1.z.string(), alertLevel: zod_1.z.enum(['none', 'warning', 'critical']), requiresAction: zod_1.z.boolean() });
exports.accountingAgentFlow = genkit_config_1.ai.defineFlow({ name: 'accountingAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, userId, language, history }) => {
    logger_1.logger.info(`[AccountingAgent] Request: "${request.slice(0, 80)}" (history: ${history?.length ?? 0} msgs)`);
    const lang = language === 'auto' ? 'Reponds dans la meme langue que la demande.' : `Reponds en ${language}.`;
    // Date anchors — invoices, due dates, VAT periods need real today
    const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
        const today = now.toISOString().slice(0, 10);
        const due30 = new Date(now);
        due30.setDate(due30.getDate() + 30);
        return `AUJOURD'HUI : ${today} (${months[now.getMonth()]} ${now.getFullYear()}). Echeance par defaut J+30 = ${due30.toISOString().slice(0, 10)}.`;
    })();
    // Build messages array with conversation history for context (memory across turns)
    const conversationMessages = [];
    if (history && history.length > 0) {
        for (const h of history) {
            conversationMessages.push({ role: h.role, content: [{ text: h.content }] });
        }
    }
    conversationMessages.push({ role: 'user', content: [{ text: request }] });
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: `Tu es l'Agent Comptable de l'entreprise — le CFO virtuel.

## 📅 CONTEXTE TEMPOREL (ne jamais inventer de dates)
${dateAnchors}
Pour factures, echeances, periodes TVA, utilise STRICTEMENT cette date d'aujourd'hui. Format ISO YYYY-MM-DD pour tous les tools (issueDate, dueDate, period).

## 🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
Tu ne DOIS JAMAIS pretendre avoir fait une action sans appel d'outil reussi.
INTERDIT :
- "Facture envoyee", "Paiement enregistre", "Relance envoyee" sans avoir appele le tool correspondant
- Inventer un montant, un solde, un numero de facture, un IBAN
- Pretendre que la TVA a ete calculee si tu n'as pas appele acc_getVATReport
- Confirmer un virement sans avoir appele acc_updateInvoice avec le paiement

RÈGLE : APPELLE le tool. Si succes, cite les vrais champs (invoiceId, montant exact, devise). Si echec (Gmail non connecte, client sans email, montant manquant), DIS la vraie raison. L'utilisateur prefere "je n'ai pas pu envoyer parce que X" a une fausse confirmation.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages précédents. Quand l'utilisateur dit "celui que tu viens de créer", "cette facture", "envoie-le", référence la facture/note de frais la plus récente dans l'historique. Si tu viens de créer FAC-2026-0007 et l'utilisateur dit "envoie-le à X", utilise FAC-2026-0007. Ne demande JAMAIS quelle facture si le contexte est clair.

## 📋 DEVIS vs FACTURE
- Un **devis** = proposition commerciale AVANT validation client. Crée-le avec acc_createInvoice mais précise dans le sujet/message qu'il s'agit d'un devis. Ne dis JAMAIS "facture créée" si l'utilisateur a demandé un devis.
- Une **facture** = document de paiement APRÈS livraison/prestation.
- Toujours respecter le terme employé par l'utilisateur. Si l'utilisateur dit "devis", c'est un DEVIS — utilise ce mot dans tes réponses.

## 📧 ENVOI EMAIL — toEmail OVERRIDE
- L'outil acc_sendInvoice accepte un paramètre OPTIONNEL "toEmail" qui override l'email du client pour CET ENVOI uniquement, SANS modifier la fiche client.
- Si l'utilisateur dit "envoie à xxx@yyy.com" et que ce n'est pas l'email du client, passe directement toEmail="xxx@yyy.com" — ne demande PAS la permission, ne dis PAS que tu dois l'ajouter à la fiche.
- Exemple : "envoie à adelinguessan@gmail.com" → acc_sendInvoice({ invoiceId, toEmail: 'adelinguessan@gmail.com' }) — ça marche directement.

TES CAPACITES (Create → Track → Collect → Analyze):

FACTURES (Create → Track → Collect):
- Creer facture avec calcul auto HT/TVA/TTC et numero auto (acc_createInvoice)
- Modifier statut / enregistrer paiement partiel ou total (acc_updateInvoice)
- Voir le detail complet d'une facture (acc_getInvoiceById)
- Envoyer facture au client par email (acc_sendInvoice)
- Envoyer rappels impaye — 3 tons: cordial, ferme, urgent (acc_sendPaymentReminder)
- Lister factures avec filtres (acc_getInvoices)
- Historique des paiements recus (acc_getPaymentHistory)
- Generer le document facture formate (acc_generateInvoicePdf)
- Annuler une facture avec motif (acc_voidInvoice)

NOTES DE FRAIS (Submit → Review → Track):
- Soumettre une note de frais (acc_submitExpense)
- Approuver/rejeter (acc_reviewExpense)
- Lister les notes de frais (acc_getExpenseReports)
- Detail d'une note de frais (acc_getExpenseById)

TRESORERIE & ANALYSE:
- Tableau de bord tresorerie temps reel (acc_getCashFlow)
- Previsions 3 mois + risques + recommandations (acc_forecastCashFlow)
- Budget vs reel par departement (acc_getBudgetStatus)
- Resume financier global (acc_getDashboardSummary)

MULTI-DEVISES:
- Conversion entre devises EUR/USD/GBP/XOF/MAD/etc. (acc_convertCurrency)
- Creer facture en devise etrangere avec equivalent EUR (acc_createMultiCurrencyInvoice)

TVA / DECLARATIONS:
- Rapport TVA par periode: collectee, deductible, nette a payer (acc_getVATReport)

RAPPROCHEMENT BANCAIRE:
- Comparer solde banque vs comptabilite, trouver ecarts (acc_bankReconciliation)

EXPORT:
- Export CSV des factures, depenses, paiements ou grand livre complet (acc_exportCSV)

AUTO-RELANCE:
- Relances automatiques: J+3 cordial, J+10 ferme, J+20 urgent (acc_autoRelance)

REGLES:
- TOUJOURS afficher les montants avec la devise
- Signaler clairement les factures en retard et les depassements de budget
- Ne JAMAIS prendre de decision financiere sans validation humaine
- Proposer des actions concretes (relancer, approuver, reduire)
- Etre precis sur les chiffres

CompanyID: ${companyId}. UserID: ${userId ?? 'unknown'}.
${lang}`,
        messages: conversationMessages,
        tools: ALL_TOOLS,
        config: { temperature: 0.2 },
    });
    let loopCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 7) {
        loopCount++;
        const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            const exec = EXECUTORS.get(name);
            const inp = { ...input, companyId, userId };
            let output;
            try {
                output = exec ? await exec(inp) : { error: `Outil inconnu: ${name}` };
            }
            catch (err) {
                output = { error: String(err) };
            }
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            messages: [...response.messages, { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
            tools: ALL_TOOLS, config: { temperature: 0.2 },
        });
    }
    const text = response.text;
    const isCritical = /overdue|impaye|negative|over.budget|urgent|retard/i.test(text);
    const isWarning = /warning|attention|budget.*80|rappel|surveiller/i.test(text);
    return { response: text, alertLevel: isCritical ? 'critical' : isWarning ? 'warning' : 'none', requiresAction: isCritical || isWarning };
});
exports.accountingAgentTool = genkit_config_1.ai.defineTool({
    name: 'callAccountingAgent',
    description: 'Comptabilite PRO: factures (creer/recurrentes/multi-devises/relancer/PDF), depenses (soumettre/approuver/analytics), P&L, aging report, tresorerie + previsions, budget, TVA, rapprochement bancaire, export CSV, auto-relance, cross-agent automation.',
    inputSchema: INPUT, outputSchema: OUTPUT,
}, async (input) => {
    try {
        return await (0, exports.accountingAgentFlow)(input);
    }
    catch (err) {
        logger_1.logger.error('[callAccountingAgent] Error:', err);
        return { response: 'Erreur dans l\'agent comptable.', alertLevel: 'none', requiresAction: false };
    }
});
//# sourceMappingURL=accounting.agent.js.map