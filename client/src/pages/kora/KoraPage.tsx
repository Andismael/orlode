/**
 * Kora — personal companion.
 * Single-file V1: profile/onboarding + chat + facts + reminders.
 * Voice (Gemini Live) and richer UI come in V2.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  Send, Loader2, Settings, X, Trash2, BellRing, Brain, Phone, Globe2, Clock4, Volume2,
} from 'lucide-react';

const C = {
  ocean: '#0F2C5C', oceanDeep: '#091E3D', oceanSoft: '#1D3F7A',
  amber: '#F59E0B', amberDeep: '#B45309', amberSoft: '#FDE68A',
  cream: '#FAF7F0', creamDeep: '#F2EBDC',
  ink: '#0B1626', inkSoft: '#5A6577',
  border: 'rgba(15,44,92,0.10)',
};

interface KoraProfile {
  uid: string;
  companyId: string;
  firstName: string;
  /** Custom display name for the companion; defaults to "Kora". */
  assistantName: string;
  language: 'fr' | 'en' | 'pt' | 'de';
  timezone: string;
  checkInHour: number;
  voiceId: string | null;
  personality: 'warm' | 'direct' | 'playful';
  enabled: boolean;
  phoneE164: string | null;
  ownerMessageRouting: 'business' | 'personal' | 'auto';
  directives: string[];
  subscriptionStatus: 'none' | 'trial' | 'active' | 'expired';
  trialStartedAt: string | null;
}

interface KoraFact {
  id: string;
  category: string;
  content: string;
  confidence: number;
  recordedAt: string;
}

interface KoraReminder {
  id: string;
  title: string;
  dueAt: string | null;
  contextSnippet: string | null;
  channel: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

const PERSONALITIES = [
  { id: 'warm',    label: 'Chaleureuse',  desc: 'Attentive, jamais mielleuse' },
  { id: 'direct',  label: 'Directe',      desc: 'Efficace, droit au but' },
  { id: 'playful', label: 'Joueuse',      desc: 'Légère, parfois taquine' },
] as const;

const ROUTING_MODES = [
  { id: 'business', label: 'Business',  desc: 'Tes messages → Commerce. @kora pour Kora.' },
  { id: 'personal', label: 'Personnel', desc: 'Tous tes messages → Kora.' },
  { id: 'auto',     label: 'Auto',      desc: 'Classifier auto perso vs business.' },
] as const;

const LANGUAGES = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
  { id: 'pt', label: 'Português' },
  { id: 'de', label: 'Deutsch' },
] as const;

function detectTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Abidjan'; }
  catch { return 'Africa/Abidjan'; }
}

