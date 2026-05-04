/**
 * AgentWorkspacePage — Marketplace agent as a full app
 * Same design as built-in agent dashboards:
 *   Accueil (stats + features + actions) | Data tabs | Chat IA
 */
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, MessageCircle, Calendar, Users as UsersIcon, Package, FileText,
  Send, ArrowLeft, RefreshCw, Search, BarChart3,
  Shield, AlertTriangle, Camera, LayoutDashboard, ChevronRight, Sparkles,
  MessageSquare,
} from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';

interface AgentDetail {
  id: string; name: string; icon: string; description: string; industry: string;
  color: string; features: string[]; pricingModel: string; priceUSD: number;
  systemPrompt: string; tools: string[];
  installCount?: number; avgRating?: number; reviewCount?: number;
}

interface DataItem { id: string; [key: string]: unknown }

type TabDef = { id: string; label: string; icon: React.ReactNode };

export default function AgentWorkspacePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { formatShort } = useCurrency();

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  // Chat state
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Data states
  const [appointments, setAppointments] = useState<DataItem[]>([]);
  const [clients, setClients] = useState<DataItem[]>([]);
  const [stock, setStock] = useState<DataItem[]>([]);
  const [quotes, setQuotes] = useState<DataItem[]>([]);
  const [alerts, setAlerts] = useState<DataItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => { loadAgent(); }, [agentId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const loadAgent = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/marketplace/agents/${agentId}`);
      setAgent(res.data as AgentDetail);
    } catch {}
    setLoading(false);
  };

  const loadData = async (collection: string, setter: (d: DataItem[]) => void) => {
    setDataLoading(true);
    try {
      const res = await api.get(`/marketplace/workspace/${agentId}/data/${collection}`);
      const raw = res.data;
      setter(Array.isArray(raw) ? raw : []);
    } catch {}
    setDataLoading(false);
  };

  const onTabChange = (t: string) => {
    setTab(t);
    if (t === 'appointments') loadData('appointments', setAppointments);
    if (t === 'clients') loadData('clients', setClients);
    if (t === 'stock') loadData('inventory', setStock);
    if (t === 'quotes') loadData('quotes', setQuotes);
    if (t === 'alerts') loadData('alerts', setAlerts);
  };

  const sendChat = async () => {
    if (!chatMsg.trim() || chatLoading) return;
    const msg = chatMsg.trim();
    setChatMsg('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const res = await api.post(`/marketplace/workspace/${agentId}/chat`, { message: msg });
      const reply = (res.data as { reply?: string })?.reply ?? String(res.data);
      setChatHistory(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Erreur — réessayez.' }]);
    }
    setChatLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  if (!agent) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-6xl mb-4">🤖</p>
        <p className="text-gray-500 dark:text-gray-400">Agent non trouvé</p>
        <Link to="/marketplace" className="mt-4 text-sm text-blue-600 hover:underline block">Retour au marketplace</Link>
      </div>
    </div>
  );

  // Build tabs based on agent tools
  const tools = new Set(agent.tools ?? []);
  const allTabs: TabDef[] = [
    { id: 'overview', label: 'Accueil', icon: <LayoutDashboard size={13} /> },
  ];
  if (tools.has('createAppointment') || tools.has('listAppointments'))
    allTabs.push({ id: 'appointments', label: 'Rendez-vous', icon: <Calendar size={13} /> });
  if (tools.has('addClient') || tools.has('searchClients'))
    allTabs.push({ id: 'clients', label: 'Clients', icon: <UsersIcon size={13} /> });
  if (tools.has('checkStock') || tools.has('updateStock'))
    allTabs.push({ id: 'stock', label: 'Stock', icon: <Package size={13} /> });
  if (tools.has('createQuote'))
    allTabs.push({ id: 'quotes', label: 'Devis', icon: <FileText size={13} /> });
  if (tools.has('sendAlert') || tools.has('runSecurityCheck'))
    allTabs.push({ id: 'alerts', label: 'Alertes', icon: <AlertTriangle size={13} /> });
  if (tools.has('analyzeData') || tools.has('predictTrend'))
    allTabs.push({ id: 'analytics', label: 'Analytics', icon: <BarChart3 size={13} /> });
  if (tools.has('decodeOBD'))
    allTabs.push({ id: 'obd', label: 'Diagnostic OBD', icon: <Shield size={13} /> });
  if (tools.has('analyzePhoto'))
    allTabs.push({ id: 'photo', label: 'Analyse Photo', icon: <Camera size={13} /> });
  allTabs.push({ id: 'chat', label: 'Chat IA', icon: <MessageSquare size={13} /> });

  const gradientColor = agent.color || 'from-violet-600 to-violet-400';

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className={`bg-gradient-to-r ${gradientColor} px-4 sm:px-6 py-4 text-white flex-shrink-0`}>
        <div className="flex items-center gap-3">
          <Link to="/marketplace" className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <span className="text-2xl sm:text-3xl">{agent.icon}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold truncate">{agent.name}</h1>
            <p className="text-xs sm:text-sm opacity-80 truncate hidden sm:block">
              {agent.industry} · {agent.features?.length ?? 0} fonctionnalités
            </p>
          </div>
          <span className="px-2.5 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider hidden md:block">
            Marketplace
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 overflow-x-auto">
        <div className="flex min-w-max px-2 sm:px-4">
          {allTabs.map(t => (
            <button key={t.id} onClick={() => onTabChange(t.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <OverviewTab agent={agent} gradientColor={gradientColor} onSelectTab={onTabChange}
            dataTabs={allTabs.filter(t => t.id !== 'overview' && t.id !== 'chat')} />
        )}
        {tab === 'chat' && (
          <ChatPanel agent={agent} gradientColor={gradientColor}
            chatHistory={chatHistory} chatMsg={chatMsg} setChatMsg={setChatMsg}
            chatLoading={chatLoading} sendChat={sendChat} chatEndRef={chatEndRef} />
        )}
        {tab === 'appointments' && (
          <DataTable title="Rendez-vous" data={appointments} loading={dataLoading}
            onRefresh={() => loadData('appointments', setAppointments)}
            columns={[{ key: 'date', label: 'Date' }, { key: 'time', label: 'Heure' }, { key: 'clientName', label: 'Client' }, { key: 'service', label: 'Service' }, { key: 'status', label: 'Statut' }]}
            emptyMsg="Aucun rendez-vous. Demandez à l'agent d'en créer via le chat !" />
        )}
        {tab === 'clients' && (
          <DataTable title="Clients" data={clients} loading={dataLoading}
            onRefresh={() => loadData('clients', setClients)}
            columns={[{ key: 'name', label: 'Nom' }, { key: 'phone', label: 'Téléphone' }, { key: 'email', label: 'Email' }, { key: 'tags', label: 'Tags' }, { key: 'visits', label: 'Visites' }]}
            emptyMsg="Aucun client. Demandez à l'agent d'en ajouter via le chat !" />
        )}
        {tab === 'stock' && (
          <DataTable title="Stock / Inventaire" data={stock} loading={dataLoading}
            onRefresh={() => loadData('inventory', setStock)}
            columns={[{ key: 'name', label: 'Produit' }, { key: 'quantity', label: 'Quantité' }, { key: 'unit', label: 'Unité' }, { key: 'price', label: 'Prix' }]}
            emptyMsg="Aucun produit en stock." />
        )}
        {tab === 'quotes' && (
          <DataTable title="Devis" data={quotes} loading={dataLoading}
            onRefresh={() => loadData('quotes', setQuotes)}
            columns={[{ key: 'clientName', label: 'Client' }, { key: 'total', label: 'Total' }, { key: 'status', label: 'Statut' }]}
            emptyMsg="Aucun devis. Demandez à l'agent de créer un devis via le chat !" />
        )}
        {tab === 'alerts' && (
          <DataTable title="Alertes" data={alerts} loading={dataLoading}
            onRefresh={() => loadData('alerts', setAlerts)}
            columns={[{ key: 'severity', label: 'Sévérité' }, { key: 'title', label: 'Titre' }, { key: 'message', label: 'Message' }]}
            emptyMsg="Aucune alerte." />
        )}
        {tab === 'analytics' && (
          <div className="p-4 sm:p-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-8 text-center">
              <BarChart3 size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300 font-medium mb-2">Analytics {agent.name}</p>
              <p className="text-sm text-gray-400 mb-4">Demandez à l'agent dans le chat pour des analyses</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['Analyse mes données du mois', 'Prévisions 7 prochains jours', 'Segmente mes clients', 'Détecte les anomalies'].map(q => (
                  <button key={q} onClick={() => { onTabChange('chat'); setChatMsg(q); }}
                    className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">{q}</button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'obd' && <OBDSection onSendToChat={(msg) => { onTabChange('chat'); setChatMsg(msg); }} />}
        {tab === 'photo' && (
          <div className="p-4 sm:p-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-8 text-center">
              <Camera size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300 font-medium mb-2">Analyse Photo IA</p>
              <p className="text-sm text-gray-400 mb-4">Envoyez une photo dans le chat pour analyse</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {(agent.industry?.includes('Agri') ? ['Analyse cette photo de plante', 'Analyse ce sol', 'Détection maladie'] :
                  agent.industry?.includes('Beaute') ? ['Analyse de peau', 'Recommandation soins'] :
                  agent.industry?.includes('Mecani') ? ['Diagnostic via photo', 'Analyse usure pièces'] :
                  ['Analyser une image', 'Identifier un objet']).map(q => (
                  <button key={q} onClick={() => { onTabChange('chat'); setChatMsg(q); }}
                    className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">{q}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB — stats, features, data modules, quick actions
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab({ agent, gradientColor, onSelectTab, dataTabs }: {
  agent: AgentDetail; gradientColor: string; onSelectTab: (t: string) => void;
  dataTabs: TabDef[];
}) {
  const stats = [
    { label: 'Installations', value: agent.installCount ?? '—', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    { label: 'Note moyenne', value: agent.avgRating ? `${agent.avgRating.toFixed(1)} ⭐` : '—', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    { label: 'Fonctionnalités', value: agent.features?.length ?? 0, color: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
    { label: 'Outils', value: agent.tools?.length ?? 0, color: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${stat.color}`}>
              <Sparkles size={15} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Data Modules */}
      {dataTabs.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">Modules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {dataTabs.map(dt => (
              <button key={dt.id} onClick={() => onSelectTab(dt.id)}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all text-left group">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientColor} flex items-center justify-center text-white flex-shrink-0`}>
                    {dt.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{dt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Voir et gérer</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {(agent.features ?? []).length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">Fonctionnalités</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {agent.features.map((f, i) => (
              <button key={i} onClick={() => onSelectTab('chat')}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3.5 shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all text-left flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                  <MessageSquare size={14} />
                </div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{f}</p>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA Chat */}
      <button onClick={() => onSelectTab('chat')}
        className={`w-full bg-gradient-to-r ${gradientColor} text-white rounded-xl p-5 text-left hover:opacity-90 transition-opacity shadow-lg`}>
        <div className="flex items-center gap-4">
          <span className="text-4xl">{agent.icon}</span>
          <div>
            <p className="font-bold text-lg">Discuter avec {agent.name}</p>
            <p className="text-sm opacity-80">Posez une question ou demandez une action</p>
          </div>
          <ChevronRight size={20} className="ml-auto opacity-70" />
        </div>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT PANEL — same design as built-in agents
// ═══════════════════════════════════════════════════════════════════════════

function ChatPanel({ agent, gradientColor, chatHistory, chatMsg, setChatMsg, chatLoading, sendChat, chatEndRef }: {
  agent: AgentDetail; gradientColor: string;
  chatHistory: { role: string; content: string }[];
  chatMsg: string; setChatMsg: (v: string) => void;
  chatLoading: boolean; sendChat: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <span className="text-5xl block mb-4">{agent.icon}</span>
            <p className="font-bold text-gray-800 dark:text-white text-lg">Je suis {agent.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">{agent.description}</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {(agent.features ?? []).slice(0, 4).map((f, i) => (
                <button key={i} onClick={() => setChatMsg(f.replace(/^[^\w]+/, ''))}
                  className="text-xs px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <span className="text-xl mr-2 mt-1 flex-shrink-0">{agent.icon}</span>}
            <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-md shadow-sm'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="flex justify-start">
            <span className="text-xl mr-2 mt-1">{agent.icon}</span>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 rounded-bl-md shadow-sm">
              <Loader2 className="animate-spin text-gray-400" size={16} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-3 sm:p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`Parlez à ${agent.name}...`} />
          <button onClick={sendChat} disabled={chatLoading || !chatMsg.trim()}
            className={`px-4 py-2.5 bg-gradient-to-r ${gradientColor} text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all`}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA TABLE — reusable for all data tabs
// ═══════════════════════════════════════════════════════════════════════════

function DataTable({ title, data, loading, onRefresh, columns, emptyMsg }: {
  title: string; data: DataItem[]; loading: boolean;
  onRefresh: () => void; columns: { key: string; label: string }[];
  emptyMsg: string;
}) {
  const [search, setSearch] = useState('');
  const filtered = data.filter(d => !search || JSON.stringify(d).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white">{title} ({data.length})</h2>
          <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
            <RefreshCw size={14} />
          </button>
        </div>
        {data.length > 5 && (
          <div className="px-4 pt-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm" placeholder="Rechercher..." />
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase">
                <tr>
                  {columns.map(c => <th key={c.key} className="px-4 py-3 text-left">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((item, i) => (
                  <tr key={item.id ?? i} className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                    {columns.map(c => (
                      <td key={c.key} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {renderCell(item[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-400 py-8 text-sm">{emptyMsg}</p>
        )}
      </div>
    </div>
  );
}

function renderCell(value: unknown): string {
  if (value == null) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj['_seconds']) return new Date((obj['_seconds'] as number) * 1000).toLocaleDateString('fr-FR');
    return JSON.stringify(value);
  }
  return String(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// OBD SECTION
// ═══════════════════════════════════════════════════════════════════════════

function OBDSection({ onSendToChat }: { onSendToChat: (msg: string) => void }) {
  const [codes, setCodes] = useState('');

  return (
    <div className="p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={24} className="text-blue-600" />
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Diagnostic OBD-II</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Entrez les codes erreur de votre lecteur OBD</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Codes erreur (séparés par virgule)</label>
            <input value={codes} onChange={e => setCodes(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="P0300, P0420, P0171" />
          </div>

          <button onClick={() => {
            if (codes.trim()) onSendToChat(`Diagnostic OBD : codes ${codes.trim()}. Donne-moi le diagnostic complet, la sévérité, les causes possibles, le coût estimé et un devis.`);
          }}
            disabled={!codes.trim()}
            className="w-full py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">
            Lancer le diagnostic
          </button>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2">Comment utiliser :</p>
            <ol className="text-xs text-blue-600 dark:text-blue-300 space-y-1">
              <li>1. Branchez un lecteur OBD-II (ELM327 ~$10) sur la prise OBD</li>
              <li>2. Lisez les codes avec une app gratuite (Torque, OBD Auto Doctor...)</li>
              <li>3. Entrez les codes ci-dessus (ex: P0300, P0420)</li>
              <li>4. L'agent analyse, diagnostique et génère un devis</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {['P0300 — Ratés moteur', 'P0420 — Catalyseur', 'P0171 — Mélange pauvre', 'P0700 — Transmission'].map(ex => (
              <button key={ex} onClick={() => setCodes(ex.split(' — ')[0])}
                className="text-xs px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-left">
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Expose setChatMsg for OBD section (already handled via onSendToChat prop)
