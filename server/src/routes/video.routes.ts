import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import { videoGenerationService, type VideoQuality, type VideoPlatform } from '../services/video/videoGenerationService';
import { AppError } from '../middleware/error.middleware';
import { getFirestore } from '../config/firebase.config';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';

const router = Router();
router.use(authMiddleware);

// POST /api/video/estimate — estimer le coût avant génération
router.post('/estimate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { quality, duration, platforms } = req.body as {
    quality: VideoQuality; duration: number; platforms: VideoPlatform[];
  };
  if (!quality || !duration || !platforms?.length) throw new AppError('quality, duration, platforms required', 400);
  const cost = videoGenerationService.estimateCost(quality, duration, platforms);
  res.json({ success: true, data: { estimatedCost: parseFloat(cost.toFixed(2)), currency: 'USD' } });
}));

// POST /api/video/generate — générer des vidéos (nécessite approbation avant publication)
router.post('/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { script, quality = 'standard', platforms, duration = 15, language = 'fr', inputImageUrl } = req.body as {
    script: string; quality?: VideoQuality; platforms: VideoPlatform[];
    duration?: number; language?: string; inputImageUrl?: string;
  };
  if (!script || !platforms?.length) throw new AppError('script and platforms required', 400);

  const videos = await videoGenerationService.generateForPlatforms({ script, quality, platforms, duration, language, inputImageUrl, companyId });

  // Sauvegarder comme brouillons en attente d'approbation
  const db = getFirestore();
  const saved = await Promise.all(videos.map(async v => {
    const ref = db.collection(`companies/${companyId}/marketingContent`).doc();
    await ref.set({ ...v, createdBy: req.user?.uid, createdAt: new Date(), updatedAt: new Date() }).catch(() => {});
    return { id: ref.id, ...v };
  }));

  const totalCost = videos.reduce((s, v) => s + v.cost, 0);
  res.json({
    success: true,
    data: { videos: saved, totalCost: parseFloat(totalCost.toFixed(2)), status: 'pending_approval' },
  });
}));

// GET /api/video/drafts — vidéos en attente d'approbation
router.get('/drafts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  try {
    const snap = await getFirestore()
      .collection(`companies/${companyId}/marketingContent`)
      .where('status', '==', 'pending_approval')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch {
    res.json({ success: true, data: [] });
  }
}));

// PATCH /api/video/drafts/:id/approve — approuver une vidéo
router.patch('/drafts/:id/approve', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore()
    .collection(`companies/${companyId}/marketingContent`).doc(req.params['id'])
    .update({ status: 'approved', approvedBy: req.user?.uid, approvedAt: new Date() })
    .catch(() => {});
  res.json({ success: true });
}));

// PATCH /api/video/drafts/:id/reject — rejeter une vidéo
router.patch('/drafts/:id/reject', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore()
    .collection(`companies/${companyId}/marketingContent`).doc(req.params['id'])
    .update({ status: 'rejected', rejectedBy: req.user?.uid, rejectedAt: new Date() })
    .catch(() => {});
  res.json({ success: true });
}));

// GET /api/video/history — all videos (any status)
router.get('/history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  try {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/marketingContent`);
    if (req.query['status']) q = q.where('status', '==', req.query['status']) as typeof q;
    const snap = await (q as ReturnType<typeof db.collection>).limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch {
    res.json({ success: true, data: [] });
  }
}));

// DELETE /api/video/drafts/:id
router.delete('/drafts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore().collection(`companies/${companyId}/marketingContent`).doc(req.params['id']).delete().catch(() => {});
  res.json({ success: true });
}));

// GET /api/video/stats
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  try {
    const snap = await getFirestore().collection(`companies/${companyId}/marketingContent`).limit(500).get();
    const all = snap.docs.map(d => d.data());
    const totalCost = all.reduce((s, v) => s + ((v['cost'] as number) ?? 0), 0);
    res.json({
      success: true,
      data: {
        total: all.length,
        pending: all.filter(v => v['status'] === 'pending_approval').length,
        approved: all.filter(v => v['status'] === 'approved').length,
        rejected: all.filter(v => v['status'] === 'rejected').length,
        totalCost: parseFloat(totalCost.toFixed(2)),
        platforms: [...new Set(all.map(v => v['platform'] as string).filter(Boolean))],
      },
    });
  } catch {
    res.json({ success: true, data: { total: 0, pending: 0, approved: 0, rejected: 0, totalCost: 0, platforms: [] } });
  }
}));

// POST /api/video/drafts/:id/publish — publish approved video to social platforms
router.post('/drafts/:id/publish', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/marketingContent`).doc(req.params['id']).get();
  if (!doc.exists) throw new AppError('Video not found', 404);

  const video = doc.data()!;
  if (video['status'] !== 'approved') throw new AppError('Video must be approved before publishing', 400);

  const { platforms, caption, hashtags } = req.body as { platforms?: string[]; caption?: string; hashtags?: string };
  const targetPlatforms = platforms ?? [video['platform'] as string];
  const videoUrl = video['videoUrl'] as string;

  if (!videoUrl) throw new AppError('No video URL available', 400);

  // Mark as publishing
  await doc.ref.update({ status: 'publishing', publishStartedAt: new Date() });

  // Publish to each platform via social service
  const results: Record<string, string> = {};
  try {
    const { socialPublishService } = await import('../services/social/socialPublishService');

    for (const platform of targetPlatforms) {
      try {
        // Get connector config for this platform
        const connectorDoc = await db.collection(`companies/${companyId}/connectors`).doc(platform).get();
        const connectorData = connectorDoc.data();
        if (!connectorData?.['accessToken']) {
          results[platform] = 'not_connected';
          continue;
        }

        // Prepare post content
        const postCaption = caption ?? (video['script'] as string) ?? '';
        const postHashtags = hashtags ?? '';
        const fullCaption = `${postCaption}\n\n${postHashtags}`.trim();

        // Use social publish service
        await socialPublishService.publishToAll(
          companyId,
          [platform as 'linkedin' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'twitter'],
          { text: fullCaption, videoUrl },
        );
        results[platform] = 'published';
      } catch (err) {
        results[platform] = `error: ${(err as Error).message}`;
      }
    }
  } catch (err) {
    await doc.ref.update({ status: 'approved', publishError: (err as Error).message });
    throw new AppError('Publishing failed', 500);
  }

  // Update status
  const allPublished = Object.values(results).every(r => r === 'published');
  await doc.ref.update({
    status: allPublished ? 'published' : 'partially_published',
    publishedAt: new Date(),
    publishedBy: req.user?.uid,
    publishResults: results,
    publishCaption: caption,
    publishHashtags: hashtags,
  });

  res.json({ success: true, data: { results } });
}));

export default router;
