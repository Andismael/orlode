/**
 * PhishingPage — Phishing simulation campaigns, employee scores, launch campaigns
 */
import { useEffect, useState } from 'react';
import { Fish, Loader2, Plus, X, Users, MousePointer, Flag, Mail, Sparkles } from 'lucide-react';
import api from '@/services/api';

interface Campaign { id: string; name: string; template: string; status: string; targetCount: number; openedCount: number; clickedCount: number; reportedCount: number; launchedAt: string }

const TEMPLATES = [
  { id: 'password_reset', label: 'Reset mot de passe', desc: 'Email de reinitialisation urgente' },
  { id: 'invoice_payment', label: 'Facture impayee', desc: 'Demande de paiement fausse facture' },
  { id: 'ceo_fraud', label: 'Fraude au PDG', desc: 'Email usurpant le directeur' },
  { id: 'it_support', label: 'Support IT', desc: 'Demande de verification compte IT' },
  { id: 'delivery_notification', label: 'Notification livraison', desc: 'Colis en attente avec lien' },
];

export default function PhishingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [form, setForm] = useState({ name: '', template: 'password_reset', targetGroup: 'all' });

  const load = () => {
    setLoading(true);
    api.get('/security/phishing').then(r => setCampaigns((r.data as { data?: Campaign[] })?.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const launch = async () => {
    if (!form.name) return;
    setLaunching(true);
    await api.post('/security/phishing/launch', form).catch(() => {});
    setLaunching(false); setShowCreate(false); setForm({ name: '', template: 'password_reset', targetGroup: 'all' }); load();
  };

  // Aggregated stats
  const totalTargets = campaigns.reduce((s, c) => s + c.targetCount, 0);
  const totalClicked = campaigns.reduce((s, c) => s + (c.clickedCount ?? 0), 0);
  const totalReported = campaigns.reduce((s, c) => s + (c.reportedCount ?? 0), 0);
  const avgClickRate = totalTargets > 0 ? Math.round(totalClicked / totalTargets * 100) : 0;
  const avgReportRate = totalTargets > 0 ? Math.round(totalReported / totalTargets * 100) : 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Simulation Phishing</h1><p className="text-sm text-gray-500">Campagnes de sensibilisation, scores employes</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}><Plus size={14} /> Nouvelle campagne</button>
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Campagnes', value: campaigns.length, icon: Fish, color: 'text-orange-600 bg-orange-50' },
          { label: 'Cibles totales', value: totalTargets, icon: Users, color: 'text-blue-600 bg-blue-50' },
          { label: 'Taux de clic', value: `${avgClickRate}%`, icon: MousePointer, color: avgClickRate > 30 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50' },
          { label: 'Taux signalement', value: `${avgReportRate}%`, icon: Flag, color: avgReportRate > 20 ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50' },
          { label: 'Emails envoyes', value: totalTargets, icon: Mail, color: 'text-indigo-600 bg-indigo-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${k.color}`}><k.icon size={14} /></div>
            <p className="text-lg font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        campaigns.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <Fish size={40} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune campagne</h3>
            <p className="text-sm text-gray-400">Lancez votre premiere simulation de phishing.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => {
              const openRate = c.targetCount > 0 ? Math.round((c.openedCount ?? 0) / c.targetCount * 100) : 0;
              const clickRate = c.targetCount > 0 ? Math.round((c.clickedCount ?? 0) / c.targetCount * 100) : 0;
              const reportRate = c.targetCount > 0 ? Math.round((c.reportedCount ?? 0) / c.targetCount * 100) : 0;
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600"><Fish size={16} /></div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{c.name}</h3>
                        <p className="text-xs text-gray-400">{c.template} · {c.targetCount} cibles · {c.launchedAt ? new Date(c.launchedAt).toLocaleDateString('fr-FR') : '—'}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                  </div>
                  {/* Progress bars */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Ouvert', pct: openRate, color: 'bg-blue-500' },
                      { label: 'Clique', pct: clickRate, color: clickRate > 30 ? 'bg-red-500' : 'bg-yellow-500' },
                      { label: 'Signale', pct: reportRate, color: 'bg-green-500' },
                    ].map(b => (
                      <div key={b.label}>
                        <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">{b.label}</span><span className="font-bold">{b.pct}%</span></div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${b.color}`} style={{ width: `${b.pct}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Nouvelle campagne</h2><button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="Ex: Test Q2 2026" /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Template</label>
                <div className="space-y-2">{TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setForm({...form, template: t.id})} className={`w-full text-left p-3 rounded-xl border transition-colors ${form.template === t.id ? 'border-orange-300 bg-orange-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <p className="text-sm font-medium text-gray-800">{t.label}</p>
                    <p className="text-xs text-gray-500">{t.desc}</p>
                  </button>
                ))}</div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cibles</label><select value={form.targetGroup} onChange={e => setForm({...form, targetGroup: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"><option value="all">Tous les employes</option><option value="random_sample">Echantillon aleatoire (10)</option><option value="department">Par departement</option></select></div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Annuler</button>
              <button onClick={launch} disabled={launching || !form.name} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}>
                {launching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {launching ? 'Lancement...' : 'Lancer la campagne'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
