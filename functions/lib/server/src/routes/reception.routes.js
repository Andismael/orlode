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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicBookingHandler = void 0;
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const notificationService_1 = require("../services/notificationService");
const receptionAutomation_1 = require("../services/receptionAutomation");
const multer_1 = __importDefault(require("multer"));
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ─── EMPLOYEE CODES (admin only) ─────────────────────────────────────────────
/** Generate a unique 6-digit code not already used in this company */
async function generateUniqueCode(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    for (let attempt = 0; attempt < 20; attempt++) {
        const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
        const snap = await db.collection('users')
            .where('companyId', '==', companyId)
            .where('employeeCode', '==', code)
            .limit(1).get();
        if (snap.empty)
            return code;
    }
    // fallback: 8 digits
    return String(Math.floor(10000000 + Math.random() * 90000000));
}
// GET /api/reception/my-code — current employee fetches their own code
router.get('/my-code', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('users').doc(uid).get();
    const data = doc.data() ?? {};
    res.json({
        success: true,
        data: {
            employeeCode: data['employeeCode'] ?? null,
            codeActive: data['codeActive'] ?? false,
            codeGeneratedAt: data['codeGeneratedAt'] ?? null,
            qrToken: data['qrToken'] ?? null,
            qrActive: data['qrActive'] ?? false,
        },
    });
}));
// GET /api/reception/employee-codes — list all employees with their codes
router.get('/employee-codes', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('users')
        .where('companyId', '==', companyId)
        .limit(500).get();
    const employees = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            name: data['displayName'] ?? data['email'] ?? '',
            email: data['email'] ?? '',
            role: data['role'] ?? '',
            department: data['department'] ?? '',
            employeeCode: data['employeeCode'] ?? null,
            codeActive: data['codeActive'] ?? false,
            codeGeneratedAt: data['codeGeneratedAt'] ?? null,
            qrToken: data['qrToken'] ?? null,
            qrActive: data['qrActive'] ?? false,
        };
    });
    res.json({ success: true, data: employees });
}));
// POST /api/reception/employee-codes/:userId/generate — admin generates code
router.post('/employee-codes/:userId/generate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin or manager only', 403);
    const db = (0, firebase_config_1.getFirestore)();
    const userDoc = await db.collection('users').doc(req.params.userId).get();
    if (!userDoc.exists)
        throw new error_middleware_1.AppError('User not found', 404);
    if (userDoc.data()?.companyId !== companyId)
        throw new error_middleware_1.AppError('User not in your company', 403);
    const code = await generateUniqueCode(companyId);
    await db.collection('users').doc(req.params.userId).update({
        employeeCode: code,
        codeActive: true,
        codeGeneratedAt: new Date(),
    });
    res.json({ success: true, data: { code } });
}));
// POST /api/reception/employee-codes/:userId/set — admin sets a custom code (any digits)
router.post('/employee-codes/:userId/set', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin or manager only', 403);
    const { code } = req.body;
    if (!code || !/^[0-9]{3,20}$/.test(code))
        throw new error_middleware_1.AppError('Code invalide — doit être 3 à 20 chiffres', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const userDoc = await db.collection('users').doc(req.params.userId).get();
    if (!userDoc.exists)
        throw new error_middleware_1.AppError('User not found', 404);
    if (userDoc.data()?.companyId !== companyId)
        throw new error_middleware_1.AppError('User not in your company', 403);
    // Check uniqueness in this company
    const dup = await db.collection('users')
        .where('companyId', '==', companyId)
        .where('employeeCode', '==', code)
        .limit(1).get();
    if (!dup.empty && dup.docs[0].id !== req.params.userId) {
        throw new error_middleware_1.AppError(`Code déjà utilisé par ${dup.docs[0].data()['displayName'] ?? dup.docs[0].data()['email']}`, 409);
    }
    await db.collection('users').doc(req.params.userId).update({
        employeeCode: code,
        codeActive: true,
        codeGeneratedAt: new Date(),
    });
    res.json({ success: true, data: { code } });
}));
// POST /api/reception/employee-codes/:userId/revoke — admin revokes code
router.post('/employee-codes/:userId/revoke', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin or manager only', 403);
    const db = (0, firebase_config_1.getFirestore)();
    const userDoc = await db.collection('users').doc(req.params.userId).get();
    if (!userDoc.exists)
        throw new error_middleware_1.AppError('User not found', 404);
    if (userDoc.data()?.companyId !== companyId)
        throw new error_middleware_1.AppError('User not in your company', 403);
    await db.collection('users').doc(req.params.userId).update({
        employeeCode: null,
        codeActive: false,
        codeRevokedAt: new Date(),
    });
    res.json({ success: true });
}));
// POST /api/reception/checkin-by-code — employee checks in with their code (no auth needed for kiosk)
router.post('/checkin-by-code', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const code = body['code'];
    if (!code)
        throw new error_middleware_1.AppError('Code required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('users')
        .where('companyId', '==', companyId)
        .where('employeeCode', '==', code)
        .where('codeActive', '==', true)
        .limit(1).get();
    if (snap.empty)
        throw new error_middleware_1.AppError('Code invalide ou revoque', 401);
    const employee = snap.docs[0];
    const empData = employee.data();
    const employeeId = employee.id;
    const today = new Date().toISOString().split('T')[0];
    const presenceId = `${employeeId}_${today}`;
    const existing = await db.collection('presence').doc(presenceId).get();
    if (existing.exists) {
        // Already checked in — do checkout
        if (existing.data()?.status === 'present') {
            const checkIn = existing.data()?.checkInAt?.toDate?.() ?? existing.data()?.checkInAt;
            const checkOut = new Date();
            const hoursWorked = checkIn ? parseFloat(((checkOut.getTime() - new Date(checkIn).getTime()) / 3600000).toFixed(2)) : 0;
            await db.collection('presence').doc(presenceId).update({
                checkOutAt: checkOut,
                status: 'checked_out',
                hoursWorked,
            });
            return res.json({
                success: true,
                data: { action: 'checkout', employeeName: empData['displayName'] ?? empData['email'], hoursWorked },
            });
        }
        // Already checked out
        return res.json({
            success: true,
            data: { action: 'already_done', employeeName: empData['displayName'] ?? empData['email'] },
        });
    }
    // Check in
    await db.collection('presence').doc(presenceId).set({
        companyId,
        employeeId,
        employeeName: empData['displayName'] ?? empData['email'] ?? '',
        employeeEmail: empData['email'] ?? '',
        department: empData['department'] ?? '',
        date: today,
        checkInAt: new Date(),
        checkOutAt: null,
        status: 'present',
    });
    const checkedName = (empData['displayName'] ?? empData['email'] ?? '');
    (0, notificationService_1.notifyPresenceCheckin)(companyId, checkedName).catch(() => { });
    res.status(201).json({
        success: true,
        data: { action: 'checkin', employeeName: checkedName },
    });
}));
// ─── VISITORS ────────────────────────────────────────────────────────────────
// GET /api/reception/visitors
router.get('/visitors', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        let query = db.collection('visitors').where('companyId', '==', companyId);
        if (req.query['today'] === 'true') {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            query = query.where('checkInAt', '>=', start).where('checkInAt', '<=', end);
        }
        const snap = await query.orderBy('checkInAt', 'desc').limit(100).get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// POST /api/reception/visitors — register walk-in
router.post('/visitors', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const visitor = {
        companyId,
        name: body['name'] ?? 'Visiteur',
        company: body['company'] ?? '',
        email: body['email'] ?? '',
        phone: body['phone'] ?? '',
        host: body['host'] ?? '',
        hostEmail: body['hostEmail'] ?? '',
        purpose: body['purpose'] ?? '',
        type: body['type'] ?? 'walkin', // walkin | appointment | delivery | vip
        photo: body['photo'] ?? null,
        checkInAt: new Date(),
        checkOutAt: null,
        status: 'checked_in',
        badgeNumber: `V-${Date.now().toString().slice(-6)}`,
        registeredBy: req.user?.uid ?? '',
    };
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('visitors').doc(id).set(visitor);
    // Notify host — multi-channel: in-app + WhatsApp + Email with action links
    (0, notificationService_1.notifyVisitorArrived)(companyId, visitor.name, visitor.host, undefined, id, visitor.company).catch(() => { });
    (0, receptionAutomation_1.notifyHostVisitorArrived)(companyId, visitor.host, visitor.name, visitor.company, visitor.badgeNumber).catch(() => { });
    // Cross-agent: VIP visitor → CRM lead
    if (visitor.type === 'vip') {
        (0, receptionAutomation_1.onVIPVisitorArrived)(companyId, { name: visitor.name, email: visitor.email, company: visitor.company, host: visitor.host, purpose: visitor.purpose }).catch(() => { });
    }
    res.status(201).json({ success: true, data: { id, ...visitor } });
}));
// GET /api/reception/visitors/:id/badge
router.get('/visitors/:id/badge', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('visitors').doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Visitor not found', 404);
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));
// ─── HOST RESPONSE WORKFLOW ──────────────────────────────────────────────────
// GET /api/reception/visitors/pending-host — visitors waiting for host response (host view)
router.get('/visitors/pending-host', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const userName = req.user?.email ?? '';
    // Get visitors where this user is the host and status is waiting
    const snap = await db.collection('visitors')
        .where('companyId', '==', companyId)
        .where('status', 'in', ['checked_in', 'waiting_host'])
        .limit(20).get();
    const myVisitors = snap.docs
        .filter(d => {
        const host = (d.data()['host'] ?? '').toLowerCase();
        return host.includes(userName.toLowerCase()) || userName.toLowerCase().includes(host);
    })
        .map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: myVisitors });
}));
// POST /api/reception/visitors/:id/host-respond — host responds to visitor arrival
router.post('/visitors/:id/host-respond', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const action = body['action']; // allow_entry | wait | redirect | decline
    const message = body['message'] ?? '';
    const redirectTo = body['redirectTo'] ?? '';
    const hostName = req.user?.email ?? 'Host';
    if (!['allow_entry', 'wait', 'redirect', 'decline'].includes(action)) {
        throw new error_middleware_1.AppError('Invalid action. Use: allow_entry, wait, redirect, decline', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    const visitorDoc = await db.collection('visitors').doc(req.params.id).get();
    if (!visitorDoc.exists)
        throw new error_middleware_1.AppError('Visitor not found', 404);
    const visitorData = visitorDoc.data();
    const visitorName = visitorData['name'] ?? 'Visiteur';
    // Map action to visitor status
    const statusMap = {
        allow_entry: 'approved_to_enter',
        wait: 'waiting_host',
        redirect: 'redirected',
        decline: 'declined',
    };
    const responseLabels = {
        allow_entry: 'Faites-le entrer',
        wait: 'Demandez-lui d\'attendre',
        redirect: `Redirigez vers ${redirectTo || 'autre personne'}`,
        decline: 'Je ne suis pas disponible',
    };
    // Update visitor status
    await db.collection('visitors').doc(req.params.id).update({
        status: statusMap[action] ?? 'checked_in',
        hostResponse: action,
        hostResponseMessage: message || responseLabels[action],
        hostRespondedAt: new Date(),
        hostRespondedBy: req.user.uid,
        redirectTo: action === 'redirect' ? redirectTo : null,
    });
    // Timeline entry
    await db.collection(`visitors/${req.params.id}/timeline`).doc((0, helpers_1.generateId)()).set({
        action: `Reponse host: ${responseLabels[action]}`,
        details: message || responseLabels[action],
        user: hostName,
        timestamp: new Date(),
    });
    // Notify reception in real-time
    const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
    // Company-wide notification (reception staff will see it)
    createNotification({
        companyId,
        type: 'system',
        title: `Reponse de ${hostName}`,
        message: `${visitorName}: ${message || responseLabels[action]}`,
        actionUrl: '/reception/visitors',
        icon: action === 'allow_entry' ? 'CheckCircle' : action === 'wait' ? 'Clock' : action === 'redirect' ? 'ArrowRight' : 'XCircle',
        severity: action === 'allow_entry' ? 'success' : action === 'decline' ? 'warning' : 'info',
    }).catch(() => { });
    // If wait with estimated time, schedule follow-up
    if (action === 'wait' && body['waitMinutes']) {
        const waitMin = parseInt(body['waitMinutes'], 10) || 5;
        await db.collection('visitors').doc(req.params.id).update({
            estimatedWait: waitMin,
            expectedEntryAt: new Date(Date.now() + waitMin * 60000).toISOString(),
        });
    }
    res.json({ success: true, data: { action, status: statusMap[action], message: responseLabels[action] } });
}));
// GET /api/reception/visitors/:id/host-status — get host response for a visitor
router.get('/visitors/:id/host-status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const doc = await (0, firebase_config_1.getFirestore)().collection('visitors').doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Visitor not found', 404);
    const d = doc.data();
    res.json({ success: true, data: {
            hostResponse: d['hostResponse'] ?? null,
            hostResponseMessage: d['hostResponseMessage'] ?? null,
            hostRespondedAt: d['hostRespondedAt'] ?? null,
            status: d['status'],
            estimatedWait: d['estimatedWait'] ?? null,
            expectedEntryAt: d['expectedEntryAt'] ?? null,
            redirectTo: d['redirectTo'] ?? null,
        } });
}));
// POST /api/reception/visitors/check-timeouts — auto-escalate visitors waiting too long
router.post('/visitors/check-timeouts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const timeoutMinutes = 5;
    const cutoff = new Date(Date.now() - timeoutMinutes * 60000);
    // Find visitors checked in more than X minutes ago with no host response
    const snap = await db.collection('visitors')
        .where('companyId', '==', cid)
        .where('status', 'in', ['checked_in', 'waiting_host'])
        .limit(20).get();
    let escalated = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        const checkIn = d['checkInAt']?.toDate?.() ?? (d['checkInAt'] ? new Date(d['checkInAt']) : null);
        if (!checkIn || checkIn > cutoff)
            continue;
        if (d['hostResponse'] === 'allow_entry')
            continue;
        if (d['escalated'])
            continue;
        const visitorName = d['name'] ?? 'Visiteur';
        const hostName = d['host'] ?? '';
        const waitMinutes = Math.round((Date.now() - checkIn.getTime()) / 60000);
        // Mark as escalated
        await doc.ref.update({ escalated: true, escalatedAt: new Date() });
        // Re-notify host
        const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
        createNotification({
            companyId: cid, type: 'system',
            title: `Rappel: ${visitorName} attend depuis ${waitMinutes} min`,
            message: `${visitorName} attend toujours a la reception pour ${hostName}. Merci de repondre.`,
            actionUrl: '/reception/host', icon: 'AlertTriangle', severity: 'warning',
        }).catch(() => { });
        // Timeline entry
        await db.collection(`visitors/${doc.id}/timeline`).doc((0, helpers_1.generateId)()).set({
            action: `Escalade: attente ${waitMinutes} min sans reponse host`,
            details: `Re-notification envoyee a ${hostName}`, user: 'system', timestamp: new Date(),
        });
        escalated++;
    }
    res.json({ success: true, data: { escalated, timeoutMinutes } });
}));
// GET /api/reception/visitors/:id/appointment-info — check if visitor has appointment + calendar context
router.get('/visitors/:id/appointment-info', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const visitorDoc = await db.collection('visitors').doc(req.params.id).get();
    if (!visitorDoc.exists)
        throw new error_middleware_1.AppError('Visitor not found', 404);
    const v = visitorDoc.data();
    const visitorName = (v['name'] ?? '').toLowerCase();
    // Check appointments
    const apptSnap = await db.collection('appointments').where('companyId', '==', cid).where('status', '==', 'confirmed').limit(50).get();
    const match = apptSnap.docs.find(d => {
        const n = (d.data()['visitorName'] ?? '').toLowerCase();
        return n.includes(visitorName) || visitorName.includes(n);
    });
    if (match) {
        const a = match.data();
        const scheduledAt = a['scheduledAt']?.toDate?.();
        const checkInAt = v['checkInAt']?.toDate?.() ?? (v['checkInAt'] ? new Date(v['checkInAt']) : null);
        const delayMin = scheduledAt && checkInAt ? Math.round((checkInAt.getTime() - scheduledAt.getTime()) / 60000) : 0;
        res.json({ success: true, data: {
                hasAppointment: true,
                scheduledAt: scheduledAt?.toISOString() ?? null,
                host: a['host'] ?? '', location: a['location'] ?? null, purpose: a['purpose'] ?? '',
                isLate: delayMin > 5, isEarly: delayMin < -10, delayMinutes: delayMin,
            } });
    }
    else {
        res.json({ success: true, data: { hasAppointment: false } });
    }
}));
// PATCH /api/reception/visitors/:id/checkout
router.patch('/visitors/:id/checkout', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('visitors').doc(req.params.id).update({
        checkOutAt: new Date(),
        status: 'checked_out',
    });
    res.json({ success: true });
}));
// DELETE /api/reception/visitors/:id
router.delete('/visitors/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('visitors').doc(req.params.id).delete();
    res.json({ success: true });
}));
// ─── APPOINTMENTS ────────────────────────────────────────────────────────────
// GET /api/reception/appointments
// Reads from the SAME collection as /api/appointments and the Clone tools:
// companies/{companyId}/appointments.
router.get('/appointments', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const todayStr = new Date().toISOString().slice(0, 10);
        let q = db.collection(`companies/${companyId}/appointments`);
        if (req.query['upcoming'] === 'true') {
            q = q.where('date', '>=', todayStr);
        }
        const snap = await q.limit(200).get();
        const items = snap.docs.map(d => {
            const raw = d.data();
            const clientName = raw['clientName'] ?? raw['visitorName'] ?? 'Client';
            return {
                ...raw,
                id: d.id,
                visitorName: clientName,
                clientName,
                host: raw['assignedToName'] ?? '',
                scheduledAt: raw['datetimeUTC'] ?? `${raw['date']}T${raw['time']}:00`,
                purpose: raw['service'] ?? raw['purpose'] ?? '',
                status: raw['status'] ?? 'pending',
            };
        });
        items.sort((a, b) => {
            const da = String(a['date'] ?? '');
            const db2 = String(b['date'] ?? '');
            const cmp = da.localeCompare(db2);
            if (cmp !== 0)
                return cmp;
            const ta = String(a['time'] ?? '');
            const tb = String(b['time'] ?? '');
            return ta.localeCompare(tb);
        });
        res.json({ success: true, data: items.slice(0, 50) });
    }
    catch (err) {
        logger_1.logger.warn('[Reception] appointments query failed', { err: String(err) });
        res.json({ success: true, data: [] });
    }
}));
// POST /api/reception/appointments
router.post('/appointments', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const appt = {
        companyId,
        visitorName: body['visitorName'] ?? '',
        visitorEmail: body['visitorEmail'] ?? '',
        visitorPhone: body['visitorPhone'] ?? '',
        visitorCompany: body['visitorCompany'] ?? '',
        host: body['host'] ?? '',
        hostEmail: body['hostEmail'] ?? '',
        purpose: body['purpose'] ?? '',
        scheduledAt: body['scheduledAt'] ? new Date(body['scheduledAt']) : new Date(),
        status: 'confirmed',
        createdAt: new Date(),
        createdBy: req.user?.uid ?? '',
    };
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('appointments').doc(id).set(appt);
    res.status(201).json({ success: true, data: { id, ...appt } });
}));
// PATCH /api/reception/appointments/:id
router.patch('/appointments/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    const body = req.body;
    await db.collection('appointments').doc(req.params.id).update({ ...body, updatedAt: new Date() });
    res.json({ success: true });
}));
// DELETE /api/reception/appointments/:id
router.delete('/appointments/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('appointments').doc(req.params.id).delete();
    res.json({ success: true });
}));
// ─── EMPLOYEE PRESENCE ───────────────────────────────────────────────────────
// GET /api/reception/presence
router.get('/presence', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection('presence')
            .where('companyId', '==', companyId)
            .where('date', '==', new Date().toISOString().split('T')[0])
            .limit(200)
            .get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// GET /api/reception/presence/history?from=&to=&employeeId=
router.get('/presence/history', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        let query = db.collection('presence').where('companyId', '==', companyId);
        if (req.query['employeeId']) {
            query = query.where('employeeId', '==', req.query['employeeId']);
        }
        if (req.query['from']) {
            query = query.where('date', '>=', req.query['from']);
        }
        if (req.query['to']) {
            query = query.where('date', '<=', req.query['to']);
        }
        const snap = await query.limit(500).get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// POST /api/reception/presence/checkin
router.post('/presence/checkin', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const employeeId = body['employeeId'] || req.user?.uid || '';
    const today = new Date().toISOString().split('T')[0];
    const id = `${employeeId}_${today}`;
    const db = (0, firebase_config_1.getFirestore)();
    const existing = await db.collection('presence').doc(id).get();
    if (existing.exists) {
        throw new error_middleware_1.AppError('Already checked in today', 400);
    }
    const record = {
        companyId,
        employeeId,
        employeeName: body['employeeName'] ?? req.user?.['displayName'] ?? '',
        employeeEmail: body['employeeEmail'] ?? req.user?.email ?? '',
        department: body['department'] ?? '',
        date: today,
        checkInAt: new Date(),
        checkOutAt: null,
        status: 'present',
        location: body['location'] ?? null, // GPS coords
        note: body['note'] ?? '',
    };
    await db.collection('presence').doc(id).set(record);
    res.status(201).json({ success: true, data: { id, ...record } });
}));
// PATCH /api/reception/presence/checkout
router.patch('/presence/checkout', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const employeeId = body['employeeId'] || req.user?.uid || '';
    const today = new Date().toISOString().split('T')[0];
    const id = `${employeeId}_${today}`;
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('presence').doc(id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('No check-in found for today', 404);
    const checkIn = doc.data()?.checkInAt?.toDate?.() ?? doc.data()?.checkInAt;
    const checkOut = new Date();
    const hoursWorked = checkIn ? parseFloat(((checkOut.getTime() - new Date(checkIn).getTime()) / 3600000).toFixed(2)) : 0;
    await db.collection('presence').doc(id).update({
        checkOutAt: checkOut,
        status: 'checked_out',
        hoursWorked,
    });
    res.json({ success: true, data: { hoursWorked } });
}));
// ─── LEAVE / ABSENCE ─────────────────────────────────────────────────────────
// GET /api/reception/leaves
router.get('/leaves', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        let query = db.collection('leaves').where('companyId', '==', companyId);
        if (req.query['status']) {
            query = query.where('status', '==', req.query['status']);
        }
        if (req.query['employeeId']) {
            query = query.where('employeeId', '==', req.query['employeeId']);
        }
        const snap = await query.limit(200).get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// NOTE: POST /leaves and PATCH /leaves/:id are handled by HR routes
// Reception only has read access to see who is absent
// ─── EMPLOYEE DIRECTORY ──────────────────────────────────────────────────────
// GET /api/reception/directory
router.get('/directory', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection('users')
            .where('companyId', '==', companyId)
            .limit(500)
            .get();
        const employees = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data['displayName'] ?? data['email'] ?? '',
                email: data['email'] ?? '',
                role: data['role'] ?? '',
                department: data['department'] ?? '',
                phone: data['phone'] ?? '',
                photo: data['photoURL'] ?? null,
                title: data['jobTitle'] ?? '',
                office: data['office'] ?? '',
                employeeCode: data['employeeCode'] ?? null,
                codeActive: data['codeActive'] ?? false,
            };
        });
        res.json({ success: true, data: employees });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// ─── STATS / ANALYTICS ──────────────────────────────────────────────────────
