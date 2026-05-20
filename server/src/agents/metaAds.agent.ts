/**
 * Meta Ads Agent — Genkit tools wrapping the Meta Marketing API.
 *
 * Used by the orchestrator (admin chat mode on WhatsApp) so an owner can say
 * "@admin lance une promo Saumon braisé budget 5000 ce week-end" and the AI
 * creates a real CTW campaign on Meta.
 */
import { z } from 'zod';
import { ai } from '../config/genkit.config';
import { logger } from '../utils/logger';
import {
  getMetaAdsConfig, listCampaigns, pauseCampaign, resumeCampaign,
  setDailyBudget, getCampaignInsights, createCtwCampaign,
} from '../services/metaAds/metaAdsService';
import { getFirestore } from '../config/firebase.config';

const Ctx = z.object({ companyId: z.string() });

export const listCampaignsTool = ai.defineTool(
  {
    name: 'metaListCampaigns',
    description: 'List all Meta Ads campaigns of the company. Use when owner asks "mes pubs", "mes campagnes Meta", "ce qui tourne sur Facebook", "voir mes ads".',
    inputSchema: Ctx,
    outputSchema: z.object({
      success: z.boolean(),
      campaigns: z.array(z.object({
        id: z.string(),
        name: z.string(),
        status: z.string(),
        objective: z.string().optional(),
        dailyBudget: z.string().optional(),
      })).optional(),
      message: z.string(),
    }),
  },
  async ({ companyId }) => {
    const cfg = await getMetaAdsConfig(companyId);
    if (!cfg) return { success: false, message: `❌ Meta Ads pas encore configuré.\n\nVa ici pour le faire (clique le lien) :\n${process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app'}/admin/meta-ads\n\nRenseigne ton Ad Account ID + Page Facebook ID puis clique "Tester maintenant".` };
    try {
      const list = await listCampaigns(cfg);
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
    } catch (e: any) {
      logger.warn('[MetaAds] listCampaigns failed', { error: e?.message });
      return { success: false, message: `❌ ${e?.message ?? 'Erreur Meta API'}` };
    }
  },
);

