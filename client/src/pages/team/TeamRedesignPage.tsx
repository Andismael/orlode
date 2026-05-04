import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';
import {
  Search, Bell, ChevronDown, ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, ArrowUp,
  LayoutDashboard, MessageSquare, MessageCircle, Bot, UsersRound, Briefcase, Calendar,
  Store, Crown, Hammer, Plug, Settings, Shield, LogOut, Plus, Minus, Sparkles, Send,
  X, Heart, Star, Flame, Zap, Clock, Eye, Download, Upload,
  CheckCircle2, XCircle, AlertCircle, Info, Filter, Tag, FileText, File,
  Hash, AtSign, Mail, Link as LinkIcon, MoreHorizontal, MoreVertical,
  Smile, Paperclip, Mic, Phone, Video, Volume2, Headphones, Image,
  Pin, PinOff, Bookmark, BookmarkCheck, Reply, Forward, Edit3, Copy, Share2, Trash2,
  Bell as BellIcon, BellOff, Lock, Unlock, Globe, Settings2,
  TrendingUp, Activity, BarChart3, PieChart, Layers, Users,
  ThumbsUp, ThumbsDown, Award, Gift, PartyPopper, Coffee,
  CheckCheck, Check, Inbox, Archive, Folder, FolderOpen, FilePlus,
  Megaphone, Radio, MapPin, Cake, Briefcase as BriefcaseIcon,
  RefreshCw, Loader2, Save, ExternalLink, GitBranch, Cpu,
  Hand, Lightbulb, Target, Compass, FileSpreadsheet, FileImage,
  Music, FileCode, ScrollText, Calendar as CalendarIcon,
} from 'lucide-react';

// ============ PALETTE — EQUIPE (Pourpre Royal + Émeraude) ============
const C = {
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',

  // PRIMARY — Pourpre royal (communauté, présence)
  purple:      '#6D28D9',
  purpleDeep:  '#5B21B6',
  purpleDark:  '#4C1D95',
  purpleSoft:  '#EDE9FE',
  purpleLight: '#A78BFA',

  // ACCENT 1 — Émeraude (online, énergie, vie)
  emerald:     '#10B981',
  emeraldDeep: '#059669',
  emeraldDark: '#065F46',
  emeraldSoft: '#D1FAE5',
  emeraldLight:'#6EE7B7',

  // ACCENT 2 — Or pâle (mentions, highlights)
  gold:        '#FBBF24',
  goldDeep:    '#D97706',
  goldSoft:    '#FEF3C7',

  // ACCENT 3 — Rose pêche (DMs, urgent)
  pink:        '#FB7185',
  pinkDeep:    '#E11D48',
  pinkSoft:    '#FFE4E6',

  // Semantic
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  redDeep:     '#DC2626',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  blue:        '#0EA5E9',
  blueSoft:    '#E0F2FE',
  blueDeep:    '#0284C7',
  cyan:        '#06B6D4',
  cyanSoft:    '#CFFAFE',
  cyanDeep:    '#0891B2',

  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  onGreenSoft: '#A8C9B8',
};

// ============ EQUIPE PAGES ============
// Counts (badges) are computed at runtime from real data — see `countsByPage`
// inside the component. Static placeholders here so TypeScript is happy.
const EQUIPE_PAGES = [
  // MESSAGES
  { id: 'channels', label: 'Canaux',          icon: Hash,          group: 'MESSAGES', count: 0 },
  { id: 'dms',      label: 'Messages directs', icon: MessageCircle, group: 'MESSAGES', count: 0 },
  { id: 'threads',  label: 'Threads',          icon: GitBranch,     group: 'MESSAGES', count: 0 },
  { id: 'mentions', label: 'Mentions',         icon: AtSign,        group: 'MESSAGES', count: 0 },
  // ÉQUIPE
  { id: 'members',  label: 'Membres',          icon: UsersRound,    group: 'ÉQUIPE',  count: 0 },
  { id: 'activity', label: 'Activité',         icon: Activity,      group: 'ÉQUIPE',  count: 0 },
  // CONTENU
  { id: 'files',    label: 'Fichiers',         icon: Folder,        group: 'CONTENU', count: 0 },
  // ADMIN
  { id: 'settings', label: 'Paramètres',       icon: Settings2,     group: 'ADMIN',   count: 0 },
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
    background: ${C.purple}; color: ${C.cream};
    box-shadow: 0 8px 24px -8px ${C.purple};
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
  }
  .quick-action:hover {
    background: ${C.purple}; color: ${C.cream}; border-color: ${C.purple};
    transform: translateY(-1px);
  }

  .btn-primary {
    background: linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDeep} 100%);
    color: ${C.cream}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.purple};
    font-family: inherit;
  }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -8px ${C.purple};
  }

  .btn-emerald {
    background: linear-gradient(135deg, ${C.emerald} 0%, ${C.emeraldDeep} 100%);
    color: ${C.cream}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.emerald};
    font-family: inherit;
  }
  .btn-emerald:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -8px ${C.emerald};
  }

  .btn-secondary {
    background: ${C.cream}; color: ${C.purpleDeep};
    border: 1.5px solid rgba(10,42,32,0.1);
    padding: 11px 18px; border-radius: 12px;
    font-weight: 600; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease; font-family: inherit;
  }
  .btn-secondary:hover {
    background: ${C.purpleDeep}; color: ${C.cream}; border-color: ${C.purpleDeep};
  }

  .icon-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: ${C.purpleSoft}; color: ${C.purpleDeep};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none; transition: all 0.2s ease;
    flex-shrink: 0;
  }
  .icon-btn:hover { background: ${C.purpleDeep}; color: ${C.cream}; }
  .icon-btn.emerald { background: ${C.emeraldSoft}; color: ${C.emeraldDeep}; }
  .icon-btn.emerald:hover { background: ${C.emerald}; color: ${C.cream}; }
  .icon-btn.gold { background: ${C.goldSoft}; color: ${C.goldDeep}; }
  .icon-btn.gold:hover { background: ${C.gold}; color: ${C.cream}; }
  .icon-btn.danger { background: ${C.redSoft}; color: ${C.redDeep}; }
  .icon-btn.danger:hover { background: ${C.redDeep}; color: ${C.cream}; }
  .icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .icon-btn.ghost:hover { background: ${C.purpleSoft}; color: ${C.purpleDeep}; }

  .avatar {
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Fraunces', serif; font-weight: 700;
    color: ${C.cream}; flex-shrink: 0; position: relative;
  }
  .avatar-round { border-radius: 50%; }

  .input-field {
    width: 100%; background: ${C.creamDeep};
    border: 1.5px solid rgba(10,42,32,0.08);
    border-radius: 12px; padding: 12px 16px;
    font-size: 14px; color: ${C.ink};
    font-family: inherit; outline: none;
    transition: all 0.2s ease;
  }
  .input-field:focus {
    border-color: ${C.purple};
    background: ${C.cream};
    box-shadow: 0 0 0 4px ${C.purple}15;
  }

  .grain::before {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  }

  /* Status dots */
  .status-dot {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2.5px solid ${C.cream};
    position: absolute; bottom: -2px; right: -2px;
  }
  .status-online { background: ${C.emerald}; }
  .status-idle   { background: ${C.gold}; }
  .status-dnd    { background: ${C.red}; }
  .status-offline { background: ${C.inkLight}; }

  .status-online::after {
    content: ''; position: absolute; inset: -2px;
    border-radius: 50%; background: ${C.emerald};
    opacity: 0.5; animation: pulse 1.8s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.6); opacity: 0; }
  }

  /* Live dot for header */
  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: ${C.emerald}; position: relative; flex-shrink: 0;
  }
  .live-dot::after {
    content: ''; position: absolute; inset: -4px;
    border-radius: 50%; background: ${C.emerald};
    opacity: 0.4; animation: pulse 1.8s ease-in-out infinite;
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

  /* Channel tab in sidebar */
  .channel-tab {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 10px; border-radius: 8px;
    color: ${C.onGreenSoft}; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.15s ease;
    border: none; background: transparent;
    font-family: inherit; width: 100%; text-align: left;
  }
  .channel-tab:hover {
    background: rgba(255,250,240,0.06); color: ${C.cream};
  }
  .channel-tab.active {
    background: ${C.purple}; color: ${C.cream};
    box-shadow: 0 6px 16px -6px ${C.purple};
  }
  .channel-tab.unread {
    color: ${C.cream}; font-weight: 700;
  }

  /* Card lift */
  .card-lift {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .card-lift:hover { transform: translateY(-4px); }

  /* Message hover */
  .msg-row {
    padding: 10px 24px; border-radius: 0;
    transition: background 0.15s ease;
    position: relative;
  }
  .msg-row:hover {
    background: rgba(109,40,217,0.04);
  }
  .msg-row:hover .msg-actions {
    opacity: 1; transform: translateY(0);
  }

  .msg-actions {
    opacity: 0; transform: translateY(-4px);
    transition: all 0.2s ease;
    position: absolute; top: -8px; right: 24px;
    background: ${C.cream};
    border: 1px solid rgba(10,42,32,0.08);
    border-radius: 10px; padding: 4px;
    display: flex; gap: 2px;
    box-shadow: 0 8px 24px -8px rgba(10,42,32,0.2);
    z-index: 5;
  }

  /* Reaction pill */
  .reaction-pill {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 100px;
    background: ${C.purpleSoft};
    border: 1px solid ${C.purple}30;
    font-size: 12px; cursor: pointer;
    transition: all 0.15s ease;
  }
  .reaction-pill:hover {
    background: ${C.purple}; color: ${C.cream};
    border-color: ${C.purple};
    transform: scale(1.05);
  }
  .reaction-pill.mine {
    background: ${C.purpleDeep};
    color: ${C.cream};
    border-color: ${C.purpleDeep};
  }
  .reaction-pill .count {
    font-weight: 700; font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
  }
  .reaction-pill.mine .count { color: ${C.gold}; }

  /* Typing indicator */
  @keyframes typing {
    0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
    30%           { opacity: 1; transform: translateY(-3px); }
  }
  .type-1 { animation: typing 1.4s ease-in-out infinite; }
  .type-2 { animation: typing 1.4s ease-in-out infinite 0.2s; }
  .type-3 { animation: typing 1.4s ease-in-out infinite 0.4s; }

  /* Fade in */
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

  /* Spin */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spinner { animation: spin 1s linear infinite; }

  /* Bounce */
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  .bounce { animation: bounce 1s ease-in-out infinite; }

  /* Typing-dots — used by the Orlode "réfléchit" indicator */
  @keyframes typing-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-3px); opacity: 1; }
  }

  /* Shake (for urgent) */
  @keyframes shake {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-3deg); }
    75% { transform: rotate(3deg); }
  }
  .shake { animation: shake 0.5s ease-in-out infinite; }

  /* Pulse-glow for urgent */
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 0 0 ${C.red}80; }
    50%      { box-shadow: 0 0 0 8px ${C.red}00; }
  }
  .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }

  /* Wiggle */
  @keyframes wiggle {
    0%, 7%, 100% { transform: rotate(0deg); }
    3.5% { transform: rotate(-15deg); }
    5.25% { transform: rotate(12deg); }
  }
  .wiggle { animation: wiggle 3s ease-in-out infinite; display: inline-block; transform-origin: center bottom; }

  .scroll-hide::-webkit-scrollbar { display: none; }
  .scroll-hide { scrollbar-width: none; }

  .scroll-thin::-webkit-scrollbar { width: 6px; }
  .scroll-thin::-webkit-scrollbar-thumb { background: rgba(255,250,240,0.15); border-radius: 100px; }
  .scroll-thin::-webkit-scrollbar-track { background: transparent; }

  .mobile-menu-btn { display: none; }

  @media (max-width: 1280px) {
    .equipe-sidebar { width: 240px !important; }
  }

  @media (max-width: 1024px) {
    .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-charts { grid-template-columns: 1fr !important; }
  }

  @media (max-width: 900px) {
    .equipe-sidebar { display: none !important; }
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
    .hero-title { font-size: 32px !important; }
    .hide-on-mobile { display: none !important; }
  }

  @media (max-width: 480px) {
    .responsive-grid-4 { grid-template-columns: 1fr !important; }
    .hero-title { font-size: 26px !important; }
  }
