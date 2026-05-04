/**
 * ByoeSetupPage — opt-in BYOE setup from admin settings.
 * Users who started on Orlode SaaS can migrate to their own Firebase project here.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Shield, Zap, ArrowLeft, AlertTriangle } from 'lucide-react';
import BYOESetupWizard from '@/components/setup/BYOESetupWizard';
import { useAuthStore } from '@/store/authStore';

export default function ByoeSetupPage() {
  const navigate = useNavigate();
  const { company } = useAuthStore();
  const [started, setStarted] = useState(false);

  const alreadyConfigured = (company as unknown as { byoeEnabled?: boolean })?.byoeEnabled === true;

  if (started) {
    return <BYOESetupWizard onComplete={() => navigate('/dashboard')} />;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-bold uppercase tracking-wide mb-4">
          <Server size={12} /> Mode avancé
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Héberger Orlode sur votre propre infrastructure</h1>
        <p className="text-gray-600 mt-2 text-sm max-w-2xl">
          Passez de l'hébergement partagé Orlode à votre propre projet Firebase. Vos données restent chez vous, vous payez vos propres frais GCP, et vous contrôlez tout.
        </p>
      </div>

      {alreadyConfigured && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <Shield size={18} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-900">BYOE déjà configuré pour cette entreprise</p>
            <p className="text-xs text-green-700 mt-1">Vous pouvez reconfigurer ou changer de projet Firebase en relançant le wizard ci-dessous.</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="p-5 bg-white border border-gray-200 rounded-2xl">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
            <Shield size={18} className="text-blue-600" />
          </div>
          <h3 className="font-bold text-gray-900">Vos données, votre contrôle</h3>
          <p className="text-sm text-gray-600 mt-1">Firestore, Storage, Auth — tout est hébergé sur votre propre projet GCP. Conforme RGPD, souveraineté totale.</p>
        </div>
        <div className="p-5 bg-white border border-gray-200 rounded-2xl">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
            <Zap size={18} className="text-amber-600" />
          </div>
          <h3 className="font-bold text-gray-900">Pas de limites d'usage</h3>
          <p className="text-sm text-gray-600 mt-1">Vous payez directement Google pour votre consommation — plus de quotas Orlode sur les documents ou questions mensuelles.</p>
        </div>
      </div>

      <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl mb-8">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Prérequis avant de commencer</p>
            <ul className="text-xs text-amber-800 mt-2 space-y-1 list-disc pl-4">
              <li>Un projet Firebase existant (créez-en un sur <a href="https://console.firebase.google.com" target="_blank" rel="noopener" className="underline">console.firebase.google.com</a>)</li>
              <li>La clé de service (service account JSON) téléchargée depuis Firebase Console</li>
              <li>Une clé API Gemini (gratuite sur <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" className="underline">Google AI Studio</a>)</li>
              <li>Plan Pro ou supérieur requis pour BYOE</li>
            </ul>
          </div>
        </div>
      </div>

      <button onClick={() => setStarted(true)}
        className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all">
        {alreadyConfigured ? 'Reconfigurer BYOE' : 'Lancer la configuration BYOE'}
      </button>
    </div>
  );
}
