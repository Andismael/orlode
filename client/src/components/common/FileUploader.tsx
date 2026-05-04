import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatBytes } from '@/utils/formatters';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface FileUploaderProps {
  onUpload: (file: File) => Promise<void>;
  accept?: Record<string, string[]>;
  maxSize?: number;
  multiple?: boolean;
  className?: string;
}

const DEFAULT_ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
};

export function FileUploader({
  onUpload,
  accept = DEFAULT_ACCEPT,
  maxSize = 50 * 1024 * 1024, // 50MB
  multiple = true,
  className = '',
}: FileUploaderProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);

  const updateFile = (id: string, updates: Partial<UploadFile>) => {
    setUploadFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        status: 'pending',
      }));

      setUploadFiles((prev) => [...prev, ...newFiles]);

      for (const uploadFile of newFiles) {
        updateFile(uploadFile.id, { status: 'uploading', progress: 10 });
        try {
          // Simulate progress increments while uploading
          const progressInterval = setInterval(() => {
            setUploadFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id && f.progress < 85
                  ? { ...f, progress: f.progress + 15 }
                  : f
              )
            );
          }, 300);

          await onUpload(uploadFile.file);

          clearInterval(progressInterval);
          updateFile(uploadFile.id, { status: 'completed', progress: 100 });
        } catch (err) {
          updateFile(uploadFile.id, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          });
        }
      }
    },
    [onUpload]
  );

  const removeFile = (id: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop: handleDrop,
    accept,
    maxSize,
    multiple,
  });

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-600 hover:border-blue-500/50 hover:bg-slate-800/50'
          }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={`p-3 rounded-full ${isDragActive ? 'bg-blue-600' : 'bg-slate-700'} transition-colors`}>
            <Upload size={24} className={isDragActive ? 'text-white' : 'text-slate-400'} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              or <span className="text-blue-400 hover:text-blue-300">browse to upload</span>
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Supports PDF, DOCX, XLSX, CSV, TXT — max {formatBytes(maxSize)}
          </p>
        </div>
      </div>

      {/* Rejections */}
      {fileRejections.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-sm text-red-400 font-medium mb-1">Some files were rejected:</p>
          {fileRejections.map(({ file, errors }) => (
            <p key={file.name} className="text-xs text-red-400">
              {file.name}: {errors.map((e) => e.message).join(', ')}
            </p>
          ))}
        </div>
      )}

      {/* File list */}
      <AnimatePresence>
        {uploadFiles.map((uf) => (
          <motion.div
            key={uf.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-lg"
          >
            <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <File size={14} className="text-slate-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-slate-200 truncate">{uf.file.name}</p>
                <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{formatBytes(uf.file.size)}</span>
              </div>

              {uf.status === 'uploading' && (
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uf.progress}%` }}
                  />
                </div>
              )}

              {uf.status === 'error' && (
                <p className="text-xs text-red-400">{uf.error}</p>
              )}
            </div>

            <div className="flex-shrink-0">
              {uf.status === 'uploading' && (
                <Loader2 size={16} className="text-blue-400 animate-spin" />
              )}
              {uf.status === 'completed' && (
                <CheckCircle size={16} className="text-emerald-400" />
              )}
              {uf.status === 'error' && (
                <AlertCircle size={16} className="text-red-400" />
              )}
              {uf.status === 'pending' && (
                <button
                  onClick={() => removeFile(uf.id)}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {(uf.status === 'completed' || uf.status === 'error') && (
              <button
                onClick={() => removeFile(uf.id)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default FileUploader;
