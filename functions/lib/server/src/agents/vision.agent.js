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
exports.visionAgentTool = exports.visionAgentFlow = void 0;
exports.detectVisionEvents = detectVisionEvents;
exports.processVisionAlerts = processVisionAlerts;
/**
 * Vision Agent — Gemini Flash
 *
 * Pattern: agent-as-tool (called by Meeting agent + Orchestrator)
 * Responsibility: Image/frame analysis, scene description, object detection,
 * face context in meetings (not biometric enrollment — that's face-api.js).
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const logger_1 = require("../utils/logger");
const INPUT = zod_1.z.object({
    imageBase64: zod_1.z.string().describe('Base64-encoded image or video frame'),
    mimeType: zod_1.z.string().optional().default('image/jpeg'),
    task: zod_1.z.enum(['analyze', 'describe', 'count_people', 'read_text', 'detect_objects'])
        .optional().default('analyze'),
    context: zod_1.z.string().optional().describe('Additional context (e.g., meeting name, location)'),
});
const OUTPUT = zod_1.z.object({
    description: zod_1.z.string(),
    peopleCount: zod_1.z.number().optional(),
    textFound: zod_1.z.string().optional(),
    objects: zod_1.z.array(zod_1.z.string()).optional(),
    sentiment: zod_1.z.enum(['positive', 'neutral', 'negative', 'unknown']).optional(),
    confidence: zod_1.z.enum(['high', 'medium', 'low']),
});
const TASK_PROMPTS = {
    analyze: 'Provide a comprehensive analysis of this image: what you see, people present, objects, environment, and any notable details.',
    describe: 'Describe this image clearly and concisely in 2-3 sentences.',
    count_people: 'Count the number of people visible in this image. Describe their positions and general appearance.',
    read_text: 'Read and transcribe all text visible in this image. Preserve formatting where possible.',
    detect_objects: 'List all significant objects, items, and elements visible in this image.',
};
// ── The flow ──────────────────────────────────────────────────────────────────
exports.visionAgentFlow = genkit_config_1.ai.defineFlow({ name: 'visionAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ imageBase64, mimeType, task, context }) => {
    logger_1.logger.info(`[VisionAgent] Task: ${task}`);
    const taskPrompt = TASK_PROMPTS[task ?? 'analyze'];
    const contextNote = context ? `\nContext: ${context}` : '';
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: [
            {
                media: {
                    contentType: (mimeType ?? 'image/jpeg'),
                    url: `data:${mimeType ?? 'image/jpeg'};base64,${imageBase64}`,
                },
            },
            {
                text: `${taskPrompt}${contextNote}

Return JSON:
{
  "description": "detailed description",
  "peopleCount": <number or null>,
  "textFound": "any text visible or null",
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
        const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        logger_1.logger.info(`[VisionAgent] Analysis complete, confidence: ${parsed.confidence}`);
        return parsed;
    }
    catch {
        logger_1.logger.warn('[VisionAgent] Failed to parse JSON, returning raw description');
        return {
            description: text,
            confidence: 'low',
            sentiment: 'unknown',
            objects: [],
        };
    }
});
/** Analyze image for events + auto-tag */
async function detectVisionEvents(imageBase64, mimeType, context) {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: [
            { media: { contentType: (mimeType ?? 'image/jpeg'), url: `data:${mimeType};base64,${imageBase64}` } },
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
    }
    catch {
        return { events: [], tags: [] };
    }
}
/** Process events and trigger alerts */
async function processVisionAlerts(companyId, events) {
    const alerts = [];
    for (const event of events) {
        if (event.severity === 'critical' || event.severity === 'warning') {
            try {
                const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
                await createNotification({
                    companyId, type: event.severity === 'critical' ? 'security_alert' : 'system',
                    title: `Vision: ${event.type.replace(/_/g, ' ')}`,
                    message: event.description,
                    actionUrl: event.type === 'security_risk' || event.type === 'unknown_face' ? '/security' : '/reception',
                    icon: event.severity === 'critical' ? 'ShieldAlert' : 'Eye',
                    severity: event.severity === 'critical' ? 'error' : 'warning',
                });
                alerts.push(`${event.severity}: ${event.description}`);
            }
            catch { }
        }
    }
    return alerts;
}
// ── Expose as a tool ──────────────────────────────────────────────────────────
exports.visionAgentTool = genkit_config_1.ai.defineTool({
    name: 'analyzeImage',
    description: 'Vision PRO: analyze images, detect events (arrivals, unknown faces, security risks), auto-tag, trigger alerts.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, (input) => (0, exports.visionAgentFlow)(input));
//# sourceMappingURL=vision.agent.js.map