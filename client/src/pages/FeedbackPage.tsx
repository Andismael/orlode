/**
 * FeedbackPage — dedicated page for users to submit bugs, ideas, praise, etc.
 * Posts to the existing /api/beta-feedback endpoint. Same backend as the
 * floating BetaFeedbackButton, just a richer in-page experience instead of
 * a small modal.
 */
import React, { useState } from 'react';
import {
  MessageSquarePlus, Send, Loader2, CheckCircle2, AlertCircle,
  Bug, Lightbulb, Heart, MessageCircle, Sparkles, Star,
} from 'lucide-react';
import api from '@/services/api';

type FeedbackType = 'bug' | 'feature' | 'praise' | 'other';

const TYPES: Array<{ v: FeedbackType; icon: React.ElementType; label: string; desc: string; color: string; bg: string }> = [
  { v: 'bug',     icon: Bug,            label: 'Bug',      desc: 'Quelque chose ne marche pas',  color: '#EF4444', bg: '#FEE2E2' },
  { v: 'feature', icon: Lightbulb,      label: 'Idée',     desc: 'Suggestion de fonctionnalité', color: '#7C3AED', bg: '#EDE9FE' },
  { v: 'praise',  icon: Heart,          label: 'J\'adore', desc: 'Tu kiffes une feature',         color: '#EC4899', bg: '#FCE7F3' },
  { v: 'other',   icon: MessageCircle,  label: 'Autre',    desc: 'Question, retour libre',        color: '#0EA5E9', bg: '#E0F2FE' },
];

