import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import {
  Cpu, Globe, ShieldCheck, ShieldAlert, Plus, Search, AlertTriangle,
  CheckCircle2, XCircle, Loader2, RefreshCw, Activity, Building2,
  ToggleLeft, ToggleRight, Lock, BarChart3, Inbox
} from 'lucide-react';

const C = {
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  ink: '#0A2A20', inkSoft: '#5A6B62',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  red: '#EF4444', redSoft: '#FEE2E2',
  yellow: '#F59E0B', yellowSoft: '#FEF3C7',
  violet: '#7C3AED', violetSoft: '#EDE9FE',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
};

interface PlatformMCP {
  id: string;
  name: string;
  category: 'shared' | 'tenant' | 'restricted';
  desc: string;
  icon: string;
  color: string;
  status: 'available' | 'beta' | 'deprecated';
  tenantsConnected: number;
  totalTenants: number;
  policy: 'allowed' | 'restricted' | 'forbidden';
}

const PLATFORM_MCP_CATALOG: PlatformMCP[] = [
  // Shared (super admin level)
  { id: 'web-search', name: 'Web Search', category: 'shared', desc: 'Recherche web Brave / Google · Aucune donnée tenant', icon: '🌐', color: '#06B6D4', status: 'available', tenantsConnected: 47, totalTenants: 50, policy: 'allowed' },
  { id: 'wikipedia', name: 'Wikipedia', category: 'shared', desc: 'Encyclopedia · Public · Multi-langue', icon: '📚', color: '#8B5CF6', status: 'available', tenantsConnected: 32, totalTenants: 50, policy: 'allowed' },
  { id: 'fx-rates', name: 'FX Rates', category: 'shared', desc: 'Taux de change · 180 devises', icon: '💱', color: '#F59E0B', status: 'available', tenantsConnected: 28, totalTenants: 50, policy: 'allowed' },
  { id: 'weather', name: 'Weather', category: 'shared', desc: 'Météo OpenWeatherMap · données publiques', icon: '☁️', color: '#0EA5E9', status: 'beta', tenantsConnected: 12, totalTenants: 50, policy: 'allowed' },
  // Tenant (admin level)
  { id: 'gmail', name: 'Gmail', category: 'tenant', desc: 'OAuth par tenant · isolation données', icon: '📧', color: '#EA4335', status: 'available', tenantsConnected: 38, totalTenants: 50, policy: 'allowed' },
  { id: 'gdrive', name: 'Google Drive', category: 'tenant', desc: 'OAuth par tenant', icon: '📁', color: '#4285F4', status: 'available', tenantsConnected: 34, totalTenants: 50, policy: 'allowed' },
  { id: 'gcalendar', name: 'Google Calendar', category: 'tenant', desc: 'OAuth par tenant', icon: '📅', color: '#0F9D58', status: 'available', tenantsConnected: 31, totalTenants: 50, policy: 'allowed' },
  { id: 'slack', name: 'Slack', category: 'tenant', desc: 'OAuth workspace par tenant', icon: '💬', color: '#4A154B', status: 'available', tenantsConnected: 19, totalTenants: 50, policy: 'allowed' },
  { id: 'notion', name: 'Notion', category: 'tenant', desc: 'OAuth workspace par tenant', icon: '📝', color: '#000000', status: 'available', tenantsConnected: 14, totalTenants: 50, policy: 'allowed' },
  { id: 'hubspot', name: 'HubSpot', category: 'tenant', desc: 'CRM par tenant', icon: '🔶', color: '#FF7A59', status: 'available', tenantsConnected: 7, totalTenants: 50, policy: 'allowed' },
  { id: 'jira', name: 'Jira', category: 'tenant', desc: 'OAuth par tenant', icon: '🔵', color: '#0052CC', status: 'beta', tenantsConnected: 4, totalTenants: 50, policy: 'allowed' },
  { id: 'github', name: 'GitHub', category: 'tenant', desc: 'OAuth org par tenant', icon: '⚫', color: '#181717', status: 'available', tenantsConnected: 8, totalTenants: 50, policy: 'allowed' },
  { id: 'stripe', name: 'Stripe', category: 'tenant', desc: 'API keys par tenant', icon: '💳', color: '#635BFF', status: 'available', tenantsConnected: 11, totalTenants: 50, policy: 'restricted' },
  // Restricted
  { id: 'shell-exec', name: 'Shell Execution', category: 'restricted', desc: '⚠️ Exécution commandes shell · risque sécurité', icon: '💻', color: '#EF4444', status: 'available', tenantsConnected: 0, totalTenants: 50, policy: 'forbidden' },
];

