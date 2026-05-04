import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Mail, FileText, Share2, ChevronDown, ChevronUp, Zap, CheckCircle2, XCircle, Loader2, Sparkles, PlayCircle, Edit3, Trash2, AlertTriangle, Settings } from 'lucide-react';

interface MeetingSummary {
  id: string; title: string; date: string; duration: number;
  participants: string[]; summary: string; decisions: string[];
  actionItems: { description: string; assignee: string; deadline: string; status: string }[];
  transcript: { timestamp: string; speaker: string; text: string }[];
  sentiment: 'positive'|'neutral'|'negative';
}

interface DetectedAction {
  id: string;
  type: string;
  confidence: number;
  status: 'pending' | 'validated' | 'executing' | 'executed' | 'rejected' | 'modified' | 'failed';
  params: Record<string, unknown>;
  sourceQuote?: string;
  executeResult?: { success: boolean; message: string };
  autoExecuted?: boolean;
}

/** Fields to expose per action type in the inline edit form. */
const EDITABLE_FIELDS: Record<string, Array<{ key: string; label: string; type?: 'text' | 'date' | 'time' | 'email' | 'textarea' | 'number' }>> = {
  create_appointment: [
    { key: 'clientName', label: 'Nom client' },
    { key: 'clientPhone', label: 'Téléphone' },
    { key: 'clientEmail', label: 'Email', type: 'email' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'time', label: 'Heure', type: 'time' },
    { key: 'service', label: 'Service' },
  ],
  create_reservation: [
    { key: 'clientName', label: 'Nom client' },
    { key: 'clientPhone', label: 'Téléphone' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'time', label: 'Heure', type: 'time' },
    { key: 'resourceType', label: 'Type (table, chambre...)' },
  ],
  add_client: [
    { key: 'clientName', label: 'Nom' },
    { key: 'clientPhone', label: 'Téléphone' },
    { key: 'clientEmail', label: 'Email', type: 'email' },
  ],
  create_lead: [
    { key: 'clientName', label: 'Nom prospect' },
    { key: 'clientPhone', label: 'Téléphone' },
    { key: 'clientEmail', label: 'Email', type: 'email' },
    { key: 'interest', label: 'Intérêt' },
    { key: 'estimatedValue', label: 'Valeur estimée (€)', type: 'number' },
  ],
  create_quote_request: [
    { key: 'clientName', label: 'Client' },
    { key: 'clientEmail', label: 'Email', type: 'email' },
    { key: 'note', label: 'Note', type: 'textarea' },
  ],
  send_email: [
    { key: 'to', label: 'Destinataire', type: 'email' },
    { key: 'subject', label: 'Sujet' },
    { key: 'body', label: 'Message', type: 'textarea' },
  ],
  create_support_ticket: [
    { key: 'subject', label: 'Sujet' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'priority', label: 'Priorité' },
  ],
  reminder: [
    { key: 'note', label: 'Rappel', type: 'textarea' },
  ],
};

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  create_appointment:   { label: 'Prendre RDV',       icon: '📅', color: '#3b82f6' },
  create_reservation:   { label: 'Réserver',          icon: '🏨', color: '#8b5cf6' },
  add_client:           { label: 'Ajouter contact',   icon: '👤', color: '#10b981' },
  create_lead:          { label: 'Créer lead',        icon: '🎯', color: '#f59e0b' },
  create_quote_request: { label: 'Demande devis',     icon: '📋', color: '#ec4899' },
  send_email:           { label: 'Envoyer email',     icon: '✉️', color: '#6366f1' },
  create_support_ticket:{ label: 'Ticket support',    icon: '🎫', color: '#ef4444' },
  reminder:             { label: 'Rappel manuel',     icon: '🔔', color: '#9ca3af' },
};

