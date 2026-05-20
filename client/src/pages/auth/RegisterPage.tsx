import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2, Check } from 'lucide-react';
import { auth, db } from '@/services/firebase';
import { useLangStore } from '@/store/langStore';
import { useSEO } from '@/hooks/useSEO';

// Pricing pivot Apr 2026: $20/pack métier with 30-day free trial (no CB).
// The actual pack picker lives in the onboarding wizard — this register page
// just teases the model and lets the user start free.
const PLANS = [
  {
    id: 'free',
    label: 'Démarrer gratuit',
    price: '$0',
    period: '',
    desc: '1 agent Knowledge · découvre la plateforme',
    highlight: false,
  },
  {
    id: 'pack',
    label: 'Pack métier',
    price: '$20',
    period: '/mois',
    desc: '7 agents IA · 30 jours gratuits sans CB',
    highlight: true,
  },
  {
    id: 'super',
    label: 'Super Pack',
    price: '$45',
    period: '/mois',
    desc: '11 agents flagship · couvre toute l\'entreprise',
    highlight: false,
  },
];

const ERRORS: Record<string, string> = {
  'auth/email-already-in-use': 'Cet email est déjà utilisé.',
  'auth/weak-password':        'Le mot de passe doit faire au moins 6 caractères.',
  'auth/invalid-email':        'Adresse email invalide.',
};

export default function RegisterPage() {
  useSEO({
    title: 'Créer un compte | Orlode AI — 30 jours gratuits',
    description: 'Crée ton espace Orlode AI. Pack métier à $20/mois, 30 jours d\'essai gratuits, sans CB. 30+ agents IA prêts à l\'emploi.',
    path: '/register',
  });
  const navigate = useNavigate();
  const { t } = useLangStore();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirm: '', plan: 'free', cgu: false,
  });
  const [showPwd, setShowPwd]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (!form.cgu) { setError('Veuillez accepter les CGU pour continuer.'); return; }
    setLoading(true);
    setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const uid = cred.user.uid;
      await updateProfile(cred.user, { displayName: form.name });

      // Create company doc (companyId = user uid for owner)
      await setDoc(doc(db, 'companies', uid), {
        name: '',
        ownerId: uid,
        plan: form.plan || 'free',
        selectedAgents: [],
        onboardingCompleted: false,
        onboardingStep: 0,
        settings: { language: 'fr', aiPersonality: 'professional' },
        createdAt: serverTimestamp(),
      });

      // Create user doc linked to company
      await setDoc(doc(db, 'users', uid), {
        displayName: form.name,
        email: form.email,
        role: 'admin',
        selectedPlan: form.plan,
        companyId: uid,
        createdAt: serverTimestamp(),
      });

      // Track referral conversion if exists
      try {
        const ref = localStorage.getItem('cm_referral');
        if (ref) {
          const { creatorId, agentId, expiresAt } = JSON.parse(ref);
          if (creatorId && Date.now() < expiresAt) {
            fetch('/api/referral/convert', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ creatorId, userId: uid, agentId }),
            }).catch(() => {});
            localStorage.removeItem('cm_referral');
          }
        }
      } catch {}

      // Fire welcome email (non-blocking)
      try {
        const token = await cred.user.getIdToken();
        fetch('/api/auth/welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ companyName: form.name, plan: form.plan, userName: form.name }),
        }).catch(() => {});
      } catch {}

      navigate('/onboarding');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setError(ERRORS[e.code ?? ''] ?? e.message ?? 'Erreur lors de la création du compte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Titre */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
        <p className="text-sm text-gray-500 mt-1">
          Démarrez votre essai gratuit — sans carte de crédit
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nom */}
        <div>
          <label className="label">{`${t('name')}`}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><User size={15} /></span>
            <input type="text" required value={form.name}
              onChange={e => set('name')(e.target.value)}
              placeholder="Jean Dupont" className="input pl-9" />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="label">{`${t('email')}`}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={15} /></span>
            <input type="email" required value={form.email}
              onChange={e => set('email')(e.target.value)}
              placeholder="vous@entreprise.com" className="input pl-9" />
          </div>
        </div>

        {/* Mots de passe */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{`${t('password')}`}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={15} /></span>
              <input type={showPwd ? 'text' : 'password'} required value={form.password}
                onChange={e => set('password')(e.target.value)}
                placeholder="••••••••" className="input pl-9 pr-9" />
              <button type="button" tabIndex={-1}
                onClick={() => setShowPwd(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">{`${t('confirm')}`}</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} required value={form.confirm}
                onChange={e => set('confirm')(e.target.value)}
                placeholder="••••••••" className="input pr-9" />
              <button type="button" tabIndex={-1}
                onClick={() => setShowConfirm(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Plans */}
        <div>
          <label className="label">Choisissez votre plan</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PLANS.map(plan => {
              const active = form.plan === plan.id;
              return (
                <button key={plan.id} type="button"
                  onClick={() => set('plan')(plan.id)}
                  className={`relative p-3 rounded-xl border text-left transition-all ${
                    active
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}>
                  {plan.highlight && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                      Populaire
                    </span>
                  )}
                  {active && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                  <div className="text-xs font-bold text-gray-900 mb-0.5">{plan.label}</div>
                  <div className="text-xs font-semibold" style={{ color: '#0060FF' }}>
                    {plan.price}<span className="text-gray-400 font-normal">{plan.period}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{plan.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CGU */}
        <label className="flex items-start gap-2.5 cursor-pointer group">
          <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
            form.cgu ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'
          }`}
            onClick={() => set('cgu')(!form.cgu)}>
            {form.cgu && <Check size={10} className="text-white" strokeWidth={3} />}
          </div>
          <input type="checkbox" checked={form.cgu} onChange={e => set('cgu')(e.target.checked)} className="sr-only" />
          <span className="text-xs text-gray-600 leading-relaxed">
            J'accepte les{' '}
            <a href="#" className="font-medium hover:underline" style={{ color: '#0060FF' }}>CGU</a>
            {' '}et la{' '}
            <a href="#" className="font-medium hover:underline" style={{ color: '#0060FF' }}>Politique de confidentialité</a>
          </span>
        </label>

        {/* Erreur */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#0019FF,#0092FF)' }}>
          {loading
            ? <Loader2 size={16} className="animate-spin" />
            : <><span>Créer mon compte</span><ArrowRight size={15} /></>}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Déjà inscrit ?{' '}
        <Link to="/login" className="font-semibold hover:underline" style={{ color: '#0060FF' }}>
          Se connecter
        </Link>
      </p>
    </div>
  );
}
