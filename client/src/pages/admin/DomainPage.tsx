/**
 * DomainPage — /admin/domain
 *
 * Lets the company:
 *   - View their free subdomain (auto-derived from company name).
 *   - Connect a custom domain (and see the DNS records they must add at
 *     their registrar — OVH, GoDaddy, Hostinger, etc).
 *   - Manage pro emails (@theirdomain.tld) that forward to a personal inbox.
 *   - Browse domain extensions to register/buy (UI only — actual purchase
 *     would go through a registrar integration we don't ship yet).
 *
 * Data model (on the company doc):
 *   - customDomain: string         (e.g. 'chezmalou.ci')
 *   - subdomain:    string         (e.g. 'chezmalou.orlode.ci' — auto)
 *   - proEmails:    Array<{ email, forward, active }>
 *
 * DNS records are shown to the user as instructions. Real DNS provisioning
 * lives outside this page (registrar API integration — TODO).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Globe, ShieldCheck, Mail, Zap, CheckCircle2, AlertCircle, RefreshCw,
  ExternalLink, Copy, ChevronLeft, Cloud, Sparkles,
  Plus, AtSign, Trash2, Info, Search, Crown,
  ArrowRight, Inbox,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';

const C = {
  greenDeep:   '#0A4F3C',
  cream:       '#FFFAF0',
  creamDeep:   '#F5F0E8',
  creamWarm:   '#FAF6EE',
  emerald:     '#10B981',
  emeraldDeep: '#059669',
  emeraldDark: '#065F46',
  emeraldSoft: '#D1FAE5',
  emeraldLight:'#6EE7B7',
  gold:        '#D97706',
  goldDeep:    '#B45309',
  goldSoft:    '#FEF3C7',
  goldLight:   '#FCD34D',
  violet:      '#8B5CF6',
  violetDeep:  '#7C3AED',
  violetSoft:  '#EDE9FE',
  coral:       '#FB7185',
  coralDeep:   '#E11D48',
  cyan:        '#06B6D4',
  cyanDeep:    '#0891B2',
  cyanSoft:    '#CFFAFE',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  ink:         '#1F2937',
  inkSoft:     '#4B5563',
  inkLight:    '#9CA3AF',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  .dom-page * { box-sizing: border-box; }
  .dom-page { font-family: 'Inter', sans-serif; padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; animation: fadeIn 0.3s ease-out; color: ${C.ink}; background: ${C.creamWarm}; min-height: 100vh; }
  .dom-page .display-font { font-family: 'Fraunces', serif; letter-spacing: -0.02em; }
  .dom-page .mono-font { font-family: 'JetBrains Mono', monospace; }
  .dom-page .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .dom-page .btn-primary { background: linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-family: inherit; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px ${C.emerald}; }
  .dom-page .btn-primary:hover { transform: translateY(-1px); }
  .dom-page .btn-secondary { background: ${C.cream}; color: ${C.emeraldDark}; border: 1.5px solid rgba(31,41,55,.1); padding: 10px 16px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .2s ease; font-family: inherit; }
  .dom-page .btn-secondary:hover { background: ${C.emeraldDeep}; color: ${C.cream}; border-color: ${C.emeraldDeep}; }
  .dom-page .btn-gold { background: linear-gradient(135deg, ${C.gold}, ${C.goldDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 8px 24px -8px ${C.gold}; font-family: inherit; }
  .dom-page .icon-btn-ghost { width: 28px; height: 28px; border-radius: 8px; background: transparent; color: ${C.inkSoft}; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border: none; }
  .dom-page .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.emerald}; position: relative; flex-shrink: 0; }
  .dom-page .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.emerald}; opacity: .4; animation: pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { transform: scale(1); opacity: .5; } 50% { transform: scale(1.6); opacity: 0; } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E"); opacity: .06; pointer-events: none; mix-blend-mode: overlay; }
  @keyframes slowRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .slow-rotate { animation: slowRotate 30s linear infinite; }
  .scroll-thin::-webkit-scrollbar { width: 6px; height: 6px; }
  .scroll-thin::-webkit-scrollbar-thumb { background: rgba(31,41,55,.15); border-radius: 100px; }
  @media (max-width: 1024px) {
    .dom-grid-2 { grid-template-columns: 1fr !important; }
    .dom-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
  }
  @media (max-width: 768px) {
    .dom-grid-3 { grid-template-columns: 1fr !important; }
    .dom-hero-title { font-size: 28px !important; }
  }
`;

function slugify(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// Firebase Hosting public anycast IP — stable since 2019. The user's registrar
// must point an A record (or CNAME to <project>.web.app) here. After the DNS
// propagates the user adds the domain in Firebase Console which auto-provisions
// the SSL cert. We can verify the A record from our /domain/verify endpoint.
const FIREBASE_HOSTING_IP = '199.36.158.100';
const FIREBASE_HOSTING_CNAME = 'mon-assistant-86bbd.web.app';

function dnsRecordsFor(_domain: string) {
  return [
    { type: 'A',     name: '@',   value: FIREBASE_HOSTING_IP,    ttl: '3600', doc: 'IP Firebase Hosting (root domain)' },
    { type: 'CNAME', name: 'www', value: FIREBASE_HOSTING_CNAME, ttl: '3600', doc: 'Sous-domaine www → Firebase' },
  ];
}

// Map a businessType to its public-page slug path.
// E.g. boutique → /shop/<slug>, restaurant → /menu/<slug>, etc.
const PUBLIC_PATH: Record<string, string> = {
  boutique:   'shop',
  restaurant: 'menu',
  hotel:      'hotel',
  residence:  'residence',
  service:    'salon',
  cabinet:    'cabinet',
  realestate: 'biens',
};

interface ProEmail { email: string; forward: string; active: boolean }

interface DomainSettings {
  customDomain?: string;
  customStatus?: 'pending' | 'verifying' | 'active' | 'failed';
  proEmails?: ProEmail[];
  publicUrl?: string;
}

interface VerifyResult {
  domain: string;
  aRecords: string[];
  cnames: string[];
  expectedIps: string[];
  expectedCnameTarget: string;
  verified: boolean;
  nextStep: string;
}

// ── Hero banner ───────────────────────────────────────────────────────────────
function DomainHero({ subdomain, customDomain, publicUrl }: { subdomain: string; customDomain?: string; publicUrl?: string }) {
  const displayDomain = customDomain || subdomain;
  return (
    <div style={{
      position: 'relative',
      background: `linear-gradient(135deg, ${C.emeraldDark} 0%, ${C.emerald} 50%, ${C.cyan} 130%)`,
      borderRadius: 22, padding: '24px 28px', overflow: 'hidden',
      border: `1px solid ${C.emeraldLight}40`, boxShadow: `0 20px 50px -20px ${C.emerald}`,
    }}>
      <div className="grain" />
      <div className="slow-rotate" style={{
        position: 'absolute', top: -120, right: -120,
        width: 360, height: 360, borderRadius: '50%',
        border: `1px dashed ${C.emeraldLight}40`,
      }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <span className="pill" style={{
          background: 'rgba(255,250,240,.18)', color: C.cream,
          border: `1px solid ${C.emeraldLight}40`, backdropFilter: 'blur(20px)',
          fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', marginBottom: 12,
        }}>
          <Globe size={11} color={C.emeraldLight} /> DOMAINE & IDENTITÉ EN LIGNE
        </span>
        <h1 className="display-font dom-hero-title" style={{
          fontSize: 40, fontWeight: 800, color: C.cream, margin: '4px 0 8px', lineHeight: 1,
        }}>
          Ton <em style={{ fontStyle: 'italic', color: C.goldLight }}>identité</em> en ligne
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,250,240,.9)', margin: '0 0 12px', lineHeight: 1.5, maxWidth: 600 }}>
          <strong style={{ color: C.emeraldLight, fontFamily: 'JetBrains Mono, monospace' }}>{displayDomain}</strong>
          {customDomain && (<> au lieu de <span style={{ textDecoration: 'line-through', opacity: .6, fontFamily: 'JetBrains Mono, monospace' }}>{subdomain}</span></>)}
          — sois 100% maître de ta marque.
        </p>
        {publicUrl && (
          <div style={{ background: 'rgba(255,250,240,.15)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, border: `1px solid ${C.emeraldLight}40`, backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Globe size={14} color={C.emeraldLight} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.emeraldLight, letterSpacing: '0.06em', marginBottom: 2 }}>TON URL PUBLIQUE FONCTIONNELLE</div>
              <a href={publicUrl} target="_blank" rel="noreferrer" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: C.cream, textDecoration: 'underline', wordBreak: 'break-all' }}>
                {publicUrl}
              </a>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Lien copié'); }} style={{ padding: '7px 12px', borderRadius: 8, background: C.cream, color: C.emeraldDark, fontWeight: 700, fontSize: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Copy size={11} style={{ display: 'inline', marginRight: 4 }} /> Copier
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="pill" style={{ background: 'rgba(255,250,240,.15)', color: C.cream, border: `1px solid ${C.emeraldLight}40`, fontSize: 11, fontWeight: 700 }}>
            <ShieldCheck size={11} color={C.emeraldLight} /> SSL automatique
          </div>
          <div className="pill" style={{ background: 'rgba(255,250,240,.15)', color: C.cream, border: `1px solid ${C.emeraldLight}40`, fontSize: 11, fontWeight: 700 }}>
            <Mail size={11} color={C.emeraldLight} /> Emails @ton-domaine
          </div>
          <div className="pill" style={{ background: 'rgba(255,250,240,.15)', color: C.cream, border: `1px solid ${C.emeraldLight}40`, fontSize: 11, fontWeight: 700 }}>
            <Zap size={11} color={C.emeraldLight} /> DNS guidé étape par étape
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Primary domain cards (subdomain + custom) ─────────────────────────────────
function DomainsPrimary({ subdomain, customDomain, customStatus, publicUrl }: { subdomain: string; customDomain?: string; customStatus?: string; publicUrl?: string }) {
  const visitTarget = publicUrl ?? (customDomain ? `https://${customDomain}` : `https://${subdomain}`);
  const isActive = customStatus === 'active';
  return (
    <div className="dom-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {/* Subdomain (free) */}
      <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: `1.5px solid ${C.cyan}40`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${C.cyan}, ${C.cyanDeep})` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.cyanSoft, color: C.cyanDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cloud size={22} />
          </div>
          <span className="pill" style={{ background: C.cyanSoft, color: C.cyanDeep, fontWeight: 800, fontSize: 9 }}>GRATUIT · INCLUS</span>
        </div>
        <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.cyanDeep, letterSpacing: '0.08em', marginBottom: 4 }}>SOUS-DOMAINE ORLODE</div>
        <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 12, wordBreak: 'break-all' }}>{subdomain}</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDark, fontSize: 9, fontWeight: 700 }}>
            <CheckCircle2 size={10} /> SSL actif
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <a href={visitTarget} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', flex: 1 }}>
            <button className="btn-secondary" style={{ width: '100%', padding: '8px 12px', fontSize: 11, justifyContent: 'center' }}>
              <ExternalLink size={11} /> Visiter ma page publique
            </button>
          </a>
          <button onClick={() => { navigator.clipboard.writeText(visitTarget); toast.success('Lien copié'); }} className="btn-secondary" style={{ padding: '8px 12px', fontSize: 11 }}>
            <Copy size={11} />
          </button>
        </div>
      </div>

      {/* Custom domain */}
      <div style={{ background: customDomain ? `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})` : C.cream, color: customDomain ? C.cream : C.ink, borderRadius: 18, padding: 18, border: customDomain ? `1.5px solid ${C.emeraldLight}40` : `1.5px dashed ${C.emerald}40`, position: 'relative', overflow: 'hidden', boxShadow: customDomain ? `0 14px 40px -14px ${C.emerald}` : 'none' }}>
        {customDomain && <div className="grain" />}
        {customDomain && <div className="slow-rotate" style={{ position: 'absolute', top: -80, right: -80, width: 200, height: 200, borderRadius: '50%', border: `1px dashed ${C.emeraldLight}40` }} />}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: customDomain ? 'rgba(255,250,240,.18)' : C.emeraldSoft, border: customDomain ? `1.5px solid ${C.cream}30` : 'none', color: customDomain ? C.cream : C.emeraldDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={22} />
            </div>
            {customDomain && (
              <div style={{ display: 'flex', gap: 4 }}>
                <span className="pill" style={{ background: C.goldLight, color: C.goldDeep, fontWeight: 800, fontSize: 9 }}>
                  <Crown size={10} /> BUSINESS
                </span>
                <span className="pill" style={{ background: 'rgba(255,250,240,.18)', color: C.cream, border: `1px solid ${C.cream}30`, fontWeight: 800, fontSize: 9 }}>
                  {isActive ? <><span className="live-dot" style={{ width: 5, height: 5 }} /> ACTIF</> : <>⏳ {customStatus?.toUpperCase() ?? 'EN ATTENTE'}</>}
                </span>
              </div>
            )}
          </div>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: customDomain ? C.emeraldLight : C.inkSoft, letterSpacing: '0.08em', marginBottom: 4 }}>DOMAINE PERSONNALISÉ</div>
          {customDomain ? (
            <>
              <div className="display-font" style={{ fontSize: 26, fontWeight: 800, color: C.cream, marginBottom: 4, wordBreak: 'break-all' }}>
                <em style={{ fontStyle: 'italic', color: C.goldLight }}>{customDomain}</em>
              </div>
              <div style={{ fontSize: 11, opacity: .85, marginBottom: 14 }}>SSL Let's Encrypt · DNS guidé · 100% propriété</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <a href={`https://${customDomain}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', flex: 1 }}>
                  <button className="btn-gold" style={{ width: '100%', padding: '10px 14px', justifyContent: 'center', fontSize: 12 }}>
                    <ExternalLink size={12} /> Visiter {customDomain}
                  </button>
                </a>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 12px', lineHeight: 1.5 }}>
                Connecte ton propre <strong>chezmalou.ci</strong> ou <strong>chezmalou.com</strong> au lieu d'un sous-domaine.
              </p>
              <button onClick={() => document.getElementById('add-domain')?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <Plus size={13} /> Ajouter un domaine
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DNS Config (read-only display + real verify) ──────────────────────────────
function DNSConfig({ domain, isCustom }: { domain: string; isCustom: boolean }) {
  const records = useMemo(() => dnsRecordsFor(domain), [domain]);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const verify = async () => {
    if (!isCustom) { toast.info('Le sous-domaine Orlode est déjà actif — aucune vérification nécessaire.'); return; }
    setVerifying(true);
    try {
      const r: any = await api.get(`/company/domain/verify?domain=${encodeURIComponent(domain)}`);
      const data: VerifyResult = r?.data?.data ?? r?.data;
      setResult(data);
      if (data.verified) toast.success('Domaine vérifié !', 'Les DNS pointent bien sur Firebase Hosting.');
      else toast.info('DNS pas encore propagé', data.nextStep);
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message ?? 'Vérification impossible.');
    } finally { setVerifying(false); }
  };

  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: '1px solid rgba(31,41,55,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.cyanDeep, letterSpacing: '0.08em', marginBottom: 2 }}>CONFIGURATION DNS</div>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
            Enregistrements <em style={{ fontStyle: 'italic', color: C.cyan }}>{domain || '(aucun domaine)'}</em>
          </h3>
        </div>
        {isCustom && (
          <button onClick={verify} disabled={verifying} className="btn-secondary" style={{ padding: '7px 12px', fontSize: 11, opacity: verifying ? 0.6 : 1 }}>
            <RefreshCw size={11} className={verifying ? 'slow-rotate' : ''} /> {verifying ? 'Vérification…' : 'Vérifier DNS'}
          </button>
        )}
      </div>

      <div style={{ background: C.creamDeep, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(31,41,55,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 90px 1fr 70px 80px', padding: '8px 14px', background: 'rgba(31,41,55,.04)', fontSize: 9, fontWeight: 800, color: C.inkSoft, letterSpacing: '0.05em' }}>
          <div>TYPE</div><div>NOM</div><div>VALEUR</div><div>TTL</div><div>STATUS</div>
        </div>
        {records.map((r, i) => {
          const aMatch = result && r.type === 'A' && result.aRecords.includes(r.value);
          const cnameMatch = result && r.type === 'CNAME' && result.cnames.includes(r.value);
          const propagated = aMatch || cnameMatch;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 90px 1fr 70px 80px', padding: '10px 14px', borderTop: '1px solid rgba(31,41,55,.05)', fontSize: 11, alignItems: 'center' }}>
              <div>
                <span className="mono-font" style={{
                  background: r.type === 'A' ? C.emeraldSoft : C.violetSoft,
                  color: r.type === 'A' ? C.emeraldDark : C.violetDeep,
                  padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 800,
                }}>{r.type}</span>
              </div>
              <div className="mono-font" style={{ color: C.ink, fontWeight: 700 }}>{r.name}</div>
              <div className="mono-font" style={{ color: C.inkSoft, fontSize: 10, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1 }}>{r.value}</span>
                <button onClick={() => { navigator.clipboard.writeText(r.value); toast.success('Copié'); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkLight }}>
                  <Copy size={11} />
                </button>
              </div>
              <div className="mono-font" style={{ color: C.inkLight, fontSize: 10 }}>{r.ttl}</div>
              <div>
                {!result ? (
                  <span className="pill" style={{ background: C.creamDeep, color: C.inkLight, fontSize: 8, fontWeight: 800 }}>? À vérifier</span>
                ) : propagated ? (
                  <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDark, fontSize: 8, fontWeight: 800 }}>✓ Propagé</span>
                ) : (
                  <span className="pill" style={{ background: C.yellowSoft, color: C.goldDeep, fontSize: 8, fontWeight: 800 }}>⏳ En attente</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {result && (
        <div style={{ marginTop: 12, padding: 12, background: result.verified ? C.emeraldSoft : C.yellowSoft, border: `1px solid ${result.verified ? C.emerald : C.yellow}40`, borderRadius: 11 }}>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: result.verified ? C.emeraldDark : C.goldDeep, letterSpacing: '0.05em', marginBottom: 4 }}>
            {result.verified ? '✓ DOMAINE VÉRIFIÉ' : '⏳ DNS EN COURS DE PROPAGATION'}
          </div>
          <p style={{ fontSize: 11, color: result.verified ? C.emeraldDark : C.goldDeep, margin: 0, lineHeight: 1.5 }}>
            {result.nextStep}
          </p>
          {result.aRecords.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: C.inkSoft, fontFamily: 'JetBrains Mono, monospace' }}>
              Actuel : A → {result.aRecords.join(', ') || '(aucun)'}{result.cnames.length > 0 && ` · CNAME → ${result.cnames.join(', ')}`}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, padding: 12, background: `linear-gradient(135deg, ${C.violetSoft}, ${C.creamWarm})`, border: `1px solid ${C.violet}30`, borderRadius: 11 }}>
        <div className="mono-font" style={{ fontSize: 9, fontWeight: 800, color: C.violetDeep, letterSpacing: '0.05em', marginBottom: 4 }}>📋 ÉTAPES À SUIVRE</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 11, color: C.violetDeep, lineHeight: 1.7 }}>
          <li>Va chez ton registrar (OVH / GoDaddy / Hostinger / Namecheap).</li>
          <li>Ajoute le record <strong>A → {FIREBASE_HOSTING_IP}</strong> (ou CNAME → <strong>{FIREBASE_HOSTING_CNAME}</strong>).</li>
          <li>Reviens ici et clique <strong>Vérifier DNS</strong> — la propagation prend 5min à 24h.</li>
          <li>Une fois vérifié, on finalise côté Firebase (SSL automatique sous 24h).</li>
        </ol>
      </div>
    </div>
  );
}

