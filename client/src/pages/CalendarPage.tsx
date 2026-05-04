/**
 * CalendarPage — Premium unified calendar (cyan accent)
 * Aggregates: appointments, leaves, meetings, AI work-items into a month/week/day/list view.
 * Wired to: GET /marketplace/work-items, /appointments, /hr/leave/all, /meetings.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, Sparkles, Filter, ExternalLink,
  CheckCircle2, Calendar as CalendarIcon, Video, Flame, MapPin, Users,
  Award, Edit3, Trash2, X,
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const C = {
  greenDeep: '#0A4F3C', greenInk: '#042A1F',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  gold: '#D4A017', goldDeep: '#B8860B', goldDark: '#8B6914', goldSoft: '#FEF3C7', goldLight: '#FCD34D',
  cyan: '#06B6D4', cyanDeep: '#0891B2', cyanDark: '#155E75', cyanSoft: '#CFFAFE', cyanLight: '#67E8F9',
  indigo: '#4338CA', indigoSoft: '#E0E7FF', indigoDeep: '#3730A3',
  terracotta: '#E07856', terraDeep: '#C25C3D', terraSoft: '#FFEDE5',
  sage: '#86C5A0', sageDeep: '#5BA47C', sageDark: '#2D6A4F', sageSoft: '#D4F1DF',
  blue: '#0EA5E9', blueSoft: '#E0F2FE', blueDeep: '#0284C7',
  purple: '#7C3AED', purpleSoft: '#F3E8FF', purpleDeep: '#5B21B6',
  red: '#EF4444', redSoft: '#FEE2E2', redDeep: '#DC2626',
  ink: '#0A2A20', inkSoft: '#5A6B62', inkLight: '#94A3A0',
  onGreenSoft: '#A8C9B8',
} as const;

type EventType = 'rdv' | 'reunion' | 'conge' | 'event' | 'ai' | 'pitch';
type ViewMode = 'month' | 'week' | 'day' | 'list';

interface CalEvent {
  id: string;
  type: EventType;
  title: string;
  date: Date; // start
  endDate?: Date;
  time: string; // "HH:MM"
  duration: string;
  attendees: number;
  location?: string;
  value?: string;
  ai?: boolean;
  priority?: boolean;
  description?: string;
}

const EVENT_TYPES: Record<EventType, { label: string; emoji: string; color: string; bg: string; deep: string }> = {
  rdv:     { label: 'Rendez-vous', emoji: '📅', color: C.blue,       bg: C.blueSoft,    deep: C.blueDeep },
  reunion: { label: 'Réunion',     emoji: '👥', color: C.purple,     bg: C.purpleSoft,  deep: C.purpleDeep },
  conge:   { label: 'Congé',       emoji: '🌴', color: C.terracotta, bg: C.terraSoft,   deep: C.terraDeep },
  event:   { label: 'Événement',   emoji: '🎉', color: C.sage,       bg: C.sageSoft,    deep: C.sageDark },
  ai:      { label: 'AI',          emoji: '🤖', color: C.indigo,     bg: C.indigoSoft,  deep: C.indigoDeep },
  pitch:   { label: 'Pitch',       emoji: '🚀', color: C.gold,       bg: C.goldSoft,    deep: C.goldDark },
};

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAY_HEADERS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtTime(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function diffMinutes(a: Date, b?: Date) {
  if (!b) return 30;
  return Math.max(15, Math.round((b.getTime() - a.getTime()) / 60000));
}
function fmtDuration(mins: number) {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${pad(m)}`;
}
function parseDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v);
  if (typeof v === 'string') { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  if (typeof v === 'object') {
    const obj = v as { _seconds?: number; seconds?: number; toDate?: () => Date };
    if (typeof obj.toDate === 'function') return obj.toDate();
    const s = obj._seconds ?? obj.seconds;
    if (typeof s === 'number') return new Date(s * 1000);
  }
  return null;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay() === 0 ? 6 : date.getDay() - 1; // Mon=0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  .cal-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .cal-mono { font-family: 'JetBrains Mono', monospace; }
  .cal-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }
  .cal-icon-btn { width: 34px; height: 34px; border-radius: 9px; background: ${C.cyanSoft}; color: ${C.cyanDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; flex-shrink: 0; }
  .cal-icon-btn:hover { background: ${C.cyanDeep}; color: ${C.cream}; }
  .cal-icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .cal-icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${C.cyanDeep}; }
  .cal-grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  .cal-live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.cyan}; position: relative; flex-shrink: 0; }
  .cal-live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.cyan}; opacity: 0.4; animation: calPulse 1.8s ease-in-out infinite; }
  @keyframes calPulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.6); opacity: 0; } }
  @keyframes calRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .cal-rotate { animation: calRotate 30s linear infinite; }
  @keyframes calFloat { 0%,100% { transform: translateY(0) rotate(0deg); opacity: 0.5; } 50% { transform: translateY(-8px) rotate(180deg); opacity: 1; } }
  .cal-float { animation: calFloat 4s ease-in-out infinite; }
  @keyframes calShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  .cal-shimmer { background: linear-gradient(90deg, ${C.cyanLight}, ${C.gold}, ${C.cyanLight}, ${C.gold}, ${C.cyanLight}); background-size: 200% auto; background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: calShimmer 4s linear infinite; }
  @keyframes calUrgent { 0%,100% { box-shadow: 0 0 0 0 ${C.gold}80; } 50% { box-shadow: 0 0 0 6px ${C.gold}00; } }
  .cal-urgent { animation: calUrgent 2s ease-in-out infinite; }
  @keyframes calFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .cal-fade { animation: calFadeIn 0.3s ease-out; }
  .cal-event:hover { filter: brightness(0.95); transform: translateX(1px); }
  @media (max-width: 1024px) {
    .cal-sidebar { display: none !important; }
    .cal-shell { padding: 14px !important; }
    .cal-mobile-toolbar { display: flex !important; }
  }
  @media (max-width: 768px) {
    .cal-hide-mobile { display: none !important; }
    .cal-hero-title { font-size: 24px !important; }
    .cal-shell { padding: 10px !important; gap: 10px !important; }
    .cal-hero-pad { padding: 20px 18px !important; }
    .cal-month-cell { min-height: 80px !important; }
    .cal-month-grid-rows { grid-auto-rows: 80px !important; }
    .cal-event-mobile { font-size: 9px !important; padding: 2px 4px !important; }
    .cal-day-num { font-size: 11px !important; }
  }
  @media (max-width: 520px) {
    .cal-month-overflow { overflow-x: auto !important; }
    .cal-month-inner { min-width: 560px !important; }
  }
  .cal-mobile-toolbar { display: none; }
`;

export default function CalendarPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager' || (user as { superAdmin?: boolean })?.superAdmin === true;

  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [filters, setFilters] = useState<Record<EventType, boolean>>({
    rdv: true, reunion: true, conge: true, event: true, ai: true, pitch: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [appts, leaves, meetings, work] = await Promise.all([
        api.get('/appointments').then(r => r.data).catch(() => null),
        isAdmin ? api.get('/hr/leave/all').then(r => r.data).catch(() => null) : Promise.resolve(null),
        api.get('/meetings').then(r => r.data).catch(() => null),
        api.get('/marketplace/work-items?limit=100').then(r => r.data).catch(() => null),
      ]);

      const out: CalEvent[] = [];

      const apptsArr: any[] = Array.isArray(appts) ? appts : (appts?.data ?? appts?.items ?? []);
      for (const a of apptsArr) {
        const start = parseDate(a.startTime ?? a.start ?? a.date ?? a.scheduledAt ?? a.createdAt);
        if (!start) continue;
        const end = parseDate(a.endTime ?? a.end);
        out.push({
          id: `appt_${a.id ?? a._id ?? Math.random()}`,
          type: 'rdv',
          title: a.title ?? a.subject ?? a.clientName ?? 'Rendez-vous',
          date: start, endDate: end ?? undefined,
          time: fmtTime(start),
          duration: fmtDuration(diffMinutes(start, end ?? undefined)),
          attendees: typeof a.attendees === 'number' ? a.attendees : (Array.isArray(a.attendees) ? a.attendees.length : 1),
          location: a.location,
          description: a.description ?? a.notes,
        });
      }

      const leavesArr: any[] = Array.isArray(leaves) ? leaves : (leaves?.data ?? leaves?.items ?? []);
      for (const l of leavesArr) {
        const start = parseDate(l.startDate ?? l.start ?? l.from);
        const end = parseDate(l.endDate ?? l.end ?? l.to);
        if (!start) continue;
        const finalEnd = end ?? start;
        for (let d = new Date(start); d <= finalEnd; d.setDate(d.getDate() + 1)) {
          const day = new Date(d);
          out.push({
            id: `leave_${l.id ?? l._id ?? Math.random()}_${day.toISOString().slice(0, 10)}`,
            type: 'conge',
            title: `Congé · ${l.employeeName ?? l.userName ?? 'employé'}`,
            date: day, endDate: day,
            time: '00:00',
            duration: 'journée',
            attendees: 1,
            description: l.reason ?? l.type,
          });
        }
      }

      const meetArr: any[] = Array.isArray(meetings) ? meetings : (meetings?.data ?? meetings?.items ?? []);
      for (const m of meetArr) {
        const start = parseDate(m.startTime ?? m.start ?? m.scheduledAt);
        if (!start) continue;
        const end = parseDate(m.endTime ?? m.end);
        out.push({
          id: `meet_${m.id ?? m._id ?? Math.random()}`,
          type: 'reunion',
          title: m.title ?? m.subject ?? 'Réunion',
          date: start, endDate: end ?? undefined,
          time: fmtTime(start),
          duration: fmtDuration(diffMinutes(start, end ?? undefined)),
          attendees: Array.isArray(m.participants) ? m.participants.length : (m.attendees ?? 2),
          location: m.location ?? m.meetingLink,
        });
      }

      const workArr: any[] = Array.isArray(work) ? work : (work?.data ?? work?.items ?? []);
      for (const w of workArr) {
        if (w.type !== 'appointment_created' && w.type !== 'meeting_scheduled') continue;
        const data = w.data ?? {};
        const start = parseDate(data.startTime ?? data.scheduledAt ?? w.createdAt);
        if (!start) continue;
        const end = parseDate(data.endTime);
        const isPitch = (w.title ?? '').toLowerCase().includes('pitch');
        out.push({
          id: `wi_${w.id}`,
          type: isPitch ? 'pitch' : 'ai',
          title: w.title ?? 'Action IA',
          date: start, endDate: end ?? undefined,
          time: fmtTime(start),
          duration: fmtDuration(diffMinutes(start, end ?? undefined)),
          attendees: typeof data.attendees === 'number' ? data.attendees : 1,
          location: data.location,
          value: typeof data.amount === 'number' ? data.amount.toLocaleString('fr-FR') + ' FCFA' : undefined,
          ai: true,
          priority: isPitch,
          description: w.summary,
        });
      }

      setEvents(out);
    } catch {
      setEvents([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isAdmin]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!filters[e.type]) continue;
      const k = e.date.toISOString().slice(0, 10);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    for (const list of map.values()) list.sort((a, b) => a.date.getTime() - b.date.getTime());
    return map;
  }, [events, filters]);

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const todayEvents = eventsByDay.get(todayKey) ?? [];
  const monthLabel = `${MONTHS_FR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  const monthEventCount = useMemo(() => {
    const y = currentDate.getFullYear(); const m = currentDate.getMonth();
    return events.filter(e => filters[e.type] && e.date.getFullYear() === y && e.date.getMonth() === m).length;
  }, [events, filters, currentDate]);

  const priorityToday = todayEvents.filter(e => e.priority).length;
  const nextEvent = todayEvents.find(e => e.date.getTime() > today.getTime()) ?? todayEvents[0];

  const goPrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };
  const goToday = () => setCurrentDate(new Date());

  return (
    <div className="cal-shell" style={{ padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start', minHeight: '100vh', background: C.greenDeep, fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>

      <aside className="cal-sidebar" style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 90 }}>
        <button style={{
          width: '100%', justifyContent: 'center', padding: '13px',
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
          color: C.greenInk, border: 'none', borderRadius: 12,
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
          fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: `0 8px 24px -8px ${C.gold}`,
        }}>
          <Plus size={15} /> Créer un événement
        </button>

        <MiniCalendar currentDate={currentDate} setCurrentDate={setCurrentDate} eventsByDay={eventsByDay} />
        <TodayTimeline events={todayEvents} now={today} onSelect={setSelected} />
        <EventFilters filters={filters} setFilters={setFilters} />

        <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.1em', marginBottom: 10 }}>
            CALENDRIERS CONNECTÉS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { name: 'Google Calendar', emoji: '🗓️', status: 'connected' as const },
              { name: 'Outlook', emoji: '📅', status: 'available' as const },
              { name: 'Apple Calendar', emoji: '🍎', status: 'available' as const },
            ].map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: C.creamDeep, borderRadius: 8 }}>
                <span style={{ fontSize: 14 }}>{c.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.ink, flex: 1 }}>{c.name}</span>
                {c.status === 'connected'
                  ? <CheckCircle2 size={13} color={C.sageDeep} />
                  : <Plus size={13} color={C.inkLight} />}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="cal-mobile-toolbar" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={{
            flex: '1 1 160px', justifyContent: 'center', padding: '11px',
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.greenInk, border: 'none',
            borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: `0 8px 24px -8px ${C.gold}`,
          }}>
            <Plus size={14} /> Créer un événement
          </button>
          <MobileFiltersChips filters={filters} setFilters={setFilters} />
        </div>

        <CalendarHero
          view={view} setView={setView}
          monthLabel={monthLabel}
          monthCount={monthEventCount}
          todayCount={todayEvents.length}
          priorityCount={priorityToday}
          nextEvent={nextEvent}
        />

        {loading ? (
          <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center' }}>
            <CalendarIcon size={28} color={C.cyan} className="cal-rotate" style={{ marginBottom: 12 }} />
            <div className="cal-display" style={{ fontSize: 16, color: C.ink }}>Chargement…</div>
          </div>
        ) : view === 'list' ? (
          <ListView events={events.filter(e => filters[e.type])} onSelect={setSelected} />
        ) : view === 'week' ? (
          <WeekView currentDate={currentDate} eventsByDay={eventsByDay} onPrev={goPrev} onNext={goNext} onToday={goToday} onSelect={setSelected} />
        ) : view === 'day' ? (
          <DayView currentDate={currentDate} events={(eventsByDay.get(currentDate.toISOString().slice(0, 10)) ?? [])} onPrev={goPrev} onNext={goNext} onToday={goToday} onSelect={setSelected} />
        ) : (
          <MonthGrid currentDate={currentDate} eventsByDay={eventsByDay} monthLabel={monthLabel} onPrev={goPrev} onNext={goNext} onToday={goToday} onSelect={setSelected} />
        )}
      </div>

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

interface HeroProps { view: ViewMode; setView: (v: ViewMode) => void; monthLabel: string; monthCount: number; todayCount: number; priorityCount: number; nextEvent?: CalEvent }
function CalendarHero({ view, setView, monthLabel, monthCount, todayCount, priorityCount, nextEvent }: HeroProps) {
  return (
    <div style={{ position: 'relative', background: `linear-gradient(135deg, ${C.cyanDark} 0%, ${C.cyanDeep} 100%)`, borderRadius: 22, padding: '24px 28px', overflow: 'hidden', border: `1px solid ${C.cyan}40`, boxShadow: `0 20px 50px -20px ${C.cyanDeep}` }}>
      <div className="cal-grain" />
      <div className="cal-rotate" style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', border: `1px dashed ${C.gold}30`, pointerEvents: 'none' }} />
      <div className="cal-float" style={{ position: 'absolute', top: 30, right: 100, opacity: 0.6 }}><Sparkles size={18} color={C.gold} /></div>
      <div className="cal-float" style={{ position: 'absolute', top: 80, right: 240, opacity: 0.5, animationDelay: '1s' }}><Sparkles size={14} color={C.cyanLight} /></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2, gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="cal-pill" style={{ background: 'rgba(212,160,23,0.15)', color: C.goldLight, border: `1px solid ${C.gold}40`, fontWeight: 700, marginBottom: 10 }}>
            <CalendarIcon size={11} /> {monthLabel.toUpperCase()} · {monthCount} ÉVÉNEMENTS
          </div>
          <h1 className="cal-display cal-hero-title" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            <em className="cal-shimmer" style={{ fontStyle: 'italic', fontWeight: 500 }}>Calendrier</em>
          </h1>
          <p style={{ fontSize: 13, color: C.cyanLight, margin: '6px 0 14px', lineHeight: 1.4 }}>
            <strong style={{ color: C.cream }}>{todayCount} événement{todayCount > 1 ? 's' : ''}</strong> aujourd'hui
            {priorityCount > 0 && <> · <strong style={{ color: C.gold }}>{priorityCount} prioritaire{priorityCount > 1 ? 's' : ''}</strong></>}
            {nextEvent && <> · Prochain : {nextEvent.title} à {nextEvent.time}</>}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={{
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.greenInk, border: 'none',
              padding: '11px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7,
              boxShadow: `0 8px 24px -8px ${C.gold}`,
            }}>
              <Plus size={14} /> Créer un événement
            </button>
            <div style={{ display: 'inline-flex', gap: 2, background: 'rgba(255,250,240,0.08)', padding: 3, borderRadius: 10, border: '1px solid rgba(255,250,240,0.12)' }}>
              {(['month', 'week', 'day', 'list'] as ViewMode[]).map(v => {
                const labels: Record<ViewMode, string> = { month: 'Mois', week: 'Semaine', day: 'Jour', list: 'Liste' };
                return (
                  <button key={v} onClick={() => setView(v)} style={{
                    padding: '7px 14px', borderRadius: 7,
                    background: view === v ? C.cream : 'transparent',
                    color: view === v ? C.cyanDeep : C.cream,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  }}>
                    {labels[v]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {nextEvent && (
          <div className="cal-hide-mobile" style={{ background: 'rgba(255,250,240,0.06)', border: `1px solid ${C.cyan}50`, borderRadius: 16, padding: 16, minWidth: 220, backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div className="cal-live-dot" />
              <span style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: '0.1em' }}>PROCHAIN · {nextEvent.time}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.cream, marginBottom: 4 }}>{EVENT_TYPES[nextEvent.type].emoji} {nextEvent.title}</div>
            <div style={{ fontSize: 11, color: C.cyanLight, marginBottom: 8 }}>
              {nextEvent.duration} · {nextEvent.attendees} participant{nextEvent.attendees > 1 ? 's' : ''}
            </div>
            {(nextEvent.location?.startsWith('http') || nextEvent.type === 'reunion') && (
              <button style={{ width: '100%', background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.greenInk, border: 'none', padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Video size={12} /> Rejoindre
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniCalendar({ currentDate, setCurrentDate, eventsByDay }: { currentDate: Date; setCurrentDate: (d: Date) => void; eventsByDay: Map<string, CalEvent[]> }) {
  const [viewedMonth, setViewedMonth] = useState(new Date(currentDate));
  useEffect(() => { setViewedMonth(new Date(currentDate)); }, [currentDate]);
  const y = viewedMonth.getFullYear(); const m = viewedMonth.getMonth();
  const first = new Date(y, m, 1);
  const startWeekday = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  return (
    <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(10,42,32,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="cal-display" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
          {MONTHS_FR[m]} {y}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="cal-icon-btn ghost" style={{ width: 24, height: 24 }} onClick={() => setViewedMonth(new Date(y, m - 1, 1))}><ChevronLeft size={12} /></button>
          <button className="cal-icon-btn ghost" style={{ width: 24, height: 24 }} onClick={() => setViewedMonth(new Date(y, m + 1, 1))}><ChevronRight size={12} /></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: C.inkLight, padding: '2px 0', letterSpacing: '0.05em' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const date = new Date(y, m, d);
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, currentDate);
          const k = date.toISOString().slice(0, 10);
          const hasEvents = (eventsByDay.get(k)?.length ?? 0) > 0;
          return (
            <button key={i}
              onClick={() => setCurrentDate(date)}
              style={{
                aspectRatio: '1', padding: 0,
                background: isToday ? `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})` : (isSelected ? C.cyanSoft : 'transparent'),
                color: isToday ? C.cream : C.ink,
                border: 'none', borderRadius: 7,
                fontSize: 11, fontWeight: isToday ? 800 : 500,
                cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                transition: 'all 0.15s ease',
                boxShadow: isToday ? `0 6px 14px -4px ${C.cyan}` : 'none',
              }}>
              {d}
              {hasEvents && !isToday && (
                <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: C.cyan }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileFiltersChips({ filters, setFilters }: { filters: Record<EventType, boolean>; setFilters: (f: Record<EventType, boolean>) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: '1 1 100%' }}>
      {(Object.entries(EVENT_TYPES) as [EventType, typeof EVENT_TYPES[EventType]][]).map(([key, t]) => {
        const active = filters[key];
        return (
          <button key={key} onClick={() => setFilters({ ...filters, [key]: !active })} style={{
            background: active ? `${t.color}` : 'rgba(255,250,240,0.08)',
            color: active ? C.cream : C.cream,
            border: active ? 'none' : '1px solid rgba(255,250,240,0.15)',
            padding: '7px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex',
            alignItems: 'center', gap: 5, flexShrink: 0,
            boxShadow: active ? `0 6px 14px -4px ${t.color}` : 'none',
          }}>
            <span style={{ fontSize: 12 }}>{t.emoji}</span> {t.label}
          </button>
        );
      })}
    </div>
  );
}

function EventFilters({ filters, setFilters }: { filters: Record<EventType, boolean>; setFilters: (f: Record<EventType, boolean>) => void }) {
  return (
    <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(10,42,32,0.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.1em', marginBottom: 10 }}>
        TYPES D'ÉVÉNEMENTS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(Object.entries(EVENT_TYPES) as [EventType, typeof EVENT_TYPES[EventType]][]).map(([key, t]) => {
          const active = filters[key];
          return (
            <button key={key} onClick={() => setFilters({ ...filters, [key]: !active })} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'transparent',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              transition: 'all 0.15s ease',
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${t.color}`, background: active ? t.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {active && <CheckCircle2 size={11} color={C.cream} strokeWidth={3} />}
              </div>
              <span style={{ fontSize: 14 }}>{t.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.ink, flex: 1 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TodayTimeline({ events, now, onSelect }: { events: CalEvent[]; now: Date; onSelect: (e: CalEvent) => void }) {
  if (events.length === 0) return (
    <div style={{ background: `linear-gradient(135deg, ${C.cream}, ${C.creamDeep})`, borderRadius: 14, padding: 14, border: `1px solid ${C.cyan}30`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${C.cyan}, ${C.gold})` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div className="cal-live-dot" />
        <span style={{ fontSize: 10, fontWeight: 800, color: C.cyanDeep, letterSpacing: '0.1em' }}>AUJOURD'HUI</span>
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft }}>Aucun événement pour aujourd'hui.</div>
    </div>
  );
  const monthDay = `${now.getDate()} ${MONTHS_FR[now.getMonth()].slice(0, 4)}`;
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.cream}, ${C.creamDeep})`, borderRadius: 14, padding: 14, border: `1px solid ${C.cyan}30`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${C.cyan}, ${C.gold})` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div className="cal-live-dot" />
        <span style={{ fontSize: 10, fontWeight: 800, color: C.cyanDeep, letterSpacing: '0.1em' }}>AUJOURD'HUI · {monthDay.toUpperCase()}</span>
      </div>
      <h4 className="cal-display" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
        {events.length} <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>événement{events.length > 1 ? 's' : ''}</em>
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {events.map(e => {
          const t = EVENT_TYPES[e.type];
          const isPast = e.date.getTime() < now.getTime() - 60 * 60 * 1000;
          const isNow = Math.abs(e.date.getTime() - now.getTime()) < 30 * 60 * 1000;
          return (
            <div key={e.id} onClick={() => onSelect(e)} style={{
              display: 'flex', gap: 8, padding: '8px 10px',
              background: isNow ? `${t.color}15` : 'transparent',
              borderRadius: 9, border: isNow ? `1px solid ${t.color}40` : '1px solid transparent',
              opacity: isPast ? 0.5 : 1, cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative',
            }}>
              <div className="cal-mono" style={{ fontSize: 11, fontWeight: 800, color: isNow ? t.color : C.inkLight, width: 38, flexShrink: 0 }}>{e.time}</div>
              <div style={{ width: 3, alignSelf: 'stretch', background: t.color, borderRadius: 100, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: isNow ? 700 : 600, color: C.ink, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                  <span style={{ fontSize: 12 }}>{t.emoji}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                  {e.priority && <Flame size={10} className="cal-urgent" style={{ color: C.gold }} />}
                </div>
                <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 500 }}>{e.duration} · {e.attendees} pers.</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MonthGridProps { currentDate: Date; eventsByDay: Map<string, CalEvent[]>; monthLabel: string; onPrev: () => void; onNext: () => void; onToday: () => void; onSelect: (e: CalEvent) => void }
function MonthGrid({ currentDate, eventsByDay, monthLabel, onPrev, onNext, onToday, onSelect }: MonthGridProps) {
  const y = currentDate.getFullYear(); const m = currentDate.getMonth();
  const first = new Date(y, m, 1);
  const startWeekday = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevMonthDays = new Date(y, m, 0).getDate();

  const cells: { date: Date; otherMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) cells.push({ date: new Date(y, m - 1, prevMonthDays - i), otherMonth: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(y, m, d), otherMonth: false });
  while (cells.length < 42) cells.push({ date: new Date(y, m + 1, cells.length - daysInMonth - startWeekday + 1), otherMonth: true });

  const today = new Date();

  return (
    <div style={{ background: C.cream, borderRadius: 18, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', background: C.creamDeep, borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onToday} style={{
            background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`, color: C.cream, border: 'none',
            padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            Aujourd'hui
          </button>
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="cal-icon-btn ghost" onClick={onPrev}><ChevronLeft size={16} /></button>
            <button className="cal-icon-btn ghost" onClick={onNext}><ChevronRight size={16} /></button>
          </div>
          <h3 className="cal-display" style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
            <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>{monthLabel.split(' ')[0]}</em> {monthLabel.split(' ')[1]}
          </h3>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ background: C.cream, color: C.cyanDeep, border: '1.5px solid rgba(10,42,32,0.1)', padding: '8px 14px', borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Filter size={12} /> Filtres
          </button>
          <button style={{ background: C.cream, color: C.cyanDeep, border: '1.5px solid rgba(10,42,32,0.1)', padding: '8px 14px', borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ExternalLink size={12} /> Export
          </button>
        </div>
      </div>

      <div className="cal-month-overflow">
        <div className="cal-month-inner">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {DAY_HEADERS.map((d, i) => (
              <div key={d} style={{
                padding: '10px 8px', fontSize: 10, fontWeight: 800,
                color: i >= 5 ? C.terracotta : C.inkSoft, letterSpacing: '0.08em',
                background: C.creamDeep, borderBottom: '1px solid rgba(10,42,32,0.06)',
                borderRight: i < 6 ? '1px solid rgba(10,42,32,0.06)' : 'none', textAlign: 'left',
              }}>{d}</div>
            ))}
          </div>

          <div className="cal-month-grid-rows" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '120px' }}>
        {cells.map((cell, i) => {
          const k = cell.date.toISOString().slice(0, 10);
          const dayEvents = cell.otherMonth ? [] : (eventsByDay.get(k) ?? []);
          const visible = dayEvents.slice(0, 3);
          const hidden = dayEvents.length - visible.length;
          const isToday = !cell.otherMonth && sameDay(cell.date, today);
          const isWeekend = i % 7 === 5 || i % 7 === 6;
          return (
            <div key={i} className="cal-month-cell" style={{
              padding: 6,
              borderBottom: '1px solid rgba(10,42,32,0.06)',
              borderRight: (i + 1) % 7 !== 0 ? '1px solid rgba(10,42,32,0.06)' : 'none',
              background: isToday ? `${C.cyan}10` : (isWeekend ? `${C.creamDeep}40` : C.cream),
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div className="cal-mono cal-day-num" style={{
                  fontSize: 13, fontWeight: isToday ? 800 : (cell.otherMonth ? 500 : 700),
                  color: isToday ? C.cream : (cell.otherMonth ? C.inkLight : C.ink),
                  background: isToday ? `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})` : 'transparent',
                  padding: isToday ? '2px 7px' : '2px 4px', borderRadius: isToday ? 100 : 0,
                  boxShadow: isToday ? `0 4px 10px -2px ${C.cyan}` : 'none',
                }}>{cell.date.getDate()}</div>
                {dayEvents.length > 0 && !cell.otherMonth && (
                  <span className="cal-mono" style={{ fontSize: 9, fontWeight: 700, color: C.inkLight, padding: '1px 4px', background: C.creamDeep, borderRadius: 4 }}>{dayEvents.length}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                {visible.map(e => {
                  const t = EVENT_TYPES[e.type];
                  return (
                    <div key={e.id} className="cal-event cal-event-mobile"
                      onClick={ev => { ev.stopPropagation(); onSelect(e); }}
                      style={{
                        padding: '3px 6px',
                        background: e.priority ? `linear-gradient(90deg, ${C.gold}, ${C.goldDeep})` : t.bg,
                        color: e.priority ? C.greenInk : t.deep,
                        borderRadius: 5, fontSize: 10, fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        borderLeft: e.priority ? `3px solid ${C.goldDark}` : `3px solid ${t.color}`,
                        display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
                      }}>
                      <span className="cal-mono" style={{ fontWeight: 700, fontSize: 9, flexShrink: 0 }}>{e.time}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{e.title}</span>
                      {e.ai && <Sparkles size={9} style={{ flexShrink: 0 }} />}
                    </div>
                  );
                })}
                {hidden > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.cyanDeep, padding: '2px 6px', textAlign: 'center', background: C.cyanSoft, borderRadius: 5, cursor: 'pointer' }}>
                    +{hidden} autres
                  </div>
                )}
              </div>
            </div>
          );
        })}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekView({ currentDate, eventsByDay, onPrev, onNext, onToday, onSelect }: { currentDate: Date; eventsByDay: Map<string, CalEvent[]>; onPrev: () => void; onNext: () => void; onToday: () => void; onSelect: (e: CalEvent) => void }) {
  const start = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const today = new Date();
  return (
    <div style={{ background: C.cream, borderRadius: 18, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', background: C.creamDeep, borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onToday} style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`, color: C.cream, border: 'none', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Aujourd'hui</button>
        <button className="cal-icon-btn ghost" onClick={onPrev}><ChevronLeft size={16} /></button>
        <button className="cal-icon-btn ghost" onClick={onNext}><ChevronRight size={16} /></button>
        <h3 className="cal-display" style={{ fontSize: 18, fontWeight: 800, color: C.ink, margin: 0 }}>
          Semaine du <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>{start.getDate()} {MONTHS_FR[start.getMonth()].slice(0, 4)}</em>
        </h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 480 }}>
        {days.map((d, i) => {
          const k = d.toISOString().slice(0, 10);
          const dayEvents = eventsByDay.get(k) ?? [];
          const isToday = sameDay(d, today);
          return (
            <div key={i} style={{ padding: 10, borderRight: i < 6 ? '1px solid rgba(10,42,32,0.06)' : 'none', background: isToday ? `${C.cyan}08` : C.cream }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>{DAY_HEADERS[i]}</div>
                <div className="cal-mono" style={{ fontSize: 18, fontWeight: 800, color: isToday ? C.cyanDeep : C.ink }}>{d.getDate()}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dayEvents.map(e => {
                  const t = EVENT_TYPES[e.type];
                  return (
                    <div key={e.id} onClick={() => onSelect(e)} style={{
                      padding: '5px 7px', background: e.priority ? `linear-gradient(90deg, ${C.gold}, ${C.goldDeep})` : t.bg,
                      color: e.priority ? C.greenInk : t.deep, borderRadius: 6, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', borderLeft: `3px solid ${e.priority ? C.goldDark : t.color}`,
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                      <div className="cal-mono" style={{ fontSize: 9, fontWeight: 700 }}>{e.time}</div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.emoji} {e.title}</div>
                    </div>
                  );
                })}
                {dayEvents.length === 0 && <div style={{ fontSize: 11, color: C.inkLight }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ currentDate, events, onPrev, onNext, onToday, onSelect }: { currentDate: Date; events: CalEvent[]; onPrev: () => void; onNext: () => void; onToday: () => void; onSelect: (e: CalEvent) => void }) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', background: C.creamDeep, borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onToday} style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`, color: C.cream, border: 'none', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Aujourd'hui</button>
        <button className="cal-icon-btn ghost" onClick={onPrev}><ChevronLeft size={16} /></button>
        <button className="cal-icon-btn ghost" onClick={onNext}><ChevronRight size={16} /></button>
        <h3 className="cal-display" style={{ fontSize: 18, fontWeight: 800, color: C.ink, margin: 0 }}>
          {DAY_HEADERS[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]} {currentDate.getDate()} <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>{MONTHS_FR[currentDate.getMonth()]}</em>
        </h3>
      </div>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.inkLight, fontSize: 14 }}>Aucun événement ce jour.</div>
        ) : events.map(e => {
          const t = EVENT_TYPES[e.type];
          return (
            <div key={e.id} onClick={() => onSelect(e)} style={{
              display: 'flex', gap: 12, padding: 14, borderRadius: 12,
              background: e.priority ? `linear-gradient(90deg, ${C.goldSoft}, ${C.cream})` : C.creamDeep,
              border: `1px solid ${e.priority ? C.gold : t.color}30`, cursor: 'pointer',
              borderLeft: `4px solid ${e.priority ? C.gold : t.color}`,
            }}>
              <div className="cal-mono" style={{ fontSize: 13, fontWeight: 800, color: t.deep, minWidth: 60 }}>{e.time}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cal-display" style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
                  {t.emoji} {e.title} {e.priority && <Flame size={12} color={C.gold} style={{ verticalAlign: 'middle' }} />}
                </div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{e.duration} · {e.attendees} participant{e.attendees > 1 ? 's' : ''}{e.location ? ` · ${e.location}` : ''}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ events, onSelect }: { events: CalEvent[]; onSelect: (e: CalEvent) => void }) {
  const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());
  const grouped = new Map<string, CalEvent[]>();
  for (const e of sorted) {
    const k = e.date.toISOString().slice(0, 10);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(e);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[...grouped.entries()].map(([day, list]) => {
        const d = new Date(day);
        return (
          <div key={day} style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(10,42,32,0.06)' }}>
            <div className="cal-display" style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>
              {DAY_HEADERS[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()} {MONTHS_FR[d.getMonth()]} {d.getFullYear()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {list.map(e => {
                const t = EVENT_TYPES[e.type];
                return (
                  <div key={e.id} onClick={() => onSelect(e)} style={{
                    display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px',
                    background: C.creamDeep, borderRadius: 10, cursor: 'pointer',
                    borderLeft: `3px solid ${e.priority ? C.gold : t.color}`,
                  }}>
                    <span className="cal-mono" style={{ fontSize: 11, fontWeight: 800, color: t.deep, minWidth: 44 }}>{e.time}</span>
                    <span style={{ fontSize: 14 }}>{t.emoji}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                    <span style={{ fontSize: 11, color: C.inkLight }}>{e.duration}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {grouped.size === 0 && (
        <div style={{ background: C.cream, borderRadius: 14, padding: 40, textAlign: 'center', color: C.inkLight, fontSize: 14 }}>
          Aucun événement à afficher.
        </div>
      )}
    </div>
  );
}

function EventModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const t = EVENT_TYPES[event.type];
  return (
    <div onClick={onClose} className="cal-fade" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(10,42,32,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="cal-fade" style={{ background: C.cream, borderRadius: 18, maxWidth: 480, width: '100%', overflow: 'hidden', border: '1px solid rgba(10,42,32,0.1)', boxShadow: '0 30px 80px -20px rgba(0,0,0,0.3)' }}>
        <div style={{ background: event.priority ? `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})` : `linear-gradient(135deg, ${t.color}, ${t.deep})`, padding: 24, color: event.priority ? C.greenInk : C.cream, position: 'relative' }}>
          <div className="cal-grain" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,250,240,0.25)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{t.emoji}</div>
            <button onClick={onClose} style={{ background: 'rgba(255,250,240,0.2)', border: 'none', borderRadius: 10, width: 32, height: 32, color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>
          <h3 className="cal-display" style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{event.title}</h3>
          <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>{event.time} · {event.duration} · {t.label}</div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {event.location && (
              <div style={{ background: C.creamDeep, borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <MapPin size={16} color={C.cyanDeep} />
                <div>
                  <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>LIEU</div>
                  <div style={{ fontSize: 13, color: C.ink, fontWeight: 700 }}>{event.location}</div>
                </div>
              </div>
            )}
            {event.attendees > 0 && (
              <div style={{ background: C.creamDeep, borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={16} color={C.purple} />
                <div>
                  <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>PARTICIPANTS</div>
                  <div style={{ fontSize: 13, color: C.ink, fontWeight: 700 }}>{event.attendees} personne{event.attendees > 1 ? 's' : ''}</div>
                </div>
              </div>
            )}
            {event.value && (
              <div style={{ background: C.goldSoft, borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.gold}30` }}>
                <Award size={16} color={C.goldDark} />
                <div>
                  <div style={{ fontSize: 10, color: C.goldDark, fontWeight: 600 }}>MONTANT</div>
                  <div className="cal-mono" style={{ fontSize: 14, color: C.goldDark, fontWeight: 800 }}>{event.value}</div>
                </div>
              </div>
            )}
            {event.ai && (
              <div style={{ background: `linear-gradient(135deg, ${C.indigoSoft}, ${C.purpleSoft})`, borderRadius: 10, padding: 12, border: `1px solid ${C.indigo}20` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Sparkles size={12} color={C.indigo} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.indigoDeep, letterSpacing: '0.08em' }}>GÉNÉRÉ PAR L'IA</span>
                </div>
                <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.5 }}>
                  {event.description ?? 'Cet événement a été créé automatiquement par un de vos agents.'}
                </p>
              </div>
            )}
            {!event.ai && event.description && (
              <div style={{ background: C.creamDeep, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600, marginBottom: 4 }}>NOTES</div>
                <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>{event.description}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button style={{ flex: 1, justifyContent: 'center', padding: '11px', background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`, color: C.cream, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
              <Video size={14} /> Rejoindre
            </button>
            <button style={{ padding: '11px 14px', background: C.cream, color: C.cyanDeep, border: '1.5px solid rgba(10,42,32,0.1)', borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Edit3 size={14} />
            </button>
            <button style={{ padding: '11px 14px', background: C.cream, color: C.redDeep, border: `1.5px solid ${C.red}30`, borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
