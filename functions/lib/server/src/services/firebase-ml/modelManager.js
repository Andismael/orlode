"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelManager = exports.ModelManager = void 0;
const logger_1 = require("../../utils/logger");
// ── ModelManager ──────────────────────────────────────────────────────────────
//
// Placeholder / stub for future TFLite custom model deployment via Firebase ML.
// When Firebase ML custom model hosting is enabled for the project, this class
// will be extended to interact with the Firebase ML Admin API.
class ModelManager {
    /**
     * List all models that are tracked in this system.
     * Currently returns a hardcoded list of active AI backends.
     */
    async listDeployedModels() {
        logger_1.logger.debug('[ModelManager] listDeployedModels called (stub)');
        return [
            {
                id: 'gemini-3-pro',
                name: 'Gemini 3 Pro',
                version: 'gemini-3-pro',
                framework: 'gemini',
                status: 'deployed',
                description: 'Raisonnement complexe, Q&A, analyse stratégique, résumés réunions',
            },
            {
                id: 'gemini-3-flash',
                name: 'Gemini 3 Flash',
                version: 'gemini-3-flash',
                framework: 'gemini',
                status: 'deployed',
                description: 'Classification, OCR, extraction d\'entités, traduction, réunions',
            },
            {
                id: 'gemini-3.1-flash-lite',
                name: 'Gemini 3.1 Flash Lite',
                version: 'gemini-3.1-flash-lite',
                framework: 'gemini',
                status: 'deployed',
                description: 'Labeling d\'images, détection de langue — ultra low-cost',
            },
        ];
    }
    /**
     * Get the status of a specific model by ID.
     */
    async getModelStatus(modelId) {
        logger_1.logger.debug(`[ModelManager] getModelStatus called for ${modelId} (stub)`);
        const models = await this.listDeployedModels();
        const found = models.find((m) => m.id === modelId);
        if (!found) {
            logger_1.logger.warn(`[ModelManager] Model ${modelId} not found`);
            return 'failed';
        }
        return found.status;
    }
}
exports.ModelManager = ModelManager;
exports.modelManager = new ModelManager();
//# sourceMappingURL=modelManager.js.map