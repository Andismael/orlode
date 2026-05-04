/**
 * SecurityDashboardPage — Cybersécurité (tactical defense: night + red + cyan + gold)
 * 7 tabs: Home / SIEM / Incidents / Compliance / Access / Logs / Chat IA.
 * Real APIs: /security/dashboard, /security/threats, /security/incidents,
 *            /security/compliance, /security/access-review, /security/audit.
 * No mocks — empty states everywhere.
 */
import React, { useEffect, useState } from 'react';
import {
  Search, Sparkles, Shield, ShieldCheck, Bug, Mail, Fingerprint,
  ArrowUpRight, ArrowDownRight, Minus, Siren, Zap, AlertTriangle,
  ChevronRight, Plus, Send, RefreshCw, Bot, Brain,
  KeyRound, Activity, Filter, Download, Crosshair,
  ScanLine, Mic, Paperclip, MoreVertical, BadgeCheck,
  Network, FileLock,
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const C = {
  greenInk: '#042A1F',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  night: '#0A1628', nightDeep: '#050B1A',
  red: '#DC2626', redDeep: '#991B1B', redDark: '#7F1D1D', redSoft: '#FEE2E2', redLight: '#FCA5A5',
  cyan: '#06B6D4', cyanDeep: '#0891B2', cyanDark: '#155E75', cyanSoft: '#CFFAFE', cyanLight: '#67E8F9',
  gold: '#D4A017', goldDeep: '#B8860B', goldDark: '#8B6914', goldSoft: '#FEF3C7', goldLight: '#FCD34D',
  sage: '#10B981', sageDeep: '#059669', sageDark: '#065F46', sageSoft: '#D1FAE5',
  violet: '#7C3AED', violetSoft: '#F3E8FF',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  ink: '#0A2A20', inkSoft: '#5A6B62', inkLight: '#94A3A0',
  onNightSoft: '#94A3B8',
} as const;

type Tab = 'home' | 'siem' | 'incidents' | 'compliance' | 'access' | 'logs' | 'chat';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface Score {
  global: number;
  categories: { name?: string; label?: string; value?: number; score?: number; sub?: string }[];
  recommendations: string[];
}
interface Kpis {
  securityScore: number; openIncidents: number; criticalIncidents: number;
  openVulnerabilities: number; threatsBlocked: number; totalThreats: number;
}
interface Dashboard { score: Score; kpis: Kpis; incidents: any[]; recentThreats: any[]; phishingCampaigns: any[] }

interface Threat { id: string; type?: string; severity: Severity; source?: string; sourceCity?: string; target?: string; message?: string; blocked?: boolean; timestamp?: any }
interface Incident { id: string; title?: string; description?: string; type?: string; status?: string; priority?: string; severity?: string; assignee?: string; affectedSystems?: string[]; createdAt?: any; nist?: string }
interface ComplianceFw { id: string; name: string; fullName?: string; score: number; controls: number; passed: number; failed: number; color?: string }
interface AccessUser { id: string; name?: string; email?: string; role?: string; mfa?: boolean; lastLogin?: any; sessions?: number; riskScore?: number; status?: string; warning?: string }
interface AuditLog { id: string; timestamp?: any; userEmail?: string; user?: string; action?: string; resource?: string; ip?: string; country?: string; flag?: string }

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRITICAL', color: C.red,        bg: C.redSoft },
  high:     { label: 'HIGH',     color: C.gold,       bg: C.goldSoft },
  medium:   { label: 'MEDIUM',   color: C.blue,       bg: C.blueSoft },
  low:      { label: 'LOW',      color: C.sageDark,   bg: C.sageSoft },
  info:     { label: 'INFO',     color: C.inkSoft,    bg: C.creamDeep },
};

function asSeverity(s?: string): Severity {
  const v = (s ?? '').toLowerCase();
  if (v === 'critical' || v === 'p1' || v === 'p1_critical') return 'critical';
  if (v === 'high' || v === 'p2' || v === 'p2_high') return 'high';
  if (v === 'medium' || v === 'p3' || v === 'p3_medium') return 'medium';
  if (v === 'low' || v === 'p4' || v === 'p4_low') return 'low';
  return 'info';
}
function tsToMs(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string') { const d = Date.parse(v); return isNaN(d) ? 0 : d; }
  if (typeof v === 'object') {
    const s = v._seconds ?? v.seconds;
    if (typeof s === 'number') return s * 1000;
  }
  return 0;
}
function fmtRel(v: any): string {
  const ms = tsToMs(v);
  if (!ms) return '—';
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'Hier';
  return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function fmtTime(v: any): string {
  const ms = tsToMs(v);
  if (!ms) return '—:—:—';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  .sec-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .sec-mono { font-family: 'JetBrains Mono', monospace; }
  .sec-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .sec-icon-btn { width: 34px; height: 34px; border-radius: 9px; background: ${C.redSoft}; color: ${C.redDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; flex-shrink: 0; }
  .sec-icon-btn:hover { background: ${C.redDeep}; color: ${C.cream}; }
  .sec-icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .sec-icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${C.redDeep}; }
  .sec-grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  @keyframes secPulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.6); opacity: 0; } }
  .sec-live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.sage}; position: relative; flex-shrink: 0; }
  .sec-live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.sage}; opacity: 0.4; animation: secPulse 1.8s ease-in-out infinite; }
  @keyframes secSeverity { 0%,100% { box-shadow: 0 0 0 0 ${C.red}80; } 50% { box-shadow: 0 0 0 8px ${C.red}00; } }
  .sec-severity-pulse { animation: secSeverity 1.6s ease-in-out infinite; }
  @keyframes secRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .sec-rotate { animation: secRotate 30s linear infinite; }
  @keyframes secScan { 0% { transform: translateY(-100%); opacity: 1; } 100% { transform: translateY(100%); opacity: 0; } }
  .sec-scan-line { position: absolute; left: 0; right: 0; height: 60px; background: linear-gradient(180deg, transparent, ${C.cyan}40, transparent); animation: secScan 4s linear infinite; pointer-events: none; }
  @keyframes secShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  .sec-shimmer { background: linear-gradient(90deg, ${C.cyanLight}, ${C.gold}, ${C.redLight}, ${C.gold}, ${C.cyanLight}); background-size: 200% auto; background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: secShimmer 4s linear infinite; }
  @keyframes secFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .sec-stagger > * { animation: secFadeIn 0.4s ease-out backwards; }
  .sec-stagger > *:nth-child(1){animation-delay:.05s}.sec-stagger > *:nth-child(2){animation-delay:.10s}.sec-stagger > *:nth-child(3){animation-delay:.15s}.sec-stagger > *:nth-child(4){animation-delay:.20s}.sec-stagger > *:nth-child(5){animation-delay:.25s}.sec-stagger > *:nth-child(n+6){animation-delay:.30s}
  .sec-card-lift { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  .sec-card-lift:hover { transform: translateY(-2px); }
  .sec-thin::-webkit-scrollbar { width: 6px; }
  .sec-thin::-webkit-scrollbar-thumb { background: rgba(10,42,32,0.15); border-radius: 100px; }
  .sec-thin-dark::-webkit-scrollbar { width: 6px; }
  .sec-thin-dark::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 100px; }
  @media (max-width: 1024px) {
    .sec-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .sec-grid-2 { grid-template-columns: 1fr !important; }
    .sec-shell { padding: 14px !important; }
    .sec-detail-sidebar { display: none !important; }
  }
  @media (max-width: 768px) {
    .sec-hide-mobile { display: none !important; }
    .sec-grid-4 { grid-template-columns: 1fr !important; }
    .sec-hero-title { font-size: 24px !important; }
    .sec-shell { padding: 10px !important; gap: 10px !important; }
    .sec-hero-pad { padding: 22px 18px !important; }
  }
