import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnlyMiddleware } from '../middleware/adminOnly.middleware';
import { whatsappService } from '../services/whatsapp/whatsappService';
import type { WhatsAppConfig } from '../services/whatsapp/whatsappService';
import { AppError } from '../middleware/error.middleware';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response, Request } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// ── Webhook Meta global (public — pas d'auth) ────────────────────────────────
// URL à configurer dans Meta : .../api/whatsapp/webhook
// Verify Token : valeur de WHATSAPP_VERIFY_TOKEN dans .env

// GET /api/whatsapp/webhook — vérification webhook Meta
router.get('/webhook', (req: Request, res: Response) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;
  const verifyToken = process.env['WHATSAPP_VERIFY_TOKEN'];

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    logger.info('[WhatsApp] Webhook verified by Meta');
    res.status(200).send(challenge);
  } else {
    logger.warn('[WhatsApp] Webhook verification failed', { token });
    res.status(403).send('Forbidden');
  }
});

// POST /api/whatsapp/webhook — messages entrants (routage automatique par phoneNumberId)
router.post('/webhook', asyncHandler(async (req: Request & { rawBody?: Buffer }, res: Response) => {
  // Vérification X-Hub-Signature-256
  const appSecret = process.env['WHATSAPP_APP_SECRET'];
  if (appSecret) {
    const sigHeader = req.headers['x-hub-signature-256'] as string | undefined;
    if (!sigHeader) {
      logger.warn('[WhatsApp] Missing X-Hub-Signature-256 header');
      res.status(403).send('Forbidden');
      return;
    }
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    try {
      if (!timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected))) {
        logger.warn('[WhatsApp] Invalid signature');
        res.status(403).send('Forbidden');
        return;
      }
    } catch {
      res.status(403).send('Forbidden');
      return;
    }
  }

  res.status(200).send('OK'); // Répondre immédiatement à Meta

  const body = req.body as Record<string, unknown>;

  // ── Handle delivery/read status updates ────────────────────────────────
  const statuses = whatsappService.parseStatuses?.(body);
  if (statuses && statuses.length > 0) {
    setImmediate(async () => {
      try {
        const db = getFirestore();
        for (const st of statuses) {
          // Update message status in Firestore
          const snap = await db.collectionGroup('whatsappMessages')
            .where('waMessageId', '==', st.messageId)
            .limit(1).get();
          if (!snap.empty) {
            await snap.docs[0].ref.update({
              deliveryStatus: st.status,
              deliveryTimestamp: new Date(st.timestamp),
            });
          }
        }
      } catch (err) {
        logger.error('[WhatsApp] Status update failed', { error: err });
      }
    });
  }

  const incoming = whatsappService.parseWebhook(body);
  // Allow audio messages with empty .message (we'll transcribe). Block only
  // when there's nothing to process at all.
  if (!incoming) return;
  const hasContent = !!incoming.message || (incoming.type === 'audio' && !!incoming.audioId);
  if (!hasContent) return;

  // ── BOT-TO-BOT LOOP GUARD ──────────────────────────────────────────────
  // If `incoming.from` is itself a WhatsApp business number connected to
  // another Orlode company, this is a bot-to-bot loop (one Orlode bot
  // replied, which triggered another Orlode bot, etc.). Skip silently.
  // We compare against the display phone numbers of all connected companies.
  try {
    const guardDb = getFirestore();
    const fromDigits = (incoming.from ?? '').replace(/\D/g, '');
    if (fromDigits) {
      // Use a small global cache of known business numbers (5min TTL via doc).
      // Maintained when connecting/disconnecting WhatsApp accounts.
      const knownDoc = await guardDb.collection('_platformBusinessNumbers').doc(fromDigits).get().catch(() => null);
      if (knownDoc?.exists) {
        logger.warn('[WhatsApp] Skipped — incoming "from" is itself a connected Orlode WhatsApp number (bot-to-bot loop guard)', {
          from: incoming.from,
          companyId: knownDoc.data()?.['companyId'],
        });
        return;
      }
    }
  } catch (err) {
    logger.warn('[WhatsApp] Loop-guard check failed (continuing)', { error: err instanceof Error ? err.message : err });
  }

  // ── Deduplication: prefer messageId (unique per Meta) over timestamp.
  // Falls back to from+timestamp for old payloads without messageId.
  const dedupId = incoming.messageId || `${incoming.from}_${incoming.timestamp}`;
  const dedupKey = `wa_${dedupId}`;
  const dedupDb = getFirestore();
  const dedupDoc = await dedupDb.collection('_whatsappDedup').doc(dedupKey).get().catch(() => null);
  if (dedupDoc?.exists) {
    logger.info('[WhatsApp] Duplicate webhook ignored', { from: incoming.from, messageId: incoming.messageId });
    return;
  }
  await dedupDb.collection('_whatsappDedup').doc(dedupKey).set({ at: new Date(), from: incoming.from }).catch(() => {});

  // Traitement asynchrone : transcription, agent, réponse vocale
  setImmediate(async () => {
    try {
      const db = getFirestore();
      // The phoneNumberId comes from the incoming webhook payload (receiving business line)
      const phoneNumberId = incoming.phoneNumberId ?? process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '';
      const accessToken   = process.env['WHATSAPP_ACCESS_TOKEN'] ?? '';

      // Route to the right company by matching phoneNumberId on the company doc (mirrored)
      let companyId = 'default';
      if (phoneNumberId) {
        const companiesSnap = await db.collection('companies')
          .where('whatsappPhoneNumberId', '==', phoneNumberId)
          .limit(1)
          .get()
          .catch(() => null);
        if (companiesSnap && !companiesSnap.empty) {
          companyId = companiesSnap.docs[0].id;
        } else {
          // Fallback: search the integrations sub-collection group
          const integrationsSnap = await db.collectionGroup('integrations')
            .where('phoneNumberId', '==', phoneNumberId)
            .limit(1)
            .get()
            .catch(() => null);
          const parent = integrationsSnap?.docs[0]?.ref.parent.parent;
          if (parent) {
            companyId = parent.id;
            // Backfill the mirror field for fast future lookups
            parent.set({ whatsappPhoneNumberId: phoneNumberId, updatedAt: new Date() }, { merge: true }).catch(() => {});
          }
        }
      }
      if (companyId === 'default') {
        logger.warn('[WhatsApp] Could not resolve company from phoneNumberId, falling back to default', { phoneNumberId });
      }

      let finalMessage = incoming.message;
      let transcriptionFailed = false;

      // ── Si message vocal → transcription Whisper ──────────────────────────
      if (incoming.type === 'audio' && incoming.audioId && accessToken) {
        logger.info('[WhatsApp Audio Debug]', {
          audioId: incoming.audioId,
          hasAccessToken: !!accessToken,
          companyId,
          type: incoming.type,
        });
        try {
          logger.info('[WhatsApp] Transcribing audio', { audioId: incoming.audioId });
          const transcribed = await whatsappService.transcribeAudio(incoming.audioId, accessToken, companyId);
          if (!transcribed || !transcribed.trim()) {
            transcriptionFailed = true;
            finalMessage = '';
            logger.warn('[WhatsApp] Transcription returned empty', { audioId: incoming.audioId, companyId });
          } else {
            finalMessage = transcribed;
            logger.info('[WhatsApp] Transcription done', { text: finalMessage.slice(0, 80) });
          }
        } catch (err) {
          logger.error('[WhatsApp] Transcription failed', {
            error: err instanceof Error ? err.message : String(err),
            audioId: incoming.audioId,
            companyId,
          });
          transcriptionFailed = true;
          finalMessage = '';
        }
      } else if (incoming.type === 'audio') {
        // Audio without audioId or accessToken — log why we can't transcribe
        logger.warn('[WhatsApp] Audio received but cannot transcribe', {
          hasAudioId: !!incoming.audioId,
          hasAccessToken: !!accessToken,
          companyId,
        });
        transcriptionFailed = true;
        finalMessage = '';
      }

      // ── Sauvegarder le message entrant ────────────────────────────────────
      await db.collection(`companies/${companyId}/whatsappMessages`).add({
        direction:   'inbound',
        from:        incoming.from,
        message:     finalMessage,
        originalType: incoming.type,
        timestamp:   new Date(incoming.timestamp),
        processed:   false,
        createdAt:   new Date(),
        ...(incoming.referral ? { referral: incoming.referral } : {}),
      });

      // ── Capture Click-to-WhatsApp ad attribution ────────────────────────
      // If this conversation started from a Meta ad, attach the referral to
      // the customer's conversation doc + bump per-campaign stats.
      // We always tag the lead created from this conversation later.
      if (incoming.referral?.source_id) {
        try {
          const phoneKey = incoming.from.replace(/\D/g, '');
          const convoRef = db.collection(`companies/${companyId}/whatsappConversations`).doc(phoneKey);
          await convoRef.set({
            customerPhone: incoming.from,
            adReferral: incoming.referral,
            adFirstSeenAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          // Per-campaign aggregate
          await db.collection(`companies/${companyId}/whatsappAdCampaigns`).doc(incoming.referral.source_id).set({
            campaignId: incoming.referral.source_id,
            headline: incoming.referral.headline ?? null,
            body: incoming.referral.body ?? null,
            sourceUrl: incoming.referral.source_url ?? null,
            imageUrl: incoming.referral.image_url ?? null,
            conversationsStarted: FieldValue.increment(1),
            lastSeenAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          logger.info('[WhatsApp/Ads] referral captured', { from: incoming.from, campaignId: incoming.referral.source_id });
        } catch (err) {
          logger.warn('[WhatsApp/Ads] referral capture failed (non-blocking)', { error: String(err) });
        }
      }

      // ── Conversion tracking: link inbound to recent template OR product send ──
      // If we sent a template OR product card to this customer in the last 7 days
      // and they reply, mark that send as "replied" + bump broadcast.repliedCount
      // (templates) or stats (products). Best-effort, never blocks webhook.
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentSends = await db.collection(`companies/${companyId}/whatsappTemplateSends`)
          .where('to', '==', incoming.from)
          .where('sentAt', '>=', sevenDaysAgo)
          .orderBy('sentAt', 'desc')
          .limit(1)
          .get()
          .catch(() => null);
        if (recentSends && !recentSends.empty) {
          const sendDoc = recentSends.docs[0];
          const sendData = sendDoc.data();
          if (!sendData['replied']) {
            await sendDoc.ref.update({ replied: true, repliedAt: new Date() });
            const broadcastId = sendData['relatedBroadcastId'] as string | undefined;
            if (broadcastId) {
              await db.collection(`companies/${companyId}/whatsappBroadcasts`).doc(broadcastId)
                .update({ repliedCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() })
                .catch(() => null);
            }
            const leadId = sendData['relatedLeadId'] as string | undefined;
            if (leadId) {
              await db.collection(`companies/${companyId}/whatsappLeads`).doc(leadId)
                .update({ repliedToTemplate: true, repliedAt: new Date() })
                .catch(() => null);
            }
          }
        }

        // Catalog product sends — same logic, separate collection
        const recentProducts = await db.collection(`companies/${companyId}/whatsappCatalogSends`)
          .where('to', '==', incoming.from)
          .where('sentAt', '>=', sevenDaysAgo)
          .orderBy('sentAt', 'desc')
          .limit(1)
          .get()
          .catch(() => null);
        if (recentProducts && !recentProducts.empty) {
          const sendDoc = recentProducts.docs[0];
          const sendData = sendDoc.data();
          if (!sendData['replied']) {
            await sendDoc.ref.update({ replied: true, repliedAt: new Date() });
            const leadId = sendData['relatedLeadId'] as string | undefined;
            if (leadId) {
              await db.collection(`companies/${companyId}/whatsappLeads`).doc(leadId)
                .update({ repliedToProduct: true, repliedAt: new Date() })
                .catch(() => null);
            }
          }
        }
      } catch { /* best-effort */ }

      // ── Opt-out detection (STOP, UNSUBSCRIBE, ARRÊTER) ─────────────────
      // Per Meta + GDPR best practice: a customer who replies with an opt-out
      // keyword should never receive a marketing template again. We mark all
      // their leads as `optedOut: true`. Future template sends are blocked.
      const optOutPattern = /^(stop|stoppe|stop\.?|unsubscribe|désabonner|desabonner|arr[eê]ter|arret\s*envois?)\s*$/i;
      if (finalMessage && optOutPattern.test(finalMessage.trim())) {
        try {
          const leadsSnap = await db.collection(`companies/${companyId}/whatsappLeads`)
            .where('customerPhone', '==', incoming.from).limit(20).get();
          for (const ld of leadsSnap.docs) {
            await ld.ref.update({ optedOut: true, optedOutAt: new Date() });
          }
          // Also store on the conversation doc for quick check during sends
          const phoneKey = (incoming.from ?? '').replace(/\D/g, '');
          await db.collection(`companies/${companyId}/whatsappConversations`).doc(phoneKey).set({
            optedOut: true,
            optedOutAt: new Date(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          // Confirm to the customer per regulation
          const cfg = await whatsappService.getConfig(companyId).catch(() => null);
          if (cfg) {
            await whatsappService.sendMessage(cfg, incoming.from,
              "👍 Bien noté — vous ne recevrez plus de messages marketing. Pour reprendre, écrivez-nous quand vous voulez.").catch(() => null);
          }
          logger.info('[WhatsApp] Opted-out customer', { from: incoming.from, leadsAffected: leadsSnap.size });
        } catch (err) {
          logger.warn('[WhatsApp] opt-out processing failed (non-blocking)', { error: String(err) });
        }
        return; // skip orchestrator — don't reply with the bot
      }

      // ── Cas: transcription vocale échouée → réponse de fallback claire ───
      // Sinon le user reste sans réponse (= "silent fail" perçu comme bug).
      // Intent-aware: vocal raté → "Je n'ai pas compris ton vocal" — explicite.
      if (transcriptionFailed) {
        try {
          const fallbackText = incoming.type === 'audio'
            ? "🎙️ J'ai bien reçu ton message vocal mais je n'ai pas pu le comprendre (audio inaudible, silence, ou problème réseau). Peux-tu réessayer en parlant plus clairement, ou m'écrire en texte ?"
            : "Désolé, je n'ai pas pu traiter ton message. Peux-tu reformuler ?";
          const cfg = await whatsappService.getConfig(companyId).catch(() => null);
          if (cfg && accessToken && phoneNumberId) {
            await whatsappService.sendMessage(cfg, incoming.from, fallbackText);
            logger.info('[WhatsApp] Sent transcription-fallback reply', { to: incoming.from, type: incoming.type });
          }
        } catch (err) {
          logger.error('[WhatsApp] Fallback reply failed', { error: err });
        }
        return; // skip orchestrator — there's nothing to process
      }

      // ── Déclencher l'Agent Orlode ───────────────────────────────────────
      if (finalMessage) {
        try {
          // ── Config WhatsApp de l'entreprise ───────────────────────────────
          const config = await whatsappService.getConfig(companyId).catch(() => null);

          // ── Load conversation history for this contact (last 10 messages) ──
          let history: { role: 'user' | 'model'; content: string }[] = [];
          try {
            const historySnap = await db.collection(`companies/${companyId}/whatsappMessages`)
              .where('from', '==', incoming.from)
              .orderBy('createdAt', 'desc')
              .limit(10)
              .get();
            history = historySnap.docs
              .map(d => {
                const data = d.data();
                return {
                  role: (data['direction'] === 'inbound' ? 'user' : 'model') as 'user' | 'model',
                  content: (data['message'] as string) ?? '',
                };
              })
              .reverse(); // oldest first
          } catch { /* index may not exist yet — continue without history */ }

          // ── Human Handoff check (before orchestrator) ────────────────────
          // If the customer is asking for a human or showing frustration AND
          // handoff is enabled with a notify channel, escalate to the team.
          // We still let the AI reply with a "un humain te recontacte" message
          // so the customer isn't left hanging.
          const handoff = (config as any)?.humanHandoff as {
            enabled?: boolean; notifyChannelId?: string;
            threshold?: 'sensitive' | 'normal' | 'strict';
            customerReply?: string;
          } | undefined;

          // ── Conversation flow control ────────────────────────────────────
          // Even if handoff was previously triggered, decide whether the AI
          // should reply, stay silent (human is on it), or resume softly
          // after a timeout. This is the state machine for handoff.
          const handoffSvc = await import('../services/whatsapp/humanHandoffService');
          const flow = handoff?.enabled
            ? await handoffSvc.decideConversationFlow(companyId, incoming.from)
            : 'ai_should_run';

          logger.info('[Handoff] check', {
            companyId,
            enabled: !!handoff?.enabled,
            hasChannel: !!handoff?.notifyChannelId,
            threshold: handoff?.threshold,
            flow,
            messagePreview: finalMessage.slice(0, 80),
          });

          // If a human is actively handling this conversation, stay completely
          // silent. The customer expects a human reply, not the bot interrupting.
          if (flow === 'ai_blocked') {
            logger.info('[Handoff] AI blocked — human is on it', { companyId, from: incoming.from });
            return; // skip orchestrator entirely; no auto-reply
          }

          let handoffTriggered = false;
          let handoffReply: string | null = null;
          let aiResumesSoftly = flow === 'ai_resumes_softly';

          // Detection runs only if handoff is enabled and we're in the
          // ai_should_run state (not on a soft-resume — that's a follow-up,
          // not a fresh escalation).
          if (handoff?.enabled && handoff.notifyChannelId && finalMessage && flow === 'ai_should_run') {
            try {
              const priorFrustration = handoff.threshold === 'sensitive'
                ? 0
                : await handoffSvc.recentFrustrationCount(companyId, incoming.from, 5);
              const detection = handoffSvc.detectEscalationIntent(finalMessage, handoff.threshold ?? 'normal', priorFrustration);
              logger.info('[Handoff] detection result', {
                triggered: detection.triggered,
                reason: detection.reason,
                matchedTerm: detection.matchedTerm,
                priorFrustration,
              });
              if (detection.triggered && detection.reason) {
                const recentMsgs = history.slice(-5).map(h => `${h.role === 'user' ? '👤' : '🤖'} ${h.content.slice(0, 200)}`);
                await handoffSvc.notifyTeamOfEscalation({
                  companyId,
                  channelId: handoff.notifyChannelId,
                  customerPhone: incoming.from,
                  triggerMessage: finalMessage,
                  reason: detection.reason,
                  recentHistory: recentMsgs,
                });
                // Email the admins (best-effort, non-blocking)
                handoffSvc.emailEscalationToAdmins({
                  companyId,
                  customerPhone: incoming.from,
                  triggerMessage: finalMessage,
                  reason: detection.reason,
                  notifyEmails: (handoff as any).notifyEmails,
                }).catch(() => null);
                // WhatsApp internal notif to admin numbers (best-effort)
                const internalNumbers = (handoff as any).notifyWhatsAppNumbers as string[] | undefined;
                if (internalNumbers && internalNumbers.length > 0) {
                  handoffSvc.notifyAdminsViaWhatsApp({
                    companyId,
                    recipients: internalNumbers,
                    text:
                      `🆘 Client en attente — ${detection.reason === 'explicit' ? 'demande humain' : 'frustré'}\n\n` +
                      `Numéro : +${incoming.from}\n` +
                      `Message : « ${finalMessage.slice(0, 200)} »\n\n` +
                      `Réponds-lui directement, ou attends 5 min — l'IA reprendra.`,
                  }).catch(() => null);
                }
                // Mark the conversation as actively handed off to a human.
                await handoffSvc.setConversationStatus(companyId, incoming.from, 'handoff_active', {
                  lastEscalationAt: new Date(),
                  reason: detection.reason,
                });
                handoffTriggered = true;
                handoffReply = handoff.customerReply
                  ?? "Bien noté. Un humain de notre équipe va prendre le relais et te recontacter très vite. 🙏";
                logger.info('[WhatsApp] Handoff triggered', { companyId, from: incoming.from, reason: detection.reason });
              }
            } catch (err) {
              logger.warn('[WhatsApp] Handoff check failed (non-blocking)', { error: err instanceof Error ? err.message : err });
            }
          }

          // Soft-tone system prompt suffix when the AI is resuming after timeout.
          const softResumeSuffix = aiResumesSoftly ? handoffSvc.SOFT_RESUME_PROMPT_SUFFIX : '';

          // If handoff triggered, skip the orchestrator entirely and use the
          // pre-defined customerReply. The team has been notified separately.
          let replyText: string;
          let extraMessages: string[] = [];
          if (handoffTriggered && handoffReply) {
            replyText = handoffReply;
          } else {
            // If we're resuming softly after a handoff timeout, append the
            // empathy + lead-capture instruction to the system prompt.
            const effectiveSystemPrompt = aiResumesSoftly
              ? `${config?.systemPrompt ?? ''}${softResumeSuffix}`
              : config?.systemPrompt;

            const { handleMessage } = await import('../messaging');
            const msgResult = await handleMessage(
              {
                text: finalMessage,
                from: incoming.from,
                channel: 'whatsapp',
                wasVoice: incoming.type === 'audio',
                providerMeta: { phoneNumberId, messageId: incoming.messageId },
              },
              {
                companyId,
                history,
                language: config?.language ?? 'fr',
                customSystemPrompt: effectiveSystemPrompt,
                fastReply: true,
              },
            );
            replyText = msgResult.messages[0] ?? 'Je n\'ai pas pu traiter votre demande.';
            extraMessages = msgResult.messages.slice(1);

            // After a successful soft-resume reply, mark the conversation as
            // resolved so the AI keeps responding normally going forward
            // (until the user re-escalates).
            if (aiResumesSoftly) {
              await handoffSvc.setConversationStatus(companyId, incoming.from, 'handoff_resolved', {
                resumedAt: new Date(),
              });
            }
          }
          const phoneId = phoneNumberId ?? '';
          const token   = accessToken;
          const fakeConfig = config ?? {
            accessToken: token, phoneNumberId: phoneId,
            businessAccountId: process.env['WHATSAPP_BUSINESS_ACCOUNT_ID'] ?? '',
            webhookVerifyToken: '',
            autoReply: true, replyMode: 'auto' as const,
            ttsVoice: 'alloy' as const, language: 'fr',
          };

          // ── Réponse selon replyMode ───────────────────────────────────────
          const mode = fakeConfig.replyMode ?? 'auto';
          const useVoice = mode === 'voice' || (mode === 'auto' && incoming.type === 'audio');
          if (useVoice) {
            await whatsappService.sendVoiceReply(fakeConfig, incoming.from, replyText, companyId);
          } else {
            await whatsappService.sendMessage(fakeConfig, incoming.from, replyText);
            // Send extra parts if the response was split (validate() returned an array)
            for (const extra of extraMessages) {
              await whatsappService.sendMessage(fakeConfig, incoming.from, extra);
            }
          }

          // Marquer comme traité
          const msgs = await db.collection(`companies/${companyId}/whatsappMessages`)
            .where('from', '==', incoming.from)
            .where('processed', '==', false)
            .orderBy('createdAt', 'desc').limit(1).get();
          msgs.docs[0]?.ref.update({ processed: true, agentReply: replyText });

          logger.info('[WhatsApp] Agent replied', { to: incoming.from, type: incoming.type === 'audio' ? 'voice' : 'text' });
        } catch (err) {
          logger.error('[WhatsApp] Agent processing failed', { error: err });
        }
      }
    } catch (err) {
      logger.error('[WhatsApp] Webhook processing failed', { error: err });
    }
  });
}));

// ── Webhook par companyId (legacy — gardé pour compatibilité) ─────────────────

router.get('/webhook/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;
  const { companyId } = req.params as { companyId: string };
  const config = await whatsappService.getConfig(companyId);
  if (mode === 'subscribe' && config && token === config.webhookVerifyToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
}));

router.post('/webhook/:companyId', asyncHandler(async (req: Request & { rawBody?: Buffer }, res: Response) => {
  res.status(200).send('OK');
  const { companyId } = req.params as { companyId: string };
  const incoming = whatsappService.parseWebhook(req.body as Record<string, unknown>);
  if (!incoming || !incoming.message) return;
  setImmediate(async () => {
    try {
      await getFirestore().collection(`companies/${companyId}/whatsappMessages`).add({
        direction: 'inbound', from: incoming.from, message: incoming.message,
        type: incoming.type, timestamp: new Date(incoming.timestamp), processed: false, createdAt: new Date(),
      });
    } catch (err) {
      logger.error('[WhatsApp] Failed to save incoming message (per-company)', { error: err });
    }
  });
}));

// ── Public route: Cloud Scheduler cron tick ──────────────────────────────────
// Must be defined BEFORE the auth middleware below so Cloud Scheduler can hit
// it without a Firebase ID token. Auth here is a shared secret in the header.
router.post('/handoff/cron-tick', async (req: Request, res: Response) => {
  const secret = process.env['CRON_SECRET'];
  const provided = req.header('x-cron-secret');
  if (!secret || !provided || secret !== provided) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const [{ processTimeoutCron }, { processAutoBroadcastRules }, { processScheduledPostsCron }] = await Promise.all([
      import('../services/whatsapp/humanHandoffService'),
      import('../services/whatsapp/autoBroadcastService'),
      import('../services/social/socialPublishService'),
    ]);
    const [handoffStats, autoStats, socialStats] = await Promise.all([
      processTimeoutCron(),
      processAutoBroadcastRules(),
      processScheduledPostsCron(),
    ]);
    return res.json({ success: true, data: { handoff: handoffStats, autoBroadcast: autoStats, socialPosts: socialStats } });
  } catch (err: any) {
    logger.error('[Cron] tick failed', { error: String(err) });
    return res.status(500).json({ success: false, message: err?.message ?? 'Cron failed' });
  }
});

// ── Routes protégées (admin) ──────────────────────────────────────────────────

router.use(authMiddleware);
router.use(adminOnlyMiddleware);

// GET /api/whatsapp/status — statut de la connexion
router.get('/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const config = await whatsappService.getConfig(companyId) as (WhatsAppConfig & {
    displayPhoneNumber?: string; verifiedName?: string; qualityRating?: string;
    phoneInfoFetchedAt?: any;
    autoReply?: boolean; replyMode?: string; ttsVoice?: string;
    language?: string; systemPrompt?: string; personaId?: string;
  }) | null;

  // Fetch live phone metadata if missing or older than 24h. Best-effort —
  // never block the /status response if Meta is slow or unreachable.
  let displayPhoneNumber = config?.displayPhoneNumber ?? null;
  let verifiedName = config?.verifiedName ?? null;
  if (config && (!config.displayPhoneNumber || isStaleTimestamp(config.phoneInfoFetchedAt, 24 * 3600 * 1000))) {
    const info = await whatsappService.fetchPhoneInfo(companyId);
    if (info) {
      displayPhoneNumber = info.displayPhoneNumber;
      verifiedName = info.verifiedName;
    }
  }

  res.json({
    success: true,
    data: {
      connected: !!config,
      phoneNumberId: config?.phoneNumberId ?? null,
      phoneNumber: displayPhoneNumber,
      displayPhoneNumber,
      verifiedName,
      businessAccountId: config?.businessAccountId ?? null,
      coexistenceMode: config?.coexistenceMode ?? false,
      settings: config ? {
        autoReply: config.autoReply ?? true,
        replyMode: config.replyMode ?? 'auto',
        ttsVoice: config.ttsVoice ?? 'Fable',
        language: config.language ?? 'fr',
        systemPrompt: config.systemPrompt ?? null,
        personaId: config.personaId ?? 'pro',
        humanHandoff: (config as any).humanHandoff ?? null,
      } : null,
    },
  });
}));

