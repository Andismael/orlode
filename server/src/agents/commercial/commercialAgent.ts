/**
 * Commercial Agent — Agent #20
 * Génère des pages de vente, proposals, landing pages, chatbot commercial.
 * Intégré avec le pipeline vidéo et la publication sociale.
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';

// ── Tools ─────────────────────────────────────────────────────────────────────

export const generateLandingPageTool = ai.defineTool(
  {
    name: 'com_generateLandingPage',
    description: 'Generate landing page copy and structure for a product or service.',
    inputSchema: z.object({
      companyId:   z.string(),
      productName: z.string(),
      targetAudience: z.string(),
      keyBenefits: z.array(z.string()),
      tone: z.enum(['professional', 'friendly', 'bold', 'minimal']).optional().default('professional'),
      language: z.string().optional().default('fr'),
    }),
    outputSchema: z.object({
      headline:    z.string(),
      subheadline: z.string(),
      cta:         z.string(),
      sections:    z.array(z.object({ title: z.string(), body: z.string() })),
      seoTitle:    z.string(),
      seoMeta:     z.string(),
    }),
  },
  async ({ companyId, productName, targetAudience, keyBenefits, tone, language }) => {
    const db = getFirestore();
    const companySnap = await db.collection('companies').doc(companyId).get().catch(() => null);
    const companyName = companySnap?.data()?.name ?? 'Notre entreprise';

    logger.info('[Commercial] Generating landing page', { companyId, productName });

    return {
      headline:    `${productName} — La solution qu'attendait ${targetAudience}`,
      subheadline: `Découvrez comment ${companyName} transforme votre quotidien avec ${productName}.`,
      cta:         'Démarrer gratuitement',
      sections: keyBenefits.map((benefit, i) => ({
        title: `Avantage ${i + 1}`,
        body: benefit,
      })),
      seoTitle: `${productName} | ${companyName}`,
      seoMeta:  `${productName} pour ${targetAudience}. ${keyBenefits[0] ?? ''}`,
    };
  }
);

export const generateProposalTool = ai.defineTool(
  {
    name: 'com_generateProposal',
    description: 'Generate a commercial proposal (devis/offre) for a prospect.',
    inputSchema: z.object({
      companyId:    z.string(),
      prospectName: z.string(),
      services:     z.array(z.object({ name: z.string(), price: z.number(), description: z.string() })),
      validityDays: z.number().optional().default(30),
      language:     z.string().optional().default('fr'),
    }),
    outputSchema: z.object({
      proposalId:   z.string(),
      title:        z.string(),
      introduction: z.string(),
      services:     z.array(z.object({ name: z.string(), price: z.number(), description: z.string() })),
      totalHT:      z.number(),
      conclusion:   z.string(),
      validUntil:   z.string(),
    }),
  },
  async ({ companyId, prospectName, services, validityDays, language }) => {
    const db = getFirestore();
    const totalHT = services.reduce((s, v) => s + v.price, 0);
    const validUntil = new Date(Date.now() + validityDays * 86400000).toLocaleDateString('fr-FR');

    const ref = db.collection(`companies/${companyId}/proposals`).doc();
    const proposal = {
      proposalId:   ref.id,
      title:        `Proposition commerciale — ${prospectName}`,
      introduction: `Madame, Monsieur, nous vous remercions de l'intérêt que vous portez à nos services.`,
      services,
      totalHT,
      conclusion:   `Cette offre est valable jusqu'au ${validUntil}. N'hésitez pas à nous contacter.`,
      validUntil,
    };

    await ref.set({ ...proposal, prospectName, companyId, createdAt: new Date(), status: 'draft' }).catch(() => {});
    logger.info('[Commercial] Proposal generated', { companyId, proposalId: ref.id });
    return proposal;
  }
);

export const getProspectInsightsTool = ai.defineTool(
  {
    name: 'com_getProspectInsights',
    description: 'Get insights and interaction history for a prospect from the CRM.',
    inputSchema: z.object({
      companyId:  z.string(),
      prospectId: z.string(),
    }),
    outputSchema: z.object({
      prospect:     z.object({ id: z.string(), name: z.string(), email: z.string().optional(), company: z.string().optional(), score: z.number() }),
      interactions: z.array(z.object({ type: z.string(), date: z.string(), summary: z.string() })),
      recommendation: z.string(),
    }),
  },
  async ({ companyId, prospectId }) => {
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/leads`).doc(prospectId).get().catch(() => null);
    const data = doc?.data();

    return {
      prospect: {
        id:      prospectId,
        name:    data?.name ?? 'Inconnu',
        email:   data?.email,
        company: data?.company,
        score:   data?.score ?? 50,
      },
      interactions: [],
      recommendation: data?.score > 70
        ? 'Lead chaud — contacter immédiatement avec une offre personnalisée.'
        : 'Lead tiède — nourrir avec du contenu de valeur avant une approche directe.',
    };
  }
);

// ── Agent Tool (pour l'orchestrateur) ─────────────────────────────────────────

export const commercialAgentTool = ai.defineTool(
  {
    name: 'callCommercialAgent',
    description: 'Use the Commercial Agent for: landing pages, sales proposals, prospect analysis, sales scripts, conversion funnel optimization, commercial strategy.',
    inputSchema: z.object({
      request:   z.string().describe('What you need the commercial agent to do'),
      companyId: z.string(),
      language:  z.string().optional(),
    }),
    outputSchema: z.object({ response: z.string() }),
  },
  async ({ request, companyId, language = 'fr' }) => {
    const result = await commercialAgentFlow({ prompt: request, companyId, language });
    return { response: result.response };
  }
);

// ── Lead detection ────────────────────────────────────────────────────────────

export interface LeadContact {
  email?:    string;
  whatsapp?: string;
}

/** Extrait email et/ou numéro WhatsApp d'un texte libre */
export function extractContact(text: string): LeadContact {
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  // Détecte numéros internationaux : +1..., +225..., 07..., 06..., etc.
  const phoneMatch = text.match(/(?:\+\d{1,3}[\s\-]?)?\(?\d{2,4}\)?[\s\-]?\d{2,4}[\s\-]?\d{2,4}[\s\-]?\d{0,4}/);
  const phone = phoneMatch?.[0]?.replace(/[\s\-().]/g, '') ?? undefined;
  // Ignorer si moins de 7 chiffres
  const validPhone = phone && phone.replace(/\D/g, '').length >= 7 ? phone : undefined;
  return {
    email:    emailMatch?.[0] ?? undefined,
    whatsapp: validPhone,
  };
}

