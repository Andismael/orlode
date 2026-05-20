/**
 * Commerce / Boutique WhatsApp routes — store provisioning + management.
 *
 * Phase 1.5 minimal: 1 store per company. The activation wizard calls
 * POST /api/commerce/stores with { name, ownerPhone, paymentInstructions? }.
 * Once created, the WhatsApp webhook can match incoming photos from the owner
 * and trigger the photo→product magic.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { syncProductToMeta, deleteProductFromMeta, importFromMetaCatalog } from '../services/commerce/metaCatalogSync';

const router = Router();

// ── PUBLIC CRON (no user auth — gated by x-cron-secret header) ───────────────
// MUST be declared BEFORE router.use(authMiddleware) so Cloud Scheduler can hit it.
//
// POST /api/commerce/cron/daily — call once a day (e.g. 20h).
// Sends daily digest to each owner + reactivation msgs to clients delivered 7d ago.
router.post('/cron/daily', asyncHandler(async (req: Request, res: Response) => {
  const expected = process.env['CRON_SECRET'] ?? '';
  const provided = (req.header('x-cron-secret') ?? '').trim();
  if (!expected || provided !== expected) throw new AppError('Forbidden', 403);
  const { runCommerceDailyJob } = await import('../agents/commerce.agent');
  const result = await runCommerceDailyJob();
  res.json({ success: true, ...result });
}));

// POST /api/commerce/cron/ical-sync — call every 30 min via Cloud Scheduler.
// Iterates every store with `icalImports[]` and refreshes external_blocks.
// Used to keep Booking.com / Airbnb / Google Calendar feeds in sync without
// asking the owner to click "Synchroniser maintenant" in Settings.
router.post('/cron/ical-sync', asyncHandler(async (req: Request, res: Response) => {
  const expected = process.env['CRON_SECRET'] ?? '';
  const provided = (req.header('x-cron-secret') ?? '').trim();
  if (!expected || provided !== expected) throw new AppError('Forbidden', 403);

  const db = getFirestore();
  const { syncOneFeed } = await import('../services/commerce/icalImport');
  const stores = await db.collectionGroup('stores')
    .where('icalImports', '!=', null).get().catch(() => null);
  if (!stores) {
    res.json({ success: true, scanned: 0, synced: 0 });
    return;
  }
  let scanned = 0;
  let synced = 0;
  let errors = 0;
  for (const d of stores.docs) {
    const data = d.data() as { icalImports?: Array<{ url: string; name: string; roomId?: string }> };
    const imports = Array.isArray(data.icalImports) ? data.icalImports : [];
    if (imports.length === 0) continue;
    const path = d.ref.path; // companies/{cid}/stores/{sid}
    const m = path.match(/^companies\/([^/]+)\/stores\/([^/]+)$/);
    if (!m) continue;
    scanned++;
    for (const cfg of imports) {
      try {
        const r = await syncOneFeed(m[1], m[2], cfg);
        if (r.error) errors++; else synced++;
      } catch { errors++; }
    }
  }
  res.json({ success: true, scanned, synced, errors });
}));

// POST /api/commerce/cron/reservation-reminders — call every hour.
// Sends J-1 (next day, runs at 19h local) + H-2 (2h before reservation time)
// WhatsApp reminders to customers. Idempotent via remindersSent[] array.
router.post('/cron/reservation-reminders', asyncHandler(async (req: Request, res: Response) => {
  const expected = process.env['CRON_SECRET'] ?? '';
  const provided = (req.header('x-cron-secret') ?? '').trim();
  if (!expected || provided !== expected) throw new AppError('Forbidden', 403);
  const { runReservationReminders } = await import('../agents/commerce.agent');
  const result = await runReservationReminders();
  res.json({ success: true, ...result });
}));

// POST /api/commerce/cron/morning-brief — call once a day at 7h Abidjan.
// Sends a WhatsApp KPI brief to each restaurant owner: yesterday's orders,
// revenue, top dish, today's reservations.
router.post('/cron/morning-brief', asyncHandler(async (req: Request, res: Response) => {
  const expected = process.env['CRON_SECRET'] ?? '';
  const provided = (req.header('x-cron-secret') ?? '').trim();
  if (!expected || provided !== expected) throw new AppError('Forbidden', 403);
  const { runMorningBrief } = await import('../agents/commerce.agent');
  const result = await runMorningBrief();
  res.json({ success: true, ...result });
}));

// POST /api/commerce/cron/stay-cycle — call every hour.
// For hotel + residence packs: sends J-1 pre-arrival WhatsApp (17-20h local)
// and post-stay review request (11-14h local). Idempotent via stayMessagesSent[].
router.post('/cron/stay-cycle', asyncHandler(async (req: Request, res: Response) => {
  const expected = process.env['CRON_SECRET'] ?? '';
  const provided = (req.header('x-cron-secret') ?? '').trim();
  if (!expected || provided !== expected) throw new AppError('Forbidden', 403);
  const { runStayCycleMessages } = await import('../agents/commerce.agent');
  const result = await runStayCycleMessages();
  res.json({ success: true, ...result });
}));

// POST /api/commerce/cron/stock-alerts — call every 30 min during service hours.
// Scans all stores for products with stockQty <= lowStockThreshold (default 3)
// and notifies the owner via WhatsApp with interactive buttons.
router.post('/cron/stock-alerts', asyncHandler(async (req: Request, res: Response) => {
  const expected = process.env['CRON_SECRET'] ?? '';
  const provided = (req.header('x-cron-secret') ?? '').trim();
  if (!expected || provided !== expected) throw new AppError('Forbidden', 403);
  const { runStockAlerts } = await import('../agents/commerce.agent');
  const result = await runStockAlerts();
  res.json({ success: true, ...result });
}));

// All other commerce endpoints require an authenticated user belonging to a company.
router.use(authMiddleware);

// ── Multi-tenant safety: requireStoreOwnership ────────────────────────────────
// Any route that takes a `:storeId` URL param goes through this. It verifies
// the store actually exists under the requesting user's companyId. This is
// defense-in-depth: the Firestore paths already include companyId, so a user
// in company A querying a storeId from company B would just hit an empty doc.
// But empty results give the impression of "success" — surfacing a clean 404
// instead protects against bugs that assume the store exists and prevents
// stray writes from creating phantom docs under the wrong tenant.
router.param('storeId', (req, _res, next, storeId: string) => {
  const authReq = req as AuthenticatedRequest;
  const companyId = authReq.user?.companyId;
  if (!companyId) { next(new AppError('Company ID required', 400)); return; }
  if (!storeId || typeof storeId !== 'string') { next(new AppError('Invalid storeId', 400)); return; }
  getFirestore().doc(`companies/${companyId}/stores/${storeId}`).get()
    .then(snap => {
      if (!snap.exists) {
        logger.warn('[Commerce] Store ownership check failed', { companyId, storeId, uid: authReq.user?.uid });
        next(new AppError('Store introuvable ou accès refusé', 404));
        return;
      }
      (authReq as any).store = { id: snap.id, ...(snap.data() ?? {}) };
      next();
    })
    .catch(err => next(err));
});

// E.164 normalize: strip spaces/dashes/parens but keep leading +.
function normalizeE164(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-().]/g, '');
  // Accept "+225XXXXXXXX" (8+ digits after +). Reject anything without +.
  if (!/^\+\d{8,15}$/.test(cleaned)) return null;
  return cleaned;
}

// ── POST /api/commerce/stores — provision a new store ────────────────────────
router.post('/stores', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { name, ownerPhone, paymentInstructions, currency, country, businessType, allowDuplicate } = req.body as {
    name?: string;
    ownerPhone?: string;
    paymentInstructions?: string;
    currency?: string;
    country?: string;
    businessType?: 'boutique' | 'restaurant' | 'hotel' | 'service' | 'health' | 'cabinet' | 'realestate' | 'residence';
    /** Set true to bypass the "1 store per businessType" idempotent check.
     *  Used for multi-property cases (chaîne d'hôtels, agence avec plusieurs
     *  bureaux, salon avec plusieurs locaux). Default false (true for residences). */
    allowDuplicate?: boolean;
  };

  if (!name || name.trim().length < 2) {
    throw new AppError('Nom de boutique requis (min 2 caractères).', 400);
  }
  const phoneE164 = normalizeE164(ownerPhone ?? '');
  if (!phoneE164) {
    throw new AppError('Numéro WhatsApp invalide. Format attendu : +2250707070707', 400);
  }

  const bizType = businessType ?? 'boutique';
  const db = getFirestore();
  const { generateUniqueSlug, ensureStoreSlug } = await import('../agents/commerce.agent');

  // Idempotent by default: 1 store per businessType per company. Owner can
  // pass allowDuplicate:true to explicitly create a 2nd, 3rd, etc. — used for
  // chains (multi-hôtels, multi-résidences, multi-locaux salon, etc.).
  // Residences are inherently multi-unit, so allowDuplicate defaults to true there.
  const isMultiByDefault = bizType === 'residence';
  if (!allowDuplicate && !isMultiByDefault) {
    const existingSnap = await db.collection(`companies/${companyId}/stores`)
      .where('businessType', '==', bizType).limit(1).get().catch(() => null);
    // Backward compat: legacy stores have no businessType — they count as 'boutique'.
    let existingDoc = existingSnap?.docs[0];
    if (!existingDoc && bizType === 'boutique') {
      const legacy = await db.collection(`companies/${companyId}/stores`).limit(5).get();
      existingDoc = legacy.docs.find(d => !d.data()['businessType']);
    }
    if (existingDoc) {
      const existingData = existingDoc.data();
      const slug = await ensureStoreSlug(companyId, existingDoc.id, existingData as never);
      return res.status(200).json({
        success: true,
        alreadyExisted: true,
        storeId: existingDoc.id,
        store: { id: existingDoc.id, ...existingData, slug },
      });
    }
  }

  const storeRef = db.collection(`companies/${companyId}/stores`).doc();
  const slug = await generateUniqueSlug(name.trim());
  const now = new Date();
  const store = {
    name: name.trim(),
    slug,
    ownerPhone: phoneE164,
    paymentInstructions: (paymentInstructions ?? '').trim(),
    currency: (currency ?? 'XOF').toUpperCase(),
    country: (country ?? 'CI').toUpperCase(),
    businessType: bizType,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
    createdBy: req.user?.uid ?? null,
  };
  await storeRef.set(store);

  logger.info('[Commerce] Store created', {
    companyId, storeId: storeRef.id, slug, ownerPhone: phoneE164, businessType: bizType,
  });

  res.status(201).json({
    success: true,
    storeId: storeRef.id,
    store: { id: storeRef.id, ...store },
  });
}));

// ── POST /api/commerce/stores/:storeId/upload-image — upload logo or cover ───
// Body: { imageBase64, imageMimeType, slot: 'logo' | 'cover' }
// Returns: { url } — public Firebase Storage URL written back to the store doc
// on `logoUrl` or `coverImageUrl`.
router.post('/stores/:storeId/upload-image', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { storeId } = req.params;
  const { imageBase64, imageMimeType, slot } = req.body as { imageBase64?: string; imageMimeType?: string; slot?: 'logo' | 'cover' };
  if (!imageBase64) throw new AppError('imageBase64 required', 400);
  if (slot !== 'logo' && slot !== 'cover') throw new AppError('slot must be "logo" or "cover"', 400);

  const db = getFirestore();
  const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
  if (!storeSnap.exists) throw new AppError('Store introuvable', 404);

  const { getStorage } = await import('../config/firebase.config');
  const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
  if (buffer.length > 4 * 1024 * 1024) throw new AppError('Image trop lourde (max 4 Mo).', 413);
  const mime = imageMimeType ?? 'image/png';
  const ext = mime.split('/')[1]?.split('+')[0] ?? 'png';
  const { randomBytes } = await import('crypto');
  const fileName = `companies/${companyId}/stores/${storeId}/${slot}-${randomBytes(6).toString('hex')}.${ext}`;
  const bucket = getStorage().bucket();
  await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
  const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

  const field = slot === 'logo' ? 'logoUrl' : 'coverImageUrl';
  await db.doc(`companies/${companyId}/stores/${storeId}`).update({ [field]: url, updatedAt: new Date() });

  res.json({ success: true, data: { url, slot } });
}));

// ── GET /api/commerce/stores — list stores of current company ────────────────
// Optional ?businessType=boutique|restaurant filter. Legacy stores without a
// businessType field are returned as 'boutique' for backward compat.
router.get('/stores', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const filterType = (req.query['businessType'] as string | undefined)?.toLowerCase();

  const snap = await getFirestore().collection(`companies/${companyId}/stores`).get();
  const all = snap.docs.map(d => ({ id: d.id, businessType: 'boutique', ...d.data() } as Record<string, unknown> & { id: string }));
  const stores = filterType
    ? all.filter(s => (s['businessType'] ?? 'boutique') === filterType)
    : all;
  res.json({ success: true, stores });
}));

// ── GET /api/commerce/stores/:storeId ────────────────────────────────────────
router.get('/stores/:storeId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const snap = await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}`)
    .get();
  if (!snap.exists) throw new AppError('Boutique introuvable.', 404);
  res.json({ success: true, store: { id: snap.id, ...snap.data() } });
}));

