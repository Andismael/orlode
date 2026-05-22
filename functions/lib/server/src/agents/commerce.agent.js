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
exports.COMMERCE_TOOLS = exports.COMMERCE_PUBLIC_TOOLS = exports.COMMERCE_OWNER_TOOLS = exports.listPractitionersTool = exports.analyzeMyBusinessTool = exports.storeSummaryTool = exports.listMyStoresTool = exports.bookViewingTool = exports.bookConsultationTool = exports.bookAppointmentTool = exports.createBookingTool = exports.createReservationTool = exports.deleteProductTool = exports.updateProductStatusTool = exports.updateProductStockTool = exports.updateProductPriceTool = exports.markOrderPaidTool = exports.getOrdersTool = exports.registerRestockInterestTool = exports.placeOrderTool = exports.listProductsTool = void 0;
exports.setStorePin = setStorePin;
exports.verifyStorePin = verifyStorePin;
exports.markPinVerifiedInSession = markPinVerifiedInSession;
exports.isPinVerifiedInSession = isPinVerifiedInSession;
exports.isUltraSensitive = isUltraSensitive;
exports.slugify = slugify;
exports.generateUniqueSlug = generateUniqueSlug;
exports.findStoreBySlug = findStoreBySlug;
exports.ensureStoreSlug = ensureStoreSlug;
exports.findReservationConflict = findReservationConflict;
exports.parseProductCaption = parseProductCaption;
exports.findStoreByOwnerPhone = findStoreByOwnerPhone;
exports.startOwnerOtp = startOwnerOtp;
exports.verifyOwnerOtp = verifyOwnerOtp;
exports.isOwnerSessionValid = isOwnerSessionValid;
exports.resumePendingProductPhoto = resumePendingProductPhoto;
exports.generateProductDraft = generateProductDraft;
exports.analyzeProductImage = analyzeProductImage;
exports.parseVariantReply = parseVariantReply;
exports.applyVariantsToLastProduct = applyVariantsToLastProduct;
exports.handleOwnerPhotoUpload = handleOwnerPhotoUpload;
exports.handleOwnerTelegramPhoto = handleOwnerTelegramPhoto;
exports.matchDeliveryZone = matchDeliveryZone;
exports.notifyRestockInterests = notifyRestockInterests;
exports.findProductByName = findProductByName;
exports.parseOwnerCommand = parseOwnerCommand;
exports.executeOwnerCommand = executeOwnerCommand;
exports.isMutatingBusinessAction = isMutatingBusinessAction;
exports.detectBusinessIntent = detectBusinessIntent;
exports.detectStoreBusinessType = detectStoreBusinessType;
exports.findAllStoresByOwnerPhone = findAllStoresByOwnerPhone;
exports.detectOrlodeMention = detectOrlodeMention;
exports.proposeUpsellAfterOrder = proposeUpsellAfterOrder;
exports.runCommerceDailyJob = runCommerceDailyJob;
exports.runReservationReminders = runReservationReminders;
exports.runStayCycleMessages = runStayCycleMessages;
exports.runMorningBrief = runMorningBrief;
exports.runStockAlerts = runStockAlerts;
/**
 * Commerce Agent — Boutique WhatsApp (Phase 1 minimal)
 *
 * Pitch: "Vends sur WhatsApp avec une photo."
 *
 * Phase 1 scope (intentionally minimal — see feedback_phase1_minimal):
 *   - WhatsApp only, 1 store per company, XOF/CI default
 *   - Owner sends photo → product created automatically (the WAOUH)
 *   - Customer asks → agent lists products, takes order
 *   - Payment = cash on delivery / manual Wave/OM link (Phase 2 = automated)
 *   - OTP gate for owner write actions (24h session)
 *
 * Cut from Phase 1: multi-currency, multi-gateway, FX, crypto, Telegram,
 * AI media generation, Facebook catalog, sub-agent split, advanced audit.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const logger_1 = require("../utils/logger");
const crypto_1 = require("crypto");
const metaCatalogSync_1 = require("../services/commerce/metaCatalogSync");
const openingHoursCheck_1 = require("../utils/openingHoursCheck");
const icalImport_1 = require("../services/commerce/icalImport");
const GRAPH_API = 'https://graph.facebook.com/v21.0';
// ── PIN helpers ─────────────────────────────────────────────────────────────
const hashPin = (pin) => (0, crypto_1.createHash)('sha256').update(pin).digest('hex');
async function setStorePin(companyId, storeId, pin) {
    if (!/^\d{4,6}$/.test(pin))
        return { ok: false, reason: 'PIN doit faire 4 à 6 chiffres.' };
    await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}`)
        .update({ pinHash: hashPin(pin), updatedAt: new Date() });
    return { ok: true };
}
async function verifyStorePin(companyId, storeId, pin) {
    if (!pin || !/^\d{4,6}$/.test(pin))
        return false;
    const snap = await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}`).get();
    const stored = snap.data()?.pinHash;
    return !!stored && stored === hashPin(pin);
}
async function markPinVerifiedInSession(companyId, storeId, ownerPhone) {
    await (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/stores/${storeId}/sessions`)
        .doc(normalizePhone(ownerPhone))
        .set({
        pinVerifiedAt: new Date(),
        // PIN session lasts 24h like OTP
        pinExpiresAt: new Date(Date.now() + SESSION_TTL_MS),
        updatedAt: new Date(),
    }, { merge: true });
}
async function isPinVerifiedInSession(companyId, storeId, ownerPhone) {
    const snap = await (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/stores/${storeId}/sessions`)
        .doc(normalizePhone(ownerPhone)).get();
    if (!snap.exists)
        return false;
    const d = snap.data();
    const exp = d.pinExpiresAt instanceof Date ? d.pinExpiresAt : d.pinExpiresAt?.toDate?.();
    return !!exp && exp.getTime() > Date.now();
}
// Detects WhatsApp messages that touch ultra-sensitive ops (financial
// reports, mass exports, refunds, mass deletions). These trigger a PIN
// challenge before the orchestrator/Clone runs.
function isUltraSensitive(text) {
    if (!text)
        return false;
    const t = text.toLowerCase();
    return (/\b(export\w*|exporte\w*)\b.*\b(client|commande|tout|tous|all)/i.test(t) ||
        /\brembours\w*\b|\brefund\w*\b/i.test(t) ||
        /\b(supprime\w*|delete\w*|efface\w*)\b.*\b(tout|tous|toutes|all|cat[ée]gorie|client)/i.test(t) ||
        /\b(rapport\s+financier|bilan\s+complet|revenu\s+total|encaiss[ée]\s+total)\b/i.test(t) ||
        /\bd[ée]tails?\s+(?:de\s+)?(?:tous|toutes)\s+(?:les\s+)?(client|commande)/i.test(t) ||
        /\bliste\s+(?:de\s+)?(?:tous|toutes)\s+(?:les\s+)?clients?\b/i.test(t));
}
// ── Slug generation ──────────────────────────────────────────────────────────
// Public storefront URL is /shop/{slug}. Slug is auto-generated from name on
// store creation. Globally unique — collision-checked across all stores.
function slugify(name) {
    // Strip accents via Unicode NFD decomposition + remove combining marks.
    // Uses explicit \u escape so the source file stays ASCII-safe.
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
        .replace(/[^\w\s-]/g, '') // strip non-word chars
        .replace(/\s+/g, '-') // spaces -> dashes
        .replace(/-+/g, '-') // collapse dashes
        .replace(/^-|-$/g, '') // trim leading/trailing -
        .slice(0, 40) // cap length
        || 'boutique';
}
async function generateUniqueSlug(name) {
    const base = slugify(name);
    const db = (0, firebase_config_1.getFirestore)();
    // Try base first, then base-2, base-3, … up to 12. After that fall back to
    // a 4-hex random suffix to guarantee uniqueness.
    for (let i = 1; i <= 12; i++) {
        const candidate = i === 1 ? base : `${base}-${i}`;
        const snap = await db.collectionGroup('stores')
            .where('slug', '==', candidate).limit(1).get().catch(() => null);
        if (!snap || snap.empty)
            return candidate;
    }
    return `${base}-${(0, crypto_1.randomBytes)(2).toString('hex')}`;
}
/**
 * Lookup a store by its public slug. Returns { companyId, storeId, store } or null.
 * Used by the public storefront endpoint.
 */
async function findStoreBySlug(slug) {
    if (!slug)
        return null;
    const snap = await (0, firebase_config_1.getFirestore)().collectionGroup('stores')
        .where('slug', '==', slug).limit(1).get().catch(() => null);
    if (!snap || snap.empty)
        return null;
    const doc = snap.docs[0];
    const parent = doc.ref.parent.parent; // companies/{companyId}
    if (!parent)
        return null;
    return { companyId: parent.id, storeId: doc.id, store: doc.data() };
}
/**
 * Ensure a store has a slug; if missing, generate and save one.
 * Used to backfill existing stores transparently on first read.
 */
