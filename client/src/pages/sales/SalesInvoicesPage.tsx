/**
 * Sales Invoices — Factures (placeholder, wires to /accounting/invoices when needed)
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Filter, Download, Receipt, Send, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from '@/components/common/Toast';
import SalesHero from './_SalesHero';
import SalesNav from './_SalesNav';

interface Invoice {
  id: string; number: string; client?: string; clientName?: string;
  totalTTC?: number; status: string; dueDate?: string; createdAt?: string | { toDate?: () => Date };
}

const C = {
  greenDeep: '#0A4F3C', greenSoft: '#E8F5EE', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  orange: '#FF6B1A', orangeDeep: '#E5530C', orangeSoft: '#FFE8D6',
  red: '#FF3D00', redSoft: '#FFE0DA',
  blue: '#3B82F6', blueSoft: '#DBEAFE',
  ink: '#0A2A20', inkSoft: '#5A6B62',
};

const statusStyle = (s: string): { bg: string; color: string; label: string } => {
  if (s === 'paid' || s === 'payée') return { bg: C.greenSoft, color: C.greenDeep, label: 'Payée' };
  if (s === 'sent' || s === 'envoyée') return { bg: C.blueSoft, color: C.blue, label: 'Envoyée' };
  if (s === 'overdue' || s === 'en_retard') return { bg: C.redSoft, color: C.red, label: 'En retard' };
  return { bg: C.creamDeep, color: '#7A6A3F', label: 'Brouillon' };
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

export default function SalesInvoicesPage() {
  const { symbol } = useCurrency();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/accounting/invoices').then(r => {
      const d = r.data as unknown;
      const arr = Array.isArray(d) ? d : (d as { invoices?: Invoice[] })?.invoices ?? [];
      setInvoices(arr as Invoice[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleRemind = async (id: string) => {
    try {
      await api.post(`/sales/invoices/${id}/remind`);
      toast.success('Relance envoyée');
    } catch (e) {
      toast.error('Erreur', (e as Error)?.message || 'Impossible d\'envoyer la relance');
    }
  };

  const totalAmount = invoices.reduce((s, i) => s + (i.totalTTC || 0), 0);
  const paidCount = invoices.filter(i => i.status === 'paid' || i.status === 'payée').length;

  return (
    <>
      <style>{`
        .siv-root{background:${C.greenDeep};min-height:100vh;font-family:'Inter',-apple-system,sans-serif;padding:32px}
        .siv-mono{font-family:'JetBrains Mono',monospace}
        .siv-display{font-family:'Fraunces',serif}
        .siv-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600}
        .siv-btn-primary{background:${C.orange};color:${C.cream};border:none;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-family:inherit;box-shadow:0 8px 24px -8px rgba(255,107,26,.5)}
        .siv-btn-primary:hover{background:${C.orangeDeep};transform:translateY(-2px)}
        .siv-btn-secondary{background:${C.cream};color:${C.greenDeep};border:1px solid rgba(10,42,32,.1);padding:11px 18px;border-radius:12px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
        .siv-btn-secondary:hover{background:${C.greenDeep};color:${C.cream}}
        .siv-row{background:${C.cream};border-radius:16px;padding:18px 20px;border:1px solid rgba(10,42,32,.06);transition:all .2s;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
        .siv-row:hover{transform:translateX(4px);border-color:${C.orange};box-shadow:0 12px 24px -12px rgba(255,107,26,.25)}
        .siv-icon-btn{width:36px;height:36px;border-radius:10px;background:${C.greenSoft};color:${C.greenDeep};display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;transition:all .2s}
        .siv-icon-btn:hover{background:${C.orange};color:${C.cream}}
        .siv-skel{background:rgba(255,250,240,.06);border-radius:16px;height:80px;animation:sivP 1.5s infinite}
        @keyframes sivP{0%,100%{opacity:.5}50%{opacity:.8}}
        @media(max-width:700px){.siv-root{padding:16px}}
      `}</style>
      <div className="siv-root">
        <SalesHero
          title="Factures"
          italic="& encaissements."
          subtitle={<>{invoices.length} facture{invoices.length > 1 ? 's' : ''} émise{invoices.length > 1 ? 's' : ''} · {paidCount} payée{paidCount > 1 ? 's' : ''} · Total <span className="siv-mono">{symbol}{fmt(totalAmount)}</span></>}
          pills={
            <span className="siv-pill" style={{ background: C.greenDeep, color: C.cream }}>
              <Receipt size={11} /> {invoices.length} FACTURES
            </span>
          }
          actions={
            <>
              <button className="siv-btn-secondary" onClick={() => downloadCsv(invoices as unknown as Record<string, unknown>[], 'factures.csv')}><Download size={14} /> Export</button>
              <Link to="/finance/invoices?new=1" className="siv-btn-primary"><Plus size={16} /> Nouvelle facture</Link>
            </>
          }
        />
        <SalesNav />

        <div style={{ marginTop: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="siv-skel" />)}
            </div>
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: C.orange, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Receipt size={28} color={C.cream} />
              </div>
              <h3 className="siv-display" style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Aucune facture pour le moment</h3>
              <p style={{ fontSize: 13, color: C.inkSoft, marginBottom: 24 }}>Convertissez un devis accepté en facture pour activer la facturation.</p>
              <Link to="/sales/quotes" className="siv-btn-primary"><FileText size={15} /> Voir les devis</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {invoices.map(inv => {
                const status = statusStyle(inv.status);
                const StatusIcon = status.label === 'Payée' ? CheckCircle2 : status.label === 'En retard' ? AlertTriangle : Send;
                return (
                  <div key={inv.id} className="siv-row">
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDeep})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream, flexShrink: 0 }}>
                      <Receipt size={22} strokeWidth={1.75} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span className="siv-display" style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{inv.client || inv.clientName || '—'}</span>
                        <span className="siv-mono" style={{ fontSize: 11, color: C.inkSoft, background: C.creamDeep, padding: '2px 8px', borderRadius: 6 }}>{inv.number}</span>
                        <span className="siv-pill" style={{ background: status.bg, color: status.color }}>
                          <StatusIcon size={11} /> {status.label}
                        </span>
                      </div>
                      <div className="siv-mono" style={{ fontSize: 13, fontWeight: 600, color: C.greenDeep }}>
                        {symbol}{fmt(inv.totalTTC || 0)}
                      </div>
                    </div>
                    <button className="siv-btn-secondary" style={{ padding: '9px 14px', fontSize: 12 }} onClick={() => handleRemind(inv.id)}>
                      <Send size={13} /> Relancer
                    </button>
                    <button className="siv-icon-btn" onClick={() => window.open(`/api/sales/invoices/${inv.id}/pdf`, '_blank')} title="Télécharger PDF"><Download size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
