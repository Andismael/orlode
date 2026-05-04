"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestoreSchemaDeployTool = void 0;
/**
 * Firestore Schema Deploy Tool
 * Deploys the full Orlode collection structure + security rules into the CLIENT's Firebase project.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../../config/genkit.config");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const logger_1 = require("../../../utils/logger");
const INPUT = zod_1.z.object({
    projectId: zod_1.z.string().trim(),
    serviceAccountKey: zod_1.z.string(),
    companyName: zod_1.z.string(),
    companyId: zod_1.z.string(),
    adminEmail: zod_1.z.string(),
    plan: zod_1.z.enum(['free', 'creator', 'starter', 'pro', 'premium', 'trial', 'business', 'enterprise']),
});
const OUTPUT = zod_1.z.object({
    success: zod_1.z.boolean(),
    collectionsCreated: zod_1.z.array(zod_1.z.string()),
    errors: zod_1.z.array(zod_1.z.string()),
    message: zod_1.z.string(),
    nextStep: zod_1.z.string().optional(),
});
const SUB_COLLECTIONS = [
    'documents', 'vectorChunks', 'meetings', 'visitors',
    'leaveRequests', 'leaveBalances', 'hrPolicies', 'invoices',
    'expenses', 'leads', 'deals', 'supportTickets',
    'legalDeadlines', 'contractTemplates', 'trainingCourses',
    'trainingProgress', 'newsBriefings', 'apiKeys', 'usageMetrics',
    'settings', 'securityIncidents', 'securityScore', 'marketingContent',
    'itAssets', 'itTickets', 'compliance', 'faces', 'auditLogs',
];
function getFeaturesByPlan(plan) {
    const base = { documents: true, meetings: true, qa: true, voice: true };
    if (plan === 'free' || plan === 'starter')
        return { ...base, maxUsers: false, byoe: false };
    if (plan === 'creator')
        return { ...base, marketplace_publish: true, referral: true };
    if (plan === 'trial' || plan === 'business' || plan === 'pro')
        return { ...base, analytics: true, byoe: true, apiAccess: true, gdpr: true };
    return { ...base, analytics: true, byoe: true, apiAccess: true, gdpr: true, onPremise: true, customAgents: true };
}
exports.firestoreSchemaDeployTool = genkit_config_1.ai.defineTool({
    name: 'deployFirestoreSchema',
    description: 'Deploy the complete Orlode Firestore schema (collections + initial data) into the client\'s Firebase project.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, async ({ projectId, serviceAccountKey, companyName, companyId, adminEmail, plan }) => {
    const appName = `deploy_${projectId}_${Date.now()}`;
    let tempApp = null;
    const collectionsCreated = [];
    const errors = [];
    try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        tempApp = firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
            projectId,
            storageBucket: `${projectId}.firebasestorage.app`,
        }, appName);
        const db = tempApp.firestore();
        const now = firebase_admin_1.default.firestore.FieldValue.serverTimestamp();
        // 1. Root company document
        await db.collection('companies').doc(companyId).set({
            id: companyId,
            name: companyName,
            plan,
            byoeEnabled: plan !== 'free' && plan !== 'starter' && plan !== 'creator',
            setupCompleted: false,
            setupStep: 0,
            onboardingCompleted: false,
            settings: {
                language: 'fr',
                timezone: 'Europe/Paris',
                aiPersonality: 'professional',
                geminiModel: 'gemini-2.0-flash',
                claudeModel: 'claude-sonnet-4-20250514',
            },
            subscription: {
                plan,
                maxUsers: plan === 'free' ? 2 : plan === 'starter' ? 5 : plan === 'creator' ? 3 : (plan === 'business' || plan === 'pro') ? 25 : -1,
                features: getFeaturesByPlan(plan),
            },
            createdAt: now,
            updatedAt: now,
        });
        collectionsCreated.push('companies');
        // 2. All sub-collections (placeholder docs to initialize)
        for (const col of SUB_COLLECTIONS) {
            try {
                await db
                    .collection(`companies/${companyId}/${col}`)
                    .doc('_init')
                    .set({ _initialized: true, _createdAt: now });
                collectionsCreated.push(col);
            }
            catch (e) {
                errors.push(`${col}: ${String(e)}`);
            }
        }
        // 3. Settings sub-document
        await db.collection(`companies/${companyId}/settings`).doc('general').set({
            companyId,
            language: 'fr',
            aiPersonality: 'professional',
            createdAt: now,
        });
        // 4. First admin user placeholder
        await db.collection('users').doc(companyId).set({
            email: adminEmail,
            companyId,
            role: 'admin',
            displayName: 'Admin',
            isActive: true,
            createdAt: now,
        });
        // 5. Root conversations + auditLogs collections (top-level)
        await db.collection('conversations').doc('_init').set({ _initialized: true });
        await db.collection('auditLogs').doc('_init').set({ _initialized: true });
        logger_1.logger.info(`[SchemaDeploy] Deployed ${collectionsCreated.length} collections to ${projectId}`);
        return {
            success: errors.length === 0,
            collectionsCreated,
            errors,
            message: `${collectionsCreated.length} collections deployed to Firebase project "${projectId}".`,
            nextStep: 'Configure Firebase Authentication (Step 7)',
        };
    }
    catch (err) {
        return {
            success: false,
            collectionsCreated,
            errors: [String(err)],
            message: 'Schema deployment failed.',
        };
    }
    finally {
        if (tempApp)
            await tempApp.delete().catch(() => { });
    }
});
//# sourceMappingURL=firestoreSchemaDeployTool.js.map