export default function MeetingSummaryPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { t } = useLangStore();
  const [data, setData] = useState<MeetingSummary | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<DetectedAction[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editParams, setEditParams] = useState<Record<string, unknown>>({});
  const [engineMode, setEngineMode] = useState<'manual' | 'semi_auto' | 'auto'>('semi_auto');
  const [engineThreshold, setEngineThreshold] = useState(0.9);
  const [showEngineCfg, setShowEngineCfg] = useState(false);

  const loadEngineConfig = useCallback(async () => {
    try {
      const r = await api.get('/meetings/action-engine/config');
      const d = (r.data ?? {}) as { mode?: 'manual' | 'semi_auto' | 'auto'; autoExecuteThreshold?: number };
      if (d.mode) setEngineMode(d.mode);
      if (typeof d.autoExecuteThreshold === 'number') setEngineThreshold(d.autoExecuteThreshold);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadEngineConfig(); }, [loadEngineConfig]);

  const saveEngineConfig = async (mode: 'manual' | 'semi_auto' | 'auto', threshold: number) => {
    setEngineMode(mode); setEngineThreshold(threshold);
    try { await api.patch('/meetings/action-engine/config', { mode, autoExecuteThreshold: threshold }); }
    catch { /* ignore */ }
  };

  const loadActions = useCallback(async () => {
    if (!meetingId) return;
    try {
      const r = await api.get(`/meetings/${meetingId}/actions`);
      setActions((r.data ?? []) as DetectedAction[]);
    } catch { /* ignore */ }
  }, [meetingId]);

  useEffect(() => {
    api.get(`/meetings/${meetingId}`).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
    loadActions();
  }, [meetingId, loadActions]);

  const detectActions = async () => {
    if (!meetingId) return;
    setDetecting(true);
    try {
      await api.post(`/meetings/${meetingId}/detect-actions`);
      await loadActions();
    } finally { setDetecting(false); }
  };

  const executeAction = async (id: string) => {
    setBusyId(id);
    try { await api.post(`/meetings/${meetingId}/actions/${id}/execute`); await loadActions(); }
    finally { setBusyId(null); }
  };

  const rejectAction = async (id: string) => {
    setBusyId(id);
    try { await api.delete(`/meetings/${meetingId}/actions/${id}`); await loadActions(); }
    finally { setBusyId(null); }
  };

  const executeAll = async () => {
    const pending = actions.filter(a => a.status === 'pending' || a.status === 'validated' || a.status === 'modified' || a.status === 'failed');
    for (const a of pending) {
      setBusyId(a.id);
      try { await api.post(`/meetings/${meetingId}/actions/${a.id}/execute`); }
      catch { /* continue */ }
    }
    setBusyId(null);
    loadActions();
  };

  const startEdit = (a: DetectedAction) => {
    setEditingId(a.id);
    setEditParams({ ...a.params });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditParams({});
  };

  const saveEdit = async (id: string) => {
    setBusyId(id);
    try {
      await api.patch(`/meetings/${meetingId}/actions/${id}`, { params: editParams, status: 'modified' });
      setEditingId(null);
      setEditParams({});
      await loadActions();
    } finally { setBusyId(null); }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400">{`${t('loading')}`}</div>;
  if (!data) return <div className="p-6 text-sm text-red-500">Réunion introuvable</div>;

  const sentimentColor = data.sentiment === 'positive' ? 'text-green-600 bg-green-100' : data.sentiment === 'negative' ? 'text-red-600 bg-red-100' : 'text-gray-600 bg-gray-100';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{data.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(data.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}{Math.round(data.duration / 60)} min
              {' · '}{data.participants.length} participants
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${sentimentColor}`}>{data.sentiment}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {data.participants.map(p => (
            <span key={p} className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">{p}</span>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Résumé</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{data.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Decisions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Décisions clés</h2>
          <ul className="space-y-2">
            {data.decisions.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-blue-500 font-bold flex-shrink-0">{i + 1}.</span> {d}
              </li>
            ))}
          </ul>
        </div>

        {/* Action items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Action Items</h2>
          <div className="space-y-2">
            {data.actionItems.map((item, i) => (
              <div key={i} className="text-sm border-l-2 border-blue-400 pl-2">
                <p className="text-gray-800">{item.description}</p>
                <p className="text-xs text-gray-500">{item.assignee} · {item.deadline}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ ACTION ENGINE ═══ */}
      <div className="bg-gradient-to-br from-violet-50 via-blue-50 to-indigo-50 dark:from-violet-900/20 dark:via-blue-900/20 dark:to-indigo-900/20 rounded-2xl border-2 border-violet-200 dark:border-violet-700 p-5">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Zap size={22} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Action Engine
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-600 text-white">IA</span>
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Transforme les décisions de cette réunion en actions concrètes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEngineCfg(v => !v)}
              title="Mode d'autonomie"
              className="flex items-center gap-1.5 px-2.5 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm">
              <Settings size={13} />
              {engineMode === 'manual' ? 'Manuel' : engineMode === 'semi_auto' ? 'Semi-auto' : `Auto ≥${Math.round(engineThreshold * 100)}%`}
            </button>
            {actions.filter(a => a.status === 'pending' || a.status === 'validated' || a.status === 'modified' || a.status === 'failed').length > 0 && (
              <button onClick={executeAll} disabled={!!busyId}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 shadow-sm">
                <PlayCircle size={14} /> Tout exécuter
              </button>
            )}
            <button onClick={detectActions} disabled={detecting}
              className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 shadow-sm">
              {detecting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {actions.length === 0 ? 'Détecter les actions' : 'Re-scanner'}
            </button>
          </div>
        </div>

        {/* Autonomy mode settings (collapsible) */}
        {showEngineCfg && (
          <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-violet-200 dark:border-violet-800">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Mode d'autonomie</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {([
                { id: 'manual' as const, label: 'Manuel', desc: 'Rien ne s\'exécute sans validation' },
                { id: 'semi_auto' as const, label: 'Semi-auto', desc: 'IA pré-remplit, humain valide' },
                { id: 'auto' as const, label: 'Auto', desc: 'Exécute si confiance ≥ seuil' },
              ]).map(opt => (
                <button key={opt.id} onClick={() => saveEngineConfig(opt.id, engineThreshold)}
                  className={`p-2 rounded-lg text-left border-2 transition-all ${
                    engineMode === opt.id ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-violet-300'
                  }`}>
                  <p className="text-xs font-bold text-gray-800 dark:text-white">{opt.label}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{opt.desc}</p>
                </button>
              ))}
            </div>
            {engineMode === 'auto' && (
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Seuil de confiance auto : {Math.round(engineThreshold * 100)}%
                </label>
                <input type="range" min={0.5} max={1} step={0.05}
                  value={engineThreshold}
                  onChange={e => saveEngineConfig(engineMode, Number(e.target.value))}
                  className="w-full mt-1" />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  Emails et devis ne s'exécutent jamais en auto (sécurité).
                </p>
              </div>
            )}
          </div>
        )}

        {actions.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            {detecting ? 'Analyse du transcript en cours...' : 'Clique "Détecter les actions" pour que l\'IA extraie les décisions du transcript.'}
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map(a => {
              const meta = ACTION_LABELS[a.type] ?? { label: a.type, icon: '⚙️', color: '#6b7280' };
              const confColor = a.confidence >= 0.85 ? '#16a34a' : a.confidence >= 0.6 ? '#f59e0b' : '#ef4444';
              const confLabel = a.confidence >= 0.85 ? 'Sûr' : a.confidence >= 0.6 ? 'À vérifier' : 'Incertain';
              return (
                <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex items-start gap-3">
                  <div className="text-2xl shrink-0 mt-0.5" style={{ color: meta.color }}>{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">{meta.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${confColor}20`, color: confColor }}>
                        {confLabel} · {Math.round(a.confidence * 100)}%
                      </span>
                      {a.status === 'executed' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={10} /> Exécutée{a.autoExecuted ? ' · auto' : ''}
                        </span>
                      )}
                      {a.status === 'executing' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> En cours
                        </span>
                      )}
                      {a.status === 'modified' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Modifiée</span>
                      )}
                      {a.status === 'failed' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold flex items-center gap-1">
                          <AlertTriangle size={10} /> Échec
                        </span>
                      )}
                      {a.status === 'rejected' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Rejetée</span>
                      )}
                    </div>

                    {/* Inline edit form */}
                    {editingId === a.id ? (
                      <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        {(EDITABLE_FIELDS[a.type] ?? []).map(f => {
                          const val = editParams[f.key];
                          const strVal = val == null ? '' : String(val);
                          const colSpan = f.type === 'textarea' ? 'col-span-2' : '';
                          return (
                            <div key={f.key} className={`flex flex-col gap-0.5 ${colSpan}`}>
                              <label className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">{f.label}</label>
                              {f.type === 'textarea' ? (
                                <textarea
                                  value={strVal}
                                  onChange={e => setEditParams(p => ({ ...p, [f.key]: e.target.value }))}
                                  rows={2}
                                  className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                              ) : (
                                <input
                                  type={f.type ?? 'text'}
                                  value={strVal}
                                  onChange={e => setEditParams(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                  className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                              )}
                            </div>
                          );
                        })}
                        <div className="col-span-2 flex items-center justify-end gap-2 mt-1">
                          <button onClick={cancelEdit} className="text-xs px-2 py-1 text-gray-600 hover:text-gray-900">Annuler</button>
                          <button onClick={() => saveEdit(a.id)} disabled={busyId === a.id}
                            className="text-xs px-3 py-1 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50">
                            {busyId === a.id ? <Loader2 size={12} className="animate-spin inline" /> : 'Enregistrer'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
                        {a.params['clientName'] ? <div>👤 {String(a.params['clientName'])}</div> : null}
                        {a.params['date'] && a.params['time'] ? <div>📅 {String(a.params['date'])} à {String(a.params['time'])}</div> : null}
                        {a.params['service'] ? <div>🛠️ {String(a.params['service'])}</div> : null}
                        {a.params['interest'] ? <div>💡 {String(a.params['interest'])}</div> : null}
                        {a.params['to'] ? <div>✉️ {String(a.params['to'])}</div> : null}
                        {a.params['subject'] ? <div>📧 {String(a.params['subject'])}</div> : null}
                        {/* Missing fields warning for low confidence */}
                        {a.confidence < 0.7 && (EDITABLE_FIELDS[a.type] ?? []).some(f => !a.params[f.key]) && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-1">
                            <AlertTriangle size={11} /> Champs manquants — cliquer Modifier pour compléter
                          </div>
                        )}
                      </div>
                    )}
                    {a.sourceQuote && editingId !== a.id && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 italic mt-1 border-l-2 border-gray-300 pl-2">
                        "{a.sourceQuote}"
                      </p>
                    )}
                    {a.executeResult && (
                      <p className={`text-[11px] mt-1 flex items-center gap-1 ${a.executeResult.success ? 'text-green-700' : 'text-red-700'}`}>
                        {a.executeResult.success ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        {a.executeResult.message}
                      </p>
                    )}
                  </div>
                  {a.status !== 'executed' && a.status !== 'rejected' && a.status !== 'executing' && editingId !== a.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => executeAction(a.id)} disabled={busyId === a.id}
                        title="Valider et exécuter"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50">
                        {busyId === a.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Valider
                      </button>
                      <button onClick={() => startEdit(a)} disabled={busyId === a.id}
                        title="Modifier avant exécution"
                        className="p-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50">
                        <Edit3 size={12} />
                      </button>
                      <button onClick={() => rejectAction(a.id)} disabled={busyId === a.id}
                        title="Rejeter"
                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50" onClick={() => setTranscriptOpen(!transcriptOpen)}>
          <h2 className="font-semibold text-gray-800">Transcript complet</h2>
          {transcriptOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {transcriptOpen && (
          <div className="border-t border-gray-100 max-h-80 overflow-y-auto divide-y divide-gray-50">
            {data.transcript.map((line, i) => (
              <div key={i} className="px-5 py-2.5">
                <span className="text-xs text-gray-400 font-mono mr-2">{line.timestamp}</span>
                <span className="text-xs font-semibold text-gray-700">{line.speaker}:</span>
                <span className="text-sm text-gray-600 ml-1">{line.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => api.post(`/meetings/${meetingId}/send-summary`)}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <Mail size={14} /> Envoyer par email
        </button>
        <button onClick={() => api.post(`/meetings/${meetingId}/export`)}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <FileText size={14} /> Exporter PDF
        </button>
        <button className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <Share2 size={14} /> Partager
        </button>
      </div>
    </div>
  );
}
