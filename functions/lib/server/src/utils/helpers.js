"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.sanitizeFilename = sanitizeFilename;
exports.getFileExtension = getFileExtension;
exports.buildMetadataFilter = buildMetadataFilter;
exports.sleep = sleep;
exports.retry = retry;
exports.chunkArray = chunkArray;
exports.estimateTokenCount = estimateTokenCount;
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
function generateId() {
    return (0, uuid_1.v4)();
}
function sanitizeFilename(filename) {
    // Remove path components, keep only basename
    const base = path_1.default.basename(filename);
    // Replace problematic characters
    return base
        .replace(/[^a-zA-Z0-9._\-\s]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
}
function getFileExtension(filename) {
    return path_1.default.extname(filename).toLowerCase().replace('.', '');
}
function buildMetadataFilter(companyId, additionalFilters) {
    const filter = {
        companyId: { $eq: companyId },
    };
    if (additionalFilters) {
        for (const [key, value] of Object.entries(additionalFilters)) {
            filter[key] = { $eq: value };
        }
    }
    return filter;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function retry(fn, maxAttempts = 3, delayMs = 1000, backoff = 2) {
    let lastError = new Error('Retry failed');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < maxAttempts) {
                await sleep(delayMs * Math.pow(backoff, attempt - 1));
            }
        }
    }
    throw lastError;
}
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
function estimateTokenCount(text) {
    // Rough estimate: ~4 chars per token for English, ~3 for French
    return Math.ceil(text.length / 3.8);
}
//# sourceMappingURL=helpers.js.map