// ── PATCH /api/commerce/stores/:storeId — update name/payment/status/zones ───
router.patch('/stores/:storeId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const {
    name, paymentInstructions, status, ownerPhone, deliveryZones,
    logoUrl, coverImageUrl, accentColor,
    loyaltyEnabled, loyaltyPointsPerUnit, loyaltyThreshold, loyaltyDiscountPct,
    currency, country, openingHours, establishmentType,
    address, googleMapsUrl, latitude, longitude, salonType, cabinetProfile,
    // Residence (Airbnb-style) fields on the store doc
    roomType, bedrooms, bathrooms, surfaceM2, maxGuests, childrenFreeUnder,
    allowExtraGuests, maxExtraGuests, city, neighborhood,
    pricePerNight, cleaningFee, amenities, affiliateUrl, instantBooking, useContactForm,
    featured: storeFeatured, longDescription,
    // Branding / marketing identity (used on public page + bot replies)
    tagline, shortDescription, contactEmail, websiteUrl,
    instagramUrl, facebookUrl, tiktokUrl, twitterUrl, youtubeUrl,
  } = req.body as {
    name?: string; paymentInstructions?: string;
    status?: 'active' | 'suspended'; ownerPhone?: string;
    deliveryZones?: Array<{ name: string; fee: number; freeAbove?: number }>;
    logoUrl?: string; coverImageUrl?: string; accentColor?: string;
    loyaltyEnabled?: boolean;
    loyaltyPointsPerUnit?: number; loyaltyThreshold?: number; loyaltyDiscountPct?: number;
    currency?: string; country?: string;
    openingHours?: string;
    establishmentType?: 'restaurant' | 'maquis' | 'bar';
    address?: string; googleMapsUrl?: string;
    latitude?: number; longitude?: number;
    salonType?: 'coiffure' | 'esthetique' | 'spa' | 'barber';
    cabinetProfile?: 'medecin' | 'dentiste' | 'avocat' | 'notaire' | 'comptable' | 'veto';
    roomType?: 'entire' | 'private_room' | 'shared_room';
    bedrooms?: number; bathrooms?: number; surfaceM2?: number;
    maxGuests?: number; childrenFreeUnder?: number;
    allowExtraGuests?: boolean; maxExtraGuests?: number;
    city?: string; neighborhood?: string;
    pricePerNight?: number; cleaningFee?: number;
    amenities?: string[]; affiliateUrl?: string;
    instantBooking?: boolean; useContactForm?: boolean;
    featured?: boolean; longDescription?: string;
    tagline?: string; shortDescription?: string;
    contactEmail?: string; websiteUrl?: string;
    instagramUrl?: string; facebookUrl?: string;
    tiktokUrl?: string; twitterUrl?: string; youtubeUrl?: string;
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof name === 'string' && name.trim().length >= 2) updates['name'] = name.trim();
  if (typeof paymentInstructions === 'string') updates['paymentInstructions'] = paymentInstructions.trim();
  if (status === 'active' || status === 'suspended') updates['status'] = status;
  if (typeof ownerPhone === 'string') {
    const phoneE164 = normalizeE164(ownerPhone);
    if (!phoneE164) throw new AppError('Numéro WhatsApp invalide.', 400);
    updates['ownerPhone'] = phoneE164;
  }
  if (typeof logoUrl === 'string') updates['logoUrl'] = logoUrl.trim();
  if (typeof coverImageUrl === 'string') updates['coverImageUrl'] = coverImageUrl.trim();
  if (typeof accentColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColor)) updates['accentColor'] = accentColor;
  if (typeof currency === 'string' && /^[A-Z]{3}$/.test(currency.toUpperCase())) updates['currency'] = currency.toUpperCase();
  if (typeof country === 'string' && /^[A-Z]{2}$/.test(country.toUpperCase())) updates['country'] = country.toUpperCase();
  if (typeof loyaltyEnabled === 'boolean') updates['loyaltyEnabled'] = loyaltyEnabled;
  if (typeof loyaltyPointsPerUnit === 'number' && loyaltyPointsPerUnit > 0) updates['loyaltyPointsPerUnit'] = Math.round(loyaltyPointsPerUnit);
  if (typeof loyaltyThreshold === 'number' && loyaltyThreshold > 0) updates['loyaltyThreshold'] = Math.round(loyaltyThreshold);
  if (typeof loyaltyDiscountPct === 'number' && loyaltyDiscountPct >= 0 && loyaltyDiscountPct <= 50) updates['loyaltyDiscountPct'] = Math.round(loyaltyDiscountPct);
  if (typeof openingHours === 'string') updates['openingHours'] = openingHours.trim().slice(0, 200);
  if (establishmentType === 'restaurant' || establishmentType === 'maquis' || establishmentType === 'bar') {
    updates['establishmentType'] = establishmentType;
  }
  if (typeof address === 'string') updates['address'] = address.trim().slice(0, 300);
  if (typeof googleMapsUrl === 'string') {
    const u = googleMapsUrl.trim();
    if (u === '' || /^https?:\/\//i.test(u)) updates['googleMapsUrl'] = u;
  }
  // Auto-extract lat/lng from a Google Maps URL with @lat,lng or !3dlat!4dlng patterns
  if (typeof googleMapsUrl === 'string' && googleMapsUrl.length > 0) {
    const at = googleMapsUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const dq = googleMapsUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    const m = at ?? dq;
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        updates['latitude'] = lat;
        updates['longitude'] = lng;
      }
    }
  }
  if (typeof latitude === 'number' && latitude >= -90 && latitude <= 90) updates['latitude'] = latitude;
  if (typeof longitude === 'number' && longitude >= -180 && longitude <= 180) updates['longitude'] = longitude;
  if (cabinetProfile && ['medecin','dentiste','avocat','notaire','comptable','veto'].includes(cabinetProfile)) {
    updates['cabinetProfile'] = cabinetProfile;
  }
  if (salonType === 'coiffure' || salonType === 'esthetique' || salonType === 'spa' || salonType === 'barber') {
    updates['salonType'] = salonType;
  }
  // Residence-style fields
  if (roomType === 'entire' || roomType === 'private_room' || roomType === 'shared_room') updates['roomType'] = roomType;
  if (typeof bedrooms === 'number' && bedrooms >= 0 && bedrooms <= 30) updates['bedrooms'] = Math.round(bedrooms);
  if (typeof bathrooms === 'number' && bathrooms >= 0 && bathrooms <= 20) updates['bathrooms'] = Math.round(bathrooms);
  if (typeof surfaceM2 === 'number' && surfaceM2 >= 0 && surfaceM2 <= 10000) updates['surfaceM2'] = Math.round(surfaceM2);
  if (typeof maxGuests === 'number' && maxGuests >= 1 && maxGuests <= 50) updates['maxGuests'] = Math.round(maxGuests);
  if (typeof childrenFreeUnder === 'number' && childrenFreeUnder >= 0 && childrenFreeUnder <= 18) updates['childrenFreeUnder'] = Math.round(childrenFreeUnder);
  if (typeof allowExtraGuests === 'boolean') updates['allowExtraGuests'] = allowExtraGuests;
  if (typeof maxExtraGuests === 'number' && maxExtraGuests >= 0 && maxExtraGuests <= 20) updates['maxExtraGuests'] = Math.round(maxExtraGuests);
  if (typeof city === 'string') updates['city'] = city.trim().slice(0, 80);
  if (typeof neighborhood === 'string') updates['neighborhood'] = neighborhood.trim().slice(0, 80);
  if (typeof pricePerNight === 'number' && pricePerNight >= 0) updates['pricePerNight'] = Math.round(pricePerNight);
  if (typeof cleaningFee === 'number' && cleaningFee >= 0) updates['cleaningFee'] = Math.round(cleaningFee);
  if (Array.isArray(amenities)) {
    updates['amenities'] = amenities
      .filter(a => typeof a === 'string' && a.trim().length > 0)
      .map(a => (a as string).trim().slice(0, 40))
      .slice(0, 30);
  }
  if (typeof affiliateUrl === 'string') {
    const u = affiliateUrl.trim();
    if (u === '' || /^https?:\/\//i.test(u)) updates['affiliateUrl'] = u;
  }
  if (typeof instantBooking === 'boolean') updates['instantBooking'] = instantBooking;
  if (typeof useContactForm === 'boolean') updates['useContactForm'] = useContactForm;
  if (typeof storeFeatured === 'boolean') updates['featured'] = storeFeatured;
  if (typeof longDescription === 'string') updates['longDescription'] = longDescription.trim().slice(0, 4000);

  // Branding/marketing identity
  if (typeof tagline === 'string') updates['tagline'] = tagline.trim().slice(0, 120);
  if (typeof shortDescription === 'string') updates['shortDescription'] = shortDescription.trim().slice(0, 400);
  if (typeof contactEmail === 'string') {
    const e = contactEmail.trim();
    if (e === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) updates['contactEmail'] = e.toLowerCase();
  }
  for (const [field, val] of [
    ['websiteUrl', websiteUrl],
    ['instagramUrl', instagramUrl],
    ['facebookUrl', facebookUrl],
    ['tiktokUrl', tiktokUrl],
    ['twitterUrl', twitterUrl],
    ['youtubeUrl', youtubeUrl],
  ] as const) {
    if (typeof val === 'string') {
      const u = val.trim();
      if (u === '' || /^https?:\/\//i.test(u)) updates[field] = u.slice(0, 300);
    }
  }

  // Hotel/Residence stay-cycle fields
  const stayBody = req.body as {
    checkInInstructions?: string; houseRules?: string; cancellationPolicy?: string;
    weeklyDiscountPct?: number; monthlyDiscountPct?: number;
  };
  if (typeof stayBody.checkInInstructions === 'string') updates['checkInInstructions'] = stayBody.checkInInstructions.trim().slice(0, 1500);
  if (typeof stayBody.houseRules === 'string') updates['houseRules'] = stayBody.houseRules.trim().slice(0, 1500);
  if (typeof stayBody.cancellationPolicy === 'string'
      && ['flexible', 'moderate', 'strict'].includes(stayBody.cancellationPolicy)) {
    updates['cancellationPolicy'] = stayBody.cancellationPolicy;
  }
  // Long-stay discounts: 0-50% range
  if (typeof stayBody.weeklyDiscountPct === 'number' && stayBody.weeklyDiscountPct >= 0 && stayBody.weeklyDiscountPct <= 50) {
    updates['weeklyDiscountPct'] = Math.round(stayBody.weeklyDiscountPct);
  }
  if (typeof stayBody.monthlyDiscountPct === 'number' && stayBody.monthlyDiscountPct >= 0 && stayBody.monthlyDiscountPct <= 50) {
    updates['monthlyDiscountPct'] = Math.round(stayBody.monthlyDiscountPct);
  }

  // Salon/health practitioners (multi-staff). Each entry must have id+name.
  const { practitioners } = req.body as { practitioners?: Array<{ id?: string; name?: string; role?: string; photoUrl?: string; workingHours?: string; active?: boolean }> };
  if (Array.isArray(practitioners)) {
    const cleaned = practitioners
      .slice(0, 30)
      .map(p => ({
        id: typeof p?.id === 'string' && p.id.trim() ? p.id.trim().slice(0, 60) : (p?.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
        name: typeof p?.name === 'string' ? p.name.trim().slice(0, 80) : '',
        ...(typeof p?.role === 'string' && p.role.trim() ? { role: p.role.trim().slice(0, 60) } : {}),
        ...(typeof p?.photoUrl === 'string' && /^https?:\/\//i.test(p.photoUrl) ? { photoUrl: p.photoUrl.trim() } : {}),
        ...(typeof p?.workingHours === 'string' && p.workingHours.trim() ? { workingHours: p.workingHours.trim().slice(0, 200) } : {}),
        active: p?.active !== false,
      }))
      .filter(p => p.id.length >= 2 && p.name.length >= 2);
    updates['practitioners'] = cleaned;
  }

  // PIN — owner can set/change a 4-6 digit PIN. Stored hashed.
  const { pin } = req.body as { pin?: string };
  if (typeof pin === 'string' && pin.length > 0) {
    if (!/^\d{4,6}$/.test(pin)) throw new AppError('PIN doit faire 4 à 6 chiffres.', 400);
    const { setStorePin } = await import('../agents/commerce.agent');
    await setStorePin(companyId, req.params.storeId, pin);
    // Don't include pin in updates — already saved separately as hash
  }
  if (Array.isArray(deliveryZones)) {
    // Validate each zone: name + fee numeric. Cap at 30 zones to avoid abuse.
    const cleanZones = deliveryZones
      .slice(0, 30)
      .filter(z => typeof z?.name === 'string' && z.name.trim().length >= 2 && typeof z?.fee === 'number' && z.fee >= 0)
      .map(z => ({
        name: z.name.trim(),
        fee: Math.round(z.fee),
        ...(typeof z.freeAbove === 'number' && z.freeAbove > 0 ? { freeAbove: Math.round(z.freeAbove) } : {}),
      }));
    updates['deliveryZones'] = cleanZones;
  }

  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}`)
    .update(updates);

  res.json({ success: true });
}));

// ── GET /api/commerce/stores/:storeId/products ───────────────────────────────
router.get('/stores/:storeId/products', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/products`)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  res.json({
    success: true,
    products: snap.docs.map(d => ({ id: d.id, ...d.data() })),
  });
}));