// GET /api/reception/stats
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        // Visitors today
        let visitorsToday = 0;
        let visitorsPresent = 0;
        try {
            const vSnap = await db.collection('visitors')
                .where('companyId', '==', companyId)
                .where('checkInAt', '>=', startOfDay)
                .where('checkInAt', '<=', endOfDay)
                .get();
            visitorsToday = vSnap.size;
            visitorsPresent = vSnap.docs.filter(d => d.data()['status'] === 'checked_in').length;
        }
        catch { /* index missing */ }
        // Employees present today
        let employeesPresent = 0;
        let employeesTotal = 0;
        try {
            const pSnap = await db.collection('presence')
                .where('companyId', '==', companyId)
                .where('date', '==', todayStr)
                .get();
            employeesPresent = pSnap.docs.filter(d => d.data()['status'] === 'present').length;
        }
        catch { /* index missing */ }
        try {
            const uSnap = await db.collection('users')
                .where('companyId', '==', companyId)
                .get();
            employeesTotal = uSnap.size;
        }
        catch { /* index missing */ }
        // Upcoming appointments
        let appointmentsToday = 0;
        try {
            const aSnap = await db.collection('appointments')
                .where('companyId', '==', companyId)
                .where('scheduledAt', '>=', startOfDay)
                .where('scheduledAt', '<=', endOfDay)
                .get();
            appointmentsToday = aSnap.size;
        }
        catch { /* index missing */ }
        // Pending leaves
        let pendingLeaves = 0;
        try {
            const lSnap = await db.collection('leaves')
                .where('companyId', '==', companyId)
                .where('status', '==', 'pending')
                .get();
            pendingLeaves = lSnap.size;
        }
        catch { /* index missing */ }
        // Weekly visitor trend (last 7 days)
        const weeklyTrend = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStart = new Date(d);
            dStart.setHours(0, 0, 0, 0);
            const dEnd = new Date(d);
            dEnd.setHours(23, 59, 59, 999);
            try {
                const snap = await db.collection('visitors')
                    .where('companyId', '==', companyId)
                    .where('checkInAt', '>=', dStart)
                    .where('checkInAt', '<=', dEnd)
                    .get();
                weeklyTrend.push({ date: d.toISOString().split('T')[0], visitors: snap.size });
            }
            catch {
                weeklyTrend.push({ date: d.toISOString().split('T')[0], visitors: 0 });
            }
        }
        res.json({
            success: true,
            data: {
                visitorsToday,
                visitorsPresent,
                employeesPresent,
                employeesTotal,
                appointmentsToday,
                pendingLeaves,
                weeklyTrend,
                presenceRate: employeesTotal > 0 ? Math.round((employeesPresent / employeesTotal) * 100) : 0,
            },
        });
    }
    catch {
        res.json({
            success: true,
            data: {
                visitorsToday: 0, visitorsPresent: 0, employeesPresent: 0, employeesTotal: 0,
                appointmentsToday: 0, pendingLeaves: 0, weeklyTrend: [], presenceRate: 0,
            },
        });
    }
}));
// GET /api/reception/stats/monthly — visitor stats by month
router.get('/stats/monthly', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const now = new Date();
        const monthlyData = [];
        for (let i = 5; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
            const label = start.toLocaleDateString('fr-FR', { month: 'short' });
            try {
                const snap = await db.collection('visitors')
                    .where('companyId', '==', companyId)
                    .where('checkInAt', '>=', start)
                    .where('checkInAt', '<=', end)
                    .get();
                let totalDuration = 0;
                let counted = 0;
                snap.docs.forEach(d => {
                    const data = d.data();
                    const cin = data['checkInAt']?.toDate?.() ?? data['checkInAt'];
                    const cout = data['checkOutAt']?.toDate?.() ?? data['checkOutAt'];
                    if (cin && cout) {
                        totalDuration += (new Date(cout).getTime() - new Date(cin).getTime()) / 60000;
                        counted++;
                    }
                });
                monthlyData.push({
                    month: label,
                    visitors: snap.size,
                    avgDuration: counted > 0 ? Math.round(totalDuration / counted) : 0,
                });
            }
            catch {
                monthlyData.push({ month: label, visitors: 0, avgDuration: 0 });
            }
        }
        res.json({ success: true, data: monthlyData });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// ─── CHECKIN SETTINGS (admin) ────────────────────────────────────────────────
// GET /api/reception/checkin-settings
router.get('/checkin-settings', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('checkinSettings').doc(companyId).get();
    const defaults = {
        methods: { code: true, camera: false, qr: false },
        schedule: {
            morningStart: '07:00',
            morningEnd: '10:00',
            eveningStart: '16:00',
            eveningEnd: '20:00',
        },
        faceTolerance: 0.55,
        minHoursBetween: 4,
        autoCheckoutHour: '22:00',
    };
    res.json({ success: true, data: doc.exists ? { ...defaults, ...doc.data() } : defaults });
}));
// PUT /api/reception/checkin-settings
router.put('/checkin-settings', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin only', 403);
    const db = (0, firebase_config_1.getFirestore)();
    const body = req.body;
    await db.collection('checkinSettings').doc(companyId).set({
        ...body,
        updatedAt: new Date(),
        updatedBy: req.user?.uid,
    }, { merge: true });
    res.json({ success: true });
}));
// ─── FACE-BASED CHECKIN ──────────────────────────────────────────────────────
/**
 * POST /api/reception/checkin-by-face-match
 * Receives a 128-dim face descriptor from the kiosk camera, finds the closest
 * enrolled employee (Euclidean distance, threshold 0.6), and triggers the
 * standard check-in/check-out flow. Returns 404 if no match below threshold.
 */
