/**
 * Orlode Influenceurs — premium editorial directory at /influenceurs/feed.
 * Cards = portrait + name + tagline italic + categories + followers count
 * with ArrowUpRight CTA. Sticky filter bar over cream background.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, BadgeCheck, Users, Loader2, X, Send,
} from 'lucide-react';
import { listActiveInfluencers, type Influencer } from '@/services/influencers';
import { useSEO } from '@/hooks/useSEO';
import InfluencerPortrait, { type PortraitInfluencer } from './InfluencerPortrait';
import api from '@/services/api';

const C = {
  brand: '#6366F1', brandDeep: '#4F46E5', brandSoft: '#EEF2FF',
  gold: '#D4A574', goldLight: '#E8C9A0',
  cream: '#FAF7F2', creamDeep: '#F0EBE3',
  ink: '#0A0814', ink3: '#3F3856', inkSoft: '#6B6480',
  inkLight: '#9A93AD', inkSilent: '#C9C3D6',
  success: '#059669', successSoft: '#D1FAE5', successDark: '#065F46',
  verified: '#1D9BF0', white: '#FFFFFF',
};

const CATEGORIES = ['Tous', 'Mode', 'Tech', 'Food', 'Fitness', 'Beauté', 'Business', 'Lifestyle'];

const formatK = (n?: number) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
};

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
.infld-root, .infld-root * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.infld-root { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; }
.infld-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
.infld-mono { font-family: 'JetBrains Mono', monospace; }
.infld-display-l { font-family: 'Fraunces', serif; font-size: clamp(36px, 6vw, 86px); font-weight: 800; line-height: 0.95; letter-spacing: -0.035em; }
.infld-grain::before {
  content:''; position:absolute; inset:0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  opacity:0.08; pointer-events:none; mix-blend-mode:overlay;
}
@keyframes infld-shimmer { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
.infld-shimmer {
  background: linear-gradient(90deg, #A5B4FC 0%, ${C.goldLight} 50%, #A5B4FC 100%);
  background-size: 200% auto;
  background-clip: text; -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: infld-shimmer 5s linear infinite;
}
@keyframes infld-rotate { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
.infld-rotate { animation: infld-rotate 90s linear infinite; }
.infld-card { transition: all 0.4s cubic-bezier(0.16,1,0.3,1); will-change: transform; }
.infld-card:hover { transform: translateY(-6px); }
.infld-pill {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 14px; border-radius: 100px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
.infld-hide-scroll::-webkit-scrollbar { display: none; }
.infld-hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
@keyframes infld-fadeUp { from{opacity:0; transform:translateY(24px);} to{opacity:1; transform:translateY(0);} }
.infld-fade { animation: infld-fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) backwards; }
`;

export default function InfluencersFeedPage() {
  useSEO({
    title: 'Annuaire — Orlode Influenceurs',
    description: 'Annuaire premium de créateurs vérifiés du monde entier. Filtre par catégorie, audience, ville.',
    path: '/influenceurs/feed',
  });

  const [params, setParams] = useSearchParams();
  const [all, setAll] = useState<Influencer[] | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacting, setContacting] = useState<Influencer | null>(null);
  const activeCat = params.get('cat') ?? 'Tous';

  useEffect(() => {
    listActiveInfluencers(80)
      .then(setAll)
      .catch(err => { setError((err as Error).message); setAll([]); });
  }, []);

  const filtered = useMemo(() => {
    if (!all) return null;
    let list = all;
    if (activeCat !== 'Tous') list = list.filter(i => (i.categories ?? []).includes(activeCat));
    if (onlyAvailable) list = list.filter(i => i.status === 'active');
    return list;
  }, [all, activeCat, onlyAvailable]);

  return (
    <div className="infld-root" style={{ background: C.cream, minHeight: '100vh' }}>
      <style>{STYLES}</style>

      {/* Hero dark */}
      <section style={{
        background: C.ink, color: C.cream,
        padding: '80px 32px 100px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 70% 30%, ${C.brand}40, transparent 60%)`,
        }} />
        <div className="infld-grain" />
        <div className="infld-rotate" style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: 500, height: 500, borderRadius: '50%',
          border: `1px dashed ${C.goldLight}25`, pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <Link to="/influenceurs" style={{
            color: C.inkSilent, fontSize: 13, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24,
          }}>← Retour à l'accueil</Link>

          <div className="infld-pill infld-fade" style={{
            background: 'rgba(212,165,116,0.12)', color: C.goldLight,
            border: `1px solid ${C.gold}40`, marginBottom: 20,
          }}>
            <Users size={11} /> {all?.length ?? '—'} créateurs vérifiés
          </div>
          <h1 className="infld-display-l infld-fade" style={{ color: C.cream, margin: '0 0 16px', animationDelay: '0.1s' }}>
            Trouve le créateur<br />
            <em className="infld-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
              qui te ressemble.
            </em>
          </h1>
          <p className="infld-fade" style={{
            fontSize: 17, color: C.inkSilent,
            margin: 0, maxWidth: 580, lineHeight: 1.55,
            animationDelay: '0.2s',
          }}>
            Sélectionnés à la main. Vérifiés un par un. Prêts pour ta prochaine campagne — partout dans le monde.
          </p>
        </div>
      </section>

      {/* Filter bar sticky */}
      <section style={{
        background: C.cream, borderBottom: `1px solid ${C.creamDeep}`,
        padding: '20px 32px',
        position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div className="infld-hide-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
              {CATEGORIES.map(cat => {
                const active = activeCat === cat;
                return (
                  <button key={cat} onClick={() => {
                    if (cat === 'Tous') params.delete('cat'); else params.set('cat', cat);
                    setParams(params);
                  }} style={{
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

            <button onClick={() => setOnlyAvailable(!onlyAvailable)} style={{
              background: onlyAvailable ? C.successSoft : C.white,
              border: `1.5px solid ${onlyAvailable ? C.success : C.creamDeep}`,
              padding: '8px 14px', borderRadius: 100,
              display: 'inline-flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}>
              <div style={{
                width: 30, height: 18, borderRadius: 100,
                background: onlyAvailable ? C.success : '#D1D5DB',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <div style={{
                  position: 'absolute', top: 2,
                  left: onlyAvailable ? 14 : 2,
                  width: 14, height: 14, borderRadius: '50%',
                  background: C.white, transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: onlyAvailable ? C.successDark : C.ink3 }}>
                Dispo maintenant
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section style={{ padding: '48px 32px 80px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FCA5A5',
              borderRadius: 12, padding: 14, marginBottom: 20,
              fontSize: 13, color: '#991B1B',
            }}>⚠️ {error}</div>
          )}

          {filtered === null ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.inkSoft }}>
              <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              background: C.white, border: `1px dashed ${C.brand}40`,
              borderRadius: 24, padding: 48, textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎬</div>
              <div className="infld-serif" style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
                {activeCat === 'Tous' ? 'Annuaire en construction' : `Pas encore de créateur en ${activeCat}`}
              </div>
              <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 16px' }}>
                Les premiers créateurs arrivent. En attendant, inscris-toi pour être notifié·e.
              </p>
              <Link to="/influenceurs/inscription" style={{
                background: C.ink, color: C.cream,
                padding: '10px 22px', borderRadius: 100,
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}>S'inscrire →</Link>
            </div>
          ) : (
            <>
              <div style={{
                marginBottom: 32,
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap',
              }}>
                <h2 className="infld-serif" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>
                  <strong className="infld-mono" style={{ fontWeight: 700 }}>{filtered.length}</strong>
                  <span style={{ color: C.inkSoft, fontWeight: 500, fontFamily: 'Inter' }}>
                    {' '}créateur{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
                  </span>
                </h2>
                <span className="infld-mono" style={{ fontSize: 11, color: C.inkLight, letterSpacing: '0.05em' }}>
                  CURATED · 2026
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 24,
              }}>
                {filtered.map((inf, i) => (
                  <article key={inf.id} className="infld-card infld-fade" style={{
                    background: C.white, border: `1px solid ${C.creamDeep}`,
                    borderRadius: 24, padding: 20,
                    cursor: 'pointer',
                    animationDelay: `${i * 0.05}s`,
                  }}>
                    <Link to={`/influenceurs/${inf.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <InfluencerPortrait inf={inf as PortraitInfluencer} size={240} />
                      <div style={{ marginTop: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <h3 className="infld-serif" style={{
                            fontSize: 22, fontWeight: 700, color: C.ink,
                            margin: 0, letterSpacing: '-0.02em',
                          }}>{inf.displayName}</h3>
                          {inf.verified && (
                            <BadgeCheck size={15} color={C.verified} fill={C.verified} stroke={C.white} strokeWidth={2.5} />
                          )}
                        </div>
                        {inf.bio && (
                          <p style={{
                            fontSize: 13, color: C.inkSoft, margin: '0 0 12px',
                            fontStyle: 'italic', lineHeight: 1.45,
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>« {inf.bio} »</p>
                        )}
                        {(inf.categories ?? []).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                            {inf.categories!.slice(0, 3).map(c => (
                              <span key={c} style={{
                                background: C.creamDeep, color: C.ink3,
                                padding: '4px 10px', borderRadius: 100,
                                fontSize: 11, fontWeight: 600,
                              }}>{c}</span>
                            ))}
                          </div>
                        )}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          paddingTop: 12, borderTop: `1px solid ${C.creamDeep}`,
                        }}>
                          <div className="infld-mono" style={{
                            fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em',
                          }}>
                            {formatK(inf.audience?.total)}
                            <span style={{ fontSize: 10, fontWeight: 600, color: C.inkLight, marginLeft: 4, letterSpacing: '0.05em' }}>
                              FOLLOWERS
                            </span>
                          </div>
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setContacting(inf); }} style={{
                            background: 'transparent', border: 'none', color: C.brand, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                          }}>
                            Contacter <ArrowUpRight size={14} />
                          </button>
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {contacting && (
        <ContactModal
          influencer={contacting}
          onClose={() => setContacting(null)}
          onSent={() => setContacting(null)}
        />
      )}
    </div>
  );
}

// ── Contact modal (kept from earlier — adapts to premium palette) ─────────
function ContactModal({ influencer, onClose, onSent }: {
  influencer: Influencer; onClose: () => void; onSent: () => void;
}) {
  const navigate = useNavigate();
  const firstName = (influencer.displayName ?? '').split(' ')[0] || 'créateur';
  const [message, setMessage] = useState(
    `Bonjour ${firstName}, on a vu ton profil sur Orlode Influenceurs et ton contenu nous intéresse pour une collaboration. Tu es disponible pour en discuter cette semaine ?`,
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (sending || message.trim().length < 10) return;
    setSending(true); setError(null);
    try {
      await api.post('/influencers/contact', { influencerId: influencer.id, message: message.trim() });
      setSent(true);
      setTimeout(() => { onSent(); navigate('/influenceurs/inbox'); }, 1200);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string; status?: number };
      if (e.status === 401) setError('Connecte-toi pour contacter un créateur.');
      else setError(e.response?.data?.message ?? e.message ?? 'Erreur');
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, background: 'rgba(10,8,20,0.7)',
      backdropFilter: 'blur(8px)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 24,
        width: '100%', maxWidth: 500, overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})`,
          padding: '22px 26px', color: C.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Contacter {firstName}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>
              VIA WHATSAPP · ORLODE INFLUENCEURS
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', color: C.cream,
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={15} /></button>
        </div>

        <div style={{ padding: 24 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                Message envoyé
              </div>
              <p style={{ fontSize: 14, color: C.inkSoft, margin: 0 }}>
                Tu vas être redirigé·e vers ton inbox…
              </p>
            </div>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.ink3, marginBottom: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                Ton message
              </label>
              <textarea
                value={message} onChange={e => setMessage(e.target.value)}
                rows={6} disabled={sending}
                style={{
                  width: '100%', background: C.white,
                  border: `1.5px solid ${C.creamDeep}`, borderRadius: 12,
                  padding: '14px 16px', fontSize: 14, fontFamily: 'inherit',
                  resize: 'vertical', outline: 'none', lineHeight: 1.55,
                }}
              />
              <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
                Envoyé sur WhatsApp via Orlode. Le créateur répond direct — tu reçois sa réponse dans ton <strong>inbox Orlode</strong>.
              </p>
              {error && (
                <div style={{
                  background: '#FEE2E2', border: '1px solid #FCA5A5',
                  borderRadius: 10, padding: 12, marginTop: 12,
                  fontSize: 12, color: '#991B1B',
                }}>⚠️ {error}</div>
              )}
            </>
          )}
        </div>

        {!sent && (
          <div style={{
            padding: '14px 24px', borderTop: `1px solid ${C.creamDeep}`,
            background: C.creamDeep,
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>
            <button onClick={onClose} disabled={sending} style={{
              background: C.white, color: C.ink, border: `1px solid ${C.creamDeep}`,
              padding: '11px 18px', borderRadius: 100,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>Annuler</button>
            <button onClick={send} disabled={sending || message.trim().length < 10} style={{
              background: `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})`,
              color: C.cream, border: 'none',
              padding: '11px 20px', borderRadius: 100,
              fontSize: 13, fontWeight: 600,
              cursor: sending ? 'wait' : 'pointer',
              opacity: message.trim().length < 10 ? 0.4 : 1, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: `0 10px 30px -8px ${C.brand}80`,
            }}>
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Envoyer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
