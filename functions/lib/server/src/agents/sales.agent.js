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
exports.salesAgentTool = exports.salesAgentFlow = exports.sendQuoteForSignatureTool = exports.salesAutomationTool = exports.createEmailSequenceTool = exports.teamPerformanceTool = exports.winLossAnalysisTool = exports.dealInsightsTool = exports.aiScoreLeadTool = exports.forecastRevenueTool = exports.getStatsTool = exports.autoFollowUpTool = exports.getPendingFollowUpsTool = exports.scheduleFollowUpTool = exports.sendWhatsAppTool = exports.sendEmailTool = exports.convertQuoteToSaleTool = exports.sendQuoteTool = exports.updateQuoteTool = exports.createQuoteTool = exports.updateDealStageTool = exports.getPipelineTool = exports.updateLeadStatusTool = exports.scoreLeadTool = exports.getClientHistoryTool = exports.getClientTool = exports.getLeadsTool = exports.createClientTool = exports.createLeadTool = void 0;
/**
 * Sales Agent PRO — Agent Commercial Complet
 * Mission : Transformer un prospect en client, puis en revenu.
 *
 * Capabilities:
 *   1. Leads & Clients — create, qualify, score, track
 *   2. Pipeline — stages, deal progression
 *   3. Quotes — generate, update, send, convert to sale
 *   4. Communication — email follow-up, WhatsApp, sales scripts
 *   5. Follow-ups — schedule, auto-detect, auto-run
 *   6. Analytics — stats, forecast, funnel analysis
 *   7. Accounting bridge — convert accepted quote → invoice
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
// ══════════════════════════════════════════════════════════════════════════════
// 1. LEADS — Create · Qualify · Score · List
// ══════════════════════════════════════════════════════════════════════════════
const PIPELINE_STAGES = ['nouveau', 'contacte', 'interesse', 'devis_envoye', 'negociation', 'gagne', 'perdu'];
exports.createLeadTool = genkit_config_1.ai.defineTool({
    name: 'sales_createLead',
    description: 'Create a new lead/prospect in the CRM.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        name: zod_1.z.string(),
        email: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        company: zod_1.z.string().optional(),
        source: zod_1.z.enum(['website', 'referral', 'linkedin', 'whatsapp', 'cold_call', 'event', 'ads', 'other']).optional().default('other'),
        estimatedValue: zod_1.z.number().optional().default(0),
        notes: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ leadId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, name, email, phone, company, source, estimatedValue, notes }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/leads`).doc(id).set({
        id, name, email: email ?? '', phone: phone ?? '', company: company ?? '',
        source: source ?? 'other', estimatedValue: estimatedValue ?? 0,
        notes: notes ?? '', score: 30, stage: 'nouveau',
        interactions: [], createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info('[Sales] Lead created', { companyId, leadId: id, name });
    return { leadId: id, message: `Lead "${name}" cree avec succes.` };
});
exports.createClientTool = genkit_config_1.ai.defineTool({
    name: 'sales_createClient',
    description: 'Create a client record (converted from lead or new).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        name: zod_1.z.string(),
        email: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        company: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        leadId: zod_1.z.string().optional().describe('Original lead ID if converting'),
    }),
    outputSchema: zod_1.z.object({ clientId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, name, email, phone, company, address, leadId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/clients`).doc(id).set({
        id, name, email: email ?? '', phone: phone ?? '', company: company ?? '',
        address: address ?? '', leadId: leadId ?? null, totalRevenue: 0, quotesCount: 0, invoicesCount: 0,
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    if (leadId) {
        await db.collection(`companies/${companyId}/leads`).doc(leadId).update({
            stage: 'gagne', convertedClientId: id, updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }).catch(() => { });
    }
    logger_1.logger.info('[Sales] Client created', { companyId, clientId: id, name });
    return { clientId: id, message: `Client "${name}" cree.` };
});
exports.getLeadsTool = genkit_config_1.ai.defineTool({
    name: 'sales_getLeads',
    description: 'List leads, optionally filtered by stage or score threshold.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        stage: zod_1.z.string().optional(),
        minScore: zod_1.z.number().optional(),
        limit: zod_1.z.number().optional().default(50),
    }),
    outputSchema: zod_1.z.object({
        leads: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), name: zod_1.z.string(), email: zod_1.z.string(), company: zod_1.z.string(),
            score: zod_1.z.number(), stage: zod_1.z.string(), source: zod_1.z.string(), estimatedValue: zod_1.z.number(),
        })),
        total: zod_1.z.number(), hotLeads: zod_1.z.number(),
    }),
}, async ({ companyId, stage, minScore, limit }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let query = db.collection(`companies/${companyId}/leads`);
    if (stage)
        query = query.where('stage', '==', stage);
    const snap = await query.limit(limit ?? 50).get();
    let leads = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id, name: data['name'] ?? '', email: data['email'] ?? '',
            company: data['company'] ?? '', score: data['score'] ?? 0,
            stage: data['stage'] ?? 'nouveau', source: data['source'] ?? 'other',
            estimatedValue: data['estimatedValue'] ?? 0,
        };
    });
    if (minScore)
        leads = leads.filter(l => l.score >= minScore);
    leads.sort((a, b) => b.score - a.score);
    return { leads, total: leads.length, hotLeads: leads.filter(l => l.score >= 70).length };
});
exports.getClientTool = genkit_config_1.ai.defineTool({
    name: 'sales_getClient',
    description: 'Get a specific client by ID.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), clientId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        id: zod_1.z.string(), name: zod_1.z.string(), email: zod_1.z.string(), phone: zod_1.z.string(),
        company: zod_1.z.string(), totalRevenue: zod_1.z.number(), quotesCount: zod_1.z.number(), invoicesCount: zod_1.z.number(),
    }),
}, async ({ companyId, clientId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/clients`).doc(clientId).get();
    const d = doc.data() ?? {};
    return {
        id: clientId, name: d['name'] ?? '', email: d['email'] ?? '',
        phone: d['phone'] ?? '', company: d['company'] ?? '',
        totalRevenue: d['totalRevenue'] ?? 0, quotesCount: d['quotesCount'] ?? 0,
        invoicesCount: d['invoicesCount'] ?? 0,
    };
});
exports.getClientHistoryTool = genkit_config_1.ai.defineTool({
    name: 'sales_getClientHistory',
    description: 'Get complete history for a client: quotes, invoices, interactions.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), clientId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        quotes: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), reference: zod_1.z.string(), total: zod_1.z.number(), status: zod_1.z.string() })),
        invoices: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), number: zod_1.z.string(), totalTTC: zod_1.z.number(), status: zod_1.z.string() })),
        interactions: zod_1.z.array(zod_1.z.object({ date: zod_1.z.string(), type: zod_1.z.string(), summary: zod_1.z.string() })),
    }),
}, async ({ companyId, clientId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [quotesSnap, invoicesSnap] = await Promise.all([
        db.collection(`companies/${companyId}/quotes`).where('clientId', '==', clientId).limit(50).get(),
        db.collection(`companies/${companyId}/invoices`).where('clientId', '==', clientId).limit(50).get(),
    ]);
    const clientDoc = await db.collection(`companies/${companyId}/clients`).doc(clientId).get();
    const clientData = clientDoc.data() ?? {};
    return {
        quotes: quotesSnap.docs.map(d => {
            const data = d.data();
            return { id: d.id, reference: data['quoteNumber'] ?? '', total: data['totalTTC'] ?? 0, status: data['status'] ?? 'draft' };
        }),
        invoices: invoicesSnap.docs.map(d => {
            const data = d.data();
            return { id: d.id, number: data['number'] ?? '', totalTTC: data['totalTTC'] ?? 0, status: data['status'] ?? 'pending' };
        }),
        interactions: Array.isArray(clientData['interactions']) ? clientData['interactions'] : [],
    };
});
exports.scoreLeadTool = genkit_config_1.ai.defineTool({
    name: 'sales_scoreLead',
    description: 'Recalculate and update score for a lead based on engagement signals.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), leadId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ leadId: zod_1.z.string(), newScore: zod_1.z.number(), recommendation: zod_1.z.string() }),
}, async ({ companyId, leadId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/leads`).doc(leadId).get();
    const data = doc.data() ?? {};
    const interactions = Array.isArray(data['interactions']) ? data['interactions'] : [];
    const value = data['estimatedValue'] ?? 0;
    const stage = data['stage'] ?? 'nouveau';
    let score = 10;
    // Stage bonus
    if (stage === 'contacte')
        score += 15;
    else if (stage === 'interesse')
        score += 30;
    else if (stage === 'devis_envoye')
        score += 50;
    else if (stage === 'negociation')
        score += 65;
    else if (stage === 'gagne')
        score = 100;
    // Engagement bonus
    score += Math.min(interactions.length * 5, 25);
    // Value bonus
    if (value > 50000)
        score += 15;
    else if (value > 10000)
        score += 10;
    else if (value > 1000)
        score += 5;
    score = Math.min(score, 100);
    await db.collection(`companies/${companyId}/leads`).doc(leadId).update({ score, updatedAt: firestore_1.FieldValue.serverTimestamp() });
    const recommendation = score >= 80 ? 'Lead tres chaud — contacter immediatement avec une offre personnalisee.'
        : score >= 50 ? 'Lead interesse — envoyer un devis ou planifier un appel.'
            : score >= 30 ? 'Lead tiede — nourrir avec du contenu de valeur.'
                : 'Lead froid — maintenir le contact, pas de pression commerciale.';
    return { leadId, newScore: score, recommendation };
});
exports.updateLeadStatusTool = genkit_config_1.ai.defineTool({
    name: 'sales_updateLeadStatus',
    description: 'Move a lead to a new pipeline stage.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        leadId: zod_1.z.string(),
        stage: zod_1.z.enum(PIPELINE_STAGES),
        notes: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, leadId, stage, notes }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const interaction = { date: new Date().toISOString(), type: 'stage_change', summary: `Etape changee vers "${stage}"${notes ? `. ${notes}` : ''}` };
    await db.collection(`companies/${companyId}/leads`).doc(leadId).update({
        stage, updatedAt: firestore_1.FieldValue.serverTimestamp(),
        interactions: firestore_1.FieldValue.arrayUnion(interaction),
    });
    return { success: true, message: `Lead deplace vers "${stage}".` };
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. PIPELINE — Deal Tracking
// ══════════════════════════════════════════════════════════════════════════════
exports.getPipelineTool = genkit_config_1.ai.defineTool({
    name: 'sales_getPipeline',
    description: 'Get complete sales pipeline overview grouped by stage.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        stages: zod_1.z.array(zod_1.z.object({ stage: zod_1.z.string(), count: zod_1.z.number(), totalValue: zod_1.z.number() })),
        totalPipelineValue: zod_1.z.number(),
        totalDeals: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/leads`).limit(500).get();
    const stageMap = new Map();
    let totalPipelineValue = 0;
    for (const stage of PIPELINE_STAGES) {
        stageMap.set(stage, { count: 0, totalValue: 0 });
    }
    snap.docs.forEach(d => {
        const data = d.data();
        const stage = data['stage'] ?? 'nouveau';
        const value = data['estimatedValue'] ?? 0;
        const existing = stageMap.get(stage) ?? { count: 0, totalValue: 0 };
        stageMap.set(stage, { count: existing.count + 1, totalValue: existing.totalValue + value });
        if (stage !== 'perdu')
            totalPipelineValue += value;
    });
    return {
        stages: Array.from(stageMap.entries()).map(([stage, s]) => ({ stage, ...s })),
        totalPipelineValue,
        totalDeals: snap.size,
    };
});
exports.updateDealStageTool = genkit_config_1.ai.defineTool({
    name: 'sales_updateDealStage',
    description: 'Move a deal from one pipeline stage to another.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        dealId: zod_1.z.string(),
        newStage: zod_1.z.enum(PIPELINE_STAGES),
        reason: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, dealId, newStage, reason }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/leads`).doc(dealId);
    const doc = await ref.get();
    const oldStage = doc.data()?.['stage'] ?? 'unknown';
    const interaction = {
        date: new Date().toISOString(), type: 'stage_change',
        summary: `${oldStage} → ${newStage}${reason ? ` (${reason})` : ''}`,
    };
    await ref.update({ stage: newStage, updatedAt: firestore_1.FieldValue.serverTimestamp(), interactions: firestore_1.FieldValue.arrayUnion(interaction) });
    logger_1.logger.info('[Sales] Deal stage updated', { companyId, dealId, oldStage, newStage });
    return { success: true, message: `Deal deplace de "${oldStage}" vers "${newStage}".` };
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. QUOTES — Create · Update · Send · Convert
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Resolve a quote reference (UUID, short UUID prefix like af52808d, OR quoteNumber like DEV-2026-0004) to the Firestore doc ID.
 */
