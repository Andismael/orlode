/**
 * TemplateSendModal — pick an approved Meta template + fill variables,
 * then send via POST /api/whatsapp/templates/send.
 *
 * Why this exists: WhatsApp Cloud API only allows free-text replies within
 * 24 hours of the customer's last message. To re-engage cold contacts the
 * merchant MUST use an approved template (HSM). This modal lets them do that
 * from the conversation pane in one click — no need to leave the inbox.
 *
 * Auto-extracts {{1}}, {{2}}… placeholders from the template body so the
 * merchant fills them in order. Auto-detects header type (text vs media).
 * Disables APPROVED-only templates (PENDING / REJECTED hidden).
 */
import { useEffect, useMemo, useState } from 'react';
import { X, Send, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';

interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
}
interface Template {
  name: string;
  status: string;        // 'APPROVED' | 'PENDING' | 'REJECTED'
  language: string;
  components: TemplateComponent[];
}

interface Props {
  recipient: string;
  recipientName?: string;
  onClose: () => void;
  onSent: () => void;
}

export default function TemplateSendModal({ recipient, recipientName, onClose, onSent }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerParam, setHeaderParam] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/whatsapp/templates')
      .then((r: any) => {
        const list = r?.data?.templates ?? r?.data?.data?.templates ?? r?.data?.data ?? r?.data ?? [];
        const approved = (Array.isArray(list) ? list : [])
          .filter((t: Template) => t.status === 'APPROVED');
        setTemplates(approved);
        if (approved.length > 0) setSelectedName(approved[0].name);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => templates.find(t => t.name === selectedName),
    [templates, selectedName],
  );

  // Extract {{1}}, {{2}}… variables from the body text.
  const bodyVars = useMemo(() => {
    if (!selected) return 0;
    const body = selected.components.find(c => c.type.toLowerCase() === 'body');
    if (!body?.text) return 0;
    const matches = body.text.match(/\{\{\d+\}\}/g);
    return matches ? new Set(matches).size : 0;
  }, [selected]);

  const hasHeaderText = useMemo(() => {
    if (!selected) return false;
    const header = selected.components.find(c => c.type.toLowerCase() === 'header');
    return header?.format?.toLowerCase() === 'text';
  }, [selected]);

  // Resize bodyParams when selected template changes.
  useEffect(() => {
    setBodyParams(new Array(bodyVars).fill(''));
    setHeaderParam('');
  }, [selectedName, bodyVars]);

  const previewBody = useMemo(() => {
    if (!selected) return '';
    const body = selected.components.find(c => c.type.toLowerCase() === 'body');
    let txt = body?.text ?? '';
    bodyParams.forEach((p, i) => {
      const placeholder = `{{${i + 1}}}`;
      txt = txt.split(placeholder).join(p || placeholder);
    });
    return txt;
  }, [selected, bodyParams]);

  const canSend = !!selected && !sending
    && bodyParams.every(p => p.trim().length > 0)
    && (!hasHeaderText || headerParam.trim().length > 0);

  async function send() {
    if (!selected || !canSend) return;
    setSending(true);
    try {
      await api.post('/whatsapp/templates/send', {
        to: recipient,
        templateName: selected.name,
        languageCode: selected.language,
        bodyParams,
        ...(hasHeaderText ? { headerParam } : {}),
      });
      toast.success('Template envoyé', `Message envoyé à ${recipientName ?? recipient}`);
      onSent();
      onClose();
    } catch (e: any) {
      toast.error('Envoi impossible', e?.response?.data?.message ?? e?.message ?? 'Réessaie.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(10,42,32,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFFAF0', borderRadius: 18, maxWidth: 540, width: '100%',
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)',
        fontFamily: 'Inter, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #128C7E, #075e54)', color: '#fff',
          padding: '18px 22px', borderRadius: '18px 18px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 800, opacity: 0.85, letterSpacing: '0.08em', marginBottom: 2 }}>
              MESSAGE TEMPLATE
            </div>
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 800, margin: 0 }}>
              Envoyer à <em style={{ fontStyle: 'italic' }}>{recipientName ?? recipient}</em>
            </h3>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{
            width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.2)',
            color: '#fff', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          <p style={{ fontSize: 12, color: '#5A6B62', margin: '0 0 14px', lineHeight: 1.5 }}>
            Les templates sont approuvés par Meta et permettent d'envoyer un message
            même <strong>hors de la fenêtre de 24h</strong> (réengagement de client froid).
          </p>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94A3A0' }}>Chargement des templates…</div>
          ) : templates.length === 0 ? (
            <div style={{ padding: 16, borderRadius: 10, background: '#FEF3C7', border: '1px solid #FCD34D', display: 'flex', gap: 8 }}>
              <AlertTriangle size={18} color="#92400E" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: '#92400E' }}>
                <strong>Aucun template approuvé.</strong> Va dans{' '}
                <a href="/admin/whatsapp/templates" style={{ color: '#92400E', fontWeight: 700 }}>Templates Meta</a>{' '}
                pour en soumettre. Validation Meta sous 24-48h.
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#5A6B62', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>
                  TEMPLATE
                </label>
                <select
                  value={selectedName ?? ''}
                  onChange={e => setSelectedName(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1.5px solid rgba(31,41,55,0.1)', fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', background: '#fff',
                  }}
                >
                  {templates.map(t => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
              </div>

              {hasHeaderText && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#5A6B62', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>
                    EN-TÊTE
                  </label>
                  <input
                    value={headerParam}
                    onChange={e => setHeaderParam(e.target.value)}
                    placeholder="Texte d'en-tête…"
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid rgba(31,41,55,0.1)', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', background: '#fff',
                    }}
                  />
                </div>
              )}

              {bodyVars > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#5A6B62', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>
                    VARIABLES ({bodyVars})
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Array.from({ length: bodyVars }).map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: '#128C7E', minWidth: 36 }}>
                          {`{{${i + 1}}}`}
                        </span>
                        <input
                          value={bodyParams[i] ?? ''}
                          onChange={e => setBodyParams(prev => {
                            const next = [...prev];
                            next[i] = e.target.value;
                            return next;
                          })}
                          placeholder={`Valeur pour {{${i + 1}}}…`}
                          style={{
                            flex: 1, padding: '10px 12px', borderRadius: 10,
                            border: '1.5px solid rgba(31,41,55,0.1)', fontSize: 13, fontFamily: 'inherit',
                            outline: 'none', background: '#fff',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div style={{
                background: '#DCF8C6', borderRadius: 12, padding: 12,
                marginBottom: 16, fontSize: 13, color: '#0A2A20', lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 800, color: '#128C7E', letterSpacing: '0.08em', marginBottom: 6 }}>
                  APERÇU
                </div>
                {previewBody || <em style={{ color: '#5A6B62' }}>(corps vide)</em>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid rgba(31,41,55,0.06)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          background: '#F5F0E8', borderRadius: '0 0 18px 18px',
        }}>
          <button onClick={onClose} disabled={sending} style={{
            padding: '10px 16px', borderRadius: 10, background: 'transparent',
            color: '#5A6B62', border: '1.5px solid rgba(31,41,55,0.15)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          }}>
            Annuler
          </button>
          <button onClick={send} disabled={!canSend} style={{
            padding: '10px 18px', borderRadius: 10,
            background: '#25D366', color: '#fff', border: 'none',
            cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : 0.5,
            fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {sending ? <RefreshCw size={13} className="spin" /> : <Send size={13} />}
            {sending ? 'Envoi…' : 'Envoyer le template'}
          </button>
        </div>
      </div>
    </div>
  );
}
