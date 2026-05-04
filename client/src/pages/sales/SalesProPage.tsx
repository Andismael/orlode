/**
 * SalesProPage — Team Performance, Win/Loss Analysis, Email Sequences, Deal Automation
 * Unified PRO features page for Sales
 */
import { useEffect, useState } from 'react';
import { Loader2, Trophy, TrendingUp, TrendingDown, Users, Mail, Zap, BarChart3, Sparkles, Plus, X, Target, AlertTriangle } from 'lucide-react';
import api from '@/services/api';

interface Rep { userId: string; name: string; leadsOwned: number; dealsWon: number; revenue: number; conversionRate: number; avgDealSize: number }
interface TeamData { reps: Rep[]; topPerformer: string; totalRevenue: number }
interface WinLoss { totalWon: number; totalLost: number; winRate: number; avgDealSize: number; winFactors: string[]; lossReasons: string[]; recommendations: string[] }
interface Sequence { id: string; name: string; targetStage: string; steps: { dayOffset: number; subject: string; template: string }[]; status: string; enrolledCount: number }

export default function SalesProPage() {
  const [tab, setTab] = useState<'team' | 'winloss' | 'sequences' | 'automation'>('team');
  const [team, setTeam] = useState<TeamData | null>(null);
  const [winLoss, setWinLoss] = useState<WinLoss | null>(null);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSeq, setShowCreateSeq] = useState(false);
  const [creating, setCreating] = useState(false);
  const [automating, setAutomating] = useState<string | null>(null);
  const [autoResult, setAutoResult] = useState<string[] | null>(null);
  const [seqForm, setSeqForm] = useState({ name: '', targetStage: 'nouveau' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/sales/team-performance').then(r => setTeam((r.data as { data?: TeamData })?.data ?? null)),
      api.get('/sales/win-loss').then(r => setWinLoss((r.data as { data?: WinLoss })?.data ?? null)),
      api.get('/sales/sequences').then(r => setSequences((r.data as { data?: Sequence[] })?.data ?? [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const createSequence = async () => {
    if (!seqForm.name) return; setCreating(true);
    await api.post('/sales/sequences', { ...seqForm, generateWithAI: true }).catch(() => {});
    setCreating(false); setShowCreateSeq(false); setSeqForm({ name: '', targetStage: 'nouveau' });
    api.get('/sales/sequences').then(r => setSequences((r.data as { data?: Sequence[] })?.data ?? [])).catch(() => {});
  };

  const runAutomation = async (type: string) => {
    setAutomating(type); setAutoResult(null);
    const r = await api.post('/sales/automation/run', { type }).catch(() => ({ data: { data: { actions: [] } } }));
    setAutoResult(((r.data as { data?: { actions: string[] } })?.data?.actions) ?? []);
    setAutomating(null);
  };

  const t = team ?? { reps: [], topPerformer: '', totalRevenue: 0 };
  const wl = winLoss ?? { totalWon: 0, totalLost: 0, winRate: 0, avgDealSize: 0, winFactors: [], lossReasons: [], recommendations: [] };

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div><h1 className="text-xl font-bold text-gray-900">Sales PRO</h1><p className="text-sm text-gray-500">Performance equipe, win/loss, sequences, automation</p></div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'team', label: 'Equipe', icon: Users },
          { id: 'winloss', label: 'Win/Loss', icon: BarChart3 },
          { id: 'sequences', label: 'Sequences', icon: Mail },
          { id: 'automation', label: 'Automation', icon: Zap },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg ${tab === t.id ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500'}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        <>
          {/* TEAM PERFORMANCE */}
          {tab === 'team' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-xl p-4"><p className="text-2xl font-bold text-green-700">{t.totalRevenue.toLocaleString()}€</p><p className="text-xs text-gray-500">Revenue totale</p></div>
                <div className="bg-blue-50 rounded-xl p-4"><p className="text-2xl font-bold text-blue-700">{t.reps.length}</p><p className="text-xs text-gray-500">Vendeurs</p></div>
                <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-2"><Trophy size={20} className="text-amber-600" /><div><p className="text-sm font-bold text-amber-700">{t.topPerformer || '—'}</p><p className="text-xs text-gray-500">Top performer</p></div></div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100"><tr>{['Vendeur', 'Leads', 'Gagnes', 'Revenue', 'Conversion', 'Deal moy.'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {t.reps.map((r, i) => (
                      <tr key={r.userId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 flex items-center gap-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span><span className="text-sm font-medium text-gray-900">{r.name}</span></td>
                        <td className="px-4 py-3 text-sm text-gray-600">{r.leadsOwned}</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600">{r.dealsWon}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{r.revenue.toLocaleString()}€</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${r.conversionRate >= 50 ? 'bg-green-100 text-green-700' : r.conversionRate >= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>{r.conversionRate}%</span></td>
                        <td className="px-4 py-3 text-sm text-gray-600">{r.avgDealSize.toLocaleString()}€</td>
                      </tr>
                    ))}
                    {t.reps.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-400">Aucune donnee.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* WIN/LOSS ANALYSIS */}
          {tab === 'winloss' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-green-50 rounded-xl p-4"><p className="text-2xl font-bold text-green-700">{wl.totalWon}</p><p className="text-xs text-gray-500">Deals gagnes</p></div>
                <div className="bg-red-50 rounded-xl p-4"><p className="text-2xl font-bold text-red-600">{wl.totalLost}</p><p className="text-xs text-gray-500">Deals perdus</p></div>
                <div className={`rounded-xl p-4 ${wl.winRate >= 50 ? 'bg-green-50' : 'bg-yellow-50'}`}><p className={`text-2xl font-bold ${wl.winRate >= 50 ? 'text-green-700' : 'text-yellow-700'}`}>{wl.winRate}%</p><p className="text-xs text-gray-500">Taux de victoire</p></div>
                <div className="bg-blue-50 rounded-xl p-4"><p className="text-2xl font-bold text-blue-700">{wl.avgDealSize.toLocaleString()}€</p><p className="text-xs text-gray-500">Deal moyen</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2"><TrendingUp size={14} /> Facteurs de succes</h3>
                  {wl.winFactors.map((f, i) => <p key={i} className="text-xs text-gray-600 mb-1.5 flex items-start gap-2"><span className="text-green-500 mt-0.5">+</span>{f}</p>)}
                  {wl.winFactors.length === 0 && <p className="text-xs text-gray-400">Pas assez de donnees.</p>}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2"><TrendingDown size={14} /> Raisons de perte</h3>
                  {wl.lossReasons.map((r, i) => <p key={i} className="text-xs text-gray-600 mb-1.5 flex items-start gap-2"><span className="text-red-500 mt-0.5">-</span>{r}</p>)}
                  {wl.lossReasons.length === 0 && <p className="text-xs text-gray-400">Pas assez de donnees.</p>}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2"><Target size={14} /> Recommandations</h3>
                  {wl.recommendations.map((r, i) => <p key={i} className="text-xs text-gray-600 mb-1.5 flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span>{r}</p>)}
                  {wl.recommendations.length === 0 && <p className="text-xs text-gray-400">Pas assez de donnees.</p>}
                </div>
              </div>
            </div>
          )}

          {/* EMAIL SEQUENCES */}
          {tab === 'sequences' && (
            <div className="space-y-4">
              <div className="flex justify-end"><button onClick={() => setShowCreateSeq(true)} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: 'linear-gradient(135deg, #F59E0B, #EAB308)' }}><Sparkles size={14} /> Creer avec IA</button></div>
              {sequences.length === 0 ? <div className="text-center py-12 text-sm text-gray-400">Aucune sequence. Creez-en une avec l'IA.</div> : (
                <div className="space-y-3">
                  {sequences.map(s => (
                    <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div><h3 className="text-sm font-bold text-gray-900">{s.name}</h3><p className="text-xs text-gray-400">Stage: {s.targetStage} · {s.steps?.length ?? 0} etapes · {s.enrolledCount ?? 0} inscrits</p></div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {(s.steps ?? []).map((step, i) => (
                          <div key={i} className="flex-shrink-0 w-48 bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="flex items-center gap-1 mb-1"><span className="text-xs font-bold text-orange-600">J+{step.dayOffset}</span><Mail size={10} className="text-gray-400" /></div>
                            <p className="text-xs font-semibold text-gray-800 truncate">{step.subject}</p>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{step.template}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showCreateSeq && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateSeq(false)}>
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Creer une sequence IA</h2><button onClick={() => setShowCreateSeq(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button></div>
                    <div className="space-y-3">
                      <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label><input value={seqForm.name} onChange={e => setSeqForm({...seqForm, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="Sequence nurturing Q2" /></div>
                      <div><label className="text-xs font-medium text-gray-600 mb-1 block">Stage cible</label><select value={seqForm.targetStage} onChange={e => setSeqForm({...seqForm, targetStage: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"><option value="nouveau">Nouveau</option><option value="contacte">Contacte</option><option value="interesse">Interesse</option></select></div>
                    </div>
                    <div className="flex justify-end gap-3 mt-5">
                      <button onClick={() => setShowCreateSeq(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Annuler</button>
                      <button onClick={createSequence} disabled={creating || !seqForm.name} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #F59E0B, #EAB308)' }}>{creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generer</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUTOMATION */}
          {tab === 'automation' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Executez des automations cross-modules en un clic.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { type: 'deal_won', label: 'Deal gagne → Facture', desc: 'Cree automatiquement une facture pour chaque deal gagne sans facture.', icon: TrendingUp, color: 'bg-green-600' },
                  { type: 'deal_lost', label: 'Deal perdu → Formation', desc: 'Assigne une formation de vente aux commerciaux ayant perdu des deals.', icon: AlertTriangle, color: 'bg-red-600' },
                  { type: 'stale_leads', label: 'Leads inactifs → Marketing', desc: 'Detecte les leads >14 jours sans activite et notifie le marketing.', icon: Mail, color: 'bg-orange-600' },
                ].map(a => (
                  <div key={a.type} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className={`w-9 h-9 rounded-lg ${a.color} flex items-center justify-center text-white mb-3`}><a.icon size={18} /></div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">{a.label}</h3>
                    <p className="text-xs text-gray-500 mb-3">{a.desc}</p>
                    <button onClick={() => runAutomation(a.type)} disabled={automating === a.type}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
                      {automating === a.type ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} {automating === a.type ? 'En cours...' : 'Executer'}
                    </button>
                  </div>
                ))}
              </div>
              {autoResult && (
                <div className="bg-green-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-green-800 mb-2">Resultat</h3>
                  {autoResult.length === 0 ? <p className="text-xs text-gray-500">Aucune action necessaire.</p> :
                    autoResult.map((a, i) => <p key={i} className="text-xs text-green-700 mb-1">✓ {a}</p>)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
