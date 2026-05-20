"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.verifyToken = verifyToken;
exports.getMyCompanies = getMyCompanies;
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
// POST /api/auth/register
async function register(req, res) {
    const { email, password, displayName, companyName } = req.body;
    if (!email || !password || !displayName) {
        throw new error_middleware_1.AppError('Email, password, and display name are required', 400);
    }
    const authAdmin = (0, firebase_config_1.getAuth)();
    const db = (0, firebase_config_1.getFirestore)();
    // Create Firebase Auth user
    const userRecord = await authAdmin.createUser({
        email,
        password,
        displayName,
    });
    logger_1.logger.info(`Created Firebase user: ${userRecord.uid}`);
    // Create company document
    const companyId = userRecord.uid; // Use uid as company ID for simplicity
    await db.collection('companies').doc(companyId).set({
        name: companyName || `${displayName}'s Company`,
        ownerId: userRecord.uid,
        plan: 'trial',
        onboardingCompleted: false,
        onboardingStep: 0,
        createdAt: new Date(),
        settings: {
            language: 'fr',
            aiPersonality: 'professional',
        },
    });
    // Create user profile
    await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName,
        companyId,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
    });
    // Auto-install the free Welcome agent so the new account isn't empty.
    // The user lands on a working setup with at least one agent ready to chat.
    // If the seed agent isn't in the marketplace yet, this is a no-op (skip).
    try {
        const welcomeDoc = await db.collection('marketplaceAgents').doc('welcome').get();
        if (welcomeDoc.exists) {
            const welcome = welcomeDoc.data();
            await db.collection(`companies/${companyId}/installedAgents`).doc('welcome').set({
                agentId: 'welcome',
                installedAt: new Date(),
                installedBy: userRecord.uid,
                status: 'active',
                pricingModel: 'free',
                autoInstalled: true,
                cachedConfig: {
                    name: welcome['name'] ?? 'Bienvenue',
                    systemPrompt: welcome['systemPrompt'] ?? '',
                    tools: welcome['tools'] ?? [],
                    temperature: 0.4,
                    model: 'flash',
                },
            });
            logger_1.logger.info(`[Register] Auto-installed Welcome agent for new company ${companyId}`);
        }
    }
    catch (err) {
        // Non-blocking — registration succeeds even if the auto-install fails
        logger_1.logger.warn(`[Register] Failed to auto-install Welcome for ${companyId}`, { error: err });
    }
    res.status(201).json({
        success: true,
        data: {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName,
            companyId,
        },
        message: 'User registered successfully',
    });
}
// POST /api/auth/verify-token
async function verifyToken(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    res.json({
        success: true,
        data: {
            uid: req.user.uid,
            email: req.user.email,
            profile: userDoc.exists ? userDoc.data() : null,
        },
    });
}
// GET /api/auth/my-companies
async function getMyCompanies(req, res) {
    if (!req.user)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const uid = req.user.uid;
    // User's own company (companyId = uid for owner)
    const ownCompanyDoc = await db.collection('companies').doc(uid).get();
    // Also find companies where user is a member
    const memberSnapshot = await db.collection('users')
        .where('uid', '==', uid)
        .limit(10)
        .get();
    const companyIds = new Set();
    if (ownCompanyDoc.exists)
        companyIds.add(uid);
    memberSnapshot.docs.forEach(doc => {
        const cid = doc.data()['companyId'];
        if (cid)
            companyIds.add(cid);
    });
    const companies = [];
    for (const cid of companyIds) {
        const compDoc = cid === uid ? ownCompanyDoc : await db.collection('companies').doc(cid).get();
        if (compDoc.exists) {
            const d = compDoc.data();
            companies.push({
                id: compDoc.id,
                name: d['name'] ?? 'Unnamed',
                plan: d['plan'] ?? 'starter',
            });
        }
    }
    res.json(companies);
}
//# sourceMappingURL=auth.controller.js.map