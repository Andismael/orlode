"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Users Routes
 * - GET    /api/users          — lister les utilisateurs de l'entreprise
 * - POST   /api/users/invite   — inviter des collaborateurs (email Resend)
 * - PATCH  /api/users/:id/role — changer le rôle d'un utilisateur
 * - DELETE /api/users/:id      — supprimer un utilisateur
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const adminOnly_middleware_1 = require("../middleware/adminOnly.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const emailService_1 = require("../services/email/emailService");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ── GET /api/users ─────────────────────────────────────────────────────────────
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('users')
        .where('companyId', '==', companyId)
        .get();
    const users = snap.docs.map(d => {
        const data = d.data();
        // Ne pas exposer les champs sensibles
        const { password: _p, ...safe } = data;
        return { id: d.id, ...safe };
    });
    res.json({ success: true, data: users });
}));
// ── POST /api/users/invite ─────────────────────────────────────────────────────
router.post('/invite', adminOnly_middleware_1.adminOnlyMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { invites, message } = req.body;
    if (!invites?.length)
        throw new error_middleware_1.AppError('invites array required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const companyId = req.user.companyId;
    const inviterId = req.user.uid;
    // Récupérer infos entreprise + inviteur
    const [companyDoc, inviterDoc] = await Promise.all([
        db.collection('companies').doc(companyId).get(),
        db.collection('users').doc(inviterId).get(),
    ]);
    const companyName = companyDoc.data()?.name ?? 'votre entreprise';
    const inviterName = inviterDoc.data()?.displayName ?? req.user.email ?? 'Un administrateur';
    const APP_URL = process.env['APP_URL'] ?? 'https://orlode.com';
    const results = await Promise.allSettled(invites.map(async ({ email, role }) => {
        // Créer le token d'invitation en Firestore
        const tokenRef = db.collection('invites').doc();
        await tokenRef.set({
            email,
            role,
            companyId,
            invitedBy: inviterId,
            message: message ?? '',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            status: 'pending',
        });
        const inviteUrl = `${APP_URL}/invite/${tokenRef.id}`;
        await (0, emailService_1.sendInviteEmail)({
            to: email,
            inviteeName: email,
            companyName,
            inviterName,
            inviteUrl,
        });
        return { email, token: tokenRef.id };
    }));
    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').map((r, i) => ({ email: invites[i]?.email, reason: r.reason?.message }));
    res.json({ success: true, sent, failed });
}));
// ── PATCH /api/users/:id/role ──────────────────────────────────────────────────
router.patch('/:id/role', adminOnly_middleware_1.adminOnlyMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { role } = req.body;
    const validRoles = ['admin', 'manager', 'employee', 'viewer'];
    if (!validRoles.includes(role)) {
        throw new error_middleware_1.AppError(`Role must be one of: ${validRoles.join(', ')}`, 400);
    }
    // Empêcher un admin de modifier son propre rôle
    if (req.params.id === req.user?.uid) {
        throw new error_middleware_1.AppError('Vous ne pouvez pas modifier votre propre rôle', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('users').doc(req.params.id).update({ role });
    res.json({ success: true });
}));
// ── DELETE /api/users/:id ──────────────────────────────────────────────────────
router.delete('/:id', adminOnly_middleware_1.adminOnlyMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (req.params.id === req.user?.uid) {
        throw new error_middleware_1.AppError('Vous ne pouvez pas supprimer votre propre compte', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('users').doc(req.params.id).update({
        companyId: '',
        deletedAt: new Date().toISOString(),
    });
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=users.routes.js.map