/**
 * GenerateUploadLinkModal — Generate a public document upload link for a signatory
 * Migrated from WEMAS GenerateUploadLinkModal.tsx
 */
import { useState } from 'react';
import { Link2, Copy, Check, Loader2, X, Send, Share2 } from 'lucide-react';
import api from '@/services/api';

interface Props {
  signatoryEmail: string;
  signatoryName: string;
  onClose: () => void;
}

const DOC_TYPES = [
  { value: 'id_card', label: "Carte d'identite" },
  { value: 'passport', label: 'Passeport' },
  { value: 'driver_license', label: 'Permis de conduire' },
  { value: 'rib', label: 'RIB / IBAN' },
  { value: 'kbis', label: 'Kbis / Statuts' },
  { value: 'photo', label: 'Photo' },
  { value: 'autre', label: 'Autre document' },
];

export function GenerateUploadLinkModal({ signatoryEmail, signatoryName, onClose }: Props) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['id_card']);
  const [message, setMessage] = useState('');
  const [expiryDays, setExpiryDays] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const toggleType = (v: string) => {
    setSelectedTypes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const r = await api.post('/contracts/upload-requests', {
        signatoryEmail,
        signatoryName,
        requestedTypes: selectedTypes,
        message: message.trim(),
        expiresInDays: expiryDays || undefined,
      });
      const token = r.data?.token;
      if (token) {
        setGeneratedLink(`${window.location.origin}/upload/${token}`);
      }
    } catch {}
    finally { setCreating(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Documents requis', text: `Bonjour ${signatoryName}, veuillez soumettre vos documents.`, url: generatedLink });
      } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><Link2 size={18} className="text-blue-600" /></div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Lien de depot</h2>
              <p className="text-xs text-gray-400 truncate max-w-[220px]">{signatoryName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {generatedLink ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
                <Link2 size={15} className="text-blue-600 shrink-0" />
                <p className="text-xs font-mono text-gray-600 truncate flex-1">{generatedLink}</p>
                <button onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                  {copied ? <><Check size={12} /> Copie</> : <><Copy size={12} /> Copier</>}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                  <Share2 size={15} /> Partager
                </button>
              </div>
              <button onClick={onClose} className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors">Fermer</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Documents demandes</label>
                <div className="flex flex-wrap gap-2">
                  {DOC_TYPES.map(t => {
                    const active = selectedTypes.includes(t.value);
                    return (
                      <button key={t.value} onClick={() => toggleType(t.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${active ? 'text-white border-transparent bg-blue-600' : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'}`}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Message <span className="font-normal text-gray-400">(optionnel)</span></label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Merci de nous fournir les documents suivants..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-50 focus:border-blue-400 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Expiration</label>
                <select value={expiryDays} onChange={e => setExpiryDays(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-50 focus:border-blue-400">
                  <option value="">Sans expiration</option>
                  <option value="3">3 jours</option>
                  <option value="7">7 jours</option>
                  <option value="14">14 jours</option>
                  <option value="30">30 jours</option>
                </select>
              </div>

              <button onClick={handleCreate} disabled={creating || selectedTypes.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                {creating ? <><Loader2 size={15} className="animate-spin" /> Generation...</> : <><Link2 size={15} /> Generer le lien</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
