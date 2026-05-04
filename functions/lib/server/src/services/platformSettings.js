"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidatePlatformSettingsCache = invalidatePlatformSettingsCache;
exports.getManualPaymentContact = getManualPaymentContact;
/**
 * Platform-wide settings (single doc in Firestore `_platform/settings`).
 * Super admin manages these via /superadmin/platform-settings.
 * Cached 5 min in memory to avoid hitting Firestore on every payment checkout.
 */
const firebase_config_1 = require("../config/firebase.config");
let cached = null;
const CACHE_TTL_MS = 5 * 60 * 1000;
/** Invalidate the in-memory cache — call after a super admin update. */
function invalidatePlatformSettingsCache() {
    cached = null;
}
/** Returns contact info for manual payment. Firestore > env var > safe placeholders. */
async function getManualPaymentContact() {
    if (cached && Date.now() - cached.at < CACHE_TTL_MS)
        return cached.data;
    let fromDb = null;
    try {
        const doc = await (0, firebase_config_1.getFirestore)().collection('_platform').doc('settings').get();
        fromDb = doc.exists ? doc.data() ?? null : null;
    }
    catch { /* fall through to env */ }
    const contact = {
        phone: fromDb?.['manualPaymentPhone'] || process.env['MANUAL_PAYMENT_PHONE'] || '+221 77 000 00 00',
        whatsapp: fromDb?.['manualPaymentWhatsapp'] || process.env['MANUAL_PAYMENT_WHATSAPP'] || '+221 77 000 00 00',
        email: fromDb?.['manualPaymentEmail'] || process.env['MANUAL_PAYMENT_EMAIL'] || 'billing@corpmind.ai',
    };
    cached = { data: contact, at: Date.now() };
    return contact;
}
//# sourceMappingURL=platformSettings.js.map