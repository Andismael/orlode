import { z } from 'zod';
import { ai, GEMINI_FLASH, GEMINI_FLASH_LITE, TEXT_EMBEDDING_MODEL } from '../../config/genkit.config';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ExtractedEntity {
  type: 'person' | 'organization' | 'date' | 'money' | 'location' | 'product';
  value: string;
  confidence: number;
}

export interface ClassificationResult {
  category: string;
  confidentiality: 'public' | 'internal' | 'confidential' | 'secret';
  tags: string[];
  summary: string;
  department?: string;
  confidence: number;
}

// ── GeminiService ────────────────────────────────────────────────────────────

export class GeminiService {
  private isEnabled(): boolean {
    return Boolean(env.GOOGLE_AI_API_KEY);
  }

  private warnDisabled(method: string): void {
    logger.warn(`[GeminiService.${method}] GOOGLE_AI_API_KEY not set — Gemini unavailable`);
  }

  /**
   * Generate text from a plain-string prompt.
   */
  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    if (!this.isEnabled()) {
      this.warnDisabled('generate');
      return '';
    }

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt,
      config: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
      },
    });

    return text;
  }

  /**
   * Generate structured output validated against a Zod schema.
   */
  async generateWithSchema<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T> {
    if (!this.isEnabled()) {
      this.warnDisabled('generateWithSchema');
      return schema.parse({});
    }

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt,
      config: { temperature: 0.1 },
    });

    const cleaned = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
    return schema.parse(JSON.parse(cleaned));
  }

  /**
   * Generate a dense text embedding vector.
   */
  async embedText(text: string): Promise<number[]> {
    if (!this.isEnabled()) {
      this.warnDisabled('embedText');
      return [];
    }

    const response = await ai.embed({
      embedder: TEXT_EMBEDDING_MODEL,
      content: text,
    });

    return (response as unknown as { embedding: number[] }[])[0]?.embedding ?? response as unknown as number[];
  }

  /**
   * Analyze an image and return a descriptive text response.
   */
  async analyzeImage(imageBase64: string, prompt: string): Promise<string> {
    if (!this.isEnabled()) {
      this.warnDisabled('analyzeImage');
      return '';
    }

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: [
        { text: prompt },
        { media: { url: `data:image/jpeg;base64,${imageBase64}` } },
      ],
      config: { temperature: 0.1 },
    });

    return text;
  }

  /**
   * Detect the language of a text snippet (returns BCP-47 code).
   */
  async detectLanguage(text: string): Promise<string> {
    if (!this.isEnabled()) {
      this.warnDisabled('detectLanguage');
      return 'unknown';
    }

    const preview = text.slice(0, 500);
    // Ultra low-cost — simple task
    const { text: result } = await ai.generate({
      model: GEMINI_FLASH_LITE,
      prompt: `Detect the language of the following text. Respond with only the BCP-47 language code (e.g. en, fr, ar, es, de). No explanation.\n\nText:\n"""${preview}"""`,
      config: { temperature: 0.0 },
    });

    return result.trim().toLowerCase().split(/\s/)[0] ?? 'unknown';
  }

  /**
   * Translate text to a target language.
   */
  async translate(text: string, targetLang: string): Promise<string> {
    if (!this.isEnabled()) {
      this.warnDisabled('translate');
      return text;
    }

    return this.generate(
      `Translate the following text to ${targetLang}. Return only the translated text, no explanation.\n\n"""${text}"""`,
      { temperature: 0.1 }
    );
  }

  /**
   * Extract named entities from text.
   */
  async extractEntities(text: string): Promise<ExtractedEntity[]> {
    if (!this.isEnabled()) {
      this.warnDisabled('extractEntities');
      return [];
    }

    const entitySchema = z.object({
      entities: z.array(
        z.object({
          type: z.enum(['person', 'organization', 'date', 'money', 'location', 'product']),
          value: z.string(),
          confidence: z.number().min(0).max(1),
        })
      ),
    });

    const prompt = `Extract named entities from the following text. Respond with a JSON object matching:
{ "entities": [ { "type": "person|organization|date|money|location|product", "value": "...", "confidence": 0.0-1.0 } ] }
Return ONLY the JSON object.

Text:
"""${text.slice(0, 4000)}"""`;

    try {
      const result = await this.generateWithSchema(prompt, entitySchema);
      return result.entities;
    } catch {
      return [];
    }
  }

  /**
   * Classify a document given its text content and file name.
   */
  async classifyDocument(text: string, fileName: string): Promise<ClassificationResult> {
    if (!this.isEnabled()) {
      this.warnDisabled('classifyDocument');
      return {
        category: 'unknown',
        confidentiality: 'internal',
        tags: [],
        summary: 'Classification unavailable.',
        confidence: 0,
      };
    }

    const classificationSchema = z.object({
      category: z.string(),
      confidentiality: z.enum(['public', 'internal', 'confidential', 'secret']),
      tags: z.array(z.string()),
      summary: z.string(),
      department: z.string().optional(),
      confidence: z.number(),
    });

    const prompt = `Classify this document:
File: ${fileName}
Content preview:
"""${text.slice(0, 2000)}"""

Respond with JSON:
{ "category": "...", "confidentiality": "public|internal|confidential|secret", "tags": [], "summary": "...", "department": "...", "confidence": 0.0-1.0 }`;

    try {
      return await this.generateWithSchema(prompt, classificationSchema);
    } catch {
      return {
        category: 'unknown',
        confidentiality: 'internal',
        tags: [],
        summary: 'Classification failed.',
        confidence: 0,
      };
    }
  }
}

export const geminiService = new GeminiService();