`;

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

interface MemberLike {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  role?: string;
  initials?: string;
  color?: string;
  status?: string;
  isBot?: boolean;
}
function normalizeMember(raw: any): MemberLike {
  const id = raw?.id ?? raw?.uid ?? '';
  const name = raw?.displayName ?? raw?.name ?? raw?.email ?? 'Membre';
  const initials = raw?.initials ?? String(name).split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
  return {
    id,
    name,
    displayName: raw?.displayName,
    email: raw?.email,
    role: raw?.role,
    initials,
    color: raw?.color ?? '#6D28D9',
    status: raw?.status ?? 'offline',
    isBot: raw?.isBot ?? false,
  };
}
function fmtDmTime(d: any): string {
  const ts = d?._seconds ?? d?.seconds ?? (typeof d === 'string' ? new Date(d).getTime() / 1000 : (typeof d === 'number' ? d / 1000 : null));
  if (!ts) return '—';
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return 'maintenant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
  return new Date(ts * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function findMember(id: string | undefined, members: any[]): MemberLike | null {
  if (!id || !members?.length) return null;
  const found = members.find(m => (m.id ?? m.uid) === id);
  return found ? normalizeMember(found) : null;
}

// Module-level ref of the latest members list, kept in sync by the page-level
// `useTeamData` provider via a useEffect. Lets `getMember(id)` work without
// threading members through every component (10+ call sites).
let _membersRef: any[] = [];
function getMember(id: string | undefined): MemberLike {
  const m = findMember(id, _membersRef);
  if (m) return m;
  return { id: id ?? '', name: '?', initials: '?', color: '#94A3A0', status: 'offline', isBot: false };
}

// ============ AGENT ACTION CARD ============
// Renders an inline card inside a team-chat message when the agent emits a
// [[ACTION:proposalId]] marker. Lets the user [Modifier] [Valider] [Annuler]
// the proposed action (e.g. send a WhatsApp/email/Telegram to a client).
function AgentActionCard({ proposalId }: { proposalId: string }) {
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await api.get(`/team/agent-proposals/${proposalId}`);
      const data = r?.data?.data ?? r?.data;
      setProposal(data);
      setDraft(data?.draft ?? '');
    } catch {
      setProposal({ status: 'missing' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [proposalId]);

  const validate = async () => {
    if (working) return;
    setWorking(true);
    try {
      if (editing && draft !== proposal?.draft) {
        await api.patch(`/team/agent-proposals/${proposalId}`, { draft });
      }
      const r: any = await api.post(`/team/agent-proposals/${proposalId}/execute`);
      const msg = r?.data?.data?.message ?? 'Envoyé';
      toast.success('Action exécutée', msg);
      await load();
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Erreur');
    } finally {
      setWorking(false);
    }
  };

  const cancel = async () => {
    if (working) return;
    setWorking(true);
    try {
      await api.post(`/team/agent-proposals/${proposalId}/cancel`);
      await load();
    } finally {
      setWorking(false);
    }
  };

  const channelLabel: Record<string, { label: string; icon: any; color: string }> = {
    whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: '#25D366' },
    email:    { label: 'Email',    icon: Mail,          color: '#5B21B6' },
    telegram: { label: 'Telegram', icon: Send,          color: '#0088CC' },
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(109,40,217,0.04)', borderRadius: 14,
        padding: 14, border: '1px dashed rgba(109,40,217,0.25)',
        display: 'flex', alignItems: 'center', gap: 10, maxWidth: 480,
      }}>
        <Loader2 size={14} className="spin" color="#6D28D9" />
        <span style={{ fontSize: 12, color: '#5B21B6' }}>Chargement de la proposition…</span>
      </div>
    );
  }

  if (!proposal || proposal.status === 'missing') {
    return (
      <div style={{
        background: '#FEF3C7', borderRadius: 14,
        padding: 12, border: '1px solid #FBBF24',
        fontSize: 12, color: '#92400E', maxWidth: 480,
      }}>
        Proposition introuvable (peut-être supprimée).
      </div>
    );
  }

  const meta = channelLabel[proposal.channel as string] ?? { label: proposal.channel, icon: Send, color: '#6D28D9' };
  const Icon = meta.icon;
  const isPending = proposal.status === 'pending';
  const isExecuted = proposal.status === 'executed';
  const isFailed = proposal.status === 'failed';
  const isCancelled = proposal.status === 'cancelled';

  return (
    <div style={{
      background: '#FFFAF0',
      borderRadius: 14,
      border: `2px solid ${isExecuted ? '#10B981' : isFailed ? '#FB7185' : isCancelled ? '#94A3A0' : '#6D28D9'}`,
      overflow: 'hidden',
      maxWidth: 520,
      boxShadow: isPending ? '0 8px 24px -8px rgba(109,40,217,0.3)' : 'none',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        background: `linear-gradient(135deg, ${meta.color}15, ${meta.color}08)`,
        borderBottom: '1px solid rgba(10,42,32,0.06)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: meta.color, color: '#FFFAF0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0A2A20', letterSpacing: '-0.01em' }}>
            Proposition · {meta.label}
          </div>
          <div style={{ fontSize: 11, color: '#475467', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            À : <strong>{proposal.recipientName ?? proposal.recipient}</strong>
            {proposal.subject && <> · <em>{proposal.subject}</em></>}
          </div>
        </div>
        {isExecuted && <span className="pill" style={{ background: '#D1FAE5', color: '#059669', fontSize: 10 }}><CheckCheck size={10} /> Envoyé</span>}
        {isCancelled && <span className="pill" style={{ background: '#F1F5F4', color: '#475467', fontSize: 10 }}>Annulé</span>}
        {isFailed && <span className="pill" style={{ background: '#FEE2E2', color: '#E11D48', fontSize: 10 }}>Échec</span>}
      </div>

      {/* Executed banner — big visual feedback after Valider */}
      {isExecuted && (
        <div style={{
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #D1FAE5, #6EE7B780)',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid rgba(10,42,32,0.06)',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#10B981', color: '#FFFAF0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 14px -4px #10B98180',
            animation: 'scaleIn 0.4s ease-out',
          }}>
            <CheckCheck size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#065F46', letterSpacing: '-0.01em' }}>
              ✅ {meta.label} envoyé
            </div>
            <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
              à {proposal.recipientName ?? proposal.recipient}
            </div>
          </div>
        </div>
      )}

      {/* Draft body */}
      <div style={{ padding: '12px 14px' }}>
        {editing ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={Math.min(10, Math.max(3, draft.split('\n').length + 1))}
            style={{
              width: '100%', resize: 'vertical', border: '1.5px solid #6D28D940',
              borderRadius: 10, padding: '10px 12px', fontSize: 13,
              color: '#0A2A20', background: '#F5EDD6', fontFamily: 'inherit',
              outline: 'none', lineHeight: 1.55,
            }}
          />
        ) : (
          <div style={{
            fontSize: 13,
            color: isExecuted || isCancelled ? '#94A3A0' : '#0A2A20',
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: isExecuted ? 'rgba(16,185,129,0.06)' : isCancelled ? 'rgba(148,163,160,0.08)' : '#F5EDD6',
            borderRadius: 10, padding: '10px 12px',
            opacity: isExecuted || isCancelled ? 0.75 : 1,
            textDecoration: isCancelled ? 'line-through' : 'none',
          }}>
            {proposal.draft}
          </div>
        )}
        {isFailed && proposal.executionError && (
          <div style={{ marginTop: 8, padding: '10px 12px', background: '#FEE2E2', borderRadius: 8, fontSize: 12, color: '#E11D48', fontWeight: 600 }}>
            ⚠️ {proposal.executionError}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {isPending && (
        <div style={{
          padding: '10px 14px', borderTop: '1px solid rgba(10,42,32,0.06)',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          background: 'rgba(109,40,217,0.04)',
        }}>
          {!editing ? (
            <>
              <button onClick={cancel} disabled={working} className="btn-secondary" style={{ padding: '7px 12px', fontSize: 12 }}>
                <X size={12} /> Annuler
              </button>
              <button onClick={() => setEditing(true)} disabled={working} className="btn-secondary" style={{ padding: '7px 12px', fontSize: 12 }}>
                <Edit3 size={12} /> Modifier
              </button>
              <button onClick={validate} disabled={working} className="btn-primary" style={{ padding: '7px 14px', fontSize: 12 }}>
                {working ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
                Valider et envoyer
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setDraft(proposal.draft); setEditing(false); }} disabled={working} className="btn-secondary" style={{ padding: '7px 12px', fontSize: 12 }}>
                <X size={12} /> Annuler la modif
              </button>
              <button onClick={validate} disabled={working || !draft.trim()} className="btn-primary" style={{ padding: '7px 14px', fontSize: 12 }}>
                {working ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
                Valider et envoyer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============ WHATSAPP ESCALATION CARD ============
// Renders inline in the team chat when the WhatsApp handoff system posts an
// escalation. Shows customer info, the trigger message, recent history, and
// a "Reprendre par l'IA" button that hands the conversation back to the AI.
function EscalationCard({ customerPhone, customerName, reason, rawContent }: {
  customerPhone: string; customerName?: string | null; reason?: 'explicit' | 'frustration' | string; rawContent: string;
}) {
  const [resumed, setResumed] = useState(false);
  const [working, setWorking] = useState(false);

  // Extract the trigger message and history blocks from the raw content the
  // server posted. Format from humanHandoffService:
  //   "🆘 ... — <reason>\nClient: ... · <phone>\nDernier message: « <msg> »\n\n**Derniers messages :**\n• ..."
  const triggerMatch = rawContent.match(/Dernier message :\s*« (.+?) »/);
  const triggerMessage = triggerMatch?.[1] ?? '';
  const historyMatch = rawContent.match(/\*\*Derniers messages :\*\*\n([\s\S]+?)(\n\n_|\n_|$)/);
  const historyBlock = historyMatch?.[1] ?? '';
  const historyLines = historyBlock.split('\n').filter(l => l.trim().startsWith('•')).map(l => l.replace(/^•\s*/, ''));

  const reasonLabel = reason === 'frustration' ? 'Frustration détectée' : reason === 'explicit' ? 'Demande explicite' : 'Intervention requise';
  const handleResume = async () => {
    if (working) return;
    setWorking(true);
    try {
      await api.post('/whatsapp/handoff/resume', { customerPhone });
      setResumed(true);
      toast.success('IA reprend la main', `${customerPhone} — l'agent répondra à nouveau`);
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="pulse-glow" style={{
      background: '#FFFAF0',
      border: `2.5px solid ${resumed ? '#10B981' : '#EF4444'}`,
      borderRadius: 14, overflow: 'hidden',
      maxWidth: 560,
      boxShadow: resumed ? '0 8px 24px -8px rgba(16,185,129,0.3)' : '0 12px 28px -10px rgba(239,68,68,0.4)',
    }}>
      {/* Red URGENT header */}
      <div style={{
        padding: '10px 14px',
        background: resumed ? 'linear-gradient(135deg, #D1FAE5, #6EE7B7)' : 'linear-gradient(135deg, #FEE2E2, #FCA5A5)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: resumed ? '#10B981' : '#EF4444', color: '#FFFAF0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800,
        }}>
          {resumed ? '✓' : '🆘'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: resumed ? '#065F46' : '#991B1B', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {resumed ? '✅ IA REPRISE' : '🔴 CLIENT EN ATTENTE'}
          </div>
          <div style={{ fontSize: 11, color: resumed ? '#059669' : '#7F1D1D', fontWeight: 600 }}>
            {reasonLabel}
          </div>
        </div>
      </div>

      {/* Customer info + trigger */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            color: '#FFFAF0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>📱</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: '#0A2A20' }}>
              {customerName || 'Client'}
            </div>
            <div className="mono-font" style={{ fontSize: 11, color: '#475467', fontWeight: 600 }}>
              +{customerPhone}
            </div>
          </div>
        </div>

        {triggerMessage && (
          <div style={{
            background: '#F5EDD6', borderRadius: 10, padding: '10px 12px',
            fontSize: 13, color: '#0A2A20', lineHeight: 1.55,
            borderLeft: `3px solid ${resumed ? '#10B981' : '#EF4444'}`,
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Message déclencheur
            </div>
            « {triggerMessage} »
          </div>
        )}

        {historyLines.length > 0 && (
          <details style={{ marginBottom: 10 }}>
            <summary style={{ fontSize: 11, color: '#475467', fontWeight: 600, cursor: 'pointer' }}>
              Voir les {historyLines.length} derniers messages
            </summary>
            <div style={{
              marginTop: 6, padding: '8px 12px',
              background: '#F5EDD6', borderRadius: 8,
              fontSize: 11, color: '#475467', lineHeight: 1.6,
            }}>
              {historyLines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </details>
        )}
      </div>

      {/* Action footer */}
      {!resumed && (
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid rgba(10,42,32,0.06)',
          background: 'rgba(239,68,68,0.04)',
          display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, color: '#7F1D1D', fontWeight: 600 }}>
            ⏱ Timeout auto IA après 5 min sans réponse
          </span>
          <button onClick={handleResume} disabled={working} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
            {working ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
            J'ai répondu — Reprendre IA
          </button>
        </div>
      )}
    </div>
  );
}

// ============ AVATAR COMPONENT ============
function Avatar({ memberId, size = 36, showStatus = true, member: memberOverride }: { memberId?: string; size?: number; showStatus?: boolean; member?: MemberLike | null }) {
  const { members } = useTeamData();
  const m = memberOverride ?? findMember(memberId, members) ?? { id: memberId ?? '', name: '?', initials: '?', color: '#94A3A0', status: 'offline', isBot: false };
  return (
    <div className="avatar avatar-round" style={{
      width: size, height: size,
      background: `linear-gradient(135deg, ${m.color}, ${m.color}cc)`,
      fontSize: size * 0.4,
      boxShadow: `0 4px 12px -4px ${m.color}`,
    }}>
      {m.isBot ? <Bot size={size * 0.5} /> : m.initials}
      {showStatus && m.status && (
        <div className={`status-dot status-${m.status}`} style={{
          width: Math.max(8, size * 0.28),
          height: Math.max(8, size * 0.28),
        }}></div>
      )}
    </div>
  );
}

// ============ CHROME ============
function Chrome({ children, currentPage, setCurrentPage }: any) {
  const groups = ['MESSAGES', 'ÉQUIPE', 'CONTENU', 'ADMIN'];
  const { company } = useAuthStore();
  const { members: liveMembers, channels: liveChannelsRaw, dms: liveDms, threads: liveThreads, mentions: liveMentions } = useTeamData();
  const onlineCount = liveMembers.filter((m: any) => m.status === 'online').length;
  const totalCount = liveMembers.length;
  const sidebarChannels: any[] = (liveChannelsRaw ?? []).slice(0, 5).map((c: any) => ({
    id: c.id,
    name: c.name ?? c.id,
    emoji: c.emoji ?? '#',
    unread: c.unreadCount ?? 0,
    urgent: c.urgent ?? false,
  }));

  // Real-time counts for the sidebar badges. Mentions count = unread mentions
  // only (read ones don't deserve a badge). Threads = currently active.
  const unreadMentions = (liveMentions ?? []).filter((m: any) => !m.read).length;
  const countsByPage: Record<string, number> = {
    channels: (liveChannelsRaw ?? []).length,
    dms:      (liveDms ?? []).length,
    threads:  (liveThreads ?? []).length,
    mentions: unreadMentions,
    members:  liveMembers.length,
  };
  const onlineMembers: any[] = liveMembers.filter((m: any) => m.status === 'online').slice(0, 5);
  const remainingOnline = Math.max(0, onlineCount - onlineMembers.length);

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* EQUIPE SIDEBAR — sidebar/header globaux gérés par le layout corpmind-ai */}
        <aside className="equipe-sidebar" style={{
          width: 260, background: C.greenDark,
          borderRight: '1px solid rgba(255,250,240,0.06)',
          padding: '20px 12px',
          display: 'flex', flexDirection: 'column',
          flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
        }}>
          {/* Workspace header */}
          <div style={{ padding: '0 4px 14px', marginBottom: 12, borderBottom: '1px solid rgba(255,250,240,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.cream,
                boxShadow: `0 8px 20px -8px ${C.purple}`,
              }}>
                <UsersRound size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display-font" style={{ fontWeight: 700, fontSize: 15, color: C.cream, letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {company?.name ?? 'Workspace'}
                </div>
                <div style={{ fontSize: 10, color: C.onGreenSoft, fontWeight: 500 }}>
                  {totalCount > 0 ? (
                    <><span style={{ color: C.emeraldLight }}>● {onlineCount} en ligne</span> · {totalCount} membre{totalCount > 1 ? 's' : ''}</>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
              <ChevronDown size={14} color={C.onGreenSoft} style={{ cursor: 'pointer' }} />
            </div>
            {/* New message btn */}
            <button style={{
              width: '100%', marginTop: 6,
              background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
              color: C.cream, border: 'none',
              padding: '8px 10px', borderRadius: 9,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: `0 6px 16px -6px ${C.purple}`,
            }}>
              <Edit3 size={13} /> Nouveau message
            </button>
          </div>

          {/* Tabs */}
          <div className="scroll-thin" style={{ overflowY: 'auto', flex: 1 }}>
            {groups.map(group => (
              <div key={group} style={{ marginBottom: 14 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                  color: C.onGreenSoft, padding: '0 8px 4px',
                }}>
                  <span>{group}</span>
                  {group === 'MESSAGES' && (
                    <button
                      onClick={() => setCurrentPage('channels')}
                      title="Voir les canaux"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.onGreenSoft, padding: 2, display: 'inline-flex' }}>
                      <Plus size={12} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {EQUIPE_PAGES.filter(p => p.group === group).map(page => {
                    const Icon = page.icon;
                    const active = currentPage === page.id;
                    const count = countsByPage[page.id] ?? 0;
                    return (
                      <button key={page.id} className={`channel-tab ${active ? 'active' : ''} ${count > 0 ? 'unread' : ''}`} onClick={() => setCurrentPage(page.id)}>
                        <Icon size={14} strokeWidth={1.75} />
                        <span style={{ flex: 1 }}>{page.label}</span>
                        {count > 0 && (
                          <span style={{
                            background: active ? 'rgba(255,250,240,0.25)' : C.gold,
                            color: active ? C.cream : C.purpleDeep,
                            fontSize: 10, fontWeight: 700,
                            padding: '2px 6px', borderRadius: 100,
                            minWidth: 18, textAlign: 'center',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quick channels */}
            <div style={{ marginTop: 4 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                color: C.onGreenSoft, padding: '0 8px 4px',
              }}>
                <span>CANAUX RAPIDES</span>
                <button
                  onClick={() => setCurrentPage('channels')}
                  title="Voir tous les canaux"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.onGreenSoft, padding: 2, display: 'inline-flex' }}>
                  <Plus size={12} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {sidebarChannels.length === 0 ? (
                  <div style={{ fontSize: 11, color: C.onGreenSoft, padding: '6px 10px' }}>Aucun canal</div>
                ) : sidebarChannels.map((ch: any) => (
                  <button key={ch.id} onClick={() => setCurrentPage?.('channels')} className={`channel-tab ${ch.unread > 0 ? 'unread' : ''}`}>
                    <span style={{ fontSize: 14 }}>{ch.emoji}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                    {ch.urgent && <Flame size={11} className="shake" style={{ color: C.red }} />}
                    {ch.unread > 0 && (
                      <span style={{
                        background: ch.urgent ? C.red : C.purpleDeep,
                        color: C.cream,
                        fontSize: 10, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 100,
                        minWidth: 18, textAlign: 'center',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>{ch.unread}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status widget */}
          <div style={{
            marginTop: 12,
            background: `linear-gradient(135deg, ${C.purpleDark}50, ${C.emeraldDark}30)`,
            border: `1px solid ${C.purple}40`,
            borderRadius: 12, padding: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div className="live-dot"></div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: C.cream }}>
                ÉQUIPE ACTIVE
              </span>
            </div>
            <div style={{ display: 'flex', marginTop: 6 }}>
              {onlineMembers.length === 0 ? (
                <span style={{ fontSize: 11, color: C.onGreenSoft }}>—</span>
              ) : onlineMembers.map((m: any, i: number) => (
                <div key={m.id ?? m.uid ?? i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <Avatar memberId={m.id ?? m.uid} size={26} showStatus={false} />
                </div>
              ))}
              {remainingOnline > 0 && (
                <div style={{
                  marginLeft: -8,
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(255,250,240,0.12)',
                  border: `2px solid ${C.greenDark}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: C.cream,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>+{remainingOnline}</div>
              )}
            </div>
          </div>
        </aside>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.greenDeep }}>
          {children}
        </main>
      </div>
    </div>
  );
}
// ============ PAGE: CANAUX (Main chat) ============
function ChannelsPage() {
  const { channels: liveChannels, members: liveMembers, refresh } = useTeamData();
  const { user } = useAuthStore();
  const myUid = user?.uid ?? '';
  // Fallback identity for the current user — used when their uid isn't in the
  // team `members` collection yet (e.g. company owner who never accepted an invite).
  // Without this, their own messages render with name "?" and a "?" avatar.
  const myDisplayName = (user as any)?.displayName ?? (user as any)?.name ?? (user as any)?.email?.split('@')[0] ?? 'Moi';
  const meAsMember = {
    id: myUid,
    name: myDisplayName,
    initials: myDisplayName.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() || 'M',
    color: '#6D28D9',
    status: 'online' as const,
    isBot: false,
    isYou: true,
  };
  // Map live channels to the UI shape (no demo fallback — real data only)
  const channels = liveChannels.map((c: any) => ({
    id: c.id,
    name: c.name ?? c.id,
    icon: '#',
    emoji: c.emoji ?? '#',
    desc: c.description ?? '',
    members: c.memberCount ?? 0,
    unread: c.unreadCount ?? 0,
    pinned: c.pinned ?? false,
    category: c.category ?? c.type?.toUpperCase() ?? 'GÉNÉRAL',
    lastActivity: c.lastMessageAt ? '—' : '—',
    urgent: c.urgent ?? false,
    private: c.private ?? false,
  }));

  const [activeChannel, setActiveChannel] = useState(channels[0]?.id ?? 'general');
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [pickerMsg, setPickerMsg] = useState(null);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  // Suggestion menu: 5 prefilled @orlode commands the user can drop into the input.
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Typing indicator: when user posts a message mentioning @orlode/@bot/@ai/@assistant
  // we optimistically show "Orlode réfléchit…" until the agent reply lands or 30s timeout.
  const [agentTypingSince, setAgentTypingSince] = useState<number | null>(null);
  // Reference to the message textarea so the formatting toolbar can wrap the
  // current selection (or insert a marker at the caret) in markdown syntax.
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Insert markdown around the current selection. If nothing selected,
  // inserts the marker pair and places the caret between them.
  const wrapSelection = (before: string, after: string = before) => {
    const ta = inputRef.current;
    if (!ta) {
      // No textarea ref yet — append at end as a fallback.
      setInput(prev => `${prev}${before}${after}`);
      return;
    }
    const start = ta.selectionStart ?? input.length;
    const end = ta.selectionEnd ?? input.length;
    const selected = input.slice(start, end);
    const next = input.slice(0, start) + before + selected + after + input.slice(end);
    setInput(next);
    // Restore caret/selection inside the wrapped text on the next tick.
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + before.length + selected.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  const insertAtCaret = (text: string) => {
    const ta = inputRef.current;
    if (!ta) { setInput(prev => prev + text); return; }
    const start = ta.selectionStart ?? input.length;
    const end = ta.selectionEnd ?? input.length;
    const next = input.slice(0, start) + text + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + text.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  // Update active channel if list changes
  useEffect(() => {
    if (channels.length > 0 && !channels.find((c: any) => c.id === activeChannel)) {
      setActiveChannel(channels[0].id);
    }
  }, [channels, activeChannel]);

  // Fetch messages for active channel — merges with optimistic messages so
  // a fresh fetch never wipes a just-sent message (Firestore serverTimestamp
  // can be unresolved on an immediate read-after-write, causing the doc to
  // be missing from an orderBy('createdAt') query for ~1-2 seconds).
  useEffect(() => {
    if (!activeChannel) return;
    const fetchMessages = (replace = false) => {
      api.get(`/team/channels/${activeChannel}/messages`)
        .then((r: any) => {
          const fresh = Array.isArray(r?.data?.data) ? r.data.data : [];
          if (replace) { setLiveMessages(fresh); return; }
          setLiveMessages(prev => {
            // Keep optimistic messages that aren't yet in the fresh list (and
            // are <30s old — older means the write probably failed silently).
            const stillPending = prev.filter((m: any) => {
              if (!m._optimistic) return false;
              const realTwin = fresh.some((f: any) =>
                f.content === m.content && (f.authorId === m.authorId || f.createdBy === m.authorId),
              );
              if (realTwin) return false;
              const ts = m.createdAt?._seconds ?? 0;
              return Date.now() - ts * 1000 < 30_000;
            });
            return [...fresh, ...stillPending];
          });
        })
        .catch(() => {});
    };
    fetchMessages(true);
    const id = setInterval(() => fetchMessages(false), 5000);
    return () => clearInterval(id);
  }, [activeChannel]);

  const handleSend = async () => {
    if (!input.trim() || sending || !activeChannel) return;
    setSending(true);
    const trimmed = input.trim();
    const mentionsAI = /@(orlode|bot|ai|assistant|\w+)\b/i.test(trimmed);

    // Optimistic update — the user's message appears instantly with a temp id.
    // It's replaced by the real one when the next refresh comes back.
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      content: trimmed,
      authorId: myUid,
      authorName: 'Vous',
      createdAt: { _seconds: Math.floor(Date.now() / 1000) },
      _optimistic: true,
    };
    setLiveMessages(prev => [...prev, optimistic]);
    setInput('');
    // Only show "Orlode réfléchit…" if the mention actually has a request
    // (more than just bare "@orlode"). Otherwise the indicator hangs for 30s.
    const cleanedAfterMention = trimmed.replace(/@(orlode|bot|ai|assistant|\w+)\b/i, '').trim();
    if (mentionsAI && cleanedAfterMention.length > 0) setAgentTypingSince(Date.now());

    try {
      await api.post(`/team/channels/${activeChannel}/messages`, { content: trimmed });
      // Don't refetch immediately — Firestore serverTimestamp can be unresolved
      // for ~1-2s after write, which would make the message vanish briefly.
      // The 5s poll picks it up reliably and the merge logic above keeps the
      // optimistic copy visible until the real one shows up.
    } catch (e: any) {
      setLiveMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(trimmed);
      setAgentTypingSince(null);
      toast.error('Échec de l\'envoi', e?.response?.data?.message ?? 'Réseau indisponible — réessaie.');
    } finally {
      setSending(false);
    }
  };

  // Clear the typing indicator when an agent reply has arrived (or after 30s timeout).
  useEffect(() => {
    if (agentTypingSince === null) return;
    const hasNewerAgentReply = liveMessages.some((m: any) => {
      const ts = (m.createdAt?._seconds ?? 0) * 1000;
      return m.createdByType === 'agent' && ts > agentTypingSince - 1000;
    });
    if (hasNewerAgentReply) { setAgentTypingSince(null); return; }
    const timeout = setTimeout(() => setAgentTypingSince(null), 30_000);
    return () => clearTimeout(timeout);
  }, [agentTypingSince, liveMessages]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
      await api.post('/team/channels', { name: newChannelName.trim(), description: newChannelDesc.trim() });
      toast.success('Canal créé');
      setNewChannelName('');
      setNewChannelDesc('');
      setShowCreateChannel(false);
      refresh();
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? '');
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    if (!activeChannel) return;
    try {
      await api.post(`/team/channels/${activeChannel}/messages/${msgId}/reactions`, { emoji });
      const r: any = await api.get(`/team/channels/${activeChannel}/messages`);
      setLiveMessages(Array.isArray(r?.data?.data) ? r.data.data : []);
    } catch {}
  };

  // Edit own message — prompts for new content, server enforces ownership.
  const handleEditMessage = async (msgId: string, currentContent: string) => {
    if (!activeChannel) return;
    const next = window.prompt('Modifier le message :', currentContent);
    if (next === null) return; // cancelled
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentContent) return;
    try {
      await api.patch(`/team/channels/${activeChannel}/messages/${msgId}`, { content: trimmed });
      const r: any = await api.get(`/team/channels/${activeChannel}/messages`);
      setLiveMessages(Array.isArray(r?.data?.data) ? r.data.data : []);
    } catch (e: any) {
      toast.error('Échec édition', e?.response?.data?.message ?? '');
    }
  };

  // Delete own message — server enforces ownership (admins can also delete).
  const handleDeleteMessage = async (msgId: string) => {
    if (!activeChannel) return;
    if (!window.confirm('Supprimer ce message ? Cette action est irréversible.')) return;
    try {
      await api.delete(`/team/channels/${activeChannel}/messages/${msgId}`);
      const r: any = await api.get(`/team/channels/${activeChannel}/messages`);
      setLiveMessages(Array.isArray(r?.data?.data) ? r.data.data : []);
    } catch (e: any) {
      toast.error('Échec suppression', e?.response?.data?.message ?? '');
    }
  };

  const channel = channels.find((c: any) => c.id === activeChannel) || channels[0] || { id: 'general', name: 'general', emoji: '#', desc: '', members: 0, unread: 0, category: 'GÉNÉRAL' };
  // Messages: real data only — empty if channel has none
  const messages = liveMessages.map((m: any) => {
    const raw: string = m.content ?? '';
    const blocks: any[] = [];

    // Escalation messages from the WhatsApp handoff system render as a red URGENT card.
    if (m.escalation === true) {
      blocks.push({
        type: 'escalation_card',
        customerPhone: m.customerPhone,
        customerName: m.customerName,
        reason: m.escalationReason,
        rawContent: raw,
      });
    } else {
      // Detect [[ACTION:proposalId]] markers from agent messages and split into blocks.
      const actionMatch = raw.match(/\[\[ACTION:([a-zA-Z0-9_-]+)\]\]/);
      if (actionMatch) {
        const before = raw.slice(0, actionMatch.index!).trim();
        const after = raw.slice(actionMatch.index! + actionMatch[0].length).trim();
        if (before) blocks.push({ type: 'text', text: before });
        blocks.push({ type: 'action_card', proposalId: actionMatch[1] });
        if (after) blocks.push({ type: 'text', text: after });
      } else {
        blocks.push({ type: 'text', text: raw });
      }
    }
    return {
      id: m.id,
      author: m.authorId,
      authorName: m.authorName,
      isMine: !!myUid && m.authorId === myUid,
      rawContent: raw,
      blocks,
      time: m.createdAt?._seconds ? new Date(m.createdAt._seconds * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—',
      reactions: (m.reactions ?? []).map((r: any) => ({ emoji: r.emoji, count: r.users?.length ?? 0, mine: r.users?.includes(myUid) ?? false })),
      edited: m.edited ?? false,
      threadCount: m.threadCount ?? 0,
      isLive: true,
    };
  });

  // Group messages by author for cleaner display
  let prevAuthor = null;
  let prevTime = null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 65px)', background: C.greenDeep }}>
      {/* Channel list (third column) */}
      <div style={{
        width: 280, background: C.greenDeep,
        borderRight: '1px solid rgba(255,250,240,0.06)',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
      }} className="hide-on-mobile">
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(255,250,240,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purpleLight }}>Canaux</em>
            </h2>
            <button onClick={() => setShowCreateChannel(true)} className="icon-btn ghost" style={{ width: 30, height: 30 }} title="Créer un canal">
              <Plus size={15} color={C.cream} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: C.onGreenSoft, margin: 0 }}>
            <strong style={{ color: C.cream }}>{channels.length}</strong> canal{channels.length > 1 ? 'aux' : ''} ·{' '}
            <strong style={{ color: C.gold }}>{channels.reduce((s: number, c: any) => s + (c.unread ?? 0), 0)}</strong> non lus
          </p>
        </div>

        <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {[...new Set(channels.map((c: any) => c.category))].map((cat: any) => (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                color: C.onGreenSoft, padding: '6px 10px 4px',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{cat}</span>
                <span className="mono-font" style={{ color: C.inkLight }}>
                  {channels.filter((c: any) => c.category === cat).length}
                </span>
              </div>
              {channels.filter((c: any) => c.category === cat).map((ch: any) => {
                const active = ch.id === activeChannel;
                return (
                  <button key={ch.id} onClick={() => setActiveChannel(ch.id)} style={{
                    width: '100%', textAlign: 'left',
                    background: active ? `linear-gradient(90deg, ${C.purple}, ${C.purpleDeep})` : 'transparent',
                    border: 'none', borderRadius: 10,
                    padding: '8px 10px', marginBottom: 2,
                    display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                    color: active ? C.cream : C.onGreenSoft,
                    fontFamily: 'inherit',
                    boxShadow: active ? `0 6px 16px -6px ${C.purple}` : 'none',
                  }}
                  onMouseOver={e => !active && (e.currentTarget.style.background = 'rgba(255,250,240,0.06)')}
                  onMouseOut={e => !active && (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 16 }}>{ch.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: ch.unread > 0 ? 700 : 500,
                        color: active ? C.cream : (ch.unread > 0 ? C.cream : C.onGreenSoft),
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {ch.private && <Lock size={10} />}
                        {ch.name}
                        {ch.urgent && <Flame size={11} className="shake" style={{ color: C.gold }} />}
                      </div>
                      <div style={{ fontSize: 10, color: active ? 'rgba(255,250,240,0.7)' : C.inkLight, fontWeight: 500 }}>
                        {ch.lastActivity}
                      </div>
                    </div>
                    {ch.unread > 0 && (
                      <span style={{
                        background: ch.urgent ? C.red : (active ? C.gold : C.purpleDeep),
                        color: ch.urgent ? C.cream : (active ? C.purpleDeep : C.cream),
                        fontSize: 10, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 100,
                        minWidth: 18, textAlign: 'center',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>{ch.unread}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.greenDeep }}>
        {/* Channel header */}
        <div style={{
          background: C.greenDark,
          borderBottom: '1px solid rgba(255,250,240,0.06)',
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
            boxShadow: `0 6px 16px -6px ${C.purple}`,
          }}>{channel.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
                #{channel.name}
              </h3>
              {channel.private && (
                <span className="pill" style={{ background: 'rgba(251,191,36,0.15)', color: C.gold, border: `1px solid ${C.gold}40` }}>
                  <Lock size={10} /> PRIVÉ
                </span>
              )}
              <span className="pill" style={{ background: C.emerald, color: C.cream, fontSize: 10 }}>
                <div className="live-dot" style={{ background: C.cream, width: 6, height: 6 }}></div>
                {liveMembers.filter((m: any) => m.status === 'online').length} en ligne
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.onGreenSoft }}>
              {channel.desc} · <strong style={{ color: C.cream }}>{channel.members}</strong> membres
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {/* Members preview — clickable, opens the Membres tab */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('team:navigate', { detail: 'members' }))}
              className="hide-on-mobile"
              title="Voir tous les membres"
              style={{
                display: 'flex', alignItems: 'center', marginRight: 8,
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              }}
            >
              {liveMembers.slice(0, 4).map((m: any, i: number) => (
                <div key={m.id ?? m.uid ?? i} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i }}>
                  <Avatar memberId={m.id ?? m.uid} size={28} showStatus={false} />
                </div>
              ))}
              {liveMembers.length > 4 && (
                <div style={{
                  marginLeft: -8,
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(255,250,240,0.1)',
                  border: `2px solid ${C.greenDark}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: C.cream,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>+{liveMembers.length - 4}</div>
              )}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="scroll-thin" style={{
          flex: 1, overflowY: 'auto',
          background: C.cream,
          padding: '20px 0',
        }}>
          {/* Date divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '0 24px 12px', position: 'sticky', top: 0,
            zIndex: 1,
          }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(10,42,32,0.1)' }}></div>
            <span className="pill" style={{
              background: C.cream, border: `1px solid rgba(10,42,32,0.1)`,
              color: C.inkSoft, fontWeight: 700, fontSize: 11,
              padding: '5px 12px',
              boxShadow: '0 4px 8px -4px rgba(10,42,32,0.1)',
            }}>
              <Calendar size={11} /> Aujourd'hui · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(10,42,32,0.1)' }}></div>
          </div>

          {messages.map((msg, idx) => {
            // Resolve author: prefer the team member; fall back to the message's
            // own authorName (server-side); finally fall back to the current user
            // for own messages so we never display "?".
            const memberAuthor = getMember(msg.author);
            const isSelf = msg.author === myUid;
            const author = isSelf && memberAuthor.name === '?'
              ? meAsMember
              : (memberAuthor.name === '?' && msg.authorName)
                ? { ...memberAuthor, name: msg.authorName, initials: msg.authorName.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() }
                : memberAuthor;
            const showAvatar = prevAuthor !== msg.author;
            prevAuthor = msg.author;

            return (
              <div key={msg.id} className="msg-row" style={{
                display: 'flex', gap: 12,
                alignItems: 'flex-start',
                marginTop: showAvatar ? 6 : 0,
              }}>
                {/* Avatar (only show on first msg of group) */}
                <div style={{ width: 40, flexShrink: 0 }}>
                  {showAvatar ? (
                    <Avatar memberId={msg.author} size={40} member={author} />
                  ) : (
                    <div style={{ fontSize: 9, color: C.inkLight, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center', paddingTop: 4, opacity: 0 }}>
                      {msg.time}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Author + time */}
                  {showAvatar && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                        {author.name}
                      </span>
                      {author.isBot && (
                        <span className="pill" style={{
                          background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
                          color: C.cream, fontSize: 9,
                        }}>
                          <Bot size={10} /> APP
                        </span>
                      )}
                      {msg.isYou && (
                        <span className="pill" style={{
                          background: C.purpleSoft, color: C.purpleDeep, fontSize: 9,
                        }}>VOUS</span>
                      )}
                      <span className="mono-font" style={{ fontSize: 10, color: C.inkLight }}>
                        {msg.time}
                      </span>
                      {msg.edited && (
                        <span style={{ fontSize: 10, color: C.inkLight, fontStyle: 'italic' }}>
                          (modifié)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message blocks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {msg.blocks.map((block, bi) => {
                      if (block.type === 'text') {
                        // Parse mentions and bold
                        const parts = block.text.split(/(\*\*[^*]+\*\*|@\w+)/g);
                        return (
                          <div key={bi} style={{ fontSize: 14, color: C.ink, lineHeight: 1.55 }}>
                            {parts.map((part, pi) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={pi} style={{ color: C.purpleDeep }}>{part.slice(2, -2)}</strong>;
                              }
                              if (part.startsWith('@')) {
                                return (
                                  <span key={pi} style={{
                                    background: C.goldSoft, color: C.goldDeep,
                                    padding: '1px 6px', borderRadius: 4,
                                    fontWeight: 700, cursor: 'pointer',
                                  }}>{part}</span>
                                );
                              }
                              return <React.Fragment key={pi}>{part}</React.Fragment>;
                            })}
                          </div>
                        );
                      }

                      if (block.type === 'file') {
                        return (
                          <div key={bi} className="card-lift" style={{
                            background: C.creamDeep, borderRadius: 12,
                            padding: 12, display: 'flex', alignItems: 'center', gap: 12,
                            border: '1px solid rgba(10,42,32,0.06)',
                            maxWidth: 420, cursor: 'pointer',
                          }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: 10,
                              background: `linear-gradient(135deg, ${block.color}, ${block.color}cc)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 22, color: C.cream,
                              boxShadow: `0 6px 12px -4px ${block.color}`,
                              flexShrink: 0,
                            }}>{block.icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {block.name}
                              </div>
                              <div className="mono-font" style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>
                                {block.size}
                              </div>
                            </div>
                            <button className="icon-btn ghost" style={{ width: 32, height: 32 }}>
                              <Download size={14} />
                            </button>
                          </div>
                        );
                      }

                      if (block.type === 'action_card') {
                        return <AgentActionCard key={bi} proposalId={block.proposalId} />;
                      }

                      if (block.type === 'escalation_card') {
                        return <EscalationCard
                          key={bi}
                          customerPhone={block.customerPhone}
                          customerName={block.customerName}
                          reason={block.reason}
                          rawContent={block.rawContent}
                        />;
                      }

                      if (block.type === 'image') {
                        return (
                          <div key={bi} className="card-lift" style={{
                            background: `linear-gradient(135deg, ${C.purpleSoft}, ${C.pinkSoft})`,
                            borderRadius: 14,
                            padding: 0, overflow: 'hidden',
                            maxWidth: 380, cursor: 'pointer',
                            border: '1px solid rgba(10,42,32,0.06)',
                          }}>
                            <div style={{
                              height: 180,
                              background: `linear-gradient(135deg, ${C.purple}30, ${C.pink}30, ${C.gold}30)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 64,
                              position: 'relative',
                            }}>
                              {block.placeholder}
                              {/* Vignette */}
                              <div style={{
                                position: 'absolute', inset: 0,
                                background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.15) 100%)',
                              }}></div>
                            </div>
                            <div style={{ padding: 10, background: C.cream }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                                {block.name}
                              </div>
                              <div className="mono-font" style={{ fontSize: 10, color: C.inkSoft }}>
                                {block.size}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (block.type === 'code') {
                        return (
                          <div key={bi} style={{
                            background: '#1a1d24', borderRadius: 10,
                            padding: 12, maxWidth: 480,
                            position: 'relative',
                            border: '1px solid rgba(255,250,240,0.06)',
                          }}>
                            <div style={{
                              position: 'absolute', top: 8, right: 8,
                              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                              color: '#94a3b0', background: 'rgba(255,250,240,0.05)',
                              padding: '2px 8px', borderRadius: 4,
                            }}>
                              {block.lang.toUpperCase()}
                            </div>
                            <pre className="mono-font" style={{
                              margin: 0, fontSize: 12, color: '#a5b4fc',
                              whiteSpace: 'pre-wrap', lineHeight: 1.6,
                            }}>{block.text}</pre>
                          </div>
                        );
                      }

                      if (block.type === 'actions') {
                        return (
                          <div key={bi} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            {block.actions.map((a, ai) => (
                              <button key={ai} style={{
                                background: a.primary ? `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})` : C.cream,
                                color: a.primary ? C.cream : C.purpleDeep,
                                border: a.primary ? 'none' : `1.5px solid ${C.purple}40`,
                                padding: '8px 14px', borderRadius: 10,
                                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                fontFamily: 'inherit',
                                boxShadow: a.primary ? `0 6px 16px -6px ${C.purple}` : 'none',
                              }}>
                                {a.label}
                              </button>
                            ))}
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>

                  {/* Reactions — clickable to toggle, "+ smile" adds a new emoji via prompt */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {msg.reactions.map((r, ri) => (
                        <button
                          key={ri}
                          onClick={() => handleReact(msg.id, r.emoji)}
                          className={`reaction-pill ${r.mine ? 'mine' : ''}`}
                          title={r.mine ? 'Cliquer pour retirer' : 'Cliquer pour ajouter'}>
                          <span>{r.emoji}</span>
                          <span className="count">{r.count}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          const e = window.prompt('Ajouter un emoji (ex: 🚀, 🔥, ✅)…', '🔥');
                          if (e?.trim()) handleReact(msg.id, e.trim());
                        }}
                        className="reaction-pill"
                        title="Ajouter une réaction"
                        style={{ background: 'transparent', borderStyle: 'dashed' }}>
                        <Smile size={12} />
                      </button>
                    </div>
                  )}

                  {/* Thread preview */}
                  {msg.threadCount && (
                    <button style={{
                      marginTop: 8,
                      background: 'rgba(109,40,217,0.06)',
                      border: `1px solid ${C.purple}20`,
                      borderRadius: 10, padding: '6px 10px',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(109,40,217,0.12)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(109,40,217,0.06)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {msg.threadUsers.slice(0, 3).map((u, ui) => (
                          <div key={u} style={{ marginLeft: ui === 0 ? 0 : -6, zIndex: 3 - ui }}>
                            <Avatar memberId={u} size={20} showStatus={false} />
                          </div>
                        ))}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.purpleDeep }}>
                        {msg.threadCount} réponses
                      </span>
                      <span style={{ fontSize: 10, color: C.inkSoft }}>
                        Dernière il y a 5 min
                      </span>
                      <ChevronRight size={12} color={C.purpleDeep} />
                    </button>
                  )}
                </div>

                {/* Hover actions — real handlers */}
                <div className="msg-actions">
                  {/* Quick reactions row — picks one of these emojis on click */}
                  {['👍', '❤️', '😂', '🎉'].map(e => (
                    <button key={e}
                      onClick={() => handleReact(msg.id, e)}
                      className="icon-btn ghost"
                      title={`Réagir ${e}`}
                      style={{ width: 28, height: 28, fontSize: 14 }}>
                      {e}
                    </button>
                  ))}
                  {/* Edit/Delete only if I'm the author and it's not an agent message */}
                  {msg.isMine && !msg.author?.startsWith?.('agent:') && (
                    <>
                      <button onClick={() => handleEditMessage(msg.id, msg.rawContent)}
                        className="icon-btn ghost" title="Modifier"
                        style={{ width: 28, height: 28 }}>
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => handleDeleteMessage(msg.id)}
                        className="icon-btn ghost" title="Supprimer"
                        style={{ width: 28, height: 28, color: C.redDeep }}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Agent typing indicator — appears as soon as the user sends an
              @orlode message, vanishes when the agent reply arrives. */}
          {agentTypingSince !== null && (
            <div style={{
              display: 'flex', gap: 10, padding: '4px 0 12px',
              alignItems: 'center',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.cream, flexShrink: 0,
                boxShadow: `0 6px 14px -6px ${C.purple}`,
              }}>
                <Sparkles size={14} />
              </div>
              <div style={{
                background: C.creamDeep,
                borderRadius: '4px 14px 14px 14px',
                padding: '8px 14px',
                fontSize: 13, color: C.purpleDeep, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                border: `1px solid ${C.purple}20`,
              }}>
                <span>Orlode réfléchit</span>
                <span className="typing-dots" style={{ display: 'inline-flex', gap: 3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.purple, animation: 'typing-bounce 1.2s infinite ease-in-out 0s' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.purple, animation: 'typing-bounce 1.2s infinite ease-in-out 0.2s' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.purple, animation: 'typing-bounce 1.2s infinite ease-in-out 0.4s' }} />
                </span>
              </div>
            </div>
          )}

          {/* Empty state — no messages yet in this channel */}
          {messages.length === 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '40px 24px', textAlign: 'center', minHeight: 280,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 22,
                background: `linear-gradient(135deg, ${C.purple}20, ${C.purple}10)`,
                border: `1.5px dashed ${C.purple}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 18, fontSize: 32,
              }}>
                {channel.emoji ?? '#'}
              </div>
              <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                Bienvenue dans #{channel.name}
              </h3>
              <p style={{ fontSize: 13, color: C.inkSoft, maxWidth: 380, margin: '0 0 18px', lineHeight: 1.5 }}>
                Aucun message encore. Sois le premier à dire bonjour, partager une mise à jour ou mentionner <strong style={{ color: C.purple }}>@orlode</strong> pour invoquer l'IA.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[
                  '👋 Présente-toi à l\'équipe',
                  '@orlode résume les ventes',
                  '🚀 Annonce du jour',
                ].map((s, i) => (
                  <button key={i} onClick={() => setInput(s.replace(/^[^\s]+\s/, ''))} style={{
                    background: C.creamDeep, color: C.ink, border: '1px solid rgba(10,42,32,0.08)',
                    borderRadius: 100, padding: '6px 12px', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = C.purpleSoft}
                  onMouseOut={e => e.currentTarget.style.background = C.creamDeep}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ background: C.cream, padding: '14px 24px', borderTop: '1px solid rgba(10,42,32,0.06)' }}>
          {/* Format toolbar — wraps selection (or inserts) markdown syntax */}
          <div style={{
            display: 'flex', gap: 2, marginBottom: 8,
            paddingBottom: 8, borderBottom: '1px solid rgba(10,42,32,0.06)',
          }}>
            {[
              { icon: 'B',  tip: 'Gras (**texte**)',          action: () => wrapSelection('**'),                      style: { fontWeight: 800 } },
              { icon: 'I',  tip: 'Italique (*texte*)',        action: () => wrapSelection('*'),                       style: { fontStyle: 'italic' } },
              { icon: 'S',  tip: 'Barré (~~texte~~)',         action: () => wrapSelection('~~'),                      style: { textDecoration: 'line-through' } },
              { icon: '🔗', tip: 'Lien',                       action: () => wrapSelection('[', '](https://)') },
              { icon: '<>', tip: 'Code (`code`)',              action: () => wrapSelection('`') },
              { icon: '"',  tip: 'Citation',                   action: () => insertAtCaret('\n> ') },
              { icon: '•',  tip: 'Liste',                      action: () => insertAtCaret('\n- ') },
              { icon: '@',  tip: 'Mention (@nom)',             action: () => insertAtCaret('@') },
            ].map((t, i) => (
              <button key={i} title={t.tip} onClick={t.action} style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'transparent', border: 'none',
                color: C.inkSoft, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                ...t.style,
              }}
              onMouseOver={e => e.currentTarget.style.background = C.purpleSoft}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >{t.icon}</button>
            ))}
          </div>

          <div style={{
            background: C.creamDeep, borderRadius: 14,
            padding: 10,
            border: `1.5px solid rgba(10,42,32,0.08)`,
            display: 'flex', alignItems: 'flex-end', gap: 8,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`Message dans #${channel.name}…`}
              rows={1}
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent',
                fontSize: 14, color: C.ink, fontFamily: 'inherit',
                resize: 'none', padding: '6px 4px', lineHeight: 1.5,
                minHeight: 24, maxHeight: 160,
              }}
            />
            <div style={{ display: 'flex', gap: 2, position: 'relative' }}>
              <button
                onClick={() => setShowSuggestions(s => !s)}
                title="Suggestions IA"
                style={{
                  width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                  border: 'none',
                  background: showSuggestions ? `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})` : 'transparent',
                  color: showSuggestions ? C.cream : C.purple,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Sparkles size={15} />
              </button>
              {showSuggestions && (
                <div style={{
                  position: 'absolute', bottom: 40, right: 0,
                  background: C.cream, borderRadius: 14, padding: 8,
                  border: '1px solid rgba(10,42,32,0.08)',
                  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)',
                  width: 280, zIndex: 50,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: C.purpleDeep, padding: '6px 10px 4px' }}>
                    ⚡ SUGGESTIONS IA
                  </div>
                  {[
                    { icon: '📋', label: 'Résume ce canal', cmd: '@orlode résume les 20 derniers messages de ce canal' },
                    { icon: '💬', label: 'Réponds à un client', cmd: '@orlode rédige une réponse pour ' },
                    { icon: '✅', label: 'Crée une tâche', cmd: '@orlode crée une tâche : ' },
                    { icon: '📊', label: 'Analyse les ventes', cmd: '@orlode analyse les ventes de la semaine' },
                    { icon: '✏️', label: 'Rédige un message', cmd: '@orlode rédige un message à ' },
                  ].map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(s.cmd);
                        setShowSuggestions(false);
                        setTimeout(() => inputRef.current?.focus(), 0);
                      }}
                      style={{
                        width: '100%', textAlign: 'left',
                        background: 'transparent', border: 'none',
                        padding: '9px 10px', borderRadius: 10,
                        fontSize: 12, color: C.ink, fontFamily: 'inherit',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                      onMouseOver={e => e.currentTarget.style.background = C.purpleSoft}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 16 }}>{s.icon}</span>
                      <span style={{ fontWeight: 600 }}>{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleSend} disabled={sending || !input.trim()} className="btn-primary" style={{
              padding: '8px 14px', fontSize: 13,
              opacity: input.trim() && !sending ? 1 : 0.5,
            }}>
              <Send size={14} /> {sending ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 6, fontSize: 10, color: C.inkLight,
          }}>
            <span>
              <span className="mono-font" style={{ background: C.creamDeep, padding: '2px 5px', borderRadius: 3, marginRight: 4 }}>↵</span>
              pour envoyer ·
              <span className="mono-font" style={{ background: C.creamDeep, padding: '2px 5px', borderRadius: 3, marginLeft: 4, marginRight: 4 }}>⇧↵</span>
              nouvelle ligne
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={11} color={C.purple} /> IA: suggestions activées
            </span>
          </div>
        </div>
      </div>

      {/* Create channel modal */}
      {showCreateChannel && (
        <div onClick={() => setShowCreateChannel(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.cream, borderRadius: 18, padding: 26,
            width: '90%', maxWidth: 440,
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.5)',
          }}>
            <h3 className="display-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
              Nouveau <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purple }}>canal</em>
            </h3>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>NOM</label>
            <input
              value={newChannelName}
              onChange={e => setNewChannelName(e.target.value)}
              placeholder="ex : marketing-q4"
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
            />
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginTop: 14, display: 'block' }}>DESCRIPTION (optionnel)</label>
            <textarea
              value={newChannelDesc}
              onChange={e => setNewChannelDesc(e.target.value)}
              placeholder="À quoi sert ce canal…"
              rows={3}
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowCreateChannel(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Annuler</button>
              <button onClick={handleCreateChannel} disabled={!newChannelName.trim()} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                <Plus size={14} /> Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ============ PAGE: MESSAGES DIRECTS ============
function DMsPage() {
  const { dms: liveDms } = useTeamData();
  const { user } = useAuthStore();
  const myUid = user?.uid ?? user?.id ?? '';

  const dms = liveDms.map((d: any) => {
    const memberIds: string[] = Array.isArray(d.members) ? d.members : (d.participantIds ?? []);
    const otherIds = memberIds.filter((id: string) => id !== myUid);
    return {
      id: d.id,
      members: otherIds.length > 0 ? otherIds : memberIds,
      group: otherIds.length > 1,
      lastMsg: d.lastMessage?.content ?? d.lastMessage ?? '—',
      time: fmtDmTime(d.lastMessageAt ?? d.updatedAt),
      unread: d.unreadCount ?? 0,
      online: false,
    };
  });

  const [activeDM, setActiveDM] = useState<string>('');
  const [dmMessages, setDmMessages] = useState<any[]>([]);
  const [dmInput, setDmInput] = useState('');
  const [sendingDm, setSendingDm] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const [dmAgentTypingSince, setDmAgentTypingSince] = useState<number | null>(null);

  // Pick the first DM by default
  useEffect(() => {
    if (!activeDM && dms.length > 0) setActiveDM(dms[0].id);
  }, [dms.length, activeDM]);

  // Load messages for active DM
  useEffect(() => {
    if (!activeDM) { setDmMessages([]); return; }
    let cancelled = false;
    const load = async (replace = false) => {
      try {
        const r = await api.get(`/team/dms/${activeDM}/messages`);
        const fresh = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
        if (cancelled) return;
        if (replace) { setDmMessages(fresh); return; }
        setDmMessages(prev => {
          // Preserve recent optimistic messages until they appear in the server list.
          const stillPending = prev.filter((m: any) => {
            if (!m._optimistic) return false;
            const realTwin = fresh.some((f: any) =>
              f.content === m.content && (f.authorId === m.authorId || f.createdBy === m.authorId),
            );
            if (realTwin) return false;
            const ts = m.createdAt?._seconds ?? 0;
            return Date.now() - ts * 1000 < 30_000;
          });
          return [...fresh, ...stillPending];
        });
      } catch { if (!cancelled && replace) setDmMessages([]); }
    };
    load(true);
    const id = setInterval(() => load(false), 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, [activeDM]);

  const sendDm = async () => {
    if (!dmInput.trim() || !activeDM || sendingDm) return;
    setSendingDm(true);
    const trimmed = dmInput.trim();
    const mentionsAI = /@(orlode|bot|ai|assistant|\w+)\b/i.test(trimmed);

    // Optimistic — show the user's message instantly.
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId, content: trimmed, authorId: myUid, authorName: 'Vous',
      createdAt: { _seconds: Math.floor(Date.now() / 1000) }, _optimistic: true,
    };
    setDmMessages(prev => [...prev, optimistic]);
    setDmInput('');
    const cleanedAfterMention = trimmed.replace(/@(orlode|bot|ai|assistant|\w+)\b/i, '').trim();
    if (mentionsAI && cleanedAfterMention.length > 0) setDmAgentTypingSince(Date.now());

    try {
      await api.post(`/team/dms/${activeDM}/messages`, { content: trimmed });
      // No immediate refetch — the polling merge logic handles reconciliation.
    } catch (e: any) {
      setDmMessages(prev => prev.filter(m => m.id !== tempId));
      setDmInput(trimmed);
      setDmAgentTypingSince(null);
      toast.error('Échec de l\'envoi', e?.response?.data?.message ?? 'Réseau indisponible — réessaie.');
    } finally { setSendingDm(false); }
  };

  // Clear DM typing indicator when an agent reply has arrived (or after 30s).
  useEffect(() => {
    if (dmAgentTypingSince === null) return;
    const hasNewerAgentReply = dmMessages.some((m: any) => {
      const ts = (m.createdAt?._seconds ?? 0) * 1000;
      return m.createdByType === 'agent' && ts > dmAgentTypingSince - 1000;
    });
    if (hasNewerAgentReply) { setDmAgentTypingSince(null); return; }
    const timeout = setTimeout(() => setDmAgentTypingSince(null), 30_000);
    return () => clearTimeout(timeout);
  }, [dmAgentTypingSince, dmMessages]);

  const dm = dms.find((d: any) => d.id === activeDM) ?? dms[0];
  const dmMembers = (dm?.members ?? []).map((id: string) => getMember(id));
  const otherMember = dmMembers[0] ?? { id: '', name: '—', initials: '—', color: '#94A3A0', status: 'offline', role: '', dept: '' };

  // Map server DM messages → display shape (with action-card marker parsing)
  const renderedMessages = dmMessages.map((m: any) => {
    const raw: string = m.content ?? '';
    const actionMatch = raw.match(/\[\[ACTION:([a-zA-Z0-9_-]+)\]\]/);
    const proposalId = actionMatch?.[1];
    const text = proposalId ? raw.replace(actionMatch![0], '').trim() : raw;
    return {
      id: m.id,
      author: m.authorId ?? m.fromUserId,
      text,
      proposalId,
      time: m.createdAt?._seconds ? new Date(m.createdAt._seconds * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—',
      isYou: (m.authorId ?? m.fromUserId) === myUid,
      isAgent: m.createdByType === 'agent',
      reactions: (m.reactions ?? []).map((r: any) => ({ emoji: r.emoji, count: r.users?.length ?? 0 })),
    };
  });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 65px)', background: C.greenDeep }}>
      {/* DMs list */}
      <div style={{
        width: 300, background: C.greenDeep,
        borderRight: '1px solid rgba(255,250,240,0.06)',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
      }} className="hide-on-mobile">
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(255,250,240,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.pink }}>Messages</em>
            </h2>
          </div>
          <div style={{
            background: 'rgba(255,250,240,0.06)',
            border: '1px solid rgba(255,250,240,0.08)',
            borderRadius: 10, padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Search size={13} color={C.onGreenSoft} />
            <input
              value={dmSearch}
              onChange={e => setDmSearch(e.target.value)}
              placeholder="Filtrer une conversation…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 12, color: C.cream, fontFamily: 'inherit', minWidth: 0,
              }}
            />
          </div>
        </div>

        <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C.onGreenSoft, padding: '6px 10px 4px' }}>
            CONVERSATIONS
          </div>
          {dms.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: C.onGreenSoft, fontSize: 12 }}>
              Aucune conversation. Démarre-en une depuis le profil d'un membre.
            </div>
          )}
          {dms.filter((d: any) => {
            if (!dmSearch) return true;
            const q = dmSearch.toLowerCase();
            const names = (d.members ?? []).map((id: string) => getMember(id).name.toLowerCase()).join(' ');
            return names.includes(q) || (d.lastMsg ?? '').toLowerCase().includes(q);
          }).map((d: any) => {
            const active = d.id === activeDM;
            const members = d.members.map((id: string) => getMember(id));
            const main = members[0] ?? { id: '', name: '—', initials: '—', color: '#94A3A0', status: 'offline' };
            return (
              <button key={d.id} onClick={() => setActiveDM(d.id)} style={{
                width: '100%', textAlign: 'left',
                background: active ? `linear-gradient(90deg, ${C.purple}, ${C.purpleDeep})` : 'transparent',
                border: 'none', borderRadius: 12,
                padding: '10px 12px', marginBottom: 2,
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', transition: 'all 0.15s ease',
                fontFamily: 'inherit',
                boxShadow: active ? `0 6px 16px -6px ${C.purple}` : 'none',
              }}
              onMouseOver={e => !active && (e.currentTarget.style.background = 'rgba(255,250,240,0.06)')}
              onMouseOut={e => !active && (e.currentTarget.style.background = 'transparent')}
              >
                {d.group ? (
                  <div style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }}>
                    <Avatar memberId={members[0].id} size={28} showStatus={false} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0 }}>
                      <Avatar memberId={members[1].id} size={22} showStatus={false} />
                    </div>
                  </div>
                ) : (
                  <Avatar memberId={main.id} size={38} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 13, fontWeight: d.unread > 0 ? 700 : 600,
                      color: active ? C.cream : C.cream,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {d.group ? `${members[0].name.split(' ')[0]} & ${members[1].name.split(' ')[0]}` : main.name}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 11, color: active ? 'rgba(255,250,240,0.75)' : C.onGreenSoft,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontWeight: d.unread > 0 ? 600 : 400,
                  }}>
                    {d.lastMsg}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 9, color: active ? 'rgba(255,250,240,0.65)' : C.inkLight, fontWeight: 500 }}>
                    {d.time}
                  </span>
                  {d.unread > 0 && (
                    <span style={{
                      background: active ? C.gold : C.pink,
                      color: active ? C.purpleDeep : C.cream,
                      fontSize: 10, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 100,
                      minWidth: 18, textAlign: 'center',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>{d.unread}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* DM chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          background: C.greenDark,
          borderBottom: '1px solid rgba(255,250,240,0.06)',
          padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <Avatar memberId={otherMember.id} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
              {otherMember.name}
            </h3>
            <div style={{ fontSize: 11, color: C.emeraldLight, fontWeight: 600 }}>
              {otherMember.status === 'online' ? '● Actif maintenant' : `● ${otherMember.role}`}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="scroll-thin" style={{
          flex: 1, overflowY: 'auto',
          background: C.cream, padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {/* Date */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <span className="pill" style={{ background: C.creamDeep, color: C.inkSoft, fontWeight: 700 }}>
              <Calendar size={11} /> Aujourd'hui
            </span>
          </div>

          {/* DM start banner */}
          <div style={{
            background: `linear-gradient(135deg, ${C.purpleSoft}, ${C.pinkSoft})`,
            borderRadius: 16, padding: 18, marginBottom: 14,
            textAlign: 'center', border: `1px dashed ${C.purple}30`,
          }}>
            <Avatar memberId={otherMember.id} size={56} />
            <h4 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '12px 0 4px', letterSpacing: '-0.02em' }}>
              C'est le début de votre conversation avec <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purpleDeep }}>{otherMember.name}</em>
            </h4>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: 0 }}>
              {otherMember.role} · {otherMember.dept}
            </p>
          </div>

          {renderedMessages.length === 0 && (
            <div style={{ textAlign: 'center', color: C.inkSoft, padding: 20, fontSize: 12 }}>
              Aucun message dans cette conversation.
            </div>
          )}
          {renderedMessages.map((m: any) => {
            const isYou = m.isYou;
            return (
              <div key={m.id} style={{
                display: 'flex', gap: 10,
                flexDirection: isYou ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
              }}>
                <Avatar memberId={m.author} size={28} showStatus={false} />
                <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: isYou ? 'flex-end' : 'flex-start' }}>
                  {m.text && (
                    <div style={{
                      background: isYou ? `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})` : C.creamDeep,
                      color: isYou ? C.cream : C.ink,
                      padding: '10px 14px',
                      borderRadius: isYou ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      fontSize: 14, lineHeight: 1.5,
                      boxShadow: isYou ? `0 6px 16px -8px ${C.purple}` : 'none',
                    }}>
                      {m.text}
                    </div>
                  )}
                  {m.proposalId && <AgentActionCard proposalId={m.proposalId} />}
                  <div style={{
                    fontSize: 10, color: C.inkLight,
                    padding: '0 8px',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span>{m.time}</span>
                    {isYou && <CheckCheck size={11} color={C.emerald} />}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Agent typing indicator (DM) */}
          {dmAgentTypingSince !== null && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', paddingTop: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 9,
                background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.cream, flexShrink: 0,
              }}>
                <Sparkles size={12} />
              </div>
              <div style={{
                background: C.creamDeep,
                borderRadius: '4px 14px 14px 14px',
                padding: '8px 14px',
                fontSize: 13, color: C.purpleDeep, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                border: `1px solid ${C.purple}20`,
              }}>
                <span>Orlode réfléchit</span>
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.purple, animation: 'typing-bounce 1.2s infinite ease-in-out 0s' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.purple, animation: 'typing-bounce 1.2s infinite ease-in-out 0.2s' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.purple, animation: 'typing-bounce 1.2s infinite ease-in-out 0.4s' }} />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ background: C.cream, padding: '14px 24px', borderTop: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{
            background: C.creamDeep, borderRadius: 14,
            padding: 8,
            border: `1.5px solid rgba(10,42,32,0.08)`,
            display: 'flex', alignItems: 'flex-end', gap: 6,
          }}>
            <input
              value={dmInput}
              onChange={e => setDmInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDm(); } }}
              placeholder={`Message à ${(otherMember.name ?? '').split(' ')[0] || '…'}…`}
              disabled={!activeDM}
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent',
                fontSize: 14, color: C.ink, fontFamily: 'inherit',
                padding: '8px 12px',
              }}
            />
            <button onClick={sendDm} disabled={!dmInput.trim() || sendingDm || !activeDM} className="btn-primary" style={{ padding: '8px 14px', fontSize: 13, opacity: (!dmInput.trim() || sendingDm) ? 0.5 : 1 }}>
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ PAGE: THREADS ============
function ThreadsPage() {
  const { threads: liveThreads, channels: liveChannels } = useTeamData();
  const fmtRel = (d: any): string => {
    const ts = d?._seconds ?? d?.seconds ?? (typeof d === 'string' ? new Date(d).getTime() / 1000 : null);
    if (!ts) return '—';
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 60) return 'à l\'instant';
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
    return `il y a ${Math.floor(diff / 86400)}j`;
  };
  const channelById = new Map<string, any>(liveChannels.map((c: any) => [c.id, c]));
  const threads = liveThreads.map((t: any) => {
    const ch = channelById.get(t.channelId) ?? {};
    return {
      id: t.id,
      channelId: t.channelId,
      channel: `#${ch.name ?? t.channelId ?? 'thread'}`,
      emoji: ch.emoji ?? '#',
      original: {
        author: t.parentAuthorId ?? t.authorId ?? '',
        text: t.parentContent ?? t.preview ?? '',
        time: fmtRel(t.createdAt ?? t.parentCreatedAt),
      },
      replies: t.replyCount ?? 0,
      participants: t.participants ?? [],
      lastReply: {
        author: t.lastReplyAuthorId ?? '',
        text: t.lastReplyContent ?? '',
        time: fmtRel(t.lastReplyAt),
      },
      urgent: ch.urgent ?? false,
    };
  });

  const navigate = useNavigate();
  const [threadFilter, setThreadFilter] = useState<'all' | 'urgent'>('all');
  const visibleThreads = threadFilter === 'urgent' ? threads.filter((t: any) => t.urgent) : threads;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="pill" style={{ background: `${C.purple}20`, color: C.purpleLight, border: `1px solid ${C.purple}40`, marginBottom: 8 }}>
          <GitBranch size={11} /> THREADS · {threads.length} ACTIFS
        </div>
        <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          Vos <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purpleLight }}>conversations</em>
        </h2>
        <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
          Toutes les discussions threadées centralisées
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {([
          { id: 'all' as const,    label: 'Tous',    count: threads.length },
          { id: 'urgent' as const, label: 'Urgents', count: threads.filter((t: any) => t.urgent).length },
        ]).map(f => {
          const active = threadFilter === f.id;
          return (
            <button key={f.id} onClick={() => setThreadFilter(f.id)} style={{
              background: active ? `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})` : 'rgba(255,250,240,0.06)',
              color: C.cream,
              padding: '8px 14px', borderRadius: 100,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(255,250,240,0.12)',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: active ? `0 6px 16px -4px ${C.purple}` : 'none',
            }}>
              {f.label}
              <span className="mono-font" style={{
                background: active ? 'rgba(255,250,240,0.25)' : 'rgba(255,250,240,0.1)',
                padding: '1px 6px', borderRadius: 6, fontSize: 10,
              }}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* Threads list */}
      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visibleThreads.length === 0 && (
          <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.12)' }}>
            <GitBranch size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
              {threads.length === 0 ? 'Aucun thread actif' : 'Aucun thread urgent'}
            </h3>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
              {threads.length === 0
                ? 'Démarre un thread depuis un message dans un canal — survole un message et clique sur l\'icône fil.'
                : 'Tout est calme. Les threads marqués urgents apparaîtront ici.'}
            </p>
          </div>
        )}
        {visibleThreads.map((t: any) => {
          const original = getMember(t.original.author);
          const last = getMember(t.lastReply.author);
          return (
            <div key={t.id} onClick={() => navigate(`/team?channel=${t.channelId}`)} className="card-lift" style={{
              background: C.cream, borderRadius: 18,
              border: `1px solid rgba(10,42,32,0.06)`,
              cursor: 'pointer', overflow: 'hidden',
              borderLeft: t.urgent ? `4px solid ${C.red}` : `4px solid ${C.purple}`,
            }}>
              {/* Header */}
              <div style={{
                padding: '12px 18px',
                background: t.urgent ? `${C.red}08` : C.creamDeep,
                display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: `1px solid rgba(10,42,32,0.04)`,
              }}>
                <span style={{ fontSize: 16 }}>{t.emoji}</span>
                <span className="display-font" style={{ fontSize: 13, fontWeight: 700, color: t.urgent ? C.redDeep : C.purpleDeep, letterSpacing: '-0.01em' }}>
                  {t.channel}
                </span>
                {t.urgent && (
                  <span className="pill pulse-glow" style={{ background: C.red, color: C.cream, fontSize: 10 }}>
                    <Flame size={10} /> URGENT
                  </span>
                )}
                <div style={{ flex: 1 }}></div>
                <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>
                  {t.original.time}
                </span>
              </div>

              {/* Original message */}
              <div style={{ padding: '14px 18px', display: 'flex', gap: 10 }}>
                <Avatar memberId={t.original.author} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                      {original.name}
                    </span>
                    <span style={{ fontSize: 11, color: C.inkLight }}>
                      a démarré le thread
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: C.ink, margin: 0, lineHeight: 1.55 }}>
                    {t.original.text}
                  </p>
                </div>
              </div>

              {/* Stats bar */}
              <div style={{
                padding: '10px 18px',
                background: 'rgba(109,40,217,0.04)',
                borderTop: `1px solid rgba(10,42,32,0.04)`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t.participants.slice(0, 4).map((u, ui) => (
                    <div key={u} style={{ marginLeft: ui === 0 ? 0 : -8, zIndex: 4 - ui }}>
                      <Avatar memberId={u} size={24} showStatus={false} />
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.purpleDeep }}>
                  <span className="mono-font">{t.replies}</span> réponses
                </span>
                <div style={{ flex: 1 }}></div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: C.inkSoft,
                }}>
                  <span><strong style={{ color: C.ink }}>{last.name.split(' ')[0]}</strong>: « {t.lastReply.text} »</span>
                  <span>· {t.lastReply.time}</span>
                </div>
                <ChevronRight size={14} color={C.purpleDeep} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ PAGE: MENTIONS ============
function MentionsPage() {
  const { mentions: liveMentions, refresh } = useTeamData();
  const fmtRel = (d: any): string => {
    const ts = d?._seconds ?? d?.seconds;
    if (!ts) return '—';
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 60) return 'à l\'instant';
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
    return `il y a ${Math.floor(diff / 86400)}j`;
  };
  const mentions = liveMentions.length > 0 ? liveMentions.map((m: any) => ({
    id: m.id,
    author: m.fromUserId,
    authorName: m.fromUserName,
    channel: `#${m.channelId}`,
    channelId: m.channelId as string,
    messageId: m.messageId as string | undefined,
    text: m.content ?? '',
    time: fmtRel(m.createdAt),
    isUnread: !m.read,
    context: m.context ?? '',
  })) : [];

  const markAsRead = async (mentionId: string) => {
    try {
      await api.patch(`/team/mentions/${mentionId}/read`);
      refresh();
    } catch (err) {
      // silent — UI will retry on next poll
    }
  };

  const navigate = useNavigate();
  const goToContext = (m: { channelId: string; messageId?: string; id: string }) => {
    // Mark as read in passing, then navigate to the channel.
    // (Anchoring to a specific message is a Niveau 2 polish — Niveau 1 just opens the channel.)
    markAsRead(m.id);
    navigate(`/team?channel=${m.channelId}`);
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="pill" style={{ background: `${C.gold}20`, color: C.gold, border: `1px solid ${C.gold}40`, marginBottom: 8 }}>
          <AtSign size={11} /> MENTIONS · {mentions.filter(m => m.isUnread).length} NON LUES
        </div>
        <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          On parle de <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>vous</em>
        </h2>
        <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
          Toutes les fois où votre équipe vous mentionne
        </p>
      </div>

      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mentions.length === 0 && (
          <div style={{
            background: C.cream, borderRadius: 18, padding: 60,
            textAlign: 'center', color: C.inkSoft,
            border: '1px dashed rgba(10,42,32,0.12)',
          }}>
            <AtSign size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
              Aucune mention
            </h3>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
              Quand un coéquipier vous mentionnera avec @, vous le verrez ici.
            </p>
          </div>
        )}
        {mentions.map((m: any) => {
          const author = getMember(m.author);
          return (
            <div
              key={m.id}
              onClick={() => goToContext(m)}
              className="card-lift" style={{
              background: C.cream, borderRadius: 14,
              border: m.isUnread ? `1.5px solid ${C.gold}40` : `1px solid rgba(10,42,32,0.06)`,
              cursor: 'pointer', padding: 16,
              display: 'flex', gap: 12,
              alignItems: 'flex-start',
              position: 'relative',
              borderLeft: m.urgent ? `4px solid ${C.red}` : `4px solid ${C.gold}`,
            }}>
              {m.isUnread && (
                <div style={{
                  position: 'absolute', top: 14, right: 14,
                  width: 8, height: 8, borderRadius: '50%',
                  background: C.gold,
                  boxShadow: `0 0 0 3px ${C.goldSoft}`,
                }}></div>
              )}

              <Avatar memberId={m.author} size={40} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                    {author.name}
                  </span>
                  <span style={{ fontSize: 11, color: C.inkLight }}>dans</span>
                  <span className="pill" style={{ background: C.purpleSoft, color: C.purpleDeep, fontSize: 11 }}>
                    {m.channel}
                  </span>
                  {m.urgent && (
                    <span className="pill" style={{ background: C.red, color: C.cream, fontSize: 10 }}>
                      <Flame size={10} /> URGENT
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: C.inkLight, marginLeft: 'auto' }}>
                    {m.time}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: C.ink, margin: '0 0 6px', lineHeight: 1.5 }}>
                  {m.text.split(/(@\w+)/g).map((part, i) =>
                    part.startsWith('@') ? (
                      <span key={i} style={{
                        background: C.goldSoft, color: C.goldDeep,
                        padding: '1px 6px', borderRadius: 4,
                        fontWeight: 700,
                      }}>{part}</span>
                    ) : <React.Fragment key={i}>{part}</React.Fragment>
                  )}
                </p>
                {m.context && (
                  <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: 'italic' }}>
                    Contexte : {m.context}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); goToContext(m); }}
                    style={{
                      background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
                      color: C.cream, border: 'none',
                      padding: '6px 12px', borderRadius: 8,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}>
                    <Reply size={11} /> Répondre
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); goToContext(m); }}
                    style={{
                      background: 'transparent', color: C.inkSoft,
                      border: `1px solid rgba(10,42,32,0.1)`,
                      padding: '6px 12px', borderRadius: 8,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}>
                    <ExternalLink size={11} /> Voir le contexte
                  </button>
                  {m.isUnread && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(m.id); }}
                      style={{
                        background: 'transparent', color: C.inkLight,
                        border: 'none',
                        padding: '6px 8px', borderRadius: 8,
                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'inherit',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                      Marquer lu
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ============ PAGE: MEMBRES ============
function MembersPage() {
  const { members: liveMembers, loading } = useTeamData();
  const members = liveMembers.length > 0 ? liveMembers.map((m: any) => ({
    id: m.id ?? m.uid,
    name: m.displayName ?? m.name ?? m.email ?? 'Membre',
    role: m.role === 'admin' ? 'Administrateur' : m.role === 'manager' ? 'Manager' : (m.role ?? 'Employé'),
    dept: m.department ?? m.dept ?? '—',
    initials: ((m.displayName ?? m.name ?? m.email ?? 'M').split(' ').map((s: string) => s[0]).slice(0, 2).join('') ?? 'M').toUpperCase(),
    color: m.color ?? '#6D28D9',
    status: m.status ?? 'offline',
    bio: m.bio ?? '',
    tz: m.tz ?? 'GMT+0',
    email: m.email ?? '',
    isBot: m.isBot ?? false,
    isYou: m.isYou ?? false,
  })) : [];

  const [view, setView] = useState('grid');
  // Status/type filter (Tous / En ligne / Bots) — top-level
  const [statusFilter, setStatusFilter] = useState('all');
  // Department filter (separate dropdown) — independent
  const [deptFilter, setDeptFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviting, setInviting] = useState(false);
  // Profile modal — shows full member details when a card is clicked
  const [profileMember, setProfileMember] = useState<any>(null);

  const filtered = members.filter((m: any) => {
    if (statusFilter === 'online' && m.status !== 'online') return false;
    if (statusFilter === 'bots' && !m.isBot) return false;
    if (deptFilter !== 'all' && m.dept !== deptFilter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.role.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const departments = [...new Set(members.map((m: any) => m.dept).filter((d: any) => d && d !== '—'))] as string[];
  const onlineCount = members.filter((m: any) => m.status === 'online').length;

  const handleInvite = async () => {
    if (!inviteEmail || inviting) return;
    setInviting(true);
    try {
      const r: any = await api.post('/team/invite', {
        email: inviteEmail,
        role: inviteRole,
        phone: invitePhone.trim() || undefined,
      });
      const channels: string[] = r?.data?.channels ?? r?.channels ?? [];
      const errors = (r?.data?.channelErrors ?? r?.channelErrors ?? {}) as Record<string, string>;
      const sentVia = channels.length > 0 ? channels.join(' + ') : 'aucun canal';
      const waNote = errors['whatsapp'] ? ` (WhatsApp: ${errors['whatsapp']})` : '';
      toast.success('Invitation envoyée', `${inviteEmail} via ${sentVia}${waNote}`);
      setInviteEmail('');
      setInvitePhone('');
      setInviteOpen(false);
    } catch (e: any) {
      toast.error('Échec de l\'invitation', e?.response?.data?.message ?? '');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="pill" style={{ background: `${C.emerald}20`, color: C.emeraldLight, border: `1px solid ${C.emerald}40`, marginBottom: 8 }}>
            <UsersRound size={11} /> ÉQUIPE · {members.length} MEMBRE{members.length > 1 ? 'S' : ''}
          </div>
          <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Notre <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.emeraldLight }}>équipe</em>
          </h2>
          <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
            <span style={{ color: C.emeraldLight, fontWeight: 600 }}>● {onlineCount} en ligne</span> ·{' '}
            <strong style={{ color: C.cream }}>{members.length}</strong> personne{members.length > 1 ? 's' : ''} ·{' '}
            <strong style={{ color: C.gold }}>{departments.length}</strong> département{departments.length > 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setInviteOpen(true)} className="btn-primary">
          <Plus size={14} /> Inviter un membre
        </button>
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div onClick={() => setInviteOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.cream, borderRadius: 18, padding: 26,
            width: '90%', maxWidth: 440,
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.5)',
          }}>
            <h3 className="display-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              Inviter un <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purple }}>membre</em>
            </h3>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 16px' }}>
              L'invitation est envoyée par email. Ajoute un numéro WhatsApp pour aussi l'envoyer en message direct (optionnel).
            </p>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>EMAIL <span style={{ color: C.pink }}>*</span></label>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="prenom@entreprise.com"
              style={{
                width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)',
                fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginTop: 14, display: 'block' }}>
              WHATSAPP <span style={{ color: C.inkLight, fontWeight: 500, textTransform: 'none' }}>(optionnel)</span>
            </label>
            <input
              type="tel"
              value={invitePhone}
              onChange={e => setInvitePhone(e.target.value)}
              placeholder="+225 07 01 23 45 67"
              style={{
                width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)',
                fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginTop: 14, display: 'block' }}>RÔLE</label>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              style={{
                width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)',
                fontSize: 13, color: C.ink, fontFamily: 'inherit',
              }}
            >
              <option value="employee">Employé</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrateur</option>
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setInviteOpen(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                Annuler
              </button>
              <button onClick={handleInvite} disabled={!inviteEmail || inviting} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {inviting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                {inviting ? 'Envoi…' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {profileMember && (
        <div onClick={() => setProfileMember(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.cream, borderRadius: 18,
            width: '90%', maxWidth: 460, overflow: 'hidden',
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              height: 88,
              background: `linear-gradient(135deg, ${profileMember.color}, ${profileMember.color}aa)`,
              position: 'relative',
            }}>
              <button onClick={() => setProfileMember(null)} style={{
                position: 'absolute', top: 12, right: 12,
                background: 'rgba(255,250,240,0.25)', color: C.cream,
                border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer',
                backdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }} aria-label="Fermer">
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '0 24px 24px', textAlign: 'center', marginTop: -42 }}>
              <Avatar memberId={profileMember.id} size={84} />
              <h3 className="display-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: '10px 0 2px', letterSpacing: '-0.02em' }}>
                {profileMember.name}
              </h3>
              <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 8 }}>
                {profileMember.role}
              </div>
              <span className="pill" style={{
                background: profileMember.status === 'online' ? C.emeraldSoft : profileMember.status === 'idle' ? C.goldSoft : profileMember.status === 'dnd' ? C.redSoft : C.creamDeep,
                color: profileMember.status === 'online' ? C.emeraldDeep : profileMember.status === 'idle' ? C.goldDeep : profileMember.status === 'dnd' ? C.redDeep : C.inkSoft,
                fontSize: 11,
              }}>
                {profileMember.status === 'online' ? '● Actif' : profileMember.status === 'idle' ? '◐ Absent' : profileMember.status === 'dnd' ? '✕ Ne pas déranger' : '○ Hors ligne'}
              </span>

              {profileMember.bio && (
                <div style={{
                  marginTop: 16, padding: 12,
                  background: C.creamDeep, borderRadius: 12,
                  fontSize: 12, color: C.inkSoft, fontStyle: 'italic',
                  lineHeight: 1.5, textAlign: 'left',
                }}>
                  "{profileMember.bio}"
                </div>
              )}

              <div style={{
                marginTop: 14, padding: '14px 12px',
                background: C.creamDeep, borderRadius: 12,
                display: 'flex', flexDirection: 'column', gap: 10,
                textAlign: 'left',
              }}>
                {profileMember.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <Mail size={14} color={C.inkSoft} />
                    <span style={{ color: C.inkSoft, fontWeight: 600, minWidth: 80 }}>Email</span>
                    <span style={{ color: C.ink, fontWeight: 600 }}>{profileMember.email}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <Briefcase size={14} color={C.inkSoft} />
                  <span style={{ color: C.inkSoft, fontWeight: 600, minWidth: 80 }}>Département</span>
                  <span style={{ color: C.ink, fontWeight: 600 }}>{profileMember.dept}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <Clock size={14} color={C.inkSoft} />
                  <span style={{ color: C.inkSoft, fontWeight: 600, minWidth: 80 }}>Fuseau</span>
                  <span style={{ color: C.ink, fontWeight: 600 }}>{profileMember.tz}</span>
                </div>
                {profileMember.isBot && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <Bot size={14} color={C.purple} />
                    <span style={{ color: C.inkSoft, fontWeight: 600, minWidth: 80 }}>Type</span>
                    <span style={{ color: C.purpleDeep, fontWeight: 700 }}>Agent IA Orlode</span>
                  </div>
                )}
              </div>

              {!profileMember.isYou && (
                <button onClick={() => setProfileMember(null)} className="btn-secondary" style={{
                  marginTop: 16, width: '100%', justifyContent: 'center',
                }}>
                  Fermer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total membres',    value: members.length, sub: 'Dans votre entreprise', icon: UsersRound, color: C.purple,  bg: C.purpleSoft },
          { label: 'En ligne',         value: onlineCount,    sub: 'Actifs maintenant', icon: Activity,   color: C.emerald, bg: C.emeraldSoft },
          { label: 'Départements',     value: departments.length, sub: departments.length > 0 ? 'Organisés' : 'À configurer', icon: Briefcase,  color: C.gold,    bg: C.goldSoft },
          { label: 'Bots IA',          value: members.filter((m: any) => m.isBot).length, sub: 'Assistants intégrés', icon: Bot,    color: C.pink,    bg: C.pinkSoft },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="card-lift" style={{
              background: C.cream, borderRadius: 16, padding: 16,
              border: '1px solid rgba(10,42,32,0.06)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: stat.bg, color: stat.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={22} />
              </div>
              <div>
                <div className="display-font mono-font" style={{ fontSize: 26, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 2 }}>{stat.label}</div>
                <div style={{ fontSize: 10, color: C.inkSoft }}>{stat.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{
        background: C.cream, borderRadius: 14, padding: '10px 14px',
        border: '1px solid rgba(10,42,32,0.06)',
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 18,
      }}>
        <div style={{
          flex: 1, minWidth: 200,
          background: C.creamDeep, borderRadius: 10,
          padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Search size={14} color={C.inkSoft} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer par nom, rôle…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 13, color: C.ink,
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'inline-flex', gap: 3, background: C.creamDeep, padding: 3, borderRadius: 10 }}>
          {[
            { id: 'all',    label: 'Tous',    icon: UsersRound },
            { id: 'online', label: 'En ligne', icon: Activity },
            { id: 'bots',   label: 'Bots',    icon: Bot },
          ].map(f => {
            const Icon = f.icon;
            const active = statusFilter === f.id;
            return (
              <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', borderRadius: 8,
                background: active ? `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})` : 'transparent',
                color: active ? C.cream : C.inkSoft,
                border: 'none', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <Icon size={11} /> {f.label}
              </button>
            );
          })}
        </div>

        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          style={{
            background: C.creamDeep, color: C.ink,
            border: 'none', borderRadius: 10,
            padding: '8px 14px', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="all">Tous départements</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <div style={{ display: 'inline-flex', gap: 2, background: C.creamDeep, padding: 2, borderRadius: 8 }}>
          <button onClick={() => setView('grid')} style={{
            padding: 7, borderRadius: 6,
            background: view === 'grid' ? C.purple : 'transparent',
            color: view === 'grid' ? C.cream : C.inkSoft,
            border: 'none', cursor: 'pointer', display: 'flex',
          }}><LayoutDashboard size={13} /></button>
          <button onClick={() => setView('list')} style={{
            padding: 7, borderRadius: 6,
            background: view === 'list' ? C.purple : 'transparent',
            color: view === 'list' ? C.cream : C.inkSoft,
            border: 'none', cursor: 'pointer', display: 'flex',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Members */}
      {!loading && filtered.length === 0 && (
        <div style={{
          background: C.cream, borderRadius: 18, padding: 60,
          textAlign: 'center', color: C.inkSoft,
          border: '1px dashed rgba(10,42,32,0.12)',
        }}>
          <UsersRound size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
            {members.length === 0 ? 'Aucun membre' : 'Aucun résultat'}
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 18px' }}>
            {members.length === 0
              ? 'Invitez votre équipe pour commencer à collaborer.'
              : 'Essayez d\'ajuster votre recherche ou vos filtres.'}
          </p>
          {members.length === 0 && (
            <button onClick={() => setInviteOpen(true)} className="btn-primary">
              <Plus size={14} /> Inviter le premier membre
            </button>
          )}
        </div>
      )}
      {view === 'grid' && filtered.length > 0 ? (
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {filtered.map((m: any) => (
            <div key={m.id} className="card-lift" onClick={() => setProfileMember(m)} style={{
              background: C.cream, borderRadius: 18,
              border: m.isYou ? `2px solid ${C.purple}` : '1px solid rgba(10,42,32,0.06)',
              cursor: 'pointer', overflow: 'hidden',
              position: 'relative',
            }}>
              {/* Banner */}
              <div style={{
                height: 60,
                background: `linear-gradient(135deg, ${m.color}, ${m.color}aa)`,
                position: 'relative',
              }}>
                {m.isYou && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: C.gold, color: C.purpleDeep,
                    padding: '3px 10px', borderRadius: 100,
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                  }}>VOUS</div>
                )}
                {m.isBot && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(255,250,240,0.25)', color: C.cream,
                    padding: '3px 10px', borderRadius: 100,
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                    backdropFilter: 'blur(20px)',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <Bot size={10} /> APP
                  </div>
                )}
              </div>

              <div style={{ padding: '0 16px 16px', textAlign: 'center', marginTop: -32 }}>
                <div style={{ display: 'inline-block', position: 'relative' }}>
                  <Avatar memberId={m.id} size={64} />
                </div>
                <h4 className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: '8px 0 2px', letterSpacing: '-0.01em' }}>
                  {m.name}
                </h4>
                <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>
                  {m.role}
                </div>
                <span className="pill" style={{
                  background: m.status === 'online' ? C.emeraldSoft : m.status === 'idle' ? C.goldSoft : m.status === 'dnd' ? C.redSoft : C.creamDeep,
                  color: m.status === 'online' ? C.emeraldDeep : m.status === 'idle' ? C.goldDeep : m.status === 'dnd' ? C.redDeep : C.inkSoft,
                  fontSize: 10,
                }}>
                  {m.status === 'online' ? '● Actif' : m.status === 'idle' ? '◐ Absent' : m.status === 'dnd' ? '✕ Ne pas déranger' : '○ Hors ligne'}
                </span>

                <div style={{
                  marginTop: 12, padding: '10px',
                  background: C.creamDeep, borderRadius: 10,
                  fontSize: 11, color: C.inkSoft, fontStyle: 'italic',
                  lineHeight: 1.4,
                }}>
                  "{m.bio}"
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: 10, padding: '8px 4px',
                  fontSize: 10, color: C.inkLight, fontWeight: 600,
                }}>
                  <span>{m.dept}</span>
                  <span>{m.tz}</span>
                </div>

                {!m.isYou && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setProfileMember(m)} className="btn-primary" style={{ flex: 1, padding: '7px', fontSize: 11, justifyContent: 'center' }}>
                      <MessageCircle size={12} /> Profil
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : view === 'list' && filtered.length > 0 ? (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((m: any) => (
            <div key={m.id} onClick={() => setProfileMember(m)} style={{
              background: C.cream, borderRadius: 12,
              padding: 12, border: '1px solid rgba(10,42,32,0.06)',
              borderLeft: `3px solid ${m.color}`,
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = `0 8px 20px -10px ${m.color}40`; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Avatar memberId={m.id} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{m.name}</span>
                  {m.isYou && <span className="pill" style={{ background: C.purple, color: C.cream, fontSize: 9 }}>VOUS</span>}
                  {m.isBot && <span className="pill" style={{ background: C.purpleSoft, color: C.purpleDeep, fontSize: 9 }}>BOT</span>}
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>
                  {m.role} · {m.dept}
                </div>
              </div>
              <span className="pill" style={{
                background: m.status === 'online' ? C.emeraldSoft : C.creamDeep,
                color: m.status === 'online' ? C.emeraldDeep : C.inkSoft,
                fontSize: 10,
              }}>
                ● {m.status}
              </span>
              <ChevronRight size={16} color={C.inkLight} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ============ PAGE: ACTIVITE ============
function ActivityPage() {
  const { activity: liveActivity } = useTeamData();
  const fmtRel = (d: any): string => {
    const ts = d?._seconds ?? d?.seconds;
    if (!ts) return '—';
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 60) return 'à l\'instant';
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
    return `il y a ${Math.floor(diff / 86400)}j`;
  };
  const activityIcons: Record<string, any> = {
    message: { icon: MessageCircle, color: C.purple,  bg: C.purpleSoft  },
    message_sent: { icon: MessageCircle, color: C.purple, bg: C.purpleSoft },
    reaction: { icon: Heart,        color: C.pink,    bg: C.pinkSoft    },
    thread:   { icon: GitBranch,    color: C.cyan,    bg: C.cyanSoft    },
    file:     { icon: Paperclip,    color: C.gold,    bg: C.goldSoft    },
    mention:  { icon: AtSign,       color: C.gold,    bg: C.goldSoft    },
    join:     { icon: UsersRound,   color: C.emerald, bg: C.emeraldSoft },
    member_added: { icon: UsersRound, color: C.emerald, bg: C.emeraldSoft },
    member_removed: { icon: UsersRound, color: C.red, bg: C.redSoft },
    pin:      { icon: Pin,          color: C.purple,  bg: C.purpleSoft  },
    channel:  { icon: Hash,         color: C.blue,    bg: C.blueSoft    },
    channel_created: { icon: Hash, color: C.blue, bg: C.blueSoft },
  };
  // Map server activity → display shape (real data only — no demo fallback)
  const displayActivity = liveActivity.map((a: any) => ({
    id: a.id,
    type: a.action ?? a.type ?? 'message',
    user: a.userId ?? '',
    target: a.entityId ?? a.targetName ?? '',
    text: a.action === 'channel_created' ? `a créé le canal ${a.metadata?.channelName ?? a.entityId}`
        : a.action === 'member_added' ? `a invité ${a.metadata?.memberName ?? a.entityId}`
        : a.action === 'member_removed' ? `a retiré ${a.metadata?.memberName ?? a.entityId}`
        : a.action ?? 'a effectué une action',
    time: fmtRel(a.createdAt),
    rawTs: a.createdAt?._seconds ?? a.createdAt?.seconds,
  }));

  // Compute today's stats from live activity (no hardcoded demo numbers)
  const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const today = liveActivity.filter((a: any) => {
    const ts = a.createdAt?._seconds ?? a.createdAt?.seconds;
    return typeof ts === 'number' && ts >= todayStart;
  });
  const countByType = (preds: string[]) => today.filter((a: any) => preds.includes(a.action ?? a.type)).length;
  const statsLive = {
    messages: countByType(['message', 'message_sent']),
    reactions: countByType(['reaction', 'reaction_added']),
    files: countByType(['file', 'file_uploaded']),
    threads: countByType(['thread', 'thread_started']),
  };

  // Top 4 contributors — aggregate liveActivity by userId, take top 4 by count.
  // Includes ALL action types (not just messages) so quiet teams still get a ranking.
  const contributorMap = new Map<string, number>();
  for (const a of liveActivity) {
    const uid = a.userId as string | undefined;
    if (!uid || uid.startsWith('agent:')) continue;
    contributorMap.set(uid, (contributorMap.get(uid) ?? 0) + 1);
  }
  const sortedContributors = Array.from(contributorMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxContrib = sortedContributors[0]?.[1] ?? 1;
  const topContributors = sortedContributors.map(([id, count]) => ({
    id, count, percent: Math.round((count / maxContrib) * 100),
  }));

  // Top 4 channels by message activity — count entries with entityType=channel
  // OR action mentioning a channel.
  const { channels: liveChannels } = useTeamData();
  const channelMap = new Map<string, number>();
  for (const a of liveActivity) {
    const cid = (a.metadata?.channelId ?? a.entityId) as string | undefined;
    if (!cid || a.entityType !== 'channel' && !['message', 'message_sent', 'reaction', 'thread'].includes(a.action ?? '')) continue;
    if (a.entityType === 'channel' || a.metadata?.channelId) {
      channelMap.set(cid, (channelMap.get(cid) ?? 0) + 1);
    }
  }
  const sortedChannels = Array.from(channelMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxChan = sortedChannels[0]?.[1] ?? 1;
  const topChannels = sortedChannels.map(([id, count]) => {
    const ch = (liveChannels ?? []).find((c: any) => c.id === id);
    return { name: `#${ch?.name ?? id}`, count, percent: Math.round((count / maxChan) * 100) };
  });

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="pill" style={{ background: `${C.emerald}20`, color: C.emeraldLight, border: `1px solid ${C.emerald}40`, marginBottom: 8 }}>
          <Activity size={11} /> ACTIVITÉ EN TEMPS RÉEL
        </div>
        <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          Le <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.emeraldLight }}>pouls</em> de l'équipe
        </h2>
        <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
          Tout ce qui se passe dans votre workspace
        </p>
      </div>

      {/* Activity stats */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Messages aujourd\'hui',  value: String(statsLive.messages),  trend: 'temps réel',  icon: MessageCircle, color: C.purple,  bg: C.purpleSoft },
          { label: 'Réactions',              value: String(statsLive.reactions), trend: 'temps réel',  icon: Heart,         color: C.pink,    bg: C.pinkSoft },
          { label: 'Fichiers partagés',      value: String(statsLive.files),     trend: 'temps réel',  icon: Paperclip,     color: C.gold,    bg: C.goldSoft },
          { label: 'Threads actifs',         value: String(statsLive.threads),   trend: 'temps réel',  icon: GitBranch,     color: C.emerald, bg: C.emeraldSoft },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="card-lift" style={{
              background: C.cream, borderRadius: 16, padding: 16,
              border: '1px solid rgba(10,42,32,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: s.bg, color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} />
                </div>
                <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDeep, fontSize: 10 }}>
                  <TrendingUp size={9} /> {s.trend}
                </span>
              </div>
              <div className="display-font mono-font" style={{ fontSize: 28, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Live activity feed + most active */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }} className="responsive-charts">
        {/* Feed */}
        <div style={{
          background: C.cream, borderRadius: 20, padding: 24,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
                Flux d'<em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purple }}>activité</em>
              </h3>
              <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
                <span className="live-dot" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}></span>
                En direct
              </p>
            </div>
            <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
              <Filter size={13} /> Filtrer
            </button>
          </div>

          <div className="stagger" style={{ display: 'flex', flexDirection: 'column' }}>
            {displayActivity.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '40px 0',
                color: C.inkSoft, fontSize: 13, fontStyle: 'italic',
              }}>
                Aucune activité récente. Dès qu'un membre poste, crée un canal ou réagit, ça apparaîtra ici.
              </div>
            )}
            {displayActivity.map((a: any, idx: number) => {
              const author = getMember(a.user);
              const config = activityIcons[a.type] ?? activityIcons.message;
              const Icon = config.icon;
              const isLast = idx === displayActivity.length - 1;
              return (
                <div key={a.id} style={{
                  display: 'flex', gap: 12,
                  paddingBottom: 14,
                  position: 'relative',
                }}>
                  {/* Timeline */}
                  {!isLast && (
                    <div style={{
                      position: 'absolute',
                      left: 19, top: 38, bottom: 0,
                      width: 2, background: 'rgba(10,42,32,0.08)',
                    }}></div>
                  )}

                  {/* Icon */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 11,
                    background: config.bg, color: config.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, zIndex: 1,
                    border: `2px solid ${C.cream}`,
                  }}>
                    <Icon size={16} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                    <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700 }}>{author.name}</span>
                      <span style={{ color: C.inkSoft }}> {a.text} </span>
                      <span style={{ fontWeight: 700, color: C.purpleDeep }}>
                        {a.target}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: C.inkLight, marginTop: 2, fontWeight: 500 }}>
                      {a.time}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most active members */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: C.cream, borderRadius: 20, padding: 22,
            border: '1px solid rgba(10,42,32,0.06)',
          }}>
            <h3 className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>Top</em> contributeurs
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topContributors.length === 0 ? (
                <div style={{ fontSize: 12, color: C.inkSoft, textAlign: 'center', padding: '14px 0', fontStyle: 'italic' }}>
                  Pas encore assez de données pour classer les contributeurs.
                </div>
              ) : topContributors.map((c, i) => {
                const m = getMember(c.id);
                return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span className="mono-font" style={{
                        fontSize: 11, fontWeight: 700, color: C.inkLight, width: 18,
                      }}>#{i + 1}</span>
                      <Avatar memberId={c.id} size={32} showStatus={false} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.name}
                        </div>
                        <div style={{ fontSize: 10, color: C.inkSoft }}>
                          <span className="mono-font">{c.count}</span> action{c.count > 1 ? 's' : ''}
                        </div>
                      </div>
                      {i === 0 && (
                        <Award size={16} fill={C.gold} color={C.goldDeep} />
                      )}
                    </div>
                    <div style={{ height: 4, background: 'rgba(10,42,32,0.06)', borderRadius: 100, marginLeft: 28, overflow: 'hidden' }}>
                      <div style={{
                        width: `${c.percent}%`, height: '100%',
                        background: i === 0 ? `linear-gradient(90deg, ${C.gold}, ${C.goldDeep})` : `linear-gradient(90deg, ${C.purple}, ${C.purpleDeep})`,
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top channels — real data computed from liveChannels' lastMessageAt */}
          <div style={{
            background: C.cream, borderRadius: 20, padding: 22,
            border: '1px solid rgba(10,42,32,0.06)',
          }}>
            <h3 className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Canaux <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purple }}>actifs</em>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topChannels.length === 0 ? (
                <div style={{ fontSize: 12, color: C.inkSoft, textAlign: 'center', padding: '14px 0', fontStyle: 'italic' }}>
                  Aucun canal n'a d'activité récente.
                </div>
              ) : topChannels.map((ch, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', background: C.creamDeep, borderRadius: 10,
                }}>
                  <span style={{ fontSize: 16 }}>#</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
                    <div style={{ height: 3, background: 'rgba(10,42,32,0.06)', borderRadius: 100, marginTop: 2, overflow: 'hidden' }}>
                      <div style={{
                        width: `${ch.percent}%`, height: '100%',
                        background: `linear-gradient(90deg, ${C.purple}, ${C.purpleDeep})`,
                      }}></div>
                    </div>
                  </div>
                  <span className="mono-font" style={{ fontSize: 12, fontWeight: 700, color: C.purpleDeep }}>
                    {ch.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ============ PAGE: FICHIERS ============
function FilesPage() {
  const { files: liveFiles, loading } = useTeamData();

  // Map server documents → UI shape
  const fileTypeFromName = (name: string): string => {
    const ext = (name?.split('.').pop() ?? '').toLowerCase();
    if (['pdf'].includes(ext)) return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['doc', 'docx'].includes(ext)) return 'doc';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
    if (['ppt', 'pptx'].includes(ext)) return 'slide';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
    return 'doc';
  };
  const emojiForType = (t: string): string => ({
    pdf: '📄', image: '🖼️', doc: '📝', sheet: '📊', slide: '📑',
    audio: '🎵', video: '🎬',
  } as any)[t] ?? '📄';
  const colorForType = (t: string): string => ({
    pdf: '#EF4444', image: '#FB7185', doc: '#0EA5E9', sheet: '#10B981',
    slide: '#F97316', audio: '#FBBF24', video: '#6D28D9',
  } as any)[t] ?? '#6D28D9';
  const fmtBytes = (b: number): string => {
    if (!b) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };
  const fmtRelDate = (d: any): string => {
    const ts = d?._seconds ?? d?.seconds ?? (typeof d === 'string' ? new Date(d).getTime() / 1000 : null);
    if (!ts) return '—';
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 86400) return "Aujourd'hui";
    if (diff < 172800) return 'Hier';
    if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} jours`;
    return new Date(ts * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const files = liveFiles.map((f: any) => {
    const name = f.name ?? f.filename ?? f.title ?? 'Fichier';
    const type = f.type ?? fileTypeFromName(name);
    return {
      id: f.id,
      name,
      type,
      size: typeof f.size === 'number' ? fmtBytes(f.size) : (f.size ?? '—'),
      author: f.uploadedBy ?? f.author ?? '',
      date: fmtRelDate(f.createdAt ?? f.uploadedAt),
      channel: f.channel ?? f.source ?? '',
      emoji: emojiForType(type),
      color: colorForType(type),
    };
  });

  const [view, setView] = useState('grid');
  const [filter, setFilter] = useState('all');

  const filtered = files.filter((f: any) => {
    if (filter === 'all') return true;
    return f.type === filter;
  });

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="pill" style={{ background: `${C.purple}20`, color: C.purpleLight, border: `1px solid ${C.purple}40`, marginBottom: 8 }}>
            <Folder size={11} /> FICHIERS · {files.length} PARTAGÉ{files.length > 1 ? 'S' : ''}
          </div>
          <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Tous vos <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purpleLight }}>fichiers</em>
          </h2>
          <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
            Documents, images, audios partagés
          </p>
        </div>
        <button className="btn-primary" onClick={() => toast.info('Import de fichier', 'Bientôt — utilise le module Données pour téléverser')}>
          <Upload size={14} /> Partager un fichier
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { id: 'all',   label: 'Tous',     count: files.length, color: C.purple },
          { id: 'pdf',   label: 'PDF',      count: files.filter((f: any) => f.type === 'pdf').length, color: C.red },
          { id: 'image', label: 'Images',   count: files.filter((f: any) => f.type === 'image').length, color: C.pink },
          { id: 'doc',   label: 'Word',     count: files.filter((f: any) => f.type === 'doc').length, color: C.blue },
          { id: 'sheet', label: 'Excel',    count: files.filter((f: any) => f.type === 'sheet').length, color: C.emerald },
          { id: 'slide', label: 'PPT',      count: files.filter((f: any) => f.type === 'slide').length, color: C.gold },
          { id: 'audio', label: 'Audio',    count: files.filter((f: any) => f.type === 'audio').length, color: C.gold },
          { id: 'video', label: 'Vidéo',    count: files.filter((f: any) => f.type === 'video').length, color: C.purple },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            background: filter === f.id ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'rgba(255,250,240,0.06)',
            color: C.cream,
            padding: '8px 14px', borderRadius: 100,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: filter === f.id ? 'none' : '1px solid rgba(255,250,240,0.12)',
            fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            boxShadow: filter === f.id ? `0 6px 16px -4px ${f.color}` : 'none',
          }}>
            {f.label}
            <span className="mono-font" style={{
              background: 'rgba(255,250,240,0.15)',
              padding: '1px 6px', borderRadius: 6, fontSize: 10,
            }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{
          background: C.cream, borderRadius: 18, padding: 60,
          textAlign: 'center', color: C.inkSoft,
          border: '1px dashed rgba(10,42,32,0.12)',
        }}>
          <Folder size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
            {files.length === 0 ? 'Aucun fichier partagé' : 'Aucun fichier dans cette catégorie'}
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
            {files.length === 0
              ? 'Les fichiers téléversés via les modules apparaîtront ici.'
              : 'Essayez un autre filtre.'}
          </p>
        </div>
      )}

      {/* Files grid */}
      {filtered.length > 0 && (
      <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {filtered.map((f: any) => {
          const author = getMember(f.author);
          return (
            <div key={f.id} className="card-lift" style={{
              background: C.cream, borderRadius: 16,
              border: '1px solid rgba(10,42,32,0.06)',
              cursor: 'pointer', overflow: 'hidden',
            }}>
              {/* Preview */}
              <div style={{
                height: 120,
                background: `linear-gradient(135deg, ${f.color}, ${f.color}aa)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <div style={{ fontSize: 48 }}>{f.emoji}</div>
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(10,42,32,0.75)',
                  backdropFilter: 'blur(20px)',
                  color: C.cream, padding: '3px 8px', borderRadius: 6,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                }}>
                  {f.type.toUpperCase()}
                </div>
              </div>

              <div style={{ padding: 14 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </h4>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Avatar memberId={f.author} size={20} showStatus={false} />
                  <span style={{ fontSize: 11, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {author.name.split(' ')[0]}
                  </span>
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingTop: 8, borderTop: '1px solid rgba(10,42,32,0.06)',
                  fontSize: 10, color: C.inkLight,
                }}>
                  <span className="mono-font" style={{ fontWeight: 700 }}>{f.size}</span>
                  <span>{f.date}</span>
                </div>

                <div style={{ marginTop: 8 }}>
                  <span className="pill" style={{ background: C.purpleSoft, color: C.purpleDeep, fontSize: 10 }}>
                    {f.channel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

// ============ PAGE: PARAMÈTRES ============
function SettingsPage() {
  const { company, user } = useAuthStore();
  const navigate = useNavigate();
  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="pill" style={{ background: `${C.inkLight}30`, color: C.cream, marginBottom: 8 }}>
          <Settings2 size={11} /> PARAMÈTRES ÉQUIPE
        </div>
        <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          Configuration <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyan }}>workspace</em>
        </h2>
        <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
          {company?.name ?? 'Workspace'} · Géré par {user?.displayName ?? 'vous'}
        </p>
      </div>

      {/* Quick redirect — full settings live on the dedicated admin page */}
      <div style={{
        background: C.cream, borderRadius: 22, padding: 36,
        border: '1px solid rgba(10,42,32,0.06)', textAlign: 'center', maxWidth: 640, margin: '0 auto',
      }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>⚙️</div>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Paramètres complets dans <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purple }}>Administration</em>
        </h3>
        <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 22px', lineHeight: 1.55, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
          Le panneau complet (workspace, membres, permissions, intégrations, facturation) est centralisé dans la page Administration de ton entreprise. Chaque admin peut y configurer son équipe.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/admin/company-settings')} className="btn-primary" style={{ padding: '12px 22px' }}>
            <Settings2 size={14} /> Ouvrir Administration
          </button>
          <button onClick={() => navigate('/team?page=members')} className="btn-secondary" style={{ padding: '12px 22px' }}>
            <UsersRound size={14} /> Gérer les membres
          </button>
        </div>
        <div style={{ marginTop: 22, padding: '12px 16px', background: C.creamDeep, borderRadius: 12, fontSize: 12, color: C.inkSoft, lineHeight: 1.5, textAlign: 'left' }}>
          <strong style={{ color: C.ink }}>Bientôt ici</strong> · Notifications par canal · permissions par rôle · intégrations Equipe · zone dangereuse (archiver/supprimer workspace).
        </div>
      </div>

      {/* DEAD CODE — kept hidden until the real workspace settings backend is wired. */}
      <div style={{ display: 'none' }}>
        {/* Workspace */}
        <div style={{
          background: C.cream, borderRadius: 18, padding: 22,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: C.purpleSoft, color: C.purpleDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Briefcase size={20} />
            </div>
            <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
              Workspace
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6 }}>NOM DU WORKSPACE</div>
              <input className="input-field" defaultValue={company?.name ?? ''} placeholder="Mon entreprise" style={{ background: C.creamDeep, padding: '10px 14px', fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6 }}>DESCRIPTION</div>
              <textarea className="input-field" rows={2} placeholder="Décrivez votre entreprise…" style={{ background: C.creamDeep, padding: '10px 14px', fontSize: 13, resize: 'vertical' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6 }}>FUSEAU HORAIRE</div>
              <select className="input-field" style={{ background: C.creamDeep, padding: '10px 14px', fontSize: 13 }}>
                <option>GMT-8 · Los Angeles, San Francisco</option>
                <option>GMT-5 · New York, Toronto</option>
                <option>GMT+0 · Londres, Lisbonne, Dakar</option>
                <option>GMT+1 · Paris, Berlin, Madrid</option>
                <option>GMT+3 · Moscou, Riyadh</option>
                <option>GMT+5:30 · Mumbai, Delhi</option>
                <option>GMT+8 · Singapour, Pékin, Hong Kong</option>
                <option>GMT+9 · Tokyo, Séoul</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div style={{
          background: C.cream, borderRadius: 18, padding: 22,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: C.goldSoft, color: C.goldDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bell size={20} />
            </div>
            <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
              Notifications
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Nouveau message direct',     enabled: true,  desc: 'Notification immédiate' },
              { label: 'Mention @Adelin',            enabled: true,  desc: 'Toujours notifié' },
              { label: 'Réponse dans un thread',     enabled: true,  desc: 'Si vous participez' },
              { label: 'Réactions à mes messages',   enabled: false, desc: 'Optionnel' },
              { label: 'Nouveau membre rejoint',     enabled: true,  desc: 'Pour les admins' },
              { label: 'Ne pas déranger 22h-7h',     enabled: true,  desc: 'Mode silencieux nuit' },
            ].map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: C.creamDeep, borderRadius: 10,
              }}>
                <div>
                  <div style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: C.inkSoft }}>{p.desc}</div>
                </div>
                <div style={{
                  width: 38, height: 22, borderRadius: 100,
                  background: p.enabled ? C.purple : C.inkLight,
                  position: 'relative', cursor: 'pointer',
                  transition: 'all 0.2s ease', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: 2,
                    left: p.enabled ? 18 : 2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: C.cream, transition: 'all 0.2s ease',
                  }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div style={{
          background: C.cream, borderRadius: 18, padding: 22,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: C.cyanSoft, color: C.cyanDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={20} />
            </div>
            <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
              Permissions
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Inviter des membres',          who: 'Admin' },
              { label: 'Créer des canaux',             who: 'Tous' },
              { label: 'Créer des canaux privés',      who: 'Admin' },
              { label: 'Supprimer messages d\'autrui', who: 'Admin' },
              { label: 'Épingler des messages',        who: 'Modérateurs' },
              { label: 'Configurer intégrations',      who: 'Admin' },
            ].map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: C.creamDeep, borderRadius: 10,
              }}>
                <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{p.label}</span>
                <select style={{
                  background: C.cream, color: C.ink,
                  border: '1px solid rgba(10,42,32,0.1)', borderRadius: 8,
                  padding: '5px 10px', fontSize: 12, fontWeight: 600,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}>
                  <option>{p.who}</option>
                  <option>Tous</option>
                  <option>Admin</option>
                  <option>Modérateurs</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div style={{
          background: C.cream, borderRadius: 18, padding: 22,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: C.emeraldSoft, color: C.emeraldDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plug size={20} />
            </div>
            <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
              Intégrations
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'WhatsApp Business',    emoji: '💬', status: 'connected', desc: 'Notifications urgentes' },
              { name: 'Google Calendar',      emoji: '📅', status: 'connected', desc: 'Events partagés' },
              { name: 'Gmail',                emoji: '📧', status: 'connected', desc: 'Mentions email' },
              { name: 'Telegram',             emoji: '✈️', status: 'available', desc: 'Bot notifications' },
              { name: 'GitHub',               emoji: '🔧', status: 'available', desc: 'Notifications CI/CD' },
            ].map((int, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', background: C.creamDeep, borderRadius: 10,
              }}>
                <span style={{ fontSize: 22 }}>{int.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{int.name}</div>
                  <div style={{ fontSize: 10, color: C.inkSoft }}>{int.desc}</div>
                </div>
                {int.status === 'connected' ? (
                  <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDeep, fontSize: 10 }}>
                    <CheckCircle2 size={11} /> CONNECTÉ
                  </span>
                ) : (
                  <button className="btn-primary" style={{ padding: '6px 10px', fontSize: 11 }}>
                    <Plus size={11} /> Connecter
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div style={{
          gridColumn: '1 / -1',
          background: C.cream, borderRadius: 18, padding: 22,
          border: `1.5px solid ${C.red}30`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: C.redSoft, color: C.redDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertCircle size={20} />
            </div>
            <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.redDeep, margin: 0, letterSpacing: '-0.01em' }}>
              Zone dangereuse
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }} className="responsive-grid-3">
            <button style={{
              background: 'transparent', color: C.redDeep,
              border: `1.5px solid ${C.red}40`,
              padding: '10px 14px', borderRadius: 10,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Archive size={14} /> Archiver workspace
            </button>
            <button style={{
              background: 'transparent', color: C.redDeep,
              border: `1.5px solid ${C.red}40`,
              padding: '10px 14px', borderRadius: 10,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <RefreshCw size={14} /> Réinitialiser canaux
            </button>
            <button style={{
              background: C.redDeep, color: C.cream,
              border: 'none',
              padding: '10px 14px', borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <XCircle size={14} /> Supprimer workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APP ============
// ============ Team real-data context ============
const TeamDataCtx = createContext<any>({ members: [], channels: [], dms: [], files: [], activity: [], threads: [], mentions: [], loading: true, refresh: () => {} });
export const useTeamData = () => useContext(TeamDataCtx);

export default function TeamRedesignPage() {
  const [currentPage, setCurrentPage] = useState('channels');

  // Allow nested pages to switch tabs via window event (e.g. ChannelsPage → Membres).
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent).detail;
      if (typeof target === 'string') setCurrentPage(target);
    };
    window.addEventListener('team:navigate', handler);
    return () => window.removeEventListener('team:navigate', handler);
  }, []);
  const [members, setMembers] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [dms, setDms] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [mentions, setMentions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const safe = (p: any) => p.catch(() => ({ data: { data: [] } }));
      const [membersRes, channelsRes, filesRes, dmsRes, activityRes, threadsRes, mentionsRes] = await Promise.all([
        safe(api.get('/team/members')),
        safe(api.get('/team/channels')),
        safe(api.get('/data/documents')),
        safe(api.get('/team/dms')),
        safe(api.get('/team/activity')),
        safe(api.get('/team/threads')),
        safe(api.get('/team/mentions')),
      ]);
      const pickList = (res: any): any[] => {
        if (Array.isArray(res?.data?.data)) return res.data.data;
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.data?.members)) return res.data.members;
        if (Array.isArray(res?.data?.documents)) return res.data.documents;
        return [];
      };
      const membersList = pickList(membersRes);
      _membersRef = membersList; // keep module-level ref in sync for getMember()
      setMembers(membersList);
      setChannels(pickList(channelsRes));
      setFiles(pickList(filesRes));
      setDms(pickList(dmsRes));
      setActivity(pickList(activityRes));
      setThreads(pickList(threadsRes));
      setMentions(pickList(mentionsRes));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const wrapped = async () => { if (mounted) await fetchAll(); };
    wrapped();
    const id = setInterval(wrapped, 15000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <TeamDataCtx.Provider value={{ members, channels, dms, files, activity, threads, mentions, loading, refresh: fetchAll }}>
      <Chrome currentPage={currentPage} setCurrentPage={setCurrentPage}>
        {currentPage === 'channels' && <ChannelsPage />}
        {currentPage === 'dms'      && <DMsPage />}
        {currentPage === 'threads'  && <ThreadsPage />}
        {currentPage === 'mentions' && <MentionsPage />}
        {currentPage === 'members'  && <MembersPage />}
        {currentPage === 'activity' && <ActivityPage />}
        {currentPage === 'files'    && <FilesPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </Chrome>
    </TeamDataCtx.Provider>
  );
}
