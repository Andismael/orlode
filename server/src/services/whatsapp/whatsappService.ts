/**
 * WhatsApp Business API Service
 * Gère l'envoi et la réception de messages WhatsApp via Meta Cloud API.
 * Chaque client a ses propres credentials (BYOE — stockés chiffrés dans Firestore).
 * Voice: Whisper (transcription) + OpenAI TTS (synthèse) + Firebase Storage (hébergement)
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getFirestore, getStorage } from '../../config/firebase.config';
import { tenantManager } from '../../config/tenantManager';
import { decrypt as decryptMaster } from '../../config/encryption';
import { logger } from '../../utils/logger';

export interface WhatsAppConfig {
  accessToken: string;        // Token Meta du client (chiffré AES-256)
  phoneNumberId: string;      // Phone Number ID du client
  businessAccountId: string;  // WABA ID du client
  webhookVerifyToken: string; // Token de vérification webhook
  // ── Paramètres de conversation ────────────────────────────────────────────
  autoReply: boolean;         // Réponse automatique activée
  replyMode: 'text' | 'voice' | 'auto'; // 'auto' = vocal si message vocal, texte sinon
  ttsVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'; // Voix OpenAI TTS
  language: string;           // Langue du bot (fr, en, ar, es...)
  systemPrompt?: string;      // Instructions personnalisées pour l'agent
  // Coexistence: when true, the number stays linked to the user's WhatsApp
  // Business app on phone AND Cloud API works in parallel (no /register
  // migration). Default false = classic Cloud API mode (number migrated).
  coexistenceMode?: boolean;
}

export interface AdReferral {
  source_id?: string;     // Meta campaign id
  source_url?: string;    // Ad URL
  source_type?: 'ad' | 'post' | string;
  headline?: string;      // Ad headline
  body?: string;          // Ad body
  media_type?: 'image' | 'video' | string;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  ctwa_clid?: string;     // Click-to-WhatsApp click id
}

export interface IncomingMessage {
  from: string;
  message: string;
  type: 'text' | 'interactive' | 'image' | 'document' | 'audio' | 'video';
  timestamp: number;
  messageId: string;
  audioId?: string; // ID du média audio (si type === 'audio')
  phoneNumberId?: string; // Meta Cloud API phone_number_id of the receiving business number
  referral?: AdReferral; // present when the customer arrived via a Click-to-WhatsApp ad
}

const ENCRYPTION_KEY = process.env['WHATSAPP_ENCRYPTION_KEY'] ?? 'corpmind-whatsapp-key-32bytes!!';
const GRAPH_API = 'https://graph.facebook.com/v21.0';

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

function decrypt(encrypted: string): string {
  try {
    const [ivHex, data] = encrypted.split(':');
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const iv = Buffer.from(ivHex, 'hex');
    // createDecipheriv signature: (algorithm, key, iv) — args used to be swapped
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
  } catch (err) {
    logger.error('[WhatsApp] decrypt failed — returning ciphertext as fallback', { err: String(err) });
    return encrypted;
  }
}

export class WhatsAppService {

  /** Récupère la config WhatsApp du client depuis Firestore */
  async getConfig(companyId: string): Promise<WhatsAppConfig | null> {
    try {
      const doc = await getFirestore()
        .collection('companies').doc(companyId)
        .collection('integrations').doc('whatsapp')
        .get();
      if (!doc.exists) return null;
      return doc.data() as WhatsAppConfig;
    } catch {
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
  async fetchPhoneInfo(companyId: string): Promise<{
    displayPhoneNumber: string | null;
    verifiedName: string | null;
    qualityRating: string | null;
  } | null> {
    try {
      const config = await this.getConfig(companyId);
      if (!config) return null;
      const token = decrypt(config.accessToken);
      const url = `${GRAPH_API}/${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        logger.warn('[WhatsApp] fetchPhoneInfo HTTP error', { status: r.status, statusText: r.statusText });
        return null;
      }
      const data = await r.json() as { display_phone_number?: string; verified_name?: string; quality_rating?: string };
      const info = {
        displayPhoneNumber: data.display_phone_number ?? null,
        verifiedName: data.verified_name ?? null,
        qualityRating: data.quality_rating ?? null,
      };
      // Cache for fast subsequent reads
      await getFirestore()
        .collection('companies').doc(companyId)
        .collection('integrations').doc('whatsapp')
        .set({
          displayPhoneNumber: info.displayPhoneNumber,
          verifiedName: info.verifiedName,
          qualityRating: info.qualityRating,
          phoneInfoFetchedAt: new Date(),
        }, { merge: true });
      return info;
    } catch (err) {
      logger.warn('[WhatsApp] fetchPhoneInfo failed', { error: String(err) });
      return null;
    }
  }

  /** Sauvegarde la config WhatsApp (token chiffré) */
  async saveConfig(companyId: string, config: Omit<WhatsAppConfig, 'webhookVerifyToken'>): Promise<void> {
    const webhookVerifyToken = randomBytes(16).toString('hex');
    const db = getFirestore();
    await db
      .collection('companies').doc(companyId)
      .collection('integrations').doc('whatsapp')
      .set({
        ...config,
        accessToken: encrypt(config.accessToken),
        webhookVerifyToken,
        autoReply:   config.autoReply  ?? true,
        replyMode:   config.replyMode  ?? 'auto',
        ttsVoice:    config.ttsVoice   ?? 'alloy',
        language:    config.language   ?? 'fr',
        connectedAt: new Date(),
      });
    // Also mirror phoneNumberId on the root company doc for fast webhook routing
    await db.collection('companies').doc(companyId).set({
      whatsappPhoneNumberId: config.phoneNumberId,
      updatedAt: new Date(),
    }, { merge: true });
  }

  /** Met à jour uniquement les paramètres de conversation (sans toucher aux credentials) */
  async updateSettings(
    companyId: string,
    settings: Partial<Pick<WhatsAppConfig, 'autoReply' | 'replyMode' | 'ttsVoice' | 'language' | 'systemPrompt'>> & {
      personaId?: string;
      humanHandoff?: {
        enabled?: boolean; notifyChannelId?: string;
        threshold?: 'sensitive' | 'normal' | 'strict';
        customerReply?: string;
        notifyEmails?: string[];
        notifyWhatsAppNumbers?: string[];
      };
    },
  ): Promise<void> {
    // Strip undefined fields so we don't accidentally erase stored values.
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (v !== undefined) clean[k] = v;
    }
    clean['updatedAt'] = new Date();
    await getFirestore()
      .collection('companies').doc(companyId)
      .collection('integrations').doc('whatsapp')
      .set(clean, { merge: true });
  }

  /** Déconnecte WhatsApp */
  async disconnect(companyId: string): Promise<void> {
    await getFirestore()
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
  async fetchTemplates(companyId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const config = await this.getConfig(companyId);
      if (!config) return [];
      const token = decrypt(config.accessToken);
      const url = `${GRAPH_API}/${config.businessAccountId}/message_templates?fields=name,status,category,language,components,quality_score,rejected_reason&limit=100`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        logger.warn('[WhatsApp] fetchTemplates HTTP error', { status: r.status, body: body.slice(0, 300) });
        return [];
      }
      const data = await r.json() as { data?: Array<Record<string, unknown>> };
      return data.data ?? [];
    } catch (err) {
      logger.warn('[WhatsApp] fetchTemplates failed', { error: String(err) });
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
  async sendTemplateRich(
    config: WhatsAppConfig,
    to: string,
    templateName: string,
    languageCode: string,
    components?: Array<Record<string, unknown>>,
  ): Promise<{ messageId: string | null; error?: string }> {
    try {
      const token = decrypt(config.accessToken);
      const url = `${GRAPH_API}/${config.phoneNumberId}/messages`;
      const payload: Record<string, unknown> = {
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
      const body = await r.json() as { messages?: Array<{ id: string }>; error?: { message: string } };
      if (!r.ok || body.error) {
        const msg = body.error?.message ?? `HTTP ${r.status}`;
        logger.warn('[WhatsApp] sendTemplate failed', { to, templateName, msg });
        return { messageId: null, error: msg };
      }
      return { messageId: body.messages?.[0]?.id ?? null };
    } catch (err) {
      logger.error('[WhatsApp] sendTemplate threw', { error: String(err), to });
      return { messageId: null, error: (err as Error).message };
    }
  }

  /**
   * Find the Meta Commerce catalog associated with the company's Business
   * Account. A WABA can have one or more catalogs — we return the first
   * (most common case is exactly one).
   */
  async getCatalogId(companyId: string): Promise<string | null> {
    try {
      const config = await this.getConfig(companyId);
      if (!config) return null;
      const token = decrypt(config.accessToken);
      // The owning Business Manager (parent of the WABA) holds the catalog.
      // Easiest: query /{wabaId}/product_catalogs which returns owned-or-linked.
      const url = `${GRAPH_API}/${config.businessAccountId}/product_catalogs?fields=id,name`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        logger.warn('[WhatsApp/Catalog] product_catalogs HTTP error', { status: r.status });
        return null;
      }
      const data = await r.json() as { data?: Array<{ id: string; name?: string }> };
      return data.data?.[0]?.id ?? null;
    } catch (err) {
      logger.warn('[WhatsApp/Catalog] getCatalogId failed', { error: String(err) });
      return null;
    }
  }

  /** List products from the company's catalog. */
  async listCatalogProducts(companyId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const config = await this.getConfig(companyId);
      if (!config) return [];
      const catalogId = await this.getCatalogId(companyId);
      if (!catalogId) return [];
      const token = decrypt(config.accessToken);
      const url = `${GRAPH_API}/${catalogId}/products?fields=id,retailer_id,name,description,price,currency,availability,image_url,visibility&limit=100`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        logger.warn('[WhatsApp/Catalog] products HTTP error', { status: r.status, body: body.slice(0, 200) });
        return [];
      }
      const data = await r.json() as { data?: Array<Record<string, unknown>> };
      return data.data ?? [];
    } catch (err) {
      logger.warn('[WhatsApp/Catalog] listCatalogProducts failed', { error: String(err) });
      return [];
    }
  }

  /**
   * Sends an interactive single-product message via WhatsApp. The customer
   * sees the product card with image + price + a "View" button that opens
   * the product details in WhatsApp.
   */
  async sendProductMessage(
    config: WhatsAppConfig,
    to: string,
    catalogId: string,
    productRetailerId: string,
    bodyText: string,
    footerText?: string,
  ): Promise<{ messageId: string | null; error?: string }> {
    try {
      const token = decrypt(config.accessToken);
      const payload: Record<string, unknown> = {
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
      const body = await r.json() as { messages?: Array<{ id: string }>; error?: { message: string } };
      if (!r.ok || body.error) {
        return { messageId: null, error: body.error?.message ?? `HTTP ${r.status}` };
      }
      return { messageId: body.messages?.[0]?.id ?? null };
    } catch (err) {
      return { messageId: null, error: (err as Error).message };
    }
  }

  /** Envoie un message texte */
  async sendMessage(config: WhatsAppConfig, to: string, text: string): Promise<string | null> {
    try {
      const token = decrypt(config.accessToken);
      // Diagnostic: log token shape without exposing it
      logger.info('[WhatsApp] Token check', {
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
      const data = raw ? JSON.parse(raw) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string; code?: number; type?: string; error_subcode?: number; error_data?: unknown };
      } : {};
      const messageId = data.messages?.[0]?.id;
      if (!messageId) {
        logger.error('[WhatsApp] sendMessage — Meta API did not return messageId', {
          httpStatus: res.status, to, phoneNumberId: config.phoneNumberId,
          metaError: data.error, rawResponse: raw.slice(0, 500),
        });
        return null;
      }
      logger.info('[WhatsApp] sendMessage OK', { to, messageId });
      return messageId;
    } catch (err) {
      logger.error('[WhatsApp] sendMessage threw exception', { error: String(err), to });
      return null;
    }
  }

  /** Enregistre le numéro auprès de Cloud API (requis avant l'envoi). PIN 6 digits.
   *  dataLocalizationRegion (ISO 2-letter, ex "DE", "FR") force le stockage régional (RGPD).
   */
  async registerPhoneNumber(
    config: WhatsAppConfig,
    pin: string,
    dataLocalizationRegion?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const token = decrypt(config.accessToken);
      const body: Record<string, unknown> = { messaging_product: 'whatsapp', pin };
      if (dataLocalizationRegion && /^[A-Z]{2}$/.test(dataLocalizationRegion)) {
        body['data_localization_region'] = dataLocalizationRegion;
      }
      const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/register`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success?: boolean; error?: { message: string; code?: number } };
      if (data.success) return { success: true };
      logger.warn('[WhatsApp] registerPhoneNumber failed', { phoneNumberId: config.phoneNumberId, metaError: data.error });
      return { success: false, error: data.error?.message ?? 'Unknown error' };
    } catch (err) {
      logger.error('[WhatsApp] registerPhoneNumber threw', { error: String(err) });
      return { success: false, error: String(err) };
    }
  }

  /** Envoie un template approuvé par Meta */
  async sendTemplate(
    config: WhatsAppConfig,
    to: string,
    templateName: string,
    language: string,
    parameters: string[],
  ): Promise<string | null> {
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
      const data = await res.json() as { messages?: Array<{ id: string }> };
      return data.messages?.[0]?.id ?? null;
    } catch (err) {
      logger.error('[WhatsApp] sendTemplate failed', { error: err });
      return null;
    }
  }

  /** Envoie une vidéo */
  async sendVideo(config: WhatsAppConfig, to: string, videoUrl: string, caption: string): Promise<string | null> {
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
      const data = await res.json() as { messages?: Array<{ id: string }> };
      return data.messages?.[0]?.id ?? null;
    } catch (err) {
      logger.error('[WhatsApp] sendVideo failed', { error: err });
      return null;
    }
  }

  /** Envoie un message avec boutons interactifs */
  async sendInteractive(
    config: WhatsAppConfig,
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
  ): Promise<string | null> {
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
      const data = await res.json() as { messages?: Array<{ id: string }> };
      return data.messages?.[0]?.id ?? null;
    } catch (err) {
      logger.error('[WhatsApp] sendInteractive failed', { error: err });
      return null;
    }
  }

  /**
   * Récupère la clé OpenAI de l'entreprise (BYOE) ou fallback sur la clé plateforme
   */
  private async getOpenAIKey(companyId: string): Promise<string> {
    try {
      const config = await tenantManager.getTenantConfig(companyId);
      if (config.byoeEnabled && config.ai?.openai?.apiKey) {
        return decryptMaster(config.ai.openai.apiKey);
      }
    } catch { /* fallback */ }
    const platformKey = process.env['OPENAI_API_KEY'];
    if (!platformKey) throw new Error('OPENAI_API_KEY not configured');
    return platformKey;
  }

  /**
   * Télécharge et transcrit un message vocal WhatsApp via Whisper (OpenAI)
   * 1. Récupère l'URL du média depuis Meta Graph API
   * 2. Télécharge le fichier audio
   * 3. Envoie à Whisper pour transcription
   */
  async transcribeAudio(audioId: string, accessToken: string, companyId = 'default'): Promise<string> {
    // 1. Obtenir URL média Meta
    const mediaRes = await fetch(`${GRAPH_API}/${audioId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const mediaRaw = await mediaRes.text();
    if (!mediaRes.ok) {
      throw new Error(`Meta media URL failed ${mediaRes.status}: ${mediaRaw}`);
    }

    const mediaData = JSON.parse(mediaRaw) as { url?: string };
    if (!mediaData.url) throw new Error(`No media URL from Meta: ${mediaRaw}`);

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
    const callWhisper = async (): Promise<{ ok: boolean; status: number; raw: string }> => {
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

    const whisperData = JSON.parse(attempt.raw) as {
      text?: string;
      error?: { message: string };
    };

    if (whisperData.error) {
      throw new Error(`Whisper error: ${whisperData.error.message}`);
    }

    return whisperData.text?.trim() ?? '';
  }

  /**
   * Synthétise du texte en audio MP3 via OpenAI TTS
   * Puis upload sur Firebase Storage et retourne une URL publique
   */
  async synthesizeVoice(text: string, companyId: string, voice: WhatsAppConfig['ttsVoice'] = 'alloy'): Promise<string> {
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
    if (!ttsRes.ok) throw new Error(`TTS error: ${ttsRes.status}`);
    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    // Upload sur Firebase Storage
    const bucket = getStorage().bucket();
    const fileName = `whatsapp-voice/${companyId}/${Date.now()}.mp3`;
    const file = bucket.file(fileName);
    await file.save(audioBuffer, { metadata: { contentType: 'audio/mpeg' } });
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    logger.info('[WhatsApp] Voice synthesized and uploaded', { companyId, fileName });
    return publicUrl;
  }

  /**
   * Réponse vocale complète : synthétise le texte et l'envoie comme message audio WhatsApp
   */
  async sendVoiceReply(config: WhatsAppConfig, to: string, text: string, companyId: string): Promise<string | null> {
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
      const data = await res.json() as { messages?: Array<{ id: string }> };
      logger.info('[WhatsApp] Voice reply sent', { to, audioUrl });
      return data.messages?.[0]?.id ?? null;
    } catch (err) {
      logger.error('[WhatsApp] sendVoiceReply failed', { error: err });
      return null;
    }
  }

  /** Parse delivery/read status updates from Meta webhook */
  parseStatuses(payload: Record<string, unknown>): Array<{ messageId: string; status: string; timestamp: number }> {
    try {
      const entry = (payload['entry'] as unknown[])?.[0] as Record<string, unknown>;
      const changes = (entry?.['changes'] as unknown[])?.[0] as Record<string, unknown>;
      const value = changes?.['value'] as Record<string, unknown>;
      const statuses = value?.['statuses'] as unknown[];
      if (!statuses?.length) return [];
      return statuses.map((s) => {
        const st = s as Record<string, unknown>;
        return {
          messageId: (st['id'] as string) ?? '',
          status: (st['status'] as string) ?? 'sent', // sent, delivered, read, failed
          timestamp: parseInt((st['timestamp'] as string) ?? '0') * 1000,
        };
      });
    } catch {
      return [];
    }
  }

  /** Parse un payload webhook entrant de Meta */
  parseWebhook(payload: Record<string, unknown>): IncomingMessage | null {
    try {
      const entry = (payload['entry'] as unknown[])?.[0] as Record<string, unknown>;
      const changes = (entry?.['changes'] as unknown[])?.[0] as Record<string, unknown>;
      const value = changes?.['value'] as Record<string, unknown>;
      const messages = value?.['messages'] as unknown[];
      if (!messages?.length) return null;
      const msg = messages[0] as Record<string, unknown>;
      const textBody = (msg['text'] as Record<string, string>)?.['body'];
      const interactiveTitle = ((msg['interactive'] as Record<string, unknown>)?.['button_reply'] as Record<string, string>)?.['title'];
      const audioId = (msg['audio'] as Record<string, string>)?.['id'];
      const phoneNumberId = (value?.['metadata'] as Record<string, string> | undefined)?.['phone_number_id'];
      // Click-to-WhatsApp ad referral — Meta attaches this when a customer
      // arrives via a Facebook/Instagram ad with the "Send WhatsApp message" CTA.
      const refRaw = msg['referral'] as Record<string, unknown> | undefined;
      const referral: AdReferral | undefined = refRaw ? {
        source_id:     refRaw['source_id']     as string | undefined,
        source_url:    refRaw['source_url']    as string | undefined,
        source_type:   refRaw['source_type']   as string | undefined,
        headline:      refRaw['headline']      as string | undefined,
        body:          refRaw['body']          as string | undefined,
        media_type:    refRaw['media_type']    as string | undefined,
        image_url:     refRaw['image_url']     as string | undefined,
        video_url:     refRaw['video_url']     as string | undefined,
        thumbnail_url: refRaw['thumbnail_url'] as string | undefined,
        ctwa_clid:     refRaw['ctwa_clid']     as string | undefined,
      } : undefined;

      return {
        from:      msg['from'] as string,
        message:   textBody ?? interactiveTitle ?? '',
        type:      (msg['type'] as IncomingMessage['type']) ?? 'text',
        timestamp: parseInt(msg['timestamp'] as string) * 1000,
        messageId: msg['id'] as string,
        audioId,
        phoneNumberId,
        referral,
      };
    } catch {
      return null;
    }
  }
}

export const whatsappService = new WhatsAppService();
