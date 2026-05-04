"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const textChunker_1 = require("@/services/rag/textChunker");
const baseCtx = { documentId: 'doc1', documentName: 'test.pdf', companyId: 'co1' };
(0, vitest_1.describe)('Text Chunker', () => {
    (0, vitest_1.it)('should return empty array for empty text', () => {
        const chunks = (0, textChunker_1.chunkText)('', baseCtx);
        (0, vitest_1.expect)(chunks).toHaveLength(0);
    });
    (0, vitest_1.it)('should return a single chunk for short text', () => {
        const chunks = (0, textChunker_1.chunkText)('Hello world. This is a test.', baseCtx);
        (0, vitest_1.expect)(chunks).toHaveLength(1);
        (0, vitest_1.expect)(chunks[0].content).toContain('Hello world');
    });
    (0, vitest_1.it)('should chunk long text into multiple segments', () => {
        const longText = 'Lorem ipsum dolor sit amet. '.repeat(200);
        const chunks = (0, textChunker_1.chunkText)(longText, baseCtx);
        (0, vitest_1.expect)(chunks.length).toBeGreaterThan(1);
    });
    (0, vitest_1.it)('should not exceed max token count per chunk', () => {
        const longText = 'word '.repeat(2000);
        const chunks = (0, textChunker_1.chunkText)(longText, baseCtx);
        chunks.forEach(chunk => {
            const wordCount = chunk.content.split(/\s+/).length;
            (0, vitest_1.expect)(wordCount).toBeLessThan(1500);
        });
    });
    (0, vitest_1.it)('should include documentId in each chunk', () => {
        const chunks = (0, textChunker_1.chunkText)('Some meaningful content for testing the chunker.', baseCtx);
        chunks.forEach(chunk => {
            (0, vitest_1.expect)(chunk.documentId).toBe('doc1');
        });
    });
    (0, vitest_1.it)('should include documentName in each chunk', () => {
        const chunks = (0, textChunker_1.chunkText)('Some content for metadata test.', baseCtx);
        chunks.forEach(chunk => {
            (0, vitest_1.expect)(chunk.documentName).toBe('test.pdf');
        });
    });
    (0, vitest_1.it)('should assign sequential chunkIndex', () => {
        const longText = 'word '.repeat(2000);
        const chunks = (0, textChunker_1.chunkText)(longText, baseCtx);
        chunks.forEach((chunk, i) => {
            (0, vitest_1.expect)(chunk.chunkIndex).toBe(i);
        });
    });
    (0, vitest_1.it)('should handle text with only whitespace', () => {
        const chunks = (0, textChunker_1.chunkText)('   \n\n\t   ', baseCtx);
        (0, vitest_1.expect)(chunks).toHaveLength(0);
    });
    (0, vitest_1.it)('should preserve companyId from context', () => {
        const chunks = (0, textChunker_1.chunkText)('Test content here.', { ...baseCtx, companyId: 'company-xyz' });
        if (chunks.length > 0) {
            (0, vitest_1.expect)(chunks[0].companyId).toBe('company-xyz');
        }
    });
    (0, vitest_1.it)('should handle multiline text with paragraphs', () => {
        const text = 'First paragraph content here.\n\nSecond paragraph content here.\n\nThird paragraph content here.';
        const chunks = (0, textChunker_1.chunkText)(text, baseCtx);
        (0, vitest_1.expect)(chunks.length).toBeGreaterThanOrEqual(1);
        const combined = chunks.map(c => c.content).join(' ');
        (0, vitest_1.expect)(combined).toContain('First paragraph');
        (0, vitest_1.expect)(combined).toContain('Second paragraph');
    });
});
//# sourceMappingURL=textChunker.test.js.map