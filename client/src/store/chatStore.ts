import { create } from 'zustand';
import type { Conversation, Message } from '@/types/chat.types';

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Record<string, Message[]>;
  isStreaming: boolean;
  streamingConversationId: string | null;

  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  setCurrentConversation: (id: string | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateLastMessage: (conversationId: string, content: string) => void;
  appendToLastMessage: (conversationId: string, chunk: string) => void;
  setStreaming: (isStreaming: boolean, conversationId?: string | null) => void;
  updateConversationTitle: (id: string, title: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentConversationId: null,
  messages: {},
  isStreaming: false,
  streamingConversationId: null,

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversationId: conversation.id,
    })),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
      messages: Object.fromEntries(Object.entries(state.messages).filter(([key]) => key !== id)),
    })),

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),

  addMessage: (conversationId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] ?? []), message],
      },
    })),

  updateLastMessage: (conversationId, content) =>
    set((state) => {
      const msgs = state.messages[conversationId] ?? [];
      if (msgs.length === 0) return state;
      const updated = [...msgs];
      updated[updated.length - 1] = { ...updated[updated.length - 1], content };
      return { messages: { ...state.messages, [conversationId]: updated } };
    }),

  appendToLastMessage: (conversationId, chunk) =>
    set((state) => {
      const msgs = state.messages[conversationId] ?? [];
      if (msgs.length === 0) return state;
      const updated = [...msgs];
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = { ...last, content: last.content + chunk };
      return { messages: { ...state.messages, [conversationId]: updated } };
    }),

  setStreaming: (isStreaming, conversationId = null) =>
    set({ isStreaming, streamingConversationId: conversationId }),

  updateConversationTitle: (id, title) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    })),
}));
