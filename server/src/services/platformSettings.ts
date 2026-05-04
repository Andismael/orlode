/**
 * Platform-wide settings (single doc in Firestore `_platform/settings`).
 * Super admin manages these via /superadmin/platform-settings.
 * Cached 5 min in memory to avoid hitting Firestore on every payment checkout.
 */
import { getFirestore } from '../config/firebase.config';

export interface ManualPaymentContact {
  phone: string;
  whatsapp: string;
  email: string;
}

let cached: { data: ManualPaymentContact; at: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Invalidate the in-memory cache — call after a super admin update. */
export function invalidatePlatformSettingsCache(): void {
  cached = null;
}

/** Returns contact info for manual payment. Firestore > env var > safe placeholders. */
export async function getManualPaymentContact(): Promise<ManualPaymentContact> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  let fromDb: Record<string, unknown> | null = null;
  try {
    const doc = await getFirestore().collection('_platform').doc('settings').get();
    fromDb = doc.exists ? doc.data() ?? null : null;
  } catch { /* fall through to env */ }

  const contact: ManualPaymentContact = {
    phone:    (fromDb?.['manualPaymentPhone']    as string) || process.env['MANUAL_PAYMENT_PHONE']    || '+221 77 000 00 00',
    whatsapp: (fromDb?.['manualPaymentWhatsapp'] as string) || process.env['MANUAL_PAYMENT_WHATSAPP'] || '+221 77 000 00 00',
    email:    (fromDb?.['manualPaymentEmail']    as string) || process.env['MANUAL_PAYMENT_EMAIL']    || 'billing@corpmind.ai',
  };

  cached = { data: contact, at: Date.now() };
  return contact;
}
