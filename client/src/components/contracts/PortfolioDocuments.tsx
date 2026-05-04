/**
 * PortfolioDocuments — Document grid for a signatory's portfolio
 * Migrated from WEMAS PortfolioDocuments.tsx
 */
import { useState, useEffect, useRef } from 'react';
import {
  Upload, Trash2, FileText, Image, Download, Plus, Loader2, FolderOpen,
  CreditCard, Car, Globe, Banknote, Building2, File, ChevronDown, Eye, X,
} from 'lucide-react';
import api from '@/services/api';

interface PortfolioDoc {
  id: string;
  signatoryEmail: string;
  documentType: string;
  label: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

interface Props {
  signatoryEmail: string;
  signatoryName: string;
}

const DOC_TYPES = [
  { value: 'id_card', label: "Carte d'identite", icon: CreditCard },
  { value: 'passport', label: 'Passeport', icon: Globe },
  { value: 'driver_license', label: 'Permis de conduire', icon: Car },
  { value: 'rib', label: 'RIB / IBAN', icon: Banknote },
  { value: 'kbis', label: 'Kbis / Statuts', icon: Building2 },
  { value: 'photo', label: 'Photo', icon: Image },
  { value: 'autre', label: 'Autre document', icon: File },
];

const getTypeInfo = (v: string) => DOC_TYPES.find(t => t.value === v) ?? DOC_TYPES[DOC_TYPES.length - 1];
const formatBytes = (b: number) => {
  if (b === 0) return '0 o';
  const k = 1024, s = ['o', 'Ko', 'Mo'], i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
};

export function PortfolioDocuments({ signatoryEmail, signatoryName }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<PortfolioDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState('id_card');
  const [docLabel, setDocLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<PortfolioDoc | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { load(); }, [signatoryEmail]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/contracts/documents/${encodeURIComponent(signatoryEmail)}`);
      setDocuments(r.data ?? []);
    } catch { setDocuments([]); }
    finally { setLoading(false); }
  };

  const handleFileSelect = (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) return;
    if (file.size > 20 * 1024 * 1024) return;
    setSelectedFile(file);
    setShowForm(true);
    setExpanded(true);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const label = docLabel.trim() || getTypeInfo(docType).label;
      await api.post('/contracts/documents', {
        signatoryEmail, signatoryName, documentType: docType, label,
        fileUrl: '', fileName: selectedFile.name, fileSize: selectedFile.size,
      });
      setSelectedFile(null); setDocLabel(''); setDocType('id_card'); setShowForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch {}
    finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce document ?')) return;
    await api.delete(`/contracts/documents/${id}`).catch(() => {});
    load();
  };

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20" onClick={() => setLightbox(null)}><X size={20} /></button>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            {/\.(jpg|jpeg|png|webp)$/i.test(lightbox.fileName)
              ? <img src={lightbox.fileUrl} alt={lightbox.label} className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" />
              : <iframe src={lightbox.fileUrl} className="w-full h-[80vh] rounded-2xl shadow-2xl" title={lightbox.label} />
            }
            <p className="text-white font-semibold text-sm mt-3">{lightbox.label} — {formatBytes(lightbox.fileSize)}</p>
          </div>
        </div>
      )}

      <div className="mt-6">
        {/* Header toggle */}
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50 transition-all shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><FolderOpen size={15} className="text-blue-500" /></div>
            <div className="text-left">
              <span className="text-sm font-bold text-gray-800 block">Documents administratifs</span>
              <span className="text-xs text-gray-400">{documents.length === 0 ? 'Aucun' : `${documents.length} document${documents.length > 1 ? 's' : ''}`}</span>
            </div>
          </div>
          <ChevronDown size={15} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {expanded && (
          <div className="mt-3 space-y-4">
            {/* Actions */}
            {!showForm && (
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm">
                <Plus size={15} /> Ajouter
              </button>
            )}

            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />

            {/* Drop zone */}
            {!showForm && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileSelect(f); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <Upload size={20} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">Glisser un fichier ou <span className="text-blue-600 font-semibold">cliquer</span></p>
                <p className="text-xs text-gray-400">JPG, PNG, PDF — max 20 Mo</p>
              </div>
            )}

            {/* Upload form */}
            {showForm && selectedFile && (
              <div className="border border-gray-100 rounded-2xl p-5 bg-gray-50">
                <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <FileText size={15} className="text-gray-400" /> {selectedFile.name}
                  <span className="text-gray-400 font-normal">({formatBytes(selectedFile.size)})</span>
                </p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
                    <select value={docType} onChange={e => setDocType(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-400">
                      {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Libelle</label>
                    <input type="text" value={docLabel} onChange={e => setDocLabel(e.target.value)} placeholder={getTypeInfo(docType).label}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleUpload} disabled={uploading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Enregistrer
                  </button>
                  <button onClick={() => { setShowForm(false); setSelectedFile(null); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
                </div>
              </div>
            )}

            {/* Grid */}
            {loading ? (
              <div className="py-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-gray-400" /></div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center"><FolderOpen size={20} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">Aucun document</p></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {documents.map(doc => {
                  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(doc.fileName);
                  const info = getTypeInfo(doc.documentType);
                  const Icon = info.icon;
                  return (
                    <div key={doc.id} className="group relative border border-gray-100 rounded-2xl overflow-hidden bg-white hover:shadow-md transition-all cursor-pointer"
                      onClick={() => setLightbox(doc)}>
                      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                        {isImage && doc.fileUrl
                          ? <img src={doc.fileUrl} alt={doc.label} className="w-full h-full object-cover" />
                          : <div className="flex flex-col items-center gap-2"><FileText size={22} className="text-gray-400" /><span className="text-xs font-bold text-gray-400 uppercase">PDF</span></div>
                        }
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="p-2 rounded-xl bg-white/90 shadow-sm"><Eye size={15} className="text-gray-700" /></div>
                      </div>
                      <div className="absolute top-2 left-2">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm">
                          <Icon size={10} className="text-gray-500" /><span className="text-xs font-bold text-gray-600">{info.label}</span>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                        <Trash2 size={12} />
                      </button>
                      <div className="px-3 py-2.5 border-t border-gray-50">
                        <p className="text-xs font-semibold text-gray-700 truncate">{doc.label}</p>
                        <p className="text-xs text-gray-400">{formatBytes(doc.fileSize)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
