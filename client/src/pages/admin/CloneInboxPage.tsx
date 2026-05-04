/**
 * CloneInboxPage — Unified inbox: all clone conversations, all channels, filters, escalation
 */
import { useEffect, useState } from 'react';
import { Loader2, Search, User, MessageSquare, Phone, Mail, ExternalLink, UserPlus, Ticket, CheckCircle, Filter } from 'lucide-react';
import api from '@/services/api';

interface Contact { id: string; name: string; email: string; phone: string; channels: string[]; firstChannel: string; lastChannel: string; firstMessage: string; lastMessage: string; messageCount: number; leadScore: number; intent: string; intentType: string; status: string; assignedTo: string | null; assignedBy?: string; assignedAt?: string; convertedBy?: string; closedBy?: string; escalated: boolean; firstSeenAt: string; lastSeenAt: string; salesLeadId?: string }
interface TimelineMsg { id: string; channel: string; sender: string; incoming: string; reply: string; timestamp: string }
interface SlaViolation { contactId: string; name: string; email: string; channel: string; waitMinutes: number; severity: string }

const CH_ICON: Record<string, string> = { web: '🌐', whatsapp: '💬', telegram: '✈️', email: '📧', widget: '🔲', api: '🔌' };
const STATUS_C: Record<string, { label: string; color: string }> = {
  new: { label: 'Nouveau', color: 'bg-blue-100 text-blue-700' },
  active: { label: 'Actif', color: 'bg-green-100 text-green-700' },
  escalated: { label: 'Escalade', color: 'bg-orange-100 text-orange-700' },
  converted: { label: 'Converti', color: 'bg-purple-100 text-purple-700' },
  closed: { label: 'Ferme', color: 'bg-gray-100 text-gray-600' },
};

