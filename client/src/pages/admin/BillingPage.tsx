import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CreditCard, Loader, ExternalLink, CheckCircle2, ArrowUpRight,
  Package, Bot, Sparkles, AlertTriangle,
} from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';

interface Subscription {
  type: 'bundle' | 'agent';
  id: string;
  name: string;
  icon?: string;
  priceUSD: number;
  originalPrice?: number;
  period: 'mo' | 'yr';
  agentCount?: number;
  agents?: Array<{ id: string; name: string }>;
  paymentId?: string | null;
  installedAt?: number | null;
  status?: string;
  beta?: boolean;
}

interface SubscriptionsPayload {
  subscriptions: Subscription[];
  totalMonthly: number;
  currency: string;
  count: number;
}

export default function BillingPage() {
  const { formatMoney } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<SubscriptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [paypalStatus, setPaypalStatus] = useState<'idle' | 'capturing' | 'success' | 'failed'>('idle');

  const capturedOrderRef = useRef<string>('');
  useEffect(() => {
    const paypalOrder = searchParams.get('paypal_order');
    if (!paypalOrder || searchParams.get('status') !== 'success') return;
    if (capturedOrderRef.current === paypalOrder) return;
    capturedOrderRef.current = paypalOrder;

    setPaypalStatus('capturing');
    api.post<{ status: string }>('/subscription/paypal/capture', { paymentId: paypalOrder })
      .then(r => {
        const pd = r.data as { status?: string } | undefined;
        setPaypalStatus(pd?.status === 'COMPLETED' ? 'success' : 'failed');
      })
      .catch(() => setPaypalStatus('failed'))
      .finally(() => {
        searchParams.delete('paypal_order'); searchParams.delete('status');
        setSearchParams(searchParams, { replace: true });
      });
  }, [searchParams, setSearchParams]);

  const refresh = () => {
    setLoading(true);
    api.get<SubscriptionsPayload>('/marketplace/my-subscriptions')
      .then(r => setData(r.data as SubscriptionsPayload))
      .catch(() => setData({ subscriptions: [], totalMonthly: 0, currency: 'USD', count: 0 }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, [paypalStatus]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await api.post<{ url: string }>('/billing/portal', { returnUrl: window.location.href });
      const d = res.data as { url: string };
      if (d?.url) window.location.href = d.url;
    } catch {
      alert("Aucun compte de facturation Stripe trouvé. Souscrivez un pack d'abord.");
    } finally { setPortalLoading(false); }
  };

  const subs = data?.subscriptions ?? [];
  const bundles = subs.filter(s => s.type === 'bundle');
  const agents = subs.filter(s => s.type === 'agent');

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={26} className="text-violet-600" />
            Mes abonnements
          </h1>
          <p className="text-sm text-gray-500 mt-1">Tes packs et agents actifs · facturation mensuelle</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openPortal} disabled={portalLoading || subs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {portalLoading ? <Loader size={12} className="animate-spin" /> : <ExternalLink size={12} />}
            Gérer / Annuler / Factures
          </button>
          <Link to="/marketplace"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white rounded-lg font-semibold"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>
            Découvrir d'autres packs <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      {paypalStatus === 'capturing' && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <Loader size={16} className="animate-spin text-blue-600" />
          <p className="text-sm text-blue-800">Finalisation du paiement PayPal…</p>
        </div>
      )}
      {paypalStatus === 'success' && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 size={18} className="text-green-600" />
          <p className="text-sm text-green-800 font-medium">Paiement confirmé. Ton pack est actif.</p>
        </div>
      )}
      {paypalStatus === 'failed' && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={18} className="text-red-600" />
          <p className="text-sm text-red-800">Le paiement PayPal n'a pas pu être capturé. Réessaie ou contacte le support.</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader size={24} className="animate-spin text-gray-400" /></div>
      ) : subs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Package size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Aucun abonnement actif</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
            Découvre nos packs à <strong>$20/mo</strong> (4 agents) ou notre <strong>Super Pack Entreprise à $45/mo</strong> (10 agents).
          </p>
          <Link to="/marketplace"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-semibold"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>
            <Sparkles size={14} /> Voir les packs
          </Link>
        </div>
      ) : (
        <>
          {/* Total */}
          <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #5B21B6, #7C3AED, #EC4899)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider opacity-80">Total mensuel</p>
                <p className="text-3xl font-bold">{formatMoney(data?.totalMonthly ?? 0)}<span className="text-sm font-medium opacity-80"> /mois</span></p>
              </div>
              <p className="text-sm opacity-90">
                {bundles.length} pack{bundles.length > 1 ? 's' : ''} · {agents.length} agent{agents.length > 1 ? 's' : ''} additionnel{agents.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Packs */}
          {bundles.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Mes packs</h2>
              {bundles.map(b => (
                <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 flex-wrap">
                  <div className="text-3xl">{b.icon ?? '📦'}</div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-gray-900">{b.name}</h3>
                      {b.beta && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">⚡ BETA</span>
                      )}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 capitalize">{b.status ?? 'active'}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{b.agentCount} agents inclus</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(b.agents ?? []).slice(0, 6).map(a => (
                        <span key={a.id} className="text-[11px] px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100">{a.name}</span>
                      ))}
                      {(b.agents ?? []).length > 6 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-50 text-gray-500">+{(b.agents ?? []).length - 6}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {b.originalPrice && b.originalPrice > b.priceUSD && (
                      <span className="text-xs text-gray-400 line-through block">{formatMoney(b.originalPrice)}</span>
                    )}
                    <span className="text-2xl font-bold text-gray-900">{formatMoney(b.priceUSD)}</span>
                    <span className="text-xs text-gray-500">/mo</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Agents */}
          {agents.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Agents additionnels</h2>
              {agents.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Bot size={18} className="text-violet-600" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{a.name}</p>
                      <p className="text-xs text-gray-500">Add-on individuel</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{formatMoney(a.priceUSD)}<span className="text-xs text-gray-500 font-medium">/mo</span></span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-violet-50 rounded-xl p-4 text-sm text-violet-900 flex items-start gap-3">
            <CreditCard size={18} className="text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Comment annuler ?</p>
              <p className="text-xs leading-relaxed">
                Clique sur <strong>"Gérer / Annuler / Factures"</strong> en haut. Tu seras redirigé vers le portail Stripe sécurisé pour annuler à tout moment, télécharger tes factures, ou changer de mode de paiement.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
