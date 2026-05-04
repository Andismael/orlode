/**
 * Lead Detail Page PRO
 * Heat Score · Next Action · Linked Quotes · Invoices (Accounting bridge) · Timeline
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useCurrency } from '@/hooks/useCurrency';
import {
  ArrowLeft, Mail, Phone, FileText, Sparkles, Flame, Snowflake, Thermometer,
  Clock, MessageCircle, ArrowRight, Trophy, Send, CheckCircle, Target, StickyNote,
  Loader2, AlertTriangle, Receipt, DollarSign, Calendar, Zap,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface Lead {
  id: string; name: string; company: string; email: string; phone: string;
  score: number; stage: string; source: string; estimatedValue: number;
  notes: string; owner: string; createdAt: string;
  interactions: { date: string; type: string; summary: string; by?: string }[];
}

interface QuoteInfo { id: string; quoteNumber: string; clientName: string; totalTTC: number; status: string; sentTo?: string; validUntil?: string }
interface InvoiceInfo { id: string; number: string; totalTTC: number; status: string; paidAmount: number; dueDate: string }
interface FollowupInfo { id: string; scheduledAt: string; type: string; notes: string; overdue: boolean }

interface FullLead {
  lead: Lead;
  quotes: QuoteInfo[];
  invoices: InvoiceInfo[];
  nextFollowup: FollowupInfo | null;
  nextAction: string;
}

interface TimelineEvent {
  date: string; type: string; icon: string; title: string; detail: string; color: string;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */

const STAGE_LABELS: Record<string, string> = {
  nouveau: 'Nouveau', contacte: 'Contacte', interesse: 'Interesse',
  devis_envoye: 'Devis envoye', negociation: 'Negociation', gagne: 'Gagne', perdu: 'Perdu',
};
const STAGE_COLORS: Record<string, string> = {
  nouveau: 'bg-blue-100 text-blue-700', contacte: 'bg-purple-100 text-purple-700',
  interesse: 'bg-yellow-100 text-yellow-700', devis_envoye: 'bg-orange-100 text-orange-700',
  negociation: 'bg-red-100 text-red-700', gagne: 'bg-green-100 text-green-700', perdu: 'bg-gray-200 text-gray-600',
};

function getHeat(score: number) {
  if (score >= 80) return { label: 'Tres chaud', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: Flame, gradient: 'from-red-500 to-orange-500' };
  if (score >= 60) return { label: 'Chaud', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: Flame, gradient: 'from-orange-400 to-yellow-400' };
  if (score >= 40) return { label: 'Tiede', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Thermometer, gradient: 'from-yellow-400 to-yellow-300' };
  if (score >= 20) return { label: 'Froid', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', icon: Snowflake, gradient: 'from-blue-400 to-cyan-300' };
  return { label: 'Tres froid', color: 'text-blue-300', bg: 'bg-blue-50', border: 'border-blue-100', icon: Snowflake, gradient: 'from-cyan-300 to-blue-200' };
}

const QUOTE_STATUS: Record<string, { label: string; style: string }> = {
  draft: { label: 'Brouillon', style: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Envoye', style: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepte', style: 'bg-green-100 text-green-700' },
  rejected: { label: 'Refuse', style: 'bg-red-100 text-red-600' },
};
const INV_STATUS: Record<string, { label: string; style: string }> = {
  pending: { label: 'En attente', style: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'Payee', style: 'bg-green-100 text-green-700' },
  partial: { label: 'Partiel', style: 'bg-orange-100 text-orange-700' },
  overdue: { label: 'En retard', style: 'bg-red-100 text-red-700' },
};

const ICON_MAP: Record<string, typeof Mail> = {
  Target, Mail, MessageCircle, Phone, FileText, Send, CheckCircle, ArrowRight,
  Trophy, StickyNote, Circle: Clock, Receipt, DollarSign,
};
const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600' }, purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600' }, orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' }, emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-500' }, red: { bg: 'bg-red-100', text: 'text-red-600' },
};

