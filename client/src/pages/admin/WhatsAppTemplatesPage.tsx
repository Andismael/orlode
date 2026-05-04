/**
 * WhatsApp Templates (HSMs) — list, preview, send.
 *
 * Templates are pre-approved by Meta and required for outbound messages
 * outside the 24h customer-service window. Each has a body with optional
 * placeholders ({{1}}, {{2}}, …). The user picks a template, fills in the
 * variables, picks recipients, sends. We log every send for audit.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  ArrowLeft, BookOpen, RefreshCw, Send, Search, CheckCircle2, AlertCircle,
  Clock, FileText, Languages, Plus, X, ExternalLink,
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

interface Component {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | string;
  text?: string;
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  example?: { body_text?: string[][]; header_text?: string[] };
  buttons?: Array<{ type: string; text: string; url?: string }>;
}

interface Template {
  id?: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED' | 'PAUSED' | string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | string;
  language: string;
  components: Component[];
  rejected_reason?: string;
  quality_score?: { score?: string };
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED:   { label: 'Approuvé',  color: C.emeraldDeep,  bg: C.emeraldSoft },
  PENDING:    { label: 'En attente', color: C.ai,           bg: C.aiSoft },
  REJECTED:   { label: 'Rejeté',     color: C.red,          bg: C.redSoft },
  DISABLED:   { label: 'Désactivé',  color: C.inkLight,     bg: C.creamDeep },
  PAUSED:     { label: 'En pause',   color: C.inkSoft,      bg: C.creamDeep },
};
const CATEGORY_META: Record<string, { label: string; color: string }> = {
  MARKETING:      { label: 'Marketing',      color: C.purple },
  UTILITY:        { label: 'Utilitaire',     color: C.blue },
  AUTHENTICATION: { label: 'Authentification', color: C.ai },
};

/** Count {{N}} placeholders in a string, return how many distinct ones. */
function countPlaceholders(text: string): number {
  const matches = text.match(/\{\{\d+\}\}/g) ?? [];
  const set = new Set(matches);
  return set.size;
}

