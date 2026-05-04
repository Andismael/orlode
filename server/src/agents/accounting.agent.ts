/**
 * Accounting Agent PRO — Gemini Flash
 * Create → Track → Collect → Analyze
 * Factures, notes de frais, tresorerie, budget, rappels, previsions.
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

/** Safe number coercion — returns 0 for null, undefined, NaN, non-numeric strings */
function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
/** Serialize a number for output — ensures we never emit NaN/Infinity/null */
const safe = (n: number): number => Number.isFinite(n) ? n : 0;

// ══════════════════════════════════════════════════════════════════════════════
// 1. FACTURES — Create → Track → Collect
// ══════════════════════════════════════════════════════════════════════════════

export const createInvoiceTool = ai.defineTool(
  {
    name: 'acc_createInvoice',
    description: 'Create a new invoice for a client. Calculates totals automatically.',
    inputSchema: z.object({
      companyId: z.string(),
      client: z.string(),
      clientEmail: z.string().optional(),
      items: z.array(z.object({
        description: z.string(),
        quantity: z.number().default(1),
        unitPrice: z.number(),
      })),
      currency: z.string().optional().default('EUR'),
      dueInDays: z.number().optional().default(30),
      notes: z.string().optional(),
      taxRate: z.number().optional().default(20),
    }),
    outputSchema: z.object({ invoiceId: z.string(), number: z.string(), totalHT: z.number(), totalTTC: z.number(), message: z.string() }),
  },
  async ({ companyId, client, clientEmail, items, currency, dueInDays, notes, taxRate }) => {
    const db = getFirestore();
    const id = generateId();

    // Auto-generate invoice number
    const countSnap = await db.collection(`companies/${companyId}/invoices`).count().get();
    const count = countSnap.data().count + 1;
    const number = `FAC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const totalHT = items.reduce((s, i) => s + (i.quantity ?? 1) * (i.unitPrice ?? 0), 0);
    const effectiveTaxRate = taxRate ?? 20;
    const taxAmount = Math.round(totalHT * (effectiveTaxRate / 100) * 100) / 100;
    const totalTTC = Math.round((totalHT + taxAmount) * 100) / 100;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (dueInDays ?? 30));

    await db.collection(`companies/${companyId}/invoices`).doc(id).set({
      id, number, client, clientEmail: clientEmail ?? '',
      items, currency: currency ?? 'EUR',
      totalHT, taxRate: effectiveTaxRate, taxAmount, totalTTC,
      dueDate, status: 'pending', paidAmount: 0,
      notes: notes ?? '',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });

    return { invoiceId: id, number, totalHT, totalTTC, message: `Facture ${number} creee pour ${client}: ${totalTTC} ${currency} TTC (echeance: ${dueDate.toLocaleDateString('fr-FR')}).` };
  }
);

export const updateInvoiceTool = ai.defineTool(
  {
    name: 'acc_updateInvoice',
    description: 'Update invoice status (mark as paid, cancelled, etc.) or record a payment.',
    inputSchema: z.object({
      companyId: z.string(),
      invoiceId: z.string().optional(),
      invoiceNumber: z.string().optional().describe('Invoice number like FAC-2026-0001'),
      status: z.enum(['pending', 'paid', 'partial', 'overdue', 'cancelled']).optional(),
      paidAmount: z.number().optional().describe('Amount received (for partial payments)'),
      paymentMethod: z.string().optional(),
      paymentDate: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, invoiceId, invoiceNumber, status, paidAmount, paymentMethod, paymentDate }) => {
    const db = getFirestore();
    let docRef;

    if (invoiceId) {
      docRef = db.collection(`companies/${companyId}/invoices`).doc(invoiceId);
    } else if (invoiceNumber) {
      const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get();
      if (snap.empty) return { success: false, message: `Facture "${invoiceNumber}" non trouvee.` };
      docRef = snap.docs[0].ref;
    } else {
      return { success: false, message: 'ID ou numero de facture requis.' };
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (status) updates['status'] = status;
    if (paidAmount !== undefined) updates['paidAmount'] = paidAmount;

    // Record payment
    if (paidAmount || status === 'paid') {
      const paymentId = generateId();
      await db.collection(`companies/${companyId}/payments`).doc(paymentId).set({
        invoiceId: docRef.id, amount: paidAmount ?? 0,
        method: paymentMethod ?? 'virement', date: paymentDate ?? new Date().toISOString().split('T')[0],
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await docRef.update(updates);
    return { success: true, message: `Facture mise a jour${status ? ` → ${status}` : ''}${paidAmount ? ` (${paidAmount} recu)` : ''}.` };
  }
);

export const sendInvoiceTool = ai.defineTool(
  {
    name: 'acc_sendInvoice',
    description: 'Send an invoice to the client by email. Optional toEmail override for one-shot custom recipient (does NOT modify client record).',
    inputSchema: z.object({
      companyId: z.string(),
      invoiceId: z.string().optional(),
      invoiceNumber: z.string().optional(),
      message: z.string().optional(),
      toEmail: z.string().email().optional().describe('Override recipient email for this send only — does not save to client record'),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, invoiceId, invoiceNumber, message, toEmail }) => {
    const db = getFirestore();
    let invoiceData: Record<string, unknown> | undefined;
    let docId = invoiceId ?? '';

    if (invoiceId) {
      const doc = await db.collection(`companies/${companyId}/invoices`).doc(invoiceId).get();
      if (doc.exists) invoiceData = doc.data() as Record<string, unknown>;
    } else if (invoiceNumber) {
      const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get();
      if (!snap.empty) { invoiceData = snap.docs[0].data() as Record<string, unknown>; docId = snap.docs[0].id; }
    }

    if (!invoiceData) return { success: false, message: 'Facture non trouvee.' };

    // Priorité : toEmail override > clientEmail dans la fiche
    const clientEmail = (invoiceData['clientEmail'] as string) ?? '';
    const recipientEmail = (toEmail && toEmail.trim()) ? toEmail.trim() : clientEmail;
    if (!recipientEmail) return { success: false, message: `Pas d'email pour le client "${invoiceData['client']}". Précisez "toEmail" ou ajoutez un email à la fiche client.` };

    // Generate invoice content
    const inv = invoiceData;
    let companyName = 'Orlode';
    let companyAddr = '';
    try { const c = await db.collection('companies').doc(companyId).get(); companyName = (c.data()?.['name'] as string) ?? companyName; companyAddr = (c.data()?.['address'] as string) ?? ''; } catch {}

    const items = (inv['items'] as Array<{ description: string; quantity: number; unitPrice: number }>) ?? [];
    const itemsHtml = items.map(it =>
      `<tr><td style="padding:8px;border-bottom:1px solid #eee">${it.description}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.quantity ?? 1}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${(it.unitPrice ?? 0).toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${((it.quantity ?? 1) * (it.unitPrice ?? 0)).toFixed(2)}</td></tr>`
    ).join('');

    const due = ((inv['dueDate'] as { toDate?: () => Date })?.toDate?.() ?? new Date()).toLocaleDateString('fr-FR');
    const cur = (inv['currency'] as string) ?? 'EUR';

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
      <tr><td></td><td style="text-align:right;padding:4px 8px"><strong>Sous-total HT:</strong></td><td style="text-align:right;padding:4px 8px">${(inv['totalHT'] as number ?? 0).toFixed(2)} ${cur}</td></tr>
      <tr><td></td><td style="text-align:right;padding:4px 8px">TVA (${inv['taxRate'] ?? 20}%):</td><td style="text-align:right;padding:4px 8px">${(inv['taxAmount'] as number ?? 0).toFixed(2)} ${cur}</td></tr>
      <tr><td></td><td style="text-align:right;padding:8px;border-top:2px solid #1e40af"><strong style="font-size:16px">TOTAL TTC:</strong></td><td style="text-align:right;padding:8px;border-top:2px solid #1e40af"><strong style="font-size:16px;color:#1e40af">${(inv['totalTTC'] as number ?? 0).toFixed(2)} ${cur}</strong></td></tr>
    </table>
    ${inv['notes'] ? `<p style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#64748b">${inv['notes']}</p>` : ''}
    ${message ? `<p style="margin-top:12px;font-size:14px">${message}</p>` : ''}
    <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">Merci pour votre confiance — ${companyName}</p>
  </div>
</div>`;

    // Generate professional PDF attachment via the shared invoicePdfService
    let pdfBuffer: Buffer | null = null;
    let pdfFilename = `Facture-${inv['number'] ?? docId}.pdf`;
    try {
      const { renderInvoicePdf, loadCompanyForInvoice } = await import('../services/invoice/invoicePdfService');
      const companyData = await loadCompanyForInvoice(companyId);
      const isQuote = (inv['docType'] === 'quote') || /^DEV-/i.test(String(inv['number'] ?? ''));
      pdfFilename = `${isQuote ? 'Devis' : 'Facture'}-${inv['number'] ?? docId}.pdf`;
      pdfBuffer = await renderInvoicePdf(companyData, {
        id: docId,
        number: inv['number'] as string,
        clientName: (inv['client'] as string) ?? 'Client',
        clientEmail: clientEmail || recipientEmail,
        items: ((inv['items'] as Array<{ description: string; quantity: number; unitPrice: number }>) ?? []).map(it => ({
          name: it.description, quantity: it.quantity ?? 1, unitPrice: it.unitPrice ?? 0,
        })),
        totalHT: inv['totalHT'] as number ?? 0,
        taxRate: inv['taxRate'] as number ?? 0,
        taxAmount: inv['taxAmount'] as number ?? 0,
        totalTTC: inv['totalTTC'] as number ?? 0,
        subtotal: inv['totalTTC'] as number ?? 0,
        currency: cur,
        status: (inv['status'] as string) ?? 'pending',
        createdAt: inv['createdAt'] as any,
        dueDate: inv['dueDate'] as any,
        docType: isQuote ? 'quote' : 'invoice',
        validUntil: isQuote && inv['validUntil'] ? String(inv['validUntil']) : undefined,
        notes: inv['notes'] as string,
      });
    } catch (err) {
      logger.warn('[sendInvoice] PDF generation failed, sending HTML only', { error: String(err) });
    }

    // Send via the shared sendEmail service (auto-brands from with company name + handles Gmail/Resend fallback)
    const isQuote = (inv['docType'] === 'quote') || /^DEV-/i.test(String(inv['number'] ?? ''));
    const docLabel = isQuote ? 'Devis' : 'Facture';
    try {
      const { sendEmail } = await import('../services/email/emailService');
      await sendEmail({
        to: recipientEmail,
        companyId,
        subject: `${docLabel} ${inv['number']} — ${(inv['totalTTC'] as number ?? 0).toFixed(2)} ${cur}`,
        html: emailHtml,
        attachments: pdfBuffer ? [{ filename: pdfFilename, content: pdfBuffer }] : undefined,
      });
      logger.info('[sendInvoice] Email sent', { invoiceNumber: inv['number'], to: recipientEmail, hasPdf: !!pdfBuffer });
    } catch (err) {
      logger.error('[sendInvoice] Email send failed', { error: String(err), to: recipientEmail });
      return { success: false, message: `Echec de l'envoi a ${recipientEmail} : ${(err as Error).message ?? 'erreur inconnue'}` };
    }

    // Mark as sent
    await db.collection(`companies/${companyId}/invoices`).doc(docId).update({
      sentAt: FieldValue.serverTimestamp(), sentCount: FieldValue.increment(1), status: 'sent',
    });

    // Save email reference
    await db.collection(`companies/${companyId}/invoiceEmails`).add({
      invoiceId: docId, invoiceNumber: inv['number'], recipient: recipientEmail,
      subject: `${docLabel} ${inv['number']}`, htmlContent: emailHtml,
      hasPdfAttachment: !!pdfBuffer,
      sentAt: new Date(),
    });

    return { success: true, message: `${docLabel} ${inv['number']} envoye a ${recipientEmail}${pdfBuffer ? ' avec PDF attache' : ''} (${(inv['totalTTC'] as number ?? 0).toFixed(2)} ${cur}).` };
  }
);

