/**
 * Social Posts — list of drafts/scheduled/published posts with actions:
 * delete (drafts/scheduled), publish-now (scheduled), open external URL (published).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  ArrowLeft, RefreshCw, Send, Trash2, Calendar, ExternalLink, Plus, X,
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  ink: '#0A2A20', inkSoft: '#475467', inkLight: '#94A3A0',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  red: '#EF4444', redSoft: '#FEE2E2',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  ai: '#F59E0B', aiSoft: '#FEF3C7',
  purple: '#6D28D9', purpleSoft: '#EDE9FE',
};

interface Post {
  id: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  hashtags?: string[];
  platforms: string[];
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduledAt?: { _seconds: number };
  publishedAt?: { _seconds: number };
  createdAt?: { _seconds: number };
  results?: Array<{ platform: string; success: boolean; postId?: string; url?: string; error?: string }>;
}

function fmtDateTime(ts?: { _seconds: number }): string {
  if (!ts?._seconds) return '—';
  return new Date(ts._seconds * 1000).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:      { label: 'Brouillon',  color: C.inkSoft,     bg: C.creamDeep },
  scheduled:  { label: 'Programmé',  color: C.ai,          bg: C.aiSoft },
  publishing: { label: 'Publication…', color: C.blue,      bg: C.blueSoft },
  published:  { label: 'Publié',     color: C.emeraldDeep, bg: C.emeraldSoft },
  failed:     { label: 'Échec',      color: C.red,         bg: C.redSoft },
};

export default function SocialPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await api.get('/social/posts');
      const list: Post[] = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.data) ? r.data.data : []);
      setPosts(list);
    } catch { setPosts([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Auto-poll while a post is scheduled or publishing
  useEffect(() => {
    const active = posts.some(p => p.status === 'scheduled' || p.status === 'publishing');
    if (!active) return;
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [posts]);

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce post ?')) return;
    try {
      await api.delete(`/social/posts/${id}`);
      setPosts(prev => prev.filter(p => p.id !== id));
      toast.success('Supprimé');
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? '');
    }
  };

  const publishNow = async (id: string) => {
    try {
      await api.post(`/social/posts/${id}/publish-now`);
      toast.success('Publication lancée');
      load();
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? '');
    }
  };

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter);
  const counts = {
    all: posts.length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    failed: posts.filter(p => p.status === 'failed').length,
  };

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link to="/admin/social" style={{ color: C.cream, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> Réseaux sociaux
        </Link>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Mes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purpleSoft }}>posts</em>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.7)', margin: '2px 0 0' }}>
            Tous tes posts — programmés, publiés, ratés.
          </p>
        </div>
        <button onClick={load} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          <RefreshCw size={13} /> Rafraîchir
        </button>
        <Link to="/admin/social/composer" className="btn-primary" style={{ padding: '9px 16px', fontSize: 13 }}>
          <Plus size={13} /> Nouveau post
        </Link>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([
          { id: 'all',       label: 'Tous',     count: counts.all,       color: C.cream },
          { id: 'scheduled', label: 'Programmés', count: counts.scheduled, color: C.ai },
          { id: 'published', label: 'Publiés',  count: counts.published, color: C.emeraldDeep },
          { id: 'failed',    label: 'Échec',    count: counts.failed,    color: C.red },
        ] as const).map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'rgba(255,250,240,0.06)',
              color: active ? (f.id === 'all' ? C.greenDeep : C.cream) : C.cream,
              padding: '8px 14px', borderRadius: 100,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(255,250,240,0.12)',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {f.label}
              <span className="mono-font" style={{ background: active ? 'rgba(0,0,0,0.15)' : 'rgba(255,250,240,0.1)', padding: '1px 6px', borderRadius: 6, fontSize: 10 }}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ background: C.cream, borderRadius: 14, padding: 40, textAlign: 'center', color: C.inkSoft }}>
          Chargement…
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.12)' }}>
          <Send size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
            {posts.length === 0 ? 'Aucun post pour l\'instant' : 'Aucun post avec ce filtre'}
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 14px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            {posts.length === 0
              ? "Crée ton premier post — choisis tes plateformes, écris une fois, publie partout."
              : 'Essaie un autre filtre.'}
          </p>
          {posts.length === 0 && (
            <Link to="/admin/social/composer" className="btn-primary">
              <Plus size={14} /> Mon premier post
            </Link>
          )}
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(p => {
            const status = STATUS_META[p.status] ?? STATUS_META.draft;
            const isScheduled = p.status === 'scheduled';
            const isPublished = p.status === 'published';
            return (
              <div key={p.id} style={{
                background: C.cream, borderRadius: 14,
                border: `1.5px solid ${status.color}25`,
                borderLeft: `5px solid ${status.color}`,
                padding: 16,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  {p.mediaUrl && p.mediaType === 'image' ? (
                    <div style={{ width: 64, height: 64, borderRadius: 10, background: `url("${p.mediaUrl}") center/cover, ${C.creamDeep}`, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 10, background: C.creamDeep, color: C.inkLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
                      {p.mediaType === 'video' ? '🎬' : '📝'}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span className="pill" style={{ background: status.bg, color: status.color, fontSize: 10, fontWeight: 700 }}>
                        {status.label}
                      </span>
                      {(p.platforms ?? []).map(pl => (
                        <span key={pl} className="pill" style={{ background: C.creamDeep, color: C.inkSoft, fontSize: 10, fontWeight: 600 }}>
                          {pl}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                      {p.text}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: C.inkLight, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Créé {fmtDateTime(p.createdAt)}</span>
                      {p.scheduledAt && <span>📅 Programmé {fmtDateTime(p.scheduledAt)}</span>}
                      {p.publishedAt && <span>✅ Publié {fmtDateTime(p.publishedAt)}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    {isScheduled && (
                      <button onClick={() => publishNow(p.id)} className="btn-primary" style={{ padding: '5px 10px', fontSize: 11 }}>
                        <Send size={11} /> Publier maintenant
                      </button>
                    )}
                    {!isPublished && (
                      <button onClick={() => remove(p.id)} className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11, color: C.red, borderColor: C.red }}>
                        <Trash2 size={11} /> Supprimer
                      </button>
                    )}
                  </div>
                </div>

                {/* Per-platform results (after publish) */}
                {p.results && p.results.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)', flexWrap: 'wrap' }}>
                    {p.results.map((r, i) => (
                      <div key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: r.success ? C.emeraldSoft : C.redSoft,
                        color: r.success ? C.emeraldDeep : C.red,
                        padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                      }}>
                        {r.success ? '✅' : '❌'} {r.platform}
                        {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}><ExternalLink size={10} /></a>}
                        {r.error && <span style={{ fontSize: 10, opacity: 0.8 }}>· {r.error.slice(0, 60)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
