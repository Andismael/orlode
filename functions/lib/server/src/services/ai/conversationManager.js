"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversation = getConversation;
exports.createConversation = createConversation;
exports.getConversationHistory = getConversationHistory;
exports.saveMessage = saveMessage;
exports.formatHistoryForClaude = formatHistoryForClaude;
exports.formatHistoryAsText = formatHistoryAsText;
exports.listConversations = listConversations;
exports.deleteConversation = deleteConversation;
const firebase_config_1 = require("../../config/firebase.config");
const logger_1 = require("../../utils/logger");
const helpers_1 = require("../../utils/helpers");
const MAX_HISTORY_MESSAGES = 20;
const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';
async function getConversation(conversationId) {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(CONVERSATIONS_COLLECTION).doc(conversationId).get();
    if (!doc.exists)
        return null;
    return { id: doc.id, ...doc.data() };
}
async function createConversation(companyId, userId, title) {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    const now = new Date();
    const conversation = {
        companyId,
        userId,
        title,
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
    };
    await db.collection(CONVERSATIONS_COLLECTION).doc(id).set(conversation);
    return { id, ...conversation };
}
async function getConversationHistory(conversationId) {
    const db = (0, firebase_config_1.getFirestore)();
    const snapshot = await db
        .collection(CONVERSATIONS_COLLECTION)
        .doc(conversationId)
        .collection(MESSAGES_COLLECTION)
        .orderBy('createdAt', 'asc')
        .limitToLast(MAX_HISTORY_MESSAGES)
        .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
async function saveMessage(conversationId, message) {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db
        .collection(CONVERSATIONS_COLLECTION)
        .doc(conversationId)
        .collection(MESSAGES_COLLECTION)
        .doc(id)
        .set({ ...message, id });
    // Update conversation metadata
    await db.collection(CONVERSATIONS_COLLECTION).doc(conversationId).update({
        messageCount: (await getConversationMessageCount(conversationId)) + 1,
        lastMessage: message.content.slice(0, 100),
        updatedAt: new Date(),
    });
    return { id, ...message };
}
async function getConversationMessageCount(conversationId) {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(CONVERSATIONS_COLLECTION).doc(conversationId).get();
    return doc.data()?.messageCount ?? 0;
}
/**
 * Format messages for Gemini API (trim to last N messages).
 */
function formatHistoryForClaude(messages) {
    // Take last MAX_HISTORY_MESSAGES, ensure alternating user/assistant
    const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
    return trimmed
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
        role: m.role,
        content: m.content,
    }));
}
/**
 * Format history as a text string for use in system prompts.
 */
function formatHistoryAsText(messages) {
    if (messages.length === 0)
        return '';
    return messages
        .slice(-10) // Last 5 exchanges
        .filter((m) => m.role !== 'system')
        .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Orlode'}: ${m.content}`)
        .join('\n');
}
async function listConversations(companyId, userId, limit = 50) {
    const db = (0, firebase_config_1.getFirestore)();
    let query = db
        .collection(CONVERSATIONS_COLLECTION)
        .where('companyId', '==', companyId)
        .limit(limit);
    if (userId) {
        query = db
            .collection(CONVERSATIONS_COLLECTION)
            .where('companyId', '==', companyId)
            .where('userId', '==', userId)
            .limit(limit);
    }
    const snapshot = await query.get();
    return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
        const aTime = (a.updatedAt instanceof Date ? a.updatedAt : a.updatedAt?.toDate?.())?.getTime() ?? 0;
        const bTime = (b.updatedAt instanceof Date ? b.updatedAt : b.updatedAt?.toDate?.())?.getTime() ?? 0;
        return bTime - aTime;
    });
}
async function deleteConversation(conversationId) {
    const db = (0, firebase_config_1.getFirestore)();
    // Delete all messages first
    const messages = await db
        .collection(CONVERSATIONS_COLLECTION)
        .doc(conversationId)
        .collection(MESSAGES_COLLECTION)
        .get();
    const batch = db.batch();
    messages.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(db.collection(CONVERSATIONS_COLLECTION).doc(conversationId));
    await batch.commit();
    logger_1.logger.info(`Deleted conversation ${conversationId}`);
}
//# sourceMappingURL=conversationManager.js.map