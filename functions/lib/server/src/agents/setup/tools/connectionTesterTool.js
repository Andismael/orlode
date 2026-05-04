"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionTesterTool = void 0;
/**
 * Connection Tester Tool — Tests ALL services in one pass.
 * Returns a per-service status + overall score.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../../config/genkit.config");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const logger_1 = require("../../../utils/logger");
const INPUT = zod_1.z.object({
    firebaseProjectId: zod_1.z.string(),
    serviceAccountKey: zod_1.z.string(),
    geminiApiKey: zod_1.z.string(),
    claudeApiKey: zod_1.z.string().optional(),
    openaiApiKey: zod_1.z.string().optional(),
});
const STATUS = zod_1.z.enum(['ok', 'error', 'skipped']);
const OUTPUT = zod_1.z.object({
    firebase: zod_1.z.object({
        firestore: STATUS,
        storage: STATUS,
        auth: STATUS,
        firestoreError: zod_1.z.string().optional(),
        storageError: zod_1.z.string().optional(),
        authError: zod_1.z.string().optional(),
    }),
    ai: zod_1.z.object({
        gemini: STATUS,
        claude: STATUS,
        openai: STATUS,
        geminiError: zod_1.z.string().optional(),
        claudeError: zod_1.z.string().optional(),
    }),
    score: zod_1.z.string(),
    ready: zod_1.z.boolean(),
    message: zod_1.z.string(),
});
exports.connectionTesterTool = genkit_config_1.ai.defineTool({
    name: 'testAllConnections',
    description: 'Test all Firebase services and AI API keys at once. Returns a status for each service and an overall readiness score.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, async ({ firebaseProjectId, serviceAccountKey, geminiApiKey, claudeApiKey, openaiApiKey }) => {
    const result = {
        firebase: {
            firestore: 'error',
            storage: 'error',
            auth: 'error',
            firestoreError: undefined,
            storageError: undefined,
            authError: undefined,
        },
        ai: {
            gemini: 'error',
            claude: 'skipped',
            openai: 'skipped',
            geminiError: undefined,
            claudeError: undefined,
        },
    };
    const appName = `test_${firebaseProjectId}_${Date.now()}`;
    let tempApp = null;
    // ── Firebase tests ────────────────────────────────────────────
    try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        tempApp = firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
            projectId: firebaseProjectId,
            storageBucket: `${firebaseProjectId}.firebasestorage.app`,
        }, appName);
        // Firestore
        try {
            const db = tempApp.firestore();
            const ref = db.collection('_test').doc('ping');
            await ref.set({ ts: Date.now() });
            await ref.delete();
            result.firebase.firestore = 'ok';
        }
        catch (e) {
            result.firebase.firestoreError = String(e);
        }
        // Storage
        try {
            const [exists] = await tempApp.storage().bucket().exists();
            result.firebase.storage = exists ? 'ok' : 'error';
            if (!exists)
                result.firebase.storageError = 'Bucket does not exist. Enable Firebase Storage.';
        }
        catch (e) {
            result.firebase.storageError = String(e);
        }
        // Auth
        try {
            await tempApp.auth().listUsers(1);
            result.firebase.auth = 'ok';
        }
        catch (e) {
            result.firebase.authError = String(e);
        }
    }
    catch (e) {
        logger_1.logger.warn('[ConnectionTester] Firebase init failed', { error: e });
        result.firebase.firestoreError = String(e);
        result.firebase.storageError = String(e);
        result.firebase.authError = String(e);
    }
    finally {
        if (tempApp)
            await tempApp.delete().catch(() => { });
    }
    // ── Gemini test ────────────────────────────────────────────────
    try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
        const data = await resp.json();
        if (data.models && data.models.length > 0) {
            result.ai.gemini = 'ok';
        }
        else {
            result.ai.geminiError = data.error?.message ?? 'No models returned';
        }
    }
    catch (e) {
        result.ai.geminiError = String(e);
    }
    // ── Claude test (optional) ─────────────────────────────────────
    if (claudeApiKey) {
        try {
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': claudeApiKey,
                    'content-type': 'application/json',
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 5,
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });
            const data = await resp.json();
            result.ai.claude = data.content ? 'ok' : 'error';
            if (!data.content)
                result.ai.claudeError = data.error?.message ?? 'Invalid response';
        }
        catch (e) {
            result.ai.claude = 'error';
            result.ai.claudeError = String(e);
        }
    }
    // OpenAI (future — mark as skipped for now since we use it for embeddings only)
    if (openaiApiKey) {
        result.ai.openai = 'skipped'; // TODO: implement if needed
    }
    // ── Score ──────────────────────────────────────────────────────
    const required = [result.firebase.firestore, result.firebase.storage, result.firebase.auth, result.ai.gemini];
    const passed = required.filter((s) => s === 'ok').length;
    const ready = passed === required.length;
    return {
        firebase: result.firebase,
        ai: result.ai,
        score: `${passed}/${required.length} required services connected`,
        ready,
        message: ready
            ? 'All systems connected! Your Orlode is ready to launch.'
            : `${required.length - passed} required service(s) need attention before you can proceed.`,
    };
});
//# sourceMappingURL=connectionTesterTool.js.map