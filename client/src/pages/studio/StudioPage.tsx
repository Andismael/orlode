/**
 * StudioPage — /studio
 *
 * Onboarding wizard inspired by the OrlodeStudio design: pick a template
 * (vertical), pick a theme (visual style), set identity (name + logo),
 * choose a domain, then launch.
 *
 * On launch:
 *   - PATCH /company sets name, logoUrl, theme, customDomain
 *   - POST /commerce/stores creates the pack store with businessType
 *   - Redirect to /agents/<pack> for the user to start using it
 *
 * Compact functional port — not a 1:1 visual replica of the JSX mockup,
 * but follows the same 5-step flow and the same templates / themes lists.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Check, X, ArrowRight, ChevronLeft, CheckCircle2,
  Hotel, Building as BuildingIcon, Home, ShoppingBag, UtensilsCrossed, Scissors,
  Pill, Stethoscope, GraduationCap, Dumbbell, Car, Globe,
  Crown, Rocket, Camera, Phone, RefreshCw, ExternalLink, LayoutDashboard, Copy,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';

// ── Palette ──────────────────────────────────────────────────────────────────
const N = {
  bgDeep:   '#0A4F3C',
  cream:    '#FFFAF0',
  ink:      '#1C1410',
  inkSoft:  '#5A4D45',
  inkLight: '#94857B',
  onGreenSoft: '#A8C9B8',
  emerald:  '#10B981',
  emeraldDeep:'#059669',
  coral:    '#FB7185',
  yellow:   '#FCD34D',
  violet:   '#7C3AED',
};

// ── Templates (12) — vertical kinds, mapped to existing businessType where supported ──
type TemplateStatus = 'ready' | 'soon';
interface Template {
  key: string;
  name: string;
  emoji: string;
  icon: any;
  tagline: string;
  description: string;
  status: TemplateStatus;
  color: string;
  accentColor: string;
  sector: string;
  /** Maps to the businessType used by /commerce/stores. Undefined for "soon". */
  businessType?: string;
  /** Where the user lands after launch. */
  packPath?: string;
}

const TEMPLATES: Template[] = [
  { key: 'boutique',   name: 'Boutique · Retail',        emoji: '🛍',  icon: ShoppingBag,    tagline: 'Catalogue, POS, livraisons',          description: 'Catalogue + variantes + POS + livraisons + fidélité.', status: 'ready', color: '#EA580C', accentColor: '#312E81', sector: 'Retail',         businessType: 'boutique',  packPath: '/agents/commerce' },
  { key: 'restaurant', name: 'Restaurant · Bar',          emoji: '🍽',  icon: UtensilsCrossed, tagline: 'Menu, KDS, livraisons',                description: 'Menu digital, plan tables, cuisine live, livraisons.',  status: 'ready', color: '#7C2D12', accentColor: '#F59E0B', sector: 'Restauration',   businessType: 'restaurant', packPath: '/agents/restaurant' },
  { key: 'hotel',      name: 'Hôtel · Boutique',          emoji: '🏨',  icon: Hotel,           tagline: "L'art de bien recevoir",                description: 'Chambres, séjours, restaurant, spa, événementiel.',     status: 'ready', color: '#7C2D12', accentColor: '#A16207', sector: 'Hôtellerie',     businessType: 'hotel',     packPath: '/agents/hotel' },
  { key: 'residence',  name: 'Résidence · Meublée',       emoji: '🏘️', icon: BuildingIcon,    tagline: 'Court / moyen / long séjour',           description: 'Studios, F2, F3 avec nuit / semaine / mois.',           status: 'ready', color: '#1E3A8A', accentColor: '#D4A017', sector: 'Hébergement',    businessType: 'residence', packPath: '/agents/residence' },
  { key: 'immobilier', name: 'Immobilier · Agence',       emoji: '🏢',  icon: Home,            tagline: 'Vente, location, visites',              description: 'Biens, agenda visites, dossiers locataires.',           status: 'ready', color: '#312E81', accentColor: '#D97706', sector: 'Immobilier',     businessType: 'realestate', packPath: '/agents/realestate' },
  { key: 'salon',      name: 'Salon · Beauté',            emoji: '✂️',  icon: Scissors,        tagline: "L'art de prendre soin",                 description: 'Coiffure, esthétique, manucure, spa — RDV WhatsApp.',   status: 'ready', color: '#DB2777', accentColor: '#8B5CF6', sector: 'Beauté',         businessType: 'service',   packPath: '/agents/service' },
  { key: 'cabinet',    name: 'Cabinet · 6 profils',       emoji: '🏛️', icon: Stethoscope,     tagline: 'Médecin · Avocat · Notaire…',           description: 'Médecin, dentiste, avocat, notaire, comptable, véto.',  status: 'ready', color: '#10B981', accentColor: '#D97706', sector: 'Pro libéral',    businessType: 'cabinet',   packPath: '/agents/cabinet' },
  { key: 'pharmacie',  name: 'Pharmacie · Para',          emoji: '💊',  icon: Pill,            tagline: 'Santé responsable',                     description: 'Stock médicaments, ordonnances, livraison.',            status: 'soon',  color: '#10B981', accentColor: '#0EA5E9', sector: 'Santé' },
  { key: 'ecole',      name: 'École · Formation',         emoji: '🎓',  icon: GraduationCap,   tagline: "L'éducation digitale",                  description: 'Élèves, notes, bulletins, frais scolarité.',            status: 'soon',  color: '#7C3AED', accentColor: '#F59E0B', sector: 'Éducation' },
  { key: 'fitness',    name: 'Sport · Fitness',           emoji: '🏋️', icon: Dumbbell,        tagline: 'Le corps, c\'est sacré',                description: 'Salle de sport, coach, abonnements, séances.',          status: 'soon',  color: '#EA580C', accentColor: '#0EA5E9', sector: 'Sport' },
  { key: 'autoecole',  name: 'Auto-école · Permis',       emoji: '🚗',  icon: Car,             tagline: 'Passe ton permis',                      description: 'Élèves, leçons code/conduite, examens.',                status: 'soon',  color: '#0EA5E9', accentColor: '#F59E0B', sector: 'Formation' },
];

