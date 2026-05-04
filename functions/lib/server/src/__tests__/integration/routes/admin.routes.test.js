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
// Role-aware auth stub
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token)
        return res.status(401).json({ error: 'Unauthorized' });
    const userMap = {
        'admin-token': { uid: 'admin1', role: 'admin', companyId: 'co1' },
        'member-token': { uid: 'member1', role: 'member', companyId: 'co1' },
        'valid-token': { uid: 'user1', role: 'member', companyId: 'co1' },
    };
    const user = userMap[token];
    if (!user)
        return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
};
const requireAdmin = (req, res, next) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'admin')
        return res.status(403).json({ error: 'Forbidden' });
    next();
};
app.use(authMiddleware);
// Admin routes stubs
app.get('/api/admin/users', requireAdmin, (_req, res) => {
    res.json({ success: true, data: { users: [{ uid: 'u1', email: 'a@b.com', role: 'member' }], total: 1 } });
});
app.post('/api/admin/users/invite', requireAdmin, (req, res) => {
    const { email, role } = req.body;
    if (!email)
        return res.status(400).json({ success: false, error: 'Email required' });
    if (email === 'existing@example.com')
        return res.status(409).json({ success: false, error: 'Email already exists' });
    res.json({ success: true, data: { email, role, inviteId: `inv-${Date.now()}` } });
});
app.get('/api/admin/api-keys', requireAdmin, (_req, res) => {
    res.json({ success: true, data: { keys: [{ provider: 'gemini', status: 'valid' }] } });
});
app.put('/api/admin/agents/:name/config', requireAdmin, (req, res) => {
    const { name } = req.params;
    res.json({ success: true, data: { agentName: name, updated: true } });
});
app.get('/api/admin/audit', requireAdmin, (_req, res) => {
    res.json({ success: true, data: { logs: [], total: 0 } });
});
(0, vitest_1.describe)('Admin API', () => {
    (0, vitest_1.beforeEach)(() => { vitest_1.vi.clearAllMocks(); });
    (0, vitest_1.describe)('GET /api/admin/users', () => {
        (0, vitest_1.it)('should return users list for admin', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/admin/users')
                .set('Authorization', 'Bearer admin-token')
                .expect(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(response.body.data.users)).toBe(true);
        });
        (0, vitest_1.it)('should reject non-admin users with 403', async () => {
            await (0, supertest_1.default)(app)
                .get('/api/admin/users')
                .set('Authorization', 'Bearer member-token')
                .expect(403);
        });
        (0, vitest_1.it)('should reject unauthenticated requests with 401', async () => {
            await (0, supertest_1.default)(app).get('/api/admin/users').expect(401);
        });
    });
    (0, vitest_1.describe)('POST /api/admin/users/invite', () => {
        (0, vitest_1.it)('should send an invitation', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/admin/users/invite')
                .set('Authorization', 'Bearer admin-token')
                .send({ email: 'newuser@example.com', role: 'member' })
                .expect(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.inviteId).toBeDefined();
        });
        (0, vitest_1.it)('should reject duplicate email with 409', async () => {
            await (0, supertest_1.default)(app)
                .post('/api/admin/users/invite')
                .set('Authorization', 'Bearer admin-token')
                .send({ email: 'existing@example.com', role: 'member' })
                .expect(409);
        });
        (0, vitest_1.it)('should reject invite from non-admin', async () => {
            await (0, supertest_1.default)(app)
                .post('/api/admin/users/invite')
                .set('Authorization', 'Bearer member-token')
                .send({ email: 'someone@example.com', role: 'member' })
                .expect(403);
        });
    });
    (0, vitest_1.describe)('GET /api/admin/api-keys', () => {
        (0, vitest_1.it)('should return API keys for admin', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/admin/api-keys')
                .set('Authorization', 'Bearer admin-token')
                .expect(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
        });
    });
    (0, vitest_1.describe)('GET /api/admin/audit', () => {
        (0, vitest_1.it)('should return audit logs', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/admin/audit')
                .set('Authorization', 'Bearer admin-token')
                .expect(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(response.body.data.logs)).toBe(true);
        });
    });
});
//# sourceMappingURL=admin.routes.test.js.map