/* ── Component ──────────────────────────────────────────────────────────────── */

export default function LeadDetailPage() {
  const { id: leadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLangStore();
  const { symbol, formatLocal } = useCurrency();
  const [data, setData] = useState<FullLead | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<FullLead>(`/sales/leads/${leadId}/full`).then(r => setData(r.data ?? null)),
      api.get<TimelineEvent[]>(`/sales/leads/${leadId}/timeline`).then(r => setTimeline(Array.isArray(r.data) ? r.data : [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [leadId]);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  if (!data) return <div className="p-6 text-sm text-red-500">Lead introuvable</div>;

  const { lead, quotes, invoices, nextFollowup, nextAction } = data;
  const heat = getHeat(lead.score);
  const HeatIcon = heat.icon;
  const lastInteraction = lead.interactions?.length > 0 ? lead.interactions[lead.interactions.length - 1] : null;
  const daysSinceContact = lastInteraction ? Math.floor((Date.now() - new Date(lastInteraction.date).getTime()) / 86400000) : null;

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <button onClick={() => navigate('/sales/leads')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Leads
      </button>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{lead.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STAGE_COLORS[lead.stage] ?? 'bg-gray-100 text-gray-600'}`}>{STAGE_LABELS[lead.stage] ?? lead.stage}</span>
            </div>
            {lead.company && <p className="text-sm text-gray-500 mt-1">{lead.company}</p>}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span>Source: {lead.source}</span>
              {lead.estimatedValue > 0 && <span className="text-sm font-bold text-gray-900">{lead.estimatedValue.toLocaleString()} ${symbol}</span>}
              {lead.owner && <span>Resp: {lead.owner}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {lead.email && <a href={`mailto:${lead.email}`} className="p-2 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200" title="Email"><Mail size={14} className="text-gray-600" /></a>}
            {lead.phone && <a href={`tel:${lead.phone}`} className="p-2 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-200" title="Appeler"><Phone size={14} className="text-gray-600" /></a>}
            <Link to="/sales/quotes" className="p-2 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200" title="Nouveau devis"><FileText size={14} className="text-gray-600" /></Link>
          </div>
        </div>
      </div>

      {/* ── Next Action (prominent) ───────────────────────────────────────────── */}
      {nextAction && (
        <div className={`rounded-xl p-4 flex items-center gap-3 border ${nextFollowup?.overdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${nextFollowup?.overdue ? 'bg-red-100' : 'bg-blue-100'}`}>
            <Zap size={16} className={nextFollowup?.overdue ? 'text-red-600' : 'text-blue-600'} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Prochaine action</p>
            <p className={`text-sm font-medium ${nextFollowup?.overdue ? 'text-red-700' : 'text-gray-800'}`}>{nextAction}</p>
          </div>
          {nextFollowup && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">Relance prevue</p>
              <p className={`text-xs font-semibold ${nextFollowup.overdue ? 'text-red-600' : 'text-gray-700'}`}>
                {new Date(nextFollowup.scheduledAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} — {nextFollowup.type}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Heat Score ────────────────────────────────────────────────────────── */}
      <div className={`rounded-xl border ${heat.border} ${heat.bg} p-5`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HeatIcon size={20} className={heat.color} />
            <span className={`text-lg font-bold ${heat.color}`}>{lead.score}/100</span>
            <span className={`text-sm font-medium ${heat.color}`}>{heat.label}</span>
          </div>
        </div>
        <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
          <div className={`h-full rounded-full bg-gradient-to-r ${heat.gradient} transition-all duration-500`} style={{ width: `${lead.score}%` }} />
        </div>
        <div className="grid grid-cols-5 gap-3 mt-3 text-xs">
          <div className="text-center"><p className="text-gray-400">Etape</p><p className="font-semibold text-gray-700">{STAGE_LABELS[lead.stage] ?? lead.stage}</p></div>
          <div className="text-center"><p className="text-gray-400">Interactions</p><p className="font-semibold text-gray-700">{lead.interactions?.length ?? 0}</p></div>
          <div className="text-center"><p className="text-gray-400">Valeur</p><p className="font-semibold text-gray-700">{lead.estimatedValue > 0 ? `${lead.estimatedValue.toLocaleString()} ${symbol}` : '—'}</p></div>
          <div className="text-center"><p className="text-gray-400">Dernier contact</p><p className="font-semibold text-gray-700">{lastInteraction ? `${daysSinceContact}j` : '—'}</p></div>
          <div className="text-center"><p className="text-gray-400">Devis</p><p className="font-semibold text-gray-700">{quotes.length}</p></div>
        </div>
      </div>

      {/* ── Contact + Notes ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Contact</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><Mail size={13} className="text-gray-400 mt-0.5" /><span className="text-gray-700">{lead.email || '—'}</span></div>
            <div className="flex gap-2"><Phone size={13} className="text-gray-400 mt-0.5" /><span className="text-gray-700">{lead.phone || '—'}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Notes</h2>
          <p className="text-sm text-gray-600">{lead.notes || 'Aucune note'}</p>
        </div>
      </div>

      {/* ── Linked Quotes ─────────────────────────────────────────────────────── */}
      {quotes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2"><FileText size={14} className="text-indigo-500" /> Devis lies ({quotes.length})</h2>
          <div className="space-y-2">
            {quotes.map(q => {
              const st = QUOTE_STATUS[q.status] ?? { label: q.status, style: 'bg-gray-100 text-gray-600' };
              return (
                <div key={q.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <FileText size={14} className="text-indigo-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{q.quoteNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.style}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">{q.totalTTC.toLocaleString()} ${symbol}{q.sentTo ? ` · Envoye a ${q.sentTo}` : ''}{q.validUntil ? ` · Valide jusqu'au ${q.validUntil}` : ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Linked Invoices (Accounting Bridge) ───────────────────────────────── */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2"><Receipt size={14} className="text-emerald-500" /> Factures ({invoices.length}) — Pont Comptabilite</h2>
          <div className="space-y-2">
            {invoices.map(inv => {
              const st = INV_STATUS[inv.status] ?? { label: inv.status, style: 'bg-gray-100 text-gray-600' };
              const remaining = inv.totalTTC - inv.paidAmount;
              const dueDate = new Date(inv.dueDate);
              const isOverdue = inv.status !== 'paid' && dueDate < new Date();
              return (
                <div key={inv.id} className={`flex items-center gap-3 p-3 rounded-xl ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <Receipt size={14} className={isOverdue ? 'text-red-400' : 'text-emerald-400'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{inv.number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.style}`}>{st.label}</span>
                      {isOverdue && <span className="flex items-center gap-1 text-xs text-red-500"><AlertTriangle size={10} /> En retard</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      {inv.totalTTC.toLocaleString()} ${symbol}
                      {inv.status === 'partial' && ` · Reste: ${remaining.toLocaleString()} ${symbol}`}
                      {inv.status === 'paid' && ' · Paye integralement'}
                      {` · Echeance: ${dueDate.toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                  {inv.status === 'paid' && <DollarSign size={16} className="text-green-500" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Timeline ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
          <Clock size={14} className="text-gray-400" /> Parcours complet
        </h2>
        {timeline === null ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucun evenement enregistre.</p>
        ) : (
          <div className="relative pl-6 space-y-0">
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
            {timeline.map((event, i) => {
              const colors = COLOR_MAP[event.color] ?? COLOR_MAP.gray;
              const Icon = ICON_MAP[event.icon] ?? Clock;
              const date = new Date(event.date);
              return (
                <div key={i} className="relative flex gap-3 py-2.5">
                  <div className={`absolute -left-6 w-6 h-6 rounded-full ${colors.bg} flex items-center justify-center z-10 border-2 border-white`}>
                    <Icon size={11} className={colors.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{event.title}</span>
                      <span className="text-xs text-gray-400">
                        {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{event.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
