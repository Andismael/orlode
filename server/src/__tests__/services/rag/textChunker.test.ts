import { describe, it, expect } from 'vitest';
import { chunkText } from '@/services/rag/textChunker';

const baseCtx = { documentId: 'doc1', documentName: 'test.pdf', companyId: 'co1' };

describe('Text Chunker', () => {
  it('should return empty array for empty text', () => {
    const chunks = chunkText('', baseCtx);
    expect(chunks).toHaveLength(0);
  });

  it('should return a single chunk for short text', () => {
    const chunks = chunkText('Hello world. This is a test.', baseCtx);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('Hello world');
  });

  it('should chunk long text into multiple segments', () => {
    const longText = 'Lorem ipsum dolor sit amet. '.repeat(200);
    const chunks = chunkText(longText, baseCtx);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should not exceed max token count per chunk', () => {
    const longText = 'word '.repeat(2000);
    const chunks = chunkText(longText, baseCtx);
    chunks.forEach(chunk => {
      const wordCount = chunk.content.split(/\s+/).length;
      expect(wordCount).toBeLessThan(1500);
    });
  });

  it('should include documentId in each chunk', () => {
    const chunks = chunkText('Some meaningful content for testing the chunker.', baseCtx);
    chunks.forEach(chunk => {
      expect(chunk.documentId).toBe('doc1');
    });
  });

  it('should include documentName in each chunk', () => {
    const chunks = chunkText('Some content for metadata test.', baseCtx);
    chunks.forEach(chunk => {
      expect(chunk.documentName).toBe('test.pdf');
    });
  });

  it('should assign sequential chunkIndex', () => {
    const longText = 'word '.repeat(2000);
    const chunks = chunkText(longText, baseCtx);
    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i);
    });
  });

  it('should handle text with only whitespace', () => {
    const chunks = chunkText('   \n\n\t   ', baseCtx);
    expect(chunks).toHaveLength(0);
  });

  it('should preserve companyId from context', () => {
    const chunks = chunkText('Test content here.', { ...baseCtx, companyId: 'company-xyz' });
    if (chunks.length > 0) {
      expect(chunks[0].companyId).toBe('company-xyz');
    }
  });

  it('should handle multiline text with paragraphs', () => {
    const text = 'First paragraph content here.\n\nSecond paragraph content here.\n\nThird paragraph content here.';
    const chunks = chunkText(text, baseCtx);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const combined = chunks.map(c => c.content).join(' ');
    expect(combined).toContain('First paragraph');
    expect(combined).toContain('Second paragraph');
  });
});
