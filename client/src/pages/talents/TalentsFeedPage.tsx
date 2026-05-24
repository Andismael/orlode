/**
 * Orlode Talents — premium editorial feed at /talents/feed.
 * Dark green hero strip + sticky filter bar over cream + editorial card grid.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Users, RefreshCw } from 'lucide-react';
import { listActiveTalents, type Talent } from '@/services/talents';
import { useSEO } from '@/hooks/useSEO';
import TalentVideoCard, { type CardTalent } from './TalentVideoCard';

const C = {
  brand: '#0F5C3F',
  brandDarker: '#031A11',
  brandSoft: '#E8F5EE',
  brandMid: '#1B7A56',
  gold: '#D4A574',
  goldLight: '#E8C9A0',
  cream: '#FAF7F2',
  creamDeep: '#F0EBE3',
  ink: '#0A1410',
  ink3: '#384C42',
  inkSoft: '#5C6B62',
  inkLight: '#94A39A',
  inkSilent: '#C5CDC8',
  white: '#FFFFFF',
};

const CATEGORIES = ['Tous', 'Tech', 'Design', 'Marketing', 'Hospitalité', 'Finance', 'Créatif', 'Commerce', 'BTP'];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  .tfd { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
  .tfd-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
  .tfd-mono { font-family: 'JetBrains Mono', monospace; }
  .tfd-display-l { font-family: 'Fraunces', serif; font-size: clamp(36px, 6vw, 86px); font-weight: 800; line-height: 0.95; letter-spacing: -0.035em; }
  .tfd-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 14px; border-radius: 100px;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  @keyframes tfd-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  .tfd-shimmer {
    background: linear-gradient(90deg, ${C.brandMid} 0%, ${C.goldLight} 50%, ${C.brandMid} 100%);
    background-size: 200% auto;
    background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: tfd-shimmer 5s linear infinite;
  }
  @keyframes tfd-fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  .tfd-fade { animation: tfd-fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) backwards; }
  .tfd-d1{animation-delay:0.08s} .tfd-d2{animation-delay:0.16s}
  @keyframes tfd-slowRotate { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .tfd-rot { animation: tfd-slowRotate 60s linear infinite; }
  .tfd-hide-scroll::-webkit-scrollbar { display: none; }
  .tfd-hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
`;

function toCardTalent(t: Talent): CardTalent {
  return {
    id: t.id,
    displayName: t.displayName,
    firstName: t.displayName.split(' ')[0],
    sector: t.sector,
    city: t.city,
    country: t.country,
    videoDuration: t.videoDuration,
    viewsCount: t.viewsCount,
    contactsCount: t.contactsCount,
    thumbnailUrl: t.thumbnailUrl,
    status: t.status,
  };
}

export default function TalentsFeedPage() {
  useSEO({
    title: 'Feed — Orlode Talents',
    description: 'Découvre les candidats inscrits sur Orlode Talents. Vidéos brutes de 1 minute.',
    path: '/talents/feed',
  });

  const [talents, setTalents] = useState<CardTalent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('Tous');

  const load = () => {
    setTalents(null);
    setError(null);
    listActiveTalents(60)
      .then(arr => setTalents(arr.map(toCardTalent)))
      .catch((e: unknown) => {
        setError((e as Error).message || 'Erreur de chargement');
        setTalents([]);
      });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!talents) return [];
    if (filter === 'Tous') return talents;
    return talents.filter(t => t.sector?.toLowerCase() === filter.toLowerCase());
  }, [talents, filter]);

  return (
    <div className="tfd" style={{ minHeight: '100vh', background: C.cream }}>
      <style>{STYLES}</style>

      {/* Top nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10, 20, 16, 0.92)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 32px',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <Link to="/talents" style={{
            display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.brandMid}, ${C.brand})`,
              color: C.white, fontWeight: 800, fontSize: 17,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif',
            }}>O</div>
            <div className="tfd-serif" style={{
              fontSize: 16, fontWeight: 700, color: C.cream, lineHeight: 1,
            }}>
              Orlode <em style={{ fontStyle: 'italic', color: C.goldLight }}>Talents</em>
            </div>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={load} aria-label="Actualiser" style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: C.cream,
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <RefreshCw size={14} />
            </button>
            <Link to="/talents/inscription" style={{
              background: C.cream, color: C.ink,
              textDecoration: 'none',
              padding: '9px 16px', borderRadius: 100,
              fontSize: 13, fontWeight: 600,
            }}>
              Poster ma vidéo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero strip */}
      <section style={{
        background: C.brandDarker,
        color: C.cream,
        padding: '60px 32px 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 70% 30%, ${C.brand}40, transparent 60%)`,
        }} />
        <div className="tfd-rot" style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: 500, height: 500, borderRadius: '50%',
          border: `1px dashed ${C.goldLight}25`, pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div className="tfd-pill tfd-fade" style={{
            background: 'rgba(212, 165, 116, 0.12)',
            color: C.goldLight,
            border: `1px solid ${C.gold}40`,
            marginBottom: 20,
          }}>
            <Users size={11} /> Feed des talents
          </div>
          <h1 className="tfd-display-l tfd-fade tfd-d1" style={{ color: C.cream, margin: '0 0 16px' }}>
            Découvre des<br />
            <em className="tfd-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
              talents authentiques.
            </em>
          </h1>
          <p className="tfd-fade tfd-d2" style={{
            fontSize: 17, color: C.inkSilent,
            margin: 0, maxWidth: 580, lineHeight: 1.55,
          }}>
            Scroll, regarde, contacte directement. Les meilleurs profils en vidéo.
          </p>
        </div>
      </section>

      {/* Sticky filters */}
      <section style={{
        background: C.cream,
        position: 'sticky', top: 64, zIndex: 30,
        borderBottom: `1px solid ${C.creamDeep}`,
        padding: '20px 32px',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="tfd-hide-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {CATEGORIES.map(cat => {
              const active = filter === cat;
              return (
                <button key={cat} onClick={() => setFilter(cat)} style={{
                  background: active ? C.ink : C.white,
                  color: active ? C.cream : C.ink3,
                  border: `1px solid ${active ? C.ink : C.creamDeep}`,
                  padding: '10px 18px', borderRadius: 100,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                }}>
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section style={{ padding: '48px 32px 80px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            marginBottom: 32,
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            flexWrap: 'wrap', gap: 8,
          }}>
            <h2 className="tfd-serif" style={{
              fontSize: 22, fontWeight: 700, color: C.ink,
              margin: 0, letterSpacing: '-0.02em',
            }}>
              {talents === null ? (
                <span style={{ color: C.inkSoft, fontWeight: 500, fontFamily: 'Inter' }}>Chargement…</span>
              ) : (
                <>
                  <strong className="tfd-mono">{filtered.length}</strong>
                  <span style={{ color: C.inkSoft, fontWeight: 500, fontFamily: 'Inter' }}>
                    {' '}talent{filtered.length > 1 ? 's' : ''}
                    {filter !== 'Tous' ? ` en ${filter}` : ' disponible' + (filtered.length > 1 ? 's' : '')}
                  </span>
                </>
              )}
            </h2>
            <span className="tfd-mono" style={{ fontSize: 11, color: C.inkLight, letterSpacing: '0.05em' }}>
              ACTUALISÉ · MAY 2026
            </span>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: 12,
              padding: 14, marginBottom: 14,
              fontSize: 13, color: '#991B1B',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Loading */}
          {talents === null && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '60px 0',
              color: C.inkSoft,
            }}>
              <Loader2 className="animate-spin" size={22} />
              <span style={{ fontSize: 13 }}>Récupération du feed…</span>
            </div>
          )}

          {/* Empty */}
          {talents !== null && filtered.length === 0 && !error && (
            <div style={{
              background: C.white,
              border: `1px dashed ${C.brand}40`,
              borderRadius: 24,
              padding: 48,
              textAlign: 'center',
              maxWidth: 480, margin: '40px auto',
            }}>
              <div style={{ fontSize: 38, marginBottom: 12 }}>🌱</div>
              <div className="tfd-serif" style={{
                fontSize: 24, fontWeight: 700, marginBottom: 8,
                letterSpacing: '-0.02em',
              }}>
                {filter === 'Tous' ? 'Pas encore de talents' : `Aucun talent en ${filter}`}
              </div>
              <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 20px', lineHeight: 1.55 }}>
                {filter === 'Tous'
                  ? 'Sois le premier à poster ta vidéo. Une minute, ton talent, et tu apparais ici.'
                  : 'Essaye un autre métier ou poste ta propre vidéo.'}
              </p>
              <Link to="/talents/inscription" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: `linear-gradient(135deg, ${C.brandMid}, ${C.brand})`,
                color: C.white, textDecoration: 'none',
                padding: '12px 22px', borderRadius: 100,
                fontSize: 14, fontWeight: 700,
              }}>
                Poster ma vidéo →
              </Link>
            </div>
          )}

          {/* Cards */}
          {talents !== null && filtered.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 24,
              justifyItems: 'center',
            }}>
              {filtered.map((t, i) => (
                <Link
                  key={t.id}
                  to={`/talents/${t.id}`}
                  className="tfd-fade"
                  style={{ textDecoration: 'none', animationDelay: `${i * 0.06}s` }}
                >
                  <TalentVideoCard talent={t} size="medium" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
