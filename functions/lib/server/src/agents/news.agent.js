"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newsAgentTool = exports.newsAgentFlow = exports.generateDigestTool = exports.bookmarkArticleTool = exports.getTrendingTool = exports.analyzeSentimentTool = exports.trackCompetitorTool = exports.newsAlertSetupTool = exports.newsBriefingHistoryTool = exports.companyNewsTool = exports.fetchNewsTool = void 0;
exports.runScheduledNewsBriefing = runScheduledNewsBriefing;
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
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
const NEWS_CATEGORIES = ['business', 'technology', 'world', 'politics', 'science', 'health', 'finance', 'regulation', 'startup', 'ai', 'sustainability'];
// ══════════════════════════════════════════════════════════════════════════════
// 1. FETCH NEWS (enriched)
// ══════════════════════════════════════════════════════════════════════════════
exports.fetchNewsTool = genkit_config_1.ai.defineTool({
    name: 'nws_fetchNews',
    description: 'Fetch latest news with sentiment, categories, and importance scoring.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), topics: zod_1.z.array(zod_1.z.string()).optional().default(['breaking news', 'business', 'technology']),
        language: zod_1.z.string().optional().default('fr'), maxItems: zod_1.z.number().optional().default(10),
    }),
    outputSchema: zod_1.z.object({
        articles: zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string(), summary: zod_1.z.string(), source: zod_1.z.string(), publishedAt: zod_1.z.string(),
            url: zod_1.z.string().optional(), category: zod_1.z.string(), importance: zod_1.z.string(),
            sentiment: zod_1.z.string().optional(), tags: zod_1.z.array(zod_1.z.string()).optional(),
        })),
        fetchedAt: zod_1.z.string(), topHeadline: zod_1.z.string(),
    }),
}, async ({ companyId, topics, language, maxItems }) => {
    const topicStr = (topics ?? ['breaking news', 'business', 'technology']).join(', ');
    const langLabel = language === 'fr' ? 'French' : language === 'en' ? 'English' : language ?? 'French';
    const todayISO = new Date().toISOString().slice(0, 10);
    const todayHuman = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
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
        const db = (0, firebase_config_1.getFirestore)();
        const briefingId = (0, helpers_1.generateId)();
        await db.collection(`companies/${companyId}/newsBriefings`).doc(briefingId).set({
            id: briefingId, topics, language, topHeadline: parsed.topHeadline,
            articles: parsed.articles, articleCount: parsed.articles.length,
            fetchedAt: firestore_1.FieldValue.serverTimestamp(), createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Save individual articles for search/bookmark
        for (const art of parsed.articles) {
            await db.collection(`companies/${companyId}/newsArticles`).doc((0, helpers_1.generateId)()).set({
                ...art, briefingId, companyId, savedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        return { articles: parsed.articles, fetchedAt, topHeadline: parsed.topHeadline };
    }
    catch {
        return { articles: [{ title: 'Briefing indisponible', summary: 'Reessayez plus tard.', source: 'System', publishedAt: fetchedAt, category: 'system', importance: 'low' }], fetchedAt, topHeadline: 'Service temporairement indisponible' };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. COMPANY NEWS (sector-specific)
// ══════════════════════════════════════════════════════════════════════════════
exports.companyNewsTool = genkit_config_1.ai.defineTool({
    name: 'nws_getCompanyNews',
    description: 'Get news specifically relevant to the company sector and competitors.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), sector: zod_1.z.string().optional(), keywords: zod_1.z.array(zod_1.z.string()).optional(), language: zod_1.z.string().optional().default('fr') }),
    outputSchema: zod_1.z.object({ articles: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string(), summary: zod_1.z.string(), source: zod_1.z.string(), relevance: zod_1.z.string(), impact: zod_1.z.string(), sentiment: zod_1.z.string() })) }),
}, async ({ companyId, sector, keywords, language }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const companyData = companyDoc.data() ?? {};
    const companyName = companyData['name'] ?? 'the company';
    const companySector = sector ?? companyData['sector'] ?? 'business';
    // Get tracked competitors
    const compSnap = await db.collection(`companies/${companyId}/competitors`).limit(10).get();
    const competitors = compSnap.docs.map(d => d.data()['name'] ?? '').filter(Boolean);
    const todayISO = new Date().toISOString().slice(0, 10);
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
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
    }
    catch {
        return { articles: [] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. BRIEFING HISTORY
// ══════════════════════════════════════════════════════════════════════════════
exports.newsBriefingHistoryTool = genkit_config_1.ai.defineTool({
    name: 'nws_getBriefingHistory',
    description: 'Get past news briefings.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), limit: zod_1.z.number().optional().default(10) }),
    outputSchema: zod_1.z.object({ briefings: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), topHeadline: zod_1.z.string(), articleCount: zod_1.z.number(), fetchedAt: zod_1.z.string() })) }),
}, async ({ companyId, limit }) => {
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/newsBriefings`).orderBy('createdAt', 'desc').limit(limit ?? 10).get();
    return {
        briefings: snap.docs.map(d => {
            const data = d.data();
            return { id: d.id, topHeadline: data['topHeadline'] ?? '', articleCount: (data['articles'] ?? []).length, fetchedAt: data['fetchedAt']?.toDate?.()?.toISOString() ?? '' };
        }),
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. CONFIGURE ALERTS
// ══════════════════════════════════════════════════════════════════════════════
exports.newsAlertSetupTool = genkit_config_1.ai.defineTool({
    name: 'nws_configureAlerts',
    description: 'Configure news alert keywords, schedule, and notification channels.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), keywords: zod_1.z.array(zod_1.z.string()),
        schedule: zod_1.z.array(zod_1.z.string()).optional().default(['07:00', '12:00', '18:00']),
        language: zod_1.z.string().optional().default('fr'), categories: zod_1.z.array(zod_1.z.string()).optional(),
        notifyChannels: zod_1.z.array(zod_1.z.string()).optional().describe('in_app | email | telegram | slack'),
    }),
    outputSchema: zod_1.z.object({ configured: zod_1.z.boolean(), message: zod_1.z.string(), nextBriefing: zod_1.z.string() }),
}, async ({ companyId, keywords, schedule, language, categories, notifyChannels }) => {
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/settings`).doc('newsConfig').set({
        keywords, schedule: schedule ?? ['07:00', '12:00', '18:00'], language: language ?? 'fr',
        categories: categories ?? ['business', 'technology', 'world'],
        notifyChannels: notifyChannels ?? ['in_app'],
        enabled: true, updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    const now = new Date();
    const next = (schedule ?? ['07:00', '12:00', '18:00']).map(s => { const [h, m] = s.split(':').map(Number); const t = new Date(); t.setHours(h, m, 0, 0); return t; }).filter(t => t > now).sort((a, b) => a.getTime() - b.getTime());
    return { configured: true, message: `Alertes configurees: ${keywords.join(', ')}. Canaux: ${(notifyChannels ?? ['in_app']).join(', ')}.`, nextBriefing: next[0]?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) ?? 'Demain 07:00' };
});
// ══════════════════════════════════════════════════════════════════════════════
// 5. COMPETITOR TRACKER
// ══════════════════════════════════════════════════════════════════════════════
exports.trackCompetitorTool = genkit_config_1.ai.defineTool({
    name: 'nws_trackCompetitor',
    description: 'Add, list, or analyze tracked competitors.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), action: zod_1.z.enum(['add', 'list', 'analyze']),
        competitorName: zod_1.z.string().optional(), website: zod_1.z.string().optional(), sector: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        competitors: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), name: zod_1.z.string(), website: zod_1.z.string(), sector: zod_1.z.string(), addedAt: zod_1.z.string() })).optional(),
        analysis: zod_1.z.string().optional(), message: zod_1.z.string(),
    }),
}, async ({ companyId, action, competitorName, website, sector }) => {
    const db = (0, firebase_config_1.getFirestore)();
    if (action === 'add' && competitorName) {
        const id = (0, helpers_1.generateId)();
        await db.collection(`companies/${companyId}/competitors`).doc(id).set({
            id, name: competitorName, website: website ?? '', sector: sector ?? '',
            addedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { message: `Concurrent "${competitorName}" ajoute au suivi.` };
    }
    if (action === 'list') {
        const snap = await db.collection(`companies/${companyId}/competitors`).limit(20).get();
        return {
            competitors: snap.docs.map(d => { const data = d.data(); return { id: d.id, name: data['name'] ?? '', website: data['website'] ?? '', sector: data['sector'] ?? '', addedAt: data['addedAt']?.toDate?.()?.toISOString() ?? '' }; }),
            message: `${snap.size} concurrent(s) surveille(s).`,
        };
    }
    if (action === 'analyze' && competitorName) {
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Analyze the competitor "${competitorName}"${sector ? ` in the ${sector} sector` : ''}. Provide: strengths, weaknesses, recent moves, threats, opportunities. In French. 3-4 paragraphs.`,
            config: { temperature: 0.3 },
        });
        return { analysis: text, message: `Analyse de ${competitorName} generee.` };
    }
    return { message: 'Action non reconnue.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// 6. SENTIMENT ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════
exports.analyzeSentimentTool = genkit_config_1.ai.defineTool({
    name: 'nws_analyzeSentiment',
    description: 'Analyze news sentiment around a topic, company, or sector.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), topic: zod_1.z.string(), language: zod_1.z.string().optional().default('fr') }),
    outputSchema: zod_1.z.object({
        topic: zod_1.z.string(), overallSentiment: zod_1.z.string(), score: zod_1.z.number(),
        breakdown: zod_1.z.object({ positive: zod_1.z.number(), negative: zod_1.z.number(), neutral: zod_1.z.number() }),
        keyThemes: zod_1.z.array(zod_1.z.string()), summary: zod_1.z.string(),
    }),
}, async ({ companyId, topic, language }) => {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Analyze the current news sentiment around "${topic}" in ${language === 'fr' ? 'French' : 'English'}.
Return JSON: {"topic":"...","overallSentiment":"positive|negative|neutral|mixed","score":0.7,"breakdown":{"positive":60,"negative":25,"neutral":15},"keyThemes":["theme1","theme2","theme3"],"summary":"2-3 sentences"}
Return ONLY JSON.`,
        config: { temperature: 0.2 },
    });
    try {
        return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch {
        return { topic, overallSentiment: 'neutral', score: 0.5, breakdown: { positive: 33, negative: 33, neutral: 34 }, keyThemes: [], summary: 'Analyse indisponible.' };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 7. TRENDING TOPICS
// ══════════════════════════════════════════════════════════════════════════════
exports.getTrendingTool = genkit_config_1.ai.defineTool({
    name: 'nws_getTrending',
    description: 'Get trending topics — what is rising or falling in news coverage.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), sector: zod_1.z.string().optional(), language: zod_1.z.string().optional().default('fr') }),
    outputSchema: zod_1.z.object({
        trending: zod_1.z.array(zod_1.z.object({ topic: zod_1.z.string(), direction: zod_1.z.string(), momentum: zod_1.z.number(), category: zod_1.z.string(), summary: zod_1.z.string() })),
    }),
}, async ({ companyId, sector, language }) => {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Identify the top 8 trending topics in news right now${sector ? ` for the ${sector} sector` : ''} in ${language === 'fr' ? 'French' : 'English'}.
For each: topic name, direction (rising|stable|falling), momentum (0-100), category, one-sentence summary.
Return JSON: {"trending":[{"topic":"...","direction":"rising","momentum":85,"category":"technology","summary":"..."}]}
Return ONLY JSON.`,
        config: { temperature: 0.3 },
    });
    try {
        return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch {
        return { trending: [] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 8. BOOKMARK ARTICLE
// ══════════════════════════════════════════════════════════════════════════════
exports.bookmarkArticleTool = genkit_config_1.ai.defineTool({
    name: 'nws_bookmarkArticle',
    description: 'Save/bookmark a news article for later reference.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), userId: zod_1.z.string().optional(), title: zod_1.z.string(), summary: zod_1.z.string(), source: zod_1.z.string(), url: zod_1.z.string().optional(), notes: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ bookmarkId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, userId, title, summary, source, url, notes }) => {
    const id = (0, helpers_1.generateId)();
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/newsBookmarks`).doc(id).set({
        id, userId: userId ?? null, title, summary, source, url: url ?? null, notes: notes ?? '',
        savedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { bookmarkId: id, message: `Article "${title}" sauvegarde.` };
});
// ══════════════════════════════════════════════════════════════════════════════
// 9. GENERATE DIGEST
// ══════════════════════════════════════════════════════════════════════════════
exports.generateDigestTool = genkit_config_1.ai.defineTool({
    name: 'nws_generateDigest',
    description: 'Generate a newsletter/email digest from recent news briefings.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), period: zod_1.z.enum(['daily', 'weekly']).optional().default('daily'), language: zod_1.z.string().optional().default('fr') }),
    outputSchema: zod_1.z.object({ subject: zod_1.z.string(), htmlContent: zod_1.z.string(), articleCount: zod_1.z.number() }),
}, async ({ companyId, period, language }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const days = period === 'weekly' ? 7 : 1;
    const cutoff = new Date(Date.now() - days * 86400000);
    const snap = await db.collection(`companies/${companyId}/newsBriefings`).orderBy('createdAt', 'desc').limit(period === 'weekly' ? 20 : 5).get();
    const allArticles = [];
    snap.docs.forEach(d => { const arts = d.data()['articles'] ?? []; allArticles.push(...arts); });
    if (allArticles.length === 0)
        return { subject: 'Aucun article', htmlContent: '<p>Aucun article recent.</p>', articleCount: 0 };
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
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
    }
    catch {
        return { subject: `Digest ${period} — ${new Date().toLocaleDateString('fr-FR')}`, htmlContent: `<h1>News Digest</h1>${allArticles.slice(0, 10).map(a => `<h3>${a.title}</h3><p>${a.summary}</p><small>${a.source}</small>`).join('')}`, articleCount: allArticles.length };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════
const ALL_TOOLS = [
    exports.fetchNewsTool, exports.companyNewsTool, exports.newsBriefingHistoryTool, exports.newsAlertSetupTool,
    exports.trackCompetitorTool, exports.analyzeSentimentTool, exports.getTrendingTool, exports.bookmarkArticleTool, exports.generateDigestTool,
];
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({ response: zod_1.z.string(), topHeadline: zod_1.z.string().optional(), articleCount: zod_1.z.number(), briefingId: zod_1.z.string().optional() });
exports.newsAgentFlow = genkit_config_1.ai.defineFlow({ name: 'newsAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, userId, language, history }) => {
    logger_1.logger.info(`[NewsAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
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
        const db = (0, firebase_config_1.getFirestore)();
        const c = await db.collection('companies').doc(companyId).get();
        sector = c.data()?.['sector'] ?? c.data()?.['industry'] ?? '';
        companyName = c.data()?.['name'] ?? '';
    }
    catch { /* ignore */ }
    const executors = new Map();
    for (const tool of ALL_TOOLS) {
        const name = tool.__action?.name ?? '';
        if (name)
            executors.set(name, (i) => tool({ ...i, companyId, userId }));
    }
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20)) {
            messages.push({ role: h.role, content: [{ text: h.content }] });
        }
    }
    messages.push({ role: 'user', content: [{ text: request }] });
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
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
    let loopCount = 0;
    let topHeadline;
    let articleCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 6) {
        loopCount++;
        const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            const exec = executors.get(name);
            const output = exec ? await exec(input) : { error: `Unknown tool: ${name}` };
            if (name === 'nws_fetchNews' && output && typeof output === 'object') {
                const o = output;
                topHeadline = o.topHeadline;
                articleCount = o.articles?.length ?? 0;
            }
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            messages: [...response.messages, { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
            tools: ALL_TOOLS, config: { temperature: 0.3 },
        });
    }
    return { response: response.text, topHeadline, articleCount };
});
async function runScheduledNewsBriefing(companyId, language = 'fr') {
    logger_1.logger.info(`[NewsAgent] Scheduled briefing for company ${companyId}`);
    const db = (0, firebase_config_1.getFirestore)();
    const configDoc = await db.collection(`companies/${companyId}/settings`).doc('newsConfig').get();
    const config = configDoc.data() ?? {};
    const topics = config['keywords'] ?? ['breaking news', 'business', 'technology'];
    try {
        await (0, exports.newsAgentFlow)({ request: `Deliver the scheduled news briefing. Topics: ${topics.join(', ')}.`, companyId, language: config['language'] ?? language });
    }
    catch (err) {
        logger_1.logger.error(`[NewsAgent] Briefing failed for ${companyId}`, { error: err });
    }
}
exports.newsAgentTool = genkit_config_1.ai.defineTool({
    name: 'callNewsAgent',
    description: 'News Intelligence PRO: breaking news, sector watch, competitor tracking & analysis, sentiment analysis, trending topics, keyword alerts, bookmarks, email digests.',
    inputSchema: INPUT, outputSchema: OUTPUT,
}, (input) => (0, exports.newsAgentFlow)(input));
//# sourceMappingURL=news.agent.js.map