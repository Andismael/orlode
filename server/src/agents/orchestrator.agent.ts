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
import { z } from 'zod';
import { ai, GEMINI_PRO } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { qaAgentTool }                    from './qa.agent';
import { meetingAgentTool }               from './meeting.agent';
import { visionAgentTool }                from './vision.agent';
import { insightsAgentTool }              from './insights.agent';
import { commsAgentTool }                 from './comms.agent';
import { documentsAgentTool, syncFromDriveTool } from './documents.agent';
import { knowledgeAgentTool }             from './knowledge.agent';
import { itAgentTool }                    from './it.agent';
import { cybersecurityAgentTool }         from './cybersecurity.agent';
import { marketingAgentTool }             from './marketing.agent';
import { wildcardAgentTool }              from './wildcard.agent';
import { receptionAgentTool }             from './reception.agent';
import { hrAgentTool }                    from './hr.agent';
import { accountingAgentTool }            from './accounting.agent';
import { salesAgentTool }                 from './sales.agent';
import { supportAgentTool }               from './support.agent';
import { legalAgentTool }                 from './legal.agent';
import { trainingAgentTool }              from './training.agent';
import { newsAgentTool }                  from './news.agent';
import { coachAgentTool }                 from './coach.agent';
import { dataScientistAgentTool }         from './datascientist.agent';
import { approvalAgentTool }             from './approval.agent';
import { websiteAgentTool }              from './website.agent';
import { COMMERCE_TOOLS }                 from './commerce.agent';
import { META_ADS_TOOLS }                 from './metaAds.agent';
// commercialAgentTool is for the PUBLIC landing page chatbot only — NOT for internal use
import {
  getDocumentsTool, readDocumentTool, editDocumentTool,
  getConversationsTool,
  getMeetingsTool,
  getEmployeesTool,
} from './tools/firestoreTools';
import { searchDocumentsTool } from './tools/ragTools';
import { mcpAvailability } from '../config/mcp.config';
import { logger } from '../utils/logger';
import {
  getInstalledMarketplaceAgents,
  callMarketplaceAgentTool,
  buildMarketplaceAgentPrompt,
} from '../services/marketplaceAgentService';
import {
  createAppointmentTool, listAppointmentsTool, deleteAppointmentTool, deleteWorkItemTool, sendWhatsAppMessageTool, sendTelegramMessageTool,
  // marketplaceTools exports `sendEmailTool` but its Genkit registered name is
  // 'sendEmailWithDocs' — alias here so the variable matches what it actually is.
  sendEmailTool as sendEmailWithDocsTool,
  addClientTool, searchClientsTool,
  checkStockTool, updateStockTool,
  createQuoteTool, sendAlertTool, generateReportTool,
} from './tools/marketplaceTools';
// The plain `sendEmail` tool (no PDF attachments) lives in externalTools.
// The orchestrator needs it registered so the LLM can call `sendEmail` directly.
import { sendEmailTool } from './tools/externalTools';
import {
  listTeamChannelsTool, listTeamMembersTool,
  sendTeamChannelMessageTool, sendTeamDirectMessageTool, mentionTeamMemberTool,
  readTeamChannelMessagesTool, createTeamTaskTool, proposeClientReplyTool,
  captureWhatsAppLeadTool, sendWhatsAppProductTool, getTopWhatsAppProductsTool,
} from './tools/teamAgentTools';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role:    'user' | 'model';
  content: string;
}

export interface OrchestratorInput {
  message:     string;
  companyId:   string;
  userId:      string;
  history?:    ChatMessage[];
  language?:   string;
  streamCb?:   (chunk: string) => void;
  /** Channel affects system prompt rules (length, formatting, links). */
  channel?:    'web' | 'whatsapp' | 'telegram' | 'sms' | 'messenger' | 'email' | 'voice' | 'team_channel';
  /** Fast mode: skip AI intent fallback, skip memory load/save, smaller model. For messaging channels. */
  fastReply?:  boolean;
}

export interface OrchestratorOutput {
  reply:        string;
  agentsUsed:   string[];
  toolsCalled:  string[];
  explanation?: ExplainBlock[];
  simulation?:  SimulationResult;
}

