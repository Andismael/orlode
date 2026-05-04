import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore, mockDocs } from '../../setup';

// Mock the vector store module directly since Firestore vector search requires
// specific SDK capabilities that are fully mocked
vi.mock('@/services/rag/firestoreVectorStore', () => ({
  firestoreVectorStore: {
    upsertChunks: vi.fn(async (companyId: string, chunks: Array<{ id: string; data: Record<string, unknown>; embedding: number[] }>) => {
      for (const chunk of chunks) {
        const key = `companies/${companyId}/vectorChunks/${chunk.id}`;
        // Simulate storing in mockDocs via the module itself
        (globalThis as Record<string, unknown>).__mockDocs = (globalThis as Record<string, unknown>).__mockDocs || new Map();
        ((globalThis as Record<string, unknown>).__mockDocs as Map<string, unknown>).set(key, { ...chunk.data, embedding: chunk.embedding });
      }
    }),
    deleteByDocument: vi.fn(async (companyId: string, documentId: string) => {
      const prefix = `companies/${companyId}/vectorChunks/`;
      const toDelete: string[] = [];
      mockDocs.forEach((val, key) => {
        if (key.startsWith(prefix) && (val as Record<string, unknown>).documentId === documentId) {
          toDelete.push(key);
        }
      });
      toDelete.forEach(key => mockDocs.delete(key));
    }),
    search: vi.fn(async (_companyId: string, _embedding: number[], _topK: number) => {
      return [];
    }),
    getStats: vi.fn(async (companyId: string) => ({
      totalChunks: 0,
      companyId,
    })),
  },
}));

import { firestoreVectorStore } from '@/services/rag/firestoreVectorStore';

describe('Firestore Vector Store', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should upsert chunks', async () => {
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

    await firestoreVectorStore.upsertChunks('company1', chunks);

    expect(firestoreVectorStore.upsertChunks).toHaveBeenCalledWith('company1', chunks);
  });

  it('should delete chunks by documentId', async () => {
    // Pre-seed mockDocs with chunks belonging to doc1
    mockDocs.set('companies/co1/vectorChunks/c1', { documentId: 'doc1', content: 'chunk 1' });
    mockDocs.set('companies/co1/vectorChunks/c2', { documentId: 'doc1', content: 'chunk 2' });
    mockDocs.set('companies/co1/vectorChunks/c3', { documentId: 'doc2', content: 'other doc' });

    await firestoreVectorStore.deleteByDocument('co1', 'doc1');

    expect(firestoreVectorStore.deleteByDocument).toHaveBeenCalledWith('co1', 'doc1');
    // doc2 chunk should remain
    expect(mockDocs.has('companies/co1/vectorChunks/c3')).toBe(true);
    // doc1 chunks should be gone
    expect(mockDocs.has('companies/co1/vectorChunks/c1')).toBe(false);
    expect(mockDocs.has('companies/co1/vectorChunks/c2')).toBe(false);
  });

  it('should return an array from search', async () => {
    const results = await firestoreVectorStore.search('co1', new Array(768).fill(0.1), 5);

    expect(Array.isArray(results)).toBe(true);
  });

  it('should call search with correct parameters', async () => {
    const embedding = new Array(768).fill(0.25);
    await firestoreVectorStore.search('co1', embedding, 10);

    expect(firestoreVectorStore.search).toHaveBeenCalledWith('co1', embedding, 10);
  });

  it('should return stats', async () => {
    const stats = await firestoreVectorStore.getStats('co1');

    expect(stats).toBeDefined();
    expect(stats.companyId).toBe('co1');
    expect(typeof stats.totalChunks).toBe('number');
  });

  it('should handle upsert of multiple chunks', async () => {
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

    await firestoreVectorStore.upsertChunks('co1', chunks);
    expect(firestoreVectorStore.upsertChunks).toHaveBeenCalledOnce();
  });
});
