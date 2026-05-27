/**
 * 🧠 Cerveau de l'entreprise — Une page unique où le commerçant nourrit l'IA :
 *  identité · données · connecteurs · comportement.
 *
 * Pitch : "Donne-moi tes infos → ton IA fonctionne."
 *
 * Modes :
 *   /admin/brain   → mode édition (toutes sections expandables)
 *   /setup/brain   → mode wizard (étape par étape, 4 steps)
 *
 * Progress bar "Cerveau IA : X% rempli" pousse à finir.
 */
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/services/firebase';
import {
  Brain, Building2, FileText, Plug, Sparkles, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, Loader2, Upload, Globe, X, Save, Sliders,
  ArrowRight, ArrowLeft, MessageCircle, Mail, Database, Link2, Trash2,
  Camera, BadgeCheck, Cpu, Clock, RefreshCw,
} from 'lucide-react';

const C = {
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  emerald:     '#10B981',
  emeraldDeep: '#059669',
  emeraldSoft: '#D1FAE5',
  cyan:        '#06B6D4',
  cyanDeep:    '#0891B2',
  cyanSoft:    '#CFFAFE',
  violet:      '#7C3AED',
  violetDeep:  '#5B21B6',
  violetSoft:  '#EDE9FE',
  pink:        '#EC4899',
  pinkSoft:    '#FCE7F3',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  onGreenSoft: '#A8C9B8',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font { font-family: 'JetBrains Mono', monospace; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .pulse { animation: pulse 1.5s ease-in-out infinite; }
  @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .stagger > * { animation: slideIn .3s ease-out backwards; }
  .stagger > *:nth-child(1){animation-delay:.04s}.stagger > *:nth-child(2){animation-delay:.08s}
  .stagger > *:nth-child(3){animation-delay:.12s}.stagger > *:nth-child(4){animation-delay:.16s}
  .grain::before {
    content:''; position:absolute; inset:0;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity:.06; pointer-events:none; mix-blend-mode:overlay;
  }
  .btn-emerald {
    background: linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep});
    color: ${C.cream}; border:none;
    padding: 11px 20px; border-radius: 11px;
    font-weight: 700; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    box-shadow: 0 8px 20px -6px ${C.emerald};
    font-family: inherit;
  }
  .btn-ghost {
    background: rgba(10,42,32,0.04); color: ${C.ink};
    border: 1.5px solid rgba(10,42,32,0.1);
    padding: 9px 16px; border-radius: 10px;
    font-weight: 600; font-size: 12px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    font-family: inherit;
  }
  .input {
    width: 100%; padding: 10px 14px; border-radius: 10px;
    border: 1.5px solid rgba(10,42,32,0.1);
    background: ${C.cream}; font-size: 14px; color: ${C.ink};
    font-family: inherit; outline: none;
  }
  .label {
    display:flex; align-items:center; gap:6px;
    font-size: 11px; font-weight: 700; letter-spacing: '0.05em';
    color: ${C.ink}; text-transform: uppercase; margin-bottom: 6px;
  }
