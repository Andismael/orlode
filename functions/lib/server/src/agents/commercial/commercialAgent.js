"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commercialAgentFlow = exports.commercialAgentTool = exports.getProspectInsightsTool = exports.generateProposalTool = exports.generateLandingPageTool = void 0;
exports.extractContact = extractContact;
exports.saveLead = saveLead;
/**
 * Commercial Agent — Agent #20
 * Génère des pages de vente, proposals, landing pages, chatbot commercial.
 * Intégré avec le pipeline vidéo et la publication sociale.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const logger_1 = require("../../utils/logger");
// ── Tools ─────────────────────────────────────────────────────────────────────
exports.generateLandingPageTool = genkit_config_1.ai.defineTool({
    name: 'com_generateLandingPage',
    description: 'Generate landing page copy and structure for a product or service.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        productName: zod_1.z.string(),
        targetAudience: zod_1.z.string(),
        keyBenefits: zod_1.z.array(zod_1.z.string()),
        tone: zod_1.z.enum(['professional', 'friendly', 'bold', 'minimal']).optional().default('professional'),
        language: zod_1.z.string().optional().default('fr'),
    }),
    outputSchema: zod_1.z.object({
        headline: zod_1.z.string(),
        subheadline: zod_1.z.string(),
        cta: zod_1.z.string(),
        sections: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string(), body: zod_1.z.string() })),
        seoTitle: zod_1.z.string(),
        seoMeta: zod_1.z.string(),
    }),
}, async ({ companyId, productName, targetAudience, keyBenefits, tone, language }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const companySnap = await db.collection('companies').doc(companyId).get().catch(() => null);
    const companyName = companySnap?.data()?.name ?? 'Notre entreprise';
    logger_1.logger.info('[Commercial] Generating landing page', { companyId, productName });
    return {
        headline: `${productName} — La solution qu'attendait ${targetAudience}`,
        subheadline: `Découvrez comment ${companyName} transforme votre quotidien avec ${productName}.`,
        cta: 'Démarrer gratuitement',
        sections: keyBenefits.map((benefit, i) => ({
            title: `Avantage ${i + 1}`,
            body: benefit,
        })),
        seoTitle: `${productName} | ${companyName}`,
        seoMeta: `${productName} pour ${targetAudience}. ${keyBenefits[0] ?? ''}`,
    };
});
exports.generateProposalTool = genkit_config_1.ai.defineTool({
    name: 'com_generateProposal',
    description: 'Generate a commercial proposal (devis/offre) for a prospect.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        prospectName: zod_1.z.string(),
        services: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), price: zod_1.z.number(), description: zod_1.z.string() })),
        validityDays: zod_1.z.number().optional().default(30),
        language: zod_1.z.string().optional().default('fr'),
    }),
    outputSchema: zod_1.z.object({
        proposalId: zod_1.z.string(),
        title: zod_1.z.string(),
        introduction: zod_1.z.string(),
        services: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), price: zod_1.z.number(), description: zod_1.z.string() })),
        totalHT: zod_1.z.number(),
        conclusion: zod_1.z.string(),
        validUntil: zod_1.z.string(),
    }),
}, async ({ companyId, prospectName, services, validityDays, language }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const totalHT = services.reduce((s, v) => s + v.price, 0);
    const validUntil = new Date(Date.now() + validityDays * 86400000).toLocaleDateString('fr-FR');
    const ref = db.collection(`companies/${companyId}/proposals`).doc();
    const proposal = {
        proposalId: ref.id,
        title: `Proposition commerciale — ${prospectName}`,
        introduction: `Madame, Monsieur, nous vous remercions de l'intérêt que vous portez à nos services.`,
        services,
        totalHT,
        conclusion: `Cette offre est valable jusqu'au ${validUntil}. N'hésitez pas à nous contacter.`,
        validUntil,
    };
    await ref.set({ ...proposal, prospectName, companyId, createdAt: new Date(), status: 'draft' }).catch(() => { });
    logger_1.logger.info('[Commercial] Proposal generated', { companyId, proposalId: ref.id });
    return proposal;
});
exports.getProspectInsightsTool = genkit_config_1.ai.defineTool({
    name: 'com_getProspectInsights',
    description: 'Get insights and interaction history for a prospect from the CRM.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        prospectId: zod_1.z.string(),
    }),
    outputSchema: zod_1.z.object({
        prospect: zod_1.z.object({ id: zod_1.z.string(), name: zod_1.z.string(), email: zod_1.z.string().optional(), company: zod_1.z.string().optional(), score: zod_1.z.number() }),
        interactions: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), date: zod_1.z.string(), summary: zod_1.z.string() })),
        recommendation: zod_1.z.string(),
    }),
}, async ({ companyId, prospectId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/leads`).doc(prospectId).get().catch(() => null);
    const data = doc?.data();
    return {
        prospect: {
            id: prospectId,
            name: data?.name ?? 'Inconnu',
            email: data?.email,
            company: data?.company,
            score: data?.score ?? 50,
        },
        interactions: [],
        recommendation: data?.score > 70
            ? 'Lead chaud — contacter immédiatement avec une offre personnalisée.'
            : 'Lead tiède — nourrir avec du contenu de valeur avant une approche directe.',
    };
});
// ── Agent Tool (pour l'orchestrateur) ─────────────────────────────────────────
exports.commercialAgentTool = genkit_config_1.ai.defineTool({
    name: 'callCommercialAgent',
    description: 'Use the Commercial Agent for: landing pages, sales proposals, prospect analysis, sales scripts, conversion funnel optimization, commercial strategy.',
    inputSchema: zod_1.z.object({
        request: zod_1.z.string().describe('What you need the commercial agent to do'),
        companyId: zod_1.z.string(),
        language: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ response: zod_1.z.string() }),
}, async ({ request, companyId, language = 'fr' }) => {
    const result = await (0, exports.commercialAgentFlow)({ prompt: request, companyId, language });
    return { response: result.response };
});
/** Extrait email et/ou numéro WhatsApp d'un texte libre */
function extractContact(text) {
    const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    // Détecte numéros internationaux : +1..., +225..., 07..., 06..., etc.
    const phoneMatch = text.match(/(?:\+\d{1,3}[\s\-]?)?\(?\d{2,4}\)?[\s\-]?\d{2,4}[\s\-]?\d{2,4}[\s\-]?\d{0,4}/);
    const phone = phoneMatch?.[0]?.replace(/[\s\-().]/g, '') ?? undefined;
    // Ignorer si moins de 7 chiffres
    const validPhone = phone && phone.replace(/\D/g, '').length >= 7 ? phone : undefined;
    return {
        email: emailMatch?.[0] ?? undefined,
        whatsapp: validPhone,
    };
}
/** Sauvegarde le lead dans Firestore et notifie l'équipe commerciale Orlode */
async function saveLead(sessionId, contact, summary) {
    const db = (0, firebase_config_1.getFirestore)();
    // Éviter les doublons par session
    const existing = await db.collection('publicLeads')
        .where('sessionId', '==', sessionId).limit(1).get();
    if (!existing.empty)
        return;
    const lead = {
        sessionId,
        email: contact.email ?? null,
        whatsapp: contact.whatsapp ?? null,
        summary,
        status: 'new',
        source: 'landing_page_chat',
        createdAt: new Date(),
    };
    await db.collection('publicLeads').add(lead);
    logger_1.logger.info('[Commercial] Lead saved', { sessionId, email: contact.email, whatsapp: contact.whatsapp });
    // Notification WhatsApp vers le commercial Orlode
    const notifPhone = process.env['ORLODE_SALES_WHATSAPP'];
    const waToken = process.env['WHATSAPP_ACCESS_TOKEN'];
    const waPhoneId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
    if (notifPhone && waToken && waPhoneId) {
        const to = notifPhone.replace(/[^\d]/g, ''); // strip +, spaces, etc.
        const msg = `🔔 *Nouveau prospect Orlode*\n\n` +
            `📧 Email: ${contact.email ?? 'non fourni'}\n` +
            `📱 Contact: ${contact.whatsapp ?? 'non fourni'}\n\n` +
            `💬 ${summary.slice(0, 300)}`;
        try {
            const notifRes = await fetch(`https://graph.facebook.com/v21.0/${waPhoneId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to,
                    type: 'text',
                    text: { body: msg },
                }),
            });
            const notifData = await notifRes.json();
            logger_1.logger.info('[Commercial] WhatsApp notif sent', { to, status: notifRes.status, data: notifData });
        }
        catch (err) {
            logger_1.logger.error('[Commercial] WhatsApp notif failed', { error: err });
        }
    }
    else {
        logger_1.logger.warn('[Commercial] WhatsApp notif skipped — missing config', { notifPhone: !!notifPhone, waToken: !!waToken, waPhoneId: !!waPhoneId });
    }
}
// ── Agent Flow ─────────────────────────────────────────────────────────────────
exports.commercialAgentFlow = genkit_config_1.ai.defineFlow({
    name: 'commercialAgent',
    inputSchema: zod_1.z.object({
        prompt: zod_1.z.string(),
        companyId: zod_1.z.string(),
        language: zod_1.z.string().optional(),
        history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
        messageCount: zod_1.z.number().optional(),
        sessionId: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        response: zod_1.z.string(),
        leadCaptured: zod_1.z.boolean().optional(),
    }),
}, async ({ prompt, companyId, language = 'fr', messageCount = 1, sessionId }) => {
    logger_1.logger.info('[Commercial] Agent invoked', { companyId, messageCount });
    // Détecter si le prospect donne son contact
    const contact = extractContact(prompt);
    const hasContact = !!(contact.email || contact.whatsapp);
    if (hasContact && sessionId) {
        await saveLead(sessionId, contact, `Message prospect: ${prompt}`);
        // Stopper la conversation après capture du contact
        return {
            response: language.startsWith('fr')
                ? 'Parfait ! Notre équipe vous contacte très prochainement. 🙌'
                : 'Perfect! Our team will reach out to you very soon. 🙌',
            leadCaptured: true,
        };
    }
    // Décider si on doit demander le contact (après 2 échanges, pas encore demandé)
    const askForContact = messageCount === 3 && !hasContact;
    // Réponses automatiques pour questions fréquentes (économise des tokens)
    const AUTO_REPLIES = [
        {
            pattern: /prix|price|combien|cost|tarif|plan/i,
            reply: {
                fr: '💰 Starter $22.99/mois, Business $49.99/mois, Enterprise $99.99/mois. Essai 14 jours gratuit. Quel plan correspond à votre taille d\'équipe ?',
                en: '💰 Starter $22.99/mo, Business $49.99/mo, Enterprise $99.99/mo. Free 14-day trial. Which plan fits your team size?',
            },
        },
        {
            pattern: /agent|département|feature|fonctionnalit/i,
            reply: {
                fr: '🤖 19 agents spécialisés : RH, Finance, Support, Marketing, Legal, IT, Cybersécurité, Sales, Réception... Chacun automatise un département entier. Lequel vous intéresse ?',
                en: '🤖 19 specialized agents: HR, Finance, Support, Marketing, Legal, IT, Cybersecurity, Sales, Reception... Each automates an entire department. Which one interests you?',
            },
        },
        {
            pattern: /sécurité|security|data|donnée|cloud|byoe/i,
            reply: {
                fr: '🔒 Vos données restent dans VOTRE cloud (Firebase/GCP). On ne touche jamais à vos données — c\'est le modèle BYOE (Bring Your Own Environment).',
                en: '🔒 Your data stays in YOUR cloud (Firebase/GCP). We never touch your data — that\'s our BYOE (Bring Your Own Environment) model.',
            },
        },
    ];
    const lang = language.startsWith('en') ? 'en' : 'fr';
    const autoReply = AUTO_REPLIES.find(r => r.pattern.test(prompt));
    if (autoReply && !hasContact) {
        return { response: autoReply.reply[lang] ?? autoReply.reply['fr'], leadCaptured: false };
    }
    const genResponse = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: `You are Orlode AI's sales bot. ULTRA BRIEF — max 1 sentence + 1 question.

Orlode AI: 19 AI agents (HR, Finance, IT, Marketing, Legal...). From $22.99/mo. 14-day free trial. Data stays in client's cloud.

STRICT RULES:
- MAX 1 short sentence. No lists. No long explanations.
- ${hasContact ? 'Just say: "Perfect! Our team will contact you very soon. 🙌" Nothing else.' : ''}
- ${askForContact ? 'Ask ONLY for their WhatsApp or email. Nothing else.' : 'End with ONE short qualifying question.'}
- ALWAYS reply in the SAME language as the user message. If they write in French → reply French. English → English. Arabic → Arabic. etc.`,
        prompt,
    });
    return {
        response: genResponse.text ?? '',
        leadCaptured: hasContact,
    };
});
//# sourceMappingURL=commercialAgent.js.map