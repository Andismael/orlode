import React, { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { Send, StopCircle, Paperclip, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import MessageBubble from './MessageBubble';
import { useChatStore } from '@/store/chatStore';
import { useChat } from '@/hooks/useChat';
import { useAuthStore } from '@/store/authStore';
import { useVoiceInput, speakText, stopSpeaking } from '@/hooks/useVoiceInput';
import { chatService } from '@/services/chatService';
import { dataService } from '@/services/dataService';
import type { Message } from '@/types/chat.types';

interface ChatWindowProps {
  conversationId: string;
}

export default function ChatWindow({ conversationId }: ChatWindowProps) {
  const { messages, isStreaming } = useChatStore();
  const { sendMessage, stopStreaming } = useChat();
  const { company } = useAuthStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef(0);

  const lang = company?.settings?.language === 'en' ? 'en-US'
    : company?.settings?.language === 'ar' ? 'ar-SA'
    : 'fr-FR';

  const { isListening, isSupported, interimText, toggle: toggleMic } = useVoiceInput({
    lang,
    onTranscript: (text) => setInput((prev) => (prev ? prev + ' ' + text : text)),
  });

  const conversationMessages: Message[] = messages[conversationId] ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // TTS: speak new AI message if enabled
    if (ttsEnabled && conversationMessages.length > prevMsgCountRef.current) {
      const lastMsg = conversationMessages[conversationMessages.length - 1];
      if (lastMsg?.role === 'assistant' && lastMsg.content) {
        // Strip markdown for cleaner TTS
        const plainText = lastMsg.content.replace(/[*_`#>]/g, '').trim();
        speakText(plainText.slice(0, 500), lang);
      }
    }
    prevMsgCountRef.current = conversationMessages.length;
  }, [conversationMessages, ttsEnabled, lang]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleFeedback = async (messageId: string, rating: 'up' | 'down') => {
    await chatService.submitFeedback(conversationId, messageId, rating);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming || isLoading) return;
    const message = input.trim();
    setInput('');
    setIsLoading(true);
    try {
      await sendMessage(conversationId, message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {conversationMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg, #FF009D22, #0092FF22)' }}>
              <span className="text-3xl">🧠</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Ask anything about your company
            </h3>
            <p className="text-sm text-gray-500 max-w-sm">
              I have access to all your uploaded documents, meetings, and data. Ask me anything.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {[
                'What are our Q4 revenue figures?',
                'Summarize the HR policy document',
                'Who are our top clients?',
                'What is the onboarding process?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-left text-xs text-gray-500 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 transition-colors shadow-sm"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        )}

        {conversationMessages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <MessageBubble
              message={message}
              isStreaming={isStreaming && index === conversationMessages.length - 1 && message.role === 'assistant'}
              onFeedback={handleFeedback}
            />
          </motion.div>
        ))}

        {/* Typing indicator */}
        {isLoading && !isStreaming && (
          <div className="flex items-center gap-3 px-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#FF009D' }}>
              <span className="text-xs font-bold text-white">AI</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-3 bg-white border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm">
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#FF009D', animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#0092FF', animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#FFA200', animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
        <div className="flex items-end gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !company?.id) return;
              setIsUploading(true);
              try {
                const doc = await dataService.uploadDocument(file, company.id);
                setInput(`J'ai uploadé le fichier "${doc.originalName}". Analyse-le.`);
              } catch { /* handled by upload service */ }
              setIsUploading(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`transition-colors flex-shrink-0 mb-0.5 ${isUploading ? 'text-blue-500 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}
            title="Joindre un fichier"
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
          </button>

          <textarea
            ref={textareaRef}
            value={isListening && interimText ? input + ' ' + interimText : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? '🎙️ Ecoute en cours...' : 'Posez une question sur vos donnees...'}
            rows={1}
            className={`flex-1 bg-transparent placeholder-gray-400 resize-none focus:outline-none text-sm leading-relaxed ${isListening ? 'text-blue-600' : 'text-gray-900'}`}
            style={{ minHeight: '24px', maxHeight: '180px' }}
            disabled={isStreaming}
            readOnly={isListening}
          />

          <div className="flex items-center gap-2 flex-shrink-0 mb-0.5">
            {/* TTS toggle */}
            <button
              onClick={() => { setTtsEnabled((v) => !v); if (ttsEnabled) stopSpeaking(); }}
              className={`transition-colors ${ttsEnabled ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
              title={ttsEnabled ? 'Disable voice response' : 'Enable voice response'}
            >
              {ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            {/* Microphone / voice input */}
            {isSupported && (
              <button
                onClick={toggleMic}
                className={`transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}
                title={isListening ? 'Arreter' : 'Entree vocale'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}

            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="p-1.5 text-white rounded-lg transition-colors"
                style={{ background: '#FF4B4B' }}
                title="Stop generating"
              >
                <StopCircle size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-1.5 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#0092FF' }}
                title="Send (Enter)"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