// All tools available to the orchestrator
// MCP-backed tools are included dynamically based on availability
const ORCHESTRATOR_TOOLS = [
  // Specialist agents (agent-as-tool)
  qaAgentTool,
  knowledgeAgentTool,
  meetingAgentTool,
  visionAgentTool,
  insightsAgentTool,
  commsAgentTool,
  documentsAgentTool,
  syncFromDriveTool,
  itAgentTool,
  cybersecurityAgentTool,
  marketingAgentTool,
  wildcardAgentTool,
  receptionAgentTool,
  hrAgentTool,
  accountingAgentTool,
  salesAgentTool,
  supportAgentTool,
  legalAgentTool,
  trainingAgentTool,
  newsAgentTool,
  coachAgentTool,
  dataScientistAgentTool,
  approvalAgentTool,
  websiteAgentTool,
  // commercialAgentTool removed — it's for the public landing page, not internal use
  // Direct data tools (lightweight lookups without spawning a full agent)
  getDocumentsTool,
  readDocumentTool,
  editDocumentTool,
  getConversationsTool,
  getMeetingsTool,
  getEmployeesTool,
  searchDocumentsTool,
  // Action tools (CRM, appointments, stock, quotes, alerts, reports)
  createAppointmentTool,
  listAppointmentsTool,
  deleteAppointmentTool,
  deleteWorkItemTool,
  sendWhatsAppMessageTool,
  sendTelegramMessageTool,
  sendEmailTool,            // name: 'sendEmail' — plain emails (from externalTools)
  sendEmailWithDocsTool,    // name: 'sendEmailWithDocs' — emails with PDF attachments
  // Team (in-house Slack-clone) — agents post AND read in channels / DMs / mentions
  listTeamChannelsTool,
  listTeamMembersTool,
  readTeamChannelMessagesTool,
  sendTeamChannelMessageTool,
  sendTeamDirectMessageTool,
  mentionTeamMemberTool,
  createTeamTaskTool,
  proposeClientReplyTool,
  captureWhatsAppLeadTool,
  sendWhatsAppProductTool,
  getTopWhatsAppProductsTool,
  addClientTool,
  searchClientsTool,
  checkStockTool,
  updateStockTool,
  createQuoteTool,
  sendAlertTool,
  generateReportTool,
  // Commerce (Boutique WhatsApp) — list products, place orders, owner ops
  ...COMMERCE_TOOLS,
  // Meta Ads — manage CTW campaigns from chat ("@admin lance une promo X")
  ...META_ADS_TOOLS,
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
import {
  classifyIntentFast, classifyIntentAI, decomposeRequest, executeParallel,
  isAgentAvailable, recordAgentCall, getAgentHealth, getAllAgentHealth,
  createTrace, addTraceStep, persistTrace, RequestContext,
  type ClassifiedIntent, type ExecutionTrace,
} from '../services/ai/orchestratorIntelligence';
import {
  checkAgentAccess, checkActionConfirmation, redactSensitiveData,
  rankAgents, checkHandoff, buildHandoffResponse,
  buildExplanation, formatExplanationFooter, checkBudget, recordBudgetUsage,
  simulateRequest, type SimulationResult, type ExplainBlock,
} from '../services/ai/orchestratorPolicy';
import {
  summarizeConversation, buildCompressedContext, loadUserMemory,
  saveUserMemory, extractUserFacts, buildMemoryContext, persistConversationSummary,
} from '../services/ai/conversationMemory';

// ── Main orchestrator function (PRO) ──────────────────────────────────────────
export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const { message, companyId, userId, history = [], language = 'auto', streamCb, channel = 'web', fastReply = false } = input;
  const startTime = Date.now();

  logger.info(`[Orchestrator] User ${userId} @ company ${companyId} [${channel}${fastReply ? '/fast' : ''}]: "${message.slice(0, 100)}"`);

  // ── 1. INTENT CLASSIFICATION (fast keyword + AI fallback) ────────────────
  const fastIntent = classifyIntentFast(message);
  let intent: ClassifiedIntent = fastIntent;

  // If low confidence, use AI classifier — skipped in fastReply mode to save 300-500ms
  if (!fastReply && fastIntent.confidence < 0.6) {
    const historyText = history.slice(-4).map(h => `${h.role}: ${h.content}`).join('\n');
    intent = await classifyIntentAI(message, historyText);
  }

  logger.info(`[Orchestrator] Intent: ${intent.primaryAgent} (${intent.confidence.toFixed(2)}) — ${intent.reasoning}`);

  // ── 2. EXECUTION TRACING ─────────────────────────────────────────────────
  const trace = createTrace(userId, companyId, message, intent);

  // ── 3. CONVERSATION MEMORY ──────────────────────────────────────────────
  // Skip memory load in fastReply mode — saves 100-200ms (one Firestore round-trip)
  const userMemory = fastReply ? null : await loadUserMemory(companyId, userId);
  const memoryContext = userMemory ? buildMemoryContext(userMemory) : '';

  // Compress history if too long
  const historyForContext = history.map(h => ({ role: h.role, content: h.content }));
  const summary = await summarizeConversation(historyForContext);
  const compressedHistory = buildCompressedContext(summary, historyForContext);

  // Fetch company name for personalized prompt
  let companyName = 'Mon Entreprise';
  try {
    const companyDoc = await getFirestore().collection('companies').doc(companyId).get();
    companyName = (companyDoc.data()?.['name'] as string) || companyName;
  } catch {}
  const SYSTEM_PROMPT = SYSTEM_PROMPT_TEMPLATE.replace('{{COMPANY_NAME}}', companyName);

  // Fetch installed marketplace agents for this company (cached 5 min)
  const marketplaceAgents = await getInstalledMarketplaceAgents(companyId);
  const marketplacePromptSection = buildMarketplaceAgentPrompt(marketplaceAgents);

  // Dynamic tools: static + marketplace
  const dynamicTools = [...ORCHESTRATOR_TOOLS] as typeof ORCHESTRATOR_TOOLS;
  if (marketplaceAgents.length > 0) {
    (dynamicTools as unknown[]).push(callMarketplaceAgentTool);
  }

  // Build conversation history for Genkit (compressed)
  const historyMessages = compressedHistory.map((h) => ({
    role:    (h.role === 'user' ? 'user' : 'model') as 'user' | 'model',
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

  const channelInstructionMap: Record<string, string> = {
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
  const requestContext = new RequestContext();

  // ── HUMAN HANDOFF CHECK ─────────────────────────────────────────────────
  const handoff = checkHandoff(intent, 0, message);
  if (handoff.suggestion && intent.confidence < 0.4) {
    // Very low confidence → return clarification instead of calling agents
    const clarification = buildHandoffResponse(handoff);
    if (streamCb) { for (const w of clarification.split(' ')) { streamCb(w + ' '); await new Promise(r => setTimeout(r, 10)); } }
    return { reply: clarification, agentsUsed: [], toolsCalled: [] };
  }

  // ── Initial generation ────────────────────────────────────────────────────
  // maxTurns lifted from Genkit's default 5 to 15 — a complete "bilan" request
  // legitimately calls 6-10 tools (getDocuments, listMeetings, getStores,
  // getProducts, getEmployees, etc.) and was aborting on the African-tone prompt
  // that asks for cross-module coverage.
  let response = await ai.generate({
    model:    GEMINI_PRO,
    system:   systemWithLang,
    messages: [
      ...historyMessages,
      { role: 'user', content: [{ text: contextualPrompt }] },
    ],
    tools:    dynamicTools,
    maxTurns: 15,
    config:   { temperature: 0.5 },
  });

  // ── Agentic loop: execute tool calls until done ───────────────────────────
  const toolsCalled: string[] = [];
  let loopCount = 0;
  const MAX_LOOPS = 8;

  // Build tool executor map (name → async function)
  const toolExecutors = new Map<string, (input: unknown) => Promise<unknown>>([
    ['askQAAgent',               (i) => qaAgentTool(i as Parameters<typeof qaAgentTool>[0])],
    ['callKnowledgeAgent',       (i) => knowledgeAgentTool(i as Parameters<typeof knowledgeAgentTool>[0])],
    ['analyzeMeeting',           (i) => meetingAgentTool(i as Parameters<typeof meetingAgentTool>[0])],
    ['analyzeImage',             (i) => visionAgentTool(i as Parameters<typeof visionAgentTool>[0])],
    ['generateInsights',         (i) => insightsAgentTool(i as Parameters<typeof insightsAgentTool>[0])],
    ['draftCommunication',       (i) => commsAgentTool(i as Parameters<typeof commsAgentTool>[0])],
    ['processDocument',          (i) => documentsAgentTool(i as Parameters<typeof documentsAgentTool>[0])],
    ['syncDocumentsFromDrive',   (i) => syncFromDriveTool(i as Parameters<typeof syncFromDriveTool>[0])],
    ['getDocuments',             (i) => getDocumentsTool(i as Parameters<typeof getDocumentsTool>[0])],
    ['readDocument',             (i) => readDocumentTool(i as Parameters<typeof readDocumentTool>[0])],
    ['editDocument',             (i) => editDocumentTool(i as Parameters<typeof editDocumentTool>[0])],
    ['getConversations',         (i) => getConversationsTool(i as Parameters<typeof getConversationsTool>[0])],
    ['getMeetings',              (i) => getMeetingsTool(i as Parameters<typeof getMeetingsTool>[0])],
    ['getEmployees',             (i) => getEmployeesTool(i as Parameters<typeof getEmployeesTool>[0])],
    ['searchDocuments',          (i) => searchDocumentsTool(i as Parameters<typeof searchDocumentsTool>[0])],
    ['callITAgent',              (i) => itAgentTool(i as Parameters<typeof itAgentTool>[0])],
    ['callCybersecurityAgent',   (i) => cybersecurityAgentTool(i as Parameters<typeof cybersecurityAgentTool>[0])],
    ['callMarketingAgent',       (i) => marketingAgentTool(i as Parameters<typeof marketingAgentTool>[0])],
    ['callWildcardAgent',        (i) => wildcardAgentTool(i as Parameters<typeof wildcardAgentTool>[0])],
    ['callReceptionAgent',       (i) => receptionAgentTool(i as Parameters<typeof receptionAgentTool>[0])],
    ['callHRAgent',              (i) => hrAgentTool(i as Parameters<typeof hrAgentTool>[0])],
    ['callAccountingAgent',      (i) => accountingAgentTool(i as Parameters<typeof accountingAgentTool>[0])],
    ['callSalesAgent',           (i) => salesAgentTool(i as Parameters<typeof salesAgentTool>[0])],
    ['callSupportAgent',         (i) => supportAgentTool(i as Parameters<typeof supportAgentTool>[0])],
    ['callLegalAgent',           (i) => legalAgentTool(i as Parameters<typeof legalAgentTool>[0])],
    ['callTrainingAgent',        (i) => trainingAgentTool(i as Parameters<typeof trainingAgentTool>[0])],
    ['callNewsAgent',            (i) => newsAgentTool(i as Parameters<typeof newsAgentTool>[0])],
    ['callMarketplaceAgent',    (i) => callMarketplaceAgentTool(i as Parameters<typeof callMarketplaceAgentTool>[0])],
    ['createAppointment',       (i) => createAppointmentTool(i as Parameters<typeof createAppointmentTool>[0])],
    ['deleteAppointment',       (i) => deleteAppointmentTool(i as Parameters<typeof deleteAppointmentTool>[0])],
    ['deleteWorkItem',          (i) => deleteWorkItemTool(i as Parameters<typeof deleteWorkItemTool>[0])],
    ['sendWhatsAppMessage',     (i) => sendWhatsAppMessageTool(i as Parameters<typeof sendWhatsAppMessageTool>[0])],
    ['sendTelegramMessage',     (i) => sendTelegramMessageTool(i as Parameters<typeof sendTelegramMessageTool>[0])],
    ['listTeamChannels',        (i) => listTeamChannelsTool(i as Parameters<typeof listTeamChannelsTool>[0])],
    ['listTeamMembers',         (i) => listTeamMembersTool(i as Parameters<typeof listTeamMembersTool>[0])],
    ['readTeamChannelMessages', (i) => readTeamChannelMessagesTool(i as Parameters<typeof readTeamChannelMessagesTool>[0])],
    ['sendTeamChannelMessage',  (i) => sendTeamChannelMessageTool(i as Parameters<typeof sendTeamChannelMessageTool>[0])],
    ['sendTeamDirectMessage',   (i) => sendTeamDirectMessageTool(i as Parameters<typeof sendTeamDirectMessageTool>[0])],
    ['mentionTeamMember',       (i) => mentionTeamMemberTool(i as Parameters<typeof mentionTeamMemberTool>[0])],
    ['sendEmail',               (i) => sendEmailTool(i as Parameters<typeof sendEmailTool>[0])],
    ['sendEmailWithDocs',       (i) => sendEmailWithDocsTool(i as Parameters<typeof sendEmailWithDocsTool>[0])],
    ['listAppointments',        (i) => listAppointmentsTool(i as Parameters<typeof listAppointmentsTool>[0])],
    ['addClient',               (i) => addClientTool(i as Parameters<typeof addClientTool>[0])],
    ['searchClients',           (i) => searchClientsTool(i as Parameters<typeof searchClientsTool>[0])],
    ['checkStock',              (i) => checkStockTool(i as Parameters<typeof checkStockTool>[0])],
    ['updateStock',             (i) => updateStockTool(i as Parameters<typeof updateStockTool>[0])],
    ['createQuote',             (i) => createQuoteTool(i as Parameters<typeof createQuoteTool>[0])],
    ['sendAlert',               (i) => sendAlertTool(i as Parameters<typeof sendAlertTool>[0])],
    ['generateReport',          (i) => generateReportTool(i as Parameters<typeof generateReportTool>[0])],
  ]);

  while (response.toolRequests.length > 0 && loopCount < MAX_LOOPS) {
    loopCount++;
    const toolNames = response.toolRequests.map((p) => p.toolRequest.name);
    logger.info(`[Orchestrator] Loop ${loopCount}: calling tools [${toolNames.join(', ')}]`);
    toolsCalled.push(...toolNames);

    // ── PARALLEL EXECUTION: run independent tools concurrently ──────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolResults: { name: string; ref: any; output: unknown }[] = [];

    // Prepare all tasks
    const tasks = response.toolRequests.map((part) => {
      const { name, input, ref } = part.toolRequest;
      return { name, ref, input: injectCompanyId(name, (input as Record<string, unknown>) ?? {}, companyId) };
    });

    // Execute in parallel (instead of sequential)
    const parallelResults = await Promise.allSettled(
      tasks.map(async (task) => {
        const start = Date.now();
        const executor = toolExecutors.get(task.name);

        // ── POLICY: role-based access check ──────────────────────────
        const userRole = (await getFirestore().collection('users').doc(userId).get().catch(() => null))?.data?.()?.['role'] as string ?? 'employee';
        const access = checkAgentAccess(userRole, task.name);
        if (!access.allowed) {
          logger.warn(`[Orchestrator] Policy DENIED: ${task.name} for role ${userRole}`);
          addTraceStep(trace, task.name, 0, false, `Access denied: ${access.reason}`);
          return { name: task.name, ref: task.ref, output: { error: access.reason } };
        }

        // ── CIRCUIT BREAKER: skip unhealthy agents ───────────────────
        if (!isAgentAvailable(task.name)) {
          logger.warn(`[Orchestrator] Circuit OPEN for ${task.name} — skipping`);
          addTraceStep(trace, task.name, 0, false, 'Circuit breaker open');
          return { name: task.name, ref: task.ref, output: { error: `Agent ${task.name} temporarily unavailable — retrying later` } };
        }

        try {
          // Inject cross-agent context if available
          const enrichedInput = { ...task.input, _crossAgentContext: requestContext.buildCrossAgentSummary() };
          const output = executor ? await executor(enrichedInput) : { error: `Unknown tool: ${task.name}` };
          const latency = Date.now() - start;

          // ── HEALTH TRACKING ──────────────────────────────────────────
          recordAgentCall(task.name, latency, true);
          addTraceStep(trace, task.name, latency, true);

          // ── BUDGET TRACKING ─────────────────────────────────────────
          recordBudgetUsage(companyId, userId, task.name);

          // ── CROSS-AGENT CONTEXT: save output for next agents ────────
          requestContext.setAgentOutput(task.name, output);

          return { name: task.name, ref: task.ref, output };
        } catch (err) {
          const latency = Date.now() - start;
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.error(`[Orchestrator] Tool ${task.name} failed: ${errMsg}`);

          // ── HEALTH TRACKING (failure) ────────────────────────────────
          recordAgentCall(task.name, latency, false);
          addTraceStep(trace, task.name, latency, false, errMsg);

          return { name: task.name, ref: task.ref, output: { error: `Tool ${task.name} failed: ${errMsg}` } };
        }
      })
    );

    for (const r of parallelResults) {
      if (r.status === 'fulfilled') toolResults.push(r.value);
      else toolResults.push({ name: 'unknown', ref: undefined, output: { error: 'Promise rejected' } });
    }

    response = await ai.generate({
      model:    GEMINI_PRO,
      messages: [
        ...response.messages,
        {
          role:    'tool' as const,
          content: toolResults.map((r) => ({
            toolResponse: { name: r.name, ref: r.ref, output: r.output },
          })),
        },
      ],
      tools:    dynamicTools,
      maxTurns: 15,
      config:   { temperature: 0.5 },
    });
  }

  // ── SENSITIVE DATA REDACTION ──────────────────────────────────────────────
  const rawReply = response.text;
  const { text: reply, redacted } = redactSensitiveData(rawReply);
  if (redacted.length > 0) {
    logger.warn(`[Orchestrator] Redacted ${redacted.length} sensitive fields: ${redacted.join(', ')}`);
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
  persistTrace(trace).catch(() => {});

  // ── 5. SAVE CONVERSATION MEMORY ────────────────────────────────────────────
  // Save summary if generated
  if (summary) {
    // Summary is saved per conversation externally by the controller
  }

  // Extract and save user facts (async, non-blocking)
  extractUserFacts([...historyForContext, { role: 'user', content: message }, { role: 'model', content: reply }])
    .then(async (facts) => {
      if (facts.length > 0) {
        const existing = userMemory?.facts ?? [];
        const merged = [...new Set([...existing, ...facts])].slice(-20); // keep last 20 facts
        const topics = [...new Set([...(userMemory?.lastTopics ?? []), intent.category])].slice(-5);
        await saveUserMemory(companyId, userId, { facts: merged, lastTopics: topics });
      }
    }).catch(() => {});

  // ── 6. BUILD EXPLANATION ────────────────────────────────────────────────
  const explanation = buildExplanation(intent);

  logger.info(`[Orchestrator] Done in ${totalLatency}ms. Intent: ${intent.primaryAgent} (${intent.confidence.toFixed(2)}). Agents: [${agentsUsed.join(', ')}], Tools: ${toolsCalled.length}, Loops: ${loopCount}`);

  return { reply, agentsUsed, toolsCalled: [...new Set(toolsCalled)], explanation };
}

// ── Helper: inject companyId into tool inputs ─────────────────────────────────
function injectCompanyId(
  toolName: string,
  input: Record<string, unknown>,
  companyId: string,
): Record<string, unknown> {
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
const FLOW_INPUT = z.object({
  message:   z.string(),
  companyId: z.string(),
  userId:    z.string(),
  language:  z.string().optional().default('auto'),
  history:   z.array(z.object({
    role:    z.enum(['user', 'model']),
    content: z.string(),
  })).optional().default([]),
  channel:   z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional().default('web'),
  fastReply: z.boolean().optional().default(false),
});

const FLOW_OUTPUT = z.object({
  reply:       z.string(),
  agentsUsed:  z.array(z.string()),
  toolsCalled: z.array(z.string()),
  explanation: z.array(z.object({ type: z.string(), message: z.string(), details: z.string().optional() })).optional(),
});

export const orchestratorFlow = ai.defineFlow(
  { name: 'orchestrator', inputSchema: FLOW_INPUT, outputSchema: FLOW_OUTPUT },
  (input) => runOrchestrator(input)
);
