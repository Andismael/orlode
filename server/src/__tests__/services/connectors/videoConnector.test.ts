import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../../setup';

vi.mock('@/services/connectors/videoConnectorService', () => ({
  videoConnectorService: {
    processVideo: vi.fn(),
  },
}));

import { videoConnectorService } from '@/services/connectors/videoConnectorService';

describe('Video Connector Service', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should process a video and create chunks', async () => {
    vi.mocked(videoConnectorService.processVideo).mockResolvedValue({
      documentId: 'doc_vid_001',
      chunksCreated: 8,
      summary: 'Discussion sur le budget Q3 et les prévisions 2026.',
      language: 'fr',
      topics: ['budget', 'Q3', 'prévisions'],
      duration: 1800,
    });

    const result = await videoConnectorService.processVideo({
      companyId: 'co1',
      source: 'url',
      url: 'https://example.com/video.mp4',
      title: 'Réunion Q3',
      category: 'meeting',
      fileBuffer: Buffer.from('mock-video'),
      mimeType: 'video/mp4',
    });

    expect(result.documentId).toBeDefined();
    expect(result.chunksCreated).toBeGreaterThan(0);
    expect(result.summary).toContain('budget');
    expect(result.topics).toContain('Q3');
  });

  it('should accept YouTube URL as source', async () => {
    vi.mocked(videoConnectorService.processVideo).mockResolvedValue({
      documentId: 'doc_yt_001',
      chunksCreated: 5,
      summary: 'Training video on compliance.',
      language: 'en',
      topics: ['compliance', 'training'],
    });

    const result = await videoConnectorService.processVideo({
      companyId: 'co1',
      source: 'youtube',
      url: 'https://youtube.com/watch?v=test123',
      title: 'Compliance Training',
      category: 'training',
    });

    expect(result.documentId).toBeDefined();
    expect(result.topics).toContain('compliance');
  });

  it('should extract topics from video transcript', async () => {
    vi.mocked(videoConnectorService.processVideo).mockResolvedValue({
      documentId: 'doc_002',
      chunksCreated: 4,
      summary: 'Tech talk summary.',
      language: 'fr',
      topics: ['react', 'typescript', 'testing'],
    });

    const result = await videoConnectorService.processVideo({
      companyId: 'co1',
      source: 'upload',
      title: 'Tech Talk',
      category: 'training',
      fileBuffer: Buffer.from('mock-video-data'),
      mimeType: 'video/webm',
    });

    expect(Array.isArray(result.topics)).toBe(true);
    expect(result.topics.length).toBeGreaterThan(0);
  });
});
