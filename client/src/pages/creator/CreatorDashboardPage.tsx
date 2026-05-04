/**
 * CreatorDashboardPage — Creator portal home
 * Overview of created agents, earnings, installs
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Plus, DollarSign, Download, Star, TrendingUp,
  Edit3, Eye, Trash2, Send, BarChart3, Sparkles,
} from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuthStore } from '@/store/authStore';

interface CreatorAgent {
  id: string; name: string; icon: string; description: string;
  status: string; pricingModel: string; priceUSD: number;
  installCount: number; avgRating: number; ratingCount: number;
  createdAt: string;
}

interface Earnings {
  totalRevenue: number; creatorEarnings: number; commission: number;
  agents: { agentId: string; name: string; installs: number; revenue: number; avgRating: number }[];
}

interface Profile {
  displayName: string; email: string; verified: boolean;
  totalAgents: number; totalInstalls: number; totalRevenue: number;
}

export default function CreatorDashboardPage() {
  const { t } = useLangStore();
  const { formatShort } = useCurrency();
  const { company, user } = useAuthStore();

  // Gate: must be marked isCreator AND on a paid plan (creator/pro/premium)
  // SuperAdmin bypasses everything.
  const isSuperAdmin = (user as unknown as { superAdmin?: boolean } | null)?.superAdmin === true;
  const isCreator = (company as Record<string, unknown> | null)?.['isCreator'] === true;
  const plan = ((company as Record<string, unknown> | null)?.['plan'] as string ?? 'free').toLowerCase();
  const paidCreatorPlans = ['creator', 'pro', 'premium', 'business', 'enterprise'];
  const hasAccess = isSuperAdmin || (isCreator && paidCreatorPlans.includes(plan));

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div className="max-w-md">
          <p className="text-5xl mb-4">🚀</p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Devenir Creator</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Créez et vendez vos propres agents IA sur le marketplace Orlode.
          </p>
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 mb-6 text-left text-sm text-pink-900 dark:text-pink-100">
            <p className="font-semibold mb-2">✨ Avec le plan Creator ($9.99/mois)</p>
            <ul className="space-y-1 text-xs">
              <li>• Publiez vos agents sur le marketplace</li>
              <li>• Gardez <strong>100% des ventes</strong> (0% commission)</li>
              <li>• Agents illimités</li>
              <li>• Tableau de bord revenus + stats</li>
            </ul>
          </div>
          {!paidCreatorPlans.includes(plan) && (
            <Link to="/admin/subscription" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl mb-2"
              style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)' }}>
              <Sparkles size={16} /> Activer Creator — $9.99/mois
            </Link>
          )}
          {!isCreator && paidCreatorPlans.includes(plan) && (
            <Link to="/creator/register" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl"
              style={{ background: 'linear-gradient(135deg, #6c3ce0, #a855f7)' }}>
              <Sparkles size={16} /> Compléter mon profil Creator
            </Link>
          )}
        </div>
      </div>
    );
  }

  const [profile, setProfile] = useState<Profile | null>(null);
  const [agents, setAgents] = useState<CreatorAgent[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [profileRes, agentsRes, earningsRes] = await Promise.all([
        api.get('/creator/profile'),
        api.get('/creator/agents'),
        api.get('/creator/earnings'),
      ]);
      setProfile(profileRes.data as Profile);
      setAgents(Array.isArray(agentsRes.data) ? agentsRes.data : []);
      setEarnings(earningsRes.data as Earnings);
    } catch {}
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet agent ?')) return;
    setDeleting(id);
    try {
      await api.delete(`/creator/agents/${id}`);
      setAgents(prev => prev.filter(a => a.id !== id));
    } catch {}
    setDeleting(null);
  };

  const handleSubmit = async (id: string) => {
    try {
      await api.post(`/creator/agents/${id}/submit`);
      setAgents(prev => prev.map(a => a.id === id ? { ...a, status: 'pending_review' } : a));
    } catch {}
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  const STATUS_COLORS: Record<string, string> = {
    approved: 'bg-green-100 text-green-700',
    pending_review: 'bg-yellow-100 text-yellow-700',
    rejected: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-600',
  };

  const STATUS_LABELS: Record<string, string> = {
    approved: 'Approuve', pending_review: 'En revision',
    rejected: 'Rejete', draft: 'Brouillon',
  };

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={22} className="text-violet-500" /> Portail Createur
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Creez, publiez et monetisez vos agents IA
          </p>
        </div>
        <Link to="/creator/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl"
          style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          <Plus size={16} /> Creer un agent
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Edit3 size={18} />} label="Mes agents" value={agents.length} color="text-blue-500" />
        <StatCard icon={<Download size={18} />} label="Installations" value={agents.reduce((s, a) => s + (a.installCount ?? 0), 0)} color="text-green-500" />
        <StatCard icon={<DollarSign size={18} />} label="Revenus" value={formatShort(earnings?.creatorEarnings ?? 0)} color="text-violet-500" />
        <StatCard icon={<Star size={18} />} label="Note moy."
          value={agents.length > 0 ? (agents.reduce((s, a) => s + (a.avgRating ?? 0), 0) / agents.length).toFixed(1) : '—'}
          color="text-amber-500" />
      </div>

      {/* Earnings banner */}
      {earnings && earnings.totalRevenue > 0 && (
        <div className="bg-gradient-to-r from-violet-500 to-blue-500 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Revenus totaux</p>
              <p className="text-3xl font-bold">{formatShort(earnings.totalRevenue)}</p>
              <p className="text-sm mt-1 opacity-80">
                Votre part ({Math.round(earnings.commission * 100)}%) : {formatShort(earnings.creatorEarnings)}
              </p>
            </div>
            <TrendingUp size={48} className="opacity-30" />
          </div>
        </div>
      )}

      {/* Agents list */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3">Mes agents ({agents.length})</h2>
        {agents.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl">
            <p className="text-gray-500 mb-4">Vous n'avez pas encore cree d'agent</p>
            <Link to="/creator/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl bg-violet-600 hover:bg-violet-700">
              <Plus size={16} /> Creer mon premier agent
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{agent.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 truncate">{agent.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_COLORS[agent.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[agent.status] ?? agent.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">{agent.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{agent.installCount ?? 0} installs</span>
                      {agent.avgRating > 0 && <span>⭐ {agent.avgRating}</span>}
                      <span>{agent.pricingModel === 'free' ? 'Gratuit' : `${formatShort(agent.priceUSD)}/mo`}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Link to={`/creator/edit/${agent.id}`}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit3 size={14} />
                    </Link>
                    {agent.status === 'draft' && (
                      <button onClick={() => handleSubmit(agent.id)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                        title="Soumettre pour revision">
                        <Send size={14} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(agent.id)} disabled={deleting === agent.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      {deleting === agent.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`${color} mb-2`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