function isStaleTimestamp(ts: any, maxAgeMs: number): boolean {
  if (!ts) return true;
  const ms = ts?._seconds ? ts._seconds * 1000 : (ts instanceof Date ? ts.getTime() : 0);
  if (!ms) return true;
  return Date.now() - ms > maxAgeMs;
}

// POST /api/whatsapp/connect — connecter WhatsApp (manuel ou Embedded Signup)
router.post('/connect', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { accessToken, phoneNumberId, businessAccountId } = req.body as {
    accessToken: string; phoneNumberId: string; businessAccountId: string;
  };
  if (!accessToken || !phoneNumberId || !businessAccountId) {
    throw new AppError('accessToken, phoneNumberId, and businessAccountId are required', 400);
  }
  await whatsappService.saveConfig(companyId, {
    accessToken, phoneNumberId, businessAccountId,
    autoReply: true, replyMode: 'auto', ttsVoice: 'alloy', language: 'fr',
  });
  res.json({ success: true, message: 'WhatsApp connecté avec succès' });
}));

// POST /api/whatsapp/embedded-signup — exchange Facebook code for WhatsApp credentials
router.post('/embedded-signup', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { code, redirectUri, mode } = req.body as { code: string; redirectUri?: string; mode?: 'coexistence' | 'classic' };
  const coexistenceMode = mode === 'coexistence';
  // eslint-disable-next-line no-console
  console.log('[WhatsApp embedded-signup] Received', { companyId, hasCode: !!code, codePrefix: code?.slice(0, 10), mode: coexistenceMode ? 'coexistence' : 'classic', bodyKeys: Object.keys(req.body ?? {}) });
  if (!code) throw new AppError('Facebook auth code required — did the Facebook popup close without granting permission?', 400);

  // META_APP_ID / META_APP_SECRET refer to the same Facebook App that hosts
  // WhatsApp. Many envs configure the same value as WHATSAPP_APP_ID /
  // WHATSAPP_APP_SECRET (or use VITE_META_APP_ID for the client) — accept all.
  const META_APP_ID = process.env['META_APP_ID']
    ?? process.env['WHATSAPP_APP_ID']
    ?? process.env['VITE_META_APP_ID']
    ?? process.env['FACEBOOK_APP_ID']
    ?? '';
  const META_APP_SECRET = process.env['META_APP_SECRET']
    ?? process.env['WHATSAPP_APP_SECRET']
    ?? process.env['FACEBOOK_APP_SECRET']
    ?? '';

  if (!META_APP_ID || !META_APP_SECRET) {
    const missing: string[] = [];
    if (!META_APP_ID) missing.push('META_APP_ID (or WHATSAPP_APP_ID)');
    if (!META_APP_SECRET) missing.push('META_APP_SECRET (or WHATSAPP_APP_SECRET)');
    throw new AppError(`Meta App not configured. Missing: ${missing.join(', ')}.`, 500);
  }

  // 1. Exchange code for access token.
  // For JS SDK FB.login() flow, redirect_uri MUST be omitted (Meta requirement).
  // For server-side OAuth redirect flow, redirect_uri must match the original.
  // We try without redirect_uri first (JS SDK flow); if it fails, retry with redirect_uri.
  let tokenData: { access_token?: string; error?: { message: string; code?: number; type?: string } } = {};
  const buildUrl = (withRedirect?: string) => {
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      code,
    });
    if (withRedirect) params.set('redirect_uri', withRedirect);
    return `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`;
  };

  // Attempt 1: JS SDK flow (no redirect_uri)
  const tokenRes1 = await fetch(buildUrl());
  tokenData = await tokenRes1.json() as typeof tokenData;
  // eslint-disable-next-line no-console
  console.log('[WhatsApp embedded-signup] Token exchange (no redirect)', { ok: !!tokenData.access_token, error: tokenData.error });

  if (!tokenData.access_token && redirectUri) {
    // Attempt 2: server-side OAuth flow (with redirect_uri)
    const tokenRes2 = await fetch(buildUrl(redirectUri));
    tokenData = await tokenRes2.json() as typeof tokenData;
    // eslint-disable-next-line no-console
    console.log('[WhatsApp embedded-signup] Token exchange (with redirect)', { ok: !!tokenData.access_token, redirect: redirectUri, error: tokenData.error });
  }

  if (!tokenData.access_token) {
    // eslint-disable-next-line no-console
    console.error('[WhatsApp embedded-signup] Token exchange failed (both modes)', { companyId, fbError: tokenData.error, redirectUri });
    throw new AppError(tokenData.error?.message ?? 'Failed to exchange code', 400);
  }

  // 2. Get WhatsApp Business Account ID
  const debugRes = await fetch(
    `https://graph.facebook.com/v21.0/debug_token?input_token=${tokenData.access_token}&access_token=${META_APP_ID}|${META_APP_SECRET}`
  );
  const debugData = await debugRes.json() as { data?: { granular_scopes?: Array<{ scope: string; target_ids: string[] }>; scopes?: string[] } };
  // eslint-disable-next-line no-console
  console.log('[WhatsApp embedded-signup] debug_token response', JSON.stringify(debugData, null, 2));

  const waScope = debugData.data?.granular_scopes?.find(s => s.scope === 'whatsapp_business_management');
  let businessAccountId = waScope?.target_ids?.[0] ?? '';

  // Fallback: try /me/businesses if no target_ids in granular_scopes
  if (!businessAccountId) {
    const bizRes = await fetch(`https://graph.facebook.com/v21.0/me/businesses?access_token=${tokenData.access_token}`);
    const bizData = await bizRes.json() as { data?: Array<{ id: string; name: string }>; error?: { message: string } };
    // eslint-disable-next-line no-console
    console.log('[WhatsApp embedded-signup] /me/businesses fallback', JSON.stringify(bizData, null, 2));
    if (bizData.data && bizData.data.length > 0) {
      // For each business, list owned WABA
      for (const biz of bizData.data) {
        const wabaRes = await fetch(`https://graph.facebook.com/v21.0/${biz.id}/owned_whatsapp_business_accounts?access_token=${tokenData.access_token}`);
        const wabaData = await wabaRes.json() as { data?: Array<{ id: string }> };
        if (wabaData.data && wabaData.data.length > 0) {
          businessAccountId = wabaData.data[0].id;
          break;
        }
      }
    }
  }

  if (!businessAccountId) {
    const grantedScopes = debugData.data?.scopes?.join(', ') ?? 'aucun';
    throw new AppError(
      `Aucune WhatsApp Business Account trouvée. Permissions accordées: [${grantedScopes}]. Vérifiez que vous avez bien sélectionné un WABA dans la popup Facebook et accordé "whatsapp_business_management".`,
      400,
    );
  }

  // 3. Get phone number ID from the business account
  const phonesRes = await fetch(
    `https://graph.facebook.com/v21.0/${businessAccountId}/phone_numbers`,
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );
  const phonesData = await phonesRes.json() as { data?: Array<{ id: string; display_phone_number: string }> };
  const phoneNumberId = phonesData.data?.[0]?.id ?? '';
  const displayPhone = phonesData.data?.[0]?.display_phone_number ?? '';

  if (!phoneNumberId) {
    throw new AppError('No phone number found in this WhatsApp Business Account', 400);
  }

  // 4. Subscribe the app to the webhook
  await fetch(
    `https://graph.facebook.com/v21.0/${businessAccountId}/subscribed_apps`,
    { method: 'POST', headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  ).catch(() => {});

  // 5. Register the phone number with Cloud API.
  // CLASSIC MODE → /register migrates the number to the API (the WhatsApp
  // Business app on the user's phone stops working).
  // COEXISTENCE MODE → SKIP /register. The number stays on the user's phone
  // app AND the Cloud API can send/receive in parallel. Required for the
  // "keep your existing WhatsApp Business app" promise.
  const REGISTER_PIN = '124578';
  let registerStatus: { success: boolean; message: string } = { success: false, message: '' };
  if (coexistenceMode) {
    registerStatus = { success: true, message: 'Mode coexistence — /register sauté, le numéro reste actif sur votre WhatsApp Business app.' };
  } else {
    try {
      const regRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/register`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', pin: REGISTER_PIN }),
        },
      );
      const regData = await regRes.json() as { success?: boolean; error?: { message: string; code?: number } };
      // eslint-disable-next-line no-console
      console.log('[WhatsApp embedded-signup] /register response', JSON.stringify(regData, null, 2));
      if (regData.success) {
        registerStatus = { success: true, message: `Numéro enregistré avec PIN ${REGISTER_PIN}` };
      } else {
        registerStatus = { success: false, message: regData.error?.message ?? 'Échec enregistrement Cloud API' };
      }
    } catch (err) {
      registerStatus = { success: false, message: `Échec /register : ${(err as Error).message ?? String(err)}` };
    }
  }

  // 6. Save config — include coexistenceMode so we can show a badge later
  // and adjust API behavior (some templates / features differ in coexistence).
  await whatsappService.saveConfig(companyId, {
    accessToken: tokenData.access_token,
    phoneNumberId,
    businessAccountId,
    autoReply: true, replyMode: 'auto', ttsVoice: 'alloy', language: 'fr',
    coexistenceMode,
  });

  // 6b. Register this number in the platform-wide business numbers index so
  // the bot-to-bot loop guard skips replies to other Orlode-connected numbers.
  try {
    const fromDigits = (displayPhone ?? '').replace(/\D/g, '');
    if (fromDigits) {
      await getFirestore().collection('_platformBusinessNumbers').doc(fromDigits).set({
        companyId,
        phoneNumberId,
        displayPhone,
        registeredAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  } catch (err) {
    logger.warn('[WhatsApp] Failed to register business number in platform index', { error: err });
  }

  logger.info(`[WhatsApp] Embedded Signup complete for company ${companyId}: ${displayPhone} | mode=${coexistenceMode ? 'coexistence' : 'classic'} | register=${registerStatus.success}`);

  const baseMsg = `WhatsApp connecté : ${displayPhone}`;
  const modeMsg = coexistenceMode ? ' · mode coexistence (votre app reste active)' : (registerStatus.success ? ` (enregistré, PIN: ${REGISTER_PIN})` : ` — ⚠️ ${registerStatus.message}`);
  res.json({
    success: true,
    data: { phoneNumberId, businessAccountId, displayPhone, coexistenceMode, registered: registerStatus.success, registerNote: registerStatus.message },
    message: baseMsg + modeMsg,
  });
}));

// POST /api/whatsapp/register-phone — register/re-register the phone number with Cloud API
// Required if the user changed the PIN, or if initial register failed
router.post('/register-phone', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { pin, dataLocalizationRegion } = req.body as { pin?: string; dataLocalizationRegion?: string };
  const cfg = await whatsappService.getConfig(companyId);
  if (!cfg) throw new AppError('WhatsApp non connecté', 400);

  const PIN = pin ?? '124578';
  const region = dataLocalizationRegion ? String(dataLocalizationRegion).toUpperCase() : undefined;
  if (region && !/^[A-Z]{2}$/.test(region)) {
    throw new AppError('dataLocalizationRegion doit être un code ISO 2 lettres (ex: DE, FR, GB)', 400);
  }
  const result = await whatsappService.registerPhoneNumber(cfg, PIN, region);
  if (result.success) {
    res.json({
      success: true,
      message: `Numéro ${cfg.phoneNumberId} enregistré avec PIN ${PIN}${region ? ` (région: ${region})` : ''}.`,
      dataLocalizationRegion: region ?? null,
    });
  } else {
    throw new AppError(result.error ?? 'Échec enregistrement', 400);
  }
}));

// ──────────────────────────────────────────────────────────────────────────
// MANUAL VERIFICATION FLOW (Solution Partner / programmatic enrollment)
// 3 steps: request-code → verify-code → register-phone (existing)
// ──────────────────────────────────────────────────────────────────────────

// POST /api/whatsapp/request-code — Step 1: ask Meta to send SMS/VOICE OTP
// body: { phoneNumberId, codeMethod: 'SMS'|'VOICE', language?: string, accessToken?: string }
router.post('/request-code', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const body = req.body as {
    phoneNumberId?: string;
    codeMethod?: 'SMS' | 'VOICE';
    language?: string;
    accessToken?: string;
  };
  const codeMethod = (body.codeMethod ?? 'SMS').toUpperCase();
  const language = body.language ?? 'fr';

  // Use stored config if not provided in body
  let phoneNumberId = body.phoneNumberId;
  let accessToken = body.accessToken;
  if (!phoneNumberId || !accessToken) {
    const cfg = await whatsappService.getConfig(companyId);
    if (!cfg) throw new AppError('WhatsApp non configuré : fournissez phoneNumberId + accessToken', 400);
    phoneNumberId = phoneNumberId ?? cfg.phoneNumberId;
    if (!accessToken) {
      const { decrypt } = await import('../config/encryption');
      accessToken = decrypt(cfg.accessToken);
    }
  }

  if (!phoneNumberId || !accessToken) throw new AppError('phoneNumberId et accessToken requis', 400);
  if (!['SMS', 'VOICE'].includes(codeMethod)) throw new AppError('codeMethod doit être SMS ou VOICE', 400);

  try {
    const r = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/request_code`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code_method: codeMethod, language }),
    });
    const data: any = await r.json();
    if (!r.ok || data.error) {
      const code = Number(data?.error?.code ?? 0);
      const raw = data?.error?.message ?? data?.error?.error_user_msg ?? 'Échec request_code';
      let friendly = raw;
      let httpCode = 400;
      if (code === 133008) { friendly = 'Numéro bloqué par Meta (cooldown 24-72h) — trop de demandes consécutives.'; httpCode = 429; }
      else if (code === 133009) { friendly = 'Limite quotidienne de demandes de code atteinte.'; httpCode = 429; }
      else if (code === 133010) friendly = 'Numéro déjà enregistré sur Cloud API. Passe directement à l\'étape PIN ou désenregistre d\'abord.';
      else if (code === 190) { friendly = 'Access token expiré ou invalide.'; httpCode = 401; }
      else if (code === 100) friendly = `Paramètres invalides : ${raw}`;
      logger.warn('[WhatsApp] request_code error', { phoneNumberId, code, raw });
      throw new AppError(friendly, httpCode);
    }
    logger.info(`[WhatsApp] request_code OK for ${phoneNumberId} (${codeMethod}/${language})`);
    res.json({ success: true, message: `Code ${codeMethod} envoyé. Le client va recevoir un OTP à 6 chiffres.` });
  } catch (e: any) {
    if (e instanceof AppError) throw e;
    throw new AppError(`Échec request_code : ${e?.message ?? String(e)}`, 500);
  }
}));

