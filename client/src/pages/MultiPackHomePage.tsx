/**
 * Multi-Pack Home — auto-detect des packs activés.
 *
 * Affiche une card par pack métier activé (resto, hôtel, boutique, etc.) +
 * suggestions de packs à découvrir. Quand l'utilisateur a 2+ verticales
 * activées, c'est sa page d'accueil pour switcher rapidement.
 *
 * Data : GET /commerce/stores (no filter) → groupé par businessType.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import {
  ShoppingBag, ChefHat, BedDouble, Scissors, Stethoscope, Home,
  Briefcase, Building2, Plus, ArrowRight, Loader2, Sparkles,
  Package, Calendar, Users,
} from 'lucide-react';

const C = {
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  greenDeep:   '#0A4F3C',
};

interface Pack {
  id: string;
  businessType: string;
  emoji: string;
  label: string;
  pitch: string;
  href: string;
  color: string;
  bg: string;
  icon: any;
}

const VERTICAL_PACKS: Pack[] = [
  { id: 'boutique',   businessType: 'boutique',   emoji: '🛍', label: 'Boutique',    pitch: 'Vends sur WhatsApp avec une photo.',          href: '/agents/commerce',   color: '#0A4F3C', bg: '#D1FAE5', icon: ShoppingBag },
  { id: 'restaurant', businessType: 'restaurant', emoji: '🍽', label: 'Restaurant',  pitch: 'Menu, commandes, réservations.',              href: '/agents/restaurant', color: '#C2410C', bg: '#FFEDD5', icon: ChefHat },
  { id: 'hotel',      businessType: 'hotel',      emoji: '🏨', label: 'Hôtel',       pitch: 'Chambres et séjours.',                        href: '/agents/hotel',      color: '#0369A1', bg: '#E0F2FE', icon: BedDouble },
  { id: 'service',    businessType: 'service',    emoji: '💇', label: 'Salon',       pitch: 'Coiffure, beauté, esthétique — RDV auto.',    href: '/agents/service',    color: '#DB2777', bg: '#FCE7F3', icon: Scissors },
  { id: 'health',     businessType: 'health',     emoji: '🏥', label: 'Cabinet',     pitch: 'Patients et consultations confidentielles.',  href: '/agents/health',     color: '#0F766E', bg: '#CCFBF1', icon: Stethoscope },
  { id: 'realestate', businessType: 'realestate', emoji: '🏠', label: 'Immobilier',  pitch: 'Biens et visites — qualif leads + agenda.',   href: '/agents/realestate', color: '#5B21B6', bg: '#EDE9FE', icon: Home },
  { id: 'residence',  businessType: 'residence',  emoji: '🏘', label: 'Résidences',  pitch: 'Booking/Airbnb-style — N résidences indépendantes.', href: '/agents/residences', color: '#9F1239', bg: '#FFE4E6', icon: Home },
];

const HUB_PACKS: Pack[] = [
  { id: 'pme',        businessType: 'pme',        emoji: '🚀', label: 'PME',         pitch: 'Sales · Comms · Marketing · Support.',        href: '/agents/pme',        color: '#059669', bg: '#D1FAE5', icon: Briefcase },
  { id: 'enterprise', businessType: 'enterprise', emoji: '🏢', label: 'Entreprise',  pitch: 'Sales · Compta · Support · Comms.',           href: '/agents/enterprise', color: '#0E7490', bg: '#CFFAFE', icon: Building2 },
];

interface Store {
  id: string;
  name: string;
  businessType?: string;
  status?: string;
  currency?: string;
}

export default function MultiPackHomePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeStats, setStoreStats] = useState<Record<string, { products: number; reservations: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/commerce/stores')
      .then(async (r: any) => {
        const list = (r?.data?.stores ?? []) as Store[];
        // Default legacy stores without businessType to 'boutique'
        const normalized = list.map(s => ({ ...s, businessType: s.businessType ?? 'boutique' }));
        setStores(normalized);

        // Fetch quick stats per store (parallel, best-effort)
        const stats: Record<string, { products: number; reservations: number }> = {};
        await Promise.all(normalized.map(async (s) => {
          try {
            const [p, r2] = await Promise.all([
              api.get(`/commerce/stores/${s.id}/products`).catch(() => ({ data: { products: [] } })),
              api.get(`/commerce/stores/${s.id}/reservations`).catch(() => ({ data: { reservations: [] } })),
            ]);
            stats[s.id] = {
              products: ((p as any)?.data?.products ?? []).length,
              reservations: ((r2 as any)?.data?.reservations ?? []).length,
            };
          } catch { stats[s.id] = { products: 0, reservations: 0 }; }
        }));
        setStoreStats(stats);
      })
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  // Group stores by businessType
  const activatedTypes = new Set(stores.map(s => s.businessType ?? 'boutique'));
  const activatedPacks = VERTICAL_PACKS.filter(p => activatedTypes.has(p.businessType));
  const availablePacks = VERTICAL_PACKS.filter(p => !activatedTypes.has(p.businessType));

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.creamDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin" color={C.greenDeep} />
        <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} } .spin { animation: spin .9s linear infinite; }`}</style>
      </div>
    );
  }

  // Empty state — no pack activated yet
  if (stores.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: C.creamDeep, padding: '64px 24px', fontFamily: "'Inter', sans-serif", color: C.ink }}>
        <style>{INLINE_STYLES}</style>
        <div style={{ maxWidth: 920, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 80, height: 80, borderRadius: 24,
            background: `linear-gradient(135deg, ${C.greenDeep}, #064E3B)`,
            color: '#fff', fontSize: 36, marginBottom: 22,
            boxShadow: `0 20px 40px -16px ${C.greenDeep}66`,
          }}>
            🚀
          </div>
          <h1 className="display-font" style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
            Bienvenue sur <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.greenDeep }}>Orlode</em>
          </h1>
          <p style={{ fontSize: 15, color: C.inkSoft, marginTop: 12, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            Active ton premier pack métier pour démarrer. Tu pourras en activer plusieurs en parallèle si tu gères différents business.
          </p>
          <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, textAlign: 'left' }}>
            {VERTICAL_PACKS.map(p => <PackCard key={p.id} pack={p} stats={null} variant="discover" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.creamDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{INLINE_STYLES}</style>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.greenDeep} 0%, #064E3B 100%)`,
        padding: '40px 32px 32px', color: C.cream, position: 'relative', overflow: 'hidden',
      }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.15 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60"  stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 100,
            background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            <Sparkles size={11} /> CENTRE DE COMMANDE
          </div>
          <h1 className="display-font" style={{ fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 800, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Tes <em style={{ fontStyle: 'italic', fontWeight: 500 }}>{activatedPacks.length} pack{activatedPacks.length > 1 ? 's' : ''}</em> actif{activatedPacks.length > 1 ? 's' : ''}
          </h1>
          <p style={{ marginTop: 10, fontSize: 13, opacity: 0.92, maxWidth: 640 }}>
            Chaque pack a son propre univers : produits, clients, agenda. Tu switches en un clic.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 64px' }}>
        {/* Activated packs */}
        <section style={{ marginBottom: 44 }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.greenDeep }}>Mes packs</em> actifs
              </h2>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
                Cliquez pour ouvrir le pack.
              </p>
            </div>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {activatedPacks.map(p => {
              const store = stores.find(s => (s.businessType ?? 'boutique') === p.businessType);
              const stats = store ? storeStats[store.id] : null;
              return <PackCard key={p.id} pack={p} stats={stats} store={store} variant="active" />;
            })}
          </div>
        </section>

        {/* Hub packs (PME / Entreprise) */}
        <section style={{ marginBottom: 44 }}>
          <header style={{ marginBottom: 14 }}>
            <h2 className="display-font" style={{ fontSize: 18, fontWeight: 800, margin: 0, color: C.ink }}>
              Hubs <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.inkSoft }}>multi-modules</em>
            </h2>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
              Vue d'ensemble cross-cutting (Sales, Comms, Compta, Marketing, Support).
            </p>
          </header>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {HUB_PACKS.map(p => <PackCard key={p.id} pack={p} stats={null} variant="hub" />)}
          </div>
        </section>

        {/* Available packs */}
        {availablePacks.length > 0 && (
          <section>
            <header style={{ marginBottom: 14 }}>
              <h2 className="display-font" style={{ fontSize: 18, fontWeight: 800, margin: 0, color: C.ink }}>
                Découvrir <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.inkSoft }}>d'autres packs</em>
              </h2>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
                Active un pack supplémentaire si tu gères d'autres business.
              </p>
            </header>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {availablePacks.map(p => <PackCard key={p.id} pack={p} stats={null} variant="discover" />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function PackCard({ pack, stats, store, variant }: {
  pack: Pack;
  stats: { products: number; reservations: number } | null;
  store?: Store;
  variant: 'active' | 'hub' | 'discover';
}) {
  const isActive = variant === 'active';
  const isDiscover = variant === 'discover';
  const isHub = variant === 'hub';

  return (
    <Link to={pack.href} className="pack-card" style={{
      background: C.cream, borderRadius: 16,
      padding: isDiscover ? 18 : 22,
      border: `1.5px solid ${isActive ? pack.color + '30' : C.ink + '08'}`,
      textDecoration: 'none', color: 'inherit',
      display: 'flex', flexDirection: 'column',
      transition: 'transform .25s ease, box-shadow .25s ease, border-color .25s ease',
      ['--pack-color' as any]: pack.color,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: isDiscover ? 40 : 48, height: isDiscover ? 40 : 48,
          borderRadius: 12,
          background: pack.bg, color: pack.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isDiscover ? 20 : 22,
          boxShadow: isActive ? `0 8px 18px -8px ${pack.color}50` : 'none',
        }}>
          {pack.emoji}
        </div>
        <div className="pack-arrow" style={{
          width: 30, height: 30, borderRadius: 8,
          background: isActive ? `${pack.color}15` : C.creamDeep,
          color: isActive ? pack.color : C.inkSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s ease',
        }}>
          {isActive ? <ArrowRight size={14} /> : <Plus size={14} />}
        </div>
      </div>
      <h3 className="display-font" style={{
        fontSize: isDiscover ? 16 : 18, fontWeight: 800, color: C.ink,
        margin: '0 0 4px', letterSpacing: '-0.01em',
      }}>
        {pack.label}
        {isActive && (
          <span style={{
            marginLeft: 8, fontSize: 9, fontWeight: 800,
            padding: '2px 8px', borderRadius: 100,
            background: `${pack.color}15`, color: pack.color,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            verticalAlign: 'middle',
          }}>● Actif</span>
        )}
        {isHub && (
          <span style={{
            marginLeft: 8, fontSize: 9, fontWeight: 800,
            padding: '2px 8px', borderRadius: 100,
            background: `${pack.color}10`, color: pack.color,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            verticalAlign: 'middle',
          }}>HUB</span>
        )}
      </h3>
      <p style={{
        fontSize: 12, color: C.inkSoft, margin: 0, lineHeight: 1.5, flex: 1,
      }}>
        {pack.pitch}
      </p>

      {/* Active store stats */}
      {isActive && store && stats && (
        <div style={{
          display: 'flex', gap: 14, paddingTop: 12, marginTop: 12,
          borderTop: `1px solid ${C.ink}08`,
        }}>
          <Stat icon={Package} label="Items" value={stats.products} color={pack.color} />
          <Stat icon={Calendar} label="Réservations" value={stats.reservations} color={pack.color} />
        </div>
      )}

      {/* Discover CTA */}
      {isDiscover && (
        <div style={{
          marginTop: 12, paddingTop: 10,
          borderTop: `1px solid ${C.ink}08`,
          fontSize: 11, fontWeight: 700, color: pack.color,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          + ACTIVER · $20/mo
        </div>
      )}
    </Link>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <Icon size={11} color={C.inkLight} />
        <span style={{ fontSize: 9, color: C.inkLight, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div className="display-font" style={{ fontSize: 18, fontWeight: 800, color }}>
        {value}
      </div>
    </div>
  );
}

const INLINE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
  .pack-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px -16px var(--pack-color, rgba(10,42,32,0.15));
    border-color: var(--pack-color) !important;
  }
  .pack-card:hover .pack-arrow {
    transform: translateX(3px);
  }
`;