// ── Themes (8) ─────────────────────────────────────────────────────────────────
interface Theme {
  key: string;
  name: string;
  emoji: string;
  tagline: string;
  primary: string; primaryDeep: string;
  accent:  string; accentDeep:  string;
  bestFor: string[];
}
const THEMES: Theme[] = [
  { key: 'royal_bordeaux', name: 'Royal Bordeaux',     emoji: '🏛️', tagline: "L'élégance hôtelière",      primary: '#7C2D12', primaryDeep: '#5C1D0A', accent: '#A16207', accentDeep: '#854D0E', bestFor: ['hotel', 'restaurant', 'cabinet'] },
  { key: 'concept_store',  name: 'Concept Store',      emoji: '🛍️', tagline: "L'audace créative",          primary: '#EA580C', primaryDeep: '#C2410C', accent: '#312E81', accentDeep: '#1E1B4B', bestFor: ['boutique', 'restaurant'] },
  { key: 'sapphire_luxe',  name: 'Sapphire Luxe',      emoji: '💎', tagline: 'Le prestige institutionnel', primary: '#1E3A8A', primaryDeep: '#1E40AF', accent: '#D4A017', accentDeep: '#B45309', bestFor: ['immobilier', 'cabinet', 'residence'] },
  { key: 'emerald_wellness', name: 'Émeraude Wellness', emoji: '🌿', tagline: 'La sérénité naturelle',     primary: '#065F46', primaryDeep: '#064E3B', accent: '#D97706', accentDeep: '#B45309', bestFor: ['pharmacie', 'cabinet', 'salon'] },
  { key: 'sunset_tropical', name: 'Sunset Tropical',   emoji: '🔥', tagline: 'L\'éclat des lagunes',       primary: '#E11D48', primaryDeep: '#BE123C', accent: '#06B6D4', accentDeep: '#0891B2', bestFor: ['hotel', 'restaurant', 'boutique'] },
  { key: 'minimal_noir',   name: 'Minimaliste Noir',   emoji: '🖤', tagline: 'La pureté graphique',        primary: '#0A0A0A', primaryDeep: '#000000', accent: '#B45309', accentDeep: '#92400E', bestFor: ['boutique', 'cabinet'] },
  { key: 'tech_vibrant',   name: 'Tech Vibrant',       emoji: '⚡', tagline: "L'énergie numérique",        primary: '#7C3AED', primaryDeep: '#5B21B6', accent: '#06B6D4', accentDeep: '#0891B2', bestFor: ['ecole', 'fitness'] },
  { key: 'pastel_beaute',  name: 'Pastel Beauté',      emoji: '🌸', tagline: 'La délicatesse féminine',    primary: '#DB2777', primaryDeep: '#BE185D', accent: '#8B5CF6', accentDeep: '#7C3AED', bestFor: ['salon', 'boutique'] },
];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  .studio * { box-sizing: border-box; }
  .studio { font-family: 'Inter', sans-serif; min-height: 100vh; background: ${N.bgDeep}; color: ${N.cream}; }
  .studio .display-font { font-family: 'Fraunces', serif; letter-spacing: -0.02em; }
  .studio .mono-font { font-family: 'JetBrains Mono', monospace; }
  .studio .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .studio .grid-tpl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .studio .grid-thm { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .studio .card { background: rgba(255,250,240,.04); backdrop-filter: blur(20px); border: 1px solid rgba(255,250,240,.08); border-radius: 18px; padding: 18px; cursor: pointer; transition: all 0.25s ease; }
  .studio .card:hover { transform: translateY(-3px); background: rgba(255,250,240,.08); border-color: rgba(255,250,240,.18); }
  .studio .card.sel { background: ${N.cream}; color: ${N.ink}; border-color: ${N.cream}; transform: translateY(-3px); }
  /* Light-background inputs — clearer than the dark transparent variant for
     users who reported flou/illegible text on the dark studio canvas. */
  .studio .input { background: #FFFFFF; border: 1.5px solid rgba(0,0,0,.12); border-radius: 12px; padding: 12px 14px; color: ${N.ink}; font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 700; outline: none; width: 100%; caret-color: ${N.emeraldDeep}; -webkit-text-fill-color: ${N.ink}; box-shadow: 0 4px 14px -6px rgba(0,0,0,.2); }
  .studio .input:focus { border-color: ${N.emerald}; box-shadow: 0 0 0 3px rgba(16,185,129,.22), 0 4px 14px -6px rgba(0,0,0,.25); }
  .studio .input::placeholder { color: ${N.inkLight}; font-weight: 500; }
  /* Override browser autofill (Chrome/Edge) which else paints inputs yellow */
  .studio .input:-webkit-autofill, .studio .input:-webkit-autofill:focus { -webkit-box-shadow: 0 0 0 1000px #FFFFFF inset, 0 4px 14px -6px rgba(0,0,0,.2); -webkit-text-fill-color: ${N.ink}; caret-color: ${N.emeraldDeep}; }
  .studio .btn-primary { background: ${N.cream}; color: ${N.ink}; border: none; padding: 13px 22px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-family: inherit; transition: transform .15s; }
  .studio .btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
  .studio .btn-primary:disabled { opacity: .4; cursor: not-allowed; }
  .studio .btn-ghost { background: rgba(255,250,240,.08); color: ${N.cream}; border: 1px solid rgba(255,250,240,.15); padding: 11px 18px; border-radius: 11px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
  .studio .btn-yellow { background: ${N.yellow}; color: ${N.ink}; border: none; padding: 13px 22px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-family: inherit; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .fade { animation: fadeIn 0.35s ease-out; }
  @keyframes pulse { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(1.6); opacity: 0; } }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${N.emerald}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${N.emerald}; opacity: .4; animation: pulse 1.8s infinite; }
  @media (max-width: 900px) {
    .studio .grid-tpl { grid-template-columns: repeat(2, 1fr) !important; }
    .studio .grid-thm { grid-template-columns: repeat(2, 1fr) !important; }
  }
  @media (max-width: 600px) {
    .studio .grid-tpl, .studio .grid-thm { grid-template-columns: 1fr !important; }
  }
`;

function slugify(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// ── Top progress bar ─────────────────────────────────────────────────────────
function TopBar({ step, onClose }: { step: number; onClose: () => void }) {
  const steps = [
    { num: 1, label: 'Métier',    sub: 'Que fais-tu ?' },
    { num: 2, label: 'Style',     sub: 'Ton apparence' },
    { num: 3, label: 'Identité',  sub: 'Nom & logo' },
    { num: 4, label: 'Domaine',   sub: 'Ton adresse web' },
    { num: 5, label: 'Lancement', sub: '🚀 Go !' },
  ];
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,79,60,.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,250,240,.08)', padding: '14px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, #EA580C, #312E81)`, color: N.cream, fontFamily: 'Fraunces, serif', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>O</div>
          <div>
            <div className="display-font" style={{ fontWeight: 800, fontSize: 16 }}>
              Orlode <em style={{ fontStyle: 'italic' }}>Studio</em>
            </div>
            <div className="mono-font" style={{ fontSize: 10, color: N.onGreenSoft, letterSpacing: '0.1em' }}>ONBOARDING WORKSPACE</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 280 }}>
          {steps.map((s, i) => {
            const done = step > s.num;
            const active = step === s.num;
            return (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: done ? `linear-gradient(135deg, ${N.emerald}, ${N.emeraldDeep})` : (active ? `linear-gradient(135deg, #EA580C, #C2410C)` : 'rgba(255,250,240,.08)'),
                  color: (done || active) ? N.cream : N.onGreenSoft,
                  border: active ? `2px solid ${N.cream}` : '1px solid rgba(255,250,240,.12)',
                  fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>{done ? <Check size={14} strokeWidth={3} /> : s.num}</div>
                <div className="hide-on-mobile" style={{ display: 'none' }}>{s.label}</div>
                {i < steps.length - 1 && (
                  <div style={{ width: 22, height: 2, background: step > s.num ? N.emerald : 'rgba(255,250,240,.1)' }} />
                )}
              </div>
            );
          })}
        </div>
        <button onClick={onClose} className="btn-ghost" style={{ padding: '7px 12px' }}>
          <X size={13} /> Quitter
        </button>
      </div>
    </header>
  );
}

