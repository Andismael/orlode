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
        await (0, firebase_config_1.getFirestore)()
            .collection('companies').doc(companyId)
            .collection('integrations').doc('whatsapp')
            .update({ ...settings, updatedAt: new Date() });
    }
    /** Déconnecte WhatsApp */
    async disconnect(companyId) {
        await (0, firebase_config_1.getFirestore)()
            .collection('companies').doc(companyId)
            .collection('integrations').doc('whatsapp')
            .delete();
    }
    /** Envoie un message texte */
    async sendMessage(config, to, text) {
        try {
            const token = decrypt(config.accessToken);
            // Diagnostic: log token shape without exposing it
            logger_1.logger.info('[WhatsApp] Token check', {
                storedLen: config.accessToken.length,
                storedPrefix: config.accessToken.slice(0, 20),
                decryptedLen: token.length,
                decryptedPrefix: token.slice(0, 20),
                decryptedSuffix: token.slice(-10),
                looksLikeMetaToken: token.startsWith('EAA'),
            });
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
            return messageId;
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] sendMessage threw exception', { error: String(err), to });
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
            const phoneNumberId = value?.['metadata']?.['phone_number_id'];
            return {
                from: msg['from'],
                message: textBody ?? interactiveTitle ?? '',
                type: msg['type'] ?? 'text',
                timestamp: parseInt(msg['timestamp']) * 1000,
                messageId: msg['id'],
                audioId,
                phoneNumberId,
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