export const campaignInsightsTool = ai.defineTool(
  {
    name: 'metaCampaignInsights',
    description: 'Get performance metrics (clicks, impressions, spend, conversations) for a specific Meta Ads campaign over the last 7 days. Use when owner asks "comment va ma pub X", "ROI", "combien j\'ai dépensé".',
    inputSchema: Ctx.extend({
      campaignId: z.string(),
      datePreset: z.enum(['today', 'yesterday', 'last_3d', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'last_90d']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      impressions: z.number().optional(),
      clicks: z.number().optional(),
      spend: z.number().optional(),
      ctr: z.number().optional(),
      cpc: z.number().optional(),
      conversations: z.number().optional(),
      message: z.string(),
    }),
  },
  async ({ companyId, campaignId, datePreset }) => {
    const cfg = await getMetaAdsConfig(companyId);
    if (!cfg) return { success: false, message: '❌ Meta Ads non connecté.' };
    try {
      const i = await getCampaignInsights(cfg, campaignId, datePreset ?? 'last_7d');
      if (!i) return { success: true, message: 'Aucune donnée pour cette période.' };
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
    } catch (e: any) {
      return { success: false, message: `❌ ${e?.message ?? 'Erreur'}` };
    }
  },
);

export const pauseCampaignTool = ai.defineTool(
  {
    name: 'metaPauseCampaign',
    description: 'Pause a Meta Ads campaign. Use when owner says "stop la campagne X", "mets en pause", "arrête la pub Y".',
    inputSchema: Ctx.extend({ campaignId: z.string() }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, campaignId }) => {
    const cfg = await getMetaAdsConfig(companyId);
    if (!cfg) return { success: false, message: '❌ Meta Ads non connecté.' };
    try { await pauseCampaign(cfg, campaignId); return { success: true, message: `⏸ Campagne ${campaignId} mise en pause.` }; }
    catch (e: any) { return { success: false, message: `❌ ${e?.message ?? 'Erreur'}` }; }
  },
);

export const resumeCampaignTool = ai.defineTool(
  {
    name: 'metaResumeCampaign',
    description: 'Resume / activate a paused Meta Ads campaign. Use when owner says "relance la pub X", "réactive la campagne".',
    inputSchema: Ctx.extend({ campaignId: z.string() }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, campaignId }) => {
    const cfg = await getMetaAdsConfig(companyId);
    if (!cfg) return { success: false, message: '❌ Meta Ads non connecté.' };
    try { await resumeCampaign(cfg, campaignId); return { success: true, message: `▶ Campagne ${campaignId} relancée.` }; }
    catch (e: any) { return { success: false, message: `❌ ${e?.message ?? 'Erreur'}` }; }
  },
);

export const boostCampaignTool = ai.defineTool(
  {
    name: 'metaBoostCampaign',
    description: 'Increase or set the daily budget of a Meta Ads campaign. Use when owner says "augmente le budget X à 10k", "boost la pub à 15000".',
    inputSchema: Ctx.extend({
      campaignId: z.string(),
      dailyBudget: z.number().describe('New daily budget in account currency (XOF, USD, ...). For XOF use the major number directly (e.g. 10000 for 10000 XOF).'),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, campaignId, dailyBudget }) => {
    const cfg = await getMetaAdsConfig(companyId);
    if (!cfg) return { success: false, message: '❌ Meta Ads non connecté.' };
    try {
      await setDailyBudget(cfg, campaignId, dailyBudget);
      return { success: true, message: `💰 Budget journalier de ${campaignId} fixé à ${dailyBudget}.` };
    } catch (e: any) { return { success: false, message: `❌ ${e?.message ?? 'Erreur'}` }; }
  },
);

export const createCtwCampaignTool = ai.defineTool(
  {
    name: 'metaCreateCtwCampaign',
    description: 'Create a new Click-to-WhatsApp Meta Ads campaign. The campaign is created PAUSED for owner review — explicit activation needed afterward (use metaResumeCampaign). Use when owner says "lance une promo X", "crée une pub WhatsApp pour Y", "campagne CTW".',
    inputSchema: Ctx.extend({
      campaignName: z.string().describe('Short campaign name, e.g. "Saumon braisé promo weekend"'),
      message: z.string().describe('Pre-filled WhatsApp message text the customer sees + the welcome message'),
      dailyBudget: z.number().describe('Daily budget in account currency major units'),
      countries: z.array(z.string()).optional().describe('ISO-2 country codes, default ["CI"]'),
      ageMin: z.number().optional(),
      ageMax: z.number().optional(),
      endDateIso: z.string().optional().describe('Optional stop date (YYYY-MM-DD or full ISO)'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      campaignId: z.string().optional(),
      message: z.string(),
    }),
  },
  async ({ companyId, campaignName, message, dailyBudget, countries, ageMin, ageMax, endDateIso }) => {
    const cfg = await getMetaAdsConfig(companyId);
    if (!cfg) return { success: false, message: '❌ Meta Ads non connecté.' };
    // Need pageId + whatsappNumber from the WhatsApp integration doc
    const waDoc = await getFirestore().doc(`companies/${companyId}/integrations/whatsapp`).get();
    if (!waDoc.exists) return { success: false, message: '❌ WhatsApp non connecté — la pub CTW pointe vers ton numéro WhatsApp Business.' };
    const wa = waDoc.data() as { displayPhoneNumber?: string; pageId?: string };
    if (!wa.displayPhoneNumber) return { success: false, message: '❌ Numéro WhatsApp Business manquant.' };
    if (!wa.pageId) return { success: false, message: '❌ Page Facebook ID manquant — Meta exige une page liée pour la pub. Renseigne-la dans Admin → WhatsApp.' };
    try {
      const r = await createCtwCampaign({
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
    } catch (e: any) {
      return { success: false, message: `❌ ${e?.message ?? 'Erreur création'}` };
    }
  },
);

export const META_ADS_TOOLS = [
  listCampaignsTool, campaignInsightsTool,
  pauseCampaignTool, resumeCampaignTool, boostCampaignTool,
  createCtwCampaignTool,
];
