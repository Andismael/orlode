/**
 * Products catalog for the Clone commerce layer.
 *
 * Firestore: companies/{id}/products/{productId}
 *   { id, name, description, price (number), currency, stock (number|null), category, imageUrl, active, createdAt }
 */
import { Router } from 'express';
import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Unauthorized', 401);
  const { active, category } = req.query as Record<string, string | undefined>;
  const db = getFirestore();
  let q: FirebaseFirestore.Query = db.collection(`companies/${companyId}/products`);
  if (active === 'true') q = q.where('active', '==', true);
  if (category) q = q.where('category', '==', category);
  const snap = await q.limit(500).get().catch(async () => await db.collection(`companies/${companyId}/products`).limit(500).get());
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, data: items });
}));

router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Unauthorized', 401);
  const { name, description, price, currency, stock, category, imageUrl } = req.body as {
    name?: string; description?: string; price?: number; currency?: string; stock?: number | null; category?: string; imageUrl?: string;
  };
  if (!name?.trim()) throw new AppError('name required', 400);
  if (price == null || isNaN(Number(price)) || Number(price) < 0) throw new AppError('valid price required', 400);
  const id = generateId();
  const doc = {
    id, name: name.trim(), description: description ?? '',
    price: Number(price),
    currency: currency ?? 'XOF',
    stock: stock === undefined ? null : stock,
    category: category ?? '',
    imageUrl: imageUrl ?? '',
    active: true,
    createdAt: new Date(),
  };
  await getFirestore().collection(`companies/${companyId}/products`).doc(id).set(doc);
  res.json({ success: true, data: doc });
}));

router.patch('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Unauthorized', 401);
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const allowed = ['name', 'description', 'price', 'currency', 'stock', 'category', 'imageUrl', 'active'];
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (k in body) updates[k] = body[k];
  await getFirestore().collection(`companies/${companyId}/products`).doc(id).update(updates);
  res.json({ success: true });
}));

router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Unauthorized', 401);
  const { id } = req.params;
  await getFirestore().collection(`companies/${companyId}/products`).doc(id).delete();
  res.json({ success: true });
}));

export default router;
