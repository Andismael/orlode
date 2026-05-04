/**
 * TeamPage — Immersive 3D team collaboration hub
 * Glassmorphism dark theme, animated gradients, Slack-style layout
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hash, Users, Activity, Send, Plus, UserPlus, Shield, Loader2,
  Trash2, X, Check, Crown, Eye, Star, MessageSquare, Zap,
  Paperclip, Smile, AtSign, Image, Mic,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import ChatSceneBackground from '@/components/chat/ChatSceneBackground';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Member { id: string; uid: string; email: string; displayName: string; photoURL: string; role: string; permissions: string[]; joinedAt: unknown; status: string }
interface Channel { id: string; name: string; description: string; type: string; lastMessage?: string; lastMessageBy?: string }
interface ChatMessage { id: string; content: string; authorId: string; authorName: string; authorPhoto: string; createdAt: unknown }
interface ActivityItem { id: string; action: string; userId: string; userName: string; details: Record<string, unknown>; createdAt: unknown }

type SidebarTab = 'channels' | 'members' | 'activity';

const ROLE_COLORS: Record<string, string> = { owner: '#f59e0b', admin: '#a855f7', manager: '#3b82f6', member: '#06b6d4', viewer: '#6b7280' };
const ROLE_GRADIENTS: Record<string, string> = { owner: 'linear-gradient(135deg, #f59e0b, #ef4444)', admin: 'linear-gradient(135deg, #a855f7, #6366f1)', manager: 'linear-gradient(135deg, #3b82f6, #06b6d4)', member: 'linear-gradient(135deg, #06b6d4, #34d399)', viewer: 'linear-gradient(135deg, #6b7280, #9ca3af)' };
const ROLE_ICONS: Record<string, React.ReactNode> = { owner: <Crown size={11} />, admin: <Shield size={11} />, manager: <Star size={11} />, member: <Users size={11} />, viewer: <Eye size={11} /> };

const ALL_PERMISSIONS = [
  'manageTeam', 'inviteMembers', 'removeMembers', 'viewAgents', 'editAgents', 'publishAgents',
  'accessBilling', 'accessAnalytics', 'accessMarketplace', 'accessSettings', 'manageChannels',
  'accessSales', 'accessSupport', 'accessIT', 'accessHR', 'accessLegal',
];
const PERM_LABELS: Record<string, string> = {
  manageTeam: 'Gerer equipe', inviteMembers: 'Inviter', removeMembers: 'Retirer',
  viewAgents: 'Voir agents', editAgents: 'Editer agents', publishAgents: 'Publier',
  accessBilling: 'Facturation', accessAnalytics: 'Analytics', accessMarketplace: 'Marketplace',
  accessSettings: 'Parametres', manageChannels: 'Canaux',
  accessSales: 'Commercial', accessSupport: 'Support', accessIT: 'IT', accessHR: 'RH', accessLegal: 'Juridique',
};
const ACTION_LABELS: Record<string, string> = {
  invite_sent: 'a invite', invite_accepted: 'a rejoint', member_removed: 'a retire',
  role_changed: 'a change le role de', permission_changed: 'a modifie les permissions de',
  channel_created: 'a cree le canal', team_created: 'a cree l\'equipe',
};

// ── Inline style constants ──────────────────────────────────────────────────
const BG = '#0d2520';                       // base cosmic green
const PANEL = 'rgba(13,37,32,0.78)';        // sidebar/right panel — translucent so cosmic bg shows through
const CHAT_BG = 'rgba(13,37,32,0.55)';      // center chat — more transparent for watermark visibility
const CARD = '#12122a';
const GLASS = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(168,85,247,0.18)';
const TEXT = '#e2e8f0';
const MUTED = 'rgba(255,255,255,0.4)';
const DIM = 'rgba(255,255,255,0.25)';

export default function TeamPage() {
  const { user, company } = useAuthStore();
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('channels');
  const [members, setMembers] = useState<Member[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [myPerms, setMyPerms] = useState<string[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice input
  const { isListening, isSupported: micSupported, interimText, toggle: toggleMic } = useVoiceInput({
    lang: 'fr-FR',
    onTranscript: (text) => setMsgInput(prev => (prev ? prev + ' ' + text : text)),
  });

  // Owner always has all permissions (client-side fallback)
  const isOwner = user?.role === 'admin' || company?.ownerId === user?.uid;
  const hasPerm = (p: string) => isOwner || myPerms.includes(p);

  const loadAll = useCallback(async () => {
    try {
      // Call /team first to auto-seed owner member doc
      const teamRes = await api.get('/team');
      setMembers(((teamRes.data?.data ?? teamRes.data)?.members ?? []) as Member[]);

      // Then fetch the rest in parallel
      const [channelsRes, activityRes, permsRes] = await Promise.all([
        api.get('/team/channels').catch(() => ({ data: [] })),
        api.get('/team/activity').catch(() => ({ data: [] })),
        api.get('/team/my-permissions').catch(() => ({ data: { permissions: [] } })),
      ]);

      const ch = (channelsRes.data?.data ?? channelsRes.data);
      setChannels(Array.isArray(ch) ? ch as Channel[] : []);
      const act = activityRes.data?.data ?? activityRes.data;
      setActivities(Array.isArray(act) ? act as ActivityItem[] : []);
      const perms = permsRes.data?.data ?? permsRes.data;
      setMyPerms(((perms as Record<string, unknown>)?.permissions ?? []) as string[]);
      if (!activeChannel && Array.isArray(ch) && ch.length > 0) setActiveChannel((ch as Channel[])[0]);
    } catch (err) { console.error('[Team] Load error:', err); }
    setLoading(false);
  }, [activeChannel]);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!activeChannel) return;
    const loadMsgs = async () => {
      try { const res = await api.get(`/team/channels/${activeChannel.id}/messages?limit=50`); setMessages((res.data ?? res.data ?? []) as ChatMessage[]); } catch {}
    };
    loadMsgs();
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(loadMsgs, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [activeChannel?.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSendMsg = async () => {
    if (!msgInput.trim() || !activeChannel || sendingMsg) return;
    setSendingMsg(true);
    try {
      await api.post(`/team/channels/${activeChannel.id}/messages`, { content: msgInput.trim() });
      setMsgInput('');
      const res = await api.get(`/team/channels/${activeChannel.id}/messages?limit=50`);
      setMessages((res.data ?? res.data ?? []) as ChatMessage[]);
    } catch {}
    setSendingMsg(false);
  };

  const handleInvite = async () => { if (!inviteEmail.trim()) return; setInviting(true); try { await api.post('/team/invite', { email: inviteEmail.trim(), role: inviteRole }); setInviteEmail(''); setShowInvite(false); loadAll(); } catch {} setInviting(false); };
  const handleCreateChannel = async () => { if (!newChannelName.trim()) return; try { await api.post('/team/channels', { name: newChannelName.trim() }); setNewChannelName(''); setShowNewChannel(false); loadAll(); } catch {} };
  const handleChangeRole = async (memberId: string, role: string) => { try { await api.patch(`/team/members/${memberId}/role`, { role }); loadAll(); setSelectedMember(null); } catch {} };
  const handleTogglePerm = async (memberId: string, currentPerms: string[], perm: string) => { const n = currentPerms.includes(perm) ? currentPerms.filter(p => p !== perm) : [...currentPerms, perm]; try { await api.patch(`/team/members/${memberId}/permissions`, { permissions: n }); loadAll(); setSelectedMember(prev => prev ? { ...prev, permissions: n } : null); } catch {} };
  const handleRemoveMember = async (memberId: string) => { if (!confirm('Retirer ce membre ?')) return; try { await api.delete(`/team/members/${memberId}`); loadAll(); setSelectedMember(null); } catch {} };
  const handleSuspend = async (memberId: string) => { try { await api.patch(`/team/members/${memberId}/suspend`); loadAll(); setSelectedMember(null); } catch {} };
  const handleReactivate = async (memberId: string) => { try { await api.patch(`/team/members/${memberId}/reactivate`); loadAll(); setSelectedMember(null); } catch {} };

  const timeAgo = (ts: unknown) => {
    if (!ts) return '';
    const d = typeof ts === 'object' && ts !== null && 'seconds' in ts ? new Date((ts as { seconds: number }).seconds * 1000) : new Date(ts as string);
    const m = Math.floor((Date.now() - d.getTime()) / 60000);
    if (m < 1) return 'now'; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`;
  };

  if (loading) return <div style={{ background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Loader2 className="animate-spin" size={28} style={{ color: '#a855f7' }} /></div>;

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="dark-ui" style={{ display: 'flex', height: '100%', background: BG, color: TEXT, overflow: 'hidden', fontFamily: 'Outfit, sans-serif', position: 'relative' }}>
      {/* Cosmic green background + auto company watermark */}
      <ChatSceneBackground />

      {/* ── LEFT SIDEBAR (hidden on mobile when chat active) ────────── */}
      <div className={`${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`} style={{ width: 280, flexShrink: 0, flexDirection: 'column', borderRight: `1px solid ${BORDER}`, background: PANEL, minWidth: 0, position: 'relative', zIndex: 1, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        {/* On mobile, sidebar takes full width */}
        <style>{`@media(max-width:768px){[data-team-sidebar]{width:100%!important;min-width:100%!important}}`}</style>
        {/* Team header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6c3ce0, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, boxShadow: '0 4px 20px rgba(168,85,247,0.3)' }}>
              {(company?.name?.[0] ?? 'T').toUpperCase()}
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{company?.name ?? 'Mon Equipe'}</p>
              <p style={{ color: MUTED, fontSize: 11 }}>{members.length} membres · {channels.length} canaux</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
          {([
            { id: 'channels' as SidebarTab, icon: Hash, label: 'Canaux' },
            { id: 'members' as SidebarTab, icon: Users, label: 'Membres' },
            { id: 'activity' as SidebarTab, icon: Activity, label: 'Activite' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setSidebarTab(tab.id)}
              style={{ flex: 1, padding: '10px 0', fontSize: 10, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'transparent', border: 'none', cursor: 'pointer', color: sidebarTab === tab.id ? '#a855f7' : MUTED, borderBottom: sidebarTab === tab.id ? '2px solid #a855f7' : '2px solid transparent', transition: 'all 0.2s' }}>
              <tab.icon size={14} />{tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarTab === 'channels' && (
            <div style={{ paddingTop: 8 }}>
              {hasPerm('manageChannels') && (
                <button onClick={() => setShowNewChannel(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 20px', fontSize: 12, color: '#a855f7', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <Plus size={13} /> Nouveau canal
                </button>
              )}
              {channels.map(ch => (
                <button key={ch.id} onClick={() => { setActiveChannel(ch); setMobileView('chat'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 20px', fontSize: 13, fontWeight: activeChannel?.id === ch.id ? 600 : 400, color: activeChannel?.id === ch.id ? '#fff' : 'rgba(255,255,255,0.6)', background: activeChannel?.id === ch.id ? 'rgba(168,85,247,0.15)' : 'transparent', border: 'none', borderLeft: activeChannel?.id === ch.id ? '3px solid #a855f7' : '3px solid transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <Hash size={14} style={{ color: activeChannel?.id === ch.id ? '#a855f7' : MUTED, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</p>
                    {ch.lastMessage && <p style={{ margin: '2px 0 0', fontSize: 10, color: DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.lastMessageBy}: {ch.lastMessage}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {sidebarTab === 'members' && (
            <div style={{ paddingTop: 8 }}>
              {hasPerm('inviteMembers') && (
                <button onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 20px', fontSize: 12, color: '#a855f7', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <UserPlus size={13} /> Inviter un membre
                </button>
              )}
              {members.map(m => (
                <button key={m.id} onClick={() => setSelectedMember(m)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 20px', background: selectedMember?.id === m.id ? 'rgba(168,85,247,0.1)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: ROLE_GRADIENTS[m.role] ?? ROLE_GRADIENTS.member, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0, boxShadow: `0 2px 10px ${ROLE_COLORS[m.role]}40` }}>
                    {m.photoURL ? <img src={m.photoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (m.displayName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.displayName || m.email}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <span style={{ color: ROLE_COLORS[m.role], display: 'flex' }}>{ROLE_ICONS[m.role]}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: ROLE_COLORS[m.role], textTransform: 'capitalize' }}>{m.role}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {sidebarTab === 'activity' && (
            <div style={{ paddingTop: 8 }}>
              {activities.length === 0 ? (
                <p style={{ fontSize: 12, color: MUTED, textAlign: 'center', padding: '40px 20px' }}>Aucune activite</p>
              ) : activities.map(a => (
                <div key={a.id} style={{ padding: '10px 20px', borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                    <strong style={{ color: '#fff' }}>{a.userName}</strong> {ACTION_LABELS[a.action] ?? a.action}
                    {a.details?.['email'] && <span style={{ color: '#a855f7' }}> {a.details['email'] as string}</span>}
                    {a.details?.['channelName'] && <span style={{ color: '#06b6d4' }}> #{a.details['channelName'] as string}</span>}
                    {a.details?.['newRole'] && <span style={{ color: '#34d399' }}> → {a.details['newRole'] as string}</span>}
                  </p>
                  <p style={{ fontSize: 10, color: DIM, margin: '3px 0 0' }}>{timeAgo(a.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: CHAT (hidden on mobile when sidebar shown) ──────── */}
      <div className={`${mobileView === 'sidebar' ? 'hidden md:flex' : 'flex'}`} style={{ flex: 1, flexDirection: 'column', minWidth: 0, background: CHAT_BG, position: 'relative', zIndex: 1, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>

        {activeChannel ? (
          <>
            {/* Channel header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(10,10,26,0.8)', backdropFilter: 'blur(20px)', flexShrink: 0, position: 'relative', zIndex: 1 }}>
              {/* Back button on mobile */}
              <button onClick={() => setMobileView('sidebar')} className="md:hidden" style={{ background: 'transparent', border: 'none', color: '#a855f7', cursor: 'pointer', padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              </button>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Hash size={18} style={{ color: '#a855f7' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>{activeChannel.name}</p>
                <p style={{ color: MUTED, fontSize: 11, margin: '2px 0 0' }}>{activeChannel.description || `${members.length} membres`}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
                <span style={{ fontSize: 11, color: 'rgba(52,211,153,0.8)' }}>{members.length} en ligne</span>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', position: 'relative', zIndex: 1 }}>
              {messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 0 40px rgba(168,85,247,0.1)' }}>
                    <Hash size={28} style={{ color: '#a855f7' }} />
                  </div>
                  <p style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>Bienvenue dans #{activeChannel.name}</p>
                  <p style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>Commencez la conversation avec votre equipe !</p>
                </div>
              ) : messages.map((msg, idx) => {
                const isMe = msg.authorId === user?.uid;
                return (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: idx > messages.length - 5 ? 0.05 : 0 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: isMe ? 'linear-gradient(135deg, #6c3ce0, #a855f7)' : 'linear-gradient(135deg, #3b82f6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0, boxShadow: isMe ? '0 2px 12px rgba(168,85,247,0.3)' : '0 2px 12px rgba(59,130,246,0.3)' }}>
                      {msg.authorPhoto ? <img src={msg.authorPhoto} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (msg.authorName?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{msg.authorName}</span>
                        <span style={{ fontSize: 10, color: DIM }}>{timeAgo(msg.createdAt)}</span>
                      </div>
                      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div style={{ flexShrink: 0, padding: '12px 24px 20px', position: 'relative', zIndex: 10 }}>
              {/* Hidden file inputs */}
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.csv,.txt,.zip" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setMsgInput(prev => prev + `[Fichier: ${f.name}] `); textareaRef.current?.focus(); } if (fileInputRef.current) fileInputRef.current.value = ''; }} />
              <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setMsgInput(prev => prev + `[Image: ${f.name}] `); textareaRef.current?.focus(); } if (imageInputRef.current) imageInputRef.current.value = ''; }} />

              {/* Emoji picker popup */}
              <AnimatePresence>
                {showEmoji && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    style={{ position: 'absolute', bottom: 90, left: 24, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.4)', zIndex: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
                      {['👍','❤️','😂','🔥','👏','🎉','💯','✅','👀','🚀','💡','⭐','🙏','😊','🤔','💪','📌','✨','🎯','⚡','📊','🛠️','💬','🏆'].map(em => (
                        <button key={em} onClick={() => { setMsgInput(prev => prev + em); setShowEmoji(false); textareaRef.current?.focus(); }}
                          style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.15)'; e.currentTarget.style.transform = 'scale(1.2)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}>
                          {em}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mention picker popup */}
              <AnimatePresence>
                {showMention && members.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    style={{ position: 'absolute', bottom: 90, left: 24, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 8, boxShadow: '0 10px 40px rgba(0,0,0,0.4)', zIndex: 20, maxHeight: 200, overflowY: 'auto', minWidth: 220 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, padding: '4px 8px', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Mentionner {mentionFilter && <span style={{ color: '#a855f7' }}>"{mentionFilter}"</span>}</p>
                    {members.filter(m => !mentionFilter || (m.displayName || m.email).toLowerCase().includes(mentionFilter)).map(m => (
                      <button key={m.id} onClick={() => {
                        // Replace @partial with @fullname
                        const ta = textareaRef.current;
                        if (ta) {
                          const pos = ta.selectionStart;
                          const before = msgInput.slice(0, pos);
                          const after = msgInput.slice(pos);
                          const replaced = before.replace(/@\w*$/, `@${m.displayName || m.email} `);
                          setMsgInput(replaced + after);
                        } else {
                          setMsgInput(prev => prev + `@${m.displayName || m.email} `);
                        }
                        setShowMention(false); setMentionFilter('');
                        setTimeout(() => textareaRef.current?.focus(), 50);
                      }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8, textAlign: 'left', transition: 'all 0.1s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: ROLE_GRADIENTS[m.role] ?? ROLE_GRADIENTS.member, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {(m.displayName?.[0] ?? '?').toUpperCase()}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, color: '#fff', fontWeight: 500 }}>{m.displayName || m.email}</p>
                          <p style={{ margin: 0, fontSize: 10, color: ROLE_COLORS[m.role], textTransform: 'capitalize' }}>{m.role}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ borderRadius: 16, background: CARD, border: `1px solid ${BORDER}`, boxShadow: '0 -4px 30px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                {/* Textarea */}
                <div style={{ padding: '12px 16px 6px' }}>
                  <textarea ref={textareaRef} value={isListening && interimText ? msgInput + ' ' + interimText : msgInput}
                    readOnly={isListening}
                    onChange={e => {
                      const val = e.target.value;
                      setMsgInput(val);
                      // Auto-detect @ for mentions
                      const cursorPos = e.target.selectionStart;
                      const textBefore = val.slice(0, cursorPos);
                      const atMatch = textBefore.match(/@(\w*)$/);
                      if (atMatch) {
                        setShowMention(true); setShowEmoji(false);
                        setMentionFilter(atMatch[1].toLowerCase());
                      } else {
                        if (showMention) setShowMention(false);
                        setMentionFilter('');
                      }
                      // Auto-detect : for emoji
                      const colonMatch = textBefore.match(/:(\w{2,})$/);
                      if (colonMatch) { setShowEmoji(true); setShowMention(false); }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMsg(); }
                      if (e.key === 'Escape') { setShowMention(false); setShowEmoji(false); }
                    }}
                    rows={2}
                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: TEXT, fontFamily: 'Outfit, sans-serif', resize: 'none', minHeight: 48, maxHeight: 120 }}
                    placeholder={isListening ? '🎙️ Parlez maintenant...' : `Message dans #${activeChannel.name}...`} />
                </div>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {[
                      { icon: Paperclip, label: 'Fichier', action: () => fileInputRef.current?.click() },
                      { icon: Image, label: 'Image', action: () => imageInputRef.current?.click() },
                      { icon: AtSign, label: 'Mention', action: () => { setShowMention(p => !p); setShowEmoji(false); } },
                      { icon: Smile, label: 'Emoji', action: () => { setShowEmoji(p => !p); setShowMention(false); } },
                      { icon: Mic, label: isListening ? 'Arreter' : 'Dicter', action: () => toggleMic() },
                    ].map(({ icon: Icon, label, action }) => {
                      const isMicActive = label === 'Arreter' && isListening;
                      return (
                      <button key={label} title={label} onClick={action}
                        className={isMicActive ? 'animate-pulse' : ''}
                        style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isMicActive ? 'rgba(239,68,68,0.2)' : 'rgba(168,85,247,0.08)', border: 'none', cursor: 'pointer', color: isMicActive ? '#ef4444' : '#7c3aed', transition: 'all 0.15s' }}
                        onMouseEnter={e => { if (!isMicActive) { e.currentTarget.style.background = 'rgba(168,85,247,0.2)'; e.currentTarget.style.color = '#a855f7'; } }}
                        onMouseLeave={e => { if (!isMicActive) { e.currentTarget.style.background = 'rgba(168,85,247,0.08)'; e.currentTarget.style.color = '#7c3aed'; } }}>
                        <Icon size={15} />
                      </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: DIM }}>Enter envoyer</span>
                    <button onClick={handleSendMsg} disabled={!msgInput.trim() || sendingMsg}
                      style={{ height: 34, padding: '0 16px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: msgInput.trim() ? 'linear-gradient(135deg, #6c3ce0, #a855f7)' : 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', cursor: 'pointer', opacity: !msgInput.trim() ? 0.4 : 1, boxShadow: msgInput.trim() ? '0 4px 15px rgba(168,85,247,0.4)' : 'none', transition: 'all 0.2s', fontSize: 13, fontWeight: 600 }}>
                      {sendingMsg ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, rgba(108,60,224,0.3), rgba(6,182,212,0.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 60px rgba(168,85,247,0.15)', marginBottom: 20 }}>
              <MessageSquare size={32} style={{ color: '#a855f7' }} />
            </div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>Espace Equipe</p>
            <p style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>Selectionnez un canal pour commencer</p>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL: Member details ──────────────────────────────── */}
      <AnimatePresence>
        {selectedMember && (
          <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}
            className="hidden md:flex"
            style={{ width: 320, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, background: PANEL, flexDirection: 'column', overflowY: 'auto', position: 'relative', zIndex: 1, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Profil membre</span>
              <button onClick={() => setSelectedMember(null)} style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', padding: 4 }}><X size={14} /></button>
            </div>

            {/* Profile card */}
            <div style={{ padding: 24, textAlign: 'center', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: ROLE_GRADIENTS[selectedMember.role], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 auto', boxShadow: `0 8px 30px ${ROLE_COLORS[selectedMember.role]}40` }}>
                {selectedMember.photoURL ? <img src={selectedMember.photoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (selectedMember.displayName?.[0] ?? '?').toUpperCase()}
              </div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginTop: 12 }}>{selectedMember.displayName}</p>
              <p style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{selectedMember.email}</p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 12px', borderRadius: 20, background: `${ROLE_COLORS[selectedMember.role]}20` }}>
                <span style={{ color: ROLE_COLORS[selectedMember.role], display: 'flex' }}>{ROLE_ICONS[selectedMember.role]}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLORS[selectedMember.role], textTransform: 'capitalize' }}>{selectedMember.role}</span>
              </div>
            </div>

            {/* Role changer */}
            {hasPerm('manageTeam') && selectedMember.role !== 'owner' && (
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Role</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(['admin', 'manager', 'member', 'viewer'] as const).map(r => (
                    <button key={r} onClick={() => handleChangeRole(selectedMember.id, r)}
                      style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', textTransform: 'capitalize', color: selectedMember.role === r ? '#fff' : 'rgba(255,255,255,0.5)', background: selectedMember.role === r ? ROLE_GRADIENTS[r] : GLASS, boxShadow: selectedMember.role === r ? `0 2px 10px ${ROLE_COLORS[r]}40` : 'none', transition: 'all 0.2s' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Permissions */}
            {hasPerm('manageTeam') && selectedMember.role !== 'owner' && (
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Permissions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ALL_PERMISSIONS.map(p => {
                    const has = selectedMember.permissions?.includes(p);
                    return (
                      <button key={p} onClick={() => handleTogglePerm(selectedMember.id, selectedMember.permissions ?? [], p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: has ? '#a855f7' : 'transparent', border: has ? 'none' : '1px solid rgba(255,255,255,0.15)', transition: 'all 0.15s' }}>
                          {has && <Check size={10} style={{ color: '#fff' }} />}
                        </div>
                        <span style={{ fontSize: 12, color: has ? '#fff' : 'rgba(255,255,255,0.4)' }}>{PERM_LABELS[p] ?? p}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status + Suspend/Reactivate */}
            {hasPerm('manageTeam') && selectedMember.role !== 'owner' && selectedMember.id !== user?.uid && (
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Statut</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedMember.status === 'active' ? '#34d399' : selectedMember.status === 'suspended' ? '#f59e0b' : '#ef4444' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: selectedMember.status === 'active' ? '#34d399' : selectedMember.status === 'suspended' ? '#f59e0b' : '#ef4444', textTransform: 'capitalize' }}>
                    {selectedMember.status || 'active'}
                  </span>
                </div>
                {selectedMember.status === 'active' && (
                  <button onClick={() => handleSuspend(selectedMember.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0', fontSize: 12, fontWeight: 500, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, cursor: 'pointer' }}>
                    <Shield size={13} /> Suspendre
                  </button>
                )}
                {selectedMember.status === 'suspended' && (
                  <button onClick={() => handleReactivate(selectedMember.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0', fontSize: 12, fontWeight: 500, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, cursor: 'pointer' }}>
                    <Check size={13} /> Reactiver
                  </button>
                )}
              </div>
            )}

            {/* Remove */}
            {hasPerm('removeMembers') && selectedMember.role !== 'owner' && selectedMember.id !== user?.uid && (
              <div style={{ padding: 20 }}>
                <button onClick={() => handleRemoveMember(selectedMember.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', fontSize: 13, fontWeight: 500, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, cursor: 'pointer' }}>
                  <Trash2 size={14} /> Retirer de l'equipe
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── INVITE MODAL ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowInvite(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              style={{ background: CARD, borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', width: '100%', maxWidth: 420, margin: '0 16px', padding: 28, border: `1px solid ${BORDER}` }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 20px' }}><UserPlus size={18} style={{ color: '#a855f7' }} /> Inviter un membre</h3>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Email</label>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, outline: 'none', fontFamily: 'Outfit, sans-serif' }}
                  placeholder="collegue@entreprise.com" type="email" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Role</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['admin', 'manager', 'member', 'viewer'] as const).map(r => (
                    <button key={r} onClick={() => setInviteRole(r)}
                      style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', textTransform: 'capitalize', color: inviteRole === r ? '#fff' : 'rgba(255,255,255,0.4)', background: inviteRole === r ? ROLE_GRADIENTS[r] : GLASS, transition: 'all 0.2s' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowInvite(false)} style={{ flex: 1, padding: '10px 0', fontSize: 13, color: MUTED, background: GLASS, border: 'none', borderRadius: 10, cursor: 'pointer' }}>Annuler</button>
                <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                  style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #6c3ce0, #a855f7)', border: 'none', borderRadius: 10, cursor: 'pointer', opacity: !inviteEmail.trim() ? 0.4 : 1, boxShadow: '0 4px 15px rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {inviting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Inviter
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NEW CHANNEL MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewChannel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowNewChannel(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              style={{ background: CARD, borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', width: '100%', maxWidth: 380, margin: '0 16px', padding: 28, border: `1px solid ${BORDER}` }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 20px' }}><Hash size={18} style={{ color: '#a855f7' }} /> Nouveau canal</h3>
              <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateChannel()}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, outline: 'none', marginBottom: 20, fontFamily: 'Outfit, sans-serif' }}
                placeholder="nom-du-canal" />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowNewChannel(false)} style={{ flex: 1, padding: '10px 0', fontSize: 13, color: MUTED, background: GLASS, border: 'none', borderRadius: 10, cursor: 'pointer' }}>Annuler</button>
                <button onClick={handleCreateChannel} disabled={!newChannelName.trim()}
                  style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #6c3ce0, #a855f7)', border: 'none', borderRadius: 10, cursor: 'pointer', opacity: !newChannelName.trim() ? 0.4 : 1, boxShadow: '0 4px 15px rgba(168,85,247,0.3)' }}>
                  Creer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
