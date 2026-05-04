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
});
const OUTPUT = zod_1.z.object({
    answer: zod_1.z.string(),
    sources: zod_1.z.array(zod_1.z.object({ documentName: zod_1.z.string(), excerpt: zod_1.z.string() })),
    confidence: zod_1.z.enum(['high', 'medium', 'low']),
});
// ── The flow ──────────────────────────────────────────────────────────────────
exports.qaAgentFlow = genkit_config_1.ai.defineFlow({ name: 'qaAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ question, companyId, context, language }) => {
    logger_1.logger.info(`[QAAgent] Question: "${question.slice(0, 80)}"`);
    const langInstruction = language === 'auto'
        ? 'Respond in the same language as the question.'
        : `Respond in ${language}.`;
    // Build tool list — add Drive/Docs/Sheets tools when Google Workspace MCP is available
    const qaTools = [
        ragTools_1.searchDocumentsTool,
        ragTools_1.summarizeDocumentTool,
        ...(mcp_config_1.mcpAvailability.googleWorkspace ? [googleWorkspace_1.driveSearchTool, googleWorkspace_1.docsReadTool, googleWorkspace_1.sheetsReadTool] : []),
    ];
    const mcpNote = mcp_config_1.mcpAvailability.googleWorkspace
        ? 'You can also search Google Drive (drive_search), read Google Docs (docs_read), or read Google Sheets (sheets_read) for additional context.'
        : '';
    // Agentic loop: Gemini Pro uses search tools then answers
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_PRO,
        system: `You are an expert Q&A assistant for a corporate knowledge management system.
${context ? `Context from calling agent:\n${context}\n` : ''}
ALWAYS call searchDocuments first to find relevant information before answering.
${mcpNote}
If the answer is not found in documents, say so honestly.
${langInstruction}
Be concise and cite your sources.`,
        prompt: question,
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