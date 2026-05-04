/**
 * Auto-Broadcast Rules — automatic campaigns triggered by lead conditions.
 *
 * Each rule = "if N+ leads match condition X, send template Y" with cooldown.
 * Evaluated by the cron tick every minute.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  ArrowLeft, Sparkles, Plus, X, Power, RefreshCw, Zap, Clock, Users2,
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  ink: '#0A2A20', inkSoft: '#475467', inkLight: '#94A3A0',
  wa: '#25D366', waDeep: '#128C7E', waSoft: '#DCF8C6',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  red: '#EF4444', redSoft: '#FEE2E2',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  ai: '#F59E0B', aiSoft: '#FEF3C7',
  purple: '#6D28D9', purpleSoft: '#EDE9FE',
};

interface Template { name: string; status: string; language: string; components: any[]; }

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  templateName: string;
  languageCode: string;
  bodyParams?: string[];
  prefillFromLead?: boolean;
  condition: {
    status?: string; urgency?: string;
    minLeadCount: number;
    maxLeadAgeMinutes?: number;
    requireNotContacted?: boolean;
  };
  cooldownMinutes: number;
  totalTriggered?: number;
  lastTriggeredAt?: { _seconds: number };
}

function fmtRel(ts?: { _seconds: number }): string {
  if (!ts?._seconds) return 'jamais';
  const diff = Math.floor(Date.now() / 1000 - ts._seconds);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function WhatsAppAutoBroadcastsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await api.get('/whatsapp/auto-broadcasts');
      const list: Rule[] = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.data) ? r.data.data : []);
      setRules(list);
    } catch { setRules([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (rule: Rule) => {
    setUpdating(rule.id);
    try {
      await api.patch(`/whatsapp/auto-broadcasts/${rule.id}`, { enabled: !rule.enabled });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !rule.enabled } : r));
      toast.success(rule.enabled ? 'Règle désactivée' : 'Règle activée');
    } catch { toast.error('Échec'); }
    finally { setUpdating(null); }
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer cette règle ?')) return;
    setUpdating(id);
    try {
      await api.delete(`/whatsapp/auto-broadcasts/${id}`);
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success('Règle supprimée');
    } catch { toast.error('Échec'); }
    finally { setUpdating(null); }
  };

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link to="/admin/whatsapp" style={{ color: C.cream, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> WhatsApp
        </Link>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Auto-broadcasts <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.aiSoft }}>intelligents</em>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.7)', margin: '2px 0 0' }}>
            Marketing sans humain — quand une condition est remplie, un broadcast se lance tout seul.
          </p>
        </div>
        <button onClick={load} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          <RefreshCw size={13} /> Rafraîchir
        </button>
        <button onClick={() => setShowNew(true)} className="btn-primary" style={{ padding: '9px 16px', fontSize: 13 }}>
          <Plus size={13} /> Créer une règle
        </button>
      </div>

      {loading && (
        <div style={{ background: C.cream, borderRadius: 14, padding: 40, textAlign: 'center', color: C.inkSoft }}>
          Chargement…
        </div>
      )}
      {!loading && rules.length === 0 && (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.12)' }}>
          <Zap size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
            Aucune règle auto-broadcast
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 14px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            Crée une règle qui se déclenche toute seule. Exemple : <em>"Si 20+ nouveaux leads urgents, envoyer le template followup_pro"</em>. Le système vérifie chaque minute.
          </p>
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <Plus size={14} /> Créer ma première règle
          </button>
        </div>
      )}
      {!loading && rules.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {rules.map(rule => {
            const cond = rule.condition;
            const condDesc = [
              cond.minLeadCount ? `${cond.minLeadCount}+ leads` : null,
              cond.status && cond.status !== 'all' ? `statut: ${cond.status}` : null,
              cond.urgency && cond.urgency !== 'all' ? `urgence: ${cond.urgency}` : null,
              cond.maxLeadAgeMinutes ? `créés < ${cond.maxLeadAgeMinutes}min` : null,
              cond.requireNotContacted ? 'non contactés' : null,
            ].filter(Boolean).join(' · ');
            const isUpdating = updating === rule.id;
            return (
              <div key={rule.id} style={{
                background: C.cream, borderRadius: 14,
                border: `1.5px solid ${rule.enabled ? C.emerald : C.inkLight}30`,
                borderLeft: `5px solid ${rule.enabled ? C.emeraldDeep : C.inkLight}`,
                padding: 16,
                display: 'flex', flexDirection: 'column', gap: 10,
                opacity: isUpdating ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: rule.enabled ? `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})` : C.creamDeep, color: rule.enabled ? C.cream : C.inkLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                        {rule.name}
                      </span>
                      <span className="pill" style={{ background: rule.enabled ? C.emeraldSoft : C.creamDeep, color: rule.enabled ? C.emeraldDeep : C.inkSoft, fontSize: 10, fontWeight: 700 }}>
                        {rule.enabled ? '⚡ ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: C.inkSoft }}>
                      <strong>Condition</strong> : {condDesc || 'Aucune'}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, color: C.inkSoft }}>
                      <strong>Action</strong> : envoyer <span className="mono-font" style={{ color: C.purple, fontWeight: 600 }}>{rule.templateName}</span> · {rule.languageCode}
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', gap: 14, fontSize: 11, color: C.inkLight, flexWrap: 'wrap' }}>
                      <span><Clock size={10} style={{ display: 'inline', marginRight: 3 }} /> Cooldown: {rule.cooldownMinutes}min</span>
                      <span>📤 Déclenchée {rule.totalTriggered ?? 0} fois</span>
                      <span>Dernier: {fmtRel(rule.lastTriggeredAt)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => toggle(rule)} disabled={isUpdating} className={rule.enabled ? 'btn-secondary' : 'btn-primary'} style={{ padding: '6px 12px', fontSize: 11 }}>
                      <Power size={11} /> {rule.enabled ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onClick={() => remove(rule.id)} disabled={isUpdating} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkLight, padding: 6 }} title="Supprimer">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewRuleModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewRuleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState('');
  const [pickedTemplate, setPickedTemplate] = useState<Template | null>(null);
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [prefillFromLead, setPrefillFromLead] = useState(true);
  const [statusF, setStatusF] = useState<string>('new');
  const [urgencyF, setUrgencyF] = useState<string>('all');
  const [minLeadCount, setMinLeadCount] = useState<number>(5);
  const [maxLeadAgeMinutes, setMaxLeadAgeMinutes] = useState<number>(60);
  const [requireNotContacted, setRequireNotContacted] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(60);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/whatsapp/templates').then((r: any) => {
      const list: Template[] = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.data) ? r.data.data : []);
      setTemplates(list.filter(t => t.status === 'APPROVED'));
    }).catch(() => setTemplates([]));
  }, []);

  const pickTemplate = (t: Template) => {
    setPickedTemplate(t);
    const body = t.components.find(c => c.type === 'BODY')?.text ?? '';
    const matches = body.match(/\{\{\d+\}\}/g) ?? [];
    const n = new Set(matches).size;
    setBodyParams(new Array(n).fill(''));
    if (!name) setName(`Auto · ${t.name}`);
  };

  const create = async () => {
    if (!pickedTemplate || !name.trim()) return;
    setCreating(true);
    try {
      await api.post('/whatsapp/auto-broadcasts', {
        name: name.trim(),
        enabled: true,
        templateName: pickedTemplate.name,
        languageCode: pickedTemplate.language,
        bodyParams,
        prefillFromLead,
        condition: {
          status: statusF,
          urgency: urgencyF,
          minLeadCount,
          maxLeadAgeMinutes,
          requireNotContacted,
        },
        cooldownMinutes,
      });
      toast.success('Règle créée', name);
      onCreated();
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
    } finally { setCreating(false); }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 18,
        width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, margin: 0 }}>
              Nouvelle règle auto-broadcast
            </h3>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
              Le système vérifie cette règle chaque minute. Si la condition est remplie, un broadcast se lance.
            </div>
          </div>
          <button onClick={onClose} className="icon-btn ghost"><X size={16} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Nom de la règle
            </label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Relance auto leads urgents"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          </div>

          {/* Template */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Template à envoyer
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {templates.map(t => {
                const active = pickedTemplate?.name === t.name && pickedTemplate?.language === t.language;
                const body = t.components.find(c => c.type === 'BODY')?.text ?? '';
                return (
                  <button key={t.name + t.language} onClick={() => pickTemplate(t)} style={{
                    background: active ? C.purpleSoft : C.creamDeep,
                    border: active ? `1.5px solid ${C.purple}` : '1.5px solid transparent',
                    borderRadius: 10, padding: '8px 12px',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    <span className="mono-font" style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{t.name} <span style={{ fontSize: 10, color: C.inkLight }}>· {t.language}</span></span>
                    <span style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {body}
                    </span>
                  </button>
                );
              })}
              {templates.length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: C.inkSoft, textAlign: 'center', background: C.creamDeep, borderRadius: 8 }}>
                  Aucun template approuvé. <Link to="/admin/whatsapp/templates" style={{ color: C.purple, fontWeight: 600 }}>Gérer →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Condition */}
          <div style={{ background: C.aiSoft, borderRadius: 12, padding: 14 }}>
            <div className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>
              ⚡ Condition de déclenchement
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Statut</label>
                <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }}>
                  <option value="all">Tous</option>
                  <option value="new">Nouveaux</option>
                  <option value="contacted">Contactés</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Urgence</label>
                <select value={urgencyF} onChange={e => setUrgencyF(e.target.value)} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }}>
                  <option value="all">Toutes</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">Haute</option>
                  <option value="normal">Normale</option>
                  <option value="low">Faible</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Nb leads min</label>
                <input type="number" min={1} value={minLeadCount} onChange={e => setMinLeadCount(parseInt(e.target.value, 10) || 1)} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, border: '1.5px solid rgba(10,42,32,0.1)', background: C.cream, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Créés depuis (min)</label>
                <input type="number" min={1} value={maxLeadAgeMinutes} onChange={e => setMaxLeadAgeMinutes(parseInt(e.target.value, 10) || 60)} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, border: '1.5px solid rgba(10,42,32,0.1)', background: C.cream, outline: 'none' }} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={requireNotContacted} onChange={e => setRequireNotContacted(e.target.checked)} />
              Uniquement les leads jamais contactés
            </label>
          </div>

          {/* Cooldown */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Cooldown — délai entre 2 déclenchements (minutes)
            </label>
            <input type="number" min={1} value={cooldownMinutes} onChange={e => setCooldownMinutes(parseInt(e.target.value, 10) || 60)}
              style={{ width: 160, padding: '8px 12px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, border: '1.5px solid rgba(10,42,32,0.1)', background: C.creamDeep, outline: 'none' }} />
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
              Évite que la règle déclenche en boucle. Recommandé : 60 min.
            </div>
          </div>

          {/* Prefill */}
          {pickedTemplate && bodyParams.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={prefillFromLead} onChange={e => setPrefillFromLead(e.target.checked)} />
              Pré-remplir <span className="mono-font">{`{{1}}`}</span>=nom du lead, <span className="mono-font">{`{{2}}`}</span>=besoin
            </label>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(10,42,32,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} className="btn-secondary" disabled={creating}>Annuler</button>
          <button onClick={create} disabled={creating || !pickedTemplate || !name.trim()} className="btn-primary">
            <Zap size={14} /> {creating ? 'Création…' : 'Créer la règle'}
          </button>
        </div>
      </div>
    </div>
  );
}