// ── GET /api/commerce/stores/:storeId/orders ─────────────────────────────────
router.get('/stores/:storeId/orders', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/orders`)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  res.json({
    success: true,
    orders: snap.docs.map(d => ({ id: d.id, ...d.data() })),
  });
}));

// ── PATCH /api/commerce/stores/:storeId/orders/:orderId ──────────────────────
// Update payment / delivery status from the admin dashboard.
// Auto-notifies the customer via WhatsApp when status changes.
router.patch('/stores/:storeId/orders/:orderId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { paymentStatus, deliveryStatus, channel, tableId, driverId, driverName, kdsStatus } = req.body as {
    paymentStatus?: 'pending' | 'paid' | 'failed';
    deliveryStatus?: 'pending' | 'preparing' | 'shipped' | 'delivered';
    channel?: 'dine_in' | 'takeout' | 'delivery';
    tableId?: string | null;
    driverId?: string | null; driverName?: string | null;
    kdsStatus?: 'new' | 'preparing' | 'ready' | 'served';
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (paymentStatus && ['pending', 'paid', 'failed'].includes(paymentStatus)) {
    updates['paymentStatus'] = paymentStatus;
  }
  if (deliveryStatus && ['pending', 'preparing', 'shipped', 'delivered'].includes(deliveryStatus)) {
    updates['deliveryStatus'] = deliveryStatus;
  }
  if (channel && ['dine_in', 'takeout', 'delivery'].includes(channel)) {
    updates['channel'] = channel;
  }
  if (tableId !== undefined) updates['tableId'] = tableId;
  if (driverId !== undefined) updates['driverId'] = driverId;
  if (driverName !== undefined) updates['driverName'] = driverName;
  if (kdsStatus && ['new', 'preparing', 'ready', 'served'].includes(kdsStatus)) {
    updates['kdsStatus'] = kdsStatus;
  }
  if (Object.keys(updates).length === 1) throw new AppError('Aucune mise à jour valide.', 400);

  const db = getFirestore();
  const ref = db.doc(
    `companies/${companyId}/stores/${req.params.storeId}/orders/${req.params.orderId}`,
  );
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Commande introuvable.', 404);
  const before = snap.data() as Record<string, unknown>;
  await ref.update(updates);
  logger.info('[Commerce] Order updated from admin', {
    companyId, storeId: req.params.storeId, orderId: req.params.orderId, updates,
  });

  // Notify the customer if a meaningful status changed (fire-and-forget)
  notifyCustomerOfStatusChange({
    companyId,
    customerPhone: (before['customerPhone'] as string) ?? '',
    orderNumber: (before['orderNumber'] as string) ?? req.params.orderId,
    paymentStatusBefore: before['paymentStatus'] as string | undefined,
    paymentStatusAfter: paymentStatus,
    deliveryStatusBefore: before['deliveryStatus'] as string | undefined,
    deliveryStatusAfter: deliveryStatus,
    total: (before['total'] as number) ?? 0,
    currency: (before['currency'] as string) ?? 'XOF',
  }).catch(err => logger.warn('[Commerce] Customer status notification failed', { error: String(err) }));

  res.json({ success: true });
}));

async function notifyCustomerOfStatusChange(args: {
  companyId: string;
  customerPhone: string;
  orderNumber: string;
  paymentStatusBefore?: string;
  paymentStatusAfter?: string;
  deliveryStatusBefore?: string;
  deliveryStatusAfter?: string;
  total: number;
  currency: string;
}): Promise<void> {
  if (!args.customerPhone) return;
  const { whatsappService } = await import('../services/whatsapp/whatsappService');
  const cfg = await whatsappService.getConfig(args.companyId).catch(() => null);
  if (!cfg) return;

  const messages: string[] = [];
  if (args.paymentStatusAfter && args.paymentStatusAfter !== args.paymentStatusBefore) {
    if (args.paymentStatusAfter === 'paid') {
      messages.push(`💰 *Paiement confirmé* — commande n°${args.orderNumber}\n\nMerci ! Le marchand prépare ton colis pour la livraison.`);
    } else if (args.paymentStatusAfter === 'failed') {
      messages.push(`⚠️ Le paiement de ta commande n°${args.orderNumber} n'a pas été confirmé. Le marchand va te recontacter.`);
    }
  }
  if (args.deliveryStatusAfter && args.deliveryStatusAfter !== args.deliveryStatusBefore) {
    if (args.deliveryStatusAfter === 'preparing') {
      messages.push(`📦 *Commande en préparation* — n°${args.orderNumber}\n\nLe marchand prépare ton colis.`);
    } else if (args.deliveryStatusAfter === 'shipped') {
      messages.push(`🚚 *Commande expédiée* — n°${args.orderNumber}\n\nTon colis est en route ! Le marchand te contactera pour la remise.`);
    } else if (args.deliveryStatusAfter === 'delivered') {
      messages.push(`✅ *Commande livrée* — n°${args.orderNumber}\n\nMerci pour ta confiance ! N'hésite pas à revenir voir le catalogue. 🛍️`);
    }
  }
  for (const msg of messages) {
    await whatsappService.sendMessage(cfg, args.customerPhone, msg).catch(() => null);
  }
  if (messages.length > 0) {
    logger.info('[Commerce] Customer notified of status change', {
      companyId: args.companyId, orderNumber: args.orderNumber, count: messages.length,
    });
  }
}

// ── POST /api/commerce/stores/:storeId/products/ai-draft ───────────────────
// Agent Catalogue — generate a full editable product draft from minimal owner
// input (photo + optional text/price/url). Doesn't save — returns the draft
// for the owner to review then POST to /products normally.
router.post('/stores/:storeId/products/ai-draft', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { imageBase64, imageMimeType, freeText, productUrl, price, stockQty } = req.body as {
    imageBase64?: string; imageMimeType?: string;
    freeText?: string; productUrl?: string;
    price?: number; stockQty?: number;
  };

  // At least one input required
  if (!imageBase64 && !freeText && !productUrl) {
    throw new AppError('Fournis au moins une photo, un texte libre ou un lien produit.', 400);
  }

  const storeSnap = await getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`).get().catch(() => null);
  if (!storeSnap?.exists) throw new AppError('Boutique introuvable.', 404);
  const storeCurrency = (storeSnap.data() as { currency?: string }).currency ?? 'XOF';

  const { generateProductDraft } = await import('../agents/commerce.agent');
  const draft = await generateProductDraft({
    imageBuffer: imageBase64 ? Buffer.from(imageBase64, 'base64') : undefined,
    mimeType: imageMimeType,
    freeText,
    productUrl,
    basePrice: typeof price === 'number' ? price : undefined,
    currency: storeCurrency,
    stockQty,
  });
  if (!draft) throw new AppError('Génération IA échouée. Réessaie ou ajoute plus de contexte.', 500);
  res.json({ success: true, draft });
}));

// ── POST /api/commerce/stores/:storeId/products — manual product creation ───
// Owner can add a product from the admin dashboard with name + price + optional
// description / stock / variants / image (base64 → Firebase Storage).
router.post('/stores/:storeId/products', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const {
    name, price, description, stockQty, category,
    imageBase64, imageMimeType, variants, durationMinutes,
    surfaceM2, bedrooms, bathrooms, propertyType, listingType, address,
  } = req.body as {
    name?: string; price?: number;
    description?: string; stockQty?: number; category?: string;
    imageBase64?: string; imageMimeType?: string;
    variants?: Array<{ name: string; size?: string; color?: string }>;
    durationMinutes?: number;  // For service-type stores
    // Real estate fields
    surfaceM2?: number; bedrooms?: number; bathrooms?: number;
    propertyType?: 'apartment' | 'house' | 'villa' | 'studio' | 'office' | 'land' | 'other';
    listingType?: 'sale' | 'rent';
    address?: string;
  };

  if (!name || name.trim().length < 2) throw new AppError('Nom requis (min 2 caractères).', 400);
  if (typeof price !== 'number' || price <= 0) throw new AppError('Prix invalide.', 400);

  const db = getFirestore();
  const storeSnap = await db.doc(`companies/${companyId}/stores/${req.params.storeId}`).get();
  if (!storeSnap.exists) throw new AppError('Boutique introuvable.', 404);
  const store = storeSnap.data() as Record<string, unknown>;
  const currency = (store['currency'] as string) ?? 'XOF';

  // Optional image upload to Firebase Storage
  let imageUrl: string | undefined;
  if (imageBase64) {
    try {
      const { getStorage } = await import('../config/firebase.config');
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
      if (buffer.length > 8 * 1024 * 1024) throw new AppError('Image trop lourde (max 8 Mo).', 413);
      const mime = imageMimeType ?? 'image/jpeg';
      const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
      const { randomBytes } = await import('crypto');
      const fileName = `companies/${companyId}/stores/${req.params.storeId}/products/${randomBytes(8).toString('hex')}.${ext}`;
      const bucket = getStorage().bucket();
      await bucket.file(fileName).save(buffer, {
        metadata: { contentType: mime },
        public: true,
      });
      imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } catch (err) {
      logger.warn('[Commerce] Manual upload failed (non-blocking)', { error: String(err) });
    }
  }

  const ref = db.collection(`companies/${companyId}/stores/${req.params.storeId}/products`).doc();
  const product = {
    name: name.trim(),
    price: Math.round(price),
    currency,
    description: description?.trim() ?? '',
    stockQty: typeof stockQty === 'number' ? Math.max(0, Math.round(stockQty)) : 1,
    status: 'active' as const,
    createdBy: 'admin' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(imageUrl ? { imageUrl } : {}),
    ...(category && category.trim() ? { category: category.trim() } : {}),
    ...((req.body as { subcategory?: string }).subcategory ? { subcategory: String((req.body as { subcategory?: string }).subcategory).trim().slice(0, 60) } : {}),
    ...(Array.isArray(variants) && variants.length > 0 ? { variants: variants.slice(0, 20) } : {}),
    ...(typeof durationMinutes === 'number' && durationMinutes > 0 ? { durationMinutes: Math.round(durationMinutes) } : {}),
    ...(typeof surfaceM2 === 'number' && surfaceM2 > 0 ? { surfaceM2: Math.round(surfaceM2) } : {}),
    ...(typeof bedrooms === 'number' && bedrooms >= 0 ? { bedrooms: Math.round(bedrooms) } : {}),
    ...(typeof bathrooms === 'number' && bathrooms >= 0 ? { bathrooms: Math.round(bathrooms) } : {}),
    ...(propertyType ? { propertyType } : {}),
    ...(listingType ? { listingType } : {}),
    ...(address && address.trim() ? { address: address.trim() } : {}),
  };
  await ref.set(product);

  logger.info('[Commerce] Product created manually', {
    companyId, storeId: req.params.storeId, productId: ref.id, name: product.name,
  });

  // Fire-and-forget Meta Catalog mirror (no-op if no catalog linked).
  void syncProductToMeta(companyId, req.params.storeId, ref.id, product);

  res.status(201).json({
    success: true,
    productId: ref.id,
    product: { id: ref.id, ...product },
  });
}));

// ── POST /api/commerce/stores/:storeId/products/bulk-csv ─────────────────────
// Bulk-import products from a CSV string.
// Expected columns (case-insensitive, accents OK): nom, prix, description, stock, categorie, image_url
router.post('/stores/:storeId/products/bulk-csv', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { csvText } = req.body as { csvText?: string };
  if (!csvText || csvText.trim().length < 10) throw new AppError('CSV vide ou invalide.', 400);

  const Papa = (await import('papaparse')).default;
  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true, skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip accents
      .replace(/[^a-z0-9_]/g, '_'),
  });
  if (parsed.errors && parsed.errors.length > 0) {
    logger.warn('[Commerce] CSV parse warnings', { errors: parsed.errors.slice(0, 5) });
  }

  const db = getFirestore();
  const storeRef = db.doc(`companies/${companyId}/stores/${req.params.storeId}`);
  const storeSnap = await storeRef.get();
  if (!storeSnap.exists) throw new AppError('Boutique introuvable.', 404);
  const store = storeSnap.data() as Record<string, unknown>;
  const currency = (store['currency'] as string) ?? 'XOF';

  // Map CSV rows → product docs. Validate each.
  const created: string[] = [];
  const failed: Array<{ row: number; reason: string; data: unknown }> = [];

  // Use a writeBatch for atomicity (max 500 ops / batch — should be enough)
  const batch = db.batch();
  const productsCol = db.collection(`companies/${companyId}/stores/${req.params.storeId}/products`);

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const name = (row['nom'] ?? row['name'] ?? row['title'] ?? '').toString().trim();
    const priceStr = (row['prix'] ?? row['price'] ?? '0').toString().replace(/[^\d]/g, '');
    const price = parseInt(priceStr, 10);
    if (!name || name.length < 2) { failed.push({ row: i + 1, reason: 'Nom manquant', data: row }); continue; }
    if (!price || price <= 0)     { failed.push({ row: i + 1, reason: 'Prix invalide', data: row }); continue; }

    const stock = (() => {
      const raw = (row['stock'] ?? row['quantite'] ?? row['quantity'] ?? '1').toString().replace(/[^\d]/g, '');
      const n = parseInt(raw, 10);
      return isNaN(n) || n < 0 ? 1 : n;
    })();

    const description = (row['description'] ?? row['desc'] ?? '').toString().trim();
    const category    = (row['categorie'] ?? row['category'] ?? '').toString().trim();
    const imageUrl    = (row['image_url'] ?? row['image'] ?? row['photo'] ?? '').toString().trim();

    const ref = productsCol.doc();
    batch.set(ref, {
      name, price: Math.round(price), currency,
      description, stockQty: stock,
      status: stock > 0 ? 'active' : 'out_of_stock',
      createdBy: 'csv_import',
      createdAt: new Date(), updatedAt: new Date(),
      ...(category ? { category } : {}),
      ...(imageUrl && /^https?:\/\//i.test(imageUrl) ? { imageUrl } : {}),
    });
    created.push(name);
  }

  if (created.length === 0) {
    return res.json({ success: false, created: 0, failed, message: 'Aucune ligne valide trouvée.' });
  }

  await batch.commit();
  logger.info('[Commerce] CSV bulk import', {
    companyId, storeId: req.params.storeId, created: created.length, failed: failed.length,
  });

  res.json({
    success: true,
    created: created.length,
    failed,
    sample: created.slice(0, 5),
  });
}));

// ── POST /api/commerce/stores/:storeId/products/bulk-analyze ─────────────────
// Multi-photo: each image → Gemini Vision proposes { name, price, category, description }.
// Returns the proposals so the client can show a confirmable table BEFORE creating.
router.post('/stores/:storeId/products/bulk-analyze', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { images } = req.body as {
    images?: Array<{ base64: string; mimeType?: string; suggestedName?: string }>;
  };
  if (!Array.isArray(images) || images.length === 0) throw new AppError('Aucune image fournie.', 400);
  if (images.length > 25) throw new AppError('Max 25 images par lot.', 400);

  const storeSnap = await getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`).get();
  if (!storeSnap.exists) throw new AppError('Boutique introuvable.', 404);
  const currency = ((storeSnap.data() as Record<string, unknown>)['currency'] as string) ?? 'XOF';

  const { analyzeProductImage } = await import('../agents/commerce.agent');
  const proposals: Array<{
    index: number;
    name?: string; price?: number; category?: string;
    description?: string; colors?: string[]; tags?: string[];
    confidence?: 'high' | 'medium' | 'low';
    error?: string;
  }> = [];

  // Run vision in parallel, batch of 5 to avoid rate-limiting
  const BATCH = 5;
  for (let i = 0; i < images.length; i += BATCH) {
    const batch = images.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (img, k) => {
      const idx = i + k;
      try {
        const buffer = Buffer.from(img.base64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
        if (buffer.length === 0) return { index: idx, error: 'Image vide' };
        const mime = img.mimeType ?? 'image/jpeg';
        const name = img.suggestedName ?? 'Produit';
        const analysis = await analyzeProductImage(buffer, mime, name);
        if (!analysis) return { index: idx, error: 'Analyse échouée' };
        return {
          index: idx,
          name: img.suggestedName ?? analysis.tags?.[0] ?? analysis.category ?? 'Produit',
          price: 0, // Owner will set this — we don't guess prices, too risky
          category: analysis.category,
          description: analysis.description,
          colors: analysis.colors,
          tags: analysis.tags,
          confidence: analysis.confidence,
        };
      } catch (err) {
        return { index: idx, error: err instanceof Error ? err.message : String(err) };
      }
    }));
    proposals.push(...results);
  }

  res.json({ success: true, currency, proposals });
}));