function PolicyPill({ policy }: { policy: PlatformMCP['policy'] }) {
  const styles: any = {
    allowed: { bg: C.emeraldSoft, color: C.emeraldDeep, label: 'Autorisé', icon: CheckCircle2 },
    restricted: { bg: C.yellowSoft, color: C.yellow, label: 'Restreint', icon: ShieldAlert },
    forbidden: { bg: C.redSoft, color: C.red, label: 'Interdit', icon: XCircle },
  };
  const s = styles[policy];
  const Ic = s.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      <Ic size={11} /> {s.label}
    </span>
  );
}

function StatusPill({ status }: { status: PlatformMCP['status'] }) {
  if (status === 'beta') {
    return <span style={{ fontSize: 10, padding: '2px 8px', background: C.violetSoft, color: C.violet, borderRadius: 100, fontWeight: 700, letterSpacing: '0.05em' }}>BETA</span>;
  }
  if (status === 'deprecated') {
    return <span style={{ fontSize: 10, padding: '2px 8px', background: C.redSoft, color: C.red, borderRadius: 100, fontWeight: 700 }}>DEPRECATED</span>;
  }
  return null;
}

function CategoryBadge({ category }: { category: PlatformMCP['category'] }) {
  const styles: any = {
    shared: { bg: '#06B6D4', label: 'PARTAGÉ' },
    tenant: { bg: '#7C3AED', label: 'PAR TENANT' },
    restricted: { bg: '#EF4444', label: 'RESTREINT' },
  };
  const s = styles[category];
  return (
    <span style={{ fontSize: 9, padding: '2px 8px', background: s.bg, color: '#fff', borderRadius: 4, fontWeight: 700, letterSpacing: '0.08em' }}>
      {s.label}
    </span>
  );
}

