import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { env } from './env.config';
import { logger } from '../utils/logger';

// Only initialize Genkit plugins if Google AI is configured
const plugins = [];

if (env.GOOGLE_AI_API_KEY) {
  plugins.push(googleAI({ apiKey: env.GOOGLE_AI_API_KEY }));
  logger.info('[Genkit] Google AI (Gemini) plugin enabled');
} else {
  logger.warn('[Genkit] GOOGLE_AI_API_KEY not set — Genkit/Gemini features disabled. Set GOOGLE_AI_API_KEY to enable.');
}

export const ai = genkit({
  plugins,
  model: 'googleai/gemini-2.5-flash',
});

// Processing rapide — OCR, classification, entités, traduction, réunions
export const GEMINI_FLASH = 'googleai/gemini-2.5-flash';

// Raisonnement lourd — orchestrator, complex agents
export const GEMINI_PRO = 'googleai/gemini-2.5-flash';

// Ultra low-cost — labeling, détection de langue, tâches simples
export const GEMINI_FLASH_LITE = 'googleai/gemini-2.5-flash';

export const TEXT_EMBEDDING_MODEL = 'googleai/gemini-embedding-001';
