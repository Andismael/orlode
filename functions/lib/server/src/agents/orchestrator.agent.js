"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestratorFlow = void 0;
exports.runOrchestrator = runOrchestrator;
/**
 * Orchestrator Agent — Gemini Pro
 *
 * Pattern: hierarchy (parent → children)
 * Responsibility: Central router for all user requests. Understands intent,
 * selects the right specialist agent(s), coordinates their work, and returns
 * a unified, coherent response to the user.
 *
 * Child agents (as tools):
 *   📄 documentsAgentTool  — document ingestion pipeline
 *   💬 qaAgentTool         — Q&A over knowledge base
 *   🎤 meetingAgentTool    — meeting transcription + analysis
 *   👁️ visionAgentTool    — image/frame analysis
 *   📊 insightsAgentTool   — proactive business intelligence
 *   📧 commsAgentTool      — communication drafting
 *   🖥️ itAgentTool         — IT support, helpdesk, inventory
 *   🔒 cybersecurityAgentTool — security, incidents, compliance
 *   📣 marketingAgentTool  — content, social media, analytics
 *   🃏 wildcardAgentTool       — universal fallback for any task
 *   🛎️ receptionAgentTool    — visitor check-in, appointments
 *   👩‍💼 hrAgentTool            — leave, HR policies, onboarding
 *   💰 accountingAgentTool   — invoices, expenses, cash flow
 *   🤝 salesAgentTool        — leads, pipeline, quotes
 *   📞 supportAgentTool      — customer support tickets
 *   ⚖️ legalAgentTool        — contracts, compliance, deadlines
 *   🎓 trainingAgentTool     — courses, quizzes, progress
 *
 * Plus direct Firestore tools for lightweight lookups.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const qa_agent_1 = require("./qa.agent");
const meeting_agent_1 = require("./meeting.agent");
const vision_agent_1 = require("./vision.agent");
const insights_agent_1 = require("./insights.agent");
const comms_agent_1 = require("./comms.agent");
const documents_agent_1 = require("./documents.agent");
const knowledge_agent_1 = require("./knowledge.agent");
const it_agent_1 = require("./it.agent");
const cybersecurity_agent_1 = require("./cybersecurity.agent");
const marketing_agent_1 = require("./marketing.agent");
const wildcard_agent_1 = require("./wildcard.agent");
const reception_agent_1 = require("./reception.agent");
const hr_agent_1 = require("./hr.agent");
const accounting_agent_1 = require("./accounting.agent");
const sales_agent_1 = require("./sales.agent");
const support_agent_1 = require("./support.agent");
const legal_agent_1 = require("./legal.agent");
const training_agent_1 = require("./training.agent");
const news_agent_1 = require("./news.agent");
const coach_agent_1 = require("./coach.agent");
const datascientist_agent_1 = require("./datascientist.agent");
const approval_agent_1 = require("./approval.agent");
const website_agent_1 = require("./website.agent");
const commerce_agent_1 = require("./commerce.agent");
const metaAds_agent_1 = require("./metaAds.agent");
// commercialAgentTool is for the PUBLIC landing page chatbot only — NOT for internal use
const firestoreTools_1 = require("./tools/firestoreTools");
const ragTools_1 = require("./tools/ragTools");
const logger_1 = require("../utils/logger");
const marketplaceAgentService_1 = require("../services/marketplaceAgentService");
const marketplaceTools_1 = require("./tools/marketplaceTools");
// The plain `sendEmail` tool (no PDF attachments) lives in externalTools.
// The orchestrator needs it registered so the LLM can call `sendEmail` directly.
const externalTools_1 = require("./tools/externalTools");
const teamAgentTools_1 = require("./tools/teamAgentTools");
// All tools available to the orchestrator
// MCP-backed tools are included dynamically based on availability
const ORCHESTRATOR_TOOLS = [
    // Specialist agents (agent-as-tool)
    qa_agent_1.qaAgentTool,
    knowledge_agent_1.knowledgeAgentTool,
    meeting_agent_1.meetingAgentTool,
    vision_agent_1.visionAgentTool,
    insights_agent_1.insightsAgentTool,
    comms_agent_1.commsAgentTool,
    documents_agent_1.documentsAgentTool,
    documents_agent_1.syncFromDriveTool,
    it_agent_1.itAgentTool,
    cybersecurity_agent_1.cybersecurityAgentTool,
    marketing_agent_1.marketingAgentTool,
    wildcard_agent_1.wildcardAgentTool,
    reception_agent_1.receptionAgentTool,
    hr_agent_1.hrAgentTool,
    accounting_agent_1.accountingAgentTool,
    sales_agent_1.salesAgentTool,
    support_agent_1.supportAgentTool,
    legal_agent_1.legalAgentTool,
    training_agent_1.trainingAgentTool,
    news_agent_1.newsAgentTool,
    coach_agent_1.coachAgentTool,
    datascientist_agent_1.dataScientistAgentTool,
    approval_agent_1.approvalAgentTool,
    website_agent_1.websiteAgentTool,
    // commercialAgentTool removed — it's for the public landing page, not internal use
    // Direct data tools (lightweight lookups without spawning a full agent)
    firestoreTools_1.getDocumentsTool,
    firestoreTools_1.readDocumentTool,
    firestoreTools_1.editDocumentTool,
    firestoreTools_1.getConversationsTool,
    firestoreTools_1.getMeetingsTool,
    firestoreTools_1.getEmployeesTool,
    ragTools_1.searchDocumentsTool,
    // Action tools (CRM, appointments, stock, quotes, alerts, reports)
    marketplaceTools_1.createAppointmentTool,
    marketplaceTools_1.listAppointmentsTool,
    marketplaceTools_1.deleteAppointmentTool,
    marketplaceTools_1.deleteWorkItemTool,
    marketplaceTools_1.sendWhatsAppMessageTool,
    marketplaceTools_1.sendTelegramMessageTool,
    externalTools_1.sendEmailTool, // name: 'sendEmail' — plain emails (from externalTools)
    marketplaceTools_1.sendEmailTool, // name: 'sendEmailWithDocs' — emails with PDF attachments
    // Team (in-house Slack-clone) — agents post AND read in channels / DMs / mentions
    teamAgentTools_1.listTeamChannelsTool,
    teamAgentTools_1.listTeamMembersTool,
    teamAgentTools_1.readTeamChannelMessagesTool,
    teamAgentTools_1.sendTeamChannelMessageTool,
    teamAgentTools_1.sendTeamDirectMessageTool,
    teamAgentTools_1.mentionTeamMemberTool,
    teamAgentTools_1.createTeamTaskTool,
    teamAgentTools_1.proposeClientReplyTool,
    teamAgentTools_1.captureWhatsAppLeadTool,
    teamAgentTools_1.sendWhatsAppProductTool,
    teamAgentTools_1.getTopWhatsAppProductsTool,
    marketplaceTools_1.addClientTool,
    marketplaceTools_1.searchClientsTool,
    marketplaceTools_1.checkStockTool,
    marketplaceTools_1.updateStockTool,
    marketplaceTools_1.createQuoteTool,
    marketplaceTools_1.sendAlertTool,
    marketplaceTools_1.generateReportTool,
    // Commerce (Boutique WhatsApp) — list products, place orders, owner ops
    ...commerce_agent_1.COMMERCE_TOOLS,
    // Meta Ads — manage CTW campaigns from chat ("@admin lance une promo X")
    ...metaAds_agent_1.META_ADS_TOOLS,
];
const SYSTEM_PROMPT_TEMPLATE = `You are the intelligent AI assistant for "{{COMPANY_NAME}}".
You are an INTERNAL business tool — NOT a product salesperson. Never promote Orlode, pricing plans, or platform features.
You help employees of this company do their daily work using specialized agents.

## Your capabilities:
- **Knowledge Base**: Answer questions using company documents (use askQAAgent for quick Q&A, or callKnowledgeAgent for advanced: read aloud, analyze, compare, correct, send, generate documents)
- **Meetings**: Transcribe and analyze meeting recordings (use analyzeMeeting)
- **Vision**: Analyze images, screenshots, or video frames (use analyzeImage)
- **Insights**: Generate business intelligence and trends (use generateInsights)
- **Communications**: Draft emails, summaries, reports (use draftCommunication)
- **IT Support**: Helpdesk tickets, hardware inventory, system status (use callITAgent)
- **Cybersecurity**: Threat monitoring, incident response, security score, compliance (use callCybersecurityAgent)
- **Marketing**: Social media posts, blog articles, content calendar, analytics (use callMarketingAgent)
- **Reception**: Visitor check-in, appointments, visitor log, company info, employee badge creation (use callReceptionAgent)
- **HR**: Leave requests, HR policies, onboarding, employee directory, PAYSLIPS/fiches de paie, employment certificates, recruitment, org chart, performance reviews, offboarding, HR analytics (use callHRAgent — it handles ALL HR tasks INCLUDING payroll)
- **Accounting**: Invoices, expenses, cash flow, budget tracking (use callAccountingAgent)
- **Sales / CRM**: Leads, pipeline, quotes, clients, follow-ups, revenue forecast (use callSalesAgent)
- **Customer Support**: Support tickets, knowledge base, escalations (use callSupportAgent)
- **Legal**: Contract analysis, legal deadlines, compliance, templates (use callLegalAgent)
- **Training**: Quizzes, courses, learning progress, recommendations (use callTrainingAgent)
- **News**: Breaking news briefings 6x/day, sector news, news alerts (use callNewsAgent)
- **Wildcard**: ANY task not handled by a specialized agent above — ALWAYS last resort (use callWildcardAgent)
- **Data Lookup**: List documents, conversations, meetings, employees directly
- **Read Document**: Read the full text of any document by name (use readDocument) — for summaries, analysis, specific questions about a document
- **Edit Document**: Correct, rewrite, translate, or modify documents (use editDocument) — fix grammar, rewrite sections, translate, add content
- **Appointments**: Create, list, and DELETE appointments/bookings (use createAppointment, listAppointments, deleteAppointment)
- **Workspace**: Delete tasks/events from workspace (use deleteWorkItem)
- **WhatsApp**: Send messages, reminders, confirmations via WhatsApp (use sendWhatsAppMessage)
- **Telegram**: Send messages via Telegram bot (use sendTelegramMessage). IMPORTANT: Telegram does NOT accept phone numbers — only Telegram chat IDs (numeric like 123456789 or @username). If the user gives a phone number, call sendTelegramMessage WITHOUT the chatId param (it will fall back to the company's defaultChatId), then mention the recipient's name in the message body. Do NOT propose WhatsApp instead — call sendTelegramMessage as requested.
- **Équipe / Team (Slack-clone interne)**: This is the company's in-house Slack-like chat. You can READ messages AND post in channels, DMs, or @mention specific people.
  - "Résume #X" / "Qu'a dit <prénom> dans #X ?" / "Que se passe-t-il dans #X ?" → **readTeamChannelMessages** then synthesize. NEVER say "je n'ai pas accès aux messages du canal" — call the tool first.
  - "Préviens l'équipe ventes que..." / "Notifie le canal #X" / "Annonce dans #incidents..." → **sendTeamChannelMessage** with the channel name the user named (e.g. "ventes" → channel="ventes"). **CRITICAL — sendTeamChannelMessage AUTO-CREATES the channel if it doesn't exist**. Therefore:
    * NEVER call listTeamChannels first to "check if the channel exists" before posting.
    * NEVER fall back to #general because "the channel doesn't exist".
    * NEVER say in your reply "le canal X n'existe pas, j'ai transmis sur #general" — that's wrong, the tool would have created #X.
    * Just call the tool with the exact channel name the user gave you. Trust the tool. If the user said "ventes", you call sendTeamChannelMessage(channel="ventes", ...).
  - "Envoie un DM/message direct à <prénom>" / "Notifie <prénom> que..." → **sendTeamDirectMessage** with their name/email
  - "Mentionne @<prénom> dans #X" / "Tag <prénom> avec..." → **mentionTeamMember**
  - To find an existing member by name → **listTeamMembers**. Channel discovery (listTeamChannels) is only for "quels canaux on a ?" questions, NOT for pre-checking before posting.
  - All your Team posts will appear under "Orlode AI · <agentName>" — never impersonate a human.
  - Always pass triggerReason (1 phrase) so admins can audit why the message was sent.
- **Email simple**: Send plain text emails — confirmations, reminders, reports, follow-ups (use sendEmail). The body is auto-wrapped in a branded HTML template with the company logo. ALWAYS pass:
  - recipientName if known (extract from contacts/leads, or first part of the email if obvious like "marie.dupont@..." → "Marie")
  - ctaLabel + ctaUrl when there is an action: "Voir l'offre" + product link, "Confirmer le RDV" + booking link, "Payer la facture" + payment link.
  RULES TO AVOID SPAM FOLDER:
  - Body must be 2-4 short paragraphs MAX (no walls of text).
  - NEVER all-caps words, NEVER more than ONE exclamation mark per email.
  - NEVER spam-trigger phrases: "100 percent FREE", "ACT NOW", "CLICK HERE", "URGENT", "GUARANTEE", "WINNER".
  - For promo emails: focus on VALUE ("economise 30 percent"), not PRESSURE ("achete vite").
  - Personalize: mention what the recipient did/bought before, or why this matters to them.
  - End with a real human signature line (the agent will add the company footer + unsubscribe automatically).
- **Email + document**: Send a quote/invoice/contract email WITH the actual PDF attached (use sendEmailWithDocs with attachQuoteId / attachInvoiceId / attachContractId). NEVER write "ci-joint" / "en pièce jointe" / "attached" with sendEmail — only sendEmailWithDocs attaches files.
- **CRM**: Add and search clients (use addClient, searchClients)
- **Inventory**: Check and update stock (use checkStock, updateStock)
- **Quotes**: Create quotes/estimates (use createQuote)
- **Alerts**: Send alerts and notifications (use sendAlert)
- **Reports**: Generate business reports (use generateReport)

## CRITICAL — Action tools vs Agent tools:
When the user asks to CREATE, ADD, or DO something concrete, ALWAYS use the action tool directly:
- "Crée un devis / quote" → createQuote (NOT callSalesAgent or callAccountingAgent)
- "Ajoute un client" → addClient (NOT callSalesAgent)
- "Crée un rendez-vous / RDV" → createAppointment (NOT callReceptionAgent)
- "Supprime / annule un rendez-vous" → deleteAppointment
- "Supprime une tâche / un élément" → deleteWorkItem
- "Envoie un WhatsApp / message WhatsApp" → sendWhatsAppMessage
- "Rappel WhatsApp" → sendWhatsAppMessage
- "Envoie un Telegram / message Telegram" → sendTelegramMessage
- "Notifie sur Telegram" / "Préviens sur Telegram" → sendTelegramMessage
- "Préviens l'équipe X" / "Annonce dans #channel" / "Poste dans le canal..." → sendTeamChannelMessage
- "Envoie un DM à <prénom>" / "Notifie <prénom> en privé" → sendTeamDirectMessage
- "Mentionne @<prénom>" / "Tag <prénom>" → mentionTeamMember
- "Envoie un email" → sendEmail
- "Confirmation par email" → sendEmail
- "Envoie le devis par email" / "envoyer la facture" / "envoyer le contrat" → createQuote (or createInvoice) + sendEmailWithDocs(attachQuoteId/attachInvoiceId/attachContractId) — JAMAIS sendEmail seul
- "Vérifie le stock" → checkStock
- "Met à jour le stock" → updateStock
- "Envoie une alerte" → sendAlert
- "Génère un rapport" → generateReport
- "Liste les rendez-vous" → listAppointments
- "Recherche un client" → searchClients

Action tools save work items to the workspace — agents only return text.
Use agents ONLY for questions, analysis, advice, or complex reasoning:

## Routing guidelines:
- For simple questions about documents → askQAAgent
- For advanced document ops (read aloud, analyze, compare, correct, edit, send, generate) → callKnowledgeAgent
- For meeting-related requests → analyzeMeeting
- For image/visual content → analyzeImage
- For "what's happening", trends, analytics → generateInsights
- For drafting emails, summaries, reports → draftCommunication
- For IT/tech support questions, system health → callITAgent
- For security incidents, compliance, access reviews, security score → callCybersecurityAgent
- For social media, content creation, blog posts, marketing analytics → callMarketingAgent
- For visitor reception questions, presence, check-in, employee badges → callReceptionAgent
- For leave requests, HR policies, onboarding, employee directory, PAYSLIPS / fiches de paie, salaries, recruitment, employment certificates → callHRAgent
- For invoices questions, expenses analysis, cash flow, budget → callAccountingAgent
- For leads questions, pipeline analysis, sales performance → callSalesAgent
- For customer questions, support tickets, escalations → callSupportAgent
- For contract analysis, legal deadlines, legal compliance → callLegalAgent
- For employee training, quizzes, courses, learning paths → callTrainingAgent
- For news, current events, breaking news, industry news → callNewsAgent
- For personal coaching, career development, well-being, mentoring → callCoachAgent
- For cross-module analysis, correlations, predictions, strategic insights → callDataScientistAgent
- For quick data lookups (list, count) → use Firestore tools directly
- For complex multi-department requests → combine multiple agents
- You CAN combine an action tool + an agent: e.g. createQuote + callSalesAgent for a quote with sales advice
- ⚠️ LAST RESORT: If NO specialized agent matches → callWildcardAgent (it handles anything)

## 🔥 GOLDEN RULE — PROACTIVE AGENT (applies to ALL agents):
If information is missing to complete a task, **ASK for it in the chat** instead of refusing. NEVER say "data not found, please add it first". Instead:
- "I couldn't find [entity]. Can you tell me [missing info]? I'll create it and continue."
- "To do X, I need [Y]. What is it?"
Then use your tools to CREATE the missing data AND continue the task in the same conversation. The user should NEVER need to leave the chat to fill a form.
Examples:
- "Generate payslip for Sarah" → Sarah not in DB → ASK salary → create employee → generate payslip (1 conversation)
- "Create appointment with Paul" → Paul not in contacts → ASK phone → add contact → create appointment
- "Send quote to Marie for €5000" → Marie has no email → ASK email → save email → send quote
- "Publish post on LinkedIn" → account not connected → open OAuth popup, don't just say "go connect"

## Response style — Conversationnel, africain, business-focused:

**Ton :**
- TUTOIE le user par défaut (tu / ta / ton) sauf si le user te vouvoie en 1er
- Ton direct comme un collègue, PAS comme un consultant en costume
- Pas de "Voici un bilan", "Cela signifie que", "Il est important de noter" — ces phrases vides allongent la lecture sans rien dire
- Phrase courte, mots usuels. Tu parles à un patron de PME africaine qui lit sur WhatsApp avec le pouce, pas à un DAF parisien
- Émojis utilisés AVEC PARCIMONIE pour structurer (📊 🛒 💬 ⚠️ ✅) — jamais en décoration

**Format :**
- **MAX 5-7 lignes pour les réponses simples**, 10-12 pour un bilan/analyse complète
- Structure en mini-sections avec emoji titre + 1-2 puces courtes dessous (style WhatsApp, pas Word)
- Chiffres concrets > adjectifs flous : "14 conv ce mois · 0 produit · 3 docs" plutôt que "activité significative"
- Quand tu donnes un bilan : couvre TOUTES les briques business (boutique, WhatsApp, ventes, knowledge, équipe, packs activés), pas juste celles que tu as consultées en 1er
- Pour les chiffres manquants/à zéro : signale-le clairement comme un truc à faire, pas comme un échec ("0 produit en ligne — *active maintenant ?*")

**Recommandations actionnables :**
- JAMAIS "Il est important d'inscrire..." / "Nous devons enquêter..." (passif, moralisateur)
- TOUJOURS interrogatif et offert en service : "Veux-tu que je relance la transcription ?" / "Je t'aide à soumettre les templates ?"
- Termine par 1 question concrète ou 1 CTA tap-friendly ("Tape *boutique* pour démarrer")

**Citation des sources :**
- Cite la source quand pertinent ("d'après le Knowledge Brain", "selon les commandes Firestore") mais SANS jargon technique au user
- Si tu as utilisé plusieurs agents, synthétise en 1 réponse cohérente, pas une liste de retours d'agents

**Langue :**
- Respond in the same language as the user's message
- Si user en français → français naturel (pas du français traduit de l'anglais : pas "Je vais maintenant procéder à...", dis juste "Je fais ça")

**URLs :**
- **Preserve URLs verbatim**: when a tool result contains an http(s):// URL, include it AS-IS in your reply. Never replace it with link text alone — the user must be able to copy/click it. Critical for setup error messages that point to admin pages.

**Exemples bon vs mauvais :**

❌ MAUVAIS (Microsoft consultant) :
> "Voici un bilan de ce que nous avons et de ce qui manque. **Ce que nous avons :** Les 3 documents ont été indexés avec succès. **Ce qui manque :** Une réunion n'a pas de transcription. **Recommandation :** Nous devons enquêter sur la cause."

✅ BON (collègue africain) :
> "📊 *Bilan OuiHope · 23 mai*
> 🛒 Boutique : 0 produit en ligne — *t'aide à créer le 1er ?*
> 💬 WhatsApp : 14 conv ce mois ✓
> 📚 Knowledge : 3 docs indexés · 1 meeting sans transcript ⚠️
> 👥 Équipe : 0 employé inscrit
> Veux-tu qu'on attaque la boutique ?"
- ALWAYS include relevant navigation links in your responses using markdown format:
  - After creating an appointment → [Voir le calendrier](/calendar)
  - After creating a quote/devis → [Voir l'espace de travail](/workspace)
  - For HR topics → [Ouvrir le module RH](/agents/hr)
  - For finance/invoices → [Ouvrir la comptabilité](/agents/accounting)
  - For sales/leads → [Ouvrir le commercial](/agents/sales)
  - For support tickets → [Ouvrir le support](/agents/support)
  - For IT issues → [Ouvrir l'IT](/agents/it)
  - For marketing → [Ouvrir le marketing](/agents/marketing)
  - For security → [Ouvrir la sécurité](/agents/cybersecurity)
  - For training → [Ouvrir la formation](/agents/training)
  - For reception → [Ouvrir la réception](/agents/reception)
  - For legal/contracts → [Ouvrir le juridique](/agents/legal)
  - After sending an email → [Voir les emails](/agents/comms)
  - For messaging/inbox → [Ouvrir la messagerie](/agents/comms)
  - For communications (email, WhatsApp, campaigns) → [Ouvrir Communications](/agents/comms)
  - For knowledge/documents → [Ouvrir Knowledge](/agents/knowledge)
  - For marketplace → [Voir le marketplace](/marketplace)
  - For settings → [Paramètres](/settings)
  These links help the user navigate directly to the relevant page.`;
// ── Intelligence layer imports ─────────────────────────────────────────────
const orchestratorIntelligence_1 = require("../services/ai/orchestratorIntelligence");
const orchestratorPolicy_1 = require("../services/ai/orchestratorPolicy");
const conversationMemory_1 = require("../services/ai/conversationMemory");
// ── Main orchestrator function (PRO) ──────────────────────────────────────────
async function runOrchestrator(input) {
    const { message, companyId, userId, history = [], language = 'auto', streamCb, channel = 'web', fastReply = false } = input;
    const startTime = Date.now();
    logger_1.logger.info(`[Orchestrator] User ${userId} @ company ${companyId} [${channel}${fastReply ? '/fast' : ''}]: "${message.slice(0, 100)}"`);
    // ── 1. INTENT CLASSIFICATION (fast keyword + AI fallback) ────────────────
    const fastIntent = (0, orchestratorIntelligence_1.classifyIntentFast)(message);
    let intent = fastIntent;
    // If low confidence, use AI classifier — skipped in fastReply mode to save 300-500ms
    if (!fastReply && fastIntent.confidence < 0.6) {
        const historyText = history.slice(-4).map(h => `${h.role}: ${h.content}`).join('\n');
        intent = await (0, orchestratorIntelligence_1.classifyIntentAI)(message, historyText);
    }
    logger_1.logger.info(`[Orchestrator] Intent: ${intent.primaryAgent} (${intent.confidence.toFixed(2)}) — ${intent.reasoning}`);
    // ── 2. EXECUTION TRACING ─────────────────────────────────────────────────
    const trace = (0, orchestratorIntelligence_1.createTrace)(userId, companyId, message, intent);
    // ── 3. CONVERSATION MEMORY ──────────────────────────────────────────────
    // Skip memory load in fastReply mode — saves 100-200ms (one Firestore round-trip)
    const userMemory = fastReply ? null : await (0, conversationMemory_1.loadUserMemory)(companyId, userId);
    const memoryContext = userMemory ? (0, conversationMemory_1.buildMemoryContext)(userMemory) : '';
    // Compress history if too long
    const historyForContext = history.map(h => ({ role: h.role, content: h.content }));
    const summary = await (0, conversationMemory_1.summarizeConversation)(historyForContext);
    const compressedHistory = (0, conversationMemory_1.buildCompressedContext)(summary, historyForContext);
    // Fetch company name for personalized prompt
    let companyName = 'Mon Entreprise';
    try {
        const companyDoc = await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).get();
        companyName = companyDoc.data()?.['name'] || companyName;
    }
    catch { }
    const SYSTEM_PROMPT = SYSTEM_PROMPT_TEMPLATE.replace('{{COMPANY_NAME}}', companyName);
    // Fetch installed marketplace agents for this company (cached 5 min)
    const marketplaceAgents = await (0, marketplaceAgentService_1.getInstalledMarketplaceAgents)(companyId);
    const marketplacePromptSection = (0, marketplaceAgentService_1.buildMarketplaceAgentPrompt)(marketplaceAgents);
    // Dynamic tools: static + marketplace
    const dynamicTools = [...ORCHESTRATOR_TOOLS];
    if (marketplaceAgents.length > 0) {
        dynamicTools.push(marketplaceAgentService_1.callMarketplaceAgentTool);
    }
    // Build conversation history for Genkit (compressed)
    const historyMessages = compressedHistory.map((h) => ({
        role: (h.role === 'user' ? 'user' : 'model'),
        content: [{ text: h.content }],
    }));
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const langInstruction = language !== 'auto'
        ? `\nIMPORTANT: The user's preferred language is ${language}. Respond in ${language}.`
        : '';
    const channelInstructionMap = {
        whatsapp: `
=== WHATSAPP CHANNEL OVERRIDE ===
- VERY SHORT: 2-4 sentences max (~300 chars).
- NO internal markdown links like [X](/path).
- WhatsApp formatting only: *bold*, _italic_, \`code\`.
- Max 3 bullets if strictly needed.
- Answer directly, no preamble.

PRODUCT SENDING RULES (CRITICAL — don't break these):
- DO NOT push a product on the customer's first message. Answer their question first, build rapport.
- Wait until you have at least 2 customer messages with clear buying signals (asks price, asks availability, says "interested", "I want", "how much", "do you have").
- BEFORE sending: call getTopWhatsAppProducts to see which product converts best for this company. Pick from the top 3 if multiple match the customer's need.
- After 1 send with no reply within ~24h, you may suggest an ALTERNATIVE product from the top list — frame it as a softer option ("if you want something simpler, we also have…").
- Never send the same product twice to the same customer.`,
        telegram: `
=== TELEGRAM CHANNEL OVERRIDE ===
- Concise (max 5 sentences).
- Markdown V2 OK: *bold*, _italic_, [links](url).
- Inline buttons / long messages OK.`,
        sms: `
=== SMS CHANNEL OVERRIDE ===
- HARD LIMIT: 160 characters total.
- One sentence. Plain text, no markdown, no emojis, no URLs.`,
        messenger: `
=== MESSENGER CHANNEL OVERRIDE ===
- 3-4 sentences. Plain text, no markdown.
- Quick-reply friendly (concise, direct).`,
        email: `
=== EMAIL CHANNEL OVERRIDE ===
- Long-form OK. Greeting + signature ("Cordialement,").
- Markdown → HTML rendering allowed.
- No internal app links, only external URLs.`,
        team_channel: `
=== TEAM CHANNEL OVERRIDE ===
You are responding inside the company's internal Team chat (Slack-clone), in a specific channel. You're a digital colleague — not a customer-support bot.

TONE & STYLE:
- DIRECT and useful. Skip generic greetings ("Bonjour, comment puis-je vous aider ?", "How can I help you today?") — those are forbidden here.
- Match the channel's purpose:
  • #general / #equipe → neutral, informative, friendly
  • #ventes / #sales / #commercial → business-oriented, KPI-aware, action-driven
  • #incidents / #urgent / #alertes → operational, urgent, no fluff
  • #rh / #hr → empathetic, formal but warm
  • #tech / #dev / #it → technical, precise, code-aware
  • Other channels → infer the topic from the channel name
- Keep replies tight: 1-4 sentences for simple questions, longer only when the request needs it (summary, report, list).
- Use light markdown (**bold**, lists) only when it actually helps readability.

BEHAVIOR:
- If the user asks a question → answer directly. Don't restate the question.
- If the user asks to summarize / search / read the channel → CALL readTeamChannelMessages first, then synthesize. Do NOT say "je n'ai pas accès".
- If the user asks to create a task / log a to-do / "rappelle-moi de…" / "crée une tâche pour…" → CALL createTeamTask. Confirm in 1 sentence with the task title.
- If the user asks to draft / write / send a reply to a client ("répond à X", "envoie un message à Y", "rédige un email à Z") → CALL proposeClientReply (NEVER sendWhatsAppMessage/sendEmail/sendTelegramMessage directly). Then your reply MUST be exactly: "[[ACTION:<proposalId>]] Voici ma proposition pour <recipient>:" followed by a 1-line preview. The UI renders the action card with [Modifier] [Valider] [Annuler] buttons; the user clicks Valider to actually send. Do NOT include the full draft in your text reply — the card shows it.

CONTEXT RESOLUTION (CRITICAL):
- If the user uses a vague reference like "le client", "ce monsieur", "elle", "le rendez-vous", "ce truc" → look at the prior 20 messages in the channel context to resolve who/what they mean. Don't ask "quel client ?" if the answer is in the last 5 messages.
- If you genuinely cannot resolve from context → ask ONE specific follow-up: "Tu parles de Mr Loba ou de l'autre client ?" — never the generic "Pouvez-vous préciser ?".
- If a phone number, email, or name was mentioned earlier → reuse it without asking. The user already said it once.
- If the message is ambiguous → ask a SHORT, contextual follow-up (max 1 sentence) — never "comment puis-je vous aider ?".
- Never propose other channels (WhatsApp, Telegram) — you ARE the team channel right now.
- Refer to the user by first name when known (extract from the message author).

NO LINKS: Do not include internal app links like [X](/path) in team channel replies — they break the in-chat reading flow.`,
    };
    const channelInstruction = channelInstructionMap[channel] ? '\n\n' + channelInstructionMap[channel] : '';
    const systemWithLang = `${SYSTEM_PROMPT}${marketplacePromptSection}${memoryContext}

Current date and time: ${dateStr} at ${timeStr}.
The user's company ID is: ${companyId}
Intent detected: ${intent.primaryAgent} (confidence: ${intent.confidence.toFixed(2)})${intent.isMultiAgent ? ` — multi-agent: ${intent.secondaryAgents.join(', ')}` : ''}
IMPORTANT: Never ask the user for their company ID or any technical identifier. Always use companyId="${companyId}" automatically when calling tools.${channelInstruction}` + langInstruction;
    const contextualPrompt = message;
    // ── Create cross-agent context for sharing data between tools ─────────
    const requestContext = new orchestratorIntelligence_1.RequestContext();
    // ── HUMAN HANDOFF CHECK ─────────────────────────────────────────────────
    const handoff = (0, orchestratorPolicy_1.checkHandoff)(intent, 0, message);
    if (handoff.suggestion && intent.confidence < 0.4) {
        // Very low confidence → return clarification instead of calling agents
        const clarification = (0, orchestratorPolicy_1.buildHandoffResponse)(handoff);
        if (streamCb) {
            for (const w of clarification.split(' ')) {
                streamCb(w + ' ');
                await new Promise(r => setTimeout(r, 10));
            }
        }
        return { reply: clarification, agentsUsed: [], toolsCalled: [] };
    }
    // ── Initial generation ────────────────────────────────────────────────────
    // maxTurns lifted from Genkit's default 5 to 15 — a complete "bilan" request
    // legitimately calls 6-10 tools (getDocuments, listMeetings, getStores,
    // getProducts, getEmployees, etc.) and was aborting on the African-tone prompt
    // that asks for cross-module coverage.
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_PRO,
        system: systemWithLang,
        messages: [
            ...historyMessages,
            { role: 'user', content: [{ text: contextualPrompt }] },
        ],
        tools: dynamicTools,
        maxTurns: 15,
        config: { temperature: 0.5 },
    });
    // ── Agentic loop: execute tool calls until done ───────────────────────────
    const toolsCalled = [];
    let loopCount = 0;
    const MAX_LOOPS = 8;
    // Build tool executor map (name → async function)
    const toolExecutors = new Map([
        ['askQAAgent', (i) => (0, qa_agent_1.qaAgentTool)(i)],
        ['callKnowledgeAgent', (i) => (0, knowledge_agent_1.knowledgeAgentTool)(i)],
        ['analyzeMeeting', (i) => (0, meeting_agent_1.meetingAgentTool)(i)],
        ['analyzeImage', (i) => (0, vision_agent_1.visionAgentTool)(i)],
        ['generateInsights', (i) => (0, insights_agent_1.insightsAgentTool)(i)],
        ['draftCommunication', (i) => (0, comms_agent_1.commsAgentTool)(i)],
        ['processDocument', (i) => (0, documents_agent_1.documentsAgentTool)(i)],
        ['syncDocumentsFromDrive', (i) => (0, documents_agent_1.syncFromDriveTool)(i)],
        ['getDocuments', (i) => (0, firestoreTools_1.getDocumentsTool)(i)],
        ['readDocument', (i) => (0, firestoreTools_1.readDocumentTool)(i)],
        ['editDocument', (i) => (0, firestoreTools_1.editDocumentTool)(i)],
        ['getConversations', (i) => (0, firestoreTools_1.getConversationsTool)(i)],
        ['getMeetings', (i) => (0, firestoreTools_1.getMeetingsTool)(i)],
        ['getEmployees', (i) => (0, firestoreTools_1.getEmployeesTool)(i)],
        ['searchDocuments', (i) => (0, ragTools_1.searchDocumentsTool)(i)],
        ['callITAgent', (i) => (0, it_agent_1.itAgentTool)(i)],
        ['callCybersecurityAgent', (i) => (0, cybersecurity_agent_1.cybersecurityAgentTool)(i)],
        ['callMarketingAgent', (i) => (0, marketing_agent_1.marketingAgentTool)(i)],
        ['callWildcardAgent', (i) => (0, wildcard_agent_1.wildcardAgentTool)(i)],
        ['callReceptionAgent', (i) => (0, reception_agent_1.receptionAgentTool)(i)],
        ['callHRAgent', (i) => (0, hr_agent_1.hrAgentTool)(i)],
        ['callAccountingAgent', (i) => (0, accounting_agent_1.accountingAgentTool)(i)],
        ['callSalesAgent', (i) => (0, sales_agent_1.salesAgentTool)(i)],
        ['callSupportAgent', (i) => (0, support_agent_1.supportAgentTool)(i)],
        ['callLegalAgent', (i) => (0, legal_agent_1.legalAgentTool)(i)],
        ['callTrainingAgent', (i) => (0, training_agent_1.trainingAgentTool)(i)],
        ['callNewsAgent', (i) => (0, news_agent_1.newsAgentTool)(i)],
        ['callMarketplaceAgent', (i) => (0, marketplaceAgentService_1.callMarketplaceAgentTool)(i)],
        ['createAppointment', (i) => (0, marketplaceTools_1.createAppointmentTool)(i)],
        ['deleteAppointment', (i) => (0, marketplaceTools_1.deleteAppointmentTool)(i)],
        ['deleteWorkItem', (i) => (0, marketplaceTools_1.deleteWorkItemTool)(i)],
        ['sendWhatsAppMessage', (i) => (0, marketplaceTools_1.sendWhatsAppMessageTool)(i)],
        ['sendTelegramMessage', (i) => (0, marketplaceTools_1.sendTelegramMessageTool)(i)],
        ['listTeamChannels', (i) => (0, teamAgentTools_1.listTeamChannelsTool)(i)],
        ['listTeamMembers', (i) => (0, teamAgentTools_1.listTeamMembersTool)(i)],
        ['readTeamChannelMessages', (i) => (0, teamAgentTools_1.readTeamChannelMessagesTool)(i)],
        ['sendTeamChannelMessage', (i) => (0, teamAgentTools_1.sendTeamChannelMessageTool)(i)],
        ['sendTeamDirectMessage', (i) => (0, teamAgentTools_1.sendTeamDirectMessageTool)(i)],
        ['mentionTeamMember', (i) => (0, teamAgentTools_1.mentionTeamMemberTool)(i)],
        ['sendEmail', (i) => (0, externalTools_1.sendEmailTool)(i)],
        ['sendEmailWithDocs', (i) => (0, marketplaceTools_1.sendEmailTool)(i)],
        ['listAppointments', (i) => (0, marketplaceTools_1.listAppointmentsTool)(i)],
        ['addClient', (i) => (0, marketplaceTools_1.addClientTool)(i)],
        ['searchClients', (i) => (0, marketplaceTools_1.searchClientsTool)(i)],
        ['checkStock', (i) => (0, marketplaceTools_1.checkStockTool)(i)],
        ['updateStock', (i) => (0, marketplaceTools_1.updateStockTool)(i)],
        ['createQuote', (i) => (0, marketplaceTools_1.createQuoteTool)(i)],
        ['sendAlert', (i) => (0, marketplaceTools_1.sendAlertTool)(i)],
        ['generateReport', (i) => (0, marketplaceTools_1.generateReportTool)(i)],
    ]);
    while (response.toolRequests.length > 0 && loopCount < MAX_LOOPS) {
        loopCount++;
        const toolNames = response.toolRequests.map((p) => p.toolRequest.name);
        logger_1.logger.info(`[Orchestrator] Loop ${loopCount}: calling tools [${toolNames.join(', ')}]`);
        toolsCalled.push(...toolNames);
        // ── PARALLEL EXECUTION: run independent tools concurrently ──────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolResults = [];
        // Prepare all tasks
        const tasks = response.toolRequests.map((part) => {
            const { name, input, ref } = part.toolRequest;
            return { name, ref, input: injectCompanyId(name, input ?? {}, companyId) };
        });
        // Execute in parallel (instead of sequential)
        const parallelResults = await Promise.allSettled(tasks.map(async (task) => {
            const start = Date.now();
            const executor = toolExecutors.get(task.name);
            // ── POLICY: role-based access check ──────────────────────────
            const userRole = (await (0, firebase_config_1.getFirestore)().collection('users').doc(userId).get().catch(() => null))?.data?.()?.['role'] ?? 'employee';
            const access = (0, orchestratorPolicy_1.checkAgentAccess)(userRole, task.name);
            if (!access.allowed) {
                logger_1.logger.warn(`[Orchestrator] Policy DENIED: ${task.name} for role ${userRole}`);
                (0, orchestratorIntelligence_1.addTraceStep)(trace, task.name, 0, false, `Access denied: ${access.reason}`);
                return { name: task.name, ref: task.ref, output: { error: access.reason } };
            }
            // ── CIRCUIT BREAKER: skip unhealthy agents ───────────────────
            if (!(0, orchestratorIntelligence_1.isAgentAvailable)(task.name)) {
                logger_1.logger.warn(`[Orchestrator] Circuit OPEN for ${task.name} — skipping`);
                (0, orchestratorIntelligence_1.addTraceStep)(trace, task.name, 0, false, 'Circuit breaker open');
                return { name: task.name, ref: task.ref, output: { error: `Agent ${task.name} temporarily unavailable — retrying later` } };
            }
            try {
                // Inject cross-agent context if available
                const enrichedInput = { ...task.input, _crossAgentContext: requestContext.buildCrossAgentSummary() };
                const output = executor ? await executor(enrichedInput) : { error: `Unknown tool: ${task.name}` };
                const latency = Date.now() - start;
                // ── HEALTH TRACKING ──────────────────────────────────────────
                (0, orchestratorIntelligence_1.recordAgentCall)(task.name, latency, true);
                (0, orchestratorIntelligence_1.addTraceStep)(trace, task.name, latency, true);
                // ── BUDGET TRACKING ─────────────────────────────────────────
                (0, orchestratorPolicy_1.recordBudgetUsage)(companyId, userId, task.name);
                // ── CROSS-AGENT CONTEXT: save output for next agents ────────
                requestContext.setAgentOutput(task.name, output);
                return { name: task.name, ref: task.ref, output };
            }
            catch (err) {
                const latency = Date.now() - start;
                const errMsg = err instanceof Error ? err.message : String(err);
                logger_1.logger.error(`[Orchestrator] Tool ${task.name} failed: ${errMsg}`);
                // ── HEALTH TRACKING (failure) ────────────────────────────────
                (0, orchestratorIntelligence_1.recordAgentCall)(task.name, latency, false);
                (0, orchestratorIntelligence_1.addTraceStep)(trace, task.name, latency, false, errMsg);
                return { name: task.name, ref: task.ref, output: { error: `Tool ${task.name} failed: ${errMsg}` } };
            }
        }));
        for (const r of parallelResults) {
            if (r.status === 'fulfilled')
                toolResults.push(r.value);
            else
                toolResults.push({ name: 'unknown', ref: undefined, output: { error: 'Promise rejected' } });
        }
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_PRO,
            messages: [
                ...response.messages,
                {
                    role: 'tool',
                    content: toolResults.map((r) => ({
                        toolResponse: { name: r.name, ref: r.ref, output: r.output },
                    })),
                },
            ],
            tools: dynamicTools,
            maxTurns: 15,
            config: { temperature: 0.5 },
        });
    }
    // ── SENSITIVE DATA REDACTION ──────────────────────────────────────────────
    const rawReply = response.text;
    const { text: reply, redacted } = (0, orchestratorPolicy_1.redactSensitiveData)(rawReply);
    if (redacted.length > 0) {
        logger_1.logger.warn(`[Orchestrator] Redacted ${redacted.length} sensitive fields: ${redacted.join(', ')}`);
    }
    const totalLatency = Date.now() - startTime;
    // Stream the reply character by character if callback provided
    if (streamCb && reply) {
        const words = reply.split(' ');
        for (const word of words) {
            streamCb(word + ' ');
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }
    // Determine which specialist agents were used (vs raw tools)
    const AGENT_TOOL_NAMES = [
        'askQAAgent', 'callKnowledgeAgent', 'analyzeMeeting', 'analyzeImage', 'generateInsights', 'draftCommunication',
        'callITAgent', 'callCybersecurityAgent', 'callMarketingAgent', 'callWildcardAgent',
        'callReceptionAgent', 'callHRAgent', 'callAccountingAgent', 'callSalesAgent',
        'callSupportAgent', 'callLegalAgent', 'callTrainingAgent', 'callNewsAgent',
        'callCoachAgent', 'callDataScientistAgent', 'callMarketplaceAgent',
    ];
    const agentsUsed = [...new Set(toolsCalled.filter((t) => AGENT_TOOL_NAMES.includes(t)))];
    // ── 4. PERSIST TRACE ──────────────────────────────────────────────────────
    trace.agentsUsed = agentsUsed;
    trace.totalLatencyMs = totalLatency;
    (0, orchestratorIntelligence_1.persistTrace)(trace).catch(() => { });
    // ── 5. SAVE CONVERSATION MEMORY ────────────────────────────────────────────
    // Save summary if generated
    if (summary) {
        // Summary is saved per conversation externally by the controller
    }
    // Extract and save user facts (async, non-blocking)
    (0, conversationMemory_1.extractUserFacts)([...historyForContext, { role: 'user', content: message }, { role: 'model', content: reply }])
        .then(async (facts) => {
        if (facts.length > 0) {
            const existing = userMemory?.facts ?? [];
            const merged = [...new Set([...existing, ...facts])].slice(-20); // keep last 20 facts
            const topics = [...new Set([...(userMemory?.lastTopics ?? []), intent.category])].slice(-5);
            await (0, conversationMemory_1.saveUserMemory)(companyId, userId, { facts: merged, lastTopics: topics });
        }
    }).catch(() => { });
    // ── 6. BUILD EXPLANATION ────────────────────────────────────────────────
    const explanation = (0, orchestratorPolicy_1.buildExplanation)(intent);
    logger_1.logger.info(`[Orchestrator] Done in ${totalLatency}ms. Intent: ${intent.primaryAgent} (${intent.confidence.toFixed(2)}). Agents: [${agentsUsed.join(', ')}], Tools: ${toolsCalled.length}, Loops: ${loopCount}`);
    return { reply, agentsUsed, toolsCalled: [...new Set(toolsCalled)], explanation };
}
// ── Helper: inject companyId into tool inputs ─────────────────────────────────
function injectCompanyId(toolName, input, companyId) {
    // Tools that accept companyId but model might not always pass it
    const NEEDS_COMPANY_ID = [
        'askQAAgent', 'callKnowledgeAgent', 'analyzeMeeting', 'generateInsights', 'draftCommunication',
        'getDocuments', 'readDocument', 'editDocument', 'getConversations', 'getMeetings', 'getEmployees', 'searchDocuments',
        'callITAgent', 'callCybersecurityAgent', 'callMarketingAgent', 'callWildcardAgent',
        'callReceptionAgent', 'callHRAgent', 'callAccountingAgent', 'callSalesAgent',
        'callSupportAgent', 'callLegalAgent', 'callTrainingAgent', 'callNewsAgent',
        'callMarketplaceAgent',
        'createAppointment', 'listAppointments', 'deleteAppointment', 'deleteWorkItem',
        'sendWhatsAppMessage', 'sendEmail', 'sendEmailWithDocs', 'addClient', 'searchClients',
        'checkStock', 'updateStock', 'createQuote', 'sendAlert', 'generateReport',
    ];
    if (NEEDS_COMPANY_ID.includes(toolName) && !input['companyId']) {
        return { ...input, companyId };
    }
    return input;
}
// ── Genkit flow wrapper (for direct flow invocation) ─────────────────────────
const FLOW_INPUT = zod_1.z.object({
    message: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({
        role: zod_1.z.enum(['user', 'model']),
        content: zod_1.z.string(),
    })).optional().default([]),
    channel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional().default('web'),
    fastReply: zod_1.z.boolean().optional().default(false),
});
const FLOW_OUTPUT = zod_1.z.object({
    reply: zod_1.z.string(),
    agentsUsed: zod_1.z.array(zod_1.z.string()),
    toolsCalled: zod_1.z.array(zod_1.z.string()),
    explanation: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), message: zod_1.z.string(), details: zod_1.z.string().optional() })).optional(),
});
exports.orchestratorFlow = genkit_config_1.ai.defineFlow({ name: 'orchestrator', inputSchema: FLOW_INPUT, outputSchema: FLOW_OUTPUT }, (input) => runOrchestrator(input));
//# sourceMappingURL=orchestrator.agent.js.map