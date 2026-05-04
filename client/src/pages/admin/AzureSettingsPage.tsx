import { useEffect, useState } from 'react';
import { Cloud, FileText, Mic, Sparkles, CheckCircle2, XCircle, Loader2, Save, ExternalLink } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface AzureStatus { docIntel: boolean; speech: boolean; openai: boolean; }

export default function AzureSettingsPage() {
  const user = useAuthStore(s => s.user);
  const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.superAdmin;

  const [status, setStatus] = useState<AzureStatus>({ docIntel: false, speech: false, openai: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [docIntel, setDocIntel] = useState({ endpoint: '', key: '' });
  const [speech, setSpeech] = useState({ region: '', key: '' });
  const [openai, setOpenai] = useState({ endpoint: '', key: '', deployment: '' });

  const load = async () => {
    try {
      const r = await api.get('/azure/status');
      const raw = r.data as unknown as Record<string, unknown>;
      setStatus(((raw?.data ?? raw) as AzureStatus) ?? { docIntel: false, speech: false, openai: false });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async (key: 'docintel' | 'speech' | 'openai', body: Record<string, string>) => {
    setBusy(key); setFeedback(null);
    try {
      await api.post(`/azure/${key}`, body);
      setFeedback({ type: 'success', text: 'Credentials enregistrés.' });
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setBusy(null); }
  };

  if (!canManage) return <div className="p-8 text-center text-sm text-gray-600">Admins uniquement.</div>;
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-blue-100"><Cloud size={24} className="text-blue-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Azure AI Services</h1>
          <p className="text-sm text-gray-500">Branche ton compte Azure pour enrichir ton Clone avec des capacités Microsoft.</p>
        </div>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Document Intelligence */}
      <Section
        title="Document Intelligence"
        subtitle="OCR + extraction structurée — factures, contrats, pièces d'identité"
        icon={<FileText size={18} className="text-blue-600" />}
        active={status.docIntel}
        link="https://portal.azure.com/#create/Microsoft.CognitiveServicesFormRecognizer"
      >
        <Field label="Endpoint" value={docIntel.endpoint} onChange={v => setDocIntel(s => ({ ...s, endpoint: v }))}
          placeholder="https://<votre-ressource>.cognitiveservices.azure.com/" />
        <Field label="Clé API" type="password" value={docIntel.key} onChange={v => setDocIntel(s => ({ ...s, key: v }))}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        <button onClick={() => save('docintel', docIntel)} disabled={busy === 'docintel' || !docIntel.endpoint || !docIntel.key}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {busy === 'docintel' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer
        </button>
        <p className="text-xs text-gray-500 mt-2">
          🧠 Une fois configuré, ton Clone pourra appeler <code>extractInvoiceData</code> pour lire une facture envoyée en photo.
        </p>
      </Section>

      {/* Speech */}
      <Section
        title="Azure Speech"
        subtitle="STT / TTS — alternative à Gemini Live pour la voix"
        icon={<Mic size={18} className="text-indigo-600" />}
        active={status.speech}
        link="https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices"
      >
        <Field label="Région" value={speech.region} onChange={v => setSpeech(s => ({ ...s, region: v }))}
          placeholder="francecentral, westeurope, eastus…" />
        <Field label="Clé API" type="password" value={speech.key} onChange={v => setSpeech(s => ({ ...s, key: v }))}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        <button onClick={() => save('speech', speech)} disabled={busy === 'speech' || !speech.region || !speech.key}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
          {busy === 'speech' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer
        </button>
        <p className="text-xs text-amber-600 mt-2">
          ⏳ Intégration côté voice en préparation — credentials stockés, activation en Phase 2.
        </p>
      </Section>

      {/* Azure OpenAI */}
      <Section
        title="Azure OpenAI"
        subtitle="GPT-4 via ton tenant Azure — compliance EU / contrôle des données"
        icon={<Sparkles size={18} className="text-violet-600" />}
        active={status.openai}
        link="https://portal.azure.com/#create/Microsoft.CognitiveServicesOpenAI"
      >
        <Field label="Endpoint" value={openai.endpoint} onChange={v => setOpenai(s => ({ ...s, endpoint: v }))}
          placeholder="https://<votre-ressource>.openai.azure.com/" />
        <Field label="Clé API" type="password" value={openai.key} onChange={v => setOpenai(s => ({ ...s, key: v }))}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        <Field label="Deployment" value={openai.deployment} onChange={v => setOpenai(s => ({ ...s, deployment: v }))}
          placeholder="gpt-4 ou le nom de ton deployment" />
        <button onClick={() => save('openai', openai)} disabled={busy === 'openai' || !openai.endpoint || !openai.key}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50">
          {busy === 'openai' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer
        </button>
        <p className="text-xs text-amber-600 mt-2">
          ⏳ Basculement LLM vers Azure OpenAI en Phase 2 — credentials stockés pour l'instant.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, icon, active, link, children }: {
  title: string; subtitle: string; icon: React.ReactNode; active: boolean; link?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {active ? 'Configuré' : 'Non configuré'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          {link && (
            <a href={link} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
              Créer la ressource sur Azure <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}
