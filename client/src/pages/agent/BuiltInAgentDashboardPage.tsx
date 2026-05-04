/**
 * BuiltInAgentDashboardPage — Each agent = a standalone app
 * Embeds existing pages as tabs so the agent dashboard is self-contained.
 * No need for sidebar sub-routes — everything is here.
 */
import React, { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Loader2, MessageSquare,
  LayoutDashboard, Database, ChevronRight, RefreshCw, Sparkles,
  Paperclip, Mic, MicOff, Volume2, VolumeX,
  Image as ImageIcon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ChatSceneBackground from '@/components/chat/ChatSceneBackground';
import MeetingAgentActions from '@/components/meeting/MeetingAgentActions';
import { getAgentDashboard } from '@/config/agentDashboardConfig';
import type { AgentDashboardConfig, AgentPageLink } from '@/config/agentDashboardConfig';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

// ── Lazy-loaded page components mapped by route path ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PAGE_COMPONENTS: Record<string, () => Promise<{ default: ComponentType<any> }>> = {
  // Reception
  // Réception — tout est géré par ReceptionRedesignPage avec ses 12 onglets internes
  '/reception':                 () => import('@/pages/reception/ReceptionRedesignPage'),
  // HR — tout est géré par la nouvelle HRRedesignPage avec ses 19 onglets internes
  '/hr':                        () => import('@/pages/hr/HRRedesignPage'),
  // Finance
  // Finance — tout est géré par FinanceRedesignPage avec ses 8 onglets internes
  '/finance':                   () => import('@/pages/finance/FinanceRedesignPage'),
  // Sales
  '/sales':                     () => import('@/pages/sales/SalesDashboardPage'),
  '/sales/pipeline':            () => import('@/pages/sales/SalesPipelinePage'),
  '/sales/leads':               () => import('@/pages/sales/SalesLeadsPage'),
  '/sales/quotes':              () => import('@/pages/sales/QuotesPage'),
  '/sales/clients':             () => import('@/pages/sales/SalesClientsPage'),
  '/sales/followups':           () => import('@/pages/sales/SalesFollowupsPage'),
  '/sales/audit':               () => import('@/pages/sales/SalesAuditLogPage'),
  // Support
  '/support':                   () => import('@/pages/support/SupportCenterPage'),
  '/support/kb':                () => import('@/pages/support/KnowledgeBasePage'),
  // IT
  '/it':                        () => import('@/pages/it/ITDashboardPage'),
  '/it/tickets':                () => import('@/pages/it/ITTicketsPage'),
  '/it/assets':                 () => import('@/pages/it/ITAssetsPage'),
  '/it/licenses':               () => import('@/pages/it/ITLicensesPage'),
  // Security
  '/security':                  () => import('@/pages/SecurityDashboardPage'),
  '/security/incidents':        () => import('@/pages/SecurityIncidentsPage'),
  '/security/compliance':       () => import('@/pages/security/CompliancePage'),
  '/security/access':           () => import('@/pages/security/AccessReviewPage'),
  '/security/audit':            () => import('@/pages/security/AuditLogsPage'),
  // Marketing
  // Marketing — tout est géré par MarketingRedesignPage avec ses 13 onglets internes
  '/marketing':                 () => import('@/pages/marketing/MarketingRedesignPage'),
  // Workflow Automation
  '/workflow':                  () => import('@/pages/workflow/WorkflowRedesignPage'),
  '/automation':                () => import('@/pages/workflow/WorkflowRedesignPage'),
  // Training
  '/training':                  () => import('@/pages/training/LearningCenterPage'),
  '/training/manage':           () => import('@/pages/training/CourseManagerPage'),
  // Meetings — MeetingProPage redesigné contient déjà 4 onglets internes (Live, Meetings, Detail, Chat)
  '/meetings':                  () => import('@/pages/meetings/MeetingProPage'),
  // Insights / Analytics
  '/insights':                  () => import('@/pages/InsightsPage'),
  '/analytics':                 () => import('@/pages/AnalyticsPage'),
  // Knowledge / Documents / Contracts
  '/knowledge':                 () => import('@/pages/knowledge/KnowledgeRedesignPage'),
  '/data':                      () => import('@/pages/DataManagementPage'),
  // Legal & Contracts — unified into LegalRedesignPage
  '/contracts':                 () => import('@/pages/legal/LegalRedesignPage'),
  '/legal':                     () => import('@/pages/legal/LegalRedesignPage'),
  // Emails
  '/emails':                    () => import('@/pages/comms/CommunicationsRedesignPage'),
  '/comms':                     () => import('@/pages/comms/CommunicationsRedesignPage'),
  // Vision
  '/faces':                     () => import('@/pages/FaceDirectoryPage'),
  // Commercial
  '/commercial':                () => import('@/pages/CommercialPage'),
  // Workspace
  '/workspace':                 () => import('@/pages/WorkspacePage'),
  // Website Builder
  '/website':                   () => import('@/pages/website/WebsiteBuilderRedesignPage'),
};

