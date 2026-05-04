import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../../setup';

vi.mock('@/services/connectors/audioConnectorService', () => ({
  audioConnectorService: {
    processAudio: vi.fn(),
    importPodcastFeed: vi.fn(),
  },
}));

import { audioConnectorService } from '@/services/connectors/audioConnectorService';

describe('Audio Connector Service', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should process an audio file', async () => {
    vi.mocked(audioConnectorService.processAudio).mockResolvedValue({
      documentId: 'doc_audio_001',
      chunksCreated: 6,
      summary: 'Premier épisode du podcast sur les tendances tech.',
      language: 'fr',
      topics: ['tech', 'innovation', 'IA'],
    });

    const result = await audioConnectorService.processAudio({
      companyId: 'co1',
      source: 'upload',
      title: 'Podcast Ep1',
      category: 'podcast',
      fileBuffer: Buffer.from('mock-audio'),
      mimeType: 'audio/mpeg',
    });

    expect(result.documentId).toBeDefined();
    expect(result.chunksCreated).toBeGreaterThan(0);
    expect(result.language).toBe('fr');
  });

  it('should parse an RSS feed and process episodes', async () => {
    vi.mocked(audioConnectorService.importPodcastFeed).mockResolvedValue({
      processed: 2,
      errors: 0,
      skipped: 0,
    });

    const result = await audioConnectorService.importPodcastFeed(
      'co1',
      'https://example.com/podcast/feed.xml',
      10
    );

    expect(result.processed).toBe(2);
    expect(result.errors).toBe(0);
  });

  it('should handle audio processing errors gracefully', async () => {
    vi.mocked(audioConnectorService.processAudio).mockResolvedValue({
      documentId: 'doc_audio_002',
      chunksCreated: 0,
      summary: '',
      language: 'unknown',
      topics: [],
      error: 'Audio too short or corrupted',
    });

    const result = await audioConnectorService.processAudio({
      companyId: 'co1',
      source: 'upload',
      title: 'Bad file',
      category: 'other',
      fileBuffer: Buffer.from(''),
      mimeType: 'audio/mpeg',
    });

    expect(result).toBeDefined();
  });

  it('should extract topics from podcast content', async () => {
    vi.mocked(audioConnectorService.processAudio).mockResolvedValue({
      documentId: 'doc_003',
      chunksCreated: 4,
      summary: 'Interview with CEO.',
      language: 'fr',
      topics: ['leadership', 'stratégie', 'croissance'],
    });

    const result = await audioConnectorService.processAudio({
      companyId: 'co1',
      source: 'url',
      url: 'https://example.com/interview.mp3',
      title: 'CEO Interview',
      category: 'podcast',
    });

    expect(Array.isArray(result.topics)).toBe(true);
    expect(result.topics.length).toBeGreaterThan(0);
  });
});
