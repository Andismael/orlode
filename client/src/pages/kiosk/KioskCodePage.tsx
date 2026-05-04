/**
 * KioskCodePage — Employee check-in hub (3 modes: Code / Camera / QR)
 * Kiosk-optimized dark UI with big touch targets
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Camera, QrCode } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { KioskNumpad } from '@/components/kiosk/KioskNumpad';
import { KioskCamera } from '@/components/kiosk/KioskCamera';
import { KioskQrScanner } from '@/components/kiosk/KioskQrScanner';

type Mode = 'code' | 'camera' | 'qr';
interface Settings {
  methods: { code: boolean; camera: boolean; qr: boolean };
}

export default function KioskCodePage() {
  const navigate = useNavigate();
  const { t } = useLangStore();
  const [mode, setMode] = useState<Mode>('code');
  const [settings, setSettings] = useState<Settings>({ methods: { code: true, camera: false, qr: false } });

  useEffect(() => {
    api.get('/reception/checkin-settings')
      .then(r => {
        const s = r.data as Settings;
        if (s?.methods) {
          setSettings(s);
          // default to first enabled method
          if (!s.methods.code && s.methods.camera) setMode('camera');
          else if (!s.methods.code && !s.methods.camera && s.methods.qr) setMode('qr');
        }
      })
      .catch(() => {});
  }, []);

  const enabledModes = [
    settings.methods.code && { key: 'code' as Mode, label: 'Code', icon: KeyRound },
    settings.methods.camera && { key: 'camera' as Mode, label: 'Camera', icon: Camera },
    settings.methods.qr && { key: 'qr' as Mode, label: 'QR Badge', icon: QrCode },
  ].filter(Boolean) as Array<{ key: Mode; label: string; icon: typeof KeyRound }>;

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button onClick={() => navigate('/kiosk')} className="flex items-center gap-2 text-white/50 hover:text-white text-lg">
          <ArrowLeft size={20} /> Retour
        </button>
        {/* Mode tabs */}
        {enabledModes.length > 1 && (
          <div className="flex gap-2 bg-white/10 rounded-xl p-1">
            {enabledModes.map(m => {
              const Icon = m.icon;
              return (
                <button key={m.key} onClick={() => setMode(m.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    mode === m.key ? 'bg-white text-gray-900 shadow-md' : 'text-white/60 hover:text-white'
                  }`}>
                  <Icon size={16} /> {m.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 pb-8">
        {mode === 'code' && <KioskNumpad />}
        {mode === 'camera' && <KioskCamera />}
        {mode === 'qr' && <KioskQrScanner />}
      </div>
    </div>
  );
}
