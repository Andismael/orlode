import React from 'react';
import { Package, Users, Calendar, TrendingUp } from 'lucide-react';

interface KpiItem {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  color: string;
  bg: string;
}

interface Props {
  items: KpiItem[];
}

/**
 * Shared 4-KPI strip used at the top of every vertical pack admin page
 * (Restaurant, Hôtel, Salon, Santé, Immo). Renders responsive cards with
 * a colored icon, big number, and a small hint line below. Designed to
 * match the boutique-style visual richness without duplicating code.
 */
export default function PackKpiStrip({ items }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3 mb-4">
      {items.map((it, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: it.bg, color: it.color }}
            >
              {it.icon}
            </div>
            <span className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{it.label}</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-gray-900 truncate">{it.value}</p>
          {it.hint && <p className="text-[10px] md:text-xs text-gray-400 mt-0.5 truncate">{it.hint}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Helpers to build the 4 KPI items per pack — reused across verticals ────

export function buildVerticalKpis(opts: {
  itemsCount: number;
  itemsLabel: string;       // "Plats", "Chambres", "Services", "Patients", "Biens"
  itemsHint?: string;       // "actifs"
  reservations: Array<{
    customerPhone?: string;
    totalAmount?: number;
    createdAt?: { _seconds?: number; toDate?: () => Date } | string | Date;
    status?: string;
  }>;
  currency: string;
  bookingLabel: string;     // "Réservations", "Séjours", "RDV", "Consultations", "Visites"
  formatPrice: (n: number, c: string) => string;
  accentColor: string;      // pack accent
  accentBg: string;         // pack accent bg (e.g. accent + '15')
}): KpiItem[] {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const inMonth = opts.reservations.filter(r => {
    const d = parseDate(r.createdAt);
    return d && d >= monthStart;
  });

  const revenueMonth = inMonth.reduce((s, r) => s + (typeof r.totalAmount === 'number' ? r.totalAmount : 0), 0);
  const uniquePhones = new Set(opts.reservations.map(r => r.customerPhone).filter(Boolean));

  return [
    {
      icon: <Package size={16} />, label: opts.itemsLabel,
      value: opts.itemsCount,
      hint: opts.itemsHint ?? 'au catalogue',
      color: opts.accentColor, bg: opts.accentBg,
    },
    {
      icon: <Calendar size={16} />, label: opts.bookingLabel,
      value: inMonth.length,
      hint: 'ce mois-ci',
      color: '#0EA5E9', bg: '#0EA5E915',
    },
    {
      icon: <TrendingUp size={16} />, label: 'CA',
      value: revenueMonth > 0 ? opts.formatPrice(revenueMonth, opts.currency) : '—',
      hint: 'ce mois-ci',
      color: '#10B981', bg: '#10B98115',
    },
    {
      icon: <Users size={16} />, label: 'Clients',
      value: uniquePhones.size,
      hint: 'uniques (total)',
      color: '#8B5CF6', bg: '#8B5CF615',
    },
  ];
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'object') {
    const obj = v as { _seconds?: number; toDate?: () => Date };
    if (typeof obj._seconds === 'number') return new Date(obj._seconds * 1000);
    if (typeof obj.toDate === 'function') {
      try { return obj.toDate(); } catch { return null; }
    }
  }
  return null;
}
