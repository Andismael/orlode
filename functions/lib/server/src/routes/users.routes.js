"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const logger_1 = require("../utils/logger");
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
    // Accept BOTH forms:
    //   (a) bulk: { invites: [{ email, role }], message? }   ← legacy
    //   (b) flat: { email, role, name, position, department, phone, hireDate,
    //               salary, photoBase64, photoMimeType }     ← HR NewEmployeeModal
    const body = req.body;
    let invites;
    let extraFields = {};
    if (Array.isArray(body['invites'])) {
        invites = body['invites'];
    }
    else if (typeof body['email'] === 'string') {
        invites = [{ email: body['email'], role: body['role'] ?? 'employee' }];
        extraFields = {
            ...(body['name'] ? { name: body['name'] } : {}),
            ...(body['position'] ? { position: body['position'] } : {}),
            ...(body['department'] ? { department: body['department'] } : {}),
            ...(body['contractType'] ? { contractType: body['contractType'] } : {}),
            ...(body['phone'] ? { phone: body['phone'] } : {}),
            ...(body['hireDate'] ? { hireDate: body['hireDate'] } : {}),
            ...(typeof body['salary'] === 'number' ? { salary: body['salary'] } : {}),
        };
    }
    else {
        throw new error_middleware_1.AppError('email or invites[] required', 400);
    }
    const message = body['message'];
    // Optional photo upload — stored in Firebase Storage, URL persisted on invite + later on user
    let photoUrl = null;
    const photoBase64 = body['photoBase64'];
    const photoMimeType = body['photoMimeType'] ?? 'image/jpeg';
    if (photoBase64) {
        try {
            const buf = Buffer.from(photoBase64, 'base64');
            if (buf.length <= 4 * 1024 * 1024) {
                const { getStorage } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
                const bucket = getStorage().bucket();
                const ext = photoMimeType.includes('png') ? 'png' : photoMimeType.includes('webp') ? 'webp' : 'jpg';
                const path = `employees/${req.user.companyId}/photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                await bucket.file(path).save(buf, { metadata: { contentType: photoMimeType }, public: true });
                photoUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;
            }
        }
        catch (err) {
            // Photo failure shouldn't block the invite
            logger_1.logger.warn('[Users] Invite photo upload failed', { err: String(err) });
        }
    }
    if (!invites.length)
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
            ...(photoUrl ? { photoUrl } : {}),
            ...extraFields,
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
// SECURITY helper: assert that the target user belongs to the caller's company.
// Without this, an admin from company A could rewrite roles or delete users in
// company B, since `adminOnly` only checks the caller's own role.
async function assertSameCompany(targetUserId, callerCompanyId) {
    if (!callerCompanyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const target = await db.collection('users').doc(targetUserId).get();
    if (!target.exists)
        throw new error_middleware_1.AppError('User not found', 404);
    const targetCompanyId = target.data()?.['companyId'] ?? '';
    if (targetCompanyId !== callerCompanyId) {
        throw new error_middleware_1.AppError('User does not belong to your company', 403);
    }
}
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
    // SECURITY: cross-tenant guard
    await assertSameCompany(req.params.id, req.user?.companyId);
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('users').doc(req.params.id).update({ role });
    res.json({ success: true });
}));
// ── DELETE /api/users/:id ──────────────────────────────────────────────────────
router.delete('/:id', adminOnly_middleware_1.adminOnlyMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (req.params.id === req.user?.uid) {
        throw new error_middleware_1.AppError('Vous ne pouvez pas supprimer votre propre compte', 400);
    }
    // SECURITY: cross-tenant guard
    await assertSameCompany(req.params.id, req.user?.companyId);
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('users').doc(req.params.id).update({
        companyId: '',
        deletedAt: new Date().toISOString(),
    });
    // Also drop the corresponding members subcollection entry so the user can't
    // re-appear in team listings, and revoke Firebase custom claims so the
    // existing JWT can no longer access company data after the next refresh.
    await db.collection(`companies/${req.user.companyId}/members`).doc(req.params.id).delete().catch(() => { });
    try {
        const { getAuth } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
        await getAuth().setCustomUserClaims(req.params.id, null);
    }
    catch { /* best-effort */ }
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=users.routes.js.map