`;

export default function SecurityDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/security/dashboard').then(r => {
      const d = (r.data as any)?.data ?? r.data;
      setDashboard(d as Dashboard);
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  return (
    <div className="sec-shell" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: '100vh', background: C.creamDeep, fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>

      <HeroSection kpis={dashboard?.kpis} loading={loading} />
      <TabsBar activeTab={activeTab} setActiveTab={setActiveTab} kpis={dashboard?.kpis} />

      {activeTab === 'home'       && <HomeTab dashboard={dashboard} loading={loading} />}
      {activeTab === 'siem'       && <SIEMTab />}
      {activeTab === 'incidents'  && <IncidentsTab />}
      {activeTab === 'compliance' && <ComplianceTab />}
      {activeTab === 'access'     && <AccessTab />}
      {activeTab === 'logs'       && <LogsTab />}
      {activeTab === 'chat'       && <ChatTab kpis={dashboard?.kpis} />}
    </div>
  );
}

// ─── CSV download helper (Excel-FR ready: BOM UTF-8 + ; separator) ───────────
function downloadCsv(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const escape = (v: any): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [
    headers.join(';'),
    ...rows.map(r => headers.map(h => escape(r[h])).join(';')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function fmtDate(v: any): string {
  if (!v) return '';
  const t = v?.toDate?.()?.getTime?.() ?? (v?.seconds ? v.seconds * 1000 : (typeof v === 'string' || typeof v === 'number' ? new Date(v).getTime() : NaN));
  return Number.isFinite(t) ? new Date(t).toISOString() : String(v);
}

function HeroSection({ kpis, loading }: { kpis?: Kpis; loading: boolean }) {
  return (
    <div className="sec-hero-pad" style={{ position: 'relative', background: `linear-gradient(135deg, ${C.nightDeep} 0%, ${C.night} 50%, ${C.cyanDark} 100%)`, borderRadius: 24, padding: '32px 36px', overflow: 'hidden', border: `1px solid ${C.cyan}40`, boxShadow: `0 20px 50px -20px ${C.nightDeep}` }}>
      <div className="sec-grain" />
      <div className="sec-rotate" style={{ position: 'absolute', top: -100, right: -100, width: 360, height: 360, borderRadius: '50%', border: `1px dashed ${C.gold}30`, pointerEvents: 'none' }} />
      <div className="sec-scan-line" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 11, fontWeight: 600, color: 'rgba(255,250,240,0.7)', position: 'relative', zIndex: 2 }}>
        <span>Mes Agents</span>
        <ChevronRight size={11} />
        <span>Sécurité</span>
        <ChevronRight size={11} />
        <span style={{ color: C.cream, fontWeight: 700 }}>Cybersécurité</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 28, position: 'relative', zIndex: 2, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.red}, ${C.cyan})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px -6px ${C.red}` }}>
              <ShieldCheck size={26} color={C.cream} strokeWidth={2} />
            </div>
            <div>
              <h1 className="sec-display sec-hero-title" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Agent <em className="sec-shimmer" style={{ fontStyle: 'italic', fontWeight: 500 }}>Cybersécurité</em>
              </h1>
              <div style={{ fontSize: 12, color: 'rgba(255,250,240,0.85)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="sec-live-dot" style={{ background: C.sage }} />
                <span style={{ fontWeight: 600 }}>SIEM actif · 24/7 · {loading ? 'connexion…' : `${kpis?.threatsBlocked ?? 0} menaces bloquées`}</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,250,240,0.85)', margin: '0 0 18px', lineHeight: 1.5, maxWidth: 580 }}>
            Détection d'intrusion en temps réel, gestion d'incidents NIST IR, conformité RGPD/ISO 27001/SOC2, audit logs immutables.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.greenInk, border: 'none', padding: '11px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: `0 8px 24px -8px ${C.gold}`, fontFamily: 'inherit' }}>
              <ScanLine size={14} /> Lancer un audit
            </button>
            <button style={{ background: 'rgba(255,250,240,0.08)', color: C.cream, border: '1px solid rgba(255,250,240,0.15)', padding: '11px 18px', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Plus size={13} /> Créer un incident
            </button>
          </div>
        </div>

        <div className="sec-hide-mobile" style={{ background: 'rgba(255,250,240,0.06)', border: `1px solid ${C.cyan}40`, borderRadius: 18, padding: 18, minWidth: 260, backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Crosshair size={12} color={C.cyan} />
            <span style={{ fontSize: 10, fontWeight: 800, color: C.cyan, letterSpacing: '0.1em' }}>STATUT TEMPS RÉEL</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Score sécurité',    value: `${kpis?.securityScore ?? 0} / 100`,                   color: (kpis?.securityScore ?? 0) >= 70 ? C.sage : C.gold },
              { label: 'Incidents ouverts', value: String(kpis?.openIncidents ?? 0),                      color: (kpis?.openIncidents ?? 0) === 0 ? C.sage : C.gold },
              { label: 'Critiques',         value: String(kpis?.criticalIncidents ?? 0),                  color: (kpis?.criticalIncidents ?? 0) === 0 ? C.sage : C.red },
              { label: 'Vulnérabilités',     value: String(kpis?.openVulnerabilities ?? 0),                color: (kpis?.openVulnerabilities ?? 0) === 0 ? C.sage : C.gold },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <span style={{ color: 'rgba(255,250,240,0.7)' }}>{s.label}</span>
                <span className="sec-mono" style={{ color: s.color, fontWeight: 700, fontSize: 11 }}>● {s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabsBar({ activeTab, setActiveTab, kpis }: { activeTab: Tab; setActiveTab: (t: Tab) => void; kpis?: Kpis }) {
  const tabs: { id: Tab; label: string; icon: any; count: number | null; highlight?: boolean }[] = [
    { id: 'home',       label: 'Accueil',     icon: Shield,        count: null },
    { id: 'siem',       label: 'SIEM',         icon: Activity,      count: kpis?.totalThreats ?? null, highlight: true },
    { id: 'incidents',  label: 'Incidents',    icon: Siren,         count: kpis?.openIncidents ?? null },
    { id: 'compliance', label: 'Conformité',   icon: BadgeCheck,    count: null },
    { id: 'access',     label: 'Accès & MFA',  icon: KeyRound,      count: null },
    { id: 'logs',       label: 'Audit logs',   icon: FileLock,      count: null },
    { id: 'chat',       label: 'Chat IA',      icon: Bot,           count: null },
  ];
  return (
    <div className="sec-thin" style={{ background: C.cream, borderRadius: 14, padding: 6, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', gap: 4, overflowX: 'auto' }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        return (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: active ? `linear-gradient(135deg, ${C.red}, ${C.redDeep})` : 'transparent',
            color: active ? C.cream : C.inkSoft,
            padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            boxShadow: active ? `0 6px 14px -4px ${C.red}` : 'none',
            flexShrink: 0, transition: 'all 0.2s ease', position: 'relative',
          }}>
            <Icon size={13} strokeWidth={2} />
            {t.label}
            {t.count !== null && (
              <span className="sec-mono" style={{ background: active ? 'rgba(255,250,240,0.25)' : C.creamDeep, color: active ? C.cream : C.inkSoft, padding: '1px 7px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>{t.count}</span>
            )}
            {t.highlight && !active && <div className="sec-live-dot" style={{ background: C.sage, marginLeft: 2, width: 6, height: 6 }} />}
          </button>
        );
      })}
    </div>
  );
}

function HomeTab({ dashboard, loading }: { dashboard: Dashboard | null; loading: boolean }) {
  const downloadFullReport = async () => {
    // Pull every dataset in parallel for a complete one-shot CSV bundle.
    try {
      const [incRes, threatsRes, vulnsRes, complRes, accessRes, auditRes] = await Promise.allSettled([
        api.get('/security/incidents'),
        api.get('/security/threats'),
        api.get('/security/vulnerabilities'),
        api.get('/security/compliance'),
        api.get('/security/access-review'),
        api.get('/security/audit'),
      ]);

      const unwrap = (r: any): any[] => {
        if (r.status !== 'fulfilled') return [];
        const d = r.value?.data;
        return Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
      };

      const date = new Date().toISOString().slice(0, 10);

      // Summary first
      const k = dashboard?.kpis;
      downloadCsv([{
        Date: new Date().toISOString(),
        Score_sécurité: k?.securityScore ?? 0,
        Alertes_critiques_P1: k?.criticalIncidents ?? 0,
        Vulnérabilités_ouvertes: k?.openVulnerabilities ?? 0,
        Menaces_bloquées: k?.threatsBlocked ?? 0,
        Menaces_totales: k?.totalThreats ?? 0,
      }], `security-summary-${date}.csv`);

      const incidents = unwrap(incRes);
      if (incidents.length) downloadCsv(incidents.map((i: any) => ({
        ID: i.id, Titre: i.title ?? i.description ?? '', Sévérité: i.severity ?? '', Priorité: i.priority ?? '', Statut: i.status ?? '',
        Date: fmtDate(i.createdAt ?? i.detectedAt), Assigné: i.assignee ?? i.assignedTo ?? '',
      })), `incidents-${date}.csv`);

      const threats = unwrap(threatsRes);
      if (threats.length) downloadCsv(threats.map((t: any) => ({
        ID: t.id ?? '', Date: fmtDate(t.timestamp ?? t.detectedAt), Type: t.type ?? '', Sévérité: t.severity ?? '',
        IP: t.sourceIp ?? t.ip ?? '', Cible: t.target ?? '', Action: t.action ?? '',
      })), `threats-${date}.csv`);

      const vulns = unwrap(vulnsRes);
      if (vulns.length) downloadCsv(vulns.map((v: any) => ({
        ID: v.id ?? '', CVE: v.cve ?? '', Sévérité: v.severity ?? '', CVSS: v.cvss ?? '',
        Asset: v.asset ?? '', Statut: v.status ?? '', Détection: fmtDate(v.detectedAt),
      })), `vulnerabilities-${date}.csv`);

      const compliance = unwrap(complRes);
      if (compliance.length) downloadCsv(compliance.map((f: any) => ({
        Framework: f.name ?? f.framework ?? '', Score: f.score ?? f.complianceRate ?? 0,
        Total: f.controls ?? f.totalControls ?? 0, Validés: f.passed ?? f.passedControls ?? 0, À_corriger: f.failed ?? f.failedControls ?? 0,
      })), `compliance-${date}.csv`);

      const access = unwrap(accessRes);
      if (access.length) downloadCsv(access.map((u: any) => ({
        ID: u.id ?? '', Nom: u.name ?? '', Email: u.email ?? '', Rôle: u.role ?? '',
        MFA: u.mfa ? 'OUI' : 'NON', Risque: u.riskScore ?? 0,
      })), `access-review-${date}.csv`);

      const audit = unwrap(auditRes);
      if (audit.length) downloadCsv(audit.map((l: any) => ({
        Date: fmtDate(l.timestamp ?? l.createdAt), Action: l.action ?? '',
        Utilisateur: l.user ?? l.userEmail ?? '', IP: l.ip ?? '', Ressource: l.resource ?? '', Flag: l.flag ?? '',
      })), `audit-logs-${date}.csv`);
    } catch (err) {
      console.error('[FullReport] failed', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={downloadFullReport} style={{
          background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`,
          color: C.cream, border: 'none', borderRadius: 12,
          padding: '10px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: `0 8px 20px -8px ${C.cyan}`,
        }}>
          <Download size={14} /> Télécharger rapport sécurité complet (7 CSV)
        </button>
      </div>
      <KPIStrip kpis={dashboard?.kpis} loading={loading} />
      <div className="sec-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <SecurityScoreCard score={dashboard?.score} />
        <CriticalAlertsCard incidents={dashboard?.incidents ?? []} />
      </div>
    </div>
  );
}

function KPIStrip({ kpis, loading }: { kpis?: Kpis; loading: boolean }) {
  const cards: { id: string; label: string; value: string; sub: string; trend: 'up' | 'down' | 'flat'; icon: any; color: string; soft: string; deep: string }[] = [
    { id: 'score',    label: 'Score sécurité',     value: String(kpis?.securityScore ?? 0),       sub: '/ 100',                              trend: 'up',   icon: Shield,      color: C.gold,  soft: C.goldSoft,  deep: C.goldDeep },
    { id: 'alerts',   label: 'Alertes critiques',  value: String(kpis?.criticalIncidents ?? 0),   sub: 'P1',                                 trend: 'flat', icon: Siren,       color: C.red,   soft: C.redSoft,   deep: C.redDeep },
    { id: 'vulns',    label: 'Vulnérabilités',      value: String(kpis?.openVulnerabilities ?? 0), sub: 'ouvertes',                            trend: 'flat', icon: Bug,         color: C.gold,  soft: C.goldSoft,  deep: C.goldDeep },
    { id: 'blocked',  label: 'Menaces bloquées',   value: String(kpis?.threatsBlocked ?? 0),      sub: `${kpis?.totalThreats ?? 0} totales`, trend: 'up',   icon: ShieldCheck, color: C.sage,  soft: C.sageSoft,  deep: C.sageDeep },
  ];
  return (
    <div className="sec-grid-4 sec-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map(s => {
        const Icon = s.icon;
        const TrendIcon = s.trend === 'up' ? ArrowUpRight : s.trend === 'down' ? ArrowDownRight : Minus;
        return (
          <div key={s.id} className="sec-card-lift" style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${s.color}, ${s.deep})` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: s.soft, color: s.deep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} />
              </div>
              <span className="sec-pill" style={{ background: C.sageSoft, color: C.sageDark, fontWeight: 700, fontSize: 10 }}>
                <TrendIcon size={9} /> {loading ? '…' : 'live'}
              </span>
            </div>
            <div className="sec-display sec-mono" style={{ fontSize: 32, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 6 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 1 }}>{s.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

function SecurityScoreCard({ score }: { score?: Score }) {
  const global = score?.global ?? 0;
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (global / 100) * circumference;

  const cats = (score?.categories ?? []).slice(0, 6).map(c => ({
    label: c.name ?? c.label ?? 'Catégorie',
    value: c.value ?? c.score ?? 0,
    sub: c.sub ?? '',
  }));

  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Shield size={18} color={C.gold} />
        <h3 className="sec-display" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
          Score de <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>sécurité</em>
        </h3>
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0 }}>
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="100" cy="100" r={radius} stroke={C.creamDeep} strokeWidth="14" fill="none" />
            <circle cx="100" cy="100" r={radius} stroke={global >= 80 ? C.sage : global >= 60 ? C.gold : C.red} strokeWidth="14" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="sec-display" style={{ fontSize: 48, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{global}</div>
            <div className="sec-mono" style={{ fontSize: 10, color: C.inkSoft, marginTop: 4, letterSpacing: '0.1em' }}>/ 100</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cats.length === 0 ? (
            <div style={{ fontSize: 12, color: C.inkLight, textAlign: 'center', padding: 20 }}>Score non encore calculé.</div>
          ) : cats.map((c, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.ink }}>{c.label}</span>
                <span className="sec-mono" style={{ fontSize: 11, fontWeight: 700, color: c.value >= 80 ? C.sageDark : c.value >= 60 ? C.goldDark : C.redDeep }}>{c.value}%</span>
              </div>
              <div style={{ height: 5, background: 'rgba(10,42,32,0.06)', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, c.value)}%`, background: c.value >= 80 ? `linear-gradient(90deg, ${C.sage}, ${C.sageDeep})` : c.value >= 60 ? `linear-gradient(90deg, ${C.gold}, ${C.goldDeep})` : `linear-gradient(90deg, ${C.red}, ${C.redDeep})`, borderRadius: 100 }} />
              </div>
              {c.sub && <div style={{ fontSize: 9, color: C.inkLight, marginTop: 2 }}>{c.sub}</div>}
            </div>
          ))}
        </div>
      </div>
      {(score?.recommendations?.length ?? 0) > 0 && (
        <div style={{ marginTop: 16, padding: 14, background: `linear-gradient(135deg, ${C.cyanSoft}, ${C.violetSoft})`, borderRadius: 12, border: `1px solid ${C.cyan}30` }}>
          <div className="sec-pill" style={{ background: C.cyan, color: C.cream, fontWeight: 700, marginBottom: 8, fontSize: 10 }}>
            <Sparkles size={10} /> RECOMMANDATIONS IA
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12, color: C.ink, lineHeight: 1.6 }}>
            {(score?.recommendations ?? []).slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function CriticalAlertsCard({ incidents }: { incidents: any[] }) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: '1px solid rgba(10,42,32,0.06)', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Siren size={16} color={C.red} />
        <h3 className="sec-display" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
          Alertes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.red }}>critiques</em>
        </h3>
      </div>
      {incidents.length === 0 ? (
        <div style={{ background: C.sageSoft, borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <ShieldCheck size={32} color={C.sageDark} style={{ marginBottom: 8 }} />
          <div className="sec-display" style={{ fontSize: 14, fontWeight: 700, color: C.sageDark }}>Aucune alerte active</div>
          <div style={{ fontSize: 11, color: C.sageDark, marginTop: 2 }}>Tout est sous contrôle.</div>
        </div>
      ) : (
        <div className="sec-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {incidents.slice(0, 4).map((inc: any, idx) => {
            const sev = asSeverity(inc.priority ?? inc.severity);
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <div key={inc.id ?? idx} className={sev === 'critical' ? 'sec-severity-pulse' : ''} style={{ background: cfg.bg + '40', border: `1px solid ${cfg.color}40`, borderLeft: `4px solid ${cfg.color}`, borderRadius: 12, padding: 12, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span className="sec-display" style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                        {inc.title ?? inc.description ?? 'Incident'}
                      </span>
                      <span className="sec-pill" style={{ background: cfg.color, color: C.cream, fontSize: 9, fontWeight: 800 }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>
                      {inc.assignee ? `${inc.assignee} · ` : ''}{fmtRel(inc.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SIEMTab() {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Severity>('all');

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.get('/security/threats').then(r => {
        const arr = Array.isArray(r.data) ? r.data : ((r.data as any)?.data ?? []);
        if (!cancelled) {
          setThreats((arr as any[]).map(t => ({ ...t, severity: asSeverity(t.severity) })));
          setLoading(false);
        }
      }).catch(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const id = setInterval(load, 12000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const filtered = filter === 'all' ? threats : threats.filter(t => t.severity === filter);

  return (
    <div style={{ background: C.night, borderRadius: 18, border: `1px solid ${C.cyan}30`, overflow: 'hidden', position: 'relative' }}>
      <div style={{ padding: '14px 18px', background: 'linear-gradient(180deg, rgba(6,182,212,0.12), transparent)', borderBottom: `1px solid ${C.cyan}20`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="sec-live-dot" style={{ background: C.cyan }} />
        <span className="sec-mono" style={{ fontSize: 10, fontWeight: 800, color: C.cyan, letterSpacing: '0.12em' }}>SIEM · TEMPS RÉEL · POLLING 12s</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f as any)} style={{
              background: filter === f ? C.cyan : 'rgba(255,255,255,0.06)',
              color: filter === f ? C.cream : C.onNightSoft,
              border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {f === 'all' ? 'TOUT' : SEVERITY_CONFIG[f].label}
            </button>
          ))}
          <button onClick={() => {
            const rows = filtered.map(t => ({
              ID: (t as any).id ?? '',
              Date: fmtDate((t as any).timestamp ?? (t as any).detectedAt),
              Type: (t as any).type ?? '',
              Sévérité: t.severity,
              Source: (t as any).source ?? '',
              IP: (t as any).sourceIp ?? (t as any).ip ?? '',
              Cible: (t as any).target ?? '',
              Action: (t as any).action ?? '',
              Description: (t as any).description ?? '',
            }));
            downloadCsv(rows, `threats-${new Date().toISOString().slice(0, 10)}.csv`);
          }} disabled={filtered.length === 0} style={{
            background: filtered.length === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(6,182,212,0.15)',
            color: filtered.length === 0 ? C.onNightSoft : C.cyan,
            border: `1px solid ${C.cyan}40`, borderRadius: 7, padding: '5px 10px', fontSize: 10, fontWeight: 700,
            cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4,
          }}>
            <Download size={10} /> CSV
          </button>
        </div>
      </div>

      <div className="sec-thin-dark" style={{ maxHeight: 600, overflowY: 'auto', padding: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.onNightSoft }}>
            <RefreshCw size={32} className="sec-rotate" style={{ marginBottom: 12, color: C.cyan }} />
            <div className="sec-display" style={{ fontSize: 14, color: C.cream }}>Connexion au SIEM…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.onNightSoft }}>
            <Network size={40} strokeWidth={1.5} style={{ opacity: 0.4, marginBottom: 12 }} />
            <div className="sec-display" style={{ fontSize: 14, color: C.cream, fontWeight: 600 }}>Aucune menace détectée</div>
            <p style={{ fontSize: 11, margin: 4, opacity: 0.7 }}>Le système surveille en continu les attaques entrantes.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'JetBrains Mono, monospace' }}>
            {filtered.map(t => {
              const cfg = SEVERITY_CONFIG[t.severity];
              return (
                <div key={t.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${cfg.color}`, fontSize: 11, color: C.cream, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{ color: C.onNightSoft, flexShrink: 0, minWidth: 70 }}>{fmtTime(t.timestamp)}</span>
                  <span style={{ background: cfg.color, color: C.cream, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800, minWidth: 60, textAlign: 'center', flexShrink: 0 }}>{cfg.label}</span>
                  <span style={{ color: C.cyanLight, fontWeight: 700, flexShrink: 0, minWidth: 100 }}>{t.type ?? '—'}</span>
                  <span style={{ color: C.cream, flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{t.message ?? t.target ?? '—'}</span>
                  <span style={{ color: C.onNightSoft, fontSize: 10, flexShrink: 0 }}>{t.source ?? ''}</span>
                  {t.blocked ? (
                    <span style={{ color: C.sageDeep, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>● BLOCKED</span>
                  ) : (
                    <span style={{ color: C.gold, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>● ALERT</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function IncidentsTab() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'critical' | 'closed'>('all');

  useEffect(() => {
    api.get('/security/incidents').then(r => {
      const arr = Array.isArray(r.data) ? r.data : ((r.data as any)?.data ?? []);
      setIncidents(arr as Incident[]);
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  const filtered = incidents.filter(i => {
    const status = (i.status ?? '').toLowerCase();
    const isClosed = status === 'closed' || status === 'recovered' || status === 'resolved';
    if (filter === 'open') return !isClosed;
    if (filter === 'critical') return (i.priority ?? '').toLowerCase().includes('p1') || (i.severity ?? '').toLowerCase() === 'critical';
    if (filter === 'closed') return isClosed;
    return true;
  });

  const filters: { id: typeof filter; label: string; count: number }[] = [
    { id: 'all',      label: 'Tous',      count: incidents.length },
    { id: 'open',     label: 'Ouverts',   count: incidents.filter(i => !['closed', 'recovered', 'resolved'].includes((i.status ?? '').toLowerCase())).length },
    { id: 'critical', label: 'Critiques', count: incidents.filter(i => (i.priority ?? '').toLowerCase().includes('p1')).length },
    { id: 'closed',   label: 'Résolus',   count: incidents.filter(i => ['closed', 'recovered', 'resolved'].includes((i.status ?? '').toLowerCase())).length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 12, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center' }}>
        {filters.map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: active ? `linear-gradient(135deg, ${C.red}, ${C.redDeep})` : 'transparent',
              color: active ? C.cream : C.inkSoft,
              padding: '7px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(10,42,32,0.1)', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
            }}>
              {f.label}
              <span className="sec-mono" style={{ background: active ? 'rgba(255,250,240,0.25)' : C.creamDeep, color: active ? C.cream : C.inkSoft, padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800 }}>{f.count}</span>
            </button>
          );
        })}
        <button onClick={() => {
          const rows = filtered.map(i => ({
            ID: i.id ?? '',
            Titre: i.title ?? i.description ?? '',
            Sévérité: asSeverity(i.priority ?? i.severity),
            Priorité: i.priority ?? '',
            Statut: i.status ?? '',
            Date: fmtDate(i.createdAt ?? (i as any).detectedAt),
            Assigné: i.assignee ?? (i as any).assignedTo ?? '',
            Systèmes_affectés: (i.affectedSystems ?? []).join(' | '),
            NIST: i.nist ?? '',
            Description: i.description ?? '',
          }));
          downloadCsv(rows, `incidents-${new Date().toISOString().slice(0, 10)}.csv`);
        }} disabled={filtered.length === 0} style={{ marginLeft: 'auto', background: filtered.length === 0 ? 'rgba(10,42,32,0.06)' : 'transparent', color: filtered.length === 0 ? C.inkLight : C.inkSoft, border: '1px solid rgba(10,42,32,0.1)', padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <Download size={11} /> CSV
        </button>
      </div>

      {loading ? (
        <EmptyOrLoading loading icon={Siren} title="Chargement des incidents…" />
      ) : filtered.length === 0 ? (
        <EmptyOrLoading icon={ShieldCheck} title={incidents.length === 0 ? 'Aucun incident enregistré' : 'Aucun incident ne correspond au filtre'} sub={incidents.length === 0 ? 'Tout est sous contrôle.' : 'Essaie d\'ajuster les filtres.'} />
      ) : (
        <div className="sec-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(inc => {
            const sev = asSeverity(inc.priority ?? inc.severity);
            const cfg = SEVERITY_CONFIG[sev];
            const status = (inc.status ?? 'detected').toLowerCase();
            const isClosed = status === 'closed' || status === 'resolved' || status === 'recovered';
            return (
              <div key={inc.id} className="sec-card-lift" style={{
                background: C.cream, borderRadius: 14, padding: 16,
                border: '1px solid rgba(10,42,32,0.06)',
                borderLeft: `4px solid ${cfg.color}`,
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span className="sec-mono" style={{ fontSize: 10, color: C.inkLight, fontWeight: 700 }}>#{inc.id}</span>
                      <h3 className="sec-display" style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
                        {inc.title ?? inc.description ?? 'Incident'}
                      </h3>
                      <span className="sec-pill" style={{ background: cfg.color, color: C.cream, fontSize: 9, fontWeight: 800 }}>{cfg.label}</span>
                      <span className="sec-pill" style={{ background: isClosed ? C.sageSoft : C.goldSoft, color: isClosed ? C.sageDark : C.goldDark, fontSize: 9, fontWeight: 700 }}>
                        ● {status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.inkSoft, flexWrap: 'wrap' }}>
                      {inc.assignee && <span><strong style={{ color: C.ink }}>{inc.assignee}</strong></span>}
                      <span>{fmtRel(inc.createdAt)}</span>
                      {(inc.affectedSystems?.length ?? 0) > 0 && (
                        <span>{inc.affectedSystems!.length} système(s) affecté(s)</span>
                      )}
                      {inc.nist && <span style={{ color: C.cyanDeep, fontWeight: 700 }}>{inc.nist}</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} color={C.inkLight} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ComplianceTab() {
  const [frameworks, setFrameworks] = useState<ComplianceFw[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/security/compliance').then(r => {
      const arr = Array.isArray(r.data) ? r.data : ((r.data as any)?.data ?? []);
      setFrameworks((arr as any[]).map(f => ({
        id: f.id ?? f.framework ?? f.name,
        name: f.name ?? f.framework ?? f.id,
        fullName: f.fullName ?? f.description,
        score: f.score ?? f.complianceRate ?? 0,
        controls: f.controls ?? f.totalControls ?? 0,
        passed: f.passed ?? f.passedControls ?? 0,
        failed: f.failed ?? f.failedControls ?? 0,
        color: f.color,
      })));
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  if (loading) return <EmptyOrLoading loading icon={BadgeCheck} title="Chargement de la conformité…" />;
  if (frameworks.length === 0) return <EmptyOrLoading icon={BadgeCheck} title="Aucun framework configuré" sub="RGPD, ISO 27001, SOC 2, NIST CSF s'afficheront ici." />;

  return (
   <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
      <button onClick={() => {
        const rows = frameworks.map(f => ({
          Framework: f.name,
          Description: f.fullName ?? '',
          'Score (%)': f.score,
          'Contrôles totaux': f.controls,
          'Contrôles validés': f.passed,
          'Contrôles à corriger': f.failed,
        }));
        downloadCsv(rows, `compliance-${new Date().toISOString().slice(0, 10)}.csv`);
      }} style={{ background: 'transparent', color: C.inkSoft, border: '1px solid rgba(10,42,32,0.1)', padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Download size={11} /> Export conformité
      </button>
    </div>
    <div className="sec-grid-2 sec-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
      {frameworks.map(f => {
        const colorMain = f.color ?? (f.score >= 70 ? C.sage : f.score >= 50 ? C.gold : C.red);
        return (
          <div key={f.id} className="sec-card-lift" style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${colorMain}20`, color: colorMain, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BadgeCheck size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="sec-display" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>{f.name}</h3>
                {f.fullName && <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>{f.fullName}</p>}
              </div>
              <div className="sec-display sec-mono" style={{ fontSize: 28, fontWeight: 800, color: colorMain, lineHeight: 1 }}>{f.score}%</div>
            </div>
            <div style={{ height: 8, background: 'rgba(10,42,32,0.06)', borderRadius: 100, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${Math.min(100, f.score)}%`, background: `linear-gradient(90deg, ${colorMain}, ${colorMain}cc)`, borderRadius: 100 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSoft }}>
              <span><strong style={{ color: C.sageDark }}>{f.passed}</strong> / {f.controls} validés</span>
              <span><strong style={{ color: C.redDeep }}>{f.failed}</strong> à corriger</span>
            </div>
          </div>
        );
      })}
    </div>
   </>
  );
}

function AccessTab() {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/security/access-review').then(r => {
      const arr = Array.isArray(r.data) ? r.data : ((r.data as any)?.data ?? []);
      setUsers(arr as AccessUser[]);
    }).catch(() => null).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleForceReset = async (userId?: string, email?: string) => {
    if (!userId) return;
    const label = email ?? userId;
    if (!window.confirm(`Forcer reset du mot de passe pour ${label} ?`)) return;
    try {
      await api.post('/security/remediate/force-reset', { userId, reason: 'Forcé manuellement depuis la revue d\'accès' });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erreur';
      window.alert(`Échec du reset : ${msg}`);
    }
    load();
  };

  if (loading) return <EmptyOrLoading loading icon={KeyRound} title="Chargement de la revue d'accès…" />;
  if (users.length === 0) return <EmptyOrLoading icon={KeyRound} title="Aucun utilisateur à passer en revue" />;

  return (
    <div style={{ background: C.cream, borderRadius: 18, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', background: C.creamDeep, borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <h3 className="sec-display" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
            Revue <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.red }}>d'accès</em>
          </h3>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>{users.length} utilisateur{users.length > 1 ? 's' : ''} · {users.filter(u => !u.mfa).length} sans MFA</p>
        </div>
        <button onClick={() => {
          const rows = users.map(u => ({
            ID: u.id ?? '',
            Nom: u.name ?? '',
            Email: u.email ?? '',
            Rôle: u.role ?? '',
            MFA: u.mfa ? 'OUI' : 'NON',
            Risque: u.riskScore ?? 0,
            Avertissement: u.warning ?? '',
            'Dernière connexion': fmtDate((u as any).lastLoginAt ?? (u as any).lastSignInAt),
          }));
          downloadCsv(rows, `access-review-${new Date().toISOString().slice(0, 10)}.csv`);
        }} style={{ background: 'transparent', color: C.inkSoft, border: '1px solid rgba(10,42,32,0.1)', padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Download size={11} /> CSV
        </button>
      </div>
      <div className="sec-stagger" style={{ display: 'flex', flexDirection: 'column' }}>
        {users.map(u => {
          const risk = u.riskScore ?? 0;
          const riskColor = risk >= 70 ? C.red : risk >= 40 ? C.gold : C.sage;
          return (
            <div key={u.id} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(10,42,32,0.04)', flexWrap: 'wrap' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${C.red}, ${C.redDeep})`, color: C.cream, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>
                {(u.name ?? u.email ?? '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span className="sec-display" style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{u.name ?? u.email}</span>
                  {u.role && <span className="sec-pill" style={{ background: C.creamDeep, color: C.inkSoft, fontSize: 9, fontWeight: 700 }}>{u.role}</span>}
                  {u.mfa ? (
                    <span className="sec-pill" style={{ background: C.sageSoft, color: C.sageDark, fontSize: 9, fontWeight: 700 }}>
                      <Fingerprint size={9} /> MFA
                    </span>
                  ) : (
                    <span className="sec-pill" style={{ background: C.redSoft, color: C.redDeep, fontSize: 9, fontWeight: 800 }}>
                      <AlertTriangle size={9} /> NO MFA
                    </span>
                  )}
                  {u.warning && <span className="sec-pill" style={{ background: C.goldSoft, color: C.goldDark, fontSize: 9, fontWeight: 700 }}>{u.warning}</span>}
                </div>
                <div style={{ fontSize: 10, color: C.inkLight, fontFamily: 'JetBrains Mono, monospace' }}>{u.email}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: C.inkLight, letterSpacing: '0.08em', fontWeight: 700, marginBottom: 2 }}>RISK SCORE</div>
                <div className="sec-mono" style={{ fontSize: 16, fontWeight: 800, color: riskColor }}>{risk}/100</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => handleForceReset(u.id, u.email)} className="sec-icon-btn" title="Forcer reset password"><KeyRound size={14} /></button>
                <button className="sec-icon-btn ghost"><MoreVertical size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/security/audit').then(r => {
      const arr = Array.isArray(r.data) ? r.data : ((r.data as any)?.data ?? []);
      setLogs(arr as AuditLog[]);
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (l.action ?? '').toLowerCase().includes(s) ||
      (l.user ?? l.userEmail ?? '').toLowerCase().includes(s) ||
      (l.resource ?? '').toLowerCase().includes(s) ||
      (l.ip ?? '').toLowerCase().includes(s);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 12, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, background: C.creamDeep, borderRadius: 10, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={13} color={C.inkSoft} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher action, user, IP, ressource…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: C.ink, fontFamily: 'inherit', minWidth: 0 }} />
        </div>
        <button onClick={() => {
          const rows = filtered.map(l => ({
            Date: fmtDate(l.timestamp ?? (l as any).createdAt),
            Action: l.action ?? '',
            Utilisateur: l.user ?? l.userEmail ?? '',
            IP: l.ip ?? '',
            Ressource: l.resource ?? '',
            Flag: (l as any).flag ?? '',
            Détails: (l as any).details ?? '',
          }));
          downloadCsv(rows, `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
        }} disabled={filtered.length === 0} style={{ background: filtered.length === 0 ? 'rgba(10,42,32,0.06)' : 'transparent', color: filtered.length === 0 ? C.inkLight : C.inkSoft, border: '1px solid rgba(10,42,32,0.1)', padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Download size={12} /> Export ({filtered.length})
        </button>
      </div>

      {loading ? (
        <EmptyOrLoading loading icon={FileLock} title="Chargement des logs…" />
      ) : filtered.length === 0 ? (
        <EmptyOrLoading icon={FileLock} title={logs.length === 0 ? 'Aucun audit log' : 'Aucun log ne correspond'} />
      ) : (
        <div style={{ background: C.night, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.cyan}30` }}>
          <div className="sec-thin-dark" style={{ maxHeight: 600, overflowY: 'auto', padding: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'JetBrains Mono, monospace' }}>
              {filtered.map(l => {
                const flagColor = l.flag === 'high_risk' || l.flag === 'suspicious' ? C.red : C.cyan;
                return (
                  <div key={l.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${flagColor}`, fontSize: 11, color: C.cream, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <span style={{ color: C.onNightSoft, flexShrink: 0, minWidth: 70 }}>{fmtTime(l.timestamp)}</span>
                    <span style={{ color: C.cyanLight, fontWeight: 700, flexShrink: 0, minWidth: 130 }}>{l.action ?? '—'}</span>
                    <span style={{ color: C.cream, flexShrink: 0, minWidth: 160 }}>{l.user ?? l.userEmail ?? '—'}</span>
                    <span style={{ color: C.onNightSoft, flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{l.resource ?? '—'}</span>
                    <span style={{ color: C.onNightSoft, fontSize: 10, flexShrink: 0 }}>{l.ip ?? ''}</span>
                    {l.flag && (
                      <span style={{ color: flagColor, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>● {l.flag.toUpperCase()}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChatMsg { id: string; from: 'ai' | 'user'; text: string; time: string }
function ChatTab({ kpis }: { kpis?: Kpis }) {
  const { user } = useAuthStore();
  const userName = (user as any)?.displayName ?? user?.email ?? 'Vous';
  const userInitials = (userName.split(' ').map((s: string) => s[0]).slice(0, 2).join('') || '?').toUpperCase();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 'welcome', from: 'ai', text: `Bonjour ${userName.split(' ')[0]} 👋 Je suis ton **Agent Cybersécurité**. Score actuel : **${kpis?.securityScore ?? 0}/100** · ${kpis?.openIncidents ?? 0} incident(s) ouvert(s) · ${kpis?.openVulnerabilities ?? 0} vulnérabilité(s). Que veux-tu vérifier ?`, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [sending, setSending] = useState(false);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: `u_${Date.now()}`, from: 'user', text: msg, time: now }]);
    setInput('');
    setSending(true);
    try {
      const r = await api.post('/ai-chat', { message: msg, agent: 'cybersec' }).catch(() => api.post('/chat', { message: msg, agentType: 'cybersec' }));
      const reply = (r?.data as any)?.data?.response ?? (r?.data as any)?.response ?? (r?.data as any)?.reply ?? (r?.data as any)?.message ?? 'Désolé, je ne peux pas répondre pour l\'instant.';
      setMessages(prev => [...prev, { id: `a_${Date.now()}`, from: 'ai', text: reply, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    } catch {
      setMessages(prev => [...prev, { id: `a_err_${Date.now()}`, from: 'ai', text: '⚠️ Impossible de joindre l\'agent. Réessaie dans un instant.', time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    } finally { setSending(false); }
  };

  const quickPrompts = [
    { icon: Shield, label: 'Score de sécurité actuel ?' },
    { icon: Bug, label: 'Vulnérabilités critiques' },
    { icon: Siren, label: 'Incidents ouverts cette semaine' },
    { icon: Mail, label: 'Lancer un test phishing' },
    { icon: BadgeCheck, label: 'Niveau de conformité RGPD' },
    { icon: KeyRound, label: 'Utilisateurs sans MFA' },
  ];

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: `linear-gradient(135deg, ${C.red}, ${C.cyan})`, borderRadius: 16, padding: '16px 20px', color: C.cream, position: 'relative', overflow: 'hidden' }}>
          <div className="sec-grain" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(255,250,240,0.25)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={26} color={C.cream} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="sec-display" style={{ fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Agent Cybersécurité · Chat</h3>
              <div style={{ fontSize: 11, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span className="sec-live-dot" style={{ background: C.gold }} />
                Branché sur SIEM · Incidents · Compliance
              </div>
            </div>
            <button onClick={() => setMessages(messages.slice(0, 1))} className="sec-icon-btn" style={{ background: 'rgba(255,250,240,0.15)', color: C.cream }} title="Réinitialiser">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="sec-thin" style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', minHeight: 380, maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map(m => {
            const isUser = m.from === 'user';
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: isUser ? `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})` : `linear-gradient(135deg, ${C.red}, ${C.cyan})`, color: isUser ? C.greenInk : C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, fontFamily: 'Fraunces, serif' }}>
                  {isUser ? userInitials : <Brain size={16} />}
                </div>
                <div style={{ maxWidth: '80%' }}>
                  <div style={{ background: isUser ? `linear-gradient(135deg, ${C.red}, ${C.redDeep})` : C.creamDeep, color: isUser ? C.cream : C.ink, padding: '11px 14px', borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px', fontSize: 13, lineHeight: 1.5, boxShadow: isUser ? `0 6px 14px -6px ${C.red}` : 'none', whiteSpace: 'pre-wrap' }}>
                    {m.text.split('**').map((part, i) =>
                      i % 2 === 1 ? <strong key={i} style={{ color: isUser ? C.gold : C.redDeep }}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
                    )}
                  </div>
                  <div className="sec-mono" style={{ fontSize: 9, color: C.inkLight, marginTop: 3, textAlign: isUser ? 'right' : 'left', padding: '0 4px' }}>{m.time}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: C.cream, borderRadius: 16, padding: 14, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ background: C.creamDeep, borderRadius: 12, padding: 8, display: 'flex', alignItems: 'flex-end', gap: 6, border: '1.5px solid rgba(10,42,32,0.08)' }}>
            <button className="sec-icon-btn ghost" style={{ width: 32, height: 32 }}><Paperclip size={14} /></button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Pose une question sur ta sécurité…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: C.ink, fontFamily: 'inherit', padding: '8px 4px' }}
            />
            <button className="sec-icon-btn ghost" style={{ width: 32, height: 32 }}><Mic size={14} /></button>
            <button onClick={() => send()} disabled={!input.trim() || sending} style={{ background: `linear-gradient(135deg, ${C.red}, ${C.redDeep})`, color: C.cream, border: 'none', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!input.trim() || sending) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="sec-detail-sidebar sec-hide-mobile" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 90 }}>
        <div style={{ background: C.cream, borderRadius: 16, padding: 16, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div className="sec-pill" style={{ background: C.cyanSoft, color: C.cyanDeep, fontWeight: 700, fontSize: 10, marginBottom: 8 }}>
            <Zap size={10} /> SUGGESTIONS RAPIDES
          </div>
          <h4 className="sec-display" style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            Que veux-tu <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>vérifier</em> ?
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {quickPrompts.map((p, i) => {
              const Icon = p.icon;
              return (
                <button key={i} onClick={() => send(p.label)} style={{ background: 'transparent', border: '1px solid rgba(10,42,32,0.08)', borderRadius: 9, padding: '8px 10px', fontSize: 11, color: C.ink, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={12} color={C.cyanDeep} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyOrLoading({ loading, icon: Icon, title, sub }: { loading?: boolean; icon: any; title: string; sub?: string }) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.15)' }}>
      {loading ? (
        <RefreshCw size={28} color={C.red} className="sec-rotate" style={{ marginBottom: 12 }} />
      ) : (
        <Icon size={48} color={C.inkLight} style={{ marginBottom: 12 }} />
      )}
      <h3 className="sec-display" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px' }}>{title}</h3>
      {sub && <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>{sub}</p>}
    </div>
  );
}
