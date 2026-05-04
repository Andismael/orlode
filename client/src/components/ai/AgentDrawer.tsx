/**
 * AgentDrawer — Universal floating agent chat for redesign pages
 *
 * Usage: <AgentDrawer agentId="hr" agentName="RH" color="#0EA5E9" context={{ stats, employees }} />
 *
 * Calls /chat/conversations + /chat/conversations/:id/messages.
 * The backend's chat controller routes to the right specialist agent (Genkit/Gemini).
 * Inter-agent communication is handled by the orchestrator: each agent has access
 * to other agents as Genkit tools.
 */
import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Loader2 } from 'lucide-react';
import api from '@/services/api';

interface Msg { role: 'user' | 'agent'; text: string; time: string }

interface Props {
  agentId: string;
  agentName: string;
  color?: string;
  /** Optional structured page state injected as context for the agent's first user prompt. */
  context?: Record<string, unknown>;
  /** Optional starter prompts shown before the user types. */
  starters?: string[];
}

const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export default function AgentDrawer({ agentId, agentName, color = '#0EA5E9', context, starters }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const defaultStarters = starters ?? [
    `Que peux-tu faire pour moi en tant qu'agent ${agentName} ?`,
    `Donne-moi un résumé de la situation actuelle`,
    `Quelles actions me recommandes-tu aujourd'hui ?`,
  ];

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setMessages(m => [...m, { role: 'user', text, time: now() }]);
    setInput('');
    setSending(true);

    try {
      let id = convId;
      if (!id) {
        const created: any = await api.post('/chat/conversations', { agentId, title: agentName });
        id = created?.data?.id ?? created?.data?.conversationId ?? null;
        if (id) setConvId(id);
      }

      const contextLine = context && Object.keys(context).length
        ? `\n\n[Contexte page: ${JSON.stringify(context).slice(0, 800)}]`
        : '';

      const res: any = await api.post(`/chat/conversations/${id}/messages`, {
        content: text + contextLine,
        agentId,
      });
      const reply = res?.data?.reply || res?.data?.message || res?.data?.text;
      const replyText = typeof reply === 'string' ? reply : (reply?.content || reply?.text || 'Pas de réponse.');
      setMessages(m => [...m, { role: 'agent', text: replyText, time: now() }]);
    } catch {
      setMessages(m => [...m, { role: 'agent', text: 'Erreur de connexion. Réessaie.', time: now() }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title={`Demander à ${agentName}`}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 60,
            width: 60, height: 60, borderRadius: 18,
            background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
            color: '#fff', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 14px 32px -10px ${color}aa`,
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Sparkles size={22} />
        </button>
      )}

      {open && (
        <div
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 70,
            width: 420, maxWidth: 'calc(100vw - 32px)',
            height: 580, maxHeight: 'calc(100vh - 48px)',
            background: '#fff', borderRadius: 20, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 30px 80px -20px rgba(0,0,0,0.35)',
            border: '1px solid rgba(0,0,0,0.08)',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <div style={{ padding: '14px 18px', background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`, color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Agent {agentName}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>Gemini · contexte de cette page</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: 16, background: '#fafaf7', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Tu peux demander :</div>
                {defaultStarters.map((s, i) => (
                  <button key={i} onClick={() => send(s)} style={{ background: '#fff', border: `1px solid ${color}40`, color: '#222', padding: '8px 12px', borderRadius: 12, fontSize: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', maxWidth: '100%' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 14,
                  background: m.role === 'user' ? color : '#fff',
                  color: m.role === 'user' ? '#fff' : '#222',
                  fontSize: 13, lineHeight: 1.5,
                  border: m.role === 'user' ? 'none' : '1px solid rgba(0,0,0,0.08)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.text}
                  <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>{m.time}</div>
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', fontSize: 12 }}>
                <Loader2 size={14} className="spin" /> {agentName} réfléchit…
              </div>
            )}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid rgba(0,0,0,0.08)', background: '#fff', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={taRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={`Écris à ${agentName}…`}
              rows={1}
              style={{ flex: 1, resize: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none', maxHeight: 120 }}
            />
            <button
              disabled={sending || !input.trim()}
              onClick={() => send(input)}
              style={{ width: 40, height: 40, borderRadius: 12, background: color, color: '#fff', border: 'none', cursor: sending || !input.trim() ? 'not-allowed' : 'pointer', opacity: sending || !input.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
