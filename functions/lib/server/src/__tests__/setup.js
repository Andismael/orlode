"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockDocs = exports.mockAuth = exports.mockStorage = exports.mockFirestore = void 0;
exports.clearMockFirestore = clearMockFirestore;
exports.seedMockDoc = seedMockDoc;
const vitest_1 = require("vitest");
// ── Mock Firebase Admin ───────────────────────────────────────────
vitest_1.vi.mock('../config/firebase.config', () => ({
    getFirestore: vitest_1.vi.fn(() => mockFirestore),
    getStorage: vitest_1.vi.fn(() => mockStorage),
    getAuth: vitest_1.vi.fn(() => mockAuth),
    db: mockFirestore,
    storage: mockStorage,
    adminAuth: mockAuth,
}));
// ── Mock Genkit / AI ──────────────────────────────────────────────
vitest_1.vi.mock('../config/genkit.config', () => ({
    ai: {
        generate: vitest_1.vi.fn(),
        embed: vitest_1.vi.fn(),
    },
    GEMINI_FLASH: 'gemini-2.0-flash',
    GEMINI_PRO: 'gemini-2.0-pro',
}));
// ── Mock encryption ───────────────────────────────────────────────
vitest_1.vi.mock('../config/encryption', () => ({
    encrypt: vitest_1.vi.fn((text) => `encrypted_${text}`),
    decrypt: vitest_1.vi.fn((text) => text.replace('encrypted_', '')),
}));
// ── Firestore Mock ────────────────────────────────────────────────
const mockDocs = new Map();
exports.mockDocs = mockDocs;
const mockFirestore = {
    collection: vitest_1.vi.fn((collPath) => ({
        doc: vitest_1.vi.fn((id) => ({
            set: vitest_1.vi.fn(async (data) => {
                mockDocs.set(`${collPath}/${id}`, data);
            }),
            get: vitest_1.vi.fn(async () => ({
                exists: mockDocs.has(`${collPath}/${id}`),
                data: () => mockDocs.get(`${collPath}/${id}`),
                id,
                ref: { delete: vitest_1.vi.fn() },
            })),
            update: vitest_1.vi.fn(async (data) => {
                const existing = mockDocs.get(`${collPath}/${id}`) ?? {};
                mockDocs.set(`${collPath}/${id}`, { ...existing, ...data });
            }),
            delete: vitest_1.vi.fn(async () => {
                mockDocs.delete(`${collPath}/${id}`);
            }),
        })),
        add: vitest_1.vi.fn(async (data) => {
            const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            mockDocs.set(`${collPath}/${id}`, data);
            return { id };
        }),
        get: vitest_1.vi.fn(async () => ({
            docs: Array.from(mockDocs.entries())
                .filter(([key]) => key.startsWith(`${collPath}/`))
                .map(([key, data]) => ({
                id: key.split('/').pop(),
                data: () => data,
                ref: { delete: vitest_1.vi.fn() },
                exists: true,
            })),
            empty: mockDocs.size === 0,
            forEach: vitest_1.vi.fn(),
        })),
        where: vitest_1.vi.fn(() => ({
            get: vitest_1.vi.fn(async () => ({ docs: [], empty: true, forEach: vitest_1.vi.fn() })),
            where: vitest_1.vi.fn(() => ({
                get: vitest_1.vi.fn(async () => ({ docs: [], empty: true })),
            })),
            limit: vitest_1.vi.fn(() => ({
                get: vitest_1.vi.fn(async () => ({ docs: [], empty: true })),
            })),
        })),
        orderBy: vitest_1.vi.fn(() => ({
            limit: vitest_1.vi.fn(() => ({
                get: vitest_1.vi.fn(async () => ({ docs: [], empty: true })),
            })),
            get: vitest_1.vi.fn(async () => ({ docs: [], empty: true })),
        })),
        count: vitest_1.vi.fn(() => ({
            get: vitest_1.vi.fn(async () => ({ data: () => ({ count: 0 }) })),
        })),
        limit: vitest_1.vi.fn(() => ({
            get: vitest_1.vi.fn(async () => ({ docs: [], empty: true })),
        })),
    })),
    batch: vitest_1.vi.fn(() => ({
        set: vitest_1.vi.fn(),
        update: vitest_1.vi.fn(),
        delete: vitest_1.vi.fn(),
        commit: vitest_1.vi.fn(async () => { }),
    })),
    runTransaction: vitest_1.vi.fn(async (fn) => fn({})),
};
exports.mockFirestore = mockFirestore;
const mockStorage = {
    bucket: vitest_1.vi.fn(() => ({
        file: vitest_1.vi.fn(() => ({
            save: vitest_1.vi.fn(async () => { }),
            download: vitest_1.vi.fn(async () => [Buffer.from('mock-file')]),
            delete: vitest_1.vi.fn(async () => { }),
            getSignedUrl: vitest_1.vi.fn(async () => ['https://mock-url.com']),
            exists: vitest_1.vi.fn(async () => [true]),
        })),
    })),
};
exports.mockStorage = mockStorage;
const mockAuth = {
    verifyIdToken: vitest_1.vi.fn(async (token) => {
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
    getUser: vitest_1.vi.fn(async (uid) => ({ uid, email: `${uid}@example.com` })),
    createUser: vitest_1.vi.fn(async (data) => ({ uid: 'new-user', ...data })),
    updateUser: vitest_1.vi.fn(async () => { }),
    deleteUser: vitest_1.vi.fn(async () => { }),
    listUsers: vitest_1.vi.fn(async () => ({ users: [] })),
};
exports.mockAuth = mockAuth;
// ── Helper to reset between tests ─────────────────────────────────
function clearMockFirestore() {
    mockDocs.clear();
}
function seedMockDoc(path, data) {
    mockDocs.set(path, data);
}
//# sourceMappingURL=setup.js.map