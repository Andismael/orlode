import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Bot, Shield, Globe, Zap, Smartphone } from 'lucide-react';
import { LoginScene } from '@/components/3d/SceneBackgrounds';

const FEATURES = [
  { icon: Bot,        text: '19 agents IA spécialisés' },
  { icon: Shield,     text: 'BYOE — vos données restent chez vous' },
  { icon: Globe,      text: '20+ langues, dont les langues africaines' },
  { icon: Zap,        text: 'Déploiement en 10 minutes' },
  { icon: Smartphone, text: 'WhatsApp, Vidéo AI, Réseaux Sociaux' },
];

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex">
      {/* ── Panneau gauche — Branding ─────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0019FF 0%, #0050FF 60%, #0092FF 100%)' }}
      >
        {/* 3D Morphing Sphere background */}
        <Suspense fallback={null}>
          <LoginScene />
        </Suspense>

        {/* Contenu */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <img src="/logo.png" alt="Orlode AI" className="w-10 h-10 rounded-xl shadow-lg" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
            <span className="text-white text-xl font-bold tracking-tight">Orlode AI</span>
          </div>

          <h2 className="text-[2.1rem] font-bold text-white leading-tight mb-4">
            L'intelligence artificielle<br />au service de votre<br />entreprise
          </h2>
          <p className="text-white/65 text-[0.95rem] leading-relaxed mb-10">
            Déployez 19 agents IA spécialisés dans votre propre infrastructure. Zéro vendor lock-in, données sous votre contrôle.
          </p>

          <div className="space-y-3.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.15] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                  <Icon size={15} className="text-white" />
                </div>
                <span className="text-white/85 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Badge bas */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2.5 bg-white/[0.14] backdrop-blur-sm rounded-full px-4 py-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white text-sm font-medium">+500 entreprises nous font confiance</span>
          </div>
        </div>
      </div>

      {/* ── Panneau droit — Formulaire ─────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-[420px]">
          {/* Logo mobile uniquement */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: 'linear-gradient(135deg,#0019FF,#0092FF)' }}>
              <Bot size={18} className="text-white" />
            </div>
            <span className="text-gray-900 text-lg font-bold">Orlode AI</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
