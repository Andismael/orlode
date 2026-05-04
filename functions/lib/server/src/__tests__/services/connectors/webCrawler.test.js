"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
// Mock the web crawler service
vitest_1.vi.mock('@/services/connectors/webCrawlerService', () => ({
    webCrawlerService: {
        crawlWebsite: vitest_1.vi.fn(),
    },
}));
const webCrawlerService_1 = require("@/services/connectors/webCrawlerService");
const htmlPage = (content = 'Hello world content here for testing purposes and more text.', links = []) => `<html><title>Test</title><body><p>${content}</p>${links.map(l => `<a href="${l}">link</a>`).join('')}</body></html>`;
(0, vitest_1.describe)('Web Crawler Service', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should crawl a single page and return results', async () => {
        vitest_1.vi.mocked(webCrawlerService_1.webCrawlerService.crawlWebsite).mockResolvedValue({
            pagesCrawled: 1,
            chunksCreated: 3,
            errors: 0,
        });
        const result = await webCrawlerService_1.webCrawlerService.crawlWebsite({
            companyId: 'co1',
            siteUrl: 'https://example.com',
            crawlDepth: 1,
            maxPages: 1,
            schedule: 'once',
        });
        (0, vitest_1.expect)(result.pagesCrawled).toBe(1);
        (0, vitest_1.expect)(result.chunksCreated).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.errors).toBe(0);
    });
    (0, vitest_1.it)('should respect the maxPages limit', async () => {
        vitest_1.vi.mocked(webCrawlerService_1.webCrawlerService.crawlWebsite).mockResolvedValue({
            pagesCrawled: 5,
            chunksCreated: 15,
            errors: 0,
        });
        const result = await webCrawlerService_1.webCrawlerService.crawlWebsite({
            companyId: 'co1',
            siteUrl: 'https://example.com',
            crawlDepth: 3,
            maxPages: 5,
            schedule: 'once',
        });
        (0, vitest_1.expect)(result.pagesCrawled).toBeLessThanOrEqual(5);
    });
    (0, vitest_1.it)('should handle fetch errors gracefully', async () => {
        vitest_1.vi.mocked(webCrawlerService_1.webCrawlerService.crawlWebsite).mockResolvedValue({
            pagesCrawled: 0,
            chunksCreated: 0,
            errors: 1,
        });
        const result = await webCrawlerService_1.webCrawlerService.crawlWebsite({
            companyId: 'co1',
            siteUrl: 'https://unreachable.example.com',
            crawlDepth: 1,
            maxPages: 1,
            schedule: 'once',
        });
        (0, vitest_1.expect)(result.errors).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.pagesCrawled).toBe(0);
    });
    (0, vitest_1.it)('should skip non-HTML responses', async () => {
        vitest_1.vi.mocked(webCrawlerService_1.webCrawlerService.crawlWebsite).mockResolvedValue({
            pagesCrawled: 0,
            chunksCreated: 0,
            errors: 0,
            skipped: 1,
        });
        const result = await webCrawlerService_1.webCrawlerService.crawlWebsite({
            companyId: 'co1',
            siteUrl: 'https://example.com/file.pdf',
            crawlDepth: 1,
            maxPages: 1,
            schedule: 'once',
        });
        (0, vitest_1.expect)(result.pagesCrawled).toBe(0);
    });
    (0, vitest_1.it)('should accept exclude patterns', async () => {
        vitest_1.vi.mocked(webCrawlerService_1.webCrawlerService.crawlWebsite).mockResolvedValue({
            pagesCrawled: 3,
            chunksCreated: 9,
            errors: 0,
        });
        const result = await webCrawlerService_1.webCrawlerService.crawlWebsite({
            companyId: 'co1',
            siteUrl: 'https://example.com',
            crawlDepth: 2,
            maxPages: 50,
            excludePatterns: ['/admin/*', '/login/*'],
            schedule: 'once',
        });
        (0, vitest_1.expect)(result).toBeDefined();
        (0, vitest_1.expect)(webCrawlerService_1.webCrawlerService.crawlWebsite).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ excludePatterns: ['/admin/*', '/login/*'] }));
    });
});
//# sourceMappingURL=webCrawler.test.js.map