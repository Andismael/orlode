import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { auth } from '@/services/firebase';
import { useLangStore } from '@/store/langStore';

export default function ForgotPasswordPage() {
  const { t } = useLangStore();
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch {
      setError('Adresse email introuvable ou invalide.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-50 mb-5">
          <CheckCircle2 size={32} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email envoyé !</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">
          Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
        </p>
        <Link to="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
          style={{ color: '#0060FF' }}>
          <ArrowLeft size={14} />
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mot de passe oublié ?</h1>
        <p className="text-sm text-gray-500 mt-1">
          Entrez votre email et nous vous enverrons un lien de réinitialisation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{`${t('email')}`}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Mail size={15} />
            </span>
            <input type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@entreprise.com"
              className="input pl-9" />
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

        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
          style={{ background: 'linear-gradient(135deg,#0019FF,#0092FF)' }}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Envoyer le lien'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link to="/login"
          className="inline-flex items-center gap-1.5 font-semibold hover:underline"
          style={{ color: '#0060FF' }}>
          <ArrowLeft size={13} />
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
