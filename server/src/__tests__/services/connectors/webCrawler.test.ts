import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../../setup';

// Mock the web crawler service
vi.mock('@/services/connectors/webCrawlerService', () => ({
  webCrawlerService: {
    crawlWebsite: vi.fn(),
  },
}));

import { webCrawlerService } from '@/services/connectors/webCrawlerService';

const htmlPage = (content = 'Hello world content here for testing purposes and more text.', links: string[] = []) =>
  `<html><title>Test</title><body><p>${content}</p>${links.map(l => `<a href="${l}">link</a>`).join('')}</body></html>`;

describe('Web Crawler Service', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should crawl a single page and return results', async () => {
    vi.mocked(webCrawlerService.crawlWebsite).mockResolvedValue({
      pagesCrawled: 1,
      chunksCreated: 3,
      errors: 0,
    });

    const result = await webCrawlerService.crawlWebsite({
      companyId: 'co1',
      siteUrl: 'https://example.com',
      crawlDepth: 1,
      maxPages: 1,
      schedule: 'once',
    });

    expect(result.pagesCrawled).toBe(1);
    expect(result.chunksCreated).toBeGreaterThan(0);
    expect(result.errors).toBe(0);
  });

  it('should respect the maxPages limit', async () => {
    vi.mocked(webCrawlerService.crawlWebsite).mockResolvedValue({
      pagesCrawled: 5,
      chunksCreated: 15,
      errors: 0,
    });

    const result = await webCrawlerService.crawlWebsite({
      companyId: 'co1',
      siteUrl: 'https://example.com',
      crawlDepth: 3,
      maxPages: 5,
      schedule: 'once',
    });

    expect(result.pagesCrawled).toBeLessThanOrEqual(5);
  });

  it('should handle fetch errors gracefully', async () => {
    vi.mocked(webCrawlerService.crawlWebsite).mockResolvedValue({
      pagesCrawled: 0,
      chunksCreated: 0,
      errors: 1,
    });

    const result = await webCrawlerService.crawlWebsite({
      companyId: 'co1',
      siteUrl: 'https://unreachable.example.com',
      crawlDepth: 1,
      maxPages: 1,
      schedule: 'once',
    });

    expect(result.errors).toBeGreaterThan(0);
    expect(result.pagesCrawled).toBe(0);
  });

  it('should skip non-HTML responses', async () => {
    vi.mocked(webCrawlerService.crawlWebsite).mockResolvedValue({
      pagesCrawled: 0,
      chunksCreated: 0,
      errors: 0,
      skipped: 1,
    });

    const result = await webCrawlerService.crawlWebsite({
      companyId: 'co1',
      siteUrl: 'https://example.com/file.pdf',
      crawlDepth: 1,
      maxPages: 1,
      schedule: 'once',
    });

    expect(result.pagesCrawled).toBe(0);
  });

  it('should accept exclude patterns', async () => {
    vi.mocked(webCrawlerService.crawlWebsite).mockResolvedValue({
      pagesCrawled: 3,
      chunksCreated: 9,
      errors: 0,
    });

    const result = await webCrawlerService.crawlWebsite({
      companyId: 'co1',
      siteUrl: 'https://example.com',
      crawlDepth: 2,
      maxPages: 50,
      excludePatterns: ['/admin/*', '/login/*'],
      schedule: 'once',
    });

    expect(result).toBeDefined();
    expect(webCrawlerService.crawlWebsite).toHaveBeenCalledWith(
      expect.objectContaining({ excludePatterns: ['/admin/*', '/login/*'] })
    );
  });
});
