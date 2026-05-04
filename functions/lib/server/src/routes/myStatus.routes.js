"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Public client status — magic-token gated.
 *
 * GET   /api/my-status?token=...                       — aggregate view
 * POST  /api/my-status/cancel-appointment?token=...    { appointmentId }
 * POST  /api/my-status/cancel-reservation?token=...    { reservationId }
 * POST  /api/my-status/cancel-order?token=...          { orderId }
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const firebase_config_1 = require("../config/firebase.config");
const magicToken_1 = require("../utils/magicToken");
const router = (0, express_1.Router)();
function authed(req, res) {
    const token = req.query['token'] || '';
    const payload = (0, magicToken_1.verifyMagicToken)(token);
    if (!payload) {
        res.status(401).json({ success: false, message: 'Lien invalide ou expiré.' });
        return null;
    }
    return { type: payload.type, id: payload.id, companyId: payload.companyId };
}
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const me = authed(req, res);
    if (!me)
        return;
    const db = (0, firebase_config_1.getFirestore)();
    const field = me.type === 'email' ? 'clientEmail' : 'clientPhone';
    const [apptSnap, resvSnap, orderSnap, quoteSnap] = await Promise.all([
        db.collection(`companies/${me.companyId}/appointments`).where(field, '==', me.id).limit(100).get().catch(() => null),
        db.collection(`companies/${me.companyId}/reservations`).where(field, '==', me.id).limit(100).get().catch(() => null),
        db.collection(`companies/${me.companyId}/orders`).where(field, '==', me.id).limit(100).get().catch(() => null),
        db.collection(`companies/${me.companyId}/quoteRequests`).where(field, '==', me.id).limit(50).get().catch(() => null),
    ]);
    const companyDoc = await db.collection('companies').doc(me.companyId).get();
    const company = {
        name: companyDoc.data()?.['name'] || 'Entreprise',
        phone: companyDoc.data()?.['phone'] || '',
        email: companyDoc.data()?.['email'] || '',
        logoUrl: companyDoc.data()?.['logoUrl'] || '',
    };
    res.json({
        success: true,
        data: {
            company,
            me: { type: me.type, id: me.id },
            appointments: apptSnap ? apptSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [],
            reservations: resvSnap ? resvSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [],
            orders: orderSnap ? orderSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [],
            quoteRequests: quoteSnap ? quoteSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [],
        },
    });
}));
async function cancelDoc(collPath, docId, me, res, itemLabel) {
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(collPath).doc(docId);
    const doc = await ref.get();
    if (!doc.exists) {
        res.status(404).json({ success: false, message: `${itemLabel} introuvable.` });
        return;
    }
    const data = doc.data() ?? {};
    const stored = me.type === 'email'
        ? (data['clientEmail'] ?? '').toLowerCase().trim()
        : (data['clientPhone'] ?? '').replace(/[^0-9+]/g, '');
    if (stored !== me.id) {
        res.status(403).json({ success: false, message: 'Identité invalide.' });
        return;
    }
    const status = data['status'] ?? '';
    if (status === 'paid' || status === 'fulfilled' || status === 'cancelled' || status === 'rejected') {
        res.status(400).json({ success: false, message: `Cet élément ne peut plus être annulé (statut: ${status}).` });
        return;
    }
    await ref.update({ status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'client_magic' });
    res.json({ success: true });
}
router.post('/cancel-appointment', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const me = authed(req, res);
    if (!me)
        return;
    const { appointmentId } = req.body;
    if (!appointmentId) {
        res.status(400).json({ success: false, message: 'appointmentId required' });
        return;
    }
    await cancelDoc(`companies/${me.companyId}/appointments`, appointmentId, me, res, 'Rendez-vous');
}));
router.post('/cancel-reservation', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const me = authed(req, res);
    if (!me)
        return;
    const { reservationId } = req.body;
    if (!reservationId) {
        res.status(400).json({ success: false, message: 'reservationId required' });
        return;
    }
    await cancelDoc(`companies/${me.companyId}/reservations`, reservationId, me, res, 'Réservation');
}));
router.post('/cancel-order', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const me = authed(req, res);
    if (!me)
        return;
    const { orderId } = req.body;
    if (!orderId) {
        res.status(400).json({ success: false, message: 'orderId required' });
        return;
    }
    await cancelDoc(`companies/${me.companyId}/orders`, orderId, me, res, 'Commande');
}));
exports.default = router;
//# sourceMappingURL=myStatus.routes.js.map