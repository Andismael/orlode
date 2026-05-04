/**
 * VulnerabilitiesPage — CVE tracking, scan, severity breakdown, remediation
 */
import { useEffect, useState } from 'react';
import { Bug, Loader2, Search, Shield, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '@/services/api';

interface Vuln { id: string; cve: string; severity: string; asset: string; description: string; remediation: string; status: string; detectedAt: string }
interface VulnStats { total: number; open: number; fixed: number; critical: number; high: number; medium: number; low: number }

const SEV: Record<string, string> = { critical: 'bg-red-600 text-white', high: 'bg-orange-500 text-white', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-blue-100 text-blue-700' };

export default function VulnerabilitiesPage() {
  const [vulns, setVulns] = useState<Vuln[]>([]);
  const [stats, setStats] = useState<VulnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/security/vulnerabilities').then(r => setVulns((r.data as { data?: Vuln[] })?.data ?? [])),
      api.get('/security/vulnerabilities/stats').then(r => setStats((r.data as { data?: VulnStats })?.data ?? null)),
    ]).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const runScan = async () => {
    setScanning(true);
    await api.post('/security/vulnerabilities/scan', { scanType: 'quick' }).catch(() => {});
    setScanning(false); load();
  };

  const fixVuln = async (id: string) => {
    await api.patch(`/security/vulnerabilities/${id}`, { status: 'fixed' }).catch(() => {});
    setVulns(p => p.map(v => v.id === id ? { ...v, status: 'fixed' } : v));
  };

  const s = stats ?? { total: 0, open: 0, fixed: 0, critical: 0, high: 0, medium: 0, low: 0 };
  const filtered = vulns.filter(v => {
    const matchSearch = !search || v.cve.toLowerCase().includes(search.toLowerCase()) || v.asset.toLowerCase().includes(search.toLowerCase()) || v.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || v.severity === filter || (filter === 'open' && v.status === 'open') || (filter === 'fixed' && v.status === 'fixed');
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Vulnerabilites</h1><p className="text-sm text-gray-500">Scan, CVE tracking, remediation</p></div>
        <button onClick={runScan} disabled={scanning} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}>
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} {scanning ? 'Scan en cours...' : 'Lancer un scan'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: s.total, color: 'text-gray-700 bg-gray-50' },
          { label: 'Ouvertes', value: s.open, color: s.open > 0 ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50' },
          { label: 'Corrigees', value: s.fixed, color: 'text-green-700 bg-green-50' },
          { label: 'Critiques', value: s.critical, color: s.critical > 0 ? 'text-red-700 bg-red-50' : 'text-gray-600 bg-gray-50' },
          { label: 'Hautes', value: s.high, color: s.high > 0 ? 'text-orange-700 bg-orange-50' : 'text-gray-600 bg-gray-50' },
          { label: 'Moyennes', value: s.medium, color: 'text-yellow-700 bg-yellow-50' },
          { label: 'Basses', value: s.low, color: 'text-blue-700 bg-blue-50' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl px-3 py-2.5 ${k.color}`}>
            <p className="text-lg font-bold">{k.value}</p>
            <p className="text-xs opacity-75">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="Rechercher CVE, asset..." />
        </div>
        {['all', 'open', 'fixed', 'critical', 'high', 'medium', 'low'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${filter === f ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f === 'all' ? 'Tous' : f}</button>
        ))}
      </div>

      {/* Vuln list */}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        <div className="space-y-2">
          {filtered.length === 0 ? <div className="text-center py-12 text-sm text-gray-400">Aucune vulnerabilite.</div> : filtered.map(v => (
            <div key={v.id} className={`bg-white rounded-xl border shadow-sm p-4 ${v.status === 'fixed' ? 'border-green-100 opacity-70' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${SEV[v.severity] ?? 'bg-gray-100 text-gray-600'}`}>{v.severity}</span>
                <span className="text-sm font-mono font-bold text-gray-900">{v.cve}</span>
                <span className="text-xs text-gray-400 ml-auto">{v.asset}</span>
                {v.status === 'fixed' && <CheckCircle size={14} className="text-green-500" />}
              </div>
              <p className="text-sm text-gray-700">{v.description}</p>
              <div className="flex items-start justify-between mt-3 pt-2 border-t border-gray-50">
                <div className="flex items-start gap-2"><Shield size={12} className="text-blue-500 mt-0.5 shrink-0" /><span className="text-xs text-blue-700">{v.remediation}</span></div>
                {v.status === 'open' && (
                  <button onClick={() => fixVuln(v.id)} className="text-xs px-3 py-1 border border-green-200 text-green-600 rounded-lg hover:bg-green-50 shrink-0 ml-3">Marquer corrige</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
