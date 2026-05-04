"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
vitest_1.vi.mock('@/services/connectors/videoConnectorService', () => ({
    videoConnectorService: {
        processVideo: vitest_1.vi.fn(),
    },
}));
const videoConnectorService_1 = require("@/services/connectors/videoConnectorService");
(0, vitest_1.describe)('Video Connector Service', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should process a video and create chunks', async () => {
        vitest_1.vi.mocked(videoConnectorService_1.videoConnectorService.processVideo).mockResolvedValue({
            documentId: 'doc_vid_001',
            chunksCreated: 8,
            summary: 'Discussion sur le budget Q3 et les prévisions 2026.',
            language: 'fr',
            topics: ['budget', 'Q3', 'prévisions'],
            duration: 1800,
        });
        const result = await videoConnectorService_1.videoConnectorService.processVideo({
            companyId: 'co1',
            source: 'url',
            url: 'https://example.com/video.mp4',
            title: 'Réunion Q3',
            category: 'meeting',
            fileBuffer: Buffer.from('mock-video'),
            mimeType: 'video/mp4',
        });
        (0, vitest_1.expect)(result.documentId).toBeDefined();
        (0, vitest_1.expect)(result.chunksCreated).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.summary).toContain('budget');
        (0, vitest_1.expect)(result.topics).toContain('Q3');
    });
    (0, vitest_1.it)('should accept YouTube URL as source', async () => {
        vitest_1.vi.mocked(videoConnectorService_1.videoConnectorService.processVideo).mockResolvedValue({
            documentId: 'doc_yt_001',
            chunksCreated: 5,
            summary: 'Training video on compliance.',
            language: 'en',
            topics: ['compliance', 'training'],
        });
        const result = await videoConnectorService_1.videoConnectorService.processVideo({
            companyId: 'co1',
            source: 'youtube',
            url: 'https://youtube.com/watch?v=test123',
            title: 'Compliance Training',
            category: 'training',
        });
        (0, vitest_1.expect)(result.documentId).toBeDefined();
        (0, vitest_1.expect)(result.topics).toContain('compliance');
    });
    (0, vitest_1.it)('should extract topics from video transcript', async () => {
        vitest_1.vi.mocked(videoConnectorService_1.videoConnectorService.processVideo).mockResolvedValue({
            documentId: 'doc_002',
            chunksCreated: 4,
            summary: 'Tech talk summary.',
            language: 'fr',
            topics: ['react', 'typescript', 'testing'],
        });
        const result = await videoConnectorService_1.videoConnectorService.processVideo({
            companyId: 'co1',
            source: 'upload',
            title: 'Tech Talk',
            category: 'training',
            fileBuffer: Buffer.from('mock-video-data'),
            mimeType: 'video/webm',
        });
        (0, vitest_1.expect)(Array.isArray(result.topics)).toBe(true);
        (0, vitest_1.expect)(result.topics.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=videoConnector.test.js.map