router.post('/checkin-by-face-match', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const descriptor = body.descriptor;
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
        throw new error_middleware_1.AppError('descriptor must be a 128-dim number array', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    // Read company-configured face tolerance — falls back to body.threshold then to 0.6.
    let threshold = body.threshold ?? 0.6;
    try {
        const settingsDoc = await db.collection('checkinSettings').doc(companyId).get();
        const tol = settingsDoc.data()?.['faceTolerance'];
        if (typeof tol === 'number' && tol > 0 && tol <= 1)
            threshold = tol;
    }
    catch { /* keep fallback */ }
    // Also check that camera method is enabled in settings (don't allow if admin disabled it)
    try {
        const settingsDoc = await db.collection('checkinSettings').doc(companyId).get();
        const cameraEnabled = settingsDoc.data()?.['methods']?.camera;
        if (cameraEnabled === false) {
            throw new error_middleware_1.AppError('Face recognition is disabled by admin. Use code or QR.', 403);
        }
    }
    catch (err) {
        if (err instanceof error_middleware_1.AppError)
            throw err;
        /* keep going on Firestore read errors */
    }
    const snap = await db.collection('employees')
        .where('companyId', '==', companyId)
        .limit(500).get();
    let bestMatch = null;
    for (const doc of snap.docs) {
        const d = doc.data();
        const enrolled = d['faceDescriptor'];
        if (!Array.isArray(enrolled) || enrolled.length !== 128)
            continue;
        let sum = 0;
        for (let i = 0; i < 128; i++) {
            const diff = (descriptor[i] ?? 0) - (enrolled[i] ?? 0);
            sum += diff * diff;
        }
        const distance = Math.sqrt(sum);
        if (!bestMatch || distance < bestMatch.distance) {
            bestMatch = { id: doc.id, name: d['name'] ?? 'Inconnu', distance };
        }
    }
    if (!bestMatch || bestMatch.distance > threshold) {
        res.status(404).json({
            success: false,
            message: 'Aucun employé reconnu',
            bestDistance: bestMatch?.distance ?? null,
            threshold,
        });
        return;
    }
    // Match found → run the same check-in/out logic as /checkin-by-face
    const employeeId = bestMatch.id;
    const empDoc = await db.collection('employees').doc(employeeId).get();
    const empData = empDoc.data();
    const employeeName = empData['name'] ?? bestMatch.name;
    const today = new Date().toISOString().split('T')[0];
    const presenceId = `${employeeId}_${today}`;
    const existing = await db.collection('presence').doc(presenceId).get();
    if (existing.exists) {
        if (existing.data()?.status === 'present') {
            const checkIn = existing.data()?.checkInAt?.toDate?.() ?? existing.data()?.checkInAt;
            const checkOut = new Date();
            const hoursWorked = checkIn ? parseFloat(((checkOut.getTime() - new Date(checkIn).getTime()) / 3600000).toFixed(2)) : 0;
            await db.collection('presence').doc(presenceId).update({ checkOutAt: checkOut, status: 'checked_out', hoursWorked });
            res.json({ success: true, data: { action: 'checkout', employeeId, employeeName, hoursWorked, confidence: 1 - bestMatch.distance } });
            return;
        }
        res.json({ success: true, data: { action: 'already_done', employeeId, employeeName, confidence: 1 - bestMatch.distance } });
        return;
    }
    await db.collection('presence').doc(presenceId).set({
        companyId, employeeId, employeeName,
        employeeEmail: empData['email'] ?? '',
        department: empData['department'] ?? '',
        date: today,
        checkInAt: new Date(),
        checkOutAt: null,
        status: 'present',
        method: 'camera_match',
        matchDistance: bestMatch.distance,
    });
    res.status(201).json({
        success: true,
        data: { action: 'checkin', employeeId, employeeName, confidence: 1 - bestMatch.distance },
    });
}));
// POST /api/reception/checkin-by-face — match a face descriptor to an employee and check in/out
router.post('/checkin-by-face', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const employeeId = body['employeeId'];
    if (!employeeId)
        throw new error_middleware_1.AppError('Employee ID required', 400);
    // Verify employee belongs to company
    const db = (0, firebase_config_1.getFirestore)();
    const empDoc = await db.collection('employees').doc(employeeId).get();
    if (!empDoc.exists)
        throw new error_middleware_1.AppError('Employee not found', 404);
    if (empDoc.data()?.companyId !== companyId)
        throw new error_middleware_1.AppError('Employee not in company', 403);
    const empData = empDoc.data();
    const employeeName = empData['name'] ?? '';
    const today = new Date().toISOString().split('T')[0];
    const presenceId = `${employeeId}_${today}`;
    const existing = await db.collection('presence').doc(presenceId).get();
    if (existing.exists) {
        if (existing.data()?.status === 'present') {
            const checkIn = existing.data()?.checkInAt?.toDate?.() ?? existing.data()?.checkInAt;
            const checkOut = new Date();
            const hoursWorked = checkIn ? parseFloat(((checkOut.getTime() - new Date(checkIn).getTime()) / 3600000).toFixed(2)) : 0;
            await db.collection('presence').doc(presenceId).update({ checkOutAt: checkOut, status: 'checked_out', hoursWorked });
            return res.json({ success: true, data: { action: 'checkout', employeeName, hoursWorked } });
        }
        return res.json({ success: true, data: { action: 'already_done', employeeName } });
    }
    await db.collection('presence').doc(presenceId).set({
        companyId, employeeId, employeeName,
        employeeEmail: empData['email'] ?? '',
        department: empData['department'] ?? '',
        date: today,
        checkInAt: new Date(),
        checkOutAt: null,
        status: 'present',
        method: 'camera',
    });
    res.status(201).json({ success: true, data: { action: 'checkin', employeeName } });
}));
// ─── QR BADGE ────────────────────────────────────────────────────────────────
// POST /api/reception/employee-codes/:userId/generate-qr — generate QR data for employee
router.post('/employee-codes/:userId/generate-qr', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin only', 403);
    const db = (0, firebase_config_1.getFirestore)();
    const userDoc = await db.collection('users').doc(req.params.userId).get();
    if (!userDoc.exists)
        throw new error_middleware_1.AppError('User not found', 404);
    if (userDoc.data()?.companyId !== companyId)
        throw new error_middleware_1.AppError('Not in company', 403);
    // QR token = companyId:userId:random
    const qrToken = `${companyId}:${req.params.userId}:${Date.now().toString(36)}`;
    await db.collection('users').doc(req.params.userId).update({
        qrToken,
        qrActive: true,
        qrGeneratedAt: new Date(),
    });
    res.json({ success: true, data: { qrToken } });
}));
// POST /api/reception/employee-codes/:userId/revoke-qr
router.post('/employee-codes/:userId/revoke-qr', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin only', 403);
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('users').doc(req.params.userId).update({
        qrToken: null,
        qrActive: false,
    });
    res.json({ success: true });
}));
// POST /api/reception/checkin-by-qr — scan QR code to check in/out
router.post('/checkin-by-qr', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const qrToken = body['qrToken'];
    if (!qrToken)
        throw new error_middleware_1.AppError('QR token required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('users')
        .where('companyId', '==', companyId)
        .where('qrToken', '==', qrToken)
        .where('qrActive', '==', true)
        .limit(1).get();
    if (snap.empty)
        throw new error_middleware_1.AppError('QR invalide ou revoque', 401);
    const employee = snap.docs[0];
    const empData = employee.data();
    const employeeId = employee.id;
    const employeeName = empData['displayName'] ?? empData['email'] ?? '';
    const today = new Date().toISOString().split('T')[0];
    const presenceId = `${employeeId}_${today}`;
    const existing = await db.collection('presence').doc(presenceId).get();
    if (existing.exists) {
        if (existing.data()?.status === 'present') {
            const checkIn = existing.data()?.checkInAt?.toDate?.() ?? existing.data()?.checkInAt;
            const checkOut = new Date();
            const hoursWorked = checkIn ? parseFloat(((checkOut.getTime() - new Date(checkIn).getTime()) / 3600000).toFixed(2)) : 0;
            await db.collection('presence').doc(presenceId).update({ checkOutAt: checkOut, status: 'checked_out', hoursWorked });
            return res.json({ success: true, data: { action: 'checkout', employeeName, hoursWorked } });
        }
        return res.json({ success: true, data: { action: 'already_done', employeeName } });
    }
    await db.collection('presence').doc(presenceId).set({
        companyId, employeeId, employeeName,
        employeeEmail: empData['email'] ?? '',
        department: empData['department'] ?? '',
        date: today,
        checkInAt: new Date(),
        checkOutAt: null,
        status: 'present',
        method: 'qr',
    });
    res.status(201).json({ success: true, data: { action: 'checkin', employeeName } });
}));
// ─── EMPLOYEE BADGES ────────────────────────────────────────────────────────
const badgePhotoUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/'))
            cb(null, true);
        else
            cb(new Error('Only image files are allowed'));
    },
}).single('photo');
// GET /api/reception/badges — list all employee badges
router.get('/badges', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('employeeBadges')
        .where('companyId', '==', companyId)
        .limit(500).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// GET /api/reception/badges/:id — get a single badge
router.get('/badges/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('employeeBadges').doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Badge not found', 404);
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));
// POST /api/reception/badges — create employee badge (with optional photo upload)
router.post('/badges', (req, res, next) => {
    badgePhotoUpload(req, res, (err) => {
        if (err)
            return res.status(400).json({ success: false, message: err.message });
        next();
    });
}, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin or manager only', 403);
    const body = req.body;
    const employeeId = body['employeeId'];
    if (!employeeId)
        throw new error_middleware_1.AppError('Employee ID required', 400);
    // Verify employee exists
    const db = (0, firebase_config_1.getFirestore)();
    const empDoc = await db.collection('users').doc(employeeId).get();
    if (!empDoc.exists)
        throw new error_middleware_1.AppError('Employee not found', 404);
    if (empDoc.data()?.companyId !== companyId)
        throw new error_middleware_1.AppError('Not in company', 403);
    const empData = empDoc.data();
    const badgeId = (0, helpers_1.generateId)();
    const badgeNumber = `EMP-${Date.now().toString().slice(-6)}`;
    // Upload photo to Firebase Storage if provided
    let photoURL = null;
    const file = req.file;
    if (file) {
        const bucket = (0, firebase_config_1.getStorage)().bucket();
        const filePath = `badges/${companyId}/${employeeId}-${Date.now()}.${file.mimetype.split('/')[1]}`;
        const fileRef = bucket.file(filePath);
        await fileRef.save(file.buffer, { contentType: file.mimetype, public: true });
        photoURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    }
    else if (body['photoURL']) {
        photoURL = body['photoURL'];
    }
    else if (empData['photoURL']) {
        photoURL = empData['photoURL'];
    }
    const badge = {
        companyId,
        employeeId,
        badgeNumber,
        employeeName: body['employeeName'] || empData['displayName'] || empData['email'] || '',
        department: body['department'] || empData['department'] || '',
        jobTitle: body['jobTitle'] || empData['jobTitle'] || '',
        email: empData['email'] || '',
        phone: body['phone'] || empData['phone'] || '',
        photoURL,
        status: 'active',
        issuedAt: new Date(),
        expiresAt: body['expiresAt'] ? new Date(body['expiresAt']) : null,
        createdBy: req.user?.uid || '',
    };
    await db.collection('employeeBadges').doc(badgeId).set(badge);
    // Also update user doc with badge info
    await db.collection('users').doc(employeeId).update({
        badgeId,
        badgeNumber,
        badgePhotoURL: photoURL,
        badgeIssuedAt: new Date(),
    });
    res.status(201).json({ success: true, data: { id: badgeId, ...badge } });
}));
// PUT /api/reception/badges/:id/photo — update badge photo
router.put('/badges/:id/photo', (req, res, next) => {
    badgePhotoUpload(req, res, (err) => {
        if (err)
            return res.status(400).json({ success: false, message: err.message });
        next();
    });
}, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin only', 403);
    const file = req.file;
    if (!file)
        throw new error_middleware_1.AppError('Photo file required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const badgeDoc = await db.collection('employeeBadges').doc(req.params.id).get();
    if (!badgeDoc.exists)
        throw new error_middleware_1.AppError('Badge not found', 404);
    if (badgeDoc.data()?.companyId !== companyId)
        throw new error_middleware_1.AppError('Not in company', 403);
    const employeeId = badgeDoc.data()?.employeeId;
    const bucket = (0, firebase_config_1.getStorage)().bucket();
    const filePath = `badges/${companyId}/${employeeId}-${Date.now()}.${file.mimetype.split('/')[1]}`;
    const fileRef = bucket.file(filePath);
    await fileRef.save(file.buffer, { contentType: file.mimetype, public: true });
    const photoURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    await db.collection('employeeBadges').doc(req.params.id).update({ photoURL, updatedAt: new Date() });
    await db.collection('users').doc(employeeId).update({ badgePhotoURL: photoURL });
    res.json({ success: true, data: { photoURL } });
}));
// PATCH /api/reception/badges/:id — update badge info
router.patch('/badges/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin only', 403);
    const db = (0, firebase_config_1.getFirestore)();
    const badgeDoc = await db.collection('employeeBadges').doc(req.params.id).get();
    if (!badgeDoc.exists)
        throw new error_middleware_1.AppError('Badge not found', 404);
    if (badgeDoc.data()?.companyId !== companyId)
        throw new error_middleware_1.AppError('Not in company', 403);
    const body = req.body;
    const allowed = ['employeeName', 'department', 'jobTitle', 'phone', 'status', 'expiresAt'];
    const updates = { updatedAt: new Date() };
    for (const key of allowed) {
        if (body[key] !== undefined)
            updates[key] = body[key];
    }
    await db.collection('employeeBadges').doc(req.params.id).update(updates);
    res.json({ success: true });
}));
// DELETE /api/reception/badges/:id — revoke/delete badge
router.delete('/badges/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const role = req.user?.role;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (role !== 'admin' && role !== 'manager')
        throw new error_middleware_1.AppError('Admin only', 403);
    const db = (0, firebase_config_1.getFirestore)();
    const badgeDoc = await db.collection('employeeBadges').doc(req.params.id).get();
    if (!badgeDoc.exists)
        throw new error_middleware_1.AppError('Badge not found', 404);
    if (badgeDoc.data()?.companyId !== companyId)
        throw new error_middleware_1.AppError('Not in company', 403);
    const employeeId = badgeDoc.data()?.employeeId;
    await db.collection('employeeBadges').doc(req.params.id).delete();
    await db.collection('users').doc(employeeId).update({
        badgeId: null, badgeNumber: null, badgePhotoURL: null, badgeIssuedAt: null,
    });
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// PRE-REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/pre-registrations', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${cid}/preRegistrations`);
    if (req.query['status'])
        q = q.where('status', '==', req.query['status']);
    const snap = await q.orderBy('createdAt', 'desc').limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.post('/pre-registrations', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const qrCode = `PRE-${id.slice(0, 8).toUpperCase()}`;
    const prereg = {
        id, visitorName: body['visitorName'] ?? '', visitorEmail: body['visitorEmail'] ?? '',
        visitorCompany: body['visitorCompany'] ?? '', hostName: body['hostName'] ?? '',
        hostEmail: body['hostEmail'] ?? '', purpose: body['purpose'] ?? '',
        scheduledDate: body['scheduledDate'] ?? '', scheduledTime: body['scheduledTime'] ?? '09:00',
        requiresNDA: body['requiresNDA'] ?? false, requiresParking: body['requiresParking'] ?? false,
        notes: body['notes'] ?? '', qrCode, status: 'pending_approval',
        ndaSigned: false, checkedIn: false, createdAt: new Date(), createdBy: req.user.uid,
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/preRegistrations`).doc(id).set(prereg);
    res.status(201).json({ success: true, data: prereg });
}));
router.patch('/pre-registrations/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/preRegistrations`).doc(req.params.id).update({ ...req.body, updatedAt: new Date() });
    res.json({ success: true });
}));
// QR check-in from pre-registration
router.post('/checkin-by-prereg', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { qrCode } = req.body;
    if (!qrCode)
        throw new error_middleware_1.AppError('qrCode required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${cid}/preRegistrations`).where('qrCode', '==', qrCode).where('status', '==', 'approved').limit(1).get();
    if (snap.empty) {
        res.json({ success: false, message: 'QR invalide ou non approuve' });
        return;
    }
    const prereg = snap.docs[0].data();
    // Auto check-in visitor
    const visitId = (0, helpers_1.generateId)();
    const badgeNumber = `V-${Date.now().toString().slice(-6)}`;
    await db.collection('visitors').doc(visitId).set({
        companyId: cid, id: visitId, name: prereg['visitorName'], email: prereg['visitorEmail'] ?? null,
        company: prereg['visitorCompany'] ?? '', host: prereg['hostName'], purpose: prereg['purpose'] ?? '',
        type: 'appointment', badgeNumber, status: 'checked_in', preRegistrationId: snap.docs[0].id,
        checkInAt: new Date(), createdAt: new Date(),
    });
    await snap.docs[0].ref.update({ status: 'checked_in', checkedIn: true, checkedInAt: new Date() });
    // Notify host
    const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
    createNotification({ companyId: cid, type: 'visitor_arrived', title: 'Visiteur arrive', message: `${prereg['visitorName']} (pre-enregistre) vient d'arriver. Badge: ${badgeNumber}`, actionUrl: '/reception/visitors', icon: 'UserCheck', severity: 'info' }).catch(() => { });
    res.json({ success: true, data: { visitId, badgeNumber, visitorName: prereg['visitorName'] } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERIES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/deliveries', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/deliveries`);
    if (req.query['status'])
        q = q.where('status', '==', req.query['status'] === 'pending' ? 'received' : req.query['status']);
    const snap = await q.orderBy('receivedAt', 'desc').limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.post('/deliveries', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const delivery = {
        id, carrier: body['carrier'] ?? '', trackingNumber: body['trackingNumber'] ?? '',
        itemCount: body['itemCount'] ?? 1, description: body['description'] ?? '',
        recipientName: body['recipientName'] ?? '', recipientDepartment: body['recipientDepartment'] ?? '',
        signed: false, status: 'received', receivedAt: new Date(), collectedAt: null, createdBy: req.user.uid,
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/deliveries`).doc(id).set(delivery);
    // Notify recipient + cross-agent: Accounting notification
    const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
    createNotification({ companyId: cid, type: 'system', title: 'Colis recu', message: `Un colis de ${body['carrier']} est arrive pour ${body['recipientName']}. ${body['itemCount'] ?? 1} article(s).`, actionUrl: '/reception/deliveries', icon: 'Package', severity: 'info' }).catch(() => { });
    (0, receptionAutomation_1.onDeliveryReceived)(cid, { carrier: delivery.carrier, trackingNumber: delivery.trackingNumber, recipientName: delivery.recipientName, itemCount: delivery.itemCount }).catch(() => { });
    res.status(201).json({ success: true, data: delivery });
}));
router.patch('/deliveries/:id/collect', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/deliveries`).doc(req.params.id).update({ status: 'collected', collectedAt: new Date(), collectedBy: req.user.uid });
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// EMERGENCY EVACUATION
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/evacuation', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const today = new Date().toISOString().split('T')[0];
    const [presSnap, visSnap] = await Promise.all([
        db.collection('presence').where('companyId', '==', cid).where('date', '==', today).where('status', '==', 'present').limit(500).get(),
        db.collection('visitors').where('companyId', '==', cid).where('status', '==', 'checked_in').limit(100).get(),
    ]);
    const employees = presSnap.docs.map(d => ({ name: d.data()['employeeName'] ?? '', department: d.data()['department'] ?? '' }));
    const visitors = visSnap.docs.map(d => ({ name: d.data()['name'] ?? '', host: d.data()['host'] ?? '', company: d.data()['company'] ?? '' }));
    res.json({ success: true, data: { totalInBuilding: employees.length + visitors.length, employees, visitors, employeeCount: employees.length, visitorCount: visitors.length, lastUpdated: new Date().toISOString() } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// PARKING
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/parking', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/parkingSpots`).limit(100).get();
    const spots = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: { spots, total: spots.length, available: spots.filter(s => s['status'] === 'available').length } });
}));
router.post('/parking/reserve', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const col = db.collection(`companies/${cid}/parkingSpots`);
    const available = await col.where('status', '==', 'available').limit(1).get();
    let spotId;
    if (available.empty) {
        spotId = `P-${(await col.get()).size + 1}`;
        await col.doc(spotId).set({ id: spotId, status: 'reserved', occupant: body['visitorName'] ?? '', plate: body['plateNumber'] ?? '', reservedAt: new Date() });
    }
    else {
        spotId = available.docs[0].id;
        await available.docs[0].ref.update({ status: 'reserved', occupant: body['visitorName'] ?? '', plate: body['plateNumber'] ?? '', reservedAt: new Date() });
    }
    res.json({ success: true, data: { spotId } });
}));
router.post('/parking/:id/release', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/parkingSpots`).doc(req.params.id).update({ status: 'available', occupant: '', plate: '', reservedAt: null });
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// VISITOR ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/analytics', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const days = req.query['period'] === 'week' ? 7 : req.query['period'] === 'quarter' ? 90 : 30;
    const cutoff = new Date(Date.now() - days * 86400000);
    const snap = await (0, firebase_config_1.getFirestore)().collection('visitors').where('companyId', '==', cid).where('checkInAt', '>=', cutoff).limit(500).get();
    const visitors = snap.docs.map(d => d.data());
    const hourCounts = {};
    const purposes = {};
    const types = {};
    const dailyCounts = {};
    let totalDuration = 0, durationCount = 0;
    const emails = new Set();
    visitors.forEach(v => {
        const ci = v['checkInAt']?.toDate?.();
        const co = v['checkOutAt']?.toDate?.();
        if (ci) {
            hourCounts[ci.getHours()] = (hourCounts[ci.getHours()] ?? 0) + 1;
            dailyCounts[ci.toISOString().split('T')[0]] = (dailyCounts[ci.toISOString().split('T')[0]] ?? 0) + 1;
        }
        if (ci && co) {
            totalDuration += (co.getTime() - ci.getTime()) / 60000;
            durationCount++;
        }
        const p = v['purpose'] ?? 'Non specifie';
        purposes[p] = (purposes[p] ?? 0) + 1;
        const t = v['type'] ?? 'walkin';
        types[t] = (types[t] ?? 0) + 1;
        const e = v['email'];
        if (e)
            emails.add(e);
    });
    res.json({ success: true, data: {
            totalVisitors: visitors.length, avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
            repeatVisitors: visitors.length - emails.size, uniqueCompanies: new Set(visitors.map(v => v['company'] ?? '').filter(Boolean)).size,
            peakHours: Object.entries(hourCounts).map(([h, c]) => ({ hour: Number(h), count: c })).sort((a, b) => b.count - a.count),
            purposeBreakdown: Object.entries(purposes).map(([p, c]) => ({ purpose: p, count: c })).sort((a, b) => b.count - a.count),
            typeBreakdown: Object.entries(types).map(([t, c]) => ({ type: t, count: c })).sort((a, b) => b.count - a.count),
            dailyTrend: Object.entries(dailyCounts).map(([d, c]) => ({ date: d, count: c })).sort((a, b) => a.date.localeCompare(b.date)),
        } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// VISITOR TIMELINE (audit trail)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/visitors/:id/timeline', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`visitors/${req.params.id}/timeline`).orderBy('timestamp', 'asc').limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.post('/visitors/:id/timeline', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const entry = { id, action: body['action'] ?? '', details: body['details'] ?? '', user: req.user.uid, timestamp: new Date() };
    await (0, firebase_config_1.getFirestore)().collection(`visitors/${req.params.id}/timeline`).doc(id).set(entry);
    res.status(201).json({ success: true, data: entry });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// NDA / CONSENT
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/visitors/:id/nda', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const ndaId = (0, helpers_1.generateId)();
    await db.collection(`visitors/${req.params.id}/nda`).doc(ndaId).set({
        id: ndaId, version: body['version'] ?? '1.0', signedAt: new Date(),
        signatureData: body['signatureData'] ?? '', // base64 signature image
        consentGDPR: body['consentGDPR'] ?? true,
        visitorName: body['visitorName'] ?? '',
        ipAddress: req.ip ?? '',
    });
    // Update visitor record
    await db.collection('visitors').doc(req.params.id).update({ ndaSigned: true, ndaSignedAt: new Date(), ndaVersion: body['version'] ?? '1.0' });
    // Timeline entry
    await db.collection(`visitors/${req.params.id}/timeline`).doc((0, helpers_1.generateId)()).set({
        action: 'NDA signe', details: `Version ${body['version'] ?? '1.0'} — consentement RGPD`, user: 'visitor', timestamp: new Date(),
    });
    res.json({ success: true, data: { ndaId } });
}));
router.get('/visitors/:id/nda', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const snap = await (0, firebase_config_1.getFirestore)().collection(`visitors/${req.params.id}/nda`).orderBy('signedAt', 'desc').limit(5).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// ENRICHED PRESENCE STATUS
// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/reception/presence/status — update enriched status
router.patch('/presence/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const employeeId = body['employeeId'] ?? req.user.uid;
    const today = new Date().toISOString().split('T')[0];
    const presenceId = `${employeeId}_${today}`;
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('presence').doc(presenceId).get();
    const statusUpdate = {
        richStatus: body['status'] ?? 'present', // present | absent | busy | break | on_leave | remote | offsite | in_meeting
        statusLocation: body['location'] ?? null,
        statusNote: body['note'] ?? null,
        statusStartedAt: new Date(),
        expectedBackAt: body['expectedBackAt'] ? new Date(body['expectedBackAt']) : null,
        leaveType: body['leaveType'] ?? null,
        returnDate: body['returnDate'] ?? null,
        statusUpdatedBy: req.user.uid,
        statusUpdatedAt: new Date(),
    };
    if (doc.exists) {
        await db.collection('presence').doc(presenceId).update(statusUpdate);
    }
    else {
        // Create presence record if doesn't exist
        const uDoc = await db.collection('users').doc(employeeId).get();
        const uData = uDoc.data() ?? {};
        await db.collection('presence').doc(presenceId).set({
            companyId: cid, employeeId,
            employeeName: uData['displayName'] ?? '',
            employeeEmail: uData['email'] ?? '',
            department: uData['department'] ?? '',
            date: today, checkInAt: new Date(), checkOutAt: null,
            status: body['status'] === 'absent' || body['status'] === 'on_leave' ? 'absent' : 'present',
            ...statusUpdate,
        });
    }
    res.json({ success: true });
}));
// GET /api/reception/presence/enriched — get all enriched statuses
router.get('/presence/enriched', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const today = new Date().toISOString().split('T')[0];
    const db = (0, firebase_config_1.getFirestore)();
    const [presSnap, usersSnap] = await Promise.all([
        db.collection('presence').where('companyId', '==', cid).where('date', '==', today).limit(500).get(),
        db.collection('users').where('companyId', '==', cid).limit(500).get(),
    ]);
    const presenceMap = new Map(presSnap.docs.map(d => [d.data()['employeeId'], { id: d.id, ...d.data() }]));
    const enriched = usersSnap.docs.map(d => {
        const u = d.data();
        const p = presenceMap.get(d.id);
        return {
            employeeId: d.id,
            name: u['displayName'] ?? u['email'] ?? '',
            email: u['email'] ?? '',
            department: u['department'] ?? '',
            jobTitle: u['jobTitle'] ?? '',
            photoURL: u['photoURL'] ?? null,
            // Basic presence
            isPresent: p?.['status'] === 'present',
            checkInAt: p?.['checkInAt'] ?? null,
            checkOutAt: p?.['checkOutAt'] ?? null,
            hoursWorked: p?.['hoursWorked'] ?? null,
            // Enriched status
            richStatus: p?.['richStatus'] ?? (p ? 'present' : 'absent'),
            statusLocation: p?.['statusLocation'] ?? null,
            statusNote: p?.['statusNote'] ?? null,
            expectedBackAt: p?.['expectedBackAt'] ?? null,
            leaveType: p?.['leaveType'] ?? null,
            returnDate: p?.['returnDate'] ?? null,
            statusUpdatedAt: p?.['statusUpdatedAt'] ?? null,
        };
    });
    const statusCounts = {};
    enriched.forEach(e => { statusCounts[e.richStatus] = (statusCounts[e.richStatus] ?? 0) + 1; });
    res.json({ success: true, data: { employees: enriched, statusCounts, total: enriched.length } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC BOOKING (no auth required)
// ═══════════════════════════════════════════════════════════════════════════════
// This is registered separately in app.ts as a public route
exports.publicBookingHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.params['companyId'];
    if (!cid) {
        res.status(400).json({ success: false, message: 'Company ID required' });
        return;
    }
    const body = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    const qrCode = `PRE-${id.slice(0, 8).toUpperCase()}`;
    await db.collection(`companies/${cid}/preRegistrations`).doc(id).set({
        id, visitorName: body['visitorName'] ?? '', visitorEmail: body['visitorEmail'] ?? '',
        visitorCompany: body['visitorCompany'] ?? '', visitorPhone: body['visitorPhone'] ?? '',
        hostName: body['hostName'] ?? '', purpose: body['purpose'] ?? '',
        scheduledDate: body['scheduledDate'] ?? '', scheduledTime: body['scheduledTime'] ?? '09:00',
        requiresNDA: body['requiresNDA'] ?? false, requiresParking: body['requiresParking'] ?? false,
        notes: body['notes'] ?? '', qrCode, status: 'pending_approval',
        ndaSigned: false, checkedIn: false, source: 'public_form',
        createdAt: new Date(),
    });
    // Timeline entry
    await db.collection(`companies/${cid}/preRegistrations/${id}/timeline`).doc((0, helpers_1.generateId)()).set({
        action: 'Pre-enregistrement public', details: `${body['visitorName']} via formulaire public`, timestamp: new Date(),
    });
    res.json({ success: true, data: { registrationId: id, qrCode, message: 'Pre-enregistrement recu. Vous recevrez une confirmation une fois approuve.' } });
});
exports.default = router;
//# sourceMappingURL=reception.routes.js.map