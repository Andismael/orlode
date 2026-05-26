/**
 * MarketplaceUserMenu — top-right user dropdown for Talents and Influenceurs.
 * When signed-in: avatar + dropdown with Mon profil / Mes liens (influ only)
 * / Messages / Voir le profil public / Se déconnecter.
 * When signed-out: small "Se connecter" + "S'inscrire" buttons.
 *
 * Auto-loads the user's profileId for the product so the "Voir profil public"
 * link can deep-link to /talents/:id or /influenceurs/:id.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, limit as fbLimit } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import {
  ChevronDown, User, Link2, MessageCircle, Eye, LogOut, LogIn, ExternalLink,
} from 'lucide-react';

interface Props {
  product: 'talents' | 'influencers';
  /** Overall theme: 'dark' (transparent on dark hero) or 'cream' (over cream bg). */
  variant: 'dark' | 'cream';
  brandColor: string;
  brandDeepColor?: string;
}

export default function MarketplaceUserMenu({
  product, variant, brandColor, brandDeepColor,
}: Props) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState<string>('');
  const ref = useRef<HTMLDivElement>(null);

  const productLabel = product === 'talents' ? 'Talents' : 'Influenceurs';
  const productRoot = product === 'talents' ? '/talents' : '/influenceurs';
  const profileCol = product === 'talents' ? 'talents_profiles' : 'influencers_profiles';

  useEffect(() => {
    if (!user) { setProfileId(null); setPhotoURL(''); return; }
    void (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, profileCol),
          where('userId', '==', user.uid),
          fbLimit(1),
        ));
        if (snap.empty) return;
        const d = snap.docs[0]!;
        setProfileId(d.id);
        const raw = d.data() as Record<string, unknown>;
        setPhotoURL((raw['photoURL'] as string) ?? '');
      } catch { /* ignore */ }
    })();
  }, [user, profileCol]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setOpen(false);
      navigate(productRoot);
    } catch { /* ignore */ }
  };

  const onDark = variant === 'dark';
  const fg = onDark ? '#FAF7F2' : '#0A1410';
  const subtle = onDark ? 'rgba(255,255,255,0.65)' : '#5C6B62';
  const ghostBg = onDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  const ghostBorder = onDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';

  // Signed-out: 2 small buttons
  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to="/login" style={{
          background: 'transparent', color: fg,
          padding: '8px 14px', borderRadius: 100,
          fontSize: 13, fontWeight: 600,
          textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <LogIn size={13} /> Se connecter
        </Link>
        <Link to={`${productRoot}/inscription`} style={{
          background: onDark ? '#FAF7F2' : `linear-gradient(135deg, ${brandColor}, ${brandDeepColor ?? brandColor})`,
          color: onDark ? '#0A1410' : '#FFFFFF',
          padding: '8px 16px', borderRadius: 100,
          fontSize: 13, fontWeight: 700,
          textDecoration: 'none',
          boxShadow: onDark ? 'none' : `0 6px 18px -6px ${brandColor}80`,
        }}>
          S'inscrire
        </Link>
      </div>
    );
  }

  const displayName = user.displayName ?? user.email ?? 'Profil';
  const initial = (displayName.charAt(0) || '?').toUpperCase();

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          background: ghostBg,
          border: `1px solid ${ghostBorder}`,
          backdropFilter: onDark ? 'blur(20px)' : 'none',
          color: fg,
          padding: '6px 12px 6px 6px',
          borderRadius: 100,
          fontSize: 13, fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: photoURL
            ? `url(${photoURL}) center/cover`
            : `linear-gradient(135deg, ${brandColor}, ${brandDeepColor ?? brandColor})`,
          color: '#FFFFFF', fontWeight: 700, fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Fraunces, serif',
          flexShrink: 0,
          border: `1.5px solid ${onDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          {!photoURL && initial}
        </div>
        <span style={{
          maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {displayName.split(' ')[0]}
        </span>
        <ChevronDown size={14} style={{ opacity: 0.75 }} />
      </button>

      {open && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: 240,
          background: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          zIndex: 100,
          animation: 'mumIn 0.18s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <style>{`
            @keyframes mumIn {
              from { opacity: 0; transform: translateY(-6px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '14px 16px',
            background: '#FAF7F2',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#94A39A',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              marginBottom: 2, fontFamily: "'JetBrains Mono', monospace",
            }}>
              Orlode {productLabel}
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700, color: '#0A1410',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {displayName}
            </div>
            {user.email && user.email !== displayName && (
              <div style={{ fontSize: 11, color: subtle, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </div>
            )}
          </div>

          {/* Items */}
          <MenuLink to={`${productRoot}/mon-profil`} onClick={() => setOpen(false)} icon={User} label="Mon profil" />
          {product === 'influencers' && (
            <MenuLink to="/influenceurs/mes-liens" onClick={() => setOpen(false)} icon={Link2} label="Mes liens sociaux" />
          )}
          <MenuLink to={`${productRoot}/inbox`} onClick={() => setOpen(false)} icon={MessageCircle} label="Messages" />

          {profileId && (
            <>
              <Divider />
              <MenuLink to={`${productRoot}/${profileId}`} onClick={() => setOpen(false)} icon={Eye} label="Voir mon profil public" suffix={<ExternalLink size={11} style={{ opacity: 0.5 }} />} />
            </>
          )}

          <Divider />
          <button onClick={handleSignOut} type="button" style={menuItemStyle(false)}>
            <LogOut size={14} style={{ color: '#DC2626' }} />
            <span style={{ color: '#DC2626', fontWeight: 600 }}>Se déconnecter</span>
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  to, onClick, icon: Icon, label, suffix,
}: {
  to: string; onClick: () => void;
  icon: React.ComponentType<{ size?: number }>;
  label: string; suffix?: React.ReactNode;
}) {
  return (
    <Link to={to} onClick={onClick} style={menuItemStyle(true)}>
      <Icon size={14} />
      <span style={{ flex: 1 }}>{label}</span>
      {suffix}
    </Link>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '2px 0' }} />;
}

function menuItemStyle(isLink: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '11px 16px',
    fontSize: 13, fontWeight: 600,
    color: '#1A2A22',
    background: '#FFFFFF',
    border: 'none', textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: isLink ? 'none' : undefined,
    transition: 'background 0.12s',
  };
}