// ── POST /api/commerce/stores/:storeId/products/bulk-create ──────────────────
// Commit validated proposals as products. Each item can include base64 image
// (will upload to Storage) or a pre-existing imageUrl.
router.post('/stores/:storeId/products/bulk-create', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { products } = req.body as {
    products?: Array<{
      name: string; price: number; description?: string; stockQty?: number; category?: string;
      imageBase64?: string; imageMimeType?: string; imageUrl?: string;
    }>;
  };
  if (!Array.isArray(products) || products.length === 0) throw new AppError('Aucun produit fourni.', 400);
  if (products.length > 50) throw new AppError('Max 50 produits par lot.', 400);

  const db = getFirestore();
  const storeSnap = await db.doc(`companies/${companyId}/stores/${req.params.storeId}`).get();
  if (!storeSnap.exists) throw new AppError('Boutique introuvable.', 404);
  const store = storeSnap.data() as Record<string, unknown>;
  const currency = (store['currency'] as string) ?? 'XOF';

  const { getStorage } = await import('../config/firebase.config');
  const { randomBytes } = await import('crypto');

  const created: string[] = [];
  const failed: Array<{ index: number; reason: string }> = [];
  // Track (id, snapshot) pairs to fire Meta Catalog sync once the batch commits.
  type SyncShape = Parameters<typeof syncProductToMeta>[3];
  const toSync: Array<{ id: string; product: SyncShape }> = [];

  // Upload images first (in parallel batches), then write all products in one batch
  const productsCol = db.collection(`companies/${companyId}/stores/${req.params.storeId}/products`);
  const writeBatch = db.batch();

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (!p.name || p.name.trim().length < 2) { failed.push({ index: i, reason: 'Nom manquant' }); continue; }
    if (!p.price || p.price <= 0)             { failed.push({ index: i, reason: 'Prix invalide' }); continue; }

    let imageUrl = p.imageUrl;
    if (p.imageBase64) {
      try {
        const buffer = Buffer.from(p.imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
        if (buffer.length > 8 * 1024 * 1024) { failed.push({ index: i, reason: 'Image > 8 Mo' }); continue; }
        const mime = p.imageMimeType ?? 'image/jpeg';
        const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
        const fileName = `companies/${companyId}/stores/${req.params.storeId}/products/${randomBytes(8).toString('hex')}.${ext}`;
        const bucket = getStorage().bucket();
        await bucket.file(fileName).save(buffer, {
          metadata: { contentType: mime }, public: true,
        });
        imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      } catch (err) {
        logger.warn('[Commerce] Bulk-create image upload failed', { index: i, error: String(err) });
        // Continue without image
      }
    }

    const stock = typeof p.stockQty === 'number' && p.stockQty >= 0 ? Math.round(p.stockQty) : 1;
    const ref = productsCol.doc();
    const productDoc = {
      name: p.name.trim(),
      price: Math.round(p.price),
      currency,
      description: (p.description ?? '').trim(),
      stockQty: stock,
      status: (stock > 0 ? 'active' : 'out_of_stock') as 'active' | 'out_of_stock',
      createdBy: 'bulk_import',
      createdAt: new Date(), updatedAt: new Date(),
      ...(p.category && p.category.trim() ? { category: p.category.trim() } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    };
    writeBatch.set(ref, productDoc);
    created.push(p.name.trim());
    toSync.push({ id: ref.id, product: productDoc });
  }

  if (created.length === 0) {
    return res.json({ success: false, created: 0, failed, message: 'Aucun produit valide.' });
  }

  await writeBatch.commit();
  logger.info('[Commerce] Bulk create', {
    companyId, storeId: req.params.storeId, created: created.length, failed: failed.length,
  });

  // Fire-and-forget Meta sync for each created product (no-op if no catalog).
  for (const item of toSync) {
    void syncProductToMeta(companyId, req.params.storeId, item.id, item.product);
  }

  res.json({ success: true, created: created.length, failed, sample: created.slice(0, 5) });
}));

// ── PATCH /api/commerce/stores/:storeId/products/:productId ──────────────────
// Update product status / stock from the admin dashboard.
router.patch('/stores/:storeId/products/:productId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { name, price, description, stockQty, status, category, imageBase64, imageMimeType, durationMinutes,
    surfaceM2, bedrooms, bathrooms, propertyType, listingType, address, featured, examplePhotos,
    listingCategory, roomType, maxGuests, childrenFreeUnder, allowExtraGuests, maxExtraGuests,
    city, neighborhood, country, affiliateUrl, useContactForm, instantBooking, amenities,
    videoUrl, longDescription: prodLongDescription,
  } = req.body as {
    name?: string; price?: number; description?: string;
    stockQty?: number; status?: 'draft' | 'active' | 'out_of_stock' | 'archived';
    category?: string;
    imageBase64?: string; imageMimeType?: string;
    durationMinutes?: number;
    surfaceM2?: number; bedrooms?: number; bathrooms?: number;
    propertyType?: string; listingType?: string; address?: string;
    featured?: boolean;
    examplePhotos?: string[];
    listingCategory?: string;
    roomType?: 'entire' | 'private_room' | 'shared_room';
    maxGuests?: number;
    childrenFreeUnder?: number;
    allowExtraGuests?: boolean;
    maxExtraGuests?: number;
    city?: string;
    neighborhood?: string;
    country?: string;
    affiliateUrl?: string;
    useContactForm?: boolean;
    instantBooking?: boolean;
    amenities?: string[];
    videoUrl?: string;
    longDescription?: string;
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof name === 'string' && name.trim().length >= 2) updates['name'] = name.trim();
  if (typeof price === 'number' && price >= 0) updates['price'] = price;
  if (typeof description === 'string') updates['description'] = description.trim();
  if (typeof stockQty === 'number' && stockQty >= 0) updates['stockQty'] = stockQty;
  if (status && ['draft', 'active', 'out_of_stock', 'archived'].includes(status)) updates['status'] = status;
  if (typeof category === 'string') updates['category'] = category.trim();
  if (typeof durationMinutes === 'number' && durationMinutes >= 0) updates['durationMinutes'] = Math.round(durationMinutes);
  if (typeof surfaceM2 === 'number' && surfaceM2 >= 0) updates['surfaceM2'] = Math.round(surfaceM2);
  if (typeof bedrooms === 'number' && bedrooms >= 0) updates['bedrooms'] = Math.round(bedrooms);
  if (typeof bathrooms === 'number' && bathrooms >= 0) updates['bathrooms'] = Math.round(bathrooms);
  if (typeof propertyType === 'string') updates['propertyType'] = propertyType;
  if (typeof listingType === 'string') updates['listingType'] = listingType;
  if (typeof address === 'string') updates['address'] = address.trim();
  if (typeof featured === 'boolean') updates['featured'] = featured;
  if (typeof videoUrl === 'string') {
    const u = videoUrl.trim();
    if (u === '' || /^https?:\/\//i.test(u)) updates['videoUrl'] = u;
  }
  if (typeof prodLongDescription === 'string') updates['longDescription'] = prodLongDescription.trim().slice(0, 4000);
  if (typeof listingCategory === 'string') updates['listingCategory'] = listingCategory.trim().slice(0, 60);
  if (roomType === 'entire' || roomType === 'private_room' || roomType === 'shared_room') updates['roomType'] = roomType;
  if (typeof maxGuests === 'number' && maxGuests >= 1 && maxGuests <= 50) updates['maxGuests'] = Math.round(maxGuests);
  if (typeof childrenFreeUnder === 'number' && childrenFreeUnder >= 0 && childrenFreeUnder <= 18) updates['childrenFreeUnder'] = Math.round(childrenFreeUnder);
  if (typeof allowExtraGuests === 'boolean') updates['allowExtraGuests'] = allowExtraGuests;
  if (typeof maxExtraGuests === 'number' && maxExtraGuests >= 0 && maxExtraGuests <= 20) updates['maxExtraGuests'] = Math.round(maxExtraGuests);
  if (typeof city === 'string') updates['city'] = city.trim().slice(0, 80);
  if (typeof neighborhood === 'string') updates['neighborhood'] = neighborhood.trim().slice(0, 80);
  if (typeof country === 'string') updates['country'] = country.trim().toUpperCase().slice(0, 2);
  if (typeof affiliateUrl === 'string') {
    const u = affiliateUrl.trim();
    if (u === '' || /^https?:\/\//i.test(u)) updates['affiliateUrl'] = u;
  }
  if (typeof useContactForm === 'boolean') updates['useContactForm'] = useContactForm;
  if (typeof instantBooking === 'boolean') updates['instantBooking'] = instantBooking;
  if (Array.isArray(amenities)) {
    updates['amenities'] = amenities
      .filter(a => typeof a === 'string' && a.trim().length > 0)
      .map(a => (a as string).trim().slice(0, 40))
      .slice(0, 30);
  }
  if (Array.isArray(examplePhotos)) {
    // Accept both legacy string[] and new {url, consentForAI, label}[] forms.
    // Normalize to the object form. Photos without explicit consentForAI:true
    // can still be displayed in the public gallery, but the AI face-preview
    // endpoint will refuse to use them as style references.
    const cleaned: Array<{ url: string; consentForAI: boolean; label?: string }> = [];
    for (const entry of examplePhotos.slice(0, 12)) {
      if (typeof entry === 'string' && /^https?:\/\//i.test(entry)) {
        cleaned.push({ url: entry, consentForAI: false });
      } else if (entry && typeof entry === 'object') {
        const e = entry as { url?: unknown; consentForAI?: unknown; label?: unknown };
        if (typeof e.url === 'string' && /^https?:\/\//i.test(e.url)) {
          cleaned.push({
            url: e.url,
            consentForAI: e.consentForAI === true,
            ...(typeof e.label === 'string' && e.label.length > 0 ? { label: e.label.slice(0, 80) } : {}),
          });
        }
      }
    }
    updates['examplePhotos'] = cleaned;
  }

  // Optional image replacement (base64 → Storage). Non-fatal on failure.
  if (imageBase64) {
    try {
      const { getStorage } = await import('../config/firebase.config');
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
      if (buffer.length > 8 * 1024 * 1024) throw new AppError('Image trop lourde (max 8 Mo).', 413);
      const mime = imageMimeType ?? 'image/jpeg';
      const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
      const { randomBytes } = await import('crypto');
      const fileName = `companies/${companyId}/stores/${req.params.storeId}/products/${randomBytes(8).toString('hex')}.${ext}`;
      const bucket = getStorage().bucket();
      await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
      updates['imageUrl'] = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } catch (err) {
      logger.warn('[Commerce] PATCH image upload failed', { error: String(err) });
    }
  }

  if (Object.keys(updates).length === 1) throw new AppError('Aucune mise à jour valide.', 400);

  const productRef = getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/products/${req.params.productId}`);
  // Capture previous state for restock-interest detection.
  const prevSnap = await productRef.get();
  const prevStatus = prevSnap.exists ? (prevSnap.data() as Record<string, unknown>)['status'] : undefined;

  await productRef.update(updates);

  // Re-fetch the merged product and mirror to Meta (fire-and-forget).
  const fresh = await productRef.get();
  if (fresh.exists) {
    const data = fresh.data() as Record<string, unknown>;
    void syncProductToMeta(companyId, req.params.storeId, req.params.productId, {
      name: String(data['name'] ?? ''),
      price: Number(data['price'] ?? 0),
      currency: String(data['currency'] ?? 'XOF'),
      description: data['description'] as string | undefined,
      imageUrl: data['imageUrl'] as string | undefined,
      stockQty: Number(data['stockQty'] ?? 0),
      status: data['status'] as 'draft' | 'active' | 'out_of_stock' | 'archived' | undefined,
    });

    // If the product just transitioned to active, ping anyone waiting.
    const newStatus = data['status'];
    if (prevStatus !== 'active' && newStatus === 'active') {
      const { notifyRestockInterests } = await import('../agents/commerce.agent');
      void notifyRestockInterests(companyId, req.params.storeId, req.params.productId);
    }
  }

  res.json({ success: true });
}));

// ── DELETE /api/commerce/stores/:storeId/products/:productId ────────────────
// Remove a product from Boutique + Meta Catalog.
router.delete('/stores/:storeId/products/:productId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/products/${req.params.productId}`)
    .delete();

  void deleteProductFromMeta(companyId, req.params.productId);

  res.json({ success: true });
}));

