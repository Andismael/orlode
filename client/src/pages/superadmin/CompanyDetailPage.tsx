import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { ArrowLeft, Users, Bot, CreditCard, AlertTriangle, CheckCircle, Loader2, Trash2, Search, Check, Server, Clock, Shield } from 'lucide-react';

interface User { uid: string; email: string; displayName: string; role: string; createdAt: string; }
interface Agent { id: string; agentId?: string; cachedConfig?: { name?: string }; status?: string; }
interface MarketplaceAgent { id: string; name: string; icon: string; industry: string; priceUSD: number; pricingModel: string; }
interface CompanyDetail {
  id: string; name: string; plan: string; status: string; subscriptionStatus: string;
  email: string; billingEmail: string; createdAt: string; paymentMethod: string;
  selectedAgents: string[]; usersCount: number; users: User[]; installedAgents: Agent[];
}

export default function CompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');

  const load = () => {
    api.get(`/superadmin/companies/${companyId}`)
      .then(r => setCompany(r.data as CompanyDetail))
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [companyId]);

  const doAction = async (action: string, plan?: string, extra?: Record<string, unknown>) => {
    if (action === 'delete' && !confirm('Supprimer cette entreprise ? Irreversible.')) return;
    setActing(action);
    try {
      await api.post(`/superadmin/companies/${companyId}/action`, { action, plan, ...extra });
      if (action === 'delete') { navigate('/superadmin/companies'); return; }
      load();
    } catch {}
    setActing('');
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;
  if (!company) return <div className="p-6 text-red-500 text-sm">Entreprise introuvable</div>;

  const STATUS_COLOR: Record<string, string> = { active: 'bg-green-100 text-green-700', suspended: 'bg-red-100 text-red-700', trial: 'bg-yellow-100 text-yellow-700' };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <button onClick={() => navigate('/superadmin/companies')} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm">
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center text-2xl">🏢</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{company.name || company.id}</h1>
          <p className="text-gray-400 text-sm">{company.email || company.billingEmail}</p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLOR[company.subscriptionStatus ?? company.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {company.subscriptionStatus ?? company.status ?? 'active'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Stat icon={<Users size={18} className="text-blue-500" />} label="Utilisateurs" value={company.usersCount ?? company.users?.length ?? 0} />
        <Stat icon={<Bot size={18} className="text-violet-500" />} label="Agents installes" value={company.installedAgents?.length ?? 0} />
        <Stat icon={<CreditCard size={18} className="text-green-500" />} label="Plan" value={(company.plan ?? 'free').toUpperCase()} />
        <Stat icon={<CreditCard size={18} className="text-amber-500" />} label="Paiement" value={company.paymentMethod || 'Aucun'} />
      </div>

      {/* Trial / Free access banner */}
      {(company as Record<string, unknown>)['trialEndsAt'] && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-amber-800">Periode d'essai active</p>
            <p className="text-xs text-amber-600">Expire le {new Date(String((company as Record<string, unknown>)['trialEndsAt'])).toLocaleDateString('fr-FR')}</p>
          </div>
          <button onClick={() => doAction('end_trial')} disabled={!!acting}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50">
            Terminer l'essai
          </button>
        </div>
      )}
      {(company as Record<string, unknown>)['paymentMethod'] === 'granted' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-green-800">Acces gratuit offert</p>
            <p className="text-xs text-green-600">Plan {(company.plan ?? 'enterprise').toUpperCase()} — offert par le super admin</p>
          </div>
          <button onClick={() => doAction('revoke_free')} disabled={!!acting}
            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-300 rounded-lg hover:bg-green-100 disabled:opacity-50">
            Revoquer
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-700">Statut & Plan</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => doAction('activate')} disabled={!!acting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50">
            <CheckCircle size={14} /> Activer
          </button>
          <button onClick={() => doAction('suspend')} disabled={!!acting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:opacity-50">
            <AlertTriangle size={14} /> Suspendre
          </button>
          {['starter', 'pro', 'premium'].map(p => (
            <button key={p} onClick={() => doAction('upgrade', p)} disabled={!!acting}
              className="px-4 py-2 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50">
              Upgrade → {p}
            </button>
          ))}
        </div>

        <TrialSection acting={acting} doAction={doAction} />

        <HostedExceptionSection companyId={companyId!} company={company} onRefresh={load} />

        <PermissionsSection companyId={companyId!} company={company} onRefresh={load} />

        <MarketplaceSection acting={acting} doAction={doAction} companyId={companyId!}
          installedAgents={company.installedAgents ?? []} onRefresh={load} />

        <h2 className="text-sm font-bold text-gray-700 pt-2">Données de demo</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => doAction('seed_demo')} disabled={!!acting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            Charger données de demo
          </button>
          <button onClick={() => doAction('clear_demo')} disabled={!!acting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50">
            Supprimer données de demo
          </button>
        </div>

        <h2 className="text-sm font-bold text-gray-700 pt-2 text-red-600">Zone de danger</h2>
        <button onClick={() => doAction('delete')} disabled={!!acting}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50">
          <Trash2 size={14} /> Supprimer l'entreprise
        </button>
      </div>

      {/* Users */}
      {company.users?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Utilisateurs ({company.users.length})</h2>
          <div className="space-y-2">
            {company.users.map(u => (
              <div key={u.uid} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700">
                  {(u.displayName || u.email)?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{u.displayName || 'Sans nom'}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Installed agents */}
      {company.installedAgents?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Agents installes ({company.installedAgents.length})</h2>
          <div className="flex flex-wrap gap-2">
            {company.installedAgents.map(a => (
              <span key={a.id} className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium">
                {a.cachedConfig?.name ?? a.agentId ?? a.id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Informations</h2>
        <div className="space-y-2">
          {[
            { label: 'ID', value: company.id },
            { label: 'Email', value: company.email || company.billingEmail || '—' },
            { label: 'Plan', value: company.plan ?? 'free' },
            { label: 'Cree le', value: company.createdAt ? new Date(company.createdAt).toLocaleDateString('fr-FR') : '—' },
          ].map(f => (
            <div key={f.label} className="flex justify-between text-sm">
              <span className="text-gray-400">{f.label}</span>
              <span className="text-gray-900 font-mono text-xs">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="mb-2">{icon}</div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

// ── Trial Section — custom duration + plan ────────────────────────────────

function TrialSection({ acting, doAction }: {
  acting: string;
  doAction: (action: string, plan?: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [trialDays, setTrialDays] = useState(14);
  const [trialPlan, setTrialPlan] = useState('pro');

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 pt-2">Essai gratuit & Acces offert</h2>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-blue-700 uppercase">Essai personnalise</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Duree (jours)</label>
            <input type="number" min={1} max={365} value={trialDays} onChange={e => setTrialDays(Number(e.target.value))}
              className="w-20 px-2 py-1.5 text-sm border border-blue-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Plan</label>
            <select value={trialPlan} onChange={e => setTrialPlan(e.target.value)}
              className="px-3 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <button onClick={() => doAction('grant_trial', undefined, { trialDays, trialPlan })} disabled={!!acting}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 mt-4 sm:mt-0">
            Accorder l'essai
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[7, 14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setTrialDays(d)}
              className={`px-2.5 py-1 text-xs rounded-full border ${trialDays === d ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-600 border-blue-200 hover:bg-blue-100'}`}>
              {d}j
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['starter', 'pro', 'premium'].map(p => (
          <button key={p} onClick={() => doAction('grant_free', p)} disabled={!!acting}
            className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50">
            Offrir {p} gratuit permanent
          </button>
        ))}
      </div>
    </>
  );
}

// ── Marketplace Section — select specific agents per company ──────────────

function HostedExceptionSection({ companyId, company, onRefresh }: {
  companyId: string;
  company: CompanyDetail;
  onRefresh: () => void;
}) {
  const [hours, setHours] = useState<number>(48);
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const ex = (company as unknown as { hostedException?: { expiresAt?: string; reason?: string; hours?: number } }).hostedException;
  const byoeEnabled = (company as unknown as { byoeEnabled?: boolean }).byoeEnabled === true;
  const active = ex?.expiresAt && new Date(ex.expiresAt).getTime() > Date.now();

  const grant = async () => {
    setLoading(true);
    try {
      await api.post(`/superadmin/companies/${companyId}/hosted-exception`, { hours, reason });
      onRefresh();
    } finally { setLoading(false); }
  };

  const revoke = async () => {
    if (!confirm('Revoquer l\'acces heberge ? Les agents seront bloques sauf si BYOE est configure.')) return;
    setLoading(true);
    try {
      await api.delete(`/superadmin/companies/${companyId}/hosted-exception`);
      onRefresh();
    } finally { setLoading(false); }
  };

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Server size={14} className="text-orange-600" />
        <h2 className="text-sm font-bold text-gray-700">Acces heberge (bypass BYOE)</h2>
      </div>

      {byoeEnabled ? (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          ✓ BYOE configure — cette entreprise heberge ses donnees elle-meme. Aucune exception necessaire.
        </p>
      ) : active && ex?.expiresAt ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-900 flex items-center gap-1">
              <Clock size={12} /> Acces heberge actif
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              Expire le {new Date(ex.expiresAt).toLocaleString('fr-FR')} {ex.reason ? `— ${ex.reason}` : ''}
            </p>
          </div>
          <button onClick={revoke} disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
            Revoquer
          </button>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-600">
            Cette entreprise n'a pas de BYOE configure — les agents sont <strong>bloques</strong>. Accordez une exception pour leur permettre d'utiliser l'infra Orlode pendant un temps limite.
          </p>
          <div className="flex gap-2">
            <input type="number" min={1} max={720} value={hours} onChange={e => setHours(parseInt(e.target.value) || 48)}
              className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
            <span className="text-xs text-gray-500 self-center">heures</span>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison (optionnel)"
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
            <button onClick={grant} disabled={loading || hours <= 0}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50">
              {loading ? <Loader2 size={12} className="animate-spin" /> : 'Accorder'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Permissions Section — SuperAdmin per-company controls ──────────────
function PermissionsSection({ companyId, company, onRefresh }: {
  companyId: string;
  company: CompanyDetail;
  onRefresh: () => void;
}) {
  const c = company as unknown as { byoeAllowed?: boolean; allowedProviders?: string[] };
  const [byoeAllowed, setByoeAllowed] = useState(c.byoeAllowed === true);
  const [providers, setProviders] = useState<Set<string>>(new Set(c.allowedProviders ?? []));
  const [saving, setSaving] = useState<string | null>(null);

  const PROVIDERS = [
    { id: 'claude',     label: 'Claude (Anthropic)', desc: 'Modèles Claude 4.x pour chat + agents' },
    { id: 'gemini',     label: 'Gemini (Google)',    desc: 'Modèles Gemini 2.5 + Gemini Live (voix)' },
    { id: 'openai',     label: 'OpenAI',             desc: 'Embeddings + Whisper (transcription)' },
    { id: 'elevenlabs', label: 'ElevenLabs',         desc: 'Text-to-Speech premium pour Voice Clone' },
  ];

  const saveByoe = async (allowed: boolean) => {
    setSaving('byoe');
    try {
      await api.patch(`/superadmin/companies/${companyId}/byoe-allowed`, { allowed });
      setByoeAllowed(allowed);
      onRefresh();
    } finally { setSaving(null); }
  };

  const toggleProvider = (id: string) => {
    const next = new Set(providers);
    if (next.has(id)) next.delete(id); else next.add(id);
    setProviders(next);
  };

  const saveProviders = async () => {
    setSaving('providers');
    try {
      await api.patch(`/superadmin/companies/${companyId}/allowed-providers`, {
        providers: Array.from(providers),
      });
      onRefresh();
    } finally { setSaving(null); }
  };

  const allowAll = () => setProviders(new Set(['all']));
  const isUnrestricted = providers.size === 0 || providers.has('all');

  return (
    <div className="border-t border-gray-100 pt-4 space-y-5">
      <div className="flex items-center gap-2">
        <Shield size={14} className="text-violet-600" />
        <h2 className="text-sm font-bold text-gray-700">Permissions SuperAdmin</h2>
      </div>

      {/* BYOE authorization */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Autoriser BYOE (Bring Your Own Environment)</p>
            <p className="text-xs text-gray-600 mt-1">
              Permet à cette entreprise d'héberger ses données sur son propre Firebase via <code>/admin/byoe</code>.
              Sans cette autorisation, le setup BYOE échoue même si l'admin complète toutes les étapes.
            </p>
          </div>
          <button
            onClick={() => saveByoe(!byoeAllowed)}
            disabled={saving === 'byoe'}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${byoeAllowed ? 'bg-violet-600' : 'bg-gray-300'} disabled:opacity-50 flex-shrink-0`}
            aria-label="Toggle BYOE">
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${byoeAllowed ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Allowed AI providers */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Providers IA autorisés</p>
            <p className="text-xs text-gray-600 mt-1">
              Restreignez les modèles que cette entreprise peut utiliser. Vide ou "Tout autoriser" = aucune restriction.
            </p>
          </div>
          <button onClick={allowAll}
            className="text-[11px] px-2 py-1 text-violet-700 bg-violet-50 rounded-md border border-violet-200 hover:bg-violet-100 flex-shrink-0">
            Tout autoriser
          </button>
        </div>

        {isUnrestricted && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1.5 mb-3">
            ✓ Aucune restriction — cette entreprise peut utiliser tous les providers.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PROVIDERS.map(p => {
            const checked = providers.has(p.id);
            return (
              <label key={p.id}
                className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${checked ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleProvider(p.id)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900">{p.label}</p>
                  <p className="text-[10px] text-gray-500">{p.desc}</p>
                </div>
              </label>
            );
          })}
        </div>

        <button onClick={saveProviders} disabled={saving === 'providers'}
          className="mt-3 w-full px-3 py-2 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
          {saving === 'providers' && <Loader2 size={12} className="animate-spin" />}
          Enregistrer les providers autorisés
        </button>
      </div>
    </div>
  );
}

function MarketplaceSection({ acting, doAction, companyId, installedAgents, onRefresh }: {
  acting: string;
  doAction: (action: string, plan?: string, extra?: Record<string, unknown>) => Promise<void>;
  companyId: string;
  installedAgents: Agent[];
  onRefresh: () => void;
}) {
  const [allAgents, setAllAgents] = useState<MarketplaceAgent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [granting, setGranting] = useState(false);

  const installedIds = new Set(installedAgents.map(a => a.agentId ?? a.id));

  const loadAgents = async () => {
    setLoadingAgents(true);
    try {
      const res = await api.get('/marketplace/agents');
      const raw = res.data;
      setAllAgents(Array.isArray(raw) ? raw as MarketplaceAgent[] : []);
    } catch {}
    setLoadingAgents(false);
  };

  useEffect(() => { loadAgents(); }, []);

  const filtered = allAgents.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.industry?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allAgents.map(a => a.id)));
  const selectNone = () => setSelected(new Set());

  const grantSelected = async () => {
    if (selected.size === 0) return;
    setGranting(true);
    try {
      await api.post(`/superadmin/companies/${companyId}/action`, {
        action: 'grant_marketplace_agents',
        agentIds: [...selected],
      });
      onRefresh();
      setSelected(new Set());
    } catch {}
    setGranting(false);
  };

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 pt-2">Agents Marketplace</h2>
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-indigo-700 uppercase">Selectionner les agents a offrir</p>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[10px] font-bold text-indigo-600 hover:underline">Tout</button>
            <button onClick={selectNone} className="text-[10px] font-bold text-gray-400 hover:underline">Aucun</button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Rechercher un agent..." />
        </div>

        {/* Agent list */}
        {loadingAgents ? (
          <div className="flex justify-center py-4"><Loader2 className="animate-spin text-indigo-400" size={18} /></div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map(agent => {
              const isInstalled = installedIds.has(agent.id);
              const isSelected = selected.has(agent.id);
              return (
                <button key={agent.id} onClick={() => !isInstalled && toggle(agent.id)}
                  disabled={isInstalled}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    isInstalled ? 'bg-green-50 opacity-60 cursor-default' :
                    isSelected ? 'bg-indigo-100 border border-indigo-300' :
                    'hover:bg-indigo-50'
                  }`}>
                  <span className="text-lg flex-shrink-0">{agent.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{agent.name}</p>
                    <p className="text-[10px] text-gray-500">{agent.industry} · {agent.priceUSD > 0 ? `$${agent.priceUSD}` : 'Gratuit'}</p>
                  </div>
                  {isInstalled && <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Installe</span>}
                  {isSelected && !isInstalled && <Check size={16} className="text-indigo-600 flex-shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-center text-gray-400 text-xs py-4">Aucun agent trouve</p>}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={grantSelected} disabled={granting || selected.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {granting ? 'Installation...' : `Offrir ${selected.size} agent${selected.size > 1 ? 's' : ''}`}
          </button>
          <button onClick={() => doAction('grant_marketplace_agents')} disabled={!!acting}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-50">
            Offrir TOUS
          </button>
          <button onClick={() => doAction('revoke_marketplace_agents')} disabled={!!acting}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Retirer tous
          </button>
        </div>
      </div>
    </>
  );
}
