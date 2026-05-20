/**
 * Immobilier Pack — 2H Corp redesign.
 *
 * Branché sur les vraies APIs (zéro mock) :
 *   - GET    /commerce/stores?businessType=realestate    → store
 *   - GET    /commerce/stores/:id/products               → biens
 *   - GET    /commerce/stores/:id/reservations           → visites
 *   - GET    /whatsapp/messages                          → conversations
 *
 * 5 onglets : Dashboard · Biens · Visites · Clients (CRM dérivé des résa) · WhatsApp Inbox.
 * Si une source est vide → empty state réel, pas de placeholder.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  Home, Plus, Loader2, X, Save, Trash2,
  Bath, Maximize, MapPin, Users, Calendar, Clock,
  Camera, Sparkles, Settings, Building, Trees, Briefcase,
  Search, LayoutDashboard, MessageCircle, CheckCircle2,
  TrendingUp, Banknote, Trophy, RefreshCw,
  Compass, BedDouble, Send, Edit3, BadgeCheck,
  SlidersHorizontal, Phone, User, Star, KeyRound,
} from 'lucide-react';
import { StoreSettingsModal } from '@/components/store/StoreSettingsModal';
import MultiPhotoEditor from '@/components/store/MultiPhotoEditor';
import VoiceAssistantFAB from '@/components/ai/VoiceAssistantFAB';
import { InboxTab } from '@/components/inbox/InboxTab';
import { StoreHeroBranding, WhatsAppQuickButton, resolveAccent } from '@/components/store/StoreHeroBranding';

// ════════════════════════════════════════════════════════════════════
// PALETTE
// ════════════════════════════════════════════════════════════════════
const C = {
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  greenInk:    '#042A1F',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  creamWarm:   '#FAEBD7',

  violet:      '#7C3AED',
  violetDeep:  '#5B21B6',
  violetDark:  '#3B0764',
  violetSoft:  '#F3E8FF',
  violetLight: '#C4B5FD',

  gold:        '#D4A017',
  goldDeep:    '#B8860B',
  goldDark:    '#8B6914',
  goldSoft:    '#FEF3C7',

  emerald:     '#10B981',
  emeraldDeep: '#059669',
  emeraldDark: '#065F46',
  emeraldSoft: '#D1FAE5',

  whatsapp:    '#25D366',
  whatsappDark:'#128C7E',
  whatsappSoft:'#DCF8C6',

  coral:       '#FB7185',
  coralDeep:   '#E11D48',
  coralSoft:   '#FFE4E6',

  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  blue:        '#0EA5E9',
  blueSoft:    '#E0F2FE',
  blueDeep:    '#0284C7',
  cyan:        '#06B6D4',
  cyanSoft:    '#CFFAFE',
  pink:        '#EC4899',

  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font    { font-family: 'JetBrains Mono', monospace; }

  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
  @keyframes pulse { 0%,100% { transform:scale(1); opacity:.5 } 50% { transform:scale(1.6); opacity:0 } }
  @keyframes markerPulse { 0%,100% { transform:scale(1); opacity:1 } 50% { transform:scale(1.2); opacity:.8 } }
  @keyframes markerRipple { 0% { transform:scale(.5); opacity:.8 } 100% { transform:scale(2.5); opacity:0 } }
  @keyframes slowRotate { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
  @keyframes shimmer { 0% { background-position:-200% center } 100% { background-position:200% center } }
  @keyframes sparkleFloat { 0%,100% { transform:translateY(0) rotate(0deg); opacity:.5 } 50% { transform:translateY(-8px) rotate(180deg); opacity:1 } }
  @keyframes slideIn { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }

  .slow-rotate { animation: slowRotate 30s linear infinite; }
  .marker-pulse { animation: markerPulse 2s ease-in-out infinite; }
  .marker-ripple { animation: markerRipple 2s ease-out infinite; }
  .sparkle-float { animation: sparkleFloat 4s ease-in-out infinite; }
  .stagger > * { animation: slideIn .4s ease-out backwards; }
  .stagger > *:nth-child(1){animation-delay:.05s}
  .stagger > *:nth-child(2){animation-delay:.10s}
  .stagger > *:nth-child(3){animation-delay:.15s}
  .stagger > *:nth-child(4){animation-delay:.20s}
  .stagger > *:nth-child(5){animation-delay:.25s}
  .stagger > *:nth-child(6){animation-delay:.30s}
  .stagger > *:nth-child(7){animation-delay:.35s}
  .stagger > *:nth-child(8){animation-delay:.40s}
  .card-lift { transition: all .3s cubic-bezier(.4,0,.2,1); }
  .card-lift:hover { transform: translateY(-3px); }

  .shimmer-text {
    background: linear-gradient(90deg, ${C.violetLight}, ${C.gold}, ${C.emerald}, ${C.gold}, ${C.violetLight});
    background-size: 200% auto; background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent; animation: shimmer 4s linear infinite;
  }

  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 100px;
    font-size: 11px; font-weight: 700; letter-spacing: .02em;
  }

  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: ${C.emerald}; position: relative; flex-shrink: 0;
  }
  .live-dot::after {
    content:''; position: absolute; inset: -4px;
    border-radius: 50%; background: currentColor;
    opacity: .4; animation: pulse 1.8s ease-in-out infinite;
  }

  .btn-primary {
    background: linear-gradient(135deg, ${C.violet}, ${C.violetDeep});
    color: ${C.cream}; border: none;
    padding: 11px 20px; border-radius: 12px;
    font-weight: 700; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all .2s ease; font-family: inherit;
    box-shadow: 0 8px 24px -8px ${C.violet};
  }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 28px -8px ${C.violet}; }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }

  .btn-gold {
    background: linear-gradient(135deg, ${C.gold}, ${C.goldDeep});
    color: ${C.greenInk}; border: none;
    padding: 11px 20px; border-radius: 12px;
    font-weight: 700; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all .2s ease; font-family: inherit;
    box-shadow: 0 8px 24px -8px ${C.gold};
  }
  .btn-gold:hover:not(:disabled) { transform: translateY(-2px); }
  .btn-gold:disabled { opacity:.5; cursor:not-allowed; }

  .btn-whatsapp {
    background: linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark});
    color: ${C.cream}; border: none;
    padding: 11px 20px; border-radius: 12px;
    font-weight: 700; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all .2s ease; font-family: inherit;
    box-shadow: 0 8px 24px -8px ${C.whatsapp};
  }
  .btn-whatsapp:hover:not(:disabled) { transform: translateY(-2px); }

  .btn-secondary {
    background: ${C.cream}; color: ${C.violetDeep};
    border: 1.5px solid rgba(10,42,32,.1);
    padding: 10px 16px; border-radius: 10px;
    font-weight: 600; font-size: 12px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: all .2s ease; font-family: inherit;
  }
  .btn-secondary:hover:not(:disabled) { background: ${C.violetDeep}; color: ${C.cream}; border-color: ${C.violetDeep}; }
  .btn-secondary:disabled { opacity:.5; cursor:not-allowed; }

  .btn-ghost {
    background: transparent; color: ${C.ink};
    border: 1.5px solid ${C.inkLight};
    padding: 9px 16px; border-radius: 10px;
    font-weight: 600; font-size: 12px; cursor: pointer;
    font-family: inherit;
  }
  .btn-ghost:disabled { opacity:.5; cursor:not-allowed; }

  .btn-ghost-light {
    background: rgba(255,250,240,.08); color: ${C.cream};
    border: 1px solid rgba(255,250,240,.15);
    padding: 9px 14px; border-radius: 10px;
    font-weight: 600; font-size: 12px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: all .2s ease; font-family: inherit;
  }
  .btn-ghost-light:hover { background: ${C.cream}; color: ${C.greenInk}; }

  .icon-btn {
    width: 34px; height: 34px; border-radius: 9px;
    background: ${C.violetSoft}; color: ${C.violetDeep};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none; transition: all .2s ease; flex-shrink: 0;
  }
  .icon-btn:hover { background: ${C.violetDeep}; color: ${C.cream}; }
  .icon-btn.emerald { background: ${C.emeraldSoft}; color: ${C.emeraldDark}; }
  .icon-btn.emerald:hover { background: ${C.emeraldDeep}; color: ${C.cream}; }
  .icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${C.violetDeep}; }

  .grain::before {
    content:''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: .06; pointer-events: none; mix-blend-mode: overlay;
  }

  .scroll-thin::-webkit-scrollbar { width: 6px; }
  .scroll-thin::-webkit-scrollbar-thumb { background: rgba(10,42,32,.15); border-radius: 100px; }
  .scroll-thin::-webkit-scrollbar-track { background: transparent; }

  @media (max-width: 1024px) {
    .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
    .map-grid { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 768px) {
    .responsive-grid-4 { grid-template-columns: 1fr !important; }
    .responsive-grid-3 { grid-template-columns: 1fr !important; }
    .hide-on-mobile { display: none !important; }
    .hero-title { font-size: 30px !important; }
  }
  /* Phone-narrow: hero padding, modal full-bleed, safe-area for fixed elements */
  @media (max-width: 480px) {
    .hero-pad { padding: 16px 18px !important; }
    .hero-title { font-size: 26px !important; }
    .pack-modal { max-width: 100% !important; margin: 6px !important; }
    .pack-modal-body { padding: 14px 16px !important; }
    .voice-fab, .pack-fab { bottom: max(20px, env(safe-area-inset-bottom)) !important; right: max(16px, env(safe-area-inset-right)) !important; }
  }

