/**
 * Orlode Talents — public landing at /talents.
 * Marketing-style page that pitches the video-first recruiting marketplace
 * and links to /talents/feed + the standalone talents.orlode.com app for
 * the full signup flow (video recording lives there for now).
 *
 * Visual language: Zaffran African (cream + deep green + accent gold).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Video, Search, MessageCircle, ArrowRight, PlayCircle, Sparkles,
  Clock, Globe, ChevronRight, Briefcase,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { M, MOBILE_CSS, StarsBackdrop, SlowRotateRing } from '@/components/mobile/mobileDesign';

const TALENTS_APP_URL = 'https://talents.orlode.com';

export default function TalentsLandingPage() {
  useSEO({
    title: 'Orlode Talents — Recruter en 5 minutes',
    description: 'Marketplace vidéo authentique. Les candidats postent 1 minute de vidéo brute. Les recruteurs trouvent les bons talents en langage naturel — partout dans le monde.',
    path: '/talents',
  });

  return (
    <div className="m-root" style={{ minHeight: '100vh', position: 'relative' }}>
      <style>{MOBILE_CSS}</style>
      <Hero />
      <HowItWorks />
      <ForRecruiters />
      <FeedTeaser />
      <Footer />
      <StickyCTA />
    </div>
  );
}

function Hero() {
  return (
    <section style={{
      background: M.heroAfrica,
      color: M.cream,
      padding: '20px 22px 40px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="m-grain" />
      <StarsBackdrop count={50} />
      <SlowRotateRing size={300} color={M.cream} />

      <div className="m-wrap-lg" style={{ position: 'relative', zIndex: 2, maxWidth: 560, margin: '0 auto' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: M.cream }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${M.emerald}, ${M.gold})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: M.greenDark,
            }}>O</div>
            <span className="m-display" style={{ fontSize: 16, fontWeight: 700 }}>
              Orlode <em style={{ fontStyle: 'italic', color: M.goldLight }}>Talents</em>
            </span>
          </Link>
          <Link to="/talents/feed" style={{
            color: M.cream, textDecoration: 'none',
            fontSize: 12, fontWeight: 700,
            background: 'rgba(255,250,240,0.12)',
            border: `1px solid ${M.cream}25`,
            padding: '7px 13px', borderRadius: 100,
          }}>
            Voir le feed →
          </Link>
        </div>

        <div className="m-pill" style={{
          background: 'rgba(252,211,77,0.18)',
          color: M.goldLight,
          border: `1px solid ${M.gold}40`,
          marginBottom: 14,
        }}>
          <span className="m-live-dot" style={{ background: M.goldLight }} />
          🌍 GLOBAL · 20+ PAYS
        </div>

        <h1 className="m-display" style={{
          fontSize: 'clamp(36px, 9vw, 60px)',
          fontWeight: 800,
          lineHeight: 1.02,
          margin: '8px 0 14px',
        }}>
          Montre qui<br />
          tu es.<br />
          <em className="m-shimmer" style={{
            fontStyle: 'italic', fontWeight: 500,
            backgroundImage: M.shimmer,
          }}>Trouve ton job.</em>
        </h1>

        <p style={{
          fontSize: 'clamp(15px, 3.8vw, 18px)',
          lineHeight: 1.55,
          color: 'rgba(255,250,240,0.85)',
          margin: '0 0 24px', maxWidth: 480,
        }}>
          Poste une vidéo d'<strong style={{ color: M.cream }}>1 minute</strong>. Pas de CV, pas de blabla. Les entreprises te trouvent par <strong style={{ color: M.cream }}>ce que tu sais vraiment faire</strong>.
        </p>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <Link to="/talents/inscription" style={{
            background: M.cream, color: M.greenDark,
            border: 'none', padding: '14px 22px', borderRadius: 14,
            fontSize: 14, fontWeight: 800,
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            boxShadow: '0 10px 28px -8px rgba(0,0,0,0.4)',
          }}>
            <Video size={15} /> Poste ta vidéo
          </Link>
          <Link to="/talents/feed" style={{
            background: 'rgba(255,250,240,0.10)',
            color: M.cream,
            border: `1px solid ${M.cream}35`,
            padding: '14px 18px', borderRadius: 14,
            fontSize: 14, fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            backdropFilter: 'blur(20px)',
          }}>
            <PlayCircle size={14} /> Découvrir les talents
          </Link>
        </div>

        <div style={{
          marginTop: 30,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
          paddingTop: 22, borderTop: `1px dashed ${M.cream}20`,
        }}>
          {[
            { v: '1 min',  l: 'VIDÉO BRUTE' },
            { v: '5 min',  l: 'À PUBLIER' },
            { v: 'WhatsApp', l: 'CONTACT DIRECT' },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div className="m-display m-mono" style={{
                fontSize: 'clamp(15px, 4vw, 18px)',
                fontWeight: 800, color: M.goldLight, lineHeight: 1,
              }}>{m.v}</div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                color: 'rgba(255,250,240,0.55)', marginTop: 4,
              }}>{m.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const STEPS = [
    { n: '01', icon: Video, title: 'Filme-toi', sub: "Une vidéo brute d'1 minute. Dis qui tu es, ce que tu sais faire, ce que tu as déjà fait.", color: M.emerald },
    { n: '02', icon: Search, title: 'Sois trouvé', sub: 'Notre IA analyse ta vidéo. Les recruteurs te trouvent par compétences, énergie, disponibilité.', color: M.gold },
    { n: '03', icon: MessageCircle, title: 'Discute', sub: "Tu reçois les offres directement sur WhatsApp. Pas d'email, pas de compte à créer ailleurs.", color: M.violetDeep },
  ];

  return (
    <section style={{ padding: '40px 18px', background: M.creamWarm }}>
      <div className="m-wrap-lg" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="m-pill" style={{
          background: M.emeraldSoft, color: M.emeraldDark,
          border: `1px solid ${M.emerald}40`, marginBottom: 12,
        }}>
          ⚡ COMMENT ÇA MARCHE
        </div>
        <h2 className="m-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Trois étapes. <em style={{ fontStyle: 'italic', color: M.emeraldDeep }}>Cinq minutes.</em>
        </h2>
        <p style={{ fontSize: 14, color: M.inkSoft, margin: '0 0 22px', lineHeight: 1.55 }}>
          Zéro paperasse. Zéro entretien d'embauche en ligne. Juste une vidéo + une conversation WhatsApp.
        </p>

        <div className="m-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="tap-card" style={{
                background: M.cream,
                border: '1px solid rgba(31,41,55,0.06)',
                borderRadius: 16,
                padding: '14px 14px 14px 12px',
                display: 'flex', alignItems: 'center', gap: 13,
              }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 14,
                  background: `linear-gradient(135deg, ${s.color}18, ${s.color}06)`,
                  color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  border: `1.5px solid ${s.color}25`,
                }}>
                  <Icon size={22} strokeWidth={2.2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="m-mono" style={{ fontSize: 10, fontWeight: 800, color: s.color, letterSpacing: '0.05em' }}>{s.n}</span>
                  <div className="m-display" style={{ fontSize: 16, fontWeight: 700, color: M.ink, lineHeight: 1.2, marginTop: 2, marginBottom: 3 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: M.inkSoft, lineHeight: 1.45 }}>{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ForRecruiters() {
  return (
    <section style={{ padding: '40px 18px', background: M.cream }}>
      <div className="m-wrap-lg" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="m-pill" style={{
          background: M.violetSoft, color: M.violetDeep,
          border: `1px solid ${M.violet}40`, marginBottom: 12,
        }}>
          <Briefcase size={11} /> POUR LES RECRUTEURS
        </div>
        <h2 className="m-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Cherche en <em style={{ fontStyle: 'italic', color: M.violetDeep }}>langage naturel</em>.
        </h2>
        <p style={{ fontSize: 14, color: M.inkSoft, margin: '0 0 18px', lineHeight: 1.55 }}>
          Tape ce que tu veux : "développeur React dispo immédiat", "vendeuse mode énergique", "comptable senior 5 ans". L'IA matche par énergie, compétences, disponibilité, langues, ville.
        </p>
        <Link to="/talents/inbox" className="tap-card" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: `linear-gradient(135deg, ${M.violetSoft}, ${M.cream})`,
          border: `1px solid ${M.violet}40`,
          borderRadius: 14, padding: '12px 14px',
          textDecoration: 'none', color: M.ink,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})`,
            color: M.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Search size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="m-display" style={{ fontSize: 14, fontWeight: 700 }}>
              Espace recruteur
            </div>
            <div style={{ fontSize: 11, color: M.inkSoft, marginTop: 2 }}>
              Recherche IA + contact WhatsApp tracé
            </div>
          </div>
          <ChevronRight size={16} color={M.inkLight} />
        </Link>
      </div>
    </section>
  );
}

function FeedTeaser() {
  return (
    <section style={{
      padding: '40px 18px',
      background: `linear-gradient(180deg, ${M.cream} 0%, ${M.creamDeep} 100%)`,
    }}>
      <div className="m-wrap-lg" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="m-pill" style={{
          background: M.goldSoft, color: M.goldDeep,
          border: `1px solid ${M.gold}40`, marginBottom: 12,
        }}>
          🎬 LE FEED
        </div>
        <h2 className="m-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Découvre les talents <em style={{ fontStyle: 'italic', color: M.gold }}>déjà inscrits</em>.
        </h2>
        <p style={{ fontSize: 14, color: M.inkSoft, margin: '0 0 18px', lineHeight: 1.55 }}>
          Vidéos brutes de candidats actifs partout dans le monde. Pas de filtre, juste leur talent.
        </p>
        <Link to="/talents/feed" className="tap-card" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: `linear-gradient(135deg, ${M.gold}, ${M.goldDeep})`,
          color: M.cream,
          padding: '14px 18px', borderRadius: 14,
          fontSize: 14, fontWeight: 800,
          textDecoration: 'none',
          boxShadow: `0 14px 30px -8px ${M.gold}`,
        }}>
          <PlayCircle size={16} /> Voir le feed
          <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{
      padding: '36px 18px 120px',
      background: M.greenDark, color: M.cream,
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="m-grain" />
      <div className="m-wrap-lg" style={{ position: 'relative', zIndex: 2, maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${M.emerald}, ${M.gold})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: M.greenDark,
          }}>O</div>
          <span className="m-display" style={{ fontSize: 17, fontWeight: 700 }}>
            Orlode <em style={{ fontStyle: 'italic', color: M.goldLight }}>Talents</em>
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,250,240,0.7)', margin: '0 0 22px', lineHeight: 1.5 }}>
          🌍 Marketplace vidéo authentique · Global · Partage la même infra que Orlode.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
          <Link to="/" style={{ color: 'rgba(255,250,240,0.75)', textDecoration: 'none', fontWeight: 600 }}>
            ← Orlode
          </Link>
          <Link to="/talents/feed" style={{ color: 'rgba(255,250,240,0.75)', textDecoration: 'none', fontWeight: 600 }}>
            Feed
          </Link>
          <Link to="/talents/inscription" style={{ color: 'rgba(255,250,240,0.75)', textDecoration: 'none', fontWeight: 600 }}>
            S'inscrire
          </Link>
          <Link to="/talents/inbox" style={{ color: 'rgba(255,250,240,0.75)', textDecoration: 'none', fontWeight: 600 }}>
            Recruteur
          </Link>
        </div>
      </div>
    </footer>
  );
}

function StickyCTA() {
  return (
    <div className="m-sticky-cta" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(180deg, transparent 0%, rgba(255,250,240,0.95) 30%, rgba(255,250,240,1) 100%)',
      padding: '12px 14px 16px', zIndex: 50, pointerEvents: 'none',
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto', pointerEvents: 'auto' }}>
        <Link to="/talents/inscription" className="tap-card" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${M.emerald}, ${M.greenDeep})`,
          color: M.cream,
          padding: '14px 18px', borderRadius: 16,
          fontSize: 14, fontWeight: 800,
          textDecoration: 'none',
          boxShadow: `0 16px 32px -10px ${M.emerald}, 0 0 0 1px ${M.cream}80`,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} /> Poste ta vidéo
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="m-mono">1 min</span>
            <ArrowRight size={15} />
          </span>
        </Link>
      </div>
    </div>
  );
}
