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
exports.proposeClientReplyTool = exports.sendWhatsAppProductTool = exports.getTopWhatsAppProductsTool = exports.captureWhatsAppLeadTool = exports.createTeamTaskTool = exports.mentionTeamMemberTool = exports.readTeamChannelMessagesTool = exports.sendTeamDirectMessageTool = exports.sendTeamChannelMessageTool = exports.listTeamMembersTool = exports.listTeamChannelsTool = void 0;
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
// ─────────────────────────────────────────────────────────────────────────────
// createTeamTask — record a task in companies/{cid}/tasks so the team has a
// trackable item. Use when the user says things like "@orlode crée une tâche
// pour faire X" or "rappelle-moi de Y".
// ─────────────────────────────────────────────────────────────────────────────
exports.createTeamTaskTool = genkit_config_1.ai.defineTool({
    name: 'createTeamTask',
    description: 'Create a trackable task for the team. Use when the user asks to create, log, or remember a to-do (e.g. "@orlode crée une tâche pour appeler le client", "rappelle-moi de relancer Mr Loba"). Returns the task ID.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        title: zod_1.z.string().describe('Short task title (under 100 chars). Imperative form: "Appeler le client", "Préparer le devis".'),
        description: zod_1.z.string().optional().describe('Optional longer description / context.'),
        assigneeQuery: zod_1.z.string().optional().describe('Optional assignee — userId, email, or displayName. Leave empty to leave unassigned.'),
        dueDate: zod_1.z.string().optional().describe('Optional ISO date (YYYY-MM-DD) when this task is due.'),
        priority: zod_1.z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
        sourceChannel: zod_1.z.string().optional().describe('Optional channel name where the task was requested, for context.'),
        agentName: zod_1.z.string().optional().default('Orlode'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string(),
        taskId: zod_1.z.string().optional(),
        assignedTo: zod_1.z.object({ userId: zod_1.z.string(), displayName: zod_1.z.string() }).optional(),
    }),
}, async (input) => {
    try {
        const author = makeAuthor(input.agentName ?? 'Orlode');
        const db = (0, firebase_config_1.getFirestore)();
        let assignee = null;
        if (input.assigneeQuery) {
            assignee = await resolveMember(input.companyId, input.assigneeQuery);
        }
        const taskRef = db.collection(`companies/${input.companyId}/tasks`).doc();
        await taskRef.set({
            title: input.title.trim().slice(0, 200),
            description: input.description ?? null,
            status: 'open',
            priority: input.priority ?? 'normal',
            assigneeId: assignee?.userId ?? null,
            assigneeName: assignee?.displayName ?? null,
            dueDate: input.dueDate ?? null,
            createdBy: author.authorId,
            createdByName: author.authorName,
            createdByType: 'agent',
            sourceChannel: input.sourceChannel ?? null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await logAgentActivity(input.companyId, 'agent_message_sent', author.agentName, {
            type: 'task_created',
            taskId: taskRef.id,
            title: input.title,
            assigneeId: assignee?.userId,
            assigneeName: assignee?.displayName,
        });
        const assignedNote = assignee ? ` (assignée à ${assignee.displayName})` : '';
        return {
            success: true,
            message: `Tâche créée: « ${input.title} »${assignedNote}.`,
            taskId: taskRef.id,
            assignedTo: assignee ?? undefined,
        };
    }
    catch (err) {
        logger_1.logger.error('[TeamAgentTools] createTeamTask failed', { error: err });
        return { success: false, message: `Échec: ${err.message}` };
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// captureWhatsAppLead — store a structured lead when a WhatsApp customer
// gives their info during a soft-resume after handoff timeout. The lead is
// surfaced in the WhatsApp admin page so the human can follow up.
// ─────────────────────────────────────────────────────────────────────────────
exports.captureWhatsAppLeadTool = genkit_config_1.ai.defineTool({
    name: 'captureWhatsAppLead',
    description: 'Capture a WhatsApp customer\'s info as a lead. Use ONLY when a customer is in handoff-timeout mode and gives their name / need / urgency so a human can call them back. Never use during a normal conversation.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        customerPhone: zod_1.z.string().describe('Customer phone number (digits only or +xxx).'),
        name: zod_1.z.string().optional().describe('Customer name if given.'),
        need: zod_1.z.string().optional().describe('What they need / their request, in the customer\'s own words.'),
        urgency: zod_1.z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
        notes: zod_1.z.string().optional().describe('Any extra context (preferred contact time, language, etc.).'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        leadId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    try {
        const { captureWhatsAppLead } = await Promise.resolve().then(() => __importStar(require('../../services/whatsapp/humanHandoffService')));
        const id = await captureWhatsAppLead(input.companyId, {
            customerPhone: input.customerPhone,
            name: input.name,
            need: input.need,
            urgency: input.urgency ?? 'normal',
            notes: input.notes,
            source: 'handoff_timeout',
            status: 'new',
        });
        if (!id)
            return { success: false, message: 'Échec stockage lead' };
        // If this customer arrived via a Meta ad, propagate the referral onto
        // the lead and bump the campaign's leadsCreated counter. This is what
        // powers the per-campaign performance dashboard.
        try {
            const phoneKey = input.customerPhone.replace(/\D/g, '');
            const convoDoc = await (0, firebase_config_1.getFirestore)()
                .collection(`companies/${input.companyId}/whatsappConversations`).doc(phoneKey).get();
            const convo = convoDoc.exists ? convoDoc.data() : null;
            const referral = convo?.['adReferral'];
            if (referral?.['source_id']) {
                await (0, firebase_config_1.getFirestore)()
                    .collection(`companies/${input.companyId}/whatsappLeads`).doc(id)
                    .update({
                    source: 'meta_ad',
                    adCampaignId: referral['source_id'],
                    adReferral: referral,
                }).catch(() => null);
                await (0, firebase_config_1.getFirestore)()
                    .collection(`companies/${input.companyId}/whatsappAdCampaigns`).doc(referral['source_id'])
                    .set({
                    leadsCreated: firestore_1.FieldValue.increment(1),
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }
        catch { /* best-effort */ }
        return { success: true, leadId: id, message: `Lead enregistré pour ${input.customerPhone}` };
    }
    catch (err) {
        logger_1.logger.error('[Tools] captureWhatsAppLead failed', { error: String(err) });
        return { success: false, message: `Échec: ${err.message}` };
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// getTopWhatsAppProducts — returns the company's catalog products ranked by
// score = (won / sent) * revenue. Use BEFORE sendWhatsAppProduct so you pick
// the product most likely to convert. Also useful when a previous product
// didn't get a reply: pick the next-best ranked product as alternative.
// ─────────────────────────────────────────────────────────────────────────────
exports.getTopWhatsAppProductsTool = genkit_config_1.ai.defineTool({
    name: 'getTopWhatsAppProducts',
    description: 'Get the top-ranked catalog products by conversion score (revenue × win rate). Call this FIRST when the customer shows buying intent so you can pick the product most likely to convert. Also call it when a previous product send didn\'t convert — to pick a different one.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        limit: zod_1.z.number().optional().default(5).describe('Max products to return (default 5).'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        products: zod_1.z.array(zod_1.z.object({
            retailerId: zod_1.z.string(),
            name: zod_1.z.string().optional(),
            price: zod_1.z.string().optional(),
            currency: zod_1.z.string().optional(),
            sent: zod_1.z.number(),
            won: zod_1.z.number(),
            revenue: zod_1.z.number(),
            score: zod_1.z.number(),
        })).optional(),
        message: zod_1.z.string().optional(),
    }),
}, async (input) => {
    try {
        const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../../services/whatsapp/whatsappService')));
        const products = await whatsappService.listCatalogProducts(input.companyId);
        if (products.length === 0)
            return { success: false, message: 'Aucun produit dans le catalogue.' };
        const db = (0, firebase_config_1.getFirestore)();
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [sendsSnap, leadsSnap] = await Promise.all([
            db.collection(`companies/${input.companyId}/whatsappCatalogSends`).where('sentAt', '>=', since).limit(1000).get().catch(() => null),
            db.collection(`companies/${input.companyId}/whatsappLeads`).where('status', '==', 'closed_won').limit(500).get().catch(() => null),
        ]);
        const scored = products.map((p) => {
            const id = p.retailer_id;
            let sent = 0, won = 0, revenue = 0;
            if (sendsSnap)
                for (const d of sendsSnap.docs)
                    if (d.data()['productRetailerId'] === id)
                        sent++;
            if (leadsSnap)
                for (const d of leadsSnap.docs) {
                    const ld = d.data();
                    if (ld['lastProductRetailerId'] === id) {
                        won++;
                        if (typeof ld['revenue'] === 'number')
                            revenue += ld['revenue'];
                    }
                }
            const score = sent > 0 ? Math.round((won / sent) * revenue) : 0;
            return {
                retailerId: id,
                name: p.name,
                price: p.price,
                currency: p.currency,
                sent, won, revenue, score,
            };
        });
        scored.sort((a, b) => (b.score - a.score) || (b.revenue - a.revenue) || (b.won - a.won));
        return { success: true, products: scored.slice(0, input.limit ?? 5) };
    }
    catch (err) {
        logger_1.logger.error('[Tools] getTopWhatsAppProducts failed', { error: String(err) });
        return { success: false, message: `Échec: ${err.message}` };
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// sendWhatsAppProduct — pushes a Meta Catalog product card to a customer in
// WhatsApp. Use when the customer expresses buying intent ("c'est combien ?",
// "intéressé", "je veux acheter", "tu as ça en stock ?"). The card is
// interactive (image + price + View button). Auto-attributes to the lead.
// ─────────────────────────────────────────────────────────────────────────────
exports.sendWhatsAppProductTool = genkit_config_1.ai.defineTool({
    name: 'sendWhatsAppProduct',
    description: 'Send a Meta Catalog product card to a WhatsApp customer. Use ONLY when the customer shows clear buying intent (asks about a product, says "how much", "interested", "buy", "in stock", etc.). The card includes image, price, and a "View" button. Returns the messageId.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        customerPhone: zod_1.z.string().describe('Customer phone with country code (e.g. +2250701234567)'),
        productRetailerId: zod_1.z.string().describe('The retailer_id of the product in the Meta catalog (NOT the internal Meta product id). Look it up via the catalog list if you don\'t know.'),
        bodyText: zod_1.z.string().describe('Short message accompanying the product card (≤ 1024 chars). Be enthusiastic but concise.'),
        footerText: zod_1.z.string().optional().describe('Optional small footer text (≤ 60 chars).'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        messageId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    try {
        const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../../services/whatsapp/whatsappService')));
        const config = await whatsappService.getConfig(input.companyId);
        if (!config)
            return { success: false, message: 'WhatsApp non connecté.' };
        const catalogId = await whatsappService.getCatalogId(input.companyId);
        if (!catalogId)
            return { success: false, message: 'Aucun catalogue Meta lié.' };
        const out = await whatsappService.sendProductMessage(config, input.customerPhone, catalogId, input.productRetailerId, input.bodyText, input.footerText);
        if (!out.messageId) {
            return { success: false, message: `Échec: ${out.error ?? 'unknown'}` };
        }
        // Audit + lead linking — same logic as the route handler.
        const db = (0, firebase_config_1.getFirestore)();
        const phoneDigits = input.customerPhone.replace(/\D/g, '');
        let relatedLeadId = null;
        try {
            const leadSnap = await db.collection(`companies/${input.companyId}/whatsappLeads`)
                .where('customerPhone', 'in', [input.customerPhone, phoneDigits, `+${phoneDigits}`])
                .orderBy('createdAt', 'desc').limit(1).get().catch(() => null);
            if (leadSnap && !leadSnap.empty) {
                relatedLeadId = leadSnap.docs[0].id;
                await leadSnap.docs[0].ref.update({
                    lastProductRetailerId: input.productRetailerId,
                    lastProductSentAt: firestore_1.FieldValue.serverTimestamp(),
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                }).catch(() => null);
            }
        }
        catch { /* best-effort */ }
        await db.collection(`companies/${input.companyId}/whatsappCatalogSends`).add({
            to: input.customerPhone,
            productRetailerId: input.productRetailerId,
            catalogId,
            bodyText: input.bodyText,
            footerText: input.footerText ?? null,
            messageId: out.messageId,
            relatedLeadId,
            sentBy: 'agent:orlode',
            sentAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { success: true, messageId: out.messageId, message: `Produit ${input.productRetailerId} envoyé à ${input.customerPhone}.` };
    }
    catch (err) {
        logger_1.logger.error('[Tools] sendWhatsAppProduct failed', { error: String(err) });
        return { success: false, message: `Échec: ${err.message}` };
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// proposeClientReply — DOES NOT SEND. Stores a draft proposal that the user
// must validate via the action card UI in team chat. Use when the user asks
// the agent to "répond au client", "rédige un message", "envoie un email à X",
// etc. The team-chat UI renders the proposalId as an action card with buttons.
// ─────────────────────────────────────────────────────────────────────────────
exports.proposeClientReplyTool = genkit_config_1.ai.defineTool({
    name: 'proposeClientReply',
    description: 'Propose (do NOT send) a draft message to a client. Use when the user asks "répond au client", "rédige un message", "envoie un email à X". The user will review and validate it in the team chat. Returns a proposalId that you MUST embed in your reply as [[ACTION:proposalId]] so the UI can render the action card.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        channel: zod_1.z.enum(['whatsapp', 'email', 'telegram']).describe('Where the message should be sent.'),
        recipient: zod_1.z.string().describe('Recipient identifier: phone number for WhatsApp/Telegram, email address for email. Include country code for phones (+225...).'),
        recipientName: zod_1.z.string().optional().describe('Display name of the recipient if known (for the card preview).'),
        subject: zod_1.z.string().optional().describe('Email subject (only used when channel=email).'),
        draft: zod_1.z.string().describe('The draft message body, ready to send. Write it in the recipient\'s language.'),
        language: zod_1.z.string().optional().describe('ISO language code (fr, en, es…) of the draft.'),
        sourceChannel: zod_1.z.string().optional().describe('Optional team channel name where the proposal was requested.'),
        agentName: zod_1.z.string().optional().default('Orlode'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        proposalId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    try {
        const author = makeAuthor(input.agentName ?? 'Orlode');
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(`companies/${input.companyId}/agentProposals`).doc();
        await ref.set({
            type: 'send_message',
            status: 'pending',
            channel: input.channel,
            recipient: input.recipient,
            recipientName: input.recipientName ?? null,
            subject: input.subject ?? null,
            draft: input.draft,
            language: input.language ?? null,
            sourceChannel: input.sourceChannel ?? null,
            createdBy: author.authorId,
            createdByName: author.authorName,
            agentName: author.agentName,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        logger_1.logger.info(`[TeamAgentTools] proposed ${input.channel} to ${input.recipient} → ${ref.id}`);
        return {
            success: true,
            proposalId: ref.id,
            message: `Proposal créée: ${input.channel} à ${input.recipientName ?? input.recipient}. Embed [[ACTION:${ref.id}]] dans ta réponse.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[TeamAgentTools] proposeClientReply failed', { error: err });
        return { success: false, message: `Échec: ${err.message}` };
    }
});
//# sourceMappingURL=teamAgentTools.js.map