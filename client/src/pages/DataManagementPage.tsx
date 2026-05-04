import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Folder, FileText, ChevronRight } from 'lucide-react';
import { FileUploader } from '@/components/common/FileUploader';
import { DataSourceList } from '@/components/data-management/DataSourceList';
import { ProcessingStatus } from '@/components/data-management/ProcessingStatus';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import { dataService } from '@/services/dataService';
import api from '@/services/api';
import type { CompanyDocument, ProcessingJob } from '@/types/data.types';

export default function DataManagementPage() {
  const { user } = useAuthStore();
  const { t } = useLangStore();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'documents' | 'folders'>('folders');

  const loadDocuments = async () => {
    if (!user?.companyId) return;
    setIsLoadingDocs(true);
    try {
      const docs = await dataService.getDocuments(user.companyId);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user?.companyId]);

  const handleUpload = async (file: File) => {
    if (!user?.companyId) throw new Error('No company ID');

    // Add to processing jobs
    const jobId = `job-${Date.now()}`;
    setProcessingJobs((prev) => [...prev, {
      id: jobId,
      filename: file.name,
      status: 'processing',
      progress: 10,
      message: 'Uploading...',
    }]);

    try {
      const uploaded = await dataService.uploadDocument(file, user.companyId);
      setDocuments((prev) => [uploaded, ...prev]);

      // Update job to completed
      setProcessingJobs((prev) =>
        prev.map((j) => j.id === jobId ? { ...j, status: 'completed', progress: 100 } : j)
      );

      // Remove job after delay
      setTimeout(() => {
        setProcessingJobs((prev) => prev.filter((j) => j.id !== jobId));
      }, 3000);
    } catch (err) {
      setProcessingJobs((prev) =>
        prev.map((j) => j.id === jobId
          ? { ...j, status: 'failed', message: err instanceof Error ? err.message : 'Upload failed' }
          : j
        )
      );
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document? This will also remove it from the AI knowledge base.')) return;
    try {
      await dataService.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Data Sources</h2>
          <p className="text-sm text-slate-400 mt-1">
            Upload company documents to power the AI knowledge base
          </p>
        </div>
        <button
          onClick={loadDocuments}
          disabled={isLoadingDocs}
          className="btn-secondary px-3 py-2 text-sm flex items-center gap-2"
        >
          <RefreshCw size={14} className={isLoadingDocs ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
        {(['folders', 'documents', 'upload'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200
              ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {tab === 'folders' ? `Dossiers` : tab === 'documents' ? `Tous (${documents.length})` : 'Importer'}
          </button>
        ))}
      </div>

      {/* Processing status */}
      <ProcessingStatus jobs={processingJobs} />

      {/* Content */}
      {activeTab === 'folders' ? (
        <FoldersView documents={documents} onDelete={handleDelete} isLoading={isLoadingDocs} />
      ) : activeTab === 'upload' ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-100 mb-4">Upload Documents</h3>
          <FileUploader onUpload={handleUpload} />
        </div>
      ) : (
        <DataSourceList
          documents={documents}
          onDelete={handleDelete}
          isLoading={isLoadingDocs}
        />
      )}

      {/* Info box */}
      <div className="bg-blue-600/10 border border-blue-600/20 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-blue-300 mb-1">How it works</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>1. Upload documents (PDF, DOCX, XLSX, CSV, TXT — up to 50MB each)</li>
          <li>2. Orlode automatically extracts text and creates a searchable knowledge base</li>
          <li>3. The AI uses these documents to answer questions with cited sources</li>
        </ul>
      </div>
    </div>
  );
}

// ── Folders View — group documents by classification category ─────────────

const FOLDER_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  contract:       { icon: '📝', label: 'Contrats',        color: '#F97316', bg: 'bg-orange-500' },
  invoice:        { icon: '💰', label: 'Factures',        color: '#16A34A', bg: 'bg-green-600' },
  financial:      { icon: '📊', label: 'Finance',         color: '#10B981', bg: 'bg-emerald-500' },
  report:         { icon: '📋', label: 'Rapports',        color: '#3B82F6', bg: 'bg-blue-500' },
  hr_policy:      { icon: '👩', label: 'RH & Politique',  color: '#6366F1', bg: 'bg-indigo-500' },
  legal:          { icon: '⚖',  label: 'Juridique',       color: '#A855F7', bg: 'bg-purple-500' },
  marketing:      { icon: '📣', label: 'Marketing',       color: '#EC4899', bg: 'bg-pink-500' },
  technical_spec: { icon: '🖥',  label: 'Technique',       color: '#0EA5E9', bg: 'bg-sky-500' },
  meeting_notes:  { icon: '🎤', label: 'Réunions',        color: '#E11D48', bg: 'bg-rose-500' },
  other:          { icon: '📁', label: 'Autres',          color: '#EAB308', bg: 'bg-yellow-500' },
  unknown:        { icon: '📂', label: 'Non classés',     color: '#64748B', bg: 'bg-slate-500' },
};

function FoldersView({ documents, onDelete, isLoading }: {
  documents: CompanyDocument[];
  onDelete: (id: string) => void;
  isLoading: boolean;
}) {
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  // Group documents by classification
  const folders = useMemo(() => {
    const groups: Record<string, CompanyDocument[]> = {};
    documents.forEach(doc => {
      const cat = (doc as Record<string, unknown>)['classification'] as string ?? 'unknown';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(doc);
    });
    // Sort by count descending
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [documents]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const unclassifiedCount = documents.filter(d => !(d as Record<string, unknown>)['classification']).length;

  const reclassify = async () => {
    try {
      await api.post('/data/reclassify');
      alert('Reclassification lancée ! Rechargez dans quelques secondes.');
    } catch {}
  };

  if (documents.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
        <Folder size={40} className="mx-auto mb-3 text-slate-600" />
        <p className="text-sm text-slate-400">Aucun document. Importez des fichiers pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reclassify button for old docs */}
      {unclassifiedCount > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-3 flex items-center justify-between">
          <p className="text-xs text-amber-300">{unclassifiedCount} document{unclassifiedCount > 1 ? 's' : ''} non classé{unclassifiedCount > 1 ? 's' : ''}</p>
          <button onClick={reclassify} className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700">
            Reclassifier
          </button>
        </div>
      )}

      {/* Folder grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {folders.map(([cat, docs]) => {
          const config = FOLDER_CONFIG[cat] ?? FOLDER_CONFIG.unknown;
          const isOpen = openFolder === cat;
          return (
            <button key={cat} onClick={() => setOpenFolder(isOpen ? null : cat)}
              className={`text-left rounded-2xl overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                isOpen ? 'ring-2 ring-blue-500 shadow-xl' : ''
              }`}>
              <div className="p-4" style={{ background: config.color }}>
                <span className="text-3xl">{config.icon}</span>
              </div>
              <div className="bg-slate-800 border border-slate-700 border-t-0 p-3 rounded-b-2xl">
                <p className="text-sm font-bold text-white">{config.label}</p>
                <p className="text-xs text-slate-400">{docs.length} fichier{docs.length > 1 ? 's' : ''}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Open folder contents */}
      {openFolder && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <span className="text-lg">{(FOLDER_CONFIG[openFolder] ?? FOLDER_CONFIG.unknown).icon}</span>
            <h3 className="text-sm font-bold text-white">{(FOLDER_CONFIG[openFolder] ?? FOLDER_CONFIG.unknown).label}</h3>
            <span className="text-xs text-slate-400 ml-auto">{folders.find(([c]) => c === openFolder)?.[1]?.length ?? 0} fichiers</span>
          </div>
          <div className="divide-y divide-slate-700/50">
            {folders.find(([c]) => c === openFolder)?.[1]?.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-750">
                <FileText size={16} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{doc.originalName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">{doc.fileType}</span>
                    {(doc as Record<string, unknown>)['summary'] && (
                      <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{(doc as Record<string, unknown>)['summary'] as string}</span>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  doc.status === 'completed' ? 'bg-green-900/30 text-green-400' : doc.status === 'processing' ? 'bg-blue-900/30 text-blue-400' : 'bg-red-900/30 text-red-400'
                }`}>{doc.status}</span>
                <button onClick={() => onDelete(doc.id)} className="text-slate-500 hover:text-red-400 text-xs">Supprimer</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
