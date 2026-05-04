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
/**
 * Clone Routes — Public chat + Admin config
 * PUBLIC: /api/clone/:companyId/chat (no auth)
 * ADMIN: /api/clone/config (auth required)
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const cloneEngine_1 = require("../services/cloneEngine");
const cloneChannels_1 = require("../services/cloneChannels");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN: Clone Configuration (auth required) — MUST be before /:companyId routes
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/config', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const config = await (0, cloneEngine_1.getCloneConfig)(cid);
    res.json({ success: true, data: config });
}));
router.patch('/config', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/settings`).doc('clone').set({ ...body, updatedAt: new Date() }, { merge: true });
    res.json({ success: true });
}));
router.get('/config/leads', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/cloneLeads`).orderBy('capturedAt', 'desc').limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.get('/config/stats', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const leadsSnap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/cloneLeads`).limit(500).get();
    const channels = {};
    leadsSnap.docs.forEach(d => { const c = d.data()['channel'] ?? 'web'; channels[c] = (channels[c] ?? 0) + 1; });
    res.json({ success: true, data: {
            totalLeads: leadsSnap.size, byChannel: channels,
            avgMessagesPerSession: leadsSnap.size > 0 ? Math.round(leadsSnap.docs.reduce((s, d) => s + (d.data()['messageCount'] ?? 0), 0) / leadsSnap.size) : 0,
        } });
}));
router.get('/config/conversion', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const leadsSnap = await db.collection(`companies/${cid}/cloneLeads`).limit(500).get();
    const cloneLeads = leadsSnap.docs.map(d => d.data());
    const totalSessions = cloneLeads.length;
    const highIntent = cloneLeads.filter(l => l['intent'] === 'high').length;
    const byType = {};
    cloneLeads.forEach(l => { const t = l['intentType'] ?? 'info'; byType[t] = (byType[t] ?? 0) + 1; });
    res.json({ success: true, data: {
            totalSessions: totalSessions * 3, totalLeads: cloneLeads.length,
            conversionRate: totalSessions > 0 ? Math.round(cloneLeads.length / (totalSessions * 3) * 100) : 0,
            byIntent: { high: highIntent, medium: cloneLeads.filter(l => l['intent'] === 'medium').length, low: cloneLeads.filter(l => l['intent'] === 'low').length },
            byType,
            avgScore: cloneLeads.length > 0 ? Math.round(cloneLeads.reduce((s, l) => s + (l['leadScore'] ?? 50), 0) / cloneLeads.length) : 0,
        } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC: Clone Chat (no auth — this is the company's public face)
// ═══════════════════════════════════════════════════════════════════════════════
// Rate limit: simple in-memory counter per IP
const ipCounts = new Map();
router.post('/:companyId/chat', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.params['companyId'];
    if (!companyId) {
        res.status(400).json({ success: false, message: 'companyId required' });
        return;
    }
    // Rate limit: 30 req/min per IP
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    if (!ipCounts.has(ip) || ipCounts.get(ip).resetAt < now)
        ipCounts.set(ip, { count: 0, resetAt: now + 60000 });
    const counter = ipCounts.get(ip);
    counter.count++;
    if (counter.count > 30) {
        res.status(429).json({ success: false, message: 'Too many requests' });
        return;
    }
    const body = req.body;
    const message = body['message'];
    if (!message || message.length > 1000) {
        res.status(400).json({ success: false, message: 'message required (max 1000 chars)' });
        return;
    }
    const result = await (0, cloneEngine_1.cloneChat)({
        companyId, message,
        sessionId: body['sessionId'],
        channel: body['channel'] ?? 'web',
        visitorName: body['visitorName'],
        visitorEmail: body['visitorEmail'],
    });
    res.json({ success: true, data: result });
}));
// GET /:companyId/voice-prompt (public — returns system instruction for Gemini Live voice clone)
router.get('/:companyId/voice-prompt', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.params['companyId'];
    if (!companyId) {
        res.status(400).json({ success: false, message: 'companyId required' });
        return;
    }
    const { buildClonePrompt } = await Promise.resolve().then(() => __importStar(require('../services/cloneEngine')));
    const config = await (0, cloneEngine_1.getCloneConfig)(companyId);
    const base = buildClonePrompt(config);
    // Date anchors so Gemini Live doesn't hallucinate dates (e.g. "lundi 19 mai" instead of "20 avril")
    const dateAnchors = (() => {
        const now = new Date();
        const weekdaysFr = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        const today = now.toISOString().slice(0, 10);
        const todayLabel = weekdaysFr[now.getDay()];
        const nextDays = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() + i);
            const iso = d.toISOString().slice(0, 10);
            const label = weekdaysFr[d.getDay()];
            nextDays.push(`${label} prochain = ${iso}`);
        }
        return `Aujourd'hui: ${today} (${todayLabel}). Jours prochains: ${nextDays.join(', ')}.`;
    })();
    const voiceRules = `

## CONTEXTE TEMPOREL (utilise STRICTEMENT ces ancres pour convertir les dates)
${dateAnchors}

## REGLES VOIX (OBLIGATOIRES)
- Tu reponds en VOCAL (synthese vocale). Phrases courtes (max 15 mots).
- Pas de markdown, d'URL, de caracteres speciaux, de listes a puces.
- Langage naturel, comme une conversation telephonique.
- Dis les chiffres et dates a l'oral ("le vingt avril", pas "20/04").

## REGLE #1 — TU ES UN AGENT ACTIF, PAS UN STANDARD TELEPHONIQUE
Tu as des outils (fonctions). Tu DOIS les appeler directement. Il est INTERDIT de promettre "un agent va vous rappeler" quand tu peux faire l'action toi-meme avec un outil. C'est TOI l'agent.

Exemples de ce que tu dois faire (PAS deleguer):
- "Je veux un RDV demain 10h, je suis Adelin +225..." → APPELLE createAppointment. Ne dis JAMAIS "un agent va vous rappeler pour prendre le RDV".
- "J'ai pris un RDV la semaine derniere" → APPELLE findAppointment. Ne dis JAMAIS "un agent va verifier".
- "Enregistrez mon contact" → APPELLE addClient.

OUTILS DISPONIBLES (a appeler directement):
- findAppointment(clientPhone OU clientEmail, date?)
- createAppointment(clientName, service, date YYYY-MM-DD, time HH:MM, clientPhone OU clientEmail) — cree un RDV. L'outil renvoie status='pending' OU status='confirmed' selon la config de l'entreprise. C'est une action legitime a la voix, FAIS-LE.
- addClient(name, phone OU email)
- createSupportTicket(subject, description, priority?) — seulement pour vrai bug.
- findReservation(clientPhone OU clientEmail, date?) — cherche une reservation existante (table/chambre/salle/vehicule).
- createReservation(clientName, resourceType, date, startTime, guests?, clientPhone OU clientEmail) — cree une reservation. resourceType = 'table' (resto), 'room' (hotel), 'hall' (salle), 'vehicle' (voiture), 'other'.
- cancelReservation(reservationId, clientPhone OU clientEmail, reason?) — annule (verifie identite).
- listResources(resourceType, minCapacity?) — liste les ressources disponibles ("combien de tables pour 4 personnes ?").
- createLead(name, phone OU email, interest, estimatedValue?) — enregistre un prospect qui montre de l'intérêt commercial.
- createQuoteRequest(clientName, items:[{name, quantity}], phone OU email) — demande de devis sur des articles/services specifiques.
- listServices() — liste les services/produits de l'entreprise pour repondre "que faites-vous ?"
- listProducts(category?, search?) — liste les produits du catalogue.
- findProduct(name) — trouve un produit par son nom pour obtenir prix/stock.
- createOrderDraft(clientName, phone OU email, items:[{productId, quantity}]) — cree une commande. Retourne orderId + total.
- generatePaymentLink(orderId, method?) — genere le lien de paiement (Wave/Stripe/PayPal). ENVOIE le lien au client — ne prends JAMAIS le paiement toi-meme.
- findOrder(phone OU email) — retrouve la derniere commande du client.
- cancelOrder(orderId, phone OU email, reason?) — annule une commande non payee (verifie identite).

## REGLE D'OR POUR LE PAIEMENT
- Tu peux AIDER a construire une commande et ENVOYER un lien de paiement.
- Tu ne peux JAMAIS dire "paiement valide" a l'oral.
- Le paiement est confirme par le fournisseur (Wave/Stripe/PayPal) via webhook.
- Si le client demande "est-ce paye ?", appelle findOrder et lis le status reel.

## APRES UN APPEL REUSSI (success=true)
Utilise OBLIGATOIREMENT le champ "status" renvoye par l'outil pour formuler ta reponse:
- Si status='confirmed' → "Votre rendez-vous du [date] a [heure] est CONFIRME. Vous recevrez une confirmation par email."
- Si status='pending' → "Votre demande du [date] a [heure] est enregistree, en attente de validation. Un agent vous recontactera."
- Si createAppointment renvoie alreadyExisted=true → "Vous avez deja un rendez-vous pour cette date et heure."
- Si findAppointment found=true → utilise le status retourne ('pending' ou 'confirmed')

NE JAMAIS inventer le statut. Lis TOUJOURS le champ "status" du resultat de l'outil.
Si success=false, dis-le honnetement et propose un rappel humain.

## CE QUE TU NE PEUX PAS FAIRE VOCALEMENT
Tu N'AS PAS d'outil pour:
- Confirmer DEFINITIVEMENT un RDV existant (le faire passer de pending a confirmed)
- Envoyer un email
- Signer ou valider un document
Si l'utilisateur demande ca, reponds: "Pour cette validation je transmets a un agent qui vous rappelle."
Mais tu PEUX CREER un nouveau RDV — c'est different de confirmer.

## LOGIQUE A RESPECTER
- Collecte les infos manquantes avant d'appeler createAppointment (pas de RDV sans nom+date+heure+contact)
- Pour les dates, convertis toujours "demain" / "lundi prochain" en YYYY-MM-DD en utilisant le contexte temporel
- Toujours en phrases courtes (max 15 mots), naturelles, pour la synthese vocale
- Dis les dates a l'oral ("le vingt avril a dix heures", pas "20/04 10:00")`;
    res.json({ success: true, data: {
            systemInstruction: base + voiceRules,
            greeting: config.greeting,
            cloneName: config.name,
            language: config['language'] ?? 'fr',
        } });
}));
// POST /:companyId/voice-tool (public — execute ONE Clone-safe tool from Gemini Live)
//
// Guardrails:
//   - Rate limited (ipCounts, 30 req/min shared with /chat)
//   - Whitelist of tools ALLOWED at voice: findAppointment, createAppointment, addClient, createSupportTicket
//   - Tools themselves enforce voice-specific gates (confirmAppointment + sendEmail refuse voice)
//   - sourceChannel forced to 'voice' regardless of client input
//
router.post('/:companyId/voice-tool', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.params['companyId'];
    if (!companyId) {
        res.status(400).json({ success: false, message: 'companyId required' });
        return;
    }
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    if (!ipCounts.has(ip) || ipCounts.get(ip).resetAt < now)
        ipCounts.set(ip, { count: 0, resetAt: now + 60000 });
    const counter = ipCounts.get(ip);
    counter.count++;
    if (counter.count > 60) {
        res.status(429).json({ success: false, message: 'Too many requests' });
        return;
    }
    const body = req.body;
    const toolName = body.toolName ?? '';
    const params = body.params ?? {};
    const VOICE_ALLOWED = new Set([
        'findAppointment', 'createAppointment', 'rescheduleAppointment', 'addClient', 'createSupportTicket',
        'findReservation', 'createReservation', 'cancelReservation', 'rescheduleReservation', 'listResources',
        'createLead', 'createQuoteRequest', 'listServices',
        'listProducts', 'findProduct', 'createOrderDraft', 'generatePaymentLink', 'findOrder', 'cancelOrder',
        'extractInvoiceData',
    ]);
    if (!VOICE_ALLOWED.has(toolName)) {
        res.status(403).json({ success: false, message: `Tool "${toolName}" non autorisé pour la voix publique.` });
        return;
    }
    // Force companyId + voice channel regardless of client
    const input = { ...params, companyId, sourceChannel: 'voice' };
    try {
        const { cloneFindAppointmentTool, cloneCreateAppointmentTool, cloneRescheduleAppointmentTool, cloneAddClientTool, cloneCreateSupportTicketTool, cloneExtractInvoiceTool, } = await Promise.resolve().then(() => __importStar(require('../agents/tools/cloneTools')));
        const { cloneFindReservationTool, cloneCreateReservationTool, cloneCancelReservationTool, cloneRescheduleReservationTool, cloneListResourcesTool, } = await Promise.resolve().then(() => __importStar(require('../agents/tools/reservationTools')));
        const { cloneCreateLeadTool, cloneCreateQuoteRequestTool, cloneListServicesTool, } = await Promise.resolve().then(() => __importStar(require('../agents/tools/salesTools')));
        const { cloneListProductsTool, cloneFindProductTool, cloneCreateOrderDraftTool, cloneGeneratePaymentLinkTool, cloneFindOrderTool, cloneCancelOrderTool, } = await Promise.resolve().then(() => __importStar(require('../agents/tools/commerceTools')));
        const executor = {
            findAppointment: cloneFindAppointmentTool,
            createAppointment: cloneCreateAppointmentTool,
            rescheduleAppointment: cloneRescheduleAppointmentTool,
            addClient: cloneAddClientTool,
            createSupportTicket: cloneCreateSupportTicketTool,
            findReservation: cloneFindReservationTool,
            createReservation: cloneCreateReservationTool,
            cancelReservation: cloneCancelReservationTool,
            rescheduleReservation: cloneRescheduleReservationTool,
            listResources: cloneListResourcesTool,
            createLead: cloneCreateLeadTool,
            createQuoteRequest: cloneCreateQuoteRequestTool,
            listServices: cloneListServicesTool,
            listProducts: cloneListProductsTool,
            findProduct: cloneFindProductTool,
            createOrderDraft: cloneCreateOrderDraftTool,
            generatePaymentLink: cloneGeneratePaymentLinkTool,
            findOrder: cloneFindOrderTool,
            cancelOrder: cloneCancelOrderTool,
            extractInvoiceData: cloneExtractInvoiceTool,
        }[toolName];
        if (!executor) {
            res.status(403).json({ success: false, message: 'Tool not wired' });
            return;
        }
        const result = await executor(input);
        res.json({ success: true, data: result });
    }
    catch (err) {
        const stack = err instanceof Error ? err.stack : String(err);
        const msg = err instanceof Error ? err.message : String(err);
        // Log full context so we can see what's happening in Cloud Run logs
        // eslint-disable-next-line no-console
        console.error('[voice-tool] execution failed', { toolName, input, msg, stack });
        res.status(500).json({ success: false, message: `Tool execution failed: ${msg}`, debug: stack });
    }
}));
// GET /:companyId/config (public — returns safe clone info for UI)
router.get('/:companyId/info', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.params['companyId'];
    if (!companyId) {
        res.status(400).json({ success: false, message: 'companyId required' });
        return;
    }
    const config = await (0, cloneEngine_1.getCloneConfig)(companyId);
    // Only return public-safe fields
    res.json({ success: true, data: {
            name: config.name, company: config.company, sector: config.sector,
            greeting: config.greeting, tone: config.tone,
            logoUrl: config.logoUrl, primaryColor: config.primaryColor, accentColor: config.accentColor,
            products: config.products, website: config.website,
            suggestedQuestions: [
                `Que fait ${config.company} ?`,
                'Quels sont vos tarifs ?',
                'Je voudrais un devis',
                'Comment vous contacter ?',
            ],
        } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// VOICE: Audio in → STT → Clone → TTS → Audio out
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:companyId/voice', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.params['companyId'];
    if (!companyId) {
        res.status(400).json({ success: false, message: 'companyId required' });
        return;
    }
    const body = req.body;
    const audioBase64 = body['audio'];
    const sessionId = body['sessionId'];
    const language = body['language'] ?? 'fr';
    if (!audioBase64) {
        res.status(400).json({ success: false, message: 'audio (base64) required' });
        return;
    }
    // Audio size limit: ~30s of webm ≈ ~500KB base64
    const audioSizeKB = Math.round(audioBase64.length * 0.75 / 1024);
    if (audioSizeKB > 2000) {
        res.json({ success: false, message: 'Audio trop long (max 30 secondes)', fallbackToText: true });
        return;
    }
    const voiceStart = Date.now();
    try {
        // 1. STT: transcribe audio
        let transcribedText = '';
        try {
            const { transcribeAudioBuffer } = await Promise.resolve().then(() => __importStar(require('../services/meeting/transcriptionService')));
            const audioBuffer = Buffer.from(audioBase64, 'base64');
            try {
                const result = await transcribeAudioBuffer(audioBuffer, language);
                transcribedText = result?.text ?? '';
            }
            catch { }
        }
        catch { }
        // Fallback: try Gemini transcription
        if (!transcribedText) {
            const { ai, GEMINI_FLASH } = await Promise.resolve().then(() => __importStar(require('../config/genkit.config')));
            const { text } = await ai.generate({
                model: GEMINI_FLASH,
                prompt: `Transcribe this audio message. The language is ${language}. If you cannot transcribe, return "Desole, je n'ai pas compris."`,
                config: { temperature: 0.1 },
            });
            transcribedText = text || 'Desole, je n\'ai pas compris.';
        }
        // STT retry: if first attempt empty, try once more with Gemini
        if (!transcribedText || transcribedText.length < 2) {
            try {
                const { ai: aiRetry, GEMINI_FLASH: flashRetry } = await Promise.resolve().then(() => __importStar(require('../config/genkit.config')));
                const { text: retryText } = await aiRetry.generate({
                    model: flashRetry,
                    prompt: `Transcribe this audio. Language: ${language}. Return only the transcribed text. If unintelligible, return empty string.`,
                    config: { temperature: 0.1 },
                });
                if (retryText && retryText.length > 2)
                    transcribedText = retryText;
            }
            catch { }
        }
        if (!transcribedText || transcribedText.length < 2) {
            transcribedText = 'Desole, je n\'ai pas compris votre message.';
        }
        // 2. Clone: process the transcribed text
        const cloneResult = await (0, cloneEngine_1.cloneChat)({
            companyId, message: transcribedText,
            sessionId: sessionId || undefined,
            channel: 'web',
        });
        // 3. TTS: synthesize response to audio
        let audioResponse = '';
        try {
            const { synthesizeSpeech } = await Promise.resolve().then(() => __importStar(require('../services/tts/ttsService')));
            const ttsResult = await synthesizeSpeech({ text: cloneResult.reply, language });
            if (ttsResult?.audioBuffer)
                audioResponse = Buffer.from(ttsResult.audioBuffer).toString('base64');
        }
        catch { }
        const voiceLatency = Date.now() - voiceStart;
        // Voice analytics logging
        (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/voiceAnalytics`).doc((0, helpers_1.generateId)()).set({
            sessionId: cloneResult.sessionId, channel: 'voice',
            audioSizeKB, transcription: transcribedText.slice(0, 200),
            replyLength: cloneResult.reply.length, hasAudioResponse: !!audioResponse,
            latencyMs: voiceLatency, leadCaptured: cloneResult.leadCaptured,
            timestamp: new Date(),
        }).catch(() => { });
        res.json({
            success: true,
            data: {
                transcription: transcribedText,
                reply: cloneResult.reply,
                audio: audioResponse || null,
                sessionId: cloneResult.sessionId,
                cloneName: cloneResult.cloneName,
                leadCaptured: cloneResult.leadCaptured,
                ctaButtons: cloneResult.ctaButtons,
                voiceLatencyMs: voiceLatency,
                fallbackToText: !audioResponse, // if TTS failed, suggest text mode
            },
        });
    }
    catch (err) {
        // FALLBACK: voice failed → return text-only response
        try {
            const fallbackResult = await (0, cloneEngine_1.cloneChat)({ companyId, message: 'Desole, probleme audio. Pouvez-vous ecrire votre message ?', sessionId: sessionId || undefined, channel: 'web' });
            res.json({
                success: true,
                data: { transcription: '', reply: fallbackResult.reply, audio: null, sessionId: fallbackResult.sessionId, cloneName: fallbackResult.cloneName, fallbackToText: true, voiceError: String(err) },
            });
        }
        catch {
            res.json({ success: false, message: 'Voice processing failed', fallbackToText: true });
        }
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-CHANNEL: WhatsApp / Telegram / Email webhooks
// ═══════════════════════════════════════════════════════════════════════════════
// WhatsApp incoming → clone → reply
router.post('/:companyId/whatsapp', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.params['companyId'];
    const body = req.body;
    const from = body['from'] ?? '';
    const message = body['message'] ?? body['text'] ?? '';
    if (!message) {
        res.json({ success: false });
        return;
    }
    const result = await (0, cloneChannels_1.handleWhatsAppMessage)(companyId, from, message, body['messageId'] ?? '');
    res.json({ success: true, data: result });
}));
// Telegram incoming → clone → reply
router.post('/:companyId/telegram', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.params['companyId'];
    const body = req.body;
    // Telegram sends updates in a specific format
    const update = body['message'] ?? body;
    const chat = update['chat'] ?? {};
    const from = update['from'] ?? {};
    const chatId = String(chat['id'] ?? body['chatId'] ?? '');
    const text = update['text'] ?? body['message'] ?? '';
    const username = from['first_name'] ?? from['username'] ?? 'User';
    if (!text || !chatId) {
        res.json({ ok: true });
        return;
    }
    const result = await (0, cloneChannels_1.handleTelegramMessage)(companyId, chatId, username, text);
    res.json({ ok: true, data: result });
}));
// Email incoming → clone → reply
router.post('/:companyId/email', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.params['companyId'];
    const body = req.body;
    const fromEmail = body['from'] ?? body['fromEmail'] ?? '';
    const fromName = body['fromName'] ?? '';
    const subject = body['subject'] ?? '';
    const emailBody = body['body'] ?? body['text'] ?? '';
    if (!fromEmail || !emailBody) {
        res.json({ success: false });
        return;
    }
    const result = await (0, cloneChannels_1.handleEmailMessage)(companyId, fromEmail, fromName, subject, emailBody);
    res.json({ success: true, data: result });
}));
// Channel status (admin)
router.get('/config/channels', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const status = await (0, cloneChannels_1.getChannelStatus)(cid);
    res.json({ success: true, data: status });
}));
// Unified contacts (admin)
router.get('/config/contacts', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/cloneContacts`);
    if (req.query['status'])
        q = q.where('status', '==', req.query['status']);
    if (req.query['channel'])
        q = q.where('channels', 'array-contains', req.query['channel']);
    const snap = await q.orderBy('lastSeenAt', 'desc').limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// Escalation: assign contact to a team member (with ownership tracking)
router.post('/config/contacts/:id/assign', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const uid = req.user.uid;
    const body = req.body;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/cloneContacts`).doc(req.params.id).update({
        assignedTo: body['assignedTo'] ?? uid,
        assignedBy: uid, assignedAt: new Date(),
        status: 'escalated', escalated: true, escalatedAt: new Date(),
    });
    res.json({ success: true });
}));
// Escalation: create support ticket from contact
router.post('/config/contacts/:id/ticket', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const contactDoc = await db.collection(`companies/${cid}/cloneContacts`).doc(req.params.id).get();
    if (!contactDoc.exists)
        throw new error_middleware_1.AppError('Contact not found', 404);
    const contact = contactDoc.data();
    const { generateId: gid } = await Promise.resolve().then(() => __importStar(require('../utils/helpers')));
    const ticketId = gid();
    await db.collection(`companies/${cid}/supportTickets`).doc(ticketId).set({
        id: ticketId, subject: `[Clone] ${contact['name'] ?? 'Contact'} — ${contact['lastChannel'] ?? 'web'}`,
        description: `Contact via clone (${contact['channels']?.join(', ') ?? 'web'}).\n\nDernier message: ${contact['lastMessage'] ?? ''}\n\nEmail: ${contact['email'] ?? ''}\nTel: ${contact['phone'] ?? ''}`,
        priority: 'medium', status: 'open', category: 'clone',
        source: 'clone_escalation', contactId: req.params.id,
        createdAt: new Date(), updatedAt: new Date(),
    });
    await contactDoc.ref.update({ status: 'escalated', supportTicketId: ticketId });
    res.json({ success: true, data: { ticketId } });
}));
// Update contact status (with ownership tracking)
router.patch('/config/contacts/:id', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const uid = req.user.uid;
    const body = req.body;
    const updates = { ...body, updatedAt: new Date(), updatedBy: uid };
    if (body['status'] === 'closed') {
        updates['closedAt'] = new Date();
        updates['closedBy'] = uid;
    }
    if (body['status'] === 'converted') {
        updates['convertedAt'] = new Date();
        updates['convertedBy'] = uid;
    }
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/cloneContacts`).doc(req.params.id).update(updates);
    res.json({ success: true });
}));
// Contact timeline (all messages across all channels for one contact)
router.get('/config/contacts/:id/timeline', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const contactDoc = await db.collection(`companies/${cid}/cloneContacts`).doc(req.params.id).get();
    if (!contactDoc.exists)
        throw new error_middleware_1.AppError('Contact not found', 404);
    const contact = contactDoc.data();
    // Get all messages for this contact's sessions
    const email = contact['email'] ?? '';
    const phone = contact['phone'] ?? '';
    let q = db.collection(`companies/${cid}/cloneMessages`);
    // Match by sender (email or phone)
    const messages = [];
    if (email) {
        const snap = await db.collection(`companies/${cid}/cloneMessages`).where('sender', '==', email).orderBy('timestamp', 'asc').limit(100).get();
        messages.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    if (phone) {
        const snap = await db.collection(`companies/${cid}/cloneMessages`).where('sender', '>=', phone.slice(0, 6)).where('sender', '<=', phone.slice(0, 6) + '\uf8ff').orderBy('sender').limit(100).get();
        messages.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    // Also get by sessionId patterns matching contactId
    const leadSnap = await db.collection(`companies/${cid}/cloneLeads`).where('contactId', '==', req.params.id).limit(20).get();
    const sessionIds = leadSnap.docs.map(d => d.data()['sessionId'] ?? '').filter(Boolean);
    for (const sid of sessionIds) {
        const snap = await db.collection(`companies/${cid}/cloneMessages`).where('sessionId', '==', sid).orderBy('timestamp', 'asc').limit(50).get();
        snap.docs.forEach(d => { if (!messages.find(m => m['id'] === d.id))
            messages.push({ id: d.id, ...d.data() }); });
    }
    // Sort all by timestamp
    messages.sort((a, b) => {
        const ta = a['timestamp']?._seconds ?? 0;
        const tb = b['timestamp']?._seconds ?? 0;
        return ta - tb;
    });
    res.json({ success: true, data: { contact: { id: contactDoc.id, ...contact }, messages, totalMessages: messages.length } });
}));
// SLA check (contacts without response)
router.get('/config/sla', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${cid}/cloneContacts`).where('status', 'in', ['new', 'active']).orderBy('lastSeenAt', 'desc').limit(100).get();
    const now = Date.now();
    const violations = [];
    snap.docs.forEach(d => {
        const c = d.data();
        const lastSeen = c['lastSeenAt']?.toDate?.()?.getTime?.() ?? (c['lastSeenAt']?._seconds ?? 0) * 1000;
        if (!lastSeen)
            return;
        const waitMinutes = Math.round((now - lastSeen) / 60000);
        const isNew = c['status'] === 'new';
        const isEscalated = c['escalated'] === true;
        if (isNew && waitMinutes > 10) {
            violations.push({ contactId: d.id, name: c['name'] ?? '', email: c['email'] ?? '', channel: c['lastChannel'] ?? '', waitMinutes, severity: waitMinutes > 30 ? 'critical' : 'warning' });
        }
        else if (isEscalated && waitMinutes > 20 && !c['assignedTo']) {
            violations.push({ contactId: d.id, name: c['name'] ?? '', email: c['email'] ?? '', channel: c['lastChannel'] ?? '', waitMinutes, severity: 'critical' });
        }
    });
    res.json({ success: true, data: { violations, count: violations.length } });
}));
// Convert contact → Sales lead (auto-sync)
router.post('/config/contacts/:id/convert', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const uid = req.user.uid;
    const db = (0, firebase_config_1.getFirestore)();
    const contactDoc = await db.collection(`companies/${cid}/cloneContacts`).doc(req.params.id).get();
    if (!contactDoc.exists)
        throw new error_middleware_1.AppError('Contact not found', 404);
    const contact = contactDoc.data();
    // Create Sales lead
    const { generateId: gid } = await Promise.resolve().then(() => __importStar(require('../utils/helpers')));
    const leadId = gid();
    await db.collection(`companies/${cid}/leads`).doc(leadId).set({
        id: leadId,
        name: contact['name'] ?? 'Lead Clone',
        contactName: contact['name'] ?? '',
        email: contact['email'] ?? '',
        phone: contact['phone'] ?? '',
        company: '',
        source: `clone_${contact['firstChannel'] ?? 'web'}`,
        stage: 'nouveau',
        score: contact['leadScore'] ?? 50,
        amount: 0,
        status: 'active',
        ownerId: uid,
        createdBy: uid,
        notes: `Converti depuis le clone. Canaux: ${(contact['channels'] ?? []).join(', ')}. Intent: ${contact['intentType'] ?? 'info'}.`,
        cloneContactId: req.params.id,
        createdAt: new Date(), updatedAt: new Date(),
    });
    // Update contact
    await contactDoc.ref.update({
        status: 'converted', convertedAt: new Date(), convertedBy: uid,
        salesLeadId: leadId,
    });
    res.json({ success: true, data: { leadId, message: `Lead cree dans le pipeline Sales.` } });
}));
// Voice analytics (admin)
router.get('/config/voice-analytics', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/voiceAnalytics`).orderBy('timestamp', 'desc').limit(200).get();
    const logs = snap.docs.map(d => d.data());
    const totalCalls = logs.length;
    const avgLatency = totalCalls > 0 ? Math.round(logs.reduce((s, l) => s + (l['latencyMs'] ?? 0), 0) / totalCalls) : 0;
    const withAudio = logs.filter(l => l['hasAudioResponse']).length;
    const leadsFromVoice = logs.filter(l => l['leadCaptured']).length;
    res.json({ success: true, data: {
            totalCalls, avgLatencyMs: avgLatency,
            audioResponseRate: totalCalls > 0 ? Math.round(withAudio / totalCalls * 100) : 0,
            leadsFromVoice, fallbackRate: totalCalls > 0 ? Math.round((totalCalls - withAudio) / totalCalls * 100) : 0,
            recentLogs: logs.slice(0, 20),
        } });
}));
// Message history across all channels (admin)
router.get('/config/messages', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/cloneMessages`);
    if (req.query['channel'])
        q = q.where('channel', '==', req.query['channel']);
    const snap = await q.orderBy('timestamp', 'desc').limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
exports.default = router;
//# sourceMappingURL=clone.routes.js.map