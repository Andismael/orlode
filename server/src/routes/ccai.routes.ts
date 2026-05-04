/**
 * Dialogflow CX (CCAI) webhook receiver
 *
 * Flow:
 *   Client (téléphone/WA/web) → Dialogflow CX agent → POST /api/ccai/webhook
 *   → Genkit/Gemini réfléchit → réponse formatée Dialogflow CX
 *   → optionnel: bascule targetPage (handoff humain)
 *
 * Sécurité: header Authorization vérifié contre DIALOGFLOW_WEBHOOK_SECRET
 * Bascule humain: si confidence < 0.7 OU si la réponse demande un transfert,
 * on retourne targetPage = DIALOGFLOW_HANDOFF_PAGE
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { logger } from '../utils/logger';

const router = Router();

// ── Handoff page selector by language ─────────────────────────────────────
// Multi-agent setup: one DF CX agent per language, one Handoff page per agent.
// We pick the right page based on the languageCode that the agent sends in
// the webhook request.
//   - DIALOGFLOW_HANDOFF_PAGE_FR → French agent's Handoff Human page
//   - DIALOGFLOW_HANDOFF_PAGE_EN → English agent's Handoff Human page
//   - DIALOGFLOW_HANDOFF_PAGE    → backward-compat fallback (legacy single-agent)
function handoffPageFor(languageCode: string): string {
  const lc = (languageCode || '').toLowerCase();
  if (lc.startsWith('fr')) return process.env.DIALOGFLOW_HANDOFF_PAGE_FR || process.env.DIALOGFLOW_HANDOFF_PAGE || '';
  if (lc.startsWith('en')) return process.env.DIALOGFLOW_HANDOFF_PAGE_EN || process.env.DIALOGFLOW_HANDOFF_PAGE || '';
  return process.env.DIALOGFLOW_HANDOFF_PAGE || '';
}

// Note: Dialogflow CX envoie le payload sans auth Firebase — on n'utilise donc PAS authMiddleware ici.
// Sécurité: header `Authorization` ou `X-Orlode-Webhook-Secret`.
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  // ── 1. Security check ─────────────────────────────────────────────────────
  // Accepts THREE auth formats (Dialogflow CX supports all):
  //   a) Plain header:        Authorization: <secret>
  //   b) Bearer token:        Authorization: Bearer <secret>
  //   c) Basic Auth (DF CX):  Authorization: Basic base64(<anything>:<secret>)
  const expected = process.env.DIALOGFLOW_WEBHOOK_SECRET;
  if (expected) {
    const authHeader = (req.headers['authorization'] as string) || '';
    const customHeader = (req.headers['x-orlode-webhook-secret'] as string) || '';

    let providedSecret = '';

    if (authHeader.startsWith('Basic ')) {
      // Basic <base64(user:password)> — DF CX standard
      try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const colonIdx = decoded.indexOf(':');
        providedSecret = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
      } catch {
        providedSecret = '';
      }
    } else if (authHeader.startsWith('Bearer ')) {
      providedSecret = authHeader.slice(7).trim();
    } else if (authHeader) {
      providedSecret = authHeader.trim();
    } else {
      providedSecret = customHeader.trim();
    }

    if (providedSecret !== expected) {
      logger.warn('[CCAI] Webhook unauthorized — bad secret');
      return res.status(401).json({ error: 'unauthorized' });
    }
  } else {
    logger.warn('[CCAI] DIALOGFLOW_WEBHOOK_SECRET not set — webhook is OPEN. Set it in env before production.');
  }

  try {
    const body = req.body || {};

    // ── 2. Parse Dialogflow CX request (camelCase per Google docs) ──────────
    const sessionPath: string = body.sessionInfo?.session || '';
    const sessionId = sessionPath.split('/').pop() || 'unknown';
    const parameters = body.sessionInfo?.parameters || {};
    // Real user-spoken text (empty if silence). Don't fall back to intent
    // displayName here — that would mask sys.no-input as actual user text.
    const userText: string = (body.text || body.transcript || '').toString();
    const intent: string = body.intentInfo?.displayName || 'unknown';
    const queryText: string =
      userText ||
      // Only use intent displayName when it's NOT a system event
      (intent && !intent.startsWith('sys.') ? intent : '') ||
      '';
    const languageCode: string = body.languageCode || 'fr';
    const isFr = languageCode.toLowerCase().startsWith('fr');
    // Detect silence: no spoken text AND/OR system no-input event fired
    const isNoInput = !userText.trim() || intent === 'sys.no-input-default';

    logger.info('[CCAI] Webhook received', { sessionId, intent, queryLen: queryText.length, lang: languageCode, isNoInput });

    // ── 2b. Handle silence (sys.no-input) without calling Genkit ─────────────
    // CX fires sys.no-input-default when the caller is silent. We must NOT
    // re-run Genkit (which would default to greeting "Bonjour"). Send a polite
    // re-prompt and end the turn quickly. After 2 silences, hand off to human.
    if (isNoInput) {
      const silenceCount = (typeof parameters.silenceCount === 'number' ? parameters.silenceCount : 0) + 1;
      const handoffOnSilence = silenceCount >= 3 && handoffPageFor(languageCode);
      if (handoffOnSilence) {
        return res.json({
          fulfillmentResponse: {
            messages: [{ text: { text: [isFr
              ? 'Je n\'arrive pas à vous entendre. Je transfère votre appel à un conseiller.'
              : 'I can\'t hear you. Let me connect you to a human agent.'] } }],
          },
          sessionInfo: {
            parameters: { ...parameters, silenceCount, handoffRequested: true, handoffReason: 'silence' },
          },
          targetPage: handoffPageFor(languageCode),
        });
      }
      const reprompt = silenceCount === 1
        ? (isFr ? 'Je vous écoute, allez-y.' : 'I\'m listening, go ahead.')
        : (isFr ? 'Pouvez-vous parler plus fort s\'il vous plaît ?' : 'Could you speak a little louder, please?');
      return res.json({
        fulfillmentResponse: { messages: [{ text: { text: [reprompt] } }] },
        sessionInfo: { parameters: { ...parameters, silenceCount } },
      });
    }

    // ── 3. Enriched Orlode prompt (language-aware) ──────────────────────────
    const enrichedPrompt = isFr
      ? `Tu es le Clone Orlode de cette entreprise.

Canal: CCAI / Dialogflow CX (téléphone)
Session: ${sessionId}
Intent détecté: ${intent}
Langue: fr

Message utilisateur:
${queryText}

Règles:
- Réponds en français, court (1-3 phrases max), clair et professionnel.
- Tu parles à voix haute au téléphone — évite les listes, les emojis, les caractères spéciaux.
- Ne confirme jamais un rendez-vous, paiement ou commande sans résultat backend.
- Si la demande est urgente, confuse ou sensible, propose un transfert humain.
- Ne te re-présente pas à chaque tour. Dis bonjour UNE FOIS au début.
`
      : `You are the Orlode Clone for this company.

Channel: CCAI / Dialogflow CX (phone call)
Session: ${sessionId}
Detected intent: ${intent}
Language: en

User message:
${queryText}

Rules:
- Reply in English, keep it short (max 1-3 sentences), clear and professional.
- You are speaking aloud on a phone call — avoid lists, emojis, special characters.
- Never confirm an appointment, payment or order without a backend result.
- If the request is urgent, confusing or sensitive, offer a human transfer.
- Don't re-introduce yourself every turn. Say hello ONCE at the start.
`;

    // ── 4. Call Genkit / Gemini ─────────────────────────────────────────────
    let text = '';
    try {
      const result = await ai.generate({
        model: GEMINI_FLASH,
        prompt: enrichedPrompt,
      });
      text = (result as any).text?.trim() || '';
    } catch (genkitErr) {
      logger.error('[CCAI] Genkit generation failed', genkitErr);
    }

    if (!text) {
      text = isFr
        ? "Je n'ai pas bien compris. Pouvez-vous reformuler simplement ?"
        : "I didn't quite understand. Could you rephrase, please?";
    }

    // ── 5. Handoff detection ────────────────────────────────────────────────
    const confidenceScore = typeof parameters.confidenceScore === 'number'
      ? parameters.confidenceScore
      : 1.0;
    const lowerText = text.toLowerCase();
    const explicitHandoff = isFr
      ? (lowerText.includes('agent humain') || lowerText.includes('transfert humain') || lowerText.includes('un humain va') || lowerText.includes('un conseiller'))
      : (lowerText.includes('human agent') || lowerText.includes('transfer you') || lowerText.includes('connect you to a human'));
    const lowConfidence = confidenceScore < 0.7;
    const userRequestedHuman = isFr
      ? /humain|conseiller|agent r[eé]el|parler [aà] (quelqu|un|une) (personne|conseiller)/i.test(queryText)
      : /human|real (person|agent)|speak to (a|someone)/i.test(queryText);
    const shouldHandoff = explicitHandoff || lowConfidence || userRequestedHuman;

    const handoff = handoffPageFor(languageCode);
    if (shouldHandoff && handoff) {
      logger.info('[CCAI] Handoff triggered', { sessionId, lang: languageCode, reason: explicitHandoff ? 'explicit' : lowConfidence ? 'low_confidence' : 'user_request' });
      return res.json({
        fulfillmentResponse: {
          messages: [{
            text: { text: [isFr
              ? 'Je vais transmettre votre demande à un agent humain. Merci de patienter quelques instants.'
              : 'I\'m going to transfer you to a human agent. Please hold on for a moment.'] }
          }],
        },
        sessionInfo: {
          parameters: {
            ...parameters,
            handoffRequested: true,
            handoffReason: explicitHandoff ? 'explicit' : lowConfidence ? 'low_confidence' : 'user_request',
            lastUserMessage: queryText,
          },
        },
        targetPage: handoff,
      });
    }

    // ── 6. Normal response ──────────────────────────────────────────────────
    return res.json({
      fulfillmentResponse: {
        messages: [{ text: { text: [text] } }],
      },
      sessionInfo: {
        parameters: {
          ...parameters,
          silenceCount: 0,
          lastIntent: intent,
          lastUserMessage: queryText,
          lastBotResponse: text,
        },
      },
    });

  } catch (error) {
    logger.error('[CCAI] Webhook error', error);
    const isFr = (req.body?.languageCode || 'fr').toLowerCase().startsWith('fr');
    return res.json({
      fulfillmentResponse: {
        messages: [{ text: { text: [isFr
          ? 'Une erreur est survenue. Votre demande va être transmise à un agent humain.'
          : 'An error occurred. Your request is being transferred to a human agent.'] } }],
      },
      sessionInfo: {
        parameters: { webhookError: true },
      },
    });
  }
}));

// Health check (utile pour vérifier le déploiement avant de le pointer dans Dialogflow)
router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ccai-webhook',
    secretConfigured: !!process.env.DIALOGFLOW_WEBHOOK_SECRET,
    handoff: {
      legacy: !!process.env.DIALOGFLOW_HANDOFF_PAGE,
      fr: !!process.env.DIALOGFLOW_HANDOFF_PAGE_FR,
      en: !!process.env.DIALOGFLOW_HANDOFF_PAGE_EN,
    },
  });
});

export default router;
