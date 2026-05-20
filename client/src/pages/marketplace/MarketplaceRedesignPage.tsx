import React, { useState, useRef, useEffect, createContext, useContext, useMemo } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import { useCurrency } from '@/hooks/useCurrency';
import BoutiqueActivationWizard from '@/components/commerce/BoutiqueActivationWizard';
import {
  Search, Bell, ChevronDown, ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, ArrowUp,
  LayoutDashboard, MessageSquare, MessageCircle, Bot, UsersRound, Briefcase, Calendar,
  Store, Crown, Hammer, Plug, Settings, Shield, LogOut, Plus, Minus, Sparkles, Send,
  X, Heart, ShoppingCart, ShoppingBag, Package, PackageCheck, PackagePlus,
  Trash2, Tag, Filter, CheckCircle2, XCircle, Star, Flame, Zap, Clock, Eye, Download,
  Bookmark, BookmarkCheck, Award, Medal, Trophy, Gem,
  Globe, TrendingUp, Layers, LayoutGrid, Boxes,
  Rocket, Lightbulb, Smile, Building2, Scale,
  GraduationCap, Wrench, Coins, Banknote, Wallet, CreditCard,
  BadgeCheck, Loader2, CheckCheck, AlertCircle, Info,
  Users2, User, Mail, Phone, BarChart3, Activity, FileText,
  PlayCircle, Camera, Code2, GitBranch,
  Headphones, Megaphone, Edit3, Save, Copy, Share2, ExternalLink,
  Beaker, Truck, UtensilsCrossed, Coffee, Leaf, Sprout,
  Building, Factory, School,
} from 'lucide-react';

// ============ PALETTE — MARKETPLACE ============
const C = {
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  violet:      '#7C3AED',
  violetDeep:  '#5B21B6',
  violetDark:  '#4C1D95',
  violetSoft:  '#EDE9FE',
  violetLight: '#A78BFA',
  pink:        '#EC4899',
  pinkDeep:    '#DB2777',
  pinkSoft:    '#FCE7F3',
  gold:        '#D4A017',
  goldDeep:    '#B45309',
  goldLight:   '#F59E0B',
  goldSoft:    '#FEF3C7',
  emerald:     '#10B981',
  emeraldSoft: '#D1FAE5',
  emeraldDeep: '#059669',
  blue:        '#0EA5E9',
  blueSoft:    '#E0F2FE',
  blueDeep:    '#0284C7',
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  redDeep:     '#DC2626',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  cyan:        '#06B6D4',
  cyanSoft:    '#CFFAFE',
  cyanDeep:    '#0891B2',
  orange:      '#F97316',
  orangeSoft:  '#FFEDD5',
  orangeDeep:  '#EA580C',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  onGreenSoft: '#A8C9B8',
};

// ============ MARKETPLACE DATA CONTEXT ============
// Falls back to seed arrays below if API returns empty.
interface MarketplaceData {
  loading: boolean;
  agents: any[];
  bundles: any[];
  categories: any[];
  installedIds: Set<string>;
}
const MarketplaceCtx = createContext<MarketplaceData>({
  loading: true, agents: [], bundles: [], categories: [], installedIds: new Set(),
});
const useMarketplace = () => useContext(MarketplaceCtx);

// USD → FCFA conversion (1 USD ≈ 600 FCFA in CI)
const USD_TO_FCFA = 600;

// Map server agent → UI shape. Real installs/reviews/rating come from the server
// aggregation. When zero, `isNew: true` lets the UI show a "Nouveau" badge instead
// of a fake "0 installs · 0 reviews" line.
function mapServerAgent(s: any): any {
  const installs = Number(s.installs ?? 0);
  const reviews = Number(s.reviews ?? 0);
  const rating = typeof s.rating === 'number' ? s.rating : null;
  return {
    id: s.id ?? s.slug,
    name: s.name,
    emoji: s.icon ?? '🤖',
    color: s.color?.startsWith('from-') ? '#7C3AED' : (s.color ?? '#7C3AED'),
    category: s.category ?? s.industry?.toLowerCase() ?? 'commerce',
    desc: s.description ?? '',
    features: Array.isArray(s.features) ? s.features.slice(0, 3) : [],
    plan: s.pricingModel === 'free' ? 'free' : 'addon',
    installed: false,
    installs,
    rating,            // null when no review yet
    reviews,
    price: s.pricingModel === 'free' ? 0 : 5,    // unified $5/mo for individual agents
    currency: 'USD',
    period: 'mo',
    status: s.pricingModel === 'free' ? 'free' : 'addon',
    creator: s.creator ?? 'Orlode',
    africa: true,
    popular: installs > 50,
    trending: installs > 100,
    isNew: installs === 0 && reviews === 0,
    longDescription: s.longDescription,
    industry: s.industry,
    coverImage: s.coverImage ?? null,
    demoVideo: s.demoVideo ?? null,
    model3d: s.model3d ?? null,
    screenshots: Array.isArray(s.screenshots) ? s.screenshots : [],
    beta: !!s.beta,
  };
}

// Map server bundle → UI shape. Prices and agent count come from the server
// (most bundles are $20/4 agents, but the Super Pack Enterprise is $45/10 agents).
function mapServerBundle(b: any, agentMap: Map<string, any>): any {
  const agentObjs = (b.agents ?? []).map((ag: any) => agentMap.get(ag.id)).filter(Boolean);
  const installs = Number(b.installs ?? b.pickCount ?? 0);
  const reviews = Number(b.reviews ?? 0);
  const rating = typeof b.rating === 'number' ? b.rating : null;
  const agentCount = Number(b.agentCount ?? b.agents?.length ?? 4);
  const bundlePrice = Number(b.bundlePrice ?? 20);
  const originalPrice = Number(b.originalPrice ?? bundlePrice);
  const discount = Number(b.discount ?? 0);
  const exclusive = !!b.exclusive;
  return {
    id: b.id,
    name: b.name,
    tagline: b.description?.split(':')[1]?.trim() || b.description || '',
    desc: b.description ?? '',
    emoji: b.icon ?? '📦',
    // Super Pack uses gold/amber gradient to feel premium vs the violet of normal packs.
    color: exclusive ? '#D97706' : '#7C3AED',
    accentColor: exclusive ? '#FBBF24' : '#A78BFA',
    agentCount,
    agents: (b.agents ?? []).map((ag: any) => ag.icon ?? '🤖'),
    agentNames: (b.agents ?? []).map((ag: any) => ag.name),
    agentObjs,
    originalPrice,
    bundlePrice,
    discount,
    currency: 'USD',
    period: 'mo',
    byoe: true,
    category: b.agents?.[0]?.industry?.toLowerCase() ?? 'all',
    featured: !!b.hero || ['b2', 'b7', 'b10', 'b14', 'b15'].includes(b.id),
    hero: !!b.hero || ['b2', 'b7', 'b10', 'b14', 'b15'].includes(b.id),
    exclusive,
    africa: true,
    popular: !!b.popular || installs > 10,
    trending: installs > 50,
    installs,
    pickCount: installs,
    rating,
    reviews,
    isNew: installs === 0 && reviews === 0,
    isCustom: b.isCustom,
    coverImage: b.coverImage ?? agentObjs.find((a: any) => a?.coverImage)?.coverImage ?? null,
    beta: !!b.beta || agentObjs.some((a: any) => a?.beta),
  };
}

const CATEGORIES_FALLBACK = [
  { id: 'all', label: 'Toutes', emoji: '🌐', color: '#7C3AED', count: 47 },
  { id: 'restaurant', label: 'Restauration', emoji: '🍽️', color: '#F97316', count: 6 },
  { id: 'commerce', label: 'Commerce', emoji: '🛒', color: '#06B6D4', count: 5 },
  { id: 'sante', label: 'Santé', emoji: '🏥', color: '#EF4444', count: 4 },
  { id: 'education', label: 'Éducation', emoji: '🎓', color: '#0EA5E9', count: 4 },
  { id: 'agriculture', label: 'Agriculture', emoji: '🌾', color: '#10B981', count: 5 },
  { id: 'mode', label: 'Mode & Luxe', emoji: '👗', color: '#EC4899', count: 4 },
  { id: 'construction', label: 'BTP', emoji: '🏗️', color: '#D4A017', count: 3 },
  { id: 'securite', label: 'Sécurité', emoji: '🛡️', color: '#5B21B6', count: 4 },
  { id: 'finance', label: 'Finance', emoji: '💰', color: '#B45309', count: 5 },
  { id: 'beaute', label: 'Beauté', emoji: '💄', color: '#DB2777', count: 3 },
  { id: 'logistique', label: 'Logistique', emoji: '📦', color: '#0284C7', count: 2 },
];

