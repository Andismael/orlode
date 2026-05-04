import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { logger } from '../../utils/logger';

export interface TranscriptionResult {
  text: string;          // full plain transcript
  segments: Array<{     // speaker-labeled segments (best effort)
    speaker: string;
    text: string;
    timestamp?: number;
  }>;
  language: string;
  wordCount: number;
  durationEstimate?: number; // seconds, if detectable
}

/**
 * Transcribe an audio or video file buffer using Gemini Flash.
 * Gemini natively supports: mp3, mp4, wav, ogg, webm, m4a, flac
 */
export async function transcribeAudioBuffer(
  buffer: Buffer,
  mimeType: string,
  language = 'auto'
): Promise<TranscriptionResult> {
  const base64 = buffer.toString('base64');

  const languageHint = language === 'auto'
    ? 'Detect the language automatically.'
    : `The language is ${language}.`;

  logger.info(`[TranscriptionService] Transcribing ${Math.round(buffer.length / 1024)} KB (${mimeType})`);

  const { text: rawText } = await ai.generate({
    model: GEMINI_FLASH,
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
    const cleaned = rawText.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'');
    const parsed = JSON.parse(cleaned) as {
      language: string;
      transcript: string;
      segments: Array<{ speaker: string; text: string; timestamp?: number }>;
    };

    const wordCount = parsed.transcript.split(/\s+/).filter(Boolean).length;

    logger.info(`[TranscriptionService] Done — ${wordCount} words, ${parsed.segments.length} segments`);

    return {
      text: parsed.transcript,
      segments: parsed.segments,
      language: parsed.language ?? 'unknown',
      wordCount,
    };
  } catch {
    // Fallback: return raw text if JSON parse fails
    logger.warn('[TranscriptionService] JSON parse failed, using raw text fallback');
    const wordCount = rawText.split(/\s+/).filter(Boolean).length;
    return {
      text: rawText,
      segments: [{ speaker: 'Speaker 1', text: rawText }],
      language: 'unknown',
      wordCount,
    };
  }
}
