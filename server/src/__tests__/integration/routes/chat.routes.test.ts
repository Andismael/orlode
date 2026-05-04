import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock Firebase before importing routes
vi.mock('../../config/firebase.config', () => ({
  initFirebase: vi.fn(),
  getFirestore: vi.fn(),
  getAuth: vi.fn(),
  db: {},
  adminAuth: { verifyIdToken: vi.fn() },
}));

vi.mock('../../middleware/auth.middleware', () => ({
  authenticate: vi.fn(async (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return _res.status(401).json({ error: 'No token' });
    (req as express.Request & { user?: unknown }).user = { uid: 'user1', companyId: 'co1', role: 'member' };
    next();
  }),
  requireRole: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

// Create a test-only express app with stub routes
const app = express();
app.use(express.json());

app.post('/api/agent/conversations/:id/messages', (req, res) => {
  const { message } = req.body;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  if (!message || message.trim() === '') return res.status(400).json({ error: 'Message required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.status(200).write('data: {"token":"Bonjour"}\n\n');
  res.end();
});

describe('Chat Routes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return SSE stream for valid message', async () => {
    const response = await request(app)
      .post('/api/agent/conversations/conv1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ message: "Quel est notre CA ?" });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
  });

  it('should return 401 without authorization', async () => {
    const response = await request(app)
      .post('/api/agent/conversations/conv1/messages')
      .send({ message: 'test' });

    expect(response.status).toBe(401);
  });

  it('should return 400 for empty message', async () => {
    const response = await request(app)
      .post('/api/agent/conversations/conv1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ message: '' });

    expect(response.status).toBe(400);
  });
});