// All packs follow the new BYOE model: 4 agents bundled at $20/mo.
// Each pack also exposes 3 suggested ADD-ONS at $5/mo each (referencing existing catalog agents by id).
const BUNDLES_FALLBACK: any[] = [
  { id: 'b1', name: 'Pack Santé', tagline: 'Tout pour le secteur médical', desc: 'Dossier patient, formation continue, validation prescriptions et base de connaissances médicale.', emoji: '🏥', color: '#EF4444', accentColor: '#FCA5A5', agentCount: 4, agents: ['💊', '🎓', '✅', '🧠'], agentNames: ['Agent Médical Pro', 'Agent Formation Santé', 'Agent Approbation', 'Agent Knowledge'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a1', 'a4', 'a5'], addonNames: ['Compta (facturation actes)', 'Communications (rappels patients)', 'Cybersécurité (RGPD santé)'], category: 'sante', featured: false, africa: true, popular: false, byoe: true },
  { id: 'b2', name: 'Pack Immobilier', tagline: 'Leads · Visites · WhatsApp · RDV', desc: 'Suite immobilière complète : qualification leads automatique (Sales), suivi des biens et visites virtuelles 360° (Immobilier), réponses WhatsApp instantanées (Communications), prise de RDV avec accueil sur place (Réception). Pipeline complet du prospect au signing.', emoji: '🏠', color: '#7C3AED', accentColor: '#C4B5FD', agentCount: 4, agents: ['🏠', '💼', '📧', '🚪'], agentNames: ['Agent Immobilier', 'Agent Sales', 'Agent Communications', 'Agent Réception'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a22', 'a1', 'a24'], addonNames: ['Marketing (campagnes)', 'Compta (factures clients)', 'Knowledge (catalogue biens)'], category: 'commerce', featured: true, africa: true, popular: true, byoe: true, hero: true },
  { id: 'b3', name: 'Pack Artisan', tagline: 'Idéal pour les artisans', desc: 'Menuiserie, dépannage, gestion chantier et comptabilité OHADA. Devis et factures auto.', emoji: '🔧', color: '#D4A017', accentColor: '#FCD34D', agentCount: 4, agents: ['🔨', '🔧', '👷', '💰'], agentNames: ['Agent Menuisier', 'Agent Dépannage', 'Agent Chantier', 'Agent Compta'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a4', 'a21', 'a2'], addonNames: ['Communications (clients)', 'Sales (lead capture)', 'Approbation (validation devis)'], category: 'construction', featured: false, africa: true, popular: true, byoe: true },
  { id: 'b4', name: 'Pack Agriculture', tagline: 'Agriculture complète', desc: 'Agronomie, élevage, topographie et comptabilité coopérative. Tout le cycle de la ferme.', emoji: '🌾', color: '#10B981', accentColor: '#86EFAC', agentCount: 4, agents: ['🌱', '🚜', '📐', '💰'], agentNames: ['Agent Agronomie', 'Agent Élevage', 'Agent Topographie', 'Agent Compta'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a4', 'a22', 'a21'], addonNames: ['Communications (coopérative)', 'Marketing (vente directe)', 'Sales (acheteurs)'], category: 'agriculture', featured: false, africa: true, popular: true, byoe: true },
  { id: 'b5', name: 'Pack Sécurité Totale', tagline: 'Protection maximale physique + cyber', desc: 'Gardes, caméras IA, communications chiffrées et SOC virtuel — protection 360°.', emoji: '🛡️', color: '#EF4444', accentColor: '#FCA5A5', agentCount: 4, agents: ['🛡️', '📹', '🔒', '🛡️'], agentNames: ['Agent Garde', 'Agent Vidéosurveillance', 'Agent Comm Sécurisée', 'Agent Cybersécurité'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a2', 'a24', 'a1'], addonNames: ['Approbation (workflows)', 'Knowledge (procédures)', 'Compta (sociétés gardiennage)'], category: 'securite', featured: false, africa: true, popular: false, byoe: true },
  { id: 'b6', name: 'Pack Sécurité Site', tagline: 'Sécurité physique de site', desc: 'Gardes site, caméra IA, cybersécurité périmétrique et workflows d\'approbation accès.', emoji: '🏛️', color: '#0EA5E9', accentColor: '#7DD3FC', agentCount: 4, agents: ['🛡️', '📹', '🛡️', '✅'], agentNames: ['Agent Garde Site', 'Agent Caméra IA', 'Agent Cybersécurité', 'Agent Approbation'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a4', 'a24', 'a1'], addonNames: ['Communications (alerts)', 'Knowledge (procédures site)', 'Compta'], category: 'securite', featured: false, africa: false, popular: false, byoe: true },
  { id: 'b7', name: 'Pack Restaurant', tagline: 'Réservations · Livraison · Messages clients · Fidélité', desc: 'Restaurant complet : commandes & réservations, accueil VIP en salle, livraison last-mile, programme fidélité. WhatsApp natif sur toute la chaîne — du menu au remerciement après le repas. BYOE — apporte ton IA et ton WhatsApp Business.', emoji: '🍽️', color: '#F97316', accentColor: '#FDBA74', agentCount: 4, agents: ['🍽️', '💄', '🚚', '💝'], agentNames: ['Agent Restaurant', 'Agent Accueil', 'Agent Livraison', 'Agent Fidélité'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a22', 'a1', 'a4'], addonNames: ['Marketing (promos saisonnières)', 'Compta (factures fournisseurs)', 'Communications (multi-canal)'], category: 'restaurant', featured: true, africa: true, popular: true, byoe: true, hero: true },
  { id: 'b8', name: 'Pack Mode & Luxe', tagline: 'Boutique mode complète', desc: 'Styliste IA, beauté, vente et campagnes marketing — pour les boutiques mode et concept stores.', emoji: '👗', color: '#EC4899', accentColor: '#F9A8D4', agentCount: 4, agents: ['👗', '💄', '💼', '📣'], agentNames: ['Agent Mode', 'Agent Beauté', 'Agent Sales', 'Agent Marketing'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a4', 'a1', 'a3'], addonNames: ['Communications (DMs Insta/WhatsApp)', 'Compta', 'Coach (formation vendeurs)'], category: 'mode', featured: false, africa: true, popular: true, byoe: true },
  { id: 'b9', name: 'Pack Éducation', tagline: 'Formation complète', desc: 'Enseignement, coaching, validation inscriptions et base de connaissances pédagogique.', emoji: '🎓', color: '#0EA5E9', accentColor: '#7DD3FC', agentCount: 4, agents: ['🎓', '🧠', '✅', '🧠'], agentNames: ['Agent Formateur', 'Agent Coach', 'Agent Approbation', 'Agent Knowledge'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a4', 'a1', 'a21'], addonNames: ['Communications (parents/élèves)', 'Compta (scolarité)', 'Sales (inscriptions)'], category: 'education', featured: false, africa: true, popular: false, byoe: true },
  { id: 'b10', name: 'Pack Entreprise', tagline: 'Ventes · Factures · Support · Communication interne', desc: 'Le pack tout-en-un pour piloter une PME : Sales pour les ventes, Comptabilité pour les factures, Support pour les clients, Communications pour le multi-canal interne et externe. Tout ton workspace IA dans un seul pack. BYOE — apporte ton IA et ton WhatsApp.', emoji: '🏢', color: '#06B6D4', accentColor: '#67E8F9', agentCount: 4, agents: ['💼', '💰', '📞', '📧'], agentNames: ['Agent Sales', 'Agent Comptabilité', 'Agent Support', 'Agent Communications'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a22', 'a24', 'a3'], addonNames: ['Marketing (campagnes)', 'Knowledge (RAG docs)', 'Coach (formation team)'], category: 'commerce', featured: true, africa: true, popular: true, byoe: true, hero: true },
  { id: 'b11', name: 'Pack Réception', tagline: 'Hub d\'accueil bureau · Kiosk IA · Badges', desc: 'Suite complète d\'accueil entreprise : enregistrement visiteurs, badges QR, kiosk tablette plein écran avec avatar IA Aïcha (voix Gemini Live), reconnaissance faciale matching serveur, notifications host multi-canal (in-app + WhatsApp + email magic-links), livraisons & fidélité visiteurs récurrents.', emoji: '🚪', color: '#0EA5E9', accentColor: '#7DD3FC', agentCount: 4, agents: ['🚪', '👋', '🚚', '💝'], agentNames: ['Agent Réception', 'Agent Accueil Visiteur', 'Agent Livraison', 'Agent Fidélité'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a4', 'a1', 'a5'], addonNames: ['Communications (multi-canal)', 'Compta (facturation visiteurs)', 'Cybersécurité (audit accès)'], category: 'commerce', featured: false, africa: true, popular: true, byoe: true },
  { id: 'b12', name: 'Pack RH', tagline: 'Effectifs · Congés · Paie · Onboarding', desc: 'Suite RH OHADA complète : 19 onglets HR (effectifs, congés, paie, performance, onboarding), Coach mentoring + burnout detection, Approval multi-niveaux pour validation managériale, Knowledge base RH (politiques, FAQ, contrats types).', emoji: '👩‍💼', color: '#4338CA', accentColor: '#A5B4FC', agentCount: 4, agents: ['👩‍💼', '🧠', '✅', '📚'], agentNames: ['Agent RH', 'Agent Coach', 'Agent Approbation', 'Agent Knowledge'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a1', 'a4', 'a5'], addonNames: ['Compta (paie & charges)', 'Communications (annonces RH)', 'Cybersécurité (data RH)'], category: 'finance', featured: false, africa: true, popular: true, byoe: true },
  { id: 'b13', name: 'Pack Cybersécurité', tagline: 'CISO virtuel · RGPD ready · Audit complet', desc: 'Suite sécurité PME complète : SIEM live + dashboard CISO (score, alertes, vulnérabilités), Compliance RGPD/ISO 27001/SOC 2/NIST CSF avec score live, Audit logs exportables CSV pour commissaires aux comptes, Approval workflows pour validations sensibles. Rapport sécurité 7-en-1 en 1 clic.', emoji: '🛡️', color: '#DC2626', accentColor: '#FCA5A5', agentCount: 4, agents: ['🛡️', '✅', '🔍', '📋'], agentNames: ['Agent Cybersécurité', 'Agent Compliance', 'Agent Audit', 'Agent Approbation'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a24', 'a1', 'a4'], addonNames: ['Knowledge (politiques)', 'Compta (audit financier)', 'Communications (alertes)'], category: 'securite', featured: false, africa: true, popular: true, byoe: true },
  // Pack PME — growth-focused 4-agent stack: ventes, comms, marketing, support
  { id: 'b15', name: 'Pack PME', tagline: 'Vente · Comms · Marketing · Support', desc: 'Le pack croissance pour les PME : ventes (CRM, pipeline), communications multi-canal (email/WhatsApp/Telegram), marketing (campagnes, ROI), support client (tickets, NPS). Tout pour scaler ton business.', emoji: '🚀', color: '#10B981', accentColor: '#6EE7B7', agentCount: 4, agents: ['💼', '📧', '📣', '🎫'], agentNames: ['Agent Sales', 'Agent Communications', 'Agent Marketing', 'Agent Support'], originalPrice: 20, bundlePrice: 20, discount: 0, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a1', 'a24', 'a23'], addonNames: ['Compta (factures clients)', 'Knowledge (FAQ auto)', 'Fidélité (rétention clients)'], category: 'all', featured: true, africa: true, popular: true, byoe: true, hero: true },
  // Super Pack Enterprise — flagship 10-agent stack at $45/mo (vs $60+ separate)
  { id: 'b14', name: 'Super Pack Entreprise', tagline: 'EXCLUSIF · 10 agents · Toute l\'entreprise', desc: 'La stack complète pour scaler ton entreprise : 10 agents flagship couvrant ventes, marketing, communications, support, comptabilité, RH, accueil visiteurs, cybersécurité, knowledge brain (RAG sur tous tes docs) et workflows d\'approbation. Tout dans un workspace IA unifié — l\'équivalent d\'une équipe complète à $45/mo.', emoji: '👑', color: '#D97706', accentColor: '#FBBF24', agentCount: 10, agents: ['💼', '📣', '📧', '🎫', '💰', '👥', '🚪', '🛡️', '📚', '✅'], agentNames: ['Agent Sales', 'Agent Marketing', 'Agent Communications', 'Agent Support', 'Agent Comptabilité', 'Agent RH', 'Agent Réception', 'Agent Cybersécurité', 'Agent Knowledge', 'Agent Approbation'], originalPrice: 60, bundlePrice: 45, discount: 25, currency: 'USD', period: 'mo', addonPrice: 5, addons: ['a6', 'a28', 'a29'], addonNames: ['Data Scientist (analytics cross-modules)', 'Compliance (RGPD/ISO)', 'Audit (logs exportables)'], category: 'all', featured: true, africa: true, popular: true, byoe: true, hero: true, exclusive: true },
];

const AGENTS_FALLBACK: any[] = [
  { id: 'a1', name: 'Comptabilité', emoji: '💰', color: '#D4A017', category: 'finance', desc: 'Comptabilité PRO: factures, P&L, aging, récurrentes, TVA, trésorerie, dépenses analytics', features: ['Factures CRUD', 'Récurrentes', 'Compte de résultat'], plan: 'addon', installed: true, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true },
  { id: 'a2', name: 'Approbation Engine', emoji: '✅', color: '#10B981', category: 'finance', desc: 'Vérification & approbation: chaînes multi-niveaux, escalade auto, review IA', features: ['Créer approbation', 'Approuver/Rejeter', 'En attente'], plan: 'addon', installed: true, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: false, popular: false },
  { id: 'a3', name: 'Coach', emoji: '🧠', color: '#7C3AED', category: 'education', desc: 'Coach PRO: plan carrière IA, mood tracking, burnout detection, 1-on-1 templates', features: ['Plan carrière', 'Mood tracking', 'Burnout detect'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: false, popular: false },
  { id: 'a4', name: 'Agent Communications', emoji: '📧', color: '#EC4899', category: 'commerce', desc: 'Emails, Telegram, WhatsApp, Slack, annonces, campagnes multi-canal. Inclus dans le Pack Commercial ($20/mo) avec Sales + Marketing — entonnoir complet attirer → nurturer → convertir.', features: ['Rédaction email IA', 'Multi-canal natif', 'Annonces internes', 'Templates'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, includedIn: 'b10', packLabel: 'Pack Commercial' },
  { id: 'a5', name: 'Cybersécurité', emoji: '🛡️', color: '#5B21B6', category: 'securite', desc: 'CISO virtuel: menaces, incidents, vulnérabilités, phishing, compliance, SIEM-lite', features: ['Score sécurité', 'Incidents Workflow', 'Vulnérabilités Scan'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: false, popular: false },
  { id: 'a6', name: 'Data Scientist', emoji: '🔬', color: '#06B6D4', category: 'finance', desc: 'Analyse cross-modules, corrélations, prédictions', features: ['Analyse cross-module', 'Corrélations', 'Predictions'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: false, popular: false },
  { id: 'a7', name: 'Agent Restaurant', emoji: '🍽️', color: '#F97316', category: 'restaurant', desc: 'Prise de commandes auto, gestion menu, table booking, livraison + WhatsApp. Inclus dans le Pack Restaurant ($20/mo).', features: ['Commandes auto', 'Menu IA', 'WhatsApp natif'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, trending: true, includedIn: 'b7', packLabel: 'Pack Restaurant' },
  { id: 'a8', name: 'Agent Livraison', emoji: '🚚', color: '#0EA5E9', category: 'logistique', desc: 'Last-mile complet pour Afrique : tournées IA, multi-livreurs (moto/voiture/vélo), COD + Mobile Money, retours, scoring livreurs et notifications WhatsApp temps réel. Inclus dans le Pack Restaurant ($20/mo) — pipeline cuisine → client en 1 clic.', features: ['Tournées IA optimisées', 'Tracking live + ETA', 'COD / Mobile Money', 'WhatsApp client', 'Retours & remboursements', 'Score livreurs'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Adelin Nguessan', africa: true, popular: true, trending: true, includedIn: 'b7', packLabel: 'Pack Restaurant' },
  { id: 'a9', name: 'Agent Immobilier', emoji: '🏠', color: '#10B981', category: 'commerce', desc: 'Annonces, visites virtuelles 360°, négociation, OHADA contrats', features: ['Visites 360°', 'Négo IA', 'OHADA natif'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true },
  { id: 'a10', name: 'Agent Mode', emoji: '👗', color: '#EC4899', category: 'mode', desc: 'Boutique mode: stocks, styliste IA, recommandations clients, social selling', features: ['Stocks IA', 'Styliste perso', 'Social selling'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: false },
  { id: 'a11', name: 'Agent Beauté', emoji: '💄', color: '#DB2777', category: 'beaute', desc: 'Salon: RDV, catalogue produits, fidélisation clients, recommandations', features: ['RDV intelligents', 'Fidélisation', 'Catalogue'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: false, popular: false },
  { id: 'a12', name: 'Agent BTP', emoji: '🏗️', color: '#D4A017', category: 'construction', desc: 'Devis BTP, suivi chantiers, gestion ouvriers, factures OHADA', features: ['Devis BTP', 'Suivi chantier', 'OHADA'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true },
  { id: 'a13', name: 'Agent Café', emoji: '☕', color: '#5B21B6', category: 'restaurant', desc: 'Bar/Café: commandes, programme loyalty, gestion stocks', features: ['Loyalty', 'Stocks', 'Commandes'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: false, popular: false },
  { id: 'a14', name: 'Agent Formation', emoji: '🎓', color: '#0EA5E9', category: 'education', desc: 'École/Centre: cours, inscriptions, suivi élèves, paiement scolarité', features: ['Inscriptions', 'Suivi élèves', 'Paiement'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true },
  { id: 'a15', name: 'Agent Tourisme', emoji: '🌍', color: '#059669', category: 'commerce', desc: 'Voyages: réservations hôtels, billets, guides locaux Afrique', features: ['Réservations', 'Guides Afrique', 'Multi-langues'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: false },
  { id: 'a16', name: 'Agent Agronomie', emoji: '🌱', color: '#10B981', category: 'agriculture', desc: 'Conseil cultures, calendrier saisonnier, vente coopérative', features: ['Cultures', 'Calendrier', 'Coopérative'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true },
  { id: 'a17', name: 'Agent Élevage', emoji: '🐄', color: '#D4A017', category: 'agriculture', desc: 'Suivi troupeau, santé animale, vaccination, reproduction', features: ['Santé animale', 'Vaccination', 'Reproduction'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: false },
  { id: 'a18', name: 'Agent Médical Pro', emoji: '💊', color: '#EF4444', category: 'sante', desc: 'Suivi patients, consultations, prescription, dossier médical numérique', features: ['Dossier médical', 'Prescriptions', 'Consultations'], plan: 'addon', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true },
  { id: 'a19', name: 'Agent Démo', emoji: '🎯', color: '#A78BFA', category: 'commerce', desc: 'Agent de démonstration gratuit pour tester Orlode', features: ['Démo', 'Test', 'Gratuit'], plan: 'free', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 0, status: 'free', creator: 'Orlode', africa: true, popular: true },
  { id: 'a20', name: 'Agent Bienvenue', emoji: '👋', color: '#06B6D4', category: 'commerce', desc: 'Agent d\'accueil basique pour les visiteurs de votre site', features: ['Accueil', 'FAQ', 'Lead capture'], plan: 'free', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 0, status: 'free', creator: 'Orlode', africa: true, popular: false },
  { id: 'a21', name: 'Agent Sales', emoji: '💼', color: '#0EA5E9', category: 'commerce', desc: 'CRM IA complet : leads, pipeline, séquences emails, forecasts, win-loss, automation. Connecté nativement à Marketing (qualif des leads) et Comms (nurturing). Inclus dans le Pack Commercial ($20/mo).', features: ['Pipeline IA', 'Séquences emails', 'Forecasts', 'Win-loss', 'Automation'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, trending: true, includedIn: 'b10', packLabel: 'Pack Commercial' },
  { id: 'a22', name: 'Agent Marketing', emoji: '📣', color: '#F59E0B', category: 'commerce', desc: 'Campagnes multi-canal : SEO, social, ads, contenu IA, segmentation audiences, analytics ROI. Génère leads → passe à Sales pour conversion → Comms pour suivi. Inclus dans le Pack Commercial ($20/mo).', features: ['Campagnes IA', 'Segmentation', 'Contenu auto', 'Analytics ROI', 'Social scheduling'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, trending: true, includedIn: 'b10', packLabel: 'Pack Commercial' },
  { id: 'a23', name: 'Agent Fidélité', emoji: '💝', color: '#EC4899', category: 'restaurant', desc: 'Programme de fidélité IA : points, niveaux, récompenses, relances clients inactifs, anniversaires, NPS. Inclus dans le Pack Restaurant ($20/mo) — relance les habitués + augmente le panier moyen.', features: ['Points & niveaux', 'Relances automatiques', 'NPS clients', 'Récompenses IA'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, includedIn: 'b7', packLabel: 'Pack Restaurant' },
  { id: 'a24', name: 'Agent Knowledge', emoji: '🧠', color: '#7C3AED', category: 'commerce', desc: 'Base de connaissances RAG : indexation documents (Drive, SharePoint, PDF), recherche IA contextuelle, FAQ auto-générée. Sert tous les autres agents — fournit le contexte de votre entreprise.', features: ['RAG indexation', 'Recherche IA', 'FAQ auto', 'Multi-source'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, trending: true, includedIn: 'b10', packLabel: 'Pack Commercial' },
  { id: 'a25', name: 'Agent Réception', emoji: '🚪', color: '#0EA5E9', category: 'commerce', desc: 'Hub d\'accueil entreprise : enregistrement visiteurs, badges QR, kiosk plein écran avec avatar IA Aïcha (voix Gemini Live), notifications host multi-canal. Inclus dans le Pack Réception ($20/mo).', features: ['Kiosk avatar IA', 'Badges QR', 'Notifs host', 'Pré-enregistrement', 'Reconnaissance faciale'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, trending: true, includedIn: 'b11', packLabel: 'Pack Réception' },
  { id: 'a26', name: 'Agent Accueil Visiteur', emoji: '👋', color: '#06B6D4', category: 'commerce', desc: 'Pré-enregistrement visiteurs en ligne, QR WhatsApp, message d\'accueil personnalisé, gestion files d\'attente. Complète l\'agent Réception pour les VIP. Inclus dans le Pack Réception.', features: ['Pré-enregistrement', 'QR WhatsApp', 'File d\'attente', 'VIP routing'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, includedIn: 'b11', packLabel: 'Pack Réception' },
  { id: 'a27', name: 'Agent RH', emoji: '👩‍💼', color: '#4338CA', category: 'finance', desc: 'Suite RH complète : effectifs, congés OHADA, paie, performance, onboarding, demandes en self-service. 19 onglets dans HRRedesignPage. Inclus dans le Pack RH ($20/mo).', features: ['Congés OHADA', 'Paie', 'Performance', 'Onboarding auto', 'Self-service'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, trending: true, includedIn: 'b12', packLabel: 'Pack RH' },
  { id: 'a28', name: 'Agent Compliance', emoji: '✅', color: '#10B981', category: 'securite', desc: 'Conformité RGPD/ISO 27001/SOC 2/NIST CSF : checklist contrôles, score live, génération de politiques IA, audit logs exportables. Inclus dans le Pack Cybersécurité ($20/mo).', features: ['RGPD ready', 'ISO 27001', 'SOC 2', 'Score live', 'Export audits'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, includedIn: 'b13', packLabel: 'Pack Cybersécurité' },
  { id: 'a29', name: 'Agent Audit', emoji: '🔍', color: '#5B21B6', category: 'securite', desc: 'Journaux d\'audit complets : qui a fait quoi quand, accès, modifications, exports. Détection comportements suspects + export CSV pour commissaires aux comptes. Inclus dans le Pack Cybersécurité.', features: ['Audit logs complets', 'Détection anomalies', 'Export CSV/PDF', 'Conformité auditeurs'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, includedIn: 'b13', packLabel: 'Pack Cybersécurité' },
  { id: 'a30', name: 'Agent Support', emoji: '📞', color: '#06B6D4', category: 'commerce', desc: 'Support client 24/7 : tickets SLA, réponses IA contextuelles, base de connaissances auto, satisfaction NPS, escalade automatique. Inclus dans le Pack Entreprise ($20/mo).', features: ['Tickets SLA', 'Réponses IA', 'KB auto', 'NPS tracking', 'Escalade auto'], plan: 'pack', installed: false, installs: 0, rating: null, reviews: 0, isNew: true, price: 5, status: 'addon', currency: 'USD', period: 'mo', creator: 'Orlode', africa: true, popular: true, includedIn: 'b10', packLabel: 'Pack Entreprise' },
];

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; }

  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font { font-family: 'JetBrains Mono', monospace; }

  .nav-item {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; border-radius: 10px;
    color: ${C.onGreenSoft}; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: all 0.2s ease; position: relative;
  }
  .nav-item:hover { background: rgba(255,250,240,0.06); color: ${C.cream}; }
  .nav-item.active {
    background: ${C.violet}; color: ${C.cream};
    box-shadow: 0 8px 24px -8px ${C.violet};
  }
  .nav-item.active::after {
    content: ''; position: absolute;
    right: 12px; top: 50%; transform: translateY(-50%);
    width: 6px; height: 6px; border-radius: 50%; background: ${C.gold};
  }

  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 100px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  }

  .quick-action {
    background: rgba(255,250,240,0.08);
    border: 1px solid rgba(255,250,240,0.12);
    border-radius: 12px; padding: 10px 16px;
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 500; color: ${C.cream};
    cursor: pointer; transition: all 0.2s ease; font-family: inherit;
    position: relative;
  }
  .quick-action:hover {
    background: ${C.violet}; color: ${C.cream}; border-color: ${C.violet};
    transform: translateY(-1px);
  }

  .btn-primary {
    background: linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 100%);
    color: ${C.cream}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.violet};
    font-family: inherit;
  }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -8px ${C.violet};
  }

  .btn-gold {
    background: linear-gradient(135deg, ${C.gold} 0%, ${C.goldDeep} 100%);
    color: ${C.cream}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.gold};
    font-family: inherit;
  }
  .btn-gold:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -8px ${C.gold};
  }

  .btn-secondary {
    background: ${C.cream}; color: ${C.violetDeep};
    border: 1.5px solid rgba(10,42,32,0.1);
    padding: 11px 18px; border-radius: 12px;
    font-weight: 600; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease; font-family: inherit;
  }
  .btn-secondary:hover {
    background: ${C.violetDeep}; color: ${C.cream}; border-color: ${C.violetDeep};
  }

  .icon-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: ${C.violetSoft}; color: ${C.violetDeep};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none; transition: all 0.2s ease;
    flex-shrink: 0;
  }
  .icon-btn:hover { background: ${C.violetDeep}; color: ${C.cream}; }
  .icon-btn.gold { background: ${C.goldSoft}; color: ${C.goldDeep}; }
  .icon-btn.gold:hover { background: ${C.gold}; color: ${C.cream}; }
  .icon-btn.danger { background: ${C.redSoft}; color: ${C.redDeep}; }
  .icon-btn.danger:hover { background: ${C.redDeep}; color: ${C.cream}; }

  .avatar {
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Fraunces', serif; font-weight: 700;
    color: ${C.cream}; flex-shrink: 0;
  }

  .input-field {
    width: 100%; background: ${C.creamDeep};
    border: 1.5px solid rgba(10,42,32,0.08);
    border-radius: 12px; padding: 12px 16px;
    font-size: 14px; color: ${C.ink};
    font-family: inherit; outline: none;
    transition: all 0.2s ease;
  }
  .input-field:focus {
    border-color: ${C.violet};
    background: ${C.cream};
    box-shadow: 0 0 0 4px ${C.violet}15;
  }

  .grain::before {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  }

  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: ${C.emerald}; position: relative; flex-shrink: 0;
  }
  .live-dot::after {
    content: ''; position: absolute; inset: -4px;
    border-radius: 50%; background: ${C.emerald};
    opacity: 0.4; animation: pulse 1.8s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.4; }
    50% { transform: scale(1.6); opacity: 0; }
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; }
  .stagger > *:nth-child(2) { animation-delay: 0.08s; }
  .stagger > *:nth-child(3) { animation-delay: 0.11s; }
  .stagger > *:nth-child(4) { animation-delay: 0.14s; }
  .stagger > *:nth-child(5) { animation-delay: 0.17s; }
  .stagger > *:nth-child(6) { animation-delay: 0.20s; }
  .stagger > *:nth-child(7) { animation-delay: 0.23s; }
  .stagger > *:nth-child(8) { animation-delay: 0.26s; }
  .stagger > *:nth-child(9) { animation-delay: 0.29s; }
  .stagger > *:nth-child(10) { animation-delay: 0.32s; }

  @keyframes cartBounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }
  .cart-bounce { animation: cartBounce 0.6s ease-in-out; }

  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 8px 24px -8px ${C.pink}80; }
    50% { box-shadow: 0 12px 32px -4px ${C.pink}cc, 0 0 0 8px ${C.pink}20; }
  }
  .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }

  @keyframes trophyShine {
    0%, 100% { filter: drop-shadow(0 0 8px ${C.gold}40); }
    50% { filter: drop-shadow(0 0 16px ${C.gold}80); }
  }
  .trophy-shine { animation: trophyShine 2s ease-in-out infinite; }

  @keyframes heartPop {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }
  .heart-pop { animation: heartPop 0.4s ease-in-out; }

  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .slide-in-right { animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1); }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .fade-in { animation: fadeIn 0.2s ease-out; }
  .scale-in { animation: scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1); }

  @keyframes wiggle {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-8deg); }
    75% { transform: rotate(8deg); }
  }
  .wiggle { animation: wiggle 1.5s ease-in-out infinite; }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spinner { animation: spin 1s linear infinite; }

  .card-lift { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  .card-lift:hover { transform: translateY(-6px); }

  @keyframes sparkleFloat {
    0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.6; }
    25% { transform: translate(8px, -12px) rotate(90deg); opacity: 1; }
    50% { transform: translate(0, -20px) rotate(180deg); opacity: 0.8; }
    75% { transform: translate(-8px, -12px) rotate(270deg); opacity: 1; }
  }
  .sparkle-1 { animation: sparkleFloat 4s ease-in-out infinite; }
  .sparkle-2 { animation: sparkleFloat 5s ease-in-out infinite 1s; }
  .sparkle-3 { animation: sparkleFloat 6s ease-in-out infinite 2s; }

  .scroll-hide::-webkit-scrollbar { display: none; }
  .scroll-hide { scrollbar-width: none; }

  .mobile-menu-btn { display: none; }

  /* Section padding utility — driven by class so it scales responsively */
  .mp-section { padding: 32px; }

  @media (max-width: 1280px) {
    .mp-section { padding: 28px; }
  }

  @media (max-width: 1024px) {
    .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-charts { grid-template-columns: 1fr !important; }
    .mp-section { padding: 22px !important; }
    .mp-hero-pad { padding: 36px 28px !important; }
    .mp-hero-title { font-size: 42px !important; }
  }

  @media (max-width: 768px) {
    .sidebar-aside {
      position: fixed !important; left: 0; top: 0;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      z-index: 100;
    }
    .sidebar-aside.open { transform: translateX(0); }
    .sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
    .mobile-menu-btn { display: flex !important; }
    .desktop-only { display: none !important; }
    .responsive-grid-4 { grid-template-columns: 1fr 1fr !important; }
    .responsive-grid-3 { grid-template-columns: 1fr !important; }
    .hero-title, .mp-hero-title { font-size: 32px !important; }
    .hide-on-mobile { display: none !important; }
    .cart-panel { width: 100% !important; }
    .mp-section { padding: 16px !important; }
    .mp-hero-pad { padding: 28px 18px !important; }
  }

  @media (max-width: 480px) {
    .responsive-grid-4 { grid-template-columns: 1fr !important; }
    .mp-section { padding: 12px !important; }
    .mp-hero-pad { padding: 22px 14px !important; }
    .mp-hero-title { font-size: 28px !important; line-height: 1.1 !important; }
    .mp-hero-pill { font-size: 9px !important; }
    .mp-hero-sub { font-size: 13px !important; }
    .mp-hero-cta button { padding: 10px 16px !important; font-size: 12px !important; }
    .mp-hero-trust { gap: 10px !important; font-size: 11px !important; }
    .mp-fab-cart { bottom: 16px !important; right: 16px !important; }
  }
`;

// Global currency formatter — set by the main App component on each render via
// useCurrency hook. Defaults to USD when no company currency is configured.
// Prices in the catalog are stored in USD (see BUNDLES_FALLBACK / AGENTS_FALLBACK
// after the unification). The formatter converts to the user's chosen currency.
let _formatPrice: (usd: number) => string = (usd: number) => `$${Math.round(usd).toLocaleString()}`;

export function _setPriceFormatter(fn: (usd: number) => string) {
  _formatPrice = fn;
}

function formatFCFA(num: number) {
  return _formatPrice(num);
}

// ============ CHROME ============
// Chrome lite — sidebar/header gérés par le layout corpmind-ai. Cart en FAB flottant.
function Chrome({ children, cartCount, onOpenCart, cartBouncing }: any) {
  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.greenDeep }}>
        {children}
      </main>

      {/* Cart FAB flottant */}
      <button onClick={onOpenCart} className={cartBouncing ? 'cart-bounce' : ''} style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 60,
        width: 60, height: 60, borderRadius: 18,
        background: `linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 100%)`,
        color: C.cream, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 14px 32px -10px ${C.violet}cc`,
        transition: 'transform 0.2s ease',
      }} onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
        <ShoppingCart size={22} fill={cartCount > 0 ? C.cream : 'none'} />
        {cartCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: C.gold, color: C.cream,
            fontSize: 11, fontWeight: 700, padding: '3px 7px',
            borderRadius: 100, minWidth: 22, textAlign: 'center',
            fontFamily: 'JetBrains Mono, monospace',
            boxShadow: `0 0 0 3px ${C.greenDeep}, 0 4px 12px -4px ${C.gold}`,
          }}>{cartCount}</span>
        )}
      </button>
    </div>
  );
}
// ============ HERO ============
// Launch-phase banner — sets honest expectations during the beta period.
// Points users to the dedicated /feedback page for any report.
// Dismiss is per-browser (localStorage); resurfaces if we ship a new version.
function LaunchBanner() {
  const KEY = 'orlode_launch_banner_v1';
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  if (dismissed) return null;

  return (
    <div style={{ padding: '16px 32px 0' }}>
      <div style={{
        background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
        border: '1.5px solid #FBBF24',
        borderRadius: 16, padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 24 }}>🚀</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#78350F', marginBottom: 2 }}>
              Phase de lancement — votre feedback compte
            </div>
            <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.4 }}>
              Certains packs sont encore en <strong>BETA</strong> (badge ⚡). On corrige les bugs en quelques heures grâce à votre retour.
              {' '}<a href="/feedback" style={{ color: '#78350F', fontWeight: 800, textDecoration: 'underline' }}>Donne ton feedback ici</a>.
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            try { localStorage.setItem(KEY, '1'); } catch {}
            setDismissed(true);
          }}
          style={{
            background: 'rgba(120,53,15,0.1)', color: '#78350F', border: 'none',
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          Compris ✓
        </button>
      </div>
    </div>
  );
}

function Hero({ onOpenBundle, onOpenCustom, onOpenAdvisor }: any) {
  const { agents, bundles } = useMarketplace();
  const featuredBundle = bundles.find((b: any) => b.featured) ?? bundles[0];
  return (
    <div className="mp-section" style={{ padding: '32px 32px 0' }}>
      <div className="grain mp-hero-pad" style={{
        background: `linear-gradient(135deg, ${C.violetDeep} 0%, ${C.violet} 50%, ${C.pink} 100%)`,
        borderRadius: 28, padding: '44px 48px',
        position: 'relative', overflow: 'hidden',
        color: C.cream,
        boxShadow: `0 30px 60px -20px ${C.violet}80`,
      }}>
        {/* Decorative circles */}
        <svg style={{ position: 'absolute', right: -80, top: -80, opacity: 0.15 }} width="400" height="400" viewBox="0 0 400 400">
          <circle cx="200" cy="200" r="180" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="200" cy="200" r="130" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="200" cy="200" r="80" stroke={C.cream} strokeWidth="2" fill="none" />
          <circle cx="200" cy="200" r="40" stroke={C.gold} strokeWidth="2" fill="none" />
        </svg>

        {/* Sparkles */}
        <svg className="sparkle-1" style={{ position: 'absolute', top: 60, right: 320, opacity: 0.6 }} width="22" height="22" fill={C.gold}>
          <path d="M11 0 L13 9 L22 11 L13 13 L11 22 L9 13 L0 11 L9 9 Z"/>
        </svg>
        <svg className="sparkle-2" style={{ position: 'absolute', top: 140, right: 80, opacity: 0.5 }} width="18" height="18" fill={C.cream}>
          <path d="M9 0 L11 7 L18 9 L11 11 L9 18 L7 11 L0 9 L7 7 Z"/>
        </svg>
        <svg className="sparkle-3" style={{ position: 'absolute', top: 40, right: 540, opacity: 0.5 }} width="14" height="14" fill={C.cream}>
          <path d="M7 0 L9 5 L14 7 L9 9 L7 14 L5 9 L0 7 L5 5 Z"/>
        </svg>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 36 }}>
          <div style={{ flex: 1, minWidth: 320, maxWidth: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div className="pill" style={{ background: C.gold, color: C.cream }}>
                <Store size={11} /> MARKETPLACE · {agents.length} AGENT{agents.length !== 1 ? 'S' : ''} · {bundles.length} BUNDLE{bundles.length !== 1 ? 'S' : ''}
              </div>
            </div>

            <h1 className="display-font hero-title mp-hero-title" style={{
              fontSize: 56, fontWeight: 800, lineHeight: 1.0, margin: '0 0 16px',
              color: C.cream, letterSpacing: '-0.03em',
            }}>
              Le marketplace<br/>
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>
                des agents IA
              </em>
            </h1>

            <p className="mp-hero-sub" style={{ fontSize: 16, color: 'rgba(255,250,240,0.9)', margin: '0 0 24px', maxWidth: 480, lineHeight: 1.5 }}>
              {agents.length} agents IA spécialisés · Bundles multi-agents · Multi-devises · Pensé pour les entreprises du monde entier
            </p>

            <div className="mp-hero-cta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={onOpenAdvisor} style={{
                background: `linear-gradient(135deg, #10B981 0%, #059669 100%)`,
                color: C.cream,
                padding: '14px 26px', borderRadius: 12,
                border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 24px -8px rgba(16,185,129,0.6)',
              }}>
                <MessageCircle size={16} /> Aide-moi à choisir
              </button>
              <button onClick={() => document.getElementById('mp-bundles')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{
                background: C.cream, color: C.violetDeep,
                padding: '14px 26px', borderRadius: 12,
                border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 24px -8px rgba(0,0,0,0.3)',
              }}>
                <Package size={16} /> Voir les bundles
              </button>
              <button onClick={onOpenCustom} style={{
                background: `linear-gradient(135deg, ${C.gold}, #F59E0B)`,
                color: C.cream,
                padding: '14px 26px', borderRadius: 12,
                border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 24px -8px rgba(0,0,0,0.3)',
              }}>
                <Sparkles size={14} fill={C.cream} /> Construire mon pack
              </button>
              <button onClick={() => {
                // Top des ventes — open the bundle that is BOTH popular and featured (hero pack with most demand).
                // Falls back to first popular, then to first featured, then to bundles[0].
                const score = (b: any) => (b.popular ? 4 : 0) + (b.featured ? 2 : 0) + (b.hero ? 1 : 0) + (b.pickCount ?? b.installs ?? 0) / 1000;
                const top = [...bundles].sort((a: any, b: any) => score(b) - score(a))[0];
                if (top && onOpenBundle) onOpenBundle(top);
                else toast.info('Aucun bundle disponible pour le moment');
              }} style={{
                background: 'rgba(255,250,240,0.15)',
                backdropFilter: 'blur(20px)',
                border: '1.5px solid rgba(255,250,240,0.3)',
                color: C.cream,
                padding: '14px 26px', borderRadius: 12,
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <Sparkles size={14} fill={C.cream} /> Top des ventes
              </button>
            </div>

            {/* Trust badges */}
            <div className="mp-hero-trust" style={{ display: 'flex', gap: 18, marginTop: 24, flexWrap: 'wrap', fontSize: 12, color: 'rgba(255,250,240,0.85)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={14} color={C.gold} /> {agents.length} agents disponibles
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <BadgeCheck size={14} color={C.gold} /> Vérifiés Orlode
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Globe size={14} color={C.gold} /> Disponible mondialement
              </span>
            </div>
          </div>

          {/* Featured bundle card */}
          {featuredBundle && (
          <div onClick={() => onOpenBundle && onOpenBundle(featuredBundle)} style={{
            background: 'rgba(255,250,240,0.12)',
            backdropFilter: 'blur(30px)',
            border: '1.5px solid rgba(255,250,240,0.25)',
            borderRadius: 22, padding: 26,
            minWidth: 280, maxWidth: 340,
            position: 'relative',
            cursor: 'pointer', transition: 'all 0.3s ease',
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0) scale(1)'}
          >
            <div style={{
              position: 'absolute', top: 14, right: 14,
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
              color: C.cream, padding: '4px 10px', borderRadius: 100,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', gap: 4,
              boxShadow: `0 4px 12px -2px ${C.gold}`,
            }}>
              <Flame size={11} className="wiggle" /> BUNDLE VEDETTE
            </div>

            <div style={{
              fontSize: 56, marginBottom: 12,
              filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.2))',
            }}>{featuredBundle.emoji}</div>

            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>
              {featuredBundle.name?.toUpperCase()}
            </div>
            <div className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-0.02em' }}>
              <em style={{ fontStyle: 'italic', fontWeight: 500 }}>{featuredBundle.tagline ?? 'Pack'}</em>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.8)', margin: '0 0 14px', lineHeight: 1.4 }}>
              {featuredBundle.desc}
            </p>

            {/* Agents inclus */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {(featuredBundle.agents ?? []).map((e: string, i: number) => (
                <div key={i} style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: 'rgba(255,250,240,0.2)',
                  border: '1.5px solid rgba(255,250,240,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>{e}</div>
              ))}
              <div style={{
                fontSize: 11, color: 'rgba(255,250,240,0.7)', fontWeight: 600,
                display: 'flex', alignItems: 'center', marginLeft: 4,
              }}>
                {featuredBundle.agentCount} agents inclus
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span className="mono-font" style={{ fontSize: 13, color: 'rgba(255,250,240,0.5)', textDecoration: 'line-through' }}>
                {formatFCFA(featuredBundle.originalPrice)}
              </span>
              <span className="pill" style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.cream, fontSize: 10 }}>
                −{featuredBundle.discount}%
              </span>
            </div>
            <div className="mono-font display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {formatFCFA(featuredBundle.bundlePrice)} <span style={{ fontSize: 14, opacity: 0.7 }}>/mo</span>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ STATS BAR ============
function StatsBar() {
  const { agents, bundles, installedIds } = useMarketplace();
  const maxDiscount = Math.max(0, ...bundles.map((b: any) => b.discount ?? 0));
  const freeCount = agents.filter((a: any) => a.status === 'free' || a.status === 'included').length;
  return (
    <div className="mp-section" style={{ padding: '24px 32px 0' }}>
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Agents disponibles', value: String(agents.length), sub: `${freeCount} inclus / gratuits`, color: C.violet, bg: C.violetSoft, icon: Bot },
          { label: 'Bundles actifs', value: String(bundles.length), sub: maxDiscount > 0 ? `Économies jusqu'à ${maxDiscount}%` : 'Pack multi-agents', color: C.gold, bg: C.goldSoft, icon: Package },
          { label: 'Vous avez installé', value: String(installedIds.size), sub: installedIds.size > 0 ? 'Dans votre espace' : 'Aucun pour le moment', color: C.emerald, bg: C.emeraldSoft, icon: PackageCheck },
          { label: 'Catégories', value: String([...new Set(agents.map((a: any) => a.category))].length), sub: 'Métiers couverts', color: C.pink, bg: C.pinkSoft, icon: Users2 },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} style={{
              background: C.cream, borderRadius: 18, padding: 18,
              border: '1px solid rgba(10,42,32,0.06)',
              display: 'flex', alignItems: 'center', gap: 14,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stat.color }}></div>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: stat.bg, color: stat.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={22} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display-font" style={{ fontSize: 26, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 2 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{stat.label}</div>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 500 }}>{stat.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ CATEGORIES SCROLLER ============
function Categories({ active, setActive }) {
  const { categories } = useMarketplace();
  return (
    <div className="mp-section" style={{ padding: '24px 32px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          Parcourir par <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 18 }}>catégorie</em>
        </h3>
        <span style={{ fontSize: 12, color: C.onGreenSoft }}>
          {categories.length} catégories
        </span>
      </div>

      <div className="scroll-hide" style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4,
      }}>
        {categories.map((cat: any) => {
          const isActive = active === cat.id;
          return (
            <button key={cat.id} onClick={() => setActive(cat.id)} style={{
              flexShrink: 0,
              background: isActive ? C.cream : 'rgba(255,250,240,0.08)',
              border: isActive ? 'none' : '1px solid rgba(255,250,240,0.12)',
              borderRadius: 14, padding: '14px 18px',
              cursor: 'pointer', transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'inherit',
              boxShadow: isActive ? `0 8px 20px -8px ${cat.color}` : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: isActive ? `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` : 'rgba(255,250,240,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
                boxShadow: isActive ? `0 4px 12px -2px ${cat.color}` : 'none',
              }}>{cat.emoji}</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: isActive ? C.ink : C.cream,
                  whiteSpace: 'nowrap',
                }}>{cat.label}</div>
                <div className="mono-font" style={{
                  fontSize: 10, fontWeight: 600,
                  color: isActive ? cat.color : C.onGreenSoft,
                  letterSpacing: '0.02em',
                }}>{cat.count} agents</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ FILTERS BAR ============
function FiltersBar({ filter, setFilter, sort, setSort, viewMode, setViewMode }) {
  return (
    <div className="mp-section" style={{ padding: '20px 32px 0' }}>
      <div style={{
        background: C.cream, borderRadius: 14, padding: '8px 12px',
        border: '1px solid rgba(10,42,32,0.06)',
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* Plan filter */}
        <div style={{ display: 'inline-flex', gap: 3, background: C.creamDeep, padding: 3, borderRadius: 10 }}>
          {[
            { id: 'all', label: 'Tous', icon: LayoutGrid },
            { id: 'included', label: 'Inclus', icon: BadgeCheck },
            { id: 'free', label: 'Gratuit', icon: Heart },
            { id: 'premium', label: 'Premium', icon: Crown },
          ].map(f => {
            const isActive = filter === f.id;
            const Icon = f.icon;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', borderRadius: 8,
                background: isActive ? `linear-gradient(135deg, ${C.violet}, ${C.pink})` : 'transparent',
                color: isActive ? C.cream : C.inkSoft,
                border: 'none', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                boxShadow: isActive ? `0 4px 12px -2px ${C.violet}` : 'none',
              }}>
                <Icon size={11} /> {f.label}
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700, letterSpacing: '0.05em' }}>TRIER:</span>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{
            padding: '7px 10px', fontSize: 12, fontWeight: 600,
            background: C.creamDeep, color: C.ink,
            border: 'none', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            <option value="popular">🔥 Populaires</option>
            <option value="newest">✨ Nouveautés</option>
            <option value="price-asc">💰 Prix croissant</option>
            <option value="price-desc">💎 Prix décroissant</option>
            <option value="rating">⭐ Mieux notés</option>
            <option value="installs">📥 Plus installés</option>
          </select>

          {/* View mode */}
          <div style={{ display: 'inline-flex', gap: 2, background: C.creamDeep, padding: 2, borderRadius: 8 }}>
            <button onClick={() => setViewMode('grid')} style={{
              padding: 6, borderRadius: 6,
              background: viewMode === 'grid' ? C.violet : 'transparent',
              color: viewMode === 'grid' ? C.cream : C.inkSoft,
              border: 'none', cursor: 'pointer', display: 'flex',
            }}><LayoutGrid size={14} /></button>
            <button onClick={() => setViewMode('list')} style={{
              padding: 6, borderRadius: 6,
              background: viewMode === 'list' ? C.violet : 'transparent',
              color: viewMode === 'list' ? C.cream : C.inkSoft,
              border: 'none', cursor: 'pointer', display: 'flex',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ============ BUNDLE CARD ============
function BundleCard({ bundle, onAddToCart, onOpenDetails, inCart, favorite, onToggleFavorite, onStartTrial, trialState }: any) {
  return (
    <div className="card-lift" onClick={() => onOpenDetails(bundle)} style={{
      background: C.cream, borderRadius: 20,
      border: '1px solid rgba(10,42,32,0.06)',
      cursor: 'pointer', overflow: 'hidden',
      position: 'relative',
    }}>
      {bundle.coverImage ? (
        <div style={{ position: 'relative', aspectRatio: '16 / 7', overflow: 'hidden' }}>
          <img src={bundle.coverImage} alt={bundle.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 50%, ${bundle.color}33)` }} />
        </div>
      ) : (
        <div style={{
          height: 6, background: `linear-gradient(90deg, ${bundle.color}, ${bundle.accentColor})`,
        }} />
      )}

      <div style={{ padding: 20 }}>
        {/* Badges row */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {bundle.beta && (
            <span className="pill" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#78350F', fontWeight: 800, letterSpacing: '0.05em', border: '1px solid #FCD34D' }}
                  title="Pack en phase de lancement — votre feedback nous aide à l'améliorer">
              ⚡ BETA
            </span>
          )}
          {bundle.exclusive && (
            <span className="pill" style={{ background: 'linear-gradient(135deg, #D97706, #FBBF24)', color: C.cream, fontWeight: 800, letterSpacing: '0.05em' }}>
              <Star size={9} fill={C.cream} /> EXCLUSIF
            </span>
          )}
          {bundle.popular && (
            <span className="pill" style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.cream }}>
              <Flame size={10} className="wiggle" /> POPULAIRE
            </span>
          )}
          {bundle.featured && !bundle.exclusive && (
            <span className="pill" style={{ background: C.violetSoft, color: C.violetDeep }}>
              <Star size={9} fill={C.violetDeep} /> VEDETTE
            </span>
          )}
          {bundle.agentCount >= 10 && (
            <span className="pill" style={{ background: C.violetSoft, color: C.violetDeep, fontWeight: 700 }}>
              {bundle.agentCount} AGENTS
            </span>
          )}
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: `linear-gradient(135deg, ${bundle.color}, ${bundle.color}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, flexShrink: 0,
            boxShadow: `0 12px 24px -8px ${bundle.color}`,
          }}>
            {bundle.emoji}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 className="display-font" style={{
              fontSize: 19, fontWeight: 700, color: C.ink,
              margin: '0 0 2px', letterSpacing: '-0.01em',
            }}>{bundle.name}</h4>
            <div className="mono-font" style={{ fontSize: 11, color: bundle.color, fontWeight: 700, marginBottom: 4 }}>
              {bundle.agentCount} AGENTS · BUNDLE
            </div>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: 0, lineHeight: 1.4 }}>
              {bundle.tagline}
            </p>
          </div>

          <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(bundle.id); }} style={{
            width: 32, height: 32, borderRadius: 9,
            background: favorite ? C.pinkSoft : C.creamDeep,
            color: favorite ? C.pinkDeep : C.inkLight,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s ease', flexShrink: 0,
          }} className={favorite ? 'heart-pop' : ''}>
            <Heart size={14} fill={favorite ? C.pinkDeep : 'none'} />
          </button>
        </div>

        {/* Description */}
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 14px', lineHeight: 1.5, minHeight: 36 }}>
          {bundle.desc}
        </p>

        {/* Agents inclus */}
        <div style={{ marginBottom: 14, padding: 12, background: C.creamDeep, borderRadius: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6 }}>
            AGENTS INCLUS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {bundle.agents.map((emoji, i) => (
              <div key={i} style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${bundle.color}20, ${bundle.color}10)`,
                border: `1.5px solid ${bundle.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>{emoji}</div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div style={{
          padding: '14px 16px',
          background: `linear-gradient(135deg, ${bundle.color}10, ${bundle.color}05)`,
          borderRadius: 14,
          border: `1.5px solid ${bundle.color}20`,
          marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
              <span className="mono-font" style={{
                fontSize: 11, color: C.inkLight, textDecoration: 'line-through', fontWeight: 500,
              }}>{formatFCFA(bundle.originalPrice)}</span>
              <span className="pill" style={{
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
                color: C.cream, fontSize: 9, padding: '2px 6px',
              }}>−{bundle.discount}%</span>
            </div>
            <div className="mono-font display-font" style={{
              fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.01em',
            }}>
              {formatFCFA(bundle.bundlePrice)} <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>/mo</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="display-font" style={{ fontSize: 11, fontWeight: 700, color: C.gold, lineHeight: 1 }}>
              ÉCONOMIES
            </div>
            <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800, color: C.gold, lineHeight: 1.1 }}>
              {formatFCFA(bundle.originalPrice - bundle.bundlePrice)}
            </div>
          </div>
        </div>

        {/* PRIMARY ACTION — Free trial (no card required) */}
        {trialState === 'active' ? (
          <div style={{
            padding: '11px 14px', borderRadius: 10, marginBottom: 6,
            background: C.emeraldSoft, color: C.emeraldDeep,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontWeight: 700, fontSize: 13,
          }}>
            <CheckCircle2 size={14} /> Essai en cours
          </div>
        ) : trialState === 'expired' ? (
          <div style={{
            padding: '11px 14px', borderRadius: 10, marginBottom: 6,
            background: '#FEE2E2', color: '#B91C1C',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontWeight: 700, fontSize: 12,
          }}>
            ⏳ Essai expiré — passe à l'abonnement payant
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onStartTrial?.(bundle); }}
            disabled={trialState === 'starting'}
            style={{
              width: '100%', marginBottom: 6,
              background: `linear-gradient(135deg, #10B981, #059669)`,
              color: C.cream,
              padding: '12px 14px', borderRadius: 10,
              border: 'none', fontWeight: 800, fontSize: 13,
              cursor: trialState === 'starting' ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'inherit', transition: 'all 0.2s ease',
              boxShadow: '0 6px 16px -4px #10B981',
              opacity: trialState === 'starting' ? 0.6 : 1,
            }}
          >
            🎁 {trialState === 'starting' ? 'Activation…' : 'Essai gratuit 30 jours · sans CB'}
          </button>
        )}

        {/* SECONDARY — buy via cart */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); onAddToCart(bundle); }} style={{
            flex: 1,
            background: inCart ? C.emeraldSoft : C.creamDeep,
            color: inCart ? C.emeraldDeep : C.ink,
            padding: '9px 12px', borderRadius: 10,
            border: '1.5px solid rgba(10,42,32,0.08)',
            fontWeight: 600, fontSize: 12, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'inherit', transition: 'all 0.2s ease',
          }}>
            {inCart ? (
              <><CheckCircle2 size={13} /> Dans le panier</>
            ) : (
              <><ShoppingCart size={13} /> Acheter direct</>
            )}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onOpenDetails(bundle); }} className="btn-secondary" style={{ padding: '9px 12px', fontSize: 12 }}>
            <Eye size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ BUNDLES SECTION ============
function BundlesSection({ category, onAddToCart, onOpenBundle, onOpenCustom, cart, favorites, onToggleFavorite, onStartTrial, trialStateByBundle }: any) {
  const { bundles, agents } = useMarketplace();
  if (bundles.length === 0) return null;
  // Filter by selected category. 'all' = all bundles. Otherwise match bundle.category.
  const filteredBundles = category && category !== 'all'
    ? bundles.filter((b: any) => b.category === category)
    : bundles;
  const featuredBundles = filteredBundles.filter((b: any) => b.featured);
  const otherBundles = filteredBundles.filter((b: any) => !b.featured);
  const maxDiscount = Math.max(0, ...filteredBundles.map((b: any) => b.discount ?? 0));
  // Count of agents matching the same filter (used by the "Voir les N agents" button label)
  const filteredAgentsCount = category && category !== 'all'
    ? (agents ?? []).filter((a: any) => a.category === category).length
    : (agents ?? []).length;

  return (
    <div id="mp-bundles" className="mp-section" style={{ padding: '32px 32px 0', scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 className="display-font" style={{ fontSize: 26, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            <Package size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: C.gold }} />
            Bundles{category && category !== 'all' && <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 22 }}>{` — filtré : ${category}`}</em>}
          </h3>
          <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
            {filteredBundles.length} pack{filteredBundles.length > 1 ? 's' : ''} · {filteredAgentsCount} agent{filteredAgentsCount > 1 ? 's' : ''}{maxDiscount > 0 ? ` · jusqu'à -${maxDiscount}%` : ''}
          </p>
        </div>
        <button className="quick-action" onClick={() => document.getElementById('mp-agents')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          Voir les {filteredAgentsCount} agents <ArrowRight size={14} />
        </button>
      </div>

      {/* Empty state when filter returns nothing */}
      {filteredBundles.length === 0 && (
        <div style={{
          background: 'rgba(255,250,240,0.06)', border: '1px dashed rgba(255,250,240,0.2)',
          borderRadius: 18, padding: 32, textAlign: 'center', color: C.cream, marginBottom: 16,
        }}>
          <Package size={36} style={{ opacity: 0.5, marginBottom: 10, color: C.gold }} />
          <div className="display-font" style={{ fontSize: 18, fontWeight: 700 }}>Aucun pack pour cette catégorie</div>
          <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>Choisis une autre catégorie ou construis ton propre pack →</p>
        </div>
      )}

      <div className="responsive-grid-3 stagger" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
      }}>
        {[...featuredBundles, ...otherBundles].map(bundle => (
          <BundleCard
            key={bundle.id}
            bundle={bundle}
            onAddToCart={onAddToCart}
            onOpenDetails={onOpenBundle}
            inCart={cart.some(item => item.id === bundle.id)}
            favorite={favorites.includes(bundle.id)}
            onToggleFavorite={onToggleFavorite}
            onStartTrial={onStartTrial}
            trialState={trialStateByBundle?.[bundle.id] ?? 'none'}
          />
        ))}

        {/* Custom pack builder card — toujours en dernier */}
        <div onClick={onOpenCustom} style={{
          background: `linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 100%)`,
          borderRadius: 18, padding: 24,
          color: C.cream, cursor: 'pointer', position: 'relative', overflow: 'hidden',
          minHeight: 280, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          border: `2px dashed rgba(255,250,240,0.3)`,
          transition: 'all 0.3s ease',
        }}
        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 24px 48px -16px ${C.violet}`; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <div>
            <div className="pill" style={{ background: 'rgba(255,250,240,0.2)', color: C.cream, marginBottom: 14 }}>
              <Sparkles size={11} fill={C.cream} /> SUR MESURE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,250,240,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎨</div>
              <h3 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Construis ton<br/><em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>propre pack</em>
              </h3>
            </div>
            <p style={{ fontSize: 13, opacity: 0.95, margin: 0, lineHeight: 1.5 }}>
              Choisis 4 agents parmi le catalogue, ajoute jusqu'à 3 add-ons. Le pack qui colle parfaitement à ton métier.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <div>
              <div className="display-font mono-font" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>$20<span style={{ fontSize: 13, opacity: 0.7, fontWeight: 500 }}>/mo</span></div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>BYOE · 4 agents libres</div>
            </div>
            <div style={{ background: C.cream, color: C.violetDeep, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Personnaliser <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ AGENT CARD ============
function AgentCard({ agent, onAddToCart, onInstall, onOpenDetails, inCart, favorite, onToggleFavorite, viewMode, installed }: any) {
  const isList = viewMode === 'list';

  if (isList) {
    return (
      <div onClick={() => onOpenDetails(agent)} style={{
        background: C.cream, borderRadius: 16,
        padding: 16, border: '1px solid rgba(10,42,32,0.06)',
        borderLeft: `4px solid ${agent.color}`,
        cursor: 'pointer', transition: 'all 0.2s ease',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = `0 12px 24px -12px ${agent.color}40`; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: agent.coverImage ? '#000' : `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0,
          overflow: 'hidden',
          boxShadow: `0 8px 16px -4px ${agent.color}`,
        }}>
          {agent.coverImage
            ? <img src={agent.coverImage} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : agent.emoji}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{agent.name}</span>
            {agent.installed && <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDeep, fontSize: 9 }}><CheckCheck size={9} /> INSTALLÉ</span>}
            {agent.status === 'included' && !agent.installed && <span className="pill" style={{ background: C.violetSoft, color: C.violetDeep, fontSize: 9 }}><BadgeCheck size={9} /> INCLUS</span>}
            {agent.beta && <span className="pill" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#78350F', fontSize: 9, fontWeight: 800, border: '1px solid #FCD34D' }} title="Agent en beta — feedback bienvenu">⚡ BETA</span>}
            {agent.isNew && !agent.installed && <span className="pill" style={{ background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`, color: C.cream, fontSize: 9 }}><Sparkles size={9} fill={C.cream} /> NOUVEAU</span>}
            {agent.trending && !agent.isNew && <span className="pill" style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.cream, fontSize: 9 }}><Flame size={9} /> TREND</span>}
          </div>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 4px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{agent.desc}</p>
          <div style={{ display: 'flex', gap: 8, fontSize: 10, color: C.inkLight, fontWeight: 600 }}>
            {agent.rating != null ? (
              <span><Star size={10} fill={C.gold} color={C.gold} style={{ display: 'inline', verticalAlign: 'middle' }} /> {agent.rating} <span style={{ color: C.inkLight }}>({agent.reviews})</span></span>
            ) : (
              <span style={{ color: C.violet, fontStyle: 'italic' }}>Pas encore noté</span>
            )}
            {agent.installs > 0 && (
              <span><Download size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {agent.installs}</span>
            )}
            <span>· {agent.creator}</span>
          </div>
        </div>

        {agent.status !== 'included' && (
          <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, minWidth: 100, textAlign: 'right' }}>
            {agent.price === 0 ? <span style={{ color: C.emerald }}>Gratuit</span> : `${formatFCFA(agent.price)}`}
          </div>
        )}

        <div style={{ display: 'flex', gap: 4 }}>
          {agent.installed ? (
            <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12, color: C.emeraldDeep, borderColor: C.emerald, background: C.emeraldSoft }}>
              <CheckCircle2 size={13} /> Installé
            </button>
          ) : agent.status === 'included' || agent.status === 'free' ? (
            <button onClick={(e) => { e.stopPropagation(); onInstall && onInstall(agent); }} className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }}>
              <Download size={13} /> Installer
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onAddToCart(agent); }} className={inCart ? 'btn-secondary' : 'btn-primary'} style={{
              padding: '8px 14px', fontSize: 12,
              ...(inCart && { background: C.emeraldSoft, color: C.emeraldDeep, borderColor: C.emerald }),
            }}>
              {inCart ? <><CheckCircle2 size={13} /> Ajouté</> : <><ShoppingCart size={13} /> Panier</>}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grid mode
  return (
    <div className="card-lift" onClick={() => onOpenDetails(agent)} style={{
      background: C.cream, borderRadius: 18,
      border: '1px solid rgba(10,42,32,0.06)',
      cursor: 'pointer', overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Header — cover image when available, gradient otherwise */}
      <div style={{
        height: 100,
        background: agent.coverImage ? '#000' : `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {agent.coverImage ? (
          <img src={agent.coverImage} alt={agent.name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 60%)',
          }}></div>
        )}

        {/* Badges */}
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {agent.installed && (
              <span className="pill" style={{ background: 'rgba(255,250,240,0.95)', color: C.emeraldDeep, fontSize: 10 }}>
                <CheckCheck size={10} /> INSTALLÉ
              </span>
            )}
            {agent.status === 'included' && !agent.installed && (
              <span className="pill" style={{ background: 'rgba(255,250,240,0.95)', color: C.violetDeep, fontSize: 10 }}>
                <BadgeCheck size={10} /> INCLUS
              </span>
            )}
            {agent.beta && (
              <span className="pill" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#78350F', fontSize: 10, fontWeight: 800, border: '1px solid #FCD34D' }} title="Agent en beta">
                ⚡ BETA
              </span>
            )}
            {agent.trending && (
              <span className="pill" style={{ background: 'rgba(255,250,240,0.95)', color: C.goldDeep, fontSize: 10 }}>
                <Flame size={10} className="wiggle" /> TREND
              </span>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(agent.id); }} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,250,240,0.95)',
            color: favorite ? C.pinkDeep : C.inkSoft,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }} className={favorite ? 'heart-pop' : ''}>
            <Heart size={13} fill={favorite ? C.pinkDeep : 'none'} />
          </button>
        </div>

        {/* Big emoji */}
        <div style={{
          position: 'absolute', bottom: -22, left: 16,
          width: 64, height: 64, borderRadius: 16,
          background: C.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32,
          boxShadow: '0 8px 20px -4px rgba(0,0,0,0.15)',
          border: '3px solid white',
        }}>{agent.emoji}</div>
      </div>

      <div style={{ padding: '32px 18px 18px' }}>
        {/* Name + creator */}
        <div style={{ marginBottom: 8 }}>
          <h4 className="display-font" style={{
            fontSize: 17, fontWeight: 700, color: C.ink,
            margin: '0 0 2px', letterSpacing: '-0.01em',
          }}>{agent.name}</h4>
          <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>
            Par <strong style={{ color: agent.creator === 'Orlode' ? C.violet : C.gold }}>{agent.creator}</strong>
            {agent.creator === 'Orlode' && <BadgeCheck size={11} color={C.violet} style={{ display: 'inline', marginLeft: 3, verticalAlign: 'middle' }} />}
          </div>
        </div>

        {/* Description */}
        <p style={{
          fontSize: 12, color: C.inkSoft,
          margin: '0 0 12px', lineHeight: 1.4,
          minHeight: 50,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {agent.desc}
        </p>

        {/* Features tags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12, minHeight: 24 }}>
          {agent.features.slice(0, 3).map((f, i) => (
            <span key={i} style={{
              fontSize: 10, fontWeight: 600,
              background: C.creamDeep, color: C.inkSoft,
              padding: '3px 8px', borderRadius: 6,
            }}>{f}</span>
          ))}
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: 10, padding: '8px 0',
          borderTop: '1px solid rgba(10,42,32,0.06)',
          borderBottom: '1px solid rgba(10,42,32,0.06)',
          marginBottom: 12,
        }}>
          {agent.isNew ? (
            <span className="pill" style={{ background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`, color: C.cream, fontSize: 9, fontWeight: 800 }}>
              <Sparkles size={9} fill={C.cream} /> NOUVEAU
            </span>
          ) : (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Star size={12} fill={C.gold} color={C.gold} />
            <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{agent.rating ?? '—'}</span>
            <span style={{ fontSize: 10, color: C.inkLight }}>({agent.reviews})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Download size={12} color={C.inkSoft} />
            <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{agent.installs}</span>
            <span style={{ fontSize: 10, color: C.inkLight }}>installs</span>
          </div>
          </>
          )}
        </div>

        {/* Pricing + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {agent.status === 'included' ? (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.violet, letterSpacing: '0.05em' }}>INCLUS</div>
              <div style={{ fontSize: 11, color: C.inkSoft }}>dans Enterprise</div>
            </div>
          ) : agent.status === 'free' ? (
            <div>
              <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800, color: C.emerald, lineHeight: 1 }}>Gratuit</div>
              <div style={{ fontSize: 10, color: C.inkLight }}>Sans engagement</div>
            </div>
          ) : (
            <div>
              <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.01em' }}>
                {formatFCFA(agent.price)} <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>/mo</span>
              </div>
            </div>
          )}

          {agent.installed ? (
            <button style={{
              background: C.emeraldSoft, color: C.emeraldDeep,
              padding: '8px 12px', borderRadius: 10,
              border: 'none', fontWeight: 700, fontSize: 11, cursor: 'default',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: 'inherit',
            }}>
              <CheckCircle2 size={12} /> Installé
            </button>
          ) : agent.status === 'included' || agent.status === 'free' ? (
            <button onClick={(e) => { e.stopPropagation(); onInstall && onInstall(agent); }} className="btn-primary" style={{ padding: '8px 14px', fontSize: 11 }}>
              <Download size={12} /> Installer
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onAddToCart(agent); }} style={{
              background: inCart ? C.emeraldSoft : `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
              color: inCart ? C.emeraldDeep : C.cream,
              padding: '8px 12px', borderRadius: 10,
              border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: 'inherit', transition: 'all 0.2s ease',
              boxShadow: inCart ? 'none' : `0 4px 12px -2px ${C.violet}`,
            }}>
              {inCart ? <><CheckCircle2 size={12} /> Ajouté</> : <><ShoppingCart size={12} /> Panier</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ AGENTS SECTION ============
function AgentsSection({ filter, sort, viewMode, category, onAddToCart, onInstall, onOpenDetails, cart, favorites, onToggleFavorite }: any) {
  const { agents } = useMarketplace();
  // Filter
  let filtered = agents;
  if (category !== 'all') {
    filtered = filtered.filter((a: any) => a.category === category);
  }
  if (filter !== 'all') {
    if (filter === 'included') filtered = filtered.filter((a: any) => a.status === 'included');
    else if (filter === 'free') filtered = filtered.filter((a: any) => a.status === 'free');
    else if (filter === 'premium') filtered = filtered.filter((a: any) => a.status === 'premium');
  }

  // Sort
  filtered = [...filtered].sort((a: any, b: any) => {
    if (sort === 'popular') return (b.installs || 0) - (a.installs || 0);
    if (sort === 'newest') return b.id.localeCompare(a.id);
    if (sort === 'price-asc') return (a.price || 0) - (b.price || 0);
    if (sort === 'price-desc') return (b.price || 0) - (a.price || 0);
    if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sort === 'installs') return (b.installs || 0) - (a.installs || 0);
    return 0;
  });

  return (
    <div id="mp-agents" className="mp-section" style={{ padding: '24px 32px 32px', scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h3 className="display-font" style={{ fontSize: 26, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          <Bot size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: C.gold }} />
          Tous les <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 22 }}>agents</em>
        </h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="mono-font pill" style={{ background: 'rgba(255,250,240,0.08)', color: C.cream, fontSize: 11 }}>
            {filtered.length} résultats
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: C.cream, borderRadius: 20, padding: 60,
          textAlign: 'center', border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <Bot size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
            Aucun agent trouvé
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft }}>
            Essayez d'ajuster vos filtres ou parcourez d'autres catégories
          </div>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'responsive-grid-3 stagger' : 'stagger'} style={
          viewMode === 'grid'
            ? { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }
            : { display: 'flex', flexDirection: 'column', gap: 8 }
        }>
          {filtered.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onAddToCart={onAddToCart}
              onInstall={onInstall}
              onOpenDetails={onOpenDetails}
              inCart={cart.some(item => item.id === agent.id)}
              favorite={favorites.includes(agent.id)}
              onToggleFavorite={onToggleFavorite}
              viewMode={viewMode}
              installed={agent.installed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
// ============ CART SIDE PANEL ============
function CartPanel({ cart, onClose, onRemove, onCheckout, onClear }: any) {
  const subtotal = cart.reduce((sum: number, item: any) => sum + (item.bundlePrice || item.price || 0), 0);
  const bundleSavings = cart.reduce((sum: number, item: any) => {
    if (item.originalPrice && item.bundlePrice) return sum + (item.originalPrice - item.bundlePrice);
    return sum;
  }, 0);
  // Promo codes — applied locally. Supported codes:
  //   PME2026 → 10% off, ORLODE10 → 10% off, OUIHOPE20 → 20% off
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState<{ code: string; pct: number } | null>(null);
  const PROMO_CODES: Record<string, number> = { 'PME2026': 10, 'ORLODE10': 10, 'OUIHOPE20': 20 };
  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const pct = PROMO_CODES[code];
    if (pct) {
      setPromoApplied({ code, pct });
      toast.success(`Code ${code} appliqué — ${pct}% de réduction`);
    } else {
      toast.error('Code promo invalide');
      setPromoApplied(null);
    }
  };
  const promoDiscount = promoApplied ? Math.round(subtotal * (promoApplied.pct / 100)) : 0;
  const total = subtotal - promoDiscount;

  return (
    <>
      <div className="fade-in" onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 200,
        backdropFilter: 'blur(4px)',
      }}></div>

      <div className="slide-in-right cart-panel" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 440, background: C.cream, zIndex: 201,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-30px 0 60px -10px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: 24, borderBottom: '1px solid rgba(10,42,32,0.08)',
          background: `linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 100%)`,
          color: C.cream, position: 'relative', overflow: 'hidden',
        }}>
          <svg style={{ position: 'absolute', right: -40, top: -40, opacity: 0.15 }} width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="100" cy="100" r="60" stroke={C.cream} strokeWidth="1" fill="none" />
          </svg>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            <div>
              <div className="pill" style={{ background: C.gold, color: C.cream, marginBottom: 8 }}>
                <ShoppingCart size={11} /> VOTRE PANIER
              </div>
              <h3 className="display-font" style={{ fontSize: 26, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
                {cart.length === 0 ? 'Panier vide' : `${cart.length} article${cart.length > 1 ? 's' : ''}`}
              </h3>
            </div>
            <button onClick={onClose} style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'rgba(255,250,240,0.2)',
              border: '1px solid rgba(255,250,240,0.3)',
              color: C.cream, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Empty state */}
        {cart.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 100, height: 100, borderRadius: 28,
              background: `linear-gradient(135deg, ${C.violetSoft}, ${C.creamDeep})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
              border: `2px dashed ${C.violet}40`,
            }}>
              <ShoppingCart size={40} color={C.violet} />
            </div>
            <h4 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Votre panier est <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>vide</em>
            </h4>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 20px', maxWidth: 280 }}>
              Parcourez le marketplace et ajoutez les agents qui boosteront votre PME.
            </p>
            <button onClick={onClose} className="btn-primary">
              <Sparkles size={14} fill={C.cream} /> Découvrir le marketplace
            </button>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="scroll-hide" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {cart.map((item, idx) => {
                const isBundle = !!item.bundlePrice;
                return (
                  <div key={idx} style={{
                    background: C.creamDeep, borderRadius: 14,
                    padding: 14, marginBottom: 10,
                    border: `1.5px solid ${item.color}20`,
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    position: 'relative',
                  }}>
                    <div style={{
                      width: 50, height: 50, borderRadius: 12,
                      background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 26, flexShrink: 0,
                      boxShadow: `0 6px 14px -4px ${item.color}`,
                    }}>{item.emoji}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                          {item.name}
                        </span>
                        {isBundle && (
                          <span className="pill" style={{ background: C.goldSoft, color: C.goldDeep, fontSize: 9 }}>
                            <Package size={9} /> BUNDLE
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 6px', lineHeight: 1.3 }}>
                        {item.tagline || (item.desc && item.desc.slice(0, 60) + '...')}
                      </p>
                      {isBundle && (
                        <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                          {item.agents.map((e, i) => (
                            <span key={i} style={{ fontSize: 14 }}>{e}</span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div>
                          {isBundle ? (
                            <>
                              <span className="mono-font" style={{ fontSize: 10, color: C.inkLight, textDecoration: 'line-through', marginRight: 4 }}>
                                {formatFCFA(item.originalPrice)}
                              </span>
                              <span className="mono-font display-font" style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>
                                {formatFCFA(item.bundlePrice)}
                              </span>
                              <span style={{ fontSize: 9, color: C.inkSoft, fontWeight: 600 }}> /mo</span>
                            </>
                          ) : (
                            <>
                              <span className="mono-font display-font" style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>
                                {formatFCFA(item.price)}
                              </span>
                              <span style={{ fontSize: 9, color: C.inkSoft, fontWeight: 600 }}> /mo</span>
                            </>
                          )}
                        </div>
                        <button onClick={() => onRemove(item.id)} className="icon-btn danger" style={{ width: 28, height: 28 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Suggestion card */}
              <div style={{
                background: `linear-gradient(135deg, ${C.violetSoft}, ${C.cream})`,
                borderRadius: 14, padding: 14,
                border: `1.5px dashed ${C.violet}50`,
                display: 'flex', gap: 10, alignItems: 'center',
                marginTop: 6,
              }}>
                <Lightbulb size={20} color={C.violet} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.violetDeep, marginBottom: 2 }}>
                    💡 Suggestion intelligente
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>
                    Ajoutez Agent Marketing pour compléter et économiser <strong style={{ color: C.gold }}>−15%</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer with totals */}
            <div style={{ padding: 20, borderTop: '1px solid rgba(10,42,32,0.08)', background: C.cream }}>
              {/* Promo code */}
              <div style={{
                display: 'flex', gap: 6, marginBottom: 14,
              }}>
                <input
                  placeholder="Code promo (ex: PME2026)"
                  className="input-field"
                  style={{ flex: 1, fontSize: 12, padding: '10px 14px' }}
                  value={promoInput}
                  onChange={(e: any) => setPromoInput(e.target.value)}
                  onKeyDown={(e: any) => e.key === 'Enter' && applyPromo()}
                />
                <button onClick={applyPromo} className="btn-secondary" style={{ padding: '10px 14px', fontSize: 12 }}>
                  {promoApplied ? '✓ Appliqué' : 'Appliquer'}
                </button>
              </div>

              {/* Totals */}
              <div style={{ marginBottom: 14, fontSize: 13, color: C.inkSoft }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span>Sous-total</span>
                  <span className="mono-font">{formatFCFA(subtotal)}</span>
                </div>
                {bundleSavings > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: C.gold }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Package size={11} /> Économies bundles
                    </span>
                    <span className="mono-font" style={{ fontWeight: 700 }}>−{formatFCFA(bundleSavings)}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '12px 0 6px', marginTop: 6,
                  borderTop: '1px solid rgba(10,42,32,0.08)',
                  fontWeight: 700, color: C.ink, fontSize: 15,
                }}>
                  <span>Total mensuel</span>
                  <span className="mono-font display-font" style={{ fontSize: 22, fontWeight: 800, color: C.violetDeep, letterSpacing: '-0.01em' }}>
                    {formatFCFA(total)} <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>/mo</span>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <button onClick={onCheckout} className="btn-primary pulse-glow" style={{
                width: '100%', justifyContent: 'center', padding: 14, fontSize: 14,
              }}>
                <CreditCard size={16} /> Procéder au paiement
              </button>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={onClose} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: 10, fontSize: 12 }}>
                  Continuer
                </button>
                <button onClick={onClear} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: 10, fontSize: 12, color: C.redDeep, borderColor: `${C.red}30` }}>
                  <Trash2 size={11} /> Vider
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ============ MARKETPLACE ADVISOR (chat IA) ============
// Chat-style modal: user describes their business/tasks, AI matches the best
// agents from the catalog and explains the role each one would play.
function MarketplaceAdvisor({ open, onClose, onAddToCart, onOpenBundle, onOpenCustom }: any) {
  const { agents, bundles } = useMarketplace();
  interface ChatMsg { role: 'user' | 'assistant'; content: string; }
  interface Recommendation { agentId: string; agentName: string; role: string; why: string; }
  interface AdvisorResponse {
    message: string;
    recommendations: Recommendation[];
    suggestedPack: { bundleId: string; bundleName: string; why: string } | null;
    addonAgents?: Recommendation[];
    customPackHint: string | null;
  }

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis le conseiller IA d\'Orlode. Décris-moi ton activité, tes tâches du quotidien ou ce qui te prend trop de temps — je te recommande les agents IA qui peuvent vraiment t\'aider et leur rôle précis dans ton métier.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AdvisorResponse | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, response]);

  if (!open) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMsgs: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);
    setResponse(null);
    try {
      const r = await api.post<{ data: AdvisorResponse }>('/marketplace/advisor', {
        description: text,
        history: messages,
      });
      const raw = r.data as unknown as Record<string, unknown>;
      const data = (raw?.data ?? raw) as AdvisorResponse;
      setResponse(data);
      setMessages([...newMsgs, { role: 'assistant', content: data.message ?? 'Voici mes recommandations.' }]);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Le conseiller IA n\'est pas disponible. Réessaie dans un instant.';
      setMessages([...newMsgs, { role: 'assistant', content: `⚠ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const findAgent = (id: string) => (agents ?? []).find((a: any) => a.id === id);
  const findBundle = (id: string) => (bundles ?? []).find((b: any) => b.id === id);

  return (
    <>
      <div className="fade-in" onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, backdropFilter: 'blur(8px)',
      }} />
      <div className="scale-in" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '92vw', maxWidth: 720, height: '85vh',
        background: C.cream, borderRadius: 22, overflow: 'hidden', zIndex: 201,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 60px -20px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 100%)`,
          color: C.cream, padding: '18px 24px',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,250,240,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <h2 className="display-font" style={{ fontSize: 19, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Conseiller IA <em style={{ fontStyle: 'italic', fontWeight: 500 }}>Orlode</em>
            </h2>
            <p style={{ fontSize: 11, opacity: 0.9, margin: '2px 0 0' }}>
              Décris ton métier · Je recommande les agents qui te font gagner du temps
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,250,240,0.15)', border: 'none', color: C.cream, width: 32, height: 32, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', background: C.creamDeep }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}>
              <div style={{
                maxWidth: '78%',
                background: m.role === 'user' ? `linear-gradient(135deg, ${C.violet}, ${C.pink})` : C.cream,
                color: m.role === 'user' ? C.cream : C.ink,
                padding: '10px 14px', borderRadius: 14,
                fontSize: 13, lineHeight: 1.5,
                boxShadow: m.role === 'user' ? `0 8px 16px -8px ${C.violet}` : '0 2px 6px -2px rgba(0,0,0,0.08)',
                whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.inkSoft, fontSize: 12, padding: '8px 14px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.violet, animation: `advisorPulse 1.2s ${i * 0.15}s ease-in-out infinite` }} />
                ))}
              </div>
              Analyse en cours…
            </div>
          )}

          {/* Recommendations */}
          {response && response.recommendations.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} fill={C.violet} color={C.violet} /> Agents recommandés ({response.recommendations.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {response.recommendations.map((rec, i) => {
                  const agent = findAgent(rec.agentId);
                  return (
                    <div key={i} style={{
                      background: C.cream, borderRadius: 12, padding: '12px 14px',
                      border: `1px solid ${C.violet}30`, boxShadow: '0 2px 8px -2px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: agent?.color ? `${agent.color}15` : C.violetSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                          {agent?.emoji ?? '🤖'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{rec.agentName}</div>
                          <div style={{ fontSize: 10, color: C.inkSoft, fontStyle: 'italic' }}>{rec.role}</div>
                        </div>
                        {agent && (
                          <button onClick={() => onAddToCart(agent)} style={{
                            background: C.violet, color: C.cream, border: 'none', borderRadius: 8,
                            padding: '6px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                            <Plus size={11} /> $5
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: C.ink, margin: 0, lineHeight: 1.5, paddingLeft: 42 }}>
                        {rec.why}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggested pack */}
          {response?.suggestedPack && (() => {
            const bundle = findBundle(response.suggestedPack.bundleId);
            if (!bundle) return null;
            return (
              <div style={{
                marginTop: 14,
                background: `linear-gradient(135deg, ${C.gold}15, ${C.gold}05)`,
                border: `2px solid ${C.gold}`,
                borderRadius: 14, padding: 14,
              }}>
                <div className="pill" style={{ background: C.gold, color: C.cream, marginBottom: 8, fontSize: 9 }}>
                  <Sparkles size={9} fill={C.cream} /> MEILLEUR DEAL
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <div style={{ fontSize: 28 }}>{bundle.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div className="display-font" style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>{response.suggestedPack.bundleName}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>4 agents · $20/mo · BYOE</div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: C.ink, margin: '0 0 10px', lineHeight: 1.5 }}>
                  💡 {response.suggestedPack.why}
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => onOpenBundle(bundle)} style={{
                    flex: 1, background: 'transparent', color: C.gold, border: `1.5px solid ${C.gold}`, borderRadius: 10,
                    padding: '8px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Voir le pack</button>
                  <button onClick={() => onAddToCart(bundle)} style={{
                    flex: 1, background: `linear-gradient(135deg, ${C.gold}, #B45309)`, color: C.cream, border: 'none', borderRadius: 10,
                    padding: '8px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>+ Panier $20/mo</button>
                </div>
              </div>
            );
          })()}

          {/* Suggested ADD-ONS — extra agents to complement the pack at $5/mo each */}
          {response && (response.addonAgents ?? []).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={13} color={C.gold} /> Add-ons recommandés <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 11 }}>(+$5/mo chacun)</em>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(response.addonAgents ?? []).map((rec, i) => {
                  const agent = findAgent(rec.agentId);
                  return (
                    <div key={`addon-${i}`} style={{
                      background: `${C.gold}10`, borderRadius: 11, padding: '10px 12px',
                      border: `1px solid ${C.gold}40`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: agent?.color ? `${agent.color}20` : C.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                          {agent?.emoji ?? '🤖'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{rec.agentName}</div>
                          <div style={{ fontSize: 10, color: C.inkSoft, fontStyle: 'italic' }}>{rec.role}</div>
                        </div>
                        {agent && (
                          <button onClick={() => onAddToCart(agent)} style={{
                            background: C.gold, color: C.cream, border: 'none', borderRadius: 7,
                            padding: '5px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3,
                          }}>
                            <Plus size={10} /> $5
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: 10.5, color: C.ink, margin: 0, lineHeight: 1.5, paddingLeft: 38 }}>
                        {rec.why}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom pack hint */}
          {response?.customPackHint && (
            <div style={{
              marginTop: 12, padding: 12,
              background: `${C.violet}10`, border: `1.5px dashed ${C.violet}`, borderRadius: 12,
            }}>
              <div style={{ fontSize: 12, color: C.ink, marginBottom: 8 }}>
                🎨 <strong>Construis ton propre pack :</strong> {response.customPackHint}
              </div>
              <button onClick={() => { onClose(); onOpenCustom(); }} style={{
                background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`, color: C.cream, border: 'none', borderRadius: 10,
                padding: '8px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Ouvrir le builder →
              </button>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ flexShrink: 0, padding: '14px 18px', background: C.cream, borderTop: '1px solid rgba(10,42,32,0.08)', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            disabled={loading}
            placeholder="Ex: je tiens un restaurant à Abidjan, je perds du temps avec WhatsApp et la livraison…"
            style={{
              flex: 1, padding: '11px 14px', fontSize: 13, color: C.ink, fontFamily: 'inherit',
              background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', borderRadius: 11, outline: 'none',
            }}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={{
            background: loading || !input.trim() ? 'rgba(10,42,32,0.1)' : `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
            color: loading || !input.trim() ? C.inkLight : C.cream,
            border: 'none', borderRadius: 11, padding: '0 16px', fontSize: 13, fontWeight: 700,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Send size={14} /> {loading ? '…' : 'Envoyer'}
          </button>
        </div>
        <style>{`@keyframes advisorPulse { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }`}</style>
      </div>
    </>
  );
}

// ============ CUSTOM PACK BUILDER ============
// User picks 4 agents from the catalog + up to 3 add-ons, gets a custom $20/mo bundle
// added to their cart. Created-on-the-fly bundles get id "custom-{timestamp}".
function CustomPackBuilder({ open, onClose, onAddToCart, presetAgentIds, presetName }: any) {
  const { agents } = useMarketplace();
  const [selectedAgents, setSelectedAgents] = useState<string[]>(Array.isArray(presetAgentIds) ? presetAgentIds.slice(0, 4) : []);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [packName, setPackName] = useState(presetName ?? 'Mon Pack Personnalisé');

  // Re-init when a preset is provided (opening from "Modifier mes agents")
  useEffect(() => {
    if (open && Array.isArray(presetAgentIds)) {
      setSelectedAgents(presetAgentIds.slice(0, 4));
      if (presetName) setPackName(presetName);
    }
  }, [open, presetAgentIds, presetName]);

  if (!open) return null;

  const allAgents = (agents ?? []).filter((a: any) => a.id !== 'a19'); // exclude demo
  const selectedAgentObjects = allAgents.filter((a: any) => selectedAgents.includes(a.id));
  const selectedAddonObjects = allAgents.filter((a: any) => selectedAddons.includes(a.id));
  const ready = selectedAgents.length === 4;
  const totalPrice = 20 + selectedAddons.length * 5;

  const toggleAgent = (id: string) => {
    if (selectedAgents.includes(id)) {
      setSelectedAgents(selectedAgents.filter(x => x !== id));
    } else if (selectedAgents.length < 4) {
      setSelectedAgents([...selectedAgents, id]);
      // Auto-remove from add-ons if was there
      setSelectedAddons(selectedAddons.filter(x => x !== id));
    }
  };

  const toggleAddon = (id: string) => {
    if (selectedAddons.includes(id)) {
      setSelectedAddons(selectedAddons.filter(x => x !== id));
    } else if (selectedAddons.length < 3 && !selectedAgents.includes(id)) {
      setSelectedAddons([...selectedAddons, id]);
    }
  };

  const handleActivate = () => {
    if (!ready) return;
    const customBundle = {
      id: `custom-${Date.now()}`,
      name: packName.trim() || 'Mon Pack Personnalisé',
      tagline: '4 agents choisis par vous',
      desc: `Pack personnalisé avec : ${selectedAgentObjects.map((a: any) => a.name).join(', ')}.${selectedAddonObjects.length > 0 ? ' Add-ons : ' + selectedAddonObjects.map((a: any) => a.name).join(', ') + '.' : ''}`,
      emoji: '🎨',
      color: '#7C3AED',
      accentColor: '#C4B5FD',
      agentCount: 4,
      agents: selectedAgentObjects.map((a: any) => a.emoji),
      agentNames: selectedAgentObjects.map((a: any) => a.name),
      agentIds: selectedAgents,
      addonAgentIds: selectedAddons,
      originalPrice: totalPrice,
      bundlePrice: totalPrice,
      discount: 0,
      currency: 'USD',
      period: 'mo',
      addonPrice: 5,
      category: 'commerce',
      featured: false,
      africa: true,
      popular: false,
      byoe: true,
      isCustom: true,
    };
    onAddToCart(customBundle);
    setSelectedAgents([]);
    setSelectedAddons([]);
    setPackName('Mon Pack Personnalisé');
    onClose();
  };

  return (
    <>
      <div className="fade-in" onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, backdropFilter: 'blur(8px)',
      }} />
      <div className="scale-in" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '92vw', maxWidth: 920, maxHeight: '90vh',
        background: C.cream, borderRadius: 24, overflow: 'hidden', zIndex: 201,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 60px -20px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 100%)`,
          color: C.cream, padding: '20px 28px',
          display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,250,240,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎨</div>
          <div style={{ flex: 1 }}>
            <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Construis ton pack <em style={{ fontStyle: 'italic', fontWeight: 500 }}>sur mesure</em>
            </h2>
            <p style={{ fontSize: 12, opacity: 0.9, margin: '2px 0 0' }}>
              Choisis 4 agents · $20/mo · Ajoute jusqu'à 3 add-ons à $5/mo
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,250,240,0.15)', border: 'none', color: C.cream, width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {/* Pack name */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              NOM DU PACK
            </label>
            <input value={packName} onChange={e => setPackName(e.target.value)} maxLength={40} style={{
              width: '100%', padding: '12px 14px', fontSize: 15, fontWeight: 600, color: C.ink,
              background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', borderRadius: 10,
              fontFamily: 'inherit',
            }} />
          </div>

          {/* Section 1: 4 agents */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
                Étape 1 — Choisis tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>4 agents</em>
              </h3>
              <span className="mono-font" style={{
                fontSize: 13, fontWeight: 800,
                color: ready ? C.emerald : C.violet,
                padding: '4px 10px', borderRadius: 100,
                background: ready ? '#D1FAE5' : C.violetSoft,
              }}>
                {selectedAgents.length} / 4
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {allAgents.map((a: any) => {
                const picked = selectedAgents.includes(a.id);
                const disabled = !picked && selectedAgents.length >= 4;
                return (
                  <div key={a.id} onClick={() => !disabled && toggleAgent(a.id)} style={{
                    background: picked ? `${C.violet}10` : C.cream,
                    border: picked ? `2px solid ${C.violet}` : '1.5px solid rgba(10,42,32,0.06)',
                    borderRadius: 12, padding: '10px 12px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                    display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: a.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {a.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: C.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.category}</div>
                    </div>
                    {picked && <CheckCircle2 size={16} color={C.violet} style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: add-ons */}
          {ready && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
                  Étape 2 — Add-ons <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>(optionnel, $5/mo chacun)</em>
                </h3>
                <span className="mono-font" style={{
                  fontSize: 13, fontWeight: 800, color: C.gold,
                  padding: '4px 10px', borderRadius: 100, background: C.goldSoft,
                }}>
                  {selectedAddons.length} / 3
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {allAgents.filter((a: any) => !selectedAgents.includes(a.id)).map((a: any) => {
                  const picked = selectedAddons.includes(a.id);
                  const disabled = !picked && selectedAddons.length >= 3;
                  return (
                    <div key={a.id} onClick={() => !disabled && toggleAddon(a.id)} style={{
                      background: picked ? `${C.gold}10` : C.cream,
                      border: picked ? `2px solid ${C.gold}` : '1.5px solid rgba(10,42,32,0.06)',
                      borderRadius: 12, padding: '8px 12px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.4 : 1,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <span style={{ fontSize: 16 }}>{a.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{a.name}</div>
                      </div>
                      <span className="mono-font" style={{ fontSize: 10, color: picked ? C.gold : C.inkLight, fontWeight: 700 }}>+$5</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer — sticky activation bar */}
        <div style={{
          flexShrink: 0, background: C.creamDeep, borderTop: '1px solid rgba(10,42,32,0.08)',
          padding: '16px 28px',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="display-font mono-font" style={{ fontSize: 28, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
              ${totalPrice}<span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
              {selectedAgents.length > 0 && selectedAgents.length < 4 && `Ajoute ${4 - selectedAgents.length} agent${4 - selectedAgents.length > 1 ? 's' : ''} pour activer`}
              {ready && selectedAddons.length > 0 && `Pack + ${selectedAddons.length} add-on${selectedAddons.length > 1 ? 's' : ''}`}
              {ready && selectedAddons.length === 0 && '4 agents · BYOE'}
              {selectedAgents.length === 0 && 'Commence par sélectionner tes agents'}
            </div>
          </div>
          <button onClick={handleActivate} disabled={!ready} style={{
            background: ready ? `linear-gradient(135deg, ${C.violet}, ${C.pink})` : 'rgba(10,42,32,0.1)',
            color: ready ? C.cream : C.inkLight,
            border: 'none', padding: '14px 28px', borderRadius: 12,
            fontSize: 14, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: ready ? `0 8px 24px -8px ${C.violet}` : 'none',
          }}>
            <Sparkles size={14} fill={ready ? C.cream : 'transparent'} />
            {ready ? `Activer mon pack ($${totalPrice}/mo)` : 'Sélectionne 4 agents'}
          </button>
        </div>
      </div>
    </>
  );
}

// ============ BUNDLE DETAILS MODAL ============
function BundleModal({ bundle, onClose, onAddToCart, onCustomize, inCart }: any) {
  if (!bundle) return null;

  return (
    <>
      <div className="fade-in" onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)', zIndex: 200,
        backdropFilter: 'blur(8px)',
      }}></div>

      <div className="scale-in" style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%', maxWidth: 720, maxHeight: '90vh',
        background: C.cream, borderRadius: 24,
        zIndex: 201, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 80px -20px rgba(0,0,0,0.5)',
      }}>
        {/* Hero header */}
        <div className="grain" style={{
          background: `linear-gradient(135deg, ${bundle.color} 0%, ${bundle.color}dd 100%)`,
          padding: '32px 36px',
          color: C.cream, position: 'relative', overflow: 'hidden',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 18, right: 18,
            width: 38, height: 38, borderRadius: 11,
            background: 'rgba(255,250,240,0.2)',
            border: '1px solid rgba(255,250,240,0.3)',
            color: C.cream, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2,
          }}>
            <X size={18} />
          </button>

          <svg style={{ position: 'absolute', right: -40, top: -40, opacity: 0.15 }} width="280" height="280" viewBox="0 0 280 280">
            <circle cx="140" cy="140" r="120" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="140" cy="140" r="80" stroke={C.cream} strokeWidth="1" fill="none" />
          </svg>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 90, height: 90, borderRadius: 22,
              background: 'rgba(255,250,240,0.15)',
              backdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(255,250,240,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 50, flexShrink: 0,
            }}>{bundle.emoji}</div>

            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="pill" style={{ background: 'rgba(255,250,240,0.2)', color: C.cream }}>
                  <Package size={10} /> BUNDLE · {bundle.agentCount} AGENTS
                </span>
                {bundle.popular && (
                  <span className="pill" style={{ background: C.gold, color: C.cream }}>
                    <Flame size={10} /> POPULAIRE
                  </span>
                )}
              </div>
              <h2 className="display-font" style={{
                fontSize: 32, fontWeight: 800, color: C.cream,
                margin: '0 0 4px', lineHeight: 1, letterSpacing: '-0.02em',
              }}>{bundle.name}</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,250,240,0.9)', margin: 0 }}>
                {bundle.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="scroll-hide" style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6, margin: '0 0 24px' }}>
            {bundle.desc}
          </p>

          {/* Agents inclus */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 12 }}>
              📦 AGENTS INCLUS DANS CE BUNDLE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bundle.agents.map((emoji, i) => (
                <div key={i} style={{
                  background: C.creamDeep, borderRadius: 12,
                  padding: 14, display: 'flex', alignItems: 'center', gap: 12,
                  borderLeft: `3px solid ${bundle.color}`,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 11,
                    background: `linear-gradient(135deg, ${bundle.color}, ${bundle.color}cc)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                    boxShadow: `0 6px 12px -3px ${bundle.color}`,
                  }}>{emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                      {bundle.agentNames[i]}
                    </div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>
                      Inclus dans le bundle · Activation automatique
                    </div>
                  </div>
                  <CheckCircle2 size={20} color={bundle.color} />
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div style={{
            padding: 20,
            background: `linear-gradient(135deg, ${bundle.color}10, ${bundle.color}05)`,
            borderRadius: 16,
            border: `1.5px solid ${bundle.color}30`,
            marginBottom: 20,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: 12, background: C.cream, borderRadius: 10 }}>
                <div className="mono-font" style={{ fontSize: 11, color: C.inkLight, textDecoration: 'line-through', fontWeight: 600 }}>
                  {formatFCFA(bundle.originalPrice)}
                </div>
                <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, marginTop: 4, letterSpacing: '0.05em' }}>PRIX SÉPARÉ</div>
              </div>
              <div style={{
                textAlign: 'center', padding: 12,
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
                color: C.cream, borderRadius: 10,
                boxShadow: `0 6px 16px -4px ${C.gold}`,
              }}>
                <div className="mono-font display-font" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                  −{bundle.discount}%
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, marginTop: 4, opacity: 0.95, letterSpacing: '0.05em' }}>ÉCONOMIE</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: C.cream, borderRadius: 10 }}>
                <div className="mono-font display-font" style={{ fontSize: 22, fontWeight: 800, color: bundle.color, lineHeight: 1, letterSpacing: '-0.01em' }}>
                  {formatFCFA(bundle.bundlePrice)}
                </div>
                <div style={{ fontSize: 9, color: bundle.color, fontWeight: 700, marginTop: 4, letterSpacing: '0.05em' }}>PRIX BUNDLE/MO</div>
              </div>
            </div>
          </div>

          {/* Social proof */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{
              background: C.creamDeep, padding: 12, borderRadius: 10,
              flex: 1, minWidth: 140, textAlign: 'center',
            }}>
              <Users2 size={18} color={C.violet} style={{ margin: '0 auto 4px', display: 'block' }} />
              <div className="mono-font display-font" style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>247</div>
              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>PME utilisatrices</div>
            </div>
            <div style={{
              background: C.creamDeep, padding: 12, borderRadius: 10,
              flex: 1, minWidth: 140, textAlign: 'center',
            }}>
              <Star size={18} fill={C.gold} color={C.gold} style={{ margin: '0 auto 4px', display: 'block' }} />
              <div className="mono-font display-font" style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>4.8</div>
              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>Note moyenne</div>
            </div>
            <div style={{
              background: C.creamDeep, padding: 12, borderRadius: 10,
              flex: 1, minWidth: 140, textAlign: 'center',
            }}>
              <TrendingUp size={18} color={C.emerald} style={{ margin: '0 auto 4px', display: 'block' }} />
              <div className="mono-font display-font" style={{ fontSize: 16, fontWeight: 800, color: C.emerald }}>+12</div>
              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>Ajouts cette semaine</div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ padding: 20, borderTop: '1px solid rgba(10,42,32,0.08)', display: 'flex', gap: 10, background: C.cream, flexWrap: 'wrap' }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: 12 }}>
            Fermer
          </button>
          {onCustomize && (
            <button onClick={() => onCustomize(bundle)} className="btn-secondary" style={{
              padding: 12, fontSize: 13, color: C.violet, borderColor: C.violet, background: 'transparent',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Edit3 size={14} /> Modifier mes agents
            </button>
          )}
          <button onClick={() => onAddToCart(bundle)} disabled={inCart} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12, fontSize: 14 }}>
            {inCart ? (
              <><CheckCircle2 size={16} /> Déjà dans le panier</>
            ) : (
              <><ShoppingCart size={16} /> Ajouter au panier · {formatFCFA(bundle.bundlePrice)} /mo</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ============ AGENT DETAILS MODAL ============
function AgentModal({ agent, onClose, onAddToCart, onInstall, inCart, installed }: any) {
  const { agents } = useMarketplace();
  if (!agent) return null;

  // Find similar agents
  const similar = agents.filter((a: any) => a.category === agent.category && a.id !== agent.id).slice(0, 3);

  return (
    <>
      <div className="fade-in" onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)', zIndex: 200,
        backdropFilter: 'blur(8px)',
      }}></div>

      <div className="scale-in" style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%', maxWidth: 760, maxHeight: '90vh',
        background: C.cream, borderRadius: 24,
        zIndex: 201, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 80px -20px rgba(0,0,0,0.5)',
      }}>
        {/* Hero */}
        <div className="grain" style={{
          background: `linear-gradient(135deg, ${agent.color} 0%, ${agent.color}dd 100%)`,
          padding: '32px 36px',
          color: C.cream, position: 'relative', overflow: 'hidden',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 18, right: 18,
            width: 38, height: 38, borderRadius: 11,
            background: 'rgba(255,250,240,0.2)',
            border: '1px solid rgba(255,250,240,0.3)',
            color: C.cream, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2,
          }}>
            <X size={18} />
          </button>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 96, height: 96, borderRadius: 24,
              background: 'rgba(255,250,240,0.15)',
              backdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(255,250,240,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 56, flexShrink: 0,
            }}>{agent.emoji}</div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {agent.installed && (
                  <span className="pill" style={{ background: C.cream, color: C.emeraldDeep }}>
                    <CheckCheck size={10} /> INSTALLÉ
                  </span>
                )}
                {agent.status === 'included' && (
                  <span className="pill" style={{ background: C.cream, color: C.violetDeep }}>
                    <BadgeCheck size={10} /> INCLUS ENTERPRISE
                  </span>
                )}
                {agent.trending && (
                  <span className="pill" style={{ background: C.gold, color: C.cream }}>
                    <Flame size={10} /> TRENDING
                  </span>
                )}
              </div>
              <h2 className="display-font" style={{
                fontSize: 32, fontWeight: 800, color: C.cream,
                margin: '0 0 4px', lineHeight: 1, letterSpacing: '-0.02em',
              }}>{agent.name}</h2>
              <div style={{ fontSize: 13, color: 'rgba(255,250,240,0.9)' }}>
                Par <strong style={{ color: C.gold }}>{agent.creator}</strong>
                {agent.creator === 'Orlode' && <BadgeCheck size={13} color={C.gold} style={{ display: 'inline', marginLeft: 4, verticalAlign: 'middle' }} />}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="scroll-hide" style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ background: C.creamDeep, padding: 12, borderRadius: 10, flex: 1, minWidth: 100, textAlign: 'center' }}>
              <Star size={18} fill={C.gold} color={C.gold} style={{ margin: '0 auto 4px', display: 'block' }} />
              <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{agent.rating || '—'}</div>
              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>{agent.reviews} reviews</div>
            </div>
            <div style={{ background: C.creamDeep, padding: 12, borderRadius: 10, flex: 1, minWidth: 100, textAlign: 'center' }}>
              <Download size={18} color={C.violet} style={{ margin: '0 auto 4px', display: 'block' }} />
              <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{agent.installs}</div>
              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>installations</div>
            </div>
            <div style={{ background: C.creamDeep, padding: 12, borderRadius: 10, flex: 1, minWidth: 100, textAlign: 'center' }}>
              <Tag size={18} color={C.gold} style={{ margin: '0 auto 4px', display: 'block' }} />
              <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, textTransform: 'capitalize' }}>{agent.category}</div>
              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>catégorie</div>
            </div>
          </div>

          <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6, margin: '0 0 20px' }}>
            {agent.desc}
          </p>

          {/* Features */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
              ⚡ FONCTIONNALITÉS PRINCIPALES
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {agent.features.map((f, i) => (
                <div key={i} style={{
                  background: C.creamDeep, padding: '10px 14px',
                  borderRadius: 10, fontSize: 12, fontWeight: 600, color: C.ink,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <CheckCircle2 size={13} color={agent.color} /> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Required connectors */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
              🔌 CONNECTEURS REQUIS
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['💚 WhatsApp', '📧 Gmail', '📅 Calendar'].map((c, i) => (
                <div key={i} style={{
                  background: C.emeraldSoft, color: C.emeraldDeep,
                  padding: '8px 14px', borderRadius: 10,
                  fontSize: 12, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <CheckCircle2 size={13} /> {c}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.inkSoft, margin: '8px 0 0' }}>
              ✅ Tous les connecteurs requis sont déjà configurés dans votre Orlode
            </p>
          </div>

          {/* Similar agents */}
          {similar.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
                🤝 AGENTS SIMILAIRES
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {similar.map(s => (
                  <div key={s.id} style={{
                    background: C.creamDeep, padding: 12, borderRadius: 10,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, flexShrink: 0,
                    }}>{s.emoji}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </div>
                      <div className="mono-font" style={{ fontSize: 10, color: C.inkSoft }}>
                        {s.price === 0 ? 'Inclus' : `${formatFCFA(s.price)} /mo`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div style={{ padding: 20, borderTop: '1px solid rgba(10,42,32,0.08)', display: 'flex', gap: 10, background: C.cream, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0 }}>
            {agent.status === 'included' ? (
              <>
                <div className="mono-font display-font" style={{ fontSize: 22, fontWeight: 800, color: C.violetDeep, lineHeight: 1, letterSpacing: '-0.01em' }}>
                  Inclus
                </div>
                <div style={{ fontSize: 10, color: C.inkSoft }}>dans Enterprise</div>
              </>
            ) : agent.status === 'free' ? (
              <>
                <div className="mono-font display-font" style={{ fontSize: 22, fontWeight: 800, color: C.emerald, lineHeight: 1 }}>
                  Gratuit
                </div>
                <div style={{ fontSize: 10, color: C.inkSoft }}>Sans engagement</div>
              </>
            ) : (
              <>
                <div className="mono-font display-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.01em' }}>
                  {formatFCFA(agent.price)}
                </div>
                <div style={{ fontSize: 10, color: C.inkSoft }}>/mois · Annulable</div>
              </>
            )}
          </div>
          <div style={{ flex: 1 }}></div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: 12 }}>
            Fermer
          </button>
          {(agent.installed || installed) ? (
            <button disabled style={{
              background: C.emeraldSoft, color: C.emeraldDeep,
              padding: '12px 18px', borderRadius: 12,
              border: 'none', fontWeight: 700, fontSize: 14, cursor: 'default',
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <CheckCircle2 size={16} /> Déjà installé
            </button>
          ) : agent.status === 'included' || agent.status === 'free' ? (
            <button onClick={() => onInstall && onInstall(agent)} className="btn-primary" style={{ padding: '12px 18px' }}>
              <Download size={16} /> Installer
            </button>
          ) : (
            <button onClick={() => onAddToCart(agent)} disabled={inCart} className="btn-primary" style={{ padding: '12px 18px' }}>
              {inCart ? <><CheckCircle2 size={16} /> Dans le panier</> : <><ShoppingCart size={16} /> Ajouter au panier</>}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
// ============ CHECKOUT MODAL ============
// Payment method picker with grouping: top-level options visible immediately,
// "Mobile Money" expands to provider sub-options (Orange Money / Wave / MTN / Moov).
// Adds PayPal, Zelle and Cash App as new top-level options.
const MOBILE_MONEY_PROVIDERS: Array<{ id: string; name: string; desc: string; emoji: string; color: string; popular?: boolean; recommended?: boolean }> = [
  { id: 'wave',         name: 'Wave',         desc: 'Sénégal · CI · Sans frais',    emoji: '🌊', color: '#06B6D4', popular: true },
  { id: 'orange_money', name: 'Orange Money', desc: 'CI · Sénégal · Mali',          emoji: '🟠', color: '#F97316', recommended: true },
  { id: 'mtn',          name: 'MTN MoMo',     desc: 'CI · Cameroun · Bénin',        emoji: '🟡', color: '#FBBF24' },
  { id: 'moov',         name: 'Moov Money',   desc: 'CI · Bénin · Togo',            emoji: '🔵', color: '#0EA5E9' },
];

function PaymentMethodPicker({ paymentMethod, setPaymentMethod }: { paymentMethod: string; setPaymentMethod: (m: string) => void }) {
  const isMobileMoney = MOBILE_MONEY_PROVIDERS.some(p => p.id === paymentMethod);
  const [mmExpanded, setMmExpanded] = useState<boolean>(isMobileMoney);

  const topLevel: Array<{ id: string; name: string; desc: string; emoji: string; color: string; recommended?: boolean; popular?: boolean; group?: 'mobile_money' }> = [
    { id: 'mobile_money', name: 'Mobile Money',  desc: 'Orange · Wave · MTN · Moov',                        emoji: '📱', color: '#10B981', popular: true, group: 'mobile_money' },
    { id: 'stripe',       name: 'Carte bancaire', desc: 'Visa · Mastercard · 3D Secure (Stripe)',           emoji: '💳', color: '#7C3AED', recommended: true },
    { id: 'paypal',       name: 'PayPal',         desc: 'Compte PayPal ou carte via PayPal',                emoji: '🅿️', color: '#003087' },
    { id: 'zelle',        name: 'Zelle',          desc: 'Virement bancaire instantané US',                  emoji: '⚡', color: '#6D1ED4' },
    { id: 'cashapp',      name: 'Cash App',       desc: 'Cash App Pay (USA)',                                emoji: '💵', color: '#00D632' },
  ];

  const handleTopLevel = (m: typeof topLevel[number]) => {
    if (m.group === 'mobile_money') {
      setMmExpanded(prev => !prev);
      // Pre-select the recommended provider if user just opens the group
      if (!isMobileMoney) {
        const reco = MOBILE_MONEY_PROVIDERS.find(p => p.recommended) ?? MOBILE_MONEY_PROVIDERS[0];
        if (reco) setPaymentMethod(reco.id);
      }
    } else {
      setPaymentMethod(m.id);
      setMmExpanded(false);
    }
  };

  return (
    <div className="stagger">
      <div style={{ fontSize: 11, fontWeight: 700, color: '#5A6B62', letterSpacing: '0.08em', marginBottom: 12 }}>
        💳 MÉTHODE DE PAIEMENT
      </div>

      {topLevel.map(m => {
        const isMM = m.group === 'mobile_money';
        const active = isMM ? isMobileMoney : paymentMethod === m.id;
        return (
          <React.Fragment key={m.id}>
            <button onClick={() => handleTopLevel(m)} style={{
              width: '100%', padding: 16, borderRadius: 14,
              background: active ? `${m.color}10` : '#F5EDD6',
              border: active ? `2px solid ${m.color}` : '2px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 14,
              marginBottom: 8, transition: 'all 0.15s ease',
              position: 'relative',
            }}>
              {m.recommended && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'linear-gradient(135deg, #FBBF24, #D97706)',
                  color: '#FFFAF0', padding: '2px 7px', borderRadius: 100,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                }}>RECOMMANDÉ</div>
              )}
              {m.popular && !m.recommended && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: '#CFFAFE', color: '#0891B2',
                  padding: '2px 7px', borderRadius: 100,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                }}>POPULAIRE</div>
              )}
              <div style={{ fontSize: 32, flexShrink: 0 }}>{m.emoji}</div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0A2A20', marginBottom: 2 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: '#5A6B62' }}>{m.desc}</div>
              </div>
              {isMM ? (
                <ChevronDown size={18} color={active ? m.color : '#94A3A0'} style={{ transform: mmExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              ) : active ? (
                <CheckCircle2 size={20} color={m.color} />
              ) : null}
            </button>

            {/* Mobile Money sub-providers — visible when group expanded */}
            {isMM && mmExpanded && (
              <div style={{ paddingLeft: 16, marginBottom: 8, marginTop: -4 }}>
                {MOBILE_MONEY_PROVIDERS.map(p => {
                  const sActive = paymentMethod === p.id;
                  return (
                    <button key={p.id} onClick={() => setPaymentMethod(p.id)} style={{
                      width: '100%', padding: 12, borderRadius: 10,
                      background: sActive ? `${p.color}10` : 'transparent',
                      border: sActive ? `1.5px solid ${p.color}` : '1.5px solid rgba(10,42,32,0.08)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 12,
                      marginBottom: 6, transition: 'all 0.15s ease',
                      position: 'relative',
                    }}>
                      {p.recommended && (
                        <div style={{ position: 'absolute', top: 6, right: 6, background: 'linear-gradient(135deg, #FBBF24, #D97706)', color: '#FFFAF0', padding: '1px 6px', borderRadius: 100, fontSize: 8, fontWeight: 700 }}>RECO</div>
                      )}
                      {p.popular && !p.recommended && (
                        <div style={{ position: 'absolute', top: 6, right: 6, background: '#CFFAFE', color: '#0891B2', padding: '1px 6px', borderRadius: 100, fontSize: 8, fontWeight: 700 }}>POPULAIRE</div>
                      )}
                      <div style={{ fontSize: 22, flexShrink: 0 }}>{p.emoji}</div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0A2A20' }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: '#5A6B62' }}>{p.desc}</div>
                      </div>
                      {sActive && <CheckCircle2 size={16} color={p.color} />}
                    </button>
                  );
                })}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Phone input for mobile money */}
      {isMobileMoney && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5A6B62', letterSpacing: '0.08em', marginBottom: 6 }}>
            NUMÉRO DE TÉLÉPHONE
          </div>
          <input placeholder="+225 07 XX XX XX XX" className="input-field" defaultValue="+225 " />
        </div>
      )}

      {/* Zelle / Cash App: show specific instructions */}
      {paymentMethod === 'zelle' && (
        <div style={{ marginTop: 14, padding: 12, background: '#F5EDD6', borderRadius: 10, fontSize: 12, color: '#5A6B62', lineHeight: 1.5 }}>
          <strong>Zelle :</strong> Tu recevras un email avec les coordonnées Zelle (mail / téléphone) pour effectuer ton virement. L'accès aux agents s'active sous 5 min après réception.
        </div>
      )}
      {paymentMethod === 'cashapp' && (
        <div style={{ marginTop: 14, padding: 12, background: '#F5EDD6', borderRadius: 10, fontSize: 12, color: '#5A6B62', lineHeight: 1.5 }}>
          <strong>Cash App :</strong> Tu recevras le $cashtag Orlode pour effectuer le paiement. L'accès s'active sous 5 min après réception.
        </div>
      )}
    </div>
  );
}

function CheckoutModal({ cart, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('wave');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + (item.bundlePrice || item.price || 0), 0);
  const bundleSavings = cart.reduce((sum, item) => {
    if (item.originalPrice && item.bundlePrice) return sum + (item.originalPrice - item.bundlePrice);
    return sum;
  }, 0);
  const total = subtotal;

  // Maps the granular UI payment method to the backend's accepted methods.
  // Backend supports: 'stripe' | 'paypal' | 'wave' | 'manual'.
  // Mobile money providers all route through Wave (which handles Orange/MTN/Moov in WAEMU/CEMAC).
  // Zelle / Cash App fall back to 'manual' (admin confirms after off-platform transfer).
  const mapToBackendMethod = (uiMethod: string): { method: 'stripe' | 'paypal' | 'wave' | 'manual'; paymentMethodTag: string } => {
    if (uiMethod === 'stripe' || uiMethod === 'paypal' || uiMethod === 'wave') {
      return { method: uiMethod as any, paymentMethodTag: uiMethod };
    }
    if (['orange_money', 'mtn', 'moov'].includes(uiMethod)) {
      return { method: 'wave', paymentMethodTag: uiMethod };
    }
    return { method: 'manual', paymentMethodTag: uiMethod };
  };

  const handleConfirm = async () => {
    setProcessing(true);
    setErrorMsg(null);
    const { method, paymentMethodTag } = mapToBackendMethod(paymentMethod);
    try {
      let firstRedirectUrl: string | null = null;
      for (const item of cart) {
        const isBundle = !!item.bundlePrice;
        const url = isBundle ? `/marketplace/bundles/${item.id}/checkout` : `/marketplace/agents/${item.id}/checkout`;
        const r: any = await api.post(url, { method, paymentMethod: paymentMethodTag });
        const data = r?.data ?? {};
        // Stripe / PayPal / Wave return a checkoutUrl — redirect to first one.
        if (!firstRedirectUrl && data?.checkoutUrl) firstRedirectUrl = data.checkoutUrl;
      }

      if (firstRedirectUrl) {
        // Hosted checkout — leave page for Stripe/PayPal/Wave
        window.location.href = firstRedirectUrl;
        return;
      }

      // Manual / local-only flow (zelle, cashapp) — show success immediately
      setProcessing(false);
      setSuccess(true);
      setTimeout(() => onSuccess(), 2200);
    } catch (e: any) {
      setProcessing(false);
      setErrorMsg(e?.response?.data?.message ?? e?.message ?? 'Échec du paiement');
    }
  };

  const handleOtpChange = (i, v) => {
    if (v.length > 1) return;
    const newOtp = [...otp];
    newOtp[i] = v;
    setOtp(newOtp);
    // Auto-focus next
    if (v && i < 5) {
      const next = document.getElementById(`otp-${i + 1}`);
      if (next) next.focus();
    }
  };

  return (
    <>
      <div className="fade-in" style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.8)', zIndex: 200,
        backdropFilter: 'blur(12px)',
      }}></div>

      <div className="scale-in" style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '95%', maxWidth: 720, maxHeight: '92vh',
        background: C.cream, borderRadius: 24,
        zIndex: 201, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 80px -20px rgba(0,0,0,0.6)',
      }}>
        {/* Success state */}
        {success ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div className="trophy-shine" style={{
              width: 120, height: 120, borderRadius: 32,
              background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
              color: C.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: `0 20px 40px -10px ${C.emerald}`,
            }}>
              <CheckCircle2 size={60} />
            </div>
            <h3 className="display-font" style={{ fontSize: 36, fontWeight: 800, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.03em' }}>
              Paiement <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.emerald }}>réussi !</em>
            </h3>
            <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 20px' }}>
              <strong style={{ color: C.ink }}>{cart.length} agent{cart.length > 1 ? 's' : ''}</strong> en cours d'installation dans votre Orlode...
            </p>
            <div style={{
              background: C.creamDeep, borderRadius: 14, padding: 16,
              maxWidth: 400, margin: '0 auto',
              border: `1.5px solid ${C.emerald}30`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.emeraldDeep, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>
                <Loader2 size={14} className="spinner" /> INSTALLATION EN COURS
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
                Vos agents seront disponibles dans votre <strong>AI Chat</strong> dans quelques secondes. Vous recevrez un récapitulatif par WhatsApp.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Header + stepper */}
            <div style={{
              padding: '24px 28px',
              background: `linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 100%)`,
              color: C.cream, position: 'relative',
            }}>
              <button onClick={onClose} style={{
                position: 'absolute', top: 18, right: 18,
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255,250,240,0.2)',
                border: '1px solid rgba(255,250,240,0.3)',
                color: C.cream, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={16} />
              </button>

              <h3 className="display-font" style={{ fontSize: 22, fontWeight: 800, color: C.cream, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
                Finaliser la <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>commande</em>
              </h3>

              {/* Stepper */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { num: 1, label: 'Récap' },
                  { num: 2, label: 'Paiement' },
                  { num: 3, label: 'Validation' },
                ].map(s => {
                  const active = step === s.num;
                  const done = step > s.num;
                  return (
                    <div key={s.num} style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8,
                      background: active ? 'rgba(255,250,240,0.25)' : (done ? 'rgba(212,160,23,0.3)' : 'rgba(255,250,240,0.08)'),
                      border: active ? '1.5px solid rgba(255,250,240,0.4)' : '1.5px solid transparent',
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 12, fontWeight: 700,
                      color: C.cream,
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: active ? C.cream : (done ? C.gold : 'rgba(255,250,240,0.2)'),
                        color: active ? C.violet : (done ? C.cream : C.cream),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800,
                      }}>
                        {done ? <CheckCircle2 size={12} /> : s.num}
                      </div>
                      {s.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="scroll-hide" style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

              {/* STEP 1 — Récap */}
              {step === 1 && (
                <div className="stagger">
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 12 }}>
                    🛒 VOTRE COMMANDE · {cart.length} ARTICLE{cart.length > 1 ? 'S' : ''}
                  </div>

                  {cart.map((item, idx) => {
                    const isBundle = !!item.bundlePrice;
                    return (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: 12, background: C.creamDeep, borderRadius: 12,
                        marginBottom: 8, borderLeft: `3px solid ${item.color}`,
                      }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 11,
                          background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22, flexShrink: 0,
                        }}>{item.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                            {item.name}
                            {isBundle && <span className="pill" style={{ background: C.goldSoft, color: C.goldDeep, marginLeft: 6, fontSize: 9 }}>BUNDLE</span>}
                          </div>
                          <div style={{ fontSize: 11, color: C.inkSoft }}>
                            {item.tagline || (item.desc && item.desc.slice(0, 50) + '...')}
                          </div>
                        </div>
                        <div className="mono-font display-font" style={{ fontSize: 16, fontWeight: 800, color: C.ink, flexShrink: 0 }}>
                          {formatFCFA(item.bundlePrice || item.price)}
                        </div>
                      </div>
                    );
                  })}

                  {/* Totals */}
                  <div style={{
                    padding: 18, background: `linear-gradient(135deg, ${C.violetSoft}, ${C.cream})`,
                    borderRadius: 14, border: `1.5px solid ${C.violet}30`,
                    marginTop: 14,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: C.inkSoft }}>
                      <span>Sous-total</span>
                      <span className="mono-font">{formatFCFA(subtotal)}</span>
                    </div>
                    {bundleSavings > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: C.gold }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Package size={11} /> Économies bundles
                        </span>
                        <span className="mono-font" style={{ fontWeight: 700 }}>−{formatFCFA(bundleSavings)}</span>
                      </div>
                    )}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      padding: '12px 0 0', marginTop: 6,
                      borderTop: '1px solid rgba(124,58,237,0.2)',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Total mensuel</span>
                      <span className="mono-font display-font" style={{
                        fontSize: 28, fontWeight: 800, color: C.violetDeep, letterSpacing: '-0.02em',
                      }}>
                        {formatFCFA(total)} <span style={{ fontSize: 14, color: C.inkSoft, fontWeight: 600 }}>/mo</span>
                      </span>
                    </div>
                  </div>

                  {/* Engagement info */}
                  <div style={{
                    padding: 12, background: C.creamDeep, borderRadius: 10,
                    display: 'flex', gap: 10, alignItems: 'center', marginTop: 12,
                  }}>
                    <Info size={16} color={C.blue} style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.5 }}>
                      Abonnement mensuel récurrent · Annulable à tout moment · Premier prélèvement aujourd'hui
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 — Payment method */}
              {step === 2 && (
                <PaymentMethodPicker
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                />
              )}

              {/* STEP 3 — OTP */}
              {step === 3 && (
                <div className="stagger" style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 22,
                    background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
                    color: C.cream,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                    boxShadow: `0 16px 32px -8px ${C.violet}`,
                  }}>
                    <Phone size={36} />
                  </div>
                  <h4 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                    Code <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>de vérification</em>
                  </h4>
                  <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 24px' }}>
                    Saisissez le code à 6 chiffres envoyé au <strong>+225 07 89 ** ** **</strong>
                  </p>

                  {/* OTP inputs */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        type="text"
                        maxLength={1}
                        value={d}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        style={{
                          width: 50, height: 56, borderRadius: 12,
                          background: C.creamDeep,
                          border: d ? `2px solid ${C.violet}` : '1.5px solid rgba(10,42,32,0.1)',
                          textAlign: 'center', fontSize: 22, fontWeight: 700,
                          color: C.ink, fontFamily: 'JetBrains Mono, monospace',
                          outline: 'none', transition: 'all 0.15s ease',
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: C.inkSoft }}>
                    Pas reçu ? <button onClick={() => toast.info('Code renvoyé au numéro saisi')} style={{ background: 'none', border: 'none', color: C.violet, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Renvoyer</button> · Timer: <span className="mono-font" style={{ fontWeight: 700 }}>00:58</span>
                  </div>

                  {/* Trust info */}
                  <div style={{
                    background: C.emeraldSoft, borderRadius: 12,
                    padding: 12, marginTop: 24,
                    display: 'flex', gap: 8, alignItems: 'center',
                    border: `1.5px solid ${C.emerald}30`,
                  }}>
                    <Shield size={16} color={C.emeraldDeep} style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: 11, color: C.emeraldDeep, fontWeight: 600, textAlign: 'left' }}>
                      Paiement sécurisé · Données chiffrées · Conforme OHADA
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {errorMsg && (
              <div style={{ padding: '0 20px 12px', background: C.cream }}>
                <div style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 10, padding: 10, fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{errorMsg}</span>
                </div>
              </div>
            )}
            <div style={{
              padding: 20, borderTop: '1px solid rgba(10,42,32,0.08)',
              display: 'flex', gap: 10, background: C.cream,
            }}>
              {step > 1 && (
                <button onClick={() => setStep(step - 1)} className="btn-secondary" style={{ padding: 12 }}>
                  <ArrowLeft size={14} /> Retour
                </button>
              )}
              <div style={{ flex: 1 }}></div>
              {step < 3 ? (
                <button onClick={() => setStep(step + 1)} className="btn-primary" style={{ padding: '12px 22px' }}>
                  Continuer <ArrowRight size={14} />
                </button>
              ) : (
                <button onClick={handleConfirm} disabled={processing} className="btn-primary" style={{ padding: '12px 22px' }}>
                  {processing ? (
                    <><Loader2 size={14} className="spinner" /> Validation…</>
                  ) : (
                    <><CheckCircle2 size={14} /> Confirmer · {formatFCFA(total)} /mo</>
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ============ FLOATING CART BUTTON ============
function FloatingCart({ count, total, onClick, bouncing }) {
  if (count === 0) return null;
  return (
    <button onClick={onClick} className={`mp-fab-cart ${bouncing ? 'cart-bounce' : ''}`} style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 50,
      background: `linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 100%)`,
      color: C.cream, border: 'none',
      borderRadius: 100, padding: '14px 22px',
      cursor: 'pointer', fontFamily: 'inherit',
      display: 'inline-flex', alignItems: 'center', gap: 12,
      boxShadow: `0 12px 32px -6px ${C.violet}80`,
      transition: 'all 0.2s ease',
    }}
    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)'; }}
    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(255,250,240,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <ShoppingCart size={18} fill={C.cream} />
        <span style={{
          position: 'absolute', top: -4, right: -4,
          background: C.gold, color: C.cream,
          minWidth: 20, height: 20, borderRadius: '50%',
          fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'JetBrains Mono, monospace',
          boxShadow: `0 0 0 2px ${C.violet}`,
        }}>{count}</span>
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, letterSpacing: '0.05em' }}>VOIR LE PANIER</div>
        <div className="mono-font" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.01em' }}>
          {formatFCFA(total)} /mo
        </div>
      </div>
    </button>
  );
}

// ============ TRENDING BAR (sticky social proof) ============
function TrendingBar() {
  const { agents, bundles } = useMarketplace();
  const palette = [C.orange, C.emerald, C.blue, C.cyan, C.violet, C.pink];
  // Build from real data: top 3 agents by installs + best bundle discount
  const topAgents = [...agents]
    .filter((a: any) => (a.installs ?? 0) > 0)
    .sort((a: any, b: any) => (b.installs ?? 0) - (a.installs ?? 0))
    .slice(0, 3);
  const bestBundle = [...bundles].sort((a: any, b: any) => (b.discount ?? 0) - (a.discount ?? 0))[0];
  const items: Array<{ emoji: string; text: string; color: string }> = [];
  topAgents.forEach((a: any, i: number) => {
    items.push({ emoji: a.emoji, text: `${a.name} · ${a.installs} install${a.installs > 1 ? 's' : ''}`, color: palette[i % palette.length] });
  });
  if (bestBundle && bestBundle.discount > 0) {
    items.push({ emoji: bestBundle.emoji, text: `Bundle ${bestBundle.name} · −${bestBundle.discount}%`, color: palette[items.length % palette.length] });
  }
  if (items.length === 0) return null;
  return (
    <div className="mp-section" style={{ padding: '24px 32px 0' }}>
      <div style={{
        background: C.cream, borderRadius: 14,
        padding: '12px 18px', border: '1px solid rgba(10,42,32,0.06)',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Flame size={16} color={C.orange} className="wiggle" />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>
            TENDANCES
          </span>
        </div>
        <div className="scroll-hide" style={{ flex: 1, display: 'flex', gap: 8, overflowX: 'auto' }}>
          {items.map((t, i) => (
            <div key={i} style={{
              flexShrink: 0,
              background: `${t.color}10`, color: t.color,
              padding: '6px 12px', borderRadius: 100,
              fontSize: 12, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: `1px solid ${t.color}20`,
            }}>
              <span style={{ fontSize: 14 }}>{t.emoji}</span> {t.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ DATA PROVIDER ============
function MarketplaceProvider({ children, installedIds }: { children: React.ReactNode; installedIds: Set<string> }) {
  const [agents, setAgents] = useState<any[]>(AGENTS_FALLBACK);
  const [bundles, setBundles] = useState<any[]>(BUNDLES_FALLBACK);
  const [categories, setCategories] = useState<any[]>(CATEGORIES_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      const safe = (p: Promise<any>): Promise<any> => p.catch(() => null);
      const [agentsRes, bundlesRes, categoriesRes] = await Promise.all([
        safe(api.get('/marketplace/agents')),
        safe(api.get('/marketplace/bundles')),
        safe(api.get('/marketplace/categories')),
      ]);
      if (!mounted) return;

      const rawAgents: any[] = Array.isArray(agentsRes?.data?.data) ? agentsRes.data.data : (Array.isArray(agentsRes?.data) ? agentsRes.data : []);
      const rawBundles: any[] = Array.isArray(bundlesRes?.data?.data) ? bundlesRes.data.data : (Array.isArray(bundlesRes?.data) ? bundlesRes.data : []);
      const rawCategoriesData = categoriesRes?.data?.data ?? categoriesRes?.data ?? null;

      const mappedAgents = rawAgents.map(mapServerAgent);
      const agentMap = new Map(mappedAgents.map((a: any) => [a.id, a]));
      const mappedBundles = rawBundles.map((b: any) => mapServerBundle(b, agentMap));

      // Build categories from agents (count agents per category)
      const categoryEmojis: Record<string, { label: string; emoji: string; color: string }> = {
        finance: { label: 'Finance', emoji: '💰', color: '#B45309' },
        commerce: { label: 'Commerce', emoji: '🛒', color: '#06B6D4' },
        sante: { label: 'Santé', emoji: '🏥', color: '#EF4444' },
        education: { label: 'Éducation', emoji: '🎓', color: '#0EA5E9' },
        agriculture: { label: 'Agriculture', emoji: '🌾', color: '#10B981' },
        mode: { label: 'Mode & Luxe', emoji: '👗', color: '#EC4899' },
        construction: { label: 'BTP', emoji: '🏗️', color: '#D4A017' },
        securite: { label: 'Sécurité', emoji: '🛡️', color: '#5B21B6' },
        beaute: { label: 'Beauté', emoji: '💄', color: '#DB2777' },
        logistique: { label: 'Logistique', emoji: '📦', color: '#0284C7' },
        restaurant: { label: 'Restauration', emoji: '🍽️', color: '#F97316' },
        industry: { label: 'Métier', emoji: '🏭', color: '#7C3AED' },
        general: { label: 'Général', emoji: '⚙️', color: '#64748B' },
      };
      const counts: Record<string, number> = {};
      mappedAgents.forEach((a: any) => {
        const k = a.category ?? 'general';
        counts[k] = (counts[k] ?? 0) + 1;
      });
      const dynCategories = [
        { id: 'all', label: 'Toutes', emoji: '🌐', color: '#7C3AED', count: mappedAgents.length },
        ...Object.entries(counts).map(([id, count]) => {
          const meta = categoryEmojis[id] ?? { label: id, emoji: '⚙️', color: '#64748B' };
          return { id, label: meta.label, emoji: meta.emoji, color: meta.color, count };
        }),
      ];

      // Mark installed agents
      const withInstalled = mappedAgents.map((a: any) => ({ ...a, installed: installedIds.has(a.id) }));

      // Only override fallback if we actually got real data
      if (withInstalled.length > 0) setAgents(withInstalled);
      if (mappedBundles.length > 0) setBundles(mappedBundles);
      if (dynCategories.length > 1) setCategories(dynCategories);
      setLoading(false);
    };
    fetchAll();
    return () => { mounted = false; };
  }, [installedIds]);

  const value = useMemo<MarketplaceData>(() => ({
    loading, agents, bundles, categories, installedIds,
  }), [loading, agents, bundles, categories, installedIds]);

  return <MarketplaceCtx.Provider value={value}>{children}</MarketplaceCtx.Provider>;
}

// ============ MAIN APP ============
export default function MarketplaceRedesignPage() {
  // Wire the global price formatter to the company's chosen currency.
  // Internal prices are in USD; useCurrency converts on the fly.
  const { formatMoney, currency } = useCurrency();
  useEffect(() => {
    _setPriceFormatter((usd: number) => formatMoney(usd));
  }, [formatMoney, currency]);

  return (
    <MarketplacePageInner />
  );
}

function MarketplacePageInner() {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('popular');
  const [viewMode, setViewMode] = useState('grid');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [bundleModal, setBundleModal] = useState<any>(null);
  const [agentModal, setAgentModal] = useState<any>(null);
  const [customPackOpen, setCustomPackOpen] = useState(false);
  const [customPackPreset, setCustomPackPreset] = useState<{ ids: string[]; name: string } | null>(null);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartBouncing, setCartBouncing] = useState(false);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  // Per-bundle trial state — 'none' (default), 'starting' (loading), 'active' (in trial), 'expired'
  const [trialStateByBundle, setTrialStateByBundle] = useState<Record<string, 'none' | 'starting' | 'active' | 'expired'>>({});

  // Boutique WhatsApp activation wizard — opens when user activates the
  // commerce agent or any pack containing it. Without a provisioned store the
  // WhatsApp webhook can't route owner photos, so the wizard is a hard gate.
  const [boutiqueWizardOpen, setBoutiqueWizardOpen] = useState(false);
  const boutiqueResolverRef = useRef<((ok: boolean) => void) | null>(null);

  /**
   * Returns true when a Boutique store exists (or has just been provisioned),
   * false if the user cancelled. Idempotent — calls /commerce/stores first,
   * skips the wizard entirely if a store is already there.
   */
  const ensureBoutiqueStore = async (item: { id?: string; agentIds?: string[]; agents?: Array<{ id: string }> }): Promise<boolean> => {
    const involves =
      item.id === 'commerce' ||
      item.id === 'b16' ||
      (Array.isArray(item.agentIds) && item.agentIds.includes('commerce')) ||
      (Array.isArray(item.agents) && item.agents.some(a => a.id === 'commerce'));
    if (!involves) return true;

    try {
      const r: any = await api.get('/commerce/stores');
      const stores = r?.data?.stores ?? [];
      if (stores.length > 0) return true;
    } catch { /* fall through to wizard */ }

    return new Promise<boolean>((resolve) => {
      boutiqueResolverRef.current = resolve;
      setBoutiqueWizardOpen(true);
    });
  };

  // Fetch already-installed agents on mount → mark them in UI + derive trial state
  useEffect(() => {
    api.get('/marketplace/my-installed').then((r: any) => {
      const list = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
      setInstalledIds(new Set(list.map((a: any) => a.agentId ?? a.id)));
      // Derive bundle trial state: any agent with status='trialing' → bundleId is 'active'.
      // status='expired' → 'expired'.
      const map: Record<string, 'active' | 'expired'> = {};
      for (const a of list) {
        const bid = (a.bundleId ?? a.cachedConfig?.bundleId) as string | undefined;
        if (!bid) continue;
        if (a.status === 'trialing') map[bid] = 'active';
        else if (a.status === 'expired' && map[bid] !== 'active') map[bid] = 'expired';
      }
      setTrialStateByBundle(map);
    }).catch(() => {});
  }, []);

  const handleStartTrial = async (bundle: any) => {
    // Boutique gate: if this pack involves the commerce agent, provision the
    // store first. Otherwise the WhatsApp webhook would silently drop owner
    // photos because no ownerPhone is mapped.
    const ok = await ensureBoutiqueStore(bundle);
    if (!ok) {
      toast.info('Activation annulée');
      return;
    }
    setTrialStateByBundle(s => ({ ...s, [bundle.id]: 'starting' }));
    try {
      const r: any = await api.post(`/marketplace/bundles/${bundle.id}/start-trial`, {});
      const data = r?.data?.data ?? r?.data;
      toast.success(
        `🎁 Essai gratuit activé · ${bundle.name}`,
        `${data?.installedAgents ?? '?'} agents installés · ${data?.daysRemaining ?? 30} jours restants`
      );
      setTrialStateByBundle(s => ({ ...s, [bundle.id]: 'active' }));
      // Refresh installed list so the agents appear active immediately
      api.get('/marketplace/my-installed').then((rr: any) => {
        const list = Array.isArray(rr?.data?.data) ? rr.data.data : (Array.isArray(rr?.data) ? rr.data : []);
        setInstalledIds(new Set(list.map((a: any) => a.agentId ?? a.id)));
      }).catch(() => {});
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Réessaie';
      toast.error('Essai impossible', msg);
      // 409 conflict (already trialed/owned) → reflect in UI
      if (e?.response?.status === 409) {
        setTrialStateByBundle(s => ({ ...s, [bundle.id]: msg.toLowerCase().includes('expir') ? 'expired' : 'active' }));
      } else {
        setTrialStateByBundle(s => ({ ...s, [bundle.id]: 'none' }));
      }
    }
  };

  const handleAddToCart = (item: any) => {
    if (cart.some(i => i.id === item.id)) return;
    if (installedIds.has(item.id)) { toast.info('Déjà installé'); return; }
    setCart([...cart, item]);
    setCartBouncing(true);
    setTimeout(() => setCartBouncing(false), 600);
  };

  // Direct install for already-included agents (status === 'included' or 'free')
  // — no cart, no checkout flow needed since they're either part of a pack or free.
  const handleInstallAgent = async (agent: any) => {
    if (installedIds.has(agent.id)) { toast.info('Déjà installé'); return; }
    // Boutique gate: provision store before activating commerce agent
    const ok = await ensureBoutiqueStore(agent);
    if (!ok) {
      toast.info('Activation annulée');
      return;
    }
    try {
      await api.post(`/marketplace/agents/${agent.id}/install`, { agentId: agent.id });
      setInstalledIds(prev => new Set([...prev, agent.id]));
      toast.success(`${agent.name} installé !`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Erreur';
      toast.error(`Installation échouée : ${msg}`);
    }
  };

  const handleRemove = (id: string) => {
    setCart(cart.filter(i => i.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
    setCartOpen(false);
  };

  const handleToggleFavorite = (id: string) => {
    setFavorites(favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id]);
  };

  const handleCheckout = () => {
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const handleCheckoutSuccess = async () => {
    // Boutique gate: if any cart item involves the commerce agent, provision
    // the store before charging. Cart processing then proceeds normally.
    const cartTouchesCommerce = cart.some(it =>
      it.id === 'commerce' || it.id === 'b16' ||
      (Array.isArray(it.agentIds) && it.agentIds.includes('commerce')) ||
      (Array.isArray(it.agents) && it.agents.some((a: any) => a.id === 'commerce'))
    );
    if (cartTouchesCommerce) {
      const ok = await ensureBoutiqueStore({ id: 'commerce' });
      if (!ok) {
        toast.info('Checkout annulé');
        return;
      }
    }
    // Install each item via backend. Bundles → /bundles/:id/checkout · Agents → /agents/:id/install
    const installed: string[] = [];
    const failed: string[] = [];
    for (const item of cart) {
      try {
        const isBundle = !!item.bundlePrice;
        if (isBundle) {
          await api.post(`/marketplace/bundles/${item.id}/checkout`, { bundleId: item.id });
        } else {
          await api.post(`/marketplace/agents/${item.id}/install`, { agentId: item.id });
        }
        installed.push(item.name);
      } catch (e: any) {
        failed.push(item.name);
      }
    }
    if (installed.length) toast.success(`${installed.length} installé(s)`, installed.join(' · '));
    if (failed.length) toast.error(`${failed.length} échoué(s)`, failed.join(' · '));
    // Refresh installed list
    api.get('/marketplace/my-installed').then((r: any) => {
      const list = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
      setInstalledIds(new Set(list.map((a: any) => a.agentId ?? a.id)));
    }).catch(() => {});
    setCart([]);
    setCheckoutOpen(false);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.bundlePrice || item.price || 0), 0);

  return (
    <MarketplaceProvider installedIds={installedIds}>
    <Chrome cartCount={cart.length} onOpenCart={() => setCartOpen(true)} cartBouncing={cartBouncing}>
      <LaunchBanner />
      <Hero
        onOpenBundle={setBundleModal}
        onOpenCustom={() => setCustomPackOpen(true)}
        onOpenAdvisor={() => setAdvisorOpen(true)}
      />
      <StatsBar />
      <TrendingBar />
      <Categories active={category} setActive={(c: string) => {
        setCategory(c);
        // Auto-scroll to bundles when user picks a non-default category
        if (c !== 'all') {
          setTimeout(() => document.getElementById('mp-bundles')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
      }} />
      <FiltersBar filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} viewMode={viewMode} setViewMode={setViewMode} />
      <BundlesSection
        category={category}
        onAddToCart={handleAddToCart}
        onOpenBundle={setBundleModal}
        onOpenCustom={() => setCustomPackOpen(true)}
        cart={cart}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onStartTrial={handleStartTrial}
        trialStateByBundle={trialStateByBundle}
      />
      <AgentsSection
        filter={filter}
        sort={sort}
        viewMode={viewMode}
        category={category}
        onAddToCart={handleAddToCart}
        onInstall={handleInstallAgent}
        onOpenDetails={setAgentModal}
        cart={cart}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Floating cart */}
      <FloatingCart
        count={cart.length}
        total={cartTotal}
        onClick={() => setCartOpen(true)}
        bouncing={cartBouncing}
      />

      {/* Cart Panel */}
      {cartOpen && (
        <CartPanel
          cart={cart}
          onClose={() => setCartOpen(false)}
          onRemove={handleRemove}
          onCheckout={handleCheckout}
          onClear={handleClearCart}
        />
      )}

      {/* Bundle Modal */}
      {bundleModal && (
        <BundleModal
          bundle={bundleModal}
          onClose={() => setBundleModal(null)}
          onAddToCart={(b) => {
            handleAddToCart(b);
            setBundleModal(null);
          }}
          onCustomize={(b: any) => {
            // Open the Custom Pack Builder pre-populated with this bundle's 4 agents.
            // The user can swap any of them for another agent before adding to cart.
            const ids: string[] = Array.isArray(b.agentIds)
              ? b.agentIds
              : (Array.isArray(b.agentObjs) ? b.agentObjs.map((a: any) => a.id) : []);
            setCustomPackPreset({ ids, name: `${b.name} (sur mesure)` });
            setBundleModal(null);
            setCustomPackOpen(true);
          }}
          inCart={cart.some(item => item.id === bundleModal.id)}
        />
      )}

      {/* Custom Pack Builder */}
      <CustomPackBuilder
        open={customPackOpen}
        presetAgentIds={customPackPreset?.ids}
        presetName={customPackPreset?.name}
        onClose={() => { setCustomPackOpen(false); setCustomPackPreset(null); }}
        onAddToCart={(b: any) => {
          handleAddToCart(b);
          toast.success(`${b.name} ajouté au panier ($${b.bundlePrice}/mo)`);
        }}
      />

      {/* AI Marketplace Advisor */}
      <MarketplaceAdvisor
        open={advisorOpen}
        onClose={() => setAdvisorOpen(false)}
        onAddToCart={(item: any) => {
          handleAddToCart(item);
          toast.success(`${item.name} ajouté au panier`);
        }}
        onOpenBundle={(b: any) => { setAdvisorOpen(false); setBundleModal(b); }}
        onOpenCustom={() => { setAdvisorOpen(false); setCustomPackOpen(true); }}
      />

      {/* Agent Modal */}
      {agentModal && (
        <AgentModal
          agent={agentModal}
          onClose={() => setAgentModal(null)}
          onAddToCart={(a) => {
            handleAddToCart(a);
            setAgentModal(null);
          }}
          onInstall={async (a: any) => {
            await handleInstallAgent(a);
            setAgentModal(null);
          }}
          inCart={cart.some(item => item.id === agentModal.id)}
          installed={installedIds.has(agentModal.id)}
        />
      )}

      {/* Checkout Modal */}
      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Boutique WhatsApp activation wizard */}
      <BoutiqueActivationWizard
        open={boutiqueWizardOpen}
        onClose={() => {
          setBoutiqueWizardOpen(false);
          boutiqueResolverRef.current?.(false);
          boutiqueResolverRef.current = null;
        }}
        onSuccess={() => {
          setBoutiqueWizardOpen(false);
          boutiqueResolverRef.current?.(true);
          boutiqueResolverRef.current = null;
        }}
      />
    </Chrome>
    </MarketplaceProvider>
  );
}
