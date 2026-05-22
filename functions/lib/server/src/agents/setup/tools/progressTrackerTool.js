"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressTrackerTool = void 0;
/**
 * Progress Tracker Tool
 * Saves the setup wizard progress to the host Firestore.
 * This allows the client to resume their setup if they close the browser.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../../config/genkit.config");
const firebase_config_1 = require("../../../config/firebase.config");
const logger_1 = require("../../../utils/logger");
const INPUT = zod_1.z.object({
    companyId: zod_1.z.string(),
    step: zod_1.z.number().min(0).max(10),
    stepData: zod_1.z.record(zod_1.z.unknown()).optional().describe('Partial config collected at this step'),
    completed: zod_1.z.boolean().optional().describe('Set true when setup is fully complete'),
});
const OUTPUT = zod_1.z.object({
    success: zod_1.z.boolean(),
    step: zod_1.z.number(),
    message: zod_1.z.string(),
});
exports.progressTrackerTool = genkit_config_1.ai.defineTool({
    name: 'trackSetupProgress',
    description: 'Save the current setup wizard step progress. Allows resuming setup after a browser close.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, async ({ companyId, step, stepData, completed }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const update = {
            setupStep: step,
            updatedAt: new Date(),
        };
        if (completed === true) {
            // BYOE is the DEFAULT for every customer (pricing model = $20/pack + BYOE).
            // The only short-circuit: companies that are permanently hosted by Orlode
            // (NGOs, demos, partners) don't need to complete BYOE setup at all —
            // they run on Orlode's Firebase. SuperAdmin grants that via the
            // "Hébergement Orlode" toggle (sets `hostedByOrlode: true`).
            update['setupCompleted'] = true;
            update['setupCompletedAt'] = new Date();
            update['byoeEnabled'] = true;
        }
        // Merge stepData into company settings if provided
        if (stepData) {
            if (stepData['companyName'])
                update['name'] = stepData['companyName'];
            if (stepData['language'])
                update['settings.language'] = stepData['language'];
            if (stepData['timezone'])
                update['settings.timezone'] = stepData['timezone'];
            if (stepData['region'])
                update['settings.region'] = stepData['region'];
            if (stepData['firebaseProjectId'])
                update['settings.firebaseProjectId'] = stepData['firebaseProjectId'];
        }
        await db.collection('companies').doc(companyId).update(update);
        logger_1.logger.info(`[SetupWizard] Progress saved: company=${companyId}, step=${step}, completed=${completed ?? false}`);
        return {
            success: true,
            step,
            message: completed ? 'Setup completed!' : `Step ${step} progress saved.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[SetupWizard] Failed to save progress', { error: err, companyId, step });
        return {
            success: false,
            step,
            message: `Failed to save progress: ${String(err)}`,
        };
    }
});
//# sourceMappingURL=progressTrackerTool.js.map