/** Sauvegarde le lead dans Firestore et notifie l'équipe commerciale Orlode */
export async function saveLead(sessionId: string, contact: LeadContact, summary: string): Promise<void> {
  const db = getFirestore();

  // Éviter les doublons par session
  const existing = await db.collection('publicLeads')
    .where('sessionId', '==', sessionId).limit(1).get();
  if (!existing.empty) return;

  const lead = {
    sessionId,
    email:     contact.email    ?? null,
    whatsapp:  contact.whatsapp ?? null,
    summary,
    status:    'new',
    source:    'landing_page_chat',
    createdAt: new Date(),
  };

  await db.collection('publicLeads').add(lead);
  logger.info('[Commercial] Lead saved', { sessionId, email: contact.email, whatsapp: contact.whatsapp });

  // Notification WhatsApp vers le commercial Orlode
  const notifPhone = process.env['ORLODE_SALES_WHATSAPP'];
  const waToken    = process.env['WHATSAPP_ACCESS_TOKEN'];
  const waPhoneId  = process.env['WHATSAPP_PHONE_NUMBER_ID'];

  if (notifPhone && waToken && waPhoneId) {
    const to = notifPhone.replace(/[^\d]/g, ''); // strip +, spaces, etc.
    const msg = `🔔 *Nouveau prospect Orlode*\n\n` +
      `📧 Email: ${contact.email ?? 'non fourni'}\n` +
      `📱 Contact: ${contact.whatsapp ?? 'non fourni'}\n\n` +
      `💬 ${summary.slice(0, 300)}`;

    try {
      const notifRes = await fetch(`https://graph.facebook.com/v21.0/${waPhoneId}/messages`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: msg },
        }),
      });
      const notifData = await notifRes.json();
      logger.info('[Commercial] WhatsApp notif sent', { to, status: notifRes.status, data: notifData });
    } catch (err) {
      logger.error('[Commercial] WhatsApp notif failed', { error: err });
    }
  } else {
    logger.warn('[Commercial] WhatsApp notif skipped — missing config', { notifPhone: !!notifPhone, waToken: !!waToken, waPhoneId: !!waPhoneId });
  }
}

// ── Agent Flow ─────────────────────────────────────────────────────────────────

export const commercialAgentFlow = ai.defineFlow(
  {
    name:         'commercialAgent',
    inputSchema:  z.object({
      prompt:      z.string(),
      companyId:   z.string(),
      language:    z.string().optional(),
      history:     z.array(z.object({ role: z.enum(['user','model']), content: z.string() })).optional(),
      messageCount: z.number().optional(),
      sessionId:   z.string().optional(),
    }),
    outputSchema: z.object({
      response:    z.string(),
      leadCaptured: z.boolean().optional(),
    }),
  },
  async ({ prompt, companyId, language = 'fr', messageCount = 1, sessionId }) => {
    logger.info('[Commercial] Agent invoked', { companyId, messageCount });

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
    const AUTO_REPLIES: Array<{ pattern: RegExp; reply: Record<string, string> }> = [
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

    const genResponse = await ai.generate({
      model: GEMINI_FLASH,
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
      response:     genResponse.text ?? '',
      leadCaptured: hasContact,
    };
  }
);
