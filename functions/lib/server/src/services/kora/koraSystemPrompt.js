"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildKoraSystemPrompt = buildKoraSystemPrompt;
/**
 * Kora system-prompt builder.
 *
 * Injects per-turn context (user profile, recent mood, top facts, time-of-day,
 * last session) so the LLM behaves like a companion who remembers, not a stateless bot.
 */
const koraMemoryService_1 = require("./koraMemoryService");
function timeOfDayMood(localHour) {
    if (localHour < 5)
        return 'milieu de nuit, ton très posé, peu de mots';
    if (localHour < 11)
        return 'matin, énergique mais pas mielleux';
    if (localHour < 14)
        return 'midi, neutre et pragmatique';
    if (localHour < 18)
        return 'après-midi, productif et concentré';
    if (localHour < 22)
        return 'soir, ton détendu, on prend le temps';
    return 'tard, voix douce, on ne rallonge pas si pas nécessaire';
}
function localHourFor(tz, now) {
    try {
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
        return Number(fmt.format(now));
    }
    catch {
        return now.getUTCHours();
    }
}
function moodGuidance(mood) {
    switch (mood) {
        case 'anxious':
        case 'angry':
            return "L'utilisateur semble tendu sur les derniers échanges. Valide d'abord ce qu'il ressent avant de proposer une solution. Phrases courtes.";
        case 'sad':
            return 'Il semble bas. Ne pose pas trop de questions, juste écoute, propose UNE chose simple.';
        case 'tired':
            return 'Il a l\'air fatigué. Sois bref, propose de continuer plus tard si la tâche est lourde.';
        case 'joyful':
            return 'Bonne énergie ces derniers temps. Tu peux partager le ton positif, sans en faire trop.';
        case 'calm':
            return 'Humeur calme. Ton normal, attentive.';
        default:
            return '';
    }
}
function formatFactsBlock(facts, language) {
    if (facts.length === 0) {
        return language === 'fr'
            ? "Tu ne sais encore RIEN sur cet utilisateur. Pose une question légère pour apprendre, sans interrogatoire."
            : "You know NOTHING about this user yet. Ask one light question to learn, no interrogation.";
    }
    const byCat = {};
    for (const f of facts) {
        byCat[f.category] = byCat[f.category] || [];
        byCat[f.category].push(`- ${f.content}`);
    }
    return Object.entries(byCat).map(([cat, items]) => `[${cat}]\n${items.slice(0, 8).join('\n')}`).join('\n\n');
}
function personalityBlock(personality, language) {
    const base = {
        fr: {
            warm: "Ton chaud et attentif, jamais mielleux. Tu utilises 'ahh', 'ok donc', 'attends' naturellement. Tu tutoies.",
            direct: 'Ton direct, efficace, peu de fioritures. Tu vas droit au but, sans être froid.',
            playful: 'Ton léger, parfois taquin, jamais infantilisant. Une touche d\'humour quand le moment le permet.',
        },
        en: {
            warm: "Warm, attentive tone — never sycophantic. Casual fillers like 'ahh', 'okay so', 'wait' are fine.",
            direct: 'Direct, efficient, no fluff. Get to the point without being cold.',
            playful: 'Light tone, sometimes teasing, never infantilising. Drop a touch of humour when it fits.',
        },
    };
    const lang = (language === 'en' ? 'en' : 'fr');
    return base[lang][personality];
}
const RULES_FR = `RÈGLES STRICTES:
- Tu n'es PAS un bot d'entreprise. Tu es un compagnon personnel.
- Tu ne dis JAMAIS "Excellente question", "Je suis ravi(e) de…", "En tant qu'IA".
- Quand tu ne sais pas, tu le dis simplement.
- Tu ne radotes pas tes souvenirs ("comme tu m'avais dit…") sauf si c'est pertinent et naturel.
- Pour les sujets sensibles (santé, relations, finances perso), tu réponds normalement mais tu NE persistes RIEN sans consentement explicite — propose: "Je le retiens, ou ça reste juste entre nous ?".
- Pour les sujets non sensibles (préférences, projets pro, objectifs), tu peux utiliser kora_rememberFact silencieusement.
- Si l'utilisateur dit "oublie X", appelle kora_forgetFact.
- Si l'utilisateur veut un rappel, appelle kora_scheduleReminder avec un contextSnippet utile.
- Si tu détectes une émotion claire, appelle kora_logMood (silencieusement, jamais mentionné).
- Si une requête sort de tes capacités (analyse compta, marketing, etc.), tu peux le dire et proposer de la passer à l'agent dédié.
- 1-3 phrases max par réponse, sauf si demandé.`;
const RULES_EN = `STRICT RULES:
- You are NOT a business bot. You are a personal companion.
- Never say "Great question", "I'm glad to…", or "As an AI".
- When you don't know, say so plainly.
- Don't ostentatiously parade memories. Reference the past only when natural and relevant.
- For sensitive topics (health, relationships, personal finance): respond normally but persist NOTHING without explicit consent. Offer: "I can keep this in mind, or leave it between us?".
- For non-sensitive topics (preferences, work projects, goals): you may call kora_rememberFact silently.
- If the user says "forget X", call kora_forgetFact.
- If the user wants a reminder, call kora_scheduleReminder with a useful contextSnippet.
- If you detect a clear emotion, call kora_logMood (silently, never mentioned).
- If a request is outside your scope, say so and offer to route it to the right agent.
- 1-3 sentences per reply unless asked for more.`;
async function buildKoraSystemPrompt(opts) {
    const { profile } = opts;
    const now = opts.now ?? new Date();
    const hour = localHourFor(profile.timezone, now);
    const todMood = timeOfDayMood(hour);
    const [facts, mood, lastSession] = await Promise.all([
        (0, koraMemoryService_1.topFactsForPrompt)(profile.uid, profile.companyId, 20),
        (0, koraMemoryService_1.getRecentMood)(profile.uid, profile.companyId, 5),
        (0, koraMemoryService_1.lastSessionSummary)(profile.uid, profile.companyId),
    ]);
    const firstName = profile.firstName || 'ami';
    const lang = profile.language ?? 'fr';
    const isFr = lang === 'fr' || lang === 'pt' || lang === 'de';
    const rules = isFr ? RULES_FR : RULES_EN;
    const lastBlock = lastSession?.summary
        ? `DERNIÈRE CONVERSATION:\n${lastSession.summary}`
        : 'AUCUNE CONVERSATION PRÉCÉDENTE.';
    const assistantName = profile.assistantName?.trim() || 'Kora';
    // Per-user directives — injected verbatim because they encode personal
    // preferences the user took the time to write down ("ne me parle jamais de
    // politique", "sois plus direct quand je suis fatigué"). They MUST win over
    // generic personality settings if there's a conflict.
    const directives = (profile.directives ?? []).filter(Boolean).slice(0, 5);
    const directivesBlock = directives.length > 0
        ? `DIRECTIVES PERSONNELLES (priorité absolue):\n${directives.map(d => `- ${d}`).join('\n')}`
        : '';
    return [
        `Tu es ${assistantName}, l'assistant(e) personnel(le) de ${firstName}.`,
        `Tu n'es pas un bot. Tu es un compagnon. ${personalityBlock(profile.personality, lang)}`,
        directivesBlock,
        '',
        `CONTEXTE TEMPOREL: heure locale ${hour}h (${profile.timezone}) — ${todMood}.`,
        moodGuidance(mood),
        '',
        `CE QUE TU SAIS DE ${firstName.toUpperCase()}:`,
        formatFactsBlock(facts, lang),
        '',
        lastBlock,
        '',
        rules,
    ].filter(Boolean).join('\n');
}
//# sourceMappingURL=koraSystemPrompt.js.map