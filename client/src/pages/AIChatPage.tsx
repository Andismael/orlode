import React, { useState, useRef, useEffect } from 'react';
import api from '@/services/api';
import { auth } from '@/services/firebase';
import {
  Search, Bell, ChevronDown, ChevronRight, ArrowRight, ArrowUp,
  LayoutDashboard, MessageSquare, MessageCircle, Bot, UsersRound, Briefcase,
  Plus, Mic, Sparkles, Send, Paperclip, AtSign, Pin, Filter,
  MoreHorizontal, X, Copy, ThumbsUp, ThumbsDown, RotateCw,
  CheckCircle2, Clock, Zap, Code,
  PhoneCall, Users2, UserCircle, BookOpen, DollarSign, Target,
  BarChart3, Activity, Globe, Mail, Megaphone,
  Bookmark, Save, Calendar, FileText, Inbox,
  History, Eraser, Loader2,
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  purple: '#7C3AED', purpleDeep: '#5B21B6', purpleDark: '#4C1D95',
  purpleSoft: '#EDE9FE', purpleLight: '#A78BFA',
  pink: '#EC4899', pinkDeep: '#DB2777', pinkSoft: '#FCE7F3',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  red: '#EF4444', redSoft: '#FEE2E2',
  yellow: '#F59E0B', yellowSoft: '#FEF3C7',
  cyan: '#06B6D4', cyanSoft: '#CFFAFE',
  orange: '#F97316', orangeSoft: '#FFEDD5',
  ink: '#0A2A20', inkSoft: '#5A6B62', inkLight: '#94A3A0',
  onGreenSoft: '#A8C9B8',
};

// ============ AGENTS DATA ============
const AGENTS = [
  { id: 'orch', name: 'Orchestrateur', emoji: '🧠', color: C.purpleDeep, bg: C.purpleSoft, status: 'online', category: 'core', pinned: true, desc: 'Route vers le bon agent' },
  { id: 'know', name: 'Knowledge', emoji: '📚', color: C.blue, bg: C.blueSoft, status: 'online', category: 'core', desc: 'Base de connaissances' },
  { id: 'rec', name: 'Réception', emoji: '👋', color: C.cyan, bg: C.cyanSoft, status: 'online', category: 'ops', desc: 'Aïcha, accueil & filtre' },
  { id: 'rh', name: 'Ressources Humaines', emoji: '👩‍💼', color: C.purple, bg: C.purpleSoft, status: 'online', category: 'ops', desc: 'Gestion équipe & paie' },
  { id: 'compt', name: 'Comptabilité', emoji: '💰', color: C.emerald, bg: C.emeraldSoft, status: 'online', category: 'ops', desc: 'Factures & comptes' },
  { id: 'comm', name: 'Commercial', emoji: '🤝', color: C.orange, bg: C.orangeSoft, status: 'online', category: 'ops', desc: 'Ventes & pipeline' },
  { id: 'comms', name: 'Communications', emoji: '✉️', color: C.blue, bg: C.blueSoft, status: 'online', category: 'ops', desc: 'Email, WhatsApp, Telegram, Slack' },
  { id: 'sup', name: 'Support Client', emoji: '📞', color: C.pink, bg: C.pinkSoft, status: 'online', category: 'ops', desc: 'Tickets & SLA' },
  { id: 'it', name: 'IT', emoji: '💻', color: C.greenDeep, bg: C.emeraldSoft, status: 'online', category: 'ops', desc: 'Infra & support tech' },
  { id: 'meet', name: 'Réunions', emoji: '📅', color: C.purple, bg: C.purpleSoft, status: 'online', category: 'ops', desc: 'Planning & comptes-rendus' },
  { id: 'vis', name: 'Vision', emoji: '👁️', color: C.cyan, bg: C.cyanSoft, status: 'online', category: 'core', desc: 'OCR & analyse images' },
  { id: 'ins', name: 'Insights', emoji: '📊', color: C.blue, bg: C.blueSoft, status: 'online', category: 'strategy', desc: 'BI & analytics' },
  { id: 'mark', name: 'Marketing', emoji: '👑', color: C.purpleDeep, bg: C.purpleSoft, status: 'online', category: 'ops', desc: 'Roi Olamide, growth & social' },
  { id: 'cyb', name: 'Cybersécurité', emoji: '🔒', color: C.red, bg: C.redSoft, status: 'online', category: 'core', desc: 'Audit & menaces' },
  { id: 'jur', name: 'Juridique', emoji: '⚖️', color: C.greenDeep, bg: C.emeraldSoft, status: 'online', category: 'strategy', desc: 'Contrats & conformité OHADA' },
  { id: 'form', name: 'Formation', emoji: '🎓', color: C.yellow, bg: C.yellowSoft, status: 'online', category: 'strategy', desc: 'Coaching & e-learning' },
  { id: 'veil', name: 'Veille', emoji: '🔍', color: C.orange, bg: C.orangeSoft, status: 'online', category: 'strategy', desc: 'Concurrence & tendances' },
];

