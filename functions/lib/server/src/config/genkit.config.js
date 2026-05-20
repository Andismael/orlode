"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEXT_EMBEDDING_MODEL = exports.GEMINI_FLASH_LITE = exports.GEMINI_PRO = exports.GEMINI_FLASH = exports.ai = void 0;
const genkit_1 = require("genkit");
const google_genai_1 = require("@genkit-ai/google-genai");
const env_config_1 = require("./env.config");
const logger_1 = require("../utils/logger");
// Only initialize Genkit plugins if Google AI is configured
const plugins = [];
if (env_config_1.env.GOOGLE_AI_API_KEY) {
    plugins.push((0, google_genai_1.googleAI)({ apiKey: env_config_1.env.GOOGLE_AI_API_KEY }));
    logger_1.logger.info('[Genkit] Google AI (Gemini) plugin enabled');
}
else {
    logger_1.logger.warn('[Genkit] GOOGLE_AI_API_KEY not set — Genkit/Gemini features disabled. Set GOOGLE_AI_API_KEY to enable.');
}
exports.ai = (0, genkit_1.genkit)({
    plugins,
    model: 'googleai/gemini-2.5-flash',
});
// Processing rapide — OCR, classification, entités, traduction, réunions
exports.GEMINI_FLASH = 'googleai/gemini-2.5-flash';
// Raisonnement lourd — orchestrator, complex agents
exports.GEMINI_PRO = 'googleai/gemini-2.5-flash';
// Ultra low-cost — labeling, détection de langue, tâches simples
exports.GEMINI_FLASH_LITE = 'googleai/gemini-2.5-flash';
exports.TEXT_EMBEDDING_MODEL = 'googleai/gemini-embedding-001';
//# sourceMappingURL=genkit.config.js.map