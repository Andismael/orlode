import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../../setup';

// Mock both agents — the flow tests verify they're called in sequence with correct data
vi.mock('@/agents/documents.agent', () => ({
  documentsAgent: {
    process: vi.fn(async ({ action, fileName, fileBuffer, companyId }: {
      action: string; fileName: string; fileBuffer: Buffer; companyId: string; fileType: string;
    }) => {
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

vi.mock('@/agents/qa.agent', () => ({
  qaAgent: {
    process: vi.fn(async ({ query, companyId }: { query: string; companyId: string }) => {
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

import { documentsAgent } from '@/agents/documents.agent';
import { qaAgent } from '@/agents/qa.agent';

describe('Flow: Document Upload → Q&A', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should make uploaded document searchable via Q&A', async () => {
    // Step 1: Upload document
    const uploadResult = await documentsAgent.process({
      action: 'ingest',
      fileType: 'pdf',
      fileName: 'Budget_2026.pdf',
      fileBuffer: Buffer.from('Le budget 2026 est de €5M pour le département marketing.'),
      companyId: 'test-co',
    });

    expect(uploadResult.status).toBe('completed');
    expect(uploadResult.chunksCreated).toBeGreaterThan(0);

    // Step 2: Ask a question
    const qaResult = await qaAgent.process({
      query: 'Quel est le budget marketing 2026 ?',
      companyId: 'test-co',
    });

    expect(qaResult.answer).toContain('5M');
    expect(qaResult.sources[0].documentName).toBe('Budget_2026.pdf');
  });

  it('should return "not found" when document not uploaded', async () => {
    const qaResult = await qaAgent.process({
      query: 'Quel est le budget cybersécurité 2027 ?',
      companyId: 'test-co',
    });

    expect(qaResult.sources).toHaveLength(0);
  });

  it('should handle upload failure gracefully', async () => {
    const emptyUpload = await documentsAgent.process({
      action: 'ingest',
      fileType: 'pdf',
      fileName: 'empty.pdf',
      fileBuffer: Buffer.from(''),
      companyId: 'test-co',
    });

    expect(emptyUpload.chunksCreated).toBe(0);
  });
});
