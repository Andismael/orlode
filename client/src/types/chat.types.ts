export type MessageRole = 'user' | 'assistant' | 'system';

export interface Source {
  documentId: string;
  documentName: string;
  excerpt: string;
  page?: number;
  score?: number;
}

export interface MessageFeedback {
  rating: 'up' | 'down';
  comment?: string;
  submittedAt?: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  sources?: Source[];
  feedback?: MessageFeedback;
  agentUsed?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  messageCount: number;
  lastMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
