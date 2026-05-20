"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = exports.WhatsAppService = void 0;
/**
 * WhatsApp Business API Service
 * Gère l'envoi et la réception de messages WhatsApp via Meta Cloud API.
 * Chaque client a ses propres credentials (BYOE — stockés chiffrés dans Firestore).
 * Voice: Whisper (transcription) + OpenAI TTS (synthèse) + Firebase Storage (hébergement)
 */
const crypto_1 = require("crypto");
const firebase_config_1 = require("../../config/firebase.config");
const tenantManager_1 = require("../../config/tenantManager");
const encryption_1 = require("../../config/encryption");
const logger_1 = require("../../utils/logger");
const ENCRYPTION_KEY = process.env['WHATSAPP_ENCRYPTION_KEY'] ?? 'corpmind-whatsapp-key-32bytes!!';
const GRAPH_API = 'https://graph.facebook.com/v21.0';
function encrypt(text) {
    const iv = (0, crypto_1.randomBytes)(16);
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', key, iv);
    return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}
function decrypt(encrypted) {
    try {
        const [ivHex, data] = encrypted.split(':');
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
        const iv = Buffer.from(ivHex, 'hex');
        // createDecipheriv signature: (algorithm, key, iv) — args used to be swapped
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-cbc', key, iv);
        return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
    }
    catch (err) {
        logger_1.logger.error('[WhatsApp] decrypt failed — returning ciphertext as fallback', { err: String(err) });
        return encrypted;
    }
}
class WhatsAppService {
    /** Récupère la config WhatsApp du client depuis Firestore */
    async getConfig(companyId) {
        try {
            const doc = await (0, firebase_config_1.getFirestore)()
                .collection('companies').doc(companyId)
                .collection('integrations').doc('whatsapp')
                .get();
            if (!doc.exists)
                return null;
            return doc.data();
        }
        catch {
            return null;
        }
    }
    /**
     * Fetch the live phone number metadata from Meta's Graph API.
     * Returns the display number, verified business name, and quality rating
     * — useful to show the user "+225 07 01 23 45 67" instead of just the
     * opaque phoneNumberId. Caches the result on the integration doc so we
     * don't re-call Meta on every status check.
     */
    async fetchPhoneInfo(companyId) {
        try {
            const config = await this.getConfig(companyId);
            if (!config)
                return null;
            const token = decrypt(config.accessToken);
            const url = `${GRAPH_API}/${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`;
            const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) {
                logger_1.logger.warn('[WhatsApp] fetchPhoneInfo HTTP error', { status: r.status, statusText: r.statusText });
                return null;
            }
            const data = await r.json();
            const info = {
                displayPhoneNumber: data.display_phone_number ?? null,
                verifiedName: data.verified_name ?? null,
                qualityRating: data.quality_rating ?? null,
            };
            // Cache for fast subsequent reads
            await (0, firebase_config_1.getFirestore)()
                .collection('companies').doc(companyId)
                .collection('integrations').doc('whatsapp')
                .set({
                displayPhoneNumber: info.displayPhoneNumber,
                verifiedName: info.verifiedName,
                qualityRating: info.qualityRating,
                phoneInfoFetchedAt: new Date(),
            }, { merge: true });
            return info;
        }
        catch (err) {
            logger_1.logger.warn('[WhatsApp] fetchPhoneInfo failed', { error: String(err) });
            return null;
        }
    }
    /** Sauvegarde la config WhatsApp (token chiffré) */
    async saveConfig(companyId, config) {
        const webhookVerifyToken = (0, crypto_1.randomBytes)(16).toString('hex');
        const db = (0, firebase_config_1.getFirestore)();
        await db
            .collection('companies').doc(companyId)
            .collection('integrations').doc('whatsapp')
            .set({
            ...config,
            accessToken: encrypt(config.accessToken),
            webhookVerifyToken,
            autoReply: config.autoReply ?? true,
            replyMode: config.replyMode ?? 'auto',
            ttsVoice: config.ttsVoice ?? 'alloy',
            language: config.language ?? 'fr',
            connectedAt: new Date(),
        });
        // Also mirror phoneNumberId on the root company doc for fast webhook routing
        await db.collection('companies').doc(companyId).set({
            whatsappPhoneNumberId: config.phoneNumberId,
            updatedAt: new Date(),
        }, { merge: true });
    }
    /** Met à jour uniquement les paramètres de conversation (sans toucher aux credentials) */
    async updateSettings(companyId, settings) {
        // Strip undefined fields so we don't accidentally erase stored values.
        const clean = {};
        for (const [k, v] of Object.entries(settings)) {
            if (v !== undefined)
                clean[k] = v;
        }
        clean['updatedAt'] = new Date();
        await (0, firebase_config_1.getFirestore)()
            .collection('companies').doc(companyId)
            .collection('integrations').doc('whatsapp')
            .set(clean, { merge: true });
    }
    /** Déconnecte WhatsApp */
    async disconnect(companyId) {
        await (0, firebase_config_1.getFirestore)()
            .collection('companies').doc(companyId)
            .collection('integrations').doc('whatsapp')
            .delete();
    }
    /**
     * Fetches approved + pending message templates (HSMs) for the connected
     * Business Account from Meta. Templates are pre-approved by Meta and used
     * for outbound marketing/transactional messages outside the 24h session.
     *
     * Returns shape:
     *   { name, status, category, language, components: [{ type, text, ... }] }
     */
    async fetchTemplates(companyId) {
        try {
            const config = await this.getConfig(companyId);
            if (!config)
                return [];
            const token = decrypt(config.accessToken);
            const url = `${GRAPH_API}/${config.businessAccountId}/message_templates?fields=name,status,category,language,components,quality_score,rejected_reason&limit=100`;
            const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) {
                const body = await r.text().catch(() => '');
                logger_1.logger.warn('[WhatsApp] fetchTemplates HTTP error', { status: r.status, body: body.slice(0, 300) });
                return [];
            }
            const data = await r.json();
            return data.data ?? [];
        }
        catch (err) {
            logger_1.logger.warn('[WhatsApp] fetchTemplates failed', { error: String(err) });
            return [];
        }
    }
    /**
     * Sends a templated message (HSM). Required outside the 24h customer-service
     * window. `components` is the parameter array per Meta's spec — typically
     * one element per body/header param. Use this when you need header params
     * or a structured response (with error). The simpler `sendTemplate` exists
     * for the legacy callers (just body params, returns just messageId).
     */
    async sendTemplateRich(config, to, templateName, languageCode, components) {
        try {
            const token = decrypt(config.accessToken);
            const url = `${GRAPH_API}/${config.phoneNumberId}/messages`;
            const payload = {
                messaging_product: 'whatsapp',
                to,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: languageCode },
                    ...(components && components.length > 0 ? { components } : {}),
                },
            };
            const r = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body = await r.json();
            if (!r.ok || body.error) {
                const msg = body.error?.message ?? `HTTP ${r.status}`;
                logger_1.logger.warn('[WhatsApp] sendTemplate failed', { to, templateName, msg });
                return { messageId: null, error: msg };
            }
            return { messageId: body.messages?.[0]?.id ?? null };
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] sendTemplate threw', { error: String(err), to });
            return { messageId: null, error: err.message };
        }
    }
    /**
     * Find the Meta Commerce catalog associated with the company's Business
     * Account. A WABA can have one or more catalogs — we return the first
     * (most common case is exactly one).
     */
    async getCatalogId(companyId) {
        try {
            const config = await this.getConfig(companyId);
            if (!config)
                return null;
            const token = decrypt(config.accessToken);
            // The owning Business Manager (parent of the WABA) holds the catalog.
            // Easiest: query /{wabaId}/product_catalogs which returns owned-or-linked.
            const url = `${GRAPH_API}/${config.businessAccountId}/product_catalogs?fields=id,name`;
            const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) {
                logger_1.logger.warn('[WhatsApp/Catalog] product_catalogs HTTP error', { status: r.status });
                return null;
            }
            const data = await r.json();
            return data.data?.[0]?.id ?? null;
        }
        catch (err) {
            logger_1.logger.warn('[WhatsApp/Catalog] getCatalogId failed', { error: String(err) });
            return null;
        }
    }
    /** List products from the company's catalog. */
    async listCatalogProducts(companyId) {
        try {
            const config = await this.getConfig(companyId);
            if (!config)
                return [];
            const catalogId = await this.getCatalogId(companyId);
            if (!catalogId)
                return [];
            const token = decrypt(config.accessToken);
            const url = `${GRAPH_API}/${catalogId}/products?fields=id,retailer_id,name,description,price,currency,availability,image_url,visibility&limit=100`;
            const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) {
                const body = await r.text().catch(() => '');
                logger_1.logger.warn('[WhatsApp/Catalog] products HTTP error', { status: r.status, body: body.slice(0, 200) });
                return [];
            }
            const data = await r.json();
            return data.data ?? [];
        }
        catch (err) {
            logger_1.logger.warn('[WhatsApp/Catalog] listCatalogProducts failed', { error: String(err) });
            return [];
        }
    }
    /**
     * Sends an interactive single-product message via WhatsApp. The customer
     * sees the product card with image + price + a "View" button that opens
     * the product details in WhatsApp.
     */
    async sendProductMessage(config, to, catalogId, productRetailerId, bodyText, footerText) {
        try {
            const token = decrypt(config.accessToken);
            const payload = {
                messaging_product: 'whatsapp',
                to,
                type: 'interactive',
                interactive: {
                    type: 'product',
                    body: { text: bodyText },
                    ...(footerText ? { footer: { text: footerText } } : {}),
                    action: {
                        catalog_id: catalogId,
                        product_retailer_id: productRetailerId,
                    },
                },
            };
            const r = await fetch(`${GRAPH_API}/${config.phoneNumberId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body = await r.json();
            if (!r.ok || body.error) {
                return { messageId: null, error: body.error?.message ?? `HTTP ${r.status}` };
            }
            return { messageId: body.messages?.[0]?.id ?? null };
        }
        catch (err) {
            return { messageId: null, error: err.message };
        }
    }
    /**
     * Upsert a product into the Meta Commerce catalog using the items_batch
     * API. `retailerId` is our Boutique product id — used as the stable key
     * Meta uses to deduplicate. Returns ok/error so the caller can decide
     * whether to surface the failure (we treat it as non-blocking).
     */
    async upsertCatalogProduct(companyId, retailerId, data) {
        try {
            const config = await this.getConfig(companyId);
            if (!config)
                return { ok: false, error: 'no whatsapp config' };
            const catalogId = await this.getCatalogId(companyId);
            if (!catalogId)
                return { ok: false, error: 'no catalog' };
            const token = decrypt(config.accessToken);
            // Meta Catalog price format: "1500 XOF" or "15.00 USD" (string with currency).
            // For zero-decimal currencies we keep whole units; otherwise we send the
            // decimal value. The Boutique stores price as smallest-unit-aware integer.
            const noDecimal = ['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN', 'RWF', 'BIF', 'UGX']
                .includes(data.currency);
            const priceStr = noDecimal
                ? `${Math.round(data.price)} ${data.currency}`
                : `${(data.price / 100).toFixed(2)} ${data.currency}`;
            const payload = {
                access_token: token,
                requests: [{
                        method: 'UPDATE', // UPDATE = upsert (creates if retailer_id unknown)
                        retailer_id: retailerId,
                        data: {
                            name: data.name.slice(0, 150),
                            description: (data.description ?? data.name).slice(0, 9999),
                            price: priceStr,
                            currency: data.currency,
                            availability: data.availability,
                            condition: 'new',
                            ...(data.imageUrl ? { image_url: data.imageUrl } : {}),
                            ...(data.url ? { url: data.url } : {}),
                            brand: 'Orlode', // Meta requires a brand field
                        },
                    }],
            };
            const r = await fetch(`${GRAPH_API}/${catalogId}/items_batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok || body.error) {
                const msg = body.error?.message ?? `HTTP ${r.status}`;
                logger_1.logger.warn('[WhatsApp/Catalog] upsert failed', { retailerId, msg });
                return { ok: false, error: msg };
            }
            return { ok: true };
        }
        catch (err) {
            logger_1.logger.warn('[WhatsApp/Catalog] upsert threw', { error: String(err) });
            return { ok: false, error: err.message };
        }
    }
    /** Remove a product from the Meta catalog by retailer_id. */
    async deleteCatalogProduct(companyId, retailerId) {
        try {
            const config = await this.getConfig(companyId);
            if (!config)
                return { ok: false, error: 'no whatsapp config' };
            const catalogId = await this.getCatalogId(companyId);
            if (!catalogId)
                return { ok: false, error: 'no catalog' };
            const token = decrypt(config.accessToken);
            const payload = {
                access_token: token,
                requests: [{ method: 'DELETE', retailer_id: retailerId }],
                // allow_upsert=false: don't recreate accidentally
            };
            const r = await fetch(`${GRAPH_API}/${catalogId}/items_batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok || body.error) {
                const msg = body.error?.message ?? `HTTP ${r.status}`;
                logger_1.logger.warn('[WhatsApp/Catalog] delete failed', { retailerId, msg });
                return { ok: false, error: msg };
            }
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    }
    /** Envoie un message texte */
    async sendMessage(config, to, text, 
    /** Persist the outbound message under companies/{companyId}/whatsappMessages
     *  so it appears in the Inbox UI. Pass when known — silently skips otherwise. */
    companyId, 
    /** Tag the origin (auto-reply, admin-inbox, broadcast…) for analytics. */
    sentFrom = 'agent-auto-reply') {
        try {
            const token = decrypt(config.accessToken);
            const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp', to, type: 'text', text: { body: text },
                }),
            });
            const raw = await res.text();
            const data = raw ? JSON.parse(raw) : {};
            const messageId = data.messages?.[0]?.id;
            if (!messageId) {
                logger_1.logger.error('[WhatsApp] sendMessage — Meta API did not return messageId', {
                    httpStatus: res.status, to, phoneNumberId: config.phoneNumberId,
                    metaError: data.error, rawResponse: raw.slice(0, 500),
                });
                return null;
            }
            logger_1.logger.info('[WhatsApp] sendMessage OK', { to, messageId });
            // Persist outbound to Firestore so the Inbox UI shows it alongside
            // inbound messages from this same contact. Best-effort — the message
            // is already on Meta's side, no point failing the call if Firestore
            // write fails.
            if (companyId) {
                try {
                    await (0, firebase_config_1.getFirestore)()
                        .collection(`companies/${companyId}/whatsappMessages`)
                        .add({
                        direction: 'outbound',
                        to: String(to),
                        body: text,
                        messageId,
                        waMessageId: messageId,
                        processed: true,
                        sentFrom,
                        createdAt: new Date(),
                    });
                }
                catch (persistErr) {
                    logger_1.logger.warn('[WhatsApp] sendMessage — failed to persist outbound (non-blocking)', {
                        companyId, to, messageId, error: String(persistErr),
                    });
                }
            }
            return messageId;
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] sendMessage threw exception', { error: String(err), to });
            return null;
        }
    }
    /** Envoie une image native (URL publique). Optionnellement avec une caption. */
    async sendImage(config, to, imageUrl, caption) {
        try {
            const token = decrypt(config.accessToken);
            const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp', to, type: 'image',
                    image: { link: imageUrl, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
                }),
            });
            const raw = await res.text();
            const data = raw ? JSON.parse(raw) : {};
            const messageId = data.messages?.[0]?.id;
            if (!messageId) {
                logger_1.logger.warn('[WhatsApp] sendImage — no messageId', { httpStatus: res.status, to, error: data.error });
                return null;
            }
            return messageId;
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] sendImage threw', { error: String(err), to });
            return null;
        }
    }
    /** Envoie un message location interactif (épingle GPS native dans WhatsApp). */
    async sendLocation(config, to, coords) {
        try {
            const token = decrypt(config.accessToken);
            const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp', to, type: 'location',
                    location: {
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                        ...(coords.name ? { name: coords.name } : {}),
                        ...(coords.address ? { address: coords.address } : {}),
                    },
                }),
            });
            const raw = await res.text();
            const data = raw ? JSON.parse(raw) : {};
            const messageId = data.messages?.[0]?.id;
            if (!messageId) {
                logger_1.logger.warn('[WhatsApp] sendLocation — no messageId', { httpStatus: res.status, to, error: data.error });
                return null;
            }
            return messageId;
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] sendLocation threw', { error: String(err), to });
            return null;
        }
    }
    /** Enregistre le numéro auprès de Cloud API (requis avant l'envoi). PIN 6 digits.
     *  dataLocalizationRegion (ISO 2-letter, ex "DE", "FR") force le stockage régional (RGPD).
     */
    async registerPhoneNumber(config, pin, dataLocalizationRegion) {
        try {
            const token = decrypt(config.accessToken);
            const body = { messaging_product: 'whatsapp', pin };
            if (dataLocalizationRegion && /^[A-Z]{2}$/.test(dataLocalizationRegion)) {
                body['data_localization_region'] = dataLocalizationRegion;
            }
            const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/register`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success)
                return { success: true };
            logger_1.logger.warn('[WhatsApp] registerPhoneNumber failed', { phoneNumberId: config.phoneNumberId, metaError: data.error });
            return { success: false, error: data.error?.message ?? 'Unknown error' };
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] registerPhoneNumber threw', { error: String(err) });
            return { success: false, error: String(err) };
        }
    }
    /** Envoie un template approuvé par Meta */
    async sendTemplate(config, to, templateName, language, parameters) {
        try {
            const token = decrypt(config.accessToken);
            const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp', to, type: 'template',
                    template: {
                        name: templateName,
                        language: { code: language },
                        components: parameters.length > 0 ? [{
                                type: 'body',
                                parameters: parameters.map(p => ({ type: 'text', text: p })),
                            }] : undefined,
                    },
                }),
            });
            const data = await res.json();
            return data.messages?.[0]?.id ?? null;
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] sendTemplate failed', { error: err });
            return null;
        }
    }
    /** Envoie une vidéo */
    async sendVideo(config, to, videoUrl, caption) {
        try {
            const token = decrypt(config.accessToken);
            const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp', to, type: 'video',
                    video: { link: videoUrl, caption },
                }),
            });
            const data = await res.json();
            return data.messages?.[0]?.id ?? null;
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] sendVideo failed', { error: err });
            return null;
        }
    }
    /** Envoie un message avec boutons interactifs */
    async sendInteractive(config, to, body, buttons) {
        try {
            const token = decrypt(config.accessToken);
            const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp', to, type: 'interactive',
                    interactive: {
                        type: 'button',
                        body: { text: body },
                        action: {
                            buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })),
                        },
                    },
                }),
            });
            const data = await res.json();
            return data.messages?.[0]?.id ?? null;
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] sendInteractive failed', { error: err });
            return null;
        }
    }
    /**
     * Récupère la clé OpenAI de l'entreprise (BYOE) ou fallback sur la clé plateforme
     */
    async getOpenAIKey(companyId) {
        try {
            const config = await tenantManager_1.tenantManager.getTenantConfig(companyId);
            if (config.byoeEnabled && config.ai?.openai?.apiKey) {
                return (0, encryption_1.decrypt)(config.ai.openai.apiKey);
            }
        }
        catch { /* fallback */ }
        const platformKey = process.env['OPENAI_API_KEY'];
        if (!platformKey)
            throw new Error('OPENAI_API_KEY not configured');
        return platformKey;
    }
    /**
     * Télécharge et transcrit un message vocal WhatsApp via Whisper (OpenAI)
     * 1. Récupère l'URL du média depuis Meta Graph API
     * 2. Télécharge le fichier audio
     * 3. Envoie à Whisper pour transcription
     */
    /** Whisper transcription from a raw audio buffer (channel-agnostic).
     *  Used by Telegram + any other channel that gets the audio bytes directly. */
    async transcribeAudioBuffer(audioBuffer, mimeType, companyId = 'default') {
        if (!audioBuffer.length)
            return null;
        const openaiKey = await this.getOpenAIKey(companyId);
        if (!openaiKey)
            return null;
        const ext = mimeType.includes('ogg') ? 'ogg'
            : mimeType.includes('mp3') ? 'mp3'
                : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
                    : 'ogg';
        const safeMime = mimeType.startsWith('audio/') ? mimeType : 'audio/ogg';
        const call = async () => {
            const fd = new FormData();
            fd.append('file', new Blob([audioBuffer], { type: safeMime }), `audio.${ext}`);
            fd.append('model', 'whisper-1');
            fd.append('language', 'fr');
            const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${openaiKey}` },
                body: fd,
            });
            return { ok: res.ok, status: res.status, raw: await res.text() };
        };
        let attempt = await call();
        if (!attempt.ok && (attempt.status >= 500 || attempt.status === 429)) {
            await new Promise(r => setTimeout(r, 800));
            attempt = await call();
        }
        if (!attempt.ok)
            return null;
        try {
            const j = JSON.parse(attempt.raw);
            return j.text?.trim() ?? null;
        }
        catch {
            return null;
        }
    }
    async transcribeAudio(audioId, accessToken, companyId = 'default') {
        // 1. Obtenir URL média Meta
        const mediaRes = await fetch(`${GRAPH_API}/${audioId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const mediaRaw = await mediaRes.text();
        if (!mediaRes.ok) {
            throw new Error(`Meta media URL failed ${mediaRes.status}: ${mediaRaw}`);
        }
        const mediaData = JSON.parse(mediaRaw);
        if (!mediaData.url)
            throw new Error(`No media URL from Meta: ${mediaRaw}`);
        // 2. Télécharger audio
        const audioRes = await fetch(mediaData.url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!audioRes.ok) {
            const errText = await audioRes.text();
            throw new Error(`Meta audio download failed ${audioRes.status}: ${errText}`);
        }
        // FORCED content-type: WhatsApp audio is always Opus in OGG container,
        // but the response Content-Type header is often unreliable (Meta sometimes
        // returns application/octet-stream which makes Whisper reject the file).
        const contentType = 'audio/ogg';
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        if (!audioBuffer.length) {
            throw new Error('Downloaded audio is empty');
        }
        // 3. Clé OpenAI
        const openaiKey = await this.getOpenAIKey(companyId);
        if (!openaiKey) {
            throw new Error(`Missing OpenAI key for companyId=${companyId}`);
        }
        // 4. Whisper — with one retry on transient failure (5xx, network blip)
        const callWhisper = async () => {
            const fd = new FormData();
            fd.append('file', new Blob([audioBuffer], { type: contentType }), 'whatsapp-audio.ogg');
            fd.append('model', 'whisper-1');
            fd.append('language', 'fr');
            const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${openaiKey}` },
                body: fd,
            });
            return { ok: res.ok, status: res.status, raw: await res.text() };
        };
        let attempt = await callWhisper();
        // Retry once on 5xx (transient OpenAI failure) or 429 (rate-limit) — short backoff.
        if (!attempt.ok && (attempt.status >= 500 || attempt.status === 429)) {
            await new Promise(r => setTimeout(r, 800));
            attempt = await callWhisper();
        }
        if (!attempt.ok) {
            throw new Error(`Whisper failed ${attempt.status}: ${attempt.raw}`);
        }
        const whisperData = JSON.parse(attempt.raw);
        if (whisperData.error) {
            throw new Error(`Whisper error: ${whisperData.error.message}`);
        }
        return whisperData.text?.trim() ?? '';
    }
    /**
     * Synthétise du texte en audio MP3 via OpenAI TTS
     * Puis upload sur Firebase Storage et retourne une URL publique
     */
    async synthesizeVoice(text, companyId, voice = 'alloy') {
        const openaiKey = await this.getOpenAIKey(companyId);
        // Synthèse TTS
        const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'tts-1',
                input: text.slice(0, 4096),
                voice: voice,
                response_format: 'mp3',
            }),
        });
        if (!ttsRes.ok)
            throw new Error(`TTS error: ${ttsRes.status}`);
        const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
        // Upload sur Firebase Storage
        const bucket = (0, firebase_config_1.getStorage)().bucket();
        const fileName = `whatsapp-voice/${companyId}/${Date.now()}.mp3`;
        const file = bucket.file(fileName);
        await file.save(audioBuffer, { metadata: { contentType: 'audio/mpeg' } });
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        logger_1.logger.info('[WhatsApp] Voice synthesized and uploaded', { companyId, fileName });
        return publicUrl;
    }
    /**
     * Réponse vocale complète : synthétise le texte et l'envoie comme message audio WhatsApp
     */
    async sendVoiceReply(config, to, text, companyId) {
        try {
            const audioUrl = await this.synthesizeVoice(text, companyId, config.ttsVoice ?? 'alloy');
            const token = decrypt(config.accessToken);
            const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to,
                    type: 'audio',
                    audio: { link: audioUrl },
                }),
            });
            const data = await res.json();
            logger_1.logger.info('[WhatsApp] Voice reply sent', { to, audioUrl });
            return data.messages?.[0]?.id ?? null;
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] sendVoiceReply failed', { error: err });
            return null;
        }
    }
    /** Parse delivery/read status updates from Meta webhook */
    parseStatuses(payload) {
        try {
            const entry = payload['entry']?.[0];
            const changes = entry?.['changes']?.[0];
            const value = changes?.['value'];
            const statuses = value?.['statuses'];
            if (!statuses?.length)
                return [];
            return statuses.map((s) => {
                const st = s;
                return {
                    messageId: st['id'] ?? '',
                    status: st['status'] ?? 'sent', // sent, delivered, read, failed
                    timestamp: parseInt(st['timestamp'] ?? '0') * 1000,
                };
            });
        }
        catch {
            return [];
        }
    }
    /** Parse un payload webhook entrant de Meta */
    parseWebhook(payload) {
        try {
            const entry = payload['entry']?.[0];
            const changes = entry?.['changes']?.[0];
            const value = changes?.['value'];
            const messages = value?.['messages'];
            if (!messages?.length)
                return null;
            const msg = messages[0];
            const textBody = msg['text']?.['body'];
            const interactiveTitle = msg['interactive']?.['button_reply']?.['title'];
            const audioId = msg['audio']?.['id'];
            const imageId = msg['image']?.['id'];
            const imageCaption = msg['image']?.['caption'];
            const docCaption = msg['document']?.['caption'];
            const videoCaption = msg['video']?.['caption'];
            const phoneNumberId = value?.['metadata']?.['phone_number_id'];
            // Click-to-WhatsApp ad referral — Meta attaches this when a customer
            // arrives via a Facebook/Instagram ad with the "Send WhatsApp message" CTA.
            const refRaw = msg['referral'];
            const referral = refRaw ? {
                source_id: refRaw['source_id'],
                source_url: refRaw['source_url'],
                source_type: refRaw['source_type'],
                headline: refRaw['headline'],
                body: refRaw['body'],
                media_type: refRaw['media_type'],
                image_url: refRaw['image_url'],
                video_url: refRaw['video_url'],
                thumbnail_url: refRaw['thumbnail_url'],
                ctwa_clid: refRaw['ctwa_clid'],
            } : undefined;
            return {
                from: msg['from'],
                message: textBody ?? interactiveTitle ?? imageCaption ?? videoCaption ?? docCaption ?? '',
                type: msg['type'] ?? 'text',
                timestamp: parseInt(msg['timestamp']) * 1000,
                messageId: msg['id'],
                audioId,
                imageId,
                caption: imageCaption ?? videoCaption ?? docCaption,
                phoneNumberId,
                referral,
            };
        }
        catch {
            return null;
        }
    }
}
exports.WhatsAppService = WhatsAppService;
exports.whatsappService = new WhatsAppService();
//# sourceMappingURL=whatsappService.js.map