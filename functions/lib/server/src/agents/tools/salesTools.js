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
exports.CLONE_SALES_TOOL_NAMES = exports.CLONE_SALES_TOOLS = exports.cloneListServicesTool = exports.cloneCreateQuoteRequestTool = exports.cloneCreateLeadTool = void 0;
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
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const helpers_1 = require("../../utils/helpers");
const logger_1 = require("../../utils/logger");
function normalizePhone(p) { return (p ?? '').replace(/[^0-9+]/g, ''); }
function normalizeEmail(e) { return (e ?? '').toLowerCase().trim(); }
async function audit(companyId, action, details) {
    try {
        await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/cloneAuditLog`).add({
            action, details, createdAt: new Date(),
        });
    }
    catch { /* non-critical */ }
}
// ── createLead (Clone-safe) ─────────────────────────────────────────────────
exports.cloneCreateLeadTool = genkit_config_1.ai.defineTool({
    name: 'createLead',
    description: "Register a new sales lead (prospect expressing interest). Call when the user shows commercial interest: 'I want to buy', 'tell me about your offers', 'I need a quote'. Provide client name, phone OR email, interest (what they want), and estimatedValue if mentioned.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        name: zod_1.z.string(),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
        company: zod_1.z.string().optional(),
        interest: zod_1.z.string().describe("What the prospect is interested in (product/service/need)"),
        estimatedValue: zod_1.z.number().optional(),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        leadId: zod_1.z.string().optional(),
        alreadyExisted: zod_1.z.boolean().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    if (!input.name?.trim())
        return { success: false, message: 'Nom requis.' };
    const phone = normalizePhone(input.phone);
    const email = normalizeEmail(input.email);
    if (!phone && !email)
        return { success: false, message: 'Téléphone ou email requis.' };
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const coll = db.collection(`companies/${input.companyId}/leads`);
        // Dedup by phone first, then email
        if (phone) {
            const s = await coll.where('phone', '==', phone).limit(1).get();
            if (!s.empty) {
                // Update interest if given
                if (input.interest) {
                    await s.docs[0].ref.update({ notes: input.interest, updatedAt: new Date() }).catch(() => { });
                }
                return { success: true, leadId: s.docs[0].id, alreadyExisted: true, message: `Contact déjà connu, note mise à jour.` };
            }
        }
        if (email) {
            const s = await coll.where('email', '==', email).limit(1).get();
            if (!s.empty) {
                if (input.interest) {
                    await s.docs[0].ref.update({ notes: input.interest, updatedAt: new Date() }).catch(() => { });
                }
                return { success: true, leadId: s.docs[0].id, alreadyExisted: true, message: `Contact déjà connu, note mise à jour.` };
            }
        }
        const id = (0, helpers_1.generateId)();
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
                const { createNotification } = await Promise.resolve().then(() => __importStar(require('../../services/notificationService')));
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
            }
            catch { /* non-critical */ }
        })().catch(() => { });
        return {
            success: true,
            leadId: id,
            alreadyExisted: false,
            message: `Prospect enregistré: ${input.name}. Un commercial va le recontacter.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[SalesTools] createLead failed', { err: String(err) });
        return { success: false, message: "Impossible d'enregistrer le contact." };
    }
});
// ── createQuoteRequest ──────────────────────────────────────────────────────
exports.cloneCreateQuoteRequestTool = genkit_config_1.ai.defineTool({
    name: 'createQuoteRequest',
    description: "Register a quote request (demande de devis). Use when the prospect explicitly asks for pricing on one or more specific items/services. For vague interest, use createLead instead.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        clientName: zod_1.z.string(),
        clientPhone: zod_1.z.string().optional(),
        clientEmail: zod_1.z.string().optional(),
        company: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string().describe("Product or service name"),
            quantity: zod_1.z.number().optional().default(1),
            notes: zod_1.z.string().optional(),
        })).min(1).describe("Items/services the prospect wants a quote for"),
        deadline: zod_1.z.string().optional().describe("Optional deadline YYYY-MM-DD when they need the answer"),
        notes: zod_1.z.string().optional(),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        quoteRequestId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    if (!input.clientName?.trim())
        return { success: false, message: 'Nom du client requis.' };
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email)
        return { success: false, message: 'Téléphone ou email requis.' };
    if (!input.items || input.items.length === 0)
        return { success: false, message: 'Au moins un article/service requis.' };
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const id = (0, helpers_1.generateId)();
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
                    const { sendEmail: sendMail } = await Promise.resolve().then(() => __importStar(require('../../services/email/emailService')));
                    const itemsList = input.items.map(i => `- ${i.name}${i.quantity && i.quantity !== 1 ? ` × ${i.quantity}` : ''}`).join('<br>');
                    await sendMail({
                        to: email,
                        subject: `Demande de devis reçue — ${input.clientName}`,
                        html: `<p>Bonjour ${input.clientName},</p><p>Votre demande de devis a bien été enregistrée. Un commercial vous recontactera sous peu avec une proposition.</p><p><strong>Articles demandés:</strong><br>${itemsList}</p>${input.deadline ? `<p>Délai souhaité: ${input.deadline}</p>` : ''}<p>Référence: ${id}</p>`,
                        companyId: input.companyId,
                        tags: [{ name: 'type', value: 'quote-request-ack' }],
                    });
                }
                catch (err) {
                    logger_1.logger.warn('[SalesTools] ack email failed', { err: String(err) });
                }
            })().catch(() => { });
        }
        // Notify sales team
        (async () => {
            try {
                const { createNotification } = await Promise.resolve().then(() => __importStar(require('../../services/notificationService')));
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
            }
            catch { /* non-critical */ }
        })().catch(() => { });
        return {
            success: true,
            quoteRequestId: id,
            message: `Demande de devis enregistrée pour ${input.clientName}. Un commercial prépare votre devis.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[SalesTools] createQuoteRequest failed', { err: String(err) });
        return { success: false, message: "Impossible d'enregistrer la demande de devis." };
    }
});
// ── listServices (read-only helper) ─────────────────────────────────────────
exports.cloneListServicesTool = genkit_config_1.ai.defineTool({
    name: 'listServices',
    description: "List the company's services/products (from the Clone config). Use to answer 'what do you offer?' questions before deciding whether to create a lead or a quote request.",
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        services: zod_1.z.array(zod_1.z.string()),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const doc = await db.collection(`companies/${input.companyId}/clones`).doc('main').get();
        const data = doc.exists ? doc.data() ?? {} : {};
        const services = (data['products'] ?? []).filter(Boolean);
        return {
            services,
            message: services.length === 0
                ? "Aucun service configuré — demande une description générale au client."
                : `${services.length} service(s) disponible(s).`,
        };
    }
    catch (err) {
        logger_1.logger.error('[SalesTools] listServices failed', { err: String(err) });
        return { services: [], message: 'Erreur.' };
    }
});
exports.CLONE_SALES_TOOLS = [
    exports.cloneCreateLeadTool,
    exports.cloneCreateQuoteRequestTool,
    exports.cloneListServicesTool,
];
exports.CLONE_SALES_TOOL_NAMES = [
    'createLead', 'createQuoteRequest', 'listServices',
];
//# sourceMappingURL=salesTools.js.map