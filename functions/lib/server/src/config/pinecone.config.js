"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPineconeClient = getPineconeClient;
exports.getPineconeIndex = getPineconeIndex;
const pinecone_1 = require("@pinecone-database/pinecone");
const env_config_1 = require("./env.config");
const logger_1 = require("../utils/logger");
let pineconeClient;
function getPineconeClient() {
    if (!pineconeClient) {
        pineconeClient = new pinecone_1.Pinecone({
            apiKey: env_config_1.env.PINECONE_API_KEY,
        });
        logger_1.logger.info('Pinecone client initialized');
    }
    return pineconeClient;
}
function getPineconeIndex() {
    const client = getPineconeClient();
    return client.index(env_config_1.env.PINECONE_INDEX_NAME);
}
//# sourceMappingURL=pinecone.config.js.map