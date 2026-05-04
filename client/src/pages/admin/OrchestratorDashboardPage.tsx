/**
 * OrchestratorDashboardPage — Brain control center
 * Live monitoring + agent test panel
 * Backend: GET /agents/health · GET /agents/traces · POST /chat/conversations
 */
import { useEffect, useRef, useState } from 'react';
import {
  Brain, Loader2, Activity, AlertTriangle, CheckCircle2, Clock, Zap, Shield, RefreshCw,
  ChevronDown, Send, Bot, MessageCircle, Sparkles, Cpu, GitBranch, X,
} from 'lucide-react';
import api from '@/services/api';
import { auth } from '@/services/firebase';
import { toast } from '@/components/common/Toast';

interface AgentHealth { name: string; totalCalls: number; failures: number; avgLatencyMs: number; circuitOpen: boolean; lastCallAt: string | null }
interface TraceEntry { id: string; timestamp: string; message: string; intent: { agent: string; confidence: number; category: string; isMultiAgent: boolean }; totalLatencyMs: number; agentsUsed: string[]; toolsCalled: string[]; steps: number; errors: number }

const AGENT_LABELS: Record<string, string> = {
  callSalesAgent: 'Sales', callHRAgent: 'RH', callAccountingAgent: 'Comptabilité',
  callITAgent: 'IT', callCybersecurityAgent: 'Cybersécurité', callReceptionAgent: 'Réception',
  callMarketingAgent: 'Marketing', callSupportAgent: 'Support', callLegalAgent: 'Juridique',
  callTrainingAgent: 'Formation', callNewsAgent: 'Veille', callCoachAgent: 'Coach',
  callDataScientistAgent: 'Data Scientist', callWildcardAgent: 'Wildcard',
  askQAAgent: 'Q&A', callKnowledgeAgent: 'Knowledge', draftCommunication: 'Comms',
  generateInsights: 'Insights', analyzeMeeting: 'Meeting', analyzeImage: 'Vision',
};

const TEST_AGENTS = [
  { id: 'hr',         name: 'RH',           emoji: '👥', sample: 'Combien de jours de congés me reste-t-il ?' },
  { id: 'accounting', name: 'Comptabilité', emoji: '💰', sample: 'Quelles factures sont en retard ?' },
  { id: 'sales',      name: 'Sales',        emoji: '🎯', sample: 'Liste mes 5 leads les plus chauds' },
  { id: 'reception',  name: 'Réception',    emoji: '🚪', sample: 'Qui est dans le bâtiment maintenant ?' },
  { id: 'marketing',  name: 'Marketing',    emoji: '📣', sample: 'Génère un post LinkedIn pour annoncer la rentrée' },
  { id: 'legal',      name: 'Juridique',    emoji: '⚖️', sample: 'Quelles échéances OHADA dans 30 jours ?' },
  { id: 'knowledge',  name: 'Knowledge',    emoji: '🧠', sample: 'Résume nos 3 derniers contrats clients' },
  { id: 'comms',      name: 'Comms',        emoji: '💬', sample: 'Rédige un email de relance pour les donateurs' },
  { id: 'support',    name: 'Support',      emoji: '🆘', sample: 'Combien de tickets ouverts cette semaine ?' },
  { id: 'orchestrator', name: 'Auto (orchestrator)', emoji: '🎼', sample: 'Quel est le bilan global de mes opérations ?' },
];

