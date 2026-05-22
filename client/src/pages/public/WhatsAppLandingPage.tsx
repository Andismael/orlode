/**
 * Public marketing landing for the WhatsApp pack.
 * Mobile-first responsive — Zaffran-inspired design language
 * (cream + African green palette, Fraunces serif, JetBrains Mono).
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle, ShoppingBag, CalendarCheck, UtensilsCrossed, Stethoscope,
  Home, Scissors, ArrowRight, Check, Star, Sparkles, Zap, Shield, Globe,
  Send, Image as ImageIcon, Mic, Plus, ChevronRight, Heart,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';

// ── DESIGN TOKENS ──────────────────────────────────────────────────────
const C = {
  cream: '#FFFAF0',
  creamDeep: '#F5F0E8',
  creamWarm: '#FAF6EE',
  greenDeep: '#0A4F3C',
  greenDark: '#063D2E',
  emerald: '#10B981',
  emeraldDeep: '#059669',
  emeraldDark: '#065F46',
  emeraldSoft: '#D1FAE5',
  emeraldLight: '#6EE7B7',
  gold: '#D97706',
  goldDeep: '#B45309',
  goldSoft: '#FEF3C7',
  goldLight: '#FCD34D',
  violet: '#8B5CF6',
  violetDeep: '#7C3AED',
  violetSoft: '#EDE9FE',
  coral: '#FB7185',
  coralDeep: '#E11D48',
  coralSoft: '#FFE4E6',
  whatsapp: '#25D366',
  whatsappDeep: '#128C7E',
  whatsappBubble: '#DCF8C6',
  ink: '#1F2937',
  inkSoft: '#4B5563',
  inkLight: '#9CA3AF',
};

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;500;600;700;800&display=swap');
.wa-root, .wa-root * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.wa-root { font-family: 'Inter', -apple-system, sans-serif; color: ${C.ink}; background: ${C.cream}; }
.wa-display { font-family: 'Fraunces', serif; letter-spacing: -0.025em; font-optical-sizing: auto; }
.wa-mono { font-family: 'JetBrains Mono', monospace; }
.wa-grain::before { content:''; position:absolute; inset:0; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity:0.07; pointer-events:none; mix-blend-mode:overlay; }
.wa-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:100px; font-size:11px; font-weight:700; letter-spacing:0.04em; }
.wa-live-dot { width:7px; height:7px; border-radius:50%; background:${C.emerald}; position:relative; flex-shrink:0; }
.wa-live-dot::after { content:''; position:absolute; inset:-3px; border-radius:50%; background:${C.emerald}; opacity:0.4; animation:wa-pulse 1.8s ease-in-out infinite; }
@keyframes wa-pulse { 0%,100% { transform:scale(1); opacity:0.5; } 50% { transform:scale(1.6); opacity:0; } }
@keyframes wa-slideIn { from { opacity:0; transform:translateY(15px); } to { opacity:1; transform:translateY(0); } }
.wa-stagger > * { animation:wa-slideIn 0.45s ease-out backwards; }
.wa-stagger > *:nth-child(1) { animation-delay:0.04s; }
.wa-stagger > *:nth-child(2) { animation-delay:0.10s; }
.wa-stagger > *:nth-child(3) { animation-delay:0.16s; }
.wa-stagger > *:nth-child(4) { animation-delay:0.22s; }
.wa-stagger > *:nth-child(5) { animation-delay:0.28s; }
.wa-stagger > *:nth-child(6) { animation-delay:0.34s; }
@keyframes wa-slowRotate { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
.wa-slow-rotate { animation:wa-slowRotate 30s linear infinite; }
@keyframes wa-shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
.wa-shimmer { background-size:200% auto; background-clip:text; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:wa-shimmer 4s linear infinite; }
@keyframes wa-bubbleIn { from { opacity:0; transform:translateY(8px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
.wa-bubble-in { animation:wa-bubbleIn 0.4s ease-out backwards; }
@keyframes wa-typing { 0%,60%,100% { transform:translateY(0); opacity:0.4; } 30% { transform:translateY(-4px); opacity:1; } }
.wa-typing-dot { width:5px; height:5px; border-radius:50%; background:${C.inkLight}; display:inline-block; animation:wa-typing 1.2s ease-in-out infinite; }
.wa-typing-dot:nth-child(2) { animation-delay:0.15s; }
.wa-typing-dot:nth-child(3) { animation-delay:0.30s; }
.wa-hide-scrollbar::-webkit-scrollbar { display:none; }
.wa-hide-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
@keyframes wa-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-5px); } }
.wa-float { animation:wa-float 3s ease-in-out infinite; }
`;

// ── REALISTIC AFRICA-FIRST CONVERSATION SCRIPTS ────────────────────────
type Msg =
  | { from: 'client'; text: string; time: string }
  | { from: 'clone'; text: string; time: string; read?: boolean }
  | { from: 'clone'; type: 'image'; emoji: string; caption?: string; time: string; read?: boolean };

const CONVERSATION: Msg[] = [
  { from: 'client', text: 'Bonjour, je veux le boubou bogolan rouge svp 🛍️', time: '14:32' },
  { from: 'clone',  text: 'Bonjour Aïssatou 👋 Bien sûr ! Il est dispo en M, L et XL — quelle taille ?', time: '14:32', read: true },
  { from: 'client', text: 'Taille L. Et le prix ?', time: '14:33' },
  { from: 'clone',  type: 'image', emoji: '👘', caption: '*Boubou Bogolan Premium* — Taille L\n💰 *35 000 FCFA* (au lieu de 45 000)\n📦 Livraison Treichville 2h', time: '14:33', read: true },
  { from: 'client', text: "Parfait ! Je prends. Comment je paie ?", time: '14:34' },
  { from: 'clone',  text: '✅ Commande enregistrée #4521\n\n💸 Paie via :\n• Wave : *07 12 34 56 78*\n• Orange : *#144*391#\n• Cash livraison\n\nDès paiement confirmé, mon collègue vient avec le boubou 🚀', time: '14:34', read: true },
];

// ── 8 PACKS QUI VENDENT SUR WHATSAPP ───────────────────────────────────
// Each entry points to /marketplace (the marketplace will highlight the bundle).
type PackCard = { id: string; emoji: string; title: string; sub: string; color: string; bg: string; tag?: string };
const PACKS: PackCard[] = [
  { id: 'b16', emoji: '🛒', title: 'Pack Boutique',    sub: 'Vends avec une photo · Wave/Orange', color: C.coralDeep,    bg: C.coralSoft,    tag: 'BEST' },
  { id: 'b7',  emoji: '🍽️', title: 'Pack Restaurant',  sub: 'Commandes + livraison + menu QR',     color: C.gold,         bg: C.goldSoft },
  { id: 'b8',  emoji: '👗', title: 'Pack Mode & Luxe', sub: 'Catalogue + stocks + campagnes',      color: '#BE185D',      bg: '#FCE7F3' },
  { id: 'b2',  emoji: '🏠', title: 'Pack Immobilier',  sub: 'Leads + visites + dossiers',          color: C.violetDeep,   bg: C.violetSoft,   tag: 'HERO' },
  { id: 'b1',  emoji: '🏥', title: 'Pack Santé',       sub: 'RDV + rappels + ordonnances',         color: C.emeraldDeep,  bg: C.emeraldSoft },
  { id: 'b15', emoji: '🚀', title: 'Pack PME',         sub: 'Ventes + comms + marketing + support', color: C.emerald,     bg: C.emeraldSoft,  tag: 'POPULAR' },
  { id: 'b10', emoji: '🏢', title: 'Pack Entreprise',  sub: 'Ventes + factures + support',         color: '#155E75',      bg: '#CFFAFE' },
  { id: 'b11', emoji: '🚪', title: 'Pack Réception',   sub: 'Kiosk + badges + notifs visiteurs',   color: C.gold,         bg: C.goldSoft },
];

// ── 3 STEPS — HOW IT WORKS ─────────────────────────────────────────────
const STEPS = [
  { n: '01', title: 'Connecte ton WhatsApp Business',  sub: 'Scan QR ou clé API Meta — 2 minutes.',                            icon: MessageCircle, color: C.whatsapp },
  { n: '02', title: 'Entraîne ton clone IA',            sub: 'Catalogue, tarifs, ton de la marque. Photos et audio acceptés.',  icon: Sparkles,      color: C.gold },
  { n: '03', title: 'Active 24/7',                      sub: 'Ton clone répond, prend les commandes et confirme les paiements.', icon: Zap,           color: C.emeraldDeep },
];

// ── COMPONENT ──────────────────────────────────────────────────────────
export default function WhatsAppLandingPage() {
  useSEO({
    title: 'Pack WhatsApp — Orlode AI',
    description: 'Transforme ton WhatsApp en boutique 24/7. Ton clone IA répond, vend et prend les RDV. $20/mois, BYOE.',
    path: '/whatsapp',
  });

  const [shownMsgs, setShownMsgs] = useState(1);
  useEffect(() => {
    if (shownMsgs >= CONVERSATION.length) return;
    const t = setTimeout(() => setShownMsgs(n => Math.min(n + 1, CONVERSATION.length)), 1200);
    return () => clearTimeout(t);
  }, [shownMsgs]);

  return (
    <div className="wa-root" style={{ minHeight: '100vh', position: 'relative' }}>
      <style>{STYLES}</style>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <Hero />

      {/* ── CONVERSATION MOCKUP ─────────────────────────────────────── */}
      <Conversation shownMsgs={shownMsgs} />

      {/* ── 3 STEPS ─────────────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── USE CASES ───────────────────────────────────────────────── */}
      <UseCases />

      {/* ── SOCIAL PROOF + PRICING ──────────────────────────────────── */}
      <Pricing />

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <Footer />

      {/* ── STICKY CTA (mobile) ─────────────────────────────────────── */}
      <StickyCTA />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SECTIONS
