import api from './api';
import { auth } from './firebase';
import type { Conversation, Message, Source } from '@/types/chat.types';

export interface SendMessageOptions {
  conversationId: string;
  content: string;
  onChunk?: (chunk: string) => void;
  onSources?: (sources: Source[]) => void;
  onDone?: (fullContent: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export const chatService = {
  async getConversations(companyId: string): Promise<Conversation[]> {
    const res = await api.get<Conversation[]>(`/chat/conversations?companyId=${companyId}`);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    }));
  },

  async createConversation(companyId: string, title: string): Promise<Conversation> {
    const res = await api.post<Conversation>('/chat/conversations', { companyId, title });
    const c = res.data;
    return { ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) };
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const res = await api.get<Message[]>(`/chat/conversations/${conversationId}/messages`);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }));
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`/chat/conversations/${conversationId}`);
  },

  async submitFeedback(conversationId: string, messageId: string, rating: 'up' | 'down'): Promise<void> {
    await api.patch(`/chat/conversations/${conversationId}/messages/${messageId}/feedback`, { rating });
  },

  async sendMessageStream(options: SendMessageOptions): Promise<void> {
    const { conversationId, content, onChunk, onSources, onDone, onError, signal } = options;

    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';

      const response = await fetch(`/api/agent/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(errorData.message ?? `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            onDone?.(fullContent);
            return;
          }
          let data: { content?: string; sources?: Source[]; error?: string } | null = null;
          try {
            data = JSON.parse(dataStr) as { content?: string; sources?: Source[]; error?: string };
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              console.warn('SSE parse error:', parseErr);
            }
            continue;
          }
          if (data.error) {
            onError?.(new Error(data.error));
            return;
          }
          if (data.sources) {
            onSources?.(data.sources);
          }
          if (data.content !== undefined) {
            fullContent += data.content;
            onChunk?.(data.content);
          }
        }
      }

      onDone?.(fullContent);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError?.(err instanceof Error ? err : new Error('Unknown error'));
    }
  },
};
