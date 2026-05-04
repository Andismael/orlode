import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Package, Plus, Trash2, Loader2, CheckCircle2, XCircle, RefreshCw, CreditCard, Send, Ban, FileText } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

type OrderStatus = 'draft' | 'pending_payment' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded';

interface Product {
  id: string; name: string; description?: string;
  price: number; currency: string;
  stock?: number | null; category?: string;
  active?: boolean; imageUrl?: string;
}

interface OrderItem { productId: string; name: string; quantity: number; unitPrice: number; }
interface Order {
  id: string; clientName: string; clientPhone?: string; clientEmail?: string;
  items: OrderItem[]; subtotal: number; currency: string;
  status: OrderStatus;
  paymentMethod?: string | null; paymentUrl?: string | null;
  sourceChannel?: string; notes?: string;
  createdAt?: { seconds?: number };
}

const STATUS_META: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  draft:           { label: 'Brouillon',       bg: 'bg-gray-100',  text: 'text-gray-600' },
  pending_payment: { label: 'Attente paiement', bg: 'bg-amber-100', text: 'text-amber-700' },
  paid:            { label: 'Payée',           bg: 'bg-green-100', text: 'text-green-700' },
  fulfilled:       { label: 'Livrée',          bg: 'bg-blue-100',  text: 'text-blue-700' },
  cancelled:       { label: 'Annulée',         bg: 'bg-gray-100',  text: 'text-gray-600' },
  refunded:        { label: 'Remboursée',      bg: 'bg-red-100',   text: 'text-red-700' },
};

