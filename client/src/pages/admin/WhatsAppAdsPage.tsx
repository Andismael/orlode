/**
 * WhatsApp Ads Performance — track Click-to-WhatsApp ads.
 *
 * Each campaign that drives a WhatsApp conversation is auto-captured from
 * the Meta webhook `referral` payload. This page shows per-campaign perf
 * (conversations · leads · won · revenue) and lets the user enter ad spend
 * to compute CAC + ROAS.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  ArrowLeft, RefreshCw, Megaphone, ExternalLink, TrendingUp, DollarSign,
  Users2, Trophy, MousePointerClick, Edit3,
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  ink: '#0A2A20', inkSoft: '#475467', inkLight: '#94A3A0',
  wa: '#25D366', waDeep: '#128C7E', waSoft: '#DCF8C6',
  meta: '#0866FF', metaSoft: '#DCE7F8',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  red: '#EF4444', redSoft: '#FEE2E2',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  ai: '#F59E0B', aiSoft: '#FEF3C7',
  purple: '#6D28D9', purpleSoft: '#EDE9FE',
};

interface Campaign {
  id: string;
  campaignId: string;
  label?: string;
  headline?: string;
  body?: string;
  sourceUrl?: string;
  imageUrl?: string;
  conversationsStarted?: number;
  leadsCreated?: number;
  wonCount?: number;
  revenueTotal?: number;
  adSpend?: number;
  lastSeenAt?: { _seconds: number };
}

function fmtRel(ts?: { _seconds: number }): string {
  if (!ts?._seconds) return '—';
  const diff = Math.floor(Date.now() / 1000 - ts._seconds);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function WhatsAppAdsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftSpend, setDraftSpend] = useState<string>('');
  const [draftLabel, setDraftLabel] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await api.get('/whatsapp/ads/campaigns');
      const list: Campaign[] = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.data) ? r.data.data : []);
      setCampaigns(list);
    } catch { setCampaigns([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    return campaigns.reduce((acc, c) => ({
      conversations: acc.conversations + (c.conversationsStarted ?? 0),
      leads: acc.leads + (c.leadsCreated ?? 0),
      won: acc.won + (c.wonCount ?? 0),
      revenue: acc.revenue + (c.revenueTotal ?? 0),
      spend: acc.spend + (c.adSpend ?? 0),
    }), { conversations: 0, leads: 0, won: 0, revenue: 0, spend: 0 });
  }, [campaigns]);

  const totalROAS = totals.spend > 0 ? totals.revenue / totals.spend : null;

  const saveEdit = async (id: string) => {
    const update: any = {};
    const sp = parseFloat(draftSpend.replace(',', '.'));
    if (!isNaN(sp) && sp >= 0) update.adSpend = sp;
    if (draftLabel.trim()) update.label = draftLabel.trim();
    if (Object.keys(update).length === 0) { setEditing(null); return; }
    try {
      await api.patch(`/whatsapp/ads/campaigns/${id}`, update);
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...update } : c));
      setEditing(null);
      toast.success('Campagne mise à jour');
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? '');
    }
  };

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link to="/admin/whatsapp" style={{ color: C.cream, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> WhatsApp
        </Link>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Performance <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.metaSoft }}>Click-to-WhatsApp</em>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.7)', margin: '2px 0 0' }}>
            Conversations · leads · ventes · revenus, par campagne ad Meta. Auto-capturé via le webhook.
          </p>
        </div>
        <a href="https://www.facebook.com/business/help/433832301046177" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          <ExternalLink size={12} /> Doc Meta CTW
        </a>
        <button onClick={load} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          <RefreshCw size={13} /> Rafraîchir
        </button>
      </div>

      {/* Global KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Conversations', value: String(totals.conversations), color: C.blue, icon: MousePointerClick },
          { label: 'Leads', value: String(totals.leads), color: C.ai, icon: Users2 },
          { label: 'Convertis', value: String(totals.won), color: C.emeraldDeep, icon: Trophy },
          { label: 'Revenu', value: `${totals.revenue.toLocaleString('fr-FR')}€`, color: C.purple, icon: DollarSign },
          { label: 'ROAS', value: totalROAS != null ? `${totalROAS.toFixed(2)}x` : '—', color: totalROAS && totalROAS >= 2 ? C.emeraldDeep : C.inkSoft, icon: TrendingUp },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} style={{ background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.12)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Icon size={14} color={k.color} />
              </div>
              <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.cream, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,250,240,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 4 }}>{k.label}</div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div style={{ background: C.cream, borderRadius: 14, padding: 40, textAlign: 'center', color: C.inkSoft }}>
          Chargement…
        </div>
      )}
      {!loading && campaigns.length === 0 && (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.12)' }}>
          <Megaphone size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
            Aucune campagne ad détectée
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 14px', maxWidth: 540, marginLeft: 'auto', marginRight: 'auto' }}>
            Lance une pub Facebook ou Instagram avec le bouton <strong>"Envoyer un message"</strong> pointant vers ton WhatsApp Business. Quand un client clique, sa conversation apparaîtra ici avec toutes les métriques (conversations → leads → ventes → revenu) et le calcul ROAS automatique si tu rentres ton coût.
          </p>
          <a href="https://business.facebook.com/adsmanager/manage/campaigns" target="_blank" rel="noopener noreferrer" className="btn-primary">
            <ExternalLink size={14} /> Ouvrir Meta Ads Manager
          </a>
        </div>
      )}

      {!loading && campaigns.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {campaigns.map(c => {
            const isEditing = editing === c.id;
            const conv = c.conversationsStarted ?? 0;
            const leads = c.leadsCreated ?? 0;
            const won = c.wonCount ?? 0;
            const revenue = c.revenueTotal ?? 0;
            const spend = c.adSpend ?? 0;
            const roas = spend > 0 ? revenue / spend : null;
            const cac = won > 0 && spend > 0 ? spend / won : null;
            const convertRate = leads > 0 ? Math.round((won / leads) * 100) : 0;
            const leadRate = conv > 0 ? Math.round((leads / conv) * 100) : 0;
            return (
              <div key={c.id} style={{
                background: C.cream, borderRadius: 14,
                border: `1.5px solid ${C.metaSoft}`,
                borderLeft: `5px solid ${C.meta}`,
                padding: 16,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  {c.imageUrl ? (
                    <div style={{ width: 64, height: 64, borderRadius: 10, background: `url("${c.imageUrl}") center/cover`, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 10, background: `linear-gradient(135deg, ${C.meta}, #1E3A8A)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Megaphone size={28} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                      {c.label || c.headline || `Campagne ${c.campaignId.slice(0, 12)}…`}
                    </div>
                    {c.body && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.body}</div>}
                    <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 11, color: C.inkLight, flexWrap: 'wrap' }}>
                      <span className="mono-font">ID: {c.campaignId}</span>
                      <span>· Vue il y a {fmtRel(c.lastSeenAt)}</span>
                      {c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.meta, textDecoration: 'none', fontWeight: 600 }}>Voir l'ad ↗</a>}
                    </div>
                  </div>
                  <button onClick={() => { setEditing(c.id); setDraftSpend(String(c.adSpend ?? '')); setDraftLabel(c.label ?? ''); }} className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }}>
                    <Edit3 size={11} /> Coût + libellé
                  </button>
                </div>

                {/* Funnel */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
                  <Stat label="💬 Conversations" value={String(conv)} color={C.blue} />
                  <Stat label="👤 Leads" value={`${leads}${conv > 0 ? ` (${leadRate}%)` : ''}`} color={C.ai} />
                  <Stat label="🏆 Convertis" value={`${won}${leads > 0 ? ` (${convertRate}%)` : ''}`} color={C.emeraldDeep} />
                  <Stat label="💰 Revenu" value={`${revenue.toLocaleString('fr-FR')}€`} color={C.purple} />
                  <Stat
                    label={spend > 0 ? '📊 ROAS' : '📊 Coût ad ?'}
                    value={
                      spend > 0
                        ? `${roas?.toFixed(2)}x${cac ? ` · CAC ${cac.toFixed(0)}€` : ''}`
                        : '—'
                    }
                    color={roas && roas >= 2 ? C.emeraldDeep : (roas && roas < 1 ? C.red : C.inkSoft)}
                  />
                </div>

                {isEditing && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Libellé</label>
                      <input value={draftLabel} onChange={e => setDraftLabel(e.target.value)} placeholder="ex: Promo Black Friday — IG"
                        style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, border: '1.5px solid rgba(10,42,32,0.1)', background: C.creamDeep, outline: 'none' }} />
                    </div>
                    <div style={{ width: 140 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Coût ad (€)</label>
                      <input type="number" min={0} step="0.01" value={draftSpend} onChange={e => setDraftSpend(e.target.value)}
                        style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, border: '1.5px solid rgba(10,42,32,0.1)', background: C.creamDeep, outline: 'none' }} />
                    </div>
                    <button onClick={() => setEditing(null)} className="btn-secondary" style={{ padding: '7px 10px', fontSize: 12 }}>Annuler</button>
                    <button onClick={() => saveEdit(c.id)} className="btn-primary" style={{ padding: '7px 12px', fontSize: 12 }}>Enregistrer</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: C.creamDeep, borderRadius: 8, padding: '8px 10px' }}>
      <div className="display-font mono-font" style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
    </div>
  );
}
