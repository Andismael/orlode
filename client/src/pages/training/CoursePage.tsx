import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { ArrowLeft, CheckCircle, Play, Trophy, Video, FileText, Layers } from 'lucide-react';
import ContentBlockRenderer, { ContentBlock } from '@/components/training/ContentBlockRenderer';
import VideoPlayer from '@/components/training/VideoPlayer';

interface Module {
  id: string; title: string; content: string; completed: boolean; hasQuiz: boolean;
  type?: 'text' | 'video' | 'mixed';
  videoUrl?: string;
  contentBlocks?: ContentBlock[];
  script?: string;
  slides?: string[];
}
interface Course { id: string; title: string; category: string; duration: number; modules: Module[]; isMultimedia?: boolean }

const TYPE_ICON: Record<string, React.ReactNode> = {
  video: <Video size={13} className="text-red-500" />,
  mixed: <Layers size={13} className="text-purple-500" />,
  text: <FileText size={13} className="text-blue-500" />,
};

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { t } = useLangStore();
  const [course, setCourse] = useState<Course | null>(null);
  const [activeModule, setActiveModule] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/training/courses/${courseId}`).then(r => {
      const data = r.data ?? r.data;
      setCourse(data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <div className="p-6 text-sm text-gray-400">{`${t('loading')}`}</div>;
  if (!course) return <div className="p-6 text-sm text-red-500">Cours introuvable</div>;

  const pct = Math.round((course.modules.filter(m => m.completed).length / course.modules.length) * 100);
  const module = course.modules[activeModule];
  const moduleType = module.type ?? 'text';
  const hasVideo = moduleType === 'video' || !!module.videoUrl;
  const hasContentBlocks = module.contentBlocks && module.contentBlocks.length > 0;

  const complete = async () => {
    await api.post(`/training/courses/${courseId}/progress`, { moduleId: module.id, completed: true }).catch(() => {});
    if (module.hasQuiz) navigate(`/training/quiz/${module.id}`);
    else if (activeModule < course.modules.length - 1) setActiveModule(activeModule + 1);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 border-r border-gray-100 bg-white p-3 overflow-y-auto">
        <button onClick={() => navigate('/training')} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft size={12} /> Formations
        </button>
        <h2 className="font-bold text-gray-900 text-sm mb-1">{course.title}</h2>
        {course.isMultimedia && (
          <div className="flex items-center gap-1 mb-2">
            <Video size={11} className="text-red-500" />
            <span className="text-xs text-red-500 font-medium">Multimedia</span>
          </div>
        )}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-gray-500">{pct}%</span>
        </div>
        <div className="space-y-1">
          {course.modules.map((mod, i) => (
            <button key={mod.id ?? i} onClick={() => setActiveModule(i)}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors text-xs ${activeModule === i ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {mod.completed
                ? <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
                : TYPE_ICON[mod.type ?? 'text'] ?? <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
              }
              <span className="truncate">{mod.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
        {/* Module header */}
        <div className="flex items-center gap-3 mb-5">
          {TYPE_ICON[moduleType]}
          <h1 className="text-xl font-bold text-gray-900">{module.title}</h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">{moduleType}</span>
        </div>

        {/* Video player (standalone video module or module with videoUrl) */}
        {hasVideo && module.videoUrl && (
          <div className="mb-6">
            <VideoPlayer url={module.videoUrl} title={module.title} onComplete={() => {}} />
          </div>
        )}

        {/* Multimedia content blocks */}
        {hasContentBlocks ? (
          <div className="mb-6">
            <ContentBlockRenderer
              blocks={module.contentBlocks!}
              onVideoComplete={() => {}}
              onQuizClick={(quizId) => navigate(`/training/quiz/${quizId}`)}
            />
          </div>
        ) : (
          /* Fallback: plain text content */
          !hasVideo && (
            <div className="prose prose-sm max-w-none text-gray-700 mb-6">
              <p>{module.content || 'Contenu du module disponible via le gestionnaire de documents.'}</p>
            </div>
          )
        )}

        {/* Script section (for video courses) */}
        {module.script && (
          <details className="mb-6 bg-gray-50 rounded-xl border border-gray-100">
            <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 rounded-xl">
              Script de la video
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {module.script}
            </div>
          </details>
        )}

        {/* Slides outline (for video courses) */}
        {module.slides && module.slides.length > 0 && (
          <div className="mb-6 bg-indigo-50 rounded-xl border border-indigo-100 p-4">
            <h3 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
              <Layers size={14} /> Slides
            </h3>
            <div className="space-y-2">
              {module.slides.map((slide, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">{i + 1}</span>
                  <span className="text-gray-700">{slide}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          {activeModule > 0 && (
            <button onClick={() => setActiveModule(activeModule - 1)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Precedent
            </button>
          )}
          <button onClick={complete}
            className="flex items-center gap-2 px-5 py-2 text-white text-sm rounded-lg font-medium"
            style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
            {module.hasQuiz ? <><Play size={13} /> Quiz de validation</> : activeModule < course.modules.length - 1 ? 'Module suivant' : <><Trophy size={13} /> Terminer le cours</>}
          </button>
        </div>
      </div>
    </div>
  );
}
