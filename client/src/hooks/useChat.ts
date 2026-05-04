import { useCallback, useRef } from 'react';
import { chatService } from '@/services/chatService';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import type { Message, Source } from '@/types/chat.types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useChat() {
  const { user } = useAuthStore();
  const {
    addConversation,
    removeConversation,
    setConversations,
    setMessages,
    addMessage,
    appendToLastMessage,
    updateLastMessage,
    setStreaming,
    updateConversationTitle,
  } = useChatStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async (companyId: string) => {
    const conversations = await chatService.getConversations(companyId);
    setConversations(conversations);
  }, [setConversations]);

  const createConversation = useCallback(async (companyId: string, title: string) => {
    const conversation = await chatService.createConversation(companyId, title);
    addConversation(conversation);
    return conversation;
  }, [addConversation]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await chatService.deleteConversation(conversationId);
    removeConversation(conversationId);
  }, [removeConversation]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const messages = await chatService.getMessages(conversationId);
    setMessages(conversationId, messages);
  }, [setMessages]);

  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    if (!user) throw new Error('Not authenticated');

    // Add user message immediately
    const userMessage: Message = {
      id: generateId(),
      conversationId,
      role: 'user',
      content,
      createdAt: new Date(),
    };
    addMessage(conversationId, userMessage);

    // Prepare assistant message placeholder
    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      conversationId,
      role: 'assistant',
      content: '',
      sources: [],
      createdAt: new Date(),
    };
    addMessage(conversationId, assistantMessage);

    // Start streaming
    abortControllerRef.current = new AbortController();
    setStreaming(true, conversationId);

    let sources: Source[] = [];

    await chatService.sendMessageStream({
      conversationId,
      content,
      signal: abortControllerRef.current.signal,
      onChunk: (chunk) => {
        appendToLastMessage(conversationId, chunk);
      },
      onSources: (s) => {
        sources = s;
      },
      onDone: (fullContent) => {
        // Replace last message with final version including sources
        const finalMessage: Message = {
          id: assistantMessageId,
          conversationId,
          role: 'assistant',
          content: fullContent,
          sources,
          createdAt: new Date(),
        };
        const currentMessages = useChatStore.getState().messages[conversationId] ?? [];
        useChatStore.getState().setMessages(
          conversationId,
          [...currentMessages.slice(0, -1), finalMessage]
        );
        setStreaming(false, null);

        // Auto-title on first exchange
        const msgs = useChatStore.getState().messages[conversationId] ?? [];
        if (msgs.length === 2) {
          const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
          updateConversationTitle(conversationId, title);
        }
      },
      onError: (err) => {
        updateLastMessage(conversationId, `Error: ${err.message}`);
        setStreaming(false, null);
      },
    });
  }, [user, addMessage, appendToLastMessage, updateLastMessage, setStreaming, updateConversationTitle]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setStreaming(false, null);
  }, [setStreaming]);

  return {
    loadConversations,
    createConversation,
    deleteConversation,
    loadMessages,
    sendMessage,
    stopStreaming,
  };
}
