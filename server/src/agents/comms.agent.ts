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
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { COMMS_GOOGLE_TOOLS } from './tools/mcp/googleWorkspace';
import { COMMS_SLACK_TOOLS as SLACK_TOOLS } from './tools/mcp/slack';
import { mcpAvailability } from '../config/mcp.config';
import { logger } from '../utils/logger';

const INPUT = z.object({
  type:       z.enum(['email', 'meeting_summary', 'action_items', 'notification', 'report', 'search', 'send']),
  companyId:  z.string(),
  language:   z.string().optional().default('auto'),
  context:    z.string().describe('Content/data to base the communication on'),
  recipients: z.array(z.string()).optional().describe('Recipient names/emails for personalization'),
  tone:       z.enum(['formal', 'professional', 'friendly', 'urgent']).optional().default('professional'),
  subject:    z.string().optional().describe('For emails: suggested subject or topic'),
  channel:    z.string().optional().describe('Slack channel for notifications (e.g., #general)'),
  sendVia:    z.enum(['draft', 'gmail', 'slack', 'none']).optional().default('none')
              .describe('How to deliver: none=draft only, draft=gmail draft, gmail=send email, slack=send to Slack'),
});

const OUTPUT = z.object({
  subject:   z.string().optional(),
  body:      z.string(),
  format:    z.enum(['plain', 'markdown', 'html']),
  wordCount: z.number(),
  sent:      z.boolean().optional().describe('True if actually sent via MCP'),
  sentVia:   z.string().optional().describe('Channel used for delivery (gmail/slack/etc)'),
  draftId:   z.string().optional(),
  messageTs: z.string().optional().describe('Slack message timestamp if sent to Slack'),
});

export type CommsInput  = z.infer<typeof INPUT>;
export type CommsOutput = z.infer<typeof OUTPUT>;

const TYPE_INSTRUCTIONS: Record<string, string> = {
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
  send:   `You are sending a communication. Use your delivery tools to send the message.`,
};

