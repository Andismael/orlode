import { Timestamp } from 'firebase-admin/firestore';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageSource {
  documentId: string;
  documentName: string;
  excerpt: string;
  page?: number;
  score?: number;
}

export interface MessageFeedback {
  rating: 'up' | 'down';
  comment?: string;
  submittedAt: Date;
  userId: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  sources?: MessageSource[];
  feedback?: MessageFeedback;
  agentUsed?: string;
  createdAt: Timestamp | Date;
  tokens?: number;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  messageCount: number;
  lastMessage?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  metadata?: Record<string, unknown>;
}
