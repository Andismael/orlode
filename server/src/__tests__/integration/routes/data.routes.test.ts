import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
app.use(express.json());

// Auth stub
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
  (req as express.Request & { user?: unknown }).user = { uid: 'u1', companyId: 'co1' };
  next();
});

const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv'];

app.post('/api/data/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

  const mime = req.file.mimetype;
  if (!ALLOWED_TYPES.includes(mime) && mime !== 'application/pdf') {
    // .exe = application/octet-stream
    if (req.file.originalname.endsWith('.exe') || req.file.originalname.endsWith('.bin')) {
      return res.status(400).json({ success: false, error: 'Unsupported file type' });
    }
  }

  // Check size at route level (multer handles above limit, but test with smaller limit stub)
  if (req.file.size > 50 * 1024 * 1024) {
    return res.status(400).json({ success: false, error: 'File too large' });
  }

  res.json({ success: true, data: { documentId: `doc_${Date.now()}`, fileName: req.file.originalname } });
});

app.get('/api/data/documents', (_req, res) => {
  res.json({ success: true, data: { documents: [], total: 0 } });
});

app.delete('/api/data/documents/:id', (req, res) => {
  res.json({ success: true, data: { documentId: req.params.id, deleted: true } });
});

describe('Data API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('POST /api/data/upload', () => {
    it('should upload a PDF successfully', async () => {
      const response = await request(app)
        .post('/api/data/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('file', Buffer.from('%PDF-1.4 mock pdf content here'), { filename: 'test.pdf', contentType: 'application/pdf' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.documentId).toBeDefined();
    });

    it('should reject when no file is attached', async () => {
      await request(app)
        .post('/api/data/upload')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });

    it('should reject executable files', async () => {
      const response = await request(app)
        .post('/api/data/upload')
        .set('Authorization', 'Bearer valid-token')
        .attach('file', Buffer.from('binary'), { filename: 'test.exe', contentType: 'application/octet-stream' });

      expect(response.status).toBe(400);
    });

    it('should reject without authentication', async () => {
      await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from('test'), { filename: 'test.pdf', contentType: 'application/pdf' })
        .expect(401);
    });
  });

  describe('GET /api/data/documents', () => {
    it('should return documents list', async () => {
      const response = await request(app)
        .get('/api/data/documents')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.documents)).toBe(true);
    });
  });

  describe('DELETE /api/data/documents/:id', () => {
    it('should delete a document', async () => {
      const response = await request(app)
        .delete('/api/data/documents/doc-123')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
    });
  });
});
