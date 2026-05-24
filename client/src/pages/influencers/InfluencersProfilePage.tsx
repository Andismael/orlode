/**
 * Orlode Influenceurs — cinematic profile at /influenceurs/:id.
 * Premium editorial single-creator page. Adapted from user-provided
 * design 2026-05-24.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Send, BadgeCheck, MapPin, MessageCircle, Loader2, X,
  Quote, Instagram, Youtube, Music as TiktokIcon, Facebook, Twitter,
  Linkedin, ExternalLink, Sparkles, TrendingUp,
} from 'lucide-react';
import { getInfluencer, type Influencer } from '@/services/influencers';
import { useSEO } from '@/hooks/useSEO';
import InfluencerPortrait, { type PortraitInfluencer } from './InfluencerPortrait';
import api from '@/services/api';

const C = {
  brand: '#6366F1', brandDeep: '#4F46E5', brandSoft: '#EEF2FF', brandLight: '#A5B4FC',
  gold: '#D4A574', goldLight: '#E8C9A0',
  cream: '#FAF7F2', creamDeep: '#F0EBE3',
  ink: '#0A0814', ink3: '#3F3856', inkSoft: '#6B6480',
  inkLight: '#9A93AD', inkSilent: '#C9C3D6',
  success: '#059669', white: '#FFFFFF', verified: '#1D9BF0',
};

const PLATFORM_META: Record<string, { Icon: React.ComponentType<{ size?: number; color?: string }>; gradient: string; label: string }> = {
  instagram: { Icon: Instagram,  gradient: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)', label: 'Instagram' },
  tiktok:    { Icon: TiktokIcon, gradient: 'linear-gradient(135deg,#25F4EE,#FE2C55)',         label: 'TikTok' },
  youtube:   { Icon: Youtube,    gradient: 'linear-gradient(135deg,#FF0000,#CC0000)',         label: 'YouTube' },
  facebook:  { Icon: Facebook,   gradient: 'linear-gradient(135deg,#1877F2,#0866FF)',         label: 'Facebook' },
  twitter:   { Icon: Twitter,    gradient: 'linear-gradient(135deg,#000,#333)',               label: 'X (Twitter)' },
  linkedin:  { Icon: Linkedin,   gradient: 'linear-gradient(135deg,#0A66C2,#004182)',         label: 'LinkedIn' },
};

const formatK = (n?: number) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
};

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
.inflp-root, .inflp-root * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.inflp-root { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; }
.inflp-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
.inflp-mono { font-family: 'JetBrains Mono', monospace; }
.inflp-display-l { font-family: 'Fraunces', serif; font-size: clamp(36px, 6vw, 86px); font-weight: 800; line-height: 0.95; letter-spacing: -0.035em; }
.inflp-grain::before {
  content:''; position:absolute; inset:0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  opacity:0.08; pointer-events:none; mix-blend-mode:overlay;
}
@keyframes inflp-rotate { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
.inflp-rotate { animation: inflp-rotate 60s linear infinite; }
.inflp-rotate-rev { animation: inflp-rotate 90s linear infinite reverse; }
@keyframes inflp-fadeUp { from{opacity:0; transform:translateY(24px);} to{opacity:1; transform:translateY(0);} }
.inflp-fade { animation: inflp-fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) backwards; }
.inflp-d-100 { animation-delay:0.1s; } .inflp-d-200 { animation-delay:0.2s; }
.inflp-d-300 { animation-delay:0.3s; } .inflp-d-400 { animation-delay:0.4s; }
.inflp-pill {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 14px; border-radius: 100px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
.inflp-card { transition: all 0.3s ease; }
.inflp-card:hover { transform: translateY(-3px); }
@media (max-width: 768px) { .inflp-grid-1 { grid-template-columns: 1fr !important; } }
`;

export default function InfluencersProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inf, setInf] = useState<Influencer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  useSEO({
    title: inf ? `${inf.displayName} — Orlode Influenceurs` : 'Profil créateur',
    description: inf?.bio ?? 'Profil créateur sur Orlode Influenceurs.',
    path: `/influenceurs/${id}`,
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getInfluencer(id)
      .then(p => { setInf(p); if (!p) setError('Créateur introuvable'); })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.cream }}>
        <Loader2 size={24} className="animate-spin" color={C.brand} />
      </div>
    );
  }

  if (error || !inf) {
    return (
      <div style={{ minHeight: '100vh', background: C.cream, padding: 60, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
          {error ?? 'Créateur introuvable'}
        </h1>
        <Link to="/influenceurs/feed" style={{
          color: C.brand, fontSize: 14, fontWeight: 600,
          textDecoration: 'none',
        }}>← Retour à l'annuaire</Link>
      </div>
    );
  }

  const grad: [string, string, string] = inf.id.length > 0
    ? (['#E11D48', '#9F1239', C.gold] as [string, string, string])
    : (['#E11D48', '#9F1239', C.gold] as [string, string, string]);
  const socialEntries = Object.entries(inf.socialLinks ?? {})
    .filter(([, v]) => v?.url && v.followers > 0);

  return (
    <div className="inflp-root" style={{ background: C.cream, minHeight: '100vh' }}>
      <style>{STYLES}</style>

      {/* Cinematic hero */}
      <section style={{
        background: `linear-gradient(155deg, ${grad[0]} 0%, ${grad[1]} 70%, ${grad[2]} 100%)`,
        color: C.white,
        padding: '40px 32px 100px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="inflp-grain" />

        <div className="inflp-rotate" style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: 600, height: 600, borderRadius: '50%',
          border: '1px dashed rgba(255,255,255,0.15)', pointerEvents: 'none',
        }} />
        <div className="inflp-rotate-rev" style={{
          position: 'absolute', top: '-10%', right: '5%',
          width: 400, height: 400, borderRadius: '50%',
          border: '1px dashed rgba(255,255,255,0.1)', pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <button onClick={() => navigate('/influenceurs/feed')} style={{
            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.2)', color: C.white,
            padding: '8px 16px', borderRadius: 100,
            fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 40,
          }}>
            <ArrowLeft size={14} /> Retour à l'annuaire
          </button>

          <div className="inflp-grid-1" style={{
            display: 'grid', gridTemplateColumns: '1fr 1.4fr',
            gap: 56, alignItems: 'center',
          }}>
            <div className="inflp-fade" style={{
              display: 'flex', justifyContent: 'center', position: 'relative',
            }}>
              <InfluencerPortrait inf={inf as PortraitInfluencer} size={340} />
            </div>

            <div>
              <div className="inflp-fade inflp-pill" style={{
                background: 'rgba(255,255,255,0.15)', color: C.white,
                border: '1px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(20px)', marginBottom: 24,
              }}>
                {inf.status === 'active' ? (
                  <>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: C.success,
                    }} /> Disponible
                  </>
                ) : <>⏳ Très demandé·e</>}
                {inf.city && ` · ${inf.city}`}
              </div>

              <h1 className="inflp-display-l inflp-fade inflp-d-100" style={{ color: C.white, margin: '0 0 12px' }}>
                {inf.displayName.split(' ')[0]}<br />
                <em style={{ fontStyle: 'italic', fontWeight: 500 }}>
                  {inf.displayName.split(' ').slice(1).join(' ')}
                </em>
              </h1>

              {inf.bio && (
                <p className="inflp-serif inflp-fade inflp-d-200" style={{
                  fontSize: 18, color: 'rgba(255,255,255,0.9)',
                  margin: '0 0 12px', fontStyle: 'italic',
                  lineHeight: 1.4, fontWeight: 500,
                }}>
                  « {inf.bio} »
                </p>
              )}

              <div className="inflp-mono inflp-fade inflp-d-300" style={{
                fontSize: 13, color: 'rgba(255,255,255,0.75)',
                marginBottom: 32, letterSpacing: '0.05em', fontWeight: 600,
              }}>
                {inf.handle ?? ''}
                {inf.verified && (
                  <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <BadgeCheck size={13} fill={C.white} stroke={grad[1]} strokeWidth={2.5} />
                    Profil vérifié par Orlode
                  </span>
                )}
              </div>

              <div className="inflp-fade inflp-d-400" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setContactOpen(true)} style={{
                  background: C.cream, color: C.ink, border: 'none',
                  padding: '16px 28px', borderRadius: 100,
                  fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)',
                }}>
                  <Send size={15} /> Envoyer un brief
                </button>
                <button onClick={() => setContactOpen(true)} style={{
                  background: 'rgba(255,255,255,0.1)', color: C.white,
                  border: '1px solid rgba(255,255,255,0.25)',
                  backdropFilter: 'blur(20px)',
                  padding: '15px 24px', borderRadius: 100,
                  fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                }}>
                  <MessageCircle size={15} /> WhatsApp direct
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats + Social links section */}
      <section style={{ padding: '80px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>

          {/* Audience tiles per platform */}
          {socialEntries.length > 0 && (
            <div style={{ marginBottom: 60 }}>
              <div className="inflp-pill" style={{
                background: C.brandSoft, color: C.brand, border: `1px solid ${C.brand}30`,
                marginBottom: 16,
              }}>
                <TrendingUp size={11} /> Audience vérifiable
              </div>
              <h2 className="inflp-serif" style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px' }}>
                Clique pour <em style={{ fontStyle: 'italic' }}>vérifier</em>
              </h2>
              <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 24px' }}>
                Les chiffres déclarés vivent sur les vrais comptes. Un clic = vérification en direct.
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
              }}>
                {socialEntries.map(([platformId, v]) => {
                  const meta = PLATFORM_META[platformId];
                  if (!meta) return null;
                  const Icon = meta.Icon;
                  return (
                    <a key={platformId} href={v.url} target="_blank" rel="noopener noreferrer"
                      className="inflp-card" style={{
                        background: C.white, border: `1px solid ${C.creamDeep}`,
                        borderRadius: 20, padding: 20,
                        textDecoration: 'none', color: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 14,
                      }}>
                      <div style={{
                        width: 50, height: 50, borderRadius: 14,
                        background: meta.gradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon size={22} color="#fff" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: C.inkLight, fontWeight: 600, marginBottom: 2 }}>
                          {meta.label}
                        </div>
                        <div className="inflp-serif inflp-mono" style={{
                          fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1,
                        }}>
                          {formatK(v.followers)}
                        </div>
                      </div>
                      <ExternalLink size={14} color={C.inkLight} />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="inflp-grid-1" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16, marginBottom: 60,
          }}>
            {[
              { label: 'Total audience',  value: formatK(inf.audience?.total) },
              { label: 'Engagement',      value: inf.engagement ? `${inf.engagement.toFixed(1)}%` : '—' },
              { label: 'Réponse moyenne', value: inf.responseTime ?? '—' },
              { label: 'Deals complétés', value: inf.completedDeals?.toString() ?? '0' },
            ].map((s, i) => (
              <div key={i} style={{
                background: C.white, border: `1px solid ${C.creamDeep}`,
                borderRadius: 16, padding: 20,
              }}>
                <div style={{ fontSize: 11, color: C.inkLight, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {s.label}
                </div>
                <div className="inflp-serif" style={{ fontSize: 28, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Categories & languages */}
          <div className="inflp-grid-1" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 60,
          }}>
            {(inf.categories ?? []).length > 0 && (
              <div style={{
                background: C.white, border: `1px solid ${C.creamDeep}`,
                borderRadius: 20, padding: 24,
              }}>
                <div style={{ fontSize: 11, color: C.inkLight, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Catégories
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {inf.categories!.map(c => (
                    <span key={c} style={{
                      background: C.brandSoft, color: C.brand,
                      padding: '6px 14px', borderRadius: 100,
                      fontSize: 12, fontWeight: 600,
                    }}>{c}</span>
                  ))}
                </div>
              </div>
            )}
            {(inf.languages ?? []).length > 0 && (
              <div style={{
                background: C.white, border: `1px solid ${C.creamDeep}`,
                borderRadius: 20, padding: 24,
              }}>
                <div style={{ fontSize: 11, color: C.inkLight, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Langues parlées
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {inf.languages!.map(l => (
                    <span key={l} style={{
                      background: C.creamDeep, color: C.ink3,
                      padding: '6px 14px', borderRadius: 100,
                      fontSize: 12, fontWeight: 600,
                    }}>{l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          <div style={{
            background: C.ink, color: C.cream,
            borderRadius: 24, padding: 48,
            textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <div className="inflp-grain" />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <Quote size={32} color={C.goldLight} style={{ marginBottom: 14 }} />
              <h3 className="inflp-serif" style={{ fontSize: 28, fontWeight: 700, color: C.cream, margin: '0 0 14px', letterSpacing: '-0.025em' }}>
                Prêt·e à collaborer avec <em style={{ fontStyle: 'italic' }}>{inf.displayName.split(' ')[0]}</em> ?
              </h3>
              <p style={{ fontSize: 15, color: C.inkSilent, margin: '0 0 24px', lineHeight: 1.55 }}>
                Envoie un brief direct. Pas d'intermédiaire, pas de commission cachée.
              </p>
              <button onClick={() => setContactOpen(true)} style={{
                background: C.cream, color: C.ink, border: 'none',
                padding: '16px 32px', borderRadius: 100,
                fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                boxShadow: `0 14px 40px -10px ${C.brand}50`,
              }}>
                <Sparkles size={15} /> Envoyer mon brief
              </button>
            </div>
          </div>
        </div>
      </section>

      {contactOpen && (
        <ContactModal
          influencer={inf}
          onClose={() => setContactOpen(false)}
          onSent={() => setContactOpen(false)}
        />
      )}
    </div>
  );
}

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
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                rows={6} disabled={sending}
                style={{
                  width: '100%', background: C.white,
                  border: `1.5px solid ${C.creamDeep}`, borderRadius: 12,
                  padding: '14px 16px', fontSize: 14, fontFamily: 'inherit',
                  resize: 'vertical', outline: 'none', lineHeight: 1.55,
                }}
              />
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