/** Replace {{N}} placeholders with the provided values, falling back to the placeholder if missing. */
function fillTemplate(text: string, values: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (m, n) => {
    const idx = parseInt(n, 10) - 1;
    return values[idx] || m;
  });
}

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('APPROVED');
  const [selected, setSelected] = useState<Template | null>(null);
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerParam, setHeaderParam] = useState('');
  const [recipients, setRecipients] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStats, setSendStats] = useState<Record<string, { sent: number; lastSentAt: number | null }>>({});

  const load = async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    try {
      const [tplR, statsR]: any[] = await Promise.all([
        api.get(`/whatsapp/templates${force ? '?refresh=1' : ''}`),
        api.get('/whatsapp/templates/stats').catch(() => null),
      ]);
      const list: Template[] = Array.isArray(tplR?.data) ? tplR.data : (Array.isArray(tplR?.data?.data) ? tplR.data.data : []);
      setTemplates(list);
      const s = statsR?.data?.byTemplate ?? statsR?.data?.data?.byTemplate ?? {};
      setSendStats(s);
    } catch (e: any) {
      toast.error('Impossible de charger les templates', e?.response?.data?.message ?? 'Vérifie ta connexion WhatsApp');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return templates
      .filter(t => statusFilter === 'all' || t.status === statusFilter)
      .filter(t => {
        if (!search) return true;
        const q = search.toLowerCase();
        const body = t.components.find(c => c.type === 'BODY')?.text ?? '';
        return `${t.name} ${body} ${t.category}`.toLowerCase().includes(q);
      });
  }, [templates, statusFilter, search]);

  const counts = useMemo(() => ({
    APPROVED: templates.filter(t => t.status === 'APPROVED').length,
    PENDING: templates.filter(t => t.status === 'PENDING').length,
    REJECTED: templates.filter(t => t.status === 'REJECTED').length,
    all: templates.length,
  }), [templates]);

  const openSend = (t: Template) => {
    setSelected(t);
    const body = t.components.find(c => c.type === 'BODY')?.text ?? '';
    const n = countPlaceholders(body);
    setBodyParams(new Array(n).fill(''));
    const headerComp = t.components.find(c => c.type === 'HEADER');
    if (headerComp?.format === 'TEXT' && countPlaceholders(headerComp.text ?? '') > 0) {
      setHeaderParam('');
    } else {
      setHeaderParam('');
    }
    setRecipients('');
  };

  const sendTemplate = async () => {
    if (!selected) return;
    const phones = recipients.split(',').map(s => s.trim().replace(/[\s()-]/g, '')).filter(Boolean);
    if (phones.length === 0) {
      toast.error('Numéro requis', 'Indique au moins un numéro destinataire');
      return;
    }
    if (bodyParams.some((v, i) => !v.trim())) {
      toast.error('Variables manquantes', `Remplis tous les {{${bodyParams.findIndex(v => !v.trim()) + 1}}}`);
      return;
    }
    setSending(true);
    try {
      const r: any = await api.post('/whatsapp/templates/send', {
        to: phones,
        templateName: selected.name,
        languageCode: selected.language,
        bodyParams,
        headerParam: headerParam || undefined,
      });
      const data = r?.data ?? r?.data?.data;
      const sent = data?.sent ?? 0;
      const total = data?.total ?? phones.length;
      if (sent === total) {
        toast.success(`Envoyé à ${sent} destinataire${sent > 1 ? 's' : ''}`, selected.name);
      } else {
        toast.error(`Partiellement envoyé`, `${sent}/${total} — vérifie les numéros`);
      }
      setSelected(null);
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
    } finally { setSending(false); }
  };

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link to="/admin/whatsapp" style={{ color: C.cream, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> WhatsApp
        </Link>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Templates <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.metaSoft }}>Meta</em>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.7)', margin: '2px 0 0' }}>
            Messages pré-approuvés (HSMs) — obligatoires pour contacter un client hors fenêtre 24h.
          </p>
        </div>
        <a href="https://business.facebook.com/wa/manage/message-templates" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          <ExternalLink size={12} /> Créer sur Meta
        </a>
        <button onClick={() => load(true)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Rafraîchir
        </button>
      </div>

      {/* Status pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([
          { id: 'APPROVED', label: 'Approuvés',   count: counts.APPROVED, color: C.emerald },
          { id: 'PENDING',  label: 'En attente',  count: counts.PENDING,  color: C.ai },
          { id: 'REJECTED', label: 'Rejetés',     count: counts.REJECTED, color: C.red },
          { id: 'all',      label: 'Tous',        count: counts.all,      color: C.cream },
        ] as const).map(f => {
          const active = statusFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'rgba(255,250,240,0.06)',
                color: active ? (f.id === 'all' ? C.greenDeep : C.cream) : C.cream,
                padding: '8px 14px', borderRadius: 100,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: active ? 'none' : '1px solid rgba(255,250,240,0.12)',
                fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {f.label}
              <span className="mono-font" style={{ background: active ? 'rgba(0,0,0,0.15)' : 'rgba(255,250,240,0.1)', padding: '1px 6px', borderRadius: 6, fontSize: 10 }}>
                {f.count}
              </span>
            </button>
          );
        })}
        <div style={{ flex: 1, minWidth: 180, marginLeft: 'auto' }}>
          <div style={{
            background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.12)',
            borderRadius: 100, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Search size={12} color="rgba(255,250,240,0.6)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer par nom, catégorie, contenu…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: C.cream, fontSize: 12, fontFamily: 'inherit' }}
            />
          </div>
        </div>
      </div>

      {/* List / loading / empty */}
      {loading && (
        <div style={{ background: C.cream, borderRadius: 14, padding: 40, textAlign: 'center', color: C.inkSoft }}>
          Chargement des templates…
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.12)' }}>
          <BookOpen size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
            {templates.length === 0 ? 'Aucun template Meta' : 'Aucun template avec ce filtre'}
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 14px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            {templates.length === 0
              ? "Crée des templates depuis Meta Business Manager (Marketing, Utilitaire, Auth). Une fois approuvés par Meta, ils apparaîtront ici."
              : 'Essaie un autre filtre ou lance un Refresh.'}
          </p>
          <a href="https://business.facebook.com/wa/manage/message-templates" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }}>
            <ExternalLink size={12} /> Ouvrir Meta Manager
          </a>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {filtered.map(t => {
            const sm = STATUS_META[t.status] ?? { label: t.status, color: C.inkSoft, bg: C.creamDeep };
            const cm = CATEGORY_META[t.category] ?? { label: t.category, color: C.inkSoft };
            const body = t.components.find(c => c.type === 'BODY')?.text ?? '';
            const footer = t.components.find(c => c.type === 'FOOTER')?.text ?? '';
            const header = t.components.find(c => c.type === 'HEADER');
            const placeholders = countPlaceholders(body);
            const canSend = t.status === 'APPROVED';
            return (
              <div
                key={t.name + t.language}
                style={{
                  background: C.cream, borderRadius: 14,
                  border: `1.5px solid ${sm.color}25`,
                  borderLeft: `5px solid ${sm.color}`,
                  padding: 16,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em', wordBreak: 'break-word' }}>
                      {t.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span className="pill" style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700 }}>{sm.label}</span>
                      <span style={{ fontSize: 11, color: cm.color, fontWeight: 600 }}>· {cm.label}</span>
                      <span style={{ fontSize: 11, color: C.inkLight, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Languages size={10} /> {t.language}
                      </span>
                    </div>
                  </div>
                </div>

                {header?.text && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.metaSoft, background: C.metaSoft, padding: '6px 10px', borderRadius: 8, color: C.meta }}>
                    {header.text}
                  </div>
                )}
                <div style={{
                  background: C.waSoft, borderRadius: 10, padding: '10px 12px',
                  fontSize: 13, color: C.ink, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {body || <em style={{ color: C.inkLight }}>—</em>}
                </div>
                {footer && (
                  <div style={{ fontSize: 11, color: C.inkLight, fontStyle: 'italic' }}>{footer}</div>
                )}

                {t.status === 'REJECTED' && t.rejected_reason && (
                  <div style={{ fontSize: 11, color: C.red, background: C.redSoft, padding: '6px 10px', borderRadius: 8 }}>
                    ⚠️ {t.rejected_reason}
                  </div>
                )}

                <div style={{
                  display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: 8, borderTop: '1px solid rgba(10,42,32,0.06)',
                  flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 11, color: C.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {placeholders > 0 ? <><strong>{placeholders}</strong> variable{placeholders > 1 ? 's' : ''}</> : 'Aucune variable'}
                    {sendStats[t.name]?.sent > 0 && (
                      <span style={{ background: C.metaSoft, color: C.meta, padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                        📤 {sendStats[t.name].sent} envoi{sendStats[t.name].sent > 1 ? 's' : ''} (30j)
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => openSend(t)}
                    disabled={!canSend}
                    className={canSend ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '6px 12px', fontSize: 12, opacity: canSend ? 1 : 0.5 }}
                  >
                    <Send size={12} /> {canSend ? 'Envoyer' : 'Indisponible'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send modal */}
      {selected && (
        <SendModal
          template={selected}
          bodyParams={bodyParams}
          setBodyParams={setBodyParams}
          headerParam={headerParam}
          setHeaderParam={setHeaderParam}
          recipients={recipients}
          setRecipients={setRecipients}
          sending={sending}
          onClose={() => setSelected(null)}
          onSend={sendTemplate}
        />
      )}
    </div>
  );
}

interface SendModalProps {
  template: Template;
  bodyParams: string[];
  setBodyParams: (v: string[]) => void;
  headerParam: string;
  setHeaderParam: (v: string) => void;
  recipients: string;
  setRecipients: (v: string) => void;
  sending: boolean;
  onClose: () => void;
  onSend: () => void;
}

function SendModal({ template, bodyParams, setBodyParams, headerParam, setHeaderParam, recipients, setRecipients, sending, onClose, onSend }: SendModalProps) {
  const body = template.components.find(c => c.type === 'BODY')?.text ?? '';
  const header = template.components.find(c => c.type === 'HEADER');
  const headerHasVar = header?.format === 'TEXT' && countPlaceholders(header.text ?? '') > 0;
  const preview = fillTemplate(body, bodyParams);
  const phoneCount = recipients.split(',').map(s => s.trim()).filter(Boolean).length;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 18,
        width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 30px 60px -20px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.wa, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
              Envoyer le template
            </h3>
            <div className="mono-font" style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
              {template.name} · {template.language}
            </div>
          </div>
          <button onClick={onClose} className="icon-btn ghost"><X size={16} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header param if present */}
          {headerHasVar && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                Header — variable
              </label>
              <input
                className="input-field"
                value={headerParam}
                onChange={(e: any) => setHeaderParam(e.target.value)}
                placeholder={header?.text ?? ''}
              />
            </div>
          )}

          {/* Body params */}
          {bodyParams.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                Variables du message ({bodyParams.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bodyParams.map((v, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.purple, minWidth: 40 }}>{`{{${i + 1}}}`}</span>
                    <input
                      className="input-field"
                      value={v}
                      onChange={(e: any) => {
                        const next = [...bodyParams];
                        next[i] = e.target.value;
                        setBodyParams(next);
                      }}
                      placeholder={`Variable ${i + 1}`}
                      style={{ flex: 1 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recipients */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Destinataires (séparés par virgule)
            </label>
            <textarea
              className="input-field"
              rows={2}
              value={recipients}
              onChange={(e: any) => setRecipients(e.target.value)}
              placeholder="+225 07 01 23 45 67, +33 6 12 34 56 78"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            {phoneCount > 0 && (
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                {phoneCount} destinataire{phoneCount > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Preview */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Aperçu
            </label>
            <div style={{ background: C.waSoft, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.ink, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {preview || <em style={{ color: C.inkLight }}>Remplis les variables pour voir le rendu</em>}
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(10,42,32,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} className="btn-secondary" disabled={sending}>Annuler</button>
          <button onClick={onSend} disabled={sending || phoneCount === 0} className="btn-primary">
            <Send size={14} /> {sending ? 'Envoi…' : `Envoyer${phoneCount > 0 ? ` à ${phoneCount}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
