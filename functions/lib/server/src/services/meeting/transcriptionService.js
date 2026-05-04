"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeAudioBuffer = transcribeAudioBuffer;
const genkit_config_1 = require("../../config/genkit.config");
const logger_1 = require("../../utils/logger");
/**
 * Transcribe an audio or video file buffer using Gemini Flash.
 * Gemini natively supports: mp3, mp4, wav, ogg, webm, m4a, flac
 */
async function transcribeAudioBuffer(buffer, mimeType, language = 'auto') {
    const base64 = buffer.toString('base64');
    const languageHint = language === 'auto'
        ? 'Detect the language automatically.'
        : `The language is ${language}.`;
    logger_1.logger.info(`[TranscriptionService] Transcribing ${Math.round(buffer.length / 1024)} KB (${mimeType})`);
    const { text: rawText } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: [
            {
                media: {
                    url: `data:${mimeType};base64,${base64}`,
                    contentType: mimeType,
                },
            },
            {
                text: `Transcribe this audio/video recording completely and accurately. ${languageHint}

Format the output as JSON:
{
  "language": "detected language code (e.g. fr, en)",
  "transcript": "full plain text transcript",
  "segments": [
    { "speaker": "Speaker 1", "text": "...", "timestamp": 0 },
    { "speaker": "Speaker 2", "text": "...", "timestamp": 15 }
  ]
}

Rules:
- Identify different speakers as Speaker 1, Speaker 2, etc. (or use names if mentioned)
- Each segment = one continuous speech turn
- Timestamp = approximate seconds from start
- Return ONLY the JSON object, no markdown`,
            },
        ],
        config: { temperature: 0 },
    });
    try {
        const cleaned = rawText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned);
        const wordCount = parsed.transcript.split(/\s+/).filter(Boolean).length;
        logger_1.logger.info(`[TranscriptionService] Done — ${wordCount} words, ${parsed.segments.length} segments`);
        return {
            text: parsed.transcript,
            segments: parsed.segments,
            language: parsed.language ?? 'unknown',
            wordCount,
        };
    }
    catch {
        // Fallback: return raw text if JSON parse fails
        logger_1.logger.warn('[TranscriptionService] JSON parse failed, using raw text fallback');
        const wordCount = rawText.split(/\s+/).filter(Boolean).length;
        return {
            text: rawText,
            segments: [{ speaker: 'Speaker 1', text: rawText }],
            language: 'unknown',
            wordCount,
        };
    }
}
//# sourceMappingURL=transcriptionService.js.map