export default function KoraPage() {
  const [profile, setProfile] = useState<KoraProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [facts, setFacts] = useState<KoraFact[]>([]);
  const [reminders, setReminders] = useState<KoraReminder[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Load profile + facts + reminders ─────────────────────────────────────
  const refreshAll = async () => {
    try {
      const [pRes, fRes, rRes]: any[] = await Promise.all([
        api.get('/kora/profile'),
        api.get('/kora/facts').catch(() => ({ data: [] })),
        api.get('/kora/reminders').catch(() => ({ data: [] })),
      ]);
      const p = pRes?.data as KoraProfile;
      setProfile(p);
      setFacts((fRes?.data as KoraFact[]) || []);
      setReminders((rRes?.data as KoraReminder[]) || []);
      if (!p.firstName) setNeedsOnboarding(true);
    } finally { setLoading(false); }
  };
  useEffect(() => { refreshAll(); }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat]);

  // ── Send a message ───────────────────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!profile?.firstName) { setNeedsOnboarding(true); return; }
    setInput('');
    setChat(prev => [...prev, { role: 'user', text, ts: Date.now() }]);
    setSending(true);
    try {
      const r: any = await api.post('/kora/chat', { message: text, sessionId });
      const reply = r?.data?.text ?? '…';
      const sid   = r?.data?.sessionId ?? sessionId;
      setSessionId(sid);
      setChat(prev => [...prev, { role: 'assistant', text: reply, ts: Date.now() }]);
      // Refresh facts/reminders in background so tool calls show up.
      refreshAll();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Kora n\'a pas pu répondre.');
    } finally { setSending(false); }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const forgetFact = async (id: string) => {
    if (!window.confirm('Effacer ce souvenir ?')) return;
    try {
      await api.delete(`/kora/facts/${id}`);
      setFacts(prev => prev.filter(f => f.id !== id));
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible.');
    }
  };

  const cancelReminder = async (id: string) => {
    try {
      await api.delete(`/kora/reminders/${id}`);
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible.');
    }
  };

  // ── Onboarding modal ─────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ minHeight: '100vh', background: C.ocean, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} style={{ animation: 'koraSpin 1s linear infinite' }} /></div>;
  }

  return (
    <>
      <style>{`
        @keyframes koraSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        /* Kill Chrome/Edge autofill yellow that ignores our background. */
        .kora-input:-webkit-autofill,
        .kora-input:-webkit-autofill:hover,
        .kora-input:-webkit-autofill:focus,
        .kora-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px ${C.oceanDeep} inset !important;
          -webkit-text-fill-color: ${C.cream} !important;
          caret-color: ${C.amber} !important;
          transition: background-color 9999s ease-in-out 0s;
        }
        @keyframes koraPulse { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
        .kora-page { min-height: 100vh; background: linear-gradient(180deg, ${C.oceanDeep} 0%, ${C.ocean} 100%); color: ${C.cream}; font-family: 'Inter', sans-serif; }
        .kora-bubble-user { background: ${C.amber}; color: ${C.oceanDeep}; }
        .kora-bubble-ai   { background: rgba(255,255,255,0.08); color: ${C.cream}; border: 1px solid rgba(255,255,255,0.12); }
        /* Solid dark background on inputs so the cream text stays readable
           regardless of which layout (light/dark) wraps the page. */
        .kora-input { background: ${C.oceanDeep} !important; color: ${C.cream} !important; border: 1px solid rgba(255,255,255,0.18); border-radius: 14px; padding: 12px 14px; font-size: 14px; font-family: inherit; resize: none; outline: none; -webkit-text-fill-color: ${C.cream}; caret-color: ${C.amber}; }
        .kora-input::placeholder { color: rgba(250,247,240,0.45); }
        .kora-input:focus { border-color: ${C.amber}; }
        .kora-input option { background: ${C.oceanDeep}; color: ${C.cream}; }
        .kora-btn-primary { background: ${C.amber}; color: ${C.oceanDeep}; border: none; padding: 10px 16px; border-radius: 12px; font-weight: 700; cursor: pointer; display: inline-flex; gap: 8px; align-items: center; font-family: inherit; }
        .kora-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .kora-btn-ghost { background: transparent; color: ${C.cream}; border: 1px solid rgba(255,255,255,0.15); padding: 8px 14px; border-radius: 12px; cursor: pointer; font-family: inherit; }
        .kora-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; }
        .kora-pill { display: inline-flex; gap: 6px; align-items: center; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }
        .kora-label { font-size: 11px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.08em; }
        .kora-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 100; }
        .kora-modal { background: ${C.ocean}; border: 1px solid rgba(255,255,255,0.1); border-radius: 22px; max-width: 480px; width: 100%; padding: 28px; max-height: 90vh; overflow-y: auto; }
        .kora-avatar { width: 64px; height: 64px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, ${C.oceanSoft}, ${C.oceanDeep}); display: flex; align-items: center; justify-content: center; position: relative; }
        .kora-avatar::after { content: ''; position: absolute; bottom: 8px; left: 18px; right: 18px; height: 24px; border-radius: 0 0 28px 28px; border: 3px solid ${C.amber}; border-top: none; }
      `}</style>

      <div className="kora-page">
        {/* Header */}
        <div style={{ padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="kora-avatar" style={{ width: 44, height: 44 }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{profile?.assistantName || 'Kora'}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                Ton compagnon qui se souvient · {profile?.firstName ? `pour ${profile.firstName}` : 'non configuré'}
                {profile?.assistantName && profile.assistantName.toLowerCase() !== 'kora' && (
                  <span style={{ opacity: 0.6 }}> · propulsé par Kora</span>
                )}
              </div>
            </div>
          </div>
          <button className="kora-btn-ghost" onClick={() => setShowSettings(true)}><Settings size={14} /> Paramètres</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24, padding: 24, maxWidth: 1280, margin: '0 auto' }}>
          {/* Chat */}
          <div className="kora-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 6 }}>
              {chat.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,250,240,0.6)' }}>
                  <div className="kora-avatar" style={{ width: 80, height: 80, margin: '0 auto 18px' }} />
                  <div style={{ fontSize: 18, fontWeight: 600, color: C.cream, marginBottom: 6 }}>
                    Salut {profile?.firstName || ''}, je suis {profile?.assistantName || 'Kora'}.
                  </div>
                  <div style={{ fontSize: 13, maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
                    Parle-moi de ce qui te passe par la tête. Je me souviendrai de ce qui compte, j'oublierai sur demande.
                  </div>
                </div>
              ) : chat.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div className={m.role === 'user' ? 'kora-bubble-user' : 'kora-bubble-ai'}
                       style={{ maxWidth: '76%', padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {sending && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div className="kora-bubble-ai" style={{ padding: '10px 14px', borderRadius: 16, fontSize: 14, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <Loader2 size={14} style={{ animation: 'koraSpin 1s linear infinite' }} /> Kora réfléchit…
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'flex-end' }}>
              <textarea
                className="kora-input"
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 160,
                  background: C.oceanDeep,
                  color: C.cream,
                  WebkitTextFillColor: C.cream,
                  caretColor: C.amber,
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                }}
                placeholder="Dis-moi…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                autoFocus
              />
              <button className="kora-btn-primary" onClick={send} disabled={sending || !input.trim()}>
                <Send size={14} /> Envoyer
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
            <div className="kora-card">
              <div className="kora-label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><BellRing size={12} /> Rappels à venir</div>
              {reminders.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Aucun rappel programmé.</div>
              ) : reminders.map(r => (
                <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{r.dueAt ? new Date(r.dueAt).toLocaleString('fr-FR') : '—'}</div>
                    {r.contextSnippet && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontStyle: 'italic' }}>« {r.contextSnippet} »</div>}
                  </div>
                  <button onClick={() => cancelReminder(r.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4 }}><X size={14} /></button>
                </div>
              ))}
            </div>

            <div className="kora-card">
              <div className="kora-label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Brain size={12} /> Ce qu'elle sait de toi ({facts.length})</div>
              {facts.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Encore rien. Parle-lui — ce qui compte sera retenu.</div>
              ) : facts.slice(0, 12).map(f => (
                <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.amber, letterSpacing: '0.05em', marginBottom: 2 }}>{f.category.toUpperCase()}</div>
                    <div>{f.content}</div>
                  </div>
                  <button onClick={() => forgetFact(f.id)} title="Oublier" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: 4 }}><Trash2 size={13} /></button>
                </div>
              ))}
              {facts.length > 12 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>+ {facts.length - 12} autres</div>}
            </div>
          </div>
        </div>

        {needsOnboarding && profile && (
          <OnboardingModal
            initial={profile}
            onSaved={(p) => { setProfile(p); setNeedsOnboarding(false); }}
          />
        )}

        {showSettings && profile && (
          <SettingsModal
            initial={profile}
            onClose={() => setShowSettings(false)}
            onSaved={(p) => { setProfile(p); setShowSettings(false); }}
          />
        )}
      </div>
    </>
  );
}

