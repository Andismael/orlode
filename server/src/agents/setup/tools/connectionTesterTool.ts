/**
 * Connection Tester Tool — Tests ALL services in one pass.
 * Returns a per-service status + overall score.
 */
import { z } from 'zod';
import { ai } from '../../../config/genkit.config';
import admin from 'firebase-admin';
import { logger } from '../../../utils/logger';

const INPUT = z.object({
  firebaseProjectId: z.string(),
  serviceAccountKey: z.string(),
  geminiApiKey: z.string(),
  claudeApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
});

const STATUS = z.enum(['ok', 'error', 'skipped']);

const OUTPUT = z.object({
  firebase: z.object({
    firestore: STATUS,
    storage: STATUS,
    auth: STATUS,
    firestoreError: z.string().optional(),
    storageError: z.string().optional(),
    authError: z.string().optional(),
  }),
  ai: z.object({
    gemini: STATUS,
    claude: STATUS,
    openai: STATUS,
    geminiError: z.string().optional(),
    claudeError: z.string().optional(),
  }),
  score: z.string(),
  ready: z.boolean(),
  message: z.string(),
});

export const connectionTesterTool = ai.defineTool(
  {
    name: 'testAllConnections',
    description: 'Test all Firebase services and AI API keys at once. Returns a status for each service and an overall readiness score.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
  },
  async ({ firebaseProjectId, serviceAccountKey, geminiApiKey, claudeApiKey, openaiApiKey }) => {
    const result = {
      firebase: {
        firestore: 'error' as 'ok' | 'error' | 'skipped',
        storage: 'error' as 'ok' | 'error' | 'skipped',
        auth: 'error' as 'ok' | 'error' | 'skipped',
        firestoreError: undefined as string | undefined,
        storageError: undefined as string | undefined,
        authError: undefined as string | undefined,
      },
      ai: {
        gemini: 'error' as 'ok' | 'error' | 'skipped',
        claude: 'skipped' as 'ok' | 'error' | 'skipped',
        openai: 'skipped' as 'ok' | 'error' | 'skipped',
        geminiError: undefined as string | undefined,
        claudeError: undefined as string | undefined,
      },
    };

    const appName = `test_${firebaseProjectId}_${Date.now()}`;
    let tempApp: admin.app.App | null = null;

    // ── Firebase tests ────────────────────────────────────────────
    try {
      const serviceAccount = JSON.parse(serviceAccountKey) as admin.ServiceAccount;
      tempApp = admin.initializeApp(
        {
          credential: admin.credential.cert(serviceAccount),
          projectId: firebaseProjectId,
          storageBucket: `${firebaseProjectId}.firebasestorage.app`,
        },
        appName
      );

      // Firestore
      try {
        const db = tempApp.firestore();
        const ref = db.collection('_test').doc('ping');
        await ref.set({ ts: Date.now() });
        await ref.delete();
        result.firebase.firestore = 'ok';
      } catch (e) {
        result.firebase.firestoreError = String(e);
      }

      // Storage
      try {
        const [exists] = await tempApp.storage().bucket().exists();
        result.firebase.storage = exists ? 'ok' : 'error';
        if (!exists) result.firebase.storageError = 'Bucket does not exist. Enable Firebase Storage.';
      } catch (e) {
        result.firebase.storageError = String(e);
      }

      // Auth
      try {
        await tempApp.auth().listUsers(1);
        result.firebase.auth = 'ok';
      } catch (e) {
        result.firebase.authError = String(e);
      }
    } catch (e) {
      logger.warn('[ConnectionTester] Firebase init failed', { error: e });
      result.firebase.firestoreError = String(e);
      result.firebase.storageError = String(e);
      result.firebase.authError = String(e);
    } finally {
      if (tempApp) await tempApp.delete().catch(() => {});
    }

    // ── Gemini test ────────────────────────────────────────────────
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`
      );
      const data = await resp.json() as { models?: unknown[]; error?: { message: string } };
      if (data.models && data.models.length > 0) {
        result.ai.gemini = 'ok';
      } else {
        result.ai.geminiError = data.error?.message ?? 'No models returned';
      }
    } catch (e) {
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
        const data = await resp.json() as { content?: unknown[]; error?: { message: string } };
        result.ai.claude = data.content ? 'ok' : 'error';
        if (!data.content) result.ai.claudeError = data.error?.message ?? 'Invalid response';
      } catch (e) {
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
  }
);
