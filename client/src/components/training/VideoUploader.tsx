/**
 * VideoUploader — Upload MP4/WebM to Firebase Storage with progress
 * Returns the download URL once complete
 */
import React, { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/services/firebase';
import { Upload, Film, X, CheckCircle, Loader2 } from 'lucide-react';

interface VideoUploaderProps {
  companyId?: string;
  onUploaded: (url: string, fileName: string) => void;
  className?: string;
}

const ACCEPT = '.mp4,.webm,.mov,.avi,.mkv';
const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function VideoUploader({ companyId, onUploaded, className }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_SIZE) {
      setError(`Fichier trop volumineux (max ${formatBytes(MAX_SIZE)})`);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext ?? '')) {
      setError('Format non supporte. Utilisez MP4, WebM, MOV, AVI ou MKV.');
      return;
    }

    setError('');
    setUploading(true);
    setProgress(0);
    setFileName(file.name);
    setDone(false);

    const storagePath = `companies/${companyId ?? 'default'}/training-videos/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'video/mp4',
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setProgress(pct);
      },
      (err) => {
        setError(`Erreur upload: ${err.message}`);
        setUploading(false);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setUploading(false);
        setDone(true);
        setProgress(100);
        onUploaded(url, file.name);
      }
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setUploading(false);
    setProgress(0);
    setFileName('');
    setError('');
    setDone(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleChange} className="hidden" />

      {/* Upload zone */}
      {!uploading && !done && (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Upload size={18} className="text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Uploader une video</p>
              <p className="text-xs text-gray-400">MP4, WebM, MOV — max {formatBytes(MAX_SIZE)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Uploading state */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 size={16} className="text-blue-600 animate-spin flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{fileName}</p>
              <p className="text-xs text-blue-600">{progress}% uploade</p>
            </div>
            <button onClick={reset} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
          </div>
          <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Done state */}
      {done && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-3">
          <Film size={16} className="text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-700 truncate">{fileName}</p>
            <p className="text-xs text-green-600">Upload termine</p>
          </div>
          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-700 ml-1">Changer</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-2 text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
      )}
    </div>
  );
}
