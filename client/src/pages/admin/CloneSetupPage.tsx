/**
 * CloneSetupPage — Configure the company's digital twin
 * Personality, tone, rules, products, branding, leads
 */
import { useEffect, useState } from 'react';
import { Loader2, Save, Eye, Users, Copy, CheckCircle, ExternalLink, MessageSquare, Sparkles, Zap } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface CloneConfig {
  name: string; role: string; tone: string; personality: string; language: string;
  greeting: string; fallbackMessage: string; canDo: string[]; cantDo: string[];
  products: string[]; uniqueValue: string; pricing: string;
  primaryColor: string; accentColor: string;
  maxMessagesPerSession: number; captureLeads: boolean; autoCreateTickets: boolean; connectToOrchestrator: boolean;
}

interface Lead { id: string; name: string; email: string; phone: string; channel: string; firstMessage: string; capturedAt: string }
interface Stats { totalLeads: number; byChannel: Record<string, number>; avgMessagesPerSession: number }

const ROLES = [
  { id: 'general', label: 'Assistant polyvalent', desc: 'Repond a tout' },
  { id: 'sales', label: 'Commercial', desc: 'Objectif: convertir' },
  { id: 'support', label: 'Support client', desc: 'Objectif: resoudre' },
  { id: 'reception', label: 'Accueil', desc: 'Objectif: orienter' },
  { id: 'guide', label: 'Guide', desc: 'Objectif: informer' },
];

const TONES = ['professional', 'friendly', 'dynamic', 'expert', 'casual'];

