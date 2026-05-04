import { useEffect, useState } from 'react';
import { Loader2, Activity, CheckCircle, AlertTriangle, Server, Database, Cpu, Mail, Send } from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';

interface HealthData {
  status: string;
  uptime: number;
  memory: { heapUsed: number; heapTotal: number; rss: number };
  firestore: { ok: boolean; latencyMs: number };
  node: string;
  env: string;
  timestamp: string;
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/superadmin/health').then(r => setHealth(r.data as HealthData)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

  if (loading && !health) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}j ${h}h ${m}m`;
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Activity size={22} className="text-green-500" /> Systeme</h1>
        <button onClick={load} className="text-sm text-violet-600 hover:text-violet-700">Rafraichir</button>
      </div>

      {/* Email test panel */}
      <EmailTestPanel />

      {health && (
        <>
          {/* Global status */}
          <div className={`p-5 rounded-xl flex items-center gap-3 ${health.status === 'healthy' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            {health.status === 'healthy' ? <CheckCircle size={24} className="text-green-600" /> : <AlertTriangle size={24} className="text-yellow-600" />}
            <div>
              <p className="font-bold text-gray-900">{health.status === 'healthy' ? 'Systeme operationnel' : 'Systeme degrade'}</p>
              <p className="text-sm text-gray-500">Uptime: {formatUptime(health.uptime)} · {health.timestamp}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card icon={<Server size={18} className="text-blue-500" />} label="Environnement" value={health.env ?? 'production'} />
            <Card icon={<Activity size={18} className="text-green-500" />} label="Node.js" value={health.node} />
            <Card icon={<Database size={18} className="text-violet-500" />} label="Firestore"
              value={health.firestore.ok ? `OK (${health.firestore.latencyMs}ms)` : 'Erreur'}
              color={health.firestore.ok ? 'text-green-600' : 'text-red-600'} />
            <Card icon={<Cpu size={18} className="text-amber-500" />} label="Uptime" value={formatUptime(health.uptime)} />
          </div>

          {/* Memory */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Memoire</h2>
            <div className="space-y-3">
              <MemBar label="Heap Used" used={health.memory.heapUsed} total={health.memory.heapTotal} />
              <MemBar label="RSS" used={health.memory.rss} total={Math.max(health.memory.rss, 512)} />
            </div>
          </div>

          {/* Services */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Services</h2>
            <div className="space-y-2">
              <ServiceRow name="API Server" status="running" detail="Cloud Run" />
              <ServiceRow name="Firestore" status={health.firestore.ok ? 'running' : 'error'} detail={`Latence: ${health.firestore.latencyMs}ms`} />
              <ServiceRow name="Firebase Auth" status="running" detail="Firebase" />
              <ServiceRow name="Firebase Hosting" status="running" detail="CDN Global" />
              <ServiceRow name="Gemini AI" status="running" detail="Genkit + Flash" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmailTestPanel() {
  const [to, setTo] = useState('hello@orlode.com');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const send = async () => {
    if (!to.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const r = await api.post('/superadmin/test-email', { to: to.trim() });
      // axios interceptor unwraps { success, data } → r.data is already the data object
      const raw = r.data as Record<string, unknown>;
      const payload = (raw?.['data'] as Record<string, unknown>) ?? raw;
      const messageId = (payload?.['messageId'] as string) ?? '';
      const provider = (payload?.['provider'] as string) ?? 'resend';
      const from = (payload?.['from'] as string) ?? 'noreply@orlode.com';
      setResult({ ok: true, msg: `Envoyé via ${provider} depuis ${from}${messageId ? ` — ID: ${messageId.slice(0, 16)}…` : ''}` });
      toast.success('Email envoyé', `Vérifie la boîte ${to}`);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(err);
      setResult({ ok: false, msg });
      toast.error('Envoi échoué', msg);
    } finally { setSending(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
        <Mail size={16} className="text-blue-500" /> Test d'envoi email (Resend)
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Envoie un email test depuis <code className="bg-gray-100 px-1 rounded">noreply@orlode.com</code> pour vérifier DKIM/SPF/DMARC.
      </p>
      <div className="flex gap-2">
        <input type="email" value={to} onChange={e => setTo(e.target.value)}
          placeholder="destinataire@example.com"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={send} disabled={sending || !to.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Envoyer test
        </button>
      </div>
      {result && (
        <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${result.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {result.ok ? '✅ ' : '❌ '}{result.msg}
        </div>
      )}
    </div>
  );
}

function Card({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="mb-2">{icon}</div>
      <p className={`text-lg font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function MemBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.round((used / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{used} MB / {total} MB ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ServiceRow({ name, status, detail }: { name: string; status: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
      <p className="text-sm font-medium text-gray-900 flex-1">{name}</p>
      <p className="text-xs text-gray-400">{detail}</p>
    </div>
  );
}
