import { vi } from 'vitest';

// ── Mock Firebase Admin ───────────────────────────────────────────
vi.mock('../config/firebase.config', () => ({
  getFirestore: vi.fn(() => mockFirestore),
  getStorage: vi.fn(() => mockStorage),
  getAuth: vi.fn(() => mockAuth),
  db: mockFirestore,
  storage: mockStorage,
  adminAuth: mockAuth,
}));

// ── Mock Genkit / AI ──────────────────────────────────────────────
vi.mock('../config/genkit.config', () => ({
  ai: {
    generate: vi.fn(),
    embed: vi.fn(),
  },
  GEMINI_FLASH: 'gemini-2.0-flash',
  GEMINI_PRO: 'gemini-2.0-pro',
}));

// ── Mock encryption ───────────────────────────────────────────────
vi.mock('../config/encryption', () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace('encrypted_', '')),
}));

// ── Firestore Mock ────────────────────────────────────────────────
const mockDocs = new Map<string, Record<string, unknown>>();

const mockFirestore = {
  collection: vi.fn((collPath: string) => ({
    doc: vi.fn((id: string) => ({
      set: vi.fn(async (data: unknown) => {
        mockDocs.set(`${collPath}/${id}`, data as Record<string, unknown>);
      }),
      get: vi.fn(async () => ({
        exists: mockDocs.has(`${collPath}/${id}`),
        data: () => mockDocs.get(`${collPath}/${id}`),
        id,
        ref: { delete: vi.fn() },
      })),
      update: vi.fn(async (data: unknown) => {
        const existing = mockDocs.get(`${collPath}/${id}`) ?? {};
        mockDocs.set(`${collPath}/${id}`, { ...existing, ...(data as Record<string, unknown>) });
      }),
      delete: vi.fn(async () => {
        mockDocs.delete(`${collPath}/${id}`);
      }),
    })),
    add: vi.fn(async (data: unknown) => {
      const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      mockDocs.set(`${collPath}/${id}`, data as Record<string, unknown>);
      return { id };
    }),
    get: vi.fn(async () => ({
      docs: Array.from(mockDocs.entries())
        .filter(([key]) => key.startsWith(`${collPath}/`))
        .map(([key, data]) => ({
          id: key.split('/').pop(),
          data: () => data,
          ref: { delete: vi.fn() },
          exists: true,
        })),
      empty: mockDocs.size === 0,
      forEach: vi.fn(),
    })),
    where: vi.fn(() => ({
      get: vi.fn(async () => ({ docs: [], empty: true, forEach: vi.fn() })),
      where: vi.fn(() => ({
        get: vi.fn(async () => ({ docs: [], empty: true })),
      })),
      limit: vi.fn(() => ({
        get: vi.fn(async () => ({ docs: [], empty: true })),
      })),
    })),
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn(async () => ({ docs: [], empty: true })),
      })),
      get: vi.fn(async () => ({ docs: [], empty: true })),
    })),
    count: vi.fn(() => ({
      get: vi.fn(async () => ({ data: () => ({ count: 0 }) })),
    })),
    limit: vi.fn(() => ({
      get: vi.fn(async () => ({ docs: [], empty: true })),
    })),
  })),
  batch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(async () => {}),
  })),
  runTransaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn({})),
};

const mockStorage = {
  bucket: vi.fn(() => ({
    file: vi.fn(() => ({
      save: vi.fn(async () => {}),
      download: vi.fn(async () => [Buffer.from('mock-file')]),
      delete: vi.fn(async () => {}),
      getSignedUrl: vi.fn(async () => ['https://mock-url.com']),
      exists: vi.fn(async () => [true]),
    })),
  })),
};

const mockAuth = {
  verifyIdToken: vi.fn(async (token: string) => {
    if (token === 'valid-token' || token === 'test-token') {
      return { uid: 'user1', email: 'test@example.com', companyId: 'test-company' };
    }
    if (token === 'admin-token') {
      return { uid: 'admin1', email: 'admin@example.com', companyId: 'test-company', role: 'admin' };
    }
    if (token === 'member-token') {
      return { uid: 'member1', email: 'member@example.com', companyId: 'test-company', role: 'member' };
    }
    throw new Error('Invalid token');
  }),
  getUser: vi.fn(async (uid: string) => ({ uid, email: `${uid}@example.com` })),
  createUser: vi.fn(async (data: unknown) => ({ uid: 'new-user', ...data as object })),
  updateUser: vi.fn(async () => {}),
  deleteUser: vi.fn(async () => {}),
  listUsers: vi.fn(async () => ({ users: [] })),
};

// ── Helper to reset between tests ─────────────────────────────────
export function clearMockFirestore() {
  mockDocs.clear();
}

export function seedMockDoc(path: string, data: Record<string, unknown>) {
  mockDocs.set(path, data);
}

export { mockFirestore, mockStorage, mockAuth, mockDocs };
