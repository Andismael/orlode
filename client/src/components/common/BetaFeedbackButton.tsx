/**
 * BetaFeedbackButton — fixed button + modal that lets users send feedback during
 * the launch phase. Posts to /api/beta-feedback. Pass `agentId` or `bundleId`
 * to scope the report; otherwise the feedback is general-marketplace.
 */
import { useState } from 'react';
import { MessageSquarePlus, X, Send, Loader2, CheckCircle2, Bug, Lightbulb, Heart } from 'lucide-react';
import api from '@/services/api';

type FeedbackType = 'bug' | 'feature' | 'praise' | 'other';

interface Props {
  agentId?: string;
  bundleId?: string;
  /** Optional anchor: 'fixed' shows a floating bottom-right button, 'inline' is a normal in-flow button. */
  variant?: 'fixed' | 'inline';
  /** Override label for the trigger button. */
  label?: string;
}

export default function BetaFeedbackButton({ agentId, bundleId, variant = 'fixed', label }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!title.trim() || !description.trim()) return;
    setBusy(true);
    try {
      await api.post('/beta-feedback', {
        agentId, bundleId, type, title, description,
        page: typeof window !== 'undefined' ? window.location.pathname : null,
      });
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        // reset after fade-out
        setTimeout(() => { setDone(false); setTitle(''); setDescription(''); setType('bug'); }, 300);
      }, 1400);
    } catch {
      // Keep modal open on error so user can retry
    } finally {
      setBusy(false);
    }
  };

  const trigger = variant === 'fixed' ? (
    <button
      onClick={() => setOpen(true)}
      style={{
        position: 'fixed', right: 24, bottom: 24, zIndex: 90,
        background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
        color: '#78350F', border: 'none', borderRadius: 999,
        padding: '12px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit',
        boxShadow: '0 12px 30px -8px rgba(245,158,11,0.6), 0 4px 10px rgba(0,0,0,0.1)',
        border: '1.5px solid #FCD34D',
      }}
      title="Donner un feedback sur cette beta">
      <MessageSquarePlus size={16} />
      {label ?? 'Feedback BETA'}
    </button>
  ) : (
    <button
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 text-sm font-semibold">
      <MessageSquarePlus size={14} />
      {label ?? 'Feedback BETA'}
    </button>
  );

  return (
    <>
      {trigger}
      {open && (
        <div onClick={() => !busy && setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,42,32,0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#FFFAF0', borderRadius: 22, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#78350F', background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', display: 'inline-block', padding: '3px 8px', borderRadius: 6, letterSpacing: '0.05em', marginBottom: 8 }}>
                  ⚡ BETA · TON FEEDBACK COMPTE
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0A2A20', margin: 0, letterSpacing: '-0.02em' }}>
                  Aide-nous à améliorer Orlode
                </h3>
                <p style={{ fontSize: 12, color: '#5A6B62', margin: '4px 0 0', lineHeight: 1.5 }}>
                  En phase de lancement, ton retour direct nous aide à corriger en quelques heures. Merci 🙏
                </p>
              </div>
              <button onClick={() => !busy && setOpen(false)} disabled={busy}
                style={{ background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', color: '#94A3A0', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {done ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 16, fontWeight: 700, color: '#0A2A20', margin: 0 }}>Merci pour ton feedback !</p>
                <p style={{ fontSize: 12, color: '#5A6B62', margin: '4px 0 0' }}>On regarde ça tout de suite.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                  {([
                    { v: 'bug',     icon: Bug,       label: 'Bug',      color: '#EF4444', bg: '#FEE2E2' },
                    { v: 'feature', icon: Lightbulb, label: 'Idée',     color: '#7C3AED', bg: '#EDE9FE' },
                    { v: 'praise',  icon: Heart,     label: 'J\'adore', color: '#EC4899', bg: '#FCE7F3' },
                    { v: 'other',   icon: MessageSquarePlus, label: 'Autre', color: '#5A6B62', bg: '#F5EDD6' },
                  ] as const).map(o => {
                    const Icon = o.icon;
                    const active = type === o.v;
                    return (
                      <button key={o.v} onClick={() => setType(o.v)}
                        style={{ background: active ? o.bg : '#F5EDD6', color: active ? o.color : '#5A6B62', border: `1.5px solid ${active ? o.color : 'transparent'}`, borderRadius: 12, padding: '10px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <Icon size={16} />
                        {o.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#5A6B62', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Titre court</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120}
                    placeholder="Ex: Le devis ne s'envoie pas par email"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(10,42,32,0.1)', background: '#F5EDD6', fontSize: 13, color: '#0A2A20', fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#5A6B62', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Détails</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={4}
                    placeholder="Ce qui s'est passé, ce que tu attendais, étapes pour reproduire..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(10,42,32,0.1)', background: '#F5EDD6', fontSize: 13, color: '#0A2A20', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
                  />
                </div>

                <button onClick={submit} disabled={busy || !title.trim() || !description.trim()}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: busy || !title.trim() || !description.trim() ? '#D4D4D4' : 'linear-gradient(135deg, #F59E0B, #FBBF24)', color: '#78350F', border: 'none', fontWeight: 800, fontSize: 14, cursor: busy || !title.trim() || !description.trim() ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Envoyer le feedback
                </button>

                {(agentId || bundleId) && (
                  <p style={{ fontSize: 10, color: '#94A3A0', margin: '10px 0 0', textAlign: 'center' }}>
                    Contexte : {agentId ? `agent ${agentId}` : `pack ${bundleId}`}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
