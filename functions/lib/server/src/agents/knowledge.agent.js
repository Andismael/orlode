"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncFromDriveTool = exports.documentsAgentTool = exports.documentsAgentFlow = exports.knowledgeAgentTool = exports.knowledgeAgentFlow = void 0;
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
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const ragTools_1 = require("./tools/ragTools");
const firestoreTools_1 = require("./tools/firestoreTools");
// Google Workspace MCP
const googleWorkspace_1 = require("./tools/mcp/googleWorkspace");
// Slack MCP
const slack_1 = require("./tools/mcp/slack");
// BigQuery MCP
const bigquery_1 = require("./tools/mcp/bigquery");
const mcp_config_1 = require("../config/mcp.config");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
// ── Schemas ─────────────────────────────────────────────────────────────────
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({
    response: zod_1.z.string(),
    sources: zod_1.z.array(zod_1.z.object({ documentName: zod_1.z.string(), excerpt: zod_1.z.string() })).optional(),
    confidence: zod_1.z.enum(['high', 'medium', 'low']).optional(),
    documentId: zod_1.z.string().optional(),
});
// ── New tool: Prepare text for read-aloud (TTS-optimized) ───────────────────
const prepareReadAloudTool = genkit_config_1.ai.defineTool({
    name: 'kb_prepareReadAloud',
    description: 'Prepare a document or text for reading aloud. Cleans markdown, expands abbreviations, adds natural pauses. Use when user asks to "read", "lire a haute voix", or "read aloud".',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        documentName: zod_1.z.string().optional().describe('Document name to read aloud'),
        text: zod_1.z.string().optional().describe('Direct text to prepare (if no documentName)'),
        language: zod_1.z.string().optional().default('fr'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        readyText: zod_1.z.string().describe('Clean text optimized for speech synthesis'),
        estimatedDuration: zod_1.z.string().describe('Estimated reading time'),
        documentName: zod_1.z.string(),
    }),
}, async ({ companyId, documentName, text, language }) => {
    let content = text ?? '';
    let docName = documentName ?? 'Texte';
    if (documentName && !text) {
        try {
            const result = await (0, firestoreTools_1.readDocumentTool)({ companyId, documentName });
            if (!result.found)
                return { success: false, message: 'Document non trouvé.', readyText: 'Document non trouvé.', estimatedDuration: '0s', documentName: docName };
            content = result.content;
            docName = result.name;
        }
        catch (err) {
            logger_1.logger.error('[Knowledge] readDocument failed', { error: String(err) });
            return { success: false, message: `Lecture du document impossible: ${err instanceof Error ? err.message : String(err)}`, readyText: '', estimatedDuration: '0s', documentName: docName };
        }
    }
    // Clean for TTS
    let cleaned;
    try {
        const result = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
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
        cleaned = result.text;
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] TTS preparation failed', { error: String(err) });
        return { success: false, message: `Préparation TTS impossible: ${err instanceof Error ? err.message : String(err)}`, readyText: content, estimatedDuration: '0s', documentName: docName };
    }
    const wordCount = cleaned.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 150); // ~150 mots/min lecture
    const estimatedDuration = minutes >= 1 ? `${minutes} min` : `${Math.ceil(wordCount / 2.5)}s`;
    return { success: true, readyText: cleaned, estimatedDuration, documentName: docName };
});
// ── New tool: Analyze document (deep analysis) ──────────────────────────────
const analyzeDocumentTool = genkit_config_1.ai.defineTool({
    name: 'kb_analyzeDocument',
    description: 'Deep analysis of a document: structure, sentiment, key findings, strengths/weaknesses, recommendations. Use when user asks for analysis, review, or critique.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        documentName: zod_1.z.string(),
        analysisType: zod_1.z.enum(['general', 'legal', 'financial', 'technical', 'marketing', 'hr']).optional().default('general'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        documentName: zod_1.z.string(),
        analysis: zod_1.z.string(),
        structure: zod_1.z.array(zod_1.z.string()),
        sentiment: zod_1.z.string(),
        keyFindings: zod_1.z.array(zod_1.z.string()),
        recommendations: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId, documentName, analysisType }) => {
    let result;
    try {
        result = await (0, firestoreTools_1.readDocumentTool)({ companyId, documentName });
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] readDocument failed', { error: String(err) });
        return {
            success: false, message: `Lecture du document impossible: ${err instanceof Error ? err.message : String(err)}`,
            documentName, analysis: 'Erreur de lecture.', structure: [], sentiment: 'N/A',
            keyFindings: [], recommendations: [],
        };
    }
    if (!result.found)
        return {
            success: false, message: 'Document non trouvé.',
            documentName, analysis: 'Document non trouvé.', structure: [], sentiment: 'N/A',
            keyFindings: [], recommendations: [],
        };
    let text;
    try {
        const r = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_PRO,
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
        text = r.text;
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] analyze generation failed', { error: String(err) });
        return {
            success: false, message: `Analyse impossible: ${err instanceof Error ? err.message : String(err)}`,
            documentName: result.name, analysis: '', structure: [], sentiment: 'N/A',
            keyFindings: [], recommendations: [],
        };
    }
    try {
        const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        return { success: true, documentName: result.name, ...parsed };
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] analyze JSON parse failed', { error: String(err) });
        return {
            success: true,
            documentName: result.name, analysis: text, structure: [], sentiment: 'N/A',
            keyFindings: [], recommendations: [],
        };
    }
});
// ── New tool: Compare documents ─────────────────────────────────────────────
const compareDocumentsTool = genkit_config_1.ai.defineTool({
    name: 'kb_compareDocuments',
    description: 'Compare two documents — find similarities, differences, contradictions. Use when user asks to compare, contrast, or diff documents.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        documentName1: zod_1.z.string(),
        documentName2: zod_1.z.string(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        similarities: zod_1.z.array(zod_1.z.string()),
        differences: zod_1.z.array(zod_1.z.string()),
        contradictions: zod_1.z.array(zod_1.z.string()),
        summary: zod_1.z.string(),
    }),
}, async ({ companyId, documentName1, documentName2 }) => {
    let doc1, doc2;
    try {
        [doc1, doc2] = await Promise.all([
            (0, firestoreTools_1.readDocumentTool)({ companyId, documentName: documentName1 }),
            (0, firestoreTools_1.readDocumentTool)({ companyId, documentName: documentName2 }),
        ]);
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] readDocument compare failed', { error: String(err) });
        return { success: false, message: `Lecture des documents impossible: ${err instanceof Error ? err.message : String(err)}`, similarities: [], differences: [], contradictions: [], summary: '' };
    }
    if (!doc1.found || !doc2.found) {
        return { success: false, message: 'Un ou les deux documents non trouvés.', similarities: [], differences: [], contradictions: [], summary: 'Un ou les deux documents non trouvés.' };
    }
    let text;
    try {
        const r = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_PRO,
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
        text = r.text;
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] compare generation failed', { error: String(err) });
        return { success: false, message: `Comparaison impossible: ${err instanceof Error ? err.message : String(err)}`, similarities: [], differences: [], contradictions: [], summary: '' };
    }
    try {
        const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        return { success: true, ...parsed };
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] compare JSON parse failed', { error: String(err) });
        return { success: true, similarities: [], differences: [], contradictions: [], summary: text };
    }
});
// ── New tool: Send document via email ───────────────────────────────────────
const sendDocumentTool = genkit_config_1.ai.defineTool({
    name: 'kb_sendDocument',
    description: 'Send a document or its summary to someone via email notification. Use when user asks to "envoyer", "partager", "send", "share" a document.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        documentName: zod_1.z.string(),
        recipientEmail: zod_1.z.string().optional(),
        recipientName: zod_1.z.string().optional(),
        sendType: zod_1.z.enum(['full_text', 'summary', 'key_points']).optional().default('summary'),
        message: zod_1.z.string().optional().describe('Additional message to include'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, documentName, recipientEmail, recipientName, sendType, message }) => {
    let doc;
    try {
        doc = await (0, firestoreTools_1.readDocumentTool)({ companyId, documentName });
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] readDocument send failed', { error: String(err) });
        return { success: false, message: `Lecture du document impossible: ${err instanceof Error ? err.message : String(err)}` };
    }
    if (!doc.found)
        return { success: false, message: 'Document non trouvé.' };
    let contentToSend = '';
    if (sendType === 'full_text') {
        contentToSend = doc.content.slice(0, 5000);
    }
    else if (sendType === 'key_points') {
        try {
            const summary = await (0, ragTools_1.summarizeDocumentTool)({ documentId: '', companyId, maxChunks: 10 });
            contentToSend = `Points clés:\n${summary.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
        }
        catch (err) {
            logger_1.logger.error('[Knowledge] summarize failed', { error: String(err) });
            contentToSend = doc.summary ?? 'Résumé non disponible.';
        }
    }
    else {
        contentToSend = doc.summary ?? 'Résumé non disponible.';
    }
    // Save as notification/share in Firestore
    try {
        const db = (0, firebase_config_1.getFirestore)();
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
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] documentShares write failed', { error: String(err) });
        return { success: false, message: 'Sauvegarde du partage impossible.' };
    }
    // If Gmail MCP available, send via Gmail
    if (recipientEmail && mcp_config_1.mcpAvailability.googleWorkspace) {
        try {
            await (0, googleWorkspace_1.gmailSendTool)({
                to: recipientEmail,
                subject: `Document partagé : ${doc.name}`,
                body: `${message ?? 'Un document a été partagé avec vous.'}\n\n---\n\n${contentToSend}`,
            });
        }
        catch (err) {
            logger_1.logger.warn('[Knowledge] Gmail send failed (non-blocking)', { error: String(err) });
        }
    }
    return {
        success: true,
        message: `Document "${doc.name}" ${recipientEmail ? `envoyé à ${recipientEmail}` : 'partagé'} (${sendType}).`,
    };
});
// ── New tool: Generate document from conversation ───────────────────────────
const generateDocumentTool = genkit_config_1.ai.defineTool({
    name: 'kb_generateDocument',
    description: 'Generate a new document from a topic, conversation, or instructions. Use when user asks to "créer un document", "rédiger", "write a report", etc.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        title: zod_1.z.string(),
        instructions: zod_1.z.string().describe('What the document should contain'),
        format: zod_1.z.enum(['report', 'memo', 'email', 'summary', 'analysis', 'proposal', 'general']).optional().default('general'),
        language: zod_1.z.string().optional().default('fr'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        documentId: zod_1.z.string(),
        title: zod_1.z.string(),
        content: zod_1.z.string(),
        wordCount: zod_1.z.number(),
    }),
}, async ({ companyId, title, instructions, format, language }) => {
    let text;
    try {
        const r = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_PRO,
            prompt: `Rédige un document de type "${format}" en ${language}.
Titre: ${title}
Instructions: ${instructions}

Rédige un document professionnel, bien structuré, avec des sections claires.
Ne mets PAS de balises markdown type \`\`\`.`,
            config: { temperature: 0.4 },
        });
        text = r.text;
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] document generation failed', { error: String(err) });
        return {
            success: false,
            message: `Génération du document impossible: ${err instanceof Error ? err.message : String(err)}`,
            documentId: '', title, content: '', wordCount: 0,
        };
    }
    const docId = (0, helpers_1.generateId)();
    try {
        const db = (0, firebase_config_1.getFirestore)();
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
    }
    catch (err) {
        logger_1.logger.error('[Knowledge] documents write failed', { error: String(err) });
        return {
            success: false,
            message: 'Sauvegarde impossible.',
            documentId: '', title, content: text, wordCount: text.split(/\s+/).length,
        };
    }
    return {
        success: true,
        documentId: docId,
        title,
        content: text,
        wordCount: text.split(/\s+/).length,
    };
});
// ── New tool: List connected data sources ───────────────────────────────────
const listConnectorsTool = genkit_config_1.ai.defineTool({
    name: 'kb_listConnectors',
    description: 'List all connected data sources for this company — websites, databases, APIs, e-commerce, video, audio. Shows what knowledge the enterprise brain has access to.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        connectors: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            type: zod_1.z.string(),
            status: zod_1.z.string(),
            lastSync: zod_1.z.string().optional(),
            chunks: zod_1.z.number().optional(),
        })),
        totalChunks: zod_1.z.number(),
        mcpServices: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/connectors`).get().catch((err) => {
        logger_1.logger.error('[Knowledge] connectors read failed', { error: String(err) });
        return null;
    });
    const connectors = (snap?.docs ?? []).map(d => {
        const data = d.data();
        return {
            name: data['name'] ?? d.id,
            type: data['type'] ?? 'unknown',
            status: data['status'] ?? 'unknown',
            lastSync: data['lastSyncAt'] ? new Date(data['lastSyncAt'].toDate?.() ?? data['lastSyncAt']).toISOString() : undefined,
            chunks: data['lastSyncChunks'] ?? 0,
        };
    });
    // Count total vector chunks
    let totalChunks = 0;
    try {
        const chunksSnap = await db.collection(`companies/${companyId}/vectorChunks`).count().get();
        totalChunks = chunksSnap.data().count;
    }
    catch (err) {
        logger_1.logger.warn('[Knowledge] vectorChunks count failed (non-blocking)', { error: String(err) });
    }
    // List active MCP services
    const mcpServices = [];
    if (mcp_config_1.mcpAvailability.googleWorkspace)
        mcpServices.push('Google Workspace (Drive, Docs, Sheets, Gmail, Calendar)');
    if (mcp_config_1.mcpAvailability.slack)
        mcpServices.push('Slack (messages, channels)');
    if (mcp_config_1.mcpAvailability.bigquery)
        mcpServices.push('BigQuery (SQL queries)');
    return { success: true, connectors, totalChunks, mcpServices };
});
// ── All tools ───────────────────────────────────────────────────────────────
const ALL_TOOLS = [
    // ── RAG (vector search over ALL connector data) ──
    ragTools_1.searchDocumentsTool,
    ragTools_1.summarizeDocumentTool,
    // ── Firestore (documents CRUD) ──
    firestoreTools_1.getDocumentsTool,
    firestoreTools_1.readDocumentTool,
    firestoreTools_1.editDocumentTool,
    // ── Knowledge skills ──
    listConnectorsTool,
    prepareReadAloudTool,
    analyzeDocumentTool,
    compareDocumentsTool,
    sendDocumentTool,
    generateDocumentTool,
    // ── Google Workspace MCP (Drive, Docs, Sheets, Gmail, Calendar, Contacts) ──
    ...(mcp_config_1.mcpAvailability.googleWorkspace ? [
        googleWorkspace_1.driveSearchTool, googleWorkspace_1.docsReadTool, googleWorkspace_1.docsCreateTool, googleWorkspace_1.sheetsReadTool,
        googleWorkspace_1.gmailSearchTool, googleWorkspace_1.gmailReadTool, googleWorkspace_1.gmailSendTool,
        googleWorkspace_1.calendarListEventsTool, googleWorkspace_1.contactsSearchTool,
    ] : []),
    // ── Slack MCP ──
    ...(mcp_config_1.mcpAvailability.slack ? [slack_1.slackSearchTool, slack_1.slackSendMessageTool, slack_1.slackListChannelsTool] : []),
    // ── BigQuery MCP ──
    ...(mcp_config_1.mcpAvailability.bigquery ? [bigquery_1.bigqueryExecuteQueryTool, bigquery_1.bigqueryListTablesTool] : []),
];
const TOOL_EXECUTORS = new Map([
    // RAG + Documents
    ['searchDocuments', (i) => (0, ragTools_1.searchDocumentsTool)(i)],
    ['summarizeDocument', (i) => (0, ragTools_1.summarizeDocumentTool)(i)],
    ['getDocuments', (i) => (0, firestoreTools_1.getDocumentsTool)(i)],
    ['readDocument', (i) => (0, firestoreTools_1.readDocumentTool)(i)],
    ['editDocument', (i) => (0, firestoreTools_1.editDocumentTool)(i)],
    // Knowledge skills
    ['kb_listConnectors', (i) => listConnectorsTool(i)],
    ['kb_prepareReadAloud', (i) => prepareReadAloudTool(i)],
    ['kb_analyzeDocument', (i) => analyzeDocumentTool(i)],
    ['kb_compareDocuments', (i) => compareDocumentsTool(i)],
    ['kb_sendDocument', (i) => sendDocumentTool(i)],
    ['kb_generateDocument', (i) => generateDocumentTool(i)],
    // Google Workspace
    ['drive_search', (i) => (0, googleWorkspace_1.driveSearchTool)(i)],
    ['docs_read', (i) => (0, googleWorkspace_1.docsReadTool)(i)],
    ['docs_create', (i) => (0, googleWorkspace_1.docsCreateTool)(i)],
    ['sheets_read', (i) => (0, googleWorkspace_1.sheetsReadTool)(i)],
    ['gmail_search', (i) => (0, googleWorkspace_1.gmailSearchTool)(i)],
    ['gmail_read', (i) => (0, googleWorkspace_1.gmailReadTool)(i)],
    ['gmail_send', (i) => (0, googleWorkspace_1.gmailSendTool)(i)],
    ['calendar_list_events', (i) => (0, googleWorkspace_1.calendarListEventsTool)(i)],
    ['contacts_search', (i) => (0, googleWorkspace_1.contactsSearchTool)(i)],
    // Slack
    ['slack_search', (i) => (0, slack_1.slackSearchTool)(i)],
    ['slack_send_message', (i) => (0, slack_1.slackSendMessageTool)(i)],
    ['slack_list_channels', (i) => (0, slack_1.slackListChannelsTool)(i)],
    // BigQuery
    ['bigquery_execute_query', (i) => (0, bigquery_1.bigqueryExecuteQueryTool)(i)],
    ['bigquery_list_tables', (i) => (0, bigquery_1.bigqueryListTablesTool)(i)],
]);
// ── The unified flow ────────────────────────────────────────────────────────
exports.knowledgeAgentFlow = genkit_config_1.ai.defineFlow({ name: 'knowledgeAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, language, history }) => {
    logger_1.logger.info(`[KnowledgeAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Reponds dans la meme langue que la demande.' : `Reponds en ${language}.`;
    // Date anchors — citations / "rapport de la semaine" need real dates
    const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();
    // Fetch company name + custom agent name
    const db2 = (0, firebase_config_1.getFirestore)();
    let agentName = 'Knowledge';
    let companyName = 'l\'entreprise';
    try {
        const companyDoc = await db2.collection('companies').doc(companyId).get();
        if (companyDoc.exists) {
            const cd = companyDoc.data();
            companyName = cd['name'] ?? companyName;
            agentName = cd['settings']?.['knowledgeAgentName']
                ?? `${companyName} AI`;
        }
    }
    catch { /* */ }
    const mcpNote = mcp_config_1.mcpAvailability.googleWorkspace
        ? '\n- Tu peux aussi chercher dans Google Drive (drive_search), lire des Google Docs (docs_read) et des Sheets (sheets_read).'
        : '';
    // Build messages with prior history (max 20)
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20))
            messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: request }] });
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_PRO,
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
${mcp_config_1.mcpAvailability.googleWorkspace ? `ACTIF — Tu peux:
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
${mcp_config_1.mcpAvailability.slack ? `ACTIF — Tu peux:
- Chercher dans les messages Slack (slack_search)
- Envoyer des messages (slack_send_message)
- Lister les channels (slack_list_channels)` : 'NON CONFIGURE — Slack MCP non connecte.'}

══════════════════════════════════════
4. BIGQUERY (Donnees structurees)
══════════════════════════════════════
${mcp_config_1.mcpAvailability.bigquery ? `ACTIF — Tu peux:
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
${mcp_config_1.mcpAvailability.slack ? '- Partager sur Slack (slack_send_message)' : ''}
${mcp_config_1.mcpAvailability.googleWorkspace ? '- Envoyer par Gmail (gmail_send)' : ''}

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
    const sources = [];
    while (response.toolRequests.length > 0 && loopCount < 8) {
        loopCount++;
        const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            const exec = TOOL_EXECUTORS.get(name);
            const inp = { ...input, companyId };
            let output;
            try {
                output = exec ? await exec(inp) : { error: `Outil inconnu: ${name}` };
            }
            catch (err) {
                output = { error: String(err) };
            }
            // Collect sources from search results
            if (name === 'searchDocuments') {
                const out = output;
                (out?.chunks ?? []).slice(0, 3).forEach((chunk) => {
                    if (!sources.find((s) => s.documentName === chunk.documentName)) {
                        sources.push({ documentName: chunk.documentName, excerpt: chunk.text.slice(0, 200) });
                    }
                });
            }
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_PRO,
            messages: [
                ...response.messages,
                { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
            ],
            tools: ALL_TOOLS,
            config: { temperature: 0.3 },
        });
    }
    const text = response.text;
    const confidence = sources.length >= 3 ? 'high' : sources.length >= 1 ? 'medium' : 'low';
    return { response: text, sources, confidence };
});
// ── Expose as tool for Orchestrator ─────────────────────────────────────────
exports.knowledgeAgentTool = genkit_config_1.ai.defineTool({
    name: 'callKnowledgeAgent',
    description: 'The Enterprise Brain — unified knowledge agent. Searches ALL data sources: uploaded documents, crawled websites, databases, videos, audio, APIs, e-commerce + real-time Google Drive, Gmail, Slack, BigQuery. Skills: Q&A with sources, read aloud (TTS), correct/edit, analyze, compare, summarize, generate docs, send via email/Slack. Use for ANY knowledge or document question.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, (input) => (0, exports.knowledgeAgentFlow)(input));
// ── Re-export document processing (kept for upload pipeline) ────────────────
// The document ingestion pipeline stays separate as it's called by the upload controller
var documents_agent_1 = require("./documents.agent");
Object.defineProperty(exports, "documentsAgentFlow", { enumerable: true, get: function () { return documents_agent_1.documentsAgentFlow; } });
Object.defineProperty(exports, "documentsAgentTool", { enumerable: true, get: function () { return documents_agent_1.documentsAgentTool; } });
Object.defineProperty(exports, "syncFromDriveTool", { enumerable: true, get: function () { return documents_agent_1.syncFromDriveTool; } });
//# sourceMappingURL=knowledge.agent.js.map