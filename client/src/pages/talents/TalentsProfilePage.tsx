/**
 * Orlode Talents — premium editorial profile at /talents/:id.
 * Cinematic gradient hero with portrait + Fraunces display name + WhatsApp CTA,
 * then cream body with quote, skills, languages, and contact CTA.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Bookmark, Quote, Loader2,
  MapPin, Briefcase, Clock, Eye, Heart, Languages, Award,
} from 'lucide-react';
import { getTalent, type Talent } from '@/services/talents';
import { useSEO } from '@/hooks/useSEO';
import TalentVideoCard, { type CardTalent } from './TalentVideoCard';

const C = {
  brand: '#0F5C3F',
  brandDeep: '#0A4530',
  brandDarker: '#031A11',
  brandSoft: '#E8F5EE',
  brandMid: '#1B7A56',
  gold: '#D4A574',
  goldLight: '#E8C9A0',
  cream: '#FAF7F2',
  creamDeep: '#F0EBE3',
  ink: '#0A1410',
  ink2: '#1A2A22',
  inkSoft: '#5C6B62',
  inkLight: '#94A39A',
  whatsapp: '#25D366',
  white: '#FFFFFF',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  .tpr { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
  .tpr-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
  .tpr-mono { font-family: 'JetBrains Mono', monospace; }
  .tpr-display-l { font-family: 'Fraunces', serif; font-size: clamp(36px, 6vw, 86px); font-weight: 800; line-height: 0.95; letter-spacing: -0.035em; }
  .tpr-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 14px; border-radius: 100px;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  @keyframes tpr-fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  .tpr-fade { animation: tpr-fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) backwards; }
  .tpr-d1{animation-delay:0.08s} .tpr-d2{animation-delay:0.16s} .tpr-d3{animation-delay:0.24s} .tpr-d4{animation-delay:0.32s}
  @keyframes tpr-slowRotate { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .tpr-rot { animation: tpr-slowRotate 60s linear infinite; }
  .tpr-rot-rev { animation: tpr-slowRotate 90s linear infinite reverse; }
  .tpr-btn-wa {
    background: ${C.whatsapp}; color: ${C.white};
    border: none; padding: 14px 22px; border-radius: 100px;
    font-size: 14px; font-weight: 700; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    text-decoration: none;
    transition: all 0.2s ease;
    box-shadow: 0 8px 20px -6px ${C.whatsapp}80;
  }
  .tpr-btn-wa:hover { transform: translateY(-2px); }
  .tpr-btn-ghost {
    background: rgba(255,255,255,0.08); color: ${C.white};
    border: 1px solid rgba(255,255,255,0.18);
    backdrop-filter: blur(20px);
    padding: 13px 20px; border-radius: 100px;
    font-size: 14px; font-weight: 600; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    text-decoration: none;
  }
  .tpr-dot-live {
    width: 6px; height: 6px; border-radius: 50%;
    background: #10B981; position: relative;
    display: inline-block;
  }
  @media (max-width: 768px) {
    .tpr-grid-1 { grid-template-columns: 1fr !important; }
  }
`;

const PALETTES: [string, string, string][] = [
  ['#0F5C3F', '#063322', '#D4A574'],
  ['#1B7A56', '#0F5C3F', '#D4A574'],
  ['#D4A574', '#B8895C', '#0F5C3F'],
  ['#5BB088', '#0F5C3F', '#D4A574'],
  ['#F0C674', '#B8895C', '#0F5C3F'],
  ['#0F5C3F', '#1B7A56', '#D4A574'],
];
function pickPalette(id: string): [string, string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length]!;
}

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

function availabilityLabel(a?: Talent['availability']): string {
  switch (a) {
    case 'immediate': return 'Disponible immédiatement';
    case '1month': return 'Disponible dans 1 mois';
    case '3months': return 'Disponible dans 3 mois';
    case 'open': return 'À l\'écoute du marché';
    default: return 'Disponibilité à confirmer';
  }
}

export default function TalentsProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [talent, setTalent] = useState<Talent | null | undefined>(undefined);

  useSEO({
    title: talent ? `${talent.displayName} — Orlode Talents` : 'Profil — Orlode Talents',
    description: talent?.tagline || 'Profil candidat sur Orlode Talents.',
    path: `/talents/${id ?? ''}`,
  });

  useEffect(() => {
    if (!id) { setTalent(null); return; }
    setTalent(undefined);
    getTalent(id)
      .then(setTalent)
      .catch(() => setTalent(null));
  }, [id]);

  if (talent === undefined) {
    return (
      <div style={{
        minHeight: '100vh', background: C.cream,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12, color: C.inkSoft,
      }}>
        <Loader2 className="animate-spin" size={24} />
        <span style={{ fontSize: 13 }}>Chargement du profil…</span>
      </div>
    );
  }

  if (talent === null) {
    return (
      <div style={{
        minHeight: '100vh', background: C.cream,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32,
      }}>
        <div style={{
          background: C.white,
          border: `1px dashed ${C.brand}40`,
          borderRadius: 24, padding: 48,
          textAlign: 'center', maxWidth: 420,
        }}>
          <div style={{ fontSize: 38, marginBottom: 12 }}>👀</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Fraunces, serif', marginBottom: 8 }}>
            Profil introuvable
          </div>
          <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 20px' }}>
            Ce talent n'est plus visible ou son profil n'a pas encore été publié.
          </p>
          <Link to="/talents/feed" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: C.brand, color: C.white, textDecoration: 'none',
            padding: '10px 18px', borderRadius: 100,
            fontSize: 13, fontWeight: 700,
          }}>
            <ArrowLeft size={14} /> Retour au feed
          </Link>
        </div>
      </div>
    );
  }

  const card = toCardTalent(talent);
  const grad = pickPalette(talent.id);
  card.portraitGradient = grad;
  const firstName = talent.displayName.split(' ')[0] ?? talent.displayName;
  const lastName = talent.displayName.split(' ').slice(1).join(' ');
  const skills = talent.skills ?? [];

  return (
    <div className="tpr" style={{ minHeight: '100vh', background: C.cream }}>
      <style>{STYLES}</style>

      {/* Cinematic hero */}
      <section style={{
        background: `linear-gradient(155deg, ${grad[0]} 0%, ${grad[1]} 70%, ${grad[2]} 100%)`,
        color: C.white,
        padding: '32px 32px 100px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
          opacity: 0.08, pointerEvents: 'none', mixBlendMode: 'overlay',
        }} />
        <div className="tpr-rot" style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: 600, height: 600, borderRadius: '50%',
          border: '1px dashed rgba(255,255,255,0.15)', pointerEvents: 'none',
        }} />
        <div className="tpr-rot-rev" style={{
          position: 'absolute', bottom: '-30%', left: '-10%',
          width: 480, height: 480, borderRadius: '50%',
          border: '1px dashed rgba(255,255,255,0.10)', pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <Link to="/talents/feed" style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: C.white, textDecoration: 'none',
            padding: '8px 16px', borderRadius: 100,
            fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: 40,
          }}>
            <ArrowLeft size={14} /> Retour au feed
          </Link>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1.3fr',
            gap: 56, alignItems: 'center',
          }} className="tpr-grid-1">
            <div className="tpr-fade" style={{ display: 'flex', justifyContent: 'center' }}>
              <TalentVideoCard talent={card} size="hero" />
            </div>

            <div>
              <div className="tpr-fade tpr-pill" style={{
                background: 'rgba(255,255,255,0.15)',
                color: C.white,
                border: '1px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(20px)',
                marginBottom: 24,
              }}>
                {talent.status === 'active' ? (
                  <>
                    <span className="tpr-dot-live" /> {availabilityLabel(talent.availability)}
                  </>
                ) : (
                  <>⏳ {availabilityLabel(talent.availability)}</>
                )}
                {talent.country && <> {' · '} {talent.country}</>}
              </div>

              <h1 className="tpr-display-l tpr-fade tpr-d1" style={{
                color: C.white, margin: '0 0 12px',
              }}>
                {firstName}
                {lastName && (
                  <>
                    <br />
                    <em style={{ fontStyle: 'italic', fontWeight: 500 }}>{lastName}</em>
                  </>
                )}
              </h1>

              {talent.sector && (
                <p className="tpr-fade tpr-d2" style={{
                  fontSize: 22, color: 'rgba(255,255,255,0.9)',
                  margin: '0 0 12px',
                  fontFamily: 'Fraunces, serif',
                  lineHeight: 1.3, fontWeight: 500,
                  letterSpacing: '-0.02em',
                }}>
                  <em style={{ fontStyle: 'italic' }}>{talent.sector}</em>
                  {talent.city && <> · {talent.city}</>}
                </p>
              )}

              {talent.tagline && (
                <p className="tpr-fade tpr-d3" style={{
                  fontSize: 15, color: 'rgba(255,255,255,0.78)',
                  margin: '0 0 32px',
                  lineHeight: 1.6, maxWidth: 540,
                  fontStyle: 'italic',
                }}>
                  « {talent.tagline} »
                </p>
              )}

              <div className="tpr-fade tpr-d4" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href={`https://wa.me/?text=${encodeURIComponent(`Bonjour ${firstName}, je vous contacte depuis Orlode Talents au sujet d'une opportunité.`)}`}
                   target="_blank" rel="noopener noreferrer"
                   className="tpr-btn-wa">
                  <MessageCircle size={15} fill={C.white} /> Contacter sur WhatsApp
                </a>
                <button type="button" className="tpr-btn-ghost" onClick={() => {
                  try { navigator.clipboard?.writeText(window.location.href); } catch {}
                }}>
                  <Bookmark size={14} /> Sauvegarder le lien
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote */}
      {talent.tagline && (
        <section style={{ background: C.cream, padding: '80px 32px 60px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
            <Quote size={32} color={grad[1]} style={{ marginBottom: 24, opacity: 0.6 }} />
            <p className="tpr-serif" style={{
              fontSize: 32, fontWeight: 400, color: C.ink, margin: 0,
              letterSpacing: '-0.02em', lineHeight: 1.4,
              fontStyle: 'italic',
            }}>
              « {talent.tagline} »
            </p>
            <div style={{
              marginTop: 24, fontSize: 12,
              color: C.inkLight, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              — {firstName}
            </div>
          </div>
        </section>
      )}

      {/* Body grid */}
      <section style={{ background: C.cream, padding: '40px 32px 100px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Quick stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16, marginBottom: 48,
          }}>
            {[
              { label: 'Vues vidéo', value: talent.viewsCount ?? 0, Icon: Eye },
              { label: 'Contacts reçus', value: talent.contactsCount ?? 0, Icon: Heart },
              { label: 'Expérience', value: talent.sector ?? '—', Icon: Briefcase },
              { label: 'Statut', value: talent.status === 'active' ? 'Disponible' : 'En attente', Icon: Clock },
            ].map((s, i) => (
              <div key={i} style={{
                background: C.white,
                border: `1px solid ${C.creamDeep}`,
                borderRadius: 16, padding: 20,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: C.brandSoft, color: C.brand,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <s.Icon size={16} />
                </div>
                <div className="tpr-serif" style={{
                  fontSize: 24, fontWeight: 700, color: C.ink, lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}>
                  {typeof s.value === 'number' ? s.value.toLocaleString('fr-FR') : s.value}
                </div>
                <div style={{
                  fontSize: 11, color: C.inkSoft, fontWeight: 600,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  marginTop: 6,
                }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Skills + Languages */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24,
          }} className="tpr-grid-1">
            {skills.length > 0 && (
              <div style={{
                background: C.white,
                border: `1px solid ${C.creamDeep}`,
                borderRadius: 20, padding: 28,
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontSize: 11, color: C.brand, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  marginBottom: 18,
                }}>
                  <Award size={13} /> Compétences
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {skills.map((sk, i) => (
                    <span key={i} style={{
                      background: C.brandSoft, color: C.brand,
                      padding: '8px 14px', borderRadius: 100,
                      fontSize: 13, fontWeight: 600,
                      border: `1px solid ${C.brand}25`,
                    }}>{sk}</span>
                  ))}
                </div>
              </div>
            )}

            {talent.language && (
              <div style={{
                background: C.white,
                border: `1px solid ${C.creamDeep}`,
                borderRadius: 20, padding: 28,
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontSize: 11, color: C.brand, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  marginBottom: 18,
                }}>
                  <Languages size={13} /> Langues
                </div>
                <div className="tpr-serif" style={{
                  fontSize: 22, fontWeight: 600, color: C.ink2,
                  letterSpacing: '-0.02em',
                }}>
                  {talent.language}
                </div>
              </div>
            )}
          </div>

          {/* Final dark CTA */}
          <div style={{
            marginTop: 48,
            background: `linear-gradient(135deg, ${C.brandDarker} 0%, ${C.brandDeep} 100%)`,
            color: C.cream,
            borderRadius: 24,
            padding: 48,
            textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <Quote size={28} color={C.goldLight} style={{ marginBottom: 16, opacity: 0.7 }} />
            <h3 className="tpr-serif" style={{
              fontSize: 32, fontWeight: 700, margin: '0 0 12px',
              letterSpacing: '-0.025em',
            }}>
              Prêt·e à recruter <em style={{ fontStyle: 'italic', color: C.goldLight }}>{firstName}</em> ?
            </h3>
            <p style={{
              fontSize: 15, color: 'rgba(255,255,255,0.78)',
              maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.55,
            }}>
              Contact direct WhatsApp. Pas d'intermédiaire, pas de commission. Tu négocies. Tu signes.
            </p>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Bonjour ${firstName}, je vous contacte depuis Orlode Talents.`)}`}
               target="_blank" rel="noopener noreferrer"
               className="tpr-btn-wa" style={{ padding: '16px 28px', fontSize: 15 }}>
              <MessageCircle size={16} fill={C.white} /> Démarrer la conversation
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
