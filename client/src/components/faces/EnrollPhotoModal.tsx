import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, CheckCircle, AlertCircle, Loader2, Camera } from 'lucide-react';
import { loadFaceApiModels, detectFaceDescriptor, faceApiModelsLoaded } from '@/lib/faceDetection';
import api from '@/services/api';

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  photoURL?: string;
}

interface EnrollPhotoModalProps {
  employee: Employee;
  onClose: () => void;
  onEnrolled: (photoURL: string) => void;
}

type Status = 'idle' | 'loading_models' | 'detecting' | 'uploading' | 'saving' | 'done' | 'error';

export default function EnrollPhotoModal({ employee, onClose, onEnrolled }: EnrollPhotoModalProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [previewURL, setPreviewURL] = useState<string | null>(employee.photoURL ?? null);
  const [faceFound, setFaceFound] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(faceApiModelsLoaded());
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (modelsLoaded) return;
    setStatus('loading_models');
    setModelsLoading(true);
    loadFaceApiModels()
      .then(() => {
        setModelsLoaded(true);
        setStatus('idle');
      })
      .catch(() => {
        setModelError('Failed to load face recognition models. Check your internet connection.');
        setStatus('error');
      })
      .finally(() => setModelsLoading(false));
  }, [modelsLoaded]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    selectedFileRef.current = file;
    const url = URL.createObjectURL(file);
    setPreviewURL(url);
    setFaceFound(false);
    setErrorMsg('');
    setStatus('detecting');

    // Wait for image to load then detect
    const img = new Image();
    img.onload = async () => {
      try {
        const descriptor = await detectFaceDescriptor(img);
        if (!descriptor) {
          setStatus('error');
          setErrorMsg('No face detected in this photo. Please use a clear frontal photo.');
          return;
        }
        setFaceFound(true);
        setStatus('idle');
      } catch (err) {
        setStatus('error');
        setErrorMsg((err as Error).message ?? 'Face detection failed');
      }
    };
    img.src = url;
  };

  const handleEnroll = async () => {
    const file = selectedFileRef.current;
    if (!file || !faceFound || !modelsLoaded) return;

    try {
      // Step 1 — Upload photo
      setStatus('uploading');
      const formData = new FormData();
      formData.append('photo', file);
      const uploadRes = await api.post<{ photoURL: string }>(
        `/faces/employees/${employee.id}/photo`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const photoURL = uploadRes.data.photoURL;

      // Step 2 — Detect face and get descriptor from the image
      setStatus('detecting');
      const img = imgRef.current;
      if (!img) throw new Error('Image element not found');
      const descriptor = await detectFaceDescriptor(img);
      if (!descriptor) throw new Error('Face not detected on second pass');

      // Step 3 — Save descriptor to backend
      setStatus('saving');
      await api.post(`/faces/employees/${employee.id}/descriptor`, {
        descriptor: Array.from(descriptor), // Float32Array → plain array
      });

      setStatus('done');
      onEnrolled(photoURL);
    } catch (err) {
      setStatus('error');
      setErrorMsg((err as Error).message ?? 'Enrollment failed');
    }
  };

  const statusMessages: Partial<Record<Status, string>> = {
    loading_models: 'Loading face recognition models...',
    detecting: 'Detecting face...',
    uploading: 'Uploading photo...',
    saving: 'Saving face data...',
    done: 'Face enrolled successfully!',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between relative overflow-hidden" style={{ background: '#FF009D' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
          <div className="relative">
            <h2 className="text-base font-semibold text-white">Enroll Face</h2>
            <p className="text-xs text-white/70 mt-0.5">{employee.name}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors relative">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview */}
          <div
            className="w-full h-48 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer border-2 border-dashed transition-colors"
            style={{ borderColor: faceFound ? '#00A550' : '#e5e7eb' }}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewURL ? (
              <div className="relative w-full h-full">
                <img
                  ref={imgRef}
                  src={previewURL}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
                {faceFound && (
                  <div className="absolute top-2 right-2 bg-white rounded-full p-1 shadow">
                    <CheckCircle size={16} color="#00A550" />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <Camera size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Click to select a photo</p>
                <p className="text-xs text-gray-300 mt-1">Clear frontal face photo</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Status */}
          {(status === 'loading_models' || status === 'detecting' || status === 'uploading' || status === 'saving') && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#FF009D' }}>
              <Loader2 size={14} className="animate-spin" />
              {statusMessages[status]}
            </div>
          )}
          {status === 'done' && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle size={14} />
              {statusMessages.done}
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle size={14} className="flex-shrink-0" />
              {errorMsg || modelError}
            </div>
          )}

          {faceFound && status === 'idle' && (
            <p className="text-xs text-green-600 flex items-center gap-1.5">
              <CheckCircle size={12} />
              Face detected — ready to enroll
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={status === 'loading_models' || modelsLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {previewURL ? 'Change Photo' : 'Select Photo'}
            </button>
            <button
              onClick={handleEnroll}
              disabled={!faceFound || status !== 'idle'}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-40"
              style={{ background: '#FF009D' }}
            >
              {status === 'done' ? 'Enrolled!' : 'Enroll Face'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