// ── POST /api/commerce/stores/:storeId/import-from-meta ─────────────────────
// One-shot import: pull existing Meta Catalog products into the Boutique.
// Useful for merchants migrating from Meta-only.
router.post('/stores/:storeId/import-from-meta', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const result = await importFromMetaCatalog(companyId, req.params.storeId);
  res.json({ success: true, ...result });
}));

// ── GET /api/commerce/stores/:storeId/customers ──────────────────────────────
router.get('/stores/:storeId/customers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/customers`)
    .orderBy('lastOrderAt', 'desc')
    .limit(500).get().catch(() => null);
  const customers = (snap?.docs ?? []).map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, customers });
}));

// ── POST /api/commerce/stores/:storeId/broadcast ─────────────────────────────
// Send a free-text WhatsApp broadcast to all (or a subset of) Boutique customers.
// Optionally attach product info (name + price + image link).
router.post('/stores/:storeId/broadcast', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { message, productId, customerPhones } = req.body as {
    message?: string;
    productId?: string;
    customerPhones?: string[];   // optional subset; default = all
  };

  if (!message || message.trim().length < 5) {
    throw new AppError('Message trop court (min 5 caractères).', 400);
  }
  if (message.length > 1000) {
    throw new AppError('Message trop long (max 1000 caractères).', 400);
  }

  const db = getFirestore();
  const storeId = req.params.storeId;

  // Resolve store + currency for product price formatting
  const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
  if (!storeSnap.exists) throw new AppError('Boutique introuvable.', 404);
  const storeData = storeSnap.data() as Record<string, unknown>;
  const currency = (storeData['currency'] as string) ?? 'XOF';

  // Optional product attachment: build the formatted block
  let productBlock = '';
  let productImageUrl: string | undefined;
  if (productId) {
    const pSnap = await db.doc(`companies/${companyId}/stores/${storeId}/products/${productId}`).get();
    if (pSnap.exists) {
      const p = pSnap.data() as Record<string, unknown>;
      const price = (p['price'] as number) ?? 0;
      productBlock =
        `\n\n📦 *${p['name']}* — ${price.toLocaleString('fr-FR')} ${currency}\n` +
        ((p['description'] as string) ? `${p['description']}\n` : '');
      productImageUrl = (p['imageUrl'] as string | undefined) ?? undefined;
    }
  }

  // Resolve customers list (subset or all)
  let customers: Array<{ phone: string; name?: string }> = [];
  if (Array.isArray(customerPhones) && customerPhones.length > 0) {
    customers = customerPhones.map(p => ({ phone: p }));
  } else {
    const snap = await db.collection(`companies/${companyId}/stores/${storeId}/customers`)
      .limit(500).get();
    customers = snap.docs.map(d => {
      const data = d.data();
      return { phone: (data['phone'] as string) ?? '', name: (data['name'] as string) };
    }).filter(c => !!c.phone);
  }
  if (customers.length === 0) {
    throw new AppError('Aucun client à contacter.', 400);
  }

  // Slug for shop link
  const { ensureStoreSlug } = await import('../agents/commerce.agent');
  const slug = await ensureStoreSlug(companyId, storeId, storeData as never).catch(() => null);
  const shopLink = slug
    ? `${process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app'}/shop/${slug}`
    : `${process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app'}/shop/${companyId}/${storeId}`;

  const finalMessage = `${message.trim()}${productBlock}\n\n🛍️ ${shopLink}`;

  // Record broadcast doc + send (rate-limited to 1 per second)
  const { whatsappService } = await import('../services/whatsapp/whatsappService');
  const cfg = await whatsappService.getConfig(companyId).catch(() => null);
  if (!cfg) throw new AppError('WhatsApp non configuré pour cette entreprise.', 412);

  const broadcastRef = db.collection(`companies/${companyId}/whatsappBroadcasts`).doc();
  await broadcastRef.set({
    source: 'boutique',
    storeId,
    message: message.trim(),
    productId: productId ?? null,
    productImageUrl: productImageUrl ?? null,
    targetCount: customers.length,
    sentCount: 0,
    failedCount: 0,
    status: 'sending',
    createdAt: new Date(),
    createdBy: req.user?.uid ?? null,
  });

  // Reply immediately so the UI doesn't hang on long sends
  res.json({ success: true, broadcastId: broadcastRef.id, targetCount: customers.length });

  // Fire-and-forget the actual sends
  (async () => {
    let sent = 0; let failed = 0;
    for (const c of customers) {
      try {
        if (productImageUrl) {
          // Try image+caption when supported, else fall back to text
          await whatsappService.sendMessage(cfg, c.phone, finalMessage);
        } else {
          await whatsappService.sendMessage(cfg, c.phone, finalMessage);
        }
        sent++;
      } catch (err) {
        failed++;
        logger.warn('[Commerce] Broadcast send failed', { to: c.phone, error: String(err) });
      }
      // Rate limit: 1 send per second to stay friendly with Meta throttling
      await new Promise(r => setTimeout(r, 1000));
    }
    await broadcastRef.update({
      sentCount: sent, failedCount: failed,
      status: 'completed', completedAt: new Date(),
    }).catch(() => null);
    logger.info('[Commerce] Broadcast complete', {
      broadcastId: broadcastRef.id, sent, failed, total: customers.length,
    });
  })().catch(err => logger.error('[Commerce] Broadcast worker crashed', { error: String(err) }));
}));

// ════════════════════════════════════════════════════════════════════════════
// HEALTH — Phase 1 minimal (patients + consultations).
// Sensitive data — kept in a dedicated `patients` subcollection (no mix with
// commerce customers). Consultations reuse the `reservations` collection with
// patientId + reason fields.
// ════════════════════════════════════════════════════════════════════════════

interface Patient {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  birthDate?: string;       // YYYY-MM-DD
  gender?: 'M' | 'F' | 'other';
  address?: string;
  bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  allergies?: string;        // free text
  chronicConditions?: string;// "Hypertension, Diabète type 2"
  emergencyContact?: string;
  medicalNotes?: string;     // private notes from practitioner
  createdAt: Date;
  updatedAt: Date;
}

// GET /api/commerce/stores/:storeId/patients
router.get('/stores/:storeId/patients', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/patients`)
    .orderBy('lastName').limit(500).get().catch(() => null);
  const patients = (snap?.docs ?? []).map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, patients });
}));

// POST /api/commerce/stores/:storeId/patients
router.post('/stores/:storeId/patients', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const {
    firstName, lastName, phone, email, birthDate, gender,
    address, bloodType, allergies, chronicConditions, emergencyContact, medicalNotes,
  } = req.body as Partial<Patient>;
  if (!firstName || firstName.trim().length < 1) throw new AppError('Prénom requis.', 400);
  if (!lastName || lastName.trim().length < 1) throw new AppError('Nom requis.', 400);
  if (!phone || phone.length < 6) throw new AppError('Téléphone requis.', 400);

  const ref = getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/patients`).doc();
  const patient: Patient = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone.trim(),
    email: email?.trim(),
    birthDate,
    gender,
    address: address?.trim(),
    bloodType,
    allergies: allergies?.trim(),
    chronicConditions: chronicConditions?.trim(),
    emergencyContact: emergencyContact?.trim(),
    medicalNotes: medicalNotes?.trim(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await ref.set(patient);
  res.status(201).json({ success: true, patientId: ref.id, patient: { id: ref.id, ...patient } });
}));

// PATCH /api/commerce/stores/:storeId/patients/:patientId
router.patch('/stores/:storeId/patients/:patientId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const allowed = [
    'firstName', 'lastName', 'phone', 'email', 'birthDate', 'gender',
    'address', 'bloodType', 'allergies', 'chronicConditions', 'emergencyContact', 'medicalNotes',
  ];
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (k in body) updates[k] = body[k];
  if (Object.keys(updates).length === 1) throw new AppError('Aucune mise à jour valide.', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/patients/${req.params.patientId}`)
    .update(updates);
  res.json({ success: true });
}));

// DELETE /api/commerce/stores/:storeId/patients/:patientId
router.delete('/stores/:storeId/patients/:patientId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/patients/${req.params.patientId}`)
    .delete();
  res.json({ success: true });
}));

// ════════════════════════════════════════════════════════════════════════════
// HOTEL — Phase 1 minimal (chambres + séjours).
// Rooms live in a dedicated subcollection (cleaner than abusing products).
// Stays use the existing `reservations` collection with extra fields
// (roomId, checkOutDate). Same WhatsApp pipeline as boutique/restaurant.
// ════════════════════════════════════════════════════════════════════════════

interface Room {
  id?: string;
  number: string;          // "101", "Suite Deluxe"
  type: 'single' | 'double' | 'twin' | 'triple' | 'suite' | 'family'
       | 'studio' | 'f2' | 'f3' | 'f4' | 'duplex' | 'loft'; // residence types
  capacity: number;
  pricePerNight: number;
  priceWeek?: number;      // residence long-stay
  priceMonth?: number;     // residence long-stay
  currency: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
  description?: string;
  imageUrl?: string;
  amenities?: string[];    // ['wifi', 'breakfast', 'ac', 'tv', 'minibar', 'kitchenette', 'washer', 'parking']
  floor?: number;
  name?: string;           // "Studio Lagune", "F2 Riviera"
  createdAt: Date;
  updatedAt: Date;
}

// ── Meta Ads — admin config + test connection ─────────────────────────────
// Used to satisfy Meta's "make 1 successful API call before requesting
// advanced access" requirement on the ads_management permission.
router.get('/admin/meta-ads/config', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().doc(`companies/${companyId}/integrations/metaAds`).get();
  const waSnap = await getFirestore().doc(`companies/${companyId}/integrations/whatsapp`).get();
  const ads = snap.exists ? snap.data() as { adAccountId?: string; pageId?: string } : {};
  const wa = waSnap.exists ? waSnap.data() as { displayPhoneNumber?: string; pageId?: string } : {};
  res.json({
    success: true,
    adAccountId: ads?.adAccountId ?? '',
    pageId: ads?.pageId ?? wa?.pageId ?? '',
    whatsappLinked: !!wa?.displayPhoneNumber,
  });
}));

router.post('/admin/meta-ads/config', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { adAccountId, pageId } = req.body as { adAccountId?: string; pageId?: string };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof adAccountId === 'string') {
    const cleaned = adAccountId.trim().replace(/^act_/, '');
    if (cleaned && !/^\d+$/.test(cleaned)) throw new AppError('adAccountId doit être numérique (sans préfixe act_).', 400);
    updates['adAccountId'] = cleaned;
  }
  if (typeof pageId === 'string') {
    const cleaned = pageId.trim();
    if (cleaned && !/^\d+$/.test(cleaned)) throw new AppError('pageId doit être numérique.', 400);
    updates['pageId'] = cleaned;
  }
  await getFirestore().doc(`companies/${companyId}/integrations/metaAds`).set(updates, { merge: true });
  res.json({ success: true });
}));

router.post('/admin/meta-ads/test', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { getMetaAdsConfig, listCampaigns } = await import('../services/metaAds/metaAdsService');
  const cfg = await getMetaAdsConfig(companyId);
  if (!cfg) {
    return res.json({
      success: false,
      reason: 'no_config',
      message: 'Pas de configuration Meta Ads. Renseigne adAccountId d\'abord (et que ton token WhatsApp BSP ait le scope ads_management).',
    });
  }
  try {
    const list = await listCampaigns(cfg, 5);
    return res.json({
      success: true,
      campaignCount: list.length,
      sampleCampaigns: list.slice(0, 3).map(c => ({ id: c.id, name: c.name, status: c.effective_status ?? c.status })),
      message: `✅ Connexion Meta Ads OK — ${list.length} campagne(s) lue(s). Le bouton "Demander l'accès avancé" sera actif sur Meta sous 24h.`,
    });
  } catch (e: any) {
    return res.json({
      success: false,
      reason: 'api_error',
      error: String(e?.message ?? e),
      message: `❌ Échec : ${e?.message ?? 'Erreur Meta API'}. Vérifie le scope ads_management du token + l'adAccountId.`,
    });
  }
}));

// ── iCal sync — owner-side endpoints to get/regenerate the calendar URL ──
router.get('/stores/:storeId/ical', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Store introuvable.', 404);
  const data = snap.data() as { icalToken?: string };
  let token = data.icalToken;
  if (!token) {
    // Auto-generate on first read (owner-triggered creation)
    const { randomBytes } = await import('crypto');
    token = randomBytes(24).toString('hex');
    await ref.set({ icalToken: token }, { merge: true });
  }
  const baseUrl = process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app';
  res.json({
    success: true,
    url: `${baseUrl}/api/public/calendar/${req.params.storeId}.ics?token=${token}`,
    token,
  });
}));

router.post('/stores/:storeId/ical/regenerate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { randomBytes } = await import('crypto');
  const token = randomBytes(24).toString('hex');
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}`)
    .set({ icalToken: token }, { merge: true });
  const baseUrl = process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app';
  res.json({
    success: true,
    url: `${baseUrl}/api/public/calendar/${req.params.storeId}.ics?token=${token}`,
    token,
  });
}));

// ── iCal IMPORT (read external calendars and block their dates) ─────────────
// Supported: Booking.com, Airbnb, Google Calendar, any RFC 5545 feed.
router.get('/stores/:storeId/ical/imports', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}`).get();
  const data = snap.data() as { icalImports?: unknown[] } | undefined;
  res.json({ success: true, imports: Array.isArray(data?.icalImports) ? data.icalImports : [] });
}));

