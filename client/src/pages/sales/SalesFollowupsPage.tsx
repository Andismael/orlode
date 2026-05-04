/**
 * Sales Follow-ups — Premium edition (Relances)
 */
import { useEffect, useState } from 'react';
import {
  Plus, Clock, AlertTriangle, Check, RefreshCw, Mail, Phone, MessageCircle, Calendar,
  Bot, X, Sparkles,
} from 'lucide-react';
import api from '@/services/api';
import SalesHero from './_SalesHero';
import SalesNav from './_SalesNav';

interface FollowUp {
  id: string; leadId: string; leadName?: string;
  scheduledAt: string; type: string; notes: string;
  status: string; overdue: boolean; auto?: boolean;
}

interface Lead {
  id: string; name: string; stage?: string; email?: string; phone?: string;
  interactions?: { date?: string; type?: string; summary?: string }[];
  createdAt?: string; updatedAt?: string;
}

const C = {
  greenDeep: '#0A4F3C', greenSoft: '#E8F5EE', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  orange: '#FF6B1A', orangeDeep: '#E5530C', orangeSoft: '#FFE8D6',
  yellow: '#FFB347', yellowSoft: '#FFF4E0',
  red: '#FF3D00', redSoft: '#FFE0DA',
  blue: '#3B82F6', blueSoft: '#DBEAFE',
  purple: '#8B5CF6', purpleSoft: '#EDE9FE',
  ink: '#0A2A20', inkSoft: '#5A6B62',
};

const TYPE_ICONS: Record<string, typeof Mail> = { email: Mail, call: Phone, whatsapp: MessageCircle, meeting: Calendar };
const TYPE_LABELS: Record<string, string> = { email: 'Email', call: 'Appel', whatsapp: 'WhatsApp', meeting: 'Réunion' };
const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  email: { bg: C.blueSoft, color: C.blue },
  call: { bg: C.purpleSoft, color: C.purple },
  whatsapp: { bg: C.greenSoft, color: C.greenDeep },
  meeting: { bg: C.orangeSoft, color: C.orangeDeep },
};

const fmtDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
};

