"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkItem = createWorkItem;
/**
 * Work Item Service
 * Every agent action creates a work item for the activity feed
 * Work items are the bridge between "agent did something" and "user sees the result"
 */
const firebase_config_1 = require("../config/firebase.config");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
async function createWorkItem(input) {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    try {
        await db.collection(`companies/${input.companyId}/workItems`).doc(id).set({
            ...input,
            id,
            createdAt: new Date(),
        });
        logger_1.logger.info(`[WorkItem] Created: ${input.type} — ${input.title}`);
    }
    catch (err) {
        logger_1.logger.error('[WorkItem] Failed to create', { error: err });
    }
    return id;
}
//# sourceMappingURL=workItemService.js.map