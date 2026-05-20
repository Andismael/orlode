"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
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
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
async function buildShopResponse(companyId, storeId, storeData) {
    const { ensureStoreSlug } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
    const db = (0, firebase_config_1.getFirestore)();
    // Backfill slug if missing
    const slug = await ensureStoreSlug(companyId, storeId, storeData);
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
        tagline: storeData['tagline'] ?? null,
        shortDescription: storeData['shortDescription'] ?? null,
        contactEmail: storeData['contactEmail'] ?? null,
        websiteUrl: storeData['websiteUrl'] ?? null,
        instagramUrl: storeData['instagramUrl'] ?? null,
        facebookUrl: storeData['facebookUrl'] ?? null,
        tiktokUrl: storeData['tiktokUrl'] ?? null,
        twitterUrl: storeData['twitterUrl'] ?? null,
        youtubeUrl: storeData['youtubeUrl'] ?? null,
        // Owner phone exposed as a click-to-WhatsApp / click-to-call target. Stored
        // as an E.164 number — the UI strips non-digits before composing wa.me/tel:
        // links. NOT a privacy leak: the merchant signs up specifically to receive
        // customer contacts on this number.
        ownerPhone: storeData['ownerPhone'] ?? null,
        practitioners: Array.isArray(storeData['practitioners'])
            ? storeData['practitioners']
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
        const p = d.data();
        return {
            id: d.id,
            name: p['name'],
            price: p['price'],
            currency: p['currency'] ?? publicStore.currency,
            description: p['description'] ?? '',
            imageUrl: p['imageUrl'] ?? null,
            imageUrls: p['imageUrls'] ?? [],
            primaryImageUrl: p['primaryImageUrl'] ?? null,
            videoUrl: p['videoUrl'] ?? null,
            category: p['category'] ?? null,
            subcategory: p['subcategory'] ?? null,
            tags: p['tags'] ?? [],
            colors: p['colors'] ?? [],
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
            amenities: p['amenities'] ?? [],
            // Public output: just the URL list — visitors don't need the consent
            // flag (it's purely server-side gating for AI reference use).
            examplePhotos: (() => {
                const raw = p['examplePhotos'];
                if (!Array.isArray(raw))
                    return [];
                return raw.map((entry) => {
                    if (typeof entry === 'string')
                        return entry;
                    if (entry && typeof entry === 'object') {
                        const u = entry.url;
                        return typeof u === 'string' ? u : null;
                    }
                    return null;
                }).filter((u) => !!u);
            })(),
        };
    });
    // WABA display number (so customers can tap "Commander" → wa.me/...)
    let whatsappBusinessNumber = null;
    try {
        const integ = await db.doc(`companies/${companyId}/integrations/whatsapp`).get();
        if (integ.exists) {
            const data = integ.data();
            whatsappBusinessNumber = data['displayPhoneNumber']
                ?? data['phoneNumberId']
                ?? null;
        }
    }
    catch { /* non-blocking */ }
    return { store: publicStore, products, whatsappBusinessNumber };
}
// ── GET /api/public/shop/:slug — clean URL (e.g. /shop/galaxy-store) ─────────
router.get('/shop/:slug', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    // Skip if the path matches the legacy 2-segment form (slug looks like a UUID
    // without slashes, the express router still routes here). Just look it up.
    const { findStoreBySlug } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
    const found = await findStoreBySlug(slug);
    if (!found)
        throw new error_middleware_1.AppError('Boutique introuvable.', 404);
    if (found.store.status === 'suspended') {
        throw new error_middleware_1.AppError('Boutique temporairement fermée.', 403);
    }
    const data = await buildShopResponse(found.companyId, found.storeId, found.store);
    res.json({ success: true, ...data });
}));
router.get('/shop/:companyId/:storeId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { companyId, storeId } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
    if (!storeSnap.exists)
        throw new error_middleware_1.AppError('Boutique introuvable.', 404);
    const storeData = storeSnap.data();
    if (storeData['status'] === 'suspended') {
        throw new error_middleware_1.AppError('Boutique temporairement fermée.', 403);
    }
    const data = await buildShopResponse(companyId, storeId, storeData);
    res.json({ success: true, ...data });
}));
// ── GET /api/public/hotel/:slug — public hotel page (rooms instead of products) ──
router.get('/hotel/:slug', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const { findStoreBySlug, ensureStoreSlug } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
    const found = await findStoreBySlug(slug);
    if (!found)
        throw new error_middleware_1.AppError('Hôtel introuvable.', 404);
    if (found.store.status === 'suspended')
        throw new error_middleware_1.AppError('Hôtel temporairement fermé.', 403);
    const db = (0, firebase_config_1.getFirestore)();
    // Backfill slug if missing
    await ensureStoreSlug(found.companyId, found.storeId, found.store);
    const storeData = found.store;
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
    const bookedRangesByRoom = {};
    (reservationsSnap?.docs ?? []).forEach(d => {
        const r = d.data();
        if (!r.roomId || !r.date || !r.checkOutDate)
            return;
        if (r.status === 'cancelled' || r.status === 'no_show')
            return;
        if (!bookedRangesByRoom[r.roomId])
            bookedRangesByRoom[r.roomId] = [];
        bookedRangesByRoom[r.roomId].push({ from: r.date, to: r.checkOutDate });
    });
    const rooms = (roomsSnap?.docs ?? []).map(d => {
        const r = d.data();
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
            imageUrls: r['imageUrls'] ?? [],
            amenities: r['amenities'] ?? [],
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
    let whatsappBusinessNumber = null;
    try {
        const integ = await db.doc(`companies/${found.companyId}/integrations/whatsapp`).get();
        if (integ.exists) {
            const data = integ.data();
            whatsappBusinessNumber = data['displayPhoneNumber']
                ?? data['phoneNumberId'] ?? null;
        }
    }
    catch { /* non-blocking */ }
    res.json({ success: true, store: publicStore, rooms, whatsappBusinessNumber });
}));
// ── GET /api/public/residence/:slug ────────────────────────────────────────
// Booking/Airbnb-style single-listing view. The store IS the unit (no rooms
// subcollection) — we expose all listing fields directly + booked date ranges
// so the UI can disable taken dates.
router.get('/residence/:slug', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const { findStoreBySlug, ensureStoreSlug } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
    const found = await findStoreBySlug(slug);
    if (!found)
        throw new error_middleware_1.AppError('Résidence introuvable.', 404);
    if (found.store.status === 'suspended')
        throw new error_middleware_1.AppError('Résidence temporairement fermée.', 403);
    const db = (0, firebase_config_1.getFirestore)();
    await ensureStoreSlug(found.companyId, found.storeId, found.store);
    const sd = found.store;
    // Booked date ranges (anti-overbooking on the public booking modal)
    const todayStr = new Date().toISOString().slice(0, 10);
    const reservationsSnap = await db
        .collection(`companies/${found.companyId}/stores/${found.storeId}/reservations`)
        .where('checkOutDate', '>=', todayStr)
        .limit(500).get().catch(() => null);
    const bookedRanges = [];
    (reservationsSnap?.docs ?? []).forEach(d => {
        const r = d.data();
        if (!r.date || !r.checkOutDate)
            return;
        if (r.status === 'cancelled' || r.status === 'no_show')
            return;
        bookedRanges.push({ from: r.date, to: r.checkOutDate });
    });
    // WhatsApp business number
    let whatsappBusinessNumber = null;
    try {
        const integ = await db.doc(`companies/${found.companyId}/integrations/whatsapp`).get();
        if (integ.exists) {
            const data = integ.data();
            whatsappBusinessNumber = data['displayPhoneNumber']
                ?? data['phoneNumberId'] ?? null;
        }
    }
    catch { /* non-blocking */ }
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
            imageUrls: sd['imageUrls'] ?? [],
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
            amenities: sd['amenities'] ?? [],
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
router.get('/calendar/:storeId.ics', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { storeId } = req.params;
    const token = req.query['token'];
    if (!token)
        throw new error_middleware_1.AppError('Token required.', 401);
    const db = (0, firebase_config_1.getFirestore)();
    // Cross-company lookup by storeId is expensive — instead, the URL convention
    // includes companyId before storeId. To keep URLs short, we stash both in
    // a single hash. Simpler: find the store + verify token matches.
    // We do collectionGroup so the URL doesn't need companyId.
    const snap = await db.collectionGroup('stores').where('icalToken', '==', token).limit(1).get();
    if (snap.empty)
        throw new error_middleware_1.AppError('Invalid token.', 401);
    const storeDoc = snap.docs[0];
    if (storeDoc.id !== storeId)
        throw new error_middleware_1.AppError('Token / store mismatch.', 403);
    const sd = storeDoc.data();
    const companyId = storeDoc.ref.parent.parent.id;
    const storeName = sd['name'] ?? 'Store';
    const reservationsSnap = await db
        .collection(`companies/${companyId}/stores/${storeId}/reservations`)
        .limit(500).get();
    const today = new Date();
    const cutoff = new Date(today.getTime() - 90 * 86400000); // last 90d + future
    const escape = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const fmt = (d) => d.replace(/-/g, ''); // YYYY-MM-DD → YYYYMMDD
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:-//Orlode//${escape(storeName)}//FR`,
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escape(storeName + ' — Réservations')}`,
        `X-WR-TIMEZONE:Africa/Abidjan`,
    ];
    for (const d of reservationsSnap.docs) {
        const r = d.data();
        if (!r.date)
            continue;
        if (r.status === 'cancelled')
            continue;
        const checkOut = r.checkOutDate ?? r.date;
        // Skip ancient bookings to keep the feed light
        try {
            if (new Date(checkOut) < cutoff)
                continue;
        }
        catch { /* ignore */ }
        const stamp = r.createdAt?.toDate?.()?.toISOString().replace(/[-:]|\.\d+/g, '') ?? new Date().toISOString().replace(/[-:]|\.\d+/g, '');
        const status = r.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE';
        lines.push('BEGIN:VEVENT', `UID:${d.id}@orlode.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${fmt(r.date)}`, `DTEND;VALUE=DATE:${fmt(checkOut)}`, `SUMMARY:${escape(`Réservé — ${r.customerName ?? 'Client'} (${r.partySize ?? 1}p)`)}`, `STATUS:${status}`, `TRANSP:OPAQUE`, 'END:VEVENT');
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
router.post('/face-preview', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { companyId, storeId, productId, imageBase64, imageMimeType } = req.body;
    if (!companyId || !storeId || !productId)
        throw new error_middleware_1.AppError('companyId / storeId / productId required.', 400);
    if (!imageBase64 || imageBase64.length < 100)
        throw new error_middleware_1.AppError('Image manquante.', 400);
    const db = (0, firebase_config_1.getFirestore)();
    // Only allow on service stores with the right sub-type
    const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
    if (!storeSnap.exists)
        throw new error_middleware_1.AppError('Store introuvable.', 404);
    const sd = storeSnap.data();
    if (sd.businessType !== 'service')
        throw new error_middleware_1.AppError('Aperçu IA disponible uniquement sur les salons.', 403);
    const allowed = new Set(['esthetique', 'coiffure', 'barber']);
    if (sd.salonType && !allowed.has(sd.salonType)) {
        throw new error_middleware_1.AppError('Aperçu IA non disponible pour ce type de salon.', 403);
    }
    const prodSnap = await db.doc(`companies/${companyId}/stores/${storeId}/products/${productId}`).get();
    if (!prodSnap.exists)
        throw new error_middleware_1.AppError('Service introuvable.', 404);
    const product = prodSnap.data();
    // Pull up to 3 consented reference photos. Photos without an explicit
    // consentForAI:true flag are silently ignored — they may legally be
    // shown in galleries (owner's publication right) but cannot legally be
    // used as IA style references without per-photo signed consent.
    const refUrls = [];
    if (Array.isArray(product.examplePhotos)) {
        for (const entry of product.examplePhotos) {
            if (typeof entry === 'object' && entry?.consentForAI === true && typeof entry.url === 'string') {
                refUrls.push(entry.url);
                if (refUrls.length >= 3)
                    break;
            }
        }
    }
    // Download each reference into base64 (Gemini accepts data URLs)
    const refParts = [];
    for (const url of refUrls) {
        try {
            const r = await fetch(url);
            if (!r.ok)
                continue;
            const ab = await r.arrayBuffer();
            const buf = Buffer.from(ab);
            if (buf.length > 4 * 1024 * 1024)
                continue;
            const ct = r.headers.get('content-type') ?? 'image/jpeg';
            refParts.push({ media: { url: `data:${ct};base64,${buf.toString('base64')}` } });
        }
        catch { /* skip broken ref */ }
    }
    // Decode base64 selfie, cap size at ~4 MB
    const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
    if (buffer.length > 4 * 1024 * 1024)
        throw new error_middleware_1.AppError('Image trop lourde (max 4 Mo).', 413);
    const inputMime = imageMimeType ?? 'image/jpeg';
    // Build the transformation prompt — Gemini receives the customer's selfie
    // (always last so it's the "subject") plus optional consented reference
    // photos as style guides, plus this instruction.
    const refIntro = refParts.length > 0
        ? `Les ${refParts.length} première${refParts.length > 1 ? 's' : ''} photo${refParts.length > 1 ? 's sont des' : ' est une'} exemple${refParts.length > 1 ? 's' : ''} de transformation déjà réalisé${refParts.length > 1 ? 'es' : ''} par notre salon (style, finition, qualité). La DERNIÈRE photo est la cliente. `
        : '';
    const prompt = `Tu es un expert en visualisation beauté. ${refIntro}Reprends EXACTEMENT le visage et la peau de la personne sur la DERNIÈRE photo (mêmes traits, même teint, même expression) et applique ce service : ${product.name}${product.description ? ` (${product.description})` : ''}.${refParts.length > 0 ? ' Inspire-toi du style/qualité des exemples mais GARDE le visage de la dernière photo, pas celui des exemples.' : ''} Résultat photoréaliste, naturel, qualité photo studio, cadrage portrait. NE CHANGE PAS l'identité de la cliente. NE CRÉE PAS un autre visage. Garde la pose originale.`;
    let imageBuffer = null;
    let outputMime = 'image/png';
    const errors = [];
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
    const { ai } = await Promise.resolve().then(() => __importStar(require('../config/genkit.config')));
    const extractImage = (resp) => {
        const parts = [];
        if (resp.message?.content)
            parts.push(...resp.message.content);
        if (resp.content)
            parts.push(...resp.content);
        for (const p of parts) {
            if (p?.media?.url) {
                const m = /^data:([^;]+);base64,(.+)$/.exec(p.media.url);
                if (m)
                    return { buffer: Buffer.from(m[2] ?? '', 'base64'), contentType: m[1] ?? 'image/png' };
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
            });
            const got = extractImage(response);
            if (got) {
                imageBuffer = got.buffer;
                outputMime = got.contentType;
                break;
            }
            errors.push(`${c.model}: no image`);
        }
        catch (err) {
            errors.push(`${c.model}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    if (!imageBuffer) {
        throw new error_middleware_1.AppError(`Génération IA indisponible. Détails : ${errors[errors.length - 1] ?? 'unknown'}`, 503);
    }
    // Save to Storage with short-lived signed URL (1h)
    const { getStorage } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
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
exports.default = router;
//# sourceMappingURL=publicCommerce.routes.js.map