// Cache lazy components so they don't re-create on every render
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyCache = new Map<string, ComponentType<any>>();
function getLazyPage(path: string) {
  if (lazyCache.has(path)) return lazyCache.get(path)!;
  const loader = PAGE_COMPONENTS[path];
  if (!loader) return null;
  const LazyComp = lazy(loader);
  lazyCache.set(path, LazyComp);
  return LazyComp;
}

const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="animate-spin text-gray-400" size={24} />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

export default function BuiltInAgentDashboardPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const config = getAgentDashboard(agentId ?? '');

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-6xl mb-4">🤖</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Agent non trouvé</p>
          <button onClick={() => navigate('/agents')} className="mt-4 text-sm text-blue-600 hover:underline">
            Retour aux agents
          </button>
        </div>
      </div>
    );
  }

  return <AgentDashboard key={config.id} config={config} />;
}

type TabId = 'overview' | 'chat' | `page:${string}`;

function AgentDashboard({ config }: { config: AgentDashboardConfig }) {
  // Tabs are the agent's embeddable pages. The Accueil overview and Chat IA
  // tabs are dropped — the chat is reachable via the floating AgentDrawer
  // and pages already contain their own dashboards.
  const pageTabs: { id: TabId; label: string }[] = config.pages
    .filter(p => PAGE_COMPONENTS[p.path])
    .map(p => ({ id: `page:${p.path}` as TabId, label: p.label }));

  // If the agent has at least one embeddable page, land directly on it.
  // Otherwise fall back to the legacy overview as a safety net.
  const initialTab: TabId = pageTabs[0]?.id ?? 'overview';
  const [tab, setTab] = useState<TabId>(initialTab);

  const allTabs = pageTabs.length > 0 ? pageTabs : [{ id: 'overview' as TabId, label: 'Accueil' }];

  const activePage = tab.startsWith('page:') ? tab.slice(5) : null;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.color} px-4 sm:px-6 py-4 text-white flex-shrink-0`}>
        <div className="flex items-center gap-3">
          <Link to="/agents" className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <span className="text-2xl sm:text-3xl">{config.icon}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold truncate">{config.name}</h1>
            <p className="text-sm opacity-80 truncate hidden sm:block">{config.description}</p>
          </div>
          <span className="px-2.5 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider hidden md:block">
            {config.category}
          </span>
        </div>
      </div>

      {/* Tabs — scrollable */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 overflow-x-auto">
        <div className="flex min-w-max px-2 sm:px-4">
          {allTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {t.id === 'overview' && <LayoutDashboard size={13} className="inline mr-1.5 -mt-0.5" />}
              {t.id === 'chat' && <MessageSquare size={13} className="inline mr-1.5 -mt-0.5" />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && <OverviewTab config={config} onSelectTab={setTab} />}
        {tab === 'chat' && <ChatTab config={config} />}
        {activePage && <EmbeddedPage path={activePage} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDED PAGE — renders any existing page inside the agent dashboard
// ═══════════════════════════════════════════════════════════════════════════

function EmbeddedPage({ path }: { path: string }) {
  const PageComponent = getLazyPage(path);
  if (!PageComponent) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 text-sm">Page non disponible</p>
      </div>
    );
  }
  return (
    <Suspense fallback={<Spinner />}>
      <PageComponent />
    </Suspense>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════

const STAT_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  pink: 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
  yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  lime: 'bg-lime-50 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  stone: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
};

function OverviewTab({ config, onSelectTab }: { config: AgentDashboardConfig; onSelectTab: (tab: TabId) => void }) {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Agent-specific action bar (e.g. live recording for meeting agent) */}
      {config.id === 'meeting' && (
        <div className="bg-gradient-to-br from-rose-50 to-purple-50 dark:from-rose-900/20 dark:to-purple-900/20 rounded-2xl border-2 border-rose-200 dark:border-rose-800 overflow-hidden">
          <div className="p-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Actions rapides</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Enregistrer, importer ou analyser une réunion en un clic.</p>
            <MeetingAgentActions />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {config.stats.map(stat => (
          <div key={stat.key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${STAT_COLORS[stat.color] ?? STAT_COLORS.gray}`}>
              <Sparkles size={15} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.defaultValue ?? '—'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Pages grid — prominent cards to navigate */}
      {config.pages.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
            Modules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {config.pages.filter(p => PAGE_COMPONENTS[p.path]).map((page, i) => (
              <button key={i} onClick={() => onSelectTab(`page:${page.path}`)}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all text-left group">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-white flex-shrink-0`}>
                    <LayoutDashboard size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{page.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{page.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
          Actions rapides
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {config.quickActions.map((action, i) => (
            <button key={i} onClick={() => onSelectTab('chat')}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3.5 shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all text-left flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                <MessageSquare size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{action.label}</p>
                <p className="text-xs text-gray-400 truncate">{action.prompt}</p>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* CTA Chat */}
      <button onClick={() => onSelectTab('chat')}
        className={`w-full bg-gradient-to-r ${config.color} text-white rounded-xl p-5 text-left hover:opacity-90 transition-opacity shadow-lg`}>
        <div className="flex items-center gap-4">
          <span className="text-4xl">{config.icon}</span>
          <div>
            <p className="font-bold text-lg">Discuter avec {config.name}</p>
            <p className="text-sm opacity-80">Posez une question ou demandez une action</p>
          </div>
          <ChevronRight size={20} className="ml-auto opacity-70" />
        </div>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT TAB
// ═══════════════════════════════════════════════════════════════════════════

function ChatTab({ config }: { config: AgentDashboardConfig }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Voice input
  const { isListening, isSupported, interimText, toggle: toggleMic } = (() => {
    try {
      // Dynamic import to avoid SSR issues
      const { useVoiceInput: useVI } = require('@/hooks/useVoiceInput');
      return useVI({ lang: 'fr-FR', onTranscript: (text: string) => setInput((prev: string) => (prev ? prev + ' ' + text : text)) });
    } catch {
      return { isListening: false, isSupported: false, interimText: '', toggle: () => {} };
    }
  })();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    // TTS on new assistant message
    if (ttsEnabled && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'assistant' && last.content) {
        try {
          const { speakText } = require('@/hooks/useVoiceInput');
          const plain = last.content.replace(/[*_`#>]/g, '').trim();
          speakText(plain.slice(0, 500), 'fr-FR');
        } catch {}
      }
    }
  }, [messages, ttsEnabled]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const createConversation = async (): Promise<string> => {
    if (conversationId) return conversationId;
    const res = await api.post('/chat/conversations', { title: `__agent__${config.id}` });
    const id = (res.data as { id: string }).id;
    setConversationId(id);
    return id;
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const convId = await createConversation();
      const response = await fetch(`/api/agent/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        // Send agentId so the server dispatches directly to this agent's tool
        // instead of going through the Orchestrator.
        body: JSON.stringify({ content: msg, agentId: config.id }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';

      if (reader) {
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
          for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data) as { content?: string; error?: string };
              if (parsed.content) {
                fullReply += parsed.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: fullReply };
                  return updated;
                });
              }
              if (parsed.error) {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: `Erreur: ${parsed.error}` };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur de connexion. Réessayez.' }]);
    }
    setLoading(false);
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { dataService } = await import('@/services/dataService');
      const { useAuthStore } = await import('@/store/authStore');
      const companyId = useAuthStore.getState().company?.id;
      if (!companyId) throw new Error('No company');
      const doc = await dataService.uploadDocument(file, companyId);
      // Tell the agent about the file
      setInput(`J'ai uploadé le fichier "${doc.originalName}". Analyse-le.`);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur lors de l\'upload du fichier.' }]);
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const hasText = input.trim().length > 0;

  return (
    <div className="flex flex-col relative overflow-hidden" style={{ height: 'calc(100vh - 160px)', background: '#0d2520' }}>
      {/* Cosmic green background + company watermark */}
      <ChatSceneBackground />

      {/* Agent-specific action bar (e.g. recording/upload for meeting agent) */}
      {config.id === 'meeting' && <MeetingAgentActions />}

      {/* Messages area */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="relative">
              <div className="absolute inset-[-10px] rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.5) 0%, rgba(167,139,250,0.3) 50%, transparent 70%)', animation: 'sceneAuroraPulse 3s ease-in-out infinite' }} />
              <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center border border-white/10"
                style={{ background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #6366f1 100%)', boxShadow: '0 0 25px rgba(236,72,153,0.5)' }}>
                <span className="text-4xl">{config.icon}</span>
              </div>
            </div>
            <p className="font-semibold text-white text-xl mt-5" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>Je suis {config.name}</p>
            <p className="text-[15px] text-white/70 mt-1 mb-8 max-w-sm">{config.description}</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {config.quickActions.slice(0, 4).map((action, i) => (
                <button key={i} onClick={() => setInput(action.prompt)}
                  className="text-xs px-3 py-2 rounded-xl backdrop-blur-md text-white/90 transition-all hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(196,181,253,0.3)' }}>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="relative flex-shrink-0 w-8 h-8">
                <div className="absolute inset-[-3px] rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.6) 0%, transparent 65%)', animation: 'sceneAuroraPulse 3s ease-in-out infinite' }} />
                <div className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #6366f1 100%)', boxShadow: '0 0 12px rgba(236,72,153,0.5)' }}>
                  {config.icon}
                </div>
              </div>
            )}
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 0 10px rgba(168,85,247,0.5)' }}>
                <Send size={12} className="text-white" />
              </div>
            )}
            <div className="max-w-[80%] rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed backdrop-blur-md text-white"
              style={msg.role === 'user' ? {
                background: 'linear-gradient(135deg, rgba(168,85,247,0.9) 0%, rgba(124,58,237,0.9) 100%)',
                border: '1px solid rgba(196,181,253,0.35)',
                borderBottomRightRadius: '6px',
                boxShadow: '0 4px 16px rgba(147,51,234,0.45)',
              } : {
                background: 'linear-gradient(135deg, rgba(59,130,246,0.85) 0%, rgba(37,99,235,0.85) 100%)',
                border: '1px solid rgba(147,197,253,0.35)',
                borderBottomLeftRadius: '6px',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}>
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap m-0">{msg.content || '...'}</p>
              ) : (
                <div className="agent-md">
                  <ReactMarkdown components={agentMdComponents}>{msg.content || '...'}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex items-start gap-2.5">
            <div className="relative flex-shrink-0 w-8 h-8">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #6366f1 100%)' }}>
                {config.icon}
              </div>
            </div>
            <div className="rounded-[18px] px-4 py-3 backdrop-blur-md"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.85), rgba(37,99,235,0.85))', border: '1px solid rgba(147,197,253,0.35)', borderBottomLeftRadius: '6px' }}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input area */}
      <div className="relative z-10 px-3 pt-2.5 pb-3 backdrop-blur-md"
        style={{ background: 'rgba(13,37,32,0.9)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-4xl mx-auto">
          {/* Hidden file inputs — Photo (images only) and Fichier (docs) */}
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt" onChange={handleFileUpload} className="hidden" />

          {/* Input box with dynamic send button */}
          <div className="flex items-end gap-2 rounded-3xl pl-4 pr-1 py-1 mb-2.5 backdrop-blur-md transition-all"
            style={{
              background: hasText ? 'rgba(30,60,45,0.65)' : 'rgba(60,40,110,0.55)',
              border: `1.5px solid ${hasText ? 'rgba(134,239,172,0.7)' : 'rgba(167,139,250,0.4)'}`,
              boxShadow: hasText ? '0 0 0 3px rgba(34,197,94,0.25)' : 'none',
            }}>
            <textarea ref={textareaRef}
              value={isListening && interimText ? input + ' ' + interimText : input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={isListening ? '🎙️ Écoute en cours...' : `Écris à ${config.name}...`}
              rows={1}
              className="clone-input flex-1 bg-transparent text-white placeholder-white/55 resize-none focus:outline-none leading-relaxed py-2.5 min-w-0"
              style={{ minHeight: '24px', maxHeight: '120px', background: 'transparent', fontSize: '16px' }}
              disabled={loading} readOnly={isListening}
              autoComplete="off"
            />
            <button
              onClick={send}
              disabled={loading || !hasText}
              className={`send-btn-dyn flex-shrink-0 flex items-center justify-center rounded-full transition-all mb-0.5 ${
                hasText ? 'active text-white border-2' : 'text-white/70 border'
              }`}
              style={hasText ? {
                width: '46px',
                height: '46px',
                borderColor: 'rgba(187,247,208,0.6)',
              } : {
                width: '38px',
                height: '38px',
                background: 'rgba(167,139,250,0.25)',
                borderColor: 'rgba(196,181,253,0.4)',
              }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> :
                <Send size={hasText ? 20 : 16} strokeWidth={hasText ? 3 : 2.5} />}
            </button>
          </div>

          {/* Media row — 4 distinct actions: Image, Fichier, Vocal (mic), TTS (haut-parleur) */}
          <div className={`flex gap-2 transition-all ${hasText ? 'opacity-40 scale-[0.96]' : 'opacity-100'}`}>
            <MediaBtn icon={<ImageIcon size={18} />} label="Image" color="#f472b6" borderColor="rgba(236,72,153,0.55)"
              onClick={() => imageInputRef.current?.click()} title="Envoyer une image" />
            <MediaBtn
              icon={isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
              label="Fichier" color="#60a5fa" borderColor="rgba(96,165,250,0.65)"
              onClick={() => fileInputRef.current?.click()} title="Joindre un document (PDF, Word, Excel)" />
            {isSupported ? (
              <MediaBtn
                icon={isListening ? <MicOff size={18} /> : <Mic size={18} />}
                label={isListening ? 'Stop' : 'Dicter'}
                color="#c4b5fd" borderColor="rgba(167,139,250,0.65)"
                onClick={toggleMic} active={isListening} title={isListening ? 'Arrêter la dictée' : 'Dicter avec le micro'} />
            ) : (
              <MediaBtn icon={<Mic size={18} />} label="Dicter" color="#71717a" borderColor="rgba(113,113,122,0.5)"
                onClick={() => alert('Reconnaissance vocale indisponible sur ce navigateur')} title="Non supporté" />
            )}
            <MediaBtn
              icon={ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              label={ttsEnabled ? 'Voix ON' : 'Voix OFF'}
              color={ttsEnabled ? '#86efac' : '#fbbf24'}
              borderColor={ttsEnabled ? 'rgba(134,239,172,0.65)' : 'rgba(245,158,11,0.55)'}
              onClick={() => {
                setTtsEnabled(v => !v);
                if (ttsEnabled) { try { const { stopSpeaking } = require('@/hooks/useVoiceInput'); stopSpeaking(); } catch {} }
              }}
              active={ttsEnabled}
              title={ttsEnabled ? 'Désactiver la lecture vocale' : 'Activer la lecture vocale des réponses'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaBtn({ icon, label, color, borderColor, onClick, active, title }: { icon: React.ReactNode; label: string; color: string; borderColor: string; onClick?: () => void; active?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-[14px] backdrop-blur-md transition-all hover:-translate-y-0.5"
      style={{
        background: active ? 'rgba(74,222,128,0.18)' : 'rgba(30,30,60,0.6)',
        border: `1px solid ${active ? 'rgba(134,239,172,0.65)' : borderColor}`,
      }}>
      <span style={{ color: active ? '#86efac' : color }}>{icon}</span>
      <span className="text-[10px] font-medium text-white">{label}</span>
    </button>
  );
}

// Markdown components for assistant messages — links open in new tab, styled
// Renders markdown links; internal app paths (/foo) use react-router navigation
// in the same tab, external URLs open in a new tab.
const SmartLink: React.FC<{ children?: React.ReactNode; href?: string }> = ({ children, href }) => {
  const navigate = useNavigate();
  const isInternal = !!href && (href.startsWith('/') && !href.startsWith('//'));
  if (isInternal) {
    return (
      <a href={href} onClick={(e) => { e.preventDefault(); navigate(href!); }}
        className="underline font-medium hover:opacity-80 cursor-pointer"
        style={{ color: '#bef264', textDecorationColor: 'rgba(190,242,100,0.6)' }}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="underline font-medium hover:opacity-80"
      style={{ color: '#bef264', textDecorationColor: 'rgba(190,242,100,0.6)' }}>
      {children}
    </a>
  );
};

const agentMdComponents: Record<string, React.FC<{ children?: React.ReactNode; href?: string }>> = {
  a: SmartLink,
  p: ({ children }) => <p className="m-0 mb-1.5 last:mb-0 whitespace-pre-wrap">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-1.5 space-y-0.5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="px-1 py-0.5 rounded text-[85%] font-mono"
      style={{ background: 'rgba(0,0,0,0.3)', color: '#fde68a' }}>{children}</code>
  ),
};

async function getToken(): Promise<string> {
  const { auth } = await import('@/services/firebase');
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}