async function ensureStoreSlug(companyId, storeId, store) {
    if (store.slug)
        return store.slug;
    const slug = await generateUniqueSlug(store.name);
    await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}`)
        .update({ slug, updatedAt: new Date() });
    logger_1.logger.info('[Commerce] Backfilled store slug', { companyId, storeId, slug });
    return slug;
}
// ── Reservation slot-conflict check (shared by AI tools + admin POST) ──────
// Returns null when no conflict, otherwise the conflicting reservation's time.
// Used by bookAppointmentTool, bookConsultationTool, bookViewingTool to refuse
// double-booking on serviceId+practitioner / cabinet (health) / property+agent.
const reservationMinutes = (t) => {
    const [h, m] = t.split(':').map(n => parseInt(n, 10));
    return h * 60 + m;
};
async function findReservationConflict(args) {
    const db = (0, firebase_config_1.getFirestore)();
    const newStart = reservationMinutes(args.time);
    let q = db.collection(`companies/${args.companyId}/stores/${args.storeId}/reservations`)
        .where('date', '==', args.date);
    if (args.scope.kind === 'service')
        q = q.where('serviceId', '==', args.scope.serviceId);
    if (args.scope.kind === 'table')
        q = q.where('tableId', '==', args.scope.tableId);
    const snap = await q.get().catch(() => null);
    if (!snap)
        return null;
    for (const d of snap.docs) {
        const r = d.data();
        if (!r.time)
            continue;
        if (r.status === 'cancelled' || r.status === 'no_show')
            continue;
        if (Math.abs(reservationMinutes(r.time) - newStart) >= args.slotMinutes)
            continue;
        // Practitioner gating: if both have a practitioner and they differ, skip
        const askedPract = ('practitionerName' in args.scope) ? args.scope.practitionerName?.trim() : undefined;
        if (askedPract && r.practitionerName && askedPract !== r.practitionerName)
            continue;
        return { time: r.time };
    }
    return null;
}
// ── Caption parser: "iPhone 13 - 150000" or "iPhone 13 22$ 10 en stock" ─────
// Smart parser:
//   1. Detect explicit "X stock" / "stock X" patterns and extract stockQty
//   2. Detect currency symbol/code ($ € £ XOF EUR etc.)
//   3. The remaining last number = price
//   4. Everything before price = name
function parseProductCaption(caption) {
    if (!caption)
        return null;
    let cleaned = caption.replace(/\s+/g, ' ').trim();
    // 1. Detect currency
    let detectedCurrency;
    const currencyMatch = cleaned.match(/[\$€£¥]|\b(usd|eur|xof|xaf|gbp|cad|nzd|chf|fcfa|cfa)\b/i);
    if (currencyMatch) {
        const sym = currencyMatch[0].toLowerCase();
        if (sym === '$')
            detectedCurrency = 'USD';
        else if (sym === '€')
            detectedCurrency = 'EUR';
        else if (sym === '£')
            detectedCurrency = 'GBP';
        else if (sym === '¥')
            detectedCurrency = 'JPY';
        else if (sym === 'fcfa' || sym === 'cfa')
            detectedCurrency = 'XOF';
        else
            detectedCurrency = sym.toUpperCase();
    }
    // 2. Extract & strip stock indicators BEFORE finding the price
    let stock;
    const stockPatterns = [
        /\b(\d+)\s+(?:en\s+)?stocks?\b/i, // "10 en stock", "10 stock", "10 stocks"
        /\bstocks?\s*[:=]?\s*(\d+)\b/i, // "stock 10", "stock: 10", "stock=10"
        /\b(\d+)\s+pi[èe]ces?\b/i, // "10 pièces"
        /\b(\d+)\s+disponibles?\b/i, // "10 disponibles"
    ];
    for (const re of stockPatterns) {
        const m = re.exec(cleaned);
        if (m) {
            const n = parseInt(m[1], 10);
            if (!isNaN(n) && n >= 0)
                stock = n;
            cleaned = cleaned.replace(re, '').trim();
            break;
        }
    }
    // 3. Find the price (last numeric token in remaining text)
    const matches = cleaned.match(/[\d][\d\s.,]*\d|\d/g);
    if (!matches || matches.length === 0)
        return null;
    const lastNumberRaw = matches[matches.length - 1];
    const price = parseInt(lastNumberRaw.replace(/[\s.,]/g, ''), 10);
    if (isNaN(price) || price <= 0)
        return null;
    // 4. Name = everything before the price, minus currency/separator tokens
    const lastIdx = cleaned.lastIndexOf(lastNumberRaw);
    let name = cleaned.slice(0, lastIdx).replace(/[-–—:|]+\s*$/, '').trim();
    name = name.replace(/[\$€£¥]/g, '').trim();
    name = name.replace(/\b(xof|xaf|fcfa|cfa|usd|eur|gbp|cad|chf|f)\b/gi, '').trim();
    // Trim trailing dots/spaces left over from inputs like "Chemise..22"
    name = name.replace(/[.\s]+$/, '').trim();
    if (!name || name.length < 2)
        return null;
    return {
        name,
        price,
        ...(typeof stock === 'number' ? { stock } : {}),
        ...(detectedCurrency ? { currency: detectedCurrency } : {}),
    };
}
// ── Store + owner lookup ──────────────────────────────────────────────────────
// Normalize phone numbers for matching: keep only digits.
const normalizePhone = (raw) => (raw ?? '').replace(/\D/g, '');
/**
 * Find a store where the given phone is the owner.
 * Returns { companyId, storeId, store } or null.
 *
 * Two paths:
 *  1. If companyId is known (webhook already resolved it from phoneNumberId),
 *     query directly under companies/{cid}/stores — no index required, fast.
 *  2. Otherwise fall back to collectionGroup (requires composite index).
 */
async function findStoreByOwnerPhone(fromPhone, scopedCompanyId) {
    const digits = normalizePhone(fromPhone);
    if (!digits)
        return null;
    const db = (0, firebase_config_1.getFirestore)();
    const variants = Array.from(new Set([digits, '+' + digits, '00' + digits]));
    // FAST PATH: scoped query under a known company. No composite index needed.
    if (scopedCompanyId) {
        for (const v of variants) {
            const snap = await db.collection(`companies/${scopedCompanyId}/stores`)
                .where('ownerPhone', '==', v)
                .limit(1)
                .get()
                .catch((err) => {
                logger_1.logger.warn('[Commerce] scoped store query failed', { companyId: scopedCompanyId, variant: v, error: String(err) });
                return null;
            });
            if (snap && !snap.empty) {
                const doc = snap.docs[0];
                logger_1.logger.info('[Commerce] Owner store matched (scoped)', {
                    from: fromPhone, variant: v, storeId: doc.id, companyId: scopedCompanyId,
                });
                return {
                    companyId: scopedCompanyId,
                    storeId: doc.id,
                    store: doc.data(),
                };
            }
        }
        // Also check: maybe the stored ownerPhone has a different format. Pull
        // ALL stores of this company (max ~5) and digit-compare in JS.
        const allSnap = await db.collection(`companies/${scopedCompanyId}/stores`).limit(10).get().catch(() => null);
        if (allSnap && !allSnap.empty) {
            for (const doc of allSnap.docs) {
                const data = doc.data();
                const storedDigits = normalizePhone(data.ownerPhone ?? '');
                if (storedDigits && storedDigits === digits) {
                    logger_1.logger.info('[Commerce] Owner store matched (digit-compare fallback)', {
                        from: fromPhone, stored: data.ownerPhone, storeId: doc.id, companyId: scopedCompanyId,
                    });
                    return { companyId: scopedCompanyId, storeId: doc.id, store: data };
                }
            }
            // Log what we DID find to help diagnose the mismatch
            logger_1.logger.info('[Commerce] No owner-phone match within company', {
                from: fromPhone,
                digits,
                companyId: scopedCompanyId,
                storesChecked: allSnap.docs.map(d => ({
                    id: d.id,
                    storedOwnerPhone: d.data().ownerPhone,
                })),
            });
        }
        return null;
    }
    // FALLBACK: cross-company collectionGroup query. Requires composite index
    // on `stores.ownerPhone`. If the index isn't created, this fails silently.
    for (const v of variants) {
        const snap = await db.collectionGroup('stores')
            .where('ownerPhone', '==', v)
            .limit(1)
            .get()
            .catch((err) => {
            logger_1.logger.warn('[Commerce] collectionGroup query failed', { variant: v, error: String(err) });
            return null;
        });
        if (snap && !snap.empty) {
            const doc = snap.docs[0];
            const parent = doc.ref.parent.parent; // companies/{companyId}
            if (parent) {
                return {
                    companyId: parent.id,
                    storeId: doc.id,
                    store: doc.data(),
                };
            }
        }
    }
    logger_1.logger.info('[Commerce] No store matched owner phone (collectionGroup)', { from: fromPhone, variantsTried: variants });
    return null;
}
// ── OTP / session ─────────────────────────────────────────────────────────────
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const OTP_TTL_MS = 5 * 60 * 1000; // 5 min
const hashOtp = (code) => (0, crypto_1.createHash)('sha256').update(code).digest('hex');
async function startOwnerOtp(companyId, storeId, phone) {
    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection(`companies/${companyId}/stores/${storeId}/sessions`)
        .doc(normalizePhone(phone))
        .set({
        phone,
        role: 'owner',
        verified: false,
        otpHash: hashOtp(code),
        otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
        createdAt: new Date(),
    }, { merge: true });
    return code;
}
async function verifyOwnerOtp(companyId, storeId, phone, code) {
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/stores/${storeId}/sessions`)
        .doc(normalizePhone(phone));
    const snap = await ref.get();
    if (!snap.exists)
        return { ok: false, reason: 'no_session' };
    const data = snap.data();
    const expiresAt = data.otpExpiresAt instanceof Date ? data.otpExpiresAt : data.otpExpiresAt?.toDate?.();
    if (!expiresAt || expiresAt.getTime() < Date.now())
        return { ok: false, reason: 'expired' };
    if ((data.attempts ?? 0) >= 5)
        return { ok: false, reason: 'too_many_attempts' };
    if (data.otpHash !== hashOtp(code)) {
        await ref.update({ attempts: (data.attempts ?? 0) + 1 });
        return { ok: false, reason: 'wrong_code' };
    }
    await ref.update({
        verified: true,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        otpHash: null,
        otpExpiresAt: null,
        attempts: 0,
    });
    return { ok: true };
}
async function isOwnerSessionValid(companyId, storeId, phone) {
    const snap = await (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/stores/${storeId}/sessions`)
        .doc(normalizePhone(phone))
        .get();
    if (!snap.exists)
        return false;
    const d = snap.data();
    if (!d.verified)
        return false;
    const exp = d.expiresAt instanceof Date ? d.expiresAt : d.expiresAt?.toDate?.();
    return !!exp && exp.getTime() > Date.now();
}
/**
 * After a successful OTP verification, check whether the user had sent a photo
 * before the OTP gate triggered. If so, resume product creation transparently
 * (the user shouldn't have to re-send the photo). Returns the resume result so
 * the caller can chain the reply with the OTP success message.
 *
 * Called from the WhatsApp inbound handler right after verifyOwnerOtp() succeeds.
 */
async function resumePendingProductPhoto(args) {
    const { companyId, storeId, ownerPhone, accessToken } = args;
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/stores/${storeId}/sessions`)
        .doc(normalizePhone(ownerPhone));
    const snap = await ref.get().catch(() => null);
    const pending = snap?.data()?.['pendingProductPhoto'];
    if (!pending?.imageId)
        return null;
    // Clear first — a failed re-upload shouldn't loop. The user can always resend
    // the photo manually if anything below explodes.
    await ref.set({ pendingProductPhoto: null }, { merge: true });
    // Stale guard: don't resume photos older than 10 minutes — the user likely
    // moved on and the access token may have rotated.
    const receivedAt = pending.receivedAt instanceof Date
        ? pending.receivedAt
        : pending.receivedAt?.toDate?.();
    if (receivedAt && Date.now() - receivedAt.getTime() > 10 * 60 * 1000) {
        return null;
    }
    return handleOwnerPhotoUpload({
        companyId,
        storeId,
        ownerPhone,
        imageId: pending.imageId,
        caption: pending.caption ?? undefined,
        accessToken,
    });
}
// ── Image download from Meta ─────────────────────────────────────────────────
async function downloadMediaFromMeta(imageId, accessToken) {
    const mediaRes = await fetch(`${GRAPH_API}/${imageId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mediaRes.ok)
        throw new Error(`Meta media URL failed: ${mediaRes.status}`);
    const mediaData = await mediaRes.json();
    if (!mediaData.url)
        throw new Error('No media URL from Meta');
    const imgRes = await fetch(mediaData.url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!imgRes.ok)
        throw new Error(`Meta image download failed: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    return { buffer, mimeType: mediaData.mime_type ?? 'image/jpeg' };
}
async function uploadBufferToStorage(buffer, mimeType, companyId, storeId) {
    const ext = mimeType.split('/')[1]?.split('+')[0] ?? 'jpg';
    const fileName = `companies/${companyId}/stores/${storeId}/products/${(0, crypto_1.randomBytes)(8).toString('hex')}.${ext}`;
    const bucket = (0, firebase_config_1.getStorage)().bucket();
    const file = bucket.file(fileName);
    await file.save(buffer, {
        metadata: { contentType: mimeType },
        public: true,
    });
    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
}
// Fetch a product page and extract title + meta + visible text — feeds the
// "import par lien" flow (Tommy.com, Amazon, Jumia, AliExpress). Best-effort:
// returns null silently if the page is unreachable or blocks crawlers.
async function fetchProductPageText(url) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const r = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Orlode-AI/1.0) AppleWebKit/537.36' },
        });
        clearTimeout(timer);
        if (!r.ok)
            return null;
        const ct = r.headers.get('content-type') ?? '';
        if (!ct.includes('text/html'))
            return null;
        let html = await r.text();
        if (html.length > 400000)
            html = html.slice(0, 400000);
        // Extract title + og:* meta + visible text
        const title = (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '').trim();
        const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] ?? '').trim();
        const ogDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1] ?? '').trim();
        const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] ?? '').trim();
        // JSON-LD product (most reliable on Amazon, Jumia, Shopify, etc.)
        const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
        let jsonLdSnippet = '';
        if (jsonLdMatch) {
            try {
                const parsed = JSON.parse(jsonLdMatch[1].trim());
                const product = Array.isArray(parsed) ? parsed.find(p => p['@type'] === 'Product') : (parsed['@type'] === 'Product' ? parsed : null);
                if (product) {
                    jsonLdSnippet = JSON.stringify({
                        name: product.name, description: product.description,
                        brand: product.brand?.name ?? product.brand,
                        offers: product.offers ? { price: product.offers.price, currency: product.offers.priceCurrency } : undefined,
                        category: product.category,
                    });
                }
            }
            catch { /* ignore parse errors */ }
        }
        // Visible text fallback — strip tags + scripts/styles
        const visible = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 2500);
        const summary = [
            title && `Title: ${title}`,
            ogTitle && ogTitle !== title && `OG: ${ogTitle}`,
            ogDesc && `OG-desc: ${ogDesc}`,
            metaDesc && metaDesc !== ogDesc && `Meta: ${metaDesc}`,
            jsonLdSnippet && `JSON-LD: ${jsonLdSnippet}`,
            visible && `Body: ${visible}`,
        ].filter(Boolean).join('\n');
        return summary.length > 80 ? summary : null;
    }
    catch (err) {
        logger_1.logger.warn('[Commerce] fetchProductPageText failed', { url, error: String(err) });
        return null;
    }
}
async function generateProductDraft(args) {
    try {
        // If a URL is provided, fetch it and feed the scraped text to the LLM as context
        let scrapedContext = null;
        if (args.productUrl && /^https?:\/\//i.test(args.productUrl)) {
            scrapedContext = await fetchProductPageText(args.productUrl);
        }
        const ctxLines = [
            args.freeText ? `Texte libre du commerçant : "${args.freeText}"` : '',
            args.productUrl ? `Lien produit officiel : ${args.productUrl}` : '',
            scrapedContext ? `\nContenu extrait de la page (titre, description, JSON-LD, body) :\n${scrapedContext}` : '',
            typeof args.basePrice === 'number' ? `Prix fixé par le commerçant : ${args.basePrice} ${args.currency}` : 'Prix non fixé — propose un prix réaliste pour le marché ivoirien/ouest-africain.',
            typeof args.stockQty === 'number' ? `Stock : ${args.stockQty}` : '',
        ].filter(Boolean).join('\n');
        const textPart = { text: `Tu es l'agent catalogue de Orlode AI pour un commerçant africain (marché Côte d'Ivoire, Sénégal, Cameroun). Crée une fiche produit complète à partir de la photo et du contexte ci-dessous.

${ctxLines}

Retourne UNIQUEMENT du JSON valide (pas de markdown, pas de texte autour) :
{
  "name": "Titre court vendeur, 2-5 mots (ex: 'Polo Tommy Rayé Marine')",
  "description": "1-2 phrases vendeuses en français, marché ivoirien, max 200 caractères",
  "descriptionLong": "4-6 phrases de storytelling : matière, usage, occasions, ce qui fait la valeur. Français premium, marché africain.",
  "category": "CATÉGORIE LARGE (1-2 mots) parmi : 'Vêtements', 'Vêtements traditionnels', 'Chaussures', 'Bijoux', 'Sacs & Maroquinerie', 'Cosmétique', 'Téléphones & Électronique', 'Décoration', 'Alimentaire', 'Accessoires'. Si rien ne correspond, propose une catégorie large à toi (1-2 mots).",
  "subcategory": "TYPE SPÉCIFIQUE (1-2 mots) — ex: 'Polo', 'T-shirt', 'Sneakers', 'Sandales', 'Crème visage', 'iPhone', 'Boubou'. Plus précis que la catégorie. null si non pertinent.",
  "brand": "marque détectée si visible (Tommy, Lacoste, Nike...) ou null",
  "tags": ["3-6 mots-clés concrets, sans phrases"],
  "colors": ["bleu", "blanc"],
  "variants": [{"name": "M"}, {"name": "L"}],
  // Si vêtement → tailles standards (XS, S, M, L, XL) mentionnées ou détectées dans le texte libre.
  // Si chaussure → pointures (38, 39, 40, 41, 42, 43, 44).
  // Si téléphone → capacités (128 GB, 256 GB) ou couleurs principales.
  // Si pas pertinent (cosmétique, produit unique) → tableau vide [].
  // Format: { "name": "M" } ou { "name": "Bleu marine", "color": "Bleu marine" }.
  "suggestedPrice": ${typeof args.basePrice === 'number' ? args.basePrice : 'nombre suggéré FCFA pour marché ivoirien'},
  "suggestedOriginalPrice": ${typeof args.basePrice === 'number' ? `${Math.round(args.basePrice * 1.3)}` : 'nombre supérieur de 20-40% au prix pour effet promo, ou null'},
  "photoQualityScore": 1-5,
  "photoSuggestion": "phrase courte si fond moche, lumière médiocre, ou photo mal cadrée — sinon null",
  "suggestedBadges": ["featured" si produit vendeur+belle photo, "rare" si stock ≤ 2 et produit premium, "promo" si suggestedOriginalPrice > suggestedPrice, "new" si nouveauté visible],
  "confidence": "high|medium|low"
}

🚫 RÈGLES :
- N'invente PAS de marque que tu ne vois pas clairement.
- N'invente PAS un prix surévalué — reste réaliste pour le pouvoir d'achat ouest-africain.
- Si l'image est absente, devine depuis le texte libre uniquement et baisse confidence.
- photoSuggestion : honnête mais bienveillante (jamais "moche", "horrible").
- JSON pur, rien d'autre.` };
        const safeMime = args.imageBuffer && args.mimeType
            ? (args.mimeType.startsWith('image/') ? args.mimeType : 'image/jpeg')
            : null;
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: args.imageBuffer && safeMime
                ? [
                    { media: { contentType: safeMime, url: `data:${safeMime};base64,${args.imageBuffer.toString('base64')}` } },
                    textPart,
                ]
                : [textPart],
            config: { temperature: 0.4 },
        });
        const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        if (!parsed.name || !parsed.category)
            return null;
        return {
            name: parsed.name,
            description: parsed.description ?? '',
            descriptionLong: parsed.descriptionLong ?? '',
            category: parsed.category,
            ...(parsed.subcategory ? { subcategory: parsed.subcategory } : {}),
            ...(parsed.brand ? { brand: parsed.brand } : {}),
            tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
            colors: Array.isArray(parsed.colors) ? parsed.colors.slice(0, 5) : [],
            variants: Array.isArray(parsed.variants)
                ? parsed.variants
                    .filter(v => typeof v === 'object' && v !== null)
                    .map(v => ({
                    name: String(v.name ?? v.size ?? v.color ?? '').trim(),
                    ...(v.size ? { size: String(v.size).trim() } : {}),
                    ...(v.color ? { color: String(v.color).trim() } : {}),
                }))
                    .filter(v => v.name.length > 0)
                    .slice(0, 12)
                : [],
            ...(typeof parsed.suggestedPrice === 'number' ? { suggestedPrice: parsed.suggestedPrice } : {}),
            ...(typeof parsed.suggestedOriginalPrice === 'number' ? { suggestedOriginalPrice: parsed.suggestedOriginalPrice } : {}),
            photoQualityScore: typeof parsed.photoQualityScore === 'number' ? Math.max(1, Math.min(5, parsed.photoQualityScore)) : 3,
            ...(parsed.photoSuggestion ? { photoSuggestion: parsed.photoSuggestion } : {}),
            suggestedBadges: Array.isArray(parsed.suggestedBadges) ? parsed.suggestedBadges.filter(b => ['featured', 'rare', 'promo', 'new'].includes(b)) : [],
            confidence: parsed.confidence ?? 'medium',
        };
    }
    catch (err) {
        logger_1.logger.error('[Commerce] generateProductDraft failed', { error: err instanceof Error ? err.message : String(err) });
        return null;
    }
}
async function analyzeProductImage(imageBuffer, mimeType, productName) {
    try {
        const base64 = imageBuffer.toString('base64');
        const safeMime = (mimeType.startsWith('image/') ? mimeType : 'image/jpeg');
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: [
                { media: { contentType: safeMime, url: `data:${safeMime};base64,${base64}` } },
                {
                    text: `Tu es un assistant catalogue e-commerce pour un commerçant africain. Analyse la photo de ce produit nommé "${productName}".

Retourne UNIQUEMENT du JSON valide :
{
  "category": "catégorie courte en français (ex: 'Vêtements traditionnels', 'Chaussures', 'Téléphones', 'Bijoux', 'Accessoires', 'Cosmétiques', 'Alimentaire', 'Décoration')",
  "description": "description vendeuse de 1-2 phrases courtes en français",
  "tags": ["mot-clé 1", "mot-clé 2", "..."],
  "colors": ["couleur 1", "couleur 2"],
  "confidence": "high|medium|low"
}

🚫 RÈGLES :
- N'invente RIEN. Si tu ne vois pas clairement → confidence: "low" et description honnête.
- Pas de texte autour, pas de markdown — JSON pur.
- Catégorie en 1-3 mots max.
- Tags : 3-6 mots-clés concrets (matériau, type, usage), pas de phrases.
- Couleurs : noms simples ("bleu", "doré"), pas de "bleu-marine 70%".`,
                },
            ],
            config: { temperature: 0.2 },
        });
        const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        if (!parsed.category || !parsed.description)
            return null;
        return {
            category: parsed.category,
            description: parsed.description,
            tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
            colors: Array.isArray(parsed.colors) ? parsed.colors.slice(0, 5) : [],
            confidence: parsed.confidence ?? 'medium',
        };
    }
    catch (err) {
        logger_1.logger.warn('[Commerce] Vision analysis failed (non-blocking)', { error: err instanceof Error ? err.message : err });
        return null;
    }
}
const KNOWN_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL'];
function parseVariantReply(text) {
    if (!text)
        return null;
    const t = text.toLowerCase().trim();
    // "non" / "skip" / "rien" → no variants
    if (/^(non|aucun|aucune|pas|skip|rien|c'est bon|cest bon|ok|nope|no)\b/.test(t)) {
        return null;
    }
    // PATTERN A: "S 2 M 1 XL 7" — known sizes followed by stock numbers
    // Matches each pair greedily.
    const sizeStockRegex = /\b(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl)\b\s*[:=.]?\s*(\d+)/gi;
    const sizeStockMatches = [...t.matchAll(sizeStockRegex)];
    if (sizeStockMatches.length >= 2) {
        const values = sizeStockMatches.map(m => m[1].toUpperCase());
        const stocks = sizeStockMatches.map(m => parseInt(m[2], 10) || 1);
        return { type: 'sizes', values, stocks };
    }
    // PATTERN B: "tailles S M L XL"
    const sizesMatch = /\b(taille|tailles|sizes?)\b\s*[:.]?\s*([\sa-z0-9,/-]+)/i.exec(t);
    if (sizesMatch?.[2]) {
        const tokens = sizesMatch[2]
            .split(/[\s,/-]+/)
            .map(s => s.trim().toUpperCase())
            .filter(s => /^[A-Z0-9]{1,4}$/.test(s) || /^\d{2,3}$/.test(s));
        if (tokens.length > 0)
            return { type: 'sizes', values: tokens };
    }
    // PATTERN C: "couleurs rouge bleu vert" or "couleurs: rouge, bleu"
    const colorsMatch = /\b(couleur|couleurs|colors?)\b\s*[:.]?\s*([\sa-zàâéèêëïîôöùûüÿç,/-]+)/i.exec(t);
    if (colorsMatch?.[2]) {
        const tokens = colorsMatch[2]
            .split(/[\s,/-]+/)
            .map(s => s.trim())
            .filter(s => s.length >= 3 && s.length <= 20);
        if (tokens.length > 0)
            return { type: 'colors', values: tokens };
    }
    // PATTERN D: bare size sequence "S M L XL" (no "tailles" prefix)
    const bareSizeTokens = t.split(/[\s,]+/).filter(s => /^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl)$/i.test(s));
    if (bareSizeTokens.length >= 2) {
        return { type: 'sizes', values: bareSizeTokens.map(s => s.toUpperCase()) };
    }
    return null;
}
async function applyVariantsToLastProduct(companyId, storeId, ownerPhone, parsed) {
    const db = (0, firebase_config_1.getFirestore)();
    const sessionRef = db.collection(`companies/${companyId}/stores/${storeId}/sessions`)
        .doc(normalizePhone(ownerPhone));
    const sessionSnap = await sessionRef.get();
    const lastProductId = sessionSnap.data()?.lastProductId;
    if (!lastProductId)
        return { ok: false };
    const productRef = db.doc(`companies/${companyId}/stores/${storeId}/products/${lastProductId}`);
    const productSnap = await productRef.get();
    if (!productSnap.exists)
        return { ok: false };
    const product = productSnap.data();
    const variants = parsed.values.map((v, i) => {
        const stockQty = parsed.stocks?.[i] ?? 1;
        return {
            name: v,
            sku: `${lastProductId.slice(0, 6)}-${v}`,
            price: product.price,
            stockQty,
            [parsed.type === 'sizes' ? 'size' : 'color']: v,
        };
    });
    const totalStock = variants.reduce((sum, v) => sum + (v.stockQty ?? 0), 0);
    await productRef.update({
        variants,
        stockQty: totalStock,
        status: totalStock > 0 ? 'active' : 'out_of_stock',
        updatedAt: new Date(),
    });
    await sessionRef.update({ lastProductId: null, updatedAt: new Date() });
    return { ok: true, productName: product.name, variantCount: variants.length };
}
async function handleOwnerPhotoUpload(args) {
    const { companyId, storeId, ownerPhone, imageId, caption, accessToken } = args;
    const db = (0, firebase_config_1.getFirestore)();
    // 1. Owner session valid? If not, save the photo context and return OTP challenge.
    // The pendingProductPhoto field lets resumePendingProductPhoto() pick up where we
    // left off after the user validates — otherwise the photo is silently lost and
    // the user has to re-send (real bug observed 2026-05-21 with Robe Kevin Klein).
    const sessionOk = await isOwnerSessionValid(companyId, storeId, ownerPhone);
    if (!sessionOk) {
        const code = await startOwnerOtp(companyId, storeId, ownerPhone);
        await db.collection(`companies/${companyId}/stores/${storeId}/sessions`)
            .doc(normalizePhone(ownerPhone))
            .set({
            pendingProductPhoto: {
                imageId,
                caption: caption ?? null,
                receivedAt: new Date(),
            },
        }, { merge: true });
        return {
            productId: '',
            reply: `🔒 Pour ajouter un produit, envoie-moi ce code de validation : *${code}*\n\n(Valide 5 minutes — ce code prouve que c'est bien toi le propriétaire de la boutique. Dès que tu valides, je crée le produit automatiquement.)`,
        };
    }
    // ── Multi-photo mode: if the owner is currently adding more photos to a
    // recently created product, just append to its imageUrls instead of
    // creating a new one. Triggered by session.awaitingMorePhotosFor =
    // <productId> (set after the first photo of a new product, cleared when
    // the owner types "fini" or sends a photo with a fresh caption).
    const sessionRef = db.collection(`companies/${companyId}/stores/${storeId}/sessions`)
        .doc(normalizePhone(ownerPhone));
    const sessionSnap = await sessionRef.get().catch(() => null);
    const sessionData = sessionSnap?.data();
    const awaitingFor = sessionData?.awaitingMorePhotosFor;
    // Heuristic: if the new photo has a CAPTION with name+price, treat it as a
    // NEW product (the owner moved on). Otherwise, append to the pending one.
    const parsedCaption = parseProductCaption(caption ?? '');
    const isAppending = !!awaitingFor && !parsedCaption;
    if (isAppending && awaitingFor) {
        try {
            const productRef = db.doc(`companies/${companyId}/stores/${storeId}/products/${awaitingFor}`);
            const productSnap = await productRef.get();
            if (!productSnap.exists) {
                // The product was deleted in the meantime — fall back to creating a new one
                await sessionRef.set({ awaitingMorePhotosFor: null }, { merge: true });
            }
            else {
                const { buffer, mimeType } = await downloadMediaFromMeta(imageId, accessToken);
                const newImageUrl = await uploadBufferToStorage(buffer, mimeType, companyId, storeId)
                    .catch(err => { logger_1.logger.error('[Commerce] Storage upload failed (multi)', { error: String(err) }); return undefined; });
                if (!newImageUrl) {
                    return { productId: awaitingFor, reply: `⚠️ Impossible d'uploader cette photo. Réessaie ou tape *fini*.` };
                }
                const data = productSnap.data();
                const existing = (data?.imageUrls && data.imageUrls.length > 0)
                    ? data.imageUrls
                    : (data?.imageUrl ? [data.imageUrl] : []);
                const updated = [...existing, newImageUrl];
                await productRef.set({
                    imageUrls: updated,
                    imageUrl: updated[0],
                    updatedAt: new Date(),
                }, { merge: true });
                logger_1.logger.info('[Commerce] Photo appended to product', {
                    companyId, storeId, productId: awaitingFor, totalImages: updated.length,
                });
                return {
                    productId: awaitingFor,
                    reply: `📸 Photo *${updated.length}* ajoutée à *${data?.name ?? 'ton produit'}* 👍\n\nEnvoie-en d'autres ou tape *fini* pour passer aux variantes.`,
                };
            }
        }
        catch (err) {
            logger_1.logger.error('[Commerce] Multi-photo append failed', { error: err instanceof Error ? err.message : err });
            return { productId: awaitingFor, reply: `❌ Erreur en ajoutant la photo. Réessaie.` };
        }
    }
    // 2. Parse caption for name + price (single-product path)
    const parsed = parsedCaption;
    if (!parsed) {
        return {
            productId: '',
            reply: `📸 J'ai bien reçu la photo. Pour créer le produit, envoie-moi le nom et le prix dans la légende :\n\nExemple : *iPhone 13 - 150000*\n\n(Renvoie la photo avec cette légende.)`,
        };
    }
    // 3. Download image, store it + Agent Catalogue rich draft in parallel.
    // We pass the FULL caption as freeText so the AI can extract brand, vibe,
    // sizes, urgency cues ("plus que 1", "à vendre vite") and propose badges.
    const storeSnapForCtx = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
    const storeCurrency = storeSnapForCtx.data()?.currency ?? 'XOF';
    const productCurrency = parsed.currency ?? storeCurrency;
    const productStock = typeof parsed.stock === 'number' ? parsed.stock : 1;
    let imageUrl;
    let draft = null;
    try {
        const { buffer, mimeType } = await downloadMediaFromMeta(imageId, accessToken);
        const [uploadedUrl, generatedDraft] = await Promise.all([
            uploadBufferToStorage(buffer, mimeType, companyId, storeId).catch(err => {
                logger_1.logger.error('[Commerce] Storage upload failed', { error: String(err) });
                return undefined;
            }),
            generateProductDraft({
                imageBuffer: buffer,
                mimeType,
                freeText: caption,
                basePrice: parsed.price,
                currency: productCurrency,
                stockQty: productStock,
            }),
        ]);
        imageUrl = uploadedUrl;
        draft = generatedDraft;
    }
    catch (err) {
        logger_1.logger.error('[Commerce] Image download/process failed', { error: String(err), imageId });
        // Continue with product creation — image + draft are nice-to-have
    }
    // 4. Create enriched product in Firestore. The owner's parsed caption is
    // authoritative for name + price; the AI draft fills the rest.
    const wantsFeatured = !!draft?.suggestedBadges.includes('featured');
    const productRef = db.collection(`companies/${companyId}/stores/${storeId}/products`).doc();
    const product = {
        name: parsed.name,
        price: parsed.price,
        currency: productCurrency,
        imageUrl,
        imageUrls: imageUrl ? [imageUrl] : [],
        description: draft?.description,
        stockQty: productStock,
        status: productStock > 0 ? 'active' : 'out_of_stock',
        createdBy: 'whatsapp',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(draft ? {
            category: draft.category,
            ...(draft.subcategory ? { subcategory: draft.subcategory } : {}),
            tags: draft.tags,
            colors: draft.colors,
            ...(draft.variants && draft.variants.length > 0 ? { variants: draft.variants } : {}),
            ...(draft.brand ? { brand: draft.brand } : {}),
            ...(draft.descriptionLong ? { descriptionLong: draft.descriptionLong } : {}),
            ...(draft.suggestedOriginalPrice && draft.suggestedOriginalPrice > parsed.price ? { originalPrice: draft.suggestedOriginalPrice } : {}),
            ...(wantsFeatured ? { featured: true } : {}),
            aiAnalysis: draft,
        } : {}),
    };
    await productRef.set(product);
    // Mirror to Meta Catalog (no-op if no Meta catalog linked).
    void (0, metaCatalogSync_1.syncProductToMeta)(companyId, storeId, productRef.id, {
        name: product.name,
        price: product.price,
        currency: product.currency,
        description: product.description,
        imageUrl: product.imageUrl,
        stockQty: product.stockQty,
        status: product.status,
    });
    // 5. Track lastProductId + open the multi-photo window. Subsequent images
    // (without a fresh name+price caption) will be appended as additional
    // photos to THIS product. The window closes when the owner types *fini*.
    await sessionRef.set({
        lastProductId: productRef.id,
        awaitingMorePhotosFor: productRef.id,
        updatedAt: new Date(),
    }, { merge: true });
    logger_1.logger.info('[Commerce] Product created from photo', {
        companyId, storeId, productId: productRef.id, name: parsed.name, price: parsed.price,
        category: draft?.category, brand: draft?.brand, hasDraft: !!draft,
    });
    // 6. The WAOUH reply — Agent Catalogue style
    const formatted = parsed.price.toLocaleString('fr-FR');
    let reply = `✨ *Fiche générée*\n\n`;
    reply += `📦 *${draft?.name ?? parsed.name}* — ${formatted} ${productCurrency}`;
    if (productStock !== 1)
        reply += ` · 📦 Stock : ${productStock}`;
    reply += '\n';
    if (draft && draft.confidence !== 'low') {
        if (draft.brand)
            reply += `🏷 *Marque* : ${draft.brand}\n`;
        reply += `📂 *Catégorie* : ${draft.category}\n`;
        if (draft.description)
            reply += `📝 ${draft.description}\n`;
        const badgeLabels = draft.suggestedBadges.map(b => b === 'featured' ? '⭐ Coup de cœur' :
            b === 'rare' ? '💎 Rare' :
                b === 'promo' ? '🏷 Promo' : '✨ Nouveau');
        if (badgeLabels.length > 0)
            reply += `\n🎯 *Badges* : ${badgeLabels.join(' · ')}\n`;
        if (draft.suggestedOriginalPrice && draft.suggestedOriginalPrice > parsed.price) {
            reply += `💸 Prix barré suggéré : *${draft.suggestedOriginalPrice.toLocaleString('fr-FR')} ${productCurrency}* (effet promo)\n`;
        }
    }
    if (draft?.photoSuggestion) {
        reply += `\n⚠️ *Suggestion photo* : ${draft.photoSuggestion}\n`;
    }
    if (parsed.currency && parsed.currency !== storeCurrency) {
        reply += `\n⚠️ Tu as utilisé *${parsed.currency}* mais ta boutique est en *${storeCurrency}*.\n`;
    }
    reply += `\n✅ Publié sur ta boutique.\n\n`;
    reply += `📸 *D'autres photos pour ce produit ?* Envoie-les maintenant (sans légende), ou tape *fini* pour passer à la suite.`;
    return { productId: productRef.id, reply };
}
async function handleOwnerTelegramPhoto(args) {
    const { companyId, telegramId, telegramName, imageBuffer, mimeType, caption } = args;
    const db = (0, firebase_config_1.getFirestore)();
    // 1. Find a store owned by this telegram user.
    //    If the company has stores but NONE bound to a telegram id, claim the
    //    first one for this user (bootstrap). After that, only bound user can
    //    upload — anyone else gets a polite "this isn't your bot" reply.
    const storesSnap = await db.collection(`companies/${companyId}/stores`).get().catch(() => null);
    if (!storesSnap || storesSnap.empty) {
        return { productId: '', reply: `⚠️ Aucune boutique configurée. L'admin doit d'abord créer une boutique sur le dashboard.` };
    }
    const stores = storesSnap.docs;
    const ownedAll = stores.filter(d => d.data().ownerTelegramId === telegramId);
    // Multi-store routing: if the owner has 2+ stores, pick by caption intent
    // (detectStoreBusinessType) — falls back to first if ambiguous.
    let owned = ownedAll[0];
    if (ownedAll.length > 1 && caption) {
        const intent = detectStoreBusinessType(caption);
        if (intent) {
            const match = ownedAll.find(d => d.data().businessType === intent);
            if (match)
                owned = match;
        }
    }
    const claimable = stores.find(d => !d.data().ownerTelegramId);
    let storeDoc = owned;
    if (!storeDoc && claimable) {
        // Security: if the claimable store has a registered ownerPhone, refuse
        // first-claim — the real owner must authenticate via @admin (OTP on
        // WhatsApp). Bootstrap path (no phone set) auto-claims for demos.
        const claimableData = claimable.data();
        if (claimableData.ownerPhone && /^\+?\d{8,}/.test(claimableData.ownerPhone)) {
            return {
                productId: '',
                reply: `🔐 Pour gérer cette boutique depuis Telegram, tape d'abord *@admin* — je t'enverrai un code de validation sur WhatsApp.`,
            };
        }
        await claimable.ref.set({ ownerTelegramId: telegramId, updatedAt: new Date() }, { merge: true });
        storeDoc = claimable;
        logger_1.logger.info('[Telegram] Owner bound to store (no-phone bootstrap)', { companyId, storeId: claimable.id, telegramId });
    }
    if (!storeDoc) {
        return { productId: '', reply: `🔒 Cette boutique appartient déjà à un autre utilisateur Telegram. Si c'est une erreur, contacte l'admin.` };
    }
    const storeId = storeDoc.id;
    const store = storeDoc.data();
    const storeCurrency = store.currency ?? 'XOF';
    // 2. Caption parsing (same heuristic as WhatsApp). The Agent Catalogue can
    //    still create the product if no caption — uses photo+freeText only.
    const parsed = parseProductCaption(caption ?? '');
    // 3. Multi-photo append window — if owner is mid-flow, append to existing
    const sessionRef = db.collection(`companies/${companyId}/stores/${storeId}/sessions`).doc(`tg-${telegramId}`);
    const sessionSnap = await sessionRef.get().catch(() => null);
    const sessionData = sessionSnap?.data();
    const awaitingFor = sessionData?.awaitingMorePhotosFor;
    const isAppending = !!awaitingFor && !parsed;
    if (isAppending && awaitingFor) {
        try {
            const bt = store.businessType ?? 'boutique';
            const targetPath = bt === 'hotel'
                ? `companies/${companyId}/stores/${storeId}/rooms/${awaitingFor}`
                : bt === 'residence'
                    ? `companies/${companyId}/stores/${storeId}`
                    : `companies/${companyId}/stores/${storeId}/products/${awaitingFor}`;
            const targetRef = db.doc(targetPath);
            const targetSnap = await targetRef.get();
            if (targetSnap.exists) {
                const newUrl = await uploadBufferToStorage(imageBuffer, mimeType, companyId, storeId).catch(() => undefined);
                if (newUrl) {
                    const data = targetSnap.data();
                    const existing = (data.imageUrls && data.imageUrls.length > 0)
                        ? data.imageUrls
                        : (data.imageUrl ? [data.imageUrl] : (data.coverImageUrl ? [data.coverImageUrl] : []));
                    const updated = [...existing, newUrl];
                    await targetRef.set({
                        imageUrls: updated,
                        ...(bt === 'residence' ? { coverImageUrl: existing[0] ?? newUrl } : { imageUrl: updated[0] }),
                        updatedAt: new Date(),
                    }, { merge: true });
                    return { productId: awaitingFor, reply: `📸 Photo *${updated.length}* ajoutée à *${data.name ?? 'ton listing'}* 👍\n\nEnvoie-en d'autres ou tape *fini* pour passer à la suite.` };
                }
            }
        }
        catch (err) {
            logger_1.logger.error('[Telegram] Multi-photo append failed', { error: String(err) });
        }
    }
    // 4. Need at least a caption OR free text to proceed. Without it, ask.
    if (!parsed && !(caption && caption.trim().length > 3)) {
        return {
            productId: '',
            reply: `📸 J'ai reçu ta photo${telegramName ? `, ${telegramName}` : ''} !\n\nPour créer le produit, ajoute une légende :\n• *Polo Tommy - 20000*\n• ou texte libre : *polo bleu rayé, taille M et S, plus que 1*\n\nL'IA fait le reste (titre, description, catégorie, badges) ✨`,
        };
    }
    // 5. Upload + Agent Catalogue draft in parallel
    const [imageUrl, draft] = await Promise.all([
        uploadBufferToStorage(imageBuffer, mimeType, companyId, storeId).catch(err => {
            logger_1.logger.error('[Telegram] Storage upload failed', { error: String(err) });
            return undefined;
        }),
        generateProductDraft({
            imageBuffer, mimeType,
            freeText: caption,
            basePrice: parsed?.price,
            currency: parsed?.currency ?? storeCurrency,
            stockQty: parsed?.stock,
        }),
    ]);
    // 6. Resolve final fields (parsed caption authoritative, AI fills the rest)
    const finalName = parsed?.name ?? draft?.name ?? 'Produit';
    const finalPrice = parsed?.price ?? draft?.suggestedPrice ?? 0;
    if (finalPrice <= 0) {
        return { productId: '', reply: `⚠️ Je n'arrive pas à déterminer le prix. Renvoie la photo avec une légende du type *${finalName} - 10000* stp.` };
    }
    const productCurrency = parsed?.currency ?? storeCurrency;
    const productStock = parsed?.stock ?? 1;
    const wantsFeatured = !!draft?.suggestedBadges.includes('featured');
    // 7. Routing par businessType :
    //    - 'hotel'     → écrit dans la subcollection `rooms` (schema chambre)
    //    - 'residence' → met à jour le store lui-même (1 store = 1 listing)
    //    - sinon       → subcollection `products` (boutique / restaurant /
    //                    salon / santé / immo)
    const businessType = store.businessType ?? 'boutique';
    let createdId = '';
    let createdLabel = 'produit';
    if (businessType === 'hotel') {
        createdLabel = 'chambre';
        const roomRef = db.collection(`companies/${companyId}/stores/${storeId}/rooms`).doc();
        await roomRef.set({
            name: finalName,
            pricePerNight: finalPrice,
            currency: productCurrency,
            imageUrl,
            imageUrls: imageUrl ? [imageUrl] : [],
            description: draft?.description,
            capacity: productStock > 1 ? productStock : 2,
            status: 'available',
            createdBy: 'telegram',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...(draft ? {
                tags: draft.tags,
                ...(draft.descriptionLong ? { descriptionLong: draft.descriptionLong } : {}),
                ...(wantsFeatured ? { featured: true } : {}),
                aiAnalysis: draft,
            } : {}),
        });
        createdId = roomRef.id;
    }
    else if (businessType === 'residence') {
        createdLabel = 'résidence';
        // The store IS the listing — update its photos + listing fields
        const storeExt = store;
        const existing = (storeExt.imageUrls && storeExt.imageUrls.length > 0)
            ? storeExt.imageUrls
            : (store.coverImageUrl ? [store.coverImageUrl] : []);
        const next = imageUrl ? [...existing, imageUrl] : existing;
        await db.doc(`companies/${companyId}/stores/${storeId}`).set({
            ...(imageUrl ? { imageUrls: next, coverImageUrl: existing[0] ?? imageUrl } : {}),
            ...(draft?.descriptionLong ? { longDescription: draft.descriptionLong } : {}),
            ...(finalPrice > 0 ? { pricePerNight: finalPrice } : {}),
            updatedAt: new Date(),
        }, { merge: true });
        createdId = storeId;
    }
    else {
        const productRef = db.collection(`companies/${companyId}/stores/${storeId}/products`).doc();
        await productRef.set({
            name: finalName,
            price: finalPrice,
            currency: productCurrency,
            imageUrl,
            imageUrls: imageUrl ? [imageUrl] : [],
            description: draft?.description,
            stockQty: productStock,
            status: productStock > 0 ? 'active' : 'out_of_stock',
            createdBy: 'telegram',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...(draft ? {
                category: draft.category,
                ...(draft.subcategory ? { subcategory: draft.subcategory } : {}),
                tags: draft.tags, colors: draft.colors,
                ...(draft.variants && draft.variants.length > 0 ? { variants: draft.variants } : {}),
                ...(draft.brand ? { brand: draft.brand } : {}),
                ...(draft.descriptionLong ? { descriptionLong: draft.descriptionLong } : {}),
                ...(draft.suggestedOriginalPrice && draft.suggestedOriginalPrice > finalPrice ? { originalPrice: draft.suggestedOriginalPrice } : {}),
                ...(wantsFeatured ? { featured: true } : {}),
                aiAnalysis: draft,
            } : {}),
        });
        void (0, metaCatalogSync_1.syncProductToMeta)(companyId, storeId, productRef.id, {
            name: finalName, price: finalPrice, currency: productCurrency,
            description: draft?.description, imageUrl, stockQty: productStock,
            status: productStock > 0 ? 'active' : 'out_of_stock',
        });
        createdId = productRef.id;
        // Pack-specific terminology in the confirmation reply
        createdLabel =
            businessType === 'restaurant' ? 'plat' :
                businessType === 'service' ? 'service' :
                    businessType === 'health' ? 'consultation' :
                        businessType === 'realestate' ? 'bien' :
                            'produit';
    }
    await sessionRef.set({
        awaitingMorePhotosFor: createdId,
        lastProductId: createdId,
        updatedAt: new Date(),
    }, { merge: true });
    // 8. Reply (Agent Catalogue style — adapted to pack terminology)
    const formatted = finalPrice.toLocaleString('fr-FR');
    const priceUnit = businessType === 'hotel' || businessType === 'residence' ? ' / nuit' : '';
    let reply = `✨ *Fiche générée*\n\n`;
    reply += `📦 *${finalName}* — ${formatted} ${productCurrency}${priceUnit}`;
    if (businessType !== 'hotel' && businessType !== 'residence' && productStock !== 1) {
        reply += ` · 📦 Stock : ${productStock}`;
    }
    reply += '\n';
    if (draft && draft.confidence !== 'low') {
        if (draft.brand)
            reply += `🏷 *Marque* : ${draft.brand}\n`;
        reply += `📂 *Catégorie* : ${draft.category}\n`;
        if (draft.description)
            reply += `📝 ${draft.description}\n`;
        const labels = draft.suggestedBadges.map(b => b === 'featured' ? '⭐ Coup de cœur' : b === 'rare' ? '💎 Rare' : b === 'promo' ? '🏷 Promo' : '✨ Nouveau');
        if (labels.length > 0)
            reply += `\n🎯 *Badges* : ${labels.join(' · ')}\n`;
        if (draft.suggestedOriginalPrice && draft.suggestedOriginalPrice > finalPrice && businessType !== 'hotel' && businessType !== 'residence') {
            reply += `💸 Prix barré suggéré : *${draft.suggestedOriginalPrice.toLocaleString('fr-FR')} ${productCurrency}* (effet promo)\n`;
        }
    }
    if (draft?.photoSuggestion)
        reply += `\n⚠️ *Suggestion photo* : ${draft.photoSuggestion}\n`;
    const verticalLabel = businessType === 'hotel' ? 'ton hôtel' :
        businessType === 'residence' ? 'ta résidence' :
            businessType === 'restaurant' ? 'ton menu' :
                businessType === 'service' ? 'ton salon' :
                    businessType === 'health' ? 'ton cabinet' :
                        businessType === 'realestate' ? 'ton catalogue de biens' :
                            'ta boutique';
    reply += `\n✅ ${createdLabel.charAt(0).toUpperCase() + createdLabel.slice(1)} publié${createdLabel.endsWith('e') ? 'e' : ''} sur ${verticalLabel}.\n\n`;
    reply += `📸 D'autres photos ? Envoie-les maintenant. Tape *fini* pour passer à la suite.`;
    return { productId: createdId, reply };
}
// ── Genkit tools (callable by orchestrator) ──────────────────────────────────
const StoreContext = zod_1.z.object({
    companyId: zod_1.z.string(),
    storeId: zod_1.z.string(),
});
// Public client URL where the storefront page is served. Default to the
// deployed Firebase Hosting domain; can be overridden via env for staging.
const PUBLIC_APP_URL = process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app';
exports.listProductsTool = genkit_config_1.ai.defineTool({
    name: 'commerceListProducts',
    description: 'List active products of a store. Use this when the customer asks "what do you sell" / "show me products" / "ton catalogue". The output also contains a shopLink — ALWAYS include this link at the end of your reply so the customer can browse the catalog visually.',
    inputSchema: StoreContext.extend({
        query: zod_1.z.string().optional().describe('Optional text filter on product name'),
    }),
    outputSchema: zod_1.z.object({
        products: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), name: zod_1.z.string(), price: zod_1.z.number(), currency: zod_1.z.string(),
            imageUrl: zod_1.z.string().optional(), stockQty: zod_1.z.number(), description: zod_1.z.string().optional(),
        })),
        shopLink: zod_1.z.string().describe('Public storefront URL the customer can open to browse products with images and click "Commander". ALWAYS include this in your reply.'),
    }),
}, async ({ companyId, storeId, query }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Fetch store to resolve / backfill slug for the public URL
    const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
    const storeData = storeSnap.data();
    const slug = storeData
        ? await ensureStoreSlug(companyId, storeId, storeData)
        : null;
    const snap = await db
        .collection(`companies/${companyId}/stores/${storeId}/products`)
        .where('status', '==', 'active')
        .limit(50)
        .get();
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtered = query
        ? all.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
        : all;
    // Prefer slug-based URL (clean, shareable) — fall back to id-based if slug missing
    const shopLink = slug
        ? `${PUBLIC_APP_URL}/shop/${slug}`
        : `${PUBLIC_APP_URL}/shop/${companyId}/${storeId}`;
    return {
        products: filtered.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            currency: p.currency,
            imageUrl: p.imageUrl,
            stockQty: p.stockQty,
            description: p.description,
        })),
        shopLink,
    };
});
// Match a free-text address against the store's deliveryZones. Returns the
// matching zone (case-insensitive substring) or null.
function matchDeliveryZone(addressOrZone, zones) {
    if (!addressOrZone || !zones || zones.length === 0)
        return null;
    const lower = addressOrZone.toLowerCase();
    for (const zone of zones) {
        if (lower.includes(zone.name.toLowerCase()))
            return zone;
    }
    return null;
}
exports.placeOrderTool = genkit_config_1.ai.defineTool({
    name: 'commercePlaceOrder',
    description: 'Create an order. Use when the customer commits to buying — they confirmed product(s), qty, name, phone, and delivery address. The tool checks stock, applies delivery fee from store zones, decrements stock atomically, notifies the owner on WhatsApp, and returns a polished confirmation message to send back to the customer verbatim.',
    inputSchema: StoreContext.extend({
        customerName: zod_1.z.string(),
        customerPhone: zod_1.z.string(),
        items: zod_1.z.array(zod_1.z.object({
            productId: zod_1.z.string(),
            qty: zod_1.z.number().int().positive(),
        })),
        paymentMethod: zod_1.z.enum(['cod', 'mobile_money_manual']).default('cod'),
        deliveryAddress: zod_1.z.string().optional().describe('Customer-provided address. Used to match a delivery zone for fee calculation.'),
        deliveryZone: zod_1.z.string().optional().describe('Optional zone hint extracted by the agent (e.g. "Cocody"). Falls back to scanning deliveryAddress.'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        orderId: zod_1.z.string().optional(),
        orderNumber: zod_1.z.string().optional(),
        subtotal: zod_1.z.number().optional(),
        deliveryFee: zod_1.z.number().optional(),
        total: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional(),
        paymentInstructions: zod_1.z.string().optional(),
        zoneMatched: zod_1.z.string().optional(),
        error: zod_1.z.string().optional(),
        confirmationMessage: zod_1.z.string().optional().describe('Pre-formatted message to send back to customer — agent should send it verbatim.'),
    }),
}, async ({ companyId, storeId, customerName, customerPhone, items, paymentMethod, deliveryAddress, deliveryZone }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
    const store = storeSnap.data();
    if (!store)
        return { success: false, error: 'Boutique introuvable.' };
    const currency = store.currency ?? 'XOF';
    // 0. Refuse out-of-hours orders if the owner has set openingHours
    const hoursCheck = (0, openingHoursCheck_1.isStoreOpen)({ openingHours: store.openingHours });
    if (hoursCheck.status === 'closed') {
        return {
            success: false,
            error: `${store.name ?? 'La boutique'} est actuellement fermée. ${hoursCheck.reason ?? ''} Réessayez pendant les heures d'ouverture.`.trim(),
        };
    }
    // 1. Resolve products + verify stock BEFORE writing anything
    const productSnaps = await Promise.all(items.map(it => db.doc(`companies/${companyId}/stores/${storeId}/products/${it.productId}`).get()));
    const orderItems = [];
    const stockProblems = [];
    let subtotal = 0;
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const snap = productSnaps[i];
        if (!snap.exists) {
            stockProblems.push(`Produit introuvable (${it.productId})`);
            continue;
        }
        const p = snap.data();
        if (p.status !== 'active') {
            stockProblems.push(`${p.name} — non disponible`);
            continue;
        }
        if ((p.stockQty ?? 0) < it.qty) {
            stockProblems.push(`${p.name} — stock insuffisant (reste ${p.stockQty})`);
            continue;
        }
        const lineTotal = p.price * it.qty;
        orderItems.push({
            productId: snap.id, name: p.name, qty: it.qty,
            unitPrice: p.price, lineTotal,
        });
        subtotal += lineTotal;
    }
    if (orderItems.length === 0) {
        return {
            success: false,
            error: stockProblems.length > 0 ? stockProblems.join(' · ') : 'Aucun produit valide dans la commande.',
        };
    }
    // 2. Delivery fee from store's zones (zone hint first, else scan address)
    const matchedZone = matchDeliveryZone(deliveryZone, store.deliveryZones) ??
        matchDeliveryZone(deliveryAddress, store.deliveryZones);
    const deliveryFee = matchedZone
        ? (matchedZone.freeAbove && subtotal >= matchedZone.freeAbove ? 0 : matchedZone.fee)
        : 0;
    // 2b. Loyalty discount lookup — does the customer have enough points?
    const loyaltyEnabled = store.loyaltyEnabled !== false;
    const loyaltyThreshold = store.loyaltyThreshold ?? 100;
    const loyaltyDiscountPct = store.loyaltyDiscountPct ?? 10;
    const phoneKey = customerPhone.replace(/\D/g, '');
    let loyaltyDiscount = 0;
    let loyaltyPointsRedeemed = 0;
    let loyaltyPointsBefore = 0;
    let loyaltyApplied = false;
    if (loyaltyEnabled && phoneKey) {
        try {
            const customerSnap = await db.doc(`companies/${companyId}/stores/${storeId}/customers/${phoneKey}`).get();
            if (customerSnap.exists) {
                loyaltyPointsBefore = (customerSnap.data()?.loyaltyPoints) ?? 0;
                if (loyaltyPointsBefore >= loyaltyThreshold) {
                    loyaltyDiscount = Math.round((subtotal + deliveryFee) * (loyaltyDiscountPct / 100));
                    loyaltyPointsRedeemed = loyaltyThreshold;
                    loyaltyApplied = true;
                }
            }
        }
        catch { /* non-blocking — order continues without loyalty */ }
    }
    const total = subtotal + deliveryFee - loyaltyDiscount;
    // 3. Order number
    const today = new Date();
    const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const orderNumber = `ORL-${datePart}-${(0, crypto_1.randomBytes)(2).toString('hex').toUpperCase()}`;
    const orderRef = db.collection(`companies/${companyId}/stores/${storeId}/orders`).doc();
    // 4. Atomic transaction: write order + decrement stocks + auto-sold-out
    await db.runTransaction(async (tx) => {
        const refs = items.map(it => db.doc(`companies/${companyId}/stores/${storeId}/products/${it.productId}`));
        const txSnaps = await Promise.all(refs.map(r => tx.get(r)));
        // Re-validate inside transaction to prevent oversell
        for (let i = 0; i < items.length; i++) {
            if (!txSnaps[i].exists)
                continue;
            const p = txSnaps[i].data();
            const remaining = (p.stockQty ?? 0) - items[i].qty;
            if (remaining < 0)
                throw new Error(`Stock épuisé pour ${p.name} pendant la transaction.`);
            tx.update(refs[i], {
                stockQty: Math.max(0, remaining),
                status: remaining <= 0 ? 'out_of_stock' : p.status,
                updatedAt: new Date(),
            });
        }
        const order = {
            orderNumber,
            customerName,
            customerPhone,
            items: orderItems,
            total,
            currency,
            paymentMethod,
            paymentStatus: 'pending',
            deliveryStatus: 'pending',
            source: 'whatsapp',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...(deliveryAddress ? { deliveryAddress } : {}),
            ...(matchedZone ? { deliveryZone: matchedZone.name } : {}),
            subtotal,
            deliveryFee,
            ...(loyaltyApplied ? { loyaltyDiscount, loyaltyPointsRedeemed } : {}),
        };
        tx.set(orderRef, order);
    });
    logger_1.logger.info('[Commerce] Order created', {
        companyId, storeId, orderNumber, subtotal, deliveryFee, total,
        zoneMatched: matchedZone?.name,
    });
    // 5. Build the formatted customer confirmation message
    const itemsBlock = orderItems.map(i => `   • ${i.qty}× ${i.name} — ${i.lineTotal.toLocaleString('fr-FR')} ${currency}`).join('\n');
    const paymentLine = paymentMethod === 'cod'
        ? '💵 Paiement à la livraison'
        : `💳 ${store.paymentInstructions ?? 'Le marchand t\'enverra les instructions de paiement.'}`;
    const zoneLine = matchedZone
        ? `🚚 Livraison ${matchedZone.name} : ${deliveryFee.toLocaleString('fr-FR')} ${currency}${deliveryFee === 0 && matchedZone.freeAbove ? ' (gratuite à partir de ' + matchedZone.freeAbove.toLocaleString('fr-FR') + ')' : ''}`
        : '🚚 Frais de livraison à confirmer avec le marchand';
    // Loyalty section: applied today, or pts earned, or progress
    const pointsEarnedThisOrder = loyaltyEnabled
        ? Math.floor((subtotal + deliveryFee) / (store.loyaltyPointsPerUnit ?? 100))
        : 0;
    const loyaltyPointsAfter = loyaltyApplied
        ? (loyaltyPointsBefore - loyaltyPointsRedeemed) + pointsEarnedThisOrder
        : loyaltyPointsBefore + pointsEarnedThisOrder;
    let loyaltyLine = '';
    if (loyaltyEnabled) {
        if (loyaltyApplied) {
            loyaltyLine = `\n🎁 *-${loyaltyDiscountPct}% fidélité appliqué* (-${loyaltyDiscount.toLocaleString('fr-FR')} ${currency})`;
        }
        else if (loyaltyPointsAfter >= loyaltyThreshold) {
            loyaltyLine = `\n🎁 Tu as cumulé *${loyaltyPointsAfter} points* — la prochaine commande est à -${loyaltyDiscountPct}% !`;
        }
        else if (pointsEarnedThisOrder > 0) {
            const remaining = loyaltyThreshold - loyaltyPointsAfter;
            loyaltyLine = `\n⭐ +${pointsEarnedThisOrder} points (total ${loyaltyPointsAfter}/${loyaltyThreshold}) — encore ${remaining} pour -${loyaltyDiscountPct}%`;
        }
    }
    const confirmationMessage = `✅ *Commande confirmée* — n°${orderNumber}\n\n` +
        `${itemsBlock}\n\n` +
        `Sous-total : ${subtotal.toLocaleString('fr-FR')} ${currency}\n` +
        `${zoneLine}` +
        `${loyaltyApplied ? `\n🎁 Fidélité : -${loyaltyDiscount.toLocaleString('fr-FR')} ${currency}` : ''}\n` +
        `*Total : ${total.toLocaleString('fr-FR')} ${currency}*\n\n` +
        `${paymentLine}` +
        `${loyaltyLine}` +
        `\n\nLe marchand confirme ta commande très vite et te recontacte pour la livraison. 🙏`;
    // 6. Notify the owner (non-blocking, fire-and-forget — doesn't break order if it fails)
    notifyOwnerOfNewOrder({
        companyId, storeId, ownerPhone: store.ownerPhone,
        orderNumber, customerName, customerPhone,
        itemsBlock, total, currency, paymentMethod, zoneName: matchedZone?.name,
    }).catch(err => logger_1.logger.warn('[Commerce] Owner notification failed (non-blocking)', { error: String(err) }));
    // 6b. Stock-low alert per item (only for products that just dropped <=2)
    notifyOwnerOfLowStock({
        companyId, storeId, ownerPhone: store.ownerPhone,
        productSnaps, items, currency,
    }).catch(err => logger_1.logger.warn('[Commerce] Low stock alert failed (non-blocking)', { error: String(err) }));
    // 6c. Bridge customer to whatsappLeads + customers sub-collection so the
    // owner can target them later via campaigns / broadcasts. Idempotent upsert.
    // Also track loyalty points (delta = earned - redeemed).
    bridgeCustomerToLeads({
        companyId, storeId,
        customerName, customerPhone, total, orderNumber, currency,
        loyaltyPointsDelta: pointsEarnedThisOrder - loyaltyPointsRedeemed,
    }).catch(err => logger_1.logger.warn('[Commerce] Lead bridging failed (non-blocking)', { error: String(err) }));
    // 6d. Upsell suggestion (Gemini Vision-free helper). Fire-and-forget so
    // the customer gets the order confirmation FIRST, then ~5 seconds later
    // gets the upsell offer. Skipped if catalog is too small (<3 active products).
    proposeUpsellAfterOrder({
        companyId, storeId,
        customerName, customerPhone, currency,
        justBoughtProductIds: orderItems.map(i => i.productId),
    }).catch(err => logger_1.logger.warn('[Commerce] Upsell suggestion failed (non-blocking)', { error: String(err) }));
    // 6e. Welcome message on FIRST order (idempotent — won't fire twice).
    sendWelcomeIfFirstOrder({
        companyId, storeId, customerName, customerPhone, orderNumber,
    }).catch(err => logger_1.logger.warn('[Commerce] Welcome message failed (non-blocking)', { error: String(err) }));
    const paymentInstructions = paymentMethod === 'cod'
        ? 'Paiement à la livraison.'
        : (store.paymentInstructions ?? 'Le marchand t\'enverra les instructions de paiement.');
    return {
        success: true,
        orderId: orderRef.id,
        orderNumber,
        subtotal,
        deliveryFee,
        total,
        currency,
        paymentInstructions,
        zoneMatched: matchedZone?.name,
        confirmationMessage,
    };
});
// ── Restock interest tracking + notification ────────────────────────────────
// Customer says "préviens-moi quand X sera dispo" → AI calls
// commerceRegisterRestockInterest. When the product flips back to active
// (via stock update / status reactivation), we ping every interested phone.
exports.registerRestockInterestTool = genkit_config_1.ai.defineTool({
    name: 'commerceRegisterRestockInterest',
    description: 'Save the customer\'s interest in a product that is currently out of stock. Use this when the customer asks to be notified when an out-of-stock product is available again ("préviens-moi", "tu auras encore", "quand est-ce que vous en aurez"). Returns a polished confirmation to send back.',
    inputSchema: StoreContext.extend({
        productQuery: zod_1.z.string().describe('Name (or partial name) of the product the customer is interested in'),
        customerPhone: zod_1.z.string(),
        customerName: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        productName: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId, productQuery, customerPhone, customerName }) => {
    const product = await findProductByName(companyId, storeId, productQuery);
    if (!product)
        return { success: false, message: `Aucun produit "${productQuery}" trouvé dans le catalogue.` };
    const phoneKey = customerPhone.replace(/\D/g, '');
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.doc(`companies/${companyId}/stores/${storeId}/restockInterests/${product.id}_${phoneKey}`);
    await ref.set({
        productId: product.id,
        productName: product.name,
        customerPhone,
        customerName: customerName ?? null,
        createdAt: new Date(),
        notified: false,
    }, { merge: true });
    logger_1.logger.info('[Commerce] Restock interest registered', {
        companyId, storeId, productId: product.id, customerPhone,
    });
    return {
        success: true,
        productName: product.name,
        message: `📌 Noté ! Je te préviens dès que *${product.name}* est de nouveau dispo. 🙏`,
    };
});
/**
 * Notify all customers who registered restock interest for a product that
 * just became available. Fire-and-forget.
 */
async function notifyRestockInterests(companyId, storeId, productId) {
    const db = (0, firebase_config_1.getFirestore)();
    const interestsSnap = await db.collection(`companies/${companyId}/stores/${storeId}/restockInterests`)
        .where('productId', '==', productId)
        .where('notified', '==', false)
        .limit(200).get().catch(() => null);
    if (!interestsSnap || interestsSnap.empty)
        return;
    const productSnap = await db.doc(`companies/${companyId}/stores/${storeId}/products/${productId}`).get();
    if (!productSnap.exists)
        return;
    const product = productSnap.data();
    const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
    const store = storeSnap.data();
    const slug = store?.slug;
    const shopLink = slug ? `${PUBLIC_APP_URL}/shop/${slug}` : `${PUBLIC_APP_URL}/shop/${companyId}/${storeId}`;
    const { sendMarketing, recordMarketingEvent } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/smartOutbound')));
    for (const doc of interestsSnap.docs) {
        const interest = doc.data();
        const firstName = (interest.customerName ?? '').split(/\s+/)[0] || 'là';
        await sendMarketing(companyId, interest.customerPhone, 'back_in_stock', {
            firstName, productName: product.name, shopLink,
        });
        await doc.ref.update({ notified: true, notifiedAt: new Date() }).catch(() => null);
        await recordMarketingEvent(companyId, storeId, interest.customerPhone, 'restock', { productId });
    }
    logger_1.logger.info('[Commerce] Restock notifications fired', {
        companyId, storeId, productId, count: interestsSnap.size,
    });
}
// ── Owner WhatsApp notification on new order ─────────────────────────────────
async function notifyOwnerOfNewOrder(args) {
    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
    const cfg = await whatsappService.getConfig(args.companyId).catch(() => null);
    if (!cfg || !args.ownerPhone)
        return;
    const adminLink = `${PUBLIC_APP_URL}/agents/commerce`;
    const msg = `🛒 *Nouvelle commande* — n°${args.orderNumber}\n\n` +
        `👤 ${args.customerName}\n📞 ${args.customerPhone}\n\n` +
        `${args.itemsBlock}\n\n` +
        `💰 *Total : ${args.total.toLocaleString('fr-FR')} ${args.currency}*\n` +
        `${args.paymentMethod === 'cod' ? '💵 Paiement à la livraison' : '💳 Mobile Money à recevoir'}` +
        `${args.zoneName ? `\n🚚 Zone : ${args.zoneName}` : ''}\n\n` +
        `📊 Voir/Gérer : ${adminLink}`;
    await whatsappService.sendMessage(cfg, args.ownerPhone, msg);
    logger_1.logger.info('[Commerce] Owner notified of new order', {
        companyId: args.companyId, storeId: args.storeId, orderNumber: args.orderNumber,
    });
}
exports.getOrdersTool = genkit_config_1.ai.defineTool({
    name: 'commerceGetOrders',
    description: 'List recent orders for the store owner. OWNER ONLY — do not expose to customers.',
    inputSchema: StoreContext.extend({
        limit: zod_1.z.number().int().positive().max(50).default(10),
    }),
    outputSchema: zod_1.z.object({
        orders: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            orderNumber: zod_1.z.string(),
            customerName: zod_1.z.string(),
            customerPhone: zod_1.z.string(),
            total: zod_1.z.number(),
            currency: zod_1.z.string(),
            paymentStatus: zod_1.z.string(),
            deliveryStatus: zod_1.z.string(),
            createdAt: zod_1.z.string(),
        })),
    }),
}, async ({ companyId, storeId, limit }) => {
    const snap = await (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/stores/${storeId}/orders`)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    return {
        orders: snap.docs.map(d => {
            const o = d.data();
            const ca = o.createdAt?.toDate?.() ?? o.createdAt;
            return {
                id: d.id,
                orderNumber: o.orderNumber,
                customerName: o.customerName,
                customerPhone: o.customerPhone,
                total: o.total,
                currency: o.currency,
                paymentStatus: o.paymentStatus,
                deliveryStatus: o.deliveryStatus,
                createdAt: (ca instanceof Date ? ca : new Date()).toISOString(),
            };
        }),
    };
});
exports.markOrderPaidTool = genkit_config_1.ai.defineTool({
    name: 'commerceMarkOrderPaid',
    description: 'Mark an order as paid. OWNER ONLY — typically called after the owner confirms they received Mobile Money payment.',
    inputSchema: StoreContext.extend({
        orderId: zod_1.z.string(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, storeId, orderId }) => {
    const ref = (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}/orders/${orderId}`);
    const snap = await ref.get();
    if (!snap.exists)
        return { success: false, message: 'Commande introuvable.' };
    await ref.update({ paymentStatus: 'paid', updatedAt: new Date() });
    return { success: true, message: 'Paiement confirmé. Tu peux préparer la livraison.' };
});
// ── Find product by partial name (used by owner-edit tools) ─────────────────
async function findProductByName(companyId, storeId, query) {
    if (!query || query.length < 2)
        return null;
    const snap = await (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/stores/${storeId}/products`)
        .limit(200).get();
    const q = query.toLowerCase().trim();
    // 1. Exact name match (case-insensitive)
    const exact = snap.docs.find(d => d.data().name.toLowerCase() === q);
    if (exact)
        return { id: exact.id, ...exact.data() };
    // 2. Substring match
    const partial = snap.docs.find(d => d.data().name.toLowerCase().includes(q));
    if (partial)
        return { id: partial.id, ...partial.data() };
    // 3. Word overlap (2+ words match)
    const queryWords = q.split(/\s+/).filter(w => w.length >= 3);
    for (const d of snap.docs) {
        const name = d.data().name.toLowerCase();
        const matches = queryWords.filter(w => name.includes(w)).length;
        if (matches >= Math.min(2, queryWords.length)) {
            return { id: d.id, ...d.data() };
        }
    }
    return null;
}
exports.updateProductPriceTool = genkit_config_1.ai.defineTool({
    name: 'commerceUpdateProductPrice',
    description: 'Update the price of a product. OWNER ONLY — requires authenticated owner session.',
    inputSchema: StoreContext.extend({
        productQuery: zod_1.z.string().describe('Name (or partial name) of the product to update'),
        newPrice: zod_1.z.number().positive(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        productName: zod_1.z.string().optional(),
        oldPrice: zod_1.z.number().optional(),
        newPrice: zod_1.z.number().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId, productQuery, newPrice }) => {
    const product = await findProductByName(companyId, storeId, productQuery);
    if (!product)
        return { success: false, message: `Aucun produit trouvé pour "${productQuery}".` };
    const oldPrice = product.price;
    await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}/products/${product.id}`)
        .update({ price: newPrice, updatedAt: new Date() });
    void (0, metaCatalogSync_1.syncProductToMeta)(companyId, storeId, product.id, {
        ...product, price: newPrice,
    });
    return {
        success: true,
        productName: product.name,
        oldPrice,
        newPrice,
        message: `✅ Prix de *${product.name}* : ${oldPrice.toLocaleString('fr-FR')} → ${newPrice.toLocaleString('fr-FR')} ${product.currency}.`,
    };
});
exports.updateProductStockTool = genkit_config_1.ai.defineTool({
    name: 'commerceUpdateProductStock',
    description: 'Update the stock quantity of a product. OWNER ONLY. Auto-flips status to active if stockQty>0, out_of_stock if 0.',
    inputSchema: StoreContext.extend({
        productQuery: zod_1.z.string(),
        newStock: zod_1.z.number().int().nonnegative(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        productName: zod_1.z.string().optional(),
        oldStock: zod_1.z.number().optional(),
        newStock: zod_1.z.number().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId, productQuery, newStock }) => {
    const product = await findProductByName(companyId, storeId, productQuery);
    if (!product)
        return { success: false, message: `Aucun produit trouvé pour "${productQuery}".` };
    const oldStock = product.stockQty ?? 0;
    const newStatus = newStock <= 0 ? 'out_of_stock' : (product.status === 'out_of_stock' ? 'active' : product.status);
    await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}/products/${product.id}`)
        .update({ stockQty: newStock, status: newStatus, updatedAt: new Date() });
    void (0, metaCatalogSync_1.syncProductToMeta)(companyId, storeId, product.id, {
        ...product, stockQty: newStock, status: newStatus,
    });
    // If the product just came back in stock, ping interested customers.
    if (product.status !== 'active' && newStatus === 'active') {
        void notifyRestockInterests(companyId, storeId, product.id);
    }
    return {
        success: true,
        productName: product.name,
        oldStock, newStock,
        message: `📦 Stock *${product.name}* : ${oldStock} → ${newStock}${newStock <= 0 ? ' (rupture)' : ''}.`,
    };
});
exports.updateProductStatusTool = genkit_config_1.ai.defineTool({
    name: 'commerceUpdateProductStatus',
    description: 'Change a product status (active, out_of_stock, archived, draft). OWNER ONLY.',
    inputSchema: StoreContext.extend({
        productQuery: zod_1.z.string(),
        status: zod_1.z.enum(['active', 'out_of_stock', 'archived', 'draft']),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        productName: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId, productQuery, status }) => {
    const product = await findProductByName(companyId, storeId, productQuery);
    if (!product)
        return { success: false, message: `Aucun produit trouvé pour "${productQuery}".` };
    await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}/products/${product.id}`)
        .update({ status, updatedAt: new Date() });
    void (0, metaCatalogSync_1.syncProductToMeta)(companyId, storeId, product.id, { ...product, status });
    if (product.status !== 'active' && status === 'active') {
        void notifyRestockInterests(companyId, storeId, product.id);
    }
    const verb = status === 'archived' ? 'archivé' : status === 'out_of_stock' ? 'mis en rupture' : status === 'draft' ? 'mis en brouillon' : 'réactivé';
    return {
        success: true,
        productName: product.name,
        message: `✅ *${product.name}* ${verb}.`,
    };
});
exports.deleteProductTool = genkit_config_1.ai.defineTool({
    name: 'commerceDeleteProduct',
    description: 'Permanently delete a product. OWNER ONLY. Prefer commerceUpdateProductStatus with status=archived if unsure.',
    inputSchema: StoreContext.extend({
        productQuery: zod_1.z.string(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        productName: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId, productQuery }) => {
    const product = await findProductByName(companyId, storeId, productQuery);
    if (!product)
        return { success: false, message: `Aucun produit trouvé pour "${productQuery}".` };
    await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}/products/${product.id}`).delete();
    void (0, metaCatalogSync_1.deleteProductFromMeta)(companyId, product.id);
    return {
        success: true,
        productName: product.name,
        message: `🗑️ *${product.name}* supprimé définitivement.`,
    };
});
/**
 * Parse a free-form owner WhatsApp text into an admin command, or return null
 * if it doesn't look like one (in which case it falls through to the orchestrator).
 *
 * Patterns recognized:
 *   "augmente prix Chemise à 7000"
 *   "baisse prix Chemise à 5000"
 *   "change prix Chemise 6000"
 *   "prix Chemise 6000"
 *   "stock Chemise 10"
 *   "rupture Chemise"
 *   "supprime Chemise"
 *   "archive Chemise"
 *   "réactive Chemise"
 */
function parseOwnerCommand(text) {
    if (!text)
        return null;
    const t = text.trim().replace(/\s+/g, ' ');
    // CREATE — manual product creation via text (no photo)
    //   "ajoute produit Chemise African prix 5000 stock 10"
    //   "ajouter produit Chemise prix 5000"
    //   "crée produit X prix Y stock Z"
    let mc = /^(?:ajoute|ajouter|cree|crée|cree?r|nouveau)\s+(?:produit|article)\s+(.+?)\s+prix\s+(\d+(?:[.,\s]\d+)*)\s*(?:xof|fcfa|cfa|f|usd|eur|\$|€)?\s*(?:stock\s+(\d+))?$/i.exec(t);
    if (mc) {
        const price = parseInt(mc[2].replace(/[.,\s]/g, ''), 10);
        const stock = mc[3] ? parseInt(mc[3], 10) : undefined;
        if (!isNaN(price) && price > 0) {
            return {
                type: 'create_product',
                productQuery: mc[1].trim(),
                productPrice: price,
                productStock: typeof stock === 'number' && !isNaN(stock) ? stock : 1,
            };
        }
    }
    // PRICE — multiple phrasings. Captures product name (group A) and price (group B).
    // "augmente/baisse/change [le] prix [de] {name} [à|a] {price}"
    let m = /^(?:augmente|baisse|change|fixe|modifie)\s+(?:le\s+)?prix\s+(?:de\s+)?(.+?)\s+(?:à|a)\s+(\d+(?:[.,\s]\d+)*)\s*(?:xof|fcfa|cfa|f)?$/i.exec(t);
    if (!m) {
        // "prix {name} {price}"  (no "à")
        m = /^prix\s+(.+?)\s+(\d+(?:[.,\s]\d+)*)\s*(?:xof|fcfa|cfa|f)?$/i.exec(t);
    }
    if (m) {
        const price = parseInt(m[2].replace(/[.,\s]/g, ''), 10);
        if (!isNaN(price) && price > 0) {
            return { type: 'update_price', productQuery: m[1].trim(), newValue: price };
        }
    }
    // STOCK
    m = /^stock\s+(.+?)\s+(\d+)$/i.exec(t);
    if (!m)
        m = /^(?:met|mets|mettre)\s+(?:le\s+)?stock\s+(?:de\s+)?(.+?)\s+(?:à|a)\s+(\d+)$/i.exec(t);
    if (m) {
        const stock = parseInt(m[2], 10);
        if (!isNaN(stock) && stock >= 0) {
            return { type: 'update_stock', productQuery: m[1].trim(), newValue: stock };
        }
    }
    // OUT OF STOCK / ARCHIVE / DELETE / REACTIVATE
    m = /^(?:rupture|épuisé|epuise|fini|plus\s+de\s+stock)\s+(.+?)$/i.exec(t);
    if (m)
        return { type: 'archive_product', productQuery: m[1].trim() };
    m = /^(?:archive|archiver|cache|masque)\s+(.+?)$/i.exec(t);
    if (m)
        return { type: 'archive_product', productQuery: m[1].trim() };
    m = /^(?:réactive|reactive|active|disponible|remets)\s+(.+?)$/i.exec(t);
    if (m)
        return { type: 'reactivate_product', productQuery: m[1].trim() };
    m = /^(?:supprime|supprimer|delete|enlève|enleve|retire)\s+(.+?)$/i.exec(t);
    if (m)
        return { type: 'delete_product', productQuery: m[1].trim() };
    return null;
}
async function executeOwnerCommand(companyId, storeId, cmd) {
    switch (cmd.type) {
        case 'create_product': {
            const db = (0, firebase_config_1.getFirestore)();
            const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
            const currency = storeSnap.data()?.currency ?? 'XOF';
            const ref = db.collection(`companies/${companyId}/stores/${storeId}/products`).doc();
            const stock = cmd.productStock ?? 1;
            const productDoc = {
                name: cmd.productQuery,
                price: cmd.productPrice,
                currency,
                stockQty: stock,
                status: (stock > 0 ? 'active' : 'out_of_stock'),
                createdBy: 'whatsapp',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await ref.set(productDoc);
            void (0, metaCatalogSync_1.syncProductToMeta)(companyId, storeId, ref.id, productDoc);
            logger_1.logger.info('[Commerce] Product created via text command', {
                companyId, storeId, productId: ref.id, name: cmd.productQuery, price: cmd.productPrice, stock,
            });
            return (`✅ *Produit créé* : ${cmd.productQuery} — ${cmd.productPrice.toLocaleString('fr-FR')} ${currency}\n` +
                `📦 Stock : ${stock}\n\n` +
                `_Astuce : envoie une photo plus tard avec la légende "${cmd.productQuery}" si tu veux ajouter une image._`);
        }
        case 'update_price': {
            const product = await findProductByName(companyId, storeId, cmd.productQuery);
            if (!product)
                return `❌ Aucun produit trouvé pour "${cmd.productQuery}".`;
            await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}/products/${product.id}`)
                .update({ price: cmd.newValue, updatedAt: new Date() });
            void (0, metaCatalogSync_1.syncProductToMeta)(companyId, storeId, product.id, { ...product, price: cmd.newValue });
            return `✅ Prix de *${product.name}* : ${product.price.toLocaleString('fr-FR')} → ${cmd.newValue.toLocaleString('fr-FR')} ${product.currency}.`;
        }
        case 'update_stock': {
            const product = await findProductByName(companyId, storeId, cmd.productQuery);
            if (!product)
                return `❌ Aucun produit trouvé pour "${cmd.productQuery}".`;
            const newStatus = cmd.newValue <= 0 ? 'out_of_stock' : 'active';
            await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}/products/${product.id}`)
                .update({ stockQty: cmd.newValue, status: newStatus, updatedAt: new Date() });
            void (0, metaCatalogSync_1.syncProductToMeta)(companyId, storeId, product.id, { ...product, stockQty: cmd.newValue, status: newStatus });
            return `📦 Stock *${product.name}* : ${(product.stockQty ?? 0)} → ${cmd.newValue}${cmd.newValue <= 0 ? ' (rupture)' : ''}.`;
        }
        case 'archive_product': {
            const product = await findProductByName(companyId, storeId, cmd.productQuery);
            if (!product)
                return `❌ Aucun produit trouvé pour "${cmd.productQuery}".`;
            await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}/products/${product.id}`)
                .update({ status: 'archived', updatedAt: new Date() });
            void (0, metaCatalogSync_1.syncProductToMeta)(companyId, storeId, product.id, { ...product, status: 'archived' });
            return `📦 *${product.name}* archivé. Il n'apparaît plus dans le catalogue.`;
        }
        case 'reactivate_product': {
            const product = await findProductByName(companyId, storeId, cmd.productQuery);
            if (!product)
                return `❌ Aucun produit trouvé pour "${cmd.productQuery}".`;
            await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}/products/${product.id}`)
                .update({ status: 'active', updatedAt: new Date() });
            void (0, metaCatalogSync_1.syncProductToMeta)(companyId, storeId, product.id, { ...product, status: 'active' });
            if (product.status !== 'active')
                void notifyRestockInterests(companyId, storeId, product.id);
            return `✅ *${product.name}* réactivé — visible dans le catalogue.`;
        }
        case 'delete_product': {
            const product = await findProductByName(companyId, storeId, cmd.productQuery);
            if (!product)
                return `❌ Aucun produit trouvé pour "${cmd.productQuery}".`;
            await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}/products/${product.id}`).delete();
            void (0, metaCatalogSync_1.deleteProductFromMeta)(companyId, product.id);
            return `🗑️ *${product.name}* supprimé définitivement.`;
        }
        default:
            return '❌ Commande non reconnue.';
    }
}
// ── Mutating business action detector ───────────────────────────────────────
// Distinguishes read-only intents ("résume mes ventes", "qui n'a pas payé")
// from mutating actions ("envoie une relance", "publie la campagne") that
// change shared state — emails sent, products created, broadcasts launched.
// Mutating actions REQUIRE explicit yes/no confirmation before the
// orchestrator runs. Read-only intents bypass the confirm step.
function isMutatingBusinessAction(text) {
    if (!text)
        return false;
    const t = text.toLowerCase();
    const mutationVerbs = [
        /\benvoie\b|\benvoyer\b|\benvoi\b/,
        /\brelance\w*\b/,
        /\bpublie\b|\bpublier\b|\bdiffuse\b/,
        /\bcr[eé]e?z?\s+(une\s+)?(campagne|tâche|relance|email|mail|message|broadcast)/,
        /\bsupprime\w*\b|\bdelete\w*\b/,
        /\bannule\w*\b|\bcancel\w*\b/,
        /\bcontacte\w*\b/,
        /\blance\w*\s+(la|une)\s+(campagne|relance|promo)/,
        /\bnotif[ier]\b.*\b(client|équipe|tous)/,
    ];
    return mutationVerbs.some(re => re.test(t));
}
// ── Business-intent detector (Clone → Orchestrator escalation) ─────────────
// When an authenticated owner writes anything that smells like a multi-agent
// business task (relance impayés, campagne, recrutement, …), the WhatsApp
// webhook switches the brain from Clone to Orchestrator so the request is
// routed to the right specialist agent.
//
// This is the heart of the "Orlode universal cockpit" vision — see
// memory/project_orlode_vision.md.
function detectBusinessIntent(text) {
    if (!text)
        return false;
    const t = text.toLowerCase();
    // Each keyword cluster maps to one or more agents the orchestrator will engage.
    const patterns = [
        /\brelance\w*\b.*\b(client|impayé|facture|paiement)/i,
        /\b(impay[eé]|impayée|en\s*retard)\b/i,
        /\bfacture\w*\b/i,
        /\bcampagne\b|\bpromo\b|\bpublie\b|\bpublication\b/i,
        /\b(support|ticket)\b/i,
        /\b(recrutement|recrute|candidat|cv|embauche)\b/i,
        /\b(planning|rendez-?vous|rdv|disponibilit[eé])\b/i,
        /\b(message à l['']équipe|slack|notif[ier])\b/i,
        /\br[eé]sume?z?\b|\bsynth[èe]se\b|\brapport\b|\bstats?\b|\banalyse\b/i,
        /\b(email|mail|envoie\s+un\s+e?-?mail)\b/i,
        /\b(cr[eé]e?z?\s+tâche|cr[eé]e?z?\s+suivi)\b/i,
        /\bbilan\b|\bcomptabilit[eé]\b/i,
        /\b(envoie\s+\w+\s+à|envoie\s+un\s+message)/i,
        // Customer-facing commerce queries — orchestrator has commerceListProducts
        /\b(catalogue|catalog)\b/i,
        /\b(qu['e]?\s*est[\s-]?ce que\s+(?:tu\s+|vous\s+)?vend(?:e?z|s))\b/i,
        /\b(tes|vos|ton|votre)\s+produits?\b/i,
        /\bque\s+(?:est[\s-]?ce que\s+)?(?:tu\s+|vous\s+)?vend(?:e?z|s)/i,
        /\bvous\s+avez\s+quoi\b/i,
        /\bje\s+veux\s+(?:acheter|commander|voir)\b/i,
        /\bmes\s+commandes?\b|\bvoir\s+(?:les\s+)?commandes?\b/i,
        // Owner self-questions ("j'ai combien de stores ?", "quel est mon CA ?")
        /\b(j'?ai|on\s+a)\s+combien\b/i,
        /\bcombien\s+(?:de|d')\s*(?:store|stores|boutique|magasin|produit|article|client|commande|réservation|chambre|patient|bien|consultation|RDV|rendez-vous)/i,
        /\b(quel|quelle|quels|quelles)\s+est\s+(?:mon|ma|mes)\b/i,
        /\b(mes|mon|ma)\s+(store|stores|boutique|magasin|chiffre|CA|revenu|stock|inventaire|client|patient|bien|chambre)/i,
        /\b(liste|montre[\-\s]?moi|affiche[\-\s]?moi|donne[\-\s]?moi)\s+(les|mes|mon|ma)\b/i,
        /\bmon\s+(?:status|statut|tableau\s+de\s+bord|dashboard)\b/i,
    ];
    for (const re of patterns)
        if (re.test(t))
            return true;
    return false;
}
// ── Detect target businessType from owner text ─────────────────────────────
// When an owner says "ajoute au menu du resto" or "nouvelle chambre à l'hôtel",
// extract which vertical they mean. Used to route the action to the right
// store when a company has multiple (boutique + restaurant + hotel + ...).
// Returns null when no clear vertical hint is present.
function detectStoreBusinessType(text) {
    if (!text)
        return null;
    const t = text.toLowerCase();
    // Order matters: more specific patterns first
    if (/\b(restaurant|resto|menu|plat|cuisine|repas)\b/.test(t))
        return 'restaurant';
    if (/\b(h[oô]tel|chambre|s[eé]jour|nuit[eé]e|reservation\s+chambre)\b/.test(t))
        return 'hotel';
    if (/\b(salon|coiffure|beaut[eé]|esth[eé]tique|manucure|massage)\b/.test(t))
        return 'service';
    if (/\b(cabinet|patient|consultation|m[eé]dical|m[eé]decin|sant[eé])\b/.test(t))
        return 'health';
    if (/\b(bien|appartement|maison|villa|immobilier|location|terrain|visite\s+immo)\b/.test(t))
        return 'realestate';
    if (/\b(boutique|shop|magasin|article|catalogue)\b/.test(t))
        return 'boutique';
    return null;
}
// ── Find ALL owner stores (multi-store companies) ──────────────────────────
// Returns every store of `companyId` whose ownerPhone matches `fromPhone`
// (digit-compare). Used by the WhatsApp webhook to disambiguate when an owner
// has activated multiple packs (boutique + restaurant + hotel + ...).
async function findAllStoresByOwnerPhone(fromPhone, companyId) {
    const digits = normalizePhone(fromPhone);
    if (!digits || !companyId)
        return [];
    const db = (0, firebase_config_1.getFirestore)();
    const allSnap = await db.collection(`companies/${companyId}/stores`).get().catch(() => null);
    if (!allSnap || allSnap.empty)
        return [];
    const out = [];
    for (const doc of allSnap.docs) {
        const data = doc.data();
        const storedDigits = normalizePhone(data.ownerPhone ?? '');
        if (storedDigits && storedDigits === digits) {
            out.push({ storeId: doc.id, store: data });
        }
    }
    return out;
}
// ── Slack-style "@orlode" mention detector ─────────────────────────────────
// Universal trigger that bypasses Clone and routes the message straight to
// the Orchestrator with full agent powers. Recognized prefixes (case-insensitive,
// at the very start of the message, optional whitespace before/after):
//   @orlode <message>          → universal alias
//   @<companyName> <message>   → e.g. "@boutique sara, relance les impayés"
//   @<storeSlug> <message>     → e.g. "@chez-sara résume les ventes"
//
// Returns { matched: true, stripped: <message-without-mention> } on match,
// otherwise { matched: false, stripped: text }. Caller is responsible for
// authorization — typically only owner/admin phones get the brain switch
// (an anonymous visitor typing "@orlode" should NOT escalate to internal agents).
function detectOrlodeMention(text, opts) {
    if (!text)
        return { matched: false, stripped: text };
    const trimmed = text.trimStart();
    if (!trimmed.startsWith('@'))
        return { matched: false, stripped: text };
    // Extract the @token (alphanum + dash + underscore)
    const m = trimmed.match(/^@([a-z0-9][a-z0-9_\-]*)\s*/i);
    if (!m)
        return { matched: false, stripped: text };
    const token = m[1].toLowerCase();
    const stripped = trimmed.slice(m[0].length).trimStart();
    // Universal aliases — @orlode and @admin both unlock the orchestrator
    // (admin is the more discoverable verb for owners who don't know our brand)
    if (token === 'orlode' || token === 'admin' || token === 'cockpit' || token === 'patron') {
        return { matched: true, stripped };
    }
    const slug = (s) => s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    // Company name match (handle accents/spaces)
    if (opts?.companyName) {
        const cn = slug(opts.companyName);
        if (cn && (token === cn || token === cn.replace(/-/g, ''))) {
            return { matched: true, stripped };
        }
    }
    // Store slug match (already kebab-case in Firestore)
    if (opts?.storeSlugs?.length) {
        for (const s of opts.storeSlugs) {
            if (!s)
                continue;
            const norm = s.toLowerCase();
            if (token === norm || token === norm.replace(/-/g, '')) {
                return { matched: true, stripped };
            }
        }
    }
    return { matched: false, stripped: text };
}
// After a successful order, check which products just crossed below the
// LOW_STOCK_THRESHOLD and ping the owner with a single batched message.
const LOW_STOCK_THRESHOLD = 3;
async function notifyOwnerOfLowStock(args) {
    if (!args.ownerPhone)
        return;
    const lowItems = [];
    for (let i = 0; i < args.items.length; i++) {
        const snap = args.productSnaps[i];
        if (!snap?.exists)
            continue;
        const p = snap.data();
        const before = p.stockQty ?? 0;
        const after = before - args.items[i].qty;
        if (before > LOW_STOCK_THRESHOLD && after <= LOW_STOCK_THRESHOLD) {
            lowItems.push(`• ${p.name} — ${after <= 0 ? 'rupture' : `reste ${after}`}`);
        }
    }
    if (lowItems.length === 0)
        return;
    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
    const cfg = await whatsappService.getConfig(args.companyId).catch(() => null);
    if (!cfg)
        return;
    const msg = `⚠️ *Stock bas* — pense à recharger\n\n${lowItems.join('\n')}\n\n` +
        `Sur WhatsApp tape : "stock {nom du produit} {qté}" pour rechiffrer.\n` +
        `Ex : *stock Chemise African 10*`;
    await whatsappService.sendMessage(cfg, args.ownerPhone, msg).catch(() => null);
    logger_1.logger.info('[Commerce] Low stock alert sent', { companyId: args.companyId, storeId: args.storeId, count: lowItems.length });
}
// ── Bridge customer → whatsappLeads + customers sub-collection ──────────────
// Each new order upserts a lead doc keyed on the digit-normalized phone, so
// the existing /admin/whatsapp/broadcasts UI can target Boutique customers
// alongside other lead sources.
async function bridgeCustomerToLeads(args) {
    const phoneKey = args.customerPhone.replace(/\D/g, '');
    if (!phoneKey)
        return;
    const db = (0, firebase_config_1.getFirestore)();
    const FieldValue = (await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')))).FieldValue;
    // 1. Upsert into customers sub-collection of the store (boutique-scoped view)
    await db.collection(`companies/${args.companyId}/stores/${args.storeId}/customers`)
        .doc(phoneKey)
        .set({
        name: args.customerName,
        phone: args.customerPhone,
        ordersCount: FieldValue.increment(1),
        totalSpent: FieldValue.increment(args.total),
        ...(typeof args.loyaltyPointsDelta === 'number'
            ? { loyaltyPoints: FieldValue.increment(args.loyaltyPointsDelta) }
            : {}),
        lastOrderNumber: args.orderNumber,
        lastOrderAt: new Date(),
        lastOrderTotal: args.total,
        currency: args.currency,
        updatedAt: new Date(),
    }, { merge: true });
    // 2. Upsert into whatsappLeads (cross-company view used by broadcast UI)
    await db.collection(`companies/${args.companyId}/whatsappLeads`)
        .doc(`boutique_${args.storeId}_${phoneKey}`)
        .set({
        customerName: args.customerName,
        customerPhone: args.customerPhone,
        source: 'boutique',
        sourceStoreId: args.storeId,
        status: 'qualified',
        lastInteractionAt: new Date(),
        ordersCount: FieldValue.increment(1),
        totalSpent: FieldValue.increment(args.total),
        updatedAt: new Date(),
    }, { merge: true });
    logger_1.logger.info('[Commerce] Customer bridged to leads', {
        companyId: args.companyId, storeId: args.storeId, phone: args.customerPhone,
    });
}
// ── Welcome message on first order ─────────────────────────────────────────
// Idempotent — uses `welcomeSentAt` on the customer doc as a guard so the
// message can never fire twice for the same phone.
async function sendWelcomeIfFirstOrder(args) {
    const phoneKey = args.customerPhone.replace(/\D/g, '');
    if (!phoneKey)
        return;
    const db = (0, firebase_config_1.getFirestore)();
    const customerRef = db.doc(`companies/${args.companyId}/stores/${args.storeId}/customers/${phoneKey}`);
    const snap = await customerRef.get();
    if (snap.exists && snap.data()?.welcomeSentAt)
        return;
    const { sendMarketing, recordMarketingEvent } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/smartOutbound')));
    const { generatePromoCode } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/marketingTemplates')));
    const promoCode = generatePromoCode('WELCOME');
    const firstName = args.customerName.split(/\s+/)[0] ?? args.customerName;
    await sendMarketing(args.companyId, args.customerPhone, 'welcome_first_order', {
        firstName, orderNumber: args.orderNumber, promoCode,
    });
    await customerRef.set({
        welcomeSentAt: new Date(),
        welcomePromoCode: promoCode,
    }, { merge: true });
    await recordMarketingEvent(args.companyId, args.storeId, args.customerPhone, 'welcome', { promoCode });
    logger_1.logger.info('[Commerce] Welcome message dispatched', {
        companyId: args.companyId, storeId: args.storeId, phone: args.customerPhone, promoCode,
    });
}
// ── Upsell IA — proactive cross-sell suggestion after order ─────────────────
// Fired ~5s after a successful order. Uses Gemini to pick 1-2 complementary
// products from the catalog. Sends a soft suggestion WhatsApp to the customer.
// Skipped if catalog has fewer than 3 active products (not enough variety).
async function proposeUpsellAfterOrder(args) {
    // Wait so the customer gets the order confirmation before this lands
    await new Promise(r => setTimeout(r, 5000));
    const db = (0, firebase_config_1.getFirestore)();
    const allSnap = await db.collection(`companies/${args.companyId}/stores/${args.storeId}/products`)
        .where('status', '==', 'active').limit(100).get();
    const all = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const candidates = all.filter(p => !args.justBoughtProductIds.includes(p.id));
    if (candidates.length < 2 || all.length < 3)
        return; // catalog trop petit
    const justBought = all.filter(p => args.justBoughtProductIds.includes(p.id));
    if (justBought.length === 0)
        return;
    // Trim catalog so prompt stays small
    const catalogForPrompt = candidates.slice(0, 30).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category ?? null,
        price: p.price,
    }));
    let pickedProduct = null;
    try {
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Tu es un vendeur expert. Un client vient d'acheter :
${justBought.map(p => `- ${p.name} (${p.category ?? 'non catégorisé'})`).join('\n')}

Voici le catalogue restant disponible :
${JSON.stringify(catalogForPrompt, null, 2)}

Choisis UN SEUL produit qui complète bien l'achat (look complet, accessoire, usage commun). Si rien ne va vraiment ensemble, retourne null.

Retourne JSON STRICT (rien d'autre) :
{"productId": "<id ou null>", "reason": "courte raison en français (max 12 mots)"}`,
            config: { temperature: 0.3 },
        });
        const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.productId) {
            pickedProduct = candidates.find(p => p.id === parsed.productId) ?? null;
        }
    }
    catch (err) {
        logger_1.logger.warn('[Commerce] Upsell Gemini call failed', { error: String(err) });
        return;
    }
    if (!pickedProduct)
        return;
    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
    const cfg = await whatsappService.getConfig(args.companyId).catch(() => null);
    if (!cfg)
        return;
    const firstName = args.customerName.split(' ')[0];
    const formattedPrice = pickedProduct.price.toLocaleString('fr-FR');
    const msg = `🎁 *${firstName}*, beaucoup de clients qui achètent "${justBought[0].name}" prennent aussi :\n\n` +
        `📦 *${pickedProduct.name}* — ${formattedPrice} ${args.currency}\n` +
        (pickedProduct.description ? `${pickedProduct.description}\n` : '') +
        `\nÇa t'intéresse ? Réponds *"je veux ${pickedProduct.name}"* pour l'ajouter à ta commande.`;
    await whatsappService.sendMessage(cfg, args.customerPhone, msg).catch(() => null);
    logger_1.logger.info('[Commerce] Upsell sent', {
        companyId: args.companyId, storeId: args.storeId,
        customerPhone: args.customerPhone, picked: pickedProduct.name,
    });
}
// ── Daily digest + post-delivery reactivation (called by cron) ──────────────
async function runCommerceDailyJob() {
    const db = (0, firebase_config_1.getFirestore)();
    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
    const { sendMarketing, shouldSendOnce, recordMarketingEvent } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/smartOutbound')));
    const { generatePromoCode } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/marketingTemplates')));
    // Find all active stores across companies
    const storesSnap = await db.collectionGroup('stores')
        .where('status', '==', 'active').limit(500).get();
    let digestsSent = 0;
    let reactivationsSent = 0;
    for (const storeDoc of storesSnap.docs) {
        const store = storeDoc.data();
        const parent = storeDoc.ref.parent.parent;
        if (!parent || !store.ownerPhone)
            continue;
        const companyId = parent.id;
        const storeId = storeDoc.id;
        const cfg = await whatsappService.getConfig(companyId).catch(() => null);
        if (!cfg)
            continue;
        // ── A. Daily digest (last 24h) ─────────────────────────────────────────
        try {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const ordersSnap = await db.collection(`companies/${companyId}/stores/${storeId}/orders`)
                .where('createdAt', '>=', since)
                .limit(500).get();
            const ordersCount = ordersSnap.size;
            let revenuePaid = 0;
            const productCounts = {};
            for (const od of ordersSnap.docs) {
                const o = od.data();
                if (o.paymentStatus === 'paid')
                    revenuePaid += o.total ?? 0;
                for (const it of (o.items ?? [])) {
                    productCounts[it.name] = (productCounts[it.name] ?? 0) + it.qty;
                }
            }
            // Top product
            const topEntry = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];
            const topLine = topEntry ? `🏆 Top : ${topEntry[0]} (×${topEntry[1]})` : '';
            // Only send digest if at least 1 order — silent days don't spam
            if (ordersCount > 0) {
                const currency = store.currency ?? 'XOF';
                const msg = `📊 *Résumé du jour* — ${new Date().toLocaleDateString('fr-FR')}\n\n` +
                    `🛒 ${ordersCount} commande${ordersCount > 1 ? 's' : ''}\n` +
                    `💰 ${revenuePaid.toLocaleString('fr-FR')} ${currency} encaissés\n` +
                    (topLine ? `${topLine}\n` : '') +
                    `\n📲 Détails : ${PUBLIC_APP_URL}/agents/commerce`;
                await whatsappService.sendMessage(cfg, store.ownerPhone, msg).catch(() => null);
                digestsSent++;
            }
        }
        catch (err) {
            logger_1.logger.warn('[Commerce] Digest failed for store', { companyId, storeId, error: String(err) });
        }
        // Resolve public shop link once for marketing flows below.
        const slug = await ensureStoreSlug(companyId, storeId, store).catch(() => null);
        const shopLink = slug ? `${PUBLIC_APP_URL}/shop/${slug}` : `${PUBLIC_APP_URL}/shop/${companyId}/${storeId}`;
        // ── B. Review request — orders delivered ~3 days ago ───────────────────
        try {
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
            const dueSnap = await db.collection(`companies/${companyId}/stores/${storeId}/orders`)
                .where('deliveryStatus', '==', 'delivered')
                .where('updatedAt', '>=', fourDaysAgo)
                .where('updatedAt', '<=', threeDaysAgo)
                .limit(200).get().catch(() => null);
            if (dueSnap) {
                for (const od of dueSnap.docs) {
                    const o = od.data();
                    if (o.reviewRequestSentAt)
                        continue;
                    const firstName = o.customerName.split(/\s+/)[0] ?? o.customerName;
                    const productName = o.items?.[0]?.name ?? 'ta commande';
                    await sendMarketing(companyId, o.customerPhone, 'review_request', {
                        firstName, productName, shopLink,
                    });
                    await od.ref.update({ reviewRequestSentAt: new Date() }).catch(() => null);
                    await recordMarketingEvent(companyId, storeId, o.customerPhone, 'review', { orderNumber: o.orderNumber });
                    reactivationsSent++;
                }
            }
        }
        catch (err) {
            logger_1.logger.warn('[Commerce] Review request failed for store', { companyId, storeId, error: String(err) });
        }
        // ── C. Post-delivery reactivation — delivered ~7 days ago ──────────────
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
            const recentSnap = await db.collection(`companies/${companyId}/stores/${storeId}/orders`)
                .where('deliveryStatus', '==', 'delivered')
                .where('updatedAt', '>=', eightDaysAgo)
                .where('updatedAt', '<=', sevenDaysAgo)
                .limit(200).get().catch(() => null);
            if (recentSnap) {
                for (const od of recentSnap.docs) {
                    const o = od.data();
                    if (o.followUpSentAt)
                        continue;
                    const firstName = o.customerName.split(/\s+/)[0] ?? o.customerName;
                    const productName = o.items?.[0]?.name ?? 'tes derniers achats';
                    await sendMarketing(companyId, o.customerPhone, 'cart_abandoned', {
                        firstName, productName, shopLink,
                    });
                    await od.ref.update({ followUpSentAt: new Date() }).catch(() => null);
                    reactivationsSent++;
                }
            }
        }
        catch (err) {
            logger_1.logger.warn('[Commerce] Reactivation failed for store', { companyId, storeId, error: String(err) });
        }
        // ── D. Win-back J+30 — customers with no order in 30+ days ─────────────
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
            const dormantSnap = await db.collection(`companies/${companyId}/stores/${storeId}/customers`)
                .where('lastOrderAt', '<=', thirtyDaysAgo)
                .where('lastOrderAt', '>=', sixtyDaysAgo) // cap so we don't ping forever
                .limit(200).get().catch(() => null);
            if (dormantSnap) {
                for (const cd of dormantSnap.docs) {
                    const c = cd.data();
                    const ok = await shouldSendOnce(companyId, storeId, c.phone, 'winback', 30);
                    if (!ok)
                        continue;
                    const firstName = c.name.split(/\s+/)[0] ?? c.name;
                    const promoCode = generatePromoCode('BACK');
                    await sendMarketing(companyId, c.phone, 'winback_30d', {
                        firstName, shopLink, promoCode,
                    });
                    await recordMarketingEvent(companyId, storeId, c.phone, 'winback', { promoCode });
                    reactivationsSent++;
                }
            }
        }
        catch (err) {
            logger_1.logger.warn('[Commerce] Win-back failed for store', { companyId, storeId, error: String(err) });
        }
    }
    logger_1.logger.info('[Commerce] Daily job complete', { digestsSent, reactivationsSent });
    return { digestsSent, reactivationsSent };
}
// ── Reservation reminders (cron: every hour) ───────────────────────────────
// Sends J-1 reminder (evening before, 18-20h local) + H-2 reminder.
// Idempotent: each reservation tracks `remindersSent: ['day_before', 'two_hours']`.
async function runReservationReminders() {
    const db = (0, firebase_config_1.getFirestore)();
    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10);
    const hour = now.getHours();
    let scanned = 0;
    let sent = 0;
    let errors = 0;
    // Reservations for tomorrow (J-1 reminder, only between 18-21h local) + today (H-2)
    const targetDates = hour >= 18 && hour <= 21 ? [tomorrowISO, todayISO] : [todayISO];
    for (const date of targetDates) {
        const snap = await db.collectionGroup('reservations')
            .where('date', '==', date)
            .where('status', 'in', ['pending', 'confirmed']).get().catch(() => null);
        if (!snap)
            continue;
        for (const r of snap.docs) {
            scanned++;
            try {
                const data = r.data();
                if (!data.customerPhone)
                    continue;
                const sentList = Array.isArray(data.remindersSent) ? data.remindersSent : [];
                const isJ1 = date === tomorrowISO;
                const kind = isJ1 ? 'day_before' : 'two_hours';
                if (sentList.includes(kind))
                    continue;
                // For H-2, only send if reservation is 90-150 min away
                if (kind === 'two_hours' && data.time) {
                    const [h, m] = data.time.split(':').map(n => parseInt(n));
                    const resMin = h * 60 + m;
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    const delta = resMin - nowMin;
                    if (delta < 90 || delta > 150)
                        continue;
                }
                // Find the store (parent of reservations subcollection)
                const storeRef = r.ref.parent.parent;
                if (!storeRef)
                    continue;
                const storeDoc = await storeRef.get();
                const store = storeDoc.data();
                const companyId = storeRef.parent.parent?.id;
                if (!store || !companyId)
                    continue;
                const cfg = await whatsappService.getConfig(companyId).catch(() => null);
                if (!cfg)
                    continue;
                const greet = data.customerName ? `Bonjour ${data.customerName}` : 'Bonjour';
                const text = isJ1
                    ? `${greet} 👋\n\n📅 Rappel : ta réservation chez *${store.name}* est demain à *${data.time ?? '20h'}* (${data.partySize ?? 1} pers.).\n\nÀ très vite ! Pour annuler ou décaler, réponds à ce message.`
                    : `${greet} 👋\n\n⏰ Rappel : ta table chez *${store.name}* t'attend dans 2h (à *${data.time}*, ${data.partySize ?? 1} pers.).\n\nÀ tout à l'heure ! 🙏`;
                await whatsappService.sendMessage(cfg, data.customerPhone, text);
                await r.ref.set({
                    remindersSent: [...sentList, kind],
                    updatedAt: new Date(),
                }, { merge: true });
                sent++;
            }
            catch (err) {
                errors++;
                logger_1.logger.warn('[Commerce] Reservation reminder failed', { err: String(err) });
            }
        }
    }
    logger_1.logger.info('[Commerce] Reservation reminders done', { scanned, sent, errors });
    return { scanned, sent, errors };
}
// ── Stay-cycle messages (cron: every hour) ─────────────────────────────────
// For hotel + residence multi-night bookings:
//   - J-1 pre-arrival message at 17h-20h local → check-in instructions, GPS,
//     house rules, optional door code.
//   - Post-stay review request 2-4h after checkOutDate → asks for WhatsApp rating.
// Idempotent via `stayMessagesSent: ['pre_arrival', 'post_stay']`.
async function runStayCycleMessages() {
    const db = (0, firebase_config_1.getFirestore)();
    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
    const now = new Date();
    const hour = now.getHours();
    const todayISO = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10);
    let preSent = 0;
    let postSent = 0;
    let errors = 0;
    // ── A. Pre-arrival (J-1, evening 17-20h) ──
    if (hour >= 17 && hour <= 20) {
        const snap = await db.collectionGroup('reservations')
            .where('date', '==', tomorrowISO)
            .where('status', 'in', ['pending', 'confirmed']).get().catch(() => null);
        for (const r of snap?.docs ?? []) {
            try {
                const data = r.data();
                if (!data.customerPhone || (data.nights ?? 0) < 1)
                    continue;
                const sentList = Array.isArray(data.stayMessagesSent) ? data.stayMessagesSent : [];
                if (sentList.includes('pre_arrival'))
                    continue;
                const storeRef = r.ref.parent.parent;
                if (!storeRef)
                    continue;
                const storeDoc = await storeRef.get();
                const store = storeDoc.data();
                const companyId = storeRef.parent.parent?.id;
                if (!store || !companyId)
                    continue;
                // Only hotel/residence packs
                if (store.businessType !== 'hotel' && store.businessType !== 'residence')
                    continue;
                const cfg = await whatsappService.getConfig(companyId).catch(() => null);
                if (!cfg)
                    continue;
                const greet = data.customerName ? `Bonjour ${data.customerName}` : 'Bonjour';
                const lines = [];
                lines.push(`${greet} 👋`);
                lines.push('');
                lines.push(`🏠 Bienvenue ! Ton arrivée chez *${store.name}* est prévue *demain*.`);
                if (data.nights)
                    lines.push(`📅 ${data.nights} nuit${data.nights > 1 ? 's' : ''} (jusqu'au ${data.checkOutDate ?? '?'})`);
                if (store.address)
                    lines.push(`📍 ${store.address}`);
                if (store.checkInInstructions) {
                    lines.push('');
                    lines.push(`🔑 *Check-in*`);
                    lines.push(store.checkInInstructions);
                }
                if (store.houseRules) {
                    lines.push('');
                    lines.push(`📋 *Règlement*`);
                    lines.push(store.houseRules);
                }
                lines.push('');
                lines.push(`Pour toute question, réponds à ce message. À demain ! 🙏`);
                await whatsappService.sendMessage(cfg, data.customerPhone, lines.join('\n'));
                // Also send native location pin if GPS configured
                if (typeof store.latitude === 'number' && typeof store.longitude === 'number') {
                    await whatsappService.sendLocation(cfg, data.customerPhone, {
                        latitude: store.latitude, longitude: store.longitude,
                        name: store.name, address: store.address,
                    }).catch(() => null);
                }
                await r.ref.set({
                    stayMessagesSent: [...sentList, 'pre_arrival'],
                    updatedAt: new Date(),
                }, { merge: true });
                preSent++;
            }
            catch (err) {
                errors++;
                logger_1.logger.warn('[Commerce] Pre-arrival msg failed', { err: String(err) });
            }
        }
    }
    // ── B. Post-stay review (checkOutDate = today, fires 11h-14h local) ──
    if (hour >= 11 && hour <= 14) {
        const snap = await db.collectionGroup('reservations')
            .where('checkOutDate', '==', todayISO).get().catch(() => null);
        for (const r of snap?.docs ?? []) {
            try {
                const data = r.data();
                if (!data.customerPhone)
                    continue;
                if (data.status === 'cancelled' || data.status === 'no_show')
                    continue;
                const sentList = Array.isArray(data.stayMessagesSent) ? data.stayMessagesSent : [];
                if (sentList.includes('post_stay'))
                    continue;
                const storeRef = r.ref.parent.parent;
                if (!storeRef)
                    continue;
                const storeDoc = await storeRef.get();
                const store = storeDoc.data();
                const companyId = storeRef.parent.parent?.id;
                if (!store || !companyId)
                    continue;
                if (store.businessType !== 'hotel' && store.businessType !== 'residence')
                    continue;
                const cfg = await whatsappService.getConfig(companyId).catch(() => null);
                if (!cfg)
                    continue;
                const greet = data.customerName ? `${data.customerName}` : 'cher client';
                const publicUrl = store.slug
                    ? `https://mon-assistant-86bbd.web.app/${store.businessType === 'hotel' ? 'hotel' : 'residence'}/${store.slug}`
                    : null;
                const text = `Merci ${greet} d'avoir choisi *${store.name}* 🙏\n\n` +
                    `J'espère que ton séjour s'est super bien passé !\n\n` +
                    `⭐ *Comment c'était ?* Note de 1 à 5 et un petit mot si tu veux — ça nous aide énormément.\n\n` +
                    (publicUrl ? `Si tu veux revenir : ${publicUrl}\n\n` : '') +
                    `À très vite ! ✨`;
                await whatsappService.sendMessage(cfg, data.customerPhone, text);
                await r.ref.set({
                    stayMessagesSent: [...sentList, 'post_stay'],
                    updatedAt: new Date(),
                }, { merge: true });
                postSent++;
            }
            catch (err) {
                errors++;
                logger_1.logger.warn('[Commerce] Post-stay msg failed', { err: String(err) });
            }
        }
    }
    logger_1.logger.info('[Commerce] Stay-cycle done', { preSent, postSent, errors });
    return { preSent, postSent, errors };
}
// ── Morning brief (cron: 7h Abidjan daily) ─────────────────────────────────
// Sends a daily KPI summary to each restaurant owner via WhatsApp.
async function runMorningBrief() {
    const db = (0, firebase_config_1.getFirestore)();
    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
    const storesSnap = await db.collectionGroup('stores')
        .where('status', '==', 'active').limit(500).get();
    let briefsSent = 0;
    let errors = 0;
    for (const storeDoc of storesSnap.docs) {
        const store = storeDoc.data();
        const parent = storeDoc.ref.parent.parent;
        if (!parent || !store.ownerPhone)
            continue;
        const companyId = parent.id;
        const storeId = storeDoc.id;
        // Restaurants + boutiques are the main candidates
        if (store.businessType && !['restaurant', 'boutique', 'service', 'health', 'hotel', 'residence'].includes(store.businessType))
            continue;
        try {
            const cfg = await whatsappService.getConfig(companyId).catch(() => null);
            if (!cfg)
                continue;
            // Yesterday range
            const today = new Date();
            const yStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
            const yEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const ordersSnap = await db.collection(`companies/${companyId}/stores/${storeId}/orders`)
                .where('createdAt', '>=', yStart).where('createdAt', '<', yEnd)
                .limit(500).get().catch(() => null);
            const ordersCount = ordersSnap?.size ?? 0;
            let revenue = 0;
            const itemCounts = {};
            for (const o of ordersSnap?.docs ?? []) {
                const data = o.data();
                if (data.paymentStatus === 'paid')
                    revenue += data.total ?? 0;
                for (const it of (data.items ?? []))
                    itemCounts[it.name] = (itemCounts[it.name] ?? 0) + it.qty;
            }
            const topEntry = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
            // Today's reservations
            const todayISO = today.toISOString().slice(0, 10);
            const resoSnap = await db.collection(`companies/${companyId}/stores/${storeId}/reservations`)
                .where('date', '==', todayISO).limit(100).get().catch(() => null);
            const resoCount = resoSnap?.size ?? 0;
            let covers = 0;
            for (const r of resoSnap?.docs ?? []) {
                covers += r.data().partySize ?? 0;
            }
            // Low-stock items
            const productsSnap = await db.collection(`companies/${companyId}/stores/${storeId}/products`)
                .where('stockQty', '<=', 3).where('status', '==', 'active').limit(20).get().catch(() => null);
            const lowStock = productsSnap?.docs.map(d => d.data().name).filter(Boolean) ?? [];
            // Skip silently if zero activity AND no reservation
            if (ordersCount === 0 && resoCount === 0 && lowStock.length === 0)
                continue;
            const currency = store.currency ?? 'XOF';
            const fmt = (n) => `${n.toLocaleString('fr-FR')} ${currency}`;
            const verticalLabel = store.businessType === 'hotel' ? 'ton hôtel' :
                store.businessType === 'service' ? 'ton salon' :
                    store.businessType === 'health' ? 'ton cabinet' :
                        store.businessType === 'residence' ? 'ta résidence' :
                            store.businessType === 'restaurant' ? 'ton resto' :
                                'ta boutique';
            const lines = [];
            lines.push(`☀️ Bonjour ! Voici ton brief pour ${verticalLabel} *${store.name}* :`);
            lines.push('');
            lines.push('📊 *Hier*');
            lines.push(`• ${ordersCount} commande${ordersCount > 1 ? 's' : ''}`);
            if (revenue > 0)
                lines.push(`• CA payé : *${fmt(revenue)}*`);
            if (topEntry)
                lines.push(`• Star : ${topEntry[0]} (${topEntry[1]} ventes)`);
            lines.push('');
            lines.push('📅 *Aujourd\'hui*');
            lines.push(`• ${resoCount} réservation${resoCount > 1 ? 's' : ''}${covers > 0 ? ` (${covers} couverts)` : ''}`);
            if (lowStock.length > 0) {
                lines.push('');
                lines.push(`⚠️ *Stock faible* : ${lowStock.slice(0, 3).join(', ')}${lowStock.length > 3 ? '…' : ''}`);
                lines.push(`_Pense à restocker ou désactiver._`);
            }
            lines.push('');
            lines.push(`💡 Tape *@admin* pour piloter en direct.`);
            await whatsappService.sendMessage(cfg, store.ownerPhone, lines.join('\n'));
            briefsSent++;
        }
        catch (err) {
            errors++;
            logger_1.logger.warn('[Commerce] Morning brief failed', { storeId, err: String(err) });
        }
    }
    logger_1.logger.info('[Commerce] Morning brief done', { briefsSent, errors });
    return { briefsSent, errors };
}
// ── Stock alerts (cron: every 30 min during service hours) ─────────────────
// Scans products with stockQty <= threshold and sends interactive WhatsApp
// alerts to owner. Throttled: max 1 alert per product per day.
async function runStockAlerts() {
    const db = (0, firebase_config_1.getFirestore)();
    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
    const today = new Date().toISOString().slice(0, 10);
    const lowSnap = await db.collectionGroup('products')
        .where('stockQty', '<=', 3)
        .where('status', '==', 'active').limit(500).get().catch(() => null);
    if (!lowSnap)
        return { scanned: 0, alerted: 0, errors: 0 };
    let alerted = 0;
    let errors = 0;
    for (const p of lowSnap.docs) {
        try {
            const data = p.data();
            if (data.lastStockAlertDate === today)
                continue; // already alerted today
            const m = p.ref.path.match(/^companies\/([^/]+)\/stores\/([^/]+)\/products\/([^/]+)$/);
            if (!m)
                continue;
            const [, companyId, storeId] = m;
            const storeDoc = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
            const store = storeDoc.data();
            if (!store?.ownerPhone)
                continue;
            const cfg = await whatsappService.getConfig(companyId).catch(() => null);
            if (!cfg)
                continue;
            const stockText = (data.stockQty ?? 0) === 0
                ? `🚨 *${data.name}* est *en rupture* dans *${store.name}*.\n\nClients ne peuvent plus commander.\n\nReponds *restock {nouvelle qte}* pour restocker (ex: *restock 20*).`
                : `⚠️ *${data.name}* : il reste ${data.stockQty ?? 0} portion${(data.stockQty ?? 0) > 1 ? 's' : ''} à *${store.name}*.\n\nReponds *restock {qte}* pour rajouter (ex: *restock 20*) ou *off ${data.name}* pour désactiver.`;
            await whatsappService.sendMessage(cfg, store.ownerPhone, stockText);
            await p.ref.set({ lastStockAlertDate: today }, { merge: true });
            // Also surface in admin AgentAlertBar
            await db.collection(`companies/${companyId}/stores/${storeId}/agentInsights`).add({
                type: 'stock_alert',
                priority: (data.stockQty ?? 0) === 0 ? 'critical' : 'high',
                message: (data.stockQty ?? 0) === 0
                    ? `${data.name} en rupture — clients bloqués`
                    : `${data.name} : il reste ${data.stockQty} portion${(data.stockQty ?? 0) > 1 ? 's' : ''}`,
                productId: p.id,
                productName: data.name ?? '',
                actionLabel: (data.stockQty ?? 0) === 0 ? 'Restock' : 'Voir',
                actionType: 'restock_or_disable',
                dismissed: false,
                createdAt: new Date(),
            }).catch(() => null);
            alerted++;
        }
        catch (err) {
            errors++;
            logger_1.logger.warn('[Commerce] Stock alert failed', { err: String(err) });
        }
    }
    logger_1.logger.info('[Commerce] Stock alerts done', { scanned: lowSnap.size, alerted, errors });
    return { scanned: lowSnap.size, alerted, errors };
}
// ── Restaurant tool: create a table reservation ─────────────────────────────
// Customer says "table 4 demain 20h pour Adel +225..." → AI calls this.
exports.createReservationTool = genkit_config_1.ai.defineTool({
    name: 'restaurantCreateReservation',
    description: 'Create a table reservation. Use when the customer asks to book/reserve a table — needs name, phone, date (YYYY-MM-DD), time (HH:mm), and partySize.',
    inputSchema: StoreContext.extend({
        customerName: zod_1.z.string(),
        customerPhone: zod_1.z.string(),
        date: zod_1.z.string().describe('YYYY-MM-DD'),
        time: zod_1.z.string().describe('HH:mm 24h'),
        partySize: zod_1.z.number().int().positive(),
        notes: zod_1.z.string().optional().describe('Allergies, occasion, demandes spéciales'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        reservationId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId, customerName, customerPhone, date, time, partySize, notes }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        return { success: false, message: 'Format date invalide. Utilise YYYY-MM-DD.' };
    if (!/^\d{1,2}:\d{2}$/.test(time))
        return { success: false, message: 'Format heure invalide. Utilise HH:mm.' };
    const db = (0, firebase_config_1.getFirestore)();
    // Refuse out-of-hours reservations (uses date+time, not now())
    const storePreSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
    const storePre = storePreSnap.data();
    const hoursCheck = (0, openingHoursCheck_1.isStoreOpenAt)({ openingHours: storePre?.openingHours, date, time: time.padStart(5, '0') });
    if (hoursCheck.status === 'closed') {
        return { success: false, message: `${storePre?.name ?? 'Le restaurant'} est fermé à cette date/heure. ${hoursCheck.reason ?? ''} Choisis un autre créneau s'il te plaît.`.trim() };
    }
    const ref = db.collection(`companies/${companyId}/stores/${storeId}/reservations`).doc();
    await ref.set({
        customerName, customerPhone, date, time,
        partySize, notes: notes ?? '',
        status: 'pending', source: 'whatsapp',
        createdAt: new Date(), updatedAt: new Date(),
    });
    // Notify owner
    try {
        const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
        const store = storeSnap.data();
        if (store?.ownerPhone) {
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
            const cfg = await whatsappService.getConfig(companyId).catch(() => null);
            if (cfg) {
                const msg = `🪑 *Nouvelle réservation*\n\n👤 ${customerName} (${customerPhone})\n📅 ${date} · ${time}\n👥 ${partySize} pers.${notes ? `\n📝 ${notes}` : ''}\n\nConfirmer ? Réponds *oui* ou *non*.`;
                void whatsappService.sendMessage(cfg, store.ownerPhone, msg);
            }
        }
    }
    catch { /* non-blocking */ }
    return {
        success: true,
        reservationId: ref.id,
        message: `🪑 *Réservation enregistrée*\n\n👤 ${customerName}\n📅 ${date} à ${time}\n👥 ${partySize} couvert${partySize > 1 ? 's' : ''}\n\nLe restaurant te contacte rapidement pour confirmer.`,
    };
});
// ── Hotel tool: create a room booking (multi-night stay) ────────────────────
// Customer says "je veux une chambre du 10 au 14 avril pour 2 personnes" → AI calls this.
exports.createBookingTool = genkit_config_1.ai.defineTool({
    name: 'hotelCreateBooking',
    description: 'Create a hotel room booking. Use when the customer wants to reserve a room for one or more nights — needs name, phone, check-in date, check-out date, number of guests, and optionally a roomId/preference. Owner is notified on WhatsApp.',
    inputSchema: StoreContext.extend({
        customerName: zod_1.z.string(),
        customerPhone: zod_1.z.string(),
        checkInDate: zod_1.z.string().describe('YYYY-MM-DD'),
        checkOutDate: zod_1.z.string().describe('YYYY-MM-DD — must be after checkInDate'),
        guests: zod_1.z.number().int().positive(),
        roomId: zod_1.z.string().optional().describe('Optional specific room id — leave empty if customer accepts owner choice'),
        notes: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        reservationId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId, customerName, customerPhone, checkInDate, checkOutDate, guests, roomId, notes }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate))
        return { success: false, message: 'Format date d\'arrivée invalide (YYYY-MM-DD).' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate))
        return { success: false, message: 'Format date de départ invalide (YYYY-MM-DD).' };
    if (checkOutDate <= checkInDate)
        return { success: false, message: 'La date de départ doit être après la date d\'arrivée.' };
    // Anti-overbooking against external calendars (Booking/Airbnb/Google iCal)
    const externalConflict = await (0, icalImport_1.findExternalBlockConflict)({
        companyId, storeId, from: checkInDate, to: checkOutDate, roomId,
    });
    if (externalConflict) {
        return {
            success: false,
            message: `❌ Ces dates (${checkInDate} → ${checkOutDate}) sont indisponibles — déjà réservées sur ${externalConflict.source} (${externalConflict.from} → ${externalConflict.to}). Propose d'autres dates stp.`,
        };
    }
    const nights = Math.max(1, Math.round((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86400000));
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/stores/${storeId}/reservations`).doc();
    await ref.set({
        customerName, customerPhone,
        date: checkInDate,
        checkOutDate,
        time: '14:00',
        partySize: guests,
        nights,
        notes: notes ?? '',
        status: 'pending', source: 'whatsapp',
        ...(roomId ? { roomId } : {}),
        createdAt: new Date(), updatedAt: new Date(),
    });
    // Notify owner
    try {
        const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
        const store = storeSnap.data();
        if (store?.ownerPhone) {
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
            const cfg = await whatsappService.getConfig(companyId).catch(() => null);
            if (cfg) {
                const msg = `🏨 *Nouvelle réservation chambre*\n\n👤 ${customerName} (${customerPhone})\n📅 ${checkInDate} → ${checkOutDate} (${nights} nuit${nights > 1 ? 's' : ''})\n👥 ${guests} pers.${notes ? `\n📝 ${notes}` : ''}\n\nConfirmer ? Réponds *oui* ou *non*.`;
                void whatsappService.sendMessage(cfg, store.ownerPhone, msg);
            }
        }
    }
    catch { /* non-blocking */ }
    return {
        success: true,
        reservationId: ref.id,
        message: `🏨 *Réservation chambre enregistrée*\n\n👤 ${customerName}\n📅 Arrivée : ${checkInDate} (14h)\n🚪 Départ : ${checkOutDate}\n🛏 ${nights} nuit${nights > 1 ? 's' : ''} · 👥 ${guests} pers.\n\nL'hôtel te contacte pour confirmer la chambre et le paiement.`,
    };
});
// ── Service tool: book a beauty/coiffeur appointment ───────────────────────
// Customer says "je veux une coupe demain 15h chez Marie" → AI calls this.
exports.bookAppointmentTool = genkit_config_1.ai.defineTool({
    name: 'serviceBookAppointment',
    description: 'Book an appointment for a beauty/coiffeur/service business. Use when the customer asks for a service slot — needs name, phone, service name (matched to catalog), date (YYYY-MM-DD), time (HH:mm), and optionally practitioner name. Owner is notified on WhatsApp.',
    inputSchema: StoreContext.extend({
        customerName: zod_1.z.string(),
        customerPhone: zod_1.z.string(),
        serviceQuery: zod_1.z.string().describe('Service name (matched to catalog) — e.g. "coupe homme", "manucure"'),
        date: zod_1.z.string().describe('YYYY-MM-DD'),
        time: zod_1.z.string().describe('HH:mm 24h'),
        practitionerName: zod_1.z.string().optional().describe('Optional preferred practitioner — leave empty if no preference'),
        notes: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        reservationId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId, customerName, customerPhone, serviceQuery, date, time, practitionerName, notes }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        return { success: false, message: 'Format date invalide (YYYY-MM-DD).' };
    if (!/^\d{1,2}:\d{2}$/.test(time))
        return { success: false, message: 'Format heure invalide (HH:mm).' };
    // Refuse out-of-hours appointments
    {
        const sSnap = await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}`).get();
        const s = sSnap.data();
        const h = (0, openingHoursCheck_1.isStoreOpenAt)({ openingHours: s?.openingHours, date, time: time.padStart(5, '0') });
        if (h.status === 'closed') {
            return { success: false, message: `${s?.name ?? 'Le salon'} est fermé à cette date/heure. ${h.reason ?? ''} Propose un autre créneau stp.`.trim() };
        }
    }
    // Match service from catalog (products in service-type stores)
    const service = await findProductByName(companyId, storeId, serviceQuery);
    if (!service) {
        return { success: false, message: `Aucun service "${serviceQuery}" dans le catalogue. Demande à l'agent de lister les services dispos.` };
    }
    const durationMinutes = service.durationMinutes ?? 30;
    // Anti-double-booking: same service + same practitioner + same date,
    // creneau de durationMinutes. If a conflict is found, refuse the booking
    // and tell the customer the conflicting time so they can pick another.
    const conflict = await findReservationConflict({
        companyId, storeId, date, time, slotMinutes: durationMinutes,
        scope: { kind: 'service', serviceId: service.id, practitionerName },
    });
    if (conflict) {
        return {
            success: false,
            message: `❌ Le créneau ${time} est déjà réservé (${conflict.time}). Propose un autre horaire (créneau de ${durationMinutes} min).`,
        };
    }
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/stores/${storeId}/reservations`).doc();
    await ref.set({
        customerName, customerPhone,
        date, time,
        partySize: 1,
        serviceId: service.id,
        durationMinutes,
        ...(practitionerName ? { practitionerName } : {}),
        notes: notes ?? '',
        status: 'pending', source: 'whatsapp',
        createdAt: new Date(), updatedAt: new Date(),
    });
    // Notify owner
    try {
        const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
        const store = storeSnap.data();
        if (store?.ownerPhone) {
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
            const cfg = await whatsappService.getConfig(companyId).catch(() => null);
            if (cfg) {
                const msg = `💇 *Nouveau RDV*\n\n👤 ${customerName} (${customerPhone})\n💼 ${service.name} (${durationMinutes} min)\n📅 ${date} · ${time}${practitionerName ? `\n👩 ${practitionerName}` : ''}${notes ? `\n📝 ${notes}` : ''}\n\nConfirmer ? Réponds *oui* ou *non*.`;
                void whatsappService.sendMessage(cfg, store.ownerPhone, msg);
            }
        }
    }
    catch { /* non-blocking */ }
    return {
        success: true,
        reservationId: ref.id,
        message: `💇 *RDV pris !*\n\n✂️ ${service.name} (${durationMinutes} min)\n📅 ${date} à ${time}${practitionerName ? `\n👩 Avec ${practitionerName}` : ''}\n\nLe salon te contacte rapidement pour confirmer.`,
    };
});
// ── Health tool: book a medical consultation ───────────────────────────────
// Patient says "je veux un RDV chez Dr X demain 10h pour mal de tête" → AI calls this.
exports.bookConsultationTool = genkit_config_1.ai.defineTool({
    name: 'healthBookConsultation',
    description: 'Book a medical consultation. Use when a patient asks for an appointment with a doctor — needs name, phone, date (YYYY-MM-DD), time (HH:mm), reason (motif), and optionally practitioner. Owner is notified on WhatsApp. Confidentiality: never disclose medical details outside this tool\'s context.',
    inputSchema: StoreContext.extend({
        patientName: zod_1.z.string(),
        patientPhone: zod_1.z.string(),
        date: zod_1.z.string().describe('YYYY-MM-DD'),
        time: zod_1.z.string().describe('HH:mm 24h'),
        reason: zod_1.z.string().describe('Motif de la consultation (ex: "mal de tête", "contrôle annuel", "vaccin")'),
        practitionerName: zod_1.z.string().optional().describe('Médecin/praticien souhaité — optionnel'),
        durationMinutes: zod_1.z.number().optional().describe('Durée prévue (par défaut 30 min)'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        reservationId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId, patientName, patientPhone, date, time, reason, practitionerName, durationMinutes }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        return { success: false, message: 'Format date invalide (YYYY-MM-DD).' };
    if (!/^\d{1,2}:\d{2}$/.test(time))
        return { success: false, message: 'Format heure invalide (HH:mm).' };
    // Refuse out-of-hours consultations
    {
        const sSnap = await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}`).get();
        const s = sSnap.data();
        const h = (0, openingHoursCheck_1.isStoreOpenAt)({ openingHours: s?.openingHours, date, time: time.padStart(5, '0') });
        if (h.status === 'closed') {
            return { success: false, message: `${s?.name ?? 'Le cabinet'} est fermé à cette date/heure. ${h.reason ?? ''} Propose un autre créneau stp.`.trim() };
        }
    }
    // Anti-double-booking on the cabinet: same date+time +/- slot. If a
    // practitioner is named, only block the same practitioner.
    const slot = durationMinutes ?? 30;
    const conflict = await findReservationConflict({
        companyId, storeId, date, time, slotMinutes: slot,
        scope: { kind: 'health', practitionerName },
    });
    if (conflict) {
        const who = practitionerName ? practitionerName : 'Le cabinet';
        return {
            success: false,
            message: `❌ ${who} est déjà occupé à ${conflict.time} (créneau de ${slot} min). Propose un autre horaire stp.`,
        };
    }
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/stores/${storeId}/reservations`).doc();
    await ref.set({
        customerName: patientName, customerPhone: patientPhone,
        date, time,
        partySize: 1,
        reason,
        durationMinutes: durationMinutes ?? 30,
        ...(practitionerName ? { practitionerName } : {}),
        status: 'pending', source: 'whatsapp',
        createdAt: new Date(), updatedAt: new Date(),
    });
    // Notify owner (no medical details in WhatsApp text — confidentiality)
    try {
        const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
        const store = storeSnap.data();
        if (store?.ownerPhone) {
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
            const cfg = await whatsappService.getConfig(companyId).catch(() => null);
            if (cfg) {
                const msg = `🏥 *Nouvelle consultation*\n\n👤 ${patientName} (${patientPhone})\n📅 ${date} · ${time}${practitionerName ? `\n👨‍⚕️ ${practitionerName}` : ''}\n💬 Motif : ${reason}\n\nConfirmer ? Réponds *oui* ou *non*.`;
                void whatsappService.sendMessage(cfg, store.ownerPhone, msg);
            }
        }
    }
    catch { /* non-blocking */ }
    return {
        success: true,
        reservationId: ref.id,
        message: `🏥 *RDV médical enregistré*\n\n📅 ${date} à ${time}\n💬 Motif : ${reason}${practitionerName ? `\n👨‍⚕️ Avec ${practitionerName}` : ''}\n\nLe cabinet te contacte rapidement pour confirmer.`,
    };
});
// ── Real estate tool: schedule a property viewing ──────────────────────────
// Customer says "je veux visiter l'appartement à Cocody demain 15h" → AI calls this.
exports.bookViewingTool = genkit_config_1.ai.defineTool({
    name: 'realEstateBookViewing',
    description: 'Schedule a property viewing visit. Use when a prospect asks to visit a property — needs name, phone, property reference (matched to listings), date (YYYY-MM-DD), time (HH:mm). Owner is notified on WhatsApp.',
    inputSchema: StoreContext.extend({
        customerName: zod_1.z.string(),
        customerPhone: zod_1.z.string(),
        propertyQuery: zod_1.z.string().describe('Property name/reference (matched to listings) — e.g. "appartement Cocody T3", "villa Riviera"'),
        date: zod_1.z.string().describe('YYYY-MM-DD'),
        time: zod_1.z.string().describe('HH:mm 24h'),
        agentName: zod_1.z.string().optional().describe('Agent immobilier souhaité — optionnel'),
        notes: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        reservationId: zod_1.z.string().optional(),
        propertyName: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId, customerName, customerPhone, propertyQuery, date, time, agentName, notes }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        return { success: false, message: 'Format date invalide (YYYY-MM-DD).' };
    if (!/^\d{1,2}:\d{2}$/.test(time))
        return { success: false, message: 'Format heure invalide (HH:mm).' };
    // Match property from catalog
    const property = await findProductByName(companyId, storeId, propertyQuery);
    if (!property) {
        return { success: false, message: `Aucun bien "${propertyQuery}" dans le catalogue. Demande à l'agent de lister les biens dispos.` };
    }
    // Anti-double-booking: same property + (optionally) same agent + 60min slot
    const conflict = await findReservationConflict({
        companyId, storeId, date, time, slotMinutes: 60,
        scope: { kind: 'service', serviceId: property.id, practitionerName: agentName },
    });
    if (conflict) {
        return {
            success: false,
            message: `❌ Visite déjà programmée à ${conflict.time} sur ce bien. Propose un autre horaire (créneau 1h).`,
        };
    }
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/stores/${storeId}/reservations`).doc();
    await ref.set({
        customerName, customerPhone,
        date, time,
        partySize: 1,
        serviceId: property.id, // reuse serviceId for property reference
        reason: `Visite : ${property.name}`,
        ...(agentName ? { practitionerName: agentName } : {}),
        notes: notes ?? '',
        status: 'pending', source: 'whatsapp',
        createdAt: new Date(), updatedAt: new Date(),
    });
    // Notify owner
    try {
        const storeSnap = await db.doc(`companies/${companyId}/stores/${storeId}`).get();
        const store = storeSnap.data();
        if (store?.ownerPhone) {
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
            const cfg = await whatsappService.getConfig(companyId).catch(() => null);
            if (cfg) {
                const msg = `🏠 *Nouvelle visite*\n\n👤 ${customerName} (${customerPhone})\n🏘️ ${property.name}\n📅 ${date} · ${time}${agentName ? `\n🤝 ${agentName}` : ''}${notes ? `\n📝 ${notes}` : ''}\n\nConfirmer ? Réponds *oui* ou *non*.`;
                void whatsappService.sendMessage(cfg, store.ownerPhone, msg);
            }
        }
    }
    catch { /* non-blocking */ }
    return {
        success: true,
        reservationId: ref.id,
        propertyName: property.name,
        message: `🏠 *Visite enregistrée*\n\n🏘️ ${property.name}\n📅 ${date} à ${time}${agentName ? `\n🤝 Avec ${agentName}` : ''}\n\nL'agent immobilier te contacte rapidement pour confirmer.`,
    };
});
// ── Owner-side analytics: see all stores + smart insights ──────────────────
// Used by the Orchestrator (admin chat mode) to answer "j'ai combien de
// stores ?", "mon CA ce mois", "quel produit se vend le mieux", etc.
exports.listMyStoresTool = genkit_config_1.ai.defineTool({
    name: 'commerceListMyStores',
    description: 'List ALL stores of the company (boutiques, restaurants, hôtels, salons, cabinets, agences immo). Use when owner asks "j\'ai combien de stores", "mes magasins", "liste mes restaurants", "voir mes hôtels", or to enumerate available businesses before drilling into one.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        total: zod_1.z.number(),
        stores: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            slug: zod_1.z.string().optional(),
            businessType: zod_1.z.string(),
            currency: zod_1.z.string().optional(),
            status: zod_1.z.string().optional(),
            publicUrl: zod_1.z.string().optional(),
            items: zod_1.z.number().optional(), // count of products / rooms
            reservations: zod_1.z.number().optional(),
        })),
        summary: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const baseUrl = process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app';
    const PATH_BY_TYPE = {
        boutique: 'shop', restaurant: 'menu', hotel: 'hotel',
        service: 'salon', health: 'cabinet', realestate: 'biens',
    };
    const snap = await db.collection(`companies/${companyId}/stores`).get();
    const stores = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const bt = data.businessType ?? 'boutique';
        const itemsCol = bt === 'hotel' ? 'rooms' : bt === 'health' ? 'patients' : 'products';
        const [itemsSnap, resSnap] = await Promise.all([
            db.collection(`companies/${companyId}/stores/${d.id}/${itemsCol}`).count().get().catch(() => null),
            db.collection(`companies/${companyId}/stores/${d.id}/reservations`).count().get().catch(() => null),
        ]);
        const path = PATH_BY_TYPE[bt];
        return {
            id: d.id,
            name: data.name ?? '(sans nom)',
            slug: data.slug,
            businessType: bt,
            currency: data.currency,
            status: data.status ?? 'active',
            publicUrl: data.slug && path ? `${baseUrl}/${path}/${data.slug}` : undefined,
            items: itemsSnap?.data().count,
            reservations: resSnap?.data().count,
        };
    }));
    // Summary: count by type
    const counts = {};
    for (const s of stores)
        counts[s.businessType] = (counts[s.businessType] ?? 0) + 1;
    const summary = stores.length === 0
        ? 'Aucun store activé.'
        : `${stores.length} store${stores.length > 1 ? 's' : ''} : ` +
            Object.entries(counts).map(([t, n]) => `${n} ${t}`).join(' · ');
    return { success: true, total: stores.length, stores, summary };
});
exports.storeSummaryTool = genkit_config_1.ai.defineTool({
    name: 'commerceStoreSummary',
    description: 'Get a detailed snapshot of ONE store: top products by stock, recent reservations/orders, total CA. Use when owner asks "combien j\'ai vendu", "mes meilleures ventes", "ce qui marche", "stats de ma boutique X".',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        storeId: zod_1.z.string().optional().describe('Optional. If absent, summarize the FIRST store of the company.'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        storeName: zod_1.z.string().optional(),
        businessType: zod_1.z.string().optional(),
        itemsCount: zod_1.z.number(),
        activeItemsCount: zod_1.z.number(),
        reservationsThisMonth: zod_1.z.number(),
        revenueThisMonth: zod_1.z.number(),
        currency: zod_1.z.string(),
        topItems: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), price: zod_1.z.number().optional(), stockQty: zod_1.z.number().optional() })),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, storeId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let sId = storeId;
    let storeData = {};
    if (!sId) {
        const snap = await db.collection(`companies/${companyId}/stores`).limit(1).get();
        if (snap.empty)
            return { success: false, itemsCount: 0, activeItemsCount: 0, reservationsThisMonth: 0, revenueThisMonth: 0, currency: 'XOF', topItems: [], message: 'Aucun store dans cette company.' };
        sId = snap.docs[0].id;
        storeData = snap.docs[0].data();
    }
    else {
        const snap = await db.doc(`companies/${companyId}/stores/${sId}`).get();
        if (!snap.exists)
            return { success: false, itemsCount: 0, activeItemsCount: 0, reservationsThisMonth: 0, revenueThisMonth: 0, currency: 'XOF', topItems: [], message: 'Store introuvable.' };
        storeData = snap.data() ?? {};
    }
    const bt = storeData['businessType'] ?? 'boutique';
    const currency = storeData['currency'] ?? 'XOF';
    const itemsCol = bt === 'hotel' ? 'rooms' : bt === 'health' ? 'patients' : 'products';
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [itemsSnap, resSnap] = await Promise.all([
        db.collection(`companies/${companyId}/stores/${sId}/${itemsCol}`).limit(50).get(),
        db.collection(`companies/${companyId}/stores/${sId}/reservations`).limit(200).get(),
    ]);
    const items = itemsSnap.docs.map(d => d.data());
    const activeItems = items.filter(i => (i['status'] ?? 'active') === 'active');
    const topItems = items
        .map(i => ({
        name: i['name'] ?? i['number'] ?? '(sans nom)',
        price: typeof i['price'] === 'number' ? i['price'] : (typeof i['pricePerNight'] === 'number' ? i['pricePerNight'] : undefined),
        stockQty: typeof i['stockQty'] === 'number' ? i['stockQty'] : undefined,
    }))
        .slice(0, 5);
    let resInMonth = 0;
    let revenueInMonth = 0;
    for (const r of resSnap.docs) {
        const data = r.data();
        const d = data.createdAt?.toDate?.();
        if (d && d >= monthStart) {
            resInMonth++;
            if (typeof data.totalAmount === 'number')
                revenueInMonth += data.totalAmount;
        }
    }
    const message = `📊 *${storeData['name'] ?? 'Store'}* (${bt})\n` +
        `• ${activeItems.length}/${items.length} ${itemsCol === 'rooms' ? 'chambres' : itemsCol === 'patients' ? 'patients' : 'items'} actifs\n` +
        `• ${resInMonth} réservations ce mois\n` +
        (revenueInMonth > 0 ? `• CA mois : ${revenueInMonth.toLocaleString('fr-FR')} ${currency}\n` : '') +
        (topItems.length > 0 ? `\nTop : ${topItems.map(t => t.name).slice(0, 3).join(', ')}` : '');
    return {
        success: true,
        storeName: storeData['name'] ?? '',
        businessType: bt,
        itemsCount: items.length,
        activeItemsCount: activeItems.length,
        reservationsThisMonth: resInMonth,
        revenueThisMonth: revenueInMonth,
        currency,
        topItems,
        message,
    };
});
exports.analyzeMyBusinessTool = genkit_config_1.ai.defineTool({
    name: 'commerceAnalyzeMyBusiness',
    description: 'Cross-store analysis with actionable insights. Use when owner asks "comment va mon business", "tu vois ce qui marche pas ?", "des conseils pour améliorer", "quel store performe le mieux", "donne-moi des recommandations". Returns 3-5 concrete observations + suggestions.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        insights: zod_1.z.array(zod_1.z.object({
            store: zod_1.z.string(),
            type: zod_1.z.enum(['warning', 'opportunity', 'positive']),
            observation: zod_1.z.string(),
            suggestion: zod_1.z.string(),
        })),
        message: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const storesSnap = await db.collection(`companies/${companyId}/stores`).get();
    const insights = [];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    for (const sDoc of storesSnap.docs) {
        const sd = sDoc.data();
        const bt = sd['businessType'] ?? 'boutique';
        const name = sd['name'] ?? sDoc.id;
        const itemsCol = bt === 'hotel' ? 'rooms' : bt === 'health' ? 'patients' : 'products';
        const [itemsSnap, resSnap] = await Promise.all([
            db.collection(`companies/${companyId}/stores/${sDoc.id}/${itemsCol}`).limit(100).get(),
            db.collection(`companies/${companyId}/stores/${sDoc.id}/reservations`).limit(200).get(),
        ]);
        const items = itemsSnap.docs.map(d => d.data());
        const activeCount = items.filter(i => (i['status'] ?? 'active') === 'active').length;
        let resInMonth = 0;
        const phones = new Set();
        for (const r of resSnap.docs) {
            const data = r.data();
            const d = data.createdAt?.toDate?.();
            if (d && d >= monthStart) {
                resInMonth++;
                if (data.customerPhone)
                    phones.add(data.customerPhone);
            }
        }
        // Heuristics
        if (items.length === 0) {
            insights.push({
                store: name, type: 'warning',
                observation: `${name} (${bt}) n'a aucun ${itemsCol === 'rooms' ? 'chambre' : itemsCol === 'patients' ? 'patient' : 'produit'}.`,
                suggestion: `Ajoute au moins 3 ${itemsCol === 'rooms' ? 'chambres' : itemsCol === 'patients' ? 'patients' : 'produits'} avant de partager le lien public — sinon les clients voient une page vide.`,
            });
        }
        else if (activeCount < items.length / 2) {
            insights.push({
                store: name, type: 'warning',
                observation: `${name} : seulement ${activeCount}/${items.length} actifs (la moitié inactive).`,
                suggestion: `Réactive ou supprime les items inactifs pour clarifier le catalogue.`,
            });
        }
        if (resInMonth === 0 && items.length > 0 && bt !== 'boutique') {
            insights.push({
                store: name, type: 'warning',
                observation: `${name} : 0 réservation ce mois.`,
                suggestion: `Partage le lien public sur tes status WhatsApp + Instagram, et active une promo "Plat du jour" / "Service phare" pour booster.`,
            });
        }
        else if (resInMonth > 10) {
            insights.push({
                store: name, type: 'positive',
                observation: `${name} : ${resInMonth} réservations ce mois (forte demande).`,
                suggestion: `Continue. Pense à augmenter capacité ou prix sur les créneaux saturés.`,
            });
        }
        // Featured opportunity
        const featured = items.filter(i => i['featured'] === true).length;
        if (items.length >= 5 && featured === 0) {
            insights.push({
                store: name, type: 'opportunity',
                observation: `${name} : aucun item mis en "phare" (plat du jour / service phare).`,
                suggestion: `Marque 1-2 items comme phare — ils s'affichent en haut de la page publique avec un badge ⭐ et performent en moyenne +30%.`,
            });
        }
        // Address opportunity
        if (!sd['address'] && !sd['googleMapsUrl']) {
            insights.push({
                store: name, type: 'opportunity',
                observation: `${name} : pas d'adresse renseignée.`,
                suggestion: `Ajoute une adresse + lien Google Maps dans les Paramètres — quand un client demande "c'est où" sur WhatsApp, le bot envoie une épingle GPS native.`,
            });
        }
    }
    const message = insights.length === 0
        ? '✅ Tout va bien — pas de signal d\'alerte. Continue.'
        : `🔎 ${insights.length} observation${insights.length > 1 ? 's' : ''} sur ton business.`;
    return { success: true, insights: insights.slice(0, 8), message };
});
// ── Practitioners listing — used by salon/health bot to propose a choice ───
exports.listPractitionersTool = genkit_config_1.ai.defineTool({
    name: 'listPractitioners',
    description: 'List the bookable staff (practitioners) for a salon or medical cabinet. Use when the customer asks "qui travaille demain ?", "avec qui je peux prendre RDV ?" or before bookAppointment when the store has multiple staff. Only returns active practitioners.',
    inputSchema: StoreContext,
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        practitioners: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            role: zod_1.z.string().optional(),
            workingHours: zod_1.z.string().optional(),
        })).default([]),
        message: zod_1.z.string().optional(),
    }),
}, async ({ companyId, storeId }) => {
    try {
        const snap = await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}`).get().catch(() => null);
        const data = snap?.data();
        const list = (data?.practitioners ?? [])
            .filter(p => p.active !== false)
            .map(p => ({ id: p.id, name: p.name, ...(p.role ? { role: p.role } : {}), ...(p.workingHours ? { workingHours: p.workingHours } : {}) }));
        return { success: true, practitioners: list };
    }
    catch (err) {
        logger_1.logger.error('[Commerce] listPractitioners failed', { error: String(err) });
        return { success: false, practitioners: [], message: 'Liste indisponible.' };
    }
});
// Tools that need OTP gate when called via WhatsApp (orchestrator must check role first)
exports.COMMERCE_OWNER_TOOLS = [
    exports.getOrdersTool, exports.markOrderPaidTool,
    exports.updateProductPriceTool, exports.updateProductStockTool, exports.updateProductStatusTool, exports.deleteProductTool,
    exports.listMyStoresTool, exports.storeSummaryTool, exports.analyzeMyBusinessTool,
];
exports.COMMERCE_PUBLIC_TOOLS = [exports.listProductsTool, exports.placeOrderTool, exports.registerRestockInterestTool, exports.createReservationTool, exports.createBookingTool, exports.bookAppointmentTool, exports.bookConsultationTool, exports.bookViewingTool, exports.listPractitionersTool];
exports.COMMERCE_TOOLS = [...exports.COMMERCE_PUBLIC_TOOLS, ...exports.COMMERCE_OWNER_TOOLS];
//# sourceMappingURL=commerce.agent.js.map