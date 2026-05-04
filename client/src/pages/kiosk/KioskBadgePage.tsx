/**
 * KioskBadgePage — Badge display after visitor check-in
 * Fixed: correct response shape r.data
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Printer, ArrowLeft } from 'lucide-react';

interface Badge { name: string; company: string; host: string; checkInAt: string; badgeNumber: string; type: string }

export default function KioskBadgePage() {
  const { t } = useLangStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const visitorId = params.get('visitor');
  const [badge, setBadge] = useState<Badge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visitorId) { setLoading(false); return; }
    api.get(`/reception/visitors/${visitorId}/badge`)
      .then(r => setBadge(r.data as Badge))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visitorId]);

  if (loading) return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
      <p className="text-xl">Generation du badge...</p>
    </div>
  );

  const timeStr = badge?.checkInAt
    ? new Date(badge.checkInAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleString('fr-FR');

  const typeLabel = badge?.type === 'vip' ? 'VIP' :
    badge?.type === 'delivery' ? 'LIVRAISON' :
    badge?.type === 'appointment' ? 'RENDEZ-VOUS' : 'VISITEUR';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-8 gap-8">
      <button onClick={() => navigate('/kiosk')} className="flex items-center gap-2 text-white/50 hover:text-white self-start text-sm">
        <ArrowLeft size={16} /> Retour
      </button>

      {/* Badge */}
      <div className="bg-white text-gray-900 rounded-3xl shadow-2xl w-80 overflow-hidden print:shadow-none">
        {/* Header */}
        <div className="p-5 text-center text-white" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-1 opacity-80">Badge {typeLabel}</p>
          <h2 className="text-2xl font-bold">{badge?.name ?? t('visitors')}</h2>
          {badge?.company && <p className="text-sm opacity-80 mt-1">{badge.company}</p>}
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Recu par</p>
            <p className="font-semibold text-gray-900">{badge?.host ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Date & heure</p>
            <p className="font-semibold text-gray-900">{timeStr}</p>
          </div>
          {/* Badge number */}
          <div className="flex justify-center mt-3">
            <div className="bg-gray-100 rounded-xl px-6 py-3 text-center">
              <p className="text-xs text-gray-400 mb-1">N° Badge</p>
              <p className="text-2xl font-mono font-bold text-gray-900 tracking-wider">{badge?.badgeNumber ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 text-center">
          <p className="text-xs text-gray-400">Veuillez garder ce badge visible</p>
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="flex items-center gap-3 px-8 py-3 rounded-full text-white text-lg font-semibold"
        style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
        <Printer size={20} /> Imprimer le badge
      </button>

      <button onClick={() => navigate('/kiosk')} className="text-white/50 hover:text-white text-sm">
        Terminer sans imprimer
      </button>
    </div>
  );
}
