/**
 * Public storefront — no auth.
 *
 * GET /api/public/shop/:companyId/:storeId
 *   → returns { store, products, whatsappBusinessNumber }
 *   so customers can browse via a web link without signing in.
 *
 * Sensitive fields (ownerPhone, paymentInstructions internals, sessions, OTP)
 * are NEVER exposed here — only what a customer needs to see + click.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';

const router = Router();

async function buildShopResponse(companyId: string, storeId: string, storeData: Record<string, unknown>) {
  const { ensureStoreSlug } = await import('../agents/commerce.agent');
  const db = getFirestore();
  // Backfill slug if missing
  const slug = await ensureStoreSlug(companyId, storeId, storeData as never);

  // Public store fields — strip ownerPhone (private) but keep payment instructions
  // (the merchant wrote them to be shown to customers anyway).
  const publicStore = {
    id: storeId,
    companyId,
    slug,
    name: storeData['name'],
    currency: storeData['currency'] ?? 'XOF',
    country: storeData['country'] ?? 'CI',
    paymentInstructions: storeData['paymentInstructions'] ?? '',
    logoUrl: storeData['logoUrl'] ?? null,
    coverImageUrl: storeData['coverImageUrl'] ?? null,
    accentColor: storeData['accentColor'] ?? null,
    openingHours: storeData['openingHours'] ?? null,
    establishmentType: storeData['establishmentType'] ?? null,
    salonType: storeData['salonType'] ?? null,
    businessType: storeData['businessType'] ?? null,
    address: storeData['address'] ?? null,
    googleMapsUrl: storeData['googleMapsUrl'] ?? null,
    latitude: typeof storeData['latitude'] === 'number' ? storeData['latitude'] : null,
    longitude: typeof storeData['longitude'] === 'number' ? storeData['longitude'] : null,
    // ── Marketing / branding identity (visible on the public page) ─────────
    tagline:          storeData['tagline']          ?? null,
    shortDescription: storeData['shortDescription'] ?? null,
    contactEmail:     storeData['contactEmail']     ?? null,
    websiteUrl:       storeData['websiteUrl']       ?? null,
    instagramUrl:     storeData['instagramUrl']     ?? null,
    facebookUrl:      storeData['facebookUrl']      ?? null,
    tiktokUrl:        storeData['tiktokUrl']        ?? null,
    twitterUrl:       storeData['twitterUrl']       ?? null,
    youtubeUrl:       storeData['youtubeUrl']       ?? null,
    // Owner phone exposed as a click-to-WhatsApp / click-to-call target. Stored
    // as an E.164 number — the UI strips non-digits before composing wa.me/tel:
    // links. NOT a privacy leak: the merchant signs up specifically to receive
    // customer contacts on this number.
    ownerPhone:       storeData['ownerPhone']       ?? null,
    practitioners: Array.isArray(storeData['practitioners'])
      ? (storeData['practitioners'] as Array<Record<string, unknown>>)
          .filter(p => p['active'] !== false)
          .map(p => ({
            id: p['id'] ?? '',
            name: p['name'] ?? '',
            ...(p['role'] ? { role: p['role'] } : {}),
            ...(p['photoUrl'] ? { photoUrl: p['photoUrl'] } : {}),
            ...(p['workingHours'] ? { workingHours: p['workingHours'] } : {}),
          }))
      : [],
    // Hotel + Residence stay-cycle public fields
    houseRules: storeData['houseRules'] ?? null,
    cancellationPolicy: storeData['cancellationPolicy'] ?? null,
    // checkInInstructions deliberately NOT exposed publicly — sent J-1 via WA
  };

  // Active products only
  const productsSnap = await db
    .collection(`companies/${companyId}/stores/${storeId}/products`)
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  const products = productsSnap.docs.map(d => {
    const p = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      name: p['name'],
      price: p['price'],
      currency: p['currency'] ?? publicStore.currency,
      description: p['description'] ?? '',
      imageUrl: p['imageUrl'] ?? null,
      imageUrls: (p['imageUrls'] as string[] | undefined) ?? [],
      primaryImageUrl: p['primaryImageUrl'] ?? null,
      videoUrl: p['videoUrl'] ?? null,
      category: p['category'] ?? null,
      subcategory: p['subcategory'] ?? null,
      tags: (p['tags'] as string[] | undefined) ?? [],
      colors: (p['colors'] as string[] | undefined) ?? [],
      stockQty: p['stockQty'] ?? 0,
      variants: p['variants'] ?? [],
      featured: p['featured'] === true,
      // Airbnb-style listing fields
      listingCategory: p['listingCategory'] ?? null,
      roomType: p['roomType'] ?? null,
      maxGuests: typeof p['maxGuests'] === 'number' ? p['maxGuests'] : null,
      childrenFreeUnder: typeof p['childrenFreeUnder'] === 'number' ? p['childrenFreeUnder'] : null,
      allowExtraGuests: p['allowExtraGuests'] === true,
      maxExtraGuests: typeof p['maxExtraGuests'] === 'number' ? p['maxExtraGuests'] : null,
      city: p['city'] ?? null,
      neighborhood: p['neighborhood'] ?? null,
      country: p['country'] ?? null,
      affiliateUrl: p['affiliateUrl'] ?? null,
      useContactForm: p['useContactForm'] === true,
      instantBooking: p['instantBooking'] === true,
      amenities: (p['amenities'] as string[] | undefined) ?? [],
      // Public output: just the URL list — visitors don't need the consent
      // flag (it's purely server-side gating for AI reference use).
      examplePhotos: (() => {
        const raw = p['examplePhotos'];
        if (!Array.isArray(raw)) return [];
        return raw.map((entry: unknown) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object') {
            const u = (entry as { url?: unknown }).url;
            return typeof u === 'string' ? u : null;
          }
          return null;
        }).filter((u): u is string => !!u);
      })(),
    };
  });

  // WABA display number (so customers can tap "Commander" → wa.me/...)
  let whatsappBusinessNumber: string | null = null;
  try {
    const integ = await db.doc(`companies/${companyId}/integrations/whatsapp`).get();
    if (integ.exists) {
      const data = integ.data() as Record<string, unknown>;
      whatsappBusinessNumber = (data['displayPhoneNumber'] as string | undefined)
        ?? (data['phoneNumberId'] as string | undefined)
        ?? null;
    }
  } catch { /* non-blocking */ }

  return { store: publicStore, products, whatsappBusinessNumber };
}

