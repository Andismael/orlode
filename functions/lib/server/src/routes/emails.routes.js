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
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const emailService_1 = require("../services/email/emailService");
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
// ─── FOLDERS ─────────────────────────────────────────────────────────────────
// GET /api/emails/inbox
router.get('/inbox', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const snap = await (0, firebase_config_1.getFirestore)().collection('emails')
            .where('companyId', '==', companyId).where('folder', '==', 'inbox')
            .limit(50).get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// GET /api/emails/sent
router.get('/sent', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const snap = await (0, firebase_config_1.getFirestore)().collection('emails')
            .where('companyId', '==', companyId).where('folder', '==', 'sent')
            .limit(50).get();
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // eslint-disable-next-line no-console
        console.log('[emails/sent]', { companyId, count: data.length });
        res.json({ success: true, data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[emails/sent] ERROR', { companyId, err: String(err) });
        res.json({ success: true, data: [] });
    }
}));
// GET /api/emails/drafts
router.get('/drafts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const snap = await (0, firebase_config_1.getFirestore)().collection('emails')
            .where('companyId', '==', companyId).where('folder', '==', 'draft')
            .limit(50).get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// GET /api/emails/archived
router.get('/archived', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const snap = await (0, firebase_config_1.getFirestore)().collection('emails')
            .where('companyId', '==', companyId).where('folder', '==', 'archive')
            .limit(50).get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// ─── CRUD ────────────────────────────────────────────────────────────────────
// GET /api/emails/:id
router.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const doc = await (0, firebase_config_1.getFirestore)().collection('emails').doc(req.params.id).get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Email not found', 404);
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));
// PATCH /api/emails/:id/read
router.patch('/:id/read', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await (0, firebase_config_1.getFirestore)().collection('emails').doc(req.params.id).update({ read: true });
    res.json({ success: true });
}));
// PATCH /api/emails/:id/archive
router.patch('/:id/archive', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await (0, firebase_config_1.getFirestore)().collection('emails').doc(req.params.id).update({ folder: 'archive' });
    res.json({ success: true });
}));
// PATCH /api/emails/:id/star
router.patch('/:id/star', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const doc = await (0, firebase_config_1.getFirestore)().collection('emails').doc(req.params.id).get();
    const starred = doc.data()?.['starred'] ?? false;
    await (0, firebase_config_1.getFirestore)().collection('emails').doc(req.params.id).update({ starred: !starred });
    res.json({ success: true, data: { starred: !starred } });
}));
// DELETE /api/emails/:id
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await (0, firebase_config_1.getFirestore)().collection('emails').doc(req.params.id).delete();
    res.json({ success: true });
}));
// ─── COMPOSE & SEND ──────────────────────────────────────────────────────────
// POST /api/emails/compose — compose new email (send or save as draft)
router.post('/compose', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const to = body['to'];
    const subject = body['subject'];
    const content = body['body'];
    const cc = body['cc'];
    const isDraft = body['draft'] === true;
    if (!isDraft && (!to || !subject || !content)) {
        throw new error_middleware_1.AppError('to, subject, and body required', 400);
    }
    const id = (0, helpers_1.generateId)();
    if (isDraft) {
        // Save as draft
        await (0, firebase_config_1.getFirestore)().collection('emails').doc(id).set({
            companyId, folder: 'draft', to: to ?? '', cc: cc ?? '',
            subject: subject ?? '', body: content ?? '',
            createdAt: new Date(), updatedAt: new Date(),
            createdBy: req.user?.uid,
        });
        return res.status(201).json({ success: true, data: { id, folder: 'draft' } });
    }
    // Send via Resend
    const result = await (0, emailService_1.sendReplyEmail)({
        to, subject, bodyHtml: (content ?? '').replace(/\n/g, '<br>'), replyTo: cc,
    });
    // Archive in sent folder
    await (0, firebase_config_1.getFirestore)().collection('emails').doc(id).set({
        companyId, folder: 'sent', to, cc: cc ?? '', subject, body: content,
        sentAt: new Date().toISOString(), resendId: result.id,
        createdBy: req.user?.uid, aiGenerated: false,
    });
    res.status(201).json({ success: true, data: { id, resendId: result.id, folder: 'sent' } });
}));
// POST /api/emails/:id/reply — reply to existing email
router.post('/:id/reply', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { draft, to, subject, replyTo } = req.body;
    if (!draft || !to)
        throw new error_middleware_1.AppError('draft and to required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('emails').doc(req.params.id).get();
    const emailData = doc.exists ? doc.data() : null;
    const result = await (0, emailService_1.sendReplyEmail)({
        to, subject: subject ?? `Re: ${emailData?.['subject'] ?? ''}`,
        bodyHtml: draft.replace(/\n/g, '<br>'), replyTo,
    });
    await db.collection('emails').add({
        companyId: req.user?.companyId, folder: 'sent', to,
        subject: subject ?? `Re: ${emailData?.['subject'] ?? ''}`,
        body: draft, sentAt: new Date().toISOString(),
        resendId: result.id, aiGenerated: true, replyToId: req.params.id,
    });
    res.json({ success: true, resendId: result.id });
}));
// ─── AI GENERATE ─────────────────────────────────────────────────────────────
// POST /api/emails/generate — AI drafts an email
router.post('/generate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { prompt, to, tone } = req.body;
    if (!prompt)
        throw new error_middleware_1.AppError('Prompt required', 400);
    let generated = '';
    let generatedSubject = '';
    try {
        const { commsAgentFlow } = await Promise.resolve().then(() => __importStar(require('../agents/comms.agent')));
        const result = await commsAgentFlow({
            companyId, type: 'email', language: 'fr',
            context: `Redige un email ${tone ?? 'professionnel'} pour: ${prompt}. Retourne le sujet et le corps de l'email.`,
            tone: tone ?? 'professional',
            sendVia: 'none',
        });
        const text = result.body ?? '';
        generatedSubject = result.subject ?? prompt.slice(0, 60);
        generated = text;
    }
    catch {
        generated = `[Email sur: ${prompt}]\n\nBonjour,\n\n[Contenu a rediger]\n\nCordialement`;
        generatedSubject = prompt.slice(0, 60);
    }
    res.json({ success: true, data: { subject: generatedSubject, body: generated, to: to ?? '' } });
}));
// ─── TEMPLATES ───────────────────────────────────────────────────────────────
// GET /api/emails/templates
router.get('/templates/list', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection('emailTemplates')
            .where('companyId', '==', companyId).limit(50).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, []);
    res.json({ success: true, data });
}));
// POST /api/emails/templates
router.post('/templates', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const template = {
        companyId, name: body['name'] ?? '', subject: body['subject'] ?? '',
        body: body['body'] ?? '', category: body['category'] ?? 'general',
        createdBy: req.user?.uid, createdAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection('emailTemplates').doc(id).set(template);
    res.status(201).json({ success: true, data: { id, ...template } });
}));
// DELETE /api/emails/templates/:id
router.delete('/templates/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await (0, firebase_config_1.getFirestore)().collection('emailTemplates').doc(req.params.id).delete();
    res.json({ success: true });
}));
// ─── STATS ───────────────────────────────────────────────────────────────────
// GET /api/emails/stats
router.get('/stats/overview', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection('emails').where('companyId', '==', companyId).limit(500).get();
        const emails = snap.docs.map(d => d.data());
        return {
            inbox: emails.filter(e => e['folder'] === 'inbox').length,
            unread: emails.filter(e => e['folder'] === 'inbox' && !e['read']).length,
            sent: emails.filter(e => e['folder'] === 'sent').length,
            drafts: emails.filter(e => e['folder'] === 'draft').length,
            archived: emails.filter(e => e['folder'] === 'archive').length,
            aiGenerated: emails.filter(e => e['aiGenerated'] === true).length,
        };
    }, { inbox: 0, unread: 0, sent: 0, drafts: 0, archived: 0, aiGenerated: 0 });
    res.json({ success: true, data });
}));
exports.default = router;
//# sourceMappingURL=emails.routes.js.map