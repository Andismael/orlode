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
 * Messaging Routes PRO — Announcements · Contact Groups · Telegram · WhatsApp · Campaigns · Scheduling
 * Unified multi-channel messaging hub
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const notificationService_1 = require("../services/notificationService");
const telegramService_1 = require("../services/telegram/telegramService");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const safe = async (fn, fallback) => {
    try {
        return await fn();
    }
    catch {
        return fallback;
    }
};
// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS (internal broadcast)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/announcements', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/announcements`).orderBy('createdAt', 'desc').limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.post('/announcements', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const announcement = {
        id, title: body['title'] ?? '', content: body['content'] ?? '',
        priority: body['priority'] ?? 'normal', // normal | important | urgent
        targetAudience: body['targetAudience'] ?? 'all', // all | department | role
        targetValue: body['targetValue'] ?? null, // dept name or role
        pinned: body['pinned'] ?? false,
        channels: body['channels'] ?? ['in_app'], // in_app | email | telegram | whatsapp | slack
        author: req.user.uid, authorEmail: req.user.email,
        readBy: [], readCount: 0,
        createdAt: new Date(), expiresAt: body['expiresAt'] ? new Date(body['expiresAt']) : null,
    };
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection(`companies/${cid}/announcements`).doc(id).set(announcement);
    // Dispatch to channels
    const channels = body['channels'] ?? ['in_app'];
    // In-app notification to all employees
    if (channels.includes('in_app')) {
        const usersSnap = await db.collection('users').where('companyId', '==', cid).limit(200).get();
        const targets = announcement.targetAudience === 'all' ? usersSnap.docs
            : announcement.targetAudience === 'department' ? usersSnap.docs.filter(d => d.data()['department'] === announcement.targetValue)
                : usersSnap.docs.filter(d => d.data()['role'] === announcement.targetValue);
        for (const u of targets) {
            (0, notificationService_1.createNotification)({ companyId: cid, userId: u.id, type: 'system', title: `${announcement.priority === 'urgent' ? '🚨 ' : ''}${announcement.title}`, message: announcement.content.slice(0, 200), actionUrl: '/comms/announcements', icon: 'Megaphone', severity: announcement.priority === 'urgent' ? 'error' : announcement.priority === 'important' ? 'warning' : 'info' }).catch(() => { });
        }
    }
    // Telegram channel
    if (channels.includes('telegram')) {
        const prefix = announcement.priority === 'urgent' ? '🚨 URGENT' : announcement.priority === 'important' ? '⚠️ Important' : '📢 Annonce';
        (0, telegramService_1.sendTelegramChannelMessage)(cid, `*${prefix}*\n\n*${announcement.title}*\n\n${announcement.content}`).catch(() => { });
    }
    // WhatsApp (via existing service if configured)
    if (channels.includes('whatsapp')) {
        try {
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
            // Send to configured broadcast list (if any)
        }
        catch { }
    }
    res.status(201).json({ success: true, data: announcement });
}));
router.patch('/announcements/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/announcements`).doc(req.params.id).update({ ...req.body, updatedAt: new Date() });
    res.json({ success: true });
}));
router.delete('/announcements/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/announcements`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// Mark announcement as read
router.post('/announcements/:id/read', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { FieldValue } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/announcements`).doc(req.params.id).update({
        readBy: FieldValue.arrayUnion(req.user.uid), readCount: FieldValue.increment(1),
    });
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT GROUPS (distribution lists)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/groups', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/contactGroups`).limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.post('/groups', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const group = {
        id, name: body['name'] ?? '', description: body['description'] ?? '',
        type: body['type'] ?? 'manual', // manual | department | role | auto
        members: Array.isArray(body['members']) ? body['members'] : [],
        memberCount: Array.isArray(body['members']) ? body['members'].length : 0,
        autoFilter: body['autoFilter'] ?? null, // { field: 'department', value: 'IT' }
        createdBy: req.user.uid, createdAt: new Date(), updatedAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/contactGroups`).doc(id).set(group);
    res.status(201).json({ success: true, data: group });
}));
router.patch('/groups/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const updates = { ...body, updatedAt: new Date() };
    if (Array.isArray(body['members']))
        updates['memberCount'] = body['members'].length;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/contactGroups`).doc(req.params.id).update(updates);
    res.json({ success: true });
}));
router.delete('/groups/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/contactGroups`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM MESSAGING
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/telegram/send', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { chatId, message } = req.body;
    if (!message)
        throw new error_middleware_1.AppError('message required', 400);
    const result = await (0, telegramService_1.sendTelegramMessage)(cid, chatId ?? '', message);
    // Log message
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection(`companies/${cid}/messageLog`).doc((0, helpers_1.generateId)()).set({
        channel: 'telegram', chatId: chatId ?? 'default', message, success: result.success,
        messageId: result.messageId ?? null, error: result.error ?? null,
        sentBy: req.user.uid, sentAt: new Date(),
    });
    res.json({ success: result.success, data: result });
}));
router.post('/telegram/channel', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { message } = req.body;
    if (!message)
        throw new error_middleware_1.AppError('message required', 400);
    const result = await (0, telegramService_1.sendTelegramChannelMessage)(cid, message);
    res.json({ success: result.success, data: result });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP MESSAGING (enhanced — uses existing whatsappService)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/whatsapp/send', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { phone, message, template } = req.body;
    if (!phone || !message)
        throw new error_middleware_1.AppError('phone and message required', 400);
    try {
        const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
        const config = await whatsappService.getConfig(cid);
        if (!config) {
            res.json({ success: false, error: 'WhatsApp not configured' });
            return;
        }
        const result = await whatsappService.sendMessage(config, phone, message);
        // Log message
        await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/messageLog`).doc((0, helpers_1.generateId)()).set({
            channel: 'whatsapp', phone, message, success: true,
            sentBy: req.user.uid, sentAt: new Date(),
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.json({ success: false, error: String(err) });
    }
}));
// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/scheduled', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/scheduledMessages`).orderBy('scheduledAt', 'asc').limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.post('/scheduled', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const scheduled = {
        id, channel: body['channel'] ?? 'email', // email | telegram | whatsapp | slack | in_app
        recipient: body['recipient'] ?? '', // email, phone, chatId, channel name
        subject: body['subject'] ?? '', message: body['message'] ?? '',
        scheduledAt: body['scheduledAt'] ? new Date(body['scheduledAt']) : new Date(),
        status: 'pending', // pending | sent | failed | cancelled
        createdBy: req.user.uid, createdAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/scheduledMessages`).doc(id).set(scheduled);
    res.status(201).json({ success: true, data: scheduled });
}));
router.delete('/scheduled/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/scheduledMessages`).doc(req.params.id).update({ status: 'cancelled' });
    res.json({ success: true });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS (bulk messaging)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/campaigns', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/messagingCampaigns`).orderBy('createdAt', 'desc').limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.post('/campaigns', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const campaign = {
        id, name: body['name'] ?? '', subject: body['subject'] ?? '',
        content: body['content'] ?? '', channel: body['channel'] ?? 'email',
        groupId: body['groupId'] ?? null, // contact group
        targetCount: 0, sentCount: 0, openedCount: 0, clickedCount: 0,
        status: 'draft', // draft | sending | sent | failed
        createdBy: req.user.uid, createdAt: new Date(), sentAt: null,
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/messagingCampaigns`).doc(id).set(campaign);
    res.status(201).json({ success: true, data: campaign });
}));
router.post('/campaigns/:id/send', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${cid}/messagingCampaigns`).doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Campaign not found', 404);
    const campaign = doc.data();
    // Get recipients from group
    let recipients = [];
    if (campaign['groupId']) {
        const groupDoc = await db.collection(`companies/${cid}/contactGroups`).doc(campaign['groupId']).get();
        const memberIds = groupDoc.data()?.['members'] ?? [];
        for (const uid of memberIds) {
            const uDoc = await db.collection('users').doc(uid).get();
            if (uDoc.exists)
                recipients.push({ email: uDoc.data()?.['email'], phone: uDoc.data()?.['phone'], name: uDoc.data()?.['displayName'] });
        }
    }
    else {
        // All company users
        const usersSnap = await db.collection('users').where('companyId', '==', cid).limit(200).get();
        recipients = usersSnap.docs.map(d => ({ email: d.data()['email'], phone: d.data()['phone'], name: d.data()['displayName'] }));
    }
    let sentCount = 0;
    const channel = campaign['channel'];
    for (const r of recipients) {
        try {
            if (channel === 'email' && r.email) {
                const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../services/email/emailService')));
                await sendEmail({ to: r.email, subject: campaign['subject'], html: campaign['content'] });
                sentCount++;
            }
            else if (channel === 'telegram') {
                // Send to company channel
                await (0, telegramService_1.sendTelegramChannelMessage)(cid, `${campaign['subject'] ? `*${campaign['subject']}*\n\n` : ''}${campaign['content']}`);
                sentCount++;
                break; // Channel message = 1 send
            }
            else if (channel === 'whatsapp' && r.phone) {
                const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
                const config = await whatsappService.getConfig(cid);
                if (config) {
                    await whatsappService.sendMessage(config, r.phone, campaign['content']);
                    sentCount++;
                }
            }
            else if (channel === 'in_app') {
                (0, notificationService_1.createNotification)({ companyId: cid, type: 'system', title: campaign['subject'] ?? 'Campagne', message: (campaign['content'] ?? '').slice(0, 200), icon: 'Mail', severity: 'info' }).catch(() => { });
                sentCount++;
            }
        }
        catch { }
    }
    await db.collection(`companies/${cid}/messagingCampaigns`).doc(req.params.id).update({
        status: 'sent', sentCount, targetCount: recipients.length, sentAt: new Date(),
    });
    res.json({ success: true, data: { sentCount, targetCount: recipients.length } });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE LOG (unified history across all channels)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/log', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    let q = (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/messageLog`);
    if (req.query['channel'])
        q = q.where('channel', '==', req.query['channel']);
    const snap = await q.orderBy('sentAt', 'desc').limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const [annSnap, groupSnap, campSnap, logSnap, schedSnap] = await Promise.all([
        db.collection(`companies/${cid}/announcements`).limit(200).get(),
        db.collection(`companies/${cid}/contactGroups`).limit(50).get(),
        db.collection(`companies/${cid}/messagingCampaigns`).limit(100).get(),
        db.collection(`companies/${cid}/messageLog`).limit(500).get(),
        db.collection(`companies/${cid}/scheduledMessages`).where('status', '==', 'pending').limit(50).get(),
    ]);
    const logs = logSnap.docs.map(d => d.data());
    res.json({ success: true, data: {
            announcements: annSnap.size, contactGroups: groupSnap.size,
            campaigns: campSnap.size, campaignsSent: campSnap.docs.filter(d => d.data()['status'] === 'sent').length,
            totalMessages: logs.length, scheduledPending: schedSnap.size,
            byChannel: {
                email: logs.filter(l => l['channel'] === 'email').length,
                telegram: logs.filter(l => l['channel'] === 'telegram').length,
                whatsapp: logs.filter(l => l['channel'] === 'whatsapp').length,
                slack: logs.filter(l => l['channel'] === 'slack').length,
                in_app: logs.filter(l => l['channel'] === 'in_app').length,
            },
        } });
}));
exports.default = router;
//# sourceMappingURL=messaging.routes.js.map