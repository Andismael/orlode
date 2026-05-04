/**
 * ChatSceneBackground — cosmic green aurora theme with branded watermark.
 * Used as fixed background for chat pages (Clone, Agents, Widget).
 * Watermark auto-picks company name + logo from authStore.
 */
import { useAuthStore } from '@/store/authStore';

interface Props {
  /** Optional override for watermark (used when rendering for a different company) */
  companyName?: string;
  companyLogoUrl?: string;
  slogan?: string;
  /** Hide watermark if not desired */
  noWatermark?: boolean;
}

export default function ChatSceneBackground({ companyName, companyLogoUrl, slogan, noWatermark = false }: Props) {
  const { company } = useAuthStore();
  const name = companyName ?? (company?.name as string) ?? 'ORLODE';
  const logoUrl = companyLogoUrl ?? (company as unknown as { logoUrl?: string })?.logoUrl ?? '';
  const tagline = slogan ?? ((company as unknown as { slogan?: string })?.slogan ?? 'THE MIND YOUR BUSINESS DESERVES');
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'CM';

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base gradient — deep green */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #2d5a3d 0%, #1f4530 30%, #15352a 60%, #0d2520 100%)' }} />

      {/* SVG pattern overlay — drifting icons */}
      <div className="absolute inset-0 scene-pattern-drift opacity-80" />

      {/* Aurora blurs */}
      <div className="scene-aurora scene-aurora-1" />
      <div className="scene-aurora scene-aurora-2" />
      <div className="scene-aurora scene-aurora-3" />

      {/* Watermark (personnalisable par entreprise) */}
      {!noWatermark && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 opacity-[0.18] select-none">
          <div className="w-40 h-40 rounded-full border-[3px] border-white flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-5xl font-semibold tracking-wider">{initials}</span>
            )}
          </div>
          <div className="text-white text-3xl font-medium" style={{ letterSpacing: '10px' }}>{name.toUpperCase()}</div>
          <div className="text-white text-xs opacity-85 mt-0" style={{ letterSpacing: '4px' }}>{tagline}</div>
        </div>
      )}
    </div>
  );
}
