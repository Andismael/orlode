"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mentionTeamMemberTool = exports.readTeamChannelMessagesTool = exports.sendTeamDirectMessageTool = exports.sendTeamChannelMessageTool = exports.listTeamMembersTool = exports.listTeamChannelsTool = void 0;
/**
 * Team Agent Tools — let agents post in the in-house Equipe (Slack-clone).
 *
 * Niveau 1 only: agents POST messages (channel + DM + mention). They do NOT
 * yet read/respond to messages addressed to them — that's Niveau 2.
 *
 * All agent-sent messages carry:
 *   authorId:        'agent:<agentName>'   (synthetic — never collides with a real userId)
 *   authorName:      'Orlode AI · <agentName>'
 *   createdByType:   'agent'
 *   agentName:       <agentName>           (short identifier for filtering / audit)
 *   triggerReason:   <user-prompt summary>  (optional, for audit context)
 *
 * Audit: every send writes a row in `companies/{cid}/activities` with action
 * `agent_message_sent` so admins can trace which agent posted what, where, why.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = require("../../utils/logger");
// ── Helpers ─────────────────────────────────────────────────────────────────
const AGENT_DEFAULT = 'Orlode';
const AUTHOR_PREFIX = 'agent:';
function makeAuthor(agentName) {
    const clean = (agentName || AGENT_DEFAULT).trim();
    return {
        authorId: `${AUTHOR_PREFIX}${clean.toLowerCase().replace(/\s+/g, '-')}`,
        authorName: `Orlode AI · ${clean}`,
        authorPhoto: null,
        agentName: clean,
    };
}
async function logAgentActivity(companyId, action, agentName, details) {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(`companies/${companyId}/activities`).add({
            action,
            userId: `${AUTHOR_PREFIX}${agentName.toLowerCase().replace(/\s+/g, '-')}`,
            userName: `Orlode AI · ${agentName}`,
            entityType: 'agent_message',
            details,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.warn('[TeamAgentTools] activity log failed', { error: err });
    }
}
// Resolve a channel by NAME (preferred) or ID. Auto-creates the channel if it
// doesn't exist (mirrors the GET /channels handler which auto-creates "general"
// on first load) so agents can post to channels users haven't visited yet.
async function resolveChannel(companyId, channelNameOrId, agentName) {
    const db = (0, firebase_config_1.getFirestore)();
    const target = channelNameOrId.replace(/^#/, '').trim().toLowerCase();
    if (!target)
        return null;
    // Try as direct ID first
    const direct = await db.collection(`companies/${companyId}/channels`).doc(target).get();
    if (direct.exists)
        return direct.id;
    // Then by name field
    const snap = await db.collection(`companies/${companyId}/channels`).limit(100).get();
    for (const d of snap.docs) {
        const name = (d.data()['name'] ?? '').trim().toLowerCase();
        if (name === target)
            return d.id;
    }
    // Not found — create it. The id is the kebab-cased target so future lookups
    // match by direct id. Type "general" so it shows up in the default list.
    const newId = target.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!newId)
        return null;
    const author = makeAuthor(agentName);
    await db.collection(`companies/${companyId}/channels`).doc(newId).set({
        name: target,
        description: `Canal créé automatiquement par ${author.authorName}`,
        type: 'general',
        createdBy: author.authorId,
        createdByName: author.authorName,
        createdByType: 'agent',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info(`[TeamAgentTools] auto-created channel "${target}" for company ${companyId}`);
    return newId;
}
// Resolve a member by displayName, email, or uid. Returns the userId or null.
async function resolveMember(companyId, query) {
    const db = (0, firebase_config_1.getFirestore)();
    const q = query.trim().toLowerCase();
    if (!q)
        return null;
    const snap = await db.collection(`companies/${companyId}/members`).limit(200).get();
    let exact = null;
    let partial = null;
    for (const d of snap.docs) {
        const data = d.data();
        const name = (data['displayName'] ?? '').toLowerCase();
        const email = (data['email'] ?? '').toLowerCase();
        const candidate = { userId: d.id, displayName: data['displayName'] ?? d.id };
        if (d.id === q || email === q || name === q) {
            exact = candidate;
            break;
        }
        if (!partial && (name.includes(q) || email.includes(q)))
            partial = candidate;
    }
    return exact ?? partial;
}
// ── 1. listTeamChannels ─────────────────────────────────────────────────────
exports.listTeamChannelsTool = genkit_config_1.ai.defineTool({
    name: 'listTeamChannels',
    description: 'List the channels in the company\'s internal Team (Slack-clone). Use this to discover channel names before posting.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        channels: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            description: zod_1.z.string().optional(),
            type: zod_1.z.string().optional(),
        })),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/channels`).limit(50).get();
    return {
        channels: snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data['name'] ?? d.id,
                description: data['description'] ?? undefined,
                type: data['type'] ?? undefined,
            };
        }),
    };
});
// ── 2. listTeamMembers ──────────────────────────────────────────────────────
exports.listTeamMembersTool = genkit_config_1.ai.defineTool({
    name: 'listTeamMembers',
    description: 'List members of the company\'s internal Team. Returns userId, displayName, email, role. Use this to find who to DM or mention.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        members: zod_1.z.array(zod_1.z.object({
            userId: zod_1.z.string(),
            displayName: zod_1.z.string(),
            email: zod_1.z.string().optional(),
            role: zod_1.z.string().optional(),
        })),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/members`).limit(200).get();
    return {
        members: snap.docs
            .filter(d => {
            const status = d.data()['status'];
            return !status || status === 'active' || status === 'invited';
        })
            .map(d => {
            const data = d.data();
            return {
                userId: d.id,
                displayName: data['displayName'] ?? d.id,
                email: data['email'] ?? undefined,
                role: data['role'] ?? undefined,
            };
        }),
    };
});
// ── 3. sendTeamChannelMessage ───────────────────────────────────────────────
exports.sendTeamChannelMessageTool = genkit_config_1.ai.defineTool({
    name: 'sendTeamChannelMessage',
    description: 'Post a message in a Team channel (the in-house Slack-like). AUTO-CREATES the channel if it does not exist — pass the channel name the user gave you and trust the tool, do not pre-check or fall back to #general. Use the channel NAME (e.g. "ventes", "general") — IDs also work.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        channel: zod_1.z.string().describe('Channel name (e.g. "ventes") or channel id. Leading # is optional.'),
        message: zod_1.z.string().describe('Message body. Markdown supported.'),
        agentName: zod_1.z.string().optional().default('Orlode').describe('Display name of the agent posting (e.g. "Sales Agent"). Defaults to "Orlode".'),
        triggerReason: zod_1.z.string().optional().describe('Why this message is being sent (audit trail). Optional but recommended.'),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string(), messageId: zod_1.z.string().optional(), channelId: zod_1.z.string().optional() }),
}, async (input) => {
    try {
        const channelId = await resolveChannel(input.companyId, input.channel, input.agentName ?? 'Orlode');
        if (!channelId) {
            return { success: false, message: `Canal "${input.channel}" introuvable. Utilise listTeamChannels pour voir les canaux disponibles.` };
        }
        const author = makeAuthor(input.agentName ?? 'Orlode');
        const db = (0, firebase_config_1.getFirestore)();
        const msgRef = db.collection(`companies/${input.companyId}/channels/${channelId}/messages`).doc();
        const content = input.message.trim();
        await msgRef.set({
            content,
            ...author,
            attachments: [],
            createdBy: author.authorId,
            createdByName: author.authorName,
            createdByType: 'agent',
            triggerReason: input.triggerReason ?? null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await db.collection(`companies/${input.companyId}/channels`).doc(channelId).update({
            lastMessage: content.slice(0, 100),
            lastMessageBy: author.authorName,
            lastMessageAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await logAgentActivity(input.companyId, 'agent_message_sent', author.agentName, {
            channelId,
            channelInput: input.channel,
            messageId: msgRef.id,
            contentPreview: content.slice(0, 200),
            triggerReason: input.triggerReason ?? null,
        });
        return { success: true, message: `Message posté dans #${input.channel} par ${author.authorName}`, messageId: msgRef.id, channelId };
    }
    catch (err) {
        logger_1.logger.error('[TeamAgentTools] sendChannel failed', { error: err });
        return { success: false, message: `Échec: ${err.message}` };
    }
});
// ── 4. sendTeamDirectMessage ────────────────────────────────────────────────
exports.sendTeamDirectMessageTool = genkit_config_1.ai.defineTool({
    name: 'sendTeamDirectMessage',
    description: 'Send a direct message (DM) to a single Team member. Pass either a userId, an email, or a displayName — the tool resolves it. Use for personal notifications.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        recipient: zod_1.z.string().describe('userId, email, or displayName (e.g. "Adelin", "adelin@example.com").'),
        message: zod_1.z.string().describe('DM body. Markdown supported.'),
        agentName: zod_1.z.string().optional().default('Orlode'),
        triggerReason: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string(), dmId: zod_1.z.string().optional(), recipientUserId: zod_1.z.string().optional() }),
}, async (input) => {
    try {
        const member = await resolveMember(input.companyId, input.recipient);
        if (!member) {
            return { success: false, message: `Aucun membre trouvé pour "${input.recipient}". Utilise listTeamMembers pour voir les membres disponibles.` };
        }
        const author = makeAuthor(input.agentName ?? 'Orlode');
        const db = (0, firebase_config_1.getFirestore)();
        // DM threads use a deterministic id from sorted participant ids. The
        // agent uses its synthetic authorId as a participant so the DM thread
        // is owned by the agent + recipient (not a real human).
        const allParticipants = [author.authorId, member.userId].sort();
        const dmId = allParticipants.join('_');
        const dmRef = db.collection(`companies/${input.companyId}/dms`).doc(dmId);
        const dmDoc = await dmRef.get();
        if (!dmDoc.exists) {
            await dmRef.set({
                participants: allParticipants,
                isGroup: false,
                createdBy: author.authorId,
                createdByType: 'agent',
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        const content = input.message.trim();
        const msgRef = db.collection(`companies/${input.companyId}/dms/${dmId}/messages`).doc();
        await msgRef.set({
            content,
            ...author,
            createdBy: author.authorId,
            createdByName: author.authorName,
            createdByType: 'agent',
            triggerReason: input.triggerReason ?? null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await dmRef.update({
            lastMessage: content.slice(0, 100),
            lastMessageBy: author.authorName,
            lastMessageAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await logAgentActivity(input.companyId, 'agent_dm_sent', author.agentName, {
            dmId,
            recipientUserId: member.userId,
            recipientName: member.displayName,
            messageId: msgRef.id,
            contentPreview: content.slice(0, 200),
            triggerReason: input.triggerReason ?? null,
        });
        return { success: true, message: `DM envoyé à ${member.displayName} par ${author.authorName}`, dmId, recipientUserId: member.userId };
    }
    catch (err) {
        logger_1.logger.error('[TeamAgentTools] sendDM failed', { error: err });
        return { success: false, message: `Échec: ${err.message}` };
    }
});
// ── 6. readTeamChannelMessages ──────────────────────────────────────────────
// Lets the agent fetch the last N messages of a channel — required to answer
// questions like "résume #general" or "qu'a dit Adelin dans #ventes ?".
exports.readTeamChannelMessagesTool = genkit_config_1.ai.defineTool({
    name: 'readTeamChannelMessages',
    description: 'Read recent messages from a Team channel (Slack-clone). Use this when the user asks to summarize, search, or quote what was said in a channel. Pass the channel name (e.g. "general", "ventes").',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        channel: zod_1.z.string().describe('Channel name (e.g. "general") or channel id.'),
        limit: zod_1.z.number().optional().default(50).describe('How many recent messages to fetch (max 200).'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string(),
        channelId: zod_1.z.string().optional(),
        channelName: zod_1.z.string().optional(),
        messages: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            author: zod_1.z.string(),
            authorType: zod_1.z.string().optional(),
            content: zod_1.z.string(),
            createdAt: zod_1.z.string().optional(),
        })).optional(),
    }),
}, async (input) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const target = input.channel.replace(/^#/, '').trim().toLowerCase();
        if (!target)
            return { success: false, message: 'channel requis' };
        // Resolve without auto-creating (read-only).
        let channelId = null;
        let channelName = target;
        const direct = await db.collection(`companies/${input.companyId}/channels`).doc(target).get();
        if (direct.exists) {
            channelId = direct.id;
            channelName = direct.data()?.['name'] ?? direct.id;
        }
        else {
            const snap = await db.collection(`companies/${input.companyId}/channels`).limit(100).get();
            for (const d of snap.docs) {
                const name = (d.data()['name'] ?? '').trim().toLowerCase();
                if (name === target) {
                    channelId = d.id;
                    channelName = d.data()['name'] ?? d.id;
                    break;
                }
            }
        }
        if (!channelId) {
            return { success: false, message: `Canal "${input.channel}" introuvable. Utilise listTeamChannels pour voir les canaux disponibles.` };
        }
        const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
        const msgsSnap = await db.collection(`companies/${input.companyId}/channels/${channelId}/messages`)
            .orderBy('createdAt', 'desc').limit(limit).get();
        const messages = msgsSnap.docs.map(d => {
            const data = d.data();
            const ts = data['createdAt'];
            let createdAtIso;
            if (ts && typeof ts.toDate === 'function') {
                createdAtIso = ts.toDate().toISOString();
            }
            return {
                id: d.id,
                author: data['authorName'] ?? data['authorId'] ?? 'Inconnu',
                authorType: data['createdByType'] ?? 'human',
                content: data['content'] ?? '',
                createdAt: createdAtIso,
            };
        }).reverse();
        return {
            success: true,
            message: `${messages.length} message(s) récupéré(s) du canal #${channelName}`,
            channelId, channelName, messages,
        };
    }
    catch (err) {
        logger_1.logger.error('[TeamAgentTools] readChannel failed', { error: err });
        return { success: false, message: `Échec: ${err.message}` };
    }
});
// ── 5. mentionTeamMember ────────────────────────────────────────────────────
// Posts a message in a channel and creates explicit mention records for the
// listed users so they get notified (bell badge + Mentions tab).
exports.mentionTeamMemberTool = genkit_config_1.ai.defineTool({
    name: 'mentionTeamMember',
    description: 'Post a message in a channel AND notify specific members via @mention (creates mention notifications they will see in their Mentions tab). Use to draw a specific person\'s attention.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        channel: zod_1.z.string().describe('Channel name (e.g. "ventes") or channel id.'),
        mentions: zod_1.z.array(zod_1.z.string()).describe('List of recipients to mention (userIds, emails, or displayNames).'),
        message: zod_1.z.string().describe('Message body. The @mentions will be prepended automatically — you don\'t need to include them.'),
        agentName: zod_1.z.string().optional().default('Orlode'),
        triggerReason: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string(),
        messageId: zod_1.z.string().optional(),
        channelId: zod_1.z.string().optional(),
        mentioned: zod_1.z.array(zod_1.z.object({ userId: zod_1.z.string(), displayName: zod_1.z.string() })).optional(),
        unresolved: zod_1.z.array(zod_1.z.string()).optional(),
    }),
}, async (input) => {
    try {
        const channelId = await resolveChannel(input.companyId, input.channel, input.agentName ?? 'Orlode');
        if (!channelId) {
            return { success: false, message: `Canal "${input.channel}" introuvable.` };
        }
        const resolved = [];
        const unresolved = [];
        for (const q of input.mentions) {
            const m = await resolveMember(input.companyId, q);
            if (m)
                resolved.push(m);
            else
                unresolved.push(q);
        }
        if (resolved.length === 0) {
            return { success: false, message: `Aucun des destinataires (${input.mentions.join(', ')}) n'a pu être résolu en membre.`, unresolved };
        }
        const author = makeAuthor(input.agentName ?? 'Orlode');
        const db = (0, firebase_config_1.getFirestore)();
        const mentionPrefix = resolved.map(m => `@${m.displayName.split(' ')[0]}`).join(' ');
        const content = `${mentionPrefix} ${input.message.trim()}`;
        const msgRef = db.collection(`companies/${input.companyId}/channels/${channelId}/messages`).doc();
        await msgRef.set({
            content,
            ...author,
            attachments: [],
            createdBy: author.authorId,
            createdByName: author.authorName,
            createdByType: 'agent',
            triggerReason: input.triggerReason ?? null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await db.collection(`companies/${input.companyId}/channels`).doc(channelId).update({
            lastMessage: content.slice(0, 100),
            lastMessageBy: author.authorName,
            lastMessageAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Create mention notifications (so each mentioned user gets a bell badge)
        for (const m of resolved) {
            await db.collection(`companies/${input.companyId}/mentions`).add({
                mentionedUserId: m.userId,
                fromUserId: author.authorId,
                fromUserName: author.authorName,
                fromUserType: 'agent',
                channelId,
                messageId: msgRef.id,
                content: content.slice(0, 200),
                read: false,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        await logAgentActivity(input.companyId, 'agent_mention_sent', author.agentName, {
            channelId,
            channelInput: input.channel,
            messageId: msgRef.id,
            mentionedUsers: resolved.map(r => ({ userId: r.userId, name: r.displayName })),
            unresolved,
            contentPreview: content.slice(0, 200),
            triggerReason: input.triggerReason ?? null,
        });
        return {
            success: true,
            message: `Message posté dans #${input.channel} avec mention de ${resolved.map(r => r.displayName).join(', ')}`,
            messageId: msgRef.id,
            channelId,
            mentioned: resolved,
            unresolved: unresolved.length > 0 ? unresolved : undefined,
        };
    }
    catch (err) {
        logger_1.logger.error('[TeamAgentTools] mention failed', { error: err });
        return { success: false, message: `Échec: ${err.message}` };
    }
});
//# sourceMappingURL=teamAgentTools.js.map