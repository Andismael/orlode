import { geminiService } from '../ai/geminiService';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Supported languages (BCP-47) ──────────────────────────────────────────────
// Includes African languages relevant for Côte d'Ivoire and African markets
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  'fr':    'Français',
  'en':    'English',
  'ar':    'العربية (Arabic)',
  'pt':    'Português',
  'sw':    'Kiswahili (Swahili)',        // East Africa
  'ha':    'Hausa',                      // West Africa (Nigeria, Niger, Chad)
  'yo':    'Yorùbá',                     // Nigeria, Benin
  'ig':    'Igbo',                       // Nigeria
  'am':    'አማርኛ (Amharic)',            // Ethiopia
  'so':    'Soomaali (Somali)',           // Somalia, Kenya
  'rw':    'Kinyarwanda',                // Rwanda
  'ln':    'Lingála',                    // DRC, Congo
  'wo':    'Wolof',                      // Senegal, Gambia
  'bm':    'Bamanankan (Bambara)',        // Mali, Côte d'Ivoire
  'dyu':   'Dioula',                     // Côte d'Ivoire, Burkina Faso
  'ak':    'Akan / Twi',                 // Ghana, Côte d'Ivoire
  'mos':   'Mooré',                      // Burkina Faso
  'ff':    'Fula / Fulfulde',            // Sahel belt
  'zu':    'isiZulu',                    // South Africa
  'xh':    'isiXhosa',                   // South Africa
  'es':    'Español',
  'de':    'Deutsch',
  'zh':    '中文 (Chinese)',
};

// Language name lookup
export function getLanguageName(code: string): string {
  return SUPPORTED_LANGUAGES[code] ?? code;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TranslationResult {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  wasTranslated: boolean;
}

// ── TranslationService ────────────────────────────────────────────────────────

export class TranslationService {
  /**
   * Translate text to the target language.
   */
  async translate(
    text: string,
    targetLang: string,
    sourceLang?: string
  ): Promise<TranslationResult> {
    if (!env.GOOGLE_AI_API_KEY) {
      logger.warn('[TranslationService] GOOGLE_AI_API_KEY not set — translation unavailable');
      return {
        translatedText: text,
        sourceLang: sourceLang ?? 'unknown',
        targetLang,
        wasTranslated: false,
      };
    }

    // Detect source language if not provided
    const detectedLang = sourceLang ?? (await geminiService.detectLanguage(text));

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
      const translatedText = await geminiService.translate(text, targetLang);
      return {
        translatedText,
        sourceLang: detectedLang,
        targetLang,
        wasTranslated: true,
      };
    } catch (err) {
      logger.error('[TranslationService] translate failed', { error: err });
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
  async detectLanguage(text: string): Promise<string> {
    if (!env.GOOGLE_AI_API_KEY) {
      logger.warn('[TranslationService] GOOGLE_AI_API_KEY not set — language detection unavailable');
      return 'unknown';
    }

    return geminiService.detectLanguage(text);
  }

  /**
   * Translate only if the detected language differs from targetLang.
   */
  async translateIfNeeded(text: string, targetLang: string): Promise<TranslationResult> {
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

export const translationService = new TranslationService();
