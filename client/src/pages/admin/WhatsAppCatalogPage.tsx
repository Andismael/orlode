/**
 * WhatsApp Catalog (Commerce) — list products from Meta Commerce + send single
 * product to a customer as an interactive WhatsApp message.
 *
 * Products are managed on Meta Business Manager (we don't write here yet).
 * V1 scope: read + send. Product CRUD comes later.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  ArrowLeft, ShoppingBag, Send, Search, RefreshCw, X, ExternalLink,
  Tag, Image as ImageIcon, Package,
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  ink: '#0A2A20', inkSoft: '#475467', inkLight: '#94A3A0',
  wa: '#25D366', waDeep: '#128C7E', waSoft: '#DCF8C6',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  red: '#EF4444', redSoft: '#FEE2E2',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  ai: '#F59E0B', aiSoft: '#FEF3C7',
  purple: '#6D28D9', purpleSoft: '#EDE9FE',
};

interface Product {
  id: string;
  retailer_id: string;
  name?: string;
  description?: string;
  price?: string;
  currency?: string;
  availability?: 'in stock' | 'out of stock' | string;
  image_url?: string;
  visibility?: string;
}

interface ProductStats {
  sent: number; replied: number; won: number; revenue: number;
  lastSentAt: number | null;
  score: number;
}

export default function WhatsAppCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Product | null>(null);
  const [stats, setStats] = useState<Record<string, ProductStats>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [pR, sR]: any[] = await Promise.all([
        api.get('/whatsapp/catalog/products'),
        api.get('/whatsapp/catalog/products/stats').catch(() => null),
      ]);
      const data = pR?.data ?? pR?.data?.data;
      setCatalogId(data?.catalogId ?? null);
      setProducts(Array.isArray(data?.products) ? data.products : []);
      const s = sR?.data ?? sR?.data?.data;
      if (s && typeof s === 'object') setStats(s as Record<string, ProductStats>);
    } catch {
      setProducts([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Sort by score descending so the best converters appear first.
  // Products with no data go to the bottom (score 0).
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const sa = stats[a.retailer_id]?.score ?? 0;
      const sb = stats[b.retailer_id]?.score ?? 0;
      if (sa !== sb) return sb - sa;
      const ra = stats[a.retailer_id]?.revenue ?? 0;
      const rb = stats[b.retailer_id]?.revenue ?? 0;
      return rb - ra;
    });
  }, [products, stats]);

  // Identify the top 3 by score for the "Top converter" badges
  const topRetailerIds = useMemo(() => {
    const list = Object.entries(stats)
      .filter(([, s]) => s.score > 0)
      .sort((a, b) => b[1].score - a[1].score)
      .map(([id]) => id);
    return list.slice(0, 3);
  }, [stats]);

  const filtered = useMemo(() => {
    if (!search) return sortedProducts;
    const q = search.toLowerCase();
    return sortedProducts.filter(p => `${p.name ?? ''} ${p.description ?? ''} ${p.retailer_id}`.toLowerCase().includes(q));
  }, [sortedProducts, search]);

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link to="/admin/whatsapp" style={{ color: C.cream, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> WhatsApp
        </Link>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Catalogue <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purpleSoft }}>WhatsApp</em>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.7)', margin: '2px 0 0' }}>
            Vends en conversation — envoie une fiche produit cliquable directement dans WhatsApp.
          </p>
        </div>
        <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          <ExternalLink size={12} /> Gérer sur Meta
        </a>
        <button onClick={load} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          <RefreshCw size={13} /> Rafraîchir
        </button>
      </div>

      {/* Catalog ID badge */}
      {catalogId && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,250,240,0.7)' }}>Catalog ID:</span>
          <span className="mono-font" style={{ fontSize: 11, color: C.cream, background: 'rgba(255,250,240,0.08)', padding: '3px 8px', borderRadius: 6 }}>{catalogId}</span>
          <span style={{ fontSize: 11, color: C.emeraldSoft }}>· {products.length} produit{products.length > 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 14, background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.12)', borderRadius: 100, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360 }}>
        <Search size={12} color="rgba(255,250,240,0.6)" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrer par nom, description, retailer_id…"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: C.cream, fontSize: 12, fontFamily: 'inherit' }}
        />
      </div>

      {loading && (
        <div style={{ background: C.cream, borderRadius: 14, padding: 40, textAlign: 'center', color: C.inkSoft }}>
          Chargement du catalogue…
        </div>
      )}
      {!loading && products.length === 0 && (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.12)' }}>
          <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
            Aucun produit dans le catalogue
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 14px', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            {!catalogId
              ? <>Aucun catalogue Meta Commerce n'est lié à cette entreprise. Crée un catalogue dans Meta Business Suite, ajoute-y des produits, puis reviens ici.</>
              : <>Le catalogue est vide. Ajoute des produits depuis Meta Business Suite (image, prix, description, retailer_id) et ils apparaîtront ici.</>}
          </p>
          <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }}>
            <ExternalLink size={12} /> Ouvrir Meta Commerce
          </a>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filtered.map(p => {
            const inStock = p.availability === 'in stock';
            const rank = topRetailerIds.indexOf(p.retailer_id);
            const topBadge = rank === 0 ? '🥇 Top converter'
                           : rank === 1 ? '🥈 #2 converter'
                           : rank === 2 ? '🥉 #3 converter'
                           : null;
            return (
              <div key={p.id} style={{
                background: C.cream, borderRadius: 14,
                border: rank === 0
                  ? `2px solid ${C.ai}`
                  : `1.5px solid ${inStock ? C.emeraldSoft : C.creamDeep}`,
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: rank === 0 ? `0 12px 28px -10px ${C.ai}40` : 'none',
              }}>
                {p.image_url ? (
                  <div style={{
                    height: 180, background: `url("${p.image_url}") center/cover, ${C.creamDeep}`,
                    position: 'relative',
                  }}>
                    {topBadge && (
                      <div style={{ position: 'absolute', top: 8, left: 8, background: C.ai, color: C.cream, padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 800, boxShadow: '0 4px 12px -2px rgba(0,0,0,0.25)' }}>
                        {topBadge}
                      </div>
                    )}
                    {!inStock && (
                      <div style={{ position: 'absolute', top: 8, right: 8, background: C.red, color: C.cream, padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                        Hors stock
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ height: 180, background: C.creamDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImageIcon size={32} color={C.inkLight} />
                  </div>
                )}
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
                    {p.name ?? p.retailer_id}
                  </div>
                  {p.price && (
                    <div className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.emeraldDeep }}>
                      {p.price}
                    </div>
                  )}
                  {p.description && (
                    <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', flex: 1 }}>
                      {p.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Tag size={10} color={C.inkLight} />
                    <span className="mono-font" style={{ fontSize: 10, color: C.inkLight }}>{p.retailer_id}</span>
                  </div>

                  {/* Stats badges — only show if this product has activity */}
                  {(() => {
                    const s = stats[p.retailer_id];
                    if (!s || s.sent === 0) return null;
                    const replyRate = s.sent > 0 ? Math.round((s.replied / s.sent) * 100) : 0;
                    const winRate = s.sent > 0 ? Math.round((s.won / s.sent) * 100) : 0;
                    return (
                      <div style={{
                        marginTop: 6, padding: '6px 8px', background: C.creamDeep, borderRadius: 8,
                        display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10, fontWeight: 700,
                      }}>
                        <span style={{ color: C.blue }}>📤 {s.sent}</span>
                        {s.replied > 0 && <span style={{ color: C.ai }}>💬 {s.replied} ({replyRate}%)</span>}
                        {s.won > 0 && <span style={{ color: C.emeraldDeep }}>🏆 {s.won} ({winRate}%)</span>}
                        {s.revenue > 0 && <span style={{ color: C.purple }}>💰 {s.revenue.toLocaleString('fr-FR')}€</span>}
                      </div>
                    );
                  })()}

                  <button
                    onClick={() => setPicked(p)}
                    disabled={!inStock || !catalogId}
                    className={inStock && catalogId ? 'btn-primary' : 'btn-secondary'}
                    style={{ marginTop: 8, padding: '7px 12px', fontSize: 12, opacity: inStock && catalogId ? 1 : 0.5 }}
                  >
                    <Send size={12} /> Envoyer en WhatsApp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {picked && catalogId && (
        <SendProductModal
          product={picked}
          catalogId={catalogId}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}

function SendProductModal({ product, catalogId, onClose }: { product: Product; catalogId: string; onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const [bodyText, setBodyText] = useState(`Voici notre ${product.name ?? 'produit'} qui pourrait t'intéresser 👇`);
  const [footerText, setFooterText] = useState('Réponds-moi pour passer commande.');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!phone.trim()) {
      toast.error('Numéro requis');
      return;
    }
    setSending(true);
    try {
      await api.post('/whatsapp/catalog/send-product', {
        to: phone.replace(/[\s()-]/g, ''),
        productRetailerId: product.retailer_id,
        bodyText,
        footerText: footerText || undefined,
      });
      toast.success('Produit envoyé', `${product.name ?? product.retailer_id} → +${phone}`);
      onClose();
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
    } finally { setSending(false); }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cream, borderRadius: 18, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.purple}, ${C.purpleSoft})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="display-font" style={{ fontSize: 16, fontWeight: 800, color: C.ink, margin: 0 }}>
              Envoyer {product.name ?? product.retailer_id}
            </h3>
            <div className="mono-font" style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
              {product.retailer_id} · {product.price ?? ''}
            </div>
          </div>
          <button onClick={onClose} className="icon-btn ghost"><X size={16} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Numéro destinataire
            </label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+225 07 01 23 45 67"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Message (corps)
            </label>
            <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Footer (optionnel)
            </label>
            <input value={footerText} onChange={e => setFooterText(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none' }} />
          </div>
          <div style={{ background: C.waSoft, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, marginBottom: 6 }}>Aperçu WhatsApp</div>
            <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{bodyText}</div>
            <div style={{ marginTop: 8, padding: '8px 10px', background: C.cream, borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
              {product.image_url && <div style={{ width: 40, height: 40, borderRadius: 6, background: `url("${product.image_url}") center/cover` }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display-font" style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{product.name}</div>
                <div className="mono-font" style={{ fontSize: 11, color: C.emeraldDeep, fontWeight: 700 }}>{product.price}</div>
              </div>
            </div>
            {footerText && <div style={{ marginTop: 6, fontSize: 11, color: C.inkLight, fontStyle: 'italic' }}>{footerText}</div>}
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(10,42,32,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} className="btn-secondary" disabled={sending}>Annuler</button>
          <button onClick={send} disabled={sending || !phone.trim()} className="btn-primary">
            <Send size={14} /> {sending ? 'Envoi…' : 'Envoyer le produit'}
          </button>
        </div>
      </div>
    </div>
  );
}
