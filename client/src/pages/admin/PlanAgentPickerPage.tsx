/**
 * PlanAgentPickerPage — Select plan, pick agents, pay with Stripe or Wave
 */
import { useEffect, useState } from 'react';
import {
  Check, Loader2, Zap, Crown, Building2, ChevronRight, Info, X,
  CreditCard, Smartphone, Wallet, Phone, MessageCircle, Mail, Copy,
} from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useAuthStore } from '@/store/authStore';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from '@/components/common/Toast';

interface AgentSkill { id: string; name: string; description: string }
interface AgentDef {
  id: string; name: string; description: string; icon: string;
  category: string; skills: AgentSkill[]; minPlan: string;
}
interface PlanLimits { maxAgents: number; maxSkills: number; price: number }
interface Plans { free: PlanLimits; creator: PlanLimits; starter: PlanLimits; pro: PlanLimits; premium: PlanLimits }

const PLAN_NAMES: Record<string, { label: string; subtitle: string; icon: typeof Zap; color: string; bg: string; gradient: string }> = {
  free:    { label: 'Free',    subtitle: '1 agent',              icon: Zap,       color: 'text-gray-700',  bg: 'bg-gray-50',    gradient: 'from-gray-400 to-gray-500' },
  creator: { label: 'Creator', subtitle: 'Pour développeurs',    icon: Zap,       color: 'text-pink-700',  bg: 'bg-pink-50',    gradient: 'from-pink-500 to-rose-500' },
  starter: { label: 'Starter', subtitle: '4 agents',             icon: Zap,       color: 'text-blue-700',  bg: 'bg-blue-50',    gradient: 'from-blue-500 to-cyan-500' },
  pro:     { label: 'Pro',     subtitle: '8 agents',             icon: Crown,     color: 'text-violet-700', bg: 'bg-violet-50', gradient: 'from-violet-500 to-purple-600' },
  premium: { label: 'Premium', subtitle: '12 agents',            icon: Building2, color: 'text-amber-700', bg: 'bg-amber-50',   gradient: 'from-amber-500 to-orange-500' },
};

/** Resolve old plan names to new */
const resolvePlan = (p: string) => ({ business: 'pro', enterprise: 'premium' }[p] ?? p);