// ── Add-domain wizard (3 steps inline) ────────────────────────────────────────
function AddDomainStepper({ initialDomain, onSaved }: { initialDomain?: string; onSaved: (domain: string) => void }) {
  const [step, setStep] = useState(initialDomain ? 2 : 1);
  const [input, setInput] = useState(initialDomain ?? '');
  const [saving, setSaving] = useState(false);

  const looksLikeDomain = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(input.trim());

  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; aRecords: string[]; cnames: string[]; nextStep: string } | null>(null);

  async function saveDomain() {
    if (!looksLikeDomain) { toast.error('Domaine invalide', 'Format attendu : mondomaine.ci'); return; }
    setSaving(true);
    try {
      await api.patch('/company', { customDomain: input.trim().toLowerCase(), customStatus: 'verifying' });
      toast.success('Domaine enregistré', 'Configure maintenant tes DNS.');
      onSaved(input.trim().toLowerCase());
      setStep(2);
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message ?? 'Sauvegarde impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function verifyDomain() {
    setSaving(true);
    try {
      const r: any = await api.get(`/company/domain/verify?domain=${encodeURIComponent(input.trim().toLowerCase())}`);
      const data = r?.data?.data ?? r?.data;
      setVerifyResult(data);
      if (data.verified) {
        toast.success('DNS propagé !', 'Domaine vérifié.');
        setStep(3);
      } else {
        toast.info('DNS pas encore propagé', data.nextStep);
      }
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message ?? 'Vérification impossible.');
    } finally { setSaving(false); }
  }

  return (
    <div id="add-domain" style={{ background: C.cream, borderRadius: 18, padding: 18, border: `1.5px solid ${C.emerald}30` }}>
      <div style={{ marginBottom: 16 }}>
        <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.emeraldDeep, letterSpacing: '0.08em', marginBottom: 2 }}>AJOUTER UN DOMAINE</div>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
          Connecte ton <em style={{ fontStyle: 'italic', color: C.emerald }}>propre domaine</em> en 3 étapes
        </h3>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            flex: 1, height: 4,
            background: s <= step ? `linear-gradient(90deg, ${C.emerald}, ${C.emeraldDeep})` : C.creamDeep,
            borderRadius: 100,
          }} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`, color: C.cream, fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif' }}>1</div>
            <h4 className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>Entre ton domaine</h4>
          </div>
          <div style={{ background: C.creamDeep, border: `1.5px solid ${C.emerald}30`, borderRadius: 11, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Globe size={16} color={C.emeraldDeep} />
            <input
              value={input} onChange={e => setInput(e.target.value.toLowerCase())}
              placeholder="Ex: chezmalou.ci"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: C.ink, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
            />
          </div>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 14px', lineHeight: 1.5 }}>
            Déjà acheté ailleurs (OVH, GoDaddy, Hostinger…) ? Pas de souci, on le branche à Orlode.
          </p>
          <button onClick={saveDomain} disabled={!looksLikeDomain || saving} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: looksLikeDomain ? 1 : 0.5, cursor: looksLikeDomain ? 'pointer' : 'not-allowed' }}>
            {saving ? <RefreshCw size={13} className="slow-rotate" /> : <ArrowRight size={13} />} Enregistrer et continuer
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`, color: C.cream, fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif' }}>2</div>
            <h4 className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>Configure les DNS chez ton registrar</h4>
          </div>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 10px', lineHeight: 1.5 }}>
            Va chez ton registrar et ajoute ces enregistrements pour <strong className="mono-font">{input}</strong> :
          </p>
          <div style={{ background: C.creamDeep, borderRadius: 11, overflow: 'hidden', border: '1px solid rgba(31,41,55,.08)', marginBottom: 12 }}>
            {dnsRecordsFor(input).slice(0, 3).map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 70px 1fr 32px', padding: '10px 14px', borderTop: i > 0 ? '1px solid rgba(31,41,55,.05)' : 'none', fontSize: 11, alignItems: 'center', gap: 6 }}>
                <span className="mono-font" style={{ background: r.type === 'A' ? C.emeraldSoft : C.violetSoft, color: r.type === 'A' ? C.emeraldDark : C.violetDeep, padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 800, textAlign: 'center' }}>{r.type}</span>
                <span className="mono-font" style={{ color: C.ink, fontWeight: 700 }}>{r.name}</span>
                <span className="mono-font" style={{ color: C.inkSoft, fontSize: 10, wordBreak: 'break-all' }}>{r.value}</span>
                <button onClick={() => { navigator.clipboard.writeText(r.value); toast.success('Copié'); }} className="icon-btn-ghost"><Copy size={11} /></button>
              </div>
            ))}
          </div>
          <div style={{ background: C.yellowSoft, border: `1px solid ${C.yellow}40`, borderRadius: 10, padding: 10, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.goldDeep }}>
            <Info size={14} color={C.goldDeep} />
            <span><strong>Propagation DNS</strong> : 5 minutes à 24h selon ton registrar</span>
          </div>
          {verifyResult && !verifyResult.verified && (
            <div style={{ background: C.yellowSoft, border: `1px solid ${C.yellow}40`, borderRadius: 10, padding: 10, marginBottom: 10, fontSize: 11, color: C.goldDeep }}>
              <strong>⏳ DNS pas encore propagé.</strong> {verifyResult.nextStep}<br />
              <span style={{ opacity: .85, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                Lookup actuel : A → {verifyResult.aRecords.join(', ') || '(aucun)'}{verifyResult.cnames.length > 0 && ` · CNAME → ${verifyResult.cnames.join(', ')}`}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setStep(1)} className="btn-secondary" style={{ padding: '10px 14px', fontSize: 12 }}>
              <ChevronLeft size={12} /> Retour
            </button>
            <button onClick={verifyDomain} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', opacity: saving ? 0.6 : 1 }}>
              {saving ? <RefreshCw size={13} className="slow-rotate" /> : <CheckCircle2 size={13} />} {saving ? 'Vérification…' : 'Vérifier les DNS maintenant'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: `0 14px 30px -8px ${C.emerald}` }}>
            <CheckCircle2 size={36} strokeWidth={2.5} />
          </div>
          <h4 className="display-font" style={{ fontSize: 20, fontWeight: 800, color: C.ink, margin: '0 0 6px' }}>
            Domaine <em style={{ fontStyle: 'italic', color: C.emerald }}>enregistré</em> !
          </h4>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 14px' }}>SSL en cours d'installation · Visible dans ~5 minutes</p>
          <div style={{ background: C.emeraldSoft, border: `1px solid ${C.emerald}40`, borderRadius: 11, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.emeraldDark }}><CheckCircle2 size={12} /> Domaine sauvegardé sur ta company</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.emeraldDark }}><RefreshCw size={12} className="slow-rotate" /> Propagation DNS en cours</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pro emails ────────────────────────────────────────────────────────────────
