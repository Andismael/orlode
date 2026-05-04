/**
 * Onboarding Wizard — shown on first login for new companies.
 *
 * 6 steps: Welcome → Language → Industry → Pack métier (trial 30j) → Agents inclus → Done
 *
 * Pricing model is $20 / pack métier (April 2026 pivot — replaces the old Starter/Pro/Premium tiers).
 * The wizard offers 4 hero packs + "Skip" (= Free plan, 1 agent Knowledge).
 * If a pack is picked, we trigger the 30-day free trial via /marketplace/bundles/:id/start-trial.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Globe, Users, FileText, CheckCircle, ArrowRight,
  ArrowLeft, Loader2, Crown, Bot, ShoppingBag, Briefcase, Sparkles, Gift,
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface OnboardingWizardProps { onComplete: () => void; }

const LANGUAGES = [
  { code: 'fr', label: 'Francais' }, { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' }, { code: 'es', label: 'Espanol' },
  { code: 'pt', label: 'Portugues' }, { code: 'de', label: 'Deutsch' },
];

const INDUSTRIES = [
  { value: 'tech', label: 'Technologie', icon: '💻' },
  { value: 'health', label: 'Sante', icon: '🏥' },
  { value: 'education', label: 'Education', icon: '🎓' },
  { value: 'finance', label: 'Finance', icon: '🏦' },
  { value: 'retail', label: 'Commerce', icon: '🛒' },
  { value: 'restaurant', label: 'Restauration', icon: '🍽️' },
  { value: 'beauty', label: 'Beaute', icon: '💄' },
  { value: 'construction', label: 'Construction', icon: '🏗️' },
  { value: 'agriculture', label: 'Agriculture', icon: '🌱' },
  { value: 'auto', label: 'Automobile', icon: '🚗' },
  { value: 'real_estate', label: 'Immobilier', icon: '🏠' },
  { value: 'other', label: 'Autre', icon: '🏢' },
];

// Hero packs (April 2026 pricing model — $20/mo each, 7 agents included).
// These match the 4 marketplace hero bundles. "Skip" = Free plan with 1 agent.
const HERO_PACKS = [
  {
    id: 'b15', icon: '🚀', name: 'Pack PME',
    tagline: 'Sales · Comms · Marketing · Support',
    description: '4 agents pour scaler ton business + 3 core (Knowledge, Workflow, Wildcard)',
    industryHints: ['retail', 'tech', 'finance', 'beauty', 'other'],
  },
  {
    id: 'b10', icon: '🏢', name: 'Pack Entreprise',
    tagline: 'Sales · Compta · Support · Comms',
    description: 'Workspace IA opérationnel : ventes, factures, support, communication',
    industryHints: ['tech', 'finance', 'other'],
  },
  {
    id: 'b7',  icon: '🍽️', name: 'Pack Restaurant',
    tagline: 'Restaurant · Réception · Livraison · Fidélité',
    description: 'Réservations, livraison, messages clients et campagnes fidélité',
    industryHints: ['restaurant'],
  },
  {
    id: 'b2',  icon: '🏠', name: 'Pack Immobilier',
    tagline: 'Immobilier · Sales · Comms · Réception',
    description: 'Qualification leads, visites virtuelles, RDV automatisés',
    industryHints: ['real_estate'],
  },
];

interface AgentOption { id: string; name: string; icon: string; description: string; category: string; }

const STEPS = [
  { icon: Building2, label: 'Bienvenue', color: '#0092FF' },
  { icon: Globe, label: 'Langue', color: '#FF009D' },
  { icon: Briefcase, label: 'Industrie', color: '#FFA200' },
  { icon: Sparkles, label: 'Pack', color: '#7C3AED' },
  { icon: Bot, label: 'Agents inclus', color: '#0092FF' },
  { icon: FileText, label: 'Documents', color: '#00C48C' },
  { icon: CheckCircle, label: 'Pret', color: '#10B981' },
];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { company, setCompany } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [companyName, setCompanyName] = useState(company?.name ?? '');
  const [language, setLanguage] = useState(company?.settings?.language ?? 'fr');
  const [industry, setIndustry] = useState('other');
  // Pack model: null = Free (skip pack), or one of the bundle IDs (b2/b7/b10/b15...).
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [packAgents, setPackAgents] = useState<AgentOption[]>([]);
  const [trialError, setTrialError] = useState<string | null>(null);

  // Auto-suggest the best pack based on industry, when reaching step 3.
  useEffect(() => {
    if (step === 3 && selectedPackId === null) {
      const suggestion = HERO_PACKS.find(p => p.industryHints.includes(industry));
      if (suggestion) setSelectedPackId(suggestion.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Load the agents included in the picked pack (for the "agents included" step).
  useEffect(() => {
    if (!selectedPackId) {
      // Free: just Knowledge agent
      setPackAgents([{ id: 'knowledge', name: 'Knowledge', icon: '📚', description: 'Q&A sur tes documents', category: 'core' }]);
      return;
    }
    api.get(`/marketplace/bundles`)
      .then(r => {
        const raw = (r.data as { data?: any[] } | any[]);
        const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
        const bundle = list.find((b: any) => b.id === selectedPackId);
        if (!bundle) return;
        const agents: AgentOption[] = (bundle.agentIds ?? []).map((id: string) => ({
          id, name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          icon: '🤖', description: '', category: 'pack',
        }));
        setPackAgents(agents);
      })
      .catch(() => { /* leave default */ });
  }, [selectedPackId]);

  const selectedPack = HERO_PACKS.find(p => p.id === selectedPackId) ?? null;

  const saveStep = async (stepNum: number, data?: Record<string, unknown>) => {
    await api.patch('/company/onboarding/step', { step: stepNum, data }).catch(() => {});
  };

  const handleNext = async () => {
    setLoading(true);
    setTrialError(null);
    try {
      if (step === 0) {
        await saveStep(1, { companyName });
        if (company) setCompany({ ...company, name: companyName });
      } else if (step === 1) {
        await saveStep(2, { language, aiPersonality: 'professional' });
        if (company) setCompany({ ...company, settings: { ...company.settings, language, aiPersonality: 'professional' } });
      } else if (step === 2) {
        await saveStep(3, { industry });
      } else if (step === 3) {
        // Save the chosen pack (or null = free) and start the 30-day trial if a pack was picked.
        await api.patch('/company/onboarding/step', {
          step: 3,
          data: { plan: selectedPackId ? 'pack' : 'free', selectedBundleId: selectedPackId },
        }).catch(() => {});
        if (selectedPackId) {
          try {
            await api.post(`/marketplace/bundles/${selectedPackId}/start-trial`, {});
          } catch (e: any) {
            const msg = e?.response?.data?.message ?? 'Démarrage du trial impossible.';
            // Most common case: trial already active or used → skip silently
            const status = e?.response?.status;
            if (status !== 409) {
              setTrialError(`${msg}. Tu peux quand même continuer — active le pack plus tard depuis le marketplace.`);
            }
          }
        }
      } else if (step === 4) {
        // Pack agents are auto-selected; nothing to persist on this step.
      } else if (step === 5) {
        await saveStep(6);
      }
      setStep(s => s + 1);
    } finally { setLoading(false); }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await api.post('/company/onboarding/complete');
      if (company) setCompany({ ...company, onboardingCompleted: true } as typeof company & { onboardingCompleted: boolean });
      onComplete();
    } finally { setLoading(false); }
  };

  const stepInfo = STEPS[step]!;
  const StepIcon = stepInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Progress */}
        <div className="h-1.5 bg-gray-100 shrink-0">
          <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #0092FF, #7C3AED)' }}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.4 }} />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pt-4 px-6 shrink-0">
          {STEPS.map((s, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i < step ? 'bg-green-400' : i === step ? 'bg-violet-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }} className="px-8 py-5">

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stepInfo.color}22` }}>
                  <StepIcon size={20} style={{ color: stepInfo.color }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{stepInfo.label}</h2>
                  <p className="text-xs text-gray-500">Etape {step + 1} sur {STEPS.length}</p>
                </div>
              </div>

              {/* Step 0 — Welcome */}
              {step === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Bienvenue sur Orlode AI. Commencez par le nom de votre entreprise.</p>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="Nom de l'entreprise" autoFocus
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              )}

              {/* Step 1 — Language */}
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Dans quelle langue votre assistant IA doit-il communiquer ?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {LANGUAGES.map(l => (
                      <button key={l.code} onClick={() => setLanguage(l.code)}
                        className={`px-3 py-2.5 rounded-xl text-sm border transition-all ${language === l.code ? 'border-violet-500 bg-violet-50 text-violet-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2 — Industry */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Quel est votre secteur d'activite ? Ca nous aide a recommander les meilleurs agents.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {INDUSTRIES.map(i => (
                      <button key={i.value} onClick={() => setIndustry(i.value)}
                        className={`px-3 py-3 rounded-xl text-sm border transition-all text-center ${industry === i.value ? 'border-violet-500 bg-violet-50 text-violet-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        <span className="text-xl block mb-1">{i.icon}</span>
                        {i.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3 — Pack métier (or skip = Free) */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 mb-3">
                    <Gift size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-700">
                      <strong>Essai gratuit 30 jours, sans CB.</strong> Choisis un pack métier — 7 agents IA inclus à <strong>$20/mois</strong>. Tu peux changer ou annuler à tout moment.
                    </p>
                  </div>
                  {HERO_PACKS.map(p => (
                    <button key={p.id} onClick={() => setSelectedPackId(p.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${selectedPackId === p.id ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0 mt-0.5">{p.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 text-sm">{p.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">30j GRATUIT</span>
                            <span className="text-[10px] text-gray-500">$20/mo après</span>
                          </div>
                          <div className="text-xs text-violet-700 font-medium mt-0.5">{p.tagline}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{p.description}</div>
                        </div>
                        {selectedPackId === p.id && <CheckCircle size={18} className="text-violet-600 shrink-0 mt-1" />}
                      </div>
                    </button>
                  ))}
                  <button onClick={() => setSelectedPackId(null)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all ${selectedPackId === null ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">⏭️</span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-700 text-sm">Plus tard — explorer d'abord</span>
                        <div className="text-xs text-gray-500">Plan Free : 1 agent Knowledge. Tu peux activer un pack quand tu veux.</div>
                      </div>
                      {selectedPackId === null && <CheckCircle size={16} className="text-gray-500" />}
                    </div>
                  </button>
                </div>
              )}

              {/* Step 4 — Agents inclus dans le pack (informational, no selection) */}
              {step === 4 && (
                <div className="space-y-3">
                  {selectedPack ? (
                    <>
                      <p className="text-sm text-gray-600">
                        Voici les <strong>{packAgents.length} agents</strong> inclus dans <strong>{selectedPack.name}</strong>. Ils sont prêts à l'emploi dès la fin de l'onboarding.
                      </p>
                      {trialError && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900">
                          {trialError}
                        </div>
                      )}
                      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                        {packAgents.map(a => (
                          <div key={a.id} className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center gap-3">
                            <span className="text-lg">🤖</span>
                            <span className="text-sm font-medium text-gray-900 flex-1">{a.name}</span>
                            <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        En plan Free, tu as accès à <strong>l'agent Knowledge</strong> pour poser des questions sur tes documents. Tu pourras activer un pack métier plus tard depuis le marketplace.
                      </p>
                      <div className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 flex items-center gap-3">
                        <span className="text-lg">📚</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">Knowledge</div>
                          <div className="text-[11px] text-gray-500">Q&A unifiée sur tes documents</div>
                        </div>
                        <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 5 — Documents */}
              {step === 5 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Orlode apprend de vos documents. Vous pourrez les importer depuis le tableau de bord.</p>
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
                    <FileText size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-700">PDF, Word, Excel, CSV, Images</p>
                    <p className="text-xs text-gray-400 mt-1">Allez dans Gestion des donnees apres l'onboarding</p>
                  </div>
                </div>
              )}

              {/* Step 6 — Done */}
              {step === 6 && (
                <div className="text-center space-y-4 py-4">
                  <span className="text-5xl block">🎉</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{companyName || 'Votre entreprise'} est prêt !</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedPack ? (
                        <><strong>{selectedPack.name}</strong> · 7 agents · 30 jours gratuits</>
                      ) : (
                        <>Plan <strong>Free</strong> · 1 agent Knowledge</>
                      )}
                      {' · '}{LANGUAGES.find(l => l.code === language)?.label}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-left mt-3">
                    {[
                      { icon: '💬', title: 'Commencer a chatter', desc: 'Posez vos premieres questions' },
                      { icon: '🛒', title: 'Explorer le marketplace', desc: 'Agents metier specialises' },
                      { icon: '📄', title: 'Importer des documents', desc: 'Gestion des donnees' },
                      { icon: '⚙️', title: 'Configurer', desc: 'Parametres de l\'entreprise' },
                    ].map(item => (
                      <div key={item.title} className="bg-gray-50 rounded-xl p-3">
                        <span className="text-lg">{item.icon}</span>
                        <p className="text-xs font-semibold text-gray-800 mt-1">{item.title}</p>
                        <p className="text-[11px] text-gray-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 pt-2 flex items-center justify-between shrink-0">
          {step > 0 && step < 6 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={15} /> Retour
            </button>
          ) : <div />}

          {step < 6 ? (
            <button onClick={handleNext}
              disabled={loading || (step === 0 && !companyName.trim())}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <>{step === 3 && selectedPackId ? 'Activer le trial' : step === 5 ? 'Terminer' : 'Continuer'} <ArrowRight size={15} /></>}
            </button>
          ) : (
            <button onClick={handleComplete} disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold w-full justify-center disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <>Lancer Orlode AI <ArrowRight size={15} /></>}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
