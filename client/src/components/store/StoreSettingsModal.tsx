/**
 * StoreSettingsModal — modale de réglages partagée pour toutes les verticales
 * (boutique, restaurant, hôtel, salon, santé, immobilier).
 *
 * Props clés :
 *   - accentColor : couleur de la verticale (orange resto, bleu hôtel, etc.)
 *                   utilisée pour le header gradient + boutons.
 *   - store        : objet store actuel (récupéré par la page parent).
 *   - onSaved      : callback après PATCH réussi.
 *
 * Sauvegarde via PATCH /commerce/stores/:storeId — accepte tous les fields.
 */
import React, { useRef, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  X, Save, Loader2, Camera, Upload, Lock, Unlock,
  CreditCard, Globe, Image as ImageIcon, Phone, Mail, Sparkles, Instagram, Facebook,
} from 'lucide-react';

const C = {
  cream:     '#FFFAF0',
  creamDeep: '#F5EDD6',
  ink:       '#0A2A20',
  inkSoft:   '#5A6B62',
  inkLight:  '#94A3A0',
};

const COMMON_CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD', 'GBP', 'NGN', 'KES', 'GHS', 'MAD'];

interface Practitioner {
  id: string;
  name: string;
  role?: string;
  photoUrl?: string;
  workingHours?: string;
  active?: boolean;
}

interface StoreLike {
  id: string;
  slug?: string;
  name?: string;
  ownerPhone?: string;
  paymentInstructions?: string;
  currency?: string;
  country?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  accentColor?: string | null;
  pinHash?: string;
  openingHours?: string;
  establishmentType?: 'restaurant' | 'maquis' | 'bar';
  salonType?: 'coiffure' | 'esthetique' | 'spa' | 'barber';
  businessType?: string;
  address?: string;
  googleMapsUrl?: string;
  practitioners?: Practitioner[];
  checkInInstructions?: string;
  houseRules?: string;
  cancellationPolicy?: 'flexible' | 'moderate' | 'strict';
  weeklyDiscountPct?: number;
  monthlyDiscountPct?: number;
  // Branding / marketing identity
  tagline?: string;
  shortDescription?: string;
  contactEmail?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
}

// businessType → public path prefix
const PUBLIC_PATH: Record<string, string> = {
  boutique: 'shop', restaurant: 'menu', hotel: 'hotel',
  service: 'salon', health: 'cabinet', realestate: 'biens',
  residence: 'residence',
};

function publicUrlFor(store: StoreLike): string | null {
  if (!store.slug) return null;
  const path = PUBLIC_PATH[store.businessType ?? 'boutique'] ?? 'shop';
  const base = window.location.origin;
  return `${base}/${path}/${store.slug}`;
}

