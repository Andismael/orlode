/**
 * AuditLogsPage — Security audit trail
 */
import { useEffect, useState } from 'react';
import { Search, Loader2, Download, FileText } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useAuthStore } from '@/store/authStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AuditLog {
  id: string; action: string; userId: string; userEmail: string;
  resource: string; details: string; ip: string; timestamp: string;
}

export default function AuditLogsPage() {
  const { t } = useLangStore();
  const { company } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/security/audit?limit=200').then(r => setLogs((r.data ?? []) as AuditLog[])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l =>
    !search || l.action?.toLowerCase().includes(search.toLowerCase()) || l.userEmail?.toLowerCase().includes(search.toLowerCase()) || l.resource?.toLowerCase().includes(search.toLowerCase())
  );

  const exportPDF = async () => {
    const doc = new jsPDF('landscape');
    const c = (company ?? {}) as Record<string, unknown>;
    const cName = (c['name'] as string) ?? 'Mon Entreprise';
    const logoUrl = c['logoUrl'] as string | undefined;
    const address = c['address'] as string | undefined;
    const phone = c['phone'] as string | undefined;
    const emailAddr = c['email'] as string | undefined;
    const taxId = c['taxId'] as string | undefined;

    // Header band
    doc.setFillColor(124, 58, 237); doc.rect(0, 0, 297, 40, 'F');
    let logoLoaded = false;
    if (logoUrl) {
      try {
        const blob = await fetch(logoUrl).then(r => r.blob());
        const b64 = await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob); });
        doc.addImage(b64, 'PNG', 12, 8, 24, 24);
        logoLoaded = true;
      } catch { /* fall through */ }
    }
    if (!logoLoaded) {
      doc.setFillColor(255, 255, 255); doc.circle(24, 20, 12, 'F');
      doc.setTextColor(124, 58, 237); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text(cName.slice(0, 2).toUpperCase(), 24, 22, { align: 'center' });
    }
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(cName, 42, 14);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    if (address) doc.text(address, 42, 24);
    const contact = [phone, emailAddr].filter(Boolean).join('  ·  ');
    if (contact) doc.text(contact, 42, 29);
    doc.setFontSize(9); doc.text('AUDIT LOGS', 285, 12, { align: 'right' });
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(`${filtered.length} entrées`, 285, 20, { align: 'right' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('fr-FR'), 285, 26, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      startY: 48,
      head: [[t('date'), 'Action', t('name'), 'Ressource', 'Détails', 'IP']],
      body: filtered.map(l => [
        l.timestamp ? new Date(l.timestamp).toLocaleString('fr-FR') : '—',
        l.action ?? '—', l.userEmail ?? '—', l.resource ?? '—',
        (l.details ?? '').slice(0, 60), l.ip ?? '—',
      ]),
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    // Footer
    doc.setDrawColor(229, 231, 235); doc.line(12, 200, 285, 200);
    doc.setFontSize(7); doc.setTextColor(156, 163, 175);
    const legal = [cName, address, taxId ? `N° ${taxId}` : null].filter(Boolean).join(' · ');
    doc.text(legal, 12, 206);
    doc.text('Powered by Orlode', 285, 206, { align: 'right' });

    doc.save(`audit-logs-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="p-6 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('audit_logs')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{logs.length} evenements</p>
        </div>
        <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
          <Download size={14} /> Export PDF
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={t('search')} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100"><tr>{[t('date'),'Action',t('name'),'Ressource','IP'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-sm text-gray-400 py-8">{`${t('no_data')}`}</td></tr>}
            {filtered.slice(0, 100).map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-xs text-gray-500">{l.timestamp ? new Date(l.timestamp).toLocaleString('fr-FR') : '—'}</td>
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{l.action}</td>
                <td className="px-4 py-2.5 text-sm text-gray-600">{l.userEmail ?? '—'}</td>
                <td className="px-4 py-2.5 text-sm text-gray-600">{l.resource ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs font-mono text-gray-400">{l.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
