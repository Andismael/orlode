import React, { useState } from 'react';
import { Trash2, Eye, RefreshCw, FileText, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatusBadge } from '@/components/common/Badge';
import { formatBytes, formatDate } from '@/utils/formatters';
import type { CompanyDocument } from '@/types/data.types';

interface DataSourceListProps {
  documents: CompanyDocument[];
  onDelete: (id: string) => void;
  onReprocess?: (id: string) => void;
  isLoading?: boolean;
}

const FILE_ICONS: Record<string, string> = {
  pdf: '📄',
  docx: '📝',
  xlsx: '📊',
  csv: '📋',
  txt: '📃',
};

export function DataSourceList({ documents, onDelete, onReprocess, isLoading }: DataSourceListProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const getFileExt = (filename: string) => filename.split('.').pop()?.toLowerCase() ?? '';

  if (documents.length === 0 && !isLoading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
        <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
          <FileText size={24} className="text-slate-500" />
        </div>
        <p className="text-slate-400 font-medium">No documents yet</p>
        <p className="text-sm text-slate-500 mt-1">Upload your first document to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Documents ({documents.length})</h3>
        <span className="text-xs text-slate-400">
          {documents.filter((d) => d.status === 'completed').length} indexed
        </span>
      </div>

      <div className="divide-y divide-slate-700/50">
        {documents.map((doc, index) => {
          const ext = getFileExt(doc.originalName);
          const icon = FILE_ICONS[ext] ?? '📄';

          return (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              className="flex items-center gap-4 px-5 py-4 hover:bg-slate-700/30 transition-colors group"
            >
              {/* Icon */}
              <span className="text-xl flex-shrink-0">{icon}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{doc.originalName}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-500">{formatBytes(doc.fileSize)}</span>
                  <span className="text-xs text-slate-600">•</span>
                  <span className="text-xs text-slate-500">{formatDate(doc.uploadedAt)}</span>
                  {doc.chunksCreated !== undefined && (
                    <>
                      <span className="text-xs text-slate-600">•</span>
                      <span className="text-xs text-slate-500">{doc.chunksCreated} chunks</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status */}
              <StatusBadge status={doc.status} />

              {/* Actions */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === doc.id ? null : doc.id)}
                  className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical size={14} />
                </button>

                {activeMenu === doc.id && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-10 overflow-hidden">
                    <button className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-600 transition-colors">
                      <Eye size={12} />
                      View details
                    </button>
                    {onReprocess && (
                      <button
                        onClick={() => { onReprocess(doc.id); setActiveMenu(null); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
                      >
                        <RefreshCw size={12} />
                        Reprocess
                      </button>
                    )}
                    <div className="border-t border-slate-600" />
                    <button
                      onClick={() => { onDelete(doc.id); setActiveMenu(null); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default DataSourceList;
