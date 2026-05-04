import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import api from '@/services/api';
import { CheckCircle, Building2, Phone, Globe, MapPin, Users, Bot, Image, Loader } from 'lucide-react';

const SECTORS = ['Technologie','Finance','Santé','Commerce','Industrie','Services','Éducation','Immobilier','Transport','Alimentation','Autre'];
const SIZES   = ['1-10','11-50','51-200','201-500','500+'];
const PERSONALITIES = [
  { value: 'professional', label: 'Professionnel' },
  { value: 'friendly',     label: 'Amical & accessible' },
  { value: 'concise',      label: 'Concis & direct' },
  { value: 'expert',       label: 'Expert technique' },
];
const TIMEZONES = [
  'Europe/Paris','Europe/London','Africa/Abidjan','Africa/Casablanca','Africa/Dakar',
  'Africa/Nairobi','America/New_York','America/Los_Angeles','Asia/Dubai','Asia/Tokyo',
];

type Section = 'identity' | 'contact' | 'address' | 'social' | 'ai';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SECTIONS: { id: Section; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'identity', label: 'Identité',  icon: Building2 },
  { id: 'contact',  label: 'Contact',   icon: Phone },
  { id: 'address',  label: 'Adresse',   icon: MapPin },
  { id: 'social',   label: 'Réseaux',   icon: Globe },
  { id: 'ai',       label: 'IA',        icon: Bot },
];

interface CompanyForm {
  name: string; slogan: string; description: string; sector: string; size: string; website: string; logoUrl: string;
  phone: string; whatsapp: string; email: string; supportEmail: string;
  address: string; city: string; postalCode: string; country: string;
  linkedin: string; twitter: string; facebook: string; instagram: string;
  language: string; timezone: string; currency: string; aiPersonality: string; systemContext: string; knowledgeAgentName: string;
  autoConfirmAppointments: boolean;
  autoConfirmReservations: boolean;
  businessHours: Record<DayKey, { open: string; close: string; closed?: boolean }>;
  slotDurationMinutes: number;
  wavePhone: string;
  manualPaymentEmail: string;
  manualPaymentPhone: string;
}

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Lundi' }, { key: 'tue', label: 'Mardi' },
  { key: 'wed', label: 'Mercredi' }, { key: 'thu', label: 'Jeudi' },
  { key: 'fri', label: 'Vendredi' }, { key: 'sat', label: 'Samedi' },
  { key: 'sun', label: 'Dimanche' },
];
const DEFAULT_HOURS = {
  mon: { open: '09:00', close: '18:00' }, tue: { open: '09:00', close: '18:00' },
  wed: { open: '09:00', close: '18:00' }, thu: { open: '09:00', close: '18:00' },
  fri: { open: '09:00', close: '18:00' }, sat: { open: '09:00', close: '13:00' },
  sun: { open: '09:00', close: '18:00', closed: true },
} as const;

const INPUT_CLS = 'w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const LABEL_CLS = 'block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1';

function Field({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={INPUT_CLS} />
    </div>
  );
}

const EMPTY: CompanyForm = {
  name:'', slogan:'', description:'', sector:'', size:'', website:'', logoUrl:'',
  phone:'', whatsapp:'', email:'', supportEmail:'',
  address:'', city:'', postalCode:'', country:'',
  linkedin:'', twitter:'', facebook:'', instagram:'',
  language:'fr', timezone:'Europe/Paris', currency:'EUR', aiPersonality:'professional', systemContext:'', knowledgeAgentName:'',
  autoConfirmAppointments: false,
  autoConfirmReservations: false,
  businessHours: { ...DEFAULT_HOURS },
  slotDurationMinutes: 30,
  wavePhone: '',
  manualPaymentEmail: '',
  manualPaymentPhone: '',
};