export function StoreSettingsModal({
  accentColor, accentDeep, store, onClose, onSaved,
}: {
  accentColor: string;
  accentDeep: string;
  store: StoreLike;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(store.name ?? '');
  const [ownerPhone, setOwnerPhone] = useState(store.ownerPhone ?? '');
  const [paymentInstructions, setPaymentInstructions] = useState(store.paymentInstructions ?? '');
  const [currency, setCurrency] = useState(store.currency ?? 'XOF');
  const [country, setCountry] = useState(store.country ?? 'CI');
  const [logoUrl, setLogoUrl] = useState(store.logoUrl ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(store.coverImageUrl ?? '');
  const [storeAccentColor, setStoreAccentColor] = useState(store.accentColor ?? accentColor);
  const [openingHours, setOpeningHours] = useState(store.openingHours ?? '');
  const [establishmentType, setEstablishmentType] = useState<'restaurant' | 'maquis' | 'bar' | ''>(store.establishmentType ?? '');
  const [icalUrl, setIcalUrl] = useState<string | null>(null);
  const [icalLoading, setIcalLoading] = useState(false);
  const [imports, setImports] = useState<Array<{ url: string; name: string; roomId?: string; lastSyncedAt?: string }>>([]);
  const [newImportUrl, setNewImportUrl] = useState('');
  const [newImportName, setNewImportName] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [salonType, setSalonType] = useState<'coiffure' | 'esthetique' | 'spa' | 'barber' | ''>(store.salonType ?? '');
  const [address, setAddress] = useState(store.address ?? '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(store.googleMapsUrl ?? '');
  const [pin, setPin] = useState('');
  const isRestaurantPack = store.businessType === 'restaurant';
  const isSalonPack = store.businessType === 'service';
  const supportsPractitioners = store.businessType === 'service' || store.businessType === 'health';
  const supportsStayCycle = store.businessType === 'hotel' || store.businessType === 'residence';
  const [checkInInstructions, setCheckInInstructions] = useState(store.checkInInstructions ?? '');
  const [houseRules, setHouseRules] = useState(store.houseRules ?? '');
  const [cancellationPolicy, setCancellationPolicy] = useState<'flexible' | 'moderate' | 'strict' | ''>(store.cancellationPolicy ?? '');
  const [weeklyDiscountPct, setWeeklyDiscountPct] = useState<number | ''>(store.weeklyDiscountPct ?? '');
  const [monthlyDiscountPct, setMonthlyDiscountPct] = useState<number | ''>(store.monthlyDiscountPct ?? '');
  const [practitioners, setPractitioners] = useState<Practitioner[]>(
    Array.isArray(store.practitioners) ? store.practitioners : [],
  );
  // Branding / marketing identity
  const [tagline, setTagline] = useState(store.tagline ?? '');
  const [shortDescription, setShortDescription] = useState(store.shortDescription ?? '');
  const [contactEmail, setContactEmail] = useState(store.contactEmail ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(store.websiteUrl ?? '');
  const [instagramUrl, setInstagramUrl] = useState(store.instagramUrl ?? '');
  const [facebookUrl, setFacebookUrl] = useState(store.facebookUrl ?? '');
  const [tiktokUrl, setTiktokUrl] = useState(store.tiktokUrl ?? '');
  const slugifyId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const addPractitioner = () => setPractitioners(prev => [...prev, { id: `staff-${Date.now()}`, name: '', active: true }]);
  const updatePractitioner = (idx: number, patch: Partial<Practitioner>) =>
    setPractitioners(prev => prev.map((p, i) => i === idx ? { ...p, ...patch, ...(patch.name ? { id: p.id || slugifyId(patch.name) } : {}) } : p));
  const removePractitioner = (idx: number) => setPractitioners(prev => prev.filter((_, i) => i !== idx));
  // iCal makes sense for time-based packs (not boutique which sells products)
  const supportsIcal = ['hotel', 'residence', 'restaurant', 'service', 'health', 'realestate'].includes(store.businessType ?? '');

  const fetchIcalUrl = async () => {
    if (icalLoading) return;
    setIcalLoading(true);
    try {
      const r: any = await api.get(`/commerce/stores/${store.id}/ical`);
      setIcalUrl(r?.data?.url ?? null);
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message ?? 'Impossible de récupérer le lien iCal.');
    } finally { setIcalLoading(false); }
  };

  const regenerateIcal = async () => {
    if (!confirm('Régénérer ? L\'ancien lien deviendra invalide partout où tu l\'as collé.')) return;
    setIcalLoading(true);
    try {
      const r: any = await api.post(`/commerce/stores/${store.id}/ical/regenerate`);
      setIcalUrl(r?.data?.url ?? null);
      toast.success('Lien iCal régénéré');
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? ''); }
    finally { setIcalLoading(false); }
  };

  const fetchImports = async () => {
    try {
      const r: any = await api.get(`/commerce/stores/${store.id}/ical/imports`);
      setImports(r?.data?.imports ?? []);
    } catch { /* silent */ }
  };
  React.useEffect(() => { if (supportsIcal) fetchImports(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const addImport = async () => {
    if (!newImportUrl || !newImportName) { toast.error('URL et nom requis'); return; }
    setImportBusy(true);
    try {
      const r: any = await api.post(`/commerce/stores/${store.id}/ical/imports`, { url: newImportUrl.trim(), name: newImportName.trim() });
      setImports(r?.data?.imports ?? []);
      const sync = r?.data?.sync;
      if (sync?.error) toast.error('Sync échoué', sync.error);
      else toast.success('Feed ajouté', `${sync?.imported ?? 0} dates importées`);
      setNewImportUrl(''); setNewImportName('');
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? ''); }
    finally { setImportBusy(false); }
  };

  const removeImport = async (url: string) => {
    if (!confirm('Supprimer ce feed ? Les blocages associés seront enlevés.')) return;
    try {
      const r: any = await api.delete(`/commerce/stores/${store.id}/ical/imports`, { params: { url } });
      setImports(r?.data?.imports ?? []);
      toast.success('Feed supprimé');
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? ''); }
  };

  const syncImports = async () => {
    setImportBusy(true);
    try {
      const r: any = await api.post(`/commerce/stores/${store.id}/ical/imports/sync`);
      const total = (r?.data?.results ?? []).reduce((acc: number, x: any) => acc + (x.imported ?? 0), 0);
      const errs = (r?.data?.results ?? []).filter((x: any) => x.error);
      if (errs.length) toast.error(`${errs.length} feed(s) en erreur`, errs.map((x: any) => `${x.name}: ${x.error}`).join(' · '));
      else toast.success('Synchronisé', `${total} dates à jour`);
      await fetchImports();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? ''); }
    finally { setImportBusy(false); }
  };
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<'general' | 'branding' | 'security'>('general');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const hasPin = !!store.pinHash;

  const canSubmit = name.trim().length >= 2 && ownerPhone.trim().length >= 6 && !submitting;

  const uploadImage = async (file: File, slot: 'logo' | 'cover') => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Image trop lourde', 'Max 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result ?? '');
      try {
        const r: any = await api.post(`/commerce/stores/${store.id}/upload-image`, {
          imageBase64: dataUrl.replace(/^data:image\/[^;]+;base64,/, ''),
          imageMimeType: file.type,
          slot,
        }).catch(() => null);
        if (r?.data?.url) {
          if (slot === 'logo') setLogoUrl(r.data.url);
          else setCoverImageUrl(r.data.url);
          toast.success('Image téléchargée');
        } else {
          // Fallback: just store the dataUrl as-is for preview (real upload would need endpoint)
          if (slot === 'logo') setLogoUrl(dataUrl);
          else setCoverImageUrl(dataUrl);
          toast.info('Aperçu local', 'L\'upload réel sera disponible bientôt.');
        }
      } catch {
        toast.error('Erreur', 'Upload impossible.');
      }
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      ownerPhone: ownerPhone.trim(),
      paymentInstructions: paymentInstructions.trim(),
      currency: currency.toUpperCase(),
      country: country.toUpperCase(),
    };
    if (logoUrl !== (store.logoUrl ?? '')) payload['logoUrl'] = logoUrl;
    if (coverImageUrl !== (store.coverImageUrl ?? '')) payload['coverImageUrl'] = coverImageUrl;
    if (storeAccentColor && /^#[0-9A-Fa-f]{6}$/.test(storeAccentColor)) payload['accentColor'] = storeAccentColor;
    if (pin && /^\d{4,6}$/.test(pin)) payload['pin'] = pin;
    if (openingHours !== (store.openingHours ?? '')) payload['openingHours'] = openingHours.trim();
    if (establishmentType && establishmentType !== (store.establishmentType ?? '')) {
      payload['establishmentType'] = establishmentType;
    }
    if (salonType && salonType !== (store.salonType ?? '')) {
      payload['salonType'] = salonType;
    }
    if (address !== (store.address ?? '')) payload['address'] = address.trim();
    if (googleMapsUrl !== (store.googleMapsUrl ?? '')) payload['googleMapsUrl'] = googleMapsUrl.trim();
    if (supportsStayCycle) {
      if (checkInInstructions !== (store.checkInInstructions ?? '')) payload['checkInInstructions'] = checkInInstructions.trim();
      if (houseRules !== (store.houseRules ?? '')) payload['houseRules'] = houseRules.trim();
      if (cancellationPolicy && cancellationPolicy !== (store.cancellationPolicy ?? '')) payload['cancellationPolicy'] = cancellationPolicy;
      if (typeof weeklyDiscountPct === 'number') payload['weeklyDiscountPct'] = weeklyDiscountPct;
      if (typeof monthlyDiscountPct === 'number') payload['monthlyDiscountPct'] = monthlyDiscountPct;
    }
    if (supportsPractitioners) {
      payload['practitioners'] = practitioners
        .filter(p => p.name.trim().length >= 2)
        .map(p => ({
          id: p.id || slugifyId(p.name),
          name: p.name.trim(),
          ...(p.role?.trim() ? { role: p.role.trim() } : {}),
          ...(p.photoUrl?.trim() ? { photoUrl: p.photoUrl.trim() } : {}),
          ...(p.workingHours?.trim() ? { workingHours: p.workingHours.trim() } : {}),
          active: p.active !== false,
        }));
    }
    // Branding / marketing identity (only send fields that changed)
    if (tagline !== (store.tagline ?? '')) payload['tagline'] = tagline.trim();
    if (shortDescription !== (store.shortDescription ?? '')) payload['shortDescription'] = shortDescription.trim();
    if (contactEmail !== (store.contactEmail ?? '')) payload['contactEmail'] = contactEmail.trim();
    if (websiteUrl !== (store.websiteUrl ?? '')) payload['websiteUrl'] = websiteUrl.trim();
    if (instagramUrl !== (store.instagramUrl ?? '')) payload['instagramUrl'] = instagramUrl.trim();
    if (facebookUrl !== (store.facebookUrl ?? '')) payload['facebookUrl'] = facebookUrl.trim();
    if (tiktokUrl !== (store.tiktokUrl ?? '')) payload['tiktokUrl'] = tiktokUrl.trim();

    try {
      await api.patch(`/commerce/stores/${store.id}`, payload);
      toast.success('Paramètres sauvegardés');
      onSaved();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message ?? 'Sauvegarde impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: `1.5px solid ${C.creamDeep}`, fontSize: 13,
    fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.ink,
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: C.inkSoft, textTransform: 'uppercase' as const,
    letterSpacing: '0.05em', marginBottom: 5,
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, padding: 12,
      background: 'rgba(10,42,32,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22, maxWidth: 620, width: '100%',
        maxHeight: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column',
        margin: 'auto', minHeight: 0,
        boxShadow: '0 30px 80px -20px rgba(10,42,32,0.5)',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${accentColor}, ${accentDeep})`,
          color: '#fff', padding: '20px 24px', borderRadius: '22px 22px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Paramètres
          </h3>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(255,255,255,0.18)', color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.creamDeep}`, padding: '0 24px' }}>
          {[
            { id: 'general' as const,  label: 'Général',   icon: Globe },
            { id: 'branding' as const, label: 'Apparence', icon: ImageIcon },
            { id: 'security' as const, label: 'Sécurité',  icon: Lock },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '12px 16px', background: 'transparent', border: 'none',
                borderBottom: tab === t.id ? `2px solid ${accentDeep}` : '2px solid transparent',
                color: tab === t.id ? accentDeep : C.inkSoft,
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
              }}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          {tab === 'general' && (
            <>
              {(() => {
                const publicUrl = publicUrlFor(store);
                if (!publicUrl) return null;
                return (
                  <div style={{
                    marginBottom: 14, padding: '10px 12px', borderRadius: 10,
                    background: `linear-gradient(135deg, ${accentColor}10, ${accentDeep}15)`,
                    border: `1px solid ${accentDeep}30`,
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  }}>
                    <Globe size={16} color={accentDeep} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: accentDeep, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Page publique</div>
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: accentDeep, fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all', textDecoration: 'underline' }}>
                        {publicUrl}
                      </a>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => navigator.clipboard.writeText(publicUrl).then(() => toast.success('Lien copié'))}
                        style={{ padding: '6px 10px', borderRadius: 8, background: '#fff', color: accentDeep, border: `1px solid ${accentDeep}40`, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Copier
                      </button>
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '6px 10px', borderRadius: 8, background: accentDeep, color: '#fff', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', textDecoration: 'none' }}>
                        Voir →
                      </a>
                    </div>
                  </div>
                );
              })()}
              {supportsIcal && (
                <div style={{
                  marginBottom: 14, padding: '10px 12px', borderRadius: 10,
                  background: '#F0F9FF', border: '1px solid #BAE6FD',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>📅</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase' }}>Sync calendrier (iCal)</div>
                      <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                        Synchronise tes réservations avec Google Calendar, Apple Calendar, Booking.com, Airbnb…
                      </div>
                    </div>
                    {!icalUrl && (
                      <button onClick={fetchIcalUrl} disabled={icalLoading}
                        style={{ padding: '6px 12px', borderRadius: 8, background: '#0369A1', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {icalLoading ? '…' : 'Activer'}
                      </button>
                    )}
                  </div>
                  {icalUrl && (
                    <>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <a href={icalUrl} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, minWidth: 200, fontSize: 11, color: '#0369A1', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all', textDecoration: 'underline' }}>
                          {icalUrl}
                        </a>
                        <button onClick={() => navigator.clipboard.writeText(icalUrl).then(() => toast.success('Lien iCal copié'))}
                          style={{ padding: '5px 10px', borderRadius: 6, background: '#fff', color: '#0369A1', border: '1px solid #BAE6FD', fontWeight: 700, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Copier
                        </button>
                        <button onClick={regenerateIcal} title="Invalide l'ancien lien"
                          style={{ padding: '5px 10px', borderRadius: 6, background: 'transparent', color: C.inkSoft, border: '1px solid #BAE6FD', fontWeight: 700, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ↻ Régénérer
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
                        📌 <strong>Export</strong> : tes réservations Orlode → vers Google/Booking/Airbnb (lis-seul).
                      </div>
                    </>
                  )}
                </div>
              )}
              {supportsIcal && (
                <div style={{
                  marginBottom: 14, padding: '10px 12px', borderRadius: 10,
                  background: '#FEF3C7', border: '1px solid #FCD34D',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', marginBottom: 4 }}>📥 Import iCal externe</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 8 }}>
                    Branche les calendriers Booking, Airbnb ou Google ici → Orlode bloque ces dates pour empêcher l'overbooking.
                  </div>
                  {imports.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      {imports.map(im => (
                        <div key={im.url} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, background: '#fff', border: '1px solid #FDE68A' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', minWidth: 60 }}>{im.name}</span>
                          <span style={{ flex: 1, fontSize: 10, color: C.inkSoft, fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>{im.url}</span>
                          <button onClick={() => removeImport(im.url)} title="Supprimer"
                            style={{ width: 22, height: 22, borderRadius: 6, background: 'transparent', color: '#DC2626', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>×</button>
                        </div>
                      ))}
                      <button onClick={syncImports} disabled={importBusy}
                        style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 6, background: '#92400E', color: '#fff', border: 'none', fontWeight: 700, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {importBusy ? '…' : '↻ Synchroniser maintenant'}
                      </button>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 6 }}>
                    <input value={newImportName} onChange={e => setNewImportName(e.target.value)}
                      placeholder="Airbnb"
                      style={{ ...inputStyle, padding: '7px 9px', fontSize: 12 }} />
                    <input value={newImportUrl} onChange={e => setNewImportUrl(e.target.value)}
                      placeholder="https://www.airbnb.com/calendar/ical/..."
                      style={{ ...inputStyle, padding: '7px 9px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                    <button onClick={addImport} disabled={importBusy || !newImportUrl || !newImportName}
                      style={{ padding: '7px 12px', borderRadius: 8, background: '#92400E', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: (importBusy || !newImportUrl || !newImportName) ? 0.5 : 1 }}>
                      {importBusy ? '…' : '+ Ajouter'}
                    </button>
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Nom de l'établissement</label>
                <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px', gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}><Phone size={11} style={{ display: 'inline', marginRight: 4 }} /> WhatsApp owner</label>
                  <input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} placeholder="+225 07..." style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Pays</label>
                  <input value={country} onChange={e => setCountry(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} />
                </div>
                <div>
                  <label style={labelStyle}>Devise</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', padding: '10px 6px' }}>
                    {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}><CreditCard size={11} style={{ display: 'inline', marginRight: 4 }} /> Instructions de paiement</label>
                <textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} rows={2}
                  placeholder="Wave +225 07XX XX XX XX, ou paiement à la livraison"
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>🕐 Horaires d'ouverture</label>
                <input value={openingHours} onChange={e => setOpeningHours(e.target.value)}
                  placeholder="Lun-Ven 12h-22h, Sam-Dim 18h-23h"
                  maxLength={200} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>📍 Adresse</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="Cocody, Riviera 3, à côté de la pharmacie centrale"
                  maxLength={300} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>🗺 Lien Google Maps</label>
                <input value={googleMapsUrl} onChange={e => setGoogleMapsUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                  style={inputStyle} />
              </div>
              {isRestaurantPack && (
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Type d'établissement</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['restaurant', 'maquis', 'bar'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setEstablishmentType(t)}
                        style={{
                          flex: 1, padding: '8px 10px', borderRadius: 10,
                          border: establishmentType === t ? `1.5px solid ${accentDeep}` : `1.5px solid ${C.creamDeep}`,
                          background: establishmentType === t ? `${accentDeep}15` : '#fff',
                          color: establishmentType === t ? accentDeep : C.inkSoft,
                          fontWeight: 700, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}>
                        {t === 'restaurant' ? '🍽 Resto' : t === 'maquis' ? '🍢 Maquis' : '🍻 Bar'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {isSalonPack && (
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Type de salon</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {([
                      ['coiffure', '💇 Coiffure'],
                      ['esthetique', '💄 Esthétique'],
                      ['spa', '💆 Spa / Massage'],
                      ['barber', '💈 Barber'],
                    ] as const).map(([t, label]) => (
                      <button key={t} type="button" onClick={() => setSalonType(t)}
                        style={{
                          padding: '8px 10px', borderRadius: 10,
                          border: salonType === t ? `1.5px solid ${accentDeep}` : `1.5px solid ${C.creamDeep}`,
                          background: salonType === t ? `${accentDeep}15` : '#fff',
                          color: salonType === t ? accentDeep : C.inkSoft,
                          fontWeight: 700, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                    Cosmétique seulement (label + emoji affichés). Toutes les features sont identiques.
                  </div>
                </div>
              )}
              {supportsPractitioners && (
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>👥 Équipe (praticiens / coiffeuses / médecins)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {practitioners.map((p, i) => (
                      <div key={p.id || i} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 60px 32px',
                        gap: 6, alignItems: 'center',
                        padding: '6px 8px', borderRadius: 8,
                        background: p.active === false ? '#FEE2E2' : '#FFF',
                        border: `1px solid ${p.active === false ? '#FCA5A5' : C.creamDeep}`,
                      }}>
                        <input value={p.name} onChange={e => updatePractitioner(i, { name: e.target.value })}
                          placeholder="Nom (Marie, Aïcha…)"
                          style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.creamDeep}`, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
                        <input value={p.role ?? ''} onChange={e => updatePractitioner(i, { role: e.target.value })}
                          placeholder="Rôle (Coiffeuse, Médecin…)"
                          style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.creamDeep}`, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
                        <button type="button" onClick={() => updatePractitioner(i, { active: p.active === false })}
                          title={p.active === false ? 'Réactiver' : 'Désactiver temporairement'}
                          style={{
                            padding: '6px 4px', borderRadius: 6,
                            background: p.active === false ? '#FCA5A5' : `${accentDeep}15`,
                            color: p.active === false ? '#7F1D1D' : accentDeep,
                            border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 10, fontFamily: 'inherit',
                          }}>
                          {p.active === false ? 'OFF' : 'ON'}
                        </button>
                        <button type="button" onClick={() => removePractitioner(i)} title="Supprimer"
                          style={{ width: 30, height: 30, borderRadius: 6, background: 'transparent', color: '#DC2626', border: 'none', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>
                          ×
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={addPractitioner}
                      style={{
                        alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 8,
                        background: 'transparent', color: accentDeep,
                        border: `1.5px dashed ${accentDeep}40`,
                        cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
                      }}>
                      + Ajouter un membre
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                    Le client peut choisir avec qui prendre RDV. Le bot WhatsApp propose la liste sur demande.
                  </div>
                </div>
              )}
              {supportsStayCycle && (
                <>
                  <div style={{
                    marginTop: 16, marginBottom: 8,
                    paddingTop: 12, borderTop: `1px solid ${C.creamDeep}`,
                    fontSize: 11, fontWeight: 800, color: C.inkSoft,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    🏠 Cycle de séjour (hôtel / résidence)
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>🔑 Instructions check-in</label>
                    <textarea value={checkInInstructions} onChange={e => setCheckInInstructions(e.target.value)} rows={3}
                      placeholder="Code de la porte d'entrée : 4321. La clé est dans la boite à gants côté gauche. Wifi : OrlodeGuest / 2024..."
                      maxLength={1500}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} />
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                      Envoyé automatiquement au client par WhatsApp <strong>la veille de son arrivée à 19h</strong>.
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>📋 Règlement intérieur</label>
                    <textarea value={houseRules} onChange={e => setHouseRules(e.target.value)} rows={3}
                      placeholder="• Non fumeur · Animaux acceptés · Pas de fête après 22h..."
                      maxLength={1500}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} />
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                      Affiché sur la page publique + envoyé au check-in.
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>📑 Politique d'annulation</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {([
                        ['flexible', '🟢 Flexible', 'Annulation gratuite J-1'],
                        ['moderate', '🟡 Modérée', 'Annulation 5j avant'],
                        ['strict', '🔴 Stricte', 'Non remboursable'],
                      ] as const).map(([val, label, sub]) => {
                        const sel = cancellationPolicy === val;
                        return (
                          <button key={val} type="button" onClick={() => setCancellationPolicy(val)}
                            style={{
                              padding: '8px 6px', borderRadius: 10,
                              border: sel ? `1.5px solid ${accentDeep}` : `1.5px solid ${C.creamDeep}`,
                              background: sel ? `${accentDeep}15` : '#fff',
                              color: sel ? accentDeep : C.inkSoft,
                              fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                            }}>
                            <div style={{ fontSize: 11, fontWeight: 800 }}>{label}</div>
                            <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>🎉 Remises long séjour (% sur les nuits, hors frais ménage)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <input type="number" value={String(weeklyDiscountPct ?? '')}
                          onChange={e => setWeeklyDiscountPct(e.target.value === '' ? '' : Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))}
                          placeholder="0"
                          style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} />
                        <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 3, textAlign: 'center' }}>
                          ≥ 7 nuits (%)
                        </div>
                      </div>
                      <div>
                        <input type="number" value={String(monthlyDiscountPct ?? '')}
                          onChange={e => setMonthlyDiscountPct(e.target.value === '' ? '' : Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))}
                          placeholder="0"
                          style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} />
                        <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 3, textAlign: 'center' }}>
                          ≥ 28 nuits (%)
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                      Max 50%. Affichées au client comme incitations à rester plus longtemps.
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'branding' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}><Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} /> Slogan / baseline</label>
                <input value={tagline} onChange={e => setTagline(e.target.value)}
                  placeholder="Ex. : Le meilleur attiéké de la rive — livré chaud."
                  maxLength={120} style={inputStyle} />
                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                  Affiché en gros sur la page publique sous le nom. Max 120 caractères.
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>📝 Description courte</label>
                <textarea value={shortDescription} onChange={e => setShortDescription(e.target.value)} rows={3}
                  placeholder="2-3 phrases qui présentent ton activité — utilisées sur la page publique et dans les réponses de l'IA."
                  maxLength={400}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} />
                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                  L'IA s'en sert aussi pour répondre "Tu fais quoi ?" sur WhatsApp/Telegram.
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}><Mail size={11} style={{ display: 'inline', marginRight: 4 }} /> Email contact</label>
                  <input value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                    placeholder="contact@monenseigne.com" type="email" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}><Globe size={11} style={{ display: 'inline', marginRight: 4 }} /> Site web</label>
                  <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                    placeholder="https://monenseigne.com" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>🌐 Réseaux sociaux</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Instagram size={14} color="#E4405F" style={{ flexShrink: 0 }} />
                    <input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)}
                      placeholder="https://instagram.com/tonprofil"
                      style={{ ...inputStyle, padding: '7px 9px', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Facebook size={14} color="#1877F2" style={{ flexShrink: 0 }} />
                    <input value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)}
                      placeholder="https://facebook.com/tapage"
                      style={{ ...inputStyle, padding: '7px 9px', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, flexShrink: 0 }}>TT</span>
                    <input value={tiktokUrl} onChange={e => setTiktokUrl(e.target.value)}
                      placeholder="https://tiktok.com/@tonprofil"
                      style={{ ...inputStyle, padding: '7px 9px', fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                  Liens affichés sur la page publique + utilisés par les agents Marketing/Social.
                </div>
              </div>
              <div style={{ marginTop: 16, marginBottom: 8, paddingTop: 12, borderTop: `1px solid ${C.creamDeep}`, fontSize: 11, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Visuels
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Logo</label>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'logo'); }} />
                {logoUrl ? (
                  <div style={{ position: 'relative', display: 'inline-block', borderRadius: 14, overflow: 'hidden', background: C.creamDeep, padding: 8 }}>
                    <img src={logoUrl} alt="logo" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                    <button onClick={() => setLogoUrl('')} style={{
                      position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 6,
                      background: 'rgba(10,42,32,0.8)', color: '#fff', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><X size={12} /></button>
                  </div>
                ) : (
                  <button onClick={() => logoInputRef.current?.click()}
                    style={{
                      padding: '14px 22px', borderRadius: 12,
                      background: C.creamDeep, color: accentDeep,
                      border: `1.5px dashed ${accentColor}`, cursor: 'pointer',
                      fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
                    }}>
                    <Upload size={14} /> <span style={{ fontSize: 12, fontWeight: 600 }}>Upload logo</span>
                  </button>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Image de couverture</label>
                <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'cover'); }} />
                {coverImageUrl ? (
                  <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: C.creamDeep, maxHeight: 160 }}>
                    <img src={coverImageUrl} alt="cover" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => setCoverImageUrl('')} style={{
                      position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 8,
                      background: 'rgba(10,42,32,0.8)', color: '#fff', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => coverInputRef.current?.click()}
                    style={{
                      width: '100%', padding: '24px', borderRadius: 12,
                      background: C.creamDeep, color: accentDeep,
                      border: `1.5px dashed ${accentColor}`, cursor: 'pointer',
                      fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    }}>
                    <Camera size={20} /> <span style={{ fontSize: 12, fontWeight: 600 }}>Upload image de couverture</span>
                  </button>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Couleur d'accent</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={storeAccentColor || accentColor} onChange={e => setStoreAccentColor(e.target.value)}
                    style={{ width: 50, height: 38, padding: 0, border: `1.5px solid ${C.creamDeep}`, borderRadius: 8, cursor: 'pointer' }} />
                  <input type="text" value={storeAccentColor || ''} onChange={e => setStoreAccentColor(e.target.value)}
                    placeholder="#10B981" style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', flex: 1 }} />
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                  Visible sur la page publique partagée à tes clients.
                </div>
              </div>
            </>
          )}

          {tab === 'security' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  {hasPin ? <Lock size={18} color={accentDeep} /> : <Unlock size={18} color={C.inkLight} />}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                      PIN actions sensibles
                    </div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>
                      {hasPin ? 'PIN configuré (4-6 chiffres). Saisir ci-dessous pour le changer.' : 'Aucun PIN configuré — défini-en un.'}
                    </div>
                  </div>
                </div>
                <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={hasPin ? '••••' : 'Ex: 1234'} maxLength={6}
                  style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.4em', textAlign: 'center', fontSize: 18 }} />
                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                  Demandé pour : exporter la liste clients, supprimer plusieurs items, rembourser.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: `1px solid ${C.creamDeep}`,
          display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#FAFAF7',
          borderRadius: '0 0 22px 22px',
        }}>
          <button onClick={onClose} disabled={submitting}
            style={{
              padding: '10px 16px', borderRadius: 10,
              background: 'transparent', color: C.inkSoft,
              border: `1.5px solid ${C.inkLight}`, cursor: 'pointer',
              fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
            }}>Annuler</button>
          <button onClick={submit} disabled={!canSubmit}
            style={{
              padding: '10px 16px', borderRadius: 10,
              background: accentDeep, color: '#fff',
              border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
              opacity: canSubmit ? 1 : 0.5,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: `0 6px 16px -6px ${accentColor}80`,
            }}>
            {submitting ? <><Loader2 size={14} className="spin" /> …</> : <><Save size={14} /> Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}