const QUICK_PROMPTS = [
  { icon: DollarSign, label: 'Créer un devis', color: C.emerald, prompt: 'Crée un devis pour…' },
  { icon: Mail, label: 'Envoyer un email', color: C.blue, prompt: 'Envoie un email à…' },
  { icon: BarChart3, label: 'Générer rapport', color: C.purple, prompt: 'Génère le rapport hebdo…' },
  { icon: Calendar, label: 'Planifier RDV', color: C.cyan, prompt: 'Prends un RDV avec…' },
  { icon: Megaphone, label: 'Campagne WhatsApp', color: C.emeraldDeep, prompt: 'Lance une campagne WhatsApp…' },
  { icon: FileText, label: 'Analyser document', color: C.orange, prompt: 'Analyse ce document et…' },
];

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font { font-family: 'JetBrains Mono', monospace; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.emerald}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.emerald}; opacity: 0.4; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.6); opacity: 0; } }
  @keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-6px); opacity: 1; } }
  .typing-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--typing-color, ${C.purpleDeep}); animation: typingBounce 1.4s ease-in-out infinite; }
  .typing-dot:nth-child(2) { animation-delay: 0.15s; }
  .typing-dot:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bubbleSlide { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .bubble-in { animation: bubbleSlide 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .avatar-grad { border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 700; color: ${C.cream}; flex-shrink: 0; position: relative; }
  .ai-chat-light-shell, .ai-chat-light-shell *, .ai-chat-light-shell input, .ai-chat-light-shell textarea, .ai-chat-light-shell select, .ai-chat-light-shell button { color-scheme: light only; }
  .agent-name-text { color: ${C.ink} !important; }
  .agent-row.active .agent-name-text { color: ${C.purpleDeep} !important; }
  .agent-preview-text { color: ${C.inkSoft} !important; }
  .agent-time-text { color: ${C.inkLight} !important; }
  .search-input { width: 100%; background-color: ${C.creamDeep} !important; border: 1.5px solid transparent; border-radius: 12px; padding: 10px 14px 10px 40px; font-size: 13px; color: ${C.ink} !important; font-family: inherit; outline: none; transition: all 0.2s ease; }
  .search-input:focus { border-color: ${C.purpleDeep}; background-color: ${C.cream} !important; box-shadow: 0 0 0 3px ${C.purpleDeep}15; }
  .search-input::placeholder { color: ${C.inkSoft} !important; opacity: 1; }
  .chat-textarea textarea { color: ${C.ink} !important; background-color: transparent !important; }
  .chat-textarea textarea::placeholder { color: ${C.inkSoft} !important; opacity: 1; }
  .agent-row { padding: 12px 14px; border-radius: 12px; cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; gap: 12px; border: 1.5px solid transparent; }
  .agent-row:hover { background: ${C.creamDeep}; }
  .agent-row.active { background: linear-gradient(135deg, ${C.purpleSoft}, ${C.cream}); border-color: ${C.purpleDeep}30; box-shadow: 0 4px 12px -4px ${C.purpleDeep}30; }
  .quick-prompt { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 100px; background: ${C.cream}; color: ${C.ink}; border: 1.5px solid rgba(10,42,32,0.08); cursor: pointer; transition: all 0.2s ease; font-size: 12px; font-weight: 600; font-family: inherit; white-space: nowrap; }
  .quick-prompt:hover { transform: translateY(-2px); box-shadow: 0 8px 20px -8px rgba(10,42,32,0.2); }
  .bubble-actions { opacity: 0; transition: opacity 0.2s ease; }
  .bubble-wrap:hover .bubble-actions { opacity: 1; }
  .bubble-action-btn { width: 28px; height: 28px; border-radius: 7px; background: ${C.cream}; color: ${C.inkSoft}; border: 1px solid rgba(10,42,32,0.08); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; }
  .bubble-action-btn:hover { background: ${C.greenDeep}; color: ${C.cream}; border-color: ${C.greenDeep}; }
  .send-btn { width: 44px; height: 44px; border-radius: 12px; background: var(--agent-color, ${C.purpleDeep}); color: ${C.cream}; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 8px 20px -6px var(--agent-color, ${C.purpleDeep}); flex-shrink: 0; }
  .send-btn:hover { transform: translateY(-2px) scale(1.04); }
  .send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .toolbar-btn { width: 36px; height: 36px; border-radius: 10px; background: transparent; color: ${C.inkSoft}; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
  .toolbar-btn:hover { background: ${C.purpleSoft}; color: ${C.purpleDeep}; }
  .cat-pill { padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; background: transparent; color: ${C.inkSoft}; border: none; font-family: inherit; white-space: nowrap; }
  .cat-pill:hover { color: ${C.purpleDeep}; background: ${C.purpleSoft}; }
  .cat-pill.active { background: ${C.greenDeep}; color: ${C.cream}; }
  .chat-textarea { --agent-color: ${C.purpleDeep}; --agent-color-soft: ${C.purpleSoft}; }
  .chat-textarea:focus-within { border-color: var(--agent-color) !important; box-shadow: 0 0 0 4px var(--agent-color-soft), 0 12px 28px -10px rgba(0, 0, 0, 0.15) !important; transform: translateY(-2px); }
  .nice-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .nice-scroll::-webkit-scrollbar-track { background: transparent; }
  .nice-scroll::-webkit-scrollbar-thumb { background: ${C.purpleSoft}; border-radius: 3px; }
  .nice-scroll::-webkit-scrollbar-thumb:hover { background: ${C.purpleLight}; }
  .oui-watermark { position: absolute; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.06; }
  .agents-list-col { transition: transform 0.3s ease, width 0.3s ease; }
  .agents-toggle-btn { display: none; width: 40px; height: 40px; border-radius: 12px; background: ${C.creamDeep}; border: 1px solid rgba(10,42,32,0.1); cursor: pointer; align-items: center; justify-content: center; color: ${C.purpleDeep}; flex-shrink: 0; transition: all 0.2s ease; font-family: inherit; }
  .agents-toggle-btn:hover { background: ${C.purpleDeep}; color: ${C.cream}; }
  .agents-list-overlay { display: none; position: fixed; inset: 0; background: rgba(10,42,32,0.5); backdrop-filter: blur(4px); z-index: 40; }
  @media (max-width: 1100px) {
    .agents-list-col { position: absolute !important; left: 0; top: 0; height: 100% !important; transform: translateX(-100%); z-index: 45; box-shadow: 0 0 40px -10px rgba(10,42,32,0.3); }
    .agents-list-col.open { transform: translateX(0); }
    .agents-list-overlay.open { display: block; }
    .agents-toggle-btn { display: flex; }
  }
  @media (max-width: 768px) {
    .chat-area { padding: 16px !important; }
    .bubble-content { max-width: 90% !important; }
  }
`;

// ============ AGENT ROW ============
function AgentRow({ agent, active, onClick, lastMessage }: any) {
  return (
    <div onClick={onClick} className={`agent-row ${active ? 'active' : ''}`}>
      <div className="avatar-grad" style={{
        width: 44, height: 44,
        background: `linear-gradient(135deg, ${agent.color} 0%, ${agent.color}cc 100%)`,
        fontSize: 20, position: 'relative',
        boxShadow: active ? `0 8px 16px -6px ${agent.color}` : 'none',
      }}>
        {agent.emoji}
        {agent.status === 'online' && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 50, background: C.emerald, border: `2px solid ${C.cream}` }}></div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
          <span className="display-font agent-name-text" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</span>
          {lastMessage?.time && <span className="agent-time-text" style={{ fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{lastMessage.time}</span>}
        </div>
        <div className="agent-preview-text" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lastMessage?.text || agent.desc}
        </div>
      </div>
    </div>
  );
}

// ============ AGENTS LIST ============
function AgentsList({ activeAgent, onSelect, isOpen, onClose, conversations }: any) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const categories = [
    { id: 'all', label: 'Tous', count: AGENTS.length },
    { id: 'core', label: 'Core' },
    { id: 'ops', label: 'Opérations' },
    { id: 'strategy', label: 'Stratégie' },
  ];
  const filtered = AGENTS.filter(a => {
    if (filter !== 'all' && a.category !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const pinned = filtered.filter(a => a.pinned);
  const regular = filtered.filter(a => !a.pinned);
  const handleSelect = (id: string) => { onSelect(id); if (onClose) onClose(); };

  const getLastMessage = (agentId: string) => {
    const conv = conversations?.find((c: any) => c.agentId === agentId || c.id === agentId);
    if (!conv?.lastMessage) return null;
    return { text: conv.lastMessage.text || conv.lastMessage.content, time: conv.lastMessage.time };
  };

  return (
    <aside className={`agents-list-col ${isOpen ? 'open' : ''}`} style={{ width: 320, background: C.cream, borderRight: '1px solid rgba(10,42,32,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%' }}>
      <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid rgba(10,42,32,0.06)', background: `linear-gradient(135deg, ${C.purpleSoft} 0%, ${C.cream} 100%)` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 className="display-font" style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
              AI <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purpleDeep }}>Chat</em>
            </h2>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
              <span className="live-dot" style={{ display: 'inline-block', width: 6, height: 6, marginRight: 6, verticalAlign: 'middle' }}></span>
              <span className="mono-font" style={{ fontWeight: 700, color: C.purpleDeep }}>{AGENTS.length} agents</span> connectés
            </div>
          </div>
          <button
            onClick={() => window.open(`/voice?agent=${activeAgent || 'orchestrator'}`, '_blank')}
            title="Ouvrir le voice agent (Gemini Live)"
            style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.purpleDeep} 0%, ${C.pink} 100%)`, color: C.cream, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px -6px ${C.purpleDeep}`, transition: 'transform 0.2s ease' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Mic size={18} />
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Rechercher un agent…" className="search-input" />
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 12, overflowX: 'auto' }}>
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilter(c.id)} className={`cat-pill ${filter === c.id ? 'active' : ''}`}>
              {c.label}
              {c.count !== undefined && (<span className="mono-font" style={{ marginLeft: 6, background: filter === c.id ? 'rgba(255,250,240,0.2)' : C.purpleSoft, color: filter === c.id ? C.cream : C.purpleDeep, padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>{c.count}</span>)}
            </button>
          ))}
        </div>
      </div>
      <div className="nice-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {pinned.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 4px 6px', fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>
              <Pin size={11} fill={C.inkSoft} /> ÉPINGLÉS
            </div>
            {pinned.map(agent => (
              <AgentRow key={agent.id} agent={agent} active={activeAgent === agent.id} onClick={() => handleSelect(agent.id)} lastMessage={getLastMessage(agent.id)} />
            ))}
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 4px 6px', fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>
          <Users2 size={11} /> AGENTS · {regular.length}
        </div>
        {regular.map(agent => (
          <AgentRow key={agent.id} agent={agent} active={activeAgent === agent.id} onClick={() => handleSelect(agent.id)} lastMessage={getLastMessage(agent.id)} />
        ))}
      </div>
      <div style={{ padding: 14, borderTop: '1px solid rgba(10,42,32,0.06)', background: C.creamDeep }}>
        <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: C.cream, border: `1.5px dashed ${C.purpleDeep}40`, cursor: 'pointer', fontFamily: 'inherit', color: C.purpleDeep, fontWeight: 600, fontSize: 13 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.purpleDeep}, ${C.pink})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={14} />
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Marketplace</div>
            <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 500 }}>40 agents externes dispos</div>
          </div>
          <ArrowRight size={14} />
        </button>
      </div>
    </aside>
  );
}

// ============ MESSAGE BUBBLE ============
// Robust time formatter — handles ISO string, Date object, numeric timestamp,
// pre-formatted strings ("14:32"), Firestore-style { seconds, nanoseconds }.
// Returns empty string instead of "Invalid Date" so the UI stays clean.
function formatMsgTime(t: any): string {
  if (!t) return '';
  if (typeof t === 'string') {
    // Already formatted "HH:mm" — pass through
    if (/^\d{1,2}:\d{2}/.test(t)) return t;
    const d = new Date(t);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return '';
  }
  if (typeof t === 'number') {
    const d = new Date(t);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return '';
  }
  if (t instanceof Date) {
    return isNaN(t.getTime()) ? '' : t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  // Firestore Timestamp shape
  if (typeof t === 'object' && typeof t.seconds === 'number') {
    return new Date(t.seconds * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return '';
}

function MessageBubble({ msg, agent }: any) {
  const isUser = msg.role === 'user';
  const time = formatMsgTime(msg.time ?? msg.createdAt ?? msg.timestamp);

  // Two-color floating bubble palette:
  // - User → emerald gradient (always cohérent, marque)
  // - Agent → agent.color gradient soft + cream surface for legibility
  const userColorA = C.emeraldDeep;
  const userColorB = C.greenDeep;

  return (
    <div className="msg-row" style={{
      display: 'flex', gap: 12,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end', marginBottom: 8,
      animation: 'msgFloatIn 0.45s cubic-bezier(.2,.8,.2,1) backwards',
    }}>
      {/* Avatar with floating glow */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: isUser
          ? `linear-gradient(135deg, ${userColorA} 0%, ${userColorB} 100%)`
          : `linear-gradient(135deg, ${agent.color} 0%, ${agent.color}aa 100%)`,
        fontSize: 17, flexShrink: 0, color: '#fff', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isUser
          ? `0 6px 22px -6px ${userColorA}, 0 0 0 3px ${userColorA}15`
          : `0 6px 22px -6px ${agent.color}, 0 0 0 3px ${agent.color}15`,
        position: 'relative',
      }}>
        {isUser ? 'A' : agent.emoji}
      </div>

      <div style={{
        maxWidth: '72%',
        display: 'flex', flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4,
      }}>
        {!isUser && (
          <div style={{
            fontSize: 11, fontWeight: 800, color: agent.color,
            letterSpacing: '0.04em', paddingLeft: 4, textTransform: 'uppercase',
          }}>{agent.name}</div>
        )}

        {/* Floating bubble — pure white for agent (distinct from cream input area)
            with a soft agent-color glow inside + colored gradient border. */}
        <div className="msg-bubble" style={{
          background: isUser
            ? `linear-gradient(135deg, ${userColorA} 0%, ${userColorB} 100%)`
            : `linear-gradient(135deg, #ffffff 0%, #ffffff 60%, ${agent.color}0c 100%)`,
          color: isUser ? '#fff' : C.ink,
          padding: '13px 17px',
          borderRadius: isUser ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
          boxShadow: isUser
            ? `0 14px 30px -10px ${userColorA}66, 0 4px 12px -2px ${userColorB}40, inset 0 1px 0 rgba(255,255,255,0.18)`
            : `0 14px 32px -8px ${agent.color}40, 0 6px 16px -4px rgba(10,42,32,0.10), inset 0 1px 0 rgba(255,255,255,0.9)`,
          border: isUser
            ? `1px solid ${userColorA}80`
            : `1px solid ${agent.color}40`,
          fontSize: 14.5, lineHeight: 1.6,
          position: 'relative',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = isUser
              ? `0 20px 40px -10px ${userColorA}88, 0 6px 16px -2px ${userColorB}55, inset 0 1px 0 rgba(255,255,255,0.2)`
              : `0 22px 44px -10px ${agent.color}66, 0 8px 20px -6px rgba(10,42,32,0.14), inset 0 1px 0 rgba(255,255,255,0.95)`;
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = isUser
              ? `0 14px 30px -10px ${userColorA}66, 0 4px 12px -2px ${userColorB}40, inset 0 1px 0 rgba(255,255,255,0.18)`
              : `0 14px 32px -8px ${agent.color}40, 0 6px 16px -4px rgba(10,42,32,0.10), inset 0 1px 0 rgba(255,255,255,0.9)`;
          }}
        >
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
        </div>

        {(time || !isUser) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
            color: C.inkLight, fontWeight: 500,
            flexDirection: isUser ? 'row-reverse' : 'row',
            paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0,
          }}>
            {time && <span>{time}</span>}
            {isUser && time && <CheckCircle2 size={11} color={C.emerald} />}
            <div className="bubble-actions" style={{ display: 'flex', gap: 4 }}>
              <button className="bubble-action-btn" title="Copier" onClick={() => navigator.clipboard?.writeText(msg.text)}><Copy size={11} /></button>
              {!isUser && (<>
                <button className="bubble-action-btn" title="Bonne réponse"><ThumbsUp size={11} /></button>
                <button className="bubble-action-btn" title="Mauvaise réponse"><ThumbsDown size={11} /></button>
                <button className="bubble-action-btn" title="Régénérer"><RotateCw size={11} /></button>
              </>)}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes msgFloatIn {
          0%   { opacity: 0; transform: translateY(12px) scale(0.96); }
          60%  { opacity: 1; transform: translateY(-2px) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ============ TYPING INDICATOR ============
function TypingIndicator({ agent }: any) {
  return (
    <div className="bubble-in" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 4 }}>
      <div className="avatar-grad" style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${agent.color} 0%, ${agent.color}cc 100%)`, fontSize: 16, flexShrink: 0, boxShadow: `0 4px 10px -4px ${agent.color}` }}>
        {agent.emoji}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: agent.color, letterSpacing: '0.02em', paddingLeft: 4 }}>{agent.name}</div>
        <div style={{ background: C.cream, padding: '14px 18px', borderRadius: '18px 18px 18px 4px', boxShadow: '0 4px 12px -4px rgba(10,42,32,0.1)', border: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 5, ['--typing-color' as any]: agent.color }}>
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
        </div>
        <div style={{ fontSize: 11, color: C.inkLight, fontWeight: 500, paddingLeft: 4 }}>
          <Sparkles size={10} style={{ display: 'inline', marginRight: 4 }} />
          {agent.name} réfléchit…
        </div>
      </div>
    </div>
  );
}

// ============ CHAT HEADER ============
// ── Conversation history drawer (right side panel) ────────────────────────
function ConversationHistoryDrawer({ agentId, currentConversationId, onClose, onSelect }: {
  agentId: string;
  currentConversationId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/chat/conversations', { params: { limit: 100 } })
      .then((r: any) => {
        const all = (r?.data?.conversations ?? r?.data?.data ?? r?.data ?? []) as any[];
        // Most recent first
        all.sort((a, b) => {
          const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
          const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
          return tb - ta;
        });
        setConversations(all);
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.title ?? '').toLowerCase().includes(q)
        || (c.lastMessage ?? '').toLowerCase().includes(q)
        || (c.agentId ?? '').toLowerCase().includes(q);
  });

  // Group by agent for visual structure (current agent first)
  const byAgent = filtered.reduce<Record<string, any[]>>((acc, c) => {
    const aid = c.agentId ?? 'orch';
    (acc[aid] ||= []).push(c);
    return acc;
  }, {});
  const agentOrder = Object.keys(byAgent).sort((a, b) => (a === agentId ? -1 : b === agentId ? 1 : 0));

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (isYesterday) return 'Hier';
    const diff = (now.getTime() - d.getTime()) / 86400000;
    if (diff < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(10,42,32,0.45)', backdropFilter: 'blur(6px)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(420px, 100%)', height: '100%',
        background: C.cream, color: C.ink,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px -12px rgba(10,42,32,0.30)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 22px', background: `linear-gradient(135deg, ${C.purpleDeep}, ${C.purple})`,
          color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={20} />
            <h3 className="display-font" style={{ fontSize: 19, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Historique
            </h3>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(255,255,255,0.18)', color: C.cream,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 18px', borderBottom: `1px solid rgba(10,42,32,0.06)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.creamDeep, borderRadius: 10, padding: '8px 12px' }}>
            <Filter size={14} color={C.inkSoft} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', color: C.ink }} />
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft }}>
              <Loader2 size={24} className="spin" />
              <div style={{ marginTop: 10, fontSize: 13 }}>Chargement…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft }}>
              <MessageSquare size={28} color={C.inkLight} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {search ? 'Aucun résultat' : 'Aucune conversation'}
              </div>
              <div style={{ fontSize: 12 }}>
                {search ? `Pas de match pour "${search}"` : 'Vos conversations s\'afficheront ici.'}
              </div>
            </div>
          ) : (
            agentOrder.map(aid => (
              <div key={aid} style={{ marginBottom: 6 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: C.inkSoft, padding: '10px 18px 4px',
                }}>
                  {aid === agentId ? `★ ${aid}` : aid}
                </div>
                {byAgent[aid].map(c => {
                  const isCurrent = c.id === currentConversationId;
                  return (
                    <button key={c.id} onClick={() => onSelect(c.id)}
                      style={{
                        width: '100%', padding: '10px 18px',
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
                        background: isCurrent ? `${C.purple}10` : 'transparent',
                        borderLeft: isCurrent ? `3px solid ${C.purple}` : '3px solid transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                      onMouseOver={ev => { if (!isCurrent) ev.currentTarget.style.background = C.creamDeep; }}
                      onMouseOut={ev => { if (!isCurrent) ev.currentTarget.style.background = 'transparent'; }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: C.ink,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}>
                        {c.title || c.lastMessage?.slice(0, 60) || 'Conversation'}
                      </div>
                      {c.lastMessage && c.title && c.lastMessage !== c.title && (
                        <div style={{
                          fontSize: 11, color: C.inkSoft,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}>
                          {c.lastMessage.slice(0, 70)}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 600 }}>
                        {formatTime(c.updatedAt ?? c.createdAt)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ChatHeader({ agent, onToggleAgents, onNewConversation, conversationId, ttsEnabled, onToggleTTS, onShowHistory, onClearInput, hasInput }: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const openVoiceAgent = () => {
    window.open(`/voice?agent=${agent.id}`, '_blank');
  };

  const handleDelete = async () => {
    if (!conversationId) return;
    if (!confirm('Supprimer cette conversation ?')) return;
    try {
      await api.delete(`/chat/conversations/${conversationId}`);
      onNewConversation?.();
    } catch {}
    setMenuOpen(false);
  };

  return (
    <div style={{ padding: '16px 24px', background: C.cream, borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, position: 'relative' }}>
      <button onClick={onToggleAgents} className="agents-toggle-btn" title="Voir les agents">
        <Bot size={18} />
      </button>
      <div className="avatar-grad" style={{ width: 48, height: 48, background: `linear-gradient(135deg, ${agent.color} 0%, ${agent.color}cc 100%)`, fontSize: 22, position: 'relative', boxShadow: `0 8px 20px -6px ${agent.color}` }}>
        {agent.emoji}
        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 50, background: C.emerald, border: `2.5px solid ${C.cream}` }}></div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>{agent.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.emeraldDeep, fontWeight: 600 }}>
          <span className="live-dot" style={{ width: 6, height: 6 }}></span>
          En ligne · <span style={{ color: C.inkSoft, fontWeight: 500 }}>{agent.desc}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, position: 'relative' }}>
        <button className="toolbar-btn" title={ttsEnabled ? 'Désactiver lecture vocale' : 'Activer lecture vocale (TTS)'} onClick={onToggleTTS} style={ttsEnabled ? { background: C.emerald, color: C.cream } : {}}>
          <PhoneCall size={16} />
        </button>
        <button className="toolbar-btn" title="Voir profil agent" onClick={() => setProfileOpen(true)}><UserCircle size={16} /></button>
        <button className="toolbar-btn" title="Historique des conversations" onClick={onShowHistory}><History size={16} /></button>
        <button
          className="toolbar-btn"
          title={hasInput ? 'Effacer ce que je tape' : 'Aucun texte à effacer'}
          onClick={onClearInput}
          disabled={!hasInput}
          style={!hasInput ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        ><Eraser size={16} /></button>
        <button className="toolbar-btn" title="Nouvelle conversation" onClick={onNewConversation}><Plus size={16} /></button>
        <button className="toolbar-btn" title="Plus d'options" onClick={() => setMenuOpen(o => !o)}><MoreHorizontal size={16} /></button>
        {menuOpen && (
          <div style={{ position: 'absolute', top: 38, right: 0, background: C.cream, borderRadius: 12, border: '1px solid rgba(10,42,32,0.1)', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.2)', padding: 6, minWidth: 220, zIndex: 30 }}>
            <button onClick={() => { onNewConversation?.(); setMenuOpen(false); }} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={14} /> Nouvelle conversation
            </button>
            <button onClick={() => { onToggleTTS?.(); setMenuOpen(false); }} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: ttsEnabled ? C.emeraldDeep : C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
              <PhoneCall size={14} /> {ttsEnabled ? '🔊 Lecture vocale ON' : '🔇 Activer lecture vocale'}
            </button>
            <button onClick={openVoiceAgent} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mic size={14} /> Ouvrir l'agent voice (Gemini Live)
            </button>
            {conversationId && (
              <button onClick={handleDelete} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                <X size={14} /> Supprimer cette conversation
              </button>
            )}
          </div>
        )}
        {profileOpen && (
          <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,42,32,0.5)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: C.cream, borderRadius: 20, maxWidth: 480, width: '100%', overflow: 'hidden' }}>
              <div style={{ padding: 24, background: `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`, color: C.cream, position: 'relative' }}>
                <button onClick={() => setProfileOpen(false)} style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', color: C.cream, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                <div style={{ fontSize: 56, marginBottom: 12 }}>{agent.emoji}</div>
                <h3 className="display-font" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{agent.name}</h3>
                <p style={{ fontSize: 13, opacity: 0.9, margin: '6px 0 0' }}>{agent.desc}</p>
              </div>
              <div style={{ padding: 20, fontSize: 13, color: C.ink, lineHeight: 1.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: C.inkSoft }}>ID Agent</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{agent.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: C.inkSoft }}>Catégorie</span>
                  <span style={{ fontWeight: 600 }}>{agent.category || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: C.inkSoft }}>Statut</span>
                  <span style={{ color: C.emeraldDeep, fontWeight: 700 }}>● {agent.status === 'online' ? 'En ligne' : 'Hors ligne'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: C.inkSoft }}>Modèle</span>
                  <span style={{ fontWeight: 600 }}>Gemini Pro · Genkit</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ CHAT AREA ============
function ChatArea({ agent, onToggleAgents, conversationId, onConversationCreated }: any) {
  const [input, setInput] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);
  // Track which conversation we already loaded to avoid race conditions during streaming
  const loadedConvIdRef = useRef<string | null>(null);

  // Insert text at cursor in textarea
  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) { setInput(prev => prev + text); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = input.slice(0, start) + text + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  // ─── Voice dictation with smart trigger words + silence auto-send ───
  // SEND TRIGGERS: stop listening + submit current text (without the trigger word)
  const SEND_TRIGGERS = ['envoie', 'envoyer', 'envoi', 'send', 'go', 'vas-y', 'vas y', 'envoie-le', 'envoie le'];
  // CANCEL TRIGGERS: clear current text but keep mic listening
  const CANCEL_TRIGGERS = ['annule', 'annuler', 'efface', 'cancel', 'reset', 'recommence'];
  // STOP TRIGGERS: stop mic without sending
  const STOP_TRIGGERS = ['stop', 'arrête', 'arreter', 'arrête-toi', 'fin'];
  const SILENCE_AUTO_SEND_MS = 2500; // auto-send after 2.5s of silence
  const silenceTimerRef = useRef<any>(null);

  // Strip trigger word from end of text
  const stripTrigger = (text: string, triggers: string[]): string => {
    const lower = text.toLowerCase().trim();
    for (const t of triggers) {
      // Match the trigger as a final word (allowing punctuation)
      const re = new RegExp(`\\b${t.replace(/-/g, '[-\\s]?')}[.!?\\s]*$`, 'i');
      if (re.test(lower)) {
        return text.replace(re, '').trim();
      }
    }
    return text;
  };

  const detectTrigger = (text: string, triggers: string[]): boolean => {
    const lower = text.toLowerCase().trim();
    return triggers.some(t => {
      const re = new RegExp(`\\b${t.replace(/-/g, '[-\\s]?')}[.!?\\s]*$`, 'i');
      return re.test(lower);
    });
  };

  const toggleDictation = () => {
    const W: any = window;
    const SpeechRecognition = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('La dictée vocale n\'est pas supportée par ce navigateur. Utilise Chrome ou Edge.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;

    let finalText = '';

    const resetSilenceTimer = (currentText: string) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (!currentText.trim()) return;
      silenceTimerRef.current = setTimeout(() => {
        // Auto-send on silence
        try { rec.stop(); } catch {}
        setListening(false);
        // Use a microtask to ensure state has updated
        Promise.resolve().then(() => {
          if (currentText.trim()) {
            setInput(currentText.trim());
            // Trigger send
            setTimeout(() => handleSend(), 50);
          }
        });
      }, SILENCE_AUTO_SEND_MS);
    };

    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      const combined = (finalText + interim).trim();
      if (!combined) return;

      // Check STOP trigger
      if (detectTrigger(combined, STOP_TRIGGERS)) {
        const cleaned = stripTrigger(combined, STOP_TRIGGERS);
        setInput(cleaned);
        try { rec.stop(); } catch {}
        setListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        return;
      }

      // Check CANCEL trigger → clear input, keep listening
      if (detectTrigger(combined, CANCEL_TRIGGERS)) {
        finalText = '';
        setInput('');
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        return;
      }

      // Check SEND trigger → strip word + send
      if (detectTrigger(combined, SEND_TRIGGERS)) {
        const cleaned = stripTrigger(combined, SEND_TRIGGERS);
        try { rec.stop(); } catch {}
        setListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (cleaned) {
          setInput(cleaned);
          // Send after a short delay to ensure state is updated
          setTimeout(() => handleSend(), 80);
        }
        return;
      }

      // Otherwise: just update input + reset silence timer
      setInput(combined);
      resetSilenceTimer(combined);
    };

    rec.onerror = () => {
      setListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
    rec.onend = () => {
      setListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  // File attach
  const handleFilePick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setAttachments(prev => [...prev, ...files]);
    // Append a hint to the input so user sees the file is queued
    insertAtCursor(`\n[📎 ${files.map(f => f.name).join(', ')}]\n`);
    if (e.target) e.target.value = '';
  };

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  // Load messages only when we navigate to a DIFFERENT conversation (not when we just created one mid-stream)
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      loadedConvIdRef.current = null;
      return;
    }
    // If we just created this conversation in handleSend (loadedConvIdRef set BEFORE prop update) — skip refetch
    if (loadedConvIdRef.current === conversationId) return;
    // Different conversation → clear and load fresh
    loadedConvIdRef.current = conversationId;
    setMessages([]);
    setLoading(true);
    api.get(`/chat/conversations/${conversationId}/messages`)
      .then((r: any) => {
        const msgs = (r?.data?.messages ?? r?.data ?? []).map((m: any) => ({
          role: m.role === 'assistant' ? 'agent' : (m.role || (m.author === 'user' ? 'user' : 'agent')),
          text: m.content || m.text || '',
          time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        }));
        setMessages(msgs);
        setShowQuickActions(msgs.length === 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleInputChange = (e: any) => {
    const ta = e.target;
    setInput(ta.value);
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    setShowQuickActions(false);
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMessages(m => [...m, { role: 'user', text, time: now }]);
    setInput('');
    setShowQuickActions(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);

    try {
      // 1. Create conversation if needed
      let convId = conversationId;
      if (!convId) {
        const created: any = await api.post('/chat/conversations', { agentId: agent.id, title: agent.name });
        convId = created?.data?.id || created?.data?.conversationId;
        if (convId) {
          // Mark as already loaded so the useEffect won't refetch + overwrite our streaming messages
          loadedConvIdRef.current = convId;
          onConversationCreated?.(convId, agent.id);
        }
      }
      if (!convId) throw new Error('Impossible de créer la conversation');

      // 2. Add empty agent message — will fill progressively from SSE stream
      const startTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setMessages(m => [...m, { role: 'agent', text: '', time: startTime }]);

      // 3. Stream via fetch + ReadableStream (SSE)
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';
      // Use /agent endpoint — dispatches to specialist agent (hr/accounting/etc.) instead of generic Q&A
      const response = await fetch(`/api/agent/conversations/${convId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: text, agentId: agent.id }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} — ${errBody.slice(0, 200) || response.statusText}`);
      }
      if (!response.body) throw new Error('Pas de stream de réponse');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let agentText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE events split by \n\n
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const evt of events) {
          if (!evt.trim()) continue;
          // Parse "data: {...}" lines
          for (const line of evt.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const data = JSON.parse(payload);
              if (data.content) {
                agentText += data.content;
                // Update the LAST agent message with accumulated text
                setMessages(m => {
                  const copy = [...m];
                  if (copy.length > 0 && copy[copy.length - 1].role === 'agent') {
                    copy[copy.length - 1] = { ...copy[copy.length - 1], text: agentText };
                  }
                  return copy;
                });
              }
              if (data.error) throw new Error(data.error);
            } catch (parseErr: any) {
              // Skip malformed JSON chunks unless it's a real error to propagate
              if (parseErr?.message && !parseErr.message.includes('JSON')) throw parseErr;
            }
          }
        }
      }

      if (!agentText) {
        setMessages(m => {
          const copy = [...m];
          if (copy.length > 0 && copy[copy.length - 1].role === 'agent') {
            copy[copy.length - 1] = { ...copy[copy.length - 1], text: '⚠ Stream vide. Vérifie config Gemini/Claude au backend.' };
          }
          return copy;
        });
      } else if (ttsEnabled && 'speechSynthesis' in window) {
        // Read agent reply aloud (strip markdown for cleaner speech)
        const cleanText = agentText
          .replace(/```[\s\S]*?```/g, ' ') // remove code blocks
          .replace(/[#*_`>~\[\]()]/g, ' ') // strip markdown
          .replace(/https?:\/\/\S+/g, '') // strip URLs
          .replace(/\s+/g, ' ')
          .trim();
        if (cleanText) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = 'fr-FR';
          utterance.rate = 1.05;
          window.speechSynthesis.speak(utterance);
        }
      }
    } catch (e: any) {
      const status = e?.status || e?.response?.status;
      const detail = e?.response?.data?.message || e?.message || 'Erreur inconnue';
      setMessages(m => {
        // Replace the empty agent placeholder with error, or append a new error msg
        const copy = [...m];
        if (copy.length > 0 && copy[copy.length - 1].role === 'agent' && !copy[copy.length - 1].text) {
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            text: `⚠ Erreur ${status ?? ''} — ${detail}`,
          };
        } else {
          copy.push({
            role: 'agent',
            text: `⚠ Erreur ${status ?? ''} — ${detail}`,
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          });
        }
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', background: C.creamDeep, position: 'relative' }}>
      <ChatHeader
        agent={agent}
        onToggleAgents={onToggleAgents}
        conversationId={conversationId}
        ttsEnabled={ttsEnabled}
        hasInput={input.trim().length > 0}
        onClearInput={() => {
          setInput('');
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
          textareaRef.current?.focus();
        }}
        onShowHistory={() => setHistoryOpen(true)}
        onToggleTTS={() => {
          if (ttsEnabled) {
            window.speechSynthesis.cancel();
            setTtsEnabled(false);
          } else {
            setTtsEnabled(true);
          }
        }}
        onNewConversation={() => {
          loadedConvIdRef.current = null;
          setMessages([]);
          setShowQuickActions(true);
          onConversationCreated?.(null, agent.id);
        }}
      />

      {historyOpen && (
        <ConversationHistoryDrawer
          agentId={agent.id}
          currentConversationId={conversationId}
          onClose={() => setHistoryOpen(false)}
          onSelect={(cid: string) => {
            setHistoryOpen(false);
            loadedConvIdRef.current = null;
            setMessages([]);
            setShowQuickActions(false);
            onConversationCreated?.(cid, agent.id);
          }}
        />
      )}

      <div className="chat-area nice-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', background: C.creamDeep, position: 'relative', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="oui-watermark">
          <svg width="280" height="280" viewBox="0 0 280 280">
            <defs>
              <linearGradient id="ouiGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={C.purpleDeep} />
                <stop offset="100%" stopColor={C.greenDeep} />
              </linearGradient>
            </defs>
            <circle cx="140" cy="140" r="130" stroke="url(#ouiGrad)" strokeWidth="3" fill="none" />
            <circle cx="140" cy="140" r="90" stroke="url(#ouiGrad)" strokeWidth="2" fill="none" />
            <text x="140" y="150" textAnchor="middle" fill="url(#ouiGrad)" fontSize="38" fontWeight="800" fontFamily="Fraunces, serif" letterSpacing="-0.02em">ORLODE</text>
            <text x="140" y="175" textAnchor="middle" fill={C.greenDeep} fontSize="11" fontWeight="600" letterSpacing="0.3em">AI · UNITED</text>
          </svg>
        </div>

        {messages.length === 0 && !loading && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 32, textAlign: 'center', minHeight: 300 }}>
            <div className="avatar-grad" style={{ width: 80, height: 80, background: `linear-gradient(135deg, ${agent.color} 0%, ${agent.color}cc 100%)`, fontSize: 40, marginBottom: 18, boxShadow: `0 16px 32px -8px ${agent.color}` }}>
              {agent.emoji}
            </div>
            <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
              Discuter avec {agent.name}
            </h3>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 20px', maxWidth: 380 }}>
              {agent.desc}. Tape ton message ci-dessous ou utilise une action rapide.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} style={{ position: 'relative' }}>
            <MessageBubble msg={msg} agent={agent} />
          </div>
        ))}

        {sending && <TypingIndicator agent={agent} />}

        <div ref={messagesEndRef} />
      </div>

      {showQuickActions && messages.length === 0 && (
        <div style={{ padding: '8px 24px 0', background: C.creamDeep }}>
          <div className="nice-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', padding: '8px 4px 8px 0', whiteSpace: 'nowrap', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={11} color={C.purpleDeep} /> ACTIONS RAPIDES
            </span>
            {QUICK_PROMPTS.map((qp, i) => {
              const Icon = qp.icon;
              return (
                <button key={i} onClick={() => handleQuickPrompt(qp.prompt)} className="quick-prompt">
                  <Icon size={13} color={qp.color} />{qp.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: '16px 24px 20px', background: C.creamDeep, flexShrink: 0 }}>
        <div className="chat-textarea" style={{ background: C.cream, borderRadius: 20, border: `1.5px solid rgba(10,42,32,0.08)`, padding: '14px 18px', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 16px -8px rgba(10,42,32,0.1)', ['--agent-color' as any]: agent.color, ['--agent-color-soft' as any]: `${agent.color}20` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(10,42,32,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg, ${agent.color} 0%, ${agent.color}cc 100%)`, color: C.cream, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{agent.emoji}</div>
              <span style={{ fontSize: 12, color: C.ink, fontWeight: 600 }}>
                Vous parlez à <strong style={{ color: agent.color }}>{agent.name}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="mono-font" style={{ fontSize: 10, color: C.inkLight, fontWeight: 600 }}>Powered by Gemini Pro</span>
              <Sparkles size={11} color={C.purpleDeep} />
            </div>
          </div>
          <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={listening ? '🎤 Parlez… dites "envoie" pour envoyer, "annule" pour effacer, "stop" pour arrêter' : `Demandez n'importe quoi à ${agent.name}…  (Maj+Entrée pour nouvelle ligne)`} rows={2} style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 17, color: C.ink, fontFamily: 'inherit', resize: 'none', minHeight: 56, maxHeight: 220, lineHeight: 1.55 }} />
          {listening && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
              padding: '8px 14px', borderRadius: 100,
              background: 'linear-gradient(90deg, rgba(239,68,68,0.12), rgba(239,68,68,0.05))',
              border: '1px solid rgba(239,68,68,0.3)',
              fontSize: 12, color: C.red, fontWeight: 600,
              animation: 'pulse-listen 1.5s ease-in-out infinite',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                {[0, 0.15, 0.3, 0.45].map(d => (
                  <span key={d} style={{
                    width: 3, height: 14,
                    background: C.red, borderRadius: 2,
                    animation: `wave-bar 0.9s ease-in-out ${d}s infinite`,
                  }} />
                ))}
              </span>
              <span>Écoute en cours… auto-envoi après 2,5s de silence</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', fontSize: 10, fontWeight: 700 }}>« envoie »</span>
                <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', fontSize: 10, fontWeight: 700 }}>« annule »</span>
                <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', fontSize: 10, fontWeight: 700 }}>« stop »</span>
              </span>
              <style>{`
                @keyframes pulse-listen { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }
                @keyframes wave-bar { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
              `}</style>
            </div>
          )}
          <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} accept="*/*" />
          {attachments.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {attachments.map((f, i) => (
                <span key={i} style={{ background: C.creamDeep, padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, color: C.ink, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  📎 {f.name} ({Math.round(f.size / 1024)} KB)
                  <button onClick={() => removeAttachment(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft, padding: 0, fontSize: 12 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
            <div style={{ display: 'flex', gap: 2 }}>
              <button className="toolbar-btn" title="Joindre fichier" onClick={handleFilePick}><Paperclip size={16} /></button>
              <button className="toolbar-btn" title="Mentionner @" onClick={() => insertAtCursor('@')}><AtSign size={16} /></button>
              <button className="toolbar-btn" title="Bloc de code" onClick={() => insertAtCursor('\n```\n\n```\n')}><Code size={16} /></button>
              <button className="toolbar-btn" title="Sauver brouillon" onClick={() => { localStorage.setItem(`chat-draft-${agent.id}`, input); }}><Bookmark size={16} /></button>
              <button
                className="toolbar-btn"
                title={listening ? 'Arrêter la dictée (ou dis "stop")' : 'Dicter — dis "envoie" pour envoyer'}
                onClick={toggleDictation}
                style={listening ? {
                  background: C.red,
                  color: C.cream,
                  boxShadow: '0 0 0 0 rgba(239,68,68,0.5)',
                  animation: 'mic-pulse 1.4s ease-in-out infinite',
                } : {}}
              >
                <Mic size={16} />
                <style>{`@keyframes mic-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); } 50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); } }`}</style>
              </button>
            </div>
            <button className="send-btn" disabled={!input.trim() || sending} onClick={handleSend}>
              {sending ? <Clock size={18} /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// ============ MAIN ============
export default function AIChatPage() {
  const [activeAgent, setActiveAgent] = useState('orch');
  const [agentsListOpen, setAgentsListOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [agentToConv, setAgentToConv] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/chat/conversations')
      .then((r: any) => {
        const list = r?.data?.conversations ?? r?.data ?? [];
        setConversations(list);
        const map: Record<string, string> = {};
        list.forEach((c: any) => { if (c.agentId) map[c.agentId] = c.id; });
        setAgentToConv(map);
      })
      .catch(() => setConversations([]));
  }, []);

  const agent = AGENTS.find(a => a.id === activeAgent) || AGENTS[0];
  const conversationId = agentToConv[activeAgent];

  const handleConversationCreated = (convId: string | null, agentId: string) => {
    setAgentToConv(m => {
      const next = { ...m };
      if (convId === null) delete next[agentId];
      else next[agentId] = convId;
      return next;
    });
  };

  return (
    <div className="ai-chat-light-shell" style={{ display: 'flex', height: 'calc(100vh - 64px)', background: C.creamDeep, fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <style>{GLOBAL_STYLES}</style>
      {agentsListOpen && (<div className="agents-list-overlay open" onClick={() => setAgentsListOpen(false)}></div>)}
      <AgentsList activeAgent={activeAgent} onSelect={setActiveAgent} isOpen={agentsListOpen} onClose={() => setAgentsListOpen(false)} conversations={conversations} />
      <ChatArea agent={agent} onToggleAgents={() => setAgentsListOpen(true)} conversationId={conversationId} onConversationCreated={handleConversationCreated} />
    </div>
  );
}