// POST /api/whatsapp/verify-code — Step 2: submit the 6-digit OTP received by client
// body: { phoneNumberId, code, accessToken? }
router.post('/verify-code', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const body = req.body as {
    phoneNumberId?: string;
    code?: string;
    accessToken?: string;
  };
  const code = (body.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) throw new AppError('code doit être 6 chiffres', 400);

  let phoneNumberId = body.phoneNumberId;
  let accessToken = body.accessToken;
  if (!phoneNumberId || !accessToken) {
    const cfg = await whatsappService.getConfig(companyId);
    if (!cfg) throw new AppError('WhatsApp non configuré', 400);
    phoneNumberId = phoneNumberId ?? cfg.phoneNumberId;
    if (!accessToken) {
      const { decrypt } = await import('../config/encryption');
      accessToken = decrypt(cfg.accessToken);
    }
  }

  if (!phoneNumberId || !accessToken) throw new AppError('phoneNumberId et accessToken requis', 400);

  try {
    const r = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/verify_code`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    const data: any = await r.json();
    if (!r.ok || data.error) {
      // Meta verify_code error codes:
      //  133005 → invalid code        133006 → expired
      //  133007 → too many attempts   133008 → number banned (24-72h cooldown)
      //  133009 → reached max requests for the day
      //  100   → bad parameters       190    → token expired/invalid
      const code = Number(data?.error?.code ?? 0);
      const sub = Number(data?.error?.error_subcode ?? 0);
      const raw = data?.error?.message ?? data?.error?.error_user_msg ?? '';
      let friendly = raw;
      let httpCode = 400;
      if (code === 133005) friendly = 'Code invalide. Vérifie les 6 chiffres reçus par SMS/Voice.';
      else if (code === 133006) friendly = 'Code expiré. Demande un nouveau code (Étape 1).';
      else if (code === 133007) friendly = 'Trop de tentatives échouées. Patiente avant de réessayer.';
      else if (code === 133008) { friendly = 'Numéro temporairement bloqué par Meta (24-72h). Trop de demandes répétées — attends ou contacte le support Meta.'; httpCode = 429; }
      else if (code === 133009) { friendly = 'Limite quotidienne de demandes atteinte. Réessaie demain.'; httpCode = 429; }
      else if (code === 190) { friendly = 'Access token expiré ou invalide. Reconnecte le compte Meta.'; httpCode = 401; }
      else if (code === 100) friendly = `Paramètres invalides : ${raw}`;
      logger.warn('[WhatsApp] verify_code error', { phoneNumberId, code, sub, raw });
      throw new AppError(friendly || 'Échec verify_code', httpCode);
    }
    logger.info(`[WhatsApp] verify_code OK for ${phoneNumberId}`);
    res.json({
      success: true,
      message: 'Code vérifié. Étape suivante : appelez /register-phone avec un PIN pour activer le numéro.',
    });
  } catch (e: any) {
    if (e instanceof AppError) throw e;
    throw new AppError(`Échec verify_code : ${e?.message ?? String(e)}`, 500);
  }
}));

// DELETE /api/whatsapp/disconnect
router.delete('/disconnect', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await whatsappService.disconnect(companyId);
  res.json({ success: true, message: 'WhatsApp déconnecté' });
}));

// POST /api/whatsapp/send — envoyer un message test
router.post('/send', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const config = await whatsappService.getConfig(companyId);
  if (!config) throw new AppError('WhatsApp non connecté', 400);
  const { to, message } = req.body as { to: string; message: string };
  if (!to || !message) throw new AppError('to and message are required', 400);
  const messageId = await whatsappService.sendMessage(config, to, message);
  res.json({ success: true, data: { messageId } });
}));

// PATCH /api/whatsapp/settings — paramètres conversation (voix, mode, langue, prompt, persona, handoff)
router.patch('/settings', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { autoReply, replyMode, ttsVoice, language, systemPrompt, personaId, humanHandoff } = req.body as {
    autoReply?: boolean; replyMode?: 'text' | 'voice' | 'auto';
    ttsVoice?: string; language?: string; systemPrompt?: string; personaId?: string;
    humanHandoff?: {
      enabled?: boolean; notifyChannelId?: string;
      threshold?: 'sensitive' | 'normal' | 'strict';
      customerReply?: string;
      notifyEmails?: string[];
      notifyWhatsAppNumbers?: string[];
    };
  };
  await whatsappService.updateSettings(companyId, {
    autoReply, replyMode, ttsVoice: ttsVoice as any, language, systemPrompt, personaId, humanHandoff,
  });
  res.json({ success: true, message: 'Paramètres mis à jour' });
}));

// GET /api/whatsapp/templates — list message templates (HSMs) from Meta.
// Cached on the integration doc for 5 min so we don't hammer Meta on every UI render.
router.get('/templates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const cacheRef = db.collection('companies').doc(companyId).collection('integrations').doc('whatsappTemplatesCache');
  const force = req.query['refresh'] === '1';

  if (!force) {
    const cached = await cacheRef.get();
    const data = cached.data();
    const fetchedAt = data?.['fetchedAt']?.toDate?.();
    if (fetchedAt && Date.now() - fetchedAt.getTime() < 5 * 60 * 1000) {
      return res.json({ success: true, data: data?.['templates'] ?? [], cached: true });
    }
  }

  const templates = await whatsappService.fetchTemplates(companyId);
  await cacheRef.set({ templates, fetchedAt: new Date() }, { merge: true });
  res.json({ success: true, data: templates, cached: false });
}));

// POST /api/whatsapp/templates/send — send a template message to one or more recipients.
// Body: { to: string | string[], templateName, languageCode, bodyParams?: string[], headerParam?: string }
router.post('/templates/send', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { to, templateName, languageCode, bodyParams, headerParam } = req.body as {
    to: string | string[];
    templateName: string;
    languageCode: string;
    bodyParams?: string[];
    headerParam?: string;
  };
  if (!to || !templateName || !languageCode) {
    throw new AppError('to, templateName, languageCode required', 400);
  }

  const config = await whatsappService.getConfig(companyId);
  if (!config) throw new AppError('WhatsApp non connecté pour cette entreprise', 400);

  // Build Meta `components` array from simple bodyParams + optional headerParam.
  const components: Array<Record<string, unknown>> = [];
  if (headerParam) {
    components.push({ type: 'header', parameters: [{ type: 'text', text: headerParam }] });
  }
  if (bodyParams && bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map(p => ({ type: 'text', text: p })),
    });
  }

  const recipients = Array.isArray(to) ? to : [to];
  const results: Array<{ to: string; messageId: string | null; error?: string }> = [];
  for (const r of recipients) {
    const out = await whatsappService.sendTemplateRich(config, r, templateName, languageCode, components);
    results.push({ to: r, ...out });
    // Audit
    try {
      await getFirestore().collection(`companies/${companyId}/whatsappTemplateSends`).add({
        to: r,
        templateName,
        languageCode,
        bodyParams: bodyParams ?? [],
        headerParam: headerParam ?? null,
        messageId: out.messageId,
        error: out.error ?? null,
        sentBy: userId,
        sentAt: FieldValue.serverTimestamp(),
      });
    } catch { /* non-blocking */ }
  }

  const successCount = results.filter(r => r.messageId).length;
  res.json({ success: true, data: { sent: successCount, total: recipients.length, results } });
}));

// ─── Ads attribution (Click-to-WhatsApp campaigns) ─────────────────────────
//
// Each Meta campaign that drives WhatsApp conversations is tracked in
// `companies/{cid}/whatsappAdCampaigns/{campaignId}` with counters:
//   - conversationsStarted: # of unique conversations from this ad
//   - leadsCreated: # of leads tagged with this campaign
//   - wonCount: # of leads converted (closed_won) from this campaign
//   - revenueTotal: sum of revenue from converted leads
//   - adSpend (manual): the user enters their ad spend so we compute ROAS

router.get('/ads/campaigns', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${companyId}/whatsappAdCampaigns`)
    .orderBy('lastSeenAt', 'desc').limit(100).get().catch(() => null);
  res.json({ success: true, data: snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [] });
}));

