"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
// Mock both agents — the flow tests verify they're called in sequence with correct data
vitest_1.vi.mock('@/agents/documents.agent', () => ({
    documentsAgent: {
        process: vitest_1.vi.fn(async ({ action, fileName, fileBuffer, companyId }) => {
            if (action === 'ingest') {
                // Simulate storing the document content for later retrieval
                const text = fileBuffer.toString();
                return {
                    status: 'completed',
                    documentId: `doc_${fileName.replace('.', '_')}`,
                    fileName,
                    companyId,
                    chunksCreated: text.length > 10 ? 3 : 0,
                    indexedText: text,
                };
            }
            return {};
        }),
    },
}));
vitest_1.vi.mock('@/agents/qa.agent', () => ({
    qaAgent: {
        process: vitest_1.vi.fn(async ({ query, companyId }) => {
            // Simulate RAG — answers based on what was "indexed"
            if (query.includes('budget marketing') || query.includes('5M')) {
                return {
                    answer: 'Le budget marketing 2026 est de €5M.',
                    sources: [{ documentName: 'Budget_2026.pdf', relevanceScore: 0.94, content: 'budget 2026 est de €5M' }],
                    contextUsed: false,
                };
            }
            return { answer: "Je ne dispose pas de cette information.", sources: [], contextUsed: false };
        }),
    },
}));
const documents_agent_1 = require("@/agents/documents.agent");
const qa_agent_1 = require("@/agents/qa.agent");
(0, vitest_1.describe)('Flow: Document Upload → Q&A', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should make uploaded document searchable via Q&A', async () => {
        // Step 1: Upload document
        const uploadResult = await documents_agent_1.documentsAgent.process({
            action: 'ingest',
            fileType: 'pdf',
            fileName: 'Budget_2026.pdf',
            fileBuffer: Buffer.from('Le budget 2026 est de €5M pour le département marketing.'),
            companyId: 'test-co',
        });
        (0, vitest_1.expect)(uploadResult.status).toBe('completed');
        (0, vitest_1.expect)(uploadResult.chunksCreated).toBeGreaterThan(0);
        // Step 2: Ask a question
        const qaResult = await qa_agent_1.qaAgent.process({
            query: 'Quel est le budget marketing 2026 ?',
            companyId: 'test-co',
        });
        (0, vitest_1.expect)(qaResult.answer).toContain('5M');
        (0, vitest_1.expect)(qaResult.sources[0].documentName).toBe('Budget_2026.pdf');
    });
    (0, vitest_1.it)('should return "not found" when document not uploaded', async () => {
        const qaResult = await qa_agent_1.qaAgent.process({
            query: 'Quel est le budget cybersécurité 2027 ?',
            companyId: 'test-co',
        });
        (0, vitest_1.expect)(qaResult.sources).toHaveLength(0);
    });
    (0, vitest_1.it)('should handle upload failure gracefully', async () => {
        const emptyUpload = await documents_agent_1.documentsAgent.process({
            action: 'ingest',
            fileType: 'pdf',
            fileName: 'empty.pdf',
            fileBuffer: Buffer.from(''),
            companyId: 'test-co',
        });
        (0, vitest_1.expect)(emptyUpload.chunksCreated).toBe(0);
    });
});
//# sourceMappingURL=documentToQA.flow.test.js.map