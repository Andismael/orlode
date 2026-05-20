"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_ADS_TOOLS = exports.createCtwCampaignTool = exports.boostCampaignTool = exports.resumeCampaignTool = exports.pauseCampaignTool = exports.campaignInsightsTool = exports.listCampaignsTool = void 0;
/**
 * Meta Ads Agent — Genkit tools wrapping the Meta Marketing API.
 *
 * Used by the orchestrator (admin chat mode on WhatsApp) so an owner can say
 * "@admin lance une promo Saumon braisé budget 5000 ce week-end" and the AI
 * creates a real CTW campaign on Meta.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const logger_1 = require("../utils/logger");
const metaAdsService_1 = require("../services/metaAds/metaAdsService");
const firebase_config_1 = require("../config/firebase.config");
const Ctx = zod_1.z.object({ companyId: zod_1.z.string() });
exports.listCampaignsTool = genkit_config_1.ai.defineTool({
    name: 'metaListCampaigns',
    description: 'List all Meta Ads campaigns of the company. Use when owner asks "mes pubs", "mes campagnes Meta", "ce qui tourne sur Facebook", "voir mes ads".',
    inputSchema: Ctx,
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        campaigns: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            status: zod_1.z.string(),
            objective: zod_1.z.string().optional(),
            dailyBudget: zod_1.z.string().optional(),
        })).optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const cfg = await (0, metaAdsService_1.getMetaAdsConfig)(companyId);
    if (!cfg)
        return { success: false, message: `❌ Meta Ads pas encore configuré.\n\nVa ici pour le faire (clique le lien) :\n${process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app'}/admin/meta-ads\n\nRenseigne ton Ad Account ID + Page Facebook ID puis clique "Tester maintenant".` };
    try {
        const list = await (0, metaAdsService_1.listCampaigns)(cfg);
        const campaigns = list.map(c => ({
            id: c.id, name: c.name, status: c.effective_status ?? c.status,
            objective: c.objective, dailyBudget: c.daily_budget,
        }));
        return {
            success: true, campaigns,
            message: campaigns.length === 0
                ? 'Aucune campagne Meta active.'
                : `${campaigns.length} campagne(s) : ${campaigns.slice(0, 5).map(c => `${c.name} (${c.status})`).join(' · ')}`,
        };
    }
    catch (e) {
        logger_1.logger.warn('[MetaAds] listCampaigns failed', { error: e?.message });
        return { success: false, message: `❌ ${e?.message ?? 'Erreur Meta API'}` };
    }
});
exports.campaignInsightsTool = genkit_config_1.ai.defineTool({
    name: 'metaCampaignInsights',
    description: 'Get performance metrics (clicks, impressions, spend, conversations) for a specific Meta Ads campaign over the last 7 days. Use when owner asks "comment va ma pub X", "ROI", "combien j\'ai dépensé".',
    inputSchema: Ctx.extend({
        campaignId: zod_1.z.string(),
        datePreset: zod_1.z.enum(['today', 'yesterday', 'last_3d', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'last_90d']).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        impressions: zod_1.z.number().optional(),
        clicks: zod_1.z.number().optional(),
        spend: zod_1.z.number().optional(),
        ctr: zod_1.z.number().optional(),
        cpc: zod_1.z.number().optional(),
        conversations: zod_1.z.number().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, campaignId, datePreset }) => {
    const cfg = await (0, metaAdsService_1.getMetaAdsConfig)(companyId);
    if (!cfg)
        return { success: false, message: '❌ Meta Ads non connecté.' };
    try {
        const i = await (0, metaAdsService_1.getCampaignInsights)(cfg, campaignId, datePreset ?? 'last_7d');
        if (!i)
            return { success: true, message: 'Aucune donnée pour cette période.' };
        const conv = i.actions?.find(a => a.action_type === 'onsite_conversion.total_messaging_connection' || a.action_type === 'total_messaging_connection');
        return {
            success: true,
            impressions: i.impressions ? parseInt(i.impressions) : undefined,
            clicks: i.clicks ? parseInt(i.clicks) : undefined,
            spend: i.spend ? parseFloat(i.spend) : undefined,
            ctr: i.ctr ? parseFloat(i.ctr) : undefined,
            cpc: i.cpc ? parseFloat(i.cpc) : undefined,
            conversations: conv ? parseInt(conv.value) : undefined,
            message: `📊 ${i.impressions ?? 0} impressions · ${i.clicks ?? 0} clics · ${i.spend ?? 0} dépensé · ${conv?.value ?? 0} conversations WhatsApp`,
        };
    }
    catch (e) {
        return { success: false, message: `❌ ${e?.message ?? 'Erreur'}` };
    }
});
exports.pauseCampaignTool = genkit_config_1.ai.defineTool({
    name: 'metaPauseCampaign',
    description: 'Pause a Meta Ads campaign. Use when owner says "stop la campagne X", "mets en pause", "arrête la pub Y".',
    inputSchema: Ctx.extend({ campaignId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, campaignId }) => {
    const cfg = await (0, metaAdsService_1.getMetaAdsConfig)(companyId);
    if (!cfg)
        return { success: false, message: '❌ Meta Ads non connecté.' };
    try {
        await (0, metaAdsService_1.pauseCampaign)(cfg, campaignId);
        return { success: true, message: `⏸ Campagne ${campaignId} mise en pause.` };
    }
    catch (e) {
        return { success: false, message: `❌ ${e?.message ?? 'Erreur'}` };
    }
});
exports.resumeCampaignTool = genkit_config_1.ai.defineTool({
    name: 'metaResumeCampaign',
    description: 'Resume / activate a paused Meta Ads campaign. Use when owner says "relance la pub X", "réactive la campagne".',
    inputSchema: Ctx.extend({ campaignId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, campaignId }) => {
    const cfg = await (0, metaAdsService_1.getMetaAdsConfig)(companyId);
    if (!cfg)
        return { success: false, message: '❌ Meta Ads non connecté.' };
    try {
        await (0, metaAdsService_1.resumeCampaign)(cfg, campaignId);
        return { success: true, message: `▶ Campagne ${campaignId} relancée.` };
    }
    catch (e) {
        return { success: false, message: `❌ ${e?.message ?? 'Erreur'}` };
    }
});
exports.boostCampaignTool = genkit_config_1.ai.defineTool({
    name: 'metaBoostCampaign',
    description: 'Increase or set the daily budget of a Meta Ads campaign. Use when owner says "augmente le budget X à 10k", "boost la pub à 15000".',
    inputSchema: Ctx.extend({
        campaignId: zod_1.z.string(),
        dailyBudget: zod_1.z.number().describe('New daily budget in account currency (XOF, USD, ...). For XOF use the major number directly (e.g. 10000 for 10000 XOF).'),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, campaignId, dailyBudget }) => {
    const cfg = await (0, metaAdsService_1.getMetaAdsConfig)(companyId);
    if (!cfg)
        return { success: false, message: '❌ Meta Ads non connecté.' };
    try {
        await (0, metaAdsService_1.setDailyBudget)(cfg, campaignId, dailyBudget);
        return { success: true, message: `💰 Budget journalier de ${campaignId} fixé à ${dailyBudget}.` };
    }
    catch (e) {
        return { success: false, message: `❌ ${e?.message ?? 'Erreur'}` };
    }
});
exports.createCtwCampaignTool = genkit_config_1.ai.defineTool({
    name: 'metaCreateCtwCampaign',
    description: 'Create a new Click-to-WhatsApp Meta Ads campaign. The campaign is created PAUSED for owner review — explicit activation needed afterward (use metaResumeCampaign). Use when owner says "lance une promo X", "crée une pub WhatsApp pour Y", "campagne CTW".',
    inputSchema: Ctx.extend({
        campaignName: zod_1.z.string().describe('Short campaign name, e.g. "Saumon braisé promo weekend"'),
        message: zod_1.z.string().describe('Pre-filled WhatsApp message text the customer sees + the welcome message'),
        dailyBudget: zod_1.z.number().describe('Daily budget in account currency major units'),
        countries: zod_1.z.array(zod_1.z.string()).optional().describe('ISO-2 country codes, default ["CI"]'),
        ageMin: zod_1.z.number().optional(),
        ageMax: zod_1.z.number().optional(),
        endDateIso: zod_1.z.string().optional().describe('Optional stop date (YYYY-MM-DD or full ISO)'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        campaignId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, campaignName, message, dailyBudget, countries, ageMin, ageMax, endDateIso }) => {
    const cfg = await (0, metaAdsService_1.getMetaAdsConfig)(companyId);
    if (!cfg)
        return { success: false, message: '❌ Meta Ads non connecté.' };
    // Need pageId + whatsappNumber from the WhatsApp integration doc
    const waDoc = await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/integrations/whatsapp`).get();
    if (!waDoc.exists)
        return { success: false, message: '❌ WhatsApp non connecté — la pub CTW pointe vers ton numéro WhatsApp Business.' };
    const wa = waDoc.data();
    if (!wa.displayPhoneNumber)
        return { success: false, message: '❌ Numéro WhatsApp Business manquant.' };
    if (!wa.pageId)
        return { success: false, message: '❌ Page Facebook ID manquant — Meta exige une page liée pour la pub. Renseigne-la dans Admin → WhatsApp.' };
    try {
        const r = await (0, metaAdsService_1.createCtwCampaign)({
            cfg,
            whatsappNumber: wa.displayPhoneNumber,
            pageId: wa.pageId,
            campaignName,
            message,
            dailyBudget,
            countries, ageMin, ageMax, endDateIso,
        });
        return {
            success: true,
            campaignId: r.campaignId,
            message: `✅ Campagne *${campaignName}* créée en PAUSE. Vérifie les détails sur Meta Ads Manager, puis relance avec metaResumeCampaign(${r.campaignId}). Budget : ${dailyBudget}/jour.`,
        };
    }
    catch (e) {
        return { success: false, message: `❌ ${e?.message ?? 'Erreur création'}` };
    }
});
exports.META_ADS_TOOLS = [
    exports.listCampaignsTool, exports.campaignInsightsTool,
    exports.pauseCampaignTool, exports.resumeCampaignTool, exports.boostCampaignTool,
    exports.createCtwCampaignTool,
];
//# sourceMappingURL=metaAds.agent.js.map