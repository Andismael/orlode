import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEmbedding } from '@/services/rag/embeddingService';

// ai is already mocked in setup.ts via genkit.config mock
// Re-import to access the mock
const { ai } = await vi.importMock('../../../config/genkit.config') as { ai: { embed: ReturnType<typeof vi.fn> } };

describe('Embedding Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate an embedding vector of correct dimensions', async () => {
    vi.mocked(ai.embed).mockResolvedValue(new Array(768).fill(0.1));

    const embedding = await generateEmbedding('Test text for embedding');

    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(768);
  });

  it('should return numeric values in the embedding', async () => {
    vi.mocked(ai.embed).mockResolvedValue(new Array(768).fill(0.5));

    const embedding = await generateEmbedding('Some text');
    embedding.forEach(val => {
      expect(typeof val).toBe('number');
    });
  });

  it('should throw or return empty for empty text', async () => {
    vi.mocked(ai.embed).mockRejectedValue(new Error('Empty text not allowed'));

    await expect(generateEmbedding('')).rejects.toThrow();
  });

  it('should handle normal length text', async () => {
    const mockEmbedding = new Array(768).fill(0).map((_, i) => i / 768);
    vi.mocked(ai.embed).mockResolvedValue(mockEmbedding);

    const embedding = await generateEmbedding('Normal length text for embedding test.');
    expect(embedding).toHaveLength(768);
  });

  it('should call ai.embed exactly once', async () => {
    vi.mocked(ai.embed).mockResolvedValue(new Array(768).fill(0.1));

    await generateEmbedding('Test');
    expect(ai.embed).toHaveBeenCalledTimes(1);
  });

  it('should handle very long text by truncating if needed', async () => {
    vi.mocked(ai.embed).mockResolvedValue(new Array(768).fill(0.1));
    const longText = 'word '.repeat(50000);

    const embedding = await generateEmbedding(longText);
    expect(embedding).toHaveLength(768);
  });
});