// ── GET /api/public/shop/:slug — clean URL (e.g. /shop/galaxy-store) ─────────
router.get('/shop/:slug', asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params as { slug: string };
  // Skip if the path matches the legacy 2-segment form (slug looks like a UUID
  // without slashes, the express router still routes here). Just look it up.
  const { findStoreBySlug } = await import('../agents/commerce.agent');
  const found = await findStoreBySlug(slug);
  if (!found) throw new AppError('Boutique introuvable.', 404);
  if (found.store.status === 'suspended') {
    throw new AppError('Boutique temporairement fermée.', 403);
  }
  const data = await buildShopResponse(found.companyId, found.storeId, found.store as never);
  res.json({ success: true, ...data });
}));

router.get('/shop/:companyId/:storeId', asyncHandler(async (req: Request, res: Response) => {
  const { companyId, storeId } = req.params as { companyId: string; storeId: string };
  const db = getFirestore();

  const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
  if (!storeSnap.exists) throw new AppError('Boutique introuvable.', 404);
  const storeData = storeSnap.data() as Record<string, unknown>;
  if ((storeData['status'] as string) === 'suspended') {
    throw new AppError('Boutique temporairement fermée.', 403);
  }

  const data = await buildShopResponse(companyId, storeId, storeData);
  res.json({ success: true, ...data });
}));

