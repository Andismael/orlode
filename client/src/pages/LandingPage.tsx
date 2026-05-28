/**
 * LandingPage — Premium marketing page
 * Dark theme, animated, 2 video slots, agents showcase, marketplace, pricing, testimonials, chat widget
 */
import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { useLangStore, LANGUAGES, type LangCode } from '@/store/langStore';
import { useAuthStore } from '@/store/authStore';
import { HeroGlobeScene } from '@/components/3d/SceneBackgrounds';
import { useSEO } from '@/hooks/useSEO';

const BrainVisualization = lazy(() => import('@/components/3d/BrainVisualization'));

/**
 * Convert any YouTube/Vimeo link into a proper embed URL.
 * Accepts:
 *   - https://www.youtube.com/watch?v=ID
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/shorts/ID
 *   - https://vimeo.com/ID
 * Returns the original URL if already an embed or unknown format.
 */
function toEmbedUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // Already an embed URL
  if (/\/embed\//.test(trimmed) || /player\.vimeo\.com/.test(trimmed)) return trimmed;

  // youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;

  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/youtube\.com\/watch\?[^ ]*v=([A-Za-z0-9_-]{6,})/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;

  // youtube.com/shorts/ID
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/);
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;

  // vimeo.com/ID
  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  // Unknown format — return as-is
  return trimmed;
}

const AGENTS = [
  { icon: '🧠', name: 'Orchestrateur', desc: 'Coordonne tous les agents', color: '#3B82F6' },
  { icon: '📚', name: 'Knowledge', desc: 'Documents, Q&A, contrats', color: '#0EA5E9' },
  { icon: '🚪', name: 'Reception', desc: 'Accueil, visiteurs, badges', color: '#14B8A6' },
  { icon: '👩', name: 'RH', desc: 'Conges, recrutement, onboarding', color: '#6366F1' },
  { icon: '💰', name: 'Comptabilite', desc: 'Factures, tresorerie, TVA', color: '#16A34A' },
  { icon: '🤝', name: 'Commercial', desc: 'Pipeline, leads, devis, forecast', color: '#F97316' },
  { icon: '📞', name: 'Support', desc: 'Tickets SLA, sentiment IA', color: '#06B6D4' },
  { icon: '🖥', name: 'IT', desc: 'Helpdesk, CMDB, licences', color: '#64748B' },
  { icon: '🛡', name: 'Cybersecurite', desc: 'Audit, phishing, compliance', color: '#EF4444' },
  { icon: '📣', name: 'Marketing', desc: 'Video AI, SEO, campagnes', color: '#8B5CF6' },
  { icon: '🎓', name: 'Formation', desc: 'Cours IA, quiz, certificats', color: '#0284C7' },
  { icon: '⚖', name: 'Juridique', desc: 'Contrats, RGPD, risk scoring', color: '#78716C' },
  { icon: '📊', name: 'Insights', desc: 'Tendances, anomalies, alertes', color: '#F59E0B' },
  { icon: '🎤', name: 'Reunions', desc: 'Transcription, resume, actions', color: '#E11D48' },
  { icon: '📧', name: 'Communications', desc: 'Email, WhatsApp, Slack, SMS', color: '#EC4899' },
  { icon: '🔬', name: 'Data Scientist', desc: 'Predictions, correlations', color: '#0891B2' },
  { icon: '🧑‍🏫', name: 'Coach', desc: 'Carriere, bien-etre, burnout', color: '#84CC16' },
  { icon: '⭐', name: 'Veille', desc: 'News, concurrents, digest', color: '#EAB308' },
  { icon: '⚡', name: 'Workflow', desc: 'Automatisation, triggers, SLA', color: '#F59E0B' },
  { icon: '🛡️', name: 'Securite Physique', desc: 'Gardes, rondes, incidents', color: '#475569' },
  { icon: '📹', name: 'Surveillance', desc: 'CCTV, detection IA, rapports', color: '#1E40AF' },
  { icon: '🔮', name: 'Wildcard', desc: 'Agent polyvalent', color: '#A855F7' },
];

const MARKETPLACE_AGENTS = [
  { icon: '🏥', name: 'Agent Sante', desc: 'Patients, analyse medicale, epidemiologie', color: '#EF4444', industry: 'Sante' },
  { icon: '🏠', name: 'Agent Immobilier', desc: 'Clients, estimation prix, marche', color: '#3B82F6', industry: 'Immobilier' },
  { icon: '🌱', name: 'Agent Agronome', desc: 'Sol, maladies, rendement, meteo', color: '#16A34A', industry: 'Agriculture' },
  { icon: '🚗', name: 'Agent Mecanicien', desc: 'Diagnostic OBD, devis, stock pieces', color: '#64748B', industry: 'Automobile' },
  { icon: '🍽️', name: 'Agent Restaurant', desc: 'Commandes, menu, gaspillage', color: '#10B981', industry: 'Restauration' },
  { icon: '💇', name: 'Agent Coiffure', desc: 'RDV, simulation, fidelisation', color: '#EC4899', industry: 'Beaute' },
  { icon: '🏦', name: 'Agent Finance', desc: 'Credit scoring, fraude, previsions', color: '#0891B2', industry: 'Finance' },
  { icon: '🎓', name: 'Agent Educatif', desc: 'Cours, quiz, progression eleves', color: '#6366F1', industry: 'Education' },
  { icon: '🏦', name: 'Agent Assurance', desc: 'Polices, sinistres, risk scoring', color: '#1D4ED8', industry: 'Assurance' },
];

// Pricing model April 2026: $19.99/pack métier · 30 jours gratuits sans CB.
// Old Starter/Pro/Premium tiers retired — packs are picked in onboarding wizard
// or marketplace and contain 7 agents each (4 spécialisés + 3 core).
const PLANS_M = [
  { name: 'Free', price: '$0', sub: '', desc: 'Pour tester la plateforme', features: ['1 agent Knowledge', '10 documents', '1 utilisateur', 'Aucun engagement'], cta: 'Essayer gratuitement', featured: false },
  { name: 'Pack métier', price: '$19.99', sub: '/mois', desc: '🎁 30 jours gratuits sans CB', features: ['4 agents spécialisés (RH, Sales, Resto...)', '+ 3 agents core (Knowledge, Workflow, Wildcard)', 'Orchestrateur IA inclus', 'BYOE : ta clé OpenAI/Claude/Gemini', 'WhatsApp Business + signature électronique'], cta: 'Démarrer mon essai', featured: true },
  { name: 'Super Pack', price: '$49.99', sub: '/mois', desc: '11 agents flagship · -17%', features: ['8 agents spécialisés (Sales, Marketing, Comms, Support, Compta, RH, Réception, Cyber)', '+ 3 agents core', 'Orchestrateur IA inclus', 'Knowledge brain unifié', 'Économise vs 3 packs séparés'], cta: 'Activer le Super Pack', featured: false },
];

const TESTIMONIALS = [
  { name: 'Aminata D.', role: 'DG, AfriDigital', text: 'Orlode a remplace 5 outils qu\'on payait separement. Nos equipes sont 3x plus productives.', avatar: 'A' },
  { name: 'Thomas M.', role: 'CTO, TechCorp', text: 'L\'orchestrateur multi-agents est bluffant. On pose une question et 3 agents collaborent pour repondre.', avatar: 'T' },
  { name: 'Fatou K.', role: 'RH, GreenTech', text: 'La gestion des conges et l\'onboarding automatise nous font gagner 10h par semaine.', avatar: 'F' },
  { name: 'Moussa B.', role: 'Gerant, AutoPro', text: 'L\'agent mecanicien diagnostique les pannes avant meme que le client arrive. Incroyable.', avatar: 'M' },
  { name: 'Sarah L.', role: 'CEO, FinTech CI', text: 'Le scoring IA et la detection de fraude ont divise nos pertes par 4 en 2 mois.', avatar: 'S' },
  { name: 'Koffi A.', role: 'Directeur, AgriPlus', text: 'Tous nos agents sur une seule plateforme. On gère tout depuis WhatsApp maintenant.', avatar: 'K' },
];

const CHECK = <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round"/></svg>;

