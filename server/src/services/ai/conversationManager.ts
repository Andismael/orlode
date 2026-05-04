import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';
import type { Message, Conversation } from '../../models/Conversation';
import type { ClaudeMessage } from './claudeService'; // ClaudeMessage = { role, content } — interface générique
import { generateId } from '../../utils/helpers';

const MAX_HISTORY_MESSAGES = 20;
const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const db = getFirestore();
  const doc = await db.collection(CONVERSATIONS_COLLECTION).doc(conversationId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Conversation;
}

export async function createConversation(
  companyId: string,
  userId: string,
  title: string
): Promise<Conversation> {
  const db = getFirestore();
  const id = generateId();
  const now = new Date();

  const conversation: Omit<Conversation, 'id'> = {
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

export async function getConversationHistory(conversationId: string): Promise<Message[]> {
  const db = getFirestore();
  const snapshot = await db
    .collection(CONVERSATIONS_COLLECTION)
    .doc(conversationId)
    .collection(MESSAGES_COLLECTION)
    .orderBy('createdAt', 'asc')
    .limitToLast(MAX_HISTORY_MESSAGES)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message));
}

export async function saveMessage(
  conversationId: string,
  message: Omit<Message, 'id'>
): Promise<Message> {
  const db = getFirestore();
  const id = generateId();

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

async function getConversationMessageCount(conversationId: string): Promise<number> {
  const db = getFirestore();
  const doc = await db.collection(CONVERSATIONS_COLLECTION).doc(conversationId).get();
  return (doc.data()?.messageCount as number | undefined) ?? 0;
}

/**
 * Format messages for Gemini API (trim to last N messages).
 */
export function formatHistoryForClaude(messages: Message[]): ClaudeMessage[] {
  // Take last MAX_HISTORY_MESSAGES, ensure alternating user/assistant
  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);

  return trimmed
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

/**
 * Format history as a text string for use in system prompts.
 */
export function formatHistoryAsText(messages: Message[]): string {
  if (messages.length === 0) return '';
  return messages
    .slice(-10) // Last 5 exchanges
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Orlode'}: ${m.content}`)
    .join('\n');
}

export async function listConversations(
  companyId: string,
  userId?: string,
  limit = 50
): Promise<Conversation[]> {
  const db = getFirestore();
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
    .map((doc) => ({ id: doc.id, ...doc.data() } as Conversation))
    .sort((a, b) => {
      const aTime = (a.updatedAt instanceof Date ? a.updatedAt : (a.updatedAt as unknown as { toDate(): Date })?.toDate?.())?.getTime() ?? 0;
      const bTime = (b.updatedAt instanceof Date ? b.updatedAt : (b.updatedAt as unknown as { toDate(): Date })?.toDate?.())?.getTime() ?? 0;
      return bTime - aTime;
    });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const db = getFirestore();
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
  logger.info(`Deleted conversation ${conversationId}`);
}
