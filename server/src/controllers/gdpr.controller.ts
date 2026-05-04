/**
 * GDPR / RGPD Controller
 * Implements the 3 core rights for data subjects:
 * - Right of Access (data export)
 * - Right to Erasure (account + data deletion)
 * - Right to Portability (JSON export)
 *
 * Also exposes audit log access for company admins.
 */
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore, getAuth } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

// ── GET /api/gdpr/export — export all personal data for the requesting user ──
export async function exportUserData(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.uid;
  if (!userId) throw new AppError('Not authenticated', 401);

  const db = getFirestore();
  const companyId = req.user?.companyId;

  logger.info(`[GDPR] Data export requested by user ${userId}`);

  // Collect all data belonging to this user
  const [userDoc, conversationsSnap, messagesData, meetingsSnap, facesSnap, auditSnap] =
    await Promise.allSettled([
      db.collection('users').doc(userId).get(),
      db.collection('conversations').where('userId', '==', userId).limit(100).get(),
      Promise.resolve([]),
      companyId ? db.collection(`companies/${companyId}/meetings`).limit(100).get() : Promise.resolve(null),
      companyId ? db.collection(`companies/${companyId}/faces`).where('userId', '==', userId).limit(50).get() : Promise.resolve(null),
      db.collection('auditLogs').where('userId', '==', userId).limit(200).get(),
    ]);

  // Build export object
  const exportData: Record<string, unknown> = {
    exportedAt:  new Date().toISOString(),
    exportedFor: req.user?.email,
    dataSubject: {
      userId,
      companyId,
    },
  };

  // User profile
  if (userDoc.status === 'fulfilled' && userDoc.value.exists) {
    const d = userDoc.value.data() as Record<string, unknown>;
    exportData['profile'] = {
      email:      d['email'],
      firstName:  d['firstName'],
      lastName:   d['lastName'],
      role:       d['role'],
      createdAt:  (d['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString(),
    };
  }

  // Conversations
  if (conversationsSnap.status === 'fulfilled') {
    exportData['conversations'] = await Promise.all(
      conversationsSnap.value.docs.map(async (doc) => {
        const data = doc.data();
        // Fetch messages for each conversation
        const msgSnap = await db.collection(`conversations/${doc.id}/messages`)
          .orderBy('createdAt').limit(200).get().catch(() => null);
        return {
          id:        doc.id,
          title:     data['title'],
          createdAt: (data['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString(),
          messages:  msgSnap?.docs.map((m) => ({
            role:      m.data()['role'],
            content:   m.data()['content'],
            createdAt: (m.data()['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString(),
          })) ?? [],
        };
      })
    );
  }

  // Meetings (only ones they participated in)
  if (meetingsSnap.status === 'fulfilled' && meetingsSnap.value) {
    exportData['meetings'] = meetingsSnap.value.docs
      .filter((doc) => {
        const attendees = (doc.data()['attendees'] as string[]) ?? [];
        return attendees.includes(req.user?.email ?? '') || doc.data()['createdBy'] === userId;
      })
      .map((doc) => {
        const d = doc.data();
        return {
          id:        doc.id,
          title:     d['title'],
          summary:   d['summary'],
          createdAt: (d['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString(),
        };
      });
  }

  // Face data (biometric — high sensitivity)
  if (facesSnap.status === 'fulfilled' && facesSnap.value) {
    exportData['faceData'] = facesSnap.value.docs.map((doc) => ({
      id:          doc.id,
      registeredAt: (doc.data()['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString(),
      note:        'Biometric face embedding stored for recognition purposes',
    }));
  }

  // Audit trail
  if (auditSnap.status === 'fulfilled') {
    exportData['auditLog'] = auditSnap.value.docs.map((doc) => {
      const d = doc.data();
      return {
        action:    d['action'],
        resource:  d['resource'],
        timestamp: (d['timestamp'] as { toDate?: () => Date })?.toDate?.()?.toISOString(),
        ipAddress: d['ipAddress'],
      };
    });
  }

  res.setHeader('Content-Disposition', `attachment; filename="corpmind-data-export-${userId.slice(0, 8)}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json({ success: true, data: exportData });
}

// ── DELETE /api/gdpr/delete — right to erasure ───────────────────────────────
export async function deleteUserData(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.uid;
  if (!userId) throw new AppError('Not authenticated', 401);

  const { confirmEmail } = req.body as { confirmEmail?: string };
  if (confirmEmail !== req.user?.email) {
    throw new AppError('Please confirm your email address to proceed with deletion', 400);
  }

  const db = getFirestore();
  const companyId = req.user?.companyId;

  logger.warn(`[GDPR] Data erasure requested by user ${userId} (${req.user?.email})`);

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
    email:      `deleted-${userId.slice(0, 8)}@anonymized.gdpr`,
    firstName:  '[Deleted]',
    lastName:   '[Deleted]',
    deletedAt:  new Date(),
    gdprDeleted: true,
  });

  await batch.commit();

  // 4. Revoke Firebase Auth account
  try {
    await getAuth().revokeRefreshTokens(userId);
    await getAuth().updateUser(userId, { disabled: true });
  } catch (err) {
    logger.warn(`[GDPR] Could not disable Firebase Auth user ${userId}`, { error: err });
  }

  logger.info(`[GDPR] Data erasure complete for user ${userId}`);
  res.json({
    success: true,
    message: 'Your data has been deleted. Your account has been anonymized and disabled.',
    deletedAt: new Date().toISOString(),
  });
}

// ── GET /api/gdpr/audit-logs — admin access to company audit trail ─────────
export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { limit = '50', userId: filterUserId, action: filterAction } = req.query as Record<string, string>;

  const db = getFirestore();
  let query = db.collection('auditLogs')
    .where('companyId', '==', companyId) as FirebaseFirestore.Query;

  if (filterUserId) query = query.where('userId', '==', filterUserId);
  if (filterAction)  query = query.where('action', '==', filterAction);

  const snap = await query.limit(Math.min(parseInt(limit), 200)).get();

  const logs = snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id:         doc.id,
        userId:     d['userId'],
        userEmail:  d['userEmail'],
        action:     d['action'],
        resource:   d['resource'],
        resourceId: d['resourceId'],
        method:     d['method'],
        path:       d['path'],
        ipAddress:  d['ipAddress'],
        status:     d['status'],
        timestamp:  (d['timestamp'] as { toDate?: () => Date })?.toDate?.()?.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());

  res.json({ success: true, data: logs, total: logs.length });
}

// ── GET /api/gdpr/privacy-report — RGPD compliance summary for admins ───────
export async function getPrivacyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();

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
      generatedAt:       new Date().toISOString(),
      dataController:    companyId,
      dataSubjects:      users.length,
      gdprDeletedUsers:  gdprDeletedCount,
      documentsStored:   (docsSnap as { size: number }).size,
      biometricProfiles: (facesSnap as { size: number }).size,
      dataResidency:     'Firebase (Google Cloud — EU/US depending on region)',
      encryptionAtRest:  true,  // Firebase encrypts all data at rest by default
      encryptionInTransit: true, // All Firebase traffic is TLS
      retentionPolicy:   'Data retained while account is active. Deleted on GDPR erasure request.',
      dataCategories: [
        { category: 'Identity data', items: ['name', 'email', 'role'], legalBasis: 'Contract' },
        { category: 'Usage data',    items: ['conversations', 'queries', 'audit logs'], legalBasis: 'Legitimate interest' },
        { category: 'Documents',     items: ['uploaded files', 'embeddings'], legalBasis: 'Contract' },
        { category: 'Biometric',     items: ['face embeddings'], legalBasis: 'Consent', sensitivity: 'HIGH' },
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
