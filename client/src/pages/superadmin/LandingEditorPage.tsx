/**
 * LandingEditorPage — SuperAdmin CMS for the public landing page
 * Edit hero, videos, agents, marketplace, testimonials, pricing, etc.
 */
import { useEffect, useState } from 'react';
import {
  Loader2, Save, CheckCircle, Plus, Trash2, Video, MessageSquare,
  Users, Star, DollarSign, Type, Image, Globe, ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '@/services/api';

interface LandingContent {
  // Hero
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  heroCta1: string;
  heroCta2: string;
  heroNote: string;
  // Videos
  video1Url: string;
  video1Label: string;
  video2Url: string;
  video2Label: string;
  // Stats
  stats: { value: string; label: string }[];
  // Testimonials
  testimonials: { name: string; role: string; text: string; avatar: string }[];
  // Marketplace agents showcase
  marketplaceAgents: { icon: string; name: string; desc: string; color: string; industry: string }[];
  // CTA
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButton: string;
}

const EMPTY: LandingContent = {
  heroBadge: '21 agents IA + marketplace d\'agents métier',
  heroTitle: 'Votre entreprise mérite une',
  heroHighlight: 'équipe IA complète.',
  heroSubtitle: '21 agents intégrés + un marketplace d\'agents par industrie. L\'IA qui s\'adapte à VOTRE entreprise.',
  heroCta1: 'Démarrer gratuitement',
  heroCta2: 'Voir la démo',
  heroNote: 'Pas de carte bancaire · Setup en 15 min · Plan Free disponible',
  video1Url: '', video1Label: 'Démo Orlode AI — 3 min',
  video2Url: '', video2Label: 'Témoignage client',
  stats: [
    { value: '21', label: 'Agents intégrés' },
    { value: '30+', label: 'Agents marketplace' },
    { value: '160+', label: 'Skills activables' },
    { value: '24/7', label: 'Toujours actif' },
  ],
  testimonials: [
    { name: 'Aminata D.', role: 'DG, AfriDigital', text: 'Orlode a remplacé 5 outils qu\'on payait séparément.', avatar: 'A' },
    { name: 'Thomas M.', role: 'CTO, TechCorp', text: 'L\'orchestrateur multi-agents est bluffant.', avatar: 'T' },
    { name: 'Fatou K.', role: 'RH, GreenTech', text: 'La gestion des congés automatisée nous fait gagner 10h/semaine.', avatar: 'F' },
  ],
  marketplaceAgents: [
    { icon: '🏥', name: 'Clinique IA', desc: 'Gestion patients, RDV, dossiers', color: '#EF4444', industry: 'Santé' },
    { icon: '🛒', name: 'E-Commerce IA', desc: 'Stock, commandes, analytics', color: '#F97316', industry: 'Commerce' },
    { icon: '🏗', name: 'BTP Manager', desc: 'Chantiers, devis, planning', color: '#78716C', industry: 'Construction' },
    { icon: '🌾', name: 'Agri Advisor', desc: 'Cultures, météo, diagnostics', color: '#16A34A', industry: 'Agriculture' },
    { icon: '🚗', name: 'Auto Mechanic', desc: 'Diagnostic OBD, devis', color: '#3B82F6', industry: 'Automobile' },
    { icon: '💇', name: 'Salon Beauty', desc: 'RDV, fidélité, soins', color: '#EC4899', industry: 'Beauté' },
  ],
  ctaTitle: 'Prêt à donner un cerveau IA à votre entreprise ?',
  ctaSubtitle: '21 agents + marketplace. Setup en 15 minutes.',
  ctaButton: 'Démarrer maintenant — c\'est gratuit',
};

const INPUT = 'w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const LABEL = 'block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1';

export default function LandingEditorPage() {
  const [content, setContent] = useState<LandingContent>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['hero']));

  useEffect(() => {
    api.get('/superadmin/landing')
      .then(r => {
        const d = r.data ?? r.data;
        if (d && typeof d === 'object') setContent(prev => ({ ...prev, ...d as Partial<LandingContent> }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/superadmin/landing', content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  const set = <K extends keyof LandingContent>(key: K, value: LandingContent[K]) =>
    setContent(prev => ({ ...prev, [key]: value }));

  const toggle = (s: string) => setOpenSections(prev => {
    const n = new Set(prev);
    if (n.has(s)) n.delete(s); else n.add(s);
    return n;
  });

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  return (
    <div className="p-6 max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Éditeur Landing Page</h1>
          <p className="text-sm text-gray-500">Modifiez le contenu de la page publique</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
          style={{ background: saved ? '#16a34a' : '#0055FF' }}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Sauvegarde...</>
           : saved ? <><CheckCircle size={14} /> Sauvegardé !</>
           : <><Save size={14} /> Sauvegarder</>}
        </button>
      </div>

      {/* ── HERO ──────────────────────────────────── */}
      <Section title="Hero" icon={<Type size={16} />} id="hero" open={openSections} toggle={toggle}>
        <div className="space-y-3">
          <div><label className={LABEL}>Badge</label><input className={INPUT} value={content.heroBadge} onChange={e => set('heroBadge', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Titre</label><input className={INPUT} value={content.heroTitle} onChange={e => set('heroTitle', e.target.value)} /></div>
            <div><label className={LABEL}>Mot en gradient</label><input className={INPUT} value={content.heroHighlight} onChange={e => set('heroHighlight', e.target.value)} /></div>
          </div>
          <div><label className={LABEL}>Sous-titre</label><textarea rows={2} className={INPUT} value={content.heroSubtitle} onChange={e => set('heroSubtitle', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Bouton 1</label><input className={INPUT} value={content.heroCta1} onChange={e => set('heroCta1', e.target.value)} /></div>
            <div><label className={LABEL}>Bouton 2</label><input className={INPUT} value={content.heroCta2} onChange={e => set('heroCta2', e.target.value)} /></div>
          </div>
          <div><label className={LABEL}>Note en bas</label><input className={INPUT} value={content.heroNote} onChange={e => set('heroNote', e.target.value)} /></div>
        </div>
      </Section>

      {/* ── VIDEOS ─────────────────────────────────── */}
      <Section title="Vidéos" icon={<Video size={16} />} id="videos" open={openSections} toggle={toggle}>
        <div className="space-y-3">
          <div><label className={LABEL}>Vidéo 1 — URL (YouTube/Vimeo embed)</label><input className={INPUT} value={content.video1Url} onChange={e => set('video1Url', e.target.value)} placeholder="https://www.youtube.com/embed/..." /></div>
          <div><label className={LABEL}>Vidéo 1 — Label</label><input className={INPUT} value={content.video1Label} onChange={e => set('video1Label', e.target.value)} /></div>
          <div><label className={LABEL}>Vidéo 2 — URL (YouTube/Vimeo embed)</label><input className={INPUT} value={content.video2Url} onChange={e => set('video2Url', e.target.value)} placeholder="https://www.youtube.com/embed/..." /></div>
          <div><label className={LABEL}>Vidéo 2 — Label</label><input className={INPUT} value={content.video2Label} onChange={e => set('video2Label', e.target.value)} /></div>
        </div>
      </Section>

      {/* ── STATS ──────────────────────────────────── */}
      <Section title="Chiffres clés" icon={<Star size={16} />} id="stats" open={openSections} toggle={toggle}>
        <div className="space-y-2">
          {content.stats.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={`${INPUT} w-24`} value={s.value} onChange={e => {
                const arr = [...content.stats]; arr[i] = { ...arr[i], value: e.target.value }; set('stats', arr);
              }} placeholder="21" />
              <input className={`${INPUT} flex-1`} value={s.label} onChange={e => {
                const arr = [...content.stats]; arr[i] = { ...arr[i], label: e.target.value }; set('stats', arr);
              }} placeholder="Agents intégrés" />
              <button onClick={() => set('stats', content.stats.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => set('stats', [...content.stats, { value: '', label: '' }])}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Plus size={12} /> Ajouter</button>
        </div>
      </Section>

      {/* ── TESTIMONIALS ───────────────────────────── */}
      <Section title="Témoignages" icon={<MessageSquare size={16} />} id="testimonials" open={openSections} toggle={toggle}>
        <div className="space-y-4">
          {content.testimonials.map((t, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-2 relative">
              <button onClick={() => set('testimonials', content.testimonials.filter((_, j) => j !== i))}
                className="absolute top-3 right-3 p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={LABEL}>Nom</label><input className={INPUT} value={t.name} onChange={e => {
                  const arr = [...content.testimonials]; arr[i] = { ...arr[i], name: e.target.value }; set('testimonials', arr);
                }} /></div>
                <div><label className={LABEL}>Poste</label><input className={INPUT} value={t.role} onChange={e => {
                  const arr = [...content.testimonials]; arr[i] = { ...arr[i], role: e.target.value }; set('testimonials', arr);
                }} /></div>
                <div><label className={LABEL}>Avatar (lettre)</label><input className={INPUT} value={t.avatar} maxLength={2} onChange={e => {
                  const arr = [...content.testimonials]; arr[i] = { ...arr[i], avatar: e.target.value }; set('testimonials', arr);
                }} /></div>
              </div>
              <div><label className={LABEL}>Témoignage</label><textarea rows={2} className={INPUT} value={t.text} onChange={e => {
                const arr = [...content.testimonials]; arr[i] = { ...arr[i], text: e.target.value }; set('testimonials', arr);
              }} /></div>
            </div>
          ))}
          <button onClick={() => set('testimonials', [...content.testimonials, { name: '', role: '', text: '', avatar: '' }])}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Plus size={12} /> Ajouter un témoignage</button>
        </div>
      </Section>

      {/* ── MARKETPLACE AGENTS ─────────────────────── */}
      <Section title="Agents Marketplace (showcase)" icon={<Users size={16} />} id="marketplace" open={openSections} toggle={toggle}>
        <div className="space-y-4">
          {content.marketplaceAgents.map((a, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-2 relative">
              <button onClick={() => set('marketplaceAgents', content.marketplaceAgents.filter((_, j) => j !== i))}
                className="absolute top-3 right-3 p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              <div className="grid grid-cols-4 gap-2">
                <div><label className={LABEL}>Emoji</label><input className={INPUT} value={a.icon} maxLength={4} onChange={e => {
                  const arr = [...content.marketplaceAgents]; arr[i] = { ...arr[i], icon: e.target.value }; set('marketplaceAgents', arr);
                }} /></div>
                <div><label className={LABEL}>Nom</label><input className={INPUT} value={a.name} onChange={e => {
                  const arr = [...content.marketplaceAgents]; arr[i] = { ...arr[i], name: e.target.value }; set('marketplaceAgents', arr);
                }} /></div>
                <div><label className={LABEL}>Industrie</label><input className={INPUT} value={a.industry} onChange={e => {
                  const arr = [...content.marketplaceAgents]; arr[i] = { ...arr[i], industry: e.target.value }; set('marketplaceAgents', arr);
                }} /></div>
                <div><label className={LABEL}>Couleur (#hex)</label><input className={INPUT} value={a.color} onChange={e => {
                  const arr = [...content.marketplaceAgents]; arr[i] = { ...arr[i], color: e.target.value }; set('marketplaceAgents', arr);
                }} /></div>
              </div>
              <div><label className={LABEL}>Description</label><input className={INPUT} value={a.desc} onChange={e => {
                const arr = [...content.marketplaceAgents]; arr[i] = { ...arr[i], desc: e.target.value }; set('marketplaceAgents', arr);
              }} /></div>
            </div>
          ))}
          <button onClick={() => set('marketplaceAgents', [...content.marketplaceAgents, { icon: '🤖', name: '', desc: '', color: '#3B82F6', industry: '' }])}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Plus size={12} /> Ajouter un agent</button>
        </div>
      </Section>

      {/* ── CTA ────────────────────────────────────── */}
      <Section title="CTA Final" icon={<Globe size={16} />} id="cta" open={openSections} toggle={toggle}>
        <div className="space-y-3">
          <div><label className={LABEL}>Titre</label><input className={INPUT} value={content.ctaTitle} onChange={e => set('ctaTitle', e.target.value)} /></div>
          <div><label className={LABEL}>Sous-titre</label><input className={INPUT} value={content.ctaSubtitle} onChange={e => set('ctaSubtitle', e.target.value)} /></div>
          <div><label className={LABEL}>Bouton</label><input className={INPUT} value={content.ctaButton} onChange={e => set('ctaButton', e.target.value)} /></div>
        </div>
      </Section>

      {/* Preview link */}
      <div className="text-center pt-4">
        <a href="/" target="_blank" rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline">Voir la landing (V2) →</a>
      </div>
    </div>
  );
}

function Section({ title, icon, id, open, toggle, children }: {
  title: string; icon: React.ReactNode; id: string;
  open: Set<string>; toggle: (s: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = open.has(id);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => toggle(id)} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors">
        <span className="text-blue-500">{icon}</span>
        <span className="text-sm font-bold text-gray-800 flex-1 text-left">{title}</span>
        {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {isOpen && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}
