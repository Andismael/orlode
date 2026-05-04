/**
 * Team Agent Responder — Niveau 2
 *
 * When a human posts a message in a channel mentioning the AI (@orlode, @bot,
 * @ai, @assistant), this service:
 *   1. Skips agent-authored messages (anti-loop)
 *   2. Rate-limits per-channel to avoid runaway loops
 *   3. Fetches the last N channel messages as conversation context
 *   4. Runs the orchestrator with the cleaned mention as the user prompt
 *   5. Posts the reply back into the same channel with the agent identity
 *      (createdByType: 'agent', authorName: "Orlode AI · Orlode")
 *
 * Called fire-and-forget from POST /team/.../messages handlers — never awaited
 * by the user-facing request, so the human's message returns instantly.
 */
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

// Default aliases that work for any company. Company-specific aliases
// (company name, custom assistant name) are resolved per-message and merged in.
const DEFAULT_ALIASES = ['orlode', 'bot', 'ai', 'assistant'];
// 20 messages back — enough to resolve "le client", "le rendez-vous", etc.
// from earlier in the conversation without bloating the prompt.
const HISTORY_DEPTH = 20;
const RATE_LIMIT_WINDOW_MS = 8_000;
const AGENT_AUTHOR_PREFIX = 'agent:';
const REPLY_AGENT_NAME = 'Orlode';

// Per-company alias cache so we don't re-fetch the company doc on every message.
// 60-second TTL is plenty — assistant rename is rare.
const ALIAS_CACHE_TTL_MS = 60_000;
const aliasCache = new Map<string, { aliases: string[]; expiresAt: number }>();

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '');
}

async function getCompanyAliases(companyId: string): Promise<string[]> {
  const cached = aliasCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) return cached.aliases;
  try {
    const db = getFirestore();
    const doc = await db.collection('companies').doc(companyId).get();
    const data = doc.data() ?? {};
    const aliases = new Set<string>(DEFAULT_ALIASES);
    const companyName = (data['name'] as string) ?? '';
    if (companyName) aliases.add(slugify(companyName));
    const assistantName = (data['settings'] as Record<string, unknown>)?.['assistantName'] as string | undefined;
    if (assistantName) aliases.add(slugify(assistantName));
    const list = Array.from(aliases).filter(a => a.length >= 2);
    aliasCache.set(companyId, { aliases: list, expiresAt: Date.now() + ALIAS_CACHE_TTL_MS });
    return list;
  } catch {
    return DEFAULT_ALIASES;
  }
}

function buildMentionPattern(aliases: string[]): RegExp {
  const escaped = aliases.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`@(${escaped.join('|')})\\b`, 'i');
}

