"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = exports.AIRouter = void 0;
const geminiService_1 = require("./geminiService");
const logger_1 = require("../../utils/logger");
// 100% Gemini — Flash pour le processing, Pro pour le raisonnement
const ROUTING_TABLE = {
    qa: 'gemini_pro',
    analysis: 'gemini_pro',
    strategy: 'gemini_pro',
    meeting_summary: 'gemini_pro',
    insight: 'gemini_pro',
    ocr: 'gemini_flash',
    classify: 'gemini_flash',
    translate: 'gemini_flash',
    entities: 'gemini_flash',
    transcribe: 'gemini_flash',
};
class AIRouter {
    /** Retourne le backend pour une tâche donnée. */
    route(task) {
        return ROUTING_TABLE[task];
    }
    /** Exécute la tâche sur le bon modèle Gemini. */
    async execute(task, prompt, context) {
        const backend = this.route(task);
        logger_1.logger.debug(`[AIRouter] Task "${task}" → ${backend}`);
        const fullPrompt = context
            ? `${prompt}\n\nContexte pertinent:\n${context}`
            : prompt;
        return geminiService_1.geminiService.generate(fullPrompt);
    }
}
exports.AIRouter = AIRouter;
exports.aiRouter = new AIRouter();
//# sourceMappingURL=aiRouter.js.map