router.post('/stores/:storeId/ical/imports', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { url, name, roomId } = (req.body ?? {}) as { url?: string; name?: string; roomId?: string };
  if (!url || !/^https?:\/\//i.test(url)) throw new AppError('URL invalide.', 400);
  if (!name || name.trim().length < 2) throw new AppError('Nom requis (ex: "Airbnb", "Booking").', 400);
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`);
  const snap = await ref.get();
  const current = ((snap.data() as { icalImports?: Array<{ url: string; name: string; roomId?: string; lastSyncedAt?: Date }> })?.icalImports ?? [])
    .filter(i => i.url !== url);
  current.push({ url: url.trim(), name: name.trim(), ...(roomId ? { roomId } : {}) });
  await ref.set({ icalImports: current, updatedAt: new Date() }, { merge: true });

  // Sync immediately so user sees blocks right away
  const { syncOneFeed } = await import('../services/commerce/icalImport');
  const result = await syncOneFeed(companyId, req.params.storeId, { url: url.trim(), name: name.trim(), ...(roomId ? { roomId } : {}) });
  res.json({ success: true, imports: current, sync: result });
}));

router.delete('/stores/:storeId/ical/imports', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const url = String(req.query['url'] ?? '');
  if (!url) throw new AppError('URL requis.', 400);
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`);
  const snap = await ref.get();
  const removed = (snap.data() as { icalImports?: Array<{ url: string; name: string }> })?.icalImports?.find(i => i.url === url);
  const current = ((snap.data() as { icalImports?: Array<{ url: string; name: string }> })?.icalImports ?? [])
    .filter(i => i.url !== url);
  await ref.set({ icalImports: current, updatedAt: new Date() }, { merge: true });

  // Prune all external_blocks tied to this source
  if (removed) {
    const blocks = await getFirestore()
      .collection(`companies/${companyId}/stores/${req.params.storeId}/external_blocks`)
      .where('source', '==', removed.name).get().catch(() => null);
    if (blocks) for (const d of blocks.docs) await d.ref.delete();
  }
  res.json({ success: true, imports: current });
}));

router.post('/stores/:storeId/ical/imports/sync', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`);
  const snap = await ref.get();
  const imports = (snap.data() as { icalImports?: Array<{ url: string; name: string; roomId?: string }> })?.icalImports ?? [];
  if (imports.length === 0) {
    res.json({ success: true, results: [], message: 'Aucun feed à synchroniser.' });
    return;
  }
  const { syncOneFeed } = await import('../services/commerce/icalImport');
  const results = [];
  for (const cfg of imports) {
    results.push(await syncOneFeed(companyId, req.params.storeId, cfg));
  }
  res.json({ success: true, results });
}));

// ── Tables (restaurant/maquis service en salle) ────────────────────────────
// ── Photo retouch (Agent Catalogue) ──────────────────────────────────────
// Takes a product photo with bad background/lighting and regenerates a clean
// studio version (uniform cream backdrop, even lighting). Used by the
// "🎨 Retoucher" button in the AI Catalogue modal.
router.post('/stores/:storeId/products/retouch-photo', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { imageBase64, imageMimeType, productName, category } = req.body as {
    imageBase64?: string; imageMimeType?: string; productName?: string; category?: string;
  };
  if (!imageBase64) throw new AppError('imageBase64 required', 400);

  const inputMime = imageMimeType?.startsWith('image/') ? imageMimeType : 'image/jpeg';
  const buffer = Buffer.from(imageBase64, 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw new AppError('Image trop lourde (max 8 MB)', 400);

  const productLabel = productName ?? 'le produit';
  const catLabel = category ?? '';
  const prompt = `Tu es un retoucheur photo e-commerce premium. Reprends EXACTEMENT ${productLabel}${catLabel ? ` (${catLabel})` : ''} sur cette photo SANS rien modifier de son apparence (couleur, texture, forme, étiquette, logo). Place-le sur un fond crème uniforme (#FEF7E7), lumière studio douce, ombre portée discrète et naturelle. Cadrage centré, ratio carré. Qualité photo professionnelle e-commerce type Amazon/Jumia. NE CHANGE PAS le produit lui-même. NE redessine PAS. Garde la même perspective et le même angle.`;

  const candidates = [
    { model: 'googleai/gemini-3.0-flash-image', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-3.0-flash-image-preview', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-2.5-flash-image', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-2.5-flash-image-preview', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-2.0-flash-preview-image-generation', config: { responseModalities: ['IMAGE', 'TEXT'] } },
  ];

  const { ai } = await import('../config/genkit.config');
  type GenkitPart = { text?: string; media?: { url?: string; contentType?: string } };
  type GenkitResponse = { content?: GenkitPart[]; message?: { content?: GenkitPart[] } };
  const extractImage = (resp: GenkitResponse) => {
    const parts: GenkitPart[] = [];
    if (resp.message?.content) parts.push(...resp.message.content);
    if (resp.content) parts.push(...resp.content);
    for (const p of parts) {
      if (p?.media?.url) {
        const m = /^data:([^;]+);base64,(.+)$/.exec(p.media.url);
        if (m) return { buffer: Buffer.from(m[2] ?? '', 'base64'), contentType: m[1] ?? 'image/png' };
      }
    }
    return null;
  };

  let outBuf: Buffer | null = null;
  let outMime = 'image/png';
  const errors: string[] = [];
  for (const c of candidates) {
    try {
      const response = await ai.generate({
        model: c.model,
        prompt: [
          { media: { url: `data:${inputMime};base64,${buffer.toString('base64')}` } },
          { text: prompt },
        ],
        config: c.config,
      } as never);
      const got = extractImage(response as GenkitResponse);
      if (got) { outBuf = got.buffer; outMime = got.contentType; break; }
      errors.push(`${c.model}: no image`);
    } catch (err) {
      errors.push(`${c.model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (!outBuf) throw new AppError(`Retouche IA indisponible. Détails : ${errors[errors.length - 1] ?? 'unknown'}`, 503);

  const { getStorage } = await import('../config/firebase.config');
  const bucket = getStorage().bucket();
  const ext = outMime.includes('jpeg') ? 'jpg' : 'png';
  const storagePath = `commerce/${companyId}/${req.params.storeId}/retouched/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await bucket.file(storagePath).save(outBuf, { metadata: { contentType: outMime }, public: true });
  const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  const retouchedBase64 = outBuf.toString('base64');
  res.json({ success: true, url, imageBase64: retouchedBase64, imageMimeType: outMime });
}));

// ── Agent Insights — read-only by default, dismissible per item ──────────
// Powered by background cron jobs (stock alerts, late orders, suggestions).
router.get('/stores/:storeId/insights', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/agentInsights`)
    .where('dismissed', '==', false)
    .orderBy('createdAt', 'desc').limit(20).get().catch(() => null);
  const insights = (snap?.docs ?? []).map(d => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
    createdAt: (d.data() as { createdAt?: { toDate?: () => Date } }).createdAt?.toDate?.()?.toISOString() ?? null,
  }));
  res.json({ success: true, insights });
}));

router.patch('/stores/:storeId/insights/:insightId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { dismissed } = req.body as { dismissed?: boolean };
  if (typeof dismissed !== 'boolean') throw new AppError('dismissed required (boolean)', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/agentInsights/${req.params.insightId}`)
    .set({ dismissed, dismissedAt: dismissed ? new Date() : null, updatedAt: new Date() }, { merge: true });
  res.json({ success: true });
}));

router.get('/stores/:storeId/tables', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/tables`)
    .orderBy('number').limit(200).get().catch(() => null);
  const tables = (snap?.docs ?? []).map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, tables });
}));

router.post('/stores/:storeId/tables', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { number, capacity, zone, notes } = req.body as {
    number?: string; capacity?: number; zone?: string; notes?: string;
  };
  if (!number || number.trim().length === 0) throw new AppError('Numéro de table requis.', 400);
  if (!capacity || capacity < 1 || capacity > 50) throw new AppError('Capacité invalide (1-50).', 400);
  const ref = getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/tables`).doc();
  const table = {
    number: number.trim(),
    capacity: Math.round(capacity),
    zone: typeof zone === 'string' ? zone.trim() : 'indoor',
    status: 'available',
    notes: notes?.trim() ?? '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await ref.set(table);
  res.status(201).json({ success: true, tableId: ref.id, table: { id: ref.id, ...table } });
}));

router.patch('/stores/:storeId/tables/:tableId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { number, capacity, zone, status, notes } = req.body as {
    number?: string; capacity?: number; zone?: string;
    status?: 'available' | 'unavailable'; notes?: string;
  };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof number === 'string' && number.trim().length > 0) updates['number'] = number.trim();
  if (typeof capacity === 'number' && capacity >= 1 && capacity <= 50) updates['capacity'] = Math.round(capacity);
  if (typeof zone === 'string') updates['zone'] = zone.trim();
  if (status === 'available' || status === 'unavailable') updates['status'] = status;
  if (typeof notes === 'string') updates['notes'] = notes.trim();
  if (Object.keys(updates).length === 1) throw new AppError('Aucune mise à jour valide.', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/tables/${req.params.tableId}`)
    .update(updates);
  res.json({ success: true });
}));

router.delete('/stores/:storeId/tables/:tableId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/tables/${req.params.tableId}`)
    .delete();
  res.json({ success: true });
}));

// GET /api/commerce/stores/:storeId/rooms
router.get('/stores/:storeId/rooms', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/rooms`)
    .orderBy('number').limit(200).get().catch(() => null);
  const rooms = (snap?.docs ?? []).map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, rooms });
}));

// POST /api/commerce/stores/:storeId/rooms
router.post('/stores/:storeId/rooms', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { number, type, capacity, pricePerNight, priceWeek, priceMonth, currency, description, amenities, floor, name, imageBase64, imageMimeType } = req.body as {
    number?: string; type?: Room['type']; capacity?: number;
    pricePerNight?: number; priceWeek?: number; priceMonth?: number;
    currency?: string; description?: string; amenities?: string[];
    floor?: number; name?: string;
    imageBase64?: string; imageMimeType?: string;
  };
  if (!number || number.trim().length < 1) throw new AppError('Numéro de chambre requis.', 400);
  if (!type) throw new AppError('Type de chambre requis.', 400);
  if (!capacity || capacity < 1 || capacity > 20) throw new AppError('Capacité invalide.', 400);
  if (typeof pricePerNight !== 'number' || pricePerNight <= 0) throw new AppError('Prix par nuit invalide.', 400);

  const storeSnap = await getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`).get();
  const storeCurrency = (storeSnap.data()?.['currency'] as string | undefined) ?? 'XOF';

  // Optional photo upload (base64 → Firebase Storage)
  let imageUrl: string | undefined;
  if (imageBase64) {
    try {
      const { getStorage } = await import('../config/firebase.config');
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
      if (buffer.length > 8 * 1024 * 1024) throw new AppError('Image trop lourde (max 8 Mo).', 413);
      const mime = imageMimeType ?? 'image/jpeg';
      const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
      const { randomBytes } = await import('crypto');
      const fileName = `companies/${companyId}/stores/${req.params.storeId}/rooms/${randomBytes(8).toString('hex')}.${ext}`;
      const bucket = getStorage().bucket();
      await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
      imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } catch (err) {
      logger.warn('[Commerce] Room photo upload failed (non-blocking)', { error: String(err) });
    }
  }

  const ref = getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/rooms`).doc();
  const room: Room = {
    number: number.trim(),
    type,
    capacity: Math.round(capacity),
    pricePerNight: Math.round(pricePerNight),
    ...(typeof priceWeek === 'number' && priceWeek > 0 ? { priceWeek: Math.round(priceWeek) } : {}),
    ...(typeof priceMonth === 'number' && priceMonth > 0 ? { priceMonth: Math.round(priceMonth) } : {}),
    currency: (currency ?? storeCurrency).toUpperCase(),
    status: 'available',
    description: description?.trim(),
    amenities: Array.isArray(amenities) ? amenities.slice(0, 20) : [],
    ...(typeof floor === 'number' ? { floor: Math.round(floor) } : {}),
    ...(name && name.trim() ? { name: name.trim() } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await ref.set(room);
  res.status(201).json({ success: true, roomId: ref.id, room: { id: ref.id, ...room } });
}));

// PATCH /api/commerce/stores/:storeId/rooms/:roomId
router.patch('/stores/:storeId/rooms/:roomId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const allowed = [
    'number', 'type', 'capacity', 'pricePerNight', 'priceWeek', 'priceMonth', 'status',
    'description', 'amenities', 'imageUrl', 'floor', 'name',
    // Airbnb-style fields per room
    'roomType', 'maxGuests', 'childrenFreeUnder', 'allowExtraGuests', 'maxExtraGuests',
    'bedrooms', 'bathrooms', 'surfaceM2', 'cleaningFee',
    'instantBooking', 'useContactForm', 'affiliateUrl', 'longDescription', 'featured',
    'imageUrls',
  ];
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (k in body) updates[k] = body[k];

  // Optional new photo (base64 → Storage)
  const imageBase64 = body['imageBase64'] as string | undefined;
  if (imageBase64) {
    try {
      const { getStorage } = await import('../config/firebase.config');
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
      if (buffer.length > 8 * 1024 * 1024) throw new AppError('Image trop lourde (max 8 Mo).', 413);
      const mime = (body['imageMimeType'] as string | undefined) ?? 'image/jpeg';
      const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
      const { randomBytes } = await import('crypto');
      const fileName = `companies/${companyId}/stores/${req.params.storeId}/rooms/${randomBytes(8).toString('hex')}.${ext}`;
      const bucket = getStorage().bucket();
      await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
      updates['imageUrl'] = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } catch (err) {
      logger.warn('[Commerce] Room PATCH photo upload failed', { error: String(err) });
    }
  }

  if (Object.keys(updates).length === 1) throw new AppError('Aucune mise à jour valide.', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/rooms/${req.params.roomId}`)
    .update(updates);
  res.json({ success: true });
}));

