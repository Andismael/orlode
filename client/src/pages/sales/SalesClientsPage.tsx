/**
 * Sales Clients Page — Premium edition (list + grid views, expandable cards)
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Trash2, ChevronDown, Mail, Phone, Building2, MapPin,
  FileText, Receipt, Star, Filter, List, LayoutGrid,
} from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import SalesHero from './_SalesHero';
import SalesNav from './_SalesNav';

interface Client {
  id: string; name: string; email?: string; phone?: string; address?: string;
  company?: string; industry?: string;
  totalRevenue?: number; quotesCount?: number; invoicesCount?: number;
  tag?: string;
}

const C = {
  greenDeep: '#0A4F3C', greenSoft: '#E8F5EE', cream: '#FFFAF0',
  orange: '#FF6B1A', orangeDeep: '#E5530C', orangeSoft: '#FFE8D6',
  blue: '#3B82F6', blueSoft: '#DBEAFE',
  purple: '#8B5CF6', purpleSoft: '#EDE9FE',
  red: '#FF3D00',
  yellow: '#FFB347',
  ink: '#0A2A20', inkSoft: '#5A6B62',
};

const tagStyles: Record<string, { bg: string; color: string }> = {
  vip: { bg: C.orangeSoft, color: C.orangeDeep },
  active: { bg: C.greenSoft, color: C.greenDeep },
  prospect: { bg: C.purpleSoft, color: C.purple },
  inactive: { bg: '#E8E5DD', color: C.inkSoft },
};

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || 'C';
const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const tagFromClient = (c: Client): string => {
  if ((c.totalRevenue ?? 0) > 100_000_000) return 'vip';
  if ((c.invoicesCount ?? 0) > 0) return 'active';
  if ((c.quotesCount ?? 0) > 0) return 'prospect';
  return 'inactive';
};

const tagLabel = (t: string) => ({ vip: 'VIP', active: 'Actif', prospect: 'Prospect', inactive: 'Inactif' }[t] || t);

export default function SalesClientsPage() {
  const { symbol } = useCurrency();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
    (localStorage.getItem('sales-clients-view') as 'list' | 'grid') ?? 'list');

  useEffect(() => { localStorage.setItem('sales-clients-view', viewMode); }, [viewMode]);

  useEffect(() => {
    api.get('/sales/clients').then(r => {
      const d = r.data as unknown;
      const arr = Array.isArray(d) ? d : (d as { clients?: Client[] })?.clients ?? [];
      setClients(arr as Client[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce client ?')) return;
    await api.delete(`/sales/clients/${id}`).catch(() => {});
    setClients(prev => prev.filter(c => c.id !== id));
  };

  const filtered = search
    ? clients.filter(c => `${c.name} ${c.email ?? ''} ${c.company ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    : clients;

  const vipCount = clients.filter(c => tagFromClient(c) === 'vip').length;
  const palette = [C.orange, C.greenDeep, C.purple, C.blue, C.red];
  const colorOf = (name: string) => palette[name.length % palette.length];

  return (
    <>
      <style>{`
        .cl-root{background:${C.greenDeep};min-height:100vh;font-family:'Inter',-apple-system,sans-serif;padding:32px}
        .cl-display{font-family:'Fraunces',serif}
        .cl-mono{font-family:'JetBrains Mono',monospace}
        .cl-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600}
        .cl-btn-primary{background:${C.orange};color:${C.cream};border:none;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-family:inherit;box-shadow:0 8px 24px -8px rgba(255,107,26,.5)}
        .cl-btn-primary:hover{background:${C.orangeDeep};transform:translateY(-2px)}
        .cl-btn-secondary{background:${C.cream};color:${C.greenDeep};border:1px solid rgba(10,42,32,.1);padding:11px 18px;border-radius:12px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
        .cl-btn-secondary:hover{background:${C.greenDeep};color:${C.cream}}
        .cl-card{background:${C.cream};border-radius:16px;border:1px solid rgba(10,42,32,.06);overflow:hidden;transition:all .25s}
        .cl-card:hover{box-shadow:0 16px 32px -12px rgba(255,107,26,.18)}
        .cl-grid-card{background:${C.cream};border-radius:16px;padding:18px;border:1px solid rgba(10,42,32,.06);transition:all .25s;display:flex;flex-direction:column;gap:12px;cursor:pointer}
        .cl-grid-card:hover{transform:translateY(-3px);border-color:${C.orange};box-shadow:0 16px 32px -12px rgba(255,107,26,.25)}
        .cl-icon-btn{width:36px;height:36px;border-radius:10px;background:${C.greenSoft};color:${C.greenDeep};display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;transition:all .2s}
        .cl-icon-btn:hover{background:${C.orange};color:${C.cream}}
        .cl-icon-btn.danger:hover{background:${C.red};color:${C.cream}}
        .cl-skel{background:rgba(255,250,240,.06);border-radius:16px;height:90px;animation:clP 1.5s infinite}
        @keyframes clP{0%,100%{opacity:.5}50%{opacity:.8}}
        .cl-view-btn{width:36px;height:36px;border-radius:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:transparent;color:${C.inkSoft};transition:all .2s}
        .cl-view-btn.active{background:${C.greenDeep};color:${C.cream}}
        .cl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
        @media(max-width:700px){.cl-root{padding:16px}}
      `}</style>
      <div className="cl-root">
        <SalesHero
          title="Vos clients,"
          italic="votre richesse."
          subtitle={<>{clients.length} client{clients.length > 1 ? 's' : ''} actif{clients.length > 1 ? 's' : ''} · {vipCount} VIP</>}
          pills={
            <span className="cl-pill" style={{ background: C.greenDeep, color: C.cream }}>
              <Star size={11} /> {clients.length} CLIENTS
            </span>
          }
          actions={
            <>
              <button className="cl-btn-secondary"><Filter size={14} /> Filtres</button>
              <button className="cl-btn-primary"><Plus size={16} /> Nouveau client</button>
            </>
          }
        />
        <SalesNav />

        <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, background: C.cream, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(10,42,32,.06)' }}>
            <Search size={16} color={C.inkSoft} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un client par nom, email…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: C.ink, fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'inline-flex', gap: 4, background: C.cream, padding: 4, borderRadius: 12, border: '1px solid rgba(10,42,32,.06)' }}>
            <button className={`cl-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="Liste"><List size={16} /></button>
            <button className={`cl-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grille"><LayoutGrid size={16} /></button>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="cl-skel" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: C.orange, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Star size={28} color={C.cream} />
              </div>
              <h3 className="cl-display" style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{clients.length === 0 ? 'Aucun client' : 'Aucun résultat'}</h3>
              <p style={{ fontSize: 13, color: C.inkSoft }}>{clients.length === 0 ? 'Convertissez un lead en client pour démarrer.' : 'Aucun client ne correspond à votre recherche.'}</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="cl-grid">
              {filtered.map(client => {
                const tag = tagFromClient(client);
                const tagS = tagStyles[tag];
                const avColor = colorOf(client.name);
                return (
                  <div key={client.id} className="cl-grid-card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${avColor} 0%, ${avColor}cc 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream, fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 18, boxShadow: `0 8px 16px -8px ${avColor}`, flexShrink: 0 }}>{initials(client.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cl-display" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4, lineHeight: 1.25, wordBreak: 'break-word' }}>{client.name}</div>
                        <span className="cl-pill" style={{ background: tagS.bg, color: tagS.color }}>{tagLabel(tag)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: C.inkSoft }}>
                      {client.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, wordBreak: 'break-all' }}><Mail size={12} /> {client.email}</span>}
                      {client.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Phone size={12} /> {client.phone}</span>}
                      {client.company && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Building2 size={12} /> {client.company}</span>}
                    </div>
                    <div style={{ paddingTop: 10, borderTop: `1px solid ${C.greenSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="cl-mono" style={{ fontSize: 14, fontWeight: 700, color: C.greenDeep }}>
                        {client.totalRevenue ? `${symbol}${fmt(client.totalRevenue)}` : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>{client.quotesCount || 0} devis · {client.invoicesCount || 0} fact.</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/sales/quotes?client=${client.id}`} className="cl-btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '8px 10px', fontSize: 11 }}><FileText size={12} /> Devis</Link>
                      <Link to={`/sales/invoices?client=${client.id}`} className="cl-btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '8px 10px', fontSize: 11 }}><Receipt size={12} /> Factures</Link>
                      <button className="cl-icon-btn danger" onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(client => {
                const tag = tagFromClient(client);
                const tagS = tagStyles[tag];
                const isExpanded = expanded === client.id;
                const avColor = colorOf(client.name);
                return (
                  <div key={client.id} className="cl-card">
                    <div onClick={() => setExpanded(isExpanded ? null : client.id)} style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', flexWrap: 'wrap' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${avColor} 0%, ${avColor}cc 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream, fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 18, boxShadow: `0 8px 16px -8px ${avColor}`, flexShrink: 0 }}>{initials(client.name)}</div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span className="cl-display" style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{client.name}</span>
                          <span className="cl-pill" style={{ background: tagS.bg, color: tagS.color }}>{tagLabel(tag)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: C.inkSoft, flexWrap: 'wrap' }}>
                          {client.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={12} /> {client.email}</span>}
                          {client.company && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Building2 size={12} /> {client.company}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 2 }}>{client.quotesCount || 0} devis · {client.invoicesCount || 0} factures</div>
                          <div className="cl-mono" style={{ fontSize: 14, fontWeight: 700, color: C.greenDeep }}>
                            {client.totalRevenue ? `${symbol}${fmt(client.totalRevenue)}` : '—'}
                          </div>
                        </div>
                        <ChevronDown size={18} color={C.inkSoft} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${C.greenSoft}`, paddingTop: 18 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
                          {client.phone && (
                            <div>
                              <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Téléphone</div>
                              <div style={{ fontSize: 13, color: C.ink, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Phone size={13} /> {client.phone}</div>
                            </div>
                          )}
                          {client.address && (
                            <div>
                              <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Adresse</div>
                              <div style={{ fontSize: 13, color: C.ink, display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={13} /> {client.address}</div>
                            </div>
                          )}
                          {client.industry && (
                            <div>
                              <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Secteur</div>
                              <div style={{ fontSize: 13, color: C.ink }}>{client.industry}</div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Link to={`/sales/quotes?client=${client.id}`} className="cl-btn-secondary"><FileText size={13} /> {client.quotesCount || 0} devis</Link>
                          <Link to={`/sales/invoices?client=${client.id}`} className="cl-btn-secondary"><Receipt size={13} /> {client.invoicesCount || 0} factures</Link>
                          <button className="cl-btn-secondary"><Mail size={13} /> Envoyer email</button>
                          <button className="cl-icon-btn danger" onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    )}
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
