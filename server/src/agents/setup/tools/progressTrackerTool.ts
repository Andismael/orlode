/**
 * Progress Tracker Tool
 * Saves the setup wizard progress to the host Firestore.
 * This allows the client to resume their setup if they close the browser.
 */
import { z } from 'zod';
import { ai } from '../../../config/genkit.config';
import { getFirestore } from '../../../config/firebase.config';
import { logger } from '../../../utils/logger';

const INPUT = z.object({
  companyId: z.string(),
  step: z.number().min(0).max(10),
  stepData: z.record(z.unknown()).optional().describe('Partial config collected at this step'),
  completed: z.boolean().optional().describe('Set true when setup is fully complete'),
});

const OUTPUT = z.object({
  success: z.boolean(),
  step: z.number(),
  message: z.string(),
});

export const progressTrackerTool = ai.defineTool(
  {
    name: 'trackSetupProgress',
    description: 'Save the current setup wizard step progress. Allows resuming setup after a browser close.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
  },
  async ({ companyId, step, stepData, completed }) => {
    try {
      const db = getFirestore();
      const update: Record<string, unknown> = {
        setupStep: step,
        updatedAt: new Date(),
      };

      if (completed === true) {
        // BYOE is the DEFAULT (May 2026 pricing model = $20/pack + BYOE).
        // Only block if SuperAdmin has explicitly set byoeAllowed: false on
        // this specific company (abuse, debt, demo-locked, etc.).
        const existing = await db.collection('companies').doc(companyId).get();
        const byoeExplicitlyBlocked = existing.data()?.['byoeAllowed'] === false;
        if (byoeExplicitlyBlocked) {
          return {
            success: false,
            step,
            message: 'BYOE est bloqué pour cette entreprise par le SuperAdmin. Contacte le support pour débloquer.',
          };
        }
        update['setupCompleted'] = true;
        update['setupCompletedAt'] = new Date();
        update['byoeEnabled'] = true;
      }

      // Merge stepData into company settings if provided
      if (stepData) {
        if (stepData['companyName']) update['name'] = stepData['companyName'];
        if (stepData['language']) update['settings.language'] = stepData['language'];
        if (stepData['timezone']) update['settings.timezone'] = stepData['timezone'];
        if (stepData['region']) update['settings.region'] = stepData['region'];
        if (stepData['firebaseProjectId']) update['settings.firebaseProjectId'] = stepData['firebaseProjectId'];
      }

      await db.collection('companies').doc(companyId).update(update);

      logger.info(`[SetupWizard] Progress saved: company=${companyId}, step=${step}, completed=${completed ?? false}`);

      return {
        success: true,
        step,
        message: completed ? 'Setup completed!' : `Step ${step} progress saved.`,
      };
    } catch (err) {
      logger.error('[SetupWizard] Failed to save progress', { error: err, companyId, step });
      return {
        success: false,
        step,
        message: `Failed to save progress: ${String(err)}`,
      };
    }
  }
);
