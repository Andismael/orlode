"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExchangeRates = getExchangeRates;
exports.convertFromUSD = convertFromUSD;
/**
 * Exchange Rate Service — fetches daily rates from ExchangeRate-API (free tier)
 * Caches rates in Firestore to avoid hitting API limits
 * Base currency: USD
 */
const firebase_config_1 = require("../config/firebase.config");
const logger_1 = require("../utils/logger");
const API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours
// Fallback rates if API is down
const FALLBACK_RATES = {
    USD: 1, EUR: 0.92, XOF: 600, XAF: 600, GBP: 0.79, CHF: 0.88,
    CAD: 1.37, MAD: 10.05, TND: 3.12, GNF: 8600, NGN: 1550, KES: 129,
    ZAR: 18.2, BRL: 5.05, INR: 83.5, JPY: 151, CNY: 7.24, AED: 3.67, SAR: 3.75,
};
let cachedRates = null;
let cacheTimestamp = 0;
/**
 * Get exchange rates (base USD)
 * 1. Check memory cache
 * 2. Check Firestore cache
 * 3. Fetch from API
 * 4. Fallback to hardcoded
 */
async function getExchangeRates() {
    // 1. Memory cache
    if (cachedRates && Date.now() - cacheTimestamp < CACHE_DURATION) {
        return cachedRates;
    }
    const db = (0, firebase_config_1.getFirestore)();
    // 2. Firestore cache
    try {
        const doc = await db.collection('_system').doc('exchangeRates').get();
        if (doc.exists) {
            const data = doc.data();
            const updatedAt = data['updatedAt']?.toDate?.()?.getTime() ?? 0;
            if (Date.now() - updatedAt < CACHE_DURATION) {
                cachedRates = data['rates'];
                cacheTimestamp = Date.now();
                return cachedRates;
            }
        }
    }
    catch { }
    // 3. Fetch from API
    try {
        logger_1.logger.info('[ExchangeRate] Fetching live rates from API...');
        const res = await fetch(API_URL);
        const data = await res.json();
        if (data.result === 'success' && data.rates) {
            cachedRates = data.rates;
            cacheTimestamp = Date.now();
            // Save to Firestore
            await db.collection('_system').doc('exchangeRates').set({
                rates: data.rates,
                updatedAt: new Date(),
                source: 'open.er-api.com',
            }).catch(() => { });
            logger_1.logger.info(`[ExchangeRate] Loaded ${Object.keys(data.rates).length} currencies`);
            return cachedRates;
        }
    }
    catch (err) {
        logger_1.logger.warn('[ExchangeRate] API fetch failed, using fallback', { error: String(err) });
    }
    // 4. Fallback
    cachedRates = FALLBACK_RATES;
    cacheTimestamp = Date.now();
    return FALLBACK_RATES;
}
/** Convert amount from USD to target currency */
async function convertFromUSD(amountUSD, targetCurrency) {
    const rates = await getExchangeRates();
    const rate = rates[targetCurrency] ?? 1;
    return amountUSD * rate;
}
//# sourceMappingURL=exchangeRateService.js.map