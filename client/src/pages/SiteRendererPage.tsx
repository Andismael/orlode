/**
 * SiteRendererPage — Renders a company's generated website
 * Public page: /site/:companyId
 * Includes embedded AI chat widget automatically
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MapPin, Mail, Phone, Star, ArrowRight, Menu, X } from 'lucide-react';

interface SiteData {
  companyName: string;
  companyId: string;
  companyLogo: string | null;
  color: string;
  style: string;
  widgetEnabled: boolean;
  template?: string;
  content: {
    hero?: { title: string; subtitle: string; cta: string };
    about?: { title: string; description: string; values: string[] };
    services?: Array<{ name: string; description: string; icon: string }>;
    products?: Array<{ name: string; price: string; description: string; category: string }>;
    listings?: Array<{ title: string; location: string; price: string; tags: string[] }>;
    team?: Array<{ name: string; role: string; avatar: string }>;
    testimonials?: Array<{ name: string; text: string; company: string }>;
    contact?: { title: string; email: string; phone: string; address: string };
    footer?: { description: string; copyright: string };
  };
}

export default function SiteRendererPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formMsg, setFormMsg] = useState('');
  const [formSent, setFormSent] = useState(false);
  const [formSending, setFormSending] = useState(false);
  const [formHoneypot, setFormHoneypot] = useState('');

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/public/site/${companyId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setSite(d.data); else setError('Site introuvable'); })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [companyId]);

  // Inject widget script
  useEffect(() => {
    if (!site?.widgetEnabled || !companyId) return;
    const existing = document.getElementById('cm-widget-script');
    if (existing) return;
    const script = document.createElement('script');
    script.id = 'cm-widget-script';
    script.src = '/embed.js';
    script.setAttribute('data-company', companyId);
    script.setAttribute('data-color', site.color || '#6c3ce0');
    script.setAttribute('data-title', site.companyName || 'Assistant IA');
    document.body.appendChild(script);
    return () => { const el = document.getElementById('cm-widget-script'); if (el) el.remove(); };
  }, [site, companyId]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <Loader2 className="animate-spin" size={32} style={{ color: '#6c3ce0' }} />
    </div>
  );

  if (error || !site) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', textAlign: 'center', padding: 24 }}>
      <div>
        <p style={{ fontSize: 48, marginBottom: 16 }}>🌐</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Site introuvable</h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>{error || 'Ce site n\'existe pas encore.'}</p>
      </div>
    </div>
  );

  const c = site.content;
  const color = site.color || '#6c3ce0';

  return (
    <div style={{ fontFamily: "'Outfit', -apple-system, sans-serif", color: '#111827', background: '#fff' }}>

      {/* ── NAV ────────────────────────────────────────────────── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #f3f4f6', padding: '12px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {site.companyLogo && <img src={site.companyLogo} alt="" style={{ width: 32, height: 32, borderRadius: 8 }} />}
            <span style={{ fontWeight: 700, fontSize: 18, color: '#111827' }}>{site.companyName}</span>
          </div>
          <div className="hidden md:flex" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="#about" style={{ fontSize: 14, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>A propos</a>
            <a href="#services" style={{ fontSize: 14, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>Services</a>
            <a href="#team" style={{ fontSize: 14, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>Equipe</a>
            <a href="#contact" style={{ fontSize: 14, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>Contact</a>
          </div>
          <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            {mobileMenu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden" style={{ padding: '12px 24px', borderTop: '1px solid #f3f4f6' }}>
            {['about', 'services', 'team', 'contact'].map(s => (
              <a key={s} href={`#${s}`} onClick={() => setMobileMenu(false)} style={{ display: 'block', padding: '8px 0', fontSize: 14, color: '#374151', textDecoration: 'none', textTransform: 'capitalize' }}>{s === 'about' ? 'A propos' : s === 'services' ? 'Services' : s === 'team' ? 'Equipe' : 'Contact'}</a>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ───────────────────────────────────────────────── */}
      {c.hero && (
        <section style={{ padding: 'clamp(60px, 12vw, 120px) 24px', textAlign: 'center', background: `linear-gradient(135deg, ${color}08, ${color}03)` }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 16 }}>
              {c.hero.title}
            </h1>
            <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: '#6b7280', lineHeight: 1.7, marginBottom: 32 }}>
              {c.hero.subtitle}
            </p>
            <a href="#contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: color, color: '#fff', borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: 'none', boxShadow: `0 4px 14px ${color}40` }}>
              {c.hero.cta || 'Contactez-nous'} <ArrowRight size={16} />
            </a>
          </div>
        </section>
      )}

      {/* ── ABOUT ──────────────────────────────────────────────── */}
      {c.about && (
        <section id="about" style={{ padding: '80px 24px', maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>{c.about.title || 'A propos'}</h2>
          <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.8, textAlign: 'center', maxWidth: 650, margin: '0 auto 32px' }}>{c.about.description}</p>
          {c.about.values && c.about.values.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {c.about.values.map((v, i) => (
                <div key={i} style={{ padding: '20px', background: '#f9fafb', borderRadius: 12, textAlign: 'center', fontSize: 14, fontWeight: 500, color: '#374151' }}>
                  {v}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── PRODUCTS (E-commerce) ─────────────────────────────── */}
      {c.products && c.products.length > 0 && (
        <section id="products" style={{ padding: '80px 24px', background: '#f9fafb' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>Nos Produits</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
              {c.products.map((p, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #f3f4f6', transition: 'transform 0.2s', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
                  <div style={{ height: 180, background: `linear-gradient(135deg, ${color}15, ${color}05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🛍️</div>
                  <div style={{ padding: 16 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{p.name}</p>
                    <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 12 }}>{p.price}</p>
                    <a href="#contact" style={{ display: 'block', textAlign: 'center', padding: 10, background: color, color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Commander</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── LISTINGS ──────────────────────────────────────────── */}
      {c.listings && c.listings.length > 0 && (
        <section id="listings" style={{ padding: '80px 24px', background: '#f9fafb' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>Annonces</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {c.listings.map((l, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #f3f4f6', transition: 'transform 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
                  <div style={{ height: 160, background: `linear-gradient(135deg, ${color}12, ${color}04)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📋</div>
                  <div style={{ padding: 16 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{l.title}</p>
                    <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>📍 {l.location}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color }}>{l.price}</p>
                    {l.tags && l.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        {l.tags.map((t, j) => <span key={j} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, background: `${color}10`, color, fontWeight: 500 }}>{t}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SERVICES ───────────────────────────────────────────── */}
      {c.services && c.services.length > 0 && (
        <section id="services" style={{ padding: '80px 24px', background: '#f9fafb' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>Nos Services</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {c.services.map((s, i) => (
                <div key={i} style={{ padding: 28, background: '#fff', borderRadius: 16, border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize: 32, display: 'block', marginBottom: 12 }}>{s.icon || '⭐'}</span>
                  <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{s.name}</h3>
                  <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TEAM ───────────────────────────────────────────────── */}
      {c.team && c.team.length > 0 && (
        <section id="team" style={{ padding: '80px 24px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>Notre Equipe</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
              {c.team.map((m, i) => (
                <div key={i} style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 auto 12px' }}>
                    {m.avatar || m.name[0]}
                  </div>
                  <p style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</p>
                  <p style={{ fontSize: 13, color: '#6b7280' }}>{m.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS ───────────────────────────────────────── */}
      {c.testimonials && c.testimonials.length > 0 && (
        <section style={{ padding: '80px 24px', background: '#f9fafb' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>Temoignages</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {c.testimonials.map((t, i) => (
                <div key={i} style={{ padding: 24, background: '#fff', borderRadius: 16, border: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                    {[1,2,3,4,5].map(s => <Star key={s} size={14} style={{ color: '#facc15', fill: '#facc15' }} />)}
                  </div>
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, fontStyle: 'italic', marginBottom: 16 }}>"{t.text}"</p>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</p>
                  <p style={{ fontSize: 12, color: '#9ca3af' }}>{t.company}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT + LEAD FORM ─────────────────────────────────── */}
      <section id="contact" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>{c.contact?.title || 'Contactez-nous'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            {/* Contact info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {c.contact?.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#f9fafb', borderRadius: 12 }}>
                  <Mail size={20} style={{ color }} />
                  <div><p style={{ fontSize: 12, color: '#9ca3af' }}>Email</p><a href={`mailto:${c.contact.email}`} style={{ fontSize: 14, color: '#111827', textDecoration: 'none', fontWeight: 500 }}>{c.contact.email}</a></div>
                </div>
              )}
              {c.contact?.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#f9fafb', borderRadius: 12 }}>
                  <Phone size={20} style={{ color }} />
                  <div><p style={{ fontSize: 12, color: '#9ca3af' }}>Telephone</p><a href={`tel:${c.contact.phone}`} style={{ fontSize: 14, color: '#111827', textDecoration: 'none', fontWeight: 500 }}>{c.contact.phone}</a></div>
                </div>
              )}
              {c.contact?.address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#f9fafb', borderRadius: 12 }}>
                  <MapPin size={20} style={{ color }} />
                  <div><p style={{ fontSize: 12, color: '#9ca3af' }}>Adresse</p><p style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{c.contact.address}</p></div>
                </div>
              )}
              {c.contact?.phone && (
                <a href={`https://wa.me/${c.contact.phone.replace(/[^0-9+]/g, '')}`} target="_blank" rel="noopener"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, background: '#25D366', color: '#fff', borderRadius: 12, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                  💬 Ecrire sur WhatsApp
                </a>
              )}
            </div>
            {/* Lead capture form */}
            <div style={{ background: '#f9fafb', borderRadius: 16, padding: 24 }}>
              {formSent ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>Message envoye !</p>
                  <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Nous vous repondrons rapidement.</p>
                </div>
              ) : (
                <>
                  <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Envoyez-nous un message</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Honeypot - hidden from humans, bots fill it */}
                    <input value={formHoneypot} onChange={e => setFormHoneypot(e.target.value)} style={{ position: 'absolute', left: -9999, opacity: 0, height: 0 }} tabIndex={-1} autoComplete="off" />
                    <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Votre nom *" required
                      style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }} />
                    <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Email" type="email"
                      style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }} />
                    <input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="Telephone"
                      style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }} />
                    <textarea value={formMsg} onChange={e => setFormMsg(e.target.value)} placeholder="Votre message..." rows={3}
                      style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', resize: 'none' }} />
                    <button onClick={async () => {
                      if (!formName.trim()) return;
                      setFormSending(true);
                      try {
                        await fetch('/api/public/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ companyId, name: formName, email: formEmail, phone: formPhone, message: formMsg, source: 'website_form', website: formHoneypot }) });
                        setFormSent(true);
                      } catch {} setFormSending(false);
                    }} disabled={formSending || !formName.trim()}
                      style={{ padding: 14, background: color, color: '#fff', borderRadius: 12, fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer', opacity: formSending || !formName.trim() ? 0.5 : 1 }}>
                      {formSending ? 'Envoi...' : 'Envoyer le message'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer style={{ padding: '40px 24px', background: '#111827', color: '#9ca3af', textAlign: 'center' }}>
        <p style={{ fontSize: 14, marginBottom: 8 }}>{c.footer?.description ?? site.companyName}</p>
        <p style={{ fontSize: 12 }}>{c.footer?.copyright ?? `© ${new Date().getFullYear()} ${site.companyName}. Tous droits reserves.`}</p>
        <p style={{ fontSize: 11, marginTop: 16, color: '#4b5563' }}>
          Site genere par <a href="https://orlode.com" style={{ color, textDecoration: 'none', fontWeight: 600 }}>Orlode AI</a>
        </p>
      </footer>
    </div>
  );
}
