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
exports.detectAIMention = detectAIMention;
exports.processChannelMessageForAgent = processChannelMessageForAgent;
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
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = require("../utils/logger");
const AI_MENTION_PATTERN = /@(orlode|bot|ai|assistant)\b/i;
const HISTORY_DEPTH = 10;
const RATE_LIMIT_WINDOW_MS = 8000; // skip if last agent reply in this channel was less than 8s ago
const AGENT_AUTHOR_PREFIX = 'agent:';
const REPLY_AGENT_NAME = 'Orlode';
// Per-process rate-limit cache. Cloud Run instances are short-lived, so this
// is best-effort — combined with the Firestore lookup below for stronger
// dedup across instances.
const lastReplyAtByChannel = new Map();
/**
 * Detects whether a posted message is targeting the AI.
 * Returns the cleaned prompt (mentions stripped) or null if not addressed.
 */
function detectAIMention(content) {
    if (!content)
        return null;
    if (!AI_MENTION_PATTERN.test(content))
        return null;
    return content.replace(AI_MENTION_PATTERN, '').trim();
}
/**
 * Fire-and-forget. Caller MUST NOT await — instead use:
 *   processChannelMessageForAgent(args).catch(err => logger.warn(...))
 */
async function processChannelMessageForAgent(args) {
    const { companyId, channelId, messageId, content, authorId, authorName, createdByType } = args;
    // 1. Anti-loop — never respond to agent-authored messages.
    if (createdByType === 'agent' || authorId.startsWith(AGENT_AUTHOR_PREFIX))
        return;
    // 2. Detect AI mention.
    const cleanedPrompt = detectAIMention(content);
    if (!cleanedPrompt)
        return;
    // 3. Rate-limit (in-memory).
    const cacheKey = `${companyId}:${channelId}`;
    const lastAt = lastReplyAtByChannel.get(cacheKey) ?? 0;
    if (Date.now() - lastAt < RATE_LIMIT_WINDOW_MS) {
        logger_1.logger.info(`[TeamResponder] rate-limited ${cacheKey}`);
        return;
    }
    lastReplyAtByChannel.set(cacheKey, Date.now());
    try {
        const db = (0, firebase_config_1.getFirestore)();
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
                logger_1.logger.info(`[TeamResponder] dedup — agent already replied to ${messageId}`);
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
            .filter(m => m.id !== messageId)
            .map(m => {
            const r = m;
            return {
                role: r.createdByType === 'agent' ? 'model' : 'user',
                content: `${r.authorName ?? 'Membre'}: ${r.content ?? ''}`,
            };
        });
        // 6. Run the orchestrator. Use channel='team_channel' so the system prompt
        // adapts tone/format to the in-channel context (no generic greetings, no
        // /links, channel-name-aware tone). Use fastReply for snappier responses.
        // Inject the channel name + author into the message so the agent can pick
        // the right tone (#ventes vs #incidents vs #general).
        const channelDoc = await db.collection(`companies/${companyId}/channels`).doc(channelId).get();
        const channelName = channelDoc.data()?.['name'] ?? channelId;
        const contextualMessage = `[Canal #${channelName} · message de ${authorName}] ${cleanedPrompt}`;
        const { runOrchestrator } = await Promise.resolve().then(() => __importStar(require('../agents/orchestrator.agent')));
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
            logger_1.logger.warn('[TeamResponder] orchestrator returned empty reply');
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await db.collection(`companies/${companyId}/channels`).doc(channelId).update({
            lastMessage: reply.slice(0, 100),
            lastMessageBy: authorAgentName,
            lastMessageAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        logger_1.logger.info(`[TeamResponder] replied in ${cacheKey} to ${authorName} (msg ${messageId} → ${replyRef.id})`);
    }
    catch (err) {
        logger_1.logger.error('[TeamResponder] failed', { error: err instanceof Error ? err.message : err, companyId, channelId, messageId });
    }
}
//# sourceMappingURL=teamAgentResponder.js.map