/**
 * SuperAdmin — Talents moderation.
 * Lists candidate profiles (filter by status), lets the SuperAdmin
 * preview the video and flip status. Mirror of InfluencersAdminPage
 * but adapted to the talents schema (video-first, sector/skills,
 * availability, AI analysis).
 */
import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import {
  Loader2, Check, Pause, RefreshCw, PlayCircle, MapPin, Briefcase,
  Eye, MessageCircle, Sparkles, Clock,
} from 'lucide-react';

interface TalentRow {
  id: string;
  displayName: string;
  city: string;
  country: string;
  sector: string;
  skills: string[];
  tagline: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  videoDuration: number;
  aiAnalysis: Record<string, unknown> | null;
  availability: string;
  language: string;
  viewsCount: number;
  contactsCount: number;
  status: 'pending_video' | 'pending_analysis' | 'active' | 'paused' | 'hired';
  userId: string | null;
  createdAt: string | null;
}

const STATUS_FILTERS = [
  { value: 'pending_video',    label: '🎬 Vidéo manquante'   },
  { value: 'pending_analysis', label: '🧠 Analyse IA en cours' },
  { value: 'active',           label: '✅ Actifs'              },
  { value: 'paused',           label: '⏸ Pausés'              },
  { value: 'hired',            label: '🎉 Recrutés'            },
  { value: '',                 label: 'Tous'                   },
];

export default function TalentsAdminPage() {
  const [profiles, setProfiles] = useState<TalentRow[] | null>(null);
  const [filter, setFilter] = useState<string>('pending_analysis');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setProfiles(null);
    setError(null);
    try {
      const r: any = await api.get(`/superadmin/talents${filter ? `?status=${filter}` : ''}`);
      setProfiles((r.data ?? r) as TalentRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setProfiles([]);
    }
  };
  useEffect(() => { void load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (id: string, status: TalentRow['status']) => {
    setBusyId(id);
    try {
      await api.patch(`/superadmin/talents/${id}/status`, { status });
      setProfiles(prev => prev?.map(p => p.id === id ? { ...p, status } : p) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modération Talents</h1>
          <p className="text-sm text-gray-500 mt-1">Validation des candidats avant publication sur l'annuaire.</p>
        </div>
        <button onClick={load} className="px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
          <RefreshCw size={13} /> Rafraîchir
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${
              filter === f.value
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {profiles === null && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="animate-spin" size={20} />
        </div>
      )}

      {profiles?.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm text-gray-600">Aucun profil dans cet onglet.</p>
        </div>
      )}

      {profiles && profiles.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {profiles.map(p => (
            <article key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition flex gap-3">
              {/* Video thumbnail */}
              <div className="w-24 h-32 rounded-xl flex-shrink-0 bg-gradient-to-br from-emerald-600 to-emerald-900 flex items-center justify-center relative overflow-hidden"
                style={p.thumbnailUrl ? { backgroundImage: `url(${p.thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                {!p.thumbnailUrl && <span className="text-3xl">🎬</span>}
                {p.videoUrl && (
                  <a href={p.videoUrl} target="_blank" rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/60 transition">
                    <PlayCircle size={28} className="text-white" />
                  </a>
                )}
                {p.videoDuration > 0 && (
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    {Math.round(p.videoDuration)}s
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 truncate">{p.displayName || 'Sans nom'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider whitespace-nowrap ${
                    p.status === 'active'           ? 'bg-emerald-100 text-emerald-700'
                  : p.status === 'pending_analysis' ? 'bg-blue-100 text-blue-700'
                  : p.status === 'pending_video'    ? 'bg-amber-100 text-amber-700'
                  : p.status === 'hired'            ? 'bg-violet-100 text-violet-700'
                  : 'bg-gray-100 text-gray-600'
                  }`}>
                    {p.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {p.tagline && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{p.tagline}</p>}

                <div className="flex gap-3 mt-2 text-[11px] text-gray-500 flex-wrap">
                  {p.city && <span className="inline-flex items-center gap-1"><MapPin size={10} /> {p.city}</span>}
                  {p.sector && <span className="inline-flex items-center gap-1"><Briefcase size={10} /> {p.sector}</span>}
                  {p.availability && <span className="inline-flex items-center gap-1"><Clock size={10} /> {p.availability}</span>}
                </div>

                {(p.skills ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.skills.slice(0, 4).map(s => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-semibold">{s}</span>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 mt-2 text-[10px] text-gray-500">
                  <span className="inline-flex items-center gap-1"><Eye size={10} /> {p.viewsCount}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={10} /> {p.contactsCount}</span>
                  {p.aiAnalysis && (
                    <span className="inline-flex items-center gap-1 text-violet-600">
                      <Sparkles size={10} /> IA analysée
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  {p.status !== 'active' && (
                    <button onClick={() => patch(p.id, 'active')} disabled={busyId === p.id}
                      className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                      {busyId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Activer
                    </button>
                  )}
                  {p.status === 'active' && (
                    <button onClick={() => patch(p.id, 'paused')} disabled={busyId === p.id}
                      className="px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                      {busyId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Pause size={11} />} Pauser
                    </button>
                  )}
                  {p.status !== 'hired' && p.status === 'active' && (
                    <button onClick={() => patch(p.id, 'hired')} disabled={busyId === p.id}
                      className="px-3 py-1.5 text-[11px] font-bold text-violet-700 bg-violet-100 hover:bg-violet-200 rounded-lg disabled:opacity-50">
                      Marquer recruté
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
