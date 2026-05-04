import React, { useState } from 'react';
import { Save, Building2, Bot, Bell, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import { Button } from '@/components/common/Button';

type TabId = 'company' | 'ai' | 'notifications' | 'security';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABS: { id: TabId; label: string; icon: React.ComponentType<any>; color: string }[] = [
  { id: 'company',       label: 'Entreprise',    icon: Building2, color: '#0092FF' },
  { id: 'ai',            label: 'Parametres IA', icon: Bot,       color: '#FF009D' },
  { id: 'notifications', label: 'Notifications', icon: Bell,      color: '#FFA200' },
  { id: 'security',      label: 'Securite',      icon: Shield,    color: '#00A550' },
];

export default function SettingsPage() {
  const { user, company, setCompany } = useAuthStore();
  const { t } = useLangStore();
  const [activeTab, setActiveTab] = useState<TabId>('company');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [companyName, setCompanyName] = useState(company?.name ?? '');
  const [companyLanguage, setCompanyLanguage] = useState(company?.settings?.language ?? 'fr');
  const [timezone, setTimezone] = useState('Europe/Paris');

  const [aiPersonality, setAiPersonality] = useState(company?.settings?.aiPersonality ?? 'professional');
  const [aiLanguage, setAiLanguage] = useState('fr');
  const [systemContext, setSystemContext] = useState(company?.settings?.systemContext ?? '');
  const [maxTokens, setMaxTokens] = useState(2000);
  const [temperature, setTemperature] = useState(0.3);

  const activeColor = TABS.find((t) => t.id === activeTab)?.color ?? '#0092FF';

  const handleSave = async () => {
    if (!user?.companyId) return;
    setIsSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      if (activeTab === 'company') {
        updates['name'] = companyName;
        updates['settings.language'] = companyLanguage;
        updates['settings.timezone'] = timezone;
      } else if (activeTab === 'ai') {
        updates['settings.aiPersonality'] = aiPersonality;
        updates['settings.aiLanguage'] = aiLanguage;
        updates['settings.systemContext'] = systemContext;
        updates['settings.maxTokens'] = maxTokens;
        updates['settings.temperature'] = temperature;
      }
      await updateDoc(doc(db, 'companies', user.companyId), updates);
      if (company) {
        setCompany({ ...company, name: companyName, settings: { ...company.settings, language: companyLanguage, aiPersonality, systemContext } });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure your Orlode AI workspace</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-48 flex-shrink-0 space-y-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative overflow-hidden"
                style={isActive
                  ? { background: tab.color, color: '#fff' }
                  : { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }
                }
              >
                {isActive && (
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />
                )}
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 relative"
                  style={isActive ? { background: 'rgba(255,255,255,0.2)' } : { background: tab.color }}
                >
                  <Icon size={13} color={isActive ? '#fff' : '#fff'} />
                </div>
                <span className="relative">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'company' && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: activeColor }}>
                  <Building2 size={15} />
                  Company Information
                </h3>
                <div>
                  <label className="label">Company Name</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Default Language</label>
                  <select value={companyLanguage} onChange={(e) => setCompanyLanguage(e.target.value)} className="input">
                    <option value="fr">French (Français)</option>
                    <option value="en">English</option>
                    <option value="es">Spanish (Español)</option>
                    <option value="de">German (Deutsch)</option>
                    <option value="it">Italian (Italiano)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Timezone</label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="input">
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-5">
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
                  <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: activeColor }}>
                    <Bot size={15} />
                    AI Personality
                  </h3>
                  <div>
                    <label className="label">Communication Style</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['professional', 'friendly', 'concise'].map((style) => (
                        <button
                          key={style}
                          onClick={() => setAiPersonality(style)}
                          className="py-2.5 px-3 rounded-lg text-xs font-medium border capitalize transition-all"
                          style={aiPersonality === style
                            ? { background: activeColor, color: '#fff', borderColor: activeColor }
                            : { background: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                          }
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Response Language</label>
                    <select value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)} className="input">
                      <option value="fr">French (Français)</option>
                      <option value="en">English</option>
                      <option value="auto">Auto-detect from query</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">System Context</label>
                    <textarea
                      value={systemContext}
                      onChange={(e) => setSystemContext(e.target.value)}
                      rows={4}
                      placeholder="Additional context about your company that the AI should always know..."
                      className="input resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">This will be included in every AI prompt</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900">Model Parameters</h3>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label mb-0">Max Response Length</label>
                      <span className="text-xs font-mono font-semibold" style={{ color: activeColor }}>{maxTokens} tokens</span>
                    </div>
                    <input type="range" min={500} max={4000} step={100} value={maxTokens}
                      onChange={(e) => setMaxTokens(Number(e.target.value))} className="w-full" style={{ accentColor: activeColor }} />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Short</span><span>Detailed</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label mb-0">Creativity (Temperature)</label>
                      <span className="text-xs font-mono font-semibold" style={{ color: activeColor }}>{temperature}</span>
                    </div>
                    <input type="range" min={0} max={1} step={0.1} value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))} className="w-full" style={{ accentColor: activeColor }} />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Precise</span><span>Creative</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-700">Model:</span> Gemini 3 Pro (Google)<br />
                      <span className="font-medium text-gray-700">Embeddings:</span> text-embedding-004 (Google, 768 dims)<br />
                      <span className="font-medium text-gray-700">Vector DB:</span> Firestore Vector Search
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: activeColor }}>
                  <Bell size={15} />
                  Notification Preferences
                </h3>
                {[
                  { label: 'Document processing completed', defaultOn: true },
                  { label: 'New user joined workspace',     defaultOn: true },
                  { label: 'AI response errors',            defaultOn: true },
                  { label: 'Weekly usage digest',           defaultOn: false },
                  { label: 'Meeting reminders',             defaultOn: false },
                ].map((pref) => (
                  <div key={pref.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700">{pref.label}</span>
                    <button
                      className="relative w-10 h-5 rounded-full transition-colors"
                      style={{ background: pref.defaultOn ? activeColor : '#e5e7eb' }}
                      role="switch"
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${pref.defaultOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-5">
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
                  <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: activeColor }}>
                    <Shield size={15} />
                    Security Settings
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Two-factor authentication', status: 'Disabled',  action: 'Enable' },
                      { label: 'Session timeout',           status: '24 hours',  action: 'Configure' },
                      { label: 'API access logs',           status: 'Enabled',   action: 'View logs' },
                    ].map((setting) => (
                      <div key={setting.label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{setting.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{setting.status}</p>
                        </div>
                        <button className="text-xs font-semibold" style={{ color: activeColor }}>{setting.action}</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-red-500 mb-3">Danger Zone</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-700">Delete all documents</p>
                        <p className="text-xs text-gray-400">Remove all indexed documents and vectors</p>
                      </div>
                      <button className="btn-danger px-3 py-1.5 text-xs">Delete</button>
                    </div>
                    <div className="border-t border-red-100 pt-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-700">Delete workspace</p>
                        <p className="text-xs text-gray-400">Permanently delete this workspace and all data</p>
                      </div>
                      <button className="btn-danger px-3 py-1.5 text-xs">Delete Workspace</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {(activeTab === 'company' || activeTab === 'ai') && (
            <div className="flex justify-end">
              <Button onClick={handleSave} loading={isSaving} leftIcon={<Save size={14} />} className="px-6">
                {saved ? 'Saved!' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
