import { Sparkles } from 'lucide-react';
import { useCloneWidgetStore } from '@/store/cloneWidgetStore';
import { useAuthStore } from '@/store/authStore';

/**
 * CloneTrigger — Header icon that opens the Clone widget.
 * Sits next to NotificationBell in the top app Header.
 */
export default function CloneTrigger() {
  const { open, toggle } = useCloneWidgetStore();
  const { user } = useAuthStore();
  if (!user?.companyId) return null;

  return (
    <button
      onClick={toggle}
      title={open ? 'Fermer le clone' : 'Ouvrir le clone'}
      aria-label={open ? 'Fermer le clone' : 'Ouvrir le clone'}
      className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105"
      style={{
        background: open
          ? 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #6366f1 100%)'
          : 'rgba(255,255,255,0.12)',
        border: open ? '1.5px solid rgba(252,211,77,0.7)' : '1px solid rgba(255,255,255,0.18)',
        boxShadow: open
          ? '0 0 0 2px rgba(212,160,11,0.3), 0 6px 18px -4px rgba(236,72,153,0.6)'
          : 'none',
      }}
    >
      <Sparkles size={15} color="#fff" strokeWidth={2.2} />
      {/* Tiny status dot */}
      <span
        className="absolute"
        style={{
          bottom: 1, right: 1,
          width: 8, height: 8, borderRadius: '50%',
          background: '#22c55e',
          border: '1.5px solid #1d4ed8',
          boxShadow: '0 0 6px #22c55e',
        }}
      />
    </button>
  );
}
