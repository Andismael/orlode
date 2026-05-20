/**
 * Pack Entreprise — hub d'orchestration (jumeau de PMEHubPage avec mix différent).
 *
 * Pack Entreprise = bundle de 4 agents : Sales, Comptabilité, Support, Communications.
 * Différence avec Pack PME : Compta au lieu de Marketing.
 *
 * Pitch : "Pilote ton entreprise — ventes, factures, support, comms."
 */
import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import {
  Briefcase, Mail, DollarSign, LifeBuoy, ArrowRight, Loader2,
  TrendingUp, Sparkles, MessageCircle, FileText,
} from 'lucide-react';

const C = {
  cyan:        '#06B6D4',
  cyanDeep:    '#0E7490',
  cyanSoft:    '#CFFAFE',
  cyanLight:   '#67E8F9',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  // Module accents
  blue:        '#0EA5E9',
  blueSoft:    '#E0F2FE',
  green:       '#10B981',
  greenSoft:   '#D1FAE5',
  greenDeep:   '#059669',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  purple:      '#7C3AED',
  purpleSoft:  '#EDE9FE',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font    { font-family: 'JetBrains Mono', monospace; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
`;

interface ModuleStats {
  sales:      { leads: number; pipeline: number; clients: number };
  accounting: { invoices: number; pending: number; overdue: number };
  support:    { open: number; total: number };
  comms:      { conversations: number };
}

export default function EnterpriseHubPage() {
  const [stats, setStats] = useState<ModuleStats>({
    sales:      { leads: 0, pipeline: 0, clients: 0 },
    accounting: { invoices: 0, pending: 0, overdue: 0 },
    support:    { open: 0, total: 0 },
    comms:      { conversations: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/sales/leads').then((r: any) => r?.data?.leads ?? r?.data ?? []).catch(() => []),
      api.get('/sales/clients').then((r: any) => r?.data?.clients ?? r?.data ?? []).catch(() => []),
      api.get('/sales/deals').then((r: any) => r?.data?.deals ?? r?.data ?? []).catch(() => []),
      api.get('/accounting/invoices').then((r: any) => r?.data?.invoices ?? r?.data ?? []).catch(() => []),
      api.get('/support/tickets').then((r: any) => r?.data?.tickets ?? r?.data ?? []).catch(() => []),
      api.get('/chat/conversations', { params: { limit: 200 } }).then((r: any) => r?.data?.conversations ?? r?.data ?? []).catch(() => []),
    ]).then(([leads, clients, deals, invoices, tickets, convos]: any[]) => {
      const invList = Array.isArray(invoices) ? invoices : [];
      const today = new Date();
      setStats({
        sales: {
          leads: Array.isArray(leads) ? leads.length : 0,
          pipeline: Array.isArray(deals) ? deals.length : 0,
          clients: Array.isArray(clients) ? clients.length : 0,
        },
        accounting: {
          invoices: invList.length,
          pending: invList.filter((i: any) => i?.status === 'pending' || i?.status === 'sent').length,
          overdue: invList.filter((i: any) => {
            if (i?.status === 'paid') return false;
            const due = i?.dueDate ? new Date(i.dueDate) : null;
            return due && !isNaN(due.getTime()) && due < today;
          }).length,
        },
        support: {
          open: Array.isArray(tickets) ? tickets.filter((t: any) => t?.status !== 'resolved' && t?.status !== 'closed').length : 0,
          total: Array.isArray(tickets) ? tickets.length : 0,
        },
        comms: {
          conversations: Array.isArray(convos) ? convos.length : 0,
        },
      });
    }).finally(() => setLoading(false));
  }, []);

  const totalActions = stats.sales.leads + stats.accounting.overdue + stats.support.open;

  return (
    <div style={{ minHeight: '100vh', background: C.creamDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.cyanDeep} 100%)`,
        padding: '32px 32px 28px', color: C.cream, position: 'relative', overflow: 'hidden',
      }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60"  stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 100,
            background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            🏢 ENTREPRISE · WORKSPACE
          </div>
          <h1 className="display-font" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
            Centre Entreprise
          </h1>
          <p style={{ marginTop: 10, fontSize: 13, opacity: 0.92, maxWidth: 640 }}>
            Pilote ton entreprise : ventes · factures · support · communications.
          </p>

          <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Kpi label="Leads actifs"        value={`${stats.sales.leads}`}              icon={Briefcase} />
            <Kpi label="Factures en attente" value={`${stats.accounting.pending}`}       icon={FileText} />
            <Kpi label="Tickets ouverts"     value={`${stats.support.open}`}             icon={LifeBuoy} />
            <Kpi label="Conversations"       value={`${stats.comms.conversations}`}      icon={MessageCircle} />
          </div>
        </div>
      </div>

      {/* Modules grid */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              Tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>4 modules</em>
            </h2>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
              Cliquez sur un module pour ouvrir sa page dédiée.
            </p>
          </div>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkSoft }}>
              <Loader2 size={14} className="spin" /> Chargement…
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <ModuleCard
            icon={Briefcase} color={C.blue} bg={C.blueSoft} href="/sales"
            title="Sales · CRM"
            desc="Pipeline, leads, deals, clients."
            stats={[
              { label: 'Leads',    value: stats.sales.leads },
              { label: 'Pipeline', value: stats.sales.pipeline },
              { label: 'Clients',  value: stats.sales.clients },
            ]}
          />
          <ModuleCard
            icon={DollarSign} color={C.greenDeep} bg={C.greenSoft} href="/finance"
            title="Comptabilité"
            desc="Factures, paiements, relances."
            stats={[
              { label: 'Total',     value: stats.accounting.invoices },
              { label: 'En attente', value: stats.accounting.pending },
              { label: 'Retard',    value: stats.accounting.overdue },
            ]}
          />
          <ModuleCard
            icon={LifeBuoy} color={C.yellow} bg={C.yellowSoft} href="/support"
            title="Support client"
            desc="Tickets, NPS, base de connaissance."
            stats={[
              { label: 'Ouverts', value: stats.support.open },
              { label: 'Total',   value: stats.support.total },
            ]}
          />
          <ModuleCard
            icon={Mail} color={C.purple} bg={C.purpleSoft} href="/comms"
            title="Communications"
            desc="Email · WhatsApp · Telegram multicanal."
            stats={[
              { label: 'Conversations', value: stats.comms.conversations },
            ]}
          />
        </div>
      </div>

      {/* Today's focus */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 32px 64px' }}>
        <div style={{
          background: C.cream, borderRadius: 18, padding: 22,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: C.cyanSoft, color: C.cyanDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Focus du jour
              </h3>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '2px 0 0' }}>
                {totalActions === 0
                  ? 'Tout est sous contrôle. Bonne journée 🌟'
                  : `${totalActions} action${totalActions > 1 ? 's' : ''} qui demandent ton attention.`}
              </p>
            </div>
          </div>

          {totalActions > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.accounting.overdue > 0 && (
                <FocusItem icon={FileText} color={C.greenDeep} bg={C.greenSoft}
                  text={`${stats.accounting.overdue} facture${stats.accounting.overdue > 1 ? 's' : ''} en retard à relancer`}
                  href="/finance" priority="high" />
              )}
              {stats.sales.leads > 0 && (
                <FocusItem icon={Briefcase} color={C.blue} bg={C.blueSoft}
                  text={`${stats.sales.leads} lead${stats.sales.leads > 1 ? 's' : ''} à qualifier`}
                  href="/sales" />
              )}
              {stats.support.open > 0 && (
                <FocusItem icon={LifeBuoy} color={C.yellow} bg={C.yellowSoft}
                  text={`${stats.support.open} ticket${stats.support.open > 1 ? 's' : ''} ouvert${stats.support.open > 1 ? 's' : ''}`}
                  href="/support" />
              )}
            </div>
          ) : (
            <div style={{
              padding: 24, textAlign: 'center', color: C.inkSoft, fontSize: 13,
              background: C.creamDeep, borderRadius: 12,
            }}>
              <TrendingUp size={28} color={C.cyanDeep} style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 600, color: C.ink, marginBottom: 4 }}>Tu es à jour</div>
              <div style={{ fontSize: 12 }}>Bon moment pour travailler sur la stratégie ou pousser une nouvelle initiative.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div style={{ background: 'rgba(255,250,240,0.14)', backdropFilter: 'blur(10px)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,250,240,0.20)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} style={{ opacity: 0.85 }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div className="display-font" style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function ModuleCard({ icon: Icon, color, bg, href, title, desc, stats }: {
  icon: any; color: string; bg: string; href: string;
  title: string; desc: string;
  stats: Array<{ label: string; value: number }>;
}) {
  return (
    <a href={href} style={{
      display: 'block', textDecoration: 'none', color: 'inherit',
      background: C.cream, borderRadius: 16, padding: 22,
      border: '1px solid rgba(10,42,32,0.06)',
      transition: 'transform .2s ease, box-shadow .2s ease',
    }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${color}40`; e.currentTarget.style.borderColor = color; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: bg, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 18px -8px ${color}50`,
        }}>
          <Icon size={22} />
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: C.creamDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.inkSoft,
        }}>
          <ArrowRight size={14} />
        </div>
      </div>
      <h3 className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 14px', lineHeight: 1.5 }}>
        {desc}
      </p>
      <div style={{ display: 'flex', gap: 18, paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
        {stats.map(s => (
          <div key={s.label}>
            <div className="display-font" style={{ fontSize: 18, fontWeight: 800, color }}>
              {s.value}
            </div>
            <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </a>
  );
}

function FocusItem({ icon: Icon, color, bg, text, href, priority }: {
  icon: any; color: string; bg: string; text: string; href: string; priority?: 'high' | 'normal';
}) {
  return (
    <a href={href} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      borderRadius: 10, textDecoration: 'none', color: 'inherit',
      background: priority === 'high' ? bg : C.creamDeep,
      border: priority === 'high' ? `1px solid ${color}40` : '1px solid transparent',
      transition: 'background 0.2s ease',
    }}
      onMouseOver={e => { e.currentTarget.style.background = bg; }}
      onMouseOut={e => { e.currentTarget.style.background = priority === 'high' ? bg : C.creamDeep; }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: priority === 'high' ? color : bg,
        color: priority === 'high' ? '#fff' : color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={15} />
      </div>
      <div style={{ flex: 1, fontSize: 13, color: C.ink, fontWeight: 600 }}>
        {text}
        {priority === 'high' && (
          <span style={{ marginLeft: 6, padding: '1px 6px', background: color, color: '#fff', borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: '0.05em' }}>
            URGENT
          </span>
        )}
      </div>
      <ArrowRight size={14} color={C.inkSoft} />
    </a>
  );
}