// ── Onboarding modal (first visit) ──────────────────────────────────────────
function OnboardingModal({ initial, onSaved }: { initial: KoraProfile; onSaved: (p: KoraProfile) => void }) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [assistantName, setAssistantName] = useState(initial.assistantName || 'Kora');
  const [language, setLanguage] = useState(initial.language);
  const [personality, setPersonality] = useState(initial.personality);
  const [timezone, setTimezone] = useState(initial.timezone || detectTimezone());
  const [checkInHour, setCheckInHour] = useState(initial.checkInHour);
  const [phoneE164, setPhoneE164] = useState(initial.phoneE164 || '');
  const [dir1, setDir1] = useState((initial.directives ?? [])[0] || '');
  const [dir2, setDir2] = useState((initial.directives ?? [])[1] || '');
  const [dir3, setDir3] = useState((initial.directives ?? [])[2] || '');
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (!firstName.trim()) { toast.error('Ton prénom, c\'est essentiel.'); return; }
    setSubmitting(true);
    try {
      // 1. Save the profile basics.
      await api.patch('/kora/profile', {
        firstName,
        assistantName: assistantName.trim() || 'Kora',
        language, personality, timezone, checkInHour,
        phoneE164: phoneE164.trim() || null,
      });
      // 2. Activate Kora — starts the 7-day trial, persists directives.
      const directives = [dir1, dir2, dir3].map(s => s.trim()).filter(Boolean);
      const r: any = await api.post('/kora/activate', { directives });
      onSaved(r?.data as KoraProfile);
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Activation impossible.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="kora-modal-bg">
      <div className="kora-modal">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
          <div className="kora-avatar" style={{ width: 56, height: 56 }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.cream }}>Bienvenue.</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Quelques infos pour que je te reconnaisse.</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="kora-label">Comment je peux t'appeler ?</div>
            <input className="kora-input" autoComplete="off" name="kora-firstname" style={{ width: '100%', marginTop: 6 }} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ismael" autoFocus />
          </div>
          <div>
            <div className="kora-label">Et moi, comment veux-tu m'appeler ?</div>
            <input className="kora-input" autoComplete="off" name="kora-assistant" style={{ width: '100%', marginTop: 6 }} value={assistantName} onChange={e => setAssistantName(e.target.value)} placeholder="Kora (ou Léa, Yao, Aïda…)" />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
              "Kora" par défaut. Tu peux choisir un autre nom — je m'y ferai.
            </div>
          </div>
          <div>
            <div className="kora-label">Personnalité</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {PERSONALITIES.map(p => (
                <button key={p.id} className="kora-btn-ghost" onClick={() => setPersonality(p.id)}
                  style={{ flex: 1, padding: '10px 8px', background: personality === p.id ? C.amber : 'transparent', color: personality === p.id ? C.oceanDeep : C.cream, fontWeight: 600 }}>
                  <div style={{ fontSize: 13 }}>{p.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div className="kora-label"><Globe2 size={11} style={{ verticalAlign: 'middle' }} /> Langue</div>
              <select className="kora-input" style={{ width: '100%', marginTop: 6 }} value={language} onChange={e => setLanguage(e.target.value as any)}>
                {LANGUAGES.map(l => <option key={l.id} value={l.id} style={{ color: '#000' }}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <div className="kora-label"><Clock4 size={11} style={{ verticalAlign: 'middle' }} /> Check-in à</div>
              <select className="kora-input" style={{ width: '100%', marginTop: 6 }} value={checkInHour} onChange={e => setCheckInHour(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h} style={{ color: '#000' }}>{String(h).padStart(2, '0')}h</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="kora-label">Fuseau horaire</div>
            <input className="kora-input" autoComplete="off" name="kora-tz" style={{ width: '100%', marginTop: 6 }} value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="Africa/Abidjan" />
          </div>
          <div>
            <div className="kora-label"><Phone size={11} style={{ verticalAlign: 'middle' }} /> WhatsApp (optionnel)</div>
            <input className="kora-input" autoComplete="off" name="kora-phone" type="tel" style={{ width: '100%', marginTop: 6 }} value={phoneE164} onChange={e => setPhoneE164(e.target.value)} placeholder="+225 07 12 34 56 78" />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
              Si renseigné, Kora pourra t'envoyer des rappels et un check-in matinal sur WhatsApp.
              Active une session en tapant <strong>"salut kora"</strong> depuis ton numéro.
            </div>
          </div>

          <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 4 }}>Tes directives (optionnel mais recommandé)</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 10, lineHeight: 1.5 }}>
              3 instructions max — Kora les respecte en priorité.<br />
              Ex: "ne me parle jamais de politique" · "rappelle-moi de boire de l'eau" · "sois plus direct quand je suis fatigué"
            </div>
            <input className="kora-input" autoComplete="off" name="kora-dir-1" style={{ width: '100%', marginBottom: 8 }} value={dir1} onChange={e => setDir1(e.target.value)} placeholder="Directive 1" />
            <input className="kora-input" autoComplete="off" name="kora-dir-2" style={{ width: '100%', marginBottom: 8 }} value={dir2} onChange={e => setDir2(e.target.value)} placeholder="Directive 2 (optionnelle)" />
            <input className="kora-input" autoComplete="off" name="kora-dir-3" style={{ width: '100%' }} value={dir3} onChange={e => setDir3(e.target.value)} placeholder="Directive 3 (optionnelle)" />
          </div>

          <div style={{ fontSize: 11, color: 'rgba(245,158,11,0.85)', padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, lineHeight: 1.5 }}>
            <strong>Essai gratuit 7 jours.</strong> Kora est un addon — après l'essai, $5/mois pour continuer (tarif indicatif). Tes souvenirs sont conservés même si tu fais une pause.
          </div>
        </div>

        <button className="kora-btn-primary" style={{ width: '100%', marginTop: 22, justifyContent: 'center' }} onClick={save} disabled={submitting}>
          {submitting ? <Loader2 size={14} style={{ animation: 'koraSpin 1s linear infinite' }} /> : null}
          {submitting ? 'Activation…' : 'Activer Kora (essai 7 jours).'}
        </button>
      </div>
    </div>
  );
}

// ── Settings modal (subsequent visits) ──────────────────────────────────────
function SettingsModal({ initial, onClose, onSaved }: { initial: KoraProfile; onClose: () => void; onSaved: (p: KoraProfile) => void }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [assistantName, setAssistantName] = useState(initial.assistantName || 'Kora');
  const [language, setLanguage] = useState(initial.language);
  const [personality, setPersonality] = useState(initial.personality);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [checkInHour, setCheckInHour] = useState(initial.checkInHour);
  const [phoneE164, setPhoneE164] = useState(initial.phoneE164 || '');
  const [ownerMessageRouting, setOwnerMessageRouting] = useState<KoraProfile['ownerMessageRouting']>(initial.ownerMessageRouting || 'business');
  const [directives, setDirectives] = useState<string[]>((initial.directives ?? []).concat(['', '', '']).slice(0, 3));
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    setSubmitting(true);
    try {
      const cleanedDirectives = directives.map(d => d.trim()).filter(Boolean).slice(0, 5);
      const r: any = await api.patch('/kora/profile', {
        enabled, firstName,
        assistantName: assistantName.trim() || 'Kora',
        language, personality, timezone, checkInHour,
        phoneE164: phoneE164.trim() || null,
        ownerMessageRouting,
        directives: cleanedDirectives,
      });
      onSaved(r?.data as KoraProfile);
      toast.success('Mis à jour');
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Sauvegarde impossible.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="kora-modal-bg" onClick={onClose}>
      <div className="kora-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.cream }}>Paramètres Kora</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ fontWeight: 600, color: C.cream }}>Kora active</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Désactive pour la mettre en pause sans perdre la mémoire.</div>
            </div>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          </label>
          <div>
            <div className="kora-label">Ton prénom</div>
            <input className="kora-input" style={{ width: '100%', marginTop: 6 }} value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div>
            <div className="kora-label">Nom de ton assistant</div>
            <input className="kora-input" style={{ width: '100%', marginTop: 6 }} value={assistantName} onChange={e => setAssistantName(e.target.value)} placeholder="Kora" />
          </div>
          <div>
            <div className="kora-label">Personnalité</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {PERSONALITIES.map(p => (
                <button key={p.id} className="kora-btn-ghost" onClick={() => setPersonality(p.id)}
                  style={{ flex: 1, padding: '10px 8px', background: personality === p.id ? C.amber : 'transparent', color: personality === p.id ? C.oceanDeep : C.cream, fontWeight: 600 }}>
                  <div style={{ fontSize: 13 }}>{p.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div className="kora-label">Langue</div>
              <select className="kora-input" style={{ width: '100%', marginTop: 6 }} value={language} onChange={e => setLanguage(e.target.value as any)}>
                {LANGUAGES.map(l => <option key={l.id} value={l.id} style={{ color: '#000' }}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <div className="kora-label">Check-in</div>
              <select className="kora-input" style={{ width: '100%', marginTop: 6 }} value={checkInHour} onChange={e => setCheckInHour(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h} style={{ color: '#000' }}>{String(h).padStart(2, '0')}h</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="kora-label">Fuseau horaire</div>
            <input className="kora-input" style={{ width: '100%', marginTop: 6 }} value={timezone} onChange={e => setTimezone(e.target.value)} />
          </div>
          <div>
            <div className="kora-label">WhatsApp</div>
            <input className="kora-input" style={{ width: '100%', marginTop: 6 }} value={phoneE164} onChange={e => setPhoneE164(e.target.value)} placeholder="+225 …" />
          </div>
          <div>
            <div className="kora-label">Directives (max 3)</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 8 }}>
              Kora les respecte en priorité.
            </div>
            {directives.map((d, i) => (
              <input key={i} className="kora-input" autoComplete="off" style={{ width: '100%', marginBottom: 6 }} value={d}
                onChange={e => setDirectives(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                placeholder={`Directive ${i + 1}`} />
            ))}
          </div>
          <div>
            <div className="kora-label">Mode WhatsApp (tes messages owner)</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {ROUTING_MODES.map(m => (
                <button key={m.id} className="kora-btn-ghost" onClick={() => setOwnerMessageRouting(m.id)}
                  style={{ flex: 1, padding: '10px 8px', background: ownerMessageRouting === m.id ? C.amber : 'transparent', color: ownerMessageRouting === m.id ? C.oceanDeep : C.cream, fontWeight: 600, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{m.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.75, lineHeight: 1.3, marginTop: 2 }}>{m.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>
              Les clients lambda vont toujours chez Commerce, quel que soit ce choix.
            </div>
          </div>
        </div>

        <button className="kora-btn-primary" style={{ width: '100%', marginTop: 22, justifyContent: 'center' }} onClick={save} disabled={submitting}>
          {submitting ? <Loader2 size={14} style={{ animation: 'koraSpin 1s linear infinite' }} /> : null}
          {submitting ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