// ════════════════════════════════════════════════════════════════════════

function Hero() {
  return (
    <section style={{
      background: `linear-gradient(160deg, ${C.greenDark} 0%, ${C.greenDeep} 50%, ${C.whatsappDeep} 100%)`,
      color: C.cream,
      padding: '20px 22px 36px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div className="wa-grain" />
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4, pointerEvents: 'none' }}>
        {[...Array(50)].map((_, i) => (
          <circle key={i}
            cx={Math.random() * 100 + '%'}
            cy={Math.random() * 100 + '%'}
            r={Math.random() * 1.5 + 0.3}
            fill={i % 3 === 0 ? C.emeraldLight : i % 3 === 1 ? C.goldLight : C.cream}
            opacity={Math.random() * 0.5 + 0.3}
          />
        ))}
      </svg>
      <div className="wa-slow-rotate" style={{
        position: 'absolute', top: -120, right: -120,
        width: 280, height: 280, borderRadius: '50%',
        border: `1px dashed ${C.cream}28`,
      }} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 520, margin: '0 auto' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: C.cream }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: `linear-gradient(135deg, ${C.emerald}, ${C.gold})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800,
            }}>O</div>
            <span className="wa-display" style={{ fontSize: 15, fontWeight: 700 }}>Orlode</span>
          </Link>
          <Link to="/login" style={{
            color: C.cream, textDecoration: 'none',
            fontSize: 12, fontWeight: 700, opacity: 0.85,
            background: 'rgba(255,250,240,0.12)',
            border: `1px solid ${C.cream}25`,
            padding: '7px 13px', borderRadius: 100,
          }}>
            Connexion →
          </Link>
        </div>

        {/* Pill */}
        <div className="wa-pill" style={{
          background: 'rgba(37,211,102,0.18)',
          color: C.emeraldLight,
          border: `1px solid ${C.whatsapp}40`,
          marginBottom: 14,
        }}>
          <span className="wa-live-dot" />
          PACK WHATSAPP · NOUVEAU
        </div>

        {/* Headline */}
        <h1 className="wa-display" style={{
          fontSize: 'clamp(36px, 9vw, 56px)',
          fontWeight: 800,
          lineHeight: 1.02,
          margin: '8px 0 14px',
        }}>
          Ton <em className="wa-shimmer" style={{
            fontStyle: 'italic', fontWeight: 500,
            backgroundImage: `linear-gradient(90deg, ${C.goldLight}, ${C.cream}, ${C.emeraldLight})`,
          }}>WhatsApp</em><br />
          devient une<br />
          boutique <em style={{ fontStyle: 'italic', color: C.goldLight, fontWeight: 500 }}>24/7</em>.
        </h1>

        {/* Sub */}
        <p style={{
          fontSize: 'clamp(15px, 3.8vw, 17px)',
          lineHeight: 1.55,
          color: 'rgba(255,250,240,0.82)',
          margin: '0 0 22px',
          maxWidth: 460,
        }}>
          Un clone IA qui <strong style={{ color: C.cream }}>répond, vend et prend les RDV</strong> à ta place — sans toi.
          <br />Activé en 5 minutes. <span className="wa-mono" style={{ color: C.goldLight, fontWeight: 700 }}>$20/mois</span>, ton infra (BYOE).
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <Link to="/login?redirect=/marketplace" style={{
            background: C.cream,
            color: C.greenDark,
            border: 'none',
            padding: '13px 22px',
            borderRadius: 14,
            fontSize: 14, fontWeight: 800,
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontFamily: 'inherit',
            boxShadow: '0 10px 28px -8px rgba(0,0,0,0.4)',
          }}>
            <Sparkles size={15} /> Activer mon WhatsApp
          </Link>
          <a href="#demo" style={{
            background: 'rgba(255,250,240,0.10)',
            color: C.cream,
            border: `1px solid ${C.cream}35`,
            padding: '13px 18px',
            borderRadius: 14,
            fontSize: 14, fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            backdropFilter: 'blur(20px)',
          }}>
            <MessageCircle size={14} /> Voir la démo
          </a>
        </div>

        {/* Mini-stats row */}
        <div style={{
          marginTop: 28,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          paddingTop: 22,
          borderTop: `1px dashed ${C.cream}20`,
        }}>
          {[
            { value: '< 2 s', label: 'TEMPS RÉPONSE' },
            { value: '24/7',  label: 'DISPO MARQUE' },
            { value: '+47%',  label: 'TAUX CONVERSION' },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div className="wa-display wa-mono" style={{
                fontSize: 'clamp(16px, 4.5vw, 20px)',
                fontWeight: 800,
                color: C.goldLight,
                lineHeight: 1,
              }}>{m.value}</div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                color: 'rgba(255,250,240,0.55)',
                marginTop: 4,
              }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CONVERSATION ──────────────────────────────────────────────────────
function Conversation({ shownMsgs }: { shownMsgs: number }) {
  const visible = CONVERSATION.slice(0, shownMsgs);
  const showTyping = shownMsgs < CONVERSATION.length && visible[visible.length - 1]?.from === 'client';

  return (
    <section id="demo" style={{
      padding: '40px 18px 36px',
      background: C.cream,
      position: 'relative',
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Section heading */}
        <div className="wa-pill" style={{
          background: C.whatsappBubble,
          color: C.whatsappDeep,
          border: `1px solid ${C.whatsapp}40`,
          marginBottom: 12,
        }}>
          💬 EN ACTION
        </div>
        <h2 className="wa-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800,
          margin: '0 0 8px',
          lineHeight: 1.1,
        }}>
          Une <em style={{ fontStyle: 'italic', color: C.whatsappDeep }}>vraie</em> conversation, en autopilote.
        </h2>
        <p style={{
          fontSize: 14, color: C.inkSoft,
          margin: '0 0 22px', lineHeight: 1.55,
        }}>
          Voici ce qu'Aïssatou voit quand elle commande chez ta boutique. Ton clone répond instantanément.
        </p>

        {/* Chat container */}
        <div style={{
          background: '#E5DDD5',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23d6cdc4' fill-opacity='0.4'%3E%3Cpath d='M30 1l3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z'/%3E%3C/g%3E%3C/svg%3E")`,
          borderRadius: 16,
          padding: '14px 12px',
          border: `1px solid ${C.inkLight}30`,
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
          {/* Chat header */}
          <div style={{
            background: C.whatsappDeep,
            margin: '-14px -12px 12px',
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            color: C.cream,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.gold}, ${C.coralDeep})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800,
              border: `2px solid ${C.cream}40`,
            }}>🛍️</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Boutique Zaffran</div>
              <div style={{ fontSize: 10, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="wa-live-dot" style={{ width: 5, height: 5 }} />
                en ligne · répond automatiquement
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visible.map((m, i) => <Bubble key={i} msg={m} idx={i} />)}
            {showTyping && (
              <div className="wa-bubble-in" style={{
                alignSelf: 'flex-start',
                background: C.cream,
                borderRadius: '12px 12px 12px 4px',
                padding: '10px 14px',
                marginTop: 2,
                boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span className="wa-typing-dot" />
                <span className="wa-typing-dot" />
                <span className="wa-typing-dot" />
              </div>
            )}
          </div>

          {/* Mock input */}
          <div style={{
            marginTop: 14,
            background: C.cream,
            borderRadius: 100,
            padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
            border: `1px solid ${C.inkLight}25`,
          }}>
            <Plus size={16} color={C.inkLight} />
            <ImageIcon size={16} color={C.inkLight} />
            <div style={{ flex: 1, fontSize: 12, color: C.inkLight }}>Message…</div>
            <Mic size={16} color={C.inkLight} />
          </div>
        </div>

        {/* Bullet points */}
        <div style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}>
          {[
            { icon: Zap,    text: 'Réponse < 2 s' },
            { icon: Shield, text: 'Ton de marque respecté' },
            { icon: Check,  text: 'Commande enregistrée' },
            { icon: Globe,  text: 'FR · EN · langues locales' },
          ].map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: C.creamDeep, borderRadius: 10,
                padding: '9px 11px',
                border: '1px solid rgba(31,41,55,0.05)',
              }}>
                <Icon size={14} color={C.whatsappDeep} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{b.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Bubble({ msg, idx }: { msg: Msg; idx: number }) {
  const isClient = msg.from === 'client';
  const bg = isClient ? C.cream : C.whatsappBubble;
  const align: React.CSSProperties = isClient
    ? { alignSelf: 'flex-start', borderRadius: '12px 12px 12px 4px' }
    : { alignSelf: 'flex-end',  borderRadius: '12px 12px 4px 12px' };

  if ('type' in msg && msg.type === 'image') {
    return (
      <div className="wa-bubble-in" style={{
        ...align, background: bg, padding: 4, maxWidth: '82%',
        boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
        animationDelay: `${idx * 0.05}s`,
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.coralSoft}, ${C.goldSoft})`,
          borderRadius: 9,
          padding: '38px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 64,
          marginBottom: 6,
        }}>
          {msg.emoji}
        </div>
        {msg.caption && (
          <div style={{
            fontSize: 12.5, color: C.ink, padding: '4px 8px 6px',
            whiteSpace: 'pre-line', lineHeight: 1.45,
          }}>
            {msg.caption.split('*').map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}
          </div>
        )}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3,
          padding: '0 8px 4px',
        }}>
          <span className="wa-mono" style={{ fontSize: 10, color: C.inkLight }}>{msg.time}</span>
          {!isClient && <CheckMark read={msg.read} />}
        </div>
      </div>
    );
  }

  return (
    <div className="wa-bubble-in" style={{
      ...align, background: bg, padding: '7px 10px 5px', maxWidth: '82%',
      boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
      animationDelay: `${idx * 0.05}s`,
    }}>
      <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.4, whiteSpace: 'pre-line' }}>
        {(msg as { text: string }).text.split('*').map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3,
        marginTop: 2,
      }}>
        <span className="wa-mono" style={{ fontSize: 10, color: C.inkLight }}>{msg.time}</span>
        {!isClient && <CheckMark read={(msg as { read?: boolean }).read} />}
      </div>
    </div>
  );
}

function CheckMark({ read }: { read?: boolean }) {
  const color = read ? '#34B7F1' : C.inkLight;
  return (
    <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
      <path d="M11.071 0.653l-5.495 7.41-3.213-2.16-1.363 1.413 4.576 3.077 6.857-9.247-1.362-0.493z" fill={color} />
      <path d="M15.071 0.653l-5.495 7.41-1.213-0.81-1.363 1.413 2.576 1.727 6.857-9.247-1.362-0.493z" fill={color} opacity={read ? 1 : 0.6} />
    </svg>
  );
}

// ─── HOW IT WORKS ──────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section style={{ padding: '36px 18px', background: C.creamWarm }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="wa-pill" style={{
          background: C.goldSoft,
          color: C.goldDeep,
          border: `1px solid ${C.gold}40`,
          marginBottom: 12,
        }}>
          ⚡ 3 ÉTAPES
        </div>
        <h2 className="wa-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800,
          margin: '0 0 8px',
          lineHeight: 1.1,
        }}>
          De zéro à <em style={{ fontStyle: 'italic', color: C.gold }}>actif</em> en 5 minutes.
        </h2>
        <p style={{
          fontSize: 14, color: C.inkSoft,
          margin: '0 0 22px', lineHeight: 1.55,
        }}>
          Pas de code, pas d'agence — un wizard guidé, et ton clone répond à ta place.
        </p>

        <div className="wa-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} style={{
                background: C.cream,
                border: '1px solid rgba(31,41,55,0.06)',
                borderRadius: 16,
                padding: '14px 14px 14px 12px',
                display: 'flex', alignItems: 'center', gap: 13,
                position: 'relative', overflow: 'hidden',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span className="wa-mono" style={{
                      fontSize: 10, fontWeight: 800, color: s.color,
                      letterSpacing: '0.05em',
                    }}>{s.n}</span>
                  </div>
                  <div className="wa-display" style={{
                    fontSize: 16, fontWeight: 700,
                    color: C.ink, lineHeight: 1.2,
                    marginBottom: 3,
                  }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.45 }}>
                    {s.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── USE CASES ─────────────────────────────────────────────────────────
function UseCases() {
  return (
    <section style={{ padding: '40px 18px', background: C.cream }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="wa-pill" style={{
          background: C.violetSoft,
          color: C.violetDeep,
          border: `1px solid ${C.violet}40`,
          marginBottom: 12,
        }}>
          📦 8 PACKS · WHATSAPP-FIRST
        </div>
        <h2 className="wa-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800,
          margin: '0 0 8px',
          lineHeight: 1.1,
        }}>
          Les packs qui <em style={{ fontStyle: 'italic', color: C.violetDeep }}>vendent</em> sur WhatsApp.
        </h2>
        <p style={{
          fontSize: 14, color: C.inkSoft,
          margin: '0 0 22px', lineHeight: 1.55,
        }}>
          Active un (ou plusieurs) pack · $20/mois chacun · ton clone IA s'adapte à ton métier.
        </p>

        <div className="wa-stagger" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 9,
        }}>
          {PACKS.map((p) => (
            <Link key={p.id} to={`/marketplace#${p.id}`} style={{
              textDecoration: 'none', color: C.ink,
              background: C.cream,
              border: '1px solid rgba(31,41,55,0.06)',
              borderRadius: 14,
              padding: 12,
              display: 'flex', flexDirection: 'column', gap: 8,
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 12px -6px rgba(0,0,0,0.06)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}>
              {p.tag && (
                <span className="wa-pill" style={{
                  position: 'absolute', top: 8, right: 8,
                  background: p.tag === 'POPULAR' ? C.emeraldDeep : p.tag === 'HERO' ? C.violetDeep : C.coralDeep,
                  color: C.cream,
                  fontSize: 8, padding: '2px 7px',
                  letterSpacing: '0.06em',
                }}>{p.tag}</span>
              )}
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: p.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>{p.emoji}</div>
              <div>
                <div className="wa-display" style={{
                  fontSize: 13.5, fontWeight: 700,
                  color: C.ink, lineHeight: 1.2,
                  marginBottom: 3,
                }}>{p.title}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.4 }}>
                  {p.sub}
                </div>
              </div>
              <div className="wa-mono" style={{
                fontSize: 11, fontWeight: 700, color: p.color,
                marginTop: 'auto',
              }}>$20/mo →</div>
            </Link>
          ))}
        </div>

        <Link to="/marketplace" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          background: `linear-gradient(135deg, ${C.emeraldSoft}, ${C.cream})`,
          border: `1.5px dashed ${C.emerald}55`,
          borderRadius: 14,
          padding: '12px 16px',
          marginTop: 12,
          textDecoration: 'none',
          color: C.emeraldDark,
          fontSize: 13, fontWeight: 700,
        }}>
          Voir les 17 packs <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

