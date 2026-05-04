/**
 * Vision Agent — Gemini Flash
 *
 * Pattern: agent-as-tool (called by Meeting agent + Orchestrator)
 * Responsibility: Image/frame analysis, scene description, object detection,
 * face context in meetings (not biometric enrollment — that's face-api.js).
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { logger } from '../utils/logger';

const INPUT = z.object({
  imageBase64: z.string().describe('Base64-encoded image or video frame'),
  mimeType:    z.string().optional().default('image/jpeg'),
  task:        z.enum(['analyze', 'describe', 'count_people', 'read_text', 'detect_objects'])
               .optional().default('analyze'),
  context:     z.string().optional().describe('Additional context (e.g., meeting name, location)'),
});

const OUTPUT = z.object({
  description:  z.string(),
  peopleCount:  z.number().optional(),
  textFound:    z.string().optional(),
  objects:      z.array(z.string()).optional(),
  sentiment:    z.enum(['positive', 'neutral', 'negative', 'unknown']).optional(),
  confidence:   z.enum(['high', 'medium', 'low']),
});

export type VisionInput  = z.infer<typeof INPUT>;
export type VisionOutput = z.infer<typeof OUTPUT>;

const TASK_PROMPTS: Record<string, string> = {
  analyze:        'Provide a comprehensive analysis of this image: what you see, people present, objects, environment, and any notable details.',
  describe:       'Describe this image clearly and concisely in 2-3 sentences.',
  count_people:   'Count the number of people visible in this image. Describe their positions and general appearance.',
  read_text:      'Read and transcribe all text visible in this image. Preserve formatting where possible.',
  detect_objects: 'List all significant objects, items, and elements visible in this image.',
};

// ── The flow ──────────────────────────────────────────────────────────────────
export const visionAgentFlow = ai.defineFlow(
  { name: 'visionAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ imageBase64, mimeType, task, context }): Promise<VisionOutput> => {
    logger.info(`[VisionAgent] Task: ${task}`);

    const taskPrompt = TASK_PROMPTS[task ?? 'analyze'];
    const contextNote = context ? `\nContext: ${context}` : '';

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: [
        {
          media: {
            contentType: (mimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp',
            url: `data:${mimeType ?? 'image/jpeg'};base64,${imageBase64}`,
          },
        },
        {
          text: `${taskPrompt}${contextNote}

🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
- N'invente PAS ce que tu ne vois pas clairement. Si l'image est floue, sombre, ou ambiguë, retourne confidence: "low" et description honnête ("image trop sombre pour identifier").
- Pour peopleCount : si tu n'es pas sûr, retourne null (pas une devinette).
- Pour textFound : ne retourne que le texte EFFECTIVEMENT visible — ne complète pas / ne reformule pas / ne traduis pas.
- N'affirme PAS reconnaître quelqu'un par le visage — c'est le rôle de face-api.js.
- Pour sentiment : "unknown" est OK si tu ne peux pas juger.

Return JSON:
{
  "description": "detailed description (honest about what you cannot see)",
  "peopleCount": <number or null if unsure>,
  "textFound": "actual visible text or null",
  "objects": ["object1", "object2"],
  "sentiment": "positive|neutral|negative|unknown",
  "confidence": "high|medium|low"
}

Return ONLY JSON.`,
        },
      ],
      config: { temperature: 0.1 },
    });

    try {
      const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, '')) as VisionOutput;
      logger.info(`[VisionAgent] Analysis complete, confidence: ${parsed.confidence}`);
      return parsed;
    } catch {
      logger.warn('[VisionAgent] Failed to parse JSON, returning raw description');
      return {
        description: text,
        confidence:  'low',
        sentiment:   'unknown',
        objects:     [],
      };
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: EVENT DETECTION + ALERTS + AUTO-TAGGING
// ══════════════════════════════════════════════════════════════════════════════

export interface VisionEvent {
  type: 'person_arrived' | 'unknown_face' | 'badge_detected' | 'security_risk' | 'crowd' | 'empty_room';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  tags: string[];
}

/** Analyze image for events + auto-tag */
export async function detectVisionEvents(imageBase64: string, mimeType: string, context?: string): Promise<{ events: VisionEvent[]; tags: string[] }> {
  const { text } = await ai.generate({
    model: GEMINI_FLASH,
    prompt: [
      { media: { contentType: (mimeType ?? 'image/jpeg') as 'image/jpeg', url: `data:${mimeType};base64,${imageBase64}` } },
      { text: `Analyze this image for security and business events.${context ? ` Context: ${context}` : ''}

Detect: person arriving, unknown/unrecognized faces, badge/ID visible, security risks (unauthorized area, suspicious behavior), crowd gathering, empty room when should be occupied.

Also generate tags for this image: meeting_important, client_present, security_risk, empty_office, crowded, badge_visible, document_visible, presentation, etc.

Return JSON ONLY:
{"events":[{"type":"person_arrived|unknown_face|badge_detected|security_risk|crowd|empty_room","severity":"info|warning|critical","description":"..."}],"tags":["tag1","tag2"]}
Return empty arrays if nothing notable.` },
    ],
    config: { temperature: 0.1 },
  });

  try {
    return JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
  } catch {
    return { events: [], tags: [] };
  }
}

/** Process events and trigger alerts */
export async function processVisionAlerts(companyId: string, events: VisionEvent[]): Promise<string[]> {
  const alerts: string[] = [];
  for (const event of events) {
    if (event.severity === 'critical' || event.severity === 'warning') {
      try {
        const { createNotification } = await import('../services/notificationService');
        await createNotification({
          companyId, type: event.severity === 'critical' ? 'security_alert' : 'system',
          title: `Vision: ${event.type.replace(/_/g, ' ')}`,
          message: event.description,
          actionUrl: event.type === 'security_risk' || event.type === 'unknown_face' ? '/security' : '/reception',
          icon: event.severity === 'critical' ? 'ShieldAlert' : 'Eye',
          severity: event.severity === 'critical' ? 'error' : 'warning',
        });
        alerts.push(`${event.severity}: ${event.description}`);
      } catch {}
    }
  }
  return alerts;
}

// ── Expose as a tool ──────────────────────────────────────────────────────────
export const visionAgentTool = ai.defineTool(
  {
    name: 'analyzeImage',
    description: 'Vision PRO: analyze images, detect events (arrivals, unknown faces, security risks), auto-tag, trigger alerts.',
    inputSchema:  INPUT,
    outputSchema: OUTPUT,
  },
  (input) => visionAgentFlow(input)
);
