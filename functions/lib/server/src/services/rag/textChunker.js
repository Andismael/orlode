"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkText = chunkText;
const helpers_1 = require("../../utils/helpers");
const DEFAULT_CHUNK_SIZE = 800; // tokens
const DEFAULT_OVERLAP = 150; // tokens
/**
 * Chunk text into segments of ~800 tokens with 150 token overlap.
 * Tries to preserve paragraph/sentence boundaries.
 */
function chunkText(text, options) {
    const chunkSizeTokens = options.chunkSizeTokens ?? DEFAULT_CHUNK_SIZE;
    const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP;
    // Split by paragraphs first
    const paragraphs = text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    const chunks = [];
    const chunkStartChars = [];
    const chunkEndChars = [];
    let currentChunk = '';
    let currentTokenCount = 0;
    let charOffset = 0;
    let chunkStartChar = 0;
    for (const paragraph of paragraphs) {
        const paraTokens = (0, helpers_1.estimateTokenCount)(paragraph);
        // If this single paragraph exceeds chunk size, split by sentences
        if (paraTokens > chunkSizeTokens) {
            const sentences = splitIntoSentences(paragraph);
            for (const sentence of sentences) {
                const sentTokens = (0, helpers_1.estimateTokenCount)(sentence);
                if (currentTokenCount + sentTokens > chunkSizeTokens && currentChunk.length > 0) {
                    // Save current chunk
                    chunks.push(currentChunk.trim());
                    chunkStartChars.push(chunkStartChar);
                    chunkEndChars.push(charOffset);
                    // Start new chunk with overlap
                    const overlapText = getOverlapText(currentChunk, overlapTokens);
                    chunkStartChar = charOffset - estimateCharCount(overlapText);
                    currentChunk = overlapText + ' ' + sentence;
                    currentTokenCount = (0, helpers_1.estimateTokenCount)(currentChunk);
                }
                else {
                    currentChunk += (currentChunk ? ' ' : '') + sentence;
                    currentTokenCount += sentTokens;
                }
                charOffset += sentence.length + 1;
            }
        }
        else {
            if (currentTokenCount + paraTokens > chunkSizeTokens && currentChunk.length > 0) {
                // Save current chunk
                chunks.push(currentChunk.trim());
                chunkStartChars.push(chunkStartChar);
                chunkEndChars.push(charOffset);
                // Start new chunk with overlap
                const overlapText = getOverlapText(currentChunk, overlapTokens);
                chunkStartChar = charOffset - estimateCharCount(overlapText);
                currentChunk = overlapText + '\n\n' + paragraph;
                currentTokenCount = (0, helpers_1.estimateTokenCount)(currentChunk);
            }
            else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
                currentTokenCount += paraTokens;
            }
            charOffset += paragraph.length + 2;
        }
    }
    // Push last chunk
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        chunkStartChars.push(chunkStartChar);
        chunkEndChars.push(charOffset);
    }
    const totalChunks = chunks.length;
    return chunks.map((chunkText, index) => ({
        id: `${options.documentId}_chunk_${index}`,
        text: chunkText,
        chunkIndex: index,
        totalChunks,
        tokenCount: (0, helpers_1.estimateTokenCount)(chunkText),
        metadata: {
            documentId: options.documentId,
            documentName: options.documentName,
            companyId: options.companyId,
            chunkIndex: index,
            totalChunks,
            startChar: chunkStartChars[index] ?? 0,
            endChar: chunkEndChars[index] ?? chunkText.length,
            ...options.additionalMetadata,
        },
    }));
}
function splitIntoSentences(text) {
    // Split by sentence boundaries, keeping punctuation
    return text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}
function getOverlapText(text, targetTokens) {
    const words = text.split(/\s+/);
    const targetWords = Math.ceil(targetTokens * 1.3); // rough words from tokens
    return words.slice(-targetWords).join(' ');
}
function estimateCharCount(text) {
    return text.length;
}
//# sourceMappingURL=textChunker.js.map