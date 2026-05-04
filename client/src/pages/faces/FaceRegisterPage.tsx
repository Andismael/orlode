import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Upload, Camera, X, CheckCircle } from 'lucide-react';

export default function FaceRegisterPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useLangStore();
  const [photos, setPhotos] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', title: '', department: '', company: '', type: 'internal' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);

  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setPhotos(p => [...p, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const remove = (i: number) => setPhotos(p => p.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    photos.forEach((photo, i) => {
      const blob = atob(photo.split(',')[1]);
      formData.append('photos', new Blob([Uint8Array.from(blob, c => c.charCodeAt(0))], { type: 'image/jpeg' }), `photo_${i}.jpg`);
    });
    try {
      const r = await api.post('/faces/register', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setConfidence(r.data.confidence);
      setDone(true);
    } finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Profil créé !</h2>
        <p className="text-sm text-gray-600 mb-2">{form.name} a été enregistré avec succès.</p>
        {confidence && <p className="text-sm text-blue-600">Score de confiance : {Math.round(confidence * 100)}%</p>}
        <button onClick={() => navigate('/faces')} className="mt-4 px-4 py-2 text-white rounded-lg text-sm" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          Retour à l'annuaire
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Enregistrer un visage</h1>
      <form onSubmit={submit} className="space-y-5">
        {/* Photos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Photos (3 à 5 recommandées)</h2>
          <div className="flex flex-wrap gap-3 mb-3">
            {photos.map((photo, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden">
                <img src={photo} className="w-full h-full object-cover" alt={`Photo ${i+1}`} />
                <button type="button" onClick={() => remove(i)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-400">
                <Upload size={18} />
                <span className="text-xs mt-1">{`${t('create')}`}</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhoto} />
          <p className="text-xs text-gray-400">JPEG/PNG · Visage bien éclairé, face à la caméra</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Nom complet *</label>
            <input required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {[{k:'title',l:t('title')},{k:'department',l:'Département'},{k:'company',l:t('company')}].map(f => (
            <div key={f.k}>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{f.l}</label>
              <input value={form[f.k as keyof typeof form]} onChange={e => setForm(p => ({...p, [f.k]: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{`${t('type')}`}</label>
            <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="internal">{`${t('internal')}`}</option>
              <option value="external">Externe / Visiteur</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={photos.length < 1 || !form.name || loading}
          className="px-6 py-2.5 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          {loading ? 'Enregistrement...' : 'Enregistrer le profil'}
        </button>
      </form>
    </div>
  );
}