export const sendReminderTool = ai.defineTool(
  {
    name: 'acc_sendPaymentReminder',
    description: 'Send a payment reminder for overdue invoices. Can target specific invoice or all overdue.',
    inputSchema: z.object({
      companyId: z.string(),
      invoiceNumber: z.string().optional().describe('Specific invoice, or omit for all overdue'),
      tone: z.enum(['gentle', 'firm', 'urgent']).optional().default('gentle'),
    }),
    outputSchema: z.object({
      remindersSent: z.number(),
      details: z.array(z.object({ invoice: z.string(), client: z.string(), amount: z.number(), daysOverdue: z.number() })),
      message: z.string(),
    }),
  },
  async ({ companyId, invoiceNumber, tone }) => {
    const db = getFirestore();
    const today = new Date();
    let docs;

    if (invoiceNumber) {
      const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get();
      docs = snap.docs;
    } else {
      const snap = await db.collection(`companies/${companyId}/invoices`).where('status', '==', 'pending').limit(50).get();
      docs = snap.docs.filter(d => {
        const due = (d.data()['dueDate'] as { toDate?: () => Date })?.toDate?.() ?? new Date(d.data()['dueDate'] as string);
        return due.getTime() < today.getTime();
      });
    }

    const details = docs.map(d => {
      const data = d.data();
      const due = (data['dueDate'] as { toDate?: () => Date })?.toDate?.() ?? new Date(data['dueDate'] as string);
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
      return {
        invoice: (data['number'] as string) ?? d.id,
        client: (data['client'] as string) ?? '',
        amount: (data['totalTTC'] as number) ?? (data['amount'] as number) ?? 0,
        daysOverdue: Math.max(0, daysOverdue),
      };
    });

    // Generate reminder text
    if (details.length > 0) {
      const toneText = tone === 'urgent' ? 'URGENT' : tone === 'firm' ? 'Ferme' : 'Cordial';
      // Mark reminders sent
      for (const d of docs) {
        await d.ref.update({ lastReminderAt: FieldValue.serverTimestamp(), reminderCount: FieldValue.increment(1), status: 'overdue' });
      }
    }

    const total = details.reduce((s, d) => s + d.amount, 0);
    return {
      remindersSent: details.length,
      details,
      message: details.length > 0
        ? `${details.length} rappel(s) envoye(s) (${tone}). Total impaye: ${total.toFixed(2)} EUR.`
        : 'Aucune facture en retard. Tout est a jour !',
    };
  }
);

