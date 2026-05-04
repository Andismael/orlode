"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const embeddingService_1 = require("@/services/rag/embeddingService");
// ai is already mocked in setup.ts via genkit.config mock
// Re-import to access the mock
const { ai } = await vitest_1.vi.importMock('../../../config/genkit.config');
(0, vitest_1.describe)('Embedding Service', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should generate an embedding vector of correct dimensions', async () => {
        vitest_1.vi.mocked(ai.embed).mockResolvedValue(new Array(768).fill(0.1));
        const embedding = await (0, embeddingService_1.generateEmbedding)('Test text for embedding');
        (0, vitest_1.expect)(embedding).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(embedding)).toBe(true);
        (0, vitest_1.expect)(embedding.length).toBe(768);
    });
    (0, vitest_1.it)('should return numeric values in the embedding', async () => {
        vitest_1.vi.mocked(ai.embed).mockResolvedValue(new Array(768).fill(0.5));
        const embedding = await (0, embeddingService_1.generateEmbedding)('Some text');
        embedding.forEach(val => {
            (0, vitest_1.expect)(typeof val).toBe('number');
        });
    });
    (0, vitest_1.it)('should throw or return empty for empty text', async () => {
        vitest_1.vi.mocked(ai.embed).mockRejectedValue(new Error('Empty text not allowed'));
        await (0, vitest_1.expect)((0, embeddingService_1.generateEmbedding)('')).rejects.toThrow();
    });
    (0, vitest_1.it)('should handle normal length text', async () => {
        const mockEmbedding = new Array(768).fill(0).map((_, i) => i / 768);
        vitest_1.vi.mocked(ai.embed).mockResolvedValue(mockEmbedding);
        const embedding = await (0, embeddingService_1.generateEmbedding)('Normal length text for embedding test.');
        (0, vitest_1.expect)(embedding).toHaveLength(768);
    });
    (0, vitest_1.it)('should call ai.embed exactly once', async () => {
        vitest_1.vi.mocked(ai.embed).mockResolvedValue(new Array(768).fill(0.1));
        await (0, embeddingService_1.generateEmbedding)('Test');
        (0, vitest_1.expect)(ai.embed).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('should handle very long text by truncating if needed', async () => {
        vitest_1.vi.mocked(ai.embed).mockResolvedValue(new Array(768).fill(0.1));
        const longText = 'word '.repeat(50000);
        const embedding = await (0, embeddingService_1.generateEmbedding)(longText);
        (0, vitest_1.expect)(embedding).toHaveLength(768);
    });
});
//# sourceMappingURL=embeddingService.test.js.map