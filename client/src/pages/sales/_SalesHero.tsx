/**
 * Reusable orange hero header for sales pages
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

const C = { greenDeep: '#0A4F3C', cream: '#FFFAF0' };

interface SalesHeroProps {
  title: string;
  italic?: string;
  subtitle?: ReactNode;
  pills?: ReactNode;
  actions?: ReactNode;
  showBack?: boolean;
}

export default function SalesHero({ title, italic, subtitle, pills, actions, showBack = true }: SalesHeroProps) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .sh-hero{background:linear-gradient(135deg,#FF6B1A 0%,#E5530C 100%);border-radius:24px;padding:32px 36px;position:relative;overflow:hidden;color:${C.cream};box-shadow:0 30px 60px -20px rgba(255,107,26,.4)}
        .sh-grain::before{content:'';position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");opacity:.06;pointer-events:none;mix-blend-mode:overlay;border-radius:inherit}
        .sh-display{font-family:'Fraunces',serif;font-optical-sizing:auto;letter-spacing:-.02em}
        .sh-back-btn{background:rgba(255,250,240,.15);border:1px solid rgba(255,250,240,.25);color:${C.cream};padding:8px;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none}
        .sh-back-btn:hover{background:rgba(255,250,240,.25)}
        @media(max-width:700px){.sh-hero{padding:24px}.sh-hero h1{font-size:32px !important}}
      `}</style>
      <div className="sh-hero sh-grain">
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="280" height="280" viewBox="0 0 280 280">
          <circle cx="140" cy="140" r="120" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="80" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="40" stroke={C.greenDeep} strokeWidth="2" fill="none" />
          <circle cx="140" cy="140" r="14" fill={C.greenDeep} />
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              {showBack && <Link to="/sales" className="sh-back-btn"><ArrowLeft size={16} /></Link>}
              {pills}
            </div>
            <h1 className="sh-display" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, margin: 0, color: C.cream, letterSpacing: '-.03em' }}>
              {title} {italic && <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.greenDeep }}>{italic}</em>}
            </h1>
            {subtitle && <div style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,.85)', maxWidth: 540 }}>{subtitle}</div>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      </div>
    </>
  );
}
