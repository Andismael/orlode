"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webCrawlerService = exports.WebCrawlerService = void 0;
/**
 * Web Crawler Service
 * BFS crawl using built-in fetch + HTML stripping.
 * No external dependencies required.
 */
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../../utils/helpers");
const embeddingService_1 = require("../rag/embeddingService");
const firestoreVectorStore_1 = require("../rag/firestoreVectorStore");
const textChunker_1 = require("../rag/textChunker");
const logger_1 = require("../../utils/logger");
// ── HTML utilities ────────────────────────────────────────────────────────────
function stripHtml(html) {
    // Remove scripts, styles, nav, footer
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '');
    // Convert common block elements to newlines
    text = text.replace(/<\/(p|h[1-6]|li|div|section|article|blockquote)>/gi, '\n');
    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode HTML entities
    text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
    // Collapse whitespace
    return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
function extractTitle(html) {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m ? m[1].trim() : '';
}
function extractLinks(html, baseUrl) {
    const links = [];
    const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
        const href = match[1].trim();
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
            continue;
        try {
            const abs = new URL(href, baseUrl).href.split('#')[0] ?? '';
            if (abs)
                links.push(abs);
        }
        catch {
            // ignore malformed URLs
        }
    }
    return links;
}
function matchesPatterns(url, include, exclude) {
    if (exclude?.length) {
        const path = new URL(url).pathname;
        for (const p of exclude) {
            const pattern = p.replace(/\*/g, '.*');
            if (new RegExp(`^${pattern}`).test(path))
                return false;
        }
    }
    if (include?.length) {
        const path = new URL(url).pathname;
        return include.some((p) => {
            const pattern = p.replace(/\*/g, '.*');
            return new RegExp(`^${pattern}`).test(path);
        });
    }
    return true;
}
// ── Service ───────────────────────────────────────────────────────────────────
class WebCrawlerService {
    async crawlWebsite(config) {
        const db = (0, firebase_config_1.getFirestore)();
        const { companyId, siteUrl, maxPages, includePatterns, excludePatterns } = config;
        const origin = new URL(siteUrl).origin;
        const visited = new Set();
        const queue = [siteUrl];
        let chunksCreated = 0;
        let totalWords = 0;
        let errors = 0;
        logger_1.logger.info(`[WebCrawler] Starting crawl of ${siteUrl} for company ${companyId}`);
        while (queue.length > 0 && visited.size < maxPages) {
            const url = queue.shift();
            if (visited.has(url))
                continue;
            visited.add(url);
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);
                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Orlode-Crawler/1.0' },
                });
                clearTimeout(timeout);
                if (!response.ok)
                    continue;
                const contentType = response.headers.get('content-type') ?? '';
                if (!contentType.includes('text/html'))
                    continue;
                const html = await response.text();
                const title = extractTitle(html) || url;
                const text = stripHtml(html);
                if (text.split(/\s+/).length < 50)
                    continue; // skip thin pages
                // Save document record
                const docId = (0, helpers_1.generateId)();
                await db.collection(`companies/${companyId}/documents`).doc(docId).set({
                    id: docId,
                    fileName: title,
                    fileType: 'webpage',
                    fileUrl: url,
                    category: 'website',
                    tags: ['website', 'crawl'],
                    processing: { status: 'completed' },
                    metadata: { source: 'web_crawl', originalUrl: url },
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                // Chunk + embed
                const chunks = (0, textChunker_1.chunkText)(text, {
                    documentId: docId,
                    documentName: title,
                    companyId,
                    additionalMetadata: { source: url, category: 'website' },
                });
                const toUpsert = [];
                for (const chunk of chunks) {
                    const embedding = await (0, embeddingService_1.generateEmbedding)(chunk.text);
                    toUpsert.push({
                        id: chunk.id,
                        data: {
                            documentId: docId,
                            documentName: title,
                            content: chunk.text,
                            chunkIndex: chunk.chunkIndex,
                            metadata: {
                                category: 'website',
                                confidentiality: 'internal',
                                language: 'auto',
                                tokenCount: chunk.tokenCount,
                            },
                        },
                        embedding,
                    });
                }
                await firestoreVectorStore_1.firestoreVectorStore.upsertChunks(companyId, toUpsert);
                chunksCreated += chunks.length;
                totalWords += text.split(/\s+/).length;
                // Enqueue internal links
                for (const link of extractLinks(html, url)) {
                    const linkUrl = link.split('?')[0] ?? link;
                    if (linkUrl.startsWith(origin) &&
                        !visited.has(linkUrl) &&
                        matchesPatterns(linkUrl, includePatterns, excludePatterns)) {
                        queue.push(linkUrl);
                    }
                }
                logger_1.logger.debug(`[WebCrawler] Crawled ${url} — ${chunks.length} chunks`);
            }
            catch (err) {
                errors++;
                logger_1.logger.warn(`[WebCrawler] Failed to crawl ${url}`, { error: err });
            }
        }
        logger_1.logger.info(`[WebCrawler] Done: ${visited.size} pages, ${chunksCreated} chunks, ${errors} errors`);
        return {
            pagesFound: queue.length + visited.size,
            pagesCrawled: visited.size,
            chunksCreated,
            totalWords,
            errors,
        };
    }
    /** Delete all website chunks and re-crawl (for scheduled re-crawl) */
    async recrawl(companyId, config) {
        const db = (0, firebase_config_1.getFirestore)();
        // Delete old website docs
        const snapshot = await db
            .collection(`companies/${companyId}/documents`)
            .where('category', '==', 'website')
            .get();
        for (const doc of snapshot.docs) {
            await firestoreVectorStore_1.firestoreVectorStore.deleteByDocument(companyId, doc.id);
            await doc.ref.delete();
        }
        return this.crawlWebsite(config);
    }
    /** Save crawl config to Firestore for scheduled re-crawls */
    async saveConfig(companyId, config) {
        const db = (0, firebase_config_1.getFirestore)();
        // Firestore rejects undefined values — strip them before write
        const clean = Object.fromEntries(Object.entries({ type: 'web', ...config }).filter(([, v]) => v !== undefined));
        await db.collection(`companies/${companyId}/connectors`).doc('web').set({
            ...clean,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    async getConfig(companyId) {
        const db = (0, firebase_config_1.getFirestore)();
        const doc = await db.collection(`companies/${companyId}/connectors`).doc('web').get();
        if (!doc.exists)
            return null;
        return doc.data();
    }
}
exports.WebCrawlerService = WebCrawlerService;
exports.webCrawlerService = new WebCrawlerService();
//# sourceMappingURL=webCrawlerService.js.map