// Constants
const MAX_GALLERY_PHOTOS = 6;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30 MB upload cap

// ── Product photo gallery (boutique / resto / salon / immo) ─────────────────
router.post('/stores/:storeId/products/:productId/photos', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { imageBase64, imageMimeType } = req.body as { imageBase64?: string; imageMimeType?: string };
  if (!imageBase64) throw new AppError('Image manquante.', 400);
  const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw new AppError('Image trop lourde (max 8 Mo).', 413);
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}/products/${req.params.productId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Produit introuvable.', 404);
  const data = snap.data() as { imageUrl?: string; imageUrls?: string[] };
  const existing = Array.isArray(data.imageUrls) && data.imageUrls.length > 0
    ? data.imageUrls
    : (data.imageUrl ? [data.imageUrl] : []);
  if (existing.length >= MAX_GALLERY_PHOTOS) {
    throw new AppError(`Maximum ${MAX_GALLERY_PHOTOS} photos par produit. Supprime-en une avant.`, 400);
  }
  const { getStorage } = await import('../config/firebase.config');
  const { randomBytes } = await import('crypto');
  const mime = imageMimeType ?? 'image/jpeg';
  const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
  const fileName = `companies/${companyId}/stores/${req.params.storeId}/products/${req.params.productId}/${randomBytes(8).toString('hex')}.${ext}`;
  const bucket = getStorage().bucket();
  await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
  const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  const updated = [...existing, url];
  await ref.set({
    imageUrls: updated,
    imageUrl: data.imageUrl ?? url,
    updatedAt: new Date(),
  }, { merge: true });
  res.json({ success: true, url, imageUrls: updated });
}));

router.delete('/stores/:storeId/products/:productId/photos', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const url = req.query['url'] as string | undefined;
  if (!url) throw new AppError('URL requis.', 400);
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}/products/${req.params.productId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Produit introuvable.', 404);
  const data = snap.data() as { imageUrl?: string; imageUrls?: string[] };
  const filtered = (data.imageUrls ?? []).filter(u => u !== url);
  const updates: Record<string, unknown> = { imageUrls: filtered, updatedAt: new Date() };
  if (data.imageUrl === url) updates['imageUrl'] = filtered[0] ?? null;
  await ref.set(updates, { merge: true });
  res.json({ success: true, imageUrls: filtered });
}));

// Set a specific URL as the primary image (move to index 0).
// Works for both products + rooms via `?subPath=products|rooms` (default products)
router.post('/stores/:storeId/:subPath(products|rooms)/:itemId/photos/primary', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { url } = req.body as { url?: string };
  if (!url) throw new AppError('URL requis.', 400);
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}/${req.params.subPath}/${req.params.itemId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Item introuvable.', 404);
  const data = snap.data() as { imageUrls?: string[] };
  const list = Array.isArray(data.imageUrls) ? data.imageUrls.filter(u => u !== url) : [];
  list.unshift(url);
  await ref.set({
    imageUrls: list,
    imageUrl: url,
    updatedAt: new Date(),
  }, { merge: true });
  res.json({ success: true, imageUrls: list });
}));

// Video upload (MP4) — separate endpoint with bigger size cap
router.post('/stores/:storeId/:subPath(products|rooms)/:itemId/video', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { videoBase64, videoMimeType, videoUrl } = req.body as { videoBase64?: string; videoMimeType?: string; videoUrl?: string };
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}/${req.params.subPath}/${req.params.itemId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Item introuvable.', 404);

  // External URL path — accept YouTube/Vimeo/MP4 link without uploading
  if (typeof videoUrl === 'string') {
    const u = videoUrl.trim();
    if (u && !/^https?:\/\//i.test(u)) throw new AppError('Lien vidéo invalide (http/https requis).', 400);
    await ref.set({ videoUrl: u, updatedAt: new Date() }, { merge: true });
    return res.json({ success: true, videoUrl: u });
  }

  if (!videoBase64) throw new AppError('Vidéo manquante.', 400);
  const buffer = Buffer.from(videoBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (buffer.length > MAX_VIDEO_BYTES) throw new AppError(`Vidéo trop lourde (max ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} Mo).`, 413);
  const mime = videoMimeType ?? 'video/mp4';
  if (!/^video\//.test(mime)) throw new AppError('Format vidéo invalide.', 400);
  const ext = mime.split('/')[1]?.split('+')[0] ?? 'mp4';
  const { getStorage } = await import('../config/firebase.config');
  const { randomBytes } = await import('crypto');
  const fileName = `companies/${companyId}/stores/${req.params.storeId}/${req.params.subPath}/${req.params.itemId}/video-${randomBytes(8).toString('hex')}.${ext}`;
  const bucket = getStorage().bucket();
  await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
  const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  await ref.set({ videoUrl: url, updatedAt: new Date() }, { merge: true });
  res.json({ success: true, videoUrl: url });
}));

// ── Room/Store photo gallery (multi-image listings) ────────────────────────
// POST appends a photo to imageUrls[]. DELETE removes a URL by query param.
// Used by Hotel rooms + Residence stores for the gallery management.
router.post('/stores/:storeId/rooms/:roomId/photos', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { imageBase64, imageMimeType } = req.body as { imageBase64?: string; imageMimeType?: string };
  if (!imageBase64) throw new AppError('Image manquante.', 400);
  const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw new AppError('Image trop lourde (max 8 Mo).', 413);
  // Cap check FIRST
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}/rooms/${req.params.roomId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Chambre introuvable.', 404);
  const data = snap.data() as { imageUrl?: string; imageUrls?: string[] };
  const existing = Array.isArray(data.imageUrls) && data.imageUrls.length > 0
    ? data.imageUrls
    : (data.imageUrl ? [data.imageUrl] : []);
  if (existing.length >= MAX_GALLERY_PHOTOS) {
    throw new AppError(`Maximum ${MAX_GALLERY_PHOTOS} photos par chambre. Supprime-en une avant.`, 400);
  }
  const { getStorage } = await import('../config/firebase.config');
  const { randomBytes } = await import('crypto');
  const mime = imageMimeType ?? 'image/jpeg';
  const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
  const fileName = `companies/${companyId}/stores/${req.params.storeId}/rooms/${req.params.roomId}/${randomBytes(8).toString('hex')}.${ext}`;
  const bucket = getStorage().bucket();
  await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
  const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  const updated = [...existing, url];
  await ref.set({
    imageUrls: updated,
    imageUrl: data.imageUrl ?? url,
    updatedAt: new Date(),
  }, { merge: true });
  res.json({ success: true, url, imageUrls: updated });
}));

router.delete('/stores/:storeId/rooms/:roomId/photos', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const url = req.query['url'] as string | undefined;
  if (!url) throw new AppError('URL requis.', 400);
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}/rooms/${req.params.roomId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Chambre introuvable.', 404);
  const data = snap.data() as { imageUrl?: string; imageUrls?: string[] };
  const filtered = (data.imageUrls ?? []).filter(u => u !== url);
  const updates: Record<string, unknown> = { imageUrls: filtered, updatedAt: new Date() };
  if (data.imageUrl === url) updates['imageUrl'] = filtered[0] ?? null;
  await ref.set(updates, { merge: true });
  res.json({ success: true, imageUrls: filtered });
}));

// Set a specific URL as the store's primary cover image (Residence pack)
router.post('/stores/:storeId/photos/primary', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { url } = req.body as { url?: string };
  if (!url) throw new AppError('URL requis.', 400);
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Store introuvable.', 404);
  const data = snap.data() as { imageUrls?: string[] };
  const list = Array.isArray(data.imageUrls) ? data.imageUrls.filter(u => u !== url) : [];
  list.unshift(url);
  await ref.set({ imageUrls: list, coverImageUrl: url, updatedAt: new Date() }, { merge: true });
  res.json({ success: true, imageUrls: list });
}));

// Video for residence stores
router.post('/stores/:storeId/video', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { videoBase64, videoMimeType, videoUrl } = req.body as { videoBase64?: string; videoMimeType?: string; videoUrl?: string };
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Store introuvable.', 404);
  if (typeof videoUrl === 'string') {
    const u = videoUrl.trim();
    if (u && !/^https?:\/\//i.test(u)) throw new AppError('Lien vidéo invalide.', 400);
    await ref.set({ videoUrl: u, updatedAt: new Date() }, { merge: true });
    return res.json({ success: true, videoUrl: u });
  }
  if (!videoBase64) throw new AppError('Vidéo manquante.', 400);
  const buffer = Buffer.from(videoBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (buffer.length > MAX_VIDEO_BYTES) throw new AppError(`Vidéo trop lourde (max ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} Mo).`, 413);
  const mime = videoMimeType ?? 'video/mp4';
  if (!/^video\//.test(mime)) throw new AppError('Format vidéo invalide.', 400);
  const ext = mime.split('/')[1]?.split('+')[0] ?? 'mp4';
  const { getStorage } = await import('../config/firebase.config');
  const { randomBytes } = await import('crypto');
  const fileName = `companies/${companyId}/stores/${req.params.storeId}/video-${randomBytes(8).toString('hex')}.${ext}`;
  const bucket = getStorage().bucket();
  await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
  const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  await ref.set({ videoUrl: url, updatedAt: new Date() }, { merge: true });
  res.json({ success: true, videoUrl: url });
}));

// Same for Residence stores (store-level gallery — store IS the unit)
router.post('/stores/:storeId/photos', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { imageBase64, imageMimeType } = req.body as { imageBase64?: string; imageMimeType?: string };
  if (!imageBase64) throw new AppError('Image manquante.', 400);
  const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw new AppError('Image trop lourde (max 8 Mo).', 413);
  const { getStorage } = await import('../config/firebase.config');
  const { randomBytes } = await import('crypto');
  const mime = imageMimeType ?? 'image/jpeg';
  const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
  const fileName = `companies/${companyId}/stores/${req.params.storeId}/gallery/${randomBytes(8).toString('hex')}.${ext}`;
  const bucket = getStorage().bucket();
  await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
  const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Store introuvable.', 404);
  const data = snap.data() as { coverImageUrl?: string; imageUrls?: string[] };
  const existing = Array.isArray(data.imageUrls) ? data.imageUrls : [];
  const updated = [...existing, url];
  await ref.set({
    imageUrls: updated,
    coverImageUrl: data.coverImageUrl ?? url,
    updatedAt: new Date(),
  }, { merge: true });
  res.json({ success: true, url, imageUrls: updated });
}));

router.delete('/stores/:storeId/photos', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const url = req.query['url'] as string | undefined;
  if (!url) throw new AppError('URL requis.', 400);
  const ref = getFirestore().doc(`companies/${companyId}/stores/${req.params.storeId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Store introuvable.', 404);
  const data = snap.data() as { coverImageUrl?: string; imageUrls?: string[] };
  const filtered = (data.imageUrls ?? []).filter(u => u !== url);
  const updates: Record<string, unknown> = { imageUrls: filtered, updatedAt: new Date() };
  if (data.coverImageUrl === url) updates['coverImageUrl'] = filtered[0] ?? null;
  await ref.set(updates, { merge: true });
  res.json({ success: true, imageUrls: filtered });
}));

// DELETE /api/commerce/stores/:storeId/rooms/:roomId
router.delete('/stores/:storeId/rooms/:roomId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/rooms/${req.params.roomId}`)
    .delete();
  res.json({ success: true });
}));

// ════════════════════════════════════════════════════════════════════════════
// RESTAURANT — Phase 1 minimal (réservations).
// Reuses the same store/products/orders pipeline; adds only what's net new.
// ════════════════════════════════════════════════════════════════════════════

