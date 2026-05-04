import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Send, CheckCircle, XCircle } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

const EVENTS = ['document.indexed', 'meeting.completed', 'insight.alert', 'user.invited', 'ticket.created'];

interface Webhook { id: string; url: string; events: string[]; active: boolean; lastStatus?: string; }

export default function WebhooksPage() {
  const { t } = useLangStore();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ url: '', events: [] as string[] });

  const load = () => {
    api.get<Webhook[]>('/apikeys/webhooks')
      .then(r => setWebhooks(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleEvent = (ev: string) =>
    setForm(p => ({ ...p, events: p.events.includes(ev) ? p.events.filter(e => e !== ev) : [...p.events, ev] }));

  const add = async () => {
    if (!form.url) return;
    const res = await api.post<Webhook>('/apikeys/webhooks', form).catch(() => null);
    if (res?.data) setWebhooks(p => [...p, res.data as Webhook]);
    setForm({ url: '', events: [] });
    setShowAdd(false);
  };

  const remove = async (id: string) => {
    await api.delete(`/apikeys/webhooks/${id}`).catch(() => {});
    setWebhooks(p => p.filter(w => w.id !== id));
  };

  const test = async (id: string) => {
    await api.post(`/apikeys/webhooks/${id}/test`).catch(() => {});
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white rounded-lg" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          <Plus size={13} /> Ajouter
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Nouveau webhook</h2>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">URL de destination</label>
            <input type="url" value={form.url} onChange={e => setForm(p => ({...p, url: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://votre-app.com/webhook" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Événements</label>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map(ev => (
                <button key={ev} onClick={() => toggleEvent(ev)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${form.events.includes(ev) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {ev}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">{`${t('cancel')}`}</button>
            <button onClick={add} className="px-3 py-1.5 text-sm text-white rounded-lg" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>Créer</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({length:2}).map((_,i) => <div key={i} className="bg-white rounded-xl border border-gray-100 h-20 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-mono text-gray-900 truncate max-w-xs">{wh.url}</p>
                  {wh.lastStatus && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {wh.lastStatus === '200'
                        ? <CheckCircle size={12} className="text-green-500" />
                        : <XCircle size={12} className="text-red-500" />}
                      <span className="text-xs text-gray-400">Dernier: {wh.lastStatus}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => test(wh.id)} className="p-1.5 hover:bg-gray-100 rounded" title="Test"><Send size={13} className="text-gray-400" /></button>
                  <button onClick={() => remove(wh.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 size={13} className="text-gray-400 hover:text-red-500" /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {wh.events.map(ev => <span key={ev} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">{ev}</span>)}
              </div>
            </div>
          ))}
          {webhooks.length === 0 && <p className="text-center text-sm text-gray-400 py-8">{`${t('no_data')}`}</p>}
        </div>
      )}
    </div>
  );
}
