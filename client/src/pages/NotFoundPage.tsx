import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { useLangStore } from '@/store/langStore';

export default function NotFoundPage() {
  const { t } = useLangStore();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-6">
      <div className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
        <span className="text-white text-4xl font-black">404</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{`${t('no_data')}`}</h1>
      <p className="text-gray-500 mb-8 max-w-sm">La page que vous cherchez n'existe pas ou a été déplacée.</p>
      <div className="flex gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} /> Retour
        </button>
        <button onClick={() => navigate('/')} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-medium transition-colors" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          <Home size={16} /> Accueil
        </button>
      </div>
    </div>
  );
}