export default function CloneInboxPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [actioning, setActioning] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<{ contact: Contact; messages: TimelineMsg[] } | null>(null);
  const [slaViolations, setSlaViolations] = useState<SlaViolation[]>([]);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/clone/config/contacts').then(r => { const d = r.data; setContacts(Array.isArray(d) ? d : (d as { data?: Contact[] })?.data ?? []); }),
      api.get('/clone/config/sla').then(r => { const d = r.data as { violations?: SlaViolation[] } | SlaViolation[]; setSlaViolations(Array.isArray(d) ? d : (d as { violations?: SlaViolation[] })?.violations ?? []); }).catch(() => {}),
    ]).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const assignToMe = async (id: string) => {
    setActioning(id);
    await api.post(`/clone/config/contacts/${id}/assign`).catch(() => {});
    setActioning(null); load();
  };

  const createTicket = async (id: string) => {
    setActioning(id);
    await api.post(`/clone/config/contacts/${id}/ticket`).catch(() => {});
    setActioning(null); load();
  };

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/clone/config/contacts/${id}`, { status }).catch(() => {});
    setContacts(p => p.map(c => c.id === id ? { ...c, status } : c));
  };

  const openTimeline = async (id: string) => {
    const r = await api.get(`/clone/config/contacts/${id}/timeline`).catch(() => ({ data: null }));
    const d = r.data as { contact?: Contact; messages?: TimelineMsg[] } | null;
    if (d?.contact) setTimeline({ contact: d.contact as Contact, messages: (d.messages ?? []) as TimelineMsg[] });
  };

  const convertToSales = async (id: string) => {
    setActioning(id);
    await api.post(`/clone/config/contacts/${id}/convert`).catch(() => {});
    setActioning(null); load();
  };

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || c.lastMessage.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filter === 'all' || c.status === filter;
    const matchChannel = channelFilter === 'all' || c.channels.includes(channelFilter);
    return matchSearch && matchStatus && matchChannel;
  });

  // Stats
  const total = contacts.length;
  const newCount = contacts.filter(c => c.status === 'new').length;
  const escalated = contacts.filter(c => c.escalated).length;
  const avgScore = total > 0 ? Math.round(contacts.reduce((s, c) => s + (c.leadScore ?? 0), 0) / total) : 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div><h1 className="text-xl font-bold text-gray-900">Inbox Clone</h1><p className="text-sm text-gray-500">Toutes les conversations — tous les canaux</p></div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-xl p-3"><p className="text-xl font-bold text-blue-700">{total}</p><p className="text-xs text-gray-500">Contacts</p></div>
        <div className={`rounded-xl p-3 ${newCount > 0 ? 'bg-green-50' : 'bg-gray-50'}`}><p className={`text-xl font-bold ${newCount > 0 ? 'text-green-700' : 'text-gray-500'}`}>{newCount}</p><p className="text-xs text-gray-500">Nouveaux</p></div>
        <div className={`rounded-xl p-3 ${escalated > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}><p className={`text-xl font-bold ${escalated > 0 ? 'text-orange-700' : 'text-gray-500'}`}>{escalated}</p><p className="text-xs text-gray-500">Escalades</p></div>
        <div className="bg-purple-50 rounded-xl p-3"><p className="text-xl font-bold text-purple-700">{avgScore}</p><p className="text-xs text-gray-500">Score moyen</p></div>
      </div>

      {/* SLA Alerts */}
      {slaViolations.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> {slaViolations.length} contact(s) sans reponse</h3>
          {slaViolations.slice(0, 3).map(v => (
            <p key={v.contactId} className="text-xs text-red-700 mb-1">{CH_ICON[v.channel] ?? ''} {v.name || v.email} — en attente depuis {v.waitMinutes} min {v.severity === 'critical' ? '🔴' : '🟠'}</p>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="Rechercher nom, email, message..." />
        </div>
        <div className="flex gap-1">
          {['all', 'new', 'active', 'escalated', 'converted', 'closed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${filter === f ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{f === 'all' ? 'Tous' : STATUS_C[f]?.label ?? f}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {['all', 'web', 'whatsapp', 'telegram', 'email'].map(c => (
            <button key={c} onClick={() => setChannelFilter(c)} className={`px-2 py-1.5 text-xs rounded-lg ${channelFilter === c ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{c === 'all' ? 'Tous' : CH_ICON[c] ?? c}</button>
          ))}
        </div>
      </div>

      {/* Contact list */}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        filtered.length === 0 ? <div className="text-center py-16 text-sm text-gray-400">Aucun contact dans l'inbox.</div> : (
          <div className="space-y-2">
            {filtered.map(c => {
              const st = STATUS_C[c.status] ?? STATUS_C.new;
              return (
                <div key={c.id} className={`bg-white rounded-xl border shadow-sm p-4 ${c.status === 'new' ? 'border-blue-200' : c.escalated ? 'border-orange-200' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">{c.name.charAt(0).toUpperCase()}</div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <button onClick={() => openTimeline(c.id)} className="text-sm font-bold text-gray-900 hover:text-purple-600 cursor-pointer">{c.name}</button>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                        {/* Channel badges */}
                        {c.channels.map(ch => <span key={ch} className="text-xs" title={ch}>{CH_ICON[ch] ?? ch}</span>)}
                        {/* Score */}
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${c.leadScore >= 70 ? 'bg-green-100 text-green-700' : c.leadScore >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{c.leadScore}</span>
                      </div>
                      {/* Contact info */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                        {c.email && <span className="flex items-center gap-1"><Mail size={10} /> {c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1"><Phone size={10} /> {c.phone}</span>}
                        <span>{c.messageCount} messages</span>
                        <span className="text-gray-400">{c.intentType}</span>
                      </div>
                      {/* Last message */}
                      <p className="text-xs text-gray-600 line-clamp-1">{c.lastMessage}</p>
                      <p className="text-xs text-gray-400 mt-1">{c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleString('fr-FR') : ''} · via {CH_ICON[c.lastChannel] ?? c.lastChannel}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {c.status === 'new' && (
                        <>
                          <button onClick={() => assignToMe(c.id)} disabled={actioning === c.id} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium flex items-center gap-1 disabled:opacity-50">
                            {actioning === c.id ? <Loader2 size={10} className="animate-spin" /> : <UserPlus size={10} />} Assigner
                          </button>
                          <button onClick={() => createTicket(c.id)} disabled={actioning === c.id} className="text-xs px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 font-medium flex items-center gap-1 disabled:opacity-50">
                            <Ticket size={10} /> Ticket
                          </button>
                        </>
                      )}
                      {(c.status === 'escalated' || c.status === 'new' || c.status === 'active') && (
                        <button onClick={() => convertToSales(c.id)} disabled={actioning === c.id} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium flex items-center gap-1 disabled:opacity-50">
                          {actioning === c.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />} → Sales
                        </button>
                      )}
                      {c.salesLeadId && <span className="text-xs text-purple-600">Pipeline ✓</span>}
                      {c.status !== 'closed' && (
                        <button onClick={() => updateStatus(c.id, 'closed')} className="text-xs px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100">Fermer</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Timeline Modal */}
      {timeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setTimeline(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{timeline.contact.name}</h2>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  {timeline.contact.email && <span>{timeline.contact.email}</span>}
                  {timeline.contact.phone && <span>{timeline.contact.phone}</span>}
                  {timeline.contact.channels.map(ch => <span key={ch}>{CH_ICON[ch]}</span>)}
                  <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_C[timeline.contact.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_C[timeline.contact.status]?.label ?? timeline.contact.status}</span>
                  <span>Score: {timeline.contact.leadScore}</span>
                </div>
              </div>
              <button onClick={() => setTimeline(null)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">✕</button>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {timeline.messages.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Aucun message enregistre.</p> : timeline.messages.map(m => (
                <div key={m.id} className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs mt-0.5">{CH_ICON[m.channel] ?? '💬'}</span>
                    <div className="flex-1">
                      <div className="bg-blue-50 rounded-xl rounded-bl-md px-3 py-2"><p className="text-sm text-gray-800">{m.incoming}</p></div>
                      <p className="text-xs text-gray-400 mt-0.5 ml-1">{m.sender} · {m.timestamp ? new Date(typeof m.timestamp === 'object' && '_seconds' in m.timestamp ? (m.timestamp as {_seconds: number})._seconds * 1000 : m.timestamp).toLocaleString('fr-FR') : ''}</p>
                    </div>
                  </div>
                  {m.reply && (
                    <div className="flex items-start gap-2 ml-6">
                      <div className="flex-1">
                        <div className="bg-purple-50 rounded-xl rounded-bl-md px-3 py-2"><p className="text-sm text-gray-700">{m.reply}</p></div>
                        <p className="text-xs text-purple-400 mt-0.5 ml-1">Clone</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
