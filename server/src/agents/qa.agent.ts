/**
 * Q&A Agent — Claude (Gemini Pro fallback)
 *
 * Pattern: agent-as-tool (exposed to Meeting + Orchestrator)
 * Responsibility: Answer questions using RAG over company documents.
 */
import { z } from 'zod';
import { ai, GEMINI_PRO } from '../config/genkit.config';
import { searchDocumentsTool, summarizeDocumentTool } from './tools/ragTools';
import { driveSearchTool, docsReadTool, sheetsReadTool } from './tools/mcp/googleWorkspace';
import { mcpAvailability } from '../config/mcp.config';
import { logger } from '../utils/logger';

const INPUT  = z.object({
  question:      z.string(),
  companyId:     z.string(),
  context:       z.string().optional().describe('Additional context from the calling agent'),
  language:      z.string().optional().default('auto'),
  history:       z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const OUTPUT = z.object({
  answer:  z.string(),
  sources: z.array(z.object({ documentName: z.string(), excerpt: z.string() })),
  confidence: z.enum(['high', 'medium', 'low']),
});

export type QAInput  = z.infer<typeof INPUT>;
export type QAOutput = z.infer<typeof OUTPUT>;

// ── The flow ──────────────────────────────────────────────────────────────────
export const qaAgentFlow = ai.defineFlow(
  { name: 'qaAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ question, companyId, context, language, history }): Promise<QAOutput> => {
    logger.info(`[QAAgent] Question: "${question.slice(0, 80)}" (history=${history?.length ?? 0})`);

    const langInstruction = language === 'auto'
      ? 'Réponds dans la même langue que la question (français par défaut).'
      : `Réponds en ${language}.`;

    const dateAnchors = (() => {
      const now = new Date();
      const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
      return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();

    // Build tool list — add Drive/Docs/Sheets tools when Google Workspace MCP is available
    const qaTools = [
      searchDocumentsTool,
      summarizeDocumentTool,
      ...(mcpAvailability.googleWorkspace ? [driveSearchTool, docsReadTool, sheetsReadTool] : []),
    ];

    const mcpNote = mcpAvailability.googleWorkspace
      ? 'Tu peux aussi chercher dans Google Drive (drive_search), lire Google Docs (docs_read), ou Google Sheets (sheets_read) pour du contexte additionnel.'
      : '';

    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: question }] });

    // Agentic loop: Gemini Pro uses search tools then answers
    let response = await ai.generate({
      model: GEMINI_PRO,
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

    const qaToolExecutors = new Map<string, (input: unknown) => Promise<unknown>>([
      ['searchDocuments',  (i) => searchDocumentsTool(i as Parameters<typeof searchDocumentsTool>[0])],
      ['summarizeDocument',(i) => summarizeDocumentTool(i as Parameters<typeof summarizeDocumentTool>[0])],
      ['drive_search',     (i) => driveSearchTool(i as Parameters<typeof driveSearchTool>[0])],
      ['docs_read',        (i) => docsReadTool(i as Parameters<typeof docsReadTool>[0])],
      ['sheets_read',      (i) => sheetsReadTool(i as Parameters<typeof sheetsReadTool>[0])],
    ]);

    // Agentic loop — keep executing tools until the model stops requesting them
    // Note: toolRequests is a getter (property), not a method
    while (response.toolRequests.length > 0) {
      const toolResults = await Promise.all(
        response.toolRequests.map(async (part) => {
          const { name, input, ref } = part.toolRequest;
          const executor = qaToolExecutors.get(name);
          let output: unknown;
          try {
            output = executor ? await executor(input) : { error: `Unknown tool: ${name}` };
          } catch (err) {
            output = { error: String(err) };
          }
          return { name, ref, output };
        })
      );
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
        tools:  [searchDocumentsTool, summarizeDocumentTool],
        config: { temperature: 0.2 },
      });
    }

    // Extract sources from tool calls made during the loop
    const sources: QAOutput['sources'] = [];
    for (const msg of response.messages) {
      for (const part of msg.content ?? []) {
        const toolResp = (part as Record<string, unknown>)['toolResponse'] as { name?: string; output?: unknown } | undefined;
        if (toolResp?.name === 'searchDocuments') {
          const out = toolResp.output as { chunks?: Array<{ documentName: string; text: string }> };
          (out?.chunks ?? []).slice(0, 3).forEach((chunk) => {
            if (!sources.find((s) => s.documentName === chunk.documentName)) {
              sources.push({ documentName: chunk.documentName, excerpt: chunk.text.slice(0, 200) });
            }
          });
        }
      }
    }

    const answer = response.text;
    const confidence: QAOutput['confidence'] =
      sources.length >= 3 ? 'high' : sources.length >= 1 ? 'medium' : 'low';

    logger.info(`[QAAgent] Answered with ${sources.length} sources, confidence: ${confidence}`);
    return { answer, sources, confidence };
  }
);

// ── Expose as a tool for other agents (agent-as-tool pattern) ─────────────────
export const qaAgentTool = ai.defineTool(
  {
    name: 'askQAAgent',
    description: 'Ask the Q&A specialist agent a question. It will search company documents and return an accurate answer with sources. Use this when you need information from the knowledge base.',
    inputSchema:  INPUT,
    outputSchema: OUTPUT,
  },
  (input) => qaAgentFlow(input)
);
