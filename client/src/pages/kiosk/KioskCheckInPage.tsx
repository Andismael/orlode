/**
 * KioskCheckInPage — Visitor check-in for kiosk mode
 * Fixed: correct endpoint + response shape
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { ArrowLeft, CheckCircle, Clock } from 'lucide-react';

type Step = 'form' | 'waiting' | 'confirmed';

export default function KioskCheckInPage() {
  const navigate = useNavigate();
  const { t } = useLangStore();
  const [params] = useSearchParams();
  const type = params.get('type') ?? 'walkin';
  const [form, setForm] = useState({ name: '', company: '', host: '', purpose: '' });
  const [step, setStep] = useState<Step>('form');
  const [result, setResult] = useState<{ id?: string; badgeNumber?: string; host?: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('waiting');
    try {
      const r = await api.post('/reception/visitors', { ...form, type });
      setResult(r.data);
      setStep('confirmed');
    } catch {
      setStep('confirmed');
      setResult({ host: form.host });
    }
  };

  if (step === 'confirmed') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white bg-gray-900">
        <CheckCircle size={80} className="text-green-400 mb-6" />
        <h2 className="text-3xl font-bold mb-3">Merci {form.name} !</h2>
        <p className="text-xl text-white/70 mb-2">L'accueil a ete prevenu. Veuillez patienter.</p>
        {result?.badgeNumber && (
          <div className="mt-4 mb-4 bg-white/10 rounded-2xl px-8 py-4 text-center">
            <p className="text-sm text-white/50 mb-1">{`${t('badge')}`}</p>
            <p className="text-3xl font-mono font-bold tracking-wider">{result.badgeNumber}</p>
          </div>
        )}
        <p className="text-white/50 mb-8">Une notification a ete envoyee a {result?.host || form.host}</p>
        <div className="flex gap-4">
          {result?.id && (
            <button onClick={() => navigate(`/kiosk/badge?visitor=${result.id}`)}
              className="px-8 py-3 rounded-full font-semibold text-lg"
              style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
              Voir mon badge
            </button>
          )}
          <button onClick={() => navigate('/kiosk')} className="px-8 py-3 bg-white text-gray-900 rounded-full font-semibold text-lg">
            Retour a l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (step === 'waiting') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white bg-gray-900">
        <Clock size={60} className="text-blue-400 mb-4 animate-pulse" />
        <p className="text-xl">Enregistrement en cours...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-white p-8">
      <button onClick={() => navigate('/kiosk')} className="flex items-center gap-2 text-white/60 hover:text-white mb-8 text-lg">
        <ArrowLeft size={20} /> Retour
      </button>
      <div className="max-w-lg mx-auto w-full">
        <h1 className="text-3xl font-bold mb-8">
          {type === 'appointment' ? 'Verifier mon RDV' : type === 'delivery' ? t('delivery') : 'S\'enregistrer'}
        </h1>
        <form onSubmit={submit} className="space-y-5">
          {[
            { key: 'name', label: 'Votre nom', placeholder: 'Jean Dupont', required: true },
            { key: 'company', label: 'Votre entreprise', placeholder: 'Acme Corp', required: false },
            { key: 'host', label: 'Vous venez voir', placeholder: 'Marie Martin', required: type !== 'info' },
            { key: 'purpose', label: 'Motif de la visite', placeholder: 'Reunion, livraison...', required: false },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-white/60 text-sm mb-2">{field.label}</label>
              <input
                required={field.required}
                value={form[field.key as keyof typeof form]}
                onChange={e => setForm(p => ({...p, [field.key]: e.target.value}))}
                autoComplete="off"
                spellCheck={false}
                className="w-full px-5 py-4 bg-gray-800 border border-gray-600 rounded-2xl text-white text-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 kiosk-input"
                placeholder={field.placeholder}
              />
            </div>
          ))}
          <button type="submit"
            className="w-full py-4 rounded-2xl text-white text-xl font-bold"
            style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
            Confirmer
          </button>
        </form>
      </div>
    </div>
  );
}
