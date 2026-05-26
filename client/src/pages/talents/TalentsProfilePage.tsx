/**
 * Orlode Talents — premium editorial profile at /talents/:id.
 * Cinematic gradient hero with portrait + Fraunces display name + WhatsApp CTA,
 * then cream body with quote, skills, languages, and contact CTA.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Bookmark, Quote, Loader2,
  MapPin, Briefcase, Clock, Eye, Heart, Languages, Award, X, Check, Send,
} from 'lucide-react';
import { getTalent, type Talent } from '@/services/talents';
import { useSEO } from '@/hooks/useSEO';
import TalentVideoCard, { type CardTalent } from './TalentVideoCard';
import api from '@/services/api';

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
  ink3: '#384C42',
  inkSoft: '#5C6B62',
  inkLight: '#94A39A',
  success: '#10B981',
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
    photoURL: t.photoURL,
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
  const [contactOpen, setContactOpen] = useState(false);

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
                <button type="button" onClick={() => setContactOpen(true)} className="tpr-btn-wa">
                  <MessageCircle size={15} fill={C.white} /> Contacter sur WhatsApp
                </button>
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
            <button type="button" onClick={() => setContactOpen(true)} className="tpr-btn-wa" style={{ padding: '16px 28px', fontSize: 15 }}>
              <MessageCircle size={16} fill={C.white} /> Démarrer la conversation
            </button>
          </div>
        </div>
      </section>

      {contactOpen && (
        <ContactModal talent={talent} onClose={() => setContactOpen(false)} />
      )}
    </div>
  );
}

function ContactModal({ talent, onClose }: { talent: Talent; onClose: () => void }) {
  const navigate = useNavigate();
  const firstName = (talent.displayName ?? '').split(' ')[0] || 'candidat';
  const [message, setMessage] = useState(
    `Bonjour ${firstName}, on a vu ton profil sur Orlode Talents et ton parcours nous intéresse. Tu es disponible pour en discuter cette semaine ?`,
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (sending || message.trim().length < 10) return;
    setSending(true); setError(null);
    try {
      await api.post('/talents/contact', { talentId: talent.id, message: message.trim() });
      setSent(true);
      setTimeout(() => { onClose(); navigate('/talents/inbox'); }, 1200);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string; status?: number };
      if (e.status === 401) setError('Connecte-toi pour contacter un candidat.');
      else setError(e.response?.data?.message ?? e.message ?? 'Erreur');
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, background: 'rgba(10,20,16,0.7)',
      backdropFilter: 'blur(8px)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 24,
        width: '100%', maxWidth: 500, overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})`,
          padding: '22px 26px', color: C.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Contacter {firstName}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>
              VIA WHATSAPP · ORLODE TALENTS
            </div>
          </div>
          <button onClick={onClose} type="button" aria-label="Fermer" style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', color: C.cream,
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={15} /></button>
        </div>

        <div style={{ padding: 24 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.success}, #065F46)`,
                color: C.white,
                margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={26} />
              </div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                Message envoyé !
              </div>
              <p style={{ fontSize: 13, color: C.ink3, margin: 0 }}>
                Tu retrouveras la conversation dans ta boîte de réception.
              </p>
            </div>
          ) : (
            <>
              <div style={{
                background: '#FEF3C7',
                border: '1px solid #FCD34D40',
                borderRadius: 12, padding: 12, marginBottom: 16,
                fontSize: 12, color: '#92400E', lineHeight: 1.55,
              }}>
                <strong>Le message part via le numéro plateforme Orlode</strong> — {firstName} le reçoit directement sur son WhatsApp avec ta signature.
              </div>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 700,
                color: C.ink2, marginBottom: 6,
              }}>
                Ton message *
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                maxLength={1000}
                style={{
                  width: '100%', background: C.white, color: C.ink,
                  border: `1.5px solid ${C.creamDeep}`,
                  borderRadius: 14, padding: '14px 18px',
                  fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  resize: 'vertical', minHeight: 100,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: C.inkLight }}>
                <span>Min 10 caractères · max 1000</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{message.length}/1000</span>
              </div>

              {error && (
                <div style={{
                  marginTop: 12,
                  background: '#FEE2E2', border: '1px solid #FCA5A5',
                  borderRadius: 10, padding: 10, fontSize: 12, color: '#991B1B',
                }}>
                  ⚠️ {error}
                </div>
              )}
            </>
          )}
        </div>

        {!sent && (
          <div style={{
            padding: '14px 24px',
            borderTop: `1px solid ${C.creamDeep}`,
            background: C.white,
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>
            <button onClick={onClose} type="button" style={{
              background: C.creamDeep, color: C.ink2, border: 'none',
              padding: '11px 20px', borderRadius: 100,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              Annuler
            </button>
            <button
              onClick={send}
              disabled={sending || message.trim().length < 10}
              type="button"
              className="tpr-btn-wa"
              style={{ padding: '11px 20px', fontSize: 13 }}>
              {sending
                ? <><Loader2 size={13} className="animate-spin" /> Envoi…</>
                : <><Send size={13} /> Envoyer</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
