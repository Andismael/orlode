/**
 * Firebase Validator Tool
 * Validates the client's Firebase project by temporarily initializing
 * a Firebase Admin SDK with their service account and running read/write tests.
 * The service account key is provided by the client and used ONLY during setup.
 */
import { z } from 'zod';
import { ai } from '../../../config/genkit.config';
import admin from 'firebase-admin';
import { logger } from '../../../utils/logger';

const INPUT = z.object({
  projectId: z.string().describe('Firebase project ID (e.g. corpmind-acme-corp)'),
  serviceAccountKey: z.string().describe('Service account JSON string from Firebase Console'),
  storageBucket: z.string().optional().describe('Storage bucket (default: projectId.firebasestorage.app)'),
});

const OUTPUT = z.object({
  success: z.boolean(),
  checks: z.object({
    projectExists: z.boolean(),
    firestoreEnabled: z.boolean(),
    storageEnabled: z.boolean(),
    authEnabled: z.boolean(),
  }),
  region: z.string().optional(),
  message: z.string(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

export const firebaseValidatorTool = ai.defineTool(
  {
    name: 'validateFirebase',
    description: 'Validate the client\'s Firebase project. Tests Firestore read/write, Storage, and Auth. Returns a detailed report.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
  },
  async ({ projectId, serviceAccountKey, storageBucket }) => {
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
        return {
          success: false,
          checks,
          message: 'Invalid service account JSON.',
          error: 'Cannot parse service account key. Make sure you downloaded the correct JSON file from Firebase Console.',
          suggestion: 'Go to Firebase Console → Project Settings → Service Accounts → Generate new private key → Download JSON.',
        };
      }

      tempApp = admin.initializeApp(
        {
          credential: admin.credential.cert(serviceAccount),
          projectId,
          storageBucket: storageBucket ?? `${projectId}.firebasestorage.app`,
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

      // Test Auth (list users — minimal operation)
      try {
        await tempApp.auth().listUsers(1);
        checks.authEnabled = true;
      } catch (e) {
        logger.warn(`[FirebaseValidator] Auth test failed for ${projectId}`, { error: e });
      }

      const allPassed = checks.firestoreEnabled && checks.storageEnabled && checks.authEnabled;

      return {
        success: allPassed,
        checks,
        message: allPassed
          ? `Firebase project "${projectId}" validated successfully!`
          : `Firebase project "${projectId}" has issues. Check the failed services.`,
        error: allPassed ? undefined : 'Some services are not enabled or not accessible.',
        suggestion: allPassed
          ? undefined
          : 'Make sure Firestore, Storage, and Authentication are enabled in your Firebase Console. All require the Blaze plan.',
      };
    } catch (err) {
      const message = String(err);
      return {
        success: false,
        checks,
        message: 'Firebase validation failed.',
        error: message,
        suggestion: diagnose(message),
      };
    } finally {
      if (tempApp) {
        await tempApp.delete().catch(() => {});
      }
    }
  }
);

function diagnose(error: string): string {
  if (error.includes('invalid_grant') || error.includes('INVALID_ARGUMENT')) {
    return 'Your service account key may be invalid or expired. Generate a new one from Firebase Console.';
  }
  if (error.includes('PERMISSION_DENIED')) {
    return 'The service account does not have sufficient permissions. Make sure it has the "Firebase Admin" role.';
  }
  if (error.includes('project not found')) {
    return 'Project ID not found. Double-check the Project ID in Firebase Console → Project Settings.';
  }
  return 'Check your Firebase Console and ensure all services are enabled.';
}
