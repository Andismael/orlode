/**
 * Orlode Influenceurs — premium editorial landing at /influenceurs.
 *
 * Faithful adaptation of user-provided maquette 2026-05-24 to TS +
 * Orlode infra (Firestore data, real routes, real auth). Visual:
 * dark ink hero `#0A0814` with cosmic orbs + grain, premium gold
 * accents `#D4A574`, Fraunces display italic, cream editorial sections,
 * artistic portrait collage hero.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Sparkles, Search, MessageCircle, Trophy,
  Camera, BadgeCheck, MapPin, Crown, Diamond, Flame,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import MarketplaceUserMenu from '@/components/common/MarketplaceUserMenu';
import { listActiveInfluencers, type Influencer } from '@/services/influencers';
import InfluencerPortrait, { type PortraitInfluencer } from './InfluencerPortrait';

const C = {
  brand: '#6366F1', brandDeep: '#4F46E5', brandDark: '#3730A3',
  brandDarker: '#1E1B4B', brandSoft: '#EEF2FF', brandLight: '#A5B4FC',
  gold: '#D4A574', goldDeep: '#B8895C', goldLight: '#E8C9A0',
  cream: '#FAF7F2', creamDeep: '#F0EBE3', creamWarm: '#F7F1E7',
  ink: '#0A0814', ink2: '#1F1B2E', ink3: '#3F3856',
  inkSoft: '#6B6480', inkLight: '#9A93AD', inkSilent: '#C9C3D6',
  success: '#059669', white: '#FFFFFF',
};

const formatK = (n?: number) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
};

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
.infl-root, .infl-root * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.infl-root { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; }
.infl-serif { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.025em; }
.infl-mono { font-family: 'JetBrains Mono', monospace; }
.infl-display-xl { font-family: 'Fraunces', serif; font-size: clamp(48px, 9vw, 132px); font-weight: 800; line-height: 0.92; letter-spacing: -0.045em; }
.infl-display-l  { font-family: 'Fraunces', serif; font-size: clamp(36px, 6vw, 86px); font-weight: 800; line-height: 0.95; letter-spacing: -0.035em; }
.infl-grain::before {
  content:''; position:absolute; inset:0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  opacity:0.08; pointer-events:none; mix-blend-mode:overlay;
}
@keyframes infl-shimmer { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
.infl-shimmer {
  background: linear-gradient(90deg, ${C.brandLight} 0%, ${C.goldLight} 50%, ${C.brandLight} 100%);
  background-size: 200% auto;
  background-clip: text; -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: infl-shimmer 5s linear infinite;
}
@keyframes infl-fadeUp { from{opacity:0; transform:translateY(24px);} to{opacity:1; transform:translateY(0);} }
.infl-fade-up { animation: infl-fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) backwards; }
.infl-d-100 { animation-delay:0.1s; } .infl-d-200 { animation-delay:0.2s; }
.infl-d-300 { animation-delay:0.3s; } .infl-d-400 { animation-delay:0.4s; }
.infl-d-500 { animation-delay:0.5s; }
@keyframes infl-float { 0%,100%{transform:translateY(0) rotate(0deg);} 50%{transform:translateY(-12px) rotate(2deg);} }
.infl-float { animation: infl-float 6s ease-in-out infinite; }
@keyframes infl-slowRotate { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
.infl-rotate { animation: infl-slowRotate 60s linear infinite; }
.infl-rotate-rev { animation: infl-slowRotate 90s linear infinite reverse; }
.infl-card { transition: all 0.4s cubic-bezier(0.16,1,0.3,1); will-change: transform; }
.infl-card:hover { transform: translateY(-6px); }
.infl-pill {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 14px; border-radius: 100px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
.infl-btn-cream {
  background: ${C.cream}; color: ${C.ink}; border: none;
  padding: 16px 28px; border-radius: 100px;
  font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer;
  display: inline-flex; align-items: center; gap: 10px;
  transition: all 0.25s ease; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3);
  text-decoration: none;
}
.infl-btn-cream:hover { transform: translateY(-2px); background: ${C.white}; }
.infl-btn-ghost {
  background: rgba(255,255,255,0.05); color: ${C.white};
  border: 1px solid rgba(255,255,255,0.15);
  backdrop-filter: blur(20px);
  padding: 15px 24px; border-radius: 100px;
  font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer;
  display: inline-flex; align-items: center; gap: 10px;
  transition: all 0.25s ease; text-decoration: none;
}
.infl-btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
@media (max-width: 1024px) { .infl-hide-mobile { display: none !important; } }
@media (max-width: 768px) {
  .infl-grid-1 { grid-template-columns: 1fr !important; }
  .infl-hero-collage { display: none !important; }
}
`;

export default function InfluencersLandingPage() {
  useSEO({
    title: 'Orlode Influenceurs — Marques + Créateurs, sans intermédiaire',
    description: 'Plateforme premium qui connecte marques et créateurs vérifiés. Brief, négo, deal — directement entre vous.',
    path: '/influenceurs',
  });

  const [featured, setFeatured] = useState<Influencer[]>([]);
  useEffect(() => {
    listActiveInfluencers(3).then(setFeatured).catch(() => setFeatured([]));
  }, []);

  return (
    <div className="infl-root" style={{ background: C.ink, color: C.cream, position: 'relative', overflow: 'hidden' }}>
      <style>{STYLES}</style>

      <Nav />

      {/* HERO */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        minHeight: '85vh',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: `radial-gradient(ellipse at 30% 20%, ${C.brandDeep}80, transparent 60%),
                       radial-gradient(ellipse at 80% 60%, ${C.brand}40, transparent 50%),
                       ${C.ink}`,
        }} />
        <div className="infl-grain" />

        <div className="infl-rotate" style={{
          position: 'absolute', top: '15%', right: '-15%',
          width: 700, height: 700, borderRadius: '50%',
          border: `1px dashed ${C.brandLight}30`, pointerEvents: 'none',
        }} />
        <div className="infl-rotate-rev" style={{
          position: 'absolute', top: '20%', right: '-10%',
          width: 500, height: 500, borderRadius: '50%',
          border: `1px dashed ${C.goldLight}25`, pointerEvents: 'none',
        }} />

        <div style={{
          position: 'relative', zIndex: 2,
          maxWidth: 1280, margin: '0 auto',
          padding: '80px 32px 100px',
          width: '100%',
        }}>
          <div className="infl-grid-1" style={{
            display: 'grid', gridTemplateColumns: '1.2fr 1fr',
            gap: 60, alignItems: 'center',
          }}>
            <div>
              <div className="infl-fade-up infl-pill" style={{
                background: 'rgba(212,165,116,0.12)', color: C.goldLight,
                border: `1px solid ${C.gold}40`, backdropFilter: 'blur(20px)',
                marginBottom: 24,
              }}>
                <Sparkles size={11} /> Pour les marques exigeantes
              </div>

              <h1 className="infl-display-xl infl-fade-up infl-d-100" style={{ color: C.cream, margin: '0 0 28px' }}>
                Marques.<br />
                Créateurs.<br />
                <em className="infl-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
                  Sans intermédiaire.
                </em>
              </h1>

              <p className="infl-fade-up infl-d-200" style={{
                fontSize: 19, color: C.inkSilent, lineHeight: 1.55,
                margin: '0 0 36px', maxWidth: 540,
              }}>
                La plateforme premium qui connecte les marques aux <strong style={{ color: C.cream }}>créateurs vérifiés</strong>, partout dans le monde. Brief, négo, deal — directement entre vous.
              </p>

              <div className="infl-fade-up infl-d-300" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 56 }}>
                <Link to="/influenceurs/feed" className="infl-btn-cream">
                  <Search size={15} /> Trouver un créateur
                </Link>
                <Link to="/influenceurs/inscription" className="infl-btn-ghost">
                  <Camera size={15} /> Je suis créateur
                </Link>
              </div>

              <div className="infl-fade-up infl-d-400" style={{
                display: 'flex', gap: 40, flexWrap: 'wrap',
                paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.08)',
              }}>
                {[
                  { v: '0%',    l: 'Commission cachée' },
                  { v: '< 24h', l: 'Brief → Premier contact' },
                  { v: '100%',  l: 'Créateurs vérifiés' },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="infl-serif" style={{
                      fontSize: 32, fontWeight: 700, color: C.cream,
                      letterSpacing: '-0.03em', lineHeight: 1,
                    }}>
                      <em style={{ fontStyle: 'italic', color: C.goldLight }}>{s.v}</em>
                    </div>
                    <div style={{
                      fontSize: 11, color: C.inkLight, fontWeight: 600,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      marginTop: 6,
                    }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Portrait collage — desktop only */}
            <div className="infl-fade-up infl-d-500 infl-hero-collage" style={{
              position: 'relative', height: 540,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {featured[0] && (
                <div style={{ position: 'relative', zIndex: 3 }}>
                  <InfluencerPortrait inf={featured[0] as PortraitInfluencer} size={260} />
                </div>
              )}
              {featured[1] && (
                <div className="infl-float" style={{ position: 'absolute', top: 20, right: -10, zIndex: 2 }}>
                  <InfluencerPortrait inf={featured[1] as PortraitInfluencer} size={150} />
                </div>
              )}
              {featured[2] && (
                <div className="infl-float" style={{ position: 'absolute', bottom: 30, left: -20, zIndex: 2, animationDelay: '2s' }}>
                  <InfluencerPortrait inf={featured[2] as PortraitInfluencer} size={150} />
                </div>
              )}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 460, height: 460, borderRadius: '50%',
                background: `radial-gradient(circle, ${C.brand}30 0%, transparent 70%)`,
                filter: 'blur(60px)', zIndex: 1,
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE — cream section */}
      <section style={{ background: C.cream, color: C.ink, padding: '120px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <div className="infl-pill" style={{
              background: C.brandSoft, color: C.brand,
              border: `1px solid ${C.brand}30`, marginBottom: 20,
            }}>
              <Diamond size={11} /> Une expérience premium
            </div>
            <h2 className="infl-display-l" style={{ color: C.ink, margin: '0 0 16px' }}>
              Trois étapes.<br />
              <em className="infl-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>Zéro friction.</em>
            </h2>
            <p style={{ fontSize: 17, color: C.inkSoft, maxWidth: 580, margin: '0 auto', lineHeight: 1.55 }}>
              Pas de mise en relation floue. Pas de commission cachée. Juste un workflow direct entre vous et vos créateurs.
            </p>
          </div>

          <div className="infl-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              { step: '01', title: 'Découvre', desc: 'Annuaire complet de créateurs vérifiés. Filtre par catégorie, audience, ville. Tout est transparent.', Icon: Search, accent: C.brand },
              { step: '02', title: 'Connecte', desc: 'Brief direct au créateur. Pas d\'intermédiaire qui ralentit. Négociation en direct via WhatsApp.', Icon: MessageCircle, accent: C.gold },
              { step: '03', title: 'Collabore', desc: 'Deal signé, paiement sécurisé, livrables trackés. Mesure d\'impact intégrée pour chaque campagne.', Icon: Trophy, accent: C.success },
            ].map((s, i) => {
              const Icon = s.Icon;
              return (
                <div key={i} className="infl-card" style={{
                  background: C.white, border: `1px solid ${C.creamDeep}`,
                  borderRadius: 24, padding: 36,
                }}>
                  <div className="infl-mono" style={{
                    fontSize: 11, fontWeight: 700, color: C.inkLight,
                    letterSpacing: '0.15em', marginBottom: 32,
                  }}>{s.step} / 03</div>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: `linear-gradient(135deg, ${s.accent}15, ${s.accent}05)`,
                    border: `1px solid ${s.accent}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: s.accent, marginBottom: 24,
                  }}>
                    <Icon size={26} strokeWidth={1.75} />
                  </div>
                  <h3 className="infl-serif" style={{ fontSize: 32, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.025em' }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.6, margin: 0 }}>
                    {s.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURED CREATORS — dark editorial */}
      {featured.length > 0 && (
        <section style={{
          background: C.ink, padding: '120px 32px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div className="infl-grain" />
          <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-end', marginBottom: 56, flexWrap: 'wrap', gap: 20,
            }}>
              <div>
                <div className="infl-pill" style={{
                  background: 'rgba(212,165,116,0.12)', color: C.goldLight,
                  border: `1px solid ${C.gold}40`, marginBottom: 16,
                }}>
                  <Crown size={11} /> Sélection éditoriale
                </div>
                <h2 className="infl-display-l" style={{ color: C.cream, margin: 0 }}>
                  Des voix.<br />
                  <em className="infl-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>Des histoires.</em>
                </h2>
              </div>
              <Link to="/influenceurs/feed" className="infl-btn-ghost">
                Voir tous <ArrowUpRight size={15} />
              </Link>
            </div>

            <div className="infl-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {featured.map(inf => (
                <article key={inf.id} className="infl-card" style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 24, padding: 24, cursor: 'pointer',
                }}>
                  <Link to={`/influenceurs/${inf.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <InfluencerPortrait inf={inf as PortraitInfluencer} size={280} />
                    <div style={{ marginTop: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <h3 className="infl-serif" style={{
                          fontSize: 24, fontWeight: 700, color: C.cream,
                          margin: 0, letterSpacing: '-0.02em',
                        }}>
                          {inf.displayName}
                        </h3>
                        {inf.verified && (
                          <BadgeCheck size={16} color="#1D9BF0" fill="#1D9BF0" stroke={C.ink} strokeWidth={2.5} />
                        )}
                      </div>
                      {inf.bio && (
                        <p style={{
                          fontSize: 13, color: C.inkLight, margin: '0 0 12px',
                          fontStyle: 'italic', lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>« {inf.bio} »</p>
                      )}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        fontSize: 12, color: C.inkSilent,
                      }}>
                        <span className="infl-mono" style={{ color: C.goldLight, fontWeight: 700 }}>
                          {formatK(inf.audience?.total)} followers
                        </span>
                        {inf.city && <>
                          <span style={{ opacity: 0.5 }}>·</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={11} /> {inf.city}
                          </span>
                        </>}
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA FOOTER */}
      <section style={{
        background: `linear-gradient(135deg, ${C.brandDarker} 0%, ${C.brandDeep} 100%)`,
        padding: '120px 32px', position: 'relative', overflow: 'hidden',
      }}>
        <div className="infl-grain" />
        <div className="infl-rotate" style={{
          position: 'absolute', top: '-30%', left: '-15%',
          width: 600, height: 600, borderRadius: '50%',
          border: `1px dashed ${C.goldLight}30`, pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div className="infl-pill" style={{
            background: 'rgba(255,255,255,0.12)', color: C.cream,
            border: `1px solid ${C.goldLight}40`, marginBottom: 24,
          }}>
            <Flame size={11} /> Bêta limitée — Marques pionnières
          </div>
          <h2 className="infl-display-l" style={{ color: C.cream, margin: '0 0 24px' }}>
            Ta prochaine collab,<br />
            <em className="infl-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>à un clic.</em>
          </h2>
          <p style={{
            fontSize: 18, color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.55, margin: '0 auto 40px', maxWidth: 580,
          }}>
            Rejoins les marques d'avant-garde qui construisent l'influence avec authenticité et transparence.
          </p>
          <Link to="/influenceurs/feed" className="infl-btn-cream" style={{ fontSize: 16, padding: '18px 32px' }}>
            Commencer maintenant <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Nav() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(10,8,20,0.7)', backdropFilter: 'blur(24px) saturate(180%)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '16px 32px',
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link to="/influenceurs" style={{
          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})`,
            color: C.white, fontWeight: 800, fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Fraunces, serif',
            boxShadow: `0 6px 20px -6px ${C.brand}80`,
          }}>O</div>
          <div style={{ textAlign: 'left' }}>
            <div className="infl-serif" style={{
              fontSize: 17, fontWeight: 700, color: C.cream,
              letterSpacing: '-0.02em', lineHeight: 1,
            }}>
              Orlode <em style={{ fontStyle: 'italic', color: C.goldLight }}>Influenceurs</em>
            </div>
            <div className="infl-mono" style={{
              fontSize: 9, fontWeight: 600, color: C.inkSilent,
              letterSpacing: '0.1em', marginTop: 2,
            }}>BÊTA · GLOBAL</div>
          </div>
        </Link>

        <nav className="infl-hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link to="/influenceurs/feed" style={{
            color: C.inkSilent, textDecoration: 'none',
            padding: '10px 18px', borderRadius: 100,
            fontSize: 14, fontWeight: 600,
          }}>Annuaire</Link>
          <Link to="/influenceurs/inscription" style={{
            color: C.inkSilent, textDecoration: 'none',
            padding: '10px 18px', borderRadius: 100,
            fontSize: 14, fontWeight: 600,
          }}>Devenir créateur</Link>
        </nav>

        <MarketplaceUserMenu product="influencers" variant="dark" brandColor={C.brand} brandDeepColor={C.brandDeep} />
      </div>
    </header>
  );
}