interface Reservation {
  id?: string;
  customerName: string;
  customerPhone: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:mm
  partySize: number;
  notes?: string;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  source: 'web' | 'whatsapp' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

// GET /api/commerce/stores/:storeId/reservations
router.get('/stores/:storeId/reservations', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/reservations`)
    .orderBy('date', 'desc').orderBy('time', 'desc').limit(200).get().catch(() => null);
  const reservations = (snap?.docs ?? []).map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, reservations });
}));

// POST /api/commerce/stores/:storeId/reservations
// Multi-purpose: restaurant table booking (date+time+partySize) OR hotel stay
// (date=checkIn, checkOutDate, roomId, partySize=guests).
router.post('/stores/:storeId/reservations', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { customerName, customerPhone, date, time, partySize, notes, roomId, checkOutDate, serviceId, practitionerName, durationMinutes, patientId, reason, tableId } = req.body as {
    customerName?: string; customerPhone?: string;
    date?: string; time?: string; partySize?: number; notes?: string;
    roomId?: string; checkOutDate?: string;
    serviceId?: string; practitionerName?: string; durationMinutes?: number;
    patientId?: string; reason?: string;
    tableId?: string;
  };
  if (!customerName || customerName.trim().length < 2) throw new AppError('Nom requis.', 400);
  if (!customerPhone || customerPhone.length < 6) throw new AppError('Téléphone requis.', 400);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('Date invalide (YYYY-MM-DD).', 400);
  if (!partySize || partySize < 1 || partySize > 50) throw new AppError('Nombre de personnes invalide.', 400);
  // time is required for restaurants, optional for hotel stays (default check-in 14:00)
  const finalTime = time && /^\d{1,2}:\d{2}$/.test(time) ? time : (roomId ? '14:00' : null);
  if (!finalTime) throw new AppError('Heure invalide (HH:mm).', 400);
  if (checkOutDate && !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) throw new AppError('Date de départ invalide.', 400);
  if (checkOutDate && checkOutDate <= date) throw new AppError('La date de départ doit être après la date d\'arrivée.', 400);

  // ── Anti-overbooking (hotel/airbnb-style stays) ─────────────────────────
  // When a roomId + checkOutDate are provided, ensure no existing reservation
  // overlaps with [date, checkOutDate) on the same room. Two ranges overlap iff
  // existing.date < new.checkOut AND existing.checkOut > new.date.
  if (roomId && checkOutDate) {
    const existingSnap = await getFirestore()
      .collection(`companies/${companyId}/stores/${req.params.storeId}/reservations`)
      .where('roomId', '==', roomId)
      .get();
    const conflict = existingSnap.docs.find(d => {
      const r = d.data() as { date?: string; checkOutDate?: string; status?: string };
      if (!r.date || !r.checkOutDate) return false;
      if (r.status === 'cancelled' || r.status === 'no_show') return false;
      return r.date < checkOutDate && r.checkOutDate > date;
    });
    if (conflict) {
      const c = conflict.data() as { date?: string; checkOutDate?: string };
      throw new AppError(
        `Cette chambre est déjà réservée du ${c.date} au ${c.checkOutDate}. Choisis d'autres dates ou une autre chambre.`,
        409,
      );
    }
  }

  // ── Anti-double-booking (universal time-slot conflict check) ───────────
  // Used by all "appointment-on-a-resource" verticals:
  //   - Restaurant: tableId + same date, ±2h slot
  //   - Salon:      serviceId + practitionerName + same date, ±durationMinutes (default 60)
  //   - Santé:      patientId + same date, ±durationMinutes (default 30)
  //   - Immo:       propertyId (serviceId in our schema) + same date, ±60 min
  const minutes = (t: string): number => {
    const [h, m] = t.split(':').map(n => parseInt(n, 10));
    return h * 60 + m;
  };
  const newStart = finalTime ? minutes(finalTime) : null;
  const checkConflict = async (
    where: Array<[string, string | undefined]>,
    slotMinutes: number,
    resourceLabel: string,
  ) => {
    if (newStart == null) return;
    let q = getFirestore()
      .collection(`companies/${companyId}/stores/${req.params.storeId}/reservations`) as FirebaseFirestore.Query;
    for (const [field, value] of where) {
      if (!value) return; // missing required hint — skip check
      q = q.where(field, '==', value);
    }
    q = q.where('date', '==', date);
    const existingSnap = await q.get().catch(() => null);
    if (!existingSnap) return;
    const conflict = existingSnap.docs.find(d => {
      const r = d.data() as { time?: string; status?: string };
      if (!r.time) return false;
      if (r.status === 'cancelled' || r.status === 'no_show') return false;
      return Math.abs(minutes(r.time) - newStart) < slotMinutes;
    });
    if (conflict) {
      const c = conflict.data() as { time?: string };
      throw new AppError(
        `${resourceLabel} déjà occupé à ${c.time} (créneau de ${slotMinutes} min). Choisis un autre horaire.`,
        409,
      );
    }
  };

  // Restaurant tables (2h slot)
  if (tableId && finalTime) {
    await checkConflict([['tableId', tableId]], 120, 'Cette table est');
  }
  // Salon: same service + practitioner + time. Use durationMinutes if provided, else 60.
  if (serviceId && finalTime && !roomId && !tableId) {
    const slot = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60;
    if (practitionerName) {
      await checkConflict(
        [['serviceId', serviceId], ['practitionerName', practitionerName.trim()]],
        slot, `${practitionerName.trim()} est`,
      );
    } else {
      // No practitioner specified → block on serviceId alone (single-staff salons)
      await checkConflict([['serviceId', serviceId]], slot, 'Ce service est');
    }
  }
  // Santé: when the store is a health cabinet, no two consultations can
  // share the same slot (single-practitioner cabinets — multi-praticien
  // is Phase 2). Practitioner-aware variants: if practitionerName is set
  // we only block on the same name; otherwise we block on the cabinet.
  if (finalTime && !roomId && !tableId && !serviceId && !tableId) {
    try {
      const storeSnap = await getFirestore()
        .doc(`companies/${companyId}/stores/${req.params.storeId}`).get();
      const isHealth = (storeSnap.data() as { businessType?: string } | undefined)?.businessType === 'health';
      if (isHealth) {
        const slot = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 30;
        const allSnap = await getFirestore()
          .collection(`companies/${companyId}/stores/${req.params.storeId}/reservations`)
          .where('date', '==', date)
          .get();
        const conflict = allSnap.docs.find(d => {
          const r = d.data() as { time?: string; status?: string; practitionerName?: string };
          if (!r.time) return false;
          if (r.status === 'cancelled' || r.status === 'no_show') return false;
          // Practitioner mismatch → not a conflict (different doctor)
          if (practitionerName && r.practitionerName && practitionerName.trim() !== r.practitionerName) return false;
          return Math.abs(minutes(r.time) - newStart!) < slot;
        });
        if (conflict) {
          const c = conflict.data() as { time?: string };
          const who = practitionerName ? practitionerName.trim() : 'Le cabinet';
          throw new AppError(
            `${who} est déjà occupé à ${c.time} (créneau de ${slot} min). Choisis un autre horaire.`,
            409,
          );
        }
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // non-blocking on lookup failure
    }
  }

  const ref = getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/reservations`).doc();
  const reservation: Reservation & { roomId?: string; tableId?: string; checkOutDate?: string; nights?: number } = {
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    date, time: finalTime,
    partySize: Math.round(partySize),
    notes: notes?.trim() ?? '',
    status: 'pending',
    source: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(roomId ? { roomId } : {}),
    ...(tableId ? { tableId } : {}),
    ...(checkOutDate ? {
      checkOutDate,
      nights: Math.max(1, Math.round((new Date(checkOutDate).getTime() - new Date(date).getTime()) / 86400000)),
    } : {}),
    ...(serviceId ? { serviceId } : {}),
    ...(practitionerName ? { practitionerName: practitionerName.trim() } : {}),
    ...(typeof durationMinutes === 'number' && durationMinutes > 0 ? { durationMinutes: Math.round(durationMinutes) } : {}),
    ...(patientId ? { patientId } : {}),
    ...(reason ? { reason: reason.trim() } : {}),
  };
  await ref.set(reservation);
  res.status(201).json({ success: true, reservationId: ref.id, reservation: { id: ref.id, ...reservation } });
}));

// PATCH /api/commerce/stores/:storeId/reservations/:reservationId
router.patch('/stores/:storeId/reservations/:reservationId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const allowed = ['status', 'date', 'time', 'partySize', 'notes', 'customerName', 'customerPhone', 'serviceId', 'practitionerName', 'durationMinutes'];
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (k in body) updates[k] = body[k];
  if (Object.keys(updates).length === 1) throw new AppError('Aucune mise à jour valide.', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/reservations/${req.params.reservationId}`)
    .update(updates);
  res.json({ success: true });
}));

// DELETE /api/commerce/stores/:storeId/reservations/:reservationId
router.delete('/stores/:storeId/reservations/:reservationId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/reservations/${req.params.reservationId}`)
    .delete();
  res.json({ success: true });
}));

// ════════════════════════════════════════════════════════════════════════════
// PROMOTIONS / COUPONS — code-based discounts attached to a store
// ════════════════════════════════════════════════════════════════════════════
router.get('/stores/:storeId/promotions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/promotions`)
    .orderBy('createdAt', 'desc').limit(200).get().catch(() => null);
  const promotions = (snap?.docs ?? []).map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, promotions });
}));

router.post('/stores/:storeId/promotions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const {
    code, name, discount, type, maxUses, conditions, expiresAt, status,
  } = req.body as {
    code?: string; name?: string;
    discount?: number; type?: 'percent' | 'amount';
    maxUses?: number | null; conditions?: string;
    expiresAt?: string | null; status?: 'active' | 'scheduled' | 'paused' | 'expired';
  };
  if (!code || code.trim().length < 2) throw new AppError('Code promo requis.', 400);
  if (!name || name.trim().length < 2) throw new AppError('Nom de promo requis.', 400);
  if (typeof discount !== 'number' || discount <= 0) throw new AppError('Montant de réduction invalide.', 400);
  if (type !== 'percent' && type !== 'amount') throw new AppError('Type de réduction invalide.', 400);
  if (type === 'percent' && discount > 100) throw new AppError('Pourcentage max 100.', 400);

  const ref = getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/promotions`).doc();
  const promotion = {
    code: code.trim().toUpperCase(),
    name: name.trim(),
    discount,
    type,
    uses: 0,
    maxUses: typeof maxUses === 'number' ? Math.max(1, Math.round(maxUses)) : null,
    conditions: conditions?.trim() ?? '',
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    status: status ?? 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await ref.set(promotion);
  res.json({ success: true, promotion: { id: ref.id, ...promotion } });
}));

router.patch('/stores/:storeId/promotions/:promotionId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const allowed = ['name', 'discount', 'type', 'maxUses', 'conditions', 'expiresAt', 'status', 'code'];
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (k in body) updates[k] = body[k];
  if (typeof updates['code'] === 'string') updates['code'] = (updates['code'] as string).trim().toUpperCase();
  if (Object.keys(updates).length === 1) throw new AppError('Aucune mise à jour valide.', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/promotions/${req.params.promotionId}`)
    .update(updates);
  res.json({ success: true });
}));

router.delete('/stores/:storeId/promotions/:promotionId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/promotions/${req.params.promotionId}`)
    .delete();
  res.json({ success: true });
}));

// ════════════════════════════════════════════════════════════════════════════
// DRIVERS (livreurs) — delivery agents attached to a store
// ════════════════════════════════════════════════════════════════════════════
router.get('/stores/:storeId/drivers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/drivers`)
    .orderBy('createdAt', 'desc').limit(200).get().catch(() => null);
  const drivers = (snap?.docs ?? []).map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, drivers });
}));

router.post('/stores/:storeId/drivers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { name, phone, vehicle, zone } = req.body as {
    name?: string; phone?: string;
    vehicle?: 'moto' | 'voiture' | 'velo' | 'pied'; zone?: string;
  };
  if (!name || name.trim().length < 2) throw new AppError('Nom du livreur requis.', 400);
  if (!phone || phone.trim().length < 6) throw new AppError('Téléphone requis.', 400);
  const ref = getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/drivers`).doc();
  const driver = {
    name: name.trim(),
    phone: phone.trim(),
    vehicle: vehicle ?? 'moto',
    zone: zone?.trim() ?? '',
    available: true,
    currentOrderId: null,
    rating: 0,
    deliveries: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await ref.set(driver);
  res.json({ success: true, driver: { id: ref.id, ...driver } });
}));

router.patch('/stores/:storeId/drivers/:driverId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const allowed = ['name', 'phone', 'vehicle', 'zone', 'available', 'currentOrderId', 'rating', 'deliveries'];
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (k in body) updates[k] = body[k];
  if (Object.keys(updates).length === 1) throw new AppError('Aucune mise à jour valide.', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/drivers/${req.params.driverId}`)
    .update(updates);
  res.json({ success: true });
}));

router.delete('/stores/:storeId/drivers/:driverId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await getFirestore()
    .doc(`companies/${companyId}/stores/${req.params.storeId}/drivers/${req.params.driverId}`)
    .delete();
  res.json({ success: true });
}));

// ════════════════════════════════════════════════════════════════════════════
// POS SALES — in-shop cash register transactions
// ════════════════════════════════════════════════════════════════════════════
router.get('/stores/:storeId/pos-sales', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/pos-sales`)
    .orderBy('createdAt', 'desc').limit(100).get().catch(() => null);
  const sales = (snap?.docs ?? []).map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, sales });
}));

router.post('/stores/:storeId/pos-sales', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { items, total, paymentMethod, customerName, customerPhone, discountCode, discountAmount } = req.body as {
    items?: Array<{ productId: string; name: string; qty: number; unitPrice: number; size?: string }>;
    total?: number;
    paymentMethod?: 'cash' | 'mobile_money' | 'wave' | 'card' | 'orange_money' | 'mtn_money';
    customerName?: string; customerPhone?: string;
    discountCode?: string; discountAmount?: number;
  };
  if (!Array.isArray(items) || items.length === 0) throw new AppError('Panier vide.', 400);
  if (typeof total !== 'number' || total <= 0) throw new AppError('Total invalide.', 400);
  if (!paymentMethod) throw new AppError('Mode de paiement requis.', 400);

  const ref = getFirestore()
    .collection(`companies/${companyId}/stores/${req.params.storeId}/pos-sales`).doc();
  const sale = {
    saleNumber: `POS-${Date.now().toString().slice(-6)}`,
    items: items.map(it => ({
      productId: it.productId,
      name: it.name,
      qty: Math.max(1, Math.round(it.qty || 1)),
      unitPrice: it.unitPrice,
      size: it.size ?? null,
      lineTotal: it.unitPrice * Math.max(1, Math.round(it.qty || 1)),
    })),
    total,
    paymentMethod,
    customerName: customerName?.trim() ?? '',
    customerPhone: customerPhone?.trim() ?? '',
    discountCode: discountCode?.trim() ?? null,
    discountAmount: typeof discountAmount === 'number' ? discountAmount : 0,
    channel: 'pos',
    createdAt: new Date(),
  };
  await ref.set(sale);

  // Decrement stock for each item (best-effort)
  const db = getFirestore();
  for (const it of items) {
    const productRef = db.doc(`companies/${companyId}/stores/${req.params.storeId}/products/${it.productId}`);
    try {
      await db.runTransaction(async tx => {
        const doc = await tx.get(productRef);
        if (!doc.exists) return;
        const data = doc.data() as { stockQty?: number };
        const current = typeof data.stockQty === 'number' ? data.stockQty : 0;
        tx.update(productRef, { stockQty: Math.max(0, current - it.qty), updatedAt: new Date() });
      });
    } catch { /* silently skip — sale still recorded */ }
  }

  res.json({ success: true, sale: { id: ref.id, ...sale } });
}));

export default router;
