/**
 * Orlode Influenceurs — public directory at /influenceurs/feed.
 * Loads active influencers from Firestore `influencers_profiles`,
 * filterable by category via the ?cat= query param.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Loader2, ArrowLeft, RefreshCw, BadgeCheck, MapPin, Instagram, Youtube,
  Music as TiktokIcon, TrendingUp, MessageCircle, Hash,
} from 'lucide-react';
import { listActiveInfluencers, formatAudience, type Influencer } from '@/services/influencers';
import { useSEO } from '@/hooks/useSEO';
import { M, MOBILE_CSS } from '@/components/mobile/mobileDesign';

const CATS = ['Mode', 'Tech', 'Food', 'Lifestyle', 'Fitness', 'Beauté'];

export default function InfluencersFeedPage() {
  useSEO({
    title: 'Annuaire — Orlode Influenceurs',
    description: 'Créateurs africains vérifiés. Filtre par catégorie, audience, engagement.',
    path: '/influenceurs/feed',
  });

  const [params, setParams] = useSearchParams();
  const [influencers, setInfluencers] = useState<Influencer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeCat = params.get('cat');

  const load = () => {
    setInfluencers(null);
    setError(null);
    listActiveInfluencers(80)
      .then(setInfluencers)
      .catch((e: unknown) => {
        setError((e as Error).message || 'Erreur de chargement');
        setInfluencers([]);
      });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!influencers) return null;
    if (!activeCat) return influencers;
    return influencers.filter(i => (i.categories ?? []).includes(activeCat));
  }, [influencers, activeCat]);

  return (
    <div className="m-root" style={{ minHeight: '100vh', background: M.cream }}>
      <style>{MOBILE_CSS}</style>

      <header style={{
        background: `linear-gradient(135deg, #2E1065, ${M.violetDeep})`,
        color: M.cream,
        padding: '14px 18px',
        position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          maxWidth: 560, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Link to="/influenceurs" style={{
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
              Annuaire Influenceurs
            </div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              {filtered === null ? 'Chargement…' : `${filtered.length} créateur${filtered.length > 1 ? 's' : ''}${activeCat ? ` · ${activeCat}` : ''}`}
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

        {/* Filter chips */}
        <div className="ios-chip-row" style={{
          maxWidth: 560, margin: '12px auto 0',
          display: 'flex', gap: 6, overflowX: 'auto',
        }}>
          <button onClick={() => { params.delete('cat'); setParams(params); }} className="tap-card" style={{
            background: !activeCat ? M.cream : 'rgba(255,250,240,0.12)',
            color: !activeCat ? M.violetDeep : M.cream,
            border: !activeCat ? 'none' : `1px solid ${M.cream}25`,
            padding: '6px 12px', borderRadius: 100,
            fontSize: 11, fontWeight: 700,
            whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
          }}>
            Tous
          </button>
          {CATS.map(c => (
            <button key={c} onClick={() => { params.set('cat', c); setParams(params); }} className="tap-card" style={{
              background: activeCat === c ? M.cream : 'rgba(255,250,240,0.12)',
              color: activeCat === c ? M.violetDeep : M.cream,
              border: activeCat === c ? 'none' : `1px solid ${M.cream}25`,
              padding: '6px 12px', borderRadius: 100,
              fontSize: 11, fontWeight: 700,
              whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
            }}>
              {c}
            </button>
          ))}
        </div>
      </header>

      <main style={{ padding: '18px 14px 120px' }}>
        <div className="m-wrap-xl" style={{ maxWidth: 560, margin: '0 auto' }}>
          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FCA5A5',
              borderRadius: 12, padding: 14, marginBottom: 14,
              fontSize: 13, color: '#991B1B',
            }}>⚠️ {error}</div>
          )}

          {filtered === null && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '40px 0', color: M.inkSoft,
            }}>
              <Loader2 className="animate-spin" size={20} />
              <span style={{ fontSize: 12 }}>Chargement de l'annuaire…</span>
            </div>
          )}

          {filtered !== null && filtered.length === 0 && !error && (
            <div style={{
              background: `linear-gradient(135deg, ${M.violetSoft}, ${M.cream})`,
              border: `1px dashed ${M.violet}40`,
              borderRadius: 16, padding: 24, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
              <div className="m-display" style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
                {activeCat ? `Pas encore de créateur en ${activeCat}` : 'Annuaire en construction'}
              </div>
              <p style={{ fontSize: 13, color: M.inkSoft, margin: '0 0 14px', lineHeight: 1.5 }}>
                Les créateurs vérifiés arrivent. En attendant, inscris-toi pour être notifié.
              </p>
            </div>
          )}

          {filtered !== null && filtered.length > 0 && (
            <ul style={{
              listStyle: 'none', padding: 0, margin: 0,
              display: 'grid', gridTemplateColumns: '1fr', gap: 12,
            }} className="m-stagger m-grid-md-2 m-grid-lg-3">
              {filtered.map(i => (
                <li key={i.id}>
                  <article className="tap-card" style={{
                    background: M.cream,
                    border: '1px solid rgba(31,41,55,0.06)',
                    borderRadius: 16,
                    padding: 14,
                    display: 'flex', gap: 12,
                    boxShadow: '0 6px 16px -8px rgba(0,0,0,0.1)',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})`,
                      color: M.cream, fontWeight: 800, fontSize: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      backgroundImage: i.avatarUrl ? `url(${i.avatarUrl})` : undefined,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                    }}>
                      {!i.avatarUrl && (i.displayName?.[0]?.toUpperCase() ?? '?')}
                    </div>

                    {/* Body */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span className="m-display" style={{ fontSize: 14, fontWeight: 700, color: M.ink }}>
                          {i.displayName}
                        </span>
                        {i.verified && <BadgeCheck size={13} color="#1D9BF0" fill="#1D9BF0" />}
                      </div>
                      {i.handle && (
                        <div style={{ fontSize: 11, color: M.inkSoft, marginTop: 1 }}>
                          {i.handle}
                        </div>
                      )}
                      {i.bio && (
                        <p style={{
                          fontSize: 12, color: M.inkSoft, margin: '6px 0 0', lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>{i.bio}</p>
                      )}

                      {/* Stats row */}
                      <div style={{
                        display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap',
                        fontSize: 10, color: M.inkSoft,
                      }}>
                        {i.audience?.total && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <strong className="m-mono" style={{ color: M.violetDeep, fontSize: 11 }}>
                              {formatAudience(i.audience.total)}
                            </strong> total
                          </span>
                        )}
                        {typeof i.engagement === 'number' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <TrendingUp size={9} color={M.emerald} />
                            <strong className="m-mono" style={{ color: M.emeraldDeep, fontSize: 11 }}>
                              {i.engagement.toFixed(1)}%
                            </strong>
                          </span>
                        )}
                        {i.city && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={9} /> {i.city}
                          </span>
                        )}
                      </div>

                      {/* Categories */}
                      {(i.categories ?? []).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                          {i.categories!.slice(0, 3).map(c => (
                            <span key={c} className="m-pill" style={{
                              background: M.violetSoft, color: M.violetDeep,
                              fontSize: 9, padding: '2px 7px',
                            }}>{c}</span>
                          ))}
                        </div>
                      )}

                      {/* Socials */}
                      {i.audience && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, color: M.inkLight }}>
                          {!!i.audience.instagram && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                              <Instagram size={11} /> {formatAudience(i.audience.instagram)}
                            </span>
                          )}
                          {!!i.audience.tiktok && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                              <TiktokIcon size={11} /> {formatAudience(i.audience.tiktok)}
                            </span>
                          )}
                          {!!i.audience.youtube && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                              <Youtube size={11} /> {formatAudience(i.audience.youtube)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contact CTA */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0 }}>
                      {i.status === 'busy' && (
                        <span className="m-pill" style={{
                          background: M.goldSoft, color: M.goldDeep,
                          fontSize: 9, padding: '2px 6px',
                        }}>Occupé</span>
                      )}
                      {i.status === 'active' && (
                        <span className="m-pill" style={{
                          background: M.emeraldSoft, color: M.emeraldDark,
                          fontSize: 9, padding: '2px 6px',
                        }}>Dispo</span>
                      )}
                      <button className="tap-card" style={{
                        background: `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})`,
                        color: M.cream, border: 'none',
                        width: 38, height: 38, borderRadius: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: `0 6px 14px -4px ${M.violet}`,
                      }}>
                        <MessageCircle size={16} />
                      </button>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