// ── Step 1: Template ─────────────────────────────────────────────────────────
function Step1Template({ selected, onSelect, onNext }: { selected: string | null; onSelect: (k: string) => void; onNext: () => void }) {
  const [filter, setFilter] = useState<'all' | 'ready' | 'soon'>('all');
  const list = TEMPLATES.filter(t => filter === 'all' ? true : t.status === filter);
  const canNext = selected && TEMPLATES.find(t => t.key === selected)?.status === 'ready';
  return (
    <div className="fade" style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span className="pill" style={{ background: 'rgba(255,250,240,.08)', color: N.cream, border: '1px solid rgba(255,250,240,.15)', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', marginBottom: 10 }}>
          <Sparkles size={11} color={N.yellow} /> ÉTAPE 1 · TON MÉTIER
        </span>
        <h1 className="display-font" style={{ fontSize: 44, fontWeight: 800, margin: '0 0 8px' }}>
          Tu es <em style={{ fontStyle: 'italic', color: N.yellow }}>quoi</em> ?
        </h1>
        <p style={{ fontSize: 14, color: N.onGreenSoft, margin: '0 auto', maxWidth: 540, lineHeight: 1.5 }}>
          Choisis ton template. Ton workspace sera <strong style={{ color: N.cream }}>pré-configuré</strong> avec les bons modules.
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {([
          { id: 'all',   label: 'Tous',        count: TEMPLATES.length },
          { id: 'ready', label: 'Disponibles', count: TEMPLATES.filter(t => t.status === 'ready').length },
          { id: 'soon',  label: 'Bientôt',     count: TEMPLATES.filter(t => t.status === 'soon').length },
        ] as const).map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: active ? 'rgba(255,250,240,.15)' : 'rgba(255,250,240,.04)',
              color: active ? N.cream : N.onGreenSoft,
              padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: active ? '1px solid rgba(255,250,240,.3)' : '1px solid rgba(255,250,240,.08)',
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {f.label}
              <span className="mono-font" style={{ background: active ? 'rgba(255,250,240,.2)' : 'rgba(255,250,240,.06)', padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800 }}>{f.count}</span>
            </button>
          );
        })}
      </div>
      <div className="grid-tpl">
        {list.map(t => {
          const isSel = selected === t.key;
          const isReady = t.status === 'ready';
          const Icon = t.icon;
          return (
            <div key={t.key} onClick={() => isReady && onSelect(t.key)} className={`card ${isSel ? 'sel' : ''}`} style={{
              opacity: isReady ? 1 : 0.7, cursor: isReady ? 'pointer' : 'not-allowed',
              borderColor: isSel ? t.color : undefined,
              boxShadow: isSel ? `0 20px 50px -20px ${t.color}80` : 'none',
              position: 'relative',
            }}>
              {!isReady && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(28,20,16,.85)', color: N.yellow, padding: '3px 9px', borderRadius: 100, fontSize: 9, fontWeight: 800, letterSpacing: '0.05em' }}>
                  BIENTÔT
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 32 }}>{t.emoji}</div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.color}25`, color: isSel ? t.color : t.accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} />
                </div>
              </div>
              <h3 className="display-font" style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px', color: isSel ? N.ink : N.cream }}>{t.name}</h3>
              <div className="mono-font" style={{ fontSize: 10, fontWeight: 700, color: isSel ? t.color : N.onGreenSoft, marginBottom: 8, letterSpacing: '0.03em' }}>{t.tagline}</div>
              <p style={{ fontSize: 12, color: isSel ? N.inkSoft : 'rgba(255,250,240,.65)', margin: 0, lineHeight: 1.5 }}>{t.description}</p>
              <div className="mono-font" style={{ fontSize: 9, color: isSel ? N.inkLight : 'rgba(255,250,240,.5)', marginTop: 10, letterSpacing: '0.05em' }}>{t.sector}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button onClick={onNext} disabled={!canNext} className="btn-primary">
          Continuer <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Theme ────────────────────────────────────────────────────────────
function Step2Theme({ template, selected, onSelect, onNext, onBack }: { template: string; selected: string | null; onSelect: (k: string) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div className="fade" style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span className="pill" style={{ background: 'rgba(255,250,240,.08)', color: N.cream, border: '1px solid rgba(255,250,240,.15)', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', marginBottom: 10 }}>
          <Sparkles size={11} color={N.yellow} /> ÉTAPE 2 · TON STYLE
        </span>
        <h1 className="display-font" style={{ fontSize: 44, fontWeight: 800, margin: '0 0 8px' }}>
          Quel <em style={{ fontStyle: 'italic', color: N.yellow }}>style</em> ?
        </h1>
        <p style={{ fontSize: 14, color: N.onGreenSoft, margin: '0 auto', maxWidth: 540 }}>
          Couleurs, typo, ambiance — appliqué partout (page publique, emails, factures).
        </p>
      </div>
      <div className="grid-thm">
        {THEMES.map(t => {
          const isSel = selected === t.key;
          const recommended = t.bestFor.includes(template);
          return (
            <div key={t.key} onClick={() => onSelect(t.key)} className={`card ${isSel ? 'sel' : ''}`} style={{
              borderColor: isSel ? t.primary : undefined,
              boxShadow: isSel ? `0 20px 50px -20px ${t.primary}80` : 'none',
              position: 'relative',
            }}>
              {recommended && (
                <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 800, background: N.yellow, color: N.ink, padding: '2px 7px', borderRadius: 6, letterSpacing: '0.05em' }}>
                  ⭐ RECOMMANDÉ
                </div>
              )}
              <div style={{ height: 70, borderRadius: 11, background: `linear-gradient(135deg, ${t.primary} 0%, ${t.accent} 50%, ${t.primaryDeep} 100%)`, marginBottom: 10 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{t.emoji}</span>
                <h3 className="display-font" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: isSel ? N.ink : N.cream }}>{t.name}</h3>
              </div>
              <p style={{ fontSize: 11, color: isSel ? N.inkSoft : N.onGreenSoft, margin: 0, fontStyle: 'italic' }}>{t.tagline}</p>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onBack} className="btn-ghost"><ChevronLeft size={14} /> Retour</button>
        <button onClick={onNext} disabled={!selected} className="btn-primary">Continuer <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

// ── Step 3: Identity ─────────────────────────────────────────────────────────
function Step3Identity({ identity, setIdentity, onNext, onBack }: {
  identity: { name: string; slug: string; phone: string; logo: string | null };
  setIdentity: (i: any) => void;
  onNext: () => void; onBack: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const onName = (v: string) => setIdentity({ ...identity, name: v, slug: identity.slug || slugify(v) });
  const onLogoFile = (file: File) => {
    if (file.size > 4 * 1024 * 1024) { toast.error('Image trop lourde', 'Max 4 MB'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result ?? '');
      try {
        // Real upload → Firebase Storage public URL on the company doc
        const r: any = await api.post('/company/upload-logo', {
          imageBase64: dataUrl.replace(/^data:image\/[^;]+;base64,/, ''),
          imageMimeType: file.type,
        });
        const url = r?.data?.data?.url ?? r?.data?.url;
        setIdentity({ ...identity, logo: url ?? dataUrl });
        toast.success('Logo uploadé !');
      } catch (e: any) {
        // Fall back to dataURL preview so the user can still continue
        setIdentity({ ...identity, logo: dataUrl });
        toast.info('Aperçu local', 'Upload réel échoué, on continue avec l\'aperçu.');
      } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };
  const canNext = identity.name.trim().length >= 2 && identity.slug.trim().length >= 2 && !uploading;
  return (
    <div className="fade" style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span className="pill" style={{ background: 'rgba(255,250,240,.08)', color: N.cream, border: '1px solid rgba(255,250,240,.15)', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', marginBottom: 10 }}>
          <Sparkles size={11} color={N.yellow} /> ÉTAPE 3 · TON IDENTITÉ
        </span>
        <h1 className="display-font" style={{ fontSize: 44, fontWeight: 800, margin: '0 0 8px' }}>
          Comment tu <em style={{ fontStyle: 'italic', color: N.yellow }}>t'appelles</em> ?
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: N.onGreenSoft, letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>NOM DE L'ENSEIGNE</label>
          <input className="input" value={identity.name} onChange={e => onName(e.target.value)} placeholder="Ex : Chez Malou" maxLength={60} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: N.onGreenSoft, letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>SLUG (URL · auto)</label>
          <input className="input" value={identity.slug} onChange={e => setIdentity({ ...identity, slug: slugify(e.target.value) })} placeholder="chez-malou" />
          <div style={{ fontSize: 10, color: N.onGreenSoft, marginTop: 4 }}>Servira pour ton site → orlode.com/shop/<strong style={{ color: N.cream }}>{identity.slug || 'ton-slug'}</strong></div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: N.onGreenSoft, letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}><Phone size={11} style={{ display: 'inline', marginRight: 4 }} /> WHATSAPP OWNER</label>
          <input className="input" value={identity.phone} onChange={e => setIdentity({ ...identity, phone: e.target.value })} placeholder="+225 07 XX XX XX XX" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: N.onGreenSoft, letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>LOGO</label>
          {identity.logo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,250,240,.06)', padding: 12, borderRadius: 12 }}>
              <img src={identity.logo} alt="logo" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Logo {identity.logo.startsWith('http') ? 'sauvegardé sur le cloud' : 'uploadé'}</div>
                <div style={{ fontSize: 11, color: N.onGreenSoft }}>{identity.logo.startsWith('http') ? 'URL publique générée — utilisée partout' : 'Aperçu local — sera uploadé au lancement'}</div>
              </div>
              <button onClick={() => setIdentity({ ...identity, logo: null })} className="btn-ghost" style={{ padding: '7px 12px' }}>
                <X size={12} /> Retirer
              </button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,250,240,.04)', border: '1.5px dashed rgba(255,250,240,.2)', padding: 16, borderRadius: 12, cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? <RefreshCw size={20} color={N.yellow} className="slow-rotate" /> : <Camera size={20} color={N.yellow} />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{uploading ? 'Upload en cours…' : 'Upload ton logo'}</div>
                <div style={{ fontSize: 11, color: N.onGreenSoft }}>PNG ou JPG · max 4 MB · uploadé sur Firebase Storage</div>
              </div>
              <input type="file" accept="image/*" hidden disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) onLogoFile(f); }} />
            </label>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onBack} className="btn-ghost"><ChevronLeft size={14} /> Retour</button>
        <button onClick={onNext} disabled={!canNext} className="btn-primary">Continuer <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

// ── Step 4: Domain ───────────────────────────────────────────────────────────
function Step4Domain({ identity, domainConfig, setDomainConfig, onNext, onBack }: {
  identity: { slug: string };
  domainConfig: { type: 'subdomain' | 'custom'; subdomain: string; customDomain: string };
  setDomainConfig: (d: any) => void;
  onNext: () => void; onBack: () => void;
}) {
  const subdomain = `${identity.slug || 'tonslug'}.orlode.com`;
  useEffect(() => { setDomainConfig({ ...domainConfig, subdomain }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [identity.slug]);
  const isCustom = domainConfig.type === 'custom';
  return (
    <div className="fade" style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span className="pill" style={{ background: 'rgba(255,250,240,.08)', color: N.cream, border: '1px solid rgba(255,250,240,.15)', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', marginBottom: 10 }}>
          <Globe size={11} color={N.yellow} /> ÉTAPE 4 · TON DOMAINE
        </span>
        <h1 className="display-font" style={{ fontSize: 44, fontWeight: 800, margin: '0 0 8px' }}>
          Quelle <em style={{ fontStyle: 'italic', color: N.yellow }}>adresse</em> ?
        </h1>
        <p style={{ fontSize: 14, color: N.onGreenSoft, margin: '0 auto', maxWidth: 540 }}>
          Tu peux commencer avec un sous-domaine gratuit, ou brancher ton propre nom de domaine.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <div onClick={() => setDomainConfig({ ...domainConfig, type: 'subdomain' })} className="card" style={{ borderColor: !isCustom ? N.cream : undefined, background: !isCustom ? 'rgba(255,250,240,.1)' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${!isCustom ? N.cream : 'rgba(255,250,240,.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!isCustom && <div style={{ width: 8, height: 8, borderRadius: '50%', background: N.cream }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong>Sous-domaine Orlode</strong>
                <span className="pill" style={{ background: N.emerald, color: N.cream, fontSize: 9, fontWeight: 800 }}>GRATUIT</span>
              </div>
              <div className="mono-font" style={{ fontSize: 12, color: N.yellow, marginTop: 4 }}>{subdomain}</div>
              <div style={{ fontSize: 11, color: N.onGreenSoft, marginTop: 2 }}>SSL inclus · prêt instantanément</div>
            </div>
          </div>
        </div>

        <div onClick={() => setDomainConfig({ ...domainConfig, type: 'custom' })} className="card" style={{ borderColor: isCustom ? N.cream : undefined, background: isCustom ? 'rgba(255,250,240,.1)' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isCustom ? N.cream : 'rgba(255,250,240,.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isCustom && <div style={{ width: 8, height: 8, borderRadius: '50%', background: N.cream }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong>Mon propre domaine</strong>
                <span className="pill" style={{ background: N.yellow, color: N.ink, fontSize: 9, fontWeight: 800 }}>
                  <Crown size={9} /> BUSINESS
                </span>
              </div>
              <div style={{ fontSize: 11, color: N.onGreenSoft, marginTop: 4 }}>Tu as déjà un domaine (OVH, GoDaddy, etc) — on le branche.</div>
              {isCustom && (
                <input className="input" style={{ marginTop: 10 }} value={domainConfig.customDomain} onChange={e => setDomainConfig({ ...domainConfig, customDomain: e.target.value.toLowerCase() })} placeholder="mondomaine.ci" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onBack} className="btn-ghost"><ChevronLeft size={14} /> Retour</button>
        <button onClick={onNext} className="btn-primary">Continuer <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

// ── Step 5: Launch ───────────────────────────────────────────────────────────
const PUBLIC_PATH_MAP: Record<string, string> = {
  boutique: 'shop', restaurant: 'menu', hotel: 'hotel',
  residence: 'residence', service: 'salon', cabinet: 'cabinet', realestate: 'biens',
};

function Step5Launch({ template, theme, identity, domainConfig, onBack }: {
  template: string; theme: string;
  identity: { name: string; slug: string; phone: string; logo: string | null };
  domainConfig: { type: 'subdomain' | 'custom'; subdomain: string; customDomain: string };
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const t = TEMPLATES.find(x => x.key === template)!;
  const th = THEMES.find(x => x.key === theme)!;
  const [launching, setLaunching] = useState(false);
  const [done, setDone] = useState(false);
  const [createdStoreSlug, setCreatedStoreSlug] = useState<string | null>(null);

  const launch = async () => {
    if (!t.businessType) { toast.error('Template indisponible', 'Bientôt disponible.'); return; }
    setLaunching(true);
    try {
      // 1) Save company-level branding (real persisted state)
      await api.patch('/company', {
        name: identity.name,
        logoUrl: identity.logo ?? undefined,
        theme: theme,
        ...(domainConfig.type === 'custom' && domainConfig.customDomain
          ? { customDomain: domainConfig.customDomain, customStatus: 'verifying' }
          : {}),
      });

      // 2) Create the pack store and capture the server-generated slug
      const storeRes: any = await api.post('/commerce/stores', {
        name: identity.name,
        ownerPhone: identity.phone,
        businessType: t.businessType,
      });
      const store = storeRes?.data?.store ?? storeRes?.data?.data?.store ?? null;
      const slug: string | undefined = store?.slug ?? identity.slug;
      if (slug) setCreatedStoreSlug(slug);

      setDone(true);
      toast.success('Workspace créé !', `${identity.name} est en ligne.`);
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message ?? 'Lancement impossible.');
    } finally {
      setLaunching(false);
    }
  };

  // Build the real public URL once we have the slug — uses our actual app's
  // public routes (`/shop/:slug`, `/menu/:slug`, etc.), so the user can share
  // this link today, no DNS or SSL setup required.
  const publicUrl = useMemo(() => {
    const slug = createdStoreSlug ?? identity.slug;
    if (!slug || !t.businessType) return null;
    const path = PUBLIC_PATH_MAP[t.businessType] ?? 'shop';
    if (typeof window !== 'undefined') return `${window.location.origin}/${path}/${slug}`;
    return `https://orlode.com/${path}/${slug}`;
  }, [createdStoreSlug, identity.slug, t.businessType]);

  if (done) {
    return (
      <div className="fade" style={{ maxWidth: 600, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ width: 100, height: 100, borderRadius: 26, background: `linear-gradient(135deg, ${th.primary}, ${th.accent})`, color: N.cream, fontFamily: 'Fraunces, serif', fontWeight: 800, fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: `0 20px 40px -14px ${th.primary}` }}>
          {identity.name[0]?.toUpperCase() || 'O'}
        </div>
        <span className="pill" style={{ background: 'rgba(255,250,240,.2)', color: N.cream, border: `1px solid ${th.accent}50`, fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', marginBottom: 16 }}>
          <CheckCircle2 size={12} color={N.emerald} /> WORKSPACE CRÉÉ
        </span>
        <h1 className="display-font" style={{ fontSize: 44, fontWeight: 800, margin: '0 0 12px' }}>
          Bienvenue chez<br /><em style={{ fontStyle: 'italic', color: N.yellow }}>{identity.name}</em> !
        </h1>
        <p style={{ fontSize: 15, color: N.onGreenSoft, margin: '0 auto 16px', maxWidth: 480, lineHeight: 1.5 }}>
          Ton workspace Orlode est en ligne. <strong style={{ color: N.cream }}>Active WhatsApp & Telegram</strong> pour recevoir tes premiers messages.
        </p>
        {publicUrl && (
          <div style={{ background: 'rgba(255,250,240,.1)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, border: '1px solid rgba(255,250,240,.2)', display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Globe size={14} color={N.yellow} />
            <span style={{ fontSize: 11, fontWeight: 700, color: N.onGreenSoft, letterSpacing: '0.06em' }}>URL PUBLIQUE ACTIVE :</span>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="mono-font" style={{ fontSize: 12, color: N.cream, textDecoration: 'underline', fontWeight: 700 }}>
              {publicUrl}
            </a>
            <button onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Lien copié'); }} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 10 }}>
              <Copy size={10} /> Copier
            </button>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate(t.packPath ?? '/dashboard')} className="btn-primary">
            <LayoutDashboard size={14} /> Ouvrir mon Dashboard
          </button>
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="btn-ghost"><Globe size={13} /> Voir mon site public <ExternalLink size={11} /></button>
            </a>
          )}
        </div>
      </div>
    );
  }

  const finalDomain = domainConfig.type === 'custom' ? domainConfig.customDomain : domainConfig.subdomain;

  return (
    <div className="fade" style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span className="pill" style={{ background: 'rgba(255,250,240,.08)', color: N.cream, border: '1px solid rgba(255,250,240,.15)', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', marginBottom: 10 }}>
          <Rocket size={11} color={N.yellow} /> ÉTAPE 5 · LANCEMENT
        </span>
        <h1 className="display-font" style={{ fontSize: 44, fontWeight: 800, margin: '0 0 8px' }}>
          Prêt à <em style={{ fontStyle: 'italic', color: N.yellow }}>décoller</em> ?
        </h1>
        <p style={{ fontSize: 14, color: N.onGreenSoft }}>Récapitulatif avant lancement.</p>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        {[
          { label: 'Métier',   value: `${t.emoji} ${t.name}` },
          { label: 'Style',    value: `${th.emoji} ${th.name}` },
          { label: 'Enseigne', value: identity.name },
          { label: 'Slug',     value: identity.slug },
          { label: 'WhatsApp', value: identity.phone || '(non renseigné)' },
          { label: 'Domaine',  value: finalDomain || '(non configuré)' },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 5 ? '1px solid rgba(255,250,240,.08)' : 'none' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: N.onGreenSoft, letterSpacing: '0.05em' }}>{r.label.toUpperCase()}</span>
            <span className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: N.cream }}>{r.value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <button onClick={onBack} disabled={launching} className="btn-ghost"><ChevronLeft size={14} /> Retour</button>
        <button onClick={launch} disabled={launching} className="btn-yellow" style={{ minWidth: 200, justifyContent: 'center' }}>
          {launching ? <><RefreshCw size={14} className="slow-rotate" /> Lancement…</> : <><Rocket size={14} /> Lancer mon workspace</>}
        </button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function StudioPage() {
  const navigate = useNavigate();
  const company = useAuthStore(s => s.company);
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [identity, setIdentity] = useState({ name: company?.name ?? '', slug: '', phone: '', logo: null as string | null });
  const [domainConfig, setDomainConfig] = useState({ type: 'subdomain' as 'subdomain' | 'custom', subdomain: '', customDomain: '' });

  useEffect(() => {
    if (company?.name && !identity.name) setIdentity(i => ({ ...i, name: company.name, slug: slugify(company.name) }));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [company?.name]);

  const close = () => {
    if (confirm('Quitter le Studio ? Tes choix seront perdus.')) navigate('/dashboard');
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="studio">
        <TopBar step={step} onClose={close} />
        {step === 1 && <Step1Template selected={template} onSelect={setTemplate} onNext={() => setStep(2)} />}
        {step === 2 && template && <Step2Theme template={template} selected={theme} onSelect={setTheme} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <Step3Identity identity={identity} setIdentity={setIdentity} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <Step4Domain identity={identity} domainConfig={domainConfig} setDomainConfig={setDomainConfig} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
        {step === 5 && template && theme && <Step5Launch template={template} theme={theme} identity={identity} domainConfig={domainConfig} onBack={() => setStep(4)} />}
      </div>
    </>
  );
}