// PATCH — user-editable fields: adSpend (manual cost), label (human name)
router.patch('/ads/campaigns/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { adSpend, label } = req.body as { adSpend?: number; label?: string };
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof adSpend === 'number' && !isNaN(adSpend) && adSpend >= 0) update['adSpend'] = adSpend;
  if (typeof label === 'string') update['label'] = label;
  await getFirestore().collection(`companies/${companyId}/whatsappAdCampaigns`).doc(req.params.id).set(update, { merge: true });
  res.json({ success: true });
}));

// ─── Catalog (WhatsApp Commerce) ────────────────────────────────────────────

// GET /api/whatsapp/catalog/products — list products from the Meta Catalog
router.get('/catalog/products', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const [catalogId, products] = await Promise.all([
    whatsappService.getCatalogId(companyId),
    whatsappService.listCatalogProducts(companyId),
  ]);
  res.json({ success: true, data: { catalogId, products } });
}));

// POST /api/whatsapp/catalog/send-product — send a product card to a customer
router.post('/catalog/send-product', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  const { to, productRetailerId, bodyText, footerText } = req.body as {
    to: string; productRetailerId: string;
    bodyText: string; footerText?: string;
  };
  if (!to || !productRetailerId || !bodyText) {
    throw new AppError('to, productRetailerId, bodyText required', 400);
  }
  const config = await whatsappService.getConfig(companyId);
  if (!config) throw new AppError('WhatsApp non connecté', 400);
  const catalogId = await whatsappService.getCatalogId(companyId);
  if (!catalogId) throw new AppError('Aucun catalogue Meta lié à cette entreprise', 400);

  const out = await whatsappService.sendProductMessage(config, to, catalogId, productRetailerId, bodyText, footerText);
  if (!out.messageId) throw new AppError(out.error ?? 'Échec envoi produit', 502);

  const db = getFirestore();

  // Look up the most recent lead for this customer phone so we can link the
  // product send to it. This is what powers per-product attribution on conversion.
  const phoneDigits = to.replace(/\D/g, '');
  let relatedLeadId: string | null = null;
  try {
    const leadSnap = await db.collection(`companies/${companyId}/whatsappLeads`)
      .where('customerPhone', 'in', [to, phoneDigits, `+${phoneDigits}`])
      .orderBy('createdAt', 'desc').limit(1).get().catch(() => null);
    if (leadSnap && !leadSnap.empty) {
      relatedLeadId = leadSnap.docs[0].id;
      await leadSnap.docs[0].ref.update({
        lastProductRetailerId: productRetailerId,
        lastProductSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => null);
    }
  } catch { /* best-effort */ }

  // Audit row — mirrors whatsappTemplateSends so we can reuse the reply-tracking
  // logic and aggregate per-product stats.
  await db.collection(`companies/${companyId}/whatsappCatalogSends`).add({
    to,
    productRetailerId,
    catalogId,
    bodyText,
    footerText: footerText ?? null,
    messageId: out.messageId,
    relatedLeadId,
    sentBy: userId,
    sentAt: FieldValue.serverTimestamp(),
  });

  res.json({ success: true, data: { messageId: out.messageId } });
}));

