/**
 * LearningCenterPage — EMPLOYEE dashboard
 * My courses, progression, certificates, recommendations, leaderboard
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Award, TrendingUp, Star, Loader2, BookOpen, Trophy, Clock } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface MyProgress {
  courses: { id: string; courseId: string; title: string; category: string; completionPct: number; status: string; score: number }[];
  overallPct: number; totalPoints: number; badges: number;
}
interface Course { id: string; title: string; category: string; difficulty: string; duration: string }
interface Certificate { id: string; courseId: string; score: number; awardedAt: string }
interface LeaderEntry { rank: number; name: string; points: number; completed: number }

const STATUS_S: Record<string, { l: string; s: string }> = {
  assigned: { l: 'A faire', s: 'bg-blue-100 text-blue-700' },
  in_progress: { l: 'En cours', s: 'bg-yellow-100 text-yellow-700' },
  completed: { l: 'Termine', s: 'bg-green-100 text-green-700' },
};

export default function LearningCenterPage() {
  const { t } = useLangStore();
  const [progress, setProgress] = useState<MyProgress | null>(null);
  const [recommended, setRecommended] = useState<Course[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<MyProgress>('/training/my-progress').then(r => setProgress(r.data ?? null)),
      api.get<Course[]>('/training/recommended').then(r => setRecommended(Array.isArray(r.data) ? r.data : [])),
      api.get<Certificate[]>('/training/certificates').then(r => setCertificates(Array.isArray(r.data) ? r.data : [])),
      api.get<LeaderEntry[]>('/training/leaderboard').then(r => setLeaderboard(Array.isArray(r.data) ? r.data : [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const kpis = progress ? [
    { label: 'Progression', value: `${progress.overallPct}%`, icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'Points', value: progress.totalPoints, icon: Star, color: 'text-purple-600 bg-purple-50' },
    { label: 'Badges', value: progress.badges, icon: Award, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Certificats', value: certificates.length, icon: GraduationCap, color: 'text-green-600 bg-green-50' },
  ] : [];

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Ma Formation</h1><p className="text-sm text-gray-500">Cours, quiz et progression</p></div>
        <Link to="/training/manage" className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Gestion (admin)</Link>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${k.color}`}><k.icon size={16} /></div>
                <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Overall progress bar */}
          {progress && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Progression globale</h2>
              <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className="h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all" style={{ width: `${progress.overallPct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{progress.overallPct}% — {progress.courses.filter(c => c.status === 'completed').length}/{progress.courses.length} cours termines</p>
            </div>
          )}

          {/* My courses */}
          {progress && progress.courses.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><BookOpen size={14} className="text-blue-500" /> Mes cours ({progress.courses.length})</h2>
              <div className="space-y-2">
                {progress.courses.map(c => {
                  const st = STATUS_S[c.status] ?? { l: c.status, s: 'bg-gray-100 text-gray-600' };
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">{c.title || c.courseId}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.s}`}>{st.l}</span>
                          {c.category && <span className="text-xs text-gray-400">{c.category}</span>}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                          <div className={`h-1.5 rounded-full ${c.completionPct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${c.completionPct}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-700">{c.completionPct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recommendations */}
            {recommended.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Star size={14} className="text-yellow-500" /> Recommandes</h2>
                <div className="space-y-2">
                  {recommended.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center gap-3 text-sm p-2 bg-gray-50 rounded-lg">
                      <GraduationCap size={14} className="text-blue-500 shrink-0" />
                      <span className="text-gray-800 flex-1">{c.title}</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} /> {c.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Trophy size={14} className="text-yellow-500" /> Classement</h2>
                <div className="space-y-2">
                  {leaderboard.map(e => (
                    <div key={e.rank} className="flex items-center gap-3 text-sm">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${e.rank <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{e.rank}</span>
                      <span className="text-gray-800 flex-1">{e.name}</span>
                      <span className="text-xs text-purple-600 font-semibold">{e.points} pts</span>
                      <span className="text-xs text-gray-400">{e.completed} cours</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Certificates */}
          {certificates.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Award size={14} className="text-green-500" /> Mes certificats ({certificates.length})</h2>
              <div className="flex flex-wrap gap-2">
                {certificates.map(c => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                    <Award size={12} /> Score: {c.score}% · {new Date(c.awardedAt).toLocaleDateString('fr-FR')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {progress && progress.courses.length === 0 && recommended.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <GraduationCap size={40} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun cours assigne</h3>
              <p className="text-sm text-gray-400">Demandez a votre manager de vous assigner des formations.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
