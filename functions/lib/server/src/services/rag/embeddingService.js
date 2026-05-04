"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = generateEmbedding;
exports.generateEmbeddings = generateEmbeddings;
const openai_1 = __importDefault(require("openai"));
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
const helpers_1 = require("../../utils/helpers");
let openaiClient;
function getOpenAI() {
    if (!openaiClient) {
        openaiClient = new openai_1.default({ apiKey: env_config_1.env.OPENAI_API_KEY });
    }
    return openaiClient;
}
async function generateEmbedding(text) {
    return (0, helpers_1.retry)(async () => {
        const client = getOpenAI();
        const response = await client.embeddings.create({
            model: env_config_1.env.EMBEDDING_MODEL,
            input: text.replace(/\n/g, ' ').slice(0, 8191), // max input
            dimensions: 1536,
        });
        return response.data[0].embedding;
    }, 3, 1000);
}
async function generateEmbeddings(texts) {
    if (texts.length === 0)
        return [];
    // OpenAI allows up to 100 texts per batch, but we batch by 50 to be safe
    const batches = (0, helpers_1.chunkArray)(texts, 50);
    const allEmbeddings = [];
    for (const batch of batches) {
        const batchEmbeddings = await (0, helpers_1.retry)(async () => {
            const client = getOpenAI();
            const response = await client.embeddings.create({
                model: env_config_1.env.EMBEDDING_MODEL,
                input: batch.map((t) => t.replace(/\n/g, ' ').slice(0, 8191)),
                dimensions: 1536,
            });
            return response.data.map((d) => d.embedding);
        }, 3, 1000);
        allEmbeddings.push(...batchEmbeddings);
        logger_1.logger.debug(`Embedded batch of ${batch.length} texts`);
    }
    return allEmbeddings;
}
//# sourceMappingURL=embeddingService.js.map