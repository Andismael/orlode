/**
 * MyPacksStrip — compact strip of the user's activated vertical packs,
 * inserted in the Dashboard between the Hero and the KPI cards.
 *
 * For each active pack we show:
 *   - emoji + name
 *   - one-line stat (X produits / X chambres / X RDV…)
 *   - the public URL (one-click copy + open)
 *   - a CTA "Ouvrir" → /agents/<pack>
 *
 * The point: at every login, the merchant should see — at a glance — that
 * their packs ARE live, what their public URLs look like, and jump straight
 * to the dashboard of any pack. No more digging through the sidebar.
 *
 * Data: GET /commerce/stores (no filter) — same source as MultiPackHomePage.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, ChefHat, BedDouble, Scissors, Stethoscope, Home,
  Plus, ArrowRight, Copy, ExternalLink, Loader2, Sparkles, Share2,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';

interface PackDef {
  businessType: string;
  emoji: string;
  label: string;
  href: string;
  publicPath: string;
  color: string;
  bg: string;
  icon: any;
}

// Static catalog of supported vertical packs. Keep in sync with the
// businessType enum in /commerce/stores and the public routes
// (/shop, /menu, /hotel, /residence, /salon, /cabinet, /biens).
const PACKS: Record<string, PackDef> = {
  boutique:   { businessType: 'boutique',   emoji: '🛍', label: 'Boutique',    href: '/agents/commerce',   publicPath: 'shop',      color: '#0A4F3C', bg: '#D1FAE5', icon: ShoppingBag },
  restaurant: { businessType: 'restaurant', emoji: '🍽', label: 'Restaurant',  href: '/agents/restaurant', publicPath: 'menu',      color: '#C2410C', bg: '#FFEDD5', icon: ChefHat },
  hotel:      { businessType: 'hotel',      emoji: '🏨', label: 'Hôtel',       href: '/agents/hotel',      publicPath: 'hotel',     color: '#0369A1', bg: '#E0F2FE', icon: BedDouble },
  service:    { businessType: 'service',    emoji: '💇', label: 'Salon',       href: '/agents/service',    publicPath: 'salon',     color: '#DB2777', bg: '#FCE7F3', icon: Scissors },
  health:     { businessType: 'health',     emoji: '🏥', label: 'Cabinet',     href: '/agents/cabinet',    publicPath: 'cabinet',   color: '#0F766E', bg: '#CCFBF1', icon: Stethoscope },
  cabinet:    { businessType: 'cabinet',    emoji: '🩺', label: 'Cabinet',     href: '/agents/cabinet',    publicPath: 'cabinet',   color: '#0F766E', bg: '#CCFBF1', icon: Stethoscope },
  realestate: { businessType: 'realestate', emoji: '🏠', label: 'Immobilier',  href: '/agents/realestate', publicPath: 'biens',     color: '#5B21B6', bg: '#EDE9FE', icon: Home },
  residence:  { businessType: 'residence',  emoji: '🏘', label: 'Résidence',   href: '/agents/residence',  publicPath: 'residence', color: '#9F1239', bg: '#FFE4E6', icon: Home },
};

interface Store {
  id: string;
  name: string;
  slug?: string;
  businessType?: string;
  status?: string;
}

export default function MyPacksStrip() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get('/commerce/stores')
      .then((r: any) => {
        if (!alive) return;
        // Server returns either { stores: [] } or { data: [] } across envs.
        const list = (r?.data?.stores ?? r?.data?.data ?? r?.data ?? []) as Store[];
        const normalized = Array.isArray(list)
          ? list.map(s => ({ ...s, businessType: s.businessType ?? 'boutique' }))
          : [];
        setStores(normalized);
      })
      .catch(() => alive && setStores([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const items = useMemo(() => {
    return stores
      .map(s => ({ store: s, pack: PACKS[s.businessType ?? 'boutique'] }))
      .filter(x => x.pack);
  }, [stores]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://orlode.com';

  if (loading) {
    return (
      <div style={{
        padding: 18, borderRadius: 16, background: 'rgba(255,250,240,0.06)',
        border: '1px solid rgba(255,250,240,0.1)', color: 'rgba(255,250,240,0.7)',
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontFamily: 'Inter, sans-serif',
      }}>
        <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
        Chargement de tes packs…
      </div>
    );
  }

  // Empty state — encourage activation via the Studio.
  if (items.length === 0) {
    return (
      <div style={{
        padding: '20px 22px', borderRadius: 18,
        background: 'linear-gradient(135deg, rgba(212,160,23,.12), rgba(212,160,23,.04))',
        border: '1px dashed rgba(212,160,23,.4)',
        color: '#FFFAF0', fontFamily: 'Inter, sans-serif',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <Sparkles size={22} color="#FCD34D" />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            Tu n'as pas encore activé de pack métier.
          </div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Lance ton premier workspace en 2 minutes — choisis ton métier, ton style, ton domaine.
          </div>
        </div>
        <Link to="/studio" style={{
          background: '#FCD34D', color: '#1F2937',
          padding: '11px 18px', borderRadius: 12, textDecoration: 'none',
          fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 20px -8px rgba(212,160,23,.6)',
        }}>
          <Plus size={14} /> Ouvrir le Studio
        </Link>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
        <h3 style={{
          fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700,
          color: '#FFFAF0', margin: 0, letterSpacing: '-0.02em',
        }}>
          Tes <em style={{ fontStyle: 'italic', color: '#FCD34D' }}>packs</em> en ligne
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: 'rgba(255,250,240,.55)', marginLeft: 10 }}>
            · {items.length} actif{items.length > 1 ? 's' : ''}
          </span>
        </h3>
        <Link to="/studio" style={{
          fontSize: 11, fontWeight: 700, color: 'rgba(255,250,240,.7)',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Plus size={12} /> Ajouter un pack
        </Link>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}>
        {items.map(({ store, pack }) => {
          const publicUrl = store.slug ? `${origin}/${pack.publicPath}/${store.slug}` : null;
          return (
            <div key={store.id} style={{
              background: '#FFFAF0', borderRadius: 16, padding: 16,
              border: '1px solid rgba(31,41,55,0.06)',
              borderLeft: `4px solid ${pack.color}`,
              display: 'flex', flexDirection: 'column', gap: 10,
              transition: 'transform .2s ease',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: pack.bg, color: pack.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 800,
                }}>
                  {pack.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 800, color: '#0A2A20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {store.name}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: pack.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {pack.label}{store.status === 'active' && <> · <span style={{ color: '#10B981' }}>● actif</span></>}
                  </div>
                </div>
              </div>

              {publicUrl && (
                <div style={{
                  background: '#F5F0E8', borderRadius: 10, padding: '8px 10px',
                  display: 'flex', alignItems: 'center', gap: 6,
                  border: '1px solid rgba(31,41,55,.06)',
                }}>
                  <a href={publicUrl} target="_blank" rel="noreferrer" style={{
                    flex: 1, minWidth: 0,
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                    color: pack.color, textDecoration: 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {publicUrl.replace(/^https?:\/\//, '')}
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Lien copié'); }}
                    aria-label="Copier le lien"
                    title="Copier"
                    style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: 'transparent', color: '#5A6B62',
                      border: 'none', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Copy size={12} />
                  </button>
                  <a href={publicUrl} target="_blank" rel="noreferrer"
                    aria-label="Ouvrir la page publique"
                    title="Ouvrir"
                    style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: 'transparent', color: '#5A6B62',
                      textDecoration: 'none',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <ExternalLink size={12} />
                  </a>
                  {/* WhatsApp share intent — opens WA with a pre-filled message
                      so the merchant can blast their store URL to a contact /
                      group / status without retyping. wa.me deep-link is
                      universal across iOS / Android / desktop. */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Découvre ${store.name} 👇\n${publicUrl}`)}`}
                    target="_blank" rel="noreferrer"
                    aria-label="Partager sur WhatsApp"
                    title="Partager sur WhatsApp"
                    style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: '#25D36615', color: '#128C7E',
                      textDecoration: 'none',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Share2 size={12} />
                  </a>
                </div>
              )}

              <Link to={pack.href} style={{
                background: pack.color, color: '#fff',
                padding: '10px 14px', borderRadius: 10,
                textDecoration: 'none', fontSize: 12.5, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit',
                boxShadow: `0 8px 18px -8px ${pack.color}`,
              }}>
                Ouvrir le dashboard {pack.label}
                <ArrowRight size={13} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