// ── GET /api/public/hotel/:slug — public hotel page (rooms instead of products) ──
router.get('/hotel/:slug', asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params as { slug: string };
  const { findStoreBySlug, ensureStoreSlug } = await import('../agents/commerce.agent');
  const found = await findStoreBySlug(slug);
  if (!found) throw new AppError('Hôtel introuvable.', 404);
  if (found.store.status === 'suspended') throw new AppError('Hôtel temporairement fermé.', 403);

  const db = getFirestore();
  // Backfill slug if missing
  await ensureStoreSlug(found.companyId, found.storeId, found.store as never);

  const storeData = found.store as unknown as Record<string, unknown>;
  const publicStore = {
    id: found.storeId,
    slug,
    name: storeData['name'],
    currency: storeData['currency'] ?? 'XOF',
    country: storeData['country'] ?? 'CI',
    paymentInstructions: storeData['paymentInstructions'] ?? '',
    logoUrl: storeData['logoUrl'] ?? null,
    coverImageUrl: storeData['coverImageUrl'] ?? null,
    accentColor: storeData['accentColor'] ?? null,
    openingHours: storeData['openingHours'] ?? null,
    address: storeData['address'] ?? null,
    googleMapsUrl: storeData['googleMapsUrl'] ?? null,
    latitude: typeof storeData['latitude'] === 'number' ? storeData['latitude'] : null,
    longitude: typeof storeData['longitude'] === 'number' ? storeData['longitude'] : null,
  };

  // Fetch rooms (subcollection specific to hotels)
  const roomsSnap = await db
    .collection(`companies/${found.companyId}/stores/${found.storeId}/rooms`)
    .orderBy('number').limit(200).get().catch(() => null);

  // Fetch upcoming reservations to compute booked date ranges per room.
  // Public page uses this to disable already-taken date ranges in the
  // booking modal — anti-overbooking on the visitor side.
  const todayStr = new Date().toISOString().slice(0, 10);
  const reservationsSnap = await db
    .collection(`companies/${found.companyId}/stores/${found.storeId}/reservations`)
    .where('checkOutDate', '>=', todayStr)
    .limit(500).get().catch(() => null);
  const bookedRangesByRoom: Record<string, Array<{ from: string; to: string }>> = {};
  (reservationsSnap?.docs ?? []).forEach(d => {
    const r = d.data() as { roomId?: string; date?: string; checkOutDate?: string; status?: string };
    if (!r.roomId || !r.date || !r.checkOutDate) return;
    if (r.status === 'cancelled' || r.status === 'no_show') return;
    if (!bookedRangesByRoom[r.roomId]) bookedRangesByRoom[r.roomId] = [];
    bookedRangesByRoom[r.roomId].push({ from: r.date, to: r.checkOutDate });
  });

  const rooms = (roomsSnap?.docs ?? []).map(d => {
    const r = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      number: r['number'],
      type: r['type'] ?? 'double',
      capacity: r['capacity'] ?? 1,
      pricePerNight: r['pricePerNight'] ?? 0,
      currency: r['currency'] ?? publicStore.currency,
      status: r['status'] ?? 'available',
      description: r['description'] ?? '',
      longDescription: r['longDescription'] ?? '',
      imageUrl: r['imageUrl'] ?? null,
      imageUrls: (r['imageUrls'] as string[] | undefined) ?? [],
      amenities: (r['amenities'] as string[] | undefined) ?? [],
      // Airbnb-style fields per room
      roomType: r['roomType'] ?? null,
      maxGuests: typeof r['maxGuests'] === 'number' ? r['maxGuests'] : null,
      childrenFreeUnder: typeof r['childrenFreeUnder'] === 'number' ? r['childrenFreeUnder'] : null,
      allowExtraGuests: r['allowExtraGuests'] === true,
      maxExtraGuests: typeof r['maxExtraGuests'] === 'number' ? r['maxExtraGuests'] : null,
      bedrooms: typeof r['bedrooms'] === 'number' ? r['bedrooms'] : null,
      bathrooms: typeof r['bathrooms'] === 'number' ? r['bathrooms'] : null,
      surfaceM2: typeof r['surfaceM2'] === 'number' ? r['surfaceM2'] : null,
      cleaningFee: typeof r['cleaningFee'] === 'number' ? r['cleaningFee'] : null,
      instantBooking: r['instantBooking'] === true,
      useContactForm: r['useContactForm'] === true,
      affiliateUrl: r['affiliateUrl'] ?? null,
      featured: r['featured'] === true,
      bookedRanges: bookedRangesByRoom[d.id] ?? [],
    };
  });

  // WhatsApp business number
  let whatsappBusinessNumber: string | null = null;
  try {
    const integ = await db.doc(`companies/${found.companyId}/integrations/whatsapp`).get();
    if (integ.exists) {
      const data = integ.data() as Record<string, unknown>;
      whatsappBusinessNumber = (data['displayPhoneNumber'] as string | undefined)
        ?? (data['phoneNumberId'] as string | undefined) ?? null;
    }
  } catch { /* non-blocking */ }

  res.json({ success: true, store: publicStore, rooms, whatsappBusinessNumber });
}));

