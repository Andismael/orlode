/**
 * Vision Settings — per-company configuration for face recognition.
 *
 * Backend:
 *   - GET  /faces/settings → returns the company's settings (or defaults if none)
 *   - POST /faces/settings → saves the company's settings
 *
 * Compact purple/violet hero (same palette as FaceDirectoryPage), single vertical stack of sections.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Settings as SettingsIcon, Loader2, Save, Bell, Image as ImageIcon,
  Globe, Sliders, CheckCircle2,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';

// Palette — copied from FaceDirectoryPage (single source of truth: keep aligned).
const C = {
  purple:      '#7C3AED',
  purpleDeep:  '#5B21B6',
  purpleSoft:  '#EDE9FE',
  purpleLight: '#C4B5FD',
  pink:        '#EC4899',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  emerald:     '#10B981',
  emeraldDeep: '#059669',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
  .vs-btn-purple { display:inline-flex; align-items:center; gap:8px; padding:12px 22px; border-radius:11px; background:linear-gradient(135deg, ${C.purple}, ${C.purpleDeep}); color:#fff; border:none; cursor:pointer; font-weight:700; font-size:14px; font-family:'Inter',sans-serif; box-shadow:0 8px 18px -8px ${C.purple}; transition:transform .15s ease, box-shadow .15s ease; }
  .vs-btn-purple:hover { transform: translateY(-1px); box-shadow:0 12px 24px -10px ${C.purple}; }
  .vs-btn-purple:disabled { opacity:.5; cursor:not-allowed; transform:none; }
  .vs-card { background:${C.cream}; border:1px solid rgba(10,42,32,0.06); border-radius:18px; padding:22px 22px; }
  .vs-card-title { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:800; color:${C.ink}; margin:0 0 4px; letter-spacing:-0.01em; }
  .vs-card-sub   { font-size:12px; color:${C.inkSoft}; margin:0 0 14px; }
  .vs-slider     { -webkit-appearance:none; appearance:none; width:100%; height:6px; background:${C.purpleSoft}; border-radius:100px; outline:none; cursor:pointer; }
  .vs-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:20px; height:20px; border-radius:50%; background:${C.purple}; border:2px solid #fff; box-shadow:0 2px 8px ${C.purple}80; cursor:pointer; }
  .vs-slider::-moz-range-thumb     { width:20px; height:20px; border-radius:50%; background:${C.purple}; border:2px solid #fff; box-shadow:0 2px 8px ${C.purple}80; cursor:pointer; }
  .vs-toggle { position:relative; width:46px; height:26px; border-radius:100px; background:rgba(10,42,32,0.15); transition:background .2s ease; cursor:pointer; flex-shrink:0; }
  .vs-toggle.on { background:${C.purple}; }
  .vs-toggle::after { content:''; position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%; background:#fff; transition:transform .2s ease; box-shadow:0 2px 6px rgba(0,0,0,0.18); }
  .vs-toggle.on::after { transform: translateX(20px); }
  .vs-select { padding:10px 14px; border-radius:10px; border:1.5px solid rgba(10,42,32,0.12); background:#fff; font-size:13px; font-family:inherit; color:${C.ink}; outline:none; cursor:pointer; min-width:180px; transition:border-color .15s ease; }
  .vs-select:focus { border-color:${C.purple}; box-shadow:0 0 0 3px ${C.purple}25; }
  .vs-back { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; background:rgba(255,250,240,0.18); backdrop-filter:blur(10px); color:${C.cream}; text-decoration:none; font-size:12px; font-weight:600; border:1px solid rgba(255,250,240,0.25); transition:background .15s ease; }
  .vs-back:hover { background:rgba(255,250,240,0.32); }
`;

interface VisionSettings {
  confidenceThreshold: number;
  notifyOnRecognition: boolean;
  photoRetentionDays: number; // 30, 90, 365, 0 (= illimité)
  allowExternalApi: boolean;
}

const DEFAULTS: VisionSettings = {
  confidenceThreshold: 0.7,
  notifyOnRecognition: true,
  photoRetentionDays: 365,
  allowExternalApi: false,
};

export default function VisionSettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<VisionSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get<VisionSettings>('/faces/settings');
        if (mounted && res.data && typeof res.data === 'object') {
          setSettings({
            confidenceThreshold: res.data.confidenceThreshold ?? DEFAULTS.confidenceThreshold,
            notifyOnRecognition: res.data.notifyOnRecognition ?? DEFAULTS.notifyOnRecognition,
            photoRetentionDays: res.data.photoRetentionDays ?? DEFAULTS.photoRetentionDays,
            allowExternalApi: res.data.allowExternalApi ?? DEFAULTS.allowExternalApi,
          });
        }
      } catch (err: any) {
        // 404 → use defaults silently; other errors → toast.
        if (err?.status && err.status !== 404) {
          toast.error('Chargement impossible', 'Réessaie dans un instant.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/faces/settings', settings);
      toast.success('Paramètres enregistrés', 'La configuration Vision est à jour.');
    } catch (e: any) {
      toast.error('Sauvegarde impossible', e?.response?.data?.message ?? 'Réessaie dans un instant.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.creamDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 size={32} className="spin" color={C.purple} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.creamDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>

      {/* Compact hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDeep} 100%)`,
        padding: '24px 32px 28px', color: C.cream, position: 'relative', overflow: 'hidden',
      }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.15 }} width="280" height="280" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60"  stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>

        <div style={{ maxWidth: 880, margin: '0 auto', position: 'relative' }}>
          {/* Back link */}
          <div style={{ marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => navigate('/agents/vision')}
              className="vs-back"
              style={{ fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <ArrowLeft size={13} /> Retour
            </button>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 100,
            background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            <SettingsIcon size={11} /> VISION · CONFIGURATION
          </div>

          <h1 className="display-font" style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 800, margin: 0, lineHeight: 1.15 }}>
            Paramètres <em style={{ fontStyle: 'italic', fontWeight: 500 }}>Vision</em>
          </h1>
          <p style={{ marginTop: 8, fontSize: 13, opacity: 0.92, maxWidth: 560 }}>
            Reconnaissance faciale, seuils, rétention.
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 32px 64px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Confidence threshold */}
        <div className="vs-card">
          <h3 className="vs-card-title">
            <Sliders size={16} color={C.purple} /> Seuil de confiance
          </h3>
          <p className="vs-card-sub">
            Score minimum pour qu'un visage soit considéré reconnu. Plus haut = plus strict (moins de faux positifs).
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.01}
              value={settings.confidenceThreshold}
              onChange={(e) => setSettings((s) => ({ ...s, confidenceThreshold: Number(e.target.value) }))}
              className="vs-slider"
            />
            <div style={{
              minWidth: 76, padding: '6px 12px', borderRadius: 8,
              background: C.purpleSoft, color: C.purpleDeep,
              fontWeight: 700, fontSize: 14, textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {Math.round(settings.confidenceThreshold * 100)}%
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="vs-card">
          <h3 className="vs-card-title">
            <Bell size={16} color={C.purple} /> Notifications
          </h3>
          <p className="vs-card-sub">
            Recevez un signal en temps réel à chaque visiteur reconnu (utile pour l'accueil).
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', userSelect: 'none' }}>
            <button
              type="button"
              role="switch"
              aria-checked={settings.notifyOnRecognition}
              className={`vs-toggle ${settings.notifyOnRecognition ? 'on' : ''}`}
              onClick={() => setSettings((s) => ({ ...s, notifyOnRecognition: !s.notifyOnRecognition }))}
              style={{ border: 'none' }}
            />
            <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>
              Notifier quand un visiteur est reconnu
            </span>
          </label>
        </div>

        {/* Photo retention */}
        <div className="vs-card">
          <h3 className="vs-card-title">
            <ImageIcon size={16} color={C.purple} /> Rétention photos
          </h3>
          <p className="vs-card-sub">
            Durée pendant laquelle les photos d'enrôlement sont conservées avant suppression automatique.
          </p>
          <select
            className="vs-select"
            value={settings.photoRetentionDays}
            onChange={(e) => setSettings((s) => ({ ...s, photoRetentionDays: Number(e.target.value) }))}
          >
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
            <option value={365}>365 jours</option>
            <option value={0}>Illimité</option>
          </select>
        </div>

        {/* External API */}
        <div className="vs-card">
          <h3 className="vs-card-title">
            <Globe size={16} color={C.purple} /> Synchronisation
          </h3>
          <p className="vs-card-sub">
            Autoriser des systèmes externes (caméras, kiosks tiers) à interroger l'API de reconnaissance.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', userSelect: 'none' }}>
            <button
              type="button"
              role="switch"
              aria-checked={settings.allowExternalApi}
              className={`vs-toggle ${settings.allowExternalApi ? 'on' : ''}`}
              onClick={() => setSettings((s) => ({ ...s, allowExternalApi: !s.allowExternalApi }))}
              style={{ border: 'none' }}
            />
            <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>
              Permettre l'API de reconnaissance externe
            </span>
          </label>
        </div>

        {/* Save bar */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12,
          marginTop: 8, padding: '8px 0',
        }}>
          <button
            type="button"
            className="vs-btn-purple"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? <><Loader2 size={15} className="spin" /> Enregistrement…</>
              : <><Save size={15} /> Enregistrer</>}
          </button>
        </div>

        {/* Footer hint */}
        <div style={{
          marginTop: 4, padding: '10px 14px', borderRadius: 10,
          background: C.purpleSoft, color: C.purpleDeep,
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <CheckCircle2 size={14} />
          Les changements s'appliquent immédiatement à la reconnaissance en direct.
        </div>
      </div>
    </div>
  );
}
