/**
 * BookVisitPage — Public visitor self-registration form
 * No auth required — accessible via link sent to visitors
 * URL: /book/:companyId
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Calendar, QrCode, Loader2, Building } from 'lucide-react';
import api from '@/services/api';

export default function BookVisitPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [form, setForm] = useState({ visitorName: '', visitorEmail: '', visitorCompany: '', visitorPhone: '', hostName: '', purpose: '', scheduledDate: '', scheduledTime: '09:00', requiresNDA: false, requiresParking: false, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ qrCode: string; message: string } | null>(null);

  const handleSubmit = async () => {
    if (!form.visitorName || !form.hostName || !form.scheduledDate) return;
    setSubmitting(true);
    try {
      const r = await api.post(`/public/book/${companyId}`, form);
      setResult((r.data as { data?: { qrCode: string; message: string } })?.data ?? null);
    } catch { setResult({ qrCode: '', message: 'Erreur lors de l\'enregistrement.' }); }
    setSubmitting(false);
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-600" /></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pre-enregistrement confirme</h1>
          <p className="text-sm text-gray-500 mb-6">{result.message}</p>
          {result.qrCode && (
            <div className="bg-indigo-50 rounded-2xl p-6 mb-4">
              <QrCode size={48} className="mx-auto text-indigo-600 mb-3" />
              <p className="text-2xl font-mono font-bold text-indigo-700">{result.qrCode}</p>
              <p className="text-xs text-indigo-500 mt-2">Presentez ce code a la reception le jour de votre visite</p>
            </div>
          )}
          <p className="text-xs text-gray-400">Vous recevrez une confirmation une fois que votre hote aura approuve la visite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center"><Building size={24} className="text-blue-600" /></div>
          <div><h1 className="text-xl font-bold text-gray-900">Reserver une visite</h1><p className="text-sm text-gray-500">Remplissez le formulaire pour vous pre-enregistrer</p></div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Votre nom *</label><input value={form.visitorName} onChange={e => setForm({...form, visitorName: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Email *</label><input type="email" value={form.visitorEmail} onChange={e => setForm({...form, visitorEmail: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Entreprise</label><input value={form.visitorCompany} onChange={e => setForm({...form, visitorCompany: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Telephone</label><input value={form.visitorPhone} onChange={e => setForm({...form, visitorPhone: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" /></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Personne a rencontrer *</label><input value={form.hostName} onChange={e => setForm({...form, hostName: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Nom de votre contact" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Motif de la visite</label><input value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Reunion, interview, audit..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Date *</label><input type="date" value={form.scheduledDate} onChange={e => setForm({...form, scheduledDate: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Heure</label><input type="time" value={form.scheduledTime} onChange={e => setForm({...form, scheduledTime: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" /></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none" rows={2} placeholder="Informations supplementaires..." /></div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.requiresParking} onChange={e => setForm({...form, requiresParking: e.target.checked})} className="rounded border-gray-300" /> Place de parking</label>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={submitting || !form.visitorName || !form.hostName || !form.scheduledDate}
          className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-all hover:shadow-lg"
          style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
          {submitting ? 'Envoi en cours...' : 'Confirmer la reservation'}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">En soumettant ce formulaire, vous acceptez le traitement de vos donnees conformement au RGPD.</p>
      </div>
    </div>
  );
}
