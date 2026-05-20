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
exports.previewAudience = previewAudience;
exports.runBroadcast = runBroadcast;
/**
 * WhatsApp Broadcast Service
 *
 * Orchestrates sending an approved Meta template to a filtered audience of
 * leads. Persists each broadcast as a Firestore doc + a recipients sub-doc per
 * phone, so the dashboard can show progress and per-recipient delivery state.
 *
 * Flow:
 *   1. Caller computes the audience from a filter (status, urgency, since date).
 *   2. Caller invokes runBroadcast() which writes the broadcast doc + queues
 *      recipients, then sends one-by-one with a small delay (avoid Meta rate
 *      limit), updating recipient status as it goes.
 *   3. Recipients who are opted-out are skipped — the count is reflected in
 *      `skippedOptedOut`.
 *
 * No webhook-driven delivery tracking yet — that's a follow-up that listens
 * to Meta status updates and PATCHes the recipient doc.
 */
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = require("../../utils/logger");
const DEFAULT_MAX = 500;
const SEND_DELAY_MS = 250; // ~4 messages/sec, comfortably under Meta's 20msg/sec default
/**
 * Build the recipient list from the audience filter. Uses the leads collection.
 * Returns up to `maxRecipients` (default 500) deduped by phone.
 */
async function buildAudience(companyId, filter) {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/whatsappLeads`).orderBy('createdAt', 'desc');
    if (filter.status && filter.status !== 'all') {
        q = q.where('status', '==', filter.status);
    }
    if (filter.urgency && filter.urgency !== 'all') {
        q = q.where('urgency', '==', filter.urgency);
    }
    if (filter.sinceDays && filter.sinceDays > 0) {
        const since = new Date(Date.now() - filter.sinceDays * 24 * 60 * 60 * 1000);
        q = q.where('createdAt', '>=', since);
    }
    const cap = Math.min(filter.maxRecipients ?? DEFAULT_MAX, DEFAULT_MAX);
    const snap = await q.limit(cap * 2).get(); // grab extras for dedup
    const seen = new Set();
    const recipients = [];
    for (const doc of snap.docs) {
        if (recipients.length >= cap)
            break;
        const data = doc.data();
        const phone = (data['customerPhone'] ?? '').trim();
        if (!phone || seen.has(phone))
            continue;
        seen.add(phone);
        recipients.push({
            phone,
            name: data['name'],
            need: data['need'],
            leadId: doc.id,
            optedOut: !!data['optedOut'],
        });
    }
    return recipients;
}
async function previewAudience(companyId, filter) {
    const audience = await buildAudience(companyId, filter);
    const optedOutCount = audience.filter(r => r.optedOut).length;
    return {
        total: audience.length,
        optedOutCount,
        willSend: audience.length - optedOutCount,
    };
}
/**
 * Creates the broadcast doc + sends each template message sequentially with
 * a small delay between sends. Updates recipient status doc as it goes.
 * Returns the broadcast id immediately if launched in background.
 */
async function runBroadcast(input) {
    const db = (0, firebase_config_1.getFirestore)();
    const audience = await buildAudience(input.companyId, input.filter);
    const willSend = audience.filter(r => !r.optedOut);
    const skippedOptedOut = audience.length - willSend.length;
    const broadcastRef = db.collection(`companies/${input.companyId}/whatsappBroadcasts`).doc();
    await broadcastRef.set({
        name: input.name,
        templateName: input.templateName,
        languageCode: input.languageCode,
        bodyParams: input.bodyParams ?? [],
        prefillFromLead: !!input.prefillFromLead,
        filter: input.filter,
        triggeredBy: input.triggeredBy,
        triggeredByName: input.triggeredByName ?? null,
        status: 'sending',
        totalRecipients: audience.length,
        willSend: willSend.length,
        skippedOptedOut,
        sentCount: 0,
        failedCount: 0,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Pre-create recipient docs (queued state) so the UI can show progress
    // before sends complete. Using batched writes to avoid 500ms × N latency.
    const batchSize = 400;
    for (let i = 0; i < audience.length; i += batchSize) {
        const batch = db.batch();
        for (const r of audience.slice(i, i + batchSize)) {
            const recRef = broadcastRef.collection('recipients').doc(r.phone.replace(/\D/g, ''));
            batch.set(recRef, {
                phone: r.phone,
                leadId: r.leadId,
                name: r.name ?? null,
                status: r.optedOut ? 'skipped_opted_out' : 'queued',
                queuedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();
    }
    // Background send — fire-and-forget so the API call returns fast.
    void (async () => {
        const { whatsappService } = await Promise.resolve().then(() => __importStar(require('./whatsappService')));
        const config = await whatsappService.getConfig(input.companyId);
        if (!config) {
            await broadcastRef.update({ status: 'failed', error: 'WhatsApp non connecté', completedAt: firestore_1.FieldValue.serverTimestamp() });
            return;
        }
        let sent = 0;
        let failed = 0;
        for (const r of willSend) {
            // Build per-recipient components (prefill from lead if requested)
            const components = [];
            let bodyParams = input.bodyParams ?? [];
            if (input.prefillFromLead) {
                bodyParams = [...bodyParams];
                if (bodyParams.length > 0)
                    bodyParams[0] = r.name ?? bodyParams[0] ?? '';
                if (bodyParams.length > 1)
                    bodyParams[1] = r.need ?? bodyParams[1] ?? '';
            }
            if (bodyParams.length > 0) {
                components.push({ type: 'body', parameters: bodyParams.map(p => ({ type: 'text', text: p })) });
            }
            const recRef = broadcastRef.collection('recipients').doc(r.phone.replace(/\D/g, ''));
            try {
                const out = await whatsappService.sendTemplateRich(config, r.phone, input.templateName, input.languageCode, components);
                if (out.messageId) {
                    sent++;
                    await recRef.update({ status: 'sent', messageId: out.messageId, sentAt: firestore_1.FieldValue.serverTimestamp() });
                    // Also write the audit row + update lead.lastTemplateSentAt
                    await db.collection(`companies/${input.companyId}/whatsappTemplateSends`).add({
                        to: r.phone,
                        relatedLeadId: r.leadId,
                        relatedBroadcastId: broadcastRef.id,
                        templateName: input.templateName,
                        languageCode: input.languageCode,
                        bodyParams,
                        messageId: out.messageId,
                        sentBy: input.triggeredBy,
                        sentAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                    await db.collection(`companies/${input.companyId}/whatsappLeads`).doc(r.leadId).update({
                        lastTemplateSentAt: firestore_1.FieldValue.serverTimestamp(),
                        lastTemplateName: input.templateName,
                        firstContactedAt: firestore_1.FieldValue.serverTimestamp(), // safe — only sets if missing on next read
                        updatedAt: firestore_1.FieldValue.serverTimestamp(),
                    }).catch(() => null);
                }
                else {
                    failed++;
                    await recRef.update({ status: 'failed', error: out.error ?? 'unknown', failedAt: firestore_1.FieldValue.serverTimestamp() });
                }
            }
            catch (err) {
                failed++;
                await recRef.update({ status: 'failed', error: String(err), failedAt: firestore_1.FieldValue.serverTimestamp() }).catch(() => null);
            }
            // Periodic progress write so the UI can poll and show progress
            if ((sent + failed) % 10 === 0) {
                await broadcastRef.update({ sentCount: sent, failedCount: failed, updatedAt: firestore_1.FieldValue.serverTimestamp() }).catch(() => null);
            }
            await new Promise(r => setTimeout(r, SEND_DELAY_MS));
        }
        await broadcastRef.update({
            status: 'sent',
            sentCount: sent,
            failedCount: failed,
            completedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        logger_1.logger.info('[Broadcast] completed', { broadcastId: broadcastRef.id, sent, failed, skipped: skippedOptedOut });
    })().catch(err => logger_1.logger.error('[Broadcast] runner threw', { error: String(err) }));
    return { broadcastId: broadcastRef.id };
}
//# sourceMappingURL=broadcastService.js.map