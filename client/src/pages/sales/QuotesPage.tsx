/**
 * QuotesPage — Premium edition (status filter + list/grid views)
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, Download, FileText, Send, CheckCircle2, AlertTriangle, CalendarClock,
  List, LayoutGrid, X,
} from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import SalesHero from './_SalesHero';
import SalesNav from './_SalesNav';

interface Quote {
  id: string; clientName: string; quoteNumber?: string; reference?: string;
  totalTTC?: number; total?: number; status: string; validUntil?: string;
  items?: { description: string; quantity: number; unitPrice: number }[];
}

const C = {
  greenDeep: '#0A4F3C', greenSoft: '#E8F5EE', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  orange: '#FF6B1A', orangeDeep: '#E5530C', orangeSoft: '#FFE8D6',
  yellow: '#FFB347',
  red: '#FF3D00', redSoft: '#FFE0DA',
  blue: '#3B82F6', blueSoft: '#DBEAFE',
  purple: '#8B5CF6',
  ink: '#0A2A20', inkSoft: '#5A6B62',
};

const statusStyle = (s: string): { bg: string; color: string; label: string; icon: typeof FileText } => {
  if (s === 'sent') return { bg: C.blueSoft, color: C.blue, label: 'Envoyé', icon: Send };
  if (s === 'accepted') return { bg: C.greenSoft, color: C.greenDeep, label: 'Accepté', icon: CheckCircle2 };
  if (s === 'rejected') return { bg: C.redSoft, color: C.red, label: 'Refusé', icon: AlertTriangle };
  if (s === 'expired') return { bg: '#E8E5DD', color: C.inkSoft, label: 'Expiré', icon: AlertTriangle };
  return { bg: C.creamDeep, color: '#7A6A3F', label: 'Brouillon', icon: FileText };
};

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const downloadCsv = (rows: Record<string, unknown>[], filename: string) => {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const TABS = [
  { id: 'all', label: 'Tous' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'sent', label: 'Envoyés' },
  { id: 'accepted', label: 'Acceptés' },
  { id: 'rejected', label: 'Refusés' },
];

export default function QuotesPage() {
  const { symbol } = useCurrency();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
    (localStorage.getItem('sales-quotes-view') as 'list' | 'grid') ?? 'list');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const tomorrow30 = new Date(); tomorrow30.setDate(tomorrow30.getDate() + 30);
  const [form, setForm] = useState({
    clientName: '', clientEmail: '',
    description: '', quantity: 1, unitPrice: 0,
    validUntil: tomorrow30.toISOString().slice(0, 10),
    notes: '',
  });

  useEffect(() => { localStorage.setItem('sales-quotes-view', viewMode); }, [viewMode]);

  const handleCreate = async () => {
    if (!form.clientName.trim() || form.unitPrice <= 0) return;
    setSubmitting(true);
    try {
      await api.post('/sales/quotes', {
        clientName: form.clientName.trim(),
        clientEmail: form.clientEmail.trim() || undefined,
        items: [{
          description: form.description.trim() || 'Prestation',
          quantity: form.quantity,
          unitPrice: form.unitPrice,
        }],
        validUntil: form.validUntil,
        notes: form.notes.trim() || undefined,
      });
      setShowCreate(false);
      setForm({
        clientName: '', clientEmail: '',
        description: '', quantity: 1, unitPrice: 0,
        validUntil: tomorrow30.toISOString().slice(0, 10),
        notes: '',
      });
      load();
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  const load = () => {
    setLoading(true);
    api.get('/sales/quotes').then(r => {
      const d = r.data as unknown;
      const arr = Array.isArray(d) ? d : (d as { quotes?: Quote[] })?.quotes ?? [];
      setQuotes(arr as Quote[]);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce devis ?')) return;
    await api.delete(`/sales/quotes/${id}`).catch(() => {});
    setQuotes(prev => prev.filter(q => q.id !== id));
  };

  const handleSend = async (id: string) => {
    const email = prompt('Email du destinataire ?');
    if (!email) return;
    try {
      await api.post(`/sales/quotes/${id}/send`, { recipientEmail: email });
      load();
    } catch {}
  };

  const filtered = tab === 'all' ? quotes : quotes.filter(q => q.status === tab);
  const acceptedCount = quotes.filter(q => q.status === 'accepted').length;

  const palette = [C.purple, C.blue, C.greenDeep, C.orange, C.red, C.yellow];
  const colorOf = (id: string) => palette[(id || '').charCodeAt(0) % palette.length];

  return (
    <>
      <style>{`
        .qp-root{background:${C.greenDeep};min-height:100vh;font-family:'Inter',-apple-system,sans-serif;padding:32px}
        .qp-display{font-family:'Fraunces',serif}
        .qp-mono{font-family:'JetBrains Mono',monospace}
        .qp-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600}
        .qp-btn-primary{background:${C.orange};color:${C.cream};border:none;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-family:inherit;box-shadow:0 8px 24px -8px rgba(255,107,26,.5)}
        .qp-btn-primary:hover{background:${C.orangeDeep};transform:translateY(-2px)}
        .qp-btn-secondary{background:${C.cream};color:${C.greenDeep};border:1px solid rgba(10,42,32,.1);padding:11px 18px;border-radius:12px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
        .qp-btn-secondary:hover{background:${C.greenDeep};color:${C.cream}}
        .qp-row{background:${C.cream};border-radius:16px;padding:18px 20px;border:1px solid rgba(10,42,32,.06);transition:all .2s;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
        .qp-row:hover{transform:translateX(4px);border-color:${C.orange};box-shadow:0 12px 24px -12px rgba(255,107,26,.25)}
        .qp-card{background:${C.cream};border-radius:16px;padding:20px;border:1px solid rgba(10,42,32,.06);transition:all .25s;display:flex;flex-direction:column;gap:14px;min-height:200px}
        .qp-card:hover{transform:translateY(-3px);border-color:${C.orange};box-shadow:0 20px 32px -16px rgba(255,107,26,.3)}
        .qp-icon-btn{width:36px;height:36px;border-radius:10px;background:${C.greenSoft};color:${C.greenDeep};display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;transition:all .2s}
        .qp-icon-btn:hover{background:${C.orange};color:${C.cream}}
        .qp-icon-btn.danger:hover{background:${C.red};color:${C.cream}}
        .qp-skel{background:rgba(255,250,240,.06);border-radius:16px;height:80px;animation:qpP 1.5s infinite}
        @keyframes qpP{0%,100%{opacity:.5}50%{opacity:.8}}
        .qp-tab{padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;border-radius:10px;background:transparent;color:${C.inkSoft};border:none;font-family:inherit;transition:all .2s}
        .qp-tab.active{background:${C.greenDeep};color:${C.cream}}
        .qp-view-btn{width:36px;height:36px;border-radius:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:transparent;color:${C.inkSoft};transition:all .2s}
        .qp-view-btn.active{background:${C.greenDeep};color:${C.cream}}
        .qp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
        @media(max-width:700px){.qp-root{padding:16px}}
      `}</style>
      <div className="qp-root">
        <SalesHero
          title="Devis"
          italic="& propositions."
          subtitle={<>{quotes.length} devis émis · {acceptedCount} accepté{acceptedCount > 1 ? 's' : ''}</>}
          pills={
            <span className="qp-pill" style={{ background: C.greenDeep, color: C.cream }}>
              <FileText size={11} /> {quotes.length} DEVIS · {acceptedCount} ACCEPTÉ{acceptedCount > 1 ? 'S' : ''}
            </span>
          }
          actions={
            <>
              <button className="qp-btn-secondary" onClick={() => downloadCsv(quotes as unknown as Record<string, unknown>[], 'devis.csv')}><Download size={14} /> Export</button>
              <button className="qp-btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Nouveau devis</button>
            </>
          }
        />
        <SalesNav />

        {/* Status filter tabs + view toggle */}
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'inline-flex', gap: 4, background: C.cream, padding: 4, borderRadius: 14, border: '1px solid rgba(10,42,32,.06)' }}>
            {TABS.map(t => (
              <button key={t.id} className={`qp-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label} {t.id === 'all' ? `(${quotes.length})` : `(${quotes.filter(q => q.status === t.id).length})`}
              </button>
            ))}
          </div>
          <div style={{ display: 'inline-flex', gap: 4, background: C.cream, padding: 4, borderRadius: 12, border: '1px solid rgba(10,42,32,.06)' }}>
            <button className={`qp-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="Liste"><List size={16} /></button>
            <button className={`qp-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grille"><LayoutGrid size={16} /></button>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="qp-skel" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: C.orange, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <FileText size={28} color={C.cream} />
              </div>
              <h3 className="qp-display" style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
                {quotes.length === 0 ? 'Aucun devis pour le moment' : 'Aucun devis dans cette catégorie'}
              </h3>
              <p style={{ fontSize: 13, color: C.inkSoft, marginBottom: 24 }}>
                {quotes.length === 0 ? "Créez votre premier devis depuis un lead." : "Changez de filtre pour voir d'autres devis."}
              </p>
              {quotes.length === 0 && (
                <button className="qp-btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> Créer un devis</button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="qp-grid">
              {filtered.map(q => {
                const status = statusStyle(q.status);
                const StatusIcon = status.icon;
                const total = q.totalTTC ?? q.total ?? 0;
                const color = colorOf(q.id);
                return (
                  <div key={q.id} className="qp-card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream, boxShadow: `0 8px 16px -8px ${color}` }}>
                        <FileText size={20} strokeWidth={1.75} />
                      </div>
                      <span className="qp-pill" style={{ background: status.bg, color: status.color }}>
                        <StatusIcon size={11} /> {status.label}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="qp-display" style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 4, lineHeight: 1.25 }}>{q.clientName}</div>
                      {(q.quoteNumber || q.reference) && (
                        <div className="qp-mono" style={{ fontSize: 11, color: C.inkSoft, marginBottom: 8 }}>{q.quoteNumber || q.reference}</div>
                      )}
                      <div className="qp-mono" style={{ fontSize: 18, fontWeight: 700, color: C.greenDeep, marginBottom: 6 }}>
                        {symbol}{fmt(total)}
                      </div>
                      <div style={{ fontSize: 11, color: C.inkSoft, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {q.validUntil && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CalendarClock size={11} /> Valide jusqu'au {q.validUntil}
                          </span>
                        )}
                        <span>{q.items?.length || 0} ligne{(q.items?.length || 0) > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {q.status === 'draft' && (
                        <button className="qp-btn-secondary" style={{ padding: '8px 12px', fontSize: 11 }} onClick={() => handleSend(q.id)}>
                          <Send size={12} /> Envoyer
                        </button>
                      )}
                      <button className="qp-icon-btn" title="Télécharger"><Download size={14} /></button>
                      <button className="qp-icon-btn danger" onClick={() => handleDelete(q.id)} title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(q => {
                const status = statusStyle(q.status);
                const StatusIcon = status.icon;
                const total = q.totalTTC ?? q.total ?? 0;
                const color = colorOf(q.id);
                return (
                  <div key={q.id} className="qp-row">
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream, flexShrink: 0, boxShadow: `0 8px 16px -8px ${color}` }}>
                      <FileText size={22} strokeWidth={1.75} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span className="qp-display" style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{q.clientName}</span>
                        {(q.quoteNumber || q.reference) && (
                          <span className="qp-mono" style={{ fontSize: 11, color: C.inkSoft, background: C.creamDeep, padding: '2px 8px', borderRadius: 6 }}>{q.quoteNumber || q.reference}</span>
                        )}
                        <span className="qp-pill" style={{ background: status.bg, color: status.color }}>
                          <StatusIcon size={11} /> {status.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: C.inkSoft, flexWrap: 'wrap' }}>
                        <span className="qp-mono" style={{ fontWeight: 600, color: C.greenDeep, fontSize: 13 }}>
                          {symbol}{fmt(total)}
                        </span>
                        {q.validUntil && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CalendarClock size={12} /> Valide jusqu'au {q.validUntil}
                          </span>
                        )}
                        <span>· {q.items?.length || 0} ligne{(q.items?.length || 0) > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {q.status === 'draft' && (
                        <button className="qp-btn-secondary" style={{ padding: '9px 14px', fontSize: 12 }} onClick={() => handleSend(q.id)}>
                          <Send size={13} /> Envoyer
                        </button>
                      )}
                      <button className="qp-icon-btn" title="Télécharger" onClick={() => window.open(`/api/sales/quotes/${q.id}/pdf`, '_blank')}><Download size={14} /></button>
                      <button className="qp-icon-btn danger" onClick={() => handleDelete(q.id)} title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Quote Modal */}
        {showCreate && (
          <div onClick={() => setShowCreate(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(10,42,32,.7)', backdropFilter: 'blur(8px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: C.cream, borderRadius: 22, maxWidth: 540, width: '100%',
              padding: 28, maxHeight: '92vh', overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h2 className="qp-display" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>
                  Nouveau devis
                </h2>
                <button onClick={() => setShowCreate(false)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft,
                  width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><X size={18} /></button>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Client</label>
                  <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                    placeholder="Nom du client" autoFocus
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Email (optionnel)</label>
                  <input type="email" value={form.clientEmail} onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))}
                    placeholder="client@email.com"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Description</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Ex: Création site web, formation 5 jours…"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Qté</label>
                    <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', outline: 'none', textAlign: 'center' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Prix unitaire ({symbol})</label>
                    <input type="number" min={0} value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: Math.max(0, parseInt(e.target.value) || 0) }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Total</label>
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: C.greenSoft, fontSize: 13, fontWeight: 800, color: C.greenDeep, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                      {(form.quantity * form.unitPrice).toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Valable jusqu'au</label>
                  <input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Notes (optionnel)</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Conditions de paiement, validité, etc."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                <button className="qp-btn-secondary" onClick={() => setShowCreate(false)}>Annuler</button>
                <button className="qp-btn-primary" onClick={handleCreate} disabled={submitting || !form.clientName.trim() || form.unitPrice <= 0}>
                  {submitting ? '...' : (<><Plus size={15} /> Créer le devis</>)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
