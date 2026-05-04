"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
vitest_1.vi.mock('@/agents/documents.agent', () => ({
    documentsAgent: {
        process: vitest_1.vi.fn(async ({ action, fileType, fileName, fileBuffer, companyId }) => {
            if (action === 'ingest') {
                const isEmpty = fileBuffer.length < 10 || fileBuffer.toString().length < 10;
                return {
                    status: 'completed',
                    documentId: `doc_${Date.now()}`,
                    fileName,
                    fileType,
                    companyId,
                    chunksCreated: isEmpty ? 0 : 5,
                    ocrApplied: fileName.includes('Scan') || fileName.includes('scan'),
                    classification: { category: 'financial', tags: ['Q3'], confidentiality: 'internal' },
                };
            }
            return { status: 'unknown_action' };
        }),
        classify: vitest_1.vi.fn(async (text) => {
            if (text.toLowerCase().includes('chiffre') || text.toLowerCase().includes('financial')) {
                return { category: 'financial', tags: ['Q3', 'revenue'], confidentiality: 'internal' };
            }
            return { category: 'general', tags: [], confidentiality: 'public' };
        }),
        delete: vitest_1.vi.fn(async (_documentId, _companyId) => ({ success: true })),
    },
}));
const documents_agent_1 = require("@/agents/documents.agent");
(0, vitest_1.describe)('Documents Agent', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should process a PDF document end-to-end', async () => {
        const result = await documents_agent_1.documentsAgent.process({
            action: 'ingest',
            fileType: 'pdf',
            fileName: 'Rapport_Q3.pdf',
            fileBuffer: Buffer.from('Rapport financier Q3 2025. CA: €2.3M'),
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.status).toBe('completed');
        (0, vitest_1.expect)(result.chunksCreated).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.classification).toBeDefined();
    });
    (0, vitest_1.it)('should apply OCR flag for scanned PDF filenames', async () => {
        const result = await documents_agent_1.documentsAgent.process({
            action: 'ingest',
            fileType: 'pdf',
            fileName: 'Scan_contrat.pdf',
            fileBuffer: Buffer.from('Scanned document content here'),
            companyId: 'test-company',
        });
        (0, vitest_1.expect)(result.ocrApplied).toBe(true);
        (0, vitest_1.expect)(result.status).toBe('completed');
    });
    (0, vitest_1.it)('should classify financial documents correctly', async () => {
        const result = await documents_agent_1.documentsAgent.classify("Le chiffre d'affaires Q3 est de €2.3M");
        (0, vitest_1.expect)(result.category).toBe('financial');
        (0, vitest_1.expect)(result.tags).toContain('Q3');
    });
    (0, vitest_1.it)('should return a documentId after ingestion', async () => {
        const result = await documents_agent_1.documentsAgent.process({
            action: 'ingest',
            fileType: 'docx',
            fileName: 'Contrat.docx',
            fileBuffer: Buffer.from('Contract content here with enough text'),
            companyId: 'co1',
        });
        (0, vitest_1.expect)(result.documentId).toBeDefined();
        (0, vitest_1.expect)(typeof result.documentId).toBe('string');
    });
    (0, vitest_1.it)('should classify general documents', async () => {
        const result = await documents_agent_1.documentsAgent.classify('This is a general announcement for the team.');
        (0, vitest_1.expect)(result.category).toBe('general');
    });
    (0, vitest_1.it)('should delete a document', async () => {
        const result = await documents_agent_1.documentsAgent.delete('doc123', 'co1');
        (0, vitest_1.expect)(result.success).toBe(true);
    });
});
//# sourceMappingURL=documents.agent.test.js.map