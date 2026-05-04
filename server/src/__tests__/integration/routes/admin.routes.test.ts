import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const app = express();
app.use(express.json());

// Role-aware auth stub
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const userMap: Record<string, { uid: string; role: string; companyId: string }> = {
    'admin-token':  { uid: 'admin1',  role: 'admin',  companyId: 'co1' },
    'member-token': { uid: 'member1', role: 'member', companyId: 'co1' },
    'valid-token':  { uid: 'user1',   role: 'member', companyId: 'co1' },
  };

  const user = userMap[token];
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  (req as express.Request & { user?: unknown }).user = user;
  next();
};

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as express.Request & { user?: { role: string } }).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
};

app.use(authMiddleware);

// Admin routes stubs
app.get('/api/admin/users', requireAdmin, (_req, res) => {
  res.json({ success: true, data: { users: [{ uid: 'u1', email: 'a@b.com', role: 'member' }], total: 1 } });
});

app.post('/api/admin/users/invite', requireAdmin, (req, res) => {
  const { email, role } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });
  if (email === 'existing@example.com') return res.status(409).json({ success: false, error: 'Email already exists' });
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

describe('Admin API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('GET /api/admin/users', () => {
    it('should return users list for admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });

    it('should reject non-admin users with 403', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer member-token')
        .expect(403);
    });

    it('should reject unauthenticated requests with 401', async () => {
      await request(app).get('/api/admin/users').expect(401);
    });
  });

  describe('POST /api/admin/users/invite', () => {
    it('should send an invitation', async () => {
      const response = await request(app)
        .post('/api/admin/users/invite')
        .set('Authorization', 'Bearer admin-token')
        .send({ email: 'newuser@example.com', role: 'member' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.inviteId).toBeDefined();
    });

    it('should reject duplicate email with 409', async () => {
      await request(app)
        .post('/api/admin/users/invite')
        .set('Authorization', 'Bearer admin-token')
        .send({ email: 'existing@example.com', role: 'member' })
        .expect(409);
    });

    it('should reject invite from non-admin', async () => {
      await request(app)
        .post('/api/admin/users/invite')
        .set('Authorization', 'Bearer member-token')
        .send({ email: 'someone@example.com', role: 'member' })
        .expect(403);
    });
  });

  describe('GET /api/admin/api-keys', () => {
    it('should return API keys for admin', async () => {
      const response = await request(app)
        .get('/api/admin/api-keys')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/admin/audit', () => {
    it('should return audit logs', async () => {
      const response = await request(app)
        .get('/api/admin/audit')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.logs)).toBe(true);
    });
  });
});
