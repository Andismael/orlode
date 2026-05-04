"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translationService = exports.TranslationService = exports.SUPPORTED_LANGUAGES = void 0;
exports.getLanguageName = getLanguageName;
const geminiService_1 = require("../ai/geminiService");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
// ── Supported languages (BCP-47) ──────────────────────────────────────────────
// Includes African languages relevant for Côte d'Ivoire and African markets
exports.SUPPORTED_LANGUAGES = {
    'fr': 'Français',
    'en': 'English',
    'ar': 'العربية (Arabic)',
    'pt': 'Português',
    'sw': 'Kiswahili (Swahili)', // East Africa
    'ha': 'Hausa', // West Africa (Nigeria, Niger, Chad)
    'yo': 'Yorùbá', // Nigeria, Benin
    'ig': 'Igbo', // Nigeria
    'am': 'አማርኛ (Amharic)', // Ethiopia
    'so': 'Soomaali (Somali)', // Somalia, Kenya
    'rw': 'Kinyarwanda', // Rwanda
    'ln': 'Lingála', // DRC, Congo
    'wo': 'Wolof', // Senegal, Gambia
    'bm': 'Bamanankan (Bambara)', // Mali, Côte d'Ivoire
    'dyu': 'Dioula', // Côte d'Ivoire, Burkina Faso
    'ak': 'Akan / Twi', // Ghana, Côte d'Ivoire
    'mos': 'Mooré', // Burkina Faso
    'ff': 'Fula / Fulfulde', // Sahel belt
    'zu': 'isiZulu', // South Africa
    'xh': 'isiXhosa', // South Africa
    'es': 'Español',
    'de': 'Deutsch',
    'zh': '中文 (Chinese)',
};
// Language name lookup
function getLanguageName(code) {
    return exports.SUPPORTED_LANGUAGES[code] ?? code;
}
// ── TranslationService ────────────────────────────────────────────────────────
class TranslationService {
    /**
     * Translate text to the target language.
     */
    async translate(text, targetLang, sourceLang) {
        if (!env_config_1.env.GOOGLE_AI_API_KEY) {
            logger_1.logger.warn('[TranslationService] GOOGLE_AI_API_KEY not set — translation unavailable');
            return {
                translatedText: text,
                sourceLang: sourceLang ?? 'unknown',
                targetLang,
                wasTranslated: false,
            };
        }
        // Detect source language if not provided
        const detectedLang = sourceLang ?? (await geminiService_1.geminiService.detectLanguage(text));
        // No-op when already in target language
        if (detectedLang === targetLang) {
            return {
                translatedText: text,
                sourceLang: detectedLang,
                targetLang,
                wasTranslated: false,
            };
        }
        try {
            const translatedText = await geminiService_1.geminiService.translate(text, targetLang);
            return {
                translatedText,
                sourceLang: detectedLang,
                targetLang,
                wasTranslated: true,
            };
        }
        catch (err) {
            logger_1.logger.error('[TranslationService] translate failed', { error: err });
            return {
                translatedText: text,
                sourceLang: detectedLang,
                targetLang,
                wasTranslated: false,
            };
        }
    }
    /**
     * Detect the BCP-47 language code of the given text.
     */
    async detectLanguage(text) {
        if (!env_config_1.env.GOOGLE_AI_API_KEY) {
            logger_1.logger.warn('[TranslationService] GOOGLE_AI_API_KEY not set — language detection unavailable');
            return 'unknown';
        }
        return geminiService_1.geminiService.detectLanguage(text);
    }
    /**
     * Translate only if the detected language differs from targetLang.
     */
    async translateIfNeeded(text, targetLang) {
        const detectedLang = await this.detectLanguage(text);
        if (detectedLang === targetLang) {
            return {
                translatedText: text,
                sourceLang: detectedLang,
                targetLang,
                wasTranslated: false,
            };
        }
        return this.translate(text, targetLang, detectedLang);
    }
}
exports.TranslationService = TranslationService;
exports.translationService = new TranslationService();
//# sourceMappingURL=translationService.js.map