const SEVERITIES: Array<{ v: 'low' | 'medium' | 'high' | 'critical'; label: string; color: string }> = [
  { v: 'low',      label: 'Faible',   color: '#94A3A0' },
  { v: 'medium',   label: 'Moyen',    color: '#0EA5E9' },
  { v: 'high',     label: 'Important',color: '#F59E0B' },
  { v: 'critical', label: 'Critique', color: '#EF4444' },
];

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>('bug');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || !description.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post('/beta-feedback', {
        type, severity, title, description,
        page: typeof window !== 'undefined' ? window.location.pathname : null,
      });
      setDone(true);
      // Reset after a short delay so the user sees the success state
      setTimeout(() => {
        setTitle(''); setDescription(''); setType('bug'); setSeverity('medium'); setDone(false);
      }, 4000);
    } catch (e: any) {
      setErr(e?.message ?? 'Échec de l\'envoi. Réessaie dans un instant.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: '#FFFAF0', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px 64px' }}>
        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 50%, #EC4899 100%)',
          color: '#fff', borderRadius: 24, padding: '36px 32px',
          boxShadow: '0 30px 60px -20px rgba(124,58,237,0.4)',
          marginBottom: 32, position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <svg style={{ position: 'absolute', right: -40, top: -40, opacity: 0.15 }} width="220" height="220" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="100" stroke="#fff" strokeWidth="1" fill="none" />
            <circle cx="110" cy="110" r="60" stroke="#fff" strokeWidth="1" fill="none" />
            <circle cx="110" cy="110" r="20" fill="#FBBF24" opacity="0.5" />
          </svg>
          <div style={{ position: 'relative' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', padding: '5px 12px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', borderRadius: 100, marginBottom: 14 }}>
              <Sparkles size={11} fill="#FBBF24" /> PHASE DE LANCEMENT
            </span>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px', lineHeight: 1.1 }}>
              Ton feedback compte.
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,250,240,0.9)', margin: 0, maxWidth: 560 }}>
              On code Orlode en public. Chaque retour — bug, idée, ou simple "j'adore" — nous aide à corriger en heures et à prioriser ce qui sert vraiment ton entreprise. Promis : on lit tout.
            </p>
          </div>
        </div>

        {/* Form card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 28, border: '1px solid rgba(10,42,32,0.06)', boxShadow: '0 4px 12px -4px rgba(10,42,32,0.05)' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <CheckCircle2 size={64} color="#10B981" style={{ margin: '0 auto 16px' }} />
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: '#0A2A20', margin: '0 0 8px' }}>Merci 🙏</h2>
              <p style={{ fontSize: 14, color: '#5A6B62', margin: 0 }}>On regarde ça tout de suite. Tu peux soumettre un autre feedback dans quelques secondes.</p>
            </div>
          ) : (
            <>
              {/* Type selector */}
              <label style={{ fontSize: 11, fontWeight: 800, color: '#5A6B62', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                1. Type de feedback
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
                {TYPES.map(o => {
                  const Icon = o.icon;
                  const active = type === o.v;
                  return (
                    <button key={o.v} onClick={() => setType(o.v)}
                      style={{ background: active ? o.bg : '#F5EDD6', color: active ? o.color : '#5A6B62', border: `1.5px solid ${active ? o.color : 'transparent'}`, borderRadius: 14, padding: '14px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                      <Icon size={20} />
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{o.label}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.85, lineHeight: 1.2, textAlign: 'center' }}>{o.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Severity (only relevant for bugs) */}
              {type === 'bug' && (
                <>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#5A6B62', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                    Gravité
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                    {SEVERITIES.map(s => {
                      const active = severity === s.v;
                      return (
                        <button key={s.v} onClick={() => setSeverity(s.v)}
                          style={{ padding: '8px 14px', borderRadius: 100, border: `1.5px solid ${active ? s.color : 'rgba(10,42,32,0.1)'}`, background: active ? s.color : '#fff', color: active ? '#fff' : '#5A6B62', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Title */}
              <label style={{ fontSize: 11, fontWeight: 800, color: '#5A6B62', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                2. Titre court
              </label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={150}
                placeholder={type === 'bug' ? 'Ex: Le devis ne s\'envoie pas par email' : type === 'feature' ? 'Ex: Pouvoir programmer les rappels WhatsApp' : 'Ex: J\'adore le marketplace, c\'est intuitif'}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid rgba(10,42,32,0.1)', background: '#F5EDD6', fontSize: 14, color: '#0A2A20', fontFamily: 'inherit', outline: 'none', marginBottom: 4 }}
              />
              <div style={{ fontSize: 11, color: '#94A3A0', textAlign: 'right', marginBottom: 18 }}>{title.length}/150</div>

              {/* Description */}
              <label style={{ fontSize: 11, fontWeight: 800, color: '#5A6B62', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                3. Détails
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} rows={6}
                placeholder={type === 'bug'
                  ? 'Ce qui s\'est passé, ce que tu attendais, étapes pour reproduire, navigateur/téléphone utilisé…'
                  : type === 'feature'
                  ? 'Décris ton idée. Le problème qu\'elle résout. Comment tu imagines que ça marche.'
                  : 'Raconte-nous ce que tu veux qu\'on sache…'}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid rgba(10,42,32,0.1)', background: '#F5EDD6', fontSize: 14, color: '#0A2A20', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
              />
              <div style={{ fontSize: 11, color: '#94A3A0', textAlign: 'right', marginBottom: 18 }}>{description.length}/4000</div>

              {/* Error */}
              {err && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 12, marginBottom: 18, fontSize: 13 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{err}</span>
                </div>
              )}

              {/* Submit */}
              <button onClick={submit} disabled={busy || !title.trim() || !description.trim()}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 14,
                  background: busy || !title.trim() || !description.trim()
                    ? '#E5E5E5'
                    : 'linear-gradient(135deg, #7C3AED, #EC4899)',
                  color: '#fff', border: 'none', fontWeight: 800, fontSize: 15,
                  cursor: busy || !title.trim() || !description.trim() ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  boxShadow: busy || !title.trim() || !description.trim()
                    ? 'none' : '0 12px 28px -8px rgba(124,58,237,0.5)',
                }}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Envoyer mon feedback
              </button>

              <p style={{ fontSize: 11, color: '#94A3A0', textAlign: 'center', margin: '14px 0 0' }}>
                Ton feedback est associé à ton compte (utile pour qu'on revienne vers toi). On ne partage rien à l'extérieur.
              </p>
            </>
          )}
        </div>

        {/* Promise card */}
        <div style={{ background: '#FEF3C7', border: '1.5px solid #FBBF24', borderRadius: 16, padding: '18px 22px', marginTop: 24, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Star size={24} fill="#D97706" color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#78350F', marginBottom: 4 }}>Notre promesse pendant la phase de lancement</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#92400E', lineHeight: 1.6 }}>
              <li>Bugs critiques fixés sous 24h</li>
              <li>Idées validées intégrées dans la roadmap publique</li>
              <li>On répond personnellement à chaque message dans les 48h</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