export default function CompanySettingsPage() {
  const { company } = useAuthStore();
  const { t } = useLangStore();
  const [form, setForm] = useState<CompanyForm>(EMPTY);
  const [section, setSection] = useState<Section>('identity');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const fallbackName = useAuthStore.getState().company?.name ?? '';
    api.get<CompanyForm>('/company')
      .then(r => {
        if (cancelled) return;
        if (r.data && typeof r.data === 'object') {
          const d = r.data as unknown as Record<string, unknown>;
          const s = (d['settings'] as Record<string,string>) ?? {};
          const str = (k: string) => (typeof d[k] === 'string' ? d[k] as string : '') || '';
          setForm({
            name: str('name') || fallbackName, slogan: str('slogan'), description: str('description'),
            sector: str('sector'), size: str('size'), website: str('website'), logoUrl: str('logoUrl'),
            phone: str('phone'), whatsapp: str('whatsapp'), email: str('email'), supportEmail: str('supportEmail'),
            address: str('address'), city: str('city'), postalCode: str('postalCode'), country: str('country'),
            linkedin: str('linkedin'), twitter: str('twitter'), facebook: str('facebook'), instagram: str('instagram'),
            language: s['language'] || 'fr', timezone: s['timezone'] || 'Europe/Paris',
            currency: s['currency'] || 'EUR', aiPersonality: s['aiPersonality'] || 'professional',
            systemContext: s['systemContext'] || '', knowledgeAgentName: s['knowledgeAgentName'] || '',
            autoConfirmAppointments: (s as unknown as Record<string, unknown>)['autoConfirmAppointments'] === true,
            autoConfirmReservations: (s as unknown as Record<string, unknown>)['autoConfirmReservations'] === true,
            businessHours: {
              ...DEFAULT_HOURS,
              ...((s as unknown as Record<string, unknown>)['businessHours'] as CompanyForm['businessHours'] ?? {}),
            },
            slotDurationMinutes: Number((s as unknown as Record<string, unknown>)['slotDurationMinutes']) || 30,
            wavePhone: ((s as unknown as Record<string, unknown>)['wavePhone'] as string) ?? '',
            manualPaymentEmail: ((s as unknown as Record<string, unknown>)['manualPaymentEmail'] as string) ?? '',
            manualPaymentPhone: ((s as unknown as Record<string, unknown>)['manualPaymentPhone'] as string) ?? '',
          });
          if (d['logoUrl']) setLogoPreview(d['logoUrl'] as string);
          if (d['companyCode']) setCompanyCode(d['companyCode'] as string);
        }
      })
      .catch(() => { if (!cancelled) setForm(p => ({ ...p, name: fallbackName })); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback((key: keyof CompanyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value })), []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setLogoPreview(url);
      setForm(p => ({ ...p, logoUrl: url }));
    };
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/company', {
        ...form,
        settings: {
          language: form.language, timezone: form.timezone, currency: form.currency,
          aiPersonality: form.aiPersonality, systemContext: form.systemContext,
          knowledgeAgentName: form.knowledgeAgentName || null,
          autoConfirmAppointments: form.autoConfirmAppointments,
          autoConfirmReservations: form.autoConfirmReservations,
          businessHours: form.businessHours,
          slotDurationMinutes: form.slotDurationMinutes,
          wavePhone: form.wavePhone,
          manualPaymentEmail: form.manualPaymentEmail,
          manualPaymentPhone: form.manualPaymentPhone,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const f = (field: keyof CompanyForm) => ({ value: form[field] as string, onChange: set(field) });

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Paramètres entreprise</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Informations complètes de votre organisation</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader size={20} className="animate-spin text-gray-400" /></div>
      ) : (
        <form onSubmit={save} className="space-y-4 sm:space-y-5">
          {/* Section tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} type="button" onClick={() => setSection(s.id)}
                  className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    section === s.id
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}>
                  <Icon size={13} />
                  <span className="hidden xs:inline sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 sm:p-6 space-y-4">

            {/* IDENTITÉ */}
            {section === 'identity' && (
              <>
                {/* Logo */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors flex-shrink-0"
                    onClick={() => fileRef.current?.click()}>
                    {logoPreview
                      ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                      : <Image size={24} className="text-gray-300 dark:text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Logo de l'entreprise</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">PNG, JPG — recommandé 200x200px</p>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="mt-2 text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                      Changer le logo
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </div>
                  {form.logoUrl && !logoPreview?.startsWith('data:') && (
                    <div className="w-full sm:w-auto sm:ml-auto">
                      <input type="text" {...f('logoUrl')} placeholder="URL du logo"
                        className={`${INPUT_CLS} sm:w-64 text-xs`} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2"><Field label="Nom de l'entreprise *" {...f('name')} placeholder="Orlode Inc." /></div>
                  <div className="sm:col-span-2"><Field label="Slogan / Tagline" {...f('slogan')} placeholder="Votre intelligence d'entreprise" /></div>
                  <div>
                    <label className={LABEL_CLS}>Secteur d'activité</label>
                    <select value={form.sector} onChange={set('sector')} className={INPUT_CLS}>
                      <option value="">— Sélectionner —</option>
                      {SECTORS.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Taille de l'entreprise</label>
                    <select value={form.size} onChange={set('size')} className={INPUT_CLS}>
                      <option value="">— Sélectionner —</option>
                      {SIZES.map(s => <option key={s} value={s}>{s} employés</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={LABEL_CLS}>Description de l'activité</label>
                    <textarea rows={3} value={form.description} onChange={set('description')}
                      className={`${INPUT_CLS} resize-none`}
                      placeholder="Décrivez votre activité pour contextualiser l'IA..." />
                  </div>
                  <div className="sm:col-span-2"><Field label="Site web" {...f('website')} type="url" placeholder="https://votre-site.com" /></div>
                </div>
              </>
            )}

            {/* CONTACT */}
            {section === 'contact' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Téléphone principal" {...f('phone')} type="tel" placeholder="+33 1 23 45 67 89" />
                <Field label="WhatsApp" {...f('whatsapp')} type="tel" placeholder="+33 6 12 34 56 78" />
                <Field label="Email général" {...f('email')} type="email" placeholder="contact@entreprise.com" />
                <Field label="Email support" {...f('supportEmail')} type="email" placeholder="support@entreprise.com" />
              </div>
            )}

            {/* ADRESSE */}
            {section === 'address' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><Field label="Adresse" {...f('address')} placeholder="12 rue de la Paix" /></div>
                <Field label="Ville" {...f('city')} placeholder="Paris" />
                <Field label="Code postal" {...f('postalCode')} placeholder="75001" />
                <div className="sm:col-span-2"><Field label="Pays" {...f('country')} placeholder="France" /></div>
              </div>
            )}

            {/* RÉSEAUX SOCIAUX */}
            {section === 'social' && (
              <div className="grid grid-cols-1 gap-4">
                <Field label="LinkedIn" {...f('linkedin')} type="url" placeholder="https://linkedin.com/company/..." />
                <Field label="Twitter / X" {...f('twitter')} type="url" placeholder="https://twitter.com/..." />
                <Field label="Facebook" {...f('facebook')} type="url" placeholder="https://facebook.com/..." />
                <Field label="Instagram" {...f('instagram')} type="url" placeholder="https://instagram.com/..." />
              </div>
            )}

            {/* IA */}
            {section === 'ai' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Langue par défaut</label>
                  <select value={form.language} onChange={set('language')} className={INPUT_CLS}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="de">Deutsch</option>
                    <option value="ar">العربية</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Fuseau horaire</label>
                  <select value={form.timezone} onChange={set('timezone')} className={INPUT_CLS}>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Devise</label>
                  <select value={form.currency} onChange={set('currency')} className={INPUT_CLS}>
                    <option value="EUR">EUR (€) — Euro</option>
                    <option value="USD">USD ($) — Dollar US</option>
                    <option value="XOF">XOF (FCFA) — Franc CFA Ouest</option>
                    <option value="XAF">XAF (FCFA) — Franc CFA Central</option>
                    <option value="GBP">GBP (£) — Livre Sterling</option>
                    <option value="CHF">CHF (Fr) — Franc Suisse</option>
                    <option value="CAD">CAD ($) — Dollar Canadien</option>
                    <option value="MAD">MAD (DH) — Dirham Marocain</option>
                    <option value="TND">TND (DT) — Dinar Tunisien</option>
                    <option value="GNF">GNF (FG) — Franc Guineen</option>
                    <option value="NGN">NGN (₦) — Naira Nigerian</option>
                    <option value="KES">KES (KSh) — Shilling Kenyan</option>
                    <option value="ZAR">ZAR (R) — Rand Sud-Africain</option>
                    <option value="BRL">BRL (R$) — Real Bresilien</option>
                    <option value="INR">INR (₹) — Roupie Indienne</option>
                    <option value="JPY">JPY (¥) — Yen Japonais</option>
                    <option value="CNY">CNY (¥) — Yuan Chinois</option>
                    <option value="AED">AED (AED) — Dirham Emirats</option>
                    <option value="SAR">SAR (SAR) — Riyal Saoudien</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL_CLS}>Personnalité de l'IA</label>
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                    {PERSONALITIES.map(p => (
                      <button key={p.value} type="button" onClick={() => setForm(f => ({ ...f, aiPersonality: p.value }))}
                        className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-all text-left ${
                          form.aiPersonality === p.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL_CLS}>Nom du cerveau IA (Agent Knowledge)</label>
                  <input type="text" value={form.knowledgeAgentName} onChange={set('knowledgeAgentName')}
                    className={INPUT_CLS}
                    placeholder={`Ex: Jarvis, Nova, Atlas, ${form.name ? form.name + ' AI' : 'MonEntreprise AI'}...`} />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Nom personnalise pour votre agent Knowledge. Par defaut : "{form.name || 'Entreprise'} AI"
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL_CLS}>Contexte systeme (instructions permanentes)</label>
                  <textarea rows={4} value={form.systemContext} onChange={set('systemContext')}
                    className={`${INPUT_CLS} resize-none`}
                    placeholder="Ex: Notre entreprise est spécialisée dans... Toujours répondre en vouvoyant..." />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Inclus dans chaque prompt envoye a l'IA</p>
                </div>

                <div className="sm:col-span-2 p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Auto-confirmer les rendez-vous</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Si activé, les rendez-vous créés par le Clone (texte, WhatsApp, Telegram, voix) passent directement au statut <strong>confirmé</strong> sans validation humaine. Laissez désactivé si vous voulez garder un contrôle manuel.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.autoConfirmAppointments}
                      onClick={() => setForm(f => ({ ...f, autoConfirmAppointments: !f.autoConfirmAppointments }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                        form.autoConfirmAppointments ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                        form.autoConfirmAppointments ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Horaires d'ouverture</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Utilisés par le Clone pour refuser les RDV hors créneaux et empêcher les doubles réservations.</p>
                  </div>
                  <div className="space-y-2">
                    {DAYS.map(d => {
                      const cur = form.businessHours[d.key];
                      return (
                        <div key={d.key} className="flex items-center gap-3 text-sm">
                          <div className="w-24 font-medium text-gray-700 dark:text-gray-200">{d.label}</div>
                          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <input type="checkbox" checked={!cur.closed}
                              onChange={e => setForm(f => ({
                                ...f,
                                businessHours: { ...f.businessHours, [d.key]: { ...cur, closed: !e.target.checked } },
                              }))} />
                            Ouvert
                          </label>
                          <input type="time" value={cur.open} disabled={cur.closed}
                            onChange={e => setForm(f => ({
                              ...f,
                              businessHours: { ...f.businessHours, [d.key]: { ...cur, open: e.target.value } },
                            }))}
                            className="px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 disabled:opacity-40" />
                          <span className="text-gray-400">→</span>
                          <input type="time" value={cur.close} disabled={cur.closed}
                            onChange={e => setForm(f => ({
                              ...f,
                              businessHours: { ...f.businessHours, [d.key]: { ...cur, close: e.target.value } },
                            }))}
                            className="px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 disabled:opacity-40" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Durée d'un créneau</label>
                    <select value={form.slotDurationMinutes}
                      onChange={e => setForm(f => ({ ...f, slotDurationMinutes: Number(e.target.value) }))}
                      className="px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700">
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>1 heure</option>
                      <option value={90}>1h30</option>
                      <option value={120}>2 heures</option>
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2 p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Auto-confirmer les réservations</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Idem pour les réservations (tables, chambres, salles). Désactivé = l'admin valide chaque réservation.
                      </p>
                    </div>
                    <button type="button" role="switch" aria-checked={form.autoConfirmReservations}
                      onClick={() => setForm(f => ({ ...f, autoConfirmReservations: !f.autoConfirmReservations }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${form.autoConfirmReservations ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${form.autoConfirmReservations ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Méthodes de paiement (boutique Clone)</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Configurez au moins une méthode pour que le Clone puisse générer des liens de paiement.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Numéro Wave (Mobile Money)</label>
                    <input type="text" value={form.wavePhone}
                      onChange={e => setForm(f => ({ ...f, wavePhone: e.target.value }))}
                      placeholder="ex: +22507..." className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Email paiement manuel (virement, chèque…)</label>
                    <input type="email" value={form.manualPaymentEmail}
                      onChange={e => setForm(f => ({ ...f, manualPaymentEmail: e.target.value }))}
                      placeholder="billing@entreprise.com" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Téléphone contact paiement manuel</label>
                    <input type="text" value={form.manualPaymentPhone}
                      onChange={e => setForm(f => ({ ...f, manualPaymentPhone: e.target.value }))}
                      placeholder="+22507..." className={INPUT_CLS} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono text-center sm:text-left">{companyCode || company?.id || '—'}</p>
            <button type="submit" disabled={saving}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-all w-full sm:w-auto"
              style={{ background: saved ? '#16a34a' : 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
              {saving
                ? <><Loader size={14} className="animate-spin" /> Sauvegarde...</>
                : saved
                ? <><CheckCircle size={14} /> Sauvegardé !</>
                : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      )}

      {/* Demo data section */}
      <DemoDataSection />
    </div>
  );
}

function DemoDataSection() {
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<{ seeded: string[]; counts: Record<string, number> } | null>(null);

  const seed = async () => {
    setSeeding(true);
    setResult(null);
    try {
      const res = await api.post('/company/seed-demo');
      setResult(res.data ?? res.data);
    } catch {}
    setSeeding(false);
  };

  const clear = async () => {
    if (!confirm('Supprimer toutes les données de démo ?')) return;
    setClearing(true);
    setResult(null);
    try {
      await api.post('/company/clear-demo');
      setResult({ seeded: [], counts: {} });
    } catch {}
    setClearing(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-800 dark:text-white">Données de démonstration</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Chargez des données réalistes pour tester la plateforme (employés, factures, leads, tickets...)
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={seed} disabled={seeding || clearing}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-all"
          style={{ background: '#0055FF' }}>
          {seeding ? <><Loader size={14} className="animate-spin" /> Chargement...</> : 'Charger les données de démo'}
        </button>
        <button onClick={clear} disabled={seeding || clearing}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-all">
          {clearing ? <><Loader size={14} className="animate-spin" /> Suppression...</> : 'Supprimer les données de démo'}
        </button>
      </div>

      {result && result.seeded.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">Données chargées avec succès !</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(result.counts).map(([key, val]) => (
              <span key={key} className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full font-medium">
                {key}: {val}
              </span>
            ))}
          </div>
        </div>
      )}

      {result && result.seeded.length === 0 && !clearing && !seeding && (
        <p className="text-xs text-gray-500 dark:text-gray-400">Données de démo supprimées.</p>
      )}
    </div>
  );
}
