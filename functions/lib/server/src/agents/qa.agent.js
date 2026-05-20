"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qaAgentTool = exports.qaAgentFlow = void 0;
/**
 * Q&A Agent — Claude (Gemini Pro fallback)
 *
 * Pattern: agent-as-tool (exposed to Meeting + Orchestrator)
 * Responsibility: Answer questions using RAG over company documents.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const ragTools_1 = require("./tools/ragTools");
const googleWorkspace_1 = require("./tools/mcp/googleWorkspace");
const mcp_config_1 = require("../config/mcp.config");
const logger_1 = require("../utils/logger");
const INPUT = zod_1.z.object({
    question: zod_1.z.string(),
    companyId: zod_1.z.string(),
    context: zod_1.z.string().optional().describe('Additional context from the calling agent'),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({
    answer: zod_1.z.string(),
    sources: zod_1.z.array(zod_1.z.object({ documentName: zod_1.z.string(), excerpt: zod_1.z.string() })),
    confidence: zod_1.z.enum(['high', 'medium', 'low']),
});
// ── The flow ──────────────────────────────────────────────────────────────────
exports.qaAgentFlow = genkit_config_1.ai.defineFlow({ name: 'qaAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ question, companyId, context, language, history }) => {
    logger_1.logger.info(`[QAAgent] Question: "${question.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstruction = language === 'auto'
        ? 'Réponds dans la même langue que la question (français par défaut).'
        : `Réponds en ${language}.`;
    const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();
    // Build tool list — add Drive/Docs/Sheets tools when Google Workspace MCP is available
    const qaTools = [
        ragTools_1.searchDocumentsTool,
        ragTools_1.summarizeDocumentTool,
        ...(mcp_config_1.mcpAvailability.googleWorkspace ? [googleWorkspace_1.driveSearchTool, googleWorkspace_1.docsReadTool, googleWorkspace_1.sheetsReadTool] : []),
    ];
    const mcpNote = mcp_config_1.mcpAvailability.googleWorkspace
        ? 'Tu peux aussi chercher dans Google Drive (drive_search), lire Google Docs (docs_read), ou Google Sheets (sheets_read) pour du contexte additionnel.'
        : '';
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20))
            messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: question }] });
    // Agentic loop: Gemini Pro uses search tools then answers
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_PRO,
        system: `Tu es un assistant Q&R expert pour un système de gestion des connaissances d'entreprise.
CompanyID: ${companyId}.
${context ? `Contexte de l'agent appelant :\n${context}\n` : ''}

## 📅 CONTEXTE TEMPOREL (ne jamais inventer de dates)
${dateAnchors}
Pour toute citation ou réponse, utilise cette ancre temporelle si une date est nécessaire — ne fabrique jamais de dates de documents.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages précédents. Quand l'utilisateur dit "ça", "ce document", "lui", référence-toi à l'élément le plus récent. Ne repars PAS à zéro si le contexte est clair.

## 🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
Tu ne DOIS JAMAIS prétendre avoir fait une action sans appel d'outil réussi.
INTERDIT :
- Inventer une réponse sans avoir appelé searchDocuments / askQA tool
- Citer un document inexistant
- Pretendre avoir analysé un fichier sans l'avoir lu
RÈGLE : APPELLE le tool. Si succès → confirme avec les vrais champs. Si échec → dis la vraie raison. L'utilisateur préfère "je n'ai pas pu" honnête à une fausse confirmation.

APPELLE TOUJOURS searchDocuments en premier pour trouver l'information avant de répondre.
${mcpNote}
Si la réponse n'est pas dans les documents, dis-le honnêtement.
${langInstruction}
Sois concis et cite tes sources.`,
        messages,
        tools: qaTools,
        config: { temperature: 0.2 },
    });
    const qaToolExecutors = new Map([
        ['searchDocuments', (i) => (0, ragTools_1.searchDocumentsTool)(i)],
        ['summarizeDocument', (i) => (0, ragTools_1.summarizeDocumentTool)(i)],
        ['drive_search', (i) => (0, googleWorkspace_1.driveSearchTool)(i)],
        ['docs_read', (i) => (0, googleWorkspace_1.docsReadTool)(i)],
        ['sheets_read', (i) => (0, googleWorkspace_1.sheetsReadTool)(i)],
    ]);
    // Agentic loop — keep executing tools until the model stops requesting them
    // Note: toolRequests is a getter (property), not a method
    while (response.toolRequests.length > 0) {
        const toolResults = await Promise.all(response.toolRequests.map(async (part) => {
            const { name, input, ref } = part.toolRequest;
            const executor = qaToolExecutors.get(name);
            let output;
            try {
                output = executor ? await executor(input) : { error: `Unknown tool: ${name}` };
            }
            catch (err) {
                output = { error: String(err) };
            }
            return { name, ref, output };
        }));
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
            tools: [ragTools_1.searchDocumentsTool, ragTools_1.summarizeDocumentTool],
            config: { temperature: 0.2 },
        });
    }
    // Extract sources from tool calls made during the loop
    const sources = [];
    for (const msg of response.messages) {
        for (const part of msg.content ?? []) {
            const toolResp = part['toolResponse'];
            if (toolResp?.name === 'searchDocuments') {
                const out = toolResp.output;
                (out?.chunks ?? []).slice(0, 3).forEach((chunk) => {
                    if (!sources.find((s) => s.documentName === chunk.documentName)) {
                        sources.push({ documentName: chunk.documentName, excerpt: chunk.text.slice(0, 200) });
                    }
                });
            }
        }
    }
    const answer = response.text;
    const confidence = sources.length >= 3 ? 'high' : sources.length >= 1 ? 'medium' : 'low';
    logger_1.logger.info(`[QAAgent] Answered with ${sources.length} sources, confidence: ${confidence}`);
    return { answer, sources, confidence };
});
// ── Expose as a tool for other agents (agent-as-tool pattern) ─────────────────
exports.qaAgentTool = genkit_config_1.ai.defineTool({
    name: 'askQAAgent',
    description: 'Ask the Q&A specialist agent a question. It will search company documents and return an accurate answer with sources. Use this when you need information from the knowledge base.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, (input) => (0, exports.qaAgentFlow)(input));
//# sourceMappingURL=qa.agent.js.map