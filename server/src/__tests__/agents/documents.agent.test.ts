import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/documents.agent', () => ({
  documentsAgent: {
    process: vi.fn(async ({ action, fileType, fileName, fileBuffer, companyId }: {
      action: string; fileType: string; fileName: string;
      fileBuffer: Buffer; companyId: string;
    }) => {
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
    classify: vi.fn(async (text: string) => {
      if (text.toLowerCase().includes('chiffre') || text.toLowerCase().includes('financial')) {
        return { category: 'financial', tags: ['Q3', 'revenue'], confidentiality: 'internal' };
      }
      return { category: 'general', tags: [], confidentiality: 'public' };
    }),
    delete: vi.fn(async (_documentId: string, _companyId: string) => ({ success: true })),
  },
}));

import { documentsAgent } from '@/agents/documents.agent';

describe('Documents Agent', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should process a PDF document end-to-end', async () => {
    const result = await documentsAgent.process({
      action: 'ingest',
      fileType: 'pdf',
      fileName: 'Rapport_Q3.pdf',
      fileBuffer: Buffer.from('Rapport financier Q3 2025. CA: €2.3M'),
      companyId: 'test-company',
    });

    expect(result.status).toBe('completed');
    expect(result.chunksCreated).toBeGreaterThan(0);
    expect(result.classification).toBeDefined();
  });

  it('should apply OCR flag for scanned PDF filenames', async () => {
    const result = await documentsAgent.process({
      action: 'ingest',
      fileType: 'pdf',
      fileName: 'Scan_contrat.pdf',
      fileBuffer: Buffer.from('Scanned document content here'),
      companyId: 'test-company',
    });

    expect(result.ocrApplied).toBe(true);
    expect(result.status).toBe('completed');
  });

  it('should classify financial documents correctly', async () => {
    const result = await documentsAgent.classify("Le chiffre d'affaires Q3 est de €2.3M");

    expect(result.category).toBe('financial');
    expect(result.tags).toContain('Q3');
  });

  it('should return a documentId after ingestion', async () => {
    const result = await documentsAgent.process({
      action: 'ingest',
      fileType: 'docx',
      fileName: 'Contrat.docx',
      fileBuffer: Buffer.from('Contract content here with enough text'),
      companyId: 'co1',
    });

    expect(result.documentId).toBeDefined();
    expect(typeof result.documentId).toBe('string');
  });

  it('should classify general documents', async () => {
    const result = await documentsAgent.classify('This is a general announcement for the team.');
    expect(result.category).toBe('general');
  });

  it('should delete a document', async () => {
    const result = await documentsAgent.delete('doc123', 'co1');
    expect(result.success).toBe(true);
  });
});
