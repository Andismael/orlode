/**
 * Referral Routes — Creator affiliate system
 * Track referrals, credit creators, commission on plans + agents
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Request, Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

const router = Router();

// ── PUBLIC: Track referral click (no auth) ──────────────────────────────────

// GET /api/referral/track/:creatorId — log a referral click
router.get('/track/:creatorId', asyncHandler(async (req: Request, res: Response) => {
  const { creatorId } = req.params;
  const agentId = req.query['agent'] as string | undefined;
  const db = getFirestore();

  // Log click
  await db.collection('referralClicks').add({
    creatorId,
    agentId: agentId ?? null,
    ip: req.ip ?? '',
    userAgent: req.headers['user-agent'] ?? '',
    createdAt: FieldValue.serverTimestamp(),
  });

  // Increment creator click count
  await db.collection('creatorProfiles').doc(creatorId).update({
    totalClicks: FieldValue.increment(1),
  }).catch(() => {});

  logger.info('[Referral] Click tracked', { creatorId, agentId });

  // Return referral data (client stores in cookie/localStorage)
  res.json({ success: true, data: { creatorId, agentId: agentId ?? null, tracked: true } });
}));

// ── PUBLIC: Record conversion (called after registration) ───────────────────

// POST /api/referral/convert — credit creator for new signup
router.post('/convert', asyncHandler(async (req: Request, res: Response) => {
  const { creatorId, userId, agentId } = req.body as { creatorId: string; userId: string; agentId?: string };
  if (!creatorId || !userId) throw new AppError('creatorId and userId required', 400);

  const db = getFirestore();

  // Check not already converted
  const existing = await db.collection('referrals')
    .where('userId', '==', userId).limit(1).get();
  if (!existing.empty) {
    return res.json({ success: true, data: { alreadyConverted: true } });
  }

  // Create referral record
  await db.collection('referrals').add({
    creatorId,
    userId,
    agentId: agentId ?? null,
    status: 'active',
    planCommissionRate: 0.10, // 10% of plan revenue
    agentCommissionRate: 0.70, // 70% of agent revenue
    totalEarnings: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Update creator stats
  await db.collection('creatorProfiles').doc(creatorId).update({
    totalReferrals: FieldValue.increment(1),
  }).catch(() => {});

  // Tag user as referred
  await db.collection('users').doc(userId).update({
    referredBy: creatorId,
    referralAgent: agentId ?? null,
  }).catch(() => {});

  logger.info('[Referral] Conversion recorded', { creatorId, userId, agentId });

  res.json({ success: true, data: { converted: true } });
}));

// ── PROTECTED: Creator referral dashboard ───────────────────────────────────

router.use(authMiddleware);

// GET /api/referral/my-stats — creator's referral stats
router.get('/my-stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) throw new AppError('Auth required', 401);

  const db = getFirestore();

  // Get creator profile
  const profileDoc = await db.collection('creatorProfiles').doc(uid).get();
  const profile = profileDoc.data() ?? {};

  // Get referrals
  const referralsSnap = await db.collection('referrals')
    .where('creatorId', '==', uid).limit(100).get();
  const referrals = referralsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Get clicks (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000);
  const clicksSnap = await db.collection('referralClicks')
    .where('creatorId', '==', uid)
    .where('createdAt', '>=', thirtyDaysAgo)
    .limit(1000).get();

  const totalClicks = (profile['totalClicks'] as number) ?? clicksSnap.size;
  const totalReferrals = referrals.length;
  const totalEarnings = referrals.reduce((s, r) => s + ((r as Record<string, unknown>)['totalEarnings'] as number ?? 0), 0);
  const conversionRate = totalClicks > 0 ? `${Math.round((totalReferrals / totalClicks) * 100)}%` : '0%';

  // Referral link
  const referralLink = `https://orlode.com/ref/${uid}`;

  res.json({
    success: true,
    data: {
      referralLink,
      totalClicks,
      totalReferrals,
      totalEarnings,
      conversionRate,
      recentClicks30d: clicksSnap.size,
      referrals: referrals.slice(0, 20),
    },
  });
}));

// GET /api/referral/my-link — just get the referral link
router.get('/my-link', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) throw new AppError('Auth required', 401);

  res.json({
    success: true,
    data: {
      link: `https://orlode.com/ref/${uid}`,
      agentLinks: [], // Could be populated with per-agent links
    },
  });
}));

export default router;
