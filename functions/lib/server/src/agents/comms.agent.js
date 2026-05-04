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
exports.commsAgentChatTool = exports.commsAgentChatFlow = exports.commsAgentTool = exports.commsAgentFlow = void 0;
/**
 * Comms Agent — Gemini Flash
 *
 * Pattern: agent-as-tool + agentic loop when MCP is available
 * Responsibility: Draft AND send communications via Gmail, Slack, Google Contacts.
 *
 * Without MCP: drafts text (email body, notification, report)
 * With MCP:    can search Gmail, read threads, create drafts, send, notify Slack
 *
 * MCP Phase 3: Google Workspace (Gmail + Contacts) + Slack
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const googleWorkspace_1 = require("./tools/mcp/googleWorkspace");
const slack_1 = require("./tools/mcp/slack");
const mcp_config_1 = require("../config/mcp.config");
const logger_1 = require("../utils/logger");
const INPUT = zod_1.z.object({
    type: zod_1.z.enum(['email', 'meeting_summary', 'action_items', 'notification', 'report', 'search', 'send']),
    companyId: zod_1.z.string(),
    language: zod_1.z.string().optional().default('auto'),
    context: zod_1.z.string().describe('Content/data to base the communication on'),
    recipients: zod_1.z.array(zod_1.z.string()).optional().describe('Recipient names/emails for personalization'),
    tone: zod_1.z.enum(['formal', 'professional', 'friendly', 'urgent']).optional().default('professional'),
    subject: zod_1.z.string().optional().describe('For emails: suggested subject or topic'),
    channel: zod_1.z.string().optional().describe('Slack channel for notifications (e.g., #general)'),
    sendVia: zod_1.z.enum(['draft', 'gmail', 'slack', 'none']).optional().default('none')
        .describe('How to deliver: none=draft only, draft=gmail draft, gmail=send email, slack=send to Slack'),
});
const OUTPUT = zod_1.z.object({
    subject: zod_1.z.string().optional(),
    body: zod_1.z.string(),
    format: zod_1.z.enum(['plain', 'markdown', 'html']),
    wordCount: zod_1.z.number(),
    sent: zod_1.z.boolean().optional().describe('True if actually sent via MCP'),
    sentVia: zod_1.z.string().optional().describe('Channel used for delivery (gmail/slack/etc)'),
    draftId: zod_1.z.string().optional(),
    messageTs: zod_1.z.string().optional().describe('Slack message timestamp if sent to Slack'),
});
const TYPE_INSTRUCTIONS = {
    email: `Draft a professional email. Include: subject line, greeting, clear body paragraphs, call-to-action, and sign-off.
Return JSON: {"subject": "email subject", "body": "full email body in markdown", "format": "markdown"}`,
    meeting_summary: `Create a professional meeting summary suitable for distribution.
Include: key points discussed, decisions made, action items with owners, and next steps.
Return JSON: {"subject": "Meeting Summary: [Title]", "body": "formatted summary in markdown", "format": "markdown"}`,
    action_items: `Format action items as a clear, actionable task list.
Include owners, due dates, and priority indicators.
Return JSON: {"subject": "Action Items", "body": "formatted action items in markdown", "format": "markdown"}`,
    notification: `Write a concise notification message (1-3 sentences). Clear and direct.
Return JSON: {"subject": "notification title", "body": "brief notification text", "format": "plain"}`,
    report: `Generate a structured report with executive summary, key findings, data highlights, and recommendations.
Return JSON: {"subject": "Report: [Title]", "body": "full report in markdown with sections", "format": "markdown"}`,
    search: `You are searching for information. Use your search tools to find the requested information.`,
    send: `You are sending a communication. Use your delivery tools to send the message.`,
};
// ── The flow ──────────────────────────────────────────────────────────────────
exports.commsAgentFlow = genkit_config_1.ai.defineFlow({ name: 'commsAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ type, language, context, recipients, tone, subject, channel, sendVia }) => {
    logger_1.logger.info(`[CommsAgent] type=${type} sendVia=${sendVia} mcp_gw=${mcp_config_1.mcpAvailability.googleWorkspace} mcp_slack=${mcp_config_1.mcpAvailability.slack}`);
    const langInstruction = language === 'auto'
        ? 'Write in the same language as the context provided.'
        : `Write in ${language}.`;
    const recipientNote = recipients && recipients.length > 0
        ? `Recipients: ${recipients.join(', ')}`
        : '';
    const subjectHint = subject ? `Topic/Subject hint: ${subject}` : '';
    const typeInstruction = TYPE_INSTRUCTIONS[type] ?? TYPE_INSTRUCTIONS['email'];
    // ── Determine which tools to make available ───────────────────────────
    const activeTools = [];
    const hasMcpGw = mcp_config_1.mcpAvailability.googleWorkspace;
    const hasMcpSlack = mcp_config_1.mcpAvailability.slack;
    if (hasMcpGw) {
        activeTools.push(...googleWorkspace_1.COMMS_GOOGLE_TOOLS);
    }
    if (hasMcpSlack) {
        activeTools.push(...slack_1.COMMS_SLACK_TOOLS);
    }
    const sendInstructions = (() => {
        if (sendVia === 'draft' && hasMcpGw)
            return '\nAfter drafting, use gmail_draft to create a Gmail draft.';
        if (sendVia === 'gmail' && hasMcpGw)
            return '\nAfter drafting, use gmail_send to send the email. ONLY if user explicitly requested sending.';
        if (sendVia === 'slack' && hasMcpSlack)
            return `\nAfter drafting, use slack_send_message to post to ${channel ?? '#general'}.`;
        if (sendVia !== 'none')
            return `\nNote: MCP delivery not available for "${sendVia}" — returning draft only.`;
        return '';
    })();
    const systemPrompt = `You are an expert corporate communications specialist for Orlode AI.
Tone: ${tone}. ${langInstruction}
${recipientNote}
${subjectHint}

${typeInstruction}
${sendInstructions}

SAFETY RULES:
- NEVER send emails without explicit user confirmation (sendVia must be "gmail")
- Always create a draft first, show it, then send if approved
- For Slack: notifications are OK to send directly
- When using gmail_draft, the draft is NOT sent automatically

Return ONLY valid JSON. Do not include markdown code fences around the JSON.`;
    // ── If MCP tools available, use agentic loop ──────────────────────────
    if (activeTools.length > 0) {
        let response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            system: systemPrompt,
            prompt: `Based on the following context, create and deliver the communication:\n\n${context}`,
            tools: activeTools,
            config: { temperature: 0.4 },
        });
        // Tool execution loop — static name map (we know the names from the tool definitions)
        const toolExecutors = new Map();
        const { gmailSearchTool, gmailReadTool, gmailDraftTool, gmailSendTool, gmailLabelTool, contactsSearchTool } = await Promise.resolve().then(() => __importStar(require('./tools/mcp/googleWorkspace')));
        const { slackSendMessageTool, slackSearchTool, slackListChannelsTool, slackUploadFileTool, slackGetUserTool } = await Promise.resolve().then(() => __importStar(require('./tools/mcp/slack')));
        if (hasMcpGw) {
            toolExecutors.set('gmail_search', (i) => gmailSearchTool(i));
            toolExecutors.set('gmail_read', (i) => gmailReadTool(i));
            toolExecutors.set('gmail_draft', (i) => gmailDraftTool(i));
            toolExecutors.set('gmail_send', (i) => gmailSendTool(i));
            toolExecutors.set('gmail_label', (i) => gmailLabelTool(i));
            toolExecutors.set('contacts_search', (i) => contactsSearchTool(i));
        }
        if (hasMcpSlack) {
            toolExecutors.set('slack_send_message', (i) => slackSendMessageTool(i));
            toolExecutors.set('slack_search', (i) => slackSearchTool(i));
            toolExecutors.set('slack_list_channels', (i) => slackListChannelsTool(i));
            toolExecutors.set('slack_upload_file', (i) => slackUploadFileTool(i));
            toolExecutors.set('slack_get_user', (i) => slackGetUserTool(i));
        }
        let loopCount = 0;
        let draftId;
        let messageTs;
        let sent = false;
        let sentVia;
        while (response.toolRequests.length > 0 && loopCount < 6) {
            loopCount++;
            const toolResults = await Promise.all(response.toolRequests.map(async (part) => {
                const { name, input, ref } = part.toolRequest;
                const executor = toolExecutors.get(name);
                let output;
                try {
                    output = executor ? await executor(input) : { error: `Unknown tool: ${name}` };
                    // Track delivery metadata
                    const o = output;
                    if (name === 'gmail_draft' && o['draftId'])
                        draftId = o['draftId'];
                    if (name === 'gmail_send' && o['messageId']) {
                        sent = true;
                        sentVia = 'gmail';
                    }
                    if (name === 'slack_send_message' && o['ts']) {
                        messageTs = o['ts'];
                        sent = true;
                        sentVia = 'slack';
                    }
                }
                catch (err) {
                    logger_1.logger.warn(`[CommsAgent] Tool ${name} failed`, { error: err });
                    output = { error: String(err) };
                }
                return { name, ref, output };
            }));
            response = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                messages: [
                    ...response.messages,
                    {
                        role: 'tool',
                        content: toolResults.map((r) => ({
                            toolResponse: { name: r.name, ref: r.ref, output: r.output },
                        })),
                    },
                ],
                tools: activeTools,
                config: { temperature: 0.4 },
            });
        }
        // Parse final text response for the draft content
        const text = response.text;
        try {
            const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
            const parsed = JSON.parse(cleaned);
            const body = parsed.body ?? text;
            return {
                subject: parsed.subject,
                body,
                format: parsed.format ?? 'markdown',
                wordCount: body.split(/\s+/).length,
                sent,
                sentVia,
                draftId,
                messageTs,
            };
        }
        catch {
            return {
                body: text, format: 'plain', wordCount: text.split(/\s+/).length,
                sent, sentVia, draftId, messageTs,
            };
        }
    }
    // ── No MCP: pure text generation (original behavior) ─────────────────
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: systemPrompt,
        prompt: `Based on the following context, create the communication:\n\n${context}`,
        config: { temperature: 0.4 },
    });
    try {
        const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(cleaned);
        const body = parsed.body ?? text;
        return {
            subject: parsed.subject,
            body,
            format: parsed.format ?? 'markdown',
            wordCount: body.split(/\s+/).length,
        };
    }
    catch {
        return { body: text, format: 'plain', wordCount: text.split(/\s+/).length };
    }
});
// ── Expose as a tool ──────────────────────────────────────────────────────────
exports.commsAgentTool = genkit_config_1.ai.defineTool({
    name: 'draftCommunication',
    description: 'Draft and optionally deliver professional communications: emails (Gmail), Slack notifications, meeting summaries, action item lists, or reports. With MCP configured: can search Gmail, create drafts, send emails, post to Slack channels.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, (input) => (0, exports.commsAgentFlow)(input));
// ── Chat-mode wrapper — for conversational use via the orchestrator/UI ─────────
// Accepts the standard { request, companyId, history } signature like other agents.
const CHAT_INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const CHAT_OUTPUT = zod_1.z.object({
    response: zod_1.z.string(),
    draftSent: zod_1.z.boolean().optional(),
});
exports.commsAgentChatFlow = genkit_config_1.ai.defineFlow({ name: 'commsAgentChat', inputSchema: CHAT_INPUT, outputSchema: CHAT_OUTPUT }, async ({ request, companyId, language, history }) => {
    logger_1.logger.info(`[CommsAgentChat] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;
    const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20)) {
            messages.push({ role: h.role, content: [{ text: h.content }] });
        }
    }
    messages.push({ role: 'user', content: [{ text: request }] });
    // Reliable email tool — uses Gmail (if connected for the company) or Resend fallback
    // This works without MCP and supports attachments out of the box
    const reliableSendEmailTool = genkit_config_1.ai.defineTool({
        name: 'comms_sendEmail',
        description: "Envoie VRAIMENT un email via la boîte de l'entreprise (Gmail si connecté, sinon Resend en fallback). Toujours préférer cet outil à draftCommunication pour un envoi réel. Si l'envoi échoue, dis-le HONNÊTEMENT — ne fabrique JAMAIS un succès.",
        inputSchema: zod_1.z.object({
            to: zod_1.z.string().describe('Email destinataire'),
            subject: zod_1.z.string(),
            body: zod_1.z.string().describe('Corps du message (HTML ou markdown)'),
            cc: zod_1.z.string().optional(),
        }),
        outputSchema: zod_1.z.object({
            success: zod_1.z.boolean(),
            provider: zod_1.z.string().optional(),
            from: zod_1.z.string().optional(),
            message: zod_1.z.string(),
        }),
    }, async ({ to, subject, body, cc }) => {
        try {
            const { sendEmail: sendUnified } = await Promise.resolve().then(() => __importStar(require('../services/email/emailService')));
            const html = body.includes('<')
                ? body
                : `<div style="font-family:system-ui,sans-serif;line-height:1.6">${body.replace(/\n/g, '<br>')}</div>`;
            const result = await sendUnified({
                to, subject, html, cc, companyId,
                tags: [{ name: 'type', value: 'comms-agent' }],
            });
            return {
                success: true,
                provider: result.provider,
                from: result.from,
                message: `Email envoyé à ${to} via ${result.provider}${result.from ? ` (depuis ${result.from})` : ''}.`,
            };
        }
        catch (err) {
            return {
                success: false,
                message: `Échec de l'envoi : ${err.message ?? String(err)}. Gmail probablement pas connecté pour cette entreprise. Configurer dans /admin/gmail ou utiliser Resend.`,
            };
        }
    });
    // Slack notify — always available. Forwards to MCP if configured, otherwise
    // returns explicit failure so the LLM cannot fabricate "Notification envoyée".
    const slackNotifyTool = genkit_config_1.ai.defineTool({
        name: 'comms_notifySlack',
        description: "Envoie une notification Slack. Si MCP Slack n'est pas configuré pour l'entreprise, renvoie success=false avec une raison explicite. Toujours appeler ce tool pour toute demande Slack — n'invente JAMAIS un envoi.",
        inputSchema: zod_1.z.object({
            channel: zod_1.z.string().describe('Canal Slack (#general, #commercial, ...)'),
            text: zod_1.z.string().describe('Message à envoyer'),
        }),
        outputSchema: zod_1.z.object({
            success: zod_1.z.boolean(),
            message: zod_1.z.string(),
        }),
    }, async ({ channel, text }) => {
        if (!mcp_config_1.mcpAvailability.slack) {
            return {
                success: false,
                message: `MCP Slack non configuré pour cette entreprise. Impossible d'envoyer "${text.slice(0, 60)}..." vers ${channel}. Configurer Slack dans /admin/integrations pour activer l'envoi réel.`,
            };
        }
        try {
            const { slackSendMessageTool } = await Promise.resolve().then(() => __importStar(require('./tools/mcp/slack')));
            const result = await slackSendMessageTool({ channel, text });
            if (result?.ok || result?.ts)
                return { success: true, message: `Message posté dans ${channel}.` };
            return { success: false, message: `Slack a refusé le message dans ${channel}.` };
        }
        catch (err) {
            return { success: false, message: `Échec Slack : ${err.message ?? String(err)}` };
        }
    });
    // Tools available: reliable email + slack notify + structured drafter + (optional) MCP Google/Slack
    const allTools = [
        reliableSendEmailTool,
        slackNotifyTool,
        exports.commsAgentTool,
        ...(mcp_config_1.mcpAvailability.googleWorkspace ? googleWorkspace_1.COMMS_GOOGLE_TOOLS : []),
        ...(mcp_config_1.mcpAvailability.slack ? slack_1.COMMS_SLACK_TOOLS : []),
    ];
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: `Tu es l'Agent Communications PRO de l'entreprise — chargé de toutes les communications externes et internes.
CompanyID: ${companyId}.

## 📅 CONTEXTE TEMPOREL
${dateAnchors}
Pour les rappels, plannings d'envoi, dates dans les emails — utilise cette ancre.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique. Si l'utilisateur dit "envoie-le maintenant", "modifie le ton", "change le destinataire", références-toi à TON DERNIER brouillon. Ne JAMAIS recommencer un "Bonjour, je suis l'agent comms..." si le contexte est clair.

## TON RÔLE
Tu rédiges et envoies des communications professionnelles : emails (Gmail), notifications Slack, résumés de réunion, listes d'actions, rapports.

CAPACITÉS :
1. RÉDACTION : emails, notifications Slack, résumés de meeting, action items, rapports (draftCommunication)
2. GMAIL ${mcp_config_1.mcpAvailability.googleWorkspace ? '(MCP actif)' : '(MCP NON disponible — drafts uniquement)'}: ${mcp_config_1.mcpAvailability.googleWorkspace ? 'recherche, lecture threads, brouillons, envoi' : 'seulement créer des brouillons en attendant que MCP soit configuré'}
3. SLACK ${mcp_config_1.mcpAvailability.slack ? '(MCP actif)' : '(MCP NON disponible)'}: ${mcp_config_1.mcpAvailability.slack ? 'envoi de messages dans canaux/DM' : 'seulement formuler le texte'}
4. CONTACTS : recherche dans Google Contacts ${mcp_config_1.mcpAvailability.googleWorkspace ? '✓' : '✗ (non configuré)'}

WORKFLOW :
- Pour ENVOYER UN EMAIL RÉEL : appelle comms_sendEmail(to, subject, body) — fonctionne via Gmail OU Resend
- Pour RÉDIGER UN BROUILLON STRUCTURÉ (résumé, action items, rapport) : utilise draftCommunication(type, context, tone, sendVia="none")
- Pour RECHERCHER dans Gmail : utilise les tools MCP Gmail si dispo (sinon dis qu'ils ne sont pas configurés)
- Pour SLACK : appelle TOUJOURS comms_notifySlack(channel, text). Si le tool renvoie success=false avec "MCP Slack non configuré", dis-le textuellement à l'utilisateur — n'invente JAMAIS "Notification envoyée".

🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
Tu ne DOIS JAMAIS prétendre avoir fait une action si le tool n'a pas renvoyé success=true.
INTERDIT :
- "C'est fait ! Email envoyé..." si comms_sendEmail a renvoyé success=false ou si tu n'as pas appelé le tool
- "Notification Slack envoyée" si MCP Slack n'est pas dispo
- "Résumé généré" si draftCommunication a échoué
Si le tour précédent a échoué (erreur), reconnais-le explicitement : "Le tour précédent a rencontré une erreur, voici ce qui s'est vraiment passé : ..."
Si plusieurs actions sont demandées et certaines échouent, liste précisément ce qui a marché ET ce qui a échoué.
Si MCP n'est pas configuré, dis "MCP Slack/Gmail non configuré — je peux te générer le draft, mais l'envoi nécessite configuration".

RÈGLES :
- Pour un email à un client : ton "professional" par défaut
- Pour un message interne : ton "friendly"
- Pour une alerte : ton "urgent" + canal Slack si dispo
- Toujours préciser le destinataire (recipients) si mentionné dans le message
${langInstr}`,
        messages,
        tools: allTools,
        config: { temperature: 0.4 },
    });
    let loopCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 5) {
        loopCount++;
        const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            const tool = allTools.find(t => t.__action?.name === name);
            let output;
            try {
                output = tool ? await tool(input) : { error: `Tool inconnu: ${name}` };
            }
            catch (err) {
                output = { error: String(err) };
            }
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            messages: [...response.messages, { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
            tools: allTools, config: { temperature: 0.4 },
        });
    }
    const text = response.text;
    return { response: text, draftSent: /envoy[ée]|sent|published|posted/i.test(text) };
});
exports.commsAgentChatTool = genkit_config_1.ai.defineTool({
    name: 'callCommsAgent',
    description: 'Comms PRO chat-mode: rédige et envoie des emails, notifications Slack, résumés de meeting. Conversationnel.',
    inputSchema: CHAT_INPUT,
    outputSchema: CHAT_OUTPUT,
}, (input) => (0, exports.commsAgentChatFlow)(input));
//# sourceMappingURL=comms.agent.js.map