export default function ShopAdminPage() {
  const user = useAuthStore(s => s.user);
  const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.superAdmin;

  const [tab, setTab] = useState<'orders' | 'products'>('orders');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProd, setNewProd] = useState({ name: '', price: '', currency: 'XOF', category: '', stock: '', description: '' });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get<Product[]>('/products').catch(() => ({ data: [] })),
        api.get<Order[]>('/orders').catch(() => ({ data: [] })),
      ]);
      const rp = r1.data as unknown as Record<string, unknown>;
      const ro = r2.data as unknown as Record<string, unknown>;
      setProducts(((rp?.data ?? rp ?? []) as Product[]) || []);
      setOrders(((ro?.data ?? ro ?? []) as Order[]) || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const createProduct = async () => {
    if (!newProd.name.trim() || !newProd.price) return;
    try {
      await api.post('/products', {
        name: newProd.name.trim(),
        price: Number(newProd.price),
        currency: newProd.currency,
        category: newProd.category.trim(),
        stock: newProd.stock ? Number(newProd.stock) : null,
        description: newProd.description,
      });
      setNewProd({ name: '', price: '', currency: 'XOF', category: '', stock: '', description: '' });
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try { await api.delete(`/products/${id}`); load(); } catch { /* ignore */ }
  };

  const toggleProductActive = async (p: Product) => {
    try { await api.patch(`/products/${p.id}`, { active: !p.active }); load(); } catch { /* ignore */ }
  };

  const orderAction = async (id: string, action: string, payload: Record<string, unknown> = {}) => {
    setBusy(id + action); setFeedback(null);
    try {
      await api.patch(`/orders/${id}`, { action, ...payload });
      setFeedback({ type: 'success', text: `Action "${action}" OK.` });
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setBusy(null); }
  };

  const orderCounts = useMemo(() => {
    const base: Record<string, number> = { all: orders.length, pending_payment: 0, paid: 0, fulfilled: 0, cancelled: 0 };
    orders.forEach(o => { base[o.status] = (base[o.status] ?? 0) + 1; });
    return base;
  }, [orders]);

  if (!canManage) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <p className="text-sm text-gray-600">Accès réservé aux administrateurs et managers.</p>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-rose-100"><ShoppingCart size={24} className="text-rose-600" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Boutique</h1>
          <p className="text-sm text-gray-500">Produits + Commandes — le Clone peut les vendre</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab('orders')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'orders' ? 'border-rose-600 text-rose-700' : 'border-transparent text-gray-500'}`}>
          Commandes ({orderCounts.all})
        </button>
        <button onClick={() => setTab('products')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'products' ? 'border-rose-600 text-rose-700' : 'border-transparent text-gray-500'}`}>
          Catalogue ({products.length})
        </button>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {tab === 'orders' && (
        <>
          {orders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
              Aucune commande. Le Clone en créera quand un client passera commande via voice/WhatsApp/chat.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(o => {
                const meta = STATUS_META[o.status] ?? STATUS_META.pending_payment;
                return (
                  <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-gray-900">{o.clientName}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.text}`}>{meta.label}</span>
                          {o.sourceChannel && <span className="text-xs text-gray-400">via {o.sourceChannel}</span>}
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {o.items.map((it, i) => (
                            <div key={i}>{it.quantity} × {it.name} — {it.unitPrice} {o.currency}</div>
                          ))}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
                          <span className="font-semibold text-gray-800">Total: {o.subtotal} {o.currency}</span>
                          {o.clientPhone && <span>· {o.clientPhone}</span>}
                          {o.clientEmail && <span>· {o.clientEmail}</span>}
                          {o.paymentMethod && <span>· Méthode: {o.paymentMethod}</span>}
                        </div>
                        {o.paymentUrl && (
                          <p className="text-xs text-blue-600 mt-1 truncate"><a href={o.paymentUrl} target="_blank" rel="noopener">{o.paymentUrl}</a></p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {(o.status === 'paid' || o.status === 'fulfilled') && (
                          <button onClick={async () => {
                            const { auth } = await import('@/services/firebase');
                            const token = await auth.currentUser?.getIdToken();
                            const r = await fetch(`/api/orders/${o.id}/invoice.pdf`, { headers: { Authorization: `Bearer ${token}` } });
                            const blob = await r.blob();
                            window.open(URL.createObjectURL(blob), '_blank');
                          }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs hover:bg-violet-100">
                            <FileText size={12} /> Facture PDF
                          </button>
                        )}
                        {o.status === 'pending_payment' && (
                          <>
                            <button onClick={() => orderAction(o.id, 'mark-paid')} disabled={!!busy}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50">
                              <CheckCircle2 size={12} /> Marquer payée
                            </button>
                            {o.paymentUrl && (
                              <button onClick={() => orderAction(o.id, 'send-payment-link')}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs hover:bg-blue-100">
                                <Send size={12} /> Renvoyer lien
                              </button>
                            )}
                          </>
                        )}
                        {o.status === 'paid' && (
                          <button onClick={() => orderAction(o.id, 'fulfill')}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700">
                            <CheckCircle2 size={12} /> Marquer livrée
                          </button>
                        )}
                        {!['cancelled', 'refunded', 'fulfilled'].includes(o.status) && (
                          <button onClick={() => orderAction(o.id, 'cancel', { notes: prompt('Raison ?') ?? '' })}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200">
                            <Ban size={12} /> Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Plus size={16} /> Ajouter un produit</h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              <input type="text" placeholder="Nom *" value={newProd.name}
                onChange={e => setNewProd(p => ({ ...p, name: e.target.value }))}
                className="md:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input type="number" placeholder="Prix *" value={newProd.price}
                onChange={e => setNewProd(p => ({ ...p, price: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <select value={newProd.currency} onChange={e => setNewProd(p => ({ ...p, currency: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="XOF">XOF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="XAF">XAF</option>
              </select>
              <input type="text" placeholder="Catégorie" value={newProd.category}
                onChange={e => setNewProd(p => ({ ...p, category: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <button onClick={createProduct} disabled={!newProd.name.trim() || !newProd.price}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 disabled:opacity-50">
                <Plus size={14} /> Ajouter
              </button>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
              Aucun produit. Ajoute ton premier produit pour que le Clone puisse vendre.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {products.map(p => (
                <div key={p.id} className={`bg-white rounded-xl border ${p.active === false ? 'border-gray-200 opacity-60' : 'border-gray-200'} p-3 flex items-center gap-3`}>
                  <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                    <Package size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.price} {p.currency}{p.category ? ` · ${p.category}` : ''}{p.stock != null ? ` · stock ${p.stock}` : ''}
                    </p>
                  </div>
                  <button onClick={() => toggleProductActive(p)}
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">
                    {p.active === false ? 'Activer' : 'Désactiver'}
                  </button>
                  <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