async function resolveQuoteDocId(companyId, ref) {
    const db = (0, firebase_config_1.getFirestore)();
    const direct = await db.collection(`companies/${companyId}/quotes`).doc(ref).get().catch(() => null);
    if (direct?.exists)
        return direct.id;
    const byNum = await db.collection(`companies/${companyId}/quotes`).where('quoteNumber', '==', ref).limit(1).get().catch(() => null);
    if (byNum && !byNum.empty)
        return byNum.docs[0].id;
    // Fallback: short UUID prefix match (e.g. "af52808d" → "af52808d-...")
    if (ref.length >= 6 && /^[a-f0-9-]+$/i.test(ref)) {
        const all = await db.collection(`companies/${companyId}/quotes`).limit(500).get().catch(() => null);
        const match = all?.docs.find(d => d.id.toLowerCase().startsWith(ref.toLowerCase()));
        if (match)
            return match.id;
    }
    return null;
}
/**
 * Resolve a lead reference (UUID OR exact name) to the Firestore doc ID.
 */
async function resolveLeadDocId(companyId, ref) {
    const db = (0, firebase_config_1.getFirestore)();
    const direct = await db.collection(`companies/${companyId}/leads`).doc(ref).get().catch(() => null);
    if (direct?.exists)
        return direct.id;
    const byName = await db.collection(`companies/${companyId}/leads`).where('name', '==', ref).limit(1).get().catch(() => null);
    if (byName && !byName.empty)
        return byName.docs[0].id;
    return null;
}
exports.createQuoteTool = genkit_config_1.ai.defineTool({
    name: 'sales_createQuote',
    description: 'Generate a sales quote/proposal for a client.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        clientName: zod_1.z.string(),
        clientId: zod_1.z.string().optional(),
        leadId: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({ description: zod_1.z.string(), quantity: zod_1.z.number(), unitPrice: zod_1.z.number() })),
        validDays: zod_1.z.number().optional().default(30),
        notes: zod_1.z.string().optional(),
        taxRate: zod_1.z.number().optional().default(20),
    }),
    outputSchema: zod_1.z.object({ quoteId: zod_1.z.string(), quoteNumber: zod_1.z.string(), totalHT: zod_1.z.number(), totalTTC: zod_1.z.number(), validUntil: zod_1.z.string(), status: zod_1.z.string() }),
}, async ({ companyId, clientName, clientId, leadId, items, validDays, notes, taxRate }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const quoteId = (0, helpers_1.generateId)();
    const countSnap = await db.collection(`companies/${companyId}/quotes`).count().get();
    const count = countSnap.data().count + 1;
    const quoteNumber = `DEV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const totalHT = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const effectiveTax = taxRate ?? 20;
    const taxAmount = Math.round(totalHT * (effectiveTax / 100) * 100) / 100;
    const totalTTC = Math.round((totalHT + taxAmount) * 100) / 100;
    const validUntil = new Date(Date.now() + (validDays ?? 30) * 86400000).toISOString().split('T')[0];
    await db.collection(`companies/${companyId}/quotes`).doc(quoteId).set({
        id: quoteId, quoteNumber, clientName, clientId: clientId ?? null, leadId: leadId ?? null,
        items, notes: notes ?? '', totalHT, taxRate: effectiveTax, taxAmount, totalTTC, validUntil,
        status: 'draft', createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Update lead stage if linked
    if (leadId) {
        await db.collection(`companies/${companyId}/leads`).doc(leadId).update({
            stage: 'devis_envoye', updatedAt: firestore_1.FieldValue.serverTimestamp(),
            interactions: firestore_1.FieldValue.arrayUnion({ date: new Date().toISOString(), type: 'quote', summary: `Devis ${quoteNumber} cree (${totalTTC} EUR)` }),
        }).catch(() => { });
    }
    logger_1.logger.info('[Sales] Quote created', { companyId, quoteId, quoteNumber, totalTTC });
    return { quoteId, quoteNumber, totalHT, totalTTC, validUntil, status: 'draft' };
});
exports.updateQuoteTool = genkit_config_1.ai.defineTool({
    name: 'sales_updateQuote',
    description: 'Update a quote status or details. Accepts UUID or quoteNumber (DEV-YYYY-XXXX).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        quoteId: zod_1.z.string().describe('UUID or quoteNumber like DEV-2026-0004'),
        status: zod_1.z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
        items: zod_1.z.array(zod_1.z.object({ description: zod_1.z.string(), quantity: zod_1.z.number(), unitPrice: zod_1.z.number() })).optional(),
        notes: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, quoteId, status, items, notes }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const docId = await resolveQuoteDocId(companyId, quoteId);
    if (!docId)
        return { success: false, message: `Devis ${quoteId} introuvable.` };
    const updates = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
    if (status)
        updates['status'] = status;
    if (notes !== undefined)
        updates['notes'] = notes;
    if (items) {
        const totalHT = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        updates['items'] = items;
        updates['totalHT'] = totalHT;
        updates['totalTTC'] = Math.round(totalHT * 1.2 * 100) / 100;
    }
    await db.collection(`companies/${companyId}/quotes`).doc(docId).update(updates);
    return { success: true, message: `Devis ${quoteId} mis à jour${status ? ` (statut: ${status})` : ''}.` };
});
exports.sendQuoteTool = genkit_config_1.ai.defineTool({
    name: 'sales_sendQuote',
    description: 'Send a quote by email to the client. Accepts UUID or quoteNumber (DEV-YYYY-XXXX).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        quoteId: zod_1.z.string().describe('UUID or quoteNumber like DEV-2026-0004'),
        recipientEmail: zod_1.z.string(), message: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, quoteId, recipientEmail, message }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const docId = await resolveQuoteDocId(companyId, quoteId);
    if (!docId)
        return { success: false, message: `Devis ${quoteId} introuvable.` };
    const doc = await db.collection(`companies/${companyId}/quotes`).doc(docId).get();
    const data = doc.data();
    if (!data)
        return { success: false, message: `Devis ${quoteId} introuvable.` };
    // Update status to sent
    await db.collection(`companies/${companyId}/quotes`).doc(docId).update({
        status: 'sent', sentAt: firestore_1.FieldValue.serverTimestamp(), sentTo: recipientEmail,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Generate PDF attachment — real quote document, not just a link
    let pdfBuffer = null;
    try {
        const { renderInvoicePdf, loadCompanyForInvoice } = await Promise.resolve().then(() => __importStar(require('../services/invoice/invoicePdfService')));
        const company = await loadCompanyForInvoice(companyId);
        const items = Array.isArray(data['items'])
            ? data['items'].map(i => ({
                name: String(i['description'] ?? i['name'] ?? 'Article'),
                quantity: Number(i['quantity'] ?? 1),
                unitPrice: Number(i['unitPrice'] ?? i['price'] ?? 0),
            }))
            : [{
                    name: data['service'] ?? 'Prestation',
                    quantity: 1,
                    unitPrice: Number(data['totalTTC'] ?? data['amount'] ?? 0),
                }];
        pdfBuffer = await renderInvoicePdf(company, {
            id: data['quoteNumber'] ?? quoteId.slice(0, 10),
            clientName: data['clientName'] ?? 'Client',
            clientEmail: recipientEmail,
            clientPhone: data['clientPhone'],
            items,
            subtotal: Number(data['totalTTC'] ?? data['amount'] ?? 0),
            currency: data['currency'] ?? 'XOF',
            status: 'draft',
            docType: 'quote',
            validUntil: data['validUntil'],
            createdAt: data['createdAt'],
        });
    }
    catch (err) {
        logger_1.logger.warn('[Sales] Quote PDF generation failed', { err: String(err) });
    }
    // Send email with PDF attached
    try {
        const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../services/email/emailService')));
        const subject = `Devis ${data['quoteNumber']} — ${data['clientName']}`;
        const bodyHtml = `<p>${message ?? 'Bonjour,'}</p>
<p>Vous trouverez en pièce jointe notre proposition commerciale <strong>${data['quoteNumber']}</strong> d'un montant de <strong>${Number(data['totalTTC'] ?? 0).toLocaleString()} ${data['currency'] ?? 'XOF'}</strong>, valide jusqu'au <strong>${data['validUntil']}</strong>.</p>
<p>Cordialement,<br>L'équipe commerciale</p>`;
        await sendEmail({
            companyId,
            to: recipientEmail,
            subject,
            html: bodyHtml,
            attachments: pdfBuffer ? [{
                    filename: `Devis-${data['quoteNumber']}.pdf`,
                    content: pdfBuffer,
                }] : undefined,
        });
    }
    catch (err) {
        logger_1.logger.warn('[Sales] Email send failed, quote still marked as sent', { err });
        return { success: false, message: `Devis créé mais l'envoi email a échoué: ${err.message ?? err}` };
    }
    logger_1.logger.info('[Sales] Quote sent with PDF', { companyId, quoteId, to: recipientEmail, hasPdf: !!pdfBuffer });
    return {
        success: true,
        message: `Devis ${data['quoteNumber']} envoyé à ${recipientEmail}${pdfBuffer ? ' avec PDF en pièce jointe' : ' (⚠️ sans PDF — génération échouée)'}.`,
    };
});
exports.convertQuoteToSaleTool = genkit_config_1.ai.defineTool({
    name: 'sales_convertQuoteToSale',
    description: 'Convert an accepted quote into a sale and create an invoice. Accepts UUID or quoteNumber.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        quoteId: zod_1.z.string().describe('UUID or quoteNumber like DEV-2026-0004'),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), invoiceId: zod_1.z.string().optional(), message: zod_1.z.string() }),
}, async ({ companyId, quoteId }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const docId = await resolveQuoteDocId(companyId, quoteId);
        if (!docId)
            return { success: false, message: `Devis ${quoteId} introuvable.` };
        const doc = await db.collection(`companies/${companyId}/quotes`).doc(docId).get();
        const data = doc.data();
        if (!data)
            return { success: false, message: `Devis ${quoteId} introuvable.` };
        // Mark quote as accepted
        await db.collection(`companies/${companyId}/quotes`).doc(docId).update({
            status: 'accepted', acceptedAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Create invoice
        const invoiceId = (0, helpers_1.generateId)();
        const countSnap = await db.collection(`companies/${companyId}/invoices`).count().get();
        const count = countSnap.data().count + 1;
        const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const totalTTC = data['totalTTC'] ?? 0;
        const totalHT = data['totalHT'] ?? totalTTC;
        await db.collection(`companies/${companyId}/invoices`).doc(invoiceId).set({
            id: invoiceId, number: invoiceNumber,
            client: data['clientName'] ?? '', clientName: data['clientName'] ?? '',
            clientId: data['clientId'] ?? null,
            items: data['items'] ?? [], totalHT, taxRate: data['taxRate'] ?? 20,
            taxAmount: data['taxAmount'] ?? 0, totalTTC,
            status: 'pending', paidAmount: 0, dueDate,
            sourceQuoteId: docId, sourceQuoteNumber: data['quoteNumber'] ?? '',
            currency: data['currency'] ?? 'XOF',
            createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Update lead if linked (best-effort)
        if (data['leadId']) {
            await db.collection(`companies/${companyId}/leads`).doc(data['leadId']).update({
                stage: 'gagne', updatedAt: firestore_1.FieldValue.serverTimestamp(),
                interactions: firestore_1.FieldValue.arrayUnion({ date: new Date().toISOString(), type: 'sale', summary: `Vente conclue — Facture ${invoiceNumber}` }),
            }).catch((e) => logger_1.logger.warn('[Sales] Lead update failed (non-critical)', { e: String(e) }));
        }
        // Update client revenue if linked (best-effort)
        if (data['clientId']) {
            await db.collection(`companies/${companyId}/clients`).doc(data['clientId']).update({
                totalRevenue: firestore_1.FieldValue.increment(totalTTC),
                invoicesCount: firestore_1.FieldValue.increment(1),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }).catch((e) => logger_1.logger.warn('[Sales] Client update failed (non-critical)', { e: String(e) }));
        }
        logger_1.logger.info('[Sales] Quote converted to sale', { companyId, quoteId, docId, invoiceId, invoiceNumber, totalTTC });
        return { success: true, invoiceId, message: `Vente conclue. Facture ${invoiceNumber} créée (UUID: ${invoiceId}, montant: ${totalTTC} ${data['currency'] ?? 'XOF'}).` };
    }
    catch (err) {
        logger_1.logger.error('[Sales] convertQuoteToSale failed', { err: String(err), quoteId, companyId });
        return { success: false, message: `Échec conversion devis ${quoteId} en facture: ${err.message ?? String(err)}` };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. COMMUNICATION — Email · WhatsApp · Sales Scripts
// ══════════════════════════════════════════════════════════════════════════════
exports.sendEmailTool = genkit_config_1.ai.defineTool({
    name: 'sales_sendEmail',
    description: 'Send a follow-up or commercial email to a prospect/client.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        to: zod_1.z.string(),
        subject: zod_1.z.string(),
        body: zod_1.z.string(),
        leadId: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, to, subject, body, leadId }) => {
    try {
        const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../services/email/emailService')));
        await sendEmail({ companyId, to, subject, html: `<div style="font-family:sans-serif;font-size:14px">${body.replace(/\n/g, '<br>')}</div>` });
        // Log interaction
        if (leadId) {
            const db = (0, firebase_config_1.getFirestore)();
            await db.collection(`companies/${companyId}/leads`).doc(leadId).update({
                interactions: firestore_1.FieldValue.arrayUnion({ date: new Date().toISOString(), type: 'email', summary: `Email envoye: "${subject}"` }),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }).catch(() => { });
        }
        return { success: true, message: `Email envoye a ${to}.` };
    }
    catch (err) {
        logger_1.logger.error('[Sales] Email failed', { err });
        return { success: false, message: 'Echec de l\'envoi de l\'email.' };
    }
});
exports.sendWhatsAppTool = genkit_config_1.ai.defineTool({
    name: 'sales_sendWhatsApp',
    description: 'Send a personalized WhatsApp message to a prospect/client.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        to: zod_1.z.string().describe('Phone number with country code'),
        message: zod_1.z.string(),
        leadId: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, to, message, leadId }) => {
    try {
        const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
        const config = await whatsappService.getConfig(companyId);
        if (!config) {
            return {
                success: false,
                message: `WhatsApp non configuré pour cette entreprise. Configurer Meta Cloud API dans /admin/whatsapp pour activer l'envoi.`,
            };
        }
        // Try free-form text first (works only inside the 24h conversation window)
        const messageId = await whatsappService.sendMessage(config, to, message);
        if (messageId) {
            if (leadId) {
                const db = (0, firebase_config_1.getFirestore)();
                await db.collection(`companies/${companyId}/leads`).doc(leadId).update({
                    interactions: firestore_1.FieldValue.arrayUnion({ date: new Date().toISOString(), type: 'whatsapp', summary: `WhatsApp envoye: "${message.slice(0, 80)}..."` }),
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                }).catch(() => { });
            }
            return { success: true, message: `Message WhatsApp envoyé à ${to} (ID: ${messageId}).` };
        }
        // Fallback: outside 24h window, only Meta-approved templates work.
        // Try the default "hello_world" template that all WABA accounts have by default.
        const tmplId = await whatsappService.sendTemplate(config, to, 'hello_world', 'en_US', []);
        if (tmplId) {
            return {
                success: true,
                message: `Hors fenêtre 24h Meta : message libre refusé. Template "hello_world" envoyé à la place (ID: ${tmplId}). Pour envoyer le contenu personnalisé, faire approuver un template métier ou attendre une réponse du destinataire (ouvre une fenêtre 24h).`,
            };
        }
        return {
            success: false,
            message: `WhatsApp à ${to} a échoué. Causes probables : (1) hors fenêtre 24h Meta + pas de template approuvé, (2) numéro non WhatsApp, (3) opt-out destinataire. Vérifier les logs Meta pour le détail.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[Sales] WhatsApp failed', { err: String(err), to });
        return { success: false, message: `Échec WhatsApp: ${err.message ?? String(err)}` };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 5. FOLLOW-UPS — Schedule · Detect · Auto-run
// ══════════════════════════════════════════════════════════════════════════════
exports.scheduleFollowUpTool = genkit_config_1.ai.defineTool({
    name: 'sales_scheduleFollowUp',
    description: 'Schedule a follow-up reminder for a lead/client.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        leadId: zod_1.z.string(),
        scheduledAt: zod_1.z.string().describe('ISO date when to follow up'),
        type: zod_1.z.enum(['call', 'email', 'whatsapp', 'meeting']).optional().default('email'),
        notes: zod_1.z.string().optional(),
        assignedTo: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ followUpId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, leadId, scheduledAt, type, notes, assignedTo }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/followups`).doc(id).set({
        id, leadId, scheduledAt: new Date(scheduledAt), type: type ?? 'email',
        notes: notes ?? '', assignedTo: assignedTo ?? '', status: 'pending',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info('[Sales] Follow-up scheduled', { companyId, leadId, scheduledAt });
    return { followUpId: id, message: `Relance programmee pour le ${new Date(scheduledAt).toLocaleDateString('fr-FR')}.` };
});
exports.getPendingFollowUpsTool = genkit_config_1.ai.defineTool({
    name: 'sales_getPendingFollowUps',
    description: 'Get all pending follow-ups, including overdue ones.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        followups: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), leadId: zod_1.z.string(), leadName: zod_1.z.string(),
            scheduledAt: zod_1.z.string(), type: zod_1.z.string(), notes: zod_1.z.string(),
            status: zod_1.z.string(), overdue: zod_1.z.boolean(),
        })),
        overdueCount: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/followups`)
        .where('status', '==', 'pending').limit(100).get();
    const now = new Date();
    const followups = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const scheduledAt = data['scheduledAt']?.toDate?.() ?? new Date(data['scheduledAt']);
        // Get lead name
        let leadName = '';
        try {
            const leadDoc = await db.collection(`companies/${companyId}/leads`).doc(data['leadId']).get();
            leadName = leadDoc.data()?.['name'] ?? '';
        }
        catch { /* ignore */ }
        return {
            id: d.id, leadId: data['leadId'] ?? '', leadName,
            scheduledAt: scheduledAt.toISOString(), type: data['type'] ?? 'email',
            notes: data['notes'] ?? '', status: 'pending',
            overdue: scheduledAt < now,
        };
    }));
    followups.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    return { followups, overdueCount: followups.filter(f => f.overdue).length };
});
exports.autoFollowUpTool = genkit_config_1.ai.defineTool({
    name: 'sales_autoFollowUp',
    description: 'Automatically detect leads without response and create follow-up actions.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        daysSinceLastContact: zod_1.z.number().optional().default(3),
    }),
    outputSchema: zod_1.z.object({
        created: zod_1.z.number(),
        leads: zod_1.z.array(zod_1.z.object({ leadId: zod_1.z.string(), name: zod_1.z.string(), daysSilent: zod_1.z.number() })),
    }),
}, async ({ companyId, daysSinceLastContact }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/leads`)
        .where('stage', 'in', ['contacte', 'interesse', 'devis_envoye', 'negociation']).limit(200).get();
    const now = Date.now();
    const threshold = (daysSinceLastContact ?? 3) * 86400000;
    const needsFollowUp = [];
    for (const doc of snap.docs) {
        const data = doc.data();
        const interactions = Array.isArray(data['interactions']) ? data['interactions'] : [];
        const lastContact = interactions.length > 0
            ? new Date(interactions[interactions.length - 1].date).getTime()
            : (data['createdAt']?.toDate?.()?.getTime() ?? now - threshold - 1);
        if (now - lastContact > threshold) {
            const daysSilent = Math.floor((now - lastContact) / 86400000);
            needsFollowUp.push({ leadId: doc.id, name: data['name'] ?? '', daysSilent });
            // Create follow-up
            const followUpDate = new Date(now + 86400000); // tomorrow
            await db.collection(`companies/${companyId}/followups`).doc((0, helpers_1.generateId)()).set({
                leadId: doc.id, scheduledAt: followUpDate, type: 'email',
                notes: `Relance auto — ${daysSilent} jours sans reponse`, status: 'pending',
                auto: true, createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
    }
    logger_1.logger.info('[Sales] Auto follow-up', { companyId, created: needsFollowUp.length });
    return { created: needsFollowUp.length, leads: needsFollowUp };
});
// ══════════════════════════════════════════════════════════════════════════════
// 6. ANALYTICS — Stats · Forecast · Funnel
// ══════════════════════════════════════════════════════════════════════════════
exports.getStatsTool = genkit_config_1.ai.defineTool({
    name: 'sales_getStats',
    description: 'Get comprehensive sales statistics and KPIs.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalLeads: zod_1.z.number(), hotLeads: zod_1.z.number(), totalClients: zod_1.z.number(),
        totalQuotes: zod_1.z.number(), acceptedQuotes: zod_1.z.number(), pendingQuotes: zod_1.z.number(),
        totalRevenue: zod_1.z.number(), pipelineValue: zod_1.z.number(),
        conversionRate: zod_1.z.number(), avgDealSize: zod_1.z.number(),
        stageBreakdown: zod_1.z.array(zod_1.z.object({ stage: zod_1.z.string(), count: zod_1.z.number(), value: zod_1.z.number() })),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [leadsSnap, clientsSnap, quotesSnap] = await Promise.all([
        db.collection(`companies/${companyId}/leads`).limit(500).get(),
        db.collection(`companies/${companyId}/clients`).count().get(),
        db.collection(`companies/${companyId}/quotes`).limit(500).get(),
    ]);
    const leads = leadsSnap.docs.map(d => d.data());
    const quotes = quotesSnap.docs.map(d => d.data());
    const won = leads.filter(l => l['stage'] === 'gagne');
    const lost = leads.filter(l => l['stage'] === 'perdu');
    const totalCompleted = won.length + lost.length;
    const pipelineValue = leads.filter(l => !['gagne', 'perdu'].includes(l['stage']))
        .reduce((s, l) => s + (l['estimatedValue'] ?? 0), 0);
    const totalRevenue = won.reduce((s, l) => s + (l['estimatedValue'] ?? 0), 0);
    const hotLeads = leads.filter(l => (l['score'] ?? 0) >= 70).length;
    // Stage breakdown
    const stageMap = new Map();
    for (const stage of PIPELINE_STAGES)
        stageMap.set(stage, { count: 0, value: 0 });
    leads.forEach(l => {
        const stage = l['stage'] ?? 'nouveau';
        const existing = stageMap.get(stage) ?? { count: 0, value: 0 };
        stageMap.set(stage, { count: existing.count + 1, value: existing.value + (l['estimatedValue'] ?? 0) });
    });
    return {
        totalLeads: leads.length, hotLeads, totalClients: clientsSnap.data().count,
        totalQuotes: quotes.length,
        acceptedQuotes: quotes.filter(q => q['status'] === 'accepted').length,
        pendingQuotes: quotes.filter(q => q['status'] === 'draft' || q['status'] === 'sent').length,
        totalRevenue, pipelineValue,
        conversionRate: totalCompleted > 0 ? Math.round((won.length / totalCompleted) * 100) : 0,
        avgDealSize: won.length > 0 ? Math.round(totalRevenue / won.length) : 0,
        stageBreakdown: Array.from(stageMap.entries()).map(([stage, s]) => ({ stage, ...s })),
    };
});
exports.forecastRevenueTool = genkit_config_1.ai.defineTool({
    name: 'sales_forecastRevenue',
    description: 'Forecast expected revenue based on pipeline probability.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        optimistic: zod_1.z.number(), realistic: zod_1.z.number(), conservative: zod_1.z.number(),
        byStage: zod_1.z.array(zod_1.z.object({ stage: zod_1.z.string(), expectedRevenue: zod_1.z.number(), probability: zod_1.z.number() })),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/leads`)
        .where('stage', 'not-in', ['gagne', 'perdu']).limit(500).get();
    const STAGE_PROBABILITIES = {
        nouveau: 10, contacte: 20, interesse: 40, devis_envoye: 60, negociation: 80,
    };
    const byStage = [];
    let optimistic = 0, realistic = 0, conservative = 0;
    const stageGroups = new Map();
    snap.docs.forEach(d => {
        const data = d.data();
        const stage = data['stage'] ?? 'nouveau';
        const value = data['estimatedValue'] ?? 0;
        stageGroups.set(stage, (stageGroups.get(stage) ?? 0) + value);
        const prob = STAGE_PROBABILITIES[stage] ?? 30;
        optimistic += value;
        realistic += value * (prob / 100);
        conservative += value * (prob / 100) * 0.7;
    });
    for (const [stage, total] of stageGroups.entries()) {
        byStage.push({ stage, expectedRevenue: Math.round(total * (STAGE_PROBABILITIES[stage] ?? 30) / 100), probability: STAGE_PROBABILITIES[stage] ?? 30 });
    }
    return {
        optimistic: Math.round(optimistic),
        realistic: Math.round(realistic),
        conservative: Math.round(conservative),
        byStage,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// ALL TOOLS — exported array for the flow
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// PRO: AI LEAD SCORING
// ══════════════════════════════════════════════════════════════════════════════
exports.aiScoreLeadTool = genkit_config_1.ai.defineTool({
    name: 'sales_aiScoreLead',
    description: 'AI-powered lead scoring — behavioral analysis, engagement patterns, conversion probability.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), leadId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ leadId: zod_1.z.string(), score: zod_1.z.number(), grade: zod_1.z.string(), factors: zod_1.z.array(zod_1.z.object({ factor: zod_1.z.string(), impact: zod_1.z.string(), weight: zod_1.z.number() })), nextBestAction: zod_1.z.string(), conversionProbability: zod_1.z.number() }),
}, async ({ companyId, leadId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/leads`).doc(leadId).get();
    if (!doc.exists)
        return { leadId, score: 0, grade: 'F', factors: [], nextBestAction: 'Lead introuvable', conversionProbability: 0 };
    const lead = doc.data();
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Score this sales lead using behavioral analysis. Return JSON ONLY.

Lead data:
- Name: ${lead['name'] ?? lead['contactName']}
- Company: ${lead['company']}
- Stage: ${lead['stage']}
- Source: ${lead['source']}
- Value: ${lead['amount'] ?? lead['value']}€
- Interactions: ${(lead['interactions'] ?? []).length}
- Days since creation: ${Math.round((Date.now() - (lead['createdAt']?.toDate?.()?.getTime() ?? Date.now())) / 86400000)}
- Last contact: ${lead['lastContactAt'] ?? 'unknown'}

Score 0-100 based on: engagement level, deal size, stage progression speed, source quality.
Return: {"score":75,"grade":"A|B|C|D|F","factors":[{"factor":"High engagement","impact":"positive","weight":30}],"nextBestAction":"Send proposal","conversionProbability":0.65}`,
        config: { temperature: 0.2 },
    });
    try {
        const parsed = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        await db.collection(`companies/${companyId}/leads`).doc(leadId).update({ aiScore: parsed.score, aiGrade: parsed.grade, aiScoredAt: new Date(), nextBestAction: parsed.nextBestAction });
        return { leadId, ...parsed };
    }
    catch {
        return { leadId, score: 50, grade: 'C', factors: [], nextBestAction: 'Relancer le prospect', conversionProbability: 0.3 };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: DEAL INSIGHTS (next best action, risk scoring)
// ══════════════════════════════════════════════════════════════════════════════
exports.dealInsightsTool = genkit_config_1.ai.defineTool({
    name: 'sales_getDealInsights',
    description: 'AI deal intelligence — risk assessment, next best action, competitive analysis for a specific deal.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), leadId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ leadId: zod_1.z.string(), riskLevel: zod_1.z.string(), riskFactors: zod_1.z.array(zod_1.z.string()), opportunities: zod_1.z.array(zod_1.z.string()), nextActions: zod_1.z.array(zod_1.z.object({ action: zod_1.z.string(), priority: zod_1.z.string(), deadline: zod_1.z.string() })), winProbability: zod_1.z.number() }),
}, async ({ companyId, leadId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/leads`).doc(leadId).get();
    if (!doc.exists)
        return { leadId, riskLevel: 'unknown', riskFactors: [], opportunities: [], nextActions: [], winProbability: 0 };
    const lead = doc.data();
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Analyze this deal and provide strategic intelligence. Return JSON ONLY.
Lead: ${lead['name']} (${lead['company']}), Stage: ${lead['stage']}, Value: ${lead['amount'] ?? lead['value']}€, Score: ${lead['score'] ?? lead['aiScore'] ?? '?'}
Interactions: ${(lead['interactions'] ?? []).length}, Days in pipeline: ${Math.round((Date.now() - (lead['createdAt']?.toDate?.()?.getTime() ?? Date.now())) / 86400000)}

Return: {"riskLevel":"low|medium|high|critical","riskFactors":["factor1"],"opportunities":["opp1"],"nextActions":[{"action":"...","priority":"high|medium|low","deadline":"this week|next week|this month"}],"winProbability":0.6}`,
        config: { temperature: 0.2 },
    });
    try {
        return { leadId, ...JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')) };
    }
    catch {
        return { leadId, riskLevel: 'medium', riskFactors: [], opportunities: [], nextActions: [], winProbability: 0.5 };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: WIN/LOSS ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════
exports.winLossAnalysisTool = genkit_config_1.ai.defineTool({
    name: 'sales_winLossAnalysis',
    description: 'Analyze won and lost deals to identify patterns, success factors, and improvement areas.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), period: zod_1.z.enum(['month', 'quarter', 'year']).optional().default('quarter') }),
    outputSchema: zod_1.z.object({ totalWon: zod_1.z.number(), totalLost: zod_1.z.number(), winRate: zod_1.z.number(), avgDealSize: zod_1.z.number(), avgCycleLength: zod_1.z.number(), winFactors: zod_1.z.array(zod_1.z.string()), lossReasons: zod_1.z.array(zod_1.z.string()), recommendations: zod_1.z.array(zod_1.z.string()) }),
}, async ({ companyId, period }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const days = period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
    const cutoff = new Date(Date.now() - days * 86400000);
    const snap = await db.collection(`companies/${companyId}/leads`).where('stage', 'in', ['gagne', 'perdu']).limit(200).get();
    const deals = snap.docs.map(d => d.data()).filter(d => {
        const t = d['updatedAt']?.toDate?.()?.getTime() ?? 0;
        return t >= cutoff.getTime();
    });
    const won = deals.filter(d => d['stage'] === 'gagne');
    const lost = deals.filter(d => d['stage'] === 'perdu');
    const winRate = deals.length > 0 ? Math.round(won.length / deals.length * 100) : 0;
    const avgDealSize = won.length > 0 ? Math.round(won.reduce((s, d) => s + (d['amount'] ?? d['value'] ?? 0), 0) / won.length) : 0;
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Analyze these sales results and provide insights in French. Return JSON ONLY.
Won: ${won.length} deals (avg ${avgDealSize}€), Lost: ${lost.length} deals, Win rate: ${winRate}%
Won sources: ${won.map(d => d['source']).join(', ')}
Lost sources: ${lost.map(d => d['source']).join(', ')}
Won stages progression: ${won.map(d => d['stage']).join(', ')}
Return: {"winFactors":["factor1","factor2"],"lossReasons":["reason1","reason2"],"recommendations":["rec1","rec2"]}`,
        config: { temperature: 0.3 },
    });
    let analysis = { winFactors: [], lossReasons: [], recommendations: [] };
    try {
        analysis = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch { }
    return { totalWon: won.length, totalLost: lost.length, winRate, avgDealSize, avgCycleLength: 0, ...analysis };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: TEAM PERFORMANCE
// ══════════════════════════════════════════════════════════════════════════════
exports.teamPerformanceTool = genkit_config_1.ai.defineTool({
    name: 'sales_getTeamPerformance',
    description: 'Get individual sales rep performance — KPIs, quota attainment, leaderboard.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        reps: zod_1.z.array(zod_1.z.object({ userId: zod_1.z.string(), name: zod_1.z.string(), leadsOwned: zod_1.z.number(), dealsWon: zod_1.z.number(), dealsClosed: zod_1.z.number(), revenue: zod_1.z.number(), conversionRate: zod_1.z.number(), avgDealSize: zod_1.z.number() })),
        topPerformer: zod_1.z.string(), totalRevenue: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [leadsSnap, usersSnap] = await Promise.all([
        db.collection(`companies/${companyId}/leads`).limit(500).get(),
        db.collection('users').where('companyId', '==', companyId).limit(50).get(),
    ]);
    const leads = leadsSnap.docs.map(d => d.data());
    const repMap = new Map();
    // Init reps
    usersSnap.docs.forEach(d => {
        const u = d.data();
        if (u['role'] === 'admin' || u['role'] === 'manager' || u['department'] === 'Commercial') {
            repMap.set(d.id, { name: u['displayName'] ?? u['email'] ?? '', leads: 0, won: 0, closed: 0, revenue: 0 });
        }
    });
    // Aggregate by owner
    leads.forEach(l => {
        const owner = l['ownerId'] ?? l['createdBy'] ?? '';
        if (!repMap.has(owner))
            return;
        const rep = repMap.get(owner);
        rep.leads++;
        if (l['stage'] === 'gagne') {
            rep.won++;
            rep.revenue += l['amount'] ?? l['value'] ?? 0;
        }
        if (l['stage'] === 'gagne' || l['stage'] === 'perdu')
            rep.closed++;
    });
    const reps = Array.from(repMap.entries()).map(([userId, data]) => ({
        userId, ...data,
        dealsClosed: data.closed, dealsWon: data.won, leadsOwned: data.leads,
        conversionRate: data.closed > 0 ? Math.round(data.won / data.closed * 100) : 0,
        avgDealSize: data.won > 0 ? Math.round(data.revenue / data.won) : 0,
    })).sort((a, b) => b.revenue - a.revenue);
    return { reps, topPerformer: reps[0]?.name ?? '', totalRevenue: reps.reduce((s, r) => s + r.revenue, 0) };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: EMAIL SEQUENCES
// ══════════════════════════════════════════════════════════════════════════════
exports.createEmailSequenceTool = genkit_config_1.ai.defineTool({
    name: 'sales_createEmailSequence',
    description: 'Create an automated email drip sequence for lead nurturing.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), name: zod_1.z.string(), targetStage: zod_1.z.string().optional(),
        steps: zod_1.z.array(zod_1.z.object({ dayOffset: zod_1.z.number(), subject: zod_1.z.string(), template: zod_1.z.string() })).optional(),
        generateWithAI: zod_1.z.boolean().optional().default(true),
    }),
    outputSchema: zod_1.z.object({ sequenceId: zod_1.z.string(), name: zod_1.z.string(), steps: zod_1.z.array(zod_1.z.object({ dayOffset: zod_1.z.number(), subject: zod_1.z.string(), template: zod_1.z.string() })), message: zod_1.z.string() }),
}, async ({ companyId, name, targetStage, steps, generateWithAI }) => {
    let sequenceSteps = steps ?? [];
    if (generateWithAI || sequenceSteps.length === 0) {
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Create a 5-step email drip sequence for sales lead nurturing in French. Target stage: ${targetStage ?? 'nouveau'}.
Each step: dayOffset (days after enrollment), subject line, email template body.
Return JSON: {"steps":[{"dayOffset":0,"subject":"...","template":"..."}]}`,
            config: { temperature: 0.4 },
        });
        try {
            sequenceSteps = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')).steps;
        }
        catch {
            sequenceSteps = [
                { dayOffset: 0, subject: 'Bienvenue', template: 'Merci de votre interet...' },
                { dayOffset: 3, subject: 'Decouvrez nos solutions', template: 'Voici comment nous pouvons vous aider...' },
                { dayOffset: 7, subject: 'Etude de cas', template: 'Decouvrez comment un client similaire...' },
                { dayOffset: 14, subject: 'Offre speciale', template: 'Profitez de notre offre...' },
                { dayOffset: 21, subject: 'Dernier rappel', template: 'Nous aimerions echanger avec vous...' },
            ];
        }
    }
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/emailSequences`).doc(id).set({
        id, name, targetStage: targetStage ?? 'nouveau', steps: sequenceSteps,
        status: 'active', enrolledCount: 0, createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { sequenceId: id, name, steps: sequenceSteps, message: `Sequence "${name}" creee avec ${sequenceSteps.length} etapes.` };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: SALES AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════
exports.salesAutomationTool = genkit_config_1.ai.defineTool({
    name: 'sales_runAutomation',
    description: 'Run sales automation: deal won → invoice, deal lost → training assignment, stale leads → marketing campaign.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), automationType: zod_1.z.enum(['deal_won', 'deal_lost', 'stale_leads']) }),
    outputSchema: zod_1.z.object({ actions: zod_1.z.array(zod_1.z.string()), message: zod_1.z.string() }),
}, async ({ companyId, automationType }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const actions = [];
    if (automationType === 'deal_won') {
        // Find recently won deals without invoice
        const wonSnap = await db.collection(`companies/${companyId}/leads`).where('stage', '==', 'gagne').limit(20).get();
        for (const doc of wonSnap.docs) {
            const lead = doc.data();
            if (lead['invoiceCreated'])
                continue;
            const id = (0, helpers_1.generateId)();
            await db.collection(`companies/${companyId}/invoices`).doc(id).set({
                id, clientName: lead['company'] ?? lead['name'] ?? '',
                amount: lead['amount'] ?? lead['value'] ?? 0,
                status: 'pending', source: 'sales_automation', leadId: doc.id,
                createdAt: new Date(),
            });
            await doc.ref.update({ invoiceCreated: true, invoiceId: id });
            actions.push(`Facture creee pour ${lead['company'] ?? lead['name']} (${lead['amount'] ?? lead['value']}€)`);
        }
    }
    if (automationType === 'deal_lost') {
        const lostSnap = await db.collection(`companies/${companyId}/leads`).where('stage', '==', 'perdu').limit(20).get();
        const ownerIds = [...new Set(lostSnap.docs.map(d => d.data()['ownerId'] ?? '').filter(Boolean))];
        if (ownerIds.length > 0) {
            // Assign sales training
            const coursesSnap = await db.collection(`companies/${companyId}/trainingCourses`).where('category', '==', 'soft_skills').limit(1).get();
            if (!coursesSnap.empty) {
                for (const uid of ownerIds) {
                    await db.collection(`companies/${companyId}/trainingProgress`).doc((0, helpers_1.generateId)()).set({
                        courseId: coursesSnap.docs[0].id, userId: uid, status: 'assigned', completionPct: 0, score: 0,
                        assignedAt: new Date(), autoAssigned: true, assignReason: 'sales_deal_lost',
                    });
                }
                actions.push(`Formation assignee a ${ownerIds.length} vendeur(s) apres deals perdus`);
            }
        }
    }
    if (automationType === 'stale_leads') {
        const cutoff = new Date(Date.now() - 14 * 86400000);
        const staleSnap = await db.collection(`companies/${companyId}/leads`)
            .where('stage', 'in', ['nouveau', 'contacte']).limit(50).get();
        const stale = staleSnap.docs.filter(d => {
            const t = d.data()['updatedAt']?.toDate?.()?.getTime() ?? 0;
            return t < cutoff.getTime();
        });
        if (stale.length > 0) {
            // Create marketing nurture campaign notification
            const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
            createNotification({ companyId, type: 'agent_alert', title: `${stale.length} leads inactifs detectes`, message: `Creez une campagne de nurturing pour reactiver ces leads.`, actionUrl: '/comms/campaigns', icon: 'TrendingUp', severity: 'warning' }).catch(() => { });
            actions.push(`${stale.length} leads inactifs (>14j) detectes — notification marketing envoyee`);
        }
    }
    return { actions, message: actions.length > 0 ? `${actions.length} action(s) executee(s).` : 'Aucune action necessaire.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// E-SIGNATURE — send a quote/devis for client signature via Wemas
// ══════════════════════════════════════════════════════════════════════════════
exports.sendQuoteForSignatureTool = genkit_config_1.ai.defineTool({
    name: 'sales_sendQuoteForSignature',
    description: 'Envoie un devis au client pour signature électronique via Wemas. Récupère le devis (par quoteId), le client + son email, génère le contenu du devis, push vers Wemas, et envoie le lien de signature au client par email. Utilise APRÈS sales_createQuote. Le devis devient "signed" automatiquement quand le client signe.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        quoteId: zod_1.z.string().describe('Quote UUID returned by sales_createQuote'),
        senderName: zod_1.z.string().optional().describe('Salesperson name — defaults to company name'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        contractId: zod_1.z.string().optional(),
        signingUrl: zod_1.z.string().optional(),
        verificationCode: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, quoteId, senderName }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const { isWemasConfigured, createAndSendContract } = await Promise.resolve().then(() => __importStar(require('../services/wemas/wemasBridge')));
    if (!isWemasConfigured()) {
        return {
            success: false,
            message: 'Signature électronique non disponible : Wemas n\'est pas configuré. Le devis doit être signé manuellement.',
        };
    }
    const quoteDoc = await db.collection(`companies/${companyId}/quotes`).doc(quoteId).get();
    if (!quoteDoc.exists) {
        return { success: false, message: `Devis ${quoteId} introuvable. Vérifie l'ID.` };
    }
    const quote = quoteDoc.data() ?? {};
    const clientName = quote['clientName'] ?? 'Client';
    const clientEmail = quote['clientEmail'] ?? '';
    if (!clientEmail) {
        return { success: false, message: `Le devis n'a pas d'email client. Mets-le à jour avec sales_updateQuote.` };
    }
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const company = companyDoc.data() ?? {};
    const companyName = company['name'] ?? 'Notre entreprise';
    // Build a clean text version of the quote for Wemas display
    const items = Array.isArray(quote['items']) ? quote['items'] : [];
    const itemsLines = items.map(it => {
        const desc = String(it['description'] ?? it['name'] ?? 'Article');
        const qty = Number(it['quantity'] ?? 1);
        const unit = Number(it['unitPrice'] ?? it['price'] ?? 0);
        return `- ${desc} × ${qty} = ${(qty * unit).toLocaleString()}`;
    }).join('\n');
    const total = Number(quote['totalTTC'] ?? quote['total'] ?? 0);
    const currency = quote['currency'] ?? 'XOF';
    const validUntil = quote['validUntil'] ?? '30 jours';
    const quoteNumber = quote['quoteNumber'] ?? quoteId;
    const contractContent = `DEVIS N° ${quoteNumber}

Émis par ${companyName}
À l'attention de ${clientName}

OBJET
Proposition commerciale détaillée ci-dessous.

DÉTAIL
${itemsLines || '(détail à compléter)'}

TOTAL TTC : ${total.toLocaleString()} ${currency}

VALIDITÉ
${validUntil === '30 jours' ? 'Ce devis est valable 30 jours à compter de sa date d\'émission.' : `Ce devis est valable jusqu'au ${validUntil}.`}

ACCEPTATION
En signant ce devis électroniquement, le Client accepte les termes et conditions ci-dessus, et autorise ${companyName} à procéder à la prestation/livraison décrite.

CONDITIONS GÉNÉRALES
Paiement à 30 jours net à réception de la facture, sauf accord contraire.
Tout retard de paiement entraîne l'application de pénalités au taux légal en vigueur.

Fait à ${company['city'] ?? '____________'}, le ${new Date().toISOString().slice(0, 10)}.

Le Prestataire                         Le Client
${companyName}                         ${clientName}`;
    try {
        const result = await createAndSendContract({
            companyId,
            signatoryName: clientName,
            signatoryEmail: clientEmail,
            contractContent,
            contractType: 'prestation_services',
            senderName: senderName ?? companyName,
            sendNow: true,
        });
        // Cross-link Wemas contract back to the quote
        await quoteDoc.ref.update({
            wemasContractId: result.id,
            wemasSigningUrl: result.signingUrl,
            wemasVerificationCode: result.verificationCode,
            status: 'sent_for_signature',
            sentForSignatureAt: new Date(),
        }).catch(() => { });
        return {
            success: true,
            contractId: result.id,
            signingUrl: result.signingUrl,
            verificationCode: result.verificationCode,
            message: `Devis ${quoteNumber} envoyé à ${clientName} (${clientEmail}) pour signature. Code de vérification : ${result.verificationCode}. URL : ${result.signingUrl}.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[Sales] sendQuoteForSignature failed', { err: String(err), quoteId });
        return {
            success: false,
            message: `Échec envoi à Wemas : ${err.message ?? String(err)}.`,
        };
    }
});
const ALL_TOOLS = [
    exports.createLeadTool, exports.createClientTool, exports.getLeadsTool, exports.getClientTool, exports.getClientHistoryTool,
    exports.scoreLeadTool, exports.updateLeadStatusTool,
    exports.getPipelineTool, exports.updateDealStageTool,
    exports.createQuoteTool, exports.updateQuoteTool, exports.sendQuoteTool, exports.convertQuoteToSaleTool,
    exports.sendEmailTool, exports.sendWhatsAppTool,
    exports.scheduleFollowUpTool, exports.getPendingFollowUpsTool, exports.autoFollowUpTool,
    exports.getStatsTool, exports.forecastRevenueTool,
    // E-signature via Wemas
    exports.sendQuoteForSignatureTool,
    // PRO tools
    exports.aiScoreLeadTool, exports.dealInsightsTool, exports.winLossAnalysisTool, exports.teamPerformanceTool,
    exports.createEmailSequenceTool, exports.salesAutomationTool,
];
// ══════════════════════════════════════════════════════════════════════════════
// AGENT FLOW
// ══════════════════════════════════════════════════════════════════════════════
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({
    response: zod_1.z.string(),
    quoteId: zod_1.z.string().optional(),
    hotLeads: zod_1.z.number().optional(),
});
exports.salesAgentFlow = genkit_config_1.ai.defineFlow({ name: 'salesAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, userId, language, history }) => {
    try {
        logger_1.logger.info(`[SalesAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
        const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;
        const dateAnchors = (() => {
            const now = new Date();
            const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
            return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
        })();
        // Read company currency from settings (XOF/EUR/USD/...)
        let currency = 'EUR';
        try {
            const db = (0, firebase_config_1.getFirestore)();
            const c = await db.collection('companies').doc(companyId).get();
            currency = c.data()?.['settings']?.currency ?? c.data()?.['currency'] ?? 'EUR';
        }
        catch { /* fallback EUR */ }
        const executors = new Map();
        for (const tool of ALL_TOOLS) {
            const name = tool.__action?.name ?? '';
            if (name)
                executors.set(name, (i) => tool({ ...i, companyId }));
        }
        const messages = [];
        if (history && history.length > 0) {
            for (const h of history.slice(-20)) {
                messages.push({ role: h.role, content: [{ text: h.content }] });
            }
        }
        messages.push({ role: 'user', content: [{ text: request }] });
        let response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            system: `Tu es l'Agent Commercial PRO de l'entreprise — directeur des ventes virtuel, du lead à l'encaissement.
CompanyID: ${companyId}. UserID: ${userId ?? 'unknown'}.
Devise par défaut : ${currency}.

## 📅 CONTEXTE TEMPOREL
${dateAnchors}
Pour les devis valides X jours, relances, prévisions trimestrielles — utilise cette ancre.

## 🧠 MÉMOIRE CONVERSATIONNELLE — DEVIS, LEADS, CLIENTS RÉFÉRENCÉS
RÈGLE D'OR : conserve TOUJOURS le DERNIER devis / lead / client mentionné dans ta mémoire active.
Quand l'utilisateur dit :
• "ce devis" / "celui-là" / "le #1" → utilise le devis de TA DERNIÈRE liste/réponse
• "Envoie-le à client@example.com" → appelle sales_sendQuote(quoteId=<dernier devis>, recipientEmail=...)
• "Convertis-le en facture" → appelle sales_convertQuoteToSale(quoteId=<dernier devis>)
• "Relance ce lead" → appelle sales_sendEmail/sales_sendWhatsApp avec le lead courant
• Si l'utilisateur répond par un numéro ('1', '2', '3'), références-toi à TA DERNIÈRE liste

Format devis : DEV-YYYY-XXXX. Format facture : FAC-YYYY-XXXX. Les tools acceptent UUID ou ce format.

## TON RÔLE
Tu pilotes TOUT le cycle commercial : leads, qualification, pipeline, devis, communication, relances, analytics.

CAPACITÉS :
1. LEADS : créer, qualifier, scorer (sales_createLead, sales_getLeads, sales_scoreLead, sales_aiScoreLead, sales_updateLeadStatus)
2. CLIENTS : créer/lire fiche client, historique (sales_createClient, sales_getClient, sales_getClientHistory)
3. PIPELINE : étapes nouveau → contacté → intéressé → devis_envoye → négociation → gagné/perdu (sales_getPipeline, sales_updateDealStage)
4. DEVIS : créer, envoyer (avec PDF), accepter, convertir en facture (sales_createQuote, sales_sendQuote, sales_updateQuote, sales_convertQuoteToSale)
5. COMMUNICATION : email (sales_sendEmail), WhatsApp (sales_sendWhatsApp), séquences (sales_createEmailSequence)
6. RELANCES : programmer, lister, auto-détecter (sales_scheduleFollowUp, sales_getPendingFollowUps, sales_autoFollowUp)
7. ANALYTICS : stats, prévisions, win/loss, performance équipe (sales_getStats, sales_forecastRevenue, sales_winLossAnalysis, sales_getTeamPerformance, sales_getDealInsights)
8. AUTOMATIONS : deal_won → facture, deal_lost → formation, stale_leads → marketing (sales_runAutomation)

RÈGLES :
- Sois proactif : signale leads chauds (score ≥70), relances en retard, opportunités de revenu
- Quand un devis est accepté, propose la conversion en facture
- Utilise la devise ${currency} dans tes réponses (jamais "EUR" si la société est en XOF)
- IDs complets (jamais "abc..." tronqué)

## 🚫 ZÉRO FABRICATION — PROCÉDURE OBLIGATOIRE

**Pour CHAQUE action demandée par l'utilisateur, suis cet algorithme exact :**

### A. Conversion devis → facture
Action requise : appeler \`sales_convertQuoteToSale(quoteId=<uuid_du_devis>)\`
- Si la réponse contient \`success: true\` → réponds : "Facture <invoiceNumber> créée (UUID: <invoiceId>, montant: <totalTTC> ${currency})"
- Si la réponse contient \`success: false\` → réponds : "<message exact du tool>"
- AUTRE comportement INTERDIT. Ne dis jamais "sync issue", "module séparé", "comptabilité ne reconnaît pas". Le système n'a qu'UNE base Firestore commune.

### B. Création de devis
Action requise : appeler \`sales_createQuote\`. Réponds avec le \`quoteNumber\` ET le \`quoteId\` UUID retournés.

### C. Envoi devis
Action requise : appeler \`sales_sendQuote\`. Confirme l'envoi avec \`success: true\`, sinon affiche le message d'erreur.

### D. Liste (leads, devis, factures, clients)
Affiche EXACTEMENT les éléments retournés par le tool. Ne mentionne JAMAIS un élément absent en disant "en cours d'enregistrement". Si quelque chose manque, dis simplement "X items dans la liste".

### E. Comptage / Inventaire (combien de leads, devis, clients, factures ?)
**RÈGLE STRICTE** : pour TOUTE question "combien de X" / "j'ai cbien de X" / "nombre de X" / "X total" → tu DOIS appeler le tool de liste avant de répondre. JAMAIS répondre "je n'ai pas pu récupérer" ou "l'information n'est pas disponible" sans avoir essayé le tool.
- "combien de leads" / "j'ai cbien de lead" → \`sales_getLeads(companyId)\` puis utilise \`total\` du retour
- "combien de devis" → \`sales_getQuotes(companyId)\` puis \`total\`
- "combien de clients" → \`sales_getClients\` ou parcours \`sales_getLeads\` sur stage=client_actif
- "combien de factures" → \`sales_getInvoices\`
Réponse type : "Tu as *N* leads dont *X* chauds (score ≥70)." Donne le chiffre TOUJOURS, même si N=0 ("Aucun lead enregistré pour l'instant — veux-tu que j'en crée un ?").

### Règle universelle
Tu n'as PAS LE DROIT d'inventer une explication d'échec sans avoir appelé le tool concerné. Pour TOUTE action demandée, le tool DOIT être appelé en premier. Sa réponse est la vérité — pas tes suppositions.
2. Pour CHAQUE entité créée (lead, devis, facture, client), affiche systématiquement son identifiant dans ta réponse :
   - Lead : leadId UUID (ex : "Lead Marie Diallo créé. ID: 46226dcd-4e42...")
   - Devis : numéro \`DEV-YYYY-XXXX\` ET UUID
   - Facture : numéro \`FAC-YYYY-XXXX\` ET UUID
   - Client : clientId UUID
   L'utilisateur en a besoin pour la suite. **Mémorise tous ces IDs dans ta mémoire active** pour les références ultérieures ("ce devis", "ce lead").
3. Pour CHAQUE liste (leads, devis, factures, etc.) : affiche EXACTEMENT ce que le tool retourne, ni plus ni moins. N'AJOUTE PAS de narratif sur des items absents ("Marie est en cours d'enregistrement"). Si un item attendu n'est pas dans la liste, dis-le clairement : "Marie Diallo n'apparaît pas dans cette liste (peut-être pas encore indexée — relancez si besoin)".
4. Si \`sales_convertQuoteToSale\` renvoie "introuvable", NE RECRÉE PAS le devis. Demande à l'utilisateur le numéro DEV-YYYY-XXXX exact, ou utilise le UUID complet de TA mémoire conversationnelle.
5. Si une action multi-étapes (ex : "crée un devis pour Marie et envoie-le"), exécute les tools dans l'ordre et confirme CHAQUE étape avec son résultat réel — y compris les échecs.
${langInstr}`,
            messages,
            tools: ALL_TOOLS,
            maxTurns: 12,
            config: { temperature: 0.3 },
        });
        let loopCount = 0;
        while (response.toolRequests.length > 0 && loopCount < 8) {
            loopCount++;
            const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
                const { name, input, ref } = p.toolRequest;
                const exec = executors.get(name);
                const inp = { ...input, companyId };
                const output = exec ? await exec(inp) : { error: `Unknown tool: ${name}` };
                return { name, ref, output };
            }));
            response = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                messages: [
                    ...response.messages,
                    { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
                ],
                tools: ALL_TOOLS,
                maxTurns: 12,
                config: { temperature: 0.3 },
            });
        }
        const text = response.text;
        const quoteMatch = text.match(/DEV-\d{4}-\d{4}/);
        const hotMatch = text.match(/(\d+)\s*(hot|chaud)/i);
        return { response: text, quoteId: quoteMatch?.[0], hotLeads: hotMatch ? parseInt(hotMatch[1]) : undefined };
    }
    catch (err) {
        logger_1.logger.error('[SalesAgent] Flow error:', err);
        return { response: 'Une erreur est survenue dans l\'agent commercial. Veuillez réessayer.' };
    }
});
exports.salesAgentTool = genkit_config_1.ai.defineTool({
    name: 'callSalesAgent',
    description: 'Sales CRM PRO: leads, AI scoring, pipeline, quotes, email sequences, WhatsApp, follow-ups, team performance, win/loss analysis, deal insights, revenue forecast, cross-agent automation.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, async (input) => {
    try {
        return await (0, exports.salesAgentFlow)(input);
    }
    catch (err) {
        logger_1.logger.error('[callSalesAgent] Error:', err);
        return { response: 'Erreur agent commercial.' };
    }
});
//# sourceMappingURL=sales.agent.js.map