const C = {
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  violet:      '#7C3AED',
  violetDeep:  '#5B21B6',
  violetSoft:  '#EDE9FE',
  pink:        '#EC4899',
  pinkSoft:    '#FCE7F3',
  gold:        '#D4A017',
  goldDeep:    '#B45309',
  goldSoft:    '#FEF3C7',
  emerald:     '#10B981',
  emeraldSoft: '#D1FAE5',
  emeraldDeep: '#059669',
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  redDeep:     '#DC2626',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  blue:        '#0EA5E9',
  blueSoft:    '#E0F2FE',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  onGreenSoft: '#A8C9B8',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  .orch-root { font-family: 'Inter', sans-serif; }
  .orch-display { font-family: 'Fraunces', serif; letter-spacing: -0.02em; }
  .orch-mono { font-family: 'JetBrains Mono', monospace; }
  @keyframes orchPulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.6); opacity: 0; } }
  .orch-live::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.emerald}; opacity: 0.4; animation: orchPulse 1.8s ease-in-out infinite; }
  @keyframes orchSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .orch-spin { animation: orchSpin 1s linear infinite; }
`;

export default function OrchestratorDashboardPage() {
  const [health, setHealth] = useState<AgentHealth[]>([]);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/agents/health').then(r => setHealth((r.data as any)?.data ?? [])),
      api.get('/agents/traces').then(r => setTraces((r.data as any)?.data ?? [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const totalCalls = health.reduce((s, h) => s + h.totalCalls, 0);
  const totalFailures = health.reduce((s, h) => s + h.failures, 0);
  const avgLatency = health.length > 0 ? Math.round(health.reduce((s, h) => s + h.avgLatencyMs, 0) / health.length) : 0;
  const circuitOpen = health.filter(h => h.circuitOpen).length;
  const topAgents = [...health].sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 12);

  const intentCounts: Record<string, number> = {};
  traces.forEach(t => { const c = t.intent.category; intentCounts[c] = (intentCounts[c] ?? 0) + 1; });
  const intentDistribution = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="orch-root" style={{ background: C.greenDeep, minHeight: '100vh' }}>
      <style>{STYLES}</style>

      {/* Hero */}
      <div style={{ padding: '32px 32px 0' }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.violetDeep} 0%, ${C.violet} 50%, ${C.pink} 100%)`,
          borderRadius: 24, padding: '32px 36px',
          position: 'relative', overflow: 'hidden',
          color: C.cream,
          boxShadow: `0 30px 60px -20px ${C.violet}80`,
        }}>
          <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.15 }} width="320" height="320" viewBox="0 0 320 320">
            <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="160" cy="160" r="60" stroke={C.gold} strokeWidth="2" fill="none" />
          </svg>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div style={{ flex: 1, minWidth: 320 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: 'rgba(255,250,240,0.2)', fontSize: 11, fontWeight: 700 }}>
                  <span className="orch-live" style={{ width: 8, height: 8, borderRadius: '50%', background: C.emerald, position: 'relative', display: 'inline-block' }}></span>
                  ORCHESTRATOR · {health.length} AGENTS REGISTERED
                </span>
              </div>
              <h1 className="orch-display" style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.0, margin: 0, color: C.cream }}>
                Le <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>cerveau central</em>
              </h1>
              <p style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,0.85)', maxWidth: 560 }}>
                Genkit + Gemini Pro · 18+ agents spécialistes en tools · Routing automatique selon l'intent · Circuit breakers · Traces complètes
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setTestOpen(true)} style={{
                background: C.cream, color: C.violetDeep,
                padding: '12px 22px', borderRadius: 12, border: 'none',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 24px -8px rgba(0,0,0,0.3)',
              }}>
                <Sparkles size={14} /> Tester un agent
              </button>
              <button onClick={load} disabled={loading} style={{
                background: 'rgba(255,250,240,0.15)', color: C.cream,
                padding: '12px 18px', borderRadius: 12,
                border: '1.5px solid rgba(255,250,240,0.3)',
                fontWeight: 700, fontSize: 13, cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <RefreshCw size={14} className={loading ? 'orch-spin' : ''} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ padding: '24px 32px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14 }}>
          {[
            { label: 'Appels total', value: totalCalls, color: C.violet, bg: C.violetSoft, icon: Zap },
            { label: 'Latence moy.', value: `${avgLatency}ms`, color: C.blue, bg: C.blueSoft, icon: Clock },
            { label: 'Erreurs', value: totalFailures, color: totalFailures > 0 ? C.red : C.emeraldDeep, bg: totalFailures > 0 ? C.redSoft : C.emeraldSoft, icon: AlertTriangle },
            { label: 'Circuits ouverts', value: circuitOpen, color: circuitOpen > 0 ? C.red : C.emeraldDeep, bg: circuitOpen > 0 ? C.redSoft : C.emeraldSoft, icon: Shield },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 18, padding: 18, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.color }}/>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <div className="orch-display orch-mono" style={{ fontSize: 28, fontWeight: 800, color: C.ink, lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>{k.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Health + Intents */}
      <div style={{ padding: '24px 32px 0', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <div style={{ background: C.cream, borderRadius: 20, padding: 20, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h2 className="orch-display" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color={C.violet} /> Santé des <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>agents</em>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topAgents.length === 0 ? (
              <p style={{ fontSize: 12, color: C.inkSoft, padding: '20px 0', textAlign: 'center' }}>
                Aucun appel enregistré. Utilise le bouton "Tester un agent" pour générer du trafic.
              </p>
            ) : topAgents.map(h => {
              const max = Math.max(...topAgents.map(a => a.totalCalls), 1);
              return (
                <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: h.circuitOpen ? C.red : h.failures > 0 ? C.yellow : C.emerald,
                    flexShrink: 0,
                  }}/>
                  <span className="orch-mono" style={{ fontSize: 11, color: C.ink, width: 110, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {AGENT_LABELS[h.name] ?? h.name}
                  </span>
                  <div style={{ flex: 1, height: 6, background: C.creamDeep, borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(h.totalCalls / max) * 100}%`, background: h.circuitOpen ? C.red : `linear-gradient(90deg, ${C.violet}, ${C.pink})`, borderRadius: 100 }}/>
                  </div>
                  <span className="orch-mono" style={{ fontSize: 11, fontWeight: 700, color: C.ink, width: 32, textAlign: 'right' }}>{h.totalCalls}</span>
                  <span className="orch-mono" style={{ fontSize: 10, color: C.inkSoft, width: 50, textAlign: 'right' }}>{h.avgLatencyMs}ms</span>
                  {h.failures > 0 && <span className="orch-mono" style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>{h.failures}❌</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: C.cream, borderRadius: 20, padding: 20, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h2 className="orch-display" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={16} color={C.pink} /> Intents <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.pink }}>fréquents</em>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {intentDistribution.length === 0 ? (
              <p style={{ fontSize: 12, color: C.inkSoft, padding: '20px 0', textAlign: 'center' }}>Aucune trace.</p>
            ) : intentDistribution.map(([cat, count]) => {
              const max = Math.max(...intentDistribution.map(([, c]) => c), 1);
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: C.ink, width: 110, fontWeight: 600, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                  <div style={{ flex: 1, height: 6, background: C.creamDeep, borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: `linear-gradient(90deg, ${C.pink}, ${C.violet})`, borderRadius: 100 }}/>
                  </div>
                  <span className="orch-mono" style={{ fontSize: 11, fontWeight: 700, color: C.ink, width: 32, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Traces */}
      <div style={{ padding: '24px 32px 32px' }}>
        <div style={{ background: C.cream, borderRadius: 20, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="orch-display" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitBranch size={16} color={C.gold} /> Traces <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>récentes</em>
              <span className="orch-mono" style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500, marginLeft: 6 }}>({traces.length})</span>
            </h2>
            <span className="orch-mono" style={{ fontSize: 10, color: C.inkSoft }}>auto-refresh 15s</span>
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {traces.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.inkSoft }}>
                <Cpu size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
                <p style={{ fontSize: 13, margin: '0 0 4px', fontWeight: 600, color: C.ink }}>Aucune trace pour l'instant</p>
                <p style={{ fontSize: 11, margin: 0 }}>Les exécutions de l'orchestrator apparaîtront ici en temps réel.</p>
              </div>
            ) : traces.map(t => (
              <div key={t.id} style={{ borderBottom: '1px solid rgba(10,42,32,0.04)' }}>
                <button onClick={() => setExpandedTrace(expandedTrace === t.id ? null : t.id)} style={{
                  width: '100%', textAlign: 'left',
                  padding: '12px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.errors > 0 ? C.red : C.emerald, flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: C.ink, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.message}</p>
                    <div style={{ display: 'flex', gap: 10, fontSize: 10, color: C.inkSoft, fontWeight: 500 }}>
                      <span style={{ color: C.violet, fontWeight: 700 }}>{t.intent.category}</span>
                      <span className="orch-mono">{(t.intent.confidence * 100).toFixed(0)}%</span>
                      <span className="orch-mono">{t.totalLatencyMs}ms</span>
                      <span>{t.agentsUsed.length} agent{t.agentsUsed.length > 1 ? 's' : ''}</span>
                      {t.errors > 0 && <span style={{ color: C.red, fontWeight: 700 }}>{t.errors} err</span>}
                    </div>
                  </div>
                  <ChevronDown size={14} style={{ color: C.inkSoft, transform: expandedTrace === t.id ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}/>
                </button>
                {expandedTrace === t.id && (
                  <div style={{ padding: '0 20px 14px', background: C.creamDeep, fontSize: 11 }}>
                    <div style={{ padding: 12, background: C.cream, borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', color: C.ink, lineHeight: 1.6 }}>
                      <div><strong>Intent:</strong> {t.intent.agent} ({(t.intent.confidence * 100).toFixed(0)}%) · {t.intent.category}{t.intent.isMultiAgent ? ' · multi-agent' : ''}</div>
                      <div><strong>Agents:</strong> {t.agentsUsed.map(a => AGENT_LABELS[a] ?? a).join(', ') || 'aucun'}</div>
                      <div><strong>Tools:</strong> {t.toolsCalled.join(', ') || 'aucun'}</div>
                      <div><strong>Latence:</strong> {t.totalLatencyMs}ms · {t.steps} étapes</div>
                      <div><strong>Heure:</strong> {new Date(t.timestamp).toLocaleString('fr-FR')}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Test agent modal */}
      {testOpen && <TestPanel onClose={() => { setTestOpen(false); load(); }} />}
    </div>
  );
}

// ============ TEST PANEL — live agent invocation ============
function TestPanel({ onClose }: { onClose: () => void }) {
  const [agentId, setAgentId] = useState('orchestrator');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; text: string; time: string; agent?: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async (raw?: string) => {
    const content = (raw ?? input).trim();
    if (!content || sending) return;
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setMessages(m => [...m, { role: 'user', text: content, time: now }]);
    setInput('');
    setSending(true);
    const t0 = Date.now();
    try {
      let id = convId;
      if (!id) {
        const created: any = await api.post('/chat/conversations', { agentId, title: `Test ${agentId}` });
        id = created?.data?.id ?? created?.data?.conversationId ?? null;
        if (id) setConvId(id);
      }
      if (!id) throw new Error('No conversation');

      // Add placeholder agent message → will accumulate from SSE stream
      const startTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setMessages(m => [...m, { role: 'agent', text: '', time: startTime }]);

      // Stream SSE via fetch
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';
      const response = await fetch(`/api/agent/conversations/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content, agentId }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} — ${errBody.slice(0, 200) || response.statusText}`);
      }
      if (!response.body) throw new Error('Pas de stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let agentText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const evt of events) {
          if (!evt.trim()) continue;
          for (const line of evt.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const data = JSON.parse(payload);
              if (data.content) {
                agentText += data.content;
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
              if (parseErr?.message && !parseErr.message.includes('JSON')) throw parseErr;
            }
          }
        }
      }

      const elapsed = Date.now() - t0;
      // Tag the agent message with timing meta
      setMessages(m => {
        const copy = [...m];
        if (copy.length > 0 && copy[copy.length - 1].role === 'agent') {
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            text: agentText || '⚠ Stream vide. Vérifie config backend.',
            agent: `${agentId} · ${elapsed}ms`,
          };
        }
        return copy;
      });
    } catch (e: any) {
      const status = e?.status || e?.response?.status;
      const detail = e?.response?.data?.message || e?.message || 'Agent ne répond pas.';
      toast.error(`Erreur ${status ?? ''}`.trim(), detail);
      setMessages(m => {
        const copy = [...m];
        if (copy.length > 0 && copy[copy.length - 1].role === 'agent' && !copy[copy.length - 1].text) {
          copy[copy.length - 1] = { ...copy[copy.length - 1], text: `⚠ Erreur ${status ?? ''} — ${detail}` };
        } else {
          copy.push({ role: 'agent', text: `⚠ Erreur ${status ?? ''} — ${detail}`, time: new Date().toLocaleTimeString('fr-FR') });
        }
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  const currentAgent = TEST_AGENTS.find(a => a.id === agentId);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(10,42,32,0.6)', backdropFilter: 'blur(8px)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 24, width: '100%', maxWidth: 720, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
          color: C.cream, display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="orch-display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Test live · <em style={{ fontStyle: 'italic', fontWeight: 500 }}>{currentAgent?.name}</em></h3>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Genkit + Gemini · vérifie chaque agent end-to-end</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.18)', border: 'none', color: C.cream, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Agent picker */}
        <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(10,42,32,0.06)', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 6, minWidth: 'min-content' }}>
            {TEST_AGENTS.map(a => (
              <button key={a.id} onClick={() => { setAgentId(a.id); setConvId(null); setMessages([]); }} style={{
                padding: '6px 12px', borderRadius: 100,
                background: agentId === a.id ? `linear-gradient(135deg, ${C.violet}, ${C.pink})` : C.creamDeep,
                color: agentId === a.id ? C.cream : C.ink,
                border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontSize: 14 }}>{a.emoji}</span> {a.name}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 18, background: C.creamDeep }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 12px' }}>Suggestion :</p>
              <button onClick={() => send(currentAgent?.sample || '')} style={{
                background: C.cream, color: C.violet,
                padding: '10px 16px', borderRadius: 12,
                border: `1.5px solid ${C.violet}40`, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                « {currentAgent?.sample} »
              </button>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <div style={{
                maxWidth: '85%', padding: '10px 14px', borderRadius: 14,
                background: m.role === 'user' ? `linear-gradient(135deg, ${C.violet}, ${C.pink})` : C.cream,
                color: m.role === 'user' ? C.cream : C.ink,
                fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                boxShadow: m.role === 'user' ? `0 4px 12px -4px ${C.violet}` : '0 2px 6px -2px rgba(0,0,0,0.1)',
              }}>
                {m.text}
                <div style={{ fontSize: 9, marginTop: 4, opacity: 0.6, fontFamily: 'JetBrains Mono, monospace' }}>
                  {m.time}{m.agent ? ` · ${m.agent}` : ''}
                </div>
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.inkSoft, fontSize: 12 }}>
              <Loader2 size={14} className="orch-spin" /> Agent réfléchit…
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: 14, background: C.cream, borderTop: '1px solid rgba(10,42,32,0.06)', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
            placeholder={`Demander à ${currentAgent?.name}…`}
            disabled={sending}
            style={{
              flex: 1, border: '1px solid rgba(10,42,32,0.12)', borderRadius: 12,
              padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.ink, background: C.creamDeep,
            }}
          />
          <button
            disabled={sending || !input.trim()}
            onClick={() => send()}
            style={{
              padding: '10px 18px', borderRadius: 12,
              background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
              color: C.cream, border: 'none', fontWeight: 700, fontSize: 13,
              cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: sending || !input.trim() ? 0.5 : 1,
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {sending ? <Loader2 size={14} className="orch-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
