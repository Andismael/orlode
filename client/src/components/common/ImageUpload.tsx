/**
 * ImageUpload — circular avatar uploader.
 * Used in Talents + Influenceurs signup and edit-profile pages.
 *
 * Storage path: `{prefix}/{userUid}/avatar.{ext}` (overwritten on each
 * upload so we don't accumulate stale files). Max 3 MB, image/* only.
 * Storage rules: same `talents/{uid}/**` + `influencers/{uid}/**` rules
 * already in place — the MIME check passes since image/* matches video/*
 * pattern would NOT — so this requires loosening the storage rule.
 *
 * Returns the resolved download URL via onChange whenever it changes.
 */
import React, { useRef, useState } from 'react';
import { Camera, Loader2, X, AlertCircle } from 'lucide-react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/services/firebase';

const MAX_SIZE = 3 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  userUid: string;
  storagePrefix: 'talents' | 'influencers';
  value: string;
  onChange: (url: string) => void;
  /** Visual tint of the placeholder + progress bar. Defaults to green. */
  accentColor?: string;
  size?: number;
  /** Optional initial letter to show in placeholder (e.g. 'M' for Marc) */
  initial?: string;
}

export default function ImageUpload({
  userUid, storagePrefix, value, onChange,
  accentColor = '#0F5C3F',
  size = 88,
  initial = '?',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError('Format non supporté · JPG / PNG / WebP uniquement');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`Trop lourd · max 3 Mo (${(file.size / 1024 / 1024).toFixed(1)} Mo)`);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
      const path = `${storagePrefix}/${userUid}/avatar.${ext}`;
      const ref = storageRef(storage, path);
      const task = uploadBytesResumable(ref, file, { contentType: file.type });
      task.on('state_changed',
        snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        err => { setError(err.message); setUploading(false); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          onChange(url);
          setUploading(false);
          setProgress(100);
        },
      );
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
    }
  };

  const clear = () => {
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
    setError(null);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: value
            ? `url(${value}) center/cover`
            : `linear-gradient(135deg, ${accentColor}25, ${accentColor}10)`,
          border: `2px solid ${value ? accentColor : `${accentColor}40`}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'all 0.2s ease',
        }}
      >
        {uploading ? (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <Loader2 size={20} className="animate-spin" color={accentColor} />
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, fontWeight: 700, color: accentColor,
            }}>
              {progress}%
            </div>
          </div>
        ) : value ? null : (
          <div style={{
            fontFamily: 'Fraunces, serif',
            fontSize: size * 0.45,
            fontWeight: 800,
            color: accentColor,
            fontStyle: 'italic',
            opacity: 0.55,
          }}>
            {initial.toUpperCase()}
          </div>
        )}

        {/* Camera icon overlay on hover */}
        {!uploading && !value && (
          <div style={{
            position: 'absolute', bottom: 4, right: 4,
            width: 26, height: 26, borderRadius: '50%',
            background: accentColor, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 10px -2px ${accentColor}80`,
          }}>
            <Camera size={13} />
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          onChange={e => handleFile(e.target.files?.[0])}
          style={{ display: 'none' }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 15, fontWeight: 700, color: '#0A1410',
          letterSpacing: '-0.015em', marginBottom: 4,
        }}>
          {value ? 'Photo de profil ✓' : 'Ajoute ta photo'}
        </div>
        <p style={{
          fontSize: 12, color: '#5C6B62',
          margin: '0 0 8px', lineHeight: 1.4,
        }}>
          {value
            ? 'Clique pour changer · JPG/PNG/WebP · max 3 Mo'
            : 'JPG / PNG / WebP · max 3 Mo · format carré recommandé'}
        </p>
        {value && (
          <button
            type="button"
            onClick={clear}
            style={{
              background: 'transparent', border: 'none',
              color: '#5C6B62', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', padding: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <X size={11} /> Retirer
          </button>
        )}
        {error && (
          <div style={{
            marginTop: 6,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: '#FEE2E2', border: '1px solid #FCA5A5',
            borderRadius: 100, padding: '4px 10px',
            fontSize: 10, fontWeight: 600, color: '#991B1B',
          }}>
            <AlertCircle size={10} /> {error}
          </div>
        )}
      </div>
    </div>
  );
}
