/**
 * SuperAdmin — Influencer moderation.
 * Lists creator profiles (filter by status), lets the SuperAdmin flip
 * pending ↔ active and toggle the verified blue badge.
 */
import React, { useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import {
  Loader2, BadgeCheck, Check, Pause, Play, RefreshCw, ChevronRight,
  Instagram, Music as TiktokIcon, Youtube,
} from 'lucide-react';

interface InfluencerRow {
  id: string;
  displayName: string;
  handle: string;
  city: string;
  bio: string;
  categories: string[];
  audience: { total?: number; instagram?: number; tiktok?: number; youtube?: number };
  languages: string[];
  verified: boolean;
  status: 'pending' | 'active' | 'paused' | 'hired';
  userId: string | null;
  createdAt: string | null;
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'pending', label: '⏳ En attente' },
  { value: 'active',  label: '✅ Actifs'     },
  { value: 'paused',  label: '⏸ Pausés'      },
  { value: '',        label: 'Tous'           },
];

function formatNum(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return n.toString();
}

export default function InfluencersAdminPage() {
  const [profiles, setProfiles] = useState<InfluencerRow[] | null>(null);
  const [filter, setFilter] = useState<string>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setProfiles(null);
    setError(null);
    try {
      const r: any = await api.get(`/superadmin/influencers${filter ? `?status=${filter}` : ''}`);
      setProfiles((r.data ?? r) as InfluencerRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setProfiles([]);
    }
  };
  useEffect(() => { void load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (id: string, body: { status?: string; verified?: boolean }) => {
    setBusyId(id);
    try {
      await api.patch(`/superadmin/influencers/${id}/status`, body);
      setProfiles(prev => prev?.map(p => p.id === id ? { ...p, ...body } as InfluencerRow : p) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  const sorted = useMemo(() => profiles, [profiles]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modération Influenceurs</h1>
          <p className="text-sm text-gray-500 mt-1">Validation des créateurs avant publication sur l'annuaire.</p>
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
                ? 'bg-violet-600 text-white shadow-sm'
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

      {sorted?.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm text-gray-600">
            {filter === 'pending' ? 'Aucun profil en attente — bien joué !'
              : filter === 'active' ? 'Aucun profil actif pour l\'instant.'
              : 'Aucun résultat.'}
          </p>
        </div>
      )}

      {sorted && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map(p => (
            <article key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition">
              <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full flex-shrink-0 bg-gradient-to-br from-violet-400 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  {p.displayName?.[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{p.displayName}</span>
                    {p.verified && <BadgeCheck size={14} className="text-sky-500" fill="currentColor" />}
                    <span className="text-xs text-gray-400">{p.handle}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                      p.status === 'active'  ? 'bg-emerald-100 text-emerald-700'
                    : p.status === 'pending' ? 'bg-amber-100 text-amber-700'
                    : p.status === 'paused'  ? 'bg-gray-100 text-gray-600'
                    : 'bg-slate-100 text-slate-600'
                    }`}>
                      {p.status.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{p.bio}</p>

                  <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                    {p.city && <span>📍 {p.city}</span>}
                    {(p.categories ?? []).length > 0 && <span>🏷️ {p.categories.join(', ')}</span>}
                    {(p.languages ?? []).length > 0 && <span>🌐 {p.languages.join(', ')}</span>}
                  </div>

                  <div className="flex gap-4 mt-2 text-xs text-gray-600">
                    {p.audience.instagram && (
                      <span className="inline-flex items-center gap-1">
                        <Instagram size={11} className="text-pink-500" /> {formatNum(p.audience.instagram)}
                      </span>
                    )}
                    {p.audience.tiktok && (
                      <span className="inline-flex items-center gap-1">
                        <TiktokIcon size={11} /> {formatNum(p.audience.tiktok)}
                      </span>
                    )}
                    {p.audience.youtube && (
                      <span className="inline-flex items-center gap-1">
                        <Youtube size={11} className="text-red-500" /> {formatNum(p.audience.youtube)}
                      </span>
                    )}
                    {p.audience.total && (
                      <span className="font-bold text-violet-600">
                        Total: {formatNum(p.audience.total)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {p.status !== 'active' && (
                    <button
                      onClick={() => patch(p.id, { status: 'active' })}
                      disabled={busyId === p.id}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                      {busyId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Activer
                    </button>
                  )}
                  {p.status === 'active' && (
                    <button
                      onClick={() => patch(p.id, { status: 'paused' })}
                      disabled={busyId === p.id}
                      className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                      {busyId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />} Pauser
                    </button>
                  )}
                  <button
                    onClick={() => patch(p.id, { verified: !p.verified })}
                    disabled={busyId === p.id}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5 ${
                      p.verified ? 'bg-sky-100 text-sky-700 hover:bg-sky-200' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}>
                    <BadgeCheck size={12} /> {p.verified ? 'Vérifié ✓' : 'Vérifier'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
