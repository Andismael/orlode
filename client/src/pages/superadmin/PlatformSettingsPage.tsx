import { useEffect, useState } from 'react';
import { Loader2, Save, Phone, MessageCircle, Mail, CheckCircle2 } from 'lucide-react';
import api from '@/services/api';

interface Settings {
  manualPaymentPhone: string;
  manualPaymentWhatsapp: string;
  manualPaymentEmail: string;
  supportEmail: string;
  supportPhone: string;
}

const EMPTY: Settings = {
  manualPaymentPhone: '',
  manualPaymentWhatsapp: '',
  manualPaymentEmail: '',
  supportEmail: '',
  supportPhone: '',
};

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/superadmin/platform-settings')
      .then(r => {
        const raw = r.data as Record<string, unknown>;
        const data = (raw?.data ?? raw) as Partial<Settings>;
        setSettings({ ...EMPTY, ...data });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(s => ({ ...s, [k]: e.target.value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/superadmin/platform-settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres plateforme</h1>
        <p className="text-sm text-gray-500 mt-0.5">Réglages globaux de Orlode — édités ici prennent effet immédiatement, sans redeploy.</p>
      </div>

      {/* ── Paiement manuel ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
          <Phone size={16} className="text-orange-600" />
          <h2 className="text-sm font-bold text-gray-800">Contacts paiement manuel</h2>
        </div>
        <p className="text-xs text-gray-500">
          Ces infos s'affichent quand un client choisit "Paiement local / Cash" sur l'abonnement ou le marketplace.
          Le client reçoit un lien WhatsApp et email pré-remplis avec la référence de paiement.
        </p>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Phone size={12} /> Téléphone (appels)
          </label>
          <input type="tel" value={settings.manualPaymentPhone} onChange={update('manualPaymentPhone')}
            placeholder="+225 XX XX XX XX XX"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <MessageCircle size={12} className="text-green-600" /> WhatsApp (chat)
          </label>
          <input type="tel" value={settings.manualPaymentWhatsapp} onChange={update('manualPaymentWhatsapp')}
            placeholder="+225 XX XX XX XX XX"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <p className="text-[11px] text-gray-400 mt-1">Peut être le même numéro que Téléphone.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Mail size={12} /> Email de facturation
          </label>
          <input type="email" value={settings.manualPaymentEmail} onChange={update('manualPaymentEmail')}
            placeholder="billing@votre-domaine.com"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
      </div>

      {/* ── Support ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
          <Mail size={16} className="text-blue-600" />
          <h2 className="text-sm font-bold text-gray-800">Support client (optionnel)</h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email support</label>
          <input type="email" value={settings.supportEmail} onChange={update('supportEmail')}
            placeholder="support@corpmind.ai"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Téléphone support</label>
          <input type="tel" value={settings.supportPhone} onChange={update('supportPhone')}
            placeholder="+225 XX XX XX XX XX"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
      </div>

      {/* ── Save ── */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle2 size={14} /> Enregistré — effet immédiat sur les prochains paiements
          </span>
        )}
      </div>
    </div>
  );
}
