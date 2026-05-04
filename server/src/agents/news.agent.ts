/**
 * News Agent PRO — Gemini Flash
 * Veille sectorielle PRO: articles, concurrents, sentiment, trending, alertes, digest, bookmarks.
 *
 * Tools:
 *   1. nws_fetchNews          — breaking news + sector news (IA)
 *   2. nws_getCompanyNews     — news specifiques entreprise/secteur
 *   3. nws_getBriefingHistory — historique briefings
 *   4. nws_configureAlerts    — config alertes mots-cles
 *   5. nws_trackCompetitor    — ajouter/lister concurrents surveilles
 *   6. nws_analyzeSentiment   — sentiment analysis sur topics
 *   7. nws_getTrending        — topics en hausse/baisse
 *   8. nws_bookmarkArticle    — sauvegarder un article
 *   9. nws_generateDigest     — generer newsletter/digest email
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

const NEWS_CATEGORIES = ['business', 'technology', 'world', 'politics', 'science', 'health', 'finance', 'regulation', 'startup', 'ai', 'sustainability'] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 1. FETCH NEWS (enriched)
// ══════════════════════════════════════════════════════════════════════════════

export const fetchNewsTool = ai.defineTool(
  {
    name: 'nws_fetchNews',
    description: 'Fetch latest news with sentiment, categories, and importance scoring.',
    inputSchema: z.object({
      companyId: z.string(), topics: z.array(z.string()).optional().default(['breaking news', 'business', 'technology']),
      language: z.string().optional().default('fr'), maxItems: z.number().optional().default(10),
    }),
    outputSchema: z.object({
      articles: z.array(z.object({
        title: z.string(), summary: z.string(), source: z.string(), publishedAt: z.string(),
        url: z.string().optional(), category: z.string(), importance: z.string(),
        sentiment: z.string().optional(), tags: z.array(z.string()).optional(),
      })),
      fetchedAt: z.string(), topHeadline: z.string(),
    }),
  },
  async ({ companyId, topics, language, maxItems }) => {
    const topicStr = (topics ?? ['breaking news', 'business', 'technology']).join(', ');
    const langLabel = language === 'fr' ? 'French' : language === 'en' ? 'English' : language ?? 'French';

    const todayISO = new Date().toISOString().slice(0, 10);
    const todayHuman = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `You are a premium news intelligence service. Provide the latest news briefing in ${langLabel}.
TODAY'S DATE: ${todayISO} (${todayHuman}).
ALL article publishedAt dates MUST be within the last 7 days from today (${todayISO}). NEVER use dates from previous years.

Topics: ${topicStr}. Number of articles: ${maxItems ?? 10}.

For each article provide:
- title, summary (2-3 sentences), source (real news outlet), publishedAt (ISO date within the last 7 days from ${todayISO})
- category: ${NEWS_CATEGORIES.join('|')}
- importance: breaking|high|medium|low
- sentiment: positive|negative|neutral|mixed
- tags: 2-3 keyword tags

Return JSON ONLY:
{"topHeadline":"...","articles":[{"title":"...","summary":"...","source":"...","publishedAt":"...","category":"...","importance":"...","sentiment":"...","tags":["tag1","tag2"]}]}`,
      config: { temperature: 0.3 },
    });

    const fetchedAt = new Date().toISOString();
    try {
      const parsed = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
      const db = getFirestore();
      const briefingId = generateId();
      await db.collection(`companies/${companyId}/newsBriefings`).doc(briefingId).set({
        id: briefingId, topics, language, topHeadline: parsed.topHeadline,
        articles: parsed.articles, articleCount: parsed.articles.length,
        fetchedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
      });
      // Save individual articles for search/bookmark
      for (const art of parsed.articles) {
        await db.collection(`companies/${companyId}/newsArticles`).doc(generateId()).set({
          ...art, briefingId, companyId, savedAt: FieldValue.serverTimestamp(),
        });
      }
      return { articles: parsed.articles, fetchedAt, topHeadline: parsed.topHeadline };
    } catch {
      return { articles: [{ title: 'Briefing indisponible', summary: 'Reessayez plus tard.', source: 'System', publishedAt: fetchedAt, category: 'system', importance: 'low' }], fetchedAt, topHeadline: 'Service temporairement indisponible' };
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. COMPANY NEWS (sector-specific)
// ══════════════════════════════════════════════════════════════════════════════

export const companyNewsTool = ai.defineTool(
  {
    name: 'nws_getCompanyNews',
    description: 'Get news specifically relevant to the company sector and competitors.',
    inputSchema: z.object({ companyId: z.string(), sector: z.string().optional(), keywords: z.array(z.string()).optional(), language: z.string().optional().default('fr') }),
    outputSchema: z.object({ articles: z.array(z.object({ title: z.string(), summary: z.string(), source: z.string(), relevance: z.string(), impact: z.string(), sentiment: z.string() })) }),
  },
  async ({ companyId, sector, keywords, language }) => {
    const db = getFirestore();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const companyData = companyDoc.data() ?? {};
    const companyName = (companyData['name'] as string) ?? 'the company';
    const companySector = sector ?? (companyData['sector'] as string) ?? 'business';

    // Get tracked competitors
    const compSnap = await db.collection(`companies/${companyId}/competitors`).limit(10).get();
    const competitors = compSnap.docs.map(d => (d.data()['name'] as string) ?? '').filter(Boolean);

    const todayISO = new Date().toISOString().slice(0, 10);

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Generate a targeted news briefing in ${language === 'fr' ? 'French' : 'English'} for "${companyName}" (${companySector}).
TODAY'S DATE: ${todayISO}. All articles must be from the last 7 days.

Focus: ${(keywords ?? []).join(', ') || companySector}
${competitors.length > 0 ? `Competitors to watch: ${competitors.join(', ')}` : ''}
Include: industry trends, competitor moves, regulatory changes, market opportunities/risks.
Return JSON: {"articles":[{"title":"...","summary":"...","source":"...","relevance":"why it matters","impact":"positive|negative|neutral|opportunity|risk","sentiment":"positive|negative|neutral"}]}
Max 8 articles. Return ONLY JSON.`,
      config: { temperature: 0.3 },
    });
    try {
      return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    } catch { return { articles: [] }; }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. BRIEFING HISTORY
// ══════════════════════════════════════════════════════════════════════════════

export const newsBriefingHistoryTool = ai.defineTool(
  {
    name: 'nws_getBriefingHistory',
    description: 'Get past news briefings.',
    inputSchema: z.object({ companyId: z.string(), limit: z.number().optional().default(10) }),
    outputSchema: z.object({ briefings: z.array(z.object({ id: z.string(), topHeadline: z.string(), articleCount: z.number(), fetchedAt: z.string() })) }),
  },
  async ({ companyId, limit }) => {
    const snap = await getFirestore().collection(`companies/${companyId}/newsBriefings`).orderBy('createdAt', 'desc').limit(limit ?? 10).get();
    return {
      briefings: snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, topHeadline: (data['topHeadline'] as string) ?? '', articleCount: ((data['articles'] as unknown[]) ?? []).length, fetchedAt: (data['fetchedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '' };
      }),
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. CONFIGURE ALERTS
// ══════════════════════════════════════════════════════════════════════════════

export const newsAlertSetupTool = ai.defineTool(
  {
    name: 'nws_configureAlerts',
    description: 'Configure news alert keywords, schedule, and notification channels.',
    inputSchema: z.object({
      companyId: z.string(), keywords: z.array(z.string()),
      schedule: z.array(z.string()).optional().default(['07:00', '12:00', '18:00']),
      language: z.string().optional().default('fr'), categories: z.array(z.string()).optional(),
      notifyChannels: z.array(z.string()).optional().describe('in_app | email | telegram | slack'),
    }),
    outputSchema: z.object({ configured: z.boolean(), message: z.string(), nextBriefing: z.string() }),
  },
  async ({ companyId, keywords, schedule, language, categories, notifyChannels }) => {
    await getFirestore().collection(`companies/${companyId}/settings`).doc('newsConfig').set({
      keywords, schedule: schedule ?? ['07:00', '12:00', '18:00'], language: language ?? 'fr',
      categories: categories ?? ['business', 'technology', 'world'],
      notifyChannels: notifyChannels ?? ['in_app'],
      enabled: true, updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const now = new Date();
    const next = (schedule ?? ['07:00', '12:00', '18:00']).map(s => { const [h, m] = s.split(':').map(Number); const t = new Date(); t.setHours(h, m, 0, 0); return t; }).filter(t => t > now).sort((a, b) => a.getTime() - b.getTime());
    return { configured: true, message: `Alertes configurees: ${keywords.join(', ')}. Canaux: ${(notifyChannels ?? ['in_app']).join(', ')}.`, nextBriefing: next[0]?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) ?? 'Demain 07:00' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 5. COMPETITOR TRACKER
// ══════════════════════════════════════════════════════════════════════════════

export const trackCompetitorTool = ai.defineTool(
  {
    name: 'nws_trackCompetitor',
    description: 'Add, list, or analyze tracked competitors.',
    inputSchema: z.object({
      companyId: z.string(), action: z.enum(['add', 'list', 'analyze']),
      competitorName: z.string().optional(), website: z.string().optional(), sector: z.string().optional(),
    }),
    outputSchema: z.object({
      competitors: z.array(z.object({ id: z.string(), name: z.string(), website: z.string(), sector: z.string(), addedAt: z.string() })).optional(),
      analysis: z.string().optional(), message: z.string(),
    }),
  },
  async ({ companyId, action, competitorName, website, sector }) => {
    const db = getFirestore();
    if (action === 'add' && competitorName) {
      const id = generateId();
      await db.collection(`companies/${companyId}/competitors`).doc(id).set({
        id, name: competitorName, website: website ?? '', sector: sector ?? '',
        addedAt: FieldValue.serverTimestamp(),
      });
      return { message: `Concurrent "${competitorName}" ajoute au suivi.` };
    }
    if (action === 'list') {
      const snap = await db.collection(`companies/${companyId}/competitors`).limit(20).get();
      return {
        competitors: snap.docs.map(d => { const data = d.data(); return { id: d.id, name: (data['name'] as string) ?? '', website: (data['website'] as string) ?? '', sector: (data['sector'] as string) ?? '', addedAt: (data['addedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '' }; }),
        message: `${snap.size} concurrent(s) surveille(s).`,
      };
    }
    if (action === 'analyze' && competitorName) {
      const { text } = await ai.generate({
        model: GEMINI_FLASH,
        prompt: `Analyze the competitor "${competitorName}"${sector ? ` in the ${sector} sector` : ''}. Provide: strengths, weaknesses, recent moves, threats, opportunities. In French. 3-4 paragraphs.`,
        config: { temperature: 0.3 },
      });
      return { analysis: text, message: `Analyse de ${competitorName} generee.` };
    }
    return { message: 'Action non reconnue.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 6. SENTIMENT ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════

export const analyzeSentimentTool = ai.defineTool(
  {
    name: 'nws_analyzeSentiment',
    description: 'Analyze news sentiment around a topic, company, or sector.',
    inputSchema: z.object({ companyId: z.string(), topic: z.string(), language: z.string().optional().default('fr') }),
    outputSchema: z.object({
      topic: z.string(), overallSentiment: z.string(), score: z.number(),
      breakdown: z.object({ positive: z.number(), negative: z.number(), neutral: z.number() }),
      keyThemes: z.array(z.string()), summary: z.string(),
    }),
  },
  async ({ companyId, topic, language }) => {
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Analyze the current news sentiment around "${topic}" in ${language === 'fr' ? 'French' : 'English'}.
Return JSON: {"topic":"...","overallSentiment":"positive|negative|neutral|mixed","score":0.7,"breakdown":{"positive":60,"negative":25,"neutral":15},"keyThemes":["theme1","theme2","theme3"],"summary":"2-3 sentences"}
Return ONLY JSON.`,
      config: { temperature: 0.2 },
    });
    try { return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); } catch {
      return { topic, overallSentiment: 'neutral', score: 0.5, breakdown: { positive: 33, negative: 33, neutral: 34 }, keyThemes: [], summary: 'Analyse indisponible.' };
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 7. TRENDING TOPICS
// ══════════════════════════════════════════════════════════════════════════════

export const getTrendingTool = ai.defineTool(
  {
    name: 'nws_getTrending',
    description: 'Get trending topics — what is rising or falling in news coverage.',
    inputSchema: z.object({ companyId: z.string(), sector: z.string().optional(), language: z.string().optional().default('fr') }),
    outputSchema: z.object({
      trending: z.array(z.object({ topic: z.string(), direction: z.string(), momentum: z.number(), category: z.string(), summary: z.string() })),
    }),
  },
  async ({ companyId, sector, language }) => {
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Identify the top 8 trending topics in news right now${sector ? ` for the ${sector} sector` : ''} in ${language === 'fr' ? 'French' : 'English'}.
For each: topic name, direction (rising|stable|falling), momentum (0-100), category, one-sentence summary.
Return JSON: {"trending":[{"topic":"...","direction":"rising","momentum":85,"category":"technology","summary":"..."}]}
Return ONLY JSON.`,
      config: { temperature: 0.3 },
    });
    try { return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); } catch { return { trending: [] }; }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 8. BOOKMARK ARTICLE
// ══════════════════════════════════════════════════════════════════════════════

export const bookmarkArticleTool = ai.defineTool(
  {
    name: 'nws_bookmarkArticle',
    description: 'Save/bookmark a news article for later reference.',
    inputSchema: z.object({ companyId: z.string(), userId: z.string().optional(), title: z.string(), summary: z.string(), source: z.string(), url: z.string().optional(), notes: z.string().optional() }),
    outputSchema: z.object({ bookmarkId: z.string(), message: z.string() }),
  },
  async ({ companyId, userId, title, summary, source, url, notes }) => {
    const id = generateId();
    await getFirestore().collection(`companies/${companyId}/newsBookmarks`).doc(id).set({
      id, userId: userId ?? null, title, summary, source, url: url ?? null, notes: notes ?? '',
      savedAt: FieldValue.serverTimestamp(),
    });
    return { bookmarkId: id, message: `Article "${title}" sauvegarde.` };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 9. GENERATE DIGEST
// ══════════════════════════════════════════════════════════════════════════════

export const generateDigestTool = ai.defineTool(
  {
    name: 'nws_generateDigest',
    description: 'Generate a newsletter/email digest from recent news briefings.',
    inputSchema: z.object({ companyId: z.string(), period: z.enum(['daily', 'weekly']).optional().default('daily'), language: z.string().optional().default('fr') }),
    outputSchema: z.object({ subject: z.string(), htmlContent: z.string(), articleCount: z.number() }),
  },
  async ({ companyId, period, language }) => {
    const db = getFirestore();
    const days = period === 'weekly' ? 7 : 1;
    const cutoff = new Date(Date.now() - days * 86400000);
    const snap = await db.collection(`companies/${companyId}/newsBriefings`).orderBy('createdAt', 'desc').limit(period === 'weekly' ? 20 : 5).get();
    const allArticles: { title: string; summary: string; source: string; category: string; importance: string }[] = [];
    snap.docs.forEach(d => { const arts = (d.data()['articles'] as unknown[]) ?? []; allArticles.push(...arts as typeof allArticles); });

    if (allArticles.length === 0) return { subject: 'Aucun article', htmlContent: '<p>Aucun article recent.</p>', articleCount: 0 };

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Generate a professional ${period} news digest email in ${language === 'fr' ? 'French' : 'English'}.
Articles to include (${allArticles.length}):
${allArticles.slice(0, 15).map((a, i) => `${i + 1}. [${a.importance}] ${a.title} — ${a.summary} (${a.source})`).join('\n')}

Return JSON: {"subject":"email subject","htmlContent":"<html email body with sections, styled inline>"}
Make it professional, concise, with clear sections by category. Include a header and footer.
Return ONLY JSON.`,
      config: { temperature: 0.3 },
    });
    try {
      const parsed = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
      return { subject: parsed.subject, htmlContent: parsed.htmlContent, articleCount: allArticles.length };
    } catch {
      return { subject: `Digest ${period} — ${new Date().toLocaleDateString('fr-FR')}`, htmlContent: `<h1>News Digest</h1>${allArticles.slice(0, 10).map(a => `<h3>${a.title}</h3><p>${a.summary}</p><small>${a.source}</small>`).join('')}`, articleCount: allArticles.length };
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════

const ALL_TOOLS = [
  fetchNewsTool, companyNewsTool, newsBriefingHistoryTool, newsAlertSetupTool,
  trackCompetitorTool, analyzeSentimentTool, getTrendingTool, bookmarkArticleTool, generateDigestTool,
];

const INPUT = z.object({
  request: z.string(),
  companyId: z.string(),
  userId: z.string().optional(),
  language: z.string().optional().default('auto'),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});
const OUTPUT = z.object({ response: z.string(), topHeadline: z.string().optional(), articleCount: z.number(), briefingId: z.string().optional() });

export const newsAgentFlow = ai.defineFlow(
  { name: 'newsAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, userId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    logger.info(`[NewsAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;

    const dateAnchors = (() => {
      const now = new Date();
      const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();

    // Read company sector for context
    let sector = '';
    let companyName = '';
    try {
      const db = getFirestore();
      const c = await db.collection('companies').doc(companyId).get();
      sector = (c.data()?.['sector'] as string) ?? (c.data()?.['industry'] as string) ?? '';
      companyName = (c.data()?.['name'] as string) ?? '';
    } catch { /* ignore */ }

    const executors = new Map<string, (i: unknown) => Promise<unknown>>();
    for (const tool of ALL_TOOLS) {
      const name = (tool as unknown as { __action: { name: string } }).__action?.name ?? '';
      if (name) executors.set(name, (i: unknown) => (tool as (args: unknown) => Promise<unknown>)({ ...(i as Record<string, unknown>), companyId, userId }));
    }

    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) {
        messages.push({ role: h.role, content: [{ text: h.content }] });
      }
    }
    messages.push({ role: 'user', content: [{ text: request }] });

    let response = await ai.generate({
      model: GEMINI_FLASH,
      system: `Tu es l'Agent Veille PRO de l'entreprise — service premium d'intelligence économique et veille sectorielle.
CompanyID: ${companyId}. UserID: ${userId ?? 'unknown'}.
${companyName ? `Entreprise : ${companyName}.` : ''}${sector ? ` Secteur : ${sector}.` : ''}

## 📅 CONTEXTE TEMPOREL
${dateAnchors}
RÈGLE CRITIQUE : tous les articles que tu génères ou cites DOIVENT avoir des dates COHÉRENTES avec aujourd'hui (jamais 2023 ou 2024 si on est en avril 2026). Pour "actualités d'aujourd'hui", utilise la date du jour. Pour "cette semaine", reste dans les 7 derniers jours.

## 🧠 MÉMOIRE CONVERSATIONNELLE — ARTICLES, CONCURRENTS, BRIEFINGS RÉFÉRENCÉS
RÈGLE D'OR : conserve TOUJOURS le DERNIER article / concurrent / briefing mentionné dans ta mémoire active.
Quand l'utilisateur dit :
• "cet article" / "celui-là" / "le #1" / "le premier" → utilise l'article en position #1 de TA DERNIÈRE liste
• "Bookmark cet article" → appelle nws_bookmarkArticle avec les détails du dernier article
• "Analyse ce concurrent" → appelle nws_trackCompetitor(action='analyze', competitorName=<dernier concurrent listé>)
• Si l'utilisateur répond par un numéro ('1', '2', '3'), références-toi à TA DERNIÈRE liste

## TON RÔLE
Veille économique premium : actualités sectorielles, concurrents, sentiment, tendances, alertes, digests.

CAPACITÉS :
1. NEWS : actualités générales + sectorielles avec sentiment (nws_fetchNews, nws_getCompanyNews)
2. CONCURRENTS : ajouter, lister, analyser (nws_trackCompetitor avec action='add'|'list'|'analyze')
3. TENDANCES : topics en hausse/baisse avec momentum (nws_getTrending)
4. SENTIMENT : analyse autour d'un topic/entreprise (nws_analyzeSentiment)
5. ALERTES : configurer mots-clés + planning + canaux (nws_configureAlerts)
6. BOOKMARKS : sauvegarder articles importants (nws_bookmarkArticle)
7. DIGEST : générer newsletter daily/weekly (nws_generateDigest)
8. HISTORIQUE : briefings passés (nws_getBriefingHistory)

PLANNING : 07:00 | 12:00 | 18:00 (configurable)
Chaque briefing = headline du jour + articles curés avec sentiment + tags

QUAND L'UTILISATEUR DEMANDE...
- "actualités du jour" / "veille du jour" → nws_fetchNews + nws_getCompanyNews pour couverture complète
- "concurrents" → nws_trackCompetitor (action='list' ou 'analyze')
- "tendances" / "qu'est-ce qui buzz" → nws_getTrending
- "sentiment sur X" → nws_analyzeSentiment
- "envoie-moi le digest" → nws_generateDigest (daily ou weekly)

RÈGLES :
- 🚫 ZÉRO FABRICATION : si un tool échoue, dis-le. Ne dis JAMAIS "voici les actualités" si nws_fetchNews a renvoyé un error.
- 🚫 ZÉRO DATE PÉRIMÉE : refuse d'inventer des articles avec des dates antérieures à 2026 quand on est en 2026.
- Pour le digest, propose de l'envoyer par email via l'agent Comms.
- Si l'utilisateur demande "actualités sur X" et X est leur secteur/concurrent, fais le lien automatique.
${langInstr}`,
      messages, tools: ALL_TOOLS, config: { temperature: 0.3 },
    });

    let loopCount = 0; let topHeadline: string | undefined; let articleCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 6) {
      loopCount++;
      const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
        const { name, input, ref } = p.toolRequest;
        const exec = executors.get(name);
        const output = exec ? await exec(input) : { error: `Unknown tool: ${name}` };
        if (name === 'nws_fetchNews' && output && typeof output === 'object') {
          const o = output as { topHeadline?: string; articles?: unknown[] };
          topHeadline = o.topHeadline; articleCount = o.articles?.length ?? 0;
        }
        return { name, ref, output };
      }));
      response = await ai.generate({
        model: GEMINI_FLASH,
        messages: [...response.messages, { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
        tools: ALL_TOOLS, config: { temperature: 0.3 },
      });
    }
    return { response: response.text, topHeadline, articleCount };
  }
);

export async function runScheduledNewsBriefing(companyId: string, language = 'fr'): Promise<void> {
  logger.info(`[NewsAgent] Scheduled briefing for company ${companyId}`);
  const db = getFirestore();
  const configDoc = await db.collection(`companies/${companyId}/settings`).doc('newsConfig').get();
  const config = configDoc.data() ?? {};
  const topics = (config['keywords'] as string[]) ?? ['breaking news', 'business', 'technology'];
  try {
    await newsAgentFlow({ request: `Deliver the scheduled news briefing. Topics: ${topics.join(', ')}.`, companyId, language: (config['language'] as string) ?? language });
  } catch (err) { logger.error(`[NewsAgent] Briefing failed for ${companyId}`, { error: err }); }
}

export const newsAgentTool = ai.defineTool(
  {
    name: 'callNewsAgent',
    description: 'News Intelligence PRO: breaking news, sector watch, competitor tracking & analysis, sentiment analysis, trending topics, keyword alerts, bookmarks, email digests.',
    inputSchema: INPUT, outputSchema: OUTPUT,
  },
  (input) => newsAgentFlow(input)
);
