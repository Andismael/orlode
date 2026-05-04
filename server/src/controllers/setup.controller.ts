/**
 * Setup Controller — BYOE provisioning endpoints
 */
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { setupAgentFlow } from '../agents/setup/setupAgent';
import { tenantManager } from '../config/tenantManager';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import admin from 'firebase-admin';

// GET /api/setup/status
export async function getSetupStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const doc = await db.collection('companies').doc(companyId).get();
  if (!doc.exists) throw new AppError('Company not found', 404);

  const data = doc.data()!;
  res.json({
    success: true,
    data: {
      plan: data['plan'] ?? 'starter',
      byoeEnabled: data['byoeEnabled'] ?? false,
      setupCompleted: data['setupCompleted'] ?? false,
      setupStep: data['setupStep'] ?? 0,
    },
  });
}

// POST /api/setup/chat — Send message to Setup Agent
export async function setupChat(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { message, step, context } = req.body as {
    message: string;
    step: number;
    context?: Record<string, unknown>;
  };

  if (!message) throw new AppError('message is required', 400);
  if (typeof step !== 'number') throw new AppError('step (number) is required', 400);

  logger.info(`[SetupController] Agent chat: step=${step} company=${companyId}`);
  const result = await setupAgentFlow({ companyId, message, step, context });
  res.json({ success: true, data: result });
}

// POST /api/setup/test-key — Quick API key test (direct, no Genkit wrapper)
export async function testApiKey(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { provider, apiKey } = req.body as { provider?: string; apiKey?: string };
  if (!provider || !apiKey) throw new AppError('provider and apiKey are required', 400);
  if (!['gemini', 'claude', 'openai'].includes(provider)) {
    throw new AppError('provider must be gemini, claude, or openai', 400);
  }

  try {
    switch (provider) {
      case 'gemini': {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        const data = await response.json() as { models?: { name: string }[]; error?: { message: string } };

        if (data.models && data.models.length > 0) {
          res.json({
            success: true,
            provider: 'Google AI (Gemini)',
            modelsAvailable: data.models.slice(0, 5).map((m) => m.name),
            message: `Gemini API key is valid! ${data.models.length} models available.`,
          });
          return;
        }
        throw new Error(data.error?.message ?? 'No models returned — key may lack permissions');
      }

      case 'claude': {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        const data = await response.json() as { content?: unknown[]; error?: { message: string } };

        if (data.content) {
          res.json({
            success: true,
            provider: 'Anthropic (Claude)',
            message: 'Claude API key is valid! Connection established.',
          });
          return;
        }
        throw new Error(data.error?.message ?? 'Invalid response');
      }

      case 'openai': {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = await response.json() as { data?: { id: string }[]; error?: { message: string } };

        if (data.data && data.data.length > 0) {
          res.json({
            success: true,
            provider: 'OpenAI',
            modelsAvailable: data.data.slice(0, 5).map((m) => m.id),
            message: 'OpenAI API key is valid!',
          });
          return;
        }
        throw new Error(data.error?.message ?? 'Invalid response');
      }
    }
  } catch (err) {
    const message = String(err);
    res.json({
      success: false,
      provider,
      message: `${provider} API key test failed.`,
      error: message,
      suggestion: suggestFix(provider, message),
    });
  }
}

// POST /api/setup/validate-firebase — Quick Firebase validation (direct)
export async function validateFirebase(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId: rawProjectId, serviceAccountKey } = req.body as {
    projectId?: string;
    serviceAccountKey?: string;
  };
  const projectId = rawProjectId?.trim();
  if (!projectId || !serviceAccountKey) {
    throw new AppError('projectId and serviceAccountKey are required', 400);
  }

  const appName = `validate_${projectId}_${Date.now()}`;
  let tempApp: admin.app.App | null = null;

  const checks = {
    projectExists: false,
    firestoreEnabled: false,
    storageEnabled: false,
    authEnabled: false,
  };

  try {
    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountKey) as admin.ServiceAccount;
    } catch {
      res.json({
        success: false,
        checks,
        message: 'Invalid service account JSON.',
        error: 'Cannot parse service account key.',
        suggestion: 'Go to Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.',
      });
      return;
    }

    tempApp = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId,
        storageBucket: `${projectId}.firebasestorage.app`,
      },
      appName
    );

    checks.projectExists = true;

    // Test Firestore
    try {
      const db = tempApp.firestore();
      const testRef = db.collection('_setup_validation').doc('test');
      await testRef.set({ validatedAt: new Date(), _temp: true });
      await testRef.delete();
      checks.firestoreEnabled = true;
    } catch (e) {
      logger.warn(`[FirebaseValidator] Firestore test failed for ${projectId}`, { error: e });
    }

    // Test Storage
    try {
      const bucket = tempApp.storage().bucket();
      const [exists] = await bucket.exists();
      checks.storageEnabled = exists;
    } catch (e) {
      logger.warn(`[FirebaseValidator] Storage test failed for ${projectId}`, { error: e });
    }

    // Test Auth
    try {
      await tempApp.auth().listUsers(1);
      checks.authEnabled = true;
    } catch (e) {
      logger.warn(`[FirebaseValidator] Auth test failed for ${projectId}`, { error: e });
    }

    const allPassed = checks.firestoreEnabled && checks.storageEnabled && checks.authEnabled;

    res.json({
      success: allPassed,
      checks,
      message: allPassed
        ? `Firebase project "${projectId}" validated successfully!`
        : `Firebase project "${projectId}" has issues. Check the failed services.`,
      suggestion: allPassed ? undefined : 'Make sure Firestore, Storage, and Auth are enabled in Firebase Console (Blaze plan required).',
    });
  } catch (err) {
    res.json({
      success: false,
      checks,
      message: 'Firebase validation failed.',
      error: String(err),
    });
  } finally {
    if (tempApp) {
      await tempApp.delete().catch(() => {});
    }
  }
}

// POST /api/setup/save-byoe — Save encrypted BYOE config
export async function saveBYOEConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const {
    firebaseProjectId, serviceAccountKey, storageBucket, region,
    geminiApiKey, claudeApiKey, openaiApiKey,
  } = req.body as Record<string, string>;

  if (!firebaseProjectId || !serviceAccountKey || !geminiApiKey) {
    throw new AppError('firebaseProjectId, serviceAccountKey, and geminiApiKey are required', 400);
  }

  await tenantManager.saveBYOEConfig(companyId, {
    firebaseProjectId,
    serviceAccountKey,
    storageBucket: storageBucket ?? `${firebaseProjectId}.firebasestorage.app`,
    region: region ?? 'europe-west1',
    geminiApiKey,
    claudeApiKey,
    openaiApiKey,
  });

  res.json({ success: true, message: 'BYOE configuration saved and encrypted.' });
}

function suggestFix(provider: string, error: string): string {
  if (error.includes('401') || error.includes('Unauthorized') || error.includes('invalid')) {
    return `Your ${provider} API key seems invalid. Check for typos or copy it again from the provider console.`;
  }
  if (error.includes('429') || error.includes('quota')) {
    return `Your ${provider} key hit a rate limit. Wait a minute and try again.`;
  }
  if (error.includes('403') || error.includes('permission')) {
    return `Your ${provider} key doesn't have the required permissions.`;
  }
  return `Check your ${provider} API key in their developer console.`;
}
