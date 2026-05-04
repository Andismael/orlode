/**
 * Auto-Broadcast Rule Engine
 *
 * Each company can define rules like:
 *   "When 20+ new leads have been created in the last 30 min and none have
 *    been contacted, automatically send template `followup_pro` to them."
 *
 * Rules live in `companies/{cid}/whatsappAutoBroadcasts/{ruleId}`.
 * Triggered by the cron tick (every 1 min). A rule respects a cooldown so
 * we don't blast the same audience repeatedly.
 *
 * Schema:
 *   {
 *     name: "Relance auto leads chauds",
 *     enabled: true,
 *     templateName: "followup_fr",
 *     languageCode: "fr",
 *     bodyParams: [],            // shared params (prefillFromLead overrides {{1}}/{{2}})
 *     prefillFromLead: true,
 *     condition: {
 *       status: "new",            // optional — match leads with this status
 *       urgency: "high",          // optional — match this urgency (or higher)
 *       minLeadCount: 1,           // trigger only if N+ leads match
 *       maxLeadAgeMinutes: 30,    // only consider leads created in last X min
 *       requireNotContacted: true // exclude leads already contacted
 *     },
 *     cooldownMinutes: 60,
 *     lastTriggeredAt: ...,
 *     totalTriggered: 3,
 *     lastBroadcastId: "..."
 *   }
 */
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../utils/logger';
import { runBroadcast, AudienceFilter } from './broadcastService';

interface AutoBroadcastRule {
  id: string;
  companyId: string;
  name: string;
  enabled: boolean;
  templateName: string;
  languageCode: string;
  bodyParams?: string[];
  prefillFromLead?: boolean;
  condition: {
    status?: 'new' | 'contacted' | 'closed_won' | 'closed_lost' | 'all';
    urgency?: 'low' | 'normal' | 'high' | 'urgent' | 'all';
    minLeadCount: number;
    maxLeadAgeMinutes?: number;
    requireNotContacted?: boolean;
  };
  cooldownMinutes: number;
  lastTriggeredAt?: { toDate(): Date };
}

/**
 * Iterate all companies and evaluate every enabled auto-broadcast rule.
 * Triggers broadcasts where the audience meets the rule threshold AND
 * the cooldown has expired.
 */
export async function processAutoBroadcastRules(): Promise<{
  rulesEvaluated: number;
  broadcastsTriggered: number;
  skippedCooldown: number;
  skippedThreshold: number;
}> {
  const stats = { rulesEvaluated: 0, broadcastsTriggered: 0, skippedCooldown: 0, skippedThreshold: 0 };
  const db = getFirestore();
  const companiesSnap = await db.collection('companies').limit(500).get();

  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    const rulesSnap = await db.collection(`companies/${companyId}/whatsappAutoBroadcasts`)
      .where('enabled', '==', true).limit(50).get().catch(() => null);
    if (!rulesSnap || rulesSnap.empty) continue;

    for (const ruleDoc of rulesSnap.docs) {
      stats.rulesEvaluated++;
      const rule = { id: ruleDoc.id, companyId, ...ruleDoc.data() } as AutoBroadcastRule;

      // Cooldown check
      const lastTriggered = rule.lastTriggeredAt?.toDate?.();
      if (lastTriggered) {
        const cooldownMs = (rule.cooldownMinutes ?? 60) * 60 * 1000;
        if (Date.now() - lastTriggered.getTime() < cooldownMs) {
          stats.skippedCooldown++;
          continue;
        }
      }

      // Build audience using the rule's condition
      const cond = rule.condition;
      const filter: AudienceFilter = {
        status: cond.status === 'all' ? 'all' : cond.status,
        urgency: cond.urgency === 'all' ? 'all' : cond.urgency,
        sinceDays: cond.maxLeadAgeMinutes ? Math.max(1, Math.ceil(cond.maxLeadAgeMinutes / 60 / 24)) : undefined,
        maxRecipients: 200,
      };

      // Count matching leads (light query — no full audience build)
      let q: FirebaseFirestore.Query = db.collection(`companies/${companyId}/whatsappLeads`);
      if (cond.status && cond.status !== 'all') q = q.where('status', '==', cond.status);
      if (cond.urgency && cond.urgency !== 'all') q = q.where('urgency', '==', cond.urgency);
      if (cond.maxLeadAgeMinutes) {
        const since = new Date(Date.now() - cond.maxLeadAgeMinutes * 60 * 1000);
        q = q.where('createdAt', '>=', since);
      }
      const matchSnap = await q.limit(rule.condition.minLeadCount + 5).get().catch(() => null);
      let count = matchSnap?.size ?? 0;

      // Apply requireNotContacted filter in-memory (Firestore can't do "field is null" easily)
      if (cond.requireNotContacted && matchSnap) {
        count = matchSnap.docs.filter(d => !d.data()['firstContactedAt']).length;
      }

      if (count < rule.condition.minLeadCount) {
        stats.skippedThreshold++;
        continue;
      }

      // Trigger the broadcast — runBroadcast is async, we await to get the id
      try {
        const { broadcastId } = await runBroadcast({
          companyId,
          name: `Auto · ${rule.name}`,
          templateName: rule.templateName,
          languageCode: rule.languageCode,
          bodyParams: rule.bodyParams,
          prefillFromLead: rule.prefillFromLead,
          filter,
          triggeredBy: 'auto-broadcast-rule',
          triggeredByName: `Auto · ${rule.name}`,
        });

        await ruleDoc.ref.update({
          lastTriggeredAt: FieldValue.serverTimestamp(),
          totalTriggered: FieldValue.increment(1),
          lastBroadcastId: broadcastId,
          updatedAt: FieldValue.serverTimestamp(),
        });

        stats.broadcastsTriggered++;
        logger.info('[AutoBroadcast] rule triggered', { companyId, ruleId: rule.id, broadcastId, leadsMatched: count });
      } catch (err) {
        logger.error('[AutoBroadcast] trigger failed', { companyId, ruleId: rule.id, error: String(err) });
      }
    }
  }
  return stats;
}
