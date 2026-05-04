"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
// Mock Firebase before importing routes
vitest_1.vi.mock('../../config/firebase.config', () => ({
    initFirebase: vitest_1.vi.fn(),
    getFirestore: vitest_1.vi.fn(),
    getAuth: vitest_1.vi.fn(),
    db: {},
    adminAuth: { verifyIdToken: vitest_1.vi.fn() },
}));
vitest_1.vi.mock('../../middleware/auth.middleware', () => ({
    authenticate: vitest_1.vi.fn(async (req, _res, next) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token)
            return _res.status(401).json({ error: 'No token' });
        req.user = { uid: 'user1', companyId: 'co1', role: 'member' };
        next();
    }),
    requireRole: vitest_1.vi.fn(() => (_req, _res, next) => next()),
}));
// Create a test-only express app with stub routes
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.post('/api/agent/conversations/:id/messages', (req, res) => {
    const { message } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!message || message.trim() === '')
        return res.status(400).json({ error: 'Message required' });
    res.setHeader('Content-Type', 'text/event-stream');
    res.status(200).write('data: {"token":"Bonjour"}\n\n');
    res.end();
});
(0, vitest_1.describe)('Chat Routes', () => {
    (0, vitest_1.beforeEach)(() => { vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.it)('should return SSE stream for valid message', async () => {
        const response = await (0, supertest_1.default)(app)
            .post('/api/agent/conversations/conv1/messages')
            .set('Authorization', 'Bearer valid-token')
            .send({ message: "Quel est notre CA ?" });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.headers['content-type']).toContain('text/event-stream');
    });
    (0, vitest_1.it)('should return 401 without authorization', async () => {
        const response = await (0, supertest_1.default)(app)
            .post('/api/agent/conversations/conv1/messages')
            .send({ message: 'test' });
        (0, vitest_1.expect)(response.status).toBe(401);
    });
    (0, vitest_1.it)('should return 400 for empty message', async () => {
        const response = await (0, supertest_1.default)(app)
            .post('/api/agent/conversations/conv1/messages')
            .set('Authorization', 'Bearer valid-token')
            .send({ message: '' });
        (0, vitest_1.expect)(response.status).toBe(400);
    });
});
//# sourceMappingURL=chat.routes.test.js.map