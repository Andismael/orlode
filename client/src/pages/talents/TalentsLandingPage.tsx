/**
 * Orlode Talents — premium editorial landing.
 * Faithfully replicates user-provided maquette 2026-05-24.
 *
 * Dark editorial green hero (#031A11) + cream sections (#FAF7F2) +
 * gold accent (#D4A574) + Fraunces italic display + video-card collage.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Video, Send, MessageCircle,
  Globe, Zap, Flame, Crown, Building, Eye, MapPin, Clock, Play,
} from 'lucide-react';
import { listActiveTalents, type Talent } from '@/services/talents';
import { useSEO } from '@/hooks/useSEO';
import TalentVideoCard, { type CardTalent } from './TalentVideoCard';

const C = {
  brand: '#0F5C3F',
  brandDeep: '#0A4530',
  brandDark: '#063322',
  brandDarker: '#031A11',
  brandSoft: '#E8F5EE',
  brandLight: '#7FCAA6',
  brandMid: '#1B7A56',
  gold: '#D4A574',
  goldLight: '#E8C9A0',
  cream: '#FAF7F2',
  creamDeep: '#F0EBE3',
  ink: '#0A1410',
  ink2: '#1A2A22',
  inkSoft: '#5C6B62',
  inkLight: '#94A39A',
  inkSilent: '#C5CDC8',
  success: '#10B981',
  white: '#FFFFFF',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  .tlnd { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
  .tlnd-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
  .tlnd-mono { font-family: 'JetBrains Mono', monospace; }
  .tlnd-display-xl { font-family: 'Fraunces', serif; font-size: clamp(48px, 9vw, 132px); font-weight: 800; line-height: 0.92; letter-spacing: -0.045em; }
  .tlnd-display-l  { font-family: 'Fraunces', serif; font-size: clamp(36px, 6vw, 86px); font-weight: 800; line-height: 0.95; letter-spacing: -0.035em; }
  .tlnd-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 14px; border-radius: 100px;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  @keyframes tlnd-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  .tlnd-shimmer {
    background: linear-gradient(90deg, ${C.brandLight} 0%, ${C.goldLight} 50%, ${C.brandLight} 100%);
    background-size: 200% auto;
    background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: tlnd-shimmer 5s linear infinite;
  }
  @keyframes tlnd-fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  .tlnd-fade-up { animation: tlnd-fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) backwards; }
  .tlnd-d1{animation-delay:0.1s} .tlnd-d2{animation-delay:0.2s} .tlnd-d3{animation-delay:0.3s} .tlnd-d4{animation-delay:0.4s} .tlnd-d5{animation-delay:0.5s}
  @keyframes tlnd-float { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-14px) rotate(-1.5deg)} }
  .tlnd-float { animation: tlnd-float 6s ease-in-out infinite; }
  @keyframes tlnd-floatAlt { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-10px) rotate(2deg)} }
  .tlnd-float-alt { animation: tlnd-floatAlt 5s ease-in-out infinite; }
  @keyframes tlnd-slowRotate { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .tlnd-rot { animation: tlnd-slowRotate 60s linear infinite; }
  .tlnd-rot-rev { animation: tlnd-slowRotate 90s linear infinite reverse; }
  .tlnd-btn-cream {
    background: ${C.cream}; color: ${C.ink};
    border: none; padding: 16px 28px; border-radius: 100px;
    font-size: 15px; font-weight: 600; cursor: pointer;
    display: inline-flex; align-items: center; gap: 10px;
    transition: all 0.25s ease;
    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3);
    text-decoration: none; letter-spacing: -0.01em;
  }
  .tlnd-btn-cream:hover { transform: translateY(-2px); background: ${C.white}; }
  .tlnd-btn-ghost {
    background: rgba(255,255,255,0.05); color: ${C.white};
    border: 1px solid rgba(255,255,255,0.15);
    backdrop-filter: blur(20px);
    padding: 15px 24px; border-radius: 100px;
    font-size: 15px; font-weight: 600; cursor: pointer;
    display: inline-flex; align-items: center; gap: 10px;
    transition: all 0.25s ease;
    text-decoration: none; letter-spacing: -0.01em;
  }
  .tlnd-btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
  .tlnd-btn-primary {
    background: linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep});
    color: ${C.white}; border: none;
    padding: 16px 28px; border-radius: 100px;
    font-size: 15px; font-weight: 600; cursor: pointer;
    display: inline-flex; align-items: center; gap: 10px;
    transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 10px 30px -8px ${C.brand}80;
    text-decoration: none; letter-spacing: -0.01em;
  }
  .tlnd-btn-primary:hover { transform: translateY(-2px); }
  .tlnd-card {
    transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
    will-change: transform;
  }
  .tlnd-card:hover { transform: translateY(-6px); }
  @media (max-width: 768px) {
    .tlnd-grid-1 { grid-template-columns: 1fr !important; }
  }
`;

const DEMO_TALENTS: CardTalent[] = [
  { id: 'demo-1', displayName: 'Marc Kouassi',  firstName: 'Marc',  sector: 'Tech',        city: 'Abidjan',  videoDuration: 58, viewsCount: 1247, contactsCount: 18, status: 'active', portraitGradient: ['#0F5C3F', '#063322', '#D4A574'] },
  { id: 'demo-2', displayName: 'Awa Diallo',    firstName: 'Awa',   sector: 'Design',      city: 'Dakar',    videoDuration: 52, viewsCount: 892,  contactsCount: 23, status: 'active', portraitGradient: ['#D4A574', '#B8895C', '#0F5C3F'] },
  { id: 'demo-3', displayName: 'Yannick Mbarga',firstName: 'Yannick', sector: 'Marketing', city: 'Douala',   videoDuration: 60, viewsCount: 2341, contactsCount: 34, status: 'active', portraitGradient: ['#1B7A56', '#063322', '#D4A574'] },
  { id: 'demo-4', displayName: 'Fatou Sow',     firstName: 'Fatou', sector: 'Hospitalité', city: 'Plateau',  videoDuration: 55, viewsCount: 5621, contactsCount: 67, status: 'active', portraitGradient: ['#F0C674', '#B8895C', '#0F5C3F'] },
  { id: 'demo-5', displayName: 'David Bamba',   firstName: 'David', sector: 'Finance',     city: 'Cocody',   videoDuration: 60, viewsCount: 743,  contactsCount: 12, status: 'active', portraitGradient: ['#0F5C3F', '#1B7A56', '#D4A574'] },
  { id: 'demo-6', displayName: 'Aminata Touré', firstName: 'Aminata', sector: 'Créatif',   city: 'Yopougon', videoDuration: 48, viewsCount: 3287, contactsCount: 41, status: 'active', portraitGradient: ['#5BB088', '#0F5C3F', '#D4A574'] },
];

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

export default function TalentsLandingPage() {
  useSEO({
    title: 'Orlode Talents — Montre qui tu es. Trouve ton job.',
    description: "1 minute de vidéo brute. Les entreprises te trouvent par ce que tu sais vraiment faire.",
    path: '/talents',
  });

  const [featured, setFeatured] = useState<CardTalent[]>(DEMO_TALENTS);

  useEffect(() => {
    listActiveTalents(6)
      .then(arr => { if (arr.length > 0) setFeatured(arr.map(toCardTalent)); })
      .catch(() => {});
  }, []);

  const cards = featured.length >= 6 ? featured : [...featured, ...DEMO_TALENTS.slice(featured.length)];

  return (
    <div className="tlnd">
      <style>{STYLES}</style>

      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10, 20, 16, 0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 32px',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <Link to="/talents" style={{
            background: 'none', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})`,
              color: C.white, fontWeight: 800, fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif',
              boxShadow: `0 6px 20px -6px ${C.brand}80`,
            }}>O</div>
            <div style={{ textAlign: 'left' }}>
              <div className="tlnd-serif" style={{
                fontSize: 17, fontWeight: 700, color: C.cream, lineHeight: 1,
              }}>
                Orlode <em style={{ fontStyle: 'italic', color: C.goldLight }}>Talents</em>
              </div>
              <div className="tlnd-mono" style={{
                fontSize: 9, fontWeight: 600, color: C.inkSilent,
                letterSpacing: '0.1em', marginTop: 2,
              }}>
                GLOBAL · 20+ PAYS
              </div>
            </div>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/talents/feed" style={{
              color: C.inkSilent, textDecoration: 'none',
              padding: '10px 18px', borderRadius: 100,
              fontSize: 14, fontWeight: 600,
            }}>Feed</Link>
            <Link to="/talents/inscription" className="tlnd-btn-cream" style={{
              padding: '11px 20px', fontSize: 13,
            }}>
              Poster ma vidéo <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section style={{
        background: C.brandDarker,
        color: C.cream,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '95vh',
          background: `radial-gradient(ellipse at 75% 25%, ${C.brand}60, transparent 55%),
                       radial-gradient(ellipse at 25% 65%, ${C.brandMid}40, transparent 50%),
                       ${C.brandDarker}`,
        }} />
        <div className="tlnd-rot" style={{
          position: 'absolute', top: '12%', right: '-18%',
          width: 750, height: 750, borderRadius: '50%',
          border: `1px dashed ${C.brandLight}25`, pointerEvents: 'none',
        }} />
        <div className="tlnd-rot-rev" style={{
          position: 'absolute', top: '18%', right: '-10%',
          width: 520, height: 520, borderRadius: '50%',
          border: `1px dashed ${C.goldLight}20`, pointerEvents: 'none',
        }} />

        <div style={{
          position: 'relative', zIndex: 2,
          maxWidth: 1280, margin: '0 auto',
          padding: '80px 32px 100px',
          minHeight: '85vh',
          display: 'flex', alignItems: 'center',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1.2fr 1fr',
            gap: 60, alignItems: 'center', width: '100%',
          }} className="tlnd-grid-1">
            <div>
              <div className="tlnd-fade-up tlnd-pill" style={{
                background: 'rgba(212, 165, 116, 0.12)',
                color: C.goldLight,
                border: `1px solid ${C.gold}40`,
                backdropFilter: 'blur(20px)',
                marginBottom: 24,
              }}>
                <Globe size={11} /> Global · 20+ pays · Bêta
              </div>

              <h1 className="tlnd-display-xl tlnd-fade-up tlnd-d1" style={{
                color: C.cream, margin: '0 0 28px',
              }}>
                Montre qui<br />tu es.<br />
                <em className="tlnd-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
                  Trouve ton job.
                </em>
              </h1>

              <p className="tlnd-fade-up tlnd-d2" style={{
                fontSize: 19, color: C.inkSilent,
                lineHeight: 1.55, margin: '0 0 36px',
                maxWidth: 540, fontWeight: 400,
              }}>
                Poste une vidéo d'<strong style={{ color: C.cream }}>1 minute</strong>. Pas de CV, pas de blabla. Les entreprises te trouvent par <strong style={{ color: C.cream }}>ce que tu sais vraiment faire</strong>.
              </p>

              <div className="tlnd-fade-up tlnd-d3" style={{
                display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 56,
              }}>
                <Link to="/talents/inscription" className="tlnd-btn-cream">
                  <Video size={15} /> Poster ma vidéo
                </Link>
                <Link to="/talents/feed" className="tlnd-btn-ghost">
                  <Play size={15} /> Découvrir les talents
                </Link>
              </div>

              <div className="tlnd-fade-up tlnd-d4" style={{
                display: 'flex', gap: 40, flexWrap: 'wrap',
                paddingTop: 32,
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}>
                {[
                  { value: '1 min', label: 'Vidéo brute' },
                  { value: '5 min', label: 'À publier' },
                  { value: 'WhatsApp', label: 'Contact direct' },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="tlnd-serif" style={{
                      fontSize: 32, fontWeight: 700, color: C.cream,
                      letterSpacing: '-0.03em', lineHeight: 1,
                    }}>
                      <em style={{ fontStyle: 'italic', color: C.goldLight }}>{s.value}</em>
                    </div>
                    <div style={{
                      fontSize: 11, color: C.inkLight, fontWeight: 600,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      marginTop: 6,
                    }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="tlnd-fade-up tlnd-d5" style={{
              position: 'relative', height: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ position: 'relative', zIndex: 3 }}>
                <Link to={`/talents/${cards[0]!.id}`} style={{ textDecoration: 'none' }}>
                  <TalentVideoCard talent={cards[0]!} size="hero" />
                </Link>
              </div>
              <div className="tlnd-float" style={{
                position: 'absolute', top: 40, right: -10, zIndex: 2,
              }}>
                <Link to={`/talents/${cards[3]!.id}`} style={{ textDecoration: 'none' }}>
                  <TalentVideoCard talent={cards[3]!} size="small" />
                </Link>
              </div>
              <div className="tlnd-float-alt" style={{
                position: 'absolute', bottom: 30, left: -30, zIndex: 2,
              }}>
                <Link to={`/talents/${cards[2]!.id}`} style={{ textDecoration: 'none' }}>
                  <TalentVideoCard talent={cards[2]!} size="small" />
                </Link>
              </div>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 500, height: 500, borderRadius: '50%',
                background: `radial-gradient(circle, ${C.brandLight}30 0%, transparent 70%)`,
                filter: 'blur(60px)', zIndex: 1,
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: C.cream, color: C.ink, padding: '120px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <div className="tlnd-pill" style={{
              background: C.brandSoft, color: C.brand,
              border: `1px solid ${C.brand}30`, marginBottom: 20,
            }}>
              <Zap size={11} /> Trois étapes simples
            </div>
            <h2 className="tlnd-display-l" style={{ color: C.ink, margin: '0 0 16px' }}>
              Filme. Publie.<br />
              <em className="tlnd-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
                Travaille.
              </em>
            </h2>
            <p style={{ fontSize: 17, color: C.inkSoft, maxWidth: 580, margin: '0 auto', lineHeight: 1.55 }}>
              Plus rapide qu'un CV. Plus humain qu'un profil LinkedIn. Plus efficace qu'un site d'emploi.
            </p>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
          }} className="tlnd-grid-1">
            {[
              { step: '01', title: 'Filme-toi', desc: "Prends ton téléphone, parle de ce que tu sais faire. 1 minute max. Pas de prod, pas de filtre. Sois toi-même.", Icon: Video, accent: C.brand },
              { step: '02', title: 'Publie', desc: 'Renseigne ton métier, tes compétences, ta dispo. En 5 minutes ton profil est en ligne et visible.', Icon: Send, accent: C.gold },
              { step: '03', title: 'Sois recruté', desc: 'Les entreprises te contactent directement via WhatsApp. Tu négocies sans intermédiaire. Tu commences vite.', Icon: MessageCircle, accent: C.success },
            ].map((s, i) => (
              <div key={i} className="tlnd-card" style={{
                background: C.white,
                border: `1px solid ${C.creamDeep}`,
                borderRadius: 24,
                padding: 36,
                position: 'relative', overflow: 'hidden',
              }}>
                <div className="tlnd-mono" style={{
                  fontSize: 11, fontWeight: 700, color: C.inkLight,
                  letterSpacing: '0.15em', marginBottom: 32,
                }}>
                  {s.step} / 03
                </div>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: `linear-gradient(135deg, ${s.accent}15, ${s.accent}05)`,
                  border: `1px solid ${s.accent}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: s.accent, marginBottom: 24,
                }}>
                  <s.Icon size={26} strokeWidth={1.75} />
                </div>
                <h3 className="tlnd-serif" style={{
                  fontSize: 32, fontWeight: 700, margin: '0 0 12px',
                  letterSpacing: '-0.025em',
                }}>{s.title}</h3>
                <p style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.6, margin: 0 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED TALENTS */}
      <section style={{
        background: C.brandDarker,
        padding: '120px 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-end', marginBottom: 56, flexWrap: 'wrap', gap: 20,
          }}>
            <div>
              <div className="tlnd-pill" style={{
                background: 'rgba(212, 165, 116, 0.12)',
                color: C.goldLight,
                border: `1px solid ${C.gold}40`,
                marginBottom: 16,
              }}>
                <Flame size={11} /> Talents du moment
              </div>
              <h2 className="tlnd-display-l" style={{ color: C.cream, margin: 0 }}>
                Des visages.<br />
                <em className="tlnd-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
                  Des compétences.
                </em>
              </h2>
            </div>
            <Link to="/talents/feed" className="tlnd-btn-ghost">
              Voir tout le feed <ArrowUpRight size={15} />
            </Link>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28,
            justifyItems: 'center',
          }} className="tlnd-grid-1">
            {cards.slice(0, 3).map(t => (
              <Link key={t.id} to={`/talents/${t.id}`} style={{ textDecoration: 'none' }}>
                <TalentVideoCard talent={t} size="large" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FOR COMPANIES */}
      <section style={{ background: C.cream, padding: '120px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60,
            alignItems: 'center',
          }} className="tlnd-grid-1">
            <div>
              <div className="tlnd-pill" style={{
                background: C.brandSoft, color: C.brand,
                border: `1px solid ${C.brand}30`, marginBottom: 20,
              }}>
                <Building size={11} /> Pour les entreprises
              </div>
              <h2 className="tlnd-display-l" style={{ color: C.ink, margin: '0 0 20px' }}>
                Le talent<br />
                <em className="tlnd-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
                  en vrai.
                </em>
              </h2>
              <p style={{ fontSize: 17, color: C.inkSoft, lineHeight: 1.6, margin: '0 0 28px', maxWidth: 480 }}>
                Fini les CV qui mentent. Regarde la personne parler, juge son énergie, son authenticité, ses compétences réelles. Contacte-la directement sur WhatsApp.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
                {[
                  { Icon: Eye, text: 'Vois les talents en vidéo, pas sur papier' },
                  { Icon: MessageCircle, text: 'Contact direct WhatsApp, zéro intermédiaire' },
                  { Icon: MapPin, text: 'Filtre par ville, pays, métier, dispo' },
                  { Icon: Clock, text: 'Recrute en 24h au lieu de 2 mois' },
                ].map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10,
                      background: C.brandSoft, color: C.brand,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <p.Icon size={15} />
                    </div>
                    <span style={{ fontSize: 14, color: C.ink2, fontWeight: 500 }}>
                      {p.text}
                    </span>
                  </div>
                ))}
              </div>

              <Link to="/talents/feed" className="tlnd-btn-primary">
                <Building size={15} /> Parcourir les talents
              </Link>
            </div>

            <div style={{
              position: 'relative', height: 540,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ position: 'relative', zIndex: 3 }}>
                <Link to={`/talents/${cards[3]!.id}`} style={{ textDecoration: 'none' }}>
                  <TalentVideoCard talent={cards[3]!} size="large" />
                </Link>
              </div>
              <div className="tlnd-float" style={{
                position: 'absolute', top: 60, right: 10, zIndex: 2,
              }}>
                <Link to={`/talents/${cards[4]!.id}`} style={{ textDecoration: 'none' }}>
                  <TalentVideoCard talent={cards[4]!} size="small" />
                </Link>
              </div>
              <div className="tlnd-float-alt" style={{
                position: 'absolute', bottom: 40, left: 0, zIndex: 2,
              }}>
                <Link to={`/talents/${cards[5]!.id}`} style={{ textDecoration: 'none' }}>
                  <TalentVideoCard talent={cards[5]!} size="small" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: `linear-gradient(135deg, ${C.brandDarker} 0%, ${C.brandDeep} 100%)`,
        padding: '120px 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="tlnd-rot" style={{
          position: 'absolute', top: '-30%', left: '-15%',
          width: 600, height: 600, borderRadius: '50%',
          border: `1px dashed ${C.goldLight}30`, pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div className="tlnd-pill" style={{
            background: 'rgba(255,255,255,0.12)',
            color: C.cream,
            border: `1px solid ${C.goldLight}40`,
            marginBottom: 24,
          }}>
            <Crown size={11} /> Bêta — Pionniers bienvenus
          </div>
          <h2 className="tlnd-display-l" style={{ color: C.cream, margin: '0 0 24px' }}>
            Ton talent mérite<br />
            <em className="tlnd-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
              d'être vu.
            </em>
          </h2>
          <p style={{
            fontSize: 18, color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.55, margin: '0 auto 40px', maxWidth: 580,
          }}>
            Rejoins la nouvelle génération de talents qui se font recruter en montrant qui ils sont vraiment.
          </p>
          <Link to="/talents/inscription" className="tlnd-btn-cream" style={{ fontSize: 16, padding: '18px 32px' }}>
            <Video size={16} /> Poster ma vidéo maintenant
          </Link>
        </div>
      </section>
    </div>
  );
}
