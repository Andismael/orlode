"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseValidatorTool = void 0;
/**
 * Firebase Validator Tool
 * Validates the client's Firebase project by temporarily initializing
 * a Firebase Admin SDK with their service account and running read/write tests.
 * The service account key is provided by the client and used ONLY during setup.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../../config/genkit.config");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const logger_1 = require("../../../utils/logger");
const INPUT = zod_1.z.object({
    projectId: zod_1.z.string().describe('Firebase project ID (e.g. corpmind-acme-corp)'),
    serviceAccountKey: zod_1.z.string().describe('Service account JSON string from Firebase Console'),
    storageBucket: zod_1.z.string().optional().describe('Storage bucket (default: projectId.firebasestorage.app)'),
});
const OUTPUT = zod_1.z.object({
    success: zod_1.z.boolean(),
    checks: zod_1.z.object({
        projectExists: zod_1.z.boolean(),
        firestoreEnabled: zod_1.z.boolean(),
        storageEnabled: zod_1.z.boolean(),
        authEnabled: zod_1.z.boolean(),
    }),
    region: zod_1.z.string().optional(),
    message: zod_1.z.string(),
    error: zod_1.z.string().optional(),
    suggestion: zod_1.z.string().optional(),
});
exports.firebaseValidatorTool = genkit_config_1.ai.defineTool({
    name: 'validateFirebase',
    description: 'Validate the client\'s Firebase project. Tests Firestore read/write, Storage, and Auth. Returns a detailed report.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, async ({ projectId, serviceAccountKey, storageBucket }) => {
    const appName = `validate_${projectId}_${Date.now()}`;
    let tempApp = null;
    const checks = {
        projectExists: false,
        firestoreEnabled: false,
        storageEnabled: false,
        authEnabled: false,
    };
    try {
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(serviceAccountKey);
        }
        catch {
            return {
                success: false,
                checks,
                message: 'Invalid service account JSON.',
                error: 'Cannot parse service account key. Make sure you downloaded the correct JSON file from Firebase Console.',
                suggestion: 'Go to Firebase Console → Project Settings → Service Accounts → Generate new private key → Download JSON.',
            };
        }
        tempApp = firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
            projectId,
            storageBucket: storageBucket ?? `${projectId}.firebasestorage.app`,
        }, appName);
        checks.projectExists = true;
        // Test Firestore
        try {
            const db = tempApp.firestore();
            const testRef = db.collection('_setup_validation').doc('test');
            await testRef.set({ validatedAt: new Date(), _temp: true });
            await testRef.delete();
            checks.firestoreEnabled = true;
        }
        catch (e) {
            logger_1.logger.warn(`[FirebaseValidator] Firestore test failed for ${projectId}`, { error: e });
        }
        // Test Storage
        try {
            const bucket = tempApp.storage().bucket();
            const [exists] = await bucket.exists();
            checks.storageEnabled = exists;
        }
        catch (e) {
            logger_1.logger.warn(`[FirebaseValidator] Storage test failed for ${projectId}`, { error: e });
        }
        // Test Auth (list users — minimal operation)
        try {
            await tempApp.auth().listUsers(1);
            checks.authEnabled = true;
        }
        catch (e) {
            logger_1.logger.warn(`[FirebaseValidator] Auth test failed for ${projectId}`, { error: e });
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
    }
    catch (err) {
        const message = String(err);
        return {
            success: false,
            checks,
            message: 'Firebase validation failed.',
            error: message,
            suggestion: diagnose(message),
        };
    }
    finally {
        if (tempApp) {
            await tempApp.delete().catch(() => { });
        }
    }
});
function diagnose(error) {
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
//# sourceMappingURL=firebaseValidatorTool.js.map