`;

interface SectionStatus {
  key: 'identity' | 'data' | 'connectors' | 'behavior';
  filled: number;   // 0..1
  hint: string;
}

export default function BrainPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { company, setCompany } = useAuthStore();
  const wizardMode = searchParams.get('wizard') === '1' || window.location.pathname.includes('/setup/brain');
  const [step, setStep] = useState(1); // wizard step 1-4
  const [openSection, setOpenSection] = useState<SectionStatus['key'] | null>(wizardMode ? 'identity' : 'identity');

  // Section states
  const [identity, setIdentity] = useState<any>(company ?? {});
  const [identitySaving, setIdentitySaving] = useState(false);
  const [businessType, setBusinessType] = useState<string>(
    ((company as any)?.settings?.businessType ?? (company as any)?.businessType) ?? ''
  );
  const [behavior, setBehavior] = useState<any>(company?.settings ?? {});
  const [behaviorSaving, setBehaviorSaving] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [connectorStats, setConnectorStats] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (company) {
      setIdentity(company);
      setBehavior((company as any).settings ?? {});
      const bt = (company as any)?.settings?.businessType ?? (company as any)?.businessType ?? '';
      if (bt) setBusinessType(bt);
    }
  }, [company]);

  // Load data documents + connectors stats
  const refreshAll = useCallback(async () => {
    setDocsLoading(true);
    try {
      const r: any = await api.get('/data/documents');
      setDocs(r?.data?.documents ?? r?.data ?? []);
    } catch { /* non-blocking */ }
    finally { setDocsLoading(false); }
    try {
      const r: any = await api.get('/connectors');
      setConnectorStats(r?.data ?? r);
    } catch { /* non-blocking */ }
  }, []);
  useEffect(() => { refreshAll(); }, [refreshAll]);

  // ── Compute brain "filled %" ──────────────────────────────────────────────
  const sections: SectionStatus[] = useMemo(() => {
    const idFields = ['name', 'website', 'phone', 'email', 'address', 'sector'];
    const idFilled = idFields.filter(f => (identity?.[f] ?? '').toString().trim().length > 0).length / idFields.length;

    const dataFilled = Math.min(1, (docs.length > 0 ? 0.5 : 0) + (crawlUrl || (identity?.websiteCrawled) ? 0.5 : 0));

    const connFilled = (() => {
      const wa = !!connectorStats?.whatsapp?.connected || !!company?.['whatsappPhoneNumberId'];
      const gmail = !!connectorStats?.gmail?.connected;
      const drive = !!connectorStats?.googleDrive?.connected;
      const score = [wa, gmail, drive].filter(Boolean).length;
      return Math.min(1, score / 2); // ≥2 connecté = 100%
    })();

    const behavFields = ['language', 'aiPersonality'];
    const behavFilled = behavFields.filter(f => (behavior?.[f] ?? '').toString().trim().length > 0).length / behavFields.length;

    return [
      { key: 'identity',   filled: idFilled,    hint: 'Identité de l\'entreprise' },
      { key: 'data',       filled: dataFilled,  hint: 'Documents et site web' },
      { key: 'connectors', filled: connFilled,  hint: 'WhatsApp, Gmail, Drive…' },
      { key: 'behavior',   filled: behavFilled, hint: 'Ton, langue, personnalité' },
    ];
  }, [identity, docs, crawlUrl, connectorStats, behavior, company]);

  const overallFilled = Math.round(sections.reduce((s, x) => s + x.filled, 0) / sections.length * 100);

  // ── Save handlers ─────────────────────────────────────────────────────────
  const saveIdentity = async () => {
    setIdentitySaving(true);
    try {
      const payload = {
        name: identity.name, website: identity.website, sector: identity.sector,
        address: identity.address, city: identity.city, country: identity.country,
        phone: identity.phone, email: identity.email, taxId: identity.taxId,
        // PWA personalization — manifest at /api/manifest/:companyId reads
        // pwaLogoUrl (preferred) → logoUrl → Orlode default, and primaryColor
        // → theme_color.
        logoUrl: identity.logoUrl, pwaLogoUrl: identity.pwaLogoUrl, primaryColor: identity.primaryColor,
        // businessType lives in settings so it's available wherever we read settings
        settings: {
          ...((company as any)?.settings ?? {}),
          ...(businessType ? { businessType } : {}),
        },
      };
      const r: any = await api.patch('/company', payload);
      const updated = r?.data?.company ?? { ...company, ...payload };
      setCompany(updated as any);
      toast.success('Identité enregistrée', 'Ton IA en sait plus sur toi.');
    } catch (e: any) {
      toast.error('Sauvegarde impossible', e?.response?.data?.message ?? 'Réessaie.');
    } finally {
      setIdentitySaving(false);
    }
  };

  const saveBehavior = async () => {
    setBehaviorSaving(true);
    try {
      const payload = {
        settings: {
          ...((company as any)?.settings ?? {}),
          language: behavior.language,
          aiPersonality: behavior.aiPersonality,
          aiLanguage: behavior.aiLanguage ?? behavior.language,
          aiProvider: behavior.aiProvider,
          aiTone: behavior.aiTone,
        },
      };
      const r: any = await api.patch('/company', payload);
      const updated = r?.data?.company ?? { ...company, ...payload };
      setCompany(updated as any);
      toast.success('Comportement IA enregistré', 'Ton agent a ce style maintenant.');
    } catch (e: any) {
      toast.error('Sauvegarde impossible', e?.response?.data?.message ?? 'Réessaie.');
    } finally {
      setBehaviorSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Fichier trop lourd', 'Max 25 Mo.');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post('/data/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document ajouté', `${file.name} indexé pour ton IA.`);
      refreshAll();
    } catch (e: any) {
      toast.error('Upload impossible', e?.response?.data?.message ?? 'Réessaie.');
    }
  };

  const handleCrawl = async () => {
    if (!crawlUrl.trim()) return;
    setCrawling(true);
    try {
      await api.post('/connectors/web/crawl', {
        siteUrl: crawlUrl.trim(),
        crawlDepth: 2, maxPages: 30,
      });
      toast.success('Crawl lancé', 'L\'IA explore ton site, ça prend ~2-5 min.');
      setCrawlUrl('');
      refreshAll();
    } catch (e: any) {
      toast.error('Crawl impossible', e?.response?.data?.message ?? 'Réessaie.');
    } finally {
      setCrawling(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>

      {/* Hero */}
      <div style={{ padding: '32px 32px 0' }}>
        <div className="grain" style={{
          background: `linear-gradient(135deg, ${C.violet}, ${C.violetDeep} 60%, ${C.greenDeep})`,
          borderRadius: 24, padding: '32px 36px',
          position: 'relative', overflow: 'hidden',
          color: C.cream,
          boxShadow: `0 30px 60px -20px ${C.violet}80`,
        }}>
          <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="320" height="320" viewBox="0 0 320 320">
            <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="160" cy="160" r="60" stroke={C.cream} strokeWidth="2" fill="none" />
          </svg>
          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Brain size={32} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 100,
                background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                marginBottom: 12,
              }}>
                <Sparkles size={10} /> {wizardMode ? `Étape ${step} sur 4` : 'Cerveau de l\'entreprise'}
              </div>
              <h1 className="display-font" style={{
                fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, margin: 0, lineHeight: 1.05,
                letterSpacing: '-0.03em',
              }}>
                {wizardMode
                  ? 'Configure ton IA en 5 minutes'
                  : <>Nourris le <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanSoft }}>cerveau de ton IA</em></>}
              </h1>
              <p style={{ marginTop: 8, fontSize: 13, opacity: 0.9, maxWidth: 580 }}>
                Plus tu remplis, plus ton IA est précise pour répondre, vendre, gérer.
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ position: 'relative', marginTop: 22 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
              marginBottom: 8, textTransform: 'uppercase', opacity: 0.95,
            }}>
              <span>🧠 Cerveau IA rempli</span>
              <span className="mono-font" style={{ fontSize: 16, fontWeight: 800 }}>{overallFilled}%</span>
            </div>
            <div style={{
              height: 10, borderRadius: 100,
              background: 'rgba(255,250,240,0.15)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${overallFilled}%`,
                background: overallFilled >= 75
                  ? `linear-gradient(90deg, ${C.emerald}, ${C.cyan})`
                  : overallFilled >= 40
                    ? `linear-gradient(90deg, ${C.yellow}, ${C.emerald})`
                    : `linear-gradient(90deg, ${C.red}, ${C.yellow})`,
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                borderRadius: 100,
              }} />
            </div>
            {overallFilled >= 100 && (
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> Bravo — ton IA est complètement opérationnelle 🎉
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div style={{ padding: '24px 32px 32px', maxWidth: 980, margin: '0 auto' }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* SECTION 1 — IDENTITÉ */}
          <SectionCard
            icon={<Building2 />}
            color={C.cyan} colorDeep={C.cyanDeep} soft={C.cyanSoft}
            title="Identité"
            subtitle="Qui es-tu ? Le minimum pour que ton IA parle de ton entreprise."
            filled={sections[0].filled}
            open={openSection === 'identity'}
            onToggle={() => setOpenSection(openSection === 'identity' ? null : 'identity')}
          >
            {/* Type d'activité — drives recommendations + which Skills to suggest */}
            <BusinessTypePicker
              value={businessType}
              onChange={setBusinessType}
              onActivate={(packId) => navigate(`/marketplace?pack=${packId}`)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 18 }}>
              <Field label="Nom de l'entreprise" required>
                <input className="input" value={identity.name ?? ''} onChange={e => setIdentity({ ...identity, name: e.target.value })} placeholder="Ex: OneLove Boutique" />
              </Field>
              <Field label="Site web">
                <input className="input" value={identity.website ?? ''} onChange={e => setIdentity({ ...identity, website: e.target.value })} placeholder="https://..." />
              </Field>
              <Field label="Secteur d'activité">
                <input className="input" value={identity.sector ?? ''} onChange={e => setIdentity({ ...identity, sector: e.target.value })} placeholder="Ex: Mode, Restaurant…" />
              </Field>
              <Field label="Téléphone">
                <input className="input" value={identity.phone ?? ''} onChange={e => setIdentity({ ...identity, phone: e.target.value })} placeholder="+225 XX XX XX XX" />
              </Field>
              <Field label="Email">
                <input className="input" type="email" value={identity.email ?? ''} onChange={e => setIdentity({ ...identity, email: e.target.value })} placeholder="contact@..." />
              </Field>
              <Field label="Adresse">
                <input className="input" value={identity.address ?? ''} onChange={e => setIdentity({ ...identity, address: e.target.value })} placeholder="Rue, quartier, ville" />
              </Field>
            </div>

            {/* PWA personalization — logo + brand color used by the per-company
                installable PWA (manifest.json). When a customer installs your
                business from a public page (/clone, /shop, /menu…), iOS/Android
                use these as the app icon + name on the home screen. */}
            <PWAIdentitySection
              companyId={(company as { id?: string } | null)?.id ?? user?.companyId ?? ''}
              pwaLogoUrl={identity.pwaLogoUrl ?? identity.logoUrl ?? ''}
              primaryColor={identity.primaryColor ?? '#0F5C3F'}
              companyName={identity.name ?? ''}
              onPWALogoChange={(url: string) => setIdentity({ ...identity, pwaLogoUrl: url })}
              onColorChange={(color: string) => setIdentity({ ...identity, primaryColor: color })}
            />

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveIdentity} disabled={identitySaving} className="btn-emerald">
                {identitySaving ? <><Loader2 size={14} className="spin" /> Sauvegarde…</> : <><Save size={14} /> Enregistrer</>}
              </button>
            </div>
          </SectionCard>

          {/* SECTION 2 — DONNÉES */}
          <SectionCard
            icon={<FileText />}
            color={C.violet} colorDeep={C.violetDeep} soft={C.violetSoft}
            title="Données"
            subtitle="Documents et contenu web. C'est la mémoire de ton IA — ce qu'elle peut citer."
            filled={sections[1].filled}
            open={openSection === 'data'}
            onToggle={() => setOpenSection(openSection === 'data' ? null : 'data')}
          >
            {/* Upload */}
            <div style={{ marginBottom: 14 }}>
              <div className="label"><Upload size={12} /> Upload de fichiers</div>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} style={{
                width: '100%', padding: '14px 18px', borderRadius: 12,
                background: C.creamDeep, color: C.violetDeep,
                border: `1.5px dashed ${C.violet}80`,
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Upload size={14} /> Glisse ou clique pour ajouter PDF / Word / Excel
              </button>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>Max 25 Mo par fichier · Formats : PDF, Word, Excel, CSV, TXT</div>
            </div>

            {/* Crawl URL */}
            <div style={{ marginBottom: 14 }}>
              <div className="label"><Globe size={12} /> Crawler ton site web</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  value={crawlUrl}
                  onChange={e => setCrawlUrl(e.target.value)}
                  placeholder="https://tonsite.com"
                  style={{ flex: 1 }}
                />
                <button onClick={handleCrawl} disabled={crawling || !crawlUrl.trim()} className="btn-emerald">
                  {crawling ? <><Loader2 size={14} className="spin" /> En cours…</> : <><RefreshCw size={14} /> Crawler</>}
                </button>
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>L'IA lit toutes les pages publiques (max 30) et les utilise pour répondre.</div>
            </div>

            {/* Existing docs */}
            <div>
              <div className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><FileText size={12} /> Documents indexés ({docs.length})</span>
                {docsLoading && <Loader2 size={11} className="spin" />}
              </div>
              {docs.length === 0 ? (
                <div style={{ padding: 12, fontSize: 12, color: C.inkSoft, fontStyle: 'italic' }}>
                  Aucun document encore. Ajoute-en pour que l'IA cite tes vraies infos.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {docs.slice(0, 8).map((d: any) => (
                    <div key={d.id} style={{
                      background: C.creamDeep, padding: '8px 12px', borderRadius: 8,
                      fontSize: 12, color: C.ink,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <FileText size={12} color={C.violetDeep} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name ?? d.fileName ?? 'Document'}</span>
                      <span className="mono-font" style={{ fontSize: 10, color: C.inkSoft }}>{d.size ? `${Math.round(d.size / 1024)} Ko` : ''}</span>
                    </div>
                  ))}
                  {docs.length > 8 && (
                    <div style={{ fontSize: 11, color: C.inkSoft, textAlign: 'center', marginTop: 4 }}>
                      + {docs.length - 8} autres
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {/* SECTION 3 — CONNECTEURS */}
          <SectionCard
            icon={<Plug />}
            color={C.emerald} colorDeep={C.emeraldDeep} soft={C.emeraldSoft}
            title="Connecteurs"
            subtitle="Ce que ton IA peut utiliser pour agir : envoyer email, lire Drive, parler WhatsApp…"
            filled={sections[2].filled}
            open={openSection === 'connectors'}
            onToggle={() => setOpenSection(openSection === 'connectors' ? null : 'connectors')}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {[
                { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp Business', color: '#25D366', goto: '/admin/whatsapp', connected: !!company?.['whatsappPhoneNumberId'] || !!connectorStats?.whatsapp?.connected },
                { key: 'gmail',    icon: Mail,           label: 'Gmail',             color: '#EA4335', goto: '/admin/connectors', connected: !!connectorStats?.gmail?.connected },
                { key: 'drive',    icon: Database,       label: 'Google Drive',      color: '#1A73E8', goto: '/admin/connectors', connected: !!connectorStats?.googleDrive?.connected },
                { key: 'mcp',      icon: Cpu,            label: 'MCP / Outils avancés', color: C.violet, goto: '/admin/mcp-connections', connected: !!connectorStats?.mcp?.connected },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.key} style={{
                    background: C.creamDeep, borderRadius: 12, padding: 14,
                    display: 'flex', alignItems: 'center', gap: 12,
                    border: `1px solid ${item.connected ? C.emerald : 'rgba(10,42,32,0.05)'}`,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${item.color}20`, color: item.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: item.connected ? C.emeraldDeep : C.inkSoft, fontWeight: 600 }}>
                        {item.connected ? '✓ Connecté' : '○ À connecter'}
                      </div>
                    </div>
                    <button onClick={() => navigate(item.goto)} style={{
                      padding: '6px 12px', borderRadius: 8,
                      background: item.connected ? 'transparent' : C.emerald,
                      color: item.connected ? C.inkSoft : C.cream,
                      border: item.connected ? `1px solid ${C.inkLight}` : 'none',
                      fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}>
                      {item.connected ? 'Gérer' : 'Connecter'}
                    </button>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* SECTION 4 — COMPORTEMENT IA */}
          <SectionCard
            icon={<Sliders />}
            color={C.pink} colorDeep="#BE185D" soft={C.pinkSoft}
            title="Comportement IA"
            subtitle="Comment ton IA parle. Le ton, la langue, la personnalité."
            filled={sections[3].filled}
            open={openSection === 'behavior'}
            onToggle={() => setOpenSection(openSection === 'behavior' ? null : 'behavior')}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Field label="Langue principale">
                <select className="input" value={behavior.language ?? 'fr'} onChange={e => setBehavior({ ...behavior, language: e.target.value })}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="pt">Português</option>
                  <option value="ar">العربية</option>
                </select>
              </Field>
              <Field label="Ton">
                <select className="input" value={behavior.aiTone ?? 'friendly'} onChange={e => setBehavior({ ...behavior, aiTone: e.target.value })}>
                  <option value="friendly">😊 Friendly (chaleureux, ivoirien naturel)</option>
                  <option value="professional">👔 Professionnel (formel, corporate)</option>
                  <option value="local">🇨🇮 Local (expressions ivoiriennes, "tu")</option>
                  <option value="premium">✨ Premium (luxe, raffiné)</option>
                </select>
              </Field>
              <Field label="Provider IA">
                <select className="input" value={behavior.aiProvider ?? 'gemini'} onChange={e => setBehavior({ ...behavior, aiProvider: e.target.value })}>
                  <option value="gemini">Gemini Flash 2.5 (rapide, économique)</option>
                  <option value="claude">Claude Sonnet 4.7 (qualité premium)</option>
                  <option value="openai">GPT-4o (créatif)</option>
                </select>
              </Field>
              <Field label="Personnalité (optionnel)" full>
                <textarea
                  className="input"
                  rows={2}
                  value={behavior.aiPersonality ?? ''}
                  onChange={e => setBehavior({ ...behavior, aiPersonality: e.target.value })}
                  placeholder="Ex: 'Tu es un vendeur passionné de mode wax. Tu connais les tissus traditionnels.'"
                  style={{ resize: 'vertical', minHeight: 50 }}
                />
              </Field>
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveBehavior} disabled={behaviorSaving} className="btn-emerald">
                {behaviorSaving ? <><Loader2 size={14} className="spin" /> Sauvegarde…</> : <><Save size={14} /> Enregistrer</>}
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Wizard nav (only in wizard mode) */}
        {wizardMode && (
          <div style={{
            marginTop: 18, display: 'flex', justifyContent: 'space-between', gap: 12,
            background: C.cream, padding: '12px 16px', borderRadius: 14,
            border: '1px solid rgba(10,42,32,0.06)',
          }}>
            <button
              onClick={() => {
                if (step > 1) {
                  const prev = step - 1;
                  setStep(prev);
                  setOpenSection(['identity', 'data', 'connectors', 'behavior'][prev - 1] as SectionStatus['key']);
                }
              }}
              disabled={step === 1}
              className="btn-ghost"
              style={{ opacity: step === 1 ? 0.4 : 1 }}
            >
              <ArrowLeft size={13} /> Précédent
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.inkSoft }}>
              {[1, 2, 3, 4].map(s => (
                <div key={s} style={{
                  width: s === step ? 24 : 8, height: 8, borderRadius: 100,
                  background: s <= step ? C.emerald : C.creamDeep,
                  transition: 'width 0.3s ease',
                }} />
              ))}
            </div>
            {step < 4 ? (
              <button
                onClick={() => {
                  const next = step + 1;
                  setStep(next);
                  setOpenSection(['identity', 'data', 'connectors', 'behavior'][next - 1] as SectionStatus['key']);
                }}
                className="btn-emerald"
              >
                Suivant <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={() => navigate('/agents/commerce')} className="btn-emerald">
                <CheckCircle2 size={14} /> C'est prêt ! Voir ma boutique
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── BusinessTypePicker ────────────────────────────────────────────────────
// Sets the type of activity. Each type maps to:
//   - a recommended marketplace pack
//   - a custom WAOUH copy and CTA
//   - eventually (Phase 2+) a dedicated dashboard like /agents/commerce
// For now only "boutique" has the full vertical (BoutiqueRedesignPage,
// /shop/{slug}, photo→produit). Others link to marketplace pack activation.
const BUSINESS_TYPES: Array<{
  id: string; label: string; emoji: string;
  recommendedPack: string;
  recommendedPackName: string;
  whatItDoes: string;
  ready: boolean; // true = full vertical built; false = roadmap (will activate the pack but no dedicated UI yet)
}> = [
  { id: 'boutique',   label: 'Commerce / Boutique',  emoji: '🛒',
    recommendedPack: 'b16', recommendedPackName: 'Pack Boutique',
    whatItDoes: 'Vends sur WhatsApp avec une photo. Catalogue + commandes + paiement.',
    ready: true },
  { id: 'restaurant', label: 'Restaurant / Maquis',  emoji: '🍽️',
    recommendedPack: 'b7',  recommendedPackName: 'Pack Restaurant',
    whatItDoes: 'Menu, réservations, livraison, fidélité.',
    ready: false },
  { id: 'hotel',      label: 'Hôtel / Hébergement',   emoji: '🏨',
    recommendedPack: 'b11', recommendedPackName: 'Pack Réception',
    whatItDoes: 'Réservation chambres, check-in QR, badge visiteurs.',
    ready: true },
  { id: 'service',    label: 'Service / Coiffure / Beauté', emoji: '💇',
    recommendedPack: 'b11', recommendedPackName: 'Pack Réception',
    whatItDoes: 'Prise de rendez-vous, agenda, fidélité clients.',
    ready: true },
  { id: 'realestate', label: 'Immobilier',            emoji: '🏠',
    recommendedPack: 'b2',  recommendedPackName: 'Pack Immobilier',
    whatItDoes: 'Qualif leads, visites virtuelles, prise de RDV.',
    ready: true },
  { id: 'health',     label: 'Santé / Médical',       emoji: '🏥',
    recommendedPack: 'b1',  recommendedPackName: 'Pack Santé',
    whatItDoes: 'Suivi patients, dossiers, RDV.',
    ready: true },
  { id: 'pme',        label: 'PME / Multi-services',  emoji: '🚀',
    recommendedPack: 'b15', recommendedPackName: 'Pack PME',
    whatItDoes: 'CRM, comms, marketing, support — tout-en-un.',
    ready: true },
  { id: 'autre',      label: 'Autre',                  emoji: '📦',
    recommendedPack: 'b10', recommendedPackName: 'Pack Entreprise',
    whatItDoes: 'Configuration sur mesure.',
    ready: true },
];

function BusinessTypePicker({ value, onChange, onActivate }: {
  value: string;
  onChange: (v: string) => void;
  onActivate: (packId: string) => void;
}) {
  const selected = BUSINESS_TYPES.find(b => b.id === value);

  return (
    <div style={{
      background: C.creamDeep, borderRadius: 14, padding: 16,
      border: `1.5px solid ${selected ? C.cyan : 'rgba(10,42,32,0.08)'}`,
    }}>
      <div className="label" style={{ marginBottom: 12 }}>
        <Sparkles size={12} /> Type d'activité — détermine quel pack et quels agents activer
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8,
      }}>
        {BUSINESS_TYPES.map(b => {
          const active = value === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onChange(b.id)}
              style={{
                padding: '10px 12px', borderRadius: 10,
                background: active ? C.cyanSoft : C.cream,
                color: active ? C.cyanDeep : C.ink,
                border: active ? `2px solid ${C.cyan}` : '2px solid transparent',
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all .15s ease',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{b.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{b.label}</span>
              {b.ready && (
                <span style={{
                  marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                  background: C.emeraldSoft, color: C.emeraldDeep,
                  padding: '2px 6px', borderRadius: 100,
                }}>PRÊT</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Recommendation card */}
      {selected && (
        <div style={{
          marginTop: 14, padding: '14px 16px', borderRadius: 12,
          background: selected.ready
            ? `linear-gradient(135deg, ${C.emeraldSoft} 0%, ${C.cyanSoft} 100%)`
            : `linear-gradient(135deg, ${C.cyanSoft} 0%, ${C.violetSoft} 100%)`,
          border: `1.5px solid ${selected.ready ? C.emerald : C.cyan}`,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>{selected.emoji}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
              color: C.emeraldDeep, textTransform: 'uppercase', marginBottom: 2,
            }}>
              {selected.ready ? '✅ Pack disponible' : '⏳ Pack disponible — UI dédiée à venir'}
            </div>
            <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
              {selected.recommendedPackName}
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>{selected.whatItDoes}</div>
          </div>
          <button
            onClick={() => onActivate(selected.recommendedPack)}
            className="btn-emerald"
            style={{ padding: '9px 16px', fontSize: 12 }}
          >
            <ArrowRight size={13} /> Voir le pack
          </button>
        </div>
      )}
      {!selected && (
        <div style={{ marginTop: 10, fontSize: 11, color: C.inkSoft, fontStyle: 'italic' }}>
          Choisis ton type d'activité — on te suggère le bon pack et les bons agents.
        </div>
      )}
    </div>
  );
}

// ── SectionCard ────────────────────────────────────────────────────────────
function SectionCard({ icon, color, colorDeep, soft, title, subtitle, filled, open, onToggle, children }: {
  icon: React.ReactNode;
  color: string; colorDeep: string; soft: string;
  title: string; subtitle: string;
  filled: number; open: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  const pct = Math.round(filled * 100);
  return (
    <section style={{
      background: C.cream, borderRadius: 18,
      border: `1px solid ${pct >= 100 ? C.emerald : 'rgba(10,42,32,0.06)'}`,
      overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', padding: 18, background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: soft, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
              {title}
            </h3>
            {pct >= 100 ? (
              <span style={{
                fontSize: 10, fontWeight: 700, color: C.emeraldDeep,
                background: C.emeraldSoft, padding: '2px 8px', borderRadius: 100,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                <CheckCircle2 size={10} /> COMPLET
              </span>
            ) : pct === 0 ? (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#92400E',
                background: C.yellowSoft, padding: '2px 8px', borderRadius: 100,
              }}>VIDE</span>
            ) : (
              <span style={{
                fontSize: 10, fontWeight: 700, color: colorDeep,
                background: soft, padding: '2px 8px', borderRadius: 100,
              }}>
                {pct}%
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '3px 0 0' }}>{subtitle}</p>
          {/* Inline progress mini-bar */}
          <div style={{
            marginTop: 8, height: 4, borderRadius: 100,
            background: 'rgba(10,42,32,0.06)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: pct >= 100 ? C.emerald : color,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
        {open ? <ChevronDown size={18} color={C.inkSoft} /> : <ChevronRight size={18} color={C.inkSoft} />}
      </button>
      {open && (
        <div style={{ padding: '0 22px 22px', borderTop: '1px solid rgba(10,42,32,0.06)', paddingTop: 18 }}>
          {children}
        </div>
      )}
    </section>
  );
}

// ── Field ────────────────────────────────────────────────────────────────────
function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ ...(full ? { gridColumn: '1 / -1' } : {}) }}>
      <div className="label">
        {label}
        {required && <span style={{ color: C.red, marginLeft: 2 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

// ── PWA Identity Section ─────────────────────────────────────────────────────
// Lets the merchant upload a square logo + pick a brand color used by the
// per-company installable PWA. Saves directly to Firebase Storage under
// `companies/{companyId}/logo/pwa-{ts}.{ext}` and pushes the URL into the
// identity state — the parent saveIdentity() then persists pwaLogoUrl +
// primaryColor to Firestore.
function PWAIdentitySection({
  companyId, pwaLogoUrl, primaryColor, companyName,
  onPWALogoChange, onColorChange,
}: {
  companyId: string;
  pwaLogoUrl: string;
  primaryColor: string;
  companyName: string;
  onPWALogoChange: (url: string) => void;
  onColorChange: (color: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (f: File | null | undefined) => {
    if (!f || !companyId) return;
    setError(null);
    if (!f.type.startsWith('image/')) { setError('Format non supporté — JPG/PNG/WebP uniquement'); return; }
    if (f.size > 3 * 1024 * 1024) { setError(`Max 3 Mo (le tien : ${(f.size / 1024 / 1024).toFixed(1)} Mo)`); return; }

    setUploading(true); setProgress(0);
    try {
      const ext = (f.name.split('.').pop() || 'png').toLowerCase().slice(0, 5);
      const ref = storageRef(storage, `companies/${companyId}/logo/pwa-${Date.now()}.${ext}`);
      const task = uploadBytesResumable(ref, f, { contentType: f.type });
      task.on('state_changed',
        snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        err => { setError(err.message); setUploading(false); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          onPWALogoChange(url);
          setUploading(false); setProgress(100);
          toast.success('Logo PWA téléversé', "N'oublie pas d'enregistrer pour publier.");
        },
      );
    } catch (e) {
      setError((e as Error).message);
      setUploading(false);
    }
  };

  const initial = (companyName.charAt(0) || '?').toUpperCase();

  return (
    <div style={{
      marginTop: 18,
      background: C.creamDeep,
      border: `1px solid rgba(10,42,32,0.08)`,
      borderRadius: 14,
      padding: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Camera size={14} color={C.cyanDeep} />
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 17, fontWeight: 700, color: C.ink }}>
          Identité de ton app installable (PWA)
        </div>
      </div>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 16px', lineHeight: 1.55 }}>
        Quand un client installe ton entreprise depuis ton lien public (clone, boutique, menu…), c'est <strong>ton logo</strong> et <strong>ta couleur</strong> qui apparaissent sur son écran d'accueil — pas Orlode.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16, flexWrap: 'wrap' }}>
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          style={{
            width: 96, height: 96, borderRadius: 20,
            background: pwaLogoUrl
              ? `url(${pwaLogoUrl}) center/cover`
              : `linear-gradient(135deg, ${primaryColor}25, ${primaryColor}10)`,
            border: `2px solid ${pwaLogoUrl ? primaryColor : `${primaryColor}40`}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: uploading ? 'wait' : 'pointer',
            position: 'relative', overflow: 'hidden',
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}
        >
          {uploading ? (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255,255,255,0.9)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <Loader2 size={22} className="spin" color={primaryColor} />
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: primaryColor }}>
                {progress}%
              </div>
            </div>
          ) : pwaLogoUrl ? null : (
            <div style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 44, fontWeight: 800,
              color: primaryColor, fontStyle: 'italic', opacity: 0.55,
            }}>
              {initial}
            </div>
          )}
          {!uploading && !pwaLogoUrl && (
            <div style={{
              position: 'absolute', bottom: 6, right: 6,
              width: 28, height: 28, borderRadius: '50%',
              background: primaryColor, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 10px -2px ${primaryColor}80`,
            }}>
              <Camera size={14} />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={e => handleFile(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
            Logo carré ≥ 512×512 px
          </div>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 10px', lineHeight: 1.5 }}>
            JPG / PNG / WebP · max 3 Mo · format carré obligatoire (sinon il sera tronqué sur les écrans d'accueil iOS/Android). Idéal : 512×512 ou 1024×1024.
          </p>
          {pwaLogoUrl && (
            <button
              type="button"
              onClick={() => { onPWALogoChange(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              style={{
                background: 'transparent', border: 'none',
                color: C.red, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
              <Trash2 size={11} /> Retirer le logo PWA
            </button>
          )}
          {error && (
            <div style={{
              marginTop: 8,
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: C.redSoft, border: `1px solid ${C.red}40`,
              borderRadius: 100, padding: '4px 10px',
              fontSize: 11, fontWeight: 600, color: C.red,
            }}>
              <AlertCircle size={11} /> {error}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'center' }}>
        <input
          type="color"
          value={primaryColor}
          onChange={e => onColorChange(e.target.value)}
          style={{
            width: 56, height: 40, borderRadius: 10,
            border: '1px solid rgba(10,42,32,0.15)',
            cursor: 'pointer', background: 'transparent', padding: 0,
          }}
          title="Couleur principale de ton app"
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
            Couleur principale ·{' '}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: primaryColor, fontWeight: 700 }}>
              {primaryColor.toUpperCase()}
            </span>
          </div>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '4px 0 0', lineHeight: 1.5 }}>
            Teinte de la barre du navigateur + accent du bouton "Installer" sur tes pages publiques.
          </p>
        </div>
      </div>
    </div>
  );
}