`;

// ════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════
interface Property {
  id: string;
  name: string;
  price: number;
  currency: string;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  primaryImageUrl?: string;
  category?: string;
  status: 'draft' | 'active' | 'out_of_stock' | 'archived';
  stockQty: number;
  surfaceM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: 'apartment' | 'house' | 'villa' | 'studio' | 'office' | 'land' | 'other';
  listingType?: 'sale' | 'rent';
  address?: string;
  city?: string;
  neighborhood?: string;
  country?: string;
  createdAt?: { _seconds?: number } | string;
}
interface Viewing {
  id: string;
  customerName: string;
  customerPhone: string;
  date: string;
  time: string;
  serviceId?: string;
  practitionerName?: string;
  reason?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  source?: string;
  createdAt?: { _seconds?: number } | string;
}
interface Store {
  id: string;
  name: string;
  ownerPhone: string;
  currency: string;
}
interface WaMessage {
  id: string;
  from?: string;
  to?: string;
  direction?: 'inbound' | 'outbound';
  body?: string;
  text?: string;
  message?: string;
  contactName?: string;
  customerName?: string;
  createdAt?: { _seconds?: number } | string;
  timestamp?: string;
}

type TabId = 'dashboard' | 'biens' | 'visites' | 'clients' | 'whatsapp';

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════
function formatShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} Mds`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)} k`;
  return n.toString();
}
function getTimestamp(v: unknown): number {
  if (!v) return 0;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? 0 : t; }
  if (typeof v === 'object' && v !== null && '_seconds' in (v as Record<string, unknown>)) {
    const s = (v as { _seconds?: number })._seconds;
    return typeof s === 'number' ? s * 1000 : 0;
  }
  return 0;
}
function timeAgo(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d}j`;
  return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function isNew(p: Property): boolean {
  const t = getTimestamp(p.createdAt);
  if (!t) return false;
  return Date.now() - t < 14 * 86_400_000;
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}
function gradientFor(id: string): string {
  const gradients = [
    `linear-gradient(135deg, ${C.violet} 0%, ${C.violetDeep} 50%, ${C.violetDark} 100%)`,
    `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDeep} 50%, ${C.goldDark} 100%)`,
    `linear-gradient(135deg, ${C.emerald} 0%, ${C.emeraldDeep} 50%, ${C.emeraldDark} 100%)`,
    `linear-gradient(135deg, ${C.cyan} 0%, #0891B2 50%, #155E75 100%)`,
    `linear-gradient(135deg, ${C.coralDeep} 0%, #BE123C 50%, #881337 100%)`,
    `linear-gradient(135deg, ${C.pink} 0%, #DB2777 50%, #9D174D 100%)`,
    `linear-gradient(135deg, #4338CA 0%, #3730A3 50%, #312E81 100%)`,
    `linear-gradient(135deg, #F97316 0%, #EA580C 50%, #9A3412 100%)`,
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return gradients[h % gradients.length];
}

const STATUS_CONFIG: Record<Property['status'], { label: string; color: string; bg: string; ink: string }> = {
  active:       { label: 'Disponible', color: C.emerald, bg: C.emeraldSoft, ink: C.emeraldDark },
  draft:        { label: 'Brouillon',  color: C.inkSoft, bg: C.creamDeep,   ink: C.inkSoft },
  out_of_stock: { label: 'Vendu/Loué', color: C.gold,    bg: C.goldSoft,    ink: C.goldDark },
  archived:     { label: 'Archivé',    color: C.inkSoft, bg: C.creamDeep,   ink: C.inkSoft },
};

const TYPE_ICONS: Record<NonNullable<Property['propertyType']>, any> = {
  villa:     Home,
  apartment: Building,
  studio:    Home,
  house:     Home,
  land:      Trees,
  office:    Briefcase,
  other:     Home,
};

const PROPERTY_TYPES: Array<[Property['propertyType'], string]> = [
  ['apartment', 'Appartement'],
  ['house',     'Maison'],
  ['villa',     'Villa'],
  ['studio',    'Studio'],
  ['office',    'Bureau / Local'],
  ['land',      'Terrain'],
  ['other',     'Autre'],
];

function colorVar(c: 'violet' | 'gold' | 'emerald' | 'coral') {
  const map = {
    violet:  { main: C.violet,  deep: C.violetDeep,  soft: C.violetSoft },
    gold:    { main: C.gold,    deep: C.goldDeep,    soft: C.goldSoft },
    emerald: { main: C.emerald, deep: C.emeraldDeep, soft: C.emeraldSoft },
    coral:   { main: C.coral,   deep: C.coralDeep,   soft: C.coralSoft },
  };
  return map[c];
}

function propertyLocation(p: Property): string {
  if (p.address) return p.address;
  const parts = [p.neighborhood, p.city].filter(Boolean);
  return parts.join(' · ') || '—';
}

// ════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════════
export default function RealEstateRedesignPage() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [store, setStore] = useState<Store | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [waMessages, setWaMessages] = useState<WaMessage[]>([]);
  const [waConnected, setWaConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const [addPropOpen, setAddPropOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [addViewingOpen, setAddViewingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r1: any = await api.get('/commerce/stores', { params: { businessType: 'realestate' } })
        .catch(() => ({ data: { stores: [] } }));
      const stores = (r1?.data?.stores ?? []) as Store[];
      const s = stores[0];
      if (!s) {
        setStore(null); setProperties([]); setViewings([]); setWaMessages([]);
        return;
      }
      setStore(s);
      const [r2, r3, r4, r5] = await Promise.all([
        api.get(`/commerce/stores/${s.id}/products`).catch(() => ({ data: { products: [] } })),
        api.get(`/commerce/stores/${s.id}/reservations`).catch(() => ({ data: { reservations: [] } })),
        api.get('/whatsapp/messages').catch(() => ({ data: { data: [] } })),
        api.get('/whatsapp/status').catch(() => ({ data: { data: { connected: false } } })),
      ]);
      setProperties((r2 as any)?.data?.products ?? []);
      setViewings((r3 as any)?.data?.reservations ?? []);
      const waData = (r4 as any)?.data?.data ?? (r4 as any)?.data?.messages ?? [];
      setWaMessages(Array.isArray(waData) ? waData : []);
      const waStatus = (r5 as any)?.data?.data ?? (r5 as any)?.data ?? {};
      setWaConnected(!!waStatus.connected);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const currency = store?.currency ?? 'XOF';
  const today = new Date().toISOString().slice(0, 10);
  const activeProps = properties.filter(p => p.status === 'active').length;
  const reservedProps = properties.filter(p => p.status === 'out_of_stock').length;
  const todayViewings = viewings.filter(v => v.date === today && v.status !== 'cancelled');
  const confirmedToday = todayViewings.filter(v => v.status === 'confirmed').length;
  const pendingToday = todayViewings.filter(v => v.status === 'pending').length;
  const upcomingWeek = viewings.filter(v => {
    const d = new Date(v.date);
    const max = new Date(); max.setDate(max.getDate() + 7);
    return d >= new Date(today) && d <= max && v.status !== 'cancelled';
  });
  const totalValue = properties
    .filter(p => p.status === 'active' && p.listingType === 'sale')
    .reduce((s, p) => s + (p.price || 0), 0);

  // CRM leads dérivés : un par client unique de réservation
  const leads = useMemo(() => deriveLeads(viewings, properties), [viewings, properties]);

  // WhatsApp threads dérivés de /whatsapp/messages (groupés par contact)
  const waThreads = useMemo(() => deriveWaThreads(waMessages), [waMessages]);

  // Quartiers réels
  const quartiers = useMemo(() => deriveQuartiers(properties), [properties]);

  if (loading && !store) {
    return (
      <div style={{ minHeight: '100vh', background: C.creamDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 size={32} className="spin" color={C.violet} />
      </div>
    );
  }
  if (!store) return <RealEstateActivationScreen onCreated={() => fetchAll()} />;

  const tabCounts: Record<TabId, number | null> = {
    dashboard: null,
    biens:     properties.length,
    visites:   upcomingWeek.length,
    clients:   leads.length,
    whatsapp:  waThreads.filter(t => t.unread).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <HeroAdmin
          store={store}
          onAddProperty={() => setAddPropOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <TabStrip activeTab={tab} setActiveTab={setTab} counts={tabCounts} />

        {tab === 'dashboard' && (
          <DashboardTab
            properties={properties}
            viewings={viewings}
            leads={leads}
            quartiers={quartiers}
            currency={currency}
            activeProps={activeProps}
            reservedProps={reservedProps}
            todayViewings={todayViewings}
            confirmedToday={confirmedToday}
            pendingToday={pendingToday}
            upcomingWeek={upcomingWeek.length}
            totalValue={totalValue}
            onSelectBien={p => setEditingProp(p)}
            onNewVisit={() => setAddViewingOpen(true)}
          />
        )}

        {tab === 'biens' && (
          <BiensTab
            properties={properties}
            currency={currency}
            onSelectBien={p => setEditingProp(p)}
            onAdd={() => setAddPropOpen(true)}
          />
        )}

        {tab === 'visites' && (
          <VisitesTab
            viewings={viewings}
            properties={properties}
            storeId={store.id}
            onAdd={() => setAddViewingOpen(true)}
            onChanged={() => fetchAll(true)}
          />
        )}

        {tab === 'clients' && (
          <ClientsTab leads={leads} />
        )}

        {tab === 'whatsapp' && (
          <InboxTab
            accent={C.violet} accentDeep={C.violetDeep}
            ink={C.ink} inkSoft={C.inkSoft} inkLight={C.inkLight}
            cream={C.cream} creamDeep={C.creamDeep}
            emptyHint="Dès qu'un prospect écrit sur WhatsApp ou Telegram, sa demande de visite apparaît ici."
          />
        )}
      </div>

      {addPropOpen && (
        <PropertyModal storeId={store.id} currency={currency}
          onClose={() => setAddPropOpen(false)}
          onSaved={() => { setAddPropOpen(false); fetchAll(true); }}
        />
      )}
      {editingProp && (
        <PropertyModal storeId={store.id} currency={currency} property={editingProp}
          onClose={() => setEditingProp(null)}
          onSaved={() => { setEditingProp(null); fetchAll(true); }}
          onDeleted={() => { setEditingProp(null); fetchAll(true); }}
        />
      )}
      {addViewingOpen && (
        <AddViewingModal storeId={store.id} properties={properties}
          onClose={() => setAddViewingOpen(false)}
          onCreated={() => { setAddViewingOpen(false); fetchAll(true); }}
        />
      )}
      {settingsOpen && (
        <StoreSettingsModal
          accentColor={C.violet} accentDeep={C.violetDeep}
          store={store}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => { setSettingsOpen(false); fetchAll(true); }}
        />
      )}

      <VoiceAssistantFAB
        accentColor={C.violet} accentDeep={C.violetDeep}
        label="Assistant Immobilier"
        systemInstruction={`Tu es l'assistant vocal de l'agence immobilière "${store.name}".

CONTEXTE :
- ${properties.length} bien${properties.length > 1 ? 's' : ''} (${activeProps} actifs)
- ${todayViewings.length} visite${todayViewings.length > 1 ? 's' : ''} aujourd'hui
- ${upcomingWeek.length} visites cette semaine

TON RÔLE :
- Renseigner sur les biens disponibles (prix, surface, type)
- Aider à planifier des visites
- Qualifier les prospects (budget, zone, vente/location)

RÈGLES :
- N'auto-confirme JAMAIS une visite ou un dossier. Validation orale obligatoire.
- Ne donne JAMAIS l'adresse exacte d'un bien à un prospect non qualifié.
- Reste concis.`}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CRM derive (zéro mock — dérivé des réservations)
// ════════════════════════════════════════════════════════════════════
type LeadStage = 'new' | 'qualified' | 'visit' | 'done' | 'lost';
interface Lead {
  phone: string;
  name: string;
  stage: LeadStage;
  score: number;
  propertyId?: string;
  propertyName?: string;
  lastMessage?: string;
  lastAt: number;
  totalViewings: number;
}

function deriveLeads(viewings: Viewing[], properties: Property[]): Lead[] {
  const byPhone = new Map<string, Viewing[]>();
  for (const v of viewings) {
    if (!v.customerPhone) continue;
    const k = v.customerPhone.trim();
    if (!k) continue;
    const arr = byPhone.get(k) ?? [];
    arr.push(v);
    byPhone.set(k, arr);
  }
  const out: Lead[] = [];
  for (const [phone, list] of byPhone) {
    // sort newest first
    list.sort((a, b) => {
      const ta = getTimestamp(a.createdAt) || new Date(`${a.date}T${a.time}`).getTime();
      const tb = getTimestamp(b.createdAt) || new Date(`${b.date}T${b.time}`).getTime();
      return tb - ta;
    });
    const last = list[0];
    const stage = stageFor(list);
    const prop = properties.find(p => p.id === last.serviceId);
    out.push({
      phone,
      name: last.customerName || phone,
      stage,
      score: scoreFor(list),
      propertyId: last.serviceId,
      propertyName: prop?.name,
      lastMessage: last.reason || last.notes,
      lastAt: getTimestamp(last.createdAt) || new Date(`${last.date}T${last.time}`).getTime(),
      totalViewings: list.length,
    });
  }
  out.sort((a, b) => b.lastAt - a.lastAt);
  return out;
}

function stageFor(list: Viewing[]): LeadStage {
  const hasSeated = list.some(v => v.status === 'seated');
  const hasConfirmed = list.some(v => v.status === 'confirmed');
  const hasPending = list.some(v => v.status === 'pending');
  const allCancelled = list.every(v => v.status === 'cancelled' || v.status === 'no_show');
  if (allCancelled) return 'lost';
  if (hasSeated && list.length > 1) return 'done';
  if (hasSeated) return 'visit';
  if (hasConfirmed) return 'qualified';
  if (hasPending) return 'new';
  return 'new';
}

function scoreFor(list: Viewing[]): number {
  let s = 50;
  if (list.some(v => v.status === 'confirmed')) s += 20;
  if (list.some(v => v.status === 'seated'))    s += 25;
  if (list.length > 1)                          s += 10;
  if (list.some(v => v.status === 'cancelled' || v.status === 'no_show')) s -= 15;
  return Math.max(0, Math.min(99, s));
}

// ════════════════════════════════════════════════════════════════════
// WhatsApp threads derive
// ════════════════════════════════════════════════════════════════════
interface WaThread {
  phone: string;
  name: string;
  lastMessage: string;
  lastAt: number;
  unread: boolean;
  messages: WaMessage[];
}
function deriveWaThreads(messages: WaMessage[]): WaThread[] {
  const byContact = new Map<string, WaMessage[]>();
  for (const m of messages) {
    const contact = m.direction === 'inbound' ? (m.from ?? '') : (m.to ?? '');
    if (!contact) continue;
    const arr = byContact.get(contact) ?? [];
    arr.push(m);
    byContact.set(contact, arr);
  }
  const threads: WaThread[] = [];
  for (const [phone, list] of byContact) {
    list.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
    const last = list[0];
    const body = last.body ?? last.text ?? last.message ?? '';
    threads.push({
      phone,
      name: last.contactName ?? last.customerName ?? phone,
      lastMessage: body,
      lastAt: getTimestamp(last.createdAt) || (last.timestamp ? Date.parse(last.timestamp) : 0),
      unread: last.direction === 'inbound',
      messages: list,
    });
  }
  threads.sort((a, b) => b.lastAt - a.lastAt);
  return threads;
}

// ════════════════════════════════════════════════════════════════════
// Quartiers derive
// ════════════════════════════════════════════════════════════════════
interface Quartier { id: string; label: string; count: number; color: string; }
function deriveQuartiers(properties: Property[]): Quartier[] {
  const palette = [C.violet, C.emerald, C.gold, C.coral, C.cyan, C.pink, C.blue];
  const counts = new Map<string, number>();
  for (const p of properties) {
    const label = (p.neighborhood || p.city || '').trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const arr = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  return arr.map(([label, count], i) => ({
    id: label.toLowerCase(),
    label,
    count,
    color: palette[i % palette.length],
  }));
}

// ════════════════════════════════════════════════════════════════════
// HERO
// ════════════════════════════════════════════════════════════════════
function HeroAdmin({ store, onAddProperty, onOpenSettings }: { store: Store; onAddProperty: () => void; onOpenSettings: () => void; }) {
  const accent = resolveAccent(store as any, C.violet);
  return (
    <div className="hero-pad" style={{
      position: 'relative',
      background: `linear-gradient(135deg, ${C.violetDark} 0%, ${C.violetDeep} 50%, ${accent} 100%)`,
      borderRadius: 22, padding: '24px 28px',
      overflow: 'hidden',
      border: `1px solid ${C.gold}40`,
      boxShadow: `0 20px 50px -20px ${accent}`,
    }}>
      <div className="grain"></div>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .4, pointerEvents: 'none' }}>
        {Array.from({ length: 25 }).map((_, i) => (
          <circle key={i}
            cx={`${(i * 41) % 100}%`}
            cy={`${(i * 73) % 100}%`}
            r={((i * 7) % 12) / 8 + 0.4}
            fill={i % 2 === 0 ? C.gold : C.violetLight}
            opacity={0.3 + ((i * 11) % 60) / 100}
          />
        ))}
      </svg>
      <div className="slow-rotate" style={{
        position: 'absolute', top: -100, right: -100,
        width: 320, height: 320, borderRadius: '50%',
        border: `1px dashed ${C.gold}30`, pointerEvents: 'none',
      }}></div>
      <div className="sparkle-float" style={{ position: 'absolute', top: 40, right: 100, opacity: .6 }}>
        <Sparkles size={18} color={C.gold} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, position: 'relative', zIndex: 2 }}>
        <span className="pill" style={{
          background: 'rgba(255,250,240,.15)', color: C.cream,
          border: '1px solid rgba(255,250,240,.2)',
          backdropFilter: 'blur(20px)',
          fontWeight: 700, fontSize: 10, letterSpacing: '.08em',
        }}>
          <Home size={11} /> IMMOBILIER · <span style={{ color: C.whatsappSoft }}>WHATSAPP</span>
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 className="display-font hero-title" style={{
            fontSize: 44, fontWeight: 800, color: C.cream, margin: 0,
            letterSpacing: '-.03em', lineHeight: 1,
          }}>
            {store.name.split(' ')[0]}{' '}
            <em className="shimmer-text" style={{ fontStyle: 'italic', fontWeight: 500 }}>
              {store.name.split(' ').slice(1).join(' ') || 'Immo'}
            </em>
          </h1>
          {(store.tagline || store.shortDescription || store.logoUrl) ? (
            <StoreHeroBranding store={store as any} accent={C.gold} dark />
          ) : (
            <p style={{ fontSize: 14, color: 'rgba(255,250,240,.85)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Tes biens et tes visites <em>—</em> depuis <strong style={{ color: C.whatsappSoft }}>WhatsApp</strong>.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={onAddProperty} className="btn-gold">
            <Plus size={14} /> Ajouter un bien
          </button>
          <button onClick={onOpenSettings} className="btn-ghost-light">
            <Settings size={13} /> Paramètres
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TAB STRIP
// ════════════════════════════════════════════════════════════════════
function TabStrip({ activeTab, setActiveTab, counts }: { activeTab: TabId; setActiveTab: (t: TabId) => void; counts: Record<TabId, number | null>; }) {
  const tabs: Array<{ id: TabId; label: string; icon: any; highlight?: boolean }> = [
    { id: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard },
    { id: 'biens',     label: 'Biens',         icon: Home },
    { id: 'visites',   label: 'Visites',       icon: Calendar },
    { id: 'clients',   label: 'Clients',       icon: Users },
    { id: 'whatsapp',  label: 'Inbox',          icon: MessageCircle, highlight: true },
  ];

  return (
    <div className="scroll-thin" style={{
      background: C.cream, borderRadius: 14, padding: 6,
      border: '1px solid rgba(10,42,32,.06)',
      display: 'flex', gap: 4, overflowX: 'auto',
    }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        const count = counts[t.id];
        return (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: active ? `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})` : 'transparent',
            color: active ? C.cream : C.inkSoft,
            padding: '10px 16px', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            boxShadow: active ? `0 6px 14px -4px ${C.violet}` : 'none',
            flexShrink: 0, transition: 'all .2s ease',
          }}>
            <Icon size={13} strokeWidth={2.5} />
            {t.label}
            {count !== null && count > 0 && (
              <span className="mono-font" style={{
                background: active ? 'rgba(255,250,240,.25)' : (t.highlight ? C.whatsapp : C.creamDeep),
                color: active ? C.cream : (t.highlight ? C.cream : C.inkSoft),
                padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 800,
              }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ════════════════════════════════════════════════════════════════════
function DashboardTab(props: {
  properties: Property[]; viewings: Viewing[]; leads: Lead[]; quartiers: Quartier[];
  currency: string; activeProps: number; reservedProps: number;
  todayViewings: Viewing[]; confirmedToday: number; pendingToday: number;
  upcomingWeek: number; totalValue: number;
  onSelectBien: (p: Property) => void; onNewVisit: () => void;
}) {
  const { properties, viewings, leads, quartiers, currency, activeProps, reservedProps,
          todayViewings, confirmedToday, pendingToday, upcomingWeek, totalValue,
          onSelectBien, onNewVisit } = props;

  const kpis: Array<{ id: string; label: string; value: string; unit?: string; sub: string; icon: any; color: 'violet'|'gold'|'emerald'|'coral'; }> = [
    { id: 'biens', label: 'Biens actifs', value: String(activeProps),
      sub: reservedProps ? `${reservedProps} en réservation` : `${properties.length} au total`,
      icon: Home, color: 'violet' },
    { id: 'today', label: 'Visites du jour', value: String(todayViewings.length),
      sub: `${confirmedToday} confirmées · ${pendingToday} pending`,
      icon: Calendar, color: 'gold' },
    { id: 'week', label: 'Cette semaine', value: String(upcomingWeek),
      sub: `${viewings.length} visites au total`,
      icon: TrendingUp, color: 'emerald' },
    { id: 'portfolio', label: 'Portefeuille', value: formatShort(totalValue), unit: currency,
      sub: `${activeProps} biens · valeur vente`,
      icon: Banknote, color: 'gold' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map(s => {
          const cs = colorVar(s.color);
          const Icon = s.icon;
          return (
            <div key={s.id} className="card-lift" style={{
              background: C.cream, borderRadius: 16, padding: 16,
              border: '1px solid rgba(10,42,32,.06)',
              cursor: 'default', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${cs.main}, ${cs.deep})` }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11,
                  background: cs.soft, color: cs.deep,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="display-font mono-font" style={{
                fontSize: 30, fontWeight: 800, color: C.ink,
                lineHeight: 1, letterSpacing: '-.02em',
                display: 'flex', alignItems: 'baseline', gap: 4,
              }}>
                {s.value}
                {s.unit && <span style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft }}>{s.unit}</span>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 6 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 1 }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="map-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
        <QuartiersMap quartiers={quartiers} totalProps={properties.length} />
        <RecentLeadsPanel leads={leads} />
      </div>

      <TodayVisitsPanel todayViewings={todayViewings} properties={properties} onNewVisit={onNewVisit} />

      {properties.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={14} fill={C.gold} color={C.goldDeep} />
              <span className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.cream, letterSpacing: '-.01em' }}>
                Tes <em style={{ fontStyle: 'italic', fontWeight: 500 }}>biens récents</em>
              </span>
            </div>
          </div>
          <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {properties.slice(0, 4).map(p => (
              <BienCard key={p.id} property={p} currency={currency} onClick={() => onSelectBien(p)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// QUARTIERS MAP (visualisation décorative basée sur les vrais quartiers)
// ════════════════════════════════════════════════════════════════════
function QuartiersMap({ quartiers, totalProps }: { quartiers: Quartier[]; totalProps: number; }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.violetDark}, ${C.violetDeep})`,
      borderRadius: 18, border: `1px solid ${C.gold}30`,
      overflow: 'hidden', position: 'relative',
      height: 420, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 18px',
        background: 'rgba(0,0,0,.25)',
        borderBottom: `1px solid ${C.gold}20`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Compass size={14} color={C.gold} />
        <span className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: '.12em', flex: 1 }}>
          DISTRIBUTION · {totalProps} BIEN{totalProps > 1 ? 'S' : ''}
        </span>
        <span className="pill" style={{
          background: `${C.emerald}25`, color: C.emerald,
          border: `1px solid ${C.emerald}50`,
          fontSize: 9, fontWeight: 800,
        }}>
          <span className="live-dot" style={{ width: 6, height: 6, color: C.emerald }}></span>
          LIVE
        </span>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {quartiers.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'rgba(255,250,240,.7)', textAlign: 'center', padding: 20,
          }}>
            <Compass size={36} color={C.gold} style={{ opacity: .6 }} />
            <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.cream }}>
              Pas encore de quartier
            </div>
            <div style={{ fontSize: 12, maxWidth: 280, lineHeight: 1.5 }}>
              Ajoute la ville et le quartier sur chaque bien pour voir la distribution.
            </div>
          </div>
        ) : (
          <>
            <svg viewBox="0 0 100 80" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <defs>
                <radialGradient id="cityGlow">
                  <stop offset="0%" stopColor={C.gold} stopOpacity=".4" />
                  <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
                </radialGradient>
              </defs>
              <path d="M 8 20 Q 12 18 20 19 L 35 20 Q 45 22 55 24 L 70 28 Q 80 32 85 38 L 88 50 Q 86 60 80 68 L 70 74 Q 55 76 40 74 L 25 72 Q 15 68 10 60 L 6 45 Q 6 30 8 20 Z"
                    fill={C.cream} opacity=".05"
                    stroke={C.gold} strokeWidth=".3" strokeOpacity=".4" strokeDasharray="2 2" />
              {quartiers.map((q, i) => {
                const x = 20 + ((i * 13) % 60);
                const y = 30 + ((i * 17) % 35);
                const r = Math.min(3, 1 + Math.log2(q.count + 1));
                return (
                  <g key={q.id}>
                    <circle cx={x} cy={y} r={r * 1.5} fill="url(#cityGlow)" />
                    <circle cx={x} cy={y} r={r} fill={q.color} stroke={C.cream} strokeWidth=".3"
                      className={q.count > 2 ? 'marker-pulse' : ''} />
                    <text x={x} y={y + r + 2.5} textAnchor="middle" fontSize="1.8"
                      fill={q.color} opacity=".85" fontFamily="JetBrains Mono" fontWeight="700">
                      {q.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div style={{
              position: 'absolute', top: 14, left: 14,
              background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(12px)',
              border: `1px solid ${C.gold}30`,
              borderRadius: 12, padding: 12,
              display: 'flex', flexDirection: 'column', gap: 8,
              fontSize: 11, color: C.cream, maxHeight: 'calc(100% - 60px)', overflow: 'auto',
            }} className="scroll-thin">
              <div className="mono-font" style={{ fontSize: 9, fontWeight: 800, color: C.gold, letterSpacing: '.1em' }}>
                QUARTIERS
              </div>
              {quartiers.slice(0, 6).map(q => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: q.color }}></div>
                    <span style={{ color: 'rgba(255,250,240,.85)' }}>{q.label}</span>
                  </div>
                  <span className="mono-font" style={{ fontWeight: 700, color: q.color }}>{q.count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// RECENT LEADS PANEL (dérivé des réservations)
// ════════════════════════════════════════════════════════════════════
function RecentLeadsPanel({ leads }: { leads: Lead[]; }) {
  const recent = leads.slice(0, 8);
  return (
    <div style={{
      background: C.cream, borderRadius: 18,
      border: `1.5px solid ${C.whatsapp}30`, overflow: 'hidden',
      height: 420, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 18px',
        background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`,
        color: C.cream,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <MessageCircle size={16} />
        <div style={{ flex: 1 }}>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', opacity: .9 }}>
            CLIENTS · DÉRIVÉS DES VISITES
          </div>
          <div className="display-font" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em' }}>
            {leads.length} client{leads.length > 1 ? 's' : ''} actif{leads.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft }}>
            <Users size={36} color={C.inkLight} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
              Pas encore de client
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
              Dès qu'un prospect demande une visite, il apparaît ici.
            </div>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map(lead => (
              <div key={lead.phone} className="card-lift" style={{
                background: C.creamDeep,
                borderRadius: 11, padding: 10,
                border: '1px solid rgba(10,42,32,.06)',
                cursor: 'pointer',
                display: 'flex', gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`,
                  color: C.cream, fontWeight: 700, fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Fraunces, serif', flexShrink: 0,
                }}>
                  {initials(lead.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{lead.name}</span>
                    <span className="mono-font" style={{ fontSize: 9, color: C.inkLight, fontWeight: 600 }}>
                      {timeAgo(lead.lastAt)}
                    </span>
                    <span className="pill" style={{
                      background: C.violetSoft, color: C.violetDeep,
                      fontSize: 8, fontWeight: 800, marginLeft: 'auto',
                    }}>
                      <Sparkles size={8} /> {lead.score}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 11, color: C.inkSoft, margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {lead.lastMessage || `Visite : ${lead.propertyName || '—'}`}
                  </p>
                  {lead.propertyName && (
                    <div style={{
                      marginTop: 6, fontSize: 10, color: C.violetDeep,
                      background: C.violetSoft,
                      padding: '3px 8px', borderRadius: 6,
                      display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700,
                    }}>
                      <Home size={9} /> {lead.propertyName}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TODAY'S VISITS
// ════════════════════════════════════════════════════════════════════
function TodayVisitsPanel({ todayViewings, properties, onNewVisit }: {
  todayViewings: Viewing[]; properties: Property[]; onNewVisit: () => void;
}) {
  return (
    <div style={{
      background: C.cream, borderRadius: 18, padding: 18,
      border: '1px solid rgba(10,42,32,.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="pill" style={{
            background: C.goldSoft, color: C.goldDark,
            fontWeight: 700, fontSize: 10, marginBottom: 4,
          }}>
            <Calendar size={11} /> AUJOURD'HUI · {todayViewings.length} VISITE{todayViewings.length > 1 ? 'S' : ''}
          </div>
          <h3 className="display-font" style={{
            fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-.02em',
          }}>
            Planning <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>du jour</em>
          </h3>
        </div>
        <button onClick={onNewVisit} className="btn-secondary" style={{ padding: '7px 12px', fontSize: 11 }}>
          <Plus size={11} /> Nouvelle visite
        </button>
      </div>

      {todayViewings.length === 0 ? (
        <div style={{
          padding: 36, borderRadius: 12, background: C.creamDeep,
          border: `1.5px dashed ${C.gold}40`, textAlign: 'center',
        }}>
          <Calendar size={36} color={C.goldDark} style={{ marginBottom: 10, opacity: .7 }} />
          <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
            Aucune visite aujourd'hui
          </div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>
            Les visites planifiées du jour s'afficheront ici.
          </div>
        </div>
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todayViewings.map(v => {
            const prop = properties.find(p => p.id === v.serviceId);
            const confirmed = v.status === 'confirmed' || v.status === 'seated';
            return (
              <div key={v.id} className="card-lift" style={{
                background: C.creamDeep, borderRadius: 12, padding: 12,
                border: '1px solid rgba(10,42,32,.06)',
                borderLeft: `4px solid ${confirmed ? C.emerald : C.gold}`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 50, flexShrink: 0, textAlign: 'center' }}>
                  <div className="display-font mono-font" style={{
                    fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: '-.02em',
                  }}>
                    {v.time}
                  </div>
                  <div style={{ fontSize: 9, color: C.inkLight, fontWeight: 700, letterSpacing: '.05em' }}>
                    AUJOURD'HUI
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '-.01em' }}>
                      {v.customerName}
                    </span>
                    {confirmed ? (
                      <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDark, fontSize: 9, fontWeight: 700 }}>
                        ● Confirmée
                      </span>
                    ) : (
                      <span className="pill" style={{ background: C.goldSoft, color: C.goldDark, fontSize: 9, fontWeight: 700 }}>
                        ◐ En attente
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {prop ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Home size={11} /> {prop.name}
                      </span>
                    ) : v.reason ? (
                      <span>{v.reason}</span>
                    ) : null}
                    {prop && propertyLocation(prop) !== '—' && (
                      <>
                        <span>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={11} /> {propertyLocation(prop)}
                        </span>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: C.inkLight, marginTop: 3, fontFamily: 'JetBrains Mono', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone size={9} /> {v.customerPhone}
                    {v.practitionerName && <>· Agent : <strong style={{ color: C.violetDeep }}>{v.practitionerName}</strong></>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <a
                    href={`https://wa.me/${v.customerPhone.replace(/\D/g, '')}`}
                    target="_blank" rel="noreferrer"
                    className="icon-btn"
                    style={{ background: C.whatsappSoft, color: C.whatsappDark, width: 32, height: 32, textDecoration: 'none' }}
                    title="WhatsApp">
                    <MessageCircle size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BIEN CARD (utilisé sur Dashboard + Biens)
// ════════════════════════════════════════════════════════════════════
function BienCard({ property, currency, onClick }: { property: Property; currency: string; onClick?: () => void; }) {
  const status = STATUS_CONFIG[property.status];
  const TypeIcon = (property.propertyType && TYPE_ICONS[property.propertyType]) || Home;
  const newBadge = isNew(property);
  const image = property.primaryImageUrl || property.imageUrl
    || (Array.isArray(property.imageUrls) ? property.imageUrls[0] : undefined);

  return (
    <div onClick={onClick} className="card-lift" style={{
      background: C.cream, borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(10,42,32,.06)',
      cursor: 'pointer', position: 'relative',
      boxShadow: '0 4px 12px -4px rgba(10,42,32,.05)',
    }}>
      <div style={{
        height: 180, position: 'relative', overflow: 'hidden',
        background: image ? '#000' : gradientFor(property.id),
      }}>
        {image ? (
          <img src={image} alt={property.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,250,240,.4)' }}>
            <TypeIcon size={80} strokeWidth={1} />
          </div>
        )}

        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="pill" style={{
            background: 'rgba(255,250,240,.95)', color: status.ink,
            fontWeight: 800, fontSize: 10, backdropFilter: 'blur(20px)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, display: 'inline-block' }}></span>
            {status.label}
          </span>
          {newBadge && (
            <span className="pill" style={{
              background: `linear-gradient(135deg, ${C.coral}, ${C.coralDeep})`,
              color: C.cream, fontWeight: 800, fontSize: 10,
            }}>NOUVEAU</span>
          )}
        </div>

        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <button onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className="icon-btn" style={{
              background: 'rgba(255,250,240,.95)', color: C.ink,
              backdropFilter: 'blur(20px)', width: 32, height: 32,
            }} title="Modifier">
            <Edit3 size={13} />
          </button>
        </div>

        {property.listingType && (
          <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
            <span className="pill" style={{
              background: property.listingType === 'sale'
                ? `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})`
                : `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
              color: C.cream, fontWeight: 800, fontSize: 10,
            }}>
              {property.listingType === 'sale' ? 'À VENDRE' : 'À LOUER'}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <h3 className="display-font" style={{
            fontSize: 15, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-.02em',
            flex: 1, lineHeight: 1.25,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{property.name}</h3>
        </div>

        {propertyLocation(property) !== '—' && (
          <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={11} color={C.violetDeep} /> {propertyLocation(property)}
          </div>
        )}

        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap',
          padding: '8px 0',
          borderTop: `1px solid ${C.creamDeep}`,
          borderBottom: `1px solid ${C.creamDeep}`,
          marginBottom: 10,
        }}>
          {property.bedrooms != null && property.bedrooms > 0 && (
            <Spec icon={BedDouble} value={property.bedrooms} />
          )}
          {property.bathrooms != null && property.bathrooms > 0 && (
            <Spec icon={Bath} value={property.bathrooms} />
          )}
          {property.surfaceM2 != null && property.surfaceM2 > 0 && (
            <Spec icon={Maximize} value={`${property.surfaceM2} m²`} />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="display-font mono-font" style={{
              fontSize: 20, fontWeight: 800, color: C.emeraldDark, letterSpacing: '-.02em', lineHeight: 1,
            }}>
              {formatShort(property.price || 0)}
            </div>
            <div style={{ fontSize: 9, color: C.inkLight, fontWeight: 700, letterSpacing: '.05em', marginTop: 2 }}>
              {(property.currency || currency).toUpperCase()} {property.listingType === 'rent' ? '/ MOIS' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, value }: { icon: any; value: number | string; }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.ink, fontWeight: 600 }}>
      <Icon size={12} color={C.inkSoft} />
      <span>{value}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BIENS TAB
// ════════════════════════════════════════════════════════════════════
function BiensTab({ properties, currency, onSelectBien, onAdd }: {
  properties: Property[]; currency: string; onSelectBien: (p: Property) => void; onAdd: () => void;
}) {
  const [filterType, setFilterType] = useState<'all' | NonNullable<Property['propertyType']>>('all');
  const [filterDeal, setFilterDeal] = useState<'all' | 'sale' | 'rent'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | Property['status']>('all');
  const [search, setSearch] = useState('');

  const filtered = properties.filter(p => {
    if (filterType !== 'all' && p.propertyType !== filterType) return false;
    if (filterDeal !== 'all' && p.listingType !== filterDeal) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [p.name, p.address, p.city, p.neighborhood, p.description].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const stats = [
    { label: 'Total biens', value: String(properties.length), icon: Home, color: 'violet' as const },
    { label: 'Disponibles', value: String(properties.filter(p => p.status === 'active').length), icon: CheckCircle2, color: 'emerald' as const },
    { label: 'Vente',       value: String(properties.filter(p => p.listingType === 'sale').length), icon: Banknote, color: 'gold' as const },
    { label: 'Location',    value: String(properties.filter(p => p.listingType === 'rent').length), icon: KeyRound, color: 'coral' as const },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {stats.map((s, i) => {
          const cs = colorVar(s.color);
          const Icon = s.icon;
          return (
            <div key={i} className="card-lift" style={{
              background: C.cream, borderRadius: 14, padding: 14,
              border: '1px solid rgba(10,42,32,.06)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${cs.main}, ${cs.deep})` }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9,
                  background: cs.soft, color: cs.deep,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} />
                </div>
                <div className="display-font mono-font" style={{
                  fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-.02em',
                }}>{s.value}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        background: C.cream, borderRadius: 14, padding: 14,
        border: '1px solid rgba(10,42,32,.06)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: 200,
            background: C.creamDeep, borderRadius: 10, padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Search size={14} color={C.inkSoft} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nom, ville, quartier, description…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 12, color: C.ink, fontFamily: 'inherit', minWidth: 0,
              }}
            />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} style={selectStyle}>
            <option value="all">Tous types</option>
            {PROPERTY_TYPES.map(([v, l]) => <option key={v as string} value={v as string}>{l}</option>)}
          </select>
          <select value={filterDeal} onChange={e => setFilterDeal(e.target.value as any)} style={selectStyle}>
            <option value="all">Vente & Location</option>
            <option value="sale">À vendre</option>
            <option value="rent">À louer</option>
          </select>
          <button className="btn-secondary"><SlidersHorizontal size={12} /> Plus</button>
          <button onClick={onAdd} className="btn-primary"><Plus size={13} /> Ajouter</button>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'wrap' }}>
          {([
            { id: 'all',          label: 'Tous',         color: C.violet },
            { id: 'active',       label: 'Disponibles',  color: C.emerald },
            { id: 'out_of_stock', label: 'Vendus/Loués', color: C.gold },
            { id: 'draft',        label: 'Brouillons',   color: C.inkSoft },
          ] as const).map(f => {
            const count = f.id === 'all'
              ? properties.length
              : properties.filter(p => p.status === f.id).length;
            const active = filterStatus === f.id;
            return (
              <button key={f.id} onClick={() => setFilterStatus(f.id as any)} style={{
                background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'transparent',
                color: active ? C.cream : C.inkSoft,
                padding: '7px 12px', borderRadius: 100,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: active ? 'none' : '1px solid rgba(10,42,32,.1)',
                fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
              }}>
                {f.label}
                <span className="mono-font" style={{
                  background: active ? 'rgba(255,250,240,.25)' : C.creamDeep,
                  color: active ? C.cream : C.inkSoft,
                  padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800,
                }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {properties.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60,
          background: C.cream, borderRadius: 14,
          border: '1px dashed rgba(10,42,32,.15)',
        }}>
          <Home size={48} color={C.violet} style={{ marginBottom: 12, opacity: .6 }} />
          <h3 className="display-font" style={{ fontSize: 20, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>
            Pas encore de bien
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px' }}>
            Ajoute ton premier bien (photo, prix, surface, type). Les prospects pourront réserver une visite via WhatsApp.
          </p>
          <button onClick={onAdd} className="btn-primary">
            <Plus size={14} /> Ajouter mon 1er bien
          </button>
        </div>
      ) : filtered.length > 0 ? (
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {filtered.map(p => <BienCard key={p.id} property={p} currency={currency} onClick={() => onSelectBien(p)} />)}
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: 60,
          background: C.cream, borderRadius: 14,
          border: '1px dashed rgba(10,42,32,.15)',
        }}>
          <Home size={48} color={C.inkLight} style={{ marginBottom: 12 }} />
          <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px' }}>
            Aucun bien ne correspond aux filtres
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>Ajuste les filtres ci-dessus.</p>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: C.creamDeep, color: C.ink, border: 'none', borderRadius: 10,
  padding: '8px 12px', fontSize: 12, fontWeight: 600,
  fontFamily: 'inherit', cursor: 'pointer',
};

// ════════════════════════════════════════════════════════════════════
// VISITES TAB
// ════════════════════════════════════════════════════════════════════
function VisitesTab({ viewings, properties, storeId, onAdd, onChanged }: {
  viewings: Viewing[]; properties: Property[]; storeId: string;
  onAdd: () => void; onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  const todayList = viewings.filter(v => v.date === today && v.status !== 'cancelled');
  const tomorrowList = viewings.filter(v => v.date === tomorrow && v.status !== 'cancelled');
  const laterList = viewings.filter(v => v.date > tomorrow && v.status !== 'cancelled');

  const setStatus = async (id: string, status: Viewing['status']) => {
    try {
      await api.patch(`/commerce/stores/${storeId}/reservations/${id}`, { status });
      toast.success('Visite mise à jour');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };
  const remove = async (id: string) => {
    if (!confirm('Supprimer cette visite ?')) return;
    try {
      await api.delete(`/commerce/stores/${storeId}/reservations/${id}`);
      toast.success('Visite supprimée');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };

  const conversionTotal = viewings.filter(v => v.status === 'seated').length;
  const conversionRate = viewings.length > 0
    ? Math.round((conversionTotal / viewings.length) * 100)
    : 0;

  const stats = [
    { label: "Visites du jour", value: String(todayList.length),
      icon: Calendar, color: 'violet' as const },
    { label: 'Confirmées', value: String(viewings.filter(v => v.status === 'confirmed').length),
      icon: CheckCircle2, color: 'emerald' as const },
    { label: 'En attente', value: String(viewings.filter(v => v.status === 'pending').length),
      icon: Clock, color: 'gold' as const },
    { label: 'Visites faites', value: String(conversionTotal),
      unit: `· ${conversionRate}%`, icon: Trophy, color: 'coral' as const },
  ];

  const groups: Array<[string, Viewing[]]> = [
    ["Aujourd'hui", todayList],
    ['Demain', tomorrowList],
    ['Plus tard', laterList],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {stats.map((s, i) => {
          const cs = colorVar(s.color);
          const Icon = s.icon;
          return (
            <div key={i} className="card-lift" style={{
              background: C.cream, borderRadius: 14, padding: 14,
              border: '1px solid rgba(10,42,32,.06)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${cs.main}, ${cs.deep})` }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9,
                  background: cs.soft, color: cs.deep,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} />
                </div>
                <div className="display-font mono-font" style={{
                  fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-.02em',
                  display: 'flex', alignItems: 'baseline', gap: 4,
                }}>
                  {s.value}
                  {(s as any).unit && <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft }}>{(s as any).unit}</span>}
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        background: C.cream, borderRadius: 14, padding: 16,
        border: '1px solid rgba(10,42,32,.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h3 className="display-font" style={{
            fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-.02em',
          }}>
            Toutes mes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>visites</em>
          </h3>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
            Confirmation via WhatsApp · Liens directs vers le prospect
          </p>
        </div>
        <button onClick={onAdd} disabled={properties.length === 0} className="btn-primary">
          <Plus size={13} /> Nouvelle visite
        </button>
      </div>

      {viewings.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60,
          background: C.cream, borderRadius: 14,
          border: '1px dashed rgba(10,42,32,.15)',
        }}>
          <Calendar size={48} color={C.gold} style={{ marginBottom: 12, opacity: .7 }} />
          <h3 className="display-font" style={{ fontSize: 20, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>
            Aucune visite
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px' }}>
            {properties.length === 0
              ? "Ajoute d'abord des biens pour pouvoir planifier des visites."
              : 'Les prospects peuvent demander une visite via WhatsApp, ou tu peux planifier manuellement.'}
          </p>
          {properties.length > 0 && (
            <button onClick={onAdd} className="btn-primary">
              <Plus size={14} /> Planifier une visite
            </button>
          )}
        </div>
      ) : (
        groups.map(([day, list]) => list.length > 0 && (
          <div key={day}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '0 4px' }}>
              <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.cream, letterSpacing: '-.01em' }}>
                {day}
              </span>
              <span className="pill" style={{ background: 'rgba(255,250,240,.1)', color: C.cream, fontSize: 10, fontWeight: 700 }}>
                {list.length} visite{list.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(v => (
                <VisiteRow key={v.id} viewing={v} properties={properties}
                  onConfirm={() => setStatus(v.id, 'confirmed')}
                  onSeated={() => setStatus(v.id, 'seated')}
                  onCancel={() => setStatus(v.id, 'cancelled')}
                  onRemove={() => remove(v.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function VisiteRow({ viewing, properties, onConfirm, onSeated, onCancel, onRemove }: {
  viewing: Viewing; properties: Property[];
  onConfirm: () => void; onSeated: () => void; onCancel: () => void; onRemove: () => void;
}) {
  const prop = properties.find(p => p.id === viewing.serviceId);
  const confirmed = viewing.status === 'confirmed';
  const seated = viewing.status === 'seated';
  const accent = seated ? C.blue : confirmed ? C.emerald : C.gold;

  return (
    <div className="card-lift" style={{
      background: C.cream, borderRadius: 12, padding: 14,
      border: '1px solid rgba(10,42,32,.06)',
      borderLeft: `4px solid ${accent}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 64, flexShrink: 0,
        background: `${accent}10`,
        borderRadius: 11, padding: '8px 4px', textAlign: 'center',
      }}>
        <div className="display-font mono-font" style={{
          fontSize: 18, fontWeight: 800, color: accent, letterSpacing: '-.02em', lineHeight: 1,
        }}>
          {viewing.time}
        </div>
        <div style={{ fontSize: 8, color: C.inkLight, fontWeight: 700, letterSpacing: '.05em', marginTop: 3 }}>
          {new Date(viewing.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).toUpperCase()}
        </div>
      </div>

      <div style={{
        width: 56, height: 56, borderRadius: 10, flexShrink: 0,
        background: prop?.imageUrl ? `url(${prop.imageUrl}) center/cover` : gradientFor(prop?.id || viewing.id),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {!prop?.imageUrl && <Home size={22} color="rgba(255,250,240,.6)" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-.01em' }}>
            {viewing.customerName}
          </span>
          <ViewingStatusPill status={viewing.status} />
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>
          {prop?.name || viewing.reason || 'Visite'}
          {prop && propertyLocation(prop) !== '—' && (
            <> · <span style={{ color: C.violetDeep, fontWeight: 600 }}>{propertyLocation(prop)}</span></>
          )}
        </div>
        <div style={{ fontSize: 10, color: C.inkLight, fontFamily: 'JetBrains Mono', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Phone size={9} /> {viewing.customerPhone}
          </span>
          {viewing.practitionerName && (
            <>
              <span>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <User size={9} /> {viewing.practitionerName}
              </span>
            </>
          )}
        </div>
        {viewing.notes && (
          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4, fontStyle: 'italic' }}>📝 {viewing.notes}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {viewing.status === 'pending' && (
          <button onClick={onConfirm} className="icon-btn emerald" title="Confirmer">
            <CheckCircle2 size={14} />
          </button>
        )}
        {viewing.status === 'confirmed' && (
          <button onClick={onSeated} className="icon-btn" style={{ background: C.blueSoft, color: C.blueDeep }} title="Visite faite">
            <BadgeCheck size={14} />
          </button>
        )}
        <a href={`https://wa.me/${viewing.customerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
          className="icon-btn" style={{ background: C.whatsappSoft, color: C.whatsappDark, textDecoration: 'none' }} title="WhatsApp">
          <MessageCircle size={14} />
        </a>
        {viewing.status !== 'cancelled' && (
          <button onClick={onCancel} className="icon-btn ghost" title="Annuler">
            <X size={14} />
          </button>
        )}
        <button onClick={onRemove} className="icon-btn ghost" title="Supprimer" style={{ color: C.red }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ViewingStatusPill({ status }: { status: Viewing['status']; }) {
  const c: Record<Viewing['status'], [string, string, string]> = {
    pending:    [C.yellowSoft, '#92400E',     '⏳ En attente'],
    confirmed:  [C.emeraldSoft, C.emeraldDark, '✓ Confirmée'],
    seated:     [C.blueSoft,    C.blueDeep,    '🚶 Effectuée'],
    cancelled:  [C.redSoft,     C.red,         '✗ Annulée'],
    no_show:    ['#FCE7F3',     '#9D174D',     '👻 No show'],
  };
  const [bg, fg, txt] = c[status] ?? c.pending;
  return <span className="pill" style={{ background: bg, color: fg, fontSize: 9, fontWeight: 800 }}>{txt}</span>;
}

// ════════════════════════════════════════════════════════════════════
// CLIENTS TAB (Kanban — dérivé des résa)
// ════════════════════════════════════════════════════════════════════
function ClientsTab({ leads }: { leads: Lead[]; }) {
  const stages: Array<{ id: LeadStage; label: string; color: string; icon: any; }> = [
    { id: 'new',       label: 'Nouveau lead',  color: C.cyan,     icon: Sparkles },
    { id: 'qualified', label: 'Qualifié',      color: C.violet,   icon: BadgeCheck },
    { id: 'visit',     label: 'Visite faite',  color: C.gold,     icon: Calendar },
    { id: 'done',      label: 'Multi-visites', color: C.emerald,  icon: Trophy },
    { id: 'lost',      label: 'Perdu',         color: C.red,      icon: X },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: C.cream, borderRadius: 14, padding: 16,
        border: '1px solid rgba(10,42,32,.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div className="pill" style={{
            background: C.violetSoft, color: C.violetDeep,
            fontWeight: 700, marginBottom: 4, fontSize: 10,
          }}>
            <Users size={11} /> PIPELINE · {leads.length} CLIENT{leads.length > 1 ? 'S' : ''}
          </div>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-.02em' }}>
            Pipeline <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>commercial</em>
          </h3>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '4px 0 0' }}>
            Dérivé automatiquement des réservations de visite. Stage = statut de la dernière visite.
          </p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60,
          background: C.cream, borderRadius: 14,
          border: '1px dashed rgba(10,42,32,.15)',
        }}>
          <Users size={48} color={C.violet} style={{ marginBottom: 12, opacity: .6 }} />
          <h3 className="display-font" style={{ fontSize: 20, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>
            Pas encore de client
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
            Dès qu'un prospect demande une visite (manuel ou via WhatsApp), il apparaît dans le pipeline.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }} className="scroll-thin">
          {stages.map(stage => {
            const list = leads.filter(l => l.stage === stage.id);
            const Icon = stage.icon;
            return (
              <div key={stage.id} style={{
                minWidth: 280, flex: '1 1 280px',
                background: C.cream, borderRadius: 14, padding: 12,
                border: '1px solid rgba(10,42,32,.06)',
                borderTop: `3px solid ${stage.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.creamDeep}` }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${stage.color}15`, color: stage.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={14} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '-.01em' }}>
                      {stage.label}
                    </div>
                  </div>
                  <span className="mono-font" style={{
                    background: `${stage.color}15`, color: stage.color,
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                  }}>{list.length}</span>
                </div>

                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 16, fontSize: 11, color: C.inkLight, fontStyle: 'italic' }}>
                      Aucun client à ce stade
                    </div>
                  ) : list.map(lead => (
                    <div key={lead.phone} className="card-lift" style={{
                      background: C.creamDeep, borderRadius: 10, padding: 10,
                      border: '1px solid rgba(10,42,32,.04)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${stage.color}, ${stage.color}cc)`,
                          color: C.cream, fontWeight: 700, fontSize: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'Fraunces, serif', flexShrink: 0,
                        }}>
                          {initials(lead.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lead.name}
                          </div>
                          <div style={{ fontSize: 9, color: C.inkLight, fontFamily: 'JetBrains Mono' }}>
                            {timeAgo(lead.lastAt)} · {lead.totalViewings} visite{lead.totalViewings > 1 ? 's' : ''}
                          </div>
                        </div>
                        <span className="pill" style={{
                          background: `${stage.color}20`, color: stage.color,
                          fontSize: 9, fontWeight: 800,
                        }}>
                          <Sparkles size={8} /> {lead.score}
                        </span>
                      </div>

                      {lead.propertyName && (
                        <div style={{
                          fontSize: 9, color: C.violetDeep,
                          background: C.violetSoft,
                          padding: '3px 6px', borderRadius: 5,
                          display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700,
                          marginBottom: 5,
                        }}>
                          <Home size={9} /> {lead.propertyName}
                        </div>
                      )}

                      {lead.lastMessage && (
                        <div style={{
                          fontSize: 10, color: C.inkSoft, lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {lead.lastMessage}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                          style={{
                            flex: 1, textDecoration: 'none',
                            background: C.whatsappSoft, color: C.whatsappDark, border: 'none',
                            padding: '5px', borderRadius: 6,
                            fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          }}>
                          <MessageCircle size={10} /> Répondre
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// WHATSAPP INBOX TAB (réel — /whatsapp/messages)
// ════════════════════════════════════════════════════════════════════
function WhatsAppTab({ threads, connected, onRefresh }: { threads: WaThread[]; connected: boolean; onRefresh: () => void; }) {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(threads[0]?.phone ?? null);
  const selected = threads.find(t => t.phone === selectedPhone) ?? threads[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ScopeHeader connected={connected} threadCount={threads.length} />
      {threads.length === 0
        ? <WhatsAppEmptyState connected={connected} onRefresh={onRefresh} />
        : <WhatsAppInbox threads={threads} selected={selected} setSelectedPhone={setSelectedPhone} onRefresh={onRefresh} />
      }
    </div>
  );
}

function ScopeHeader({ connected, threadCount }: { connected: boolean; threadCount: number }) {
  return (
    <div style={{
      background: C.cream, borderRadius: 14, padding: 14,
      border: '1px solid rgba(10,42,32,.06)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
    }}>
      <div>
        <div className="pill" style={{
          background: connected ? `${C.whatsapp}15` : C.creamDeep,
          color: connected ? C.whatsappDark : C.inkSoft,
          fontWeight: 700, fontSize: 10, marginBottom: 4,
        }}>
          {connected
            ? <><span className="live-dot" style={{ width: 6, height: 6, color: C.whatsapp }}></span> WHATSAPP CONNECTÉ</>
            : <>● NON CONNECTÉ</>}
        </div>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-.02em' }}>
          Messages <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.whatsappDark }}>de ton agence</em>
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
          Conversations entrantes · {threadCount} thread{threadCount > 1 ? 's' : ''}.
          Paramètres globaux dans <a href="/admin/whatsapp" style={{ color: C.violetDeep, fontWeight: 600, textDecoration: 'none' }}>Admin · WhatsApp</a>.
        </p>
      </div>
    </div>
  );
}

function WhatsAppEmptyState({ connected, onRefresh }: { connected: boolean; onRefresh: () => void }) {
  return (
    <div style={{
      textAlign: 'center', padding: 60,
      background: C.cream, borderRadius: 14,
      border: '1px dashed rgba(10,42,32,.15)',
    }}>
      <MessageCircle size={48} color={C.whatsapp} style={{ marginBottom: 12, opacity: .7 }} />
      <h3 className="display-font" style={{ fontSize: 20, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>
        {connected ? 'Pas encore de message' : 'WhatsApp non connecté'}
      </h3>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
        {connected
          ? "Ton WhatsApp Business est bien connecté. Dès qu'un prospect t'écrit, sa conversation apparaît ici."
          : "Connecte WhatsApp Business pour recevoir et répondre aux prospects directement depuis ton agence."}
      </p>
      {connected ? (
        <button onClick={onRefresh} className="btn-secondary">
          <RefreshCw size={13} /> Rafraîchir
        </button>
      ) : (
        <a href="/admin/whatsapp" style={{ textDecoration: 'none' }}>
          <button className="btn-whatsapp">
            <MessageCircle size={14} /> Connecter WhatsApp
          </button>
        </a>
      )}
    </div>
  );
}

function WhatsAppInbox({ threads, selected, setSelectedPhone, onRefresh }: {
  threads: WaThread[];
  selected: WaThread | undefined;
  setSelectedPhone: (p: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div className="hide-on-mobile" style={{
        width: 340, flexShrink: 0,
        background: C.cream, borderRadius: 16, overflow: 'hidden',
        border: '1px solid rgba(10,42,32,.06)',
        height: 'calc(100vh - 280px)', minHeight: 460,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 16px',
          background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`,
          color: C.cream,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div className="mono-font" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', opacity: .9, marginBottom: 2 }}>
              WHATSAPP BUSINESS
            </div>
            <h3 className="display-font" style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>
              {threads.length} conversation{threads.length > 1 ? 's' : ''}
            </h3>
          </div>
          <button onClick={onRefresh} className="icon-btn" style={{ background: 'rgba(255,255,255,.2)', color: C.cream, width: 32, height: 32 }}>
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto' }}>
          {threads.map(t => {
            const sel = selected?.phone === t.phone;
            return (
              <div key={t.phone} onClick={() => setSelectedPhone(t.phone)} style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(10,42,32,.04)',
                cursor: 'pointer',
                background: sel ? `${C.whatsapp}08` : (t.unread ? `${C.whatsapp}03` : 'transparent'),
                borderLeft: sel ? `3px solid ${C.whatsapp}` : (t.unread ? `3px solid ${C.whatsapp}80` : '3px solid transparent'),
                display: 'flex', gap: 10, alignItems: 'flex-start',
                transition: 'all .15s ease',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`,
                  color: C.cream, fontWeight: 700, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Fraunces, serif', flexShrink: 0,
                }}>
                  {initials(t.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2, gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name}
                    </span>
                    <span className="mono-font" style={{ fontSize: 9, color: C.inkLight, fontWeight: 600, flexShrink: 0 }}>
                      {timeAgo(t.lastAt)}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 11, color: t.unread ? C.ink : C.inkSoft, margin: 0,
                    fontWeight: t.unread ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.lastMessage || '—'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        flex: 1, minWidth: 0,
        background: C.cream, borderRadius: 16, overflow: 'hidden',
        border: '1px solid rgba(10,42,32,.06)',
        height: 'calc(100vh - 280px)', minHeight: 460,
        display: 'flex', flexDirection: 'column',
      }}>
        {selected && (
          <>
            <div style={{
              padding: '14px 18px',
              background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`,
              color: C.cream,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(255,250,240,.2)',
                color: C.cream, fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Fraunces, serif',
                border: '2px solid rgba(255,250,240,.3)',
              }}>
                {initials(selected.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="display-font" style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: '-.02em' }}>
                  {selected.name}
                </h3>
                <div style={{ fontSize: 11, opacity: .85, fontFamily: 'JetBrains Mono' }}>
                  {selected.phone}
                </div>
              </div>
              <a href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="icon-btn" style={{ background: 'rgba(255,250,240,.15)', color: C.cream, textDecoration: 'none' }}>
                <Send size={14} />
              </a>
            </div>

            <div className="scroll-thin" style={{
              flex: 1, overflowY: 'auto', padding: 18,
              background: `linear-gradient(180deg, ${C.cream}, ${C.creamDeep}50)`,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {[...selected.messages].reverse().map(m => {
                const inbound = m.direction === 'inbound';
                const body = m.body ?? m.text ?? m.message ?? '';
                const at = getTimestamp(m.createdAt);
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: inbound ? 'flex-start' : 'flex-end' }}>
                    <div style={{
                      background: inbound ? C.cream : C.whatsappSoft,
                      border: inbound ? '1px solid rgba(10,42,32,.06)' : `1px solid ${C.whatsapp}30`,
                      padding: '10px 14px',
                      borderRadius: inbound ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                      maxWidth: '75%',
                      fontSize: 13, color: C.ink, lineHeight: 1.5,
                      boxShadow: '0 2px 6px -2px rgba(10,42,32,.05)',
                    }}>
                      {body || <em style={{ color: C.inkLight }}>(message vide)</em>}
                      <div className="mono-font" style={{ fontSize: 9, color: C.inkLight, marginTop: 4, textAlign: 'right' }}>
                        {timeAgo(at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: 14, borderTop: '1px solid rgba(10,42,32,.06)', background: C.cream, display: 'flex', gap: 8, alignItems: 'center' }}>
              <a href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                style={{ textDecoration: 'none', flex: 1 }}>
                <button className="btn-whatsapp" style={{ width: '100%', justifyContent: 'center' }}>
                  <MessageCircle size={14} /> Répondre sur WhatsApp
                </button>
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ACTIVATION
// ════════════════════════════════════════════════════════════════════
function RealEstateActivationScreen({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('Acompte par virement, chèque ou Wave.');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim().length >= 2 && ownerPhone.length >= 6 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/commerce/stores', {
        name: name.trim(), ownerPhone: ownerPhone.trim(),
        paymentInstructions: paymentInstructions.trim(),
        businessType: 'realestate',
      });
      toast.success('Agence activée', `${name.trim()} est en ligne.`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Activation impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{STYLES}</style>
      <div style={{ background: C.cream, borderRadius: 22, maxWidth: 520, width: '100%', boxShadow: '0 24px 60px -16px rgba(10,42,32,.18)', overflow: 'hidden' }}>
        <div style={{ background: `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})`, color: '#fff', padding: '36px 32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div className="grain"></div>
          <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
            <Home size={28} color="#fff" />
          </div>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>
            Active ton <em style={{ fontStyle: 'italic', fontWeight: 500 }}>agence</em>
          </h1>
          <p style={{ fontSize: 13, opacity: .92, marginTop: 8 }}>
            Biens · Visites · Leads — sur WhatsApp
          </p>
        </div>
        <div style={{ padding: '26px 32px 30px' }}>
          <div style={{ background: C.violetSoft, border: `1px solid ${C.violetLight}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: C.violetDeep, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={14} />
            <span>Ton agence est <strong>séparée</strong> des autres modules.</span>
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Nom de l'agence</Label>
            <Input value={name} onChange={setName} placeholder="Nom de ton agence" autoFocus />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Numéro WhatsApp</Label>
            <Input value={ownerPhone} onChange={setOwnerPhone} placeholder="+XXX XX XX XX XX" />
          </div>
          <div style={{ marginBottom: 22 }}>
            <Label>Instructions paiement / acompte</Label>
            <textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <a href="/agents/commerce" className="btn-ghost" style={{ textDecoration: 'none' }}>← Boutique</a>
            <button onClick={submit} disabled={!canSubmit} className="btn-primary">
              {submitting ? <><Loader2 size={14} className="spin" /> Activation…</> : <><Home size={14} /> Activer mon agence</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PROPERTY MODAL (préservé — wire vers /products)
// ════════════════════════════════════════════════════════════════════
function PropertyModal({ storeId, currency, property, onClose, onSaved, onDeleted }: {
  storeId: string; currency: string; property?: Property;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!property;
  const p = property as (Property & {
    roomType?: 'entire' | 'private_room' | 'shared_room';
    maxGuests?: number; childrenFreeUnder?: number;
    allowExtraGuests?: boolean; maxExtraGuests?: number;
    affiliateUrl?: string; useContactForm?: boolean; instantBooking?: boolean;
    amenities?: string[]; videoUrl?: string;
  }) | undefined;

  const [name, setName] = useState(property?.name ?? '');
  const [price, setPrice] = useState<number | ''>(property?.price ?? '');
  const [listingType, setListingType] = useState<'sale' | 'rent'>(property?.listingType ?? 'sale');
  const [propertyType, setPropertyType] = useState<Property['propertyType']>(property?.propertyType ?? 'apartment');
  const [surfaceM2, setSurface] = useState<number | ''>(property?.surfaceM2 ?? '');
  const [bedrooms, setBedrooms] = useState<number | ''>(property?.bedrooms ?? '');
  const [bathrooms, setBathrooms] = useState<number | ''>(property?.bathrooms ?? '');
  const [address, setAddress] = useState(property?.address ?? '');
  const [description, setDescription] = useState(property?.description ?? '');
  const [status, setStatus] = useState<Property['status']>(property?.status ?? 'active');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(property?.imageUrl ?? null);
  const [roomType, setRoomType] = useState<'entire' | 'private_room' | 'shared_room'>(p?.roomType ?? 'entire');
  const [maxGuests, setMaxGuests] = useState<number | ''>(p?.maxGuests ?? '');
  const [childrenFreeUnder, setChildrenFreeUnder] = useState<number | ''>(p?.childrenFreeUnder ?? 12);
  const [allowExtraGuests, setAllowExtraGuests] = useState<boolean>(p?.allowExtraGuests ?? false);
  const [maxExtraGuests, setMaxExtraGuests] = useState<number | ''>(p?.maxExtraGuests ?? '');
  const [city, setCity] = useState(property?.city ?? '');
  const [neighborhood, setNeighborhood] = useState(property?.neighborhood ?? '');
  const [country, setCountry] = useState(property?.country ?? 'CI');
  const [affiliateUrl, setAffiliateUrl] = useState(p?.affiliateUrl ?? '');
  const [useContactForm, setUseContactForm] = useState<boolean>(p?.useContactForm ?? false);
  const [instantBooking, setInstantBooking] = useState<boolean>(p?.instantBooking ?? false);
  const [amenitiesText, setAmenitiesText] = useState((p?.amenities ?? []).join(', '));
  const [videoUrl, setVideoUrl] = useState(p?.videoUrl ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialGalleryUrls = Array.isArray(property?.imageUrls) && property!.imageUrls!.length > 0
    ? property!.imageUrls!
    : (property?.imageUrl ? [property.imageUrl] : []);

  const canSubmit = name.trim().length >= 2 && typeof price === 'number' && price > 0 && !submitting;

  const handleFile = (file: File) => {
    if (file.size > 8 * 1024 * 1024) { toast.error('Image trop lourde', 'Max 8 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      setImageBase64(dataUrl.replace(/^data:image\/[^;]+;base64,/, ''));
      setImageMimeType(file.type || 'image/jpeg');
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const amenities = amenitiesText.split(/[,\n]+/).map(a => a.trim()).filter(a => a.length > 0);
    const payload = {
      name: name.trim(), price,
      listingType, propertyType,
      surfaceM2: typeof surfaceM2 === 'number' ? surfaceM2 : undefined,
      bedrooms:  typeof bedrooms  === 'number' ? bedrooms  : undefined,
      bathrooms: typeof bathrooms === 'number' ? bathrooms : undefined,
      address: address.trim(),
      description: description.trim(),
      stockQty: 1,
      status,
      roomType,
      maxGuests: typeof maxGuests === 'number' ? maxGuests : undefined,
      childrenFreeUnder: typeof childrenFreeUnder === 'number' ? childrenFreeUnder : undefined,
      allowExtraGuests,
      maxExtraGuests: typeof maxExtraGuests === 'number' ? maxExtraGuests : undefined,
      city: city.trim(),
      neighborhood: neighborhood.trim(),
      country: country.trim(),
      affiliateUrl: affiliateUrl.trim(),
      useContactForm,
      instantBooking,
      amenities,
      videoUrl: videoUrl.trim(),
      ...(imageBase64 ? { imageBase64, imageMimeType } : {}),
    };
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/products/${property!.id}`, payload);
        toast.success('Bien mis à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/products`, payload);
        toast.success('Bien ajouté', `${name.trim()} est en ligne.`);
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/products/${property!.id}`);
      toast.success('Bien supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const statusOptions: Array<[Property['status'], string, string]> = [
    ['active',       'Actif',       C.emeraldDeep],
    ['out_of_stock', 'Vendu/Loué',  C.gold],
    ['draft',        'Brouillon',   C.inkSoft],
    ['archived',     'Archivé',     C.ink],
  ];

  return (
    <ModalShell title={isEdit ? 'Modifier le bien' : 'Nouveau bien'} color={C.violetDeep} onClose={onClose}>
      {isEdit ? (
        <div style={{ marginBottom: 14 }}>
          <Label>Photos du bien (max 6)</Label>
          <MultiPhotoEditor
            basePath={`/commerce/stores/${storeId}/products/${property!.id}`}
            initialUrls={initialGalleryUrls}
            initialPrimary={property?.primaryImageUrl ?? property?.imageUrl ?? null}
            accentColor={C.violet}
            accentDeep={C.violetDeep}
          />
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <Label>Photo principale</Label>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {imagePreview ? (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', maxHeight: 220 }}>
              <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }} />
              <button onClick={() => fileInputRef.current?.click()}
                style={{ position: 'absolute', top: 8, right: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(10,42,32,.8)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Camera size={11} /> Remplacer
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', padding: '20px 14px', borderRadius: 12, background: C.creamDeep, color: C.violetDeep, border: `1.5px dashed ${C.violet}`, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Camera size={22} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Choisir une photo</span>
            </button>
          )}
          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
            Tu pourras ajouter d'autres photos (max 6) après création.
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <Label>Titre du bien</Label>
        <Input value={name} onChange={setName} placeholder="Villa 4 chambres, F4 vue mer…" autoFocus />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <Label>Type</Label>
          <select value={propertyType} onChange={e => setPropertyType(e.target.value as Property['propertyType'])}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
            {PROPERTY_TYPES.map(([v, l]) => <option key={v as string} value={v as string}>{l}</option>)}
          </select>
        </div>
        <div>
          <Label>Vente / Location</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['sale', 'rent'] as const).map(t => (
              <button key={t} type="button" onClick={() => setListingType(t)}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10,
                  background: listingType === t ? (t === 'sale' ? C.violetDeep : C.emeraldDeep) : 'transparent',
                  color: listingType === t ? '#fff' : C.inkSoft,
                  border: `1.5px solid ${listingType === t ? 'transparent' : C.inkLight + '50'}`,
                  cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                }}>
                {t === 'sale' ? '🏷 Vente' : '🔑 Location'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Label>Prix ({currency}){listingType === 'rent' ? ' / mois' : ''}</Label>
        <Input type="number" value={String(price ?? '')} onChange={v => setPrice(v === '' ? '' : parseInt(v))} placeholder="50000000" mono />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Surface (m²)</Label><Input type="number" value={String(surfaceM2 ?? '')} onChange={v => setSurface(v === '' ? '' : parseInt(v))} mono /></div>
        <div><Label>Chambres</Label><Input type="number" value={String(bedrooms ?? '')} onChange={v => setBedrooms(v === '' ? '' : parseInt(v))} mono /></div>
        <div><Label>SDB</Label><Input type="number" value={String(bathrooms ?? '')} onChange={v => setBathrooms(v === '' ? '' : parseInt(v))} mono /></div>
      </div>

      <div style={{ margin: '14px 0 6px', fontSize: 11, fontWeight: 800, color: C.violetDeep, textTransform: 'uppercase', letterSpacing: '.06em' }}>📍 Localisation</div>
      <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 8 }}>
        <div><Label>Ville</Label><Input value={city} onChange={setCity} placeholder="Ville" /></div>
        <div><Label>Quartier / Zone</Label><Input value={neighborhood} onChange={setNeighborhood} placeholder="Quartier / Zone" /></div>
        <div><Label>Pays</Label><Input value={country} onChange={v => setCountry(v.toUpperCase().slice(0, 2))} mono /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Adresse complète (optionnel)</Label>
        <Input value={address} onChange={setAddress} placeholder="Près de la pharmacie centrale, immeuble L'Étoile…" />
      </div>

      <div style={{ margin: '14px 0 6px', fontSize: 11, fontWeight: 800, color: C.violetDeep, textTransform: 'uppercase', letterSpacing: '.06em' }}>👥 Capacité d'accueil</div>
      <div style={{ marginBottom: 10 }}>
        <Label>Type de location</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            ['entire', '🏠 Logement entier'],
            ['private_room', '🚪 Chambre privée'],
            ['shared_room', '👥 Chambre partagée'],
          ] as const).map(([val, label]) => {
            const sel = roomType === val;
            return (
              <button key={val} type="button" onClick={() => setRoomType(val)}
                style={{ padding: '6px 12px', borderRadius: 100, background: sel ? C.violetDeep : 'transparent', color: sel ? '#fff' : C.inkSoft, border: `1.5px solid ${sel ? C.violetDeep : C.inkLight}50`, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><Label>Voyageurs max</Label><Input type="number" value={String(maxGuests ?? '')} onChange={v => setMaxGuests(v === '' ? '' : parseInt(v))} mono /></div>
        <div><Label>Enfants gratuits ‹ … ans</Label><Input type="number" value={String(childrenFreeUnder ?? '')} onChange={v => setChildrenFreeUnder(v === '' ? '' : parseInt(v))} mono /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => setAllowExtraGuests(!allowExtraGuests)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: allowExtraGuests ? `${C.violetDeep}10` : '#fff',
            border: `1.5px solid ${allowExtraGuests ? C.violetDeep : C.creamDeep}`,
            color: allowExtraGuests ? C.violetDeep : C.inkSoft,
            fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
          <span>Autoriser invités au-delà de la capacité ?</span>
          <span style={{ fontSize: 11 }}>{allowExtraGuests ? '✓ oui' : 'non'}</span>
        </button>
        {allowExtraGuests && (
          <div style={{ marginTop: 6 }}>
            <Label>Max invités supplémentaires</Label>
            <Input type="number" value={String(maxExtraGuests ?? '')} onChange={v => setMaxExtraGuests(v === '' ? '' : parseInt(v))} mono />
          </div>
        )}
      </div>

      {isEdit && (
        <div style={{ marginBottom: 12 }}>
          <Label>Statut</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {statusOptions.map(([val, label, col]) => {
              const sel = status === val;
              return (
                <button key={val} type="button" onClick={() => setStatus(val)}
                  style={{
                    padding: '7px 14px', borderRadius: 100,
                    background: sel ? col : 'transparent',
                    color: sel ? '#fff' : col,
                    border: `1.5px solid ${col}`,
                    cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
                  }}>{label}</button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Label>Description</Label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Bel appartement traversant, balcon, vue mer, climatisation, parking…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label>Vidéo (URL YouTube ou MP4)</Label>
        <Input value={videoUrl} onChange={setVideoUrl} placeholder="https://youtu.be/... ou https://exemple.com/visite.mp4" />
      </div>

      <div style={{ margin: '14px 0 6px', fontSize: 11, fontWeight: 800, color: C.violetDeep, textTransform: 'uppercase', letterSpacing: '.06em' }}>🛠 Équipements</div>
      <div style={{ marginBottom: 14 }}>
        <Input value={amenitiesText} onChange={setAmenitiesText} placeholder="wifi, climatisation, parking, piscine, cuisine équipée…" />
        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>Séparés par virgules — affichés en pastilles sur la page publique.</div>
      </div>

      <div style={{ margin: '14px 0 6px', fontSize: 11, fontWeight: 800, color: C.violetDeep, textTransform: 'uppercase', letterSpacing: '.06em' }}>📅 Réservation</div>
      <div style={{ marginBottom: 8 }}>
        <button type="button" onClick={() => setInstantBooking(!instantBooking)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: instantBooking ? `${C.violetDeep}10` : '#fff',
            border: `1.5px solid ${instantBooking ? C.violetDeep : C.creamDeep}`,
            color: instantBooking ? C.violetDeep : C.inkSoft,
            fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
          <span>⚡ Réservation instantanée</span>
          <span style={{ fontSize: 11 }}>{instantBooking ? '✓ oui — pas de validation manuelle' : 'non — chaque demande à valider'}</span>
        </button>
      </div>
      <div style={{ marginBottom: 8 }}>
        <button type="button" onClick={() => setUseContactForm(!useContactForm)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: useContactForm ? `${C.violetDeep}10` : '#fff',
            border: `1.5px solid ${useContactForm ? C.violetDeep : C.creamDeep}`,
            color: useContactForm ? C.violetDeep : C.inkSoft,
            fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
          <span>📞 Formulaire de contact (au lieu de réservation)</span>
          <span style={{ fontSize: 11 }}>{useContactForm ? '✓ oui' : 'non'}</span>
        </button>
      </div>
      <div style={{ marginBottom: 18 }}>
        <Label>🔗 Lien d'affiliation (optionnel)</Label>
        <Input value={affiliateUrl} onChange={setAffiliateUrl} placeholder="https://booking.com/... ou https://airbnb.com/..." />
        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>Si renseigné, "Réserver" redirige vers ce lien externe.</div>
      </div>

      {isEdit && confirmDelete && (
        <div style={{ padding: 14, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>
            Supprimer définitivement <em>{property!.name}</em> ?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost" style={{ borderColor: '#FCA5A5', color: '#7F1D1D' }}>Annuler</button>
            <button onClick={remove} disabled={submitting}
              style={{ padding: '8px 14px', borderRadius: 8, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}>
              {submitting ? <><Loader2 size={12} className="spin" /> …</> : <><Trash2 size={12} /> Confirmer</>}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        {isEdit ? (
          <button onClick={() => setConfirmDelete(true)} disabled={confirmDelete || submitting}
            style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: '#DC2626', border: '1.5px solid #FCA5A5', cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', opacity: confirmDelete ? .4 : 1 }}>
            <Trash2 size={12} /> Supprimer
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} disabled={submitting} className="btn-ghost">Annuler</button>
          <button onClick={submit} disabled={!canSubmit} className="btn-primary">
            {submitting ? <><Loader2 size={14} className="spin" /> …</> : (isEdit ? <><Save size={14} /> Enregistrer</> : <><Plus size={14} /> Ajouter</>)}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// ADD VIEWING MODAL
// ════════════════════════════════════════════════════════════════════
function AddViewingModal({ storeId, properties, onClose, onCreated }: {
  storeId: string; properties: Property[]; onClose: () => void; onCreated: () => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('14:00');
  const [propertyId, setPropertyId] = useState<string>(
    properties.filter(p => p.status === 'active')[0]?.id ?? properties[0]?.id ?? '');
  const [agentName, setAgentName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const property = properties.find(p => p.id === propertyId);
  const canSubmit = customerName.trim().length >= 2 && customerPhone.length >= 6
    && date && time && propertyId && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post(`/commerce/stores/${storeId}/reservations`, {
        customerName: customerName.trim(), customerPhone: customerPhone.trim(),
        date, time, partySize: 1,
        serviceId: propertyId,
        reason: property ? `Visite : ${property.name}` : 'Visite',
        ...(agentName.trim() ? { practitionerName: agentName.trim() } : {}),
        notes: notes.trim(),
      });
      toast.success('Visite créée', `${customerName.trim()} · ${date} ${time}`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Création impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Nouvelle visite" color={C.violetDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Nom du prospect</Label><Input value={customerName} onChange={setCustomerName} placeholder="M. Konan" autoFocus /></div>
        <div><Label>Téléphone</Label><Input value={customerPhone} onChange={setCustomerPhone} placeholder="+XXX XX XX XX XX" /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Bien à visiter</Label>
        <select value={propertyId} onChange={e => setPropertyId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          {properties.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {p.address ? `— ${p.address}` : ''} ({p.listingType === 'sale' ? 'Vente' : 'Location'})
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Date</Label><Input type="date" value={date} onChange={setDate} /></div>
        <div><Label>Heure</Label><Input type="time" value={time} onChange={setTime} /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Agent (optionnel)</Label>
        <Input value={agentName} onChange={setAgentName} placeholder="Mme Diallo, M. Bekale…" />
      </div>
      <div style={{ marginBottom: 18 }}>
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={submitting} className="btn-ghost">Annuler</button>
        <button onClick={submit} disabled={!canSubmit} className="btn-primary">
          {submitting ? <><Loader2 size={14} className="spin" /> …</> : <><Plus size={14} /> Créer</>}
        </button>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ════════════════════════════════════════════════════════════════════
function ModalShell({ title, color, onClose, children }: { title: string; color: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, padding: 16,
      background: 'rgba(10,42,32,.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22, maxWidth: 620, width: '100%',
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 30px 80px -20px rgba(10,42,32,.5)',
      }}>
        <div style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)`, color: '#fff', padding: '20px 24px', borderRadius: '22px 22px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>{title}</h3>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.18)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '22px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{children}</label>;
}

function Input({ value, onChange, placeholder, type = 'text', autoFocus, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; autoFocus?: boolean; mono?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} autoFocus={autoFocus}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: 10,
        border: `1.5px solid ${C.creamDeep}`, fontSize: 13,
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
        outline: 'none', background: '#fff', color: C.ink,
      }} />
  );
}