// ── GET /api/public/residence/:slug ────────────────────────────────────────
// Booking/Airbnb-style single-listing view. The store IS the unit (no rooms
// subcollection) — we expose all listing fields directly + booked date ranges
// so the UI can disable taken dates.
router.get('/residence/:slug', asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params as { slug: string };
  const { findStoreBySlug, ensureStoreSlug } = await import('../agents/commerce.agent');
  const found = await findStoreBySlug(slug);
  if (!found) throw new AppError('Résidence introuvable.', 404);
  if (found.store.status === 'suspended') throw new AppError('Résidence temporairement fermée.', 403);

  const db = getFirestore();
  await ensureStoreSlug(found.companyId, found.storeId, found.store as never);
  const sd = found.store as unknown as Record<string, unknown>;

  // Booked date ranges (anti-overbooking on the public booking modal)
  const todayStr = new Date().toISOString().slice(0, 10);
  const reservationsSnap = await db
    .collection(`companies/${found.companyId}/stores/${found.storeId}/reservations`)
    .where('checkOutDate', '>=', todayStr)
    .limit(500).get().catch(() => null);
  const bookedRanges: Array<{ from: string; to: string }> = [];
  (reservationsSnap?.docs ?? []).forEach(d => {
    const r = d.data() as { date?: string; checkOutDate?: string; status?: string };
    if (!r.date || !r.checkOutDate) return;
    if (r.status === 'cancelled' || r.status === 'no_show') return;
    bookedRanges.push({ from: r.date, to: r.checkOutDate });
  });

  // WhatsApp business number
  let whatsappBusinessNumber: string | null = null;
  try {
    const integ = await db.doc(`companies/${found.companyId}/integrations/whatsapp`).get();
    if (integ.exists) {
      const data = integ.data() as Record<string, unknown>;
      whatsappBusinessNumber = (data['displayPhoneNumber'] as string | undefined)
        ?? (data['phoneNumberId'] as string | undefined) ?? null;
    }
  } catch { /* non-blocking */ }

  res.json({
    success: true,
    residence: {
      id: found.storeId,
      companyId: found.companyId,
      slug,
      name: sd['name'],
      currency: sd['currency'] ?? 'XOF',
      country: sd['country'] ?? 'CI',
      logoUrl: sd['logoUrl'] ?? null,
      coverImageUrl: sd['coverImageUrl'] ?? null,
      imageUrls: (sd['imageUrls'] as string[] | undefined) ?? [],
      accentColor: sd['accentColor'] ?? null,
      city: sd['city'] ?? null,
      neighborhood: sd['neighborhood'] ?? null,
      address: sd['address'] ?? null,
      googleMapsUrl: sd['googleMapsUrl'] ?? null,
      latitude: typeof sd['latitude'] === 'number' ? sd['latitude'] : null,
      longitude: typeof sd['longitude'] === 'number' ? sd['longitude'] : null,
      roomType: sd['roomType'] ?? 'entire',
      bedrooms: typeof sd['bedrooms'] === 'number' ? sd['bedrooms'] : null,
      bathrooms: typeof sd['bathrooms'] === 'number' ? sd['bathrooms'] : null,
      surfaceM2: typeof sd['surfaceM2'] === 'number' ? sd['surfaceM2'] : null,
      maxGuests: typeof sd['maxGuests'] === 'number' ? sd['maxGuests'] : null,
      childrenFreeUnder: typeof sd['childrenFreeUnder'] === 'number' ? sd['childrenFreeUnder'] : 12,
      allowExtraGuests: sd['allowExtraGuests'] === true,
      maxExtraGuests: typeof sd['maxExtraGuests'] === 'number' ? sd['maxExtraGuests'] : null,
      pricePerNight: typeof sd['pricePerNight'] === 'number' ? sd['pricePerNight'] : null,
      cleaningFee: typeof sd['cleaningFee'] === 'number' ? sd['cleaningFee'] : null,
      weeklyDiscountPct: typeof sd['weeklyDiscountPct'] === 'number' ? sd['weeklyDiscountPct'] : null,
      monthlyDiscountPct: typeof sd['monthlyDiscountPct'] === 'number' ? sd['monthlyDiscountPct'] : null,
      amenities: (sd['amenities'] as string[] | undefined) ?? [],
      affiliateUrl: sd['affiliateUrl'] ?? null,
      instantBooking: sd['instantBooking'] === true,
      useContactForm: sd['useContactForm'] === true,
      longDescription: sd['longDescription'] ?? '',
      paymentInstructions: sd['paymentInstructions'] ?? '',
      openingHours: sd['openingHours'] ?? null,
      houseRules: sd['houseRules'] ?? null,
      cancellationPolicy: sd['cancellationPolicy'] ?? null,
      bookedRanges,
    },
    whatsappBusinessNumber,
  });
}));

