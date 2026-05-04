"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnthropicClient = getAnthropicClient;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const env_config_1 = require("./env.config");
const logger_1 = require("../utils/logger");
let anthropicClient;
function getAnthropicClient() {
    if (!anthropicClient) {
        anthropicClient = new sdk_1.default({
            apiKey: env_config_1.env.ANTHROPIC_API_KEY,
        });
        logger_1.logger.info('Anthropic client initialized');
    }
    return anthropicClient;
}
//# sourceMappingURL=claude.config.js.map