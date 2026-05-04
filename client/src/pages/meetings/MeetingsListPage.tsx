/**
 * MeetingsListPage — Meeting management with create, transcription, stats
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import {
  Video, Plus, Users, Clock, CheckCircle, Radio, Loader2, Trash2, X,
  Upload, Mic, FileText, Calendar,
} from 'lucide-react';

interface Meeting {
  id: string; title: string; scheduledAt: string; participants: string[];
  status: 'scheduled' | 'live' | 'completed'; type: string; aiEnabled: boolean;
  description?: string; duration?: number;
}

export default function MeetingsListPage() {
  const { t } = useLangStore();
  const [tab, setTab] = useState('all');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTranscribe, setShowTranscribe] = useState(false);
  const [form, setForm] = useState({ title: '', scheduledAt: '', description: '', participants: '', type: 'internal', aiEnabled: true });
  const [submitting, setSubmitting] = useState(false);
  const [transcribeFile, setTranscribeFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeMeetingId, setTranscribeMeetingId] = useState('');

  useEffect(() => { load(); }, []);

  const load = () => {
    setLoading(true);
    api.get('/meetings').then(r => setMeetings((r.data ?? (Array.isArray(r.data) ? r.data : [])) as Meeting[]))
      .catch(() => setMeetings([])).finally(() => setLoading(false));
  };

  const handleCreate = async () => {
    if (!form.title) return;
    setSubmitting(true);
    try {
      await api.post('/meetings', {
        ...form,
        participants: form.participants.split(',').map(p => p.trim()).filter(Boolean),
      });
      setShowCreate(false);
      setForm({ title: '', scheduledAt: '', description: '', participants: '', type: 'internal', aiEnabled: true });
      load();
    } catch {} finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette reunion ?')) return;
    await api.delete(`/meetings/${id}`).catch(() => {});
    setMeetings(prev => prev.filter(m => m.id !== id));
  };

  const handleTranscribe = async () => {
    if (!transcribeFile || !transcribeMeetingId) return;
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', transcribeFile);
      await api.post(`/meetings/${transcribeMeetingId}/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowTranscribe(false);
      setTranscribeFile(null);
      load();
    } catch {} finally { setTranscribing(false); }
  };

  const filtered = meetings.filter(m => {
    if (tab === 'all') return true;
    if (tab === 'today') {
      const today = new Date().toISOString().split('T')[0];
      return m.scheduledAt?.startsWith(today);
    }
    if (tab === 'upcoming') return m.status === 'scheduled';
    if (tab === 'completed') return m.status === 'completed';
    if (tab === 'live') return m.status === 'live';
    return true;
  });

  const liveCount = meetings.filter(m => m.status === 'live').length;
  const todayCount = meetings.filter(m => m.scheduledAt?.startsWith(new Date().toISOString().split('T')[0])).length;
  const completedCount = meetings.filter(m => m.status === 'completed').length;

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('meetings_page')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerez et analysez vos reunions avec l'IA</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTranscribe(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
            <Upload size={14} /> Transcrire
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-xl hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
            <Plus size={14} /> Nouvelle reunion
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-xl px-4 py-3"><div className="text-lg font-extrabold text-blue-700">{meetings.length}</div><div className="text-xs text-gray-500">{`${t('total')}`}</div></div>
        <div className="bg-green-50 rounded-xl px-4 py-3"><div className="text-lg font-extrabold text-green-700">{todayCount}</div><div className="text-xs text-gray-500">Aujourd'hui</div></div>
        {liveCount > 0 && <div className="bg-red-50 rounded-xl px-4 py-3"><div className="text-lg font-extrabold text-red-600">{liveCount}</div><div className="text-xs text-gray-500">{`${t('in_progress')}`}</div></div>}
        <div className="bg-gray-50 rounded-xl px-4 py-3"><div className="text-lg font-extrabold text-gray-700">{completedCount}</div><div className="text-xs text-gray-500">{`${t('ended')}`}</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[{k:'all',l:'Toutes'},{k:'today',l:"Aujourd'hui"},{k:'upcoming',l:'A venir'},{k:'completed',l:'Terminees'},{k:'live',l:'En direct'}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === t.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={24} /></div> :
       filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Video size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm">{`${t('no_data')}`}</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                m.status === 'live' ? 'bg-red-100' : m.status === 'completed' ? 'bg-green-100' : 'bg-blue-100'
              }`}>
                <Video size={18} className={m.status === 'live' ? 'text-red-600' : m.status === 'completed' ? 'text-green-600' : 'text-blue-600'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm">{m.title}</p>
                  {m.status === 'live' && <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium"><Radio size={10} /> Live</span>}
                  {m.status === 'completed' && <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full"><CheckCircle size={10} /> Terminee</span>}
                  {m.status === 'scheduled' && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{`${t('scheduled')}`}</span>}
                  {m.aiEnabled && <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">AI</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {m.scheduledAt && <span className="flex items-center gap-1"><Clock size={11} /> {new Date(m.scheduledAt).toLocaleString('fr-FR')}</span>}
                  {m.participants?.length > 0 && <span className="flex items-center gap-1"><Users size={11} /> {m.participants.length}</span>}
                  {m.type && <span>{m.type === 'internal' ? t('internal') : m.type === 'client' ? t('client') : m.type}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {m.status === 'completed' && <Link to={`/meetings/${m.id}/summary`} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"><FileText size={12} /> Resume</Link>}
                <Link to={`/meetings/${m.id}`} className={`text-xs px-3 py-1.5 rounded-lg text-white ${m.status === 'live' ? 'bg-red-500' : 'bg-blue-600'}`}>
                  {m.status === 'live' ? 'Rejoindre' : 'Ouvrir'}
                </Link>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('new_meeting')}</h2>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Titre *</label>
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Point hebdomadaire..." /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">{`${t('date_time')}`}</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({...form, scheduledAt: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Participants (emails, separes par virgule)</label>
                <input value={form.participants} onChange={e => setForm({...form, participants: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="jean@acme.com, marie@acme.com" /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">{`${t('description')}`}</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {['internal','client','external'].map(t => (
                    <button key={t} type="button" onClick={() => setForm({...form, type: t})}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${form.type === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {t === 'internal' ? 'Interne' : t === 'client' ? 'Client' : 'Externe'}
                    </button>
                  ))}
                </div>
                <button onClick={() => setForm({...form, aiEnabled: !form.aiEnabled})}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${form.aiEnabled ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <Mic size={12} /> AI {form.aiEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">{`${t('cancel')}`}</button>
              <button onClick={handleCreate} disabled={submitting || !form.title}
                className="px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
                {submitting ? <Loader2 className="animate-spin" size={14} /> : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transcribe Modal */}
      {showTranscribe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTranscribe(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Mic size={18} className="text-violet-500" /> Transcrire un enregistrement</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{`${t('meetings')}`}</label>
                <select value={transcribeMeetingId} onChange={e => setTranscribeMeetingId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">{`${t('search')}`}</option>
                  {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Fichier audio/video</label>
                <input type="file" accept="audio/*,video/*" onChange={e => setTranscribeFile(e.target.files?.[0] ?? null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowTranscribe(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">{`${t('cancel')}`}</button>
              <button onClick={handleTranscribe} disabled={transcribing || !transcribeFile || !transcribeMeetingId}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                {transcribing ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                {transcribing ? 'Transcription...' : 'Transcrire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
