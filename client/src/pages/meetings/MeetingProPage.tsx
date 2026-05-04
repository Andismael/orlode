/**
 * MeetingProPage — Agent Réunion PRO (crimson + violet accent)
 * 4 tabs: Live (record + transcribe + auto-actions) / Meetings list / Detail / Chat IA.
 * Real APIs: /meetings, /meetings/:id, /meetings/:id/transcribe, /meetings/:id/actions,
 *            /meetings/:id/detect-actions, PATCH /actions/:id.
 * Recording uses the browser MediaRecorder; on stop we upload, transcribe and extract actions.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ChevronRight, Sparkles, Clock,
  Mic, Square, Volume2, ScrollText, Captions, Bot,
  ArrowUpRight, ArrowDownRight, Minus, Calendar, Target,
  Zap, BadgeCheck, GitBranch, Lightbulb, Star, Users,
  Share2, Download, MoreVertical, Edit3, Check,
  Send, Paperclip, RefreshCw, Brain, Flame,
  TrendingUp, Headphones,
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const C = {
  greenInk: '#042A1F',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  crimson: '#E11D48', crimsonDeep: '#BE123C', crimsonDark: '#881337', crimsonSoft: '#FFE4E6', crimsonLight: '#FDA4AF',
  violet: '#7C3AED', violetDeep: '#5B21B6', violetDark: '#3B0764', violetSoft: '#F3E8FF', violetLight: '#C4B5FD',
  gold: '#D4A017', goldDeep: '#B8860B', goldDark: '#8B6914', goldSoft: '#FEF3C7',
  sage: '#10B981', sageDeep: '#059669', sageDark: '#065F46', sageSoft: '#D1FAE5',
  night: '#0A0A1A',
  red: '#EF4444', redSoft: '#FEE2E2', redDeep: '#DC2626',
  cyan: '#06B6D4', cyanSoft: '#CFFAFE', cyanDeep: '#0891B2',
  terracotta: '#E07856', terraSoft: '#FFEDE5',
  ink: '#0A2A20', inkSoft: '#5A6B62', inkLight: '#94A3A0',
  onNightSoft: '#9CA3AF',
} as const;

type Tab = 'live' | 'meetings' | 'detail' | 'chat';
type Priority = 'urgent' | 'high' | 'medium' | 'low';

interface Speaker { id: string; name: string; role?: string; color: string; initials: string; isYou?: boolean }
interface TranscriptLine { id: string; speakerId: string; text: string; time: string; actionGenerated?: boolean }
interface MeetingAction {
  id: string;
  text: string;
  assigneeId?: string;
  assigneeName?: string;
  due?: string;
  priority: Priority;
  detected?: string;
  status: string;
  autoRoute?: string;
  urgent?: boolean;
  decision?: boolean;
}
interface MeetingItem {
  id: string;
  title: string;
  date: string;
  durationMin: number;
  participants: number;
  actionsCount: number;
  decisionsCount: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  tags: string[];
  priority?: boolean;
  raw: any;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; deep: string }> = {
  urgent: { label: 'URGENT', color: C.red,        bg: C.redSoft,    deep: C.redDeep },
  high:   { label: 'HAUTE',  color: C.terracotta, bg: C.terraSoft,  deep: '#8B3F26' },
  medium: { label: 'MOYEN',  color: C.goldDark,   bg: C.goldSoft,   deep: C.goldDark },
  low:    { label: 'BAS',    color: C.sageDark,   bg: C.sageSoft,   deep: C.sageDark },
};

function getColorVar(name: 'crimson' | 'violet' | 'gold' | 'sage' | 'cyan') {
  return ({
    crimson: { main: C.crimson, deep: C.crimsonDeep, soft: C.crimsonSoft, ink: C.crimsonDark },
    violet:  { main: C.violet,  deep: C.violetDeep,  soft: C.violetSoft,  ink: C.violetDark },
    gold:    { main: C.gold,    deep: C.goldDeep,    soft: C.goldSoft,    ink: C.goldDark },
    sage:    { main: C.sage,    deep: C.sageDeep,    soft: C.sageSoft,    ink: C.sageDark },
    cyan:    { main: C.cyan,    deep: C.cyanDeep,    soft: C.cyanSoft,    ink: C.cyanDeep },
  } as const)[name];
}
function getSentimentColor(s: string) {
  if (s === 'positive') return C.sage;
  if (s === 'negative') return C.crimson;
  return C.gold;
}

function tsToMs(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string') { const d = Date.parse(v); return isNaN(d) ? 0 : d; }
  if (typeof v === 'object') {
    const s = v._seconds ?? v.seconds;
    if (typeof s === 'number') return s * 1000;
  }
  return 0;
}
function fmtRelDate(ms: number): string {
  if (!ms) return '—';
  const now = Date.now();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = today.getTime() - 86_400_000;
  const date = new Date(ms);
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  if (dayStart.getTime() === today.getTime()) return `Aujourd'hui · ${hh}:${mm}`;
  if (dayStart.getTime() === yest) return `Hier · ${hh}:${mm}`;
  const diffDays = Math.floor((now - ms) / 86_400_000);
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function fmtDuration(min: number): string {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const SPEAKER_COLORS = ['#7C3AED', '#E11D48', '#10B981', '#0EA5E9', '#D4A017', '#E07856', '#06B6D4', '#EC4899'];
function hashCode(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i); return h; }
function speakerOf(id: string, members: any[], userInitials: string, userName: string): Speaker {
  if (id === 'you' || id === 'me') {
    return { id: 'you', name: userName, role: 'Vous', color: C.violet, initials: userInitials, isYou: true };
  }
  const m = members.find(x => (x.id ?? x.uid) === id);
  if (m) {
    const name = m.displayName ?? m.name ?? m.email ?? 'Membre';
    const initials = (m.initials ?? name.split(' ').map((s: string) => s[0]).slice(0, 2).join('')).toUpperCase();
    const idx = Math.abs(hashCode(id)) % SPEAKER_COLORS.length;
    return { id, name, role: m.role, color: m.color ?? SPEAKER_COLORS[idx], initials };
  }
  const idx = Math.abs(hashCode(id || 'x')) % SPEAKER_COLORS.length;
  return { id, name: id || 'Intervenant', color: SPEAKER_COLORS[idx], initials: (id || '?').slice(0, 2).toUpperCase() };
}

function mapMeeting(raw: any): MeetingItem {
  const ms = tsToMs(raw.startTime ?? raw.createdAt ?? raw.scheduledAt);
  const endMs = tsToMs(raw.endTime);
  const dur = endMs && ms ? Math.max(1, Math.round((endMs - ms) / 60000)) : (raw.durationMin ?? raw.duration ?? 0);
  const tagsRaw: string[] = Array.isArray(raw.tags) ? raw.tags : (Array.isArray(raw.topics) ? raw.topics : []);
  return {
    id: raw.id ?? raw._id ?? '',
    title: raw.title ?? raw.subject ?? 'Réunion',
    date: fmtRelDate(ms),
    durationMin: dur,
    participants: Array.isArray(raw.participants) ? raw.participants.length : (raw.participantCount ?? 0),
    actionsCount: raw.actionsCount ?? raw.actionCount ?? (Array.isArray(raw.actions) ? raw.actions.length : 0),
    decisionsCount: raw.decisionsCount ?? 0,
    sentiment: (['positive', 'neutral', 'negative'].includes(raw.sentiment) ? raw.sentiment : 'neutral') as MeetingItem['sentiment'],
    summary: raw.summary ?? raw.tldr ?? '',
    tags: tagsRaw.slice(0, 4),
    priority: !!raw.priority,
    raw,
  };
}

function mapAction(raw: any): MeetingAction {
  const rawPrio = (raw.priority ?? 'medium').toLowerCase();
  const priority: Priority = rawPrio === 'urgent' ? 'urgent' : rawPrio === 'high' ? 'high' : rawPrio === 'low' ? 'low' : 'medium';
  return {
    id: raw.id ?? raw._id ?? '',
    text: raw.text ?? raw.title ?? raw.description ?? 'Action sans titre',
    assigneeId: raw.assigneeId ?? raw.assignee ?? raw.assignedTo,
    assigneeName: raw.assigneeName ?? raw.assignedToName,
    due: raw.due ?? raw.dueDate ?? raw.deadline,
    priority,
    detected: raw.detectedAt ?? raw.timestamp,
    status: raw.status ?? 'pending',
    autoRoute: raw.autoRoute ?? raw.routedTo,
    urgent: priority === 'urgent',
    decision: !!raw.decision,
  };
}

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  .mp-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mp-mono { font-family: 'JetBrains Mono', monospace; }
  .mp-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .mp-icon-btn { width: 34px; height: 34px; border-radius: 9px; background: ${C.crimsonSoft}; color: ${C.crimsonDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; flex-shrink: 0; }
  .mp-icon-btn:hover { background: ${C.crimsonDeep}; color: ${C.cream}; }
  .mp-icon-btn.violet { background: ${C.violetSoft}; color: ${C.violetDeep}; }
  .mp-icon-btn.violet:hover { background: ${C.violetDeep}; color: ${C.cream}; }
  .mp-icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .mp-icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${C.crimsonDeep}; }
  .mp-icon-btn.sage { background: ${C.sageSoft}; color: ${C.sageDark}; }
  .mp-icon-btn.sage:hover { background: ${C.sageDeep}; color: ${C.cream}; }
  .mp-grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  @keyframes mpPulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.6); opacity: 0; } }
  .mp-live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.sage}; position: relative; flex-shrink: 0; }
  .mp-live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.sage}; opacity: 0.4; animation: mpPulse 1.8s ease-in-out infinite; }
  @keyframes mpRecordPulse { 0%,100% { box-shadow: 0 0 0 0 ${C.crimson}80, 0 0 40px 10px ${C.crimson}30; } 50% { box-shadow: 0 0 0 16px ${C.crimson}00, 0 0 60px 20px ${C.crimson}20; } }
  .mp-record-pulse { animation: mpRecordPulse 1.8s ease-in-out infinite; }
  @keyframes mpRecordDot { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.85); opacity: 0.7; } }
  .mp-record-dot { animation: mpRecordDot 1.2s ease-in-out infinite; }
  @keyframes mpWave1 { 0%,100% { height: 8px; } 50% { height: 38px; } }
  @keyframes mpWave2 { 0%,100% { height: 14px; } 50% { height: 58px; } }
  @keyframes mpWave3 { 0%,100% { height: 22px; } 50% { height: 80px; } }
  @keyframes mpWave4 { 0%,100% { height: 18px; } 50% { height: 68px; } }
  @keyframes mpWave5 { 0%,100% { height: 10px; } 50% { height: 48px; } }
  .mp-wave-bar { width: 4px; border-radius: 100px; background: linear-gradient(180deg, ${C.crimson}, ${C.violet}); transform-origin: center; }
  @keyframes mpUrgentPulse { 0%,100% { box-shadow: 0 0 0 0 ${C.red}80; } 50% { box-shadow: 0 0 0 6px ${C.red}00; } }
  .mp-urgent { animation: mpUrgentPulse 2s ease-in-out infinite; }
  @keyframes mpRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .mp-rotate { animation: mpRotate 30s linear infinite; }
  @keyframes mpShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  .mp-shimmer { background: linear-gradient(90deg, ${C.crimsonLight}, ${C.gold}, ${C.violetLight}, ${C.gold}, ${C.crimsonLight}); background-size: 200% auto; background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: mpShimmer 4s linear infinite; }
  @keyframes mpSlideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .mp-stagger > * { animation: mpSlideIn 0.4s ease-out backwards; }
  .mp-stagger > *:nth-child(1){animation-delay:.05s}.mp-stagger > *:nth-child(2){animation-delay:.10s}.mp-stagger > *:nth-child(3){animation-delay:.15s}.mp-stagger > *:nth-child(4){animation-delay:.20s}.mp-stagger > *:nth-child(5){animation-delay:.25s}.mp-stagger > *:nth-child(n+6){animation-delay:.30s}
  .mp-card-lift { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  .mp-card-lift:hover { transform: translateY(-2px); }
  .mp-thin::-webkit-scrollbar { width: 6px; }
  .mp-thin::-webkit-scrollbar-thumb { background: rgba(10,42,32,0.15); border-radius: 100px; }
  .mp-thin-dark::-webkit-scrollbar { width: 6px; }
  .mp-thin-dark::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 100px; }
  @media (max-width: 1024px) {
    .mp-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .mp-live-grid { grid-template-columns: 1fr !important; }
    .mp-shell { padding: 14px !important; }
    .mp-detail-sidebar { display: none !important; }
  }
  @media (max-width: 768px) {
    .mp-hide-mobile { display: none !important; }
    .mp-grid-4 { grid-template-columns: 1fr !important; }
    .mp-hero-title { font-size: 24px !important; }
    .mp-shell { padding: 10px !important; gap: 10px !important; }
    .mp-hero-pad { padding: 22px 18px !important; }
  }
`;

export default function MeetingProPage() {
  const { user } = useAuthStore();
  const userName = (user as any)?.displayName ?? user?.email ?? 'Vous';
  const userInitials = (userName.split(' ').map((s: string) => s[0]).slice(0, 2).join('') || '?').toUpperCase();

  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<TranscriptLine[]>([]);
  const [liveActions, setLiveActions] = useState<MeetingAction[]>([]);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, memRes] = await Promise.all([
        api.get('/meetings').then(r => r.data).catch(() => null),
        api.get('/team/members').then(r => r.data).catch(() => null),
      ]);
      const arr: any[] = Array.isArray(mRes) ? mRes : (mRes?.data ?? mRes?.meetings ?? []);
      setMeetings(arr.map(mapMeeting).sort((a, b) => tsToMs(b.raw.startTime ?? b.raw.createdAt) - tsToMs(a.raw.startTime ?? a.raw.createdAt)));
      const memArr: any[] = Array.isArray(memRes) ? memRes : (memRes?.data?.data ?? memRes?.data ?? memRes?.members ?? []);
      setMembers(memArr);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [recording]);

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); };
      mr.start(1000);
      mediaRef.current = mr;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setLiveTranscript([]);
      setLiveActions([]);
      setRecording(true);
    } catch (e) {
      window.alert('Impossible d\'accéder au micro : ' + ((e as Error)?.message ?? String(e)));
    }
  };

  const stopRecording = async () => {
    if (!recording || !mediaRef.current) return;
    setRecording(false);
    setProcessing(true);
    try {
      await new Promise<void>(resolve => {
        const mr = mediaRef.current!;
        mr.addEventListener('stop', () => resolve(), { once: true });
        mr.stop();
      });
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
      const minutes = Math.max(1, Math.round(elapsed / 60));
      const create = await api.post('/meetings', {
        title: `Réunion du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
        durationMin: minutes,
      });
      const meetingId: string = (create.data as any)?.id ?? (create.data as any)?.data?.id ?? (create.data as any)?.meeting?.id;
      if (!meetingId) throw new Error('No meeting id');
      const fd = new FormData();
      fd.append('audio', blob, `recording-${Date.now()}.webm`);
      const tr = await api.post(`/meetings/${meetingId}/transcribe`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const transcript = (tr.data as any)?.transcript ?? (tr.data as any)?.data?.transcript ?? [];
      const lines: TranscriptLine[] = (Array.isArray(transcript) ? transcript : []).map((t: any, i: number) => ({
        id: t.id ?? `l${i}`,
        speakerId: t.speakerId ?? t.speaker ?? 'you',
        text: t.text ?? '',
        time: t.time ?? fmtElapsed(Math.round((t.startMs ?? 0) / 1000)),
      }));
      setLiveTranscript(lines);
      const detect = await api.post(`/meetings/${meetingId}/detect-actions`, {}).catch(() => null);
      const actions = (detect?.data as any)?.actions ?? (detect?.data as any)?.data?.actions ?? [];
      setLiveActions((Array.isArray(actions) ? actions : []).map(mapAction));
      load();
    } catch (e) {
      window.alert('Erreur de traitement : ' + ((e as Error)?.message ?? String(e)));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mp-shell" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: '100vh', background: C.creamDeep, fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>

      <HeroLive recording={recording} processing={processing} elapsed={elapsed} onStart={startRecording} onStop={stopRecording} />
      <TabsBar activeTab={activeTab} setActiveTab={setActiveTab} meetingsCount={meetings.length} />

      {activeTab === 'live' && (
        <LivePage recording={recording} processing={processing} transcript={liveTranscript} actions={liveActions} members={members} meetings={meetings} userName={userName} userInitials={userInitials} />
      )}
      {activeTab === 'meetings' && (
        <MeetingsListView meetings={meetings} loading={loading} onSelect={m => { setActiveMeetingId(m.id); setActiveTab('detail'); }} />
      )}
      {activeTab === 'detail' && (
        <MeetingDetailView meetingId={activeMeetingId} fallback={meetings[0]} members={members} userName={userName} userInitials={userInitials} />
      )}
      {activeTab === 'chat' && <ChatTab userName={userName} userInitials={userInitials} meetingsCount={meetings.length} />}
    </div>
  );
}

function HeroLive({ recording, processing, elapsed, onStart, onStop }: { recording: boolean; processing: boolean; elapsed: number; onStart: () => void; onStop: () => void }) {
  return (
    <div className="mp-hero-pad" style={{ position: 'relative', background: recording ? `linear-gradient(135deg, ${C.night} 0%, ${C.crimsonDark} 50%, ${C.violetDark} 100%)` : `linear-gradient(135deg, ${C.night} 0%, ${C.violetDark} 50%, ${C.crimsonDark} 100%)`, borderRadius: 24, padding: '32px 36px', overflow: 'hidden', border: recording ? `1px solid ${C.crimson}60` : `1px solid ${C.violet}40`, boxShadow: recording ? `0 0 60px -10px ${C.crimson}` : `0 20px 50px -20px ${C.violetDark}`, transition: 'all 0.3s ease' }}>
      <div className="mp-grain" />
      <div className="mp-rotate" style={{ position: 'absolute', top: -100, right: -100, width: 360, height: 360, borderRadius: '50%', border: `1px dashed ${C.gold}30`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 11, fontWeight: 600, color: 'rgba(255,250,240,0.7)', position: 'relative', zIndex: 2 }}>
        <span>Mes Agents</span>
        <ChevronRight size={11} />
        <span>Stratégie</span>
        <ChevronRight size={11} />
        <span style={{ color: C.cream, fontWeight: 700 }}>Réunion PRO</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 28, position: 'relative', zIndex: 2, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.crimson}, ${C.violet})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px -6px ${C.crimson}` }}>
              <Brain size={26} color={C.cream} strokeWidth={2} />
            </div>
            <div>
              <h1 className="mp-display mp-hero-title" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Agent <em className="mp-shimmer" style={{ fontStyle: 'italic', fontWeight: 500 }}>Réunion</em>
                <span style={{ color: C.gold, fontStyle: 'italic', fontWeight: 500 }}> PRO</span>
              </h1>
              <div style={{ fontSize: 12, color: 'rgba(255,250,240,0.85)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={11} color={C.gold} />
                <span style={{ fontWeight: 600 }}>Real-Time Business Intelligence</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,250,240,0.85)', margin: '0 0 18px', lineHeight: 1.5, maxWidth: 580 }}>
            Vos réunions transformées en <strong style={{ color: C.crimson }}>décisions exécutées</strong>. Transcription, résumé, actions auto-assignées et routées vers les bons agents.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button onClick={recording ? onStop : onStart} disabled={processing} className={recording ? 'mp-record-pulse' : ''} style={{
              width: 72, height: 72, borderRadius: '50%',
              background: recording ? `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDeep})` : `linear-gradient(135deg, ${C.crimson}, ${C.violet})`,
              border: `3px solid ${C.cream}`, color: C.cream, cursor: processing ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', boxShadow: `0 12px 40px -8px ${C.crimson}`,
              flexShrink: 0, opacity: processing ? 0.6 : 1,
            }}>
              {processing ? <RefreshCw size={28} className="mp-rotate" />
                : recording ? <div className="mp-record-dot" style={{ width: 24, height: 24, borderRadius: 4, background: C.cream }} />
                : <Mic size={32} strokeWidth={2.5} />}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {recording && (
                  <div style={{ background: C.crimson, color: C.cream, padding: '3px 9px', borderRadius: 100, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'JetBrains Mono, monospace' }}>
                    <div className="mp-record-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: C.cream }} />
                    REC · {fmtElapsed(elapsed)}
                  </div>
                )}
                <span className="mp-display" style={{ fontSize: 18, fontWeight: 700, color: C.cream, letterSpacing: '-0.02em' }}>
                  {processing ? 'Transcription en cours…' : recording ? 'Enregistrement en cours' : 'Démarrer une réunion'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,250,240,0.7)' }}>
                {processing ? 'Upload, transcription et extraction d\'actions…' : recording ? 'Micro actif · transcription auto · actions extraites à la fin' : 'Cliquez sur le micro · transcription instantanée · actions automatiques'}
              </div>
            </div>
            {recording && (
              <button onClick={onStop} style={{ background: 'rgba(255,250,240,0.1)', color: C.cream, border: '1px solid rgba(255,250,240,0.2)', padding: '11px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Square size={13} /> Arrêter & analyser
              </button>
            )}
          </div>
        </div>

        <div className="mp-hide-mobile" style={{ flex: '0 0 auto', background: 'rgba(255,250,240,0.06)', border: `1px solid ${recording ? C.crimson : C.violet}50`, borderRadius: 18, padding: 20, minWidth: 280, backdropFilter: 'blur(20px)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Volume2 size={11} color={recording ? C.crimson : C.onNightSoft} />
              <span style={{ fontSize: 9, fontWeight: 800, color: recording ? C.crimson : C.onNightSoft, letterSpacing: '0.1em' }}>
                AUDIO {recording ? '· LIVE' : '· INACTIF'}
              </span>
            </div>
            <span className="mp-mono" style={{ fontSize: 10, color: 'rgba(255,250,240,0.6)', fontWeight: 700 }}>
              {recording ? '64 kHz · 16 bit' : '—'}
            </span>
          </div>
          <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '0 8px' }}>
            {[...Array(36)].map((_, i) => {
              const animClass = recording ? `mpWave${(i % 5) + 1}` : '';
              const heights = [10, 16, 24, 30, 22, 18, 28, 36, 24, 14, 8, 18, 26, 34, 22, 16, 12, 20, 30, 26];
              return (
                <div key={i} className="mp-wave-bar" style={{
                  height: recording ? undefined : `${heights[i % heights.length]}px`,
                  animation: recording ? `${animClass} ${0.6 + (i * 0.04)}s ease-in-out infinite` : 'none',
                  opacity: recording ? 1 : 0.4,
                }} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabsBar({ activeTab, setActiveTab, meetingsCount }: { activeTab: Tab; setActiveTab: (t: Tab) => void; meetingsCount: number }) {
  const tabs: { id: Tab; label: string; icon: any; count: number | null; highlight?: boolean }[] = [
    { id: 'live',     label: 'Live',           icon: Mic,        count: null,           highlight: true },
    { id: 'meetings', label: 'Réunions',       icon: ScrollText, count: meetingsCount },
    { id: 'detail',   label: 'Réunion détail', icon: Captions,   count: null },
    { id: 'chat',     label: 'Chat IA',        icon: Bot,        count: null },
  ];
  return (
    <div className="mp-thin" style={{ background: C.cream, borderRadius: 14, padding: 6, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', gap: 4, overflowX: 'auto' }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        return (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: active ? `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDeep})` : 'transparent',
            color: active ? C.cream : C.inkSoft,
            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: active ? `0 6px 14px -4px ${C.crimson}` : 'none',
            flexShrink: 0, transition: 'all 0.2s ease', position: 'relative',
          }}>
            <Icon size={14} strokeWidth={2} />
            {t.label}
            {t.count !== null && (
              <span className="mp-mono" style={{ background: active ? 'rgba(255,250,240,0.25)' : C.creamDeep, color: active ? C.cream : C.inkSoft, padding: '1px 7px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>{t.count}</span>
            )}
            {t.highlight && !active && (
              <div className="mp-record-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: C.crimson, marginLeft: 2 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface LivePageProps { recording: boolean; processing: boolean; transcript: TranscriptLine[]; actions: MeetingAction[]; members: any[]; meetings: MeetingItem[]; userName: string; userInitials: string }
function LivePage({ recording, processing, transcript, actions, members, meetings, userName, userInitials }: LivePageProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    const monthMeetings = meetings.filter(m => tsToMs(m.raw.startTime ?? m.raw.createdAt) >= monthStart);
    const weekMeetings = meetings.filter(m => tsToMs(m.raw.startTime ?? m.raw.createdAt) >= weekStart);
    const totalActions = meetings.reduce((s, m) => s + m.actionsCount, 0);
    const totalHours = monthMeetings.reduce((s, m) => s + m.durationMin, 0) / 60;
    return { monthCount: monthMeetings.length, weekCount: weekMeetings.length, totalActions, totalHours: totalHours.toFixed(1) };
  }, [meetings]);

  const cards: { id: string; label: string; value: string; sub: string; trend: 'up' | 'down' | 'flat'; icon: any; color: 'crimson' | 'violet' | 'gold' | 'sage' }[] = [
    { id: 'meetings', label: 'Réunions ce mois', value: String(stats.monthCount),   sub: 'temps réel',                trend: 'up',   icon: Mic,      color: 'crimson' },
    { id: 'week',     label: 'Cette semaine',     value: String(stats.weekCount),    sub: 'live count',                trend: 'up',   icon: Calendar, color: 'violet' },
    { id: 'actions',  label: 'Actions extraites', value: String(stats.totalActions), sub: 'cumul global',              trend: 'up',   icon: Target,   color: 'gold' },
    { id: 'hours',    label: 'Heures ce mois',    value: stats.totalHours,           sub: `${stats.monthCount} réunions`, trend: 'flat', icon: Clock,    color: 'sage' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="mp-grid-4 mp-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {cards.map(s => {
          const colors = getColorVar(s.color);
          const Icon = s.icon;
          const TrendIcon = s.trend === 'up' ? ArrowUpRight : s.trend === 'down' ? ArrowDownRight : Minus;
          return (
            <div key={s.id} className="mp-card-lift" style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${colors.main}, ${colors.deep})` }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: colors.soft, color: colors.deep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} />
                </div>
                <span className="mp-pill" style={{ background: C.sageSoft, color: C.sageDark, fontWeight: 700, fontSize: 10 }}>
                  <TrendIcon size={9} /> live
                </span>
              </div>
              <div className="mp-display mp-mono" style={{ fontSize: 26, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginTop: 4 }}>{s.label}</div>
              <div style={{ fontSize: 9, color: C.inkSoft, marginTop: 1 }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="mp-live-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <LiveTranscriptPanel recording={recording} processing={processing} lines={transcript} members={members} userName={userName} userInitials={userInitials} />
        <LiveActionsPanel recording={recording} processing={processing} actions={actions} members={members} userName={userName} userInitials={userInitials} />
      </div>
    </div>
  );
}

function LiveTranscriptPanel({ recording, processing, lines, members, userName, userInitials }: { recording: boolean; processing: boolean; lines: TranscriptLine[]; members: any[]; userName: string; userInitials: string }) {
  return (
    <div style={{ background: C.night, borderRadius: 18, border: `1px solid ${C.violet}30`, overflow: 'hidden', position: 'relative', height: 580, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px', background: 'linear-gradient(180deg, rgba(124,58,237,0.15), transparent)', borderBottom: `1px solid ${C.violet}20`, display: 'flex', alignItems: 'center', gap: 10 }}>
        {recording ? (
          <>
            <div className="mp-record-dot" style={{ width: 10, height: 10, borderRadius: '50%', background: C.crimson }} />
            <span className="mp-mono" style={{ fontSize: 10, fontWeight: 800, color: C.crimson, letterSpacing: '0.12em' }}>LIVE TRANSCRIPT · IA EN TEMPS RÉEL</span>
          </>
        ) : (
          <>
            <Captions size={13} color={C.onNightSoft} />
            <span className="mp-mono" style={{ fontSize: 10, fontWeight: 800, color: C.onNightSoft, letterSpacing: '0.12em' }}>TRANSCRIPT · {processing ? 'TRAITEMENT' : 'INACTIF'}</span>
          </>
        )}
      </div>

      <div className="mp-thin-dark" style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {processing ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.onNightSoft }}>
            <RefreshCw size={48} strokeWidth={1.5} className="mp-rotate" style={{ marginBottom: 14 }} />
            <h4 className="mp-display" style={{ fontSize: 16, color: C.cream, margin: '0 0 6px', fontWeight: 600 }}>Transcription en cours…</h4>
            <p style={{ fontSize: 12, margin: 0, opacity: 0.7 }}>Ça peut prendre quelques secondes selon la durée.</p>
          </div>
        ) : lines.length === 0 && !recording ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.onNightSoft }}>
            <Mic size={48} strokeWidth={1.5} style={{ opacity: 0.3, marginBottom: 14 }} />
            <h4 className="mp-display" style={{ fontSize: 16, color: C.cream, margin: '0 0 6px', fontWeight: 600 }}>Cliquez sur le micro pour démarrer</h4>
            <p style={{ fontSize: 12, margin: 0, opacity: 0.7 }}>La transcription apparaîtra ici après l'enregistrement.</p>
          </div>
        ) : lines.length === 0 && recording ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.onNightSoft }}>
            <Headphones size={48} strokeWidth={1.5} style={{ opacity: 0.5, marginBottom: 14, color: C.crimson }} />
            <h4 className="mp-display" style={{ fontSize: 16, color: C.cream, margin: '0 0 6px', fontWeight: 600 }}>Enregistrement en cours…</h4>
            <p style={{ fontSize: 12, margin: 0, opacity: 0.7 }}>La transcription s'affichera à la fin de la réunion.</p>
          </div>
        ) : lines.map(l => {
          const sp = speakerOf(l.speakerId, members, userInitials, userName);
          return (
            <div key={l.id} style={{ display: 'flex', gap: 12, padding: 8, borderRadius: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${sp.color}, ${sp.color}cc)`, color: C.cream, fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>{sp.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span className="mp-display" style={{ fontSize: 13, fontWeight: 700, color: C.cream, letterSpacing: '-0.01em' }}>{sp.name}</span>
                  {sp.isYou && <span className="mp-pill" style={{ background: `${C.gold}20`, color: C.gold, fontSize: 9, fontWeight: 700 }}>VOUS</span>}
                  <span className="mp-mono" style={{ fontSize: 10, color: C.onNightSoft, fontWeight: 600 }}>{l.time}</span>
                  {l.actionGenerated && (
                    <span className="mp-pill" style={{ background: `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})`, color: C.cream, fontSize: 9, fontWeight: 800, boxShadow: `0 4px 12px -3px ${C.violet}` }}>
                      <Zap size={9} /> ACTION DÉTECTÉE
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: C.cream, margin: 0, lineHeight: 1.6, fontWeight: 400 }}>{l.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveActionsPanel({ recording, processing, actions, members, userName, userInitials }: { recording: boolean; processing: boolean; actions: MeetingAction[]; members: any[]; userName: string; userInitials: string }) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden', height: 580, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px', background: `linear-gradient(135deg, ${C.violetSoft}, ${C.crimsonSoft})`, borderBottom: '1px solid rgba(10,42,32,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Zap size={14} color={C.violet} />
          <span className="mp-mono" style={{ fontSize: 10, fontWeight: 800, color: C.violetDeep, letterSpacing: '0.12em' }}>ACTIONS DÉTECTÉES · TEMPS RÉEL</span>
          {actions.length > 0 && (
            <span className="mp-pill" style={{ background: C.violet, color: C.cream, fontSize: 9, fontWeight: 800, marginLeft: 'auto' }}>
              {actions.length} {actions.length > 1 ? 'NOUVELLES' : 'NOUVELLE'}
            </span>
          )}
        </div>
        <h3 className="mp-display" style={{ fontSize: 17, fontWeight: 800, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
          L'IA <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>extrait</em> et <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.crimson }}>route</em>
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>Auto-assignation par speaker · Routage vers les bons agents</p>
      </div>

      <div className="mp-thin" style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {processing ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.inkLight }}>
            <RefreshCw size={32} strokeWidth={1.5} className="mp-rotate" style={{ marginBottom: 12, color: C.violet }} />
            <h4 className="mp-display" style={{ fontSize: 14, color: C.ink, margin: '0 0 4px', fontWeight: 600 }}>Extraction des actions…</h4>
          </div>
        ) : actions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.inkLight }}>
            <Zap size={40} strokeWidth={1.5} style={{ opacity: 0.4, marginBottom: 12 }} />
            <h4 className="mp-display" style={{ fontSize: 14, color: C.ink, margin: '0 0 4px', fontWeight: 600 }}>
              {recording ? 'Enregistrement en cours' : "Aucune action pour l'instant"}
            </h4>
            <p style={{ fontSize: 11, margin: 0 }}>Les actions s'afficheront automatiquement après l'enregistrement.</p>
          </div>
        ) : actions.map(a => {
          const sp = speakerOf(a.assigneeId ?? '', members, userInitials, userName);
          const priority = PRIORITY_CONFIG[a.priority];
          return (
            <div key={a.id} style={{ background: a.urgent ? `${C.crimsonSoft}50` : C.creamDeep, border: a.urgent ? `1px solid ${C.crimson}40` : '1px solid rgba(10,42,32,0.06)', borderLeft: a.urgent ? `4px solid ${C.crimson}` : a.decision ? `4px solid ${C.gold}` : `4px solid ${C.violet}`, borderRadius: 12, padding: 12, cursor: 'pointer', transition: 'all 0.2s ease' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: a.urgent ? `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDeep})` : `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: a.urgent ? `0 4px 10px -3px ${C.crimson}` : `0 4px 10px -3px ${C.violet}` }}>
                  <Zap size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span className="mp-pill" style={{ background: priority.bg, color: priority.color, fontSize: 9, fontWeight: 800 }}>{priority.label}</span>
                    {a.urgent && <span className="mp-pill mp-urgent" style={{ background: C.crimson, color: C.cream, fontSize: 9, fontWeight: 800 }}>🔥</span>}
                    {a.decision && (
                      <span className="mp-pill" style={{ background: C.goldSoft, color: C.goldDark, fontSize: 9, fontWeight: 800 }}>
                        <BadgeCheck size={9} /> DÉCISION
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: C.ink, margin: 0, fontWeight: 600, lineHeight: 1.4 }}>{a.text}</p>
                </div>
              </div>
              {(a.assigneeId || a.due) && (
                <div style={{ background: C.cream, borderRadius: 9, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg, ${sp.color}, ${sp.color}cc)`, color: C.cream, fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif' }}>{sp.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: C.ink, fontWeight: 700 }}>{a.assigneeName ?? sp.name}</div>
                    {a.due && <div style={{ fontSize: 9, color: C.inkLight }}>Auto-assigné · {a.due}</div>}
                  </div>
                </div>
              )}
              {a.autoRoute && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.inkSoft, background: `${C.violet}10`, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.violet}20` }}>
                  <GitBranch size={11} color={C.violet} />
                  <span style={{ color: C.violetDeep, fontWeight: 700 }}>Routé vers :</span>
                  <span style={{ color: C.violet, fontWeight: 700 }}>{a.autoRoute}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {actions.length > 0 && (
        <div style={{ padding: '12px 18px', background: `linear-gradient(135deg, ${C.violetSoft}30, ${C.crimsonSoft}30)`, borderTop: '1px solid rgba(10,42,32,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>SOUS-TOTAL</div>
            <div className="mp-display" style={{ fontSize: 16, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>
              {actions.length} action{actions.length > 1 ? 's' : ''} · {actions.filter(a => a.urgent).length} urgente{actions.filter(a => a.urgent).length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingsListView({ meetings, loading, onSelect }: { meetings: MeetingItem[]; loading: boolean; onSelect: (m: MeetingItem) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'priority' | 'positive' | 'today'>('all');
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const filtered = meetings.filter(m => {
    const ms = tsToMs(m.raw.startTime ?? m.raw.createdAt);
    if (search && !m.title.toLowerCase().includes(search.toLowerCase()) && !m.summary.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'priority' && !m.priority) return false;
    if (filter === 'positive' && m.sentiment !== 'positive') return false;
    if (filter === 'today' && ms < today.getTime()) return false;
    return true;
  });

  const filters = [
    { id: 'all',      label: 'Toutes',       count: meetings.length, color: C.crimson },
    { id: 'priority', label: 'Prioritaires', count: meetings.filter(m => m.priority).length, color: C.gold },
    { id: 'positive', label: 'Positives',    count: meetings.filter(m => m.sentiment === 'positive').length, color: C.sage },
    { id: 'today',    label: "Aujourd'hui",  count: meetings.filter(m => tsToMs(m.raw.startTime ?? m.raw.createdAt) >= today.getTime()).length, color: C.violet },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 12, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {filters.map(f => {
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'transparent',
                color: active ? C.cream : C.inkSoft,
                padding: '7px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: active ? 'none' : '1px solid rgba(10,42,32,0.1)', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
              }}>
                {f.label}
                <span className="mp-mono" style={{ background: active ? 'rgba(255,250,240,0.25)' : C.creamDeep, color: active ? C.cream : C.inkSoft, padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800 }}>{f.count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, background: C.creamDeep, borderRadius: 10, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={13} color={C.inkSoft} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans transcriptions, sujets…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: C.ink, fontFamily: 'inherit', minWidth: 0 }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center' }}>
          <RefreshCw size={28} color={C.crimson} className="mp-rotate" style={{ marginBottom: 12 }} />
          <div className="mp-display" style={{ fontSize: 16, color: C.ink }}>Chargement…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.15)' }}>
          <ScrollText size={48} color={C.inkLight} style={{ marginBottom: 12 }} />
          <h3 className="mp-display" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px' }}>
            {meetings.length === 0 ? 'Aucune réunion enregistrée' : 'Aucune réunion ne correspond'}
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
            {meetings.length === 0 ? "Démarre une réunion depuis l'onglet Live pour voir ton historique ici." : "Essaie d'ajuster les filtres."}
          </p>
        </div>
      ) : (
        <div className="mp-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(m => {
            const sentColor = getSentimentColor(m.sentiment);
            return (
              <div key={m.id} onClick={() => onSelect(m)} className="mp-card-lift" style={{
                background: C.cream, borderRadius: 14, padding: 16,
                border: '1px solid rgba(10,42,32,0.06)',
                borderLeft: m.priority ? `4px solid ${C.gold}` : `4px solid ${sentColor}`,
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <h3 className="mp-display" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>{m.title}</h3>
                      {m.priority && (
                        <span className="mp-pill" style={{ background: `${C.gold}20`, color: C.goldDark, border: `1px solid ${C.gold}40`, fontSize: 9, fontWeight: 800 }}>
                          <Flame size={9} /> PRIORITAIRE
                        </span>
                      )}
                      <span className="mp-pill" style={{ background: `${sentColor}20`, color: sentColor, fontSize: 9, fontWeight: 700 }}>
                        {m.sentiment === 'positive' ? '😊 Positif' : m.sentiment === 'negative' ? '😔 Négatif' : '😐 Neutre'}
                      </span>
                    </div>
                    {m.summary && <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 8px', lineHeight: 1.5 }}>{m.summary}</p>}
                    {m.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        {m.tags.map((tag, i) => (
                          <span key={i} className="mp-pill" style={{ background: C.creamDeep, color: C.inkSoft, fontSize: 10, fontWeight: 600 }}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: C.inkLight, marginBottom: 6 }}>{m.date}</div>
                    <div className="mp-mono" style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{fmtDuration(m.durationMin)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 10, borderTop: `1px solid ${C.creamDeep}`, fontSize: 11, color: C.inkSoft }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Users size={11} />
                    <span className="mp-mono" style={{ fontWeight: 700, color: C.ink }}>{m.participants}</span>
                    participants
                  </span>
                  <span>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Zap size={11} color={C.violet} />
                    <span className="mp-mono" style={{ fontWeight: 700, color: C.violetDeep }}>{m.actionsCount}</span>
                    actions
                  </span>
                  {m.decisionsCount > 0 && (
                    <>
                      <span>·</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <BadgeCheck size={11} color={C.gold} />
                        <span className="mp-mono" style={{ fontWeight: 700, color: C.goldDark }}>{m.decisionsCount}</span>
                        décisions
                      </span>
                    </>
                  )}
                  <ChevronRight size={14} color={C.inkLight} style={{ marginLeft: 'auto' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MeetingDetailView({ meetingId, fallback, members, userName, userInitials }: { meetingId: string | null; fallback?: MeetingItem; members: any[]; userName: string; userInitials: string }) {
  const id = meetingId ?? fallback?.id ?? null;
  const [meeting, setMeeting] = useState<any>(null);
  const [actions, setActions] = useState<MeetingAction[]>([]);
  const [section, setSection] = useState<'actions' | 'summary' | 'transcript'>('actions');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get(`/meetings/${id}`).then(r => r.data).catch(() => null),
      api.get(`/meetings/${id}/actions`).then(r => r.data).catch(() => null),
    ]).then(([m, a]) => {
      setMeeting((m as any)?.data ?? m);
      const arr = Array.isArray(a) ? a : ((a as any)?.actions ?? (a as any)?.data ?? []);
      setActions((Array.isArray(arr) ? arr : []).map(mapAction));
    }).finally(() => setLoading(false));
  }, [id]);

  const updateAction = async (actionId: string, patch: any) => {
    if (!id) return;
    try {
      await api.patch(`/meetings/${id}/actions/${actionId}`, patch);
      const a = await api.get(`/meetings/${id}/actions`);
      const arr = Array.isArray(a.data) ? a.data : ((a.data as any)?.actions ?? (a.data as any)?.data ?? []);
      setActions((Array.isArray(arr) ? arr : []).map(mapAction));
    } catch { /* ignore */ }
  };

  if (!id) {
    return (
      <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.15)' }}>
        <Captions size={48} color={C.inkLight} style={{ marginBottom: 12 }} />
        <h3 className="mp-display" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px' }}>Aucune réunion sélectionnée</h3>
        <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>Choisis une réunion dans l'onglet "Réunions" pour voir son détail.</p>
      </div>
    );
  }
  if (loading || !meeting) {
    return (
      <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center' }}>
        <RefreshCw size={28} color={C.crimson} className="mp-rotate" style={{ marginBottom: 12 }} />
        <div className="mp-display" style={{ fontSize: 16, color: C.ink }}>Chargement…</div>
      </div>
    );
  }

  const m = mapMeeting(meeting);
  const transcript: TranscriptLine[] = Array.isArray(meeting.transcript) ? meeting.transcript.map((t: any, i: number) => ({
    id: t.id ?? `l${i}`, speakerId: t.speakerId ?? t.speaker ?? '', text: t.text ?? '', time: t.time ?? '—',
  })) : [];

  const sections: { id: typeof section; label: string; icon: any; count: number | null; color: string }[] = [
    { id: 'actions',    label: 'Actions',    icon: Zap,      count: actions.length, color: C.violet },
    { id: 'summary',    label: 'Résumé IA',  icon: Sparkles, count: null,           color: C.crimson },
    { id: 'transcript', label: 'Transcript', icon: Captions, count: transcript.length || null, color: C.cyan },
  ];
  const sentColor = getSentimentColor(m.sentiment);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: `linear-gradient(135deg, ${C.cream}, ${C.creamDeep})`, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
        <div className="mp-rotate" style={{ position: 'absolute', top: -80, right: -80, width: 250, height: 250, borderRadius: '50%', border: `1px dashed ${C.crimson}30`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span className="mp-pill" style={{ background: `${C.crimson}15`, color: C.crimsonDeep, border: `1px solid ${C.crimson}30`, fontWeight: 700, fontSize: 10 }}>
                <Mic size={10} /> {m.date}
              </span>
              <span className="mp-pill" style={{ background: C.creamDeep, color: C.inkSoft, fontWeight: 700, fontSize: 10 }}>
                <Clock size={10} /> {fmtDuration(m.durationMin)}
              </span>
              <span className="mp-pill" style={{ background: `${sentColor}20`, color: sentColor, fontWeight: 700, fontSize: 10 }}>
                {m.sentiment === 'positive' ? '😊 Positif' : m.sentiment === 'negative' ? '😔 Négatif' : '😐 Neutre'}
              </span>
            </div>
            <h1 className="mp-display" style={{ fontSize: 28, fontWeight: 800, color: C.ink, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{m.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
                <strong style={{ color: C.ink }}>{m.participants}</strong> participants
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.violetDeep, fontWeight: 700 }}>
                <Zap size={12} /> {actions.length} actions extraites
              </span>
              {m.decisionsCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.goldDark, fontWeight: 700 }}>
                  <BadgeCheck size={12} /> {m.decisionsCount} décisions
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={{ background: `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})`, color: C.cream, border: 'none', padding: '11px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: `0 8px 24px -8px ${C.violet}`, fontFamily: 'inherit' }}>
              <Share2 size={13} /> Partager
            </button>
            <button style={{ background: C.cream, color: C.crimsonDeep, border: '1.5px solid rgba(10,42,32,0.1)', padding: '10px 16px', borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
              <Download size={13} /> Export
            </button>
            <button className="mp-icon-btn ghost"><MoreVertical size={14} /></button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, background: C.cream, borderRadius: 14, padding: 6, border: '1px solid rgba(10,42,32,0.06)', overflowX: 'auto' }}>
        {sections.map(s => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              background: active ? `linear-gradient(135deg, ${s.color}, ${s.color}cc)` : 'transparent',
              color: active ? C.cream : C.inkSoft,
              padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: 'none', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 7,
              boxShadow: active ? `0 6px 14px -4px ${s.color}` : 'none', flexShrink: 0,
            }}>
              <Icon size={13} strokeWidth={2.5} />
              {s.label}
              {s.count !== null && (
                <span className="mp-mono" style={{ background: active ? 'rgba(255,250,240,0.25)' : C.creamDeep, color: active ? C.cream : C.inkSoft, padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>{s.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {section === 'actions' && (
        actions.length === 0 ? (
          <div style={{ background: C.cream, borderRadius: 18, padding: 40, textAlign: 'center' }}>
            <Zap size={36} color={C.inkLight} style={{ marginBottom: 8 }} />
            <div className="mp-display" style={{ fontSize: 14, color: C.ink, fontWeight: 700 }}>Aucune action extraite</div>
          </div>
        ) : (
          <div className="mp-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actions.map(a => {
              const sp = speakerOf(a.assigneeId ?? '', members, userInitials, userName);
              const priority = PRIORITY_CONFIG[a.priority];
              const done = a.status === 'done' || a.status === 'completed';
              return (
                <div key={a.id} className="mp-card-lift" style={{
                  background: C.cream, borderRadius: 12, padding: 14,
                  border: a.urgent ? `1.5px solid ${C.crimson}40` : '1px solid rgba(10,42,32,0.06)',
                  borderLeft: a.urgent ? `4px solid ${C.crimson}` : a.decision ? `4px solid ${C.gold}` : `4px solid ${C.violet}`,
                  opacity: done ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="checkbox" checked={done} onChange={() => updateAction(a.id, { status: done ? 'pending' : 'done' })} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: C.violet, flexShrink: 0 }} />
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Zap size={17} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span className="mp-display" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em', textDecoration: done ? 'line-through' : 'none' }}>{a.text}</span>
                        <span className="mp-pill" style={{ background: priority.bg, color: priority.color, fontSize: 9, fontWeight: 800 }}>{priority.label}</span>
                        {a.urgent && <span className="mp-pill mp-urgent" style={{ background: C.crimson, color: C.cream, fontSize: 9, fontWeight: 800 }}>🔥</span>}
                        {a.decision && (
                          <span className="mp-pill" style={{ background: C.goldSoft, color: C.goldDark, fontSize: 9, fontWeight: 800 }}>
                            <BadgeCheck size={9} /> DÉCISION
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: C.inkSoft, flexWrap: 'wrap' }}>
                        {a.assigneeId && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 18, height: 18, borderRadius: 5, background: `linear-gradient(135deg, ${sp.color}, ${sp.color}cc)`, color: C.cream, fontWeight: 700, fontSize: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif' }}>{sp.initials}</div>
                            <strong style={{ color: C.ink }}>{a.assigneeName ?? sp.name}</strong>
                          </span>
                        )}
                        {a.due && (
                          <>
                            <span>·</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {a.due}</span>
                          </>
                        )}
                        {a.autoRoute && (
                          <>
                            <span>·</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.violetDeep, fontWeight: 700 }}>
                              <GitBranch size={10} /> {a.autoRoute}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); updateAction(a.id, { status: 'done' }); }} className="mp-icon-btn sage" title="Marquer comme fait"><Check size={14} /></button>
                      <button className="mp-icon-btn ghost"><Edit3 size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {section === 'summary' && (
        <div style={{ background: C.cream, borderRadius: 18, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg, ${C.crimson}, ${C.violet})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} />
            </div>
            <h3 className="mp-display" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
              Résumé <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.crimson }}>généré par l'IA</em>
            </h3>
          </div>
          {m.summary ? (
            <div style={{ background: `linear-gradient(135deg, ${C.crimsonSoft}40, ${C.violetSoft}40)`, borderRadius: 14, padding: 16, border: `1px solid ${C.crimson}20`, marginBottom: 16 }}>
              <div className="mp-pill" style={{ background: `${C.crimson}20`, color: C.crimsonDeep, fontWeight: 700, marginBottom: 8, fontSize: 10 }}>
                <Lightbulb size={10} /> TL;DR
              </div>
              <p style={{ fontSize: 14, color: C.ink, margin: 0, lineHeight: 1.6, fontWeight: 500 }}>{m.summary}</p>
            </div>
          ) : (
            <div style={{ background: C.creamDeep, borderRadius: 12, padding: 30, textAlign: 'center', color: C.inkSoft, fontSize: 13 }}>
              Aucun résumé disponible pour cette réunion.
            </div>
          )}
          {Array.isArray(meeting.keyPoints) && meeting.keyPoints.length > 0 && (
            <div>
              <h4 className="mp-display" style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '-0.01em' }}>
                <Star size={14} color={C.gold} fill={C.gold} /> Points clés
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {meeting.keyPoints.map((p: string, i: number) => (
                  <div key={i} style={{ background: C.creamDeep, borderRadius: 10, padding: 12, fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{p}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'transcript' && (
        <div style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="mp-display" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
            Transcription <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyan }}>complète</em>
          </h3>
          {transcript.length === 0 ? (
            <div style={{ background: C.creamDeep, borderRadius: 12, padding: 30, textAlign: 'center', color: C.inkSoft, fontSize: 13 }}>
              Aucune transcription pour cette réunion.
            </div>
          ) : (
            <div className="mp-thin" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 600, overflowY: 'auto' }}>
              {transcript.map(l => {
                const sp = speakerOf(l.speakerId, members, userInitials, userName);
                return (
                  <div key={l.id} style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${sp.color}, ${sp.color}cc)`, color: C.cream, fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>{sp.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{sp.name}</span>
                        <span className="mp-mono" style={{ fontSize: 10, color: C.inkLight }}>{l.time}</span>
                      </div>
                      <p style={{ fontSize: 13, color: C.ink, margin: 0, lineHeight: 1.55 }}>{l.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ChatMsg { id: string; from: 'ai' | 'user'; text: string; time: string }
function ChatTab({ userName, userInitials, meetingsCount }: { userName: string; userInitials: string; meetingsCount: number }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 'welcome', from: 'ai', text: `Bonjour ${userName.split(' ')[0]} 👋 Je suis ton **Agent Réunion PRO**, le gardien de la mémoire collective de ton entreprise. ${meetingsCount} réunion${meetingsCount > 1 ? 's' : ''} indexée${meetingsCount > 1 ? 's' : ''}. Pose-moi une question.`, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [sending, setSending] = useState(false);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: `u_${Date.now()}`, from: 'user', text: msg, time: now }]);
    setInput('');
    setSending(true);
    try {
      const r = await api.post('/ai-chat', { message: msg, agent: 'meetings' }).catch(() => api.post('/chat', { message: msg, agentType: 'meetings' }));
      const reply = (r?.data as any)?.data?.response ?? (r?.data as any)?.response ?? (r?.data as any)?.reply ?? (r?.data as any)?.message ?? 'Désolé, l\'agent ne peut pas répondre pour l\'instant.';
      setMessages(prev => [...prev, { id: `a_${Date.now()}`, from: 'ai', text: reply, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    } catch {
      setMessages(prev => [...prev, { id: `a_err_${Date.now()}`, from: 'ai', text: '⚠️ Impossible de joindre l\'agent. Réessaie dans un instant.', time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    } finally { setSending(false); }
  };

  const quickPrompts = [
    { icon: ScrollText, label: 'Résume ma dernière réunion' },
    { icon: Zap,        label: 'Toutes les actions urgentes' },
    { icon: Users,      label: 'Stats participation équipe' },
    { icon: TrendingUp, label: 'Sujets récurrents du mois' },
    { icon: Calendar,   label: 'Programmer une nouvelle réunion' },
    { icon: GitBranch,  label: 'Router actions vers les agents' },
  ];

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: `linear-gradient(135deg, ${C.crimson}, ${C.violet})`, borderRadius: 16, padding: '16px 20px', color: C.cream, position: 'relative', overflow: 'hidden' }}>
          <div className="mp-grain" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(255,250,240,0.25)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={26} color={C.cream} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="mp-display" style={{ fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Agent Réunion PRO · Chat</h3>
              <div style={{ fontSize: 11, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span className="mp-live-dot" style={{ background: C.gold }} />
                Mémoire active · {meetingsCount} réunion{meetingsCount > 1 ? 's' : ''} indexée{meetingsCount > 1 ? 's' : ''}
              </div>
            </div>
            <button onClick={() => setMessages(messages.slice(0, 1))} className="mp-icon-btn" style={{ background: 'rgba(255,250,240,0.15)', color: C.cream }} title="Réinitialiser">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="mp-thin" style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', minHeight: 380, maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map(m => {
            const isUser = m.from === 'user';
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: isUser ? `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})` : `linear-gradient(135deg, ${C.crimson}, ${C.violet})`, color: isUser ? C.greenInk : C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, fontFamily: 'Fraunces, serif' }}>
                  {isUser ? userInitials : <Brain size={16} />}
                </div>
                <div style={{ maxWidth: '80%' }}>
                  <div style={{ background: isUser ? `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDeep})` : C.creamDeep, color: isUser ? C.cream : C.ink, padding: '11px 14px', borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px', fontSize: 13, lineHeight: 1.5, boxShadow: isUser ? `0 6px 14px -6px ${C.crimson}` : 'none', whiteSpace: 'pre-wrap' }}>
                    {m.text.split('**').map((part, i) =>
                      i % 2 === 1 ? <strong key={i} style={{ color: isUser ? C.gold : C.crimsonDeep }}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
                    )}
                  </div>
                  <div className="mp-mono" style={{ fontSize: 9, color: C.inkLight, marginTop: 3, textAlign: isUser ? 'right' : 'left', padding: '0 4px' }}>{m.time}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: C.cream, borderRadius: 16, padding: 14, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ background: C.creamDeep, borderRadius: 12, padding: 8, display: 'flex', alignItems: 'flex-end', gap: 6, border: '1.5px solid rgba(10,42,32,0.08)' }}>
            <button className="mp-icon-btn ghost" style={{ width: 32, height: 32 }}><Paperclip size={14} /></button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Pose une question sur tes réunions…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: C.ink, fontFamily: 'inherit', padding: '8px 4px' }}
            />
            <button className="mp-icon-btn ghost" style={{ width: 32, height: 32 }}><Mic size={14} /></button>
            <button onClick={() => send()} disabled={!input.trim() || sending} style={{ background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDeep})`, color: C.cream, border: 'none', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!input.trim() || sending) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="mp-detail-sidebar mp-hide-mobile" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 90 }}>
        <div style={{ background: C.cream, borderRadius: 16, padding: 16, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div className="mp-pill" style={{ background: C.violetSoft, color: C.violetDeep, fontWeight: 700, fontSize: 10, marginBottom: 8 }}>
            <Zap size={10} /> SUGGESTIONS RAPIDES
          </div>
          <h4 className="mp-display" style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            Que veux-tu <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>savoir</em> ?
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {quickPrompts.map((p, i) => {
              const Icon = p.icon;
              return (
                <button key={i} onClick={() => send(p.label)} style={{ background: 'transparent', border: '1px solid rgba(10,42,32,0.08)', borderRadius: 9, padding: '8px 10px', fontSize: 11, color: C.ink, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={12} color={C.violetDeep} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