export default function SalesFollowupsPage() {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'overdue' | 'completed'>('pending');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ leadId: '', scheduledAt: '', type: 'email', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/sales/followups').then(r => {
        const d = r.data as unknown;
        const arr = Array.isArray(d) ? d : (d as { followups?: FollowUp[] })?.followups ?? [];
        setFollowups(arr as FollowUp[]);
      }).catch(() => {}),
      api.get('/sales/leads').then(r => {
        const d = r.data as unknown;
        const arr = Array.isArray(d) ? d : (d as { leads?: Lead[] })?.leads ?? [];
        setAllLeads(arr as Lead[]);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.leadId || !form.scheduledAt) return;
    setSubmitting(true);
    try {
      await api.post('/sales/followups', form);
      setShowCreate(false);
      setForm({ leadId: '', scheduledAt: '', type: 'email', notes: '' });
      load();
    } catch {} finally { setSubmitting(false); }
  };

  const handleComplete = async (id: string) => {
    await api.patch(`/sales/followups/${id}`, { status: 'completed' }).catch(() => {});
    load();
  };

  const handleAutoRun = async () => {
    setAutoRunning(true);
    try { await api.post('/sales/followups/auto-run', { daysSinceLastContact: 3 }); load(); }
    catch {} finally { setAutoRunning(false); }
  };

  const handleQuickRelance = async (lead: Lead) => {
    const tomorrow = new Date(Date.now() + 86400000);
    try {
      await api.post('/sales/followups', {
        leadId: lead.id,
        scheduledAt: tomorrow.toISOString(),
        type: 'email',
        notes: `Relance manuelle — ${lead.name}`,
      });
      load();
    } catch {}
  };

  const overdueCount = followups.filter(f => f.overdue && f.status !== 'completed').length;
  const filtered = tab === 'completed'
    ? followups.filter(f => f.status === 'completed')
    : tab === 'overdue'
    ? followups.filter(f => f.overdue && f.status !== 'completed')
    : followups.filter(f => f.status !== 'completed' && !f.overdue);

  // Leads that should be contacted: in active stages, no recent interaction, no pending followup
  const pendingLeadIds = new Set(followups.filter(f => f.status !== 'completed').map(f => f.leadId));
  const ACTIVE_STAGES = ['contacte', 'interesse', 'devis_envoye', 'negociation'];
  const now = Date.now();
  const suggestions = allLeads
    .filter(l => l.stage && ACTIVE_STAGES.includes(l.stage))
    .filter(l => !pendingLeadIds.has(l.id))
    .map(l => {
      const lastInter = (l.interactions ?? []).slice(-1)[0]?.date;
      const lastDate = lastInter ? new Date(lastInter).getTime() : (l.updatedAt ? new Date(l.updatedAt).getTime() : (l.createdAt ? new Date(l.createdAt).getTime() : now));
      const daysSilent = Math.max(0, Math.floor((now - lastDate) / 86400000));
      return { ...l, daysSilent };
    })
    .filter(l => l.daysSilent >= 2)
    .sort((a, b) => b.daysSilent - a.daysSilent)
    .slice(0, 6);

  return (
    <>
      <style>{`
        .fp-root{background:${C.greenDeep};min-height:100vh;font-family:'Inter',-apple-system,sans-serif;padding:32px}
        .fp-display{font-family:'Fraunces',serif}
        .fp-mono{font-family:'JetBrains Mono',monospace}
        .fp-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600}
        .fp-btn-primary{background:${C.orange};color:${C.cream};border:none;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-family:inherit;box-shadow:0 8px 24px -8px rgba(255,107,26,.5)}
        .fp-btn-primary:hover{background:${C.orangeDeep};transform:translateY(-2px)}
        .fp-btn-secondary{background:${C.cream};color:${C.greenDeep};border:1px solid rgba(10,42,32,.1);padding:11px 18px;border-radius:12px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
        .fp-btn-secondary:hover{background:${C.greenDeep};color:${C.cream}}
        .fp-row{background:${C.cream};border-radius:16px;padding:18px 20px;border:1px solid rgba(10,42,32,.06);transition:all .2s;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
        .fp-row:hover{transform:translateX(4px);border-color:${C.orange};box-shadow:0 12px 24px -12px rgba(255,107,26,.25)}
        .fp-row.overdue{border-left:4px solid ${C.red}}
        .fp-icon-btn{width:36px;height:36px;border-radius:10px;background:${C.greenSoft};color:${C.greenDeep};display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;transition:all .2s}
        .fp-icon-btn:hover{background:${C.orange};color:${C.cream}}
        .fp-tab{padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;border-radius:10px;background:transparent;color:${C.inkSoft};border:none;font-family:inherit}
        .fp-tab.active{background:${C.greenDeep};color:${C.cream}}
        .fp-modal-overlay{position:fixed;inset:0;background:rgba(10,42,32,.7);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
        .fp-modal{background:${C.cream};border-radius:24px;width:100%;max-width:520px;max-height:90vh;overflow:auto;box-shadow:0 40px 80px -20px rgba(0,0,0,.5)}
        .fp-input{width:100%;background:${C.cream};border:1.5px solid rgba(10,42,32,.1);border-radius:10px;padding:11px 14px;font-size:14px;color:${C.ink};font-family:inherit;outline:none}
        .fp-input:focus{border-color:${C.orange};box-shadow:0 0 0 3px rgba(255,107,26,.15)}
        .fp-label{display:block;font-size:11px;font-weight:700;color:${C.ink};letter-spacing:.05em;margin-bottom:6px;text-transform:uppercase}
        .fp-skel{background:rgba(255,250,240,.06);border-radius:16px;height:80px;animation:fpP 1.5s infinite}
        @keyframes fpP{0%,100%{opacity:.5}50%{opacity:.8}}
        @media(max-width:700px){.fp-root{padding:16px}}
      `}</style>
      <div className="fp-root">
        <SalesHero
          title="Relances"
          italic="& suivi."
          subtitle={<>{followups.filter(f => f.status !== 'completed').length} relance{followups.filter(f => f.status !== 'completed').length > 1 ? 's' : ''} en attente · {overdueCount} en retard</>}
          pills={
            <>
              {overdueCount > 0 && (
                <span className="fp-pill" style={{ background: C.greenDeep, color: C.cream, border: '1px solid rgba(255,250,240,.2)' }}>
                  <AlertTriangle size={11} /> {overdueCount} EN RETARD
                </span>
              )}
            </>
          }
          actions={
            <>
              <button className="fp-btn-secondary" onClick={handleAutoRun} disabled={autoRunning}>
                <RefreshCw size={14} className={autoRunning ? 'spin' : ''} /> Auto-relancer
              </button>
              <button className="fp-btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Nouvelle relance</button>
            </>
          }
        />
        <SalesNav />

        {/* AI Suggestions: leads needing follow-up */}
        {!loading && suggestions.length > 0 && (
          <div style={{ marginTop: 24, background: `linear-gradient(135deg, ${C.cream}, #FFF6E5)`, borderRadius: 18, padding: 20, border: '1px solid rgba(255,107,26,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDeep})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="fp-display" style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>Leads à relancer</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{suggestions.length} prospect{suggestions.length > 1 ? 's' : ''} silencieux depuis plusieurs jours</div>
              </div>
              <button className="fp-btn-secondary" onClick={handleAutoRun} disabled={autoRunning}>
                <Bot size={13} /> Tout relancer
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {suggestions.map(s => (
                <div key={s.id} style={{ background: C.cream, borderRadius: 12, padding: 14, border: '1px solid rgba(10,42,32,.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="fp-display" style={{ fontSize: 14, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                    <span className="fp-pill" style={{ background: s.daysSilent >= 7 ? C.redSoft : C.yellowSoft, color: s.daysSilent >= 7 ? C.red : '#A87800' }}>
                      <Clock size={11} /> {s.daysSilent}j
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>Étape : {s.stage}</div>
                  <button className="fp-btn-primary" style={{ padding: '8px 12px', fontSize: 12, justifyContent: 'center' }} onClick={() => handleQuickRelance(s)}>
                    <Plus size={12} /> Programmer relance
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, display: 'inline-flex', gap: 4, background: C.cream, padding: 4, borderRadius: 14, border: '1px solid rgba(10,42,32,.06)' }}>
          <button className={`fp-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
            En attente ({followups.filter(f => f.status !== 'completed' && !f.overdue).length})
          </button>
          <button className={`fp-tab ${tab === 'overdue' ? 'active' : ''}`} onClick={() => setTab('overdue')}>
            En retard ({overdueCount})
          </button>
          <button className={`fp-tab ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')}>
            Terminées ({followups.filter(f => f.status === 'completed').length})
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="fp-skel" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: C.orange, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Clock size={28} color={C.cream} />
              </div>
              <h3 className="fp-display" style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Aucune relance dans cette catégorie</h3>
              <p style={{ fontSize: 13, color: C.inkSoft, marginBottom: 18 }}>
                {suggestions.length > 0
                  ? `${suggestions.length} lead${suggestions.length > 1 ? 's' : ''} silencieux ci-dessus — créez une relance en un clic.`
                  : 'Les relances programmées apparaîtront ici.'}
              </p>
              <button className="fp-btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> Nouvelle relance</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(f => {
                const TypeIcon = TYPE_ICONS[f.type] || Mail;
                const typeC = TYPE_COLORS[f.type] || TYPE_COLORS.email;
                return (
                  <div key={f.id} className={`fp-row ${f.overdue && f.status !== 'completed' ? 'overdue' : ''}`}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: typeC.bg, color: typeC.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <TypeIcon size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span className="fp-display" style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{f.leadName || 'Lead inconnu'}</span>
                        <span className="fp-pill" style={{ background: typeC.bg, color: typeC.color }}>
                          <TypeIcon size={11} /> {TYPE_LABELS[f.type] || f.type}
                        </span>
                        {f.auto && <span className="fp-pill" style={{ background: C.purpleSoft, color: C.purple }}><Bot size={11} /> Auto</span>}
                        {f.overdue && f.status !== 'completed' && <span className="fp-pill" style={{ background: C.redSoft, color: C.red }}><AlertTriangle size={11} /> En retard</span>}
                      </div>
                      <div style={{ fontSize: 12, color: C.inkSoft }}>{f.notes || 'Aucune note'}</div>
                    </div>
                    <span className="fp-mono" style={{ fontSize: 11, color: C.inkSoft, whiteSpace: 'nowrap' }}>
                      <Clock size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
                      {fmtDate(f.scheduledAt)}
                    </span>
                    {f.status !== 'completed' && (
                      <button className="fp-icon-btn" onClick={() => handleComplete(f.id)} title="Marquer comme effectué">
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showCreate && (
          <div className="fp-modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="fp-modal" onClick={e => e.stopPropagation()}>
              <div style={{ padding: 28, borderBottom: `1px solid ${C.greenSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 className="fp-display" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>Nouvelle relance</h2>
                <button className="fp-icon-btn" onClick={() => setShowCreate(false)}><X size={16} /></button>
              </div>
              <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="fp-label">Lead *</label>
                  <select className="fp-input" value={form.leadId} onChange={e => setForm({ ...form, leadId: e.target.value })}>
                    <option value="">— Sélectionnez —</option>
                    {allLeads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fp-label">Date prévue *</label>
                  <input type="datetime-local" className="fp-input" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
                </div>
                <div>
                  <label className="fp-label">Type</label>
                  <select className="fp-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fp-label">Notes</label>
                  <textarea className="fp-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
                </div>
              </div>
              <div style={{ padding: '20px 28px', borderTop: `1px solid ${C.greenSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="fp-btn-secondary" onClick={() => setShowCreate(false)}>Annuler</button>
                <button className="fp-btn-primary" onClick={handleCreate} disabled={submitting || !form.leadId || !form.scheduledAt}>
                  {submitting ? '...' : <><Plus size={15} /> Créer</>}
                </button>
              </div>
            </div>
          </div>
        )}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
      </div>
    </>
  );
}