// Helpful nudge for "@orlode" alone — saves a round-trip to the orchestrator
// and gives the user concrete next-steps instead of silence.
async function postBareMentionHelp(
  companyId: string,
  channelId: string,
  authorName: string,
  triggerMessageId: string,
  triggerAuthorId: string,
): Promise<void> {
  try {
    const db = getFirestore();
    const reply =
      `Salut ${authorName.split(' ')[0]} ! Tu peux me demander :\n` +
      `• **Résume** les derniers messages de ce canal\n` +
      `• **Réponds au client** (WhatsApp / email)\n` +
      `• **Crée une tâche** pour quelqu'un\n` +
      `• **Analyse** les ventes du mois\n` +
      `Vas-y, dis-moi ce dont tu as besoin.`;
    const authorAgentId = `${AGENT_AUTHOR_PREFIX}${REPLY_AGENT_NAME.toLowerCase()}`;
    const authorAgentName = `Orlode AI · ${REPLY_AGENT_NAME}`;
    const replyRef = db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc();
    await replyRef.set({
      content: reply,
      authorId: authorAgentId,
      authorName: authorAgentName,
      authorPhoto: null,
      agentName: REPLY_AGENT_NAME,
      attachments: [],
      createdBy: authorAgentId,
      createdByName: authorAgentName,
      createdByType: 'agent',
      replyToMessageId: triggerMessageId,
      replyToAuthor: authorName,
      triggerReason: 'Bare @mention — help nudge',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection(`companies/${companyId}/channels`).doc(channelId).update({
      lastMessage: reply.slice(0, 100),
      lastMessageBy: authorAgentName,
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`[TeamResponder] bare-mention help posted in ${channelId} for ${authorName} (${triggerAuthorId})`);
  } catch (err) {
    logger.error('[TeamResponder] postBareMentionHelp failed', { error: err instanceof Error ? err.message : err, companyId, channelId });
  }
}

// Per-process rate-limit cache. Cloud Run instances are short-lived, so this
// is best-effort — combined with the Firestore lookup below for stronger
// dedup across instances.
const lastReplyAtByChannel = new Map<string, number>();

/**
 * Detects whether a posted message is targeting the AI, using company-specific
 * aliases (orlode, bot, ai, assistant + company name + custom assistant name).
 * Returns the cleaned prompt (mentions stripped) or null if not addressed.
 */
export async function detectAIMention(content: string, companyId: string): Promise<string | null> {
  if (!content) return null;
  const aliases = await getCompanyAliases(companyId);
  const pattern = buildMentionPattern(aliases);
  if (!pattern.test(content)) return null;
  return content.replace(pattern, '').trim();
}

interface ResponderArgs {
  companyId: string;
  channelId: string;
  messageId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdByType?: string;
}

/**
 * Fire-and-forget. Caller MUST NOT await — instead use:
 *   processChannelMessageForAgent(args).catch(err => logger.warn(...))
 */
export async function processChannelMessageForAgent(args: ResponderArgs): Promise<void> {
  const { companyId, channelId, messageId, content, authorId, authorName, createdByType } = args;

  // 1. Anti-loop — never respond to agent-authored messages.
  if (createdByType === 'agent' || authorId.startsWith(AGENT_AUTHOR_PREFIX)) return;

  // 2. Detect AI mention.
  const cleanedPrompt = await detectAIMention(content, companyId);
  if (cleanedPrompt === null) return; // no mention at all → silent

  // 2b. Bare @mention with no body → post a helpful nudge instead of silence.
  // The user clearly wants to talk to the agent but didn't ask anything yet.
  if (cleanedPrompt === '') {
    await postBareMentionHelp(companyId, channelId, authorName, messageId, authorId);
    return;
  }

  // 3. Rate-limit (in-memory).
  const cacheKey = `${companyId}:${channelId}`;
  const lastAt = lastReplyAtByChannel.get(cacheKey) ?? 0;
  if (Date.now() - lastAt < RATE_LIMIT_WINDOW_MS) {
    logger.info(`[TeamResponder] rate-limited ${cacheKey}`);
    return;
  }
  lastReplyAtByChannel.set(cacheKey, Date.now());

  try {
    const db = getFirestore();

    // 4. Cross-instance dedup — refuse to reply if there's already an agent
    // reply newer than the human message, in case multiple instances picked
    // up the same trigger.
    const targetMsgRef = db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc(messageId);
    const targetMsg = await targetMsgRef.get();
    const targetCreatedAt = targetMsg.data()?.['createdAt'];
    if (targetCreatedAt) {
      const newer = await db.collection(`companies/${companyId}/channels/${channelId}/messages`)
        .where('createdByType', '==', 'agent')
        .where('replyToMessageId', '==', messageId)
        .limit(1).get();
      if (!newer.empty) {
        logger.info(`[TeamResponder] dedup — agent already replied to ${messageId}`);
        return;
      }
    }

    // 5. Fetch last N messages as conversation context.
    const snap = await db.collection(`companies/${companyId}/channels/${channelId}/messages`)
      .orderBy('createdAt', 'desc').limit(HISTORY_DEPTH).get();
    const history = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .reverse()
      // Drop the triggering message itself — we'll pass cleanedPrompt directly.
      .filter(m => (m as { id: string }).id !== messageId)
      .map(m => {
        const r = m as { content?: string; authorName?: string; createdByType?: string };
        return {
          role: r.createdByType === 'agent' ? ('model' as const) : ('user' as const),
          content: `${r.authorName ?? 'Membre'}: ${r.content ?? ''}`,
        };
      });

    // 6. Run the orchestrator. Use channel='team_channel' so the system prompt
    // adapts tone/format to the in-channel context (no generic greetings, no
    // /links, channel-name-aware tone). Use fastReply for snappier responses.
    // Inject the channel name + author into the message so the agent can pick
    // the right tone (#ventes vs #incidents vs #general).
    const channelDoc = await db.collection(`companies/${companyId}/channels`).doc(channelId).get();
    const channelName = (channelDoc.data()?.['name'] as string) ?? channelId;
    const contextualMessage = `[Canal #${channelName} · message de ${authorName}] ${cleanedPrompt}`;

    const { runOrchestrator } = await import('../agents/orchestrator.agent');
    const result = await runOrchestrator({
      message: contextualMessage,
      companyId,
      userId: authorId,
      history,
      channel: 'team_channel',
      fastReply: true,
    });

    const reply = (result?.reply ?? '').trim();
    if (!reply) {
      logger.warn('[TeamResponder] orchestrator returned empty reply');
      return;
    }

    // 7. Post the agent reply in the same channel. Mark replyToMessageId so the
    // dedup check above can detect prior replies. Author identity is the agent.
    const authorAgentId = `${AGENT_AUTHOR_PREFIX}${REPLY_AGENT_NAME.toLowerCase()}`;
    const authorAgentName = `Orlode AI · ${REPLY_AGENT_NAME}`;
    const replyRef = db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc();
    await replyRef.set({
      content: reply,
      authorId: authorAgentId,
      authorName: authorAgentName,
      authorPhoto: null,
      agentName: REPLY_AGENT_NAME,
      attachments: [],
      createdBy: authorAgentId,
      createdByName: authorAgentName,
      createdByType: 'agent',
      replyToMessageId: messageId,
      replyToAuthor: authorName,
      triggerReason: `Réponse à mention AI dans #${channelId}`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection(`companies/${companyId}/channels`).doc(channelId).update({
      lastMessage: reply.slice(0, 100),
      lastMessageBy: authorAgentName,
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 8. Audit
    await db.collection(`companies/${companyId}/activities`).add({
      action: 'agent_message_response',
      userId: authorAgentId,
      userName: authorAgentName,
      entityType: 'agent_message',
      details: {
        channelId,
        triggerMessageId: messageId,
        triggerAuthorId: authorId,
        triggerAuthorName: authorName,
        triggerContentPreview: content.slice(0, 200),
        replyMessageId: replyRef.id,
        replyContentPreview: reply.slice(0, 200),
        agentsUsed: result?.agentsUsed ?? [],
        toolsCalled: result?.toolsCalled ?? [],
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(`[TeamResponder] replied in ${cacheKey} to ${authorName} (msg ${messageId} → ${replyRef.id})`);
  } catch (err) {
    logger.error('[TeamResponder] failed', { error: err instanceof Error ? err.message : err, companyId, channelId, messageId });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DM responder — same logic as channel, but reads/writes the DM collection.
// ─────────────────────────────────────────────────────────────────────────────

interface DMResponderArgs {
  companyId: string;
  dmId: string;
  messageId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdByType?: string;
}

const lastReplyAtByDM = new Map<string, number>();

export async function processDMMessageForAgent(args: DMResponderArgs): Promise<void> {
  const { companyId, dmId, messageId, content, authorId, authorName, createdByType } = args;
  if (createdByType === 'agent' || authorId.startsWith(AGENT_AUTHOR_PREFIX)) return;

  const cleanedPrompt = await detectAIMention(content, companyId);
  if (!cleanedPrompt) return;

  const cacheKey = `${companyId}:dm:${dmId}`;
  const lastAt = lastReplyAtByDM.get(cacheKey) ?? 0;
  if (Date.now() - lastAt < RATE_LIMIT_WINDOW_MS) {
    logger.info(`[TeamResponder/DM] rate-limited ${cacheKey}`);
    return;
  }
  lastReplyAtByDM.set(cacheKey, Date.now());

  try {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/dms/${dmId}/messages`)
      .orderBy('createdAt', 'desc').limit(HISTORY_DEPTH).get();
    const history = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .reverse()
      .filter(m => (m as { id: string }).id !== messageId)
      .map(m => {
        const r = m as { content?: string; authorName?: string; createdByType?: string };
        return {
          role: r.createdByType === 'agent' ? ('model' as const) : ('user' as const),
          content: `${r.authorName ?? 'Membre'}: ${r.content ?? ''}`,
        };
      });

    const contextualMessage = `[Message direct · de ${authorName}] ${cleanedPrompt}`;
    const { runOrchestrator } = await import('../agents/orchestrator.agent');
    const result = await runOrchestrator({
      message: contextualMessage,
      companyId,
      userId: authorId,
      history,
      channel: 'team_channel',
      fastReply: true,
    });

    const reply = (result?.reply ?? '').trim();
    if (!reply) return;

    const authorAgentId = `${AGENT_AUTHOR_PREFIX}${REPLY_AGENT_NAME.toLowerCase()}`;
    const authorAgentName = `Orlode AI · ${REPLY_AGENT_NAME}`;
    const replyRef = db.collection(`companies/${companyId}/dms/${dmId}/messages`).doc();
    await replyRef.set({
      content: reply,
      authorId: authorAgentId,
      authorName: authorAgentName,
      authorPhoto: null,
      agentName: REPLY_AGENT_NAME,
      createdBy: authorAgentId,
      createdByName: authorAgentName,
      createdByType: 'agent',
      replyToMessageId: messageId,
      replyToAuthor: authorName,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection(`companies/${companyId}/dms`).doc(dmId).update({
      lastMessage: reply.slice(0, 100),
      lastMessageBy: authorAgentName,
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`[TeamResponder/DM] replied in ${cacheKey} to ${authorName} (msg ${messageId} → ${replyRef.id})`);
  } catch (err) {
    logger.error('[TeamResponder/DM] failed', { error: err instanceof Error ? err.message : err, companyId, dmId, messageId });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Thread reply responder — replies inside the thread of a parent message.
// ─────────────────────────────────────────────────────────────────────────────

interface ThreadResponderArgs {
  companyId: string;
  channelId: string;
  parentMessageId: string;
  replyId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdByType?: string;
}

const lastReplyAtByThread = new Map<string, number>();

export async function processThreadReplyForAgent(args: ThreadResponderArgs): Promise<void> {
  const { companyId, channelId, parentMessageId, replyId, content, authorId, authorName, createdByType } = args;
  if (createdByType === 'agent' || authorId.startsWith(AGENT_AUTHOR_PREFIX)) return;

  const cleanedPrompt = await detectAIMention(content, companyId);
  if (!cleanedPrompt) return;

  const cacheKey = `${companyId}:thread:${parentMessageId}`;
  const lastAt = lastReplyAtByThread.get(cacheKey) ?? 0;
  if (Date.now() - lastAt < RATE_LIMIT_WINDOW_MS) return;
  lastReplyAtByThread.set(cacheKey, Date.now());

  try {
    const db = getFirestore();

    // Build context: parent message + all thread replies (so the agent sees the full thread).
    const parentDoc = await db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc(parentMessageId).get();
    const parent = parentDoc.data() ?? {};
    const repliesSnap = await db.collection(`companies/${companyId}/channels/${channelId}/messages/${parentMessageId}/replies`)
      .orderBy('createdAt', 'asc').limit(HISTORY_DEPTH).get();

    const history = [
      {
        role: 'user' as const,
        content: `${(parent['authorName'] as string) ?? 'Membre'}: ${(parent['content'] as string) ?? ''}`,
      },
      ...repliesSnap.docs
        .filter(d => d.id !== replyId)
        .map(d => {
          const r = d.data();
          return {
            role: r['createdByType'] === 'agent' ? ('model' as const) : ('user' as const),
            content: `${r['authorName'] ?? 'Membre'}: ${r['content'] ?? ''}`,
          };
        }),
    ];

    const channelDoc = await db.collection(`companies/${companyId}/channels`).doc(channelId).get();
    const channelName = (channelDoc.data()?.['name'] as string) ?? channelId;
    const contextualMessage = `[Thread dans #${channelName} · ${authorName}] ${cleanedPrompt}`;

    const { runOrchestrator } = await import('../agents/orchestrator.agent');
    const result = await runOrchestrator({
      message: contextualMessage,
      companyId,
      userId: authorId,
      history,
      channel: 'team_channel',
      fastReply: true,
    });

    const reply = (result?.reply ?? '').trim();
    if (!reply) return;

    const authorAgentId = `${AGENT_AUTHOR_PREFIX}${REPLY_AGENT_NAME.toLowerCase()}`;
    const authorAgentName = `Orlode AI · ${REPLY_AGENT_NAME}`;
    const replyRef = db.collection(`companies/${companyId}/channels/${channelId}/messages/${parentMessageId}/replies`).doc();
    await replyRef.set({
      content: reply,
      authorId: authorAgentId,
      authorName: authorAgentName,
      authorPhoto: null,
      agentName: REPLY_AGENT_NAME,
      createdBy: authorAgentId,
      createdByName: authorAgentName,
      createdByType: 'agent',
      replyToMessageId: replyId,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc(parentMessageId).update({
      threadCount: FieldValue.increment(1),
      lastThreadAt: FieldValue.serverTimestamp(),
    });

    logger.info(`[TeamResponder/Thread] replied in ${cacheKey} to ${authorName} (reply ${replyId} → ${replyRef.id})`);
  } catch (err) {
    logger.error('[TeamResponder/Thread] failed', { error: err instanceof Error ? err.message : err, companyId, channelId, parentMessageId });
  }
}