// ── The flow ──────────────────────────────────────────────────────────────────
export const commsAgentFlow = ai.defineFlow(
  { name: 'commsAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ type, language, context, recipients, tone, subject, channel, sendVia }): Promise<CommsOutput> => {
    logger.info(`[CommsAgent] type=${type} sendVia=${sendVia} mcp_gw=${mcpAvailability.googleWorkspace} mcp_slack=${mcpAvailability.slack}`);

    const langInstruction = language === 'auto'
      ? 'Write in the same language as the context provided.'
      : `Write in ${language}.`;

    const recipientNote = recipients && recipients.length > 0
      ? `Recipients: ${recipients.join(', ')}`
      : '';

    const subjectHint = subject ? `Topic/Subject hint: ${subject}` : '';
    const typeInstruction = TYPE_INSTRUCTIONS[type] ?? TYPE_INSTRUCTIONS['email'];

    // ── Determine which tools to make available ───────────────────────────
    const activeTools: unknown[] = [];
    const hasMcpGw = mcpAvailability.googleWorkspace;
    const hasMcpSlack = mcpAvailability.slack;

    if (hasMcpGw) {
      activeTools.push(...COMMS_GOOGLE_TOOLS);
    }
    if (hasMcpSlack) {
      activeTools.push(...SLACK_TOOLS);
    }

    const sendInstructions = (() => {
      if (sendVia === 'draft' && hasMcpGw) return '\nAfter drafting, use gmail_draft to create a Gmail draft.';
      if (sendVia === 'gmail' && hasMcpGw) return '\nAfter drafting, use gmail_send to send the email. ONLY if user explicitly requested sending.';
      if (sendVia === 'slack' && hasMcpSlack) return `\nAfter drafting, use slack_send_message to post to ${channel ?? '#general'}.`;
      if (sendVia !== 'none') return `\nNote: MCP delivery not available for "${sendVia}" — returning draft only.`;
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
      let response = await ai.generate({
        model:  GEMINI_FLASH,
        system: systemPrompt,
        prompt: `Based on the following context, create and deliver the communication:\n\n${context}`,
        tools:  activeTools as never,
        config: { temperature: 0.4 },
      });

      // Tool execution loop — static name map (we know the names from the tool definitions)
      const toolExecutors = new Map<string, (input: unknown) => Promise<unknown>>();
      const { gmailSearchTool, gmailReadTool, gmailDraftTool, gmailSendTool, gmailLabelTool, contactsSearchTool } = await import('./tools/mcp/googleWorkspace');
      const { slackSendMessageTool, slackSearchTool, slackListChannelsTool, slackUploadFileTool, slackGetUserTool } = await import('./tools/mcp/slack');

      if (hasMcpGw) {
        toolExecutors.set('gmail_search',      (i) => gmailSearchTool(i as never));
        toolExecutors.set('gmail_read',        (i) => gmailReadTool(i as never));
        toolExecutors.set('gmail_draft',       (i) => gmailDraftTool(i as never));
        toolExecutors.set('gmail_send',        (i) => gmailSendTool(i as never));
        toolExecutors.set('gmail_label',       (i) => gmailLabelTool(i as never));
        toolExecutors.set('contacts_search',   (i) => contactsSearchTool(i as never));
      }
      if (hasMcpSlack) {
        toolExecutors.set('slack_send_message',  (i) => slackSendMessageTool(i as never));
        toolExecutors.set('slack_search',        (i) => slackSearchTool(i as never));
        toolExecutors.set('slack_list_channels', (i) => slackListChannelsTool(i as never));
        toolExecutors.set('slack_upload_file',   (i) => slackUploadFileTool(i as never));
        toolExecutors.set('slack_get_user',      (i) => slackGetUserTool(i as never));
      }

      let loopCount = 0;
      let draftId: string | undefined;
      let messageTs: string | undefined;
      let sent = false;
      let sentVia: string | undefined;

      while (response.toolRequests.length > 0 && loopCount < 6) {
        loopCount++;

        const toolResults = await Promise.all(
          response.toolRequests.map(async (part) => {
            const { name, input, ref } = part.toolRequest;
            const executor = toolExecutors.get(name);
            let output: unknown;
            try {
              output = executor ? await executor(input) : { error: `Unknown tool: ${name}` };
              // Track delivery metadata
              const o = output as Record<string, unknown>;
              if (name === 'gmail_draft' && o['draftId']) draftId = o['draftId'] as string;
              if (name === 'gmail_send' && o['messageId']) { sent = true; sentVia = 'gmail'; }
              if (name === 'slack_send_message' && o['ts']) { messageTs = o['ts'] as string; sent = true; sentVia = 'slack'; }
            } catch (err) {
              logger.warn(`[CommsAgent] Tool ${name} failed`, { error: err });
              output = { error: String(err) };
            }
            return { name, ref, output };
          })
        );

        response = await ai.generate({
          model:    GEMINI_FLASH,
          messages: [
            ...response.messages,
            {
              role:    'tool' as const,
              content: toolResults.map((r) => ({
                toolResponse: { name: r.name, ref: r.ref, output: r.output },
              })),
            },
          ],
          tools:  activeTools as never,
          config: { temperature: 0.4 },
        });
      }

      // Parse final text response for the draft content
      const text = response.text;
      try {
        const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(cleaned) as { subject?: string; body: string; format: string };
        const body = parsed.body ?? text;
        return {
          subject:   parsed.subject,
          body,
          format:    (parsed.format as CommsOutput['format']) ?? 'markdown',
          wordCount: body.split(/\s+/).length,
          sent,
          sentVia,
          draftId,
          messageTs,
        };
      } catch {
        return {
          body: text, format: 'plain', wordCount: text.split(/\s+/).length,
          sent, sentVia, draftId, messageTs,
        };
      }
    }

    // ── No MCP: pure text generation (original behavior) ─────────────────
    const { text } = await ai.generate({
      model:  GEMINI_FLASH,
      system: systemPrompt,
      prompt: `Based on the following context, create the communication:\n\n${context}`,
      config: { temperature: 0.4 },
    });

    try {
      const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleaned) as { subject?: string; body: string; format: string };
      const body = parsed.body ?? text;
      return {
        subject:   parsed.subject,
        body,
        format:    (parsed.format as CommsOutput['format']) ?? 'markdown',
        wordCount: body.split(/\s+/).length,
      };
    } catch {
      return { body: text, format: 'plain', wordCount: text.split(/\s+/).length };
    }
  }
);

