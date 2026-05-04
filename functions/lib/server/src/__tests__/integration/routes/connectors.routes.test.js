"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Auth middleware stub
app.use((req, res, next) => {
    const token = req.headers.authorization;
    if (!token)
        return res.status(401).json({ error: 'Unauthorized' });
    req.user = { uid: 'u1', companyId: 'co1', role: 'admin' };
    next();
});
// Stub connector routes
app.get('/api/connectors', (_req, res) => {
    res.json({ success: true, data: { totalConnectors: 3, totalChunks: 1500, connectors: [] } });
});
app.post('/api/connectors/web/crawl', (req, res) => {
    const { siteUrl } = req.body;
    try {
        new URL(siteUrl);
    }
    catch {
        return res.status(400).json({ success: false, error: 'Invalid URL' });
    }
    res.json({ success: true, message: 'Crawl started', jobId: 'job-123' });
});
app.post('/api/connectors/database/test', (req, res) => {
    const { type, host } = req.body;
    if (!type || !host)
        return res.status(400).json({ success: false, error: 'Missing fields' });
    res.json({ success: true, data: { ok: true, latency: 12 } });
});
app.post('/api/connectors/video/process', (req, res) => {
    const { source, url } = req.body;
    if (!source)
        return res.status(400).json({ success: false, error: 'Source required' });
    res.json({ success: true, data: { documentId: 'doc-v1', chunksCreated: 5, url } });
});
app.post('/api/connectors/audio/process', (req, res) => {
    const { source } = req.body;
    if (!source)
        return res.status(400).json({ success: false, error: 'Source required' });
    res.json({ success: true, data: { documentId: 'doc-a1', chunksCreated: 4 } });
});
app.post('/api/connectors/ecommerce/sync', (req, res) => {
    const { platform } = req.body;
    if (!platform)
        return res.status(400).json({ success: false, error: 'Platform required' });
    res.json({ success: true, data: { productsIndexed: 10, platform } });
});
(0, vitest_1.describe)('Connectors API', () => {
    (0, vitest_1.beforeEach)(() => { vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.describe)('GET /api/connectors', () => {
        (0, vitest_1.it)('should return connector stats', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/connectors')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.totalConnectors).toBeDefined();
            (0, vitest_1.expect)(response.body.data.totalChunks).toBeDefined();
        });
        (0, vitest_1.it)('should reject without auth', async () => {
            await (0, supertest_1.default)(app).get('/api/connectors').expect(401);
        });
    });
    (0, vitest_1.describe)('POST /api/connectors/web/crawl', () => {
        (0, vitest_1.it)('should start a web crawl', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/connectors/web/crawl')
                .set('Authorization', 'Bearer valid-token')
                .send({ siteUrl: 'https://example.com', maxPages: 10 })
                .expect(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.message).toContain('started');
        });
        (0, vitest_1.it)('should reject invalid URL', async () => {
            await (0, supertest_1.default)(app)
                .post('/api/connectors/web/crawl')
                .set('Authorization', 'Bearer valid-token')
                .send({ siteUrl: 'not-a-url' })
                .expect(400);
        });
    });
    (0, vitest_1.describe)('POST /api/connectors/database/test', () => {
        (0, vitest_1.it)('should test database connection', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/connectors/database/test')
                .set('Authorization', 'Bearer valid-token')
                .send({ type: 'mysql', host: 'localhost', port: 3306, database: 'test', username: 'user', password: 'pass' })
                .expect(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.ok).toBe(true);
        });
    });
    (0, vitest_1.describe)('POST /api/connectors/video/process', () => {
        (0, vitest_1.it)('should accept a YouTube URL', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/connectors/video/process')
                .set('Authorization', 'Bearer valid-token')
                .send({ source: 'youtube', url: 'https://www.youtube.com/watch?v=test123', category: 'training' })
                .expect(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
        });
    });
    (0, vitest_1.describe)('POST /api/connectors/ecommerce/sync', () => {
        (0, vitest_1.it)('should sync Shopify products', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/connectors/ecommerce/sync')
                .set('Authorization', 'Bearer valid-token')
                .send({ platform: 'shopify', shopUrl: 'test.myshopify.com', accessToken: 'token', syncProducts: true })
                .expect(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.platform).toBe('shopify');
        });
    });
});
//# sourceMappingURL=connectors.routes.test.js.map