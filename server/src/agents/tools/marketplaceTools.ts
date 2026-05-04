/**
 * Shared tools for marketplace agents
 * These tools give industry agents REAL capabilities beyond just conversation
 */
import { z } from 'zod';
import { ai } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { generateId } from '../../utils/helpers';
import { logger } from '../../utils/logger';
import { notifyAppointmentCreated, notifyQuoteCreated } from '../../services/notificationService';
import { createWorkItem } from '../../services/workItemService';

// ── CALENDAR / APPOINTMENTS ─────────────────────────────────────────────────

export const createAppointmentTool = ai.defineTool(
  {
    name: 'createAppointment',
    description: 'Create an appointment/booking for a client. Use for: salon bookings, doctor appointments, restaurant reservations, repair scheduling, etc.',
    inputSchema: z.object({
      companyId: z.string(),
      clientName: z.string().optional().describe('Client full name'),
      clientPhone: z.string().optional().describe('Client phone number'),
      clientEmail: z.string().optional().describe('Client email'),
      service: z.string().describe('Service or reason for appointment'),
      date: z.string().describe('Date in YYYY-MM-DD format'),
      time: z.string().describe('Time in HH:MM format'),
      duration: z.number().optional().describe('Duration in minutes'),
      notes: z.string().optional(),
    }),
    outputSchema: z.object({ appointmentId: z.string(), message: z.string() }),
  },
  async (input) => {
    const db = getFirestore();
    const id = generateId();
    const clientName = input.clientName || input.service || 'Client';
    await db.collection(`companies/${input.companyId}/appointments`).doc(id).set({
      id, clientName, clientPhone: input.clientPhone ?? '',
      clientEmail: input.clientEmail ?? '', service: input.service,
      date: input.date, time: input.time, duration: input.duration ?? 60,
      notes: input.notes ?? '', status: 'confirmed', createdAt: new Date(),
    });
    // Notify + Work Item
    notifyAppointmentCreated(input.companyId, clientName, input.date, input.time, input.service).catch(() => {});
    createWorkItem({
      companyId: input.companyId, type: 'appointment_created', status: 'completed',
      title: `RDV ${clientName}`, summary: `${input.date} a ${input.time} — ${input.service}`,
      data: { appointmentId: id, clientName, date: input.date, time: input.time, service: input.service, duration: input.duration ?? 60, notes: input.notes ?? '', clientPhone: input.clientPhone ?? '', clientEmail: input.clientEmail ?? '' },
    }).catch(() => {});
    return { appointmentId: id, message: `Rendez-vous confirme pour ${clientName} le ${input.date} a ${input.time} — ${input.service}` };
  }
);

