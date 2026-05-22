/**
 * Public marketing landing for the Telegram pack.
 * Same design language as the WhatsApp page but tuned for Telegram —
 * blue palette, channel/community angle, instant DM bubbles.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Send, Users, Megaphone, CalendarCheck, Stethoscope, Briefcase, Building,
  ArrowRight, Check, Sparkles, Zap, Shield, Globe,
  Image as ImageIcon, Paperclip, Smile, Plus, ChevronRight, Bot,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';

// ── DESIGN TOKENS ──────────────────────────────────────────────────────
const C = {
  cream: '#FFFAF0',
  creamDeep: '#F5F0E8',
  creamWarm: '#FAF6EE',
  navy: '#0B2A4A',
  navyDark: '#061A30',
  tgBlue: '#229ED9',
  tgBlueDeep: '#0088CC',
  tgBlueDark: '#005580',
  tgBubble: '#EFFDDE',
  tgBubbleIn: '#FFFFFF',
  cyan: '#06B6D4',
  cyanDeep: '#0891B2',
  cyanSoft: '#CFFAFE',
  emerald: '#10B981',
  emeraldSoft: '#D1FAE5',
  emeraldDark: '#065F46',
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
  ink: '#1F2937',
  inkSoft: '#4B5563',
  inkLight: '#9CA3AF',
};

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;500;600;700;800&display=swap');
.tg-root, .tg-root * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.tg-root { font-family: 'Inter', -apple-system, sans-serif; color: ${C.ink}; background: ${C.cream}; }
.tg-display { font-family: 'Fraunces', serif; letter-spacing: -0.025em; font-optical-sizing: auto; }
.tg-mono { font-family: 'JetBrains Mono', monospace; }
.tg-grain::before { content:''; position:absolute; inset:0; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity:0.07; pointer-events:none; mix-blend-mode:overlay; }
.tg-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:100px; font-size:11px; font-weight:700; letter-spacing:0.04em; }
.tg-live-dot { width:7px; height:7px; border-radius:50%; background:${C.tgBlue}; position:relative; flex-shrink:0; }
.tg-live-dot::after { content:''; position:absolute; inset:-3px; border-radius:50%; background:${C.tgBlue}; opacity:0.4; animation:tg-pulse 1.8s ease-in-out infinite; }
@keyframes tg-pulse { 0%,100% { transform:scale(1); opacity:0.5; } 50% { transform:scale(1.6); opacity:0; } }
@keyframes tg-slideIn { from { opacity:0; transform:translateY(15px); } to { opacity:1; transform:translateY(0); } }
.tg-stagger > * { animation:tg-slideIn 0.45s ease-out backwards; }
.tg-stagger > *:nth-child(1) { animation-delay:0.04s; }
.tg-stagger > *:nth-child(2) { animation-delay:0.10s; }
.tg-stagger > *:nth-child(3) { animation-delay:0.16s; }
.tg-stagger > *:nth-child(4) { animation-delay:0.22s; }
.tg-stagger > *:nth-child(5) { animation-delay:0.28s; }
.tg-stagger > *:nth-child(6) { animation-delay:0.34s; }
@keyframes tg-slowRotate { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
.tg-slow-rotate { animation:tg-slowRotate 30s linear infinite; }
@keyframes tg-shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
.tg-shimmer { background-size:200% auto; background-clip:text; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:tg-shimmer 4s linear infinite; }
@keyframes tg-bubbleIn { from { opacity:0; transform:translateY(8px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
.tg-bubble-in { animation:tg-bubbleIn 0.4s ease-out backwards; }
@keyframes tg-typing { 0%,60%,100% { transform:translateY(0); opacity:0.4; } 30% { transform:translateY(-4px); opacity:1; } }
.tg-typing-dot { width:5px; height:5px; border-radius:50%; background:${C.inkLight}; display:inline-block; animation:tg-typing 1.2s ease-in-out infinite; }
.tg-typing-dot:nth-child(2) { animation-delay:0.15s; }
.tg-typing-dot:nth-child(3) { animation-delay:0.30s; }
`;

// ── COMMUNITY-FLAVORED CONVERSATION ────────────────────────────────────
type Msg =
  | { from: 'client'; text: string; time: string }
  | { from: 'bot'; text: string; time: string; read?: boolean };

const CONVERSATION: Msg[] = [
  { from: 'client', text: '/commande', time: '14:32' },
  { from: 'bot',    text: 'Bienvenue Karim 👋\n\nQue veux-tu commander chez *Boutique Zaffran* ?\n\n🛍️ Mode\n🍴 Restaurant\n💇 Salon\n🏨 Hôtel', time: '14:32', read: true },
  { from: 'client', text: '🛍️ Mode', time: '14:32' },
  { from: 'bot',    text: '*Boubou Bogolan* — 35 000 FCFA\n*Sac Wax*           — 18 500 FCFA\n*Bijoux laiton*    — 12 000 FCFA\n\nRéponds avec le numéro ou *#commande*.', time: '14:33', read: true },
  { from: 'client', text: 'Le boubou taille L', time: '14:33' },
  { from: 'bot',    text: '✅ Commande *#4521* enregistrée.\n\n💳 Paie via /wave ou /orange\n📦 Livraison Treichville 2h\n\nMerci 🙏 Tu seras notifié à chaque étape.', time: '14:34', read: true },
];

// ── 8 PACKS TELEGRAM-FIRST ─────────────────────────────────────────────
type PackCard = { id: string; emoji: string; title: string; sub: string; color: string; bg: string; tag?: string };
const PACKS: PackCard[] = [
  { id: 'b9',  emoji: '🎓', title: 'Pack Éducation',     sub: 'Channels cours · groupes élèves',     color: C.violetDeep,   bg: C.violetSoft,  tag: 'POPULAR' },
  { id: 'b5',  emoji: '🛡️', title: 'Pack Sécurité',       sub: 'Alertes chiffrées · GPS gardes',      color: C.coralDeep,    bg: C.coralSoft },
  { id: 'b13', emoji: '🔐', title: 'Pack Cybersécurité', sub: 'Bots SOC · audits · CISO virtuel',    color: '#DC2626',      bg: '#FEE2E2' },
  { id: 'b4',  emoji: '🌾', title: 'Pack Agriculture',   sub: 'Prix marché · météo · coopérative',   color: C.emerald,      bg: C.emeraldSoft },
  { id: 'b3',  emoji: '🛠️', title: 'Pack Artisan',        sub: 'Devis bots · suivi chantier',         color: C.gold,         bg: C.goldSoft },
  { id: 'b15', emoji: '🚀', title: 'Pack PME',           sub: 'Bots internes · CRM · marketing',     color: C.emerald,      bg: C.emeraldSoft, tag: 'BEST' },
  { id: 'b10', emoji: '🏢', title: 'Pack Entreprise',    sub: 'Channels équipe · workflows',         color: C.cyanDeep,     bg: C.cyanSoft },
  { id: 'b12', emoji: '👩‍💼', title: 'Pack RH',            sub: 'Notifs paie · congés · coaching',     color: C.violetDeep,   bg: C.violetSoft },
];

// ── 3 STEPS ────────────────────────────────────────────────────────────
const STEPS = [
  { n: '01', title: 'Crée ton bot Telegram',         sub: 'BotFather te donne un token — copie-colle, c\'est tout.',          icon: Bot,        color: C.tgBlue },
  { n: '02', title: 'Connecte-le à ton clone IA',    sub: 'Catalogue, FAQ, ton de marque. Multi-bots OK.',                    icon: Sparkles,   color: C.violetDeep },
  { n: '03', title: 'Diffuse & encaisse',             sub: 'Channels, groups, commandes inline + paiements intégrés.',         icon: Zap,        color: C.gold },
];

// ── COMPONENT ──────────────────────────────────────────────────────────
export default function TelegramLandingPage() {
  useSEO({
    title: 'Pack Telegram — Orlode AI',
    description: 'Bot Telegram, channels, communautés — ton clone IA répond et vend 24/7. $20/mois, BYOE.',
    path: '/telegram',
  });

  const [shownMsgs, setShownMsgs] = useState(1);
  useEffect(() => {
    if (shownMsgs >= CONVERSATION.length) return;
    const t = setTimeout(() => setShownMsgs(n => Math.min(n + 1, CONVERSATION.length)), 1200);
    return () => clearTimeout(t);
  }, [shownMsgs]);

  return (
    <div className="tg-root" style={{ minHeight: '100vh', position: 'relative' }}>
      <style>{STYLES}</style>
      <Hero />
      <Conversation shownMsgs={shownMsgs} />
      <HowItWorks />
      <UseCases />
      <Pricing />
      <Footer />
      <StickyCTA />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
function Hero() {
  return (
    <section style={{
      background: `linear-gradient(160deg, ${C.navyDark} 0%, ${C.navy} 50%, ${C.tgBlueDeep} 100%)`,
      color: C.cream,
      padding: '20px 22px 36px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="tg-grain" />
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4, pointerEvents: 'none' }}>
        {[...Array(50)].map((_, i) => (
          <circle key={i}
            cx={Math.random() * 100 + '%'}
            cy={Math.random() * 100 + '%'}
            r={Math.random() * 1.5 + 0.3}
            fill={i % 3 === 0 ? C.tgBlue : i % 3 === 1 ? C.goldLight : C.cream}
            opacity={Math.random() * 0.5 + 0.3}
          />
        ))}
      </svg>
      <div className="tg-slow-rotate" style={{
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
              background: `linear-gradient(135deg, ${C.tgBlue}, ${C.gold})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800,
            }}>O</div>
            <span className="tg-display" style={{ fontSize: 15, fontWeight: 700 }}>Orlode</span>
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

        <div className="tg-pill" style={{
          background: 'rgba(34,158,217,0.22)',
          color: '#7FCBE8',
          border: `1px solid ${C.tgBlue}40`,
          marginBottom: 14,
        }}>
          <span className="tg-live-dot" />
          PACK TELEGRAM · NOUVEAU
        </div>

        <h1 className="tg-display" style={{
          fontSize: 'clamp(36px, 9vw, 56px)',
          fontWeight: 800,
          lineHeight: 1.02,
          margin: '8px 0 14px',
        }}>
          Un bot <em className="tg-shimmer" style={{
            fontStyle: 'italic', fontWeight: 500,
            backgroundImage: `linear-gradient(90deg, ${C.tgBlue}, ${C.cream}, ${C.goldLight})`,
          }}>Telegram</em><br />
          qui vend pour<br />
          toi <em style={{ fontStyle: 'italic', color: C.goldLight, fontWeight: 500 }}>24/7</em>.
        </h1>

        <p style={{
          fontSize: 'clamp(15px, 3.8vw, 17px)',
          lineHeight: 1.55,
          color: 'rgba(255,250,240,0.82)',
          margin: '0 0 22px', maxWidth: 460,
        }}>
          Channels, communautés, commandes inline — <strong style={{ color: C.cream }}>ton clone IA gère tout</strong> avec
          la rapidité de Telegram et la précision d'un humain.
          <br /><span className="tg-mono" style={{ color: C.goldLight, fontWeight: 700 }}>$20/mois</span>, ton infra (BYOE).
        </p>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <Link to="/login?redirect=/marketplace" style={{
            background: C.cream,
            color: C.navyDark,
            border: 'none',
            padding: '13px 22px', borderRadius: 14,
            fontSize: 14, fontWeight: 800,
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            boxShadow: '0 10px 28px -8px rgba(0,0,0,0.4)',
          }}>
            <Sparkles size={15} /> Créer mon bot
          </Link>
          <a href="#demo" style={{
            background: 'rgba(255,250,240,0.10)',
            color: C.cream,
            border: `1px solid ${C.cream}35`,
            padding: '13px 18px', borderRadius: 14,
            fontSize: 14, fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            backdropFilter: 'blur(20px)',
          }}>
            <Send size={14} /> Voir la démo
          </a>
        </div>

        <div style={{
          marginTop: 28,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          paddingTop: 22,
          borderTop: `1px dashed ${C.cream}20`,
        }}>
          {[
            { value: '< 1 s',  label: 'TEMPS RÉPONSE' },
            { value: '10 000', label: 'ABONNÉS MAX' },
            { value: '+62%',   label: 'CTR CHANNEL' },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div className="tg-display tg-mono" style={{
                fontSize: 'clamp(16px, 4.5vw, 20px)',
                fontWeight: 800, color: C.goldLight, lineHeight: 1,
              }}>{m.value}</div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                color: 'rgba(255,250,240,0.55)', marginTop: 4,
              }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Conversation({ shownMsgs }: { shownMsgs: number }) {
  const visible = CONVERSATION.slice(0, shownMsgs);
  const showTyping = shownMsgs < CONVERSATION.length && visible[visible.length - 1]?.from === 'client';

  return (
    <section id="demo" style={{ padding: '40px 18px 36px', background: C.cream, position: 'relative' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="tg-pill" style={{
          background: '#E0F3FB', color: C.tgBlueDeep,
          border: `1px solid ${C.tgBlue}40`, marginBottom: 12,
        }}>
          💬 EN ACTION
        </div>
        <h2 className="tg-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Commandes <em style={{ fontStyle: 'italic', color: C.tgBlueDeep }}>inline</em>, instant.
        </h2>
        <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 22px', lineHeight: 1.55 }}>
          Karim commande depuis Telegram — ton bot répond, propose le catalogue et enregistre la commande.
        </p>

        {/* Chat container — Telegram blue gradient bg */}
        <div style={{
          background: 'linear-gradient(180deg, #B6D7EE, #97C5E3)',
          borderRadius: 16,
          padding: '14px 12px',
          border: `1px solid ${C.inkLight}30`,
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
          {/* Chat header */}
          <div style={{
            background: C.tgBlueDeep,
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
            }}>🤖</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>@ZaffranBot</div>
              <div style={{ fontSize: 10, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="tg-live-dot" style={{ width: 5, height: 5 }} />
                bot · répond instantanément
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visible.map((m, i) => <Bubble key={i} msg={m} idx={i} />)}
            {showTyping && (
              <div className="tg-bubble-in" style={{
                alignSelf: 'flex-start',
                background: C.tgBubbleIn,
                borderRadius: '12px 12px 12px 4px',
                padding: '10px 14px',
                marginTop: 2,
                boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span className="tg-typing-dot" />
                <span className="tg-typing-dot" />
                <span className="tg-typing-dot" />
              </div>
            )}
          </div>

          <div style={{
            marginTop: 14,
            background: C.cream,
            borderRadius: 100,
            padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
            border: `1px solid ${C.inkLight}25`,
          }}>
            <Paperclip size={16} color={C.inkLight} />
            <div style={{ flex: 1, fontSize: 12, color: C.inkLight }}>Message…</div>
            <Smile size={16} color={C.inkLight} />
            <Send size={16} color={C.tgBlueDeep} />
          </div>
        </div>

        <div style={{
          marginTop: 20,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          {[
            { icon: Zap,       text: 'Réponse < 1 s' },
            { icon: Megaphone, text: 'Channels jusqu\'à 10k' },
            { icon: Check,     text: 'Commandes inline' },
            { icon: Globe,     text: 'API open + webhooks' },
          ].map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: C.creamDeep, borderRadius: 10,
                padding: '9px 11px',
                border: '1px solid rgba(31,41,55,0.05)',
              }}>
                <Icon size={14} color={C.tgBlueDeep} />
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
  const bg = isClient ? C.tgBubble : C.tgBubbleIn;
  const align: React.CSSProperties = isClient
    ? { alignSelf: 'flex-end', borderRadius: '12px 12px 4px 12px' }
    : { alignSelf: 'flex-start', borderRadius: '12px 12px 12px 4px' };

  return (
    <div className="tg-bubble-in" style={{
      ...align, background: bg, padding: '7px 10px 5px', maxWidth: '82%',
      boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
      animationDelay: `${idx * 0.05}s`,
    }}>
      <div style={{
        fontSize: 13.5, color: C.ink, lineHeight: 1.45, whiteSpace: 'pre-line',
        fontFamily: isClient && (msg as { text: string }).text.startsWith('/')
          ? 'JetBrains Mono, monospace' : 'inherit',
      }}>
        {(msg as { text: string }).text.split('*').map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 2,
      }}>
        <span className="tg-mono" style={{ fontSize: 10, color: C.inkLight }}>{msg.time}</span>
        {isClient && <CheckMark read={(msg as { read?: boolean }).read} />}
      </div>
    </div>
  );
}

function CheckMark({ read }: { read?: boolean }) {
  const color = read ? C.tgBlueDeep : C.inkLight;
  return (
    <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
      <path d="M11.071 0.653l-5.495 7.41-3.213-2.16-1.363 1.413 4.576 3.077 6.857-9.247-1.362-0.493z" fill={color} />
      <path d="M15.071 0.653l-5.495 7.41-1.213-0.81-1.363 1.413 2.576 1.727 6.857-9.247-1.362-0.493z" fill={color} opacity={read ? 1 : 0.6} />
    </svg>
  );
}

function HowItWorks() {
  return (
    <section style={{ padding: '36px 18px', background: C.creamWarm }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="tg-pill" style={{
          background: C.goldSoft, color: C.goldDeep,
          border: `1px solid ${C.gold}40`, marginBottom: 12,
        }}>
          ⚡ 3 ÉTAPES
        </div>
        <h2 className="tg-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          De zéro à <em style={{ fontStyle: 'italic', color: C.gold }}>bot actif</em> en 5 min.
        </h2>
        <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 22px', lineHeight: 1.55 }}>
          BotFather + Orlode, pas plus. Le wizard t'accompagne pas à pas.
        </p>

        <div className="tg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} style={{
                background: C.cream,
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
                  <span className="tg-mono" style={{
                    fontSize: 10, fontWeight: 800, color: s.color,
                    letterSpacing: '0.05em',
                  }}>{s.n}</span>
                  <div className="tg-display" style={{
                    fontSize: 16, fontWeight: 700, color: C.ink,
                    lineHeight: 1.2, marginTop: 2, marginBottom: 3,
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

function UseCases() {
  return (
    <section style={{ padding: '40px 18px', background: C.cream }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="tg-pill" style={{
          background: C.violetSoft, color: C.violetDeep,
          border: `1px solid ${C.violet}40`, marginBottom: 12,
        }}>
          📦 8 PACKS · TELEGRAM-FIRST
        </div>
        <h2 className="tg-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Les packs qui <em style={{ fontStyle: 'italic', color: C.violetDeep }}>excellent</em> sur Telegram.
        </h2>
        <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 22px', lineHeight: 1.55 }}>
          Channels, communautés, bots inline · $20/mois chacun · activable indépendamment.
        </p>

        <div className="tg-stagger" style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9,
        }}>
          {PACKS.map((p) => (
            <Link key={p.id} to={`/marketplace#${p.id}`} style={{
              textDecoration: 'none', color: C.ink,
              background: C.cream,
              border: '1px solid rgba(31,41,55,0.06)',
              borderRadius: 14, padding: 12,
              display: 'flex', flexDirection: 'column', gap: 8,
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 12px -6px rgba(0,0,0,0.06)',
            }}>
              {p.tag && (
                <span className="tg-pill" style={{
                  position: 'absolute', top: 8, right: 8,
                  background: p.tag === 'BEST' ? C.tgBlueDeep : C.violetDeep,
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
                <div className="tg-display" style={{
                  fontSize: 13.5, fontWeight: 700, color: C.ink,
                  lineHeight: 1.2, marginBottom: 3,
                }}>{p.title}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.4 }}>
                  {p.sub}
                </div>
              </div>
              <div className="tg-mono" style={{
                fontSize: 11, fontWeight: 700, color: p.color,
                marginTop: 'auto',
              }}>$20/mo →</div>
            </Link>
          ))}
        </div>

        <Link to="/marketplace" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          background: `linear-gradient(135deg, #E0F3FB, ${C.cream})`,
          border: `1.5px dashed ${C.tgBlue}55`,
          borderRadius: 14,
          padding: '12px 16px',
          marginTop: 12,
          textDecoration: 'none',
          color: C.tgBlueDeep,
          fontSize: 13, fontWeight: 700,
        }}>
          Voir les 17 packs <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section style={{
      padding: '40px 18px',
      background: `linear-gradient(180deg, ${C.cream} 0%, ${C.creamDeep} 100%)`,
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="tg-pill" style={{
          background: C.emeraldSoft, color: C.emeraldDark,
          border: `1px solid ${C.emerald}40`, marginBottom: 12,
        }}>
          💰 PRICING TRANSPARENT
        </div>
        <h2 className="tg-display" style={{
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          fontWeight: 800, margin: '0 0 8px', lineHeight: 1.1,
        }}>
          <em style={{ fontStyle: 'italic', color: C.tgBlueDeep }}>$20</em>/mois.<br />
          Tout inclus.
        </h2>
        <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 22px', lineHeight: 1.55 }}>
          Bot, channels, paiements et inbox unifié — un seul prix, ton infra (BYOE).
        </p>

        <div style={{
          background: C.cream,
          border: `2px solid ${C.tgBlue}40`,
          borderRadius: 20, padding: 22,
          position: 'relative', overflow: 'hidden',
          boxShadow: `0 20px 40px -16px ${C.tgBlue}30`,
        }}>
          <div className="tg-slow-rotate" style={{
            position: 'absolute', top: -80, right: -80,
            width: 200, height: 200, borderRadius: '50%',
            border: `1px dashed ${C.tgBlue}20`,
          }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
              <span className="tg-display tg-mono" style={{
                fontSize: 52, fontWeight: 800, color: C.navyDark,
                lineHeight: 1, letterSpacing: '-0.04em',
              }}>$20</span>
              <span style={{ fontSize: 14, color: C.inkSoft, fontWeight: 600 }}>/mois</span>
              <span className="tg-pill" style={{
                background: C.emeraldSoft, color: C.emeraldDark,
                marginLeft: 'auto', fontSize: 10,
              }}>BYOE inclus</span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px' }} className="tg-stagger">
              {[
                'Bot Telegram + multi-bots illimité',
                'Channels & groupes (jusqu\'à 200k)',
                'Commandes inline + paiements intégrés',
                'Inbox unifié WhatsApp + Telegram',
                'Webhooks & API ouverte',
                'Multi-utilisateurs (équipe vente)',
              ].map((f, i) => (
                <li key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '6px 0', fontSize: 13.5, color: C.ink,
                  borderTop: i === 0 ? 'none' : '1px dashed rgba(31,41,55,0.08)',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#E0F3FB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Check size={11} color={C.tgBlueDeep} strokeWidth={3} />
                  </div>
                  <span style={{ fontWeight: 500 }}>{f}</span>
                </li>
              ))}
            </ul>

            <Link to="/login?redirect=/marketplace" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: `linear-gradient(135deg, ${C.tgBlue}, ${C.tgBlueDeep})`,
              color: C.cream,
              padding: '14px 18px', borderRadius: 14,
              fontSize: 14, fontWeight: 800,
              textDecoration: 'none',
              boxShadow: `0 14px 30px -8px ${C.tgBlue}`,
            }}>
              <Send size={16} /> Créer mon bot
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

        {/* WhatsApp cross-sell */}
        <Link to="/whatsapp" style={{
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
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            color: C.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Globe size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tg-display" style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>
              Pack WhatsApp aussi disponible
            </div>
            <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>
              Boutique 24/7, RDV, broadcasts — $20/mois
            </div>
          </div>
          <ChevronRight size={16} color={C.inkLight} />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{
      padding: '32px 18px 120px',
      background: C.navyDark,
      color: C.cream,
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="tg-grain" />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `linear-gradient(135deg, ${C.tgBlue}, ${C.gold})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 800, color: C.navyDark,
          }}>O</div>
          <span className="tg-display" style={{ fontSize: 18, fontWeight: 700 }}>Orlode AI</span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,250,240,0.7)', margin: '0 0 18px', lineHeight: 1.5 }}>
          🤖 Bot Telegram intelligent · Africa-first · $20/mois.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          {[
            { label: 'Connexion', to: '/login' },
            { label: 'Tous les packs', to: '/marketplace' },
            { label: 'WhatsApp', to: '/whatsapp' },
            { label: 'Mentions', to: '/legal' },
          ].map(l => (
            <Link key={l.to} to={l.to} style={{
              color: 'rgba(255,250,240,0.7)', textDecoration: 'none', fontWeight: 600,
            }}>{l.label}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

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
          background: `linear-gradient(135deg, ${C.tgBlue}, ${C.tgBlueDeep})`,
          color: C.cream,
          padding: '14px 18px', borderRadius: 16,
          fontSize: 14, fontWeight: 800,
          textDecoration: 'none',
          boxShadow: `0 16px 32px -10px ${C.tgBlue}, 0 0 0 1px ${C.cream}80`,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={16} /> Créer mon bot
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="tg-mono">$20/mois</span>
            <ArrowRight size={15} />
          </span>
        </Link>
      </div>
    </div>
  );
}
