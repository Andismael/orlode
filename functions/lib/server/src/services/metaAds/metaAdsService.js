"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetaAdsConfig = getMetaAdsConfig;
exports.listCampaigns = listCampaigns;
exports.pauseCampaign = pauseCampaign;
exports.resumeCampaign = resumeCampaign;
exports.setDailyBudget = setDailyBudget;
exports.getCampaignInsights = getCampaignInsights;
exports.createCtwCampaign = createCtwCampaign;
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
const firebase_config_1 = require("../../config/firebase.config");
const logger_1 = require("../../utils/logger");
const encryption_1 = require("../../config/encryption");
const GRAPH_API = 'https://graph.facebook.com/v21.0';
/** Resolve the Meta Ads config for a company — falls back to WhatsApp token. */
async function getMetaAdsConfig(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const adsDoc = await db.doc(`companies/${companyId}/integrations/metaAds`).get();
    let token = null;
    let adAccountId = null;
    if (adsDoc.exists) {
        const d = adsDoc.data();
        if (d.accessToken) {
            try {
                token = (0, encryption_1.decrypt)(d.accessToken);
            }
            catch {
                token = d.accessToken;
            }
        }
        adAccountId = d.adAccountId ?? null;
    }
    if (!token) {
        // Fall back to the WhatsApp BSP token (same Meta auth)
        const waDoc = await db.doc(`companies/${companyId}/integrations/whatsapp`).get();
        if (waDoc.exists) {
            const w = waDoc.data();
            if (w.accessToken) {
                try {
                    token = (0, encryption_1.decrypt)(w.accessToken);
                }
                catch {
                    token = w.accessToken;
                }
            }
        }
    }
    if (!token || !adAccountId)
        return null;
    return {
        accessToken: token,
        adAccountId: adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`,
    };
}
async function graph(method, path, token, body) {
    const url = `${GRAPH_API}/${path}`;
    const init = {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    if (body && method !== 'GET')
        init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    const text = await res.text();
    let parsed;
    try {
        parsed = text ? JSON.parse(text) : {};
    }
    catch {
        throw new Error(`Meta Graph: invalid JSON response (HTTP ${res.status})`);
    }
    if (!res.ok || parsed.error) {
        const err = parsed.error;
        throw new Error(`Meta Graph: ${err?.message ?? `HTTP ${res.status}`}`);
    }
    return parsed;
}
async function listCampaigns(cfg, limit = 25) {
    const path = `${cfg.adAccountId}/campaigns?fields=id,name,status,effective_status,daily_budget,lifetime_budget,objective,start_time,stop_time&limit=${limit}`;
    const data = await graph('GET', path, cfg.accessToken);
    return data.data ?? [];
}
async function pauseCampaign(cfg, campaignId) {
    await graph('POST', campaignId, cfg.accessToken, { status: 'PAUSED' });
}
async function resumeCampaign(cfg, campaignId) {
    await graph('POST', campaignId, cfg.accessToken, { status: 'ACTIVE' });
}
async function setDailyBudget(cfg, campaignId, dailyBudgetMinor) {
    // daily_budget is in account currency *minor units* (cents). For XOF (no
    // decimals) Meta still uses minor=major. For USD/EUR multiply by 100.
    await graph('POST', campaignId, cfg.accessToken, { daily_budget: String(Math.round(dailyBudgetMinor)) });
}
async function getCampaignInsights(cfg, campaignId, datePreset = 'last_7d') {
    const path = `${campaignId}/insights?fields=impressions,clicks,spend,cpc,cpm,ctr,reach,actions&date_preset=${datePreset}`;
    const data = await graph('GET', path, cfg.accessToken);
    return data.data?.[0] ?? null;
}
// ── Create a Click-to-WhatsApp campaign (simplified) ──────────────────────
// Returns { campaignId, adSetId, adId } on success. Caller is responsible for
// activating the campaign (we create it PAUSED so the owner can review first).
async function createCtwCampaign(args) {
    const { cfg, whatsappNumber, campaignName, dailyBudget, countries, ageMin, ageMax, message, pageId, imageHash, endDateIso } = args;
    // 1. Campaign — objective OUTCOME_ENGAGEMENT supports CTW destination
    const campaignRes = await graph('POST', `${cfg.adAccountId}/campaigns`, cfg.accessToken, {
        name: campaignName,
        objective: 'OUTCOME_ENGAGEMENT',
        status: 'PAUSED',
        special_ad_categories: [],
        buying_type: 'AUCTION',
    });
    const campaignId = campaignRes.id;
    // 2. Ad Set — destination = WhatsApp, geo + age targeting, daily budget
    const dailyBudgetMinor = Math.round(dailyBudget); // XOF has no minor; for USD pass *100 from caller
    const adSetRes = await graph('POST', `${cfg.adAccountId}/adsets`, cfg.accessToken, {
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
    const linkData = {
        page_welcome_message: message,
        message,
        call_to_action: {
            type: 'WHATSAPP_MESSAGE',
            value: { app_destination: 'WHATSAPP', whatsapp_number: whatsappNumber.replace(/\D/g, '') },
        },
    };
    if (imageHash)
        linkData['image_hash'] = imageHash;
    const creativeRes = await graph('POST', `${cfg.adAccountId}/adcreatives`, cfg.accessToken, {
        name: `${campaignName} — creative`,
        object_story_spec: {
            page_id: pageId,
            link_data: linkData,
        },
    });
    const creativeId = creativeRes.id;
    // 4. Ad — bind creative to ad set
    const adRes = await graph('POST', `${cfg.adAccountId}/ads`, cfg.accessToken, {
        name: `${campaignName} — ad`,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status: 'PAUSED',
    });
    logger_1.logger.info('[MetaAds] CTW campaign created', {
        campaignId, adSetId, adId: adRes.id, dailyBudget, countries,
    });
    return { campaignId, adSetId, adId: adRes.id };
}
//# sourceMappingURL=metaAdsService.js.map