export default function PlatformMCPCatalogPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'shared' | 'tenant' | 'restricted'>('all');
  const [catalog, setCatalog] = useState<PlatformMCP[]>(PLATFORM_MCP_CATALOG);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/superadmin/platform-mcp').catch(() => null);
      if (res?.data?.catalog) {
        setCatalog(res.data.catalog);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const togglePolicy = async (id: string, newPolicy: PlatformMCP['policy']) => {
    try { await api.patch(`/superadmin/platform-mcp/${id}`, { policy: newPolicy }); } catch {}
    setCatalog(c => c.map(m => m.id === id ? { ...m, policy: newPolicy } : m));
  };

  const filtered = catalog.filter(m => {
    if (filter !== 'all' && m.category !== filter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: catalog.length,
    allowed: catalog.filter(m => m.policy === 'allowed').length,
    restricted: catalog.filter(m => m.policy === 'restricted').length,
    forbidden: catalog.filter(m => m.policy === 'forbidden').length,
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1280, margin: '0 auto', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', borderRadius: 20, padding: 24, marginBottom: 20, color: C.cream, position: 'relative', overflow: 'hidden', borderBottom: '3px solid #B45309' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Cpu size={20} color="#B45309" />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#FCD34D' }}>SUPER ADMIN · CATALOGUE PLATEFORME</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: 'Fraunces, serif', letterSpacing: '-0.02em' }}>
              MCP Servers — gouvernance plateforme
            </h1>
            <p style={{ fontSize: 13, marginTop: 6, opacity: 0.85, maxWidth: 640 }}>
              Catalogue des MCP servers disponibles aux 50 tenants. Configure les politiques globales : autorisé, restreint, interdit.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ background: 'rgba(255,250,240,0.1)', border: '1px solid rgba(255,250,240,0.2)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.7, letterSpacing: '0.1em' }}>TOTAL</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Fraunces, serif' }}>{stats.total}</div>
            </div>
            <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.1em' }}>AUTORISÉS</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Fraunces, serif' }}>{stats.allowed}</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#FCA5A5', letterSpacing: '0.1em' }}>BLOQUÉS</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Fraunces, serif' }}>{stats.forbidden}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', gap: 4, background: C.cream, padding: 4, borderRadius: 10, border: '1px solid rgba(10,42,32,0.1)' }}>
          {[
            { id: 'all', label: 'Tous', count: catalog.length },
            { id: 'shared', label: 'Partagés', count: catalog.filter(c => c.category === 'shared').length },
            { id: 'tenant', label: 'Par tenant', count: catalog.filter(c => c.category === 'tenant').length },
            { id: 'restricted', label: 'Restreints', count: catalog.filter(c => c.category === 'restricted').length },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id as any)} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 7, background: filter === f.id ? '#1E293B' : 'transparent', color: filter === f.id ? '#fff' : C.inkSoft, border: 'none', fontFamily: 'inherit' }}>
              {f.label} <span style={{ opacity: 0.7, marginLeft: 4, fontFamily: 'JetBrains Mono, monospace' }}>{f.count}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Rechercher…" style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1.5px solid rgba(10,42,32,0.1)', background: C.cream, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.ink }} />
        </div>
        <button onClick={load} disabled={loading} style={{ padding: '10px 14px', borderRadius: 10, background: C.cream, border: '1.5px solid rgba(10,42,32,0.1)', color: C.ink, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
          {loading ? <Loader2 size={13} /> : <RefreshCw size={13} />}
        </button>
      </div>

      {/* Catalog table */}
      <div style={{ background: C.cream, borderRadius: 14, border: '1px solid rgba(10,42,32,0.08)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.2fr 1.4fr', gap: 12, padding: '12px 18px', background: '#F1F5F9', fontSize: 10, fontWeight: 700, color: '#1E293B', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '2px solid #B45309' }}>
          <div>MCP Server</div>
          <div>Catégorie</div>
          <div>Adoption tenants</div>
          <div>Politique</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>
        {filtered.map(mcp => (
          <div key={mcp.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.2fr 1.4fr', gap: 12, padding: '14px 18px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${mcp.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{mcp.icon}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{mcp.name}</span>
                  <StatusPill status={mcp.status} />
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{mcp.desc}</div>
              </div>
            </div>
            <div><CategoryBadge category={mcp.category} /></div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Building2 size={12} color={C.inkSoft} />
                <span className="mono-font" style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontFamily: 'JetBrains Mono, monospace' }}>
                  {mcp.tenantsConnected} <span style={{ color: C.inkSoft, fontWeight: 500 }}>/ {mcp.totalTenants}</span>
                </span>
              </div>
              <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(mcp.tenantsConnected / mcp.totalTenants) * 100}%`, background: mcp.color, borderRadius: 2 }}></div>
              </div>
            </div>
            <div><PolicyPill policy={mcp.policy} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              {mcp.policy !== 'allowed' && (
                <button onClick={() => togglePolicy(mcp.id, 'allowed')} style={{ padding: '6px 10px', borderRadius: 7, background: C.emeraldSoft, color: C.emeraldDeep, border: `1px solid ${C.emerald}40`, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Autoriser
                </button>
              )}
              {mcp.policy !== 'restricted' && mcp.policy !== 'forbidden' && (
                <button onClick={() => togglePolicy(mcp.id, 'restricted')} style={{ padding: '6px 10px', borderRadius: 7, background: C.yellowSoft, color: C.yellow, border: `1px solid ${C.yellow}40`, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Restreindre
                </button>
              )}
              {mcp.policy !== 'forbidden' && (
                <button onClick={() => togglePolicy(mcp.id, 'forbidden')} style={{ padding: '6px 10px', borderRadius: 7, background: C.redSoft, color: C.red, border: `1px solid ${C.red}40`, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Interdire
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Inbox size={32} color={C.inkSoft} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Aucun résultat</div>
          </div>
        )}
      </div>
    </div>
  );
}