export default function LandingPage() {
  useSEO({
    title: 'Orlode AI — 48 Agents IA pour votre Entreprise',
    description: 'Plateforme multi-agents IA pour entreprises modernes. Agents spécialisés, marketplace métier, site web auto, WhatsApp, BYOK.',
    path: '/',
  });
  const { t, lang, setLang } = useLangStore();
  const [langOpen, setLangOpen] = useState(false);
  // Lightweight i18n helper: lp('Texte FR', 'Text EN'). Other langs fall back to EN, FR if EN missing.
  const lp = (fr: string, en?: string) => lang === 'fr' ? fr : (en ?? fr);
  const { user: authUser } = useAuthStore();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [navScrolled, setNavScrolled] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // CMS content from Firestore (overrides defaults)
  const [cms, setCms] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    fetch('/api/public/landing').then(r => r.json()).then(d => {
      if (d?.data) setCms(d.data);
      else if (d?.success === true && d?.data === null) setCms(null);
    }).catch(() => {});
  }, []);

  // Helpers to read CMS or fallback
  const c = (key: string, fallback: string) => (cms?.[key] as string) ?? fallback;
  const cArr = <T,>(key: string, fallback: T[]): T[] => {
    const v = cms?.[key];
    return Array.isArray(v) && v.length > 0 ? v as T[] : fallback;
  };
  const [chatMessages, setChatMessages] = useState<Array<{ text: string; role: 'bot' | 'user' }>>([
    { text: 'Bonjour 👋 Je suis l\'Agent Commercial de Orlode. Comment puis-je vous aider ?', role: 'bot' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const plans = billing === 'monthly' ? PLANS_M : PLANS_M.map(p => {
    if (p.price === '$0') return p;
    const monthly = parseFloat(p.price.replace('$', ''));
    const yearly = Math.round(monthly * 10);
    return { ...p, price: `$${yearly}`, sub: '/an', desc: `Économisez $${Math.round(monthly * 2)}/an` };
  });

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('lp-visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.lp-reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { text, role: 'user' }]);
    setChatLoading(true);
    try {
      const res = await fetch('/api/public/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, language: 'fr', sessionId }),
      });
      const data = await res.json();
      if (data.success) { setSessionId(data.data.sessionId); setChatMessages(prev => [...prev, { text: data.data.response, role: 'bot' }]); }
      else setChatMessages(prev => [...prev, { text: 'Désolé, une erreur est survenue.', role: 'bot' }]);
    } catch { setChatMessages(prev => [...prev, { text: 'Connexion impossible.', role: 'bot' }]); }
    setChatLoading(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap');
        .lp{--blue:#2B4AFF;--amber:#FF9B00;--dark:#080C1A;--dark2:#0F1429;--dark3:#161B33;--g4:#5D6478;--g5:#8B92A8;--r:14px;--coral:#FF8B65;--coralDeep:#FF7847;font-family:'Outfit',sans-serif;color:#fff;background:#05060C;background-attachment:fixed;min-height:100vh;overflow-x:hidden}
        .lp *{box-sizing:border-box;color:inherit}
        .lp a{text-decoration:none}
        .lp .gt{background:linear-gradient(135deg,var(--blue),#6B8AFF,var(--amber));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .lp .orb{position:absolute;border-radius:50%;filter:blur(120px);pointer-events:none}
        .lp .lp-reveal{opacity:0;transform:translateY(30px);transition:opacity 0.7s,transform 0.7s}
        .lp .lp-visible{opacity:1;transform:translateY(0)}
        .lp .rd1{transition-delay:.1s}.lp .rd2{transition-delay:.2s}.lp .rd3{transition-delay:.3s}
        .lp .st{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px;color:var(--amber)}
        .lp .sh{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(32px,5vw,48px);font-weight:800;letter-spacing:-.03em;line-height:1.1}
        .lp .ss{font-size:18px;color:var(--g4);margin-top:12px}
        .lp .btn{display:inline-flex;align-items:center;gap:8px;font-family:'Outfit';font-weight:600;font-size:14px;border:none;cursor:pointer;border-radius:var(--r);padding:12px 24px;transition:all .3s}
        .lp .bp{background:linear-gradient(135deg,var(--coral),var(--coralDeep));color:#fff;box-shadow:0 8px 24px -8px var(--coral)}.lp .bp:hover{transform:translateY(-1px);box-shadow:0 14px 32px -8px var(--coralDeep)}
        .lp .bo{background:rgba(255,255,255,.85);color:#2A1810;border:1.5px solid rgba(42,24,16,.15);backdrop-filter:blur(8px)}.lp .bo:hover{border-color:rgba(42,24,16,.3);background:#fff;transform:translateY(-1px)}
        .lp .ba{background:var(--amber);color:#000;font-weight:700}.lp .ba:hover{background:#FFB333;transform:translateY(-1px)}
        .lp .bl{padding:16px 36px;font-size:16px;border-radius:16px}
        .lp .video-slot{aspect-ratio:16/9;background:var(--dark2);border:1px solid rgba(255,255,255,.06);border-radius:16px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
        .lp .video-slot .play{width:72px;height:72px;background:rgba(43,74,255,.9);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .2s;box-shadow:0 8px 30px rgba(43,74,255,.4)}
        .lp .video-slot .play:hover{transform:scale(1.1)}
        @media(max-width:768px){.lp .mob-col{flex-direction:column!important}.lp .mob-1{grid-template-columns:1fr!important}.lp .mob-2{grid-template-columns:repeat(2,1fr)!important}.lp .mob-hide{display:none!important}.lp .mob-px{padding-left:20px!important;padding-right:20px!important}}

        /* ── NEW HERO (aurora + orbits + roulette) ─────────────────── */
        .lp .hero-root{position:relative;background:transparent;isolation:isolate;overflow:hidden}
        .lp .aurora{position:absolute;inset:-10%;z-index:0;filter:blur(100px);opacity:.25;pointer-events:none}
        .lp .aurora::before,.lp .aurora::after,.lp .aurora span{content:"";position:absolute;border-radius:50%}
        .lp .aurora::before{width:600px;height:600px;top:20%;left:30%;background:radial-gradient(circle,#7F77DD 0%,transparent 60%);animation:aurora1 22s ease-in-out infinite}
        .lp .aurora::after{width:500px;height:500px;bottom:10%;right:20%;background:radial-gradient(circle,#D4537E 0%,transparent 60%);animation:aurora2 26s ease-in-out infinite}
        .lp .aurora .a3{width:450px;height:450px;bottom:5%;left:15%;background:radial-gradient(circle,#1D9E75 0%,transparent 60%);animation:aurora3 24s ease-in-out infinite}
        .lp .aurora .a4{width:400px;height:400px;top:30%;right:10%;background:radial-gradient(circle,#EF9F27 0%,transparent 60%);animation:aurora4 28s ease-in-out infinite}
        @keyframes aurora1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-10%,10%) scale(1.2)}}
        @keyframes aurora2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(15%,-15%) scale(1.15)}}
        @keyframes aurora3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-12%,-8%) scale(1.18)}}
        @keyframes aurora4{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(10%,12%) scale(1.1)}}
        .lp .stars{position:absolute;inset:0;z-index:0;pointer-events:none;display:none}
        .lp .star{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;box-shadow:0 0 6px rgba(255,255,255,.8)}
        .lp .star.s1{top:22%;left:14%;animation:twinkle 3s infinite}
        .lp .star.s2{top:32%;left:82%;animation:twinkle 4s infinite .5s}
        .lp .star.s3{top:45%;left:8%;animation:twinkle 3.5s infinite 1s;width:3px;height:3px}
        .lp .star.s4{top:28%;left:90%;animation:twinkle 2.8s infinite .8s}
        .lp .star.s5{top:58%;left:25%;animation:twinkle 4.2s infinite 1.5s}
        .lp .star.s6{top:52%;left:70%;animation:twinkle 3.2s infinite 2s;width:3px;height:3px}
        .lp .star.s7{top:18%;left:45%;animation:twinkle 3.8s infinite .3s}
        .lp .star.s8{top:65%;left:88%;animation:twinkle 3.6s infinite 1.2s}
        @keyframes twinkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.3)}}

        .lp .topbar{position:relative;z-index:5;display:flex;align-items:center;justify-content:center;gap:16px;padding:12px 24px;background:linear-gradient(90deg,rgba(127,119,221,.2),rgba(212,83,126,.15),rgba(239,159,39,.1));border-bottom:.5px solid rgba(255,255,255,.08);backdrop-filter:blur(10px)}
        .lp .topbar-text{font-size:14px;color:#fff;display:inline-flex;align-items:center;gap:8px}
        .lp .topbar-text strong{font-weight:500;background:linear-gradient(135deg,#F4C0D1,#FAC775);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
        .lp .wave{display:inline-block;animation:wave 2s ease-in-out infinite;transform-origin:70% 70%}
        @keyframes wave{0%,100%{transform:rotate(0)}15%{transform:rotate(14deg)}30%{transform:rotate(-8deg)}45%{transform:rotate(14deg)}60%{transform:rotate(-4deg)}75%{transform:rotate(10deg)}}
        .lp .topbar-cta{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;background:rgba(255,255,255,.95);color:#0A0A0F;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:all .2s;text-decoration:none}
        .lp .topbar-cta:hover{background:#fff;transform:translateY(-1px)}

        .lp .nav2{position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:22px 48px;max-width:1400px;margin:0 auto}
        .lp .brand{display:flex;align-items:center;gap:12px}
        .lp .logo2{width:42px;height:42px;border-radius:12px;position:relative;overflow:hidden;background:conic-gradient(from 0deg,#7F77DD,#D4537E,#EF9F27,#1D9E75,#7F77DD);animation:logoRot 10s linear infinite}
        .lp .logo2::after{content:"";position:absolute;inset:3px;border-radius:9px;background:#05060C}
        .lp .logo2::before{content:"";position:absolute;inset:11px;border-radius:5px;background:conic-gradient(from 180deg,#7F77DD,#D4537E,#EF9F27,#1D9E75,#7F77DD);z-index:1;animation:logoRot 6s linear infinite reverse}
        @keyframes logoRot{to{transform:rotate(360deg)}}
        .lp .brand-name{font-size:22px;font-weight:500;color:#fff;letter-spacing:-.01em}
        .lp .nav2-links{display:flex;gap:6px}
        .lp .nav2-link{padding:10px 18px;border-radius:999px;font-size:14px;color:rgba(255,255,255,.8);font-weight:500;cursor:pointer;text-decoration:none;transition:all .2s}
        .lp .nav2-link:hover{color:#fff;background:rgba(255,255,255,.06)}
        .lp .nav2-cta{padding:11px 24px;border-radius:999px;font-size:14px;font-weight:500;cursor:pointer;color:#fff;background:linear-gradient(135deg,#7F77DD,#D4537E);box-shadow:0 4px 18px rgba(127,119,221,.45);border:none;transition:all .2s;text-decoration:none;display:inline-block}
        .lp .nav2-cta:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(127,119,221,.6)}

        .lp .new-hero{position:relative;z-index:2;padding:60px 40px 100px;display:flex;flex-direction:column;align-items:center;text-align:center;min-height:calc(100vh - 200px);max-width:1400px;margin:0 auto}

        .lp .orbit-bg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:1100px;height:1100px;z-index:0;pointer-events:none;perspective:1400px}
        .lp .orbit-bg > div{position:absolute;top:50%;left:50%;border-radius:50%;transform-style:preserve-3d}
        .lp .orbit-bg .ring1{width:500px;height:500px;margin:-250px 0 0 -250px;border:.5px solid rgba(127,119,221,.4);transform:rotateX(72deg);animation:ringSpin1 25s linear infinite}
        .lp .orbit-bg .ring2{width:700px;height:700px;margin:-350px 0 0 -350px;border:.5px solid rgba(212,83,126,.3);transform:rotateX(72deg) rotateZ(60deg);animation:ringSpin2 35s linear infinite reverse}
        .lp .orbit-bg .ring3{width:900px;height:900px;margin:-450px 0 0 -450px;border:.5px solid rgba(239,159,39,.25);transform:rotateX(72deg) rotateZ(120deg);animation:ringSpin3 50s linear infinite}
        @keyframes ringSpin1{from{transform:rotateX(72deg) rotateZ(0deg)}to{transform:rotateX(72deg) rotateZ(360deg)}}
        @keyframes ringSpin2{from{transform:rotateX(72deg) rotateZ(60deg)}to{transform:rotateX(72deg) rotateZ(420deg)}}
        @keyframes ringSpin3{from{transform:rotateX(72deg) rotateZ(120deg)}to{transform:rotateX(72deg) rotateZ(480deg)}}

        .lp .eyebrow{position:relative;z-index:2;display:inline-flex;align-items:center;gap:12px;padding:10px 22px;border-radius:999px;background:linear-gradient(135deg,rgba(127,119,221,.15),rgba(212,83,126,.08));border:.5px solid rgba(127,119,221,.4);font-size:13px;color:#fff;font-weight:500;backdrop-filter:blur(12px);margin-bottom:32px;animation:fadeUp 1s ease-out}
        .lp .eyebrow .dot{width:7px;height:7px;border-radius:50%;background:#FAC775;box-shadow:0 0 10px #EF9F27;animation:pulse 1.5s infinite}
        .lp .eyebrow .accent{background:linear-gradient(135deg,#FAC775,#EF9F27);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:500}
        .lp .eyebrow .sep{color:rgba(255,255,255,.4);margin:0 4px}

        .lp .new-hero-title{position:relative;z-index:2;font-size:clamp(48px,6vw,88px);font-weight:500;margin:0;letter-spacing:-.03em;line-height:1.05;max-width:1100px;animation:fadeUp 1s ease-out .2s both;font-family:'Bricolage Grotesque',sans-serif}
        .lp .new-hero-title .line1{display:block;color:#fff}
        .lp .new-hero-title .line2{display:block;margin-top:8px}
        .lp .new-hero-title .word-static{color:#fff}

        .lp .roulette{display:inline-block;position:relative;min-width:600px;vertical-align:baseline;text-align:left;height:1.05em}
        .lp .roulette-ph{visibility:hidden;white-space:nowrap}
        .lp .roulette-word{position:absolute;left:0;top:0;white-space:nowrap;opacity:0;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;background-size:200% 200%}
        .lp .roulette-word.w1{background-image:linear-gradient(135deg,#FAC775 0%,#EF9F27 50%,#D4537E 100%);animation:rw1 16s infinite,shine 4s infinite linear}
        .lp .roulette-word.w2{background-image:linear-gradient(135deg,#AFA9EC 0%,#7F77DD 50%,#D4537E 100%);animation:rw2 16s infinite,shine 4s infinite linear}
        .lp .roulette-word.w3{background-image:linear-gradient(135deg,#5DCAA5 0%,#1D9E75 50%,#7F77DD 100%);animation:rw3 16s infinite,shine 4s infinite linear}
        .lp .roulette-word.w4{background-image:linear-gradient(135deg,#F4C0D1 0%,#D4537E 50%,#FAC775 100%);animation:rw4 16s infinite,shine 4s infinite linear}
        @keyframes rw1{0%,2%,25%,100%{opacity:0;transform:translateY(40px)}4%,21%{opacity:1;transform:translateY(0)}23%{opacity:0;transform:translateY(-40px)}}
        @keyframes rw2{0%,25%,27%,50%,100%{opacity:0;transform:translateY(40px)}29%,46%{opacity:1;transform:translateY(0)}48%{opacity:0;transform:translateY(-40px)}}
        @keyframes rw3{0%,50%,52%,75%,100%{opacity:0;transform:translateY(40px)}54%,71%{opacity:1;transform:translateY(0)}73%{opacity:0;transform:translateY(-40px)}}
        @keyframes rw4{0%,75%,77%,100%{opacity:0;transform:translateY(40px)}79%,96%{opacity:1;transform:translateY(0)}98%{opacity:0;transform:translateY(-40px)}}
        @keyframes shine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}

        .lp .new-hero-sub{position:relative;z-index:2;font-size:19px;color:rgba(255,255,255,.78);max-width:720px;line-height:1.6;margin:32px 0 0;font-weight:400;animation:fadeUp 1s ease-out .4s both}
        .lp .new-hero-sub strong{color:#fff;font-weight:500}
        .lp .new-hero-sub .highlight{background:linear-gradient(135deg,#FAC775,#F4C0D1);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:500}

        .lp .cta-row{position:relative;z-index:2;display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center;margin-top:40px;animation:fadeUp 1s ease-out .6s both}
        .lp .cta-primary{display:inline-flex;align-items:center;gap:12px;padding:18px 36px;border-radius:14px;font-size:16px;font-weight:500;background:linear-gradient(135deg,#7F77DD,#D4537E,#EF9F27);background-size:200% 200%;color:#fff;border:none;cursor:pointer;box-shadow:0 10px 40px rgba(127,119,221,.5),0 4px 12px rgba(212,83,126,.3);position:relative;overflow:hidden;transition:all .3s;animation:gradientMove 5s infinite linear;text-decoration:none}
        @keyframes gradientMove{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        .lp .cta-primary::after{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);animation:ctaShine 3s infinite}
        @keyframes ctaShine{to{left:200%}}
        .lp .cta-primary:hover{transform:translateY(-3px);box-shadow:0 16px 50px rgba(127,119,221,.7),0 8px 20px rgba(212,83,126,.4)}
        .lp .cta-primary .spark{animation:sparkle 2s ease-in-out infinite}
        @keyframes sparkle{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.3) rotate(20deg)}}
        .lp .cta-ghost{display:inline-flex;align-items:center;gap:10px;padding:18px 26px;border-radius:14px;font-size:15px;font-weight:500;background:rgba(255,255,255,.08);border:.5px solid rgba(255,255,255,.25);color:#fff;cursor:pointer;backdrop-filter:blur(10px);transition:all .25s;text-decoration:none}
        .lp .cta-ghost:hover{background:rgba(255,255,255,.14);transform:translateY(-2px);border-color:rgba(255,255,255,.4)}

        .lp .trust2{position:relative;z-index:2;display:flex;gap:28px;flex-wrap:wrap;justify-content:center;margin-top:24px;animation:fadeUp 1s ease-out .8s both}
        .lp .trust-item{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.7);font-weight:500}
        .lp .trust-ico{width:18px;height:18px;border-radius:50%;background:rgba(29,158,117,.2);color:#5DCAA5;display:flex;align-items:center;justify-content:center}
        .lp .trust-ico svg{width:10px;height:10px}

        .lp .float-card{position:absolute;z-index:3;padding:14px 20px;border-radius:16px;background:rgba(15,16,28,.7);border:.5px solid rgba(255,255,255,.12);backdrop-filter:blur(20px);box-shadow:0 10px 40px rgba(0,0,0,.4);display:flex;align-items:center;gap:12px;animation:floatCard 6s ease-in-out infinite}
        .lp .float-card .ico{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff}
        .lp .float-card .text{display:flex;flex-direction:column;text-align:left}
        .lp .float-card .main-text{font-size:14px;font-weight:500;color:#fff;line-height:1.2}
        .lp .float-card .sub-text{font-size:11px;color:rgba(255,255,255,.65);margin-top:2px}
        .lp .float-card.fc1{top:32%;left:6%;animation-delay:0s}
        .lp .float-card.fc1 .ico{background:linear-gradient(135deg,#AFA9EC,#7F77DD);box-shadow:0 4px 14px rgba(127,119,221,.4)}
        .lp .float-card.fc2{top:28%;right:6%;animation-delay:1.5s}
        .lp .float-card.fc2 .ico{background:linear-gradient(135deg,#FAC775,#EF9F27);box-shadow:0 4px 14px rgba(239,159,39,.4)}
        .lp .float-card.fc3{bottom:22%;left:7%;animation-delay:3s}
        .lp .float-card.fc3 .ico{background:linear-gradient(135deg,#5DCAA5,#1D9E75);box-shadow:0 4px 14px rgba(29,158,117,.4)}
        .lp .float-card.fc4{bottom:18%;right:5%;animation-delay:2s}
        .lp .float-card.fc4 .ico{background:linear-gradient(135deg,#D4537E,#993556);box-shadow:0 4px 14px rgba(212,83,126,.4)}
        .lp .float-card.fc4 .main-text{background:linear-gradient(135deg,#F4C0D1,#FAC775);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
        @keyframes floatCard{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-12px) rotate(1deg)}}

        @media(max-width:1024px){.lp .float-card{display:none}.lp .roulette{min-width:100%}}
        @media(max-width:768px){.lp .nav2{padding:18px 24px}.lp .nav2-links{display:none}.lp .new-hero{padding:40px 24px 60px}.lp .topbar{flex-direction:column;gap:8px;padding:12px 16px}.lp .new-hero-title{font-size:44px}.lp .eyebrow{font-size:12px;padding:8px 16px}.lp .cta-row{flex-direction:column;align-items:stretch;width:100%;max-width:320px}.lp .cta-primary,.lp .cta-ghost{justify-content:center}}

        /* ── MARKETPLACE INDUSTRY CARDS ───────────────────────────── */
        .lp .market-eyebrow{display:inline-flex;align-items:center;gap:10px;padding:8px 20px;border-radius:999px;background:linear-gradient(135deg,rgba(239,159,39,.2),rgba(216,90,48,.12));border:.5px solid rgba(239,159,39,.45);font-size:12px;color:#fff;font-weight:500;letter-spacing:.15em;text-transform:uppercase;backdrop-filter:blur(10px);margin-bottom:22px}
        .lp .market-eyebrow .count{background:linear-gradient(135deg,#FAC775,#EF9F27);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:500;margin-left:6px;letter-spacing:.02em;text-transform:none}
        .lp .market-eyebrow-ico{width:16px;height:16px;display:flex;align-items:center;justify-content:center;color:#FAC775}

        .lp .market-grid{position:relative;z-index:2;padding:30px 0 0;max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .lp .ind-card{position:relative;border-radius:18px;overflow:hidden;border:.5px solid rgba(255,255,255,.1);padding:22px;cursor:pointer;transition:all .3s;display:flex;flex-direction:column;gap:14px;backdrop-filter:blur(12px);background:rgba(255,255,255,.03);text-align:left}
        .lp .ind-card:hover{transform:translateY(-6px);border-color:rgba(255,255,255,.3)}
        .lp .ind-card::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;opacity:.9}
        .lp .ind-card .glow{position:absolute;top:-50%;right:-30%;width:260px;height:260px;border-radius:50%;opacity:.25;z-index:0;filter:blur(40px)}
        .lp .ind-card > *{position:relative;z-index:1}
        .lp .ind-card.health::before{background:linear-gradient(90deg,#5DCAA5,#1D9E75);box-shadow:0 0 12px #1D9E75}.lp .ind-card.health .glow{background:radial-gradient(circle,#1D9E75,transparent)}.lp .ind-card.health:hover{border-color:rgba(29,158,117,.5);box-shadow:0 16px 40px rgba(29,158,117,.25)}
        .lp .ind-card.commerce::before{background:linear-gradient(90deg,#AFA9EC,#7F77DD);box-shadow:0 0 12px #7F77DD}.lp .ind-card.commerce .glow{background:radial-gradient(circle,#7F77DD,transparent)}.lp .ind-card.commerce:hover{border-color:rgba(127,119,221,.5);box-shadow:0 16px 40px rgba(127,119,221,.25)}
        .lp .ind-card.btp::before{background:linear-gradient(90deg,#FAC775,#EF9F27);box-shadow:0 0 12px #EF9F27}.lp .ind-card.btp .glow{background:radial-gradient(circle,#EF9F27,transparent)}.lp .ind-card.btp:hover{border-color:rgba(239,159,39,.5);box-shadow:0 16px 40px rgba(239,159,39,.25)}
        .lp .ind-card.agri::before{background:linear-gradient(90deg,#C0DD97,#639922);box-shadow:0 0 12px #639922}.lp .ind-card.agri .glow{background:radial-gradient(circle,#639922,transparent)}.lp .ind-card.agri:hover{border-color:rgba(99,153,34,.5);box-shadow:0 16px 40px rgba(99,153,34,.25)}
        .lp .ind-card.edu::before{background:linear-gradient(90deg,#85B7EB,#378ADD);box-shadow:0 0 12px #378ADD}.lp .ind-card.edu .glow{background:radial-gradient(circle,#378ADD,transparent)}.lp .ind-card.edu:hover{border-color:rgba(55,138,221,.5);box-shadow:0 16px 40px rgba(55,138,221,.25)}
        .lp .ind-card.hospi::before{background:linear-gradient(90deg,#F5C4B3,#D85A30);box-shadow:0 0 12px #D85A30}.lp .ind-card.hospi .glow{background:radial-gradient(circle,#D85A30,transparent)}.lp .ind-card.hospi:hover{border-color:rgba(216,90,48,.5);box-shadow:0 16px 40px rgba(216,90,48,.25)}
        .lp .ind-card.trans::before{background:linear-gradient(90deg,#F4C0D1,#D4537E);box-shadow:0 0 12px #D4537E}.lp .ind-card.trans .glow{background:radial-gradient(circle,#D4537E,transparent)}.lp .ind-card.trans:hover{border-color:rgba(212,83,126,.5);box-shadow:0 16px 40px rgba(212,83,126,.25)}
        .lp .ind-card.finance::before{background:linear-gradient(90deg,#B5D4F4,#185FA5);box-shadow:0 0 12px #185FA5}.lp .ind-card.finance .glow{background:radial-gradient(circle,#185FA5,transparent)}.lp .ind-card.finance:hover{border-color:rgba(24,95,165,.5);box-shadow:0 16px 40px rgba(24,95,165,.25)}

        .lp .ic-top{display:flex;justify-content:space-between;align-items:flex-start}
        .lp .ic-ico{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;transition:transform .3s}
        .lp .ind-card:hover .ic-ico{transform:scale(1.1) rotate(-3deg)}
        .lp .ind-card.health .ic-ico{background:linear-gradient(135deg,#5DCAA5,#0F6E56);box-shadow:0 4px 16px rgba(29,158,117,.45)}
        .lp .ind-card.commerce .ic-ico{background:linear-gradient(135deg,#AFA9EC,#534AB7);box-shadow:0 4px 16px rgba(127,119,221,.45)}
        .lp .ind-card.btp .ic-ico{background:linear-gradient(135deg,#FAC775,#BA7517);box-shadow:0 4px 16px rgba(239,159,39,.45)}
        .lp .ind-card.agri .ic-ico{background:linear-gradient(135deg,#C0DD97,#3B6D11);box-shadow:0 4px 16px rgba(99,153,34,.45)}
        .lp .ind-card.edu .ic-ico{background:linear-gradient(135deg,#85B7EB,#0C447C);box-shadow:0 4px 16px rgba(55,138,221,.45)}
        .lp .ind-card.hospi .ic-ico{background:linear-gradient(135deg,#F5C4B3,#993C1D);box-shadow:0 4px 16px rgba(216,90,48,.45)}
        .lp .ind-card.trans .ic-ico{background:linear-gradient(135deg,#F4C0D1,#72243E);box-shadow:0 4px 16px rgba(212,83,126,.45)}
        .lp .ind-card.finance .ic-ico{background:linear-gradient(135deg,#B5D4F4,#042C53);box-shadow:0 4px 16px rgba(24,95,165,.45)}

        .lp .ic-badge{font-size:10px;font-weight:500;padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.08);border:.5px solid rgba(255,255,255,.15);color:#fff;display:inline-flex;align-items:center;gap:5px;letter-spacing:.04em}
        .lp .ic-badge::before{content:"";width:5px;height:5px;border-radius:50%;background:#5DCAA5;box-shadow:0 0 6px #1D9E75;animation:pulse 2s infinite}
        .lp .ic-badge.hot{background:rgba(239,159,39,.2);border-color:rgba(239,159,39,.4);color:#FAC775}.lp .ic-badge.hot::before{background:#EF9F27;box-shadow:0 0 6px #EF9F27}
        .lp .ic-badge.new{background:rgba(212,83,126,.2);border-color:rgba(212,83,126,.4);color:#F4C0D1}.lp .ic-badge.new::before{background:#D4537E;box-shadow:0 0 6px #D4537E}
        .lp .ic-badge.soon{background:rgba(127,119,221,.2);border-color:rgba(127,119,221,.4);color:#CECBF6}.lp .ic-badge.soon::before{background:#7F77DD;box-shadow:0 0 6px #7F77DD}

        .lp .ic-photo{position:relative;margin:-22px -22px 0 -22px;height:140px;overflow:hidden;border-top-left-radius:18px;border-top-right-radius:18px}
        .lp .ic-photo img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
        .lp .ind-card:hover .ic-photo img{transform:scale(1.08)}
        .lp .ic-photo::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(5,6,12,.85) 100%);pointer-events:none}
        .lp .ic-photo-top{position:absolute;top:14px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:flex-start;z-index:2}

        .lp .ic-title{font-size:18px;font-weight:500;color:#fff;letter-spacing:-.01em}
        .lp .ic-desc{font-size:12.5px;color:rgba(255,255,255,.7);line-height:1.55;flex:1}

        .lp .ic-agents{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,.04);border:.5px solid rgba(255,255,255,.08);border-radius:10px}
        .lp .ic-avs{display:flex;align-items:center}
        .lp .ic-av{width:24px;height:24px;border-radius:50%;border:2px solid #05060C;margin-left:-8px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0}
        .lp .ic-av:first-child{margin-left:0}
        .lp .ic-av svg{width:10px;height:10px}
        .lp .ic-av.g1{background:linear-gradient(135deg,#7F77DD,#534AB7)}
        .lp .ic-av.g2{background:linear-gradient(135deg,#D4537E,#993556)}
        .lp .ic-av.g3{background:linear-gradient(135deg,#EF9F27,#BA7517)}
        .lp .ic-av.g4{background:linear-gradient(135deg,#1D9E75,#0F6E56)}
        .lp .ic-more{margin-left:-8px;width:24px;height:24px;border-radius:50%;border:2px solid #05060C;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:500}
        .lp .ic-count{font-size:11px;color:rgba(255,255,255,.75);font-weight:500;margin-left:auto;white-space:nowrap}

        .lp .ic-install{display:flex;justify-content:space-between;align-items:center;padding-top:4px}
        .lp .ic-price{display:flex;flex-direction:column;gap:2px}
        .lp .ic-price .main{font-size:14px;font-weight:500;color:#fff}
        .lp .ic-price .sub{font-size:10px;color:rgba(255,255,255,.6)}
        .lp .ic-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:500;background:rgba(255,255,255,.1);border:.5px solid rgba(255,255,255,.2);color:#fff;cursor:pointer;transition:all .2s;text-decoration:none}
        .lp .ind-card:hover .ic-btn{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.35)}

        .lp .see-all{display:inline-flex;align-items:center;gap:10px;padding:14px 30px;border-radius:12px;font-size:14px;font-weight:500;color:#fff;background:linear-gradient(135deg,#EF9F27,#D4537E);box-shadow:0 6px 24px rgba(239,159,39,.4);border:none;cursor:pointer;transition:all .3s;position:relative;overflow:hidden;text-decoration:none}
        .lp .see-all::after{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent);animation:ctaShine 3s infinite}
        .lp .see-all:hover{transform:translateY(-2px);box-shadow:0 10px 32px rgba(239,159,39,.55)}

        @media(max-width:1100px){.lp .market-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:700px){.lp .market-grid{grid-template-columns:1fr}.lp .market-roulette{min-width:100% !important;display:block}}

        /* ── MARKETPLACE TITLE ROULETTE (5 words) ─────────────────── */
        .lp .market-roulette{display:inline-block;position:relative;min-width:440px;vertical-align:baseline;text-align:left;height:1.05em}
        .lp .market-roulette-ph{visibility:hidden}
        .lp .market-roulette-word{position:absolute;left:0;top:0;white-space:nowrap;opacity:0;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;background-size:200% 200%}
        .lp .market-roulette-word.mw1{background-image:linear-gradient(135deg,#FAC775 0%,#EF9F27 50%,#D85A30 100%);animation:mrw1 15s infinite,shine 4s infinite linear}
        .lp .market-roulette-word.mw2{background-image:linear-gradient(135deg,#F09595 0%,#E24B4A 50%,#D4537E 100%);animation:mrw2 15s infinite,shine 4s infinite linear}
        .lp .market-roulette-word.mw3{background-image:linear-gradient(135deg,#5DCAA5 0%,#1D9E75 50%,#0F6E56 100%);animation:mrw3 15s infinite,shine 4s infinite linear}
        .lp .market-roulette-word.mw4{background-image:linear-gradient(135deg,#FAC775 0%,#BA7517 50%,#854F0B 100%);animation:mrw4 15s infinite,shine 4s infinite linear}
        .lp .market-roulette-word.mw5{background-image:linear-gradient(135deg,#AFA9EC 0%,#7F77DD 50%,#534AB7 100%);animation:mrw5 15s infinite,shine 4s infinite linear}
        @keyframes mrw1{0%,2%,20%,100%{opacity:0;transform:translateY(30px)}4%,17%{opacity:1;transform:translateY(0)}19%{opacity:0;transform:translateY(-30px)}}
        @keyframes mrw2{0%,20%,22%,40%,100%{opacity:0;transform:translateY(30px)}24%,37%{opacity:1;transform:translateY(0)}39%{opacity:0;transform:translateY(-30px)}}
        @keyframes mrw3{0%,40%,42%,60%,100%{opacity:0;transform:translateY(30px)}44%,57%{opacity:1;transform:translateY(0)}59%{opacity:0;transform:translateY(-30px)}}
        @keyframes mrw4{0%,60%,62%,80%,100%{opacity:0;transform:translateY(30px)}64%,77%{opacity:1;transform:translateY(0)}79%{opacity:0;transform:translateY(-30px)}}
        @keyframes mrw5{0%,80%,82%,100%{opacity:0;transform:translateY(30px)}84%,97%{opacity:1;transform:translateY(0)}99%{opacity:0;transform:translateY(-30px)}}

        /* ── BRAIN SECTION (stats cards + 2D brain scene) ─────────── */
        .lp .bs-stats{position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:50px 40px 30px;max-width:1200px;margin:0 auto}
        .lp .bs-stat{position:relative;text-align:center;padding:28px 20px;border-radius:22px;background:rgba(255,255,255,.025);border:.5px solid rgba(255,255,255,.08);overflow:hidden;transition:all .3s;cursor:pointer}
        .lp .bs-stat:hover{transform:translateY(-4px);background:rgba(255,255,255,.045);border-color:rgba(255,255,255,.2)}
        .lp .bs-stat::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:100px;height:2px;border-radius:2px}
        .lp .bs-stat.s1::before{background:linear-gradient(90deg,transparent,#7F77DD,transparent);box-shadow:0 0 12px #7F77DD}
        .lp .bs-stat.s2::before{background:linear-gradient(90deg,transparent,#EF9F27,transparent);box-shadow:0 0 12px #EF9F27}
        .lp .bs-stat.s3::before{background:linear-gradient(90deg,transparent,#1D9E75,transparent);box-shadow:0 0 12px #1D9E75}
        .lp .bs-stat.s4::before{background:linear-gradient(90deg,transparent,#D4537E,transparent);box-shadow:0 0 12px #D4537E}
        .lp .bs-stat-num{font-size:56px;font-weight:500;letter-spacing:-.04em;line-height:1;margin-bottom:12px;font-variant-numeric:tabular-nums}
        .lp .bs-stat-num.c1{background:linear-gradient(135deg,#fff 0%,#CECBF6 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
        .lp .bs-stat-num.c2{background:linear-gradient(135deg,#FAC775 0%,#EF9F27 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
        .lp .bs-stat-num.c3{background:linear-gradient(135deg,#C0DD97 0%,#1D9E75 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
        .lp .bs-stat-num.c4{background:linear-gradient(135deg,#F4C0D1 0%,#D4537E 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
        .lp .bs-stat-label{font-size:13px;color:rgba(255,255,255,.65);font-weight:500}
        .lp .bs-stat-icon{position:absolute;top:18px;right:18px;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;opacity:.85}
        .lp .bs-stat.s1 .bs-stat-icon{background:rgba(127,119,221,.25);color:#CECBF6}
        .lp .bs-stat.s2 .bs-stat-icon{background:rgba(239,159,39,.25);color:#FAC775}
        .lp .bs-stat.s3 .bs-stat-icon{background:rgba(29,158,117,.25);color:#5DCAA5}
        .lp .bs-stat.s4 .bs-stat-icon{background:rgba(212,83,126,.25);color:#F4C0D1}

        .lp .bs-divider{position:relative;z-index:1;height:80px;display:flex;align-items:center;justify-content:center}
        .lp .bs-divider::before{content:"";position:absolute;left:20%;right:20%;height:.5px;background:linear-gradient(90deg,transparent,rgba(127,119,221,.4),rgba(212,83,126,.4),rgba(239,159,39,.3),transparent)}
        .lp .bs-divider-dot{position:relative;z-index:1;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 20px #D4537E,0 0 40px rgba(127,119,221,.5);animation:dividerPulse 3s ease-in-out infinite}
        @keyframes dividerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.5)}}

        .lp .bs-eyebrow{display:inline-flex;align-items:center;gap:10px;padding:8px 18px;border-radius:999px;background:linear-gradient(135deg,rgba(212,83,126,.18),rgba(127,119,221,.12));border:.5px solid rgba(212,83,126,.4);font-size:12px;color:#fff;font-weight:500;letter-spacing:.12em;text-transform:uppercase;backdrop-filter:blur(10px)}
        .lp .bs-brain-ico{position:relative;width:18px;height:18px}
        .lp .bs-brain-ico::before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 35%,#F4C0D1 0%,#D4537E 100%);box-shadow:0 0 8px #D4537E;animation:pulse 1.5s infinite}

        .lp .bs-title{font-size:clamp(40px,5vw,64px);font-weight:500;margin:0;letter-spacing:-.03em;line-height:1.1;max-width:1100px;background:linear-gradient(135deg,#fff 0%,#CECBF6 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-family:'Bricolage Grotesque',sans-serif}
        .lp .bs-roulette{display:inline-block;position:relative;min-width:280px;vertical-align:baseline;text-align:center;height:1.1em}
        .lp .bs-roulette-ph{visibility:hidden}
        .lp .bs-roulette-word{position:absolute;left:0;right:0;top:0;white-space:nowrap;opacity:0;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;background-size:200% 200%}
        .lp .bs-roulette-word.bw1{background-image:linear-gradient(135deg,#FAC775 0%,#EF9F27 50%,#D4537E 100%);animation:bw1 12s infinite,shine 4s infinite linear}
        .lp .bs-roulette-word.bw2{background-image:linear-gradient(135deg,#AFA9EC 0%,#7F77DD 50%,#D4537E 100%);animation:bw2 12s infinite,shine 4s infinite linear}
        .lp .bs-roulette-word.bw3{background-image:linear-gradient(135deg,#5DCAA5 0%,#1D9E75 50%,#7F77DD 100%);animation:bw3 12s infinite,shine 4s infinite linear}
        .lp .bs-roulette-word.bw4{background-image:linear-gradient(135deg,#F4C0D1 0%,#D4537E 50%,#FAC775 100%);animation:bw4 12s infinite,shine 4s infinite linear}
        @keyframes bw1{0%,2%,25%,100%{opacity:0;transform:translateY(30px)}4%,21%{opacity:1;transform:translateY(0)}23%{opacity:0;transform:translateY(-30px)}}
        @keyframes bw2{0%,25%,27%,50%,100%{opacity:0;transform:translateY(30px)}29%,46%{opacity:1;transform:translateY(0)}48%{opacity:0;transform:translateY(-30px)}}
        @keyframes bw3{0%,50%,52%,75%,100%{opacity:0;transform:translateY(30px)}54%,71%{opacity:1;transform:translateY(0)}73%{opacity:0;transform:translateY(-30px)}}
        @keyframes bw4{0%,75%,77%,100%{opacity:0;transform:translateY(30px)}79%,96%{opacity:1;transform:translateY(0)}98%{opacity:0;transform:translateY(-30px)}}

        .lp .bs-sub{font-size:17px;color:rgba(255,255,255,.7);max-width:720px;line-height:1.6;font-weight:400}

        .lp .bs-scene{position:relative;width:100%;max-width:900px;height:480px;margin:30px auto 0;display:flex;align-items:center;justify-content:center}
        .lp .bs-core{position:relative;width:200px;height:200px;z-index:3}
        .lp .bs-sphere{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 25%,#F4C0D1 0%,#D4537E 30%,#7F77DD 65%,#26215C 100%);box-shadow:0 0 60px rgba(212,83,126,.7),0 0 120px rgba(127,119,221,.4),inset -18px -22px 45px rgba(0,0,0,.5);animation:brainGlow 3.5s ease-in-out infinite}
        @keyframes brainGlow{0%,100%{box-shadow:0 0 60px rgba(212,83,126,.7),0 0 120px rgba(127,119,221,.4),inset -18px -22px 45px rgba(0,0,0,.5)}50%{box-shadow:0 0 80px rgba(239,159,39,.6),0 0 150px rgba(127,119,221,.6),inset -18px -22px 45px rgba(0,0,0,.5)}}
        .lp .bs-core-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.6);z-index:2}
        .lp .bs-core-text .ic{width:38px;height:38px;margin-bottom:6px;animation:brainPulse 2s ease-in-out infinite}
        @keyframes brainPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
        .lp .bs-core-text .t1{font-size:14px;font-weight:500}
        .lp .bs-core-text .t2{font-size:10px;letter-spacing:.2em;opacity:.85;text-transform:uppercase;margin-top:3px}

        .lp .bs-pulse-wave{position:absolute;top:50%;left:50%;width:200px;height:200px;border-radius:50%;border:1.5px solid rgba(212,83,126,.5);transform:translate(-50%,-50%);animation:pulseWave 3s ease-out infinite;z-index:1}
        .lp .bs-pulse-wave.pw2{animation-delay:1s;border-color:rgba(127,119,221,.4)}
        .lp .bs-pulse-wave.pw3{animation-delay:2s;border-color:rgba(239,159,39,.35)}
        @keyframes pulseWave{0%{transform:translate(-50%,-50%) scale(1);opacity:.9}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}

        .lp .bs-orbit-line{position:absolute;top:50%;left:50%;border-radius:50%;border:.5px dashed rgba(255,255,255,.1);transform:translate(-50%,-50%);z-index:0}
        .lp .bs-orbit-line.ol1{width:360px;height:360px;animation:olSpin 40s linear infinite}
        .lp .bs-orbit-line.ol2{width:520px;height:520px;animation:olSpin 60s linear infinite reverse}
        @keyframes olSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}

        .lp .bs-node{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2;animation:nodeFloat 6s ease-in-out infinite}
        .lp .bs-node .bubble{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;position:relative;backdrop-filter:blur(8px)}
        .lp .bs-node .bubble svg{width:24px;height:24px}
        .lp .bs-node .bubble::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid rgba(255,255,255,.15);animation:nodeRing 2.5s ease-out infinite}
        .lp .bs-node .lbl{font-size:11px;color:#fff;font-weight:500;padding:3px 9px;border-radius:999px;background:rgba(5,6,12,.75);border:.5px solid rgba(255,255,255,.2);white-space:nowrap;backdrop-filter:blur(8px)}
        @keyframes nodeRing{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.6);opacity:0}}
        @keyframes nodeFloat{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-50%,calc(-50% - 6px))}}
        .lp .bs-node.n1{margin-left:-340px;margin-top:-120px;animation-delay:0s}
        .lp .bs-node.n1 .bubble{background:linear-gradient(135deg,#7F77DD,#534AB7);box-shadow:0 0 16px rgba(127,119,221,.5)}
        .lp .bs-node.n2{margin-left:240px;margin-top:-160px;animation-delay:1s}
        .lp .bs-node.n2 .bubble{background:linear-gradient(135deg,#EF9F27,#BA7517);box-shadow:0 0 16px rgba(239,159,39,.5)}
        .lp .bs-node.n3{margin-left:-200px;margin-top:170px;animation-delay:2s}
        .lp .bs-node.n3 .bubble{background:linear-gradient(135deg,#1D9E75,#0F6E56);box-shadow:0 0 16px rgba(29,158,117,.5)}
        .lp .bs-node.n4{margin-left:280px;margin-top:130px;animation-delay:3s}
        .lp .bs-node.n4 .bubble{background:linear-gradient(135deg,#D4537E,#993556);box-shadow:0 0 16px rgba(212,83,126,.5)}
        .lp .bs-node.n5{margin-left:360px;margin-top:-20px;animation-delay:1.5s}
        .lp .bs-node.n5 .bubble{background:linear-gradient(135deg,#5DCAA5,#1D9E75);box-shadow:0 0 16px rgba(29,158,117,.5)}
        .lp .bs-node.n6{margin-left:-370px;margin-top:30px;animation-delay:2.5s}
        .lp .bs-node.n6 .bubble{background:linear-gradient(135deg,#378ADD,#185FA5);box-shadow:0 0 16px rgba(55,138,221,.5)}
        .lp .bs-node.n7{margin-left:60px;margin-top:-210px;animation-delay:.5s}
        .lp .bs-node.n7 .bubble{background:linear-gradient(135deg,#AFA9EC,#7F77DD);box-shadow:0 0 16px rgba(127,119,221,.5)}
        .lp .bs-node.n8{margin-left:-40px;margin-top:210px;animation-delay:3.5s}
        .lp .bs-node.n8 .bubble{background:linear-gradient(135deg,#F4C0D1,#D4537E);box-shadow:0 0 16px rgba(212,83,126,.5)}

        @media(max-width:1100px){.lp .bs-stats{grid-template-columns:repeat(2,1fr)}.lp .bs-node{display:none}.lp .bs-node.n1,.lp .bs-node.n2,.lp .bs-node.n3,.lp .bs-node.n4{display:flex}.lp .bs-node.n1{margin-left:-180px;margin-top:-100px}.lp .bs-node.n2{margin-left:180px;margin-top:-100px}.lp .bs-node.n3{margin-left:-180px;margin-top:100px}.lp .bs-node.n4{margin-left:180px;margin-top:100px}}
        @media(max-width:700px){.lp .bs-stats{grid-template-columns:1fr 1fr;gap:8px;padding:30px 20px}.lp .bs-stat-num{font-size:40px}.lp .bs-scene{transform:scale(.7);height:380px}}

        /* ── FINAL CTA + NEWSLETTER + FOOTER ──────────────────────── */
        .lp .cf-cta-section{position:relative;z-index:2;padding:80px 40px 100px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:30px;max-width:1200px;margin:0 auto}
        .lp .cf-brain-glow{position:relative;width:100px;height:100px}
        .lp .cf-brain-orb{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 25%,#F4C0D1 0%,#D4537E 30%,#7F77DD 65%,#26215C 100%);box-shadow:0 0 50px rgba(212,83,126,.7),0 0 100px rgba(127,119,221,.4),inset -12px -16px 30px rgba(0,0,0,.5);animation:cfBrainGlow 3.5s ease-in-out infinite}
        @keyframes cfBrainGlow{0%,100%{box-shadow:0 0 50px rgba(212,83,126,.7),0 0 100px rgba(127,119,221,.4),inset -12px -16px 30px rgba(0,0,0,.5);transform:scale(1)}50%{box-shadow:0 0 70px rgba(239,159,39,.6),0 0 130px rgba(127,119,221,.6),inset -12px -16px 30px rgba(0,0,0,.5);transform:scale(1.05)}}
        .lp .cf-brain-icon{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2}
        .lp .cf-brain-icon svg{width:38px;height:38px;color:#fff;filter:drop-shadow(0 1px 4px rgba(0,0,0,.5));animation:brainPulse 2s ease-in-out infinite}
        .lp .cf-brain-rings{position:absolute;top:50%;left:50%;width:100px;height:100px;border-radius:50%;border:1.5px solid rgba(212,83,126,.4);transform:translate(-50%,-50%);animation:cfBrainRing 3s ease-out infinite;z-index:0}
        .lp .cf-brain-rings.r2{animation-delay:1s;border-color:rgba(127,119,221,.4)}
        .lp .cf-brain-rings.r3{animation-delay:2s;border-color:rgba(239,159,39,.4)}
        @keyframes cfBrainRing{0%{transform:translate(-50%,-50%) scale(1);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}

        .lp .cf-eyebrow{display:inline-flex;align-items:center;gap:10px;padding:8px 22px;border-radius:999px;background:linear-gradient(135deg,rgba(127,119,221,.18),rgba(212,83,126,.12));border:.5px solid rgba(127,119,221,.4);font-size:11px;color:#fff;font-weight:500;letter-spacing:.18em;text-transform:uppercase;backdrop-filter:blur(10px)}
        .lp .cf-eyebrow-dot{width:6px;height:6px;border-radius:50%;background:#5DCAA5;box-shadow:0 0 8px #1D9E75;animation:pulse 1.5s infinite}

        .lp .cf-title{font-size:clamp(44px,6vw,72px);font-weight:500;margin:0;letter-spacing:-.03em;line-height:1.05;max-width:1100px;font-family:'Bricolage Grotesque',sans-serif}
        .lp .cf-title .line1{display:block;color:#fff}
        .lp .cf-title .line2{display:block;background:linear-gradient(135deg,#AFA9EC 0%,#D4537E 50%,#F4C0D1 100%);background-size:200% 200%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:cfTitleShine 5s infinite linear}
        @keyframes cfTitleShine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        .lp .cf-title .bounce{display:inline-block;animation:cfBounce 1.5s ease-in-out infinite}
        @keyframes cfBounce{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-12px) rotate(-5deg)}}

        .lp .cf-sub{font-size:18px;color:rgba(255,255,255,.78);max-width:760px;line-height:1.6;font-weight:400}
        .lp .cf-sub .highlight{background:linear-gradient(135deg,#FAC775,#F4C0D1);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:500}

        .lp .cf-cta-row{display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center;margin-top:16px}
        .lp .cf-cta-primary{display:inline-flex;align-items:center;gap:12px;padding:18px 36px;border-radius:14px;font-size:16px;font-weight:500;background:linear-gradient(135deg,#7F77DD,#D4537E,#EF9F27);background-size:200% 200%;color:#fff;border:none;cursor:pointer;box-shadow:0 10px 40px rgba(127,119,221,.5),0 4px 12px rgba(212,83,126,.3);position:relative;overflow:hidden;transition:all .3s;animation:gradientMove 5s infinite linear;text-decoration:none}
        .lp .cf-cta-primary::after{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);animation:ctaShine 3s infinite}
        .lp .cf-cta-primary:hover{transform:translateY(-3px);box-shadow:0 16px 50px rgba(127,119,221,.7),0 8px 20px rgba(212,83,126,.4)}
        .lp .cf-cta-primary .spark{animation:sparkle 2s ease-in-out infinite}
        .lp .cf-cta-ghost{display:inline-flex;align-items:center;gap:10px;padding:18px 26px;border-radius:14px;font-size:15px;font-weight:500;background:rgba(255,255,255,.06);border:.5px solid rgba(255,255,255,.2);color:#fff;cursor:pointer;backdrop-filter:blur(10px);transition:all .25s;text-decoration:none}
        .lp .cf-cta-ghost:hover{background:rgba(255,255,255,.12);transform:translateY(-2px);border-color:rgba(255,255,255,.4)}

        .lp .cf-trust{display:flex;gap:28px;flex-wrap:wrap;justify-content:center;margin-top:16px}
        .lp .cf-trust-item{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.72);font-weight:500}
        .lp .cf-trust-ico{width:18px;height:18px;border-radius:50%;background:rgba(29,158,117,.2);color:#5DCAA5;display:flex;align-items:center;justify-content:center}
        .lp .cf-trust-ico svg{width:10px;height:10px}

        .lp .cf-newsletter{position:relative;z-index:2;padding:0 40px 80px;max-width:1200px;margin:0 auto}
        .lp .cf-newsletter-card{padding:36px 40px;border-radius:22px;background:linear-gradient(135deg,rgba(127,119,221,.08),rgba(212,83,126,.05));border:.5px solid rgba(127,119,221,.25);display:grid;grid-template-columns:1fr 1.2fr;gap:40px;align-items:center;backdrop-filter:blur(10px)}
        .lp .cf-newsletter-card h3{font-size:22px;font-weight:500;color:#fff;margin:0 0 10px;letter-spacing:-.01em;line-height:1.25}
        .lp .cf-newsletter-card p{font-size:13px;color:rgba(255,255,255,.65);margin:0;line-height:1.55}
        .lp .cf-newsletter-form{display:flex;gap:8px}
        .lp .cf-newsletter-input{flex:1;padding:14px 18px;background:rgba(255,255,255,.05);border:.5px solid rgba(255,255,255,.15);border-radius:12px;color:#fff;font-size:14px;font-family:inherit;outline:none;transition:all .2s}
        .lp .cf-newsletter-input::placeholder{color:rgba(255,255,255,.45)}
        .lp .cf-newsletter-input:focus{border-color:rgba(127,119,221,.5);background:rgba(255,255,255,.08)}
        .lp .cf-newsletter-btn{padding:14px 22px;border-radius:12px;background:linear-gradient(135deg,#7F77DD,#D4537E);color:#fff;font-size:14px;font-weight:500;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 16px rgba(127,119,221,.4);transition:all .2s}
        .lp .cf-newsletter-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(127,119,221,.55)}

        .lp .cf-footer{position:relative;z-index:2;padding:50px 40px 30px;border-top:.5px solid rgba(255,255,255,.08);background:rgba(5,6,12,.5);backdrop-filter:blur(10px);max-width:1400px;margin:0 auto}
        .lp .cf-footer-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:50px;max-width:1200px;margin:0 auto}
        .lp .cf-footer-brand-block{display:flex;flex-direction:column;gap:18px}
        .lp .cf-footer-brand{display:flex;align-items:center;gap:12px}
        .lp .cf-footer-logo{width:38px;height:38px;border-radius:11px;position:relative;overflow:hidden;background:conic-gradient(from 0deg,#7F77DD,#D4537E,#EF9F27,#1D9E75,#7F77DD);animation:logoRot 10s linear infinite}
        .lp .cf-footer-logo::after{content:"";position:absolute;inset:3px;border-radius:8px;background:#05060C}
        .lp .cf-footer-logo::before{content:"";position:absolute;inset:10px;border-radius:4px;background:conic-gradient(from 180deg,#7F77DD,#D4537E,#EF9F27,#1D9E75,#7F77DD);z-index:1;animation:logoRot 6s linear infinite reverse}
        .lp .cf-footer-brand-text{display:flex;flex-direction:column;gap:2px}
        .lp .cf-footer-brand-text .nm{font-size:17px;font-weight:500;color:#fff}
        .lp .cf-footer-brand-text .by{font-size:11px;color:rgba(255,255,255,.55)}
        .lp .cf-footer-desc{font-size:12.5px;color:rgba(255,255,255,.6);line-height:1.6;max-width:320px}
        .lp .cf-footer-socials{display:flex;gap:8px;flex-wrap:wrap}
        .lp .cf-footer-social{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);border:.5px solid rgba(255,255,255,.1);color:rgba(255,255,255,.7);cursor:pointer;transition:all .2s;text-decoration:none}
        .lp .cf-footer-social:hover{transform:translateY(-2px)}
        .lp .cf-footer-social svg{width:15px;height:15px}

        .lp .cf-footer-col-title{font-size:11px;color:rgba(255,255,255,.5);font-weight:500;letter-spacing:.12em;text-transform:uppercase;margin-bottom:18px}
        .lp .cf-footer-links{display:flex;flex-direction:column;gap:12px}
        .lp .cf-footer-link{font-size:13px;color:rgba(255,255,255,.78);text-decoration:none;transition:color .2s;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
        .lp .cf-footer-link:hover{color:#fff}
        .lp .cf-footer-link-badge{font-size:9px;padding:2px 7px;border-radius:999px;font-weight:500}
        .lp .cf-footer-link-badge.purple{background:rgba(127,119,221,.18);color:#CECBF6;border:.5px solid rgba(127,119,221,.35)}

        .lp .cf-footer-bottom{margin-top:40px;padding-top:24px;border-top:.5px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:18px;max-width:1200px;margin-left:auto;margin-right:auto}
        .lp .cf-copyright{font-size:12px;color:rgba(255,255,255,.55);display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
        .lp .cf-copyright strong{color:rgba(255,255,255,.85);font-weight:500}
        .lp .cf-copyright .ci-flag{display:inline-flex;align-items:center;margin:0 2px}
        .lp .cf-copyright .ci-flag svg{width:14px;height:10px}

        .lp .cf-status-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(29,158,117,.12);border:.5px solid rgba(29,158,117,.3);font-size:11.5px;color:#5DCAA5;font-weight:500;cursor:pointer}
        .lp .cf-status-pill::before{content:"";width:6px;height:6px;border-radius:50%;background:#5DCAA5;box-shadow:0 0 8px #1D9E75;animation:pulse 1.5s infinite}

        .lp .cf-footer-meta{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-top:18px;padding-top:18px;border-top:.5px solid rgba(255,255,255,.06);max-width:1200px;margin-left:auto;margin-right:auto}
        .lp .cf-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,.04);border:.5px solid rgba(255,255,255,.1);font-size:11px;color:rgba(255,255,255,.7);font-weight:500}
        .lp .cf-badge svg{width:12px;height:12px}
        .lp .cf-badge.green{color:#5DCAA5;border-color:rgba(29,158,117,.3);background:rgba(29,158,117,.08)}
        .lp .cf-badge.amber{color:#FAC775;border-color:rgba(239,159,39,.3);background:rgba(239,159,39,.08)}
        .lp .cf-meta-links{display:flex;gap:18px;margin-left:auto;flex-wrap:wrap}
        .lp .cf-meta-link{font-size:11.5px;color:rgba(255,255,255,.55);text-decoration:none;cursor:pointer;transition:color .2s}
        .lp .cf-meta-link:hover{color:#fff}

        /* ── CONNECTORS — USE-CASE SCENARIOS (Option C) ──────────── */
        .lp .cn-eyebrow{display:inline-flex;align-items:center;gap:10px;padding:8px 22px;border-radius:999px;background:linear-gradient(135deg,rgba(127,119,221,.18),rgba(212,83,126,.1));border:.5px solid rgba(127,119,221,.4);font-size:12px;color:#fff;font-weight:500;letter-spacing:.18em;text-transform:uppercase;backdrop-filter:blur(10px);margin-bottom:18px}
        .lp .cn-eyebrow svg{width:14px;height:14px;color:#CECBF6}
        .lp .cn-eyebrow .count{background:linear-gradient(135deg,#AFA9EC,#D4537E);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:500;margin-left:6px;letter-spacing:.02em;text-transform:none}

        .lp .optc-grid{position:relative;z-index:2;padding:30px 0 0;max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .lp .optc-card{position:relative;padding:26px 24px;border-radius:20px;background:rgba(255,255,255,.025);border:.5px solid rgba(255,255,255,.1);transition:all .3s;cursor:pointer;overflow:hidden;text-align:left}
        .lp .optc-card::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;opacity:.9}
        .lp .optc-card:hover{transform:translateY(-5px);background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.25)}
        .lp .optc-card.purple::before{background:linear-gradient(90deg,#AFA9EC,#7F77DD);box-shadow:0 0 14px #7F77DD}
        .lp .optc-card.amber::before{background:linear-gradient(90deg,#FAC775,#EF9F27);box-shadow:0 0 14px #EF9F27}
        .lp .optc-card.green::before{background:linear-gradient(90deg,#5DCAA5,#1D9E75);box-shadow:0 0 14px #1D9E75}
        .lp .optc-card.pink::before{background:linear-gradient(90deg,#F4C0D1,#D4537E);box-shadow:0 0 14px #D4537E}
        .lp .optc-card.blue::before{background:linear-gradient(90deg,#85B7EB,#378ADD);box-shadow:0 0 14px #378ADD}
        .lp .optc-card.coral::before{background:linear-gradient(90deg,#F5C4B3,#D85A30);box-shadow:0 0 14px #D85A30}

        .lp .optc-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px}
        .lp .optc-card.purple .optc-tag{background:rgba(127,119,221,.18);color:#CECBF6;border:.5px solid rgba(127,119,221,.35)}
        .lp .optc-card.amber .optc-tag{background:rgba(239,159,39,.18);color:#FAC775;border:.5px solid rgba(239,159,39,.35)}
        .lp .optc-card.green .optc-tag{background:rgba(29,158,117,.18);color:#5DCAA5;border:.5px solid rgba(29,158,117,.35)}
        .lp .optc-card.pink .optc-tag{background:rgba(212,83,126,.18);color:#F4C0D1;border:.5px solid rgba(212,83,126,.35)}
        .lp .optc-card.blue .optc-tag{background:rgba(55,138,221,.18);color:#85B7EB;border:.5px solid rgba(55,138,221,.35)}
        .lp .optc-card.coral .optc-tag{background:rgba(216,90,48,.18);color:#F5C4B3;border:.5px solid rgba(216,90,48,.35)}

        .lp .optc-title{font-size:18px;font-weight:500;color:#fff;margin-bottom:10px;letter-spacing:-.01em}
        .lp .optc-desc{font-size:13px;color:rgba(255,255,255,.7);line-height:1.55;margin-bottom:18px;min-height:58px}
        .lp .optc-flow{display:flex;align-items:center;gap:0;padding:12px 14px;background:rgba(255,255,255,.04);border:.5px solid rgba(255,255,255,.08);border-radius:12px;flex-wrap:wrap}
        .lp .optc-flow-step{display:flex;align-items:center;gap:8px;flex-shrink:0}
        .lp .optc-flow-logo{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#fff;flex-shrink:0}
        .lp .optc-flow-name{font-size:11px;color:rgba(255,255,255,.85);font-weight:500}
        .lp .optc-flow-arrow{margin:0 8px;color:rgba(255,255,255,.35);flex-shrink:0;display:flex;align-items:center}
        .lp .optc-flow-arrow svg{width:14px;height:14px}

        .lp .optc-orlode-bubble{width:32px;height:32px;border-radius:9px;background:conic-gradient(from 0deg,#7F77DD,#D4537E,#EF9F27,#1D9E75,#7F77DD);position:relative;overflow:hidden;flex-shrink:0;animation:logoRot 8s linear infinite}
        .lp .optc-orlode-bubble::after{content:"";position:absolute;inset:3px;border-radius:6px;background:#0A0B14}
        .lp .optc-orlode-bubble::before{content:"";position:absolute;inset:8px;border-radius:3px;background:conic-gradient(from 180deg,#7F77DD,#D4537E,#EF9F27,#1D9E75,#7F77DD);z-index:1;animation:logoRot 5s linear infinite reverse}

        .lp .optc-bottom{margin-top:16px;display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:.5px solid rgba(255,255,255,.08)}
        .lp .optc-link{font-size:12px;color:rgba(255,255,255,.7);font-weight:500;display:inline-flex;align-items:center;gap:4px;transition:color .2s;cursor:pointer;text-decoration:none}
        .lp .optc-link:hover{color:#fff}
        .lp .optc-link svg{width:12px;height:12px;transition:transform .2s}
        .lp .optc-link:hover svg{transform:translateX(2px)}
        .lp .optc-time{font-size:11px;color:rgba(255,255,255,.55);display:inline-flex;align-items:center;gap:4px}
        .lp .optc-time::before{content:"";width:5px;height:5px;border-radius:50%;background:#5DCAA5;box-shadow:0 0 6px #1D9E75;animation:pulse 2s infinite}

        /* Brand-colored logo squares */
        .lp .lg-whatsapp{background:#25D366;color:#fff}
        .lp .lg-slack{background:linear-gradient(135deg,#4A154B,#ECB22E);color:#fff}
        .lp .lg-gmail{background:#EA4335;color:#fff}
        .lp .lg-stripe{background:#635BFF;color:#fff}
        .lp .lg-shopify{background:#95BF47;color:#fff}
        .lp .lg-notion{background:#fff;color:#000}
        .lp .lg-jira{background:#0052CC;color:#fff}
        .lp .lg-meta{background:#1877F2;color:#fff}
        .lp .lg-tiktok{background:#000;color:#fff}
        .lp .lg-zapier{background:#FF4A00;color:#fff}
        .lp .lg-airtable{background:#FCB400;color:#fff}
        .lp .lg-hubspot{background:#FF7A59;color:#fff}
        .lp .lg-zoom{background:#2D8CFF;color:#fff}
        .lp .lg-discord{background:#5865F2;color:#fff}
        .lp .lg-telegram{background:linear-gradient(135deg,#2AABEE,#229ED9);color:#fff}
        .lp .lg-asana{background:#F06A6A;color:#fff}
        .lp .lg-mailchimp{background:#FFE01B;color:#000}

        @media(max-width:1100px){.lp .optc-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:700px){.lp .optc-grid{grid-template-columns:1fr;padding:20px 0 0}}

        @media(max-width:1000px){.lp .cf-footer-grid{grid-template-columns:1fr 1fr;gap:40px}.lp .cf-newsletter-card{grid-template-columns:1fr;gap:20px;padding:28px}}
        @media(max-width:700px){.lp .cf-cta-section{padding:50px 20px 60px}.lp .cf-newsletter{padding:0 20px 50px}.lp .cf-footer{padding:40px 20px 24px}.lp .cf-footer-grid{grid-template-columns:1fr;gap:36px}.lp .cf-newsletter-form{flex-direction:column}.lp .cf-cta-row{flex-direction:column;width:100%}.lp .cf-cta-primary,.lp .cf-cta-ghost{justify-content:center;width:100%}.lp .cf-meta-links{margin-left:0}}
      `}</style>

      <div className="lp">
        {/* ── NEW HERO with aurora + orbits + roulette ────────────── */}
        <div className="hero-root">
          {/* Aurora gradient blobs */}
          <div className="aurora">
            <span className="a3"></span>
            <span className="a4"></span>
          </div>

          {/* Twinkling stars */}
          <div className="stars">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={`star s${i}`}></div>)}
          </div>

          {/* Top welcome bar (only when logged in) */}
          {authUser && (
            <div className="topbar">
              <div className="topbar-text">
                Bienvenue <strong>{authUser.displayName || authUser.email?.split('@')[0] || 'à bord'}</strong> <span className="wave">👋</span>
              </div>
              <Link to="/dashboard" className="topbar-cta">Continuer vers le dashboard <span>→</span></Link>
            </div>
          )}

          {/* Navigation */}
          <nav className="nav2" style={navScrolled ? {background:'rgba(5,6,12,.85)',backdropFilter:'blur(20px)'} : undefined}>
            <a href="#" className="brand">
              <div className="logo2"></div>
              <span className="brand-name">Orlode</span>
            </a>
            <div className="nav2-links">
              <a href="#agents" className="nav2-link">{lp('Agents', 'Agents')}</a>
              <a href="#marketplace" className="nav2-link">{lp('Marketplace', 'Marketplace')}</a>
              <a href="#pricing" className="nav2-link">{lp('Plans', 'Plans')}</a>
              <Link to="/about" className="nav2-link">{lp('À propos', 'About')}</Link>
              <a href="#testimonials" className="nav2-link">{lp('Avis', 'Reviews')}</a>
            </div>
            {authUser ? (
              <Link to="/dashboard" className="nav2-cta">{lp('Mon espace', 'My space')}</Link>
            ) : (
              <Link to="/register" className="nav2-cta">{lp('Essai gratuit', 'Free trial')}</Link>
            )}
          </nav>

          {/* Hero section */}
          <section className="new-hero">
            {/* Orbital rings background */}
            <div className="orbit-bg">
              <div className="ring1"></div>
              <div className="ring2"></div>
              <div className="ring3"></div>
            </div>

            {/* Eyebrow chip */}
            <div className="eyebrow">
              <span className="dot"></span>
              <span className="accent">{lp('Équipe IA complète', 'Complete AI team')}</span>
              <span className="sep">+</span>
              <span>{lp("marketplace d'agents métier", 'industry agents marketplace')}</span>
            </div>

            {/* Title with roulette word */}
            <h1 className="new-hero-title">
              <span className="line1">{lp('Votre entreprise mérite', 'Your business deserves')}</span>
              <span className="line2">
                <span className="word-static">{lp('une ', 'a ')}</span>
                <span className="roulette">
                  <span className="roulette-ph">{lp('équipe IA complète', 'complete AI team')}</span>
                  <span className="roulette-word w1">{lp('équipe IA complète', 'complete AI team')}</span>
                  <span className="roulette-word w2">{lp('force de vente 24/7', '24/7 sales force')}</span>
                  <span className="roulette-word w3">{lp('réception intelligente', 'smart reception')}</span>
                  <span className="roulette-word w4">{lp('révolution numérique', 'digital revolution')}</span>
                </span>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="new-hero-sub">
              {lp('Une ', 'A ')}<strong>{lp("équipe d'agents IA", 'team of AI agents')}</strong>{lp(' + un marketplace d\'agents par industrie. L\'IA qui s\'adapte à ', ' + an industry agents marketplace. AI that adapts to ')}<span className="highlight">{lp('VOTRE entreprise', 'YOUR business')}</span>.
            </p>

            {/* CTAs */}
            <div className="cta-row">
              <Link to="/register" className="cta-primary">
                <span className="spark">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FAC775" stroke="#FAC775" strokeWidth="1" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </span>
                {lp('Démarrer gratuitement', 'Start for free')}
              </Link>
              <a href="#demo" className="cta-ghost">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="0"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                {lp('Voir la démo Orlode', 'Watch Orlode demo')}
              </a>
            </div>

            {/* Trust signals */}
            <div className="trust2">
              {[lp('Pas de carte bancaire', 'No credit card'), lp('Setup rapide', 'Fast setup'), lp('Plan Free disponible', 'Free plan available')].map(t => (
                <div key={t} className="trust-item">
                  <span className="trust-ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                  {t}
                </div>
              ))}
            </div>

            {/* Floating cards (4 corners) */}
            <div className="float-card fc1">
              <div className="ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div className="text">
                <span className="main-text">{lp('Conversations en direct', 'Live conversations')}</span>
                <span className="sub-text">{lp('avec vos clients', 'with your customers')}</span>
              </div>
            </div>

            <div className="float-card fc2">
              <div className="ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div className="text">
                <span className="main-text">{lp('Setup rapide', 'Fast setup')}</span>
                <span className="sub-text">{lp('zéro code', 'zero code')}</span>
              </div>
            </div>

            <div className="float-card fc3">
              <div className="ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="text">
                <span className="main-text">{lp('Agents prêts', 'Agents ready')}</span>
                <span className="sub-text">{lp('+ marketplace métier', '+ industry marketplace')}</span>
              </div>
            </div>

            <div className="float-card fc4">
              <div className="ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="text">
                <span className="main-text">{lp('Multi-tenant', 'Multi-tenant')}</span>
                <span className="sub-text">{lp('Multi-langue · Multi-devise', 'Multi-language · Multi-currency')}</span>
              </div>
            </div>
          </section>
        </div>
        {/* End hero-root */}

        {/* ── VIDEO 1 — Démo produit ─────────────────────────────── */}
        <section id="demo" style={{padding:'40px 0 80px'}}>
          <div style={{maxWidth:960,margin:'0 auto',padding:'0 32px'}} className="mob-px">
            <div className="lp-reveal video-slot">
              {c('video1Url', '') ? (
                <iframe src={toEmbedUrl(c('video1Url', ''))} style={{width:'100%',height:'100%',border:'none'}} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              ) : (
                <>
                  <div className="play"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
                  <p style={{position:'absolute',bottom:20,fontSize:14,color:'var(--g5)'}}>{c('video1Label', 'Démo Orlode AI — 3 min')}</p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF retiré (chiffres marketing non vérifiables) */}

        {/* ── BRAIN — Stats cards + 2D scene ──────────────────────── */}
        <section id="agents" style={{padding:'64px 0 32px',position:'relative'}}>
          {/* Stats cards (4 KPIs without real numbers) */}
          <div className="bs-stats lp-reveal">
            <div className="bs-stat s1">
              <div className="bs-stat-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
              </div>
              <div className="bs-stat-num c1">{lp('Agents', 'Agents')}</div>
              <div className="bs-stat-label">{lp('Intégrés à votre équipe', 'Integrated in your team')}</div>
            </div>
            <div className="bs-stat s2">
              <div className="bs-stat-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
              <div className="bs-stat-num c2">{lp('Métier', 'Industry')}</div>
              <div className="bs-stat-label">{lp('Marketplace par industrie', 'Industry marketplace')}</div>
            </div>
            <div className="bs-stat s3">
              <div className="bs-stat-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div className="bs-stat-num c3">{lp('Skills', 'Skills')}</div>
              <div className="bs-stat-label">{lp('Activables à la demande', 'On-demand activation')}</div>
            </div>
            <div className="bs-stat s4">
              <div className="bs-stat-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div className="bs-stat-num c4">24<span style={{opacity:.5}}>/</span>7</div>
              <div className="bs-stat-label">{lp('Toujours actif', 'Always on')}</div>
            </div>
          </div>

          <div className="bs-divider"><div className="bs-divider-dot"></div></div>

          <div style={{maxWidth:1200,margin:'0 auto',padding:'40px 32px 0',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:24}} className="mob-px">
            <div className="bs-eyebrow lp-reveal">
              <span className="bs-brain-ico"></span>
              {lp("Le cerveau de l'entreprise", 'The business brain')}
            </div>
            <h2 className="bs-title lp-reveal">
              {lp('Une équipe IA & ses skills qui', 'An AI team & its skills that')}{' '}
              <span className="bs-roulette">
                <span className="bs-roulette-ph">{lp('pensent', 'think')}</span>
                <span className="bs-roulette-word bw1">{lp('pensent', 'think')}</span>
                <span className="bs-roulette-word bw2">{lp('dialoguent', 'talk')}</span>
                <span className="bs-roulette-word bw3">{lp('travaillent', 'work')}</span>
                <span className="bs-roulette-word bw4">{lp('collaborent', 'collaborate')}</span>
              </span>{' '}
              {lp('ensemble.', 'together.')}
            </h2>
            <p className="bs-sub lp-reveal">{lp('Un orchestrateur central coordonne tous les agents en temps réel. Choisissez ceux que vous voulez — ils communiquent entre eux et apprennent de vos données.', 'A central orchestrator coordinates all agents in real time. Choose the ones you want — they talk to each other and learn from your data.')}</p>

            <div className="bs-scene">
              <div className="bs-orbit-line ol1"></div>
              <div className="bs-orbit-line ol2"></div>
              <div className="bs-pulse-wave"></div>
              <div className="bs-pulse-wave pw2"></div>
              <div className="bs-pulse-wave pw3"></div>

              <div className="bs-core">
                <div className="bs-sphere"></div>
                <div className="bs-core-text">
                  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v0a3 3 0 0 0-3 3 3 3 0 0 0-1 5.83 3 3 0 0 0 2.5 5.17 3 3 0 0 0 4.5 2 3 3 0 0 0 4.5-2 3 3 0 0 0 2.5-5.17A3 3 0 0 0 18 8a3 3 0 0 0-3-3 3 3 0 0 0-3-3z"/>
                    <path d="M9 12h.01M12 10v4M15 12h.01"/>
                  </svg>
                  <span className="t1">Orchestrateur</span>
                  <span className="t2">Cerveau IA</span>
                </div>
              </div>

              {[
                {n:1,lbl:'Knowledge',svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>},
                {n:2,lbl:'Commercial',svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>},
                {n:3,lbl:'Comptabilité',svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>},
                {n:4,lbl:'RH',svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>},
                {n:5,lbl:'Livraison',svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.5v9a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 20.5v-9"/><path d="M5.5 11.5V6a1.5 1.5 0 0 1 1.5-1.5h10A1.5 1.5 0 0 1 18.5 6v5.5"/><rect x="2" y="11.5" width="20" height="4" rx="1"/></svg>},
                {n:6,lbl:'Support',svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>},
                {n:7,lbl:'Planning',svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>},
                {n:8,lbl:'Réception',svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>},
              ].map(node => (
                <div key={node.n} className={`bs-node n${node.n}`}>
                  <div className="bubble">{node.svg}</div>
                  <span className="lbl">{node.lbl}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MARKETPLACE — 8 industry cards ─────────────────────── */}
        <section id="marketplace" style={{padding:'96px 0',borderTop:'1px solid rgba(255,255,255,.04)'}}>
          <div style={{maxWidth:1200,margin:'0 auto',padding:'0 32px',textAlign:'center'}} className="mob-px">
            <div className="market-eyebrow lp-reveal">
              <span className="market-eyebrow-ico">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              </span>
              {lp('Marketplace', 'Marketplace')}<span className="count">· {lp('Agents métier', 'Industry agents')}</span>
            </div>
            <h1 className="sh lp-reveal" style={{margin:0}}>
              <span style={{display:'block',color:'#fff'}}>{lp('Des agents créés pour', 'Agents built for')}</span>
              <span style={{display:'block'}}>
                <span style={{color:'#fff'}}>{lp('votre ', 'your ')}</span>
                <span className="market-roulette">
                  <span className="market-roulette-ph">{lp('industrie.', 'industry.')}</span>
                  <span className="market-roulette-word mw1">{lp('industrie.', 'industry.')}</span>
                  <span className="market-roulette-word mw2">{lp('clinique.', 'clinic.')}</span>
                  <span className="market-roulette-word mw3">{lp('agriculture.', 'farm.')}</span>
                  <span className="market-roulette-word mw4">{lp('chantier.', 'site.')}</span>
                  <span className="market-roulette-word mw5">{lp('école.', 'school.')}</span>
                </span>
              </span>
            </h1>
            <div className="ss lp-reveal" style={{maxWidth:700,margin:'18px auto 0'}}>
              {lp('Installez des agents spécialisés en 1 clic. Santé, commerce, BTP, agriculture, éducation, hôtellerie, transport, finance — adaptés à votre marché.', 'Install specialized agents in 1 click. Health, commerce, construction, farming, education, hospitality, transport, finance — adapted to your market.')}
            </div>

            <div className="market-grid lp-reveal" style={{marginTop:48}}>
              {[
                {key:'health',title:'Santé',desc:'Cliniques, cabinets médicaux, pharmacies. RDV patients, ordonnances, rappels.',price:'15 000',sub:'Essai 7 jours',badge:'hot',badgeText:'Populaire',agentCount:5,extra:2,
                  photo:'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=70',
                  ico:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>},
                {key:'commerce',title:'Commerce',desc:'Boutiques, e-commerce, WhatsApp shop. Relance panier, stock, fidélisation.',price:'19 000',sub:'WhatsApp intégré',badge:'hot',badgeText:'Populaire',agentCount:6,extra:3,
                  photo:'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=70',
                  ico:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>},
                {key:'btp',title:'BTP & chantier',desc:'Suivi chantier, rapports matériaux, planning ouvriers, devis construction.',price:'25 000',sub:'Mobile money',badge:'',badgeText:'Disponible',agentCount:4,extra:0,
                  photo:'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=70',
                  ico:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 22 1.7-5 2-.6v-5.4l5-2"/><path d="M8 22h8"/><path d="M12 2v3"/><path d="m14 22 .9-3.4 1.8.4a3 3 0 0 0 3.3-3L20 9l-3-1"/><rect x="7" y="5" width="10" height="4" rx="1"/></svg>},
                {key:'agri',title:'Agriculture',desc:'Météo, irrigation, parcelles, vente récolte WhatsApp, assistance phyto.',price:'12 000',sub:'Subvention dispo',badge:'new',badgeText:'Nouveau',agentCount:4,extra:0,
                  photo:'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=70',
                  ico:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10c-4 0-7-2-7-6 4 0 7 2 7 6Z"/><path d="M12 14c4 0 7-2 7-6-4 0-7 2-7 6Z"/><path d="M12 22V10"/></svg>},
                {key:'edu',title:'Éducation',desc:'Écoles, centres de formation, universités. Inscriptions, notes, parents.',price:'17 000',sub:'-30% ONG',badge:'',badgeText:'Disponible',agentCount:5,extra:2,
                  photo:'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=70',
                  ico:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>},
                {key:'hospi',title:'Hôtellerie',desc:'Réservations, check-in, conciergerie, room service, avis multilingues.',price:'21 000',sub:'Multi-langues',badge:'',badgeText:'Disponible',agentCount:4,extra:0,
                  photo:'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=70',
                  ico:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
                {key:'trans',title:'Transport',desc:'VTC, taxis, coursiers, livraison dernier km. Affectation, GPS, paiement.',price:'16 000',sub:'Tracking live',badge:'new',badgeText:'Nouveau',agentCount:4,extra:0,
                  photo:'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=600&q=70',
                  ico:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 18H3v-7l4-7h11l4 7v7h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>},
                {key:'finance',title:'Finance',desc:'Microfinance, tontines, banque mobile. Épargne, crédit, KYC, scoring.',price:'30 000',sub:'Certifié BCEAO',badge:'soon',badgeText:'Bientôt',agentCount:4,extra:0,
                  photo:'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=70',
                  ico:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>},
              ].map(c => (
                <div key={c.key} className={`ind-card ${c.key}`}>
                  <div className="glow"></div>
                  <div className="ic-photo">
                    <img src={c.photo} alt={c.title} loading="lazy" />
                    <div className="ic-photo-top">
                      <div className="ic-ico">{c.ico}</div>
                      <span className={`ic-badge ${c.badge}`}>{c.badgeText}</span>
                    </div>
                  </div>
                  <div>
                    <div className="ic-title">{c.title}</div>
                    <div className="ic-desc" style={{marginTop:6}}>{c.desc}</div>
                  </div>
                  <div className="ic-agents">
                    <div className="ic-avs">
                      <div className="ic-av g1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div>
                      <div className="ic-av g2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
                      <div className="ic-av g3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
                      {c.extra > 0 && <div className="ic-more">+{c.extra}</div>}
                    </div>
                    <span className="ic-count">{c.agentCount} agents</span>
                  </div>
                  <div className="ic-install">
                    <div className="ic-price">
                      <span className="main">{c.price}<span style={{fontWeight:400,color:'rgba(255,255,255,0.6)'}}> CFA/mois</span></span>
                      <span className="sub">{c.sub}</span>
                    </div>
                    <Link to="/register" className="ic-btn">Installer<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></Link>
                  </div>
                </div>
              ))}
            </div>

            <div style={{marginTop:48,display:'flex',justifyContent:'center'}}>
              <Link to="/register" className="see-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                {lp('Voir tous les agents métier', 'See all industry agents')}
              </Link>
            </div>
          </div>
        </section>

        {/* ── VIDEO 2 — Témoignage / Use case ────────────────────── */}
        <section style={{padding:'80px 0',borderTop:'1px solid rgba(255,255,255,.04)'}}>
          <div style={{maxWidth:960,margin:'0 auto',padding:'0 32px',textAlign:'center'}} className="mob-px">
            <div className="st lp-reveal">🎬 En action</div>
            <div className="sh lp-reveal" style={{marginBottom:32}}>Voyez Orlode en situation réelle.</div>
            <div className="lp-reveal video-slot">
              {c('video2Url', '') ? (
                <iframe src={toEmbedUrl(c('video2Url', ''))} style={{width:'100%',height:'100%',border:'none'}} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              ) : (
                <>
                  <div className="play"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
                  <p style={{position:'absolute',bottom:20,fontSize:14,color:'var(--g5)'}}>{c('video2Label', 'Témoignage client')}</p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── CONNECTORS — Use-case scenarios (Option C) ──────────── */}
        <section id="connectors" style={{padding:'96px 0',borderTop:'1px solid rgba(255,255,255,.04)'}}>
          <div style={{maxWidth:1200,margin:'0 auto',padding:'0 32px',textAlign:'center'}} className="mob-px">
            <div className="cn-eyebrow lp-reveal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {lp('Connecteurs', 'Connectors')}<span className="count">· {lp('en action concrète', 'in real action')}</span>
            </div>
            <h2 className="sh lp-reveal" style={{margin:0}}>
              {lp('Voyez comment ', 'See how ')}<span style={{background:'linear-gradient(135deg,#AFA9EC 0%,#D4537E 50%,#FAC775 100%)',WebkitBackgroundClip:'text',backgroundClip:'text',WebkitTextFillColor:'transparent'}}>{lp('vos outils dialoguent', 'your tools talk')}</span>
            </h2>
            <p className="ss lp-reveal" style={{maxWidth:680,margin:'18px auto 0'}}>
              {lp('Pas une simple liste de logos — voici des scenarios réels où Orlode orchestre votre stack en temps réel.', 'Not just a logo grid — these are real scenarios where Orlode orchestrates your stack in real time.')}
            </p>

            <div className="optc-grid lp-reveal" style={{marginTop:48}}>
              {[
                {color:'purple',tag:'Vente WhatsApp',title:'Client → CRM en 3 secondes',desc:"Un client envoie « Je veux le produit X » sur WhatsApp. Orlode crée le ticket dans HubSpot et génère le lien Stripe automatiquement.",time:'Temps réel',
                  flow:[{lg:'whatsapp',n:'WhatsApp',l:'W'},'orlode',{lg:'hubspot',n:'HubSpot',l:'H'},{lg:'stripe',n:'Stripe',l:'$'}]},
                {color:'amber',tag:'Support 24/7',title:'Email → ticket Jira automatique',desc:"Un client écrit à support@. Orlode lit, comprend l'urgence, crée un ticket Jira et notifie l'équipe sur Slack.",time:'< 30 sec',
                  flow:[{lg:'gmail',n:'Gmail',l:'M'},'orlode',{lg:'jira',n:'Jira',l:'J'},{lg:'slack',n:'Slack',l:'S'}]},
                {color:'green',tag:'E-commerce',title:'Stock bas → relance fournisseur',desc:"Quand le stock Shopify passe sous le seuil, Orlode envoie un email de réassort au fournisseur et notifie l'équipe sur Telegram.",time:'Auto',
                  flow:[{lg:'shopify',n:'Shopify',l:'S'},'orlode',{lg:'gmail',n:'Gmail',l:'M'},{lg:'telegram',n:'Telegram',l:'T'}]},
                {color:'pink',tag:'Réunions',title:'Visio → notes automatiques',desc:"Après une réunion Zoom, Orlode résume, extrait les action items, les ajoute dans Asana et envoie le compte-rendu par mail.",time:'2 min',
                  flow:[{lg:'zoom',n:'Zoom',l:'Z'},'orlode',{lg:'notion',n:'Notion',l:'N'},{lg:'asana',n:'Asana',l:'A'}]},
                {color:'blue',tag:'Marketing',title:'Lead Meta → Mailchimp',desc:"Un nouveau lead arrive de Facebook Ads. Orlode l'enrichit, le segmente et l'ajoute dans la bonne séquence Mailchimp.",time:'Instantané',
                  flow:[{lg:'meta',n:'Meta',l:'f'},'orlode',{lg:'airtable',n:'Airtable',l:'A'},{lg:'mailchimp',n:'Mailchimp',l:'M'}]},
                {color:'coral',tag:'Communauté',title:'Discord → ticket support',desc:"Un membre Discord signale un bug. Orlode crée un ticket Jira, prévient le dev sur Slack et répond automatiquement.",time:'< 1 min',
                  flow:[{lg:'discord',n:'Discord',l:'D'},'orlode',{lg:'jira',n:'Jira',l:'J'},{lg:'slack',n:'Slack',l:'S'}]},
              ].map(scn => (
                <div key={scn.tag} className={`optc-card ${scn.color}`}>
                  <span className="optc-tag">{scn.tag}</span>
                  <div className="optc-title">{scn.title}</div>
                  <p className="optc-desc">{scn.desc}</p>
                  <div className="optc-flow">
                    {scn.flow.map((step, idx) => (
                      <React.Fragment key={idx}>
                        {step === 'orlode' ? (
                          <div className="optc-flow-step"><div className="optc-orlode-bubble"></div><span className="optc-flow-name" style={{display:'none'}}>Orlode</span></div>
                        ) : (
                          <div className="optc-flow-step">
                            <div className={`optc-flow-logo lg-${(step as {lg:string}).lg}`}>{(step as {l:string}).l}</div>
                            <span className="optc-flow-name">{(step as {n:string}).n}</span>
                          </div>
                        )}
                        {idx < scn.flow.length - 1 && (
                          <span className="optc-flow-arrow">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="optc-bottom">
                    <Link to="/register" className="optc-link">Démarrer<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></Link>
                    <span className="optc-time">{scn.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────────── */}
        <section style={{padding:'96px 0',borderTop:'1px solid rgba(255,255,255,.04)'}}>
          <div style={{maxWidth:1200,margin:'0 auto',padding:'0 32px',textAlign:'center'}} className="mob-px">
            <div className="st lp-reveal">⚡ Comment ça marche</div>
            <div className="sh lp-reveal">Setup rapide.<br/>Zéro développeur requis.</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:24,marginTop:56}} className="mob-1">
              {[{n:'1',t:'Créez votre compte',d:'Inscrivez-vous, nommez votre entreprise et choisissez votre plan.'},{n:'2',t:'Choisissez vos agents',d:'Sélectionnez vos agents intégrés. Ajoutez-en plus depuis le marketplace métier.'},{n:'3',t:'Connectez et collaborez',d:'Connectez vos outils (Google, Slack, WhatsApp...), chat équipe, et l\'IA travaille pour vous.'}].map((s,i) => (
                <div key={s.n} className={`lp-reveal ${i>0?'rd'+i:''}`} style={{padding:'36px 28px',background:'var(--dark2)',border:'1px solid rgba(255,255,255,.05)',borderRadius:20,textAlign:'center'}}>
                  <div style={{width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,var(--amber),#FFB94D)',color:'#000',fontFamily:"'Bricolage Grotesque'",fontWeight:800,fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}>{s.n}</div>
                  <h4 style={{fontFamily:"'Bricolage Grotesque'",fontWeight:700,fontSize:20,marginBottom:10}}>{s.t}</h4>
                  <p style={{fontSize:15,color:'var(--g4)',lineHeight:1.7}}>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ────────────────────────────────────────── */}
        <section id="testimonials" style={{padding:'96px 0',borderTop:'1px solid rgba(255,255,255,.04)'}}>
          <div style={{maxWidth:1200,margin:'0 auto',padding:'0 32px',textAlign:'center'}} className="mob-px">
            <div className="st lp-reveal">💬 Témoignages</div>
            <div className="sh lp-reveal">Ils nous font confiance.</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,marginTop:48}} className="mob-1">
              {cArr('testimonials', TESTIMONIALS).map((t: {name:string;role:string;text:string;avatar:string},i: number) => (
                <div key={t.name} className={`lp-reveal ${i>0?'rd'+i:''}`}
                  style={{background:'var(--dark2)',border:'1px solid rgba(255,255,255,.05)',borderRadius:16,padding:'28px 24px',textAlign:'left'}}>
                  <div style={{display:'flex',gap:4,marginBottom:16}}>
                    {[1,2,3,4,5].map(s => <span key={s} style={{color:'#FFD700',fontSize:16}}>★</span>)}
                  </div>
                  <p style={{fontSize:15,color:'var(--g4)',lineHeight:1.7,marginBottom:20,fontStyle:'italic'}}>"{t.text}"</p>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:40,height:40,borderRadius:'50%',background:'var(--blue)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:16}}>{t.avatar}</div>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{t.name}</div>
                      <div style={{fontSize:12,color:'var(--g5)'}}>{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ─────────────────────────────────────────────── */}
        <section id="pricing" style={{padding:'96px 0',borderTop:'1px solid rgba(255,255,255,.04)'}}>
          <div style={{maxWidth:1200,margin:'0 auto',padding:'0 32px',textAlign:'center'}} className="mob-px">
            <div className="st lp-reveal">💰 Pricing</div>
            <div className="sh lp-reveal">Un prix transparent.<br/>Pas de surprises.</div>
            <div className="ss lp-reveal">Payez vos propres API AI — aucun markup.</div>

            {/* Toggle */}
            <div className="lp-reveal" style={{display:'inline-flex',alignItems:'center',gap:0,margin:'32px 0',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:50,padding:6}}>
              <button onClick={() => setBilling('monthly')} style={{padding:'8px 24px',borderRadius:50,border:'none',cursor:'pointer',fontFamily:"'Outfit'",fontWeight:600,fontSize:14,background:billing==='monthly'?'var(--blue)':'transparent',color:billing==='monthly'?'#fff':'rgba(255,255,255,.5)',transition:'all .3s'}}>Mensuel</button>
              <button onClick={() => setBilling('yearly')} style={{padding:'8px 24px',borderRadius:50,border:'none',cursor:'pointer',fontFamily:"'Outfit'",fontWeight:600,fontSize:14,background:billing==='yearly'?'var(--blue)':'transparent',color:billing==='yearly'?'#fff':'rgba(255,255,255,.5)',transition:'all .3s'}}>
                Annuel <span style={{background:'var(--amber)',color:'#000',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,marginLeft:4}}>-17%</span>
              </button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginTop:16,alignItems:'start'}} className="mob-2">
              {plans.map((p,i) => (
                <div key={p.name} className={`lp-reveal rd${i}`} style={{background:p.featured?'linear-gradient(180deg,rgba(43,74,255,.06),var(--dark2))':'var(--dark2)',border:p.featured?'2px solid var(--blue)':'1px solid rgba(255,255,255,.05)',borderRadius:20,padding:'32px 24px',position:'relative'}}>
                  {p.featured && <div style={{position:'absolute',top:-13,left:'50%',transform:'translateX(-50%)',background:'var(--amber)',color:'#000',fontWeight:700,fontSize:12,padding:'5px 16px',borderRadius:20}}>Populaire</div>}
                  <div style={{fontFamily:"'Bricolage Grotesque'",fontWeight:700,fontSize:18,marginBottom:6}}>{p.name}</div>
                  <div style={{fontFamily:"'Bricolage Grotesque'",fontWeight:800,fontSize:40}}>{p.price}<small style={{fontSize:16,fontWeight:500,color:'var(--g5)'}}>{p.sub}</small></div>
                  <div style={{fontSize:13,color:'var(--g5)',margin:'4px 0 20px'}}>{p.desc}</div>
                  <ul style={{listStyle:'none',padding:0,display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
                    {p.features.map(f => <li key={f} style={{fontSize:14,color:'#C4C9D9',display:'flex',alignItems:'center',gap:8}}>{CHECK} {f}</li>)}
                  </ul>
                  <Link to="/register" className={`btn ${p.featured?'bp':'bo'}`} style={{width:'100%',justifyContent:'center'}}>{p.cta}</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA (new design) ──────────────────────────────── */}
        <section className="cf-cta-section">
          <div className="cf-brain-glow lp-reveal">
            <div className="cf-brain-rings"></div>
            <div className="cf-brain-rings r2"></div>
            <div className="cf-brain-rings r3"></div>
            <div className="cf-brain-orb"></div>
            <div className="cf-brain-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v0a3 3 0 0 0-3 3 3 3 0 0 0-1 5.83 3 3 0 0 0 2.5 5.17 3 3 0 0 0 4.5 2 3 3 0 0 0 4.5-2 3 3 0 0 0 2.5-5.17A3 3 0 0 0 18 8a3 3 0 0 0-3-3 3 3 0 0 0-3-3z"/>
                <path d="M9 12h.01M12 10v4M15 12h.01"/>
              </svg>
            </div>
          </div>

          <div className="cf-eyebrow lp-reveal">
            <span className="cf-eyebrow-dot"></span>
            {lp('Prêt à démarrer', 'Ready to start')}
          </div>

          <h2 className="cf-title lp-reveal">
            <span className="line1">{lp('Prêt à donner', 'Ready to give')}</span>
            <span className="line2">{lp('un cerveau IA à votre entreprise', 'an AI brain to your business')} <span className="bounce">?</span></span>
          </h2>

          <p className="cf-sub lp-reveal">
            {lp("Une équipe d'agents intégrés, un marketplace métier, des connecteurs natifs. ", 'A team of integrated agents, an industry marketplace, native connectors. ')}<span className="highlight">{lp('Tout est prêt', 'Everything is ready')}</span>{lp(" — vous n'avez qu'à choisir.", ' — just pick what you need.')}
          </p>

          <div className="cf-cta-row lp-reveal">
            <Link to="/register" className="cf-cta-primary">
              <span className="spark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#FAC775" stroke="#FAC775" strokeWidth="1" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </span>
              {lp("Démarrer maintenant — c'est gratuit", 'Start now — it\'s free')}
            </Link>
            <a href="#demo" className="cf-cta-ghost">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="0"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {lp('Voir la démo', 'Watch demo')}
            </a>
          </div>

          <div className="cf-trust lp-reveal">
            {[lp('Pas de carte bancaire', 'No credit card'), lp('Plan Free disponible', 'Free plan available'), lp('Annulez à tout moment', 'Cancel anytime')].map(t => (
              <div key={t} className="cf-trust-item">
                <span className="cf-trust-ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                {t}
              </div>
            ))}
          </div>
        </section>

        {/* ── NEWSLETTER ──────────────────────────────────────────── */}
        <section className="cf-newsletter">
          <div className="cf-newsletter-card lp-reveal">
            <div>
              <h3>{lp("Restez à la pointe de l'IA pour business", 'Stay on top of business AI')}</h3>
              <p>{lp("Les nouveautés Orlode, les meilleures pratiques agents IA, et des cas d'usage par industrie. Une fois par mois, sans spam.", 'Orlode updates, AI agent best practices, and industry use cases. Once a month, no spam.')}</p>
            </div>
            <form className="cf-newsletter-form" onSubmit={(e) => e.preventDefault()}>
              <input type="email" className="cf-newsletter-input" placeholder={lp('votre@entreprise.com', 'your@business.com')} />
              <button type="submit" className="cf-newsletter-btn">
                {lp("S'abonner", 'Subscribe')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </form>
          </div>
        </section>

        {/* ── FOOTER (new design) ─────────────────────────────────── */}
        <footer className="cf-footer">
          <div className="cf-footer-grid">
            <div className="cf-footer-brand-block">
              <div className="cf-footer-brand">
                <div className="cf-footer-logo"></div>
                <div className="cf-footer-brand-text">
                  <span className="nm">Orlode AI</span>
                  <span className="by">par OuiHope</span>
                </div>
              </div>
              <p className="cf-footer-desc">{lp("L'équipe IA complète pour votre entreprise. Agents intégrés, marketplace d'agents métier — adaptés à votre marché.", "The complete AI team for your business. Integrated agents, industry marketplace — adapted to your market.")}</p>
              <div className="cf-footer-socials">
                <a className="cf-footer-social" href="https://twitter.com" target="_blank" rel="noopener noreferrer" title="Twitter / X" style={{['--hbg' as never]: '#000'}}>
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a className="cf-footer-social" href="https://linkedin.com" target="_blank" rel="noopener noreferrer" title="LinkedIn">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a className="cf-footer-social" href="https://instagram.com" target="_blank" rel="noopener noreferrer" title="Instagram">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a className="cf-footer-social" href="https://facebook.com" target="_blank" rel="noopener noreferrer" title="Facebook">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 011.141.195v3.325a8.623 8.623 0 00-.653-.036 26.805 26.805 0 00-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 00-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647z"/></svg>
                </a>
                <a className="cf-footer-social" href="https://youtube.com" target="_blank" rel="noopener noreferrer" title="YouTube">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
                <a className="cf-footer-social" href="https://github.com" target="_blank" rel="noopener noreferrer" title="GitHub">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
              </div>
            </div>

            <div>
              <div className="cf-footer-col-title">{lp('Produit', 'Product')}</div>
              <div className="cf-footer-links">
                <a className="cf-footer-link" href="#agents">{lp('Agents', 'Agents')}</a>
                <a className="cf-footer-link" href="#marketplace">{lp('Marketplace', 'Marketplace')}</a>
                <a className="cf-footer-link" href="#pricing">{lp('Pricing', 'Pricing')}</a>
                <a className="cf-footer-link" href="#connectors">{lp('Connecteurs', 'Connectors')}</a>
                <a className="cf-footer-link" href="/legal/privacy">{lp('Sécurité', 'Security')}</a>
                <a className="cf-footer-link" href="#">API <span className="cf-footer-link-badge purple">{lp('Bientôt', 'Soon')}</span></a>
              </div>
            </div>

            <div>
              <div className="cf-footer-col-title">{lp('Solutions', 'Solutions')}</div>
              <div className="cf-footer-links">
                <a className="cf-footer-link" href="#marketplace">{lp('Santé', 'Health')}</a>
                <a className="cf-footer-link" href="#marketplace">{lp('Commerce', 'Commerce')}</a>
                <a className="cf-footer-link" href="#marketplace">{lp('BTP', 'Construction')}</a>
                <a className="cf-footer-link" href="#marketplace">{lp('Agriculture', 'Farming')}</a>
                <a className="cf-footer-link" href="#marketplace">{lp('Éducation', 'Education')}</a>
                <a className="cf-footer-link" href="#marketplace">{lp('Hôtellerie', 'Hospitality')}</a>
              </div>
            </div>

            <div>
              <div className="cf-footer-col-title">{lp('Entreprise', 'Company')}</div>
              <div className="cf-footer-links">
                <a className="cf-footer-link" href="/legal/notice">{lp('À propos', 'About')}</a>
                <a className="cf-footer-link" href="mailto:hello@orlode.com">{lp('Contact', 'Contact')}</a>
                <a className="cf-footer-link" href="#">{lp('Carrières', 'Careers')}</a>
                <a className="cf-footer-link" href="#">{lp('Partenaires', 'Partners')}</a>
                <a className="cf-footer-link" href="#">{lp('Presse', 'Press')}</a>
                <a className="cf-footer-link" href="#testimonials">{lp('Avis clients', 'Customer reviews')}</a>
              </div>
            </div>
          </div>

          <div className="cf-footer-bottom">
            <div className="cf-copyright">
              © {new Date().getFullYear()} <strong>Orlode AI</strong> par OuiHope. Made in
              <span className="ci-flag">
                <svg viewBox="0 0 9 6" xmlns="http://www.w3.org/2000/svg">
                  <rect width="9" height="6" fill="#B22234"/>
                  <rect width="9" height="0.46" y="0.46" fill="#fff"/>
                  <rect width="9" height="0.46" y="1.38" fill="#fff"/>
                  <rect width="9" height="0.46" y="2.30" fill="#fff"/>
                  <rect width="9" height="0.46" y="3.22" fill="#fff"/>
                  <rect width="9" height="0.46" y="4.14" fill="#fff"/>
                  <rect width="9" height="0.46" y="5.06" fill="#fff"/>
                  <rect width="3.6" height="3.23" fill="#3C3B6E"/>
                </svg>
              </span>
              San Diego, CA.
            </div>
            <span className="cf-status-pill">Tous les systèmes opérationnels</span>
          </div>

          <div className="cf-footer-meta">
            <span className="cf-badge green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              RGPD
            </span>
            <span className="cf-badge amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              SOC 2
            </span>

            {/* Language switcher */}
            <div style={{position:'relative'}}>
              <button
                onClick={() => setLangOpen(o => !o)}
                onBlur={() => setTimeout(() => setLangOpen(false), 150)}
                className="cf-lang-btn"
                style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,background:'rgba(255,255,255,.05)',border:'.5px solid rgba(255,255,255,.12)',fontSize:12,color:'#fff',cursor:'pointer',fontWeight:500,fontFamily:'inherit'}}
              >
                <span style={{fontSize:14}}>{LANGUAGES.find(l => l.code === lang)?.flag ?? '🌐'}</span>
                <span style={{fontSize:9,padding:'2px 5px',borderRadius:4,background:'rgba(127,119,221,.25)',color:'#CECBF6',letterSpacing:'.05em',textTransform:'uppercase'}}>{lang}</span>
                {LANGUAGES.find(l => l.code === lang)?.label ?? 'Langue'}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{transform: langOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s'}}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {langOpen && (
                <div style={{position:'absolute',bottom:'calc(100% + 8px)',left:0,minWidth:180,background:'rgba(15,16,28,.98)',border:'.5px solid rgba(255,255,255,.15)',borderRadius:12,padding:6,boxShadow:'0 12px 40px rgba(0,0,0,.5)',backdropFilter:'blur(20px)',zIndex:50}}>
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onMouseDown={(e) => { e.preventDefault(); setLang(l.code as LangCode); setLangOpen(false); }}
                      style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 12px',borderRadius:8,background:l.code === lang ? 'rgba(127,119,221,.2)' : 'transparent',border:'none',color:l.code === lang ? '#fff' : 'rgba(255,255,255,.8)',fontSize:13,fontFamily:'inherit',cursor:'pointer',textAlign:'left',transition:'background .15s'}}
                      onMouseEnter={(e) => { if (l.code !== lang) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.06)'; }}
                      onMouseLeave={(e) => { if (l.code !== lang) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      <span style={{fontSize:16}}>{l.flag}</span>
                      <span style={{flex:1}}>{l.label}</span>
                      {l.code === lang && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="cf-meta-links">
              <a className="cf-meta-link" href="/legal/terms">CGU</a>
              <a className="cf-meta-link" href="/legal/privacy">Confidentialité</a>
              <a className="cf-meta-link" href="/legal/notice">Mentions légales</a>
            </div>
          </div>
        </footer>

        {/* ── CHAT WIDGET ─────────────────────────────────────────── */}
        <button onClick={() => setChatOpen(o => !o)}
          style={{position:'fixed',bottom:28,right:28,zIndex:9000,width:58,height:58,borderRadius:'50%',background:'var(--blue)',border:'none',cursor:'pointer',boxShadow:'0 4px 24px rgba(43,74,255,.4)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          {chatOpen
            ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          }
        </button>
        {chatOpen && (
          <div style={{position:'fixed',bottom:100,right:28,zIndex:8999,width:'min(360px,calc(100vw - 56px))',maxHeight:520,background:'var(--dark2)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,boxShadow:'0 20px 60px rgba(0,0,0,.5)',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'16px 18px',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',alignItems:'center',gap:12}}>
              <img src="/logo.png" alt="Orlode" style={{width:36,height:36,borderRadius:10}} />
              <div><div style={{fontFamily:"'Bricolage Grotesque'",fontWeight:700,fontSize:15}}>Orlode AI</div><div style={{fontSize:12,color:'var(--g5)'}}>Agent Commercial en ligne</div></div>
              <div style={{width:8,height:8,background:'#34D399',borderRadius:'50%',marginLeft:'auto'}} />
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16,display:'flex',flexDirection:'column',gap:10,maxHeight:360}}>
              {chatMessages.map((m,i) => (
                <div key={i} style={{maxWidth:'82%',padding:'10px 14px',borderRadius:16,fontSize:13,lineHeight:1.6,wordBreak:'break-word',alignSelf:m.role==='user'?'flex-end':'flex-start',...(m.role==='user'?{background:'var(--blue)',borderBottomRightRadius:4}:{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.07)',color:'#C4C9D9',borderBottomLeftRadius:4})}}>
                  {m.text}
                </div>
              ))}
              {chatLoading && (
                <div style={{alignSelf:'flex-start',padding:'12px 16px',borderRadius:16,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.07)'}}>
                  <div style={{display:'flex',gap:4}}>{[0,1,2].map(j => <span key={j} style={{width:6,height:6,background:'var(--g5)',borderRadius:'50%',animation:`pulse 1.4s ease-in-out infinite ${j*0.2}s`}} />)}</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{padding:12,borderTop:'1px solid rgba(255,255,255,.07)',display:'flex',gap:8}}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Votre question..." style={{flex:1,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:12,padding:'10px 14px',fontSize:13,color:'#fff',outline:'none',fontFamily:"'Outfit'"}} />
              <button onClick={sendChat} style={{width:38,height:38,background:'var(--blue)',border:'none',borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
