/**
 * Résidence Pack — Sapphire Hospitality redesign.
 * Pitch: "Gère ta résidence et tes séjours — depuis WhatsApp."
 *
 * Modèle : 1 store = 1 résidence (bâtiment) avec N unités (studios/F2/F3/suites).
 * Tarification : nuit + semaine + mois (long-stay).
 *
 * 6 onglets, branchés zéro mock :
 *   - Dashboard    · KPIs + arrivées/départs + occupation par étage + leads WA
 *   - Calendrier   · grille planning (chambres × jours) sur 14 jours
 *   - Chambres     · CRUD unités avec types studio/f2/f3/f4/duplex/loft/suite
 *   - Réservations · séjours multi-nuits
 *   - Clients      · CRM Kanban dérivé des résa
 *   - WhatsApp     · inbox conversations
 *
 * Palette : Sapphire (bleu nuit) + Or laiton.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  BedDouble, Calendar, Plus, Loader2, X, Save, Trash2, Edit3,
  Sparkles, MessageCircle, Settings, Camera, RefreshCw, Send,
  LayoutDashboard, TrendingUp, Banknote, Users, Clock,
  CheckCircle2, BadgeCheck, Search, Compass, ChevronLeft, ChevronRight,
  Phone, Trophy, Star, RefreshCcw,
} from 'lucide-react';
import { StoreSettingsModal } from '@/components/store/StoreSettingsModal';
import VoiceAssistantFAB from '@/components/ai/VoiceAssistantFAB';
import { InboxTab } from '@/components/inbox/InboxTab';
import { StoreHeroBranding, WhatsAppQuickButton, resolveAccent } from '@/components/store/StoreHeroBranding';

const C = {
  greenDeep:'#0A4F3C', greenDark:'#063D2E', greenInk:'#042A1F',
  cream:'#FFFAF0', creamDeep:'#F5EDD6', creamWarm:'#FAEBD7',
  sapphire:'#0F3460', sapphireDeep:'#082145', sapphireDark:'#04132A',
  sapphireSoft:'#DBEAFE', sapphireMid:'#1E3A8A',
  gold:'#D4A017', goldDeep:'#B8860B', goldDark:'#8B6914', goldSoft:'#FEF3C7',
  emerald:'#10B981', emeraldDeep:'#059669', emeraldDark:'#065F46', emeraldSoft:'#D1FAE5',
  coral:'#FB7185', coralDeep:'#E11D48', coralSoft:'#FFE4E6',
  whatsapp:'#25D366', whatsappDark:'#128C7E', whatsappSoft:'#DCF8C6',
  violet:'#7C3AED', violetDeep:'#5B21B6', violetSoft:'#F3E8FF',
  red:'#EF4444', redSoft:'#FEE2E2', yellow:'#F59E0B', yellowSoft:'#FEF3C7',
  blue:'#0EA5E9', blueSoft:'#E0F2FE', blueDeep:'#0284C7',
  cyan:'#06B6D4', cyanSoft:'#CFFAFE', cyanDeep:'#0891B2',
  pink:'#EC4899',
  ink:'#0A2A20', inkSoft:'#5A6B62', inkLight:'#94A3A0', onGreenSoft:'#A8C9B8',
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
    background: linear-gradient(90deg, ${C.gold}, ${C.sapphireSoft}, ${C.gold}, ${C.sapphireSoft}, ${C.gold});
    background-size: 200% auto; background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent; animation: shimmer 4s linear infinite;
  }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: .02em; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.emerald}; position: relative; flex-shrink: 0; }
  .live-dot::after { content:''; position:absolute; inset:-4px; border-radius:50%; background: currentColor; opacity:.4; animation: pulse 1.8s ease-in-out infinite; }
  .btn-primary { background: linear-gradient(135deg, ${C.sapphire}, ${C.sapphireDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; box-shadow: 0 8px 24px -8px ${C.sapphire}; }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .btn-gold { background: linear-gradient(135deg, ${C.gold}, ${C.goldDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; }
  .btn-gold:hover:not(:disabled) { transform: translateY(-2px); }
  .btn-secondary { background: ${C.cream}; color: ${C.sapphireDeep}; border: 1.5px solid rgba(10,42,32,.1); padding: 10px 16px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .2s ease; font-family: inherit; }
  .btn-secondary:hover:not(:disabled) { background: ${C.sapphireDeep}; color: ${C.cream}; border-color: ${C.sapphireDeep}; }
  .btn-ghost { background: transparent; color: ${C.ink}; border: 1.5px solid ${C.inkLight}; padding: 9px 16px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; font-family: inherit; }
  .btn-ghost-light { background: rgba(255,250,240,.08); color: ${C.cream}; border: 1px solid rgba(255,250,240,.15); padding: 9px 14px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
  .btn-ghost-light:hover { background: ${C.cream}; color: ${C.sapphireDeep}; }
  .btn-whatsapp { background: linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; }
  .icon-btn { width: 34px; height: 34px; border-radius: 9px; background: ${C.sapphireSoft}; color: ${C.sapphireDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all .2s ease; flex-shrink: 0; }
  .icon-btn:hover { background: ${C.sapphireDeep}; color: ${C.cream}; }
  .icon-btn.gold { background: ${C.goldSoft}; color: ${C.goldDark}; }
  .icon-btn.emerald { background: ${C.emeraldSoft}; color: ${C.emeraldDark}; }
  .icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${C.sapphireDeep}; }
  .grain::before { content:''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: .06; pointer-events: none; mix-blend-mode: overlay; }
  .scroll-thin::-webkit-scrollbar { width: 6px; height: 6px; }
  .scroll-thin::-webkit-scrollbar-thumb { background: rgba(10,42,32,.15); border-radius: 100px; }
  @media (max-width: 1024px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .responsive-grid-3 { grid-template-columns: repeat(2, 1fr) !important; } .map-grid { grid-template-columns: 1fr !important; } }
  @media (max-width: 768px) { .responsive-grid-4 { grid-template-columns: 1fr !important; } .responsive-grid-3 { grid-template-columns: 1fr !important; } .hide-on-mobile { display: none !important; } .hero-title { font-size: 30px !important; } }
  @media (max-width: 480px) { .hero-pad { padding: 16px 18px !important; } .hero-title { font-size: 26px !important; } .pack-modal { max-width: 100% !important; margin: 6px !important; } .pack-modal-body { padding: 14px 16px !important; } .voice-fab, .pack-fab { bottom: max(20px, env(safe-area-inset-bottom)) !important; right: max(16px, env(safe-area-inset-right)) !important; } }
`;

interface Store { id: string; name: string; ownerPhone: string; currency: string; paymentInstructions?: string; }
type RoomType = 'studio' | 'f2' | 'f3' | 'f4' | 'duplex' | 'loft' | 'suite';
interface Room {
  id: string; number: string; name?: string;
  type: RoomType; capacity: number;
  pricePerNight: number; priceWeek?: number; priceMonth?: number;
  currency: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
  description?: string; imageUrl?: string; amenities?: string[]; floor?: number;
}
interface Reservation {
  id: string; customerName: string; customerPhone: string;
  date: string; time: string; checkOutDate?: string;
  partySize: number; nights?: number; notes?: string;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  roomId?: string; reason?: string; source?: string;
  createdAt?: { _seconds?: number } | string;
}
interface WaMessage {
  id: string; from?: string; to?: string;
  direction?: 'inbound' | 'outbound';
  body?: string; text?: string; message?: string;
  contactName?: string; customerName?: string;
  createdAt?: { _seconds?: number } | string;
}

type TabId = 'dashboard' | 'calendar' | 'chambres' | 'reservations' | 'clients' | 'whatsapp';

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  studio: 'Studio', f2: 'F2 (1 ch)', f3: 'F3 (2 ch)', f4: 'F4 (3 ch)',
  duplex: 'Duplex', loft: 'Loft', suite: 'Suite',
};

const ROOM_STATUS_CONFIG: Record<Room['status'], { label: string; color: string; bg: string; ink: string }> = {
  available:   { label: 'Disponible',  color: C.emerald,   bg: C.emeraldSoft, ink: C.emeraldDark },
  occupied:    { label: 'Occupée',     color: C.sapphire,  bg: C.sapphireSoft, ink: C.sapphireDeep },
  cleaning:    { label: 'Ménage',      color: C.gold,      bg: C.goldSoft, ink: C.goldDark },
  maintenance: { label: 'Maintenance', color: C.coralDeep, bg: C.coralSoft, ink: C.coralDeep },
};

const NO_DECIMAL = new Set(['XOF','XAF','JPY','GNF','KES','NGN','RWF','BIF','UGX']);
function formatPrice(n: number, currency = 'XOF'): string {
  const decimals = NO_DECIMAL.has(currency) ? 0 : 2;
  try { return new Intl.NumberFormat('fr-FR', { style:'currency', currency, minimumFractionDigits:decimals, maximumFractionDigits:decimals }).format(n); }
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
    `linear-gradient(135deg, ${C.sapphire} 0%, ${C.sapphireDeep} 50%, ${C.sapphireDark} 100%)`,
    `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDeep} 50%, ${C.goldDark} 100%)`,
    `linear-gradient(135deg, ${C.violet} 0%, ${C.violetDeep} 50%, #312E81 100%)`,
    `linear-gradient(135deg, ${C.cyanDeep} 0%, #0E7490 50%, #155E75 100%)`,
    `linear-gradient(135deg, ${C.emeraldDeep} 0%, ${C.emeraldDark} 50%, #042F2E 100%)`,
    `linear-gradient(135deg, ${C.coralDeep} 0%, #BE123C 50%, #881337 100%)`,
  ];
  let h = 0; for (let i = 0; i < id.length; i++) h = (h*31 + id.charCodeAt(i)) >>> 0;
  return g[h % g.length];
}
function colorVar(c: 'sapphire' | 'gold' | 'emerald' | 'coral' | 'violet') {
  const map = {
    sapphire: { main: C.sapphire, deep: C.sapphireDeep, soft: C.sapphireSoft },
    gold:     { main: C.gold,     deep: C.goldDeep,     soft: C.goldSoft },
    emerald:  { main: C.emerald,  deep: C.emeraldDeep,  soft: C.emeraldSoft },
    coral:    { main: C.coral,    deep: C.coralDeep,    soft: C.coralSoft },
    violet:   { main: C.violet,   deep: C.violetDeep,   soft: C.violetSoft },
  };
  return map[c];
}
function nightsBetween(checkIn: string, checkOut?: string): number {
  if (!checkOut) return 1;
  const a = new Date(checkIn), b = new Date(checkOut);
  return Math.max(1, Math.ceil((b.getTime()-a.getTime()) / 86_400_000));
}
function floorOf(room: Room): number {
  if (typeof room.floor === 'number') return room.floor;
  const m = room.number.match(/^(\d+)/);
  if (!m) return 0;
  const num = parseInt(m[1], 10);
  if (num >= 100) return Math.floor(num/100);
  return num >= 10 ? Math.floor(num/10) : 1;
}
function dateRange(start: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate()+i);
    return d.toISOString().slice(0, 10);
  });
}
function isDayBookedFor(room: Room, day: string, reservations: Reservation[]): Reservation | null {
  for (const r of reservations) {
    if (r.roomId !== room.id) continue;
    if (r.status === 'cancelled' || r.status === 'no_show') continue;
    const checkOut = r.checkOutDate ?? r.date;
    if (day >= r.date && day < checkOut) return r;
    if (day === r.date && day === checkOut) return r;
  }
  return null;
}

export default function ResidenceRedesignPage() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [store, setStore] = useState<Store | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waMessages, setWaMessages] = useState<WaMessage[]>([]);
  const [waConnected, setWaConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [addReservationOpen, setAddReservationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r1: any = await api.get('/commerce/stores', { params: { businessType: 'residence' } })
        .catch(() => ({ data: { stores: [] } }));
      const stores = (r1?.data?.stores ?? []) as Store[];
      const s = stores[0];
      if (!s) { setStore(null); setRooms([]); setReservations([]); setWaMessages([]); return; }
      setStore(s);
      const [r2, r3, r4, r5] = await Promise.all([
        api.get(`/commerce/stores/${s.id}/rooms`).catch(() => ({ data: { rooms: [] } })),
        api.get(`/commerce/stores/${s.id}/reservations`).catch(() => ({ data: { reservations: [] } })),
        api.get('/whatsapp/messages').catch(() => ({ data: { data: [] } })),
        api.get('/whatsapp/status').catch(() => ({ data: { data: { connected: false } } })),
      ]);
      setRooms((r2 as any)?.data?.rooms ?? []);
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

  const occupied = rooms.filter(r => r.status === 'occupied').length;
  const available = rooms.filter(r => r.status === 'available').length;
  const occupancyRate = rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0;
  const arrivalsToday = reservations.filter(r => r.date === today && r.status !== 'cancelled');
  const departuresToday = reservations.filter(r => r.checkOutDate === today && r.status !== 'cancelled');

  const customers = useMemo(() => deriveCustomers(reservations, rooms), [reservations, rooms]);
  const waThreads = useMemo(() => deriveWaThreads(waMessages), [waMessages]);

  if (loading && !store) {
    return (
      <div style={{ minHeight: '100vh', background: C.greenDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 size={32} className="spin" color={C.sapphire} />
      </div>
    );
  }
  if (!store) return <ResidenceActivationScreen onCreated={() => fetchAll()} />;

  const counts: Record<TabId, number | null> = {
    dashboard: null,
    calendar: null,
    chambres: rooms.length,
    reservations: reservations.filter(r => r.status !== 'cancelled' && r.date >= today).length,
    clients: customers.length,
    whatsapp: waThreads.filter(t => t.unread).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <HeroAdmin store={store}
          onAddRoom={() => setAddRoomOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)} />
        <TabStrip activeTab={tab} setActiveTab={setTab} counts={counts} />

        {tab === 'dashboard' && (
          <DashboardTab rooms={rooms} reservations={reservations}
            arrivalsToday={arrivalsToday} departuresToday={departuresToday}
            currency={currency} occupied={occupied} available={available}
            occupancyRate={occupancyRate} threads={waThreads}
            onSelectRoom={r => setEditingRoom(r)} />
        )}
        {tab === 'calendar' && (
          <CalendarTab rooms={rooms} reservations={reservations}
            onSelectRoom={r => setEditingRoom(r)} onAddReservation={() => setAddReservationOpen(true)} />
        )}
        {tab === 'chambres' && (
          <ChambresTab rooms={rooms} currency={currency}
            onSelectRoom={r => setEditingRoom(r)} onAdd={() => setAddRoomOpen(true)} />
        )}
        {tab === 'reservations' && (
          <ReservationsTab reservations={reservations} rooms={rooms} storeId={store.id} currency={currency}
            onAdd={() => setAddReservationOpen(true)} onChanged={() => fetchAll(true)} />
        )}
        {tab === 'clients' && <ClientsTab customers={customers} />}
        {tab === 'whatsapp' && (
          <InboxTab
            accent={C.sapphire} accentDeep={C.sapphireDeep}
            ink={C.ink} inkSoft={C.inkSoft} inkLight={C.inkLight}
            cream={C.cream} creamDeep={C.creamDeep}
            emptyHint="Dès qu'un voyageur écrit sur WhatsApp ou Telegram pour réserver, sa demande apparaît ici."
          />
        )}
      </div>

      {addRoomOpen && (
        <RoomModal storeId={store.id} currency={currency}
          onClose={() => setAddRoomOpen(false)}
          onSaved={() => { setAddRoomOpen(false); fetchAll(true); }} />
      )}
      {editingRoom && (
        <RoomModal storeId={store.id} currency={currency} room={editingRoom}
          onClose={() => setEditingRoom(null)}
          onSaved={() => { setEditingRoom(null); fetchAll(true); }}
          onDeleted={() => { setEditingRoom(null); fetchAll(true); }} />
      )}
      {addReservationOpen && (
        <ReservationModal storeId={store.id} rooms={rooms}
          onClose={() => setAddReservationOpen(false)}
          onCreated={() => { setAddReservationOpen(false); fetchAll(true); }} />
      )}
      {settingsOpen && (
        <StoreSettingsModal accentColor={C.sapphire} accentDeep={C.sapphireDeep}
          store={store}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => { setSettingsOpen(false); fetchAll(true); }} />
      )}

      <VoiceAssistantFAB
        accentColor={C.sapphire} accentDeep={C.sapphireDeep}
        label="Assistant Résidence"
        systemInstruction={`Tu es l'assistant vocal de la résidence "${store.name}".

CONTEXTE :
- ${rooms.length} unité${rooms.length > 1 ? 's' : ''} (${occupied} occupées · ${available} libres)
- Taux d'occupation : ${occupancyRate}%
- ${arrivalsToday.length} arrivée${arrivalsToday.length > 1 ? 's' : ''} aujourd'hui
- Tarifs nuit / semaine / mois disponibles selon unité

TON RÔLE :
- Renseigner sur disponibilités et tarifs (court / long séjour)
- Aider check-in / check-out
- Suggérer tarifs semaine/mois pour séjours longs

RÈGLES :
- N'auto-confirme JAMAIS une réservation. Demande validation orale.
- Pour long séjour (7+ nuits), mentionne le tarif semaine ; (28+ nuits) tarif mois.
- Reste bref.`}
      />
    </div>
  );
}

// Derived data
interface Customer {
  phone: string; name: string; stays: number; totalNights: number; lastAt: number;
  stage: 'new' | 'repeat' | 'loyal' | 'longstay' | 'cancelled'; lastRoom?: string;
}
function deriveCustomers(reservations: Reservation[], rooms: Room[]): Customer[] {
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
    const last = list[0];
    const totalNights = list.reduce((s, r) => s + (r.nights ?? nightsBetween(r.date, r.checkOutDate)), 0);
    const stage: Customer['stage'] =
      list.every(r => r.status === 'cancelled' || r.status === 'no_show') ? 'cancelled' :
      totalNights >= 30 ? 'longstay' :
      list.length >= 3   ? 'loyal' :
      list.length >= 2   ? 'repeat' : 'new';
    const lastRoom = rooms.find(rm => rm.id === last.roomId);
    out.push({
      phone, name: last.customerName || phone,
      stays: list.length, totalNights,
      lastAt: getTimestamp(last.createdAt) || new Date(last.date).getTime(),
      stage,
      lastRoom: lastRoom ? `Unité ${lastRoom.number}` : undefined,
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

function HeroAdmin({ store, onAddRoom, onOpenSettings }: { store: Store; onAddRoom: () => void; onOpenSettings: () => void }) {
  const accent = resolveAccent(store as any, C.sapphire);
  return (
    <div style={{
      position: 'relative',
      background: `linear-gradient(135deg, ${C.sapphireDark} 0%, ${C.sapphireDeep} 50%, ${accent} 100%)`,
      borderRadius: 22, padding: '24px 28px', overflow: 'hidden',
      border: `1px solid ${C.gold}40`, boxShadow: `0 20px 50px -20px ${accent}`,
    }}>
      <div className="grain"></div>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .4, pointerEvents: 'none' }}>
        {Array.from({ length: 25 }).map((_, i) => (
          <circle key={i} cx={`${(i*41)%100}%`} cy={`${(i*73)%100}%`}
            r={((i*7)%12)/8 + 0.4}
            fill={i%2 === 0 ? C.gold : C.sapphireSoft}
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
          <BedDouble size={11} /> RÉSIDENCE · <span style={{ color: C.whatsappSoft }}>WHATSAPP</span>
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
              {store.name.split(' ').slice(1).join(' ') || 'Résidence'}
            </em>
          </h1>
          {(store.tagline || store.shortDescription || store.logoUrl) ? (
            <StoreHeroBranding store={store as any} accent={C.gold} dark />
          ) : (
            <p style={{ fontSize: 14, color: 'rgba(255,250,240,.85)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Studios, F2, F3, suites · location nuit / semaine / mois — sur <strong style={{ color: C.whatsappSoft }}>WhatsApp</strong>.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={onAddRoom} className="btn-gold"><Plus size={14} /> Ajouter une unité</button>
          <button onClick={onOpenSettings} className="btn-ghost-light"><Settings size={13} /> Paramètres</button>
        </div>
      </div>
    </div>
  );
}

function TabStrip({ activeTab, setActiveTab, counts }: { activeTab: TabId; setActiveTab: (t: TabId) => void; counts: Record<TabId, number | null> }) {
  const tabs: Array<{ id: TabId; label: string; icon: any; highlight?: boolean }> = [
    { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { id: 'calendar',     label: 'Calendrier',   icon: Calendar },
    { id: 'chambres',     label: 'Unités',       icon: BedDouble },
    { id: 'reservations', label: 'Réservations', icon: BadgeCheck },
    { id: 'clients',      label: 'Clients',      icon: Users },
    { id: 'whatsapp',     label: 'Inbox',        icon: MessageCircle, highlight: true },
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
            background: active ? `linear-gradient(135deg, ${C.sapphire}, ${C.sapphireDeep})` : 'transparent',
            color: active ? C.cream : C.inkSoft,
            padding: '10px 16px', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            boxShadow: active ? `0 6px 14px -4px ${C.sapphire}` : 'none',
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
  rooms: Room[]; reservations: Reservation[]; arrivalsToday: Reservation[]; departuresToday: Reservation[];
  currency: string; occupied: number; available: number; occupancyRate: number;
  threads: WaThread[]; onSelectRoom: (r: Room) => void;
}) {
  const { rooms, reservations, arrivalsToday, departuresToday, currency, occupied, available, occupancyRate, threads, onSelectRoom } = props;
  const today = new Date().toISOString().slice(0, 10);
  const revenueToday = reservations
    .filter(r => r.date <= today && (r.checkOutDate ?? today) >= today && r.status !== 'cancelled')
    .reduce((sum, r) => sum + (rooms.find(rm => rm.id === r.roomId)?.pricePerNight ?? 0), 0);

  const kpis: Array<{ id: string; label: string; value: string; unit?: string; sub: string; icon: any; color: 'sapphire' | 'gold' | 'emerald' | 'coral' }> = [
    { id: 'occupancy', label: 'Taux occupation', value: `${occupancyRate}%`,
      sub: `${occupied} occupées · ${available} dispo`, icon: BedDouble, color: 'sapphire' },
    { id: 'arrivals', label: 'Arrivées du jour', value: String(arrivalsToday.length),
      sub: `${departuresToday.length} départ${departuresToday.length > 1 ? 's' : ''}`, icon: Calendar, color: 'gold' },
    { id: 'revenue', label: 'Revenu jour', value: formatShort(revenueToday), unit: currency,
      sub: `${occupied} unité${occupied > 1 ? 's' : ''} occupée${occupied > 1 ? 's' : ''}`, icon: Banknote, color: 'emerald' },
    { id: 'upcoming', label: 'Résa à venir', value: String(reservations.filter(r => r.date >= today && r.status !== 'cancelled').length),
      sub: 'cette semaine + plus tard', icon: TrendingUp, color: 'coral' },
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
        <BuildingView rooms={rooms} onSelectRoom={onSelectRoom} />
        <ArrivalsPanel arrivals={arrivalsToday} departures={departuresToday} rooms={rooms} reservations={reservations} />
      </div>

      <WhatsAppLeadsPanel threads={threads} />
    </div>
  );
}

function BuildingView({ rooms, onSelectRoom }: { rooms: Room[]; onSelectRoom: (r: Room) => void }) {
  const floors = useMemo(() => {
    const map = new Map<number, Room[]>();
    for (const r of rooms) {
      const f = floorOf(r);
      const arr = map.get(f) ?? [];
      arr.push(r); map.set(f, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0]-a[0]);
  }, [rooms]);

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.sapphireDark}, ${C.sapphireDeep})`,
      borderRadius: 18, border: `1px solid ${C.gold}30`,
      overflow: 'hidden', position: 'relative',
      minHeight: 420, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 18px', background: 'rgba(0,0,0,.25)',
        borderBottom: `1px solid ${C.gold}20`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Compass size={14} color={C.gold} />
        <span className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: '.12em', flex: 1 }}>
          OCCUPATION · {rooms.length} UNITÉ{rooms.length > 1 ? 'S' : ''}
        </span>
        <span className="pill" style={{ background: `${C.emerald}25`, color: C.emerald, border: `1px solid ${C.emerald}50`, fontSize: 9, fontWeight: 800 }}>
          <span className="live-dot" style={{ width: 6, height: 6, color: C.emerald }}></span>
          LIVE
        </span>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {floors.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,250,240,.6)' }}>
            <BedDouble size={36} color={C.gold} style={{ marginBottom: 10, opacity: .7 }} />
            <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 4 }}>
              Pas encore d'unité
            </div>
            <div style={{ fontSize: 11 }}>Ajoute des unités pour voir l'occupation en direct.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {floors.map(([floor, list]) => (
              <div key={floor}>
                <div className="mono-font" style={{ fontSize: 9, fontWeight: 800, color: C.gold, letterSpacing: '.08em', marginBottom: 6 }}>
                  ÉTAGE {floor === 0 ? 'RDC' : floor}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
                  {list.map(r => {
                    const cfg = ROOM_STATUS_CONFIG[r.status];
                    return (
                      <button key={r.id} onClick={() => onSelectRoom(r)} style={{
                        padding: '8px 4px', borderRadius: 8,
                        background: `${cfg.color}20`,
                        border: `1px solid ${cfg.color}50`,
                        color: cfg.color === C.emerald ? C.emerald : (cfg.color === C.sapphire ? C.sapphireSoft : (cfg.color === C.gold ? C.gold : '#FCA5A5')),
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      }}>
                        <div className="mono-font" style={{ fontSize: 11, fontWeight: 800 }}>{r.number}</div>
                        <div style={{ fontSize: 8, opacity: .85 }}>{ROOM_TYPE_LABELS[r.type].split(' ')[0]}</div>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }}></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {floors.length > 0 && (
        <div style={{
          padding: '8px 14px', background: 'rgba(0,0,0,.35)',
          borderTop: `1px solid ${C.gold}20`,
          display: 'flex', gap: 10, fontSize: 10, color: 'rgba(255,250,240,.85)', flexWrap: 'wrap',
        }}>
          {(['available', 'occupied', 'cleaning', 'maintenance'] as const).map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROOM_STATUS_CONFIG[s].color }}></span>
              {ROOM_STATUS_CONFIG[s].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ArrivalsPanel({ arrivals, departures, rooms, reservations }: {
  arrivals: Reservation[]; departures: Reservation[]; rooms: Room[]; reservations: Reservation[];
}) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const tomorrowArrivals = reservations.filter(r => r.date === tomorrowStr && r.status !== 'cancelled');

  return (
    <div style={{
      background: C.cream, borderRadius: 18, overflow: 'hidden',
      border: '1px solid rgba(10,42,32,.06)',
      minHeight: 420, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 18px',
        background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
        color: C.cream, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Calendar size={16} />
        <div style={{ flex: 1 }}>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', opacity: .9 }}>
            ARRIVÉES · DÉPARTS
          </div>
          <div className="display-font" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em' }}>
            {arrivals.length} arrivée{arrivals.length > 1 ? 's' : ''} · {departures.length} départ{departures.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {arrivals.length === 0 && departures.length === 0 && tomorrowArrivals.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: C.inkSoft }}>
            <Calendar size={36} color={C.inkLight} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
              Calme plat aujourd'hui
            </div>
          </div>
        ) : (
          <>
            {arrivals.length > 0 && <Section label="Arrivées aujourd'hui" color={C.emerald}>
              {arrivals.map(r => <ResRow key={r.id} reservation={r} rooms={rooms} kind="arrival" />)}
            </Section>}
            {departures.length > 0 && <Section label="Départs aujourd'hui" color={C.sapphire}>
              {departures.map(r => <ResRow key={r.id} reservation={r} rooms={rooms} kind="departure" />)}
            </Section>}
            {tomorrowArrivals.length > 0 && <Section label="Arrivées demain" color={C.gold}>
              {tomorrowArrivals.map(r => <ResRow key={r.id} reservation={r} rooms={rooms} kind="upcoming" />)}
            </Section>}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="mono-font" style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: '.08em', marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function ResRow({ reservation, rooms, kind }: { reservation: Reservation; rooms: Room[]; kind: 'arrival' | 'departure' | 'upcoming' }) {
  const room = rooms.find(r => r.id === reservation.roomId);
  const confirmed = reservation.status === 'confirmed' || reservation.status === 'seated';
  const accent = kind === 'arrival' ? C.emerald : kind === 'departure' ? C.sapphire : C.gold;
  const accentDeep = kind === 'arrival' ? C.emeraldDeep : kind === 'departure' ? C.sapphireDeep : C.goldDeep;
  return (
    <div style={{
      background: C.creamDeep, borderRadius: 10, padding: 10,
      border: '1px solid rgba(10,42,32,.06)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: `linear-gradient(135deg, ${accent}, ${accentDeep})`,
        color: C.cream, fontWeight: 700, fontSize: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Fraunces, serif', flexShrink: 0,
      }}>{initials(reservation.customerName || '?')}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {reservation.customerName}
          {confirmed && <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDark, fontSize: 9, fontWeight: 800 }}>● Confirmée</span>}
        </div>
        <div style={{ fontSize: 10, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Clock size={10} /> {reservation.time}
          {room && <><span>·</span><span style={{ color: C.sapphireDeep, fontWeight: 600 }}>Unité {room.number}</span></>}
          <span>·</span><span>{reservation.partySize} pers</span>
        </div>
      </div>
      <a href={`https://wa.me/${reservation.customerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
        className="icon-btn" style={{ background: C.whatsappSoft, color: C.whatsappDark, width: 30, height: 30, textDecoration: 'none' }}>
        <MessageCircle size={13} />
      </a>
    </div>
  );
}

function WhatsAppLeadsPanel({ threads }: { threads: WaThread[] }) {
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
            border: '1px solid rgba(10,42,32,.06)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`,
              color: C.cream, fontWeight: 700, fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif', flexShrink: 0,
            }}>{initials(t.name)}</div>
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

function CalendarTab({ rooms, reservations, onSelectRoom, onAddReservation }: {
  rooms: Room[]; reservations: Reservation[]; onSelectRoom: (r: Room) => void; onAddReservation: () => void;
}) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const days = 14;
  const dates = useMemo(() => dateRange(startDate, days), [startDate]);
  const todayStr = new Date().toISOString().slice(0, 10);

  const shiftDays = (offset: number) => {
    const d = new Date(startDate); d.setDate(d.getDate()+offset);
    setStartDate(d);
  };

  if (rooms.length === 0) {
    return <EmptyState icon={Calendar} title="Pas encore d'unité"
      desc="Ajoute des unités pour voir le planning des réservations." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: C.cream, borderRadius: 14, padding: 12,
        border: '1px solid rgba(10,42,32,.06)',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <button onClick={() => shiftDays(-7)} className="icon-btn ghost"><ChevronLeft size={14} /></button>
        <button onClick={() => setStartDate(new Date(new Date().setHours(0,0,0,0)))} className="btn-secondary" style={{ padding: '7px 12px', fontSize: 11 }}>
          Aujourd'hui
        </button>
        <button onClick={() => shiftDays(7)} className="icon-btn ghost"><ChevronRight size={14} /></button>
        <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginLeft: 6 }}>
          {startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} →{' '}
          {new Date(startDate.getTime() + (days-1)*86400000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </div>
        <button onClick={onAddReservation} className="btn-primary" style={{ marginLeft: 'auto' }}>
          <Plus size={13} /> Nouvelle réservation
        </button>
      </div>

      <div style={{
        background: C.cream, borderRadius: 14, overflow: 'auto',
        border: '1px solid rgba(10,42,32,.06)',
      }} className="scroll-thin">
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 800 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: C.cream, zIndex: 2 }}>
              <th style={{
                padding: '12px 10px', textAlign: 'left', fontSize: 11, fontWeight: 800,
                color: C.inkSoft, borderBottom: `2px solid ${C.creamDeep}`,
                textTransform: 'uppercase', letterSpacing: '.05em',
                minWidth: 120, position: 'sticky', left: 0, background: C.cream,
              }}>
                Unité
              </th>
              {dates.map(d => {
                const day = new Date(d);
                const isToday = d === todayStr;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <th key={d} style={{
                    padding: '8px 6px', textAlign: 'center',
                    fontSize: 10, fontWeight: 700,
                    color: isToday ? C.sapphireDeep : (isWeekend ? C.coralDeep : C.inkSoft),
                    background: isToday ? C.sapphireSoft : 'transparent',
                    borderBottom: `2px solid ${isToday ? C.sapphire : C.creamDeep}`,
                    minWidth: 40,
                  }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, opacity: .7 }}>
                      {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </div>
                    <div className="display-font" style={{ fontSize: 14, fontWeight: 800 }}>
                      {day.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rooms.map(room => (
              <tr key={room.id}>
                <td style={{
                  padding: '8px 10px', borderBottom: `1px solid ${C.creamDeep}`,
                  background: C.cream, position: 'sticky', left: 0, zIndex: 1,
                }}>
                  <button onClick={() => onSelectRoom(room)} style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{
                      width: 8, height: 32, borderRadius: 4,
                      background: ROOM_STATUS_CONFIG[room.status].color,
                    }}></div>
                    <div>
                      <div className="mono-font" style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>
                        {room.number}
                      </div>
                      <div style={{ fontSize: 10, color: C.inkSoft }}>
                        {ROOM_TYPE_LABELS[room.type].split(' ')[0]}
                      </div>
                    </div>
                  </button>
                </td>
                {dates.map(d => {
                  const booking = isDayBookedFor(room, d, reservations);
                  const isToday = d === todayStr;
                  return (
                    <td key={d} title={booking ? `${booking.customerName} · ${d}` : 'Libre'} style={{
                      padding: 3, borderBottom: `1px solid ${C.creamDeep}`,
                      background: isToday ? `${C.sapphire}08` : 'transparent',
                    }}>
                      <div style={{
                        height: 32, borderRadius: 4,
                        background: booking
                          ? (booking.status === 'pending'
                              ? `repeating-linear-gradient(45deg, ${C.gold}, ${C.gold} 4px, ${C.goldDeep} 4px, ${C.goldDeep} 8px)`
                              : `linear-gradient(135deg, ${C.sapphire}, ${C.sapphireDeep})`)
                          : C.creamDeep,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700,
                        color: booking ? C.cream : 'transparent',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        cursor: booking ? 'pointer' : 'default',
                      }}>
                        {booking ? booking.customerName.slice(0, 8) : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.inkSoft, padding: '0 4px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: `linear-gradient(135deg, ${C.sapphire}, ${C.sapphireDeep})` }}></span>
          Confirmée
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: `repeating-linear-gradient(45deg, ${C.gold}, ${C.gold} 4px, ${C.goldDeep} 4px, ${C.goldDeep} 8px)` }}></span>
          En attente
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: C.creamDeep }}></span>
          Libre
        </span>
      </div>
    </div>
  );
}

function ChambresTab({ rooms, currency, onSelectRoom, onAdd }: { rooms: Room[]; currency: string; onSelectRoom: (r: Room) => void; onAdd: () => void }) {
  const [filter, setFilter] = useState<'all' | Room['status']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | RoomType>('all');
  const [search, setSearch] = useState('');
  const filtered = rooms.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [r.number, r.name, r.description, ROOM_TYPE_LABELS[r.type]].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="N°, nom, type…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: C.ink, fontFamily: 'inherit', minWidth: 0 }} />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
            style={{ background: C.creamDeep, color: C.ink, border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            <option value="all">Tous types</option>
            {(Object.entries(ROOM_TYPE_LABELS) as Array<[RoomType, string]>).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={onAdd} className="btn-primary"><Plus size={13} /> Ajouter</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            { id: 'all',         label: 'Toutes',     color: C.sapphire },
            { id: 'available',   label: 'Dispo',      color: C.emerald },
            { id: 'occupied',    label: 'Occupées',   color: C.sapphire },
            { id: 'cleaning',    label: 'Ménage',     color: C.gold },
            { id: 'maintenance', label: 'Maintenance',color: C.coralDeep },
          ] as const).map(f => {
            const count = f.id === 'all' ? rooms.length : rooms.filter(r => r.status === f.id).length;
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id as any)} style={{
                background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'transparent',
                color: active ? C.cream : C.inkSoft,
                padding: '7px 12px', borderRadius: 100,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: active ? 'none' : '1px solid rgba(10,42,32,.1)',
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

      {rooms.length === 0 ? (
        <EmptyState icon={BedDouble} title="Pas encore d'unité"
          desc="Ajoute studios, F2, F3, suites avec tarifs nuit / semaine / mois."
          cta="Ajouter ma 1re unité" onAction={onAdd} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={BedDouble} title="Aucune unité ne correspond" desc="Ajuste les filtres." />
      ) : (
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {filtered.map(r => <RoomCard key={r.id} room={r} currency={currency} onClick={() => onSelectRoom(r)} />)}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, currency, onClick }: { room: Room; currency: string; onClick: () => void }) {
  const cfg = ROOM_STATUS_CONFIG[room.status];
  return (
    <div onClick={onClick} className="card-lift" style={{
      background: C.cream, borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(10,42,32,.06)', cursor: 'pointer',
    }}>
      <div style={{
        height: 160, position: 'relative', overflow: 'hidden',
        background: room.imageUrl ? '#000' : gradientFor(room.id),
      }}>
        {room.imageUrl ? (
          <img src={room.imageUrl} alt={room.number} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,250,240,.4)' }}>
            <BedDouble size={70} strokeWidth={1} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="pill" style={{
            background: 'rgba(255,250,240,.95)', color: cfg.ink,
            fontWeight: 800, fontSize: 10, backdropFilter: 'blur(20px)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, display: 'inline-block' }}></span>
            {cfg.label}
          </span>
          <span className="pill" style={{
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
            color: C.cream, fontWeight: 800, fontSize: 10,
          }}>{ROOM_TYPE_LABELS[room.type].split(' ')[0]}</span>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <button onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="icon-btn" style={{ background: 'rgba(255,250,240,.95)', color: C.ink, backdropFilter: 'blur(20px)', width: 32, height: 32 }}>
            <Edit3 size={13} />
          </button>
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
          <span className="display-font mono-font" style={{
            background: 'rgba(0,0,0,.5)', color: C.cream,
            padding: '4px 12px', borderRadius: 100,
            fontSize: 18, fontWeight: 800, letterSpacing: '-.01em',
            backdropFilter: 'blur(20px)',
          }}>{room.number}</span>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <h3 className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-.02em' }}>
          {room.name || ROOM_TYPE_LABELS[room.type]}
        </h3>
        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 3, marginBottom: 10 }}>
          <Users size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {room.capacity} pers max
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0', borderTop: `1px solid ${C.creamDeep}`, borderBottom: `1px solid ${C.creamDeep}` }}>
          <PriceLine label="Nuit" value={room.pricePerNight} currency={room.currency || currency} accent={C.sapphireDeep} />
          {room.priceWeek && <PriceLine label="Semaine" value={room.priceWeek} currency={room.currency || currency} accent={C.violetDeep} />}
          {room.priceMonth && <PriceLine label="Mois" value={room.priceMonth} currency={room.currency || currency} accent={C.goldDeep} />}
        </div>
        {room.amenities && room.amenities.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {room.amenities.slice(0, 4).map((a, i) => (
              <span key={i} style={{ fontSize: 10, color: C.inkSoft, background: C.creamDeep, padding: '2px 7px', borderRadius: 100 }}>{a}</span>
            ))}
            {room.amenities.length > 4 && <span style={{ fontSize: 10, color: C.inkLight }}>+{room.amenities.length - 4}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceLine({ label, value, currency, accent }: { label: string; value: number; currency: string; accent: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>{label}</span>
      <span className="mono-font" style={{ fontSize: 13, fontWeight: 800, color: accent }}>
        {formatShort(value)} <span style={{ fontSize: 9, opacity: .7 }}>{currency.toUpperCase()}</span>
      </span>
    </div>
  );
}

function ReservationsTab({ reservations, rooms, storeId, currency, onAdd, onChanged }: {
  reservations: Reservation[]; rooms: Room[]; storeId: string; currency: string;
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
      <div style={{
        background: C.cream, borderRadius: 14, padding: 14,
        border: '1px solid rgba(10,42,32,.06)',
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>
        {([
          { id: 'upcoming' as const, label: 'À venir' },
          { id: 'today' as const,    label: "Aujourd'hui" },
          { id: 'past' as const,     label: 'Passées' },
          { id: 'all' as const,      label: 'Toutes' },
        ]).map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: active ? `linear-gradient(135deg, ${C.sapphire}, ${C.sapphireDeep})` : 'transparent',
              color: active ? C.cream : C.inkSoft,
              padding: '7px 12px', borderRadius: 100,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(10,42,32,.1)',
              fontFamily: 'inherit',
            }}>{f.label}</button>
          );
        })}
        <button onClick={onAdd} disabled={rooms.length === 0} className="btn-primary" style={{ marginLeft: 'auto' }}>
          <Plus size={13} /> Nouvelle réservation
        </button>
      </div>

      {reservations.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="Aucune réservation"
          desc={rooms.length === 0 ? "Ajoute d'abord des unités." : "Les réservations s'affichent ici."}
          cta={rooms.length > 0 ? 'Planifier une réservation' : undefined} onAction={onAdd} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="Aucune réservation pour ce filtre" desc="Change de filtre." />
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(r => (
            <ReservationCard key={r.id} reservation={r} rooms={rooms} currency={currency}
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

function ReservationCard({ reservation, rooms, currency, onConfirm, onSeated, onCancel, onRemove }: {
  reservation: Reservation; rooms: Room[]; currency: string;
  onConfirm: () => void; onSeated: () => void; onCancel: () => void; onRemove: () => void;
}) {
  const room = rooms.find(r => r.id === reservation.roomId);
  const confirmed = reservation.status === 'confirmed';
  const seated = reservation.status === 'seated';
  const accent = seated ? C.blueDeep : confirmed ? C.emerald : C.gold;
  const nights = reservation.nights ?? nightsBetween(reservation.date, reservation.checkOutDate);
  const total = (room?.pricePerNight ?? 0) * nights;

  return (
    <div className="card-lift" style={{
      background: C.cream, borderRadius: 12, padding: 14,
      border: '1px solid rgba(10,42,32,.06)',
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
          <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
            {reservation.customerName}
          </span>
          <ReservationStatusPill status={reservation.status} />
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 3 }}>
          {room ? (
            <>Unité <strong style={{ color: C.sapphireDeep }}>{room.number}</strong> · {ROOM_TYPE_LABELS[room.type]}</>
          ) : 'Pas d\'unité assignée'}
          {' · '}{nights} nuit{nights > 1 ? 's' : ''} · {reservation.partySize} pers
        </div>
        <div style={{ fontSize: 10, color: C.inkLight, fontFamily: 'JetBrains Mono', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span><Phone size={9} style={{ display: 'inline' }} /> {reservation.customerPhone}</span>
          <WhatsAppQuickButton phone={reservation.customerPhone} prefill={`Bonjour ${reservation.customerName ?? ''}, à propos de votre séjour…`} />
          <span>·</span>
          <span>{reservation.time}</span>
          {reservation.checkOutDate && (<><span>·</span><span>→ {new Date(reservation.checkOutDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></>)}
        </div>
        {reservation.notes && (
          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4, fontStyle: 'italic' }}>📝 {reservation.notes}</div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {total > 0 && (
          <div className="display-font mono-font" style={{ fontSize: 16, fontWeight: 800, color: C.sapphireDeep }}>
            {formatShort(total)}
          </div>
        )}
        <div style={{ fontSize: 9, color: C.inkLight, fontWeight: 700, letterSpacing: '.05em' }}>
          {currency.toUpperCase()}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {reservation.status === 'pending' && (
          <button onClick={onConfirm} className="icon-btn emerald" title="Confirmer"><CheckCircle2 size={14} /></button>
        )}
        {reservation.status === 'confirmed' && (
          <button onClick={onSeated} className="icon-btn" style={{ background: C.blueSoft, color: C.blueDeep }} title="Check-in"><BadgeCheck size={14} /></button>
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
    seated:    [C.blueSoft, C.blueDeep,     '🚪 Check-in'],
    cancelled: [C.redSoft, C.red,           '✗ Annulée'],
    no_show:   ['#FCE7F3', '#9D174D',       '👻 No show'],
  };
  const [bg, fg, txt] = c[status] ?? c.pending;
  return <span className="pill" style={{ background: bg, color: fg, fontSize: 9, fontWeight: 800 }}>{txt}</span>;
}

function ClientsTab({ customers }: { customers: Customer[] }) {
  const stages: Array<{ id: Customer['stage']; label: string; color: string; icon: any }> = [
    { id: 'new',       label: 'Nouveaux',          color: C.cyan,     icon: Sparkles },
    { id: 'repeat',    label: 'Récurrents',        color: C.sapphire, icon: RefreshCcw },
    { id: 'loyal',     label: 'Fidèles (3+)',      color: C.gold,     icon: Star },
    { id: 'longstay',  label: 'Long séjour (30j+)', color: C.violet,  icon: Trophy },
    { id: 'cancelled', label: 'Annulés',           color: C.inkSoft,  icon: X },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: C.cream, borderRadius: 14, padding: 16,
        border: '1px solid rgba(10,42,32,.06)',
      }}>
        <div className="pill" style={{ background: C.sapphireSoft, color: C.sapphireDeep, fontSize: 10, marginBottom: 4 }}>
          <Users size={11} /> PIPELINE · {customers.length} CLIENT{customers.length > 1 ? 'S' : ''}
        </div>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
          Pipeline <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.sapphireDeep }}>commercial</em>
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '4px 0 0' }}>
          Dérivé des réservations. Stage = récurrence + nuits cumulées.
        </p>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={Users} title="Pas encore de client" desc="Les clients apparaissent dès la 1re réservation." />
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }} className="scroll-thin">
          {stages.map(stage => {
            const list = customers.filter(c => c.stage === stage.id);
            const Icon = stage.icon;
            return (
              <div key={stage.id} style={{
                minWidth: 280, flex: '1 1 280px',
                background: C.cream, borderRadius: 14, padding: 12,
                border: '1px solid rgba(10,42,32,.06)',
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
                    <div key={c.phone} style={{ background: C.creamDeep, borderRadius: 10, padding: 10, border: '1px solid rgba(10,42,32,.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${stage.color}, ${stage.color}cc)`, color: C.cream, fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>
                          {initials(c.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 9, color: C.inkLight, fontFamily: 'JetBrains Mono' }}>
                            {c.stays} séjour{c.stays > 1 ? 's' : ''} · {c.totalNights} nuits
                          </div>
                        </div>
                      </div>
                      {c.lastRoom && (
                        <div className="pill" style={{ background: C.sapphireSoft, color: C.sapphireDeep, fontSize: 9, fontWeight: 700, marginBottom: 6 }}>
                          <BedDouble size={9} /> Dernière : {c.lastRoom}
                        </div>
                      )}
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

function WhatsAppTab({ threads, connected, onRefresh }: { threads: WaThread[]; connected: boolean; onRefresh: () => void }) {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(threads[0]?.phone ?? null);
  const selected = threads.find(t => t.phone === selectedPhone) ?? threads[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(10,42,32,.06)' }}>
        <div className="pill" style={{
          background: connected ? `${C.whatsapp}15` : C.creamDeep,
          color: connected ? C.whatsappDark : C.inkSoft,
          fontSize: 10, fontWeight: 700, marginBottom: 4,
        }}>
          {connected ? <><span className="live-dot" style={{ width: 6, height: 6, color: C.whatsapp }}></span> WHATSAPP CONNECTÉ</> : <>● NON CONNECTÉ</>}
        </div>
        <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0 }}>
          Messages <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.whatsappDark }}>de la résidence</em>
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
          {threads.length} conversation{threads.length > 1 ? 's' : ''}. Paramètres globaux dans <a href="/admin/whatsapp" style={{ color: C.sapphireDeep, fontWeight: 600, textDecoration: 'none' }}>Admin · WhatsApp</a>.
        </p>
      </div>

      {threads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 14, border: '1px dashed rgba(10,42,32,.15)' }}>
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
            border: '1px solid rgba(10,42,32,.06)', height: 'calc(100vh - 280px)', minHeight: 460,
          }}>
            <div style={{ padding: '14px 16px', background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`, color: C.cream, position: 'sticky', top: 0, zIndex: 1 }}>
              <div className="mono-font" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', opacity: .9 }}>WHATSAPP BUSINESS</div>
              <h3 className="display-font" style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{threads.length} conversations</h3>
            </div>
            {threads.map(t => {
              const sel = selected?.phone === t.phone;
              return (
                <div key={t.phone} onClick={() => setSelectedPhone(t.phone)} style={{
                  padding: '12px 16px', borderBottom: '1px solid rgba(10,42,32,.04)', cursor: 'pointer',
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
          <div style={{ flex: 1, minWidth: 0, background: C.cream, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(10,42,32,.06)', height: 'calc(100vh - 280px)', minHeight: 460, display: 'flex', flexDirection: 'column' }}>
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
                          border: inbound ? '1px solid rgba(10,42,32,.06)' : `1px solid ${C.whatsapp}30`,
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
                <div style={{ padding: 14, borderTop: '1px solid rgba(10,42,32,.06)' }}>
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
    <div style={{
      textAlign: 'center', padding: 60,
      background: C.cream, borderRadius: 14,
      border: '1px dashed rgba(10,42,32,.15)',
    }}>
      <Icon size={48} color={C.sapphire} style={{ marginBottom: 12, opacity: .7 }} />
      <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>{title}</h3>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>{desc}</p>
      {cta && onAction && (
        <button onClick={onAction} className="btn-primary"><Plus size={14} /> {cta}</button>
      )}
    </div>
  );
}

function ResidenceActivationScreen({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('Caution + 1ère semaine par Wave ou virement.');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim().length >= 2 && ownerPhone.length >= 6 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/commerce/stores', {
        name: name.trim(), ownerPhone: ownerPhone.trim(),
        paymentInstructions: paymentInstructions.trim(),
        businessType: 'residence',
      });
      toast.success('Résidence activée', `${name.trim()} est en ligne.`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Activation impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{STYLES}</style>
      <div style={{ background: C.cream, borderRadius: 22, maxWidth: 520, width: '100%', boxShadow: '0 24px 60px -16px rgba(10,42,32,.18)', overflow: 'hidden' }}>
        <div style={{ background: `linear-gradient(135deg, ${C.sapphire}, ${C.sapphireDeep})`, color: '#fff', padding: '36px 32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div className="grain"></div>
          <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
            <BedDouble size={28} color="#fff" />
          </div>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            Active ta <em style={{ fontStyle: 'italic', fontWeight: 500 }}>résidence</em>
          </h1>
          <p style={{ fontSize: 13, opacity: .92, marginTop: 8 }}>Studios · F2 · F3 · Suites · Long séjour</p>
        </div>
        <div style={{ padding: '26px 32px 30px' }}>
          <div style={{ background: C.sapphireSoft, border: `1px solid ${C.sapphire}30`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: C.sapphireDeep, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={14} />
            <span>1 résidence = 1 bâtiment avec plusieurs unités.</span>
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Nom de la résidence</Label>
            <Input value={name} onChange={setName} placeholder="Nom de la résidence" autoFocus />
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
            <button onClick={submit} disabled={!canSubmit} className="btn-primary">
              {submitting ? <><Loader2 size={14} className="spin" /> Activation…</> : <><BedDouble size={14} /> Activer ma résidence</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomModal({ storeId, currency, room, onClose, onSaved, onDeleted }: {
  storeId: string; currency: string; room?: Room;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!room;
  const [number, setNumber] = useState(room?.number ?? '');
  const [name, setName] = useState(room?.name ?? '');
  const [type, setType] = useState<RoomType>(room?.type ?? 'studio');
  const [capacity, setCapacity] = useState<number | ''>(room?.capacity ?? 2);
  const [pricePerNight, setPricePerNight] = useState<number | ''>(room?.pricePerNight ?? '');
  const [priceWeek, setPriceWeek] = useState<number | ''>(room?.priceWeek ?? '');
  const [priceMonth, setPriceMonth] = useState<number | ''>(room?.priceMonth ?? '');
  const [floor, setFloor] = useState<number | ''>(room?.floor ?? '');
  const [description, setDescription] = useState(room?.description ?? '');
  const [amenitiesText, setAmenitiesText] = useState((room?.amenities ?? []).join(', '));
  const [status, setStatus] = useState<Room['status']>(room?.status ?? 'available');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(room?.imageUrl ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = number.trim().length >= 1 && typeof capacity === 'number' && capacity > 0 && typeof pricePerNight === 'number' && pricePerNight > 0 && !submitting;

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
    const amenities = amenitiesText.split(/[,\n]+/).map(a => a.trim()).filter(Boolean);
    const payload = {
      number: number.trim(),
      name: name.trim() || undefined,
      type, capacity, pricePerNight,
      priceWeek: typeof priceWeek === 'number' && priceWeek > 0 ? priceWeek : undefined,
      priceMonth: typeof priceMonth === 'number' && priceMonth > 0 ? priceMonth : undefined,
      floor: typeof floor === 'number' ? floor : undefined,
      description: description.trim(), amenities, status,
      ...(imageBase64 ? { imageBase64, imageMimeType } : {}),
    };
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/rooms/${room!.id}`, payload);
        toast.success('Unité mise à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/rooms`, payload);
        toast.success('Unité ajoutée');
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/rooms/${room!.id}`);
      toast.success('Unité supprimée');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={isEdit ? "Modifier l'unité" : 'Nouvelle unité'} color={C.sapphireDeep} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <Label>Photo principale</Label>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {imagePreview ? (
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', maxHeight: 200 }}>
            <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ position: 'absolute', top: 8, right: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(10,42,32,.8)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
              <Camera size={11} /> Remplacer
            </button>
          </div>
        ) : (
          <button onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', padding: '20px 14px', borderRadius: 12, background: C.creamDeep, color: C.sapphireDeep, border: `1.5px dashed ${C.sapphire}`, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Camera size={22} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Choisir une photo</span>
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>N°</Label><Input value={number} onChange={setNumber} placeholder="101" autoFocus /></div>
        <div><Label>Nom (optionnel)</Label><Input value={name} onChange={setName} placeholder="Studio vue mer, F2 jardin…" /></div>
        <div><Label>Étage</Label><Input type="number" value={String(floor ?? '')} onChange={v => setFloor(v === '' ? '' : parseInt(v))} mono /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <Label>Type</Label>
          <select value={type} onChange={e => setType(e.target.value as RoomType)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
            {(Object.entries(ROOM_TYPE_LABELS) as Array<[RoomType, string]>).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div><Label>Capacité</Label><Input type="number" value={String(capacity ?? '')} onChange={v => setCapacity(v === '' ? '' : parseInt(v))} mono /></div>
      </div>
      <div style={{ margin: '14px 0 6px', fontSize: 11, fontWeight: 800, color: C.sapphireDeep, textTransform: 'uppercase', letterSpacing: '.06em' }}>💰 Tarifs</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><Label>Nuit ({currency})</Label><Input type="number" value={String(pricePerNight ?? '')} onChange={v => setPricePerNight(v === '' ? '' : parseInt(v))} placeholder="35000" mono /></div>
        <div><Label>Semaine (option)</Label><Input type="number" value={String(priceWeek ?? '')} onChange={v => setPriceWeek(v === '' ? '' : parseInt(v))} placeholder="220000" mono /></div>
        <div><Label>Mois (option)</Label><Input type="number" value={String(priceMonth ?? '')} onChange={v => setPriceMonth(v === '' ? '' : parseInt(v))} placeholder="750000" mono /></div>
      </div>

      {isEdit && (
        <div style={{ marginBottom: 12 }}>
          <Label>Statut</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.entries(ROOM_STATUS_CONFIG) as Array<[Room['status'], typeof ROOM_STATUS_CONFIG[Room['status']]]>).map(([val, cfg]) => {
              const sel = status === val;
              return (
                <button key={val} type="button" onClick={() => setStatus(val)} style={{
                  padding: '7px 14px', borderRadius: 100,
                  background: sel ? cfg.color : 'transparent',
                  color: sel ? C.cream : cfg.ink,
                  border: `1.5px solid ${cfg.color}`,
                  cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
                }}>{cfg.label}</button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Label>Description</Label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
          placeholder="Vue lagune, kitchenette équipée, balcon, parking inclus…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <Label>Équipements (séparés par virgule)</Label>
        <Input value={amenitiesText} onChange={setAmenitiesText} placeholder="wifi, clim, tv, kitchenette, washer, parking, balcony" />
      </div>

      {isEdit && confirmDelete && (
        <div style={{ padding: 14, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>
            Supprimer l'unité <em>{room!.number}</em> ?
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

function ReservationModal({ storeId, rooms, onClose, onCreated }: {
  storeId: string; rooms: Room[]; onClose: () => void; onCreated: () => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkOutDate, setCheckOutDate] = useState('');
  const [time, setTime] = useState('14:00');
  const [partySize, setPartySize] = useState<number | ''>(2);
  const [roomId, setRoomId] = useState<string>(rooms.filter(r => r.status === 'available')[0]?.id ?? rooms[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const room = rooms.find(r => r.id === roomId);
  const nights = nightsBetween(date, checkOutDate);
  const total = (room?.pricePerNight ?? 0) * nights;

  const canSubmit = customerName.trim().length >= 2 && customerPhone.length >= 6
    && date && time && typeof partySize === 'number' && partySize > 0 && roomId && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post(`/commerce/stores/${storeId}/reservations`, {
        customerName: customerName.trim(), customerPhone: customerPhone.trim(),
        date, time, partySize,
        ...(checkOutDate ? { checkOutDate, nights } : {}),
        roomId,
        reason: room ? `Séjour : Unité ${room.number}` : 'Séjour',
        notes: notes.trim(),
      });
      toast.success('Réservation créée', `${customerName.trim()} · ${date}${checkOutDate ? ` → ${checkOutDate}` : ''}`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Création impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Nouvelle réservation" color={C.sapphireDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Client</Label><Input value={customerName} onChange={setCustomerName} placeholder="M. Konan" autoFocus /></div>
        <div><Label>Téléphone</Label><Input value={customerPhone} onChange={setCustomerPhone} placeholder="+XXX XX XX XX XX" /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Unité</Label>
        <select value={roomId} onChange={e => setRoomId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          {rooms.map(r => (
            <option key={r.id} value={r.id} disabled={r.status !== 'available'}>
              Unité {r.number} — {ROOM_TYPE_LABELS[r.type]} ({formatShort(r.pricePerNight)} {r.currency}){r.status !== 'available' ? ` · ${ROOM_STATUS_CONFIG[r.status].label}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Arrivée</Label><Input type="date" value={date} onChange={setDate} /></div>
        <div><Label>Départ</Label><Input type="date" value={checkOutDate} onChange={setCheckOutDate} /></div>
        <div><Label>Heure</Label><Input type="time" value={time} onChange={setTime} /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Voyageurs</Label>
        <Input type="number" value={String(partySize ?? '')} onChange={v => setPartySize(v === '' ? '' : parseInt(v))} mono />
      </div>
      {room && checkOutDate && (
        <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: C.sapphireSoft, border: `1px solid ${C.sapphire}30` }}>
          <div style={{ fontSize: 12, color: C.sapphireDeep, fontWeight: 700 }}>
            {nights} nuit{nights > 1 ? 's' : ''} × {formatShort(room.pricePerNight)} = <strong>{formatShort(total)} {room.currency}</strong>
            {room.priceWeek && nights >= 7 && (
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4, color: C.violetDeep }}>
                💡 Tarif semaine dispo : {formatShort(room.priceWeek)} (économie {formatShort(7 * room.pricePerNight - room.priceWeek)})
              </div>
            )}
            {room.priceMonth && nights >= 28 && (
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4, color: C.goldDark }}>
                💡 Tarif mois dispo : {formatShort(room.priceMonth)} (économie {formatShort(30 * room.pricePerNight - room.priceMonth)})
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 18 }}>
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Lit bébé, allergies, parking nécessaire…"
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
