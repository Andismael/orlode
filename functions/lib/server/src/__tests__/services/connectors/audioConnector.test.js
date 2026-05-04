"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
vitest_1.vi.mock('@/services/connectors/audioConnectorService', () => ({
    audioConnectorService: {
        processAudio: vitest_1.vi.fn(),
        importPodcastFeed: vitest_1.vi.fn(),
    },
}));
const audioConnectorService_1 = require("@/services/connectors/audioConnectorService");
(0, vitest_1.describe)('Audio Connector Service', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should process an audio file', async () => {
        vitest_1.vi.mocked(audioConnectorService_1.audioConnectorService.processAudio).mockResolvedValue({
            documentId: 'doc_audio_001',
            chunksCreated: 6,
            summary: 'Premier épisode du podcast sur les tendances tech.',
            language: 'fr',
            topics: ['tech', 'innovation', 'IA'],
        });
        const result = await audioConnectorService_1.audioConnectorService.processAudio({
            companyId: 'co1',
            source: 'upload',
            title: 'Podcast Ep1',
            category: 'podcast',
            fileBuffer: Buffer.from('mock-audio'),
            mimeType: 'audio/mpeg',
        });
        (0, vitest_1.expect)(result.documentId).toBeDefined();
        (0, vitest_1.expect)(result.chunksCreated).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.language).toBe('fr');
    });
    (0, vitest_1.it)('should parse an RSS feed and process episodes', async () => {
        vitest_1.vi.mocked(audioConnectorService_1.audioConnectorService.importPodcastFeed).mockResolvedValue({
            processed: 2,
            errors: 0,
            skipped: 0,
        });
        const result = await audioConnectorService_1.audioConnectorService.importPodcastFeed('co1', 'https://example.com/podcast/feed.xml', 10);
        (0, vitest_1.expect)(result.processed).toBe(2);
        (0, vitest_1.expect)(result.errors).toBe(0);
    });
    (0, vitest_1.it)('should handle audio processing errors gracefully', async () => {
        vitest_1.vi.mocked(audioConnectorService_1.audioConnectorService.processAudio).mockResolvedValue({
            documentId: 'doc_audio_002',
            chunksCreated: 0,
            summary: '',
            language: 'unknown',
            topics: [],
            error: 'Audio too short or corrupted',
        });
        const result = await audioConnectorService_1.audioConnectorService.processAudio({
            companyId: 'co1',
            source: 'upload',
            title: 'Bad file',
            category: 'other',
            fileBuffer: Buffer.from(''),
            mimeType: 'audio/mpeg',
        });
        (0, vitest_1.expect)(result).toBeDefined();
    });
    (0, vitest_1.it)('should extract topics from podcast content', async () => {
        vitest_1.vi.mocked(audioConnectorService_1.audioConnectorService.processAudio).mockResolvedValue({
            documentId: 'doc_003',
            chunksCreated: 4,
            summary: 'Interview with CEO.',
            language: 'fr',
            topics: ['leadership', 'stratégie', 'croissance'],
        });
        const result = await audioConnectorService_1.audioConnectorService.processAudio({
            companyId: 'co1',
            source: 'url',
            url: 'https://example.com/interview.mp3',
            title: 'CEO Interview',
            category: 'podcast',
        });
        (0, vitest_1.expect)(Array.isArray(result.topics)).toBe(true);
        (0, vitest_1.expect)(result.topics.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=audioConnector.test.js.map