export default function PlanAgentPickerPage() {
  const { t } = useLangStore();
  const { company } = useAuthStore();
  const { formatMoney, formatShort } = useCurrency();

  const [allAgents, setAllAgents] = useState<AgentDef[]>([]);
  const [plans, setPlans] = useState<Plans | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>(resolvePlan(company?.plan ?? 'starter'));
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [currentAgents, setCurrentAgents] = useState<string[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    method: string; checkoutUrl?: string; instructions?: string; amountXOF?: number;
    amountUSD?: number; reference?: string;
    contact?: { phone: string; whatsapp: string; email: string; whatsappLink: string; emailLink: string };
  } | null>(null);
  const [manualMethod, setManualMethod] = useState<string>('orange_money');

  useEffect(() => {
    console.log('[Subscription] Loading catalog...');
    api.get('/subscription/catalog').then(r => {
      console.log('[Subscription] Raw response:', JSON.stringify(r.data).slice(0, 200));
      // r.data is the Axios response, which wraps { success, data }
      const wrapper = r.data;
      const d = wrapper?.data ?? wrapper;
      const agents = d?.agents ?? [];
      const plans = d?.plans ?? null;
      console.log('[Subscription] Parsed agents:', agents.length, 'plans:', plans ? Object.keys(plans) : 'null');
      setAllAgents(agents as AgentDef[]);
      setPlans(plans as Plans);
    }).catch(err => {
      console.error('[Subscription] Catalog error:', err?.response?.status, err?.response?.data, err?.message);
    });

    api.get('/subscription/my-agents').then(r => {
      console.log('[Subscription] My agents response:', r.data);
      const d = r.data;
      setCurrentAgents((d?.selectedAgents ?? []) as string[]);
      setSelectedAgents(new Set((d?.selectedAgents ?? []) as string[]));
      if (d?.plan) { const p = resolvePlan(d.plan as string); setSelectedPlan(p); setCurrentPlan(p); }
    }).catch(err => {
      console.error('[Subscription] My agents error:', err?.response?.status, err?.message);
    }).finally(() => setLoading(false));
  }, []);

  const limits = plans?.[resolvePlan(selectedPlan) as keyof Plans];
  // All agents visible to all plans — limit is how many you can SELECT
  const available = allAgents;
  const totalSkills = allAgents.filter(a => selectedAgents.has(a.id)).reduce((s, a) => s + a.skills.length, 0);

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < (limits?.maxAgents ?? 1)) next.add(id);
      return next;
    });
  };

  const handleSaveAgents = async () => {
    setSaving(true);
    try {
      await api.post('/subscription/select-agents', { agentIds: Array.from(selectedAgents) });
      setCurrentAgents(Array.from(selectedAgents));
      const count = selectedAgents.size;
      toast.success(
        count > 1 ? `${count} agents activés` : 'Agent activé',
        'Tu peux maintenant leur parler depuis le menu "Mes agents".'
      );
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Réessaye dans un instant.';
      toast.error('Activation échouée', msg);
    } finally { setSaving(false); }
  };

  // Axios interceptor already unwraps { success, data } once. Support both shapes defensively.
  const unwrap = <T,>(v: unknown): T => {
    if (v && typeof v === 'object' && 'data' in (v as Record<string, unknown>)) {
      return (v as { data: T }).data;
    }
    return v as T;
  };

  const handleWavePayment = async () => {
    setSaving(true);
    try {
      const r = await api.post('/subscription/wave/checkout', {
        planId: selectedPlan, interval: billing, agentIds: Array.from(selectedAgents),
      });
      const data = unwrap<{ checkoutUrl?: string; instructions?: string; amountXOF?: number }>(r.data);
      setPaymentResult(data as never);
      if (data?.checkoutUrl) window.open(data.checkoutUrl, '_blank');
    } catch {} finally { setSaving(false); }
  };

  const handleStripePayment = async () => {
    setSaving(true);
    try {
      const r = await api.post('/billing/checkout', {
        planId: selectedPlan,
        successUrl: `${window.location.origin}/admin/billing?status=success`,
        cancelUrl: `${window.location.origin}/admin/billing?status=cancel`,
        interval: billing,
      });
      const data = unwrap<{ url?: string }>(r.data);
      if (data?.url) window.location.href = data.url;
      else alert('Paiement carte indisponible pour l\'instant (Stripe non configuré).');
    } catch {
      alert('Paiement carte indisponible pour l\'instant.');
    } finally { setSaving(false); }
  };

  const handlePayPalPayment = async () => {
    setSaving(true);
    try {
      const r = await api.post('/subscription/paypal/checkout', {
        planId: selectedPlan, interval: billing, agentIds: Array.from(selectedAgents),
      });
      const data = unwrap<{ checkoutUrl?: string; paymentId?: string }>(r.data);
      setPaymentResult(data as never);
      if (data?.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch {} finally { setSaving(false); }
  };

  const handleManualPayment = async () => {
    setSaving(true);
    try {
      const r = await api.post('/subscription/manual/checkout', {
        planId: selectedPlan, interval: billing, agentIds: Array.from(selectedAgents),
        paymentMethod: manualMethod,
      });
      const wrapper = r.data as { data?: unknown } | unknown;
      const data = ((wrapper as { data?: unknown })?.data ?? wrapper) as {
        method: string; amountUSD: number; amountXOF: number; reference: string;
        instructions: string;
        contact: { phone: string; whatsapp: string; email: string; whatsappLink: string; emailLink: string };
      };
      setPaymentResult(data);
    } catch {} finally { setSaving(false); }
  };

  const copyReference = () => {
    if (paymentResult?.reference) {
      navigator.clipboard.writeText(paymentResult.reference).catch(() => {});
    }
  };

  const price = limits?.price ?? 0;
  const yearlyPrice = Math.round(price * 12 * 0.8 * 100) / 100;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abonnement & Agents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Choisissez votre plan, selectionnez vos agents</p>
      </div>

      {/* Step 1: Plan Selection */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3">1. Choisissez votre plan</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {plans && Object.entries(plans)
            // Hide the Creator plan tier from the picker — it lives in the Creator portal,
            // not here. Existing creator subscribers are preserved server-side.
            .filter(([planId]) => planId !== 'creator')
            .map(([planId, lim]) => {
            const info = PLAN_NAMES[planId] ?? PLAN_NAMES['free'];
            const Icon = info.icon;
            const isSelected = selectedPlan === planId;
            const isCurrent = currentPlan === planId;
            const planOrder = ['free', 'starter', 'pro', 'premium'];
            const isUpgrade = planOrder.indexOf(planId) > planOrder.indexOf(currentPlan);
            const isDowngrade = planOrder.indexOf(planId) < planOrder.indexOf(currentPlan);
            return (
              <button key={planId} onClick={() => { setSelectedPlan(planId); setSelectedAgents(new Set()); }}
                className={`rounded-2xl p-4 text-left transition-all border-2 ${isSelected ? 'border-blue-500 shadow-lg' : isCurrent ? 'border-green-400' : 'border-gray-100 hover:border-gray-200'}`}>
                {isCurrent && <div className="text-xs font-bold text-green-600 mb-2">Plan actuel</div>}
                <div className={`w-9 h-9 rounded-xl ${info.bg} flex items-center justify-center mb-3 ${info.color}`}>
                  <Icon size={18} />
                </div>
                <p className="text-base font-bold text-gray-900">{info.label}</p>
                <p className="text-xs text-gray-500">{info.subtitle}</p>
                <p className="text-2xl font-extrabold text-gray-900 mt-1">{lim.price === 0 ? 'Gratuit' : <>{formatShort(lim.price)}<span className="text-sm font-normal text-gray-500">/mo</span></>}</p>
                {planId === 'creator' ? (
                  <p className="text-xs text-pink-700 mt-1 font-medium">Publiez vos agents · Gardez 100% des ventes</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Choisissez {lim.maxAgents} agents</p>
                )}
                {isSelected && isCurrent && <div className="mt-2 flex items-center gap-1 text-xs text-green-600 font-medium"><Check size={12} /> Actuel</div>}
                {isSelected && isUpgrade && <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 font-medium"><ChevronRight size={12} /> Upgrade</div>}
                {isSelected && isDowngrade && <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 font-medium"><ChevronRight size={12} /> Downgrade</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setBilling('monthly')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${billing === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Mensuel</button>
          <button onClick={() => setBilling('yearly')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${billing === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Annuel (-20%)</button>
        </div>
        <p className="text-sm font-bold text-gray-900">
          {billing === 'monthly' ? `${formatShort(price)}/mois` : `${formatShort(yearlyPrice)}/an`}
        </p>
      </div>

      {/* Step 2: Agent Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">2. Selectionnez vos agents ({selectedAgents.size}/{limits?.maxAgents ?? 0})</h2>
          <p className="text-xs text-gray-500">{totalSkills} skills / {limits?.maxSkills ?? 0} max</p>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full mb-4">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${limits ? (selectedAgents.size / limits.maxAgents) * 100 : 0}%` }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {available.map(agent => {
            const isSelected = selectedAgents.has(agent.id);
            const canSelect = isSelected || selectedAgents.size < (limits?.maxAgents ?? 0);
            const COLORS: Record<string, string> = {
              orchestrator: '#3B82F6', qa: '#0EA5E9', documents: '#10B981', reception: '#14B8A6',
              hr: '#6366F1', accounting: '#16A34A', sales: '#F97316', support: '#06B6D4',
              it: '#64748B', meeting: '#E11D48', vision: '#D946EF', insights: '#F59E0B',
              comms: '#EC4899', marketing: '#8B5CF6', cybersecurity: '#EF4444', legal: '#78716C',
              training: '#0284C7', news: '#EAB308', coach: '#84CC16', datascientist: '#0891B2',
              wildcard: '#A855F7',
            };
            const bgColor = COLORS[agent.id] ?? '#3B82F6';
            return (
              <button key={agent.id} onClick={() => canSelect && toggleAgent(agent.id)}
                disabled={!canSelect && !isSelected}
                className={`group rounded-2xl text-left overflow-hidden transition-all duration-200 ${
                  isSelected ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 hover:-translate-y-1' :
                  canSelect ? 'hover:shadow-xl hover:-translate-y-1' :
                  'opacity-40 cursor-not-allowed'
                } bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700`}>
                <div className="p-4 flex items-center gap-3" style={{ background: bgColor, opacity: isSelected ? 1 : 0.85 }}>
                  <span className="text-3xl">{agent.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{agent.name}</p>
                    <p className="text-[10px] text-white/70">{agent.skills.length} skills</p>
                  </div>
                  {isSelected && (
                    <div className="relative z-10 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm">
                      <Check size={14} className="text-blue-600" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{agent.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.skills.slice(0, 3).map(s => (
                      <span key={s.id} className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">{s.name}</span>
                    ))}
                    {agent.skills.length > 3 && <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-full">+{agent.skills.length - 3}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 3: Payment — hidden for Free plan (no payment needed) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-4">3. {selectedPlan === 'free' ? 'Activation' : 'Paiement'}</h2>

        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-xl">
          <div>
            <p className="text-sm font-bold text-gray-900">{PLAN_NAMES[selectedPlan]?.label} — {selectedAgents.size} agents</p>
            <p className="text-xs text-gray-500">{totalSkills} skills · {billing === 'monthly' ? 'Mensuel' : 'Annuel'}</p>
          </div>
          <p className="text-xl font-extrabold text-gray-900">
            {selectedPlan === 'free' ? 'Gratuit' : formatMoney(billing === 'monthly' ? price : yearlyPrice)}
          </p>
        </div>

        {selectedPlan === 'free' && (
          <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
            Sélectionnez votre agent ci-dessus puis cliquez <strong>Activer mon agent gratuit</strong>.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ display: selectedPlan === 'free' ? 'none' : undefined }}>
          {/* Stripe */}
          <button onClick={handleStripePayment} disabled={saving || selectedAgents.size === 0}
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 transition-all disabled:opacity-50">
            <CreditCard size={24} className="text-blue-600" />
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">Carte bancaire</p>
              <p className="text-xs text-gray-500">Visa, Mastercard, Amex</p>
            </div>
          </button>

          {/* PayPal */}
          <button onClick={handlePayPalPayment} disabled={saving || selectedAgents.size === 0}
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-[#0070BA] transition-all disabled:opacity-50">
            <Wallet size={24} className="text-[#0070BA]" />
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">PayPal</p>
              <p className="text-xs text-gray-500">Compte PayPal ou carte</p>
            </div>
          </button>

          {/* Wave */}
          <button onClick={handleWavePayment} disabled={saving || selectedAgents.size === 0}
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-green-400 transition-all disabled:opacity-50">
            <Smartphone size={24} className="text-green-600" />
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">Wave Mobile Money</p>
              <p className="text-xs text-gray-500">Paiement mobile (FCFA)</p>
            </div>
          </button>

          {/* Local / Manual */}
          <button onClick={handleManualPayment} disabled={saving || selectedAgents.size === 0}
            className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-400 transition-all disabled:opacity-50">
            <Phone size={24} className="text-orange-600" />
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">Paiement local / Cash</p>
              <p className="text-xs text-gray-500">Orange Money, MTN, Zelle, especes — on vous contacte</p>
            </div>
          </button>
        </div>

        {/* Method picker for manual payment — hidden for free plan */}
        <div className="mt-3" style={{ display: selectedPlan === 'free' ? 'none' : undefined }}>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Methode de paiement locale (optionnel)</label>
          <select value={manualMethod} onChange={e => setManualMethod(e.target.value)}
            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="orange_money">Orange Money</option>
            <option value="mtn">MTN Mobile Money</option>
            <option value="wave_manual">Wave (paiement direct)</option>
            <option value="zelle">Zelle</option>
            <option value="cash">Especes / Cash</option>
            <option value="bank_transfer">Virement bancaire</option>
            <option value="other">Autre</option>
          </select>
        </div>

        {/* Save agents — available for free plan (no payment needed) or when already subscribed */}
        {(selectedPlan === 'free' || currentAgents.length > 0) && (
          <button onClick={handleSaveAgents} disabled={saving || selectedAgents.size === 0}
            className="w-full mt-3 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
            {saving ? <Loader2 className="animate-spin mx-auto" size={14} /> : selectedPlan === 'free' ? `Activer mon agent gratuit (${selectedAgents.size}/${limits?.maxAgents ?? 1})` : 'Sauvegarder mes agents (sans paiement)'}
          </button>
        )}
      </div>

      {/* Manual payment result — contact panel */}
      {paymentResult?.method === 'manual' && paymentResult.contact && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
              <Phone size={18} className="text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-orange-900">Votre demande est enregistree</h3>
              <p className="text-sm text-orange-800 mt-1">
                Contactez-nous par un des moyens ci-dessous pour finaliser le paiement de <strong>{paymentResult.amountUSD}$</strong>
                {paymentResult.amountXOF ? ` (~${paymentResult.amountXOF.toLocaleString()} FCFA)` : ''}.
              </p>
            </div>
          </div>

          {/* Reference */}
          <div className="flex items-center gap-2 p-3 bg-white border border-orange-200 rounded-xl mb-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500">Reference de paiement</p>
              <p className="font-mono text-sm font-bold text-gray-900">{paymentResult.reference}</p>
            </div>
            <button onClick={copyReference} className="p-2 hover:bg-orange-50 rounded-lg text-orange-700" title="Copier">
              <Copy size={16} />
            </button>
          </div>

          {/* Contact methods */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <a href={paymentResult.contact.whatsappLink} target="_blank" rel="noopener"
              className="flex items-center justify-center gap-2 p-3 bg-[#25D366] hover:bg-[#1faa56] text-white rounded-xl font-semibold text-sm transition-all">
              <MessageCircle size={16} /> WhatsApp
            </a>
            <a href={paymentResult.contact.emailLink}
              className="flex items-center justify-center gap-2 p-3 bg-white border-2 border-orange-300 hover:border-orange-500 text-orange-800 rounded-xl font-semibold text-sm transition-all">
              <Mail size={16} /> Email
            </a>
            <a href={`tel:${paymentResult.contact.phone.replace(/\s+/g, '')}`}
              className="flex items-center justify-center gap-2 p-3 bg-white border-2 border-orange-300 hover:border-orange-500 text-orange-800 rounded-xl font-semibold text-sm transition-all">
              <Phone size={16} /> Appeler
            </a>
          </div>

          <p className="text-xs text-orange-700 mt-3 text-center">
            Apres reception du paiement, nous activerons votre plan manuellement (&lt;24h ouvrees).
          </p>
        </div>
      )}

      {/* Wave payment result */}
      {paymentResult && paymentResult.method !== 'manual' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-green-800 mb-2">Paiement Wave</h3>
          {paymentResult.checkoutUrl ? (
            <p className="text-sm text-green-700">Redirection vers Wave... Si la page ne s'ouvre pas, <a href={paymentResult.checkoutUrl} target="_blank" className="underline font-medium">cliquez ici</a>.</p>
          ) : (
            <div>
              <p className="text-sm text-green-700 mb-2">{paymentResult.instructions}</p>
              <p className="text-lg font-bold text-green-800">{paymentResult.amountXOF?.toLocaleString()} FCFA</p>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 space-y-1">
          <p><strong>Comment ca marche :</strong></p>
          <p>1. Choisissez un plan selon vos besoins</p>
          <p>2. Selectionnez les agents que vous voulez activer</p>
          <p>3. Payez par carte, PayPal, Wave, ou paiement local (on vous contacte)</p>
          <p>4. Vos agents sont actives automatiquement apres paiement</p>
        </div>
      </div>
    </div>
  );
}
