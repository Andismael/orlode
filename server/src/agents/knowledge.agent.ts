/**
 * Knowledge Agent — The Enterprise Brain
 *
 * Unified: Documents + Q&A + ALL Connectors (Web, DB, Video, Audio, API, E-commerce)
 * + MCP real-time (Google Workspace, Slack, BigQuery, Notion, HubSpot)
 * + Skills: read aloud, correct, analyze, compare, send, generate
 *
 * Pattern: agentic tool loop (Gemini Pro)
 * This is the BRAIN of the company — accesses ALL data sources in one agent.
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH, GEMINI_PRO, TEXT_EMBEDDING_MODEL } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { searchDocumentsTool, summarizeDocumentTool } from './tools/ragTools';
import { getDocumentsTool, readDocumentTool, editDocumentTool } from './tools/firestoreTools';
// Google Workspace MCP
import {
  driveSearchTool, driveDownloadTool, docsReadTool, docsCreateTool,
  sheetsReadTool, gmailSearchTool, gmailReadTool, gmailSendTool,
  calendarListEventsTool, contactsSearchTool,
} from './tools/mcp/googleWorkspace';
// Slack MCP
import { slackSearchTool, slackSendMessageTool, slackListChannelsTool } from './tools/mcp/slack';
// BigQuery MCP
import { bigqueryExecuteQueryTool, bigqueryListTablesTool } from './tools/mcp/bigquery';
import { mcpAvailability } from '../config/mcp.config';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

// ── Schemas ─────────────────────────────────────────────────────────────────

const INPUT = z.object({
  request:   z.string(),
  companyId: z.string(),
  userId:    z.string().optional(),
  language:  z.string().optional().default('auto'),
  history:   z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const OUTPUT = z.object({
  response:   z.string(),
  sources:    z.array(z.object({ documentName: z.string(), excerpt: z.string() })).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  documentId: z.string().optional(),
});

// ── New tool: Prepare text for read-aloud (TTS-optimized) ───────────────────

const prepareReadAloudTool = ai.defineTool(
  {
    name: 'kb_prepareReadAloud',
    description: 'Prepare a document or text for reading aloud. Cleans markdown, expands abbreviations, adds natural pauses. Use when user asks to "read", "lire a haute voix", or "read aloud".',
    inputSchema: z.object({
      companyId: z.string(),
      documentName: z.string().optional().describe('Document name to read aloud'),
      text: z.string().optional().describe('Direct text to prepare (if no documentName)'),
      language: z.string().optional().default('fr'),
    }),
    outputSchema: z.object({
      readyText: z.string().describe('Clean text optimized for speech synthesis'),
      estimatedDuration: z.string().describe('Estimated reading time'),
      documentName: z.string(),
    }),
  },
  async ({ companyId, documentName, text, language }) => {
    let content = text ?? '';
    let docName = documentName ?? 'Texte';

    if (documentName && !text) {
      const result = await readDocumentTool({ companyId, documentName });
      if (!result.found) return { readyText: 'Document non trouvé.', estimatedDuration: '0s', documentName: docName };
      content = result.content;
      docName = result.name;
    }

    // Clean for TTS
    const { text: cleaned } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Prépare ce texte pour être lu à haute voix en ${language}:
- Supprime les balises markdown, URLs, codes
- Remplace les abréviations par les mots complets (ex: "Mr." → "Monsieur", "etc." → "et cetera")
- Ajoute des pauses naturelles (virgules) aux phrases longues
- Convertis les nombres en mots (ex: "123" → "cent vingt-trois")
- Garde le contenu intact, améliore uniquement la lisibilité orale
- Retourne UNIQUEMENT le texte nettoyé

Texte:
${content.slice(0, 10000)}`,
      config: { temperature: 0.1 },
    });

    const wordCount = cleaned.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 150); // ~150 mots/min lecture
    const estimatedDuration = minutes >= 1 ? `${minutes} min` : `${Math.ceil(wordCount / 2.5)}s`;

    return { readyText: cleaned, estimatedDuration, documentName: docName };
  }
);

// ── New tool: Analyze document (deep analysis) ──────────────────────────────

const analyzeDocumentTool = ai.defineTool(
  {
    name: 'kb_analyzeDocument',
    description: 'Deep analysis of a document: structure, sentiment, key findings, strengths/weaknesses, recommendations. Use when user asks for analysis, review, or critique.',
    inputSchema: z.object({
      companyId: z.string(),
      documentName: z.string(),
      analysisType: z.enum(['general', 'legal', 'financial', 'technical', 'marketing', 'hr']).optional().default('general'),
    }),
    outputSchema: z.object({
      documentName: z.string(),
      analysis: z.string(),
      structure: z.array(z.string()),
      sentiment: z.string(),
      keyFindings: z.array(z.string()),
      recommendations: z.array(z.string()),
    }),
  },
  async ({ companyId, documentName, analysisType }) => {
    const result = await readDocumentTool({ companyId, documentName });
    if (!result.found) return {
      documentName, analysis: 'Document non trouvé.', structure: [], sentiment: 'N/A',
      keyFindings: [], recommendations: [],
    };

    const { text } = await ai.generate({
      model: GEMINI_PRO,
      prompt: `Analyse approfondie de type "${analysisType}" pour ce document.
Retourne JSON:
{
  "analysis": "Analyse détaillée en 3-5 paragraphes",
  "structure": ["Section 1", "Section 2", ...],
  "sentiment": "positif/neutre/négatif/mixte",
  "keyFindings": ["Point clé 1", "Point clé 2", ...],
  "recommendations": ["Recommandation 1", ...]
}

Document: ${result.name}
Contenu:
${result.content.slice(0, 12000)}

Retourne UNIQUEMENT le JSON.`,
      config: { temperature: 0.2 },
    });

    try {
      const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
      return { documentName: result.name, ...parsed };
    } catch {
      return {
        documentName: result.name, analysis: text, structure: [], sentiment: 'N/A',
        keyFindings: [], recommendations: [],
      };
    }
  }
);

// ── New tool: Compare documents ─────────────────────────────────────────────

const compareDocumentsTool = ai.defineTool(
  {
    name: 'kb_compareDocuments',
    description: 'Compare two documents — find similarities, differences, contradictions. Use when user asks to compare, contrast, or diff documents.',
    inputSchema: z.object({
      companyId: z.string(),
      documentName1: z.string(),
      documentName2: z.string(),
    }),
    outputSchema: z.object({
      similarities: z.array(z.string()),
      differences: z.array(z.string()),
      contradictions: z.array(z.string()),
      summary: z.string(),
    }),
  },
  async ({ companyId, documentName1, documentName2 }) => {
    const [doc1, doc2] = await Promise.all([
      readDocumentTool({ companyId, documentName: documentName1 }),
      readDocumentTool({ companyId, documentName: documentName2 }),
    ]);

    if (!doc1.found || !doc2.found) {
      return { similarities: [], differences: [], contradictions: [], summary: 'Un ou les deux documents non trouvés.' };
    }

    const { text } = await ai.generate({
      model: GEMINI_PRO,
      prompt: `Compare ces deux documents et retourne JSON:
{
  "similarities": ["Point commun 1", ...],
  "differences": ["Différence 1", ...],
  "contradictions": ["Contradiction 1", ...],
  "summary": "Résumé de la comparaison en 2-3 phrases"
}

Document 1 (${doc1.name}):
${doc1.content.slice(0, 6000)}

Document 2 (${doc2.name}):
${doc2.content.slice(0, 6000)}

Retourne UNIQUEMENT le JSON.`,
      config: { temperature: 0.2 },
    });

    try {
      return JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/,''));
    } catch {
      return { similarities: [], differences: [], contradictions: [], summary: text };
    }
  }
);

// ── New tool: Send document via email ───────────────────────────────────────

const sendDocumentTool = ai.defineTool(
  {
    name: 'kb_sendDocument',
    description: 'Send a document or its summary to someone via email notification. Use when user asks to "envoyer", "partager", "send", "share" a document.',
    inputSchema: z.object({
      companyId: z.string(),
      documentName: z.string(),
      recipientEmail: z.string().optional(),
      recipientName: z.string().optional(),
      sendType: z.enum(['full_text', 'summary', 'key_points']).optional().default('summary'),
      message: z.string().optional().describe('Additional message to include'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async ({ companyId, documentName, recipientEmail, recipientName, sendType, message }) => {
    const doc = await readDocumentTool({ companyId, documentName });
    if (!doc.found) return { success: false, message: 'Document non trouvé.' };

    let contentToSend = '';
    if (sendType === 'full_text') {
      contentToSend = doc.content.slice(0, 5000);
    } else if (sendType === 'key_points') {
      const summary = await summarizeDocumentTool({ documentId: '', companyId, maxChunks: 10 });
      contentToSend = `Points clés:\n${summary.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
    } else {
      contentToSend = doc.summary ?? 'Résumé non disponible.';
    }

    // Save as notification/share in Firestore
    const db = getFirestore();
    await db.collection('documentShares').add({
      companyId,
      documentName: doc.name,
      recipientEmail: recipientEmail ?? '',
      recipientName: recipientName ?? '',
      content: contentToSend,
      message: message ?? '',
      sendType,
      sharedAt: new Date(),
      status: 'sent',
    });

    // If Gmail MCP available, send via Gmail
    if (recipientEmail && mcpAvailability.googleWorkspace) {
      try {
        await gmailSendTool({
          to: recipientEmail,
          subject: `Document partagé : ${doc.name}`,
          body: `${message ?? 'Un document a été partagé avec vous.'}\n\n---\n\n${contentToSend}`,
        });
      } catch { /* Gmail not configured */ }
    }

    return {
      success: true,
      message: `Document "${doc.name}" ${recipientEmail ? `envoyé à ${recipientEmail}` : 'partagé'} (${sendType}).`,
    };
  }
);