// ── Expose as a tool ──────────────────────────────────────────────────────────
export const commsAgentTool = ai.defineTool(
  {
    name: 'draftCommunication',
    description: 'Draft and optionally deliver professional communications: emails (Gmail), Slack notifications, meeting summaries, action item lists, or reports. With MCP configured: can search Gmail, create drafts, send emails, post to Slack channels.',
    inputSchema:  INPUT,
    outputSchema: OUTPUT,
  },
  (input) => commsAgentFlow(input)
);

// ── Module-scoped tools for the chat flow ──────────────────────────────────────
// These MUST be defined at module load time (Genkit forbids defining new actions
// at runtime). The flow's manual exec loop merges companyId into the input before
// dispatching, the same pattern used by HR / Sales / Support agents.

const reliableSendEmailTool = ai.defineTool(
  {
    name: 'comms_sendEmail',
    description: "Envoie VRAIMENT un email via la boîte de l'entreprise (Gmail si connecté, sinon Resend en fallback). Toujours préférer cet outil à draftCommunication pour un envoi réel. Si l'envoi échoue, dis-le HONNÊTEMENT — ne fabrique JAMAIS un succès.",
    inputSchema: z.object({
      companyId: z.string().optional(),
      to:        z.string().describe('Email destinataire'),
      subject:   z.string(),
      body:      z.string().describe('Corps du message (HTML ou markdown)'),
      cc:        z.string().optional(),
    }),
    outputSchema: z.object({
      success:  z.boolean(),
      provider: z.string().optional(),
      from:     z.string().optional(),
      message:  z.string(),
    }),
  },
  async ({ companyId, to, subject, body, cc }) => {
    if (!companyId) return { success: false, message: 'companyId manquant — impossible d\'envoyer.' };
    try {
      const { sendEmail: sendUnified } = await import('../services/email/emailService');
      const html = body.includes('<')
        ? body
        : `<div style="font-family:system-ui,sans-serif;line-height:1.6">${body.replace(/\n/g, '<br>')}</div>`;
      const result = await sendUnified({
        to, subject, html, cc, companyId,
        tags: [{ name: 'type', value: 'comms-agent' }],
      });
      return {
        success:  true,
        provider: result.provider,
        from:     result.from,
        message:  `Email envoyé à ${to} via ${result.provider}${result.from ? ` (depuis ${result.from})` : ''}.`,
      };
    } catch (err) {
      return {
        success: false,
        message: `Échec de l'envoi : ${(err as Error).message ?? String(err)}. Gmail probablement pas connecté pour cette entreprise. Configurer dans /admin/gmail ou utiliser Resend.`,
      };
    }
  }
);

