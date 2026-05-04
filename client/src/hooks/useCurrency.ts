/**
 * useCurrency — converts AND formats money with LIVE exchange rates
 * Fetches rates from /api/subscription/rates (ExchangeRate-API, cached 12h server-side)
 * All internal prices are in USD. This hook converts to the chosen currency.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', XOF: 'FCFA', XAF: 'FCFA', GBP: '£', CHF: 'Fr',
  CAD: '$', MAD: 'DH', TND: 'DT', GNF: 'FG', NGN: '₦', KES: 'KSh',
  ZAR: 'R', BRL: 'R$', INR: '₹', JPY: '¥', CNY: '¥', AED: 'AED', SAR: 'SAR',
};

const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, XOF: 600, XAF: 600, GBP: 0.79, CHF: 0.88,
  CAD: 1.37, MAD: 10.05, TND: 3.12, GNF: 8600, NGN: 1550, KES: 129,
  ZAR: 18.2, BRL: 5.05, INR: 83.5, JPY: 151, CNY: 7.24, AED: 3.67, SAR: 3.75,
};

const NO_DECIMALS = new Set(['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN']);

// Global cache
let globalRates: Record<string, number> | null = null;
let globalFetchedAt = 0;
const CACHE_MS = 30 * 60 * 1000;

export function useCurrency() {
  const { company } = useAuthStore();
  const [rates, setRates] = useState<Record<string, number>>(globalRates ?? FALLBACK_RATES);

  const currency = (company as Record<string, unknown>)?.['settings']
    ? ((company as Record<string, unknown>)['settings'] as Record<string, string>)?.['currency'] ?? 'USD'
    : (company as Record<string, unknown>)?.['currency'] as string ?? 'USD';

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const rate = rates[currency] ?? FALLBACK_RATES[currency] ?? 1;
  const decimals = NO_DECIMALS.has(currency) ? 0 : 2;

  useEffect(() => {
    if (globalRates && Date.now() - globalFetchedAt < CACHE_MS) {
      setRates(globalRates);
      return;
    }
    api.get('/subscription/rates').then(r => {
      const data = r.data;
      if (data && typeof data === 'object' && Object.keys(data).length > 10) {
        globalRates = data as Record<string, number>;
        globalFetchedAt = Date.now();
        setRates(data as Record<string, number>);
      }
    }).catch(() => {});
  }, []);

  const convert = (amountUSD: number): number => amountUSD * rate;

  const formatRaw = (amount: number): string => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency,
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      }).format(amount);
    } catch {
      const formatted = decimals === 0
        ? Math.round(amount).toLocaleString()
        : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${formatted} ${symbol}`;
    }
  };

  const formatMoney = (amountUSD: number): string => formatRaw(convert(amountUSD));

  const formatShort = (amountUSD: number): string => {
    const converted = convert(amountUSD);
    const formatted = decimals === 0
      ? Math.round(converted).toLocaleString()
      : converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'BRL', 'INR', 'JPY', 'CNY'].includes(currency)) {
      return `${symbol}${formatted}`;
    }
    return `${formatted} ${symbol}`;
  };

  const formatLocal = (amount: number): string => formatRaw(amount);

  return { currency, symbol, rate, convert, formatMoney, formatShort, formatLocal };
}
