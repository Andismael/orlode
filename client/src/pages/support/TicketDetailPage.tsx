/**
 * TicketDetailPage PRO — Conversation, AI suggest, SLA timer, client history, canned responses
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Loader2, Clock, AlertTriangle, Star, Sparkles,
  User, Bot, MessageCircle, ChevronDown, ChevronUp, Flame, CheckCircle,
} from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface Message { id: string; content: string; role: string; authorName: string; createdAt: string }
interface TicketData {
  id: string; ticketNumber: string; title: string; description: string;
  customerName: string; customerEmail: string; status: string; priority: string;
  category: string; assignedTo: string; assignedToName: string;
  messages: Message[]; satisfaction: number | null;
  slaFirstResponseDeadline: string; slaResolutionDeadline: string;
  slaFirstResponseMet: boolean | null; slaResolutionMet: boolean | null;
  firstResponseAt: string | null; resolvedAt: string | null;
  createdAt: string;
}
interface AISuggestion { suggestion: string; sources: string[]; confidence: number }
interface HistoryTicket { id: string; ticketNumber: string; subject: string; title: string; status: string; createdAt: string }

const STATUS_STYLES: Record<string, { label: string; style: string }> = {
  open: { label: 'Ouvert', style: 'bg-blue-100 text-blue-700' },
  assigned: { label: 'Assigne', style: 'bg-purple-100 text-purple-700' },
  in_progress: { label: 'En cours', style: 'bg-yellow-100 text-yellow-700' },
  waiting_client: { label: 'Attente client', style: 'bg-orange-100 text-orange-700' },
  escalated: { label: 'Escalade', style: 'bg-red-100 text-red-700' },
  resolved: { label: 'Resolu', style: 'bg-green-100 text-green-700' },
  closed: { label: 'Ferme', style: 'bg-gray-100 text-gray-500' },
};
const ROLE_STYLES: Record<string, { icon: typeof User; bg: string; align: string }> = {
  client: { icon: User, bg: 'bg-gray-100 text-gray-800', align: 'justify-start' },
  agent: { icon: MessageCircle, bg: 'bg-blue-600 text-white', align: 'justify-end' },
  ai: { icon: Bot, bg: 'bg-purple-100 text-purple-800', align: 'justify-start' },
  system: { icon: AlertTriangle, bg: 'bg-yellow-50 text-yellow-700', align: 'justify-center' },
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLangStore();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [history, setHistory] = useState<HistoryTicket[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    api.get<TicketData>(`/support/tickets/${id}`)
      .then(r => setTicket(r.data ?? null))
      .catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const sendReply = async () => {
    if (!reply.trim() || !ticket) return;
    setSending(true);
    try {
      await api.post(`/support/tickets/${id}/messages`, { content: reply, role: 'agent' });
      setReply('');
      const r = await api.get<TicketData>(`/support/tickets/${id}`);
      setTicket(r.data ?? null);
    } catch {} finally { setSending(false); }
  };

  const changeStatus = async (status: string) => {
    await api.patch(`/support/tickets/${id}`, { status }).catch(() => {});
    const r = await api.get<TicketData>(`/support/tickets/${id}`);
    setTicket(r.data ?? null);
  };

  const autoAssign = async () => {
    await api.post(`/support/tickets/${id}/auto-assign`).catch(() => {});
    const r = await api.get<TicketData>(`/support/tickets/${id}`);
    setTicket(r.data ?? null);
  };

  const getAISuggestion = async () => {
    setLoadingAI(true);
    try {
      const r = await api.post<AISuggestion>(`/support/tickets/${id}/suggest`);
      setAiSuggestion(r.data ?? null);
    } catch {} finally { setLoadingAI(false); }
  };

  const loadHistory = async () => {
    if (history) { setShowHistory(!showHistory); return; }
    const r = await api.get<{ tickets: HistoryTicket[] }>(`/support/tickets/${id}/client-history`).catch(() => null);
    const data = r?.data as unknown as { tickets: HistoryTicket[] } | undefined;
    setHistory(data?.tickets ?? []);
    setShowHistory(true);
  };

  const submitRating = async (score: number) => {
    setRating(score);
    await api.patch(`/support/tickets/${id}/satisfaction`, { score }).catch(() => {});
  };

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  if (!ticket) return <div className="p-6 text-sm text-red-500">Ticket introuvable</div>;

  const st = STATUS_STYLES[ticket.status] ?? { label: ticket.status, style: 'bg-gray-100 text-gray-600' };
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';
  const slaResBreached = ticket.slaResolutionDeadline && new Date(ticket.slaResolutionDeadline) < new Date() && !isClosed;

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-4">
      <button onClick={() => navigate('/support')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Support
      </button>

      {/* Header */}
      <div className={`bg-white rounded-xl border shadow-sm p-5 ${slaResBreached ? 'border-red-200' : 'border-gray-100'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{ticket.ticketNumber}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.style}`}>{st.label}</span>
              {slaResBreached && <span className="flex items-center gap-1 text-xs text-red-500"><Flame size={10} /> SLA depasse</span>}
            </div>
            <h1 className="text-lg font-bold text-gray-900 mt-1">{ticket.title || ticket.description?.slice(0, 80)}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {ticket.customerName}{ticket.customerEmail ? ` (${ticket.customerEmail})` : ''} · {ticket.priority} · {ticket.category}
              {ticket.assignedToName && ` · Assigne: ${ticket.assignedToName}`}
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap shrink-0">
            {!ticket.assignedTo && <button onClick={autoAssign} className="px-3 py-1.5 text-xs border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50">Auto-assigner</button>}
            {ticket.status === 'open' && <button onClick={() => changeStatus('in_progress')} className="px-3 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50">En cours</button>}
            {!isClosed && <button onClick={() => changeStatus('waiting_client')} className="px-3 py-1.5 text-xs border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50">Attente client</button>}
            {!isClosed && <button onClick={() => changeStatus('resolved')} className="px-3 py-1.5 text-xs border border-green-200 text-green-600 rounded-lg hover:bg-green-50">Resoudre</button>}
            {ticket.status === 'resolved' && <button onClick={() => changeStatus('closed')} className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Fermer</button>}
          </div>
        </div>

        {/* SLA info */}
        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Clock size={10} /> 1ere reponse: {ticket.firstResponseAt
              ? <span className={ticket.slaFirstResponseMet ? 'text-green-600' : 'text-red-500'}>{ticket.slaFirstResponseMet ? 'dans les temps' : 'en retard'}</span>
              : <span>en attente ({ticket.slaFirstResponse}min SLA)</span>}
          </div>
          <div className="flex items-center gap-1">
            <Clock size={10} /> Resolution: {ticket.resolvedAt
              ? <span className="text-green-600">resolu</span>
              : slaResBreached ? <span className="text-red-500">SLA depasse</span>
              : <span>deadline: {new Date(ticket.slaResolutionDeadline).toLocaleString('fr-FR')}</span>}
          </div>
        </div>
      </div>

      {/* AI Suggestion */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Sparkles size={14} className="text-purple-500" /> Suggestion IA</h3>
          <button onClick={getAISuggestion} disabled={loadingAI} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}>
            {loadingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generer
          </button>
        </div>
        {aiSuggestion ? (
          <div>
            <p className="text-sm text-gray-700 bg-purple-50 rounded-xl p-3">{aiSuggestion.suggestion}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>Confiance: {aiSuggestion.confidence}%</span>
              {aiSuggestion.sources.length > 0 && <span>Sources: {aiSuggestion.sources.join(', ')}</span>}
              <button onClick={() => { setReply(aiSuggestion.suggestion); setAiSuggestion(null); }} className="text-purple-600 hover:underline">Utiliser cette reponse</button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Cliquez "Generer" pour obtenir une reponse suggeree basee sur la base de connaissances.</p>
        )}
      </div>

      {/* Description */}
      {ticket.description && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Description</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      {/* Conversation */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Conversation ({ticket.messages?.length ?? 0})</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
          {(ticket.messages ?? []).length === 0 && <p className="text-xs text-gray-400 text-center py-4">Aucun message.</p>}
          {(ticket.messages ?? []).map(msg => {
            const rs = ROLE_STYLES[msg.role] ?? ROLE_STYLES.client;
            const Icon = rs.icon;
            return (
              <div key={msg.id} className={`flex ${rs.align}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${rs.bg}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={11} />
                    <span className="text-xs font-medium opacity-70">{msg.authorName || msg.role}</span>
                    <span className="text-xs opacity-50">{new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply */}
        {!isClosed && (
          <div className="flex gap-2">
            <input value={reply} onChange={e => setReply(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
              placeholder="Votre reponse..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={sendReply} disabled={sending || !reply.trim()} className="px-4 py-2 text-white rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* Client history */}
      {ticket.customerEmail && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <button onClick={loadHistory} className="flex items-center justify-between w-full">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><User size={14} className="text-gray-400" /> Historique client</h3>
            {showHistory ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          {showHistory && history && (
            <div className="mt-3 space-y-1">
              {history.length === 0 ? <p className="text-xs text-gray-400">Aucun autre ticket pour ce client.</p> : (
                history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded-lg">
                    <span className="font-mono text-gray-400">{h.ticketNumber}</span>
                    <span className="text-gray-700">{h.title ?? h.subject}</span>
                    <span className={`px-1.5 py-0.5 rounded-full ${STATUS_STYLES[h.status]?.style ?? 'bg-gray-100'}`}>{STATUS_STYLES[h.status]?.label ?? h.status}</span>
                    <span className="text-gray-400 ml-auto">{new Date(h.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Satisfaction */}
      {(ticket.status === 'resolved' || ticket.status === 'closed') && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Satisfaction client</h3>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => submitRating(s)}
                className={`p-1 ${(rating || ticket.satisfaction || 0) >= s ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}>
                <Star size={24} fill={(rating || ticket.satisfaction || 0) >= s ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          {(rating || ticket.satisfaction) && <p className="text-xs text-gray-400 mt-1">{rating || ticket.satisfaction}/5</p>}
        </div>
      )}
    </div>
  );
}
