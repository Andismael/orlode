import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
  createUserWithEmailAndPassword, updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Loader2 } from 'lucide-react';
import { auth, db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import { useSEO } from '@/hooks/useSEO';

type Mode = 'login' | 'register';

const ERRORS: Record<string, string> = {
  'auth/user-not-found':      'Aucun compte associé à cet email.',
  'auth/wrong-password':      'Mot de passe incorrect.',
  'auth/email-already-in-use':'Cet email est déjà utilisé.',
  'auth/weak-password':       'Le mot de passe doit faire au moins 6 caractères.',
  'auth/invalid-email':       'Adresse email invalide.',
  'auth/too-many-requests':   'Trop de tentatives. Réessayez dans quelques minutes.',
  'auth/invalid-credential':  'Email ou mot de passe incorrect.',
};

export default function LoginPage() {
  useSEO({
    title: 'Connexion | Orlode AI',
    description: 'Connectez-vous a Orlode AI — gerez votre entreprise depuis WhatsApp avec 17 packs IA.',
    path: '/login',
    noindex: true,
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';
  const { user } = useAuthStore();
  const { t } = useLangStore();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [companyName, setCompanyName]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => { if (user) navigate(redirectTo, { replace: true }); }, [user, navigate, redirectTo]);

  const switchMode = (m: Mode) => { setMode(m); setError(''); };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(newUser, { displayName });
        const companyRef = doc(db, 'companies', newUser.uid);
        await setDoc(companyRef, {
          name: companyName || `${displayName}'s Company`,
          ownerId: newUser.uid,
          plan: 'trial',
          createdAt: serverTimestamp(),
          settings: { language: 'fr', aiPersonality: 'professional' },
        });
        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          email: newUser.email,
          displayName,
          companyId: newUser.uid,
          role: 'admin',
          createdAt: serverTimestamp(),
        });
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(ERRORS[e.code ?? ''] ?? e.message ?? 'Une erreur est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const { user: googleUser } = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, 'users', googleUser.uid));
      const isNewUser = !userDoc.exists();
      if (isNewUser) {
        await setDoc(doc(db, 'companies', googleUser.uid), {
          name: `${googleUser.displayName}'s Company`,
          ownerId: googleUser.uid,
          plan: 'free',
          selectedAgents: [],
          onboardingCompleted: false,
          onboardingStep: 0,
          createdAt: serverTimestamp(),
          settings: { language: 'fr', aiPersonality: 'professional' },
        });
        await setDoc(doc(db, 'users', googleUser.uid), {
          uid: googleUser.uid,
          email: googleUser.email,
          displayName: googleUser.displayName,
          photoURL: googleUser.photoURL,
          companyId: googleUser.uid,
          role: 'admin',
          createdAt: serverTimestamp(),
        });

        // Fire welcome email (non-blocking)
        try {
          const token = await googleUser.getIdToken();
          fetch('/api/auth/welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              companyName: `${googleUser.displayName}'s Company`,
              plan: 'free',
              userName: googleUser.displayName ?? googleUser.email?.split('@')[0] ?? 'friend',
            }),
          }).catch(() => {});
        } catch {}
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message ?? 'Connexion Google échouée.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Titre */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'login' ? 'Bon retour 👋' : 'Créer un compte'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'login'
            ? 'Connectez-vous à votre espace Orlode'
            : 'Créez votre compte en 30 secondes — vos packs s\'activent ensuite'}
        </p>
      </div>

      {/* Onglets */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-7">
        {(['login', 'register'] as Mode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200
              ${mode === m ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            style={mode === m ? { background: 'linear-gradient(135deg,#0019FF,#0092FF)' } : {}}>
            {m === 'login' ? 'Connexion' : 'Inscription'}
          </button>
        ))}
      </div>

      {/* Formulaire */}
      <form onSubmit={handleEmailAuth} className="space-y-4">
        <AnimatePresence mode="wait">
          {mode === 'register' && (
            <motion.div key="register-fields"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 overflow-hidden">
              <Field label="Nom complet" icon={<User size={15} />}>
                <input type="text" value={displayName} required
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Jean Dupont" className="input pl-9" />
              </Field>
              <Field label="Nom de l'entreprise">
                <input type="text" value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Acme Corp (optionnel)" className="input" />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        <Field label="Adresse email" icon={<Mail size={15} />}>
          <input type="email" value={email} required
            onChange={e => setEmail(e.target.value)}
            placeholder="vous@entreprise.com" className="input pl-9" />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label">{`${t('password')}`}</label>
            {mode === 'login' && (
              <Link to="/forgot-password"
                className="text-xs font-medium hover:underline"
                style={{ color: '#0060FF' }}>
                Mot de passe oublié ?
              </Link>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Lock size={15} />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password} required
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Min. 6 caractères' : '••••••••'}
              className="input pl-9 pr-10"
            />
            <button type="button" tabIndex={-1}
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

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

        <button type="submit" disabled={isLoading}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 mt-2"
          style={{ background: 'linear-gradient(135deg,#0019FF,#0092FF)' }}>
          {isLoading
            ? <Loader2 size={16} className="animate-spin" />
            : <>
                {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                <ArrowRight size={15} />
              </>}
        </button>
      </form>

      {/* Séparateur */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">ou continuer avec</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Google */}
      <button onClick={handleGoogleLogin} disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
        <svg width="17" height="17" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continuer avec Google
      </button>

      {/* Switch */}
      <p className="text-center text-sm text-gray-500 mt-6">
        {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
        <button onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          className="font-semibold hover:underline" style={{ color: '#0060FF' }}>
          {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
        </button>
      </p>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {icon ? (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
          {children}
        </div>
      ) : children}
    </div>
  );
}
