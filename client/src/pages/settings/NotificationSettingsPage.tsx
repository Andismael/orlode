import React, { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, Smartphone, UserPlus } from 'lucide-react';
import { useLangStore } from '@/store/langStore';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';

interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; }
function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const { t } = useLangStore();
  const [settings, setSettings] = useState({
    emailAlerts: true, emailMeetings: true, emailDocuments: false, emailInsights: true,
    pushAlerts: true, pushMeetings: true, pushDocuments: true, pushInsights: false,
    slackAlerts: false, slackMeetings: false, inAppAll: true,
    digestFrequency: 'daily', dndStart: '22:00', dndEnd: '08:00', dndEnabled: false,
  });

  const set = (key: string, value: boolean | string) => setSettings(p => ({...p, [key]: value}));

  const sections = [
    { title: t('email'), icon: Mail, items: [
      { key: 'emailAlerts', label: 'Alertes' }, { key: 'emailMeetings', label: 'Réunions' },
      { key: 'emailDocuments', label: t('documents') }, { key: 'emailInsights', label: 'Insights' },
    ]},
    { title: 'Push (navigateur)', icon: Bell, items: [
      { key: 'pushAlerts', label: 'Alertes' }, { key: 'pushMeetings', label: 'Réunions' },
      { key: 'pushDocuments', label: t('documents') }, { key: 'pushInsights', label: 'Insights' },
    ]},
    { title: 'Slack (si connecté)', icon: MessageSquare, items: [
      { key: 'slackAlerts', label: 'Alertes critiques' }, { key: 'slackMeetings', label: 'Résumés de réunions' },
    ]},
    { title: 'In-app', icon: Smartphone, items: [
      { key: 'inAppAll', label: 'Toutes les notifications in-app' },
    ]},
  ];

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h2 className="text-lg font-bold text-gray-900">{`${t('notifications')}`}</h2>
      {sections.map(section => {
        const Icon = section.icon;
        return (
          <div key={section.title} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <Icon size={15} className="text-gray-600" />
              <span className="text-sm font-semibold text-gray-800">{section.title}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {section.items.map(item => (
                <div key={item.key} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <Toggle checked={settings[item.key as keyof typeof settings] as boolean} onChange={v => set(item.key, v)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">{`${t('today')}`}</p>
        <select value={settings.digestFrequency} onChange={e => set('digestFrequency', e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="realtime">{`${t('active')}`}</option>
          <option value="daily">Quotidien (matin)</option>
          <option value="weekly">Hebdomadaire (lundi)</option>
          <option value="never">Jamais</option>
        </select>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Mode "Ne pas déranger"</p>
            <p className="text-xs text-gray-500">Aucune notif pendant ces horaires</p>
          </div>
          <Toggle checked={settings.dndEnabled} onChange={v => set('dndEnabled', v)} />
        </div>
        {settings.dndEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">De</label>
              <input type="time" value={settings.dndStart} onChange={e => set('dndStart', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">À</label>
              <input type="time" value={settings.dndEnd} onChange={e => set('dndEnd', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
        )}
      </div>

      <VisitorNotificationSection />

      <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
        Enregistrer
      </button>
    </div>
  );
}

// ── Visitor notification channels (kiosk alerts when someone comes to see you) ──
function VisitorNotificationSection() {
  const [channels, setChannels] = useState({
    email: true,
    dashboard: true,
    whatsapp: { enabled: false, phone: '' },
    telegram: { enabled: false, chatId: '' },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/hr/notification-channels')
      .then(r => {
        const d = r.data as typeof channels | undefined;
        if (d) setChannels({ ...channels, ...d, whatsapp: { ...channels.whatsapp, ...(d.whatsapp ?? {}) }, telegram: { ...channels.telegram, ...(d.telegram ?? {}) } });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/hr/notification-channels', channels);
      toast.success('Préférences enregistrées');
    } catch {
      toast.error('Échec de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-violet-50">
        <UserPlus size={15} className="text-violet-600" />
        <span className="text-sm font-semibold text-violet-900">Alertes visiteurs (kiosk)</span>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-gray-500">Canaux utilisés quand un visiteur demande à vous voir à l'accueil.</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Mail size={14} className="text-gray-500" /><span className="text-sm">Email</span></div>
          <Toggle checked={channels.email} onChange={v => setChannels(p => ({ ...p, email: v }))} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><MessageSquare size={14} className="text-green-600" /><span className="text-sm">WhatsApp</span></div>
            <Toggle checked={channels.whatsapp.enabled} onChange={v => setChannels(p => ({ ...p, whatsapp: { ...p.whatsapp, enabled: v } }))} />
          </div>
          {channels.whatsapp.enabled && (
            <input type="tel" placeholder="+225XXXXXXXX" value={channels.whatsapp.phone}
              onChange={e => setChannels(p => ({ ...p, whatsapp: { ...p.whatsapp, phone: e.target.value } }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><MessageSquare size={14} className="text-sky-600" /><span className="text-sm">Telegram</span></div>
            <Toggle checked={channels.telegram.enabled} onChange={v => setChannels(p => ({ ...p, telegram: { ...p.telegram, enabled: v } }))} />
          </div>
          {channels.telegram.enabled && (
            <input type="text" placeholder="Chat ID (ex: 123456789)" value={channels.telegram.chatId}
              onChange={e => setChannels(p => ({ ...p, telegram: { ...p.telegram, chatId: e.target.value } }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          )}
        </div>

        <button onClick={save} disabled={saving}
          className="w-full px-4 py-2 rounded-lg text-white text-sm font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
          {saving ? 'Enregistrement…' : 'Enregistrer les canaux'}
        </button>
      </div>
    </div>
  );
}