export const getInvoicesTool = ai.defineTool(
  {
    name: 'acc_getInvoices',
    description: 'List invoices with status, amounts, due dates. Filter by status.',
    inputSchema: z.object({
      companyId: z.string(),
      status: z.enum(['all', 'pending', 'paid', 'overdue', 'partial', 'cancelled']).optional().default('all'),
      limit: z.number().optional().default(20),
    }),
    outputSchema: z.object({
      invoices: z.array(z.object({
        id: z.string(), number: z.string(), client: z.string(),
        totalTTC: z.number(), currency: z.string(), dueDate: z.string(),
        status: z.string(), daysOverdue: z.number().optional(),
      })),
      totalPending: z.number(), totalOverdue: z.number(), count: z.number(),
    }),
  },
  async ({ companyId, status, limit }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/invoices`) as FirebaseFirestore.Query;
    if (status !== 'all') q = q.where('status', '==', status);
    const snap = await q.limit(limit ?? 20).get();
    const today = Date.now();

    const invoices = snap.docs.map(d => {
      const data = d.data();
      const due = (data['dueDate'] as { toDate?: () => Date })?.toDate?.() ?? new Date(data['dueDate'] as string ?? Date.now());
      const daysOverdue = due.getTime() < today && data['status'] !== 'paid' ? Math.floor((today - due.getTime()) / 86400000) : undefined;
      return {
        id: d.id, number: (data['number'] as string) ?? d.id.slice(0, 8),
        client: (data['client'] as string) ?? '',
        totalTTC: safe(num(data['totalTTC'] ?? data['amount'] ?? data['total'])),
        currency: (data['currency'] as string) ?? 'XOF', dueDate: due.toISOString().split('T')[0],
        status: (data['status'] as string) ?? 'pending', daysOverdue,
      };
    });

    return {
      invoices,
      totalPending: safe(invoices.filter(i => i.status === 'pending').reduce((s, i) => s + num(i.totalTTC), 0)),
      totalOverdue: safe(invoices.filter(i => (i.daysOverdue ?? 0) > 0).reduce((s, i) => s + num(i.totalTTC), 0)),
      count: invoices.length,
    };
  }
);

export const getPaymentHistoryTool = ai.defineTool(
  {
    name: 'acc_getPaymentHistory',
    description: 'Get payment history — all received payments with dates, amounts, methods.',
    inputSchema: z.object({ companyId: z.string(), limit: z.number().optional().default(20) }),
    outputSchema: z.object({
      payments: z.array(z.object({ id: z.string(), invoiceId: z.string(), amount: z.number(), method: z.string(), date: z.string() })),
      totalReceived: z.number(),
    }),
  },
  async ({ companyId, limit }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/payments`).limit(limit ?? 20).get();
    const payments = snap.docs.map(d => {
      const x = d.data();
      return { id: d.id, invoiceId: (x['invoiceId'] as string) ?? '', amount: (x['amount'] as number) ?? 0, method: (x['method'] as string) ?? '', date: (x['date'] as string) ?? '' };
    });
    return { payments, totalReceived: payments.reduce((s, p) => s + p.amount, 0) };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. NOTES DE FRAIS — Submit → Review → Track
// ══════════════════════════════════════════════════════════════════════════════

export const submitExpenseTool = ai.defineTool(
  {
    name: 'acc_submitExpense',
    description: 'Submit an expense report for approval.',
    inputSchema: z.object({
      companyId: z.string(), userId: z.string(),
      amount: z.number(), currency: z.string().optional().default('EUR'),
      category: z.enum(['transport', 'repas', 'hebergement', 'materiel', 'logiciel', 'formation', 'autre']).default('autre'),
      description: z.string(), date: z.string().optional(),
      receipt: z.string().optional().describe('Receipt reference or URL'),
    }),
    outputSchema: z.object({ expenseId: z.string(), message: z.string() }),
  },
  async ({ companyId, userId, amount, currency, category, description, date, receipt }) => {
    const db = getFirestore();
    const id = generateId();
    let empName = '';
    try { const u = await db.collection('users').doc(userId).get(); empName = (u.data()?.['displayName'] as string) ?? ''; } catch {}

    await db.collection(`companies/${companyId}/expenses`).doc(id).set({
      id, userId, submittedBy: empName || userId,
      amount, currency: currency ?? 'EUR', category, description,
      date: date ?? new Date().toISOString().split('T')[0],
      receipt: receipt ?? null, status: 'pending',
      submittedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
    });

    return { expenseId: id, message: `Note de frais #${id.slice(0, 8)} soumise: ${amount} ${currency} (${category}) — en attente d'approbation.` };
  }
);

export const reviewExpenseTool = ai.defineTool(
  {
    name: 'acc_reviewExpense',
    description: 'Approve or reject an expense report. Manager/admin only.',
    inputSchema: z.object({
      companyId: z.string(),
      expenseId: z.string(),
      decision: z.enum(['approved', 'rejected']),
      comment: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, expenseId, decision, comment }) => {
    const db = getFirestore();
    const ref = db.collection(`companies/${companyId}/expenses`).doc(expenseId);
    const doc = await ref.get();
    if (!doc.exists) return { success: false, message: 'Note de frais non trouvee.' };

    await ref.update({
      status: decision, reviewComment: comment ?? '', reviewedAt: FieldValue.serverTimestamp(),
    });

    const data = doc.data()!;
    return { success: true, message: `Note de frais de ${data['submittedBy']} (${data['amount']} ${data['currency']}) ${decision === 'approved' ? 'approuvee' : 'rejetee'}${comment ? ` — ${comment}` : ''}.` };
  }
);

export const getExpenseReportsTool = ai.defineTool(
  {
    name: 'acc_getExpenseReports',
    description: 'List expense reports with filters.',
    inputSchema: z.object({
      companyId: z.string(), userId: z.string().optional(),
      status: z.enum(['all', 'pending', 'approved', 'rejected']).optional().default('all'),
    }),
    outputSchema: z.object({
      expenses: z.array(z.object({ id: z.string(), submittedBy: z.string(), amount: z.number(), currency: z.string(), category: z.string(), description: z.string(), status: z.string(), date: z.string() })),
      totalAmount: z.number(), pendingCount: z.number(),
    }),
  },
  async ({ companyId, userId, status }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/expenses`) as FirebaseFirestore.Query;
    if (userId) q = q.where('userId', '==', userId);
    if (status !== 'all') q = q.where('status', '==', status);
    const snap = await q.limit(50).get();

    const expenses = snap.docs.map(d => {
      const x = d.data();
      return { id: d.id, submittedBy: (x['submittedBy'] as string) ?? '', amount: (x['amount'] as number) ?? 0, currency: (x['currency'] as string) ?? 'EUR', category: (x['category'] as string) ?? '', description: (x['description'] as string) ?? '', status: (x['status'] as string) ?? '', date: (x['date'] as string) ?? '' };
    });

    return { expenses, totalAmount: expenses.reduce((s, e) => s + e.amount, 0), pendingCount: expenses.filter(e => e.status === 'pending').length };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. TRESORERIE — Track → Forecast → Alert
// ══════════════════════════════════════════════════════════════════════════════

export const getCashFlowTool = ai.defineTool(
  {
    name: 'acc_getCashFlow',
    description: 'Get current cash flow summary — inflows, outflows, balance.',
    inputSchema: z.object({ companyId: z.string(), period: z.enum(['month', 'quarter', 'year']).optional().default('month') }),
    outputSchema: z.object({ period: z.string(), inflows: z.number(), outflows: z.number(), balance: z.number(), currency: z.string(), alerts: z.array(z.string()) }),
  },
  async ({ companyId, period }) => {
    const db = getFirestore();

    // Calculate from invoices + expenses
    const invoiceSnap = await db.collection(`companies/${companyId}/invoices`).where('status', '==', 'paid').limit(200).get();
    const expenseSnap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(200).get();

    const inflows = safe(invoiceSnap.docs.reduce((s, d) => s + num(d.data()['totalTTC'] ?? d.data()['amount']), 0));
    const outflows = safe(expenseSnap.docs.reduce((s, d) => s + num(d.data()['amount']), 0));
    const balance = safe(inflows - outflows);

    const alerts: string[] = [];
    if (balance < 0) alerts.push('Tresorerie negative ! Action urgente requise.');

    // Check overdue invoices
    const pendingSnap = await db.collection(`companies/${companyId}/invoices`).where('status', '==', 'pending').limit(50).get();
    const overdueCount = pendingSnap.docs.filter(d => {
      const due = (d.data()['dueDate'] as { toDate?: () => Date })?.toDate?.() ?? new Date(d.data()['dueDate'] as string);
      return due.getTime() < Date.now();
    }).length;
    if (overdueCount > 0) alerts.push(`${overdueCount} facture(s) en retard de paiement.`);

    const pendingExpenses = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'pending').count().get();
    if (pendingExpenses.data().count > 0) alerts.push(`${pendingExpenses.data().count} note(s) de frais en attente.`);

    return { period: period ?? 'month', inflows, outflows, balance, currency: 'EUR', alerts };
  }
);

export const forecastCashFlowTool = ai.defineTool(
  {
    name: 'acc_forecastCashFlow',
    description: 'Forecast cash flow for the next 3 months based on current data and trends.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      forecast: z.array(z.object({ month: z.string(), expectedInflows: z.number(), expectedOutflows: z.number(), projectedBalance: z.number() })),
      riskLevel: z.string(), recommendations: z.array(z.string()),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();

    // Get current data
    const invoiceSnap = await db.collection(`companies/${companyId}/invoices`).limit(100).get();
    const expenseSnap = await db.collection(`companies/${companyId}/expenses`).limit(100).get();

    // Coerce to real numbers — Firestore can store strings/mixed types
    const num = (v: unknown): number => {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : 0;
      return Number.isFinite(n) ? n : 0;
    };

    const totalInvoiced = invoiceSnap.docs.reduce((s, d) => s + num(d.data()['totalTTC'] ?? d.data()['amount'] ?? d.data()['total']), 0);
    const totalExpenses = expenseSnap.docs.reduce((s, d) => s + num(d.data()['amount']), 0);
    const avgMonthlyIn = totalInvoiced / Math.max(1, 3); // rough average
    const avgMonthlyOut = totalExpenses / Math.max(1, 3);

    const pendingIn = invoiceSnap.docs.filter(d => d.data()['status'] === 'pending')
      .reduce((s, d) => s + num(d.data()['totalTTC'] ?? d.data()['amount'] ?? d.data()['total']), 0);

    const forecast: Array<{ month: string; expectedInflows: number; expectedOutflows: number; projectedBalance: number }> = [];
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
    const recommendations: string[] = [];
    if (pendingIn > 0) recommendations.push(`Relancer ${pendingIn.toFixed(0)} EUR de factures en attente.`);
    if (riskLevel === 'high') recommendations.push('Reduire les depenses non essentielles immediatement.');
    if (riskLevel === 'medium') recommendations.push('Surveiller la tresorerie de pres les 2 prochains mois.');
    if (riskLevel === 'low') recommendations.push('Situation financiere saine. Envisager des investissements.');

    return { forecast, riskLevel, recommendations };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. BUDGET — Existant, ameliore
// ══════════════════════════════════════════════════════════════════════════════

export const getBudgetStatusTool = ai.defineTool(
  {
    name: 'acc_getBudgetStatus',
    description: 'Get budget vs actual spending by department or category.',
    inputSchema: z.object({ companyId: z.string(), department: z.string().optional(), year: z.number().optional() }),
    outputSchema: z.object({
      year: z.number(),
      budgets: z.array(z.object({ category: z.string(), budgeted: z.number(), actual: z.number(), remaining: z.number(), percentage: z.number(), status: z.string() })),
    }),
  },
  async ({ companyId, department, year }) => {
    const db = getFirestore();
    const y = year ?? new Date().getFullYear();
    let q = db.collection(`companies/${companyId}/budgets`).where('year', '==', y) as FirebaseFirestore.Query;
    if (department) q = q.where('department', '==', department);
    const snap = await q.limit(20).get();

    const budgets = snap.docs.map(d => {
      const data = d.data();
      const budgeted = (data['budgeted'] as number) ?? 0;
      const actual = (data['actual'] as number) ?? 0;
      const pct = budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0;
      return { category: (data['category'] as string) ?? '', budgeted, actual, remaining: budgeted - actual, percentage: pct, status: pct > 100 ? 'over_budget' : pct > 80 ? 'warning' : 'on_track' };
    });

    if (budgets.length === 0) budgets.push({ category: 'Pas de donnees budget', budgeted: 0, actual: 0, remaining: 0, percentage: 0, status: 'not_configured' });
    return { year: y, budgets };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 5. DETAILS + DOCUMENTS + CONTROLE (V1+ ajouts)
// ══════════════════════════════════════════════════════════════════════════════

export const getInvoiceByIdTool = ai.defineTool(
  {
    name: 'acc_getInvoiceById',
    description: 'Get full details of a specific invoice by ID or number.',
    inputSchema: z.object({ companyId: z.string(), invoiceId: z.string().optional(), invoiceNumber: z.string().optional() }),
    outputSchema: z.object({
      found: z.boolean(), id: z.string(), number: z.string(), client: z.string(), clientEmail: z.string(),
      items: z.array(z.object({ description: z.string(), quantity: z.number(), unitPrice: z.number() })),
      totalHT: z.number(), taxRate: z.number(), taxAmount: z.number(), totalTTC: z.number(),
      paidAmount: z.number(), balanceDue: z.number(),
      status: z.string(), dueDate: z.string(), createdAt: z.string(),
      sentAt: z.string().optional(), reminderCount: z.number(), notes: z.string(),
    }),
  },
  async ({ companyId, invoiceId, invoiceNumber }) => {
    const db = getFirestore();
    let data: Record<string, unknown> | undefined;
    let docId = '';

    if (invoiceId) {
      const doc = await db.collection(`companies/${companyId}/invoices`).doc(invoiceId).get();
      if (doc.exists) { data = doc.data() as Record<string, unknown>; docId = doc.id; }
    } else if (invoiceNumber) {
      const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get();
      if (!snap.empty) { data = snap.docs[0].data() as Record<string, unknown>; docId = snap.docs[0].id; }
    }

    if (!data) return { found: false, id: '', number: '', client: '', clientEmail: '', items: [], totalHT: 0, taxRate: 0, taxAmount: 0, totalTTC: 0, paidAmount: 0, balanceDue: 0, status: '', dueDate: '', createdAt: '', reminderCount: 0, notes: '' };

    const totalTTC = (data['totalTTC'] as number) ?? 0;
    const paidAmount = (data['paidAmount'] as number) ?? 0;

    return {
      found: true, id: docId, number: (data['number'] as string) ?? '',
      client: (data['client'] as string) ?? '', clientEmail: (data['clientEmail'] as string) ?? '',
      items: (data['items'] as Array<{ description: string; quantity: number; unitPrice: number }>) ?? [],
      totalHT: (data['totalHT'] as number) ?? 0, taxRate: (data['taxRate'] as number) ?? 20,
      taxAmount: (data['taxAmount'] as number) ?? 0, totalTTC, paidAmount, balanceDue: totalTTC - paidAmount,
      status: (data['status'] as string) ?? '', dueDate: ((data['dueDate'] as { toDate?: () => Date })?.toDate?.() ?? new Date()).toISOString().split('T')[0],
      createdAt: ((data['createdAt'] as { toDate?: () => Date })?.toDate?.() ?? new Date()).toISOString(),
      sentAt: (data['sentAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString(),
      reminderCount: (data['reminderCount'] as number) ?? 0, notes: (data['notes'] as string) ?? '',
    };
  }
);

export const voidInvoiceTool = ai.defineTool(
  {
    name: 'acc_voidInvoice',
    description: 'Void/cancel an invoice. Creates a credit note reference. Use for errors or cancellations.',
    inputSchema: z.object({ companyId: z.string(), invoiceNumber: z.string(), reason: z.string() }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, invoiceNumber, reason }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get();
    if (snap.empty) return { success: false, message: `Facture "${invoiceNumber}" non trouvee.` };

    const doc = snap.docs[0];
    const data = doc.data();
    if (data['status'] === 'void') return { success: false, message: 'Cette facture est deja annulee.' };

    await doc.ref.update({
      status: 'void', voidedAt: FieldValue.serverTimestamp(), voidReason: reason,
      previousStatus: data['status'],
    });

    return { success: true, message: `Facture ${invoiceNumber} annulee. Motif: ${reason}. Montant: ${data['totalTTC']} ${data['currency']}.` };
  }
);

export const generateInvoicePdfTool = ai.defineTool(
  {
    name: 'acc_generateInvoicePdf',
    description: 'Generate a formatted invoice document (text version ready for PDF). Use when user asks to download, print, or send the official invoice.',
    inputSchema: z.object({ companyId: z.string(), invoiceNumber: z.string() }),
    outputSchema: z.object({ success: z.boolean(), content: z.string(), message: z.string() }),
  },
  async ({ companyId, invoiceNumber }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/invoices`).where('number', '==', invoiceNumber).limit(1).get();
    if (snap.empty) return { success: false, content: '', message: 'Facture non trouvee.' };

    const inv = snap.docs[0].data();
    let companyName = 'Orlode';
    let companyAddr = '';
    try { const c = await db.collection('companies').doc(companyId).get(); companyName = (c.data()?.['name'] as string) ?? companyName; companyAddr = (c.data()?.['address'] as string) ?? ''; } catch {}

    const items = (inv['items'] as Array<{ description: string; quantity: number; unitPrice: number }>) ?? [];
    const itemsText = items.map((it, i) => `  ${i + 1}. ${it.description} — ${it.quantity} x ${it.unitPrice} EUR = ${it.quantity * it.unitPrice} EUR`).join('\n');

    const due = ((inv['dueDate'] as { toDate?: () => Date })?.toDate?.() ?? new Date()).toLocaleDateString('fr-FR');

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
Sous-total HT:    ${(inv['totalHT'] as number)?.toFixed(2)} EUR
TVA (${inv['taxRate'] ?? 20}%):       ${(inv['taxAmount'] as number)?.toFixed(2)} EUR
───────────────────────────────────────────
TOTAL TTC:        ${(inv['totalTTC'] as number)?.toFixed(2)} EUR
───────────────────────────────────────────

${inv['notes'] ? `Notes: ${inv['notes']}` : ''}

Merci pour votre confiance.
${companyName}
`.trim();

    return { success: true, content, message: `Facture ${invoiceNumber} generee (${(inv['totalTTC'] as number)?.toFixed(2)} EUR).` };
  }
);

export const getExpenseByIdTool = ai.defineTool(
  {
    name: 'acc_getExpenseById',
    description: 'Get full details of a specific expense report.',
    inputSchema: z.object({ companyId: z.string(), expenseId: z.string() }),
    outputSchema: z.object({
      found: z.boolean(), id: z.string(), submittedBy: z.string(), amount: z.number(), currency: z.string(),
      category: z.string(), description: z.string(), date: z.string(), status: z.string(),
      receipt: z.string().optional(), reviewComment: z.string().optional(),
    }),
  },
  async ({ companyId, expenseId }) => {
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/expenses`).doc(expenseId).get();
    if (!doc.exists) return { found: false, id: '', submittedBy: '', amount: 0, currency: '', category: '', description: '', date: '', status: '' };
    const x = doc.data()!;
    return {
      found: true, id: doc.id, submittedBy: (x['submittedBy'] as string) ?? '',
      amount: (x['amount'] as number) ?? 0, currency: (x['currency'] as string) ?? 'EUR',
      category: (x['category'] as string) ?? '', description: (x['description'] as string) ?? '',
      date: (x['date'] as string) ?? '', status: (x['status'] as string) ?? '',
      receipt: x['receipt'] as string | undefined, reviewComment: x['reviewComment'] as string | undefined,
    };
  }
);

