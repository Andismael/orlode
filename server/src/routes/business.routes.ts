/**
 * Business Hub API — public endpoint that aggregates every customer-facing
 * service a company has configured (chat IA, shop, menu, hotel, salon, etc.)
 * into a single response. Powers the per-company PWA's home screen at
 * /business/:companyId — the page customers land on when they tap the
 * installed app icon.
 *
 * GET /api/business/:companyId
 *   → { company, services[] }
 *
 * No auth — the response is identical to what's already visible on each
 * individual public page, just bundled. Strips private fields.
 */
import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// Map a store's establishmentType / businessType / salonType to a public
// route + presentation label. The Hub uses these to render service tiles.
function classifyStore(store: Record<string, unknown>): {
  type: 'shop' | 'menu' | 'hotel' | 'salon' | 'cabinet' | 'realestate' | 'residence';
  emoji: string;
  label: string;
  pathBuilder: (slug: string) => string;
} | null {
  const et = (store['establishmentType'] as string | undefined)?.toLowerCase();
  const bt = (store['businessType'] as string | undefined)?.toLowerCase();
  const st = (store['salonType'] as string | undefined)?.toLowerCase();

  if (et === 'hotel' || bt === 'hotel') {
    return { type: 'hotel', emoji: '🏨', label: 'Réserver une chambre', pathBuilder: s => `/hotel/${s}` };
  }
  if (et === 'restaurant' || et === 'menu' || bt === 'restaurant' || bt === 'menu') {
    return { type: 'menu', emoji: '🍽️', label: 'Voir notre menu', pathBuilder: s => `/menu/${s}` };
  }
  if (st || et === 'salon' || bt === 'salon') {
    return { type: 'salon', emoji: '💇', label: 'Prendre rendez-vous', pathBuilder: s => `/salon/${s}` };
  }
  if (et === 'health' || et === 'cabinet' || bt === 'cabinet') {
    return { type: 'cabinet', emoji: '🩺', label: 'Consulter / RDV', pathBuilder: s => `/cabinet/${s}` };
  }
  if (et === 'realestate' || et === 'immobilier' || bt === 'realestate' || bt === 'immobilier') {
    return { type: 'realestate', emoji: '🏘️', label: 'Voir les biens', pathBuilder: s => `/biens/${s}` };
  }
  if (et === 'residence' || bt === 'residence') {
    return { type: 'residence', emoji: '🏖️', label: 'Réserver le séjour', pathBuilder: s => `/residence/${s}` };
  }
  // Fallback: treat as a regular shop
  return { type: 'shop', emoji: '🛒', label: 'Notre boutique', pathBuilder: s => `/shop/${s}` };
}

router.get('/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.params['companyId'];
  if (!companyId) throw new AppError('companyId required', 400);

  const db = getFirestore();
  const companySnap = await db.collection('companies').doc(companyId).get();
  if (!companySnap.exists) throw new AppError('Company not found', 404);
  const c = companySnap.data() ?? {};

  // ── Always-available services ──────────────────────────────────────────
  const services: Array<Record<string, unknown>> = [];

  // 1. Chat IA — every company has a clone
  services.push({
    type: 'clone',
    emoji: '💬',
    label: 'Discuter avec notre IA',
    description: 'Pose une question, on te répond 24/7',
    url: `/clone/${companyId}`,
    primary: true,
  });

  // 2. WhatsApp direct — if the company has a phone number
  const whatsapp = (c['whatsapp'] as string | undefined) ?? (c['phone'] as string | undefined);
  if (whatsapp) {
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length >= 8) {
      services.push({
        type: 'whatsapp',
        emoji: '📞',
        label: 'WhatsApp direct',
        description: 'Discute avec un humain sur WhatsApp',
        url: `https://wa.me/${digits}`,
        external: true,
      });
    }
  }

  // ── Per-store services ────────────────────────────────────────────────
  // Active customer-facing stores live under companies/{id}/stores. We pick
  // the ones marked active + slug-resolvable so the Hub can link to a real
  // public page.
  const storesSnap = await db.collection(`companies/${companyId}/stores`).get();
  for (const doc of storesSnap.docs) {
    const data = doc.data();
    if (data['status'] === 'paused' || data['status'] === 'deleted') continue;
    const slug = data['slug'] as string | undefined;
    if (!slug) continue;
    const classified = classifyStore(data);
    if (!classified) continue;
    services.push({
      type: classified.type,
      emoji: classified.emoji,
      label: classified.label,
      description: data['tagline'] || data['shortDescription'] || null,
      url: classified.pathBuilder(slug),
      logoUrl: data['logoUrl'] ?? null,
      coverImageUrl: data['coverImageUrl'] ?? null,
      storeName: data['name'] ?? null,
    });
  }

  // 3. Address / map — if set on the company
  if (c['address'] || c['googleMapsUrl']) {
    services.push({
      type: 'location',
      emoji: '📍',
      label: 'Notre adresse',
      description: c['address'] ?? null,
      url: c['googleMapsUrl'] ?? null,
      external: !!c['googleMapsUrl'],
    });
  }

  res.setHeader('Cache-Control', 'public, max-age=180, stale-while-revalidate=600');
  res.json({
    success: true,
    company: {
      id: companyId,
      name: c['name'] ?? 'Mon entreprise',
      logoUrl: c['logoUrl'] ?? null,
      pwaLogoUrl: c['pwaLogoUrl'] ?? null,
      primaryColor: c['primaryColor'] ?? '#0F5C3F',
      tagline: c['tagline'] ?? c['slogan'] ?? null,
      city: c['city'] ?? null,
      country: c['country'] ?? null,
    },
    services,
  });
}));

export default router;
