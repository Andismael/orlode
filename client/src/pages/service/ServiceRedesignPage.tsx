/**
 * Salon / Service / Beauté Pack — Pastel Beauté redesign.
 * Pitch: "Tes RDV, ton agenda et ton équipe — depuis WhatsApp."
 *
 * 8 onglets admin, zéro mock :
 *   - Dashboard   · KPIs + agenda live + équipe live + leads WA
 *   - Services    · CRUD services par département
 *   - Agenda      · vue semaine (jours × équipe)
 *   - Équipe      · CRUD praticiens (store.practitioners)
 *   - Clients     · CRM Kanban dérivé des résa
 *   - Produits    · retail (produits à vendre, sans durée)
 *   - Fidélité    · config loyalty (seuil + %)
 *   - WhatsApp    · inbox conversations
 *
 * Réutilise : products (avec durationMinutes pour services), reservations,
 *             store.practitioners, store.loyalty*, /whatsapp/messages.
 *
 * Palette : Rose framboise + Violet pastel + Or rosé.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  Scissors, Plus, Loader2, X, Save, Trash2, Edit3,
  Sparkles, MessageCircle, Settings, Camera, RefreshCw, Send,
  LayoutDashboard, Banknote, Users, Clock,
  CheckCircle2, BadgeCheck, Search, Phone, Trophy, Star,
  Calendar, ChevronLeft, ChevronRight, ShoppingBag,
  Gift, Heart, Flower2,
} from 'lucide-react';
import { StoreSettingsModal } from '@/components/store/StoreSettingsModal';
import VoiceAssistantFAB from '@/components/ai/VoiceAssistantFAB';
import { InboxTab } from '@/components/inbox/InboxTab';
import { StoreHeroBranding, WhatsAppQuickButton, resolveAccent } from '@/components/store/StoreHeroBranding';

const C = {
  greenDeep:'#0A4F3C', greenDark:'#063D2E',
  cream:'#FFFAF0', creamDeep:'#FCF5F5', creamWarm:'#FDF4F7',
  rose:'#DB2777', roseDeep:'#BE185D', roseDark:'#9D174D', roseSoft:'#FCE7F3', roseLight:'#F472B6',
  violet:'#8B5CF6', violetDeep:'#7C3AED', violetDark:'#6D28D9', violetSoft:'#EDE9FE', violetLight:'#C4B5FD',
  gold:'#D4A017', goldDeep:'#A16207', goldDark:'#713F12', goldSoft:'#FEF3C7', goldLight:'#FCD34D',
  pink:'#F472B6', pinkSoft:'#FCE7F3', pinkDeep:'#DB2777',
  emerald:'#10B981', emeraldDeep:'#059669', emeraldDark:'#065F46', emeraldSoft:'#D1FAE5',
  coral:'#FB7185', coralDeep:'#E11D48', coralSoft:'#FFE4E6',
  whatsapp:'#25D366', whatsappDark:'#128C7E', whatsappSoft:'#DCF8C6',
  cyan:'#06B6D4', cyanSoft:'#CFFAFE', cyanDeep:'#0891B2',
  red:'#EF4444', redSoft:'#FEE2E2', yellow:'#F59E0B', yellowSoft:'#FEF3C7',
  blue:'#0EA5E9', blueSoft:'#E0F2FE', blueDeep:'#0284C7',
  ink:'#1C1410', inkSoft:'#5A4D45', inkLight:'#94857B',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font    { font-family: 'JetBrains Mono', monospace; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
  @keyframes pulse { 0%,100% { transform:scale(1); opacity:.5 } 50% { transform:scale(1.6); opacity:0 } }
  @keyframes slowRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes slideIn { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
  @keyframes shimmer { 0% { background-position:-200% center } 100% { background-position:200% center } }
  @keyframes sparkleFloat { 0%,100% { transform:translateY(0) rotate(0); opacity:.5 } 50% { transform:translateY(-8px) rotate(180deg); opacity:1 } }
  .slow-rotate { animation: slowRotate 30s linear infinite; }
  .sparkle-float { animation: sparkleFloat 4s ease-in-out infinite; }
  .stagger > * { animation: slideIn .4s ease-out backwards; }
  .stagger > *:nth-child(1){animation-delay:.05s}
  .stagger > *:nth-child(2){animation-delay:.10s}
  .stagger > *:nth-child(3){animation-delay:.15s}
  .stagger > *:nth-child(4){animation-delay:.20s}
  .stagger > *:nth-child(5){animation-delay:.25s}
  .stagger > *:nth-child(6){animation-delay:.30s}
  .card-lift { transition: all .3s cubic-bezier(.4,0,.2,1); }
  .card-lift:hover { transform: translateY(-3px); }
  .shimmer-text {
    background: linear-gradient(90deg, ${C.gold}, ${C.rose}, ${C.violet}, ${C.rose}, ${C.gold});
    background-size: 200% auto; background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent; animation: shimmer 4s linear infinite;
  }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: .02em; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.emerald}; position: relative; flex-shrink: 0; }
  .live-dot::after { content:''; position:absolute; inset:-4px; border-radius:50%; background: currentColor; opacity:.4; animation: pulse 1.8s ease-in-out infinite; }
  .btn-primary { background: linear-gradient(135deg, ${C.rose}, ${C.roseDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; box-shadow: 0 8px 24px -8px ${C.rose}; }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .btn-violet { background: linear-gradient(135deg, ${C.violet}, ${C.violetDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; }
  .btn-gold { background: linear-gradient(135deg, ${C.gold}, ${C.goldDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; }
  .btn-secondary { background: ${C.cream}; color: ${C.roseDeep}; border: 1.5px solid rgba(28,20,16,.1); padding: 10px 16px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .2s ease; font-family: inherit; }
  .btn-secondary:hover:not(:disabled) { background: ${C.roseDeep}; color: ${C.cream}; border-color: ${C.roseDeep}; }
  .btn-ghost { background: transparent; color: ${C.ink}; border: 1.5px solid ${C.inkLight}; padding: 9px 16px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; font-family: inherit; }
  .btn-ghost-light { background: rgba(255,250,240,.08); color: ${C.cream}; border: 1px solid rgba(255,250,240,.15); padding: 9px 14px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
  .btn-ghost-light:hover { background: ${C.cream}; color: ${C.roseDeep}; }
  .btn-whatsapp { background: linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; }
  .icon-btn { width: 34px; height: 34px; border-radius: 9px; background: ${C.roseSoft}; color: ${C.roseDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all .2s ease; flex-shrink: 0; }
  .icon-btn:hover { background: ${C.roseDeep}; color: ${C.cream}; }
  .icon-btn.violet { background: ${C.violetSoft}; color: ${C.violetDeep}; }
  .icon-btn.gold { background: ${C.goldSoft}; color: ${C.goldDeep}; }
  .icon-btn.emerald { background: ${C.emeraldSoft}; color: ${C.emeraldDark}; }
  .icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${C.roseDeep}; }
  .grain::before { content:''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: .06; pointer-events: none; mix-blend-mode: overlay; }
  .scroll-thin::-webkit-scrollbar { width: 6px; height: 6px; }
  .scroll-thin::-webkit-scrollbar-thumb { background: rgba(28,20,16,.15); border-radius: 100px; }
  @media (max-width: 1024px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .responsive-grid-3 { grid-template-columns: repeat(2, 1fr) !important; } .map-grid { grid-template-columns: 1fr !important; } }
  @media (max-width: 768px) { .responsive-grid-4 { grid-template-columns: 1fr !important; } .responsive-grid-3 { grid-template-columns: 1fr !important; } .hide-on-mobile { display: none !important; } .hero-title { font-size: 30px !important; } }
  @media (max-width: 480px) { .hero-pad { padding: 16px 18px !important; } .hero-title { font-size: 26px !important; } .pack-modal { max-width: 100% !important; margin: 6px !important; } .pack-modal-body { padding: 14px 16px !important; } .voice-fab, .pack-fab { bottom: max(20px, env(safe-area-inset-bottom)) !important; right: max(16px, env(safe-area-inset-right)) !important; } }
`;

interface Practitioner {
  id: string; name: string; role?: string;
  photoUrl?: string; workingHours?: string; active?: boolean;
  specialties?: string[]; color?: string;
}
interface Store {
  id: string; name: string; ownerPhone: string; currency: string;
  paymentInstructions?: string;
  practitioners?: Practitioner[];
  loyaltyEnabled?: boolean;
  loyaltyThreshold?: number;
  loyaltyDiscountPct?: number;
}
interface Product {
  id: string; name: string; price: number; currency: string;
  description?: string; imageUrl?: string; imageUrls?: string[]; primaryImageUrl?: string;
  stockQty: number; status: 'draft' | 'active' | 'out_of_stock' | 'archived';
  category?: string;
  durationMinutes?: number;
}
interface Reservation {
  id: string; customerName: string; customerPhone: string;
  date: string; time: string;
  durationMinutes?: number;
  serviceId?: string;
  practitionerName?: string;
  partySize?: number; notes?: string;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  source?: string;
  createdAt?: { _seconds?: number } | string;
}
interface WaMessage {
  id: string; from?: string; to?: string;
  direction?: 'inbound' | 'outbound';
  body?: string; text?: string; message?: string;
  contactName?: string; customerName?: string;
  createdAt?: { _seconds?: number } | string;
}

type TabId = 'dashboard' | 'services' | 'agenda' | 'team' | 'clients' | 'products' | 'loyalty' | 'whatsapp';

const DEPARTMENTS = [
  { id: 'coiffure',  label: 'Coiffure',       color: C.rose,     emoji: '✂️' },
  { id: 'esthetic',  label: 'Esthétique',     color: C.violet,   emoji: '💄' },
  { id: 'manucure',  label: 'Manucure',       color: C.pink,     emoji: '💅' },
  { id: 'pedicure',  label: 'Pédicure',       color: C.cyan,     emoji: '🦶' },
  { id: 'onglerie',  label: 'Onglerie',       color: C.gold,     emoji: '💎' },
  { id: 'spa',       label: 'Spa & massages', color: C.emerald,  emoji: '💆' },
  { id: 'barber',    label: 'Barber',         color: C.ink,      emoji: '💈' },
];

const NO_DECIMAL = new Set(['XOF','XAF','JPY','GNF','KES','NGN','RWF','BIF','UGX']);
function formatPrice(n: number, currency = 'XOF'): string {
  const d = NO_DECIMAL.has(currency) ? 0 : 2;
  try { return new Intl.NumberFormat('fr-FR', { style:'currency', currency, minimumFractionDigits:d, maximumFractionDigits:d }).format(n); }
  catch { return `${n.toLocaleString('fr-FR')} ${currency}`; }
}
function formatShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(2)} Mds`;
  if (n >= 1_000_000)     return `${(n/1_000_000).toFixed(1)} M`;
  if (n >= 1_000)         return `${(n/1_000).toFixed(0)} k`;
  return n.toString();
}
function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min/60); const m = min%60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}
function getTimestamp(v: unknown): number {
  if (!v) return 0;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? 0 : t; }
  if (typeof v === 'object' && v !== null && '_seconds' in (v as Record<string, unknown>)) {
    const s = (v as { _seconds?: number })._seconds; return typeof s === 'number' ? s*1000 : 0;
  }
  return 0;
}
function timeAgo(ms: number): string {
  if (!ms) return '';
  const diff = Date.now()-ms; const min = Math.floor(diff/60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min/60); if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h/24); if (d < 7) return `il y a ${d}j`;
  return new Date(ms).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}
function gradientFor(id: string): string {
  const g = [
    `linear-gradient(135deg, ${C.rose}, ${C.roseDeep}, ${C.roseDark})`,
    `linear-gradient(135deg, ${C.violet}, ${C.violetDeep}, ${C.violetDark})`,
    `linear-gradient(135deg, ${C.gold}, ${C.goldDeep}, #713F12)`,
    `linear-gradient(135deg, ${C.pink}, ${C.pinkDeep}, #9D174D)`,
    `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep}, ${C.emeraldDark})`,
    `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep}, #155E75)`,
  ];
  let h = 0; for (let i = 0; i < id.length; i++) h = (h*31 + id.charCodeAt(i)) >>> 0;
  return g[h % g.length];
}
function colorVar(c: 'rose' | 'violet' | 'gold' | 'emerald' | 'coral' | 'cyan' | 'pink') {
  const map = {
    rose:    { main: C.rose,    deep: C.roseDeep,    soft: C.roseSoft },
    violet:  { main: C.violet,  deep: C.violetDeep,  soft: C.violetSoft },
    gold:    { main: C.gold,    deep: C.goldDeep,    soft: C.goldSoft },
    emerald: { main: C.emerald, deep: C.emeraldDeep, soft: C.emeraldSoft },
    coral:   { main: C.coral,   deep: C.coralDeep,   soft: C.coralSoft },
    cyan:    { main: C.cyan,    deep: C.cyanDeep,    soft: C.cyanSoft },
    pink:    { main: C.pink,    deep: C.pinkDeep,    soft: C.pinkSoft },
  };
  return map[c];
}
function isService(p: Product): boolean {
  return typeof p.durationMinutes === 'number' && p.durationMinutes > 0;
}

export default function ServiceRedesignPage() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waMessages, setWaMessages] = useState<WaMessage[]>([]);
  const [waConnected, setWaConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [editingService, setEditingService] = useState<Product | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [addAppointmentOpen, setAddAppointmentOpen] = useState(false);
  const [editingPractitioner, setEditingPractitioner] = useState<Practitioner | null>(null);
  const [addPractitionerOpen, setAddPractitionerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r1: any = await api.get('/commerce/stores', { params: { businessType: 'service' } })
        .catch(() => ({ data: { stores: [] } }));
      const stores = (r1?.data?.stores ?? []) as Store[];
      const s = stores[0];
      if (!s) { setStore(null); setProducts([]); setReservations([]); setWaMessages([]); return; }
      setStore(s);
      const [r2, r3, r4, r5] = await Promise.all([
        api.get(`/commerce/stores/${s.id}/products`).catch(() => ({ data: { products: [] } })),
        api.get(`/commerce/stores/${s.id}/reservations`).catch(() => ({ data: { reservations: [] } })),
        api.get('/whatsapp/messages').catch(() => ({ data: { data: [] } })),
        api.get('/whatsapp/status').catch(() => ({ data: { data: { connected: false } } })),
      ]);
      setProducts((r2 as any)?.data?.products ?? []);
      setReservations((r3 as any)?.data?.reservations ?? []);
      const waData = (r4 as any)?.data?.data ?? (r4 as any)?.data?.messages ?? [];
      setWaMessages(Array.isArray(waData) ? waData : []);
      const waStatus = (r5 as any)?.data?.data ?? (r5 as any)?.data ?? {};
      setWaConnected(!!waStatus.connected);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const currency = store?.currency ?? 'XOF';
  const today = new Date().toISOString().slice(0, 10);
  const services = useMemo(() => products.filter(isService), [products]);
  const retailProducts = useMemo(() => products.filter(p => !isService(p)), [products]);
  const practitioners = store?.practitioners ?? [];

  const todayAppointments = reservations.filter(r => r.date === today && r.status !== 'cancelled');
  const upcomingAppointments = reservations.filter(r => r.date >= today && r.status !== 'cancelled');
  const caToday = todayAppointments.reduce((sum, r) => {
    const svc = products.find(p => p.id === r.serviceId);
    return sum + (svc?.price ?? 0);
  }, 0);

  const customers = useMemo(() => deriveCustomers(reservations, products), [reservations, products]);
  const waThreads = useMemo(() => deriveWaThreads(waMessages), [waMessages]);

  if (loading && !store) {
    return (
      <div style={{ minHeight: '100vh', background: C.greenDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 size={32} className="spin" color={C.rose} />
      </div>
    );
  }
  if (!store) return <SalonActivationScreen onCreated={() => fetchAll()} />;

  const counts: Record<TabId, number | null> = {
    dashboard: null,
    services: services.length,
    agenda: upcomingAppointments.length,
    team: practitioners.length,
    clients: customers.length,
    products: retailProducts.length,
    loyalty: store.loyaltyEnabled ? 1 : null,
    whatsapp: waThreads.filter(t => t.unread).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <HeroAdmin store={store}
          onAddService={() => setAddServiceOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)} />
        <TabStrip activeTab={tab} setActiveTab={setTab} counts={counts} />

        {tab === 'dashboard' && (
          <DashboardTab services={services} reservations={reservations}
            todayAppointments={todayAppointments} caToday={caToday}
            currency={currency} practitioners={practitioners}
            threads={waThreads}
            onAddAppointment={() => setAddAppointmentOpen(true)} />
        )}
        {tab === 'services' && (
          <ServicesTab services={services} currency={currency}
            onSelect={p => setEditingService(p)} onAdd={() => setAddServiceOpen(true)} />
        )}
        {tab === 'agenda' && (
          <AgendaTab reservations={reservations} services={services} practitioners={practitioners}
            onAddAppointment={() => setAddAppointmentOpen(true)} />
        )}
        {tab === 'team' && (
          <TeamTab practitioners={practitioners} reservations={reservations} storeId={store.id}
            onAdd={() => setAddPractitionerOpen(true)}
            onEdit={p => setEditingPractitioner(p)}
            onChanged={() => fetchAll(true)} />
        )}
        {tab === 'clients' && <ClientsTab customers={customers} />}
        {tab === 'products' && (
          <ProductsTab products={retailProducts} currency={currency}
            onSelect={p => setEditingProduct(p)} onAdd={() => setAddProductOpen(true)} />
        )}
        {tab === 'loyalty' && (
          <LoyaltyTab store={store} customers={customers} currency={currency}
            onChanged={() => fetchAll(true)} />
        )}
        {tab === 'whatsapp' && (
          <InboxTab
            accent={C.pink} accentDeep={C.pinkDeep}
            ink={C.ink} inkSoft={C.inkSoft} inkLight={C.inkLight}
            cream={C.cream} creamDeep={C.creamDeep}
            emptyHint="Dès qu'une cliente prend RDV sur WhatsApp ou Telegram, ça apparaît ici."
          />
        )}
      </div>

      {addServiceOpen && (
        <ProductModal storeId={store.id} currency={currency} isService
          onClose={() => setAddServiceOpen(false)}
          onSaved={() => { setAddServiceOpen(false); fetchAll(true); }} />
      )}
      {editingService && (
        <ProductModal storeId={store.id} currency={currency} product={editingService} isService
          onClose={() => setEditingService(null)}
          onSaved={() => { setEditingService(null); fetchAll(true); }}
          onDeleted={() => { setEditingService(null); fetchAll(true); }} />
      )}
      {addProductOpen && (
        <ProductModal storeId={store.id} currency={currency}
          onClose={() => setAddProductOpen(false)}
          onSaved={() => { setAddProductOpen(false); fetchAll(true); }} />
      )}
      {editingProduct && (
        <ProductModal storeId={store.id} currency={currency} product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => { setEditingProduct(null); fetchAll(true); }}
          onDeleted={() => { setEditingProduct(null); fetchAll(true); }} />
      )}
      {addAppointmentOpen && (
        <AppointmentModal storeId={store.id} services={services} practitioners={practitioners}
          onClose={() => setAddAppointmentOpen(false)}
          onCreated={() => { setAddAppointmentOpen(false); fetchAll(true); }} />
      )}
      {addPractitionerOpen && (
        <PractitionerModal storeId={store.id} practitioners={practitioners}
          onClose={() => setAddPractitionerOpen(false)}
          onSaved={() => { setAddPractitionerOpen(false); fetchAll(true); }} />
      )}
      {editingPractitioner && (
        <PractitionerModal storeId={store.id} practitioners={practitioners} practitioner={editingPractitioner}
          onClose={() => setEditingPractitioner(null)}
          onSaved={() => { setEditingPractitioner(null); fetchAll(true); }}
          onDeleted={() => { setEditingPractitioner(null); fetchAll(true); }} />
      )}
      {settingsOpen && (
        <StoreSettingsModal accentColor={C.rose} accentDeep={C.roseDeep}
          store={store}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => { setSettingsOpen(false); fetchAll(true); }} />
      )}

      <VoiceAssistantFAB
        accentColor={C.rose} accentDeep={C.roseDeep}
        label="Assistant Salon"
        systemInstruction={`Tu es l'assistant vocal du salon "${store.name}".

CONTEXTE :
- ${services.length} service${services.length > 1 ? 's' : ''} au catalogue
- ${practitioners.length} praticien${practitioners.length > 1 ? 's' : ''} dans l'équipe
- ${todayAppointments.length} RDV aujourd'hui
- ${upcomingAppointments.length} RDV à venir
- ${customers.length} client${customers.length > 1 ? 's' : ''} fidélisé${customers.length > 1 ? 's' : ''}

TON RÔLE :
- Renseigner sur les services (prix, durée, praticien)
- Vérifier disponibilités et proposer créneaux
- Suggérer praticien selon spécialité
- Aider à gérer la file d'attente

RÈGLES :
- N'auto-confirme JAMAIS un RDV. Demande validation orale.
- Reste bref et chaleureux.
- Si un client n'est pas sûr, propose 2 options max.`}
      />
    </div>
  );
}

// Derived
interface Customer {
  phone: string; name: string;
  visits: number; totalSpent: number; lastAt: number;
  stage: 'new' | 'returning' | 'loyal' | 'vip' | 'lost';
  favoriteService?: string;
}
function deriveCustomers(reservations: Reservation[], products: Product[]): Customer[] {
  const byPhone = new Map<string, Reservation[]>();
  for (const r of reservations) {
    if (!r.customerPhone) continue;
    const k = r.customerPhone.trim();
    const arr = byPhone.get(k) ?? [];
    arr.push(r); byPhone.set(k, arr);
  }
  const out: Customer[] = [];
  for (const [phone, list] of byPhone) {
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const visits = list.filter(r => r.status === 'seated' || r.status === 'confirmed').length;
    const totalSpent = list.reduce((sum, r) => {
      const svc = products.find(p => p.id === r.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);
    const stage: Customer['stage'] =
      totalSpent >= 200_000 ? 'vip' :
      visits >= 5 ? 'loyal' :
      visits >= 2 ? 'returning' :
      Date.now() - new Date(list[0].date).getTime() > 90 * 86_400_000 ? 'lost' : 'new';
    // favorite service = most-used serviceId
    const counts = new Map<string, number>();
    for (const r of list) if (r.serviceId) counts.set(r.serviceId, (counts.get(r.serviceId) ?? 0) + 1);
    const [favId] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const favSvc = favId ? products.find(p => p.id === favId)?.name : undefined;
    out.push({
      phone, name: list[0].customerName || phone,
      visits, totalSpent,
      lastAt: getTimestamp(list[0].createdAt) || new Date(list[0].date).getTime(),
      stage, favoriteService: favSvc,
    });
  }
  out.sort((a, b) => b.lastAt - a.lastAt);
  return out;
}

interface WaThread { phone: string; name: string; lastMessage: string; lastAt: number; unread: boolean; messages: WaMessage[]; }
function deriveWaThreads(messages: WaMessage[]): WaThread[] {
  const byContact = new Map<string, WaMessage[]>();
  for (const m of messages) {
    const contact = m.direction === 'inbound' ? (m.from ?? '') : (m.to ?? '');
    if (!contact) continue;
    const arr = byContact.get(contact) ?? [];
    arr.push(m); byContact.set(contact, arr);
  }
  const threads: WaThread[] = [];
  for (const [phone, list] of byContact) {
    list.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
    const last = list[0];
    threads.push({
      phone, name: last.contactName ?? last.customerName ?? phone,
      lastMessage: last.body ?? last.text ?? last.message ?? '',
      lastAt: getTimestamp(last.createdAt), unread: last.direction === 'inbound',
      messages: list,
    });
  }
  threads.sort((a, b) => b.lastAt - a.lastAt);
  return threads;
}

function HeroAdmin({ store, onAddService, onOpenSettings }: { store: Store; onAddService: () => void; onOpenSettings: () => void }) {
  const accent = resolveAccent(store as any, C.violet);
  return (
    <div style={{
      position: 'relative',
      background: `linear-gradient(135deg, ${C.roseDark} 0%, ${C.roseDeep} 50%, ${accent} 100%)`,
      borderRadius: 22, padding: '24px 28px', overflow: 'hidden',
      border: `1px solid ${C.gold}40`, boxShadow: `0 20px 50px -20px ${accent}`,
    }}>
      <div className="grain"></div>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .4, pointerEvents: 'none' }}>
        {Array.from({ length: 25 }).map((_, i) => (
          <circle key={i} cx={`${(i*41)%100}%`} cy={`${(i*73)%100}%`}
            r={((i*7)%12)/8 + 0.4}
            fill={i%2 === 0 ? C.gold : C.roseSoft}
            opacity={0.3 + ((i*11)%60)/100} />
        ))}
      </svg>
      <div className="slow-rotate" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', border: `1px dashed ${C.gold}30`, pointerEvents: 'none' }}></div>
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
          <Scissors size={11} /> SALON · <span style={{ color: C.whatsappSoft }}>WHATSAPP</span>
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
              {store.name.split(' ').slice(1).join(' ') || 'Salon'}
            </em>
          </h1>
          {(store.tagline || store.shortDescription || store.logoUrl) ? (
            <StoreHeroBranding store={store as any} accent={C.pink} dark />
          ) : (
            <p style={{ fontSize: 14, color: 'rgba(255,250,240,.85)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Services, agenda, équipe et fidélité — pilotés depuis <strong style={{ color: C.whatsappSoft }}>WhatsApp</strong>.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={onAddService} className="btn-gold"><Plus size={14} /> Ajouter un service</button>
          <button onClick={onOpenSettings} className="btn-ghost-light"><Settings size={13} /> Paramètres</button>
        </div>
      </div>
    </div>
  );
}

function TabStrip({ activeTab, setActiveTab, counts }: { activeTab: TabId; setActiveTab: (t: TabId) => void; counts: Record<TabId, number | null> }) {
  const tabs: Array<{ id: TabId; label: string; icon: any; highlight?: boolean }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'services',  label: 'Services',  icon: Scissors },
    { id: 'agenda',    label: 'Agenda',    icon: Calendar },
    { id: 'team',      label: 'Équipe',    icon: Users },
    { id: 'clients',   label: 'Clientes',  icon: Heart },
    { id: 'products',  label: 'Produits',  icon: ShoppingBag },
    { id: 'loyalty',   label: 'Fidélité',  icon: Gift },
    { id: 'whatsapp',  label: 'Inbox',     icon: MessageCircle, highlight: true },
  ];
  return (
    <div className="scroll-thin" style={{
      background: C.cream, borderRadius: 14, padding: 6,
      border: '1px solid rgba(28,20,16,.06)',
      display: 'flex', gap: 4, overflowX: 'auto',
    }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        const count = counts[t.id];
        return (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: active ? `linear-gradient(135deg, ${C.rose}, ${C.roseDeep})` : 'transparent',
            color: active ? C.cream : C.inkSoft,
            padding: '10px 16px', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            boxShadow: active ? `0 6px 14px -4px ${C.rose}` : 'none',
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

function DashboardTab(props: {
  services: Product[]; reservations: Reservation[]; todayAppointments: Reservation[];
  caToday: number; currency: string; practitioners: Practitioner[];
  threads: WaThread[]; onAddAppointment: () => void;
}) {
  const { services, reservations, todayAppointments, caToday, currency, practitioners, threads, onAddAppointment } = props;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = reservations.filter(r => r.date >= today && r.status !== 'cancelled');

  const kpis: Array<{ id: string; label: string; value: string; unit?: string; sub: string; icon: any; color: 'rose' | 'violet' | 'gold' | 'emerald' }> = [
    { id: 'ca', label: 'CA du jour', value: formatShort(caToday), unit: currency,
      sub: `${todayAppointments.length} RDV`, icon: Banknote, color: 'emerald' },
    { id: 'today', label: 'RDV aujourd\'hui', value: String(todayAppointments.length),
      sub: `${todayAppointments.filter(r => r.status === 'confirmed').length} confirmés`, icon: Calendar, color: 'rose' },
    { id: 'team', label: 'Équipe', value: String(practitioners.filter(p => p.active !== false).length),
      sub: `${practitioners.length} au total`, icon: Users, color: 'violet' },
    { id: 'services', label: 'Services', value: String(services.length),
      sub: 'au catalogue', icon: Scissors, color: 'gold' },
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
              border: '1px solid rgba(28,20,16,.06)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${cs.main}, ${cs.deep})` }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: cs.soft, color: cs.deep,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="display-font mono-font" style={{ fontSize: 28, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-.02em', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                {s.value}
                {s.unit && <span style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>{s.unit}</span>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 6 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: C.inkSoft }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="map-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
        <AgendaLivePanel reservations={todayAppointments} services={services} practitioners={practitioners}
          onAddAppointment={onAddAppointment} />
        <TeamLivePanel practitioners={practitioners} reservations={todayAppointments} services={services} />
      </div>

      {upcoming.length > 0 && (
        <UpcomingPanel reservations={upcoming.slice(0, 6)} services={services} practitioners={practitioners} />
      )}

      <WhatsAppLeadsPanel threads={threads} />
    </div>
  );
}

function AgendaLivePanel({ reservations, services, practitioners, onAddAppointment }: {
  reservations: Reservation[]; services: Product[]; practitioners: Practitioner[];
  onAddAppointment: () => void;
}) {
  const sorted = [...reservations].sort((a, b) => a.time.localeCompare(b.time));
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.roseDark}, ${C.roseDeep})`,
      borderRadius: 18, border: `1px solid ${C.gold}30`,
      overflow: 'hidden', position: 'relative',
      minHeight: 380, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 18px', background: 'rgba(0,0,0,.25)', borderBottom: `1px solid ${C.gold}20`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Calendar size={14} color={C.gold} />
        <span className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: '.12em', flex: 1 }}>
          AGENDA AUJOURD'HUI · {sorted.length} RDV
        </span>
        <span className="pill" style={{ background: `${C.emerald}25`, color: C.emerald, border: `1px solid ${C.emerald}50`, fontSize: 9, fontWeight: 800 }}>
          <span className="live-dot" style={{ width: 6, height: 6, color: C.emerald }}></span>
          LIVE
        </span>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {sorted.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,250,240,.7)' }}>
            <Calendar size={36} color={C.gold} style={{ marginBottom: 10, opacity: .7 }} />
            <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 4 }}>Aucun RDV aujourd'hui</div>
            <div style={{ fontSize: 11, marginBottom: 12 }}>Profite pour préparer la journée.</div>
            <button onClick={onAddAppointment} className="btn-ghost-light" style={{ padding: '7px 12px' }}>
              <Plus size={11} /> Nouveau RDV
            </button>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sorted.map(r => {
              const svc = services.find(p => p.id === r.serviceId);
              const prac = practitioners.find(p => p.name === r.practitionerName);
              return (
                <div key={r.id} style={{
                  background: 'rgba(255,250,240,.08)',
                  borderLeft: `3px solid ${r.status === 'confirmed' ? C.emerald : r.status === 'seated' ? C.gold : C.coral}`,
                  borderRadius: 10, padding: 10,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 48, textAlign: 'center' }}>
                    <div className="mono-font" style={{ fontSize: 15, fontWeight: 800, color: C.cream }}>{r.time}</div>
                    <div style={{ fontSize: 8, color: 'rgba(255,250,240,.55)', fontWeight: 700 }}>{r.durationMinutes ? formatDuration(r.durationMinutes) : ''}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.cream, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.customerName}
                      {r.status === 'seated' && <span className="pill" style={{ background: `${C.gold}25`, color: C.gold, fontSize: 9, fontWeight: 800 }}>En cours</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,250,240,.65)' }}>
                      {svc?.name ?? r.notes ?? '—'} {prac && <span style={{ color: prac.color ?? C.gold }}>· {prac.name}</span>}
                    </div>
                  </div>
                  {svc && (
                    <div className="mono-font" style={{ fontSize: 12, fontWeight: 800, color: C.gold }}>
                      {formatShort(svc.price)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamLivePanel({ practitioners, reservations, services }: {
  practitioners: Practitioner[]; reservations: Reservation[]; services: Product[];
}) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div style={{
      background: C.cream, borderRadius: 18, overflow: 'hidden',
      border: '1px solid rgba(28,20,16,.06)',
      minHeight: 380, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 18px', background: `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})`, color: C.cream, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Users size={16} />
        <div style={{ flex: 1 }}>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', opacity: .9 }}>
            ÉQUIPE · LIVE
          </div>
          <div className="display-font" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em' }}>
            {practitioners.length} praticien{practitioners.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {practitioners.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: C.inkSoft }}>
            <Users size={36} color={C.inkLight} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Pas encore d'équipe</div>
            <div style={{ fontSize: 11 }}>Ajoute des praticiens dans l'onglet Équipe.</div>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {practitioners.map(p => {
              const today = new Date().toISOString().slice(0, 10);
              const todayBookings = reservations.filter(r => r.practitionerName === p.name && r.date === today && r.status !== 'cancelled');
              const inProgress = todayBookings.find(r => {
                const [h, m] = r.time.split(':').map(Number);
                const start = h * 60 + m;
                const end = start + (r.durationMinutes ?? 60);
                return start <= nowMin && nowMin < end;
              });
              const busy = !!inProgress;
              return (
                <div key={p.id} style={{
                  background: C.creamDeep, borderRadius: 11, padding: 10,
                  display: 'flex', alignItems: 'center', gap: 10,
                  border: '1px solid rgba(28,20,16,.06)',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${p.color ?? C.rose}, ${p.color ?? C.roseDeep})`,
                    color: C.cream, fontWeight: 700, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Fraunces, serif', flexShrink: 0, position: 'relative',
                  }}>
                    {initials(p.name)}
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: busy ? C.coral : C.emerald, border: `2px solid ${C.creamDeep}` }}></div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: C.inkSoft }}>{p.role ?? 'Praticien'}</div>
                    {busy ? (
                      <div className="pill" style={{ background: C.coralSoft, color: C.coralDeep, fontSize: 9, fontWeight: 700, marginTop: 3 }}>
                        En cours · {services.find(s => s.id === inProgress?.serviceId)?.name ?? inProgress?.customerName}
                      </div>
                    ) : (
                      <div className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDark, fontSize: 9, fontWeight: 700, marginTop: 3 }}>
                        ● Disponible
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="mono-font" style={{ fontSize: 14, fontWeight: 800, color: C.violetDeep }}>{todayBookings.length}</div>
                    <div style={{ fontSize: 9, color: C.inkLight }}>RDV jour</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function UpcomingPanel({ reservations, services, practitioners }: { reservations: Reservation[]; services: Product[]; practitioners: Practitioner[] }) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: '1px solid rgba(28,20,16,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div className="pill" style={{ background: C.violetSoft, color: C.violetDeep, fontSize: 10, marginBottom: 4 }}>
            <Calendar size={11} /> PROCHAINS RDV
          </div>
          <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0 }}>
            <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violetDeep }}>À venir</em>
          </h3>
        </div>
      </div>
      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reservations.map(r => {
          const svc = services.find(p => p.id === r.serviceId);
          const prac = practitioners.find(p => p.name === r.practitionerName);
          return (
            <div key={r.id} style={{
              background: C.creamDeep, borderRadius: 11, padding: 10,
              border: '1px solid rgba(28,20,16,.06)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 64, padding: 6, borderRadius: 9, background: '#fff', textAlign: 'center', border: `1px solid ${C.roseSoft}` }}>
                <div style={{ fontSize: 9, color: C.roseDeep, fontWeight: 700, textTransform: 'uppercase' }}>
                  {new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                </div>
                <div className="display-font" style={{ fontSize: 15, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
                  {new Date(r.date).getDate()}
                </div>
                <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700 }}>{r.time}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{r.customerName}</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>
                  {svc?.name ?? '—'} {prac && <>· <span style={{ color: prac.color ?? C.roseDeep, fontWeight: 600 }}>{prac.name}</span></>}
                </div>
              </div>
              <a href={`https://wa.me/${r.customerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="icon-btn" style={{ background: C.whatsappSoft, color: C.whatsappDark, width: 30, height: 30, textDecoration: 'none' }}>
                <MessageCircle size={13} />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WhatsAppLeadsPanel({ threads }: { threads: WaThread[] }) {
  const recent = threads.slice(0, 5);
  if (recent.length === 0) return null;
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: `1.5px solid ${C.whatsapp}30` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div className="pill" style={{ background: `${C.whatsapp}15`, color: C.whatsappDark, fontSize: 10, marginBottom: 4 }}>
            <MessageCircle size={11} /> LEADS WHATSAPP · {threads.length} CONVERSATIONS
          </div>
          <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0 }}>
            Conversations <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.whatsappDark }}>récentes</em>
          </h3>
        </div>
      </div>
      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recent.map(t => (
          <div key={t.phone} style={{ background: C.creamDeep, borderRadius: 11, padding: 10, border: '1px solid rgba(28,20,16,.06)', display: 'flex', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`, color: C.cream, fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>
              {initials(t.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{t.name}</span>
                <span className="mono-font" style={{ fontSize: 9, color: C.inkLight }}>{timeAgo(t.lastAt)}</span>
              </div>
              <p style={{ fontSize: 11, color: C.inkSoft, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastMessage || '—'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServicesTab({ services, currency, onSelect, onAdd }: { services: Product[]; currency: string; onSelect: (p: Product) => void; onAdd: () => void }) {
  const [dept, setDept] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');
  const filtered = services.filter(s => {
    if (dept !== 'all' && s.category !== dept) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [s.name, s.description, s.category].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(28,20,16,.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, background: C.creamDeep, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={14} color={C.inkSoft} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom du service, description, département…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: C.ink, fontFamily: 'inherit', minWidth: 0 }} />
          </div>
          <button onClick={onAdd} className="btn-primary"><Plus size={13} /> Ajouter un service</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setDept('all')} style={pillStyle(dept === 'all', C.rose)}>
            Tous {countPill(dept === 'all', services.length)}
          </button>
          {DEPARTMENTS.map(d => (
            <button key={d.id} onClick={() => setDept(d.id)} style={pillStyle(dept === d.id, d.color)}>
              {d.emoji} {d.label} {countPill(dept === d.id, services.filter(s => s.category === d.id).length)}
            </button>
          ))}
        </div>
      </div>

      {services.length === 0 ? (
        <EmptyState icon={Scissors} title="Pas encore de service"
          desc="Ajoute tes services (nom, durée, prix, département)."
          cta="Ajouter mon 1er service" onAction={onAdd} />
      ) : (
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {filtered.map(s => <ServiceCard key={s.id} service={s} currency={currency} onClick={() => onSelect(s)} />)}
        </div>
      )}
    </div>
  );
}

function pillStyle(active: boolean, color: string): React.CSSProperties {
  return {
    background: active ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'transparent',
    color: active ? C.cream : C.inkSoft,
    padding: '7px 12px', borderRadius: 100,
    fontSize: 11, fontWeight: 700, cursor: 'pointer',
    border: active ? 'none' : '1px solid rgba(28,20,16,.1)',
    fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  };
}
function countPill(active: boolean, n: number) {
  return (
    <span className="mono-font" style={{
      background: active ? 'rgba(255,250,240,.25)' : C.creamDeep,
      color: active ? C.cream : C.inkSoft,
      padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800,
    }}>{n}</span>
  );
}

function ServiceCard({ service, currency, onClick }: { service: Product; currency: string; onClick: () => void }) {
  const image = service.primaryImageUrl || service.imageUrl || (Array.isArray(service.imageUrls) ? service.imageUrls[0] : undefined);
  const dept = DEPARTMENTS.find(d => d.id === service.category);
  return (
    <div onClick={onClick} className="card-lift" style={{
      background: C.cream, borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(28,20,16,.06)', cursor: 'pointer',
    }}>
      <div style={{ height: 160, position: 'relative', overflow: 'hidden', background: image ? '#000' : gradientFor(service.id) }}>
        {image ? (
          <img src={image} alt={service.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,250,240,.4)' }}>
            <Scissors size={60} strokeWidth={1} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {service.status !== 'active' && (
            <span className="pill" style={{ background: 'rgba(255,250,240,.95)', color: C.inkSoft, fontWeight: 800, fontSize: 10, backdropFilter: 'blur(20px)' }}>
              {service.status === 'draft' ? 'Brouillon' : service.status === 'out_of_stock' ? 'Indispo' : 'Archivé'}
            </span>
          )}
          {dept && (
            <span className="pill" style={{ background: dept.color, color: C.cream, fontWeight: 800, fontSize: 10 }}>
              {dept.emoji} {dept.label}
            </span>
          )}
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <button onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="icon-btn" style={{ background: 'rgba(255,250,240,.95)', color: C.ink, backdropFilter: 'blur(20px)', width: 32, height: 32 }}>
            <Edit3 size={13} />
          </button>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <h3 className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {service.name}
        </h3>
        {service.description && (
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '4px 0 10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {service.description}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="display-font mono-font" style={{ fontSize: 18, fontWeight: 800, color: C.roseDeep }}>
            {formatShort(service.price || 0)}
            <span style={{ fontSize: 9, color: C.inkLight, fontWeight: 700, marginLeft: 4 }}>{(service.currency || currency).toUpperCase()}</span>
          </div>
          {service.durationMinutes && (
            <div style={{ fontSize: 11, color: C.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {formatDuration(service.durationMinutes)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgendaTab({ reservations, services, practitioners, onAddAppointment }: {
  reservations: Reservation[]; services: Product[]; practitioners: Practitioner[];
  onAddAppointment: () => void;
}) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun, 1=Mon, ...
    const offset = day === 0 ? -6 : 1 - day; // start week on Monday
    d.setDate(d.getDate() + offset);
    return d;
  });
  const days = 7;
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => {
    const d = new Date(startDate); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  }), [startDate]);
  const todayStr = new Date().toISOString().slice(0, 10);

  const shiftWeek = (offset: number) => {
    const d = new Date(startDate); d.setDate(d.getDate() + offset * 7);
    setStartDate(d);
  };

  if (practitioners.length === 0) {
    return <EmptyState icon={Users} title="Pas encore d'équipe"
      desc="Ajoute des praticiens dans l'onglet Équipe pour voir l'agenda." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 12, border: '1px solid rgba(28,20,16,.06)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => shiftWeek(-1)} className="icon-btn ghost"><ChevronLeft size={14} /></button>
        <button onClick={() => {
          const d = new Date(); d.setHours(0, 0, 0, 0);
          const day = d.getDay(); const offset = day === 0 ? -6 : 1 - day;
          d.setDate(d.getDate() + offset); setStartDate(d);
        }} className="btn-secondary" style={{ padding: '7px 12px', fontSize: 11 }}>
          Cette semaine
        </button>
        <button onClick={() => shiftWeek(1)} className="icon-btn ghost"><ChevronRight size={14} /></button>
        <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginLeft: 6 }}>
          Semaine du {startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </div>
        <button onClick={onAddAppointment} className="btn-primary" style={{ marginLeft: 'auto' }}>
          <Plus size={13} /> Nouveau RDV
        </button>
      </div>

      <div style={{
        background: C.cream, borderRadius: 14, overflow: 'auto',
        border: '1px solid rgba(28,20,16,.06)',
      }} className="scroll-thin">
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 800 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: C.cream, zIndex: 2 }}>
              <th style={{
                padding: '12px 10px', textAlign: 'left', fontSize: 11, fontWeight: 800,
                color: C.inkSoft, borderBottom: `2px solid ${C.creamDeep}`,
                textTransform: 'uppercase', letterSpacing: '.05em',
                minWidth: 160, position: 'sticky', left: 0, background: C.cream,
              }}>
                Praticien
              </th>
              {dates.map(d => {
                const day = new Date(d);
                const isToday = d === todayStr;
                return (
                  <th key={d} style={{
                    padding: '8px 6px', textAlign: 'center', fontSize: 10, fontWeight: 700,
                    color: isToday ? C.roseDeep : C.inkSoft,
                    background: isToday ? C.roseSoft : 'transparent',
                    borderBottom: `2px solid ${isToday ? C.rose : C.creamDeep}`,
                  }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, opacity: .7 }}>
                      {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </div>
                    <div className="display-font" style={{ fontSize: 14, fontWeight: 800 }}>{day.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {practitioners.map(p => (
              <tr key={p.id}>
                <td style={{
                  padding: '10px', borderBottom: `1px solid ${C.creamDeep}`,
                  background: C.cream, position: 'sticky', left: 0, zIndex: 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${p.color ?? C.rose}, ${p.color ?? C.roseDeep})`, color: C.cream, fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif' }}>
                      {initials(p.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>{p.name}</div>
                      <div style={{ fontSize: 9, color: C.inkSoft }}>{p.role}</div>
                    </div>
                  </div>
                </td>
                {dates.map(d => {
                  const bookings = reservations.filter(r => r.practitionerName === p.name && r.date === d && r.status !== 'cancelled');
                  const isToday = d === todayStr;
                  return (
                    <td key={d} style={{
                      padding: 4, borderBottom: `1px solid ${C.creamDeep}`,
                      background: isToday ? `${C.rose}05` : 'transparent', verticalAlign: 'top',
                    }}>
                      {bookings.length === 0 ? (
                        <div style={{ height: 40 }}></div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {bookings.slice(0, 3).map(b => {
                            const svc = services.find(s => s.id === b.serviceId);
                            return (
                              <div key={b.id} title={`${b.time} · ${b.customerName} · ${svc?.name ?? ''}`} style={{
                                background: `linear-gradient(135deg, ${p.color ?? C.rose}, ${p.color ?? C.roseDeep})`,
                                color: C.cream, padding: '3px 6px', borderRadius: 5,
                                fontSize: 9, fontWeight: 700,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                <span className="mono-font">{b.time}</span> {b.customerName.split(' ')[0]}
                              </div>
                            );
                          })}
                          {bookings.length > 3 && (
                            <div style={{ fontSize: 9, color: C.inkSoft, textAlign: 'center', fontWeight: 700 }}>
                              +{bookings.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamTab({ practitioners, reservations, onAdd, onEdit }: {
  practitioners: Practitioner[]; reservations: Reservation[]; storeId: string;
  onAdd: () => void; onEdit: (p: Practitioner) => void; onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(28,20,16,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="pill" style={{ background: C.violetSoft, color: C.violetDeep, fontSize: 10, marginBottom: 4 }}>
            <Users size={11} /> ÉQUIPE · {practitioners.length}
          </div>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
            Tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violetDeep }}>praticien·nes</em>
          </h3>
        </div>
        <button onClick={onAdd} className="btn-primary"><Plus size={13} /> Ajouter</button>
      </div>

      {practitioners.length === 0 ? (
        <EmptyState icon={Users} title="Pas encore d'équipe"
          desc="Ajoute tes praticiens (nom, rôle, spécialités, couleur)."
          cta="Ajouter mon 1er praticien" onAction={onAdd} />
      ) : (
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {practitioners.map(p => {
            const todayBookings = reservations.filter(r => r.practitionerName === p.name && r.date === today && r.status !== 'cancelled');
            return (
              <div key={p.id} onClick={() => onEdit(p)} className="card-lift" style={{
                background: C.cream, borderRadius: 16, padding: 16,
                border: '1px solid rgba(28,20,16,.06)',
                borderLeft: `4px solid ${p.color ?? C.rose}`,
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${p.color ?? C.rose}, ${p.color ?? C.roseDeep})`,
                    color: C.cream, fontWeight: 700, fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Fraunces, serif', flexShrink: 0,
                  }}>
                    {initials(p.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>{p.name}</h3>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{p.role ?? 'Praticien'}</div>
                  </div>
                </div>
                {p.specialties && p.specialties.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                    {p.specialties.map(s => {
                      const dept = DEPARTMENTS.find(d => d.id === s);
                      return (
                        <span key={s} className="pill" style={{ background: dept?.color ? `${dept.color}15` : C.creamDeep, color: dept?.color ?? C.inkSoft, fontSize: 9, fontWeight: 700 }}>
                          {dept?.emoji} {dept?.label ?? s}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSoft, paddingTop: 8, borderTop: `1px solid ${C.creamDeep}` }}>
                  <span><Calendar size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {todayBookings.length} RDV jour</span>
                  <span style={{ color: p.active === false ? C.coralDeep : C.emeraldDark }}>
                    {p.active === false ? '○ Inactif' : '● Actif'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClientsTab({ customers }: { customers: Customer[] }) {
  const stages: Array<{ id: Customer['stage']; label: string; color: string; icon: any }> = [
    { id: 'new',       label: 'Nouvelles',     color: C.cyan,    icon: Sparkles },
    { id: 'returning', label: 'Récurrentes',   color: C.rose,    icon: Heart },
    { id: 'loyal',     label: 'Fidèles (5+)',  color: C.gold,    icon: Star },
    { id: 'vip',       label: 'VIP (200k+)',   color: C.violet,  icon: Trophy },
    { id: 'lost',      label: 'Perdues (90j)', color: C.inkSoft, icon: X },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(28,20,16,.06)' }}>
        <div className="pill" style={{ background: C.roseSoft, color: C.roseDeep, fontSize: 10, marginBottom: 4 }}>
          <Users size={11} /> PIPELINE · {customers.length} CLIENT{customers.length > 1 ? 'S' : ''}
        </div>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
          Pipeline <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.roseDeep }}>clientes</em>
        </h3>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={Heart} title="Pas encore de cliente" desc="Tes clientes apparaissent dès leur 1er RDV." />
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }} className="scroll-thin">
          {stages.map(stage => {
            const list = customers.filter(c => c.stage === stage.id);
            const Icon = stage.icon;
            return (
              <div key={stage.id} style={{
                minWidth: 280, flex: '1 1 280px',
                background: C.cream, borderRadius: 14, padding: 12,
                border: '1px solid rgba(28,20,16,.06)',
                borderTop: `3px solid ${stage.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.creamDeep}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${stage.color}15`, color: stage.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} />
                  </div>
                  <div className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink, flex: 1 }}>{stage.label}</div>
                  <span className="mono-font" style={{ background: `${stage.color}15`, color: stage.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{list.length}</span>
                </div>
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 16, fontSize: 11, color: C.inkLight, fontStyle: 'italic' }}>—</div>
                  ) : list.map(c => (
                    <div key={c.phone} style={{ background: C.creamDeep, borderRadius: 10, padding: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${stage.color}, ${stage.color}cc)`, color: C.cream, fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>
                          {initials(c.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 9, color: C.inkLight, fontFamily: 'JetBrains Mono' }}>{timeAgo(c.lastAt)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.inkSoft, marginBottom: 4 }}>
                        <span>{c.visits} visite{c.visits > 1 ? 's' : ''}</span>
                        <span className="mono-font" style={{ fontWeight: 700, color: C.roseDeep }}>{formatShort(c.totalSpent)}</span>
                      </div>
                      {c.favoriteService && (
                        <div className="pill" style={{ background: C.violetSoft, color: C.violetDeep, fontSize: 9, fontWeight: 700, marginBottom: 6 }}>
                          ♡ {c.favoriteService}
                        </div>
                      )}
                      <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                        <button style={{
                          width: '100%', background: C.whatsappSoft, color: C.whatsappDark, border: 'none',
                          padding: '5px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                          fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}><MessageCircle size={10} /> Contacter</button>
                      </a>
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

function ProductsTab({ products, currency, onSelect, onAdd }: { products: Product[]; currency: string; onSelect: (p: Product) => void; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(28,20,16,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="pill" style={{ background: C.goldSoft, color: C.goldDeep, fontSize: 10, marginBottom: 4 }}>
            <ShoppingBag size={11} /> RETAIL · {products.length} PRODUIT{products.length > 1 ? 'S' : ''}
          </div>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
            Produits <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.goldDeep }}>à vendre</em>
          </h3>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '4px 0 0' }}>
            Shampoings, soins, accessoires. Vente en boutique ou via WhatsApp.
          </p>
        </div>
        <button onClick={onAdd} className="btn-gold"><Plus size={13} /> Nouveau produit</button>
      </div>

      {products.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Pas encore de produit retail"
          desc="Ajoute des produits à vendre (shampoings, soins, accessoires)."
          cta="Ajouter mon 1er produit" onAction={onAdd} />
      ) : (
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {products.map(p => <ServiceCard key={p.id} service={p} currency={currency} onClick={() => onSelect(p)} />)}
        </div>
      )}
    </div>
  );
}

function LoyaltyTab({ store, customers, currency, onChanged }: {
  store: Store; customers: Customer[]; currency: string; onChanged: () => void;
}) {
  const [enabled, setEnabled] = useState(store.loyaltyEnabled !== false);
  const [threshold, setThreshold] = useState<number | ''>(store.loyaltyThreshold ?? 5);
  const [discountPct, setDiscountPct] = useState<number | ''>(store.loyaltyDiscountPct ?? 10);
  const [submitting, setSubmitting] = useState(false);

  const eligible = customers.filter(c => c.visits >= (typeof threshold === 'number' ? threshold : 5));

  const save = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/commerce/stores/${store.id}`, {
        loyaltyEnabled: enabled,
        loyaltyThreshold: typeof threshold === 'number' ? threshold : 5,
        loyaltyDiscountPct: typeof discountPct === 'number' ? discountPct : 10,
      });
      toast.success('Programme fidélité mis à jour');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(28,20,16,.06)' }}>
        <div className="pill" style={{ background: C.goldSoft, color: C.goldDeep, fontSize: 10, marginBottom: 4 }}>
          <Gift size={11} /> PROGRAMME FIDÉLITÉ
        </div>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
          Récompense tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>clientes fidèles</em>
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '4px 0 0' }}>
          Réduction automatique appliquée après X visites.
        </p>
      </div>

      <div style={{ background: C.cream, borderRadius: 14, padding: 18, border: '1px solid rgba(28,20,16,.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button type="button" onClick={() => setEnabled(!enabled)} style={{
          padding: '12px 14px', borderRadius: 10,
          background: enabled ? `${C.gold}10` : C.creamDeep,
          border: `1.5px solid ${enabled ? C.gold : C.creamDeep}`,
          color: enabled ? C.goldDeep : C.inkSoft,
          fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span><Gift size={14} style={{ display: 'inline', marginRight: 8 }} /> Programme actif</span>
          <span style={{ fontSize: 12 }}>{enabled ? '✓ Oui' : '○ Non'}</span>
        </button>

        {enabled && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Label>Seuil (visites)</Label>
                <Input type="number" value={String(threshold ?? '')} onChange={v => setThreshold(v === '' ? '' : parseInt(v))} mono />
              </div>
              <div>
                <Label>Réduction (%)</Label>
                <Input type="number" value={String(discountPct ?? '')} onChange={v => setDiscountPct(v === '' ? '' : parseInt(v))} mono />
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: C.goldSoft, fontSize: 12, color: C.goldDark }}>
              💡 Après <strong>{threshold || 5}</strong> visites, la cliente bénéficie de <strong>{discountPct || 10}%</strong> de réduction sur son prochain service.
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: C.roseSoft, fontSize: 12, color: C.roseDeep }}>
              ✨ <strong>{eligible.length}</strong> cliente{eligible.length > 1 ? 's' : ''} déjà éligible{eligible.length > 1 ? 's' : ''} à la réduction.
            </div>
          </>
        )}

        <button onClick={save} disabled={submitting} className="btn-gold" style={{ alignSelf: 'flex-end' }}>
          {submitting ? <><Loader2 size={14} className="spin" /> …</> : <><Save size={14} /> Enregistrer</>}
        </button>
      </div>

      {enabled && eligible.length > 0 && (
        <div style={{ background: C.cream, borderRadius: 14, padding: 18, border: '1px solid rgba(28,20,16,.06)' }}>
          <h3 className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: '0 0 12px' }}>
            Clientes éligibles ({eligible.length})
          </h3>
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {eligible.slice(0, 12).map(c => (
              <div key={c.phone} style={{ background: C.creamDeep, borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.cream, fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif' }}>
                  {initials(c.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 9, color: C.goldDark, fontWeight: 700 }}>{c.visits} visites · −{discountPct || 10}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WhatsAppTab({ threads, connected, onRefresh }: { threads: WaThread[]; connected: boolean; onRefresh: () => void }) {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(threads[0]?.phone ?? null);
  const selected = threads.find(t => t.phone === selectedPhone) ?? threads[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(28,20,16,.06)' }}>
        <div className="pill" style={{
          background: connected ? `${C.whatsapp}15` : C.creamDeep,
          color: connected ? C.whatsappDark : C.inkSoft,
          fontSize: 10, fontWeight: 700, marginBottom: 4,
        }}>
          {connected ? <><span className="live-dot" style={{ width: 6, height: 6, color: C.whatsapp }}></span> WHATSAPP CONNECTÉ</> : <>● NON CONNECTÉ</>}
        </div>
        <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0 }}>
          Messages <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.whatsappDark }}>du salon</em>
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
          {threads.length} conversation{threads.length > 1 ? 's' : ''}. Paramètres globaux dans <a href="/admin/whatsapp" style={{ color: C.roseDeep, fontWeight: 600, textDecoration: 'none' }}>Admin · WhatsApp</a>.
        </p>
      </div>

      {threads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 14, border: '1px dashed rgba(28,20,16,.15)' }}>
          <MessageCircle size={48} color={C.whatsapp} style={{ marginBottom: 12, opacity: .7 }} />
          <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>
            {connected ? 'Pas encore de message' : 'WhatsApp non connecté'}
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px' }}>
            {connected ? "Dès qu'une cliente t'écrit, sa conversation apparaît ici." : "Connecte WhatsApp Business pour recevoir les messages."}
          </p>
          {connected ? (
            <button onClick={onRefresh} className="btn-secondary"><RefreshCw size={13} /> Rafraîchir</button>
          ) : (
            <a href="/admin/whatsapp" style={{ textDecoration: 'none' }}>
              <button className="btn-whatsapp"><MessageCircle size={14} /> Connecter WhatsApp</button>
            </a>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div className="hide-on-mobile scroll-thin" style={{
            width: 340, flexShrink: 0, background: C.cream, borderRadius: 16, overflow: 'auto',
            border: '1px solid rgba(28,20,16,.06)', height: 'calc(100vh - 280px)', minHeight: 460,
          }}>
            <div style={{ padding: '14px 16px', background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`, color: C.cream, position: 'sticky', top: 0, zIndex: 1 }}>
              <div className="mono-font" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', opacity: .9 }}>WHATSAPP BUSINESS</div>
              <h3 className="display-font" style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{threads.length} conversations</h3>
            </div>
            {threads.map(t => {
              const sel = selected?.phone === t.phone;
              return (
                <div key={t.phone} onClick={() => setSelectedPhone(t.phone)} style={{
                  padding: '12px 16px', borderBottom: '1px solid rgba(28,20,16,.04)', cursor: 'pointer',
                  background: sel ? `${C.whatsapp}08` : (t.unread ? `${C.whatsapp}03` : 'transparent'),
                  borderLeft: sel ? `3px solid ${C.whatsapp}` : (t.unread ? `3px solid ${C.whatsapp}80` : '3px solid transparent'),
                  display: 'flex', gap: 10,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`, color: C.cream, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>
                    {initials(t.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      <span className="mono-font" style={{ fontSize: 9, color: C.inkLight }}>{timeAgo(t.lastAt)}</span>
                    </div>
                    <p style={{ fontSize: 11, color: t.unread ? C.ink : C.inkSoft, margin: 0, fontWeight: t.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastMessage || '—'}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1, minWidth: 0, background: C.cream, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(28,20,16,.06)', height: 'calc(100vh - 280px)', minHeight: 460, display: 'flex', flexDirection: 'column' }}>
            {selected && (
              <>
                <div style={{ padding: '14px 18px', background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`, color: C.cream, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,250,240,.2)', color: C.cream, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', border: '2px solid rgba(255,250,240,.3)' }}>
                    {initials(selected.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 className="display-font" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selected.name}</h3>
                    <div style={{ fontSize: 11, opacity: .85, fontFamily: 'JetBrains Mono' }}>{selected.phone}</div>
                  </div>
                </div>
                <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 18, background: `linear-gradient(180deg, ${C.cream}, ${C.creamDeep}50)`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...selected.messages].reverse().map(m => {
                    const inbound = m.direction === 'inbound';
                    const body = m.body ?? m.text ?? m.message ?? '';
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: inbound ? 'flex-start' : 'flex-end' }}>
                        <div style={{
                          background: inbound ? C.cream : C.whatsappSoft,
                          border: inbound ? '1px solid rgba(28,20,16,.06)' : `1px solid ${C.whatsapp}30`,
                          padding: '10px 14px',
                          borderRadius: inbound ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                          maxWidth: '75%', fontSize: 13, color: C.ink, lineHeight: 1.5,
                        }}>
                          {body || <em style={{ color: C.inkLight }}>(message vide)</em>}
                          <div className="mono-font" style={{ fontSize: 9, color: C.inkLight, marginTop: 4, textAlign: 'right' }}>{timeAgo(getTimestamp(m.createdAt))}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: 14, borderTop: '1px solid rgba(28,20,16,.06)' }}>
                  <a href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <button className="btn-whatsapp" style={{ width: '100%', justifyContent: 'center' }}>
                      <Send size={14} /> Répondre sur WhatsApp
                    </button>
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, cta, onAction }: {
  icon: any; title: string; desc: string; cta?: string; onAction?: () => void;
}) {
  return (
    <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 14, border: '1px dashed rgba(28,20,16,.15)' }}>
      <Icon size={48} color={C.rose} style={{ marginBottom: 12, opacity: .7 }} />
      <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>{title}</h3>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>{desc}</p>
      {cta && onAction && (<button onClick={onAction} className="btn-primary"><Plus size={14} /> {cta}</button>)}
    </div>
  );
}

function SalonActivationScreen({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('Paiement par Wave, espèces ou carte sur place.');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim().length >= 2 && ownerPhone.length >= 6 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/commerce/stores', {
        name: name.trim(), ownerPhone: ownerPhone.trim(),
        paymentInstructions: paymentInstructions.trim(),
        businessType: 'service',
      });
      toast.success('Salon activé', `${name.trim()} est en ligne.`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Activation impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{STYLES}</style>
      <div style={{ background: C.cream, borderRadius: 22, maxWidth: 520, width: '100%', boxShadow: '0 24px 60px -16px rgba(28,20,16,.18)', overflow: 'hidden' }}>
        <div style={{ background: `linear-gradient(135deg, ${C.rose}, ${C.violet})`, color: '#fff', padding: '36px 32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div className="grain"></div>
          <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Flower2 size={28} color="#fff" />
          </div>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            Active ton <em style={{ fontStyle: 'italic', fontWeight: 500 }}>salon</em>
          </h1>
          <p style={{ fontSize: 13, opacity: .92, marginTop: 8 }}>Services · Agenda · Équipe · Fidélité</p>
        </div>
        <div style={{ padding: '26px 32px 30px' }}>
          <div style={{ marginBottom: 14 }}>
            <Label>Nom du salon</Label>
            <Input value={name} onChange={setName} placeholder="Nom de ton salon" autoFocus />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Numéro WhatsApp</Label>
            <Input value={ownerPhone} onChange={setOwnerPhone} placeholder="+XXX XX XX XX XX" />
          </div>
          <div style={{ marginBottom: 22 }}>
            <Label>Instructions paiement</Label>
            <textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={submit} disabled={!canSubmit} className="btn-primary">
              {submitting ? <><Loader2 size={14} className="spin" /> Activation…</> : <><Scissors size={14} /> Activer mon salon</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductModal({ storeId, currency, product, isService, onClose, onSaved, onDeleted }: {
  storeId: string; currency: string; product?: Product;
  isService?: boolean;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState<number | ''>(product?.price ?? '');
  const [duration, setDuration] = useState<number | ''>(product?.durationMinutes ?? (isService ? 60 : ''));
  const [category, setCategory] = useState(product?.category ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [status, setStatus] = useState<Product['status']>(product?.status ?? 'active');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const payload: any = {
      name: name.trim(), price,
      category: category.trim(),
      description: description.trim(),
      stockQty: isService ? 999 : 1,
      status,
      ...(isService && typeof duration === 'number' && duration > 0 ? { durationMinutes: duration } : {}),
      ...(imageBase64 ? { imageBase64, imageMimeType } : {}),
    };
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/products/${product!.id}`, payload);
        toast.success(isService ? 'Service mis à jour' : 'Produit mis à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/products`, payload);
        toast.success(isService ? 'Service ajouté' : 'Produit ajouté');
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/products/${product!.id}`);
      toast.success('Supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={isEdit ? (isService ? 'Modifier le service' : 'Modifier le produit') : (isService ? 'Nouveau service' : 'Nouveau produit')} color={isService ? C.roseDeep : C.goldDeep} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Label>Photo</Label>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {imagePreview ? (
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', maxHeight: 200 }}>
            <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ position: 'absolute', top: 8, right: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(28,20,16,.8)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
              <Camera size={11} /> Remplacer
            </button>
          </div>
        ) : (
          <button onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', padding: '20px 14px', borderRadius: 12, background: C.creamDeep, color: isService ? C.roseDeep : C.goldDeep, border: `1.5px dashed ${isService ? C.rose : C.gold}`, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Camera size={22} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Choisir une photo</span>
          </button>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <Label>Nom</Label>
        <Input value={name} onChange={setName} placeholder={isService ? "Nom du service" : "Nom du produit"} autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isService ? '1fr 1fr' : '2fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Prix ({currency})</Label><Input type="number" value={String(price ?? '')} onChange={v => setPrice(v === '' ? '' : parseInt(v))} placeholder="5000" mono /></div>
        {isService && (
          <div><Label>Durée (min)</Label><Input type="number" value={String(duration ?? '')} onChange={v => setDuration(v === '' ? '' : parseInt(v))} placeholder="60" mono /></div>
        )}
        {!isService && (
          <div><Label>Catégorie</Label><Input value={category} onChange={setCategory} placeholder="Shampoing, Soin…" /></div>
        )}
      </div>
      {isService && (
        <div style={{ marginBottom: 12 }}>
          <Label>Département</Label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
            <option value="">— Choisir —</option>
            {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.emoji} {d.label}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <Label>Description</Label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      {isEdit && (
        <div style={{ marginBottom: 18 }}>
          <Label>Statut</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['active', 'draft', 'archived'] as const).map(s => {
              const sel = status === s;
              const col = s === 'active' ? C.emeraldDeep : s === 'draft' ? C.inkSoft : C.ink;
              const label = s === 'active' ? 'Actif' : s === 'draft' ? 'Brouillon' : 'Archivé';
              return (
                <button key={s} type="button" onClick={() => setStatus(s)} style={{
                  padding: '7px 14px', borderRadius: 100,
                  background: sel ? col : 'transparent', color: sel ? '#fff' : col,
                  border: `1.5px solid ${col}`, cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
                }}>{label}</button>
              );
            })}
          </div>
        </div>
      )}

      {isEdit && confirmDelete && (
        <div style={{ padding: 14, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>
            Supprimer <em>{product!.name}</em> ?
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
            style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: '#DC2626', border: '1.5px solid #FCA5A5', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: confirmDelete ? .4 : 1 }}>
            <Trash2 size={12} /> Supprimer
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={submit} disabled={!canSubmit} className="btn-primary">
            {submitting ? <><Loader2 size={14} className="spin" /> …</> : (isEdit ? <><Save size={14} /> Enregistrer</> : <><Plus size={14} /> Ajouter</>)}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function AppointmentModal({ storeId, services, practitioners, onClose, onCreated }: {
  storeId: string; services: Product[]; practitioners: Practitioner[];
  onClose: () => void; onCreated: () => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('10:00');
  const [serviceId, setServiceId] = useState<string>('');
  const [practitionerName, setPractitionerName] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const service = services.find(s => s.id === serviceId);
  const duration = service?.durationMinutes ?? 60;

  const canSubmit = customerName.trim().length >= 2 && customerPhone.length >= 6
    && date && time && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post(`/commerce/stores/${storeId}/reservations`, {
        customerName: customerName.trim(), customerPhone: customerPhone.trim(),
        date, time,
        ...(serviceId ? { serviceId, durationMinutes: duration } : {}),
        ...(practitionerName ? { practitionerName } : {}),
        reason: service ? service.name : 'RDV',
        notes: notes.trim(),
      });
      toast.success('RDV créé', `${customerName.trim()} · ${date} ${time}`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Création impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Nouveau RDV" color={C.roseDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Cliente</Label><Input value={customerName} onChange={setCustomerName} placeholder="Nom de la cliente" autoFocus /></div>
        <div><Label>Téléphone</Label><Input value={customerPhone} onChange={setCustomerPhone} placeholder="+XXX XX XX XX XX" /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Service</Label>
        <select value={serviceId} onChange={e => setServiceId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          <option value="">— Choisir —</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name} · {formatShort(s.price)} · {formatDuration(s.durationMinutes ?? 60)}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Praticien (optionnel)</Label>
        <select value={practitionerName} onChange={e => setPractitionerName(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          <option value="">— Aucun (auto-assigné) —</option>
          {practitioners.map(p => <option key={p.id} value={p.name}>{p.name} · {p.role}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><Label>Date</Label><Input type="date" value={date} onChange={setDate} /></div>
        <div><Label>Heure</Label><Input type="time" value={time} onChange={setTime} /></div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Préférences couleur, allergies, demande spéciale…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn-ghost">Annuler</button>
        <button onClick={submit} disabled={!canSubmit} className="btn-primary">
          {submitting ? <><Loader2 size={14} className="spin" /> …</> : <><Plus size={14} /> Créer</>}
        </button>
      </div>
    </ModalShell>
  );
}

function PractitionerModal({ storeId, practitioners, practitioner, onClose, onSaved, onDeleted }: {
  storeId: string; practitioners: Practitioner[]; practitioner?: Practitioner;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!practitioner;
  const [name, setName] = useState(practitioner?.name ?? '');
  const [role, setRole] = useState(practitioner?.role ?? '');
  const [color, setColor] = useState(practitioner?.color ?? C.rose);
  const [specialties, setSpecialties] = useState<string[]>(practitioner?.specialties ?? []);
  const [active, setActive] = useState<boolean>(practitioner?.active !== false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length >= 2 && !submitting;

  const toggleSpec = (id: string) => {
    setSpecialties(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const save = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      id: practitioner?.id ?? `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(), role: role.trim(),
      color, specialties, active,
    };
    let next: Practitioner[];
    if (isEdit) {
      next = practitioners.map(p => p.id === practitioner!.id ? { ...p, ...payload } : p);
    } else {
      next = [...practitioners, payload];
    }
    try {
      await api.patch(`/commerce/stores/${storeId}`, { practitioners: next });
      toast.success(isEdit ? 'Praticien mis à jour' : 'Praticien ajouté');
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    if (!confirm('Supprimer ce praticien ?')) return;
    setSubmitting(true);
    const next = practitioners.filter(p => p.id !== practitioner!.id);
    try {
      await api.patch(`/commerce/stores/${storeId}`, { practitioners: next });
      toast.success('Praticien supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const colors = [C.rose, C.violet, C.pink, C.gold, C.cyan, C.emerald, C.coral];

  return (
    <ModalShell title={isEdit ? 'Modifier le praticien' : 'Nouveau praticien'} color={C.violetDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Nom</Label><Input value={name} onChange={setName} placeholder="Nom du praticien" autoFocus /></div>
        <div><Label>Rôle</Label><Input value={role} onChange={setRole} placeholder="Coiffeuse senior, Esthéticienne…" /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Couleur identifiante</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {colors.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)} style={{
              width: 32, height: 32, borderRadius: 8,
              background: c, border: color === c ? `3px solid ${C.ink}` : '2px solid transparent',
              cursor: 'pointer',
            }} />
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Spécialités</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DEPARTMENTS.map(d => {
            const sel = specialties.includes(d.id);
            return (
              <button key={d.id} type="button" onClick={() => toggleSpec(d.id)} style={{
                padding: '6px 12px', borderRadius: 100,
                background: sel ? d.color : 'transparent',
                color: sel ? C.cream : d.color,
                border: `1.5px solid ${d.color}`,
                cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
              }}>{d.emoji} {d.label}</button>
            );
          })}
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <button type="button" onClick={() => setActive(!active)} style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: active ? `${C.emerald}10` : '#fff',
          border: `1.5px solid ${active ? C.emerald : C.creamDeep}`,
          color: active ? C.emeraldDark : C.inkSoft,
          fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Actif (visible dans l'agenda)</span>
          <span>{active ? '✓ Oui' : '○ Non'}</span>
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        {isEdit ? (
          <button onClick={remove} disabled={submitting}
            style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: '#DC2626', border: '1.5px solid #FCA5A5', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={12} /> Supprimer
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={save} disabled={!canSubmit} className="btn-primary">
            {submitting ? <><Loader2 size={14} className="spin" /> …</> : (isEdit ? <><Save size={14} /> Enregistrer</> : <><Plus size={14} /> Ajouter</>)}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, color, onClose, children }: { title: string; color: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, padding: 16,
      background: 'rgba(28,20,16,.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22, maxWidth: 620, width: '100%',
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 30px 80px -20px rgba(28,20,16,.5)',
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
