/**
 * Firebase AI Logic — client-side Gemini wrapper (v2)
 *
 * Uses the `firebase/ai` subpackage (included in firebase@^10.13.0).
 * Provides lightweight AI features that run without a server round-trip.
 *
 * Import pattern: `import { getAI, getGenerativeModel } from 'firebase/ai'`
 *
 * All functions degrade gracefully when VITE_GOOGLE_AI_API_KEY is not set.
 */

import app from './firebase';

// ── Internal helpers ──────────────────────────────────────────────────────────

type GenerativeModel = {
  generateContent: (prompt: string) => Promise<{
    response: { text: () => string };
  }>;
};

let _model: GenerativeModel | null = null;

async function getModel(): Promise<GenerativeModel | null> {
  if (_model) return _model;

  if (!import.meta.env.VITE_GOOGLE_AI_API_KEY) {
    console.warn('[aiLogicService] VITE_GOOGLE_AI_API_KEY not set — client-side AI unavailable');
    return null;
  }

  try {
    const { getAI, getGenerativeModel } = await import('firebase/ai');
    const ai = getAI(app);
    _model = getGenerativeModel(ai, { model: 'gemini-2.0-flash' }) as GenerativeModel;
    return _model;
  } catch (err) {
    console.warn('[aiLogicService] Failed to initialise Firebase AI Logic:', err);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get a Gemini model instance for direct use in components.
 * Returns null if Firebase AI Logic is unavailable.
 */
export async function getClientGemini(): Promise<GenerativeModel | null> {
  return getModel();
}

/**
 * Generate a concise summary of the provided text (client-side, no server round-trip).
 */
export async function quickSummarize(text: string): Promise<string> {
  const model = await getModel();
  if (!model) return '';

  try {
    const result = await model.generateContent(
      `Summarise the following text in 2-3 sentences. Return only the summary.\n\n"""${text.slice(0, 3000)}"""`
    );
    return result.response.text();
  } catch (err) {
    console.error('[aiLogicService] quickSummarize failed:', err);
    return '';
  }
}

/**
 * Detect the language of the given text (returns BCP-47 code, e.g. "en", "fr").
 */
export async function detectLanguage(text: string): Promise<string> {
  const model = await getModel();
  if (!model) return 'unknown';

  try {
    const result = await model.generateContent(
      `Detect the language of the following text. Respond with only the BCP-47 language code (e.g. en, fr, ar). No explanation.\n\n"""${text.slice(0, 500)}"""`
    );
    return result.response.text().trim().toLowerCase().split(/\s/)[0] ?? 'unknown';
  } catch (err) {
    console.error('[aiLogicService] detectLanguage failed:', err);
    return 'unknown';
  }
}

/**
 * Ask a quick question without a server round-trip.
 * Suitable for short, low-context questions only.
 */
export async function quickAsk(question: string): Promise<string> {
  const model = await getModel();
  if (!model) return '';

  try {
    const result = await model.generateContent(question);
    return result.response.text();
  } catch (err) {
    console.error('[aiLogicService] quickAsk failed:', err);
    return '';
  }
}