// GET /api/whatsapp/catalog/products/stats — per-product send/reply/won/revenue + score
//
// Score formula: (won / sent) * revenue. Captures both conversion rate AND
// monetary impact. A product that converts 90% of the time but earns nothing
// scores 0; a product with one big sale scores high.
router.get('/catalog/products/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const sendsSnap = await getFirestore()
      .collection(`companies/${companyId}/whatsappCatalogSends`)
      .where('sentAt', '>=', since)
      .limit(1000)
      .get()
      .catch(() => null);

    const stats: Record<string, { sent: number; replied: number; won: number; revenue: number; lastSentAt: number | null; score: number }> = {};
    if (sendsSnap) {
      for (const d of sendsSnap.docs) {
        const data = d.data();
        const id = (data['productRetailerId'] as string) ?? 'unknown';
        if (!stats[id]) stats[id] = { sent: 0, replied: 0, won: 0, revenue: 0, lastSentAt: null, score: 0 };
        stats[id].sent++;
        if (data['replied']) stats[id].replied++;
        const ts = data['sentAt']?.toDate?.()?.getTime() ?? null;
        if (ts && (!stats[id].lastSentAt || ts > stats[id].lastSentAt!)) stats[id].lastSentAt = ts;
      }
    }

    const leadsSnap = await getFirestore()
      .collection(`companies/${companyId}/whatsappLeads`)
      .where('status', '==', 'closed_won')
      .limit(500)
      .get()
      .catch(() => null);
    if (leadsSnap) {
      for (const d of leadsSnap.docs) {
        const lead = d.data();
        const pid = lead['lastProductRetailerId'] as string | undefined;
        if (!pid || !stats[pid]) continue;
        stats[pid].won++;
        const rev = typeof lead['revenue'] === 'number' ? lead['revenue'] : 0;
        if (rev > 0) stats[pid].revenue += rev;
      }
    }

    // Compute score = (won / sent) * revenue. Round to int for clean sorting.
    for (const pid of Object.keys(stats)) {
      const s = stats[pid];
      s.score = s.sent > 0 ? Math.round((s.won / s.sent) * s.revenue) : 0;
    }

    res.json({ success: true, data: stats });
  } catch {
    res.json({ success: true, data: {} });
  }
}));

