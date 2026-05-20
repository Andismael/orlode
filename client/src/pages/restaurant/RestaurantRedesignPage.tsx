/**
 * Restaurant Pack — Royal Bordeaux redesign.
 * Pitch: "Menu, salle, cuisine, commandes — tout depuis WhatsApp."
 *
 * 8 onglets admin, zéro mock :
 *   - Dashboard   · KPIs + plan de salle + KDS preview + leads WA
 *   - Menu        · CRUD plats avec catégories
 *   - Tables      · plan de salle (statut par table)
 *   - KDS         · Kitchen Display System (Kanban new/prépa/prêt/servi)
 *   - Commandes   · 3 onglets : salle / emporter / livraison
 *   - Réservations · table bookings
 *   - Clients     · CRM Kanban dérivé orders
 *   - WhatsApp    · inbox conversations
 *
 * Réutilise : products, tables, orders, reservations, /whatsapp/messages.
 * Order PATCH étendu : channel (dine_in/takeout/delivery) + tableId + kdsStatus + driver.
 *
 * Palette : Bordeaux + Safran + Or vieux.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  ChefHat, Camera, Plus, Loader2, X, Save, Trash2, Edit3,
  Sparkles, MessageCircle, Settings, RefreshCw, Send,
  LayoutDashboard, Banknote, Users, Clock,
  CheckCircle2, BadgeCheck, Search, Phone, Trophy, Star,
  UtensilsCrossed, ShoppingBag, Truck, Tag,
  Armchair, Flame, RefreshCcw,
} from 'lucide-react';
import { StoreSettingsModal } from '@/components/store/StoreSettingsModal';
import VoiceAssistantFAB from '@/components/ai/VoiceAssistantFAB';
import { InboxTab } from '@/components/inbox/InboxTab';
import { StoreHeroBranding, WhatsAppQuickButton, resolveAccent } from '@/components/store/StoreHeroBranding';

const C = {
  greenDeep:'#0A4F3C', greenDark:'#063D2E',
  cream:'#FFFAF0', creamDeep:'#F5EDD6', creamWarm:'#FAEBD7',
  bordeaux:'#7C2D12', bordeauxDeep:'#5C1D0A', bordeauxDark:'#3F1106', bordeauxSoft:'#FECACA',
  saffron:'#EA580C', saffronDeep:'#C2410C', saffronSoft:'#FED7AA',
  gold:'#A16207', goldDeep:'#854D0E', goldDark:'#713F12', goldSoft:'#FEF3C7', goldRich:'#D4A017',
  emerald:'#10B981', emeraldDeep:'#059669', emeraldDark:'#065F46', emeraldSoft:'#D1FAE5',
  coral:'#FB7185', coralDeep:'#E11D48', coralSoft:'#FFE4E6',
  whatsapp:'#25D366', whatsappDark:'#128C7E', whatsappSoft:'#DCF8C6',
  cyan:'#06B6D4', cyanSoft:'#CFFAFE', cyanDeep:'#0891B2',
  violet:'#7C3AED', violetSoft:'#F3E8FF', violetDeep:'#5B21B6',
  pink:'#EC4899',
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
    background: linear-gradient(90deg, ${C.gold}, ${C.bordeaux}, ${C.goldRich}, ${C.saffron}, ${C.gold});
    background-size: 200% auto; background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent; animation: shimmer 4s linear infinite;
  }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: .02em; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.emerald}; position: relative; flex-shrink: 0; }
  .live-dot::after { content:''; position:absolute; inset:-4px; border-radius:50%; background: currentColor; opacity:.4; animation: pulse 1.8s ease-in-out infinite; }
  .btn-primary { background: linear-gradient(135deg, ${C.bordeaux}, ${C.bordeauxDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; box-shadow: 0 8px 24px -8px ${C.bordeaux}; }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .btn-gold { background: linear-gradient(135deg, ${C.gold}, ${C.goldDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; }
  .btn-gold:hover:not(:disabled) { transform: translateY(-2px); }
  .btn-secondary { background: ${C.cream}; color: ${C.bordeauxDeep}; border: 1.5px solid rgba(28,20,16,.1); padding: 10px 16px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .2s ease; font-family: inherit; }
  .btn-secondary:hover:not(:disabled) { background: ${C.bordeauxDeep}; color: ${C.cream}; border-color: ${C.bordeauxDeep}; }
  .btn-ghost { background: transparent; color: ${C.ink}; border: 1.5px solid ${C.inkLight}; padding: 9px 16px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; font-family: inherit; }
  .btn-ghost-light { background: rgba(255,250,240,.08); color: ${C.cream}; border: 1px solid rgba(255,250,240,.15); padding: 9px 14px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
  .btn-ghost-light:hover { background: ${C.cream}; color: ${C.bordeauxDeep}; }
  .btn-whatsapp { background: linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; }
  .icon-btn { width: 34px; height: 34px; border-radius: 9px; background: ${C.bordeauxSoft}; color: ${C.bordeauxDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all .2s ease; flex-shrink: 0; }
  .icon-btn:hover { background: ${C.bordeauxDeep}; color: ${C.cream}; }
  .icon-btn.gold { background: ${C.goldSoft}; color: ${C.goldDark}; }
  .icon-btn.emerald { background: ${C.emeraldSoft}; color: ${C.emeraldDark}; }
  .icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${C.bordeauxDeep}; }
  .grain::before { content:''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: .06; pointer-events: none; mix-blend-mode: overlay; }
  .scroll-thin::-webkit-scrollbar { width: 6px; height: 6px; }
  .scroll-thin::-webkit-scrollbar-thumb { background: rgba(28,20,16,.15); border-radius: 100px; }
  @media (max-width: 1024px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .responsive-grid-3 { grid-template-columns: repeat(2, 1fr) !important; } .map-grid { grid-template-columns: 1fr !important; } }
  @media (max-width: 768px) { .responsive-grid-4 { grid-template-columns: 1fr !important; } .responsive-grid-3 { grid-template-columns: 1fr !important; } .hide-on-mobile { display: none !important; } .hero-title { font-size: 30px !important; } }
  @media (max-width: 480px) { .hero-pad { padding: 16px 18px !important; } .hero-title { font-size: 26px !important; } .pack-modal { max-width: 100% !important; margin: 6px !important; } .pack-modal-body { padding: 14px 16px !important; } .voice-fab, .pack-fab { bottom: max(20px, env(safe-area-inset-bottom)) !important; right: max(16px, env(safe-area-inset-right)) !important; } }
`;

interface Store { id: string; name: string; ownerPhone: string; currency: string; paymentInstructions?: string; }
interface Product {
  id: string; name: string; price: number; currency: string;
  description?: string; imageUrl?: string; imageUrls?: string[]; primaryImageUrl?: string;
  stockQty: number; status: 'draft' | 'active' | 'out_of_stock' | 'archived';
  category?: string;
}
interface TableRow {
  id: string; number: string; capacity: number;
  zone?: string; status?: 'available' | 'unavailable' | 'occupied' | 'reserved';
  notes?: string;
}
interface OrderItem { name: string; qty: number; lineTotal: number; productId?: string; unitPrice?: number; }
interface Order {
  id: string; orderNumber: string;
  customerName: string; customerPhone: string;
  total: number; currency: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  deliveryStatus: 'pending' | 'preparing' | 'shipped' | 'delivered';
  channel?: 'dine_in' | 'takeout' | 'delivery';
  tableId?: string | null;
  kdsStatus?: 'new' | 'preparing' | 'ready' | 'served';
  driverId?: string | null; driverName?: string | null;
  deliveryAddress?: string;
  items?: OrderItem[];
  createdAt?: { _seconds?: number } | string;
}
interface Reservation {
  id: string; customerName: string; customerPhone: string;
  date: string; time: string; partySize: number;
  notes?: string;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  tableId?: string;
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

type TabId = 'dashboard' | 'menu' | 'tables' | 'kds' | 'commandes' | 'reservations' | 'clients' | 'whatsapp';
type OrderChannel = 'dine_in' | 'takeout' | 'delivery';

const KDS_STAGES = ['new', 'preparing', 'ready', 'served'] as const;
type KdsStage = typeof KDS_STAGES[number];
const KDS_STAGE_CONFIG: Record<KdsStage, { label: string; color: string; icon: any }> = {
  new:       { label: 'Nouveau',     color: C.saffron,  icon: Tag },
  preparing: { label: 'En cuisine',  color: C.bordeaux, icon: Flame },
  ready:     { label: 'Prêt à servir', color: C.gold,   icon: BadgeCheck },
  served:    { label: 'Servi',       color: C.emerald,  icon: CheckCircle2 },
};

const TABLE_STATUS_CONFIG = {
  available:   { label: 'Libre',     color: C.emerald,    bg: C.emeraldSoft, ink: C.emeraldDark },
  occupied:    { label: 'Occupée',   color: C.bordeaux,   bg: C.bordeauxSoft, ink: C.bordeauxDeep },
  reserved:    { label: 'Réservée',  color: C.gold,       bg: C.goldSoft,    ink: C.goldDark },
  unavailable: { label: 'Indisponible', color: C.inkLight, bg: C.creamDeep,  ink: C.inkSoft },
};

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
    `linear-gradient(135deg, ${C.bordeaux} 0%, ${C.bordeauxDeep} 50%, ${C.bordeauxDark} 100%)`,
    `linear-gradient(135deg, ${C.saffron} 0%, ${C.saffronDeep} 50%, ${C.bordeauxDeep} 100%)`,
    `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDeep} 50%, ${C.goldDark} 100%)`,
    `linear-gradient(135deg, ${C.emeraldDeep} 0%, ${C.emeraldDark} 50%, #042F2E 100%)`,
    `linear-gradient(135deg, ${C.coralDeep} 0%, #BE123C 50%, #881337 100%)`,
    `linear-gradient(135deg, ${C.violet} 0%, ${C.violetDeep} 50%, #312E81 100%)`,
  ];
  let h = 0; for (let i = 0; i < id.length; i++) h = (h*31 + id.charCodeAt(i)) >>> 0;
  return g[h % g.length];
}
function colorVar(c: 'bordeaux' | 'saffron' | 'gold' | 'emerald' | 'coral' | 'violet' | 'cyan') {
  const map = {
    bordeaux: { main: C.bordeaux, deep: C.bordeauxDeep, soft: C.bordeauxSoft },
    saffron:  { main: C.saffron,  deep: C.saffronDeep,  soft: C.saffronSoft },
    gold:     { main: C.gold,     deep: C.goldDeep,     soft: C.goldSoft },
    emerald:  { main: C.emerald,  deep: C.emeraldDeep,  soft: C.emeraldSoft },
    coral:    { main: C.coral,    deep: C.coralDeep,    soft: C.coralSoft },
    violet:   { main: C.violet,   deep: C.violetDeep,   soft: C.violetSoft },
    cyan:     { main: C.cyan,     deep: C.cyanDeep,     soft: C.cyanSoft },
  };
  return map[c];
}

function orderChannel(o: Order): OrderChannel {
  if (o.channel) return o.channel;
  if (o.deliveryAddress) return 'delivery';
  if (o.tableId) return 'dine_in';
  return 'takeout';
}
function orderKdsStage(o: Order): KdsStage {
  if (o.kdsStatus) return o.kdsStatus;
  if (o.deliveryStatus === 'delivered') return 'served';
  if (o.deliveryStatus === 'shipped') return 'ready';
  if (o.deliveryStatus === 'preparing') return 'preparing';
  return 'new';
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

export default function RestaurantRedesignPage() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waMessages, setWaMessages] = useState<WaMessage[]>([]);
  const [waConnected, setWaConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableRow | null>(null);
  const [addReservationOpen, setAddReservationOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r1: any = await api.get('/commerce/stores', { params: { businessType: 'restaurant' } })
        .catch(() => ({ data: { stores: [] } }));
      const stores = (r1?.data?.stores ?? []) as Store[];
      const s = stores[0];
      if (!s) { setStore(null); setProducts([]); setTables([]); setOrders([]); setReservations([]); setWaMessages([]); return; }
      setStore(s);
      const [r2, r3, r4, r5, r6, r7] = await Promise.all([
        api.get(`/commerce/stores/${s.id}/products`).catch(() => ({ data: { products: [] } })),
        api.get(`/commerce/stores/${s.id}/tables`).catch(() => ({ data: { tables: [] } })),
        api.get(`/commerce/stores/${s.id}/orders`).catch(() => ({ data: { orders: [] } })),
        api.get(`/commerce/stores/${s.id}/reservations`).catch(() => ({ data: { reservations: [] } })),
        api.get('/whatsapp/messages').catch(() => ({ data: { data: [] } })),
        api.get('/whatsapp/status').catch(() => ({ data: { data: { connected: false } } })),
      ]);
      setProducts((r2 as any)?.data?.products ?? []);
      setTables((r3 as any)?.data?.tables ?? []);
      setOrders((r4 as any)?.data?.orders ?? []);
      setReservations((r5 as any)?.data?.reservations ?? []);
      const waData = (r6 as any)?.data?.data ?? (r6 as any)?.data?.messages ?? [];
      setWaMessages(Array.isArray(waData) ? waData : []);
      const waStatus = (r7 as any)?.data?.data ?? (r7 as any)?.data ?? {};
      setWaConnected(!!waStatus.connected);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const currency = store?.currency ?? 'XOF';
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const ordersToday = orders.filter(o => getTimestamp(o.createdAt) >= todayStart.getTime());
  const caToday = ordersToday.reduce((s, o) => s + (o.total || 0), 0);
  const activeKdsOrders = orders.filter(o => o.paymentStatus !== 'failed' && orderKdsStage(o) !== 'served');

  const customers = useMemo(() => deriveCustomers(orders), [orders]);
  const waThreads = useMemo(() => deriveWaThreads(waMessages), [waMessages]);

  if (loading && !store) {
    return (
      <div style={{ minHeight: '100vh', background: C.greenDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 size={32} className="spin" color={C.bordeaux} />
      </div>
    );
  }
  if (!store) return <RestaurantActivationScreen onCreated={() => fetchAll()} />;

  const counts: Record<TabId, number | null> = {
    dashboard: null,
    menu: products.length,
    tables: tables.length,
    kds: activeKdsOrders.length,
    commandes: orders.filter(o => orderKdsStage(o) !== 'served' && o.paymentStatus !== 'failed').length,
    reservations: reservations.filter(r => r.status !== 'cancelled' && r.date >= today).length,
    clients: customers.length,
    whatsapp: waThreads.filter(t => t.unread).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <HeroAdmin store={store}
          onAddProduct={() => setAddProductOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)} />
        <TabStrip activeTab={tab} setActiveTab={setTab} counts={counts} />

        {tab === 'dashboard' && (
          <DashboardTab orders={orders} ordersToday={ordersToday} caToday={caToday}
            currency={currency} tables={tables} activeKdsOrders={activeKdsOrders}
            threads={waThreads} onSelectTable={t => setEditingTable(t)}
            onSelectOrder={o => setEditingOrder(o)} />
        )}
        {tab === 'menu' && (
          <MenuTab products={products} currency={currency}
            onSelect={p => setEditingProduct(p)} onAdd={() => setAddProductOpen(true)} />
        )}
        {tab === 'tables' && (
          <TablesTab tables={tables} reservations={reservations} orders={orders}
            onSelect={t => setEditingTable(t)} onAdd={() => setAddTableOpen(true)} />
        )}
        {tab === 'kds' && (
          <KDSTab orders={activeKdsOrders} storeId={store.id} currency={currency}
            onChanged={() => fetchAll(true)} onSelectOrder={o => setEditingOrder(o)} />
        )}
        {tab === 'commandes' && (
          <CommandesTab orders={orders} tables={tables} currency={currency} storeId={store.id}
            onSelectOrder={o => setEditingOrder(o)} onChanged={() => fetchAll(true)} />
        )}
        {tab === 'reservations' && (
          <ReservationsTab reservations={reservations} tables={tables} storeId={store.id}
            onAdd={() => setAddReservationOpen(true)} onChanged={() => fetchAll(true)} />
        )}
        {tab === 'clients' && <ClientsTab customers={customers} />}
        {tab === 'whatsapp' && (
          <InboxTab
            accent={C.bordeaux} accentDeep={C.bordeauxDeep}
            ink={C.ink} inkSoft={C.inkSoft} inkLight={C.inkLight}
            cream={C.cream} creamDeep={C.creamDeep}
            emptyHint="Dès qu'un client écrit sur WhatsApp ou Telegram pour réserver/commander, ça apparaît ici."
          />
        )}
      </div>

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
      {addTableOpen && (
        <TableModal storeId={store.id}
          onClose={() => setAddTableOpen(false)}
          onSaved={() => { setAddTableOpen(false); fetchAll(true); }} />
      )}
      {editingTable && (
        <TableModal storeId={store.id} table={editingTable}
          onClose={() => setEditingTable(null)}
          onSaved={() => { setEditingTable(null); fetchAll(true); }}
          onDeleted={() => { setEditingTable(null); fetchAll(true); }} />
      )}
      {addReservationOpen && (
        <ReservationModal storeId={store.id} tables={tables}
          onClose={() => setAddReservationOpen(false)}
          onCreated={() => { setAddReservationOpen(false); fetchAll(true); }} />
      )}
      {editingOrder && (
        <OrderDetailModal order={editingOrder} tables={tables} storeId={store.id} currency={currency}
          onClose={() => setEditingOrder(null)}
          onChanged={() => { setEditingOrder(null); fetchAll(true); }} />
      )}
      {settingsOpen && (
        <StoreSettingsModal accentColor={C.bordeaux} accentDeep={C.bordeauxDeep}
          store={store}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => { setSettingsOpen(false); fetchAll(true); }} />
      )}

      <VoiceAssistantFAB
        accentColor={C.bordeaux} accentDeep={C.bordeauxDeep}
        label="Assistant Restaurant"
        systemInstruction={`Tu es l'assistant vocal du restaurant "${store.name}".

CONTEXTE actuel :
- ${products.length} plat${products.length > 1 ? 's' : ''} au menu
- ${tables.length} table${tables.length > 1 ? 's' : ''} dans la salle (${tables.filter(t => t.status === 'occupied').length} occupées)
- ${activeKdsOrders.length} commande${activeKdsOrders.length > 1 ? 's' : ''} en cuisine
- ${reservations.filter(r => r.date >= today && r.status !== 'cancelled').length} réservation${reservations.filter(r => r.date >= today).length > 1 ? 's' : ''} à venir

TON RÔLE : aider le gérant et les serveurs. Tu peux :
- Lire l'état du restaurant (combien de tables libres, commandes en cuisine, plats du menu).
- Proposer des actions (mais ne les exécute PAS sans confirmation explicite du gérant).
- Donner des conseils opérationnels brefs.

RÈGLES STRICTES :
- N'auto-confirme JAMAIS une réservation, commande ou changement de statut. Demande toujours validation orale.
- Reste concis. Réponses courtes orales, pas de pavés.
- Si tu ne sais pas, dis-le.`}
      />
    </div>
  );
}

interface Customer {
  phone: string; name: string; orders: number; totalSpent: number; lastAt: number;
  stage: 'new' | 'returning' | 'loyal' | 'vip' | 'lost';
}
function deriveCustomers(orders: Order[]): Customer[] {
  const byPhone = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.customerPhone) continue;
    const k = o.customerPhone.trim();
    const arr = byPhone.get(k) ?? [];
    arr.push(o); byPhone.set(k, arr);
  }
  const out: Customer[] = [];
  for (const [phone, list] of byPhone) {
    list.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
    const totalSpent = list.reduce((s, o) => s + (o.total || 0), 0);
    const stage: Customer['stage'] =
      totalSpent >= 500_000 ? 'vip' :
      list.length >= 5      ? 'loyal' :
      list.length >= 2      ? 'returning' :
      Date.now() - getTimestamp(list[0].createdAt) > 60 * 86_400_000 ? 'lost' : 'new';
    out.push({
      phone, name: list[0].customerName || phone,
      orders: list.length, totalSpent,
      lastAt: getTimestamp(list[0].createdAt),
      stage,
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

function HeroAdmin({ store, onAddProduct, onOpenSettings }: { store: Store; onAddProduct: () => void; onOpenSettings: () => void }) {
  const accent = resolveAccent(store as any, C.bordeaux);
  return (
    <div style={{
      position: 'relative',
      background: `linear-gradient(135deg, ${C.bordeauxDark} 0%, ${C.bordeauxDeep} 50%, ${accent} 100%)`,
      borderRadius: 22, padding: '24px 28px', overflow: 'hidden',
      border: `1px solid ${C.gold}40`, boxShadow: `0 20px 50px -20px ${accent}`,
    }}>
      <div className="grain"></div>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .4, pointerEvents: 'none' }}>
        {Array.from({ length: 25 }).map((_, i) => (
          <circle key={i} cx={`${(i*41)%100}%`} cy={`${(i*73)%100}%`}
            r={((i*7)%12)/8 + 0.4}
            fill={i%2 === 0 ? C.gold : C.saffronSoft}
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
          <ChefHat size={11} /> RESTAURANT · <span style={{ color: C.whatsappSoft }}>WHATSAPP</span>
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
              {store.name.split(' ').slice(1).join(' ') || 'Cuisine'}
            </em>
          </h1>
          {(store.tagline || store.shortDescription || store.logoUrl) ? (
            <StoreHeroBranding store={store as any} accent={C.goldRich} dark />
          ) : (
            <p style={{ fontSize: 14, color: 'rgba(255,250,240,.85)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Menu, salle, cuisine et livraison — pilotés depuis <strong style={{ color: C.whatsappSoft }}>WhatsApp</strong>.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={onAddProduct} className="btn-gold"><Plus size={14} /> Ajouter un plat</button>
          <button onClick={onOpenSettings} className="btn-ghost-light"><Settings size={13} /> Paramètres</button>
        </div>
      </div>
    </div>
  );
}

function TabStrip({ activeTab, setActiveTab, counts }: { activeTab: TabId; setActiveTab: (t: TabId) => void; counts: Record<TabId, number | null> }) {
  const tabs: Array<{ id: TabId; label: string; icon: any; highlight?: boolean }> = [
    { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { id: 'menu',         label: 'Menu',         icon: UtensilsCrossed },
    { id: 'tables',       label: 'Tables',       icon: Armchair },
    { id: 'kds',          label: 'KDS Cuisine',  icon: Flame },
    { id: 'commandes',    label: 'Commandes',    icon: ShoppingBag },
    { id: 'reservations', label: 'Réservations', icon: BadgeCheck },
    { id: 'clients',      label: 'Clients',      icon: Users },
    { id: 'whatsapp',     label: 'Inbox',        icon: MessageCircle, highlight: true },
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
            background: active ? `linear-gradient(135deg, ${C.bordeaux}, ${C.bordeauxDeep})` : 'transparent',
            color: active ? C.cream : C.inkSoft,
            padding: '10px 16px', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            boxShadow: active ? `0 6px 14px -4px ${C.bordeaux}` : 'none',
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
  orders: Order[]; ordersToday: Order[]; caToday: number;
  currency: string; tables: TableRow[]; activeKdsOrders: Order[];
  threads: WaThread[];
  onSelectTable: (t: TableRow) => void;
  onSelectOrder: (o: Order) => void;
}) {
  const { orders, ordersToday, caToday, currency, tables, activeKdsOrders, threads, onSelectTable, onSelectOrder } = props;
  const tablesOccupied = tables.filter(t => t.status === 'occupied').length;
  const tablesFree = tables.filter(t => t.status === 'available' || !t.status).length;

  const kpis: Array<{ id: string; label: string; value: string; unit?: string; sub: string; icon: any; color: 'bordeaux' | 'saffron' | 'gold' | 'emerald' }> = [
    { id: 'ca', label: 'CA du jour', value: formatShort(caToday), unit: currency,
      sub: `${ordersToday.length} commandes`, icon: Banknote, color: 'emerald' },
    { id: 'kds', label: 'Cuisine active', value: String(activeKdsOrders.length),
      sub: `${activeKdsOrders.filter(o => orderKdsStage(o) === 'preparing').length} en prépa`, icon: Flame, color: 'bordeaux' },
    { id: 'tables', label: 'Tables', value: `${tablesOccupied}/${tables.length}`,
      sub: `${tablesFree} libres`, icon: Armchair, color: 'saffron' },
    { id: 'orders', label: 'Total commandes', value: String(orders.length),
      sub: `${ordersToday.length} aujourd'hui`, icon: ShoppingBag, color: 'gold' },
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

      <div className="map-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FloorPlanPanel tables={tables} onSelectTable={onSelectTable} />
        <KDSPreviewPanel orders={activeKdsOrders} onSelectOrder={onSelectOrder} currency={currency} />
      </div>

      <WhatsAppLeadsPanel threads={threads} />
    </div>
  );
}

function FloorPlanPanel({ tables, onSelectTable }: { tables: TableRow[]; onSelectTable: (t: TableRow) => void }) {
  const byZone = useMemo(() => {
    const m = new Map<string, TableRow[]>();
    for (const t of tables) {
      const z = t.zone || 'salle';
      const arr = m.get(z) ?? [];
      arr.push(t); m.set(z, arr);
    }
    return Array.from(m.entries());
  }, [tables]);
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.bordeauxDark}, ${C.bordeauxDeep})`,
      borderRadius: 18, border: `1px solid ${C.gold}30`,
      overflow: 'hidden', position: 'relative',
      minHeight: 380, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 18px', background: 'rgba(0,0,0,.25)', borderBottom: `1px solid ${C.gold}20`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Armchair size={14} color={C.gold} />
        <span className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: '.12em', flex: 1 }}>
          PLAN DE SALLE · {tables.length} TABLE{tables.length > 1 ? 'S' : ''}
        </span>
        <span className="pill" style={{ background: `${C.emerald}25`, color: C.emerald, border: `1px solid ${C.emerald}50`, fontSize: 9, fontWeight: 800 }}>
          <span className="live-dot" style={{ width: 6, height: 6, color: C.emerald }}></span>
          LIVE
        </span>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {tables.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,250,240,.6)' }}>
            <Armchair size={36} color={C.gold} style={{ marginBottom: 10, opacity: .7 }} />
            <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 4 }}>
              Pas encore de table
            </div>
            <div style={{ fontSize: 11 }}>Configure ton plan de salle dans l'onglet Tables.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {byZone.map(([zone, list]) => (
              <div key={zone}>
                <div className="mono-font" style={{ fontSize: 9, fontWeight: 800, color: C.gold, letterSpacing: '.08em', marginBottom: 6, textTransform: 'uppercase' }}>
                  {zone}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
                  {list.map(t => {
                    const cfg = TABLE_STATUS_CONFIG[(t.status as keyof typeof TABLE_STATUS_CONFIG) ?? 'available'];
                    return (
                      <button key={t.id} onClick={() => onSelectTable(t)} style={{
                        padding: '8px 4px', borderRadius: 8,
                        background: `${cfg.color}20`,
                        border: `1px solid ${cfg.color}50`,
                        color: cfg.color === C.emerald ? C.emerald : (cfg.color === C.bordeaux ? '#FECACA' : (cfg.color === C.gold ? C.gold : '#FCA5A5')),
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      }}>
                        <div className="mono-font" style={{ fontSize: 12, fontWeight: 800 }}>T{t.number}</div>
                        <div style={{ fontSize: 8, opacity: .85 }}>{t.capacity} pers</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {tables.length > 0 && (
        <div style={{ padding: '8px 14px', background: 'rgba(0,0,0,.35)', borderTop: `1px solid ${C.gold}20`, display: 'flex', gap: 10, fontSize: 10, color: 'rgba(255,250,240,.85)', flexWrap: 'wrap' }}>
          {(['available','occupied','reserved','unavailable'] as const).map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: TABLE_STATUS_CONFIG[s].color }}></span>
              {TABLE_STATUS_CONFIG[s].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function KDSPreviewPanel({ orders, onSelectOrder, currency }: { orders: Order[]; onSelectOrder: (o: Order) => void; currency: string }) {
  const recent = orders.slice(0, 6);
  return (
    <div style={{
      background: C.cream, borderRadius: 18, overflow: 'hidden',
      border: '1px solid rgba(28,20,16,.06)',
      minHeight: 380, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 18px', background: `linear-gradient(135deg, ${C.saffron}, ${C.saffronDeep})`, color: C.cream, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Flame size={16} />
        <div style={{ flex: 1 }}>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', opacity: .9 }}>
            KDS · CUISINE
          </div>
          <div className="display-font" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em' }}>
            {orders.length} commande{orders.length > 1 ? 's' : ''} active{orders.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {recent.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: C.inkSoft }}>
            <Flame size={36} color={C.inkLight} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Cuisine au repos</div>
            <div style={{ fontSize: 11 }}>Aucune commande en cours.</div>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map(o => {
              const stage = orderKdsStage(o);
              const cfg = KDS_STAGE_CONFIG[stage];
              const Icon = cfg.icon;
              return (
                <div key={o.id} onClick={() => onSelectOrder(o)} className="card-lift" style={{
                  background: C.creamDeep, borderRadius: 11, padding: 10,
                  border: '1px solid rgba(28,20,16,.06)',
                  borderLeft: `3px solid ${cfg.color}`,
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${cfg.color}20`, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className="mono-font">{o.orderNumber || `#${o.id.slice(-4)}`}</span>
                      <span className="pill" style={{ background: `${cfg.color}15`, color: cfg.color, fontSize: 9, fontWeight: 800 }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.inkSoft }}>
                      {o.items?.length ?? 0} article{(o.items?.length ?? 0) > 1 ? 's' : ''} · {timeAgo(getTimestamp(o.createdAt))}
                    </div>
                  </div>
                  <div className="mono-font" style={{ fontSize: 12, fontWeight: 800, color: C.bordeauxDeep }}>
                    {formatShort(o.total)} <span style={{ fontSize: 9, opacity: .7 }}>{currency}</span>
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

function MenuTab({ products, currency, onSelect, onAdd }: { products: Product[]; currency: string; onSelect: (p: Product) => void; onAdd: () => void }) {
  const categories = useMemo(() => {
    const s = new Set<string>();
    products.forEach(p => { if (p.category) s.add(p.category); });
    return Array.from(s).sort();
  }, [products]);
  const [cat, setCat] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');
  const filtered = products.filter(p => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [p.name, p.description, p.category].filter(Boolean).join(' ').toLowerCase();
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom du plat, description, catégorie…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: C.ink, fontFamily: 'inherit', minWidth: 0 }} />
          </div>
          <button onClick={onAdd} className="btn-primary"><Plus size={13} /> Ajouter un plat</button>
        </div>
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setCat('all')} style={pillStyle(cat === 'all', C.bordeaux)}>
              Tous {countPill(cat === 'all', products.length)}
            </button>
            {categories.map(c => (
              <button key={c} onClick={() => setCat(c)} style={pillStyle(cat === c, C.saffron)}>
                {c} {countPill(cat === c, products.filter(p => p.category === c).length)}
              </button>
            ))}
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="Pas encore de plat"
          desc="Ajoute tes plats (photo, prix, catégorie). Tes clients pourront commander via WhatsApp."
          cta="Ajouter mon 1er plat" onAction={onAdd} />
      ) : (
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {filtered.map(p => <DishCard key={p.id} product={p} currency={currency} onClick={() => onSelect(p)} />)}
        </div>
      )}
    </div>
  );
}

function DishCard({ product, currency, onClick }: { product: Product; currency: string; onClick: () => void }) {
  const image = product.primaryImageUrl || product.imageUrl || (Array.isArray(product.imageUrls) ? product.imageUrls[0] : undefined);
  return (
    <div onClick={onClick} className="card-lift" style={{
      background: C.cream, borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(28,20,16,.06)', cursor: 'pointer',
    }}>
      <div style={{ height: 160, position: 'relative', overflow: 'hidden', background: image ? '#000' : gradientFor(product.id) }}>
        {image ? (
          <img src={image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,250,240,.4)' }}>
            <UtensilsCrossed size={70} strokeWidth={1} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {product.status !== 'active' && (
            <span className="pill" style={{ background: 'rgba(255,250,240,.95)', color: C.inkSoft, fontWeight: 800, fontSize: 10, backdropFilter: 'blur(20px)' }}>
              {product.status === 'draft' ? 'Brouillon' : product.status === 'out_of_stock' ? 'Indispo' : 'Archivé'}
            </span>
          )}
          {product.category && (
            <span className="pill" style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.cream, fontWeight: 800, fontSize: 10 }}>
              {product.category}
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
          {product.name}
        </h3>
        {product.description && (
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '4px 0 10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {product.description}
          </p>
        )}
        <div className="display-font mono-font" style={{ fontSize: 18, fontWeight: 800, color: C.bordeauxDeep }}>
          {formatShort(product.price || 0)}
          <span style={{ fontSize: 9, color: C.inkLight, fontWeight: 700, marginLeft: 4 }}>{(product.currency || currency).toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

function TablesTab({ tables, reservations, orders, onSelect, onAdd }: {
  tables: TableRow[]; reservations: Reservation[]; orders: Order[]; onSelect: (t: TableRow) => void; onAdd: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const reservationsForTable = (tableId: string) => reservations.filter(r => r.tableId === tableId && r.date >= today && r.status !== 'cancelled');
  const orderForTable = (tableId: string) => orders.find(o => o.tableId === tableId && orderKdsStage(o) !== 'served' && o.paymentStatus !== 'failed');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(28,20,16,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="pill" style={{ background: C.bordeauxSoft, color: C.bordeauxDeep, fontSize: 10, marginBottom: 4 }}>
            <Armchair size={11} /> PLAN DE SALLE · {tables.length} TABLE{tables.length > 1 ? 'S' : ''}
          </div>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
            Tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.bordeauxDeep }}>tables</em>
          </h3>
        </div>
        <button onClick={onAdd} className="btn-primary"><Plus size={13} /> Ajouter une table</button>
      </div>

      {tables.length === 0 ? (
        <EmptyState icon={Armchair} title="Pas encore de table"
          desc="Configure ton plan de salle (numéro, capacité, zone)."
          cta="Ajouter ma 1re table" onAction={onAdd} />
      ) : (
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {tables.map(t => {
            const cfg = TABLE_STATUS_CONFIG[(t.status as keyof typeof TABLE_STATUS_CONFIG) ?? 'available'];
            const upcomingReservations = reservationsForTable(t.id);
            const activeOrder = orderForTable(t.id);
            return (
              <div key={t.id} onClick={() => onSelect(t)} className="card-lift" style={{
                background: C.cream, borderRadius: 16, padding: 16,
                border: `1.5px solid ${cfg.color}40`,
                cursor: 'pointer',
                borderLeft: `4px solid ${cfg.color}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
                    T{t.number}
                  </div>
                  <span className="pill" style={{ background: cfg.bg, color: cfg.ink, fontSize: 9, fontWeight: 800 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, display: 'inline-block' }}></span>
                    {cfg.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 8 }}>
                  <Users size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t.capacity} pers
                  {t.zone && <> · {t.zone}</>}
                </div>
                {activeOrder && (
                  <div className="pill" style={{ background: C.bordeauxSoft, color: C.bordeauxDeep, fontSize: 9, fontWeight: 700, marginBottom: 4 }}>
                    <ShoppingBag size={9} /> Commande active
                  </div>
                )}
                {upcomingReservations.length > 0 && (
                  <div className="pill" style={{ background: C.goldSoft, color: C.goldDark, fontSize: 9, fontWeight: 700 }}>
                    <BadgeCheck size={9} /> {upcomingReservations.length} résa
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KDSTab({ orders, storeId, currency, onChanged, onSelectOrder }: {
  orders: Order[]; storeId: string; currency: string;
  onChanged: () => void; onSelectOrder: (o: Order) => void;
}) {
  const advanceStage = async (order: Order, target: KdsStage) => {
    try {
      const updates: any = { kdsStatus: target };
      if (target === 'preparing') updates.deliveryStatus = 'preparing';
      else if (target === 'ready') updates.deliveryStatus = 'shipped';
      else if (target === 'served') updates.deliveryStatus = 'delivered';
      await api.patch(`/commerce/stores/${storeId}/orders/${order.id}`, updates);
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(28,20,16,.06)' }}>
        <div className="pill" style={{ background: C.saffronSoft, color: C.saffronDeep, fontSize: 10, marginBottom: 4 }}>
          <Flame size={11} /> KDS · {orders.length} COMMANDE{orders.length > 1 ? 'S' : ''} EN CUISINE
        </div>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
          Kitchen <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.bordeauxDeep }}>Display</em>
        </h3>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={Flame} title="Cuisine au repos"
          desc="Aucune commande en cours. Dès qu'une commande arrive, elle s'affiche ici." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, overflowX: 'auto' }} className="scroll-thin responsive-grid-4">
          {KDS_STAGES.map(stage => {
            const cfg = KDS_STAGE_CONFIG[stage];
            const Icon = cfg.icon;
            const list = orders.filter(o => orderKdsStage(o) === stage);
            const nextStage = KDS_STAGES[Math.min(KDS_STAGES.indexOf(stage) + 1, KDS_STAGES.length - 1)];
            return (
              <div key={stage} style={{
                background: C.cream, borderRadius: 14, padding: 12,
                border: '1px solid rgba(28,20,16,.06)',
                borderTop: `3px solid ${cfg.color}`,
                minWidth: 240,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.creamDeep}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${cfg.color}15`, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} />
                  </div>
                  <div className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink, flex: 1 }}>{cfg.label}</div>
                  <span className="mono-font" style={{ background: `${cfg.color}15`, color: cfg.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{list.length}</span>
                </div>
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 16, fontSize: 11, color: C.inkLight, fontStyle: 'italic' }}>—</div>
                  ) : list.map(o => (
                    <div key={o.id} onClick={() => onSelectOrder(o)} className="card-lift" style={{
                      background: C.creamDeep, borderRadius: 10, padding: 10,
                      border: '1px solid rgba(28,20,16,.04)', cursor: 'pointer',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <div className="mono-font" style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>{o.orderNumber || `#${o.id.slice(-4)}`}</div>
                          <div style={{ fontSize: 10, color: C.inkSoft }}>{o.customerName}</div>
                        </div>
                        <span className="mono-font" style={{ fontSize: 9, color: C.inkLight }}>{timeAgo(getTimestamp(o.createdAt))}</span>
                      </div>
                      {o.items && o.items.length > 0 && (
                        <ul style={{ margin: '6px 0 8px', padding: 0, listStyle: 'none' }}>
                          {o.items.slice(0, 4).map((it, i) => (
                            <li key={i} style={{ fontSize: 11, color: C.ink, padding: '2px 0' }}>
                              <span className="mono-font" style={{ fontWeight: 700, color: C.bordeauxDeep }}>{it.qty}×</span> {it.name}
                            </li>
                          ))}
                          {o.items.length > 4 && (
                            <li style={{ fontSize: 10, color: C.inkLight, fontStyle: 'italic' }}>+{o.items.length - 4} autres</li>
                          )}
                        </ul>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <span className="mono-font" style={{ fontSize: 11, fontWeight: 800, color: C.bordeauxDeep }}>
                          {formatShort(o.total)} {currency}
                        </span>
                        {stage !== 'served' && (
                          <button onClick={(e) => { e.stopPropagation(); advanceStage(o, nextStage); }}
                            style={{
                              background: cfg.color, color: C.cream, border: 'none',
                              padding: '4px 10px', borderRadius: 6,
                              fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                            → {KDS_STAGE_CONFIG[nextStage].label}
                          </button>
                        )}
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

function CommandesTab({ orders, tables, currency, storeId, onSelectOrder, onChanged }: {
  orders: Order[]; tables: TableRow[]; currency: string; storeId: string;
  onSelectOrder: (o: Order) => void; onChanged: () => void;
}) {
  const [channel, setChannel] = useState<'all' | OrderChannel>('all');
  const filtered = orders.filter(o => channel === 'all' || orderChannel(o) === channel);
  const countByChannel = (c: OrderChannel) => orders.filter(o => orderChannel(o) === c && orderKdsStage(o) !== 'served' && o.paymentStatus !== 'failed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(28,20,16,.06)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {([
          { id: 'all' as const,       label: 'Toutes',    color: C.bordeaux, icon: ShoppingBag, count: orders.length },
          { id: 'dine_in' as const,   label: 'Salle',     color: C.saffron,  icon: Armchair,    count: countByChannel('dine_in') },
          { id: 'takeout' as const,   label: 'À emporter', color: C.gold,    icon: ShoppingBag, count: countByChannel('takeout') },
          { id: 'delivery' as const,  label: 'Livraison', color: C.cyan,     icon: Truck,       count: countByChannel('delivery') },
        ]).map(f => {
          const Icon = f.icon;
          const active = channel === f.id;
          return (
            <button key={f.id} onClick={() => setChannel(f.id)} style={{
              background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'transparent',
              color: active ? C.cream : C.inkSoft,
              padding: '8px 14px', borderRadius: 100,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(28,20,16,.1)',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Icon size={12} /> {f.label}
              <span className="mono-font" style={{
                background: active ? 'rgba(255,250,240,.25)' : C.creamDeep,
                color: active ? C.cream : C.inkSoft,
                padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800,
              }}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Aucune commande" desc="Les commandes (WhatsApp + site) s'affichent ici." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Aucune commande pour ce canal" desc="Change de filtre." />
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(o => <OrderRow key={o.id} order={o} tables={tables} currency={currency}
            onClick={() => onSelectOrder(o)} storeId={storeId} onChanged={onChanged} />)}
        </div>
      )}
    </div>
  );
}

function OrderRow({ order, tables, currency, onClick, storeId, onChanged }: {
  order: Order; tables: TableRow[]; currency: string;
  onClick: () => void; storeId: string; onChanged: () => void;
}) {
  const stage = orderKdsStage(order);
  const cfg = KDS_STAGE_CONFIG[stage];
  const Icon = cfg.icon;
  const table = tables.find(t => t.id === order.tableId);
  const ch = orderChannel(order);
  const channelLabel = ch === 'dine_in' ? `Salle${table ? ` · T${table.number}` : ''}` : ch === 'takeout' ? 'À emporter' : 'Livraison';

  const advanceStage = async (target: KdsStage) => {
    try {
      const updates: any = { kdsStatus: target };
      if (target === 'preparing') updates.deliveryStatus = 'preparing';
      else if (target === 'ready') updates.deliveryStatus = 'shipped';
      else if (target === 'served') updates.deliveryStatus = 'delivered';
      await api.patch(`/commerce/stores/${storeId}/orders/${order.id}`, updates);
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };

  return (
    <div onClick={onClick} className="card-lift" style={{
      background: C.cream, borderRadius: 12, padding: 14,
      border: '1px solid rgba(28,20,16,.06)',
      borderLeft: `4px solid ${cfg.color}`,
      display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
    }}>
      <div style={{
        width: 50, height: 50, borderRadius: 11,
        background: `${cfg.color}15`, color: cfg.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <span className="display-font mono-font" style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>
            {order.orderNumber || `#${order.id.slice(-4)}`}
          </span>
          <span className="pill" style={{ background: `${cfg.color}15`, color: cfg.color, fontSize: 9, fontWeight: 800 }}>{cfg.label}</span>
          <span className="pill" style={{ background: C.creamDeep, color: C.inkSoft, fontSize: 9, fontWeight: 700 }}>{channelLabel}</span>
          {order.paymentStatus === 'paid' && <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDark, fontSize: 9, fontWeight: 700 }}>✓ Payée</span>}
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{order.customerName} · <span className="mono-font">{order.customerPhone}</span></span>
          <WhatsAppQuickButton phone={order.customerPhone} prefill={`Bonjour ${order.customerName ?? ''}, à propos de votre commande…`} />
        </div>
        <div style={{ fontSize: 10, color: C.inkLight, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span>{(order.items?.length ?? 0)} article{(order.items?.length ?? 0) > 1 ? 's' : ''}</span>
          {order.deliveryAddress && (<><span>·</span><span>📍 {order.deliveryAddress}</span></>)}
          {order.driverName && (<><span>·</span><span>🛵 {order.driverName}</span></>)}
          <span>·</span><span className="mono-font">{timeAgo(getTimestamp(order.createdAt))}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="display-font mono-font" style={{ fontSize: 17, fontWeight: 800, color: C.bordeauxDeep }}>
          {formatShort(order.total)}
        </div>
        <div style={{ fontSize: 9, color: C.inkLight, fontWeight: 700 }}>{(order.currency || currency).toUpperCase()}</div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {stage === 'new' && <button onClick={() => advanceStage('preparing')} className="icon-btn" style={{ background: C.bordeauxSoft, color: C.bordeauxDeep }} title="En cuisine"><Flame size={14} /></button>}
        {stage === 'preparing' && <button onClick={() => advanceStage('ready')} className="icon-btn gold" title="Prêt"><BadgeCheck size={14} /></button>}
        {stage === 'ready' && <button onClick={() => advanceStage('served')} className="icon-btn emerald" title="Servi"><CheckCircle2 size={14} /></button>}
        {order.customerPhone && (
          <a href={`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            className="icon-btn" style={{ background: C.whatsappSoft, color: C.whatsappDark, textDecoration: 'none' }}>
            <MessageCircle size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

function ReservationsTab({ reservations, tables, storeId, onAdd, onChanged }: {
  reservations: Reservation[]; tables: TableRow[]; storeId: string;
  onAdd: () => void; onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState<'upcoming' | 'today' | 'past' | 'all'>('upcoming');
  const filtered = reservations.filter(r => {
    if (filter === 'today') return r.date === today;
    if (filter === 'upcoming') return r.date >= today && r.status !== 'cancelled';
    if (filter === 'past') return r.date < today;
    return true;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const setStatus = async (id: string, status: Reservation['status']) => {
    try {
      await api.patch(`/commerce/stores/${storeId}/reservations/${id}`, { status });
      toast.success('Réservation mise à jour');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };
  const remove = async (id: string) => {
    if (!confirm('Supprimer cette réservation ?')) return;
    try {
      await api.delete(`/commerce/stores/${storeId}/reservations/${id}`);
      toast.success('Réservation supprimée');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(28,20,16,.06)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {([
          { id: 'upcoming' as const, label: 'À venir' },
          { id: 'today' as const,    label: "Aujourd'hui" },
          { id: 'past' as const,     label: 'Passées' },
          { id: 'all' as const,      label: 'Toutes' },
        ]).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={pillStyle(filter === f.id, C.bordeaux)}>{f.label}</button>
        ))}
        <button onClick={onAdd} className="btn-primary" style={{ marginLeft: 'auto' }}>
          <Plus size={13} /> Nouvelle réservation
        </button>
      </div>

      {reservations.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="Aucune réservation"
          desc="Les clients peuvent réserver une table via WhatsApp ou tu peux les créer ici."
          cta="Planifier une réservation" onAction={onAdd} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="Aucune réservation pour ce filtre" desc="Change de filtre." />
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(r => (
            <ReservationCard key={r.id} reservation={r} tables={tables}
              onConfirm={() => setStatus(r.id, 'confirmed')}
              onSeated={() => setStatus(r.id, 'seated')}
              onCancel={() => setStatus(r.id, 'cancelled')}
              onRemove={() => remove(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReservationCard({ reservation, tables, onConfirm, onSeated, onCancel, onRemove }: {
  reservation: Reservation; tables: TableRow[];
  onConfirm: () => void; onSeated: () => void; onCancel: () => void; onRemove: () => void;
}) {
  const table = tables.find(t => t.id === reservation.tableId);
  const confirmed = reservation.status === 'confirmed';
  const seated = reservation.status === 'seated';
  const accent = seated ? C.blueDeep : confirmed ? C.emerald : C.gold;

  return (
    <div className="card-lift" style={{
      background: C.cream, borderRadius: 12, padding: 14,
      border: '1px solid rgba(28,20,16,.06)',
      borderLeft: `4px solid ${accent}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ width: 64, padding: 8, borderRadius: 10, background: `${accent}10`, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: accent, fontWeight: 700, textTransform: 'uppercase' }}>
          {new Date(reservation.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
        </div>
        <div className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
          {new Date(reservation.date).getDate()}
        </div>
        <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700 }}>
          {new Date(reservation.date).toLocaleDateString('fr-FR', { month: 'short' })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{reservation.customerName}</span>
          <ReservationStatusPill status={reservation.status} />
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft }}>
          <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {reservation.time} ·
          {' '}{reservation.partySize} pers
          {table ? <> · <strong style={{ color: C.bordeauxDeep }}>Table T{table.number}</strong></> : ' · Sans table'}
        </div>
        <div style={{ fontSize: 10, color: C.inkLight, fontFamily: 'JetBrains Mono', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Phone size={9} style={{ display: 'inline' }} /> {reservation.customerPhone}
          <WhatsAppQuickButton phone={reservation.customerPhone} prefill={`Bonjour ${reservation.customerName ?? ''}, à propos de votre réservation…`} />
        </div>
        {reservation.notes && (
          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4, fontStyle: 'italic' }}>📝 {reservation.notes}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {reservation.status === 'pending' && (
          <button onClick={onConfirm} className="icon-btn emerald" title="Confirmer"><CheckCircle2 size={14} /></button>
        )}
        {reservation.status === 'confirmed' && (
          <button onClick={onSeated} className="icon-btn" style={{ background: C.blueSoft, color: C.blueDeep }} title="Installer"><BadgeCheck size={14} /></button>
        )}
        <a href={`https://wa.me/${reservation.customerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
          className="icon-btn" style={{ background: C.whatsappSoft, color: C.whatsappDark, textDecoration: 'none' }}>
          <MessageCircle size={14} />
        </a>
        {reservation.status !== 'cancelled' && (
          <button onClick={onCancel} className="icon-btn ghost"><X size={14} /></button>
        )}
        <button onClick={onRemove} className="icon-btn ghost" style={{ color: C.red }}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function ReservationStatusPill({ status }: { status: Reservation['status'] }) {
  const c: Record<Reservation['status'], [string, string, string]> = {
    pending:   [C.yellowSoft, '#92400E',    '⏳ En attente'],
    confirmed: [C.emeraldSoft, C.emeraldDark, '✓ Confirmée'],
    seated:    [C.blueSoft, C.blueDeep,     '🍴 Installée'],
    cancelled: [C.redSoft, C.red,           '✗ Annulée'],
    no_show:   ['#FCE7F3', '#9D174D',       '👻 No show'],
  };
  const [bg, fg, txt] = c[status] ?? c.pending;
  return <span className="pill" style={{ background: bg, color: fg, fontSize: 9, fontWeight: 800 }}>{txt}</span>;
}

function ClientsTab({ customers }: { customers: Customer[] }) {
  const stages: Array<{ id: Customer['stage']; label: string; color: string; icon: any }> = [
    { id: 'new',       label: 'Nouveaux',     color: C.cyan,     icon: Sparkles },
    { id: 'returning', label: 'Récurrents',   color: C.bordeaux, icon: RefreshCcw },
    { id: 'loyal',     label: 'Fidèles (5+)', color: C.gold,     icon: Star },
    { id: 'vip',       label: 'VIP (500k+)',  color: C.violet,   icon: Trophy },
    { id: 'lost',      label: 'Perdus (60j+)', color: C.inkSoft, icon: X },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(28,20,16,.06)' }}>
        <div className="pill" style={{ background: C.bordeauxSoft, color: C.bordeauxDeep, fontSize: 10, marginBottom: 4 }}>
          <Users size={11} /> PIPELINE · {customers.length} CLIENT{customers.length > 1 ? 'S' : ''}
        </div>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
          Pipeline <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.bordeauxDeep }}>commercial</em>
        </h3>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={Users} title="Pas encore de client" desc="Tes clients apparaissent dès la 1re commande." />
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
                    <div key={c.phone} style={{ background: C.creamDeep, borderRadius: 10, padding: 10, border: '1px solid rgba(28,20,16,.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${stage.color}, ${stage.color}cc)`, color: C.cream, fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>
                          {initials(c.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 9, color: C.inkLight, fontFamily: 'JetBrains Mono' }}>{timeAgo(c.lastAt)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.inkSoft, marginBottom: 6 }}>
                        <span>{c.orders} cmd{c.orders > 1 ? 's' : ''}</span>
                        <span className="mono-font" style={{ fontWeight: 700, color: C.bordeauxDeep }}>{formatShort(c.totalSpent)}</span>
                      </div>
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
          Messages <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.whatsappDark }}>du restaurant</em>
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
          {threads.length} conversation{threads.length > 1 ? 's' : ''}. Paramètres globaux dans <a href="/admin/whatsapp" style={{ color: C.bordeauxDeep, fontWeight: 600, textDecoration: 'none' }}>Admin · WhatsApp</a>.
        </p>
      </div>

      {threads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 14, border: '1px dashed rgba(28,20,16,.15)' }}>
          <MessageCircle size={48} color={C.whatsapp} style={{ marginBottom: 12, opacity: .7 }} />
          <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>
            {connected ? 'Pas encore de message' : 'WhatsApp non connecté'}
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px' }}>
            {connected ? "Dès qu'un client t'écrit, sa conversation apparaît ici." : "Connecte WhatsApp Business pour recevoir les messages."}
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
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`, color: C.cream, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>
                    {initials(t.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      <span className="mono-font" style={{ fontSize: 9, color: C.inkLight, flexShrink: 0 }}>{timeAgo(t.lastAt)}</span>
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
      <Icon size={48} color={C.bordeaux} style={{ marginBottom: 12, opacity: .7 }} />
      <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>{title}</h3>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>{desc}</p>
      {cta && onAction && (<button onClick={onAction} className="btn-primary"><Plus size={14} /> {cta}</button>)}
    </div>
  );
}

function RestaurantActivationScreen({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('Paiement Wave, espèces ou carte sur place.');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim().length >= 2 && ownerPhone.length >= 6 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/commerce/stores', {
        name: name.trim(), ownerPhone: ownerPhone.trim(),
        paymentInstructions: paymentInstructions.trim(),
        businessType: 'restaurant',
      });
      toast.success('Restaurant activé', `${name.trim()} est en ligne.`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Activation impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{STYLES}</style>
      <div style={{ background: C.cream, borderRadius: 22, maxWidth: 520, width: '100%', boxShadow: '0 24px 60px -16px rgba(28,20,16,.18)', overflow: 'hidden' }}>
        <div style={{ background: `linear-gradient(135deg, ${C.bordeaux}, ${C.bordeauxDeep})`, color: '#fff', padding: '36px 32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div className="grain"></div>
          <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
            <ChefHat size={28} color="#fff" />
          </div>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            Active ton <em style={{ fontStyle: 'italic', fontWeight: 500 }}>restaurant</em>
          </h1>
          <p style={{ fontSize: 13, opacity: .92, marginTop: 8 }}>Menu · Salle · Cuisine · Livraison</p>
        </div>
        <div style={{ padding: '26px 32px 30px' }}>
          <div style={{ marginBottom: 14 }}>
            <Label>Nom du restaurant</Label>
            <Input value={name} onChange={setName} placeholder="Nom du restaurant" autoFocus />
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
              {submitting ? <><Loader2 size={14} className="spin" /> Activation…</> : <><ChefHat size={14} /> Activer mon restaurant</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductModal({ storeId, currency, product, onClose, onSaved, onDeleted }: {
  storeId: string; currency: string; product?: Product;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState<number | ''>(product?.price ?? '');
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
    const payload = {
      name: name.trim(), price,
      category: category.trim(),
      description: description.trim(),
      stockQty: 999, status,
      ...(imageBase64 ? { imageBase64, imageMimeType } : {}),
    };
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/products/${product!.id}`, payload);
        toast.success('Plat mis à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/products`, payload);
        toast.success('Plat ajouté');
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/products/${product!.id}`);
      toast.success('Plat supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={isEdit ? 'Modifier le plat' : 'Nouveau plat'} color={C.bordeauxDeep} onClose={onClose}>
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
            style={{ width: '100%', padding: '20px 14px', borderRadius: 12, background: C.creamDeep, color: C.bordeauxDeep, border: `1.5px dashed ${C.bordeaux}`, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Camera size={22} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Choisir une photo</span>
          </button>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <Label>Nom du plat</Label>
        <Input value={name} onChange={setName} placeholder="Nom du plat…" autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Prix ({currency})</Label><Input type="number" value={String(price ?? '')} onChange={v => setPrice(v === '' ? '' : parseInt(v))} placeholder="3500" mono /></div>
        <div><Label>Catégorie</Label><Input value={category} onChange={setCategory} placeholder="Entrée, Plat, Dessert, Boisson…" /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Description</Label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Ingrédients principaux, accompagnement, niveau de piment…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      {isEdit && (
        <div style={{ marginBottom: 18 }}>
          <Label>Statut</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['active', 'draft', 'out_of_stock', 'archived'] as const).map(s => {
              const sel = status === s;
              const col = s === 'active' ? C.emeraldDeep : s === 'draft' ? C.inkSoft : s === 'out_of_stock' ? C.red : C.ink;
              const label = s === 'active' ? 'Actif' : s === 'draft' ? 'Brouillon' : s === 'out_of_stock' ? 'Rupture' : 'Archivé';
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

function TableModal({ storeId, table, onClose, onSaved, onDeleted }: {
  storeId: string; table?: TableRow;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!table;
  const [number, setNumber] = useState(table?.number ?? '');
  const [capacity, setCapacity] = useState<number | ''>(table?.capacity ?? 2);
  const [zone, setZone] = useState(table?.zone ?? 'salle');
  const [status, setStatus] = useState<NonNullable<TableRow['status']>>((table?.status as any) ?? 'available');
  const [notes, setNotes] = useState(table?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = number.trim().length >= 1 && typeof capacity === 'number' && capacity > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/tables/${table!.id}`, { number: number.trim(), capacity, zone: zone.trim(), status, notes: notes.trim() });
        toast.success('Table mise à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/tables`, { number: number.trim(), capacity, zone: zone.trim(), notes: notes.trim() });
        toast.success('Table ajoutée');
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    if (!confirm('Supprimer cette table ?')) return;
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/tables/${table!.id}`);
      toast.success('Table supprimée');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={isEdit ? 'Modifier la table' : 'Nouvelle table'} color={C.bordeauxDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginBottom: 12 }}>
        <div><Label>N°</Label><Input value={number} onChange={setNumber} placeholder="1, 2, A1" autoFocus mono /></div>
        <div><Label>Capacité</Label><Input type="number" value={String(capacity ?? '')} onChange={v => setCapacity(v === '' ? '' : parseInt(v))} mono /></div>
        <div><Label>Zone</Label><Input value={zone} onChange={setZone} placeholder="Salle, Terrasse, VIP" /></div>
      </div>

      {isEdit && (
        <div style={{ marginBottom: 14 }}>
          <Label>Statut</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.entries(TABLE_STATUS_CONFIG) as Array<[keyof typeof TABLE_STATUS_CONFIG, typeof TABLE_STATUS_CONFIG[keyof typeof TABLE_STATUS_CONFIG]]>).map(([val, cfg]) => {
              const sel = status === val;
              return (
                <button key={val} type="button" onClick={() => setStatus(val)} style={{
                  padding: '7px 14px', borderRadius: 100,
                  background: sel ? cfg.color : 'transparent', color: sel ? C.cream : cfg.ink,
                  border: `1.5px solid ${cfg.color}`, cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
                }}>{cfg.label}</button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Près de la fenêtre, table tranquille…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
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
          <button onClick={submit} disabled={!canSubmit} className="btn-primary">
            {submitting ? <><Loader2 size={14} className="spin" /> …</> : (isEdit ? <><Save size={14} /> Enregistrer</> : <><Plus size={14} /> Ajouter</>)}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ReservationModal({ storeId, tables, onClose, onCreated }: {
  storeId: string; tables: TableRow[]; onClose: () => void; onCreated: () => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('20:00');
  const [partySize, setPartySize] = useState<number | ''>(2);
  const [tableId, setTableId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = customerName.trim().length >= 2 && customerPhone.length >= 6
    && date && time && typeof partySize === 'number' && partySize > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const table = tables.find(t => t.id === tableId);
      await api.post(`/commerce/stores/${storeId}/reservations`, {
        customerName: customerName.trim(), customerPhone: customerPhone.trim(),
        date, time, partySize,
        ...(tableId ? { tableId } : {}),
        reason: table ? `Table T${table.number}` : 'Réservation',
        notes: notes.trim(),
      });
      toast.success('Réservation créée', `${customerName.trim()} · ${date} ${time}`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Création impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Nouvelle réservation" color={C.bordeauxDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Client</Label><Input value={customerName} onChange={setCustomerName} placeholder="M. Konan" autoFocus /></div>
        <div><Label>Téléphone</Label><Input value={customerPhone} onChange={setCustomerPhone} placeholder="+XXX XX XX XX XX" /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Date</Label><Input type="date" value={date} onChange={setDate} /></div>
        <div><Label>Heure</Label><Input type="time" value={time} onChange={setTime} /></div>
        <div><Label>Voyageurs</Label><Input type="number" value={String(partySize ?? '')} onChange={v => setPartySize(v === '' ? '' : parseInt(v))} mono /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Table (optionnel)</Label>
        <select value={tableId} onChange={e => setTableId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          <option value="">— Pas de table assignée —</option>
          {tables.map(t => (
            <option key={t.id} value={t.id}>T{t.number} · {t.capacity} pers{t.zone ? ` · ${t.zone}` : ''}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 18 }}>
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Anniversaire, allergies, fauteuil bébé…"
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

function OrderDetailModal({ order, tables, storeId, currency, onClose, onChanged }: {
  order: Order; tables: TableRow[]; storeId: string; currency: string;
  onClose: () => void; onChanged: () => void;
}) {
  const [tableId, setTableId] = useState(order.tableId ?? '');
  const [channel, setChannel] = useState<OrderChannel>(orderChannel(order));
  const [submitting, setSubmitting] = useState(false);

  const update = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/commerce/stores/${storeId}/orders/${order.id}`, {
        channel, tableId: tableId || null,
      });
      toast.success('Commande mise à jour');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={`Commande ${order.orderNumber || `#${order.id.slice(-6)}`}`} color={C.bordeauxDeep} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Label>Client</Label>
        <div style={{ padding: 12, borderRadius: 10, background: C.creamDeep }}>
          <div style={{ fontWeight: 700, color: C.ink }}>{order.customerName}</div>
          <div style={{ fontSize: 11, color: C.inkSoft, fontFamily: 'JetBrains Mono' }}>{order.customerPhone}</div>
          {order.deliveryAddress && (
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>📍 {order.deliveryAddress}</div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Label>Type de commande</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { id: 'dine_in' as const, label: 'Salle', icon: Armchair },
            { id: 'takeout' as const, label: 'À emporter', icon: ShoppingBag },
            { id: 'delivery' as const, label: 'Livraison', icon: Truck },
          ]).map(c => {
            const Icon = c.icon;
            return (
              <button key={c.id} type="button" onClick={() => setChannel(c.id)} style={{
                flex: 1, padding: '8px 10px', borderRadius: 10,
                background: channel === c.id ? C.bordeauxDeep : 'transparent',
                color: channel === c.id ? C.cream : C.inkSoft,
                border: `1.5px solid ${channel === c.id ? 'transparent' : C.inkLight + '50'}`,
                cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}><Icon size={12} /> {c.label}</button>
            );
          })}
        </div>
      </div>

      {channel === 'dine_in' && (
        <div style={{ marginBottom: 14 }}>
          <Label>Table</Label>
          <select value={tableId} onChange={e => setTableId(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
            <option value="">— Aucune —</option>
            {tables.map(t => (<option key={t.id} value={t.id}>T{t.number} · {t.capacity} pers</option>))}
          </select>
        </div>
      )}

      {order.items && order.items.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Label>Articles ({order.items.length})</Label>
          <div style={{ background: C.creamDeep, borderRadius: 10, padding: 10 }}>
            {order.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                <span>{it.qty}× {it.name}</span>
                <span className="mono-font" style={{ fontWeight: 700 }}>{formatPrice(it.lineTotal, currency)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(28,20,16,.1)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span className="display-font mono-font" style={{ fontSize: 16, fontWeight: 800, color: C.bordeauxDeep }}>{formatPrice(order.total, currency)}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn-ghost">Fermer</button>
        <button onClick={update} disabled={submitting} className="btn-primary">
          {submitting ? <><Loader2 size={14} className="spin" /> …</> : <><Save size={14} /> Enregistrer</>}
        </button>
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
