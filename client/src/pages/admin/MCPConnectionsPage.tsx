import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import {
  Cpu, CheckCircle2, XCircle, ExternalLink, Search, Trash2, Settings,
  Lock, RefreshCw, Loader2, Inbox
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  ink: '#0A2A20', inkSoft: '#5A6B62',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  red: '#EF4444', redSoft: '#FEE2E2',
  violet: '#7C3AED', violetSoft: '#EDE9FE',
};

const MCP_CATALOG = [
  { id: 'gmail', name: 'Gmail MCP', icon: '📧', color: '#EA4335', desc: 'Lire, envoyer, rechercher tes emails Gmail', usedBy: ['Comms', 'Réception', 'Commercial'] },
  { id: 'gdrive', name: 'Google Drive MCP', icon: '📁', color: '#4285F4', desc: 'Accès aux documents Drive partagés', usedBy: ['Documents', 'HR'] },
  { id: 'gcalendar', name: 'Google Calendar MCP', icon: '📅', color: '#0F9D58', desc: 'Gérer événements et disponibilités', usedBy: ['Réunions', 'Réception'] },
  { id: 'slack', name: 'Slack MCP', icon: '💬', color: '#4A154B', desc: 'Lire messages, envoyer notifs, recherche', usedBy: ['Comms', 'IT'] },
  { id: 'notion', name: 'Notion MCP', icon: '📝', color: '#000000', desc: 'Pages et bases de données Notion', usedBy: ['Documents', 'Knowledge'] },
  { id: 'hubspot', name: 'HubSpot MCP', icon: '🔶', color: '#FF7A59', desc: 'CRM, contacts, deals, pipeline', usedBy: ['Commercial', 'Marketing'] },
  { id: 'jira', name: 'Jira MCP', icon: '🔵', color: '#0052CC', desc: 'Tickets, sprints, projets', usedBy: ['IT', 'Support'] },
  { id: 'github', name: 'GitHub MCP', icon: '⚫', color: '#181717', desc: 'Issues, PRs, code, releases', usedBy: ['IT'] },
  { id: 'stripe', name: 'Stripe MCP', icon: '💳', color: '#635BFF', desc: 'Paiements, abonnements, factures', usedBy: ['Comptabilité'] },
  { id: 'linear', name: 'Linear MCP', icon: '◼️', color: '#5E6AD2', desc: 'Tickets et roadmap produit', usedBy: ['IT'] },
];

function StatusPill({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: C.emeraldSoft, color: C.emeraldDeep }}>
        <CheckCircle2 size={11} /> Connecté
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: C.creamDeep, color: C.inkSoft }}>
      <XCircle size={11} /> Non connecté
    </span>
  );
}

export default function MCPConnectionsPage() {
  const [connections, setConnections] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/connectors').catch(() => null);
      const list = res?.data?.connectors ?? res?.data ?? [];
      const map: Record<string, any> = {};
      (Array.isArray(list) ? list : []).forEach((c: any) => {
        if (c.kind === 'mcp' || c.type?.includes('mcp')) map[c.serviceId || c.id] = c;
      });
      setConnections(map);
      setLastSync(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const connect = async (id: string) => {
    setBusyId(id);
    try { await api.post('/connectors/mcp/connect', { serviceId: id }); await load(); } catch {}
    setBusyId(null);
  };

  const disconnect = async (id: string) => {
    setBusyId(id);
    try { await api.delete(`/connectors/mcp/${id}`); await load(); } catch {}
    setBusyId(null);
  };

  const filtered = MCP_CATALOG.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const connectedCount = MCP_CATALOG.filter(s => connections[s.id]?.connected || connections[s.id]?.status === 'active').length;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1280, margin: '0 auto', minHeight: '100vh' }}>
      <div style={{ background: `linear-gradient(135deg, ${C.violet} 0%, #6D28D9 100%)`, borderRadius: 20, padding: 24, marginBottom: 20, color: C.cream, position: 'relative', overflow: 'hidden' }}>
        <svg style={{ position: 'absolute', right: -30, top: -30, opacity: 0.15 }} width="200" height="200" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="50" cy="50" r="25" stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Cpu size={20} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.9 }}>MCP · MODEL CONTEXT PROTOCOL</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: 'Fraunces, serif', letterSpacing: '-0.02em' }}>
              Servers MCP de votre entreprise
            </h1>
            <p style={{ fontSize: 13, marginTop: 6, opacity: 0.9, maxWidth: 600 }}>
              Standard ouvert pour connecter tes agents IA. Chaque MCP est isolé pour ton entreprise — auth OAuth dédiée, données séparées.
            </p>
          </div>
          <div style={{ background: 'rgba(255,250,240,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,250,240,0.25)', borderRadius: 14, padding: '14px 18px', textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.8 }}>CONNECTÉS</div>
            <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'Fraunces, serif' }}>{connectedCount} <span style={{ fontSize: 16, opacity: 0.7 }}>/ {MCP_CATALOG.length}</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Rechercher un MCP server…" style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1.5px solid rgba(10,42,32,0.1)', background: C.cream, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.ink }} />
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 10, background: C.cream, border: '1.5px solid rgba(10,42,32,0.1)', color: C.ink, fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
          {loading ? <Loader2 size={13} /> : <RefreshCw size={13} />} Actualiser
        </button>
      </div>

      <div style={{ background: C.violetSoft, border: `1px solid ${C.violet}30`, borderRadius: 12, padding: 14, marginBottom: 20, display: 'flex', gap: 12 }}>
        <Lock size={18} color={C.violet} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>
          <strong style={{ color: C.violet }}>Isolation par entreprise.</strong> Chaque MCP que tu connectes est lié à ton compte entreprise. Les données ne sont jamais partagées entre tenants. Les tokens OAuth sont chiffrés dans Secret Manager.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {filtered.map(svc => {
          const conn = connections[svc.id];
          const isConnected = conn?.connected || conn?.status === 'active';
          const isBusy = busyId === svc.id;
          return (
            <div key={svc.id} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.08)', borderTop: `3px solid ${svc.color}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${svc.color}20, ${svc.color}10)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{svc.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: 'Fraunces, serif' }}>{svc.name}</div>
                    <div style={{ marginTop: 2 }}><StatusPill connected={isConnected} /></div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, marginBottom: 12 }}>{svc.desc}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {svc.usedBy.map(a => (
                  <span key={a} style={{ fontSize: 10, padding: '2px 8px', background: C.blueSoft, color: C.blue, borderRadius: 100, fontWeight: 600 }}>{a}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, paddingTop: 12, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
                {isConnected ? (
                  <>
                    <button onClick={() => disconnect(svc.id)} disabled={isBusy} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: C.redSoft, color: C.red, border: `1px solid ${C.red}30`, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {isBusy ? <Loader2 size={12} /> : <Trash2 size={12} />} Déconnecter
                    </button>
                    <button style={{ padding: '8px 12px', borderRadius: 8, background: C.cream, color: C.ink, border: '1px solid rgba(10,42,32,0.1)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Settings size={12} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => connect(svc.id)} disabled={isBusy} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: `linear-gradient(135deg, ${svc.color}, ${svc.color}dd)`, color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: `0 4px 12px -4px ${svc.color}` }}>
                    {isBusy ? <Loader2 size={12} /> : <ExternalLink size={12} />} Connecter
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ background: C.cream, borderRadius: 16, padding: 48, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.15)' }}>
          <Inbox size={32} color={C.inkSoft} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Aucun résultat</div>
        </div>
      )}
    </div>
  );
}
