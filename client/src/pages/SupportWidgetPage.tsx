import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Send, X, MessageCircle } from 'lucide-react';

interface Message { role: 'user' | 'bot'; text: string; }

export default function SupportWidgetPage() {
  const { t } = useLangStore();
  const [params] = useSearchParams();
  const companyId = params.get('company') ?? '';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Bonjour ! Comment puis-je vous aider ?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const r = await api.post('/support/widget/chat', { companyId, message: text });
      setMessages(m => [...m, { role: 'bot', text: r.data.reply ?? 'Je traite votre demande...' }]);
    } catch {
      setMessages(m => [...m, { role: 'bot', text: 'Une erreur s\'est produite. Veuillez réessayer.' }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="w-screen h-screen flex items-end justify-end p-4 bg-transparent">
      {open ? (
        <div className="w-80 h-[480px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
            <div>
              <p className="font-semibold text-sm">Support Orlode</p>
              <p className="text-xs opacity-70">En ligne</p>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`} style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #0019FF, #0092FF)' } : undefined}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-md">
                  <span className="flex gap-1">
                    {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Votre message..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}
