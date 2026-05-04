import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth } from '../setup';

// Mock firebase-admin to use our mock auth
vi.mock('firebase-admin', () => ({
  auth: vi.fn(() => mockAuth),
  apps: [{}],
}));

// Import middleware after mocks are set up
const { authenticate, requireRole } = await import('@/middleware/auth.middleware');

interface MockRequest {
  headers: Record<string, string>;
  user?: Record<string, unknown>;
}
interface MockResponse {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function makeRes(): MockResponse {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('Auth Middleware — authenticate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject requests with no Authorization header', async () => {
    const req: MockRequest = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject malformed Authorization header (no Bearer)', async () => {
    const req: MockRequest = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept valid token and call next()', async () => {
    const req: MockRequest = { headers: { authorization: 'Bearer valid-token' } };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
    expect((req as { user?: unknown }).user).toBeDefined();
  });

  it('should reject expired/invalid token', async () => {
    mockAuth.verifyIdToken.mockRejectedValueOnce(new Error('Token expired'));

    const req: MockRequest = { headers: { authorization: 'Bearer expired-token' } };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Auth Middleware — requireRole', () => {
  it('should deny access when user lacks required role', async () => {
    const req = { user: { uid: 'u1', role: 'member', companyId: 'co1' } };
    const res = makeRes();
    const next = vi.fn();

    const middleware = requireRole(['admin', 'superadmin']);
    await middleware(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow access when user has required role', async () => {
    const req = { user: { uid: 'u1', role: 'admin', companyId: 'co1' } };
    const res = makeRes();
    const next = vi.fn();

    const middleware = requireRole(['admin']);
    await middleware(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow access for superadmin regardless of listed roles', async () => {
    const req = { user: { uid: 'u1', role: 'superadmin', companyId: 'co1' } };
    const res = makeRes();
    const next = vi.fn();

    const middleware = requireRole(['admin']);
    await middleware(req as never, res as never, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 401 when no user attached to request', async () => {
    const req = {};
    const res = makeRes();
    const next = vi.fn();

    const middleware = requireRole(['admin']);
    await middleware(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
