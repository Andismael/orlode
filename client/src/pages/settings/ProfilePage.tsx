import { useEffect, useRef, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import { Camera, CheckCircle2, Loader2, Shield, Mail, Phone, Briefcase, MapPin, Globe, User, Save, KeyRound, Copy, Check } from 'lucide-react';
import api from '@/services/api';

const LANGUAGES = [
  { value: 'fr', label: '🇫🇷 Français' }, { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' }, { value: 'ar', label: '🇸🇦 العربية' },
];

const PERSONALITIES = [
  { value: 'professional', label: 'Professionnel' },
  { value: 'friendly', label: 'Amical' },
  { value: 'concise', label: 'Concis' },
  { value: 'detailed', label: 'Détaillé' },
];

interface ProfileForm {
  displayName: string;
  title: string;
  department: string;
  phone: string;
  bio: string;
  location: string;
  website: string;
  language: string;
  aiPersonality: string;
  photoURL: string;
}

const EMPTY: ProfileForm = {
  displayName: '',
  title: '', department: '', phone: '', bio: '',
  location: '', website: '',
  language: 'fr', aiPersonality: 'professional',
  photoURL: '',
};

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const { t } = useLangStore();
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myCode, setMyCode] = useState<{ employeeCode: string | null; codeActive: boolean } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data() ?? {};
        setForm({
          displayName:   (data['displayName'] as string) || user.displayName || '',
          title:         (data['title']       as string) || '',
          department:    (data['department']  as string) || '',
          phone:         (data['phone']       as string) || '',
          bio:           (data['bio']         as string) || '',
          location:      (data['location']    as string) || '',
          website:       (data['website']     as string) || '',
          language:      (data['language']    as string) || 'fr',
          aiPersonality: (data['aiPersonality'] as string) || 'professional',
          photoURL:      (data['photoURL']    as string) || user.photoURL || '',
        });
      } finally { setLoading(false); }
    })();
    // Load my employee code
    api.get('/reception/my-code').then(r => {
      const raw = r.data as unknown as Record<string, unknown>;
      const d = (raw?.data ?? raw) as { employeeCode: string | null; codeActive: boolean };
      setMyCode(d);
    }).catch(() => { /* ignore */ });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyCode = () => {
    if (myCode?.employeeCode) {
      navigator.clipboard.writeText(myCode.employeeCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!user?.uid || !auth.currentUser) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image trop grande (max 5 Mo).'); return; }
    setUploading(true); setError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${user.uid}/photo-${Date.now()}.${ext}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      await updateProfile(auth.currentUser, { photoURL: url });
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      setForm(f => ({ ...f, photoURL: url }));
      setUser({ ...user, photoURL: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload échoué');
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!user?.uid || !auth.currentUser) return;
    setSaving(true); setError(null);
    try {
      if (form.displayName && form.displayName !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: form.displayName });
      }
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: form.displayName, title: form.title, department: form.department,
        phone: form.phone, bio: form.bio, location: form.location, website: form.website,
        language: form.language, aiPersonality: form.aiPersonality,
        updatedAt: new Date(),
      });
      setUser({ ...user, displayName: form.displayName });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900">
      {/* ── Cover with gradient + avatar ─── */}
      <div className="relative h-40 md:h-52 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4), transparent 50%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.2), transparent 50%)',
        }} />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-20 md:-mt-24 pb-10 relative">
        {/* Avatar + header card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-white/50 dark:border-gray-700 p-5 md:p-7">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6">
            {/* Avatar with upload */}
            <div className="relative -mt-16 md:-mt-20">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white text-4xl font-bold ring-4 ring-white dark:ring-gray-800 shadow-lg overflow-hidden">
                {form.photoURL ? (
                  <img src={form.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  (form.displayName || user?.email || 'U').slice(0, 1).toUpperCase()
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 size={28} className="animate-spin text-white" />
                  </div>
                )}
              </div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                title="Changer la photo de profil"
                className="absolute bottom-2 right-2 w-9 h-9 rounded-xl bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50">
                <Camera size={14} className="text-gray-700" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
                {form.displayName || user?.email?.split('@')[0] || 'Mon profil'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {user?.role && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 capitalize">
                    <Shield size={10} /> {user.role}
                  </span>
                )}
                {user?.superAdmin && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    ⚡ Super admin
                  </span>
                )}
                {form.title && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    <Briefcase size={10} /> {form.title}
                  </span>
                )}
              </div>
            </div>

            <button onClick={save} disabled={saving}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              style={{ background: saved ? '#16a34a' : 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
              {saving ? <Loader2 size={14} className="animate-spin" />
                : saved ? <CheckCircle2 size={14} />
                : <Save size={14} />}
              {saving ? 'Sauvegarde...' : saved ? 'Enregistré' : 'Enregistrer'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* ── My Code ─── */}
        {myCode && myCode.employeeCode && (
          <div className="mt-6 bg-gradient-to-br from-violet-50 via-blue-50 to-indigo-50 dark:from-violet-900/30 dark:via-blue-900/30 dark:to-indigo-900/30 rounded-2xl border border-violet-200 dark:border-violet-700 p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center shadow-md">
                <KeyRound size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase font-bold text-violet-700 dark:text-violet-300 tracking-wide mb-1">Mon code employé</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Utilise ce code au kiosk d'accueil pour pointer et accéder aux fonctionnalités entreprise.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="font-mono text-3xl font-bold tracking-[0.2em] text-violet-900 dark:text-violet-100 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-violet-200 dark:border-violet-600 shadow-sm">
                  {myCode.employeeCode}
                </div>
                <button onClick={copyCode}
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors">
                  {codeCopied ? <Check size={14} /> : <Copy size={14} />}
                  {codeCopied ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>
            {!myCode.codeActive && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-3 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                ⚠️ Code actuellement désactivé par un administrateur.
              </p>
            )}
          </div>
        )}

        {myCode && !myCode.employeeCode && (
          <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
            <KeyRound size={18} className="text-gray-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Aucun code employé pour le moment. Contacte ton administrateur pour en générer un.
            </p>
          </div>
        )}

        {/* ── Form sections ─── */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Identity */}
          <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">
              <User size={16} /> Identité
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field icon={<User size={13} />} label="Nom complet" value={form.displayName}
                onChange={v => setForm(f => ({ ...f, displayName: v }))} placeholder="Adelin Nguessan" />
              <Field icon={<Mail size={13} />} label="Email" value={user?.email ?? ''} disabled />
              <Field icon={<Briefcase size={13} />} label="Fonction" value={form.title}
                onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="CEO, Directeur, …" />
              <Field label="Département" value={form.department}
                onChange={v => setForm(f => ({ ...f, department: v }))} placeholder="Direction, IT, RH, …" />
              <Field icon={<Phone size={13} />} label="Téléphone" value={form.phone}
                onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+225 07 …" />
              <Field icon={<MapPin size={13} />} label="Localisation" value={form.location}
                onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="Abidjan, Côte d'Ivoire" />
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Bio</label>
                <textarea rows={3} value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Quelques lignes sur vous…"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <Field icon={<Globe size={13} />} label="Site web" value={form.website}
                onChange={v => setForm(f => ({ ...f, website: v }))} placeholder="https://…" />
            </div>
          </div>

          {/* Preferences */}
          <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">
              <Globe size={16} /> Préférences
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">{`${t('language')}`}</label>
                <select value={form.language}
                  onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Personnalité IA</label>
                <select value={form.aiPersonality}
                  onChange={e => setForm(f => ({ ...f, aiPersonality: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PERSONALITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, value, onChange, placeholder, disabled }: {
  icon?: React.ReactNode; label: string; value: string;
  onChange?: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
        {icon}{label}
      </label>
      <input type="text" value={value} onChange={e => onChange?.(e.target.value)} disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} />
    </div>
  );
}
