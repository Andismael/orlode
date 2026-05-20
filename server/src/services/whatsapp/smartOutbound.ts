/**
 * 24h-aware WhatsApp outbound dispatcher.
 *
 * Meta's policy: free-text messages can only be sent inside the 24h customer
 * service window (within 24h of the customer's last inbound message). Outside
 * that window we MUST use a pre-approved message template.
 *
 * `sendMarketing(...)` looks up the customer's last inbound timestamp in
 * `whatsappMessages`, decides which channel to use, and falls back gracefully:
 *   - inside 24h → free-text (no Meta template approval needed)
 *   - outside 24h → Meta template (requires approval); on failure, log only
 *
 * The function is fire-and-forget safe: it always resolves, never throws.
 */
import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';
import { whatsappService } from './whatsappService';
import {
  MARKETING_TEMPLATES, renderTemplate,
  type TemplateVars,
} from './marketingTemplates';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface OutboundResult {
  channel: 'free_text' | 'template' | 'skipped';
  messageId: string | null;
  reason?: string;
}

/**
 * True if `to` has sent us an inbound message within the last 24h.
 * Reads from `companies/{companyId}/whatsappMessages` indexed by `from`.
 */
async function isInside24hWindow(companyId: string, to: string): Promise<boolean> {
  const db = getFirestore();
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
  // Phone number can come in different shapes ("+225...", "225...") — we
  // store the originally-received `from` field. Try a digits-only match
  // since Meta normalizes to digits-only on inbound.
  const digitsOnly = to.replace(/\D/g, '');
  const variants = Array.from(new Set([to, digitsOnly, '+' + digitsOnly])).slice(0, 3);

  for (const variant of variants) {
    const snap = await db.collection(`companies/${companyId}/whatsappMessages`)
      .where('from', '==', variant)
      .where('createdAt', '>=', cutoff)
      .limit(1).get().catch(() => null);
    if (snap && !snap.empty) return true;
  }
  return false;
}

/**
 * Send a marketing/utility message, choosing free-text or template based
 * on the 24h window. Always non-throwing.
 */
export async function sendMarketing(
  companyId: string,
  to: string,
  templateName: keyof typeof MARKETING_TEMPLATES,
  vars: TemplateVars,
): Promise<OutboundResult> {
  try {
    const config = await whatsappService.getConfig(companyId);
    if (!config) return { channel: 'skipped', messageId: null, reason: 'no whatsapp config' };

    const tpl = MARKETING_TEMPLATES[templateName];
    if (!tpl) return { channel: 'skipped', messageId: null, reason: 'unknown template' };

    const inside = await isInside24hWindow(companyId, to);
    const body = renderTemplate(templateName, vars);

    if (inside) {
      const id = await whatsappService.sendMessage(config, to, body);
      if (id) {
        logger.info('[Marketing] free-text sent (inside 24h)', { companyId, to, templateName });
        return { channel: 'free_text', messageId: id };
      }
      return { channel: 'free_text', messageId: null, reason: 'send failed' };
    }

    // Outside 24h → must use template.
    const params = tpl.variables.map(v => String(vars[v] ?? ''));
    const id = await whatsappService.sendTemplate(config, to, tpl.metaName, tpl.language, params);
    if (id) {
      logger.info('[Marketing] template sent (outside 24h)', { companyId, to, templateName });
      return { channel: 'template', messageId: id };
    }
    // Template failed — most common reason: not approved by Meta yet.
    logger.warn('[Marketing] template send failed', {
      companyId, to, templateName, metaName: tpl.metaName,
      hint: 'Submit template to Meta Business Manager → WhatsApp → Templates',
    });
    return { channel: 'template', messageId: null, reason: 'template not approved or send failed' };
  } catch (err) {
    logger.warn('[Marketing] sendMarketing threw', { companyId, to, templateName, error: String(err) });
    return { channel: 'skipped', messageId: null, reason: (err as Error).message };
  }
}

/**
 * Idempotency guard — returns false if a marketing event of the same kind
 * has already been recorded for this customer within `windowDays`.
 * Stores under `companies/{cid}/stores/{sid}/marketingEvents`.
 */
export async function shouldSendOnce(
  companyId: string,
  storeId: string,
  customerPhone: string,
  eventKind: string,
  windowDays = 30,
): Promise<boolean> {
  const db = getFirestore();
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const snap = await db.collection(`companies/${companyId}/stores/${storeId}/marketingEvents`)
    .where('customerPhone', '==', customerPhone)
    .where('kind', '==', eventKind)
    .where('createdAt', '>=', cutoff)
    .limit(1).get().catch(() => null);
  return !snap || snap.empty;
}

export async function recordMarketingEvent(
  companyId: string,
  storeId: string,
  customerPhone: string,
  eventKind: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  const db = getFirestore();
  await db.collection(`companies/${companyId}/stores/${storeId}/marketingEvents`).add({
    customerPhone, kind: eventKind, ...meta, createdAt: new Date(),
  }).catch(() => null);
}
