"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../setup");
// Mock firebase-admin to use our mock auth
vitest_1.vi.mock('firebase-admin', () => ({
    auth: vitest_1.vi.fn(() => setup_1.mockAuth),
    apps: [{}],
}));
// Import middleware after mocks are set up
const { authenticate, requireRole } = await Promise.resolve().then(() => __importStar(require('@/middleware/auth.middleware')));
function makeRes() {
    const res = {
        status: vitest_1.vi.fn().mockReturnThis(),
        json: vitest_1.vi.fn().mockReturnThis(),
    };
    return res;
}
(0, vitest_1.describe)('Auth Middleware — authenticate', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should reject requests with no Authorization header', async () => {
        const req = { headers: {} };
        const res = makeRes();
        const next = vitest_1.vi.fn();
        await authenticate(req, res, next);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(401);
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('should reject malformed Authorization header (no Bearer)', async () => {
        const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
        const res = makeRes();
        const next = vitest_1.vi.fn();
        await authenticate(req, res, next);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(401);
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('should accept valid token and call next()', async () => {
        const req = { headers: { authorization: 'Bearer valid-token' } };
        const res = makeRes();
        const next = vitest_1.vi.fn();
        await authenticate(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalled();
        (0, vitest_1.expect)(req.user).toBeDefined();
    });
    (0, vitest_1.it)('should reject expired/invalid token', async () => {
        setup_1.mockAuth.verifyIdToken.mockRejectedValueOnce(new Error('Token expired'));
        const req = { headers: { authorization: 'Bearer expired-token' } };
        const res = makeRes();
        const next = vitest_1.vi.fn();
        await authenticate(req, res, next);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(401);
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    });
});
(0, vitest_1.describe)('Auth Middleware — requireRole', () => {
    (0, vitest_1.it)('should deny access when user lacks required role', async () => {
        const req = { user: { uid: 'u1', role: 'member', companyId: 'co1' } };
        const res = makeRes();
        const next = vitest_1.vi.fn();
        const middleware = requireRole(['admin', 'superadmin']);
        await middleware(req, res, next);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(403);
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('should allow access when user has required role', async () => {
        const req = { user: { uid: 'u1', role: 'admin', companyId: 'co1' } };
        const res = makeRes();
        const next = vitest_1.vi.fn();
        const middleware = requireRole(['admin']);
        await middleware(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalled();
    });
    (0, vitest_1.it)('should allow access for superadmin regardless of listed roles', async () => {
        const req = { user: { uid: 'u1', role: 'superadmin', companyId: 'co1' } };
        const res = makeRes();
        const next = vitest_1.vi.fn();
        const middleware = requireRole(['admin']);
        await middleware(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalled();
    });
    (0, vitest_1.it)('should return 401 when no user attached to request', async () => {
        const req = {};
        const res = makeRes();
        const next = vitest_1.vi.fn();
        const middleware = requireRole(['admin']);
        await middleware(req, res, next);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(401);
    });
});
//# sourceMappingURL=auth.middleware.test.js.map