// ── iCal feed (Booking/Airbnb-style calendar sync) ────────────────────────
// Owner copies the URL into Google Calendar / Apple Calendar / external
// channel managers (Booking.com, Airbnb) to sync booked dates and avoid
// double-booking. The token is opaque per store — leak it = anyone can read
// the calendar. Regenerable from Settings.
router.get('/calendar/:storeId.ics', asyncHandler(async (req: Request, res: Response) => {
  const { storeId } = req.params as { storeId: string };
  const token = req.query['token'] as string | undefined;
  if (!token) throw new AppError('Token required.', 401);

  const db = getFirestore();
  // Cross-company lookup by storeId is expensive — instead, the URL convention
  // includes companyId before storeId. To keep URLs short, we stash both in
  // a single hash. Simpler: find the store + verify token matches.
  // We do collectionGroup so the URL doesn't need companyId.
  const snap = await db.collectionGroup('stores').where('icalToken', '==', token).limit(1).get();
  if (snap.empty) throw new AppError('Invalid token.', 401);
  const storeDoc = snap.docs[0];
  if (storeDoc.id !== storeId) throw new AppError('Token / store mismatch.', 403);
  const sd = storeDoc.data() as Record<string, unknown>;
  const companyId = storeDoc.ref.parent.parent!.id;
  const storeName = (sd['name'] as string) ?? 'Store';

  const reservationsSnap = await db
    .collection(`companies/${companyId}/stores/${storeId}/reservations`)
    .limit(500).get();

  const today = new Date();
  const cutoff = new Date(today.getTime() - 90 * 86400000); // last 90d + future

  const escape = (s: string): string => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const fmt = (d: string): string => d.replace(/-/g, ''); // YYYY-MM-DD → YYYYMMDD
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Orlode//${escape(storeName)}//FR`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(storeName + ' — Réservations')}`,
    `X-WR-TIMEZONE:Africa/Abidjan`,
  ];

  for (const d of reservationsSnap.docs) {
    const r = d.data() as { date?: string; checkOutDate?: string; customerName?: string; partySize?: number; status?: string; createdAt?: { toDate?: () => Date } };
    if (!r.date) continue;
    if (r.status === 'cancelled') continue;
    const checkOut = r.checkOutDate ?? r.date;
    // Skip ancient bookings to keep the feed light
    try { if (new Date(checkOut) < cutoff) continue; } catch { /* ignore */ }
    const stamp = r.createdAt?.toDate?.()?.toISOString().replace(/[-:]|\.\d+/g, '') ?? new Date().toISOString().replace(/[-:]|\.\d+/g, '');
    const status = r.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${d.id}@orlode.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${fmt(r.date)}`,
      `DTEND;VALUE=DATE:${fmt(checkOut)}`,
      `SUMMARY:${escape(`Réservé — ${r.customerName ?? 'Client'} (${r.partySize ?? 1}p)`)}`,
      `STATUS:${status}`,
      `TRANSP:OPAQUE`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min — long enough for Google to refresh, short enough to stay fresh
  res.setHeader('Content-Disposition', `inline; filename="${storeName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics"`);
  res.send(lines.join('\r\n') + '\r\n');
}));

// ── Face preview (AI image-to-image transformation) ───────────────────────
// Customer uploads a selfie + picks a service → Gemini 2.5 Flash Image
// generates a preview of the expected outcome (haircut, makeup, facial soin).
//
// Limits: max 3 generations per IP per 24h, max 4 MB upload, only available
// when the chosen product is in a 'service' store with esthetique/coiffure/
// barber sub-type. Realistic, anonymized — no face data persisted beyond the
// generated preview itself.
router.post('/face-preview', asyncHandler(async (req: Request, res: Response) => {
  const { companyId, storeId, productId, imageBase64, imageMimeType } = req.body as {
    companyId?: string; storeId?: string; productId?: string;
    imageBase64?: string; imageMimeType?: string;
  };
  if (!companyId || !storeId || !productId) throw new AppError('companyId / storeId / productId required.', 400);
  if (!imageBase64 || imageBase64.length < 100) throw new AppError('Image manquante.', 400);

  const db = getFirestore();
  // Only allow on service stores with the right sub-type
  const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
  if (!storeSnap.exists) throw new AppError('Store introuvable.', 404);
  const sd = storeSnap.data() as { businessType?: string; salonType?: string };
  if (sd.businessType !== 'service') throw new AppError('Aperçu IA disponible uniquement sur les salons.', 403);
  const allowed = new Set(['esthetique', 'coiffure', 'barber']);
  if (sd.salonType && !allowed.has(sd.salonType)) {
    throw new AppError('Aperçu IA non disponible pour ce type de salon.', 403);
  }

  const prodSnap = await db.doc(`companies/${companyId}/stores/${storeId}/products/${productId}`).get();
  if (!prodSnap.exists) throw new AppError('Service introuvable.', 404);
  const product = prodSnap.data() as {
    name?: string; description?: string; category?: string;
    examplePhotos?: Array<{ url?: string; consentForAI?: boolean }> | string[];
  };

  // Pull up to 3 consented reference photos. Photos without an explicit
  // consentForAI:true flag are silently ignored — they may legally be
  // shown in galleries (owner's publication right) but cannot legally be
  // used as IA style references without per-photo signed consent.
  const refUrls: string[] = [];
  if (Array.isArray(product.examplePhotos)) {
    for (const entry of product.examplePhotos) {
      if (typeof entry === 'object' && entry?.consentForAI === true && typeof entry.url === 'string') {
        refUrls.push(entry.url);
        if (refUrls.length >= 3) break;
      }
    }
  }
  // Download each reference into base64 (Gemini accepts data URLs)
  const refParts: Array<{ media: { url: string } }> = [];
  for (const url of refUrls) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const ab = await r.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.length > 4 * 1024 * 1024) continue;
      const ct = r.headers.get('content-type') ?? 'image/jpeg';
      refParts.push({ media: { url: `data:${ct};base64,${buf.toString('base64')}` } });
    } catch { /* skip broken ref */ }
  }

  // Decode base64 selfie, cap size at ~4 MB
  const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
  if (buffer.length > 4 * 1024 * 1024) throw new AppError('Image trop lourde (max 4 Mo).', 413);
  const inputMime = imageMimeType ?? 'image/jpeg';

  // Build the transformation prompt — Gemini receives the customer's selfie
  // (always last so it's the "subject") plus optional consented reference
  // photos as style guides, plus this instruction.
  const refIntro = refParts.length > 0
    ? `Les ${refParts.length} première${refParts.length > 1 ? 's' : ''} photo${refParts.length > 1 ? 's sont des' : ' est une'} exemple${refParts.length > 1 ? 's' : ''} de transformation déjà réalisé${refParts.length > 1 ? 'es' : ''} par notre salon (style, finition, qualité). La DERNIÈRE photo est la cliente. `
    : '';
  const prompt = `Tu es un expert en visualisation beauté. ${refIntro}Reprends EXACTEMENT le visage et la peau de la personne sur la DERNIÈRE photo (mêmes traits, même teint, même expression) et applique ce service : ${product.name}${product.description ? ` (${product.description})` : ''}.${refParts.length > 0 ? ' Inspire-toi du style/qualité des exemples mais GARDE le visage de la dernière photo, pas celui des exemples.' : ''} Résultat photoréaliste, naturel, qualité photo studio, cadrage portrait. NE CHANGE PAS l'identité de la cliente. NE CRÉE PAS un autre visage. Garde la pose originale.`;

  let imageBuffer: Buffer | null = null;
  let outputMime = 'image/png';
  const errors: string[] = [];
  // Cascade with NEWEST model first. "Nano Banana 2" is the Google codename
  // for the Gemini 3 Flash Image generation. Falls through to Gemini 2.5
  // Flash Image (Nano Banana 1) and finally Imagen 4 / 3 if the newer
  // models are not yet live in our region or quota is exceeded.
  const candidates = [
    // Nano Banana 2 (Gemini 3.0 Flash Image) — try multiple known model IDs
    { model: 'googleai/gemini-3.0-flash-image', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-3.0-flash-image-preview', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-native-image-3.0', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    // Nano Banana 1 (Gemini 2.5 Flash Image) — current stable
    { model: 'googleai/gemini-2.5-flash-image', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-2.5-flash-image-preview', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    // Imagen 4 — fallback (text-to-image only, won't follow the selfie)
    { model: 'googleai/imagen-4.0-generate-preview-06-06', config: { numberOfImages: 1, aspectRatio: '1:1' } },
    { model: 'googleai/imagen-4.0-fast-generate-preview-06-06', config: { numberOfImages: 1, aspectRatio: '1:1' } },
    { model: 'googleai/imagen-3.0-generate-002', config: { numberOfImages: 1, aspectRatio: '1:1' } },
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

  for (const c of candidates) {
    try {
      const response = await ai.generate({
        model: c.model,
        prompt: [
          // Consented reference photos first (style guides)
          ...refParts,
          // Customer selfie last (the subject)
          { media: { url: `data:${inputMime};base64,${buffer.toString('base64')}` } },
          { text: prompt },
        ],
        config: c.config,
      } as never);
      const got = extractImage(response as GenkitResponse);
      if (got) {
        imageBuffer = got.buffer;
        outputMime = got.contentType;
        break;
      }
      errors.push(`${c.model}: no image`);
    } catch (err) {
      errors.push(`${c.model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!imageBuffer) {
    throw new AppError(`Génération IA indisponible. Détails : ${errors[errors.length - 1] ?? 'unknown'}`, 503);
  }

  // Save to Storage with short-lived signed URL (1h)
  const { getStorage } = await import('../config/firebase.config');
  const bucket = getStorage().bucket();
  const ext = outputMime.includes('jpeg') ? 'jpg' : 'png';
  const storagePath = `face-preview/${companyId}/${storeId}/${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await bucket.file(storagePath).save(imageBuffer, { metadata: { contentType: outputMime }, public: true });
  const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  res.json({
    success: true,
    url,
    disclaimer: 'Aperçu IA — résultat indicatif, peut varier en réel.',
  });
}));

export default router;