export const getDashboardSummaryTool = ai.defineTool(
  {
    name: 'acc_getDashboardSummary',
    description: 'Get a complete financial dashboard summary: total invoiced, collected, overdue, expenses, net balance this month.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalInvoiced: z.number(), totalCollected: z.number(), totalOverdue: z.number(),
      totalExpenses: z.number(), pendingExpenses: z.number(),
      netBalance: z.number(), invoiceCount: z.number(), overdueCount: z.number(),
      currency: z.string(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const invSnap = await db.collection(`companies/${companyId}/invoices`).limit(200).get();
    const expSnap = await db.collection(`companies/${companyId}/expenses`).limit(200).get();

    let totalInvoiced = 0, totalCollected = 0, totalOverdue = 0, overdueCount = 0;
    const today = Date.now();

    invSnap.docs.forEach(d => {
      const data = d.data();
      const amount = num(data['totalTTC'] ?? data['amount'] ?? data['total']);
      totalInvoiced += amount;
      if (data['status'] === 'paid') totalCollected += amount;
      const due = (data['dueDate'] as { toDate?: () => Date })?.toDate?.() ?? new Date(data['dueDate'] as string ?? Date.now());
      if (due.getTime() < today && data['status'] !== 'paid' && data['status'] !== 'void') {
        totalOverdue += amount;
        overdueCount++;
      }
    });

    let totalExpenses = 0, pendingExpenses = 0;
    expSnap.docs.forEach(d => {
      const data = d.data();
      const amount = num(data['amount']);
      if (data['status'] === 'approved') totalExpenses += amount;
      if (data['status'] === 'pending') pendingExpenses += amount;
    });

    return {
      totalInvoiced: safe(Math.round(totalInvoiced * 100) / 100),
      totalCollected: safe(Math.round(totalCollected * 100) / 100),
      totalOverdue: safe(Math.round(totalOverdue * 100) / 100),
      totalExpenses: safe(Math.round(totalExpenses * 100) / 100),
      pendingExpenses: safe(Math.round(pendingExpenses * 100) / 100),
      netBalance: safe(Math.round((totalCollected - totalExpenses) * 100) / 100),
      invoiceCount: invSnap.size, overdueCount, currency: 'XOF',
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 6. PHASE 2 — Multi-devises, TVA, Rapprochement, Export, Auto-relance
// ══════════════════════════════════════════════════════════════════════════════

const EXCHANGE_RATES: Record<string, number> = {
  EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.97, CAD: 1.47, XOF: 655.96, XAF: 655.96,
  MAD: 10.8, TND: 3.35, DZD: 145, SAR: 4.05, AED: 3.97, JPY: 163, CNY: 7.8,
};

export const convertCurrencyTool = ai.defineTool(
  {
    name: 'acc_convertCurrency',
    description: 'Convert an amount between currencies. Supports EUR, USD, GBP, CHF, CAD, XOF, XAF, MAD, TND, DZD, SAR, AED, JPY, CNY.',
    inputSchema: z.object({
      amount: z.number(), from: z.string().default('EUR'), to: z.string().default('USD'),
    }),
    outputSchema: z.object({ original: z.number(), converted: z.number(), from: z.string(), to: z.string(), rate: z.number() }),
  },
  async ({ amount, from, to }) => {
    const fromRate = EXCHANGE_RATES[from.toUpperCase()] ?? 1;
    const toRate = EXCHANGE_RATES[to.toUpperCase()] ?? 1;
    const inEUR = amount / fromRate;
    const converted = Math.round(inEUR * toRate * 100) / 100;
    const rate = Math.round((toRate / fromRate) * 10000) / 10000;
    return { original: amount, converted, from: from.toUpperCase(), to: to.toUpperCase(), rate };
  }
);

export const createMultiCurrencyInvoiceTool = ai.defineTool(
  {
    name: 'acc_createMultiCurrencyInvoice',
    description: 'Create an invoice in any currency. Auto-calculates EUR equivalent for accounting.',
    inputSchema: z.object({
      companyId: z.string(), client: z.string(), clientEmail: z.string().optional(),
      items: z.array(z.object({ description: z.string(), quantity: z.number().default(1), unitPrice: z.number() })),
      currency: z.string().default('EUR'), dueInDays: z.number().optional().default(30),
      taxRate: z.number().optional().default(20), notes: z.string().optional(),
    }),
    outputSchema: z.object({ invoiceId: z.string(), number: z.string(), totalTTC: z.number(), currency: z.string(), eurEquivalent: z.number(), message: z.string() }),
  },
  async ({ companyId, client, clientEmail, items, currency, dueInDays, taxRate, notes }) => {
    const result = await createInvoiceTool({ companyId, client, clientEmail, items, currency, dueInDays, taxRate, notes });
    const cur = currency.toUpperCase();
    const rate = EXCHANGE_RATES[cur] ?? 1;
    const eurEquivalent = Math.round((result.totalTTC / rate) * 100) / 100;

    // Store EUR equivalent
    const db = getFirestore();
    await db.collection(`companies/${companyId}/invoices`).doc(result.invoiceId).update({ eurEquivalent, originalCurrency: cur });

    return { ...result, currency: cur, eurEquivalent, message: `${result.message} (Equivalent EUR: ${eurEquivalent} EUR)` };
  }
);

export const vatReportTool = ai.defineTool(
  {
    name: 'acc_getVATReport',
    description: 'Generate VAT/TVA report for a period — collected TVA, deductible TVA, net TVA due.',
    inputSchema: z.object({
      companyId: z.string(),
      period: z.enum(['month', 'quarter', 'year']).default('quarter'),
      year: z.number().optional(),
      quarter: z.number().optional(),
    }),
    outputSchema: z.object({
      period: z.string(), vatCollected: z.number(), vatDeductible: z.number(), vatDue: z.number(),
      invoiceCount: z.number(), expenseCount: z.number(), currency: z.string(),
      breakdown: z.array(z.object({ rate: z.number(), base: z.number(), vat: z.number() })),
    }),
  },
  async ({ companyId, period, year, quarter }) => {
    const db = getFirestore();
    const y = year ?? new Date().getFullYear();
    const periodLabel = period === 'quarter' ? `Q${quarter ?? Math.ceil((new Date().getMonth() + 1) / 3)} ${y}` : `${period} ${y}`;

    // TVA collectee (sur factures)
    const invSnap = await db.collection(`companies/${companyId}/invoices`).limit(500).get();
    let vatCollected = 0;
    const rateBreakdown = new Map<number, { base: number; vat: number }>();

    invSnap.docs.forEach(d => {
      const data = d.data();
      if (data['status'] === 'void') return;
      const taxRate = num(data['taxRate'], 20);
      const taxAmount = num(data['taxAmount']);
      const totalHT = num(data['totalHT']);
      vatCollected += taxAmount;
      const existing = rateBreakdown.get(taxRate) ?? { base: 0, vat: 0 };
      rateBreakdown.set(taxRate, { base: existing.base + totalHT, vat: existing.vat + taxAmount });
    });

    // TVA deductible (sur depenses approuvees — estimation 20%)
    const expSnap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(500).get();
    let vatDeductible = 0;
    expSnap.docs.forEach(d => {
      const amount = num(d.data()['amount']);
      vatDeductible += Math.round(amount * 0.2 / 1.2 * 100) / 100; // Reverse TVA from TTC
    });

    const breakdown = Array.from(rateBreakdown.entries()).map(([rate, { base, vat }]) => ({
      rate, base: Math.round(base * 100) / 100, vat: Math.round(vat * 100) / 100,
    }));

    return {
      period: periodLabel,
      vatCollected: safe(Math.round(vatCollected * 100) / 100),
      vatDeductible: safe(Math.round(vatDeductible * 100) / 100),
      vatDue: safe(Math.round((vatCollected - vatDeductible) * 100) / 100),
      invoiceCount: invSnap.size, expenseCount: expSnap.size, currency: 'XOF',
      breakdown: breakdown.map(b => ({ rate: safe(b.rate), base: safe(b.base), vat: safe(b.vat) })),
    };
  }
);

export const bankReconciliationTool = ai.defineTool(
  {
    name: 'acc_bankReconciliation',
    description: 'Bank reconciliation — compare invoices/payments with bank transactions to find discrepancies.',
    inputSchema: z.object({
      companyId: z.string(),
      bankBalance: z.number().describe('Current bank account balance'),
      bankCurrency: z.string().optional().default('EUR'),
    }),
    outputSchema: z.object({
      bankBalance: z.number(), bookBalance: z.number(), difference: z.number(),
      status: z.string(),
      unreconciledInvoices: z.array(z.object({ number: z.string(), amount: z.number(), status: z.string() })),
      unreconciledExpenses: z.array(z.object({ id: z.string(), amount: z.number(), description: z.string() })),
      recommendations: z.array(z.string()),
    }),
  },
  async ({ companyId, bankBalance, bankCurrency }) => {
    const db = getFirestore();

    // Calculate book balance
    const invSnap = await db.collection(`companies/${companyId}/invoices`).limit(500).get();
    const expSnap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(500).get();

    const totalReceived = invSnap.docs.filter(d => d.data()['status'] === 'paid').reduce((s, d) => s + num(d.data()['totalTTC']), 0);
    const totalExpenses = expSnap.docs.reduce((s, d) => s + num(d.data()['amount']), 0);
    const bookBalance = Math.round((totalReceived - totalExpenses) * 100) / 100;
    const difference = Math.round((bankBalance - bookBalance) * 100) / 100;

    // Find unreconciled items
    const unreconciledInvoices = invSnap.docs
      .filter(d => d.data()['status'] === 'paid' && !(d.data()['reconciled']))
      .slice(0, 10)
      .map(d => ({ number: (d.data()['number'] as string) ?? '', amount: (d.data()['totalTTC'] as number) ?? 0, status: 'non rapproche' }));

    const unreconciledExpenses = expSnap.docs
      .filter(d => !(d.data()['reconciled']))
      .slice(0, 10)
      .map(d => ({ id: d.id.slice(0, 8), amount: (d.data()['amount'] as number) ?? 0, description: (d.data()['description'] as string) ?? '' }));

    const recommendations: string[] = [];
    if (Math.abs(difference) > 0) {
      if (difference > 0) recommendations.push(`${difference} ${bankCurrency} en plus sur le compte — verifier les paiements non enregistres.`);
      else recommendations.push(`${Math.abs(difference)} ${bankCurrency} manquant — verifier les depenses non comptabilisees.`);
    }
    if (unreconciledInvoices.length > 0) recommendations.push(`${unreconciledInvoices.length} facture(s) payee(s) non rapprochee(s).`);
    if (unreconciledExpenses.length > 0) recommendations.push(`${unreconciledExpenses.length} depense(s) non rapprochee(s).`);

    return {
      bankBalance, bookBalance, difference,
      status: Math.abs(difference) < 1 ? 'rapproche' : Math.abs(difference) < 100 ? 'ecart_mineur' : 'ecart_significatif',
      unreconciledInvoices, unreconciledExpenses, recommendations,
    };
  }
);

export const exportFinanceTool = ai.defineTool(
  {
    name: 'acc_exportCSV',
    description: 'Export financial data as CSV format — invoices, expenses, payments, or full ledger.',
    inputSchema: z.object({
      companyId: z.string(),
      dataType: z.enum(['invoices', 'expenses', 'payments', 'ledger']).default('invoices'),
      status: z.string().optional(),
    }),
    outputSchema: z.object({ csv: z.string(), rowCount: z.number(), message: z.string() }),
  },
  async ({ companyId, dataType, status }) => {
    const db = getFirestore();
    let csv = '';
    let rowCount = 0;

    if (dataType === 'invoices') {
      csv = 'Numero;Client;Montant HT;TVA;Montant TTC;Devise;Statut;Echeance;Cree le\n';
      let q = db.collection(`companies/${companyId}/invoices`) as FirebaseFirestore.Query;
      if (status && status !== 'all') q = q.where('status', '==', status);
      const snap = await q.limit(500).get();
      snap.docs.forEach(d => {
        const x = d.data();
        const due = (x['dueDate'] as { toDate?: () => Date })?.toDate?.()?.toISOString().split('T')[0] ?? '';
        const created = (x['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString().split('T')[0] ?? '';
        csv += `${x['number'] ?? ''};${x['client'] ?? ''};${x['totalHT'] ?? 0};${x['taxAmount'] ?? 0};${x['totalTTC'] ?? 0};${x['currency'] ?? 'EUR'};${x['status'] ?? ''};${due};${created}\n`;
      });
      rowCount = snap.size;
    } else if (dataType === 'expenses') {
      csv = 'ID;Employe;Montant;Devise;Categorie;Description;Statut;Date\n';
      let q = db.collection(`companies/${companyId}/expenses`) as FirebaseFirestore.Query;
      if (status && status !== 'all') q = q.where('status', '==', status);
      const snap = await q.limit(500).get();
      snap.docs.forEach(d => {
        const x = d.data();
        csv += `${d.id.slice(0, 8)};${x['submittedBy'] ?? ''};${x['amount'] ?? 0};${x['currency'] ?? 'EUR'};${x['category'] ?? ''};${x['description'] ?? ''};${x['status'] ?? ''};${x['date'] ?? ''}\n`;
      });
      rowCount = snap.size;
    } else if (dataType === 'payments') {
      csv = 'ID;Facture;Montant;Methode;Date\n';
      const snap = await db.collection(`companies/${companyId}/payments`).limit(500).get();
      snap.docs.forEach(d => {
        const x = d.data();
        csv += `${d.id.slice(0, 8)};${x['invoiceId'] ?? ''};${x['amount'] ?? 0};${x['method'] ?? ''};${x['date'] ?? ''}\n`;
      });
      rowCount = snap.size;
    } else {
      // Full ledger
      csv = 'Date;Type;Reference;Description;Debit;Credit;Devise\n';
      const invSnap = await db.collection(`companies/${companyId}/invoices`).limit(500).get();
      const expSnap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(500).get();
      invSnap.docs.forEach(d => {
        const x = d.data();
        const date = (x['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString().split('T')[0] ?? '';
        csv += `${date};Facture;${x['number'] ?? ''};${x['client'] ?? ''};0;${x['totalTTC'] ?? 0};${x['currency'] ?? 'EUR'}\n`;
      });
      expSnap.docs.forEach(d => {
        const x = d.data();
        csv += `${x['date'] ?? ''};Depense;${d.id.slice(0, 8)};${x['description'] ?? ''};${x['amount'] ?? 0};0;${x['currency'] ?? 'EUR'}\n`;
      });
      rowCount = invSnap.size + expSnap.size;
    }

    return { csv, rowCount, message: `Export ${dataType}: ${rowCount} lignes generees (format CSV separateur ;).` };
  }
);

export const autoRelanceTool = ai.defineTool(
  {
    name: 'acc_autoRelance',
    description: 'Run automatic payment reminder schedule: J+3 gentle, J+10 firm, J+20 urgent. Processes all overdue invoices.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      processed: z.number(),
      gentle: z.array(z.object({ number: z.string(), client: z.string(), daysOverdue: z.number() })),
      firm: z.array(z.object({ number: z.string(), client: z.string(), daysOverdue: z.number() })),
      urgent: z.array(z.object({ number: z.string(), client: z.string(), daysOverdue: z.number() })),
      message: z.string(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const today = Date.now();
    const snap = await db.collection(`companies/${companyId}/invoices`).where('status', 'in', ['pending', 'overdue']).limit(200).get();

    const gentle: Array<{ number: string; client: string; daysOverdue: number }> = [];
    const firm: Array<{ number: string; client: string; daysOverdue: number }> = [];
    const urgent: Array<{ number: string; client: string; daysOverdue: number }> = [];

    for (const d of snap.docs) {
      const data = d.data();
      const due = (data['dueDate'] as { toDate?: () => Date })?.toDate?.() ?? new Date(data['dueDate'] as string ?? Date.now());
      const daysOverdue = Math.floor((today - due.getTime()) / 86400000);
      if (daysOverdue <= 0) continue;

      const entry = {
        number: (data['number'] as string) ?? d.id.slice(0, 8),
        client: (data['client'] as string) ?? '',
        daysOverdue,
      };

      const reminderCount = (data['reminderCount'] as number) ?? 0;
      let tone: 'gentle' | 'firm' | 'urgent';

      if (daysOverdue >= 20 || reminderCount >= 2) { tone = 'urgent'; urgent.push(entry); }
      else if (daysOverdue >= 10 || reminderCount >= 1) { tone = 'firm'; firm.push(entry); }
      else if (daysOverdue >= 3) { tone = 'gentle'; gentle.push(entry); }
      else continue;

      // Update invoice
      await d.ref.update({
        status: 'overdue',
        lastReminderAt: FieldValue.serverTimestamp(),
        reminderCount: FieldValue.increment(1),
        lastReminderTone: tone,
      });
    }

    const total = gentle.length + firm.length + urgent.length;
    return {
      processed: total, gentle, firm, urgent,
      message: total > 0
        ? `Auto-relance: ${gentle.length} cordial(s), ${firm.length} ferme(s), ${urgent.length} urgent(s). Total: ${total} facture(s) relancee(s).`
        : 'Aucune facture en retard necessitant une relance.',
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ALL TOOLS + FLOW
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PRO: P&L STATEMENT (Compte de résultat)
// ══════════════════════════════════════════════════════════════════════════════

export const profitLossTool = ai.defineTool(
  {
    name: 'acc_getProfitLoss',
    description: 'Generate Profit & Loss statement (Compte de résultat) — revenue, expenses, net income by period.',
    inputSchema: z.object({ companyId: z.string(), period: z.enum(['month', 'quarter', 'year']).optional().default('quarter'), year: z.number().optional() }),
    outputSchema: z.object({
      period: z.string(), revenue: z.number(), costOfSales: z.number(), grossProfit: z.number(), grossMargin: z.number(),
      operatingExpenses: z.object({ salaries: z.number(), rent: z.number(), marketing: z.number(), it: z.number(), other: z.number(), total: z.number() }),
      operatingIncome: z.number(), taxes: z.number(), netIncome: z.number(), netMargin: z.number(),
      comparison: z.object({ previousPeriod: z.number(), change: z.number(), changePercent: z.number() }).optional(),
    }),
  },
  async ({ companyId, period, year }) => {
    const db = getFirestore();
    const currentYear = year ?? new Date().getFullYear();
    const months = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;

    // Get invoices (revenue)
    const invSnap = await db.collection(`companies/${companyId}/invoices`).where('status', 'in', ['paid', 'sent', 'overdue']).limit(500).get();
    const invoices = invSnap.docs.map(d => d.data());
    const paidInvoices = invoices.filter(i => i['status'] === 'paid');
    const revenue = paidInvoices.reduce((s, i) => s + num(i['totalTTC'] ?? i['amount']), 0);

    // Get expenses
    const expSnap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(500).get();
    const expenses = expSnap.docs.map(d => d.data());
    const totalExpenses = expenses.reduce((s, e) => s + num(e['amount']), 0);

    // Categorize expenses
    const expByCat: Record<string, number> = {};
    expenses.forEach(e => { const c = (e['category'] as string) ?? 'autre'; expByCat[c] = (expByCat[c] ?? 0) + num(e['amount']); });

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
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: AGING REPORT (Créances par ancienneté)
// ══════════════════════════════════════════════════════════════════════════════

export const agingReportTool = ai.defineTool(
  {
    name: 'acc_getAgingReport',
    description: 'Accounts receivable aging report — invoices grouped by 0-30, 30-60, 60-90, 90+ days.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      buckets: z.array(z.object({ range: z.string(), count: z.number(), total: z.number(), invoices: z.array(z.object({ number: z.string(), client: z.string(), amount: z.number(), daysOverdue: z.number() })) })),
      totalOverdue: z.number(), totalOutstanding: z.number(), highestRisk: z.string(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/invoices`).where('status', 'in', ['sent', 'overdue']).limit(200).get();
    const now = Date.now();

    const buckets: Record<string, { count: number; total: number; invoices: { number: string; client: string; amount: number; daysOverdue: number }[] }> = {
      '0-30': { count: 0, total: 0, invoices: [] },
      '30-60': { count: 0, total: 0, invoices: [] },
      '60-90': { count: 0, total: 0, invoices: [] },
      '90+': { count: 0, total: 0, invoices: [] },
    };

    snap.docs.forEach(d => {
      const inv = d.data();
      const dueDate = (inv['dueDate'] as { toDate?: () => Date })?.toDate?.() ?? (inv['dueDate'] ? new Date(inv['dueDate'] as string) : new Date());
      const daysOverdue = Math.max(0, Math.round((now - dueDate.getTime()) / 86400000));
      const amount = (inv['totalTTC'] as number) ?? (inv['amount'] as number) ?? 0;
      const entry = { number: (inv['number'] as string) ?? d.id, client: (inv['client'] as string) ?? '', amount, daysOverdue };

      if (daysOverdue <= 30) { buckets['0-30'].count++; buckets['0-30'].total += amount; buckets['0-30'].invoices.push(entry); }
      else if (daysOverdue <= 60) { buckets['30-60'].count++; buckets['30-60'].total += amount; buckets['30-60'].invoices.push(entry); }
      else if (daysOverdue <= 90) { buckets['60-90'].count++; buckets['60-90'].total += amount; buckets['60-90'].invoices.push(entry); }
      else { buckets['90+'].count++; buckets['90+'].total += amount; buckets['90+'].invoices.push(entry); }
    });

    const totalOverdue = Object.values(buckets).reduce((s, b) => s + b.total, 0);
    const highestRisk = buckets['90+'].invoices.sort((a, b) => b.amount - a.amount)[0]?.client ?? '';

    return {
      buckets: Object.entries(buckets).map(([range, data]) => ({ range, ...data })),
      totalOverdue, totalOutstanding: totalOverdue,
      highestRisk: highestRisk || 'Aucun',
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: RECURRING INVOICES
// ══════════════════════════════════════════════════════════════════════════════

export const createRecurringInvoiceTool = ai.defineTool(
  {
    name: 'acc_createRecurringInvoice',
    description: 'Create a recurring invoice template — auto-generates invoices on schedule.',
    inputSchema: z.object({
      companyId: z.string(), client: z.string(), clientEmail: z.string().optional(),
      items: z.array(z.object({ description: z.string(), quantity: z.number(), unitPrice: z.number() })),
      frequency: z.enum(['monthly', 'quarterly', 'yearly']),
      startDate: z.string().optional(), taxRate: z.number().optional().default(20),
    }),
    outputSchema: z.object({ recurringId: z.string(), frequency: z.string(), nextInvoiceDate: z.string(), message: z.string() }),
  },
  async ({ companyId, client, clientEmail, items, frequency, startDate, taxRate }) => {
    const db = getFirestore();
    const id = generateId();
    const totalHT = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const totalTTC = Math.round(totalHT * (1 + (taxRate ?? 20) / 100) * 100) / 100;

    const next = startDate ? new Date(startDate) : new Date();
    if (!startDate) {
      if (frequency === 'monthly') next.setMonth(next.getMonth() + 1, 1);
      else if (frequency === 'quarterly') next.setMonth(next.getMonth() + 3, 1);
      else next.setFullYear(next.getFullYear() + 1, 0, 1);
    }

    await db.collection(`companies/${companyId}/recurringInvoices`).doc(id).set({
      id, client, clientEmail: clientEmail ?? '', items, frequency, taxRate: taxRate ?? 20,
      totalHT, totalTTC, status: 'active', nextInvoiceDate: next.toISOString().split('T')[0],
      generatedCount: 0, createdAt: FieldValue.serverTimestamp(),
    });

    return { recurringId: id, frequency, nextInvoiceDate: next.toISOString().split('T')[0], message: `Facture recurrente ${frequency} creee pour ${client} (${totalTTC}€). Prochaine: ${next.toLocaleDateString('fr-FR')}.` };
  }
);

export const getRecurringInvoicesTool = ai.defineTool(
  {
    name: 'acc_getRecurringInvoices',
    description: 'List recurring invoice templates.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({ recurring: z.array(z.object({ id: z.string(), client: z.string(), frequency: z.string(), totalTTC: z.number(), nextInvoiceDate: z.string(), status: z.string(), generatedCount: z.number() })) }),
  },
  async ({ companyId }) => {
    const snap = await getFirestore().collection(`companies/${companyId}/recurringInvoices`).limit(50).get();
    return { recurring: snap.docs.map(d => { const data = d.data(); return { id: d.id, client: (data['client'] as string) ?? '', frequency: (data['frequency'] as string) ?? '', totalTTC: (data['totalTTC'] as number) ?? 0, nextInvoiceDate: (data['nextInvoiceDate'] as string) ?? '', status: (data['status'] as string) ?? 'active', generatedCount: (data['generatedCount'] as number) ?? 0 }; }) };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: EXPENSE ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

export const expenseAnalyticsTool = ai.defineTool(
  {
    name: 'acc_getExpenseAnalytics',
    description: 'Expense analytics — by category, by department, trends, top spenders.',
    inputSchema: z.object({ companyId: z.string(), period: z.enum(['month', 'quarter', 'year']).optional().default('quarter') }),
    outputSchema: z.object({
      totalExpenses: z.number(), avgPerMonth: z.number(),
      byCategory: z.array(z.object({ category: z.string(), total: z.number(), percentage: z.number() })),
      byDepartment: z.array(z.object({ department: z.string(), total: z.number() })),
      topSpenders: z.array(z.object({ name: z.string(), total: z.number(), count: z.number() })),
      trend: z.string(),
    }),
  },
  async ({ companyId, period }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/expenses`).where('status', '==', 'approved').limit(500).get();
    const expenses = snap.docs.map(d => d.data());
    const total = expenses.reduce((s, e) => s + num(e['amount']), 0);

    const byCat: Record<string, number> = {};
    const byDept: Record<string, number> = {};
    const byUser: Record<string, { name: string; total: number; count: number }> = {};

    expenses.forEach(e => {
      const cat = (e['category'] as string) ?? 'autre'; byCat[cat] = (byCat[cat] ?? 0) + num(e['amount']);
      const dept = (e['department'] as string) ?? 'Autre'; byDept[dept] = (byDept[dept] ?? 0) + num(e['amount']);
      const uid = (e['userId'] as string) ?? ''; const name = (e['userName'] as string) ?? uid;
      if (!byUser[uid]) byUser[uid] = { name, total: 0, count: 0 };
      byUser[uid].total += (e['amount'] as number) ?? 0; byUser[uid].count++;
    });

    const months = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
    return {
      totalExpenses: total, avgPerMonth: Math.round(total / months),
      byCategory: Object.entries(byCat).map(([c, t]) => ({ category: c, total: t, percentage: total > 0 ? Math.round(t / total * 100) : 0 })).sort((a, b) => b.total - a.total),
      byDepartment: Object.entries(byDept).map(([d, t]) => ({ department: d, total: t })).sort((a, b) => b.total - a.total),
      topSpenders: Object.values(byUser).sort((a, b) => b.total - a.total).slice(0, 10),
      trend: total > 0 ? 'stable' : 'insufficient_data',
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: FINANCE AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════

export const financeAutomationTool = ai.defineTool(
  {
    name: 'acc_runAutomation',
    description: 'Finance automation: overdue → alert sales, budget exceeded → notification, recurring → generate.',
    inputSchema: z.object({ companyId: z.string(), type: z.enum(['overdue_alert', 'budget_check', 'generate_recurring']) }),
    outputSchema: z.object({ actions: z.array(z.string()), message: z.string() }),
  },
  async ({ companyId, type }) => {
    const db = getFirestore();
    const actions: string[] = [];

    if (type === 'overdue_alert') {
      // Alert sales team about overdue invoices
      const snap = await db.collection(`companies/${companyId}/invoices`).where('status', '==', 'overdue').limit(50).get();
      if (snap.size > 0) {
        const total = snap.docs.reduce((s, d) => s + num(d.data()['totalTTC'] ?? d.data()['amount']), 0);
        const { createNotification } = await import('../services/notificationService');
        createNotification({ companyId, type: 'system', title: `${snap.size} factures impayees (${total}€)`, message: `Relancez vos clients pour recuperer ${total}€ de creances.`, actionUrl: '/finance/invoices', icon: 'AlertTriangle', severity: 'warning' }).catch(() => {});
        actions.push(`Alerte: ${snap.size} factures impayees — ${total}€`);
      }
    }

    if (type === 'budget_check') {
      const snap = await db.collection(`companies/${companyId}/budgets`).limit(20).get();
      for (const doc of snap.docs) {
        const b = doc.data();
        const allocated = (b['allocated'] as number) ?? 0;
        const spent = (b['spent'] as number) ?? 0;
        if (allocated > 0 && spent > allocated * 0.9) {
          const { createNotification } = await import('../services/notificationService');
          createNotification({ companyId, type: 'system', title: `Budget ${b['department']} a ${Math.round(spent / allocated * 100)}%`, message: `Le departement ${b['department']} a depense ${spent}€ sur ${allocated}€ budgetes.`, actionUrl: '/finance/budget', icon: 'TrendingUp', severity: spent > allocated ? 'error' : 'warning' }).catch(() => {});
          actions.push(`Budget ${b['department']}: ${Math.round(spent / allocated * 100)}% utilise`);
        }
      }
    }

    if (type === 'generate_recurring') {
      const snap = await db.collection(`companies/${companyId}/recurringInvoices`).where('status', '==', 'active').limit(20).get();
      const today = new Date().toISOString().split('T')[0];
      for (const doc of snap.docs) {
        const r = doc.data();
        if ((r['nextInvoiceDate'] as string) <= today) {
          // Generate invoice
          const invId = generateId();
          const number = `FAC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
          await db.collection(`companies/${companyId}/invoices`).doc(invId).set({
            id: invId, number, client: r['client'], clientEmail: r['clientEmail'] ?? '',
            items: r['items'], totalHT: r['totalHT'], totalTTC: r['totalTTC'], taxRate: r['taxRate'],
            status: 'sent', currency: 'EUR', source: 'recurring', recurringId: doc.id,
            createdAt: new Date(), dueDate: new Date(Date.now() + 30 * 86400000),
          });
          // Update next date
          const freq = (r['frequency'] as string) ?? 'monthly';
          const next = new Date(r['nextInvoiceDate'] as string);
          if (freq === 'monthly') next.setMonth(next.getMonth() + 1);
          else if (freq === 'quarterly') next.setMonth(next.getMonth() + 3);
          else next.setFullYear(next.getFullYear() + 1);
          await doc.ref.update({ nextInvoiceDate: next.toISOString().split('T')[0], generatedCount: FieldValue.increment(1) });
          actions.push(`Facture ${number} generee pour ${r['client']} (${r['totalTTC']}€)`);
        }
      }
    }

    return { actions, message: actions.length > 0 ? `${actions.length} action(s) executee(s).` : 'Aucune action necessaire.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: CLIENT RISK SCORE
// ══════════════════════════════════════════════════════════════════════════════

export const clientRiskScoreTool = ai.defineTool(
  {
    name: 'acc_getClientRiskScore',
    description: 'Calculate client payment risk score based on invoice payment history — late payments, overdue amounts.',
    inputSchema: z.object({ companyId: z.string(), clientName: z.string().optional() }),
    outputSchema: z.object({
      clients: z.array(z.object({
        client: z.string(), riskLevel: z.string(), totalInvoiced: z.number(),
        totalPaid: z.number(), totalOverdue: z.number(), avgDaysLate: z.number(),
        overdueCount: z.number(), invoiceCount: z.number(),
      })),
    }),
  },
  async ({ companyId, clientName }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/invoices`).limit(500).get();
    const invoices = snap.docs.map(d => d.data());

    const clientMap = new Map<string, { totalInvoiced: number; totalPaid: number; totalOverdue: number; overdueCount: number; invoiceCount: number; lateDays: number[] }>();

    invoices.forEach(inv => {
      const client = (inv['client'] as string) ?? '';
      if (clientName && !client.toLowerCase().includes(clientName.toLowerCase())) return;
      if (!clientMap.has(client)) clientMap.set(client, { totalInvoiced: 0, totalPaid: 0, totalOverdue: 0, overdueCount: 0, invoiceCount: 0, lateDays: [] });
      const c = clientMap.get(client)!;
      const amount = (inv['totalTTC'] as number) ?? (inv['amount'] as number) ?? 0;
      c.totalInvoiced += amount;
      c.invoiceCount++;
      if (inv['status'] === 'paid') c.totalPaid += amount;
      if (inv['status'] === 'overdue') { c.totalOverdue += amount; c.overdueCount++; }
      // Calculate late days
      const dueDate = (inv['dueDate'] as { toDate?: () => Date })?.toDate?.();
      const paidDate = (inv['paidAt'] as { toDate?: () => Date })?.toDate?.();
      if (dueDate && paidDate && paidDate > dueDate) {
        c.lateDays.push(Math.round((paidDate.getTime() - dueDate.getTime()) / 86400000));
      }
    });

    const clients = Array.from(clientMap.entries()).map(([client, data]) => {
      const avgDaysLate = data.lateDays.length > 0 ? Math.round(data.lateDays.reduce((s, d) => s + d, 0) / data.lateDays.length) : 0;
      const overdueRatio = data.invoiceCount > 0 ? data.overdueCount / data.invoiceCount : 0;
      const riskLevel = overdueRatio > 0.5 || avgDaysLate > 30 ? 'high' : overdueRatio > 0.2 || avgDaysLate > 15 ? 'medium' : 'low';
      return { client, riskLevel, totalInvoiced: data.totalInvoiced, totalPaid: data.totalPaid, totalOverdue: data.totalOverdue, avgDaysLate, overdueCount: data.overdueCount, invoiceCount: data.invoiceCount };
    }).sort((a, b) => { const o = { high: 3, medium: 2, low: 1 }; return (o[b.riskLevel as keyof typeof o] ?? 0) - (o[a.riskLevel as keyof typeof o] ?? 0); });

    return { clients };
  }
);

const ALL_TOOLS = [
  // Factures — Create → Track → Collect
  createInvoiceTool, createMultiCurrencyInvoiceTool, updateInvoiceTool, sendInvoiceTool, sendReminderTool,
  getInvoicesTool, getInvoiceByIdTool, getPaymentHistoryTool,
  // Documents & Controle
  generateInvoicePdfTool, voidInvoiceTool,
  // Depenses
  submitExpenseTool, reviewExpenseTool, getExpenseReportsTool, getExpenseByIdTool,
  // Analyse
  getCashFlowTool, forecastCashFlowTool, getBudgetStatusTool, getDashboardSummaryTool,
  // Phase 2 — Multi-devises, TVA, Rapprochement, Export, Auto-relance
  convertCurrencyTool, vatReportTool, bankReconciliationTool, exportFinanceTool, autoRelanceTool,
  // PRO
  profitLossTool, agingReportTool, createRecurringInvoiceTool, getRecurringInvoicesTool,
  expenseAnalyticsTool, financeAutomationTool, clientRiskScoreTool,
];

const EXECUTORS = new Map<string, (i: unknown) => Promise<unknown>>(
  ALL_TOOLS.map(t => [t.__action.name!, (i: unknown) => (t as any)(i)])
);

const INPUT = z.object({
  request: z.string(),
  companyId: z.string(),
  userId: z.string().optional(),
  language: z.string().optional().default('auto'),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});
const OUTPUT = z.object({ response: z.string(), alertLevel: z.enum(['none', 'warning', 'critical']), requiresAction: z.boolean() });

export const accountingAgentFlow = ai.defineFlow(
  { name: 'accountingAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, userId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    logger.info(`[AccountingAgent] Request: "${request.slice(0, 80)}" (history: ${history?.length ?? 0} msgs)`);
    const lang = language === 'auto' ? 'Reponds dans la meme langue que la demande.' : `Reponds en ${language}.`;

    // Date anchors — invoices, due dates, VAT periods need real today
    const dateAnchors = (() => {
      const now = new Date();
      const months = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
      const today = now.toISOString().slice(0, 10);
      const due30 = new Date(now); due30.setDate(due30.getDate() + 30);
      return `AUJOURD'HUI : ${today} (${months[now.getMonth()]} ${now.getFullYear()}). Echeance par defaut J+30 = ${due30.toISOString().slice(0, 10)}.`;
    })();

    // Build messages array with conversation history for context (memory across turns)
    const conversationMessages: any[] = [];
    if (history && history.length > 0) {
      for (const h of history) {
        conversationMessages.push({ role: h.role, content: [{ text: h.content }] });
      }
    }
    conversationMessages.push({ role: 'user' as const, content: [{ text: request }] });

    let response = await ai.generate({
      model: GEMINI_FLASH,
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
      const toolResults = await Promise.all(
        response.toolRequests.map(async (p) => {
          const { name, input, ref } = p.toolRequest;
          const exec = EXECUTORS.get(name);
          const inp = { ...(input as Record<string, unknown>), companyId, userId };
          let output: unknown;
          try { output = exec ? await exec(inp) : { error: `Outil inconnu: ${name}` }; }
          catch (err) { output = { error: String(err) }; }
          return { name, ref, output };
        })
      );
      response = await ai.generate({
        model: GEMINI_FLASH,
        messages: [...response.messages, { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
        tools: ALL_TOOLS, config: { temperature: 0.2 },
      });
    }

    const text = response.text;
    const isCritical = /overdue|impaye|negative|over.budget|urgent|retard/i.test(text);
    const isWarning = /warning|attention|budget.*80|rappel|surveiller/i.test(text);

    return { response: text, alertLevel: isCritical ? 'critical' : isWarning ? 'warning' : 'none', requiresAction: isCritical || isWarning };
  }
);

export const accountingAgentTool = ai.defineTool(
  {
    name: 'callAccountingAgent',
    description: 'Comptabilite PRO: factures (creer/recurrentes/multi-devises/relancer/PDF), depenses (soumettre/approuver/analytics), P&L, aging report, tresorerie + previsions, budget, TVA, rapprochement bancaire, export CSV, auto-relance, cross-agent automation.',
    inputSchema: INPUT, outputSchema: OUTPUT,
  },
  async (input) => {
    try { return await accountingAgentFlow(input); }
    catch (err) { logger.error('[callAccountingAgent] Error:', err); return { response: 'Erreur dans l\'agent comptable.', alertLevel: 'none' as const, requiresAction: false }; }
  }
);
