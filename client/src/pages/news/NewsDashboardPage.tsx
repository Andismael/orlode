/**
 * NewsDashboardPage — News feed, briefings, trending, sentiment, stats
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, Loader2, TrendingUp, TrendingDown, Minus, Bookmark, Star, Sparkles, Eye, RefreshCw, Clock, BarChart3 } from 'lucide-react';
import api from '@/services/api';

interface Article { id: string; title: string; summary: string; source: string; category: string; importance: string; sentiment?: string; tags?: string[]; publishedAt?: string }
interface Briefing { id: string; topHeadline: string; articleCount: number; fetchedAt: string; articles?: Article[] }
interface Trending { topic: string; direction: string; momentum: number; category: string; summary: string }
interface Stats { totalArticles: number; totalBriefings: number; competitors: number; bookmarks: number; alertsEnabled: boolean; byCategory: { category: string; count: number }[]; bySentiment: Record<string, number> }

const IMP: Record<string, string> = { breaking: 'bg-red-600 text-white', high: 'bg-orange-100 text-orange-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };
const SENT: Record<string, string> = { positive: 'text-green-600', negative: 'text-red-600', neutral: 'text-gray-500', mixed: 'text-yellow-600' };
const DIR_ICON: Record<string, typeof TrendingUp> = { rising: TrendingUp, falling: TrendingDown, stable: Minus };

export default function NewsDashboardPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [trending, setTrending] = useState<Trending[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/news/briefings').then(r => setBriefings((r.data as { data?: Briefing[] })?.data ?? [])),
      api.get('/news/trending').then(r => setTrending(((r.data as { data?: { trending: Trending[] } })?.data?.trending ?? []))),
      api.get('/news/stats').then(r => setStats((r.data as { data?: Stats })?.data ?? null)),
    ]).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const generateBriefing = async () => {
    setGenerating(true);
    await api.post('/news/briefings/generate', { topics: ['breaking news', 'business', 'technology'] }).catch(() => {});
    setGenerating(false); load();
  };

  const latestBriefing = briefings[0];
  const latestArticles = (latestBriefing?.articles ?? []) as Article[];
  const s = stats ?? { totalArticles: 0, totalBriefings: 0, competitors: 0, bookmarks: 0, alertsEnabled: false, byCategory: [], bySentiment: {} };

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Veille Intelligente</h1><p className="text-sm text-gray-500">News, concurrents, tendances, sentiment</p></div>
        <div className="flex gap-2">
          <button onClick={generateBriefing} disabled={generating} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #F59E0B, #EAB308)' }}>
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {generating ? 'Generation...' : 'Nouveau briefing'}
          </button>
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Articles', value: s.totalArticles, icon: Newspaper, color: 'text-amber-600 bg-amber-50' },
              { label: 'Briefings', value: s.totalBriefings, icon: Clock, color: 'text-blue-600 bg-blue-50' },
              { label: 'Concurrents', value: s.competitors, icon: Eye, color: 'text-red-600 bg-red-50' },
              { label: 'Sauvegardes', value: s.bookmarks, icon: Bookmark, color: 'text-purple-600 bg-purple-50' },
              { label: 'Alertes', value: s.alertsEnabled ? 'ON' : 'OFF', icon: Star, color: s.alertsEnabled ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-50' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${k.color}`}><k.icon size={14} /></div>
                <p className="text-lg font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Top headline */}
          {latestBriefing && (
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-2"><Newspaper size={16} /> <span className="text-sm opacity-80">Dernier briefing</span></div>
              <h2 className="text-xl font-bold">{latestBriefing.topHeadline}</h2>
              <p className="text-sm opacity-80 mt-1">{latestBriefing.articleCount} articles · {latestBriefing.fetchedAt ? new Date(latestBriefing.fetchedAt).toLocaleString('fr-FR') : ''}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Articles feed */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 text-sm">Articles recents</h2>
                <Link to="/news/articles" className="text-xs text-blue-600">Voir tout</Link>
              </div>
              <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                {latestArticles.length === 0 && briefings.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">Generez votre premier briefing pour voir les articles.</div>
                ) : latestArticles.slice(0, 10).map((a, i) => (
                  <div key={i} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${IMP[a.importance] ?? IMP.medium}`}>{a.importance}</span>
                      <span className="text-xs text-gray-400">{a.category}</span>
                      {a.sentiment && <span className={`text-xs font-medium ${SENT[a.sentiment] ?? SENT.neutral}`}>{a.sentiment}</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{a.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.summary}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-gray-400">{a.source}</span>
                      {a.tags?.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending + Quick links */}
            <div className="space-y-4">
              {/* Trending */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h2 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2"><TrendingUp size={13} className="text-amber-500" /> Tendances</h2>
                <div className="space-y-2">
                  {trending.slice(0, 6).map((t, i) => {
                    const DirIcon = DIR_ICON[t.direction] ?? Minus;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <DirIcon size={14} className={t.direction === 'rising' ? 'text-green-500' : t.direction === 'falling' ? 'text-red-500' : 'text-gray-400'} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{t.topic}</p>
                          <p className="text-xs text-gray-400 truncate">{t.summary}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700">{t.momentum}</div>
                      </div>
                    );
                  })}
                  {trending.length === 0 && <p className="text-xs text-gray-400">Chargement...</p>}
                </div>
              </div>

              {/* Quick links */}
              <div className="space-y-2">
                {[
                  { to: '/news/competitors', label: 'Concurrents', desc: 'Suivi et analyse', color: 'bg-red-50 text-red-700' },
                  { to: '/news/alerts', label: 'Alertes', desc: 'Mots-cles et canaux', color: 'bg-green-50 text-green-700' },
                  { to: '/news/bookmarks', label: 'Sauvegardes', desc: `${s.bookmarks} articles`, color: 'bg-purple-50 text-purple-700' },
                ].map(l => (
                  <Link key={l.to} to={l.to} className={`block p-3 rounded-xl border border-gray-100 hover:shadow-md transition-shadow ${l.color}`}>
                    <p className="text-sm font-semibold">{l.label}</p>
                    <p className="text-xs opacity-75">{l.desc}</p>
                  </Link>
                ))}
              </div>

              {/* Sentiment pie */}
              {Object.keys(s.bySentiment).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h3 className="text-xs font-semibold text-gray-600 mb-2">Sentiment global</h3>
                  <div className="flex gap-3">
                    {Object.entries(s.bySentiment).map(([k, v]) => (
                      <div key={k} className="text-center">
                        <p className={`text-lg font-bold ${SENT[k] ?? 'text-gray-600'}`}>{v}</p>
                        <p className="text-xs text-gray-400 capitalize">{k}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
