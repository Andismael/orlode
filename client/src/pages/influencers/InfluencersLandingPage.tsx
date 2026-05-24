/**
 * Orlode Influenceurs — public landing at /influenceurs.
 * Marketplace pitch where brands find creators by category, audience,
 * engagement. Same Firebase backend as Orlode + Talents.
 *
 * Visual: violet/indigo accent (distinct from Talents emerald, WhatsApp
 * green, Telegram blue) so each Orlode product has its own identity
 * while sharing the Zaffran cream base.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Hash, MessageCircle, ArrowRight, Sparkles, BadgeCheck,
  Instagram, Youtube, ChevronRight, TrendingUp, Camera, Briefcase,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { M, MOBILE_CSS, StarsBackdrop, SlowRotateRing } from '@/components/mobile/mobileDesign';

export default function InfluencersLandingPage() {
  useSEO({
    title: 'Orlode Influenceurs — Marketplace créateurs Afrique',
    description: 'Marques + influenceurs africains, sans agence. Brief, deal, paiement, mesure dans une seule interface.',
    path: '/influenceurs',
  });

  return (
    <div className="m-root" style={{ minHeight: '100vh', position: 'relative' }}>
      <style>{MOBILE_CSS}</style>
      <Hero />
      <HowItWorks />
      <Categories />
      <ForCreators />
      <FeedTeaser />
      <Footer />
      <StickyCTA />
    </div>
  );
}

function Hero() {
  return (
    <section style={{
      background: `linear-gradient(160deg, #2E1065 0%, ${M.violetDeep} 50%, ${M.violet} 100%)`,
      color: M.cream,
      padding: '20px 22px 40px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="m-grain" />
      <StarsBackdrop count={50} />
      <SlowRotateRing size={300} color={M.cream} />

      <div className="m-wrap-lg" style={{ position: 'relative', zIndex: 2, maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: M.cream }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${M.violet}, ${M.gold})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: '#2E1065',
            }}>O</div>
            <span className="m-display" style={{ fontSize: 16, fontWeight: 700 }}>
              Orlode <em style={{ fontStyle: 'italic', color: M.goldLight }}>Influenceurs</em>
            </span>
          </Link>
          <Link to="/influenceurs/feed" style={{
            color: M.cream, textDecoration: 'none',
            fontSize: 12, fontWeight: 700,
            background: 'rgba(255,250,240,0.12)',
            border: `1px solid ${M.cream}25`,
            padding: '7px 13px', borderRadius: 100,
          }}>
            Voir l'annuaire →
          </Link>
        </div>

        <div className="m-pill" style={{
          background: 'rgba(252,211,77,0.18)',
          color: M.goldLight,
          border: `1px solid ${M.gold}40`,
          marginBottom: 14,
        }}>
          <span className="m-live-dot" style={{ background: M.goldLight }} />
          🌍 BÊTA · ABIDJAN · DAKAR · DOUALA
        </div>

        <h1 className="m-display" style={{
          fontSize: 'clamp(36px, 9vw, 60px)',
          fontWeight: 800,
          lineHeight: 1.02,
          margin: '8px 0 14px',
        }}>
          Marques.<br />
          Créateurs.<br />
          <em className="m-shimmer" style={{
            fontStyle: 'italic', fontWeight: 500,
            backgroundImage: M.shimmer,
          }}>Sans agence.</em>
        </h1>

        <p style={{
          fontSize: 'clamp(15px, 3.8vw, 18px)',
          lineHeight: 1.55,
          color: 'rgba(255,250,240,0.85)',
          margin: '0 0 24px', maxWidth: 480,
        }}>
          Trouve l'influenceur africain qui correspond à ta marque. <strong style={{ color: M.cream }}>Brief, deal, paiement, mesure</strong> dans une seule interface. Pas de commission d'agence — juste 5% transaction.
        </p>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <Link to="/influenceurs/feed" style={{
            background: M.cream, color: '#2E1065',
            border: 'none', padding: '14px 22px', borderRadius: 14,
            fontSize: 14, fontWeight: 800,
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            boxShadow: '0 10px 28px -8px rgba(0,0,0,0.4)',
          }}>
            <Users size={15} /> Trouver un influenceur
          </Link>
          <Link to="/influenceurs/inscription" style={{
            background: 'rgba(255,250,240,0.10)',
            color: M.cream,
            border: `1px solid ${M.cream}35`,
            padding: '14px 18px', borderRadius: 14,
            fontSize: 14, fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            backdropFilter: 'blur(20px)',
          }}>
            <Camera size={14} /> Je suis créateur
          </Link>
        </div>

        <div style={{
          marginTop: 30,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
          paddingTop: 22, borderTop: `1px dashed ${M.cream}20`,
        }}>
          {[
            { v: '5%',   l: 'COMMISSION' },
            { v: '0',    l: 'AGENCE' },
            { v: '< 24h', l: 'BRIEF → DEAL' },
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
    { n: '01', icon: Users,         title: 'Cherche par catégorie + audience', sub: 'Mode, Tech, Food, Lifestyle, Fitness… filtre par engagement, ville, langue.', color: M.violetDeep },
    { n: '02', icon: MessageCircle, title: 'Brief + deal en 1 message',         sub: 'Envoie ton brief directement à l\'influenceur. Tarif négocié, livrables clairs.', color: M.gold },
    { n: '03', icon: TrendingUp,    title: 'Paie + mesure',                     sub: 'Paiement bloqué jusqu\'à livraison. Stats post-campagne (reach, engagement, ROI).', color: M.emeraldDeep },
  ];

  return (
    <section style={{ padding: '40px 18px', background: M.creamWarm }}>
      <div className="m-wrap-lg" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="m-pill" style={{
          background: M.violetSoft, color: M.violetDeep,
          border: `1px solid ${M.violet}40`, marginBottom: 12,
        }}>
          ⚡ COMMENT ÇA MARCHE
        </div>
        <h2 className="m-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Trois étapes. <em style={{ fontStyle: 'italic', color: M.violetDeep }}>Zéro intermédiaire.</em>
        </h2>
        <p style={{ fontSize: 14, color: M.inkSoft, margin: '0 0 22px', lineHeight: 1.55 }}>
          Tu parles direct avec le créateur. Orlode gère le paiement bloqué + la mesure de campagne.
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

function Categories() {
  const CATS = [
    { emoji: '👗', name: 'Mode',      sub: 'Wax, streetwear, luxe',          color: M.coralDeep },
    { emoji: '💻', name: 'Tech',      sub: 'Reviews, gaming, gadgets',       color: M.cyanDeep },
    { emoji: '🍲', name: 'Food',      sub: 'Recettes, resto, foodtech',      color: M.gold },
    { emoji: '🎨', name: 'Lifestyle', sub: 'Voyage, déco, family',           color: M.pinkDeep },
    { emoji: '💪', name: 'Fitness',   sub: 'Sport, bien-être, nutrition',    color: M.emeraldDeep },
    { emoji: '💄', name: 'Beauté',    sub: 'Skincare, makeup, hair',         color: '#BE185D' },
  ];
  return (
    <section style={{ padding: '40px 18px', background: M.cream }}>
      <div className="m-wrap-lg" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="m-pill" style={{
          background: M.goldSoft, color: M.goldDeep,
          border: `1px solid ${M.gold}40`, marginBottom: 12,
        }}>
          <Hash size={11} /> 6 CATÉGORIES
        </div>
        <h2 className="m-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Le créateur qui parle <em style={{ fontStyle: 'italic', color: M.gold }}>à ton audience</em>.
        </h2>
        <p style={{ fontSize: 14, color: M.inkSoft, margin: '0 0 22px', lineHeight: 1.55 }}>
          Filtres : catégorie · taille audience · taux d'engagement · ville · langue · prix.
        </p>

        <div className="m-stagger m-grid-md-3" style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
        }}>
          {CATS.map(c => (
            <Link key={c.name} to={`/influenceurs/feed?cat=${encodeURIComponent(c.name)}`} className="tap-card" style={{
              textDecoration: 'none', color: M.ink,
              background: M.cream,
              border: '1px solid rgba(31,41,55,0.06)',
              borderRadius: 14, padding: 12,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: `${c.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>{c.emoji}</div>
              <div>
                <div className="m-display" style={{
                  fontSize: 14, fontWeight: 700, color: M.ink, lineHeight: 1.2, marginBottom: 3,
                }}>{c.name}</div>
                <div style={{ fontSize: 11, color: M.inkSoft, lineHeight: 1.4 }}>
                  {c.sub}
                </div>
              </div>
              <div className="m-mono" style={{ fontSize: 11, fontWeight: 700, color: c.color, marginTop: 'auto' }}>
                Voir →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForCreators() {
  return (
    <section id="creators" style={{
      padding: '40px 18px',
      background: `linear-gradient(135deg, ${M.violetSoft}, ${M.cream})`,
    }}>
      <div className="m-wrap-lg" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="m-pill" style={{
          background: M.violet, color: M.cream,
          border: `1px solid ${M.violet}`, marginBottom: 12,
        }}>
          <Camera size={11} /> JE SUIS CRÉATEUR
        </div>
        <h2 className="m-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Monétise ton audience <em style={{ fontStyle: 'italic', color: M.violetDeep }}>sans manager</em>.
        </h2>
        <p style={{ fontSize: 14, color: M.inkSoft, margin: '0 0 18px', lineHeight: 1.55 }}>
          Tu reçois les briefs des marques directement. Tu acceptes, tu livres, tu es payé. Pas d'agent qui prend 30%.
        </p>
        <Link to="/influenceurs/inscription" className="tap-card" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: M.cream,
          border: `1px solid ${M.violet}40`,
          borderRadius: 14, padding: '12px 14px',
          color: M.ink, textDecoration: 'none',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})`,
            color: M.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <BadgeCheck size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="m-display" style={{ fontSize: 14, fontWeight: 700 }}>
              Créer mon profil créateur
            </div>
            <div style={{ fontSize: 11, color: M.inkSoft, marginTop: 2 }}>
              Onboarding 5 min · vérification sous 48h · gratuit
            </div>
          </div>
          <ChevronRight size={16} color={M.violetDeep} />
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
          background: M.emeraldSoft, color: M.emeraldDark,
          border: `1px solid ${M.emerald}40`, marginBottom: 12,
        }}>
          🎬 ANNUAIRE
        </div>
        <h2 className="m-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Découvre les créateurs <em style={{ fontStyle: 'italic', color: M.emeraldDeep }}>déjà inscrits</em>.
        </h2>
        <p style={{ fontSize: 14, color: M.inkSoft, margin: '0 0 18px', lineHeight: 1.55 }}>
          Filtres : catégorie, ville, taille audience, prix, langue. Profils vérifiés Instagram / TikTok / YouTube.
        </p>
        <Link to="/influenceurs/feed" className="tap-card" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})`,
          color: M.cream,
          padding: '14px 18px', borderRadius: 14,
          fontSize: 14, fontWeight: 800,
          textDecoration: 'none',
          boxShadow: `0 14px 30px -8px ${M.violet}`,
        }}>
          <Users size={16} /> Parcourir l'annuaire
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
      background: '#1E1B4B', color: M.cream,
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="m-grain" />
      <div className="m-wrap-lg" style={{ position: 'relative', zIndex: 2, maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${M.violet}, ${M.gold})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: '#2E1065',
          }}>O</div>
          <span className="m-display" style={{ fontSize: 17, fontWeight: 700 }}>
            Orlode <em style={{ fontStyle: 'italic', color: M.goldLight }}>Influenceurs</em>
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,250,240,0.7)', margin: '0 0 22px', lineHeight: 1.5 }}>
          🌍 Marketplace créateurs Afrique francophone · Même infra que Orlode + Talents.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
          <Link to="/" style={{ color: 'rgba(255,250,240,0.75)', textDecoration: 'none', fontWeight: 600 }}>← Orlode</Link>
          <Link to="/talents" style={{ color: 'rgba(255,250,240,0.75)', textDecoration: 'none', fontWeight: 600 }}>Talents</Link>
          <Link to="/influenceurs/feed" style={{ color: 'rgba(255,250,240,0.75)', textDecoration: 'none', fontWeight: 600 }}>Annuaire</Link>
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
        <Link to="/influenceurs/feed" className="tap-card" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})`,
          color: M.cream,
          padding: '14px 18px', borderRadius: 16,
          fontSize: 14, fontWeight: 800,
          textDecoration: 'none',
          boxShadow: `0 16px 32px -10px ${M.violet}, 0 0 0 1px ${M.cream}80`,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} /> Trouver un influenceur
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="m-mono">5%</span>
            <ArrowRight size={15} />
          </span>
        </Link>
      </div>
    </div>
  );
}
