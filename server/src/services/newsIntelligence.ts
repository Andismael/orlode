/**
 * News Intelligence Engine — Cross-Module Correlation + Smart Alerts + Auto-Actions
 *
 * 1. Multi-source correlation: news + sales + marketing + security → unified insights
 * 2. Smart alerts: anomalies, sentiment spikes, competitor activity detection
 * 3. Automatic actions: news triggers → create tasks in other modules
 */
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { createNotification } from './notificationService';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { logger } from '../utils/logger';

// ══════════════════════════════════════════════════════════════════════════════
// 1. MULTI-SOURCE CORRELATION
// ══════════════════════════════════════════════════════════════════════════════

export interface CorrelationInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'trend' | 'action_needed';
  title: string;
  description: string;
  sources: string[];     // which modules contributed
  confidence: number;    // 0-1
  impact: 'high' | 'medium' | 'low';
  suggestedAction?: string;
  createdAt: Date;
}

/** Run cross-module correlation: combine news + sales + marketing + security data into insights */
export async function runCorrelationAnalysis(companyId: string): Promise<CorrelationInsight[]> {
  const db = getFirestore();

  // Gather data from multiple modules
  const [newsSnap, leadsSnap, incSnap, postSnap, vulnSnap] = await Promise.all([
    db.collection(`companies/${companyId}/newsArticles`).orderBy('savedAt', 'desc').limit(20).get(),
    db.collection(`companies/${companyId}/leads`).orderBy('createdAt', 'desc').limit(20).get(),
    db.collection(`companies/${companyId}/securityIncidents`).limit(10).get(),
    db.collection(`companies/${companyId}/marketingPosts`).orderBy('createdAt', 'desc').limit(10).get(),
    db.collection(`companies/${companyId}/vulnerabilities`).where('status', '==', 'open').limit(10).get(),
  ]);

  const newsTopics = newsSnap.docs.map(d => (d.data()['title'] as string) ?? '').filter(Boolean).slice(0, 10);
  const newsSentiments = newsSnap.docs.map(d => (d.data()['sentiment'] as string) ?? 'neutral');
  const leadCount = leadsSnap.size;
  const openIncidents = incSnap.docs.filter(d => !['closed', 'recovered'].includes(d.data()['status'] as string)).length;
  const openVulns = vulnSnap.size;
  const recentPosts = postSnap.size;

  const negSentimentPct = newsSentiments.filter(s => s === 'negative').length / Math.max(newsSentiments.length, 1) * 100;

  // Use AI to correlate
  const { text } = await ai.generate({
    model: GEMINI_FLASH,
    prompt: `You are a strategic intelligence analyst. Correlate data from multiple business modules and generate 3-5 actionable insights in French.

DATA:
- Recent news topics: ${newsTopics.join('; ')}
- News sentiment: ${Math.round(negSentimentPct)}% negative
- Active leads: ${leadCount}
- Open security incidents: ${openIncidents}
- Open vulnerabilities: ${openVulns}
- Recent marketing posts: ${recentPosts}

Generate correlated insights. Examples of correlations:
- Negative sector news + low leads = market risk → action: adjust sales strategy
- Security incident + regulation news = compliance risk → action: audit
- Positive industry trend + many leads = opportunity → action: increase marketing

Return JSON ONLY:
[{"type":"opportunity|risk|trend|action_needed","title":"...","description":"2-3 sentences","sources":["news","sales","security"],"confidence":0.8,"impact":"high","suggestedAction":"..."}]`,
    config: { temperature: 0.3 },
  });

  let insights: CorrelationInsight[] = [];
  try {
    const parsed = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    insights = (parsed as Omit<CorrelationInsight, 'id' | 'createdAt'>[]).map(i => ({
      ...i, id: generateId(), createdAt: new Date(),
    }));
  } catch {}

  // Save insights
  for (const insight of insights) {
    await db.collection(`companies/${companyId}/newsInsights`).doc(insight.id).set(insight);
  }

  logger.info(`[NewsIntelligence] Generated ${insights.length} correlation insights for ${companyId}`);
  return insights;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. SMART ALERTS
// ══════════════════════════════════════════════════════════════════════════════

export interface SmartAlert {
  id: string;
  type: 'sentiment_spike' | 'competitor_active' | 'anomaly' | 'regulation' | 'market_shift';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  trigger: string;        // what data triggered this
  suggestedAction: string;
  createdAt: Date;
}

/** Analyze recent news for smart alerts (goes beyond keyword matching) */
export async function checkSmartAlerts(companyId: string): Promise<SmartAlert[]> {
  const db = getFirestore();

  // Get recent articles and competitors
  const [articlesSnap, compSnap, configDoc] = await Promise.all([
    db.collection(`companies/${companyId}/newsArticles`).orderBy('savedAt', 'desc').limit(30).get(),
    db.collection(`companies/${companyId}/competitors`).limit(10).get(),
    db.collection(`companies/${companyId}/settings`).doc('newsConfig').get(),
  ]);

  const articles = articlesSnap.docs.map(d => d.data());
  const competitors = compSnap.docs.map(d => (d.data()['name'] as string) ?? '').filter(Boolean);
  const keywords = (configDoc.data()?.['keywords'] as string[]) ?? [];

  const alerts: SmartAlert[] = [];

  // 1. Sentiment spike detection
  const negativeCount = articles.filter(a => a['sentiment'] === 'negative').length;
  const negPct = articles.length > 0 ? negativeCount / articles.length * 100 : 0;
  if (negPct > 50) {
    alerts.push({
      id: generateId(), type: 'sentiment_spike', severity: negPct > 70 ? 'critical' : 'high',
      title: `Sentiment negatif eleve: ${Math.round(negPct)}%`,
      description: `Plus de la moitie des articles recents ont un sentiment negatif. Cela peut indiquer une tendance defavorable pour votre secteur.`,
      trigger: `${negativeCount}/${articles.length} articles negatifs`,
      suggestedAction: 'Analyser les causes et preparer une communication interne/externe.',
      createdAt: new Date(),
    });
  }

  // 2. Competitor activity detection
  for (const comp of competitors) {
    const mentions = articles.filter(a =>
      ((a['title'] as string) ?? '').toLowerCase().includes(comp.toLowerCase()) ||
      ((a['summary'] as string) ?? '').toLowerCase().includes(comp.toLowerCase())
    );
    if (mentions.length >= 2) {
      const impactTypes = mentions.map(m => (m['sentiment'] as string) ?? 'neutral');
      alerts.push({
        id: generateId(), type: 'competitor_active', severity: mentions.length >= 4 ? 'high' : 'medium',
        title: `Concurrent actif: ${comp} (${mentions.length} mentions)`,
        description: `${comp} apparait dans ${mentions.length} articles recents. Sentiments: ${impactTypes.join(', ')}.`,
        trigger: `${mentions.length} mentions de ${comp}`,
        suggestedAction: `Analyser la strategie de ${comp} et ajuster votre positionnement.`,
        createdAt: new Date(),
      });
    }
  }

  // 3. Regulation/compliance alerts
  const regArticles = articles.filter(a =>
    ['regulation', 'politics'].includes((a['category'] as string) ?? '') ||
    ((a['title'] as string) ?? '').toLowerCase().match(/rgpd|gdpr|regulation|loi|directive|compliance/)
  );
  if (regArticles.length >= 2) {
    alerts.push({
      id: generateId(), type: 'regulation', severity: 'high',
      title: `Changements reglementaires detectes (${regArticles.length} articles)`,
      description: `Plusieurs articles recents mentionnent des changements reglementaires. Verifiez l'impact sur votre conformite.`,
      trigger: `${regArticles.length} articles reglementaires`,
      suggestedAction: 'Faire verifier par l\'equipe juridique et mettre a jour la conformite.',
      createdAt: new Date(),
    });
  }

  // 4. Market shift (many "breaking" articles)
  const breakingCount = articles.filter(a => a['importance'] === 'breaking').length;
  if (breakingCount >= 3) {
    alerts.push({
      id: generateId(), type: 'market_shift', severity: 'high',
      title: `Mouvement de marche important (${breakingCount} breaking news)`,
      description: `Plusieurs actualites majeures detectees. Evaluez l'impact potentiel sur vos operations.`,
      trigger: `${breakingCount} articles "breaking"`,
      suggestedAction: 'Briefer l\'equipe direction et evaluer les risques/opportunites.',
      createdAt: new Date(),
    });
  }

  // Save alerts
  for (const alert of alerts) {
    await db.collection(`companies/${companyId}/newsAlerts`).doc(alert.id).set(alert);
    // Notify admins
    createNotification({
      companyId, type: 'agent_alert',
      title: `Veille: ${alert.title}`,
      message: alert.description.slice(0, 200),
      actionUrl: '/news', icon: 'AlertTriangle',
      severity: alert.severity === 'critical' ? 'error' : alert.severity === 'high' ? 'warning' : 'info',
    }).catch(() => {});
  }

  logger.info(`[NewsIntelligence] Generated ${alerts.length} smart alerts for ${companyId}`);
  return alerts;
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. AUTOMATIC ACTIONS — with SAFETY GUARDS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * SAFETY LAYER:
 *   1. Mode SAFE: auto | suggest | require_approval
 *   2. Confidence minimum: only act if confidence >= 0.7
 *   3. Anti-loop: flag triggeredBy + cooldown per action type
 *   4. Priority: immediate | scheduled | suggestion_only
 */

type ActionMode = 'auto' | 'suggest' | 'require_approval';

interface ActionRule {
  module: string;
  mode: ActionMode;
  priority: 'immediate' | 'scheduled' | 'suggestion_only';
  minConfidence: number;
  cooldownMinutes: number; // prevent duplicate actions within this window
}

const ACTION_RULES: Record<string, ActionRule> = {
  competitor_active: { module: 'marketing', mode: 'suggest', priority: 'scheduled', minConfidence: 0.7, cooldownMinutes: 60 },
  sentiment_spike:   { module: 'support',   mode: 'auto',    priority: 'immediate', minConfidence: 0.75, cooldownMinutes: 30 },
  regulation:        { module: 'legal',     mode: 'auto',    priority: 'immediate', minConfidence: 0.7, cooldownMinutes: 120 },
  market_shift:      { module: 'insights',  mode: 'suggest', priority: 'suggestion_only', minConfidence: 0.6, cooldownMinutes: 60 },
};

// Anti-loop: track last action per type to prevent duplicates
const lastActionTimestamps = new Map<string, number>();

function checkCooldown(companyId: string, alertType: string, cooldownMinutes: number): boolean {
  const key = `${companyId}_${alertType}`;
  const lastTs = lastActionTimestamps.get(key) ?? 0;
  if (Date.now() - lastTs < cooldownMinutes * 60000) {
    logger.info(`[NewsIntelligence] Cooldown active for ${alertType} — skipping action`);
    return false; // still in cooldown
  }
  lastActionTimestamps.set(key, Date.now());
  return true;
}

export interface AutoActionResult {
  action: string;
  module: string;
  mode: ActionMode;
  priority: string;
  executed: boolean;
  reason?: string; // why not executed (cooldown, low confidence, suggest-only)
}

/** Process smart alerts with safety guards */
export async function processAutoActions(companyId: string, alerts: SmartAlert[]): Promise<AutoActionResult[]> {
  const db = getFirestore();
  const results: AutoActionResult[] = [];

  for (const alert of alerts) {
    const rule = ACTION_RULES[alert.type];
    if (!rule) continue;

    const actionBase = { module: rule.module, mode: rule.mode, priority: rule.priority };

    // GUARD 1: Anti-loop cooldown
    if (!checkCooldown(companyId, alert.type, rule.cooldownMinutes)) {
      results.push({ ...actionBase, action: `${alert.title} — cooldown actif`, executed: false, reason: `Cooldown ${rule.cooldownMinutes}min — action deja executee recemment` });
      continue;
    }

    // GUARD 2: Confidence minimum (use severity as proxy: critical=0.9, high=0.8, medium=0.6, low=0.4)
    const confidence = alert.severity === 'critical' ? 0.9 : alert.severity === 'high' ? 0.8 : alert.severity === 'medium' ? 0.6 : 0.4;
    if (confidence < rule.minConfidence) {
      results.push({ ...actionBase, action: `${alert.title} — confiance insuffisante`, executed: false, reason: `Confiance ${confidence} < seuil ${rule.minConfidence}` });
      continue;
    }

    // GUARD 3: Mode check
    if (rule.mode === 'require_approval') {
      // Save as pending approval instead of executing
      await db.collection(`companies/${companyId}/pendingAutoActions`).doc(generateId()).set({
        alertId: alert.id, alertType: alert.type, module: rule.module,
        title: alert.title, description: alert.description, suggestedAction: alert.suggestedAction,
        status: 'pending_approval', createdAt: new Date(),
        triggeredBy: 'news_intelligence', // Anti-loop flag
      });
      createNotification({ companyId, type: 'system', title: `Action en attente d'approbation`, message: `${alert.title} — ${alert.suggestedAction}`, actionUrl: '/news', icon: 'Shield', severity: 'warning' }).catch(() => {});
      results.push({ ...actionBase, action: `${alert.title} — en attente approbation`, executed: false, reason: 'Mode require_approval' });
      continue;
    }

    if (rule.mode === 'suggest' || rule.priority === 'suggestion_only') {
      // Only suggest — don't create real items
      createNotification({ companyId, type: 'agent_alert', title: `Suggestion: ${alert.title}`, message: `${alert.suggestedAction}`, actionUrl: '/news', icon: 'Lightbulb', severity: 'info' }).catch(() => {});
      results.push({ ...actionBase, action: `${alert.title} — suggestion envoyee`, executed: false, reason: 'Mode suggest — notification seulement' });
      continue;
    }

    // GUARD 4: Execute with triggeredBy flag (anti-loop) + priority tag
    const triggeredBy = 'news_intelligence';

    if (alert.type === 'sentiment_spike' && rule.mode === 'auto') {
      const id = generateId();
      await db.collection(`companies/${companyId}/supportTickets`).doc(id).set({
        id, subject: `[VEILLE AUTO] ${alert.title}`,
        description: `Ticket auto-genere par la veille intelligence.\n\n${alert.description}\n\nAction suggeree: ${alert.suggestedAction}`,
        priority: alert.severity === 'critical' ? 'urgent' : 'high',
        status: 'open', category: 'monitoring',
        source: triggeredBy, triggeredBy, // Anti-loop flag
        createdAt: new Date(), updatedAt: new Date(),
      });
      results.push({ ...actionBase, action: `Support: ticket cree — ${alert.title}`, executed: true });
    }

    if (alert.type === 'regulation' && rule.mode === 'auto') {
      const id = generateId();
      await db.collection(`companies/${companyId}/legalCases`).doc(id).set({
        id, title: `[VEILLE AUTO] ${alert.title}`,
        description: `Revue juridique auto-generee.\n\n${alert.description}\n\nAction: ${alert.suggestedAction}`,
        type: 'compliance_review', status: 'open', priority: 'high',
        source: triggeredBy, triggeredBy, // Anti-loop flag
        createdAt: new Date(), updatedAt: new Date(),
      });
      results.push({ ...actionBase, action: `Legal: dossier conformite cree — ${alert.title}`, executed: true });
    }
  }

  // Log all results
  if (results.length > 0) {
    await db.collection(`companies/${companyId}/newsAutoActions`).doc(generateId()).set({
      results, alertCount: alerts.length, executedCount: results.filter(r => r.executed).length,
      suggestedCount: results.filter(r => !r.executed).length,
      executedAt: new Date(), triggeredBy: 'news_intelligence',
    });
  }

  logger.info(`[NewsIntelligence] Processed ${results.length} actions (${results.filter(r => r.executed).length} executed, ${results.filter(r => !r.executed).length} suggested/blocked) for ${companyId}`);
  return results;
}

/** Full intelligence pipeline: correlate + alert + act (with safety) */
export async function runFullIntelligencePipeline(companyId: string): Promise<{
  insights: CorrelationInsight[];
  alerts: SmartAlert[];
  actions: AutoActionResult[];
}> {
  const [insights, alerts] = await Promise.all([
    runCorrelationAnalysis(companyId),
    checkSmartAlerts(companyId),
  ]);
  const actions = await processAutoActions(companyId, alerts);
  return { insights, alerts, actions };
}
