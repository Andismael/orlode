"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const emailService_1 = require("../services/email/emailService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// POST /api/auth/register
router.post('/register', rateLimit_middleware_1.authRateLimiter, (0, asyncHandler_1.asyncHandler)(auth_controller_1.register));
// POST /api/auth/welcome-email — fire welcome email (called from client after signup)
router.post('/welcome-email', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { companyName, plan, userName } = req.body;
    const email = req.user?.email;
    const name = userName ?? email?.split('@')[0] ?? 'friend';
    if (!email)
        throw new error_middleware_1.AppError('User email required', 400);
    try {
        await (0, emailService_1.sendWelcomeEmail)({
            to: email,
            userName: name,
            companyName: companyName ?? 'votre entreprise',
            plan,
        });
        res.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error('[Welcome email] failed', { err: String(err), email });
        res.json({ success: false, error: String(err) });
    }
}));
// POST /api/auth/verify-token
router.post('/verify-token', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(auth_controller_1.verifyToken));
// GET /api/auth/my-companies
router.get('/my-companies', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(auth_controller_1.getMyCompanies));
// GET /api/auth/invite/:token — verify invitation (public, no auth)
router.get('/invite/:token', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { token } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('invites').doc(token).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Invitation invalide ou expirée', 404);
    const data = doc.data();
    if (data['status'] === 'accepted')
        throw new error_middleware_1.AppError('Invitation déjà acceptée', 400);
    if (data['expiresAt'] && new Date(data['expiresAt']) < new Date())
        throw new error_middleware_1.AppError('Invitation expirée', 400);
    // Get company name
    const companyDoc = await db.collection('companies').doc(data['companyId']).get();
    const companyName = companyDoc.data()?.['name'] ?? 'Entreprise';
    res.json({
        success: true,
        data: {
            email: data['email'],
            role: data['role'],
            companyName,
            companyId: data['companyId'],
        },
    });
}));
// POST /api/auth/accept-invite — accept invitation (auth required)
router.post('/accept-invite', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { token, displayName, photoURL } = req.body;
    if (!token)
        throw new error_middleware_1.AppError('Token required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('invites').doc(token).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Invitation invalide', 404);
    const data = doc.data();
    if (data['status'] === 'accepted')
        throw new error_middleware_1.AppError('Invitation déjà acceptée', 400);
    const uid = req.user?.uid;
    const email = req.user?.email ?? data['email'] ?? '';
    if (!uid)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const companyId = data['companyId'];
    const role = data['role'];
    // Update user with company + role (don't downgrade existing admins)
    const existingUser = await db.collection('users').doc(uid).get();
    const existingRole = existingUser.data()?.['role'];
    const newRole = (existingRole === 'admin' || existingRole === 'manager') ? existingRole : (role ?? 'employee');
    const finalDisplayName = displayName ?? existingUser.data()?.['displayName'] ?? email.split('@')[0];
    const finalPhotoURL = photoURL ?? existingUser.data()?.['photoURL'] ?? '';
    await db.collection('users').doc(uid).set({
        uid, email,
        displayName: finalDisplayName,
        photoURL: finalPhotoURL,
        companyId,
        role: newRole,
        invitedBy: data['invitedBy'],
        inviteAcceptedAt: new Date(),
    }, { merge: true });
    // Seed the members subcollection so the user appears in /admin/users immediately
    try {
        await db.collection(`companies/${companyId}/members`).doc(uid).set({
            uid, email,
            displayName: finalDisplayName,
            photoURL: finalPhotoURL,
            role: newRole,
            status: 'active',
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        }, { merge: true });
    }
    catch (err) {
        logger_1.logger.warn('[auth/accept-invite] Failed to seed member doc', { uid, companyId, err: String(err) });
    }
    // CRITICAL: also set Firebase custom claims so the auth middleware picks up the right companyId
    // on the next token refresh. Without this, req.user.companyId falls back to uid → broken access.
    try {
        await (0, firebase_config_1.getAuth)().setCustomUserClaims(uid, { companyId, role: newRole });
    }
    catch (err) {
        logger_1.logger.error('[auth/accept-invite] Failed to set custom claims', { uid, companyId, err: String(err) });
    }
    // Mark invite as accepted
    await db.collection('invites').doc(token).update({
        status: 'accepted',
        acceptedBy: uid,
        acceptedAt: new Date(),
    });
    // Client must call `user.getIdToken(true)` (force refresh) to pick up the new claims.
    res.json({ success: true, data: { companyId, role: newRole, requiresTokenRefresh: true } });
}));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map