// ─── PRICING ───────────────────────────────────────────────────────────
function Pricing() {
  return (
    <section style={{
      padding: '40px 18px',
      background: `linear-gradient(180deg, ${C.cream} 0%, ${C.creamDeep} 100%)`,
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="wa-pill" style={{
          background: C.emeraldSoft,
          color: C.emeraldDark,
          border: `1px solid ${C.emerald}40`,
          marginBottom: 12,
        }}>
          💰 PRICING TRANSPARENT
        </div>
        <h2 className="wa-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800,
          margin: '0 0 8px',
          lineHeight: 1.1,
        }}>
          <em style={{ fontStyle: 'italic', color: C.emeraldDeep }}>$20</em>/mois.<br />
          Pas de surprise.
        </h2>
        <p style={{
          fontSize: 14, color: C.inkSoft,
          margin: '0 0 22px', lineHeight: 1.55,
        }}>
          Le pack WhatsApp inclut tout. Ton infra, tes données, tes clés (BYOE).
        </p>

        <div style={{
          background: C.cream,
          border: `2px solid ${C.whatsapp}40`,
          borderRadius: 20,
          padding: 22,
          position: 'relative', overflow: 'hidden',
          boxShadow: `0 20px 40px -16px ${C.whatsapp}30`,
        }}>
          <div className="wa-slow-rotate" style={{
            position: 'absolute', top: -80, right: -80,
            width: 200, height: 200, borderRadius: '50%',
            border: `1px dashed ${C.whatsapp}20`,
          }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
              <span className="wa-display wa-mono" style={{
                fontSize: 52, fontWeight: 800,
                color: C.greenDeep,
                lineHeight: 1, letterSpacing: '-0.04em',
              }}>$20</span>
              <span style={{ fontSize: 14, color: C.inkSoft, fontWeight: 600 }}>/mois</span>
              <span className="wa-pill" style={{
                background: C.emeraldSoft, color: C.emeraldDark,
                marginLeft: 'auto', fontSize: 10,
              }}>BYOE inclus</span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px' }} className="wa-stagger">
              {[
                'Clone IA WhatsApp 24/7 illimité',
                'Catalogue produits + prise commande',
                'Templates Meta + broadcasts',
                'Inbox unifié WhatsApp + Telegram',
                'Paiements Wave / Orange / MTN / Stripe',
                'Multi-utilisateurs (équipe vente)',
              ].map((f, i) => (
                <li key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '6px 0', fontSize: 13.5, color: C.ink,
                  borderTop: i === 0 ? 'none' : '1px dashed rgba(31,41,55,0.08)',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: C.emeraldSoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Check size={11} color={C.emeraldDeep} strokeWidth={3} />
                  </div>
                  <span style={{ fontWeight: 500 }}>{f}</span>
                </li>
              ))}
            </ul>

            <Link to="/login?redirect=/marketplace" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDeep})`,
              color: C.cream,
              padding: '14px 18px',
              borderRadius: 14,
              fontSize: 14, fontWeight: 800,
              textDecoration: 'none',
              boxShadow: `0 14px 30px -8px ${C.whatsapp}`,
            }}>
              <MessageCircle size={16} /> Activer mon WhatsApp
              <ArrowRight size={15} />
            </Link>

            <p style={{
              fontSize: 11, color: C.inkLight,
              textAlign: 'center', margin: '12px 0 0',
            }}>
              Aucune carte requise · 5 minutes · Annule quand tu veux
            </p>
          </div>
        </div>

        {/* Telegram cross-sell */}
        <Link to="/telegram" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: C.cream,
          border: `1px solid ${C.inkLight}25`,
          borderRadius: 14,
          padding: '12px 14px',
          marginTop: 14,
          textDecoration: 'none',
          color: C.ink,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'linear-gradient(135deg, #229ED9, #0088CC)',
            color: C.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Send size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="wa-display" style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>
              Pack Telegram aussi disponible
            </div>
            <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>
              Communauté, channels, bots — $20/mois
            </div>
          </div>
          <ChevronRight size={16} color={C.inkLight} />
        </Link>
      </div>
    </section>
  );
}

// ─── FOOTER ────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      padding: '32px 18px 120px',
      background: C.greenDark,
      color: C.cream,
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="wa-grain" />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `linear-gradient(135deg, ${C.emerald}, ${C.gold})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 800,
            color: C.greenDark,
          }}>O</div>
          <span className="wa-display" style={{ fontSize: 18, fontWeight: 700 }}>Orlode AI</span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,250,240,0.7)', margin: '0 0 18px', lineHeight: 1.5 }}>
          🌍 Africa-first · Ton WhatsApp devient une boutique 24/7.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          {[
            { label: 'Connexion', to: '/login' },
            { label: 'Tous les packs', to: '/marketplace' },
            { label: 'Telegram', to: '/telegram' },
            { label: 'Mentions', to: '/legal' },
          ].map(l => (
            <Link key={l.to} to={l.to} style={{
              color: 'rgba(255,250,240,0.7)',
              textDecoration: 'none',
              fontWeight: 600,
            }}>{l.label}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── STICKY CTA (mobile only) ──────────────────────────────────────────
function StickyCTA() {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(180deg, transparent 0%, rgba(255,250,240,0.95) 30%, rgba(255,250,240,1) 100%)',
      padding: '12px 14px 16px',
      zIndex: 50,
      pointerEvents: 'none',
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto', pointerEvents: 'auto' }}>
        <Link to="/login?redirect=/marketplace" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDeep})`,
          color: C.cream,
          padding: '14px 18px',
          borderRadius: 16,
          fontSize: 14, fontWeight: 800,
          textDecoration: 'none',
          boxShadow: `0 16px 32px -10px ${C.whatsapp}, 0 0 0 1px ${C.cream}80`,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={16} /> Activer mon WhatsApp
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="wa-mono">$20/mois</span>
            <ArrowRight size={15} />
          </span>
        </Link>
      </div>
    </div>
  );
}
