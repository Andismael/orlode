/**
 * QuickWins — Dashboard onboarding nudge card.
 *
 * Reads the user's first store + WhatsApp/Telegram status and presents the
 * next 1-4 actions to make their setup "production-ready". Each step links
 * to the right page. When everything is done, shows a compact "tout est OK"
 * celebration with a Share CTA.
 *
 * Why: a new user finishes the Studio with 0 products, 0 messages, no pubic
 * polish. They land on the Dashboard and don't know what to do next. This
 * card removes that guess work — explicit progression: Setup channels →
 * Branding → First content → Share.
 *
 * Data sources (parallel, best-effort, no failure):
 *   GET /commerce/stores           → main store + slug + business type
 *   GET /whatsapp/status            → wa connected?
 *   GET /telegram/status            → tg connected?
 *   GET /commerce/stores/:id/products → has any content?
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, MessageCircle, Send, Image as ImageIcon, Sparkles, Package,
  Share2, ArrowRight, CheckCircle2, Camera,
} from 'lucide-react';
import api from '@/services/api';

const C = {
  gold:    '#D4A017',
  goldDeep:'#B8860B',
  goldSoft:'#FEF3C7',
  sage:    '#86C5A0',
  sageDeep:'#5BA47C',
  sageSoft:'#D4F1DF',
  wa:      '#25D366',
  tg:      '#0088CC',
  ink:     '#0A2A20',
  inkSoft: '#5A6B62',
  inkLight:'#94A3A0',
  cream:   '#FFFAF0',
  creamDeep:'#F5F0E8',
};

// Map businessType → public path (mirror of the routing config).
const PUBLIC_PATH: Record<string, string> = {
  boutique: 'shop', restaurant: 'menu', hotel: 'hotel',
  residence: 'residence', service: 'salon', cabinet: 'cabinet',
  health: 'cabinet', realestate: 'biens',
};

interface Step {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  done: boolean;
  /** Where the CTA points — internal Link or external. */
  to: string;
  /** Used when calling external WA share intent. */
  external?: boolean;
  /** Highlight color (for the icon background). */
  color: string;
}

interface Store {
  id: string;
  name?: string;
  slug?: string;
  businessType?: string;
  logoUrl?: string | null;
  tagline?: string | null;
  shortDescription?: string | null;
  openingHours?: string | null;
  contactEmail?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
}

