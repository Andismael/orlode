import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Globe, Database, Video, Mic, Link2, ShoppingCart, Plus,
  RefreshCw, Trash2, CheckCircle, AlertCircle, Loader2,
  Eye, EyeOff,
  Mail, Calendar, MessageSquare, Hash, MapPin, FileText, Cloud,
  Boxes, Wrench, Building2, Code, Target, TrendingUp, Wand2,
  BookOpen, Lightbulb, Network, Sparkles, ArrowUpRight, ArrowRight,
  Plug, Flame, FileBox, Bot, ChevronLeft, ChevronRight,
  BadgeCheck, KeyRound, ShieldCheck, FilePlus2, Lock, Settings,
  Check, Info, X, Search, ExternalLink, CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useAuthStore } from '@/store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConnectorRecord {
  id: string;
  type: string;
  name: string;
  status: 'active' | 'error' | 'syncing';
  lastSyncAt?: string;
  lastSyncChunks?: number;
  lastSyncRows?: number;
  schedule?: string;
  siteUrl?: string;
  platform?: string;
}

interface ConnectorStats {
  totalConnectors: number;
  totalChunks: number;
  connectors: ConnectorRecord[];
}

// ── Connector type config ─────────────────────────────────────────────────────

const CONNECTOR_TYPES = [
  // ── Sources de donnees ──
  { id: 'web',        label: 'Site Web',             icon: Globe,        color: '#0092FF', description: 'Crawler votre site pour indexer tout le contenu',           category: 'data',  tier: 'critical' },
  { id: 'database',   label: 'Base de donnees',      icon: Database,     color: '#00A550', description: 'MySQL, PostgreSQL, MongoDB, MSSQL (lecture seule)',         category: 'data',  tier: 'critical' },
  { id: 'api',        label: 'API Custom',           icon: Link2,        color: '#F39C12', description: 'N\'importe quelle API REST interne ou externe',            category: 'data',  tier: 'critical' },
  { id: 'ecommerce',  label: 'E-Commerce',           icon: ShoppingCart, color: '#E74C3C', description: 'Shopify / WooCommerce — produits, commandes, clients',     category: 'data',  tier: 'critical' },
  // ── Media ──
  { id: 'video',      label: 'Video / YouTube',      icon: Video,        color: '#FF4500', description: 'YouTube, Zoom, Meet — transcription automatique',          category: 'media', tier: 'shared'   },
  { id: 'audio',      label: 'Audio / Podcast',      icon: Mic,          color: '#9B59B6', description: 'Podcasts, appels telephoniques, voicemails',               category: 'media', tier: 'shared'   },
  // ── Google Workspace ──
  { id: 'gdrive',     label: 'Google Drive',         icon: Cloud,        color: '#4285F4', description: 'Drive, Docs, Sheets, Slides — sync automatique',          category: 'google',       tier: 'personal' },
  { id: 'gmail',      label: 'Gmail',                icon: Mail,         color: '#EA4335', description: 'Emails entrants/sortants — recherche, envoi, analyse',     category: 'google',       tier: 'personal' },
  { id: 'gcalendar',  label: 'Google Calendar',      icon: Calendar,     color: '#0F9D58', description: 'Evenements, reunions, disponibilites — sync bidirectionnelle', category: 'google',   tier: 'personal' },
  { id: 'gmaps',      label: 'Google Maps',          icon: MapPin,       color: '#34A853', description: 'Geolocalisation, itineraires, recherche de lieux',         category: 'google',       tier: 'shared'   },
  // ── Microsoft 365 ──
  { id: 'onedrive',   label: 'OneDrive',             icon: Cloud,        color: '#0078D4', description: 'Fichiers OneDrive — sync automatique vers la base',        category: 'microsoft',    tier: 'personal' },
  { id: 'outlook',    label: 'Outlook / Exchange',   icon: Mail,         color: '#0078D4', description: 'Emails Outlook — recherche, envoi, indexation',            category: 'microsoft',    tier: 'personal' },
  { id: 'mscalendar', label: 'Outlook Calendar',     icon: Calendar,     color: '#0078D4', description: 'Événements Outlook/Teams — sync bidirectionnelle',         category: 'microsoft',    tier: 'personal' },
  { id: 'teams',      label: 'Microsoft Teams',      icon: MessageSquare, color: '#6264A7', description: 'Messages, canaux, réunions Teams — recherche + notifs',    category: 'microsoft',    tier: 'shared'   },
  { id: 'sharepoint', label: 'SharePoint',           icon: FileText,     color: '#0078D4', description: 'Documents SharePoint — indexation automatique',             category: 'microsoft',    tier: 'shared'   },
  // ── Communication ──
  { id: 'slack',      label: 'Slack',                icon: Hash,         color: '#4A154B', description: 'Messages, canaux, recherche — notifications bidirectionnelles', category: 'comms',    tier: 'shared'   },
  { id: 'whatsapp',   label: 'WhatsApp Business',    icon: MessageSquare, color: '#25D366', description: 'API Business — messages clients, notifications, chatbot', category: 'comms',       tier: 'shared'   },
  // ── Productivite ──
  { id: 'notion',     label: 'Notion',               icon: FileText,     color: '#000000', description: 'Pages, bases de donnees, wiki — indexation automatique',   category: 'productivity', tier: 'shared'   },
] as const;