// GET /api/whatsapp/catalog/top-products — ranked products by score, used by
// the orchestrator's getTopWhatsAppProducts tool.
router.get('/catalog/top-products', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const limit = Math.min(parseInt(String(req.query['limit'] ?? '5'), 10) || 5, 20);

  // Reuse the stats path
  const products = await whatsappService.listCatalogProducts(companyId);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sendsSnap = await getFirestore()
    .collection(`companies/${companyId}/whatsappCatalogSends`)
    .where('sentAt', '>=', since).limit(1000).get().catch(() => null);
  const leadsSnap = await getFirestore()
    .collection(`companies/${companyId}/whatsappLeads`)
    .where('status', '==', 'closed_won').limit(500).get().catch(() => null);

  const scored = products.map((p: any) => {
    const id = p.retailer_id as string;
    let sent = 0, won = 0, revenue = 0;
    if (sendsSnap) for (const d of sendsSnap.docs) {
      if (d.data()['productRetailerId'] === id) sent++;
    }
    if (leadsSnap) for (const d of leadsSnap.docs) {
      const ld = d.data();
      if (ld['lastProductRetailerId'] === id) {
        won++;
        if (typeof ld['revenue'] === 'number') revenue += ld['revenue'];
      }
    }
    const score = sent > 0 ? Math.round((won / sent) * revenue) : 0;
    return {
      retailerId: id,
      name: p.name,
      price: p.price,
      currency: p.currency,
      availability: p.availability,
      sent, won, revenue, score,
    };
  });

  // Rank: score first, then revenue, then won. Products with no data sink to bottom.
  scored.sort((a, b) => (b.score - a.score) || (b.revenue - a.revenue) || (b.won - a.won));

  res.json({ success: true, data: scored.slice(0, limit) });
}));

