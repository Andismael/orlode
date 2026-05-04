import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const app = express();
app.use(express.json());

// Auth middleware stub
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  (req as express.Request & { user?: unknown }).user = { uid: 'u1', companyId: 'co1', role: 'admin' };
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
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid URL' });
  }
  res.json({ success: true, message: 'Crawl started', jobId: 'job-123' });
});

app.post('/api/connectors/database/test', (req, res) => {
  const { type, host } = req.body;
  if (!type || !host) return res.status(400).json({ success: false, error: 'Missing fields' });
  res.json({ success: true, data: { ok: true, latency: 12 } });
});

app.post('/api/connectors/video/process', (req, res) => {
  const { source, url } = req.body;
  if (!source) return res.status(400).json({ success: false, error: 'Source required' });
  res.json({ success: true, data: { documentId: 'doc-v1', chunksCreated: 5, url } });
});

app.post('/api/connectors/audio/process', (req, res) => {
  const { source } = req.body;
  if (!source) return res.status(400).json({ success: false, error: 'Source required' });
  res.json({ success: true, data: { documentId: 'doc-a1', chunksCreated: 4 } });
});

app.post('/api/connectors/ecommerce/sync', (req, res) => {
  const { platform } = req.body;
  if (!platform) return res.status(400).json({ success: false, error: 'Platform required' });
  res.json({ success: true, data: { productsIndexed: 10, platform } });
});

describe('Connectors API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('GET /api/connectors', () => {
    it('should return connector stats', async () => {
      const response = await request(app)
        .get('/api/connectors')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalConnectors).toBeDefined();
      expect(response.body.data.totalChunks).toBeDefined();
    });

    it('should reject without auth', async () => {
      await request(app).get('/api/connectors').expect(401);
    });
  });

  describe('POST /api/connectors/web/crawl', () => {
    it('should start a web crawl', async () => {
      const response = await request(app)
        .post('/api/connectors/web/crawl')
        .set('Authorization', 'Bearer valid-token')
        .send({ siteUrl: 'https://example.com', maxPages: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('started');
    });

    it('should reject invalid URL', async () => {
      await request(app)
        .post('/api/connectors/web/crawl')
        .set('Authorization', 'Bearer valid-token')
        .send({ siteUrl: 'not-a-url' })
        .expect(400);
    });
  });

  describe('POST /api/connectors/database/test', () => {
    it('should test database connection', async () => {
      const response = await request(app)
        .post('/api/connectors/database/test')
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'mysql', host: 'localhost', port: 3306, database: 'test', username: 'user', password: 'pass' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ok).toBe(true);
    });
  });

  describe('POST /api/connectors/video/process', () => {
    it('should accept a YouTube URL', async () => {
      const response = await request(app)
        .post('/api/connectors/video/process')
        .set('Authorization', 'Bearer valid-token')
        .send({ source: 'youtube', url: 'https://www.youtube.com/watch?v=test123', category: 'training' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/connectors/ecommerce/sync', () => {
    it('should sync Shopify products', async () => {
      const response = await request(app)
        .post('/api/connectors/ecommerce/sync')
        .set('Authorization', 'Bearer valid-token')
        .send({ platform: 'shopify', shopUrl: 'test.myshopify.com', accessToken: 'token', syncProducts: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.platform).toBe('shopify');
    });
  });
});
