/**
 * Sales AI Chat — Interactive agent commercial chat
 */
import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import api from '@/services/api';
import SalesHero from './_SalesHero';
import SalesNav from './_SalesNav';

interface Msg { role: 'user' | 'assistant'; content: string; ts: number }

const C = {
  greenDeep: '#0A4F3C', greenSoft: '#E8F5EE', cream: '#FFFAF0',
  orange: '#FF6B1A', orangeDeep: '#E5530C',
  ink: '#0A2A20', inkSoft: '#5A6B62',
};

const SUGGESTIONS = [
  'Quels sont mes leads chauds ?',
  'Crée un devis pour Marie Diallo, 1 prestation, 500000 FCFA',
  'Quelle est ma prévision de revenus ce trimestre ?',
  'Liste les relances en retard',
  'Performance de mon équipe commerciale',
];

export default function SalesAIChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: "Bonjour 👋 Je suis votre Agent Commercial. Je peux créer des leads, devis, factures, gérer le pipeline et analyser vos performances. Comment puis-je vous aider ?", ts: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: message, ts: Date.now() }]);
    setLoading(true);
    try {
      const r = await api.post('/agents/chat', {
        targetAgent: 'sales',
        content: `[Agent: Commercial] ${message}`,
        language: 'fr',
      });
      const reply = (r.data as { reply?: string; data?: { reply?: string } })?.reply
        ?? (r.data as { data?: { reply?: string } })?.data?.reply
        ?? 'Réponse indisponible.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Erreur de communication avec l\'agent. Réessayez.', ts: Date.now() }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        .sac-root{background:${C.greenDeep};min-height:100vh;font-family:'Inter',-apple-system,sans-serif;padding:32px;display:flex;flex-direction:column}
        .sac-display{font-family:'Fraunces',serif}
        .sac-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600}
        .sac-chat{background:${C.cream};border-radius:20px;flex:1;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(10,42,32,.06);min-height:500px;margin-top:24px}
        .sac-msgs{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:16px}
        .sac-msg{display:flex;gap:12px;max-width:80%}
        .sac-msg.user{margin-left:auto;flex-direction:row-reverse}
        .sac-bubble{padding:14px 18px;border-radius:18px;font-size:14px;line-height:1.5}
        .sac-msg.user .sac-bubble{background:${C.orange};color:${C.cream};border-bottom-right-radius:6px}
        .sac-msg.assistant .sac-bubble{background:${C.greenSoft};color:${C.ink};border-bottom-left-radius:6px}
        .sac-avatar{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${C.cream}}
        .sac-avatar.user{background:${C.greenDeep}}
        .sac-avatar.assistant{background:linear-gradient(135deg,${C.orange},${C.orangeDeep})}
        .sac-input-wrap{padding:18px 24px;border-top:1px solid rgba(10,42,32,.08);background:${C.cream};display:flex;gap:10px;align-items:flex-end}
        .sac-textarea{flex:1;border:1.5px solid rgba(10,42,32,.1);border-radius:14px;padding:12px 16px;font-size:14px;color:${C.ink};font-family:inherit;outline:none;resize:none;min-height:48px;max-height:160px}
        .sac-textarea:focus{border-color:${C.orange}}
        .sac-send-btn{background:${C.orange};color:${C.cream};border:none;width:48px;height:48px;border-radius:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}
        .sac-send-btn:hover{background:${C.orangeDeep};transform:translateY(-1px)}
        .sac-send-btn:disabled{opacity:.5;cursor:not-allowed}
        .sac-suggestion{background:${C.cream};border:1px solid rgba(10,42,32,.08);color:${C.ink};padding:10px 14px;border-radius:12px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .2s}
        .sac-suggestion:hover{border-color:${C.orange};background:#FFE8D6;color:${C.orangeDeep}}
        @media(max-width:700px){.sac-root{padding:16px}.sac-msg{max-width:90%}}
      `}</style>
      <div className="sac-root">
        <SalesHero
          title="Chat IA"
          italic="commercial."
          subtitle={<>Discutez avec votre Agent Commercial — il crée des leads, devis, factures, et analyse votre pipeline en temps réel.</>}
          pills={<span className="sac-pill" style={{ background: C.greenDeep, color: C.cream }}><Bot size={11} /> AGENT COMMERCIAL · PRO</span>}
        />
        <SalesNav />

        <div className="sac-chat">
          <div className="sac-msgs">
            {messages.map((m, i) => (
              <div key={i} className={`sac-msg ${m.role}`}>
                <div className={`sac-avatar ${m.role}`}>
                  {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className="sac-bubble" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="sac-msg assistant">
                <div className="sac-avatar assistant"><Bot size={18} /></div>
                <div className="sac-bubble" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader2 size={14} className="sac-spin" style={{ animation: 'spin 1s linear infinite' }} /> L'agent réfléchit…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length <= 2 && (
            <div style={{ padding: '0 24px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} className="sac-suggestion" onClick={() => send(s)}>
                  <Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />{s}
                </button>
              ))}
            </div>
          )}

          <div className="sac-input-wrap">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Demandez à l'Agent Commercial… (Enter pour envoyer)"
              className="sac-textarea"
            />
            <button className="sac-send-btn" onClick={() => send()} disabled={loading || !input.trim()}>
              <Send size={18} />
            </button>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );
}
