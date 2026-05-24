/**
 * Orlode Talents — public feed at /talents/feed.
 * Loads active talents from Firestore `talents_profiles` and renders a
 * mobile-first grid. Tap a card → opens the candidate's profile in the
 * standalone talents.orlode.com app (no profile page on orlode.com yet).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft, PlayCircle, MapPin, Briefcase, RefreshCw } from 'lucide-react';
import { listActiveTalents, type Talent } from '@/services/talents';
import { useSEO } from '@/hooks/useSEO';
import { M, MOBILE_CSS } from '@/components/mobile/mobileDesign';

const TALENTS_APP_URL = 'https://talents.orlode.com';

export default function TalentsFeedPage() {
  useSEO({
    title: 'Feed — Orlode Talents',
    description: 'Découvre les candidats inscrits sur Orlode Talents. Vidéos brutes de 1 minute.',
    path: '/talents/feed',
  });

  const [talents, setTalents] = useState<Talent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setTalents(null);
    setError(null);
    listActiveTalents(60)
      .then(setTalents)
      .catch((e: unknown) => {
        setError((e as Error).message || 'Erreur de chargement');
        setTalents([]);
      });
  };

  useEffect(load, []);

  return (
    <div className="m-root" style={{ minHeight: '100vh', background: M.cream }}>
      <style>{MOBILE_CSS}</style>

      {/* Top bar */}
      <header style={{
        background: `linear-gradient(135deg, ${M.greenDark}, ${M.greenDeep})`,
        color: M.cream,
        padding: '14px 18px',
        position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          maxWidth: 560, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Link to="/talents" style={{
            color: M.cream, textDecoration: 'none',
            background: 'rgba(255,250,240,0.12)',
            border: `1px solid ${M.cream}25`,
            width: 32, height: 32, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeft size={15} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="m-display" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>
              Feed Talents
            </div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              {talents === null ? 'Chargement…' : `${talents.length} talent${talents.length > 1 ? 's' : ''} actif${talents.length > 1 ? 's' : ''}`}
            </div>
          </div>
          <button onClick={load} className="tap-card" style={{
            background: 'rgba(255,250,240,0.12)',
            border: `1px solid ${M.cream}25`,
            color: M.cream,
            width: 32, height: 32, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <main style={{ padding: '18px 14px 120px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {/* Error */}
          {error && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: 12,
              padding: 14,
              marginBottom: 14,
              fontSize: 13,
              color: '#991B1B',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Loading */}
          {talents === null && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '40px 0',
              color: M.inkSoft,
            }}>
              <Loader2 className="animate-spin" size={20} />
              <span style={{ fontSize: 12 }}>Récupération du feed…</span>
            </div>
          )}

          {/* Empty state */}
          {talents !== null && talents.length === 0 && !error && (
            <div style={{
              background: `linear-gradient(135deg, ${M.creamWarm}, ${M.cream})`,
              border: `1px dashed ${M.emerald}40`,
              borderRadius: 16,
              padding: 24,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
              <div className="m-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
                Pas encore de talents
              </div>
              <p style={{ fontSize: 13, color: M.inkSoft, margin: '0 0 14px', lineHeight: 1.5 }}>
                Sois le premier à poster ta vidéo. Une minute, ton talent, et tu apparais ici.
              </p>
              <a href={`${TALENTS_APP_URL}/signup`} className="tap-card" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: `linear-gradient(135deg, ${M.emerald}, ${M.greenDeep})`,
                color: M.cream,
                padding: '10px 16px', borderRadius: 100,
                fontSize: 13, fontWeight: 700,
                textDecoration: 'none',
              }}>
                Poster ma vidéo →
              </a>
            </div>
          )}

          {/* Grid */}
          {talents !== null && talents.length > 0 && (
            <ul style={{
              listStyle: 'none', padding: 0, margin: 0,
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
            }} className="m-stagger">
              {talents.map(t => (
                <li key={t.id}>
                  <a
                    href={`${TALENTS_APP_URL}/talent/${t.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="tap-card"
                    style={{
                      display: 'block', textDecoration: 'none', color: M.ink,
                      background: M.cream,
                      border: '1px solid rgba(31,41,55,0.06)',
                      borderRadius: 14,
                      overflow: 'hidden',
                      boxShadow: '0 6px 16px -8px rgba(0,0,0,0.1)',
                    }}
                  >
                    <div style={{
                      position: 'relative',
                      aspectRatio: '2 / 3',
                      background: `linear-gradient(135deg, ${M.greenDark}, ${M.greenDeep})`,
                      overflow: 'hidden',
                    }}>
                      {t.thumbnailUrl ? (
                        <img
                          src={t.thumbnailUrl}
                          alt={t.displayName}
                          loading="lazy"
                          decoding="async"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 40,
                        }}>
                          🎬
                        </div>
                      )}
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: `linear-gradient(180deg, transparent 60%, ${M.greenDark}cc)`,
                      }} />
                      <PlayCircle
                        size={32}
                        color={M.cream}
                        style={{
                          position: 'absolute',
                          top: '50%', left: '50%',
                          transform: 'translate(-50%, -50%)',
                          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
                        }}
                      />
                    </div>
                    <div style={{ padding: 10 }}>
                      <div className="m-display" style={{
                        fontSize: 13, fontWeight: 700, color: M.ink,
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {t.displayName}
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, color: M.inkSoft, marginTop: 4,
                      }}>
                        {t.city && <><MapPin size={9} /> {t.city}</>}
                        {t.city && t.sector && <span>·</span>}
                        {t.sector && <><Briefcase size={9} /> {t.sector}</>}
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