// ─── Auto-broadcast rules ───────────────────────────────────────────────────
//
// Rules trigger a broadcast automatically when a condition is met (e.g. "20+
// new leads in 30 min"). Evaluated by the cron tick every 1 min.

router.get('/auto-broadcasts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${companyId}/whatsappAutoBroadcasts`)
    .orderBy('createdAt', 'desc').limit(50).get().catch(() => null);
  res.json({ success: true, data: snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [] });
}));

router.post('/auto-broadcasts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  const { name, enabled, templateName, languageCode, bodyParams, prefillFromLead, condition, cooldownMinutes } = req.body as any;
  if (!name?.trim() || !templateName || !languageCode || !condition?.minLeadCount) {
    throw new AppError('name, templateName, languageCode, condition.minLeadCount required', 400);
  }
  const ref = await getFirestore().collection(`companies/${companyId}/whatsappAutoBroadcasts`).add({
    name: name.trim(),
    enabled: enabled ?? true,
    templateName,
    languageCode,
    bodyParams: bodyParams ?? [],
    prefillFromLead: prefillFromLead ?? true,
    condition,
    cooldownMinutes: cooldownMinutes ?? 60,
    totalTriggered: 0,
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.json({ success: true, data: { id: ref.id } });
}));

router.patch('/auto-broadcasts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { name, enabled, templateName, languageCode, bodyParams, prefillFromLead, condition, cooldownMinutes } = req.body as any;
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (name !== undefined) update['name'] = name;
  if (enabled !== undefined) update['enabled'] = enabled;
  if (templateName !== undefined) update['templateName'] = templateName;
  if (languageCode !== undefined) update['languageCode'] = languageCode;
  if (bodyParams !== undefined) update['bodyParams'] = bodyParams;
  if (prefillFromLead !== undefined) update['prefillFromLead'] = prefillFromLead;
  if (condition !== undefined) update['condition'] = condition;
  if (cooldownMinutes !== undefined) update['cooldownMinutes'] = cooldownMinutes;
  await getFirestore().collection(`companies/${companyId}/whatsappAutoBroadcasts`).doc(req.params.id).update(update);
  res.json({ success: true });
}));

router.delete('/auto-broadcasts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${companyId}/whatsappAutoBroadcasts`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ─── Segments endpoints (saved audience filters) ────────────────────────────
//
// A segment is a named, reusable audience filter. Power users save segments
// like "clients chauds", "leads urgents 7j" and launch broadcasts in 1 click.

// GET /api/whatsapp/segments
router.get('/segments', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${companyId}/whatsappSegments`)
    .orderBy('createdAt', 'desc').limit(50).get().catch(() => null);
  res.json({ success: true, data: snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [] });
}));

// POST /api/whatsapp/segments
router.post('/segments', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  const { name, description, filter } = req.body as { name: string; description?: string; filter: any };
  if (!name?.trim()) throw new AppError('Name required', 400);
  const ref = await getFirestore().collection(`companies/${companyId}/whatsappSegments`).add({
    name: name.trim(),
    description: description?.trim() ?? null,
    filter: filter ?? {},
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.json({ success: true, data: { id: ref.id } });
}));

// DELETE /api/whatsapp/segments/:id
router.delete('/segments/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${companyId}/whatsappSegments`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ─── Broadcast endpoints ──────────────────────────────────────────────────

// POST /api/whatsapp/broadcasts/preview — count audience for a filter
router.post('/broadcasts/preview', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { filter } = req.body as { filter: any };
  const { previewAudience } = await import('../services/whatsapp/broadcastService');
  const data = await previewAudience(companyId, filter ?? {});
  res.json({ success: true, data });
}));

// POST /api/whatsapp/broadcasts — create + start a broadcast (background send)
router.post('/broadcasts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  const { name, templateName, languageCode, bodyParams, prefillFromLead, filter } = req.body as {
    name: string;
    templateName: string;
    languageCode: string;
    bodyParams?: string[];
    prefillFromLead?: boolean;
    filter?: any;
  };
  if (!name || !templateName || !languageCode) {
    throw new AppError('name, templateName, languageCode required', 400);
  }
  const { runBroadcast } = await import('../services/whatsapp/broadcastService');
  const { broadcastId } = await runBroadcast({
    companyId,
    name,
    templateName,
    languageCode,
    bodyParams,
    prefillFromLead,
    filter: filter ?? {},
    triggeredBy: userId,
    triggeredByName: (req.user as any)?.displayName ?? (req.user as any)?.email,
  });
  res.json({ success: true, data: { broadcastId } });
}));

// GET /api/whatsapp/broadcasts — list recent broadcasts
router.get('/broadcasts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${companyId}/whatsappBroadcasts`)
    .orderBy('createdAt', 'desc').limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// GET /api/whatsapp/broadcasts/:id — single broadcast detail (with recipient sample)
router.get('/broadcasts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { id } = req.params;
  const ref = getFirestore().collection(`companies/${companyId}/whatsappBroadcasts`).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Broadcast not found', 404);
  const recsSnap = await ref.collection('recipients').limit(100).get();
  res.json({ success: true, data: { id: doc.id, ...doc.data(), recipients: recsSnap.docs.map(r => ({ id: r.id, ...r.data() })) } });
}));

// GET /api/whatsapp/leads — list captured leads
router.get('/leads', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const status = (req.query['status'] as string | undefined) ?? null;
  let q = getFirestore().collection(`companies/${companyId}/whatsappLeads`).orderBy('createdAt', 'desc').limit(100);
  if (status) q = q.where('status', '==', status) as any;
  try {
    const snap = await q.get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch {
    res.json({ success: true, data: [] });
  }
}));

// PATCH /api/whatsapp/leads/:leadId — update lead status / notes / assignee.
// Auto-sets `firstContactedAt` when status first moves to 'contacted', and
// `closedAt` when status moves to closed_won/closed_lost. These power the
// avg-response-time KPI shown on the leads dashboard.
router.patch('/leads/:leadId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  const { leadId } = req.params;
  const { status, notes, urgency, assigneeId, revenue } = req.body as {
    status?: string; notes?: string; urgency?: string;
    assigneeId?: string | null; // null clears the assignee
    revenue?: number; // captured when marking closed_won (in company currency)
  };

  const ref = getFirestore().collection(`companies/${companyId}/whatsappLeads`).doc(leadId);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Lead not found', 404);
  const current = doc.data() ?? {};

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (status !== undefined) {
    update['status'] = status;
    // First time this lead is marked 'contacted' → record the response timestamp.
    if (status === 'contacted' && !current['firstContactedAt']) {
      update['firstContactedAt'] = FieldValue.serverTimestamp();
      update['firstContactedBy'] = userId;
    }
    if ((status === 'closed_won' || status === 'closed_lost') && !current['closedAt']) {
      update['closedAt'] = FieldValue.serverTimestamp();
    }
  }

  // Ad campaign attribution: if this lead came from a Meta ad, bump the
  // campaign's wonCount and revenue when it converts.
  if (status === 'closed_won' && current['status'] !== 'closed_won') {
    const adCampaignId = current['adCampaignId'] as string | undefined;
    if (adCampaignId) {
      const incBody: Record<string, unknown> = {
        wonCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (typeof revenue === 'number' && !isNaN(revenue) && revenue > 0) {
        incBody['revenueTotal'] = FieldValue.increment(revenue);
      }
      await getFirestore().collection(`companies/${companyId}/whatsappAdCampaigns`).doc(adCampaignId)
        .set(incBody, { merge: true })
        .catch(() => null);
    }
  }

  // Conversion attribution: if the lead is being marked closed_won and we
  // have a recent template send linked to a broadcast, bump the broadcast's
  // wonCount so the dashboard can show conversion rate.
  if (status === 'closed_won' && current['status'] !== 'closed_won') {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const lastSend = await getFirestore().collection(`companies/${companyId}/whatsappTemplateSends`)
        .where('relatedLeadId', '==', leadId)
        .where('sentAt', '>=', sevenDaysAgo)
        .orderBy('sentAt', 'desc')
        .limit(1)
        .get()
        .catch(() => null);
      const broadcastId = lastSend?.docs[0]?.data()?.['relatedBroadcastId'] as string | undefined;
      if (broadcastId) {
        const incrementBody: Record<string, unknown> = {
          wonCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (typeof revenue === 'number' && !isNaN(revenue) && revenue > 0) {
          incrementBody['revenueTotal'] = FieldValue.increment(revenue);
        }
        await getFirestore().collection(`companies/${companyId}/whatsappBroadcasts`).doc(broadcastId)
          .update(incrementBody)
          .catch(() => null);
      }
    } catch { /* best-effort */ }
  }
  if (notes !== undefined) update['notes'] = notes;
  if (urgency !== undefined) update['urgency'] = urgency;
  if (revenue !== undefined && typeof revenue === 'number' && !isNaN(revenue)) {
    update['revenue'] = revenue;
  }
  if (assigneeId !== undefined) {
    if (assigneeId === null) {
      update['assigneeId'] = null;
      update['assigneeName'] = null;
    } else {
      update['assigneeId'] = assigneeId;
      // Resolve a display name from the users collection if possible.
      try {
        const userDoc = await getFirestore().collection('users').doc(assigneeId).get();
        update['assigneeName'] = userDoc.exists ? (userDoc.data()?.['displayName'] ?? userDoc.data()?.['email'] ?? null) : null;
      } catch { /* best-effort */ }
    }
  }
  await ref.update(update);
  res.json({ success: true });
}));

