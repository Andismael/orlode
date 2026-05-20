/**
 * Meta Ads (Marketing API) — thin client.
 *
 * Reuses the WhatsApp BSP access token when its `ads_management` scope is
 * granted (most BSP onboardings include it). Otherwise the owner needs to
 * paste a separate token in the admin Settings.
 *
 * The data lives in `companies/{companyId}/integrations/metaAds` :
 *   { accessToken (encrypted), adAccountId, lastError, updatedAt }
 *
 * If `accessToken` is empty there, fall back to the WhatsApp BSP token from
 * `companies/{cid}/integrations/whatsapp` (same Meta auth).
 */
import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';
import { decrypt } from '../../config/encryption';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

export interface MetaAdsConfig {
  accessToken: string;      // raw, decrypted
  adAccountId: string;      // "act_1234567890" or just "1234567890"
}

/** Resolve the Meta Ads config for a company — falls back to WhatsApp token. */
export async function getMetaAdsConfig(companyId: string): Promise<MetaAdsConfig | null> {
  const db = getFirestore();
  const adsDoc = await db.doc(`companies/${companyId}/integrations/metaAds`).get();
  let token: string | null = null;
  let adAccountId: string | null = null;
  if (adsDoc.exists) {
    const d = adsDoc.data() as { accessToken?: string; adAccountId?: string };
    if (d.accessToken) {
      try { token = decrypt(d.accessToken); } catch { token = d.accessToken; }
    }
    adAccountId = d.adAccountId ?? null;
  }
  if (!token) {
    // Fall back to the WhatsApp BSP token (same Meta auth)
    const waDoc = await db.doc(`companies/${companyId}/integrations/whatsapp`).get();
    if (waDoc.exists) {
      const w = waDoc.data() as { accessToken?: string };
      if (w.accessToken) {
        try { token = decrypt(w.accessToken); } catch { token = w.accessToken; }
      }
    }
  }
  if (!token || !adAccountId) return null;
  return {
    accessToken: token,
    adAccountId: adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`,
  };
}

interface GraphError { error?: { message?: string; code?: number; type?: string; error_subcode?: number } }

async function graph<T>(method: 'GET' | 'POST', path: string, token: string, body?: Record<string, unknown>): Promise<T> {
  const url = `${GRAPH_API}/${path}`;
  const init: RequestInit = {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body && method !== 'GET') init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed: T & GraphError;
  try { parsed = text ? JSON.parse(text) : ({} as T & GraphError); }
  catch { throw new Error(`Meta Graph: invalid JSON response (HTTP ${res.status})`); }
  if (!res.ok || (parsed as GraphError).error) {
    const err = (parsed as GraphError).error;
    throw new Error(`Meta Graph: ${err?.message ?? `HTTP ${res.status}`}`);
  }
  return parsed;
}

// ── Campaigns ───────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  status: string;          // ACTIVE | PAUSED | DELETED | ARCHIVED
  effective_status?: string;
  daily_budget?: string;   // string (in account currency cents/units)
  lifetime_budget?: string;
  objective?: string;
  start_time?: string;
  stop_time?: string;
}

export async function listCampaigns(cfg: MetaAdsConfig, limit = 25): Promise<Campaign[]> {
  const path = `${cfg.adAccountId}/campaigns?fields=id,name,status,effective_status,daily_budget,lifetime_budget,objective,start_time,stop_time&limit=${limit}`;
  const data = await graph<{ data: Campaign[] }>('GET', path, cfg.accessToken);
  return data.data ?? [];
}

export async function pauseCampaign(cfg: MetaAdsConfig, campaignId: string): Promise<void> {
  await graph('POST', campaignId, cfg.accessToken, { status: 'PAUSED' });
}

export async function resumeCampaign(cfg: MetaAdsConfig, campaignId: string): Promise<void> {
  await graph('POST', campaignId, cfg.accessToken, { status: 'ACTIVE' });
}

export async function setDailyBudget(cfg: MetaAdsConfig, campaignId: string, dailyBudgetMinor: number): Promise<void> {
  // daily_budget is in account currency *minor units* (cents). For XOF (no
  // decimals) Meta still uses minor=major. For USD/EUR multiply by 100.
  await graph('POST', campaignId, cfg.accessToken, { daily_budget: String(Math.round(dailyBudgetMinor)) });
}

// ── Insights (performance) ─────────────────────────────────────────────────

export interface Insights {
  impressions?: string;
  clicks?: string;
  spend?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  reach?: string;
  actions?: Array<{ action_type: string; value: string }>;
  // For Click-to-WhatsApp: count of total_messaging_connection actions
}

export async function getCampaignInsights(cfg: MetaAdsConfig, campaignId: string, datePreset = 'last_7d'): Promise<Insights | null> {
  const path = `${campaignId}/insights?fields=impressions,clicks,spend,cpc,cpm,ctr,reach,actions&date_preset=${datePreset}`;
  const data = await graph<{ data: Insights[] }>('GET', path, cfg.accessToken);
  return data.data?.[0] ?? null;
}

// ── Create a Click-to-WhatsApp campaign (simplified) ──────────────────────
// Returns { campaignId, adSetId, adId } on success. Caller is responsible for
// activating the campaign (we create it PAUSED so the owner can review first).
export async function createCtwCampaign(args: {
  cfg: MetaAdsConfig;
  whatsappNumber: string;     // E.164, e.g. +2250707070707
  campaignName: string;
  dailyBudget: number;        // currency major units (e.g. 5000 XOF)
  countries?: string[];       // ISO-2 codes, default ['CI']
  ageMin?: number;
  ageMax?: number;
  message: string;            // creative body / pre-fill message
  pageId: string;             // FB page ID required for any ad
  imageHash?: string;         // optional; if missing, we create a text-only ad
  endDateIso?: string;        // optional stop date
}): Promise<{ campaignId: string; adSetId: string; adId: string }> {
  const { cfg, whatsappNumber, campaignName, dailyBudget, countries, ageMin, ageMax, message, pageId, imageHash, endDateIso } = args;

  // 1. Campaign — objective OUTCOME_ENGAGEMENT supports CTW destination
  const campaignRes = await graph<{ id: string }>('POST', `${cfg.adAccountId}/campaigns`, cfg.accessToken, {
    name: campaignName,
    objective: 'OUTCOME_ENGAGEMENT',
    status: 'PAUSED',
    special_ad_categories: [],
    buying_type: 'AUCTION',
  });
  const campaignId = campaignRes.id;

  // 2. Ad Set — destination = WhatsApp, geo + age targeting, daily budget
  const dailyBudgetMinor = Math.round(dailyBudget); // XOF has no minor; for USD pass *100 from caller
  const adSetRes = await graph<{ id: string }>('POST', `${cfg.adAccountId}/adsets`, cfg.accessToken, {
    name: `${campaignName} — adset`,
    campaign_id: campaignId,
    daily_budget: String(dailyBudgetMinor),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'CONVERSATIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: {
      geo_locations: { countries: countries ?? ['CI'] },
      age_min: ageMin ?? 18,
      age_max: ageMax ?? 65,
    },
    status: 'PAUSED',
    destination_type: 'WHATSAPP',
    promoted_object: { page_id: pageId, custom_event_type: 'CONTACT' },
    start_time: new Date().toISOString(),
    ...(endDateIso ? { end_time: endDateIso } : {}),
  });
  const adSetId = adSetRes.id;

  // 3. Ad creative — link object with WhatsApp click-to-message
  const linkData: Record<string, unknown> = {
    page_welcome_message: message,
    message,
    call_to_action: {
      type: 'WHATSAPP_MESSAGE',
      value: { app_destination: 'WHATSAPP', whatsapp_number: whatsappNumber.replace(/\D/g, '') },
    },
  };
  if (imageHash) linkData['image_hash'] = imageHash;

  const creativeRes = await graph<{ id: string }>('POST', `${cfg.adAccountId}/adcreatives`, cfg.accessToken, {
    name: `${campaignName} — creative`,
    object_story_spec: {
      page_id: pageId,
      link_data: linkData,
    },
  });
  const creativeId = creativeRes.id;

  // 4. Ad — bind creative to ad set
  const adRes = await graph<{ id: string }>('POST', `${cfg.adAccountId}/ads`, cfg.accessToken, {
    name: `${campaignName} — ad`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  });

  logger.info('[MetaAds] CTW campaign created', {
    campaignId, adSetId, adId: adRes.id, dailyBudget, countries,
  });

  return { campaignId, adSetId, adId: adRes.id };
}