export const listAppointmentsTool = ai.defineTool(
  {
    name: 'listAppointments',
    description: 'List upcoming appointments for a company. Filter by date.',
    inputSchema: z.object({
      companyId: z.string(),
      date: z.string().optional().describe('Filter by date YYYY-MM-DD'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const db = getFirestore();
    let query = db.collection(`companies/${input.companyId}/appointments`)
      .orderBy('date', 'asc').limit(20);
    if (input.date) query = query.where('date', '==', input.date) as typeof query;
    const snap = await query.get();
    if (snap.empty) return 'Aucun rendez-vous trouve.';
    const items = snap.docs.map(d => {
      const data = d.data();
      return `- ${data['date']} ${data['time']} | ${data['clientName']} | ${data['service']} (${data['status']})`;
    });
    return `${items.length} rendez-vous:\n${items.join('\n')}`;
  }
);

export const deleteAppointmentTool = ai.defineTool(
  {
    name: 'deleteAppointment',
    description: 'Delete/cancel an appointment by searching for it by client name, date, or time. Use when user asks to remove, cancel, or delete a rendez-vous.',
    inputSchema: z.object({
      companyId: z.string(),
      clientName: z.string().optional().describe('Client name to search for'),
      date: z.string().optional().describe('Date YYYY-MM-DD'),
      time: z.string().optional().describe('Time HH:MM'),
    }),
    outputSchema: z.object({ deleted: z.number(), message: z.string() }),
  },
  async (input) => {
    try {
      const db = getFirestore();
      let query = db.collection(`companies/${input.companyId}/appointments`) as FirebaseFirestore.Query;
      if (input.date) query = query.where('date', '==', input.date);
      const snap = await query.limit(50).get();

      const toDelete = snap.docs.filter(d => {
        const data = d.data();
        if (input.clientName) {
          const name = ((data['clientName'] as string) ?? '').toLowerCase();
          const service = ((data['service'] as string) ?? '').toLowerCase();
          const search = input.clientName.toLowerCase();
          if (!name.includes(search) && !service.includes(search)) return false;
        }
        if (input.time && data['time'] !== input.time) return false;
        return true;
      });

      for (const doc of toDelete) await doc.ref.delete();

      // Also delete matching work items
      const wiSnap = await db.collection(`companies/${input.companyId}/workItems`)
        .where('type', '==', 'appointment_created').limit(100).get();
      for (const doc of wiSnap.docs) {
        const data = doc.data()['data'] as Record<string, unknown> | undefined;
        if (input.date && data?.['date'] !== input.date) continue;
        if (input.clientName) {
          const name = ((data?.['clientName'] as string) ?? '').toLowerCase();
          const title = ((doc.data()['title'] as string) ?? '').toLowerCase();
          const search = input.clientName.toLowerCase();
          if (!name.includes(search) && !title.includes(search)) continue;
        }
        await doc.ref.delete();
      }

      return { deleted: toDelete.length, message: toDelete.length > 0 ? `${toDelete.length} rendez-vous supprime(s).` : 'Aucun rendez-vous trouve avec ces criteres.' };
    } catch {
      return { deleted: 0, message: 'Erreur lors de la suppression.' };
    }
  }
);

export const deleteWorkItemTool = ai.defineTool(
  {
    name: 'deleteWorkItem',
    description: 'Delete a work item (task, event, action) from the workspace by title or date.',
    inputSchema: z.object({
      companyId: z.string(),
      title: z.string().optional().describe('Title or keyword to search'),
      date: z.string().optional().describe('Date YYYY-MM-DD'),
    }),
    outputSchema: z.object({ deleted: z.number(), message: z.string() }),
  },
  async (input) => {
    try {
      const db = getFirestore();
      const snap = await db.collection(`companies/${input.companyId}/workItems`).limit(200).get();

      const toDelete = snap.docs.filter(d => {
        const data = d.data();
        if (input.title) {
          const title = ((data['title'] as string) ?? '').toLowerCase();
          const summary = ((data['summary'] as string) ?? '').toLowerCase();
          const search = input.title.toLowerCase();
          if (!title.includes(search) && !summary.includes(search)) return false;
        }
        return true;
      });

      for (const doc of toDelete) await doc.ref.delete();
      return { deleted: toDelete.length, message: toDelete.length > 0 ? `${toDelete.length} element(s) supprime(s) de l'espace de travail.` : 'Aucun element trouve.' };
    } catch {
      return { deleted: 0, message: 'Erreur lors de la suppression.' };
    }
  }
);

// ── CLIENT CRM ──────────────────────────────────────────────────────────────

export const addClientTool = ai.defineTool(
  {
    name: 'addClient',
    description: 'Add a new client to the company CRM. Use for any industry that tracks clients.',
    inputSchema: z.object({
      companyId: z.string(),
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional().describe('Tags like "VIP", "regulier", "prospect"'),
    }),
    outputSchema: z.object({ clientId: z.string(), message: z.string() }),
  },
  async (input) => {
    const db = getFirestore();
    const id = generateId();
    await db.collection(`companies/${input.companyId}/clients`).doc(id).set({
      id, name: input.name, phone: input.phone ?? '', email: input.email ?? '',
      notes: input.notes ?? '', tags: input.tags ?? [],
      visits: 0, totalSpent: 0, createdAt: new Date(),
    });
    createWorkItem({
      companyId: input.companyId, type: 'client_added', status: 'completed',
      title: `Nouveau client: ${input.name}`, summary: `${input.phone ?? ''} ${input.email ?? ''}`.trim() || 'Pas de contact',
      data: { clientId: id, name: input.name, phone: input.phone ?? '', email: input.email ?? '', tags: input.tags ?? [], notes: input.notes ?? '' },
    }).catch(() => {});
    return { clientId: id, message: `Client "${input.name}" ajoute avec succes.` };
  }
);

export const searchClientsTool = ai.defineTool(
  {
    name: 'searchClients',
    description: 'Search clients in the company CRM by name.',
    inputSchema: z.object({
      companyId: z.string(),
      query: z.string().describe('Search term (name)'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${input.companyId}/clients`).limit(50).get();
    const lower = input.query.toLowerCase();
    const matches = snap.docs
      .filter(d => ((d.data()['name'] as string) ?? '').toLowerCase().includes(lower))
      .map(d => {
        const data = d.data();
        return `- ${data['name']} | ${data['phone'] || 'pas de tel'} | ${data['email'] || ''} | ${(data['tags'] as string[])?.join(', ') || ''}`;
      });
    return matches.length > 0 ? `${matches.length} clients trouves:\n${matches.join('\n')}` : 'Aucun client trouve.';
  }
);

// ── INVENTORY / STOCK ───────────────────────────────────────────────────────

export const checkStockTool = ai.defineTool(
  {
    name: 'checkStock',
    description: 'Check inventory/stock for a product or material.',
    inputSchema: z.object({
      companyId: z.string(),
      productName: z.string().optional().describe('Product to search'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${input.companyId}/inventory`).limit(50).get();
    if (snap.empty) return 'Aucun produit en stock.';
    let items = snap.docs.map(d => d.data());
    if (input.productName) {
      const lower = input.productName.toLowerCase();
      items = items.filter(i => ((i['name'] as string) ?? '').toLowerCase().includes(lower));
    }
    if (items.length === 0) return `Produit "${input.productName}" non trouve en stock.`;
    return items.map(i => `- ${i['name']} | Qte: ${i['quantity'] ?? 0} | Prix: $${i['price'] ?? 0}`).join('\n');
  }
);

export const updateStockTool = ai.defineTool(
  {
    name: 'updateStock',
    description: 'Add or update a product in inventory.',
    inputSchema: z.object({
      companyId: z.string(),
      name: z.string(),
      quantity: z.number(),
      price: z.number().optional(),
      unit: z.string().optional().describe('Unit: piece, kg, litre, etc.'),
    }),
    outputSchema: z.object({ message: z.string() }),
  },
  async (input) => {
    const db = getFirestore();
    const id = input.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await db.collection(`companies/${input.companyId}/inventory`).doc(id).set({
      name: input.name, quantity: input.quantity,
      price: input.price ?? 0, unit: input.unit ?? 'piece',
      updatedAt: new Date(),
    }, { merge: true });
    return { message: `Stock mis a jour: ${input.name} = ${input.quantity} ${input.unit ?? 'pieces'}` };
  }
);

// ── QUOTES / DEVIS ──────────────────────────────────────────────────────────

export const createQuoteTool = ai.defineTool(
  {
    name: 'createQuote',
    description: 'Create a quote/estimate (devis) for a client. Use for repair, carpentry, architecture, etc.',
    inputSchema: z.object({
      companyId: z.string(),
      clientName: z.string(),
      items: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
      })),
      notes: z.string().optional(),
      validDays: z.number().optional().describe('Quote validity in days'),
    }),
    outputSchema: z.object({ quoteId: z.string(), total: z.number(), message: z.string() }),
  },
  async (input) => {
    const db = getFirestore();
    const id = generateId();
    const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    // Store dates as ISO strings (predictable across read paths — no Timestamp surprises)
    const validUntilISO = new Date(Date.now() + (input.validDays ?? 30) * 86400000).toISOString().slice(0, 10);
    await db.collection(`companies/${input.companyId}/quotes`).doc(id).set({
      id, clientName: input.clientName, items: input.items,
      total, totalTTC: total, currency: 'XOF',
      notes: input.notes ?? '', status: 'draft',
      validUntil: validUntilISO,
      quoteNumber: `DEV-${new Date().getFullYear()}-${id.slice(0, 6).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    });
    notifyQuoteCreated(input.companyId, input.clientName, total).catch(() => {});
    createWorkItem({
      companyId: input.companyId, type: 'quote_created', status: 'completed',
      title: `Devis ${input.clientName}`, summary: `${total.toFixed(2)} — ${input.items.length} ligne(s)`,
      data: { quoteId: id, clientName: input.clientName, items: input.items, total, notes: input.notes ?? '', validDays: input.validDays ?? 30, status: 'draft' },
    }).catch(() => {});
    return {
      quoteId: id,
      total,
      message: `Devis créé pour ${input.clientName} — Total: ${total.toLocaleString()}. ⚠️ Pour l'envoyer par email AVEC PDF, tu DOIS appeler sendEmailWithDocs (pas sendEmail) avec attachQuoteId="${id}".`,
    };
  }
);

// ── ALERTS / NOTIFICATIONS ──────────────────────────────────────────────────

export const sendAlertTool = ai.defineTool(
  {
    name: 'sendAlert',
    description: 'Send an alert or notification to the company dashboard.',
    inputSchema: z.object({
      companyId: z.string(),
      title: z.string(),
      message: z.string(),
      severity: z.enum(['info', 'warning', 'critical']),
      category: z.string().optional(),
    }),
    outputSchema: z.object({ alertId: z.string(), message: z.string() }),
  },
  async (input) => {
    const db = getFirestore();
    const id = generateId();
    await db.collection(`companies/${input.companyId}/alerts`).doc(id).set({
      id, title: input.title, message: input.message,
      severity: input.severity, category: input.category ?? 'general',
      read: false, createdAt: new Date(),
    });
    createWorkItem({
      companyId: input.companyId, type: 'alert_sent', status: 'completed',
      title: `Alerte: ${input.title}`, summary: input.message,
      data: { alertId: id, severity: input.severity, category: input.category ?? 'general' },
    }).catch(() => {});
    return { alertId: id, message: `Alerte envoyee: [${input.severity.toUpperCase()}] ${input.title}` };
  }
);

// ── SECURITY CHECKS (CallShield) ────────────────────────────────────────────

export const runSecurityCheckTool = ai.defineTool(
  {
    name: 'runSecurityCheck',
    description: 'Run a security check on a device. Evaluates device trust score, permissions, risks. Used by CallShield/security agents.',
    inputSchema: z.object({
      companyId: z.string(),
      deviceId: z.string().optional().describe('Device identifier'),
      userId: z.string().optional(),
      checkType: z.enum(['full', 'quick', 'pre_call', 'post_call']),
      deviceInfo: z.object({
        os: z.string().optional(),
        version: z.string().optional(),
        rooted: z.boolean().optional(),
        vpn: z.boolean().optional(),
        networkType: z.string().optional(),
      }).optional(),
    }),
    outputSchema: z.object({
      checkId: z.string(), trustScore: z.number(),
      status: z.string(), risks: z.array(z.string()),
      recommendations: z.array(z.string()),
    }),
  },
  async (input) => {
    const db = getFirestore();
    const id = generateId();
    const info = input.deviceInfo ?? {};

    // Calculate trust score based on available info
    let score = 85; // baseline
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (info.rooted) { score -= 30; risks.push('Appareil roote/jailbreake'); recommendations.push('Utiliser un appareil non modifie'); }
    if (info.vpn) { score -= 5; risks.push('VPN detecte — verifier la politique'); }
    if (info.networkType === 'public_wifi') { score -= 15; risks.push('Wi-Fi public detecte'); recommendations.push('Utiliser un reseau securise ou les donnees mobiles'); }
    if (!info.os) { score -= 10; risks.push('OS non identifie'); recommendations.push('Mettre a jour l\'appareil'); }

    const status = score >= 80 ? 'safe' : score >= 50 ? 'warning' : 'critical';

    await db.collection(`companies/${input.companyId}/securityChecks`).doc(id).set({
      id, deviceId: input.deviceId ?? 'unknown', userId: input.userId ?? '',
      checkType: input.checkType, trustScore: score, status,
      risks, recommendations, deviceInfo: info, createdAt: new Date(),
    });

    return { checkId: id, trustScore: score, status, risks, recommendations };
  }
);

export const getSecurityDashboardTool = ai.defineTool(
  {
    name: 'getSecurityDashboard',
    description: 'Get security dashboard data: device trust scores, alerts, compliance status.',
    inputSchema: z.object({
      companyId: z.string(),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const db = getFirestore();
    const [checksSnap, alertsSnap] = await Promise.all([
      db.collection(`companies/${input.companyId}/securityChecks`).orderBy('createdAt', 'desc').limit(20).get(),
      db.collection(`companies/${input.companyId}/alerts`).where('category', '==', 'security').orderBy('createdAt', 'desc').limit(10).get(),
    ]);

    const checks = checksSnap.docs.map(d => d.data());
    const avgScore = checks.length > 0 ? Math.round(checks.reduce((s, c) => s + ((c['trustScore'] as number) ?? 0), 0) / checks.length) : 0;
    const safeCount = checks.filter(c => c['status'] === 'safe').length;
    const warningCount = checks.filter(c => c['status'] === 'warning').length;
    const criticalCount = checks.filter(c => c['status'] === 'critical').length;

    const alerts = alertsSnap.docs.map(d => `- [${(d.data()['severity'] as string).toUpperCase()}] ${d.data()['title']}`);

    return `Tableau de bord securite:
- Score confiance moyen: ${avgScore}/100
- Appareils surs: ${safeCount} | A surveiller: ${warningCount} | Critiques: ${criticalCount}
- ${checks.length} verifications recentes
${alerts.length > 0 ? `\nAlertes recentes:\n${alerts.join('\n')}` : '\nAucune alerte recente.'}`;
  }
);

// ── REPORTS ──────────────────────────────────────────────────────────────────

export const sendWhatsAppMessageTool = ai.defineTool(
  {
    name: 'sendWhatsAppMessage',
    description: 'Send a WhatsApp message to a phone number. Use for: sending reminders, confirmations, notifications to clients or employees via WhatsApp.',
    inputSchema: z.object({
      companyId: z.string(),
      to: z.string().describe('Phone number with country code, e.g. +2250701234567'),
      message: z.string().describe('Message text to send'),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async (input) => {
    try {
      const { whatsappService } = await import('../../services/whatsapp/whatsappService');
      const config = await whatsappService.getConfig(input.companyId).catch(() => null);
      if (!config) return { success: false, message: 'WhatsApp non connecte pour cette entreprise. Connectez WhatsApp dans les parametres.' };

      await whatsappService.sendMessage(config, input.to, input.message);
      return { success: true, message: `Message WhatsApp envoye a ${input.to}` };
    } catch (err) {
      return { success: false, message: `Echec: ${(err as Error).message}` };
    }
  }
);

// chatId is the Telegram chat identifier — either the configured defaultChatId
// for company-wide notifications, or a specific user/group chat the company has
// already saved. Telegram doesn't allow sending to phone numbers directly.
export const sendTelegramMessageTool = ai.defineTool(
  {
    name: 'sendTelegramMessage',
    description: 'Send a Telegram message. Use for: reminders, confirmations, notifications via Telegram. Supports markdown. If no chatId is provided, falls back to the company defaultChatId.',
    inputSchema: z.object({
      companyId: z.string(),
      chatId: z.string().optional().describe('Telegram chat ID (numeric) or @channelname. If omitted, uses company default chat.'),
      message: z.string().describe('Message text (markdown supported)'),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async (input) => {
    try {
      const { sendTelegramMessage, getTelegramConfig } = await import('../../services/telegram/telegramService');
      let chatId = input.chatId;
      if (!chatId) {
        const cfg = await getTelegramConfig(input.companyId).catch(() => null);
        chatId = cfg?.defaultChatId;
      }
      if (!chatId) return { success: false, message: 'Telegram non configuré (aucun chatId fourni et pas de defaultChatId). Connectez Telegram dans les paramètres.' };

      const result = await sendTelegramMessage(input.companyId, chatId, input.message);
      if (!result.success) return { success: false, message: `Echec Telegram: ${result.error ?? 'erreur inconnue'}` };
      return { success: true, message: `Message Telegram envoyé à ${chatId}` };
    } catch (err) {
      return { success: false, message: `Echec: ${(err as Error).message}` };
    }
  }
);

export const sendEmailTool = ai.defineTool(
  {
    name: 'sendEmailWithDocs',
    description: "📎 EMAIL WITH DOCUMENT ATTACHMENT — use this INSTEAD of sendEmail whenever you mention 'ci-joint', 'en pièce jointe', 'attached', or send a quote/invoice/contract. Pass attachQuoteId / attachInvoiceId / attachContractId so the PDF is actually attached. The basic 'sendEmail' tool does NOT attach files.",
    inputSchema: z.object({
      companyId: z.string(),
      to: z.string().describe('Recipient email address'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Email body in HTML or plain text'),
      attachQuoteId: z.string().optional().describe("ID of a quote in companies/{id}/quotes — generates and attaches the quote PDF."),
      attachInvoiceId: z.string().optional().describe("ID of an invoice in companies/{id}/invoices — generates and attaches the invoice PDF."),
      attachContractId: z.string().optional().describe("ID of a contract in companies/{id}/contracts — generates and attaches the contract PDF."),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string(), attachmentsIncluded: z.array(z.string()).optional() }),
  },
  async (input) => {
    try {
      const db = getFirestore();
      // Build attachments list from the references provided
      const attachments: Array<{ filename: string; content: Buffer }> = [];
      const attachmentsIncluded: string[] = [];

      // Convert any Firestore Timestamp / Date / ISO string / Object to a localized date string
      const toDateStr = (v: unknown): string | undefined => {
        if (!v) return undefined;
        let date: Date | null = null;
        if (v instanceof Date) date = v;
        else if (typeof v === 'string') { const d = new Date(v); date = Number.isNaN(d.getTime()) ? null : d; }
        else if (typeof v === 'object') {
          const o = v as { _seconds?: number; seconds?: number; toDate?: () => Date };
          if (typeof o.toDate === 'function') date = o.toDate();
          else {
            const secs = o._seconds ?? o.seconds;
            if (typeof secs === 'number') date = new Date(secs * 1000);
          }
        }
        return date ? date.toLocaleDateString('fr-FR') : undefined;
      };

      // Quote PDF
      if (input.attachQuoteId) {
        try {
          const doc = await db.collection(`companies/${input.companyId}/quotes`).doc(input.attachQuoteId).get();
          const data = doc.data();
          if (data) {
            const { renderInvoicePdf, loadCompanyForInvoice } = await import('../../services/invoice/invoicePdfService');
            const company = await loadCompanyForInvoice(input.companyId);
            const items = Array.isArray(data['items'])
              ? (data['items'] as Array<Record<string, unknown>>).map(i => ({
                  name: String(i['description'] ?? i['name'] ?? 'Article'),
                  quantity: Number(i['quantity'] ?? 1),
                  unitPrice: Number(i['unitPrice'] ?? i['price'] ?? 0),
                }))
              : [{ name: 'Prestation', quantity: 1, unitPrice: Number(data['totalTTC'] ?? data['total'] ?? 0) }];
            const buf = await renderInvoicePdf(company, {
              id: (data['quoteNumber'] ?? data['id'] ?? input.attachQuoteId) as string,
              clientName: (data['clientName'] as string) ?? 'Client',
              clientEmail: input.to,
              items,
              subtotal: Number(data['totalTTC'] ?? data['total'] ?? 0),
              currency: (data['currency'] as string) ?? 'XOF',
              status: 'draft', docType: 'quote',
              validUntil: toDateStr(data['validUntil']),
              createdAt: toDateStr(data['createdAt']) ?? new Date().toLocaleDateString('fr-FR'),
            });
            attachments.push({ filename: `Devis-${data['quoteNumber'] ?? input.attachQuoteId}.pdf`, content: buf });
            attachmentsIncluded.push(`quote:${input.attachQuoteId}`);
          }
        } catch { /* non-fatal */ }
      }

      // Invoice PDF
      if (input.attachInvoiceId) {
        try {
          const doc = await db.collection(`companies/${input.companyId}/invoices`).doc(input.attachInvoiceId).get();
          const data = doc.data();
          if (data) {
            const { renderInvoicePdf, loadCompanyForInvoice } = await import('../../services/invoice/invoicePdfService');
            const company = await loadCompanyForInvoice(input.companyId);
            const items = Array.isArray(data['items'])
              ? (data['items'] as Array<Record<string, unknown>>).map(i => ({
                  name: String(i['description'] ?? i['name'] ?? 'Article'),
                  quantity: Number(i['quantity'] ?? 1),
                  unitPrice: Number(i['unitPrice'] ?? i['price'] ?? 0),
                }))
              : [{ name: 'Prestation', quantity: 1, unitPrice: Number(data['totalTTC'] ?? data['amount'] ?? 0) }];
            const buf = await renderInvoicePdf(company, {
              id: (data['number'] ?? data['id'] ?? input.attachInvoiceId) as string,
              clientName: (data['client'] as string) ?? (data['clientName'] as string) ?? 'Client',
              clientEmail: (data['clientEmail'] as string) ?? input.to,
              items,
              subtotal: Number(data['totalTTC'] ?? data['amount'] ?? 0),
              currency: (data['currency'] as string) ?? 'XOF',
              status: (data['status'] as string) ?? 'sent',
              createdAt: data['createdAt'] as string | Date | null | undefined,
            });
            attachments.push({ filename: `Facture-${data['number'] ?? input.attachInvoiceId}.pdf`, content: buf });
            attachmentsIncluded.push(`invoice:${input.attachInvoiceId}`);
          }
        } catch { /* non-fatal */ }
      }

      // Contract PDF
      if (input.attachContractId) {
        try {
          const doc = await db.collection(`companies/${input.companyId}/contracts`).doc(input.attachContractId).get();
          const data = doc.data();
          if (data) {
            const { loadCompany, renderContractPdf } = await import('../../services/hr/contractPdfService');
            const company = await loadCompany(input.companyId);
            const employeeId = data['employeeId'] as string;
            const [empHR, empUser] = await Promise.all([
              db.collection(`companies/${input.companyId}/employees`).doc(employeeId).get(),
              db.collection('users').doc(employeeId).get(),
            ]);
            const emp = { ...(empUser.data() ?? {}), ...(empHR.data() ?? {}) } as Record<string, unknown>;
            const buf = await renderContractPdf(company, {
              name: (emp['displayName'] as string) ?? 'Employé',
              email: emp['email'] as string | undefined,
              phone: emp['phone'] as string | undefined,
              jobTitle: data['jobTitle'] as string | undefined,
              department: data['department'] as string | undefined,
              baseSalary: data['baseSalary'] as number | undefined,
              currency: data['currency'] as string | undefined,
              startDate: data['startDate'] as string | undefined,
              contractType: data['contractType'] as 'CDI' | 'CDD' | 'Stage' | 'Freelance' | undefined,
              endDate: data['endDate'] as string | undefined,
              trialPeriodMonths: data['trialPeriodMonths'] as number | undefined,
              workHours: data['workHours'] as string | undefined,
            });
            attachments.push({ filename: `Contrat-${emp['displayName'] ?? 'employe'}.pdf`, content: buf });
            attachmentsIncluded.push(`contract:${input.attachContractId}`);
          }
        } catch { /* non-fatal */ }
      }

      // Diagnostic: log PDF generation results before sending
      const { logger } = await import('../../utils/logger');
      logger.info('[sendEmail] Preparing email', {
        to: input.to, subject: input.subject,
        attachQuoteId: input.attachQuoteId,
        attachInvoiceId: input.attachInvoiceId,
        attachContractId: input.attachContractId,
        attachmentCount: attachments.length,
        attachmentSizes: attachments.map(a => ({ name: a.filename, bytes: a.content.length })),
      });

      // Use unified emailService (Gmail if connected, Resend fallback) — supports attachments
      const { sendEmail } = await import('../../services/email/emailService');
      const html = input.body.includes('<') ? input.body : `<p>${input.body.replace(/\n/g, '<br>')}</p>`;
      const result = await sendEmail({
        companyId: input.companyId,
        to: input.to,
        subject: input.subject,
        html,
        attachments: attachments.length > 0 ? attachments : undefined,
        tags: [{ name: 'type', value: 'orchestrator-email' }],
      });

      logger.info('[sendEmail] Sent', { provider: result.provider, attachments: attachmentsIncluded });

      return {
        success: true,
        message: `Email envoyé à ${input.to} via ${result.provider}${attachments.length > 0 ? ` avec ${attachments.length} pièce(s) jointe(s)` : ''}.`,
        attachmentsIncluded,
      };
    } catch (err) {
      return { success: false, message: `Erreur: ${(err as Error).message}` };
    }
  }
);

export const generateReportTool = ai.defineTool(
  {
    name: 'generateReport',
    description: 'Generate a business report (daily, weekly, monthly). Aggregates data from appointments, clients, stock, quotes.',
    inputSchema: z.object({
      companyId: z.string(),
      period: z.enum(['today', 'week', 'month']),
      type: z.enum(['general', 'appointments', 'clients', 'security', 'sales']),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const db = getFirestore();
    const sections: string[] = [`Rapport ${input.type} — periode: ${input.period}`];

    if (input.type === 'general' || input.type === 'appointments') {
      const snap = await db.collection(`companies/${input.companyId}/appointments`).limit(100).get();
      sections.push(`\nRendez-vous: ${snap.size} total`);
    }
    if (input.type === 'general' || input.type === 'clients') {
      const snap = await db.collection(`companies/${input.companyId}/clients`).limit(100).get();
      sections.push(`Clients: ${snap.size} enregistres`);
    }
    if (input.type === 'general' || input.type === 'sales') {
      const snap = await db.collection(`companies/${input.companyId}/quotes`).limit(100).get();
      const total = snap.docs.reduce((s, d) => s + ((d.data()['total'] as number) ?? 0), 0);
      sections.push(`Devis: ${snap.size} crees — Total: $${total.toFixed(2)}`);
    }
    if (input.type === 'security') {
      const snap = await db.collection(`companies/${input.companyId}/securityChecks`).limit(100).get();
      const avgScore = snap.size > 0 ? Math.round(snap.docs.reduce((s, d) => s + ((d.data()['trustScore'] as number) ?? 0), 0) / snap.size) : 0;
      sections.push(`Verifications: ${snap.size} | Score moyen: ${avgScore}/100`);
    }

    return sections.join('\n');
  }
);

// ── IMPORT ANALYTICS TOOLS ───────────────────────────────────────────────────

import { ANALYTICS_TOOLS, ANALYTICS_TOOL_NAMES } from './analyticsTools';
import { OBD_TOOLS, OBD_TOOL_NAMES } from './obdTools';
import { EXTERNAL_TOOLS, EXTERNAL_TOOL_NAMES } from './externalTools';

// ── EXPORT ALL TOOLS ────────────────────────────────────────────────────────

export const MARKETPLACE_SHARED_TOOLS = [
  createAppointmentTool, listAppointmentsTool,
  addClientTool, searchClientsTool,
  checkStockTool, updateStockTool,
  createQuoteTool,
  sendAlertTool,
  runSecurityCheckTool, getSecurityDashboardTool,
  generateReportTool,
  ...ANALYTICS_TOOLS,
  ...OBD_TOOLS,
  ...EXTERNAL_TOOLS,
];

/** Tool names that marketplace agents are allowed to use */
export const MARKETPLACE_TOOL_WHITELIST = [
  'searchDocuments', 'getDocuments',
  'createAppointment', 'listAppointments',
  'addClient', 'searchClients',
  'checkStock', 'updateStock',
  'createQuote',
  'sendAlert',
  'sendWhatsAppMessage', 'sendTelegramMessage', 'sendEmail',
  'listTeamChannels', 'listTeamMembers', 'readTeamChannelMessages',
  'sendTeamChannelMessage', 'sendTeamDirectMessage', 'mentionTeamMember',
  'runSecurityCheck', 'getSecurityDashboard',
  'generateReport',
  ...ANALYTICS_TOOL_NAMES,
  ...OBD_TOOL_NAMES,
  ...EXTERNAL_TOOL_NAMES,
];