// ── New tool: Generate document from conversation ───────────────────────────

const generateDocumentTool = ai.defineTool(
  {
    name: 'kb_generateDocument',
    description: 'Generate a new document from a topic, conversation, or instructions. Use when user asks to "créer un document", "rédiger", "write a report", etc.',
    inputSchema: z.object({
      companyId: z.string(),
      title: z.string(),
      instructions: z.string().describe('What the document should contain'),
      format: z.enum(['report', 'memo', 'email', 'summary', 'analysis', 'proposal', 'general']).optional().default('general'),
      language: z.string().optional().default('fr'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      documentId: z.string(),
      title: z.string(),
      content: z.string(),
      wordCount: z.number(),
    }),
  },
  async ({ companyId, title, instructions, format, language }) => {
    const { text } = await ai.generate({
      model: GEMINI_PRO,
      prompt: `Rédige un document de type "${format}" en ${language}.
Titre: ${title}
Instructions: ${instructions}

Rédige un document professionnel, bien structuré, avec des sections claires.
Ne mets PAS de balises markdown type \`\`\`.`,
      config: { temperature: 0.4 },
    });

    const db = getFirestore();
    const docId = generateId();
    await db.collection('documents').doc(docId).set({
      companyId,
      originalName: title,
      extractedText: text,
      fileType: 'text/generated',
      status: 'completed',
      source: 'ai_generated',
      summary: text.slice(0, 300),
      textLength: text.length,
      uploadedAt: new Date(),
      createdAt: new Date(),
    });

    return {
      success: true,
      documentId: docId,
      title,
      content: text,
      wordCount: text.split(/\s+/).length,
    };
  }
);

// ── New tool: List connected data sources ───────────────────────────────────

const listConnectorsTool = ai.defineTool(
  {
    name: 'kb_listConnectors',
    description: 'List all connected data sources for this company — websites, databases, APIs, e-commerce, video, audio. Shows what knowledge the enterprise brain has access to.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      connectors: z.array(z.object({
        name: z.string(),
        type: z.string(),
        status: z.string(),
        lastSync: z.string().optional(),
        chunks: z.number().optional(),
      })),
      totalChunks: z.number(),
      mcpServices: z.array(z.string()),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/connectors`).get();
    const connectors = snap.docs.map(d => {
      const data = d.data();
      return {
        name: (data['name'] as string) ?? d.id,
        type: (data['type'] as string) ?? 'unknown',
        status: (data['status'] as string) ?? 'unknown',
        lastSync: data['lastSyncAt'] ? new Date(data['lastSyncAt'].toDate?.() ?? data['lastSyncAt']).toISOString() : undefined,
        chunks: (data['lastSyncChunks'] as number) ?? 0,
      };
    });

    // Count total vector chunks
    let totalChunks = 0;
    try {
      const chunksSnap = await db.collection(`companies/${companyId}/vectorChunks`).count().get();
      totalChunks = chunksSnap.data().count;
    } catch { /* */ }

    // List active MCP services
    const mcpServices: string[] = [];
    if (mcpAvailability.googleWorkspace) mcpServices.push('Google Workspace (Drive, Docs, Sheets, Gmail, Calendar)');
    if (mcpAvailability.slack) mcpServices.push('Slack (messages, channels)');
    if (mcpAvailability.bigquery) mcpServices.push('BigQuery (SQL queries)');

    return { connectors, totalChunks, mcpServices };
  }
);

// ── All tools ───────────────────────────────────────────────────────────────

const ALL_TOOLS = [
  // ── RAG (vector search over ALL connector data) ──
  searchDocumentsTool,
  summarizeDocumentTool,
  // ── Firestore (documents CRUD) ──
  getDocumentsTool,
  readDocumentTool,
  editDocumentTool,
  // ── Knowledge skills ──
  listConnectorsTool,
  prepareReadAloudTool,
  analyzeDocumentTool,
  compareDocumentsTool,
  sendDocumentTool,
  generateDocumentTool,
  // ── Google Workspace MCP (Drive, Docs, Sheets, Gmail, Calendar, Contacts) ──
  ...(mcpAvailability.googleWorkspace ? [
    driveSearchTool, docsReadTool, docsCreateTool, sheetsReadTool,
    gmailSearchTool, gmailReadTool, gmailSendTool,
    calendarListEventsTool, contactsSearchTool,
  ] : []),
  // ── Slack MCP ──
  ...(mcpAvailability.slack ? [slackSearchTool, slackSendMessageTool, slackListChannelsTool] : []),
  // ── BigQuery MCP ──
  ...(mcpAvailability.bigquery ? [bigqueryExecuteQueryTool, bigqueryListTablesTool] : []),
];

const TOOL_EXECUTORS = new Map<string, (i: unknown) => Promise<unknown>>([
  // RAG + Documents
  ['searchDocuments',     (i) => searchDocumentsTool(i as Parameters<typeof searchDocumentsTool>[0])],
  ['summarizeDocument',   (i) => summarizeDocumentTool(i as Parameters<typeof summarizeDocumentTool>[0])],
  ['getDocuments',        (i) => getDocumentsTool(i as Parameters<typeof getDocumentsTool>[0])],
  ['readDocument',        (i) => readDocumentTool(i as Parameters<typeof readDocumentTool>[0])],
  ['editDocument',        (i) => editDocumentTool(i as Parameters<typeof editDocumentTool>[0])],
  // Knowledge skills
  ['kb_listConnectors',   (i) => listConnectorsTool(i as Parameters<typeof listConnectorsTool>[0])],
  ['kb_prepareReadAloud', (i) => prepareReadAloudTool(i as Parameters<typeof prepareReadAloudTool>[0])],
  ['kb_analyzeDocument',  (i) => analyzeDocumentTool(i as Parameters<typeof analyzeDocumentTool>[0])],
  ['kb_compareDocuments', (i) => compareDocumentsTool(i as Parameters<typeof compareDocumentsTool>[0])],
  ['kb_sendDocument',     (i) => sendDocumentTool(i as Parameters<typeof sendDocumentTool>[0])],
  ['kb_generateDocument', (i) => generateDocumentTool(i as Parameters<typeof generateDocumentTool>[0])],
  // Google Workspace
  ['drive_search',        (i) => driveSearchTool(i as Parameters<typeof driveSearchTool>[0])],
  ['docs_read',           (i) => docsReadTool(i as Parameters<typeof docsReadTool>[0])],
  ['docs_create',         (i) => docsCreateTool(i as Parameters<typeof docsCreateTool>[0])],
  ['sheets_read',         (i) => sheetsReadTool(i as Parameters<typeof sheetsReadTool>[0])],
  ['gmail_search',        (i) => gmailSearchTool(i as Parameters<typeof gmailSearchTool>[0])],
  ['gmail_read',          (i) => gmailReadTool(i as Parameters<typeof gmailReadTool>[0])],
  ['gmail_send',          (i) => gmailSendTool(i as Parameters<typeof gmailSendTool>[0])],
  ['calendar_list_events',(i) => calendarListEventsTool(i as Parameters<typeof calendarListEventsTool>[0])],
  ['contacts_search',     (i) => contactsSearchTool(i as Parameters<typeof contactsSearchTool>[0])],
  // Slack
  ['slack_search',        (i) => slackSearchTool(i as Parameters<typeof slackSearchTool>[0])],
  ['slack_send_message',  (i) => slackSendMessageTool(i as Parameters<typeof slackSendMessageTool>[0])],
  ['slack_list_channels', (i) => slackListChannelsTool(i as Parameters<typeof slackListChannelsTool>[0])],
  // BigQuery
  ['bigquery_execute_query', (i) => bigqueryExecuteQueryTool(i as Parameters<typeof bigqueryExecuteQueryTool>[0])],
  ['bigquery_list_tables',   (i) => bigqueryListTablesTool(i as Parameters<typeof bigqueryListTablesTool>[0])],
]);

// ── The unified flow ────────────────────────────────────────────────────────

export const knowledgeAgentFlow = ai.defineFlow(
  { name: 'knowledgeAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    logger.info(`[KnowledgeAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Reponds dans la meme langue que la demande.' : `Reponds en ${language}.`;

    // Date anchors — citations / "rapport de la semaine" need real dates
    const dateAnchors = (() => {
      const now = new Date();
      const months = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
      return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();

    // Fetch company name + custom agent name
    const db2 = getFirestore();
    let agentName = 'Knowledge';
    let companyName = 'l\'entreprise';
    try {
      const companyDoc = await db2.collection('companies').doc(companyId).get();
      if (companyDoc.exists) {
        const cd = companyDoc.data()!;
        companyName = (cd['name'] as string) ?? companyName;
        agentName = (cd['settings'] as Record<string, unknown>)?.['knowledgeAgentName'] as string
          ?? `${companyName} AI`;
      }
    } catch { /* */ }

    const mcpNote = mcpAvailability.googleWorkspace
      ? '\n- Tu peux aussi chercher dans Google Drive (drive_search), lire des Google Docs (docs_read) et des Sheets (sheets_read).'
      : '';

    // Build messages with prior history (max 20)
    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: request }] });

    let response = await ai.generate({
      model: GEMINI_PRO,
      system: `Tu es "${agentName}" — le CERVEAU de ${companyName}.

## 📅 CONTEXTE TEMPOREL (ne jamais inventer de dates)
${dateAnchors}
Pour resumes, citations, rapports periodiques, utilise STRICTEMENT cette date d'aujourd'hui — ne fabrique pas de dates passees.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages precedents. Quand l'utilisateur dit "ce document", "ce passage", "lui", "elle", "le rapport", reference-toi a l'element le plus recent dans l'historique. Ne refais PAS la recherche de zero si l'utilisateur enchaine sur le meme document.

## 🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
Tu ne DOIS JAMAIS inventer de citations, de chiffres, de noms de documents.
INTERDIT :
- Citer un document que tu n'as pas vu via searchDocuments / readDocument
- Inventer un extrait, une page, une section
- Pretendre avoir envoye / partage un document si tu n'as pas appele le tool correspondant

RÈGLE : si searchDocuments ne retourne rien, dis "Je n'ai pas trouve d'info sur X dans la base documentaire". Si l'info existe ailleurs (Google Drive, Slack), essaie ces sources avant de conclure. Cite TOUJOURS la source exacte avec le nom du document.

Tu as acces a TOUTES les sources de donnees de l'entreprise, connectees via la page Connecteurs:

══════════════════════════════════════
1. BASE DOCUMENTAIRE (Vector Search)
══════════════════════════════════════
Toutes les donnees indexees par les connecteurs sont accessibles via searchDocuments:
- Documents uploades (PDF, Word, Excel, CSV, images)
- Pages web crawlees (sites entreprise, concurrents)
- Bases de donnees connectees (MySQL, PostgreSQL, MongoDB)
- Transcriptions video (YouTube, presentations, formations)
- Transcriptions audio (podcasts, appels, reunions)
- Donnees API custom (REST endpoints)
- Produits e-commerce (Shopify, WooCommerce)

Outils: searchDocuments, summarizeDocument, getDocuments, readDocument

══════════════════════════════════════
2. GOOGLE WORKSPACE (Temps reel)
══════════════════════════════════════
${mcpAvailability.googleWorkspace ? `ACTIF — Tu peux:
- Chercher dans Google Drive (drive_search)
- Lire des Google Docs (docs_read) et Sheets (sheets_read)
- Creer des documents (docs_create)
- Chercher des emails Gmail (gmail_search, gmail_read)
- Envoyer des emails (gmail_send)
- Voir le calendrier (calendar_list_events)
- Chercher des contacts (contacts_search)` : 'NON CONFIGURE — Google Workspace MCP non connecte.'}

══════════════════════════════════════
3. SLACK (Temps reel)
══════════════════════════════════════
${mcpAvailability.slack ? `ACTIF — Tu peux:
- Chercher dans les messages Slack (slack_search)
- Envoyer des messages (slack_send_message)
- Lister les channels (slack_list_channels)` : 'NON CONFIGURE — Slack MCP non connecte.'}

══════════════════════════════════════
4. BIGQUERY (Donnees structurees)
══════════════════════════════════════
${mcpAvailability.bigquery ? `ACTIF — Tu peux:
- Executer des requetes SQL (bigquery_execute_query)
- Lister les tables (bigquery_list_tables)` : 'NON CONFIGURE — BigQuery MCP non connecte.'}

══════════════════════════════════════
5. GESTION DOCUMENTAIRE
══════════════════════════════════════
- Corriger, reecrire, traduire (editDocument)
- Generer de nouveaux documents: rapports, memos, emails (kb_generateDocument)
- Analyser: structure, sentiment, recommandations (kb_analyzeDocument)
- Comparer deux documents (kb_compareDocuments)

══════════════════════════════════════
6. LECTURE & PARTAGE
══════════════════════════════════════
- Lecture a haute voix: nettoie pour TTS (kb_prepareReadAloud)
- Envoyer/partager par email (kb_sendDocument)
${mcpAvailability.slack ? '- Partager sur Slack (slack_send_message)' : ''}
${mcpAvailability.googleWorkspace ? '- Envoyer par Gmail (gmail_send)' : ''}

══════════════════════════════════════
REGLES IMPORTANTES
══════════════════════════════════════
- Pour TOUTE question, commence par searchDocuments pour trouver l'info dans les donnees indexees
- Si pas trouve en RAG, essaie les sources temps reel (Drive, Slack, BigQuery) si disponibles
- TOUJOURS citer tes sources
- Si l'info n'existe nulle part, dis-le honnetement
- Pour la lecture vocale, utilise kb_prepareReadAloud
- Pour les corrections, utilise editDocument avec l'action appropriee
- Tu es le point central de TOUTE la connaissance de l'entreprise

CompanyID: ${companyId}.
${langInstr}`,
      messages,
      tools: ALL_TOOLS,
      config: { temperature: 0.3 },
    });

    // Agentic loop
    let loopCount = 0;
    const sources: Array<{ documentName: string; excerpt: string }> = [];

    while (response.toolRequests.length > 0 && loopCount < 8) {
      loopCount++;
      const toolResults = await Promise.all(
        response.toolRequests.map(async (p) => {
          const { name, input, ref } = p.toolRequest;
          const exec = TOOL_EXECUTORS.get(name);
          const inp = { ...(input as Record<string, unknown>), companyId };
          let output: unknown;
          try {
            output = exec ? await exec(inp) : { error: `Outil inconnu: ${name}` };
          } catch (err) {
            output = { error: String(err) };
          }

          // Collect sources from search results
          if (name === 'searchDocuments') {
            const out = output as { chunks?: Array<{ documentName: string; text: string }> };
            (out?.chunks ?? []).slice(0, 3).forEach((chunk) => {
              if (!sources.find((s) => s.documentName === chunk.documentName)) {
                sources.push({ documentName: chunk.documentName, excerpt: chunk.text.slice(0, 200) });
              }
            });
          }

          return { name, ref, output };
        })
      );

      response = await ai.generate({
        model: GEMINI_PRO,
        messages: [
          ...response.messages,
          { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
        ],
        tools: ALL_TOOLS,
        config: { temperature: 0.3 },
      });
    }

    const text = response.text;
    const confidence = sources.length >= 3 ? 'high' : sources.length >= 1 ? 'medium' : 'low';

    return { response: text, sources, confidence };
  }
);

// ── Expose as tool for Orchestrator ─────────────────────────────────────────

export const knowledgeAgentTool = ai.defineTool(
  {
    name: 'callKnowledgeAgent',
    description: 'The Enterprise Brain — unified knowledge agent. Searches ALL data sources: uploaded documents, crawled websites, databases, videos, audio, APIs, e-commerce + real-time Google Drive, Gmail, Slack, BigQuery. Skills: Q&A with sources, read aloud (TTS), correct/edit, analyze, compare, summarize, generate docs, send via email/Slack. Use for ANY knowledge or document question.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
  },
  (input) => knowledgeAgentFlow(input)
);

// ── Re-export document processing (kept for upload pipeline) ────────────────
// The document ingestion pipeline stays separate as it's called by the upload controller
export { documentsAgentFlow, documentsAgentTool, syncFromDriveTool } from './documents.agent';