export default function CloneSetupPage() {
  const { user } = useAuthStore();
  const companyId = user?.companyId ?? '';
  const [config, setConfig] = useState<CloneConfig | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'setup' | 'channels' | 'leads' | 'preview'>('setup');
  const [copied, setCopied] = useState(false);
  const [channels, setChannels] = useState<Record<string, { enabled: boolean; configured: boolean; info: string }>>({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/clone/config').then(r => {
        const d = r.data as CloneConfig | { data?: CloneConfig };
        setConfig(d && 'name' in d ? d as CloneConfig : (d as { data?: CloneConfig })?.data ?? null);
      }),
      api.get('/clone/config/leads').then(r => {
        const d = r.data; setLeads(Array.isArray(d) ? d : (d as { data?: Lead[] })?.data ?? []);
      }),
      api.get('/clone/config/channels').then(r => {
        const d = r.data; setChannels(typeof d === 'object' && d ? d as Record<string, { enabled: boolean; configured: boolean; info: string }> : {});
      }).catch(() => {}),
      api.get('/clone/config/stats').then(r => {
        const d = r.data as Stats | { data?: Stats };
        setStats(d && 'totalLeads' in d ? d as Stats : (d as { data?: Stats })?.data ?? null);
      }),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!config) return; setSaving(true); setSaved(false);
    await api.patch('/clone/config', config).catch(() => {});
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const update = (field: string, value: unknown) => setConfig(c => c ? { ...c, [field]: value } : c);
  const updateArray = (field: string, value: string) => update(field, value.split('\n').filter(Boolean));

  const cloneUrl = `${window.location.origin}/clone/${companyId}`;
  const copyUrl = () => { navigator.clipboard.writeText(cloneUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (loading || !config) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"><Sparkles size={20} className="text-white" /></div>
          <div><h1 className="text-xl font-bold text-gray-900">Clone de l'entreprise</h1><p className="text-sm text-gray-500">Votre jumeau numerique — la voix de votre entreprise</p></div>
        </div>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saving ? 'Sauvegarde...' : saved ? 'Sauvegarde !' : 'Sauvegarder'}
        </button>
      </div>

      {/* Clone URL */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4 flex items-center gap-3">
        <Zap size={16} className="text-violet-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-violet-600 font-medium">Lien public du clone</p>
          <p className="text-sm text-violet-800 font-mono truncate">{cloneUrl}</p>
        </div>
        <button onClick={copyUrl} className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-1">
          {copied ? <CheckCircle size={12} /> : <Copy size={12} />} {copied ? 'Copie !' : 'Copier'}
        </button>
        <a href={cloneUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-violet-100 rounded-lg"><ExternalLink size={14} className="text-violet-600" /></a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'setup', label: 'Configuration', icon: Sparkles },
          { id: 'channels', label: 'Canaux', icon: Zap },
          { id: 'leads', label: `Leads (${leads.length})`, icon: Users },
          { id: 'preview', label: 'Apercu', icon: Eye },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg ${tab === t.id ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500'}`}><t.icon size={13} /> {t.label}</button>
        ))}
      </div>

      {/* SETUP */}
      {tab === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Identity */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Identite</h3>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom du clone</label><input value={config.name} onChange={e => update('name', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="Sofia, Max, Assistant..." /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Role</label>
              <div className="grid grid-cols-2 gap-2">{ROLES.map(r => (
                <button key={r.id} onClick={() => update('role', r.id)} className={`text-left p-2 rounded-lg border text-xs ${config.role === r.id ? 'border-violet-300 bg-violet-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <p className="font-medium">{r.label}</p><p className="text-gray-400">{r.desc}</p>
                </button>
              ))}</div>
            </div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Langue</label><select value={config.language} onChange={e => update('language', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"><option value="fr">Francais</option><option value="en">English</option><option value="auto">Auto-detect</option></select></div>
          </div>

          {/* Personality */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Personnalite</h3>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Ton</label>
              <div className="flex flex-wrap gap-2">{TONES.map(t => (
                <button key={t} onClick={() => update('tone', t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${config.tone === t ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600'}`}>{t}</button>
              ))}</div>
            </div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Personnalite (description libre)</label><input value={config.personality} onChange={e => update('personality', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="chaleureux, pedagogue, commercial" /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Message d'accueil</label><textarea value={config.greeting} onChange={e => update('greeting', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" rows={2} /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Message fallback (quand il ne peut pas aider)</label><textarea value={config.fallbackMessage} onChange={e => update('fallbackMessage', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" rows={2} /></div>
          </div>

          {/* Rules */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Regles</h3>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Ce qu'il PEUT faire (1 par ligne)</label><textarea value={config.canDo.join('\n')} onChange={e => updateArray('canDo', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" rows={3} /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Ce qu'il NE PEUT PAS faire (1 par ligne)</label><textarea value={config.cantDo.join('\n')} onChange={e => updateArray('cantDo', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" rows={3} /></div>
          </div>

          {/* Products */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Offre</h3>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Produits/Services (1 par ligne)</label><textarea value={config.products.join('\n')} onChange={e => updateArray('products', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" rows={3} placeholder="Consulting\nDeveloppement\nFormation" /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Proposition de valeur</label><input value={config.uniqueValue} onChange={e => update('uniqueValue', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Tarification</label><input value={config.pricing} onChange={e => update('pricing', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
          </div>

          {/* Branding */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Apparence</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Couleur principale</label><input type="color" value={config.primaryColor} onChange={e => update('primaryColor', e.target.value)} className="w-full h-10 rounded-lg border border-gray-200 cursor-pointer" /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Couleur accent</label><input type="color" value={config.accentColor} onChange={e => update('accentColor', e.target.value)} className="w-full h-10 rounded-lg border border-gray-200 cursor-pointer" /></div>
            </div>
          </div>

          {/* Advanced */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Avance</h3>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Max messages/session</label><input type="number" value={config.maxMessagesPerSession} onChange={e => update('maxMessagesPerSession', parseInt(e.target.value) || 50)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={config.captureLeads} onChange={e => update('captureLeads', e.target.checked)} className="rounded" /> Capturer les leads automatiquement</label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={config.autoCreateTickets} onChange={e => update('autoCreateTickets', e.target.checked)} className="rounded" /> Creer des tickets support automatiquement</label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={config.connectToOrchestrator} onChange={e => update('connectToOrchestrator', e.target.checked)} className="rounded" /> Connecter aux agents internes (devis, RDV, etc.)</label>
            </div>
          </div>
        </div>
      )}

      {/* CHANNELS */}
      {tab === 'channels' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Votre clone peut repondre sur tous ces canaux. Chaque message entrant passe par le meme cerveau IA.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'web', label: 'Web Chat', desc: 'Page publique + widget flottant', icon: '🌐', color: 'bg-blue-50 border-blue-200', webhookUrl: `${window.location.origin}/clone/${companyId}` },
              { id: 'voice', label: 'Voice (Gemini Live)', desc: 'Assistant vocal temps reel', icon: '🎤', color: 'bg-violet-50 border-violet-200', webhookUrl: `${window.location.origin}/clone/${companyId}/voice` },
              { id: 'whatsapp', label: 'WhatsApp', desc: 'Messages WhatsApp Business', icon: '💬', color: 'bg-green-50 border-green-200', webhookUrl: `${window.location.origin}/api/clone/${companyId}/whatsapp` },
              { id: 'telegram', label: 'Telegram', desc: 'Bot Telegram', icon: '✈️', color: 'bg-blue-50 border-blue-200', webhookUrl: `${window.location.origin}/api/clone/${companyId}/telegram` },
              { id: 'email', label: 'Email', desc: 'Repondre aux emails entrants', icon: '📧', color: 'bg-pink-50 border-pink-200', webhookUrl: `${window.location.origin}/api/clone/${companyId}/email` },
            ].map(ch => {
              const status = channels[ch.id];
              return (
                <div key={ch.id} className={`rounded-xl border p-5 ${ch.color}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{ch.icon}</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-900">{ch.label}</h3>
                      <p className="text-xs text-gray-500">{ch.desc}</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${status?.configured ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-medium ${status?.configured ? 'text-green-700' : 'text-gray-500'}`}>{status?.configured ? 'Configure' : 'Non configure'}</span>
                      {status?.info && <span className="text-gray-400">— {status.info}</span>}
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-xs text-gray-400 mb-1">Webhook URL :</p>
                      <code className="text-xs text-gray-600 break-all">{ch.webhookUrl}</code>
                    </div>
                    {ch.id === 'telegram' && (
                      <p className="text-xs text-gray-400">Configurez le webhook dans @BotFather : <code>setWebhook</code> vers l'URL ci-dessus</p>
                    )}
                    {ch.id === 'whatsapp' && (
                      <p className="text-xs text-gray-400">Configurez le webhook Meta Business dans Admin &gt; WhatsApp</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-purple-800 mb-2">Comment ca marche</h3>
            <div className="text-xs text-purple-700 space-y-1">
              <p>1. Un client envoie un message (WhatsApp, Telegram, ou email)</p>
              <p>2. Le webhook recoit le message et le transmet au clone</p>
              <p>3. Le clone genere une reponse avec la personnalite de votre entreprise</p>
              <p>4. La reponse est envoyee automatiquement sur le meme canal</p>
              <p>5. Le lead est capture et visible dans l'onglet "Leads"</p>
            </div>
          </div>
        </div>
      )}

      {/* LEADS */}
      {tab === 'leads' && (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-violet-50 rounded-xl p-4"><p className="text-2xl font-bold text-violet-700">{stats.totalLeads}</p><p className="text-xs text-gray-500">Leads captures</p></div>
              <div className="bg-blue-50 rounded-xl p-4"><p className="text-2xl font-bold text-blue-700">{stats.avgMessagesPerSession}</p><p className="text-xs text-gray-500">Messages moy./session</p></div>
              <div className="bg-green-50 rounded-xl p-4"><p className="text-sm font-bold text-green-700">{Object.entries(stats.byChannel).map(([k, v]) => `${k}: ${v}`).join(', ') || 'Aucun'}</p><p className="text-xs text-gray-500">Par canal</p></div>
            </div>
          )}
          {leads.length === 0 ? <div className="text-center py-12 text-sm text-gray-400">Aucun lead capture par le clone.</div> : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100"><tr>{['Nom', 'Email', 'Telephone', 'Canal', 'Message', 'Date'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{l.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{l.email || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{l.phone || '—'}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{l.channel}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-48 truncate">{l.firstMessage}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{l.capturedAt ? new Date(l.capturedAt).toLocaleDateString('fr-FR') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PREVIEW */}
      {tab === 'preview' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: '600px' }}>
          <iframe src={cloneUrl} className="w-full h-full border-0" title="Clone Preview" />
        </div>
      )}
    </div>
  );
}
