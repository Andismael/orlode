"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportUserData = exportUserData;
exports.deleteUserData = deleteUserData;
exports.getAuditLogs = getAuditLogs;
exports.getPrivacyReport = getPrivacyReport;
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
// ── GET /api/gdpr/export — export all personal data for the requesting user ──
async function exportUserData(req, res) {
    const userId = req.user?.uid;
    if (!userId)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const companyId = req.user?.companyId;
    logger_1.logger.info(`[GDPR] Data export requested by user ${userId}`);
    // Collect all data belonging to this user
    const [userDoc, conversationsSnap, messagesData, meetingsSnap, facesSnap, auditSnap] = await Promise.allSettled([
        db.collection('users').doc(userId).get(),
        db.collection('conversations').where('userId', '==', userId).limit(100).get(),
        Promise.resolve([]),
        companyId ? db.collection(`companies/${companyId}/meetings`).limit(100).get() : Promise.resolve(null),
        companyId ? db.collection(`companies/${companyId}/faces`).where('userId', '==', userId).limit(50).get() : Promise.resolve(null),
        db.collection('auditLogs').where('userId', '==', userId).limit(200).get(),
    ]);
    // Build export object
    const exportData = {
        exportedAt: new Date().toISOString(),
        exportedFor: req.user?.email,
        dataSubject: {
            userId,
            companyId,
        },
    };
    // User profile
    if (userDoc.status === 'fulfilled' && userDoc.value.exists) {
        const d = userDoc.value.data();
        exportData['profile'] = {
            email: d['email'],
            firstName: d['firstName'],
            lastName: d['lastName'],
            role: d['role'],
            createdAt: d['createdAt']?.toDate?.()?.toISOString(),
        };
    }
    // Conversations
    if (conversationsSnap.status === 'fulfilled') {
        exportData['conversations'] = await Promise.all(conversationsSnap.value.docs.map(async (doc) => {
            const data = doc.data();
            // Fetch messages for each conversation
            const msgSnap = await db.collection(`conversations/${doc.id}/messages`)
                .orderBy('createdAt').limit(200).get().catch(() => null);
            return {
                id: doc.id,
                title: data['title'],
                createdAt: data['createdAt']?.toDate?.()?.toISOString(),
                messages: msgSnap?.docs.map((m) => ({
                    role: m.data()['role'],
                    content: m.data()['content'],
                    createdAt: m.data()['createdAt']?.toDate?.()?.toISOString(),
                })) ?? [],
            };
        }));
    }
    // Meetings (only ones they participated in)
    if (meetingsSnap.status === 'fulfilled' && meetingsSnap.value) {
        exportData['meetings'] = meetingsSnap.value.docs
            .filter((doc) => {
            const attendees = doc.data()['attendees'] ?? [];
            return attendees.includes(req.user?.email ?? '') || doc.data()['createdBy'] === userId;
        })
            .map((doc) => {
            const d = doc.data();
            return {
                id: doc.id,
                title: d['title'],
                summary: d['summary'],
                createdAt: d['createdAt']?.toDate?.()?.toISOString(),
            };
        });
    }
    // Face data (biometric — high sensitivity)
    if (facesSnap.status === 'fulfilled' && facesSnap.value) {
        exportData['faceData'] = facesSnap.value.docs.map((doc) => ({
            id: doc.id,
            registeredAt: doc.data()['createdAt']?.toDate?.()?.toISOString(),
            note: 'Biometric face embedding stored for recognition purposes',
        }));
    }
    // Audit trail
    if (auditSnap.status === 'fulfilled') {
        exportData['auditLog'] = auditSnap.value.docs.map((doc) => {
            const d = doc.data();
            return {
                action: d['action'],
                resource: d['resource'],
                timestamp: d['timestamp']?.toDate?.()?.toISOString(),
                ipAddress: d['ipAddress'],
            };
        });
    }
    res.setHeader('Content-Disposition', `attachment; filename="corpmind-data-export-${userId.slice(0, 8)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, data: exportData });
}
// ── DELETE /api/gdpr/delete — right to erasure ───────────────────────────────
async function deleteUserData(req, res) {
    const userId = req.user?.uid;
    if (!userId)
        throw new error_middleware_1.AppError('Not authenticated', 401);
    const { confirmEmail } = req.body;
    if (confirmEmail !== req.user?.email) {
        throw new error_middleware_1.AppError('Please confirm your email address to proceed with deletion', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    const companyId = req.user?.companyId;
    logger_1.logger.warn(`[GDPR] Data erasure requested by user ${userId} (${req.user?.email})`);
    // Batch deletes
    const batch = db.batch();
    // 1. Delete user conversations
    const convSnap = await db.collection('conversations').where('userId', '==', userId).limit(100).get();
    convSnap.docs.forEach((doc) => batch.delete(doc.ref));
    // 2. Delete face data
    if (companyId) {
        const faceSnap = await db.collection(`companies/${companyId}/faces`).where('userId', '==', userId).limit(50).get();
        faceSnap.docs.forEach((doc) => batch.delete(doc.ref));
    }
    // 3. Anonymize user profile (don't fully delete — keep for company records)
    const userRef = db.collection('users').doc(userId);
    batch.update(userRef, {
        email: `deleted-${userId.slice(0, 8)}@anonymized.gdpr`,
        firstName: '[Deleted]',
        lastName: '[Deleted]',
        deletedAt: new Date(),
        gdprDeleted: true,
    });
    await batch.commit();
    // 4. Revoke Firebase Auth account
    try {
        await (0, firebase_config_1.getAuth)().revokeRefreshTokens(userId);
        await (0, firebase_config_1.getAuth)().updateUser(userId, { disabled: true });
    }
    catch (err) {
        logger_1.logger.warn(`[GDPR] Could not disable Firebase Auth user ${userId}`, { error: err });
    }
    logger_1.logger.info(`[GDPR] Data erasure complete for user ${userId}`);
    res.json({
        success: true,
        message: 'Your data has been deleted. Your account has been anonymized and disabled.',
        deletedAt: new Date().toISOString(),
    });
}
// ── GET /api/gdpr/audit-logs — admin access to company audit trail ─────────
async function getAuditLogs(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { limit = '50', userId: filterUserId, action: filterAction } = req.query;
    const db = (0, firebase_config_1.getFirestore)();
    let query = db.collection('auditLogs')
        .where('companyId', '==', companyId);
    if (filterUserId)
        query = query.where('userId', '==', filterUserId);
    if (filterAction)
        query = query.where('action', '==', filterAction);
    const snap = await query.limit(Math.min(parseInt(limit), 200)).get();
    const logs = snap.docs
        .map((doc) => {
        const d = doc.data();
        return {
            id: doc.id,
            userId: d['userId'],
            userEmail: d['userEmail'],
            action: d['action'],
            resource: d['resource'],
            resourceId: d['resourceId'],
            method: d['method'],
            path: d['path'],
            ipAddress: d['ipAddress'],
            status: d['status'],
            timestamp: d['timestamp']?.toDate?.()?.toISOString(),
        };
    })
        .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());
    res.json({ success: true, data: logs, total: logs.length });
}
// ── GET /api/gdpr/privacy-report — RGPD compliance summary for admins ───────
async function getPrivacyReport(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const [usersSnap, docsSnap, facesSnap] = await Promise.all([
        db.collection('users').where('companyId', '==', companyId).get(),
        db.collection(`companies/${companyId}/documents`).get().catch(() => ({ size: 0 })),
        db.collection(`companies/${companyId}/faces`).get().catch(() => ({ size: 0 })),
    ]);
    const users = usersSnap.docs.map((d) => d.data());
    const gdprDeletedCount = users.filter((u) => u['gdprDeleted'] === true).length;
    res.json({
        success: true,
        data: {
            generatedAt: new Date().toISOString(),
            dataController: companyId,
            dataSubjects: users.length,
            gdprDeletedUsers: gdprDeletedCount,
            documentsStored: docsSnap.size,
            biometricProfiles: facesSnap.size,
            dataResidency: 'Firebase (Google Cloud — EU/US depending on region)',
            encryptionAtRest: true, // Firebase encrypts all data at rest by default
            encryptionInTransit: true, // All Firebase traffic is TLS
            retentionPolicy: 'Data retained while account is active. Deleted on GDPR erasure request.',
            dataCategories: [
                { category: 'Identity data', items: ['name', 'email', 'role'], legalBasis: 'Contract' },
                { category: 'Usage data', items: ['conversations', 'queries', 'audit logs'], legalBasis: 'Legitimate interest' },
                { category: 'Documents', items: ['uploaded files', 'embeddings'], legalBasis: 'Contract' },
                { category: 'Biometric', items: ['face embeddings'], legalBasis: 'Consent', sensitivity: 'HIGH' },
            ],
            userRights: [
                'Right of Access (GET /api/gdpr/export)',
                'Right to Erasure (DELETE /api/gdpr/delete)',
                'Right to Portability (JSON export)',
                'Right to Rectification (contact admin)',
            ],
        },
    });
}
//# sourceMappingURL=gdpr.controller.js.map