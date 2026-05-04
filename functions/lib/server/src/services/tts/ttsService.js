"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeSpeech = synthesizeSpeech;
/**
 * TTS Service — Google Cloud Text-to-Speech via REST API
 * Utilise la clé GOOGLE_AI_API_KEY existante pour Chirp 3 HD.
 * Fallback sur ElevenLabs si configuré.
 */
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
/**
 * Google TTS via REST (Chirp 3 HD / WaveNet)
 * Utilise l'API texttospeech.googleapis.com avec la clé API Google.
 */
async function googleTTS(text, language, rate) {
    const apiKey = env_config_1.env.GOOGLE_AI_API_KEY;
    if (!apiKey)
        throw new Error('GOOGLE_AI_API_KEY not configured');
    // Map language codes to Google TTS voice names
    const voiceMap = {
        'fr': { name: 'fr-FR-Chirp3-HD-Kore', lang: 'fr-FR' },
        'fr-FR': { name: 'fr-FR-Chirp3-HD-Kore', lang: 'fr-FR' },
        'en': { name: 'en-US-Chirp3-HD-Charon', lang: 'en-US' },
        'en-US': { name: 'en-US-Chirp3-HD-Charon', lang: 'en-US' },
        'en-GB': { name: 'en-GB-Chirp3-HD-Aoede', lang: 'en-GB' },
        'ar': { name: 'ar-XA-Chirp3-HD-Kore', lang: 'ar-XA' },
        'ar-XA': { name: 'ar-XA-Chirp3-HD-Kore', lang: 'ar-XA' },
        'es': { name: 'es-ES-Chirp3-HD-Kore', lang: 'es-ES' },
        'es-ES': { name: 'es-ES-Chirp3-HD-Kore', lang: 'es-ES' },
        'pt': { name: 'pt-BR-Chirp3-HD-Kore', lang: 'pt-BR' },
        'sw': { name: 'sw-KE-Standard-A', lang: 'sw-KE' },
    };
    const langKey = language.toLowerCase();
    const voice = voiceMap[langKey] ?? voiceMap[langKey.split('-')[0]] ?? { name: 'fr-FR-Chirp3-HD-Kore', lang: 'fr-FR' };
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            input: { text },
            voice: {
                languageCode: voice.lang,
                name: voice.name,
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: rate,
                pitch: 0,
                sampleRateHertz: 24000,
            },
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        logger_1.logger.error('[TTS/Google] API error', { status: response.status, body: errorBody });
        // Fallback to standard WaveNet voice if Chirp3 not available
        const fallbackResponse = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text },
                voice: {
                    languageCode: voice.lang,
                    ssmlGender: 'FEMALE',
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: rate,
                    pitch: 0,
                },
            }),
        });
        if (!fallbackResponse.ok) {
            const fallbackError = await fallbackResponse.text();
            throw new Error(`Google TTS failed: ${fallbackError}`);
        }
        const fallbackData = await fallbackResponse.json();
        return Buffer.from(fallbackData.audioContent, 'base64');
    }
    const data = await response.json();
    return Buffer.from(data.audioContent, 'base64');
}
/**
 * ElevenLabs TTS — voix premium (optionnel)
 */
async function elevenLabsTTS(text, _language, rate) {
    const apiKey = env_config_1.env.ELEVENLABS_API_KEY;
    const voiceId = env_config_1.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah
    if (!apiKey)
        throw new Error('ELEVENLABS_API_KEY not configured');
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
                stability: 0.7,
                similarity_boost: 0.8,
                speed: rate,
            },
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`ElevenLabs TTS failed: ${errorBody}`);
    }
    return Buffer.from(await response.arrayBuffer());
}
/**
 * Synthétise du texte en audio MP3.
 * Google TTS par défaut, ElevenLabs en premium.
 */
async function synthesizeSpeech(options) {
    const { text, language = 'fr-FR', rate = 1.0 } = options;
    let provider = options.provider ?? 'google';
    // Si ElevenLabs demandé mais pas configuré, fallback Google
    if (provider === 'elevenlabs' && !env_config_1.env.ELEVENLABS_API_KEY) {
        logger_1.logger.warn('[TTS] ElevenLabs requested but not configured, falling back to Google');
        provider = 'google';
    }
    // Si Google pas configuré mais ElevenLabs oui, switch
    if (provider === 'google' && !env_config_1.env.GOOGLE_AI_API_KEY && env_config_1.env.ELEVENLABS_API_KEY) {
        logger_1.logger.warn('[TTS] Google not configured, falling back to ElevenLabs');
        provider = 'elevenlabs';
    }
    logger_1.logger.info('[TTS] Synthesizing', { provider, language, textLength: text.length });
    const audioBuffer = provider === 'elevenlabs'
        ? await elevenLabsTTS(text, language, rate)
        : await googleTTS(text, language, rate);
    return {
        audioBuffer,
        contentType: 'audio/mpeg',
        provider,
    };
}
//# sourceMappingURL=ttsService.js.map