export default function QuickWins() {
  const [store, setStore] = useState<Store | null>(null);
  const [waConnected, setWaConnected] = useState(false);
  const [tgConnected, setTgConnected] = useState(false);
  const [hasProducts, setHasProducts] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const storesRes: any = await api.get('/commerce/stores').catch(() => null);
        const list = storesRes?.data?.stores ?? storesRes?.data?.data ?? storesRes?.data ?? [];
        const main: Store | null = Array.isArray(list) && list[0] ? list[0] : null;
        if (!alive) return;
        setStore(main);

        const [waRes, tgRes, prodRes] = await Promise.all([
          api.get('/whatsapp/status').catch(() => null),
          api.get('/telegram/status').catch(() => null),
          main ? api.get(`/commerce/stores/${main.id}/products`).catch(() => null) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setWaConnected(Boolean((waRes?.data?.data ?? waRes?.data)?.connected));
        setTgConnected(Boolean((tgRes?.data?.data ?? tgRes?.data)?.connected));
        const products = prodRes?.data?.products ?? prodRes?.data?.data ?? prodRes?.data ?? [];
        setHasProducts(Array.isArray(products) && products.length > 0);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const publicUrl = useMemo(() => {
    if (!store?.slug) return null;
    const path = PUBLIC_PATH[store.businessType ?? 'boutique'] ?? 'shop';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://orlode.com';
    return `${origin}/${path}/${store.slug}`;
  }, [store]);

  const steps: Step[] = useMemo(() => {
    if (!store) return [];
    const list: Step[] = [];
    // 1. At least one messaging channel connected.
    list.push({
      key: 'channels',
      label: 'Connecter WhatsApp ou Telegram',
      hint: 'Pour recevoir tes premiers messages clients.',
      icon: <MessageCircle size={16} />,
      done: waConnected || tgConnected,
      to: waConnected ? '/admin/telegram' : '/admin/whatsapp',
      color: waConnected ? C.tg : C.wa,
    });
    // 2. Branding complete (logo + tagline + shortDescription).
    const brandingDone = Boolean(store.logoUrl) && Boolean(store.tagline) && Boolean(store.shortDescription);
    list.push({
      key: 'branding',
      label: 'Soigner ta page publique',
      hint: 'Logo, slogan, description — visibles par tes clients.',
      icon: <Camera size={16} />,
      done: brandingDone,
      to: `/agents/${suggestPackPath(store.businessType)}`,
      color: C.gold,
    });
    // 3. Has at least one product / room / service (content).
    list.push({
      key: 'content',
      label: 'Ajouter ton premier produit ou service',
      hint: 'Sans catalogue, tes clients ne peuvent rien commander.',
      icon: <Package size={16} />,
      done: hasProducts,
      to: `/agents/${suggestPackPath(store.businessType)}`,
      color: C.sage,
    });
    // 4. At least one social / contact link filled.
    const socialsDone = Boolean(store.instagramUrl || store.facebookUrl || store.contactEmail || store.openingHours);
    list.push({
      key: 'socials',
      label: 'Ajouter tes infos de contact',
      hint: 'Horaires, email, Instagram — pour rassurer le client.',
      icon: <Share2 size={16} />,
      done: socialsDone,
      to: `/agents/${suggestPackPath(store.businessType)}`,
      color: '#7C3AED',
    });
    return list;
  }, [store, waConnected, tgConnected, hasProducts]);

  const completedCount = steps.filter(s => s.done).length;
  const totalCount = steps.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  // If user has no store yet, the MyPacksStrip already handles the empty
  // case with a "Open Studio" CTA — no need to duplicate.
  if (loading || !store) return null;

  // All steps done → compact celebration + share CTA, then hide on next refresh.
  if (allDone) {
    return (
      <div style={{
        background: `linear-gradient(135deg, ${C.sageSoft}, ${C.creamDeep})`,
        border: `1px solid ${C.sage}40`,
        borderRadius: 16, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: C.sage, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <CheckCircle2 size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 800, color: C.ink }}>
            Bravo, ton workspace est <em style={{ fontStyle: 'italic', color: C.sageDeep }}>prêt</em> 🎉
          </div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
            Maintenant, partage ton URL publique à 5 clients pour mesurer la traction.
          </div>
        </div>
        {publicUrl && (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Découvre ${store.name ?? 'mon nouveau site'} 👇\n${publicUrl}`)}`}
            target="_blank" rel="noreferrer"
            style={{
              background: C.wa, color: '#fff',
              padding: '10px 16px', borderRadius: 10, textDecoration: 'none',
              fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <Share2 size={13} /> Partager sur WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background: C.cream, border: '1px solid rgba(31,41,55,0.06)',
      borderRadius: 18, padding: 18, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 800,
            color: C.goldDeep, letterSpacing: '0.08em', marginBottom: 2,
          }}>
            <Sparkles size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
            CHECKLIST DE LANCEMENT
          </div>
          <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 17, fontWeight: 800, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
            Encore <em style={{ fontStyle: 'italic', color: C.goldDeep }}>{totalCount - completedCount} étape{(totalCount - completedCount) > 1 ? 's' : ''}</em> avant que ta vitrine soit parfaite
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 110, height: 6, background: C.creamDeep, borderRadius: 100, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: `linear-gradient(90deg, ${C.gold}, ${C.sage})`,
              transition: 'width .5s ease',
            }} />
          </div>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: C.ink }}>
            {pct}%
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map(step => (
          <Link
            key={step.key}
            to={step.to}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 11,
              background: step.done ? C.sageSoft : C.creamDeep,
              border: `1px solid ${step.done ? C.sage + '40' : 'rgba(31,41,55,.06)'}`,
              textDecoration: 'none',
              opacity: step.done ? 0.7 : 1,
              transition: 'transform .15s ease',
            }}
            onMouseEnter={e => !step.done && (e.currentTarget.style.transform = 'translateX(2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateX(0)')}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: step.done ? C.sage : step.color + '20',
              color: step.done ? '#fff' : step.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {step.done ? <Check size={16} strokeWidth={3} /> : step.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: C.ink,
                textDecoration: step.done ? 'line-through' : 'none',
              }}>
                {step.label}
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 1 }}>
                {step.hint}
              </div>
            </div>
            {!step.done && (
              <ArrowRight size={14} color={C.inkLight} style={{ flexShrink: 0 }} />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// Match the merchant's businessType to its admin URL.
function suggestPackPath(bt?: string): string {
  const map: Record<string, string> = {
    boutique: 'commerce', restaurant: 'restaurant', hotel: 'hotel',
    residence: 'residence', service: 'service', cabinet: 'cabinet',
    health: 'cabinet', realestate: 'realestate',
  };
  return map[bt ?? 'boutique'] ?? 'commerce';
}
