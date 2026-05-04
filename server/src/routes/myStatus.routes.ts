/**
 * Public client status — magic-token gated.
 *
 * GET   /api/my-status?token=...                       — aggregate view
 * POST  /api/my-status/cancel-appointment?token=...    { appointmentId }
 * POST  /api/my-status/cancel-reservation?token=...    { reservationId }
 * POST  /api/my-status/cancel-order?token=...          { orderId }
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getFirestore } from '../config/firebase.config';
import { verifyMagicToken } from '../utils/magicToken';

const router = Router();

interface Me {
  type: 'email' | 'phone';
  id: string;
  companyId: string;
}

function authed(req: Request, res: Response): Me | null {
  const token = (req.query['token'] as string) || '';
  const payload = verifyMagicToken(token);
  if (!payload) {
    res.status(401).json({ success: false, message: 'Lien invalide ou expiré.' });
    return null;
  }
  return { type: payload.type, id: payload.id, companyId: payload.companyId };
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const me = authed(req, res);
  if (!me) return;
  const db = getFirestore();

  const field = me.type === 'email' ? 'clientEmail' : 'clientPhone';

  const [apptSnap, resvSnap, orderSnap, quoteSnap] = await Promise.all([
    db.collection(`companies/${me.companyId}/appointments`).where(field, '==', me.id).limit(100).get().catch(() => null),
    db.collection(`companies/${me.companyId}/reservations`).where(field, '==', me.id).limit(100).get().catch(() => null),
    db.collection(`companies/${me.companyId}/orders`).where(field, '==', me.id).limit(100).get().catch(() => null),
    db.collection(`companies/${me.companyId}/quoteRequests`).where(field, '==', me.id).limit(50).get().catch(() => null),
  ]);

  const companyDoc = await db.collection('companies').doc(me.companyId).get();
  const company = {
    name:    (companyDoc.data()?.['name']    as string) || 'Entreprise',
    phone:   (companyDoc.data()?.['phone']   as string) || '',
    email:   (companyDoc.data()?.['email']   as string) || '',
    logoUrl: (companyDoc.data()?.['logoUrl'] as string) || '',
  };

  res.json({
    success: true,
    data: {
      company,
      me: { type: me.type, id: me.id },
      appointments:  apptSnap  ? apptSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [],
      reservations:  resvSnap  ? resvSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [],
      orders:        orderSnap ? orderSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [],
      quoteRequests: quoteSnap ? quoteSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [],
    },
  });
}));

async function cancelDoc(collPath: string, docId: string, me: Me, res: Response, itemLabel: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection(collPath).doc(docId);
  const doc = await ref.get();
  if (!doc.exists) { res.status(404).json({ success: false, message: `${itemLabel} introuvable.` }); return; }
  const data = doc.data() ?? {};
  const stored = me.type === 'email'
    ? ((data['clientEmail'] as string) ?? '').toLowerCase().trim()
    : ((data['clientPhone'] as string) ?? '').replace(/[^0-9+]/g, '');
  if (stored !== me.id) { res.status(403).json({ success: false, message: 'Identité invalide.' }); return; }
  const status = (data['status'] as string) ?? '';
  if (status === 'paid' || status === 'fulfilled' || status === 'cancelled' || status === 'rejected') {
    res.status(400).json({ success: false, message: `Cet élément ne peut plus être annulé (statut: ${status}).` });
    return;
  }
  await ref.update({ status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'client_magic' });
  res.json({ success: true });
}

router.post('/cancel-appointment', asyncHandler(async (req: Request, res: Response) => {
  const me = authed(req, res); if (!me) return;
  const { appointmentId } = req.body as { appointmentId?: string };
  if (!appointmentId) { res.status(400).json({ success: false, message: 'appointmentId required' }); return; }
  await cancelDoc(`companies/${me.companyId}/appointments`, appointmentId, me, res, 'Rendez-vous');
}));

router.post('/cancel-reservation', asyncHandler(async (req: Request, res: Response) => {
  const me = authed(req, res); if (!me) return;
  const { reservationId } = req.body as { reservationId?: string };
  if (!reservationId) { res.status(400).json({ success: false, message: 'reservationId required' }); return; }
  await cancelDoc(`companies/${me.companyId}/reservations`, reservationId, me, res, 'Réservation');
}));

router.post('/cancel-order', asyncHandler(async (req: Request, res: Response) => {
  const me = authed(req, res); if (!me) return;
  const { orderId } = req.body as { orderId?: string };
  if (!orderId) { res.status(400).json({ success: false, message: 'orderId required' }); return; }
  await cancelDoc(`companies/${me.companyId}/orders`, orderId, me, res, 'Commande');
}));

export default router;