function ProEmailsSection({ customDomain, emails, onSave }: { customDomain?: string; emails: ProEmail[]; onSave: (next: ProEmail[]) => Promise<void> }) {
  const [local, setLocal] = useState(emails);
  const [adding, setAdding] = useState(false);
  const [newLocal, setNewLocal] = useState('hello');
  const [newForward, setNewForward] = useState('');
  useEffect(() => setLocal(emails), [emails]);

  const add = async () => {
    if (!customDomain) { toast.error('Domaine requis', "Ajoute d'abord ton domaine personnalisé."); return; }
    if (!newLocal.trim() || !newForward.trim()) { toast.error('Champs requis'); return; }
    const next = [...local, { email: `${newLocal.trim()}@${customDomain}`, forward: newForward.trim(), active: true }];
    await onSave(next);
    setNewLocal('hello'); setNewForward(''); setAdding(false);
  };

  const remove = async (i: number) => {
    if (!confirm(`Supprimer ${local[i].email} ?`)) return;
    const next = local.filter((_, idx) => idx !== i);
    await onSave(next);
  };

  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: '1px solid rgba(31,41,55,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.goldDeep, letterSpacing: '0.08em', marginBottom: 2 }}>EMAILS PROFESSIONNELS</div>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
            <em style={{ fontStyle: 'italic', color: C.goldDeep }}>@{customDomain ?? 'ton-domaine.tld'}</em>
          </h3>
        </div>
        <button onClick={() => setAdding(true)} disabled={!customDomain} className="btn-gold" style={{ padding: '8px 14px', fontSize: 12, opacity: customDomain ? 1 : 0.5, cursor: customDomain ? 'pointer' : 'not-allowed' }}>
          <Plus size={12} /> Nouvel email
        </button>
      </div>

      {!customDomain && (
        <div style={{ padding: 16, background: C.creamDeep, borderRadius: 11, border: '1px dashed rgba(31,41,55,.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} color={C.inkSoft} />
          <p style={{ fontSize: 12, color: C.inkSoft, margin: 0, lineHeight: 1.5 }}>
            Ajoute d'abord un domaine personnalisé ci-dessus pour activer les emails pro.
          </p>
        </div>
      )}

      {adding && (
        <div style={{ background: C.goldSoft, border: `1px solid ${C.gold}40`, borderRadius: 11, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.goldDeep, marginBottom: 4, display: 'block' }}>NOUVEL ALIAS</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input value={newLocal} onChange={e => setNewLocal(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} placeholder="hello" style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.gold}30`, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, outline: 'none' }} />
                <span style={{ fontSize: 12, color: C.goldDeep, fontFamily: 'JetBrains Mono, monospace' }}>@{customDomain}</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.goldDeep, marginBottom: 4, display: 'block' }}>FORWARD VERS</label>
              <input value={newForward} onChange={e => setNewForward(e.target.value)} placeholder="moi@gmail.com" type="email" style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.gold}30`, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, outline: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdding(false)} className="btn-secondary" style={{ padding: '7px 12px', fontSize: 11 }}>Annuler</button>
            <button onClick={add} className="btn-gold" style={{ padding: '7px 14px', fontSize: 11 }}><Plus size={11} /> Ajouter</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {local.length === 0 && !adding && customDomain && (
          <div style={{ padding: 18, textAlign: 'center', background: C.creamDeep, borderRadius: 11, border: '1px dashed rgba(31,41,55,.15)' }}>
            <Inbox size={28} color={C.inkLight} style={{ marginBottom: 6 }} />
            <p style={{ fontSize: 12, color: C.inkSoft, margin: 0 }}>
              Aucun email pro pour l'instant. Ajoute <strong>hello@{customDomain}</strong>, <strong>contact@…</strong>, etc.
            </p>
          </div>
        )}
        {local.map((e, i) => (
          <div key={i} style={{ background: C.creamDeep, border: `1px solid ${C.gold}25`, borderLeft: `4px solid ${C.gold}`, borderRadius: 11, padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: C.goldSoft, color: C.goldDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AtSign size={16} /></div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="display-font mono-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{e.email}</div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ArrowRight size={10} /> Forward vers <strong className="mono-font" style={{ color: C.ink }}>{e.forward}</strong>
              </div>
            </div>
            <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDark, fontSize: 9, fontWeight: 800 }}>
              <span className="live-dot" style={{ width: 5, height: 5 }} /> Actif
            </span>
            <button onClick={() => remove(i)} className="icon-btn-ghost" style={{ width: 30, height: 30 }}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>

      {customDomain && local.length > 0 && (
        <div style={{ marginTop: 12, padding: 12, background: C.creamDeep, borderRadius: 11, border: '1px dashed rgba(31,41,55,.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Inbox size={16} color={C.inkSoft} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>Boîte unifiée</div>
            <p style={{ fontSize: 10, color: C.inkSoft, margin: 0, lineHeight: 1.4 }}>
              Tous tes emails @{customDomain} sont forwardés vers les adresses ci-dessus. Tu peux aussi répondre depuis Orlode.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Domain marketplace (UI only — no registrar integration yet) ───────────────
function DomainMarketplace({ baseSlug }: { baseSlug: string }) {
  const [searchTerm, setSearchTerm] = useState(baseSlug);
  const suggestions = useMemo(() => {
    const s = (searchTerm || baseSlug).toLowerCase().replace(/[^a-z0-9]/g, '');
    return [
      { name: `${s}.com`,   price: 12000, popular: true },
      { name: `${s}.africa`, price: 18000, popular: false },
      { name: `${s}.shop`,  price: 22000, popular: false },
      { name: `${s}.ci`,    price: 8500,  popular: true },
      { name: `${s}.app`,   price: 16000, popular: false },
    ];
  }, [searchTerm, baseSlug]);

  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: '1px solid rgba(31,41,55,.06)' }}>
      <div style={{ marginBottom: 14 }}>
        <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.violetDeep, letterSpacing: '0.08em', marginBottom: 2 }}>MARKETPLACE DOMAINES</div>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
          Trouve & achète d'<em style={{ fontStyle: 'italic', color: C.violet }}>autres domaines</em>
        </h3>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
          Possède plusieurs domaines (.com, .africa, .ci…) qui pointent tous vers ton site.
        </p>
      </div>

      <div style={{ background: `linear-gradient(135deg, ${C.violetSoft}, ${C.creamWarm})`, border: `1.5px solid ${C.violet}40`, borderRadius: 12, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Search size={16} color={C.violetDeep} />
        <input
          value={searchTerm} onChange={e => setSearchTerm(e.target.value.toLowerCase())}
          placeholder="Tape le nom que tu cherches..."
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: C.ink, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {suggestions.map((d, i) => (
          <div key={i} style={{ background: C.creamDeep, border: '1px solid rgba(31,41,55,.08)', borderRadius: 11, padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.violetSoft, color: C.violetDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Globe size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="display-font mono-font" style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{d.name}</span>
                {d.popular && (<span className="pill" style={{ background: C.coralDeep, color: C.cream, fontSize: 8, fontWeight: 800 }}>🔥 POPULAIRE</span>)}
              </div>
              <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>Disponible · Renouvellement automatique</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="display-font mono-font" style={{ fontSize: 14, fontWeight: 800, color: C.violetDeep }}>
                {(d.price / 1000).toFixed(0)}k <span style={{ fontSize: 10, color: C.inkLight, fontWeight: 600 }}>FCFA/an</span>
              </div>
            </div>
            <button onClick={() => toast.info('Bientôt', 'Achat de domaine via Orlode en cours de raccordement aux registrars.')} className="btn-secondary" style={{ padding: '8px 12px', fontSize: 11 }}>
              <Plus size={11} /> Acheter
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, padding: 10, background: C.creamDeep, borderRadius: 10, fontSize: 10, color: C.inkSoft, fontStyle: 'italic', textAlign: 'center' }}>
        💡 <strong>Astuce :</strong> posséder <em>.com</em>, <em>.ci</em> et <em>.africa</em> empêche les concurrents de capturer ta marque.
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DomainPage() {
  const company = useAuthStore(s => s.company);
  const [domain, setDomain] = useState<DomainSettings>({});
  const [firstStore, setFirstStore] = useState<{ slug?: string; businessType?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const companyName = company?.name ?? '';
  const baseSlug = useMemo(() => slugify(companyName || 'tonentreprise'), [companyName]);
  // Use Firebase's actual web.app subdomain — this works today, no DNS needed.
  const subdomain = `${baseSlug}.web.app`;

  // The real public URL for the company's main pack page. Falls back to the
  // /shop/ slug if no business type is detected.
  const publicUrl = useMemo(() => {
    const slug = firstStore?.slug;
    if (!slug) return undefined;
    const path = PUBLIC_PATH[firstStore?.businessType ?? 'boutique'] ?? 'shop';
    const host = (typeof window !== 'undefined') ? window.location.origin : 'https://orlode.com';
    return `${host}/${path}/${slug}`;
  }, [firstStore]);

  const refetch = async () => {
    setLoading(true);
    try {
      const [companyRes, storesRes] = await Promise.all([
        api.get('/company').catch(() => null),
        api.get('/commerce/stores').catch(() => null),
      ]);
      const data = (companyRes as any)?.data?.data ?? (companyRes as any)?.data ?? {};
      setDomain({
        customDomain: data.customDomain ?? undefined,
        customStatus: data.customStatus ?? undefined,
        proEmails: Array.isArray(data.proEmails) ? data.proEmails : [],
      });
      const stores = (storesRes as any)?.data?.data ?? (storesRes as any)?.data ?? [];
      if (Array.isArray(stores) && stores[0]) {
        setFirstStore({ slug: stores[0].slug, businessType: stores[0].businessType });
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { refetch(); }, []);

  const updateProEmails = async (next: ProEmail[]) => {
    try {
      await api.patch('/company', { proEmails: next });
      setDomain(d => ({ ...d, proEmails: next }));
      toast.success('Emails mis à jour');
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message ?? '');
    }
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="dom-page">
        <DomainHero subdomain={subdomain} customDomain={domain.customDomain} publicUrl={publicUrl} />
        <DomainsPrimary subdomain={subdomain} customDomain={domain.customDomain} customStatus={domain.customStatus} publicUrl={publicUrl} />

        <div className="dom-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}>
          <DNSConfig domain={domain.customDomain ?? subdomain} isCustom={!!domain.customDomain} />
          <AddDomainStepper initialDomain={domain.customDomain} onSaved={d => setDomain(s => ({ ...s, customDomain: d, customStatus: 'verifying' }))} />
        </div>

        <div className="dom-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 14 }}>
          <ProEmailsSection customDomain={domain.customDomain} emails={domain.proEmails ?? []} onSave={updateProEmails} />
          <DomainMarketplace baseSlug={baseSlug} />
        </div>

        {loading && (
          <div style={{ position: 'fixed', bottom: 16, right: 16, padding: '8px 14px', background: C.cream, borderRadius: 10, boxShadow: '0 8px 30px -8px rgba(0,0,0,.15)', fontSize: 12, color: C.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={12} className="slow-rotate" /> Chargement…
          </div>
        )}
      </div>
    </>
  );
}
