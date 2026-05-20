/**
 * Boutique Pack — Zaffran Royal redesign.
 * Pitch: "Crée ta boutique en envoyant une photo sur WhatsApp."
 *
 * 8 onglets, tous branchés sur les vraies APIs (zéro mock) :
 *   - Dashboard · KPIs + ventes live + livreurs + leads WA
 *   - Produits  · catalogue avec filtres catégorie/stock
 *   - Commandes · pipeline 6 stages (pending_payment → paid → preparing → shipping → delivered → cancelled)
 *   - POS       · caisse tactile (panier + paiement + auto-décrément stock)
 *   - Stock     · alertes low-stock + réappro
 *   - Promotions · codes coupons (percent/amount, max uses, expiration)
 *   - Clients   · CRM Kanban dérivé des commandes
 *   - WhatsApp  · inbox conversations
 *
 * Palette : Safran + Indigo + Or royal.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import BoutiqueActivationWizard from '@/components/commerce/BoutiqueActivationWizard';
import MultiPhotoEditor from '@/components/store/MultiPhotoEditor';
import VoiceAssistantFAB from '@/components/ai/VoiceAssistantFAB';
import { InboxTab } from '@/components/inbox/InboxTab';
import { StoreHeroBranding, WhatsAppQuickButton, resolveAccent } from '@/components/store/StoreHeroBranding';
import {
  Search, Plus, X, Save, Trash2, Edit3, Loader2, Camera,
  ShoppingBag, Package, Boxes, Tag, Truck, Users, MessageCircle,
  Calendar, Clock, CheckCircle2, BadgeCheck, Sparkles, Settings,
  LayoutDashboard, TrendingUp, Banknote, ShoppingCart, Percent,
  Phone, Bike, Send, RefreshCw, MapPin, Receipt, ArrowUpRight, ArrowRight,
  SlidersHorizontal, AlertTriangle, Trophy, Star, Coins,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════
// PALETTE — Zaffran Royal
// ════════════════════════════════════════════════════════════════════
const C = {
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  greenInk:    '#042A1F',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  creamWarm:   '#FAEBD7',

  saffron:     '#EA580C',
  saffronDeep: '#C2410C',
  saffronDark: '#9A3412',
  saffronSoft: '#FED7AA',

  indigo:      '#312E81',
  indigoDeep:  '#1E1B4B',
  indigoSoft:  '#E0E7FF',
  indigoLight: '#818CF8',

  gold:        '#F59E0B',
  goldDeep:    '#D97706',
  goldDark:    '#B45309',
  goldSoft:    '#FEF3C7',
  goldRich:    '#D4A017',

  emerald:     '#10B981',
  emeraldDeep: '#059669',
  emeraldDark: '#065F46',
  emeraldSoft: '#D1FAE5',

  coral:       '#FB7185',
  coralDeep:   '#E11D48',
  coralSoft:   '#FFE4E6',

  whatsapp:    '#25D366',
  whatsappDark:'#128C7E',
  whatsappSoft:'#DCF8C6',

  violet:      '#7C3AED',
  violetDeep:  '#5B21B6',
  violetSoft:  '#F3E8FF',

  cyan:        '#06B6D4',
  cyanSoft:    '#CFFAFE',
  cyanDeep:    '#0891B2',

  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  blue:        '#0EA5E9',
  blueSoft:    '#E0F2FE',
  blueDeep:    '#0284C7',
  pink:        '#EC4899',

  ink:         '#1C1410',
  inkSoft:     '#5A4D45',
  inkLight:    '#94857B',
  onGreenSoft: '#A8C9B8',
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
  .stagger > *:nth-child(7){animation-delay:.35s}
  .stagger > *:nth-child(8){animation-delay:.40s}
  .card-lift { transition: all .3s cubic-bezier(.4,0,.2,1); }
  .card-lift:hover { transform: translateY(-3px); }

  .shimmer-text {
    background: linear-gradient(90deg, ${C.gold}, ${C.saffron}, ${C.goldRich}, ${C.saffron}, ${C.gold});
    background-size: 200% auto; background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent; animation: shimmer 4s linear infinite;
  }

  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 100px;
    font-size: 11px; font-weight: 700; letter-spacing: .02em;
  }

  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.emerald}; position: relative; flex-shrink: 0; }
  .live-dot::after {
    content:''; position:absolute; inset:-4px;
    border-radius:50%; background: currentColor;
    opacity:.4; animation: pulse 1.8s ease-in-out infinite;
  }

  .btn-primary {
    background: linear-gradient(135deg, ${C.saffron}, ${C.saffronDeep});
    color: ${C.cream}; border: none;
    padding: 11px 20px; border-radius: 12px;
    font-weight: 700; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all .2s ease; font-family: inherit;
    box-shadow: 0 8px 24px -8px ${C.saffron};
  }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }

  .btn-indigo {
    background: linear-gradient(135deg, ${C.indigo}, ${C.indigoDeep});
    color: ${C.cream}; border: none;
    padding: 11px 20px; border-radius: 12px;
    font-weight: 700; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all .2s ease; font-family: inherit;
  }
  .btn-indigo:hover:not(:disabled) { transform: translateY(-2px); }

  .btn-gold {
    background: linear-gradient(135deg, ${C.gold}, ${C.goldDeep});
    color: ${C.cream}; border: none;
    padding: 11px 20px; border-radius: 12px;
    font-weight: 700; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all .2s ease; font-family: inherit;
  }
  .btn-gold:hover:not(:disabled) { transform: translateY(-2px); }

  .btn-secondary {
    background: ${C.cream}; color: ${C.saffronDeep};
    border: 1.5px solid rgba(28,20,16,.1);
    padding: 10px 16px; border-radius: 10px;
    font-weight: 600; font-size: 12px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: all .2s ease; font-family: inherit;
  }
  .btn-secondary:hover:not(:disabled) { background: ${C.saffronDeep}; color: ${C.cream}; border-color: ${C.saffronDeep}; }

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
    font-family: inherit;
  }
  .btn-ghost-light:hover { background: ${C.cream}; color: ${C.saffronDeep}; }

  .btn-whatsapp {
    background: linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark});
    color: ${C.cream}; border: none;
    padding: 11px 20px; border-radius: 12px;
    font-weight: 700; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all .2s ease; font-family: inherit;
  }
  .btn-whatsapp:hover { transform: translateY(-2px); }

  .icon-btn {
    width: 34px; height: 34px; border-radius: 9px;
    background: ${C.saffronSoft}; color: ${C.saffronDeep};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none; transition: all .2s ease; flex-shrink: 0;
  }
  .icon-btn:hover { background: ${C.saffronDeep}; color: ${C.cream}; }
  .icon-btn.indigo { background: ${C.indigoSoft}; color: ${C.indigoDeep}; }
  .icon-btn.indigo:hover { background: ${C.indigoDeep}; color: ${C.cream}; }
  .icon-btn.gold { background: ${C.goldSoft}; color: ${C.goldDark}; }
  .icon-btn.emerald { background: ${C.emeraldSoft}; color: ${C.emeraldDark}; }
  .icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${C.saffronDeep}; }

  .grain::before {
    content:''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: .06; pointer-events: none; mix-blend-mode: overlay;
  }

  .scroll-thin::-webkit-scrollbar { width: 6px; }
  .scroll-thin::-webkit-scrollbar-thumb { background: rgba(28,20,16,.15); border-radius: 100px; }
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
interface Store {
  id: string;
  name: string;
  ownerPhone: string;
  currency: string;
  country?: string;
  status?: string;
  paymentInstructions?: string;
  slug?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  accentColor?: string;
  loyaltyEnabled?: boolean;
  loyaltyThreshold?: number;
  loyaltyDiscountPct?: number;
  deliveryZones?: Array<{ name: string; fee: number; freeAbove?: number }>;
}

interface Product {
  id: string;
  name: string;
  price: number;
  comparePrice?: number;
  currency: string;
  imageUrl?: string;
  imageUrls?: string[];
  primaryImageUrl?: string;
  description?: string;
  stockQty: number;
  lowStockThreshold?: number;
  status: 'draft' | 'active' | 'out_of_stock' | 'archived';
  category?: string;
  sku?: string;
  createdAt?: { _seconds?: number } | string;
}

interface OrderItem {
  productId: string; name: string;
  qty: number; unitPrice: number; lineTotal: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  items?: OrderItem[];
  subtotal?: number;
  deliveryFee?: number;
  deliveryAddress?: string;
  deliveryZone?: string;
  total: number;
  currency: string;
  paymentMethod?: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  deliveryStatus: 'pending' | 'preparing' | 'shipped' | 'delivered';
  source?: string;
  driverId?: string;
  driverName?: string;
  createdAt: string | { _seconds?: number };
}

interface Promotion {
  id: string;
  code: string;
  name: string;
  discount: number;
  type: 'percent' | 'amount';
  uses: number;
  maxUses?: number | null;
  conditions?: string;
  expiresAt?: string | null;
  status: 'active' | 'scheduled' | 'paused' | 'expired';
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle: 'moto' | 'voiture' | 'velo' | 'pied';
  zone?: string;
  available: boolean;
  currentOrderId?: string | null;
  rating?: number;
  deliveries?: number;
}

interface PosSale {
  id: string;
  saleNumber: string;
  items: Array<{ productId: string; name: string; qty: number; unitPrice: number; lineTotal: number; size?: string | null }>;
  total: number;
  paymentMethod: string;
  customerName?: string;
  createdAt: { _seconds?: number } | string;
}

interface WaMessage {
  id: string;
  from?: string;
  to?: string;
  direction?: 'inbound' | 'outbound';
  body?: string; text?: string; message?: string;
  contactName?: string; customerName?: string;
  createdAt?: { _seconds?: number } | string;
}

type TabId = 'dashboard' | 'produits' | 'commandes' | 'pos' | 'stock' | 'promotions' | 'clients' | 'whatsapp';

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════
const NO_DECIMAL = new Set(['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN', 'RWF', 'BIF', 'UGX']);
function formatPrice(n: number, currency = 'XOF'): string {
  const decimals = NO_DECIMAL.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency,
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(n);
  } catch { return `${n.toLocaleString('fr-FR')} ${currency}`; }
}
function formatShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} Mds`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)} M`;
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
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}
function gradientFor(id: string): string {
  const gradients = [
    `linear-gradient(135deg, ${C.saffron} 0%, ${C.saffronDeep} 50%, ${C.saffronDark} 100%)`,
    `linear-gradient(135deg, ${C.indigo} 0%, ${C.indigoDeep} 50%, #0F0C2E 100%)`,
    `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDeep} 50%, ${C.goldDark} 100%)`,
    `linear-gradient(135deg, ${C.emerald} 0%, ${C.emeraldDeep} 50%, ${C.emeraldDark} 100%)`,
    `linear-gradient(135deg, ${C.coralDeep} 0%, #BE123C 50%, #881337 100%)`,
    `linear-gradient(135deg, ${C.pink} 0%, #DB2777 50%, #9D174D 100%)`,
    `linear-gradient(135deg, ${C.cyanDeep} 0%, #0E7490 50%, #155E75 100%)`,
    `linear-gradient(135deg, ${C.violetDeep} 0%, #4338CA 50%, #312E81 100%)`,
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return gradients[h % gradients.length];
}
function colorVar(c: 'saffron' | 'indigo' | 'gold' | 'emerald' | 'coral' | 'violet') {
  const map = {
    saffron:  { main: C.saffron,  deep: C.saffronDeep,  soft: C.saffronSoft },
    indigo:   { main: C.indigo,   deep: C.indigoDeep,   soft: C.indigoSoft },
    gold:     { main: C.gold,     deep: C.goldDeep,     soft: C.goldSoft },
    emerald:  { main: C.emerald,  deep: C.emeraldDeep,  soft: C.emeraldSoft },
    coral:    { main: C.coral,    deep: C.coralDeep,    soft: C.coralSoft },
    violet:   { main: C.violet,   deep: C.violetDeep,   soft: C.violetSoft },
  };
  return map[c];
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 Espèces',
  mobile_money: '📱 Mobile Money',
  wave: '🌊 Wave',
  orange_money: '🟧 Orange Money',
  mtn_money: '🟨 MTN Money',
  card: '💳 Carte',
};

// 6-stage pipeline derived from paymentStatus + deliveryStatus
function orderStage(o: Order): 'pending_payment' | 'paid' | 'preparing' | 'shipping' | 'delivered' | 'cancelled' {
  if (o.paymentStatus === 'failed') return 'cancelled';
  if (o.deliveryStatus === 'delivered') return 'delivered';
  if (o.deliveryStatus === 'shipped') return 'shipping';
  if (o.deliveryStatus === 'preparing') return 'preparing';
  if (o.paymentStatus === 'paid') return 'paid';
  return 'pending_payment';
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; ink: string; icon: any }> = {
  pending_payment: { label: 'En attente paiement', color: C.yellow,   bg: C.yellowSoft,   ink: C.goldDark,    icon: Clock },
  paid:            { label: 'Payée',                color: C.gold,     bg: C.goldSoft,     ink: C.goldDark,    icon: Coins },
  preparing:       { label: 'En préparation',       color: C.cyanDeep, bg: C.cyanSoft,     ink: C.cyanDeep,    icon: Package },
  shipping:        { label: 'En livraison',         color: C.indigo,   bg: C.indigoSoft,   ink: C.indigoDeep,  icon: Truck },
  delivered:       { label: 'Livrée',               color: C.emerald,  bg: C.emeraldSoft,  ink: C.emeraldDark, icon: CheckCircle2 },
  cancelled:       { label: 'Annulée',              color: C.red,      bg: C.redSoft,      ink: C.red,         icon: X },
};

// ════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════════
export default function BoutiqueRedesignPage() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [waMessages, setWaMessages] = useState<WaMessage[]>([]);
  const [waConnected, setWaConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [addPromoOpen, setAddPromoOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [addDriverOpen, setAddDriverOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r1: any = await api.get('/commerce/stores', { params: { businessType: 'boutique' } })
        .catch(() => ({ data: { stores: [] } }));
      const stores = (r1?.data?.stores ?? []) as Store[];
      const s = stores[0];
      if (!s) { setStore(null); setProducts([]); setOrders([]); setPromotions([]); setDrivers([]); setPosSales([]); setWaMessages([]); return; }
      setStore(s);
      const [r2, r3, r4, r5, r6, r7, r8] = await Promise.all([
        api.get(`/commerce/stores/${s.id}/products`).catch(() => ({ data: { products: [] } })),
        api.get(`/commerce/stores/${s.id}/orders`).catch(() => ({ data: { orders: [] } })),
        api.get(`/commerce/stores/${s.id}/promotions`).catch(() => ({ data: { promotions: [] } })),
        api.get(`/commerce/stores/${s.id}/drivers`).catch(() => ({ data: { drivers: [] } })),
        api.get(`/commerce/stores/${s.id}/pos-sales`).catch(() => ({ data: { sales: [] } })),
        api.get('/whatsapp/messages').catch(() => ({ data: { data: [] } })),
        api.get('/whatsapp/status').catch(() => ({ data: { data: { connected: false } } })),
      ]);
      setProducts((r2 as any)?.data?.products ?? []);
      setOrders((r3 as any)?.data?.orders ?? []);
      setPromotions((r4 as any)?.data?.promotions ?? []);
      setDrivers((r5 as any)?.data?.drivers ?? []);
      setPosSales((r6 as any)?.data?.sales ?? []);
      const waData = (r7 as any)?.data?.data ?? (r7 as any)?.data?.messages ?? [];
      setWaMessages(Array.isArray(waData) ? waData : []);
      const waStatus = (r8 as any)?.data?.data ?? (r8 as any)?.data ?? {};
      setWaConnected(!!waStatus.connected);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const currency = store?.currency ?? 'XOF';

  // Today's KPIs
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  const ordersToday = orders.filter(o => getTimestamp(o.createdAt) >= todayMs);
  const salesToday = posSales.filter(s => getTimestamp(s.createdAt) >= todayMs);
  const caToday = ordersToday.reduce((s, o) => s + (o.total || 0), 0)
                + salesToday.reduce((s, x) => s + (x.total || 0), 0);
  const avgBasket = (ordersToday.length + salesToday.length) > 0
    ? caToday / (ordersToday.length + salesToday.length) : 0;

  // Derived data
  const customers = useMemo(() => deriveCustomers(orders), [orders]);
  const waThreads = useMemo(() => deriveWaThreads(waMessages), [waMessages]);
  const lowStock = useMemo(() => products.filter(p => p.status !== 'archived' && p.stockQty <= (p.lowStockThreshold ?? 5)), [products]);

  if (loading && !store) {
    return (
      <div style={{ minHeight: '100vh', background: C.greenDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 size={32} className="spin" color={C.saffron} />
      </div>
    );
  }
  if (!store) {
    return (
      <>
        <ActivationFallback onOpen={() => setWizardOpen(true)} />
        {wizardOpen && (
          <BoutiqueActivationWizard
            open
            onClose={() => setWizardOpen(false)}
            onSuccess={() => { setWizardOpen(false); fetchAll(); }}
          />
        )}
      </>
    );
  }

  const counts: Record<TabId, number | null> = {
    dashboard: null,
    produits: products.length,
    commandes: orders.filter(o => o.deliveryStatus !== 'delivered' && o.paymentStatus !== 'failed').length,
    pos: null,
    stock: lowStock.length,
    promotions: promotions.filter(p => p.status === 'active').length,
    clients: customers.length,
    whatsapp: waThreads.filter(t => t.unread).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <HeroAdmin
          store={store}
          onAddProduct={() => setAddProductOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <TabStrip activeTab={tab} setActiveTab={setTab} counts={counts} />

        {tab === 'dashboard' && (
          <DashboardTab
            currency={currency}
            ordersToday={ordersToday} salesToday={salesToday}
            caToday={caToday} avgBasket={avgBasket}
            orders={orders} products={products} drivers={drivers}
            waThreads={waThreads}
            onSelectProduct={p => setEditingProduct(p)}
            onAddDriver={() => setAddDriverOpen(true)}
          />
        )}
        {tab === 'produits' && (
          <ProduitsTab
            products={products} currency={currency}
            onSelectProduct={p => setEditingProduct(p)}
            onAdd={() => setAddProductOpen(true)}
          />
        )}
        {tab === 'commandes' && (
          <CommandesTab
            orders={orders} currency={currency} drivers={drivers} storeId={store.id}
            onSelectOrder={o => setEditingOrder(o)}
            onChanged={() => fetchAll(true)}
          />
        )}
        {tab === 'pos' && (
          <PosTab
            products={products} promotions={promotions} currency={currency} storeId={store.id}
            recentSales={posSales}
            onCompleted={() => fetchAll(true)}
          />
        )}
        {tab === 'stock' && (
          <StockTab products={products} currency={currency} onSelectProduct={p => setEditingProduct(p)} />
        )}
        {tab === 'promotions' && (
          <PromotionsTab
            promotions={promotions}
            onAdd={() => setAddPromoOpen(true)}
            onSelectPromo={p => setEditingPromo(p)}
          />
        )}
        {tab === 'clients' && (
          <ClientsTab customers={customers} />
        )}
        {tab === 'whatsapp' && (
          <InboxTab
            accent={C.saffron} accentDeep={C.saffronDeep}
            ink={C.ink} inkSoft={C.inkSoft} inkLight={C.inkLight}
            cream={C.cream} creamDeep={C.creamDeep}
            emptyHint="Dès qu'un client écrit sur WhatsApp ou Telegram, sa conversation apparaît ici."
          />
        )}
      </div>

      {addProductOpen && (
        <ProductModal storeId={store.id} currency={currency}
          onClose={() => setAddProductOpen(false)}
          onSaved={() => { setAddProductOpen(false); fetchAll(true); }}
        />
      )}
      {editingProduct && (
        <ProductModal storeId={store.id} currency={currency} product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => { setEditingProduct(null); fetchAll(true); }}
          onDeleted={() => { setEditingProduct(null); fetchAll(true); }}
        />
      )}
      {addPromoOpen && (
        <PromotionModal storeId={store.id}
          onClose={() => setAddPromoOpen(false)}
          onSaved={() => { setAddPromoOpen(false); fetchAll(true); }}
        />
      )}
      {editingPromo && (
        <PromotionModal storeId={store.id} promotion={editingPromo}
          onClose={() => setEditingPromo(null)}
          onSaved={() => { setEditingPromo(null); fetchAll(true); }}
          onDeleted={() => { setEditingPromo(null); fetchAll(true); }}
        />
      )}
      {addDriverOpen && (
        <DriverModal storeId={store.id}
          onClose={() => setAddDriverOpen(false)}
          onSaved={() => { setAddDriverOpen(false); fetchAll(true); }}
        />
      )}
      {editingDriver && (
        <DriverModal storeId={store.id} driver={editingDriver}
          onClose={() => setEditingDriver(null)}
          onSaved={() => { setEditingDriver(null); fetchAll(true); }}
          onDeleted={() => { setEditingDriver(null); fetchAll(true); }}
        />
      )}
      {editingOrder && (
        <OrderDetailModal order={editingOrder} drivers={drivers} storeId={store.id} currency={currency}
          onClose={() => setEditingOrder(null)}
          onChanged={() => { setEditingOrder(null); fetchAll(true); }}
        />
      )}
      {settingsOpen && (
        <StoreSettingsModal store={store}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => { setSettingsOpen(false); fetchAll(true); }}
          onManageDrivers={() => { setSettingsOpen(false); setAddDriverOpen(true); }}
        />
      )}

      <VoiceAssistantFAB
        accentColor={C.saffron} accentDeep={C.saffronDeep}
        label="Assistant Boutique"
        systemInstruction={`Tu es l'assistant vocal de la boutique "${store.name}".

CONTEXTE :
- ${products.length} produit${products.length > 1 ? 's' : ''} (${products.filter(p => p.status === 'active').length} actifs · ${lowStock.length} en stock bas)
- ${ordersToday.length} commande${ordersToday.length > 1 ? 's' : ''} aujourd'hui
- ${promotions.filter(p => p.status === 'active').length} promo${promotions.filter(p => p.status === 'active').length > 1 ? 's' : ''} actives
- ${drivers.filter(d => d.available).length} livreur${drivers.filter(d => d.available).length > 1 ? 's' : ''} disponibles

TON RÔLE :
- Renseigner sur produits, stock, promos
- Aider à encaisser au POS
- Suggérer livreurs disponibles pour une commande

RÈGLES :
- N'encaisse JAMAIS une vente POS sans validation orale explicite du caissier.
- Reste bref et opérationnel.`}
      />
    </div>
  );
}

function ActivationFallback({ onOpen }: { onOpen: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <style>{STYLES}</style>
      <div style={{ textAlign: 'center', color: C.cream, maxWidth: 480 }}>
        <ShoppingBag size={56} color={C.gold} style={{ marginBottom: 16 }} />
        <h1 className="display-font" style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>
          Crée ta <em className="shimmer-text" style={{ fontStyle: 'italic', fontWeight: 500 }}>boutique</em>
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,250,240,.8)', margin: '12px 0 24px' }}>
          En envoyant une photo sur WhatsApp.
        </p>
        <button onClick={onOpen} className="btn-primary">
          <Sparkles size={14} /> Activer ma boutique
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Derived data
// ════════════════════════════════════════════════════════════════════
interface Customer {
  phone: string; name: string; orders: number;
  totalSpent: number; lastAt: number; stage: 'new' | 'returning' | 'loyal' | 'vip' | 'lost';
}
function deriveCustomers(orders: Order[]): Customer[] {
  const byPhone = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.customerPhone) continue;
    const k = o.customerPhone.trim();
    const arr = byPhone.get(k) ?? [];
    arr.push(o);
    byPhone.set(k, arr);
  }
  const out: Customer[] = [];
  for (const [phone, list] of byPhone) {
    list.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
    const totalSpent = list.reduce((s, o) => s + (o.total || 0), 0);
    const stage: Customer['stage'] =
      totalSpent >= 500_000 ? 'vip' :
      list.length >= 5      ? 'loyal' :
      list.length >= 2      ? 'returning' :
      Date.now() - getTimestamp(list[0].createdAt) > 90 * 86_400_000 ? 'lost' :
                              'new';
    out.push({
      phone,
      name: list[0].customerName || phone,
      orders: list.length,
      totalSpent,
      lastAt: getTimestamp(list[0].createdAt),
      stage,
    });
  }
  out.sort((a, b) => b.lastAt - a.lastAt);
  return out;
}

interface WaThread {
  phone: string; name: string; lastMessage: string; lastAt: number;
  unread: boolean; messages: WaMessage[];
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
    threads.push({
      phone,
      name: last.contactName ?? last.customerName ?? phone,
      lastMessage: last.body ?? last.text ?? last.message ?? '',
      lastAt: getTimestamp(last.createdAt),
      unread: last.direction === 'inbound',
      messages: list,
    });
  }
  threads.sort((a, b) => b.lastAt - a.lastAt);
  return threads;
}

// ════════════════════════════════════════════════════════════════════
// HERO
// ════════════════════════════════════════════════════════════════════
function HeroAdmin({ store, onAddProduct, onOpenSettings }: { store: Store; onAddProduct: () => void; onOpenSettings: () => void }) {
  // If the merchant set a custom accent in Settings/Studio, use it as the
  // dominant hero color. Otherwise fall back to the pack default (saffron).
  const accent = resolveAccent(store as any, C.saffron);
  return (
    <div style={{
      position: 'relative',
      background: `linear-gradient(135deg, ${C.indigoDeep} 0%, ${C.saffronDeep} 60%, ${accent} 130%)`,
      borderRadius: 22, padding: '24px 28px',
      overflow: 'hidden',
      border: `1px solid ${C.gold}40`,
      boxShadow: `0 20px 50px -20px ${accent}`,
    }}>
      <div className="grain"></div>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .4, pointerEvents: 'none' }}>
        {Array.from({ length: 25 }).map((_, i) => (
          <circle key={i}
            cx={`${(i * 41) % 100}%`} cy={`${(i * 73) % 100}%`}
            r={((i * 7) % 12) / 8 + 0.4}
            fill={i % 2 === 0 ? C.gold : '#FED7AA'}
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
          <ShoppingBag size={11} /> BOUTIQUE · <span style={{ color: C.whatsappSoft }}>WHATSAPP</span>
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
              {store.name.split(' ').slice(1).join(' ') || 'Store'}
            </em>
          </h1>
          {(store.tagline || store.shortDescription || store.logoUrl) ? (
            <StoreHeroBranding store={store as any} accent={C.goldRich} dark />
          ) : (
            <p style={{ fontSize: 14, color: 'rgba(255,250,240,.85)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Vends sur <strong style={{ color: C.whatsappSoft }}>WhatsApp</strong>. Pilote depuis ton dashboard.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={onAddProduct} className="btn-gold">
            <Plus size={14} /> Ajouter un produit
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
function TabStrip({ activeTab, setActiveTab, counts }: { activeTab: TabId; setActiveTab: (t: TabId) => void; counts: Record<TabId, number | null> }) {
  const tabs: Array<{ id: TabId; label: string; icon: any; highlight?: boolean }> = [
    { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
    { id: 'produits',   label: 'Produits',   icon: Package },
    { id: 'commandes',  label: 'Commandes',  icon: ShoppingBag },
    { id: 'pos',        label: 'POS',         icon: Receipt },
    { id: 'stock',      label: 'Stock',       icon: Boxes },
    { id: 'promotions', label: 'Promos',      icon: Percent },
    { id: 'clients',    label: 'Clients',     icon: Users },
    { id: 'whatsapp',   label: 'Inbox',         icon: MessageCircle, highlight: true },
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
            background: active ? `linear-gradient(135deg, ${C.saffron}, ${C.saffronDeep})` : 'transparent',
            color: active ? C.cream : C.inkSoft,
            padding: '10px 16px', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            boxShadow: active ? `0 6px 14px -4px ${C.saffron}` : 'none',
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
  currency: string;
  ordersToday: Order[]; salesToday: PosSale[];
  caToday: number; avgBasket: number;
  orders: Order[]; products: Product[]; drivers: Driver[];
  waThreads: WaThread[];
  onSelectProduct: (p: Product) => void;
  onAddDriver: () => void;
}) {
  const { currency, ordersToday, salesToday, caToday, avgBasket, orders, products, drivers, waThreads, onSelectProduct, onAddDriver } = props;
  const paid = orders.filter(o => o.paymentStatus === 'paid' && o.deliveryStatus !== 'delivered').length;
  const prep = orders.filter(o => o.deliveryStatus === 'preparing').length;
  const deliveredToday = ordersToday.filter(o => o.deliveryStatus === 'delivered').length;

  const kpis: Array<{ id: string; label: string; value: string; unit?: string; sub: string; icon: any; color: 'saffron' | 'indigo' | 'gold' | 'emerald' | 'coral' | 'violet' }> = [
    { id: 'ca', label: 'CA du jour', value: formatShort(caToday), unit: currency,
      sub: `${ordersToday.length + salesToday.length} ventes`, icon: Banknote, color: 'emerald' },
    { id: 'cmd', label: 'Commandes', value: String(ordersToday.length),
      sub: `${paid} payées · ${prep} prépa · ${deliveredToday} livrées`, icon: Package, color: 'saffron' },
    { id: 'panier', label: 'Panier moyen', value: formatShort(avgBasket),
      sub: `${ordersToday.length + salesToday.length > 0 ? 'aujourd\'hui' : 'pas encore de vente'}`, icon: ShoppingBag, color: 'gold' },
    { id: 'prod', label: 'Produits actifs', value: String(products.filter(p => p.status === 'active').length),
      sub: `${products.length} au total`, icon: Boxes, color: 'indigo' },
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11,
                  background: cs.soft, color: cs.deep,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="display-font mono-font" style={{ fontSize: 28, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-.02em', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                {s.value}
                {s.unit && <span style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>{s.unit}</span>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 6 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 1 }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="map-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
        <VentesLivePanel orders={orders} salesPos={salesToday} currency={currency} />
        <LivreursPanel drivers={drivers} orders={orders} onAdd={onAddDriver} />
      </div>

      <RecentLeadsPanel threads={waThreads} />

      {products.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={14} fill={C.gold} color={C.goldDeep} />
              <span className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.cream, letterSpacing: '-.01em' }}>
                Tes <em style={{ fontStyle: 'italic', fontWeight: 500 }}>produits récents</em>
              </span>
            </div>
          </div>
          <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {products.slice(0, 4).map(p => (
              <ProduitCard key={p.id} product={p} currency={currency} onClick={() => onSelectProduct(p)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// VENTES LIVE PANEL
// ════════════════════════════════════════════════════════════════════
function VentesLivePanel({ orders, salesPos, currency }: { orders: Order[]; salesPos: PosSale[]; currency: string }) {
  const combined = useMemo(() => {
    type Entry = { id: string; kind: 'order' | 'pos'; label: string; customer: string; total: number; at: number; sublabel: string };
    const entries: Entry[] = [
      ...orders.map(o => ({
        id: o.id, kind: 'order' as const,
        label: o.orderNumber || `#${o.id.slice(-4)}`,
        customer: o.customerName || '—',
        total: o.total,
        at: getTimestamp(o.createdAt),
        sublabel: STAGE_CONFIG[orderStage(o)].label,
      })),
      ...salesPos.map(s => ({
        id: s.id, kind: 'pos' as const,
        label: s.saleNumber,
        customer: s.customerName || 'Comptoir',
        total: s.total,
        at: getTimestamp(s.createdAt),
        sublabel: PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod,
      })),
    ];
    entries.sort((a, b) => b.at - a.at);
    return entries.slice(0, 10);
  }, [orders, salesPos]);

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.indigoDeep}, ${C.indigo})`,
      borderRadius: 18, border: `1px solid ${C.gold}30`,
      overflow: 'hidden', position: 'relative',
      minHeight: 420, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 18px',
        background: 'rgba(0,0,0,.25)',
        borderBottom: `1px solid ${C.gold}20`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Sparkles size={14} color={C.gold} />
        <span className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: '.12em', flex: 1 }}>
          VENTES · LIVE
        </span>
        <span className="pill" style={{
          background: `${C.emerald}25`, color: C.emerald,
          border: `1px solid ${C.emerald}50`, fontSize: 9, fontWeight: 800,
        }}>
          <span className="live-dot" style={{ width: 6, height: 6, color: C.emerald }}></span>
          LIVE
        </span>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {combined.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,250,240,.6)' }}>
            <ShoppingCart size={36} color={C.gold} style={{ marginBottom: 10, opacity: .7 }} />
            <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 4 }}>
              Pas encore de vente
            </div>
            <div style={{ fontSize: 11 }}>Les ventes apparaissent ici en temps réel.</div>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {combined.map(e => (
              <div key={`${e.kind}-${e.id}`} style={{
                background: 'rgba(255,250,240,.06)',
                border: '1px solid rgba(255,250,240,.1)',
                borderRadius: 11, padding: 10,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: e.kind === 'pos' ? `${C.gold}25` : `${C.saffron}25`,
                  color: e.kind === 'pos' ? C.gold : C.saffronSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {e.kind === 'pos' ? <Receipt size={16} /> : <ShoppingBag size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.cream }}>{e.label}</span>
                    <span className="mono-font" style={{ fontSize: 9, color: 'rgba(255,250,240,.55)' }}>
                      {timeAgo(e.at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,250,240,.7)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{e.customer}</span>
                    <span>·</span>
                    <span>{e.sublabel}</span>
                  </div>
                </div>
                <div className="mono-font" style={{ fontSize: 13, fontWeight: 800, color: C.gold }}>
                  {formatShort(e.total)} <span style={{ fontSize: 9, opacity: .7 }}>{currency}</span>
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
// LIVREURS PANEL
// ════════════════════════════════════════════════════════════════════
function LivreursPanel({ drivers, orders, onAdd }: { drivers: Driver[]; orders: Order[]; onAdd: () => void }) {
  const driverWithOrder = (d: Driver) => orders.find(o => o.driverId === d.id && o.deliveryStatus !== 'delivered');
  return (
    <div style={{
      background: C.cream, borderRadius: 18,
      border: '1px solid rgba(28,20,16,.06)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      minHeight: 420,
    }}>
      <div style={{
        padding: '14px 18px',
        background: `linear-gradient(135deg, ${C.saffron}, ${C.saffronDeep})`,
        color: C.cream, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Bike size={16} />
        <div style={{ flex: 1 }}>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', opacity: .9 }}>
            LIVREURS · {drivers.length} TOTAL
          </div>
          <div className="display-font" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em' }}>
            {drivers.filter(d => d.available).length} dispo
          </div>
        </div>
        <button onClick={onAdd} className="icon-btn" style={{ background: 'rgba(255,255,255,.2)', color: C.cream, width: 32, height: 32 }}>
          <Plus size={14} />
        </button>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {drivers.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <Truck size={36} color={C.inkLight} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
              Pas encore de livreur
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 12 }}>
              Ajoute tes livreurs pour assigner les commandes.
            </div>
            <button onClick={onAdd} className="btn-secondary" style={{ padding: '7px 12px', fontSize: 11 }}>
              <Plus size={11} /> Ajouter un livreur
            </button>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {drivers.map(d => {
              const order = driverWithOrder(d);
              return (
                <div key={d.id} style={{
                  background: C.creamDeep, borderRadius: 11, padding: 10,
                  border: '1px solid rgba(28,20,16,.06)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: d.available ? `${C.emerald}25` : `${C.gold}25`,
                    color: d.available ? C.emeraldDeep : C.goldDark,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 12,
                    fontFamily: 'Fraunces, serif', flexShrink: 0, position: 'relative',
                  }}>
                    {initials(d.name)}
                    <div style={{
                      position: 'absolute', bottom: -1, right: -1,
                      width: 10, height: 10, borderRadius: '50%',
                      background: d.available ? C.emerald : C.gold,
                      border: `2px solid ${C.creamDeep}`,
                    }}></div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{d.name}</div>
                    <div style={{ fontSize: 10, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{d.vehicle === 'moto' ? '🛵' : d.vehicle === 'voiture' ? '🚗' : d.vehicle === 'velo' ? '🚲' : '🚶'} {d.vehicle}</span>
                      {d.zone && <><span>·</span><span>{d.zone}</span></>}
                    </div>
                    {order && (
                      <div className="pill" style={{ background: C.indigoSoft, color: C.indigoDeep, fontSize: 9, fontWeight: 700, marginTop: 3 }}>
                        En course · {order.orderNumber}
                      </div>
                    )}
                  </div>
                  <a href={`https://wa.me/${d.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    className="icon-btn" style={{ background: C.whatsappSoft, color: C.whatsappDark, width: 30, height: 30, textDecoration: 'none' }}>
                    <MessageCircle size={13} />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// RECENT LEADS PANEL
// ════════════════════════════════════════════════════════════════════
function RecentLeadsPanel({ threads }: { threads: WaThread[] }) {
  const recent = threads.slice(0, 5);
  if (recent.length === 0) return null;
  return (
    <div style={{
      background: C.cream, borderRadius: 18, padding: 18,
      border: `1.5px solid ${C.whatsapp}30`,
    }}>
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
          <div key={t.phone} style={{
            background: C.creamDeep, borderRadius: 11, padding: 10,
            border: '1px solid rgba(28,20,16,.06)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`,
              color: C.cream, fontWeight: 700, fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif', flexShrink: 0,
            }}>
              {initials(t.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{t.name}</span>
                <span className="mono-font" style={{ fontSize: 9, color: C.inkLight }}>{timeAgo(t.lastAt)}</span>
              </div>
              <p style={{ fontSize: 11, color: C.inkSoft, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.lastMessage || '—'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PRODUIT CARD
// ════════════════════════════════════════════════════════════════════
function ProduitCard({ product, currency, onClick }: { product: Product; currency: string; onClick?: () => void }) {
  const image = product.primaryImageUrl || product.imageUrl
    || (Array.isArray(product.imageUrls) ? product.imageUrls[0] : undefined);
  const isLowStock = product.stockQty <= (product.lowStockThreshold ?? 5);
  const isOutOfStock = product.stockQty === 0;

  return (
    <div onClick={onClick} className="card-lift" style={{
      background: C.cream, borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(28,20,16,.06)',
      cursor: 'pointer', position: 'relative',
      boxShadow: '0 4px 12px -4px rgba(28,20,16,.05)',
    }}>
      <div style={{
        height: 180, position: 'relative', overflow: 'hidden',
        background: image ? '#000' : gradientFor(product.id),
      }}>
        {image ? (
          <img src={image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,250,240,.4)' }}>
            <Package size={80} strokeWidth={1} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {product.status === 'archived' && (
            <span className="pill" style={{ background: C.inkLight, color: C.cream, fontWeight: 800, fontSize: 10 }}>
              Archivé
            </span>
          )}
          {product.status === 'draft' && (
            <span className="pill" style={{ background: C.creamDeep, color: C.inkSoft, fontWeight: 800, fontSize: 10 }}>
              Brouillon
            </span>
          )}
          {isOutOfStock && (
            <span className="pill" style={{ background: C.red, color: C.cream, fontWeight: 800, fontSize: 10 }}>
              Rupture
            </span>
          )}
          {!isOutOfStock && isLowStock && (
            <span className="pill" style={{ background: C.coral, color: C.cream, fontWeight: 800, fontSize: 10 }}>
              Stock bas
            </span>
          )}
          {product.comparePrice && product.comparePrice > product.price && (
            <span className="pill" style={{ background: `linear-gradient(135deg, ${C.coralDeep}, ${C.red})`, color: C.cream, fontWeight: 800, fontSize: 10 }}>
              −{Math.round((1 - product.price / product.comparePrice) * 100)}%
            </span>
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
      </div>
      <div style={{ padding: 16 }}>
        <h3 className="display-font" style={{
          fontSize: 15, fontWeight: 700, color: C.ink, margin: '0 0 8px',
          letterSpacing: '-.02em', lineHeight: 1.25,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>{product.name}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="display-font mono-font" style={{
              fontSize: 18, fontWeight: 800, color: C.saffronDeep, letterSpacing: '-.02em', lineHeight: 1,
            }}>
              {formatShort(product.price || 0)}
            </div>
            <div style={{ fontSize: 9, color: C.inkLight, fontWeight: 700, letterSpacing: '.05em', marginTop: 2 }}>
              {(product.currency || currency).toUpperCase()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono-font" style={{ fontSize: 12, fontWeight: 700, color: isOutOfStock ? C.red : (isLowStock ? C.coralDeep : C.ink) }}>
              {product.stockQty} en stock
            </div>
            {product.sku && (
              <div style={{ fontSize: 9, color: C.inkLight, fontFamily: 'JetBrains Mono' }}>
                {product.sku}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PRODUITS TAB
// ════════════════════════════════════════════════════════════════════
function ProduitsTab({ products, currency, onSelectProduct, onAdd }: { products: Product[]; currency: string; onSelectProduct: (p: Product) => void; onAdd: () => void }) {
  const [filter, setFilter] = useState<'all' | Product['status']>('all');
  const [search, setSearch] = useState('');
  const filtered = products.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [p.name, p.description, p.sku, p.category].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: C.cream, borderRadius: 14, padding: 14,
        border: '1px solid rgba(28,20,16,.06)',
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
              placeholder="Nom, description, SKU…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: C.ink, fontFamily: 'inherit', minWidth: 0 }}
            />
          </div>
          <button onClick={onAdd} className="btn-primary"><Plus size={13} /> Ajouter</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            { id: 'all', label: 'Tous', color: C.saffron },
            { id: 'active', label: 'Actifs', color: C.emerald },
            { id: 'draft', label: 'Brouillons', color: C.inkSoft },
            { id: 'out_of_stock', label: 'Rupture', color: C.coral },
            { id: 'archived', label: 'Archivés', color: C.inkLight },
          ] as const).map(f => {
            const count = f.id === 'all' ? products.length : products.filter(p => p.status === f.id).length;
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id as any)} style={{
                background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'transparent',
                color: active ? C.cream : C.inkSoft,
                padding: '7px 12px', borderRadius: 100,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: active ? 'none' : '1px solid rgba(28,20,16,.1)',
                fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5,
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

      {products.length === 0 ? (
        <EmptyState icon={Package} title="Pas encore de produit"
          desc="Ajoute ton premier produit (photo, prix, stock). Tes clients pourront commander via WhatsApp ou le site public."
          cta="Ajouter mon 1er produit" onAction={onAdd} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Aucun produit ne correspond" desc="Ajuste les filtres ci-dessus." />
      ) : (
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {filtered.map(p => <ProduitCard key={p.id} product={p} currency={currency} onClick={() => onSelectProduct(p)} />)}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// COMMANDES TAB — 6 stages pipeline
// ════════════════════════════════════════════════════════════════════
function CommandesTab({ orders, currency, drivers, storeId, onSelectOrder, onChanged }: {
  orders: Order[]; currency: string; drivers: Driver[]; storeId: string;
  onSelectOrder: (o: Order) => void; onChanged: () => void;
}) {
  const [filter, setFilter] = useState<'all' | keyof typeof STAGE_CONFIG>('all');
  const filtered = orders.filter(o => filter === 'all' || orderStage(o) === filter);

  const setStage = async (order: Order, stage: keyof typeof STAGE_CONFIG) => {
    const updates: Record<string, string> = {};
    switch (stage) {
      case 'pending_payment': updates['paymentStatus'] = 'pending'; updates['deliveryStatus'] = 'pending'; break;
      case 'paid':            updates['paymentStatus'] = 'paid';    updates['deliveryStatus'] = 'pending'; break;
      case 'preparing':       updates['paymentStatus'] = 'paid';    updates['deliveryStatus'] = 'preparing'; break;
      case 'shipping':        updates['paymentStatus'] = 'paid';    updates['deliveryStatus'] = 'shipped'; break;
      case 'delivered':       updates['paymentStatus'] = 'paid';    updates['deliveryStatus'] = 'delivered'; break;
      case 'cancelled':       updates['paymentStatus'] = 'failed';  break;
    }
    try {
      await api.patch(`/commerce/stores/${storeId}/orders/${order.id}`, updates);
      toast.success('Commande mise à jour');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };

  const stages = Object.keys(STAGE_CONFIG) as Array<keyof typeof STAGE_CONFIG>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: C.cream, borderRadius: 14, padding: 14,
        border: '1px solid rgba(28,20,16,.06)',
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>
        <button onClick={() => setFilter('all')} style={{
          background: filter === 'all' ? `linear-gradient(135deg, ${C.saffron}, ${C.saffronDeep})` : 'transparent',
          color: filter === 'all' ? C.cream : C.inkSoft,
          padding: '7px 12px', borderRadius: 100,
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
          border: filter === 'all' ? 'none' : '1px solid rgba(28,20,16,.1)',
          fontFamily: 'inherit',
        }}>
          Toutes ({orders.length})
        </button>
        {stages.map(s => {
          const cfg = STAGE_CONFIG[s];
          const count = orders.filter(o => orderStage(o) === s).length;
          const active = filter === s;
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              background: active ? `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` : 'transparent',
              color: active ? C.cream : cfg.ink,
              padding: '7px 12px', borderRadius: 100,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: active ? 'none' : `1px solid ${cfg.color}40`,
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              {cfg.label} <span className="mono-font" style={{ background: active ? 'rgba(255,250,240,.25)' : C.creamDeep, padding: '1px 6px', borderRadius: 6, fontSize: 9 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Aucune commande"
          desc="Les commandes (WhatsApp ou site public) apparaîtront ici dans le pipeline 6 étapes." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Aucune commande dans cette étape" desc="Change de filtre ou patiente." />
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(o => <OrderRow key={o.id} order={o} currency={currency} drivers={drivers}
            onClick={() => onSelectOrder(o)} onSetStage={(s) => setStage(o, s)} />)}
        </div>
      )}
    </div>
  );
}

function OrderRow({ order, currency, drivers, onClick, onSetStage }: {
  order: Order; currency: string; drivers: Driver[];
  onClick: () => void; onSetStage: (s: keyof typeof STAGE_CONFIG) => void;
}) {
  const stage = orderStage(order);
  const cfg = STAGE_CONFIG[stage];
  const Icon = cfg.icon;
  const driver = drivers.find(d => d.id === order.driverId);
  const at = getTimestamp(order.createdAt);

  return (
    <div onClick={onClick} className="card-lift" style={{
      background: C.cream, borderRadius: 12, padding: 14,
      border: '1px solid rgba(28,20,16,.06)',
      borderLeft: `4px solid ${cfg.color}`,
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 50, height: 50, borderRadius: 11,
        background: cfg.bg, color: cfg.ink,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <span className="display-font mono-font" style={{ fontSize: 14, fontWeight: 800, color: C.ink, letterSpacing: '-.01em' }}>
            {order.orderNumber || `#${order.id.slice(-6)}`}
          </span>
          <span className="pill" style={{ background: cfg.bg, color: cfg.ink, fontSize: 9, fontWeight: 800 }}>
            {cfg.label}
          </span>
          {order.paymentMethod && (
            <span className="pill" style={{ background: C.creamDeep, color: C.inkSoft, fontSize: 9, fontWeight: 600 }}>
              {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{order.customerName} · <span className="mono-font">{order.customerPhone}</span></span>
          <WhatsAppQuickButton phone={order.customerPhone} prefill={`Bonjour ${order.customerName ?? ''}, à propos de votre commande #${(order.id ?? '').slice(0, 6)}…`} />
        </div>
        <div style={{ fontSize: 10, color: C.inkLight, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{(order.items?.length || 0)} article{(order.items?.length || 0) > 1 ? 's' : ''}</span>
          {order.deliveryZone && <><span>·</span><span><MapPin size={9} style={{ display: 'inline' }} /> {order.deliveryZone}</span></>}
          {driver && <><span>·</span><span style={{ color: C.saffronDeep, fontWeight: 600 }}>🛵 {driver.name}</span></>}
          <span>·</span><span className="mono-font">{timeAgo(at)}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="display-font mono-font" style={{ fontSize: 17, fontWeight: 800, color: C.saffronDeep, letterSpacing: '-.02em' }}>
          {formatShort(order.total)}
        </div>
        <div style={{ fontSize: 9, color: C.inkLight, fontWeight: 700, letterSpacing: '.05em' }}>
          {(order.currency || currency).toUpperCase()}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {stage === 'pending_payment' && (
          <button onClick={() => onSetStage('paid')} className="icon-btn emerald" title="Marquer payée">
            <CheckCircle2 size={14} />
          </button>
        )}
        {stage === 'paid' && (
          <button onClick={() => onSetStage('preparing')} className="icon-btn" style={{ background: C.cyanSoft, color: C.cyanDeep }} title="Préparer">
            <Package size={14} />
          </button>
        )}
        {stage === 'preparing' && (
          <button onClick={() => onSetStage('shipping')} className="icon-btn indigo" title="Expédier">
            <Truck size={14} />
          </button>
        )}
        {stage === 'shipping' && (
          <button onClick={() => onSetStage('delivered')} className="icon-btn emerald" title="Livrée">
            <BadgeCheck size={14} />
          </button>
        )}
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

// ════════════════════════════════════════════════════════════════════
// POS TAB — caisse tactile
// ════════════════════════════════════════════════════════════════════
interface CartItem { productId: string; name: string; qty: number; unitPrice: number }
function PosTab({ products, promotions, currency, storeId, recentSales, onCompleted }: {
  products: Product[]; promotions: Promotion[]; currency: string; storeId: string;
  recentSales: PosSale[]; onCompleted: () => void;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'wave' | 'card' | 'orange_money' | 'mtn_money'>('cash');
  const [promoCode, setPromoCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeProducts = products.filter(p => p.status === 'active' && p.stockQty > 0);
  const filtered = search
    ? activeProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase()))
    : activeProducts.slice(0, 16);

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  const matchingPromo = promotions.find(p => p.status === 'active' && p.code === promoCode.trim().toUpperCase());
  const discount = matchingPromo
    ? matchingPromo.type === 'percent'
      ? subtotal * matchingPromo.discount / 100
      : matchingPromo.discount
    : 0;
  const total = Math.max(0, subtotal - discount);

  const addToCart = (p: Product) => {
    setCart(c => {
      const exists = c.find(i => i.productId === p.id);
      if (exists) return c.map(i => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { productId: p.id, name: p.name, qty: 1, unitPrice: p.price }];
    });
  };
  const setQty = (productId: string, qty: number) => {
    if (qty <= 0) setCart(c => c.filter(i => i.productId !== productId));
    else setCart(c => c.map(i => i.productId === productId ? { ...i, qty } : i));
  };
  const clear = () => { setCart([]); setCustomerName(''); setCustomerPhone(''); setPromoCode(''); };

  const submit = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/commerce/stores/${storeId}/pos-sales`, {
        items: cart, total, paymentMethod,
        customerName, customerPhone,
        discountCode: matchingPromo?.code, discountAmount: discount,
      });
      toast.success('Vente enregistrée', `${formatPrice(total, currency)}`);
      clear();
      onCompleted();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="map-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(28,20,16,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: 200,
            background: C.creamDeep, borderRadius: 10, padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Search size={14} color={C.inkSoft} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un produit ou SKU…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: C.ink, fontFamily: 'inherit', minWidth: 0 }} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.inkSoft }}>
            <Package size={36} color={C.inkLight} style={{ marginBottom: 10 }} />
            <div>Aucun produit actif</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {filtered.map(p => {
              const image = p.primaryImageUrl || p.imageUrl || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : undefined);
              return (
                <button key={p.id} onClick={() => addToCart(p)} className="card-lift" style={{
                  background: C.cream, border: '1.5px solid rgba(28,20,16,.06)',
                  borderRadius: 12, padding: 0, cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left', overflow: 'hidden',
                }}>
                  <div style={{
                    height: 100, background: image ? `#000 url(${image}) center/cover` : gradientFor(p.id),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!image && <Package size={28} color="rgba(255,250,240,.4)" />}
                  </div>
                  <div style={{ padding: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>
                      {p.name}
                    </div>
                    <div className="mono-font" style={{ fontSize: 13, fontWeight: 800, color: C.saffronDeep, marginTop: 4 }}>
                      {formatShort(p.price)}
                    </div>
                    <div style={{ fontSize: 9, color: C.inkLight }}>{p.stockQty} en stock</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(28,20,16,.06)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <ShoppingCart size={16} color={C.saffronDeep} />
          <span className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>
            Panier ({cart.length})
          </span>
          {cart.length > 0 && (
            <button onClick={clear} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: C.inkSoft, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
              Vider
            </button>
          )}
        </div>
        <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', minHeight: 200, maxHeight: 360 }}>
          {cart.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: C.inkLight, fontSize: 12 }}>
              Clique sur un produit pour l'ajouter
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cart.map(i => (
                <div key={i.productId} style={{
                  background: C.creamDeep, borderRadius: 10, padding: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</div>
                    <div className="mono-font" style={{ fontSize: 10, color: C.inkSoft }}>{formatShort(i.unitPrice)} × {i.qty}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => setQty(i.productId, i.qty - 1)} className="icon-btn ghost" style={{ width: 26, height: 26 }}>−</button>
                    <span className="mono-font" style={{ minWidth: 24, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>{i.qty}</span>
                    <button onClick={() => setQty(i.productId, i.qty + 1)} className="icon-btn ghost" style={{ width: 26, height: 26 }}>+</button>
                  </div>
                  <div className="mono-font" style={{ fontSize: 12, fontWeight: 800, color: C.saffronDeep, minWidth: 60, textAlign: 'right' }}>
                    {formatShort(i.unitPrice * i.qty)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(28,20,16,.08)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Code promo"
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${C.creamDeep}`, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
                {matchingPromo && (
                  <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDark, fontSize: 10, fontWeight: 800 }}>
                    −{matchingPromo.type === 'percent' ? `${matchingPromo.discount}%` : formatShort(matchingPromo.discount)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                {(['cash', 'mobile_money', 'wave', 'orange_money', 'mtn_money', 'card'] as const).map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)} style={{
                    flex: '1 1 auto', padding: '7px 10px', borderRadius: 8,
                    background: paymentMethod === m ? C.saffronDeep : C.creamDeep,
                    color: paymentMethod === m ? C.cream : C.ink,
                    border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{PAYMENT_LABELS[m]}</button>
                ))}
              </div>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nom client (optionnel)"
                style={{ width: '100%', marginBottom: 6, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${C.creamDeep}`, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Téléphone (optionnel)"
                style={{ width: '100%', marginBottom: 10, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${C.creamDeep}`, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.inkSoft }}>Sous-total</span>
                <span className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{formatPrice(subtotal, currency)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.emeraldDark }}>Remise</span>
                  <span className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.emeraldDark }}>−{formatPrice(discount, currency)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span className="display-font" style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Total</span>
                <span className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.saffronDeep }}>{formatPrice(total, currency)}</span>
              </div>
              <button onClick={submit} disabled={submitting} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                {submitting ? <><Loader2 size={14} className="spin" /> Encaissement…</> : <><Receipt size={14} /> Encaisser {formatShort(total)}</>}
              </button>
            </div>
          </>
        )}

        {recentSales.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(28,20,16,.06)' }}>
            <div className="mono-font" style={{ fontSize: 9, fontWeight: 800, color: C.inkSoft, letterSpacing: '.1em', marginBottom: 6 }}>
              VENTES RÉCENTES
            </div>
            {recentSales.slice(0, 3).map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 11 }}>
                <span className="mono-font" style={{ color: C.inkSoft }}>{s.saleNumber} · {timeAgo(getTimestamp(s.createdAt))}</span>
                <span className="mono-font" style={{ fontWeight: 700, color: C.saffronDeep }}>{formatShort(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// STOCK TAB
// ════════════════════════════════════════════════════════════════════
function StockTab({ products, currency, onSelectProduct }: { products: Product[]; currency: string; onSelectProduct: (p: Product) => void }) {
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('low');
  const filtered = products.filter(p => {
    if (p.status === 'archived') return false;
    const threshold = p.lowStockThreshold ?? 5;
    if (filter === 'out') return p.stockQty === 0;
    if (filter === 'low') return p.stockQty <= threshold;
    return true;
  }).sort((a, b) => a.stockQty - b.stockQty);

  const stats = [
    { id: 'out', label: 'Rupture', value: products.filter(p => p.status !== 'archived' && p.stockQty === 0).length, icon: AlertTriangle, color: 'coral' as const },
    { id: 'low', label: 'Stock bas', value: products.filter(p => p.status !== 'archived' && p.stockQty > 0 && p.stockQty <= (p.lowStockThreshold ?? 5)).length, icon: Boxes, color: 'gold' as const },
    { id: 'total', label: 'Total références', value: products.filter(p => p.status !== 'archived').length, icon: Package, color: 'saffron' as const },
    { id: 'units', label: 'Unités en stock', value: products.filter(p => p.status !== 'archived').reduce((s, p) => s + p.stockQty, 0), icon: Boxes, color: 'emerald' as const },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {stats.map(s => {
          const cs = colorVar(s.color);
          const Icon = s.icon;
          return (
            <div key={s.id} className="card-lift" style={{
              background: C.cream, borderRadius: 14, padding: 14,
              border: '1px solid rgba(28,20,16,.06)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${cs.main}, ${cs.deep})` }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: cs.soft, color: cs.deep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} />
                </div>
                <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{s.value}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        background: C.cream, borderRadius: 14, padding: 14,
        border: '1px solid rgba(28,20,16,.06)',
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>
        {([
          { id: 'low' as const,  label: 'Stock bas + rupture', color: C.coral },
          { id: 'out' as const,  label: 'Rupture uniquement',  color: C.red },
          { id: 'all' as const,  label: 'Tout',                color: C.saffron },
        ]).map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'transparent',
              color: active ? C.cream : C.inkSoft,
              padding: '7px 12px', borderRadius: 100,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(28,20,16,.1)',
              fontFamily: 'inherit',
            }}>{f.label}</button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Tout est en stock"
          desc={filter === 'out' ? 'Aucun produit en rupture.' : 'Aucun produit en stock bas.'} />
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => {
            const threshold = p.lowStockThreshold ?? 5;
            const isOut = p.stockQty === 0;
            const accent = isOut ? C.red : C.coral;
            return (
              <div key={p.id} onClick={() => onSelectProduct(p)} className="card-lift" style={{
                background: C.cream, borderRadius: 12, padding: 14,
                border: '1px solid rgba(28,20,16,.06)',
                borderLeft: `4px solid ${accent}`,
                display: 'flex', alignItems: 'center', gap: 14,
                cursor: 'pointer',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 10, flexShrink: 0,
                  background: p.imageUrl ? `#000 url(${p.imageUrl}) center/cover` : gradientFor(p.id),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!p.imageUrl && <Package size={22} color="rgba(255,250,240,.6)" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                    {p.sku && <><span className="mono-font">{p.sku}</span> · </>}
                    Prix : {formatShort(p.price)} {(p.currency || currency).toUpperCase()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono-font" style={{ fontSize: 22, fontWeight: 800, color: isOut ? C.red : C.coralDeep }}>
                    {p.stockQty}
                  </div>
                  <div style={{ fontSize: 9, color: C.inkLight, fontWeight: 700, letterSpacing: '.05em' }}>
                    SEUIL {threshold}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onSelectProduct(p); }} className="btn-secondary" style={{ padding: '7px 12px', fontSize: 11 }}>
                  <Plus size={11} /> Réappro
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PROMOTIONS TAB
// ════════════════════════════════════════════════════════════════════
function PromotionsTab({ promotions, onAdd, onSelectPromo }: { promotions: Promotion[]; onAdd: () => void; onSelectPromo: (p: Promotion) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: C.cream, borderRadius: 14, padding: 16,
        border: '1px solid rgba(28,20,16,.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div className="pill" style={{ background: C.saffronSoft, color: C.saffronDeep, fontWeight: 700, marginBottom: 4, fontSize: 10 }}>
            <Percent size={11} /> CODES PROMO · {promotions.length}
          </div>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
            Tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.saffronDeep }}>codes promo</em>
          </h3>
        </div>
        <button onClick={onAdd} className="btn-primary"><Plus size={13} /> Créer un code</button>
      </div>

      {promotions.length === 0 ? (
        <EmptyState icon={Percent} title="Aucun code promo"
          desc="Crée des codes (%, montant fixe) pour booster tes ventes. Limite usages, expiration, conditions."
          cta="Créer mon 1er code" onAction={onAdd} />
      ) : (
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {promotions.map(p => {
            const usesPct = p.maxUses ? Math.min(100, (p.uses / p.maxUses) * 100) : 0;
            const expired = p.expiresAt ? new Date(p.expiresAt) < new Date() : false;
            return (
              <div key={p.id} onClick={() => onSelectPromo(p)} className="card-lift" style={{
                background: C.cream, borderRadius: 14, padding: 16,
                border: `1.5px dashed ${p.status === 'active' && !expired ? C.saffron : C.inkLight}`,
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div className="mono-font" style={{ fontSize: 17, fontWeight: 800, color: C.saffronDeep, letterSpacing: '.05em' }}>
                      {p.code}
                    </div>
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{p.name}</div>
                  </div>
                  <div className="display-font" style={{
                    fontSize: 22, fontWeight: 800, color: C.saffron, letterSpacing: '-.02em',
                  }}>
                    {p.type === 'percent' ? `${p.discount}%` : `${formatShort(p.discount)}`}
                  </div>
                </div>
                {p.conditions && (
                  <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 8, fontStyle: 'italic' }}>{p.conditions}</div>
                )}
                {p.maxUses && (
                  <div>
                    <div style={{ height: 6, background: C.creamDeep, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ height: '100%', width: `${usesPct}%`, background: `linear-gradient(90deg, ${C.saffron}, ${C.saffronDeep})` }}></div>
                    </div>
                    <div style={{ fontSize: 10, color: C.inkLight }}>
                      {p.uses} / {p.maxUses} usages
                    </div>
                  </div>
                )}
                {!p.maxUses && p.uses > 0 && (
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{p.uses} usages</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(28,20,16,.08)' }}>
                  <span className="pill" style={{
                    background: expired ? C.creamDeep : p.status === 'active' ? C.emeraldSoft : C.goldSoft,
                    color: expired ? C.inkSoft : p.status === 'active' ? C.emeraldDark : C.goldDark,
                    fontSize: 9, fontWeight: 800,
                  }}>
                    {expired ? 'Expiré' : p.status === 'active' ? '● Actif' : p.status === 'scheduled' ? 'Planifié' : 'Pause'}
                  </span>
                  {p.expiresAt && (
                    <span style={{ fontSize: 10, color: C.inkLight }}>
                      Jusqu'au {new Date(p.expiresAt).toLocaleDateString('fr-FR')}
                    </span>
                  )}
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
// CLIENTS TAB
// ════════════════════════════════════════════════════════════════════
function ClientsTab({ customers }: { customers: Customer[] }) {
  const stages: Array<{ id: Customer['stage']; label: string; color: string; icon: any }> = [
    { id: 'new',       label: 'Nouveaux',      color: C.cyan,    icon: Sparkles },
    { id: 'returning', label: 'Récurrents',    color: C.saffron, icon: RefreshCw },
    { id: 'loyal',     label: 'Fidèles (5+)',  color: C.gold,    icon: Star },
    { id: 'vip',       label: 'VIP (500k+)',   color: C.violet,  icon: Trophy },
    { id: 'lost',      label: 'Perdus (90j+)', color: C.inkSoft, icon: X },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: C.cream, borderRadius: 14, padding: 16,
        border: '1px solid rgba(28,20,16,.06)',
      }}>
        <div className="pill" style={{ background: C.saffronSoft, color: C.saffronDeep, fontSize: 10, marginBottom: 4 }}>
          <Users size={11} /> PIPELINE · {customers.length} CLIENT{customers.length > 1 ? 'S' : ''}
        </div>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
          Pipeline <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.saffronDeep }}>commercial</em>
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '4px 0 0' }}>
          Dérivé automatiquement des commandes. Stage = ancienneté + récurrence + panier total.
        </p>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={Users} title="Pas encore de client"
          desc="Tes clients apparaissent ici dès la 1re commande passée." />
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
                    <div key={c.phone} style={{
                      background: C.creamDeep, borderRadius: 10, padding: 10,
                      border: '1px solid rgba(28,20,16,.04)',
                    }}>
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
                        <span>{c.orders} commande{c.orders > 1 ? 's' : ''}</span>
                        <span className="mono-font" style={{ fontWeight: 700, color: C.saffronDeep }}>{formatShort(c.totalSpent)}</span>
                      </div>
                      <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                        style={{ textDecoration: 'none', display: 'block' }}>
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

// ════════════════════════════════════════════════════════════════════
// WHATSAPP TAB
// ════════════════════════════════════════════════════════════════════
function WhatsAppTab({ threads, connected, onRefresh }: { threads: WaThread[]; connected: boolean; onRefresh: () => void }) {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(threads[0]?.phone ?? null);
  const selected = threads.find(t => t.phone === selectedPhone) ?? threads[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: C.cream, borderRadius: 14, padding: 14,
        border: '1px solid rgba(28,20,16,.06)',
      }}>
        <div className="pill" style={{
          background: connected ? `${C.whatsapp}15` : C.creamDeep,
          color: connected ? C.whatsappDark : C.inkSoft,
          fontSize: 10, fontWeight: 700, marginBottom: 4,
        }}>
          {connected ? <><span className="live-dot" style={{ width: 6, height: 6, color: C.whatsapp }}></span> WHATSAPP CONNECTÉ</> : <>● NON CONNECTÉ</>}
        </div>
        <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0 }}>
          Messages <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.whatsappDark }}>de ta boutique</em>
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
          Conversations entrantes · {threads.length} thread{threads.length > 1 ? 's' : ''}. Paramètres globaux dans <a href="/admin/whatsapp" style={{ color: C.saffronDeep, fontWeight: 600, textDecoration: 'none' }}>Admin · WhatsApp</a>.
        </p>
      </div>

      {threads.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60,
          background: C.cream, borderRadius: 14,
          border: '1px dashed rgba(28,20,16,.15)',
        }}>
          <MessageCircle size={48} color={C.whatsapp} style={{ marginBottom: 12, opacity: .7 }} />
          <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>
            {connected ? 'Pas encore de message' : 'WhatsApp non connecté'}
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            {connected
              ? "Dès qu'un client t'écrit, sa conversation apparaît ici."
              : "Connecte WhatsApp Business pour recevoir et répondre aux clients."}
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
                  padding: '12px 16px', borderBottom: '1px solid rgba(28,20,16,.04)',
                  cursor: 'pointer',
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

// ════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ════════════════════════════════════════════════════════════════════
function EmptyState({ icon: Icon, title, desc, cta, onAction }: {
  icon: any; title: string; desc: string; cta?: string; onAction?: () => void;
}) {
  return (
    <div style={{
      textAlign: 'center', padding: 60,
      background: C.cream, borderRadius: 14,
      border: '1px dashed rgba(28,20,16,.15)',
    }}>
      <Icon size={48} color={C.saffron} style={{ marginBottom: 12, opacity: .7 }} />
      <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>{title}</h3>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>{desc}</p>
      {cta && onAction && (
        <button onClick={onAction} className="btn-primary"><Plus size={14} /> {cta}</button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PRODUCT MODAL
// ════════════════════════════════════════════════════════════════════
function ProductModal({ storeId, currency, product, onClose, onSaved, onDeleted }: {
  storeId: string; currency: string; product?: Product;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState<number | ''>(product?.price ?? '');
  const [comparePrice, setComparePrice] = useState<number | ''>(product?.comparePrice ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [stockQty, setStockQty] = useState<number | ''>(product?.stockQty ?? 0);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | ''>(product?.lowStockThreshold ?? 5);
  const [status, setStatus] = useState<Product['status']>(product?.status ?? 'active');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialGalleryUrls = Array.isArray(product?.imageUrls) && product!.imageUrls!.length > 0
    ? product!.imageUrls!
    : (product?.imageUrl ? [product.imageUrl] : []);

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
      comparePrice: typeof comparePrice === 'number' ? comparePrice : undefined,
      sku: sku.trim(),
      category: category.trim(),
      description: description.trim(),
      stockQty: typeof stockQty === 'number' ? stockQty : 0,
      lowStockThreshold: typeof lowStockThreshold === 'number' ? lowStockThreshold : 5,
      status,
      ...(imageBase64 ? { imageBase64, imageMimeType } : {}),
    };
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/products/${product!.id}`, payload);
        toast.success('Produit mis à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/products`, payload);
        toast.success('Produit ajouté');
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/products/${product!.id}`);
      toast.success('Produit supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={isEdit ? 'Modifier le produit' : 'Nouveau produit'} color={C.saffronDeep} onClose={onClose}>
      {isEdit ? (
        <div style={{ marginBottom: 14 }}>
          <Label>Photos du produit (max 6)</Label>
          <MultiPhotoEditor
            basePath={`/commerce/stores/${storeId}/products/${product!.id}`}
            initialUrls={initialGalleryUrls}
            initialPrimary={product?.primaryImageUrl ?? product?.imageUrl ?? null}
            accentColor={C.saffron}
            accentDeep={C.saffronDeep}
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
                style={{ position: 'absolute', top: 8, right: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(28,20,16,.8)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Camera size={11} /> Remplacer
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', padding: '20px 14px', borderRadius: 12, background: C.creamDeep, color: C.saffronDeep, border: `1.5px dashed ${C.saffron}`, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Camera size={22} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Choisir une photo</span>
            </button>
          )}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <Label>Nom du produit</Label>
        <Input value={name} onChange={setName} placeholder="Robe wax Adjoa…" autoFocus />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <Label>Prix ({currency})</Label>
          <Input type="number" value={String(price ?? '')} onChange={v => setPrice(v === '' ? '' : parseInt(v))} placeholder="50000" mono />
        </div>
        <div>
          <Label>Prix barré (avant promo)</Label>
          <Input type="number" value={String(comparePrice ?? '')} onChange={v => setComparePrice(v === '' ? '' : parseInt(v))} placeholder="80000" mono />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <Label>SKU (code interne)</Label>
          <Input value={sku} onChange={setSku} placeholder="WAX-001" mono />
        </div>
        <div>
          <Label>Catégorie</Label>
          <Input value={category} onChange={setCategory} placeholder="Mode Femme, Accessoires…" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <Label>Stock (qté)</Label>
          <Input type="number" value={String(stockQty ?? '')} onChange={v => setStockQty(v === '' ? '' : parseInt(v))} mono />
        </div>
        <div>
          <Label>Seuil alerte stock bas</Label>
          <Input type="number" value={String(lowStockThreshold ?? '')} onChange={v => setLowStockThreshold(v === '' ? '' : parseInt(v))} mono />
        </div>
      </div>

      {isEdit && (
        <div style={{ marginBottom: 12 }}>
          <Label>Statut</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['active', 'draft', 'out_of_stock', 'archived'] as const).map(s => {
              const sel = status === s;
              const col = s === 'active' ? C.emeraldDeep : s === 'draft' ? C.inkSoft : s === 'out_of_stock' ? C.red : C.ink;
              const label = s === 'active' ? 'Actif' : s === 'draft' ? 'Brouillon' : s === 'out_of_stock' ? 'Rupture' : 'Archivé';
              return (
                <button key={s} type="button" onClick={() => setStatus(s)} style={{
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

      <div style={{ marginBottom: 18 }}>
        <Label>Description</Label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Robe longue en wax authentique, coupe ajustée, motif géométrique…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>

      {isEdit && confirmDelete && (
        <div style={{ padding: 14, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>
            Supprimer définitivement <em>{product!.name}</em> ?
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
// PROMOTION MODAL
// ════════════════════════════════════════════════════════════════════
function PromotionModal({ storeId, promotion, onClose, onSaved, onDeleted }: {
  storeId: string; promotion?: Promotion;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!promotion;
  const [code, setCode] = useState(promotion?.code ?? '');
  const [name, setName] = useState(promotion?.name ?? '');
  const [discount, setDiscount] = useState<number | ''>(promotion?.discount ?? '');
  const [type, setType] = useState<'percent' | 'amount'>(promotion?.type ?? 'percent');
  const [maxUses, setMaxUses] = useState<number | ''>(promotion?.maxUses ?? '');
  const [conditions, setConditions] = useState(promotion?.conditions ?? '');
  const [expiresAt, setExpiresAt] = useState(promotion?.expiresAt ? promotion.expiresAt.slice(0, 10) : '');
  const [status, setStatus] = useState<Promotion['status']>(promotion?.status ?? 'active');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = code.trim().length >= 2 && name.trim().length >= 2 && typeof discount === 'number' && discount > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      discount, type,
      maxUses: typeof maxUses === 'number' ? maxUses : null,
      conditions: conditions.trim(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      status,
    };
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/promotions/${promotion!.id}`, payload);
        toast.success('Code promo mis à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/promotions`, payload);
        toast.success('Code promo créé', code.trim().toUpperCase());
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/promotions/${promotion!.id}`);
      toast.success('Code promo supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={isEdit ? 'Modifier le code promo' : 'Nouveau code promo'} color={C.saffronDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Code</Label><Input value={code} onChange={v => setCode(v.toUpperCase())} placeholder="AKWABA20" mono autoFocus /></div>
        <div><Label>Nom interne</Label><Input value={name} onChange={setName} placeholder="Code de bienvenue" /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <Label>Réduction</Label>
          <Input type="number" value={String(discount ?? '')} onChange={v => setDiscount(v === '' ? '' : parseInt(v))} placeholder={type === 'percent' ? '20' : '10000'} mono />
        </div>
        <div>
          <Label>Type</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['percent', 'amount'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)} style={{
                flex: 1, padding: '10px 12px', borderRadius: 10,
                background: type === t ? C.saffronDeep : 'transparent',
                color: type === t ? '#fff' : C.inkSoft,
                border: `1.5px solid ${type === t ? 'transparent' : C.inkLight + '50'}`,
                cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              }}>{t === 'percent' ? '%' : 'Montant'}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Max usages (vide = illimité)</Label><Input type="number" value={String(maxUses ?? '')} onChange={v => setMaxUses(v === '' ? '' : parseInt(v))} placeholder="200" mono /></div>
        <div><Label>Expire le (vide = permanent)</Label><Input type="date" value={expiresAt} onChange={setExpiresAt} /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Conditions</Label>
        <Input value={conditions} onChange={setConditions} placeholder="Min. de panier, nouveaux clients…" />
      </div>
      <div style={{ marginBottom: 18 }}>
        <Label>Statut</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['active', 'scheduled', 'paused', 'expired'] as const).map(s => {
            const sel = status === s;
            const col = s === 'active' ? C.emeraldDeep : s === 'scheduled' ? C.indigo : s === 'paused' ? C.goldDark : C.inkSoft;
            const label = s === 'active' ? 'Actif' : s === 'scheduled' ? 'Planifié' : s === 'paused' ? 'Pause' : 'Expiré';
            return (
              <button key={s} type="button" onClick={() => setStatus(s)} style={{
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
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        {isEdit ? (
          <button onClick={remove} disabled={submitting} style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: '#DC2626', border: '1.5px solid #FCA5A5', cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}>
            <Trash2 size={12} /> Supprimer
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={submit} disabled={!canSubmit} className="btn-primary">
            {submitting ? <><Loader2 size={14} className="spin" /> …</> : (isEdit ? <><Save size={14} /> Enregistrer</> : <><Plus size={14} /> Créer</>)}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// DRIVER MODAL
// ════════════════════════════════════════════════════════════════════
function DriverModal({ storeId, driver, onClose, onSaved, onDeleted }: {
  storeId: string; driver?: Driver;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!driver;
  const [name, setName] = useState(driver?.name ?? '');
  const [phone, setPhone] = useState(driver?.phone ?? '');
  const [vehicle, setVehicle] = useState<Driver['vehicle']>(driver?.vehicle ?? 'moto');
  const [zone, setZone] = useState(driver?.zone ?? '');
  const [available, setAvailable] = useState<boolean>(driver?.available ?? true);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length >= 2 && phone.trim().length >= 6 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = { name: name.trim(), phone: phone.trim(), vehicle, zone: zone.trim(), available };
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/drivers/${driver!.id}`, payload);
        toast.success('Livreur mis à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/drivers`, payload);
        toast.success('Livreur ajouté');
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/drivers/${driver!.id}`);
      toast.success('Livreur supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={isEdit ? 'Modifier le livreur' : 'Nouveau livreur'} color={C.saffronDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Nom</Label><Input value={name} onChange={setName} placeholder="Yves Kouassi" autoFocus /></div>
        <div><Label>Téléphone</Label><Input value={phone} onChange={setPhone} placeholder="+XXX XX XX XX XX" /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Véhicule</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            ['moto', '🛵 Moto'],
            ['voiture', '🚗 Voiture'],
            ['velo', '🚲 Vélo'],
            ['pied', '🚶 À pied'],
          ] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setVehicle(v)} style={{
              padding: '7px 14px', borderRadius: 100,
              background: vehicle === v ? C.saffronDeep : 'transparent',
              color: vehicle === v ? '#fff' : C.inkSoft,
              border: `1.5px solid ${vehicle === v ? 'transparent' : C.inkLight + '50'}`,
              cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Zone de livraison</Label>
        <Input value={zone} onChange={setZone} placeholder="Quartier(s) couvert(s)" />
      </div>
      <div style={{ marginBottom: 18 }}>
        <button type="button" onClick={() => setAvailable(!available)} style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: available ? `${C.emerald}10` : '#fff',
          border: `1.5px solid ${available ? C.emerald : C.creamDeep}`,
          color: available ? C.emeraldDark : C.inkSoft,
          fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Disponible maintenant ?</span>
          <span>{available ? '✓ oui' : 'non'}</span>
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        {isEdit ? (
          <button onClick={remove} disabled={submitting} style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: '#DC2626', border: '1.5px solid #FCA5A5', cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}>
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

// ════════════════════════════════════════════════════════════════════
// ORDER DETAIL MODAL
// ════════════════════════════════════════════════════════════════════
function OrderDetailModal({ order, drivers, storeId, currency, onClose, onChanged }: {
  order: Order; drivers: Driver[]; storeId: string; currency: string;
  onClose: () => void; onChanged: () => void;
}) {
  const [driverId, setDriverId] = useState(order.driverId ?? '');
  const [submitting, setSubmitting] = useState(false);

  const stage = orderStage(order);
  const cfg = STAGE_CONFIG[stage];

  const assignDriver = async () => {
    setSubmitting(true);
    try {
      const driver = drivers.find(d => d.id === driverId);
      await api.patch(`/commerce/stores/${storeId}/orders/${order.id}`, {
        driverId: driverId || null,
        driverName: driver?.name ?? null,
      });
      toast.success(driver ? `Assignée à ${driver.name}` : 'Livreur retiré');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={`Commande ${order.orderNumber || `#${order.id.slice(-6)}`}`} color={cfg.color} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Label>Client</Label>
        <div style={{ padding: 12, borderRadius: 10, background: C.creamDeep }}>
          <div style={{ fontWeight: 700, color: C.ink }}>{order.customerName}</div>
          <div style={{ fontSize: 11, color: C.inkSoft, fontFamily: 'JetBrains Mono' }}>{order.customerPhone}</div>
          {order.deliveryAddress && (
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}><MapPin size={10} style={{ display: 'inline' }} /> {order.deliveryAddress}</div>
          )}
        </div>
      </div>

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
              <span className="display-font mono-font" style={{ fontSize: 16, fontWeight: 800, color: C.saffronDeep }}>{formatPrice(order.total, currency)}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <Label>Livreur assigné</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={driverId} onChange={e => setDriverId(e.target.value)}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
            <option value="">— Aucun —</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id} disabled={!d.available && d.id !== order.driverId}>
                {d.name} ({d.vehicle}{d.zone ? ` · ${d.zone}` : ''}){d.available ? '' : ' · indispo'}
              </option>
            ))}
          </select>
          <button onClick={assignDriver} disabled={submitting} className="btn-primary" style={{ padding: '10px 16px' }}>
            <Save size={13} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn-ghost">Fermer</button>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════
// STORE SETTINGS MODAL
// ════════════════════════════════════════════════════════════════════
function StoreSettingsModal({ store, onClose, onSaved, onManageDrivers }: {
  store: Store; onClose: () => void; onSaved: () => void; onManageDrivers: () => void;
}) {
  const [name, setName] = useState(store.name);
  const [ownerPhone, setOwnerPhone] = useState(store.ownerPhone);
  const [paymentInstructions, setPaymentInstructions] = useState(store.paymentInstructions ?? '');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/commerce/stores/${store.id}`, {
        name: name.trim(), ownerPhone: ownerPhone.trim(),
        paymentInstructions: paymentInstructions.trim(),
      });
      toast.success('Boutique mise à jour');
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Paramètres boutique" color={C.saffronDeep} onClose={onClose}>
      <div style={{ marginBottom: 12 }}><Label>Nom</Label><Input value={name} onChange={setName} /></div>
      <div style={{ marginBottom: 12 }}><Label>Numéro WhatsApp</Label><Input value={ownerPhone} onChange={setOwnerPhone} /></div>
      <div style={{ marginBottom: 14 }}>
        <Label>Instructions paiement</Label>
        <textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} rows={3}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      <button onClick={onManageDrivers} style={{
        width: '100%', marginBottom: 14, padding: '10px 12px', borderRadius: 10,
        background: C.creamDeep, color: C.saffronDeep, border: `1.5px solid ${C.saffron}`,
        cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span><Bike size={13} style={{ display: 'inline', marginRight: 6 }} /> Gérer les livreurs</span>
        <ArrowRight size={13} />
      </button>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn-ghost">Annuler</button>
        <button onClick={submit} disabled={submitting} className="btn-primary">
          {submitting ? <><Loader2 size={14} className="spin" /> …</> : <><Save size={14} /> Enregistrer</>}
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