// POST /api/whatsapp/leads/:leadId/send-template — relance the customer via
// an approved Meta template. Pre-fills variables from the lead (name, need).
// Sets firstContactedAt automatically and writes audit. Refuses if the customer
// has opted out (replied STOP/STOP).
router.post('/leads/:leadId/send-template', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { leadId } = req.params;
  const { templateName, languageCode, bodyParams, headerParam } = req.body as {
    templateName: string;
    languageCode: string;
    bodyParams?: string[];
    headerParam?: string;
  };
  if (!templateName || !languageCode) throw new AppError('templateName + languageCode required', 400);

  const db = getFirestore();
  const leadRef = db.collection(`companies/${companyId}/whatsappLeads`).doc(leadId);
  const leadDoc = await leadRef.get();
  if (!leadDoc.exists) throw new AppError('Lead not found', 404);
  const lead = leadDoc.data()!;
  if (lead['optedOut']) throw new AppError("Le client s'est désinscrit (STOP) — l'envoi est bloqué pour respecter le consentement.", 403);

  const config = await whatsappService.getConfig(companyId);
  if (!config) throw new AppError('WhatsApp non connecté', 400);

  // Build components from simple bodyParams + optional header
  const components: Array<Record<string, unknown>> = [];
  if (headerParam) components.push({ type: 'header', parameters: [{ type: 'text', text: headerParam }] });
  if (bodyParams && bodyParams.length > 0) {
    components.push({ type: 'body', parameters: bodyParams.map(p => ({ type: 'text', text: p })) });
  }

  const out = await whatsappService.sendTemplateRich(
    config,
    lead['customerPhone'] as string,
    templateName,
    languageCode,
    components,
  );

  if (!out.messageId) {
    throw new AppError(out.error ?? 'Échec envoi template', 502);
  }

  // Audit + mark lead as contacted
  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    lastTemplateSentAt: FieldValue.serverTimestamp(),
    lastTemplateName: templateName,
  };
  if (!lead['firstContactedAt']) {
    updates['firstContactedAt'] = FieldValue.serverTimestamp();
    updates['firstContactedBy'] = userId;
    if (lead['status'] === 'new') updates['status'] = 'contacted';
  }
  await leadRef.update(updates);

  await db.collection(`companies/${companyId}/whatsappTemplateSends`).add({
    to: lead['customerPhone'],
    relatedLeadId: leadId,
    templateName,
    languageCode,
    bodyParams: bodyParams ?? [],
    headerParam: headerParam ?? null,
    messageId: out.messageId,
    sentBy: userId,
    sentAt: FieldValue.serverTimestamp(),
  });

  res.json({ success: true, data: { messageId: out.messageId } });
}));

// GET /api/whatsapp/templates/stats — sends-per-template count for the last 30 days
router.get('/templates/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const snap = await getFirestore()
      .collection(`companies/${companyId}/whatsappTemplateSends`)
      .where('sentAt', '>=', since)
      .limit(500)
      .get();

    const byTemplate: Record<string, { sent: number; lastSentAt: number | null }> = {};
    let totalSent = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const name = (data['templateName'] as string) ?? 'unknown';
      const ts = data['sentAt']?.toDate?.()?.getTime() ?? null;
      if (!byTemplate[name]) byTemplate[name] = { sent: 0, lastSentAt: null };
      byTemplate[name].sent++;
      if (ts && (!byTemplate[name].lastSentAt || ts > byTemplate[name].lastSentAt!)) {
        byTemplate[name].lastSentAt = ts;
      }
      totalSent++;
    }

    res.json({ success: true, data: { totalSent, byTemplate } });
  } catch {
    res.json({ success: true, data: { totalSent: 0, byTemplate: {} } });
  }
}));

// POST /api/whatsapp/leads/:leadId/assign-me — quick self-assign endpoint
router.post('/leads/:leadId/assign-me', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  const { leadId } = req.params;

  const ref = getFirestore().collection(`companies/${companyId}/whatsappLeads`).doc(leadId);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Lead not found', 404);

  let assigneeName: string | null = null;
  try {
    const userDoc = await getFirestore().collection('users').doc(userId).get();
    assigneeName = userDoc.exists ? (userDoc.data()?.['displayName'] ?? userDoc.data()?.['email'] ?? null) : null;
  } catch { /* best-effort */ }

  await ref.update({
    assigneeId: userId,
    assigneeName,
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.json({ success: true, data: { assigneeId: userId, assigneeName } });
}));

// POST /api/whatsapp/handoff/resume — humain rend la main à l'IA pour ce client
router.post('/handoff/resume', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { customerPhone } = req.body as { customerPhone?: string };
  if (!customerPhone) throw new AppError('customerPhone required', 400);
  const handoffSvc = await import('../services/whatsapp/humanHandoffService');
  await handoffSvc.setConversationStatus(companyId, customerPhone, 'handoff_resolved', {
    resumedBy: req.user?.uid ?? null,
    resumedAt: new Date(),
  });
  res.json({ success: true });
}));

// GET /api/whatsapp/handoff/conversations — list current handoff-active conversations
router.get('/handoff/conversations', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore()
    .collection(`companies/${companyId}/whatsappConversations`)
    .where('status', 'in', ['handoff_active', 'handoff_timeout'])
    .limit(50)
    .get();
  const conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, data: conversations });
}));

// GET /api/whatsapp/handoff/stats — last 7 days escalation count + avg response time.
// avgResponseTimeMs = average of (firstContactedAt - createdAt) across leads
// where firstContactedAt is set. Powers the "Temps moyen de réponse" KPI.
router.get('/handoff/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    const [escalationsSnap, leadsSnap] = await Promise.all([
      getFirestore().collection(`companies/${companyId}/whatsappEscalations`).where('createdAt', '>=', sevenDaysAgo).limit(200).get(),
      getFirestore().collection(`companies/${companyId}/whatsappLeads`).where('createdAt', '>=', sevenDaysAgo).limit(200).get(),
    ]);

    const escalations = escalationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const explicit = escalations.filter((e: any) => e.reason === 'explicit').length;
    const frustration = escalations.filter((e: any) => e.reason === 'frustration').length;

    // Compute avg response time over leads that have been contacted.
    let totalMs = 0;
    let contactedCount = 0;
    for (const d of leadsSnap.docs) {
      const data = d.data();
      const created = data['createdAt']?.toDate?.();
      const contacted = data['firstContactedAt']?.toDate?.();
      if (created && contacted) {
        totalMs += contacted.getTime() - created.getTime();
        contactedCount++;
      }
    }
    const avgResponseTimeMs = contactedCount > 0 ? Math.round(totalMs / contactedCount) : null;

    res.json({
      success: true,
      data: {
        total7d: escalations.length,
        explicit,
        frustration,
        avgResponseTimeMs,
        contactedCount,
        recent: escalations.slice(0, 10),
      },
    });
  } catch {
    res.json({ success: true, data: { total7d: 0, explicit: 0, frustration: 0, avgResponseTimeMs: null, recent: [] } });
  }
}));

// GET /api/whatsapp/messages — historique messages
router.get('/messages', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  try {
    const snap = await getFirestore()
      .collection(`companies/${companyId}/whatsappMessages`)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: messages });
  } catch {
    res.json({ success: true, data: [] });
  }
}));

// GET /api/whatsapp/stats — analytics dashboard data
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  try {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/whatsappMessages`)
      .limit(500).get();

    const messages = snap.docs.map(d => d.data());
    const total = messages.length;
    const inbound = messages.filter(m => m['direction'] === 'inbound').length;
    const outbound = total - inbound;
    const voiceMessages = messages.filter(m => m['originalType'] === 'audio').length;
    const processed = messages.filter(m => m['processed'] === true).length;

    // Unique contacts
    const contacts = new Set(messages.filter(m => m['from']).map(m => m['from'] as string)).size;

    // Messages by day (last 7 days)
    const now = Date.now();
    const dailyData: Array<{ date: string; inbound: number; outbound: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayStart = new Date(dateStr).getTime();
      const dayEnd = dayStart + 86400000;
      const dayMsgs = messages.filter(m => {
        const ts = m['createdAt']?.['seconds'] ? m['createdAt']['seconds'] * 1000 :
                   m['timestamp'] ? new Date(m['timestamp'] as string).getTime() : 0;
        return ts >= dayStart && ts < dayEnd;
      });
      dailyData.push({
        date: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        inbound: dayMsgs.filter(m => m['direction'] === 'inbound').length,
        outbound: dayMsgs.filter(m => m['direction'] !== 'inbound').length,
      });
    }

    res.json({
      success: true,
      data: { total, inbound, outbound, voiceMessages, processed, contacts, dailyData },
    });
  } catch {
    res.json({ success: true, data: { total: 0, inbound: 0, outbound: 0, voiceMessages: 0, processed: 0, contacts: 0, dailyData: [] } });
  }
}));

export default router;
