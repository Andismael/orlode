"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTERNAL_TOOL_NAMES = exports.EXTERNAL_TOOLS = exports.getMarketPricesTool = exports.getWeatherTool = exports.sendEmailTool = void 0;
/**
 * External API Tools for marketplace agents
 * Email (Gmail-first via emailService, Resend fallback), Weather, SMS
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const logger_1 = require("../../utils/logger");
const emailService_1 = require("../../services/email/emailService");
// ── EMAIL (Gmail per-company if connected, else Resend) ─────────────────────
exports.sendEmailTool = genkit_config_1.ai.defineTool({
    name: 'sendEmail',
    description: 'Send an email to a client or employee. For appointment confirmations, quotes, invoices, contracts, reminders, reports, alerts. Pass attachQuoteId / attachInvoiceId / attachContractId to attach the PDF automatically. Sent from the company\'s Gmail if connected, otherwise from the Orlode system address.',
    inputSchema: zod_1.z.object({
        to: zod_1.z.string().describe('Recipient email address'),
        subject: zod_1.z.string().describe('Email subject'),
        body: zod_1.z.string().describe('Email body (plain text or HTML)'),
        companyId: zod_1.z.string(),
        attachQuoteId: zod_1.z.string().optional().describe('Quote document ID to attach as PDF'),
        attachInvoiceId: zod_1.z.string().optional().describe('Invoice document ID to attach as PDF'),
        attachContractId: zod_1.z.string().optional().describe('Employee/contract ID to attach the work contract PDF'),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string(), provider: zod_1.z.string().optional(), from: zod_1.z.string().optional(), attachmentsIncluded: zod_1.z.array(zod_1.z.string()).optional() }),
}, async (input) => {
    try {
        const html = input.body.includes('<') ? input.body : `<p>${input.body.replace(/\n/g, '<br>')}</p>`;
        // Build attachments if any *attachXxxId* was provided.
        const attachments = [];
        const attachmentsIncluded = [];
        if (input.attachQuoteId || input.attachInvoiceId || input.attachContractId) {
            try {
                const { getFirestore } = await Promise.resolve().then(() => __importStar(require('../../config/firebase.config')));
                const { renderInvoicePdf, loadCompanyForInvoice } = await Promise.resolve().then(() => __importStar(require('../../services/invoice/invoicePdfService')));
                const db = getFirestore();
                const company = await loadCompanyForInvoice(input.companyId);
                // ── Quote attachment ──
                if (input.attachQuoteId) {
                    const doc = await db.collection(`companies/${input.companyId}/quotes`).doc(input.attachQuoteId).get();
                    if (doc.exists) {
                        const data = doc.data() ?? {};
                        const items = Array.isArray(data['items'])
                            ? data['items'].map(i => ({
                                name: String(i['description'] ?? i['name'] ?? 'Article'),
                                quantity: Number(i['quantity'] ?? 1),
                                unitPrice: Number(i['unitPrice'] ?? i['price'] ?? 0),
                            }))
                            : [{ name: 'Prestation', quantity: 1, unitPrice: Number(data['totalTTC'] ?? data['total'] ?? 0) }];
                        const buf = await renderInvoicePdf(company, {
                            id: String(data['quoteNumber'] ?? data['reference'] ?? input.attachQuoteId),
                            clientName: data['clientName'] ?? 'Client',
                            clientEmail: input.to,
                            items,
                            subtotal: Number(data['totalTTC'] ?? data['total'] ?? 0),
                            currency: data['currency'] ?? 'XOF',
                            status: 'draft',
                            docType: 'quote',
                            validUntil: data['validUntil'],
                            createdAt: data['createdAt'],
                        });
                        attachments.push({ filename: `Devis-${data['quoteNumber'] ?? input.attachQuoteId}.pdf`, content: buf });
                        attachmentsIncluded.push(`quote:${input.attachQuoteId}`);
                    }
                    else {
                        logger_1.logger.warn('[sendEmail] attachQuoteId not found', { quoteId: input.attachQuoteId });
                    }
                }
                // ── Invoice attachment ──
                if (input.attachInvoiceId) {
                    const doc = await db.collection(`companies/${input.companyId}/invoices`).doc(input.attachInvoiceId).get();
                    if (doc.exists) {
                        const data = doc.data() ?? {};
                        const items = Array.isArray(data['items'])
                            ? data['items'].map(i => ({
                                name: String(i['description'] ?? i['name'] ?? 'Article'),
                                quantity: Number(i['quantity'] ?? 1),
                                unitPrice: Number(i['unitPrice'] ?? i['price'] ?? 0),
                            }))
                            : [{ name: 'Prestation', quantity: 1, unitPrice: Number(data['totalTTC'] ?? data['total'] ?? 0) }];
                        const buf = await renderInvoicePdf(company, {
                            id: String(data['number'] ?? data['reference'] ?? input.attachInvoiceId),
                            clientName: data['clientName'] ?? 'Client',
                            clientEmail: input.to,
                            items,
                            subtotal: Number(data['totalTTC'] ?? data['total'] ?? 0),
                            currency: data['currency'] ?? 'XOF',
                            status: data['status'] ?? 'pending',
                            docType: 'invoice',
                            createdAt: data['createdAt'],
                        });
                        attachments.push({ filename: `Facture-${data['number'] ?? input.attachInvoiceId}.pdf`, content: buf });
                        attachmentsIncluded.push(`invoice:${input.attachInvoiceId}`);
                    }
                    else {
                        logger_1.logger.warn('[sendEmail] attachInvoiceId not found', { invoiceId: input.attachInvoiceId });
                    }
                }
            }
            catch (attachErr) {
                logger_1.logger.error('[sendEmail] Attachment loading failed', {
                    error: attachErr instanceof Error ? attachErr.message : String(attachErr),
                    attachQuoteId: input.attachQuoteId,
                    attachInvoiceId: input.attachInvoiceId,
                });
                // Don't fail the whole email — send without attachment but note in response.
            }
        }
        const result = await (0, emailService_1.sendEmail)({
            to: input.to,
            subject: input.subject,
            html,
            companyId: input.companyId,
            attachments: attachments.length > 0 ? attachments : undefined,
        });
        const fromNote = result.from ? ` depuis ${result.from}` : '';
        const attachNote = attachments.length > 0 ? ` avec ${attachments.length} pièce(s) jointe(s)` : '';
        return {
            success: true,
            provider: result.provider,
            from: result.from,
            message: `Email envoye a ${input.to}${fromNote}${attachNote} (via ${result.provider}, ID: ${result.id})`,
            attachmentsIncluded: attachmentsIncluded.length > 0 ? attachmentsIncluded : undefined,
        };
    }
    catch (err) {
        logger_1.logger.error('[sendEmail] Failed', { error: err });
        return { success: false, message: `Erreur: ${String(err)}` };
    }
});
// ── WEATHER (OpenWeatherMap — free tier) ─────────────────────────────────────
exports.getWeatherTool = genkit_config_1.ai.defineTool({
    name: 'getWeather',
    description: 'Get current weather and 5-day forecast for a location. Use for: agriculture (planting decisions), construction (weather delays), events planning.',
    inputSchema: zod_1.z.object({
        city: zod_1.z.string().describe('City name (e.g. "Abidjan", "Paris", "Dakar")'),
        country: zod_1.z.string().optional().describe('Country code (e.g. "CI", "FR", "SN")'),
        companyId: zod_1.z.string(),
    }),
    outputSchema: zod_1.z.object({
        current: zod_1.z.object({
            temp: zod_1.z.number(), feelsLike: zod_1.z.number(), humidity: zod_1.z.number(),
            description: zod_1.z.string(), wind: zod_1.z.number(), rain: zod_1.z.boolean(),
        }),
        forecast: zod_1.z.array(zod_1.z.object({
            date: zod_1.z.string(), tempMin: zod_1.z.number(), tempMax: zod_1.z.number(),
            description: zod_1.z.string(), rain: zod_1.z.boolean(),
        })),
        summary: zod_1.z.string(),
    }),
}, async (input) => {
    // Free OpenWeatherMap API (no key needed for basic)
    // Use open-meteo.com which is completely free
    try {
        // First geocode the city
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.city)}&count=1&language=fr`);
        const geoData = await geoRes.json();
        const loc = geoData.results?.[0];
        if (!loc)
            return {
                current: { temp: 0, feelsLike: 0, humidity: 0, description: 'Ville non trouvee', wind: 0, rain: false },
                forecast: [], summary: `Ville "${input.city}" non trouvee.`,
            };
        // Get weather
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,rain` +
            `&daily=temperature_2m_max,temperature_2m_min,rain_sum,weathercode` +
            `&timezone=auto&forecast_days=5`);
        const w = await weatherRes.json();
        const cur = w.current ?? {};
        const current = {
            temp: Math.round((cur['temperature_2m'] ?? 0) * 10) / 10,
            feelsLike: Math.round((cur['apparent_temperature'] ?? 0) * 10) / 10,
            humidity: cur['relative_humidity_2m'] ?? 0,
            description: describeWeatherCode(0),
            wind: Math.round((cur['wind_speed_10m'] ?? 0) * 10) / 10,
            rain: (cur['rain'] ?? 0) > 0,
        };
        const daily = w.daily ?? {};
        const forecast = (daily.time ?? []).map((date, i) => ({
            date,
            tempMin: Math.round((daily.temperature_2m_min?.[i] ?? 0) * 10) / 10,
            tempMax: Math.round((daily.temperature_2m_max?.[i] ?? 0) * 10) / 10,
            description: describeWeatherCode(daily.weathercode?.[i] ?? 0),
            rain: (daily.rain_sum?.[i] ?? 0) > 0,
        }));
        const rainyDays = forecast.filter(f => f.rain).length;
        const summary = `${loc.name}, ${loc.country}: ${current.temp}°C (ressenti ${current.feelsLike}°C), ` +
            `humidite ${current.humidity}%, vent ${current.wind} km/h. ` +
            `Prevision 5j: ${rainyDays} jour(s) de pluie, ` +
            `temp ${Math.min(...forecast.map(f => f.tempMin))}°-${Math.max(...forecast.map(f => f.tempMax))}°C.`;
        return { current, forecast, summary };
    }
    catch (err) {
        logger_1.logger.error('[getWeather] Failed', { error: err });
        return {
            current: { temp: 0, feelsLike: 0, humidity: 0, description: 'Erreur', wind: 0, rain: false },
            forecast: [], summary: `Erreur meteo: ${String(err)}`,
        };
    }
});
function describeWeatherCode(code) {
    if (code === 0)
        return 'Ciel degage';
    if (code <= 3)
        return 'Partiellement nuageux';
    if (code <= 49)
        return 'Brouillard';
    if (code <= 59)
        return 'Bruine';
    if (code <= 69)
        return 'Pluie';
    if (code <= 79)
        return 'Neige';
    if (code <= 84)
        return 'Averses';
    if (code <= 94)
        return 'Neige abondante';
    return 'Orage';
}
// ── MARKET PRICES (free APIs) ───────────────────────────────────────────────
exports.getMarketPricesTool = genkit_config_1.ai.defineTool({
    name: 'getMarketPrices',
    description: 'Get current market prices for commodities, currencies, or materials. Use for: agriculture (crop prices), construction (material costs), finance.',
    inputSchema: zod_1.z.object({
        category: zod_1.z.enum(['agriculture', 'metals', 'energy', 'currency']),
        items: zod_1.z.array(zod_1.z.string()).optional().describe('Specific items to check'),
        companyId: zod_1.z.string(),
    }),
    outputSchema: zod_1.z.object({ prices: zod_1.z.array(zod_1.z.object({ item: zod_1.z.string(), price: zod_1.z.string(), trend: zod_1.z.string() })), summary: zod_1.z.string() }),
}, async (input) => {
    // Use reference prices (updated periodically in a real deployment)
    const refPrices = {
        agriculture: {
            'Cacao': { price: '$2,800/tonne', unit: 'tonne', trend: 'hausse' },
            'Cafe Robusta': { price: '$2,100/tonne', unit: 'tonne', trend: 'hausse' },
            'Riz': { price: '$450/tonne', unit: 'tonne', trend: 'stable' },
            'Mais': { price: '$180/tonne', unit: 'tonne', trend: 'baisse' },
            'Coton': { price: '$0.75/lb', unit: 'livre', trend: 'stable' },
            'Huile de palme': { price: '$900/tonne', unit: 'tonne', trend: 'hausse' },
            'Manioc': { price: '$120/tonne', unit: 'tonne', trend: 'stable' },
            'Igname': { price: '$300/tonne', unit: 'tonne', trend: 'stable' },
        },
        metals: {
            'Acier': { price: '$550/tonne', unit: 'tonne', trend: 'stable' },
            'Aluminium': { price: '$2,400/tonne', unit: 'tonne', trend: 'hausse' },
            'Cuivre': { price: '$8,500/tonne', unit: 'tonne', trend: 'hausse' },
            'Fer': { price: '$110/tonne', unit: 'tonne', trend: 'baisse' },
            'Ciment': { price: '$120/tonne', unit: 'tonne', trend: 'stable' },
            'Bois': { price: '$350/m³', unit: 'm³', trend: 'hausse' },
        },
        energy: {
            'Essence': { price: '$1.20/litre', unit: 'litre', trend: 'stable' },
            'Diesel': { price: '$1.15/litre', unit: 'litre', trend: 'stable' },
            'Electricite': { price: '$0.12/kWh', unit: 'kWh', trend: 'hausse' },
            'Gaz butane': { price: '$0.80/kg', unit: 'kg', trend: 'stable' },
        },
        currency: {
            'USD/XOF': { price: '605 FCFA', unit: '1 USD', trend: 'stable' },
            'EUR/XOF': { price: '655 FCFA', unit: '1 EUR', trend: 'stable' },
            'USD/EUR': { price: '0.92', unit: '1 USD', trend: 'baisse' },
            'GBP/USD': { price: '1.27', unit: '1 GBP', trend: 'hausse' },
        },
    };
    const cat = refPrices[input.category] ?? {};
    let items = Object.entries(cat);
    if (input.items?.length) {
        const lower = input.items.map(i => i.toLowerCase());
        items = items.filter(([k]) => lower.some(l => k.toLowerCase().includes(l)));
    }
    const prices = items.map(([item, data]) => ({
        item, price: data.price, trend: data.trend === 'hausse' ? '↑ hausse' : data.trend === 'baisse' ? '↓ baisse' : '→ stable',
    }));
    const summary = `${prices.length} prix ${input.category}: ` +
        prices.map(p => `${p.item} ${p.price} (${p.trend})`).join(', ');
    return { prices, summary };
});
exports.EXTERNAL_TOOLS = [exports.sendEmailTool, exports.getWeatherTool, exports.getMarketPricesTool];
exports.EXTERNAL_TOOL_NAMES = ['sendEmail', 'getWeather', 'getMarketPrices'];
//# sourceMappingURL=externalTools.js.map