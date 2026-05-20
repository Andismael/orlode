import React, { useRef, useState } from 'react';
import { Camera, Loader2, Star } from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';

interface Props {
  /** API path prefix — e.g. `/commerce/stores/{storeId}/products/{productId}` or `.../rooms/{roomId}`. */
  basePath: string;
  /** Initial gallery (objects support both legacy + new shapes from server). */
  initialUrls?: string[];
  /** Initial primary URL — first item in `initialUrls` if not specified. */
  initialPrimary?: string | null;
  /** Theme accent color (hex). */
  accentColor: string;
  accentDeep: string;
  /** Maximum images. Default 6. */
  max?: number;
  onChange?: (urls: string[], primary: string | null) => void;
}

/**
 * Reusable multi-photo editor used across store packs (Hotel rooms, Boutique
 * products, Restaurant menu items, Real Estate properties, Salon services,
 * Residence units). Handles upload + delete + "set as primary".
 *
 * Server contract:
 *   POST   {basePath}/photos               { imageBase64, imageMimeType }   → { imageUrls }
 *   DELETE {basePath}/photos?url=...                                         → { imageUrls }
 *   POST   {basePath}/photos/primary       { url }                            → { imageUrls }
 */
export default function MultiPhotoEditor({
  basePath, initialUrls, initialPrimary, accentColor, accentDeep, max = 6, onChange,
}: Props) {
  const [urls, setUrls] = useState<string[]>(initialUrls ?? []);
  const [primary, setPrimary] = useState<string | null>(initialPrimary ?? (initialUrls?.[0] ?? null));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reachedMax = urls.length >= max;

  const emit = (newUrls: string[], newPrimary: string | null) => {
    setUrls(newUrls); setPrimary(newPrimary);
    onChange?.(newUrls, newPrimary);
  };

  const upload = async (files: FileList) => {
    const remaining = max - urls.length;
    const accepted = Array.from(files).slice(0, remaining);
    if (accepted.length === 0) {
      toast.error(`Max ${max} photos`, 'Supprime-en une avant.');
      return;
    }
    setBusy(true);
    try {
      let nextUrls = urls;
      let nextPrimary = primary;
      for (const file of accepted) {
        if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} trop lourd`, 'Max 8 Mo.'); continue; }
        const dataUrl: string = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.readAsDataURL(file);
        });
        const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
        const r: any = await api.post(`${basePath}/photos`, {
          imageBase64: base64, imageMimeType: file.type || 'image/jpeg',
        }).catch((e: any) => { toast.error('Upload échoué', e?.response?.data?.message ?? ''); return null; });
        if (r?.data?.imageUrls) {
          nextUrls = r.data.imageUrls;
          if (!nextPrimary && nextUrls[0]) nextPrimary = nextUrls[0];
        }
      }
      emit(nextUrls, nextPrimary);
      if (accepted.length > 0) toast.success(`${accepted.length} photo${accepted.length > 1 ? 's' : ''} ajoutée${accepted.length > 1 ? 's' : ''}`);
    } finally { setBusy(false); }
  };

  const remove = async (url: string) => {
    try {
      const r: any = await api.delete(`${basePath}/photos`, { params: { url } });
      const list = r?.data?.imageUrls ?? urls.filter(u => u !== url);
      const newPrimary = primary === url ? (list[0] ?? null) : primary;
      emit(list, newPrimary);
      toast.success('Photo supprimée');
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? ''); }
  };

  const setAsPrimary = async (url: string) => {
    try {
      const r: any = await api.post(`${basePath}/photos/primary`, { url });
      const list = r?.data?.imageUrls ?? [url, ...urls.filter(u => u !== url)];
      emit(list, url);
      toast.success('Photo principale changée');
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? ''); }
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => { if (e.target.files) upload(e.target.files); e.target.value = ''; }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
        {urls.map((url, i) => {
          const isPrimary = url === primary;
          return (
            <div key={`${url}-${i}`} style={{
              position: 'relative', aspectRatio: '1',
              borderRadius: 10, overflow: 'hidden', background: '#000',
              border: isPrimary ? `2px solid ${accentDeep}` : '1px solid rgba(0,0,0,0.08)',
            }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {isPrimary && (
                <span style={{
                  position: 'absolute', top: 4, left: 4,
                  padding: '2px 7px', borderRadius: 6,
                  background: accentDeep, color: '#fff', fontSize: 9, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  <Star size={9} fill="#fff" /> PRIMARY
                </span>
              )}
              {!isPrimary && (
                <button type="button" onClick={() => setAsPrimary(url)} title="Définir comme principale"
                  style={{
                    position: 'absolute', bottom: 4, left: 4,
                    padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 700, fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                  <Star size={9} /> Principale
                </button>
              )}
              <button type="button" onClick={() => remove(url)} title="Supprimer"
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(220,38,38,0.92)', color: '#fff', border: 'none',
                  cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                ×
              </button>
            </div>
          );
        })}
        {!reachedMax && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            style={{
              aspectRatio: '1', borderRadius: 10, background: '#FFF', color: accentDeep,
              border: `1.5px dashed ${accentColor}`, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
            {busy ? <Loader2 size={18} className="spin" /> : <Camera size={20} />}
            <span style={{ fontSize: 10, fontWeight: 700 }}>+ {urls.length === 0 ? 'Photos' : 'Ajouter'}</span>
            <span style={{ fontSize: 9, opacity: 0.6 }}>{urls.length}/{max}</span>
          </button>
        )}
      </div>
      {reachedMax && (
        <div style={{ fontSize: 11, color: '#94A3A0', marginTop: 6 }}>
          Maximum de {max} photos atteint. Supprime-en une pour en ajouter d'autres.
        </div>
      )}
    </div>
  );
}
