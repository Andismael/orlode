"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Meta Data Deletion Callback
 *
 * Facebook/Meta calls this endpoint when a user revokes the app's permissions
 * via Facebook Settings → Apps → Remove. We must:
 *   1. Validate the signed_request using the App Secret.
 *   2. Queue the deletion of the user's data linked to this Facebook user_id.
 *   3. Return a URL where the user can check status + a unique confirmation code.
 *
 * Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 */
const express_1 = require("express");
const crypto_1 = require("crypto");
const asyncHandler_1 = require("../utils/asyncHandler");
const firebase_config_1 = require("../config/firebase.config");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Base64URL → standard base64 (Facebook uses URL-safe base64 without padding)
function base64UrlDecode(input) {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - input.length % 4) % 4);
    return Buffer.from(b64, 'base64');
}
/** Parse and verify signed_request per Meta spec. Returns payload or null if invalid. */
function parseSignedRequest(signedRequest, appSecret) {
    try {
        const [encodedSig, payload] = signedRequest.split('.');
        if (!encodedSig || !payload)
            return null;
        const sig = base64UrlDecode(encodedSig);
        const data = JSON.parse(base64UrlDecode(payload).toString('utf8'));
        if (data.algorithm?.toUpperCase() !== 'HMAC-SHA256')
            return null;
        const expected = (0, crypto_1.createHmac)('sha256', appSecret).update(payload).digest();
        if (sig.length !== expected.length)
            return null;
        // Constant-time compare
        let diff = 0;
        for (let i = 0; i < sig.length; i++)
            diff |= sig[i] ^ expected[i];
        if (diff !== 0)
            return null;
        return data;
    }
    catch (err) {
        logger_1.logger.warn('[DataDeletion] Failed to parse signed_request', { err: String(err) });
        return null;
    }
}
// POST /api/data-deletion — Meta calls this when a user removes the app
router.post('/data-deletion', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const signedRequest = req.body['signed_request'];
    const appSecret = process.env['META_APP_SECRET'] ?? process.env['FB_APP_SECRET'] ?? process.env['WHATSAPP_APP_SECRET'];
    if (!signedRequest || !appSecret) {
        logger_1.logger.warn('[DataDeletion] Missing signed_request or META_APP_SECRET');
        res.status(400).json({ error: 'missing_signed_request' });
        return;
    }
    const payload = parseSignedRequest(signedRequest, appSecret);
    if (!payload?.user_id) {
        res.status(400).json({ error: 'invalid_signature' });
        return;
    }
    const fbUserId = payload.user_id;
    const confirmationCode = (0, helpers_1.generateId)() + (0, helpers_1.generateId)();
    const db = (0, firebase_config_1.getFirestore)();
    const baseUrl = process.env['APP_PUBLIC_URL'] ?? 'https://mon-assistant-86bbd.web.app';
    // Record the deletion request so the user can check status later
    await db.collection('dataDeletionRequests').doc(confirmationCode).set({
        confirmationCode,
        fbUserId,
        status: 'pending',
        requestedAt: new Date(),
        completedAt: null,
    });
    // Queue actual deletion (fire-and-forget — Meta expects fast ACK)
    setImmediate(async () => {
        try {
            // 1. Find any users linked to this FB user_id
            const usersSnap = await db.collection('users').where('fbUserId', '==', fbUserId).limit(50).get();
            for (const u of usersSnap.docs) {
                // Soft-delete: mark for review before hard wipe (company owners shouldn't vanish instantly)
                await u.ref.update({
                    deletionRequested: true,
                    deletionRequestedAt: new Date(),
                    fbUserId: null, // break link right away
                });
            }
            // 2. Remove FB login tokens if any
            const tokensSnap = await db.collection('fbOauthTokens').where('userId', '==', fbUserId).limit(50).get();
            await Promise.all(tokensSnap.docs.map(d => d.ref.delete()));
            await db.collection('dataDeletionRequests').doc(confirmationCode).update({
                status: 'completed', completedAt: new Date(), affectedUsers: usersSnap.size, tokensDeleted: tokensSnap.size,
            });
            logger_1.logger.info('[DataDeletion] Completed', { fbUserId, affectedUsers: usersSnap.size });
        }
        catch (err) {
            logger_1.logger.error('[DataDeletion] Async job failed', { err: String(err), fbUserId });
            await db.collection('dataDeletionRequests').doc(confirmationCode).update({
                status: 'failed', error: String(err),
            }).catch(() => { });
        }
    });
    // Meta-required response shape
    res.json({
        url: `${baseUrl}/data-deletion?code=${confirmationCode}`,
        confirmation_code: confirmationCode,
    });
}));
// GET /api/data-deletion/status/:code — used by the confirmation page to show progress
router.get('/data-deletion/status/:code', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('dataDeletionRequests').doc(req.params['code']).get();
    if (!doc.exists) {
        res.status(404).json({ success: false, message: 'not_found' });
        return;
    }
    const d = doc.data() ?? {};
    res.json({
        success: true,
        status: d['status'],
        requestedAt: d['requestedAt'],
        completedAt: d['completedAt'],
    });
}));
exports.default = router;
//# sourceMappingURL=dataDeletion.routes.js.map