/**
 * VoiceAssistantFAB — Floating voice assistant button for any pack.
 * Click → opens a modal panel with Gemini Live chat scoped to the pack's context.
 *
 * Usage:
 *   <VoiceAssistantFAB
 *     systemInstruction="Tu es l'assistant de l'hôtel X. Aide à gérer les chambres."
 *     accentColor="#7C2D12"
 *     label="Assistant cuisine"
 *   />
 */
import { useState } from 'react';
import { Mic, X, Sparkles } from 'lucide-react';
import GeminiLiveChat from './GeminiLiveChat';

interface Props {
  systemInstruction: string;
  accentColor?: string;
  accentDeep?: string;
  label?: string;
  language?: string;
  voiceName?: string;
}

export default function VoiceAssistantFAB({
  systemInstruction,
  accentColor = '#7C3AED',
  accentDeep = '#5B21B6',
  label = 'Assistant vocal',
  language = 'fr',
  voiceName = 'Kore',
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}
        title={label}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 90,
          width: 56, height: 56, borderRadius: '50%',
          background: `linear-gradient(135deg, ${accentColor}, ${accentDeep})`,
          color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: `0 10px 30px -8px ${accentColor}, 0 4px 12px -4px rgba(0,0,0,.2)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform .2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}>
        <Mic size={22} />
        <span style={{
          position: 'absolute', top: -2, right: -2,
          width: 14, height: 14, borderRadius: '50%',
          background: '#10B981', border: '2px solid #fff',
        }}></span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 100, padding: 16,
          background: 'rgba(10,42,32,.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#FFFAF0', borderRadius: 22, maxWidth: 540, width: '100%',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 30px 80px -20px rgba(10,42,32,.5)',
            overflow: 'hidden',
          }}>
            <div style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentDeep})`,
              color: '#fff', padding: '18px 22px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: 'rgba(255,255,255,.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', opacity: .85, fontFamily: 'JetBrains Mono, monospace' }}>
                  GEMINI LIVE
                </div>
                <h3 style={{
                  fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 800,
                  margin: 0, letterSpacing: '-.02em',
                }}>{label}</h3>
              </div>
              <button onClick={() => setOpen(false)} style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'rgba(255,255,255,.18)', color: '#fff',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
              <GeminiLiveChat
                systemInstruction={systemInstruction}
                language={language}
                voiceName={voiceName}
                showTextInput
                showCamera={false}
                theme="light"
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
