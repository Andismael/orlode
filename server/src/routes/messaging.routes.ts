/**
 * Messaging Routes PRO — Announcements · Contact Groups · Telegram · WhatsApp · Campaigns · Scheduling
 * Unified multi-channel messaging hub
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';
import { createNotification } from '../services/notificationService';
import { sendTelegramMessage, sendTelegramChannelMessage } from '../services/telegram/telegramService';

const router = Router();
router.use(authMiddleware);

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS (internal broadcast)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/announcements', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/announcements`).orderBy('createdAt', 'desc').limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/announcements', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const announcement = {
    id, title: body['title'] ?? '', content: body['content'] ?? '',
    priority: body['priority'] ?? 'normal', // normal | important | urgent
    targetAudience: body['targetAudience'] ?? 'all', // all | department | role
    targetValue: body['targetValue'] ?? null, // dept name or role
    pinned: body['pinned'] ?? false,
    channels: body['channels'] ?? ['in_app'], // in_app | email | telegram | whatsapp | slack
    author: req.user!.uid, authorEmail: req.user!.email,
    readBy: [], readCount: 0,
    createdAt: new Date(), expiresAt: body['expiresAt'] ? new Date(body['expiresAt'] as string) : null,
  };
  const db = getFirestore();
  await db.collection(`companies/${cid}/announcements`).doc(id).set(announcement);

  // Dispatch to channels
  const channels = (body['channels'] as string[]) ?? ['in_app'];

  // In-app notification to all employees
  if (channels.includes('in_app')) {
    const usersSnap = await db.collection('users').where('companyId', '==', cid).limit(200).get();
    const targets = announcement.targetAudience === 'all' ? usersSnap.docs
      : announcement.targetAudience === 'department' ? usersSnap.docs.filter(d => d.data()['department'] === announcement.targetValue)
      : usersSnap.docs.filter(d => d.data()['role'] === announcement.targetValue);
    for (const u of targets) {
      createNotification({ companyId: cid, userId: u.id, type: 'system', title: `${announcement.priority === 'urgent' ? '🚨 ' : ''}${announcement.title}`, message: (announcement.content as string).slice(0, 200), actionUrl: '/comms/announcements', icon: 'Megaphone', severity: announcement.priority === 'urgent' ? 'error' : announcement.priority === 'important' ? 'warning' : 'info' }).catch(() => {});
    }
  }

  // Telegram channel
  if (channels.includes('telegram')) {
    const prefix = announcement.priority === 'urgent' ? '🚨 URGENT' : announcement.priority === 'important' ? '⚠️ Important' : '📢 Annonce';
    sendTelegramChannelMessage(cid, `*${prefix}*\n\n*${announcement.title}*\n\n${announcement.content}`).catch(() => {});
  }

  // WhatsApp (via existing service if configured)
  if (channels.includes('whatsapp')) {
    try {
      const { whatsappService } = await import('../services/whatsapp/whatsappService');
      // Send to configured broadcast list (if any)
    } catch {}
  }

  res.status(201).json({ success: true, data: announcement });
}));

router.patch('/announcements/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/announcements`).doc(req.params.id).update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  res.json({ success: true });
}));

router.delete('/announcements/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/announcements`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// Mark announcement as read
router.post('/announcements/:id/read', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { FieldValue } = await import('firebase-admin/firestore');
  await getFirestore().collection(`companies/${cid}/announcements`).doc(req.params.id).update({
    readBy: FieldValue.arrayUnion(req.user!.uid), readCount: FieldValue.increment(1),
  });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT GROUPS (distribution lists)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/groups', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/contactGroups`).limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/groups', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const group = {
    id, name: body['name'] ?? '', description: body['description'] ?? '',
    type: body['type'] ?? 'manual', // manual | department | role | auto
    members: Array.isArray(body['members']) ? body['members'] : [],
    memberCount: Array.isArray(body['members']) ? (body['members'] as string[]).length : 0,
    autoFilter: body['autoFilter'] ?? null, // { field: 'department', value: 'IT' }
    createdBy: req.user!.uid, createdAt: new Date(), updatedAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/contactGroups`).doc(id).set(group);
  res.status(201).json({ success: true, data: group });
}));

router.patch('/groups/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
  if (Array.isArray(body['members'])) updates['memberCount'] = (body['members'] as string[]).length;
  await getFirestore().collection(`companies/${cid}/contactGroups`).doc(req.params.id).update(updates);
  res.json({ success: true });
}));

router.delete('/groups/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/contactGroups`).doc(req.params.id).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM MESSAGING
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/telegram/send', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { chatId, message } = req.body as { chatId: string; message: string };
  if (!message) throw new AppError('message required', 400);
  const result = await sendTelegramMessage(cid, chatId ?? '', message);

  // Log message
  const db = getFirestore();
  await db.collection(`companies/${cid}/messageLog`).doc(generateId()).set({
    channel: 'telegram', chatId: chatId ?? 'default', message, success: result.success,
    messageId: result.messageId ?? null, error: result.error ?? null,
    sentBy: req.user!.uid, sentAt: new Date(),
  });

  res.json({ success: result.success, data: result });
}));

router.post('/telegram/channel', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { message } = req.body as { message: string };
  if (!message) throw new AppError('message required', 400);
  const result = await sendTelegramChannelMessage(cid, message);
  res.json({ success: result.success, data: result });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP MESSAGING (enhanced — uses existing whatsappService)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/whatsapp/send', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { phone, message, template } = req.body as { phone: string; message: string; template?: string };
  if (!phone || !message) throw new AppError('phone and message required', 400);

  try {
    const { whatsappService } = await import('../services/whatsapp/whatsappService');
    const config = await whatsappService.getConfig(cid);
    if (!config) { res.json({ success: false, error: 'WhatsApp not configured' }); return; }
    const result = await whatsappService.sendMessage(config, phone, message);

    // Log message
    await getFirestore().collection(`companies/${cid}/messageLog`).doc(generateId()).set({
      channel: 'whatsapp', phone, message, success: true,
      sentBy: req.user!.uid, sentAt: new Date(),
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/scheduled', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/scheduledMessages`).orderBy('scheduledAt', 'asc').limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/scheduled', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const scheduled = {
    id, channel: body['channel'] ?? 'email', // email | telegram | whatsapp | slack | in_app
    recipient: body['recipient'] ?? '', // email, phone, chatId, channel name
    subject: body['subject'] ?? '', message: body['message'] ?? '',
    scheduledAt: body['scheduledAt'] ? new Date(body['scheduledAt'] as string) : new Date(),
    status: 'pending', // pending | sent | failed | cancelled
    createdBy: req.user!.uid, createdAt: new Date(),
  };
  await getFirestore().collection(`companies/${cid}/scheduledMessages`).doc(id).set(scheduled);
  res.status(201).json({ success: true, data: scheduled });
}));

router.delete('/scheduled/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${cid}/scheduledMessages`).doc(req.params.id).update({ status: 'cancelled' });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS (bulk messaging)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/campaigns', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/messagingCampaigns`).orderBy('createdAt', 'desc').limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/campaigns', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const campaign = {
    id, name: body['name'] ?? '', subject: body['subject'] ?? '',
    content: body['content'] ?? '', channel: body['channel'] ?? 'email',
    groupId: body['groupId'] ?? null, // contact group
    targetCount: 0, sentCount: 0, openedCount: 0, clickedCount: 0,
    status: 'draft', // draft | sending | sent | failed
    createdBy: req.user!.uid, createdAt: new Date(), sentAt: null,
  };
  await getFirestore().collection(`companies/${cid}/messagingCampaigns`).doc(id).set(campaign);
  res.status(201).json({ success: true, data: campaign });
}));

router.post('/campaigns/:id/send', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${cid}/messagingCampaigns`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Campaign not found', 404);
  const campaign = doc.data()!;

  // Get recipients from group
  let recipients: { email?: string; phone?: string; name?: string }[] = [];
  if (campaign['groupId']) {
    const groupDoc = await db.collection(`companies/${cid}/contactGroups`).doc(campaign['groupId'] as string).get();
    const memberIds = (groupDoc.data()?.['members'] as string[]) ?? [];
    for (const uid of memberIds) {
      const uDoc = await db.collection('users').doc(uid).get();
      if (uDoc.exists) recipients.push({ email: uDoc.data()?.['email'] as string, phone: uDoc.data()?.['phone'] as string, name: uDoc.data()?.['displayName'] as string });
    }
  } else {
    // All company users
    const usersSnap = await db.collection('users').where('companyId', '==', cid).limit(200).get();
    recipients = usersSnap.docs.map(d => ({ email: d.data()['email'] as string, phone: d.data()['phone'] as string, name: d.data()['displayName'] as string }));
  }

  let sentCount = 0;
  const channel = campaign['channel'] as string;

  for (const r of recipients) {
    try {
      if (channel === 'email' && r.email) {
        const { sendEmail } = await import('../services/email/emailService');
        await sendEmail({ to: r.email, subject: campaign['subject'] as string, html: campaign['content'] as string });
        sentCount++;
      } else if (channel === 'telegram') {
        // Send to company channel
        await sendTelegramChannelMessage(cid, `${campaign['subject'] ? `*${campaign['subject']}*\n\n` : ''}${campaign['content']}`);
        sentCount++; break; // Channel message = 1 send
      } else if (channel === 'whatsapp' && r.phone) {
        const { whatsappService } = await import('../services/whatsapp/whatsappService');
        const config = await whatsappService.getConfig(cid);
        if (config) { await whatsappService.sendMessage(config, r.phone, campaign['content'] as string); sentCount++; }
      } else if (channel === 'in_app') {
        createNotification({ companyId: cid, type: 'system', title: (campaign['subject'] as string) ?? 'Campagne', message: ((campaign['content'] as string) ?? '').slice(0, 200), icon: 'Mail', severity: 'info' }).catch(() => {});
        sentCount++;
      }
    } catch {}
  }

  await db.collection(`companies/${cid}/messagingCampaigns`).doc(req.params.id).update({
    status: 'sent', sentCount, targetCount: recipients.length, sentAt: new Date(),
  });

  res.json({ success: true, data: { sentCount, targetCount: recipients.length } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE LOG (unified history across all channels)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/log', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  let q = getFirestore().collection(`companies/${cid}/messageLog`) as FirebaseFirestore.Query;
  if (req.query['channel']) q = q.where('channel', '==', req.query['channel']);
  const snap = await q.orderBy('sentAt', 'desc').limit(100).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const db = getFirestore();
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
  }});
}));

export default router;
