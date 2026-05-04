/**
 * Clone-safe Sales / CRM tools.
 *
 * Same safeguards as appointment/reservation tools:
 *   - Validation + phone/email normalization
 *   - Dedup by (phone|email) + source tag
 *   - Audit trail
 *   - Side-effects (email ack + in-app notification) are fire-and-forget
 *
 * Tools:
 *   - createLead            — new prospect with estimated value
 *   - createQuoteRequest    — lightweight quote request (not a formal quote)
 *   - listServices          — read-only helper for "what do you offer?"
 */
import { z } from 'zod';
import { ai } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { generateId } from '../../utils/helpers';
import { logger } from '../../utils/logger';

function normalizePhone(p: string | undefined): string { return (p ?? '').replace(/[^0-9+]/g, ''); }
function normalizeEmail(e: string | undefined): string { return (e ?? '').toLowerCase().trim(); }

async function audit(companyId: string, action: string, details: Record<string, unknown>): Promise<void> {
  try {
    await getFirestore().collection(`companies/${companyId}/cloneAuditLog`).add({
      action, details, createdAt: new Date(),
    });
  } catch { /* non-critical */ }
}

// ── createLead (Clone-safe) ─────────────────────────────────────────────────
export const cloneCreateLeadTool = ai.defineTool(
  {
    name: 'createLead',
    description: "Register a new sales lead (prospect expressing interest). Call when the user shows commercial interest: 'I want to buy', 'tell me about your offers', 'I need a quote'. Provide client name, phone OR email, interest (what they want), and estimatedValue if mentioned.",
    inputSchema: z.object({
      companyId: z.string(),
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().optional(),
      company: z.string().optional(),
      interest: z.string().describe("What the prospect is interested in (product/service/need)"),
      estimatedValue: z.number().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      leadId: z.string().optional(),
      alreadyExisted: z.boolean().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    if (!input.name?.trim()) return { success: false, message: 'Nom requis.' };
    const phone = normalizePhone(input.phone);
    const email = normalizeEmail(input.email);
    if (!phone && !email) return { success: false, message: 'Téléphone ou email requis.' };

    try {
      const db = getFirestore();
      const coll = db.collection(`companies/${input.companyId}/leads`);

      // Dedup by phone first, then email
      if (phone) {
        const s = await coll.where('phone', '==', phone).limit(1).get();
        if (!s.empty) {
          // Update interest if given
          if (input.interest) {
            await s.docs[0].ref.update({ notes: input.interest, updatedAt: new Date() }).catch(() => {});
          }
          return { success: true, leadId: s.docs[0].id, alreadyExisted: true, message: `Contact déjà connu, note mise à jour.` };
        }
      }
      if (email) {
        const s = await coll.where('email', '==', email).limit(1).get();
        if (!s.empty) {
          if (input.interest) {
            await s.docs[0].ref.update({ notes: input.interest, updatedAt: new Date() }).catch(() => {});
          }
          return { success: true, leadId: s.docs[0].id, alreadyExisted: true, message: `Contact déjà connu, note mise à jour.` };
        }
      }

      const id = generateId();
      await coll.doc(id).set({
        id,
        name: input.name.trim(),
        phone, email,
        company: input.company ?? '',
        notes: input.interest,
        source: `clone:${input.sourceChannel ?? 'unknown'}`,
        sourceChannel: input.sourceChannel ?? 'unknown',
        estimatedValue: input.estimatedValue ?? 0,
        score: 40, // Clone-captured leads start above default 30 (they expressed interest)
        stage: 'nouveau',
        interactions: [{
          type: 'clone_capture',
          text: input.interest,
          at: new Date(),
        }],
        createdBy: 'clone',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await audit(input.companyId, 'createLead', { leadId: id, name: input.name, source: input.sourceChannel, value: input.estimatedValue });

      // Notify sales team
      (async () => {
        try {
          const { createNotification } = await import('../../services/notificationService');
          await createNotification({
            companyId: input.companyId,
            type: 'lead_created',
            title: 'Nouveau lead capturé',
            message: `${input.name}${input.company ? ` (${input.company})` : ''} — ${input.interest}`,
            actionUrl: '/sales/leads',
            icon: 'TrendingUp',
            severity: 'info',
            metadata: { leadId: id, source: input.sourceChannel ?? 'unknown', estimatedValue: input.estimatedValue },
          });
        } catch { /* non-critical */ }
      })().catch(() => {});

      return {
        success: true,
        leadId: id,
        alreadyExisted: false,
        message: `Prospect enregistré: ${input.name}. Un commercial va le recontacter.`,
      };
    } catch (err) {
      logger.error('[SalesTools] createLead failed', { err: String(err) });
      return { success: false, message: "Impossible d'enregistrer le contact." };
    }
  }
);

// ── createQuoteRequest ──────────────────────────────────────────────────────
export const cloneCreateQuoteRequestTool = ai.defineTool(
  {
    name: 'createQuoteRequest',
    description: "Register a quote request (demande de devis). Use when the prospect explicitly asks for pricing on one or more specific items/services. For vague interest, use createLead instead.",
    inputSchema: z.object({
      companyId: z.string(),
      clientName: z.string(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      company: z.string().optional(),
      items: z.array(z.object({
        name: z.string().describe("Product or service name"),
        quantity: z.number().optional().default(1),
        notes: z.string().optional(),
      })).min(1).describe("Items/services the prospect wants a quote for"),
      deadline: z.string().optional().describe("Optional deadline YYYY-MM-DD when they need the answer"),
      notes: z.string().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      quoteRequestId: z.string().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    if (!input.clientName?.trim()) return { success: false, message: 'Nom du client requis.' };
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) return { success: false, message: 'Téléphone ou email requis.' };
    if (!input.items || input.items.length === 0) return { success: false, message: 'Au moins un article/service requis.' };

    try {
      const db = getFirestore();
      const id = generateId();
      await db.collection(`companies/${input.companyId}/quoteRequests`).doc(id).set({
        id,
        clientName: input.clientName.trim(),
        clientPhone: phone,
        clientEmail: email,
        company: input.company ?? '',
        items: input.items,
        deadline: input.deadline ?? null,
        notes: input.notes ?? '',
        status: 'pending',
        source: `clone:${input.sourceChannel ?? 'unknown'}`,
        sourceChannel: input.sourceChannel ?? 'unknown',
        createdBy: 'clone',
        createdAt: new Date(),
      });

      await audit(input.companyId, 'createQuoteRequest', {
        quoteRequestId: id, clientName: input.clientName, items: input.items.length, source: input.sourceChannel,
      });

      // Email ack to client
      if (email) {
        (async () => {
          try {
            const { sendEmail: sendMail } = await import('../../services/email/emailService');
            const itemsList = input.items.map(i => `- ${i.name}${i.quantity && i.quantity !== 1 ? ` × ${i.quantity}` : ''}`).join('<br>');
            await sendMail({
              to: email,
              subject: `Demande de devis reçue — ${input.clientName}`,
              html: `<p>Bonjour ${input.clientName},</p><p>Votre demande de devis a bien été enregistrée. Un commercial vous recontactera sous peu avec une proposition.</p><p><strong>Articles demandés:</strong><br>${itemsList}</p>${input.deadline ? `<p>Délai souhaité: ${input.deadline}</p>` : ''}<p>Référence: ${id}</p>`,
              companyId: input.companyId,
              tags: [{ name: 'type', value: 'quote-request-ack' }],
            });
          } catch (err) { logger.warn('[SalesTools] ack email failed', { err: String(err) }); }
        })().catch(() => {});
      }

      // Notify sales team
      (async () => {
        try {
          const { createNotification } = await import('../../services/notificationService');
          await createNotification({
            companyId: input.companyId,
            type: 'lead_created',
            title: 'Nouvelle demande de devis',
            message: `${input.clientName} — ${input.items.length} article(s)`,
            actionUrl: '/sales/quotes',
            icon: 'FileText',
            severity: 'info',
            metadata: { quoteRequestId: id, source: input.sourceChannel ?? 'unknown' },
          });
        } catch { /* non-critical */ }
      })().catch(() => {});

      return {
        success: true,
        quoteRequestId: id,
        message: `Demande de devis enregistrée pour ${input.clientName}. Un commercial prépare votre devis.`,
      };
    } catch (err) {
      logger.error('[SalesTools] createQuoteRequest failed', { err: String(err) });
      return { success: false, message: "Impossible d'enregistrer la demande de devis." };
    }
  }
);

// ── listServices (read-only helper) ─────────────────────────────────────────
export const cloneListServicesTool = ai.defineTool(
  {
    name: 'listServices',
    description: "List the company's services/products (from the Clone config). Use to answer 'what do you offer?' questions before deciding whether to create a lead or a quote request.",
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      services: z.array(z.string()),
      message: z.string(),
    }),
  },
  async (input) => {
    try {
      const db = getFirestore();
      const doc = await db.collection(`companies/${input.companyId}/clones`).doc('main').get();
      const data = doc.exists ? doc.data() ?? {} : {};
      const services = ((data['products'] as string[]) ?? []).filter(Boolean);
      return {
        services,
        message: services.length === 0
          ? "Aucun service configuré — demande une description générale au client."
          : `${services.length} service(s) disponible(s).`,
      };
    } catch (err) {
      logger.error('[SalesTools] listServices failed', { err: String(err) });
      return { services: [], message: 'Erreur.' };
    }
  }
);

export const CLONE_SALES_TOOLS = [
  cloneCreateLeadTool,
  cloneCreateQuoteRequestTool,
  cloneListServicesTool,
];

export const CLONE_SALES_TOOL_NAMES = [
  'createLead', 'createQuoteRequest', 'listServices',
];
