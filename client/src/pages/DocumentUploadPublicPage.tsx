/**
 * DocumentUploadPublicPage — Public document upload page (no auth)
 * Accessed via /upload/:token — artist uploads docs without an account
 * Migrated from WEMAS DocumentUploadPage.tsx
 */
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload, FileText, CheckCircle, Loader2, AlertCircle,
  ArrowRight, Sparkles, X, File as FileIcon,
} from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface UploadRequest {
  id: string;
  companyId: string;
  signatoryEmail: string;
  signatoryName: string;
  requestedTypes: string[];
  message: string;
  expiresAt?: string;
}

const DOC_LABELS: Record<string, string> = {
  id_card: "Carte d'identite", passport: 'Passeport', driver_license: 'Permis de conduire',
  rib: 'RIB / IBAN', kbis: 'Kbis / Statuts', photo: 'Photo', autre: 'Autre document',
};

const DOC_ICONS: Record<string, string> = {
  id_card: '🪪', passport: '📘', driver_license: '🚗', rib: '🏦', kbis: '🏢', photo: '📷', autre: '📄',
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

type PageState = 'loading' | 'not_found' | 'expired' | 'ready' | 'submitted';

export default function DocumentUploadPublicPage() {
  const { token } = useParams<{ token: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { t } = useLangStore();
  const [request, setRequest] = useState<UploadRequest | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeDocType, setActiveDocType] = useState('autre');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ type: string; name: string }>>([]);

  useEffect(() => { if (token) loadRequest(); }, [token]);

  const loadRequest = async () => {
    try {
      const r = await api.get(`/public/upload/${token}`);
      const data = r.data;
      if (!data) { setPageState('not_found'); return; }
      setRequest(data);
      if (data.requestedTypes?.length > 0) setActiveDocType(data.requestedTypes[0]);
      setPageState('ready');
    } catch (err: any) {
      if (err?.response?.status === 410) setPageState('expired');
      else setPageState('not_found');
    }
  };

  const handleFileSelect = (file: File) => {
    setUploadError('');
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) { setUploadError('Format non supporte (JPG, PNG, PDF)'); return; }
    if (file.size > 20 * 1024 * 1024) { setUploadError('Max 20 Mo'); return; }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !request) return;
    setUploading(true);
    setUploadError('');
    try {
      // In a real implementation, upload to Firebase Storage first, then save metadata
      // For now, we create the document record (file upload would go through a separate upload endpoint)
      await api.post('/public/upload-document', {
        token,
        documentType: activeDocType,
        label: DOC_LABELS[activeDocType] ?? 'Document',
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      });

      setUploadedDocs(prev => [...prev, { type: activeDocType, name: selectedFile.name }]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Move to next requested type
      if (request.requestedTypes?.length > 0) {
        const submitted = new Set([...uploadedDocs.map(d => d.type), activeDocType]);
        const next = request.requestedTypes.find(t => !submitted.has(t));
        if (next) setActiveDocType(next);
      }
    } catch {
      setUploadError("Erreur lors de l'envoi. Reessayez.");
    } finally {
      setUploading(false);
    }
  };

  const handleDone = () => setPageState('submitted');

  const requestedTypes = request?.requestedTypes ?? [];
  const submittedTypes = new Set(uploadedDocs.map(d => d.type));
  const totalRequired = requestedTypes.length;
  const totalDone = requestedTypes.filter(t => submittedTypes.has(t)).length;
  const allDone = totalRequired > 0 && totalDone === totalRequired;

  // ── States ─────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-slate-400" size={32} />
          <p className="text-gray-500">{`${t('loading')}`}</p>
        </div>
      </div>
    );
  }

  if (pageState === 'not_found' || pageState === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-red-50 to-orange-50">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-400" size={36} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">{pageState === 'expired' ? 'Lien expire' : 'Lien introuvable'}</h1>
          <p className="text-gray-500 leading-relaxed">
            {pageState === 'expired' ? "Ce lien a expire. Contactez l'organisateur." : "Ce lien est invalide."}
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="max-w-sm w-full text-center">
          <div className="w-24 h-24 rounded-3xl bg-green-500 flex items-center justify-center mx-auto mb-6 shadow-xl">
            <CheckCircle className="text-white" size={44} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Merci !</h1>
          <p className="text-gray-500 leading-relaxed mb-6">Vos documents ont ete transmis avec succes.</p>
          {uploadedDocs.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Documents envoyes</p>
              <div className="space-y-2">
                {uploadedDocs.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <CheckCircle size={14} className="text-green-500" />
                    <span className="text-sm text-gray-700 font-medium">{DOC_LABELS[doc.type] ?? doc.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!request) return null;

  // ── Ready state ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/60 sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">D</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight">Depot de documents</p>
            <p className="text-xs text-gray-400 truncate">{request.signatoryName}</p>
          </div>
          {totalRequired > 0 && (
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-blue-600">{totalDone}/{totalRequired}</p>
              <p className="text-xs text-gray-400">docs</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        {/* Greeting */}
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-blue-600 to-blue-700 relative overflow-hidden">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">{`${t('good_morning')}`}</p>
          <h1 className="text-xl font-bold mb-1">{request.signatoryName}</h1>
          <p className="text-white/70 text-sm">{request.signatoryEmail}</p>
          {request.message && (
            <div className="mt-4 bg-white/15 rounded-xl px-4 py-3">
              <p className="text-sm text-white/90 leading-relaxed">{request.message}</p>
            </div>
          )}
        </div>

        {/* Checklist */}
        {requestedTypes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-800">Documents requis</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {requestedTypes.map(type => {
                const done = submittedTypes.has(type);
                const isActive = activeDocType === type && !done;
                return (
                  <button key={type} onClick={() => { if (!done) setActiveDocType(type); }}
                    className={`w-full flex items-center gap-3.5 px-5 py-3.5 transition-all text-left ${done ? 'bg-green-50/50' : isActive ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${done ? 'bg-green-100' : isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      {done ? <CheckCircle size={16} className="text-green-500" /> : <span>{DOC_ICONS[type] ?? '📄'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${done ? 'text-green-700' : 'text-gray-800'}`}>{DOC_LABELS[type] ?? type}</p>
                      {done && <p className="text-xs text-green-500">Recu</p>}
                      {isActive && <p className="text-xs text-blue-600">{`${t('in_progress')}`}</p>}
                    </div>
                    {!done && <ArrowRight size={14} className={`shrink-0 ${isActive ? 'text-blue-500' : 'text-gray-300'}`} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload zone */}
        {!allDone && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-800">Ajouter un fichier</h2>
              <p className="text-xs text-gray-400 mt-0.5">Pour : <span className="font-semibold text-gray-600">{DOC_LABELS[activeDocType] ?? activeDocType}</span></p>
            </div>
            <div className="p-5">
              {!selectedFile ? (
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFileSelect(f); }}
                >
                  <Upload size={20} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-700 mb-1">Glisser ici ou <span className="text-blue-600">choisir</span></p>
                  <p className="text-xs text-gray-400">JPG, PNG, PDF — max 20 Mo</p>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-3 mb-4">
                    {selectedFile.type.startsWith('image/') ? (
                      <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0">
                        <img src={URL.createObjectURL(selectedFile)} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md">
                        <FileText size={22} className="text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">{formatBytes(selectedFile.size)}</p>
                    </div>
                    <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-gray-600 transition-all" disabled={uploading}>
                      <X size={14} />
                    </button>
                  </div>
                  <button onClick={handleUpload} disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-60 shadow-md">
                    {uploading ? <><Loader2 size={15} className="animate-spin" /> Envoi...</> : <><Upload size={15} /> Envoyer</>}
                  </button>
                </div>
              )}
              {uploadError && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-600 font-medium">{uploadError}</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>
          </div>
        )}

        {/* Done button */}
        {uploadedDocs.length > 0 && (
          <button onClick={handleDone}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-bold text-white shadow-xl active:scale-95 transition-all"
            style={{ background: allDone ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #374151, #1f2937)' }}>
            {allDone ? <><Sparkles size={18} /> Soumettre et terminer</> : <><CheckCircle size={18} /> Soumettre</>}
          </button>
        )}
      </div>
    </div>
  );
}
