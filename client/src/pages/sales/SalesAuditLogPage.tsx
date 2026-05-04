/**
 * Sales Audit Log — Centralized compliance-grade audit trail viewer
 * WHO did WHAT, WHEN, with BEFORE/AFTER values
 */
import { useEffect, useState } from 'react';
import { Loader2, Shield, Filter, ChevronDown, ChevronUp, Clock, User as UserIcon } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceLabel?: string;
  actor: { uid: string; email: string; role?: string };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  timestamp?: { _seconds: number };
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  'lead.created':               { label: 'Lead cree',               color: 'bg-blue-100 text-blue-700',   icon: '+' },
  'lead.updated':               { label: 'Lead modifie',            color: 'bg-gray-100 text-gray-600',   icon: '~' },
  'lead.deleted':               { label: 'Lead supprime',           color: 'bg-red-100 text-red-700',     icon: 'x' },
  'lead.stage_changed':         { label: 'Etape modifiee',          color: 'bg-purple-100 text-purple-700', icon: '>' },
  'lead.scored':                { label: 'Lead score',              color: 'bg-yellow-100 text-yellow-700', icon: '#' },
  'client.created':             { label: 'Client cree',             color: 'bg-blue-100 text-blue-700',   icon: '+' },
  'client.updated':             { label: 'Client modifie',          color: 'bg-gray-100 text-gray-600',   icon: '~' },
  'quote.created':              { label: 'Devis cree',              color: 'bg-blue-100 text-blue-700',   icon: '+' },
  'quote.sent':                 { label: 'Devis envoye',            color: 'bg-indigo-100 text-indigo-700', icon: '>' },
  'quote.accepted':             { label: 'Devis accepte',           color: 'bg-green-100 text-green-700', icon: 'v' },
  'quote.rejected':             { label: 'Devis refuse',            color: 'bg-red-100 text-red-700',     icon: 'x' },
  'quote.deleted':              { label: 'Devis supprime',          color: 'bg-red-100 text-red-700',     icon: 'x' },
  'quote.converted_to_invoice': { label: 'Converti en facture',     color: 'bg-emerald-100 text-emerald-700', icon: '$' },
  'deal.stage_changed':         { label: 'Pipeline deplace',        color: 'bg-purple-100 text-purple-700', icon: '>' },
  'deal.won':                   { label: 'Deal gagne',              color: 'bg-green-100 text-green-700', icon: 'v' },
  'deal.lost':                  { label: 'Deal perdu',              color: 'bg-red-100 text-red-700',     icon: 'x' },
  'followup.created':           { label: 'Relance creee',           color: 'bg-orange-100 text-orange-700', icon: '+' },
  'followup.completed':         { label: 'Relance terminee',        color: 'bg-green-100 text-green-700', icon: 'v' },
  'followup.deleted':           { label: 'Relance supprimee',       color: 'bg-red-100 text-red-700',     icon: 'x' },
  'followup.auto_run':          { label: 'Auto-relance',            color: 'bg-orange-100 text-orange-700', icon: '!' },
  'message.email_sent':         { label: 'Email envoye',            color: 'bg-blue-100 text-blue-700',   icon: '@' },
  'message.whatsapp_sent':      { label: 'WhatsApp envoye',         color: 'bg-green-100 text-green-700', icon: 'W' },
};

const RESOURCE_TYPES = ['lead', 'client', 'quote', 'invoice', 'followup', 'message'];

export default function SalesAuditLogPage() {
  const { t } = useLangStore();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterAction) params.set('action', filterAction);
    if (filterResource) params.set('resourceType', filterResource);
    setLoading(true);
    api.get<AuditEntry[]>(`/sales/audit-logs?${params}`)
      .then(r => setEntries(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterAction, filterResource]);

  const getTime = (entry: AuditEntry) => {
    if (entry.timestamp?._seconds) return new Date(entry.timestamp._seconds * 1000);
    if (entry.createdAt) return new Date(entry.createdAt);
    return new Date();
  };

  const formatDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatTime = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const renderDiff = (before?: Record<string, unknown>, after?: Record<string, unknown>) => {
    if (!before && !after) return null;
    const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    if (allKeys.size === 0) return null;
    return (
      <div className="mt-2 text-xs space-y-1">
        {Array.from(allKeys).map(key => {
          const b = before?.[key];
          const a = after?.[key];
          const bStr = b !== undefined ? String(b) : '—';
          const aStr = a !== undefined ? String(a) : '—';
          if (bStr === aStr) return null;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-gray-400 w-24 shrink-0 font-mono">{key}</span>
              {b !== undefined && <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded line-through">{bStr}</span>}
              {b !== undefined && a !== undefined && <span className="text-gray-300">→</span>}
              {a !== undefined && <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded">{aStr}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center"><Shield size={18} className="text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Journal d'audit</h1>
            <p className="text-sm text-gray-500">Historique complet des actions commerciales</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-gray-500"><Filter size={13} /> Filtrer :</div>
        <select value={filterResource} onChange={e => setFilterResource(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm bg-white">
          <option value="">Tous les types</option>
          {RESOURCE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm bg-white">
          <option value="">Toutes les actions</option>
          {Object.keys(ACTION_LABELS).map(a => <option key={a} value={a}>{ACTION_LABELS[a].label}</option>)}
        </select>
        {(filterAction || filterResource) && (
          <button onClick={() => { setFilterAction(''); setFilterResource(''); }} className="px-3 py-1.5 text-xs text-blue-600 hover:underline">Reinitialiser</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Shield size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Aucune entree dans le journal d'audit.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => {
            const info = ACTION_LABELS[entry.action] ?? { label: entry.action, color: 'bg-gray-100 text-gray-600', icon: '?' };
            const time = getTime(entry);
            const isExpanded = expanded === entry.id;
            const hasDiff = entry.before || entry.after || entry.metadata;
            return (
              <div key={entry.id}
                className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${hasDiff ? 'cursor-pointer' : ''}`}
                onClick={() => hasDiff && setExpanded(isExpanded ? null : entry.id)}>
                <div className="px-4 py-3 flex items-center gap-3">
                  {/* Icon */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${info.color}`}>
                    {info.icon}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>{info.label}</span>
                      {entry.resourceLabel && <span className="text-sm font-semibold text-gray-800">{entry.resourceLabel}</span>}
                      <span className="text-xs text-gray-400 font-mono">{entry.resourceType}/{entry.resourceId.slice(0, 8)}</span>
                    </div>
                  </div>
                  {/* Actor */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <UserIcon size={11} />
                      <span>{entry.actor?.email ?? '?'}</span>
                      {entry.actor?.role && <span className="px-1 py-0.5 bg-gray-100 rounded text-gray-400">{entry.actor.role}</span>}
                    </div>
                  </div>
                  {/* Time */}
                  <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0 w-32 text-right">
                    <Clock size={11} />
                    <span>{formatDate(time)} {formatTime(time)}</span>
                  </div>
                  {hasDiff && (isExpanded ? <ChevronUp size={13} className="text-gray-300" /> : <ChevronDown size={13} className="text-gray-300" />)}
                </div>

                {/* Expanded diff */}
                {isExpanded && hasDiff && (
                  <div className="px-4 pb-3 border-t border-gray-50 bg-gray-50/30">
                    {renderDiff(entry.before, entry.after)}
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="mt-2 text-xs">
                        <span className="text-gray-400">Contexte: </span>
                        <span className="text-gray-600 font-mono">{JSON.stringify(entry.metadata)}</span>
                      </div>
                    )}
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
