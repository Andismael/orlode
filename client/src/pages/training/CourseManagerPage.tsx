/**
 * CourseManagerPage — ADMIN dashboard PRO
 * Create courses/quizzes (text + multimedia/video), assign, view team stats, AI generation
 */
import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, X, Sparkles, GraduationCap, FileQuestion, Users, Award, TrendingUp, Video, Youtube, Link2, FileText, Layers, Upload } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import VideoUploader from '@/components/training/VideoUploader';

interface Course { id: string; title: string; category: string; difficulty: string; duration: string; enrolledCount: number; completedCount: number; status: string; isMultimedia?: boolean }
interface Quiz { id: string; topic: string; difficulty: string; questions: unknown[]; courseId: string }
interface Stats { totalCourses: number; totalQuizzes: number; totalEnrolled: number; totalCompleted: number; avgCompletionPct: number; totalCertificates: number; byCategory: { category: string; count: number }[] }

const CATEGORIES = ['onboarding', 'security', 'technical', 'soft_skills', 'compliance', 'product', 'management', 'other'];

export default function CourseManagerPage() {
  const { t } = useLangStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'courses' | 'quizzes'>('courses');
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<'course' | 'quiz' | 'video'>('course');
  const [form, setForm] = useState({ title: '', topic: '', category: 'other', difficulty: 'intermediate', duration: '1h' });
  const [videoUrls, setVideoUrls] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Multimedia module builder state
  const [modules, setModules] = useState<{ title: string; type: string; videoUrl: string; content: string }[]>([]);
  const [showModuleBuilder, setShowModuleBuilder] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Course[]>('/training/courses').then(r => setCourses(Array.isArray(r.data) ? r.data : (r.data as { data?: Course[] })?.data ?? [])),
      api.get<Quiz[]>('/training/quizzes').then(r => setQuizzes(Array.isArray(r.data) ? r.data : (r.data as { data?: Quiz[] })?.data ?? [])),
      api.get<Stats>('/training/stats').then(r => setStats((r.data as { data?: Stats })?.data ?? r.data ?? null)),
    ]).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.title && !form.topic) return; setSubmitting(true);
    try {
      if (createType === 'quiz') {
        await api.post('/training/quizzes', { topic: form.topic || form.title, difficulty: form.difficulty });
      } else {
        // Build modules with multimedia content blocks
        const courseModules = modules.length > 0 ? modules.map((m, i) => {
          const contentBlocks: { type: string; value?: string; url?: string; label?: string }[] = [];
          if (m.videoUrl) contentBlocks.push({ type: 'video', url: m.videoUrl, label: m.title });
          if (m.content) contentBlocks.push({ type: 'text', value: m.content });
          return { title: m.title, type: m.type || 'text', content: m.content, videoUrl: m.videoUrl || null, contentBlocks, order: i, duration: '15min' };
        }) : [];
        await api.post('/training/courses', { ...form, modules: courseModules, isMultimedia: modules.some(m => m.videoUrl) });
      }
      resetForm(); load();
    } catch {} finally { setSubmitting(false); }
  };

  const handleGenerate = async () => {
    if (!form.topic && !form.title) return; setGenerating(true);
    try {
      await api.post('/training/courses/generate', { topic: form.topic || form.title, title: form.title || form.topic, difficulty: form.difficulty, duration: form.duration });
      resetForm(); load();
    } catch {} finally { setGenerating(false); }
  };

  const handleGenerateVideo = async () => {
    if (!form.topic && !form.title) return; setGenerating(true);
    try {
      const urls = videoUrls.filter(u => u.trim());
      await api.post('/training/courses/generate-video', {
        topic: form.topic || form.title, title: form.title || form.topic,
        difficulty: form.difficulty, category: form.category,
        moduleCount: Math.max(urls.length, 4),
        youtubeUrls: urls,
      });
      resetForm(); load();
    } catch {} finally { setGenerating(false); }
  };

  const handleDelete = async (type: 'course' | 'quiz', id: string) => {
    if (!confirm('Supprimer ?')) return;
    if (type === 'course') await api.delete(`/training/courses/${id}`).catch(() => {});
    else await api.delete(`/training/quizzes/${id}`).catch(() => {});
    load();
  };

  const resetForm = () => {
    setShowCreate(false);
    setForm({ title: '', topic: '', category: 'other', difficulty: 'intermediate', duration: '1h' });
    setVideoUrls(['']);
    setModules([]);
    setShowModuleBuilder(false);
  };

  const addModule = () => setModules([...modules, { title: '', type: 'text', videoUrl: '', content: '' }]);
  const updateModule = (i: number, field: string, value: string) => {
    const updated = [...modules];
    (updated[i] as Record<string, string>)[field] = value;
    if (field === 'videoUrl' && value) updated[i].type = 'video';
    setModules(updated);
  };
  const removeModule = (i: number) => setModules(modules.filter((_, j) => j !== i));

  const addVideoUrl = () => setVideoUrls([...videoUrls, '']);
  const updateVideoUrl = (i: number, v: string) => { const u = [...videoUrls]; u[i] = v; setVideoUrls(u); };
  const removeVideoUrl = (i: number) => setVideoUrls(videoUrls.filter((_, j) => j !== i));

  const kpis = stats ? [
    { label: 'Cours', value: stats.totalCourses, icon: GraduationCap, color: 'text-blue-600 bg-blue-50' },
    { label: 'Quiz', value: stats.totalQuizzes, icon: FileQuestion, color: 'text-purple-600 bg-purple-50' },
    { label: 'Inscrits', value: stats.totalEnrolled, icon: Users, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Termines', value: stats.totalCompleted, icon: Award, color: 'text-green-600 bg-green-50' },
    { label: 'Completion moy.', value: `${stats.avgCompletionPct}%`, icon: TrendingUp, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Certificats', value: stats.totalCertificates, icon: Award, color: 'text-yellow-600 bg-yellow-50' },
  ] : [];

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Gestion Formation</h1><p className="text-sm text-gray-500">Creer, assigner et suivre — cours texte, video et multimedia</p></div>
        <button onClick={() => { setShowCreate(true); setCreateType('course'); }} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}><Plus size={14} /> Creer</button>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${k.color}`}><k.icon size={14} /></div>
                <p className="text-lg font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            <button onClick={() => setTab('courses')} className={`px-4 py-1.5 text-sm rounded-lg ${tab === 'courses' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500'}`}>Cours ({courses.length})</button>
            <button onClick={() => setTab('quizzes')} className={`px-4 py-1.5 text-sm rounded-lg ${tab === 'quizzes' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500'}`}>Quiz ({quizzes.length})</button>
          </div>

          {/* List */}
          {tab === 'courses' ? (
            courses.length === 0 ? <div className="text-center py-12 text-sm text-gray-400">Aucun cours.</div> : (
              <div className="space-y-2">
                {courses.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.isMultimedia ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      {c.isMultimedia ? <Video size={16} /> : <GraduationCap size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{c.title}</span>
                        {c.isMultimedia && <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">Video</span>}
                        <span className="text-xs text-gray-400">{c.category} · {c.difficulty} · {c.duration}</span>
                      </div>
                      <p className="text-xs text-gray-500">{c.enrolledCount} inscrits · {c.completedCount} termines</p>
                    </div>
                    <button onClick={() => handleDelete('course', c.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )
          ) : (
            quizzes.length === 0 ? <div className="text-center py-12 text-sm text-gray-400">Aucun quiz.</div> : (
              <div className="space-y-2">
                {quizzes.map(q => (
                  <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600"><FileQuestion size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-900">{q.topic}</span><span className="text-xs text-gray-400">{q.difficulty} · {Array.isArray(q.questions) ? q.questions.length : 0} questions</span></div>
                    </div>
                    <button onClick={() => handleDelete('quiz', q.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => resetForm()}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Creer</h2><button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button></div>

            {/* Type tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
              <button onClick={() => setCreateType('course')} className={`flex-1 px-3 py-1.5 text-sm rounded-lg flex items-center justify-center gap-1.5 ${createType === 'course' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>
                <FileText size={13} /> Cours
              </button>
              <button onClick={() => setCreateType('video')} className={`flex-1 px-3 py-1.5 text-sm rounded-lg flex items-center justify-center gap-1.5 ${createType === 'video' ? 'bg-white shadow-sm font-medium text-red-600' : 'text-gray-500'}`}>
                <Video size={13} /> Video IA
              </button>
              <button onClick={() => setCreateType('quiz')} className={`flex-1 px-3 py-1.5 text-sm rounded-lg flex items-center justify-center gap-1.5 ${createType === 'quiz' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>
                <FileQuestion size={13} /> Quiz
              </button>
            </div>

            <div className="space-y-3">
              {createType !== 'quiz' && <div><label className="text-xs font-medium text-gray-600 mb-1 block">Titre *</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>}
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Sujet *</label><input value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="Ex: Cybersecurite, RGPD, Leadership..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Difficulte</label><select value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"><option value="beginner">Debutant</option><option value="intermediate">Intermediaire</option><option value="advanced">Avance</option></select></div>
                {createType !== 'quiz' && <div><label className="text-xs font-medium text-gray-600 mb-1 block">Categorie</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>}
              </div>

              {/* === VIDEO COURSE: YouTube URLs === */}
              {createType === 'video' && (
                <div className="bg-red-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Youtube size={16} className="text-red-600" />
                    <span className="text-sm font-semibold text-gray-800">Videos YouTube (optionnel)</span>
                  </div>
                  <p className="text-xs text-gray-500">Ajoutez des liens YouTube pour chaque module. L'IA generera le script et les slides autour.</p>
                  {videoUrls.map((url, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex gap-2">
                        <input value={url} onChange={e => updateVideoUrl(i, e.target.value)} placeholder={`Module ${i + 1} — URL YouTube ou MP4`}
                          className="flex-1 px-3 py-2 border border-red-200 rounded-lg text-sm bg-white" />
                        {videoUrls.length > 1 && <button onClick={() => removeVideoUrl(i)} className="p-2 text-red-400 hover:text-red-600"><X size={14} /></button>}
                      </div>
                      {!url && (
                        <VideoUploader onUploaded={(uploadedUrl) => updateVideoUrl(i, uploadedUrl)} className="" />
                      )}
                    </div>
                  ))}
                  <button onClick={addVideoUrl} className="text-xs text-red-600 hover:text-red-700 font-medium">+ Ajouter une video</button>
                </div>
              )}

              {/* === COURSE: Multimedia Module Builder === */}
              {createType === 'course' && (
                <>
                  <button onClick={() => setShowModuleBuilder(!showModuleBuilder)}
                    className="flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                    <Layers size={13} /> {showModuleBuilder ? 'Masquer' : 'Module builder multimedia'}
                  </button>

                  {showModuleBuilder && (
                    <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs text-gray-500">Construisez des modules mixtes : texte + video + liens. Laissez vide pour generation IA.</p>
                      {modules.map((mod, i) => (
                        <div key={i} className="bg-white rounded-lg p-3 space-y-2 border border-indigo-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-600">Module {i + 1}</span>
                            <button onClick={() => removeModule(i)} className="ml-auto text-gray-400 hover:text-red-500"><X size={12} /></button>
                          </div>
                          <input value={mod.title} onChange={e => updateModule(i, 'title', e.target.value)} placeholder="Titre du module"
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                          <input value={mod.videoUrl} onChange={e => updateModule(i, 'videoUrl', e.target.value)} placeholder="URL video YouTube / mp4 (optionnel)"
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                          {!mod.videoUrl && (
                            <VideoUploader onUploaded={(url) => updateModule(i, 'videoUrl', url)} className="mt-1" />
                          )}
                          <textarea value={mod.content} onChange={e => updateModule(i, 'content', e.target.value)} placeholder="Contenu texte du module"
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm resize-none" rows={2} />
                          <div className="flex gap-2">
                            {['text', 'video', 'mixed'].map(t => (
                              <button key={t} onClick={() => updateModule(i, 'type', t)}
                                className={`text-xs px-2 py-1 rounded ${mod.type === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{t}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button onClick={addModule} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">+ Ajouter un module</button>
                    </div>
                  )}
                </>
              )}

              {/* AI Generate buttons */}
              {createType === 'course' && (
                <button onClick={handleGenerate} disabled={generating || (!form.topic && !form.title)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-xl w-full justify-center disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}>
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {generating ? 'Generation IA...' : 'Generer cours texte avec IA'}
                </button>
              )}
              {createType === 'video' && (
                <button onClick={handleGenerateVideo} disabled={generating || (!form.topic && !form.title)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-xl w-full justify-center disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <><Video size={14} /> <Sparkles size={14} /></>} {generating ? 'Generation video IA...' : 'Generer cours video avec IA'}
                </button>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Annuler</button>
              <button onClick={handleCreate} disabled={submitting || (!form.title && !form.topic)} className="px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>{submitting ? <Loader2 className="animate-spin" size={14} /> : 'Creer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
