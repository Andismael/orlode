"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Reservations + Resources routes.
 *
 * Reservations:
 *   GET  /api/reservations        — list (filters: status, from, to, resourceType)
 *   PATCH /api/reservations/:id   — action-based (confirm | reject | cancel | reschedule | assign)
 *
 * Resources (tables, rooms, halls, vehicles):
 *   GET    /api/reservations/resources
 *   POST   /api/reservations/resources
 *   PATCH  /api/reservations/resources/:id
 *   DELETE /api/reservations/resources/:id
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
async function audit(companyId, action, actorId, details) {
    try {
        await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/reservationAuditLog`).add({
            action, actorId, details, createdAt: new Date(),
        });
    }
    catch { /* non-critical */ }
}
// ── Resources (placed BEFORE /:id catch-all) ────────────────────────────────
router.get('/resources', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/resources`).limit(200).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: items });
}));
router.post('/resources', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { name, type, capacity, notes } = req.body;
    if (!name?.trim())
        throw new error_middleware_1.AppError('name required', 400);
    const validTypes = ['table', 'room', 'hall', 'vehicle', 'other'];
    if (!type || !validTypes.includes(type))
        throw new error_middleware_1.AppError('invalid type', 400);
    const id = (0, helpers_1.generateId)();
    const doc = {
        id, name: name.trim(), type, capacity: capacity ?? null, notes: notes ?? '',
        active: true, createdAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/resources`).doc(id).set(doc);
    res.json({ success: true, data: doc });
}));
router.patch('/resources/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { id } = req.params;
    const { name, type, capacity, notes, active } = req.body;
    const updates = { updatedAt: new Date() };
    if (name != null)
        updates['name'] = name;
    if (type != null)
        updates['type'] = type;
    if (capacity !== undefined)
        updates['capacity'] = capacity;
    if (notes != null)
        updates['notes'] = notes;
    if (active != null)
        updates['active'] = active;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/resources`).doc(id).update(updates);
    res.json({ success: true });
}));
router.delete('/resources/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { id } = req.params;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/resources`).doc(id).delete();
    res.json({ success: true });
}));
// ── Reservations list ───────────────────────────────────────────────────────
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { mine, status, from, to, resourceType } = req.query;
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/reservations`);
    if (mine === 'true')
        q = q.where('assignedTo', '==', userId);
    if (status)
        q = q.where('status', '==', status);
    if (resourceType)
        q = q.where('resourceType', '==', resourceType);
    if (from && DATE_REGEX.test(from))
        q = q.where('date', '>=', from);
    if (to && DATE_REGEX.test(to))
        q = q.where('date', '<=', to);
    const snap = await q.limit(500).get().catch(async (err) => {
        logger_1.logger.warn('[Reservations] query needs index, fallback', { err: String(err) });
        return await db.collection(`companies/${companyId}/reservations`).limit(500).get();
    });
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => {
        const da = String(a['date'] ?? '');
        const dbs = String(b['date'] ?? '');
        const cmp = dbs.localeCompare(da); // desc
        if (cmp !== 0)
            return cmp;
        return String(b['startTime'] ?? '').localeCompare(String(a['startTime'] ?? ''));
    });
    res.json({ success: true, data: items });
}));
// ── Reservation action-based update ─────────────────────────────────────────
router.patch('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    const userName = req.user?.email ?? 'Admin';
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { id } = req.params;
    const { action } = req.body;
    if (!action || !['confirm', 'reject', 'cancel', 'reschedule', 'assign'].includes(action)) {
        throw new error_middleware_1.AppError('Invalid action (confirm | reject | cancel | reschedule | assign)', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/reservations`).doc(id);
    const doc = await ref.get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Reservation not found', 404);
    const data = doc.data() ?? {};
    const updates = { updatedAt: new Date(), updatedBy: userId };
    if (action === 'confirm') {
        if (data['status'] === 'confirmed') {
            res.json({ success: true, data: { ...data, status: 'confirmed' }, message: 'Already confirmed' });
            return;
        }
        updates['status'] = 'confirmed';
        updates['confirmedAt'] = new Date();
        updates['confirmedBy'] = userId;
    }
    else if (action === 'reject') {
        const { reason } = req.body;
        updates['status'] = 'rejected';
        updates['rejectedAt'] = new Date();
        updates['rejectedBy'] = userId;
        if (reason)
            updates['rejectReason'] = reason;
    }
    else if (action === 'cancel') {
        const { reason } = req.body;
        updates['status'] = 'cancelled';
        updates['cancelledAt'] = new Date();
        updates['cancelledBy'] = userId;
        if (reason)
            updates['cancelReason'] = reason;
    }
    else if (action === 'assign') {
        const { assignedTo, assignedToName } = req.body;
        if (!assignedTo)
            throw new error_middleware_1.AppError('assignedTo required', 400);
        updates['assignedTo'] = assignedTo;
        updates['assignedToName'] = assignedToName ?? '';
        updates['assignedAt'] = new Date();
        updates['assignedBy'] = userId;
    }
    else if (action === 'reschedule') {
        const { date, startTime, endTime } = req.body;
        if (!date || !DATE_REGEX.test(date))
            throw new error_middleware_1.AppError('Invalid date', 400);
        if (!startTime || !TIME_REGEX.test(startTime))
            throw new error_middleware_1.AppError('Invalid startTime', 400);
        updates['previousDate'] = data['date'];
        updates['previousStartTime'] = data['startTime'];
        updates['date'] = date;
        updates['startTime'] = startTime;
        if (endTime && TIME_REGEX.test(endTime))
            updates['endTime'] = endTime;
        updates['status'] = 'rescheduled';
        updates['rescheduledAt'] = new Date();
        updates['rescheduledBy'] = userId;
    }
    await ref.update(updates);
    await audit(companyId, `reservation.${action}`, userId, { reservationId: id, by: userName, ...req.body });
    const updated = (await ref.get()).data();
    res.json({ success: true, data: { id, ...updated } });
}));
exports.default = router;
//# sourceMappingURL=reservations.routes.js.map