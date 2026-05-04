/**
 * PlansPage — re-aligned with the $20/pack pricing model (mai 2026).
 *
 * The old Starter / Pro / Premium ladder is gone. The new model:
 *   - Free                : 1 agent (Knowledge), 10 documents — to evaluate
 *   - Pack métier ($20/mo): 7 agents per vertical (Sales, Restaurant, RH, etc.)
 *   - Super Pack ($45/mo) : 11 agents flagship
 *
 * Subscriptions are managed in BillingPage. This page is now a directional hub
 * that points to /marketplace where packs are picked.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  CheckCircle2, Loader2, AlertTriangle, Package, Sparkles, Crown, ArrowUpRight, ExternalLink,
} from 'lucide-react';
import api from '@/services/api';

interface ActivePack {
  id: string;
  name: string;
  icon?: string;
  priceUSD: number;
  agentCount?: number;
  status?: string;
  beta?: boolean;
}

const HERO_PACKS = [
  { id: 'b15', icon: '🚀', name: 'Pack PME',          tagline: 'Le pack croissance — 4 agents qui couvrent toute la chaîne de vente' },
  { id: 'b10', icon: '🏢', name: 'Pack Entreprise',   tagline: 'Ventes, factures, support, comms — la stack opérationnelle' },
  { id: 'b7',  icon: '🍽️', name: 'Pack Restaurant',   tagline: 'Réservations, livraison, fidélité, accueil — tout le restaurant' },
  { id: 'b2',  icon: '🏠', name: 'Pack Immobilier',   tagline: 'Qualification leads, visites 360°, prise de RDV automatisée' },
];

export default function PlansPage() {
  const { company } = useAuthStore();
  const currentPlan = (company?.plan ?? 'free') as string;
  const [activePacks, setActivePacks] = useState<ActivePack[]>([]);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downgrading, setDowngrading] = useState(false);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const [flash, setFlash] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const isOnLegacyPaid = ['starter', 'pro', 'premium'].includes(currentPlan);

  useEffect(() => {
    api.get<{ subscriptions: ActivePack[]; totalMonthly: number }>('/marketplace/my-subscriptions')
      .then(r => {
        const data = r.data as { subscriptions?: ActivePack[]; totalMonthly?: number } | undefined;
        setActivePacks(data?.subscriptions?.filter(s => (s as any).type === 'bundle') ?? data?.subscriptions ?? []);
        setTotalMonthly(data?.totalMonthly ?? 0);
      })
      .catch(() => { setActivePacks([]); setTotalMonthly(0); })
      .finally(() => setLoading(false));
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const r = await api.post<{ url: string }>('/billing/portal', { returnUrl: window.location.href });
      const data = r.data as { url?: string } | undefined;
      if (data?.url) window.location.href = data.url;
    } catch {
      setFlash({ tone: 'err', text: 'Aucune facturation Stripe trouvée. Souscris d\'abord un pack.' });
    } finally { setPortalLoading(false); }
  };

  const handleDowngradeToFree = async () => {
    setDowngrading(true);
    try {
      const r = await api.post<{ endsAt: string | null; immediate: boolean }>('/billing/cancel', { immediate: false });
      const data = r.data as { endsAt?: string | null; immediate?: boolean } | undefined;
      const endsAt = data?.endsAt ? new Date(data.endsAt).toLocaleDateString('fr-FR') : null;
      setFlash({
        tone: 'ok',
        text: data?.immediate
          ? 'Plan changé en Free.'
          : endsAt
            ? `Abonnement annulé — accès maintenu jusqu'au ${endsAt}.`
            : 'Annulation programmée.',
      });
      setConfirmDowngrade(false);
    } catch {
      setFlash({ tone: 'err', text: 'Erreur lors de l\'annulation.' });
    } finally { setDowngrading(false); }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mon plan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Modèle <strong>$20/pack métier</strong> — chaque pack inclut 7 agents IA spécialisés.
        </p>
      </div>

      {flash && (
        <div className={`p-3 rounded-xl text-sm ${flash.tone === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {flash.text}
        </div>
      )}

      {/* Legacy plan banner — only shown if user is still on starter/pro/premium */}
      {isOnLegacyPaid && (
        <div className="rounded-2xl p-4 border border-amber-200 bg-amber-50 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900 text-sm">Tu es sur l'ancien plan <strong className="capitalize">{currentPlan}</strong></p>
            <p className="text-xs text-amber-800 mt-0.5">
              On a simplifié la facturation : un pack métier à $20/mo = 7 agents. Tu peux passer au nouveau modèle quand tu veux — tes données restent intactes.
            </p>
          </div>
          <button onClick={openPortal} disabled={portalLoading}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 px-3 py-1.5 rounded-lg border border-amber-300 hover:bg-amber-100 disabled:opacity-50 flex items-center gap-1 shrink-0">
            {portalLoading && <Loader2 size={11} className="animate-spin" />}
            <ExternalLink size={11} /> Gérer dans Stripe
          </button>
        </div>
      )}

      {/* Active packs summary (cross-link to BillingPage) */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 flex justify-center">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : activePacks.length > 0 ? (
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #5B21B6, #7C3AED, #EC4899)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-80">Total mensuel</p>
              <p className="text-3xl font-bold">${totalMonthly}<span className="text-sm font-medium opacity-80"> /mois</span></p>
            </div>
            <Link to="/admin/billing"
              className="text-sm font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg flex items-center gap-1">
              Détails facturation <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {activePacks.map(p => (
              <span key={p.id} className="bg-white/15 backdrop-blur px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5">
                <span>{p.icon ?? '📦'}</span>
                <span className="font-medium">{p.name}</span>
                <span className="opacity-70">· ${p.priceUSD}/mo</span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <Package size={40} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Aucun pack actif</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            Tu es sur le <strong>plan Free</strong>. Active un pack métier pour débloquer 7 agents IA — <strong>30 jours gratuits sans CB</strong>.
          </p>
          <Link to="/marketplace"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-semibold"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>
            <Sparkles size={14} /> Voir tous les packs
          </Link>
        </div>
      )}

      {/* Pricing model card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <Package size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Pack métier</h2>
              <p className="text-2xl font-bold text-violet-700">$20<span className="text-sm font-medium text-gray-500">/mo</span></p>
            </div>
          </div>
          <ul className="space-y-2 mb-4">
            {[
              '4 agents spécialisés métier',
              '+ 3 agents core (Knowledge, Workflow, Wildcard)',
              'Orchestrateur IA inclus',
              'BYOE : ta clé OpenAI/Claude/Gemini',
              '🎁 30 jours gratuits sans CB',
            ].map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" /> {f}
              </li>
            ))}
          </ul>
          <Link to="/marketplace"
            className="block text-center w-full py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>
            Choisir un pack
          </Link>
        </div>

        <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-sm p-6 relative">
          <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider">Top Value</div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Crown size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Super Pack Entreprise</h2>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm text-gray-400 line-through">$60</span>
                <span className="text-2xl font-bold text-amber-700">$45<span className="text-sm font-medium text-gray-500">/mo</span></span>
              </div>
            </div>
          </div>
          <ul className="space-y-2 mb-4">
            {[
              '8 agents spécialisés flagship',
              '+ 3 agents core inclus',
              'Sales · Marketing · Comms · Support',
              'Compta · RH · Réception · Cybersécurité',
              'Économise 25% vs 3 packs séparés',
            ].map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 size={14} className="text-amber-500 mt-0.5 shrink-0" /> {f}
              </li>
            ))}
          </ul>
          <Link to="/marketplace"
            className="block text-center w-full py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)' }}>
            Activer le Super Pack
          </Link>
        </div>
      </div>

      {/* Hero packs preview */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Packs populaires</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {HERO_PACKS.map(p => (
            <Link key={p.id} to="/marketplace"
              className="bg-white rounded-xl border border-gray-100 hover:border-violet-300 hover:shadow-md transition p-4 flex flex-col gap-2">
              <div className="text-2xl">{p.icon}</div>
              <div className="font-semibold text-gray-900 text-sm">{p.name}</div>
              <p className="text-xs text-gray-500 leading-snug flex-1">{p.tagline}</p>
              <div className="text-xs font-bold text-violet-700">$20/mo · 7 agents</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Free + downgrade option (only visible if currently paid) */}
      {(currentPlan !== 'free' || activePacks.length > 0) && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Plan Free</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-md">
                1 agent Knowledge · 10 documents · pour évaluer la plateforme. Aucun engagement.
              </p>
            </div>
            {currentPlan !== 'free' ? (
              <button onClick={() => setConfirmDowngrade(true)} disabled={downgrading}
                className="text-xs font-semibold text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-white disabled:opacity-50">
                Repasser en Free
              </button>
            ) : (
              <span className="text-xs font-semibold text-gray-400 px-3 py-1.5">Plan actuel</span>
            )}
          </div>
        </div>
      )}

      {/* Downgrade confirmation modal */}
      {confirmDowngrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDowngrade(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Repasser en Free ?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Tes packs s'arrêteront à la fin de la période en cours. Tu gardes l'accès jusque-là, puis tu reviens au plan Free (1 agent Knowledge).
                </p>
              </div>
            </div>
            <ul className="text-xs text-gray-500 space-y-1 mb-5 pl-1">
              <li>• Aucun remboursement, tu profites de ce que tu as payé</li>
              <li>• Tes données restent intactes (documents, configs agents)</li>
              <li>• Tu peux ré-activer un pack à tout moment</li>
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDowngrade(false)} disabled={downgrading}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleDowngradeToFree} disabled={downgrading}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {downgrading && <Loader2 size={14} className="animate-spin" />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
