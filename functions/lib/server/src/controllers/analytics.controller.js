"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOverview = getOverview;
exports.getCharts = getCharts;
exports.getActivity = getActivity;
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const firestore_1 = require("firebase-admin/firestore");
function toDate(val) {
    if (val instanceof firestore_1.Timestamp)
        return val.toDate();
    if (val instanceof Date)
        return val;
    if (typeof val === 'string' || typeof val === 'number')
        return new Date(val);
    return new Date();
}
function formatDay(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// ── GET /api/analytics/overview ──────────────────────────────────────────────
async function getOverview(req, res) {
    const companyId = req.query['companyId'] ?? req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const [documentsSnap, conversationsSnap, meetingsSnap] = await Promise.all([
        db.collection('documents').where('companyId', '==', companyId).get(),
        db.collection('conversations').where('companyId', '==', companyId).get(),
        db.collection('meetings').where('companyId', '==', companyId).get(),
    ]);
    const documents = documentsSnap.docs.map((d) => d.data());
    const conversations = conversationsSnap.docs.map((d) => d.data());
    const meetings = meetingsSnap.docs.map((d) => d.data());
    const totalStorageBytes = documents.reduce((s, d) => s + (d['fileSize'] ?? 0), 0);
    const storageGB = (totalStorageBytes / (1024 ** 3)).toFixed(2);
    res.json({
        success: true,
        data: {
            documents: {
                total: documents.length,
                completed: documents.filter((d) => d['status'] === 'completed').length,
                processing: documents.filter((d) => d['status'] === 'processing').length,
                totalChunks: documents.reduce((s, d) => s + (d['chunksCreated'] ?? 0), 0),
                totalStorageBytes,
                storageGB,
            },
            conversations: {
                total: conversations.length,
                totalMessages: conversations.reduce((s, c) => s + (c['messageCount'] ?? 0), 0),
            },
            meetings: {
                total: meetings.length,
                transcribed: meetings.filter((m) => m['hasTranscript']).length,
                totalMinutes: meetings.reduce((s, m) => s + (m['duration'] ?? 0), 0),
            },
            companyId,
        },
    });
}
// ── GET /api/analytics/charts ─────────────────────────────────────────────────
async function getCharts(req, res) {
    const companyId = req.query['companyId'] ?? req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const days = parseInt(req.query['days'] ?? '30', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const db = (0, firebase_config_1.getFirestore)();
    const [conversationsSnap, documentsSnap] = await Promise.all([
        db.collection('conversations').where('companyId', '==', companyId).get(),
        db.collection('documents').where('companyId', '==', companyId).get(),
    ]);
    // ── Chat activity by day ──────────────────────────────────────────────────
    const dayMap = new Map();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dayMap.set(formatDay(d), { conversations: 0, messages: 0 });
    }
    conversationsSnap.docs.forEach((doc) => {
        const data = doc.data();
        const createdAt = toDate(data['createdAt']);
        if (createdAt >= since) {
            const key = formatDay(createdAt);
            const prev = dayMap.get(key) ?? { conversations: 0, messages: 0 };
            dayMap.set(key, {
                conversations: prev.conversations + 1,
                messages: prev.messages + (data['messageCount'] ?? 0),
            });
        }
    });
    const chatActivity = Array.from(dayMap.entries())
        .map(([date, v]) => ({ date, ...v }))
        .slice(-14);
    // ── Document types ────────────────────────────────────────────────────────
    const TYPE_COLORS = {
        pdf: '#0092FF', docx: '#FF009D', xlsx: '#00A550',
        csv: '#FFA200', txt: '#0049FF', pptx: '#FF4B4B', other: '#9ca3af',
    };
    const typeCount = new Map();
    documentsSnap.docs.forEach((doc) => {
        const raw = (doc.data()['fileType'] ?? 'other').toLowerCase().replace('.', '');
        const key = TYPE_COLORS[raw] ? raw : 'other';
        typeCount.set(key, (typeCount.get(key) ?? 0) + 1);
    });
    const docTypes = Array.from(typeCount.entries())
        .map(([name, value]) => ({ name: name.toUpperCase(), value, color: TYPE_COLORS[name] ?? '#9ca3af' }))
        .sort((a, b) => b.value - a.value);
    // ── Query topics from conversation titles ─────────────────────────────────
    const TOPIC_KEYWORDS = {
        Finance: ['finance', 'budget', 'revenue', 'cost', 'profit', 'invoice', 'q1', 'q2', 'q3', 'q4'],
        HR: ['hr', 'human resources', 'employee', 'salary', 'leave', 'hiring', 'policy'],
        Product: ['product', 'feature', 'roadmap', 'sprint', 'release', 'bug'],
        Sales: ['sales', 'deal', 'client', 'prospect', 'pipeline'],
        Operations: ['operation', 'process', 'logistics', 'supply', 'vendor'],
        Legal: ['legal', 'compliance', 'contract', 'gdpr', 'regulation'],
        Marketing: ['marketing', 'campaign', 'brand', 'social', 'seo'],
    };
    const topicCount = new Map();
    conversationsSnap.docs.forEach((doc) => {
        const title = (doc.data()['title'] ?? '').toLowerCase();
        let matched = false;
        for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
            if (keywords.some((kw) => title.includes(kw))) {
                topicCount.set(topic, (topicCount.get(topic) ?? 0) + 1);
                matched = true;
                break;
            }
        }
        if (!matched)
            topicCount.set('Other', (topicCount.get('Other') ?? 0) + 1);
    });
    const queryTopics = Array.from(topicCount.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    res.json({ success: true, data: { chatActivity, docTypes, queryTopics, period: `${days}d` } });
}
// ── GET /api/analytics/activity ───────────────────────────────────────────────
async function getActivity(req, res) {
    const companyId = req.query['companyId'] ?? req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const limit = parseInt(req.query['limit'] ?? '20', 10);
    const db = (0, firebase_config_1.getFirestore)();
    const empty = { docs: [] };
    const [docsSnap, convsSnap, meetingsSnap] = await Promise.all([
        db.collection('documents').where('companyId', '==', companyId)
            .limit(limit).get().catch(() => empty),
        db.collection('conversations').where('companyId', '==', companyId)
            .limit(limit).get().catch(() => empty),
        db.collection('meetings').where('companyId', '==', companyId)
            .limit(limit).get().catch(() => empty),
    ]);
    const activities = [];
    docsSnap.docs.forEach((doc) => {
        const d = doc.data();
        const isNew = d['status'] === 'processing' || d['status'] === 'pending';
        activities.push({
            id: `doc-${doc.id}`,
            type: isNew ? 'upload' : 'document',
            title: isNew ? 'Document uploaded' : 'Document indexed',
            description: `${d['originalName']} — ${d['chunksCreated'] ?? 0} chunks`,
            timestamp: toDate(d['uploadedAt']).toISOString(),
            user: d['uploadedBy'],
        });
    });
    convsSnap.docs.forEach((doc) => {
        const d = doc.data();
        activities.push({
            id: `conv-${doc.id}`,
            type: 'chat',
            title: 'New conversation',
            description: d['title'] ?? 'Chat session',
            timestamp: toDate(d['updatedAt']).toISOString(),
        });
    });
    meetingsSnap.docs.forEach((doc) => {
        const d = doc.data();
        activities.push({
            id: `meet-${doc.id}`,
            type: 'meeting',
            title: d['hasTranscript'] ? 'Meeting transcribed' : 'Meeting scheduled',
            description: d['title'] ?? 'Meeting',
            timestamp: toDate(d['updatedAt']).toISOString(),
        });
    });
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json({ success: true, data: activities.slice(0, limit) });
}
//# sourceMappingURL=analytics.controller.js.map