"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Social AI — autopilot endpoints powering the composer's AI buttons.
 *
 *   POST /api/social/ai/adapt           — text → per-platform versions
 *   POST /api/social/ai/variants        — text → 3 alternative angles
 *   POST /api/social/ai/hashtags        — text → suggested hashtags
 *   POST /api/social/ai/brief-to-posts  — one-line idea → full post per platform
 *   POST /api/social/ai/score           — text → viral score 0-100 + suggestions
 *   POST /api/social/ai/optimize-sales  — text → conversion-tuned rewrite
 *
 * All endpoints are authenticated + admin-only and run through Gemini Flash.
 * Cost per call ≈ 0.001-0.01 € — fast enough for interactive use.
 */
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const adminOnly_middleware_1 = require("../middleware/adminOnly.middleware");
const asyncHandler_1 = require("../utils/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const geminiService_1 = require("../services/ai/geminiService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.use(adminOnly_middleware_1.adminOnlyMiddleware);
// ── Shared types ─────────────────────────────────────────────────────────────
const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'youtube'];
const PLATFORM_RULES = {
    facebook: { charLimit: 5000, tone: 'conversational, story-driven', format: 'paragraphs OK, emoji modérés, lien en fin' },
    instagram: { charLimit: 2200, tone: 'visual, hook-first, emoji-friendly', format: 'hook ligne 1, body court, hashtags en fin' },
    linkedin: { charLimit: 3000, tone: 'professional, insight-driven, value', format: 'hook fort, structure scannable, peu d\'emoji' },
    twitter: { charLimit: 280, tone: 'punchy, direct, viral hook', format: 'une idée, 1-2 emoji max, pas de fluff' },
    tiktok: { charLimit: 150, tone: 'casual, hook-first, gen-Z', format: 'ultra court, 2-3 hashtags trending, emoji' },
    youtube: { charLimit: 100, tone: 'curiosity-gap title, click-worthy', format: 'titre court, mots-clés SEO, pas de spoiler' },
};
function parsePlatforms(input) {
    if (!Array.isArray(input))
        return [];
    return input.filter((p) => typeof p === 'string' && PLATFORMS.includes(p));
}
/** Strip ```json fences and parse. Throws on garbage so callers can return 502. */
function parseJsonBlob(raw, schema) {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    return schema.parse(JSON.parse(cleaned));
}
// ── POST /adapt ──────────────────────────────────────────────────────────────
// Adapt one text to several platforms (length, tone, format).
const adaptSchema = zod_1.z.object({
    perPlatform: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
});
router.post('/adapt', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { text, platforms } = req.body;
    if (!text?.trim())
        throw new error_middleware_1.AppError('text required', 400);
    const targets = parsePlatforms(platforms);
    if (targets.length === 0)
        throw new error_middleware_1.AppError('platforms required (at least one)', 400);
    const rules = targets.map(p => `- ${p} (max ${PLATFORM_RULES[p].charLimit} chars, ton: ${PLATFORM_RULES[p].tone}, format: ${PLATFORM_RULES[p].format})`).join('\n');
    const prompt = `Tu es un community manager expert. Adapte le post ci-dessous pour CHAQUE plateforme demandée. Garde le sens, change le ton, la longueur et le format selon les règles. Détecte la langue du post et garde-la.

Plateformes:
${rules}

Post original:
"""
${text.trim()}
"""

Réponds en JSON STRICT, sans texte avant ou après:
{ "perPlatform": { ${targets.map(p => `"${p}": "version adaptée"`).join(', ')} } }`;
    try {
        const raw = await geminiService_1.geminiService.generate(prompt, { temperature: 0.7, maxOutputTokens: 1500 });
        const out = parseJsonBlob(raw, adaptSchema);
        res.json({ success: true, data: out.perPlatform });
    }
    catch (err) {
        logger_1.logger.warn('[social-ai] adapt failed', { err: String(err) });
        throw new error_middleware_1.AppError('AI adaptation failed', 502);
    }
}));
// ── POST /variants ───────────────────────────────────────────────────────────
// Generate 3 different angles for the same idea.
const variantsSchema = zod_1.z.object({
    variants: zod_1.z.array(zod_1.z.object({ angle: zod_1.z.string(), text: zod_1.z.string() })).min(1),
});
router.post('/variants', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { text, platform } = req.body;
    if (!text?.trim())
        throw new error_middleware_1.AppError('text required', 400);
    const platformHint = platform && PLATFORM_RULES[platform]
        ? `Cible: ${platform} (max ${PLATFORM_RULES[platform].charLimit} chars, ton: ${PLATFORM_RULES[platform].tone})`
        : 'Cible: post social générique, max 500 chars';
    const prompt = `Tu es un copywriter. Génère 3 VARIANTES du post ci-dessous, chacune avec un angle différent: une orientée bénéfice client, une provocante/curiosité, une story-driven (anecdote courte). Garde la langue d'origine.

${platformHint}

Post original:
"""
${text.trim()}
"""

Réponds en JSON STRICT:
{ "variants": [
  { "angle": "bénéfice", "text": "..." },
  { "angle": "curiosité", "text": "..." },
  { "angle": "story", "text": "..." }
] }`;
    try {
        const raw = await geminiService_1.geminiService.generate(prompt, { temperature: 0.85, maxOutputTokens: 1500 });
        const out = parseJsonBlob(raw, variantsSchema);
        res.json({ success: true, data: out.variants });
    }
    catch (err) {
        logger_1.logger.warn('[social-ai] variants failed', { err: String(err) });
        throw new error_middleware_1.AppError('AI variants failed', 502);
    }
}));
// ── POST /hashtags ───────────────────────────────────────────────────────────
const hashtagsSchema = zod_1.z.object({
    hashtags: zod_1.z.array(zod_1.z.string()).min(1),
});
router.post('/hashtags', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { text, platform } = req.body;
    if (!text?.trim())
        throw new error_middleware_1.AppError('text required', 400);
    const target = platform ?? 'instagram';
    const count = target === 'twitter' ? 3 : target === 'tiktok' ? 5 : 10;
    const prompt = `Suggère ${count} hashtags pertinents pour ce post sur ${target}. Mix: 30% larges (volume), 50% ciblés (niche), 20% trending si pertinent. Pas de # dans la sortie. Garde la langue d'origine quand pertinent. Réponds en JSON STRICT:
{ "hashtags": ["mot1", "mot2", ...] }

Post:
"""
${text.trim()}
"""`;
    try {
        const raw = await geminiService_1.geminiService.generate(prompt, { temperature: 0.4, maxOutputTokens: 400 });
        const out = parseJsonBlob(raw, hashtagsSchema);
        // strip leading # just in case the model included them
        const cleaned = out.hashtags.map(h => h.replace(/^#+/, '').trim()).filter(Boolean);
        res.json({ success: true, data: cleaned });
    }
    catch (err) {
        logger_1.logger.warn('[social-ai] hashtags failed', { err: String(err) });
        throw new error_middleware_1.AppError('AI hashtags failed', 502);
    }
}));
// ── POST /brief-to-posts ─────────────────────────────────────────────────────
// One-line idea → fully-formed post per platform.
const briefSchema = zod_1.z.object({
    perPlatform: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
        text: zod_1.z.string(),
        hashtags: zod_1.z.array(zod_1.z.string()),
        imagePrompt: zod_1.z.string().optional(),
        cta: zod_1.z.string().optional(),
    })),
});
router.post('/brief-to-posts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { brief, platforms, businessContext, language } = req.body;
    if (!brief?.trim())
        throw new error_middleware_1.AppError('brief required', 400);
    const targets = parsePlatforms(platforms);
    if (targets.length === 0)
        throw new error_middleware_1.AppError('platforms required', 400);
    const rules = targets.map(p => `- ${p}: max ${PLATFORM_RULES[p].charLimit} chars, ton ${PLATFORM_RULES[p].tone}, ${PLATFORM_RULES[p].format}`).join('\n');
    const ctxLine = businessContext?.trim() ? `\nContexte business:\n${businessContext.trim()}\n` : '';
    const langLine = language ? `\nLangue cible: ${language}` : '\nLangue: garde celle du brief';
    const prompt = `Tu es un growth marketer. À partir d'un brief court, génère un post complet pour CHAQUE plateforme demandée: hook fort, CTA clair, hashtags adaptés, idée d'image. Pas de bla-bla générique, sois spécifique.${ctxLine}${langLine}

Plateformes:
${rules}

Brief:
"""
${brief.trim()}
"""

Réponds en JSON STRICT, sans texte avant ou après:
{ "perPlatform": { ${targets.map(p => `"${p}": { "text": "post complet", "hashtags": ["a","b"], "imagePrompt": "description visuelle pour DALL-E/Midjourney", "cta": "phrase CTA" }`).join(', ')} } }`;
    try {
        const raw = await geminiService_1.geminiService.generate(prompt, { temperature: 0.75, maxOutputTokens: 2000 });
        const out = parseJsonBlob(raw, briefSchema);
        res.json({ success: true, data: out.perPlatform });
    }
    catch (err) {
        logger_1.logger.warn('[social-ai] brief failed', { err: String(err) });
        throw new error_middleware_1.AppError('AI brief generation failed', 502);
    }
}));
// ── POST /score ──────────────────────────────────────────────────────────────
// Predict viral score + engagement + concrete improvement suggestions.
const scoreSchema = zod_1.z.object({
    viralScore: zod_1.z.number().min(0).max(100),
    engagementProbability: zod_1.z.number().min(0).max(100),
    hookStrength: zod_1.z.number().min(0).max(100),
    ctaClarity: zod_1.z.number().min(0).max(100),
    strengths: zod_1.z.array(zod_1.z.string()),
    weaknesses: zod_1.z.array(zod_1.z.string()),
    suggestions: zod_1.z.array(zod_1.z.string()),
});
router.post('/score', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { text, platform } = req.body;
    if (!text?.trim())
        throw new error_middleware_1.AppError('text required', 400);
    const target = platform && PLATFORM_RULES[platform] ? platform : 'instagram';
    const rules = PLATFORM_RULES[target];
    const prompt = `Tu es un analyste social media senior. Évalue ce post pour ${target} (${rules.tone}). Sois exigeant et concret — pas de flatterie. Note 0-100 sur 4 axes, liste 1-3 forces, 1-3 faiblesses, 2-4 suggestions actionnables.

Post:
"""
${text.trim()}
"""

Réponds en JSON STRICT:
{
  "viralScore": 0-100,
  "engagementProbability": 0-100,
  "hookStrength": 0-100,
  "ctaClarity": 0-100,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."]
}`;
    try {
        const raw = await geminiService_1.geminiService.generate(prompt, { temperature: 0.3, maxOutputTokens: 800 });
        const out = parseJsonBlob(raw, scoreSchema);
        res.json({ success: true, data: out });
    }
    catch (err) {
        logger_1.logger.warn('[social-ai] score failed', { err: String(err) });
        throw new error_middleware_1.AppError('AI scoring failed', 502);
    }
}));
// ── POST /optimize-sales ─────────────────────────────────────────────────────
// Rewrite for conversion: tighten hook, add urgency, sharpen CTA.
const optimizeSchema = zod_1.z.object({
    optimized: zod_1.z.string(),
    changes: zod_1.z.array(zod_1.z.string()),
});
router.post('/optimize-sales', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { text, platform, offer } = req.body;
    if (!text?.trim())
        throw new error_middleware_1.AppError('text required', 400);
    const target = platform && PLATFORM_RULES[platform] ? platform : 'facebook';
    const rules = PLATFORM_RULES[target];
    const offerLine = offer?.trim() ? `\nOffre/produit à pousser: ${offer.trim()}` : '';
    const prompt = `Tu es un direct-response copywriter. Réécris ce post pour MAXIMISER la conversion sur ${target} (max ${rules.charLimit} chars). Applique: hook plus fort, bénéfice tangible, urgence/rareté légère, CTA explicite. Garde la langue d'origine. Pas de hype mensongère.${offerLine}

Post original:
"""
${text.trim()}
"""

Réponds en JSON STRICT:
{
  "optimized": "version optimisée prête à poster",
  "changes": ["liste 2-4 changements clés appliqués"]
}`;
    try {
        const raw = await geminiService_1.geminiService.generate(prompt, { temperature: 0.6, maxOutputTokens: 1200 });
        const out = parseJsonBlob(raw, optimizeSchema);
        res.json({ success: true, data: out });
    }
    catch (err) {
        logger_1.logger.warn('[social-ai] optimize-sales failed', { err: String(err) });
        throw new error_middleware_1.AppError('AI optimization failed', 502);
    }
}));
exports.default = router;
//# sourceMappingURL=socialAi.routes.js.map