const slackNotifyTool = ai.defineTool(
  {
    name: 'comms_notifySlack',
    description: "Envoie une notification Slack. Si MCP Slack n'est pas configuré pour l'entreprise, renvoie success=false avec une raison explicite. Toujours appeler ce tool pour toute demande Slack — n'invente JAMAIS un envoi.",
    inputSchema: z.object({
      companyId: z.string().optional(),
      channel:   z.string().describe('Canal Slack (#general, #commercial, ...)'),
      text:      z.string().describe('Message à envoyer'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async ({ channel, text }) => {
    if (!mcpAvailability.slack) {
      return {
        success: false,
        message: `MCP Slack non configuré pour cette entreprise. Impossible d'envoyer "${text.slice(0, 60)}..." vers ${channel}. Configurer Slack dans /admin/integrations pour activer l'envoi réel.`,
      };
    }
    try {
      const { slackSendMessageTool } = await import('./tools/mcp/slack');
      const result = await slackSendMessageTool({ channel, text } as never) as { ts?: string; ok?: boolean };
      if (result?.ok || result?.ts) return { success: true, message: `Message posté dans ${channel}.` };
      return { success: false, message: `Slack a refusé le message dans ${channel}.` };
    } catch (err) {
      return { success: false, message: `Échec Slack : ${(err as Error).message ?? String(err)}` };
    }
  }
);

// ── Chat-mode wrapper — for conversational use via the orchestrator/UI ─────────
// Accepts the standard { request, companyId, history } signature like other agents.
const CHAT_INPUT = z.object({
  request:   z.string(),
  companyId: z.string(),
  userId:    z.string().optional(),
  language:  z.string().optional().default('auto'),
  history:   z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const CHAT_OUTPUT = z.object({
  response:  z.string(),
  draftSent: z.boolean().optional(),
});

export const commsAgentChatFlow = ai.defineFlow(
  { name: 'commsAgentChat', inputSchema: CHAT_INPUT, outputSchema: CHAT_OUTPUT },
  async ({ request, companyId, language, history }): Promise<z.infer<typeof CHAT_OUTPUT>> => {
    logger.info(`[CommsAgentChat] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;

    const dateAnchors = (() => {
      const now = new Date();
      const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();

    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) {
        messages.push({ role: h.role, content: [{ text: h.content }] });
      }
    }
    messages.push({ role: 'user', content: [{ text: request }] });

    // Tools available: reliable email + slack notify + structured drafter + (optional) MCP Google/Slack
    // Both reliableSendEmailTool and slackNotifyTool are now module-scoped (defined above)
    // to satisfy Genkit's "no actions at runtime" rule. companyId is merged into tool inputs
    // by the manual exec loop below.
    const allTools = [
      reliableSendEmailTool,
      slackNotifyTool,
      commsAgentTool,
      ...(mcpAvailability.googleWorkspace ? COMMS_GOOGLE_TOOLS : []),
      ...(mcpAvailability.slack ? SLACK_TOOLS : []),
    ];

    let response = await ai.generate({
      model: GEMINI_FLASH,
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
2. GMAIL ${mcpAvailability.googleWorkspace ? '(MCP actif)' : '(MCP NON disponible — drafts uniquement)'}: ${mcpAvailability.googleWorkspace ? 'recherche, lecture threads, brouillons, envoi' : 'seulement créer des brouillons en attendant que MCP soit configuré'}
3. SLACK ${mcpAvailability.slack ? '(MCP actif)' : '(MCP NON disponible)'}: ${mcpAvailability.slack ? 'envoi de messages dans canaux/DM' : 'seulement formuler le texte'}
4. CONTACTS : recherche dans Google Contacts ${mcpAvailability.googleWorkspace ? '✓' : '✗ (non configuré)'}

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
        const tool = allTools.find(t => (t as unknown as { __action?: { name?: string } }).__action?.name === name);
        // Merge companyId into the tool input so module-scoped tools can use it
        // without relying on closures (Genkit forbids defining actions at runtime).
        const inp = { ...(input as Record<string, unknown>), companyId };
        let output: unknown;
        try { output = tool ? await (tool as (a: unknown) => Promise<unknown>)(inp) : { error: `Tool inconnu: ${name}` }; }
        catch (err) { output = { error: String(err) }; }
        return { name, ref, output };
      }));
      response = await ai.generate({
        model: GEMINI_FLASH,
        messages: [...response.messages, { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
        tools: allTools, config: { temperature: 0.4 },
      });
    }

    const text = response.text;
    return { response: text, draftSent: /envoy[ée]|sent|published|posted/i.test(text) };
  }
);

export const commsAgentChatTool = ai.defineTool(
  {
    name: 'callCommsAgent',
    description: 'Comms PRO chat-mode: rédige et envoie des emails, notifications Slack, résumés de meeting. Conversationnel.',
    inputSchema: CHAT_INPUT,
    outputSchema: CHAT_OUTPUT,
  },
  (input) => commsAgentChatFlow(input)
);