type _LegacyConnectorType = typeof CONNECTOR_TYPES[number]['id'];
// Suppress TS "unused" flags — kept available for future legacy fallback paths.
void (null as unknown as _LegacyConnectorType);

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectorRecord['status'] }) {
  const map = {
    active:  { color: 'text-green-600 bg-green-50 border-green-200', label: 'Actif',      icon: CheckCircle },
    error:   { color: 'text-red-600 bg-red-50 border-red-200',       label: 'Erreur',     icon: AlertCircle },
    syncing: { color: 'text-blue-600 bg-blue-50 border-blue-200',    label: 'En cours...', icon: Loader2 },
  };
  const { color, label, icon: Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${color}`}>
      <Icon size={11} className={status === 'syncing' ? 'animate-spin' : ''} />
      {label}
    </span>
  );
}

// ── Connected connector card (legacy, kept for fallback uses) ────────────────

function LegacyConnectorCard({ connector, onDelete }: { connector: ConnectorRecord; onDelete: () => void }) {
  const typeInfo = CONNECTOR_TYPES.find((t) => t.id === connector.type);
  const Icon = typeInfo?.icon ?? Link2;
  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${typeInfo?.color ?? '#888'}15` }}>
        <Icon size={20} style={{ color: typeInfo?.color ?? '#888' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800 dark:text-white text-sm">{connector.name || typeInfo?.label}</span>
          <StatusBadge status={connector.status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {connector.lastSyncAt && (
            <span className="text-xs text-gray-400">
              Sync: {new Date(connector.lastSyncAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
      <button onClick={onDelete} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50" title="Supprimer">
        <Trash2 size={15} />
      </button>
    </div>
  );
}
// Avoid TS "unused" if no other usage:
void LegacyConnectorCard;

// ── Web Crawler form ──────────────────────────────────────────────────────────

function WebCrawlerForm({ onSuccess }: { onSuccess: () => void }) {
  const [siteUrl, setSiteUrl] = useState('');
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(100);
  const [schedule, setSchedule] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteUrl) return;
    setLoading(true);
    try {
      await api.post('/connectors/web/crawl', { siteUrl, crawlDepth, maxPages, schedule });
      setStatus('Crawl demarre. Les pages seront indexees en arriere-plan.');
      onSuccess();
    } catch { setStatus('Erreur lors du demarrage du crawl.'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL du site</label>
        <input type="url" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://www.mon-entreprise.com"
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profondeur (1-5)</label>
          <input type="number" min={1} max={5} value={crawlDepth} onChange={(e) => setCrawlDepth(Number(e.target.value))}
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max pages</label>
          <input type="number" min={10} max={1000} value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))}
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Re-crawl automatique</label>
        <div className="flex gap-2">
          {(['once', 'daily', 'weekly', 'monthly'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSchedule(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${schedule === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-300'}`}>
              {s === 'once' ? 'Une fois' : s === 'daily' ? 'Quotidien' : s === 'weekly' ? 'Hebdo' : 'Mensuel'}
            </button>
          ))}
        </div>
      </div>
      {status && <p className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">{status}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Demarrage...</> : <><Globe size={16} /> Lancer le crawl</>}
      </button>
    </form>
  );
}

// ── Database form ─────────────────────────────────────────────────────────────

function DatabaseForm({ onSuccess }: { onSuccess: () => void }) {
  const [type, setType] = useState<'mysql' | 'postgresql' | 'mongodb' | 'mssql'>('mysql');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(3306);
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const defaultPorts: Record<string, number> = { mysql: 3306, postgresql: 5432, mongodb: 27017, mssql: 1433 };
  const handleTypeChange = (val: typeof type) => { setType(val); setPort(defaultPorts[val] ?? 3306); };

  const handleTest = async () => {
    setTestStatus('idle'); setLoading(true);
    try {
      const { data } = await api.post('/connectors/database/test', { type, host, port, database, username, password });
      setTestStatus(data.success ? 'ok' : 'error');
      setTestMsg(data.error ?? 'Connexion reussie');
    } catch { setTestStatus('error'); setTestMsg('Erreur de connexion'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/connectors/database/sync', { name, type, connection: { host, port, database, username, password, ssl: true }, tables: [], syncSchedule: 'daily' });
      setStatus('Synchronisation demarree.'); onSuccess();
    } catch { setStatus('Erreur lors de la synchronisation.'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom du connecteur</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: CRM Production"
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['mysql', 'postgresql', 'mongodb', 'mssql'] as const).map((dbType) => (
            <button key={dbType} type="button" onClick={() => handleTypeChange(dbType)}
              className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${type === dbType ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
              {dbType === 'postgresql' ? 'PgSQL' : dbType.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host</label>
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="db.example.com"
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
          <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))}
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Database</label>
        <input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="production_db"
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Utilisateur (READ-ONLY)</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="corpmind_readonly"
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mot de passe</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={handleTest} disabled={loading || !host}
          className="flex-1 border border-green-300 text-green-700 py-2 rounded-lg text-sm font-medium hover:bg-green-50 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null} Tester la connexion
        </button>
        {testStatus !== 'idle' && (
          <span className={`flex items-center gap-1 text-xs px-2 ${testStatus === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {testStatus === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {testMsg}
          </span>
        )}
      </div>
      {status && <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/30 px-3 py-2 rounded-lg">{status}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
        <Database size={16} /> Synchroniser
      </button>
    </form>
  );
}

// ── Microsoft 365 OAuth form (OneDrive, Outlook, Teams, Calendar, SharePoint) ──

function MicrosoftOAuthForm({ service, label, color, icon: Icon, onSuccess }: {
  service: 'onedrive' | 'outlook' | 'mscalendar' | 'teams' | 'sharepoint';
  label: string; color: string; icon: React.ElementType; onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [connected, setConnected] = useState<{ email?: string; displayName?: string; scope?: 'personal' | 'company' } | null>(null);

  const isPersonal = service === 'onedrive' || service === 'outlook' || service === 'mscalendar';
  const scopeLabel = isPersonal ? 'Personnel (ton compte)' : 'Entreprise (partagé)';

  const refresh = async () => {
    try {
      const r = await api.get('/ms-oauth/status');
      const raw = r.data as unknown as Record<string, unknown>;
      const list = ((raw?.data ?? raw) as Array<{ service: string; scope?: 'personal' | 'company'; profile?: { email?: string; displayName?: string } }>) ?? [];
      const match = list.find(s => s.service === service);
      setConnected(match ? { ...match.profile, scope: match.scope } : null);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    refresh();
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('ms');
    if (flag === 'success' && params.get('service') === service) {
      setFlash({ type: 'success', text: `${label} connecté !` });
      onSuccess();
      params.delete('ms'); params.delete('service');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    } else if (flag === 'error') {
      setFlash({ type: 'error', text: `Erreur OAuth: ${params.get('reason') ?? 'unknown'}` });
      params.delete('ms'); params.delete('reason');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async () => {
    setBusy(true);
    try {
      const r = await api.get<{ url: string }>(`/ms-oauth/start?service=${service}`);
      const raw = r.data as unknown as Record<string, unknown>;
      const data = (raw?.data ?? raw) as { url?: string };
      if (data?.url) { window.location.href = data.url; return; }
      setFlash({ type: 'error', text: 'Impossible de démarrer le flow OAuth.' });
    } catch (err) {
      setFlash({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!confirm(`Déconnecter ${label} ?`)) return;
    setBusy(true);
    try {
      await api.delete(`/ms-oauth/${service}`);
      setConnected(null);
      setFlash({ type: 'success', text: `${label} déconnecté.` });
      onSuccess();
    } catch { setFlash({ type: 'error', text: 'Erreur' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {flash && (
        <p className={`text-sm px-3 py-2 rounded-lg ${flash.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {flash.text}
        </p>
      )}
      <div className={`text-xs px-3 py-2 rounded-lg ${isPersonal ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
        <strong>Scope: {scopeLabel}</strong> — {isPersonal
          ? 'Chaque employé connecte son propre compte. Les autres ne voient pas tes données.'
          : 'Une seule connexion pour toute l\'entreprise (accès partagé).'}
      </div>

      {connected ? (
        <>
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: `${color}15` }}>
            <Icon size={18} style={{ color }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{label} connecté</p>
              <p className="text-xs text-gray-500">{connected.email ?? connected.displayName ?? ''}</p>
            </div>
            <CheckCircle size={16} className="text-green-500" />
          </div>
          <button onClick={disconnect} disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 disabled:opacity-50">
            Déconnecter
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isPersonal
              ? `Connectez votre compte Microsoft personnel pour que ${label} soit accessible dans votre espace.`
              : `Connectez le compte Microsoft de l'entreprise pour partager ${label} avec toute l'équipe.`}
          </p>
          <button onClick={connect} disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ background: color }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            Se connecter avec Microsoft
          </button>
        </>
      )}
    </div>
  );
}

// ── Generic OAuth/Token form (Google, Slack, WhatsApp, Notion) ───────────────

function OAuthConnectorForm({ connectorId, label, color, icon: Icon, onSuccess }: {
  connectorId: string; label: string; color: string; icon: React.ElementType; onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post(`/connectors/${connectorId}/connect`, { token: token || undefined });
      setStatus('Connexion reussie ! Synchronisation en cours...');
      onSuccess();
    } catch { setStatus('Erreur lors de la connexion.'); }
    finally { setLoading(false); }
  };

  const isGoogle = connectorId.startsWith('g');
  const isOAuth = isGoogle || connectorId === 'slack' || connectorId === 'notion';

  return (
    <form onSubmit={handleConnect} className="space-y-4">
      {isOAuth ? (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Connectez votre compte {label} via OAuth pour permettre a Orlode d'acceder a vos donnees en toute securite.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token d'acces (optionnel)</label>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} value={token} onChange={(e) => setToken(e.target.value)}
                placeholder="Laissez vide pour OAuth automatique"
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2" style={{ '--tw-ring-color': color } as React.CSSProperties} />
              <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Entrez votre token API {label} pour connecter le service.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token / API Key</label>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} value={token} onChange={(e) => setToken(e.target.value)}
                placeholder={`Token ${label}`}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2" style={{ '--tw-ring-color': color } as React.CSSProperties} required />
              <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </>
      )}
      {connectorId === 'whatsapp' && (
        <p className="text-xs text-gray-400">
          Vous pouvez aussi configurer WhatsApp dans Administration &gt; WhatsApp.
        </p>
      )}
      {status && <p className="text-sm px-3 py-2 rounded-lg" style={{ color, background: `${color}15` }}>{status}</p>}
      <button type="submit" disabled={loading}
        className="w-full text-white py-2.5 rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: color }}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
        {isOAuth && !token ? `Connecter ${label} (OAuth)` : `Connecter ${label}`}
      </button>
    </form>
  );
}

// ── Gmail OAuth form ──────────────────────────────────────────────────────────

function GmailOAuthForm({ onSuccess }: { onSuccess: () => void }) {
  const [status, setStatus] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ connected: boolean; email: string | null }>('/gmail/status');
      setStatus((r.data as { connected: boolean; email: string | null }) ?? { connected: false, email: null });
    } catch { setStatus({ connected: false, email: null }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    // Detect OAuth callback result from URL
    const params = new URLSearchParams(window.location.search);
    const gmailFlag = params.get('gmail');
    if (gmailFlag === 'connected') {
      setFlash(`Gmail connecté (${params.get('email') ?? ''})`);
      onSuccess();
    } else if (gmailFlag === 'error') {
      setFlash(`Erreur OAuth : ${params.get('reason') ?? 'unknown'}`);
    }
    if (gmailFlag) {
      params.delete('gmail'); params.delete('email'); params.delete('reason');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    }
  }, [refresh, onSuccess]);

  const connect = async () => {
    setBusy(true);
    try {
      const r = await api.get<{ url: string }>('/gmail/oauth/start');
      const data = r.data as { url?: string } | undefined;
      if (data?.url) { window.location.href = data.url; return; }
      setFlash('Impossible de demarrer le flow OAuth');
    } catch {
      setFlash('Erreur — verifiez que GOOGLE_CLIENT_ID est configure cote serveur');
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.post('/gmail/disconnect', {});
      setFlash('Gmail deconnecte');
      await refresh();
      onSuccess();
    } catch { setFlash('Erreur lors de la deconnexion'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      {flash && <p className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700">{flash}</p>}

      {status?.connected ? (
        <>
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#EA433510' }}>
            <Mail size={18} style={{ color: '#EA4335' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Gmail connecté</p>
              <p className="text-xs text-gray-500">{status.email}</p>
            </div>
            <CheckCircle size={16} className="text-green-500" />
          </div>
          <p className="text-xs text-gray-500">
            Vos agents (Sales, Support, Marketing, RH) enverront les emails depuis cette adresse. Bien meilleure délivrabilité qu'un email générique.
          </p>
          <button type="button" onClick={disconnect} disabled={busy}
            className="w-full py-2.5 rounded-lg font-medium text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Déconnecter Gmail'}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Connectez votre Gmail pour que vos agents IA envoient leurs emails depuis votre adresse pro. Scope demandé : <code className="text-xs bg-gray-100 px-1 rounded">gmail.send</code> uniquement.
          </p>
          <button type="button" onClick={connect} disabled={busy}
            className="w-full text-white py-2.5 rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#EA4335' }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            Connecter mon Gmail (OAuth)
          </button>
        </>
      )}
    </div>
  );
}

// ── Video form ────────────────────────────────────────────────────────────────

function VideoForm({ onSuccess }: { onSuccess: () => void }) {
  const [source, setSource] = useState<'youtube' | 'url'>('youtube');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('training');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/connectors/video/process', { source, url, title, category });
      setStatus('Traitement demarre. La transcription sera indexee automatiquement.');
      onSuccess();
    } catch { setStatus('Erreur lors du traitement.'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source</label>
        <div className="flex gap-2">
          {(['youtube', 'url'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSource(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${source === s ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
              {s === 'youtube' ? 'YouTube' : 'URL directe'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL de la video</label>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder={source === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://...'}
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titre</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Formation React 2024"
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categorie</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="meeting">Reunion</option>
          <option value="training">Formation</option>
          <option value="presentation">Presentation</option>
          <option value="marketing">Marketing</option>
          <option value="other">Autre</option>
        </select>
      </div>
      {status && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">{status}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-red-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />} Indexer la video
      </button>
    </form>
  );
}

// ── Audio form ────────────────────────────────────────────────────────────────

function AudioForm({ onSuccess }: { onSuccess: () => void }) {
  const [source, setSource] = useState<'url' | 'podcast_rss'>('podcast_rss');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('podcast');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/connectors/audio/process', { source, url, title, category });
      setStatus(source === 'podcast_rss' ? 'Import RSS demarre.' : 'Traitement demarre.');
      onSuccess();
    } catch { setStatus('Erreur lors du traitement.'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source</label>
        <div className="flex gap-2">
          {(['url', 'podcast_rss'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSource(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${source === s ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
              {s === 'url' ? 'URL audio' : 'Flux RSS podcast'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{source === 'podcast_rss' ? 'URL du flux RSS' : 'URL de l\'audio'}</label>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder={source === 'podcast_rss' ? 'https://feeds.example.com/podcast.xml' : 'https://...'}
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" required />
      </div>
      {source === 'url' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Appel client 2024-04-01"
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categorie</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="podcast">Podcast</option>
              <option value="call">Appel</option>
              <option value="meeting">Reunion</option>
              <option value="voicemail">Vocal</option>
              <option value="training">Formation</option>
              <option value="other">Autre</option>
            </select>
          </div>
        </>
      )}
      {status && <p className="text-sm text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-3 py-2 rounded-lg">{status}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
        {source === 'podcast_rss' ? 'Importer le podcast' : 'Indexer l\'audio'}
      </button>
    </form>
  );
}

// ── API form ──────────────────────────────────────────────────────────────────

function APIForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [authType, setAuthType] = useState<'bearer' | 'api_key' | 'basic' | 'none'>('bearer');
  const [credentials, setCredentials] = useState('');
  const [showCreds, setShowCreds] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleTest = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/connectors/api/test', { name, baseUrl, authType, credentials });
      setTestStatus(data.success ? 'ok' : 'error');
    } catch { setTestStatus('error'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/connectors/api/sync', {
        name, baseUrl, authType, credentials,
        endpoints: [{ name: 'default', path: '/', descriptionTemplate: '{id}: {name}' }],
        syncSchedule: 'daily',
      });
      setStatus('Synchronisation API demarree.');
      onSuccess();
    } catch { setStatus('Erreur.'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Notre ERP"
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL de base</label>
        <input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.mon-erp.com"
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Authentification</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['bearer', 'api_key', 'basic', 'none'] as const).map((authOpt) => (
            <button key={authOpt} type="button" onClick={() => setAuthType(authOpt)}
              className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${authType === authOpt ? 'bg-yellow-500 text-white border-yellow-500' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
              {authOpt === 'bearer' ? 'Bearer' : authOpt === 'api_key' ? 'API Key' : authOpt === 'basic' ? 'Basic' : 'Aucune'}
            </button>
          ))}
        </div>
      </div>
      {authType !== 'none' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {authType === 'bearer' ? 'Token Bearer' : authType === 'api_key' ? 'Cle API' : 'user:password'}
          </label>
          <div className="relative">
            <input type={showCreds ? 'text' : 'password'} value={credentials} onChange={(e) => setCredentials(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            <button type="button" onClick={() => setShowCreds(!showCreds)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
              {showCreds ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={handleTest} disabled={loading || !baseUrl}
          className="flex-1 border border-yellow-400 text-yellow-700 py-2 rounded-lg text-sm font-medium hover:bg-yellow-50 disabled:opacity-50">
          Tester
        </button>
        {testStatus !== 'idle' && (
          <span className={`flex items-center gap-1 text-xs px-2 ${testStatus === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {testStatus === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          </span>
        )}
      </div>
      {status && <p className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 px-3 py-2 rounded-lg">{status}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-yellow-500 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-yellow-600 disabled:opacity-50 flex items-center justify-center gap-2">
        <Link2 size={16} /> Connecter l'API
      </button>
    </form>
  );
}

// ── Shopify form ──────────────────────────────────────────────────────────────

function ShopifyForm({ onSuccess }: { onSuccess: () => void }) {
  const [shopUrl, setShopUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [syncProducts, setSyncProducts] = useState(true);
  const [syncOrders, setSyncOrders] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/connectors/ecommerce/shopify', { platform: 'shopify', shopUrl, accessToken, syncProducts, syncOrders, syncCustomers: false });
      setStatus('Synchronisation Shopify demarree.'); onSuccess();
    } catch { setStatus('Erreur lors de la synchronisation.'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL de la boutique</label>
        <input value={shopUrl} onChange={(e) => setShopUrl(e.target.value)} placeholder="mon-shop.myshopify.com"
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access Token</label>
        <div className="relative">
          <input type={showToken ? 'text' : 'password'} value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" required />
          <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={syncProducts} onChange={(e) => setSyncProducts(e.target.checked)} className="rounded" /> Produits
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={syncOrders} onChange={(e) => setSyncOrders(e.target.checked)} className="rounded" /> Commandes
        </label>
      </div>
      {status && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">{status}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-red-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />} Synchroniser Shopify
      </button>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EDITORIAL REDESIGN — Connectivity Rainbow
// ═════════════════════════════════════════════════════════════════════════════

const C = {
  greenDeep:   '#0A4F3C', greenDark: '#063D2E', greenInk: '#042A1F',
  cream:       '#FFFAF0', creamDeep: '#F5EDD6',
  violet:      '#7C3AED', violetDeep: '#5B21B6', violetDark: '#3B0764', violetSoft: '#F3E8FF', violetLight: '#C4B5FD',
  cyan:        '#06B6D4', cyanDeep: '#0891B2', cyanDark: '#155E75', cyanSoft: '#CFFAFE',
  gold:        '#D4A017', goldDeep: '#B8860B', goldDark: '#8B6914', goldSoft: '#FEF3C7',
  sage:        '#10B981', sageDeep: '#059669', sageDark: '#065F46', sageSoft: '#D1FAE5',
  coral:       '#FB7185', coralDeep: '#E11D48', coralSoft: '#FFE4E6',
  red:         '#EF4444', redSoft: '#FEE2E2', redDeep: '#DC2626',
  indigo:      '#4338CA', pink: '#EC4899', purple: '#9333EA',
  ink:         '#0A2A20', inkSoft: '#5A6B62', inkLight: '#94A3A0',
} as const;

interface CatalogEntry {
  id: string;
  name: string;
  desc: string;
  cat: 'google' | 'microsoft' | 'communication' | 'data' | 'media' | 'productivity' | 'finance' | 'crm' | 'dev';
  color: string;
  bg: string;
  logo: string;
  popular: boolean;
  recommended: boolean;
  permissions: string[];
  /** Maps to FORMS key when a setup form exists. */
  formKey?: string;
  /** Optional admin route fallback. */
  adminRoute?: string;
  /** When CONNECTOR_TYPES.id matches this, the catalog entry is hydrated as connected. */
  recordType?: string;
  /** Extra discriminator for `database` and `ecommerce` records. */
  recordPlatform?: string;
}

// IDs of connectors with a real, tested backend. The rest of the catalog stays
// in the file (so we can flip the switch later) but is filtered out of the UI
// until each one is actually wired. Avoids the launch-day frustration of a
// customer clicking "Connect Slack" and getting a silent failure.
const WORKING_CONNECTOR_IDS = new Set<string>([
  // Email
  'gmail',
  // Communication channels
  'whatsapp', 'telegram',
  // Data sources
  'website', 'audio', 'youtube',  // crawler · audio transcription · YouTube transcripts
  'apicustom',                      // generic REST API connector
  'postgres', 'mysql', 'mongodb',   // database connectors (shared form)
  // E-commerce (shared ecommerce form)
  'shopify', 'woocommerce',
  // Billing / payments (admin routes exist)
  'stripe', 'paypal',
]);

const CATALOG: CatalogEntry[] = [
  // GOOGLE WORKSPACE
  { id: 'gmail',      name: 'Gmail',           desc: 'Emails entrants/sortants — recherche, drafts, classification IA', cat: 'google',   color: '#EA4335', bg: '#FCE8E6', logo: 'M', popular: true,  recommended: false, permissions: ['Lire emails', 'Envoyer emails', 'Modifier labels'], formKey: 'gmail', recordType: 'gmail' },
  { id: 'gdrive',     name: 'Google Drive',    desc: 'Drive, Docs, Sheets, Slides — sync automatique + indexation IA', cat: 'google',   color: '#4285F4', bg: '#E8F0FE', logo: 'D', popular: true,  recommended: false, permissions: ['Lire fichiers', 'Modifier fichiers', 'Créer dossiers'], formKey: 'gdrive', recordType: 'gdrive' },
  { id: 'gcal',       name: 'Google Calendar', desc: 'Événements, réunions, disponibilités — création + reminders auto', cat: 'google',   color: '#4285F4', bg: '#E8F0FE', logo: 'C', popular: false, recommended: false, permissions: ['Lire événements', 'Créer événements'], formKey: 'gcalendar', recordType: 'gcalendar' },
  { id: 'gmaps',      name: 'Google Maps',     desc: 'Géolocalisation, itinéraires, recherche de lieux',                cat: 'google',   color: '#34A853', bg: '#E6F4EA', logo: 'M', popular: false, recommended: true,  permissions: ['Géolocalisation', 'Recherche lieux'], formKey: 'gmaps', recordType: 'gmaps' },
  { id: 'gmeet',      name: 'Google Meet',     desc: 'Visioconférences, transcriptions et résumés automatiques',         cat: 'google',   color: '#00897B', bg: '#E0F2F1', logo: 'M', popular: false, recommended: false, permissions: ['Lire meetings', 'Accéder transcriptions'] },
  { id: 'gforms',     name: 'Google Forms',    desc: 'Formulaires, sondages — réponses analysées par IA',                cat: 'google',   color: '#673AB7', bg: '#EDE7F6', logo: 'F', popular: false, recommended: false, permissions: ['Lire formulaires', 'Lire réponses'] },

  // MICROSOFT
  { id: 'outlook',    name: 'Outlook / Exchange', desc: 'Emails Outlook — recherche, envoi, classification IA',          cat: 'microsoft', color: '#0078D4', bg: '#E1F5FE', logo: 'O', popular: true,  recommended: false, permissions: ['Lire emails', 'Envoyer emails'], formKey: 'outlook', recordType: 'outlook' },
  { id: 'odrive',     name: 'OneDrive',        desc: 'Fichiers OneDrive — sync automatique + indexation',                cat: 'microsoft', color: '#0078D4', bg: '#E1F5FE', logo: 'O', popular: false, recommended: false, permissions: ['Lire fichiers', 'Modifier fichiers'], formKey: 'onedrive', recordType: 'onedrive' },
  { id: 'ocal',       name: 'Outlook Calendar', desc: 'Événements Outlook/Teams — sync agenda complet',                  cat: 'microsoft', color: '#0078D4', bg: '#E1F5FE', logo: 'O', popular: false, recommended: false, permissions: ['Lire événements', 'Créer événements'], formKey: 'mscalendar', recordType: 'mscalendar' },
  { id: 'teams',      name: 'Microsoft Teams', desc: 'Messages, canaux, réunions Teams — recherche conversationnelle',   cat: 'microsoft', color: '#5059C9', bg: '#E8EAF6', logo: 'T', popular: true,  recommended: false, permissions: ['Lire messages', 'Envoyer messages'], formKey: 'teams', recordType: 'teams' },
  { id: 'sharepoint', name: 'SharePoint',      desc: 'Documents SharePoint — indexation entreprise',                     cat: 'microsoft', color: '#0078D4', bg: '#E1F5FE', logo: 'S', popular: false, recommended: false, permissions: ['Lire sites', 'Lire documents'], formKey: 'sharepoint', recordType: 'sharepoint' },
  { id: 'excel',      name: 'Excel Online',    desc: 'Spreadsheets Excel — analyse + calculs IA',                        cat: 'microsoft', color: '#107C41', bg: '#E8F5E9', logo: 'X', popular: false, recommended: false, permissions: ['Lire fichiers', 'Modifier formules'] },
  { id: 'powerpoint', name: 'PowerPoint',      desc: 'Présentations PowerPoint — extraction + génération IA',            cat: 'microsoft', color: '#D24726', bg: '#FFEBEE', logo: 'P', popular: false, recommended: false, permissions: ['Lire présentations', 'Modifier slides'] },

  // COMMUNICATION
  { id: 'slack',      name: 'Slack',           desc: 'Messages, canaux, recherche — notifications inter-agents',         cat: 'communication', color: '#611F69', bg: '#F3E8FF', logo: '#', popular: true,  recommended: false, permissions: ['Lire messages', 'Envoyer messages', 'Créer canaux'], formKey: 'slack', recordType: 'slack' },
  { id: 'whatsapp',   name: 'WhatsApp Business', desc: 'API Business — messages clients, support, marketing',           cat: 'communication', color: '#25D366', bg: '#DCF8C6', logo: 'W', popular: true,  recommended: false, permissions: ['Envoyer messages', 'Lire conversations'], formKey: 'whatsapp', recordType: 'whatsapp', adminRoute: '/admin/whatsapp' },
  { id: 'telegram',   name: 'Telegram',        desc: 'Bots Telegram — notifications + commandes',                       cat: 'communication', color: '#0088CC', bg: '#E1F5FE', logo: 'T', popular: false, recommended: false, permissions: ['Envoyer messages', 'Bot commands'], adminRoute: '/admin/telegram' },
  { id: 'discord',    name: 'Discord',         desc: 'Serveurs Discord — modération + bots IA',                          cat: 'communication', color: '#5865F2', bg: '#E8EAF6', logo: 'D', popular: false, recommended: false, permissions: ['Lire serveurs', 'Modération'] },
  { id: 'twilio',     name: 'Twilio',          desc: 'SMS, appels, OTP — communications programmables',                  cat: 'communication', color: '#F22F46', bg: '#FFEBEE', logo: 'T', popular: false, recommended: true,  permissions: ['Envoyer SMS', 'Appels API'] },
  { id: 'zoom',       name: 'Zoom',            desc: 'Réunions Zoom — transcriptions + résumés automatiques',            cat: 'communication', color: '#2D8CFF', bg: '#E3F2FD', logo: 'Z', popular: false, recommended: false, permissions: ['Lire meetings', 'Transcriptions'] },
  { id: 'sendgrid',   name: 'SendGrid',        desc: 'Emails transactionnels et marketing — API massive',                 cat: 'communication', color: '#1A82E2', bg: '#E1F5FE', logo: 'S', popular: false, recommended: false, permissions: ['Envoyer emails', 'Lire stats'] },

  // DATA
  { id: 'postgres',   name: 'PostgreSQL',      desc: 'Base de données relationnelle — requêtes IA naturelles',           cat: 'data',     color: '#336791', bg: '#E1F5FE', logo: 'P', popular: false, recommended: false, permissions: ['Lecture seule', 'Lire schémas'], formKey: 'database', recordType: 'database', recordPlatform: 'postgresql' },
  { id: 'mysql',      name: 'MySQL',           desc: 'Base de données MySQL/MariaDB',                                     cat: 'data',     color: '#00758F', bg: '#E0F7FA', logo: 'M', popular: false, recommended: false, permissions: ['Lecture seule', 'Schémas'], formKey: 'database', recordType: 'database', recordPlatform: 'mysql' },
  { id: 'mongodb',    name: 'MongoDB',         desc: 'Base NoSQL — documents JSON, agrégations IA',                       cat: 'data',     color: '#13AA52', bg: '#E8F5E9', logo: 'M', popular: false, recommended: false, permissions: ['Lecture collections'], formKey: 'database', recordType: 'database', recordPlatform: 'mongodb' },
  { id: 'firebase',   name: 'Firebase',        desc: 'Firestore, Realtime DB, Auth — sync temps réel',                    cat: 'data',     color: '#FFCA28', bg: '#FFF8E1', logo: 'F', popular: false, recommended: false, permissions: ['Lire collections', 'Auth users'] },
  { id: 'supabase',   name: 'Supabase',        desc: 'Postgres + Auth + Storage — alternative open source',               cat: 'data',     color: '#3ECF8E', bg: '#E8F8F0', logo: 'S', popular: false, recommended: false, permissions: ['Lecture tables', 'Auth'] },
  { id: 'website',    name: 'Site Web (Crawler)', desc: 'Crawler — indexez votre site pour le RAG agent',                cat: 'data',     color: '#3B82F6', bg: '#DBEAFE', logo: 'W', popular: false, recommended: false, permissions: ['Lecture publique'], formKey: 'web', recordType: 'web' },
  { id: 'apicustom',  name: 'API Custom',      desc: 'Connectez n\'importe quelle API REST avec auth flexible',           cat: 'data',     color: '#7C3AED', bg: '#F3E8FF', logo: 'A', popular: false, recommended: false, permissions: ['Configurable'], formKey: 'api', recordType: 'api' },
  { id: 'snowflake',  name: 'Snowflake',       desc: 'Data warehouse — analytics IA sur grosses volumétries',             cat: 'data',     color: '#29B5E8', bg: '#E1F5FE', logo: 'S', popular: false, recommended: false, permissions: ['Lecture warehouse'] },
  { id: 'bigquery',   name: 'BigQuery',        desc: 'Google BigQuery — SQL massif analytique',                           cat: 'data',     color: '#669DF6', bg: '#E8F0FE', logo: 'B', popular: false, recommended: false, permissions: ['Lecture datasets'] },

  // MEDIA
  { id: 'youtube',    name: 'YouTube',         desc: 'Transcriptions YouTube + analyse contenus',                         cat: 'media',    color: '#FF0000', bg: '#FFEBEE', logo: 'Y', popular: false, recommended: false, permissions: ['Lire vidéos publiques'], formKey: 'video', recordType: 'video' },
  { id: 'spotify',    name: 'Spotify',         desc: 'Playlists, podcasts — recommandations IA',                          cat: 'media',    color: '#1DB954', bg: '#E8F5E9', logo: 'S', popular: false, recommended: false, permissions: ['Lire playlists'] },
  { id: 'tiktok',     name: 'TikTok Business', desc: 'Compte business TikTok — analytics + scheduling',                    cat: 'media',    color: '#000000', bg: '#F5F5F5', logo: 'T', popular: false, recommended: true,  permissions: ['Lire stats', 'Publier vidéos'] },
  { id: 'instagram',  name: 'Instagram',       desc: 'Posts, reels, DMs — gestion social media IA',                       cat: 'media',    color: '#E4405F', bg: '#FCE4EC', logo: 'I', popular: true,  recommended: false, permissions: ['Publier posts', 'Lire DMs'] },
  { id: 'facebook',   name: 'Facebook Pages',  desc: 'Pages Facebook + Messenger — community management',                   cat: 'media',    color: '#1877F2', bg: '#E3F2FD', logo: 'F', popular: false, recommended: false, permissions: ['Lire pages', 'Publier'] },
  { id: 'linkedin',   name: 'LinkedIn',        desc: 'Profil + Pages entreprise — leads + posts',                          cat: 'media',    color: '#0A66C2', bg: '#E1F5FE', logo: 'L', popular: false, recommended: false, permissions: ['Lire profil', 'Publier posts'] },
  { id: 'audio',      name: 'Audio / Podcast', desc: 'Transcription audio universelle — Whisper IA',                       cat: 'media',    color: '#7C3AED', bg: '#F3E8FF', logo: 'A', popular: false, recommended: false, permissions: ['Upload fichiers'], formKey: 'audio', recordType: 'audio' },

  // PRODUCTIVITY
  { id: 'notion',     name: 'Notion',          desc: 'Pages, bases de données, wiki — knowledge base IA',                  cat: 'productivity', color: '#000000', bg: '#F5F5F5', logo: 'N', popular: true,  recommended: false, permissions: ['Lire pages', 'Modifier pages'], formKey: 'notion', recordType: 'notion' },
  { id: 'airtable',   name: 'Airtable',        desc: 'Bases relationnelles visuelles — CRM, projets, inventaire',          cat: 'productivity', color: '#FCB400', bg: '#FFF8E1', logo: 'A', popular: false, recommended: false, permissions: ['Lire bases', 'Modifier records'] },
  { id: 'asana',      name: 'Asana',           desc: 'Gestion de projets — tâches, deadlines, équipes',                    cat: 'productivity', color: '#F06A6A', bg: '#FFEBEE', logo: 'A', popular: false, recommended: false, permissions: ['Lire projets', 'Créer tâches'] },
  { id: 'trello',     name: 'Trello',          desc: 'Boards Kanban — workflow visuel',                                     cat: 'productivity', color: '#0079BF', bg: '#E1F5FE', logo: 'T', popular: false, recommended: false, permissions: ['Lire boards', 'Modifier cartes'] },
  { id: 'jira',       name: 'Jira',            desc: 'Tickets dev + agile sprints — gestion bugs IA',                       cat: 'productivity', color: '#0052CC', bg: '#E3F2FD', logo: 'J', popular: false, recommended: false, permissions: ['Lire tickets', 'Créer issues'] },
  { id: 'linear',     name: 'Linear',          desc: 'Issue tracking moderne pour équipes produit',                          cat: 'productivity', color: '#5E6AD2', bg: '#E8EAF6', logo: 'L', popular: false, recommended: false, permissions: ['Lire issues', 'Créer issues'] },
  { id: 'monday',     name: 'Monday.com',      desc: 'Work OS — gestion projets, CRM, ressources',                          cat: 'productivity', color: '#FF3D57', bg: '#FFEBEE', logo: 'M', popular: false, recommended: false, permissions: ['Lire boards', 'Modifier items'] },
  { id: 'clickup',    name: 'ClickUp',         desc: 'Tout-en-un productivité — docs, tâches, goals',                       cat: 'productivity', color: '#7B68EE', bg: '#F3E5F5', logo: 'C', popular: false, recommended: false, permissions: ['Lire workspaces', 'Modifier tâches'] },

  // FINANCE / E-COMMERCE
  { id: 'stripe',     name: 'Stripe',          desc: 'Paiements + abonnements — analytics revenus',                          cat: 'finance', color: '#635BFF', bg: '#EEEEFE', logo: 'S', popular: true,  recommended: true,  permissions: ['Lire transactions', 'Lire customers'], adminRoute: '/admin/billing' },
  { id: 'shopify',    name: 'Shopify',         desc: 'E-commerce — produits, commandes, clients',                            cat: 'finance', color: '#95BF47', bg: '#F1F8E9', logo: 'S', popular: true,  recommended: false, permissions: ['Lire commandes', 'Modifier produits'], formKey: 'ecommerce', recordType: 'ecommerce', recordPlatform: 'shopify' },
  { id: 'woocommerce',name: 'WooCommerce',     desc: 'Plugin WordPress e-commerce',                                          cat: 'finance', color: '#7F54B3', bg: '#F3E5F5', logo: 'W', popular: false, recommended: false, permissions: ['Lire produits', 'Modifier commandes'], formKey: 'ecommerce', recordType: 'ecommerce', recordPlatform: 'woocommerce' },
  { id: 'quickbooks', name: 'QuickBooks',      desc: 'Comptabilité — factures, dépenses, taxes',                             cat: 'finance', color: '#2CA01C', bg: '#E8F5E9', logo: 'Q', popular: false, recommended: false, permissions: ['Lire factures', 'Lire comptes'] },
  { id: 'wave',       name: 'Wave',            desc: 'Comptabilité gratuite — invoicing + reporting',                        cat: 'finance', color: '#19B5C0', bg: '#E0F7FA', logo: 'W', popular: false, recommended: false, permissions: ['Lire transactions'] },
  { id: 'paypal',     name: 'PayPal',          desc: 'Paiements PayPal — transactions + remboursements',                     cat: 'finance', color: '#00457C', bg: '#E1F5FE', logo: 'P', popular: false, recommended: false, permissions: ['Lire transactions'], adminRoute: '/admin/billing' },

  // CRM
  { id: 'salesforce', name: 'Salesforce',      desc: 'CRM #1 mondial — leads, opportunités, pipeline',                       cat: 'crm',     color: '#00A1E0', bg: '#E1F5FE', logo: 'S', popular: true,  recommended: false, permissions: ['Lire leads', 'Modifier opps'] },
  { id: 'hubspot',    name: 'HubSpot',         desc: 'CRM + Marketing automation — leads inbound',                            cat: 'crm',     color: '#FF7A59', bg: '#FFEDE5', logo: 'H', popular: true,  recommended: true,  permissions: ['Lire contacts', 'Modifier deals'] },
  { id: 'pipedrive',  name: 'Pipedrive',       desc: 'CRM visuel pour équipes ventes',                                        cat: 'crm',     color: '#1A1A1A', bg: '#F5F5F5', logo: 'P', popular: false, recommended: false, permissions: ['Lire pipeline', 'Modifier deals'] },
  { id: 'zoho',       name: 'Zoho CRM',        desc: 'Suite Zoho complète — CRM + apps',                                      cat: 'crm',     color: '#E42527', bg: '#FFEBEE', logo: 'Z', popular: false, recommended: false, permissions: ['Lire CRM', 'Modifier records'] },
  { id: 'intercom',   name: 'Intercom',        desc: 'Live chat support + CRM client',                                         cat: 'crm',     color: '#1F8DED', bg: '#E1F5FE', logo: 'I', popular: false, recommended: false, permissions: ['Lire conversations', 'Envoyer messages'] },

  // DEV
  { id: 'github',     name: 'GitHub',          desc: 'Code source, issues, PRs — review IA + docs auto',                      cat: 'dev',     color: '#181717', bg: '#F5F5F5', logo: 'G', popular: true,  recommended: false, permissions: ['Lire repos', 'Lire issues', 'Comments'] },
  { id: 'gitlab',     name: 'GitLab',          desc: 'Repos GitLab + CI/CD',                                                  cat: 'dev',     color: '#FC6D26', bg: '#FFEDE5', logo: 'G', popular: false, recommended: false, permissions: ['Lire repos', 'Lire pipelines'] },
  { id: 'sentry',     name: 'Sentry',          desc: 'Monitoring erreurs production — alerting IA',                            cat: 'dev',     color: '#362D59', bg: '#EDE7F6', logo: 'S', popular: false, recommended: false, permissions: ['Lire issues', 'Lire perf'] },
  { id: 'vercel',     name: 'Vercel',          desc: 'Déploiements + analytics frontend',                                      cat: 'dev',     color: '#000000', bg: '#F5F5F5', logo: 'V', popular: false, recommended: false, permissions: ['Lire déploiements', 'Logs'] },
];

const NEW_CATEGORIES: Array<{ id: string; label: string; icon: React.ElementType; color: string }> = [
  { id: 'all',           label: 'Tous',          icon: Boxes,         color: C.violet },
  { id: 'google',        label: 'Google',        icon: Globe,         color: '#4285F4' },
  { id: 'microsoft',     label: 'Microsoft',     icon: Building2,     color: '#0078D4' },
  { id: 'communication', label: 'Communication', icon: MessageSquare, color: C.cyan },
  { id: 'data',          label: 'Données',       icon: Database,      color: C.indigo },
  { id: 'media',         label: 'Media',         icon: Video,         color: C.pink },
  { id: 'productivity',  label: 'Productivité',  icon: Wrench,        color: C.gold },
  { id: 'finance',       label: 'Finance',       icon: TrendingUp,    color: C.sage },
  { id: 'crm',           label: 'CRM & Sales',   icon: Target,        color: C.coral },
  { id: 'dev',           label: 'Développement', icon: Code,           color: C.purple },
];

type HydratedEntry = CatalogEntry & {
  connected: boolean;
  docs: string | null;
  sync: string | null;
  realRecord?: ConnectorRecord;
};

function relativeTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  const diffMs = Date.now() - d;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.round(h / 24);
  return `il y a ${days}j`;
}

const EDITORIAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,800&family=JetBrains+Mono:wght@600;800&display=swap');
  .conn-page { font-family: 'Inter', sans-serif; }
  .conn-page .display-font { font-family: 'Fraunces', serif; letter-spacing: -0.02em; }
  .conn-page .mono-font { font-family: 'JetBrains Mono', monospace; }
  .conn-page .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .conn-page .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.sage}; position: relative; flex-shrink: 0; }
  .conn-page .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.sage}; opacity: 0.4; animation: connPulse 1.8s ease-in-out infinite; }
  @keyframes connPulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.6); opacity: 0; } }
  .conn-page .card-lift { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); }
  .conn-page .card-lift:hover { transform: translateY(-3px); }
  .conn-page .grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  .conn-page .scroll-thin::-webkit-scrollbar { width: 6px; height: 6px; }
  .conn-page .scroll-thin::-webkit-scrollbar-thumb { background: rgba(10,42,32,0.15); border-radius: 100px; }
  @media (max-width: 1024px) { .conn-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .conn-grid-3 { grid-template-columns: repeat(2, 1fr) !important; } }
  @media (max-width: 640px) { .conn-grid-4, .conn-grid-3 { grid-template-columns: 1fr !important; } .conn-hero-title { font-size: 24px !important; } .conn-hero-side { display: none !important; } }
  @keyframes connModalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .conn-modal-in { animation: connModalIn 0.25s cubic-bezier(0.4,0,0.2,1); }
  @keyframes connOverlayIn { from { opacity: 0; } to { opacity: 1; } }
  .conn-overlay-in { animation: connOverlayIn 0.2s ease-out; }
`;

function HeroSection({ activeCount, totalDocs, totalAvailable }: { activeCount: number; totalDocs: number; totalAvailable: number }) {
  // Local alias so the existing JSX (which used `hydrated.length`) keeps working.
  const hydrated = { length: totalAvailable };
  return (
    <div style={{
      position: 'relative',
      background: `linear-gradient(135deg, ${C.violetDark} 0%, ${C.violetDeep} 50%, ${C.cyanDark} 100%)`,
      borderRadius: 22, padding: '24px 28px', overflow: 'hidden',
      border: `1px solid ${C.violet}40`,
      boxShadow: `0 20px 50px -20px ${C.violet}`,
    }}>
      <div className="grain"></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2, gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px -6px ${C.violet}` }}>
              <Plug size={28} color={C.cream} strokeWidth={2} />
            </div>
            <div>
              <h1 className="display-font conn-hero-title" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, lineHeight: 1.1 }}>
                <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>Connecteurs</em> de données
              </h1>
              <div style={{ fontSize: 12, color: 'rgba(255,250,240,0.85)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="live-dot"></span>
                <span style={{ fontWeight: 600 }}>{activeCount} actifs · {hydrated.length} disponibles · Sync 24/7</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,250,240,0.85)', margin: '0 0 14px', lineHeight: 1.5, maxWidth: 600 }}>
            Branchez Orlode à <strong style={{ color: C.cyan }}>{hydrated.length} sources</strong>. Vos agents auront accès à vos outils — Gmail, WhatsApp, Telegram, base de données, e-commerce et plus. <strong style={{ color: C.gold }}>Plus de données = plus d'intelligence</strong>.
          </p>
        </div>

        <div className="conn-hero-side" style={{
          background: 'rgba(255,250,240,0.06)', border: `1px solid ${C.gold}30`,
          borderRadius: 16, padding: 16, minWidth: 240,
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Network size={14} color={C.gold} />
            <span style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: '0.1em' }}>ÉCOSYSTÈME · LIVE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Documents indexés', value: totalDocs.toLocaleString('fr-FR'), color: C.cyan },
              { label: 'Connecteurs actifs', value: String(activeCount), color: C.sage },
              { label: 'Catalogue',          value: String(hydrated.length), color: C.gold },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <span style={{ color: 'rgba(255,250,240,0.7)' }}>{s.label}</span>
                <span className="mono-font" style={{ color: s.color, fontWeight: 700, fontSize: 11 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewKPICards({ activeCount, totalDocs, recordCount, totalAvailable }: { activeCount: number; totalDocs: number; recordCount: number; totalAvailable: number }) {
  const stats = [
    { label: 'Connecteurs actifs', value: String(activeCount), sub: `sur ${totalAvailable} disponibles`, icon: Plug,     color: { main: C.violet, deep: C.violetDeep, soft: C.violetSoft } },
    { label: 'Documents indexés',  value: totalDocs.toLocaleString('fr-FR'), sub: 'sync continu',         icon: FileBox,  color: { main: C.cyan,   deep: C.cyanDeep,   soft: C.cyanSoft } },
    { label: 'Sources branchées',  value: String(recordCount), sub: 'comptes connectés',                  icon: RefreshCw, color: { main: C.gold,   deep: C.goldDeep,   soft: C.goldSoft } },
    { label: 'Catégories',          value: String(NEW_CATEGORIES.length - 1), sub: 'écosystèmes',         icon: Boxes,    color: { main: C.sage,   deep: C.sageDeep,   soft: C.sageSoft } },
  ];
  return (
    <div className="conn-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} className="card-lift" style={{ background: C.cream, borderRadius: 16, padding: 16, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${s.color.main}, ${s.color.deep})` }} />
            <div style={{ width: 40, height: 40, borderRadius: 11, background: s.color.soft, color: s.color.deep, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Icon size={20} />
            </div>
            <div className="display-font mono-font" style={{ fontSize: 30, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 6 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 1 }}>{s.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

function NewConnectorCard({ entry, onClick, compact }: { entry: HydratedEntry; onClick: (e: HydratedEntry) => void; compact?: boolean }) {
  const isConnected = entry.connected;
  return (
    <div onClick={() => onClick(entry)} className="card-lift" style={{
      background: C.cream, borderRadius: 14, padding: compact ? 12 : 16,
      border: isConnected ? `1.5px solid ${C.sage}40` : '1px solid rgba(10,42,32,0.06)',
      cursor: 'pointer', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        {isConnected && (
          <span className="pill" style={{ background: C.sageSoft, color: C.sageDark, fontSize: 9, fontWeight: 800, border: `1px solid ${C.sage}30` }}>
            <span className="live-dot" style={{ width: 6, height: 6 }}></span>CONNECTÉ
          </span>
        )}
        {!isConnected && entry.recommended && (
          <span className="pill" style={{ background: `${C.gold}20`, color: C.goldDark, fontSize: 9, fontWeight: 800, border: `1px solid ${C.gold}40` }}>
            <Sparkles size={9} /> RECO
          </span>
        )}
        {!isConnected && !entry.recommended && entry.popular && (
          <span className="pill" style={{ background: `${C.coral}20`, color: C.coralDeep, fontSize: 9, fontWeight: 800, border: `1px solid ${C.coral}40` }}>
            <Flame size={9} /> POPULAIRE
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, paddingRight: 75 }}>
        <div style={{ width: compact ? 40 : 48, height: compact ? 40 : 48, borderRadius: 12, background: entry.bg, color: entry.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: compact ? 20 : 24, fontWeight: 800, fontFamily: 'Fraunces, serif', border: `1px solid ${entry.color}20` }}>{entry.logo}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="display-font" style={{ fontSize: compact ? 14 : 15, fontWeight: 700, color: C.ink, margin: 0 }}>{entry.name}</h3>
          {!compact && (() => {
            const cat = NEW_CATEGORIES.find(c => c.id === entry.cat);
            if (!cat) return null;
            return <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 600, marginTop: 2 }}><span style={{ color: cat.color }}>●</span> {cat.label}</div>;
          })()}
        </div>
      </div>
      <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 12px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 32 }}>{entry.desc}</p>
      {isConnected && !compact && (
        <div style={{ background: `${C.sage}08`, border: `1px solid ${C.sage}20`, borderRadius: 9, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 11 }}>
          <RefreshCw size={11} color={C.sageDeep} />
          <div style={{ flex: 1, minWidth: 0, color: C.sageDark, fontWeight: 700 }}>
            {entry.docs ? `${entry.docs} docs` : 'Connecté'}{entry.sync ? ` · sync ${entry.sync}` : ''}
          </div>
        </div>
      )}
      <button style={{
        width: '100%',
        background: isConnected ? 'transparent' : `linear-gradient(135deg, ${entry.color}, ${entry.color}cc)`,
        color: isConnected ? C.sageDark : C.cream,
        border: isConnected ? `1.5px solid ${C.sage}30` : 'none',
        padding: '8px 12px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      }}>
        {isConnected ? (<><Settings size={11} /> Configurer</>) : (<><Plus size={11} /> Connecter</>)}
      </button>
    </div>
  );
}

function ActiveSection({ entries, onSelect }: { entries: HydratedEntry[]; onSelect: (e: HydratedEntry) => void }) {
  if (entries.length === 0) return null;
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.cream}, ${C.creamDeep})`, borderRadius: 18, padding: 20, border: `1.5px solid ${C.sage}30` }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="pill" style={{ background: C.sageSoft, color: C.sageDark, fontWeight: 700, fontSize: 10, border: `1px solid ${C.sage}40` }}>
            <CheckCircle2 size={11} /> {entries.length} ACTIFS
          </span>
          <span className="live-dot"></span>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.sageDark, letterSpacing: '0.05em' }}>SYNC 24/7</span>
        </div>
        <h2 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>
          Vos connecteurs <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.sageDeep }}>actifs</em>
        </h2>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '2px 0 0' }}>OAuth 2.0 · Chiffrement AES-256 · RGPD</p>
      </div>
      <div className="conn-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {entries.map(e => <NewConnectorCard key={e.id} entry={e} onClick={onSelect} />)}
      </div>
    </div>
  );
}

function RecommendedSection({ entries, onSelect }: { entries: HydratedEntry[]; onSelect: (e: HydratedEntry) => void }) {
  const recs = entries.filter(e => e.recommended && !e.connected).slice(0, 4);
  if (recs.length === 0) return null;
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.violetDark}, ${C.violetDeep})`, borderRadius: 18, padding: 20, border: `1px solid ${C.gold}40`, position: 'relative', overflow: 'hidden' }}>
      <div className="grain"></div>
      <div style={{ position: 'relative', zIndex: 1, marginBottom: 14 }}>
        <span className="pill" style={{ background: `${C.gold}25`, color: C.gold, fontWeight: 700, fontSize: 10, border: `1px solid ${C.gold}50`, marginBottom: 4 }}>
          <Sparkles size={11} /> ORLODE COPILOT
        </span>
        <h2 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: 0 }}>
          <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>Recommandés</em> pour vous
        </h2>
        <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.75)', margin: '2px 0 0' }}>L'IA suggère ces connecteurs pour booster vos agents</p>
      </div>
      <div className="conn-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, position: 'relative', zIndex: 1 }}>
        {recs.map(e => <NewConnectorCard key={e.id} entry={e} onClick={onSelect} />)}
      </div>
    </div>
  );
}

function CatalogSection({ entries, onSelect }: { entries: HydratedEntry[]; onSelect: (e: HydratedEntry) => void }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = entries.filter(e => {
    if (activeCategory !== 'all' && e.cat !== activeCategory) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getCategoryCount = (catId: string) => catId === 'all' ? entries.length : entries.filter(e => e.cat === catId).length;

  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)' }}>
      <div style={{ marginBottom: 16 }}>
        <span className="pill" style={{ background: C.violetSoft, color: C.violetDeep, fontWeight: 700, fontSize: 10, marginBottom: 4 }}>
          <Boxes size={11} /> CATALOGUE · {entries.length} CONNECTEURS
        </span>
        <h2 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>
          Toute la <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>bibliothèque</em>
        </h2>
      </div>

      <div style={{ background: C.creamDeep, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, border: '1.5px solid rgba(10,42,32,0.08)' }}>
        <Search size={16} color={C.inkSoft} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher (Slack, Stripe, Notion…)" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: C.ink, fontFamily: 'inherit' }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ width: 28, height: 28, borderRadius: 7, background: 'transparent', border: 'none', color: C.inkSoft, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        )}
        <span className="mono-font" style={{ fontSize: 10, color: C.inkLight, padding: '3px 7px', background: C.cream, borderRadius: 5, fontWeight: 600 }}>{filtered.length} résultats</span>
      </div>

      <div className="scroll-thin" style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'wrap', marginBottom: 16 }}>
        {NEW_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const active = activeCategory === cat.id;
          const count = getCategoryCount(cat.id);
          return (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
              background: active ? `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` : 'transparent',
              color: active ? C.cream : C.inkSoft,
              padding: '8px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(10,42,32,0.1)',
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
              boxShadow: active ? `0 6px 14px -4px ${cat.color}` : 'none',
            }}>
              <Icon size={13} />
              <span>{cat.label}</span>
              <span className="mono-font" style={{ background: active ? 'rgba(255,250,240,0.25)' : C.creamDeep, color: active ? C.cream : C.inkSoft, padding: '1px 7px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length > 0 ? (
        <div className="conn-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {filtered.map(e => <NewConnectorCard key={e.id} entry={e} onClick={onSelect} />)}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, background: C.creamDeep, borderRadius: 14, border: '1px dashed rgba(10,42,32,0.15)' }}>
          <Search size={48} color={C.inkLight} style={{ marginBottom: 12 }} />
          <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px' }}>Aucun connecteur trouvé</h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>Ajustez vos filtres ou demandez l'ajout d'un connecteur</p>
        </div>
      )}
    </div>
  );
}

function PopularSection({ entries, onSelect }: { entries: HydratedEntry[]; onSelect: (e: HydratedEntry) => void }) {
  const popular = entries.filter(e => e.popular).slice(0, 6);
  if (popular.length === 0) return null;
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)' }}>
      <div style={{ marginBottom: 14 }}>
        <span className="pill" style={{ background: `${C.coral}20`, color: C.coralDeep, fontWeight: 700, fontSize: 10, marginBottom: 4 }}>
          <Flame size={11} /> TENDANCE
        </span>
        <h2 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>
          Les plus <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.coral }}>populaires</em>
        </h2>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '2px 0 0' }}>Top connecteurs activés sur Orlode</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {popular.map((c, i) => (
          <div key={c.id} onClick={() => onSelect(c)} className="card-lift" style={{ background: C.creamDeep, borderRadius: 12, padding: 12, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono-font" style={{ fontSize: 14, fontWeight: 800, color: i < 3 ? C.coralDeep : C.inkLight, minWidth: 24, textAlign: 'center' }}>#{i + 1}</span>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, fontFamily: 'Fraunces, serif', border: `1px solid ${c.color}20`, flexShrink: 0 }}>{c.logo}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                <span className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{c.name}</span>
                {c.connected && <span className="pill" style={{ background: C.sageSoft, color: C.sageDark, fontSize: 9, fontWeight: 700 }}>● Connecté</span>}
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.desc}</div>
            </div>
            <ChevronRight size={16} color={C.inkLight} style={{ flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusWidget() {
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.cream}, ${C.creamDeep})`, borderRadius: 18, padding: 20, border: `1.5px solid ${C.cyan}30`, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 8px 20px -6px ${C.cyan}` }}>
        <ShieldCheck size={30} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
          <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>Sécurité</em> de vos données
        </h3>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0', lineHeight: 1.5 }}>
          Chiffrement <strong>AES-256</strong> · OAuth 2.0 · <strong>RGPD/SOC 2</strong> · Hébergement <strong>EU/Africa</strong>
        </p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="pill" style={{ background: C.sageSoft, color: C.sageDark, fontSize: 10, fontWeight: 700 }}><Lock size={10} /> CHIFFRÉ</span>
        <span className="pill" style={{ background: `${C.cyan}15`, color: C.cyanDeep, fontSize: 10, fontWeight: 700 }}><KeyRound size={10} /> OAUTH 2.0</span>
        <span className="pill" style={{ background: `${C.gold}15`, color: C.goldDark, fontSize: 10, fontWeight: 700 }}><BadgeCheck size={10} /> RGPD</span>
      </div>
    </div>
  );
}

function ConnectionModal({
  entry, onClose, onDisconnect, formNode,
}: {
  entry: HydratedEntry;
  onClose: () => void;
  onDisconnect: () => void;
  formNode: React.ReactNode | null;
}) {
  const navigate = useNavigate();
  const cat = NEW_CATEGORIES.find(c => c.id === entry.cat);

  return (
    <div className="conn-overlay-in" style={{ position: 'fixed', inset: 0, background: 'rgba(10,42,32,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }} onClick={onClose}>
      <div className="conn-modal-in" onClick={e => e.stopPropagation()} style={{ background: C.cream, borderRadius: 20, maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px -20px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '24px 28px', background: `linear-gradient(135deg, ${entry.color}15, ${entry.color}05)`, borderBottom: '1px solid rgba(10,42,32,0.08)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, background: entry.bg, color: entry.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 28, fontWeight: 800, fontFamily: 'Fraunces, serif', border: `1.5px solid ${entry.color}30`, boxShadow: `0 8px 20px -6px ${entry.color}40` }}>{entry.logo}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {cat && <span className="pill" style={{ background: `${cat.color}15`, color: cat.color, fontSize: 9, fontWeight: 700 }}>{cat.label}</span>}
              {entry.connected && (
                <span className="pill" style={{ background: C.sageSoft, color: C.sageDark, fontSize: 9, fontWeight: 700 }}>
                  <span className="live-dot" style={{ width: 6, height: 6 }}></span> Connecté
                </span>
              )}
            </div>
            <h2 className="display-font" style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: 0 }}>{entry.name}</h2>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: '4px 0 0', lineHeight: 1.5 }}>{entry.desc}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          {entry.connected && entry.realRecord && (
            <div style={{ background: `${C.sage}10`, border: `1px solid ${C.sage}30`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <CheckCircle2 size={14} color={C.sageDeep} />
                <span style={{ fontSize: 11, fontWeight: 800, color: C.sageDark, letterSpacing: '0.08em' }}>CONNEXION ACTIVE</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 700, letterSpacing: '0.05em' }}>DOCUMENTS INDEXÉS</div>
                  <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.sageDark }}>{entry.docs ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 700, letterSpacing: '0.05em' }}>DERNIÈRE SYNC</div>
                  <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.sageDark }}>{entry.sync ?? '—'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Permissions */}
          <h4 className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 8px' }}>Permissions demandées</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {entry.permissions.map((p, i) => (
              <div key={i} style={{ background: C.creamDeep, borderRadius: 10, padding: '8px 12px', border: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: `${entry.color}15`, color: entry.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={12} />
                </div>
                <span style={{ fontSize: 12, color: C.ink, fontWeight: 600, flex: 1 }}>{p}</span>
                <Info size={12} color={C.inkLight} />
              </div>
            ))}
          </div>

          {/* Form / fallback */}
          {formNode ? (
            <div style={{ background: C.creamDeep, borderRadius: 12, padding: 16, border: '1px solid rgba(10,42,32,0.06)' }}>
              {formNode}
            </div>
          ) : entry.adminRoute ? (
            <div style={{ background: `${C.cyan}10`, borderRadius: 12, padding: 14, border: `1px solid ${C.cyan}30`, display: 'flex', gap: 10 }}>
              <Info size={18} color={C.cyanDeep} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, fontSize: 12, color: C.cyanDark, lineHeight: 1.5 }}>
                <strong>Configuration dédiée.</strong> Ce connecteur a sa propre page d'administration.
                <button onClick={() => { onClose(); navigate(entry.adminRoute!); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`, color: C.cream, border: 'none', padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Ouvrir la configuration <ExternalLink size={11} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: `${C.gold}10`, borderRadius: 12, padding: 14, border: `1px solid ${C.gold}30`, display: 'flex', gap: 10 }}>
              <Sparkles size={18} color={C.goldDark} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, fontSize: 12, color: C.goldDark, lineHeight: 1.5 }}>
                <strong>Bientôt disponible.</strong> Ce connecteur arrive prochainement. Demandez-le pour accélérer son développement.
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 28px', background: C.creamDeep, borderTop: '1px solid rgba(10,42,32,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <button onClick={onClose} style={{ background: C.cream, color: C.violetDeep, border: '1.5px solid rgba(10,42,32,0.1)', padding: '10px 16px', borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Fermer
          </button>
          {entry.connected && entry.realRecord && (
            <button onClick={() => { if (confirm(`Déconnecter ${entry.name} ?`)) onDisconnect(); }} style={{ background: 'transparent', color: C.redDeep, border: `1.5px solid ${C.redDeep}30`, padding: '10px 16px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={12} /> Déconnecter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function ConnectorsPage() {
  // Keep using lang & auth stores; reserved for future locale tweaks.
  void useLangStore();
  void useAuthStore();

  const [stats, setStats] = useState<ConnectorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HydratedEntry | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get('/connectors');
      setStats((data as { data?: ConnectorStats }).data ?? (data as ConnectorStats));
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleSuccess = () => { setSelected(null); setTimeout(loadStats, 1500); };

  const handleDisconnectSelected = async () => {
    if (!selected?.realRecord) return;
    try {
      await api.delete(`/connectors/${selected.realRecord.id}`);
      setSelected(null);
      loadStats();
    } catch { /* ignore */ }
  };

  // Hydrate the static catalog with real connection data.
  // Filter to only the connectors with a working backend (see WORKING_CONNECTOR_IDS).
  const hydrated: HydratedEntry[] = useMemo(() => {
    const records = stats?.connectors ?? [];
    return CATALOG.filter(c => WORKING_CONNECTOR_IDS.has(c.id)).map<HydratedEntry>(c => {
      const real = records.find(r => {
        if (!c.recordType || r.type !== c.recordType) return false;
        if (c.recordPlatform) return r.platform === c.recordPlatform;
        return true;
      });
      return {
        ...c,
        connected: !!real,
        docs: real?.lastSyncChunks ? real.lastSyncChunks.toLocaleString('fr-FR') : null,
        sync: relativeTime(real?.lastSyncAt) ?? null,
        realRecord: real,
      };
    });
  }, [stats]);

  const activeEntries = hydrated.filter(e => e.connected);
  const totalDocs = stats?.totalChunks ?? 0;
  const recordCount = stats?.connectors.length ?? 0;

  // Form lookup (existing setup forms — wired into the modal).
  const FORMS_BY_KEY: Record<string, React.ReactNode> = {
    web:        <WebCrawlerForm onSuccess={handleSuccess} />,
    database:   <DatabaseForm onSuccess={handleSuccess} />,
    video:      <VideoForm onSuccess={handleSuccess} />,
    audio:      <AudioForm onSuccess={handleSuccess} />,
    api:        <APIForm onSuccess={handleSuccess} />,
    ecommerce:  <ShopifyForm onSuccess={handleSuccess} />,
    gdrive:     <OAuthConnectorForm connectorId="gdrive" label="Google Drive" color="#4285F4" icon={Cloud} onSuccess={handleSuccess} />,
    gmail:      <GmailOAuthForm onSuccess={handleSuccess} />,
    gcalendar:  <OAuthConnectorForm connectorId="gcalendar" label="Google Calendar" color="#0F9D58" icon={Calendar} onSuccess={handleSuccess} />,
    gmaps:      <OAuthConnectorForm connectorId="gmaps" label="Google Maps" color="#34A853" icon={MapPin} onSuccess={handleSuccess} />,
    onedrive:   <MicrosoftOAuthForm service="onedrive"   label="OneDrive"          color="#0078D4" icon={Cloud}         onSuccess={handleSuccess} />,
    outlook:    <MicrosoftOAuthForm service="outlook"    label="Outlook / Exchange" color="#0078D4" icon={Mail}          onSuccess={handleSuccess} />,
    mscalendar: <MicrosoftOAuthForm service="mscalendar" label="Outlook Calendar"  color="#0078D4" icon={Calendar}      onSuccess={handleSuccess} />,
    teams:      <MicrosoftOAuthForm service="teams"      label="Microsoft Teams"   color="#6264A7" icon={MessageSquare} onSuccess={handleSuccess} />,
    sharepoint: <MicrosoftOAuthForm service="sharepoint" label="SharePoint"        color="#0078D4" icon={FileText}      onSuccess={handleSuccess} />,
    slack:      <OAuthConnectorForm connectorId="slack"    label="Slack"              color="#4A154B" icon={Hash}           onSuccess={handleSuccess} />,
    whatsapp:   <OAuthConnectorForm connectorId="whatsapp" label="WhatsApp Business"  color="#25D366" icon={MessageSquare}  onSuccess={handleSuccess} />,
    notion:     <OAuthConnectorForm connectorId="notion"   label="Notion"             color="#000000" icon={FileText}       onSuccess={handleSuccess} />,
  };

  return (
    <div className="conn-page" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{EDITORIAL_STYLES}</style>
      <HeroSection activeCount={activeEntries.length} totalDocs={totalDocs} totalAvailable={hydrated.length} />
      <NewKPICards activeCount={activeEntries.length} totalDocs={totalDocs} recordCount={recordCount} totalAvailable={hydrated.length} />
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Loader2 size={20} className="animate-spin" color={C.violetDeep} />
        </div>
      )}
      <ActiveSection entries={activeEntries} onSelect={setSelected} />
      <RecommendedSection entries={hydrated} onSelect={setSelected} />
      <CatalogSection entries={hydrated} onSelect={setSelected} />
      <PopularSection entries={hydrated} onSelect={setSelected} />
      <StatusWidget />

      {selected && (
        <ConnectionModal
          entry={selected}
          onClose={() => setSelected(null)}
          onDisconnect={handleDisconnectSelected}
          formNode={selected.formKey ? FORMS_BY_KEY[selected.formKey] ?? null : null}
        />
      )}
    </div>
  );
}
