"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoGenerationService = exports.VideoGenerationService = void 0;
/**
 * Video Generation Service — Pipeline Vidéo AI Multi-Modèle
 * Modèles : Wan 2.2 (budget), Kling 2.1 (standard), Veo 3 (premium)
 * Le client choisit la qualité — l'IA choisit le modèle optimal.
 */
const logger_1 = require("../../utils/logger");
const PLATFORM_FORMATS = {
    linkedin: { aspectRatio: '16:9', maxDuration: 60, style: 'corporate, sous-titres, professionnel' },
    instagram: { aspectRatio: '9:16', maxDuration: 30, style: 'dynamique, coloré, hook rapide, hashtags' },
    tiktok: { aspectRatio: '9:16', maxDuration: 60, style: 'tendance, rapide, viral' },
    facebook: { aspectRatio: '16:9', maxDuration: 60, style: 'sous-titres, engageant, partage' },
    youtube: { aspectRatio: '16:9', maxDuration: 120, style: 'miniature, description SEO, détaillé' },
    whatsapp: { aspectRatio: '16:9', maxDuration: 30, style: 'léger, compressé, direct' },
};
const MODEL_BY_QUALITY = {
    budget: { model: 'wan', costPer10s: 0.21 },
    standard: { model: 'kling', costPer10s: 0.70 },
    premium: { model: 'veo3', costPer10s: 3.00 },
};
class VideoGenerationService {
    /**
     * Génère des vidéos pour toutes les plateformes.
     * Chaque vidéo est mise en "pending_approval" — jamais publiée automatiquement.
     */
    async generateForPlatforms(req) {
        const modelConfig = MODEL_BY_QUALITY[req.quality];
        const results = [];
        for (const platform of req.platforms) {
            const format = PLATFORM_FORMATS[platform];
            const duration = Math.min(req.duration, format.maxDuration);
            const cost = (duration / 10) * modelConfig.costPer10s;
            try {
                const videoUrl = await this.callVideoAPI({
                    model: modelConfig.model,
                    prompt: req.script,
                    aspectRatio: format.aspectRatio,
                    duration,
                    inputImage: req.inputImageUrl,
                });
                results.push({
                    platform,
                    aspectRatio: format.aspectRatio,
                    videoUrl,
                    caption: `[Généré pour ${platform}] ${req.script.slice(0, 100)}...`,
                    hashtags: [],
                    duration,
                    cost,
                    model: modelConfig.model,
                    status: 'pending_approval',
                });
            }
            catch (err) {
                logger_1.logger.error(`[Video] Failed to generate for ${platform}`, { error: err });
                results.push({
                    platform,
                    aspectRatio: format.aspectRatio,
                    videoUrl: '',
                    caption: '',
                    hashtags: [],
                    duration,
                    cost: 0,
                    model: modelConfig.model,
                    status: 'pending_approval',
                });
            }
        }
        return results;
    }
    /** Coût estimé avant génération */
    estimateCost(quality, duration, platforms) {
        const { costPer10s } = MODEL_BY_QUALITY[quality];
        return platforms.reduce((total, platform) => {
            const maxDur = PLATFORM_FORMATS[platform].maxDuration;
            const dur = Math.min(duration, maxDur);
            return total + (dur / 10) * costPer10s;
        }, 0);
    }
    /** Polling Kling task jusqu'à completion (max 5 min) */
    async pollKlingTask(taskId, apiKey) {
        const MAX_ATTEMPTS = 30; // 30 × 10s = 5 min
        const INTERVAL_MS = 10000;
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await new Promise(r => setTimeout(r, INTERVAL_MS));
            try {
                const res = await fetch(`https://api.piapi.ai/v1/task/${taskId}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                const data = await res.json();
                const status = data.status;
                logger_1.logger.info(`[Video] Kling task ${taskId} — status: ${status} (attempt ${i + 1})`);
                if (status === 'completed' || status === 'succeed') {
                    const url = data.output?.video_url ?? data.video_url;
                    if (url)
                        return url;
                }
                if (status === 'failed' || status === 'error') {
                    throw new Error(`Kling task ${taskId} failed`);
                }
            }
            catch (err) {
                logger_1.logger.warn(`[Video] Kling polling error attempt ${i + 1}`, { error: err });
            }
        }
        throw new Error(`Kling task ${taskId} timed out after 5 minutes`);
    }
    /** Polling Veo3 long-running operation (max 10 min) */
    async pollVeo3Operation(operationName, apiKey) {
        const MAX_ATTEMPTS = 40; // 40 × 15s = 10 min
        const INTERVAL_MS = 15000;
        const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}`;
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await new Promise(r => setTimeout(r, INTERVAL_MS));
            try {
                const res = await fetch(url, {
                    headers: { 'x-goog-api-key': apiKey },
                });
                const data = await res.json();
                logger_1.logger.info(`[Video] Veo3 operation ${operationName} — done: ${data.done} (attempt ${i + 1})`);
                if (data.error)
                    throw new Error(`Veo3 error: ${data.error.message}`);
                if (data.done && data.response?.predictions?.length) {
                    const pred = data.response.predictions[0];
                    // Veo3 may return a URI or base64 — prefer URI
                    if (pred.videoUri)
                        return pred.videoUri;
                    if (pred.bytesBase64Encoded) {
                        // Return as data URI if no direct URL
                        return `data:${pred.mimeType ?? 'video/mp4'};base64,${pred.bytesBase64Encoded}`;
                    }
                }
            }
            catch (err) {
                logger_1.logger.warn(`[Video] Veo3 polling error attempt ${i + 1}`, { error: err });
            }
        }
        throw new Error(`Veo3 operation ${operationName} timed out after 10 minutes`);
    }
    /** Appel à l'API vidéo selon le modèle */
    async callVideoAPI(params) {
        switch (params.model) {
            case 'kling': {
                const apiKey = process.env['PIAPI_API_KEY'] ?? process.env['KLING_API_KEY'] ?? process.env['KLING_ACCESS_KEY'];
                if (!apiKey)
                    throw new Error('KLING_API_KEY / PIAPI_API_KEY not configured');
                const res = await fetch('https://api.piapi.ai/v1/kling/generate', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'kling-v2-master',
                        prompt: params.prompt,
                        aspect_ratio: params.aspectRatio,
                        duration: Math.min(params.duration, 10),
                        mode: 'professional',
                        image_url: params.inputImage ?? undefined,
                    }),
                });
                const data = await res.json();
                if (data.video_url)
                    return data.video_url;
                if (data.task_id)
                    return await this.pollKlingTask(data.task_id, apiKey);
                throw new Error('Kling: no video_url or task_id in response');
            }
            case 'wan': {
                const apiKey = process.env['SILICONFLOW_API_KEY'];
                if (!apiKey)
                    throw new Error('SILICONFLOW_API_KEY not configured');
                const res = await fetch('https://api.siliconflow.cn/v1/video/generate', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'Wan2.2-T2V-A14B',
                        prompt: params.prompt,
                        aspect_ratio: params.aspectRatio,
                    }),
                });
                const data = await res.json();
                return data.video_url ?? '';
            }
            case 'veo3': {
                const apiKey = process.env['GOOGLE_AI_API_KEY'];
                if (!apiKey)
                    throw new Error('GOOGLE_AI_API_KEY not configured');
                const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:predictLongRunning', {
                    method: 'POST',
                    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instances: [{ prompt: params.prompt }],
                        parameters: { aspectRatio: params.aspectRatio, durationSeconds: String(params.duration) },
                    }),
                });
                const data = await res.json();
                if (!data.name)
                    throw new Error('Veo3: no operation name in response');
                return await this.pollVeo3Operation(data.name, apiKey);
            }
            default:
                throw new Error(`Model ${params.model} not supported`);
        }
    }
}
exports.VideoGenerationService = VideoGenerationService;
exports.videoGenerationService = new VideoGenerationService();
//# sourceMappingURL=videoGenerationService.js.map