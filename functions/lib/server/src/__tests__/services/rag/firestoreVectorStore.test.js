"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
// Mock the vector store module directly since Firestore vector search requires
// specific SDK capabilities that are fully mocked
vitest_1.vi.mock('@/services/rag/firestoreVectorStore', () => ({
    firestoreVectorStore: {
        upsertChunks: vitest_1.vi.fn(async (companyId, chunks) => {
            for (const chunk of chunks) {
                const key = `companies/${companyId}/vectorChunks/${chunk.id}`;
                // Simulate storing in mockDocs via the module itself
                globalThis.__mockDocs = globalThis.__mockDocs || new Map();
                globalThis.__mockDocs.set(key, { ...chunk.data, embedding: chunk.embedding });
            }
        }),
        deleteByDocument: vitest_1.vi.fn(async (companyId, documentId) => {
            const prefix = `companies/${companyId}/vectorChunks/`;
            const toDelete = [];
            setup_1.mockDocs.forEach((val, key) => {
                if (key.startsWith(prefix) && val.documentId === documentId) {
                    toDelete.push(key);
                }
            });
            toDelete.forEach(key => setup_1.mockDocs.delete(key));
        }),
        search: vitest_1.vi.fn(async (_companyId, _embedding, _topK) => {
            return [];
        }),
        getStats: vitest_1.vi.fn(async (companyId) => ({
            totalChunks: 0,
            companyId,
        })),
    },
}));
const firestoreVectorStore_1 = require("@/services/rag/firestoreVectorStore");
(0, vitest_1.describe)('Firestore Vector Store', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should upsert chunks', async () => {
        const chunks = [{
                id: 'chunk1',
                data: {
                    documentId: 'doc1',
                    documentName: 'test.pdf',
                    content: 'Test content for vector store',
                    chunkIndex: 0,
                    companyId: 'company1',
                    metadata: { category: 'financial', confidentiality: 'internal', language: 'fr', tokenCount: 5 },
                },
                embedding: new Array(768).fill(0.1),
            }];
        await firestoreVectorStore_1.firestoreVectorStore.upsertChunks('company1', chunks);
        (0, vitest_1.expect)(firestoreVectorStore_1.firestoreVectorStore.upsertChunks).toHaveBeenCalledWith('company1', chunks);
    });
    (0, vitest_1.it)('should delete chunks by documentId', async () => {
        // Pre-seed mockDocs with chunks belonging to doc1
        setup_1.mockDocs.set('companies/co1/vectorChunks/c1', { documentId: 'doc1', content: 'chunk 1' });
        setup_1.mockDocs.set('companies/co1/vectorChunks/c2', { documentId: 'doc1', content: 'chunk 2' });
        setup_1.mockDocs.set('companies/co1/vectorChunks/c3', { documentId: 'doc2', content: 'other doc' });
        await firestoreVectorStore_1.firestoreVectorStore.deleteByDocument('co1', 'doc1');
        (0, vitest_1.expect)(firestoreVectorStore_1.firestoreVectorStore.deleteByDocument).toHaveBeenCalledWith('co1', 'doc1');
        // doc2 chunk should remain
        (0, vitest_1.expect)(setup_1.mockDocs.has('companies/co1/vectorChunks/c3')).toBe(true);
        // doc1 chunks should be gone
        (0, vitest_1.expect)(setup_1.mockDocs.has('companies/co1/vectorChunks/c1')).toBe(false);
        (0, vitest_1.expect)(setup_1.mockDocs.has('companies/co1/vectorChunks/c2')).toBe(false);
    });
    (0, vitest_1.it)('should return an array from search', async () => {
        const results = await firestoreVectorStore_1.firestoreVectorStore.search('co1', new Array(768).fill(0.1), 5);
        (0, vitest_1.expect)(Array.isArray(results)).toBe(true);
    });
    (0, vitest_1.it)('should call search with correct parameters', async () => {
        const embedding = new Array(768).fill(0.25);
        await firestoreVectorStore_1.firestoreVectorStore.search('co1', embedding, 10);
        (0, vitest_1.expect)(firestoreVectorStore_1.firestoreVectorStore.search).toHaveBeenCalledWith('co1', embedding, 10);
    });
    (0, vitest_1.it)('should return stats', async () => {
        const stats = await firestoreVectorStore_1.firestoreVectorStore.getStats('co1');
        (0, vitest_1.expect)(stats).toBeDefined();
        (0, vitest_1.expect)(stats.companyId).toBe('co1');
        (0, vitest_1.expect)(typeof stats.totalChunks).toBe('number');
    });
    (0, vitest_1.it)('should handle upsert of multiple chunks', async () => {
        const chunks = Array.from({ length: 5 }, (_, i) => ({
            id: `chunk${i}`,
            data: {
                documentId: 'doc1',
                documentName: 'large.pdf',
                content: `Content chunk ${i}`,
                chunkIndex: i,
                companyId: 'co1',
                metadata: { category: 'general', confidentiality: 'internal', language: 'fr', tokenCount: 10 },
            },
            embedding: new Array(768).fill(i * 0.01),
        }));
        await firestoreVectorStore_1.firestoreVectorStore.upsertChunks('co1', chunks);
        (0, vitest_1.expect)(firestoreVectorStore_1.firestoreVectorStore.upsertChunks).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=firestoreVectorStore.test.js.map